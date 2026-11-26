import { html } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-play-button')
export class DawPlayButtonElement extends DawTransportButton {
  @state() private _isRecording = false;
  private _targetRef: HTMLElement | null = null;
  /** The listeners on `_targetRef`, aborted when the target changes or the button disconnects. */
  private _targetListeners: AbortController | null = null;
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
    if (this._targetRef) {
      // Swapping away from a live target: recording state observed there is
      // stale — a replaced editor (framework remount reusing the id) never
      // fires the complete/error event that would clear it, wedging the
      // button. (A reconnect of the BUTTON has a null _targetRef and keeps
      // its state — the same editor may still be recording.)
      this._isRecording = false;
    }
    this._cleanupListeners();
    if (!target) return;
    this._targetRef = target;
    this._targetListeners = new AbortController();
    const { signal } = this._targetListeners;
    target.addEventListener('daw-recording-start', this._onRecStart, { signal });
    target.addEventListener('daw-recording-complete', this._onRecEnd, { signal });
    target.addEventListener('daw-recording-error', this._onRecEnd, { signal });
  }

  private _cleanupListeners() {
    if (this._targetRef) {
      this._targetListeners?.abort();
      this._targetListeners = null;
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
