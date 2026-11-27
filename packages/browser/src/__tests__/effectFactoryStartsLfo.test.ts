import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tone's Chorus, Tremolo, AutoPanner and AutoFilter build their LFO stopped:
// until start() is called they are a fixed delay, gain, pan and filter
// (issue #820). Phaser and Vibrato start theirs in the constructor and have
// no start(). This file checks the factory's part with Tone mocked: an
// effect that has start() gets it called once, before it is handed out.
// That the real effects then modulate is `e2e/effects.spec.ts`
// ("an LFO effect modulates in an exported WAV").
const { STARTABLE, starts } = vi.hoisted(() => ({
  STARTABLE: ['Chorus', 'Tremolo', 'AutoPanner', 'AutoFilter'],
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
      if (STARTABLE.includes(name)) {
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

describe('createToneEffectInstance starts an effect that has start()', () => {
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

    expect(starts.map((s) => s.name).sort()).toEqual([...STARTABLE].sort());
  });

  it('creates an effect without start() as before', () => {
    const phaser = effectDefinitions.find((d) => d.id === 'phaser')!;

    const instance = createToneEffectInstance(phaser);

    expect(instance.id).toBe('phaser');
    expect(starts).toEqual([]);
  });
});
