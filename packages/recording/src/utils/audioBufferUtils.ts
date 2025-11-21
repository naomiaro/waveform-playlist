/**
 * Utility functions for working with AudioBuffers during recording
 */

/**
 * Concatenate multiple Float32Arrays into a single array
 */
export function concatenateAudioData(chunks: Float32Array[]): Float32Array {
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Float32Array(totalLength);

  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return result;
}

/**
 * Convert Float32Array to AudioBuffer
 */
export function createAudioBuffer(
  audioContext: AudioContext,
  samples: Float32Array,
  sampleRate: number,
  channelCount: number = 1
): AudioBuffer {
  const buffer = audioContext.createBuffer(
    channelCount,
    samples.length,
    sampleRate
  );

  // Copy samples to buffer (for now, just mono)
  // Create a new Float32Array to ensure correct type
  const typedSamples = new Float32Array(samples);
  buffer.copyToChannel(typedSamples, 0);

  return buffer;
}

/**
 * Append new samples to an existing AudioBuffer
 */
export function appendToAudioBuffer(
  audioContext: AudioContext,
  existingBuffer: AudioBuffer | null,
  newSamples: Float32Array,
  sampleRate: number
): AudioBuffer {
  if (!existingBuffer) {
    return createAudioBuffer(audioContext, newSamples, sampleRate);
  }

  // Get existing samples
  const existingData = existingBuffer.getChannelData(0);

  // Concatenate using concatenateAudioData helper
  const combined = concatenateAudioData([existingData, newSamples]);

  // Create new buffer
  return createAudioBuffer(audioContext, combined, sampleRate);
}

/**
 * Calculate duration in seconds from sample count and sample rate
 */
export function calculateDuration(sampleCount: number, sampleRate: number): number {
  return sampleCount / sampleRate;
}
