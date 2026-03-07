import { describe, it, expect } from 'vitest';
import extractPeaksFromBuffer, {
  findMinMax,
  convert,
  makeTypedArray,
  extractPeaks,
  makeMono,
} from '../index';

// ============================================================
// findMinMax
// ============================================================
describe('findMinMax', () => {
  it('should return 0 for both min and max with all-zero array', () => {
    const arr = new Float32Array([0, 0, 0]);
    expect(findMinMax(arr)).toEqual({ min: 0, max: 0 });
  });

  it('should handle all positive values', () => {
    const arr = new Float32Array([0.1, 0.5, 0.3, 0.9]);
    const result = findMinMax(arr);
    expect(result.min).toBeCloseTo(0.1);
    expect(result.max).toBeCloseTo(0.9);
  });

  it('should handle all negative values', () => {
    const arr = new Float32Array([-0.8, -0.2, -0.5]);
    const result = findMinMax(arr);
    expect(result.min).toBeCloseTo(-0.8);
    expect(result.max).toBeCloseTo(-0.2);
  });

  it('should handle mixed positive and negative values', () => {
    const arr = new Float32Array([-0.7, 0.3, -0.1, 0.8]);
    const result = findMinMax(arr);
    expect(result.min).toBeCloseTo(-0.7);
    expect(result.max).toBeCloseTo(0.8);
  });

  it('should handle a single sample', () => {
    const arr = new Float32Array([0.42]);
    const result = findMinMax(arr);
    expect(result.min).toBeCloseTo(0.42);
    expect(result.max).toBeCloseTo(0.42);
    expect(result.min).toBe(result.max);
  });

  it('should return Infinity/-Infinity for empty array', () => {
    const arr = new Float32Array(0);
    expect(findMinMax(arr)).toEqual({ min: Infinity, max: -Infinity });
  });
});

// ============================================================
// convert
// ============================================================
describe('convert', () => {
  describe('8-bit', () => {
    // 8-bit: maxValue = 128, range is [-128, 127]
    it('should convert 0 to 0', () => {
      expect(convert(0, 8)).toBe(0);
    });

    it('should convert positive 1.0 to 127', () => {
      expect(convert(1.0, 8)).toBe(127);
    });

    it('should convert negative -1.0 to -128', () => {
      expect(convert(-1.0, 8)).toBe(-128);
    });

    it('should convert 0.5 to 63 (positive uses maxValue-1)', () => {
      // 0.5 * (128 - 1) = 63.5, clamped
      expect(convert(0.5, 8)).toBe(63.5);
    });

    it('should convert -0.5 to -64 (negative uses maxValue)', () => {
      // -0.5 * 128 = -64
      expect(convert(-0.5, 8)).toBe(-64);
    });
  });

  describe('16-bit', () => {
    // 16-bit: maxValue = 32768, range is [-32768, 32767]
    it('should convert 0 to 0', () => {
      expect(convert(0, 16)).toBe(0);
    });

    it('should convert positive 1.0 to 32767', () => {
      expect(convert(1.0, 16)).toBe(32767);
    });

    it('should convert negative -1.0 to -32768', () => {
      expect(convert(-1.0, 16)).toBe(-32768);
    });

    it('should clamp values exceeding positive range', () => {
      // Values > 1.0 should be clamped to 32767
      expect(convert(1.5, 16)).toBe(32767);
    });

    it('should clamp values exceeding negative range', () => {
      // Values < -1.0 should be clamped to -32768
      expect(convert(-1.5, 16)).toBe(-32768);
    });
  });
});

// ============================================================
// makeTypedArray
// ============================================================
describe('makeTypedArray', () => {
  it('should create Int8Array for 8 bits', () => {
    const arr = makeTypedArray(8, 10);
    expect(arr).toBeInstanceOf(Int8Array);
    expect(arr.length).toBe(10);
  });

  it('should create Int16Array for 16 bits', () => {
    const arr = makeTypedArray(16, 20);
    expect(arr).toBeInstanceOf(Int16Array);
    expect(arr.length).toBe(20);
  });

  it('should initialize all values to zero', () => {
    const arr = makeTypedArray(16, 5);
    for (let i = 0; i < arr.length; i++) {
      expect(arr[i]).toBe(0);
    }
  });
});

