/**
 * Undo and redo as pure functions over references to earlier states.
 *
 * A state is the tracks array and the mixer Map from one moment (#843).
 * Nothing here copies a track or an entry: the arrangement never writes into
 * an array or a Map it has replaced, so a reference is a snapshot.
 */

import type { ArrangementTrack } from '@waveform-playlist/core';
import { sameMixerValues, setMixerValues, withoutEntry } from './mixer';
import type { Mixer, TrackMixerValues } from './mixer';

export type Tracks = readonly ArrangementTrack[];

/** The tracks and the mix from one moment: an undo or redo step, a transaction's base. */
export interface SavedState {
  readonly tracks: Tracks;
  readonly mixer: Mixer;
}

export interface History {
  /** Earlier states, oldest first. */
  readonly undo: readonly SavedState[];
  /** States that were undone, the next one to redo last. */
  readonly redo: readonly SavedState[];
}

export const EMPTY_HISTORY: History = { undo: [], redo: [] };

/** The state a transaction began from, and whether anything has changed since. */
export interface TransactionBase {
  readonly state: SavedState;
  readonly changed: boolean;
}

/** Record `state` as the state to return to. Clears redo; keeps at most `limit` steps. */
export function pushStep(history: History, state: SavedState, limit: number): History {
  const undo = [...history.undo, state];
  return { undo: undo.length > limit ? undo.slice(undo.length - limit) : undo, redo: [] };
}

/** Step back. `current` becomes the state to redo. Null when there is nothing to undo. */
export function undoStep(
  history: History,
  current: SavedState
): { history: History; state: SavedState } | null {
  if (history.undo.length === 0) return null;
  const state = history.undo[history.undo.length - 1];
  return {
    history: { undo: history.undo.slice(0, -1), redo: [...history.redo, current] },
    state,
  };
}

/** Step forward again. `current` becomes the state to undo to. Null when there is nothing to redo. */
export function redoStep(
  history: History,
  current: SavedState
): { history: History; state: SavedState } | null {
  if (history.redo.length === 0) return null;
  const state = history.redo[history.redo.length - 1];
  return {
    history: { undo: [...history.undo, current], redo: history.redo.slice(0, -1) },
    state,
  };
}

/** The base of a new transaction. */
export function beginBase(state: SavedState): TransactionBase {
  return { state, changed: false };
}

/** The state with other tracks and the same mix; the same object when the tracks are the same array. */
export function withStateTracks(state: SavedState, tracks: Tracks): SavedState {
  return tracks === state.tracks ? state : { ...state, tracks };
}

/** Every step with its tracks passed through `map` (the mixes are kept). */
export function mapHistoryTracks(history: History, map: (tracks: Tracks) => Tracks): History {
  const each = (state: SavedState) => withStateTracks(state, map(state.tracks));
  return { undo: history.undo.map(each), redo: history.redo.map(each) };
}

/** `tracks` without the track of that id; the same array when it holds no such track. */
export function withoutTrack(tracks: Tracks, trackId: string): Tracks {
  return tracks.some((track) => track.id === trackId)
    ? tracks.filter((track) => track.id !== trackId)
    : tracks;
}

/** The same tracks, as the same objects, in the same order. */
export function sameTracks(a: Tracks, b: Tracks): boolean {
  return a === b || (a.length === b.length && a.every((track, i) => track === b[i]));
}

/** The same tracks (as objects) and the same mix (by value). */
export function sameState(a: SavedState, b: SavedState): boolean {
  return a === b || (sameTracks(a.tracks, b.tracks) && sameMixerValues(a.mixer, b.mixer));
}

/**
 * A function that takes a track out of a state: out of its tracks, and its
 * entry out of its mix. A state that never held the track is the same
 * object; states that shared a Map go on sharing one.
 */
export function stateWithoutTrack(trackId: string): (state: SavedState) => SavedState {
  const mixers = new Map<Mixer, Mixer>();
  const mixerWithout = (mixer: Mixer): Mixer => {
    const known = mixers.get(mixer);
    if (known) return known;
    const next = withoutEntry(mixer, trackId);
    mixers.set(mixer, next);
    return next;
  };
  return (state) => {
    const tracks = withoutTrack(state.tracks, trackId);
    const mixer = mixerWithout(state.mixer);
    return tracks === state.tracks && mixer === state.mixer ? state : { tracks, mixer };
  };
}

/**
 * Drop every step that no longer differs from the state next to it (towards
 * `current`): undoing or redoing it would do nothing visible. The same
 * `history` object when no step goes.
 */
export function dropRepeats(history: History, current: SavedState): History {
  // Oldest first, towards the current state: keep a step only where it differs from the one after it.
  const undo: SavedState[] = [];
  for (const step of history.undo) {
    if (undo.length === 0 || !sameState(undo[undo.length - 1], step)) undo.push(step);
  }
  while (undo.length > 0 && sameState(undo[undo.length - 1], current)) undo.pop();

  // The redo stack is stored with the next state to redo LAST: walk it away from the current state.
  const redoFromCurrent: SavedState[] = [];
  for (let i = history.redo.length - 1; i >= 0; i--) {
    const step = history.redo[i];
    const before =
      redoFromCurrent.length > 0 ? redoFromCurrent[redoFromCurrent.length - 1] : current;
    if (!sameState(before, step)) redoFromCurrent.push(step);
  }

  if (undo.length === history.undo.length && redoFromCurrent.length === history.redo.length) {
    return history;
  }
  return { undo, redo: redoFromCurrent.reverse() };
}

/** The same steps, as the same objects. */
function sameSteps(a: History, b: History): boolean {
  return (
    a === b ||
    (a.undo.length === b.undo.length &&
      a.redo.length === b.redo.length &&
      a.undo.every((step, i) => step === b.undo[i]) &&
      a.redo.every((step, i) => step === b.redo[i]))
  );
}

/**
 * Take a track out of every state: the current state and each undo and redo
 * step (its tracks and its mixer entry), so that no undo or redo brings it
 * back. A step that no longer differs from the state next to it would do
 * nothing, and is dropped. A state that never held the track is the same
 * object as before; the same `history` object comes back when no step changed.
 */
export function purgeTrack(
  history: History,
  current: SavedState,
  trackId: string
): { history: History; current: SavedState } {
  const strip = stateWithoutTrack(trackId);
  const nextCurrent = strip(current);
  const stripped = dropRepeats(
    { undo: history.undo.map(strip), redo: history.redo.map(strip) },
    nextCurrent
  );
  return { history: sameSteps(stripped, history) ? history : stripped, current: nextCurrent };
}

/**
 * Write mixer values into the entry of `trackId` in every saved state that
 * has one: each undo and redo step and an open transaction's base (a value
 * that is not an undo step, so that no undo, redo or abort brings the old one
 * back). States that shared a Map go on sharing one; a state whose Map
 * changes is a new object, and nothing is written into a Map that exists.
 */
export function writeThrough(
  history: History,
  base: TransactionBase | null,
  trackId: string,
  patch: Partial<TrackMixerValues>
): { history: History; base: TransactionBase | null } {
  const mixers = new Map<Mixer, Mixer>();
  const write = (state: SavedState): SavedState => {
    let mixer = mixers.get(state.mixer);
    if (!mixer) {
      mixer = setMixerValues(state.mixer, trackId, patch);
      mixers.set(state.mixer, mixer);
    }
    return mixer === state.mixer ? state : { ...state, mixer };
  };
  return {
    history: { undo: history.undo.map(write), redo: history.redo.map(write) },
    base: base && { ...base, state: write(base.state) },
  };
}
