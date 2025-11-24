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
  peaks: Int8Array | Int16Array;
  duration: number;
}

export interface MicrophoneDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export interface RecordingOptions {
  /**
   * Number of channels to record (1 = mono, 2 = stereo)
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
  duration: number;
  peaks: Int8Array | Int16Array;
  audioBuffer: AudioBuffer | null;
  level: number; // Current RMS level (0-1)
  peakLevel: number; // Peak RMS level since recording started (0-1)

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
  requestAccess: (deviceId?: string, audioConstraints?: MediaTrackConstraints) => Promise<void>;
  stopStream: () => void;

  // Error handling
  error: Error | null;
}
