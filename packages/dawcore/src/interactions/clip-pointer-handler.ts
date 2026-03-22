import { DRAG_THRESHOLD } from './constants';

/** Narrow engine contract for clip move/trim interactions. */
export interface ClipEngineContract {
  moveClip(trackId: string, clipId: string, deltaSamples: number): void;
  trimClip(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): void;
}

/** Host interface required by ClipPointerHandler. */
export interface ClipPointerHost {
  readonly samplesPerPixel: number;
  readonly effectiveSampleRate: number;
  readonly interactiveClips: boolean;
  readonly engine: ClipEngineContract | null;
  readonly shadowRoot: ShadowRoot | null;
  dispatchEvent(event: Event): boolean;
  requestUpdate(): void;
}

type DragMode = 'move' | 'trim-left' | 'trim-right';

/**
 * Handles pointer interactions for clip move and trim drag operations.
 * Converts pixel deltas to sample deltas and delegates to the engine.
 *
 * Move: sends incremental deltas per-frame (engine shifts startSample additively).
 * Trim: updates clip container CSS imperatively during drag for visual feedback,
 *   then applies cumulative delta to engine once at drag end.
 */
export class ClipPointerHandler {
  private _host: ClipPointerHost;
  private _mode: DragMode | null = null;
  private _clipId = '';
  private _trackId = '';
  private _startPx = 0;
  private _isDragging = false;
  private _lastDeltaPx = 0;
  private _cumulativeDeltaSamples = 0;
  // Trim visual feedback: snapshot of original clip container CSS
  private _clipContainer: HTMLElement | null = null;
  private _originalLeft = 0;
  private _originalWidth = 0;

  constructor(host: ClipPointerHost) {
    this._host = host;
  }

  /** Returns true if a drag interaction is currently in progress. */
  get isActive(): boolean {
    return this._mode !== null;
  }

  /**
   * Attempts to handle a pointerdown event on the given target element.
   * Returns true if the target is a recognized clip interaction element.
   */
  tryHandle(target: Element, e: PointerEvent): boolean {
    if (!this._host.interactiveClips) return false;

    // Walk up from click target to find clip interaction elements.
    // composedPath()[0] may be a child (e.g. <span> inside .clip-header).
    const boundary = (target as HTMLElement).closest?.('.clip-boundary') as HTMLElement | null;
    const header = (target as HTMLElement).closest?.('.clip-header') as HTMLElement | null;

    // Check boundary first (higher z-index, overlaps header at corners)
    if (boundary && boundary.dataset.boundaryEdge !== undefined) {
      const clipId = boundary.dataset.clipId;
      const trackId = boundary.dataset.trackId;
      const edge = boundary.dataset.boundaryEdge as 'left' | 'right';
      if (!clipId || !trackId || (edge !== 'left' && edge !== 'right')) return false;

      this._beginDrag(edge === 'left' ? 'trim-left' : 'trim-right', clipId, trackId, e);
      return true;
    }

    // Check for clip header (move target)
    if (header && header.dataset.interactive !== undefined) {
      const clipId = header.dataset.clipId;
      const trackId = header.dataset.trackId;
      if (!clipId || !trackId) return false;

      this._beginDrag('move', clipId, trackId, e);
      return true;
    }

    return false;
  }

  private _beginDrag(mode: DragMode, clipId: string, trackId: string, e: PointerEvent): void {
    this._mode = mode;
    this._clipId = clipId;
    this._trackId = trackId;
    this._startPx = e.clientX;
    this._isDragging = false;
    this._lastDeltaPx = 0;
    this._cumulativeDeltaSamples = 0;

    // For trim: snapshot the clip container's current position/width
    if (mode === 'trim-left' || mode === 'trim-right') {
      const container = this._host.shadowRoot?.querySelector(
        `.clip-container[data-clip-id="${clipId}"]`
      ) as HTMLElement | null;
      if (container) {
        this._clipContainer = container;
        this._originalLeft = parseFloat(container.style.left) || 0;
        this._originalWidth = parseFloat(container.style.width) || 0;
      }
    }
  }

