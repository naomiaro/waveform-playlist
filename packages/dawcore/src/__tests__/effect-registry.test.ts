import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerEffect,
  getEffectDefinitions,
  createEffectInstance,
  _resetEffectRegistryForTests,
} from '../effects/effect-registry';

function mockParam(value = 0) {
  return { value };
}

function mockNode(extra: Record<string, unknown> = {}) {
  return { connect: vi.fn(), disconnect: vi.fn(), ...extra };
}

function mockAudioContext() {
  return {
    createGain: vi.fn(() => mockNode({ gain: mockParam(1) })),
    createDelay: vi.fn(() => mockNode({ delayTime: mockParam(0) })),
    createBiquadFilter: vi.fn(() =>
      mockNode({ type: 'lowpass', frequency: mockParam(350), Q: mockParam(1) })
    ),
    createDynamicsCompressor: vi.fn(() =>
      mockNode({
        threshold: mockParam(-24),
        knee: mockParam(30),
        ratio: mockParam(12),
        attack: mockParam(0.003),
        release: mockParam(0.25),
      })
    ),
    createStereoPanner: vi.fn(() => mockNode({ pan: mockParam(0) })),
  } as unknown as BaseAudioContext;
}

beforeEach(() => {
  _resetEffectRegistryForTests();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('effect registry', () => {
  it('ships the native built-ins', () => {
    const defs = getEffectDefinitions();
    for (const type of [
      'native-gain',
      'native-filter',
      'native-compressor',
      'native-delay',
      'native-stereo-panner',
    ]) {
      expect(defs.has(type), type + ' should be registered').toBe(true);
    }
  });

  it('registerEffect adds a custom definition', () => {
    registerEffect('custom-boost', {
      label: 'Boost',
      category: 'dynamics',
      defaults: { amount: 2 },
      params: { amount: { min: 0, max: 4, step: 0.1 } },
      create: (ctx) => {
        const node = ctx.createGain();
        return {
          input: node,
          output: node,
          applyParams: (p) => {
            if (p.amount !== undefined) node.gain.value = p.amount;
          },
        };
      },
    });

    expect(getEffectDefinitions().has('custom-boost')).toBe(true);
  });

  it('re-registering a type warns and overwrites', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const def = getEffectDefinitions().get('native-gain')!;
    registerEffect('native-gain', { ...def, label: 'Replaced Gain' });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[waveform-playlist]'));
    expect(getEffectDefinitions().get('native-gain')!.label).toBe('Replaced Gain');
  });

  it('createEffectInstance throws on unknown type, listing available types', () => {
    expect(() => createEffectInstance('does-not-exist', mockAudioContext())).toThrow(
      /does-not-exist[\s\S]*native-gain/
    );
  });

  it('createEffectInstance merges defaults with overrides and applies them', () => {
    const ctx = mockAudioContext();
    const created = createEffectInstance('native-gain', ctx, { gain: 0.25 });

    expect(created.params.gain).toBe(0.25);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gainNode = (ctx.createGain as any).mock.results[0].value;
    expect(gainNode.gain.value).toBe(0.25);
  });

  it('native-delay declares a wet param and applyParams drives it', () => {
    const ctx = mockAudioContext();
    const created = createEffectInstance('native-delay', ctx);

    expect(created.wetParam).toBe('wet');
    created.instance.applyParams({ wet: 0 });
    // The wet gain node must now be silent. Find a gain node whose value is 0.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const gainNodes = (ctx.createGain as any).mock.results.map((r: { value: any }) => r.value);
    expect(gainNodes.some((n: { gain: { value: number } }) => n.gain.value === 0)).toBe(true);
  });

  it('getEffectDefinitions returns a copy — mutating it does not affect the registry', () => {
    const defs = getEffectDefinitions();
    defs.delete('native-gain');
    expect(getEffectDefinitions().has('native-gain')).toBe(true);
  });
});
