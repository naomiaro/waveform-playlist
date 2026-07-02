import { useState, useCallback, useRef, useEffect } from 'react';
import {
  isNativeGlobalContext,
  getGlobalAudioContext,
  type EffectsFunction,
} from '@waveform-playlist/playout';
import {
  effectDefinitions,
  getEffectDefinition,
  type EffectDefinition,
} from '../effects/effectDefinitions';
import { createEffectInstance, type EffectInstance } from '../effects/effectFactory';
import { loadWamModule } from '../effects/loadWam';
import { createWamEffectInstance, type WamEffectInstance } from '../effects/wamEffectFactory';
import type { WamPluginInstance } from '@dawcore/wam'; // type-only — erased at runtime
import { Analyser, Volume, ToneAudioNode, connect } from 'tone';

export interface ActiveEffect {
  instanceId: string;
  effectId: string;
  /** 'native' = built-in Tone effect; 'wam' = hosted WAM plugin. */
  kind: 'native' | 'wam';
  /** Module URL for wam entries. */
  url?: string;
  definition: EffectDefinition;
  params: Record<string, number | string | boolean>;
  bypassed: boolean;
}

export interface UseDynamicEffectsReturn {
  // State
  activeEffects: ActiveEffect[];
  availableEffects: EffectDefinition[];

  // Actions
  addEffect: (effectId: string) => void;
  /**
   * Hosts a WAM plugin from a module URL and appends it to the master chain.
   * Requires native-context mode — call configureGlobalContext({ nativeAudioContext: true })
   * from @waveform-playlist/playout before any audio initialization.
   * Note: WAM entries are skipped during offline WAV export (not supported yet).
   * Resolves with the new entry's instanceId.
   */
  addWamEffect: (url: string, initialState?: unknown) => Promise<string>;
  /** Live plugin handle for a hosted WAM entry (for GUI mounting via WamEffectGui). */
  getWamPlugin: (instanceId: string) => WamPluginInstance | undefined;
  removeEffect: (instanceId: string) => void;
  updateParameter: (
    instanceId: string,
    paramName: string,
    value: number | string | boolean
  ) => void;
  toggleBypass: (instanceId: string) => void;
  reorderEffects: (fromIndex: number, toIndex: number) => void;
  clearAllEffects: () => void;

  // For connecting to audio graph
  masterEffects: EffectsFunction;

  /**
   * Creates a fresh effects function for offline rendering.
   * This creates new effect instances that work in the offline AudioContext.
   */
  createOfflineEffectsFunction: () => EffectsFunction | undefined;

  // Analyser for visualization
  analyserRef: React.RefObject<Analyser | null>;
}

/**
 * Hook for managing a dynamic chain of audio effects with real-time parameter updates
 */
