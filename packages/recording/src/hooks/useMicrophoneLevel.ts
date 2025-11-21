/**
 * Hook for monitoring microphone input levels
 *
 * Uses an AnalyserNode to provide real-time audio level monitoring
 * suitable for VU meter displays.
 */

import { useEffect, useState, useRef } from 'react';
import * as Tone from 'tone';

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

    const context = Tone.context.rawContext as AudioContext;

    // Create analyser node
    const analyser = context.createAnalyser();
    analyser.fftSize = fftSize;
    analyser.smoothingTimeConstant = smoothingTimeConstant;
    analyserRef.current = analyser;

    // Create data array for time domain data
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    dataArrayRef.current = dataArray;

    // Connect stream to analyser
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

    // Cleanup
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      if (sourceRef.current) {
        sourceRef.current.disconnect();
      }

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
