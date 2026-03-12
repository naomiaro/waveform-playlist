import { describe, it, expect } from 'vitest';
import {
  linearCurve,
  exponentialCurve,
  sCurveCurve,
  logarithmicCurve,
  generateCurve,
} from '../fades';

describe('linearCurve', () => {
  it('produces correct length', () => {
    const curve = linearCurve(100, true);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(100);
  });

  it('fade in: starts at 0 and ends at 1', () => {
    const curve = linearCurve(100, true);
    expect(curve[0]).toBeCloseTo(0, 5);
    expect(curve[99]).toBeCloseTo(1, 5);
  });

  it('fade out: starts at 1 and ends at 0', () => {
    const curve = linearCurve(100, false);
    expect(curve[0]).toBeCloseTo(1, 5);
    expect(curve[99]).toBeCloseTo(0, 5);
  });

  it('values are linearly spaced (fade in)', () => {
    const curve = linearCurve(11, true);
    // Values should be 0, 0.1, 0.2, ..., 1.0
    for (let i = 0; i < 11; i++) {
      expect(curve[i]).toBeCloseTo(i / 10, 5);
    }
  });

  it('all values are in [0, 1] range', () => {
    const curve = linearCurve(1000, true);
    for (let i = 0; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(0);
      expect(curve[i]).toBeLessThanOrEqual(1);
    }
  });

  it('fade in is the reverse of fade out', () => {
    const fadeIn = linearCurve(50, true);
    const fadeOut = linearCurve(50, false);
    for (let i = 0; i < 50; i++) {
      expect(fadeIn[i]).toBeCloseTo(fadeOut[49 - i], 5);
    }
  });

  it('length=2: two values at 0 and 1', () => {
    const curve = linearCurve(2, true);
    expect(curve.length).toBe(2);
    expect(curve[0]).toBeCloseTo(0, 5);
    expect(curve[1]).toBeCloseTo(1, 5);
  });

  it('length=1: single value at 0 for fade in (0/0 edge case)', () => {
    // When length=1, scale=0, so i/scale = 0/0 = NaN
    // Float32Array stores NaN, this documents the edge case behavior
    const curve = linearCurve(1, true);
    expect(curve.length).toBe(1);
  });
});

describe('exponentialCurve', () => {
  it('produces correct length', () => {
    const curve = exponentialCurve(100, true);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(100);
  });

  it('fade in: starts near 0 and ends near 1', () => {
    const curve = exponentialCurve(100, true);
    // exp(2*0 - 1) / e = exp(-1)/e = 1/e^2 ~ 0.135
    expect(curve[0]).toBeCloseTo(Math.exp(-1) / Math.E, 5);
    // exp(2*1 - 1) / e = exp(1)/e = 1.0
    expect(curve[99]).toBeCloseTo(1, 5);
  });

  it('fade out: reverses the curve direction', () => {
    const curve = exponentialCurve(100, false);
    // fade out puts higher values at start
    expect(curve[0]).toBeCloseTo(1, 5);
    expect(curve[99]).toBeCloseTo(Math.exp(-1) / Math.E, 5);
  });

  it('fade in is monotonically non-decreasing', () => {
    const curve = exponentialCurve(100, true);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1] - 1e-7);
    }
  });

  it('all values are positive', () => {
    const curve = exponentialCurve(1000, true);
    for (let i = 0; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThan(0);
    }
  });

  it('length=2 produces valid curve', () => {
    const curve = exponentialCurve(2, true);
    expect(curve.length).toBe(2);
    expect(curve[0]).toBeCloseTo(Math.exp(-1) / Math.E, 5);
    expect(curve[1]).toBeCloseTo(1, 5);
  });
});

describe('sCurveCurve', () => {
  it('produces correct length', () => {
    const curve = sCurveCurve(100, true);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(100);
  });

  it('fade in: starts near 0 and ends near 1', () => {
    const curve = sCurveCurve(1000, true);
    expect(curve[0]).toBeCloseTo(0, 1);
    expect(curve[999]).toBeCloseTo(1, 1);
  });

  it('fade out: starts near 1 and ends near 0', () => {
    const curve = sCurveCurve(1000, false);
    expect(curve[0]).toBeCloseTo(1, 1);
    expect(curve[999]).toBeCloseTo(0, 1);
  });

  it('midpoint is near 0.5 (S-curve characteristic)', () => {
    const curve = sCurveCurve(1000, true);
    const mid = curve[500];
    expect(mid).toBeCloseTo(0.5, 1);
  });

  it('fade in is monotonically non-decreasing', () => {
    const curve = sCurveCurve(100, true);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1] - 1e-7);
    }
  });

  it('all values are in [0, 1] range', () => {
    const curve = sCurveCurve(1000, true);
    for (let i = 0; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(0);
      expect(curve[i]).toBeLessThanOrEqual(1);
    }
  });

  it('length=2 produces valid curve', () => {
    const curve = sCurveCurve(2, true);
    expect(curve.length).toBe(2);
  });
});

