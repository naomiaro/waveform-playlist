import extractPeaks, { type PeakData } from '@waveform-playlist/webaudio-peaks';

/**
 * Generate peaks from an AudioBuffer for waveform visualization
 * This is a thin wrapper around the webaudio-peaks package
 *
 * @param audioBuffer - The audio buffer to extract peaks from
 * @param samplesPerPixel - Number of samples per pixel
 * @param isMono - Whether to merge channels to mono
 * @param bits - Bit depth for peak data (8 or 16)
 * @param offset - Time offset in seconds (for trimming)
 * @param duration - Duration in seconds (for trimming)
 */
export function generatePeaks(
  audioBuffer: AudioBuffer,
  samplesPerPixel: number = 1000,
  isMono: boolean = true,
  bits: 8 | 16 = 8,
  offset: number = 0,
  duration?: number
): PeakData {
  // Convert time-based offset and duration to sample indices
  const sampleRate = audioBuffer.sampleRate;
  const cueIn = Math.floor(offset * sampleRate);
  const cueOut = duration !== undefined
    ? Math.floor((offset + duration) * sampleRate)
    : undefined;

  return extractPeaks(audioBuffer, samplesPerPixel, isMono, cueIn, cueOut, bits);
}
