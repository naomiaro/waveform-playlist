/**
 * Main recording hook using AudioWorklet
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { UseRecordingReturn, RecordingOptions } from '../types';
import { concatenateAudioData, createAudioBuffer } from '../utils/audioBufferUtils';
import { appendPeaks } from '../utils/peaksGenerator';

export function useRecording(
  stream: MediaStream | null,
  options: RecordingOptions = {}
): UseRecordingReturn {
  const {
    sampleRate,
    channelCount = 1,
    samplesPerPixel = 1024,
  } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  const [peaks, setPeaks] = useState<number[]>([]);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [error, setError] = useState<Error | null>(null);

  // Refs for AudioWorklet and data accumulation
  const audioContextRef = useRef<AudioContext | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const recordedChunksRef = useRef<Float32Array[]>([]);
  const totalSamplesRef = useRef(0);
  const animationFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Get or create AudioContext for recording
  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = sampleRate
        ? new AudioContext({ sampleRate })
        : new AudioContext();
    }
    return audioContextRef.current;
  }, [sampleRate]);

  // Load AudioWorklet module
  const loadWorklet = useCallback(async (context: AudioContext) => {
    try {
      // Check if already loaded
      // @ts-ignore - AudioWorklet doesn't have a way to check if module is loaded
      if (context._workletModuleLoaded) {
        return;
      }

      // Load the worklet module
      // Use a relative path that works when bundled
      const workletUrl = new URL(
        './worklet/recording-processor.worklet.js',
        import.meta.url
      ).href;

      await context.audioWorklet.addModule(workletUrl);
      // @ts-ignore
      context._workletModuleLoaded = true;
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

      // Get or create dedicated AudioContext for recording
      const context = getAudioContext();

      // Resume AudioContext if suspended
      if (context.state === 'suspended') {
        await context.resume();
      }

      // Load worklet module
      await loadWorklet(context);

      // Create media stream source
      const source = context.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      // Create AudioWorklet node
      const workletNode = new AudioWorkletNode(context, 'recording-processor');
      workletNodeRef.current = workletNode;

      // Connect source to worklet (but not to destination - no monitoring)
      source.connect(workletNode);

      // Listen for audio data from worklet
      workletNode.port.onmessage = (event) => {
        const { samples } = event.data;

        // Accumulate samples
        recordedChunksRef.current.push(samples);
        totalSamplesRef.current += samples.length;

        // Update peaks incrementally
        setPeaks((prevPeaks) =>
          appendPeaks(
            prevPeaks,
            samples,
            samplesPerPixel,
            totalSamplesRef.current - samples.length
          )
        );
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
      setPeaks([]);
      setAudioBuffer(null);
      setIsRecording(true);
      setIsPaused(false);
      startTimeRef.current = performance.now();

      // Start duration update loop
      const updateDuration = () => {
        if (isRecording && !isPaused) {
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
  }, [stream, sampleRate, channelCount, samplesPerPixel, getAudioContext, loadWorklet, isRecording, isPaused]);

  // Stop recording
  const stopRecording = useCallback(async (): Promise<AudioBuffer | null> => {
    if (!isRecording) {
      return null;
    }

    try {
      // Stop the worklet
      if (workletNodeRef.current) {
        workletNodeRef.current.port.postMessage({ command: 'stop' });

        // Disconnect
        if (mediaStreamSourceRef.current) {
          mediaStreamSourceRef.current.disconnect();
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
      const context = audioContextRef.current || getAudioContext();
      const buffer = createAudioBuffer(
        context,
        allSamples,
        context.sampleRate,
        channelCount
      );

      setAudioBuffer(buffer);
      setDuration(buffer.duration);
      setIsRecording(false);
      setIsPaused(false);

      return buffer;
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setError(err instanceof Error ? err : new Error('Failed to stop recording'));
      return null;
    }
  }, [isRecording, sampleRate, channelCount, getAudioContext]);

  // Pause recording
  const pauseRecording = useCallback(() => {
    if (isRecording && !isPaused) {
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      setIsPaused(true);
    }
  }, [isRecording, isPaused]);

  // Resume recording
  const resumeRecording = useCallback(() => {
    if (isRecording && isPaused) {
      setIsPaused(false);
      startTimeRef.current = performance.now() - duration * 1000;

      const updateDuration = () => {
        if (isRecording && !isPaused) {
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
        workletNodeRef.current.disconnect();
      }
      if (mediaStreamSourceRef.current) {
        mediaStreamSourceRef.current.disconnect();
      }
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  return {
    isRecording,
    isPaused,
    duration,
    peaks,
    audioBuffer,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    error,
  };
}
