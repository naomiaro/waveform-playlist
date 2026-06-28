import { describe, it, expect } from 'vitest';
import { audibleLatencySamples } from '../utils/latency';

describe('audibleLatencySamples', () => {
  it('returns floor((outputLatency + lookAhead) * sampleRate)', () => {
    expect(audibleLatencySamples(0.005, 0.1, 48000)).toBe(Math.floor(0.105 * 48000));
    expect(audibleLatencySamples(0.005, 0.1, 44100)).toBe(Math.floor(0.105 * 44100));
  });

  it('returns 0 when total latency is zero or negative', () => {
    expect(audibleLatencySamples(0, 0, 48000)).toBe(0);
    expect(audibleLatencySamples(-0.005, 0, 48000)).toBe(0);
  });

  it('returns 0 for non-finite inputs (NaN, Infinity)', () => {
    expect(audibleLatencySamples(NaN, 0.1, 48000)).toBe(0);
    expect(audibleLatencySamples(0.005, NaN, 48000)).toBe(0);
    expect(audibleLatencySamples(0.005, 0.1, NaN)).toBe(0);
    expect(audibleLatencySamples(Infinity, 0, 48000)).toBe(0);
  });

  it('returns 0 for non-positive sampleRate', () => {
    expect(audibleLatencySamples(0.005, 0.1, 0)).toBe(0);
    expect(audibleLatencySamples(0.005, 0.1, -48000)).toBe(0);
  });

  it('handles native-adapter case (lookAhead = 0)', () => {
    expect(audibleLatencySamples(0.003, 0, 48000)).toBe(Math.floor(0.003 * 48000));
  });
});

import { resolveRecordingOffsetSamples } from '../utils/latency';

describe('resolveRecordingOffsetSamples', () => {
  it('uses the auto-computed audible latency when no override is given', () => {
    // floor((0.01 + 0.1) * 48000) = floor(0.11 * 48000) = 5280
    expect(
      resolveRecordingOffsetSamples({ outputLatency: 0.01, lookAhead: 0.1, sampleRate: 48000 })
    ).toBe(5280);
  });

  it('absolute-replaces the auto value when overrideSeconds is defined', () => {
    // override 0.05s wins over auto (0.11s); floor(0.05 * 48000) = 2400
    expect(
      resolveRecordingOffsetSamples({
        overrideSeconds: 0.05,
        outputLatency: 0.01,
        lookAhead: 0.1,
        sampleRate: 48000,
      })
    ).toBe(2400);
  });

  it('treats overrideSeconds=0 as "disable compensation" (0 samples)', () => {
    expect(
      resolveRecordingOffsetSamples({
        overrideSeconds: 0,
        outputLatency: 0.01,
        lookAhead: 0.1,
        sampleRate: 48000,
      })
    ).toBe(0);
  });

  it('clamps negative / non-finite overrides to 0', () => {
    const base = { outputLatency: 0.01, lookAhead: 0.1, sampleRate: 48000 };
    expect(resolveRecordingOffsetSamples({ ...base, overrideSeconds: -0.02 })).toBe(0);
    expect(resolveRecordingOffsetSamples({ ...base, overrideSeconds: NaN })).toBe(0);
    expect(resolveRecordingOffsetSamples({ ...base, overrideSeconds: Infinity })).toBe(0);
  });

  it('converts override seconds at the given sample rate', () => {
    // floor(0.043 * 44100) = floor(1896.3) = 1896
    expect(
      resolveRecordingOffsetSamples({
        overrideSeconds: 0.043,
        outputLatency: 0,
        lookAhead: 0,
        sampleRate: 44100,
      })
    ).toBe(1896);
  });
});
