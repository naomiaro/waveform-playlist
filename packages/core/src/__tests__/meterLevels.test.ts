import { describe, it, expect } from 'vitest';
import { readMeterMessage, METER_PEAK_DECAY } from '../utils/meterLevels';
import { gainToNormalized } from '../utils/dBUtils';

describe('readMeterMessage', () => {
  it('converts peak and RMS gains to normalized levels per channel', () => {
    const { levels, smoothedPeaks } = readMeterMessage({
      data: new Float32Array([0.5, 0.25, 0.1, 0.05]),
      previousSmoothedPeaks: [],
      heldPeakLevels: [],
    });
    expect(smoothedPeaks).toEqual([0.5, 0.25]);
    expect(levels.levels).toEqual([gainToNormalized(0.5), gainToNormalized(0.25)]);
    expect(levels.rmsLevels[0]).toBeCloseTo(gainToNormalized(0.1), 5);
    expect(levels.rmsLevels[1]).toBeCloseTo(gainToNormalized(0.05), 5);
    expect(levels.peakLevels).toEqual(levels.levels);
  });

  it('lets the peak jump up at once and decay slowly', () => {
    const first = readMeterMessage({
      data: [1, 0],
      previousSmoothedPeaks: [],
      heldPeakLevels: [],
    });
    const second = readMeterMessage({
      data: [0, 0],
      previousSmoothedPeaks: first.smoothedPeaks,
      heldPeakLevels: first.levels.peakLevels,
    });
    expect(second.smoothedPeaks[0]).toBeCloseTo(METER_PEAK_DECAY, 10);
    const third = readMeterMessage({
      data: [1, 0],
      previousSmoothedPeaks: second.smoothedPeaks,
      heldPeakLevels: second.levels.peakLevels,
    });
    expect(third.smoothedPeaks[0]).toBe(1);
  });

  it('holds the highest level seen until the held peaks are cleared', () => {
    const loud = readMeterMessage({ data: [1, 0], previousSmoothedPeaks: [], heldPeakLevels: [] });
    const quiet = readMeterMessage({
      data: [0.01, 0],
      previousSmoothedPeaks: [0.01],
      heldPeakLevels: loud.levels.peakLevels,
    });
    expect(quiet.levels.peakLevels[0]).toBe(loud.levels.levels[0]);
    expect(quiet.levels.levels[0]).toBeLessThan(loud.levels.levels[0]);

    const afterReset = readMeterMessage({
      data: [0.01, 0],
      previousSmoothedPeaks: [0.01],
      heldPeakLevels: [],
    });
    expect(afterReset.levels.peakLevels[0]).toBe(afterReset.levels.levels[0]);
  });

  it('repeats channel 0 when the message has fewer channels than minChannels', () => {
    const { levels, smoothedPeaks } = readMeterMessage({
      data: [0.5, 0.1],
      previousSmoothedPeaks: [],
      heldPeakLevels: [],
      minChannels: 2,
    });
    expect(smoothedPeaks).toEqual([0.5]);
    expect(levels.levels).toEqual([gainToNormalized(0.5), gainToNormalized(0.5)]);
    expect(levels.rmsLevels).toEqual([gainToNormalized(0.1), gainToNormalized(0.1)]);
    expect(levels.peakLevels).toHaveLength(2);
  });

  it('keeps every channel when the message has more than minChannels', () => {
    const { levels } = readMeterMessage({
      data: [0.5, 0.4, 0.1, 0.1],
      previousSmoothedPeaks: [],
      heldPeakLevels: [],
      minChannels: 1,
    });
    expect(levels.levels).toHaveLength(2);
  });

  it('does not modify its inputs', () => {
    const previous = Object.freeze([0.9]);
    const held = Object.freeze([0.2]);
    expect(() =>
      readMeterMessage({ data: [0.1, 0], previousSmoothedPeaks: previous, heldPeakLevels: held })
    ).not.toThrow();
  });
});
