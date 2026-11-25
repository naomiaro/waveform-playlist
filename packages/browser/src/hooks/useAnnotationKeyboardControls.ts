import { useCallback, useMemo, useEffect, useSyncExternalStore } from 'react';
import type { AnnotationData, AnnotationStore } from '@waveform-playlist/core';
import { usePlaylistViewOptional, usePlaylistZoomOptional } from '../contexts/playlistContexts';
import { useKeyboardShortcuts } from './useKeyboardShortcuts';
import { moveAnnotationEnd, moveAnnotationStart } from '../utils/annotationBoundaryKeys';

const TIME_DELTA = 0.01; // 10ms adjustment per keypress

interface UseAnnotationKeyboardControlsOptions {
  /**
   * The owner of the annotations (`usePlaybackControls().annotationStore`).
   * The keys read the store, and each boundary key changes the active
   * annotation, found by id, in the store's list as it is when the key is
   * pressed (#867). Without a store there is nothing to move or select.
   */
  store: AnnotationStore | undefined;
  activeAnnotationId: string | null;
  /** Callback to set the active annotation ID for selection */
  onActiveAnnotationChange?: (id: string | null) => void;
  duration: number;
  linkEndpoints: boolean;
  /** Whether continuous play is enabled (affects playback duration) */
  continuousPlay?: boolean;
  enabled?: boolean;
  /** Optional: scroll container ref for auto-scrolling to annotation */
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  /** Optional: callback to start playback at a time with optional duration */
  onPlay?: (startTime: number, duration?: number) => void;
  /**
   * Pixels-per-sample for auto-scroll positioning. Falls back to the
   * WaveformPlaylistProvider context when omitted (WebAudio path). Pass
   * explicitly when used outside that provider (e.g. the MediaElement path).
   */
  samplesPerPixel?: number;
  /** Sample rate for auto-scroll positioning. Falls back to context. */
  sampleRate?: number;
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
 * const { annotationStore, setActiveAnnotationId } = usePlaybackControls();
 * useAnnotationKeyboardControls({
 *   store: annotationStore,
 *   activeAnnotationId,
 *   onActiveAnnotationChange: setActiveAnnotationId,
 *   duration,
 *   linkEndpoints,
 * });
 * ```
 */
const NO_ANNOTATIONS: readonly AnnotationData[] = Object.freeze([]);
const noSubscription = () => () => {};
const noAnnotations = () => NO_ANNOTATIONS;

export function useAnnotationKeyboardControls({
  store,
  activeAnnotationId,
  onActiveAnnotationChange,
  duration,
  linkEndpoints,
  continuousPlay = false,
  enabled = true,
  scrollContainerRef,
  onPlay,
  samplesPerPixel: samplesPerPixelProp,
  sampleRate: sampleRateProp,
}: UseAnnotationKeyboardControlsOptions) {
  // Called on every render, with a stand-in when there is no store.
  // Wrapped, so a store whose methods use `this` keeps working.
  const source = useMemo(
    () =>
      store
        ? {
            subscribe: (listener: () => void) => store.subscribe(listener),
            getSnapshot: () => store.getAnnotations(),
          }
        : { subscribe: noSubscription, getSnapshot: noAnnotations },
    [store]
  );
  const stored = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
  const annotations = stored;

  // Auto-scroll positioning needs samplesPerPixel/sampleRate. Prefer explicit
  // props (works in the MediaElement path); otherwise read them from the
  // provider's contexts (either provider renders them). The optional readers
  // return null instead of throwing, so this hook is safe outside a provider.
  const playlistView = usePlaylistViewOptional();
  const playlistZoom = usePlaylistZoomOptional();
  const samplesPerPixel = samplesPerPixelProp ?? playlistZoom?.samplesPerPixel;
  const sampleRate = sampleRateProp ?? playlistView?.sampleRate;

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
      const startPixel = (annotation.start * sampleRate) / samplesPerPixel;
      const endPixel = (annotation.end * sampleRate) / samplesPerPixel;
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
    [annotations, scrollContainerRef, samplesPerPixel, sampleRate]
  );

  // Auto-scroll when active annotation changes via keyboard navigation
  useEffect(() => {
    if (activeAnnotationId && scrollContainerRef?.current && samplesPerPixel && sampleRate) {
      scrollToAnnotation(activeAnnotationId);
    }
  }, [activeAnnotationId, scrollToAnnotation, scrollContainerRef, samplesPerPixel, sampleRate]);

  const moveStartBoundary = useCallback(
    (delta: number) => {
      store?.update((current) => {
        const index = current.findIndex((a) => a.id === activeAnnotationId);
        return index < 0 ? current : moveAnnotationStart(current, index, delta, { linkEndpoints });
      });
    },
    [store, activeAnnotationId, linkEndpoints]
  );

  const moveEndBoundary = useCallback(
    (delta: number) => {
      store?.update((current) => {
        const index = current.findIndex((a) => a.id === activeAnnotationId);
        return index < 0
          ? current
          : moveAnnotationEnd(current, index, delta, { linkEndpoints, duration });
      });
    },
    [store, activeAnnotationId, duration, linkEndpoints]
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
