/**
 * The mixer part of an arrangement: volume, mute, solo and pan by track id,
 * as pure functions over an immutable Map.
 *
 * The values live here and not on the track objects, so a fader move
 * replaces no track. The current Map holds an entry for each current track;
 * each saved state of the history holds its own Map (#843). A track's own
 * `volume` / `muted` / `soloed` / `pan` fields are the values it ENTERED
 * with; they seed its entry when its id has none, and are not read while it
 * has one.
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
 * A track is given a new id: its mix goes with it, and the old id's entry
 * goes (no current track has that id any more). The same Map when the old id
 * has no entry or the id does not change.
 */
export function carryMixerEntry(mixer: Mixer, fromId: string, toId: string): Mixer {
  const entry = mixer.get(fromId);
  if (!entry || fromId === toId) return mixer;
  // In the old id's place, so the order of the entries stays the order of the tracks.
  return new Map(
    [...mixer]
      .filter(([id]) => id !== toId)
      .map(([id, values]): [string, TrackMixerValues] => [id === fromId ? toId : id, values])
  );
}

/**
 * The entries of exactly these tracks: an id that has an entry keeps it, one
 * that has none is seeded from the track's fields, every other entry is
 * dropped. The same Map when nothing changes.
 */
export function mixerOf(mixer: Mixer, tracks: readonly ArrangementTrack[]): Mixer {
  const ids = new Set(tracks.map((track) => track.id));
  const seeded = seedMixer(mixer, tracks);
  if (seeded.size === ids.size) return seeded;
  return new Map([...seeded].filter(([id]) => ids.has(id)));
}

/** A Map without the entry of `trackId`. The same Map when there is none. */
export function withoutEntry(mixer: Mixer, trackId: string): Mixer {
  if (!mixer.has(trackId)) return mixer;
  const next = new Map(mixer);
  next.delete(trackId);
  return next;
}

function sameValues(a: TrackMixerValues, b: TrackMixerValues): boolean {
  return a.volume === b.volume && a.muted === b.muted && a.soloed === b.soloed && a.pan === b.pan;
}

/** The same ids with the same values (compared by value, not by Map or entry identity). */
export function sameMixerValues(a: Mixer, b: Mixer): boolean {
  if (a === b) return true;
  if (a.size !== b.size) return false;
  for (const [id, values] of a) {
    const other = b.get(id);
    if (!other || !sameValues(values, other)) return false;
  }
  return true;
}

/**
 * For each id that has an entry in both Maps, the fields whose value differs
 * (from `after`). An id in only one of them is a track that entered or left
 * with its whole mix, and is not listed.
 */
export function mixerChanges(
  before: Mixer,
  after: Mixer
): Array<{ trackId: string; values: Partial<TrackMixerValues> }> {
  if (before === after) return [];
  const changes: Array<{ trackId: string; values: Partial<TrackMixerValues> }> = [];
  for (const [trackId, now] of after) {
    const was = before.get(trackId);
    if (!was || was === now) continue;
    const values: Partial<TrackMixerValues> = {};
    if (was.volume !== now.volume) values.volume = now.volume;
    if (was.muted !== now.muted) values.muted = now.muted;
    if (was.soloed !== now.soloed) values.soloed = now.soloed;
    if (was.pan !== now.pan) values.pan = now.pan;
    if (Object.keys(values).length > 0) changes.push({ trackId, values });
  }
  return changes;
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
