import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-stop-button')
export class DawStopButtonElement extends DawTransportButton {
  render() {
    return html`
      <button part="button" @click=${this._onClick}>
        <slot>Stop</slot>
      </button>
    `;
  }

  private _onClick() {
    this.target?.stop();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-stop-button': DawStopButtonElement;
  }
}
