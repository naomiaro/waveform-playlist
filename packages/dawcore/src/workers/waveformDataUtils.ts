/**
 * Utilities for converting WaveformData to PeakData format.
 * Adapted from @waveform-playlist/browser waveformDataLoader.ts.
 */

import WaveformData from 'waveform-data';
import type { PeakData, Peaks } from '@waveform-playlist/core';

/**
 * Slice and resample WaveformData with aligned source indices.
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

      const targetStart = Math.floor(offsetSamples / samplesPerPixel);
      const targetEnd = Math.ceil((offsetSamples + durationSamples) / samplesPerPixel);

      const sourceStart = Math.max(0, Math.floor(targetStart * ratio));
      const sourceEnd = Math.min(waveformData.length, Math.ceil(targetEnd * ratio));

      if (sourceStart >= sourceEnd) {
        return null;
      }

      processedData = processedData.slice({
        startIndex: sourceStart,
        endIndex: sourceEnd,
      });
      processedData = processedData.resample({ scale: samplesPerPixel });
    } else {
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
 * Extract peaks from a WaveformData object, handling all channels, mono merging,
 * slicing, and resampling.
 */
export function extractPeaks(
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
    const numChannels = isMono ? 1 : waveformData.channels;
    const emptyData: Peaks[] = Array.from({ length: numChannels }, () =>
      bits === 8 ? new Int8Array(0) : new Int16Array(0)
    );
    return { length: 0, data: emptyData, bits };
  }

  const numChannels = processedData.channels;
  const bits = processedData.bits as 8 | 16;

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

    return { length: numPeaks, data: [monoPeaks], bits };
  }

  const peakLength = channelPeaks.length > 0 ? channelPeaks[0].length / 2 : 0;
  return { length: peakLength, data: channelPeaks, bits };
}
