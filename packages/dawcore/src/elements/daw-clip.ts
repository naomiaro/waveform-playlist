import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

@customElement('daw-clip')
export class DawClipElement extends LitElement {
  @property() src = '';
  @property({ attribute: 'peaks-src' }) peaksSrc = '';
  @property({ type: Number }) start = 0;
  @property({ type: Number }) duration = 0;
  @property({ type: Number }) offset = 0;
  @property({ type: Number }) gain = 1;
  @property() name = '';
  @property() color = '';
  @property({ type: Number, attribute: 'fade-in' }) fadeIn = 0;
  @property({ type: Number, attribute: 'fade-out' }) fadeOut = 0;
  @property({ attribute: 'fade-type' }) fadeType = 'linear';

  readonly clipId = crypto.randomUUID();

  // Light DOM — no visual rendering, just a data container
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Defer so the parent <daw-track> connectedCallback runs first and the
    // editor's listeners are registered. The editor's _onClipConnected
    // handler ignores this event during the parent track's initial load
    // (daw-track-connected reads all <daw-clip> children synchronously);
    // late-append clips trigger an incremental load.
    setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('daw-clip-connected', {
          bubbles: true,
          composed: true,
          detail: { clipId: this.clipId, element: this },
        })
      );
    }, 0);
  }

  // Removal is detected by the editor's MutationObserver — detached elements
  // cannot bubble events to ancestors.

  private _hasRendered = false;

  updated(changed: PropertyValues) {
    if (!this._hasRendered) {
      this._hasRendered = true;
      return;
    }
    const clipProps = [
      'src',
      'peaksSrc',
      'start',
      'duration',
      'offset',
      'gain',
      'name',
      'fadeIn',
      'fadeOut',
      'fadeType',
    ];
    if (clipProps.some((p) => changed.has(p as keyof this))) {
      this.dispatchEvent(
        new CustomEvent('daw-clip-update', {
          bubbles: true,
          composed: true,
          detail: { clipId: this.clipId },
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-clip': DawClipElement;
  }
}
