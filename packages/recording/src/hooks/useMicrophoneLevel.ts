/**
 * Hook for monitoring microphone input levels
 *
 * Uses Tone.js Meter for real-time audio level monitoring.
 */

import { useEffect, useState, useRef } from 'react';
import { Meter, getContext, connect } from 'tone';

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
    smoothingTimeConstant = 0.8,
  } = options;

  const [level, setLevel] = useState(0);
  const [peakLevel, setPeakLevel] = useState(0);

  const meterRef = useRef<Meter | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const resetPeak = () => setPeakLevel(0);

  useEffect(() => {
    if (!stream) {
      setLevel(0);
      setPeakLevel(0);
      return;
    }

    let isMounted = true;

    // Setup audio monitoring
    const setupMonitoring = async () => {
      if (!isMounted) return;

      // Get Tone's context and resume if needed
      const context = getContext();
      if (context.state === 'suspended') {
        await context.resume();
      }

      if (!isMounted) return;

      // Create Tone.js Meter for level monitoring
      // Pass context to ensure it's created in the same context as the source
      const meter = new Meter({ smoothing: smoothingTimeConstant, context });
      meterRef.current = meter;

      // Create MediaStreamSource from the SAME context as the meter
      // Note: This creates a separate source from useRecording, but that's OK
      // since we're only using it for level monitoring (not recording)
      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Connect source to meter using Tone's connect function
      connect(source, meter);

      // Start level monitoring
      const updateInterval = 1000 / updateRate;
      let lastUpdateTime = 0;

      const updateLevel = (timestamp: number) => {
        if (!isMounted || !meterRef.current) return;

        if (timestamp - lastUpdateTime >= updateInterval) {
          lastUpdateTime = timestamp;

          // Meter.getValue() returns dB, convert to 0-1 range
          const db = meterRef.current.getValue();
          const dbValue = typeof db === 'number' ? db : db[0];
          // dB is typically -Infinity to 0, map -100dB..0dB to 0..1
          // Using -100dB as floor since Firefox seems to report lower values
          const normalized = Math.max(0, Math.min(1, (dbValue + 100) / 100));

          setLevel(normalized);
          setPeakLevel(prev => Math.max(prev, normalized));
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
        animationFrameRef.current = null;
      }

      // Disconnect and clean up
      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (e) {
          // Ignore disconnect errors
        }
        sourceRef.current = null;
      }

      if (meterRef.current) {
        meterRef.current.dispose();
        meterRef.current = null;
      }
    };
  }, [stream, smoothingTimeConstant, updateRate]);

  return {
    level,
    peakLevel,
    resetPeak,
  };
}
