import { pixelsToSeconds, snapTickToGrid } from '@waveform-playlist/core';
import type { SnapTo, MeterEntry } from '@waveform-playlist/core';
import { DRAG_THRESHOLD } from './constants';

/** Narrow engine contract for pointer interactions. */
export interface PointerEngineContract {
  setSelection(start: number, end: number): void;
  stop(): void;
  play(time: number): void;
  seek(time: number): void;
  selectTrack(trackId: string | null): void;
}

/** Manages pointer interactions on the timeline: click-to-seek and drag-to-select. */
export interface PointerHandlerHost {
  readonly samplesPerPixel: number;
  readonly _engine: PointerEngineContract | null;
  readonly _isPlaying: boolean;
  readonly effectiveSampleRate: number;
  _currentTime: number;
  _selectionStartTime: number;
  _selectionEndTime: number;
  _dragOver: boolean;
  _setSelectedTrackId(trackId: string | null): void;
  _startPlayhead(): void;
  _stopPlayhead(): void;
  dispatchEvent(event: Event): boolean;
  shadowRoot: ShadowRoot | null;
  requestUpdate(): void;
  readonly _clipHandler: {
    tryHandle(target: Element, e: PointerEvent): boolean;
    onPointerMove(e: PointerEvent): void;
    onPointerUp(e: PointerEvent): void;
    isActive: boolean;
  } | null;
  readonly scaleMode: 'temporal' | 'beats';
  readonly ticksPerPixel: number;
  readonly bpm: number;
  readonly ppqn: number;
  readonly _meterEntries: MeterEntry[];
  readonly snapTo: SnapTo;
  readonly _secondsToTicks: (seconds: number) => number;
  readonly _ticksToSeconds: (ticks: number) => number;
}

export class PointerHandler {
  private _host: PointerHandlerHost;
  private _isDragging = false;
  private _dragStartPx = 0;
  private _dragStartTime = 0;
  private _timeline: HTMLElement | null = null;
  // Cached from onPointerDown to avoid forced layout reflows at 60fps during drag
  private _timelineRect: DOMRect | null = null;

  constructor(host: PointerHandlerHost) {
    this._host = host;
  }

  private _pxFromPointer(e: PointerEvent): number {
    if (!this._timelineRect) {
      console.warn('[dawcore] _pxFromPointer called without timeline reference');
      return 0;
    }
    // .timeline is wider than :host (which has overflow-x: auto).
    // getBoundingClientRect().left already reflects scroll position
    // (goes negative when scrolled), so no scrollLeft adjustment needed.
    return e.clientX - this._timelineRect.left;
  }

  private _pxToTime(px: number): number {
    const h = this._host;
    if (h.scaleMode === 'beats') {
      let tick = px * h.ticksPerPixel;
      tick = snapTickToGrid(tick, h.snapTo, h._meterEntries, h.ppqn);
      return h._ticksToSeconds(tick);
    }
    return pixelsToSeconds(px, h.samplesPerPixel, h.effectiveSampleRate);
  }

  private _timeToPx(time: number): number {
    const h = this._host;
    if (h.scaleMode === 'beats') {
      const tick = h._secondsToTicks(time);
      return tick / h.ticksPerPixel;
    }
    return (time * h.effectiveSampleRate) / h.samplesPerPixel;
  }

  onPointerDown = (e: PointerEvent) => {
    // Check if click landed on an interactive clip element
    const clipHandler = this._host._clipHandler;
    if (clipHandler) {
      const target = e.composedPath()[0] as Element;
      if (target && clipHandler.tryHandle(target, e)) {
        // Prevent browser native drag (globe icon) and text selection
        e.preventDefault();
        // Clip handler took over — wire move/up to it
        this._timeline = this._host.shadowRoot?.querySelector('.timeline') as HTMLElement | null;
        if (this._timeline) {
          this._timeline.setPointerCapture(e.pointerId);
          const onMove = (me: Event) => clipHandler.onPointerMove(me as PointerEvent);
          const onUp = (ue: Event) => {
            clipHandler.onPointerUp(ue as PointerEvent);
            this._timeline?.removeEventListener('pointermove', onMove);
            this._timeline?.removeEventListener('pointerup', onUp);
            try {
              this._timeline?.releasePointerCapture((ue as PointerEvent).pointerId);
            } catch (err) {
              console.warn(
                '[dawcore] releasePointerCapture failed (may already be released): ' + String(err)
              );
            }
            this._timeline = null;
          };
          this._timeline.addEventListener('pointermove', onMove);
          this._timeline.addEventListener('pointerup', onUp);
        }
        return;
      }
    }

    this._timeline = this._host.shadowRoot?.querySelector('.timeline') as HTMLElement | null;
    if (!this._timeline) return;

    this._timelineRect = this._timeline.getBoundingClientRect();
    this._dragStartPx = this._pxFromPointer(e);
    this._isDragging = false;

    this._timeline.setPointerCapture(e.pointerId);
    this._timeline.addEventListener('pointermove', this._onPointerMove);
    this._timeline.addEventListener('pointerup', this._onPointerUp);
  };

