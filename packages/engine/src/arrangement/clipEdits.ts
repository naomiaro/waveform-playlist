/**
 * Clip edits as pure functions over a tracks array: each returns the new
 * array (only the edited track and clip are new objects), or null when the
 * edit changes nothing. The arrangement decides about history, versions and
 * announcements.
 */

import type { ArrangementTrack, AudioClip, LoadingClip } from '@waveform-playlist/core';
import { isLoadingClip, sortClipsByTime } from '@waveform-playlist/core';
import {
  constrainClipDrag,
  constrainBoundaryTrim,
  canSplitAt,
  splitClip as splitClipOp,
} from '../operations/clipOperations';
import type { ClipBounds } from './types';

type Tracks = readonly ArrangementTrack[];
type AnyClip = AudioClip | LoadingClip;

/** What an edit needs to know about time. */
export interface ClipEditTime {
  /** The tick of a sample position; undefined when there is no engine to convert with. */
  tickAt(startSample: number): number | undefined;
  /** The shortest this clip may be, in samples. */
  minDuration(clip: AudioClip): number;
}

interface Found {
  track: ArrangementTrack;
  clip: AudioClip;
  /** Its place among ALL the track's clips, loading ones included. */
  clipIndex: number;
}

/** The clips an edit can touch or collide with. One that is still loading has no samples yet. */
function loadedClips(track: ArrangementTrack): AudioClip[] {
  return track.clips.filter((clip): clip is AudioClip => !isLoadingClip(clip));
}

/** The loaded clip of that id, or undefined (also for a clip that is still loading). */
function loadedClip(tracks: Tracks, trackId: string, clipId: string): AudioClip | undefined {
  const clip = tracks.find((t) => t.id === trackId)?.clips.find((c) => c.id === clipId);
  return clip && !isLoadingClip(clip) ? clip : undefined;
}

/** The clip, or null with a warning naming the operation that asked. */
function findClip(
  tracks: Tracks,
  trackId: string,
  clipId: string,
  operation: string
): Found | null {
  const track = tracks.find((t) => t.id === trackId);
  if (!track) {
    console.warn(`[waveform-playlist/engine] ${operation}: track "${trackId}" not found`);
    return null;
  }
  const clipIndex = track.clips.findIndex((c) => c.id === clipId);
  if (clipIndex === -1) {
    console.warn(
      `[waveform-playlist/engine] ${operation}: clip "${clipId}" not found in track "${trackId}"`
    );
    return null;
  }
  const clip = track.clips[clipIndex];
  if (isLoadingClip(clip)) {
    console.warn(
      `[waveform-playlist/engine] ${operation}: clip "${clipId}" in track "${trackId}" is still loading ` +
        'and cannot be edited until its audio has loaded'
    );
    return null;
  }
  return { track, clip, clipIndex };
}

/** `tracks` with the clips of one track replaced. */
function withTrackClips(tracks: Tracks, trackId: string, clips: AnyClip[]): Tracks {
  return tracks.map((t) => (t.id === trackId ? { ...t, clips } : t));
}

/** A clip's full bounds for trim constraint computation. Null if not found. */
export function clipBounds(tracks: Tracks, trackId: string, clipId: string): ClipBounds | null {
  const clip = loadedClip(tracks, trackId, clipId);
  if (!clip) return null;
  return {
    offsetSamples: clip.offsetSamples,
    durationSamples: clip.durationSamples,
    startSample: clip.startSample,
    sourceDurationSamples: clip.sourceDurationSamples,
  };
}

