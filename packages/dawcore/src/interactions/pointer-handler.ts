import { pixelsToSeconds } from '@waveform-playlist/core';

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
}

export class PointerHandler {
  private _host: PointerHandlerHost;
  private _isDragging = false;
  private _dragStartPx = 0;
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

  onPointerDown = (e: PointerEvent) => {
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

    if (!this._isDragging && Math.abs(currentPx - this._dragStartPx) > 3) {
      this._isDragging = true;
    }

    if (this._isDragging) {
      const h = this._host;
      const startTime = pixelsToSeconds(
        this._dragStartPx,
        h.samplesPerPixel,
        h.effectiveSampleRate
      );
      const endTime = pixelsToSeconds(currentPx, h.samplesPerPixel, h.effectiveSampleRate);
      // Mutate host fields directly (not @state) and update <daw-selection>
      // imperatively to avoid triggering Lit re-renders at 60fps during drag
      h._selectionStartTime = Math.min(startTime, endTime);
      h._selectionEndTime = Math.max(startTime, endTime);
      const sel = h.shadowRoot?.querySelector('daw-selection') as
        | { startPx: number; endPx: number }
        | undefined;
      if (sel) {
        sel.startPx = (h._selectionStartTime * h.effectiveSampleRate) / h.samplesPerPixel;
        sel.endPx = (h._selectionEndTime * h.effectiveSampleRate) / h.samplesPerPixel;
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
    const time = pixelsToSeconds(px, h.samplesPerPixel, h.effectiveSampleRate);

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
