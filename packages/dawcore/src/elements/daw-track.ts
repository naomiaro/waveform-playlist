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
  // No render() needed — this is a data-only element.
  createRenderRoot() {
    return this;
  }

  updated(changed: PropertyValues) {
    // Notify parent editor when track-relevant attributes change
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
