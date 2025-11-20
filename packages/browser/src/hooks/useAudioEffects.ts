import { useRef, useCallback, useState, useEffect } from 'react';
import type { EffectsFunction, TrackEffectsFunction } from '@waveform-playlist/playout';
import type * as Tone from 'tone';

/**
 * Hook for master effects with frequency analyzer
 * Returns the analyser ref and the effects function to pass to WaveformPlaylistProvider
 */
export const useMasterAnalyser = (fftSize: number = 256) => {
  const analyserRef = useRef<any>(null);

  const masterEffects: EffectsFunction = useCallback((masterGainNode, destination, isOffline, ToneLib) => {
    // Create analyser and connect it in parallel to monitor the output
    const analyserNode = new ToneLib.Analyser('fft', fftSize);
    masterGainNode.connect(analyserNode);

    // Connect master to destination as normal
    masterGainNode.connect(destination);

    // Store analyser for visualization
    analyserRef.current = analyserNode;

    return function cleanup() {
      // Cleanup when playlist is destroyed
      analyserNode.dispose();
      analyserRef.current = null;
    };
  }, [fftSize]);

  return { analyserRef, masterEffects };
};

/**
 * Hook for creating a reverb effect on a track
 */
export const useTrackReverb = (decay: number = 1.2) => {
  const trackEffects: TrackEffectsFunction = useCallback((graphEnd, masterGainNode, isOffline, ToneLib) => {
    const reverb = new ToneLib.Reverb({
      context: graphEnd.context,
      decay,
    });

    graphEnd.connect(reverb);
    reverb.connect(masterGainNode);

    return function cleanup() {
      reverb.disconnect();
      reverb.dispose();
    };
  }, [decay]);

  return trackEffects;
};

/**
 * Hook for creating an AutoWah effect on a track
 */
export const useTrackAutoWah = (options: {
  baseFrequency?: number;
  octaves?: number;
  sensitivity?: number;
} = {}) => {
  const { baseFrequency = 50, octaves = 6, sensitivity = -30 } = options;

  const trackEffects: TrackEffectsFunction = useCallback((graphEnd, masterGainNode, isOffline, ToneLib) => {
    const autoWah = new ToneLib.AutoWah({
      context: graphEnd.context,
      baseFrequency,
      octaves,
      sensitivity,
    });

    graphEnd.connect(autoWah);
    autoWah.connect(masterGainNode);

    return function cleanup() {
      autoWah.disconnect();
      autoWah.dispose();
    };
  }, [baseFrequency, octaves, sensitivity]);

  return trackEffects;
};

/**
 * Hook for chaining multiple track effects together
 * Connects effects in series: graphEnd -> effect1 -> effect2 -> ... -> masterGainNode
 *
 * @example
 * const reverbEffect = useTrackReverb(1.5);
 * const delayEffect = useTrackDelay(0.25);
 * const chainedEffect = useEffectsChain([reverbEffect, delayEffect]);
 */
export const useEffectsChain = (effects: TrackEffectsFunction[]) => {
  const chainedEffects: TrackEffectsFunction = useCallback((graphEnd, masterGainNode, isOffline, ToneLib) => {
    if (effects.length === 0) {
      // No effects, connect directly
      graphEnd.connect(masterGainNode);
      return;
    }

    if (effects.length === 1) {
      // Single effect, use it directly
      return effects[0](graphEnd, masterGainNode, isOffline, ToneLib);
    }

    // Multiple effects - chain them together
    const cleanupFunctions: (() => void)[] = [];
    const effectNodes: any[] = [];

    // Create all effect nodes
    effects.forEach((effectFn, index) => {
      // For each effect, we need to intercept its connection
      // We'll create a temporary destination node for effects to connect to
      const tempDestination = new ToneLib.Gain(1, graphEnd.context);
      effectNodes.push(tempDestination);

      const cleanup = effectFn(
        index === 0 ? graphEnd : effectNodes[index - 1],
        tempDestination,
        isOffline,
        ToneLib
      );

      if (cleanup) {
        cleanupFunctions.push(cleanup);
      }
    });

    // Connect the last effect node to the master gain
    effectNodes[effectNodes.length - 1].connect(masterGainNode);

    return function cleanup() {
      // Call all cleanup functions
      cleanupFunctions.forEach(fn => fn());
      // Dispose temp nodes
      effectNodes.forEach(node => node.dispose());
    };
  }, [effects]);

  return chainedEffects;
};
