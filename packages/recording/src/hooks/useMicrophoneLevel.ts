/**
 * Hook for monitoring microphone input levels
 *
 * Uses Tone.js Meter for real-time audio level monitoring.
 */

import { useEffect, useState, useRef } from 'react';
import { Meter, getContext, connect } from 'tone';
import { dBToNormalized } from '@waveform-playlist/core';

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

  /**
   * Number of channels to meter (1 = mono, 2 = stereo)
   * Default: 1
   */
  channelCount?: number;
}

export interface UseMicrophoneLevelReturn {
  /**
   * Current audio level (0-1)
   * 0 = silence, 1 = maximum level
   * For single channel: channel 0 level
   * For multi-channel: max across all channels
   */
  level: number;

  /**
   * Peak level since last reset (0-1)
   * For single channel: channel 0 peak
   * For multi-channel: max across all channels
   */
  peakLevel: number;

  /**
   * Reset the peak level
   */
  resetPeak: () => void;

  /**
   * Per-channel levels (0-1). Array length matches channelCount.
   */
  levels: number[];

  /**
   * Per-channel peak levels (0-1). Array length matches channelCount.
   */
  peakLevels: number[];
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
  const { updateRate = 60, smoothingTimeConstant = 0.8, channelCount = 1 } = options;

  const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));

  const meterRef = useRef<Meter | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const resetPeak = () => setPeakLevels(new Array(channelCount).fill(0));

  useEffect(() => {
    if (!stream) {
      setLevels(new Array(channelCount).fill(0));
      setPeakLevels(new Array(channelCount).fill(0));
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
      const meter = new Meter({ smoothing: smoothingTimeConstant, context, channelCount });
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

          // Meter.getValue() returns dB (number for single channel, number[] for multi)
          const db = meterRef.current.getValue();

          if (typeof db === 'number') {
            // Single channel
            const normalized = dBToNormalized(db);
            setLevels([normalized]);
            setPeakLevels((prev) => [Math.max(prev[0], normalized)]);
          } else {
            // Multi-channel: db is number[]
            const normalizedLevels = db.map((dbValue) => dBToNormalized(dbValue));
            setLevels(normalizedLevels);
            setPeakLevels((prev) => normalizedLevels.map((val, i) => Math.max(prev[i] ?? 0, val)));
          }
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
        } catch {
          // Ignore disconnect errors
        }
        sourceRef.current = null;
      }

      if (meterRef.current) {
        meterRef.current.dispose();
        meterRef.current = null;
      }
    };
  }, [stream, smoothingTimeConstant, updateRate, channelCount]);

  // Backwards-compatible scalar values
  const level = channelCount === 1 ? (levels[0] ?? 0) : Math.max(...levels);
  const peakLevel = channelCount === 1 ? (peakLevels[0] ?? 0) : Math.max(...peakLevels);

  return {
    level,
    peakLevel,
    resetPeak,
    levels,
    peakLevels,
  };
}
