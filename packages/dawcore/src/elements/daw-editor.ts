import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { ClipTrack } from '@waveform-playlist/core';
import { createClipFromSeconds, createTrack } from '@waveform-playlist/core';
import type { DawTrackElement } from './daw-track';
import type { DawClipElement } from './daw-clip';
import type { DawPlayheadElement } from './daw-playhead';
import { hostStyles } from '../styles/theme';

interface TrackDescriptor {
  name: string;
  src: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  clips: ClipDescriptor[];
}

interface ClipDescriptor {
  src: string;
  start: number;
  duration: number;
  offset: number;
  gain: number;
  name: string;
  fadeIn: number;
  fadeOut: number;
  fadeType: string;
}

@customElement('daw-editor')
export class DawEditorElement extends LitElement {
  @property({ type: Number, attribute: 'samples-per-pixel' }) samplesPerPixel = 1024;
  @property({ type: Number, attribute: 'wave-height' }) waveHeight = 128;
  @property({ type: Boolean }) timescale = false;
  @property({ type: Boolean }) mono = false;
  @property({ type: Number, attribute: 'bar-width' }) barWidth = 1;
  @property({ type: Number, attribute: 'bar-gap' }) barGap = 0;

  @state() private _tracks: TrackDescriptor[] = [];
  @state() private _engineTracks: ClipTrack[] = [];
  @state() private _peaksData: Map<string, { peaks: Int16Array; bits: 16; length: number }> =
    new Map();
  @state() _isPlaying = false;
  @state() private _currentTime = 0;
  @state() private _duration = 0;
  @state() private _sampleRate = 48000;
  @state() private _totalWidth = 0;

  // Lazy engine/adapter — only created on first play()
  private _engine: any = null;
  private _audioInitialized = false;
  private _audioCache = new Map<string, Promise<AudioBuffer>>();
  private _observer: MutationObserver | null = null;
  private _abortController: AbortController | null = null;

  static styles = [
    hostStyles,
    css`
      :host {
        display: block;
        position: relative;
        background: var(--daw-background, #1a1a2e);
        overflow-x: auto;
        overflow-y: hidden;
      }
      .timeline {
        position: relative;
        min-height: 50px;
      }
      .track-row {
        position: relative;
        background: var(--daw-track-background, #16213e);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
    `,
  ];

  /**
   * Public accessor for discovered tracks (used in tests and by transport).
   */
  get tracks(): TrackDescriptor[] {
    return this._tracks;
  }

  // --- Lifecycle ---

  connectedCallback() {
    super.connectedCallback();
    this._observer = new MutationObserver(() => this._discoverTracks());
    this._observer.observe(this, { childList: true, subtree: true });
    this.addEventListener('daw-track-update', () => this._discoverTracks());
    this._discoverTracks();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._observer?.disconnect();
    this._observer = null;
    this._abortController?.abort();
    this._abortController = null;
    this._disposeEngine();
  }

  updated(changed: PropertyValues) {
    if (changed.has('_totalWidth') || changed.has('_duration')) {
      this._totalWidth = this._computeTotalWidth();
    }
  }

  // --- Child Discovery ---

  private _discoverTracks() {
    const trackEls = this.querySelectorAll('daw-track') as NodeListOf<DawTrackElement>;
    const descriptors: TrackDescriptor[] = [];

    for (const trackEl of trackEls) {
      const clipEls = trackEl.querySelectorAll('daw-clip') as NodeListOf<DawClipElement>;
      const clips: ClipDescriptor[] = [];

      // If track has a src attribute but no clip children, treat it as shorthand
      if (clipEls.length === 0 && trackEl.src) {
        clips.push({
          src: trackEl.src,
          start: 0,
          duration: 0,
          offset: 0,
          gain: 1,
          name: trackEl.name || '',
          fadeIn: 0,
          fadeOut: 0,
          fadeType: 'linear',
        });
      } else {
        for (const clipEl of clipEls) {
          clips.push({
            src: clipEl.src,
            start: clipEl.start,
            duration: clipEl.duration,
            offset: clipEl.offset,
            gain: clipEl.gain,
            name: clipEl.name,
            fadeIn: clipEl.fadeIn,
            fadeOut: clipEl.fadeOut,
            fadeType: clipEl.fadeType,
          });
        }
      }

      descriptors.push({
        name: trackEl.name || `Track ${descriptors.length + 1}`,
        src: trackEl.src,
        volume: trackEl.volume,
        pan: trackEl.pan,
        muted: trackEl.muted,
        soloed: trackEl.soloed,
        clips,
      });
    }

    this._tracks = descriptors;
  }

