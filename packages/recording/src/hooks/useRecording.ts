/**
 * Main recording hook using AudioWorklet
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { UseRecordingReturn, RecordingOptions } from '../types';
import { concatenateAudioData, createAudioBuffer } from '../utils/audioBufferUtils';
import { appendPeaks } from '../utils/peaksGenerator';
import { getContext } from 'tone';

function emptyPeaks(bits: 8 | 16): Int8Array | Int16Array {
  return bits === 8 ? new Int8Array(0) : new Int16Array(0);
}

export function useRecording(
  stream: MediaStream | null,
  options: RecordingOptions = {}
): UseRecordingReturn {
  const { channelCount = 1, samplesPerPixel = 1024, bits = 16 } = options;

  // State
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [duration, setDuration] = useState(0);
  // Per-channel peaks for multi-channel live preview
  const [peaks, setPeaks] = useState<(Int8Array | Int16Array)[]>([emptyPeaks(bits)]);
  const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [level, setLevel] = useState(0); // Current RMS level (0-1)
  const [peakLevel, setPeakLevel] = useState(0); // Peak level since recording started (0-1)

  // Global flag to prevent loading worklet multiple times
  // (AudioWorklet processors can only be registered once per AudioContext)
  const workletLoadedRef = useRef<boolean>(false);

  // Refs for AudioWorklet and data accumulation
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  // Per-channel sample accumulation: recordedChunksRef[channelIndex] = Float32Array[]
  const recordedChunksRef = useRef<Float32Array[][]>([]);
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
      const workletUrl = new URL('./worklet/recording-processor.worklet.js', import.meta.url).href;

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

      // Detect actual channel count from the stream's audio track settings.
      // Falls back to the user-provided channelCount option.
      const detectedChannelCount = stream.getAudioTracks()[0]?.getSettings().channelCount;
      if (detectedChannelCount === undefined) {
        console.warn(
          `[waveform-playlist] Could not detect stream channel count, using fallback: ${channelCount}`
        );
      }
      const streamChannelCount = detectedChannelCount ?? channelCount;

      // Create MediaStreamSource from Tone's context
      // Each hook creates its own source to avoid cross-context issues in Firefox
      const source = context.createMediaStreamSource(stream);
      mediaStreamSourceRef.current = source;

      // Create AudioWorklet node — set channelCount to match the stream
      const workletNode = context.createAudioWorkletNode('recording-processor', {
        channelCount: streamChannelCount,
        channelCountMode: 'explicit',
      });
      workletNodeRef.current = workletNode;

      // Reset state before connecting — prevents race where a worklet message
      // arrives before refs are cleared, corrupting samplesProcessedBefore calculations
      recordedChunksRef.current = Array.from({ length: streamChannelCount }, () => []);
      totalSamplesRef.current = 0;
      setPeaks(Array.from({ length: streamChannelCount }, () => emptyPeaks(bits)));
      setAudioBuffer(null);
      setLevel(0);
      setPeakLevel(0);

      // Listen for audio data from worklet
      workletNode.port.onmessage = (event: MessageEvent) => {
        const { channels } = event.data as { channels: Float32Array[] };

        if (!channels || channels.length === 0) {
          console.warn('[waveform-playlist] Recording worklet sent empty or missing channels data');
          return;
        }

        // Accumulate per-channel samples
        for (let ch = 0; ch < channels.length; ch++) {
          if (!recordedChunksRef.current[ch]) {
            console.warn(
              `[waveform-playlist] Unexpected channel ${ch} from worklet (expected ${recordedChunksRef.current.length})`
            );
            recordedChunksRef.current[ch] = [];
          }
          recordedChunksRef.current[ch].push(channels[ch]);
        }
        // Capture sample offset before incrementing — used by peak alignment
        const samplesProcessedBefore = totalSamplesRef.current;
        totalSamplesRef.current += channels[0].length;
        setPeaks((prevPeaks) => {
          // Ensure we have an entry per channel
          const updated: (Int8Array | Int16Array)[] = [];
          for (let ch = 0; ch < channels.length; ch++) {
            const prev = prevPeaks[ch] ?? emptyPeaks(bits);
            updated.push(
              appendPeaks(prev, channels[ch], samplesPerPixel, samplesProcessedBefore, bits)
            );
          }
          return updated;
        });

        // Note: VU meter levels come from useMicrophoneLevel (AnalyserNode)
        // We don't update level/peakLevel here to avoid conflicting state updates
      };

      // Connect and start — after state reset and handler setup
      source.connect(workletNode);
      workletNode.port.postMessage({
        command: 'start',
        sampleRate: context.sampleRate,
        channelCount: streamChannelCount,
      });
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
  }, [stream, channelCount, samplesPerPixel, bits, loadWorklet]);

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
          } catch (err) {
            console.warn('[waveform-playlist] Source disconnect during stop:', String(err));
          }
        }
        workletNodeRef.current.disconnect();
      }

      // Cancel animation frame
      if (animationFrameRef.current !== null) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }

      // Create final AudioBuffer from accumulated per-channel chunks
      const context = getContext();
      const rawContext = context.rawContext as AudioContext;
      const numChannels = recordedChunksRef.current.length || channelCount;
      const channelData = recordedChunksRef.current.map((chunks) => concatenateAudioData(chunks));
      const buffer = createAudioBuffer(rawContext, channelData, rawContext.sampleRate, numChannels);

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
          } catch (err) {
            console.warn('[waveform-playlist] Source disconnect during cleanup:', String(err));
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
