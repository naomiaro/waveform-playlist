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
    Gain: vi.fn(),
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
import { useTrackDynamicEffects } from '../hooks/useTrackDynamicEffects';
import { connect } from 'tone';
import type { Gain, ToneAudioNode } from 'tone';

describe('useTrackDynamicEffects — WAM entries', () => {
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

  it('addWamEffectToTrack appends a wam entry under the track id', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffectToTrack('track-1', 'https://example.com/p/index.js');
    });
    const entries = result.current.getTrackEffects('track-1').getSnapshot();
    expect(entries[0]?.kind).toBe('wam');
    expect(entries[0]?.instanceId).toBe(id);
    expect(result.current.getTrackWamPlugin('track-1', id)?.audioNode).toBe(fakeAudioNode);
  });

  it('rejects on a standardized context', async () => {
    isNativeGlobalContext.mockReturnValue(false);
    const { result } = renderHook(() => useTrackDynamicEffects());
    await expect(result.current.addWamEffectToTrack('t', 'https://x/y.js')).rejects.toThrow(
      /nativeAudioContext: true/
    );
  });

  it('native addEffectToTrack entries carry kind "native"', () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    act(() => {
      void result.current.addEffectToTrack('t1', 'reverb');
    });
    const entries = result.current.getTrackEffects('t1').getSnapshot();
    expect(entries[0]?.kind).toBe('native');
  });

  it('removeEffectFromTrack destroys the wam plugin', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    act(() => result.current.removeEffectFromTrack('t1', id));
    expect(destroy).toHaveBeenCalled();
  });

  it('addWamEffectToTrack works under StrictMode double-invoked effects', async () => {
    // StrictMode itself as the wrapper: a function component that returns
    // <StrictMode> does not get this hook's effects double-invoked.
    const wrapper = React.StrictMode;
    const { result } = renderHook(() => useTrackDynamicEffects(), { wrapper });
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    expect(id).toMatch(/^wam_/);
    const entries = result.current.getTrackEffects('t1').getSnapshot();
    expect(entries.some((e) => e.instanceId === id)).toBe(true);
  });

  it('addWamEffectToTrack aborts and destroys the plugin if the hook unmounts before it resolves', async () => {
    let resolvePlugin!: (value: unknown) => void;
    const pluginPromise = new Promise((resolve) => {
      resolvePlugin = resolve;
    });
    createWamInstance.mockImplementationOnce(() => pluginPromise);

    const { result, unmount } = renderHook(() => useTrackDynamicEffects());

    let addPromise: Promise<string> = Promise.resolve('');
    act(() => {
      addPromise = result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });

    act(() => {
      unmount();
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

    await expect(addPromise).rejects.toThrow(/unmounted/);
    expect(destroy).toHaveBeenCalled();
    const entries = result.current.getTrackEffects('t1').getSnapshot();
    expect(entries.some((e) => e.kind === 'wam')).toBe(false);
  });

  it('toggleBypass excludes the wam node from the rebuilt chain, and re-includes it on un-bypass', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());

    let id = '';
    await act(async () => {
      id = await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });

    const mockGraphEnd = { connect: vi.fn(), disconnect: vi.fn() } as unknown as Gain;
    const mockMasterGain = { connect: vi.fn() } as unknown as ToneAudioNode;

    act(() => {
      result.current.getTrackEffectsFunction('t1')?.(mockGraphEnd, mockMasterGain, false);
    });

    (connect as ReturnType<typeof vi.fn>).mockClear();

    act(() => {
      result.current.toggleBypass('t1', id);
    });

    expect(connect).not.toHaveBeenCalledWith(expect.anything(), fakeAudioNode);
    expect(connect).not.toHaveBeenCalledWith(fakeAudioNode, expect.anything());

    act(() => {
      result.current.toggleBypass('t1', id);
    });

    expect(connect).toHaveBeenCalledWith(mockGraphEnd, fakeAudioNode);
  });

  // #660: the chain's tail connects to the TRACK's fader now, not to the
  // persistent master. Effect instances outlive the track, so tearing a
  // track down must release that edge or every rebuild leaves one more
  // connection into a dead fader.
  it("the track effects cleanup disconnects the chain from that track's fader", async () => {
    const tone = await import('tone');
    const { result } = renderHook(() => useTrackDynamicEffects());
    await act(async () => {
      await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    const trackInput = { connect: vi.fn(), disconnect: vi.fn() };
    const faderInput = { name: 'fader' };
    let teardown: void | (() => void) = undefined;
    act(() => {
      teardown = result.current.getTrackEffectsFunction('t1')?.(
        trackInput as never,
        faderInput as never,
        false
      );
    });
    vi.mocked(tone.disconnect).mockClear();

    (teardown as unknown as () => void)();

    expect(tone.disconnect).toHaveBeenCalledWith(fakeAudioNode, faderInput);
  });

  it("a late cleanup does not unregister a rebuilt track's nodes", async () => {
    const tone = await import('tone');
    const { result } = renderHook(() => useTrackDynamicEffects());
    await act(async () => {
      await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    const wire = (fader: unknown) =>
      result.current.getTrackEffectsFunction('t1')?.(
        { connect: vi.fn(), disconnect: vi.fn() } as never,
        fader as never,
        false
      );
    const oldFader = { name: 'old' };
    const newFader = { name: 'new' };
    let oldTeardown: void | (() => void) = undefined;
    act(() => {
      oldTeardown = wire(oldFader);
      wire(newFader); // the track was rebuilt before the old one's cleanup ran
    });
    (oldTeardown as unknown as () => void)();
    vi.mocked(tone.connect).mockClear();

    // The rebuilt track is still registered: a bypass toggle rewires INTO it.
    const instanceId = result.current.getTrackEffects('t1').getSnapshot()[0].instanceId;
    act(() => {
      result.current.toggleBypass('t1', instanceId);
    });
    act(() => {
      result.current.toggleBypass('t1', instanceId);
    });

    expect(tone.connect).toHaveBeenCalledWith(fakeAudioNode, newFader);
    expect(tone.connect).not.toHaveBeenCalledWith(fakeAudioNode, oldFader);
  });

  it('createOfflineTrackEffectsFunction clones wam entries onto the offline context, wires and cleans up', async () => {
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

    const { result } = renderHook(() => useTrackDynamicEffects());
    await act(async () => {
      await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });

    const offline = result.current.createOfflineTrackEffectsFunction('t1');
    expect(offline).toBeDefined();

    const rawContext = { raw: 'offline' };
    const graphEnd = { context: { rawContext }, connect: vi.fn() } as unknown as Gain;
    const masterGainNode = { name: 'master' } as unknown as ToneAudioNode;

    const cleanup = await offline!(graphEnd, masterGainNode, true);

    expect(ensureWamHost).toHaveBeenLastCalledWith(rawContext);
    expect(cloneInstanceInto).toHaveBeenCalledWith(
      expect.objectContaining({ audioNode: fakeAudioNode }),
      rawContext,
      'group-1'
    );
    expect(connect).toHaveBeenCalledWith(graphEnd, cloneNode);
    expect(connect).toHaveBeenCalledWith(cloneNode, masterGainNode);

    (cleanup as () => void)();
    expect(cloneDestroy).toHaveBeenCalled();
  });

  it('the offline track function leaves out a bypassed wam entry and passes the audio straight through', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    act(() => result.current.toggleBypass('t1', id));
    vi.mocked(connect).mockClear();
    const trackInput = { context: { rawContext: {} } } as unknown as Gain;
    const fader = {} as unknown as ToneAudioNode;

    await result.current.createOfflineTrackEffectsFunction('t1')(trackInput, fader, true);

    expect(cloneInstanceInto).not.toHaveBeenCalled();
    expect(vi.mocked(connect).mock.calls).toEqual([[trackInput, fader]]);
  });

  it('the offline track function rejects when the wam clone fails (fail-loud export)', async () => {
    cloneInstanceInto.mockRejectedValueOnce(new Error('factory exploded'));
    const { result } = renderHook(() => useTrackDynamicEffects());
    await act(async () => {
      await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    const offline = result.current.createOfflineTrackEffectsFunction('t1');
    const graphEnd = { context: { rawContext: {} }, connect: vi.fn() } as unknown as Gain;
    const masterGainNode = {} as unknown as ToneAudioNode;
    await expect(offline!(graphEnd, masterGainNode, true)).rejects.toThrow('factory exploded');
  });

  it('the offline track function rejects when wam entries exist on a standardized context (defensive guard)', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    await act(async () => {
      await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    isNativeGlobalContext.mockReturnValue(false);
    const offline = result.current.createOfflineTrackEffectsFunction('t1');
    const graphEnd = { context: { rawContext: {} }, connect: vi.fn() } as unknown as Gain;
    const masterGainNode = {} as unknown as ToneAudioNode;
    await expect(offline!(graphEnd, masterGainNode, true)).rejects.toThrow(
      /nativeAudioContext: true/
    );
  });

  // #704 close-out: one parameter change on one track used to disconnect and
  // reconnect the chain of every track that has effects.
  describe('chain rewiring', () => {
    function setup() {
      const view = renderHook(() => useTrackDynamicEffects());
      act(() => {
        view.result.current.addEffectToTrack('t1', 'reverb');
        view.result.current.addEffectToTrack('t2', 'chorus');
      });
      const inputs = {
        t1: { connect: vi.fn(), disconnect: vi.fn() },
        t2: { connect: vi.fn(), disconnect: vi.fn() },
      };
      const fader = { connect: vi.fn() } as unknown as ToneAudioNode;
      act(() => {
        view.result.current.getTrackEffectsFunction('t1')?.(
          inputs.t1 as unknown as Gain,
          fader,
          false
        );
        view.result.current.getTrackEffectsFunction('t2')?.(
          inputs.t2 as unknown as Gain,
          fader,
          false
        );
      });
      inputs.t1.disconnect.mockClear();
      inputs.t2.disconnect.mockClear();
      vi.mocked(connect).mockClear();
      return { ...view, inputs };
    }
    const firstId = (result: { current: ReturnType<typeof useTrackDynamicEffects> }, t: string) =>
      result.current.getTrackEffects(t).getSnapshot()[0].instanceId;

    it('a parameter change updates the list and leaves every graph alone', () => {
      const { result, inputs } = setup();
      const id = firstId(result, 't1');

      act(() => result.current.updateTrackEffectParameter('t1', id, 'wet', 0.3));

      expect(result.current.getTrackEffects('t1').getSnapshot()[0].params.wet).toBe(0.3);
      expect(inputs.t1.disconnect).not.toHaveBeenCalled();
      expect(inputs.t2.disconnect).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    });

    it('bypassing a native effect leaves every graph alone', () => {
      const { result, inputs } = setup();

      act(() => result.current.toggleBypass('t1', firstId(result, 't1')));

      expect(result.current.getTrackEffects('t1').getSnapshot()[0].bypassed).toBe(true);
      expect(inputs.t1.disconnect).not.toHaveBeenCalled();
      expect(connect).not.toHaveBeenCalled();
    });

    it("adding or removing an effect rewires that track's chain only", () => {
      const { result, inputs } = setup();

      act(() => {
        void result.current.addEffectToTrack('t1', 'phaser');
      });
      expect(inputs.t1.disconnect).toHaveBeenCalledTimes(1);
      expect(inputs.t2.disconnect).not.toHaveBeenCalled();

      act(() => result.current.removeEffectFromTrack('t2', firstId(result, 't2')));
      expect(inputs.t1.disconnect).toHaveBeenCalledTimes(1);
      expect(inputs.t2.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
