export * from './PlaybackControls';
export * from './ZoomControls';
export * from './ContextualControls';
export * from './AnnotationControls';
export * from './Waveform';
export * from './MediaElementWaveform';
export { WaveformRoot } from './WaveformRoot';
export type { WaveformRootProps } from './WaveformRoot';
export { MediaElementWaveformRoot } from './MediaElementWaveformRoot';
export type { MediaElementWaveformRootProps } from './MediaElementWaveformRoot';
export {
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformClipHeaders,
  WaveformFades,
  WaveformRecordingPreview,
  WaveformSelection,
  WaveformPlayhead,
} from './waveformParts';
export { WaveformAnnotationBoxes } from './WaveformAnnotationBoxes';
export { WaveformViewOptions } from './WaveformViewOptions';
export { AnnotationList } from './AnnotationList';
export { KeyboardShortcuts } from './KeyboardShortcuts';
export type { KeyboardShortcutsProps } from './KeyboardShortcuts';
// The control panel of a track: the default one and the pieces it is made of (#687).
export { DefaultTrackControls } from './DefaultTrackControls';
export type { DefaultTrackControlsProps } from './DefaultTrackControls';
export {
  TrackName,
  TrackMuteButton,
  TrackSoloButton,
  TrackVolumeSlider,
  TrackPanSlider,
  TrackMenuButton,
  TrackReorderGrip,
  TrackRemoveButton,
} from './TrackControlPieces';
export type { TrackRemoveButtonProps } from './TrackControlPieces';
export { useTrack } from './trackContext';
export type { TrackContextValue } from './trackContext';

// Re-export WaveformPlaylistProvider and types from context
export { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
