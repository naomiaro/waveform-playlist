import { snapTickToGrid } from '@waveform-playlist/core';
import type { AudioClip, SnapTo, MeterEntry } from '@waveform-playlist/core';
import { constrainClipDrag } from '@waveform-playlist/engine';
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
  /** Move a clip; returns the delta actually applied. One undo step. */
  moveClip(trackId: string, clipId: string, deltaSamples: number): number;
  trimClip(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number): void;
  /** The loaded clips of each track (a move collides with them, as `moveClip` does). */
  getState(): { tracks: readonly { id: string; clips: readonly AudioClip[] }[] };
  /** Get a clip's full bounds for trim constraint computation. */
  getClipBounds(trackId: string, clipId: string): ClipBounds | null;
  /** Constrain a trim delta using the engine's collision/bounds logic. */
  constrainTrimDelta(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): number;
}

/** Peak data returned by reextractClipPeaks for imperative waveform updates. */
export interface ClipPeakSlice {
  data: ArrayLike<number>[];
  length: number;
}

/** Host interface required by ClipPointerHandler. */
export interface ClipPointerHost {
  readonly samplesPerPixel: number;
  /** In beats mode, the tick-derived SPP used for rendering. */
  readonly renderSamplesPerPixel: number;
  readonly effectiveSampleRate: number;
  readonly interactiveClips: boolean;
  readonly engine: ClipEngineContract | null;
  readonly shadowRoot: ShadowRoot | null;
  readonly scaleMode: 'temporal' | 'beats';
  readonly ticksPerPixel: number;
  readonly bpm: number;
  readonly ppqn: number;
  readonly _meterEntries: MeterEntry[];
  readonly snapTo: SnapTo;
  readonly _secondsToTicks: (seconds: number) => number;
  readonly _ticksToSeconds: (ticks: number) => number;
  dispatchEvent(event: Event): boolean;
  /** Re-extract peaks for a clip at new offset/duration from cached WaveformData. */
  reextractClipPeaks(
    clipId: string,
    offsetSamples: number,
    durationSamples: number
  ): ClipPeakSlice | null;
  /**
   * Returns true if the clip is a MIDI clip (has midiNotes).
   * Trim handles are inert for MIDI clips — note slicing is not yet implemented.
   */
  isMidiClip(trackId: string, clipId: string): boolean;
}

type DragMode = 'move' | 'trim-left' | 'trim-right';

/**
 * Handles pointer interactions for clip move and trim drag operations.
 * Converts pixel deltas to sample deltas and delegates to the engine.
 *
 * Both show the drag in the view and change the arrangement once, on release
 * (#848): nothing is written while the pointer moves, so an arrangement change
 * during a drag always came from outside.
 *
 * Move: the clip container's `left` follows the pointer, constrained by the
 *   track's other loaded clips as `moveClip` will be; one `moveClip` on release.
 * Trim: updates clip container CSS and peaks imperatively during drag, then
 *   applies the cumulative delta to the engine once on release.
 */
export class ClipPointerHandler {
  private _host: ClipPointerHost;
  private _mode: DragMode | null = null;
  private _clipId = '';
  private _trackId = '';
  private _startPx = 0;
  private _isDragging = false;
  private _cumulativeDeltaSamples = 0;
  // Trim visual feedback: snapshot of original clip state
  private _clipContainer: HTMLElement | null = null;
  private _boundaryEl: HTMLElement | null = null;
  private _originalLeft = 0;
  private _originalWidth = 0;
  private _originalOffsetSamples = 0;
  private _originalDurationSamples = 0;
  private _originalStartSample = 0;
  // Move: the dragged clip and the track's loaded clips, sorted, at drag start
  private _moveClip: AudioClip | null = null;
  private _moveSorted: AudioClip[] = [];

  constructor(host: ClipPointerHost) {
    this._host = host;
  }

