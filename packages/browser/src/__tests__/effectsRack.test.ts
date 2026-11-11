import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const isNativeGlobalContext = vi.fn(() => true);
const liveContext = {
  createGain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() })),
};
vi.mock('@waveform-playlist/playout', () => ({
  isNativeGlobalContext: () => isNativeGlobalContext(),
  getGlobalAudioContext: () => liveContext,
  getGlobalContext: vi.fn(),
}));

vi.mock('@dawcore/wam', () => ({
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
  createWamInstanceFromFactory: vi.fn(),
  loadWamFactory: vi.fn(),
  cloneInstanceInto: vi.fn(),
  createParameterPanel: vi.fn(),
  createWamParameterPanel: vi.fn(),
  fetchWamLibrary: vi.fn(),
  fetchWamDescriptor: vi.fn(),
  createWamTransportBridge: vi.fn(),
}));

// effectFactory reads all 20 effect constructors from 'tone' at module load.
vi.mock('tone', () => {
  const effectCtor = (withWet: boolean) =>
    vi.fn(function () {
      return {
        dispose: vi.fn(),
        connect: vi.fn(),
        disconnect: vi.fn(),
        ...(withWet ? { wet: { value: 0.5 } } : {}),
      };
    });
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    ToneAudioNode: vi.fn(),
    Reverb: effectCtor(true),
    Freeverb: effectCtor(true),
    JCReverb: effectCtor(true),
    FeedbackDelay: effectCtor(true),
    PingPongDelay: effectCtor(true),
    Chorus: effectCtor(true),
    Phaser: effectCtor(true),
    Tremolo: effectCtor(true),
    Vibrato: effectCtor(true),
    AutoPanner: effectCtor(true),
    AutoFilter: effectCtor(true),
    AutoWah: effectCtor(true),
    EQ3: effectCtor(false),
    Distortion: effectCtor(true),
    BitCrusher: effectCtor(true),
    Chebyshev: effectCtor(true),
    Compressor: effectCtor(false),
    Limiter: effectCtor(false),
    Gate: effectCtor(false),
    StereoWidener: effectCtor(true),
  };
});

import { connect, disconnect } from 'tone';
import type { ToneAudioNode } from 'tone';
import {
  registerEffect,
  unregisterEffect,
  getEffectDefinitions,
  type NativeEffectDefinition,
} from '@waveform-playlist/core';
import { EffectsRack } from '../effects/effectsRack';
import { getAvailableEffects } from '../effects/customEffectFactory';
import { effectDefinitions } from '../effects/effectDefinitions';

interface FakeNode {
  name: string;
  connect: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  context: { rawContext: unknown };
}

function fakeNode(name: string, rawContext: unknown = liveContext): FakeNode {
  return { name, connect: vi.fn(), disconnect: vi.fn(), context: { rawContext } };
}
const last = <T>(items: T[]): T => items[items.length - 1];
const asTone = (node: FakeNode) => node as unknown as ToneAudioNode;

/** What the rack built, in creation order. */
const built: Array<{
  input: { id: string };
  output: { id: string };
  applied: Record<string, number>[];
  dispose: ReturnType<typeof vi.fn>;
  context: unknown;
}> = [];

function tremolo(overrides: Partial<NativeEffectDefinition> = {}): NativeEffectDefinition {
  return {
    label: 'Tremolo (worklet)',
    category: 'my-plugins',
    defaults: { rate: 5, depth: 0.5 },
    params: {
      rate: { min: 0.1, max: 20, step: 0.1, unit: 'Hz', label: 'Rate' },
      depth: { min: 0, max: 1, step: 0.01 },
    },
    create: (ctx) => {
      const n = built.length;
      const record = {
        input: { id: 'in' + n },
        output: { id: 'out' + n },
        applied: [] as Record<string, number>[],
        dispose: vi.fn(),
        context: ctx as unknown,
      };
      built.push(record);
      return {
        input: record.input as unknown as AudioNode,
        output: record.output as unknown as AudioNode,
        applyParams: (p) => record.applied.push({ ...p }),
        dispose: record.dispose,
      };
    },
    ...overrides,
  };
}

