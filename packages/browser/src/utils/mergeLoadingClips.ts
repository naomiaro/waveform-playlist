/**
 * mergeLoadingClips
 *
 * Tracks handed back to the app must not lose a clip that is still loading,
 * and must not carry a placeholder as if it were real. The engine's tracks
 * never hold loading clips; a drag handler's copy of the view's tracks holds
 * placeholders. This puts each loading clip of the app's latest `tracks` back
 * (by clip id) and removes the placeholders.
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

function mergeClips(
  outgoing: readonly AnyClip[],
  loadingById: ReadonlyMap<string, LoadingClip>,
  placeholderIds: ReadonlySet<string>
): AnyClip[] {
  const outgoingIds = new Set(outgoing.map((clip) => clip.id));
  const merged: AnyClip[] = [];
  for (const clip of outgoing) {
    if (!placeholderIds.has(clip.id)) {
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
  if (!latestTrack) return track;
  const clips = mergeClips(track.clips, loadingClipsById(latestTrack), placeholderIds);
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
