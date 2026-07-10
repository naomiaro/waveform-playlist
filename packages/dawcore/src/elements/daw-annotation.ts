import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { AnnotationData } from '@waveform-playlist/core';

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

  private readonly _generatedId = 'annotation-' + crypto.randomUUID();

  /** Stable identity: the id attribute when present, else a generated UUID. */
  get annotationId(): string {
    return this.id || this._generatedId;
  }

  toAnnotationData(): AnnotationData {
    const text = this.textContent?.trim() ?? '';
    return {
      id: this.annotationId,
      start: this.start,
      end: this.end,
      lines: text.length > 0 ? text.split('\n') : [''],
    };
  }

  // Light DOM — data container only.
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
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
    if (!this._hasRendered) {
      this._hasRendered = true;
      return;
    }
    if (changed.has('start') || changed.has('end')) {
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
