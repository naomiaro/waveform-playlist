/**
 * Load pre-computed waveform data from a .dat or .json file (BBC audiowaveform format).
 */

import WaveformData from 'waveform-data';

/**
 * Fetch and parse a waveform data file (.dat binary or .json).
 */
export async function loadWaveformDataFromUrl(src: string): Promise<WaveformData> {
  const response = await fetch(src);

  if (!response.ok) {
    throw new Error('[dawcore] Failed to fetch peaks data: ' + response.statusText);
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
