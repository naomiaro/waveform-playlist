import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  extractChunkNumber,
  parseCanvasId,
  groupContiguousIndices,
  classifyChunkTiers,
  computeChunkSampleRange,
  resolveRenderMode,
  toComputeConfig,
  buildConfigKey,
  buildFFTKey,
  mapsDiffer,
  type ChannelChunkInfo,
} from '../spectrogram-helpers';
import type { SpectrogramConfig } from '@waveform-playlist/core';

// Build a ChannelChunkInfo from an array of chunk numbers, with a uniform
// (or per-chunk) canvas width. Canvas IDs follow `clip-ch0-chunk{n}`.
function channelInfo(chunkNumbers: number[], widths: number | number[] = 1000): ChannelChunkInfo {
  return {
    canvasIds: chunkNumbers.map((n) => `clip-ch0-chunk${n}`),
    canvasWidths: chunkNumbers.map((_, i) => (Array.isArray(widths) ? widths[i] : widths)),
  };
}

describe('extractChunkNumber', () => {
  it('extracts the trailing chunk number', () => {
    expect(extractChunkNumber('clip-ch0-chunk5')).toBe(5);
    expect(extractChunkNumber('a-b-c-ch1-chunk42')).toBe(42);
    expect(extractChunkNumber('chunk0')).toBe(0);
  });

  it('returns 0 and warns on an unexpected format', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(extractChunkNumber('not-a-valid-id')).toBe(0);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });
});

describe('parseCanvasId', () => {
  it('parses clip id and channel index', () => {
    expect(parseCanvasId('myclip-ch0-chunk5')).toEqual({ clipId: 'myclip', channelIndex: 0 });
    expect(parseCanvasId('clip-ch2-chunk10')).toEqual({ clipId: 'clip', channelIndex: 2 });
  });

  it('keeps hyphens in the clip id (greedy match)', () => {
    expect(parseCanvasId('a-b-c-ch1-chunk0')).toEqual({ clipId: 'a-b-c', channelIndex: 1 });
  });

  it('returns null when the id does not match', () => {
    expect(parseCanvasId('bad')).toBeNull();
    expect(parseCanvasId('clip-ch0')).toBeNull();
    expect(parseCanvasId('clip-chunk0')).toBeNull();
  });
});

describe('groupContiguousIndices', () => {
  it('returns an empty array for no indices', () => {
    expect(groupContiguousIndices(channelInfo([0, 1, 2]), [])).toEqual([]);
  });

  it('keeps contiguous chunks in one group', () => {
    expect(groupContiguousIndices(channelInfo([0, 1, 2]), [0, 1, 2])).toEqual([[0, 1, 2]]);
  });

  it('splits at gaps in chunk numbers', () => {
    // indices [0,1,2,3] map to chunk numbers [0,1,4,5] → two groups
    expect(groupContiguousIndices(channelInfo([0, 1, 4, 5]), [0, 1, 2, 3])).toEqual([
      [0, 1],
      [2, 3],
    ]);
  });

  it('groups by chunk number, not index position', () => {
    // registry holds non-consecutive chunks [10,14,15]
    expect(groupContiguousIndices(channelInfo([10, 14, 15]), [0, 1, 2])).toEqual([[0], [1, 2]]);
  });
});

describe('classifyChunkTiers', () => {
  it('treats every chunk as in-viewport when there is no container', () => {
    const info = channelInfo([0, 1, 2]);
    expect(classifyChunkTiers(info, 0, null)).toEqual({
      viewportIndices: [0, 1, 2],
      bufferIndices: [],
      remainingIndices: [],
    });
  });

  it('classifies into viewport / buffer / remaining tiers', () => {
    // chunks 0..3, width 1000 each, MAX_CANVAS_WIDTH=1000.
    // viewport: scrollLeft 0, width 1000. buffer overscan = 1.5 * 1000 = 1500.
    const info = channelInfo([0, 1, 2, 3]);
    const tiers = classifyChunkTiers(info, 0, { scrollLeft: 0, viewportWidth: 1000 });
    expect(tiers.viewportIndices).toEqual([0]); // [0,1000) intersects viewport
    expect(tiers.bufferIndices).toEqual([1, 2]); // left < bufferEnd (2500)
    expect(tiers.remainingIndices).toEqual([3]); // left 3000 > bufferEnd
  });

  it('shifts classification by the clip pixel offset', () => {
    // Same chunks, but the clip starts 1000px into the timeline.
    const info = channelInfo([0, 1, 2, 3]);
    const tiers = classifyChunkTiers(info, 1000, { scrollLeft: 1000, viewportWidth: 1000 });
    // chunk0 now spans [1000,2000) → intersects viewport at scrollLeft 1000
    expect(tiers.viewportIndices).toEqual([0]);
  });
});

