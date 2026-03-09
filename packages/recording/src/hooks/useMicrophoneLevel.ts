/**
 * Hook for monitoring microphone input levels
 *
 * Uses Tone.js Analyser for real-time audio level monitoring.
 * Computes both true peak and RMS from raw waveform data.
 */

import { useEffect, useState, useRef } from 'react';
import { Analyser, getContext, connect } from 'tone';
import { dBToNormalized } from '@waveform-playlist/core';

/** Peak decay constant — matches openDAW's 250ms exponential decay */
const PEAK_DECAY = 0.98;

export interface UseMicrophoneLevelOptions {
  /**
   * How often to update the level (in Hz)
   * Default: 60 (60fps)
   */
  updateRate?: number;

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
   * Current peak audio level (0-1)
   * For single channel: channel 0 level
   * For multi-channel: max across all channels
   */
  level: number;

  /**
   * Held peak level since last reset (0-1)
   * For single channel: channel 0 peak
   * For multi-channel: max across all channels
   */
  peakLevel: number;

  /**
   * Reset the held peak level
   */
  resetPeak: () => void;

  /**
   * Per-channel peak levels (0-1). Array length matches channelCount.
   * True peak: max absolute sample value per analysis frame.
   */
  levels: number[];

  /**
   * Per-channel held peak levels (0-1). Array length matches channelCount.
   */
  peakLevels: number[];

  /**
   * Per-channel RMS levels (0-1). Array length matches channelCount.
   * RMS: root mean square of samples per analysis frame.
   */
  rmsLevels: number[];
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
 * Uses gainToDb then dBToNormalized for consistent mapping.
 */
function gainToNormalized(gain: number): number {
  if (gain <= 0) return 0;
  const db = 20 * Math.log10(gain);
  return dBToNormalized(db);
}

/**
 * Monitor microphone input levels in real-time
 *
 * @param stream - MediaStream from getUserMedia
 * @param options - Configuration options
 * @returns Object with current peak level, RMS level, and held peak level
 *
 * @example
 * ```typescript
 * const { stream } = useMicrophoneAccess();
 * const { levels, rmsLevels, peakLevels } = useMicrophoneLevel(stream, { channelCount: 2 });
 *
 * return <SegmentedVUMeter levels={levels} peakLevels={peakLevels} />;
 * ```
 */
export function useMicrophoneLevel(
  stream: MediaStream | null,
  options: UseMicrophoneLevelOptions = {}
): UseMicrophoneLevelReturn {
  const { updateRate = 60, smoothingTimeConstant = 0.8, channelCount = 1 } = options;

  const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [rmsLevels, setRmsLevels] = useState<number[]>(() => new Array(channelCount).fill(0));

  const analyserRef = useRef<Analyser | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  // Track smoothed peak per channel for decay between frames
  const smoothedPeakRef = useRef<number[]>(new Array(channelCount).fill(0));

  const resetPeak = () => setPeakLevels(new Array(channelCount).fill(0));

  useEffect(() => {
    if (!stream) {
      setLevels(new Array(channelCount).fill(0));
      setPeakLevels(new Array(channelCount).fill(0));
      setRmsLevels(new Array(channelCount).fill(0));
      smoothedPeakRef.current = new Array(channelCount).fill(0);
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

      // Auto-detect actual mic channel count from stream
      const trackSettings = stream.getAudioTracks()[0]?.getSettings();
      const actualChannels = trackSettings?.channelCount ?? channelCount;

      // Create Tone.js Analyser for raw waveform data
      const analyser = new Analyser({
        context,
        size: 256,
        type: 'waveform',
        channels: actualChannels,
        smoothing: smoothingTimeConstant,
      });
      analyserRef.current = analyser;

      // Create MediaStreamSource from the SAME context as the analyser
      // Note: This creates a separate source from useRecording, but that's OK
      // since we're only using it for level monitoring (not recording)
      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Connect source to analyser using Tone's connect function
      connect(source, analyser);

      smoothedPeakRef.current = new Array(actualChannels).fill(0);

      // Start level monitoring
      const updateInterval = 1000 / updateRate;
      let lastUpdateTime = 0;

      const updateLevel = (timestamp: number) => {
        if (!isMounted || !analyserRef.current) return;

        if (timestamp - lastUpdateTime >= updateInterval) {
          lastUpdateTime = timestamp;

          const rawValues = analyserRef.current.getValue();

          // Normalize to array of Float32Arrays (single channel returns Float32Array directly)
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

          // Mirror mono to fill requested channelCount
          const mirroredPeaks =
            channelData.length < channelCount
              ? new Array(channelCount).fill(peakValues[0])
              : peakValues;
          const mirroredRms =
            channelData.length < channelCount
              ? new Array(channelCount).fill(rmsValues[0])
              : rmsValues;

          setLevels(mirroredPeaks);
          setRmsLevels(mirroredRms);
          setPeakLevels((prev) => mirroredPeaks.map((val, i) => Math.max(prev[i] ?? 0, val)));
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

      if (analyserRef.current) {
        analyserRef.current.dispose();
        analyserRef.current = null;
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
    rmsLevels,
  };
}
