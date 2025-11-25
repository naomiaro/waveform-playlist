import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import type { TrackEffectsFunction } from '../index';
import {
  effectDefinitions,
  getEffectDefinition,
  type EffectDefinition,
} from '../effects/effectDefinitions';
import {
  createEffectInstance,
  type EffectInstance,
} from '../effects/effectFactory';

export interface TrackActiveEffect {
  instanceId: string;
  effectId: string;
  definition: EffectDefinition;
  params: Record<string, number | string | boolean>;
}

export interface TrackEffectsState {
  trackId: string;
  activeEffects: TrackActiveEffect[];
}

export interface UseTrackDynamicEffectsReturn {
  // State per track
  trackEffectsState: Map<string, TrackActiveEffect[]>;

  // Actions
  addEffectToTrack: (trackId: string, effectId: string) => void;
  removeEffectFromTrack: (trackId: string, instanceId: string) => void;
  updateTrackEffectParameter: (
    trackId: string,
    instanceId: string,
    paramName: string,
    value: number | string | boolean
  ) => void;
  clearTrackEffects: (trackId: string) => void;
  getTrackEffectsFunction: (trackId: string) => TrackEffectsFunction | undefined;

  // Available effects
  availableEffects: EffectDefinition[];
}

/**
 * Hook for managing dynamic effects per track with real-time parameter updates
 */
