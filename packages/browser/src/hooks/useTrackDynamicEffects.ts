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
   * Returns a track's effects function for offline rendering (the same
   * function for the same track id). It rebuilds the chain as it is when the
   * export runs; with no active effect it passes the audio straight through.
   * It is async and may reject — a WAV export never silently renders without
   * an effect the live chain has.
   */
  createOfflineTrackEffectsFunction: (trackId: string) => OfflineTrackEffectsFunction;

  /**
   * The effects that can be added: the built-ins, then (in native-context
   * mode) every type registered with `registerEffect()`. Read when the calling
   * component renders, so register custom effects before it does.
   */
  availableEffects: EffectDefinition[];
}

interface TrackRacks {
  racks: Map<string, EffectsRack>;
  effectsFunctions: Map<string, TrackEffectsFunction>;
  offlineFunctions: Map<string, OfflineTrackEffectsFunction>;
}

/**
 * Hook for managing effects per track. Each track has its own chain.
 * Everything it returns keeps its identity for the life of the component
 * (`availableEffects` is read from the registry on each render of the caller).
 */
export function useTrackDynamicEffects(): UseTrackDynamicEffectsReturn {
  const [store] = useState<TrackRacks>(() => ({
    racks: new Map(),
    effectsFunctions: new Map(),
    offlineFunctions: new Map(),
  }));

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

      createOfflineTrackEffectsFunction: (trackId: string): OfflineTrackEffectsFunction => {
        const existing = store.offlineFunctions.get(trackId);
        if (existing) return existing;
        const offline: OfflineTrackEffectsFunction = (trackInput, faderInput) =>
          rackFor(trackId).renderOffline(trackInput, faderInput);
        store.offlineFunctions.set(trackId, offline);
        return offline;
      },
    }),
    [store, rackFor]
  );

  const availableEffects = getAvailableEffects();

  return useMemo(() => ({ ...actions, availableEffects }), [actions, availableEffects]);
}
