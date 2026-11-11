import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  /** The built-in effects, then every type registered with `registerEffect()`. */
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
   * Creates a fresh effects function for offline rendering, from the chain as
   * it is when called (`undefined` when no effect is active). Built-in
   * effects are re-created on the offline context, WAM entries re-instantiated
   * with the live instance's state, registered custom effects prepared and
   * created there. The returned function is async and may reject — a WAV
   * export never silently renders without an effect the live chain has.
   */
  createOfflineEffectsFunction: () => OfflineEffectsFunction | undefined;

  // Analyser for visualization
  analyserRef: React.RefObject<Analyser | null>;
}

/**
 * Hook for managing a dynamic chain of audio effects with real-time parameter
 * updates. Everything it returns keeps its identity for the life of the
 * component (`masterEffects` follows `fftSize`; `availableEffects` follows
 * the registry).
 */
export function useDynamicEffects(fftSize: number = 256): UseDynamicEffectsReturn {
  const [rack] = useState(() => new EffectsRack());
  const analyserRef = useRef<Analyser | null>(null);

  useEffect(() => rack.dispose, [rack]);

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

  const createOfflineEffectsFunction = useCallback((): OfflineEffectsFunction | undefined => {
    const offline = rack.createOfflineFunction();
    if (!offline) return undefined;
    return (masterGainNode, destination) => offline(masterGainNode, destination);
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
