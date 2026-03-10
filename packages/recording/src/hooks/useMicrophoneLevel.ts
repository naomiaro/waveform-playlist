/**
 * Hook for monitoring microphone input levels
 *
 * Uses an AudioWorklet-based meter processor for sample-accurate
 * peak and RMS metering without requestAnimationFrame overhead.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getGlobalContext } from '@waveform-playlist/playout';
import { gainToNormalized } from '@waveform-playlist/core';
import { meterProcessorUrl, type MeterMessage } from '@waveform-playlist/worklets';

/** Peak decay constant — exponential decay for smooth peak hold (~800ms to 1/e at 60fps) */
const PEAK_DECAY = 0.98;

export interface UseMicrophoneLevelOptions {
  /**
   * How often to update the level (in Hz)
   * Default: 60 (60fps)
   */
  updateRate?: number;

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

  /**
   * Error from meter setup (worklet load failure, context issues, etc.)
   * Null when metering is working normally.
   */
  error: Error | null;
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
  const { updateRate = 60, channelCount = 1 } = options;

  const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [rmsLevels, setRmsLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [meterError, setMeterError] = useState<Error | null>(null);

  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const smoothedPeakRef = useRef<number[]>(new Array(channelCount).fill(0));

  const resetPeak = useCallback(
    () => setPeakLevels(new Array(channelCount).fill(0)),
    [channelCount]
  );

  useEffect(() => {
    if (!stream) {
      setLevels(new Array(channelCount).fill(0));
      setPeakLevels(new Array(channelCount).fill(0));
      setRmsLevels(new Array(channelCount).fill(0));
      smoothedPeakRef.current = new Array(channelCount).fill(0);
      return;
    }

    let isMounted = true;

    const setupMonitoring = async () => {
      if (!isMounted) return;

      const context = getGlobalContext();
      if (context.state === 'suspended') {
        await context.resume();
      }
      if (!isMounted) return;

      // Auto-detect actual mic channel count from stream
      const trackSettings = stream.getAudioTracks()[0]?.getSettings();
      const actualChannels = trackSettings?.channelCount ?? channelCount;

      // Load worklet directly on rawContext — Tone.js's addAudioWorkletModule
      // only loads ONE module per context (caches _workletPromise), silently
      // skipping subsequent calls with different URLs.
      const rawCtx = context.rawContext as AudioContext;
      await rawCtx.audioWorklet.addModule(meterProcessorUrl);
      if (!isMounted) return;

      // Use Tone.js's createAudioWorkletNode — avoids rawContext identity issues
      // in webpack-aliased environments (Docusaurus)
      const workletNode = context.createAudioWorkletNode('meter-processor', {
        channelCount: actualChannels,
        channelCountMode: 'explicit' as globalThis.ChannelCountMode,
        processorOptions: {
          numberOfChannels: actualChannels,
          updateRate,
        },
      });
      workletNodeRef.current = workletNode;

      workletNode.onprocessorerror = (event) => {
        console.warn('[waveform-playlist] Mic meter worklet processor error:', String(event));
      };

      // Create source and connect: source → meter
      // Don't connect output to destination — mic monitoring would cause feedback
      const source = context.createMediaStreamSource(stream);
      sourceRef.current = source;
      source.connect(workletNode);

      smoothedPeakRef.current = new Array(actualChannels).fill(0);

      // Listen for meter data from worklet
      workletNode.port.onmessage = (event: MessageEvent) => {
        if (!isMounted) return;

        const { peak, rms } = event.data as MeterMessage;
        const smoothed = smoothedPeakRef.current;

        const peakValues: number[] = [];
        const rmsValues: number[] = [];

        for (let ch = 0; ch < peak.length; ch++) {
          smoothed[ch] = Math.max(peak[ch], (smoothed[ch] ?? 0) * PEAK_DECAY);
          peakValues.push(gainToNormalized(smoothed[ch]));
          rmsValues.push(gainToNormalized(rms[ch]));
        }

        // Mirror mono to fill requested channelCount
        const mirroredPeaks =
          peak.length < channelCount ? new Array(channelCount).fill(peakValues[0]) : peakValues;
        const mirroredRms =
          peak.length < channelCount ? new Array(channelCount).fill(rmsValues[0]) : rmsValues;

        setLevels(mirroredPeaks);
        setRmsLevels(mirroredRms);
        setPeakLevels((prev) => mirroredPeaks.map((val, i) => Math.max(prev[i] ?? 0, val)));
      };
    };

    setupMonitoring().catch((err) => {
      console.warn('[waveform-playlist] Failed to set up mic level monitoring:', String(err));
      if (isMounted) {
        setMeterError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return () => {
      isMounted = false;

      if (sourceRef.current) {
        try {
          sourceRef.current.disconnect();
        } catch (err) {
          console.warn('[waveform-playlist] Mic source disconnect during cleanup:', String(err));
        }
        sourceRef.current = null;
      }

      if (workletNodeRef.current) {
        try {
          workletNodeRef.current.disconnect();
          workletNodeRef.current.port.close();
        } catch (err) {
          console.warn('[waveform-playlist] Mic meter disconnect during cleanup:', String(err));
        }
        workletNodeRef.current = null;
      }
    };
  }, [stream, updateRate, channelCount]);

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
    error: meterError,
  };
}
