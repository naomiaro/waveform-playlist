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
import {
  createValueSource,
  readMeterMessage,
  silentMeterLevels,
  type MeterLevels,
  type MeterSource,
} from '@waveform-playlist/core';
import { meterProcessorUrl, type MeterMessage } from '@waveform-playlist/worklets';

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
   * levels frozen.
   * Default: false
   */
  isPlaying?: boolean;
}

export interface UseOutputMeterReturn {
  /**
   * The live output levels, one entry per channel. Its identity is stable for
   * the life of the hook, and the hook does NOT re-render when levels change:
   * pass it to `<SegmentedVUMeter meter={meter} />`, call `meter.subscribe()`,
   * or use `useMeterLevels(meter)` for throttled React state.
   */
  meter: MeterSource;
  /** Reset all held peak levels to 0 */
  resetPeak: () => void;
  /** Error from meter setup (worklet load failure, context issues, etc.) */
  error: Error | null;
}

export function useOutputMeter(options: UseOutputMeterOptions = {}): UseOutputMeterReturn {
  const { channelCount = 2, updateRate = 60, isPlaying = false } = options;

  // Levels change ~60 times a second, so they live in a source, not in state.
  const [{ source: meter, publish }] = useState(() =>
    createValueSource<MeterLevels>(silentMeterLevels(channelCount))
  );

  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const smoothedPeakRef = useRef<number[]>([]);
  const [meterError, setMeterError] = useState<Error | null>(null);

  const resetPeak = useCallback(() => {
    const current = meter.getSnapshot();
    publish({ ...current, peakLevels: current.peakLevels.map(() => 0) });
  }, [meter, publish]);

  // Reset all levels when playback stops
  useEffect(() => {
    if (!isPlaying) {
      smoothedPeakRef.current = [];
      publish(silentMeterLevels(channelCount));
    }
  }, [isPlaying, channelCount, publish]);

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

      smoothedPeakRef.current = [];

      // Listen for meter data from worklet
      workletNode.port.onmessage = (event: MessageEvent) => {
        if (!isMounted) return;

        const reading = readMeterMessage({
          data: event.data as MeterMessage,
          previousSmoothedPeaks: smoothedPeakRef.current,
          heldPeakLevels: meter.getSnapshot().peakLevels,
        });
        smoothedPeakRef.current = reading.smoothedPeaks;
        publish(reading.levels);
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
  }, [channelCount, updateRate, meter, publish]);

  return { meter, resetPeak, error: meterError };
}
