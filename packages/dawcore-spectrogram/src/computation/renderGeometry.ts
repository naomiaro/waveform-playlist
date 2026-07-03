/**
 * Pure geometry for mapping rendered pixel columns to FFT frames.
 */

export interface PixelColumnToFrameParams {
  /** Clip-relative pixel column (chunk pixel offset + x within the canvas). */
  pixelX: number;
  samplesPerPixel: number;
  /** The clip's start position within its audio file (AudioClip.offsetSamples). */
  clipOffsetSamples: number;
  /** File-absolute sample position where the cached FFT data begins. */
  fftStartSample: number;
  hopSize: number;
}

/**
 * The file sample displayed at clip-relative pixel x is
 * `clipOffsetSamples + x * samplesPerPixel`; the FFT frame holding it starts
 * at `fftStartSample + frame * hopSize`. Omitting `clipOffsetSamples` (the
 * pre-#554 behavior) shifts every trimmed clip's display by its offset.
 */
export function pixelColumnToFrame(params: PixelColumnToFrameParams): number {
  const fileSample = params.clipOffsetSamples + params.pixelX * params.samplesPerPixel;
  return Math.floor((fileSample - params.fftStartSample) / params.hopSize);
}

export interface PixelRowToBinParams {
  /** Vertical position, bottom-up: `1 - y / canvasHeight` ∈ (0, 1]. */
  normalizedY: number;
  frequencyBinCount: number;
  sampleRate: number;
  minFrequency: number;
  /** Resolved maximum frequency (> 0); callers default 0 → sampleRate / 2. */
  maxFrequency: number;
  /** Frequency scale mapping (Hz, minF, maxF) → [0, 1]. */
  scaleFn: (f: number, minF: number, maxF: number) => number;
  /** Linear scale uses a direct O(1) mapping instead of the binary search. */
  isLinear: boolean;
}

/**
 * Map a canvas row to the FFT bin displayed there.
 *
 * Linear: direct inversion of the scale — `freq = minF + normalizedY·(maxF −
 * minF)` — so the configured frequency range is honored exactly like the
 * non-linear scales (pre-#557 the linear fast path always spanned 0..Nyquist).
 * Non-linear: binary search for the first bin whose scaled frequency reaches
 * `normalizedY`. Both paths clamp to the last bin so the top row
 * (normalizedY === 1) never falls out of range.
 */
export function pixelRowToBin(params: PixelRowToBinParams): number {
  const { normalizedY, frequencyBinCount, sampleRate, minFrequency, maxFrequency } = params;
  const nyquist = sampleRate / 2;

  let bin: number;
  if (params.isLinear) {
    const freq = minFrequency + normalizedY * (maxFrequency - minFrequency);
    bin = Math.floor((freq / nyquist) * frequencyBinCount);
  } else {
    let lo = 0;
    let hi = frequencyBinCount - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      const freq = (mid / frequencyBinCount) * nyquist;
      if (params.scaleFn(freq, minFrequency, maxFrequency) < normalizedY) {
        lo = mid + 1;
      } else {
        hi = mid;
      }
    }
    bin = lo;
  }

  return Math.min(bin, frequencyBinCount - 1);
}
