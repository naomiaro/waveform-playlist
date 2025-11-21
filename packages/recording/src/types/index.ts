/**
 * Types for the recording package
 */

export interface RecordingState {
  isRecording: boolean;
  isPaused: boolean;
  duration: number; // Duration in seconds
  sampleRate: number;
}

export interface RecordingData {
  buffer: AudioBuffer | null;
  peaks: number[];
  duration: number;
}

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface RecordingOptions {
  /**
   * Sample rate for recording (defaults to AudioContext sample rate)
   */
  sampleRate?: number;

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
   * Specific device ID to use for recording
   */
  deviceId?: string;
}

export interface UseRecordingReturn {
  // State
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  peaks: number[];
  audioBuffer: AudioBuffer | null;

  // Controls
  startRecording: () => Promise<void>;
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
  requestAccess: (deviceId?: string) => Promise<void>;
  stopStream: () => void;

  // Error handling
  error: Error | null;
}
