import React from 'react';
import type { AnnotationType } from '@waveform-playlist/annotations';

const LINK_THRESHOLD = 0.01; // Consider edges "linked" if within 10ms

interface UseAnnotationDragHandlersOptions {
  annotations: AnnotationType[];
  onAnnotationsChange: (annotations: AnnotationType[]) => void;
  samplesPerPixel: number;
  sampleRate: number;
  duration: number;
  linkEndpoints: boolean;
}

/**
 * Custom hook for handling annotation drag operations (boundary trimming)
 *
 * Provides drag handlers for use with @dnd-kit/core DndContext.
 * Handles annotation boundary resizing with linked endpoints support.
 *
 * @example
 * ```tsx
 * const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
 *   annotations,
 *   onAnnotationsChange: setAnnotations,
 *   samplesPerPixel,
 *   sampleRate,
 *   duration,
 *   linkEndpoints,
 * });
 *
 * return (
 *   <DndContext
 *     onDragStart={onDragStart}
 *     onDragMove={onDragMove}
 *     onDragEnd={onDragEnd}
 *     modifiers={[restrictToHorizontalAxis]}
 *   >
 *     {renderAnnotations()}
 *   </DndContext>
 * );
 * ```
 */
export function useAnnotationDragHandlers({
  annotations,
  onAnnotationsChange,
  samplesPerPixel,
  sampleRate,
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
    (event: { active: any }) => {
      const { active } = event;
      const data = active.data.current as {
        annotationId: string;
        annotationIndex: number;
        edge: 'start' | 'end';
      };

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
    (event: { active: any; delta: { x: number; y: number } }) => {
      const { active, delta } = event;

      if (!originalAnnotationStateRef.current) {
        return;
      }

      const data = active.data.current as {
        annotationId: string;
        annotationIndex: number;
        edge: 'start' | 'end';
      };

      if (!data) return;

      const { edge, annotationIndex } = data;
      const originalState = originalAnnotationStateRef.current;

      // Convert pixel delta to time delta
      const timeDelta = (delta.x * samplesPerPixel) / sampleRate;

      // Apply delta to original state
      const newTime = edge === 'start'
        ? originalState.start + timeDelta
        : originalState.end + timeDelta;

      // Update annotations using the boundary logic
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

  const onDragEnd = React.useCallback(() => {
    originalAnnotationStateRef.current = null;
  }, []);

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
  };
}

/**
 * Updates annotation boundaries based on drag operations.
 * Handles linked endpoints and collision detection.
 */
function updateAnnotationBoundaries({
  annotationIndex,
  newTime,
  isDraggingStart,
  annotations,
  duration,
  linkEndpoints: shouldLinkEndpoints,
}: {
  annotationIndex: number;
  newTime: number;
  isDraggingStart: boolean;
  annotations: AnnotationType[];
  duration: number;
  linkEndpoints: boolean;
}): AnnotationType[] {
  const updatedAnnotations = [...annotations];
  const annotation = annotations[annotationIndex];

  if (isDraggingStart) {
    // Dragging start edge
    const constrainedStart = Math.min(annotation.end - 0.1, Math.max(0, newTime));
    const delta = constrainedStart - annotation.start;

    updatedAnnotations[annotationIndex] = {
      ...annotation,
      start: constrainedStart,
    };

    if (shouldLinkEndpoints && annotationIndex > 0) {
      // Link Endpoints mode: handle both already-linked and collision scenarios
      const prevAnnotation = updatedAnnotations[annotationIndex - 1];

      if (Math.abs(prevAnnotation.end - annotation.start) < LINK_THRESHOLD) {
        // Already linked: move previous annotation's end together with this start
        updatedAnnotations[annotationIndex - 1] = {
          ...prevAnnotation,
          end: Math.max(prevAnnotation.start + 0.1, prevAnnotation.end + delta),
        };
      } else if (constrainedStart <= prevAnnotation.end) {
        // Dragged past previous annotation: snap to link them together
        updatedAnnotations[annotationIndex] = {
          ...updatedAnnotations[annotationIndex],
          start: prevAnnotation.end,
        };
      }
    } else if (!shouldLinkEndpoints && annotationIndex > 0 && constrainedStart < updatedAnnotations[annotationIndex - 1].end) {
      // Collision detection: push previous annotation's end back
      updatedAnnotations[annotationIndex - 1] = {
        ...updatedAnnotations[annotationIndex - 1],
        end: constrainedStart,
      };
    }
  } else {
    // Dragging end edge
    const constrainedEnd = Math.max(annotation.start + 0.1, Math.min(newTime, duration));
    const delta = constrainedEnd - annotation.end;

    updatedAnnotations[annotationIndex] = {
      ...annotation,
      end: constrainedEnd,
    };

    if (shouldLinkEndpoints && annotationIndex < updatedAnnotations.length - 1) {
      // Link Endpoints mode: handle both already-linked and collision scenarios
      const nextAnnotation = updatedAnnotations[annotationIndex + 1];

      if (Math.abs(nextAnnotation.start - annotation.end) < LINK_THRESHOLD) {
        // Already linked: move next annotation's start together with this end
        const newStart = nextAnnotation.start + delta;
        updatedAnnotations[annotationIndex + 1] = {
          ...nextAnnotation,
          start: Math.min(nextAnnotation.end - 0.1, newStart),
        };

        // Cascade linked endpoints
        let currentIndex = annotationIndex + 1;
        while (currentIndex < updatedAnnotations.length - 1) {
          const current = updatedAnnotations[currentIndex];
          const next = updatedAnnotations[currentIndex + 1];

          if (Math.abs(next.start - current.end) < LINK_THRESHOLD) {
            const nextDelta = current.end - annotations[currentIndex].end;
            updatedAnnotations[currentIndex + 1] = {
              ...next,
              start: Math.min(next.end - 0.1, next.start + nextDelta),
            };
            currentIndex++;
          } else {
            break; // No more linked endpoints
          }
        }
      } else if (constrainedEnd >= nextAnnotation.start) {
        // Dragged past next annotation: snap to link them together
        updatedAnnotations[annotationIndex] = {
          ...updatedAnnotations[annotationIndex],
          end: nextAnnotation.start,
        };
      }
    } else if (!shouldLinkEndpoints && annotationIndex < updatedAnnotations.length - 1 && constrainedEnd > updatedAnnotations[annotationIndex + 1].start) {
      // Collision detection: push next annotation's start forward
      const nextAnnotation = updatedAnnotations[annotationIndex + 1];

      updatedAnnotations[annotationIndex + 1] = {
        ...nextAnnotation,
        start: constrainedEnd,
      };

      // Cascade collisions
      let currentIndex = annotationIndex + 1;
      while (currentIndex < updatedAnnotations.length - 1) {
        const current = updatedAnnotations[currentIndex];
        const next = updatedAnnotations[currentIndex + 1];

        if (current.end > next.start) {
          updatedAnnotations[currentIndex + 1] = {
            ...next,
            start: current.end,
          };
          currentIndex++;
        } else {
          break; // No more collisions
        }
      }
    }
  }

  return updatedAnnotations;
}
