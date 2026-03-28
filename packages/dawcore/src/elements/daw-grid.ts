import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { MusicalTickData, ZoomLevel } from '@waveform-playlist/core';
import { getCachedMusicalTicks } from '../utils/musical-tick-cache';
import { getVisibleChunkIndices } from '../utils/viewport';

const MAX_CANVAS_WIDTH = 1000;

/** Opacity for each tick level. */
const LEVEL_OPACITY: Record<string, number> = {
  bar: 1.0,
  beat: 0.6,
  eighth: 0.4,
  sixteenth: 0.3,
};

/**
 * Returns the stripe width in pixels for the current zoom level.
 * Returns 0 when no stripes should be drawn (coarse zoom).
 */
function getStripeWidth(data: MusicalTickData): number {
  switch (data.zoomLevel as ZoomLevel) {
    case 'bar':
      return data.pixelsPerBar;
    case 'beat':
      return data.pixelsPerBeat;
    case 'eighth':
      return data.pixelsPerBeat / 2;
    case 'sixteenth':
      return data.pixelsPerBeat / 4;
    case 'coarse':
    default:
      return 0;
  }
}

/**
 * `<daw-grid>` renders a musical grid overlay (alternating stripe fills +
 * vertical tick lines) using chunked 1000px canvases with virtual scrolling.
 *
 * It is a pointer-events-none overlay that sits at z-index 0 behind the
 * waveform and clips.
 *
 * CSS custom properties:
 *   --daw-grid-odd          Odd-stripe fill color   (default: rgba(255,255,255,0.03))
 *   --daw-grid-even         Even-stripe fill color  (default: rgba(255,255,255,0.06))
 *   --daw-grid-line-color   Vertical line color     (default: rgba(255,255,255,0.1))
 */
@customElement('daw-grid')
export class DawGridElement extends LitElement {
  @property({ type: Number, attribute: false }) ticksPerPixel = 4;
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
    const oddColor =
      getComputedStyle(this).getPropertyValue('--daw-grid-odd').trim() ||
      'rgba(255,255,255,0.03)';
    const evenColor =
      getComputedStyle(this).getPropertyValue('--daw-grid-even').trim() ||
      'rgba(255,255,255,0.06)';
    const lineColor =
      getComputedStyle(this).getPropertyValue('--daw-grid-line-color').trim() ||
      'rgba(255,255,255,0.1)';

    const stripeWidth = getStripeWidth(this._tickData);

    for (const canvas of canvases) {
      const idx = Number(canvas.dataset.index);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const chunkLeft = idx * MAX_CANVAS_WIDTH;
      const canvasWidth = Math.min(MAX_CANVAS_WIDTH, this.length - chunkLeft);

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // Draw alternating stripes when there is a defined stripe width.
      if (stripeWidth > 0) {
        // Find the first stripe index whose right edge is visible in this chunk.
        const firstStripeIdx = Math.floor(chunkLeft / stripeWidth);
        // Draw enough stripes to cover the canvas width plus one extra stripe
        // at each side to handle partial-stripe boundaries.
        const lastStripeIdx = Math.ceil((chunkLeft + canvasWidth) / stripeWidth);

        for (let si = firstStripeIdx; si <= lastStripeIdx; si++) {
          const globalLeft = si * stripeWidth;
          const localLeft = globalLeft - chunkLeft;
          const isOdd = si % 2 === 1;

          ctx.fillStyle = isOdd ? oddColor : evenColor;
          ctx.fillRect(localLeft, 0, stripeWidth, this.height);
        }
      }

      // Draw vertical tick lines.
      ctx.lineWidth = 1;

      for (const tick of this._tickData.ticks) {
        const localX = tick.pixel - chunkLeft;
        if (localX < 0 || localX >= canvasWidth) continue;

        const opacity = LEVEL_OPACITY[tick.level] ?? 0.3;

        // Parse base color and apply opacity.
        ctx.strokeStyle = lineColor;
        ctx.globalAlpha = opacity;
        ctx.beginPath();
        ctx.moveTo(localX + 0.5, 0);
        ctx.lineTo(localX + 0.5, this.height);
        ctx.stroke();
      }

      // Reset globalAlpha after drawing.
      ctx.globalAlpha = 1;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-grid': DawGridElement;
  }
}