export function useDynamicEffects(fftSize: number = 256): UseDynamicEffectsReturn {
  // Track active effects in state (for UI)
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);

  // Ref to store current activeEffects for reading in callbacks (avoids stale closures)
  const activeEffectsRef = useRef<ActiveEffect[]>(activeEffects);
  activeEffectsRef.current = activeEffects;

  // Track effect instances (for audio processing)
  const effectInstancesRef = useRef<Map<string, EffectInstance>>(new Map());

  // Guards addWamEffect's async window — set false by the unmount cleanup.
  const isMountedRef = useRef(true);

  // Analyser for visualization
  const analyserRef = useRef<Analyser | null>(null);

  // Reference to the current audio graph nodes
  const graphNodesRef = useRef<{
    masterGainNode: Volume;
    destination: ToneAudioNode;
    analyserNode: Analyser;
  } | null>(null);

  // Rebuild the effect chain when effects change
  // Note: effects is passed as parameter to avoid stale closure issues
  const rebuildChain = useCallback((effects: ActiveEffect[]) => {
    const nodes = graphNodesRef.current;
    if (!nodes) return;

    const { masterGainNode, destination, analyserNode } = nodes;

    // Disconnect everything first
    try {
      masterGainNode.disconnect();
    } catch (e) {
      console.warn('[waveform-playlist] Error disconnecting master effects chain:', e);
    }

    // Get effect instances in order. Bypassed WAM entries are dropped from the
    // chain entirely (disconnection bypass — WAM has no wet param).
    const audible = effects.filter((ae) => !(ae.kind === 'wam' && ae.bypassed));
    const instances = audible
      .map((ae) => effectInstancesRef.current.get(ae.instanceId))
      .filter((inst): inst is EffectInstance => inst !== undefined);

    if (instances.length === 0) {
      // No effects - connect directly to analyser -> destination
      masterGainNode.connect(analyserNode);
      analyserNode.connect(destination);
    } else {
      // Connect: masterGain -> effect1 -> effect2 -> ... -> analyser -> destination
      let currentNode: ToneAudioNode | AudioNode = masterGainNode;

      instances.forEach((inst) => {
        try {
          inst.disconnect();
        } catch (e) {
          console.warn(`[waveform-playlist] Error disconnecting effect "${inst.id}":`, e);
        }
        connect(currentNode, inst.effect);
        currentNode = inst.effect;
      });

      // Connect last effect to analyser
      connect(currentNode, analyserNode);
      analyserNode.connect(destination);
    }
  }, []);

  // Add a new effect
  const addEffect = useCallback((effectId: string) => {
    const definition = getEffectDefinition(effectId);
    if (!definition) {
      console.error(`Unknown effect: ${effectId}`);
      return;
    }

    // Build default params
    const params: Record<string, number | string | boolean> = {};
    definition.parameters.forEach((p) => {
      params[p.name] = p.default;
    });

    // Create the effect instance
    const instance = createEffectInstance(definition, params);
    effectInstancesRef.current.set(instance.instanceId, instance);

    // Add to state
    const newActiveEffect: ActiveEffect = {
      instanceId: instance.instanceId,
      effectId: definition.id,
      kind: 'native',
      definition,
      params,
      bypassed: false,
    };

    setActiveEffects((prev) => [...prev, newActiveEffect]);
  }, []);

  // Host a WAM plugin and append it to the chain. Requires native-context mode.
  const addWamEffect = useCallback(async (url: string, initialState?: unknown): Promise<string> => {
    if (!isNativeGlobalContext()) {
      throw new Error(
        '[waveform-playlist] WAM plugins require a native AudioContext. Call ' +
          'configureGlobalContext({ nativeAudioContext: true }) from ' +
          '@waveform-playlist/playout before any audio initialization.'
      );
    }
    const wam = await loadWamModule();
    const ctx = getGlobalAudioContext();
    const { hostGroupId } = await wam.ensureWamHost(ctx);
    const plugin = await wam.createWamInstance(
      url,
      ctx,
      hostGroupId,
      initialState !== undefined ? { initialState } : undefined
    );
    if (!isMountedRef.current) {
      plugin.destroy();
      throw new Error(
        '[waveform-playlist] addWamEffect aborted: hook unmounted before the plugin finished loading.'
      );
    }
    const instance = createWamEffectInstance(plugin);
    effectInstancesRef.current.set(instance.instanceId, instance);

    const definition: EffectDefinition = {
      id: instance.id,
      name: plugin.descriptor?.name ?? url,
      category: 'wam',
      description: 'WAM plugin',
      parameters: [],
    };
    setActiveEffects((prev) => [
      ...prev,
      {
        instanceId: instance.instanceId,
        effectId: instance.id,
        kind: 'wam',
        url,
        definition,
        params: {},
        bypassed: false,
      },
    ]);
    return instance.instanceId;
  }, []);

  // Live plugin handle for GUI mounting (WamEffectGui).
  const getWamPlugin = useCallback((instanceId: string): WamPluginInstance | undefined => {
    const inst = effectInstancesRef.current.get(instanceId) as WamEffectInstance | undefined;
    return inst?.kind === 'wam' ? inst.plugin : undefined;
  }, []);

  // Remove an effect
  const removeEffect = useCallback((instanceId: string) => {
    const instance = effectInstancesRef.current.get(instanceId);
    if (instance) {
      instance.dispose();
      effectInstancesRef.current.delete(instanceId);
    }

    setActiveEffects((prev) => prev.filter((e) => e.instanceId !== instanceId));
  }, []);

  // Update a parameter in real-time
  const updateParameter = useCallback(
    (instanceId: string, paramName: string, value: number | string | boolean) => {
      // Update the actual effect instance
      const instance = effectInstancesRef.current.get(instanceId);
      if (instance) {
        instance.setParameter(paramName, value);
      }

      // Update state for UI
      setActiveEffects((prev) =>
        prev.map((e) =>
          e.instanceId === instanceId ? { ...e, params: { ...e.params, [paramName]: value } } : e
        )
      );
    },
    []
  );

  // Toggle bypass for an effect (uses wet parameter - 0 = bypass, restore original for active)
  const toggleBypass = useCallback((instanceId: string) => {
    // Get current state from ref to determine new bypassed value (avoids stale closure)
    const effect = activeEffectsRef.current.find((e) => e.instanceId === instanceId);
    if (!effect) return;

    const newBypassed = !effect.bypassed;

    if (effect.kind === 'wam') {
      // Disconnection bypass: the rebuild effect drops bypassed wam entries.
      setActiveEffects((prev) =>
        prev.map((e) => (e.instanceId === instanceId ? { ...e, bypassed: newBypassed } : e))
      );
      return;
    }

    // Update the actual effect instance
    // When bypassing: set wet to 0
    // When un-bypassing: restore the original wet value from params
    const instance = effectInstancesRef.current.get(instanceId);
    if (instance) {
      const originalWet = (effect.params.wet as number) ?? 1;
      instance.setParameter('wet', newBypassed ? 0 : originalWet);
    }

    // Update state for UI
    setActiveEffects((prev) =>
      prev.map((e) => (e.instanceId === instanceId ? { ...e, bypassed: newBypassed } : e))
    );
  }, []);

  // Reorder effects in the chain
  const reorderEffects = useCallback((fromIndex: number, toIndex: number) => {
    setActiveEffects((prev) => {
      const newEffects = [...prev];
      const [removed] = newEffects.splice(fromIndex, 1);
      newEffects.splice(toIndex, 0, removed);
      return newEffects;
    });
  }, []);

  // Clear all effects
  const clearAllEffects = useCallback(() => {
    // Dispose all instances
    effectInstancesRef.current.forEach((inst) => inst.dispose());
    effectInstancesRef.current.clear();

    setActiveEffects([]);
  }, []);

  // Rebuild chain when effects change
  useEffect(() => {
    rebuildChain(activeEffects);
  }, [activeEffects, rebuildChain]);

  // The effects function that gets passed to WaveformPlaylistProvider
  // This function is stable - it reads from refs at call time to avoid stale closures
  const masterEffects: EffectsFunction = useCallback(
    (masterGainNode, destination, _isOffline) => {
      // Create analyser for visualization
      const analyserNode = new Analyser('fft', fftSize);
      analyserRef.current = analyserNode;

      // Store references for rebuilding chain
      graphNodesRef.current = {
        masterGainNode,
        destination,
        analyserNode,
      };

      // Build initial chain - read from ref to get current state.
      // Bypassed WAM entries are dropped (disconnection bypass — no wet param).
      const effects = activeEffectsRef.current;
      const audible = effects.filter((ae) => !(ae.kind === 'wam' && ae.bypassed));
      const instances = audible
        .map((ae) => effectInstancesRef.current.get(ae.instanceId))
        .filter((inst): inst is EffectInstance => inst !== undefined);

      if (instances.length === 0) {
        // No effects - connect directly to analyser -> destination
        masterGainNode.connect(analyserNode);
        analyserNode.connect(destination);
      } else {
        // Connect: masterGain -> effect1 -> effect2 -> ... -> analyser -> destination
        let currentNode: ToneAudioNode | AudioNode = masterGainNode;

        instances.forEach((inst) => {
          connect(currentNode, inst.effect);
          currentNode = inst.effect;
        });

        // Connect last effect to analyser
        connect(currentNode, analyserNode);
        analyserNode.connect(destination);
      }

      return function cleanup() {
        analyserNode.dispose();
        analyserRef.current = null;
        graphNodesRef.current = null;
      };
    },
    [fftSize] // Only fftSize - reads effects from ref
  );

  // Cleanup on unmount
  useEffect(() => {
    const effectInstances = effectInstancesRef.current;
    return () => {
      isMountedRef.current = false;
      effectInstances.forEach((inst) => inst.dispose());
      effectInstances.clear();
    };
  }, []);

  /**
   * Creates a fresh effects function for offline rendering.
   * This creates new effect instances in the offline context, avoiding the
   * AudioContext mismatch issue that occurs when reusing real-time effects.
   */
  const createOfflineEffectsFunction = useCallback((): EffectsFunction | undefined => {
    // WAM plugins cannot be re-instantiated in Tone.Offline's context — skip them.
    const wamCount = activeEffects.filter((e) => e.kind === 'wam' && !e.bypassed).length;
    if (wamCount > 0) {
      console.warn(
        '[waveform-playlist] ' +
          wamCount +
          ' WAM effect(s) are skipped in WAV export — WAM offline rendering is not supported yet.'
      );
    }

    // Get non-bypassed native effects
    const nonBypassedEffects = activeEffects.filter((e) => !e.bypassed && e.kind !== 'wam');

    if (nonBypassedEffects.length === 0) {
      return undefined;
    }

    // Return a function that creates fresh effect instances
    return (masterGainNode: Volume, destination: ToneAudioNode, _isOffline: boolean) => {
      // Create fresh effect instances for offline context
      const offlineInstances: EffectInstance[] = [];

      for (const activeEffect of nonBypassedEffects) {
        const instance = createEffectInstance(activeEffect.definition, activeEffect.params);
        offlineInstances.push(instance);
      }

      if (offlineInstances.length === 0) {
        // No effects - connect directly
        masterGainNode.connect(destination);
      } else {
        // Connect: masterGain -> effect1 -> effect2 -> ... -> destination
        let currentNode: ToneAudioNode | AudioNode = masterGainNode;

        offlineInstances.forEach((inst) => {
          connect(currentNode, inst.effect);
          currentNode = inst.effect;
        });

        // Connect last effect to destination
        connect(currentNode, destination);
      }

      return function cleanup() {
        offlineInstances.forEach((inst) => inst.dispose());
      };
    };
  }, [activeEffects]);

  return {
    activeEffects,
    availableEffects: effectDefinitions,
    addEffect,
    addWamEffect,
    getWamPlugin,
    removeEffect,
    updateParameter,
    toggleBypass,
    reorderEffects,
    clearAllEffects,
    masterEffects,
    createOfflineEffectsFunction,
    analyserRef,
  };
}
