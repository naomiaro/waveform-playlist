import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { Peaks, Bits } from '@waveform-playlist/core';
import { aggregatePeaks, calculateBarRects } from '../utils/peak-rendering';
import { getVisibleChunkIndices } from '../utils/viewport';

/** A segment mapping a peak-index range to a pixel range within the waveform. */
export interface WaveformSegment {
  /** Start position in the peaks array (fractional index). */
  peakStart: number;
  /** End position in the peaks array (fractional index). */
  peakEnd: number;
  /** Start pixel position within the waveform. */
  pixelStart: number;
  /** End pixel position within the waveform. */
  pixelEnd: number;
}

const MAX_CANVAS_WIDTH = 1000;

/** Layout/data properties that require a full redraw when changed. */
const LAYOUT_PROPS = new Set(['length', 'waveHeight', 'barWidth', 'barGap', 'segments']);

/**
 * Group dirty peak indices by canvas chunk. Returns bar-pixel-aligned
 * min/max positions per chunk for correct clearRect coordinates,
 * including when barWidth > 1 or barGap > 0.
 */
function groupDirtyByChunk(
  dirtyPixels: Set<number>,
  step: number
): Map<number, { min: number; max: number }> {
  const dirtyByChunk = new Map<number, { min: number; max: number }>();
  for (const peakIdx of dirtyPixels) {
    // Map peak index to its bar's global pixel position
    const barPixel = Math.floor(peakIdx / step) * step;
    const chunkIdx = Math.floor(barPixel / MAX_CANVAS_WIDTH);
    const existing = dirtyByChunk.get(chunkIdx);
    if (existing) {
      dirtyByChunk.set(chunkIdx, {
        min: Math.min(existing.min, barPixel),
        max: Math.max(existing.max, barPixel),
      });
    } else {
      dirtyByChunk.set(chunkIdx, { min: barPixel, max: barPixel });
    }
  }
  return dirtyByChunk;
}

@customElement('daw-waveform')
export class DawWaveformElement extends LitElement {
  private _peaks: Peaks = new Int16Array(0);
  private _dirtyPixels: Set<number> = new Set();
  private _drawScheduled = false;
  private _rafId = 0;
  /** Chunk indices visible in the last draw pass — used to detect new chunks on scroll. */
  private _drawnChunks: Set<number> = new Set();

  set peaks(value: Peaks) {
    this._peaks = value;
    this._markAllDirty();
    this.requestUpdate();
  }

  get peaks(): Peaks {
    return this._peaks;
  }

  /**
   * Replace the internal peaks reference without marking all dirty.
   * Use with updatePeaks() for incremental recording updates where
   * appendPeaks() returns a new array but only the tail changed.
   */
  setPeaksQuiet(value: Peaks) {
    this._peaks = value;
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
  /** When set, draws per-segment with independent samples-per-pixel ratios. */
  @property({ attribute: false }) segments?: WaveformSegment[];

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
    const peakCount = Math.floor(this._peaks.length / 2);
    const clampedStart = Math.max(0, startIndex);
    const clampedEnd = Math.min(peakCount, endIndex);
    for (let i = clampedStart; i < clampedEnd; i++) {
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
      // Don't clear _dirtyPixels — canvases may appear after Lit renders.
      // connectedCallback or updated() will reschedule the draw.
      return;
    }

    const step = this.barWidth + this.barGap;
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const halfHeight = this.waveHeight / 2;
    const bits = this.bits;
    const waveColor =
      getComputedStyle(this).getPropertyValue('--daw-wave-color').trim() || '#c49a6c';

    this._drawnChunks.clear();

    if (this.segments) {
      // Segment mode: full redraw per chunk (segments have variable SPP)
      for (const canvas of canvases) {
        const chunkIdx = Number(canvas.dataset.index);
        this._drawnChunks.add(chunkIdx);
        this._drawSegments(canvas, chunkIdx, dpr, halfHeight, bits, waveColor);
      }
    } else {
      const dirtyByChunk = groupDirtyByChunk(this._dirtyPixels, step);
      for (const canvas of canvases) {
        const chunkIdx = Number(canvas.dataset.index);
        this._drawnChunks.add(chunkIdx);
        const range = dirtyByChunk.get(chunkIdx);
        if (!range) continue;
        this._drawChunk(canvas, chunkIdx, range, step, dpr, halfHeight, bits, waveColor);
      }
    }

    this._dirtyPixels.clear();
  }

