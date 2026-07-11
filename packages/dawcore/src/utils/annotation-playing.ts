import type { AnnotationData } from '@waveform-playlist/core';

/**
 * Playing annotation = first annotation (in start-sorted order) where
 * `start <= time < end`. Returns `null` when `time` falls in a gap between
 * annotations (or before/after all of them).
 *
 * Shared by <daw-annotation-list> and AnnotationController so the lane and
 * the list agree on identical playback-highlight semantics. Seconds domain
 * only — callers pass the view's already-derived seconds cache, which is
 * correct for tick-based annotations too (AnnotationController.deriveSecondsCaches
 * keeps it fresh).
 */
export function computePlayingAnnotationId(
  annotations: readonly AnnotationData[],
  time: number
): string | null {
  const match = annotations.find((a) => a.start <= time && time < a.end);
  return match?.id ?? null;
}
