/**
 * Load pre-computed waveform data from a .dat or .json file (BBC audiowaveform format).
 * Returns PeakData ready for rendering.
 */

import WaveformData from 'waveform-data';
import type { PeakData } from '@waveform-playlist/core';
import { extractPeaks } from '../workers/waveformDataUtils';

/**
 * Fetch and parse a waveform data file (.dat binary or .json).
 */
export async function loadWaveformDataFromUrl(src: string): Promise<WaveformData> {
  const response = await fetch(src);

  if (!response.ok) {
    throw new Error('[dawcore] Failed to fetch peaks data: ' + response.statusText);
  }

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
 * Load a .dat/.json peaks file and extract PeakData at the given zoom level.
 */
export async function loadPeaksFromUrl(
  src: string,
  samplesPerPixel: number,
  isMono: boolean,
  offsetSamples?: number,
  durationSamples?: number
): Promise<PeakData> {
  const waveformData = await loadWaveformDataFromUrl(src);
  return extractPeaks(waveformData, samplesPerPixel, isMono, offsetSamples, durationSamples);
}
