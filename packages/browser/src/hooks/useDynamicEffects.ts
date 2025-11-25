import { useState, useCallback, useRef, useEffect } from 'react';
import type { EffectsFunction } from '@waveform-playlist/playout';
import {
  effectDefinitions,
  getEffectDefinition,
  type EffectDefinition,
} from '../effects/effectDefinitions';
import {
  createEffectInstance,
  type EffectInstance,
} from '../effects/effectFactory';
import { Analyser } from 'tone';

export interface ActiveEffect {
  instanceId: string;
  effectId: string;
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
  removeEffect: (instanceId: string) => void;
  updateParameter: (instanceId: string, paramName: string, value: number | string | boolean) => void;
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
  analyserRef: React.RefObject<any>;
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

  // Analyser for visualization
  const analyserRef = useRef<any>(null);

  // Reference to the current audio graph nodes
  const graphNodesRef = useRef<{
    masterGainNode: any;
    destination: any;
    analyserNode: any;
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
      // Ignore disconnect errors
    }

    // Get effect instances in order
    const instances = effects
      .map((ae) => effectInstancesRef.current.get(ae.instanceId))
      .filter((inst): inst is EffectInstance => inst !== undefined);

    if (instances.length === 0) {
      // No effects - connect directly to analyser -> destination
      masterGainNode.connect(analyserNode);
      analyserNode.connect(destination);
    } else {
      // Connect: masterGain -> effect1 -> effect2 -> ... -> analyser -> destination
      let currentNode: any = masterGainNode;

      instances.forEach((inst) => {
        try {
          inst.disconnect();
        } catch (e) {
          // Ignore
        }
        currentNode.connect(inst.effect);
        currentNode = inst.effect;
      });

      // Connect last effect to analyser
      currentNode.connect(analyserNode);
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
      definition,
      params,
      bypassed: false,
    };

    setActiveEffects((prev) => [...prev, newActiveEffect]);
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
          e.instanceId === instanceId
            ? { ...e, params: { ...e.params, [paramName]: value } }
            : e
        )
      );
    },
    []
  );

  // Toggle bypass for an effect (uses wet parameter - 0 = bypass, restore original for active)
  const toggleBypass = useCallback(
    (instanceId: string) => {
      // Get current state from ref to determine new bypassed value (avoids stale closure)
      const effect = activeEffectsRef.current.find((e) => e.instanceId === instanceId);
      if (!effect) return;

      const newBypassed = !effect.bypassed;

      // Update the actual effect instance
      // When bypassing: set wet to 0
      // When un-bypassing: restore the original wet value from params
      const instance = effectInstancesRef.current.get(instanceId);
      if (instance) {
        const originalWet = effect.params.wet as number ?? 1;
        instance.setParameter('wet', newBypassed ? 0 : originalWet);
      }

      // Update state for UI
      setActiveEffects((prev) =>
        prev.map((e) =>
          e.instanceId === instanceId ? { ...e, bypassed: newBypassed } : e
        )
      );
    },
    []
  );

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

      // Build initial chain - read from ref to get current state
      const effects = activeEffectsRef.current;
      const instances = effects
        .map((ae) => effectInstancesRef.current.get(ae.instanceId))
        .filter((inst): inst is EffectInstance => inst !== undefined);

      if (instances.length === 0) {
        // No effects - connect directly to analyser -> destination
        masterGainNode.connect(analyserNode);
        analyserNode.connect(destination);
      } else {
        // Connect: masterGain -> effect1 -> effect2 -> ... -> analyser -> destination
        let currentNode: any = masterGainNode;

        instances.forEach((inst) => {
          currentNode.connect(inst.effect);
          currentNode = inst.effect;
        });

        // Connect last effect to analyser
        currentNode.connect(analyserNode);
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
    return () => {
      effectInstancesRef.current.forEach((inst) => inst.dispose());
      effectInstancesRef.current.clear();
    };
  }, []);

  /**
   * Creates a fresh effects function for offline rendering.
   * This creates new effect instances in the offline context, avoiding the
   * AudioContext mismatch issue that occurs when reusing real-time effects.
   */
  const createOfflineEffectsFunction = useCallback((): EffectsFunction | undefined => {
    // Get non-bypassed effects
    const nonBypassedEffects = activeEffects.filter((e) => !e.bypassed);

    if (nonBypassedEffects.length === 0) {
      return undefined;
    }

    // Return a function that creates fresh effect instances
    return (masterGainNode: any, destination: any, _isOffline: boolean) => {
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
        let currentNode: any = masterGainNode;

        offlineInstances.forEach((inst) => {
          currentNode.connect(inst.effect);
          currentNode = inst.effect;
        });

        // Connect last effect to destination
        currentNode.connect(destination);
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
