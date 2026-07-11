import { updateAnnotationBoundaries } from '@waveform-playlist/core';
import type { AnnotationData } from '@waveform-playlist/core';
import {
  applyBoundaryResults,
  type DawAnnotationTrackElement,
} from '../elements/daw-annotation-track';
import { DRAG_THRESHOLD } from './constants';

export interface AnnotationDragHost {
  effectiveSampleRate: number;
  _renderSpp: number;
  _annotationClampDuration: number;
  seekTo(time: number): void;
}

interface DragState {
  track: DawAnnotationTrackElement;
  captureEl: HTMLElement;
  pointerId: number;
  startClientX: number;
  moved: boolean;
  /** Boundary drag only (null = box click candidate). */
  edge: 'start' | 'end' | null;
  annotationId: string;
  /** Snapshot at drag start — pointercancel restores it. */
  snapshot: AnnotationData[];
  /** Edge time at drag start (boundary drags). */
  edgeTime: number;
}

/**
 * Pointer interaction for annotation lanes: boundary drag (write-through via
 * core boundary math), box click-to-select+seek, cancel-restores-snapshot.
 * Wired by <daw-editor> as the renderLanes pointerdown callback.
 */
export class AnnotationDragHandler {
  private _host: AnnotationDragHost;
  private _drag: DragState | null = null;

  constructor(host: AnnotationDragHost) {
    this._host = host;
  }

  onPointerDown = (e: PointerEvent, track: DawAnnotationTrackElement): void => {
    const target = e.target as HTMLElement;
    const boundary = target.closest('.annotation-boundary') as HTMLElement | null;
    const box = target.closest('.annotation-box') as HTMLElement | null;
    if (!box) return; // empty lane space — fall through to timeline seek

    const annotationId = box.getAttribute('data-annotation-id') ?? '';
    const isBoundary = boundary !== null && track.editable;
    if (boundary !== null && !track.editable) {
      // Boundary handles are only rendered when editable, but guard anyway.
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const snapshot = track.annotations;
    const index = snapshot.findIndex((a) => a.id === annotationId);
    if (index === -1) return;

    const edge = isBoundary ? (boundary.getAttribute('data-edge') as 'start' | 'end') : null;
    const captureEl = isBoundary ? boundary : box;

    this._drag = {
      track,
      captureEl,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      moved: false,
      edge,
      annotationId,
      snapshot,
      edgeTime: edge === 'start' ? snapshot[index].start : snapshot[index].end,
    };

    try {
      captureEl.setPointerCapture(e.pointerId);
    } catch {
      // Fabricated pointerIds (tests) or detached elements — capture is best-effort.
    }
    captureEl.addEventListener('pointermove', this._onPointerMove as EventListener);
    captureEl.addEventListener('pointerup', this._onPointerUp as EventListener);
    captureEl.addEventListener('pointercancel', this._onPointerCancel as EventListener);
  };

  /** Non-private (underscore convention) so tests can drive moves directly. */
  _onPointerMove = (e: PointerEvent): void => {
    const drag = this._drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const deltaPx = e.clientX - drag.startClientX;
    if (Math.abs(deltaPx) >= DRAG_THRESHOLD) drag.moved = true;
    if (drag.edge === null || !drag.moved) return;

    const deltaSeconds = (deltaPx * this._host._renderSpp) / this._host.effectiveSampleRate;
    const elements = drag.track.annotationElements;
    const index = drag.snapshot.findIndex((a) => a.id === drag.annotationId);
    if (index === -1) return;
    // Compute from the drag-start snapshot each move — cumulative deltas
    // against live state would compound the link/collision adjustments.
    const updated = updateAnnotationBoundaries({
      annotationIndex: index,
      newTime: drag.edgeTime + deltaSeconds,
      isDraggingStart: drag.edge === 'start',
      annotations: drag.snapshot,
      duration: this._host._annotationClampDuration,
      linkEndpoints: drag.track.linkEndpoints,
    });
    applyBoundaryResults(
      elements,
      elements.map((el) => el.toAnnotationData()),
      updated
    );
  };

  _onPointerUp = (e: PointerEvent): void => {
    const drag = this._drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved && drag.edge === null) {
      // Click: select + seek to the annotation start.
      const data = drag.track.annotations.find((a) => a.id === drag.annotationId);
      if (data) {
        drag.track.activeAnnotationId = drag.annotationId;
        this._host.seekTo(data.start);
      }
    }
    this._teardown();
  };

  _onPointerCancel = (e: PointerEvent): void => {
    const drag = this._drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    // Restore the drag-start snapshot — a cancelled drag must not commit.
    const elements = drag.track.annotationElements;
    applyBoundaryResults(
      elements,
      elements.map((el) => el.toAnnotationData()),
      drag.snapshot
    );
    this._teardown();
  };

  private _teardown(): void {
    const drag = this._drag;
    if (!drag) return;
    try {
      drag.captureEl.releasePointerCapture(drag.pointerId);
    } catch {
      // Already released or never captured.
    }
    drag.captureEl.removeEventListener('pointermove', this._onPointerMove as EventListener);
    drag.captureEl.removeEventListener('pointerup', this._onPointerUp as EventListener);
    drag.captureEl.removeEventListener('pointercancel', this._onPointerCancel as EventListener);
    this._drag = null;
  }
}