/** [from, to] pairs handed to Tone's connect() since the last clear. */
const edges = () =>
  vi
    .mocked(connect)
    .mock.calls.map(([from, to]) => [
      (from as unknown as { name?: string; id?: string }).name ??
        (from as unknown as { id: string }).id,
      (to as unknown as { name?: string; id?: string }).name ??
        (to as unknown as { id: string }).id,
    ]);

beforeEach(() => {
  vi.clearAllMocks();
  built.length = 0;
  isNativeGlobalContext.mockReturnValue(true);
  for (const type of getEffectDefinitions().keys()) unregisterEffect(type);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('EffectsRack: custom (registered) effects', () => {
  it('add() prepares the type on the live context, then creates it with its defaults', async () => {
    const order: string[] = [];
    const prepare = vi.fn(async () => {
      order.push('prepare');
    });
    const definition = tremolo({ prepare });
    const create = definition.create;
    definition.create = (ctx, params) => {
      order.push('create');
      return create(ctx, params);
    };
    registerEffect('my-tremolo', definition);
    const rack = new EffectsRack();

    const id = await rack.add('my-tremolo');

    expect(order).toEqual(['prepare', 'create']);
    expect(prepare).toHaveBeenCalledWith(liveContext);
    expect(built[0].context).toBe(liveContext);
    const [entry] = rack.effects.getSnapshot();
    expect(entry).toMatchObject({
      instanceId: id,
      effectId: 'my-tremolo',
      kind: 'custom',
      params: { rate: 5, depth: 0.5 },
      bypassed: false,
    });
    expect(entry.definition).toMatchObject({
      id: 'my-tremolo',
      name: 'Tremolo (worklet)',
      category: 'my-plugins',
    });
    expect(entry.definition.parameters).toEqual([
      {
        name: 'rate',
        label: 'Rate',
        type: 'number',
        min: 0.1,
        max: 20,
        step: 0.1,
        unit: 'Hz',
        default: 5,
      },
      { name: 'depth', label: 'depth', type: 'number', min: 0, max: 1, step: 0.01, default: 0.5 },
    ]);
  });

  it('add() rejects for an unknown id and adds nothing', async () => {
    const rack = new EffectsRack();
    await expect(rack.add('nope')).rejects.toThrow(/Unknown effect "nope"/);
    expect(rack.effects.getSnapshot()).toEqual([]);
  });

  it('add() rejects on a standardized context, before preparing', async () => {
    const prepare = vi.fn(async () => {});
    registerEffect('my-tremolo', tremolo({ prepare }));
    isNativeGlobalContext.mockReturnValue(false);
    const rack = new EffectsRack();

    await expect(rack.add('my-tremolo')).rejects.toThrow(/nativeAudioContext: true/);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('add() rejects with the prepare error and adds nothing', async () => {
    registerEffect(
      'my-tremolo',
      tremolo({
        prepare: async () => {
          throw new Error('module 404');
        },
      })
    );
    const rack = new EffectsRack();
    await expect(rack.add('my-tremolo')).rejects.toThrow('module 404');
    expect(rack.effects.getSnapshot()).toEqual([]);
    expect(built).toHaveLength(0);
  });

  it('wires input and output separately, in order, between the attachment points', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    const from = fakeNode('from');
    const to = fakeNode('to');
    rack.attach(asTone(from), asTone(to));
    expect(from.connect).toHaveBeenCalledWith(to);

    await rack.add('my-tremolo');
    vi.mocked(connect).mockClear();
    await rack.add('my-tremolo');

    expect(from.disconnect).toHaveBeenCalled();
    expect(edges()).toEqual([
      ['from', 'in0'],
      ['out0', 'in1'],
      ['out1', 'to'],
    ]);
  });

  it('updateParameter applies the value in place without rewiring', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    rack.attach(asTone(fakeNode('from')), asTone(fakeNode('to')));
    const id = await rack.add('my-tremolo');
    vi.mocked(connect).mockClear();
    const before = rack.effects.getSnapshot();

    rack.updateParameter(id, 'rate', 9);

    expect(last(built[0].applied)).toEqual({ rate: 9 });
    expect(rack.effects.getSnapshot()).not.toBe(before);
    expect(rack.effects.getSnapshot()[0].params).toEqual({ rate: 9, depth: 0.5 });
    expect(connect).not.toHaveBeenCalled();
  });

  it('bypass without a wet parameter takes the effect out of the chain, and back', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    const from = fakeNode('from');
    const to = fakeNode('to');
    rack.attach(asTone(from), asTone(to));
    const id = await rack.add('my-tremolo');
    vi.mocked(connect).mockClear();
    vi.mocked(disconnect).mockClear();
    from.connect.mockClear();

    rack.toggleBypass(id);
    expect(rack.effects.getSnapshot()[0].bypassed).toBe(true);
    expect(edges()).toEqual([]);
    // The chain is not left cut: the signal goes straight through.
    expect(from.connect).toHaveBeenCalledTimes(1);
    expect(from.connect).toHaveBeenCalledWith(to);
    // Its output no longer feeds the chain: a worklet that makes sound with
    // no input must fall silent too.
    expect(disconnect).toHaveBeenCalledWith(built[0].output);

    vi.mocked(connect).mockClear();
    rack.toggleBypass(id);
    expect(edges()).toEqual([
      ['from', 'in0'],
      ['out0', 'to'],
    ]);
  });

  it('bypass with a wet parameter zeroes it in place and restores the set value', async () => {
    registerEffect('my-tremolo', tremolo({ defaults: { rate: 5, depth: 0.5 }, wetParam: 'depth' }));
    const rack = new EffectsRack();
    rack.attach(asTone(fakeNode('from')), asTone(fakeNode('to')));
    const id = await rack.add('my-tremolo');
    rack.updateParameter(id, 'depth', 0.8);
    vi.mocked(connect).mockClear();

    rack.toggleBypass(id);
    expect(last(built[0].applied)).toEqual({ depth: 0 });
    expect(connect).not.toHaveBeenCalled();

    // A wet change while bypassed is stored, not heard.
    rack.updateParameter(id, 'depth', 0.3);
    expect(last(built[0].applied)).toEqual({ depth: 0 });
    expect(rack.effects.getSnapshot()[0].params.depth).toBe(0.3);

    rack.toggleBypass(id);
    expect(last(built[0].applied)).toEqual({ depth: 0.3 });
  });

  it('reorder rewires in the new order; remove disposes the instance', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    rack.attach(asTone(fakeNode('from')), asTone(fakeNode('to')));
    const first = await rack.add('my-tremolo');
    await rack.add('my-tremolo');
    vi.mocked(connect).mockClear();

    rack.reorder(0, 1);
    expect(edges()).toEqual([
      ['from', 'in1'],
      ['out1', 'in0'],
      ['out0', 'to'],
    ]);

    vi.mocked(connect).mockClear();
    rack.remove(first);
    expect(built[0].dispose).toHaveBeenCalledTimes(1);
    expect(edges()).toEqual([
      ['from', 'in1'],
      ['out1', 'to'],
    ]);
  });

  it('detaching disconnects the chain tail from that destination only', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    const oldTo = fakeNode('old');
    const detachOld = rack.attach(asTone(fakeNode('from')), asTone(oldTo));
    await rack.add('my-tremolo');
    const newFrom = fakeNode('from2');
    const newTo = fakeNode('new');
    rack.attach(asTone(newFrom), asTone(newTo));
    vi.mocked(connect).mockClear();
    vi.mocked(disconnect).mockClear();

    detachOld();
    expect(disconnect).toHaveBeenCalledWith(built[0].output, oldTo);

    // The newer attachment is still the live one.
    await rack.add('my-tremolo');
    expect(last(edges())).toEqual(['out1', 'new']);
  });
});

