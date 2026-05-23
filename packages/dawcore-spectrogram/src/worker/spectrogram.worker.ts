/**
 * Web Worker for off-main-thread spectrogram computation and rendering.
 *
 * Supports:
 * 1. `register-canvas` / `unregister-canvas` — manage OffscreenCanvas ownership
 * 2. `register-audio-data` / `unregister-audio-data` — pre-transfer clip audio data to avoid re-transfer on each FFT request
 * 3. `compute-fft` — FFT with LRU caching, returns cache key (no rendering)
 * 4. `render-chunks` — render specific chunks from cached FFT data
 * 5. `abort-generation` — cancel stale FFT computations cooperatively
 */

import type {
  SpectrogramConfig,
  SpectrogramComputeConfig,
  SpectrogramData,
} from '@waveform-playlist/core';
import { fftMagnitudeDb } from '../computation/fft';
import { getWindowFunction } from '../computation/windowFunctions';
import { getFrequencyScale, type FrequencyScaleName } from '../computation/frequencyScales';

// --- Canvas registry ---
const canvasRegistry = new Map<string, OffscreenCanvas>();

// --- Audio data registry ---
// Pre-transferred audio data keyed by clipId, avoiding re-transfer on compute-fft.
const audioDataRegistry = new Map<
  string,
  { channelDataArrays: Float32Array[]; sampleRate: number }
>();

// --- FFT cache ---
// Caches raw dB spectrogram data keyed by FFT computation params.
// Display-only params (gain, range, colormap) don't affect the cache key.
// sampleOffset: the sample position where this FFT data starts (for range-limited FFT)
// Bounded to MAX_CACHE_ENTRIES to prevent OOM on long files with many ranges.
interface FFTCacheEntry {
  spectrograms: SpectrogramData[];
  sampleOffset: number;
}
const MAX_CACHE_ENTRIES = 16;
const fftCache = new Map<string, FFTCacheEntry>();

function evictLRUCacheEntries(keepKey?: string) {
  while (fftCache.size >= MAX_CACHE_ENTRIES) {
    let deleted = false;
    for (const key of fftCache.keys()) {
      if (key !== keepKey) {
        fftCache.delete(key);
        deleted = true;
        break;
      }
    }
    if (!deleted) break; // Safety: prevent infinite loop if keepKey is the only entry
  }
}

/** Bump a cache entry to most-recently-used by re-inserting it. */
function touchCacheEntry(key: string) {
  const entry = fftCache.get(key);
  if (entry) {
    fftCache.delete(key);
    fftCache.set(key, entry);
  }
}

function generateCacheKey(params: {
  clipId: string;
  channelIndex: number;
  offsetSamples: number;
  durationSamples: number;
  sampleRate: number;
  compute: SpectrogramComputeConfig;
  mono: boolean;
}): string {
  const { compute: c } = params;
  return `${params.clipId}:${params.channelIndex}:${params.offsetSamples}:${params.durationSamples}:${params.sampleRate}:${c.fftSize ?? ''}:${c.zeroPaddingFactor ?? ''}:${c.hopSize ?? ''}:${c.windowFunction ?? ''}:${c.alpha ?? ''}:${params.mono ? 1 : 0}`;
}

// --- Message types ---

interface RegisterCanvasMessage {
  type: 'register-canvas';
  canvasId: string;
  canvas: OffscreenCanvas;
}

interface UnregisterCanvasMessage {
  type: 'unregister-canvas';
  canvasId: string;
}

interface RegisterAudioDataMessage {
  type: 'register-audio-data';
  clipId: string;
  channelDataArrays: Float32Array[];
  sampleRate: number;
}

interface UnregisterAudioDataMessage {
  type: 'unregister-audio-data';
  clipId: string;
}

interface AbortGenerationMessage {
  type: 'abort-generation';
  generation: number;
}

