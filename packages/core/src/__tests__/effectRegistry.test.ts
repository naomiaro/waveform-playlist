import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  registerEffect,
  unregisterEffect,
  getEffectDefinitions,
  createEffectInstance,
  prepareEffect,
  needsPrepare,
  ensureEffectPrepared,
  type NativeEffectDefinition,
} from '../effects/registry';

function mockAudioContext() {
  return {
    createGain: vi.fn(() => ({ connect: vi.fn(), disconnect: vi.fn(), gain: { value: 1 } })),
  } as unknown as BaseAudioContext;
}

function boost(overrides: Partial<NativeEffectDefinition> = {}): NativeEffectDefinition {
  return {
    label: 'Boost',
    category: 'dynamics',
    defaults: { amount: 2 },
    params: { amount: { min: 0, max: 4, step: 0.1, label: 'Amount' } },
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
    ...overrides,
  };
}

beforeEach(() => {
  for (const type of getEffectDefinitions().keys()) unregisterEffect(type);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('effect registry', () => {
  it('starts empty: built-ins belong to the packages that ship them', () => {
    expect(getEffectDefinitions().size).toBe(0);
  });

  it('registerEffect adds a definition and unregisterEffect removes it', () => {
    registerEffect('custom-boost', boost());
    expect(getEffectDefinitions().get('custom-boost')?.label).toBe('Boost');

    expect(unregisterEffect('custom-boost')).toBe(true);
    expect(getEffectDefinitions().has('custom-boost')).toBe(false);
    expect(unregisterEffect('custom-boost')).toBe(false);
  });

  it('re-registering a type warns and overwrites', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerEffect('custom-boost', boost());
    registerEffect('custom-boost', boost({ label: 'Replaced' }));

    expect(warn).toHaveBeenCalledWith(expect.stringContaining('[waveform-playlist]'));
    expect(getEffectDefinitions().get('custom-boost')!.label).toBe('Replaced');
  });

  it('getEffectDefinitions returns a copy', () => {
    registerEffect('custom-boost', boost());
    getEffectDefinitions().delete('custom-boost');
    expect(getEffectDefinitions().has('custom-boost')).toBe(true);
  });

  it('createEffectInstance throws on an unknown type, listing the registered ones', () => {
    registerEffect('custom-boost', boost());
    expect(() => createEffectInstance('does-not-exist', mockAudioContext())).toThrow(
      /does-not-exist[\s\S]*custom-boost/
    );
  });

  it('createEffectInstance merges defaults with overrides and applies them', () => {
    registerEffect('custom-boost', boost({ wetParam: 'amount' }));
    const ctx = mockAudioContext();
    const created = createEffectInstance('custom-boost', ctx, { amount: 0.25 });

    expect(created.params).toEqual({ amount: 0.25 });
    expect(created.wetParam).toBe('amount');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((ctx.createGain as any).mock.results[0].value.gain.value).toBe(0.25);
  });
});

describe('prepareEffect', () => {
  function registerWorkletEffect(prepare: (ctx: BaseAudioContext) => Promise<void>) {
    registerEffect('worklet-fx', boost({ prepare }));
  }

  it('resolves immediately without a prepare hook, and for an unknown type', async () => {
    registerEffect('custom-boost', boost());
    await expect(prepareEffect('custom-boost', mockAudioContext())).resolves.toBeUndefined();
    await expect(prepareEffect('does-not-exist', mockAudioContext())).resolves.toBeUndefined();
  });

  it('runs prepare once per context, sharing concurrent and later calls', async () => {
    const prepare = vi.fn<(ctx: BaseAudioContext) => Promise<void>>(async () => {});
    registerWorkletEffect(prepare);
    const live = mockAudioContext();
    const offline = mockAudioContext();

    await Promise.all([prepareEffect('worklet-fx', live), prepareEffect('worklet-fx', live)]);
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

  it('needsPrepare is true only until the current definition has prepared on that context', async () => {
    registerEffect('custom-boost', boost());
    registerWorkletEffect(async () => {});
    const ctx = mockAudioContext();

    expect(needsPrepare('custom-boost', ctx)).toBe(false);
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
    registerWorkletEffect(second);
    releaseFirst();
    await ensured;

    expect(second).toHaveBeenCalledTimes(1);
    expect(needsPrepare('worklet-fx', ctx)).toBe(false);
  });

  it('create failing on an unprepared context names the fix and keeps the cause', () => {
    const original = new Error('not defined in AudioWorkletGlobalScope');
    registerEffect(
      'worklet-fx',
      boost({
        prepare: async () => {},
        create: () => {
          throw original;
        },
      })
    );

    let thrown: (Error & { cause?: unknown }) | undefined;
    try {
      createEffectInstance('worklet-fx', mockAudioContext());
    } catch (err) {
      thrown = err as Error & { cause?: unknown };
    }
    expect(thrown?.message).toMatch(
      /prepareEffect\('worklet-fx'[\s\S]*not defined in AudioWorkletGlobalScope/
    );
    expect(thrown?.cause).toBe(original);
  });

  it('create failing after a successful prepare rethrows the original error', async () => {
    const boom = new Error('real bug');
    registerEffect(
      'worklet-fx',
      boost({
        prepare: async () => {},
        create: () => {
          throw boom;
        },
      })
    );
    const ctx = mockAudioContext();
    await prepareEffect('worklet-fx', ctx);

    expect(() => createEffectInstance('worklet-fx', ctx)).toThrow(boom);
  });
});