describe('EffectsRack: built-in Tone effects', () => {
  it('add() publishes synchronously, before the returned promise settles', () => {
    const rack = new EffectsRack();
    void rack.add('reverb');
    expect(rack.effects.getSnapshot()).toHaveLength(1);
    expect(rack.effects.getSnapshot()[0]).toMatchObject({ kind: 'tone', wetParam: 'wet' });
  });

  it('a built-in id wins over a registered type of the same name', async () => {
    registerEffect('reverb', tremolo());
    const rack = new EffectsRack();
    await rack.add('reverb');
    expect(rack.effects.getSnapshot()[0].kind).toBe('tone');
    expect(built).toHaveLength(0);
  });

  it('an effect with no wet control (compressor) is bypassed by disconnection', async () => {
    const rack = new EffectsRack();
    const from = fakeNode('from');
    const to = fakeNode('to');
    rack.attach(asTone(from), asTone(to));
    const id = await rack.add('compressor');
    expect(rack.effects.getSnapshot()[0].wetParam).toBeUndefined();
    const compressor = vi.mocked(connect).mock.calls[0][1] as unknown as {
      disconnect: ReturnType<typeof vi.fn>;
    };
    vi.mocked(connect).mockClear();
    compressor.disconnect.mockClear();
    from.connect.mockClear();

    rack.toggleBypass(id);
    expect(connect).not.toHaveBeenCalled();
    expect(compressor.disconnect).toHaveBeenCalled();
    expect(from.connect).toHaveBeenCalledWith(to);
    rack.toggleBypass(id);
    expect(connect).toHaveBeenCalledTimes(2);
  });

  it('notifies subscribers once per change', async () => {
    const rack = new EffectsRack();
    const listener = vi.fn();
    rack.effects.subscribe(listener);
    const id = await rack.add('reverb');
    rack.updateParameter(id, 'decay', 3);
    rack.toggleBypass(id);
    rack.remove(id);
    expect(listener).toHaveBeenCalledTimes(4);
  });
});

