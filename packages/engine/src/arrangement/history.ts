/**
 * Undo and redo as pure functions over references to earlier track arrays.
 *
 * A step is the tracks array from before a change. Nothing here copies a
 * track: the arrangement never writes into an array it has replaced, so a
 * reference is a snapshot.
 */

import type { ClipTrack } from '@waveform-playlist/core';

export type Tracks = readonly ClipTrack[];

export interface History {
  /** Earlier states, oldest first. */
  readonly undo: readonly Tracks[];
  /** States that were undone, the next one to redo last. */
  readonly redo: readonly Tracks[];
}

export const EMPTY_HISTORY: History = { undo: [], redo: [] };

/** The state a transaction began from, and whether anything has changed since. */
export interface TransactionBase {
  readonly tracks: Tracks;
  readonly changed: boolean;
}

/** Record `tracks` as the state to return to. Clears redo; keeps at most `limit` steps. */
export function pushStep(history: History, tracks: Tracks, limit: number): History {
  const undo = [...history.undo, tracks];
  return { undo: undo.length > limit ? undo.slice(undo.length - limit) : undo, redo: [] };
}

/** Step back. `current` becomes the state to redo. Null when there is nothing to undo. */
export function undoStep(
  history: History,
  current: Tracks
): { history: History; tracks: Tracks } | null {
  if (history.undo.length === 0) return null;
  const tracks = history.undo[history.undo.length - 1];
  return {
    history: { undo: history.undo.slice(0, -1), redo: [...history.redo, current] },
    tracks,
  };
}

/** Step forward again. `current` becomes the state to undo to. Null when there is nothing to redo. */
export function redoStep(
  history: History,
  current: Tracks
): { history: History; tracks: Tracks } | null {
  if (history.redo.length === 0) return null;
  const tracks = history.redo[history.redo.length - 1];
  return {
    history: { undo: [...history.undo, current], redo: history.redo.slice(0, -1) },
    tracks,
  };
}

/** The base of a new transaction. */
export function beginBase(tracks: Tracks): TransactionBase {
  return { tracks, changed: false };
}

/** `tracks` without the track of that id; the same array when it holds no such track. */
export function withoutTrack(tracks: Tracks, trackId: string): Tracks {
  return tracks.some((track) => track.id === trackId)
    ? tracks.filter((track) => track.id !== trackId)
    : tracks;
}

function sameTracks(a: Tracks, b: Tracks): boolean {
  return a === b || (a.length === b.length && a.every((track, i) => track === b[i]));
}

/**
 * Take a track out of every state: the current tracks and each undo and
 * redo step, so that no undo or redo brings it back. A step that no longer
 * differs from the state next to it would do nothing, and is dropped.
 * A state that never held the track is the same array as before; the same
 * `history` object comes back when no step changed.
 */
export function purgeTrack(
  history: History,
  current: Tracks,
  trackId: string
): { history: History; current: Tracks } {
  const nextCurrent = withoutTrack(current, trackId);

  // Oldest first, towards the current state: keep a step only where it differs from the one after it.
  const undo: Tracks[] = [];
  for (const step of history.undo) {
    const stripped = withoutTrack(step, trackId);
    if (undo.length === 0 || !sameTracks(undo[undo.length - 1], stripped)) undo.push(stripped);
  }
  while (undo.length > 0 && sameTracks(undo[undo.length - 1], nextCurrent)) undo.pop();

  // The redo stack is stored with the next state to redo LAST: walk it away from the current state.
  const redoFromCurrent: Tracks[] = [];
  for (let i = history.redo.length - 1; i >= 0; i--) {
    const stripped = withoutTrack(history.redo[i], trackId);
    const before =
      redoFromCurrent.length > 0 ? redoFromCurrent[redoFromCurrent.length - 1] : nextCurrent;
    if (!sameTracks(before, stripped)) redoFromCurrent.push(stripped);
  }
  const redo = redoFromCurrent.reverse();

  const unchanged =
    undo.length === history.undo.length &&
    redo.length === history.redo.length &&
    undo.every((step, i) => step === history.undo[i]) &&
    redo.every((step, i) => step === history.redo[i]);
  return { history: unchanged ? history : { undo, redo }, current: nextCurrent };
}
