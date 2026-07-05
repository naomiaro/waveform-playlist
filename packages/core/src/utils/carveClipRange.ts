/**
 * Punch-in replace: carve a sample range out of a clip list.
 *
 * Used when a newly recorded clip lands at the playhead and must REPLACE any
 * existing clip content between its start and end (issue #579): partial
 * overlaps are trimmed, fully-covered clips are removed, and a clip that
 * spans the whole range is split into two.
 */

import type { AudioClip } from '../types/clip';

/**
 * Return a new clip list with the sample range [rangeStart, rangeEnd)
 * removed from every clip that overlaps it.
 *
 * - Clips outside the range are returned by reference (untouched).
 * - Clips fully inside the range are dropped.
 * - A clip overlapping only the range's start keeps its head (right-trim).
 * - A clip overlapping only the range's end keeps its tail: its start moves
 *   to rangeEnd and `offsetSamples` advances by the carved amount.
 * - A clip containing the whole range splits into head + tail; the tail is a
 *   new clip (deterministic id `<original>-carve-<rangeEnd>`) sharing the
 *   same audioBuffer.
 *
 * Clips whose `startSample` changes lose their `startTick` — a sample-space
 * carve cannot recompute ticks, and the engine re-enriches clips without
 * `startTick` on ingestion (see AudioClip.startTick).
 *
 * Pure and immutable: input clips are never mutated. An empty or inverted
 * range returns the input list unchanged.
 */
export function carveClipRange(
  clips: readonly AudioClip[],
  rangeStart: number,
  rangeEnd: number
): AudioClip[] {
  if (!(rangeEnd > rangeStart)) {
    return [...clips];
  }

  const result: AudioClip[] = [];

  for (const clip of clips) {
    const clipStart = clip.startSample;
    const clipEnd = clip.startSample + clip.durationSamples;

    // [start, end) overlap test — shared boundaries don't overlap
    if (clipEnd <= rangeStart || clipStart >= rangeEnd) {
      result.push(clip);
      continue;
    }

    const keepHead = clipStart < rangeStart;
    const keepTail = clipEnd > rangeEnd;

    if (keepHead) {
      result.push({
        ...clip,
        durationSamples: rangeStart - clipStart,
      });
    }

    if (keepTail) {
      const carvedFromClipStart = rangeEnd - clipStart;
      const tail: AudioClip = {
        ...clip,
        // Head + tail from one clip must not share an id
        id: keepHead ? `${clip.id}-carve-${rangeEnd}` : clip.id,
        startSample: rangeEnd,
        durationSamples: clipEnd - rangeEnd,
        offsetSamples: clip.offsetSamples + carvedFromClipStart,
      };
      // startSample changed — the stale authoritative tick position must not
      // survive (the engine re-derives it from startSample on ingestion).
      delete tail.startTick;
      result.push(tail);
    }

    // Neither head nor tail: fully covered, dropped.
  }

  return result;
}
