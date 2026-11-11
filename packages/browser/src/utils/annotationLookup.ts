/**
 * Per-frame annotation lookups for the playback animation loops.
 *
 * Both lookups return exactly what the `Array.prototype.find` calls they replace
 * would return; they only avoid scanning the whole list on every frame.
 *
 * The list is treated as immutable: results are cached against the array's
 * identity, so a changed annotation must arrive in a new array (it does: the
 * providers hold annotations in React state).
 */
interface TimedAnnotation {
  readonly id: string;
  readonly start: number;
  readonly end: number;
}

export interface AnnotationLookup<T extends TimedAnnotation> {
  /** Same result as `annotations.find((a) => time >= a.start && time < a.end)`. */
  atTime(annotations: readonly T[], time: number): T | undefined;
  /** Same result as `annotations.find((a) => a.id === id)`. */
  byId(annotations: readonly T[], id: string): T | undefined;
}

const contains = (annotation: TimedAnnotation, time: number): boolean =>
  time >= annotation.start && time < annotation.end;

/**
 * True when every range ends at or before the next one starts. Only then is
 * "the first annotation containing `time`" also the only one, which is what
 * lets `atTime` trust a cached hit and binary-search a miss. NaN bounds fail
 * the comparisons and fall back to the linear scan.
 */
function isOrdered(annotations: readonly TimedAnnotation[]): boolean {
  for (let i = 0; i < annotations.length; i++) {
    const current = annotations[i];
    if (!(current.start <= current.end)) return false;
    if (i + 1 < annotations.length && !(current.end <= annotations[i + 1].start)) return false;
  }
  return true;
}

export function createAnnotationLookup<T extends TimedAnnotation>(): AnnotationLookup<T> {
  let list: readonly T[] | null = null;
  let ordered = false;
  let lastIndex = -1;
  let lastById: T | undefined;

  const sync = (annotations: readonly T[]) => {
    if (annotations === list) return;
    list = annotations;
    ordered = isOrdered(annotations);
    lastIndex = -1;
    lastById = undefined;
  };

  return {
    atTime(annotations, time) {
      sync(annotations);
      if (!ordered) return annotations.find((annotation) => contains(annotation, time));

      // Playback moves forward, so the last hit is nearly always still the answer.
      if (lastIndex >= 0 && contains(annotations[lastIndex], time)) return annotations[lastIndex];

      let low = 0;
      let high = annotations.length - 1;
      while (low <= high) {
        const mid = (low + high) >> 1;
        const candidate = annotations[mid];
        if (time < candidate.start) {
          high = mid - 1;
        } else if (time >= candidate.end) {
          low = mid + 1;
        } else {
          lastIndex = mid;
          return candidate;
        }
      }
      return undefined;
    },

    byId(annotations, id) {
      sync(annotations);
      if (lastById?.id === id) return lastById;
      // A miss is not cached: the id may be added in a later list.
      lastById = annotations.find((annotation) => annotation.id === id);
      return lastById;
    },
  };
}
