import { describe, it, expect } from 'vitest';
import type { AudioClip } from '@waveform-playlist/core';
import {
  constrainClipDrag,
  constrainBoundaryTrim,
  calculateSplitPoint,
  splitClip,
  canSplitAt,
} from '../operations/clipOperations';

function makeClip(
  overrides: Partial<AudioClip> & {
    id: string;
    startSample: number;
    durationSamples: number;
  }
): AudioClip {
  return {
    offsetSamples: 0,
    sampleRate: 44100,
    sourceDurationSamples: 441000,
    gain: 1,
    ...overrides,
  };
}

describe('constrainClipDrag', () => {
  it('prevents clip from going before sample 0', () => {
    const clip = makeClip({ id: 'c1', startSample: 1000, durationSamples: 5000 });
    const result = constrainClipDrag(clip, -2000, [clip], 0);
    expect(result).toBe(-1000);
  });

  it('allows valid movement', () => {
    const clip = makeClip({ id: 'c1', startSample: 1000, durationSamples: 5000 });
    const result = constrainClipDrag(clip, 500, [clip], 0);
    expect(result).toBe(500);
  });

  it('prevents overlap with previous clip', () => {
    const prev = makeClip({ id: 'c0', startSample: 0, durationSamples: 5000 });
    const clip = makeClip({ id: 'c1', startSample: 10000, durationSamples: 5000 });
    const sorted = [prev, clip];
    const result = constrainClipDrag(clip, -8000, sorted, 1);
    expect(result).toBe(-5000);
  });

  it('prevents overlap with next clip', () => {
    const clip = makeClip({ id: 'c0', startSample: 0, durationSamples: 5000 });
    const next = makeClip({ id: 'c1', startSample: 10000, durationSamples: 5000 });
    const sorted = [clip, next];
    const result = constrainClipDrag(clip, 8000, sorted, 0);
    expect(result).toBe(5000);
  });
});

describe('constrainBoundaryTrim', () => {
  it('prevents left trim from going below startSample 0', () => {
    const clip = makeClip({
      id: 'c1',
      startSample: 500,
      durationSamples: 10000,
      offsetSamples: 5000, // high enough so offset constraint doesn't interfere
    });
    const result = constrainBoundaryTrim(clip, -1000, 'left', [clip], 0, 256);
    expect(result).toBe(-500);
  });

  it('prevents left trim from going below offsetSamples 0', () => {
    const clip = makeClip({
      id: 'c1',
      startSample: 5000,
      durationSamples: 10000,
      offsetSamples: 200,
    });
    const result = constrainBoundaryTrim(clip, -1000, 'left', [clip], 0, 256);
    expect(result).toBe(-200);
  });

  it('enforces minimum duration on left trim', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 10000 });
    const minDuration = 256;
    // delta 10000 would shrink duration to 0, constrained to 9744
    const result = constrainBoundaryTrim(clip, 10000, 'left', [clip], 0, minDuration);
    // durationSamples - delta >= minDuration => delta <= 9744
    expect(result).toBe(10000 - minDuration);
  });

  it('enforces minimum duration on right trim', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 10000 });
    const minDuration = 256;
    // delta -10000 would shrink duration to 0, constrained to -9744
    const result = constrainBoundaryTrim(clip, -10000, 'right', [clip], 0, minDuration);
    // durationSamples + delta >= minDuration => delta >= -9744
    expect(result).toBe(minDuration - 10000);
  });

  it('prevents right trim from exceeding source audio length', () => {
    const clip = makeClip({
      id: 'c1',
      startSample: 0,
      durationSamples: 10000,
      offsetSamples: 1000,
      sourceDurationSamples: 12000,
    });
    // offsetSamples + (durationSamples + delta) <= sourceDurationSamples
    // 1000 + (10000 + delta) <= 12000
    // delta <= 1000
    const result = constrainBoundaryTrim(clip, 5000, 'right', [clip], 0, 256);
    expect(result).toBe(1000);
  });

  it('prevents right trim overlap with next clip', () => {
    const clip = makeClip({ id: 'c0', startSample: 0, durationSamples: 5000 });
    const next = makeClip({ id: 'c1', startSample: 6000, durationSamples: 5000 });
    const sorted = [clip, next];
    // startSample + (durationSamples + delta) <= nextClip.startSample
    // 0 + (5000 + delta) <= 6000
    // delta <= 1000
    const result = constrainBoundaryTrim(clip, 3000, 'right', sorted, 0, 256);
    expect(result).toBe(1000);
  });
});

