// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, render, act, cleanup } from '@testing-library/react';

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
    Analyser: vi.fn(function () {
      return { name: 'analyser', connect: vi.fn(), dispose: vi.fn() };
    }),
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

import React, { StrictMode, useEffect } from 'react';
import { connect } from 'tone';
import type { Gain, ToneAudioNode, Volume } from 'tone';
import { registerEffect, unregisterEffect, getEffectDefinitions } from '@waveform-playlist/core';
import { useDynamicEffects } from '../hooks/useDynamicEffects';
import { useTrackDynamicEffects } from '../hooks/useTrackDynamicEffects';
import { useActiveEffects } from '../hooks/useActiveEffects';

const disposeNative = vi.fn();

function registerBoost(): void {
  registerEffect('my-boost', {
    label: 'Boost',
    category: 'my-plugins',
    defaults: { amount: 2 },
    params: { amount: { min: 0, max: 4 } },
    prepare: async () => {},
    create: (ctx) => {
      const node = ctx.createGain();
      return { input: node, output: node, applyParams: () => {}, dispose: disposeNative };
    },
  });
}

const node = (name: string) =>
  ({
    name,
    connect: vi.fn(),
    disconnect: vi.fn(),
    context: { rawContext: liveContext },
  }) as unknown;

beforeEach(() => {
  vi.clearAllMocks();
  isNativeGlobalContext.mockReturnValue(true);
  for (const type of getEffectDefinitions().keys()) unregisterEffect(type);
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
});

describe('useDynamicEffects: the list is a source, not hook state', () => {
  it('does not re-render the calling component when the chain changes', async () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useDynamicEffects();
    });
    const first = result.current;
    expect(renders).toBe(1);

    let id = '';
    await act(async () => {
      id = await result.current.addEffect('reverb');
    });
    act(() => {
      result.current.updateParameter(id, 'decay', 4);
      result.current.toggleBypass(id);
    });

    expect(renders).toBe(1);
    expect(result.current).toBe(first);
    expect(result.current.effects.getSnapshot()[0].params.decay).toBe(4);
  });

  it('keeps every returned function, including the offline one, across renders', async () => {
    const { result, rerender } = renderHook(() => useDynamicEffects());
    const first = { ...result.current };
    await act(async () => {
      await result.current.addEffect('reverb');
    });
    rerender();

    for (const key of Object.keys(first) as Array<keyof typeof first>) {
      expect(result.current[key], key).toBe(first[key]);
    }
    // Stable, and still reads the chain as it is when called.
    expect(result.current.createOfflineEffectsFunction()).toBeTypeOf('function');
    act(() => result.current.clearAllEffects());
    expect(result.current.createOfflineEffectsFunction()).toBeUndefined();
  });

  it('useActiveEffects re-renders its own component with each new list', async () => {
    let rootRenders = 0;
    let listRenders = 0;
    let api: ReturnType<typeof useDynamicEffects> | undefined;
    const seen: number[] = [];

    function List({ effects }: { effects: ReturnType<typeof useDynamicEffects>['effects'] }) {
      listRenders++;
      seen.push(useActiveEffects(effects).length);
      return null;
    }
    function Root() {
      rootRenders++;
      api = useDynamicEffects();
      return <List effects={api.effects} />;
    }
    render(<Root />);

    let id = '';
    await act(async () => {
      id = await api!.addEffect('reverb');
    });
    act(() => api!.updateParameter(id, 'decay', 4));

    expect(rootRenders).toBe(1);
    expect(listRenders).toBe(3);
    expect(seen).toEqual([0, 1, 1]);
  });

  it('adds a registered custom effect and wires it into the master chain', async () => {
    registerBoost();
    const { result } = renderHook(() => useDynamicEffects());
    const master = node('master');
    act(() => {
      result.current.masterEffects(master as Volume, node('destination') as ToneAudioNode, false);
    });
    vi.mocked(connect).mockClear();

    await act(async () => {
      await result.current.addEffect('my-boost');
    });

    expect(result.current.effects.getSnapshot()[0]).toMatchObject({
      kind: 'custom',
      effectId: 'my-boost',
    });
    expect(vi.mocked(connect).mock.calls[0][0]).toBe(master);
    expect(connect).toHaveBeenCalledTimes(2); // master → boost → analyser
    expect(result.current.availableEffects.some((d) => d.id === 'my-boost')).toBe(true);
  });

  it('rejects for an unknown effect id', async () => {
    const { result } = renderHook(() => useDynamicEffects());
    await expect(result.current.addEffect('nope')).rejects.toThrow(/Unknown effect "nope"/);
  });

  it('under StrictMode an effect added on mount ends up in the list exactly once, with its instance', async () => {
    registerBoost();
    let api: ReturnType<typeof useDynamicEffects> | undefined;
    function Root() {
      const fx = useDynamicEffects();
      api = fx;
      const { addEffect } = fx;
      useEffect(() => {
        void addEffect('reverb');
        addEffect('my-boost').catch(() => {
          // The first (discarded) mount's add is dropped by the cleanup.
        });
      }, [addEffect]);
      return null;
    }
    await act(async () => {
      render(
        <StrictMode>
          <Root />
        </StrictMode>
      );
    });

    const list = api!.effects.getSnapshot();
    expect(list.map((e) => e.effectId).sort()).toEqual(['my-boost', 'reverb']);
    // Every listed entry has a live instance: wiring them reaches each one.
    vi.mocked(connect).mockClear();
    act(() => {
      api!.masterEffects(node('master') as Volume, node('destination') as ToneAudioNode, false);
    });
    expect(connect).toHaveBeenCalledTimes(3);
  });

  it('unmount disposes the instances and empties the list', async () => {
    registerBoost();
    const { result, unmount } = renderHook(() => useDynamicEffects());
    await act(async () => {
      await result.current.addEffect('my-boost');
    });
    const { effects } = result.current;
    unmount();
    expect(disposeNative).toHaveBeenCalledTimes(1);
    expect(effects.getSnapshot()).toEqual([]);
  });
});

