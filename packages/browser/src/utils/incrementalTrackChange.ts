import type { ClipTrack } from '@waveform-playlist/core';

export interface IncrementalTrackChange {
  /** Tracks that are new. */
  added: ClipTrack[];
  /** Tracks that had no clips and now have some (a placeholder whose audio arrived). */
  filled: ClipTrack[];
}

/**
 * Decides whether a new `tracks` array can be applied to the running engine
 * track by track, without disposing and rebuilding it.
 *
 * It can when every track of the previous array is still present, in the
 * same order, and is
 * either the same object or was empty and now has clips, and at least one
 * track was added or filled. Anything else (a track removed, a track with
 * clips replaced) returns `null`: a full rebuild.
 *
 * An empty track has nothing scheduled, so replacing it cannot disturb
 * playback of the others. This is what `useDynamicTracks` does for every file
 * that finishes decoding; treated as a rebuild, dropping N files rebuilt the
 * engine N times.
 */
export function incrementalTrackChange(
  prevTracks: ClipTrack[],
  tracks: ClipTrack[]
): IncrementalTrackChange | null {
  if (tracks.length < prevTracks.length) return null;

  const byId = new Map(tracks.map((track) => [track.id, track]));
  const filled: ClipTrack[] = [];
  for (const previous of prevTracks) {
    const current = byId.get(previous.id);
    if (current === undefined) return null;
    if (current === previous) continue;
    if (previous.clips.length > 0 || current.clips.length === 0) return null;
    filled.push(current);
  }

  // The engine keeps its own order and the mixer state is stored by position,
  // so the tracks that were there must keep their order.
  const prevIds = new Set(prevTracks.map((track) => track.id));
  const kept = tracks.filter((track) => prevIds.has(track.id));
  if (kept.some((track, index) => track.id !== prevTracks[index].id)) return null;
  const added = tracks.filter((track) => !prevIds.has(track.id));
  if (added.length === 0 && filled.length === 0) return null;
  return { added, filled };
}
