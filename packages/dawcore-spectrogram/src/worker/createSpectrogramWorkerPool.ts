import {
  createSpectrogramWorker,
  type SpectrogramWorkerApi,
  type SpectrogramWorkerFFTParams,
  type SpectrogramWorkerRenderChunksParams,
} from './createSpectrogramWorker';

/**
 * Parse the channel index from a canvas ID like "clipId-ch0-chunk5" → 0.
 * Anchored to the trailing `-ch{N}-chunk{M}` segment so clip IDs containing
 * a `-ch{N}-` substring don't misroute.
 */
function parseChannelFromCanvasId(canvasId: string): number {
  const match = canvasId.match(/-ch(\d+)-chunk\d+$/);
  if (!match) {
    console.warn(
      '[dawcore-spectrogram] canvas ID missing -ch{N}-chunk{M} suffix, routing to worker 0: ' +
        canvasId
    );
    return 0;
  }
  return parseInt(match[1], 10);
}

/**
 * Creates a pool of spectrogram workers that parallelize FFT computation
 * across channels. Each worker handles exactly one channel, so stereo
 * audio computes ch0 and ch1 FFTs in parallel (~1.5s instead of ~2.9s).
 *
 * The pool exposes the same `SpectrogramWorkerApi` interface, so it's
 * a drop-in replacement for a single worker in SpectrogramProvider.
 *
 * Audio data is registered in ALL workers (each needs full data for mono
 * mode) and kept for replay so lazily-created workers can serve
 * pre-registered clips. Canvases are routed to the worker for their channel.
 * computeFFT fans out with channelFilter so each worker computes only its
 * channel.
 *
 * The one-channel-per-worker invariant is load-bearing: the worker's FFT
 * cache key is channel-agnostic (each worker stores its channel at index 0
 * under the same key string), so routing two channels to one worker would
 * silently render the wrong channel's data (#556). When audio has more
 * channels than the pool, the pool GROWS to one worker per channel instead
 * of capping the fan-out.
 */
/**
 * Default pool size: 2 workers (one per channel for stereo).
 * Most web audio is mono or stereo, so 2 is sufficient; the pool grows
 * lazily when audio with more channels arrives.
 */
function defaultPoolSize(): number {
  return 2;
}

/**
 * Growth cap — beyond any real device's channel count. Channel indices past
 * the cap (only reachable via malformed canvas IDs) fail loudly rather than
 * silently rendering another channel's data.
 */
const MAX_POOL_CHANNELS = 32;

