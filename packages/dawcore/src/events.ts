import type { DawTrackElement } from './elements/daw-track';
import type { DawClipElement } from './elements/daw-clip';

// ---------------------------------------------------------------------------
// Event detail types
// ---------------------------------------------------------------------------

export interface DawSelectionDetail {
  start: number;
  end: number;
}

export interface DawSeekDetail {
  time: number;
}

export interface DawTrackSelectDetail {
  trackId: string;
}

export interface DawTrackConnectedDetail {
  trackId: string;
  element: DawTrackElement;
}

export interface DawTrackIdDetail {
  trackId: string;
}

export interface DawTrackErrorDetail {
  trackId: string;
  error: unknown;
}

export interface DawFilesLoadErrorDetail {
  file: File;
  error: unknown;
}

export interface DawErrorDetail {
  operation: string;
  error: unknown;
}

export interface DawTrackControlDetail {
  trackId: string;
  prop: string;
  value: number | boolean;
}

export interface DawTrackRemoveDetail {
  trackId: string;
}

export interface DawRecordingStartDetail {
  trackId: string;
  stream: MediaStream;
}

export interface DawRecordingCompleteDetail {
  trackId: string;
  audioBuffer: AudioBuffer;
  startSample: number;
  durationSamples: number;
  offsetSamples: number;
}

export interface DawRecordingErrorDetail {
  trackId: string;
  error: unknown;
}

export interface DawRecordingPauseDetail {
  trackId: string;
}

export interface DawRecordingResumeDetail {
  trackId: string;
}

export interface DawClipConnectedDetail {
  clipId: string;
  element: DawClipElement;
}

export interface DawClipIdDetail {
  trackId: string;
  clipId: string;
}

export interface DawClipUpdateDetail {
  trackId: string;
  clipId: string;
}

export interface DawClipErrorDetail {
  trackId: string;
  clipId: string;
  error: unknown;
}

export interface DawClipMoveDetail {
  readonly trackId: string;
  readonly clipId: string;
  /** Requested cumulative delta. May exceed actual applied movement due to
   *  collision constraints. Query engine state for actual clip positions. */
  readonly deltaSamples: number;
}

export interface DawClipTrimDetail {
  readonly trackId: string;
  readonly clipId: string;
  readonly boundary: 'left' | 'right';
  /** Constrained cumulative delta applied by the engine. Already clamped
   *  by collision and boundary constraints during drag. */
  readonly deltaSamples: number;
}

export interface DawClipSplitDetail {
  readonly trackId: string;
  readonly originalClipId: string;
  readonly leftClipId: string;
  readonly rightClipId: string;
}

export interface DawSpectrogramReadyDetail {
  trackId: string;
  generation: number;
}

export interface DawSpectrogramErrorDetail {
  trackId: string;
  generation: number;
  error: Error;
}

export interface DawEffectAddDetail {
  effectId: string;
  kind: string;
  type: string;
  params: Record<string, number>;
  index: number;
  /** Plugin source URL (kind 'wam'). */
  url?: string;
}

export interface DawEffectRemoveDetail {
  effectId: string;
}

export interface DawEffectChangeDetail {
  effectId: string;
  params: Record<string, number>;
}

export interface DawEffectBypassDetail {
  effectId: string;
  bypassed: boolean;
}

export interface DawEffectReorderDetail {
  effectId: string;
  fromIndex: number;
  toIndex: number;
}

// ---------------------------------------------------------------------------
// Event map — augments HTMLElementEventMap for typed addEventListener
// ---------------------------------------------------------------------------

export interface DawEventMap {
  'daw-selection': CustomEvent<DawSelectionDetail>;
  'daw-seek': CustomEvent<DawSeekDetail>;
  'daw-track-select': CustomEvent<DawTrackSelectDetail>;
  'daw-track-connected': CustomEvent<DawTrackConnectedDetail>;
  'daw-track-update': CustomEvent<DawTrackIdDetail>;
  'daw-track-ready': CustomEvent<DawTrackIdDetail>;
  'daw-track-error': CustomEvent<DawTrackErrorDetail>;
  'daw-files-load-error': CustomEvent<DawFilesLoadErrorDetail>;
  'daw-play': CustomEvent<void>;
  'daw-pause': CustomEvent<void>;
  'daw-stop': CustomEvent<void>;
  'daw-error': CustomEvent<DawErrorDetail>;
  'daw-track-control': CustomEvent<DawTrackControlDetail>;
  'daw-track-remove': CustomEvent<DawTrackRemoveDetail>;
  'daw-recording-start': CustomEvent<DawRecordingStartDetail>;
  'daw-recording-complete': CustomEvent<DawRecordingCompleteDetail>;
  'daw-recording-error': CustomEvent<DawRecordingErrorDetail>;
  'daw-recording-pause': CustomEvent<DawRecordingPauseDetail>;
  'daw-recording-resume': CustomEvent<DawRecordingResumeDetail>;
  'daw-clip-connected': CustomEvent<DawClipConnectedDetail>;
  'daw-clip-update': CustomEvent<DawClipUpdateDetail>;
  'daw-clip-ready': CustomEvent<DawClipIdDetail>;
  'daw-clip-error': CustomEvent<DawClipErrorDetail>;
  'daw-clip-move': CustomEvent<DawClipMoveDetail>;
  'daw-clip-trim': CustomEvent<DawClipTrimDetail>;
  'daw-clip-split': CustomEvent<DawClipSplitDetail>;
  'daw-spectrogram-ready': CustomEvent<DawSpectrogramReadyDetail>;
  'daw-spectrogram-error': CustomEvent<DawSpectrogramErrorDetail>;
  'daw-effect-add': CustomEvent<DawEffectAddDetail>;
  'daw-effect-remove': CustomEvent<DawEffectRemoveDetail>;
  'daw-effect-change': CustomEvent<DawEffectChangeDetail>;
  'daw-effect-bypass': CustomEvent<DawEffectBypassDetail>;
  'daw-effect-reorder': CustomEvent<DawEffectReorderDetail>;
}

// Helper type for creating typed custom events
export type DawEvent<K extends keyof DawEventMap> = DawEventMap[K];

// ---------------------------------------------------------------------------
// API result types
// ---------------------------------------------------------------------------

export interface LoadFilesResult {
  loaded: string[];
  failed: Array<{ file: File; error: unknown }>;
}
