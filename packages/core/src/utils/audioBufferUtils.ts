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
 * Convert channel data to AudioBuffer.
 * Accepts either per-channel Float32Array[] or a single Float32Array (mono, backwards compatible).
 */
export function createAudioBuffer(
  audioContext: AudioContext,
  channelData: Float32Array[] | Float32Array,
  sampleRate: number,
  channelCount: number = 1
): AudioBuffer {
  // Backwards compatibility: single Float32Array → wrap as mono
  const channels: Float32Array[] =
    channelData instanceof Float32Array ? [channelData] : channelData;

  const length = channels[0]?.length ?? 0;
  const buffer = audioContext.createBuffer(channelCount, length, sampleRate);

  for (let ch = 0; ch < Math.min(channelCount, channels.length); ch++) {
    buffer.copyToChannel(new Float32Array(channels[ch]), ch);
  }

  return buffer;
}

/**
 * Append new samples to an existing AudioBuffer (mono convenience)
 */
export function appendToAudioBuffer(
  audioContext: AudioContext,
  existingBuffer: AudioBuffer | null,
  newSamples: Float32Array,
  sampleRate: number
): AudioBuffer {
  if (!existingBuffer) {
    return createAudioBuffer(audioContext, [newSamples], sampleRate);
  }

  // Get existing samples
  const existingData = existingBuffer.getChannelData(0);

  // Concatenate using concatenateAudioData helper
  const combined = concatenateAudioData([existingData, newSamples]);

  // Create new buffer
  return createAudioBuffer(audioContext, [combined], sampleRate);
}

/**
 * Calculate duration in seconds from sample count and sample rate
 */
export function calculateDuration(sampleCount: number, sampleRate: number): number {
  return sampleCount / sampleRate;
}
