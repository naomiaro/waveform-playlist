import { describe, it, expect, vi } from 'vitest';

// Mock the worker
vi.mock('../workers/peaksWorker', () => ({
  createPeaksWorker: vi.fn(() => ({
    generate: vi.fn(() =>
      Promise.resolve({
        scale: 128,
        bits: 16,
        channels: 1,
        length: 100,
        duration: 1.0,
        sample_rate: 48000,
        channel: (_ch: number) => ({
          min_array: () => new Int16Array(100).fill(-100),
          max_array: () => new Int16Array(100).fill(100),
        }),
        resample: vi.fn(function (this: any, opts: any) {
          // Return a mock resampled WaveformData
          const ratio = opts.scale / this.scale;
          const newLength = Math.ceil(this.length / ratio);
          return {
            scale: opts.scale,
            bits: this.bits,
            channels: this.channels,
            length: newLength,
            duration: this.duration,
            sample_rate: this.sample_rate,
            channel: (_ch: number) => ({
              min_array: () => new Int16Array(newLength).fill(-100),
              max_array: () => new Int16Array(newLength).fill(100),
            }),
            resample: vi.fn(),
            slice: vi.fn(),
          };
        }),
        slice: vi.fn(function (this: any, start: number, end: number) {
          const sliceLen = end - start;
          return {
            ...this,
            length: sliceLen,
            channel: (_ch: number) => ({
              min_array: () => new Int16Array(sliceLen).fill(-100),
              max_array: () => new Int16Array(sliceLen).fill(100),
            }),
            resample: this.resample.bind({ ...this, length: sliceLen }),
          };
        }),
      })
    ),
    terminate: vi.fn(),
  })),
}));

import { PeakPipeline } from '../workers/peakPipeline';

function makeBuffer(length = 48000): AudioBuffer {
  return {
    length,
    duration: length / 48000,
    sampleRate: 48000,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(length),
  } as any;
}

function makeWaveformData(scale: number, length = 50): any {
  return {
    scale,
    bits: 16,
    channels: 1,
    length,
    duration: 1.0,
    sample_rate: 48000,
    channel: (_ch: number) => ({
      min_array: () => new Int16Array(length).fill(-80),
      max_array: () => new Int16Array(length).fill(80),
    }),
    resample: vi.fn(function (this: any, opts: any) {
      const ratio = opts.scale / this.scale;
      const newLength = Math.ceil(this.length / ratio);
      return {
        scale: opts.scale,
        bits: this.bits,
        channels: this.channels,
        length: newLength,
        duration: this.duration,
        sample_rate: this.sample_rate,
        channel: (_ch: number) => ({
          min_array: () => new Int16Array(newLength).fill(-80),
          max_array: () => new Int16Array(newLength).fill(80),
        }),
        resample: vi.fn(),
        slice: vi.fn(),
      };
    }),
    slice: vi.fn(),
  };
}

