import { useRef, useCallback } from 'react';
import type { EffectsFunction } from '@waveform-playlist/playout';
// Import Tone.js classes directly for tree-shaking
import { Analyser } from 'tone';

/**
 * Hook for master effects with frequency analyzer
 * Returns the analyser ref and the effects function to pass to WaveformPlaylistProvider
 *
 * For more advanced effects (reverb, delay, filters, etc.), use useDynamicEffects instead.
 */
export const useMasterAnalyser = (fftSize: number = 256) => {
  const analyserRef = useRef<any>(null);

  const masterEffects: EffectsFunction = useCallback((masterGainNode, destination, _isOffline) => {
    // Create analyser and connect it in parallel to monitor the output
    const analyserNode = new Analyser('fft', fftSize);
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
