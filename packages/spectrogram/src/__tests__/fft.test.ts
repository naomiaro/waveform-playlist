import { describe, it, expect } from 'vitest';
import { fft, magnitudeSpectrum, toDecibels, fftMagnitudeDb } from '../computation/fft';

describe('toDecibels', () => {
  it('converts known magnitudes to correct dB values', () => {
    // 20 * log10(1) = 0 dB
    const mags = new Float32Array([1]);
    const db = toDecibels(mags);
    expect(db[0]).toBeCloseTo(0, 1);
  });

  it('converts magnitude 10 to 20 dB', () => {
    const mags = new Float32Array([10]);
    const db = toDecibels(mags);
    expect(db[0]).toBeCloseTo(20, 1);
  });

  it('converts magnitude 100 to 40 dB', () => {
    const mags = new Float32Array([100]);
    const db = toDecibels(mags);
    expect(db[0]).toBeCloseTo(40, 1);
  });

  it('converts magnitude 0.1 to -20 dB', () => {
    const mags = new Float32Array([0.1]);
    const db = toDecibels(mags);
    expect(db[0]).toBeCloseTo(-20, 1);
  });

  it('floors at -160 dB for zero magnitude', () => {
    const mags = new Float32Array([0]);
    const db = toDecibels(mags);
    expect(db[0]).toBe(-160);
  });

  it('floors at -160 dB for very small magnitudes', () => {
    const mags = new Float32Array([1e-20]);
    const db = toDecibels(mags);
    expect(db[0]).toBe(-160);
  });

  it('handles multiple values', () => {
    const mags = new Float32Array([1, 10, 100, 0.01]);
    const db = toDecibels(mags);
    expect(db[0]).toBeCloseTo(0, 1);
    expect(db[1]).toBeCloseTo(20, 1);
    expect(db[2]).toBeCloseTo(40, 1);
    expect(db[3]).toBeCloseTo(-40, 1);
  });

  it('returns a new Float32Array', () => {
    const mags = new Float32Array([1]);
    const db = toDecibels(mags);
    expect(db).toBeInstanceOf(Float32Array);
    expect(db).not.toBe(mags);
  });
});

describe('magnitudeSpectrum', () => {
  it('computes correct magnitudes from known complex values', () => {
    // real = [3, 4], imag = [4, 3]
    // magnitudes = [sqrt(9+16), sqrt(16+9)] = [5, 5]
    // But magnitudeSpectrum takes first half: length >> 1 = 1
    const real = new Float32Array([3, 4]);
    const imag = new Float32Array([4, 3]);
    const mags = magnitudeSpectrum(real, imag);
    expect(mags.length).toBe(1); // length >> 1
    expect(mags[0]).toBeCloseTo(5, 5);
  });

  it('returns half the input length (positive frequencies)', () => {
    const real = new Float32Array(8);
    const imag = new Float32Array(8);
    const mags = magnitudeSpectrum(real, imag);
    expect(mags.length).toBe(4);
  });

  it('computes sqrt(re^2 + im^2)', () => {
    const real = new Float32Array([1, 0, 3, 0]);
    const imag = new Float32Array([0, 1, 4, 0]);
    const mags = magnitudeSpectrum(real, imag);
    expect(mags[0]).toBeCloseTo(1, 5); // sqrt(1+0)
    expect(mags[1]).toBeCloseTo(1, 5); // sqrt(0+1)
  });

  it('returns Float32Array', () => {
    const real = new Float32Array(4);
    const imag = new Float32Array(4);
    const mags = magnitudeSpectrum(real, imag);
    expect(mags).toBeInstanceOf(Float32Array);
  });
});

