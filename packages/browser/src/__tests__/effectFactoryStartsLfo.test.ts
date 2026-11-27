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
// previous start time" (run in a browser on 15.5.73, in an offline render).
// So "has start()" is not the rule; the four are named.
const { NEEDS_START, HAS_START, starts } = vi.hoisted(() => ({
  NEEDS_START: ['Chorus', 'Tremolo', 'AutoPanner', 'AutoFilter'],
  HAS_START: ['Chorus', 'Tremolo', 'AutoPanner', 'AutoFilter', 'Phaser'],
  starts: [] as { name: string; args: unknown[] }[],
}));

vi.mock('@waveform-playlist/playout', () => ({
  getGlobalContext: vi.fn(() => ({})),
}));

vi.mock('tone', () => {
  const ctor = (name: string) =>
    vi.fn(function () {
      const node: Record<string, unknown> = {
        dispose: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
      };
      if (HAS_START.includes(name)) {
        node.start = (...args: unknown[]) => {
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
});
