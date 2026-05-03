import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { MidiNoteData } from '@waveform-playlist/core';
import { getVisibleChunkIndices } from '../utils/viewport';

const MAX_CANVAS_WIDTH = 1000;

/** Layout/data properties that require a full redraw when changed. */
const LAYOUT_PROPS = new Set([
  'length',
  'waveHeight',
  'samplesPerPixel',
  'sampleRate',
  'clipOffsetSeconds',
  'midiNotes',
  'selected',
]);

@customElement('daw-piano-roll')
export class DawPianoRollElement extends LitElement {
  @property({ attribute: false }) midiNotes: MidiNoteData[] = [];
  @property({ type: Number, attribute: false }) length = 0;
  @property({ type: Number, attribute: false }) waveHeight = 128;
  @property({ type: Number, attribute: 'samples-per-pixel', noAccessor: true })
  get samplesPerPixel(): number {
    return this._samplesPerPixel;
  }
  set samplesPerPixel(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      console.warn('[dawcore] daw-piano-roll samplesPerPixel ' + value + ' is invalid — ignored');
      return;
    }
    const old = this._samplesPerPixel;
    this._samplesPerPixel = value;
    this.requestUpdate('samplesPerPixel', old);
  }
  private _samplesPerPixel = 1024;

  @property({ type: Number, attribute: 'sample-rate', noAccessor: true })
  get sampleRate(): number {
    return this._sampleRate;
  }
  set sampleRate(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      console.warn('[dawcore] daw-piano-roll sampleRate ' + value + ' is invalid — ignored');
      return;
    }
    const old = this._sampleRate;
    this._sampleRate = value;
    this.requestUpdate('sampleRate', old);
  }
  private _sampleRate = 48000;
  @property({ type: Number, attribute: false }) clipOffsetSeconds = 0;
  /** Visible viewport start in pixels (relative to timeline origin). */
  @property({ type: Number, attribute: false }) visibleStart = -Infinity;
  /** Visible viewport end in pixels (relative to timeline origin). */
  @property({ type: Number, attribute: false }) visibleEnd = Infinity;
  /** This element's left offset on the timeline (for viewport intersection). */
  @property({ type: Number, attribute: false }) originX = 0;
  @property({ type: Boolean, reflect: true }) selected = false;

  static styles = css`
    :host {
      display: block;
      position: relative;
    }
    .container {
      position: relative;
      background: var(--daw-piano-roll-background, #1a1a2e);
    }
    canvas {
      position: absolute;
      top: 0;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
  `;

  private _rafHandle: number | null = null;

  private _scheduleDraw() {
    if (this._rafHandle !== null) return;
    this._rafHandle = requestAnimationFrame(() => {
      this._rafHandle = null;
      this._draw();
    });
  }

  willUpdate(_changed: PropertyValues) {
    this._scheduleDraw();
  }

  updated(changedProperties: Map<string, unknown>) {
    // Layout/data changes: willUpdate already scheduled a draw — nothing extra needed.
    const needsFullDraw = [...changedProperties.keys()].some((key) => LAYOUT_PROPS.has(key));
    if (needsFullDraw) return;
    // Viewport-only changes: new canvases may have mounted; schedule a draw so they get painted.
    if (
      changedProperties.has('visibleStart') ||
      changedProperties.has('visibleEnd') ||
      changedProperties.has('originX')
    ) {
      this._scheduleDraw();
    }
  }

  private _getPitchRange(): { minMidi: number; maxMidi: number } {
    if (this.midiNotes.length === 0) return { minMidi: 0, maxMidi: 127 };
    let min = 127;
    let max = 0;
    for (const note of this.midiNotes) {
      if (note.midi < min) min = note.midi;
      if (note.midi > max) max = note.midi;
    }
    return {
      minMidi: Math.max(0, min - 1),
      maxMidi: Math.min(127, max + 1),
    };
  }

  private _getNoteColor(): string {
    const cs = getComputedStyle(this);
    const note = cs.getPropertyValue('--daw-piano-roll-note-color').trim() || '#2a7070';
    const selectedColor =
      cs.getPropertyValue('--daw-piano-roll-selected-note-color').trim() || '#3d9e9e';
    return this.selected ? selectedColor : note;
  }

  private _draw() {
    if (!this.shadowRoot) return;
    const canvases = this.shadowRoot.querySelectorAll('canvas');
    if (canvases.length === 0) return;

    const { minMidi, maxMidi } = this._getPitchRange();
    const noteRange = maxMidi - minMidi + 1;
    const noteHeight = Math.max(2, this.waveHeight / noteRange);
    const pixelsPerSecond = this.sampleRate / this.samplesPerPixel;
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const color = this._getNoteColor();

    for (const canvas of canvases) {
      // Read data-index (matching daw-waveform pattern)
      const chunkIdx = Number((canvas as HTMLCanvasElement).dataset.index);
      const chunkPixelStart = chunkIdx * MAX_CANVAS_WIDTH;
      const canvasWidth = (canvas as HTMLCanvasElement).width / dpr;

      const ctx = (canvas as HTMLCanvasElement).getContext('2d');
      if (!ctx) continue;

      ctx.resetTransform();
      ctx.clearRect(
        0,
        0,
        (canvas as HTMLCanvasElement).width,
        (canvas as HTMLCanvasElement).height
      );
      ctx.imageSmoothingEnabled = false;
      ctx.scale(dpr, dpr);

      const chunkStartTime = (chunkPixelStart * this.samplesPerPixel) / this.sampleRate;
      const chunkEndTime =
        ((chunkPixelStart + canvasWidth) * this.samplesPerPixel) / this.sampleRate;

      for (const note of this.midiNotes) {
        const noteStart = note.time - this.clipOffsetSeconds;
        const noteEnd = noteStart + note.duration;
        if (noteEnd <= chunkStartTime || noteStart >= chunkEndTime) continue;

        const x = noteStart * pixelsPerSecond - chunkPixelStart;
        const w = Math.max(2, note.duration * pixelsPerSecond);
        const y = ((maxMidi - note.midi) / noteRange) * this.waveHeight;

        const alpha = 0.3 + note.velocity * 0.7;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.roundRect(x, y, w, noteHeight, 1);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  connectedCallback() {
    super.connectedCallback();
    // Reschedule draw if a RAF was pending during disconnect/reconnect cycle
    this._scheduleDraw();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
  }

  render() {
    if (this.length <= 0)
      return html`<div class="container" style="width: 0; height: ${this.waveHeight}px;"></div>`;
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const visibleIndices = getVisibleChunkIndices(
      this.length,
      MAX_CANVAS_WIDTH,
      this.visibleStart,
      this.visibleEnd,
      this.originX
    );
    // Wrap canvases in a .container div with explicit width/height,
    // matching daw-waveform's container pattern. Background is on .container (not :host)
    // so it has the correct measurable size.
    return html`
      <div class="container" style="width: ${this.length}px; height: ${this.waveHeight}px;">
        ${visibleIndices.map((i) => {
          const chunkLeft = i * MAX_CANVAS_WIDTH;
          const chunkWidth = Math.min(this.length - chunkLeft, MAX_CANVAS_WIDTH);
          // Use data-index (not data-chunk-idx) to match daw-waveform pattern
          return html`<canvas
            data-index=${i}
            width=${chunkWidth * dpr}
            height=${this.waveHeight * dpr}
            style="left: ${chunkLeft}px; width: ${chunkWidth}px; height: ${this.waveHeight}px;"
          ></canvas>`;
        })}
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-piano-roll': DawPianoRollElement;
  }
}
