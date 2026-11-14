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
 * A function that converts the ticks of a tracks array from `fromPpqn` to
 * `toPpqn`, rounding to the nearest tick. It remembers each track it has
 * converted, so states that shared a track object go on sharing one, and it
 * returns the same array when nothing in it changed.
 */
export function tickConverter(fromPpqn: number, toPpqn: number): (tracks: Tracks) => Tracks {
  const converted = new Map<ClipTrack, ClipTrack>();
  const convertTrack = (track: ClipTrack): ClipTrack => {
    const known = converted.get(track);
    if (known) return known;
    const next = withClips(track, (clip) => {
      if (clip.startTick === undefined) return clip;
      const startTick = Math.round((clip.startTick * toPpqn) / fromPpqn);
      return startTick === clip.startTick ? clip : { ...clip, startTick };
    });
    converted.set(track, next);
    return next;
  };
  return (tracks) => {
    const next = tracks.map(convertTrack);
    return next.some((track, i) => track !== tracks[i]) ? next : tracks;
  };
}