/** How far a trim may go, from the clip's current state and its neighbours. 0 if not found. */
export function constrainTrim(
  tracks: Tracks,
  trackId: string,
  clipId: string,
  boundary: 'left' | 'right',
  deltaSamples: number,
  time: ClipEditTime
): number {
  const track = tracks.find((t) => t.id === trackId);
  const clip = loadedClip(tracks, trackId, clipId);
  if (!track || !clip) return 0;
  const sortedClips = sortClipsByTime(loadedClips(track));
  const sortedIndex = sortedClips.findIndex((c: AudioClip) => c.id === clipId);
  return constrainBoundaryTrim(
    clip,
    deltaSamples,
    boundary,
    sortedClips,
    sortedIndex,
    time.minDuration(clip)
  );
}

/** Move a clip. Null when it cannot move; otherwise the tracks and the delta applied. */
export function moveClip(
  tracks: Tracks,
  trackId: string,
  clipId: string,
  deltaSamples: number,
  time: ClipEditTime
): { tracks: Tracks; delta: number } | null {
  const found = findClip(tracks, trackId, clipId, 'moveClip');
  if (!found) return null;
  const { track, clip, clipIndex } = found;
  const sortedClips = sortClipsByTime(loadedClips(track));
  const sortedIndex = sortedClips.findIndex((c: AudioClip) => c.id === clipId);
  const delta = constrainClipDrag(clip, deltaSamples, sortedClips, sortedIndex);
  if (delta === 0) return null;

  const startSample = Math.floor(clip.startSample + delta);
  const moved: AudioClip = {
    ...clip,
    startSample,
    startTick: clip.startTick !== undefined ? time.tickAt(startSample) : undefined,
  };
  const clips = track.clips.map((c, i) => (i === clipIndex ? moved : c));
  return { tracks: withTrackClips(tracks, trackId, clips), delta };
}

/** Trim one edge of a clip. Null when nothing changes. */
export function trimClip(
  tracks: Tracks,
  trackId: string,
  clipId: string,
  boundary: 'left' | 'right',
  deltaSamples: number,
  time: ClipEditTime
): Tracks | null {
  const found = findClip(tracks, trackId, clipId, 'trimClip');
  if (!found) return null;
  const { track, clip, clipIndex } = found;
  const constrained = constrainTrim(tracks, trackId, clipId, boundary, deltaSamples, time);
  if (constrained === 0) return null;

  let trimmed: AudioClip;
  if (boundary === 'left') {
    const startSample = clip.startSample + constrained;
    trimmed = {
      ...clip,
      startSample,
      startTick: clip.startTick !== undefined ? time.tickAt(startSample) : undefined,
      offsetSamples: clip.offsetSamples + constrained,
      durationSamples: clip.durationSamples - constrained,
    };
  } else {
    trimmed = { ...clip, durationSamples: clip.durationSamples + constrained };
  }
  const clips = track.clips.map((c, i) => (i === clipIndex ? trimmed : c));
  return withTrackClips(tracks, trackId, clips);
}

/** Split a clip in two at a sample. Null (with a warning) when it cannot be split there. */
export function splitClip(
  tracks: Tracks,
  trackId: string,
  clipId: string,
  atSample: number,
  time: ClipEditTime
): Tracks | null {
  const found = findClip(tracks, trackId, clipId, 'splitClip');
  if (!found) return null;
  const { track, clip, clipIndex } = found;
  const minDuration = time.minDuration(clip);
  if (!canSplitAt(clip, atSample, minDuration)) {
    console.warn(
      `[waveform-playlist/engine] splitClip: cannot split clip "${clipId}" at sample ${atSample} ` +
        `(clip range: ${clip.startSample}–${clip.startSample + clip.durationSamples}, minDuration: ${minDuration})`
    );
    return null;
  }

  const { left, right } = splitClipOp(clip, atSample);
  // Give the halves a startTick if the original had one
  const withTick = (half: AudioClip): AudioClip =>
    clip.startTick !== undefined ? { ...half, startTick: time.tickAt(half.startSample) } : half;
  const clips: AnyClip[] = [...track.clips];
  clips.splice(clipIndex, 1, withTick(left), withTick(right));
  return withTrackClips(tracks, trackId, clips);
}
