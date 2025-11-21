/**
 * Peak generation for real-time waveform visualization during recording
 * Matches the format used by webaudio-peaks: min/max pairs with bit depth
 */

/**
 * Generate peaks from audio samples in standard min/max pair format
 *
 * @param samples - Audio samples to process
 * @param samplesPerPixel - Number of samples to represent in each peak
 * @param bits - Bit depth for peak values (8 or 16)
 * @returns Int8Array or Int16Array of peak values (min/max pairs)
 */
export function generatePeaks(
  samples: Float32Array,
  samplesPerPixel: number,
  bits: 8 | 16 = 16
): Int8Array | Int16Array {
  const numPeaks = Math.ceil(samples.length / samplesPerPixel);
  const peakArray = bits === 8 ? new Int8Array(numPeaks * 2) : new Int16Array(numPeaks * 2);
  const maxValue = 2 ** (bits - 1);

  for (let i = 0; i < numPeaks; i++) {
    const start = i * samplesPerPixel;
    const end = Math.min(start + samplesPerPixel, samples.length);

    let min = 0;
    let max = 0;

    for (let j = start; j < end; j++) {
      const value = samples[j];
      if (value < min) min = value;
      if (value > max) max = value;
    }

    // Store as min/max pairs scaled to bit depth
    peakArray[i * 2] = Math.floor(min * maxValue);
    peakArray[i * 2 + 1] = Math.floor(max * maxValue);
  }

  return peakArray;
}

/**
 * Append new peaks to existing peaks array
 * This is used for incremental peak updates during recording
 */
export function appendPeaks(
  existingPeaks: Int8Array | Int16Array,
  newSamples: Float32Array,
  samplesPerPixel: number,
  totalSamplesProcessed: number,
  bits: 8 | 16 = 16
): Int8Array | Int16Array {
  const maxValue = 2 ** (bits - 1);

  // Check if we have a partial peak from the last update
  const remainder = totalSamplesProcessed % samplesPerPixel;
  let offset = 0;

  // If there's a partial peak, we need to update the last peak
  if (remainder > 0 && existingPeaks.length > 0) {
    const samplesToComplete = samplesPerPixel - remainder;
    const endIndex = Math.min(samplesToComplete, newSamples.length);

    // Get current min/max from last peak
    let min = existingPeaks[existingPeaks.length - 2] / maxValue;
    let max = existingPeaks[existingPeaks.length - 1] / maxValue;

    // Update with new samples
    for (let i = 0; i < endIndex; i++) {
      const value = newSamples[i];
      if (value < min) min = value;
      if (value > max) max = value;
    }

    // Update last peak
    const updated = new (bits === 8 ? Int8Array : Int16Array)(existingPeaks.length);
    updated.set(existingPeaks);
    updated[existingPeaks.length - 2] = Math.floor(min * maxValue);
    updated[existingPeaks.length - 1] = Math.floor(max * maxValue);

    offset = endIndex;

    // Generate peaks for remaining samples and concatenate
    const newPeaks = generatePeaks(newSamples.slice(offset), samplesPerPixel, bits);
    const result = new (bits === 8 ? Int8Array : Int16Array)(updated.length + newPeaks.length);
    result.set(updated);
    result.set(newPeaks, updated.length);
    return result;
  }

  // No partial peak, just concatenate
  const newPeaks = generatePeaks(newSamples.slice(offset), samplesPerPixel, bits);
  const result = new (bits === 8 ? Int8Array : Int16Array)(existingPeaks.length + newPeaks.length);
  result.set(existingPeaks);
  result.set(newPeaks, existingPeaks.length);
  return result;
}