describe('EffectsRack: failures and edge cases', () => {
  it('a wiring failure restores the previous chain, drops the new instance and publishes nothing', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    const from = fakeNode('from');
    rack.attach(asTone(from), asTone(fakeNode('to')));
    await rack.add('my-tremolo');
    const listener = vi.fn();
    rack.effects.subscribe(listener);
    vi.mocked(connect).mockClear();
    // The second effect cannot be connected (a node on another context, say).
    vi.mocked(connect).mockImplementation((_source, destination) => {
      if ((destination as unknown as { id?: string }).id === 'in1') {
        throw new Error('different AudioContext');
      }
    });

    await expect(rack.add('my-tremolo')).rejects.toThrow('different AudioContext');
    const afterFailure = edges();
    vi.mocked(connect).mockReset();

    expect(rack.effects.getSnapshot()).toHaveLength(1);
    expect(listener).not.toHaveBeenCalled();
    expect(built[1].dispose).toHaveBeenCalledTimes(1);
    // The last connections made are the previous chain, whole again.
    expect(afterFailure.slice(-2)).toEqual([
      ['from', 'in0'],
      ['out0', 'to'],
    ]);

    // The bookkeeping is not stuck on the failed layout: the next add wires.
    vi.mocked(connect).mockClear();
    await rack.add('my-tremolo');
    expect(edges()).toEqual([
      ['from', 'in0'],
      ['out0', 'in2'],
      ['out2', 'to'],
    ]);
  });

  it('a remove whose rewire fails changes nothing: the effect stays, alive and listed', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    rack.attach(asTone(fakeNode('from')), asTone(fakeNode('to')));
    const first = await rack.add('my-tremolo');
    await rack.add('my-tremolo');
    const before = rack.effects.getSnapshot();
    vi.mocked(connect).mockClear();
    // Wiring the chain without the first effect fails once.
    vi.mocked(connect).mockImplementationOnce(() => {
      throw new Error('cannot connect');
    });

    expect(() => rack.remove(first)).toThrow('cannot connect');

    expect(rack.effects.getSnapshot()).toBe(before);
    expect(built[0].dispose).not.toHaveBeenCalled();
    // The restored graph is the listed chain, both effects in it.
    expect(edges().slice(-3)).toEqual([
      ['from', 'in0'],
      ['out0', 'in1'],
      ['out1', 'to'],
    ]);

    // A second attempt goes through.
    rack.remove(first);
    expect(rack.effects.getSnapshot()).toHaveLength(1);
    expect(built[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('clear() always ends empty, even when the graph cannot be rewired', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    const from = fakeNode('from');
    rack.attach(asTone(from), asTone(fakeNode('to')));
    await rack.add('my-tremolo');
    from.connect.mockImplementation(() => {
      throw new Error('dead node');
    });

    expect(() => rack.clear()).toThrow('dead node');

    expect(rack.effects.getSnapshot()).toEqual([]);
    expect(built[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('when even the restore fails, the next change wires the whole chain again', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    rack.attach(asTone(fakeNode('from')), asTone(fakeNode('to')));
    const first = await rack.add('my-tremolo');
    await rack.add('my-tremolo');
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.mocked(connect).mockImplementation(() => {
      throw new Error('context closed');
    });

    expect(() => rack.reorder(0, 1)).toThrow('context closed');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Could not restore'));
    vi.mocked(connect).mockReset();

    // A parameter change never rewires a chain that is wired. This one is
    // not: the graph was left cut, and the rack knows it.
    rack.updateParameter(first, 'rate', 9);

    expect(edges()).toEqual([
      ['from', 'in0'],
      ['out0', 'in1'],
      ['out1', 'to'],
    ]);
  });

  it('an attach that cannot be wired is not kept', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    await rack.add('my-tremolo');
    vi.mocked(connect).mockImplementationOnce(() => {
      throw new Error('different AudioContext');
    });

    expect(() => rack.attach(asTone(fakeNode('from')), asTone(fakeNode('to')))).toThrow(
      'different AudioContext'
    );
    vi.mocked(connect).mockClear();

    // Not attached: a later change connects to nothing.
    await rack.add('my-tremolo');
    expect(connect).not.toHaveBeenCalled();
  });

  it('rejects and appends nothing when create throws after a successful prepare', async () => {
    registerEffect(
      'my-tremolo',
      tremolo({
        prepare: async () => {},
        create: () => {
          throw new Error('bad options');
        },
      })
    );
    const rack = new EffectsRack();
    await expect(rack.add('my-tremolo')).rejects.toThrow('bad options');
    expect(rack.effects.getSnapshot()).toEqual([]);
  });

  it('a type registered again while it was preparing is added as the new definition', async () => {
    let release: () => void = () => {};
    registerEffect(
      'my-tremolo',
      tremolo({
        prepare: () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      })
    );
    const rack = new EffectsRack();
    const pending = rack.add('my-tremolo');
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    registerEffect(
      'my-tremolo',
      tremolo({ label: 'Tremolo v2', defaults: { rate: 2, depth: 1 }, wetParam: 'depth' })
    );
    release();
    await pending;

    const [entry] = rack.effects.getSnapshot();
    expect(entry.definition.name).toBe('Tremolo v2');
    expect(entry.params).toEqual({ rate: 2, depth: 1 });
    expect(entry.wetParam).toBe('depth');
    expect(built[0].applied[0]).toEqual({ rate: 2, depth: 1 });
  });

  it('clear() disposes every instance, wires straight through, drops an add still preparing, and leaves the rack usable', async () => {
    let release: () => void = () => {};
    registerEffect('my-tremolo', tremolo());
    registerEffect(
      'slow',
      tremolo({
        prepare: () =>
          new Promise<void>((resolve) => {
            release = resolve;
          }),
      })
    );
    const rack = new EffectsRack();
    const from = fakeNode('from');
    const to = fakeNode('to');
    rack.attach(asTone(from), asTone(to));
    await rack.add('my-tremolo');
    await rack.add('reverb');
    const pending = rack.add('slow');
    const rejected = expect(pending).rejects.toThrow(/cleared before the effect was ready/);
    from.connect.mockClear();

    rack.clear();
    release();
    await rejected;

    expect(rack.effects.getSnapshot()).toEqual([]);
    expect(built[0].dispose).toHaveBeenCalledTimes(1);
    expect(built).toHaveLength(1);
    expect(from.connect).toHaveBeenCalledWith(to);

    await rack.add('my-tremolo');
    expect(rack.effects.getSnapshot()).toHaveLength(1);
  });

  it('releases the instances of a rack that has been garbage-collected', async () => {
    // A stand-in for FinalizationRegistry: collection cannot be forced here.
    const registered: Array<{ target: object; held: unknown }> = [];
    let onCollected: (held: unknown) => void = () => {};
    // Restored by afterEach (vi.unstubAllGlobals), also when an assertion fails.
    vi.stubGlobal(
      'FinalizationRegistry',
      class {
        constructor(callback: (held: unknown) => void) {
          onCollected = callback;
        }
        register(target: object, held: unknown) {
          registered.push({ target, held });
        }
      }
    );
    vi.resetModules();
    const { EffectsRack: FreshRack } = await import('../effects/effectsRack');
    registerEffect('my-tremolo', tremolo());

    const rack = new FreshRack();
    await rack.add('my-tremolo');
    expect(registered).toHaveLength(1);
    expect(registered[0].target).toBe(rack);
    // What is held must not keep the rack itself alive.
    expect(registered[0].held).not.toBe(rack);
    expect(built[0].dispose).not.toHaveBeenCalled();

    onCollected(registered[0].held);

    expect(built[0].dispose).toHaveBeenCalledTimes(1);
  });

  it('after the current attachment is detached, a later add connects to nothing', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    const detach = rack.attach(asTone(fakeNode('from')), asTone(fakeNode('to')));
    detach();
    vi.mocked(connect).mockClear();

    await rack.add('my-tremolo');

    expect(rack.effects.getSnapshot()).toHaveLength(1);
    expect(connect).not.toHaveBeenCalled();
  });

  it('reorder out of range and remove of an unknown id change nothing', async () => {
    const rack = new EffectsRack();
    await rack.add('reverb');
    await rack.add('chorus');
    const before = rack.effects.getSnapshot();
    const listener = vi.fn();
    rack.effects.subscribe(listener);

    rack.reorder(0, 2);
    rack.reorder(-1, 0);
    rack.reorder(1, 1);
    rack.remove('nope');
    rack.updateParameter('nope', 'wet', 1);
    rack.toggleBypass('nope');

    expect(listener).not.toHaveBeenCalled();
    expect(rack.effects.getSnapshot()).toBe(before);
  });

  it('un-bypass restores a wet level of 1 when none was ever set', async () => {
    registerEffect('my-tremolo', tremolo({ defaults: { rate: 5 }, wetParam: 'mix' }));
    const rack = new EffectsRack();
    const id = await rack.add('my-tremolo');

    rack.toggleBypass(id);
    expect(last(built[0].applied)).toEqual({ mix: 0 });
    rack.toggleBypass(id);
    expect(last(built[0].applied)).toEqual({ mix: 1 });
  });

  it('a value that is not a number is not stored or applied for a registered effect', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    const id = await rack.add('my-tremolo');
    const before = rack.effects.getSnapshot();
    const applied = built[0].applied.length;

    rack.updateParameter(id, 'rate', 'fast');
    rack.updateParameter(id, 'rate', true);

    expect(rack.effects.getSnapshot()).toBe(before);
    expect(built[0].applied).toHaveLength(applied);
  });

  it('a dispose that throws is reported and does not stop the removal', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    const id = await rack.add('my-tremolo');
    built[0].dispose.mockImplementation(() => {
      throw new Error('already closed');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    expect(() => rack.remove(id)).not.toThrow();

    expect(rack.effects.getSnapshot()).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('already closed'));
  });

  it('a parameter with no default starts at its minimum', async () => {
    registerEffect(
      'my-tremolo',
      tremolo({ defaults: {}, params: { rate: { min: 0.1, max: 20 } } })
    );
    const rack = new EffectsRack();
    await rack.add('my-tremolo');
    expect(rack.effects.getSnapshot()[0].definition.parameters).toEqual([
      { name: 'rate', label: 'rate', type: 'number', min: 0.1, max: 20, default: 0.1 },
    ]);
  });
});

describe('EffectsRack: offline function', () => {
  it('passes the audio straight through when nothing is active, building nothing', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    const id = await rack.add('my-tremolo');
    rack.toggleBypass(id);
    vi.mocked(connect).mockClear();

    await rack.renderOffline(asTone(fakeNode('f')), asTone(fakeNode('t')));

    expect(built).toHaveLength(1);
    expect(edges()).toEqual([['f', 't']]);
  });

  it('prepares a custom effect on the OFFLINE context and creates it there with the live params', async () => {
    const prepare = vi.fn<(ctx: BaseAudioContext) => Promise<void>>(async () => {});
    registerEffect('my-tremolo', tremolo({ prepare }));
    const rack = new EffectsRack();
    const id = await rack.add('my-tremolo');
    rack.updateParameter(id, 'rate', 12);
    const offlineContext = { offline: true };
    const from = fakeNode('offlineFrom', offlineContext);
    const to = fakeNode('offlineTo', offlineContext);
    vi.mocked(connect).mockClear();

    const cleanup = await rack.renderOffline(asTone(from), asTone(to));

    expect(prepare.mock.calls.map((c) => c[0])).toEqual([liveContext, offlineContext]);
    expect(built).toHaveLength(2);
    expect(built[1].context).toBe(offlineContext);
    expect(built[1].applied[0]).toEqual({ rate: 12, depth: 0.5 });
    expect(edges()).toEqual([
      ['offlineFrom', 'in1'],
      ['out1', 'offlineTo'],
    ]);

    cleanup();
    expect(built[1].dispose).toHaveBeenCalledTimes(1);
    expect(built[0].dispose).not.toHaveBeenCalled();
  });

  it('rejects when the offline prepare fails: no export without an effect the chain has', async () => {
    const prepare = vi
      .fn<(ctx: BaseAudioContext) => Promise<void>>()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('offline module 404'));
    registerEffect('my-tremolo', tremolo({ prepare }));
    const rack = new EffectsRack();
    await rack.add('reverb');
    await rack.add('my-tremolo');
    const offlineContext = { offline: true };

    await expect(
      rack.renderOffline(
        asTone(fakeNode('f', offlineContext)),
        asTone(fakeNode('t', offlineContext))
      )
    ).rejects.toThrow('offline module 404');
  });

  it('rejects for a custom effect on a standardized context', async () => {
    registerEffect('my-tremolo', tremolo());
    const rack = new EffectsRack();
    await rack.add('my-tremolo');
    const offline = rack.renderOffline;
    isNativeGlobalContext.mockReturnValue(false);
    await expect(offline(asTone(fakeNode('f')), asTone(fakeNode('t')))).rejects.toThrow(
      /nativeAudioContext: true/
    );
  });
});

