import { TRACK_VIEW_FIELDS } from '@waveform-playlist/core';
import type { ClipTrack, PlayoutTrack } from '@waveform-playlist/core';

/** A stored track as the adapter is given it: without core's view fields. */
export function withoutViewFields(track: ClipTrack): PlayoutTrack {
  const copy: Partial<ClipTrack> = { ...track };
  for (const field of TRACK_VIEW_FIELDS) delete copy[field];
  return copy as PlayoutTrack;
}
