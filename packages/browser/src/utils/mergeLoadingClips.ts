/**
 * mergeLoadingClips
 *
 * Tracks handed back to the app must not lose a clip that is still loading,
 * and must not carry a placeholder as if it were real. The engine's tracks
 * never hold loading clips; a drag handler's copy of the view's tracks holds
 * placeholders. This puts each loading clip of the app's latest `tracks` back
 * (by clip id) and removes the placeholders, also from a track `latest` lacks.
 * A clip is a placeholder only when its id is in `placeholderIds` AND it has no
 * `audioBuffer` (a resolved clip has one), so a stale set never replaces a
 * resolved clip.
 */

import { isLoadingClip } from '@waveform-playlist/core';
import type { AudioClip, ClipTrack, LoadingClip, PlaylistTrack } from '@waveform-playlist/core';

type AnyClip = AudioClip | LoadingClip;

function loadingClipsById(track: PlaylistTrack): Map<string, LoadingClip> {
  const byId = new Map<string, LoadingClip>();
  for (const clip of track.clips) {
    if (isLoadingClip(clip)) byId.set(clip.id, clip);
  }
  return byId;
}

/** A placeholder has an id in the set and never has an `audioBuffer`; a resolved clip does. */
function isPlaceholder(clip: AnyClip, placeholderIds: ReadonlySet<string>): boolean {
  return placeholderIds.has(clip.id) && !('audioBuffer' in clip && clip.audioBuffer);
}

function mergeClips(
  outgoing: readonly AnyClip[],
  loadingById: ReadonlyMap<string, LoadingClip>,
  placeholderIds: ReadonlySet<string>
): AnyClip[] {
  const outgoingIds = new Set(outgoing.map((clip) => clip.id));
  const merged: AnyClip[] = [];
  for (const clip of outgoing) {
    if (!isPlaceholder(clip, placeholderIds)) {
      merged.push(clip);
      continue;
    }
    const original = loadingById.get(clip.id);
    if (original) merged.push(original);
  }
  for (const [id, clip] of loadingById) {
    if (!outgoingIds.has(id)) merged.push(clip);
  }
  return merged;
}

function sameClips(a: readonly AnyClip[], b: readonly AnyClip[]): boolean {
  return a.length === b.length && a.every((clip, i) => clip === b[i]);
}

function mergeTrack(
  track: ClipTrack,
  latestTrack: PlaylistTrack | undefined,
  placeholderIds: ReadonlySet<string>
): PlaylistTrack {
  const loadingById = latestTrack ? loadingClipsById(latestTrack) : new Map<string, LoadingClip>();
  const clips = mergeClips(track.clips, loadingById, placeholderIds);
  return sameClips(clips, track.clips) ? track : { ...track, clips };
}

/**
 * `outgoing`: tracks about to be handed to the app (the engine's, or a drag
 * handler's copy of the view's). `latest`: the current `tracks` prop.
 * `placeholderIds`: clip ids that are placeholders in the current view.
 */
export function mergeLoadingClips(
  outgoing: ClipTrack[],
  latest: PlaylistTrack[],
  placeholderIds: ReadonlySet<string>
): PlaylistTrack[] {
  const latestById = new Map(latest.map((track) => [track.id, track]));
  const merged = outgoing.map((track) =>
    mergeTrack(track, latestById.get(track.id), placeholderIds)
  );
  return merged.every((track, i) => track === outgoing[i]) ? outgoing : merged;
}