  /**
   * Convert a pixel delta to samples, snapping in tick space when in beats mode.
   *
   * The anchor is the absolute sample position being moved (e.g., clip start
   * for move/left-trim, clip end for right-trim). Snapping the absolute
   * position — not just the delta — ensures clips land exactly on grid lines
   * even if they started off-grid.
   */
  private _snapDeltaToSamples(totalDeltaPx: number, anchorSample: number): number {
    const h = this._host;
    if (h.scaleMode === 'beats') {
      const anchorSeconds = anchorSample / h.effectiveSampleRate;
      const anchorTick = h._secondsToTicks(anchorSeconds);
      const deltaTicks = totalDeltaPx * h.ticksPerPixel;
      const targetTick = anchorTick + deltaTicks;
      const snappedTick =
        h.snapTo !== 'off'
          ? snapTickToGrid(targetTick, h.snapTo, h._meterEntries, h.ppqn)
          : targetTick;
      const snappedSeconds = h._ticksToSeconds(snappedTick);
      const snappedSample = Math.round(snappedSeconds * h.effectiveSampleRate);
      return snappedSample - anchorSample;
    }
    return Math.round(totalDeltaPx * h.renderSamplesPerPixel);
  }

  /** A sample delta from `anchorSample` in pixels: in tick space in beats mode,
   *  so the drawn position does not drift from the sample round-trip. */
  private _samplesToPx(anchorSample: number, deltaSamples: number): number {
    const h = this._host;
    if (h.scaleMode === 'beats') {
      const anchorSec = anchorSample / h.effectiveSampleRate;
      const anchorTick = h._secondsToTicks(anchorSec);
      const newTick = h._secondsToTicks(anchorSec + deltaSamples / h.effectiveSampleRate);
      return Math.round((newTick - anchorTick) / h.ticksPerPixel);
    }
    return Math.round(deltaSamples / h.renderSamplesPerPixel);
  }

  /** Returns true if a drag interaction is currently in progress. */
  get isActive(): boolean {
    return this._mode !== null;
  }

  /** True once the pointer of the current press has moved past the drag
   *  threshold: a press that has not moved is not a drag (#848). */
  get isDragging(): boolean {
    return this._isDragging;
  }

  /** The clip being dragged (past the threshold), or null. */
  get draggedClip(): { trackId: string; clipId: string } | null {
    return this._isDragging ? { trackId: this._trackId, clipId: this._clipId } : null;
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

      // Trim is not supported for MIDI clips — note slicing is a follow-up PR.
      // Consume the event: no trim drag starts, but prevent the click from
      // falling through to the timeline seek handler.
      if (this._host.isMidiClip(trackId, clipId)) return true;

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

    this._cumulativeDeltaSamples = 0;
  }

  /**
   * The press has become a drag (the pointer passed the threshold): take the
   * clip's bounds now, not at the press, so a drag after an undo made during
   * the press starts from the clip as the undo left it (#848, review of
   * #915). Returns false when the clip is gone (the undo removed it): the
   * press is dropped.
   */
  private _startDrag(): boolean {
    const engine = this._host.engine;
    const trackId = this._trackId;
    const clipId = this._clipId;
    // Snapshot clip start position for snap calculations
    if (engine) {
      const bounds = engine.getClipBounds(trackId, clipId);
      if (!bounds) return false;
      this._originalStartSample = bounds.startSample;
      this._originalOffsetSamples = bounds.offsetSamples;
      this._originalDurationSamples = bounds.durationSamples;
      if (this._mode === 'move') {
        const track = engine.getState().tracks.find((t) => t.id === trackId);
        const clip = track?.clips.find((c) => c.id === clipId) ?? null;
        if (!track || !clip) return false;
        this._moveClip = clip;
        this._moveSorted = [...track.clips].sort((a, b) => a.startSample - b.startSample);
      }
    } else {
      console.warn('[dawcore] drag start: engine unavailable, the drag will not be applied');
    }

    // Snapshot the clip container's current position/width for the preview
    {
      const container = this._host.shadowRoot?.querySelector(
        `.clip-container[data-clip-id="${clipId}"]`
      ) as HTMLElement | null;
      if (container) {
        this._clipContainer = container;
        this._originalLeft = parseFloat(container.style.left) || 0;
        this._originalWidth = parseFloat(container.style.width) || 0;
      } else {
        console.warn('[dawcore] clip container not found for drag visual feedback: ' + clipId);
      }
    }
    return true;
  }

