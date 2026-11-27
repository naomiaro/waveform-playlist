/**
 * The public face of an arrangement.
 */

import type {
  ArrangementTrack,
  ClipSource,
  DecidedPanLaw,
  ValueSource,
} from '@waveform-playlist/core';
import type { LoadSource } from './loadSource';
import type { ArrangementSourcesValue } from './sources';
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

/** Options of `removeClip`. */
export interface RemoveClipOptions {
  /**
   * `false`: the removal is not an undo step, and the clip is also taken out
   * of every undo and redo state, so no undo or redo brings it back (a
   * `<daw-clip>` the page removed while its track was detached, #848).
   */
  undoable?: boolean;
}

/** Options of `addTrack`. */
export interface AddTrackOptions {
  /**
   * Where the track enters: its index in the new order (cut to a whole
   * number, then held between 0 and the number of tracks). Left out: at the end.
   */
  index?: number;
}

/** How a mixer setter's change goes into the undo history. */
export interface MixerChangeOptions {
  /** Changes with the same id, one after another, are one undo step. */
  gesture?: string;
  /** Not an undo step: the value is written into every saved state as well. */
  undoable?: false;
}

/**
 * The kind of change a `subscribe` listener is told of:
 *
 * - `'set'`: `setTracks` replaced the whole set.
 * - `'add'`, `'remove'`, `'reorder'`: one track was added, removed or moved.
 * - `'update'`: one track changed (`updateTrack`, a clip added, removed,
 *   moved, trimmed or split).
 * - `'restore'`: an undo, a redo or an abort changed the tracks (and maybe
 *   the mix); `'restoreMix'`: it changed the mix only.
 * - `'load'`: audio arrived and loading clips became loaded clips.
 * - `'mixer'`: one of the mixer setters changed a volume, mute, solo, pan
 *   or pan law.
 * - `'recording'`: a take started or stopped recording onto a track.
 * - `'recompute'`: every track was gone through again: clip positions after
 *   a tempo change, or clip ticks when an engine attached.
 * - `'history'`: only what can be undone or redone changed.
 */
export type ArrangementChangeType =
  | 'set'
  | 'add'
  | 'remove'
  | 'update'
  | 'reorder'
  | 'restore'
  | 'restoreMix'
  | 'load'
  | 'mixer'
  | 'recording'
  | 'recompute'
  | 'history';

/** What a `subscribe` listener is told about a change. */
export interface ArrangementChangeInfo {
  readonly type: ArrangementChangeType;
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
   * The current volume, mute, solo and pan by track id (the stored mute: the
   * mute of the track a take is recording onto is not forced here). The same
   * Map until a value changes, a track with a new id enters, entries of
   * tracks that are gone are dropped, or an undo, a redo or an abort brings
   * back another state's Map. `mixerVersion` counts the value changes of
   * current tracks, and also the start or end of a take's mute on a current
   * track, which leaves this Map as it is; an entry seeded, carried or
   * dropped with its track is not counted. A track's own mixer fields in
   * `getTracks()` are the values it entered with; the current ones are here.
   */
  getMixer(): ReadonlyMap<string, TrackMixerValues>;
  /**
   * Be told after every change (tracks, mix or history), once per change, in
   * the order the changes were made, with the kind of change it was. Read
   * what changed from the arrangement itself. Returns a function that stops
   * it. A listener that throws is reported with `console.warn` and does not
   * fail the change.
   */
  subscribe(listener: (change: ArrangementChangeInfo) => void): () => void;
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
  /** Add a track: an undo step. Throws for an `index` that is not a finite number. */
  addTrack(track: ArrangementTrack, options?: AddTrackOptions): void;
  removeTrack(trackId: string, options?: RemoveTrackOptions): void;
  /**
   * Remove a clip from a track: an undo step. With `undoable: false` there is
   * no step, and the clip is also taken out of every undo and redo state.
   */
  removeClip(trackId: string, clipId: string, options?: RemoveClipOptions): void;
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

  // mixer (each call is an undo step, or a part of an open transaction; see
  // `MixerChangeOptions` for one step made of many calls, and for a value
  // that is no step. An undo, a redo or an abort brings back the mix of the
  // state it returns to. A value that does not change, or a track that is
  // not in the current tracks, changes nothing)
  setTrackVolume(trackId: string, volume: number, options?: MixerChangeOptions): void;
  setTrackMute(trackId: string, muted: boolean, options?: MixerChangeOptions): void;
  setTrackSolo(trackId: string, soloed: boolean, options?: MixerChangeOptions): void;
  setTrackPan(trackId: string, pan: number, options?: MixerChangeOptions): void;
  /**
   * Set a track's pan law (#684): `'mono'` or `'stereo'`. Any other value,
   * `'auto'` included, throws a `TypeError`. A mixer value like the four
   * above: `'auto'` until the track's first decoded audio decides it, after
   * which the track's clips do not change it. A MIDI track has none to set.
   */
  setTrackPanLaw(trackId: string, panLaw: DecidedPanLaw, options?: MixerChangeOptions): void;

  // recording mute (the track a take is recording onto)
  /**
   * The ids of the tracks a take is recording onto. The same Set until one
   * is added or removed; never write to it.
   */
  readonly recordingTrackIds: ReadonlySet<string>;
  /**
   * Mark a track as the one a take is recording onto, or clear it when the
   * take ends. Such a track plays muted: the engine's `getState().tracks`
   * and its adapter have it muted, while its mute in `getMixer()` stays as
   * it is and comes back when the take ends. This is not an undo step, and
   * undo, redo, an abort, `setTracks` and `clearHistory` do not change which
   * tracks are recording. An id that is not in the current tracks is
   * recorded too, and mutes nothing until a track of that id enters. The
   * same value changes nothing.
   */
  setTrackRecording(trackId: string, recording: boolean): void;

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
  /** Put the tracks and the mix back as they were when the transaction began. */
  abortTransaction(): void;

  // loading
  /**
   * Where each source the clips name is: pending, loaded or failed (also a
   * source of which a clip in the current tracks could not be made from its
   * audio). Read it with `getSnapshot()` or
   * `subscribe()`; the same object until a status changes. When a source is
   * loaded, every loading clip that names it has become a loaded clip, in the
   * current tracks and in every undo and redo state; that is not an undo step.
   * The tracks change first and are announced first: a `subscribe` listener
   * told of the loaded clip still reads the source as pending here.
   */
  readonly sources: ValueSource<ArrangementSourcesValue>;
  /**
   * Start a source whose load failed again. Does nothing for any other
   * source, also one shown as failed because a clip could not be made from
   * its audio (the audio is loaded; loading it again changes nothing).
   */
  retry(src: ClipSource): void;
}

export interface CreateArrangementOptions {
  /** The first tracks. Not an undo step. */
  tracks?: readonly ArrangementTrack[];
  /** Maximum number of undo steps (default 100). */
  undoLimit?: number;
  /**
   * How a clip's source becomes an AudioBuffer. Default: `defaultLoadSource`
   * (fetch a URL or read a Blob, then decode).
   */
  loadSource?: LoadSource;
}
