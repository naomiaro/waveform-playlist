/**
 * Waveform Data Loader
 *
 * Utilities for loading pre-computed waveform data in waveform-data.js format.
 * Supports both binary (.dat) and JSON formats from BBC's audiowaveform tool.
 */

import WaveformData from 'waveform-data';

/**
 * Load waveform data from a .dat or .json file
 *
 * @param src - URL to waveform data file (.dat or .json)
 * @returns WaveformData instance
 */
export async function loadWaveformData(src: string): Promise<WaveformData> {
  const response = await fetch(src);

  if (!response.ok) {
    throw new Error(`Failed to fetch waveform data: ${response.statusText}`);
  }

  // Check file extension to determine format
  const isBinary = src.endsWith('.dat');

  if (isBinary) {
    const arrayBuffer = await response.arrayBuffer();
    return WaveformData.create(arrayBuffer);
  } else {
    const json = await response.json();
    return WaveformData.create(json);
  }
}

/**
 * Convert WaveformData to our internal Peaks format
 *
 * @param waveformData - WaveformData instance from waveform-data.js
 * @param channelIndex - Channel index (0 for mono/left, 1 for right)
 * @returns Peaks data with alternating min/max values, preserving original bit depth
 */
export function waveformDataToPeaks(
  waveformData: WaveformData,
  channelIndex: number = 0
): { data: Int8Array | Int16Array; bits: 8 | 16; length: number; sampleRate: number } {
  const channel = waveformData.channel(channelIndex);
  const bits = waveformData.bits as 8 | 16;

  // Get the min/max arrays to determine length
  const minArray = channel.min_array();
  const maxArray = channel.max_array();
  const length = minArray.length;

  // Use appropriate typed array based on source file bit depth
  // 8-bit: values range from -128 to 127
  // 16-bit: values range from -32768 to 32767
  const peaks = bits === 8
    ? new Int8Array(length * 2)
    : new Int16Array(length * 2);

  // Interleave min/max pairs
  for (let i = 0; i < length; i++) {
    peaks[i * 2] = minArray[i];
    peaks[i * 2 + 1] = maxArray[i];
  }

  return {
    data: peaks,
    bits,
    length,
    sampleRate: waveformData.sample_rate,
  };
}

/**
 * Load waveform data file and convert to Peaks format in one step
 *
 * @param src - URL to waveform data file (.dat or .json)
 * @param channelIndex - Channel index (default: 0)
 * @returns Peaks data ready for rendering
 */
export async function loadPeaksFromWaveformData(
  src: string,
  channelIndex: number = 0
): Promise<{ data: Int8Array | Int16Array; bits: 8 | 16; length: number; sampleRate: number }> {
  const waveformData = await loadWaveformData(src);
  return waveformDataToPeaks(waveformData, channelIndex);
}

/**
 * Get metadata from waveform data file without converting to peaks
 *
 * @param src - URL to waveform data file
 * @returns Metadata (sample rate, channels, duration, bits, etc.)
 */
export async function getWaveformDataMetadata(src: string): Promise<{
  sampleRate: number;
  channels: number;
  duration: number;
  samplesPerPixel: number;
  length: number;
  bits: 8 | 16;
}> {
  const waveformData = await loadWaveformData(src);

  return {
    sampleRate: waveformData.sample_rate,
    channels: waveformData.channels,
    duration: waveformData.duration,
    samplesPerPixel: waveformData.scale,
    length: waveformData.length,
    bits: waveformData.bits as 8 | 16,
  };
}