describe('computeChunkSampleRange', () => {
  it('covers the chunk range without padding past the clip when far from edges', () => {
    const info = channelInfo([0, 1], 1000);
    const range = computeChunkSampleRange({
      channelInfo: info,
      indices: [0, 1],
      fftSize: 2048,
      offsetSamples: 0,
      durationSamples: 1_000_000,
      samplesPerPixel: 256,
    });
    // startPx=0 → rangeStart 0 → padded max(0, -2048) = 0
    // endPx=2000 → rangeEnd ceil(2000*256)=512000 → padded +2048 = 514048
    expect(range).toEqual({ paddedStart: 0, paddedEnd: 514048 });
  });

  it('clamps padded range to the clip bounds', () => {
    const info = channelInfo([5], 500);
    const range = computeChunkSampleRange({
      channelInfo: info,
      indices: [0],
      fftSize: 1024,
      offsetSamples: 10_000,
      durationSamples: 50_000, // clip ends at sample 60_000
      samplesPerPixel: 10,
    });
    // startPx=5000 → rangeStart 10000 + 50000 = 60000 (== clip end)
    // rangeEnd clamps to 60000; paddedStart = 60000-1024 = 58976; paddedEnd clamps to 60000
    expect(range).toEqual({ paddedStart: 58_976, paddedEnd: 60_000 });
  });
});

describe('resolveRenderMode', () => {
  it('prefers the override render mode', () => {
    expect(resolveRenderMode({ renderMode: 'spectrogram' }, 'waveform')).toBe('spectrogram');
  });

  it('falls back to the track render mode when there is no override', () => {
    expect(resolveRenderMode(undefined, 'both')).toBe('both');
    expect(resolveRenderMode(undefined, 'spectrogram')).toBe('spectrogram');
  });

  it('defaults to waveform when nothing is set', () => {
    expect(resolveRenderMode(undefined, undefined)).toBe('waveform');
  });
});

describe('toComputeConfig', () => {
  it('returns all-undefined fields for undefined config', () => {
    expect(toComputeConfig(undefined)).toEqual({
      fftSize: undefined,
      hopSize: undefined,
      windowFunction: undefined,
      alpha: undefined,
      zeroPaddingFactor: undefined,
    });
  });

  it('picks only the FFT-affecting fields', () => {
    const result = toComputeConfig({
      fftSize: 4096,
      hopSize: 1024,
      windowFunction: 'hamming',
      alpha: 0.5,
      zeroPaddingFactor: 4,
      // appearance-only fields must NOT leak into the compute config:
      frequencyScale: 'mel',
      minFrequency: 0,
      maxFrequency: 20000,
      gainDb: 20,
      rangeDb: 80,
    });
    expect(result).toEqual({
      fftSize: 4096,
      hopSize: 1024,
      windowFunction: 'hamming',
      alpha: 0.5,
      zeroPaddingFactor: 4,
    });
    expect(result).not.toHaveProperty('frequencyScale');
    expect(result).not.toHaveProperty('gainDb');
  });
});

describe('buildConfigKey / buildFFTKey', () => {
  it('produces a stable key for identical inputs', () => {
    const a = buildConfigKey({
      mode: 'spectrogram',
      cfg: { fftSize: 2048 },
      cm: 'viridis',
      mono: false,
    });
    const b = buildConfigKey({
      mode: 'spectrogram',
      cfg: { fftSize: 2048 },
      cm: 'viridis',
      mono: false,
    });
    expect(a).toBe(b);
  });

  it('config key changes with color map, but FFT key does not', () => {
    const base = {
      mode: 'spectrogram' as const,
      cfg: { fftSize: 2048 } as SpectrogramConfig,
      mono: false,
    };
    const cfgKeyA = buildConfigKey({ ...base, cm: 'viridis' });
    const cfgKeyB = buildConfigKey({ ...base, cm: 'magma' });
    expect(cfgKeyA).not.toBe(cfgKeyB);

    const computeConfig = toComputeConfig(base.cfg);
    const fftKeyA = buildFFTKey({ mode: base.mode, mono: base.mono, computeConfig });
    const fftKeyB = buildFFTKey({ mode: base.mode, mono: base.mono, computeConfig });
    expect(fftKeyA).toBe(fftKeyB);
    // colour map is not part of the FFT key at all
    expect(fftKeyA).not.toContain('viridis');
    expect(fftKeyA).not.toContain('magma');
  });

  it('FFT key changes when an FFT-affecting field changes', () => {
    const keyA = buildFFTKey({
      mode: 'spectrogram',
      mono: false,
      computeConfig: toComputeConfig({ fftSize: 2048 }),
    });
    const keyB = buildFFTKey({
      mode: 'spectrogram',
      mono: false,
      computeConfig: toComputeConfig({ fftSize: 4096 }),
    });
    expect(keyA).not.toBe(keyB);
  });
});

describe('mapsDiffer', () => {
  const map = (entries: [string, string][]) => new Map(entries);

  it('returns false for equal maps', () => {
    expect(mapsDiffer(map([['a', '1']]), map([['a', '1']]))).toBe(false);
  });

  it('returns true when sizes differ', () => {
    expect(
      mapsDiffer(
        map([['a', '1']]),
        map([
          ['a', '1'],
          ['b', '2'],
        ])
      )
    ).toBe(true);
  });

  it('returns true when a value differs', () => {
    expect(mapsDiffer(map([['a', '1']]), map([['a', '2']]))).toBe(true);
  });

  it('returns true when keys differ at equal size', () => {
    expect(mapsDiffer(map([['a', '1']]), map([['b', '1']]))).toBe(true);
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});
