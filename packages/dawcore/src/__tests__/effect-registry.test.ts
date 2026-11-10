import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerEffect,
  getEffectDefinitions,
  createEffectInstance,
  prepareEffect,
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
      mockNode({
        type: 'lowpass',
        frequency: mockParam(350),
        Q: mockParam(1),
        gain: mockParam(0),
      })
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
      'native-highpass',
      'native-bandpass',
      'native-notch',
      'native-peaking',
      'native-lowshelf',
      'native-highshelf',
      'native-compressor',
      'native-delay',
      'native-stereo-panner',
    ]) {
      expect(defs.has(type), type + ' should be registered').toBe(true);
    }
  });

  // #661: native-filter is lowpass-only; the other biquad shapes are siblings
  // so they fit the numeric-params model (no string `type` param).
  it.each([
    ['native-highpass', 'highpass', ['frequency', 'q']],
    ['native-bandpass', 'bandpass', ['frequency', 'q']],
    ['native-notch', 'notch', ['frequency', 'q']],
    ['native-peaking', 'peaking', ['frequency', 'q', 'gain']],
    ['native-lowshelf', 'lowshelf', ['frequency', 'gain']],
    ['native-highshelf', 'highshelf', ['frequency', 'gain']],
  ])('%s is a %s biquad exposing exactly the params that shape uses', (type, biquad, params) => {
    const def = getEffectDefinitions().get(type);
    expect(def, type + ' should be registered').toBeDefined();
    expect(def!.category).toBe('filter');
    expect(Object.keys(def!.params).sort()).toEqual([...params].sort());
    expect(Object.keys(def!.defaults).sort()).toEqual([...params].sort());

    const ctx = mockAudioContext();
    const overrides: Record<string, number> = { frequency: 123 };
    if (params.includes('q')) overrides.q = 2.5;
    if (params.includes('gain')) overrides.gain = -6;
    createEffectInstance(type, ctx, overrides);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = (ctx.createBiquadFilter as any).mock.results[0].value;
    expect(node.type).toBe(biquad);
    expect(node.frequency.value).toBe(123);
    // Params a shape ignores stay at the node's own defaults.
    expect(node.Q.value).toBe(params.includes('q') ? 2.5 : 1);
    expect(node.gain.value).toBe(params.includes('gain') ? -6 : 0);
  });

  it('native-highpass exposes q as resonance in dB, defaulting to a flat Butterworth response', () => {
    // Web Audio reads Q for lowpass/highpass in dB (Q_linear = 10^(Q/20)),
    // unlike bandpass/notch/peaking. A linear-looking 0.707 default would be
    // a +0.7 dB resonance bump; flat is about -3 dB.
    const def = getEffectDefinitions().get('native-highpass')!;
    expect(def.params.q).toMatchObject({ unit: 'dB' });
    expect(def.params.q.min).toBeLessThanOrEqual(-3);
    expect(def.defaults.q).toBe(-3);
    expect(def.defaults.frequency).toBe(80);

    const ctx = mockAudioContext();
    createEffectInstance('native-highpass', ctx);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = (ctx.createBiquadFilter as any).mock.results[0].value;
    expect(node.Q.value).toBe(-3);
  });

  it('linear-Q shapes keep a unitless, positive q range', () => {
    for (const type of ['native-bandpass', 'native-notch', 'native-peaking']) {
      const q = getEffectDefinitions().get(type)!.params.q;
      expect(q.unit, type).toBeUndefined();
      expect(q.min, type).toBeGreaterThan(0);
    }
  });

  it('native-filter keeps its exact pre-#661 definition (persisted chains depend on it)', () => {
    const def = getEffectDefinitions().get('native-filter')!;
    expect(def.label).toBe('Lowpass Filter');
    expect(def.defaults).toEqual({ frequency: 1000, q: 1 });
    expect(def.params).toEqual({
      frequency: { min: 20, max: 20000, step: 1, unit: 'Hz' },
      q: { min: 0.1, max: 20, step: 0.1 },
    });
  });

  it('a shape ignores params it does not expose', () => {
    const ctx = mockAudioContext();
    createEffectInstance('native-lowshelf', ctx).instance.applyParams({ q: 9, gain: 3 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = (ctx.createBiquadFilter as any).mock.results[0].value;
    expect(node.Q.value).toBe(1); // untouched node default
    expect(node.gain.value).toBe(3);
  });

  it('native-filter stays a lowpass with its existing params', () => {
    const ctx = mockAudioContext();
    createEffectInstance('native-filter', ctx, { frequency: 800, q: 3 });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const node = (ctx.createBiquadFilter as any).mock.results[0].value;
    expect(node.type).toBe('lowpass');
    expect(node.frequency.value).toBe(800);
    expect(node.Q.value).toBe(3);
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

// #657: AudioWorklet-backed effects need an async step (audioWorklet.addModule)
// on EVERY context they are created on — including the OfflineAudioContext
// exportAudio() builds internally, which the consumer never sees.
describe('prepareEffect (EffectDefinition.prepare)', () => {
  function registerWorkletEffect(prepare: (ctx: BaseAudioContext) => Promise<void>) {
    registerEffect('worklet-fx', {
      label: 'Worklet FX',
      category: 'dynamics',
      defaults: {},
      params: {},
      prepare,
      create: (ctx) => {
        const node = ctx.createGain();
        return { input: node, output: node, applyParams: () => {} };
      },
    });
  }

  it('resolves immediately for definitions without a prepare hook', async () => {
    await expect(prepareEffect('native-gain', mockAudioContext())).resolves.toBeUndefined();
  });

  it('resolves for an unknown type — create reports unknown types', async () => {
    await expect(prepareEffect('does-not-exist', mockAudioContext())).resolves.toBeUndefined();
  });

  it('runs prepare once per context, sharing concurrent and later calls', async () => {
    const prepare = vi.fn(async () => {});
    registerWorkletEffect(prepare);
    const ctx = mockAudioContext();

    await Promise.all([prepareEffect('worklet-fx', ctx), prepareEffect('worklet-fx', ctx)]);
    await prepareEffect('worklet-fx', ctx);

    expect(prepare).toHaveBeenCalledTimes(1);
    expect(prepare).toHaveBeenCalledWith(ctx);
  });

  it('prepares again on a different context (worklet modules are context-bound)', async () => {
    const prepare = vi.fn<(ctx: BaseAudioContext) => Promise<void>>(async () => {});
    registerWorkletEffect(prepare);
    const live = mockAudioContext();
    const offline = mockAudioContext();

    await prepareEffect('worklet-fx', live);
    await prepareEffect('worklet-fx', offline);

    expect(prepare.mock.calls.map((c) => c[0])).toEqual([live, offline]);
  });

  it('a failed prepare rejects with the original error and is retried next time', async () => {
    const boom = new Error('module 404');
    const prepare = vi
      .fn<(ctx: BaseAudioContext) => Promise<void>>()
      .mockRejectedValueOnce(boom)
      .mockResolvedValue(undefined);
    registerWorkletEffect(prepare);
    const ctx = mockAudioContext();

    await expect(prepareEffect('worklet-fx', ctx)).rejects.toBe(boom);
    await expect(prepareEffect('worklet-fx', ctx)).resolves.toBeUndefined();
    expect(prepare).toHaveBeenCalledTimes(2);
  });

  it('a prepare that throws synchronously rejects instead of throwing', async () => {
    registerWorkletEffect(() => {
      throw new Error('sync boom');
    });
    await expect(prepareEffect('worklet-fx', mockAudioContext())).rejects.toThrow('sync boom');
  });

  it('re-registering a type prepares the NEW definition', async () => {
    const first = vi.fn(async () => {});
    const second = vi.fn(async () => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = mockAudioContext();

    registerWorkletEffect(first);
    await prepareEffect('worklet-fx', ctx);
    registerWorkletEffect(second);
    await prepareEffect('worklet-fx', ctx);

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('create failing on an unprepared context says to prepare first', () => {
    registerEffect('worklet-fx', {
      label: 'Worklet FX',
      category: 'dynamics',
      defaults: {},
      params: {},
      prepare: async () => {},
      create: () => {
        throw new Error('not defined in AudioWorkletGlobalScope');
      },
    });

    expect(() => createEffectInstance('worklet-fx', mockAudioContext())).toThrow(
      /prepareEffect\('worklet-fx'[\s\S]*not defined in AudioWorkletGlobalScope/
    );
  });

  it('create failing AFTER a successful prepare rethrows the original error', async () => {
    const boom = new Error('real bug');
    registerEffect('worklet-fx', {
      label: 'Worklet FX',
      category: 'dynamics',
      defaults: {},
      params: {},
      prepare: async () => {},
      create: () => {
        throw boom;
      },
    });
    const ctx = mockAudioContext();
    await prepareEffect('worklet-fx', ctx);

    expect(() => createEffectInstance('worklet-fx', ctx)).toThrow(boom);
  });
});
