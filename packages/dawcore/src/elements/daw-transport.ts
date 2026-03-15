import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('daw-transport')
export class DawTransportElement extends LitElement {
  @property() for = '';

  get target(): HTMLElement | null {
    return this.for ? document.getElementById(this.for) : null;
  }

  // Light DOM — button children stay in consumer's DOM
  createRenderRoot() {
    return this;
  }

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-transport': DawTransportElement;
  }
}
