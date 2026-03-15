import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

@customElement('daw-track')
export class DawTrackElement extends LitElement {
  @property() src = '';
  @property() name = '';
  @property({ type: Number }) volume = 1;
  @property({ type: Number }) pan = 0;
  @property({ type: Boolean }) muted = false;
  @property({ type: Boolean }) soloed = false;

  readonly trackId = crypto.randomUUID();

  // Light DOM so <daw-clip> children are queryable.
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Defer so the editor's connectedCallback (which registers the
    // daw-track-connected listener) has time to run. Without this,
    // tracks parsed before the editor would fire events with no listener.
    setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('daw-track-connected', {
          bubbles: true,
          composed: true,
          detail: { trackId: this.trackId, element: this },
        })
      );
    }, 0);
  }

  // Track removal is detected by the editor's MutationObserver,
  // not by dispatching from disconnectedCallback (detached elements
  // cannot bubble events to ancestors).

  private _hasRendered = false;

  updated(changed: PropertyValues) {
    // Skip the initial render — all properties appear in `changed` on first
    // update, but the editor handles initial state via daw-track-connected.
    if (!this._hasRendered) {
      this._hasRendered = true;
      return;
    }

    const trackProps = ['volume', 'pan', 'muted', 'soloed', 'src', 'name'];
    const hasTrackChange = trackProps.some((p) => changed.has(p as keyof this));

    if (hasTrackChange) {
      this.dispatchEvent(
        new CustomEvent('daw-track-update', {
          bubbles: true,
          composed: true,
          detail: { trackId: this.trackId },
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-track': DawTrackElement;
  }
}
