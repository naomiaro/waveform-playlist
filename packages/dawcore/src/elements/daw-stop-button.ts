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
    // When recording: await stopRecording (which awaits the worklet's
    // done ack) BEFORE calling editor.stop(). Calling stop() in parallel
    // disrupts the audio thread mid-handshake — engine.stop() can pause
    // worklet rendering, which prevents the done message from arriving
    // and triggers the stop-timeout warning.
    if (target.isRecording) {
      target.stopRecording().then(
        () => target.stop(),
        (err: unknown) => {
          console.warn('[dawcore] stopRecording failed: ' + String(err));
          target.stop();
        }
      );
    } else {
      target.stop();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-stop-button': DawStopButtonElement;
  }
}
