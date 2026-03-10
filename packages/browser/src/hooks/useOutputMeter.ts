/**
 * Hook for monitoring master output levels
 *
 * Connects an AudioWorklet meter processor to the Destination node for
 * real-time output level monitoring. Computes sample-accurate peak and
 * RMS via the meter worklet — no transient is missed.
 *
 * IMPORTANT: Uses getGlobalContext() from playout to ensure the meter
 * is created on the same AudioContext as the audio engine. Tone.js's
 * getContext()/getDestination() return the DEFAULT context, which is
 * replaced when getGlobalContext() calls setContext() on first audio init.
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { getGlobalContext } from '@waveform-playlist/playout';
import { gainToNormalized } from '@waveform-playlist/core';
import { meterProcessorUrl, type MeterMessage } from '@waveform-playlist/worklets';

/** Peak decay constant — exponential decay for smooth peak hold (~800ms to 1/e at 60fps) */
const PEAK_DECAY = 0.98;

export interface UseOutputMeterOptions {
  /**
   * Number of channels to meter.
   * Default: 2 (stereo output)
   */
  channelCount?: number;

  /**
   * How often to update the levels (in Hz).
   * Default: 60 (60fps)
   */
  updateRate?: number;

  /**
   * Whether audio is currently playing. When this transitions to false,
   * all levels (current, peak, RMS) and smoothed state are reset to zero.
   * Without this, the browser's tail-time optimization stops calling the
   * worklet's process() when no audio flows, leaving the last non-zero
   * levels frozen in state.
   * Default: false
   */
  isPlaying?: boolean;
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
  /** Error from meter setup (worklet load failure, context issues, etc.) */
  error: Error | null;
}

export function useOutputMeter(options: UseOutputMeterOptions = {}): UseOutputMeterReturn {
  const { channelCount = 2, updateRate = 60, isPlaying = false } = options;

  const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [rmsLevels, setRmsLevels] = useState<number[]>(() => new Array(channelCount).fill(0));

  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const smoothedPeakRef = useRef<number[]>(new Array(channelCount).fill(0));
  const [meterError, setMeterError] = useState<Error | null>(null);

  const resetPeak = useCallback(
    () => setPeakLevels(new Array(channelCount).fill(0)),
    [channelCount]
  );

  // Reset all levels when playback stops
  useEffect(() => {
    if (!isPlaying) {
      const zeros = new Array(channelCount).fill(0);
      smoothedPeakRef.current = new Array(channelCount).fill(0);
      setLevels(zeros);
      setRmsLevels(zeros);
      setPeakLevels(zeros);
    }
  }, [isPlaying, channelCount]);

  useEffect(() => {
    let isMounted = true;

    const setup = async () => {
      // Use getGlobalContext() to ensure we're on the SAME context as the audio engine.
      const context = getGlobalContext();

      // Load worklet directly on rawContext — Tone.js's addAudioWorkletModule
      // only loads ONE module per context (caches _workletPromise), silently
      // skipping subsequent calls with different URLs.
      const rawCtx = context.rawContext as AudioContext;
      await rawCtx.audioWorklet.addModule(meterProcessorUrl);
      if (!isMounted) return;

      // Use Tone.js's createAudioWorkletNode — avoids rawContext identity issues
      // in webpack-aliased environments (Docusaurus)
      const workletNode = context.createAudioWorkletNode('meter-processor', {
        channelCount,
        channelCountMode: 'explicit' as globalThis.ChannelCountMode,
        processorOptions: {
          numberOfChannels: channelCount,
          updateRate,
        },
      });
      workletNodeRef.current = workletNode;

      workletNode.onprocessorerror = (event) => {
        console.warn('[waveform-playlist] Output meter worklet processor error:', String(event));
      };

      // Insert as pass-through in destination chain:
      // Volume → WorkletNode → Gain → rawContext.destination
      const destination = context.destination;
      destination.chain(workletNode);

      smoothedPeakRef.current = new Array(channelCount).fill(0);

      // Listen for meter data from worklet
      workletNode.port.onmessage = (event: MessageEvent) => {
        if (!isMounted) return;

        const { peak, rms } = event.data as MeterMessage;
        const smoothed = smoothedPeakRef.current;

        const peakValues: number[] = [];
        const rmsValues: number[] = [];

        for (let ch = 0; ch < peak.length; ch++) {
          // Smoothed peak: jump up instantly, decay slowly
          smoothed[ch] = Math.max(peak[ch], (smoothed[ch] ?? 0) * PEAK_DECAY);
          peakValues.push(gainToNormalized(smoothed[ch]));
          rmsValues.push(gainToNormalized(rms[ch]));
        }

        setLevels(peakValues);
        setRmsLevels(rmsValues);
        setPeakLevels((prev) => peakValues.map((val, i) => Math.max(prev[i] ?? 0, val)));
      };
    };

    setup().catch((err) => {
      console.warn('[waveform-playlist] Failed to set up output meter:', String(err));
      if (isMounted) {
        setMeterError(err instanceof Error ? err : new Error(String(err)));
      }
    });

    return () => {
      isMounted = false;

      if (workletNodeRef.current) {
        // Restore default chain: Volume → Gain (removes worklet from path)
        try {
          const context = getGlobalContext();
          context.destination.chain();
        } catch (err) {
          console.warn('[waveform-playlist] Failed to restore destination chain:', String(err));
        }
        try {
          workletNodeRef.current.disconnect();
          workletNodeRef.current.port.close();
        } catch (err) {
          console.warn('[waveform-playlist] Output meter disconnect during cleanup:', String(err));
        }
        workletNodeRef.current = null;
      }
    };
  }, [channelCount, updateRate]);

  return { levels, peakLevels, rmsLevels, resetPeak, error: meterError };
}
