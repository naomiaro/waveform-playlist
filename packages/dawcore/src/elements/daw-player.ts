import { LitElement, html, css, type PropertyValues } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import { AnimationController } from '../controllers/animation-controller';
import type { DawPlayheadElement } from './daw-playhead';
import { loadWaveformDataFromUrl } from '../interactions/peaks-loader';
import { extractPeaks } from '../workers/waveformDataUtils';
import type { Peaks } from '@waveform-playlist/core';

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
  private _anim = new AnimationController(this);
  private _metadataLoaded = false;
  private _readyDispatched = false;
  /** True once peaks resolution is complete: succeeded, failed, or no peaks-src set. */
  private _peaksSettled = false;
  private _waveformData: import('waveform-data').default | null = null;
  @state() private _channelPeaks: Peaks[] = [];
  private _sampleRate = 48000;
  private _resizeObserver: ResizeObserver | null = null;

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

  connectedCallback(): void {
    super.connectedCallback();
    this._engine.on('loadedmetadata', this._onLoadedMetadata);
    this._engine.on('play', this._onPlay);
    this._engine.on('pause', this._onPause);
    this._engine.on('ended', this._onEnded);
    this._engine.on('error', this._onError);
    this._resizeObserver = new ResizeObserver(() => this._renderWaveform());
    // Observe after first render so .waveform-area exists.
    requestAnimationFrame(() => {
      const area = this.shadowRoot?.querySelector('.waveform-area');
      if (area) this._resizeObserver?.observe(area);
    });
  }

  render() {
    const width = this._timelineWidth;
    const channels = this._channelPeaks.length;
    const channelHeight = channels > 0 ? this.waveHeight / channels : this.waveHeight;
    return html`
      ${this.timescale
        ? html`<daw-ruler
            .samplesPerPixel=${this._channelSpp(width)}
            .sampleRate=${this._sampleRate}
            .duration=${this._engine.duration}
            .totalWidth=${width}
          ></daw-ruler>`
        : null}
      <div
        class="waveform-area"
        style="height:${this.waveHeight}px"
        @pointerdown=${this._onPointerDown}
      >
        ${repeat(
          this._channelPeaks,
          (_p, i) => i,
          (peaks) =>
            html`<daw-waveform
              .peaks=${peaks}
              .length=${width}
              .waveHeight=${channelHeight}
              .barWidth=${this.barWidth}
              .barGap=${this.barGap}
            ></daw-waveform>`
        )}
        <daw-playhead></daw-playhead>
      </div>
    `;
  }

  protected updated(changed: PropertyValues): void {
    if (changed.has('src')) this._loadSource();
    if (changed.has('playbackRate')) this._engine.setPlaybackRate(this._playbackRate);
    if (changed.has('peaksSrc')) this._loadPeaks();
    // Only `mono` changes the derived peaks; `wave-height` only affects display
    // height, which render() reads directly (recomputing peaks for it is wasteful
    // and, on first update, sets @state mid-cycle → a Lit change-in-update warning).
    if (changed.has('mono')) this._renderWaveform();
  }

  private async _loadPeaks(): Promise<void> {
    this._waveformData = null;
    this._readyDispatched = false; // re-arm ready for the new source
    this._peaksSettled = false; // new load in progress; wait for outcome before firing daw-ready
    if (!this.peaksSrc) {
      // No peaks-src — peaks are settled immediately (scrubber-only is a valid ready state).
      this._peaksSettled = true;
      this._renderWaveform();
      this._maybeDispatchReady();
      return;
    }
    const requested = this.peaksSrc;
    try {
      const wd = await loadWaveformDataFromUrl(requested);
      if (this.peaksSrc !== requested) return; // stale — a newer peaks-src won (don't settle)
      this._waveformData = wd;
      this._sampleRate = wd.sample_rate;
      this._peaksSettled = true;
      this._renderWaveform();
      this._maybeDispatchReady();
    } catch (err) {
      console.warn('[dawcore] <daw-player> failed to load peaks-src: ' + String(err));
      // A failed waveform must not permanently block daw-ready — the player IS ready to play.
      this._peaksSettled = true;
      this._renderWaveform(); // scrubber-only fallback
      this._maybeDispatchReady();
    }
  }

  /** Recompute fit-to-width peaks from the loaded WaveformData. No-op without data. */
  private _renderWaveform(): void {
    const wd = this._waveformData;
    const width = this._timelineWidth;
    if (!wd || width <= 0) {
      // Avoid churning @state with a fresh empty array when already empty —
      // a redundant reassignment during updated() schedules a wasted re-render.
      if (this._channelPeaks.length > 0) this._channelPeaks = [];
      return;
    }
    // Resample so the peak count ≈ the host width (fit-to-width).
    const totalSamples = wd.length * wd.scale;
    const samplesPerPixel = Math.max(wd.scale, Math.ceil(totalSamples / width));
    const peakData = extractPeaks(wd, samplesPerPixel, this.mono);
    this._channelPeaks = peakData.data;
  }

  /**
   * Samples-per-pixel used by the ruler so its time labels span the full width.
   * This is intentionally a separate time-based SPP (duration × sampleRate / width)
   * for the ruler labels — equivalent to the waveform SPP when the WaveformData spans
   * the full audio duration; may differ for pre-trimmed peaks.
   */
  private _channelSpp(width: number): number {
    const d = this._engine.duration;
    if (d <= 0 || width <= 0) return 1;
    return Math.max(1, Math.ceil((d * this._sampleRate) / width));
  }

  private _loadSource(): void {
    if (!this.src) return;
    // Re-arm the daw-ready gate so a new audio source fires a fresh event.
    // _peaksSettled is intentionally NOT touched here — for a src-only swap the
    // existing peaks remain valid; _loadPeaks resets it when peaks-src changes.
    this._metadataLoaded = false;
    this._readyDispatched = false;
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
    this._anim.stop();
    this._updatePlayhead();
    this._dispatch('daw-stop');
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

  private _onPointerDown = (e: PointerEvent): void => {
    const area = e.currentTarget as HTMLElement;
    const width = area.clientWidth;
    const d = this._engine.duration;
    // _engine.duration coerces NaN→0 upstream (MediaElementTrack.duration is
    // `audioElement.duration || _peaks?.duration || 0`), so `d <= 0` also
    // covers the pre-metadata/NaN case — no separate NaN check needed.
    if (width <= 0 || d <= 0) return;
    const ratio = Math.max(0, Math.min(1, e.offsetX / width));
    this.seekTo(ratio * d);
    this._updatePlayhead();
  };

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._anim.stop();
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._engine.off('loadedmetadata', this._onLoadedMetadata);
    this._engine.off('play', this._onPlay);
    this._engine.off('pause', this._onPause);
    this._engine.off('ended', this._onEnded);
    this._engine.off('error', this._onError);
    this._engine.dispose();
  }

  // --- Private event handlers (arrow fields for stable identity) ---

  private _dispatch<T>(name: string, detail?: T): void {
    this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }));
  }

  private _onLoadedMetadata = (): void => {
    this._metadataLoaded = true;
    this._maybeDispatchReady();
  };

  private _onPlay = (): void => {
    this._dispatch('daw-play');
    this._anim.start(this._frame);
  };

  private _onPause = (): void => {
    this._anim.stop();
    this._updatePlayhead();
    this._dispatch('daw-pause');
  };

  private _onEnded = (): void => {
    this._anim.stop();
    this._updatePlayhead(); // snap playhead to end rather than leaving it ≤1 frame short
    this._dispatch('daw-ended');
  };

  private _onError = (err: MediaError | null): void => {
    console.warn('[dawcore] <daw-player> failed to load src: ' + (err?.message ?? 'unknown'));
    this._dispatch('daw-error', { operation: 'load', error: err });
  };

  /** rAF tick while playing: positions the playhead and emits daw-timeupdate. */
  private _frame = (): void => {
    this._updatePlayhead();
    this._dispatch('daw-timeupdate', { time: this._engine.getCurrentTime() });
  };

  private _maybeDispatchReady(): void {
    if (this._readyDispatched) return;
    if (this._metadataLoaded && this._peaksSettled) {
      this._readyDispatched = true;
      this._dispatch('daw-ready');
    }
  }

  private get _playhead(): DawPlayheadElement | null {
    return this.shadowRoot?.querySelector('daw-playhead') ?? null;
  }

  private _updatePlayhead(): void {
    const d = this._engine.duration;
    if (d <= 0) return;
    const px = (this._engine.getCurrentTime() / d) * this._timelineWidth;
    this._playhead?.setPosition(px);
  }

  private get _timelineWidth(): number {
    return this.shadowRoot?.querySelector<HTMLElement>('.waveform-area')?.clientWidth ?? 0;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-player': DawPlayerElement;
  }
}
