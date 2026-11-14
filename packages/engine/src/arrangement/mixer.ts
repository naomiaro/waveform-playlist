/**
 * The mixer part of an arrangement: volume, mute, solo and pan by track id,
 * as pure functions over an immutable Map.
 *
 * The values live here and not on the track objects, so a fader move
 * replaces no track, and an undo (which restores tracks) never changes the
 * mix. A track's own `volume` / `muted` / `soloed` / `pan` fields are the
 * values it ENTERED with; they seed its entry when its id has none, and are
 * not read while it has one.
 */

import type { ArrangementTrack } from '@waveform-playlist/core';

export interface TrackMixerValues {
  volume: number;
  muted: boolean;
  soloed: boolean;
  pan: number;
}

export type Mixer = ReadonlyMap<string, TrackMixerValues>;

export const EMPTY_MIXER: Mixer = new Map();

const DEFAULT_VOLUME = 1;
const DEFAULT_PAN = 0;

/** The mixer values a track carries in its own fields (defaults for a field it lacks). */
export function mixerValuesOf(track: ArrangementTrack): TrackMixerValues {
  return {
    volume: track.volume ?? DEFAULT_VOLUME,
    muted: track.muted ?? false,
    soloed: track.soloed ?? false,
    pan: track.pan ?? DEFAULT_PAN,
  };
}

/**
 * Entries for the tracks that have none yet, from their own fields. An id
 * that already has an entry keeps it. The same Map when nothing was added.
 */
export function seedMixer(mixer: Mixer, tracks: readonly ArrangementTrack[]): Mixer {
  let next: Map<string, TrackMixerValues> | null = null;
  for (const track of tracks) {
    if ((next ?? mixer).has(track.id)) continue;
    if (!next) next = new Map(mixer);
    next.set(track.id, mixerValuesOf(track));
  }
  return next ?? mixer;
}

/**
 * A Map in which the entry of `trackId` has `patch` applied. The same Map
 * when there is no such entry.
 */
export function setMixerValues(
  mixer: Mixer,
  trackId: string,
  patch: Partial<TrackMixerValues>
): Mixer {
  const entry = mixer.get(trackId);
  if (!entry) return mixer;
  return new Map(mixer).set(trackId, { ...entry, ...patch });
}

/**
 * A track is given a new id: its mix goes with it, also over an entry the
 * new id still has from a removed track. The same Map when the old id has no
 * entry.
 */
export function carryMixerEntry(mixer: Mixer, fromId: string, toId: string): Mixer {
  const entry = mixer.get(fromId);
  if (!entry || mixer.get(toId) === entry) return mixer;
  return new Map(mixer).set(toId, entry);
}

/**
 * Only the entries of tracks that one of `states` holds. The same Map when
 * every entry is still held.
 */
export function retainMixer(mixer: Mixer, states: Iterable<readonly ArrangementTrack[]>): Mixer {
  const held = new Set<string>();
  for (const tracks of states) {
    for (const track of tracks) held.add(track.id);
  }
  if ([...mixer.keys()].every((id) => held.has(id))) return mixer;
  return new Map([...mixer].filter(([id]) => held.has(id)));
}

/**
 * The track with the entry's values in its fields: what an adapter is sent.
 * The same track when its fields already hold them.
 */
export function withMixerValues<T extends ArrangementTrack>(
  track: T,
  values: TrackMixerValues | undefined
): T {
  if (
    !values ||
    (track.volume === values.volume &&
      track.muted === values.muted &&
      track.soloed === values.soloed &&
      track.pan === values.pan)
  ) {
    return track;
  }
  return { ...track, ...values };
}