describe('getAvailableEffects', () => {
  it('lists the built-ins, then registered types, and keeps its identity until the registry changes', () => {
    const before = getAvailableEffects();
    expect(before).toBe(effectDefinitions);

    registerEffect('my-tremolo', tremolo());
    const after = getAvailableEffects();
    expect(after).toHaveLength(effectDefinitions.length + 1);
    expect(last(after)).toMatchObject({ id: 'my-tremolo', category: 'my-plugins' });
    expect(getAvailableEffects()).toBe(after);

    unregisterEffect('my-tremolo');
    expect(getAvailableEffects()).toBe(effectDefinitions);
  });

  it('does not list a registered type under a built-in id a second time', () => {
    registerEffect('reverb', tremolo());
    registerEffect('my-tremolo', tremolo());
    const ids = getAvailableEffects().map((definition) => definition.id);
    expect(ids.filter((id) => id === 'reverb')).toHaveLength(1);
    expect(ids).toHaveLength(effectDefinitions.length + 1);
  });

  it("leaves out another host library's own catalogue, which can still be added by id", async () => {
    // What @dawcore/components does for its native-* effects on import.
    registerEffect('native-compressor', tremolo({ label: 'Compressor', builtIn: true }));
    registerEffect('my-tremolo', tremolo());

    const ids = getAvailableEffects().map((definition) => definition.id);
    expect(ids).not.toContain('native-compressor');
    expect(ids).toContain('my-tremolo');

    const rack = new EffectsRack();
    await rack.add('native-compressor');
    expect(rack.effects.getSnapshot()[0]).toMatchObject({
      effectId: 'native-compressor',
      kind: 'custom',
    });
  });

  it('lists only the built-ins outside native-context mode, where a registered effect cannot be added', () => {
    registerEffect('my-tremolo', tremolo());
    isNativeGlobalContext.mockReturnValue(false);
    expect(getAvailableEffects()).toBe(effectDefinitions);
    isNativeGlobalContext.mockReturnValue(true);
    expect(getAvailableEffects()).toHaveLength(effectDefinitions.length + 1);
  });
});
