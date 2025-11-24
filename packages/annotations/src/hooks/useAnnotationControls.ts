import { useState, useCallback } from 'react';
import type { Annotation, AnnotationListOptions } from '../types';

const LINK_THRESHOLD = 0.01; // Consider edges "linked" if within 10ms

export interface UseAnnotationControlsOptions {
  initialContinuousPlay?: boolean;
  initialLinkEndpoints?: boolean;
}

export interface AnnotationUpdateParams {
  annotationIndex: number;
  newTime: number;
  isDraggingStart: boolean;
  annotations: Annotation[];
  duration: number;
  linkEndpoints: boolean;
}

export interface UseAnnotationControlsReturn {
  continuousPlay: boolean;
  linkEndpoints: boolean;
  setContinuousPlay: (value: boolean) => void;
  setLinkEndpoints: (value: boolean) => void;
  updateAnnotationBoundaries: (params: AnnotationUpdateParams) => Annotation[];
}

/**
 * Hook for managing annotation control state and boundary logic.
 * Handles continuous play mode and linked endpoints behavior.
 */
export const useAnnotationControls = (
  options: UseAnnotationControlsOptions = {}
): UseAnnotationControlsReturn => {
  const {
    initialContinuousPlay = false,
    initialLinkEndpoints = true,
  } = options;

  const [continuousPlay, setContinuousPlay] = useState(initialContinuousPlay);
  const [linkEndpoints, setLinkEndpoints] = useState(initialLinkEndpoints);

  /**
   * Updates annotation boundaries based on drag operations.
   * Handles linked endpoints and collision detection.
   * Note: linkEndpoints is passed as a parameter to ensure it uses the current value from context.
   */
  const updateAnnotationBoundaries = useCallback(
    ({
      annotationIndex,
      newTime,
      isDraggingStart,
      annotations,
      duration,
      linkEndpoints: shouldLinkEndpoints,
    }: AnnotationUpdateParams): Annotation[] => {
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
    },
    []
  );

  return {
    continuousPlay,
    linkEndpoints,
    setContinuousPlay,
    setLinkEndpoints,
    updateAnnotationBoundaries,
  };
};
