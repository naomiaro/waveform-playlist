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

  private _drawVisibleChunks() {
    if (this.length === 0 || this._peaks.length === 0) return;

    const canvases = this.shadowRoot?.querySelectorAll('canvas');
    if (!canvases) return;

    const step = this.barWidth + this.barGap;
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const halfHeight = this.waveHeight / 2;

    const waveColor =
      getComputedStyle(this).getPropertyValue('--daw-wave-color').trim() || '#c49a6c';

    for (const canvas of canvases) {
      const idx = Number(canvas.dataset.index);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const canvasWidth = Math.min(MAX_CANVAS_WIDTH, this.length - idx * MAX_CANVAS_WIDTH);

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = waveColor;

      const globalOffset = idx * MAX_CANVAS_WIDTH;
      const canvasEnd = globalOffset + canvasWidth;
      const firstBar = calculateFirstBarPosition(globalOffset, this.barWidth, step);

      for (let bar = Math.max(0, firstBar); bar < canvasEnd; bar += step) {
        const peak = aggregatePeaks(this._peaks, this.bits, bar, bar + step);
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
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-waveform': DawWaveformElement;
  }
}