export function useTrackDynamicEffects(): UseTrackDynamicEffectsReturn {
  // Track effects state per track (for UI)
  const [trackEffectsState, setTrackEffectsState] = useState<Map<string, TrackActiveEffect[]>>(
    new Map()
  );

  // Track effect instances per track (for audio processing)
  const trackEffectInstancesRef = useRef<Map<string, Map<string, EffectInstance>>>(new Map());

  // Track graph nodes per track for rebuilding chains
  const trackGraphNodesRef = useRef<
    Map<
      string,
      {
        graphEnd: any;
        masterGainNode: any;
      }
    >
  >(new Map());

  // Rebuild the effect chain for a specific track
  const rebuildTrackChain = useCallback((trackId: string) => {
    const nodes = trackGraphNodesRef.current.get(trackId);
    if (!nodes) return;

    const { graphEnd, masterGainNode } = nodes;
    const trackEffects = trackEffectsState.get(trackId) || [];
    const instancesMap = trackEffectInstancesRef.current.get(trackId);

    // Disconnect everything first
    try {
      graphEnd.disconnect();
    } catch (e) {
      // Ignore disconnect errors
    }

    // Get effect instances in order
    const instances = trackEffects
      .map((ae) => instancesMap?.get(ae.instanceId))
      .filter((inst): inst is EffectInstance => inst !== undefined);

    if (instances.length === 0) {
      // No effects - connect directly
      graphEnd.connect(masterGainNode);
    } else {
      // Connect: graphEnd -> effect1 -> effect2 -> ... -> masterGainNode
      let currentNode: any = graphEnd;

      instances.forEach((inst) => {
        try {
          inst.disconnect();
        } catch (e) {
          // Ignore
        }
        currentNode.connect(inst.effect);
        currentNode = inst.effect;
      });

      // Connect last effect to master
      currentNode.connect(masterGainNode);
    }
  }, [trackEffectsState]);

  // Add a new effect to a track
  const addEffectToTrack = useCallback((trackId: string, effectId: string) => {
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

    // Initialize maps if needed
    if (!trackEffectInstancesRef.current.has(trackId)) {
      trackEffectInstancesRef.current.set(trackId, new Map());
    }
    trackEffectInstancesRef.current.get(trackId)!.set(instance.instanceId, instance);

    // Add to state
    const newActiveEffect: TrackActiveEffect = {
      instanceId: instance.instanceId,
      effectId: definition.id,
      definition,
      params,
    };

    setTrackEffectsState((prev) => {
      const newState = new Map(prev);
      const existing = newState.get(trackId) || [];
      newState.set(trackId, [...existing, newActiveEffect]);
      return newState;
    });
  }, []);

  // Remove an effect from a track
  const removeEffectFromTrack = useCallback((trackId: string, instanceId: string) => {
    const instancesMap = trackEffectInstancesRef.current.get(trackId);
    const instance = instancesMap?.get(instanceId);
    if (instance) {
      instance.dispose();
      instancesMap?.delete(instanceId);
    }

    setTrackEffectsState((prev) => {
      const newState = new Map(prev);
      const existing = newState.get(trackId) || [];
      newState.set(trackId, existing.filter((e) => e.instanceId !== instanceId));
      return newState;
    });
  }, []);

  // Update a parameter in real-time
  const updateTrackEffectParameter = useCallback(
    (trackId: string, instanceId: string, paramName: string, value: number | string | boolean) => {
      // Update the actual effect instance
      const instancesMap = trackEffectInstancesRef.current.get(trackId);
      const instance = instancesMap?.get(instanceId);
      if (instance) {
        instance.setParameter(paramName, value);
      }

      // Update state for UI
      setTrackEffectsState((prev) => {
        const newState = new Map(prev);
        const existing = newState.get(trackId) || [];
        newState.set(
          trackId,
          existing.map((e) =>
            e.instanceId === instanceId
              ? { ...e, params: { ...e.params, [paramName]: value } }
              : e
          )
        );
        return newState;
      });
    },
    []
  );

  // Clear all effects from a track
  const clearTrackEffects = useCallback((trackId: string) => {
    // Dispose all instances for this track
    const instancesMap = trackEffectInstancesRef.current.get(trackId);
    if (instancesMap) {
      instancesMap.forEach((inst) => inst.dispose());
      instancesMap.clear();
    }

    setTrackEffectsState((prev) => {
      const newState = new Map(prev);
      newState.set(trackId, []);
      return newState;
    });
  }, []);

  // Get the effects function for a track to pass to useAudioTracks
  const getTrackEffectsFunction = useCallback(
    (trackId: string): TrackEffectsFunction | undefined => {
      // Return a function that connects effects when the track is loaded
      return (graphEnd, masterGainNode, isOffline) => {
        // Store references for rebuilding chain
        trackGraphNodesRef.current.set(trackId, {
          graphEnd,
          masterGainNode,
        });

        // Build initial chain
        const trackEffects = trackEffectsState.get(trackId) || [];
        const instancesMap = trackEffectInstancesRef.current.get(trackId);

        // Get effect instances in order
        const instances = trackEffects
          .map((ae) => instancesMap?.get(ae.instanceId))
          .filter((inst): inst is EffectInstance => inst !== undefined);

        if (instances.length === 0) {
          // No effects - connect directly
          graphEnd.connect(masterGainNode);
        } else {
          // Connect: graphEnd -> effect1 -> effect2 -> ... -> masterGainNode
          let currentNode: any = graphEnd;

          instances.forEach((inst) => {
            currentNode.connect(inst.effect);
            currentNode = inst.effect;
          });

          // Connect last effect to master
          currentNode.connect(masterGainNode);
        }

        return function cleanup() {
          trackGraphNodesRef.current.delete(trackId);
        };
      };
    },
    [trackEffectsState]
  );

  // Rebuild chains when effects change
  useEffect(() => {
    trackEffectsState.forEach((_, trackId) => {
      rebuildTrackChain(trackId);
    });
  }, [trackEffectsState, rebuildTrackChain]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      trackEffectInstancesRef.current.forEach((instancesMap) => {
        instancesMap.forEach((inst) => inst.dispose());
        instancesMap.clear();
      });
      trackEffectInstancesRef.current.clear();
    };
  }, []);

  return {
    trackEffectsState,
    addEffectToTrack,
    removeEffectFromTrack,
    updateTrackEffectParameter,
    clearTrackEffects,
    getTrackEffectsFunction,
    availableEffects: effectDefinitions,
  };
}
