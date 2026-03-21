import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-record-button')
export class DawRecordButtonElement extends DawTransportButton {
  @state() private _isRecording = false;

  static override styles = [
    DawTransportButton.styles,
    css`
      button[data-recording] {
        color: #d08070;
        border-color: #d08070;
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    this._listenToTarget();
  }

  private _listenToTarget() {
    const target = this.target;
    if (!target) return;
    target.addEventListener('daw-recording-start', () => {
      this._isRecording = true;
    });
    target.addEventListener('daw-recording-complete', () => {
      this._isRecording = false;
    });
    target.addEventListener('daw-recording-error', () => {
      this._isRecording = false;
    });
  }

  render() {
    return html`
      <button part="button" ?data-recording=${this._isRecording} @click=${this._onClick}>
        <slot>${this._isRecording ? 'Stop Rec' : 'Record'}</slot>
      </button>
    `;
  }

  private _onClick() {
    const target = this.target;
    if (!target) {
      console.warn(
        '[dawcore] <daw-record-button> has no target. Check <daw-transport for="..."> references a valid <daw-editor> id.'
      );
      return;
    }
    if (this._isRecording) {
      target.stopRecording();
    } else {
      target.startRecording(target.recordingStream);
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-record-button': DawRecordButtonElement;
  }
}
