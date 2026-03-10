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
import { dBToNormalized } from '@waveform-playlist/core';
import { meterProcessorUrl } from '@waveform-playlist/worklets';

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
   *
   * @deprecated No longer used internally (worklet handles its own timing).
   * Kept for backwards compatibility.
   */
  smoothingTimeConstant?: number;

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
  const { channelCount = 2, updateRate = 60, isPlaying = false } = options;

  const [levels, setLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [peakLevels, setPeakLevels] = useState<number[]>(() => new Array(channelCount).fill(0));
  const [rmsLevels, setRmsLevels] = useState<number[]>(() => new Array(channelCount).fill(0));

  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const smoothedPeakRef = useRef<number[]>(new Array(channelCount).fill(0));

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
      const rawCtx = (context as any).rawContext as AudioContext;
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

      // Insert as pass-through in destination chain:
      // Volume → WorkletNode → Gain → rawContext.destination
      const destination = context.destination;
      destination.chain(workletNode);

      smoothedPeakRef.current = new Array(channelCount).fill(0);

      // Listen for meter data from worklet
      workletNode.port.onmessage = (event: MessageEvent) => {
        if (!isMounted) return;

        const { peak, rms } = event.data as { peak: number[]; rms: number[] };
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

    setup();

    return () => {
      isMounted = false;

      if (workletNodeRef.current) {
        // Restore default chain: Volume → Gain (removes worklet from path)
        try {
          const context = getGlobalContext();
          context.destination.chain();
        } catch {
          console.warn('[waveform-playlist] Failed to restore destination chain');
        }
        try {
          workletNodeRef.current.disconnect();
          workletNodeRef.current.port.close();
        } catch {
          // Ignore disconnect errors
        }
        workletNodeRef.current = null;
      }
    };
  }, [channelCount, updateRate]);

  return { levels, peakLevels, rmsLevels, resetPeak };
}