interface ComputeFFTRequest {
  type: 'compute-fft';
  id: string;
  generation: number;
  clipId: string;
  channelDataArrays: Float32Array[];
  config: SpectrogramConfig;
  sampleRate: number;
  offsetSamples: number;
  durationSamples: number;
  mono: boolean;
  sampleRange?: { start: number; end: number };
  /** If set, compute only this channel index (not all channels). */
  channelFilter?: number;
}

interface RenderChunksRequest {
  type: 'render-chunks';
  id: string;
  generation: number;
  cacheKey: string;
  canvasIds: string[]; // flat list of canvas IDs to render
  canvasWidths: number[]; // per-chunk CSS widths
  globalPixelOffsets: number[]; // pixel offset for each chunk
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

type WorkerMessage =
  | RegisterCanvasMessage
  | UnregisterCanvasMessage
  | ComputeFFTRequest
  | RenderChunksRequest
  | RegisterAudioDataMessage
  | UnregisterAudioDataMessage
  | AbortGenerationMessage;

type ComputeResponse =
  | { id: string; type: 'cache-key'; cacheKey: string }
  | { id: string; type: 'done' }
  | { id: string; type: 'aborted' }
  | { id: string; type: 'error'; error: string };

// --- Generation tracking ---
// The main thread sends abort-generation messages when a new computation
// generation starts. The worker tracks the latest generation and aborts
// stale FFT computations by yielding periodically to process messages.
let latestGeneration = 0;
const FRAMES_PER_YIELD = 2000;

function isGenerationStale(generation: number): boolean {
  return generation < latestGeneration;
}

function yieldToMessageQueue(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

// --- FFT computation (async with abort support) ---

async function computeFromChannelData(
  channelData: Float32Array,
  config: SpectrogramConfig,
  sampleRate: number,
  offsetSamples: number,
  durationSamples: number,
  generation: number
): Promise<SpectrogramData | null> {
  const windowSize = config.fftSize ?? 2048;
  const zeroPaddingFactor = config.zeroPaddingFactor ?? 2;
  const actualFftSize = windowSize * zeroPaddingFactor;
  const hopSize = config.hopSize ?? Math.floor(windowSize / 4);
  const windowName = config.windowFunction ?? 'hann';
  const gainDb = config.gainDb ?? 20;
  const rangeDb = config.rangeDb ?? 80;
  const alpha = config.alpha;

  const frequencyBinCount = actualFftSize >> 1;
  const totalSamples = durationSamples;

  const window = getWindowFunction(windowName, windowSize, alpha);
  const frameCount = Math.max(1, Math.floor((totalSamples - windowSize) / hopSize) + 1);
  const data = new Float32Array(frameCount * frequencyBinCount);
  const real = new Float32Array(actualFftSize);
  const dbBuf = new Float32Array(frequencyBinCount);

  for (let frame = 0; frame < frameCount; frame++) {
    // Yield periodically to process abort messages
    if (frame > 0 && frame % FRAMES_PER_YIELD === 0) {
      await yieldToMessageQueue();
      if (isGenerationStale(generation)) return null;
    }

    const start = offsetSamples + frame * hopSize;

    for (let i = 0; i < windowSize; i++) {
      const sampleIdx = start + i;
      real[i] = sampleIdx < channelData.length ? channelData[sampleIdx] * window[i] : 0;
    }
    for (let i = windowSize; i < actualFftSize; i++) {
      real[i] = 0;
    }

    fftMagnitudeDb(real, dbBuf);
    data.set(dbBuf, frame * frequencyBinCount);
  }

  return {
    fftSize: actualFftSize,
    windowSize,
    frequencyBinCount,
    sampleRate,
    hopSize,
    frameCount,
    data,
    gainDb,
    rangeDb,
  };
}

async function computeMonoFromChannels(
  channels: Float32Array[],
  config: SpectrogramConfig,
  sampleRate: number,
  offsetSamples: number,
  durationSamples: number,
  generation: number
): Promise<SpectrogramData | null> {
  if (channels.length === 1) {
    return computeFromChannelData(
      channels[0],
      config,
      sampleRate,
      offsetSamples,
      durationSamples,
      generation
    );
  }

  const windowSize = config.fftSize ?? 2048;
  const zeroPaddingFactor = config.zeroPaddingFactor ?? 2;
  const actualFftSize = windowSize * zeroPaddingFactor;
  const hopSize = config.hopSize ?? Math.floor(windowSize / 4);
  const windowName = config.windowFunction ?? 'hann';
  const gainDb = config.gainDb ?? 20;
  const rangeDb = config.rangeDb ?? 80;
  const alpha = config.alpha;

  const frequencyBinCount = actualFftSize >> 1;
  const numChannels = channels.length;

  const window = getWindowFunction(windowName, windowSize, alpha);
  const frameCount = Math.max(1, Math.floor((durationSamples - windowSize) / hopSize) + 1);
  const data = new Float32Array(frameCount * frequencyBinCount);
  const real = new Float32Array(actualFftSize);
  const dbBuf = new Float32Array(frequencyBinCount);

  for (let frame = 0; frame < frameCount; frame++) {
    // Yield periodically to process abort messages
    if (frame > 0 && frame % FRAMES_PER_YIELD === 0) {
      await yieldToMessageQueue();
      if (isGenerationStale(generation)) return null;
    }

    const start = offsetSamples + frame * hopSize;

    for (let i = 0; i < windowSize; i++) {
      const sampleIdx = start + i;
      let sum = 0;
      for (let ch = 0; ch < numChannels; ch++) {
        sum += sampleIdx < channels[ch].length ? channels[ch][sampleIdx] : 0;
      }
      real[i] = (sum / numChannels) * window[i];
    }
    for (let i = windowSize; i < actualFftSize; i++) {
      real[i] = 0;
    }

    fftMagnitudeDb(real, dbBuf);
    data.set(dbBuf, frame * frequencyBinCount);
  }

  return {
    fftSize: actualFftSize,
    windowSize,
    frequencyBinCount,
    sampleRate,
    hopSize,
    frameCount,
    data,
    gainDb,
    rangeDb,
  };
}

// --- Rendering ---

function renderSpectrogramToCanvas(
  specData: SpectrogramData,
  canvasIds: string[],
  canvasWidths: number[],
  canvasHeight: number,
  devicePixelRatio: number,
  samplesPerPixel: number,
  colorLUT: Uint8Array,
  scaleFn: (f: number, minF: number, maxF: number) => number,
  minFrequency: number,
  maxFrequency: number,
  isNonLinear: boolean,
  globalPixelOffsets?: number[],
  gainDbOverride?: number,
  rangeDbOverride?: number,
  sampleOffset = 0
): void {
  const { frequencyBinCount, frameCount, hopSize, sampleRate } = specData;
  const gainDb = gainDbOverride ?? specData.gainDb;
  const rawRangeDb = rangeDbOverride ?? specData.rangeDb;
  const rangeDb = rawRangeDb === 0 ? 1 : rawRangeDb;
  const maxF = maxFrequency > 0 ? maxFrequency : sampleRate / 2;
  const binToFreq = (bin: number) => (bin / frequencyBinCount) * (sampleRate / 2);

  let accumulatedOffset = 0;

  for (let chunkIdx = 0; chunkIdx < canvasIds.length; chunkIdx++) {
    const canvasId = canvasIds[chunkIdx];
    const offscreen = canvasRegistry.get(canvasId);
    if (!offscreen) {
      console.warn(`[spectrogram-worker] Canvas "${canvasId}" not found in registry`);
      if (!globalPixelOffsets) accumulatedOffset += canvasWidths[chunkIdx];
      continue;
    }

    const canvasWidth = canvasWidths[chunkIdx];
    const globalPixelOffset = globalPixelOffsets ? globalPixelOffsets[chunkIdx] : accumulatedOffset;

    // Set physical canvas size for DPR
    offscreen.width = canvasWidth * devicePixelRatio;
    offscreen.height = canvasHeight * devicePixelRatio;

    const ctx = offscreen.getContext('2d');
    if (!ctx) {
      console.warn(`[spectrogram-worker] getContext('2d') returned null for canvas "${canvasId}"`);
      if (!globalPixelOffsets) accumulatedOffset += canvasWidth;
      continue;
    }

    ctx.resetTransform();
    ctx.clearRect(0, 0, offscreen.width, offscreen.height);
    ctx.imageSmoothingEnabled = false;

    // Create ImageData at CSS pixel size
    const imgData = ctx.createImageData(canvasWidth, canvasHeight);
    const pixels = imgData.data;

    for (let x = 0; x < canvasWidth; x++) {
      const globalX = globalPixelOffset + x;
      const samplePos = globalX * samplesPerPixel - sampleOffset;
      const frame = Math.floor(samplePos / hopSize);

      if (frame < 0 || frame >= frameCount) continue;

      const frameOffset = frame * frequencyBinCount;

      for (let y = 0; y < canvasHeight; y++) {
        const normalizedY = 1 - y / canvasHeight;

        let bin = Math.floor(normalizedY * frequencyBinCount);

        if (isNonLinear) {
          let lo = 0;
          let hi = frequencyBinCount - 1;
          while (lo < hi) {
            const mid = (lo + hi) >> 1;
            const freq = binToFreq(mid);
            const scaled = scaleFn(freq, minFrequency, maxF);
            if (scaled < normalizedY) {
              lo = mid + 1;
            } else {
              hi = mid;
            }
          }
          bin = lo;
        }

        if (bin < 0 || bin >= frequencyBinCount) continue;

        const db = specData.data[frameOffset + bin];
        const normalized = Math.max(0, Math.min(1, (db + rangeDb + gainDb) / rangeDb));

        const colorIdx = Math.floor(normalized * 255);
        const pixelIdx = (y * canvasWidth + x) * 4;
        pixels[pixelIdx] = colorLUT[colorIdx * 3];
        pixels[pixelIdx + 1] = colorLUT[colorIdx * 3 + 1];
        pixels[pixelIdx + 2] = colorLUT[colorIdx * 3 + 2];
        pixels[pixelIdx + 3] = 255;
      }
    }

    // Put image data and scale up for DPR
    if (devicePixelRatio === 1) {
      ctx.putImageData(imgData, 0, 0);
    } else {
      // Render at CSS size to a temporary OffscreenCanvas, then scale up
      const tmpCanvas = new OffscreenCanvas(canvasWidth, canvasHeight);
      const tmpCtx = tmpCanvas.getContext('2d');
      if (!tmpCtx) {
        console.warn(
          `[spectrogram-worker] getContext('2d') failed for DPR scaling of "${canvasIds[chunkIdx]}"`
        );
        continue;
      }
      tmpCtx.putImageData(imgData, 0, 0);

      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(tmpCanvas, 0, 0, offscreen.width, offscreen.height);
    }

    if (!globalPixelOffsets) accumulatedOffset += canvasWidth;
  }
}

// --- Async compute-fft handler ---

async function handleComputeFFT(msg: ComputeFFTRequest): Promise<void> {
  const {
    id,
    generation,
    clipId,
    config,
    sampleRate: msgSampleRate,
    offsetSamples,
    durationSamples,
    mono,
    sampleRange,
    channelFilter,
  } = msg;

  // Use pre-registered audio data if available, otherwise use message payload
  const registered = audioDataRegistry.get(clipId);
  const channelDataArrays =
    registered && msg.channelDataArrays.length === 0
      ? registered.channelDataArrays
      : msg.channelDataArrays;
  const sampleRate =
    registered && msg.channelDataArrays.length === 0 ? registered.sampleRate : msgSampleRate;

  const fftSize = config.fftSize ?? 2048;
  const zeroPaddingFactor = config.zeroPaddingFactor ?? 2;
  const hopSize = config.hopSize ?? Math.floor(fftSize / 4);
  const windowFunction = config.windowFunction ?? 'hann';

  // Use sampleRange if provided (visible-range-first optimization)
  const effectiveOffset = sampleRange ? sampleRange.start : offsetSamples;
  const effectiveDuration = sampleRange ? sampleRange.end - sampleRange.start : durationSamples;

  const cacheKey = generateCacheKey({
    clipId,
    channelIndex: 0,
    offsetSamples: effectiveOffset,
    durationSamples: effectiveDuration,
    sampleRate,
    compute: { fftSize, zeroPaddingFactor, hopSize, windowFunction, alpha: config.alpha },
    mono,
  });

  if (!fftCache.has(cacheKey)) {
    // Evict oldest cache entries if at capacity
    evictLRUCacheEntries(cacheKey);

    const spectrograms: SpectrogramData[] = [];
    if (mono || channelDataArrays.length === 1) {
      const result = await computeMonoFromChannels(
        channelDataArrays,
        config,
        sampleRate,
        effectiveOffset,
        effectiveDuration,
        generation
      );
      if (result === null) {
        const response: ComputeResponse = { id, type: 'aborted' };
        (self as unknown as Worker).postMessage(response);
        return;
      }
      spectrograms.push(result);
    } else if (channelFilter !== undefined) {
      // Pool mode: compute only the requested channel
      const channelData = channelDataArrays[channelFilter];
      if (!channelData) {
        const response: ComputeResponse = {
          id,
          type: 'error',
          error: `channelFilter ${channelFilter} out of range (${channelDataArrays.length} channels)`,
        };
        (self as unknown as Worker).postMessage(response);
        return;
      }
      const result = await computeFromChannelData(
        channelData,
        config,
        sampleRate,
        effectiveOffset,
        effectiveDuration,
        generation
      );
      if (result === null) {
        const response: ComputeResponse = { id, type: 'aborted' };
        (self as unknown as Worker).postMessage(response);
        return;
      }
      spectrograms.push(result);
    } else {
      for (const channelData of channelDataArrays) {
        const result = await computeFromChannelData(
          channelData,
          config,
          sampleRate,
          effectiveOffset,
          effectiveDuration,
          generation
        );
        if (result === null) {
          const response: ComputeResponse = { id, type: 'aborted' };
          (self as unknown as Worker).postMessage(response);
          return;
        }
        spectrograms.push(result);
      }
    }
    fftCache.set(cacheKey, { spectrograms, sampleOffset: effectiveOffset });
  } else {
    // Bump to most-recently-used so scroll-back patterns keep hot entries alive
    touchCacheEntry(cacheKey);
  }

  const response: ComputeResponse = { id, type: 'cache-key', cacheKey };
  (self as unknown as Worker).postMessage(response);
}

// --- Message handler ---

self.onmessage = (e: MessageEvent<WorkerMessage>) => {
  const msg = e.data;

  // Register canvas
  if (msg.type === 'register-canvas') {
    try {
      canvasRegistry.set(msg.canvasId, msg.canvas);
    } catch (err) {
      console.warn('[spectrogram-worker] register-canvas failed:', err);
    }
    return;
  }

  // Unregister canvas
  if (msg.type === 'unregister-canvas') {
    try {
      canvasRegistry.delete(msg.canvasId);
    } catch (err) {
      console.warn('[spectrogram-worker] unregister-canvas failed:', err);
    }
    return;
  }

  // Register audio data for a clip (pre-transfer)
  if (msg.type === 'register-audio-data') {
    try {
      audioDataRegistry.set(msg.clipId, {
        channelDataArrays: msg.channelDataArrays,
        sampleRate: msg.sampleRate,
      });
    } catch (err) {
      console.warn('[spectrogram-worker] register-audio-data failed:', err);
    }
    return;
  }

  // Unregister audio data for a clip + evict related FFT cache entries
  if (msg.type === 'unregister-audio-data') {
    try {
      audioDataRegistry.delete(msg.clipId);
      const prefix = `${msg.clipId}:`;
      for (const key of fftCache.keys()) {
        if (key.startsWith(prefix)) {
          fftCache.delete(key);
        }
      }
    } catch (err) {
      console.warn('[spectrogram-worker] unregister-audio-data failed:', err);
    }
    return;
  }

  // Abort stale generation — updates latestGeneration so in-flight async
  // FFT computations will detect staleness and bail out at their next yield point.
  if (msg.type === 'abort-generation') {
    latestGeneration = Math.max(latestGeneration, msg.generation);
    return;
  }

  // Compute FFT only (with caching), return cache key
  if (msg.type === 'compute-fft') {
    const { id, generation } = msg;

    // Check staleness immediately before starting any work
    if (isGenerationStale(generation)) {
      const response: ComputeResponse = { id, type: 'aborted' };
      (self as unknown as Worker).postMessage(response);
      return;
    }

    handleComputeFFT(msg).catch((err) => {
      const errorMsg = err instanceof Error ? `${err.message}\n${err.stack}` : String(err);
      const response: ComputeResponse = { id, type: 'error', error: errorMsg };
      (self as unknown as Worker).postMessage(response);
    });
    return;
  }

  // Render specific chunks from cached FFT data
  if (msg.type === 'render-chunks') {
    const { id, generation } = msg;

    // Skip rendering if this request belongs to a stale generation
    if (isGenerationStale(generation)) {
      const response: ComputeResponse = { id, type: 'aborted' };
      (self as unknown as Worker).postMessage(response);
      return;
    }

    try {
      const {
        cacheKey,
        canvasIds,
        canvasWidths,
        globalPixelOffsets,
        canvasHeight,
        devicePixelRatio,
        samplesPerPixel,
        colorLUT,
        frequencyScale,
        minFrequency,
        maxFrequency,
        gainDb,
        rangeDb,
        channelIndex,
      } = msg;

      const cacheEntry = fftCache.get(cacheKey);
      if (!cacheEntry) {
        const response: ComputeResponse = {
          id,
          type: 'error',
          error: `cache-miss: key "${cacheKey}" not found (cache has ${fftCache.size} entries)`,
        };
        (self as unknown as Worker).postMessage(response);
        return;
      }
      if (channelIndex >= cacheEntry.spectrograms.length) {
        const response: ComputeResponse = {
          id,
          type: 'error',
          error: `cache-miss: channelIndex ${channelIndex} out of range (${cacheEntry.spectrograms.length} channels cached)`,
        };
        (self as unknown as Worker).postMessage(response);
        return;
      }

      const scaleFn = getFrequencyScale((frequencyScale ?? 'mel') as FrequencyScaleName);
      const isNonLinear = frequencyScale !== 'linear';

      renderSpectrogramToCanvas(
        cacheEntry.spectrograms[channelIndex],
        canvasIds,
        canvasWidths,
        canvasHeight,
        devicePixelRatio,
        samplesPerPixel,
        colorLUT,
        scaleFn,
        minFrequency,
        maxFrequency,
        isNonLinear,
        globalPixelOffsets,
        gainDb,
        rangeDb,
        cacheEntry.sampleOffset
      );

      const response: ComputeResponse = { id, type: 'done' };
      (self as unknown as Worker).postMessage(response);
    } catch (err) {
      const response: ComputeResponse = { id, type: 'error', error: String(err) };
      (self as unknown as Worker).postMessage(response);
    }
    return;
  }

  // Unknown message type
  console.warn(`[spectrogram-worker] Unknown message type: ${(msg as { type?: string }).type}`);
};
