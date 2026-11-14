/**
 * Helpers for clips the view already draws but the engine does not hold yet
 * (#812): a source that finished loading during a trim drag. The provider
 * applies such a clip to the engine after the release.
 */

import { isLoadingClip } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack, LoadingClip, PlaylistTrack } from '@waveform-playlist/core';

/** True when the two arrays hold the same objects in the same order. */
export function sameElements<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

/**
 * True when `current` holds a track, or a clip of a track, that `applied`
 * (the tracks last handed to the engine) does not: by id, so a clip that was
 * only moved or trimmed does not count.
 */
export function hasUnappliedContent(applied: ClipTrack[], current: ClipTrack[]): boolean {
  const appliedById = new Map(applied.map((track) => [track.id, track]));
  return current.some((track) => {
    const before = appliedById.get(track.id);
    if (!before) return true;
    const ids = new Set(before.clips.map((clip) => clip.id));
    return track.clips.some((clip) => !ids.has(clip.id));
  });
}

function keepTrackLoading(
  track: PlaylistTrack,
  latestTrack: PlaylistTrack | undefined,
  engineTrack: ClipTrack | undefined
): PlaylistTrack {
  if (!latestTrack || !engineTrack) return track;
  const loadingById = new Map<string, LoadingClip>();
  for (const clip of latestTrack.clips) {
    if (isLoadingClip(clip)) loadingById.set(clip.id, clip);
  }
  if (loadingById.size === 0) return track;
  const held = new Set(engineTrack.clips.map((clip) => clip.id));
  let changed = false;
  const clips = track.clips.map((clip): AudioClip | LoadingClip => {
    const original = loadingById.get(clip.id);
    if (!original || isLoadingClip(clip) || held.has(clip.id)) return clip;
    changed = true;
    return original;
  });
  return changed ? { ...track, clips } : track;
}

/**
 * For tracks a drag handler is handing to the app (copies of the view's
 * tracks, after `mergeLoadingClips`): a resolved clip that the app's `latest`
 * tracks still name as a loading clip and that the engine does not hold yet
 * goes back as that loading clip. The app's state then keeps naming it as
 * loading until the engine has it, and the engine's next report of its tracks
 * cannot drop it. A clip the engine holds (the one being trimmed) is kept as
 * it is. Returns `outgoing` itself when nothing changed.
 */
export function keepUnappliedClipsLoading(
  outgoing: PlaylistTrack[],
  latest: PlaylistTrack[],
  engineTracks: ClipTrack[]
): PlaylistTrack[] {
  const latestById = new Map(latest.map((track) => [track.id, track]));
  const engineById = new Map(engineTracks.map((track) => [track.id, track]));
  const kept = outgoing.map((track) =>
    keepTrackLoading(track, latestById.get(track.id), engineById.get(track.id))
  );
  return sameElements(kept, outgoing) ? outgoing : kept;
}
