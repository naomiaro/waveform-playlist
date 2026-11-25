import type { AnnotationData } from '../types';

/** New bounds for the annotation with `id`. */
export interface AnnotationBoundsChange {
  id: string;
  start: number;
  end: number;
}

/**
 * Write `start` and `end` of each change onto the annotation with that id in
 * `current`. Every other field, and every annotation no change names, is kept
 * as it is (the same object). An id that is not in `current` is skipped.
 *
 * Returns `current` itself when nothing changes, so an `update` with it
 * notifies nobody.
 */
export function applyAnnotationBounds(
  current: readonly AnnotationData[],
  changes: readonly AnnotationBoundsChange[]
): readonly AnnotationData[] {
  if (changes.length === 0) return current;
  const byId = new Map(changes.map((change) => [change.id, change]));
  let changed = false;
  const next = current.map((annotation) => {
    const change = byId.get(annotation.id);
    if (!change || (change.start === annotation.start && change.end === annotation.end)) {
      return annotation;
    }
    changed = true;
    return { ...annotation, start: change.start, end: change.end };
  });
  return changed ? next : current;
}
