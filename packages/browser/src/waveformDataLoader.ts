/**
 * Waveform Data Loader
 *
 * Utilities for loading pre-computed waveform data in waveform-data.js format.
 * Supports both binary (.dat) and JSON formats from BBC's audiowaveform tool.
 */

import WaveformData from 'waveform-data';
import type { PeakData, Peaks } from '@waveform-playlist/core';

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

  // Detect binary format from pathname (ignores query string and fragment)
  const { pathname } = new URL(src, globalThis.location?.href ?? 'http://localhost');
  const isBinary = pathname.toLowerCase().endsWith('.dat');

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
  const peaks = bits === 8 ? new Int8Array(length * 2) : new Int16Array(length * 2);

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

/**
 * Slice and resample WaveformData with aligned source indices.
 *
 * Handles three cases:
 * 1. Scale differs + offset/duration given → aligned slice then resample
 * 2. Same scale + offset/duration given → direct slice
 * 3. No offset/duration → full-file resample (or identity)
 *
 * @returns Processed WaveformData ready for peak extraction
 */
function sliceAndResample(
  waveformData: WaveformData,
  samplesPerPixel: number,
  offsetSamples?: number,
  durationSamples?: number
): WaveformData | null {
  let processedData = waveformData;

  if (offsetSamples !== undefined && durationSamples !== undefined) {
    if (processedData.scale !== samplesPerPixel) {
      const sourceScale = waveformData.scale;
      const ratio = samplesPerPixel / sourceScale;

      // Compute clip's pixel range in target-scale bins
      const targetStart = Math.floor(offsetSamples / samplesPerPixel);
      const targetEnd = Math.ceil((offsetSamples + durationSamples) / samplesPerPixel);

      // Convert to source indices using floor/ceil for inclusive slicing.
      // For integer ratios (power-of-two scales), this gives exact alignment.
      // For non-integer ratios, floor/ceil ensures we always include all source
      // bins that contribute to the target bins — never underrepresenting peaks.
      const sourceStart = Math.floor(targetStart * ratio);
      const sourceEnd = Math.min(waveformData.length, Math.ceil(targetEnd * ratio));

      if (sourceStart >= sourceEnd) {
        return null; // Clip offset beyond waveform data
      }

      processedData = processedData.slice({
        startIndex: sourceStart,
        endIndex: sourceEnd,
      });
      processedData = processedData.resample({ scale: samplesPerPixel });
    } else {
      // No resampling needed — slice directly at base scale
      const startIndex = Math.floor(offsetSamples / samplesPerPixel);
      const endIndex = Math.ceil((offsetSamples + durationSamples) / samplesPerPixel);
      processedData = processedData.slice({ startIndex, endIndex });
    }
  } else if (processedData.scale !== samplesPerPixel) {
    processedData = processedData.resample({ scale: samplesPerPixel });
  }

  return processedData;
}

/**
 * Extract peaks from a WaveformData object at a specific scale (samplesPerPixel)
 * and optionally slice to a sample range.
 *
 * @param waveformData - WaveformData instance from waveform-data.js
 * @param samplesPerPixel - Target samples per pixel (will resample if different)
 * @param channelIndex - Channel index (default: 0)
 * @param offsetSamples - Optional start offset in samples (for clip trimming)
 * @param durationSamples - Optional duration in samples (for clip trimming)
 * @returns Peaks data ready for rendering
 */
export function extractPeaksFromWaveformData(
  waveformData: WaveformData,
  samplesPerPixel: number,
  channelIndex: number = 0,
  offsetSamples?: number,
  durationSamples?: number
): { data: Int8Array | Int16Array; bits: 8 | 16; length: number } {
  const processedData = sliceAndResample(
    waveformData,
    samplesPerPixel,
    offsetSamples,
    durationSamples
  );

  if (processedData === null) {
    const bits = waveformData.bits as 8 | 16;
    const emptyPeaks = bits === 8 ? new Int8Array(0) : new Int16Array(0);
    return { data: emptyPeaks, bits, length: 0 };
  }

  // Convert to our peaks format
  const channel = processedData.channel(channelIndex);
  const bits = processedData.bits as 8 | 16;
  const minArray = channel.min_array();
  const maxArray = channel.max_array();
  const length = minArray.length;

  const peaks = bits === 8 ? new Int8Array(length * 2) : new Int16Array(length * 2);

  for (let i = 0; i < length; i++) {
    peaks[i * 2] = minArray[i];
    peaks[i * 2 + 1] = maxArray[i];
  }

  return { data: peaks, bits, length };
}

/**
 * Extract peaks from a WaveformData object, handling ALL channels, mono merging,
 * slicing, and resampling.
 *
 * Bit depth is determined by the WaveformData source — all typed arrays match
 * the source's bit depth for consistent data/metadata.
 *
 * @param waveformData - WaveformData instance (should be generated with split_channels: true)
 * @param samplesPerPixel - Target samples per pixel
 * @param isMono - Whether to merge channels to mono
 * @param offsetSamples - Optional start offset in samples (for clip trimming)
 * @param durationSamples - Optional duration in samples (for clip trimming)
 * @returns PeakData matching the interface from @waveform-playlist/core
 */
export function extractPeaksFromWaveformDataFull(
  waveformData: WaveformData,
  samplesPerPixel: number,
  isMono: boolean,
  offsetSamples?: number,
  durationSamples?: number
): PeakData {
  const processedData = sliceAndResample(
    waveformData,
    samplesPerPixel,
    offsetSamples,
    durationSamples
  );

  if (processedData === null) {
    const bits = waveformData.bits as 8 | 16;
    return { length: 0, data: [], bits };
  }

  const numChannels = processedData.channels;
  const bits = processedData.bits as 8 | 16;

  // Extract peaks for all channels
  const channelPeaks: Peaks[] = [];
  for (let c = 0; c < numChannels; c++) {
    const channel = processedData.channel(c);
    const minArray = channel.min_array();
    const maxArray = channel.max_array();
    const len = minArray.length;

    const peaks: Peaks = bits === 8 ? new Int8Array(len * 2) : new Int16Array(len * 2);

    for (let i = 0; i < len; i++) {
      peaks[i * 2] = minArray[i];
      peaks[i * 2 + 1] = maxArray[i];
    }
    channelPeaks.push(peaks);
  }

  // Handle mono merging (same algorithm as makeMono in webaudio-peaks)
  if (isMono && channelPeaks.length > 1) {
    const weight = 1 / channelPeaks.length;
    const numPeaks = channelPeaks[0].length / 2;
    const monoPeaks: Peaks =
      bits === 8 ? new Int8Array(numPeaks * 2) : new Int16Array(numPeaks * 2);

    for (let i = 0; i < numPeaks; i++) {
      let min = 0;
      let max = 0;
      for (let c = 0; c < channelPeaks.length; c++) {
        min += weight * channelPeaks[c][i * 2];
        max += weight * channelPeaks[c][i * 2 + 1];
      }
      monoPeaks[i * 2] = min;
      monoPeaks[i * 2 + 1] = max;
    }

    return {
      length: numPeaks,
      data: [monoPeaks],
      bits,
    };
  }

  const peakLength = channelPeaks.length > 0 ? channelPeaks[0].length / 2 : 0;

  return {
    length: peakLength,
    data: channelPeaks,
    bits,
  };
}