describe('calculateSplitPoint', () => {
  it('snaps to pixel boundary', () => {
    // 50000 / 1024 = 48.828... -> floor to 48 -> 48 * 1024 = 49152
    const result = calculateSplitPoint(50000, 1024);
    expect(result).toBe(49152);
  });

  it('handles exact pixel boundary', () => {
    // 2048 / 1024 = 2.0 -> floor to 2 -> 2 * 1024 = 2048
    const result = calculateSplitPoint(2048, 1024);
    expect(result).toBe(2048);
  });
});

describe('splitClip', () => {
  it('keeps the original id on the left half; the right half gets a new id (#848)', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 10000 });
    const { left, right } = splitClip(clip, 4000);
    expect(left.id).toBe('c1');
    expect(right.id).not.toBe('c1');
    expect(right.id).not.toBe(left.id);
  });

  it('creates two clips covering original range', () => {
    const clip = makeClip({
      id: 'c1',
      startSample: 0,
      durationSamples: 10000,
      offsetSamples: 0,
    });
    const { left, right } = splitClip(clip, 4000);

    // Left clip covers [0, 4000)
    expect(left.startSample).toBe(0);
    expect(left.durationSamples).toBe(4000);
    expect(left.offsetSamples).toBe(0);

    // Right clip covers [4000, 10000)
    expect(right.startSample).toBe(4000);
    expect(right.durationSamples).toBe(6000);
    expect(right.offsetSamples).toBe(4000);
  });

  it('preserves fadeIn on left, fadeOut on right', () => {
    const fadeIn = { duration: 0.5, type: 'linear' as const };
    const fadeOut = { duration: 0.3, type: 'exponential' as const };
    const clip = makeClip({
      id: 'c1',
      startSample: 0,
      durationSamples: 10000,
      fadeIn,
      fadeOut,
    });
    const { left, right } = splitClip(clip, 5000);

    expect(left.fadeIn).toEqual(fadeIn);
    expect(left.fadeOut).toBeUndefined();
    expect(right.fadeIn).toBeUndefined();
    expect(right.fadeOut).toEqual(fadeOut);
  });

  it('names with (1) and (2) suffixes', () => {
    const clip = makeClip({
      id: 'c1',
      startSample: 0,
      durationSamples: 10000,
      name: 'Vocals',
    });
    const { left, right } = splitClip(clip, 5000);

    expect(left.name).toBe('Vocals (1)');
    expect(right.name).toBe('Vocals (2)');
  });

  it('handles clip with non-zero offset', () => {
    const clip = makeClip({
      id: 'c1',
      startSample: 2000,
      durationSamples: 8000,
      offsetSamples: 1000,
    });
    const { left, right } = splitClip(clip, 5000);

    // Split at sample 5000 on the timeline
    // Left: start=2000, dur=(5000-2000)=3000, offset=1000
    expect(left.startSample).toBe(2000);
    expect(left.durationSamples).toBe(3000);
    expect(left.offsetSamples).toBe(1000);

    // Right: start=5000, dur=(8000-3000)=5000, offset=1000+3000=4000
    expect(right.startSample).toBe(5000);
    expect(right.durationSamples).toBe(5000);
    expect(right.offsetSamples).toBe(4000);
  });
});

describe('canSplitAt', () => {
  const minDuration = 256;

  it('true for valid split point', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 10000 });
    expect(canSplitAt(clip, 5000, minDuration)).toBe(true);
  });

  it('false at clip start', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 10000 });
    expect(canSplitAt(clip, 0, minDuration)).toBe(false);
  });

  it('false at clip end', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 10000 });
    expect(canSplitAt(clip, 10000, minDuration)).toBe(false);
  });

  it('false if either resulting clip too short', () => {
    const clip = makeClip({ id: 'c1', startSample: 0, durationSamples: 10000 });
    // Split at sample 100 would create left clip of 100 samples (< 256)
    expect(canSplitAt(clip, 100, minDuration)).toBe(false);
    // Split at sample 9900 would create right clip of 100 samples (< 256)
    expect(canSplitAt(clip, 9900, minDuration)).toBe(false);
  });
});
