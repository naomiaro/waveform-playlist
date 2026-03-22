import { html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-pause-button')
export class DawPauseButtonElement extends DawTransportButton {
  @state() private _isPaused = false;
  @state() private _isRecording = false;
  private _targetRef: HTMLElement | null = null;
  private _onRecStart = () => {
    this._isRecording = true;
  };
  private _onRecEnd = () => {
    this._isRecording = false;
    this._isPaused = false;
  };

  static override styles = [
    DawTransportButton.styles,
    css`
      button[data-paused] {
        background: rgba(255, 255, 255, 0.1);
        border-color: var(--daw-controls-text, #e0d4c8);
      }
    `,
  ];

  connectedCallback() {
    super.connectedCallback();
    // Defer so <daw-transport for="..."> and the target editor are resolved
    requestAnimationFrame(() => {
      const target = this.target;
      if (!target) return;
      this._targetRef = target;
      target.addEventListener('daw-recording-start', this._onRecStart);
      target.addEventListener('daw-recording-complete', this._onRecEnd);
      target.addEventListener('daw-recording-error', this._onRecEnd);
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._targetRef) {
      this._targetRef.removeEventListener('daw-recording-start', this._onRecStart);
      this._targetRef.removeEventListener('daw-recording-complete', this._onRecEnd);
      this._targetRef.removeEventListener('daw-recording-error', this._onRecEnd);
      this._targetRef = null;
    }
  }

  render() {
    return html`
      <button part="button" ?data-paused=${this._isPaused} @click=${this._onClick}>
        <slot>Pause</slot>
      </button>
    `;
  }

  private _onClick() {
    const target = this.target;
    if (!target) {
      console.warn(
        '[dawcore] <daw-pause-button> has no target. Check <daw-transport for="..."> references a valid <daw-editor> id.'
      );
      return;
    }

    if (this._isRecording) {
      // During recording: toggle pause/resume of both worklet and playback (Audacity-style)
      if (this._isPaused) {
        target.resumeRecording();
        target.play(target.currentTime);
        this._isPaused = false;
      } else {
        target.pauseRecording();
        target.pause();
        this._isPaused = true;
      }
    } else {
      target.pause();
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-pause-button': DawPauseButtonElement;
  }
}
