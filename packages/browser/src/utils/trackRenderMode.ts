import { trackKind } from '@waveform-playlist/core';
import type { ClipTrack, RenderMode } from '@waveform-playlist/core';

/**
 * The render mode of a track: the spectrogram override for it, else its own
 * `renderMode`, else a waveform. Render modes are for audio tracks. A MIDI
 * track is drawn as a piano roll from its kind (#756), so it always gets
 * `'waveform'` here, which keeps the spectrogram machinery away from it.
 */
export function trackRenderMode(
  track: Pick<ClipTrack, 'kind' | 'renderMode'>,
  override?: RenderMode
): RenderMode {
  if (trackKind(track) === 'midi') return 'waveform';
  return override ?? track.renderMode ?? 'waveform';
}
