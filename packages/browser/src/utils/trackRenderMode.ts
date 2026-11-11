import { trackKind } from '@waveform-playlist/core';
import type { ClipTrack, RenderMode } from '@waveform-playlist/core';

/**
 * How a track is drawn. The kind decides first (#756): a MIDI track is a piano
 * roll and an audio track never is. An audio track then takes the spectrogram
 * override for it, else its own `renderMode`, else a waveform.
 */
export function trackRenderMode(
  track: Pick<ClipTrack, 'kind' | 'renderMode'>,
  override?: RenderMode
): RenderMode {
  if (trackKind(track) === 'midi') return 'piano-roll';
  const mode = override ?? track.renderMode ?? 'waveform';
  return mode === 'piano-roll' ? 'waveform' : mode;
}
