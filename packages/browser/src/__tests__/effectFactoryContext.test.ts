import { describe, it, expect, vi, beforeEach } from 'vitest';

// Tone nodes belong to the context that is current when they are built. An
// effect created before playout's global context exists lands on Tone's
// default context and can never be connected to a track — the playlist
// stalls in "loading" with "cannot connect to an AudioNode belonging to a
// different AudioContext".
const order: string[] = [];

vi.mock('@waveform-playlist/playout', () => ({
  getGlobalContext: vi.fn(() => {
    order.push('getGlobalContext');
    return {};
  }),
}));

vi.mock('tone', () => {
  const ctor = (name: string) =>
    vi.fn(function () {
      order.push('construct:' + name);
      return { dispose: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), set: vi.fn() };
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

import { createEffectInstance } from '../effects/effectFactory';
import { effectDefinitions } from '../effects/effectDefinitions';

beforeEach(() => {
  order.length = 0;
});

describe('createEffectInstance audio context', () => {
  it('establishes the shared global context BEFORE constructing the Tone effect', () => {
    const reverb = effectDefinitions.find((d) => d.id === 'reverb')!;

    createEffectInstance(reverb);

    expect(order).toEqual(['getGlobalContext', 'construct:Reverb']);
  });

  it('does so for every built-in effect type', () => {
    for (const definition of effectDefinitions) {
      order.length = 0;
      createEffectInstance(definition);
      expect(order[0], definition.id).toBe('getGlobalContext');
      expect(order[1], definition.id).toMatch(/^construct:/);
    }
  });
});
