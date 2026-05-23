import {
  createSpectrogramWorker,
  type SpectrogramWorkerApi,
  type SpectrogramWorkerFFTParams,
  type SpectrogramWorkerRenderChunksParams,
} from './createSpectrogramWorker';

/**
 * Parse the channel index from a canvas ID like "clipId-ch0-chunk5" → 0.
 */
function parseChannelFromCanvasId(canvasId: string): number {
  const match = canvasId.match(/-ch(\d+)-/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Creates a pool of spectrogram workers that parallelize FFT computation
 * across channels. Each worker handles a subset of channels, so stereo
 * audio computes ch0 and ch1 FFTs in parallel (~1.5s instead of ~2.9s).
 *
 * The pool exposes the same `SpectrogramWorkerApi` interface, so it's
 * a drop-in replacement for a single worker in SpectrogramProvider.
 *
 * Audio data is registered in ALL workers (each needs full data for mono
 * mode). Canvases are routed to the worker for their channel. computeFFT
 * fans out with channelFilter so each worker computes only its channel.
 */
/**
 * Default pool size: 2 workers (one per channel for stereo).
 * Most web audio is mono or stereo, so 2 is sufficient.
 * Configurable via `<SpectrogramProvider workerPoolSize={N}>` for
 * multi-channel audio (e.g., 5.1 surround).
 */
function defaultPoolSize(): number {
  return 2;
}

export function createSpectrogramWorkerPool(
  createWorker: () => Worker,
  poolSize = defaultPoolSize()
): SpectrogramWorkerApi {
  const workers: SpectrogramWorkerApi[] = [];
  try {
    for (let i = 0; i < poolSize; i++) {
      workers.push(createSpectrogramWorker(createWorker()));
    }
  } catch (err) {
    for (const w of workers) {
      w.terminate();
    }
    throw err;
  }

  function getWorkerForChannel(channelIndex: number): SpectrogramWorkerApi {
    return workers[channelIndex % workers.length];
  }

  return {
    computeFFT(params: SpectrogramWorkerFFTParams, generation = 0): Promise<{ cacheKey: string }> {
      // Mono: single worker computes the mono mix (needs all channel data)
      if (params.mono) {
        return workers[0].computeFFT(params, generation);
      }

      // Multi-channel: fan out with channelFilter, one worker per channel.
      // Pool may have more workers than channels (e.g., 3 workers for stereo) —
      // only use workers up to the channel count.
      const channelCount = params.channelDataArrays.length;
      const activeWorkers = workers.slice(0, channelCount);
      const promises = activeWorkers.map((w, i) =>
        w.computeFFT({ ...params, channelFilter: i }, generation)
      );
      // Wait for all workers, return any cacheKey (all are identical)
      return Promise.all(promises).then((results) => results[0]);
    },

    renderChunks(params: SpectrogramWorkerRenderChunksParams, generation = 0): Promise<void> {
      const worker = getWorkerForChannel(params.channelIndex);
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
      getWorkerForChannel(ch).registerCanvas(canvasId, canvas);
    },

    unregisterCanvas(canvasId: string): void {
      const ch = parseChannelFromCanvasId(canvasId);
      getWorkerForChannel(ch).unregisterCanvas(canvasId);
    },

    registerAudioData(clipId: string, channelDataArrays: Float32Array[], sampleRate: number): void {
      // All workers get full audio data (needed for mono computation)
      for (const w of workers) {
        w.registerAudioData(clipId, channelDataArrays, sampleRate);
      }
    },

    unregisterAudioData(clipId: string): void {
      for (const w of workers) {
        w.unregisterAudioData(clipId);
      }
    },

    terminate(): void {
      for (const w of workers) {
        w.terminate();
      }
    },
  };
}
