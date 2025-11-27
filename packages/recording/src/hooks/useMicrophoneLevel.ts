/**
 * Hook for monitoring microphone input levels
 *
 * Uses an AnalyserNode to provide real-time audio level monitoring
 * suitable for VU meter displays.
 */

import { useEffect, useState, useRef } from 'react';
import { getGlobalContext } from '@waveform-playlist/playout';

export interface UseMicrophoneLevelOptions {
  /**
   * How often to update the level (in Hz)
   * Default: 60 (60fps)
   */
  updateRate?: number;

  /**
   * FFT size for the analyser
   * Default: 256
   */
  fftSize?: number;

  /**
   * Smoothing time constant (0-1)
   * Higher values = smoother but slower response
   * Default: 0.8
   */
  smoothingTimeConstant?: number;
}

export interface UseMicrophoneLevelReturn {
  /**
   * Current audio level (0-1)
   * 0 = silence, 1 = maximum level
   */
  level: number;

  /**
   * Peak level since last reset (0-1)
   */
  peakLevel: number;

  /**
   * Reset the peak level
   */
  resetPeak: () => void;
}

/**
 * Monitor microphone input levels in real-time
 *
 * @param stream - MediaStream from getUserMedia
 * @param options - Configuration options
 * @returns Object with current level and peak level
 *
 * @example
 * ```typescript
 * const { stream } = useMicrophoneAccess();
 * const { level, peakLevel, resetPeak } = useMicrophoneLevel(stream);
 *
 * return <VUMeter level={level} peakLevel={peakLevel} />;
 * ```
 */
export function useMicrophoneLevel(
  stream: MediaStream | null,
  options: UseMicrophoneLevelOptions = {}
): UseMicrophoneLevelReturn {
  const {
    updateRate = 60,
    fftSize = 256,
    smoothingTimeConstant = 0.8,
  } = options;

  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);

  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);

  const resetPeak = () => setPeakLevel(0);

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      setPeakLevel(0);
      return;
    }

    let isMounted = true;

    // Setup audio monitoring asynchronously
    const setupMonitoring = async () => {
      // Use global Tone.js Context for cross-browser compatibility
      const context = getGlobalContext();

      // Note: AudioContext will be resumed by Record button click
      // We set up the nodes now, and they'll start working when context is resumed

      if (!isMounted) return;

      // Create analyser node using Tone.js Context
      const analyser = context.createAnalyser();
      analyser.fftSize = fftSize;
      analyser.smoothingTimeConstant = smoothingTimeConstant;
      analyserRef.current = analyser;

      // Create data array for time domain data
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      dataArrayRef.current = dataArray;

      // Create media stream source using Tone.js Context
      const source = context.createMediaStreamSource(stream);
      source.connect(analyser);
      sourceRef.current = source;

      // Update level at specified rate
      const updateInterval = 1000 / updateRate;
      let lastUpdateTime = 0;

      const updateLevel = (timestamp: number) => {
        if (timestamp - lastUpdateTime >= updateInterval) {
          lastUpdateTime = timestamp;

          // Get time domain data
          analyser.getByteTimeDomainData(dataArray);

          // Calculate RMS (Root Mean Square) level
          let sum = 0;
          for (let i = 0; i < bufferLength; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sum += normalized * normalized;
          }
          const rms = Math.sqrt(sum / bufferLength);

          setLevel(rms);
          setPeakLevel(prev => Math.max(prev, rms));
        }

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    setupMonitoring();

    // Cleanup
    return () => {
      isMounted = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Disconnect analyser from the source
      if (analyserRef.current && sourceRef.current) {
        try {
          sourceRef.current.disconnect(analyserRef.current);
        } catch (e) {
          // Source may have already been disconnected when stream changed
          // This is fine - just ignore the error
        }
      }

      // Don't close the global AudioContext - it's shared across the app

      analyserRef.current = null;
      sourceRef.current = null;
      dataArrayRef.current = null;
    };
  }, [stream, fftSize, smoothingTimeConstant, updateRate]);

  return {
    level,
    peakLevel,
    resetPeak,
  };
}
