/**
 * Waveform Data Loader
 *
 * Utilities for loading pre-computed waveform data in waveform-data.js format.
 * Supports both binary (.dat) and JSON formats from BBC's audiowaveform tool.
 */

import WaveformData from 'waveform-data';
import type { Peaks } from '@waveform-playlist/webaudio-peaks';

export interface WaveformDataFile {
  src: string;           // URL to .dat or .json file
  sampleRate?: number;   // Override sample rate if needed
}

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
 * Convert WaveformData to our internal Peaks format (Int16Array with min/max pairs)
 *
 * @param waveformData - WaveformData instance from waveform-data.js
 * @param channelIndex - Channel index (0 for mono/left, 1 for right)
 * @returns Peaks data as Int16Array with alternating min/max values
 */
export function waveformDataToPeaks(
  waveformData: WaveformData,
  channelIndex: number = 0
): { data: Int16Array; bits: 16; length: number; sampleRate: number } {
  const channel = waveformData.channel(channelIndex);

  // Get the min/max arrays to determine length
  const minArray = channel.min_array();
  const maxArray = channel.max_array();
  const length = minArray.length;

  // WaveformData stores 8-bit values (-128 to 127)
  // We'll convert to 16-bit (-32768 to 32767) for better precision
  const peaks = new Int16Array(length * 2);

  // Convert min/max pairs to Int16Array
  for (let i = 0; i < length; i++) {
    // Scale from 8-bit (-128 to 127) to 16-bit (-32768 to 32767)
    peaks[i * 2] = minArray[i] * 256;      // min value
    peaks[i * 2 + 1] = maxArray[i] * 256;  // max value
  }

  return {
    data: peaks,
    bits: 16,
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
): Promise<{ data: Int16Array; bits: 16; length: number; sampleRate: number }> {
  const waveformData = await loadWaveformData(src);
  return waveformDataToPeaks(waveformData, channelIndex);
}

/**
 * Get metadata from waveform data file without converting to peaks
 *
 * @param src - URL to waveform data file
 * @returns Metadata (sample rate, channels, duration, etc.)
 */
export async function getWaveformDataMetadata(src: string): Promise<{
  sampleRate: number;
  channels: number;
  duration: number;
  samplesPerPixel: number;
  length: number;
}> {
  const waveformData = await loadWaveformData(src);

  return {
    sampleRate: waveformData.sample_rate,
    channels: waveformData.channels,
    duration: waveformData.duration,
    samplesPerPixel: waveformData.scale,
    length: waveformData.length,
  };
}
