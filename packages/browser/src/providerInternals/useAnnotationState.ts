import { useCallback, useMemo, useRef, useState } from 'react';
import { createValueSource } from '@waveform-playlist/core';
import type { AnnotationData } from '@waveform-playlist/core';
import type { AnnotationPreviewHandle } from '../hooks/useAnnotationDragHandlers';
import { createAnnotationLookup, type AnnotationLookup } from '../utils/annotationLookup';

export interface UseAnnotationStateOptions {
  annotationList: { annotations?: AnnotationData[]; isContinuousPlay?: boolean } | undefined;
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

  const [continuousPlay, setContinuousPlayState] = useState(
    annotationList?.isContinuousPlay ?? false
  );
  const continuousPlayRef = useRef<boolean>(continuousPlay);
  const setContinuousPlay = useCallback((value: boolean) => {
    continuousPlayRef.current = value;
    setContinuousPlayState(value);
  }, []);

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
  };
}