describe('fft', () => {
  it('impulse signal produces flat spectrum', () => {
    const size = 8; // Must be power of 2 for fft.js
    const real = new Float32Array(size);
    const imag = new Float32Array(size);
    // Impulse: first sample is 1, rest are 0
    real[0] = 1;

    fft(real, imag);

    // FFT of impulse: all bins should have magnitude 1
    for (let i = 0; i < size; i++) {
      const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      expect(mag).toBeCloseTo(1, 4);
    }
  });

  it('DC signal produces energy only in bin 0', () => {
    const size = 8;
    const real = new Float32Array(size);
    const imag = new Float32Array(size);
    // DC: all samples are 1
    for (let i = 0; i < size; i++) real[i] = 1;

    fft(real, imag);

    // Bin 0 should have magnitude N (= 8)
    const dcMag = Math.sqrt(real[0] * real[0] + imag[0] * imag[0]);
    expect(dcMag).toBeCloseTo(size, 4);

    // All other bins should be ~0
    for (let i = 1; i < size; i++) {
      const mag = Math.sqrt(real[i] * real[i] + imag[i] * imag[i]);
      expect(mag).toBeCloseTo(0, 4);
    }
  });

  it('modifies real and imag arrays in place', () => {
    const size = 4;
    const real = new Float32Array([1, 0, 0, 0]);
    const imag = new Float32Array(size);
    fft(real, imag);

    // real should be modified in place (impulse FFT gives all 1s for real part)
    expect(real[1]).toBeCloseTo(1, 4);
  });

  it('handles size 4 (minimum practical FFT)', () => {
    const size = 4;
    const real = new Float32Array([1, 0, -1, 0]);
    const imag = new Float32Array(size);

    // Should not throw
    fft(real, imag);

    // Verify output is finite
    for (let i = 0; i < size; i++) {
      expect(Number.isFinite(real[i])).toBe(true);
      expect(Number.isFinite(imag[i])).toBe(true);
    }
  });
});

describe('fft caching', () => {
  it('same size reuses instance (no throw on repeated calls)', () => {
    // Call FFT twice with same size - should reuse cached instance
    const size = 16;
    const real1 = new Float32Array(size);
    const imag1 = new Float32Array(size);
    real1[0] = 1;
    fft(real1, imag1);

    const real2 = new Float32Array(size);
    const imag2 = new Float32Array(size);
    real2[0] = 1;
    fft(real2, imag2);

    // Both should produce the same result (impulse)
    for (let i = 0; i < size; i++) {
      expect(real1[i]).toBeCloseTo(real2[i], 6);
      expect(imag1[i]).toBeCloseTo(imag2[i], 6);
    }
  });

  it('different sizes work independently', () => {
    const real4 = new Float32Array([1, 0, 0, 0]);
    const imag4 = new Float32Array(4);
    fft(real4, imag4);

    const real8 = new Float32Array(8);
    const imag8 = new Float32Array(8);
    real8[0] = 1;
    fft(real8, imag8);

    // Both should give flat magnitude spectrums (impulse)
    for (let i = 0; i < 4; i++) {
      const mag = Math.sqrt(real4[i] * real4[i] + imag4[i] * imag4[i]);
      expect(mag).toBeCloseTo(1, 4);
    }
    for (let i = 0; i < 8; i++) {
      const mag = Math.sqrt(real8[i] * real8[i] + imag8[i] * imag8[i]);
      expect(mag).toBeCloseTo(1, 4);
    }
  });
});

describe('fftMagnitudeDb', () => {
  it('produces n/2 output bins', () => {
    const size = 16;
    const real = new Float32Array(size);
    real[0] = 1;
    const out = new Float32Array(size / 2);

    fftMagnitudeDb(real, out);

    expect(out.length).toBe(size / 2);
  });

  it('impulse signal produces approximately 0 dB flat spectrum', () => {
    const size = 8;
    const real = new Float32Array(size);
    real[0] = 1;
    const out = new Float32Array(size / 2);

    fftMagnitudeDb(real, out);

    // Magnitude of each bin for impulse is 1, so dB should be ~0
    for (let i = 0; i < size / 2; i++) {
      expect(out[i]).toBeCloseTo(0, 0);
    }
  });

  it('silent signal floors at -160 dB', () => {
    const size = 8;
    const real = new Float32Array(size); // All zeros
    const out = new Float32Array(size / 2);

    fftMagnitudeDb(real, out);

    for (let i = 0; i < size / 2; i++) {
      expect(out[i]).toBe(-160);
    }
  });

  it('DC signal has high energy in bin 0', () => {
    const size = 8;
    const real = new Float32Array(size);
    for (let i = 0; i < size; i++) real[i] = 1;
    const out = new Float32Array(size / 2);

    fftMagnitudeDb(real, out);

    // Bin 0 should have magnitude = 8, so dB = 20*log10(8) ~= 18.06
    expect(out[0]).toBeCloseTo(20 * Math.log10(8), 0);

    // Other bins should be near -160 (silent)
    for (let i = 1; i < size / 2; i++) {
      expect(out[i]).toBeLessThan(-100);
    }
  });
});
