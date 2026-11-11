import React from 'react';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/abstract';
import { updateAnnotationBoundaries, type AnnotationData } from '@waveform-playlist/core';

interface UseAnnotationDragHandlersOptions {
  annotations: AnnotationData[];
  onAnnotationsChange: (annotations: AnnotationData[]) => void;
  samplesPerPixel: number;
  /** Sample rate for pixel-to-time conversion. Providers pass the real rate from
   *  context; defaults to 48000 (the engine default) for out-of-provider usage. */
  sampleRate?: number;
  duration: number;
  linkEndpoints: boolean;
}

/**
 * Custom hook for handling annotation drag operations (boundary trimming)
 *
 * Provides drag handlers for use with @dnd-kit/react DragDropProvider.
 * Handles annotation boundary resizing with linked endpoints support.
 *
 * @example
 * ```tsx
 * const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
 *   annotations,
 *   onAnnotationsChange: setAnnotations,
 *   samplesPerPixel,
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
}: UseAnnotationDragHandlersOptions) {
  // Store original annotation state when drag starts (for cumulative delta application)
  const originalAnnotationStateRef = React.useRef<{
    start: number;
    end: number;
    annotationIndex: number;
  } | null>(null);

  const onDragStart = React.useCallback(
    (event: DragStartEvent) => {
      const data = event.operation.source?.data as
        | {
            annotationId: string;
            annotationIndex: number;
            edge: 'start' | 'end';
          }
        | undefined;

      if (!data || data.annotationIndex === undefined) {
        originalAnnotationStateRef.current = null;
        return;
      }

      const annotation = annotations[data.annotationIndex];
      if (annotation) {
        originalAnnotationStateRef.current = {
          start: annotation.start,
          end: annotation.end,
          annotationIndex: data.annotationIndex,
        };
      }
    },
    [annotations]
  );

  const onDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      if (!originalAnnotationStateRef.current) {
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
      const originalState = originalAnnotationStateRef.current;

      // The dragmove event is dispatched BEFORE position.current is updated (happens
      // in a microtask), so the snapshot's position.current is stale. Use event.to
      // (the pointer's current coordinates from the sensor) for the correct position.
      const currentX = event.to?.x ?? event.operation.position.current.x;
      const rawDeltaX = currentX - event.operation.position.initial.x;
      const timeDelta = (rawDeltaX * samplesPerPixel) / sampleRate;

      // Apply delta to original state
      const newTime =
        edge === 'start' ? originalState.start + timeDelta : originalState.end + timeDelta;

      // The boundary logic (linked endpoints, collisions) is core's, shared with
      // dawcore's annotation track.
      const updatedAnnotations = updateAnnotationBoundaries({
        annotationIndex,
        newTime,
        isDraggingStart: edge === 'start',
        annotations,
        duration,
        linkEndpoints,
      });

      onAnnotationsChange(updatedAnnotations);
    },
    [annotations, onAnnotationsChange, samplesPerPixel, sampleRate, duration, linkEndpoints]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      // Handle canceled drags — revert annotations to pre-drag state
      if (event.canceled && originalAnnotationStateRef.current) {
        const { annotationIndex, start, end } = originalAnnotationStateRef.current;
        const revertedAnnotations = annotations.map((annotation, idx) => {
          if (idx !== annotationIndex) return annotation;
          return { ...annotation, start, end };
        });
        onAnnotationsChange(revertedAnnotations);
      }
      originalAnnotationStateRef.current = null;
    },
    [annotations, onAnnotationsChange]
  );

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
  };
}
