import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

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
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-clip': DawClipElement;
  }
}