describe('PeakPipeline', () => {
  it('defaults baseScale to 128 and bits to 16', () => {
    const pipeline = new PeakPipeline();
    // Access private fields via any for testing
    expect((pipeline as any)._baseScale).toBe(128);
    expect((pipeline as any)._bits).toBe(16);
  });

  it('accepts custom baseScale and bits', () => {
    const pipeline = new PeakPipeline(256, 8);
    expect((pipeline as any)._baseScale).toBe(256);
    expect((pipeline as any)._bits).toBe(8);
  });

  it('generatePeaks returns PeakData with correct structure', async () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();
    const result = await pipeline.generatePeaks(buf, 1024, false);

    expect(result).toHaveProperty('data');
    expect(result).toHaveProperty('length');
    expect(result).toHaveProperty('bits');
    expect(result.data).toBeInstanceOf(Array);
    expect(result.data.length).toBeGreaterThan(0);
  });

  it('generatePeaks caches WaveformData for reuse', async () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();

    await pipeline.generatePeaks(buf, 1024, false);
    // Second call at different zoom should use cache (no new worker call)
    await pipeline.generatePeaks(buf, 2048, false);
  });

  it('reextractPeaks returns peaks for cached buffers', async () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();

    // First generate to populate cache
    await pipeline.generatePeaks(buf, 1024, false);

    // Re-extract at different zoom
    const clipBuffers = new Map([['clip-1', buf]]);
    const result = pipeline.reextractPeaks(clipBuffers, 2048, false);

    expect(result.size).toBe(1);
    expect(result.has('clip-1')).toBe(true);
    expect(result.get('clip-1')!.data.length).toBeGreaterThan(0);
  });

  it('reextractPeaks passes clip offsets to extractPeaks', async () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();

    await pipeline.generatePeaks(buf, 1024, false);

    const clipBuffers = new Map([['clip-1', buf]]);
    const clipOffsets = new Map([['clip-1', { offsetSamples: 4800, durationSamples: 24000 }]]);

    const result = pipeline.reextractPeaks(clipBuffers, 1024, false, clipOffsets);
    expect(result.size).toBe(1);
    // Peaks should be shorter than full buffer (offset + duration subset)
    const fullResult = pipeline.reextractPeaks(clipBuffers, 1024, false);
    expect(result.get('clip-1')!.length).toBeLessThanOrEqual(fullResult.get('clip-1')!.length);
  });

  it('reextractPeaks returns empty map for uncached buffers', () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();
    const clipBuffers = new Map([['clip-1', buf]]);

    const result = pipeline.reextractPeaks(clipBuffers, 1024, false);
    expect(result.size).toBe(0);
  });

  it('reextractPeaks clamps to cached scale when requested scale is finer', async () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();

    await pipeline.generatePeaks(buf, 1024, false);
    // Mock returns scale: 128. Requesting 64 (finer) should clamp to 128 and warn.
    const clipBuffers = new Map([['clip-1', buf]]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = pipeline.reextractPeaks(clipBuffers, 64, false);
    expect(result.size).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('finer than pre-computed peaks')
    );
    warnSpy.mockRestore();
  });

  it('reextractPeaks logs single summary warning for multiple clamped clips', async () => {
    const pipeline = new PeakPipeline();
    const buf1 = makeBuffer();
    const buf2 = makeBuffer(24000);

    await pipeline.generatePeaks(buf1, 1024, false);
    await pipeline.generatePeaks(buf2, 1024, false);

    const clipBuffers = new Map([
      ['clip-1', buf1],
      ['clip-2', buf2],
    ]);
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pipeline.reextractPeaks(clipBuffers, 64, false);
    // Should log exactly once with count, not once per clip
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('2 clip(s)'));
    warnSpy.mockRestore();
  });

  it('generatePeaks clamps when cached WaveformData scale is coarser than requested', async () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();

    // Inject .dat-style cache at scale 256
    pipeline.cacheWaveformData(buf, makeWaveformData(256));

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    // Request finer zoom (128) — should clamp to 256 and warn
    const result = await pipeline.generatePeaks(buf, 128, false);
    expect(result.data.length).toBeGreaterThan(0);
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('finer than pre-computed peaks')
    );
    warnSpy.mockRestore();
  });

  it('getMaxCachedScale returns coarsest scale from cached entries', () => {
    const pipeline = new PeakPipeline();
    const buf1 = makeBuffer();
    const buf2 = makeBuffer(24000);

    pipeline.cacheWaveformData(buf1, makeWaveformData(256));
    pipeline.cacheWaveformData(buf2, makeWaveformData(512));

    const clipBuffers = new Map([
      ['clip-1', buf1],
      ['clip-2', buf2],
    ]);
    expect(pipeline.getMaxCachedScale(clipBuffers)).toBe(512);
  });

  it('getMaxCachedScale returns 0 when nothing is cached', () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();
    const clipBuffers = new Map([['clip-1', buf]]);
    expect(pipeline.getMaxCachedScale(clipBuffers)).toBe(0);
  });

  it('cacheWaveformData injects external WaveformData and skips worker', async () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();

    pipeline.cacheWaveformData(buf, makeWaveformData(256));

    // generatePeaks should use cached data without creating a worker
    const result = await pipeline.generatePeaks(buf, 1024, false);
    expect(result.data.length).toBeGreaterThan(0);
    // Worker should NOT have been created
    expect((pipeline as any)._worker).toBeNull();
  });

  it('cacheWaveformData allows reextractPeaks at coarser zoom', () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();

    pipeline.cacheWaveformData(buf, makeWaveformData(256));

    const clipBuffers = new Map([['clip-1', buf]]);
    // Coarser than 256 — should work without warning
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = pipeline.reextractPeaks(clipBuffers, 1024, false);
    expect(result.size).toBe(1);
    expect(warnSpy).not.toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('terminate cleans up worker', async () => {
    const pipeline = new PeakPipeline();
    const buf = makeBuffer();
    await pipeline.generatePeaks(buf, 1024, false); // Creates worker
    pipeline.terminate();
    expect((pipeline as any)._worker).toBeNull();
  });
});