  /** Processes pointermove events during an active drag. */
  onPointerMove(e: PointerEvent): void {
    if (this._mode === null) return;

    const totalDeltaPx = e.clientX - this._startPx;

    // Activate drag after threshold is exceeded
    if (!this._isDragging && Math.abs(totalDeltaPx) > DRAG_THRESHOLD) {
      this._isDragging = true;
    }

    if (!this._isDragging) return;

    const engine = this._host.engine;
    if (!engine) return;

    if (this._mode === 'move') {
      // Move: send incremental deltas per-frame (additive on startSample)
      const incrementalDeltaPx = totalDeltaPx - this._lastDeltaPx;
      this._lastDeltaPx = totalDeltaPx;
      const incrementalDeltaSamples = Math.round(
        incrementalDeltaPx * this._host.samplesPerPixel
      );
      this._cumulativeDeltaSamples += incrementalDeltaSamples;
      engine.moveClip(this._trackId, this._clipId, incrementalDeltaSamples);
    } else {
      // Trim: track cumulative delta — engine called once at pointerup.
      this._cumulativeDeltaSamples = Math.round(totalDeltaPx * this._host.samplesPerPixel);

      // Visual feedback: update clip container CSS imperatively
      if (this._clipContainer) {
        const deltaPx = Math.round(totalDeltaPx);
        if (this._mode === 'trim-left') {
          // Left trim: move left edge right → container shifts right and shrinks
          const newLeft = this._originalLeft + deltaPx;
          const newWidth = this._originalWidth - deltaPx;
          if (newWidth > 0) {
            this._clipContainer.style.left = newLeft + 'px';
            this._clipContainer.style.width = newWidth + 'px';
          }
        } else {
          // Right trim: extend/shrink right edge
          const newWidth = this._originalWidth + deltaPx;
          if (newWidth > 0) {
            this._clipContainer.style.width = newWidth + 'px';
          }
        }
      }
    }
  }

  /** Processes pointerup events to finalize and dispatch result events. */
  onPointerUp(_e: PointerEvent): void {
    if (this._mode === null) return;

    try {
      if (!this._isDragging || this._cumulativeDeltaSamples === 0) {
        // Restore original CSS if trim drag didn't produce a delta
        this._restoreTrimVisual();
        return;
      }

      const engine = this._host.engine;

      if (this._mode === 'move') {
        this._host.dispatchEvent(
          new CustomEvent('daw-clip-move', {
            bubbles: true,
            composed: true,
            detail: {
              trackId: this._trackId,
              clipId: this._clipId,
              deltaSamples: this._cumulativeDeltaSamples,
            },
          })
        );
      } else {
        // Restore visual before engine applies — Lit will re-render with correct values
        this._restoreTrimVisual();

        // Trim: apply cumulative delta to engine in one shot
        const boundary = this._mode === 'trim-left' ? 'left' : 'right';
        if (engine) {
          engine.trimClip(this._trackId, this._clipId, boundary, this._cumulativeDeltaSamples);
        }
        this._host.dispatchEvent(
          new CustomEvent('daw-clip-trim', {
            bubbles: true,
            composed: true,
            detail: {
              trackId: this._trackId,
              clipId: this._clipId,
              boundary,
              deltaSamples: this._cumulativeDeltaSamples,
            },
          })
        );
      }
    } finally {
      this._reset();
    }
  }

  /** Restore clip container CSS to original values after trim visual preview. */
  private _restoreTrimVisual(): void {
    if (this._clipContainer) {
      this._clipContainer.style.left = this._originalLeft + 'px';
      this._clipContainer.style.width = this._originalWidth + 'px';
    }
  }

  private _reset(): void {
    this._mode = null;
    this._clipId = '';
    this._trackId = '';
    this._startPx = 0;
    this._isDragging = false;
    this._lastDeltaPx = 0;
    this._cumulativeDeltaSamples = 0;
    this._clipContainer = null;
    this._originalLeft = 0;
    this._originalWidth = 0;
  }
}
