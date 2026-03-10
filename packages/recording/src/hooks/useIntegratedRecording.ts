/**
 * Hook for integrated multi-track recording
 * Combines recording functionality with track management
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRecording } from './useRecording';
import { useMicrophoneAccess } from './useMicrophoneAccess';
import { useMicrophoneLevel } from './useMicrophoneLevel';
import type { MicrophoneDevice } from '../types';
import { type ClipTrack, type AudioClip } from '@waveform-playlist/core';
import {
  resumeGlobalAudioContext,
  getGlobalAudioContext,
  getGlobalContext,
} from '@waveform-playlist/playout';

export interface IntegratedRecordingOptions {
  /**
   * Current playback/cursor position in seconds
   * Recording will start from max(currentTime, lastClipEndTime)
   */
  currentTime?: number;

  /**
   * MediaTrackConstraints for audio recording
   * These will override the recording-optimized defaults (echo cancellation off, low latency)
   */
  audioConstraints?: MediaTrackConstraints;

  /**
   * Number of channels to record (1 = mono, 2 = stereo)
   * Default: 1 (mono)
   */
  channelCount?: number;

  /**
   * Samples per pixel for peak generation
   * Default: 1024
   */
  samplesPerPixel?: number;
}

export interface UseIntegratedRecordingReturn {
  // Recording state
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  level: number;
  peakLevel: number;
  /** Per-channel peak levels (0-1). Array length matches channelCount. */
  levels: number[];
  /** Per-channel held peak levels (0-1). Array length matches channelCount. */
  peakLevels: number[];
  /** Per-channel RMS levels (0-1). Array length matches channelCount. */
  rmsLevels: number[];
  error: Error | null;

  // Microphone state
  stream: MediaStream | null;
  devices: MicrophoneDevice[];
  hasPermission: boolean;
  selectedDevice: string | null;

  // Recording controls
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  requestMicAccess: () => Promise<void>;
  changeDevice: (deviceId: string) => Promise<void>;

  // Track state (for live waveform during recording)
  recordingPeaks: (Int8Array | Int16Array)[];
}

