// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';

const ensureWamHost = vi.fn().mockResolvedValue({ hostGroupId: 'group-1' });
const fakeAudioNode = { ctx: 'native' };
const destroy = vi.fn();
const createWamInstance = vi.fn().mockResolvedValue({
  url: 'https://example.com/p/index.js',
  descriptor: { name: 'BigMuff' },
  audioNode: fakeAudioNode,
  getState: vi.fn(),
  setState: vi.fn(),
  getParameterInfo: vi.fn(),
  destroy,
});
const cloneInstanceInto = vi.fn();

vi.mock('@dawcore/wam', () => ({
  ensureWamHost: (...a: unknown[]) => ensureWamHost(...a),
  createWamInstance: (...a: unknown[]) => createWamInstance(...a),
  // strict-mock sweep guard: include every export the hook may touch
  createWamInstanceFromFactory: vi.fn(),
  loadWamFactory: vi.fn(),
  cloneInstanceInto: (...a: unknown[]) => cloneInstanceInto(...a),
  createParameterPanel: vi.fn(),
  createWamParameterPanel: vi.fn(),
  fetchWamLibrary: vi.fn(),
  fetchWamDescriptor: vi.fn(),
  createWamTransportBridge: vi.fn(),
}));

const isNativeGlobalContext = vi.fn(() => true);
vi.mock('@waveform-playlist/playout', () => ({
  isNativeGlobalContext: () => isNativeGlobalContext(),
  getGlobalAudioContext: () => ({ sampleRate: 48000 }),
  // effectFactory establishes the shared context before building a Tone effect
  getGlobalContext: vi.fn(),
}));

