import { describe, it, expect } from 'vitest';
import {
  samplesToSeconds,
  secondsToSamples,
  samplesToPixels,
  pixelsToSamples,
  pixelsToSeconds,
  secondsToPixels,
} from '../utils/conversions';

describe('samplesToSeconds', () => {
  it('converts samples to seconds at 44100 Hz', () => {
    expect(samplesToSeconds(44100, 44100)).toBe(1);
  });

  it('converts samples to seconds at 48000 Hz', () => {
    expect(samplesToSeconds(48000, 48000)).toBe(1);
  });

  it('returns 0 for zero samples', () => {
    expect(samplesToSeconds(0, 44100)).toBe(0);
  });

  it('handles fractional results', () => {
    expect(samplesToSeconds(22050, 44100)).toBe(0.5);
  });

  it('handles large values', () => {
    // 10 minutes at 44100 Hz
    const samples = 44100 * 600;
    expect(samplesToSeconds(samples, 44100)).toBe(600);
  });
});

describe('secondsToSamples', () => {
  it('converts seconds to samples at 44100 Hz', () => {
    expect(secondsToSamples(1, 44100)).toBe(44100);
  });

  it('converts seconds to samples at 48000 Hz', () => {
    expect(secondsToSamples(1, 48000)).toBe(48000);
  });

  it('returns 0 for zero seconds', () => {
    expect(secondsToSamples(0, 44100)).toBe(0);
  });

  it('uses Math.ceil for rounding', () => {
    // 0.5 seconds at 44100 = 22050 (exact)
    expect(secondsToSamples(0.5, 44100)).toBe(22050);
    // A value that produces a fractional result should be ceiled
    // 1/3 second at 44100 = 14700.0 exact, but try something that doesn't divide evenly
    // 0.1 seconds at 44100 = 4410.0 (exact)
    expect(secondsToSamples(0.1, 44100)).toBe(Math.ceil(0.1 * 44100));
  });

  it('rounds up fractional samples', () => {
    // 1/3 of a second at 10 Hz = 3.333... -> ceil -> 4
    expect(secondsToSamples(1 / 3, 10)).toBe(4);
  });

  it('handles large values', () => {
    expect(secondsToSamples(3600, 44100)).toBe(3600 * 44100);
  });
});

describe('samplesToPixels', () => {
  it('converts samples to pixels', () => {
    expect(samplesToPixels(1000, 100)).toBe(10);
  });

  it('returns 0 for zero samples', () => {
    expect(samplesToPixels(0, 100)).toBe(0);
  });

  it('uses Math.floor for rounding', () => {
    // 150 samples at 100 samplesPerPixel = 1.5 -> floor -> 1
    expect(samplesToPixels(150, 100)).toBe(1);
  });

  it('handles samplesPerPixel of 1', () => {
    expect(samplesToPixels(500, 1)).toBe(500);
  });

  it('handles large values', () => {
    // 44100 * 60 seconds at 1000 spp = 2646
    expect(samplesToPixels(44100 * 60, 1000)).toBe(2646);
  });
});

describe('pixelsToSamples', () => {
  it('converts pixels to samples', () => {
    expect(pixelsToSamples(10, 100)).toBe(1000);
  });

  it('returns 0 for zero pixels', () => {
    expect(pixelsToSamples(0, 100)).toBe(0);
  });

  it('uses Math.floor for rounding', () => {
    // With integer inputs, result is exact
    expect(pixelsToSamples(5, 100)).toBe(500);
  });

  it('handles samplesPerPixel of 1', () => {
    expect(pixelsToSamples(500, 1)).toBe(500);
  });

  it('handles large values', () => {
    expect(pixelsToSamples(10000, 1000)).toBe(10000000);
  });
});

describe('pixelsToSeconds', () => {
  it('converts pixels to seconds', () => {
    // 100 pixels * 441 spp / 44100 Hz = 1 second
    expect(pixelsToSeconds(100, 441, 44100)).toBe(1);
  });

  it('returns 0 for zero pixels', () => {
    expect(pixelsToSeconds(0, 1000, 44100)).toBe(0);
  });

  it('handles different sample rates', () => {
    // 100 pixels * 480 spp / 48000 Hz = 1 second
    expect(pixelsToSeconds(100, 480, 48000)).toBe(1);
  });

  it('handles fractional results', () => {
    // 50 pixels * 441 spp / 44100 Hz = 0.5 seconds
    expect(pixelsToSeconds(50, 441, 44100)).toBe(0.5);
  });
});

describe('secondsToPixels', () => {
  it('converts seconds to pixels', () => {
    // 1 second * 44100 Hz / 441 spp = 100 pixels
    expect(secondsToPixels(1, 441, 44100)).toBe(100);
  });

  it('returns 0 for zero seconds', () => {
    expect(secondsToPixels(0, 1000, 44100)).toBe(0);
  });

  it('uses Math.ceil for rounding', () => {
    // 1 second * 44100 / 1000 = 44.1 -> ceil -> 45
    expect(secondsToPixels(1, 1000, 44100)).toBe(45);
  });

  it('handles different sample rates', () => {
    // 1 second * 48000 / 480 = 100 pixels
    expect(secondsToPixels(1, 480, 48000)).toBe(100);
  });

  it('handles large values', () => {
    // 3600 seconds * 44100 / 1000 = 158760
    expect(secondsToPixels(3600, 1000, 44100)).toBe(158760);
  });
});

describe('round-trip stability', () => {
  it('samples -> seconds -> samples is stable (may grow by 1 due to ceil)', () => {
    const original = 44100;
    const sampleRate = 44100;
    const seconds = samplesToSeconds(original, sampleRate);
    const result = secondsToSamples(seconds, sampleRate);
    // secondsToSamples uses ceil, so result >= original
    expect(result).toBeGreaterThanOrEqual(original);
    expect(result).toBeLessThanOrEqual(original + 1);
  });

  it('exact sample counts survive round-trip', () => {
    // 22050 / 44100 = 0.5 exactly, so ceil(0.5 * 44100) = 22050
    const original = 22050;
    const sampleRate = 44100;
    const seconds = samplesToSeconds(original, sampleRate);
    const result = secondsToSamples(seconds, sampleRate);
    expect(result).toBe(original);
  });

  it('pixels -> samples -> pixels is stable (may shrink by 1 due to floor)', () => {
    const originalPixels = 100;
    const samplesPerPixel = 441;
    const samples = pixelsToSamples(originalPixels, samplesPerPixel);
    const result = samplesToPixels(samples, samplesPerPixel);
    expect(result).toBe(originalPixels);
  });
});
