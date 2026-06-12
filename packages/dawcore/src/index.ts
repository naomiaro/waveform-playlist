import './elements/daw-clip';
import './elements/daw-track';
import './elements/daw-waveform';
import './elements/daw-piano-roll';
import './elements/daw-playhead';
import './elements/daw-transport';
import './elements/daw-play-button';
import './elements/daw-pause-button';
import './elements/daw-stop-button';
import './elements/daw-editor';
import './elements/daw-ruler';
import './elements/daw-grid';
import './elements/daw-selection';
import './elements/daw-track-controls';
import './elements/daw-record-button';
import './elements/daw-keyboard-shortcuts';
import './elements/daw-spectrogram';
import './elements/daw-time-display';
import './elements/daw-time-format';

export { DawClipElement } from './elements/daw-clip';
export { DawTrackElement } from './elements/daw-track';
export { DawWaveformElement } from './elements/daw-waveform';
export type { WaveformSegment } from './elements/daw-waveform';
export { DawPianoRollElement } from './elements/daw-piano-roll';
export { DawPlayheadElement } from './elements/daw-playhead';
export { DawTransportElement } from './elements/daw-transport';
export { DawTransportButton } from './elements/daw-transport-button';
export { DawPlayButtonElement } from './elements/daw-play-button';
export { DawPauseButtonElement } from './elements/daw-pause-button';
export { DawStopButtonElement } from './elements/daw-stop-button';
export { DawEditorElement } from './elements/daw-editor';
export { DawRulerElement } from './elements/daw-ruler';
export { DawGridElement } from './elements/daw-grid';
export { DawSelectionElement } from './elements/daw-selection';
export { DawTrackControlsElement } from './elements/daw-track-controls';
export { DawRecordButtonElement } from './elements/daw-record-button';
export { DawKeyboardShortcutsElement } from './elements/daw-keyboard-shortcuts';
export { DawSpectrogramElement } from './elements/daw-spectrogram';
export { DawTimeDisplayElement } from './elements/daw-time-display';
export { DawTimeFormatElement } from './elements/daw-time-format';
export { SpectrogramController } from './controllers/spectrogram-controller';
export type {
  KeyBinding,
  PlaybackShortcutMap,
  SplittingShortcutMap,
  UndoShortcutMap,
} from './elements/daw-keyboard-shortcuts';

export { AudioResumeController } from './controllers/audio-resume-controller';
export { RecordingController } from './controllers/recording-controller';
export type { RecordingOptions, RecordingSession } from './controllers/recording-controller';
export { PlaybackAnimationController } from './controllers/playback-animation-controller';
export type {
  PlayheadLike,
  PlaybackAnimationOptions,
} from './controllers/playback-animation-controller';
export {
  TIME_DISPLAY_FORMATS,
  isTimeDisplayFormat,
  formatDisplayTime,
  parseDisplayTime,
} from './utils/time-display-format';
export type { TimeDisplayFormat } from './utils/time-display-format';
export {
  resolveTransportTarget,
  targetSupports,
  warnOnce,
  warnUnsupportedOnce,
} from './utils/transport-capability';

export type {
  TrackDescriptor,
  ClipDescriptor,
  DomClipDescriptor,
  DropClipDescriptor,
  TrackRenderMode,
  TrackConfig,
  ClipConfig,
} from './types';
export { isDomClip } from './types';
export type { PointerEngineContract } from './interactions/pointer-handler';
export { ClipPointerHandler } from './interactions/clip-pointer-handler';
export type { ClipPointerHost, ClipEngineContract } from './interactions/clip-pointer-handler';
export { splitAtPlayhead } from './interactions/split-handler';
export type { SplitHost, SplitEngineContract } from './interactions/split-handler';

export type {
  DawEventMap,
  DawEvent,
  DawSelectionDetail,
  DawSeekDetail,
  DawTrackSelectDetail,
  DawTrackConnectedDetail,
  DawTrackIdDetail,
  DawTrackErrorDetail,
  DawFilesLoadErrorDetail,
  DawErrorDetail,
  DawTrackControlDetail,
  DawTrackRemoveDetail,
  DawRecordingStartDetail,
  DawRecordingCompleteDetail,
  DawRecordingErrorDetail,
  DawClipConnectedDetail,
  DawClipUpdateDetail,
  DawClipIdDetail,
  DawClipErrorDetail,
  DawClipMoveDetail,
  DawClipTrimDetail,
  DawClipSplitDetail,
  DawEffectAddDetail,
  DawEffectRemoveDetail,
  DawEffectChangeDetail,
  DawEffectBypassDetail,
  DawEffectReorderDetail,
  DawEffectErrorDetail,
  DawTimeUpdateDetail,
  DawTimeFormatChangeDetail,
  LoadFilesResult,
} from './events';

// Effects (chain core — element APIs land in #418)
export {
  registerEffect,
  getEffectDefinitions,
  createEffectInstance,
} from './effects/effect-registry';
export type {
  EffectDefinition,
  EffectParamDef,
  EffectInstance,
  EffectState,
  SerializedEffectEntry,
} from './effects/types';
export type { ExportOptions, ExportAudioHost } from './interactions/export-audio';