// ============================================================
// extractPeaks
// ============================================================
describe('extractPeaks', () => {
  it('should produce interleaved [min, max] format', () => {
    // 4 samples, 2 samples per pixel => 2 peaks => 4 values in output
    const channel = new Float32Array([0.5, -0.3, 0.2, -0.8]);
    const peaks = extractPeaks(channel, 2, 16);

    expect(peaks.length).toBe(4); // 2 peaks * 2 (min + max)

    // First pixel: samples [0.5, -0.3] => min=-0.3, max=0.5
    // Second pixel: samples [0.2, -0.8] => min=-0.8, max=0.2
    // Check min is at even indices, max at odd indices
    expect(peaks[0]).toBeLessThan(0); // min of first segment
    expect(peaks[1]).toBeGreaterThan(0); // max of first segment
    expect(peaks[2]).toBeLessThan(0); // min of second segment
    expect(peaks[3]).toBeGreaterThan(0); // max of second segment
  });

  it('should handle exact divisibility (samples % samplesPerPixel == 0)', () => {
    const channel = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
    const peaks = extractPeaks(channel, 3, 16);

    // 6 samples / 3 spp = 2 peaks => 4 values
    expect(peaks.length).toBe(4);
  });

  it('should handle partial final peak (samples not evenly divisible)', () => {
    const channel = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5]);
    const peaks = extractPeaks(channel, 3, 16);

    // 5 samples / 3 spp = ceil(5/3) = 2 peaks => 4 values
    expect(peaks.length).toBe(4);
  });

  it('should return Int8Array for 8-bit', () => {
    const channel = new Float32Array([0.5, -0.5]);
    const peaks = extractPeaks(channel, 1, 8);
    expect(peaks).toBeInstanceOf(Int8Array);
  });

  it('should return Int16Array for 16-bit', () => {
    const channel = new Float32Array([0.5, -0.5]);
    const peaks = extractPeaks(channel, 1, 16);
    expect(peaks).toBeInstanceOf(Int16Array);
  });

  it('should produce correct values for 1 sample per pixel', () => {
    // Each sample becomes its own peak, min == max
    const channel = new Float32Array([0.5]);
    const peaks = extractPeaks(channel, 1, 16);

    expect(peaks.length).toBe(2);
    // min and max should be the same value (converted)
    expect(peaks[0]).toBe(peaks[1]);
    // 0.5 * 32767 = 16383.5, stored as Int16
    expect(peaks[0]).toBe(16383);
  });

  it('should handle silence (all zeros)', () => {
    const channel = new Float32Array([0, 0, 0, 0]);
    const peaks = extractPeaks(channel, 2, 16);

    expect(peaks.length).toBe(4);
    for (let i = 0; i < peaks.length; i++) {
      expect(peaks[i]).toBe(0);
    }
  });
});

// ============================================================
// makeMono
// ============================================================
describe('makeMono', () => {
  it('should average stereo peaks into mono', () => {
    // 2 peaks each channel, interleaved [min, max, min, max]
    const ch1 = new Int16Array([100, 200, -50, 150]);
    const ch2 = new Int16Array([200, 400, -150, 250]);
    const result = makeMono([ch1, ch2], 16);

    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(4);

    // Average: (100+200)/2=150, (200+400)/2=300, etc.
    expect(result[0][0]).toBe(150);
    expect(result[0][1]).toBe(300);
    expect(result[0][2]).toBe(-100);
    expect(result[0][3]).toBe(200);
  });

  it('should handle multi-channel (3 channels)', () => {
    const ch1 = new Int16Array([300, 600]);
    const ch2 = new Int16Array([600, 900]);
    const ch3 = new Int16Array([900, 300]);
    const result = makeMono([ch1, ch2, ch3], 16);

    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(2);

    // Average: (300+600+900)/3=600, (600+900+300)/3=600
    expect(result[0][0]).toBe(600);
    expect(result[0][1]).toBe(600);
  });

  it('should return single channel identity (values unchanged)', () => {
    const ch1 = new Int16Array([100, 200, -50, 150]);
    const result = makeMono([ch1], 16);

    expect(result).toHaveLength(1);
    expect(result[0].length).toBe(4);
    // weight = 1/1 = 1, so values are identical
    expect(result[0][0]).toBe(100);
    expect(result[0][1]).toBe(200);
    expect(result[0][2]).toBe(-50);
    expect(result[0][3]).toBe(150);
  });

  it('should return Int8Array when bits is 8', () => {
    const ch1 = new Int8Array([10, 20]);
    const ch2 = new Int8Array([30, 40]);
    const result = makeMono([ch1, ch2], 8);

    expect(result[0]).toBeInstanceOf(Int8Array);
  });
});

