/**
 * The mixer state of the tracks (name, mute, solo, volume, pan), kept by track
 * id (#687). The provider holds one of these maps as state and derives the
 * public, positional `trackStates` array from it and the current `tracks`.
 *
 * By id, because a position is not an identity: with a positional array the
 * state stayed at its index when a track was removed, added in front or moved.
 * Every function returns a new map, or the one it was given when nothing
 * changed, and never changes a state object in place.
 */
import type { ClipTrack } from '@waveform-playlist/core';
import type { TrackState } from '../WaveformPlaylistContext';

export type TrackMixer = ReadonlyMap<string, TrackState>;

export const EMPTY_TRACK_MIXER: TrackMixer = new Map();

function stateFromTrack(track: ClipTrack): TrackState {
  return {
    name: track.name,
    muted: track.muted,
    soloed: track.soloed,
    volume: track.volume,
    pan: track.pan,
  };
}

/**
 * The map for a new list of tracks: a track the map knows keeps what the user
 * set and takes the track's current name; a new one starts from its
 * `ClipTrack` fields; one that is gone is dropped.
 */
export function mixerForTracks(previous: TrackMixer, tracks: readonly ClipTrack[]): TrackMixer {
  const next = new Map<string, TrackState>();
  let changed = previous.size !== tracks.length;
  for (const track of tracks) {
    const known = previous.get(track.id);
    if (known === undefined) {
      next.set(track.id, stateFromTrack(track));
      changed = true;
    } else if (known.name !== track.name) {
      next.set(track.id, { ...known, name: track.name });
      changed = true;
    } else {
      next.set(track.id, known);
    }
  }
  return changed ? next : previous;
}

/**
 * The map after tracks were appended to a running engine: `added` get a state
 * (unless they have one: an updater may run twice), `filled` (placeholders
 * whose audio arrived) take their new name.
 */
export function mixerWithAddedTracks(
  previous: TrackMixer,
  added: readonly ClipTrack[],
  filled: readonly ClipTrack[]
): TrackMixer {
  let next: Map<string, TrackState> | null = null;
  const writable = () => (next ??= new Map(previous));
  for (const track of filled) {
    const known = previous.get(track.id);
    if (known !== undefined && known.name !== track.name) {
      writable().set(track.id, { ...known, name: track.name });
    }
  }
  for (const track of added) {
    if (!previous.has(track.id)) {
      writable().set(track.id, stateFromTrack(track));
    }
  }
  return next ?? previous;
}

/** One track's state with some fields replaced. A track without state is left without. */
export function patchTrackState(
  previous: TrackMixer,
  trackId: string,
  patch: Partial<TrackState>
): TrackMixer {
  const known = previous.get(trackId);
  if (known === undefined) return previous;
  const keys = Object.keys(patch) as Array<keyof TrackState>;
  if (keys.every((key) => Object.is(known[key], patch[key]))) return previous;
  const next = new Map(previous);
  next.set(trackId, { ...known, ...patch });
  return next;
}

/**
 * The positional array the mixer context publishes: one entry per track, in
 * the order of `tracks`, `undefined` for a track that has no state yet (the
 * provider is still loading it). Returns `previousAligned` itself when every
 * entry is the same object, so a `tracks` change that touches no mixer state
 * (each move of a trim) does not change the context value.
 */
export function alignTrackStates(
  tracks: readonly ClipTrack[],
  mixer: TrackMixer,
  previousAligned: TrackState[]
): TrackState[] {
  // `undefined` entries: the public type has always promised `TrackState` for
  // an index that may not be loaded yet (the array used to be shorter).
  const aligned = tracks.map((track) => mixer.get(track.id)) as TrackState[];
  const same =
    aligned.length === previousAligned.length &&
    aligned.every((state, index) => state === previousAligned[index]);
  return same ? previousAligned : aligned;
}
