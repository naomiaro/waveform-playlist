import { useCallback, useMemo, useEffect } from 'react';
import type { AnnotationType } from '@waveform-playlist/annotations';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';

const LINK_THRESHOLD = 0.01; // Consider edges "linked" if within 10ms
const TIME_DELTA = 0.01; // 10ms adjustment per keypress

interface UseAnnotationKeyboardControlsOptions {
  annotations: AnnotationType[];
  activeAnnotationId: string | null;
  onAnnotationsChange: (annotations: AnnotationType[]) => void;
  /** Callback to set the active annotation ID for selection */
  onActiveAnnotationChange?: (id: string | null) => void;
  duration: number;
  linkEndpoints: boolean;
  /** Whether continuous play is enabled (affects playback duration) */
  continuousPlay?: boolean;
  enabled?: boolean;
  /** Optional: scroll container ref for auto-scrolling to annotation */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  /** Optional: samples per pixel for scroll position calculation */
  samplesPerPixel?: number;
  /** Optional: sample rate for scroll position calculation */
  sampleRate?: number;
  /** Optional: controls width offset for scroll position calculation */
  controlsWidth?: number;
  /** Optional: callback to start playback at a time with optional duration */
  onPlay?: (startTime: number, duration?: number) => void;
}

/**
 * Hook for keyboard-based annotation navigation and boundary editing
 *
 * Navigation Shortcuts:
 * - ArrowUp / ArrowLeft = Select previous annotation
 * - ArrowDown / ArrowRight = Select next annotation
 * - Home = Select first annotation
 * - End = Select last annotation
 * - Escape = Deselect annotation
 * - Enter = Play selected annotation
 *
 * Boundary Editing Shortcuts (requires active annotation):
 * - [ = Move start boundary earlier (left)
 * - ] = Move start boundary later (right)
 * - Shift+[ = Move end boundary earlier (left)
 * - Shift+] = Move end boundary later (right)
 *
 * Respects linkEndpoints and continuousPlay settings.
 *
 * @example
 * ```tsx
 * useAnnotationKeyboardControls({
 *   annotations,
 *   activeAnnotationId,
 *   onAnnotationsChange: setAnnotations,
 *   onActiveAnnotationChange: setActiveAnnotationId,
 *   duration,
 *   linkEndpoints,
 * });
 * ```
 */
