/**
 * Hook for integrated multi-track recording
 * Combines recording functionality with track management
 */

import { useState, useCallback, useEffect } from 'react';
import { useRecording } from './useRecording';
import { useMicrophoneAccess } from './useMicrophoneAccess';
import { useMicrophoneLevel } from './useMicrophoneLevel';
import type { MicrophoneDevice } from '../types';
import { type ClipTrack, type AudioClip } from '@waveform-playlist/core';
import { resumeGlobalAudioContext } from '@waveform-playlist/playout';

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
  recordingPeaks: Int8Array | Int16Array;
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

  // Microphone access
  const {
    stream,
    devices,
    hasPermission,
    requestAccess,
    error: micError,
  } = useMicrophoneAccess();

  // Microphone level (for VU meter)
  const { level, peakLevel } = useMicrophoneLevel(stream);

  // Recording
  const {
    isRecording,
    isPaused,
    duration,
    peaks,
    audioBuffer: _audioBuffer,
    startRecording: startRec,
    stopRecording: stopRec,
    pauseRecording,
    resumeRecording,
    error: recError,
  } = useRecording(stream, recordingOptions);

  // Start recording handler
  const startRecording = useCallback(async () => {
    if (!selectedTrackId) {
      setHookError(new Error('Cannot start recording: no track selected. Select or create a track first.'));
      return;
    }

    try {
      setHookError(null);
      // Resume audio context if needed
      if (!isMonitoring) {
        await resumeGlobalAudioContext();
        setIsMonitoring(true);
      }

      await startRec();
    } catch (err) {
      setHookError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [selectedTrackId, isMonitoring, startRec]);

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
    if (buffer && selectedTrackId) {
      const selectedTrackIndex = tracks.findIndex(t => t.id === selectedTrackId);
      if (selectedTrackIndex === -1) {
        const err = new Error(
          `Recording completed but track "${selectedTrackId}" no longer exists. The recorded audio could not be saved.`
        );
        console.error(`[waveform-playlist] ${err.message}`);
        setHookError(err);
        return;
      }

      const selectedTrack = tracks[selectedTrackIndex];

      // Calculate start position: max(currentTime, lastClipEndTime)
      const currentTimeSamples = Math.floor(currentTime * buffer.sampleRate);

      let lastClipEndSample = 0;
      if (selectedTrack.clips.length > 0) {
        // Find the end time of the last clip (in samples)
        const endSamples = selectedTrack.clips.map(clip =>
          clip.startSample + clip.durationSamples
        );
        lastClipEndSample = Math.max(...endSamples);
      }

      // Use whichever is greater: cursor position or last clip end
      const startSample = Math.max(currentTimeSamples, lastClipEndSample);

      // Create new clip from recording
      const newClip: AudioClip = {
        id: `clip-${Date.now()}`,
        audioBuffer: buffer,
        startSample,
        durationSamples: buffer.length,
        offsetSamples: 0,
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
  }, [selectedTrackId, tracks, setTracks, currentTime, stopRec]);

  // Auto-select the first device when devices become available
  useEffect(() => {
    // Only auto-select if we have permission, devices are available, and nothing is selected yet
    if (hasPermission && devices.length > 0 && selectedDevice === null) {
      setSelectedDevice(devices[0].deviceId);
    }
  }, [hasPermission, devices.length]); // Intentionally not including selectedDevice to avoid re-triggering

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
  const changeDevice = useCallback(async (deviceId: string) => {
    try {
      setHookError(null);
      setSelectedDevice(deviceId);
      await requestAccess(deviceId, audioConstraints);
      await resumeGlobalAudioContext();
      setIsMonitoring(true);
    } catch (err) {
      setHookError(err instanceof Error ? err : new Error(String(err)));
    }
  }, [requestAccess, audioConstraints]);

  return {
    // Recording state
    isRecording,
    isPaused,
    duration,
    level,
    peakLevel,
    error: hookError || micError || recError,

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
