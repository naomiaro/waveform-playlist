/**
 * Main recording hook using AudioWorklet
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { UseRecordingReturn, RecordingOptions } from '../types';
import { concatenateAudioData, createAudioBuffer } from '../utils/audioBufferUtils';
import { appendPeaks } from '../utils/peaksGenerator';
import { getContext } from 'tone';

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

  // Global flag to prevent loading worklet multiple times
  // (AudioWorklet processors can only be registered once per AudioContext)
  const workletLoadedRef = useRef<boolean>(false);

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
  const loadWorklet = useCallback(async () => {
    // Skip if already loaded to prevent "already registered" error
    if (workletLoadedRef.current) {
      return;
    }

    try {
      const context = getContext();
      // Load the worklet module
      // Use a relative path that works when bundled
      const workletUrl = new URL(
        './worklet/recording-processor.worklet.js',
        import.meta.url
      ).href;

      // Use Tone's addAudioWorkletModule for cross-browser compatibility
      await context.addAudioWorkletModule(workletUrl);
      workletLoadedRef.current = true;
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

      // Use Tone.js Context for cross-browser compatibility
      const context = getContext();

      // Resume AudioContext if suspended
      if (context.state === 'suspended') {
        await context.resume();
      }

      // Load worklet module
      await loadWorklet();

      // Create MediaStreamSource from Tone's context
      // Each hook creates its own source to avoid cross-context issues in Firefox
      const source = context.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      // Create AudioWorklet node using Tone's method
      const workletNode = context.createAudioWorkletNode('recording-processor');
      workletNodeRef.current = workletNode;

      // Connect source to worklet (but not to destination - no monitoring)
      source.connect(workletNode);

      //Listen for audio data from worklet
      workletNode.port.onmessage = (event: MessageEvent) => {
        const { samples } = event.data;

        // Accumulate samples
        recordedChunksRef.current.push(samples);
        totalSamplesRef.current += samples.length;

        // Update peaks incrementally for live waveform visualization
        setPeaks((prevPeaks) =>
          appendPeaks(
            prevPeaks,
            samples,
            samplesPerPixel,
            totalSamplesRef.current - samples.length,
            bits
          )
        );

        // Note: VU meter levels come from useMicrophoneLevel (AnalyserNode)
        // We don't update level/peakLevel here to avoid conflicting state updates
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
      const context = getContext();
      // Use rawContext for createBuffer (native AudioContext method)
      const rawContext = context.rawContext as AudioContext;
      const buffer = createAudioBuffer(
        rawContext,
        allSamples,
        rawContext.sampleRate,
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
