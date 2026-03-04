import { describe, it, expect } from 'vitest';
import WaveformData from 'waveform-data';
import {
  extractPeaksFromWaveformData,
  extractPeaksFromWaveformDataFull,
} from '../waveformDataLoader';

/**
 * Creates a WaveformData instance from interleaved min/max pairs.
 * Each pair represents one peak bin at the given scale.
 */
function makeWaveformData(
  pairs: [min: number, max: number][],
  options: { scale?: number; sampleRate?: number; bits?: 8 | 16 } = {}
): WaveformData {
  const { scale = 256, sampleRate = 44100, bits = 16 } = options;
  const data = pairs.flatMap(([min, max]) => [min, max]);

  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: sampleRate,
    samples_per_pixel: scale,
    bits,
    length: pairs.length,
    data,
  });
}

describe('extractPeaksFromWaveformData', () => {
  describe('aligned resampling', () => {
    it('produces consistent peaks for integer ratio (256 → 1024)', () => {
      // 8 source bins at scale 256, resample to 1024 (ratio = 4)
      const pairs: [number, number][] = [
        [-100, 200],
        [-300, 150],
        [-50, 400],
        [-200, 100],
        [-10, 20],
        [-30, 15],
        [-5, 40],
        [-20, 10],
      ];
      const wd = makeWaveformData(pairs, { scale: 256 });

      // Full file resample
      const full = extractPeaksFromWaveformData(wd, 1024);

      // Clip resample with offset 0 (should match full file)
      const clip = extractPeaksFromWaveformData(
        wd,
        1024,
        0,
        0,
        8 * 256 // full duration in samples
      );

      expect(clip.length).toBe(full.length);
      for (let i = 0; i < clip.length * 2; i++) {
        expect(clip.data[i]).toBe(full.data[i]);
      }
    });

    it('produces consistent peaks for clip with non-zero offset (integer ratio)', () => {
      // 12 source bins at scale 256, resample to 512 (ratio = 2)
      const pairs: [number, number][] = Array.from({ length: 12 }, (_, i) => [
        -(i * 100 + 50),
        i * 100 + 50,
      ]);
      const wd = makeWaveformData(pairs, { scale: 256 });

      // Full file resample then manually check offset region
      const full = extractPeaksFromWaveformData(wd, 512);

      // Clip starting at sample offset 1024 (= 4 source bins), duration = 4 source bins
      const clip = extractPeaksFromWaveformData(wd, 512, 0, 1024, 1024);

      // Clip should match the corresponding region of the full resample
      // offset 1024 at scale 512 → target bin 2
      expect(clip.length).toBeGreaterThan(0);
      for (let i = 0; i < clip.length * 2; i++) {
        expect(clip.data[i]).toBe(full.data[i + 4]); // target bin 2 = array index 4
      }
    });

    it('handles non-integer ratio (256 → 1000)', () => {
      // 20 source bins at scale 256
      const pairs: [number, number][] = Array.from({ length: 20 }, (_, i) => [
        -(i * 50 + 10),
        i * 50 + 10,
      ]);
      const wd = makeWaveformData(pairs, { scale: 256 });

      // Resample to scale 1000 (ratio = 3.90625)
      const result = extractPeaksFromWaveformData(
        wd,
        1000,
        0,
        0,
        20 * 256 // full duration
      );

      // Should produce valid output without errors
      expect(result.length).toBeGreaterThan(0);
      expect(result.bits).toBe(16);
      // Verify no NaN or undefined values in output
      for (let i = 0; i < result.length * 2; i++) {
        expect(Number.isFinite(result.data[i])).toBe(true);
      }
    });

    it('returns empty peaks when offset is beyond waveform data', () => {
      const wd = makeWaveformData(
        [
          [-100, 100],
          [-200, 200],
        ],
        { scale: 256 }
      );

      // Offset way past the data
      const result = extractPeaksFromWaveformData(
        wd,
        1024,
        0,
        1000000, // far beyond 2 * 256 = 512 samples of data
        256
      );

      expect(result.length).toBe(0);
      expect(result.data.length).toBe(0);
    });

    it('preserves 8-bit depth through resampling', () => {
      const pairs: [number, number][] = [
        [-64, 64],
        [-32, 96],
        [-80, 40],
        [-16, 120],
      ];
      const wd = makeWaveformData(pairs, { scale: 256, bits: 8 });

      const result = extractPeaksFromWaveformData(wd, 512, 0, 0, 4 * 256);

      expect(result.bits).toBe(8);
      expect(result.data).toBeInstanceOf(Int8Array);
    });

    it('handles non-integer ratio with non-zero offset (256 → 1000)', () => {
      // 40 source bins at scale 256, resample to 1000 (ratio = 3.90625)
      // This tests the floor/ceil alignment strategy for non-integer ratios
      const pairs: [number, number][] = Array.from({ length: 40 }, (_, i) => [
        -(i * 30 + 10),
        i * 30 + 10,
      ]);
      const wd = makeWaveformData(pairs, { scale: 256 });

      // Clip starting at sample offset 2560 (= 10 source bins), duration = 20 source bins
      const result = extractPeaksFromWaveformData(wd, 1000, 0, 2560, 5120);

      // Should produce valid output without errors
      expect(result.length).toBeGreaterThan(0);
      expect(result.bits).toBe(16);
      // Verify no NaN or undefined values in output
      for (let i = 0; i < result.length * 2; i++) {
        expect(Number.isFinite(result.data[i])).toBe(true);
      }
    });

    it('slices without resampling when scales match', () => {
      const pairs: [number, number][] = [
        [-100, 100],
        [-200, 200],
        [-300, 300],
        [-400, 400],
      ];
      const wd = makeWaveformData(pairs, { scale: 256 });

      // Same scale — just slice
      const result = extractPeaksFromWaveformData(wd, 256, 0, 256, 512);

      // Offset 256 at scale 256 = bin 1, duration 512 = 2 bins
      expect(result.length).toBe(2);
      expect(result.data[0]).toBe(-200); // min of bin 1
      expect(result.data[1]).toBe(200); // max of bin 1
      expect(result.data[2]).toBe(-300); // min of bin 2
      expect(result.data[3]).toBe(300); // max of bin 2
    });
  });
});

