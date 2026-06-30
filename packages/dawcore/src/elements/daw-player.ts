import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { MediaElementPlayout } from '@waveform-playlist/media-element-playout';

// Side-effect imports register the child custom elements used in the template.
import './daw-waveform';
import './daw-playhead';
import './daw-ruler';

const MIN_RATE = 0.25;
const MAX_RATE = 4.0;

/**
 * `<daw-player>` — lightweight single-track HTMLMediaElement player.
 * Wraps a MediaElementPlayout engine for playback and composes
 * <daw-ruler>/<daw-waveform>/<daw-playhead> for visuals. No PlaylistEngine,
 * no adapter, no AudioContext. See docs/specs/2026-06-29-daw-player-core-design.md.
 */
@customElement('daw-player')
export class DawPlayerElement extends LitElement {
  @property({ type: String }) src = '';
  @property({ type: String, attribute: 'peaks-src' }) peaksSrc = '';
  @property({ type: Number, attribute: 'wave-height' }) waveHeight = 128;
  @property({ type: Boolean }) timescale = false;
  @property({ type: Boolean }) mono = false;
  @property({ type: Number, attribute: 'bar-width' }) barWidth = 1;
  @property({ type: Number, attribute: 'bar-gap' }) barGap = 0;

  @property({ type: Number, attribute: 'playback-rate', noAccessor: true })
  get playbackRate(): number {
    return this._playbackRate;
  }
  set playbackRate(value: number) {
    const valid = Number.isFinite(value);
    if (!valid || value < MIN_RATE || value > MAX_RATE) {
      console.warn(
        '[dawcore] <daw-player> playback-rate ' +
          value +
          ' out of range ' +
          MIN_RATE +
          '–' +
          MAX_RATE +
          ' — clamping'
      );
    }
    const clamped = Math.max(MIN_RATE, Math.min(MAX_RATE, valid ? value : 1));
    const old = this._playbackRate;
    this._playbackRate = clamped;
    this.requestUpdate('playbackRate', old);
  }
  private _playbackRate = 1;

  private _engine: MediaElementPlayout = new MediaElementPlayout();
  private _trackId: string | null = null;

  static styles = css`
    :host {
      display: block;
      position: relative;
      background: var(--daw-background, #1a1a2e);
    }
    .waveform-area {
      position: relative;
      width: 100%;
      overflow: hidden;
    }
  `;

  render() {
    return html`
      ${this.timescale ? html`<daw-ruler></daw-ruler>` : null}
      <div class="waveform-area">
        <daw-playhead></daw-playhead>
      </div>
    `;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('src')) this._loadSource();
    if (changed.has('playbackRate')) this._engine.setPlaybackRate(this._playbackRate);
  }

  private _loadSource(): void {
    if (!this.src) return;
    const track = this._engine.setSource({ source: this.src });
    this._trackId = track.id;
    this._engine.setPlaybackRate(this._playbackRate);
  }

  // --- Transport methods ---
  play(): void {
    this._engine.play();
  }
  pause(): void {
    this._engine.pause();
  }
  stop(): void {
    this._engine.stop();
  }
  seekTo(time: number): void {
    this._engine.seekTo(time);
  }
  setPlaybackRate(rate: number): void {
    this.playbackRate = rate; // setter clamps + requestUpdate triggers engine forward
  }
  setVolume(volume: number): void {
    this._engine.setMasterVolume(volume);
  }

  // --- Properties ---
  get isPlaying(): boolean {
    return this._engine.isPlaying;
  }
  get duration(): number {
    return this._engine.duration;
  }
  get currentTime(): number {
    return this._engine.getCurrentTime();
  }
  set currentTime(time: number) {
    this._engine.seekTo(time);
  }
  get volume(): number {
    return this._engine.masterVolume;
  }
  set volume(value: number) {
    this._engine.setMasterVolume(value);
  }
  get audioElement(): HTMLAudioElement | null {
    return this._trackId ? (this._engine.getTrack(this._trackId)?.element ?? null) : null;
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._engine.dispose();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-player': DawPlayerElement;
  }
}
