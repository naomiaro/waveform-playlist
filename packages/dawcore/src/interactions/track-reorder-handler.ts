/**
 * Vertical track-reorder drag for the controls column. Follows the
 * pointer-handler host pattern: pointerdown on the grip (surfaced from
 * <daw-track-controls>' shadow DOM via daw-track-reorder-grab) +
 * setPointerCapture, Y-midpoint hit testing against control rows, translate
 * preview, commit on pointerup, revert on pointercancel. Covers mouse,
 * touch, and pen uniformly.
 */

export interface TrackReorderHost {
  readonly isConnected: boolean;
  shadowRoot: ShadowRoot | null;
  reorderTrack(trackId: string, toIndex: number): void;
}

interface RowInfo {
  el: HTMLElement;
  top: number;
  height: number;
  trackId: string;
}

export class TrackReorderHandler {
  private _host: TrackReorderHost;
  private _trackId: string | null = null;
  private _pointerId = -1;
  private _startY = 0;
  private _rows: RowInfo[] = [];
  private _lanes: (RowInfo | null)[] = []; // aligned with _rows indices; null = lane not found
  private _fromIndex = 0;
  private _targetIndex = 0;
  private _gripEl: HTMLElement | null = null;

  constructor(host: TrackReorderHost) {
    this._host = host;
  }

