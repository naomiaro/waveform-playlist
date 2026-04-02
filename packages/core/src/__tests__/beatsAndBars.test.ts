import { describe, it, expect } from 'vitest';
import {
  PPQN,
  ticksPerBeat,
  ticksPerBar,
  ticksToSamples,
  samplesToTicks,
  snapToGrid,
} from '../utils/beatsAndBars';

describe('PPQN', () => {
  it('is 192', () => {
    expect(PPQN).toBe(192);
  });
});

describe('ticksPerBeat', () => {
  it('[4,4] returns 192', () => {
    expect(ticksPerBeat([4, 4])).toBe(192);
  });

  it('[3,4] returns 192', () => {
    expect(ticksPerBeat([3, 4])).toBe(192);
  });

  it('[6,8] returns 96', () => {
    expect(ticksPerBeat([6, 8])).toBe(96);
  });

  it('[2,2] returns 384', () => {
    expect(ticksPerBeat([2, 2])).toBe(384);
  });
});

describe('ticksPerBar', () => {
  it('[4,4] returns 768', () => {
    expect(ticksPerBar([4, 4])).toBe(768);
  });

  it('[3,4] returns 576', () => {
    expect(ticksPerBar([3, 4])).toBe(576);
  });

  it('[6,8] returns 576', () => {
    expect(ticksPerBar([6, 8])).toBe(576);
  });

  it('[7,8] returns 672', () => {
    expect(ticksPerBar([7, 8])).toBe(672);
  });
});

describe('ticksToSamples', () => {
  it('192 ticks at 120 BPM / 48000 Hz = 24000 samples', () => {
    expect(ticksToSamples(192, 120, 48000)).toBe(24000);
  });

  it('returns 0 for zero ticks', () => {
    expect(ticksToSamples(0, 120, 48000)).toBe(0);
  });

  it('handles 44100 Hz sample rate', () => {
    // 192 ticks at 120 BPM / 44100 Hz = (192 * 60 * 44100) / (120 * 192) = 22050
    expect(ticksToSamples(192, 120, 44100)).toBe(22050);
  });

  it('handles non-standard BPM', () => {
    // 192 ticks at 90 BPM / 48000 Hz = (192 * 60 * 48000) / (90 * 192) = 32000
    expect(ticksToSamples(192, 90, 48000)).toBe(32000);
  });
});

describe('samplesToTicks', () => {
  it('24000 samples at 120 BPM / 48000 Hz = 192 ticks', () => {
    expect(samplesToTicks(24000, 120, 48000)).toBe(192);
  });

  it('returns 0 for zero samples', () => {
    expect(samplesToTicks(0, 120, 48000)).toBe(0);
  });

  it('handles 44100 Hz sample rate', () => {
    expect(samplesToTicks(22050, 120, 44100)).toBe(192);
  });

  it('rounds to nearest tick', () => {
    // A value that doesn't divide evenly should round
    expect(samplesToTicks(24001, 120, 48000)).toBe(192);
  });
});

describe('snapToGrid', () => {
  it('snaps to nearest grid line', () => {
    expect(snapToGrid(200, 192)).toBe(192);
  });

  it('snaps up when closer to next grid line', () => {
    // 290 / 192 = 1.51 -> rounds to 2 -> 2 * 192 = 384
    expect(snapToGrid(290, 192)).toBe(384);
  });

  it('returns 0 for zero ticks', () => {
    expect(snapToGrid(0, 192)).toBe(0);
  });

  it('returns exact value when already on grid', () => {
    expect(snapToGrid(384, 192)).toBe(384);
  });

  it('handles negative values', () => {
    // -100 / 192 = -0.52 -> rounds to -1 -> -1 * 192 = -192
    expect(snapToGrid(-100, 192)).toBe(-192);
  });

  it('handles negative values snapping down', () => {
    expect(snapToGrid(-200, 192)).toBe(-192);
  });
});

describe('round-trip: ticks -> samples -> ticks', () => {
  it('is stable at 120 BPM / 48000 Hz', () => {
    const ticks = 192;
    const samples = ticksToSamples(ticks, 120, 48000);
    expect(samplesToTicks(samples, 120, 48000)).toBe(ticks);
  });

  it('is stable at 120 BPM / 44100 Hz', () => {
    const ticks = 192;
    const samples = ticksToSamples(ticks, 120, 44100);
    expect(samplesToTicks(samples, 120, 44100)).toBe(ticks);
  });

  it('is stable at 140 BPM / 48000 Hz', () => {
    const ticks = 384;
    const samples = ticksToSamples(ticks, 140, 48000);
    expect(samplesToTicks(samples, 140, 48000)).toBe(ticks);
  });

  it('is stable at 90 BPM / 44100 Hz', () => {
    const ticks = 768;
    const samples = ticksToSamples(ticks, 90, 44100);
    expect(samplesToTicks(samples, 90, 44100)).toBe(ticks);
  });

  it('is stable for large tick values', () => {
    const ticks = 192 * 1000; // 1000 beats
    const samples = ticksToSamples(ticks, 120, 48000);
    expect(samplesToTicks(samples, 120, 48000)).toBe(ticks);
  });
});
