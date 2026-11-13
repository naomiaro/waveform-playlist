/**
 * Types for the recording package
 */

import type { RecordingProgressSource } from '@waveform-playlist/core';

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // Duration in seconds
  sampleRate: number;
}

export interface RecordingData {
  buffer: AudioBuffer | null;
  peaks: (Int8Array | Int16Array)[];
  duration: number;
}

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface RecordingOptions {
  /**
   * Number of channels to record (1 = mono, 2 = stereo).
   * The actual channel count is auto-detected from the microphone stream;
   * this value is used as a fallback if the stream doesn't report its channel count.
   * Default: 1 (mono)
   * Note: Sample rate is determined by the global AudioContext
   */
  channelCount?: number;

  /**
   * Samples per pixel for peak generation
   * Default: 1024
   */
  samplesPerPixel?: number;

  /**
   * Bit depth for peak values (8 or 16)
   * Default: 16
   */
  bits?: 8 | 16;

  /**
   * Specific device ID to use for recording
   */
  deviceId?: string;

  /**
   * MediaTrackConstraints for audio recording
   * Use this to customize echo cancellation, noise suppression, auto gain control, latency, etc.
   * Default: Recording-optimized settings (all processing disabled, latency: 0 for low latency)
   */
  audioConstraints?: MediaTrackConstraints;
}

export interface UseRecordingReturn {
  // State
  isRecording: boolean;
  isPaused: boolean;
  /**
   * Elapsed time and live-preview peaks of the take. Its identity is stable
   * for the life of the hook, and the hook does NOT re-render as they change
   * (once per animation frame while recording). Pass it to
   * `<WaveformRecordingPreview recordingState={{ …, progress }} />`, call
   * `progress.subscribe()`, or use `useRecordingProgress(progress)` for
   * throttled React state. After a stop, `duration` is the recorded buffer's
   * length; the next start resets both.
   */
  progress: RecordingProgressSource;
  audioBuffer: AudioBuffer | null;

  // Controls
  /** Start capturing. Resolves `true` when the capture pipeline actually
   *  started, `false` when it could not (no stream, already recording,
   *  worklet/module failure, unmounted). Callers that synchronize playback
   *  with recording should check the result before starting playback. */
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<AudioBuffer | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;

  // Error handling
  error: Error | null;
}

export interface UseMicrophoneAccessReturn {
  // State
  stream: MediaStream | null;
  devices: MicrophoneDevice[];
  hasPermission: boolean;
  isLoading: boolean;

  // Controls
  requestAccess: (deviceId?: string, audioConstraints?: MediaTrackConstraints) => Promise<void>;
  stopStream: () => void;

  // Error handling
  error: Error | null;
}
