import extractPeaks, { type PeakData } from '@waveform-playlist/webaudio-peaks';

/**
 * Generate peaks from an AudioBuffer for waveform visualization
 * This is a thin wrapper around the webaudio-peaks package
 */
export function generatePeaks(
  audioBuffer: AudioBuffer,
  samplesPerPixel: number = 1000,
  bits: 8 | 16 | 32 = 8
): PeakData {
  // Pass false for isMono to keep channels separate (show stereo)
  return extractPeaks(audioBuffer, samplesPerPixel, false, undefined, undefined, bits);
}
