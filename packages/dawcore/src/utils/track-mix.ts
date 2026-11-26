/**
 * A track's mix (volume, pan, mute, solo) as `<daw-editor>` reads it (#843).
 * The arrangement owns the mix of every track it holds; until a track enters
 * it, the editor holds the values the track will start with (the seed).
 */
import type { ClipTrack } from '@waveform-playlist/core';
import type { TrackMixerValues } from '@waveform-playlist/engine';

export const DEFAULT_TRACK_MIX: Readonly<TrackMixerValues> = Object.freeze({
  volume: 1,
  pan: 0,
  muted: false,
  soloed: false,
});

/** The mix fields of an engine track (the projection: `muted` includes a take's mute). */
export function mixOfTrack(track: ClipTrack): TrackMixerValues {
  return { volume: track.volume, pan: track.pan, muted: track.muted, soloed: track.soloed };
}

/** The mix a `<daw-track>` element (or anything with the four fields) asks for. */
export function mixOfElement(el: TrackMixerValues): TrackMixerValues {
  return { volume: el.volume, pan: el.pan, muted: el.muted, soloed: el.soloed };
}

/**
 * The fields of `mix` whose names are in `names` (a `daw-track-update`'s
 * `changed` list): the mixer properties an update changed, and no other.
 */
export function pickMix(mix: TrackMixerValues, names: Iterable<string>): Partial<TrackMixerValues> {
  const named = new Set(names);
  return {
    ...(named.has('volume') && { volume: mix.volume }),
    ...(named.has('pan') && { pan: mix.pan }),
    ...(named.has('muted') && { muted: mix.muted }),
    ...(named.has('soloed') && { soloed: mix.soloed }),
  };
}

/** `track` with `mix` written over its mixer fields (a new object). */
export function withMix(track: ClipTrack, mix: TrackMixerValues): ClipTrack {
  return { ...track, ...mixOfElement(mix) };
}

/** A control's value as a number within [min, max]. */
export function clampNumber(value: unknown, min: number, max: number): number {
  return Math.max(min, Math.min(max, Number(value)));
}
