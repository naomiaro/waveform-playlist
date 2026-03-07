import { describe, it, expect } from 'vitest';
import { generatePeaks, appendPeaks } from '../utils/peaksGenerator';

describe('generatePeaks', () => {
  it('returns interleaved [min, max] pairs for exact multiple of samplesPerPixel', () => {
    // 8 samples, samplesPerPixel=4 => 2 peaks => 4 values
    const samples = new Float32Array([-0.5, 0.3, -0.1, 0.8, -0.9, 0.2, 0.0, 0.6]);
    const result = generatePeaks(samples, 4, 16);

    expect(result).toBeInstanceOf(Int16Array);
    expect(result.length).toBe(4); // 2 peaks * 2 (min + max)

    // Peak 0: samples [−0.5, 0.3, −0.1, 0.8] => min=−0.5, max=0.8
    const maxValue = 2 ** 15;
    expect(result[0]).toBe(Math.floor(-0.5 * maxValue)); // min
    expect(result[1]).toBe(Math.floor(0.8 * maxValue)); // max

    // Peak 1: samples [−0.9, 0.2, 0.0, 0.6] => min=−0.9, max=0.6
    expect(result[2]).toBe(Math.floor(-0.9 * maxValue));
    expect(result[3]).toBe(Math.floor(0.6 * maxValue));
  });

  it('handles partial peaks when samples not evenly divisible', () => {
    // 5 samples, samplesPerPixel=4 => ceil(5/4)=2 peaks
    const samples = new Float32Array([-0.2, 0.4, -0.1, 0.3, -0.7]);
    const result = generatePeaks(samples, 4, 16);

    expect(result.length).toBe(4); // 2 peaks * 2

    // Peak 1 only has 1 sample: [-0.7]
    const maxValue = 2 ** 15;
    expect(result[2]).toBe(Math.floor(-0.7 * maxValue));
    expect(result[3]).toBe(0); // max is 0 (initialized, -0.7 < 0)
  });

  it('returns Int8Array for 8-bit output', () => {
    const samples = new Float32Array([-0.5, 0.5, -0.25, 0.75]);
    const result = generatePeaks(samples, 4, 8);

    expect(result).toBeInstanceOf(Int8Array);
    expect(result.length).toBe(2); // 1 peak * 2

    const maxValue = 2 ** 7; // 128
    expect(result[0]).toBe(Math.floor(-0.5 * maxValue));
    expect(result[1]).toBe(Math.floor(0.75 * maxValue));
  });

  it('returns Int16Array for 16-bit output (default)', () => {
    const samples = new Float32Array([0.1, -0.1]);
    const result = generatePeaks(samples, 2);

    expect(result).toBeInstanceOf(Int16Array);
  });

  it('returns all zeros for silence', () => {
    const samples = new Float32Array(8); // initialized to 0
    const result = generatePeaks(samples, 4, 16);

    expect(result.length).toBe(4);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(0);
    }
  });

  it('handles full-scale signal (values at -1 and 1)', () => {
    const samples = new Float32Array([-1, 1, -1, 1]);
    const result = generatePeaks(samples, 4, 16);

    const maxValue = 2 ** 15; // 32768
    // min: Math.floor(-1 * 32768) = -32768 (valid Int16 min)
    expect(result[0]).toBe(-maxValue);
    // max: clamped to 32767 (Int16 max) instead of overflowing
    expect(result[1]).toBe(maxValue - 1);
  });

  it('produces correct interleaved format: [min0, max0, min1, max1, ...]', () => {
    const samples = new Float32Array([
      // Peak 0: all negative
      -0.3, -0.5, -0.1, -0.8,
      // Peak 1: all positive
      0.2, 0.9, 0.4, 0.1,
    ]);
    const result = generatePeaks(samples, 4, 16);
    const maxValue = 2 ** 15;

    // Peak 0: min=-0.8, max=0 (no positive values, max stays at init 0)
    expect(result[0]).toBe(Math.floor(-0.8 * maxValue));
    expect(result[1]).toBe(0);

    // Peak 1: min=0 (no negative values, min stays at init 0), max=0.9
    expect(result[2]).toBe(0);
    expect(result[3]).toBe(Math.floor(0.9 * maxValue));
  });

  it('handles single sample', () => {
    const samples = new Float32Array([0.5]);
    const result = generatePeaks(samples, 4, 16);

    // 1 peak (partial)
    expect(result.length).toBe(2);
    const maxValue = 2 ** 15;
    expect(result[0]).toBe(0); // min stays 0 since 0.5 > 0
    expect(result[1]).toBe(Math.floor(0.5 * maxValue));
  });

  it('handles empty input', () => {
    const samples = new Float32Array(0);
    const result = generatePeaks(samples, 4, 16);

    expect(result.length).toBe(0);
  });
});

