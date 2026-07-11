import type { AnnotationData } from '../types/annotations';

/** Edges within this distance (seconds) are considered "linked". */
export const LINK_THRESHOLD = 0.01;

/** Minimum annotation duration (seconds) enforced by boundary edits. */
export const MIN_ANNOTATION_DURATION = 0.1;

/** Link threshold for INTEGER TICK positions — closer than half a tick means equal. */
export const ANNOTATION_LINK_THRESHOLD_TICKS = 0.5;

/** Minimum tick-annotation duration: a 128th note, floored at 1 tick. */
export function annotationMinDurationTicks(ppqn: number): number {
  return Math.max(1, Math.round(ppqn / 32));
}

/** Unit constants for a boundary-math run. Defaults are the seconds-domain values. */
export interface AnnotationBoundaryOptions {
  linkThreshold?: number;
  minDuration?: number;
}

export interface AnnotationBoundaryUpdate {
  annotationIndex: number;
  newTime: number;
  isDraggingStart: boolean;
  annotations: AnnotationData[];
  duration: number;
  linkEndpoints: boolean;
}

/**
 * Pure boundary-update logic shared by the React annotations package and the
 * dawcore annotation web components. Handles linked endpoints (moving one edge
 * drags the linked neighbor edge, with cascade) and collision push-back.
 * Returns a NEW array; never mutates inputs.
 */
export function updateAnnotationBoundaries(
  params: AnnotationBoundaryUpdate,
  options: AnnotationBoundaryOptions = {}
): AnnotationData[] {
  const { annotationIndex, newTime, isDraggingStart, annotations, duration, linkEndpoints } =
    params;
  const linkThreshold = options.linkThreshold ?? LINK_THRESHOLD;
  const minDuration = options.minDuration ?? MIN_ANNOTATION_DURATION;

  const updatedAnnotations = [...annotations];
  const annotation = annotations[annotationIndex];

  if (isDraggingStart) {
    const constrainedStart = Math.min(annotation.end - minDuration, Math.max(0, newTime));
    const delta = constrainedStart - annotation.start;

    updatedAnnotations[annotationIndex] = { ...annotation, start: constrainedStart };

    if (linkEndpoints && annotationIndex > 0) {
      const prevAnnotation = updatedAnnotations[annotationIndex - 1];
      if (Math.abs(prevAnnotation.end - annotation.start) < linkThreshold) {
        updatedAnnotations[annotationIndex - 1] = {
          ...prevAnnotation,
          end: Math.max(prevAnnotation.start + minDuration, prevAnnotation.end + delta),
        };
      } else if (constrainedStart <= prevAnnotation.end) {
        updatedAnnotations[annotationIndex] = {
          ...updatedAnnotations[annotationIndex],
          start: prevAnnotation.end,
        };
      }
    } else if (
      !linkEndpoints &&
      annotationIndex > 0 &&
      constrainedStart < updatedAnnotations[annotationIndex - 1].end
    ) {
      updatedAnnotations[annotationIndex - 1] = {
        ...updatedAnnotations[annotationIndex - 1],
        end: constrainedStart,
      };
    }
  } else {
    const constrainedEnd = Math.max(annotation.start + minDuration, Math.min(newTime, duration));
    const delta = constrainedEnd - annotation.end;

    updatedAnnotations[annotationIndex] = { ...annotation, end: constrainedEnd };

    if (linkEndpoints && annotationIndex < updatedAnnotations.length - 1) {
      const nextAnnotation = updatedAnnotations[annotationIndex + 1];
      if (Math.abs(nextAnnotation.start - annotation.end) < linkThreshold) {
        const newStart = nextAnnotation.start + delta;
        updatedAnnotations[annotationIndex + 1] = {
          ...nextAnnotation,
          start: Math.min(nextAnnotation.end - minDuration, newStart),
        };

        let currentIndex = annotationIndex + 1;
        while (currentIndex < updatedAnnotations.length - 1) {
          const current = updatedAnnotations[currentIndex];
          const next = updatedAnnotations[currentIndex + 1];
          if (Math.abs(next.start - current.end) < linkThreshold) {
            const nextDelta = current.end - annotations[currentIndex].end;
            updatedAnnotations[currentIndex + 1] = {
              ...next,
              start: Math.min(next.end - minDuration, next.start + nextDelta),
            };
            currentIndex++;
          } else {
            break;
          }
        }
      } else if (constrainedEnd >= nextAnnotation.start) {
        updatedAnnotations[annotationIndex] = {
          ...updatedAnnotations[annotationIndex],
          end: nextAnnotation.start,
        };
      }
    } else if (
      !linkEndpoints &&
      annotationIndex < updatedAnnotations.length - 1 &&
      constrainedEnd > updatedAnnotations[annotationIndex + 1].start
    ) {
      const nextAnnotation = updatedAnnotations[annotationIndex + 1];
      updatedAnnotations[annotationIndex + 1] = { ...nextAnnotation, start: constrainedEnd };

      let currentIndex = annotationIndex + 1;
      while (currentIndex < updatedAnnotations.length - 1) {
        const current = updatedAnnotations[currentIndex];
        const next = updatedAnnotations[currentIndex + 1];
        if (current.end > next.start) {
          updatedAnnotations[currentIndex + 1] = { ...next, start: current.end };
          currentIndex++;
        } else {
          break;
        }
      }
    }
  }

  return updatedAnnotations;
}
