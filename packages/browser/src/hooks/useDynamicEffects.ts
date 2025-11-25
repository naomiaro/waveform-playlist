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
}

export interface UseDynamicEffectsReturn {
  // State
  activeEffects: ActiveEffect[];
  availableEffects: EffectDefinition[];

  // Actions
  addEffect: (effectId: string) => void;
  removeEffect: (instanceId: string) => void;
  updateParameter: (instanceId: string, paramName: string, value: number | string | boolean) => void;
  reorderEffects: (fromIndex: number, toIndex: number) => void;
  clearAllEffects: () => void;

  // For connecting to audio graph
  masterEffects: EffectsFunction;

  // Analyser for visualization
  analyserRef: React.RefObject<any>;
}

/**
 * Hook for managing a dynamic chain of audio effects with real-time parameter updates
 */
export function useDynamicEffects(fftSize: number = 256): UseDynamicEffectsReturn {
  // Track active effects in state (for UI)
  const [activeEffects, setActiveEffects] = useState<ActiveEffect[]>([]);

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
  const rebuildChain = useCallback(() => {
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
    const instances = activeEffects
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
  }, [activeEffects]);

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
    rebuildChain();
  }, [activeEffects, rebuildChain]);

  // The effects function that gets passed to WaveformPlaylistProvider
  const masterEffects: EffectsFunction = useCallback(
    (masterGainNode, destination, isOffline) => {
      // Create analyser for visualization
      const analyserNode = new Analyser('fft', fftSize);
      analyserRef.current = analyserNode;

      // Store references for rebuilding chain
      graphNodesRef.current = {
        masterGainNode,
        destination,
        analyserNode,
      };

      // Build initial chain
      // Get effect instances in order
      const instances = activeEffects
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
    [fftSize, activeEffects]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      effectInstancesRef.current.forEach((inst) => inst.dispose());
      effectInstancesRef.current.clear();
    };
  }, []);

  return {
    activeEffects,
    availableEffects: effectDefinitions,
    addEffect,
    removeEffect,
    updateParameter,
    reorderEffects,
    clearAllEffects,
    masterEffects,
    analyserRef,
  };
}
