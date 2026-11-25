import type {
  AnnotationAction,
  AnnotationActionOptions,
  AnnotationData,
} from '@waveform-playlist/core';

function copyAnnotation(annotation: AnnotationData): AnnotationData {
  return { ...annotation, lines: [...annotation.lines] };
}

/** The same fields with the same values, `lines` compared element by element. */
function sameAnnotation(a: AnnotationData, b: AnnotationData): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const x = (a as unknown as Record<string, unknown>)[key];
    const y = (b as unknown as Record<string, unknown>)[key];
    if (key === 'lines' && Array.isArray(x) && Array.isArray(y)) {
      if (x.length !== y.length || x.some((line, i) => line !== y[i])) return false;
    } else if (x !== y) {
      return false;
    }
  }
  return true;
}

/**
 * Run a list control's `action` for the annotation with `id` on `current`,
 * the store's list as it is now, and return the list to store.
 *
 * An action changes the list and the annotation objects in place (the
 * example page's split sets `annotation.end`), and the store's objects are
 * frozen in development, so the action gets a new array of copies: each
 * annotation with its own `lines`. Afterwards every copy that is still equal
 * to its original is replaced by the original, so rows compared by object do
 * not re-render for annotations the action did not touch. `index` is the
 * position of `id` in `current`. Returns `current` itself when `id` is not
 * in it or the action changed nothing.
 */
export function runAnnotationAction(
  current: readonly AnnotationData[],
  id: string,
  control: AnnotationAction,
  options: AnnotationActionOptions
): readonly AnnotationData[] {
  const index = current.findIndex((annotation) => annotation.id === id);
  if (index < 0) return current;

  const copies = current.map(copyAnnotation);
  const originalOf = new Map(copies.map((copy, i) => [copy, current[i]]));
  control.action(copies[index], index, copies, options);

  const result = copies.map((copy) => {
    const original = originalOf.get(copy);
    return original && sameAnnotation(copy, original) ? original : copy;
  });
  const unchanged =
    result.length === current.length && result.every((annotation, i) => annotation === current[i]);
  return unchanged ? current : result;
}
