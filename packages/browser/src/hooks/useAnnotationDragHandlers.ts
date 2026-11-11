import React from 'react';
import { flushSync } from 'react-dom';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/abstract';
import {
  updateAnnotationBoundaries,
  type AnnotationData,
  type ValueSourceHandle,
} from '@waveform-playlist/core';

/**
 * Where an annotation edge drag shows its moves while it is in progress:
 * the annotations as the drag would leave them, or `null` when no drag is
 * running. Both providers have one (`annotationPreview` in their controls).
 */
export type AnnotationPreviewHandle = ValueSourceHandle<AnnotationData[] | null>;

interface UseAnnotationDragHandlersOptions {
  annotations: AnnotationData[];
  onAnnotationsChange: (annotations: AnnotationData[]) => void;
  samplesPerPixel: number;
  /** Sample rate for pixel-to-time conversion. Providers pass the real rate from
   *  context; defaults to 48000 (the engine default) for out-of-provider usage. */
  sampleRate?: number;
  duration: number;
  linkEndpoints: boolean;
  /**
   * Pass the provider's `annotationPreview` to keep the drag out of your own
   * state: each move is published there (the built-in annotation boxes and
   * list follow it), and `onAnnotationsChange` is called once, on release.
   * Without it `onAnnotationsChange` is called on every move, which
   * re-renders whatever holds the annotations for each one.
   */
  preview?: AnnotationPreviewHandle;
}

/**
 * Custom hook for handling annotation drag operations (boundary trimming)
 *
 * Provides drag handlers for use with @dnd-kit/react DragDropProvider.
 * Handles annotation boundary resizing with linked endpoints support.
 * A cancelled drag (Escape) puts back every annotation it moved.
 *
 * @example
 * ```tsx
 * const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
 *   annotations,
 *   onAnnotationsChange: setAnnotations,
 *   preview: annotationPreview, // from usePlaylistControls()
 *   samplesPerPixel,
 *   sampleRate,
 *   duration,
 *   linkEndpoints,
 * });
 *
 * return (
 *   <DragDropProvider
 *     onDragStart={onDragStart}
 *     onDragMove={onDragMove}
 *     onDragEnd={onDragEnd}
 *     modifiers={[RestrictToHorizontalAxis]}
 *   >
 *     {renderAnnotations()}
 *   </DragDropProvider>
 * );
 * ```
 */
export function useAnnotationDragHandlers({
  annotations,
  onAnnotationsChange,
  samplesPerPixel,
  // Default mirrors the engine default; the providers always pass the real rate from context (#510).
  sampleRate = 48000,
  duration,
  linkEndpoints,
  preview,
}: UseAnnotationDragHandlersOptions) {
  // `snapshot`: the annotations as they were when the drag began; a cancelled
  // drag restores them. Each move is applied to the result of the previous
  // move, not to the snapshot: that is how, with linked endpoints, an edge
  // dragged into a separated neighbour picks it up and carries it along (#747).
  const dragRef = React.useRef<{
    snapshot: AnnotationData[];
    start: number;
    end: number;
    annotationIndex: number;
  } | null>(null);

  // Read through refs so the handlers keep their identity while a drag
  // without a preview replaces `annotations` on every move.
  const annotationsRef = React.useRef(annotations);
  annotationsRef.current = annotations;
  const onAnnotationsChangeRef = React.useRef(onAnnotationsChange);
  onAnnotationsChangeRef.current = onAnnotationsChange;

  // A drag that never ends (its component unmounts mid-drag) must not leave
  // its preview on screen.
  React.useEffect(() => {
    if (!preview) return;
    return () => {
      if (dragRef.current) {
        dragRef.current = null;
        preview.publish(null);
      }
    };
  }, [preview]);

  const onDragStart = React.useCallback((event: DragStartEvent) => {
    const data = event.operation.source?.data as
      | {
          annotationId: string;
          annotationIndex: number;
          edge: 'start' | 'end';
        }
      | undefined;

    const snapshot = annotationsRef.current;
    const annotation =
      data?.annotationIndex === undefined ? undefined : snapshot[data.annotationIndex];
    dragRef.current =
      data && annotation
        ? {
            snapshot,
            start: annotation.start,
            end: annotation.end,
            annotationIndex: data.annotationIndex,
          }
        : null;
  }, []);

  const onDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      const drag = dragRef.current;
      if (!drag) {
        return;
      }

      const data = event.operation.source?.data as
        | {
            annotationId: string;
            annotationIndex: number;
            edge: 'start' | 'end';
          }
        | undefined;

      if (!data) return;

      const { edge, annotationIndex } = data;

      // The dragmove event is dispatched BEFORE position.current is updated (happens
      // in a microtask), so the snapshot's position.current is stale. Use event.to
      // (the pointer's current coordinates from the sensor) for the correct position.
      const currentX = event.to?.x ?? event.operation.position.current.x;
      const rawDeltaX = currentX - event.operation.position.initial.x;
      const timeDelta = (rawDeltaX * samplesPerPixel) / sampleRate;

      const newTime = edge === 'start' ? drag.start + timeDelta : drag.end + timeDelta;

      // The boundary logic (linked endpoints, collisions) is core's, shared with
      // dawcore's annotation track.
      const updatedAnnotations = updateAnnotationBoundaries({
        annotationIndex,
        newTime,
        isDraggingStart: edge === 'start',
        annotations: preview
          ? (preview.source.getSnapshot() ?? drag.snapshot)
          : annotationsRef.current,
        duration,
        linkEndpoints,
      });

      if (preview) {
        preview.publish(updatedAnnotations);
      } else {
        onAnnotationsChangeRef.current(updatedAnnotations);
      }
    },
    [samplesPerPixel, sampleRate, duration, linkEndpoints, preview]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;

      if (!preview) {
        // The moves were reported as they happened; a cancelled drag takes
        // them all back, the neighbours it moved included.
        if (event.canceled && annotationsRef.current !== drag.snapshot) {
          onAnnotationsChangeRef.current(drag.snapshot);
        }
        return;
      }

      const result = preview.source.getSnapshot();
      if (result === null) return;
      if (event.canceled) {
        preview.publish(null);
        return;
      }
      // Committed and cleared in one synchronous render, so the boxes never
      // show the old positions between the two.
      flushSync(() => {
        onAnnotationsChangeRef.current(result);
        preview.publish(null);
      });
    },
    [preview]
  );

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
  };
}
