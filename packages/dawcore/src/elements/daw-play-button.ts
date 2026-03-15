import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-play-button')
export class DawPlayButtonElement extends DawTransportButton {
  render() {
    return html`
      <button part="button" @click=${this._onClick}>
        <slot>Play</slot>
      </button>
    `;
  }

  private _onClick() {
    this.target?.play();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-play-button': DawPlayButtonElement;
  }
}
