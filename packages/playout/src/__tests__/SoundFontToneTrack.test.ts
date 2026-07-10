import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Track } from '@waveform-playlist/core';

// Capture Part instances so tests can invoke the scheduled callback directly.
const { mockPartInstances } = vi.hoisted(() => ({
  mockPartInstances: [] as Array<{
    callback: (time: number, event: unknown) => void;
    events: unknown[];
    start: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  }>,
}));

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
  getContext: vi.fn(() => ({ rawContext: {} })),
  ToneAudioNode: vi.fn(),
}));

import { SoundFontToneTrack } from '../SoundFontToneTrack';
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
});
