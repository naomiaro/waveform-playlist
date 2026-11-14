import type { ClipTrack } from '@waveform-playlist/core';

export interface IncrementalTrackChange {
  /** Tracks that are new. */
  added: ClipTrack[];
  /**
   * Tracks that gained clips: a placeholder that had none and now has some
   * (its audio arrived), or a track that kept every clip it had, as the same
   * objects in the same order, and has at least one more (a clip's source
   * finished loading). Nothing else about a track in the second case differs.
   */
  filled: ClipTrack[];
}

/** True when every clip of `previous` is in `current` as the same object, in the same order. */
function keepsEveryClip(previous: ClipTrack['clips'], current: ClipTrack['clips']): boolean {
  let next = 0;
  for (const clip of current) {
    if (next < previous.length && clip === previous[next]) next++;
  }
  return next === previous.length;
}

/** True when the two track objects have the same own enumerable fields, `clips` aside. */
function sameApartFromClips(previous: ClipTrack, current: ClipTrack): boolean {
  const previousKeys = Object.keys(previous).filter((key) => key !== 'clips');
  const currentKeys = Object.keys(current).filter((key) => key !== 'clips');
  if (previousKeys.length !== currentKeys.length) return false;
  const before = previous as unknown as Record<string, unknown>;
  const after = current as unknown as Record<string, unknown>;
  return previousKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(after, key) && Object.is(before[key], after[key])
  );
}

/** Whether a track that differs from `previous` can be handed to the engine as a fill. */
function isFill(previous: ClipTrack, current: ClipTrack): boolean {
  if (previous.clips.length === 0) return current.clips.length > 0;
  return (
    current.clips.length > previous.clips.length &&
    keepsEveryClip(previous.clips, current.clips) &&
    sameApartFromClips(previous, current)
  );
}

/**
 * Decides whether a new `tracks` array can be applied to the running engine
 * track by track, without disposing and rebuilding it.
 *
 * It can when every track of the previous array is still at its index
 * (new tracks come after them) and is the same object, or is a fill (see
 * `IncrementalTrackChange.filled`): a track that had no clips and now has
 * some, or a track that kept all its clips as the same objects in the same
 * order, gained at least one, and differs in no other field. At least one
 * track must be added or filled. Anything else (a track removed, a track
 * with clips replaced, renamed or reordered) returns `null`: a full rebuild.
 *
 * The clips a filled track already had are not touched, so replacing it
 * cannot disturb playback of the others. This is what happens for every
 * source that finishes decoding after the first build (a track whose loading
 * clips resolve gains them); treated as a rebuild, dropping N files rebuilt
 * the engine N times.
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
    if (!isFill(previous, current)) return null;
    filled.push(current);
  }

  // The engine appends an added track: the tracks that were there must keep
  // their places, with the new ones after them.
  if (prevTracks.some((track, index) => tracks[index].id !== track.id)) return null;
  const prevIds = new Set(prevTracks.map((track) => track.id));
  const added = tracks.filter((track) => !prevIds.has(track.id));
  if (added.length === 0 && filled.length === 0) return null;
  return { added, filled };
}
