/**
 * Clip ticks across engines.
 *
 * A clip's `startTick` is a count of an engine's ticks: its unit is that
 * engine's ppqn (ticks per quarter note). The arrangement outlives an engine,
 * so when an engine with another ppqn takes over, every stored tick is
 * converted to the new unit, in the current tracks and in every state the
 * arrangement can return to. Sample positions are not touched.
 */

import type { AudioClip, ClipTrack } from '@waveform-playlist/core';

type Tracks = readonly ClipTrack[];

/** The track with `change` applied to each clip; the same track when no clip changed. */
export function withClips(track: ClipTrack, change: (clip: AudioClip) => AudioClip): ClipTrack {
  let changed = false;
  const clips = track.clips.map((clip) => {
    const next = change(clip);
    if (next !== clip) changed = true;
    return next;
  });
  return changed ? { ...track, clips } : track;
}

/**
 * A function that applies `change` to every clip of a tracks array. It
 * remembers each track it has mapped, so states that shared a track object
 * go on sharing one, and it returns the same array when nothing in it
 * changed.
 */
export function clipMapper(change: (clip: AudioClip) => AudioClip): (tracks: Tracks) => Tracks {
  const mapped = new Map<ClipTrack, ClipTrack>();
  const mapTrack = (track: ClipTrack): ClipTrack => {
    const known = mapped.get(track);
    if (known) return known;
    const next = withClips(track, change);
    mapped.set(track, next);
    return next;
  };
  return (tracks) => {
    const next = tracks.map(mapTrack);
    return next.some((track, i) => track !== tracks[i]) ? next : tracks;
  };
}

/** A tick counted in `fromPpqn`, as the nearest tick in `toPpqn`. */
export function rescaleTick(tick: number, fromPpqn: number, toPpqn: number): number {
  return Math.round((tick * toPpqn) / fromPpqn);
}
