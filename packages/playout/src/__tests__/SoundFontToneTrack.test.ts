import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Track } from '@waveform-playlist/core';

// Capture Part instances so tests can invoke the scheduled callback directly,
// and created GainNodes so tests can inspect the scheduled envelope automation.
const { mockPartInstances, createdGainNodes, mockRawContext } = vi.hoisted(() => {
  const createdGainNodes: Array<{
    gain: {
      value: number;
      setValueAtTime: ReturnType<typeof vi.fn>;
      linearRampToValueAtTime: ReturnType<typeof vi.fn>;
      cancelScheduledValues: ReturnType<typeof vi.fn>;
    };
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
  }> = [];
  const mockRawContext = {
    currentTime: 0,
    createGain: vi.fn(() => {
      const node = {
        gain: {
          value: 1,
          setValueAtTime: vi.fn(),
          linearRampToValueAtTime: vi.fn(),
          cancelScheduledValues: vi.fn(),
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      createdGainNodes.push(node);
      return node;
    }),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      playbackRate: { value: 1 },
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      onended: null,
    })),
  };
  return {
    mockPartInstances: [] as Array<{
      callback: (time: number, event: unknown) => void;
      events: unknown[];
      start: ReturnType<typeof vi.fn>;
      dispose: ReturnType<typeof vi.fn>;
    }>,
    createdGainNodes,
    mockRawContext,
  };
});

vi.mock('tone', () => ({
  Volume: vi.fn().mockImplementation(() => ({
    chain: vi.fn(),
    dispose: vi.fn(),
    volume: { value: 0 },
    input: { input: {} },
  })),
  Panner: vi.fn().mockImplementation(() => ({ dispose: vi.fn(), pan: { value: 0 } })),
  Gain: vi.fn().mockImplementation(() => ({
    connect: vi.fn(),
    dispose: vi.fn(),
    gain: { value: 1 },
  })),
  Part: vi
    .fn()
    .mockImplementation((callback: (time: number, event: unknown) => void, events: unknown[]) => {
      const instance = { callback, events, start: vi.fn(), dispose: vi.fn() };
      mockPartInstances.push(instance);
      return instance;
    }),
  getDestination: vi.fn(() => ({})),
  getContext: vi.fn(() => ({ rawContext: mockRawContext })),
  ToneAudioNode: vi.fn(),
}));

import { SoundFontToneTrack, envelopeValueAt } from '../SoundFontToneTrack';
import type { SoundFontCache } from '../SoundFontCache';

function makeTrack(id = 'sf1'): Track {
  return {
    id,
    name: 'SoundFont Test',
    gain: 1,
    muted: false,
    soloed: false,
    stereoPan: 0,
    startTime: 0,
    endTime: 1,
  };
}

describe('SoundFontToneTrack Part callback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPartInstances.length = 0;
  });

  it('a throwing triggerNote does not escape into the Transport tick chain', () => {
    // Nothing in Tone.js catches a throw from a Part callback
    // (ToneEvent._tick → Transport._processTick → Clock._loop are all
    // unguarded) — an escape aborts every other same-tick event across
    // ALL tracks. The callback must contain its own failures.
    const throwingCache = {
      isLoaded: true,
      getAudioBuffer: vi.fn(() => {
        throw new Error('decode failed');
      }),
    } as unknown as SoundFontCache;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    new SoundFontToneTrack({
      clips: [
        {
          notes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
          startTime: 0,
          duration: 1,
          offset: 0,
        },
      ],
      track: makeTrack(),
      soundFontCache: throwingCache,
    });

    expect(mockPartInstances).toHaveLength(1);
    const part = mockPartInstances[0];
    expect(part.events).toHaveLength(1);

    expect(() => part.callback(0.1, part.events[0])).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('SoundFont note'));

    warnSpy.mockRestore();
  });

  it('warns about missing samples once per track instance, not once per page', () => {
    // A missing sample (getAudioBuffer returns null) drops the note. The
    // warning is rate-limited — but per INSTANCE: after a SoundFont swap, a
    // different track with different missing samples must still diagnose.
    const nullCache = {
      isLoaded: true,
      getAudioBuffer: vi.fn(() => null),
    } as unknown as SoundFontCache;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const clip = {
      notes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
      startTime: 0,
      duration: 1,
      offset: 0,
    };

    new SoundFontToneTrack({ clips: [clip], track: makeTrack('sf-a'), soundFontCache: nullCache });
    const p1 = mockPartInstances[0];
    p1.callback(0.1, p1.events[0]);
    const warnsAfterFirst = warnSpy.mock.calls.length;
    expect(warnsAfterFirst).toBeGreaterThan(0);

    new SoundFontToneTrack({ clips: [clip], track: makeTrack('sf-b'), soundFontCache: nullCache });
    const p2 = mockPartInstances[1];
    p2.callback(0.1, p2.events[0]);

    expect(warnSpy.mock.calls.length).toBeGreaterThan(warnsAfterFirst);
    warnSpy.mockRestore();
  });
});

