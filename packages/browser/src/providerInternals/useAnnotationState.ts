import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createValueSource } from '@waveform-playlist/core';
import type { AnnotationData, AnnotationStore } from '@waveform-playlist/core';
import type { AnnotationPreviewHandle } from '../hooks/useAnnotationDragHandlers';
import { createAnnotationLookup, type AnnotationLookup } from '../utils/annotationLookup';
import type {
  AnnotationOptionsContextValue,
  AnnotationsContextValue,
} from '../contexts/playlistContexts';

/**
 * The `annotationList` prop of both providers: the three annotation options.
 * The annotations themselves are the `annotationStore` prop's (#867). The
 * provider holds the three options as state (`useAnnotationOptions()`, and the three setters of
 * `usePlaybackControls()`), and that state follows the prop: when the value
 * of a field changes, the option takes it. Between two changes of the prop a
 * setter (or one of the checkboxes) changes the option; the prop is not told.
 */
export interface AnnotationListProp {
  /** Whether annotations can be edited (text, ids, edges). Default: false. */
  editable?: boolean;
  /** Whether a dragged edge takes the edge it touches along. Default: false. */
  linkEndpoints?: boolean;
  /** Whether playback runs on past the end of an annotation. Default: false. */
  isContinuousPlay?: boolean;
}

export interface UseAnnotationStateOptions {
  /** The owner of the annotations (#867); without it there are none. */
  annotationStore: AnnotationStore | undefined;
  annotationList: AnnotationListProp | undefined;
}

export interface AnnotationState {
  /** The store's annotations; `[]` without a store. */
  annotations: readonly AnnotationData[];
  /**
   * The current annotations, for the animation loop, so an annotation edit
   * does not restart it. Reads the store at the moment of the call. Stable.
   */
  getAnnotations: () => readonly AnnotationData[];
  /** Cached per-frame lookups. */
  annotationLookup: AnnotationLookup<AnnotationData>;
  /** Created once: the annotations as an edge drag in progress would leave them. */
  annotationPreview: AnnotationPreviewHandle;
  activeAnnotationId: string | null;
  activeAnnotationIdRef: React.RefObject<string | null>;
  setActiveAnnotationId: (id: string | null) => void;
  continuousPlay: boolean;
  continuousPlayRef: React.RefObject<boolean>;
  setContinuousPlay: (enabled: boolean) => void;
  setAnnotationsEditable: (enabled: boolean) => void;
  setLinkEndpoints: (enabled: boolean) => void;
  /** `{ annotations }`, memoized: the public annotations value. */
  annotationsValue: AnnotationsContextValue;
  /** The three options, memoized: the public options value. */
  annotationOptionsValue: AnnotationOptionsContextValue;
}

/**
 * A boolean option held as state that follows a prop (#686): it starts from
 * the prop (false when absent), a setter changes it, and when the prop's
 * value changes the option takes the new value. The comparison is made during
 * render against the last prop value seen, kept as state: no effect, so a
 * StrictMode remount or a revealed `<Activity>` does not put an unchanged
 * prop back over a value the user chose. The setter keeps its identity.
 */
function useFollowedOption(prop: boolean | undefined): [boolean, (value: boolean) => void] {
  // A field that is left out says false: leaving it out and writing `false`
  // are the same value, not a change.
  const wanted = prop ?? false;
  const [value, setValue] = useState(wanted);
  const [seen, setSeen] = useState(wanted);
  if (seen !== wanted) {
    setSeen(wanted);
    setValue(wanted);
    return [wanted, setValue];
  }
  return [value, setValue];
}

/**
 * The annotation state of a provider. The two setters that the animation loop
 * depends on write their ref first and the state second, so a running loop
 * reads the new value on its next frame, before React has rendered. Every
 * function and the preview keep their identity.
 */
const NO_ANNOTATIONS: readonly AnnotationData[] = Object.freeze([]);
const noSubscription = () => () => {};
const noAnnotations = () => NO_ANNOTATIONS;

export function useAnnotationState({
  annotationStore,
  annotationList,
}: UseAnnotationStateOptions): AnnotationState {
  // Called on every render, with a stand-in when there is no store. The
  // store validates what it holds (numeric start/end, unique ids).
  // Wrapped, so a store whose methods use `this` keeps working.
  const source = useMemo(
    () =>
      annotationStore
        ? {
            subscribe: (listener: () => void) => annotationStore.subscribe(listener),
            getSnapshot: () => annotationStore.getAnnotations(),
          }
        : { subscribe: noSubscription, getSnapshot: noAnnotations },
    [annotationStore]
  );
  const annotations = useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    source.getSnapshot
  );

  // The animation loop reads the store at each frame, through the latest prop.
  const storeRef = useRef(annotationStore);
  storeRef.current = annotationStore;
  const getAnnotations = useCallback(
    () => (storeRef.current ? storeRef.current.getAnnotations() : NO_ANNOTATIONS),
    []
  );
  const [annotationLookup] = useState(() => createAnnotationLookup<AnnotationData>());

  const [activeAnnotationId, setActiveAnnotationIdState] = useState<string | null>(null);
  const activeAnnotationIdRef = useRef<string | null>(null);
  const setActiveAnnotationId = useCallback((value: string | null) => {
    activeAnnotationIdRef.current = value;
    setActiveAnnotationIdState(value);
  }, []);

  const [continuousPlay, setContinuousPlayState] = useFollowedOption(
    annotationList?.isContinuousPlay
  );
  // Written during render as well as by the setter, so that a value taken
  // from the prop reaches the animation loop too. The setter writes it first:
  // a running loop reads the new value on its next frame, before React has
  // rendered.
  const continuousPlayRef = useRef<boolean>(continuousPlay);
  continuousPlayRef.current = continuousPlay;
  const setContinuousPlay = useCallback(
    (value: boolean) => {
      continuousPlayRef.current = value;
      setContinuousPlayState(value);
    },
    [setContinuousPlayState]
  );

  const [editable, setAnnotationsEditable] = useFollowedOption(annotationList?.editable);
  const [linkEndpoints, setLinkEndpoints] = useFollowedOption(annotationList?.linkEndpoints);

  const annotationsValue = useMemo(() => ({ annotations }), [annotations]);
  const annotationOptionsValue = useMemo(
    () => ({ editable, linkEndpoints, continuousPlay }),
    [editable, linkEndpoints, continuousPlay]
  );

  const [annotationPreview] = useState<AnnotationPreviewHandle>(() =>
    createValueSource<AnnotationData[] | null>(null)
  );

  return {
    annotations,
    getAnnotations,
    annotationLookup,
    annotationPreview,
    activeAnnotationId,
    activeAnnotationIdRef,
    setActiveAnnotationId,
    continuousPlay,
    continuousPlayRef,
    setContinuousPlay,
    setAnnotationsEditable,
    setLinkEndpoints,
    annotationsValue,
    annotationOptionsValue,
  };
}
