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
