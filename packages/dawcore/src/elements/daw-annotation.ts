import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { AnnotationData } from '@waveform-playlist/core';

/** Valid tick value: finite non-negative integer. */
function isValidTick(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}

/**
 * Declarative annotation data element (light DOM). Its `start`/`end`
 * attributes and text content ARE the single source of truth — the editor's
 * annotation lane and <daw-annotation-list> both derive from them.
 */
@customElement('daw-annotation')
export class DawAnnotationElement extends LitElement {
  /** Start time in seconds. Reflected — attribute writes drive both views. */
  @property({ type: Number, noAccessor: true, reflect: true })
  get start(): number {
    return this._start;
  }
  set start(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      console.warn('[dawcore] daw-annotation start ' + String(value) + ' is invalid — ignored');
      return;
    }
    const old = this._start;
    this._start = value;
    this.requestUpdate('start', old);
  }
  private _start = 0;

  /** End time in seconds. Reflected. */
  @property({ type: Number, noAccessor: true, reflect: true })
  get end(): number {
    return this._end;
  }
  set end(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      console.warn('[dawcore] daw-annotation end ' + String(value) + ' is invalid — ignored');
      return;
    }
    const old = this._end;
    this._end = value;
    this.requestUpdate('end', old);
  }
  private _end = 0;

  /** Musical start position (ticks). Authoritative when end-tick is also set —
   * start/end seconds become a derived cache the host editor keeps fresh
   * (clip startTick pattern). */
  @property({ type: Number, noAccessor: true, reflect: true, attribute: 'start-tick' })
  get startTick(): number | null {
    return this._startTick;
  }
  set startTick(value: number | null) {
    const old = this._startTick;
    if (value === null) {
      this._startTick = null;
      this.requestUpdate('startTick', old);
      return;
    }
    if (!isValidTick(value)) {
      console.warn(
        '[dawcore] daw-annotation start-tick ' + String(value) + ' is invalid — ignored'
      );
      return;
    }
    this._startTick = value;
    this.requestUpdate('startTick', old);
  }
  private _startTick: number | null = null;

  /** Musical end position (ticks). See startTick. */
  @property({ type: Number, noAccessor: true, reflect: true, attribute: 'end-tick' })
  get endTick(): number | null {
    return this._endTick;
  }
  set endTick(value: number | null) {
    const old = this._endTick;
    if (value === null) {
      this._endTick = null;
      this.requestUpdate('endTick', old);
      return;
    }
    if (!isValidTick(value)) {
      console.warn('[dawcore] daw-annotation end-tick ' + String(value) + ' is invalid — ignored');
      return;
    }
    this._endTick = value;
    this.requestUpdate('endTick', old);
  }
  private _endTick: number | null = null;

  /** Tick-based iff BOTH tick attributes are set (authority rule). */
  get isTickBased(): boolean {
    return this._startTick !== null && this._endTick !== null;
  }

  private _warnedHalfTick = false;

  private readonly _generatedId = 'annotation-' + crypto.randomUUID();

  /** Stable identity: the id attribute when present, else a generated UUID. */
  get annotationId(): string {
    return this.id || this._generatedId;
  }

  toAnnotationData(): AnnotationData {
    const text = this.textContent?.trim() ?? '';
    const data: AnnotationData = {
      id: this.annotationId,
      start: this.start,
      end: this.end,
      lines: text.length > 0 ? text.split('\n') : [''],
    };
    if (this.isTickBased) {
      data.startTick = this._startTick as number;
      data.endTick = this._endTick as number;
    }
    return data;
  }

  // Light DOM — data container only.
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Data element — its light-DOM text must not render through a host's
    // bare <slot> (e.g. <daw-editor>'s, or a bare <daw-annotation> used
    // outside a track). Views (editor lane, <daw-annotation-list>) present
    // it instead.
    this.style.display = 'none';
    // Deferred so ancestor listeners (editor / annotation track) register first
    // when parsed all-at-once — same pattern as <daw-clip>.
    setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('daw-annotation-connected', {
          bubbles: true,
          composed: true,
          detail: { annotationId: this.annotationId, element: this },
        })
      );
    }, 0);
  }

  private _hasRendered = false;

  updated(changed: PropertyValues) {
    // Exactly one tick attribute set is a half-configured state — warn once.
    const halfTick = (this._startTick !== null) !== (this._endTick !== null);
    if (halfTick && !this._warnedHalfTick) {
      this._warnedHalfTick = true;
      console.warn(
        '[dawcore] daw-annotation "' +
          this.annotationId +
          '": only one of start-tick/end-tick is set — treated as seconds-based until both are present'
      );
    }
    if (!this._hasRendered) {
      this._hasRendered = true;
      return;
    }
    if (
      changed.has('start') ||
      changed.has('end') ||
      changed.has('startTick') ||
      changed.has('endTick')
    ) {
      this.dispatchEvent(
        new CustomEvent('daw-annotation-update', {
          bubbles: true,
          composed: true,
          detail: { annotationId: this.annotationId },
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-annotation': DawAnnotationElement;
  }
}
