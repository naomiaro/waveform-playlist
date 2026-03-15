import type { Peaks, Bits } from '@waveform-playlist/core';

export type WaveformDrawMode = 'normal' | 'inverted';

/**
 * Result of aggregating peaks over a range.
 *
 * Invariants (assumed from valid waveform input):
 * - min and max are normalized to [-1, 1] by dividing by 2^(bits-1)
 * - min <= max (min-of-mins, max-of-maxes — guaranteed by the interleaved min/max peak format)
 * - Values are finite (derived from integer typed arrays)
 *
 * Construct via aggregatePeaks() — do not create directly.
 */
export interface AggregatedPeak {
  min: number;
  max: number;
}

/**
 * Canvas fillRect parameters for a single waveform bar.
 * width >= 0 and height >= 0 when peak values are in [-1, 1] (guaranteed by
 * the interleaved min/max peak format normalization).
 */
export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Aggregates peaks over a range of interleaved min/max pairs.
 * Finds min-of-mins and max-of-maxes, normalized by bit depth.
 *
 * @param data - Interleaved peak data [min0, max0, min1, max1, ...]
 * @param bits - Bit depth (8 or 16)
 * @param startIndex - First peak index (not array index — peak i is at data[i*2], data[i*2+1])
 * @param endIndex - One past the last peak index to include
 * @returns Normalized { min, max } or null if startIndex is out of bounds
 */
export function aggregatePeaks(
  data: Peaks,
  bits: Bits,
  startIndex: number,
  endIndex: number
): AggregatedPeak | null {
  if (startIndex * 2 + 1 >= data.length) {
    return null;
  }

  const maxValue = 2 ** (bits - 1);
  let minPeak = data[startIndex * 2] / maxValue;
  let maxPeak = data[startIndex * 2 + 1] / maxValue;

  for (let p = startIndex + 1; p < endIndex; p++) {
    if (p * 2 + 1 >= data.length) break;
    const pMin = data[p * 2] / maxValue;
    const pMax = data[p * 2 + 1] / maxValue;
    if (pMin < minPeak) minPeak = pMin;
    if (pMax > maxPeak) maxPeak = pMax;
  }

  return { min: minPeak, max: maxPeak };
}

/**
 * Computes canvas fillRect parameters for a single waveform bar.
 *
 * @param x - Bar x position in canvas coordinates
 * @param barWidth - Width of the bar in pixels
 * @param halfHeight - Half the waveform height (center line y)
 * @param minPeak - Normalized min peak value (negative for below center)
 * @param maxPeak - Normalized max peak value (positive for above center)
 * @param drawMode - 'normal' draws the peak region, 'inverted' draws the non-peak regions
 * @returns Array of BarRect — 1 rect for 'normal', 2 rects for 'inverted'
 */
export function calculateBarRects(
  x: number,
  barWidth: number,
  halfHeight: number,
  minPeak: number,
  maxPeak: number,
  drawMode: WaveformDrawMode
): BarRect[] {
  const min = Math.abs(minPeak * halfHeight);
  const max = Math.abs(maxPeak * halfHeight);

  if (drawMode === 'normal') {
    return [{ x, y: halfHeight - max, width: barWidth, height: max + min }];
  }

  // Inverted: draw areas WITHOUT audio (top gap + bottom gap)
  return [
    { x, y: 0, width: barWidth, height: halfHeight - max },
    { x, y: halfHeight + min, width: barWidth, height: halfHeight - min },
  ];
}

/**
 * Computes the first bar position (in global pixel coordinates) that could
 * affect a given canvas chunk.
 *
 * A bar at position X extends from X to X+barWidth-1, so we need bars where
 * barStart + barWidth > canvasStartGlobal.
 *
 * @param canvasStartGlobal - Global pixel offset of the canvas chunk
 * @param barWidth - Width of each bar in pixels
 * @param step - Bar stride (barWidth + barGap)
 * @returns The first bar's global position (always >= 0 when step >= barWidth; caller clamps to 0)
 */
export function calculateFirstBarPosition(
  canvasStartGlobal: number,
  barWidth: number,
  step: number
): number {
  return Math.floor((canvasStartGlobal - barWidth + step) / step) * step;
}
