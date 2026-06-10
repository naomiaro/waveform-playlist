import {
  MAX_CANVAS_WIDTH,
  type SpectrogramConfig,
  type SpectrogramComputeConfig,
  type ColorMapValue,
  type RenderMode,
  type TrackSpectrogramOverrides,
} from '@waveform-playlist/core';

/**
 * Pure, side-effect-free helpers extracted from `SpectrogramProvider`.
 *
 * These cover the geometry/key logic that the provider's worker-orchestration
 * effect depends on (chunk classification, FFT sample ranges, contiguous
 * grouping, config-change detection). Keeping them DOM-free makes them unit
 * testable in a Node environment — the provider supplies the imperative shell
 * (refs, worker calls, React state) around this functional core.
 */

/** A channel's registered canvas chunks: parallel arrays of IDs and pixel widths. */
export interface ChannelChunkInfo {
  canvasIds: string[];
  canvasWidths: number[];
}

/** Chunk indices grouped by their relationship to the current scroll viewport. */
export interface ChunkTiers {
  /** Chunks intersecting the exact viewport — fast first paint. */
  viewportIndices: number[];
  /** Chunks within the 1.5× overscan buffer but outside the viewport. */
  bufferIndices: number[];
  /** Chunks outside the buffer — rendered in background batches. */
  remainingIndices: number[];
}

/** Scroll-container metrics needed to classify chunks. `null` ⇒ no container yet. */
export interface ViewportMetrics {
  scrollLeft: number;
  viewportWidth: number;
}

/** Extract the chunk number from a canvas ID like `"clipId-ch0-chunk5"` → `5`. */
export function extractChunkNumber(canvasId: string): number {
  const match = canvasId.match(/chunk(\d+)$/);
  if (!match) {
    console.warn(`[spectrogram] Unexpected canvas ID format: ${canvasId}`);
    return 0;
  }
  return parseInt(match[1], 10);
}

/**
 * Parse a canvas ID of the form `${clipId}-ch${channelIndex}-chunk${n}` into its
 * clip ID and channel index. Returns `null` when the ID doesn't match.
 */
export function parseCanvasId(canvasId: string): { clipId: string; channelIndex: number } | null {
  const match = canvasId.match(/^(.+)-ch(\d+)-chunk\d+$/);
  if (!match) return null;
  return { clipId: match[1], channelIndex: parseInt(match[2], 10) };
}

/**
 * Split indices into contiguous groups based on their chunk numbers, e.g.
 * indices mapping to chunks `[0,1,4,5]` → `[[0,1],[4,5]]`. Prevents computing an
 * FFT range that spans the gap between non-adjacent chunks.
 */
export function groupContiguousIndices(
  channelInfo: { canvasIds: string[] },
  indices: number[]
): number[][] {
  if (indices.length === 0) return [];
  const groups: number[][] = [];
  let currentGroup = [indices[0]];
  let prevChunk = extractChunkNumber(channelInfo.canvasIds[indices[0]]);
  for (let i = 1; i < indices.length; i++) {
    const chunk = extractChunkNumber(channelInfo.canvasIds[indices[i]]);
    if (chunk === prevChunk + 1) {
      currentGroup.push(indices[i]);
    } else {
      groups.push(currentGroup);
      currentGroup = [indices[i]];
    }
    prevChunk = chunk;
  }
  groups.push(currentGroup);
  return groups;
}

/**
 * Classify a channel's chunks into viewport / buffer / remaining tiers.
 *
 * The buffer uses a 1.5× viewport-width overscan to match
 * `useVisibleChunkIndices` in ScrollViewport, so FFT covers every mounted
 * canvas. When `viewport` is `null` (no scroll container yet), every chunk is
 * treated as in-viewport.
 */
export function classifyChunkTiers(
  channelInfo: ChannelChunkInfo,
  clipPixelOffset = 0,
  viewport: ViewportMetrics | null
): ChunkTiers {
  if (!viewport) {
    return {
      viewportIndices: channelInfo.canvasWidths.map((_, i) => i),
      bufferIndices: [],
      remainingIndices: [],
    };
  }

  const { scrollLeft, viewportWidth } = viewport;
  const buffer = viewportWidth * 1.5;
  const bufferStart = Math.max(0, scrollLeft - buffer);
  const bufferEnd = scrollLeft + viewportWidth + buffer;

  const viewportIndices: number[] = [];
  const bufferIndices: number[] = [];
  const remainingIndices: number[] = [];

  for (let i = 0; i < channelInfo.canvasWidths.length; i++) {
    const chunkNumber = extractChunkNumber(channelInfo.canvasIds[i]);
    const chunkLeft = chunkNumber * MAX_CANVAS_WIDTH + clipPixelOffset;
    const chunkRight = chunkLeft + channelInfo.canvasWidths[i];
    if (chunkRight > scrollLeft && chunkLeft < scrollLeft + viewportWidth) {
      viewportIndices.push(i);
    } else if (chunkRight > bufferStart && chunkLeft < bufferEnd) {
      bufferIndices.push(i);
    } else {
      remainingIndices.push(i);
    }
  }

  return { viewportIndices, bufferIndices, remainingIndices };
}

