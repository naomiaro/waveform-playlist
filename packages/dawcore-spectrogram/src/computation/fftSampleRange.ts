import { MAX_CANVAS_WIDTH } from '@waveform-playlist/core';

/**
 * Pure math for the window-padded, clip-clamped sample range covered by a set of
 * render chunks.
 *
 * Shared by `SpectrogramOrchestrator.renderGroupOnce` and the React
 * `computeChunkSampleRange` so both FFT pipelines compute the *same* range for the
 * same chunks — a padding/clamping change to one used to silently diverge the two
 * (the #554 drift class, with no cross-package test to catch it).
 *
 * Computing per-batch ranges on demand avoids allocating one giant FFT array for a
 * full clip (which OOMs on 1hr+ files). The range is padded by one FFT window on
 * each side to avoid edge artifacts, clamped to the clip's sample bounds.
 */
export interface PaddedFftRangeParams {
  /** Chunks in the render group: clip-relative chunk index + rendered pixel width. */
  chunks: Array<{ chunkIndex: number; widthPx: number }>;
  /** FFT window size (samples) used to pad the range against edge artifacts. */
  fftSize: number;
  /** The clip's start position within its audio file (AudioClip.offsetSamples). */
  offsetSamples: number;
  /** The clip's duration (samples). */
  durationSamples: number;
  samplesPerPixel: number;
}

export function computePaddedFftRange({
  chunks,
  fftSize,
  offsetSamples,
  durationSamples,
  samplesPerPixel,
}: PaddedFftRangeParams): { paddedStart: number; paddedEnd: number } {
  // Clip-relative pixels: chunk k starts at clip pixel k * MAX_CANVAS_WIDTH by the
  // chunked-canvas layout contract. `endPx` uses each chunk's own right edge so a
  // narrower last chunk (the only chunk that can be < MAX_CANVAS_WIDTH) is honored.
  const startPx = Math.min(...chunks.map((c) => c.chunkIndex * MAX_CANVAS_WIDTH));
  const endPx = Math.max(...chunks.map((c) => c.chunkIndex * MAX_CANVAS_WIDTH + c.widthPx));

  const startSample = offsetSamples + Math.floor(startPx * samplesPerPixel);
  const endSample = Math.min(
    offsetSamples + durationSamples,
    offsetSamples + Math.ceil(endPx * samplesPerPixel)
  );

  const paddedStart = Math.max(offsetSamples, startSample - fftSize);
  const paddedEnd = Math.min(offsetSamples + durationSamples, endSample + fftSize);

  return { paddedStart, paddedEnd };
}
