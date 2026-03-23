import type { DawTrackElement } from './elements/daw-track';

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

export interface DawClipMoveDetail {
  trackId: string;
  clipId: string;
  /** Requested cumulative delta. May exceed actual applied movement due to
   *  collision constraints. Query engine state for actual clip positions. */
  deltaSamples: number;
}

export interface DawClipTrimDetail {
  trackId: string;
  clipId: string;
  boundary: 'left' | 'right';
  /** Constrained cumulative delta applied by the engine. Already clamped
   *  by collision and boundary constraints during drag. */
  deltaSamples: number;
}

export interface DawClipSplitDetail {
  trackId: string;
  originalClipId: string;
  leftClipId: string;
  rightClipId: string;
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
  'daw-clip-move': CustomEvent<DawClipMoveDetail>;
  'daw-clip-trim': CustomEvent<DawClipTrimDetail>;
  'daw-clip-split': CustomEvent<DawClipSplitDetail>;
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
