/**
 * Outside production builds, freeze what the arrangement and the engine
 * hand out. The tracks are shared between states, the undo history and
 * every reader, so a write by a consumer would change all of them; frozen,
 * the write throws where it is made (in a module, which is strict code).
 *
 * Frozen: the tracks array, each track, its `clips` array and each clip.
 * Not what a clip refers to (its AudioBuffer, peaks, fades, notes).
 */

import type { ClipTrack } from '@waveform-playlist/core';

declare const process: { env: { NODE_ENV?: string } };

/**
 * True unless this is a production build. Bundlers replace
 * `process.env.NODE_ENV` with a literal; where there is no `process` at all
 * (a page that loads the module without a bundler) this is false.
 */
export function isDevelopmentBuild(): boolean {
  try {
    return process.env.NODE_ENV !== 'production';
  } catch {
    return false;
  }
}

/** Freeze one track with its clips. A track that is already frozen is done. */
export function freezeTrackInDevelopment<T extends ClipTrack>(track: T): T {
  if (!isDevelopmentBuild() || Object.isFrozen(track)) return track;
  for (const clip of track.clips) Object.freeze(clip);
  Object.freeze(track.clips);
  return Object.freeze(track);
}

/** Freeze a tracks array and every track in it. */
export function freezeTracksInDevelopment<T extends readonly ClipTrack[]>(tracks: T): T {
  if (!isDevelopmentBuild()) return tracks;
  for (const track of tracks) freezeTrackInDevelopment(track);
  return Object.freeze(tracks);
}
