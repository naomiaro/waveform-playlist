/**
 * Clip ticks across engines.
 *
 * A clip's `startTick` is a count of an engine's ticks: its unit is that
 * engine's ppqn (ticks per quarter note). The arrangement outlives an engine,
 * so when an engine with another ppqn takes over, every stored tick is
 * converted to the new unit, in the current tracks and in every state the
 * arrangement can return to. Sample positions are not touched.
 */

import { isLoadingClip } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, LoadingClip } from '@waveform-playlist/core';

type Tracks = readonly ArrangementTrack[];
type AnyClip = AudioClip | LoadingClip;
type ClipChange = (clip: AnyClip) => AnyClip;

/** `change` for the loaded clips; a clip that is still loading (it has no samples and no tick) is left as it is. */
export function forLoadedClips(change: (clip: AudioClip) => AudioClip): ClipChange {
  return (clip) => (isLoadingClip(clip) ? clip : change(clip));
}

/** The track with `change` applied to each clip; the same track when no clip changed. */
export function withClips(track: ArrangementTrack, change: ClipChange): ArrangementTrack {
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
export function clipMapper(change: ClipChange): (tracks: Tracks) => Tracks {
  const mapped = new Map<ArrangementTrack, ArrangementTrack>();
  const mapTrack = (track: ArrangementTrack): ArrangementTrack => {
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

/**
 * What an engine that attaches does to every state: a clip without a
 * `startTick` gets one from its `startSample`, and a tick counted in another
 * engine's ppqn (`fromPpqn`; null when no engine has attached yet) is
 * converted to this one's. Sample positions are not touched.
 */
export function tickPreparer(
  timeBase: { sampleRate: number; ppqn: number; secondsToTicks(seconds: number): number },
  fromPpqn: number | null
): (tracks: Tracks) => Tracks {
  return clipMapper(
    forLoadedClips((clip) => {
      if (clip.startTick === undefined) {
        const startTick = timeBase.secondsToTicks(clip.startSample / timeBase.sampleRate);
        return { ...clip, startTick };
      }
      if (fromPpqn === null || fromPpqn === timeBase.ppqn) return clip;
      const startTick = rescaleTick(clip.startTick, fromPpqn, timeBase.ppqn);
      return startTick === clip.startTick ? clip : { ...clip, startTick };
    })
  );
}

/** A tick counted in `fromPpqn`, as the nearest tick in `toPpqn`. */
export function rescaleTick(tick: number, fromPpqn: number, toPpqn: number): number {
  return Math.round((tick * toPpqn) / fromPpqn);
}