/**
 * Creates a stereo WaveformData instance from per-channel min/max pairs.
 * Multi-channel data is interleaved per bin: [ch0_min, ch0_max, ch1_min, ch1_max, ...]
 */
function makeStereoWaveformData(
  ch0Pairs: [min: number, max: number][],
  ch1Pairs: [min: number, max: number][],
  options: { scale?: number; sampleRate?: number; bits?: 8 | 16 } = {}
): WaveformData {
  const { scale = 256, sampleRate = 44100, bits = 16 } = options;
  const data: number[] = [];

  for (let i = 0; i < ch0Pairs.length; i++) {
    data.push(ch0Pairs[i][0], ch0Pairs[i][1], ch1Pairs[i][0], ch1Pairs[i][1]);
  }

  return WaveformData.create({
    version: 2,
    channels: 2,
    sample_rate: sampleRate,
    samples_per_pixel: scale,
    bits,
    length: ch0Pairs.length,
    data,
  });
}

describe('extractPeaksFromWaveformDataFull', () => {
  it('returns empty data when offset is beyond waveform data', () => {
    const wd = makeWaveformData(
      [
        [-100, 100],
        [-200, 200],
      ],
      { scale: 256 }
    );

    const result = extractPeaksFromWaveformDataFull(wd, 1024, false, 1000000, 256);

    expect(result.length).toBe(0);
    expect(result.data).toEqual([]);
  });

  it('produces consistent multi-channel peaks with aligned resampling', () => {
    // Full-file resample vs clip resample should match for integer ratios
    const pairs: [number, number][] = Array.from({ length: 8 }, (_, i) => [
      -(i * 100 + 50),
      i * 100 + 50,
    ]);
    const wd = makeWaveformData(pairs, { scale: 256 });

    const full = extractPeaksFromWaveformDataFull(wd, 1024, false);
    const clip = extractPeaksFromWaveformDataFull(wd, 1024, false, 0, 8 * 256);

    expect(clip.length).toBe(full.length);
    expect(clip.data.length).toBe(full.data.length);
    for (let ch = 0; ch < clip.data.length; ch++) {
      for (let i = 0; i < clip.data[ch].length; i++) {
        expect(clip.data[ch][i]).toBe(full.data[ch][i]);
      }
    }
  });

  it('merges stereo channels to mono using weighted averaging', () => {
    // Two channels with known values — mono merge should average them
    const ch0: [number, number][] = [
      [-200, 100],
      [-400, 300],
    ];
    const ch1: [number, number][] = [
      [-100, 200],
      [-300, 400],
    ];
    const wd = makeStereoWaveformData(ch0, ch1, { scale: 256 });

    const result = extractPeaksFromWaveformDataFull(wd, 256, true);

    expect(result.length).toBe(2);
    expect(result.data.length).toBe(1); // mono = single channel

    // Weighted average: weight = 1/2
    // Bin 0: min = (-200 + -100) / 2 = -150, max = (100 + 200) / 2 = 150
    // Bin 1: min = (-400 + -300) / 2 = -350, max = (300 + 400) / 2 = 350
    expect(result.data[0][0]).toBe(-150); // bin 0 min
    expect(result.data[0][1]).toBe(150); // bin 0 max
    expect(result.data[0][2]).toBe(-350); // bin 1 min
    expect(result.data[0][3]).toBe(350); // bin 1 max
  });

  it('handles non-integer ratio with non-zero offset', () => {
    // 40 source bins at scale 256, resample to 1000 (ratio = 3.90625)
    const pairs: [number, number][] = Array.from({ length: 40 }, (_, i) => [
      -(i * 30 + 10),
      i * 30 + 10,
    ]);
    const wd = makeWaveformData(pairs, { scale: 256 });

    // Clip starting at sample offset 2560, duration = 5120 samples
    const result = extractPeaksFromWaveformDataFull(wd, 1000, false, 2560, 5120);

    expect(result.length).toBeGreaterThan(0);
    expect(result.bits).toBe(16);
    // Verify all values are finite
    for (let ch = 0; ch < result.data.length; ch++) {
      for (let i = 0; i < result.data[ch].length; i++) {
        expect(Number.isFinite(result.data[ch][i])).toBe(true);
      }
    }
  });
});