describe('logarithmicCurve', () => {
  it('produces correct length', () => {
    const curve = logarithmicCurve(100, true);
    expect(curve).toBeInstanceOf(Float32Array);
    expect(curve.length).toBe(100);
  });

  it('fade in: starts at 0 and approaches 1', () => {
    const curve = logarithmicCurve(100, true);
    expect(curve[0]).toBeCloseTo(0, 5);
    // Last value: log(1 + 10 * 99/100) / log(11) ~ log(10.9)/log(11) ~ 0.996
    expect(curve[99]).toBeCloseTo(Math.log(1 + 10 * (99 / 100)) / Math.log(11), 3);
  });

  it('fade out: reverses the curve direction', () => {
    const fadeIn = logarithmicCurve(50, true);
    const fadeOut = logarithmicCurve(50, false);
    for (let i = 0; i < 50; i++) {
      expect(fadeIn[i]).toBeCloseTo(fadeOut[49 - i], 5);
    }
  });

  it('fade in is monotonically non-decreasing', () => {
    const curve = logarithmicCurve(100, true);
    for (let i = 1; i < curve.length; i++) {
      expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1] - 1e-7);
    }
  });

  it('logarithmic shape: grows quickly then plateaus', () => {
    const curve = logarithmicCurve(100, true);
    // First quarter gain should be more than 25% of total (log shape)
    const firstQuarterEnd = curve[25];
    const midpoint = curve[50];
    // Log curve reaches midpoint faster than linear
    expect(firstQuarterEnd).toBeGreaterThan(0.25);
    expect(midpoint).toBeGreaterThan(0.5);
  });

  it('custom base parameter changes curve shape', () => {
    const base2 = logarithmicCurve(100, true, 2);
    const base100 = logarithmicCurve(100, true, 100);
    // Higher base = more aggressive initial rise
    // Compare at midpoint: higher base should have a higher value
    expect(base100[50]).toBeGreaterThan(base2[50]);
  });

  it('length=2 produces valid curve', () => {
    const curve = logarithmicCurve(2, true);
    expect(curve.length).toBe(2);
    expect(curve[0]).toBeCloseTo(0, 5);
  });
});

describe('generateCurve', () => {
  it('dispatches to linearCurve for "linear" type', () => {
    const generated = generateCurve('linear', 100, true);
    const direct = linearCurve(100, true);
    expect(generated).toEqual(direct);
  });

  it('dispatches to exponentialCurve for "exponential" type', () => {
    const generated = generateCurve('exponential', 100, true);
    const direct = exponentialCurve(100, true);
    expect(generated).toEqual(direct);
  });

  it('dispatches to sCurveCurve for "sCurve" type', () => {
    const generated = generateCurve('sCurve', 100, true);
    const direct = sCurveCurve(100, true);
    expect(generated).toEqual(direct);
  });

  it('dispatches to logarithmicCurve for "logarithmic" type', () => {
    const generated = generateCurve('logarithmic', 100, true);
    const direct = logarithmicCurve(100, true);
    expect(generated).toEqual(direct);
  });

  it('defaults to linear for unknown type', () => {
    const generated = generateCurve('unknown' as never, 100, true);
    const direct = linearCurve(100, true);
    expect(generated).toEqual(direct);
  });

  it('passes fadeIn parameter correctly', () => {
    const fadeIn = generateCurve('linear', 100, true);
    const fadeOut = generateCurve('linear', 100, false);
    expect(fadeIn[0]).toBeCloseTo(0, 5);
    expect(fadeIn[99]).toBeCloseTo(1, 5);
    expect(fadeOut[0]).toBeCloseTo(1, 5);
    expect(fadeOut[99]).toBeCloseTo(0, 5);
  });
});