describe('appendPeaks', () => {
  it('appends new peaks to existing peaks with no remainder', () => {
    // Existing: 2 peaks from 8 samples at spp=4
    const existing = generatePeaks(
      new Float32Array([-0.5, 0.3, -0.1, 0.8, -0.9, 0.2, 0.0, 0.6]),
      4,
      16
    );

    // New: 4 more samples (totalSamplesProcessed=8, no remainder)
    const newSamples = new Float32Array([-0.2, 0.7, -0.4, 0.1]);
    const result = appendPeaks(existing, newSamples, 4, 8, 16);

    // Should have 3 peaks total (2 existing + 1 new)
    expect(result.length).toBe(6);

    // First 4 values should match existing
    expect(result[0]).toBe(existing[0]);
    expect(result[1]).toBe(existing[1]);
    expect(result[2]).toBe(existing[2]);
    expect(result[3]).toBe(existing[3]);

    // Last 2 values should be the new peak
    const maxValue = 2 ** 15;
    expect(result[4]).toBe(Math.floor(-0.4 * maxValue));
    expect(result[5]).toBe(Math.floor(0.7 * maxValue));
  });

  it('handles remainder samples from previous call', () => {
    // Process 6 samples at spp=4: 1 full peak + partial (2 remainder samples)
    const firstBatch = new Float32Array([-0.3, 0.5, -0.1, 0.2, -0.4, 0.6]);
    const existing = generatePeaks(firstBatch, 4, 16);
    // existing has 2 peaks: peak0 from [−0.3, 0.5, −0.1, 0.2], peak1 from [−0.4, 0.6]

    // Now append 2 more samples to complete the partial peak
    const newSamples = new Float32Array([0.8, -0.9]);
    const totalProcessed = 6; // remainder = 6 % 4 = 2
    const result = appendPeaks(existing, newSamples, 4, totalProcessed, 16);

    // Still 2 peaks, but peak1 is now updated with all 4 samples: [-0.4, 0.6, 0.8, -0.9]
    expect(result.length).toBe(4);

    const maxValue = 2 ** 15;
    // Peak 1 should reflect min=-0.9, max=0.8
    expect(result[2]).toBe(Math.floor(-0.9 * maxValue));
    expect(result[3]).toBe(Math.floor(0.8 * maxValue));
  });

  it('maintains bit depth consistency with 8-bit', () => {
    const existing = generatePeaks(new Float32Array([-0.5, 0.5, -0.3, 0.3]), 4, 8);
    const newSamples = new Float32Array([0.1, -0.1, 0.2, -0.2]);
    const result = appendPeaks(existing, newSamples, 4, 4, 8);

    expect(result).toBeInstanceOf(Int8Array);
    expect(result.length).toBe(4); // 2 peaks
  });

  it('appends to empty existing peaks', () => {
    const existing = new Int16Array(0);
    const newSamples = new Float32Array([-0.5, 0.5, -0.3, 0.3]);
    const result = appendPeaks(existing, newSamples, 4, 0, 16);

    // Should be same as generating fresh
    const fresh = generatePeaks(newSamples, 4, 16);
    expect(result.length).toBe(fresh.length);
    for (let i = 0; i < result.length; i++) {
      expect(result[i]).toBe(fresh[i]);
    }
  });

  it('handles remainder with more new samples than needed to complete partial', () => {
    // 5 samples at spp=4: 1 full peak + partial (1 remainder sample)
    const firstBatch = new Float32Array([-0.2, 0.3, 0.1, -0.4, 0.5]);
    const existing = generatePeaks(firstBatch, 4, 16);
    // existing: 2 peaks

    // Append 7 more samples (3 to complete partial + 4 for a new peak)
    const newSamples = new Float32Array([-0.1, 0.2, -0.6, 0.9, -0.3, 0.1, 0.4]);
    const totalProcessed = 5; // remainder = 5 % 4 = 1
    const result = appendPeaks(existing, newSamples, 4, totalProcessed, 16);

    // Peak 0: original (unchanged)
    // Peak 1: updated partial [0.5, -0.1, 0.2, -0.6] (completed)
    // Peak 2: new [0.9, -0.3, 0.1, 0.4]
    expect(result.length).toBe(6); // 3 peaks * 2

    const maxValue = 2 ** 15;
    // Peak 1: min=-0.6, max=0.5
    expect(result[2]).toBe(Math.floor(-0.6 * maxValue));
    expect(result[3]).toBe(Math.floor(0.5 * maxValue));

    // Peak 2: min=-0.3, max=0.9
    expect(result[4]).toBe(Math.floor(-0.3 * maxValue));
    expect(result[5]).toBe(Math.floor(0.9 * maxValue));
  });
});
