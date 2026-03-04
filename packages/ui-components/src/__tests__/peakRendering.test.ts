import { describe, it, expect } from 'vitest';
import {
  aggregatePeaks,
  calculateBarRects,
  calculateFirstBarPosition,
} from '../utils/peakRendering';

/**
 * Helper: builds an Int16Array of interleaved [min, max] peak pairs.
 */
function makePeaks(pairs: [min: number, max: number][]): Int16Array {
  const arr = new Int16Array(pairs.length * 2);
  pairs.forEach(([min, max], i) => {
    arr[i * 2] = min;
    arr[i * 2 + 1] = max;
  });
  return arr;
}

/**
 * Helper: builds an Int8Array of interleaved [min, max] peak pairs.
 */
function makePeaks8(pairs: [min: number, max: number][]): Int8Array {
  const arr = new Int8Array(pairs.length * 2);
  pairs.forEach(([min, max], i) => {
    arr[i * 2] = min;
    arr[i * 2 + 1] = max;
  });
  return arr;
}

describe('aggregatePeaks', () => {
  it('returns a single peak normalized by 16-bit depth', () => {
    // 16-bit maxValue = 32768
    const data = makePeaks([[-16384, 16384]]);
    const result = aggregatePeaks(data, 16, 0, 1);
    expect(result).toEqual({ min: -0.5, max: 0.5 });
  });

  it('aggregates multiple peaks (barWidth=4): min-of-mins / max-of-maxes', () => {
    const data = makePeaks([
      [-100, 200],
      [-300, 150],
      [-50, 400],
      [-200, 100],
    ]);
    const result = aggregatePeaks(data, 16, 0, 4);
    expect(result).not.toBeNull();
    // min-of-mins = -300/32768, max-of-maxes = 400/32768
    expect(result!.min).toBeCloseTo(-300 / 32768);
    expect(result!.max).toBeCloseTo(400 / 32768);
  });

  it('aggregates 2 peaks correctly', () => {
    const data = makePeaks([
      [-1000, 2000],
      [-3000, 1000],
    ]);
    const result = aggregatePeaks(data, 16, 0, 2);
    expect(result).not.toBeNull();
    expect(result!.min).toBeCloseTo(-3000 / 32768);
    expect(result!.max).toBeCloseTo(2000 / 32768);
  });

  it('returns null when startIndex is out of bounds', () => {
    const data = makePeaks([[-100, 200]]);
    expect(aggregatePeaks(data, 16, 5, 10)).toBeNull();
  });

  it('handles partial range when endIndex exceeds data length', () => {
    const data = makePeaks([
      [-100, 200],
      [-500, 300],
    ]);
    // endIndex=10 but only 2 peaks exist — aggregates both
    const result = aggregatePeaks(data, 16, 0, 10);
    expect(result).not.toBeNull();
    expect(result!.min).toBeCloseTo(-500 / 32768);
    expect(result!.max).toBeCloseTo(300 / 32768);
  });

  it('normalizes by 128 for 8-bit depth', () => {
    const data = makePeaks8([[-64, 64]]);
    const result = aggregatePeaks(data, 8, 0, 1);
    expect(result).toEqual({ min: -0.5, max: 0.5 });
  });

  it('handles negative peak values correctly', () => {
    const data = makePeaks([
      [-32000, -100],
      [-20000, -50],
    ]);
    const result = aggregatePeaks(data, 16, 0, 2);
    expect(result).not.toBeNull();
    expect(result!.min).toBeCloseTo(-32000 / 32768);
    expect(result!.max).toBeCloseTo(-50 / 32768);
  });

  it('returns zeros for all-zero peaks', () => {
    const data = makePeaks([
      [0, 0],
      [0, 0],
    ]);
    const result = aggregatePeaks(data, 16, 0, 2);
    expect(result).toEqual({ min: 0, max: 0 });
  });

  it('aggregates a sub-range starting mid-array', () => {
    const data = makePeaks([
      [-100, 100],
      [-200, 500],
      [-800, 300],
      [-50, 50],
    ]);
    // Aggregate peaks at indices 1 and 2 only
    const result = aggregatePeaks(data, 16, 1, 3);
    expect(result).not.toBeNull();
    expect(result!.min).toBeCloseTo(-800 / 32768);
    expect(result!.max).toBeCloseTo(500 / 32768);
  });

  it('returns a single peak when startIndex equals endIndex - 1', () => {
    const data = makePeaks([
      [-100, 100],
      [-200, 500],
    ]);
    const result = aggregatePeaks(data, 16, 1, 2);
    expect(result).not.toBeNull();
    expect(result!.min).toBeCloseTo(-200 / 32768);
    expect(result!.max).toBeCloseTo(500 / 32768);
  });
});

