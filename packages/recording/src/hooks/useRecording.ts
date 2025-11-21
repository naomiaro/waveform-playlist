/**
 * Main recording hook using AudioWorklet
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { UseRecordingReturn, RecordingOptions } from '../types';
import { concatenateAudioData, createAudioBuffer } from '../utils/audioBufferUtils';
import { appendPeaks } from '../utils/peaksGenerator';
import {
  getGlobalAudioContext,
  resumeGlobalAudioContext,
  getMediaStreamSource,
} from '@waveform-playlist/playout';

export function useRecording(
  stream: MediaStream | null,
  options: RecordingOptions = {}
): UseRecordingReturn {
  const {
    channelCount = 1,
    samplesPerPixel = 1024,
  } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<Int8Array | Int16Array>(new Int16Array(0));
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [level, setLevel] = useState(0); // Current RMS level (0-1)
  const [peakLevel, setPeakLevel] = useState(0); // Peak level since recording started (0-1)

  const bits: 8 | 16 = 16; // Match the bit depth used by the final waveform

  // Refs for AudioWorklet and data accumulation
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);
  const totalSamplesRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const isRecordingRef = useRef<boolean>(false);
  const isPausedRef = useRef<boolean>(false);

  // Load AudioWorklet module
  const loadWorklet = useCallback(async (context: AudioContext) => {
    try {
      // NOTE: Removed the check for context._workletModuleLoaded to allow reloading
      // This ensures we always load the latest worklet code during development

      // Load the worklet module
      // Use a relative path that works when bundled
      const workletUrl = new URL(
        './worklet/recording-processor.worklet.js',
        import.meta.url
      ).href;

      // Add cache-busting parameter to force reload during development
      const cacheBustedUrl = `${workletUrl}?v=${Date.now()}`;

      await context.audioWorklet.addModule(cacheBustedUrl);
    } catch (err) {
      console.error('Failed to load AudioWorklet module:', err);
      throw new Error('Failed to load recording processor');
    }
  }, []);

  // Start recording
  const startRecording = useCallback(async () => {
    if (!stream) {
      setError(new Error('No microphone stream available'));
      return;
    }

    try {
      setError(null);

      // Use global AudioContext (shared with Tone.js and monitoring)
      const context = getGlobalAudioContext();

      // Resume AudioContext if suspended
      await resumeGlobalAudioContext();

      // Load worklet module
      await loadWorklet(context);

      // Get or create media stream source (managed, shared across consumers)
      const source = getMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      // Create AudioWorklet node
      const workletNode = new AudioWorkletNode(context, 'recording-processor');
      workletNodeRef.current = workletNode;

      // Connect source to worklet (but not to destination - no monitoring)
      source.connect(workletNode);

      //Listen for audio data from worklet
      workletNode.port.onmessage = (event) => {
        const { samples, rmsLevel } = event.data;

        // Accumulate samples
        recordedChunksRef.current.push(samples);
        totalSamplesRef.current += samples.length;

        // Update peaks incrementally
        setPeaks((prevPeaks) =>
          appendPeaks(
            prevPeaks,
            samples,
            samplesPerPixel,
            totalSamplesRef.current - samples.length,
            bits
          )
        );

        // Update VU meter levels
        setLevel(rmsLevel);
        setPeakLevel((prev) => Math.max(prev, rmsLevel));
      };

      // Start the worklet processor
      workletNode.port.postMessage({
        command: 'start',
        sampleRate: context.sampleRate,
        channelCount,
      });

      // Reset state
      recordedChunksRef.current = [];
      totalSamplesRef.current = 0;
      setPeaks(new Int16Array(0));
      setAudioBuffer(null);
      setLevel(0);
      setPeakLevel(0);
      isRecordingRef.current = true;
      isPausedRef.current = false;
      setIsRecording(true);
      setIsPaused(false);
      startTimeRef.current = performance.now();

      // Start duration update loop
      const updateDuration = () => {
        if (isRecordingRef.current && !isPausedRef.current) {
          const elapsed = (performance.now() - startTimeRef.current) / 1000;
          setDuration(elapsed);
          animationFrameRef.current = requestAnimationFrame(updateDuration);
        }
      };
      updateDuration();
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(err instanceof Error ? err : new Error('Failed to start recording'));
    }
  }, [stream, channelCount, samplesPerPixel, loadWorklet, isRecording, isPaused]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<AudioBuffer | null> => {
    if (!isRecording) {
      return null;
    }

    try {
      // Stop the worklet
      if (workletNodeRef.current) {
        workletNodeRef.current.port.postMessage({ command: 'stop' });

        // Disconnect worklet from source
        // (Don't disconnect the source itself - it's managed and may have other consumers)
        if (mediaStreamSourceRef.current) {
          try {
            mediaStreamSourceRef.current.disconnect(workletNodeRef.current);
          } catch (e) {
            // Source may have already been disconnected when stream changed
            // This is fine - just ignore the error
          }
        }
        workletNodeRef.current.disconnect();
      }

      // Cancel animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Create final AudioBuffer from accumulated chunks
      const allSamples = concatenateAudioData(recordedChunksRef.current);
      const context = getGlobalAudioContext();
      const buffer = createAudioBuffer(
        context,
        allSamples,
        context.sampleRate,
        channelCount
      );

      setAudioBuffer(buffer);
      setDuration(buffer.duration);
      isRecordingRef.current = false;
      isPausedRef.current = false;
      setIsRecording(false);
      setIsPaused(false);
      setLevel(0);
      // Keep peakLevel to show the peak reached during recording

      return buffer;
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError(err instanceof Error ? err : new Error('Failed to stop recording'));
      return null;
    }
  }, [isRecording, channelCount]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (isRecording && !isPaused) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      isPausedRef.current = true;
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (isRecording && isPaused) {
      isPausedRef.current = false;
      setIsPaused(false);
      startTimeRef.current = performance.now() - duration * 1000;

      const updateDuration = () => {
        if (isRecordingRef.current && !isPausedRef.current) {
          const elapsed = (performance.now() - startTimeRef.current) / 1000;
          setDuration(elapsed);
          animationFrameRef.current = requestAnimationFrame(updateDuration);
        }
      };
      updateDuration();
    }
  }, [isRecording, isPaused, duration]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (workletNodeRef.current) {
        workletNodeRef.current.port.postMessage({ command: 'stop' });

        // Disconnect worklet from source
        if (mediaStreamSourceRef.current) {
          try {
            mediaStreamSourceRef.current.disconnect(workletNodeRef.current);
          } catch (e) {
            // Source may have already been disconnected when stream changed
            // This is fine - just ignore the error
          }
        }
        workletNodeRef.current.disconnect();
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      // Don't close the global AudioContext - it's shared across the app
      // Don't disconnect the MediaStreamSource - it's managed and shared
    };
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    peaks,
    audioBuffer,
    level,
    peakLevel,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error,
  };
}
