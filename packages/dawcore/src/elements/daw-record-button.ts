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
    requestAnimationFrame(() => {
      if (!this.isConnected) return;
      this._ensureTargetListeners();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._cleanupListeners();
  }

  protected override updated() {
    // Re-resolve on every render (pointerenter triggers one via the base
    // class) — a target that upgrades/appears after the one-shot
    // connectedCallback rAF would otherwise never get the recording-state
    // listeners: the button starts recordings it can't reflect (#573).
    this._ensureTargetListeners();
  }

  private _ensureTargetListeners() {
    const target = this.target;
    if (target === this._targetRef) return;
    this._cleanupListeners();
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
    // Guarantee state listeners exist for any recording this button starts
    // (covers programmatic clicks that never trigger a re-render).
    this._ensureTargetListeners();
    target.startRecording(target.recordingStream);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-record-button': DawRecordButtonElement;
  }
}
