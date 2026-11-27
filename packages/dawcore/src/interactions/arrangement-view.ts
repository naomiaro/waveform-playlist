/**
 * What `<daw-editor>` draws and reports, read from its arrangement (#848):
 * the editor keeps no projection of the tracks. Pure functions; the one
 * cache (`loadedTrack`'s) is keyed by the arrangement's track objects and
 * never written back.
 */
import { isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, ClipTrack, LoadingClip } from '@waveform-playlist/core';
import type { Arrangement, TrackMixerValues } from '@waveform-playlist/engine';

interface Cached {
  mix: TrackMixerValues;
  recording: boolean;
  view: ClipTrack;
}

const views = new WeakMap<ArrangementTrack, Cached>();

function sameMix(a: TrackMixerValues, b: TrackMixerValues): boolean {
  return (
    a.volume === b.volume &&
    a.pan === b.pan &&
    a.muted === b.muted &&
    a.soloed === b.soloed &&
    a.panLaw === b.panLaw
  );
}

/**
 * A track as it is played: its loaded clips with the current mix (muted
 * while a take records onto it). The same object for the same track object
 * and the same mix, so a row whose track did not change is not drawn again.
 */
export function loadedTrack(
  track: ArrangementTrack,
  mix: TrackMixerValues,
  recording: boolean
): ClipTrack {
  const cached = views.get(track);
  if (cached && cached.recording === recording && sameMix(cached.mix, mix)) return cached.view;
  const view: ClipTrack = {
    ...track,
    clips: track.clips.filter((c): c is AudioClip => !isLoadingClip(c)),
    volume: mix.volume,
    pan: mix.pan,
    muted: mix.muted || recording,
    soloed: mix.soloed,
    // What both exports pan the track with (core's trackPanLaw, #684).
    panLaw: mix.panLaw,
  };
  views.set(track, { mix: { ...mix }, recording, view });
  return view;
}

/**
 * A track's mix from its one owner, the arrangement: the stored values,
 * muted while a take records onto it (as the engine plays it). Null for an
 * id the arrangement does not hold.
 */
export function mixOf(arrangement: Arrangement, trackId: string): TrackMixerValues | null {
  const mix = arrangement.getMixer().get(trackId);
  if (!mix) return null;
  return arrangement.recordingTrackIds.has(trackId) ? { ...mix, muted: true } : mix;
}

/** A clip's place in seconds, for a loaded clip and for one still loading (0 where unknown). */
export function clipSeconds(
  clip: AudioClip | LoadingClip,
  fallbackSampleRate: number
): { start: number; duration: number; offset: number } {
  if (isLoadingClip(clip)) {
    return { start: clip.start ?? 0, duration: clip.duration ?? 0, offset: clip.offset ?? 0 };
  }
  const sr = clip.sampleRate ?? fallbackSampleRate;
  return {
    start: clip.startSample / sr,
    duration: clip.durationSamples / sr,
    offset: clip.offsetSamples / sr,
  };
}
