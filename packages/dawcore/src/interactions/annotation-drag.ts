import { updateAnnotationBoundaries, snapTickToGrid } from '@waveform-playlist/core';
import {
  ANNOTATION_LINK_THRESHOLD_TICKS,
  annotationMinDurationTicks,
} from '@waveform-playlist/core';
import type { AnnotationData, SnapTo, MeterEntry } from '@waveform-playlist/core';
import {
  applyBoundaryResults,
  applyTickBoundaryResults,
  tickSpaceData,
  type DawAnnotationTrackElement,
} from '../elements/daw-annotation-track';
import { DRAG_THRESHOLD } from './constants';

export interface AnnotationDragHost {
  effectiveSampleRate: number;
  _renderSpp: number;
  _annotationClampDuration: number;
  seekTo(time: number): void;
  scaleMode: string;
  ticksPerPixel: number;
  snapTo: SnapTo;
  _meterEntries: MeterEntry[];
  ppqn: number;
  _secondsToTicks(seconds: number): number;
  _ticksToSeconds(ticks: number): number;
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
  /** 'ticks' when the dragged annotation is tick-based; 'seconds' otherwise. */
  mode: 'seconds' | 'ticks';
  /** Snapshot at drag start — pointercancel restores it. In 'ticks' mode this
   * is tick-space data (see tickSpaceData); in 'seconds' mode it's the
   * ordinary AnnotationData snapshot. */
  snapshot: AnnotationData[];
  /** Edge time at drag start (boundary drags). Ticks in 'ticks' mode,
   * seconds in 'seconds' mode. */
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

    const elements = track.annotationElements;
    const el = elements.find((x) => x.annotationId === annotationId);
    if (!el) return;
    const mode: 'seconds' | 'ticks' = el.isTickBased ? 'ticks' : 'seconds';
    const snapshot =
      mode === 'ticks' ? elements.map((x) => tickSpaceData(x, this._host)) : track.annotations;
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
      mode,
      snapshot,
      // edgeTime holds ticks in 'ticks' mode, seconds in 'seconds' mode.
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

    const elements = drag.track.annotationElements;
    const index = drag.snapshot.findIndex((a) => a.id === drag.annotationId);
    if (index === -1) return;

    if (drag.mode === 'ticks') {
      // px → tick delta: beats mode is tick-linear; temporal mode converts
      // through seconds at the edge's local tempo.
      const deltaTicks =
        this._host.scaleMode === 'beats'
          ? deltaPx * this._host.ticksPerPixel
          : this._host._secondsToTicks(
              this._host._ticksToSeconds(drag.edgeTime) +
                (deltaPx * this._host._renderSpp) / this._host.effectiveSampleRate
            ) - drag.edgeTime;
      let newTick = drag.edgeTime + deltaTicks;
      if (this._host.scaleMode === 'beats' && this._host.snapTo !== 'off') {
        newTick = snapTickToGrid(
          newTick,
          this._host.snapTo,
          this._host._meterEntries,
          this._host.ppqn
        );
      }
      const clamp = this._host._annotationClampDuration;
      const updated = updateAnnotationBoundaries(
        {
          annotationIndex: index,
          newTime: newTick,
          isDraggingStart: drag.edge === 'start',
          annotations: drag.snapshot,
          duration: clamp === Infinity ? Infinity : this._host._secondsToTicks(clamp),
          linkEndpoints: drag.track.linkEndpoints,
        },
        {
          linkThreshold: ANNOTATION_LINK_THRESHOLD_TICKS,
          minDuration: annotationMinDurationTicks(this._host.ppqn),
        }
      );
      applyTickBoundaryResults(
        elements,
        elements.map((x) => tickSpaceData(x, this._host)),
        updated,
        (t) => this._host._ticksToSeconds(t)
      );
      return;
    }

    const deltaSeconds = (deltaPx * this._host._renderSpp) / this._host.effectiveSampleRate;
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
    if (drag.mode === 'ticks') {
      applyTickBoundaryResults(
        elements,
        elements.map((x) => tickSpaceData(x, this._host)),
        drag.snapshot,
        (t) => this._host._ticksToSeconds(t)
      );
    } else {
      applyBoundaryResults(
        elements,
        elements.map((el) => el.toAnnotationData()),
        drag.snapshot
      );
    }
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
