import { describe, it, expect } from 'vitest';
import { pixelColumnToFrame } from '../src/computation/renderGeometry';

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
