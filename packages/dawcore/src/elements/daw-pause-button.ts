import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-pause-button')
export class DawPauseButtonElement extends DawTransportButton {
  render() {
    return html`
      <button part="button" @click=${this._onClick}>
        <slot>Pause</slot>
      </button>
    `;
  }

  private _onClick() {
    this.target?.pause();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-pause-button': DawPauseButtonElement;
  }
}