  /** Processes pointermove events during an active drag. */
  onPointerMove(e: PointerEvent): void {
    if (this._mode === null) return;

    const totalDeltaPx = e.clientX - this._startPx;

    // Activate drag after threshold is exceeded
    if (!this._isDragging && Math.abs(totalDeltaPx) > DRAG_THRESHOLD) {
      if (!this._startDrag()) {
        this._reset();
        return;
      }
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
      // Move: snap the clip start, constrain against the track's clips as
      // moveClip will on release, and draw the clip there. Nothing is written.
      const totalSnappedDelta = this._snapDeltaToSamples(totalDeltaPx, this._originalStartSample);
      const clip = this._moveClip;
      const index = clip ? this._moveSorted.indexOf(clip) : -1;
      const delta =
        clip && index !== -1
          ? constrainClipDrag(clip, totalSnappedDelta, this._moveSorted, index)
          : totalSnappedDelta;
      this._cumulativeDeltaSamples = delta;
      if (this._clipContainer) {
        const deltaPx = this._samplesToPx(this._originalStartSample, delta);
        this._clipContainer.style.left = this._originalLeft + deltaPx + 'px';
      }
    } else {
      // Trim: constrain delta using engine's full collision/bounds logic,
      // then track for visual feedback. Engine called once at pointerup.
      const boundary = this._mode === 'trim-left' ? 'left' : 'right';
      // Anchor = the boundary edge being dragged
      // Left trim: snap the left edge (startSample)
      // Right trim: snap the right edge (startSample + durationSamples)
      const anchor =
        boundary === 'left'
          ? this._originalStartSample
          : this._originalStartSample + this._originalDurationSamples;
      const rawDeltaSamples = this._snapDeltaToSamples(totalDeltaPx, anchor);
      const deltaSamples = engine.constrainTrimDelta(
        this._trackId,
        this._clipId,
        boundary,
        rawDeltaSamples
      );
      const deltaPx = this._samplesToPx(anchor, deltaSamples);

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
        // Restore original CSS if the drag didn't produce a delta
        this._restoreVisual();
        return;
      }

      const engine = this._host.engine;

      if (this._mode === 'move') {
        // Back to where the clip was drawn; the re-render after the move puts it there.
        this._restoreVisual();
        if (engine) {
          // The one arrangement call of the drag: an undo step.
          const applied = engine.moveClip(
            this._trackId,
            this._clipId,
            this._cumulativeDeltaSamples
          );
          if (applied !== 0) {
            this._host.dispatchEvent(
              new CustomEvent('daw-clip-move', {
                bubbles: true,
                composed: true,
                detail: {
                  trackId: this._trackId,
                  clipId: this._clipId,
                  deltaSamples: applied,
                },
              })
            );
          }
        } else {
          console.warn(
            '[dawcore] engine unavailable at move drop — move not applied for clip ' + this._clipId
          );
        }
      } else {
        // Restore visual before engine applies — Lit will re-render with correct values
        this._restoreVisual();

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
      this._reset();
    }
  }

  /** Processes pointercancel — reverts the in-progress drag.
   *
   * pointercancel fires INSTEAD of pointerup on touch interruption, pen
   * leaving hover range, or OS gestures. Without this handler the drag stays
   * armed (hover keeps moving the clip). The drag wrote nothing to the
   * arrangement, so reverting is putting the view back. */
  onPointerCancel(_e: PointerEvent): void {
    if (this._mode === null) return;
    try {
      this._restoreVisual();
    } finally {
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

  /** Restore clip container CSS AND waveform peaks to original values after
   * a drag's visual preview. Peaks matter: a trim wrote re-extracted peak
   * arrays imperatively onto the <daw-waveform> elements (bypassing Lit), and
   * a cancelled/zero-delta drag makes no engine mutation — so no statechange
   * re-render will ever repair them. */
  private _restoreVisual(): void {
    if (this._clipContainer) {
      this._clipContainer.style.left = this._originalLeft + 'px';
      this._clipContainer.style.width = this._originalWidth + 'px';
      // Restore waveform positions (shifted during left trim preview)
      const waveforms = this._clipContainer.querySelectorAll('daw-waveform');
      for (const wf of waveforms) {
        (wf as HTMLElement).style.left = '0px';
      }
      // Re-extract at the original bounds (no-op when the peak cache is
      // unavailable — in that case the drag never overwrote peaks either).
      this._updateWaveformPeaks(this._originalOffsetSamples, this._originalDurationSamples);
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

    this._cumulativeDeltaSamples = 0;
    this._clipContainer = null;
    this._originalLeft = 0;
    this._originalWidth = 0;
    this._originalOffsetSamples = 0;
    this._originalDurationSamples = 0;
    this._originalStartSample = 0;
    this._moveClip = null;
    this._moveSorted = [];
  }
}