describe('envelopeValueAt', () => {
  // Mirrors the scheduled AHD automation exactly, including the hold-event
  // threshold: hold <= 0.001 emits no hold event, so the decay ramp spans
  // [attack, attack + hold + decay].
  const peak = 0.64;
  const sustain = 0.064;

  it('returns 0 at and before note-on', () => {
    expect(envelopeValueAt(0, 0.002, 0, 2, peak, sustain)).toBe(0);
    expect(envelopeValueAt(-1, 0.002, 0, 2, peak, sustain)).toBe(0);
  });

  it('ramps linearly through the attack', () => {
    expect(envelopeValueAt(0.001, 0.002, 0, 2, peak, sustain)).toBeCloseTo(peak / 2, 10);
  });

  it('holds at peak during a hold phase (hold > 0.001)', () => {
    expect(envelopeValueAt(0.03, 0.002, 0.05, 2, peak, sustain)).toBe(peak);
  });

  it('follows the decay line when no hold event exists (hold <= 0.001)', () => {
    // Ramp spans [0.002, 2.002]; at tRel 0.06 progress is 0.058/2.0
    const expected = peak + (sustain - peak) * (0.058 / 2.0);
    expect(envelopeValueAt(0.06, 0.002, 0, 2, peak, sustain)).toBeCloseTo(expected, 10);
  });

  it('follows the decay line after a real hold phase', () => {
    // Ramp spans [0.052, 2.052]; at tRel 1.0 progress is 0.948/2.0
    const expected = peak + (sustain - peak) * (0.948 / 2.0);
    expect(envelopeValueAt(1.0, 0.002, 0.05, 2, peak, sustain)).toBeCloseTo(expected, 10);
  });

  it('returns sustain after the decay completes', () => {
    expect(envelopeValueAt(2.5, 0.002, 0, 2, peak, sustain)).toBe(sustain);
  });

  it('handles zero attack and zero decay without NaN', () => {
    expect(envelopeValueAt(0.5, 0, 0, 0, peak, sustain)).toBe(sustain);
    expect(Number.isNaN(envelopeValueAt(0.001, 0, 0, 0, peak, sustain))).toBe(false);
  });
});

