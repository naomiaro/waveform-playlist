/**
 * Hook for monitoring master output levels
 *
 * Connects a Tone.js Analyser to the Destination node for real-time
 * output level monitoring. Computes both true peak and RMS from raw
 * waveform data.
 *
 * IMPORTANT: Uses getGlobalContext() from playout to ensure the analyser
 * is created on the same AudioContext as the audio engine. Tone.js's
 * getContext()/getDestination() return the DEFAULT context, which is
 * replaced when getGlobalContext() calls setContext() on first audio init.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { Analyser } from 'tone';
import { getGlobalContext } from '@waveform-playlist/playout';
import { dBToNormalized } from '@waveform-playlist/core';

/** Peak decay constant — matches openDAW's 250ms exponential decay */
const PEAK_DECAY = 0.98;

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
  /** Per-channel peak output levels (0-1) */
  levels: number[];
  /** Per-channel held peak levels (0-1) */
  peakLevels: number[];
  /** Per-channel RMS output levels (0-1) */
  rmsLevels: number[];
  /** Reset all held peak levels to 0 */
  resetPeak: () => void;
}

/**
 * Compute true peak (max absolute value) from a Float32Array of samples.
 */
function computePeak(samples: Float32Array): number {
  let max = 0;
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > max) max = abs;
  }
  return max;
}

/**
 * Compute RMS (root mean square) from a Float32Array of samples.
 */
function computeRms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    sum += samples[i] * samples[i];
  }
  return Math.sqrt(sum / samples.length);
}

/**
 * Convert a linear gain value (0-1+) to normalized 0-1 via dB.
 */
function gainToNormalized(gain: number): number {
  if (gain <= 0) return 0;
  const db = 20 * Math.log10(gain);
  return dBToNormalized(db);
}

export function useOutputMeter(options: UseOutputMeterOptions = {}): UseOutputMeterReturn {
  const { channelCount = 2, smoothingTimeConstant = 0.8, updateRate = 60 } = options;

  const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [rmsLevels, setRmsLevels] = useState<number[]>(() => new Array(channelCount).fill(0));

  const analyserRef = useRef<Analyser | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const smoothedPeakRef = useRef<number[]>(new Array(channelCount).fill(0));

  const resetPeak = useCallback(
    () => setPeakLevels(new Array(channelCount).fill(0)),
    [channelCount]
  );

  useEffect(() => {
    let isMounted = true;

    // Use getGlobalContext() to ensure we're on the SAME context as the audio engine.
    const context = getGlobalContext();

    // Create Analyser for raw waveform data on the global context
    const analyser = new Analyser({
      context,
      size: 256,
      type: 'waveform',
      channels: channelCount,
      smoothing: smoothingTimeConstant,
    });
    analyserRef.current = analyser;

    // Insert Analyser into Destination's internal chain using the official chain() API.
    // Destination.chain(analyser) routes: Volume → Analyser → Gain → rawContext.destination.
    // Analyser is a pass-through so audio is unaffected.
    const destination = context.destination;
    destination.chain(analyser);

    smoothedPeakRef.current = new Array(channelCount).fill(0);

    // Start level monitoring
    const updateInterval = 1000 / updateRate;
    let lastUpdateTime = 0;

    const updateLevel = (timestamp: number) => {
      if (!isMounted || !analyserRef.current) return;

      if (timestamp - lastUpdateTime >= updateInterval) {
        lastUpdateTime = timestamp;

        const rawValues = analyserRef.current.getValue();

        // Normalize to array of Float32Arrays
        const channelData: Float32Array[] =
          rawValues instanceof Float32Array ? [rawValues] : (rawValues as Float32Array[]);

        const peakValues: number[] = [];
        const rmsValues: number[] = [];
        const smoothed = smoothedPeakRef.current;

        for (let ch = 0; ch < channelData.length; ch++) {
          const samples = channelData[ch];
          const peak = computePeak(samples);
          const rms = computeRms(samples);

          // Smoothed peak: jump up instantly, decay slowly
          smoothed[ch] = Math.max(peak, (smoothed[ch] ?? 0) * PEAK_DECAY);

          peakValues.push(gainToNormalized(smoothed[ch]));
          rmsValues.push(gainToNormalized(rms));
        }

        setLevels(peakValues);
        setRmsLevels(rmsValues);
        setPeakLevels((prev) => peakValues.map((val, i) => Math.max(prev[i] ?? 0, val)));
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

      if (analyserRef.current) {
        // Restore default chain: Volume → Gain (removes analyser from path)
        try {
          destination.chain();
        } catch {
          console.warn('[waveform-playlist] Failed to restore destination chain');
        }
        analyserRef.current.dispose();
        analyserRef.current = null;
      }
    };
  }, [channelCount, smoothingTimeConstant, updateRate]);

  return { levels, peakLevels, rmsLevels, resetPeak };
}