  private _drawChunk(
    canvas: HTMLCanvasElement,
    chunkIdx: number,
    range: { min: number; max: number },
    step: number,
    dpr: number,
    halfHeight: number,
    bits: Bits,
    waveColor: string
  ) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const globalOffset = chunkIdx * MAX_CANVAS_WIDTH;
    // range.min/max are bar-pixel-aligned global positions from groupDirtyByChunk
    const clearStart = Math.max(0, range.min - globalOffset);
    const clearEnd = range.max - globalOffset + this.barWidth;
    const clearWidth = clearEnd - clearStart;
    const firstBar = range.min;

    ctx.resetTransform();
    ctx.clearRect(clearStart * dpr, 0, clearWidth * dpr, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = waveColor;

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

  private _drawSegments(
    canvas: HTMLCanvasElement,
    chunkIdx: number,
    dpr: number,
    halfHeight: number,
    bits: Bits,
    waveColor: string
  ) {
    if (!this.segments) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const globalOffset = chunkIdx * MAX_CANVAS_WIDTH;
    const canvasWidth = Math.min(MAX_CANVAS_WIDTH, this.length - globalOffset);

    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = waveColor;

    const step = Math.max(1, Math.round(this.barWidth + this.barGap));

    for (const seg of this.segments) {
      // Skip segments outside this chunk
      if (seg.pixelEnd <= globalOffset || seg.pixelStart >= globalOffset + canvasWidth) continue;

      const localStart = Math.max(0, seg.pixelStart - globalOffset);
      const localEnd = Math.min(canvasWidth, seg.pixelEnd - globalOffset);
      const segPixelWidth = seg.pixelEnd - seg.pixelStart;
      const segPeakWidth = seg.peakEnd - seg.peakStart;
      if (segPixelWidth <= 0 || segPeakWidth <= 0) continue;

      // Per-segment peaks-per-pixel ratio
      const peaksPerPixel = segPeakWidth / segPixelWidth;

      for (let px = Math.floor(localStart); px < Math.ceil(localEnd); px += step) {
        // Map this pixel to a peak index range
        const pxInSeg = px + globalOffset - seg.pixelStart;
        const peakPos = seg.peakStart + pxInSeg * peaksPerPixel;
        const peakEnd = peakPos + step * peaksPerPixel;

        const peak = aggregatePeaks(this._peaks, bits, Math.floor(peakPos), Math.ceil(peakEnd));
        if (!peak) continue;

        const rects = calculateBarRects(
          px,
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

  connectedCallback() {
    super.connectedCallback();
    // Reschedule draw if dirty pixels survived a disconnect/reconnect cycle
    if (this._dirtyPixels.size > 0) {
      this._scheduleDraw();
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._drawScheduled) {
      cancelAnimationFrame(this._rafId);
      this._drawScheduled = false;
    }
    // Keep _dirtyPixels — connectedCallback will reschedule if reconnected
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

  /** Mark peaks dirty only for chunks that weren't drawn in the previous frame. */
  private _markNewChunksDirty() {
    const currentIndices = this._getVisibleChunkIndices();
    const peakCount = Math.floor(this._peaks.length / 2);
    for (const chunkIdx of currentIndices) {
      if (!this._drawnChunks.has(chunkIdx)) {
        const start = chunkIdx * MAX_CANVAS_WIDTH;
        const end = Math.min(start + MAX_CANVAS_WIDTH, peakCount);
        for (let i = start; i < end; i++) {
          this._dirtyPixels.add(i);
        }
      }
    }
    if (this._dirtyPixels.size > 0) {
      this._scheduleDraw();
    }
  }

  updated(changedProperties: Map<string, unknown>) {
    // Layout/data changes require full redraw of all peaks
    const needsFullDirty = [...changedProperties.keys()].some((key) => LAYOUT_PROPS.has(key));
    if (needsFullDirty) {
      this._markAllDirty();
      return;
    }
    // Viewport-only changes: only draw newly visible chunks, skip already-drawn ones
    if (
      changedProperties.has('visibleStart') ||
      changedProperties.has('visibleEnd') ||
      changedProperties.has('originX')
    ) {
      this._markNewChunksDirty();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-waveform': DawWaveformElement;
  }
}
