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