describe('useTrackDynamicEffects: one source per track', () => {
  it('does not re-render on a chain change, and a change on one track leaves the other source alone', async () => {
    let renders = 0;
    const { result } = renderHook(() => {
      renders++;
      return useTrackDynamicEffects();
    });
    const t1 = result.current.getTrackEffects('t1');
    const t2 = result.current.getTrackEffects('t2');
    const t2Listener = vi.fn();
    t2.subscribe(t2Listener);

    await act(async () => {
      await result.current.addEffectToTrack('t1', 'reverb');
    });

    expect(renders).toBe(1);
    expect(result.current.getTrackEffects('t1')).toBe(t1);
    expect(t1.getSnapshot()).toHaveLength(1);
    expect(t2.getSnapshot()).toEqual([]);
    expect(t2Listener).not.toHaveBeenCalled();
  });

  it('returns the same effects function for the same track', () => {
    const { result, rerender } = renderHook(() => useTrackDynamicEffects());
    const first = result.current.getTrackEffectsFunction('t1');
    rerender();
    expect(result.current.getTrackEffectsFunction('t1')).toBe(first);
    expect(result.current.getTrackEffectsFunction('t2')).not.toBe(first);
  });

  it('adds a registered custom effect to a track, reorders and removes it', async () => {
    registerBoost();
    const { result } = renderHook(() => useTrackDynamicEffects());
    act(() => {
      result.current.getTrackEffectsFunction('t1')(
        node('trackInput') as Gain,
        node('fader') as ToneAudioNode,
        false
      );
    });
    let boost = '';
    await act(async () => {
      await result.current.addEffectToTrack('t1', 'reverb');
      boost = await result.current.addEffectToTrack('t1', 'my-boost');
    });
    const ids = () =>
      result.current
        .getTrackEffects('t1')
        .getSnapshot()
        .map((e) => e.effectId);
    expect(ids()).toEqual(['reverb', 'my-boost']);

    act(() => result.current.reorderTrackEffects('t1', 1, 0));
    expect(ids()).toEqual(['my-boost', 'reverb']);

    act(() => result.current.removeEffectFromTrack('t1', boost));
    expect(ids()).toEqual(['reverb']);
    expect(disposeNative).toHaveBeenCalledTimes(1);
  });

  it('the offline track function is undefined for a track without active effects', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    expect(result.current.createOfflineTrackEffectsFunction('t1')).toBeUndefined();
    await act(async () => {
      await result.current.addEffectToTrack('t1', 'reverb');
    });
    expect(result.current.createOfflineTrackEffectsFunction('t1')).toBeTypeOf('function');
    expect(result.current.createOfflineTrackEffectsFunction('t2')).toBeUndefined();
  });
});
