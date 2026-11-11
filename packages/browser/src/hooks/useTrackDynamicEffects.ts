import { useCallback, useEffect, useMemo, useState } from 'react';
import type { TrackEffectsFunction } from '@waveform-playlist/playout';
import type { ValueSource } from '@waveform-playlist/core';
import type { WamPluginInstance } from '@dawcore/wam'; // type-only — erased at runtime
import type { EffectDefinition } from '../effects/effectDefinitions';
import { getAvailableEffects } from '../effects/customEffectFactory';
import { EffectsRack, type ActiveEffect, type EffectParameterValue } from '../effects/effectsRack';
import type { OfflineTrackEffectsFunction } from './useExportWav';

/** An entry of a track's chain. The same shape as a master-chain entry. */
export type TrackActiveEffect = ActiveEffect;

export interface UseTrackDynamicEffectsReturn {
  /**
   * One track's chain, in order. The same source is returned for the same
   * track id. Read it with `useActiveEffects(getTrackEffects(trackId))` in
   * the component that draws that track's effects: this hook does not
   * re-render when a chain changes.
   */
  getTrackEffects: (trackId: string) => ValueSource<TrackActiveEffect[]>;

  /**
   * Adds a built-in effect or a registered custom effect to a track by id. A
   * built-in is in the chain before this returns. A registered type is added
   * once its `prepare` hook has run on the audio context, and requires
   * native-context mode. Resolves with the new entry's instanceId; rejects
   * for an unknown id.
   */
  addEffectToTrack: (trackId: string, effectId: string) => Promise<string>;
  /**
   * Hosts a WAM plugin from a module URL and appends it to a track's chain.
   * Requires native-context mode — call configureGlobalContext({ nativeAudioContext: true })
   * from @waveform-playlist/playout before any audio initialization.
   * WAM entries render in offline WAV export (re-instantiated on the offline context).
   * Resolves with the new entry's instanceId.
   */
  addWamEffectToTrack: (trackId: string, url: string, initialState?: unknown) => Promise<string>;
  /** Live plugin handle for a hosted WAM entry (for GUI mounting via WamEffectGui). */
  getTrackWamPlugin: (trackId: string, instanceId: string) => WamPluginInstance | undefined;
  removeEffectFromTrack: (trackId: string, instanceId: string) => void;
  updateTrackEffectParameter: (
    trackId: string,
    instanceId: string,
    paramName: string,
    value: EffectParameterValue
  ) => void;
  toggleBypass: (trackId: string, instanceId: string) => void;
  reorderTrackEffects: (trackId: string, fromIndex: number, toIndex: number) => void;
  clearTrackEffects: (trackId: string) => void;

  /**
   * The effects function to give a track (`track.effects`). The same function
   * is returned for the same track id.
   */
  getTrackEffectsFunction: (trackId: string) => TrackEffectsFunction;

  /**
   * Creates a fresh effects function for a track for offline rendering, from
   * the chain as it is when called (`undefined` when the track has no active
   * effect). The returned function is async and may reject —
   * a WAV export never silently renders without an effect the live chain has.
   */
  createOfflineTrackEffectsFunction: (trackId: string) => OfflineTrackEffectsFunction | undefined;

  /** The built-in effects, then every type registered with `registerEffect()`. */
  availableEffects: EffectDefinition[];
}

interface TrackRacks {
  racks: Map<string, EffectsRack>;
  effectsFunctions: Map<string, TrackEffectsFunction>;
}

/**
 * Hook for managing effects per track. Each track has its own chain.
 * Everything it returns keeps its identity for the life of the component
 * (`availableEffects` follows the registry).
 */
export function useTrackDynamicEffects(): UseTrackDynamicEffectsReturn {
  const [store] = useState<TrackRacks>(() => ({ racks: new Map(), effectsFunctions: new Map() }));

  const rackFor = useCallback(
    (trackId: string): EffectsRack => {
      const existing = store.racks.get(trackId);
      if (existing) return existing;
      const rack = new EffectsRack();
      store.racks.set(trackId, rack);
      return rack;
    },
    [store]
  );

  useEffect(
    () => () => {
      store.racks.forEach((rack) => rack.dispose());
    },
    [store]
  );

  const actions = useMemo(
    () => ({
      getTrackEffects: (trackId: string) => rackFor(trackId).effects,
      addEffectToTrack: (trackId: string, effectId: string) => rackFor(trackId).add(effectId),
      addWamEffectToTrack: (trackId: string, url: string, initialState?: unknown) =>
        rackFor(trackId).addWam(url, initialState),
      getTrackWamPlugin: (trackId: string, instanceId: string) =>
        store.racks.get(trackId)?.getWamPlugin(instanceId),
      removeEffectFromTrack: (trackId: string, instanceId: string) =>
        store.racks.get(trackId)?.remove(instanceId),
      updateTrackEffectParameter: (
        trackId: string,
        instanceId: string,
        paramName: string,
        value: EffectParameterValue
      ) => store.racks.get(trackId)?.updateParameter(instanceId, paramName, value),
      toggleBypass: (trackId: string, instanceId: string) =>
        store.racks.get(trackId)?.toggleBypass(instanceId),
      reorderTrackEffects: (trackId: string, fromIndex: number, toIndex: number) =>
        store.racks.get(trackId)?.reorder(fromIndex, toIndex),
      clearTrackEffects: (trackId: string) => store.racks.get(trackId)?.clear(),

      getTrackEffectsFunction: (trackId: string): TrackEffectsFunction => {
        const existing = store.effectsFunctions.get(trackId);
        if (existing) return existing;
        // Track chains are pre-fader inserts: trackInput -> effects -> faderInput.
        const effectsFunction: TrackEffectsFunction = (trackInput, faderInput, _isOffline) =>
          rackFor(trackId).attach(trackInput, faderInput);
        store.effectsFunctions.set(trackId, effectsFunction);
        return effectsFunction;
      },

      createOfflineTrackEffectsFunction: (
        trackId: string
      ): OfflineTrackEffectsFunction | undefined => {
        const offline = store.racks.get(trackId)?.createOfflineFunction();
        if (!offline) return undefined;
        return (trackInput, faderInput) => offline(trackInput, faderInput);
      },
    }),
    [store, rackFor]
  );

  const availableEffects = getAvailableEffects();

  return useMemo(() => ({ ...actions, availableEffects }), [actions, availableEffects]);
}
