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
 * the annotations as the drag would leave them, or `null` when no drag is
 * running. Both providers have one (`annotationPreview` in their controls).
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
  /** The annotations as they were when the drag began. */
  snapshot: readonly AnnotationData[];
  /** The snapshot with every move so far applied (#747: each move builds on the last). */
  working: readonly AnnotationData[];
  draggedId: string;
  start: number;
  end: number;
  annotationIndex: number;
}

/** The bounds `working` changed against `snapshot`, by id. */
function movedBounds(
  snapshot: readonly AnnotationData[],
  working: readonly AnnotationData[]
): AnnotationBoundsChange[] {
  const before = new Map(snapshot.map((a) => [a.id, a]));
  const moved: AnnotationBoundsChange[] = [];
  for (const annotation of working) {
    const old = before.get(annotation.id);
    if (old && (old.start !== annotation.start || old.end !== annotation.end)) {
      moved.push({ id: annotation.id, start: annotation.start, end: annotation.end });
    }
  }
  return moved;
}

/** `moved`'s ids with the bounds they had in `snapshot`. */
function restoredBounds(
  snapshot: readonly AnnotationData[],
  moved: readonly AnnotationBoundsChange[]
): AnnotationBoundsChange[] {
  const before = new Map(snapshot.map((a) => [a.id, a]));
  return moved.flatMap((change) => {
    const old = before.get(change.id);
    return old ? [{ id: old.id, start: old.start, end: old.end }] : [];
  });
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

  /** Write `changes` by id onto the store's current list. */
  const write = React.useCallback((changes: readonly AnnotationBoundsChange[]) => {
    storeRef.current?.update((current) => applyAnnotationBounds(current, changes));
  }, []);

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

    const owner = storeRef.current;
    if (!owner) {
      dragRef.current = null;
      return;
    }
    const snapshot = owner.getAnnotations();
    const annotation =
      data?.annotationIndex === undefined ? undefined : snapshot[data.annotationIndex];
    dragRef.current =
      data && annotation
        ? {
            snapshot,
            working: snapshot,
            draggedId: annotation.id,
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
        annotations: drag.working,
        duration,
        linkEndpoints,
      });
      drag.working = updatedAnnotations;

      if (preview) {
        preview.publish(updatedAnnotations);
      } else {
        write(movedBounds(drag.snapshot, updatedAnnotations));
      }
    },
    [samplesPerPixel, sampleRate, duration, linkEndpoints, preview, write]
  );

  const onDragEnd = React.useCallback(
    (event: DragEndEvent) => {
      const drag = dragRef.current;
      dragRef.current = null;
      if (!drag) return;

      if (!preview) {
        // The moves were written as they happened; a cancelled drag takes
        // them all back, the neighbours it moved included.
        if (event.canceled) {
          write(restoredBounds(drag.snapshot, movedBounds(drag.snapshot, drag.working)));
        }
        return;
      }

      const result = preview.source.getSnapshot();
      if (result === null) return;
      if (event.canceled) {
        preview.publish(null);
        return;
      }
      const owner = storeRef.current;
      // Committed and cleared in one synchronous render, so the boxes never
      // show the old positions between the two.
      flushSync(() => {
        // Only what the drag moved, onto the list as it is now. When the
        // dragged annotation is gone, the release does nothing (#867).
        const moved = movedBounds(drag.snapshot, result);
        owner?.update((current) =>
          current.some((a) => a.id === drag.draggedId)
            ? applyAnnotationBounds(current, moved)
            : current
        );
        preview.publish(null);
      });
    },
    [preview, write]
  );

  return {
    onDragStart,
    onDragMove,
    onDragEnd,
  };
}