export function createSpectrogramWorkerPool(
  createWorker: () => Worker,
  poolSize = defaultPoolSize()
): SpectrogramWorkerApi {
  const workers: SpectrogramWorkerApi[] = [];
  // Registered clip audio, retained so lazily-created workers get the same
  // registrations replayed. Holds references only — the underlying buffers
  // are owned by the caller and copied per-transfer by the worker client.
  const registeredAudio = new Map<
    string,
    { channelDataArrays: Float32Array[]; sampleRate: number }
  >();

  let failedAt = -1;
  try {
    for (let i = 0; i < poolSize; i++) {
      failedAt = i;
      workers.push(createSpectrogramWorker(createWorker()));
    }
    failedAt = -1;
  } catch (err) {
    for (const w of workers) {
      try {
        w.terminate();
      } catch (terminateErr) {
        console.warn(
          '[dawcore-spectrogram] pool constructor cleanup: terminate failed for worker — ' +
            String(terminateErr)
        );
      }
    }
    throw new Error(
      'Failed to create spectrogram worker pool (size=' +
        poolSize +
        ') at worker ' +
        failedAt +
        ': ' +
        (err instanceof Error ? err.message : String(err))
    );
  }

  /**
   * Return the worker owning `channelIndex`, growing the pool if needed.
   * New workers get every registered clip's audio replayed before use.
   */
  function ensureWorkerForChannel(channelIndex: number): SpectrogramWorkerApi {
    if (channelIndex >= MAX_POOL_CHANNELS) {
      console.warn(
        '[dawcore-spectrogram] channel index ' +
          channelIndex +
          ' exceeds the pool growth cap (' +
          MAX_POOL_CHANNELS +
          ') — routing to worker 0'
      );
      return workers[0];
    }
    while (workers.length <= channelIndex) {
      const w = createSpectrogramWorker(createWorker());
      for (const [clipId, entry] of registeredAudio) {
        w.registerAudioData(clipId, entry.channelDataArrays, entry.sampleRate);
      }
      workers.push(w);
    }
    return workers[channelIndex];
  }

  return {
    async computeFFT(
      params: SpectrogramWorkerFFTParams,
      generation = 0
    ): Promise<{ cacheKey: string }> {
      // Mono: single worker computes the mono mix (needs all channel data)
      if (params.mono) {
        return workers[0].computeFFT(params, generation);
      }

      const channelCount = params.channelDataArrays.length;
      if (channelCount === 0) {
        throw new Error(
          '[dawcore-spectrogram] computeFFT called with no channel data — ' +
            'pass the clip channelDataArrays even when audio is pre-registered'
        );
      }
      if (channelCount > MAX_POOL_CHANNELS) {
        throw new Error(
          '[dawcore-spectrogram] computeFFT: ' +
            channelCount +
            ' channels exceeds the pool channel cap (' +
            MAX_POOL_CHANNELS +
            ')'
        );
      }

      // Multi-channel: fan out with channelFilter, one worker per channel,
      // growing the pool when audio has more channels than workers.
      const promises = Array.from({ length: channelCount }, (_, i) =>
        ensureWorkerForChannel(i).computeFFT({ ...params, channelFilter: i }, generation)
      );
      // Use allSettled so one channel's failure doesn't drop surviving channel results.
      // Throw the first failure; log additional ones so they're not silently swallowed.
      const settled = await Promise.allSettled(promises);
      const failures = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
      if (failures.length > 0) {
        for (let i = 1; i < failures.length; i++) {
          console.warn(
            '[dawcore-spectrogram] additional channel FFT failure (' +
              i +
              '): ' +
              (failures[i].reason instanceof Error
                ? failures[i].reason.message
                : String(failures[i].reason))
          );
        }
        throw failures[0].reason;
      }
      return (settled[0] as PromiseFulfilledResult<{ cacheKey: string }>).value;
    },

    renderChunks(params: SpectrogramWorkerRenderChunksParams, generation = 0): Promise<void> {
      if (params.channelIndex >= MAX_POOL_CHANNELS) {
        return Promise.reject(
          new Error(
            '[dawcore-spectrogram] renderChunks: channelIndex ' +
              params.channelIndex +
              ' exceeds the pool channel cap (' +
              MAX_POOL_CHANNELS +
              ')'
          )
        );
      }
      const worker = ensureWorkerForChannel(params.channelIndex);
      // Remap channelIndex to 0 — each worker stores its channel at index 0
      return worker.renderChunks({ ...params, channelIndex: 0 }, generation);
    },

    abortGeneration(generation: number): void {
      for (const w of workers) {
        w.abortGeneration(generation);
      }
    },

    registerCanvas(canvasId: string, canvas: OffscreenCanvas): void {
      const ch = parseChannelFromCanvasId(canvasId);
      ensureWorkerForChannel(ch).registerCanvas(canvasId, canvas);
    },

    unregisterCanvas(canvasId: string): void {
      const ch = parseChannelFromCanvasId(canvasId);
      ensureWorkerForChannel(ch).unregisterCanvas(canvasId);
    },

    registerAudioData(clipId: string, channelDataArrays: Float32Array[], sampleRate: number): void {
      // All workers get full audio data (needed for mono computation);
      // retained for replay into lazily-created workers.
      registeredAudio.set(clipId, { channelDataArrays, sampleRate });
      for (const w of workers) {
        w.registerAudioData(clipId, channelDataArrays, sampleRate);
      }
    },

    unregisterAudioData(clipId: string): void {
      registeredAudio.delete(clipId);
      for (const w of workers) {
        w.unregisterAudioData(clipId);
      }
    },

    terminate(): void {
      registeredAudio.clear();
      for (const w of workers) {
        w.terminate();
      }
    },
  };
}
