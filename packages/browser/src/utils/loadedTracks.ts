/**
 * loadedTracks
 *
 * An arrangement's tracks without their loading clips (#812): what the
 * provider publishes as `usePlaylistTimeline().tracks` and what the engine
 * plays. A clip that is still loading is drawn from its placeholder record
 * (`placeholderPeaks`) and is in no tracks array.
 *
 * Identities are kept as `derivePeaks` keeps them, because they are compared
 * downstream: a track that holds no loading clip is the arrangement's own
 * object; a track that holds one gives the same projection for as long as the
 * arrangement hands back the same track object; and the result is the same
 * array while no element changed. Nothing here writes to the arrangement's
 * objects (they are frozen in development).
 */
import { isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, ClipTrack } from '@waveform-playlist/core';
import { sameItems } from './sameItems';

export interface LoadedTracksCache {
  /** The projection of each arrangement track of the last pass. */
  readonly byTrack: ReadonlyMap<ArrangementTrack, ClipTrack>;
  readonly result: readonly ClipTrack[];
}

export const EMPTY_LOADED_TRACKS: LoadedTracksCache = { byTrack: new Map(), result: [] };

function projection(track: ArrangementTrack, previous: LoadedTracksCache): ClipTrack {
  if (!track.clips.some(isLoadingClip)) {
    // Every clip is loaded: the track is a `ClipTrack` as it is.
    return track as ClipTrack;
  }
  const known = previous.byTrack.get(track);
  if (known) return known;
  const clips = track.clips.filter((clip): clip is AudioClip => !isLoadingClip(clip));
  return { ...track, clips };
}

/**
 * `tracks` without their loading clips, reusing `cache` (the previous pass).
 * Keep the returned cache and pass it to the next call.
 */
export function loadedTracks(
  tracks: readonly ArrangementTrack[],
  cache: LoadedTracksCache
): { tracks: readonly ClipTrack[]; cache: LoadedTracksCache } {
  const byTrack = new Map<ArrangementTrack, ClipTrack>();
  const projected = tracks.map((track) => {
    const loaded = projection(track, cache);
    byTrack.set(track, loaded);
    return loaded;
  });
  const result = sameItems(cache.result, projected) ? cache.result : projected;
  return { tracks: result, cache: { byTrack, result } };
}
