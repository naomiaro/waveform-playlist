/**
 * Hook for integrated multi-track recording
 * Combines recording functionality with track management
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import { useRecording } from './useRecording';
import { useMicrophoneAccess } from './useMicrophoneAccess';
import { useMicrophoneLevel } from './useMicrophoneLevel';
import type { MicrophoneDevice } from '../types';
import {
  type ClipTrack,
  type AudioClip,
  carveClipRange,
  resolveRecordingOffsetSamples,
} from '@waveform-playlist/core';
import {
  resumeGlobalAudioContext,
  getGlobalAudioContext,
  getGlobalContext,
} from '@waveform-playlist/playout';

export interface IntegratedRecordingOptions {
  /**
   * Current playback/cursor position in seconds.
   * Punch-in semantics (#579): the recorded clip lands exactly at this
   * position and REPLACES any existing clip content it overlaps — partial
   * overlaps are trimmed, fully-covered clips removed, spanning clips split.
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

  /**
   * Latency offset to skip at the start of the recording, in **seconds**.
   * Absolute replacement for the auto-computed `outputLatency + lookAhead` value
   * — use this to apply an externally-measured round-trip latency. `0` disables
   * compensation; when omitted, the auto-computed value is used. Pass the same
   * value into the provider's `recordingState.latencyOffset` so the live preview
   * matches the finalized clip. Negative or non-finite values are treated as 0.
   */
  latencyOffset?: number;
}

export interface UseIntegratedRecordingReturn {
  // Recording state
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  level: number;
  peakLevel: number;
  /**
   * Per-channel peak levels (0-1). Array length matches the metered channel
   * count (auto-detected mic channels; mono mirrored up to channelCount —
   * see UseMicrophoneLevelReturn.levels).
   */
  levels: number[];
  /** Per-channel held peak levels (0-1). Same length contract as `levels`. */
  peakLevels: number[];
  /** Per-channel RMS levels (0-1). Same length contract as `levels`. */
  rmsLevels: number[];
  error: Error | null;

  // Microphone state
  stream: MediaStream | null;
  devices: MicrophoneDevice[];
  hasPermission: boolean;
  selectedDevice: string | null;

  // Recording controls
  /** Start capturing on the selected track. Resolves `true` when the capture
   *  pipeline actually started — callers that synchronize playback with
   *  recording (overdub) should check this before starting playback. */
  startRecording: () => Promise<boolean>;
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
  const { currentTime = 0, audioConstraints, latencyOffset, ...recordingOptions } = options;

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
  // Latest tracks for reads that happen AFTER an await — the stop handshake
  // can take >1s, and finalizing against a closure capture would discard any
  // track edits that landed in that window.
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

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
  const startRecording = useCallback(async (): Promise<boolean> => {
    if (!selectedTrackIdRef.current) {
      setHookError(
        new Error('Cannot start recording: no track selected. Select or create a track first.')
      );
      return false;
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

      return await startRec();
    } catch (err) {
      setHookError(err instanceof Error ? err : new Error(String(err)));
      return false;
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

    // Add clip to track after recording completes. Read tracks through the
    // ref — the awaited stop handshake above can span >1s, and the closure's
    // tracks capture would silently revert concurrent edits.
    const trackId = selectedTrackIdRef.current;
    const currentTracks = tracksRef.current;
    if (buffer && trackId) {
      const selectedTrackIndex = currentTracks.findIndex((t) => t.id === trackId);
      if (selectedTrackIndex === -1) {
        const err = new Error(
          `Recording completed but track "${trackId}" no longer exists. The recorded audio could not be saved.`
        );
        console.warn(`[waveform-playlist] ${err.message}`);
        setHookError(err);
        return;
      }

      // Use the captured start time (not live currentTime which advances during overdub).
      // Punch-in replace (#579): the take lands exactly here; overlapped
      // content is carved out below when the clip list is assembled.
      const startSample = Math.floor(recordingStartTimeRef.current * buffer.sampleRate);

      // Latency compensation: an explicit latencyOffset (seconds) replaces the
      // auto-computed outputLatency + lookAhead window. Shared resolver with the
      // live preview in PlaylistVisualization — keep both using the same value so
      // trim widths match.
      const audioContext = getGlobalAudioContext();
      const outputLatency = audioContext.outputLatency ?? 0;
      const toneContext = getGlobalContext();
      const lookAhead = toneContext.lookAhead ?? 0;
      const latencyOffsetSamples = resolveRecordingOffsetSamples({
        overrideSeconds: latencyOffset,
        outputLatency,
        lookAhead,
        sampleRate: buffer.sampleRate,
      });

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

      // Add clip to track — the recorded clip owns [startSample,
      // startSample + effectiveDuration): trim/remove/split whatever it overlaps.
      const newTracks = currentTracks.map((track, index) => {
        if (index === selectedTrackIndex) {
          return {
            ...track,
            clips: [
              ...carveClipRange(track.clips, startSample, startSample + effectiveDuration),
              newClip,
            ],
          };
        }
        return track;
      });

      setTracks(newTracks);
    }
  }, [setTracks, stopRec, latencyOffset]);

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

  // Mirror isRecording for the device-switch guards below — reading the
  // state directly would churn the callbacks every recording toggle.
  const isRecordingRef = useRef(isRecording);
  isRecordingRef.current = isRecording;

  // Request microphone access
  const requestMicAccess = useCallback(async () => {
    // requestAccess stops the current stream's tracks, and track.stop() fires
    // no 'ended' event — the recording's source is never rewired, so the rest
    // of the take silently records silence. Refuse while recording.
    if (isRecordingRef.current) {
      setHookError(new Error('Cannot request microphone access while recording. Stop first.'));
      return;
    }
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
      // Same silent-silence hazard as requestMicAccess above.
      if (isRecordingRef.current) {
        setHookError(new Error('Cannot switch microphone while recording. Stop first.'));
        return;
      }
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
