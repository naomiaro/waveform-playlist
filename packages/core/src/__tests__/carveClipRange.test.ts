import { describe, it, expect } from 'vitest';
import { carveClipRange } from '../utils/carveClipRange';
import type { AudioClip } from '../types/clip';

function makeClip(overrides: Partial<AudioClip> & { id: string }): AudioClip {
  return {
    startSample: 0,
    durationSamples: 1000,
    offsetSamples: 0,
    sampleRate: 48000,
    sourceDurationSamples: 10000,
    gain: 1,
    ...overrides,
  } as AudioClip;
}

describe('carveClipRange', () => {
  it('leaves non-overlapping clips untouched (same references)', () => {
    const before = makeClip({ id: 'before', startSample: 0, durationSamples: 500 });
    const after = makeClip({ id: 'after', startSample: 3000, durationSamples: 500 });

    const result = carveClipRange([before, after], 1000, 2000);

    expect(result).toHaveLength(2);
    expect(result[0]).toBe(before);
    expect(result[1]).toBe(after);
  });

  it('treats a shared boundary as non-overlapping', () => {
    // Clip ends exactly where the range starts; next clip starts exactly at range end
    const left = makeClip({ id: 'left', startSample: 0, durationSamples: 1000 });
    const right = makeClip({ id: 'right', startSample: 2000, durationSamples: 1000 });

    const result = carveClipRange([left, right], 1000, 2000);

    expect(result[0]).toBe(left);
    expect(result[1]).toBe(right);
  });

  it('removes clips fully covered by the range', () => {
    const covered = makeClip({ id: 'covered', startSample: 1200, durationSamples: 400 });

    const result = carveClipRange([covered], 1000, 2000);

    expect(result).toHaveLength(0);
  });

  it('right-trims a clip whose tail overlaps the range', () => {
    const clip = makeClip({
      id: 'tail',
      startSample: 0,
      durationSamples: 1500,
      offsetSamples: 100,
    });

    const result = carveClipRange([clip], 1000, 2000);

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('tail');
    expect(result[0].startSample).toBe(0);
    expect(result[0].durationSamples).toBe(1000);
    expect(result[0].offsetSamples).toBe(100); // head untouched
    // Original object not mutated
    expect(clip.durationSamples).toBe(1500);
  });

  it('left-trims a clip whose head overlaps the range (offset shifts)', () => {
    const clip = makeClip({
      id: 'head',
      startSample: 1500,
      durationSamples: 1000,
      offsetSamples: 200,
      startTick: 960,
    });

    const result = carveClipRange([clip], 1000, 2000);

    expect(result).toHaveLength(1);
    expect(result[0].startSample).toBe(2000);
    expect(result[0].durationSamples).toBe(500);
    expect(result[0].offsetSamples).toBe(200 + 500); // skips the carved audio
    // startSample changed — a sample-space carve can't recompute ticks, so the
    // stale authoritative startTick must be dropped (engine re-enriches).
    expect(result[0].startTick).toBeUndefined();
    expect(clip.startSample).toBe(1500); // original untouched
  });

  it('splits a clip that fully contains the range', () => {
    const clip = makeClip({
      id: 'container',
      startSample: 0,
      durationSamples: 3000,
      offsetSamples: 50,
    });

    const result = carveClipRange([clip], 1000, 2000);

    expect(result).toHaveLength(2);
    const [left, right] = result;

    expect(left.id).toBe('container');
    expect(left.startSample).toBe(0);
    expect(left.durationSamples).toBe(1000);
    expect(left.offsetSamples).toBe(50);

    expect(right.id).not.toBe('container'); // must be a new clip id
    expect(right.startSample).toBe(2000);
    expect(right.durationSamples).toBe(1000);
    expect(right.offsetSamples).toBe(50 + 2000);
    expect(right.audioBuffer).toBe(clip.audioBuffer); // shares the source audio

    expect(clip.durationSamples).toBe(3000); // original untouched
  });

  it('handles a mixed set of clips in one pass', () => {
    const untouched = makeClip({ id: 'a', startSample: 0, durationSamples: 500 });
    const trimmed = makeClip({ id: 'b', startSample: 500, durationSamples: 1000 });
    const removed = makeClip({ id: 'c', startSample: 1500, durationSamples: 400 });

    const result = carveClipRange([untouched, trimmed, removed], 1000, 2000);

    expect(result.map((c) => c.id)).toEqual(['a', 'b']);
    expect(result[1].durationSamples).toBe(500);
  });

  it('returns the clips unchanged for an empty or inverted range', () => {
    const clip = makeClip({ id: 'x', startSample: 0, durationSamples: 1000 });

    expect(carveClipRange([clip], 500, 500)).toEqual([clip]);
    expect(carveClipRange([clip], 800, 200)).toEqual([clip]);
  });
});
