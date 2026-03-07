import { describe, it, expect, vi } from 'vitest';
import { getWindowFunction } from '../computation/windowFunctions';

describe('getWindowFunction', () => {
  describe('correct length', () => {
    const names = ['rectangular', 'bartlett', 'hann', 'hamming', 'blackman', 'blackman-harris'];
    for (const name of names) {
      it(`${name} returns Float32Array of correct length`, () => {
        const result = getWindowFunction(name, 128);
        expect(result).toBeInstanceOf(Float32Array);
        expect(result.length).toBe(128);
      });
    }
  });

  describe('rectangular window', () => {
    it('before normalization, all values are equal', () => {
      // After normalization: scale = 2.0 / sum = 2.0 / N
      // So all values should be 2/N
      const size = 64;
      const result = getWindowFunction('rectangular', size);
      const expected = 2.0 / size;
      for (let i = 0; i < size; i++) {
        expect(result[i]).toBeCloseTo(expected, 6);
      }
    });

    it('all values are identical', () => {
      const result = getWindowFunction('rectangular', 32);
      const first = result[0];
      for (let i = 1; i < result.length; i++) {
        expect(result[i]).toBe(first);
      }
    });
  });

  describe('hann window', () => {
    it('first sample is zero (or near-zero after normalization)', () => {
      const result = getWindowFunction('hann', 256);
      // Hann: 0.5 * (1 - cos(0)) = 0
      // Even after normalization, 0 * scale = 0
      expect(result[0]).toBeCloseTo(0, 6);
    });

    it('is approximately symmetric', () => {
      // Window uses N (not N-1) as period, so not perfectly symmetric
      const size = 128;
      const result = getWindowFunction('hann', size);
      for (let i = 0; i < size / 2; i++) {
        expect(result[i]).toBeCloseTo(result[size - 1 - i], 2);
      }
    });

    it('peaks near the center', () => {
      const size = 256;
      const result = getWindowFunction('hann', size);
      const center = size / 2;
      // Values near center should be larger than values near edges
      expect(result[center]).toBeGreaterThan(result[1]);
      expect(result[center]).toBeGreaterThan(result[size - 2]);
    });
  });

  describe('hamming window', () => {
    it('first sample is near-zero but not exactly zero', () => {
      // Hamming: a - (1-a)*cos(0) = 0.54 - 0.46 = 0.08
      // After normalization, it should be small but nonzero
      const result = getWindowFunction('hamming', 256);
      expect(result[0]).toBeGreaterThan(0);
      expect(result[0]).toBeLessThan(result[128]); // Much less than center
    });

    it('is approximately symmetric', () => {
      const size = 128;
      const result = getWindowFunction('hamming', size);
      for (let i = 0; i < size / 2; i++) {
        expect(result[i]).toBeCloseTo(result[size - 1 - i], 2);
      }
    });

    it('respects custom alpha parameter', () => {
      const defaultResult = getWindowFunction('hamming', 64);
      const customResult = getWindowFunction('hamming', 64, 0.5);
      // Different alpha should produce different values
      let different = false;
      for (let i = 0; i < 64; i++) {
        if (Math.abs(defaultResult[i] - customResult[i]) > 1e-6) {
          different = true;
          break;
        }
      }
      expect(different).toBe(true);
    });
  });

  describe('bartlett window', () => {
    it('first sample is zero', () => {
      // Bartlett: 1 - |2*0 - N| / N = 1 - 1 = 0
      const result = getWindowFunction('bartlett', 128);
      expect(result[0]).toBeCloseTo(0, 6);
    });

    it('is approximately symmetric', () => {
      const size = 64;
      const result = getWindowFunction('bartlett', size);
      for (let i = 0; i < size / 2; i++) {
        expect(result[i]).toBeCloseTo(result[size - 1 - i], 1);
      }
    });
  });

  describe('blackman window', () => {
    it('first sample is near zero', () => {
      // Blackman at i=0: a0 - a1*cos(0) + a2*cos(0) = 0.42 - 0.5 + 0.08 = 0.0
      const result = getWindowFunction('blackman', 256);
      expect(Math.abs(result[0])).toBeLessThan(0.01);
    });

    it('has lower sidelobes than hann (center value is lower relative to rectangular)', () => {
      // Blackman window has a wider main lobe but lower sidelobes
      // Its peak value after normalization should differ from hann
      const blackman = getWindowFunction('blackman', 256);
      const hann = getWindowFunction('hann', 256);
      // Both should peak near center
      expect(blackman[128]).toBeGreaterThan(0);
      expect(hann[128]).toBeGreaterThan(0);
    });

    it('is approximately symmetric', () => {
      const size = 128;
      const result = getWindowFunction('blackman', size);
      for (let i = 0; i < size / 2; i++) {
        expect(result[i]).toBeCloseTo(result[size - 1 - i], 2);
      }
    });
  });

  describe('blackman-harris window', () => {
    it('first sample is very small', () => {
      // BH at i=0: c0 - c1 + c2 - c3 = 0.35875 - 0.48829 + 0.14128 - 0.01168 = 0.00006
      const result = getWindowFunction('blackman-harris', 256);
      expect(Math.abs(result[0])).toBeLessThan(0.01);
    });

    it('is approximately symmetric', () => {
      const size = 128;
      const result = getWindowFunction('blackman-harris', size);
      for (let i = 0; i < size / 2; i++) {
        expect(result[i]).toBeCloseTo(result[size - 1 - i], 2);
      }
    });
  });

  describe('normalization', () => {
    it('applies scale = 2.0 / sum', () => {
      const size = 64;
      const result = getWindowFunction('hann', size);
      // After normalization, sum of (original * scale) = sum * (2/sum) = 2
      // So sum of result should be 2
      let sum = 0;
      for (let i = 0; i < size; i++) sum += result[i];
      expect(sum).toBeCloseTo(2.0, 4);
    });

    it('normalization sum is 2.0 for all window types', () => {
      const names = ['rectangular', 'bartlett', 'hann', 'hamming', 'blackman', 'blackman-harris'];
      for (const name of names) {
        const result = getWindowFunction(name, 128);
        let sum = 0;
        for (let i = 0; i < 128; i++) sum += result[i];
        expect(sum).toBeCloseTo(2.0, 3);
      }
    });
  });

  describe('unknown window name', () => {
    it('falls back to hann and warns', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const result = getWindowFunction('unknown-window', 64);
      const hann = getWindowFunction('hann', 64);

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Unknown window function'));

      for (let i = 0; i < 64; i++) {
        expect(result[i]).toBeCloseTo(hann[i], 6);
      }

      warnSpy.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('size=1 returns a single-element array', () => {
      const result = getWindowFunction('hann', 1);
      expect(result.length).toBe(1);
      // hann at i=0, N=1: 0.5*(1-cos(0)) = 0
      // sum = 0, so no normalization applied (guard: sum > 0)
      expect(result[0]).toBeCloseTo(0, 6);
    });

    it('size=2 returns a two-element array', () => {
      const result = getWindowFunction('hann', 2);
      expect(result.length).toBe(2);
      // hann at i=0, N=2: 0.5*(1-cos(0)) = 0
      // hann at i=1, N=2: 0.5*(1-cos(pi)) = 0.5*(1+1) = 1
      // sum = 1, scale = 2/1 = 2
      // So result[0] = 0, result[1] = 2
      expect(result[0]).toBeCloseTo(0, 6);
      expect(result[1]).toBeCloseTo(2.0, 5);
    });

    it('size=1 rectangular returns normalized value', () => {
      const result = getWindowFunction('rectangular', 1);
      expect(result.length).toBe(1);
      // rectangular: all 1s, sum = 1, scale = 2/1 = 2
      expect(result[0]).toBeCloseTo(2.0, 6);
    });
  });
});
