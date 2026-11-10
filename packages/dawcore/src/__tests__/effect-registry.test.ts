import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerEffect,
  getEffectDefinitions,
  createEffectInstance,
  prepareEffect,
  needsPrepare,
  ensureEffectPrepared,
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

  it('the prepare hint keeps the original error as its cause', () => {
    const original = new DOMException(
      'not defined in AudioWorkletGlobalScope',
      'InvalidStateError'
    );
    registerEffect('worklet-fx', {
      label: 'Worklet FX',
      category: 'dynamics',
      defaults: {},
      params: {},
      prepare: async () => {},
      create: () => {
        throw original;
      },
    });

    let thrown: (Error & { cause?: unknown }) | undefined;
    try {
      createEffectInstance('worklet-fx', mockAudioContext());
    } catch (err) {
      thrown = err as Error & { cause?: unknown };
    }
    expect(thrown?.cause).toBe(original);
  });

  it('needsPrepare is true only until the current definition has prepared on that context', async () => {
    registerWorkletEffect(async () => {});
    const ctx = mockAudioContext();

    expect(needsPrepare('native-gain', ctx)).toBe(false);
    expect(needsPrepare('does-not-exist', ctx)).toBe(false);
    expect(needsPrepare('worklet-fx', ctx)).toBe(true);
    await prepareEffect('worklet-fx', ctx);
    expect(needsPrepare('worklet-fx', ctx)).toBe(false);
    expect(needsPrepare('worklet-fx', mockAudioContext())).toBe(true);
  });

  it('ensureEffectPrepared covers a type re-registered while the old definition was preparing', async () => {
    let releaseFirst: () => void = () => {};
    const first = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          releaseFirst = resolve;
        })
    );
    const second = vi.fn(async () => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = mockAudioContext();

    registerWorkletEffect(first);
    const ensured = ensureEffectPrepared('worklet-fx', ctx);
    registerWorkletEffect(second); // re-registered mid-flight
    releaseFirst();
    await ensured;

    // create() will run the NEW definition — it must be the one prepared.
    expect(second).toHaveBeenCalledTimes(1);
    expect(needsPrepare('worklet-fx', ctx)).toBe(false);
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
