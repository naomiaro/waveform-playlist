/**
 * Hook for monitoring master output levels
 *
 * Connects a Tone.js Meter to the Destination node for real-time
 * output level monitoring. Used for playback VU meters.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Meter, getDestination, getContext } from 'tone';
import { dBToNormalized } from '@waveform-playlist/core';

export interface UseOutputMeterOptions {
  /**
   * Number of channels to meter.
   * Default: 2 (stereo output)
   */
  channelCount?: number;

  /**
   * Smoothing time constant (0-1).
   * Higher values = smoother but slower response.
   * Default: 0.8
   */
  smoothingTimeConstant?: number;

  /**
   * How often to update the levels (in Hz).
   * Default: 60 (60fps)
   */
  updateRate?: number;
}

export interface UseOutputMeterReturn {
  /** Per-channel output levels (0-1) */
  levels: number[];
  /** Per-channel peak levels (0-1) */
  peakLevels: number[];
  /** Reset all peak levels to 0 */
  resetPeak: () => void;
}

export function useOutputMeter(options: UseOutputMeterOptions = {}): UseOutputMeterReturn {
  const { channelCount = 2, smoothingTimeConstant = 0.8, updateRate = 60 } = options;

  const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));

  const meterRef = useRef<Meter | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const resetPeak = useCallback(
    () => setPeakLevels(new Array(channelCount).fill(0)),
    [channelCount]
  );

  useEffect(() => {
    let isMounted = true;

    const context = getContext();

    // Create Meter connected to Destination
    const meter = new Meter({
      smoothing: smoothingTimeConstant,
      context,
      channelCount,
    });
    meterRef.current = meter;

    // Connect: Destination -> Meter (Meter is a pass-through, won't affect audio)
    getDestination().connect(meter);

    // Start level monitoring
    const updateInterval = 1000 / updateRate;
    let lastUpdateTime = 0;

    const updateLevel = (timestamp: number) => {
      if (!isMounted || !meterRef.current) return;

      if (timestamp - lastUpdateTime >= updateInterval) {
        lastUpdateTime = timestamp;

        const db = meterRef.current.getValue();
        const dbValues = typeof db === 'number' ? [db] : db;
        const normalized = dbValues.map((v) => dBToNormalized(v));

        setLevels(normalized);
        setPeakLevels((prev) => normalized.map((val, i) => Math.max(prev[i] ?? 0, val)));
      }

      animationFrameRef.current = requestAnimationFrame(updateLevel);
    };

    animationFrameRef.current = requestAnimationFrame(updateLevel);

    return () => {
      isMounted = false;

      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      if (meterRef.current) {
        try {
          getDestination().disconnect(meterRef.current);
        } catch {
          console.warn('[waveform-playlist] Failed to disconnect output meter');
        }
        meterRef.current.dispose();
        meterRef.current = null;
      }
    };
  }, [channelCount, smoothingTimeConstant, updateRate]);

  return { levels, peakLevels, resetPeak };
}
