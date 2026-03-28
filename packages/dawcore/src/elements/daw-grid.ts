import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { MusicalTickData } from '@waveform-playlist/core';
import { getCachedMusicalTicks } from '../utils/musical-tick-cache';
import { getVisibleChunkIndices } from '../utils/viewport';

const MAX_CANVAS_WIDTH = 1000;

/**
 * `<daw-grid>` renders a musical grid overlay behind waveforms using the
 * Audacity three-tier model:
 *
 *   - **Zebra stripes**: Alternating bar backgrounds at 2% white opacity.
 *   - **Major lines** (bars): 10% white opacity, full height.
 *   - **Minor lines** (beats): 6% white opacity, full height.
 *   - **MinorMinor** (subdivisions): Ruler ticks only — no grid lines.
 *
 * Uses chunked 1000px canvases with virtual scrolling (same as daw-waveform).
 *
 * CSS custom properties:
 *   --daw-grid-bar-highlight  Alternating bar fill  (default: rgba(255,255,255,0.02))
 *   --daw-grid-major-line     Bar line color        (default: rgba(255,255,255,0.1))
 *   --daw-grid-minor-line     Beat line color       (default: rgba(255,255,255,0.06))
 */
@customElement('daw-grid')
export class DawGridElement extends LitElement {
  @property({ type: Number, attribute: false }) ticksPerPixel = 24;
  @property({ attribute: false }) timeSignature: [number, number] = [4, 4];
  @property({ type: Number, attribute: false }) ppqn = 960;
  @property({ type: Number, attribute: false }) visibleStart = -Infinity;
  @property({ type: Number, attribute: false }) visibleEnd = Infinity;
  @property({ type: Number, attribute: false }) length = 0;
  @property({ type: Number, attribute: false }) height = 200;

  private _tickData: MusicalTickData | null = null;

  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 0;
    }
    .container {
      position: relative;
    }
    canvas {
      position: absolute;
      top: 0;
    }
  `;

  willUpdate() {
    if (this.length > 0) {
      this._tickData = getCachedMusicalTicks({
        ticksPerPixel: this.ticksPerPixel,
        timeSignature: this.timeSignature,
        ppqn: this.ppqn,
        startPixel: 0,
        endPixel: this.length,
      });
    } else {
      this._tickData = null;
    }
  }

  render() {
    if (!this._tickData) return html``;

    const totalWidth = this.length;
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const indices = getVisibleChunkIndices(
      totalWidth,
      MAX_CANVAS_WIDTH,
      this.visibleStart,
      this.visibleEnd
    );

    return html`
      <div class="container" style="width: ${totalWidth}px; height: ${this.height}px;">
        ${indices.map((i) => {
          const width = Math.min(MAX_CANVAS_WIDTH, totalWidth - i * MAX_CANVAS_WIDTH);
          return html`
            <canvas
              data-index=${i}
              width=${width * dpr}
              height=${this.height * dpr}
              style="left: ${i * MAX_CANVAS_WIDTH}px; width: ${width}px; height: ${this.height}px;"
            ></canvas>
          `;
        })}
      </div>
    `;
  }

  updated() {
    this._drawGrid();
  }

  private _drawGrid() {
    if (!this._tickData) return;

    const canvases = this.shadowRoot?.querySelectorAll('canvas');
    if (!canvases) return;

    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const style = getComputedStyle(this);
    const barHighlight =
      style.getPropertyValue('--daw-grid-bar-highlight').trim() || 'rgba(255,255,255,0.02)';
    const majorLine =
      style.getPropertyValue('--daw-grid-major-line').trim() || 'rgba(255,255,255,0.1)';
    const minorLine =
      style.getPropertyValue('--daw-grid-minor-line').trim() || 'rgba(255,255,255,0.06)';

    const { ticks, pixelsPerBar } = this._tickData;

    for (const canvas of canvases) {
      const idx = Number(canvas.dataset.index);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const chunkLeft = idx * MAX_CANVAS_WIDTH;
      const canvasWidth = Math.min(MAX_CANVAS_WIDTH, this.length - chunkLeft);

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // Zebra stripes: alternate every other bar (Audacity uses 2% white)
      if (pixelsPerBar >= MIN_PIXELS_PER_UNIT) {
        ctx.fillStyle = barHighlight;
        const firstBar = Math.floor(chunkLeft / pixelsPerBar);
        const lastBar = Math.ceil((chunkLeft + canvasWidth) / pixelsPerBar);
        for (let bar = firstBar; bar <= lastBar; bar++) {
          if (bar % 2 === 1) {
            const x = bar * pixelsPerBar - chunkLeft;
            ctx.fillRect(x, 0, pixelsPerBar, this.height);
          }
        }
      }

      // Grid lines: major (bars) and minor (beats) only.
      // Subdivisions (minorMinor) get ruler ticks but no grid lines.
      ctx.lineWidth = 1;
      for (const tick of ticks) {
        if (tick.type === 'minorMinor') continue;

        const localX = tick.pixel - chunkLeft;
        if (localX < 0 || localX >= canvasWidth) continue;

        ctx.strokeStyle = tick.type === 'major' ? majorLine : minorLine;
        ctx.beginPath();
        ctx.moveTo(localX + 0.5, 0);
        ctx.lineTo(localX + 0.5, this.height);
        ctx.stroke();
      }
    }
  }
}

// Reuse threshold from musicalTicks — bar stripes need bars to be visible
const MIN_PIXELS_PER_UNIT = 8;

declare global {
  interface HTMLElementTagNameMap {
    'daw-grid': DawGridElement;
  }
}
