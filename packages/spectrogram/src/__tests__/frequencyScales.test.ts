import { describe, it, expect, vi } from 'vitest';
import { getFrequencyScale } from '../computation/frequencyScales';
import type { FrequencyScaleName } from '../computation/frequencyScales';

describe('getFrequencyScale', () => {
  const scaleNames: FrequencyScaleName[] = ['linear', 'logarithmic', 'mel', 'bark', 'erb'];
  const minF = 20;
  const maxF = 20000;

  describe('all scales return values in [0, 1]', () => {
    const testFreqs = [20, 100, 440, 1000, 5000, 10000, 20000];
    for (const name of scaleNames) {
      it(`${name} scale values are in [0, 1]`, () => {
        const scale = getFrequencyScale(name);
        for (const f of testFreqs) {
          const val = scale(f, minF, maxF);
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(1);
        }
      });
    }
  });

  describe('monotonicity (higher freq -> higher output)', () => {
    for (const name of scaleNames) {
      it(`${name} scale is monotonically increasing`, () => {
        const scale = getFrequencyScale(name);
        const freqs = [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000];
        for (let i = 1; i < freqs.length; i++) {
          expect(scale(freqs[i], minF, maxF)).toBeGreaterThan(scale(freqs[i - 1], minF, maxF));
        }
      });
    }
  });

  describe('edge cases: f equals minF and maxF', () => {
    for (const name of scaleNames) {
      it(`${name} returns 0 at minF`, () => {
        const scale = getFrequencyScale(name);
        expect(scale(minF, minF, maxF)).toBeCloseTo(0, 5);
      });

      it(`${name} returns 1 at maxF`, () => {
        const scale = getFrequencyScale(name);
        expect(scale(maxF, minF, maxF)).toBeCloseTo(1, 5);
      });
    }
  });

  describe('equal minF and maxF returns 0', () => {
    for (const name of scaleNames) {
      it(`${name} returns 0 when minF === maxF`, () => {
        const scale = getFrequencyScale(name);
        expect(scale(1000, 1000, 1000)).toBe(0);
      });
    }
  });

  describe('linear scale', () => {
    it('maps linearly', () => {
      const scale = getFrequencyScale('linear');
      expect(scale(10010, 0, 20020)).toBeCloseTo(0.5, 5);
      expect(scale(5000, 0, 10000)).toBeCloseTo(0.5, 5);
    });

    it('returns 0.5 at midpoint', () => {
      const scale = getFrequencyScale('linear');
      const mid = (minF + maxF) / 2;
      expect(scale(mid, minF, maxF)).toBeCloseTo(0.5, 5);
    });
  });

  describe('mel scale', () => {
    it('follows mel formula: 2595 * log10(1 + f/700)', () => {
      const scale = getFrequencyScale('mel');
      // Manually compute expected mel values
      const melOf = (f: number) => 2595 * Math.log10(1 + f / 700);
      const melMin = melOf(minF);
      const melMax = melOf(maxF);

      const f = 1000;
      const expected = (melOf(f) - melMin) / (melMax - melMin);
      expect(scale(f, minF, maxF)).toBeCloseTo(expected, 10);
    });

    it('expands low frequencies relative to linear', () => {
      const mel = getFrequencyScale('mel');
      const linear = getFrequencyScale('linear');
      // Mel allocates more resolution to low frequencies,
      // so a low frequency maps to a higher normalized value than linear
      const lowF = 500;
      expect(mel(lowF, minF, maxF)).toBeGreaterThan(linear(lowF, minF, maxF));
    });
  });

  describe('logarithmic scale', () => {
    it('expands low frequencies relative to linear', () => {
      const log = getFrequencyScale('logarithmic');
      const linear = getFrequencyScale('linear');
      // Log allocates more resolution to low frequencies
      const lowF = 500;
      expect(log(lowF, minF, maxF)).toBeGreaterThan(linear(lowF, minF, maxF));
    });

    it('handles minF=0 by clamping to 1', () => {
      const log = getFrequencyScale('logarithmic');
      // Should not throw or return NaN
      const val = log(100, 0, 20000);
      expect(Number.isFinite(val)).toBe(true);
      expect(val).toBeGreaterThan(0);
    });
  });

  describe('bark scale', () => {
    it('follows bark formula', () => {
      const scale = getFrequencyScale('bark');
      const barkOf = (f: number) => 13 * Math.atan(0.00076 * f) + 3.5 * Math.atan((f / 7500) ** 2);
      const barkMin = barkOf(minF);
      const barkMax = barkOf(maxF);

      const f = 3000;
      const expected = (barkOf(f) - barkMin) / (barkMax - barkMin);
      expect(scale(f, minF, maxF)).toBeCloseTo(expected, 10);
    });
  });

  describe('erb scale', () => {
    it('follows ERB formula: 21.4 * log10(1 + 0.00437 * f)', () => {
      const scale = getFrequencyScale('erb');
      const erbOf = (f: number) => 21.4 * Math.log10(1 + 0.00437 * f);
      const erbMin = erbOf(minF);
      const erbMax = erbOf(maxF);

      const f = 2000;
      const expected = (erbOf(f) - erbMin) / (erbMax - erbMin);
      expect(scale(f, minF, maxF)).toBeCloseTo(expected, 10);
    });
  });

  describe('unknown scale name', () => {
    it('falls back to linear and warns', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const scale = getFrequencyScale('unknown' as FrequencyScaleName);
      const linear = getFrequencyScale('linear');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown frequency scale'));

      expect(scale(1000, minF, maxF)).toBe(linear(1000, minF, maxF));
      warnSpy.mockRestore();
    });
  });
});
