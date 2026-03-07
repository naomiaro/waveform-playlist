import { describe, it, expect } from 'vitest';
import { getColorMap } from '../computation/colorMaps';

describe('getColorMap', () => {
  describe('named colormaps exist and return valid LUTs', () => {
    const names = ['viridis', 'magma', 'inferno', 'roseus', 'grayscale', 'igray'] as const;

    for (const name of names) {
      it(`${name} returns a Uint8Array of length 768 (256 * 3)`, () => {
        const lut = getColorMap(name);
        expect(lut).toBeInstanceOf(Uint8Array);
        expect(lut.length).toBe(256 * 3);
      });

      it(`${name} has valid RGB values (0-255)`, () => {
        const lut = getColorMap(name);
        for (let i = 0; i < lut.length; i++) {
          expect(lut[i]).toBeGreaterThanOrEqual(0);
          expect(lut[i]).toBeLessThanOrEqual(255);
        }
      });
    }
  });

  describe('grayscale', () => {
    it('is linear 0 to 255', () => {
      const lut = getColorMap('grayscale');
      for (let i = 0; i < 256; i++) {
        expect(lut[i * 3]).toBe(i); // R
        expect(lut[i * 3 + 1]).toBe(i); // G
        expect(lut[i * 3 + 2]).toBe(i); // B
      }
    });
  });

  describe('igray (inverted grayscale)', () => {
    it('is linear 255 to 0', () => {
      const lut = getColorMap('igray');
      for (let i = 0; i < 256; i++) {
        const expected = 255 - i;
        expect(lut[i * 3]).toBe(expected); // R
        expect(lut[i * 3 + 1]).toBe(expected); // G
        expect(lut[i * 3 + 2]).toBe(expected); // B
      }
    });

    it('is the reverse of grayscale', () => {
      const gray = getColorMap('grayscale');
      const igray = getColorMap('igray');
      for (let i = 0; i < 256; i++) {
        expect(igray[i * 3]).toBe(gray[(255 - i) * 3]);
        expect(igray[i * 3 + 1]).toBe(gray[(255 - i) * 3 + 1]);
        expect(igray[i * 3 + 2]).toBe(gray[(255 - i) * 3 + 2]);
      }
    });
  });

  describe('caching', () => {
    it('grayscale returns the same reference on repeated calls', () => {
      const lut1 = getColorMap('grayscale');
      const lut2 = getColorMap('grayscale');
      expect(lut1).toBe(lut2);
    });

    it('igray returns the same reference on repeated calls', () => {
      const lut1 = getColorMap('igray');
      const lut2 = getColorMap('igray');
      expect(lut1).toBe(lut2);
    });

    it('pre-computed LUTs (viridis, magma, inferno, roseus) return same reference', () => {
      // These are module-level constants, so same reference is expected
      expect(getColorMap('viridis')).toBe(getColorMap('viridis'));
      expect(getColorMap('magma')).toBe(getColorMap('magma'));
      expect(getColorMap('inferno')).toBe(getColorMap('inferno'));
      expect(getColorMap('roseus')).toBe(getColorMap('roseus'));
    });
  });

  describe('LUT interpolation (custom color map)', () => {
    it('produces 256 entries from custom stops', () => {
      const stops = [
        [0, 0, 0],
        [255, 255, 255],
      ];
      const lut = getColorMap(stops);
      expect(lut).toBeInstanceOf(Uint8Array);
      expect(lut.length).toBe(256 * 3);
    });

    it('interpolates linearly between two stops', () => {
      const stops = [
        [0, 0, 0],
        [255, 255, 255],
      ];
      const lut = getColorMap(stops);

      // First entry should be [0, 0, 0]
      expect(lut[0]).toBe(0);
      expect(lut[1]).toBe(0);
      expect(lut[2]).toBe(0);

      // Last entry should be [255, 255, 255]
      expect(lut[255 * 3]).toBe(255);
      expect(lut[255 * 3 + 1]).toBe(255);
      expect(lut[255 * 3 + 2]).toBe(255);

      // Middle entry (i=128) should be approximately [128, 128, 128]
      const mid = 128;
      expect(lut[mid * 3]).toBeCloseTo(128, 0);
      expect(lut[mid * 3 + 1]).toBeCloseTo(128, 0);
      expect(lut[mid * 3 + 2]).toBeCloseTo(128, 0);
    });

    it('handles three stops', () => {
      const stops = [
        [255, 0, 0], // Red
        [0, 255, 0], // Green
        [0, 0, 255], // Blue
      ];
      const lut = getColorMap(stops);

      // First entry: red
      expect(lut[0]).toBe(255);
      expect(lut[1]).toBe(0);
      expect(lut[2]).toBe(0);

      // Last entry: blue
      expect(lut[255 * 3]).toBe(0);
      expect(lut[255 * 3 + 1]).toBe(0);
      expect(lut[255 * 3 + 2]).toBe(255);
    });

    it('single stop repeats the same color for all entries', () => {
      const stops = [[128, 64, 32]];
      const lut = getColorMap(stops);
      for (let i = 0; i < 256; i++) {
        expect(lut[i * 3]).toBe(128);
        expect(lut[i * 3 + 1]).toBe(64);
        expect(lut[i * 3 + 2]).toBe(32);
      }
    });
  });

  describe('unknown named colormap', () => {
    it('falls back to viridis', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lut = getColorMap('nonexistent' as any);
      const viridis = getColorMap('viridis');
      expect(lut).toBe(viridis);
    });
  });
});
