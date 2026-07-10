import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-play-button')
export class DawPlayButtonElement extends DawTransportButton {
  @state() private _isRecording = false;
  private _targetRef: HTMLElement | null = null;
  private _onRecStart = () => {
    this._isRecording = true;
  };
  private _onRecEnd = () => {
    this._isRecording = false;
  };

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
    // connectedCallback rAF (or a swapped <daw-transport for>) would
    // otherwise never get the recording-state listeners: Play stays enabled
    // during recording (#573, same fix as daw-record-button).
    this._ensureTargetListeners();
  }

  private _ensureTargetListeners() {
    const target = this.target;
    if (target === this._targetRef) return;
    this._cleanupListeners();
    if (!target) return;
    this._targetRef = target;
    target.addEventListener('daw-recording-start', this._onRecStart);
    target.addEventListener('daw-recording-complete', this._onRecEnd);
    target.addEventListener('daw-recording-error', this._onRecEnd);
  }

  private _cleanupListeners() {
    if (this._targetRef) {
      this._targetRef.removeEventListener('daw-recording-start', this._onRecStart);
      this._targetRef.removeEventListener('daw-recording-complete', this._onRecEnd);
      this._targetRef.removeEventListener('daw-recording-error', this._onRecEnd);
      this._targetRef = null;
    }
  }

  render() {
    return html`
      <button part="button" ?disabled=${this._isRecording} @click=${this._onClick}>
        <slot>Play</slot>
      </button>
    `;
  }

  private _onClick() {
    const target = this.target;
    if (!target) {
      console.warn(
        '[dawcore] <daw-play-button> has no target. Check <daw-transport for="..."> references a valid <daw-editor> id.'
      );
      return;
    }
    target.play();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-play-button': DawPlayButtonElement;
  }
}
