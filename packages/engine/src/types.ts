import type { ClipTrack } from '@waveform-playlist/core';

/**
 * Interface for pluggable audio playback adapters.
 * Implement this to connect PlaylistEngine to any audio backend
 * (Tone.js, openDAW, HTMLAudioElement, etc.)
 */
export interface PlayoutAdapter {
  init(): Promise<void>;
  setTracks(tracks: ClipTrack[]): void;
  /** Incrementally add a single track without rebuilding the entire playout. */
  addTrack?(track: ClipTrack): void;
  /** Incrementally remove a single track without rebuilding the entire playout. */
  removeTrack?(trackId: string): void;
  /** Update a single track's clips (removes old, adds new). */
  updateTrack?(trackId: string, track: ClipTrack): void;
  play(startTime: number, endTime?: number): void;
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
  setLoop(enabled: boolean, start: number, end: number): void;
  /** Set tempo at a tick position. First call (or atTick=0) sets the base tempo. */
  setTempo?(bpm: number, atTick?: number): void;
  /** Set time signature at a tick position. */
  setMeter?(numerator: number, denominator: number, atTick?: number): void;
  /** Convert ticks to seconds using the adapter's tempo map. */
  ticksToSeconds?(tick: number): number;
  /** Convert seconds to ticks using the adapter's tempo map. */
  secondsToTicks?(seconds: number): number;
  dispose(): void;
}

/**
 * Snapshot of playlist engine state, emitted on every state change.
 */
export interface EngineState {
  tracks: ClipTrack[];
  /** Monotonic counter incremented on any tracks mutation (setTracks, addTrack, removeTrack, moveClip, trimClip, splitClip). */
  tracksVersion: number;
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  samplesPerPixel: number;
  sampleRate: number;
  selectedTrackId: string | null;
  zoomIndex: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  /** Start of the audio selection range. Guaranteed: selectionStart <= selectionEnd. */
  selectionStart: number;
  /** End of the audio selection range. Guaranteed: selectionStart <= selectionEnd. */
  selectionEnd: number;
  /** Master output volume, 0.0–1.0. */
  masterVolume: number;
  /** Start of the loop region. Guaranteed: loopStart <= loopEnd. */
  loopStart: number;
  /** End of the loop region. Guaranteed: loopStart <= loopEnd. */
  loopEnd: number;
  /** Whether loop playback is active. */
  isLoopEnabled: boolean;
  /** Current base tempo in BPM. */
  bpm: number;
  /** Pulses per quarter note. */
  ppqn: number;
  /** Whether undo is available. */
  canUndo: boolean;
  /** Whether redo is available. */
  canRedo: boolean;
}

/**
 * Configuration options for PlaylistEngine constructor.
 */
export interface PlaylistEngineOptions {
  adapter?: PlayoutAdapter;
  sampleRate?: number;
  samplesPerPixel?: number;
  zoomLevels?: number[];
  /** Maximum number of undo steps (default 100). */
  undoLimit?: number;
  /** Initial tempo in BPM (default 120). */
  bpm?: number;
  /** Pulses per quarter note (default 960). */
  ppqn?: number;
}

/**
 * Events emitted by PlaylistEngine.
 */
export interface EngineEvents {
  statechange: (state: EngineState) => void;
  play: () => void;
  pause: () => void;
  stop: () => void;
}
