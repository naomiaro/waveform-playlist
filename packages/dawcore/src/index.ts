import './elements/daw-clip';
import './elements/daw-track';
import './elements/daw-waveform';
import './elements/daw-playhead';
import './elements/daw-transport';
import './elements/daw-play-button';
import './elements/daw-pause-button';
import './elements/daw-stop-button';
import './elements/daw-editor';
import './elements/daw-ruler';
import './elements/daw-selection';
import './elements/daw-track-controls';
import './elements/daw-record-button';

export { DawClipElement } from './elements/daw-clip';
export { DawTrackElement } from './elements/daw-track';
export { DawWaveformElement } from './elements/daw-waveform';
export { DawPlayheadElement } from './elements/daw-playhead';
export { DawTransportElement } from './elements/daw-transport';
export { DawTransportButton } from './elements/daw-transport-button';
export { DawPlayButtonElement } from './elements/daw-play-button';
export { DawPauseButtonElement } from './elements/daw-pause-button';
export { DawStopButtonElement } from './elements/daw-stop-button';
export { DawEditorElement } from './elements/daw-editor';
export { DawRulerElement } from './elements/daw-ruler';
export { DawSelectionElement } from './elements/daw-selection';
export { DawTrackControlsElement } from './elements/daw-track-controls';
export { DawRecordButtonElement } from './elements/daw-record-button';

export { AudioResumeController } from './controllers/audio-resume-controller';
export { RecordingController } from './controllers/recording-controller';
export type { RecordingOptions, RecordingSession } from './controllers/recording-controller';

export type { TrackDescriptor, ClipDescriptor } from './types';
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
  DawClipMoveDetail,
  DawClipTrimDetail,
  DawClipSplitDetail,
  LoadFilesResult,
} from './events';
