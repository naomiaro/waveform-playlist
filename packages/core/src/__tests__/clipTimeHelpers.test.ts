import { describe, it, expect } from 'vitest';
import { clipStartTime, clipEndTime, clipOffsetTime, clipDurationTime } from '../clipTimeHelpers';
import type { AudioClip } from '../types';

function makeClip(overrides: Partial<AudioClip> & {
  id: string;
  startSample: number;
  durationSamples: number;
}): AudioClip {
  return {
    offsetSamples: 0,
    sampleRate: 44100,
    sourceDurationSamples: 441000,
    gain: 1,
    ...overrides,
  };
}

describe('clipStartTime', () => {
  it('converts startSample to seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 44100, durationSamples: 22050 });
    expect(clipStartTime(clip)).toBe(1);
  });

  it('returns 0 for clip at origin', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    expect(clipStartTime(clip)).toBe(0);
  });

  it('uses clip sampleRate', () => {
    const clip = makeClip({ id: 'c1', startSample: 48000, durationSamples: 48000, sampleRate: 48000 });
    expect(clipStartTime(clip)).toBe(1);
  });
});

describe('clipEndTime', () => {
  it('computes start + duration in seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 44100, durationSamples: 22050 });
    expect(clipEndTime(clip)).toBe(1.5);
  });

  it('handles clip at origin', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    expect(clipEndTime(clip)).toBe(1);
  });
});

describe('clipOffsetTime', () => {
  it('converts offsetSamples to seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100, offsetSamples: 22050 });
    expect(clipOffsetTime(clip)).toBe(0.5);
  });

  it('returns 0 when offset is 0', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 44100 });
    expect(clipOffsetTime(clip)).toBe(0);
  });
});

describe('clipDurationTime', () => {
  it('converts durationSamples to seconds', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 22050 });
    expect(clipDurationTime(clip)).toBe(0.5);
  });
});
