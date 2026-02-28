import type { ClipTrack } from '@waveform-playlist/core';

/**
 * Interface for pluggable audio playback adapters.
 * Implement this to connect PlaylistEngine to any audio backend
 * (Tone.js, openDAW, HTMLAudioElement, etc.)
 */
export interface PlayoutAdapter {
  init(): Promise<void>;
  setTracks(tracks: ClipTrack[]): void;
  play(startTime: number, endTime?: number): Promise<void>;
  pause(): void;
  stop(): void;
  seek(time: number): void;
  getCurrentTime(): number;
  isPlaying(): boolean;
  setMasterVolume(volume: number): void;
  setTrackVolume(trackId: string, volume: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  setTrackSolo(trackId: string, soloed: boolean): void;
  setTrackPan(trackId: string, pan: number): void;
  dispose(): void;
}

/**
 * Snapshot of playlist engine state, emitted on every state change.
 */
export interface EngineState {
  tracks: ClipTrack[];
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  samplesPerPixel: number;
  sampleRate: number;
  selectedTrackId: string | null;
  zoomIndex: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  selectionStart: number;
  selectionEnd: number;
  masterVolume: number;
  loopStart: number;
  loopEnd: number;
  isLoopEnabled: boolean;
}

/**
 * Configuration options for PlaylistEngine constructor.
 */
export interface PlaylistEngineOptions {
  adapter?: PlayoutAdapter;
  sampleRate?: number;
  samplesPerPixel?: number;
  zoomLevels?: number[];
}

/**
 * Events emitted by PlaylistEngine.
 */
export interface EngineEvents {
  statechange: (state: EngineState) => void;
  timeupdate: (time: number) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}
