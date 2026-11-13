import { useCallback, useMemo, useRef, useState } from 'react';
import { createValueSource } from '@waveform-playlist/core';
import type { AnnotationData } from '@waveform-playlist/core';
import type { AnnotationPreviewHandle } from '../hooks/useAnnotationDragHandlers';
import { createAnnotationLookup, type AnnotationLookup } from '../utils/annotationLookup';
import type {
  AnnotationOptionsContextValue,
  AnnotationsContextValue,
} from '../contexts/playlistContexts';

/**
 * The `annotationList` prop of both providers. The provider holds the three
 * options as state (`useAnnotationOptions()`, and the three setters of
 * `usePlaybackControls()`), and that state follows the prop: when the value
 * of a field changes, the option takes it. Between two changes of the prop a
 * setter (or one of the checkboxes) changes the option; the prop is not told.
 */
export interface AnnotationListProp {
  annotations?: AnnotationData[];
  /** Whether annotations can be edited (text, ids, edges). Default: false. */
  editable?: boolean;
  /** Whether a dragged edge takes the edge it touches along. Default: false. */
  linkEndpoints?: boolean;
  /** Whether playback runs on past the end of an annotation. Default: false. */
  isContinuousPlay?: boolean;
}

export interface UseAnnotationStateOptions {
  annotationList: AnnotationListProp | undefined;
  onAnnotationsChange: ((annotations: AnnotationData[]) => void) | undefined;
  /** Named in the warning for a `setAnnotations` call with no `onAnnotationsChange`. */
  providerName: string;
}

export interface AnnotationState {
  /** From the prop (the parent owns them); `[]` when absent or not parsed. */
  annotations: AnnotationData[];
  /** For the animation loop, so an annotation edit does not restart it. */
  annotationsRef: React.RefObject<AnnotationData[]>;
  /** Cached per-frame lookups. */
  annotationLookup: AnnotationLookup<AnnotationData>;
  setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>>;
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
export function useAnnotationState({
  annotationList,
  onAnnotationsChange,
  providerName,
}: UseAnnotationStateOptions): AnnotationState {
  // In v6, annotations must be pre-parsed (numeric start/end). Use
  // parseAeneas() from @waveform-playlist/annotations before passing them.
  const annotations = useMemo(() => {
    if (!annotationList?.annotations) return [];
    if (process.env.NODE_ENV !== 'production' && annotationList.annotations.length > 0) {
      const first = annotationList.annotations[0] as unknown as Record<string, unknown>;
      if (typeof first.start !== 'number' || typeof first.end !== 'number') {
        console.error(
          '[waveform-playlist] Annotations must have numeric start/end values. ' +
            'In v6, use parseAeneas() from @waveform-playlist/annotations before passing annotations. ' +
            'Received start type: ' +
            typeof first.start
        );
        return [];
      }
    }
    return annotationList.annotations;
  }, [annotationList?.annotations]);

  const annotationsRef = useRef<AnnotationData[]>(annotations);
  annotationsRef.current = annotations;
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

  // Read through a ref so that `setAnnotations` keeps its identity.
  const onAnnotationsChangeRef = useRef(onAnnotationsChange);
  onAnnotationsChangeRef.current = onAnnotationsChange;

  const setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>> = useCallback(
    (action) => {
      const updated = typeof action === 'function' ? action(annotationsRef.current) : action;
      if (!onAnnotationsChangeRef.current) {
        if (process.env.NODE_ENV !== 'production') {
          console.warn(
            'waveform-playlist: setAnnotations was called but no onAnnotationsChange callback is provided. ' +
              'Annotation edits will not persist. Pass onAnnotationsChange to ' +
              providerName +
              ' to handle annotation updates.'
          );
        }
        return;
      }
      onAnnotationsChangeRef.current(updated);
    },
    [providerName]
  );

  return {
    annotations,
    annotationsRef,
    annotationLookup,
    setAnnotations,
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
