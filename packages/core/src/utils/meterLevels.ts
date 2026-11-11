import { gainToNormalized } from './dBUtils';
import type { MeterLevels } from '../valueSource';

/** Exponential decay per reading for the smoothed peak (~800 ms to 1/e at 60 Hz). */
export const METER_PEAK_DECAY = 0.98;

export interface MeterReading {
  /** Raw-gain smoothed peak per metered channel; pass back in with the next message. */
  smoothedPeaks: number[];
  /** The levels to show. */
  levels: MeterLevels;
}

export interface ReadMeterMessageParams {
  /**
   * A meter worklet message: N peak gains followed by N RMS gains.
   */
  data: ArrayLike<number>;
  /** `smoothedPeaks` from the previous reading (empty for the first). */
  previousSmoothedPeaks: readonly number[];
  /** `levels.peakLevels` from the previous reading (empty after a reset). */
  heldPeakLevels: readonly number[];
  /**
   * When the message has fewer channels than this, channel 0 is repeated to
   * fill it (a mono microphone shown on a stereo meter). Default: 0.
   */
  minChannels?: number;
}

/**
 * Turn one meter worklet message into display levels: the peak jumps up at
 * once and decays slowly, RMS is passed through, and the held peak keeps the
 * highest level seen. Pure: nothing passed in is modified.
 */
export function readMeterMessage({
  data,
  previousSmoothedPeaks,
  heldPeakLevels,
  minChannels = 0,
}: ReadMeterMessageParams): MeterReading {
  const channels = Math.floor(data.length / 2);
  const smoothedPeaks: number[] = [];
  const peaks: number[] = [];
  const rms: number[] = [];

  for (let ch = 0; ch < channels; ch++) {
    const smoothed = Math.max(data[ch], (previousSmoothedPeaks[ch] ?? 0) * METER_PEAK_DECAY);
    smoothedPeaks.push(smoothed);
    peaks.push(gainToNormalized(smoothed));
    rms.push(gainToNormalized(data[channels + ch]));
  }

  const mirror = channels > 0 && channels < minChannels;
  const levels = mirror ? new Array<number>(minChannels).fill(peaks[0]) : peaks;
  const rmsLevels = mirror ? new Array<number>(minChannels).fill(rms[0]) : rms;
  const peakLevels = levels.map((level, i) => Math.max(heldPeakLevels[i] ?? 0, level));

  return { smoothedPeaks, levels: { levels, peakLevels, rmsLevels } };
}
