import type { AnnotationData } from '@waveform-playlist/core';

/** Edges closer than this (10 ms) count as linked. */
const LINK_THRESHOLD = 0.01;
/** The shortest an annotation can be made by a boundary key. */
const MIN_LENGTH = 0.1;

/**
 * Move the start of `list[index]` by `delta` seconds, as the `[` and `]` keys
 * do: clamped to 0 and to `MIN_LENGTH` before the end. With linked endpoints
 * the previous annotation's end follows when it touched; without, it is
 * pushed back when the new start would overlap it. Returns a new list.
 */
export function moveAnnotationStart(
  list: readonly AnnotationData[],
  index: number,
  delta: number,
  { linkEndpoints }: { linkEndpoints: boolean }
): readonly AnnotationData[] {
  const annotation = list[index];
  const newStart = Math.max(0, Math.min(annotation.end - MIN_LENGTH, annotation.start + delta));
  const actualDelta = newStart - annotation.start;

  const updated = [...list];
  updated[index] = { ...annotation, start: newStart };

  if (linkEndpoints && index > 0) {
    const prev = updated[index - 1];
    if (Math.abs(prev.end - annotation.start) < LINK_THRESHOLD) {
      // Already linked: move the previous annotation's end together.
      updated[index - 1] = {
        ...prev,
        end: Math.max(prev.start + MIN_LENGTH, prev.end + actualDelta),
      };
    }
  } else if (!linkEndpoints && index > 0) {
    // Not linked: do not overlap the previous annotation.
    const prev = updated[index - 1];
    if (newStart < prev.end) {
      updated[index - 1] = { ...prev, end: newStart };
    }
  }
  return updated;
}

/**
 * Move the end of `list[index]` by `delta` seconds, as the `{` and `}` keys
 * do: clamped to `duration` and to `MIN_LENGTH` after the start. With linked
 * endpoints the next annotation's start follows when it touched, and the
 * change cascades along a chain of linked edges; without, the next
 * annotations are pushed forward when they would overlap. Returns a new list.
 */
export function moveAnnotationEnd(
  list: readonly AnnotationData[],
  index: number,
  delta: number,
  { linkEndpoints, duration }: { linkEndpoints: boolean; duration: number }
): readonly AnnotationData[] {
  const annotation = list[index];
  const newEnd = Math.max(
    annotation.start + MIN_LENGTH,
    Math.min(duration, annotation.end + delta)
  );
  const actualDelta = newEnd - annotation.end;

  const updated = [...list];
  updated[index] = { ...annotation, end: newEnd };

  if (linkEndpoints && index < list.length - 1) {
    const next = updated[index + 1];
    if (Math.abs(next.start - annotation.end) < LINK_THRESHOLD) {
      // Already linked: move the next annotation's start together.
      updated[index + 1] = {
        ...next,
        start: Math.min(next.end - MIN_LENGTH, next.start + actualDelta),
      };

      // Cascade along linked edges.
      let current = index + 1;
      while (current < updated.length - 1) {
        const moved = updated[current];
        const following = updated[current + 1];
        if (Math.abs(following.start - list[current].end) < LINK_THRESHOLD) {
          const nextDelta = moved.end - list[current].end;
          updated[current + 1] = {
            ...following,
            start: Math.min(following.end - MIN_LENGTH, following.start + nextDelta),
          };
          current++;
        } else {
          break;
        }
      }
    }
  } else if (!linkEndpoints && index < list.length - 1) {
    // Not linked: do not overlap the next annotation.
    const next = updated[index + 1];
    if (newEnd > next.start) {
      updated[index + 1] = { ...next, start: newEnd };

      // Cascade collisions.
      let current = index + 1;
      while (current < updated.length - 1) {
        const pushed = updated[current];
        const following = updated[current + 1];
        if (pushed.end > following.start) {
          updated[current + 1] = { ...following, start: pushed.end };
          current++;
        } else {
          break;
        }
      }
    }
  }
  return updated;
}