export interface ChunkSampleRangeParams {
  channelInfo: { canvasIds: string[]; canvasWidths: number[] };
  indices: number[];
  /** FFT window size (samples) used to pad the range against edge artifacts. */
  fftSize: number;
  offsetSamples: number;
  durationSamples: number;
  samplesPerPixel: number;
}

/**
 * Compute the (window-padded, clip-clamped) sample range covered by a set of
 * chunk indices. Computing per-batch ranges on demand avoids allocating one
 * giant FFT array for a full clip (which OOMs on 1hr+ files).
 */
export function computeChunkSampleRange({
  channelInfo,
  indices,
  fftSize,
  offsetSamples,
  durationSamples,
  samplesPerPixel,
}: ChunkSampleRangeParams): { paddedStart: number; paddedEnd: number } {
  const chunkNumbers = indices.map((i) => extractChunkNumber(channelInfo.canvasIds[i]));
  const minChunk = Math.min(...chunkNumbers);
  const maxChunk = Math.max(...chunkNumbers);
  const maxChunkIdx = indices[chunkNumbers.indexOf(maxChunk)];
  const lastChunkWidth = channelInfo.canvasWidths[maxChunkIdx];

  const startPx = minChunk * MAX_CANVAS_WIDTH;
  const endPx = maxChunk * MAX_CANVAS_WIDTH + lastChunkWidth;

  const rangeStartSample = offsetSamples + Math.floor(startPx * samplesPerPixel);
  const rangeEndSample = Math.min(
    offsetSamples + durationSamples,
    offsetSamples + Math.ceil(endPx * samplesPerPixel)
  );

  // Pad by one window on each side to avoid edge artifacts, clamped to the clip.
  const paddedStart = Math.max(offsetSamples, rangeStartSample - fftSize);
  const paddedEnd = Math.min(offsetSamples + durationSamples, rangeEndSample + fftSize);

  return { paddedStart, paddedEnd };
}

/** Resolve a track's effective render mode: override → track → `'waveform'`. */
export function resolveRenderMode(
  override: TrackSpectrogramOverrides | undefined,
  trackRenderMode: RenderMode | undefined
): RenderMode {
  return override?.renderMode ?? trackRenderMode ?? 'waveform';
}

/** Project a `SpectrogramConfig` down to the fields that affect FFT computation. */
export function toComputeConfig(cfg: SpectrogramConfig | undefined): SpectrogramComputeConfig {
  return {
    fftSize: cfg?.fftSize,
    hopSize: cfg?.hopSize,
    windowFunction: cfg?.windowFunction,
    alpha: cfg?.alpha,
    zeroPaddingFactor: cfg?.zeroPaddingFactor,
  };
}

/**
 * Stable string key for a track's full spectrogram appearance (mode + config +
 * color map + mono). A change means the rendered output must be recomputed.
 */
export function buildConfigKey(params: {
  mode: RenderMode;
  cfg: SpectrogramConfig | undefined;
  cm: ColorMapValue | undefined;
  mono: boolean;
}): string {
  const { mode, cfg, cm, mono } = params;
  return JSON.stringify({ mode, cfg, cm, mono });
}

/**
 * Stable string key for the inputs that affect the FFT only (mode + mono +
 * compute config). A change here means the cached FFT data is stale; a config
 * change that leaves this key untouched (e.g. color map) only needs re-display.
 */
export function buildFFTKey(params: {
  mode: RenderMode;
  mono: boolean;
  computeConfig: SpectrogramComputeConfig;
}): string {
  const { mode, mono, computeConfig } = params;
  return JSON.stringify({ mode, mono, ...computeConfig });
}

/**
 * Whether two key maps differ — different size, or any key present in `current`
 * whose value doesn't match `prev`. Used to detect config/FFT changes between
 * effect runs.
 */
export function mapsDiffer(prev: Map<string, string>, current: Map<string, string>): boolean {
  if (current.size !== prev.size) return true;
  for (const [key, value] of current) {
    if (prev.get(key) !== value) return true;
  }
  return false;
}