export function useIntegratedRecording(
  tracks: ClipTrack[],
  setTracks: (tracks: ClipTrack[]) => void,
  selectedTrackId: string | null,
  options: IntegratedRecordingOptions = {}
): UseIntegratedRecordingReturn {
  const { currentTime = 0, audioConstraints, ...recordingOptions } = options;

  // Track if we're currently monitoring (for auto-resume audio context)
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);
  const [hookError, setHookError] = useState<Error | null>(null);

  // Capture timeline position when recording starts (not at stop time)
  const recordingStartTimeRef = useRef(0);

  // Keep selectedTrackId and currentTime in refs for use in callbacks.
  // Avoids stale closures and prevents 60fps useCallback recreation
  // (currentTime updates at animation-frame rate during playback).
  const selectedTrackIdRef = useRef(selectedTrackId);
  selectedTrackIdRef.current = selectedTrackId;
  const currentTimeRef = useRef(currentTime);
  currentTimeRef.current = currentTime;

  // Microphone access
  const { stream, devices, hasPermission, requestAccess, error: micError } = useMicrophoneAccess();

  // Microphone level (for VU meter)
  const {
    level,
    peakLevel,
    levels,
    peakLevels,
    rmsLevels,
    resetPeak,
    error: meterError,
  } = useMicrophoneLevel(stream, {
    channelCount: recordingOptions.channelCount,
  });

  // Recording
  const {
    isRecording,
    isPaused,
    duration,
    peaks,
    audioBuffer: _recordedAudioBuffer,
    startRecording: startRec,
    stopRecording: stopRec,
    pauseRecording,
    resumeRecording,
    error: recError,
  } = useRecording(stream, recordingOptions);

  // Start recording handler
  // Reads selectedTrackId from ref to avoid stale closures when
  // auto-create track + start recording happen in the same render cycle
  const startRecording = useCallback(async () => {
    if (!selectedTrackIdRef.current) {
      setHookError(
        new Error('Cannot start recording: no track selected. Select or create a track first.')
      );
      return;
    }

    try {
      setHookError(null);
      // Resume audio context if needed
      if (!isMonitoring) {
        await resumeGlobalAudioContext();
        setIsMonitoring(true);
      }

      // Capture timeline position NOW — before recording starts.
      // Using currentTime at stop time would be wrong during overdub
      // (playback advances currentTime while recording).
      recordingStartTimeRef.current = currentTimeRef.current;

      await startRec();
    } catch (err) {
      setHookError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [isMonitoring, startRec]);

  // Stop recording and add clip to selected track
  const stopRecording = useCallback(async () => {
    let buffer: AudioBuffer | null;
    try {
      buffer = await stopRec();
    } catch (err) {
      setHookError(err instanceof Error ? err : new Error(String(err)));
      return;
    }

    // Add clip to track after recording completes
    const trackId = selectedTrackIdRef.current;
    if (buffer && trackId) {
      const selectedTrackIndex = tracks.findIndex((t) => t.id === trackId);
      if (selectedTrackIndex === -1) {
        const err = new Error(
          `Recording completed but track "${trackId}" no longer exists. The recorded audio could not be saved.`
        );
        console.warn(`[waveform-playlist] ${err.message}`);
        setHookError(err);
        return;
      }

      const selectedTrack = tracks[selectedTrackIndex];

      // Use the captured start time (not live currentTime which advances during overdub)
      const recordStartTimeSamples = Math.floor(recordingStartTimeRef.current * buffer.sampleRate);

      let lastClipEndSample = 0;
      if (selectedTrack.clips.length > 0) {
        const endSamples = selectedTrack.clips.map(
          (clip) => clip.startSample + clip.durationSamples
        );
        lastClipEndSample = Math.max(...endSamples);
      }

      const startSample = Math.max(recordStartTimeSamples, lastClipEndSample);

      // Latency compensation:
      // Two sources of delay between recording start and audible playback:
      // 1. Tone.js lookAhead (~100ms) — Transport schedules audio ahead of real time
      // 2. Output latency — hardware DAC delay before audio reaches speakers
      // The user hears playback delayed by both, so they perform late relative
      // to the timeline. Skip that duration at the start of the recorded audio.
      const audioContext = getGlobalAudioContext();
      const outputLatency = audioContext.outputLatency ?? 0;
      const toneContext = getGlobalContext();
      const lookAhead = toneContext.lookAhead ?? 0;
      const totalLatency = outputLatency + lookAhead;
      const latencyOffsetSamples = Math.floor(totalLatency * buffer.sampleRate);

      // Guard: very short recordings (< latency compensation) would produce negative duration
      const effectiveDuration = Math.max(0, buffer.length - latencyOffsetSamples);
      if (effectiveDuration === 0) {
        console.warn(
          '[waveform-playlist] Recording too short for latency compensation — discarding'
        );
        setHookError(new Error('Recording was too short to save. Try recording for longer.'));
        return;
      }

      // Create new clip from recording
      const newClip: AudioClip = {
        id: `clip-${Date.now()}`,
        audioBuffer: buffer,
        startSample,
        durationSamples: effectiveDuration,
        offsetSamples: latencyOffsetSamples,
        sampleRate: buffer.sampleRate,
        sourceDurationSamples: buffer.length,
        gain: 1.0,
        name: `Recording ${new Date().toLocaleTimeString()}`,
      };

      // Add clip to track
      const newTracks = tracks.map((track, index) => {
        if (index === selectedTrackIndex) {
          return {
            ...track,
            clips: [...track.clips, newClip],
          };
        }
        return track;
      });

      setTracks(newTracks);
    }
  }, [tracks, setTracks, stopRec]);

  // Auto-select first device when available, or fallback if selected device was unplugged
  useEffect(() => {
    if (!hasPermission || devices.length === 0) return;

    if (selectedDevice === null) {
      // First-time selection
      setSelectedDevice(devices[0].deviceId);
    } else if (!devices.some((d) => d.deviceId === selectedDevice)) {
      // Selected device was removed — fall back to first available
      const fallbackId = devices[0].deviceId;
      setSelectedDevice(fallbackId);
      resetPeak();
      requestAccess(fallbackId, audioConstraints);
    }
  }, [hasPermission, devices, selectedDevice, resetPeak, requestAccess, audioConstraints]);

  // Request microphone access
  const requestMicAccess = useCallback(async () => {
    try {
      setHookError(null);
      await requestAccess(undefined, audioConstraints);
      await resumeGlobalAudioContext();
      setIsMonitoring(true);
    } catch (err) {
      setHookError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [requestAccess, audioConstraints]);

  // Change device
  const changeDevice = useCallback(
    async (deviceId: string) => {
      try {
        setHookError(null);
        setSelectedDevice(deviceId);
        resetPeak();
        await requestAccess(deviceId, audioConstraints);
        await resumeGlobalAudioContext();
        setIsMonitoring(true);
      } catch (err) {
        setHookError(err instanceof Error ? err : new Error(String(err)));
      }
    },
    [requestAccess, audioConstraints, resetPeak]
  );

  return {
    // Recording state
    isRecording,
    isPaused,
    duration,
    level,
    peakLevel,
    levels,
    peakLevels,
    rmsLevels,
    error: hookError || micError || meterError || recError,

    // Microphone state
    stream,
    devices,
    hasPermission,
    selectedDevice,

    // Recording controls
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    requestMicAccess,
    changeDevice,

    // Track state
    recordingPeaks: peaks,
  };
}