  private _onPointerMove = (e: PointerEvent) => {
    if (!this._timeline) return;

    const currentPx = this._pxFromPointer(e);

    if (!this._isDragging && Math.abs(currentPx - this._dragStartPx) > DRAG_THRESHOLD) {
      this._isDragging = true;
      // Cache snapped start time once — don't recompute every frame
      this._dragStartTime = this._pxToTime(this._dragStartPx);
    }

    if (this._isDragging) {
      const h = this._host;
      const startTime = this._dragStartTime;
      const endTime = this._pxToTime(currentPx);
      // Mutate host fields directly (not @state) and update <daw-selection>
      // imperatively to avoid triggering Lit re-renders at 60fps during drag
      h._selectionStartTime = Math.min(startTime, endTime);
      h._selectionEndTime = Math.max(startTime, endTime);
      const sel = h.shadowRoot?.querySelector('daw-selection') as
        | { startPx: number; endPx: number }
        | undefined;
      if (sel) {
        sel.startPx = this._timeToPx(h._selectionStartTime);
        sel.endPx = this._timeToPx(h._selectionEndTime);
      }
    }
  };

  private _onPointerUp = (e: PointerEvent) => {
    if (!this._timeline) return;

    try {
      this._timeline.releasePointerCapture(e.pointerId);
    } catch (err) {
      console.warn(
        '[dawcore] releasePointerCapture failed (may already be released): ' + String(err)
      );
    }
    this._timeline.removeEventListener('pointermove', this._onPointerMove);
    this._timeline.removeEventListener('pointerup', this._onPointerUp);

    try {
      if (this._isDragging) {
        this._finalizeSelection();
      } else {
        this._handleSeekClick(e);
      }
    } catch (err) {
      console.warn('[dawcore] Pointer interaction failed: ' + String(err));
    } finally {
      this._isDragging = false;
      this._timeline = null;
      this._timelineRect = null;
    }
  };

  private _finalizeSelection() {
    const h = this._host;
    if (h._engine) {
      h._engine.setSelection(h._selectionStartTime, h._selectionEndTime);
    }
    h.dispatchEvent(
      new CustomEvent('daw-selection', {
        bubbles: true,
        composed: true,
        detail: { start: h._selectionStartTime, end: h._selectionEndTime },
      })
    );
    h.requestUpdate();
  }

  private _handleSeekClick(e: PointerEvent) {
    const h = this._host;
    const px = this._pxFromPointer(e);
    const time = this._pxToTime(px);

    // Clear selection
    h._selectionStartTime = 0;
    h._selectionEndTime = 0;

    // Detect which track was clicked by Y position
    if (this._timeline) {
      const trackRows = this._timeline.querySelectorAll('.track-row');
      for (const row of trackRows) {
        const rowRect = row.getBoundingClientRect();
        if (e.clientY >= rowRect.top && e.clientY < rowRect.bottom) {
          const trackId = (row as HTMLElement).dataset.trackId;
          if (trackId) {
            this._selectTrack(trackId);
          }
          break;
        }
      }
    }

    // Capture playing state before engine calls (stop emits statechange
    // which synchronously flips _isPlaying — use wasPlaying for all guards)
    const wasPlaying = h._isPlaying;

    if (h._engine) {
      h._engine.setSelection(0, 0);
      if (wasPlaying) {
        // Tone.js needs stop + play to reschedule audio sources
        h._engine.stop();
        h._engine.play(time);
        h._startPlayhead();
      } else {
        h._engine.seek(time);
      }
    }

    h._currentTime = time;
    if (!wasPlaying) {
      h._stopPlayhead();
    }

    h.dispatchEvent(
      new CustomEvent('daw-seek', {
        bubbles: true,
        composed: true,
        detail: { time },
      })
    );
    h.requestUpdate();
  }

  private _selectTrack(trackId: string) {
    const h = this._host;
    if (h._engine) {
      try {
        h._engine.selectTrack(trackId);
        // Engine sets _selectedTrackId via statechange — don't set locally
      } catch (err) {
        console.warn(
          '[dawcore] selectTrack via engine failed, falling back to local: ' + String(err)
        );
        // Fall through to local selection below
        h._setSelectedTrackId(trackId);
      }
    } else {
      // No engine — set locally (will be lost when engine builds, acceptable for Phase 2)
      h._setSelectedTrackId(trackId);
    }
    h.dispatchEvent(
      new CustomEvent('daw-track-select', {
        bubbles: true,
        composed: true,
        detail: { trackId },
      })
    );
  }
}