// ============================================================
// extractPeaksFromBuffer (public API)
// ============================================================
describe('extractPeaksFromBuffer', () => {
  describe('with Float32Array input', () => {
    it('should return PeakData with correct structure', () => {
      const source = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const result = extractPeaksFromBuffer(source, 3);

      expect(result).toHaveProperty('length');
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('bits');
      expect(result.bits).toBe(16);
      // 6 samples / 3 spp = 2 peaks
      expect(result.length).toBe(2);
      expect(result.data).toHaveLength(1); // single channel
    });

    it('should use default parameters', () => {
      const source = new Float32Array(3000);
      const result = extractPeaksFromBuffer(source);

      // Default samplesPerPixel=1000, so 3000/1000=3 peaks
      expect(result.length).toBe(3);
      expect(result.bits).toBe(16);
      expect(result.data).toHaveLength(1);
    });

    it('should respect cueIn parameter', () => {
      const source = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const result = extractPeaksFromBuffer(source, 2, true, 2);

      // Sliced from index 2: [0.3, 0.4, 0.5, 0.6] => 4 samples / 2 spp = 2 peaks
      expect(result.length).toBe(2);
    });

    it('should respect cueOut parameter', () => {
      const source = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const result = extractPeaksFromBuffer(source, 2, true, 0, 4);

      // Sliced to index 4: [0.1, 0.2, 0.3, 0.4] => 4 samples / 2 spp = 2 peaks
      expect(result.length).toBe(2);
    });

    it('should respect cueIn and cueOut together', () => {
      const source = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const result = extractPeaksFromBuffer(source, 1, true, 1, 3);

      // Sliced [1,3): [0.2, 0.3] => 2 samples / 1 spp = 2 peaks
      expect(result.length).toBe(2);
    });

    it('should support 8-bit output', () => {
      const source = new Float32Array([0.5, -0.5]);
      const result = extractPeaksFromBuffer(source, 1, true, 0, undefined, 8);

      expect(result.bits).toBe(8);
      expect(result.data[0]).toBeInstanceOf(Int8Array);
    });
  });

  describe('with AudioBuffer input', () => {
    function createMockAudioBuffer(channels: Float32Array[]): AudioBuffer {
      return {
        numberOfChannels: channels.length,
        length: channels[0].length,
        getChannelData: (c: number) => channels[c],
        sampleRate: 44100,
        duration: channels[0].length / 44100,
      } as unknown as AudioBuffer;
    }

    it('should extract peaks from single-channel AudioBuffer', () => {
      const channelData = new Float32Array([0.1, 0.2, 0.3, 0.4]);
      const buffer = createMockAudioBuffer([channelData]);
      const result = extractPeaksFromBuffer(buffer, 2);

      expect(result.length).toBe(2);
      expect(result.data).toHaveLength(1);
    });

    it('should merge stereo to mono by default (isMono=true)', () => {
      const ch1 = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const ch2 = new Float32Array([-0.5, -0.5, -0.5, -0.5]);
      const buffer = createMockAudioBuffer([ch1, ch2]);
      const result = extractPeaksFromBuffer(buffer, 2, true);

      // isMono=true with 2 channels => merged to 1
      expect(result.data).toHaveLength(1);
    });

    it('should keep separate channels when isMono=false', () => {
      const ch1 = new Float32Array([0.5, 0.5, 0.5, 0.5]);
      const ch2 = new Float32Array([-0.5, -0.5, -0.5, -0.5]);
      const buffer = createMockAudioBuffer([ch1, ch2]);
      const result = extractPeaksFromBuffer(buffer, 2, false);

      // isMono=false => 2 separate channels
      expect(result.data).toHaveLength(2);
    });

    it('should not merge single channel even when isMono=true', () => {
      const ch1 = new Float32Array([0.5, -0.5]);
      const buffer = createMockAudioBuffer([ch1]);
      const result = extractPeaksFromBuffer(buffer, 1, true);

      // Only 1 channel, so makeMono is not called
      expect(result.data).toHaveLength(1);
    });

    it('should respect cueIn/cueOut with AudioBuffer', () => {
      const channelData = new Float32Array([0.1, 0.2, 0.3, 0.4, 0.5, 0.6]);
      const buffer = createMockAudioBuffer([channelData]);
      const result = extractPeaksFromBuffer(buffer, 2, true, 2, 6);

      // Sliced [2,6): [0.3, 0.4, 0.5, 0.6] => 4 samples / 2 spp = 2 peaks
      expect(result.length).toBe(2);
    });
  });

  describe('error handling', () => {
    it('should throw for invalid bits value', () => {
      const source = new Float32Array([0.1]);
      // @ts-expect-error testing invalid bits
      expect(() => extractPeaksFromBuffer(source, 1, true, 0, undefined, 12)).toThrow(
        'Invalid number of bits specified for peaks. Must be 8 or 16.'
      );
    });
  });

  describe('peak value correctness', () => {
    it('should produce correct 16-bit peak values for known input', () => {
      // Single peak from 2 samples: min=-0.5, max=0.5
      const source = new Float32Array([0.5, -0.5]);
      const result = extractPeaksFromBuffer(source, 2, true, 0, undefined, 16);

      expect(result.length).toBe(1);
      const peaks = result.data[0];
      // min: convert(-0.5, 16) = -0.5 * 32768 = -16384
      // max: convert(0.5, 16) = 0.5 * 32767 = 16383.5 => stored as 16383 in Int16
      expect(peaks[0]).toBe(-16384);
      expect(peaks[1]).toBe(16383);
    });

    it('should produce correct 8-bit peak values for known input', () => {
      const source = new Float32Array([1.0, -1.0]);
      const result = extractPeaksFromBuffer(source, 2, true, 0, undefined, 8);

      expect(result.length).toBe(1);
      const peaks = result.data[0];
      // min: convert(-1.0, 8) = -1.0 * 128 = -128
      // max: convert(1.0, 8) = 1.0 * 127 = 127
      expect(peaks[0]).toBe(-128);
      expect(peaks[1]).toBe(127);
    });

    it('should correctly average stereo peaks to mono', () => {
      // ch1: [1.0, 1.0], ch2: [0.0, 0.0]
      // ch1 peak: min=1.0, max=1.0 => convert(1.0, 16) = 32767 for both
      // ch2 peak: min=0, max=0 => 0 for both
      // mono average: min = (32767+0)/2 = 16383.5 => Int16 => 16383
      //               max = (32767+0)/2 = 16383.5 => Int16 => 16383
      const ch1 = new Float32Array([1.0, 1.0]);
      const ch2 = new Float32Array([0.0, 0.0]);
      const buffer = {
        numberOfChannels: 2,
        length: 2,
        getChannelData: (c: number) => (c === 0 ? ch1 : ch2),
        sampleRate: 44100,
        duration: 2 / 44100,
      } as unknown as AudioBuffer;

      const result = extractPeaksFromBuffer(buffer, 2, true, 0, undefined, 16);

      expect(result.data).toHaveLength(1);
      expect(result.length).toBe(1);
      // Both min and max should be the averaged value
      expect(result.data[0][0]).toBe(16383);
      expect(result.data[0][1]).toBe(16383);
    });
  });
});