  // --- Audio Loading ---

  private async _loadAllAudio(): Promise<ClipTrack[]> {
    this._abortController?.abort();
    this._abortController = new AbortController();
    const { signal } = this._abortController;

    const clipTracks: ClipTrack[] = [];

    for (const trackDesc of this._tracks) {
      const clips = [];

      for (const clipDesc of trackDesc.clips) {
        if (!clipDesc.src) continue;

        const audioBuffer = await this._fetchAndDecode(clipDesc.src, signal);
        if (signal.aborted) return [];

        this._sampleRate = audioBuffer.sampleRate;

        const clip = createClipFromSeconds({
          audioBuffer,
          startTime: clipDesc.start,
          duration: clipDesc.duration || audioBuffer.duration,
          offset: clipDesc.offset,
          gain: clipDesc.gain,
          name: clipDesc.name,
          sampleRate: audioBuffer.sampleRate,
          sourceDuration: audioBuffer.duration,
        });

        // Generate peaks for waveform rendering
        this._generatePeaks(clip.id, audioBuffer);

        clips.push(clip);
      }

      const track = createTrack({
        name: trackDesc.name,
        clips,
        volume: trackDesc.volume,
        pan: trackDesc.pan,
        muted: trackDesc.muted,
        soloed: trackDesc.soloed,
      });

      clipTracks.push(track);
    }

    this._engineTracks = clipTracks;
    this._duration = this._computeDuration(clipTracks);
    this._totalWidth = this._computeTotalWidth();
    return clipTracks;
  }

  private async _fetchAndDecode(src: string, signal: AbortSignal): Promise<AudioBuffer> {
    if (this._audioCache.has(src)) {
      return this._audioCache.get(src)!;
    }

    const promise = (async () => {
      const response = await fetch(src, { signal });
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = this._getAudioContext();
      return audioContext.decodeAudioData(arrayBuffer);
    })();

    this._audioCache.set(src, promise);
    return promise;
  }

  private _generatePeaks(clipId: string, audioBuffer: AudioBuffer) {
    // Inline peak generation from AudioBuffer channel data
    const channelData = audioBuffer.getChannelData(0);
    const samplesPerPeak = this.samplesPerPixel;
    const peakCount = Math.ceil(channelData.length / samplesPerPeak);
    const peaks = new Int16Array(peakCount * 2);

    for (let i = 0; i < peakCount; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, channelData.length);
      let min = 0;
      let max = 0;

      for (let j = start; j < end; j++) {
        const sample = channelData[j];
        if (sample < min) min = sample;
        if (sample > max) max = sample;
      }

      // Scale to 16-bit range
      peaks[i * 2] = Math.round(min * 32768);
      peaks[i * 2 + 1] = Math.round(max * 32768);
    }

