import React from 'react';
import { flushSync } from 'react-dom';
import type { DragStartEvent, DragMoveEvent, DragEndEvent } from '@dnd-kit/abstract';
import {
  applyAnnotationBounds,
  updateAnnotationBoundaries,
  type AnnotationBoundsChange,
  type AnnotationData,
  type AnnotationStore,
  type ValueSourceHandle,
} from '@waveform-playlist/core';

/**
 * Where an annotation edge drag shows its moves while it is in progress:
 * the store's current annotations with the drag's moves on top, or `null`
 * when no drag is running. Both providers have one (`annotationPreview` in their controls).
 */
export type AnnotationPreviewHandle = ValueSourceHandle<AnnotationData[] | null>;

interface UseAnnotationDragHandlersOptions {
  /**
   * The owner of the annotations (`usePlaybackControls().annotationStore`).
   * The drag writes only the bounds it moved, by id, onto the store's list
   * as it is at the time of the write (#867). Without a store the handlers
   * do nothing.
   */
  store: AnnotationStore | undefined;
  samplesPerPixel: number;
  /** Sample rate for pixel-to-time conversion. Providers pass the real rate from
   *  context; defaults to 48000 (the engine default) for out-of-provider usage. */
  sampleRate?: number;
  duration: number;
  linkEndpoints: boolean;
  /**
   * Pass the provider's `annotationPreview` to keep the drag out of your own
   * state: each move is published there (the built-in annotation boxes and
   * list follow it), and the annotations are written once, on release.
   * Without it they are written on every move, which re-renders whatever
   * reads them for each one.
   */
  preview?: AnnotationPreviewHandle;
}

interface DragState {
  /** The store the drag began on: a drag ends when the provider's store changes. */
  store: AnnotationStore;
  /** The annotations as they were when the drag began, for Escape. */
  snapshot: readonly AnnotationData[];
  /**
   * The bounds of every annotation the drag has moved so far, by id, the
   * dragged one included. Kept for an annotation even when it is moved back
   * to where it was, so the next write and Escape include it.
   */
  touched: Map<string, AnnotationBoundsChange>;
  draggedId: string;
  edge: 'start' | 'end';
  /** The dragged annotation's bounds when the drag began. */
  start: number;
  end: number;
}

/** The drag's touched bounds as a list of changes. */
function touchedChanges(drag: DragState): AnnotationBoundsChange[] {
  return [...drag.touched.values()];
}

/** The touched ids with the bounds they had when the drag began. */
function snapshotBounds(drag: DragState): AnnotationBoundsChange[] {
  const before = new Map(drag.snapshot.map((a) => [a.id, a]));
  return [...drag.touched.keys()].flatMap((id) => {
    const old = before.get(id);
    return old ? [{ id, start: old.start, end: old.end }] : [];
  });
}

