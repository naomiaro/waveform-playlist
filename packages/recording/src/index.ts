/**
 * @waveform-playlist/recording
 *
 * Audio recording support using AudioWorklet for waveform-playlist
 */

// Hooks
export { useRecording, useMicrophoneAccess, useMicrophoneLevel } from './hooks';
export type {
  UseMicrophoneLevelOptions,
  UseMicrophoneLevelReturn,
} from './hooks';

// Components
export { RecordButton, MicrophoneSelector, RecordingIndicator, VUMeter } from './components';
export type {
  RecordButtonProps,
  MicrophoneSelectorProps,
  RecordingIndicatorProps,
  VUMeterProps,
} from './components';

// Types
export type {
  RecordingState,
  RecordingData,
  MicrophoneDevice,
  RecordingOptions,
  UseRecordingReturn,
  UseMicrophoneAccessReturn,
} from './types';

// Utilities
export { generatePeaks } from './utils/peaksGenerator';
export { createAudioBuffer, concatenateAudioData } from './utils/audioBufferUtils';
