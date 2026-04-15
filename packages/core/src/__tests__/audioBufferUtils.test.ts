import { describe, it, expect } from 'vitest';
import { concatenateAudioData, calculateDuration } from '../utils/audioBufferUtils';

describe('concatenateAudioData', () => {
  it('concatenates multiple Float32Array chunks', () => {
    const chunk1 = new Float32Array([1, 2, 3]);
    const chunk2 = new Float32Array([4, 5]);
    const chunk3 = new Float32Array([6, 7, 8, 9]);

    const result = concatenateAudioData([chunk1, chunk2, chunk3]);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(9);
    expect(Array.from(result)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('returns a single chunk unchanged (by value)', () => {
    const chunk = new Float32Array([1, 2, 3]);
    const result = concatenateAudioData([chunk]);

    expect(result.length).toBe(3);
    expect(Array.from(result)).toEqual([1, 2, 3]);
  });

  it('returns empty Float32Array for empty array input', () => {
    const result = concatenateAudioData([]);

    expect(result).toBeInstanceOf(Float32Array);
    expect(result.length).toBe(0);
  });

  it('handles chunks of different sizes', () => {
    const chunk1 = new Float32Array([0.5]);
    const chunk2 = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
    const chunk3 = new Float32Array([0.9, 0.8]);

    const result = concatenateAudioData([chunk1, chunk2, chunk3]);

    expect(result.length).toBe(8);
    // Float32 has limited precision, so check each value with tolerance
    const expected = [0.5, 0.1, 0.2, 0.3, 0.4, 0.5, 0.9, 0.8];
    for (let i = 0; i < expected.length; i++) {
      expect(result[i]).toBeCloseTo(expected[i], 5);
    }
  });

  it('handles empty chunks interspersed', () => {
    const chunk1 = new Float32Array([1, 2]);
    const empty = new Float32Array(0);
    const chunk2 = new Float32Array([3, 4]);

    const result = concatenateAudioData([chunk1, empty, chunk2]);

    expect(result.length).toBe(4);
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });

  it('preserves floating-point precision', () => {
    const chunk = new Float32Array([0.123456789, -0.987654321]);
    const result = concatenateAudioData([chunk]);

    // Float32 has limited precision, so compare within Float32 tolerance
    expect(result[0]).toBeCloseTo(0.123456789, 5);
    expect(result[1]).toBeCloseTo(-0.987654321, 5);
  });
});

describe('calculateDuration', () => {
  it('calculates duration from sample count and sample rate', () => {
    expect(calculateDuration(44100, 44100)).toBe(1);
    expect(calculateDuration(88200, 44100)).toBe(2);
    expect(calculateDuration(22050, 44100)).toBe(0.5);
  });

  it('handles 48kHz sample rate', () => {
    expect(calculateDuration(48000, 48000)).toBe(1);
    expect(calculateDuration(96000, 48000)).toBe(2);
  });

  it('handles zero samples', () => {
    expect(calculateDuration(0, 44100)).toBe(0);
  });

  it('returns fractional durations', () => {
    // 1000 samples at 44100 Hz
    const duration = calculateDuration(1000, 44100);
    expect(duration).toBeCloseTo(0.02267573696, 8);
  });
});
