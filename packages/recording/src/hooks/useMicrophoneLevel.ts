/**
 * Hook for monitoring microphone input levels
 *
 * Uses an AudioWorklet-based meter processor for sample-accurate
 * peak and RMS metering without requestAnimationFrame overhead.
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
import { addMeterWorkletModule, type MeterMessage } from '@waveform-playlist/worklets';

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
   * The live levels. Its identity is stable for the life of the hook, and the
   * hook does NOT re-render when levels change: pass it to
   * `<SegmentedVUMeter meter={meter} />`, call `meter.subscribe()`, or use
   * `useMeterLevels(meter)` for throttled React state.
   *
   * Each array has one entry per metered channel: the mic's auto-detected
   * channels, with mono repeated up to the requested `channelCount`. A mic
   * with MORE channels than `channelCount` yields one entry per actual channel.
   */
  meter: MeterSource;

  /**
   * Reset the held peak levels
   */
  resetPeak: () => void;

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
 * @returns A meter source, a peak reset, and any setup error
 *
 * @example
 * ```typescript
 * const { stream } = useMicrophoneAccess();
 * const { meter } = useMicrophoneLevel(stream, { channelCount: 2 });
 *
 * return <SegmentedVUMeter meter={meter} />;
 * ```
 */
export function useMicrophoneLevel(
  stream: MediaStream | null,
  options: UseMicrophoneLevelOptions = {}
): UseMicrophoneLevelReturn {
  const { updateRate = 60, channelCount = 1 } = options;

  // Levels change ~60 times a second, so they live in a source, not in state.
  const [{ source: meter, publish }] = useState(() =>
    createValueSource<MeterLevels>(silentMeterLevels(channelCount))
  );
  const [meterError, setMeterError] = useState<Error | null>(null);

  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const smoothedPeakRef = useRef<number[]>([]);

  const resetPeak = useCallback(() => {
    const current = meter.getSnapshot();
    publish({ ...current, peakLevels: current.peakLevels.map(() => 0) });
  }, [meter, publish]);

  useEffect(() => {
    if (!stream) {
      smoothedPeakRef.current = [];
      publish(silentMeterLevels(channelCount));
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

      // Use addMeterWorkletModule with rawContext.audioWorklet.addModule callback.
      // Can't use Tone.js addAudioWorkletModule — it caches a single _workletPromise
      // per context, silently skipping subsequent URLs.
      const rawCtx = context.rawContext as AudioContext;
      await addMeterWorkletModule((url) => rawCtx.audioWorklet.addModule(url));
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

      smoothedPeakRef.current = [];

      // Listen for meter data from worklet
      workletNode.port.onmessage = (event: MessageEvent) => {
        if (!isMounted) return;

        const reading = readMeterMessage({
          data: event.data as MeterMessage,
          previousSmoothedPeaks: smoothedPeakRef.current,
          heldPeakLevels: meter.getSnapshot().peakLevels,
          // Mirror mono to fill the requested channelCount
          minChannels: channelCount,
        });
        smoothedPeakRef.current = reading.smoothedPeaks;
        publish(reading.levels);
      };

      // Setup succeeded — clear any error from a previous failed attempt so
      // the UI doesn't show a permanent failure while metering works.
      setMeterError(null);
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
  }, [stream, updateRate, channelCount, meter, publish]);

  return {
    meter,
    resetPeak,
    error: meterError,
  };
}