    this._peaksData = new Map(this._peaksData).set(clipId, {
      peaks,
      bits: 16,
      length: peakCount,
    });
  }

  private _computeDuration(tracks: ClipTrack[]): number {
    let maxSample = 0;
    for (const track of tracks) {
      for (const clip of track.clips) {
        const endSample = clip.startSample + clip.durationSamples;
        if (endSample > maxSample) maxSample = endSample;
      }
    }
    return maxSample / this._sampleRate;
  }

  private _computeTotalWidth(): number {
    return Math.ceil((this._duration * this._sampleRate) / this.samplesPerPixel);
  }

  // --- Engine Management ---

  private async _ensureEngine(): Promise<any> {
    if (this._engine) return this._engine;

    const [{ PlaylistEngine }, { createToneAdapter }] = await Promise.all([
      import('@waveform-playlist/engine'),
      import('@waveform-playlist/playout'),
    ]);

    const adapter = createToneAdapter();
    const engine = new PlaylistEngine({
      adapter,
      sampleRate: this._sampleRate,
      samplesPerPixel: this.samplesPerPixel,
    });

    engine.on('statechange', (engineState: any) => {
      this._isPlaying = engineState.isPlaying;
      this._currentTime = engineState.currentTime;
      this._duration = engineState.duration;
    });

    engine.on('timeupdate', (time: number) => {
      this._currentTime = time;
    });

    engine.on('stop', () => {
      this._isPlaying = false;
      this._stopPlayhead();
    });

    this._engine = engine;
    return engine;
  }

  private _disposeEngine() {
    if (this._engine) {
      this._engine.dispose();
      this._engine = null;
    }
    this._audioInitialized = false;
  }

  private _getAudioContext(): AudioContext {
    // Use globalThis.AudioContext for flexibility
    return new AudioContext();
  }

  // --- Playback Methods ---

  async play() {
    const engine = await this._ensureEngine();

    if (!this._audioInitialized) {
      await engine.init();
      const tracks = await this._loadAllAudio();
      if (tracks.length > 0) {
        engine.setTracks(tracks);
      }
      this._audioInitialized = true;
    }

    engine.play();
    this._isPlaying = true;
    this._startPlayhead();

    this.dispatchEvent(
      new CustomEvent('daw-play', { bubbles: true, composed: true })
    );
  }

  pause() {
    if (!this._engine) return;
    this._engine.pause();
    this._isPlaying = false;
    this._stopPlayhead();

    this.dispatchEvent(
      new CustomEvent('daw-pause', { bubbles: true, composed: true })
    );
  }

  stop() {
    if (!this._engine) return;
    this._engine.stop();
    this._isPlaying = false;
    this._currentTime = 0;
    this._stopPlayhead();

    this.dispatchEvent(
      new CustomEvent('daw-stop', { bubbles: true, composed: true })
    );
  }

  seekTo(time: number) {
    if (!this._engine) return;
    this._engine.seek(time);
    this._currentTime = time;
  }

  // --- Playhead ---

  private _getPlayhead(): DawPlayheadElement | null {
    return this.shadowRoot?.querySelector('daw-playhead') as DawPlayheadElement | null;
  }

  private _startPlayhead() {
    const playhead = this._getPlayhead();
    if (!playhead || !this._engine) return;
    playhead.startAnimation(
      () => this._engine.getCurrentTime(),
      this._sampleRate,
      this.samplesPerPixel
    );
  }

  private _stopPlayhead() {
    const playhead = this._getPlayhead();
    if (!playhead) return;
    playhead.stopAnimation(this._currentTime, this._sampleRate, this.samplesPerPixel);
  }

  // --- Render ---

  render() {
    return html`
      <div class="timeline" style="width: ${Math.max(this._totalWidth, 100)}px;" data-playing=${this._isPlaying}>
        <daw-playhead></daw-playhead>
        ${this._engineTracks.map(
          (track) => html`
            <div class="track-row" style="height: ${this.waveHeight}px;">
              ${track.clips.map((clip) => {
                const peakData = this._peaksData.get(clip.id);
                const clipWidth = Math.ceil(clip.durationSamples / this.samplesPerPixel);
                const clipLeft = Math.floor(clip.startSample / this.samplesPerPixel);
                return html`
                  <daw-waveform
                    style="position: absolute; left: ${clipLeft}px;"
                    .peaks=${peakData?.peaks ?? new Int16Array(0)}
                    .bits=${16}
                    .length=${peakData?.length ?? clipWidth}
                    .waveHeight=${this.waveHeight}
                    .barWidth=${this.barWidth}
                    .barGap=${this.barGap}
                  ></daw-waveform>
                `;
              })}
            </div>
          `
        )}
      </div>
      <slot></slot>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-editor': DawEditorElement;
  }
}
