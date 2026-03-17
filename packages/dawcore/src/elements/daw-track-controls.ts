import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('daw-track-controls')
export class DawTrackControlsElement extends LitElement {
  /** Track ID — set by the editor to link controls to a track row. */
  @property({ attribute: false }) trackId: string | null = null;
  @property({ attribute: false }) trackName = '';
  @property({ type: Number, attribute: false }) volume = 1;
  @property({ type: Number, attribute: false }) pan = 0;
  @property({ type: Boolean, attribute: false }) muted = false;
  @property({ type: Boolean, attribute: false }) soloed = false;

  static styles = css`
    :host {
      display: flex;
      flex-direction: column;
      justify-content: center;
      box-sizing: border-box;
      padding: 6px 8px;
      background: var(--daw-controls-background, #0f0f1a);
      color: var(--daw-controls-text, #c49a6c);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-family: system-ui, sans-serif;
      font-size: 11px;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 4px;
      margin-bottom: 6px;
    }
    .name {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      font-weight: 600;
      font-size: 11px;
    }
    .remove-btn {
      background: none;
      border: none;
      color: var(--daw-controls-text, #c49a6c);
      cursor: pointer;
      padding: 0 2px;
      font-size: 14px;
      line-height: 1;
      opacity: 0.4;
    }
    .remove-btn:hover {
      opacity: 1;
      color: #d08070;
    }
    .buttons {
      display: flex;
      gap: 3px;
      margin-bottom: 6px;
    }
    .btn {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 3px;
      color: var(--daw-controls-text, #c49a6c);
      cursor: pointer;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      text-align: center;
    }
    .btn:hover {
      background: rgba(255, 255, 255, 0.12);
    }
    .btn.active {
      background: rgba(99, 199, 95, 0.25);
      border-color: rgba(99, 199, 95, 0.5);
      color: #63c75f;
    }
    .btn.muted-active {
      background: rgba(208, 128, 112, 0.25);
      border-color: rgba(208, 128, 112, 0.5);
      color: #d08070;
    }
    .slider-row {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 20px;
    }
    .slider-label {
      width: 50px;
      font-size: 9px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      opacity: 0.6;
      flex-shrink: 0;
      display: flex;
      justify-content: space-between;
    }
    .slider-label-name {
      opacity: 0.5;
    }
    .slider-label-value {
      font-family: 'Courier New', monospace;
    }
    input[type='range'] {
      flex: 1;
      min-width: 0;
      height: 20px;
      margin: 0;
      -webkit-appearance: none;
      appearance: none;
      background: transparent;
      cursor: pointer;
    }
    input[type='range']::-webkit-slider-runnable-track {
      height: 3px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 2px;
    }
    input[type='range']::-webkit-slider-thumb {
      -webkit-appearance: none;
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--daw-controls-text, #c49a6c);
      margin-top: -4.5px;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }
    input[type='range']::-moz-range-track {
      height: 3px;
      background: rgba(255, 255, 255, 0.12);
      border-radius: 2px;
      border: none;
    }
    input[type='range']::-moz-range-thumb {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: var(--daw-controls-text, #c49a6c);
      border: none;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    }
  `;

  private _onVolumeInput = (e: Event) => {
    const value = Number((e.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this._dispatchControl('volume', value);
  };

  private _onPanInput = (e: Event) => {
    const value = Number((e.target as HTMLInputElement).value);
    if (Number.isFinite(value)) this._dispatchControl('pan', value);
  };

  private _onMuteClick = () => {
    this._dispatchControl('muted', !this.muted);
  };

  private _onSoloClick = () => {
    this._dispatchControl('soloed', !this.soloed);
  };

  private _onRemoveClick = () => {
    if (!this.trackId) return;
    this.dispatchEvent(
      new CustomEvent('daw-track-remove', {
        bubbles: true,
        composed: true,
        detail: { trackId: this.trackId },
      })
    );
  };

  private _dispatchControl(prop: string, value: number | boolean) {
    if (!this.trackId) return;
    this.dispatchEvent(
      new CustomEvent('daw-track-control', {
        bubbles: true,
        composed: true,
        detail: { trackId: this.trackId, prop, value },
      })
    );
  }

  render() {
    const volPercent = Math.round(this.volume * 100);
    const panPercent = Math.round(Math.abs(this.pan) * 100);
    const panDisplay = this.pan === 0 ? 'C' : (this.pan > 0 ? 'R' : 'L') + panPercent;

    return html`
      <div class="header">
        <span class="name" title=${this.trackName}>${this.trackName || 'Untitled'}</span>
        <button class="remove-btn" @click=${this._onRemoveClick} title="Remove track">
          &times;
        </button>
      </div>
      <div class="buttons">
        <button
          class="btn ${this.muted ? 'muted-active' : ''}"
          @click=${this._onMuteClick}
          title="Mute"
        >
          M
        </button>
        <button class="btn ${this.soloed ? 'active' : ''}" @click=${this._onSoloClick} title="Solo">
          S
        </button>
      </div>
      <div class="slider-row">
        <span class="slider-label">
          <span class="slider-label-name">Vol</span>
          <span class="slider-label-value">${volPercent}%</span>
        </span>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          .value=${String(this.volume)}
          @input=${this._onVolumeInput}
        />
      </div>
      <div class="slider-row">
        <span class="slider-label">
          <span class="slider-label-name">Pan</span>
          <span class="slider-label-value">${panDisplay}</span>
        </span>
        <input
          type="range"
          min="-1"
          max="1"
          step="0.01"
          .value=${String(this.pan)}
          @input=${this._onPanInput}
        />
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-track-controls': DawTrackControlsElement;
  }
}
