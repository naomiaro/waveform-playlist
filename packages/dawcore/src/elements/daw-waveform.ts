import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Peaks, Bits } from '@waveform-playlist/core';
import {
  aggregatePeaks,
  calculateBarRects,
  calculateFirstBarPosition,
} from '../utils/peak-rendering';
import { getVisibleChunkIndices } from '../utils/viewport';

const MAX_CANVAS_WIDTH = 1000;

@customElement('daw-waveform')
export class DawWaveformElement extends LitElement {
  private _peaks: Peaks = new Int16Array(0);
  private _dirtyPixels: Set<number> = new Set();
  private _drawScheduled = false;
  private _rafId = 0;

  set peaks(value: Peaks) {
    this._peaks = value;
    this._markAllDirty();
    this.requestUpdate();
  }

  get peaks(): Peaks {
    return this._peaks;
  }

  get bits(): Bits {
    return this._peaks instanceof Int8Array ? 8 : 16;
  }

  @property({ type: Number, attribute: false }) length = 0;
  @property({ type: Number, attribute: false }) waveHeight = 128;
  @property({ type: Number, attribute: false }) barWidth = 1;
  @property({ type: Number, attribute: false }) barGap = 0;
  /** Visible viewport start in pixels (relative to timeline origin). */
  @property({ type: Number, attribute: false }) visibleStart = -Infinity;
  /** Visible viewport end in pixels (relative to timeline origin). */
  @property({ type: Number, attribute: false }) visibleEnd = Infinity;
  /** This element's left offset on the timeline (for viewport intersection). */
  @property({ type: Number, attribute: false }) originX = 0;

  static styles = css`
    :host {
      display: block;
      position: relative;
    }
    .container {
      position: relative;
    }
    canvas {
      position: absolute;
      top: 0;
    }
  `;

  private _getVisibleChunkIndices(): number[] {
    return getVisibleChunkIndices(
      this.length,
      MAX_CANVAS_WIDTH,
      this.visibleStart,
      this.visibleEnd,
      this.originX
    );
  }

  /**
   * Mark a range of peak indices as dirty for incremental redraw.
   * The caller must have already updated the underlying peaks array.
   * Does NOT trigger a Lit re-render — bypasses Lit entirely.
   */
  updatePeaks(startIndex: number, endIndex: number) {
    for (let i = startIndex; i < endIndex; i++) {
      this._dirtyPixels.add(i);
    }
    this._scheduleDraw();
  }

  private _markAllDirty() {
    const peakCount = Math.floor(this._peaks.length / 2);
    for (let i = 0; i < peakCount; i++) {
      this._dirtyPixels.add(i);
    }
    this._scheduleDraw();
  }

  private _scheduleDraw() {
    if (!this._drawScheduled) {
      this._drawScheduled = true;
      this._rafId = requestAnimationFrame(() => {
        this._drawScheduled = false;
        this._drawDirty();
      });
    }
  }

  private _drawDirty() {
    if (this._dirtyPixels.size === 0 || this.length === 0 || this._peaks.length === 0) {
      this._dirtyPixels.clear();
      return;
    }

    const canvases = this.shadowRoot?.querySelectorAll('canvas');
    if (!canvases || canvases.length === 0) {
      this._dirtyPixels.clear();
      return;
    }

    const step = this.barWidth + this.barGap;
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const halfHeight = this.waveHeight / 2;
    const bits = this.bits;
    const waveColor =
      getComputedStyle(this).getPropertyValue('--daw-wave-color').trim() || '#c49a6c';

    // Group dirty peak indices by chunk
    const dirtyByChunk = new Map<number, { min: number; max: number }>();
    for (const peakIdx of this._dirtyPixels) {
      const chunkIdx = Math.floor(peakIdx / MAX_CANVAS_WIDTH);
      const existing = dirtyByChunk.get(chunkIdx);
      if (existing) {
        existing.min = Math.min(existing.min, peakIdx);
        existing.max = Math.max(existing.max, peakIdx);
      } else {
        dirtyByChunk.set(chunkIdx, { min: peakIdx, max: peakIdx });
      }
    }

    for (const canvas of canvases) {
      const chunkIdx = Number(canvas.dataset.index);
      const range = dirtyByChunk.get(chunkIdx);
      if (!range) continue;

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const globalOffset = chunkIdx * MAX_CANVAS_WIDTH;

      // Convert dirty peak range to local pixel coordinates
      const dirtyLocalStart = range.min - globalOffset;
      const dirtyLocalEnd = range.max - globalOffset;

      // Align to bar boundaries
      const firstBar = calculateFirstBarPosition(
        globalOffset + dirtyLocalStart,
        this.barWidth,
        step
      );
      const clearStart = Math.max(0, firstBar - globalOffset);
      const clearEnd = dirtyLocalEnd + this.barWidth;
      const clearWidth = clearEnd - clearStart;

      // Partial clear
      ctx.resetTransform();
      ctx.clearRect(clearStart * dpr, 0, clearWidth * dpr, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = waveColor;

      // Draw only bars in the dirty region
      const canvasWidth = Math.min(MAX_CANVAS_WIDTH, this.length - globalOffset);
      const regionEnd = Math.min(globalOffset + clearEnd, globalOffset + canvasWidth);

      for (let bar = Math.max(0, firstBar); bar < regionEnd; bar += step) {
        const peak = aggregatePeaks(this._peaks, bits, bar, bar + step);
        if (!peak) continue;
        const rects = calculateBarRects(
          bar - globalOffset,
          this.barWidth,
          halfHeight,
          peak.min,
          peak.max,
          'normal'
        );
        for (const r of rects) {
          ctx.fillRect(r.x, r.y, r.width, r.height);
        }
      }
    }

    this._dirtyPixels.clear();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._drawScheduled) {
      cancelAnimationFrame(this._rafId);
      this._drawScheduled = false;
    }
    this._dirtyPixels.clear();
  }

  render() {
    const indices = this._getVisibleChunkIndices();
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;

    return html`
      <div class="container" style="width: ${this.length}px; height: ${this.waveHeight}px;">
        ${indices.map((i) => {
          const width = Math.min(MAX_CANVAS_WIDTH, this.length - i * MAX_CANVAS_WIDTH);
          return html`
            <canvas
              data-index=${i}
              width=${width * dpr}
              height=${this.waveHeight * dpr}
              style="left: ${i * MAX_CANVAS_WIDTH}px; width: ${width}px; height: ${this
                .waveHeight}px;"
            ></canvas>
          `;
        })}
      </div>
    `;
  }

  updated() {
    this._markAllDirty();
  }

}

declare global {
  interface HTMLElementTagNameMap {
    'daw-waveform': DawWaveformElement;
  }
}
