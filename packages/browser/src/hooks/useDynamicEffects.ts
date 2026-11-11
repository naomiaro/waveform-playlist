import { useCallback, useMemo, useRef, useState } from 'react';
import type { EffectsFunction } from '@waveform-playlist/playout';
import type { ValueSource } from '@waveform-playlist/core';
import type { WamPluginInstance } from '@dawcore/wam'; // type-only — erased at runtime
import { Analyser } from 'tone';
import type { EffectDefinition } from '../effects/effectDefinitions';
import { getAvailableEffects } from '../effects/customEffectFactory';
import { EffectsRack, type ActiveEffect, type EffectParameterValue } from '../effects/effectsRack';
import type { OfflineEffectsFunction } from './useExportWav';

export type { ActiveEffect } from '../effects/effectsRack';

export interface UseDynamicEffectsReturn {
  /**
   * The master chain, in order. Read it with `useActiveEffects(effects)` in
   * the component that draws the rack: this hook does not re-render when the
   * list changes, so a slider step re-renders that component only.
   */
  effects: ValueSource<ActiveEffect[]>;
  /**
   * The effects that can be added: the built-ins, then (in native-context
   * mode) every type registered with `registerEffect()`. Read when the calling
   * component renders, so register custom effects before it does.
   */
  availableEffects: EffectDefinition[];

  /**
   * Adds a built-in effect or a registered custom effect by id. A built-in is
   * in the chain before this returns. A registered type is added once its
   * `prepare` hook has run on the audio context, and requires native-context
   * mode (`configureGlobalContext({ nativeAudioContext: true })`).
   * Resolves with the new entry's instanceId; rejects for an unknown id.
   */
  addEffect: (effectId: string) => Promise<string>;
  /**
   * Hosts a WAM plugin from a module URL and appends it to the master chain.
   * Requires native-context mode — call configureGlobalContext({ nativeAudioContext: true })
   * from @waveform-playlist/playout before any audio initialization.
   * WAM entries render in offline WAV export (re-instantiated on the offline context).
   * Resolves with the new entry's instanceId.
   */
  addWamEffect: (url: string, initialState?: unknown) => Promise<string>;
  /** Live plugin handle for a hosted WAM entry (for GUI mounting via WamEffectGui). */
  getWamPlugin: (instanceId: string) => WamPluginInstance | undefined;
  removeEffect: (instanceId: string) => void;
  updateParameter: (instanceId: string, paramName: string, value: EffectParameterValue) => void;
  toggleBypass: (instanceId: string) => void;
  reorderEffects: (fromIndex: number, toIndex: number) => void;
  clearAllEffects: () => void;

  // For connecting to audio graph
  masterEffects: EffectsFunction;

  /**
   * Returns the effects function for offline rendering (the same function on
   * every call). It rebuilds the chain as it is when the export runs:
   * built-in effects are re-created on the offline context, WAM entries
   * re-instantiated with the live instance's state, registered custom effects
   * prepared and created there; with no active effect it passes the audio
   * straight through. It is async and may reject — a WAV export never
   * silently renders without an effect the live chain has.
   */
  createOfflineEffectsFunction: () => OfflineEffectsFunction;

  // Analyser for visualization
  analyserRef: React.RefObject<Analyser | null>;
}

/**
 * Hook for managing a dynamic chain of audio effects with real-time parameter
 * updates. Everything it returns keeps its identity for the life of the
 * component (`masterEffects` follows `fftSize`; `availableEffects` is read from the
 * registry on each render of the caller).
 */
export function useDynamicEffects(fftSize: number = 256): UseDynamicEffectsReturn {
  const [rack] = useState(() => new EffectsRack());
  const analyserRef = useRef<Analyser | null>(null);

  // No cleanup effect: the chain is state. It survives a StrictMode remount,
  // Fast Refresh and a hidden <Activity> like any other state, and its
  // instances are released when the rack is collected (see EffectsRack) or by
  // clearAllEffects().

  // The effects function that gets passed to WaveformPlaylistProvider.
  const masterEffects: EffectsFunction = useCallback(
    (masterGainNode, destination, _isOffline) => {
      const analyserNode = new Analyser('fft', fftSize);
      analyserRef.current = analyserNode;

      // masterGain -> effect 1 -> … -> analyser -> destination
      const detach = rack.attach(masterGainNode, analyserNode);
      analyserNode.connect(destination);

      return function cleanup() {
        detach();
        analyserNode.dispose();
        if (analyserRef.current === analyserNode) {
          analyserRef.current = null;
        }
      };
    },
    [rack, fftSize]
  );

  const createOfflineEffectsFunction = useMemo(() => {
    const offline: OfflineEffectsFunction = (masterGainNode, destination) =>
      rack.renderOffline(masterGainNode, destination);
    return () => offline;
  }, [rack]);

  const availableEffects = getAvailableEffects();

  return useMemo(
    () => ({
      effects: rack.effects,
      availableEffects,
      addEffect: rack.add,
      addWamEffect: rack.addWam,
      getWamPlugin: rack.getWamPlugin,
      removeEffect: rack.remove,
      updateParameter: rack.updateParameter,
      toggleBypass: rack.toggleBypass,
      reorderEffects: rack.reorder,
      clearAllEffects: rack.clear,
      masterEffects,
      createOfflineEffectsFunction,
      analyserRef,
    }),
    [rack, availableEffects, masterEffects, createOfflineEffectsFunction]
  );
}
