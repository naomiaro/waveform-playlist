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
