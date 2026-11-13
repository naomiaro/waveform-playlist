// Export new flexible/headless API
export { WaveformPlaylistProvider } from './WaveformPlaylistContext';
export type { TrackState, ClipPeaks, TrackClipPeaks } from './WaveformPlaylistContext';

// Export MediaElement-based provider (single-track with playback rate control)
export { MediaElementPlaylistProvider } from './MediaElementPlaylistContext';
export type { MediaElementTrackConfig } from './MediaElementPlaylistContext';

// The context hooks (#688). Under either provider:
export {
  useIsPlaying,
  useCurrentTime,
  useSelection,
  useActiveAnnotation,
  useAnnotations,
  useAnnotationOptions,
  usePlaybackControls,
  usePlaybackRefs,
  usePlaylistView,
  usePlaylistSettings,
  usePlaylistZoom,
  // WaveformPlaylistProvider only:
  useEditorControls,
  useEngineRefs,
  usePlaylistTimeline,
  usePlaylistMixer,
  useTrackReorderPreview,
  useLoop,
  useSelectedTrackId,
  useUndoRedo,
  // MediaElementPlaylistProvider only:
  usePlaybackRate,
  useMediaElementTrack,
} from './contexts/playlistContexts';
export type {
  FrameData,
  IsPlayingContextValue,
  CurrentTimeContextValue,
  SelectionContextValue,
  ActiveAnnotationContextValue,
  AnnotationsContextValue,
  PlaybackControlsContextValue,
  PlaybackRefsContextValue,
  PlaylistViewContextValue,
  PlaylistSettingsContextValue,
  PlaylistZoomContextValue,
  EditorControlsContextValue,
  EngineRefsContextValue,
  AnnotationOptionsContextValue,
  PlaylistTimelineContextValue,
  PlaylistMixerContextValue,
  TrackReorderPreviewContextValue,
  LoopContextValue,
  SelectedTrackIdContextValue,
  UndoRedoContextValue,
  PlaybackRateContextValue,
  MediaElementTrackContextValue,
} from './contexts/playlistContexts';
export type { TrackDragPreview } from './utils/trackOrderPreview';
export type { AnnotationPreviewHandle } from './hooks';
export {
  useClipDragHandlers,
  useAnnotationDragHandlers,
  useAnnotationsWithPreview,
  useAnnotationKeyboardControls,
  useDragSensors,
  useClipSplitting,
  useKeyboardShortcuts,
  usePlaybackShortcuts,
  useZoomControls,
  useTimeFormat,
  useMasterVolume,
} from './hooks';
export type {
  UsePlaybackShortcutsOptions,
  UsePlaybackShortcutsReturn,
  ZoomControls,
  TimeFormatControls,
  MasterVolumeControls,
} from './hooks';

export {
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  SkipBackwardButton,
  SkipForwardButton,
  LoopButton,
  SetLoopRegionButton,
  ClearAllButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  TimeFormatSelect,
  PlaybackRateSelect,
  AudioPosition,
  SelectionTimeInputs,
  AutomaticScrollCheckbox,
  Waveform,
  WaveformEditor,
  MediaElementWaveform,
  AnnotationList,
  WaveformRoot,
  MediaElementWaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformClipHeaders,
  WaveformFades,
  WaveformRecordingPreview,
  WaveformAnnotationBoxes,
  WaveformViewOptions,
  WaveformSelection,
  WaveformPlayhead,
  KeyboardShortcuts,
  DefaultTrackControls,
  TrackName,
  TrackMuteButton,
  TrackSoloButton,
  TrackVolumeSlider,
  TrackPanSlider,
  TrackMenuButton,
  TrackReorderGrip,
  TrackRemoveButton,
  useTrack,
} from './components';
export type {
  DefaultTrackControlsProps,
  TrackContextValue,
  TrackRemoveButtonProps,
} from './components';
export { useTrackReorderHandle } from './hooks/useTrackReorderHandle';
export type { TrackReorderHandle } from './hooks/useTrackReorderHandle';
export type { KeyboardShortcutsProps } from './components/KeyboardShortcuts';
export type { ClearAllButtonProps } from './components/PlaybackControls';
export type { WaveformProps, WaveformEditorProps } from './components/Waveform';
export type { WaveformRootProps } from './components/WaveformRoot';
export type { MediaElementWaveformRootProps } from './components/MediaElementWaveformRoot';
export type { WaveformTimescaleProps } from './components/waveformParts';
export type { WaveformTracksProps, WaveformRecordingPreviewProps } from './components/TrackRows';
export type { WaveformTrackControlsProps } from './components/TrackControlsColumn';
export type { WaveformPlayheadProps } from './components/VisualizationOverlays';
export type { WaveformAnnotationBoxesProps } from './components/WaveformAnnotationBoxes';
export type { WaveformViewOptionsProps } from './components/WaveformViewOptions';
export type { WaveformRecordingState } from './components/visualizationLayout';
export { useRecordingSession } from './hooks/useRecordingSession';
export type { RecordingSessionOptions } from './hooks/useRecordingSession';
export type { MediaElementWaveformProps } from './components/MediaElementWaveform';
export type { AnnotationListProps } from './components/AnnotationList';
export type { AnnotationListProp } from './providerInternals/useAnnotationState';

// Export annotation callback types for Waveform components
export type { GetAnnotationBoxLabelFn } from './types/annotations';

// Annotation integration context (for optional annotation support)
export {
  AnnotationIntegrationProvider,
  useAnnotationIntegration,
} from './AnnotationIntegrationContext';
export type { AnnotationIntegration } from './AnnotationIntegrationContext';

// Spectrogram integration context (for optional spectrogram support)
export {
  SpectrogramIntegrationProvider,
  useSpectrogramIntegration,
} from './SpectrogramIntegrationContext';
export type { SpectrogramIntegration } from './SpectrogramIntegrationContext';

// Export ClipInteractionProvider for encapsulated drag/trim/snap/collision setup
export { ClipInteractionProvider } from './components/ClipInteractionProvider';
export type { ClipInteractionProviderProps } from './components/ClipInteractionProvider';
export {
  ClipInteractionOptions,
  useClipInteractionEnabled,
} from './contexts/ClipInteractionContext';
export type { ClipInteractionOptionsProps } from './contexts/ClipInteractionContext';

// Export modifiers and plugins for drag-and-drop
export { ClipCollisionModifier } from './modifiers/ClipCollisionModifier';
export { SnapToGridModifier } from './modifiers/SnapToGridModifier';

// Export waveform-data.js utilities
export {
  loadWaveformData,
  waveformDataToPeaks,
  loadPeaksFromWaveformData,
  getWaveformDataMetadata,
} from './waveformDataLoader';
