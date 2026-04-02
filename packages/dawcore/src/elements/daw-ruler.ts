import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { computeTemporalTicks, type TickData } from '../utils/smart-scale';
import { getCachedMusicalTicks } from '../utils/musical-tick-cache';
import type { MusicalTickData, MeterEntry } from '@waveform-playlist/core';

const MAX_CANVAS_WIDTH = 1000;

@customElement('daw-ruler')
export class DawRulerElement extends LitElement {
  @property({ type: Number, attribute: false }) samplesPerPixel = 1024;
  @property({ type: Number, attribute: false }) sampleRate = 48000;
  @property({ type: Number, attribute: false }) duration = 0;
  @property({ type: Number, attribute: false }) rulerHeight = 30;
  @property({ type: String, attribute: false }) scaleMode: 'temporal' | 'beats' = 'temporal';
  @property({ type: Number, attribute: false }) ticksPerPixel = 4;
  @property({ attribute: false }) meterEntries: MeterEntry[] = [
    { tick: 0, numerator: 4, denominator: 4 },
  ];
  @property({ type: Number, attribute: false }) ppqn = 960;
  @property({ type: Number, attribute: false }) totalWidth = 0;

  private _tickData: TickData | null = null;
  private _musicalTickData: MusicalTickData | null = null;

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
      line-height: 1;
      white-space: nowrap;
      color: var(--daw-ruler-color, #c49a6c);
      top: 1px;
    }
    .label.centered {
      transform: translateX(-50%);
    }
  `;

  willUpdate() {
    if (this.scaleMode === 'beats' && this.totalWidth > 0) {
      this._musicalTickData = getCachedMusicalTicks({
        meterEntries: this.meterEntries,
        ticksPerPixel: this.ticksPerPixel,
        startPixel: 0,
        endPixel: this.totalWidth,
        ppqn: this.ppqn,
      });
      this._tickData = null;
    } else if (this.duration > 0) {
      this._musicalTickData = null;
      this._tickData = computeTemporalTicks(
        this.samplesPerPixel,
        this.sampleRate,
        this.duration,
        this.rulerHeight
      );
    } else {
      this._musicalTickData = null;
      this._tickData = null;
    }
  }

  render() {
    const widthX = this.scaleMode === 'beats' ? this.totalWidth : (this._tickData?.widthX ?? 0);
    if (widthX <= 0) return html``;

    const totalChunks = Math.ceil(widthX / MAX_CANVAS_WIDTH);
    const indices = Array.from({ length: totalChunks }, (_, i) => i);
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;

    const beatsLabels =
      this.scaleMode === 'beats' ? (this._musicalTickData?.ticks.filter((t) => t.label) ?? []) : [];
    const temporalLabels = this.scaleMode !== 'beats' ? (this._tickData?.labels ?? []) : [];

    return html`
      <div class="container" style="width: ${widthX}px; height: ${this.rulerHeight}px;">
        ${indices.map((i) => {
          const width = Math.min(MAX_CANVAS_WIDTH, widthX - i * MAX_CANVAS_WIDTH);
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
        ${this.scaleMode === 'beats'
          ? beatsLabels.map(
              (t) =>
                html`<span
                  class="label ${t.pixel > 0 ? 'centered' : ''}"
                  style="left: ${t.pixel > 0 ? t.pixel : t.pixel + 4}px;"
                  >${t.label}</span
                >`
            )
          : temporalLabels.map(
              ({ pix, text }) =>
                html`<span class="label" style="left: ${pix + 4}px;">${text}</span>`
            )}
      </div>
    `;
  }

  updated() {
    this._drawTicks();
  }

  private _drawTicks() {
    const canvases = this.shadowRoot?.querySelectorAll('canvas');
    if (!canvases) return;

    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const rulerColor =
      getComputedStyle(this).getPropertyValue('--daw-ruler-color').trim() || '#c49a6c';
    const widthX = this.scaleMode === 'beats' ? this.totalWidth : (this._tickData?.widthX ?? 0);

    for (const canvas of canvases) {
      const idx = Number(canvas.dataset.index);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const canvasWidth = Math.min(MAX_CANVAS_WIDTH, widthX - idx * MAX_CANVAS_WIDTH);
      const globalOffset = idx * MAX_CANVAS_WIDTH;

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = rulerColor;
      ctx.lineWidth = 1;

      if (this.scaleMode === 'beats' && this._musicalTickData) {
        // Ticks draw upward from the bottom. Leave top ~40% for labels.
        // major=60%, minor=35%, minorMinor=15%
        const h = this.rulerHeight;
        for (const tick of this._musicalTickData.ticks) {
          const localX = tick.pixel - globalOffset;
          if (localX < 0 || localX >= canvasWidth) continue;

          const tickH =
            tick.type === 'major' ? h * 0.6 : tick.type === 'minor' ? h * 0.35 : h * 0.15;

          ctx.globalAlpha = tick.type === 'major' ? 1.0 : 0.5;
          ctx.beginPath();
          ctx.moveTo(localX + 0.5, h);
          ctx.lineTo(localX + 0.5, h - tickH);
          ctx.stroke();
        }
        ctx.globalAlpha = 1.0;
      } else if (this._tickData) {
        for (const [pix, height] of this._tickData.canvasInfo) {
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
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-ruler': DawRulerElement;
  }
}
