/**
 * Peak generation for real-time waveform visualization during recording
 */

/**
 * Generate peaks from audio samples
 *
 * @param samples - Audio samples to process
 * @param samplesPerPixel - Number of samples to represent in each peak
 * @returns Array of peak values (absolute max values)
 */
export function generatePeaks(
  samples: Float32Array,
  samplesPerPixel: number
): number[] {
  const peaks: number[] = [];
  const numPeaks = Math.ceil(samples.length / samplesPerPixel);

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, samples.length);

    let max = 0;
    for (let j = start; j < end; j++) {
      const absValue = Math.abs(samples[j]);
      if (absValue > max) {
        max = absValue;
      }
    }

    peaks.push(max);
  }

  return peaks;
}

/**
 * Append new peaks to existing peaks array
 * This is used for incremental peak updates during recording
 */
export function appendPeaks(
  existingPeaks: number[],
  newSamples: Float32Array,
  samplesPerPixel: number,
  totalSamplesProcessed: number
): number[] {
  const peaks = [...existingPeaks];

  // Check if we have a partial peak from the last update
  const remainder = totalSamplesProcessed % samplesPerPixel;
  let offset = 0;

  // If there's a partial peak, we need to update the last peak
  if (remainder > 0 && peaks.length > 0) {
    const samplesToComplete = samplesPerPixel - remainder;
    const endIndex = Math.min(samplesToComplete, newSamples.length);

    // Update the last peak with new samples
    let max = peaks[peaks.length - 1];
    for (let i = 0; i < endIndex; i++) {
      const absValue = Math.abs(newSamples[i]);
      if (absValue > max) {
        max = absValue;
      }
    }
    peaks[peaks.length - 1] = max;
    offset = endIndex;
  }

  // Generate peaks for remaining samples
  const newPeaks = generatePeaks(
    newSamples.slice(offset),
    samplesPerPixel
  );

  return peaks.concat(newPeaks);
}
