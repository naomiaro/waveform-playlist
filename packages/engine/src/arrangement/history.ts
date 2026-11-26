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

/** Every undo and redo state passed through `map`. */
export function mapHistoryStates(
  history: History,
  map: (state: SavedState) => SavedState
): History {
  return { undo: history.undo.map(map), redo: history.redo.map(map) };
}

/**
 * Take a track out of every state: the current state, each undo and redo
 * step (its tracks and its mixer entry) and an open transaction's base, so
 * that no undo, redo or abort brings it back. A step that no longer differs
 * from the state next to it would do nothing, and is dropped: next to the
 * newest step is the base while a transaction is open (the state an abort
 * returns to, and the step a commit pushes), else the current state. A state
 * that never held the track is the same object as before; the same `history`
 * object comes back when no step changed.
 */
export function purgeTrack(
  history: History,
  current: SavedState,
  trackId: string,
  base: SavedState | null = null
): { history: History; current: SavedState; base: SavedState | null } {
  return purgeStates(history, current, stateWithoutTrack(trackId), base);
}

/** A track's clip out of every state: what `removeClip(…, { undoable: false })` does. */
export function purgeClip(
  history: History,
  current: SavedState,
  trackId: string,
  clipId: string,
  base: SavedState | null = null
): { history: History; current: SavedState; base: SavedState | null } {
  return purgeStates(
    history,
    current,
    stateWithoutClip(history, current, trackId, clipId, base),
    base
  );
}

type SavedTrack = SavedState['tracks'][number];

/**
 * A function that takes a track's clip out of a state. The states are
 * walked in time order (undo steps oldest first, an open transaction's base,
 * the current state, the redo steps nearest first): a track that, after the
 * clip is gone, equals the same track in the state just before becomes that
 * object, so `dropRepeats` (which compares by identity) drops exactly the
 * steps that now change nothing, on either side of the current state
 * (review of #919: matching the oldest equal object left a no-op step when
 * the track had held the same content at two times). A state that holds
 * neither the clip nor a track equal to the one before is the same object.
 */
export function stateWithoutClip(
  history: History,
  current: SavedState,
  trackId: string,
  clipId: string,
  base: SavedState | null = null
): (state: SavedState) => SavedState {
  const inOrder = [
    ...history.undo,
    ...(base ? [base] : []),
    current,
    ...[...history.redo].reverse(),
  ];
  const mapped = new Map<SavedState, SavedState>();
  let before: SavedTrack | undefined;
  let stripped = false;
  for (const state of inOrder) {
    const known = mapped.get(state);
    if (known) {
      before = known.tracks.find((t) => t.id === trackId);
      continue;
    }
    const track = state.tracks.find((t) => t.id === trackId);
    let next: SavedTrack | undefined = track;
    if (track?.clips.some((c) => c.id === clipId)) {
      next = { ...track, clips: track.clips.filter((c) => c.id !== clipId) };
      stripped = true;
    }
    // Once a state was stripped, an equal track next to it is the same object.
    if (stripped && next && before && next !== before && sameTrackFields(before, next))
      next = before;
    mapped.set(
      state,
      next === track
        ? state
        : { tracks: state.tracks.map((t) => (t === track ? next! : t)), mixer: state.mixer }
    );
    before = next;
  }
  return (state) => mapped.get(state) ?? state;
}

/** The same fields as the same values, and the same clip objects in the same order. */
function sameTrackFields(a: SavedTrack, b: SavedTrack): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]) as Set<keyof SavedTrack>;
  for (const key of keys) {
    if (key !== 'clips' && a[key] !== b[key]) return false;
  }
  return a.clips.length === b.clips.length && a.clips.every((c, i) => c === b.clips[i]);
}

/**
 * Apply `strip` to the current state, an open transaction's base and every
 * undo and redo state, then drop the steps that no longer differ.
 */
function purgeStates(
  history: History,
  current: SavedState,
  strip: (state: SavedState) => SavedState,
  base: SavedState | null
): { history: History; current: SavedState; base: SavedState | null } {
  const nextCurrent = strip(current);
  const nextBase = base && strip(base);
  const stripped = dropRepeats(mapHistoryStates(history, strip), nextBase ?? nextCurrent);
  return {
    history: sameSteps(stripped, history) ? history : stripped,
    current: nextCurrent,
    base: nextBase,
  };
}

/**
 * A function that writes mixer values into the entry of `trackId` of a state
 * (a value that is not an undo step, so that no undo, redo or abort brings
 * the old one back). A state that has no entry for the track, or has these
 * values, is the same object; states that shared a Map go on sharing one;
 * nothing is written into a Map that exists.
 */
export function stateWithMixerValues(
  trackId: string,
  patch: Partial<TrackMixerValues>
): (state: SavedState) => SavedState {
  const mixers = new Map<Mixer, Mixer>();
  // Per state too, so that a state written twice is one object.
  const states = new Map<SavedState, SavedState>();
  return (state) => {
    const known = states.get(state);
    if (known) return known;
    let mixer = mixers.get(state.mixer);
    if (!mixer) {
      mixer = setMixerValues(state.mixer, trackId, patch);
      mixers.set(state.mixer, mixer);
    }
    const next = mixer === state.mixer ? state : { ...state, mixer };
    states.set(state, next);
    return next;
  };
}

/**
 * Write with `write` (`stateWithMixerValues`) into every saved state: each
 * undo and redo step and an open transaction's base. A step that no longer
 * differs from the state next to it is then dropped (`dropRepeats`): next to
 * the newest step is the base while a transaction is open, else `current`.
 */
export function writeThrough(
  history: History,
  base: TransactionBase | null,
  current: SavedState,
  write: (state: SavedState) => SavedState
): { history: History; base: TransactionBase | null } {
  const nextBase = base && { ...base, state: write(base.state) };
  return {
    history: dropRepeats(mapHistoryStates(history, write), nextBase?.state ?? current),
    base: nextBase,
  };
}
