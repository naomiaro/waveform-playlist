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
  const effectCtor = () => vi.fn(() => toneEffectStub());
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    Analyser: vi.fn(() => ({ connect: vi.fn(), dispose: vi.fn() })),
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
    const entries = result.current.trackEffectsState.get('track-1') ?? [];
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
    act(() => result.current.addEffectToTrack('t1', 'reverb'));
    const entries = result.current.trackEffectsState.get('t1') ?? [];
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
    const wrapper = ({ children }: { children: React.ReactNode }) =>
      React.createElement(React.StrictMode, null, children);
    const { result } = renderHook(() => useTrackDynamicEffects(), { wrapper });
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    expect(id).toMatch(/^wam_/);
    const entries = result.current.trackEffectsState.get('t1') ?? [];
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
    const entries = result.current.trackEffectsState.get('t1') ?? [];
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

  it('createOfflineTrackEffectsFunction excludes bypassed wam entries (undefined when nothing remains)', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    act(() => result.current.toggleBypass('t1', id));
    expect(result.current.createOfflineTrackEffectsFunction('t1')).toBeUndefined();
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
});
