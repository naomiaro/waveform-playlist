/**
 * A `<daw-clip>` the page moves into another `<daw-track>` of the same
 * editor (#848, the maintainer's choice a). Like a `<track>` moved to another
 * `<video>`, its clip leaves the old track and enters the new one, as it is
 * (its times, its audio), in one undo step. On `dev` the new track took the
 * clip and the old one kept it.
 */
import type { Arrangement } from '@waveform-playlist/engine';
import type { TrackKind } from '@waveform-playlist/core';
import { clipKindError } from './track-entry';

/** The track of an arrangement that holds a clip, other than `exceptTrackId`. */
export function trackHoldingClip(
  arrangement: Arrangement,
  clipId: string,
  exceptTrackId: string
): string | null {
  const track = arrangement
    .getTracks()
    .find((t) => t.id !== exceptTrackId && t.clips.some((c) => c.id === clipId));
  return track?.id ?? null;
}

/**
 * Move a clip from one track to another: one undo step (a transaction).
 * Returns the error that refused it (a clip of the other kind) and changes
 * nothing then.
 */
export function moveClipToTrack(
  arrangement: Arrangement,
  fromTrackId: string,
  toTrackId: string,
  clipId: string,
  toKind: TrackKind
): Error | null {
  const tracks = arrangement.getTracks();
  const clip = tracks.find((t) => t.id === fromTrackId)?.clips.find((c) => c.id === clipId);
  const to = tracks.find((t) => t.id === toTrackId);
  if (!clip || !to) return new Error('clip "' + clipId + '" or track "' + toTrackId + '" is gone');
  const isMidi = 'midiNotes' in clip && clip.midiNotes != null;
  const kindError = clipKindError(to.name ?? '', toKind, isMidi, clip.name || clipId);
  if (kindError) return kindError;
  arrangement.beginTransaction();
  try {
    arrangement.updateTrack(fromTrackId, (t) => ({
      ...t,
      clips: t.clips.filter((c) => c.id !== clipId),
    }));
    arrangement.updateTrack(toTrackId, (t) => ({ ...t, clips: [...t.clips, clip] }));
  } catch (err) {
    arrangement.abortTransaction();
    return err instanceof Error ? err : new Error(String(err));
  }
  arrangement.commitTransaction();
  return null;
}
