import type { SpectrogramConfig } from '@waveform-playlist/core';

/**
 * Error thrown when a spectrogram computation is aborted due to a generation change.
 * Use `instanceof SpectrogramAbortError` instead of string matching on error messages.
 */
export class SpectrogramAbortError extends Error {
  constructor() {
    super('aborted');
    this.name = 'SpectrogramAbortError';
  }
}

export interface SpectrogramWorkerFFTParams {
  clipId: string;
  channelDataArrays: Float32Array[];
  config: SpectrogramConfig;
  sampleRate: number;
  offsetSamples: number;
  durationSamples: number;
  mono: boolean;
  sampleRange?: { start: number; end: number };
  /** If set, compute only this channel index (used by worker pool). */
  channelFilter?: number;
}

export interface SpectrogramWorkerRenderChunksParams {
  cacheKey: string;
  canvasIds: string[];
  canvasWidths: number[];
  globalPixelOffsets: number[];
  canvasHeight: number;
  devicePixelRatio: number;
  samplesPerPixel: number;
  colorLUT: Uint8Array;
  frequencyScale: string;
  minFrequency: number;
  maxFrequency: number;
  gainDb: number;
  rangeDb: number;
  channelIndex: number;
}

type ComputeResponse =
  | { id: string; type: 'cache-key'; cacheKey: string }
  | { id: string; type: 'done' }
  | { id: string; type: 'aborted' }
  | { id: string; type: 'error'; error: string };

/** Union of all values that worker resolve callbacks receive. */
type PendingResolveValue = { cacheKey: string } | void;

interface PendingEntry {
  resolve: (value: PendingResolveValue) => void;
  reject: (reason: unknown) => void;
}

/** Add a pending promise entry, centralizing the single unavoidable resolve cast. */
function addPending<T>(
  map: Map<string, PendingEntry>,
  id: string,
  resolve: (value: T) => void,
  reject: (reason: unknown) => void
): void {
  map.set(id, { resolve: resolve as PendingEntry['resolve'], reject });
}

export interface SpectrogramWorkerApi {
  computeFFT(
    params: SpectrogramWorkerFFTParams,
    generation?: number
  ): Promise<{ cacheKey: string }>;
  renderChunks(params: SpectrogramWorkerRenderChunksParams, generation?: number): Promise<void>;
  abortGeneration(generation: number): void;
  registerCanvas(canvasId: string, canvas: OffscreenCanvas): void;
  unregisterCanvas(canvasId: string): void;
  registerAudioData(clipId: string, channelDataArrays: Float32Array[], sampleRate: number): void;
  unregisterAudioData(clipId: string): void;
  terminate(): void;
}

let idCounter = 0;

/**
 * Wraps a Web Worker running `spectrogram.worker.ts` with a promise-based API.
 *
 * The caller is responsible for creating the Worker, e.g.:
 * ```ts
 * const worker = new Worker(
 *   new URL('@dawcore/spectrogram/worker/spectrogram.worker', import.meta.url),
 *   { type: 'module' }
 * );
 * const api = createSpectrogramWorker(worker);
 * ```
 */
