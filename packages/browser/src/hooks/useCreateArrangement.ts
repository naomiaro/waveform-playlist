import { useState } from 'react';
import { createArrangement } from '@waveform-playlist/engine';
import type { Arrangement, LoadSource } from '@waveform-playlist/engine';
import type { ArrangementTrack } from '@waveform-playlist/core';

export interface UseCreateArrangementOptions {
  /** How a clip's source is fetched and decoded. Nothing is fetched until a decode context is attached. */
  loadSource?: LoadSource;
  /** How many undo steps the arrangement keeps. */
  undoLimit?: number;
}

/**
 * Create the `Arrangement` that owns a multitrack editor's tracks, one per
 * component instance. Returns the same arrangement on every render.
 *
 * `init` and `options` are read once, on the first render; a later render
 * with other values changes nothing. An initializer that throws (a track
 * with a wrong kind, a duplicate track id, two clips with one id) throws out
 * of the render, to the nearest error boundary.
 *
 * Under StrictMode React calls the initializer twice and keeps one result;
 * neither arrangement fetches anything, because none has a decode context.
 */
export function useCreateArrangement(
  init?: () => readonly ArrangementTrack[],
  options?: UseCreateArrangementOptions
): Arrangement {
  // Only the two documented options: a stray `tracks` key (plain JS) must not
  // replace what the initializer returns.
  const [arrangement] = useState(() =>
    createArrangement({
      tracks: init?.(),
      loadSource: options?.loadSource,
      undoLimit: options?.undoLimit,
    })
  );
  return arrangement;
}
