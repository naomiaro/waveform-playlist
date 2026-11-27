import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tone's Chorus, Tremolo, AutoPanner and AutoFilter build their LFO stopped:
// until start() is called they are a fixed delay, gain, pan and filter
// (issue #820). Phaser and Vibrato start theirs themselves. This file checks
// the factory's part with Tone mocked: each of the four gets start() called
// once, before it is handed out, and nothing else does. That the real effects
// then modulate is `e2e/effects.spec.ts` ("an LFO effect modulates in an
// exported WAV").
//
// Phaser has a start() here because it has one on Tone 15.5.x (it shares a
// base class with Tremolo there) while still starting itself: a second
// start() at the same time throws "Start time must be strictly greater than
// previous start time" (seen in a throwaway browser probe on 15.5.73, in an
// offline render). So "has start()" is not the rule; the four are named.
// `toneLfoEffects.test.ts` checks the installed Tone build for which effects
// start themselves.
const { NEEDS_START, HAS_START, starts, disposed, failStart, failDispose } = vi.hoisted(() => ({
  NEEDS_START: ['Chorus', 'Tremolo', 'AutoPanner', 'AutoFilter'],
  HAS_START: ['Chorus', 'Tremolo', 'AutoPanner', 'AutoFilter', 'Phaser'],
  starts: [] as { name: string; args: unknown[] }[],
  disposed: [] as string[],
  failStart: { message: undefined as string | undefined },
  failDispose: { message: undefined as string | undefined },
}));

vi.mock('@waveform-playlist/playout', () => ({
  getGlobalContext: vi.fn(() => ({})),
}));

vi.mock('tone', () => {
  const ctor = (name: string) =>
    vi.fn(function () {
      const node: Record<string, unknown> = {
        dispose: () => {
          disposed.push(name);
          if (failDispose.message !== undefined) throw new Error(failDispose.message);
        },
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      if (HAS_START.includes(name)) {
        node.start = (...args: unknown[]) => {
          if (failStart.message !== undefined) throw new Error(failStart.message);
          starts.push({ name, args });
          return node;
        };
      }
      return node;
    });
  const names = [
    'Reverb',
    'Freeverb',
    'JCReverb',
    'FeedbackDelay',
    'PingPongDelay',
    'Chorus',
    'Phaser',
    'Tremolo',
    'Vibrato',
    'AutoPanner',
    'AutoFilter',
    'AutoWah',
    'EQ3',
    'Distortion',
    'BitCrusher',
    'Chebyshev',
    'Compressor',
    'Limiter',
    'Gate',
    'StereoWidener',
  ];
  return {
    ...Object.fromEntries(names.map((n) => [n, ctor(n)])),
    ToneAudioNode: vi.fn(),
    connect: vi.fn(),
  };
});

import { createToneEffectInstance } from '../effects/effectFactory';
import { effectDefinitions } from '../effects/effectDefinitions';

beforeEach(() => {
  starts.length = 0;
  disposed.length = 0;
  failStart.message = undefined;
  failDispose.message = undefined;
});

describe('createToneEffectInstance starts the four effects whose LFO is built stopped', () => {
  it('calls start() once, with no time, on each of the four LFO effects', () => {
    for (const id of ['chorus', 'tremolo', 'autoPanner', 'autoFilter']) {
      starts.length = 0;
      const definition = effectDefinitions.find((d) => d.id === id)!;

      createToneEffectInstance(definition);

      expect(starts, id).toHaveLength(1);
      expect(starts[0].args, id).toEqual([]);
    }
  });

  it('starts exactly those four across every built-in definition', () => {
    for (const definition of effectDefinitions) createToneEffectInstance(definition);

    expect(starts.map((s) => s.name).sort()).toEqual([...NEEDS_START].sort());
  });

  it('does not start a phaser, which has start() on Tone 15.5.x and starts itself', () => {
    const phaser = effectDefinitions.find((d) => d.id === 'phaser')!;

    const instance = createToneEffectInstance(phaser);

    expect(instance.id).toBe('phaser');
    expect(starts).toEqual([]);
  });

  it('disposes the effect and rethrows when start() throws', () => {
    failStart.message = 'Start time must be strictly greater than previous start time';
    const tremolo = effectDefinitions.find((d) => d.id === 'tremolo')!;

    expect(() => createToneEffectInstance(tremolo)).toThrow(/strictly greater than previous/);
    expect(disposed).toEqual(['Tremolo']);
  });

  it('reports the error of start() when the dispose after it throws too', () => {
    failStart.message = 'Start time must be strictly greater than previous start time';
    failDispose.message = 'dispose failed';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const chorus = effectDefinitions.find((d) => d.id === 'chorus')!;

    expect(() => createToneEffectInstance(chorus)).toThrow(/strictly greater than previous/);
    expect(disposed).toEqual(['Chorus']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toMatch(/dispose failed/);
    warn.mockRestore();
  });
});
