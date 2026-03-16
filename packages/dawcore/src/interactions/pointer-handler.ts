import { pixelsToSeconds } from '@waveform-playlist/core';

/**
 * Manages pointer interactions on the timeline: click-to-seek and drag-to-select.
 * Extracted from daw-editor to keep file sizes under 800 lines.
 */
export interface PointerHandlerHost {
  readonly samplesPerPixel: number;
  readonly scrollLeft: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  readonly _engine: any;
  readonly _isPlaying: boolean;
  readonly sampleRate: number;
  _currentTime: number;
  _selectionStartTime: number;
  _selectionEndTime: number;
  _selectedTrackId: string | null;
  _dragOver: boolean;
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

  constructor(host: PointerHandlerHost) {
    this._host = host;
  }

  private _pxFromPointer(e: PointerEvent): number {
    if (!this._timeline) return 0;
    const rect = this._timeline.getBoundingClientRect();
    return e.clientX - rect.left + this._host.scrollLeft;
  }

  onPointerDown = (e: PointerEvent) => {
    this._timeline = this._host.shadowRoot?.querySelector('.timeline') as HTMLElement | null;
    if (!this._timeline) return;

    this._dragStartPx = this._pxFromPointer(e);
    this._isDragging = false;

    this._timeline.setPointerCapture(e.pointerId);
    this._timeline.addEventListener('pointermove', this._onPointerMove);
    this._timeline.addEventListener('pointerup', this._onPointerUp);
  };

  private _onPointerMove = (e: PointerEvent) => {
    if (!this._timeline) return;

    const currentPx = this._pxFromPointer(e);

    // Start drag after 3px threshold
    if (!this._isDragging && Math.abs(currentPx - this._dragStartPx) > 3) {
      this._isDragging = true;
    }

    if (this._isDragging) {
      const h = this._host;
      const startTime = pixelsToSeconds(this._dragStartPx, h.samplesPerPixel, h.sampleRate);
      const endTime = pixelsToSeconds(currentPx, h.samplesPerPixel, h.sampleRate);
      h._selectionStartTime = Math.min(startTime, endTime);
      h._selectionEndTime = Math.max(startTime, endTime);
      // Direct update on selection element to avoid @state 60fps re-renders
      const sel = h.shadowRoot?.querySelector('daw-selection') as any;
      if (sel) {
        sel.startPx = (h._selectionStartTime * h.sampleRate) / h.samplesPerPixel;
        sel.endPx = (h._selectionEndTime * h.sampleRate) / h.samplesPerPixel;
      }
    }
  };

  private _onPointerUp = (e: PointerEvent) => {
    if (!this._timeline) return;

    try {
      this._timeline.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer capture may already be released (element removed, system event)
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
    const time = pixelsToSeconds(px, h.samplesPerPixel, h.sampleRate);

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

    if (h._engine) {
      // Capture playing state before engine calls (stop emits statechange
      // which synchronously flips _isPlaying)
      const wasPlaying = h._isPlaying;
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
    if (!h._isPlaying) {
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
        return;
      } catch (err) {
        console.warn('[dawcore] selectTrack failed: ' + String(err));
        return;
      }
    }
    // No engine — set locally (will be lost when engine builds, acceptable for Phase 2)
    h._selectedTrackId = trackId;
    h.dispatchEvent(
      new CustomEvent('daw-track-select', {
        bubbles: true,
        composed: true,
        detail: { trackId },
      })
    );
  }
}