describe('calculateBarRects', () => {
  const halfHeight = 40; // waveHeight=80

  it('normal mode: single rect covering peak region', () => {
    const rects = calculateBarRects(10, 3, halfHeight, -0.5, 0.5, 'normal');
    expect(rects).toHaveLength(1);
    // max = |0.5 * 40| = 20, min = |-0.5 * 40| = 20
    // y = 40 - 20 = 20, height = 20 + 20 = 40
    expect(rects[0]).toEqual({ x: 10, y: 20, width: 3, height: 40 });
  });

  it('inverted mode: two rects (top gap + bottom gap)', () => {
    const rects = calculateBarRects(10, 3, halfHeight, -0.5, 0.5, 'inverted');
    expect(rects).toHaveLength(2);
    // Top gap: y=0, height=40-20=20
    expect(rects[0]).toEqual({ x: 10, y: 0, width: 3, height: 20 });
    // Bottom gap: y=40+20=60, height=40-20=20
    expect(rects[1]).toEqual({ x: 10, y: 60, width: 3, height: 20 });
  });

  it('zero amplitude in inverted mode: fills entire column', () => {
    const rects = calculateBarRects(0, 1, halfHeight, 0, 0, 'inverted');
    expect(rects).toHaveLength(2);
    // Top: y=0, height=40
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 1, height: 40 });
    // Bottom: y=40, height=40
    expect(rects[1]).toEqual({ x: 0, y: 40, width: 1, height: 40 });
  });

  it('full-scale peaks in inverted mode: zero-height gaps', () => {
    const rects = calculateBarRects(0, 1, halfHeight, -1, 1, 'inverted');
    expect(rects).toHaveLength(2);
    // Top: height = 40 - 40 = 0
    expect(rects[0]).toEqual({ x: 0, y: 0, width: 1, height: 0 });
    // Bottom: y=40+40=80, height=40-40=0
    expect(rects[1]).toEqual({ x: 0, y: 80, width: 1, height: 0 });
  });

  it('zero amplitude in normal mode: zero-height rect at center', () => {
    const rects = calculateBarRects(5, 2, halfHeight, 0, 0, 'normal');
    expect(rects).toHaveLength(1);
    expect(rects[0]).toEqual({ x: 5, y: 40, width: 2, height: 0 });
  });

  it('asymmetric peaks: different min and max magnitudes', () => {
    // min = -0.25, max = 0.75
    const rects = calculateBarRects(0, 1, halfHeight, -0.25, 0.75, 'normal');
    expect(rects).toHaveLength(1);
    // max = |0.75 * 40| = 30, min = |-0.25 * 40| = 10
    // y = 40 - 30 = 10, height = 30 + 10 = 40
    expect(rects[0]).toEqual({ x: 0, y: 10, width: 1, height: 40 });
  });
});

describe('calculateFirstBarPosition', () => {
  it('returns 0 when canvas starts at 0', () => {
    expect(calculateFirstBarPosition(0, 1, 1)).toBe(0);
  });

  it('returns 0 when canvas starts at 0 with step > 1', () => {
    expect(calculateFirstBarPosition(0, 3, 5)).toBe(0);
  });

  it('aligns to bar grid when canvas starts mid-bar', () => {
    // step=5, canvas starts at 7 → first bar at 5 (could overlap into canvas)
    const result = calculateFirstBarPosition(7, 3, 5);
    // (7 - 3 + 5) / 5 = 9/5 = 1.8 → floor(1.8) = 1 → 1 * 5 = 5
    expect(result).toBe(5);
  });

  it('returns correct position for large canvas offset', () => {
    // step=10, canvas starts at 105
    const result = calculateFirstBarPosition(105, 4, 10);
    // (105 - 4 + 10) / 10 = 111/10 = 11.1 → floor = 11 → 110
    expect(result).toBe(110);
  });

  it('handles step=1 (no gap, barWidth=1)', () => {
    const result = calculateFirstBarPosition(50, 1, 1);
    expect(result).toBe(50);
  });

  it('returns 0 when bar from origin could extend into canvas start', () => {
    // step=10, canvas starts at 3, barWidth=5
    // (3 - 5 + 10) / 10 = 8/10 = 0.8 → floor = 0 → 0
    expect(calculateFirstBarPosition(3, 5, 10)).toBe(0);
  });
});