// The hook's import graph evaluates effectFactory at module load, which reads
// all 20 effect constructors from 'tone' — every one must exist on the mock.
vi.mock('tone', () => {
  const toneEffectStub = () => ({
    dispose: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    set: vi.fn(),
    wet: { value: 0.5 },
  });
  const effectCtor = () =>
    vi.fn(function () {
      return toneEffectStub();
    });
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    Analyser: vi.fn(function () {
      return { connect: vi.fn(), dispose: vi.fn() };
    }),
    Volume: vi.fn(),
    ToneAudioNode: vi.fn(),
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

import React from 'react';
import { useDynamicEffects } from '../hooks/useDynamicEffects';
import { connect } from 'tone';
import type { Volume, ToneAudioNode } from 'tone';

describe('useDynamicEffects — WAM entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativeGlobalContext.mockReturnValue(true);
  });

  afterEach(async () => {
    // RTL teardown inside act() — React 19 unmount flushes effects
    await act(async () => {
      cleanup();
    });
  });

  it('addWamEffect hosts the plugin and appends a wam entry', async () => {
    const { result } = renderHook(() => useDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffect('https://example.com/p/index.js');
    });
    expect(ensureWamHost).toHaveBeenCalled();
    expect(createWamInstance).toHaveBeenCalledWith(
      'https://example.com/p/index.js',
      expect.anything(),
      'group-1',
      undefined
    );
    const entry = result.current.effects.getSnapshot().find((e) => e.instanceId === id);
    expect(entry?.kind).toBe('wam');
    expect(entry?.definition.name).toBe('BigMuff');
    expect(result.current.getWamPlugin(id)?.audioNode).toBe(fakeAudioNode);
  });

  it('rejects with the configure-native-context error on a standardized context', async () => {
    isNativeGlobalContext.mockReturnValue(false);
    const { result } = renderHook(() => useDynamicEffects());
    await expect(result.current.addWamEffect('https://x/y.js')).rejects.toThrow(
      /nativeAudioContext: true/
    );
  });

  it('native addEffect entries carry kind "tone"', () => {
    const { result } = renderHook(() => useDynamicEffects());
    act(() => {
      void result.current.addEffect('reverb');
    });
    expect(result.current.effects.getSnapshot()[0].kind).toBe('tone');
  });

  it('removeEffect on a wam entry destroys the plugin', async () => {
    const { result } = renderHook(() => useDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffect('https://example.com/p/index.js');
    });
    act(() => result.current.removeEffect(id));
    expect(destroy).toHaveBeenCalled();
    expect(result.current.effects.getSnapshot()).toHaveLength(0);
  });

  it('addWamEffect works under StrictMode double-invoked effects', async () => {
    // StrictMode itself as the wrapper: a function component that returns
    // <StrictMode> does not get this hook's effects double-invoked.
    const wrapper = React.StrictMode;
    const { result } = renderHook(() => useDynamicEffects(), { wrapper });
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffect('https://example.com/p/index.js');
    });
    expect(id).toMatch(/^wam_/);
    expect(result.current.effects.getSnapshot().some((e) => e.instanceId === id)).toBe(true);
  });

  it('addWamEffect dropped by a clear while loading destroys the plugin and appends nothing', async () => {
    let resolvePlugin!: (value: unknown) => void;
    const pluginPromise = new Promise((resolve) => {
      resolvePlugin = resolve;
    });
    createWamInstance.mockImplementationOnce(() => pluginPromise);

    const { result } = renderHook(() => useDynamicEffects());

    let addPromise: Promise<string> = Promise.resolve('');
    act(() => {
      addPromise = result.current.addWamEffect('https://example.com/p/index.js');
    });

    act(() => {
      result.current.clearAllEffects();
    });

    resolvePlugin({
      url: 'https://example.com/p/index.js',
      descriptor: { name: 'BigMuff' },
      audioNode: fakeAudioNode,
      getState: vi.fn(),
      setState: vi.fn(),
      getParameterInfo: vi.fn(),
      destroy,
    });

    await expect(addPromise).rejects.toThrow(/cleared before the plugin finished loading/);
    expect(destroy).toHaveBeenCalled();
    expect(result.current.effects.getSnapshot().some((e) => e.kind === 'wam')).toBe(false);
  });

  it('toggleBypass excludes the wam node from the rebuilt chain, and re-includes it on un-bypass', async () => {
    const { result } = renderHook(() => useDynamicEffects());

    let id = '';
    await act(async () => {
      id = await result.current.addWamEffect('https://example.com/p/index.js');
    });

    const mockVolume = { connect: vi.fn(), disconnect: vi.fn() } as unknown as Volume;
    const mockDestination = { connect: vi.fn() } as unknown as ToneAudioNode;

    act(() => {
      result.current.masterEffects(mockVolume, mockDestination, false);
    });

    (connect as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      result.current.toggleBypass(id);
    });

    expect(connect).not.toHaveBeenCalledWith(expect.anything(), fakeAudioNode);
    expect(connect).not.toHaveBeenCalledWith(fakeAudioNode, expect.anything());

    act(() => {
      result.current.toggleBypass(id);
    });

    expect(connect).toHaveBeenCalledWith(mockVolume, fakeAudioNode);
  });

  it('createOfflineEffectsFunction clones wam entries onto the offline context, wires and cleans up', async () => {
    const cloneDestroy = vi.fn();
    const cloneNode = { ctx: 'offline' };
    cloneInstanceInto.mockResolvedValueOnce({
      url: 'https://example.com/p/index.js',
      descriptor: { name: 'BigMuff' },
      audioNode: cloneNode,
      getState: vi.fn(),
      setState: vi.fn(),
      getParameterInfo: vi.fn(),
      destroy: cloneDestroy,
    });

    const { result } = renderHook(() => useDynamicEffects());
    await act(async () => {
      await result.current.addWamEffect('https://example.com/p/index.js');
    });

    const offline = result.current.createOfflineEffectsFunction();
    expect(offline).toBeDefined();

    const rawContext = { raw: 'offline' };
    const masterVolume = { context: { rawContext }, connect: vi.fn() } as unknown as Volume;
    const destination = { name: 'destination' } as unknown as ToneAudioNode;

    const cleanup = await offline!(masterVolume, destination, true);

    expect(ensureWamHost).toHaveBeenLastCalledWith(rawContext);
    expect(cloneInstanceInto).toHaveBeenCalledWith(
      expect.objectContaining({ audioNode: fakeAudioNode }),
      rawContext,
      'group-1'
    );
    expect(connect).toHaveBeenCalledWith(masterVolume, cloneNode);
    expect(connect).toHaveBeenCalledWith(cloneNode, destination);

    (cleanup as () => void)();
    expect(cloneDestroy).toHaveBeenCalled();
  });

  it('the offline function leaves out a bypassed wam entry and passes the audio straight through', async () => {
    const { result } = renderHook(() => useDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffect('https://example.com/p/index.js');
    });
    act(() => result.current.toggleBypass(id));
    vi.mocked(connect).mockClear();
    const master = { context: { rawContext: {} } } as unknown as Volume;
    const destination = {} as unknown as ToneAudioNode;

    await result.current.createOfflineEffectsFunction()(master, destination, true);

    expect(cloneInstanceInto).not.toHaveBeenCalled();
    expect(vi.mocked(connect).mock.calls).toEqual([[master, destination]]);
  });

  it('the offline function rejects when the wam clone fails (fail-loud export)', async () => {
    cloneInstanceInto.mockRejectedValueOnce(new Error('factory exploded'));
    const { result } = renderHook(() => useDynamicEffects());
    await act(async () => {
      await result.current.addWamEffect('https://example.com/p/index.js');
    });
    const offline = result.current.createOfflineEffectsFunction();
    const masterVolume = { context: { rawContext: {} }, connect: vi.fn() } as unknown as Volume;
    const destination = {} as unknown as ToneAudioNode;
    await expect(offline!(masterVolume, destination, true)).rejects.toThrow('factory exploded');
  });

  it('the offline function rejects when wam entries exist on a standardized context (defensive guard)', async () => {
    const { result } = renderHook(() => useDynamicEffects());
    await act(async () => {
      await result.current.addWamEffect('https://example.com/p/index.js');
    });
    isNativeGlobalContext.mockReturnValue(false);
    const offline = result.current.createOfflineEffectsFunction();
    const masterVolume = { context: { rawContext: {} }, connect: vi.fn() } as unknown as Volume;
    const destination = {} as unknown as ToneAudioNode;
    await expect(offline!(masterVolume, destination, true)).rejects.toThrow(
      /nativeAudioContext: true/
    );
  });

  // #704 close-out: a parameter change used to disconnect and reconnect the
  // whole live chain (the rebuild effect was keyed on the effect list, which
  // is replaced on every change).
  describe('chain rewiring', () => {
    function setup() {
      const view = renderHook(() => useDynamicEffects());
      act(() => {
        view.result.current.addEffect('reverb');
        view.result.current.addEffect('chorus');
      });
      const mockVolume = { connect: vi.fn(), disconnect: vi.fn() };
      const mockDestination = { connect: vi.fn() } as unknown as ToneAudioNode;
      act(() => {
        view.result.current.masterEffects(mockVolume as unknown as Volume, mockDestination, false);
      });
      mockVolume.disconnect.mockClear();
      vi.mocked(connect).mockClear();
      return { ...view, mockVolume };
    }

    it('a parameter change updates the list and leaves the graph alone', () => {
      const { result, mockVolume } = setup();
      const id = result.current.effects.getSnapshot()[0].instanceId;

      act(() => result.current.updateParameter(id, 'wet', 0.3));
      act(() => result.current.updateParameter(id, 'decay', 2));

      expect(result.current.effects.getSnapshot()[0].params.wet).toBe(0.3);
      expect(mockVolume.disconnect).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    });

    it('bypassing a native effect (wet to 0) leaves the graph alone', () => {
      const { result, mockVolume } = setup();

      act(() => result.current.toggleBypass(result.current.effects.getSnapshot()[0].instanceId));

      expect(result.current.effects.getSnapshot()[0].bypassed).toBe(true);
      expect(mockVolume.disconnect).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    });

    it('adding, removing and reordering each rewire the chain', () => {
      const { result, mockVolume } = setup();

      act(() => {
        void result.current.addEffect('phaser');
      });
      expect(mockVolume.disconnect).toHaveBeenCalledTimes(1);

      act(() => result.current.reorderEffects(0, 2));
      expect(mockVolume.disconnect).toHaveBeenCalledTimes(2);

      act(() => result.current.removeEffect(result.current.effects.getSnapshot()[0].instanceId));
      expect(mockVolume.disconnect).toHaveBeenCalledTimes(3);
    });
  });
});