export function createSpectrogramWorker(worker: Worker): SpectrogramWorkerApi {
  const pending = new Map<string, PendingEntry>();

  // Track which clipIds have pre-registered audio data in the worker
  const registeredClipIds = new Set<string>();
  let terminated = false;

  worker.onmessage = (e: MessageEvent<ComputeResponse>) => {
    const msg = e.data;
    const entry = pending.get(msg.id);
    if (entry) {
      pending.delete(msg.id);
      switch (msg.type) {
        case 'error':
          entry.reject(new Error(msg.error));
          break;
        case 'aborted':
          entry.reject(new SpectrogramAbortError());
          break;
        case 'cache-key':
          entry.resolve({ cacheKey: msg.cacheKey });
          break;
        case 'done':
          entry.resolve(undefined);
          break;
      }
    } else if (msg.id) {
      console.warn(`[spectrogram] Received response for unknown message ID: ${msg.id}`);
    }
  };

  worker.onerror = (e: ErrorEvent) => {
    terminated = true;
    console.error(
      '[dawcore-spectrogram] worker crashed with ' +
        pending.size +
        ' pending operations: ' +
        (e.message || 'unknown error')
    );
    for (const [id, entry] of pending) {
      entry.reject(new Error('Worker crashed (id=' + id + '): ' + (e.message || 'unknown error')));
    }
    pending.clear();
  };

  worker.onmessageerror = (e: MessageEvent) => {
    console.warn(
      '[dawcore-spectrogram] worker postMessage clone failure: ' +
        (e.data ? JSON.stringify(e.data) : 'no data')
    );
  };

  return {
    computeFFT(params: SpectrogramWorkerFFTParams, generation = 0): Promise<{ cacheKey: string }> {
      if (terminated) return Promise.reject(new Error('Worker terminated'));
      const id = String(++idCounter);

      return new Promise<{ cacheKey: string }>((resolve, reject) => {
        addPending(pending, id, resolve, reject);

        // Skip transfer if audio data is pre-registered in the worker
        const isPreRegistered = registeredClipIds.has(params.clipId);
        const transferableArrays = isPreRegistered
          ? []
          : params.channelDataArrays.map((arr) => arr.slice());
        const transferables = transferableArrays.map((arr) => arr.buffer);

        worker.postMessage(
          {
            type: 'compute-fft',
            id,
            generation,
            clipId: params.clipId,
            channelDataArrays: transferableArrays,
            config: params.config,
            sampleRate: params.sampleRate,
            offsetSamples: params.offsetSamples,
            durationSamples: params.durationSamples,
            mono: params.mono,
            ...(params.sampleRange ? { sampleRange: params.sampleRange } : {}),
            ...(params.channelFilter !== undefined ? { channelFilter: params.channelFilter } : {}),
          },
          transferables
        );
      });
    },

    renderChunks(params: SpectrogramWorkerRenderChunksParams, generation = 0): Promise<void> {
      if (terminated) return Promise.reject(new Error('Worker terminated'));
      const id = String(++idCounter);

      return new Promise<void>((resolve, reject) => {
        addPending(pending, id, resolve, reject);

        worker.postMessage({
          type: 'render-chunks',
          id,
          generation,
          cacheKey: params.cacheKey,
          canvasIds: params.canvasIds,
          canvasWidths: params.canvasWidths,
          globalPixelOffsets: params.globalPixelOffsets,
          canvasHeight: params.canvasHeight,
          devicePixelRatio: params.devicePixelRatio,
          samplesPerPixel: params.samplesPerPixel,
          colorLUT: params.colorLUT,
          frequencyScale: params.frequencyScale,
          minFrequency: params.minFrequency,
          maxFrequency: params.maxFrequency,
          gainDb: params.gainDb,
          rangeDb: params.rangeDb,
          channelIndex: params.channelIndex,
        });
      });
    },

    abortGeneration(generation: number): void {
      if (terminated) return;
      worker.postMessage({ type: 'abort-generation', generation });
    },

    registerCanvas(canvasId: string, canvas: OffscreenCanvas): void {
      worker.postMessage({ type: 'register-canvas', canvasId, canvas }, [canvas]);
    },

    unregisterCanvas(canvasId: string): void {
      worker.postMessage({ type: 'unregister-canvas', canvasId });
    },

    registerAudioData(clipId: string, channelDataArrays: Float32Array[], sampleRate: number): void {
      const transferableArrays = channelDataArrays.map((arr) => arr.slice());
      const transferables = transferableArrays.map((arr) => arr.buffer);
      worker.postMessage(
        { type: 'register-audio-data', clipId, channelDataArrays: transferableArrays, sampleRate },
        transferables
      );
      registeredClipIds.add(clipId);
    },

    unregisterAudioData(clipId: string): void {
      worker.postMessage({ type: 'unregister-audio-data', clipId });
      registeredClipIds.delete(clipId);
    },

    terminate() {
      terminated = true;
      worker.terminate();
      for (const [, entry] of pending) {
        entry.reject(new Error('Worker terminated'));
      }
      pending.clear();
    },
  };
}
