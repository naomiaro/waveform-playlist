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
    const target = this.target;
    if (!target) {
      console.warn(
        '[dawcore] <daw-stop-button> has no target. Check <daw-transport for="..."> references a valid <daw-editor> id.'
      );
      return;
    }
    // Stop recording first (also stops playback via the controller),
    // then stop playback if it was running independently
    if (target.isRecording) {
      target.stopRecording();
    }
    target.stop();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-stop-button': DawStopButtonElement;
  }
}
