// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ensureWamHost = vi.fn();
const cloneInstanceInto = vi.fn();

vi.mock('../effects/loadWam', () => ({
  loadWamModule: () =>
    Promise.resolve({
      ensureWamHost: (...a: unknown[]) => ensureWamHost(...a),
      cloneInstanceInto: (...a: unknown[]) => cloneInstanceInto(...a),
    }),
}));

// effectFactory reads all 20 effect constructors from 'tone' at module load —
// every one must exist on the mock (same guard as the other WAM test files).
vi.mock('tone', () => {
  const toneEffectStub = () => ({
    dispose: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    set: vi.fn(),
    wet: { value: 0.5 },
  });
  const effectCtor = () => vi.fn(() => toneEffectStub());
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    Reverb: effectCtor(),
    Freeverb: effectCtor(),
    JCReverb: effectCtor(),
    FeedbackDelay: effectCtor(),
    PingPongDelay: effectCtor(),
    Chorus: effectCtor(),
    Phaser: effectCtor(),
    Tremolo: effectCtor(),
    Vibrato: effectCtor(),
    AutoPanner: effectCtor(),
    AutoFilter: effectCtor(),
    AutoWah: effectCtor(),
    EQ3: effectCtor(),
    Distortion: effectCtor(),
    BitCrusher: effectCtor(),
    Chebyshev: effectCtor(),
    Compressor: effectCtor(),
    Limiter: effectCtor(),
    Gate: effectCtor(),
    StereoWidener: effectCtor(),
  };
});

import { buildOfflineChain, connectOfflineChain } from '../effects/offlineChain';
import type { OfflineChainEntry } from '../effects/offlineChain';
import { getEffectDefinition } from '../effects/effectDefinitions';
import { connect } from 'tone';
import type { WamPluginInstance } from '@dawcore/wam';

const rawContext = { raw: 'offline' } as unknown as BaseAudioContext;

function nativeEntry(id: string, effectId: string): OfflineChainEntry {
  const definition = getEffectDefinition(effectId)!;
  const params: Record<string, number | string | boolean> = {};
  definition.parameters.forEach((p) => {
    params[p.name] = p.default;
  });
  return { instanceId: id, kind: 'native', definition, params };
}

function wamEntry(id: string): OfflineChainEntry {
  return {
    instanceId: id,
    kind: 'wam',
    definition: {
      id: 'wam:BigMuff',
      name: 'BigMuff',
      category: 'wam',
      description: 'WAM plugin',
      parameters: [],
    },
    params: {},
  };
}

function makeLivePlugin(): WamPluginInstance {
  return {
    url: 'https://example.com/p/index.js',
    descriptor: { name: 'BigMuff' },
    audioNode: { live: true },
    getState: vi.fn(),
    setState: vi.fn(),
    destroy: vi.fn(),
  } as unknown as WamPluginInstance;
}

describe('buildOfflineChain / connectOfflineChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureWamHost.mockResolvedValue({ hostGroupId: 'group-1' });
  });

  it('builds native entries and wires from → e1 → e2 → to in order', async () => {
    const { instances } = await buildOfflineChain(
      [nativeEntry('n1', 'reverb'), nativeEntry('n2', 'chorus')],
      () => undefined,
      rawContext
    );
    expect(instances).toHaveLength(2);

    const from = { name: 'from' };
    const to = { name: 'to' };
    connectOfflineChain(from as never, instances, to as never);
    const calls = (connect as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0][0]).toBe(from);
    expect(calls[0][1]).toBe(instances[0].effect);
    expect(calls[1][0]).toBe(instances[0].effect);
    expect(calls[1][1]).toBe(instances[1].effect);
    expect(calls[2][0]).toBe(instances[1].effect);
    expect(calls[2][1]).toBe(to);
  });

  it('re-instantiates wam entries on the offline context with the live plugin state', async () => {
    const livePlugin = makeLivePlugin();
    const cloneNode = { clone: true };
    const cloneDestroy = vi.fn();
    cloneInstanceInto.mockResolvedValue({
      url: livePlugin.url,
      descriptor: { name: 'BigMuff' },
      audioNode: cloneNode,
      getState: vi.fn(),
      setState: vi.fn(),
      destroy: cloneDestroy,
    });

    const { instances, dispose } = await buildOfflineChain(
      [wamEntry('w1')],
      (instanceId) => (instanceId === 'w1' ? livePlugin : undefined),
      rawContext
    );

    expect(ensureWamHost).toHaveBeenCalledWith(rawContext);
    expect(cloneInstanceInto).toHaveBeenCalledWith(livePlugin, rawContext, 'group-1');
    expect(instances).toHaveLength(1);
    expect(instances[0].effect).toBe(cloneNode);

    dispose();
    expect(cloneDestroy).toHaveBeenCalled();
  });

  it('preserves chain order for mixed native/wam entries', async () => {
    const livePlugin = makeLivePlugin();
    const cloneNode = { clone: true };
    cloneInstanceInto.mockResolvedValue({
      url: livePlugin.url,
      descriptor: { name: 'BigMuff' },
      audioNode: cloneNode,
      getState: vi.fn(),
      setState: vi.fn(),
      destroy: vi.fn(),
    });

    const { instances } = await buildOfflineChain(
      [nativeEntry('n1', 'reverb'), wamEntry('w1'), nativeEntry('n2', 'chorus')],
      () => livePlugin,
      rawContext
    );
    expect(instances).toHaveLength(3);
    expect(instances[1].effect).toBe(cloneNode);

    const from = { name: 'from' };
    const to = { name: 'to' };
    connectOfflineChain(from as never, instances, to as never);
    const calls = (connect as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.map((c) => [c[0], c[1]])).toEqual([
      [from, instances[0].effect],
      [instances[0].effect, cloneNode],
      [cloneNode, instances[2].effect],
      [instances[2].effect, to],
    ]);
  });

  it('connects from directly to to when there are no instances', () => {
    const from = { name: 'from' };
    const to = { name: 'to' };
    connectOfflineChain(from as never, [], to as never);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(from, to);
  });

  it('rejects with a clear error when no live plugin exists for a wam entry', async () => {
    await expect(buildOfflineChain([wamEntry('w1')], () => undefined, rawContext)).rejects.toThrow(
      /no live WAM plugin found for "BigMuff"/
    );
  });

  it('disposes already-created instances when a later clone fails (fail-loud, no leaks)', async () => {
    cloneInstanceInto.mockRejectedValue(new Error('factory exploded'));
    const livePlugin = makeLivePlugin();
    const entries = [nativeEntry('n1', 'reverb'), wamEntry('w1')];

    await expect(buildOfflineChain(entries, () => livePlugin, rawContext)).rejects.toThrow(
      'factory exploded'
    );
    // The native instance created before the failing clone must be disposed.
    // createEffectInstance's dispose() calls effect.disconnect() + effect.dispose();
    // the Reverb constructor mock returns stubs we can inspect.
    const { Reverb } = await import('tone');
    const reverbStub = (Reverb as unknown as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(reverbStub.dispose).toHaveBeenCalled();
  });
});