export function useAnnotationKeyboardControls({
  annotations,
  activeAnnotationId,
  onAnnotationsChange,
  onActiveAnnotationChange,
  duration,
  linkEndpoints,
  continuousPlay = false,
  enabled = true,
  scrollContainerRef,
  samplesPerPixel,
  sampleRate,
  controlsWidth = 0,
  onPlay,
}: UseAnnotationKeyboardControlsOptions) {
  const activeIndex = useMemo(() => {
    if (!activeAnnotationId) return -1;
    return annotations.findIndex((a) => a.id === activeAnnotationId);
  }, [annotations, activeAnnotationId]);

  // Scroll waveform to show a specific annotation
  const scrollToAnnotation = useCallback(
    (annotationId: string) => {
      if (!scrollContainerRef?.current || !samplesPerPixel || !sampleRate) return;

      const annotation = annotations.find((a) => a.id === annotationId);
      if (!annotation) return;

      const container = scrollContainerRef.current;
      const containerWidth = container.clientWidth;

      // Calculate pixel positions for annotation start and center
      const startPixel = (annotation.start * sampleRate) / samplesPerPixel + controlsWidth;
      const endPixel = (annotation.end * sampleRate) / samplesPerPixel + controlsWidth;
      const annotationCenter = (startPixel + endPixel) / 2;

      // Check if annotation is currently visible
      const scrollLeft = container.scrollLeft;
      const visibleStart = scrollLeft;
      const visibleEnd = scrollLeft + containerWidth;

      // If annotation is not fully visible, scroll to center it
      if (startPixel < visibleStart || endPixel > visibleEnd) {
        const targetScrollLeft = Math.max(0, annotationCenter - containerWidth / 2);
        container.scrollTo({
          left: targetScrollLeft,
          behavior: 'smooth',
        });
      }
    },
    [annotations, scrollContainerRef, samplesPerPixel, sampleRate, controlsWidth]
  );

  // Auto-scroll when active annotation changes via keyboard navigation
  useEffect(() => {
    if (activeAnnotationId && scrollContainerRef?.current && samplesPerPixel && sampleRate) {
      scrollToAnnotation(activeAnnotationId);
    }
  }, [activeAnnotationId, scrollToAnnotation, scrollContainerRef, samplesPerPixel, sampleRate]);

  const moveStartBoundary = useCallback(
    (delta: number) => {
      if (activeIndex < 0) return;

      const annotation = annotations[activeIndex];
      const newStart = Math.max(0, Math.min(annotation.end - 0.1, annotation.start + delta));
      const actualDelta = newStart - annotation.start;

      const updatedAnnotations = [...annotations];
      updatedAnnotations[activeIndex] = {
        ...annotation,
        start: newStart,
      };

      // Handle linked endpoints
      if (linkEndpoints && activeIndex > 0) {
        const prevAnnotation = updatedAnnotations[activeIndex - 1];
        if (Math.abs(prevAnnotation.end - annotation.start) < LINK_THRESHOLD) {
          // Already linked: move previous annotation's end together
          updatedAnnotations[activeIndex - 1] = {
            ...prevAnnotation,
            end: Math.max(prevAnnotation.start + 0.1, prevAnnotation.end + actualDelta),
          };
        }
      } else if (!linkEndpoints && activeIndex > 0) {
        // Non-linked mode: don't overlap previous annotation
        const prevAnnotation = updatedAnnotations[activeIndex - 1];
        if (newStart < prevAnnotation.end) {
          // Push back previous annotation's end
          updatedAnnotations[activeIndex - 1] = {
            ...prevAnnotation,
            end: newStart,
          };
        }
      }

      onAnnotationsChange(updatedAnnotations);
    },
    [annotations, activeIndex, linkEndpoints, onAnnotationsChange]
  );

  const moveEndBoundary = useCallback(
    (delta: number) => {
      if (activeIndex < 0) return;

      const annotation = annotations[activeIndex];
      const newEnd = Math.max(annotation.start + 0.1, Math.min(duration, annotation.end + delta));
      const actualDelta = newEnd - annotation.end;

      const updatedAnnotations = [...annotations];
      updatedAnnotations[activeIndex] = {
        ...annotation,
        end: newEnd,
      };

      // Handle linked endpoints
      if (linkEndpoints && activeIndex < annotations.length - 1) {
        const nextAnnotation = updatedAnnotations[activeIndex + 1];
        if (Math.abs(nextAnnotation.start - annotation.end) < LINK_THRESHOLD) {
          // Already linked: move next annotation's start together
          const newNextStart = Math.min(nextAnnotation.end - 0.1, nextAnnotation.start + actualDelta);
          updatedAnnotations[activeIndex + 1] = {
            ...nextAnnotation,
            start: newNextStart,
          };

          // Cascade linked endpoints
          let currentIndex = activeIndex + 1;
          while (currentIndex < updatedAnnotations.length - 1) {
            const current = updatedAnnotations[currentIndex];
            const next = updatedAnnotations[currentIndex + 1];

            if (Math.abs(next.start - annotations[currentIndex].end) < LINK_THRESHOLD) {
              const nextDelta = current.end - annotations[currentIndex].end;
              updatedAnnotations[currentIndex + 1] = {
                ...next,
                start: Math.min(next.end - 0.1, next.start + nextDelta),
              };
              currentIndex++;
            } else {
              break;
            }
          }
        }
      } else if (!linkEndpoints && activeIndex < annotations.length - 1) {
        // Non-linked mode: don't overlap next annotation
        const nextAnnotation = updatedAnnotations[activeIndex + 1];
        if (newEnd > nextAnnotation.start) {
          // Push forward next annotation's start
          updatedAnnotations[activeIndex + 1] = {
            ...nextAnnotation,
            start: newEnd,
          };

          // Cascade collisions
          let currentIndex = activeIndex + 1;
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
              break;
            }
          }
        }
      }

      onAnnotationsChange(updatedAnnotations);
    },
    [annotations, activeIndex, duration, linkEndpoints, onAnnotationsChange]
  );

  // Navigation functions
  const selectPrevious = useCallback(() => {
    if (!onActiveAnnotationChange || annotations.length === 0) return;

    if (activeIndex <= 0) {
      // If no selection or at first, select last annotation
      onActiveAnnotationChange(annotations[annotations.length - 1].id);
    } else {
      onActiveAnnotationChange(annotations[activeIndex - 1].id);
    }
  }, [annotations, activeIndex, onActiveAnnotationChange]);

  const selectNext = useCallback(() => {
    if (!onActiveAnnotationChange || annotations.length === 0) return;

    if (activeIndex < 0 || activeIndex >= annotations.length - 1) {
      // If no selection or at last, select first annotation
      onActiveAnnotationChange(annotations[0].id);
    } else {
      onActiveAnnotationChange(annotations[activeIndex + 1].id);
    }
  }, [annotations, activeIndex, onActiveAnnotationChange]);

  const selectFirst = useCallback(() => {
    if (!onActiveAnnotationChange || annotations.length === 0) return;
    onActiveAnnotationChange(annotations[0].id);
  }, [annotations, onActiveAnnotationChange]);

  const selectLast = useCallback(() => {
    if (!onActiveAnnotationChange || annotations.length === 0) return;
    onActiveAnnotationChange(annotations[annotations.length - 1].id);
  }, [annotations, onActiveAnnotationChange]);

  const clearSelection = useCallback(() => {
    if (!onActiveAnnotationChange) return;
    onActiveAnnotationChange(null);
  }, [onActiveAnnotationChange]);

  // Play the currently selected annotation
  const playActiveAnnotation = useCallback(() => {
    if (activeIndex < 0 || !onPlay) return;

    const annotation = annotations[activeIndex];
    // If continuous play is off, play just this annotation's duration
    const playDuration = !continuousPlay ? annotation.end - annotation.start : undefined;
    onPlay(annotation.start, playDuration);
  }, [annotations, activeIndex, continuousPlay, onPlay]);

  // Shortcuts that require an active annotation (boundary editing + playback)
  const activeAnnotationShortcuts = useMemo(
    () => [
      {
        key: '[',
        action: () => moveStartBoundary(-TIME_DELTA),
        description: 'Move annotation start earlier',
        preventDefault: true,
      },
      {
        key: ']',
        action: () => moveStartBoundary(TIME_DELTA),
        description: 'Move annotation start later',
        preventDefault: true,
      },
      {
        key: '{',
        shiftKey: true,
        action: () => moveEndBoundary(-TIME_DELTA),
        description: 'Move annotation end earlier',
        preventDefault: true,
      },
      {
        key: '}',
        shiftKey: true,
        action: () => moveEndBoundary(TIME_DELTA),
        description: 'Move annotation end later',
        preventDefault: true,
      },
      {
        key: 'Enter',
        action: playActiveAnnotation,
        description: 'Play selected annotation',
        preventDefault: true,
      },
    ],
    [moveStartBoundary, moveEndBoundary, playActiveAnnotation]
  );

  // Navigation shortcuts (always active when enabled and there are annotations)
  const navigationShortcuts = useMemo(
    () => [
      {
        key: 'ArrowUp',
        action: selectPrevious,
        description: 'Select previous annotation',
        preventDefault: true,
      },
      {
        key: 'ArrowLeft',
        action: selectPrevious,
        description: 'Select previous annotation',
        preventDefault: true,
      },
      {
        key: 'ArrowDown',
        action: selectNext,
        description: 'Select next annotation',
        preventDefault: true,
      },
      {
        key: 'ArrowRight',
        action: selectNext,
        description: 'Select next annotation',
        preventDefault: true,
      },
      {
        key: 'Home',
        action: selectFirst,
        description: 'Select first annotation',
        preventDefault: true,
      },
      {
        key: 'End',
        action: selectLast,
        description: 'Select last annotation',
        preventDefault: true,
      },
      {
        key: 'Escape',
        action: clearSelection,
        description: 'Deselect annotation',
        preventDefault: true,
      },
    ],
    [selectPrevious, selectNext, selectFirst, selectLast, clearSelection]
  );

  // Active annotation shortcuts only work when an annotation is selected
  useKeyboardShortcuts({
    shortcuts: activeAnnotationShortcuts,
    enabled: enabled && activeIndex >= 0,
  });

  // Navigation shortcuts work whenever there are annotations
  useKeyboardShortcuts({
    shortcuts: navigationShortcuts,
    enabled: enabled && annotations.length > 0 && !!onActiveAnnotationChange,
  });

  return {
    moveStartBoundary,
    moveEndBoundary,
    selectPrevious,
    selectNext,
    selectFirst,
    selectLast,
    clearSelection,
    scrollToAnnotation,
    playActiveAnnotation,
  };
}