/** The store's current list with the drag's moves on top. */
function shownDuringDrag(drag: DragState): readonly AnnotationData[] {
  return applyAnnotationBounds(drag.store.getAnnotations(), touchedChanges(drag));
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
 * const { annotationStore, annotationPreview } = usePlaybackControls();
 * const { onDragStart, onDragMove, onDragEnd } = useAnnotationDragHandlers({
 *   store: annotationStore,
 *   preview: annotationPreview,
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
  store,
  samplesPerPixel,
  // Default mirrors the engine default; the providers always pass the real rate from context (#510).
  sampleRate = 48000,
  duration,
  linkEndpoints,
  preview,
}: UseAnnotationDragHandlersOptions) {
  const dragRef = React.useRef<DragState | null>(null);

  // Read through refs so the handlers keep their identity for the whole drag.
  const storeRef = React.useRef(store);
  storeRef.current = store;
  const previewRef = React.useRef(preview);
  previewRef.current = preview;

  /** End the drag without writing anything; clear its preview. */
  const abandon = React.useCallback(() => {
    if (!dragRef.current) return;
    dragRef.current = null;
    previewRef.current?.publish(null);
  }, []);

  // The drag follows its store (#867). A change made elsewhere is drawn at
  // once under the drag's moves (maintainer, 2026-11-24). When the dragged
  // annotation is removed (or the list cleared), or the provider is given
  // another store, or the component unmounts, the drag ends and writes nothing.
  React.useEffect(() => {
    if (!store) return;
    const unsubscribe = store.subscribe(() => {
      const drag = dragRef.current;
      if (!drag || drag.store !== store) return;
      if (!store.getAnnotations().some((a) => a.id === drag.draggedId)) {
        abandon();
        return;
      }
      const shown = previewRef.current;
      if (shown && shown.source.getSnapshot() !== null) {
        shown.publish(shownDuringDrag(drag) as AnnotationData[]);
      }
    });
    return () => {
      unsubscribe();
      abandon();
    };
  }, [store, abandon]);

  // A drag that never ends (its component unmounts mid-drag) must not leave
  // its preview on screen.
  React.useEffect(() => abandon, [preview, abandon]);

  const onDragStart = React.useCallback((event: DragStartEvent) => {
    const data = event.operation.source?.data as
      | {
          annotationId: string;
          annotationIndex: number;
          edge: 'start' | 'end';
        }
      | undefined;

    const owner = storeRef.current;
    if (!owner || !data) {
      dragRef.current = null;
      return;
    }
    const snapshot = owner.getAnnotations();
    const annotation =
      data.annotationIndex === undefined ? undefined : snapshot[data.annotationIndex];
    dragRef.current = annotation
      ? {
          store: owner,
          snapshot,
          touched: new Map(),
          draggedId: annotation.id,
          edge: data.edge,
          start: annotation.start,
          end: annotation.end,
        }
      : null;
  }, []);

  const onDragMove = React.useCallback(
    (event: DragMoveEvent) => {
      const drag = dragRef.current;
      if (!drag) return;
      if (drag.store !== storeRef.current) {
        abandon();
        return;
      }

      // The dragmove event is dispatched BEFORE position.current is updated (happens
      // in a microtask), so the snapshot's position.current is stale. Use event.to
      // (the pointer's current coordinates from the sensor) for the correct position.
      const currentX = event.to?.x ?? event.operation.position.current.x;
      const rawDeltaX = currentX - event.operation.position.initial.x;
      const timeDelta = (rawDeltaX * samplesPerPixel) / sampleRate;
      const newTime = drag.edge === 'start' ? drag.start + timeDelta : drag.end + timeDelta;

      // Each move runs over the store's current list with the drag's moves so
      // far on top: a neighbour the app moved during the drag collides where
      // it is now (maintainer's choice, 2026-11-24), and #747 still holds (an
      // edge dragged into a separated neighbour carries it along, because the
      // carried neighbour stays in `touched`). The dragged annotation is found
      // by id: an insert before it shifts its index.
      const base = shownDuringDrag(drag);
      const annotationIndex = base.findIndex((a) => a.id === drag.draggedId);
      if (annotationIndex < 0) {
        abandon();
        return;
      }
      // The boundary logic (linked endpoints, collisions) is core's, shared with
      // dawcore's annotation track.
      const updated = updateAnnotationBoundaries({
        annotationIndex,
        newTime,
        isDraggingStart: drag.edge === 'start',
        annotations: base,
        duration,
        linkEndpoints,
      });
      updated.forEach((annotation, i) => {
        const was = base[i];
        if (
          drag.touched.has(annotation.id) ||
          was.start !== annotation.start ||
          was.end !== annotation.end
        ) {
          drag.touched.set(annotation.id, {
            id: annotation.id,
            start: annotation.start,
            end: annotation.end,
          });
        }
      });

      if (preview) {
        preview.publish(updated);
      } else {
        const changes = touchedChanges(drag);
        drag.store.update((current) => applyAnnotationBounds(current, changes));
      }
    },
    [samplesPerPixel, sampleRate, duration, linkEndpoints, preview, abandon]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;
      if (drag.store !== storeRef.current) {
        preview?.publish(null);
        return;
      }

      if (!preview) {
        // The moves were written as they happened; a cancelled drag takes
        // them all back, the neighbours it moved included.
        if (event.canceled) {
          const restore = snapshotBounds(drag);
          drag.store.update((current) => applyAnnotationBounds(current, restore));
        }
        return;
      }

      if (preview.source.getSnapshot() === null) return;
      if (event.canceled) {
        preview.publish(null);
        return;
      }
      // Committed and cleared in one synchronous render, so the boxes never
      // show the old positions between the two.
      flushSync(() => {
        // Only what the drag moved, onto the list as it is now. When the
        // dragged annotation is gone, the release does nothing (#867).
        // The preview is cleared also when the app's rule throws.
        try {
          const changes = touchedChanges(drag);
          drag.store.update((current) =>
            current.some((a) => a.id === drag.draggedId)
              ? applyAnnotationBounds(current, changes)
              : current
          );
        } finally {
          preview.publish(null);
        }
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
