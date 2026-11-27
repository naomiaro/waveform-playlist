import { trackKind } from '@waveform-playlist/core';
import type { ClipTrack, RenderMode } from '@waveform-playlist/core';

/**
 * The render mode of a track: its own `renderMode`, else a waveform (the
 * track menu and `useTrack().setRenderMode` change the track's field, #814).
 * Render modes are for audio tracks. A MIDI track is drawn as a piano roll
 * from its kind (#756), so it always gets `'waveform'` here, which keeps the
 * spectrogram machinery away from it.
 */
export function trackRenderMode(track: Pick<ClipTrack, 'kind' | 'renderMode'>): RenderMode {
  if (trackKind(track) === 'midi') return 'waveform';
  return track.renderMode ?? 'waveform';
}
