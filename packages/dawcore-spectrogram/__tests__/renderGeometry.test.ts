import { describe, it, expect } from 'vitest';
import { pixelColumnToFrame, pixelRowToBin } from '../src/computation/renderGeometry';
import { getFrequencyScale } from '../src/computation/frequencyScales';

/**
 * The file sample displayed at clip-relative pixel x is
 * `clipOffsetSamples + x * samplesPerPixel`; the FFT frame holding it is
 * `(fileSample - fftStartSample) / hopSize` (#554).
 */
describe('pixelColumnToFrame', () => {
  it('maps pixel 0 of an untrimmed clip whose FFT starts at file sample 0 to frame 0', () => {
    expect(
      pixelColumnToFrame({
        pixelX: 0,
        samplesPerPixel: 512,
        clipOffsetSamples: 0,
        fftStartSample: 0,
        hopSize: 512,
      })
    ).toBe(0);
  });

  it('advances one frame per pixel when samplesPerPixel === hopSize', () => {
    expect(
      pixelColumnToFrame({
        pixelX: 7,
        samplesPerPixel: 512,
        clipOffsetSamples: 0,
        fftStartSample: 0,
        hopSize: 512,
      })
    ).toBe(7);
  });

  it('accounts for the clip audio offset: pixel 0 of a trimmed clip maps into the FFT data, not before it', () => {
    // Clip trimmed to start at file sample 4000; FFT computed exactly from there.
    expect(
      pixelColumnToFrame({
        pixelX: 0,
        samplesPerPixel: 400,
        clipOffsetSamples: 4000,
        fftStartSample: 4000,
        hopSize: 64,
      })
    ).toBe(0);
  });

  it('accounts for FFT window padding: frames before the requested range are skipped', () => {
    // FFT range was padded left by one fftSize (2048) before the visible start.
    expect(
      pixelColumnToFrame({
        pixelX: 0,
        samplesPerPixel: 512,
        clipOffsetSamples: 0,
        fftStartSample: -2048, // paddedStart, expressed file-absolute
        hopSize: 512,
      })
    ).toBe(4);
  });

  it('floors fractional frame positions', () => {
    expect(
      pixelColumnToFrame({
        pixelX: 3,
        samplesPerPixel: 100,
        clipOffsetSamples: 0,
        fftStartSample: 0,
        hopSize: 512,
      })
    ).toBe(0);
  });
});

/**
 * Row → frequency-bin mapping. The linear scale must honor the configured
 * minFrequency/maxFrequency exactly like the non-linear scales, and the top
 * row (normalizedY === 1) must land on a valid bin, not one past the end (#557).
 */
describe('pixelRowToBin', () => {
  const linear = getFrequencyScale('linear');
  const mel = getFrequencyScale('mel');
  const base = {
    frequencyBinCount: 128,
    sampleRate: 40000, // nyquist 20000
    minFrequency: 0,
    maxFrequency: 20000,
  };

  it('linear full-range: mid canvas maps to the middle bin', () => {
    expect(
      pixelRowToBin({ ...base, normalizedY: 0.5, scaleFn: linear, isLinear: true })
    ).toBe(64);
  });

  it('linear honors maxFrequency: the top row maps to the maxFrequency bin, not Nyquist', () => {
    expect(
      pixelRowToBin({
        ...base,
        maxFrequency: 10000,
        normalizedY: 1,
        scaleFn: linear,
        isLinear: true,
      })
    ).toBe(64); // 10000 Hz of 20000 Hz Nyquist → bin 64 of 128
  });

  it('linear honors minFrequency: the bottom row maps to the minFrequency bin', () => {
    expect(
      pixelRowToBin({
        ...base,
        minFrequency: 5000,
        normalizedY: 0,
        scaleFn: linear,
        isLinear: true,
      })
    ).toBe(32); // 5000 Hz of 20000 Hz Nyquist → bin 32 of 128
  });

  it('linear top row at full range clamps to the last bin instead of falling out of range', () => {
    expect(pixelRowToBin({ ...base, normalizedY: 1, scaleFn: linear, isLinear: true })).toBe(127);
  });

  it('non-linear: returns the first bin whose scaled frequency reaches normalizedY', () => {
    // Reference: the worker's original binary search semantics.
    const normalizedY = 0.5;
    const expected = (() => {
      for (let bin = 0; bin < base.frequencyBinCount; bin++) {
        const freq = (bin / base.frequencyBinCount) * (base.sampleRate / 2);
        if (mel(freq, base.minFrequency, base.maxFrequency) >= normalizedY) return bin;
      }
      return base.frequencyBinCount - 1;
    })();
    expect(
      pixelRowToBin({ ...base, normalizedY, scaleFn: mel, isLinear: false })
    ).toBe(expected);
  });

  it('non-linear top row stays within range', () => {
    const bin = pixelRowToBin({ ...base, normalizedY: 1, scaleFn: mel, isLinear: false });
    expect(bin).toBeGreaterThanOrEqual(0);
    expect(bin).toBeLessThan(base.frequencyBinCount);
  });
});
