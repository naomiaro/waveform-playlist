/**
 * Checks a track must pass before it enters an arrangement. Each throws
 * before anything has changed (#756).
 */

import { assertTrackKind, isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip } from '@waveform-playlist/core';

/**
 * A track holds audio clips or MIDI clips, never both (#756). A clip that is
 * still loading is neither yet and is not checked: on a MIDI track it is
 * never loaded, and it is reported where the sources are.
 */
export function assertLoadedClipsOfTrackKind(track: ArrangementTrack): void {
  const loaded = track.clips.filter((clip): clip is AudioClip => !isLoadingClip(clip));
  assertTrackKind({ ...track, clips: loaded });
}

/** Readers address a clip by its id within its track, so two clips of one id cannot be told apart. */
export function assertUniqueClipIds(track: ArrangementTrack): void {
  const seen = new Set<string>();
  for (const clip of track.clips) {
    if (seen.has(clip.id)) {
      throw new Error(
        `[waveform-playlist] Track "${track.id}" has a duplicate clip id "${clip.id}". ` +
          'Clip ids must be unique within a track.'
      );
    }
    seen.add(clip.id);
  }
}

/** Mixer values, adapter nodes and every edit are keyed by track id. */
export function assertUniqueTrackIds(tracks: readonly ArrangementTrack[]): void {
  const seen = new Set<string>();
  for (const track of tracks) {
    if (seen.has(track.id)) throw duplicateTrackId(track.id);
    seen.add(track.id);
  }
}

export function duplicateTrackId(trackId: string): Error {
  return new Error(
    `[waveform-playlist] Duplicate track id "${trackId}". Track ids must be unique in an arrangement.`
  );
}
