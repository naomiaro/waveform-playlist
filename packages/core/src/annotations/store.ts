import type { AnnotationData } from '../types';
import { freezeAnnotations } from './devFreeze';

/**
 * The owner of a list of annotations. The app makes one and gives it to a
 * provider; everything that reads the annotations reads them here, and every
 * change is a call to `set` or `update`.
 */
export interface AnnotationStore {
  /**
   * The current annotations. The same array until a change. Never write to
   * it: outside production builds it is frozen.
   */
  getAnnotations(): readonly AnnotationData[];
  /** Be told after every change. Returns the function that unsubscribes. */
  subscribe(listener: () => void): () => void;
  /** Replace the annotations. */
  set(annotations: readonly AnnotationData[]): void;
  /**
   * Change the annotations: `fn` gets the current array and returns the next.
   * The change is applied before `update` returns, so the next call's
   * `current` already holds it. Returning `current` changes nothing.
   */
  update(fn: (current: readonly AnnotationData[]) => readonly AnnotationData[]): void;
}

export interface AnnotationStoreOptions {
  /**
   * The app's rule for every change. Gets the proposed list and the current
   * one, returns the list to store: `next` to accept, `current` to refuse,
   * or another list to adjust (e.g. clamp an edge so it does not overlap).
   * Not called for the initial list. A throw from it reaches the caller of
   * `set` or `update`, and the store keeps its value.
   */
  beforeChange?: (
    next: readonly AnnotationData[],
    current: readonly AnnotationData[]
  ) => readonly AnnotationData[];
}

function invalid(message: string): TypeError {
  return new TypeError('[waveform-playlist] Invalid annotations: ' + message);
}

/** Every annotation has numeric `start` and `end`, and the ids are unique. */
function validateAnnotations(list: readonly AnnotationData[]): void {
  if (!Array.isArray(list)) throw invalid('expected an array.');
  const seen = new Set<string>();
  for (const annotation of list) {
    const { id, start, end } = annotation ?? ({} as AnnotationData);
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      throw invalid(
        `annotation "${String(id)}" needs numeric start and end (got ${typeof start} and ${typeof end}). ` +
          'Parse text formats first, e.g. parseAeneas() from @waveform-playlist/annotations.'
      );
    }
    if (seen.has(id)) throw invalid(`two annotations have the id "${id}".`);
    seen.add(id);
  }
}

/**
 * Make an annotation store holding `initial` (empty when absent). Throws a
 * `TypeError` for an invalid list: an annotation without numeric `start` and
 * `end`, or two with one id.
 */
export function createAnnotationStore(
  initial: readonly AnnotationData[] = [],
  options: AnnotationStoreOptions = {}
): AnnotationStore {
  validateAnnotations(initial);
  let annotations = freezeAnnotations(initial);
  const listeners = new Set<{ listener: () => void }>();
  const { beforeChange } = options;

  const commit = (proposed: readonly AnnotationData[]) => {
    if (proposed === annotations) return;
    validateAnnotations(proposed);
    let next = proposed;
    if (beforeChange) {
      next = beforeChange(proposed, annotations);
      if (next === annotations) return;
      if (next !== proposed) validateAnnotations(next);
    }
    annotations = freezeAnnotations(next);
    for (const entry of [...listeners]) {
      if (!listeners.has(entry)) continue;
      try {
        entry.listener();
      } catch (error) {
        console.warn('[waveform-playlist] Error in an annotation store subscriber:', error);
      }
    }
  };

  return {
    getAnnotations: () => annotations,
    subscribe(listener) {
      // Each call gets its own entry, so one function subscribed twice is told twice.
      const entry = { listener };
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },
    set(next) {
      commit(next);
    },
    update(fn) {
      commit(fn(annotations));
    },
  };
}