describe('note-off envelope scheduling (truncated AHD — no click)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPartInstances.length = 0;
    createdGainNodes.length = 0;
  });

  function makeSample(overrides: Record<string, unknown> = {}) {
    return {
      buffer: { duration: 2 } as AudioBuffer,
      playbackRate: 1,
      loopMode: 1, // looping (sustained) — effectiveDuration = MIDI note duration
      loopStart: 0.1,
      loopEnd: 1.9,
      attackVolEnv: 0.002,
      holdVolEnv: 0,
      decayVolEnv: 2.0,
      sustainVolEnv: 0.1,
      releaseVolEnv: 0.5,
      ...overrides,
    };
  }

  function triggerNoteOfDuration(duration: number, sampleOverrides: Record<string, unknown> = {}) {
    const cache = {
      isLoaded: true,
      getAudioBuffer: vi.fn(() => makeSample(sampleOverrides)),
    } as unknown as SoundFontCache;
    new SoundFontToneTrack({
      clips: [
        {
          notes: [{ midi: 60, name: 'C4', time: 0, duration, velocity: 0.8 }],
          startTime: 0,
          duration: Math.max(3, duration + 0.5),
          offset: 0,
        },
      ],
      track: makeTrack(),
      soundFontCache: cache,
    });
    const part = mockPartInstances[mockPartInstances.length - 1];
    part.callback(0.1, part.events[0]); // note-on at t=0.1
    return createdGainNodes[createdGainNodes.length - 1].gain;
  }

  // velocity 0.8 → peak 0.64; sustainVolEnv 0.1 → sustain 0.064
  const peak = 0.64;
  const sustain = 0.064;

  it('staccato note (note-off mid-decay): partial decay ramp to the held value, no peak→sustain step', () => {
    const gain = triggerNoteOfDuration(0.06); // noteOff = 0.16, decay end would be 2.102

    // No sustain step at note-off — the confirmed click source
    for (const call of gain.setValueAtTime.mock.calls) {
      expect(call).not.toEqual([expect.closeTo(sustain, 6), expect.closeTo(0.16, 6)]);
    }
    expect(gain.setValueAtTime.mock.calls).toEqual([[0, 0.1]]);

    const ramps = gain.linearRampToValueAtTime.mock.calls;
    expect(ramps).toHaveLength(3);
    expect(ramps[0][0]).toBeCloseTo(peak, 6);
    expect(ramps[0][1]).toBeCloseTo(0.102, 6);
    // Partial decay: ends AT note-off with the analytic on-the-line value
    const held = peak + (sustain - peak) * (0.058 / 2.0);
    expect(ramps[1][0]).toBeCloseTo(held, 6);
    expect(ramps[1][1]).toBeCloseTo(0.16, 6);
    // Release from the held value
    expect(ramps[2][0]).toBe(0);
    expect(ramps[2][1]).toBeCloseTo(0.66, 6);
  });

  it('long note (note-off after decay): unchanged full AHD + sustain hold + release', () => {
    const gain = triggerNoteOfDuration(2.5); // noteOff = 2.6 > decay end 2.102

    expect(gain.setValueAtTime.mock.calls).toEqual([
      [0, 0.1],
      [expect.closeTo(sustain, 6), expect.closeTo(2.6, 6)],
    ]);
    const ramps = gain.linearRampToValueAtTime.mock.calls;
    expect(ramps).toHaveLength(3);
    expect(ramps[1][0]).toBeCloseTo(sustain, 6);
    expect(ramps[1][1]).toBeCloseTo(2.102, 6); // full decay completes
    expect(ramps[2][1]).toBeCloseTo(3.1, 6); // release
  });

  it('ultra-short note (note-off mid-attack): partial attack ramp only', () => {
    const gain = triggerNoteOfDuration(0.001); // noteOff = 0.101 < attack end 0.102

    expect(gain.setValueAtTime.mock.calls).toEqual([[0, 0.1]]);
    const ramps = gain.linearRampToValueAtTime.mock.calls;
    expect(ramps).toHaveLength(2);
    expect(ramps[0][0]).toBeCloseTo(peak * 0.5, 6); // halfway up the attack
    expect(ramps[0][1]).toBeCloseTo(0.101, 6);
    expect(ramps[1][0]).toBe(0);
    expect(ramps[1][1]).toBeCloseTo(0.601, 6);
  });

  it('hold phase present, note-off mid-decay: hold event kept, partial decay to held value', () => {
    const gain = triggerNoteOfDuration(1.0, { holdVolEnv: 0.05 }); // noteOff 1.1, decay end 2.152

    expect(gain.setValueAtTime.mock.calls).toEqual([
      [0, 0.1],
      [expect.closeTo(peak, 6), expect.closeTo(0.152, 6)], // hold event
    ]);
    const ramps = gain.linearRampToValueAtTime.mock.calls;
    expect(ramps).toHaveLength(3);
    const held = peak + (sustain - peak) * (0.948 / 2.0);
    expect(ramps[1][0]).toBeCloseTo(held, 6);
    expect(ramps[1][1]).toBeCloseTo(1.1, 6);
  });
});

describe('SoundFontToneTrack duration', () => {
  it('returns the max clip end time regardless of array order', () => {
    const cache = {
      isLoaded: true,
      getAudioBuffer: vi.fn(() => null),
    } as unknown as SoundFontCache;
    const note = { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 };

    const track = new SoundFontToneTrack({
      clips: [
        { notes: [note], startTime: 0, duration: 10, offset: 0 },
        { notes: [note], startTime: 2, duration: 2, offset: 0 }, // array-last ends at 4
      ],
      track: makeTrack(),
      soundFontCache: cache,
    });

    expect(track.duration).toBe(10);
  });
});
