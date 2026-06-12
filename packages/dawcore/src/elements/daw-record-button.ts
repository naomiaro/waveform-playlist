import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';
import { warnNoTargetOnce } from '../utils/transport-capability';

@customElement('daw-record-button')
export class DawRecordButtonElement extends DawTransportButton {
  protected static override requiredTargetMethods: readonly string[] = [
    'startRecording',
    'stopRecording',
  ];

  @state() private _isRecording = false;
  private _targetRef: HTMLElement | null = null;
  private _onStart = () => {
    this._isRecording = true;
  };
  private _onComplete = () => {
    this._isRecording = false;
  };
  private _onError = () => {
    this._isRecording = false;
  };

  static override styles = [
    DawTransportButton.styles,
    css`
      button[data-recording] {
        color: #d08070;
        border-color: #d08070;
        background: rgba(208, 128, 112, 0.15);
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    // Defer so <daw-transport for="..."> and the target editor are resolved
    requestAnimationFrame(() => this._listenToTarget());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._cleanupListeners();
  }

  private _listenToTarget() {
    const target = this.target;
    if (!target) return;
    this._targetRef = target;
    target.addEventListener('daw-recording-start', this._onStart);
    target.addEventListener('daw-recording-complete', this._onComplete);
    target.addEventListener('daw-recording-error', this._onError);
  }

  private _cleanupListeners() {
    if (this._targetRef) {
      this._targetRef.removeEventListener('daw-recording-start', this._onStart);
      this._targetRef.removeEventListener('daw-recording-complete', this._onComplete);
      this._targetRef.removeEventListener('daw-recording-error', this._onError);
      this._targetRef = null;
    }
  }

  render() {
    return html`
      <button
        part="button"
        ?disabled=${!this.targetSupported}
        ?data-recording=${this._isRecording}
        @click=${this._onClick}
      >
        <slot>Record</slot>
      </button>
    `;
  }

  private _onClick() {
    // Start-only — stop is handled by the stop button
    if (this._isRecording) return;
    const target = this.target;
    // Stale-render race guard: the target can vanish between render and click.
    if (!target) {
      warnNoTargetOnce(this);
      return;
    }
    target.startRecording(target.recordingStream);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-record-button': DawRecordButtonElement;
  }
}
