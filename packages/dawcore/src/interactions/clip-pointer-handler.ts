import { DRAG_THRESHOLD } from './constants';

/** Snapshot of a clip's bounds for trim constraint computation. */
export interface ClipBounds {
  readonly offsetSamples: number;
  readonly durationSamples: number;
  readonly startSample: number;
  readonly sourceDurationSamples: number;
}

/** Narrow engine contract for clip move/trim interactions. */
export interface ClipEngineContract {
  moveClip(trackId: string, clipId: string, deltaSamples: number, skipAdapter?: boolean): number;
  trimClip(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number,
    skipAdapter?: boolean
  ): void;
  updateTrack(trackId: string): void;
  /** Get a clip's full bounds for trim constraint computation. */
  getClipBounds(trackId: string, clipId: string): ClipBounds | null;
  /** Constrain a trim delta using the engine's collision/bounds logic. */
  constrainTrimDelta(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): number;
  /** Begin a transaction — groups mutations into one undo step. */
  beginTransaction(): void;
  /** Commit the transaction — pushes one undo step for all grouped mutations. */
  commitTransaction(): void;
  /** Abort the transaction — restores pre-transaction state without pushing to undo. */
  abortTransaction(): void;
}

/** Peak data returned by reextractClipPeaks for imperative waveform updates. */
export interface ClipPeakSlice {
  data: ArrayLike<number>[];
  length: number;
}

/** Host interface required by ClipPointerHandler. */
export interface ClipPointerHost {
  readonly samplesPerPixel: number;
  readonly effectiveSampleRate: number;
  readonly interactiveClips: boolean;
  readonly engine: ClipEngineContract | null;
  readonly shadowRoot: ShadowRoot | null;
  dispatchEvent(event: Event): boolean;
  /** Re-extract peaks for a clip at new offset/duration from cached WaveformData. */
  reextractClipPeaks(
    clipId: string,
    offsetSamples: number,
    durationSamples: number
  ): ClipPeakSlice | null;
}

type DragMode = 'move' | 'trim-left' | 'trim-right';

