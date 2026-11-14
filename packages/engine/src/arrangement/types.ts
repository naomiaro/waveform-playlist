/**
 * The public face of an arrangement.
 */

import type { ArrangementTrack } from '@waveform-playlist/core';
import type { TrackMixerValues } from './mixer';

export interface ClipBounds {
  offsetSamples: number;
  durationSamples: number;
  startSample: number;
  sourceDurationSamples: number;
}

export interface RemoveTrackOptions {
  /**
   * `false`: the removal is not an undo step, and the track is also taken
   * out of every undo and redo state, so no undo or redo brings it back.
   * For a track that should never have been there (a dropped file that could
   * not be decoded).
   */
  undoable?: boolean;
}

/**
 * The owner of the tracks, of the mix and of the undo history. Everything
 * else reads it (`getTracks`, `getMixer`, `subscribe`) and changes it by
 * calling its methods. A `PlaylistEngine` built on it plays it.
 *
 * Nothing it returns is a copy: never write to a tracks array, a track, a
 * clip or the mixer Map. Outside production builds the tracks are frozen.
 */
export interface Arrangement {
  // read
  /**
   * The tracks and their clips: loaded clips (`AudioClip`) and clips whose
   * audio is not loaded yet (`LoadingClip`; tell them apart with
   * `isLoadingClip`). The same array until they change.
   */
  getTracks(): readonly ArrangementTrack[];
  /**
   * The current volume, mute, solo and pan by track id. The same Map until a
   * value changes, a track with a new id enters, or entries of tracks that
   * are gone are dropped (`mixerVersion` counts value changes only). A
   * track's own mixer fields in `getTracks()` are the values it entered
   * with; the current ones are here.
   */
  getMixer(): ReadonlyMap<string, TrackMixerValues>;
  /**
   * Be told after every change (tracks, mix or history), once per change, in
   * the order the changes were made. Returns a function that stops it. A
   * listener that throws is reported with `console.warn` and does not fail
   * the change.
   */
  subscribe(listener: () => void): () => void;
  /** Counts changes to the tracks. */
  readonly tracksVersion: number;
  /** Counts changes to the mix. */
  readonly mixerVersion: number;

  // whole set
  /**
   * Replace every track. Clears the undo history and ends an open
   * transaction. An id that is in the tracks being replaced keeps its mix.
   */
  setTracks(tracks: readonly ArrangementTrack[]): void;

  // tracks
  addTrack(track: ArrangementTrack): void;
  removeTrack(trackId: string, options?: RemoveTrackOptions): void;
  /**
   * Replace a track, with a track or with a function of the current one.
   * Changes nothing for an id no track has (a track object is still checked
   * and may throw; a function is not called). The mixer fields of the new
   * track are not read: use the setters. A track that is given a new id
   * takes its mix with it.
   */
  updateTrack(
    trackId: string,
    next: ArrangementTrack | ((track: ArrangementTrack) => ArrangementTrack)
  ): void;
  /** Move a track to another place in the order. */
  reorderTrack(trackId: string, toIndex: number): void;

  // clips (a clip that is still loading cannot be edited: these treat it as
  // a clip that is not there, and loaded clips do not collide with it)
  /** Move a clip. Returns the delta actually applied (0 when it cannot move). */
  moveClip(trackId: string, clipId: string, deltaSamples: number): number;
  trimClip(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number): void;
  splitClip(trackId: string, clipId: string, atSample: number): void;
  getClipBounds(trackId: string, clipId: string): ClipBounds | null;
  constrainTrimDelta(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): number;

  // mixer (not undo steps; an undo never changes them; a track that is not
  // in the current tracks is left alone)
  setTrackVolume(trackId: string, volume: number): void;
  setTrackMute(trackId: string, muted: boolean): void;
  setTrackSolo(trackId: string, soloed: boolean): void;
  setTrackPan(trackId: string, pan: number): void;

  // history
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** With a transaction open: aborts it first. */
  undo(): void;
  /** With a transaction open: aborts it first. */
  redo(): void;
  clearHistory(): void;
  /** Changes made until `commitTransaction` are one undo step. */
  beginTransaction(): void;
  commitTransaction(): void;
  /** Put the tracks back as they were when the transaction began. */
  abortTransaction(): void;
}

export interface CreateArrangementOptions {
  /** The first tracks. Not an undo step. */
  tracks?: readonly ArrangementTrack[];
  /** Maximum number of undo steps (default 100). */
  undoLimit?: number;
}
