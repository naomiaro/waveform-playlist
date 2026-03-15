import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { computeTemporalTicks } from '../utils/smart-scale';

const MAX_CANVAS_WIDTH = 1000;

@customElement('daw-ruler')
export class DawRulerElement extends LitElement {
  @property({ type: Number, attribute: false }) samplesPerPixel = 1024;
  @property({ type: Number, attribute: false }) sampleRate = 48000;
  @property({ type: Number, attribute: false }) duration = 0;
  @property({ type: Number, attribute: false }) rulerHeight = 30;

  static styles = css`
    :host {
      display: block;
      position: relative;
      background: var(--daw-ruler-background, #0f0f1a);
    }
    .container {
      position: relative;
    }
    canvas {
      position: absolute;
      top: 0;
    }
    .label {
      position: absolute;
      font-size: 0.7rem;
      white-space: nowrap;
      color: var(--daw-ruler-color, #c49a6c);
      top: 2px;
    }
  `;

  render() {
    if (this.duration <= 0) return html``;

    const tickData = computeTemporalTicks(
      this.samplesPerPixel,
      this.sampleRate,
      this.duration,
      this.rulerHeight
    );

    const totalWidth = tickData.widthX;
    const totalChunks = Math.ceil(totalWidth / MAX_CANVAS_WIDTH);
    const indices = Array.from({ length: totalChunks }, (_, i) => i);
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;

    return html`
      <div class="container" style="width: ${totalWidth}px; height: ${this.rulerHeight}px;">
        ${indices.map((i) => {
          const width = Math.min(MAX_CANVAS_WIDTH, totalWidth - i * MAX_CANVAS_WIDTH);
          return html`
            <canvas
              data-index=${i}
              width=${width * dpr}
              height=${this.rulerHeight * dpr}
              style="left: ${i * MAX_CANVAS_WIDTH}px; width: ${width}px; height: ${this
                .rulerHeight}px;"
            ></canvas>
          `;
        })}
        ${tickData.labels.map(
          ({ pix, text }) => html`<span class="label" style="left: ${pix + 4}px;">${text}</span>`
        )}
      </div>
    `;
  }

  updated() {
    this._drawTicks();
  }

  private _drawTicks() {
    if (this.duration <= 0) return;

    const tickData = computeTemporalTicks(
      this.samplesPerPixel,
      this.sampleRate,
      this.duration,
      this.rulerHeight
    );

    const canvases = this.shadowRoot?.querySelectorAll('canvas');
    if (!canvases) return;

    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const rulerColor =
      getComputedStyle(this).getPropertyValue('--daw-ruler-color').trim() || '#c49a6c';

    for (const canvas of canvases) {
      const idx = Number(canvas.dataset.index);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const canvasWidth = Math.min(MAX_CANVAS_WIDTH, tickData.widthX - idx * MAX_CANVAS_WIDTH);
      const globalOffset = idx * MAX_CANVAS_WIDTH;

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = rulerColor;
      ctx.lineWidth = 1;

      for (const [pix, height] of tickData.canvasInfo) {
        const localX = pix - globalOffset;
        if (localX < 0 || localX >= canvasWidth) continue;

        ctx.beginPath();
        ctx.moveTo(localX + 0.5, this.rulerHeight);
        ctx.lineTo(localX + 0.5, this.rulerHeight - height);
        ctx.stroke();
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-ruler': DawRulerElement;
  }
}
