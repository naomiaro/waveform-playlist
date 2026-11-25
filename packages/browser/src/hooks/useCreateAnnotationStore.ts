import { useLayoutEffect, useRef, useState } from 'react';
import { createAnnotationStore } from '@waveform-playlist/core';
import type {
  AnnotationData,
  AnnotationStore,
  AnnotationStoreOptions,
} from '@waveform-playlist/core';

/**
 * Create the `AnnotationStore` that owns an editor's annotations, one per
 * component instance. Give it to a provider's `annotationStore` prop and
 * read it with `useStoredAnnotations`. Returns the same store on every render.
 *
 * `init` is read once, on the first render; it may throw (an annotation
 * without numeric `start`/`end`, two with one id), and the throw goes to the
 * nearest error boundary. Unlike `init`, `options.beforeChange` is followed:
 * the store calls the function passed on the most recent committed render,
 * so a rule that reads the app's state sees its current value.
 *
 * Under StrictMode React calls the initializer twice and keeps one result.
 */
export function useCreateAnnotationStore(
  init?: () => readonly AnnotationData[],
  options?: AnnotationStoreOptions
): AnnotationStore {
  const beforeChange = options?.beforeChange;
  const ruleRef = useRef(beforeChange);
  // Written after commit, so a render React throws away never sets the rule.
  useLayoutEffect(() => {
    ruleRef.current = beforeChange;
  }, [beforeChange]);

  const [store] = useState(() =>
    createAnnotationStore(init?.(), {
      beforeChange: (next, current) => (ruleRef.current ? ruleRef.current(next, current) : next),
    })
  );
  return store;
}
