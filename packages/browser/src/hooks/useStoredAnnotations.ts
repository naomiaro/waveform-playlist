import { useMemo, useSyncExternalStore } from 'react';
import type { AnnotationData, AnnotationStore } from '@waveform-playlist/core';

/**
 * The annotations of `store`, for the app's own components (inside or outside
 * a provider). The same array until the annotations change. Never write to
 * what it returns: change them with `store.set` or `store.update`.
 */
export function useStoredAnnotations(store: AnnotationStore): readonly AnnotationData[] {
  const source = useMemo(
    () => ({
      subscribe: (listener: () => void) => store.subscribe(listener),
      getSnapshot: () => store.getAnnotations(),
    }),
    [store]
  );
  return useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