  private static _reducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
  }

  onGrab = (trackId: string, e: PointerEvent, gripEl: HTMLElement): void => {
    if (this._trackId !== null) return; // one drag at a time
    const column = this._host.shadowRoot?.querySelector('.controls-column');
    if (!column) return;
    const rows = [...column.querySelectorAll('daw-track-controls')] as HTMLElement[];
    this._rows = rows.map((el) => {
      const rect = el.getBoundingClientRect();
      return {
        el,
        top: rect.top,
        height: rect.height,
        trackId: (el as HTMLElement & { trackId: string | null }).trackId ?? '',
      };
    });
    this._fromIndex = this._rows.findIndex((r) => r.trackId === trackId);
    if (this._fromIndex === -1) {
      this._rows = [];
      return;
    }
    this._trackId = trackId;
    this._targetIndex = this._fromIndex;
    this._pointerId = e.pointerId;
    this._startY = e.clientY;
    this._gripEl = gripEl;

    // Waveform-lane parity (drag-preview spec): snapshot the shadow timeline's
    // .track-row lanes by trackId. Transform-only mirroring — lane DOM order
    // never changes, so the editor's MutationObserver order-sync never fires.
    const timeline = this._host.shadowRoot?.querySelector('.timeline');
    const laneEls = timeline ? ([...timeline.querySelectorAll('.track-row')] as HTMLElement[]) : [];
    this._lanes = this._rows.map((r) => {
      const el = laneEls.find((l) => l.getAttribute('data-track-id') === r.trackId) ?? null;
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { el, top: rect.top, height: rect.height, trackId: r.trackId };
    });

    const draggedLane = this._lanes[this._fromIndex];
    if (draggedLane) {
      draggedLane.el.setAttribute('data-track-drag-source', '');
      draggedLane.el.style.zIndex = '10';
      draggedLane.el.style.position = 'relative';
    }
    if (!TrackReorderHandler._reducedMotion()) {
      // Displaced rows and ALL lanes animate; the dragged CONTROLS row does not
      // (it pixel-follows the pointer, a transition would make it lag).
      for (let i = 0; i < this._rows.length; i++) {
        if (i !== this._fromIndex) this._rows[i].el.style.transition = 'transform 150ms ease';
        const lane = this._lanes[i];
        if (lane) lane.el.style.transition = 'transform 150ms ease';
      }
    }

    try {
      gripEl.setPointerCapture(e.pointerId);
    } catch {
      // Fabricated pointerIds (tests) can't be captured — listeners still work.
    }
    gripEl.addEventListener('pointermove', this._onPointerMove);
    gripEl.addEventListener('pointerup', this._onPointerUp);
    gripEl.addEventListener('pointercancel', this._onPointerCancel);
  };

  /** Abort any in-progress drag and reset state. Called by the editor on
   *  disconnect — without this, a drag interrupted by editor removal (with no
   *  pointercancel delivered) would leave the handler wedged and silently
   *  block every future grab. */
  cancel(): void {
    this._cleanup();
  }

  private _onPointerMove = (e: PointerEvent): void => {
    if (e.pointerId !== this._pointerId || this._trackId === null) return;
    const dragged = this._rows[this._fromIndex];
    const dy = e.clientY - this._startY;
    dragged.el.style.transform = 'translateY(' + dy + 'px)';
    dragged.el.style.zIndex = '10';
    dragged.el.style.position = 'relative';

    // Target slot: crossing another row's midpoint claims its slot.
    let target = this._fromIndex;
    for (let i = 0; i < this._rows.length; i++) {
      if (i === this._fromIndex) continue;
      const mid = this._rows[i].top + this._rows[i].height / 2;
      if (i < this._fromIndex && e.clientY < mid) {
        target = i;
        break;
      }
      if (i > this._fromIndex && e.clientY > mid) {
        target = i;
      }
    }
    this._targetIndex = target;

    // Shift displaced rows out of the way.
    for (let i = 0; i < this._rows.length; i++) {
      if (i === this._fromIndex) continue;
      const row = this._rows[i];
      let shift = 0;
      if (i > this._fromIndex && i <= target) shift = -dragged.height;
      else if (i < this._fromIndex && i >= target) shift = dragged.height;
      row.el.style.transform = shift === 0 ? '' : 'translateY(' + shift + 'px)';
    }

    // Mirror the preview onto the waveform lanes.
    const draggedLaneInfo = this._lanes[this._fromIndex];
    for (let i = 0; i < this._lanes.length; i++) {
      const lane = this._lanes[i];
      if (!lane || !draggedLaneInfo) continue;
      if (i === this._fromIndex) {
        // Slot-snap the dragged lane to the target slot (not pixel-follow).
        let offset = 0;
        const targetLane = this._lanes[target];
        if (targetLane && target > this._fromIndex) {
          offset =
            targetLane.top + targetLane.height - (draggedLaneInfo.top + draggedLaneInfo.height);
        } else if (targetLane && target < this._fromIndex) {
          offset = targetLane.top - draggedLaneInfo.top;
        }
        lane.el.style.transform = offset === 0 ? '' : 'translateY(' + offset + 'px)';
        continue;
      }
      let laneShift = 0;
      if (i > this._fromIndex && i <= target) laneShift = -draggedLaneInfo.height;
      else if (i < this._fromIndex && i >= target) laneShift = draggedLaneInfo.height;
      lane.el.style.transform = laneShift === 0 ? '' : 'translateY(' + laneShift + 'px)';
    }
  };

  private _onPointerUp = (e: PointerEvent): void => {
    if (e.pointerId !== this._pointerId || this._trackId === null) return;
    const trackId = this._trackId;
    const target = this._targetIndex;
    const from = this._fromIndex;
    this._cleanup();
    if (target !== from) {
      this._host.reorderTrack(trackId, target);
    }
  };

  private _onPointerCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this._pointerId) return;
    this._cleanup();
  };

  private _cleanup(): void {
    for (const row of this._rows) {
      row.el.style.transform = '';
      row.el.style.zIndex = '';
      row.el.style.position = '';
      row.el.style.transition = '';
    }
    for (const lane of this._lanes) {
      if (!lane) continue;
      lane.el.style.transform = '';
      lane.el.style.transition = '';
      lane.el.style.zIndex = '';
      lane.el.style.position = '';
      lane.el.removeAttribute('data-track-drag-source');
    }
    this._lanes = [];
    const grip = this._gripEl;
    if (grip) {
      grip.removeEventListener('pointermove', this._onPointerMove);
      grip.removeEventListener('pointerup', this._onPointerUp);
      grip.removeEventListener('pointercancel', this._onPointerCancel);
      try {
        grip.releasePointerCapture(this._pointerId);
      } catch {
        // already released / fabricated pointerId
      }
    }
    this._gripEl = null;
    this._trackId = null;
    this._pointerId = -1;
    this._rows = [];
  }
}
