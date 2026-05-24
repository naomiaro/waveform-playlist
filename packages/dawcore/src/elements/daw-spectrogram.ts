import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

const MAX_CANVAS_WIDTH = 1000;

interface SpectrogramHost extends HTMLElement {
  _spectrogramRegisterCanvas?: (reg: {
    canvasId: string;
    canvas: OffscreenCanvas;
    clipId: string;
    trackId: string;
    channelIndex: number;
    chunkIndex: number;
    globalPixelOffset: number;
    widthPx: number;
    heightPx: number;
  }) => void;
  _spectrogramUnregisterCanvas?: (canvasId: string) => void;
}

@customElement('daw-spectrogram')
export class DawSpectrogramElement extends LitElement {
  @property({ attribute: false }) clipId = '';
  @property({ attribute: false }) trackId = '';
  @property({ type: Number, attribute: false }) channelIndex = 0;
  @property({ type: Number, attribute: false }) length = 0;
  @property({ type: Number, attribute: false }) waveHeight = 128;

  @property({ type: Number, attribute: false, noAccessor: true })
  get samplesPerPixel(): number {
    return this._samplesPerPixel;
  }
  set samplesPerPixel(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      console.warn('[dawcore] daw-spectrogram samplesPerPixel ' + value + ' is invalid — ignored');
      return;
    }
    const old = this._samplesPerPixel;
    this._samplesPerPixel = value;
    this.requestUpdate('samplesPerPixel', old);
  }
  private _samplesPerPixel = 1024;

  @property({ type: Number, attribute: false, noAccessor: true })
  get sampleRate(): number {
    return this._sampleRate;
  }
  set sampleRate(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      console.warn('[dawcore] daw-spectrogram sampleRate ' + value + ' is invalid — ignored');
      return;
    }
    const old = this._sampleRate;
    this._sampleRate = value;
    this.requestUpdate('sampleRate', old);
  }
  private _sampleRate = 44100;

  @property({ type: Number, attribute: false }) clipOffsetSeconds = 0;
  @property({ type: Number, attribute: false }) visibleStart = -Infinity;
  @property({ type: Number, attribute: false }) visibleEnd = Infinity;
  @property({ type: Number, attribute: false }) originX = 0;

  static styles = css`
    :host {
      display: block;
      position: relative;
      background: var(--daw-spectrogram-background, #000);
    }
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      pointer-events: none;
    }
  `;

  private _canvases: HTMLCanvasElement[] = [];
  private _registeredCanvasIds: string[] = [];
  private _warnedNoHost = false;

  /**
   * Walk up to the editor host. `closest('daw-editor')` does NOT cross
   * shadow boundaries — and this element lives inside the editor's shadow
   * DOM — so use getRootNode().host to step out.
   */
  private _findHostEditor(): SpectrogramHost | null {
    const root = this.getRootNode();
    const host = root instanceof ShadowRoot ? root.host : null;
    if (!host) return null;
    if (host.tagName === 'DAW-EDITOR') return host as SpectrogramHost;
    return host.closest('daw-editor') as SpectrogramHost | null;
  }

  willUpdate(changed: PropertyValues): void {
    const layoutChanged =
      changed.has('length') ||
      changed.has('waveHeight') ||
      changed.has('samplesPerPixel') ||
      changed.has('clipId') ||
      changed.has('channelIndex');
    if (layoutChanged) {
      this._rebuildChunks();
    }
  }

  private _rebuildChunks(): void {
    this._unregisterAllCanvases();
    this._canvases = [];

    if (this.length <= 0) return;

    const chunkCount = Math.ceil(this.length / MAX_CANVAS_WIDTH);
    for (let i = 0; i < chunkCount; i++) {
      const widthPx = Math.min(MAX_CANVAS_WIDTH, this.length - i * MAX_CANVAS_WIDTH);
      const canvas = document.createElement('canvas');
      canvas.style.left = i * MAX_CANVAS_WIDTH + 'px';
      canvas.style.width = widthPx + 'px';
      const dpr = window.devicePixelRatio || 1;
      canvas.width = widthPx * dpr;
      canvas.height = this.waveHeight * dpr;
      this._canvases.push(canvas);
    }
  }

  protected updated(_changed: PropertyValues): void {
    if (this._registeredCanvasIds.length === 0 && this._canvases.length > 0) {
      requestAnimationFrame(() => this._registerCanvases());
    }
  }

  private _registerCanvases(): void {
    const editor = this._findHostEditor();
    if (!editor || typeof editor._spectrogramRegisterCanvas !== 'function') {
      if (!this._warnedNoHost) {
        this._warnedNoHost = true;
        console.warn(
          '[dawcore] <daw-spectrogram> (clip ' +
            this.clipId +
            ') could not find host <daw-editor>. Canvases will not render. ' +
            'Ensure the element is mounted inside a <daw-editor>.'
        );
      }
      return;
    }

    for (let i = 0; i < this._canvases.length; i++) {
      const canvas = this._canvases[i];
      const canvasId = this.clipId + '-ch' + this.channelIndex + '-chunk' + i;
      let offscreen: OffscreenCanvas;
      try {
        offscreen = canvas.transferControlToOffscreen();
      } catch (err) {
        console.warn(
          '[dawcore] daw-spectrogram transferControlToOffscreen failed for ' +
            canvasId +
            ': ' +
            (err instanceof Error ? err.message : String(err))
        );
        continue;
      }
      editor._spectrogramRegisterCanvas({
        canvasId,
        canvas: offscreen,
        clipId: this.clipId,
        trackId: this.trackId,
        channelIndex: this.channelIndex,
        chunkIndex: i,
        globalPixelOffset: this.originX + i * MAX_CANVAS_WIDTH,
        widthPx: parseFloat(canvas.style.width),
        heightPx: this.waveHeight,
      });
      this._registeredCanvasIds.push(canvasId);
    }
  }

  private _unregisterAllCanvases(): void {
    const editor = this._findHostEditor();
    if (editor && typeof editor._spectrogramUnregisterCanvas === 'function') {
      for (const id of this._registeredCanvasIds) {
        editor._spectrogramUnregisterCanvas(id);
      }
    }
    this._registeredCanvasIds = [];
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unregisterAllCanvases();
  }

  render() {
    return html`${this._canvases.map((c) => c)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-spectrogram': DawSpectrogramElement;
  }
}
