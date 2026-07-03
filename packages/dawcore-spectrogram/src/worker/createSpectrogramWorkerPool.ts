import { parseSpectrogramCanvasId } from '@waveform-playlist/core';
import {
  createSpectrogramWorker,
  SpectrogramAbortError,
  type SpectrogramWorkerApi,
  type SpectrogramWorkerFFTParams,
  type SpectrogramWorkerRenderChunksParams,
} from './createSpectrogramWorker';

/**
 * Parse the channel index from a canvas ID like "clipId-ch0-chunk5" → 0.
 * Delegates to the canonical `parseSpectrogramCanvasId` (anchored to the trailing
 * `-ch{N}-chunk{M}` segment so clip IDs containing a `-ch{N}-` substring don't
 * misroute); falls back to worker 0 with a warning when the ID doesn't match.
 */
function parseChannelFromCanvasId(canvasId: string): number {
  const parsed = parseSpectrogramCanvasId(canvasId);
  if (!parsed) {
    console.warn(
      '[dawcore-spectrogram] canvas ID missing -ch{N}-chunk{M} suffix, routing to worker 0: ' +
        canvasId
    );
    return 0;
  }
  return parsed.channelIndex;
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
  if (poolSize > MAX_POOL_CHANNELS) {
    console.warn(
      '[dawcore-spectrogram] workerPoolSize ' +
        poolSize +
        ' exceeds the channel cap (' +
        MAX_POOL_CHANNELS +
        ') — clamping; channels beyond the cap are not servable'
    );
    poolSize = MAX_POOL_CHANNELS;
  }

  const workers: SpectrogramWorkerApi[] = [];
  let terminated = false;
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

  /** Single source of the channel-index policy — every path throws the same way. */
  function assertValidChannelIndex(channelIndex: number): void {
    if (!Number.isInteger(channelIndex) || channelIndex < 0 || channelIndex >= MAX_POOL_CHANNELS) {
      throw new Error(
        '[dawcore-spectrogram] invalid channel index ' +
          channelIndex +
          ' (expected an integer in 0..' +
          (MAX_POOL_CHANNELS - 1) +
          ')'
      );
    }
  }

  /**
   * Return the worker owning `channelIndex`, growing the pool if needed.
   * New workers get the registered clips replayed — but only clips that
   * actually have this worker's channel: worker k computes only
   * channelFilter k (worker 0 additionally serves mono mixes), so a clip
   * with fewer than k+1 channels is dead weight on worker k.
   */
  function ensureWorkerForChannel(channelIndex: number): SpectrogramWorkerApi {
    assertValidChannelIndex(channelIndex);
    if (terminated) {
      throw new Error('[dawcore-spectrogram] worker pool is terminated');
    }
    while (workers.length <= channelIndex) {
      const w = createSpectrogramWorker(createWorker());
      const workerIndex = workers.length;
      for (const [clipId, entry] of registeredAudio) {
        if (entry.channelDataArrays.length > workerIndex) {
          w.registerAudioData(clipId, entry.channelDataArrays, entry.sampleRate);
        }
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
      if (terminated) {
        throw new Error('[dawcore-spectrogram] worker pool is terminated');
      }
      // Channel count from the payload, falling back to pre-registered audio
      // (the client sends empty arrays for registered clips as an optimization).
      const channelCount =
        params.channelDataArrays.length ||
        registeredAudio.get(params.clipId)?.channelDataArrays.length ||
        0;
      if (channelCount === 0) {
        throw new Error(
          '[dawcore-spectrogram] computeFFT called with no channel data — ' +
            'pass channelDataArrays or registerAudioData the clip first'
        );
      }

      // Mono: single worker computes the mono mix (needs all channel data)
      if (params.mono) {
        return workers[0].computeFFT(params, generation);
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
      const settled = await Promise.allSettled(promises);
      const failures = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
      if (failures.length > 0) {
        // Aborts are normal control flow (generation superseded) — never
        // warned, and never allowed to mask a real error when mixed (#562).
        const realErrors = failures.filter((f) => !(f.reason instanceof SpectrogramAbortError));
        for (let i = 1; i < realErrors.length; i++) {
          console.warn(
            '[dawcore-spectrogram] additional channel FFT failure (' +
              i +
              '): ' +
              (realErrors[i].reason instanceof Error
                ? realErrors[i].reason.message
                : String(realErrors[i].reason))
          );
        }
        throw (realErrors[0] ?? failures[0]).reason;
      }
      return (settled[0] as PromiseFulfilledResult<{ cacheKey: string }>).value;
    },

    // async so ensureWorkerForChannel's policy throws surface as rejections,
    // matching computeFFT, instead of escaping synchronously.
    async renderChunks(params: SpectrogramWorkerRenderChunksParams, generation = 0): Promise<void> {
      const worker = ensureWorkerForChannel(params.channelIndex);
      // Remap channelIndex to 0 — each worker stores its channel at index 0
      return worker.renderChunks({ ...params, channelIndex: 0 }, generation);
    },

    abortGeneration(generation: number): void {
      if (terminated) return;
      for (const w of workers) {
        w.abortGeneration(generation);
      }
    },

    registerCanvas(canvasId: string, canvas: OffscreenCanvas): void {
      // Validate BEFORE handing the OffscreenCanvas to any worker — a
      // rejected registration must not transfer (and strand) the canvas.
      try {
        ensureWorkerForChannel(parseChannelFromCanvasId(canvasId)).registerCanvas(canvasId, canvas);
      } catch (err) {
        console.warn(
          '[dawcore-spectrogram] registerCanvas("' +
            canvasId +
            '") rejected — canvas not registered: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    },

    unregisterCanvas(canvasId: string): void {
      if (terminated) return;
      // Non-growing lookup: a canvas whose channel worker was never created
      // cannot be registered anywhere — spawning workers to deliver a no-op
      // unregister would be pure waste.
      const worker = workers[parseChannelFromCanvasId(canvasId)];
      if (!worker) return;
      worker.unregisterCanvas(canvasId);
    },

    registerAudioData(clipId: string, channelDataArrays: Float32Array[], sampleRate: number): void {
      if (terminated) return;
      // Retained for replay into lazily-created workers.
      registeredAudio.set(clipId, { channelDataArrays, sampleRate });
      // Worker k computes only channel k (worker 0 additionally serves mono
      // with the clip's full data), so workers beyond the clip's channel
      // count would never touch these arrays — don't copy into them.
      const relevantWorkers = Math.min(channelDataArrays.length, workers.length);
      for (let i = 0; i < relevantWorkers; i++) {
        workers[i].registerAudioData(clipId, channelDataArrays, sampleRate);
      }
    },

    unregisterAudioData(clipId: string): void {
      if (terminated) return;
      registeredAudio.delete(clipId);
      for (const w of workers) {
        w.unregisterAudioData(clipId);
      }
    },

    terminate(): void {
      terminated = true;
      registeredAudio.clear();
      for (const w of workers) {
        w.terminate();
      }
    },
  };
}
