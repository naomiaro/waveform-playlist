import { useState, useCallback, useRef, useEffect } from 'react';
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
  bypassed: boolean;
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
  toggleBypass: (trackId: string, instanceId: string) => void;
  clearTrackEffects: (trackId: string) => void;
  getTrackEffectsFunction: (trackId: string) => TrackEffectsFunction | undefined;

  /**
   * Creates a fresh effects function for a track for offline rendering.
   * This creates new effect instances that work in the offline AudioContext.
   */
  createOfflineTrackEffectsFunction: (trackId: string) => TrackEffectsFunction | undefined;

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
  // Note: trackEffects is passed as parameter to avoid stale closure issues
  const rebuildTrackChain = useCallback((trackId: string, trackEffects: TrackActiveEffect[]) => {
    const nodes = trackGraphNodesRef.current.get(trackId);
    if (!nodes) return;

    const { graphEnd, masterGainNode } = nodes;
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
  }, []);

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
      bypassed: false,
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

  // Toggle bypass for an effect (uses wet parameter - 0 = bypass, restore original for active)
  const toggleBypass = useCallback(
    (trackId: string, instanceId: string) => {
      // Get current state from ref to determine new bypassed value (avoids stale closure)
      const trackEffects = trackEffectsStateRef.current.get(trackId) || [];
      const effect = trackEffects.find((e) => e.instanceId === instanceId);
      if (!effect) return;

      const newBypassed = !effect.bypassed;

      // Update the actual effect instance
      // When bypassing: set wet to 0
      // When un-bypassing: restore the original wet value from params
      const instancesMap = trackEffectInstancesRef.current.get(trackId);
      const instance = instancesMap?.get(instanceId);
      if (instance) {
        const originalWet = effect.params.wet as number ?? 1;
        instance.setParameter('wet', newBypassed ? 0 : originalWet);
      }

      // Update state for UI
      setTrackEffectsState((prev) => {
        const newState = new Map(prev);
        const existing = newState.get(trackId) || [];
        newState.set(
          trackId,
          existing.map((e) =>
            e.instanceId === instanceId ? { ...e, bypassed: newBypassed } : e
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

  // Ref to store the current trackEffectsState for reading in effects function
  // This avoids stale closure issues when the effects function is called later
  const trackEffectsStateRef = useRef<Map<string, TrackActiveEffect[]>>(trackEffectsState);
  trackEffectsStateRef.current = trackEffectsState;

  // Get the effects function for a track to pass to useAudioTracks
  // This function is stable (no dependencies) - it reads from refs at call time
  const getTrackEffectsFunction = useCallback(
    (trackId: string): TrackEffectsFunction | undefined => {
      // Return a function that connects effects when the track is loaded
      return (graphEnd, masterGainNode, _isOffline) => {
        // Store references for rebuilding chain
        trackGraphNodesRef.current.set(trackId, {
          graphEnd,
          masterGainNode,
        });

        // Read current state from ref (not stale closure)
        const trackEffects = trackEffectsStateRef.current.get(trackId) || [];
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
    [] // No dependencies - stable function that reads from refs
  );

  // Rebuild chains when effects change
  useEffect(() => {
    trackEffectsState.forEach((effects, trackId) => {
      rebuildTrackChain(trackId, effects);
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

  /**
   * Creates a fresh effects function for a track for offline rendering.
   * This creates new effect instances in the offline context, avoiding the
   * AudioContext mismatch issue that occurs when reusing real-time effects.
   */
  const createOfflineTrackEffectsFunction = useCallback(
    (trackId: string): TrackEffectsFunction | undefined => {
      const trackEffects = trackEffectsState.get(trackId) || [];
      // Get non-bypassed effects
      const nonBypassedEffects = trackEffects.filter((e) => !e.bypassed);

      if (nonBypassedEffects.length === 0) {
        return undefined;
      }

      // Return a function that creates fresh effect instances
      return (graphEnd: any, masterGainNode: any, _isOffline: boolean) => {
        // Create fresh effect instances for offline context
        const offlineInstances: EffectInstance[] = [];

        for (const activeEffect of nonBypassedEffects) {
          const instance = createEffectInstance(activeEffect.definition, activeEffect.params);
          offlineInstances.push(instance);
        }

        if (offlineInstances.length === 0) {
          // No effects - connect directly
          graphEnd.connect(masterGainNode);
        } else {
          // Connect: graphEnd -> effect1 -> effect2 -> ... -> masterGainNode
          let currentNode: any = graphEnd;

          offlineInstances.forEach((inst) => {
            currentNode.connect(inst.effect);
            currentNode = inst.effect;
          });

          // Connect last effect to master
          currentNode.connect(masterGainNode);
        }

        return function cleanup() {
          offlineInstances.forEach((inst) => inst.dispose());
        };
      };
    },
    [trackEffectsState]
  );

  return {
    trackEffectsState,
    addEffectToTrack,
    removeEffectFromTrack,
    updateTrackEffectParameter,
    toggleBypass,
    clearTrackEffects,
    getTrackEffectsFunction,
    createOfflineTrackEffectsFunction,
    availableEffects: effectDefinitions,
  };
}
