/**
 * Whether a clip of the view's tracks (`usePlaylistTimeline().tracks`) is a
 * placeholder (#812): drawn while its audio loads, and not held by the engine.
 *
 * For the code that receives `ClipTrack[]` and not the peaks (split, export).
 * The view itself reads `ClipPeaks.isPlaceholder`. The two agree by
 * construction: the provider builds a placeholder with `src` and without an
 * `audioBuffer` (`placeholderClip` in `resolveTracks.ts`), and every clip it
 * resolves from a source gets both `src` and the buffer. A clip the app made
 * itself has no `src` (a peaks-only clip with `waveformData`, a recorded or
 * decoded clip), and a MIDI clip has `midiNotes`, so neither counts.
 */
import type { AudioClip } from '@waveform-playlist/core';

export function isPlaceholderClip(clip: AudioClip): boolean {
  return clip.src !== undefined && !clip.audioBuffer && clip.midiNotes == null;
}
