import { isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, ClipTrack } from '@waveform-playlist/core';

/**
 * An arrangement's tracks (the same array), typed as tracks of loaded clips,
 * for tests whose fixtures hold no loading clip. Throws if one does.
 */
export function loaded(arrangement: {
  getTracks(): readonly ArrangementTrack[];
}): readonly ClipTrack[] {
  const tracks = arrangement.getTracks();
  if (tracks.some((track) => track.clips.some(isLoadingClip))) {
    throw new Error('loaded(): this arrangement holds a loading clip');
  }
  return tracks as readonly ClipTrack[];
}