/**
 * Handles pointer interactions for clip move and trim drag operations.
 * Converts pixel deltas to sample deltas and delegates to the engine.
 *
 * Move: sends incremental deltas per-frame with skipAdapter=true (engine shifts
 *   startSample additively without touching audio adapter). Adapter synced once
 *   via updateTrack() at drag end.
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
  // Trim visual feedback: snapshot of original clip state
  private _clipContainer: HTMLElement | null = null;
  private _boundaryEl: HTMLElement | null = null;
  private _originalLeft = 0;
  private _originalWidth = 0;
  private _originalOffsetSamples = 0;
  private _originalDurationSamples = 0;

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
      this._boundaryEl = boundary;
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

    // Group all drag mutations into one undo step
    if (this._host.engine) {
      this._host.engine.beginTransaction();
    } else {
      console.warn(
        '[dawcore] beginDrag: engine unavailable, drag mutations will not be grouped for undo'
      );
    }

    // For trim: snapshot the clip container's current position/width
    if (mode === 'trim-left' || mode === 'trim-right') {
      const container = this._host.shadowRoot?.querySelector(
        `.clip-container[data-clip-id="${clipId}"]`
      ) as HTMLElement | null;
      if (container) {
        this._clipContainer = container;
        this._originalLeft = parseFloat(container.style.left) || 0;
        this._originalWidth = parseFloat(container.style.width) || 0;
      } else {
        console.warn('[dawcore] clip container not found for trim visual feedback: ' + clipId);
      }
      // Snapshot clip audio bounds for peak re-extraction during drag
      const engine = this._host.engine;
      if (engine) {
        const bounds = engine.getClipBounds(trackId, clipId);
        if (bounds) {
          this._originalOffsetSamples = bounds.offsetSamples;
          this._originalDurationSamples = bounds.durationSamples;
        }
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
      // Apply .dragging class to boundary element for active drag styling
      if (this._boundaryEl) {
        this._boundaryEl.classList.add('dragging');
      }
    }

    if (!this._isDragging) return;

    const engine = this._host.engine;
    if (!engine) return;

    if (this._mode === 'move') {
      // Move: send incremental deltas per-frame with skipAdapter=true.
      // Adapter synced once via updateTrack() at drag end.
      const incrementalDeltaPx = totalDeltaPx - this._lastDeltaPx;
      this._lastDeltaPx = totalDeltaPx;
      const incrementalDeltaSamples = Math.round(incrementalDeltaPx * this._host.samplesPerPixel);
      // Track constrained delta (not raw) so undo transactions are accurate
      const applied = engine.moveClip(this._trackId, this._clipId, incrementalDeltaSamples, true);
      this._cumulativeDeltaSamples += applied;
    } else {
      // Trim: constrain delta using engine's full collision/bounds logic,
      // then track for visual feedback. Engine called once at pointerup.
      const boundary = this._mode === 'trim-left' ? 'left' : 'right';
      const rawDeltaSamples = Math.round(totalDeltaPx * this._host.samplesPerPixel);
      const deltaSamples = engine.constrainTrimDelta(
        this._trackId,
        this._clipId,
        boundary,
        rawDeltaSamples
      );
      const deltaPx = Math.round(deltaSamples / this._host.samplesPerPixel);

      this._cumulativeDeltaSamples = deltaSamples;

      // Visual feedback: update clip container CSS and re-extract peaks
      if (this._clipContainer) {
        if (this._mode === 'trim-left') {
          // Left trim: container shifts and resizes
          const newLeft = this._originalLeft + deltaPx;
          const newWidth = this._originalWidth - deltaPx;
          if (newWidth > 0) {
            this._clipContainer.style.left = newLeft + 'px';
            this._clipContainer.style.width = newWidth + 'px';
            // Re-extract peaks at new offset/duration from cached WaveformData.
            // New peaks cover the full new bounds, so waveforms stay at left:0
            // (no shift needed — the container position handles global alignment).
            const newOffset = this._originalOffsetSamples + deltaSamples;
            const newDuration = this._originalDurationSamples - deltaSamples;
            if (this._updateWaveformPeaks(newOffset, newDuration)) {
              // Peaks updated — reset waveform positions to fill container
              const waveforms = this._clipContainer.querySelectorAll('daw-waveform');
              for (const wf of waveforms) {
                (wf as HTMLElement).style.left = '0px';
              }
            } else {
              // No cached peaks — fall back to shifting waveforms for visual stability
              const waveforms = this._clipContainer.querySelectorAll('daw-waveform');
              for (const wf of waveforms) {
                (wf as HTMLElement).style.left = -deltaPx + 'px';
              }
            }
          }
        } else {
          // Right trim: extend/shrink right edge — left stays fixed
          const newWidth = this._originalWidth + deltaPx;
          if (newWidth > 0) {
            this._clipContainer.style.width = newWidth + 'px';
            // Re-extract peaks at new duration from cached WaveformData
            const newDuration = this._originalDurationSamples + deltaSamples;
            this._updateWaveformPeaks(this._originalOffsetSamples, newDuration);
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
        // Sync adapter once on drop (skipped during drag for performance)
        if (engine) {
          engine.updateTrack(this._trackId);
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
          console.warn(
            '[dawcore] engine unavailable at move drop — audio may be out of sync for track ' +
              this._trackId
          );
        }
      } else {
        // Restore visual before engine applies — Lit will re-render with correct values
        this._restoreTrimVisual();

        // Trim: apply cumulative delta to engine in one shot (adapter updated internally)
        const boundary = this._mode === 'trim-left' ? 'left' : 'right';
        if (engine) {
          engine.trimClip(this._trackId, this._clipId, boundary, this._cumulativeDeltaSamples);
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
        } else {
          console.warn(
            '[dawcore] engine unavailable at trim drop — trim not applied for clip ' + this._clipId
          );
        }
      }
    } finally {
      // Commit transaction if mutations occurred, abort if click/no-op.
      // Abort does NOT push to undo stack or clear redo stack.
      if (this._isDragging && this._cumulativeDeltaSamples !== 0) {
        this._host.engine?.commitTransaction();
      } else {
        this._host.engine?.abortTransaction();
      }
      this._reset();
    }
  }

  /** Re-extract peaks from cache and set on waveform elements during trim drag.
   *  Returns true if peaks were successfully updated. */
  private _updateWaveformPeaks(offsetSamples: number, durationSamples: number): boolean {
    if (!this._clipContainer || durationSamples <= 0) return false;
    const peakSlice = this._host.reextractClipPeaks(this._clipId, offsetSamples, durationSamples);
    if (!peakSlice) return false;

    const waveforms = this._clipContainer.querySelectorAll('daw-waveform');
    for (let i = 0; i < waveforms.length; i++) {
      const wf = waveforms[i] as HTMLElement & { peaks: unknown; length: number };
      const channelPeaks = peakSlice.data[i];
      if (channelPeaks) {
        wf.peaks = channelPeaks;
        wf.length = peakSlice.length;
      }
    }
    return true;
  }

  /** Restore clip container CSS to original values after trim visual preview. */
  private _restoreTrimVisual(): void {
    if (this._clipContainer) {
      this._clipContainer.style.left = this._originalLeft + 'px';
      this._clipContainer.style.width = this._originalWidth + 'px';
      // Restore waveform positions (shifted during left trim preview)
      const waveforms = this._clipContainer.querySelectorAll('daw-waveform');
      for (const wf of waveforms) {
        (wf as HTMLElement).style.left = '0px';
      }
    }
  }

  private _reset(): void {
    // Remove .dragging class from boundary element
    if (this._boundaryEl) {
      this._boundaryEl.classList.remove('dragging');
      this._boundaryEl = null;
    }
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
    this._originalOffsetSamples = 0;
    this._originalDurationSamples = 0;
  }
}
