/**
 * @waveform-playlist/recording
 *
 * Audio recording support using AudioWorklet for waveform-playlist
 */

// Hooks
export {
  useRecording,
  useMicrophoneAccess,
  useMicrophoneLevel,
  useIntegratedRecording,
} from './hooks';
export type {
  UseMicrophoneLevelOptions,
  UseMicrophoneLevelReturn,
  UseIntegratedRecordingReturn,
  IntegratedRecordingOptions,
} from './hooks';

// Types
export type {
  RecordingState,
  RecordingData,
  MicrophoneDevice,
  RecordingOptions,
  UseRecordingReturn,
  UseMicrophoneAccessReturn,
} from './types';
