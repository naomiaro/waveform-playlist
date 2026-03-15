import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('daw-transport')
export class DawTransportElement extends LitElement {
  @property() for = '';

  get target(): HTMLElement | null {
    return this.for ? document.getElementById(this.for) : null;
  }

  // Light DOM — button children stay in consumer's DOM.
  // No render() needed; light DOM elements don't use <slot>.
  createRenderRoot() {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-transport': DawTransportElement;
  }
}
