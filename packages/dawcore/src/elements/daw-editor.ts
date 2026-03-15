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

  @state() private _tracks: Map<string, TrackDescriptor> = new Map();
  @state() private _engineTracks: Map<string, ClipTrack> = new Map();
  @state() private _peaksData: Map<string, { peaks: Int16Array; bits: 16; length: number }> =
    new Map();
  @state() _isPlaying = false;
  @state() private _currentTime = 0;
  @state() private _duration = 0;
  @state() private _sampleRate = 48000;
  @state() private _totalWidth = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _engine: any = null;
  private _enginePromise: Promise<any> | null = null;
  private _audioInitialized = false;
  private _decodeContext: AudioContext | null = null;
  private _audioCache = new Map<string, Promise<AudioBuffer>>();

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
    return [...this._tracks.values()];
  }

  // --- Lifecycle ---

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('daw-track-connected', this._onTrackConnected as EventListener);
    this.addEventListener('daw-track-disconnected', this._onTrackDisconnected as EventListener);
    this.addEventListener('daw-track-update', this._onTrackUpdate as EventListener);

    // Build engine eagerly so it's ready before play
    this._ensureEngine();
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('daw-track-connected', this._onTrackConnected as EventListener);
    this.removeEventListener('daw-track-disconnected', this._onTrackDisconnected as EventListener);
    this.removeEventListener('daw-track-update', this._onTrackUpdate as EventListener);
    this._decodeContext?.close();
    this._decodeContext = null;
    this._disposeEngine();
  }

  updated(changed: PropertyValues) {
    if (changed.has('_totalWidth') || changed.has('_duration')) {
      this._totalWidth = this._computeTotalWidth();
    }
  }

  // --- Event Handlers ---

  private _onTrackConnected = (e: CustomEvent) => {
    const trackEl = e.detail.element as DawTrackElement;
    const trackId = e.detail.trackId as string;
    const descriptor = this._readTrackDescriptor(trackEl);

    this._tracks = new Map(this._tracks).set(trackId, descriptor);

    // Load audio for this track
    this._loadTrack(trackId, descriptor);
  };

  private _onTrackDisconnected = (e: CustomEvent) => {
    const trackId = e.detail.trackId as string;
    const nextTracks = new Map(this._tracks);
    nextTracks.delete(trackId);
    this._tracks = nextTracks;

    const nextEngine = new Map(this._engineTracks);
    nextEngine.delete(trackId);
    this._engineTracks = nextEngine;

    this._recomputeDuration();
  };

  private _onTrackUpdate = (e: CustomEvent) => {
    const trackId = e.detail.trackId as string;
    const trackEl = (e.target as HTMLElement).closest('daw-track') as DawTrackElement | null;
    if (!trackEl) return;

    const descriptor = this._readTrackDescriptor(trackEl);
    this._tracks = new Map(this._tracks).set(trackId, descriptor);
  };

  // --- Track Reading ---

  private _readTrackDescriptor(trackEl: DawTrackElement): TrackDescriptor {
    const clipEls = trackEl.querySelectorAll('daw-clip') as NodeListOf<DawClipElement>;
    const clips: ClipDescriptor[] = [];

    // Shorthand: <daw-track src="..."> with no clip children
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

    return {
      name: trackEl.name || 'Untitled',
      src: trackEl.src,
      volume: trackEl.volume,
      pan: trackEl.pan,
      muted: trackEl.muted,
      soloed: trackEl.soloed,
      clips,
    };
  }

  // --- Audio Loading (per-track) ---

  private async _loadTrack(trackId: string, descriptor: TrackDescriptor) {
    const clips = [];

    for (const clipDesc of descriptor.clips) {
      if (!clipDesc.src) continue;

      const audioBuffer = await this._fetchAndDecode(clipDesc.src);
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

      this._generatePeaks(clip.id, audioBuffer);
      clips.push(clip);
    }

    const track = createTrack({
      name: descriptor.name,
      clips,
      volume: descriptor.volume,
      pan: descriptor.pan,
      muted: descriptor.muted,
      soloed: descriptor.soloed,
    });

    this._engineTracks = new Map(this._engineTracks).set(trackId, track);
    this._recomputeDuration();

    // Add to engine incrementally if it's been initialized (post user gesture)
    if (this._engine && this._audioInitialized) {
      const addTrack = this._engine.addTrack;
      if (typeof addTrack === 'function') {
        this._engine.addTrack(track);
      } else {
        this._engine.setTracks([...this._engineTracks.values()]);
      }
    }

    this.dispatchEvent(
      new CustomEvent('daw-track-ready', {
        bubbles: true,
        composed: true,
        detail: { trackId },
      })
    );
  }

  private _getDecodeContext(): AudioContext {
    if (!this._decodeContext) {
      this._decodeContext = new AudioContext();
    }
    return this._decodeContext;
  }

  private async _fetchAndDecode(src: string): Promise<AudioBuffer> {
    if (this._audioCache.has(src)) {
      return this._audioCache.get(src)!;
    }

    const promise = (async () => {
      const response = await fetch(src);
      const arrayBuffer = await response.arrayBuffer();
      const audioContext = this._getDecodeContext();
      return audioContext.decodeAudioData(arrayBuffer);
    })();

    this._audioCache.set(src, promise);
    return promise;
  }

  private _generatePeaks(clipId: string, audioBuffer: AudioBuffer) {
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

      peaks[i * 2] = Math.round(min * 32768);
      peaks[i * 2 + 1] = Math.round(max * 32768);
    }

    this._peaksData = new Map(this._peaksData).set(clipId, {
      peaks,
      bits: 16,
      length: peakCount,
    });
  }

  private _recomputeDuration() {
    let maxSample = 0;
    for (const track of this._engineTracks.values()) {
      for (const clip of track.clips) {
        const endSample = clip.startSample + clip.durationSamples;
        if (endSample > maxSample) maxSample = endSample;
      }
    }
    this._duration = maxSample / this._sampleRate;
    this._totalWidth = this._computeTotalWidth();
  }

  private _computeTotalWidth(): number {
    return Math.ceil((this._duration * this._sampleRate) / this.samplesPerPixel);
  }

  // --- Engine Management ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _ensureEngine(): Promise<any> {
    if (this._engine) return Promise.resolve(this._engine);
    if (this._enginePromise) return this._enginePromise;

    this._enginePromise = this._buildEngine();
    return this._enginePromise;
  }

  private async _buildEngine() {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  }

  // --- Playback Methods ---

  async play() {
    const engine = await this._ensureEngine();

    // First play: resume AudioContext (requires user gesture)
    if (!this._audioInitialized) {
      await engine.init();
      this._audioInitialized = true;
    }

    engine.play();
    this._isPlaying = true;
    this._startPlayhead();

    this.dispatchEvent(new CustomEvent('daw-play', { bubbles: true, composed: true }));
  }

  pause() {
    if (!this._engine) return;
    this._engine.pause();
    this._isPlaying = false;
    this._stopPlayhead();

    this.dispatchEvent(new CustomEvent('daw-pause', { bubbles: true, composed: true }));
  }

  stop() {
    if (!this._engine) return;
    this._engine.stop();
    this._isPlaying = false;
    this._currentTime = 0;
    this._stopPlayhead();

    this.dispatchEvent(new CustomEvent('daw-stop', { bubbles: true, composed: true }));
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
    const engineTracks = [...this._engineTracks.values()];

    return html`
      <div
        class="timeline"
        style="width: ${Math.max(this._totalWidth, 100)}px;"
        data-playing=${this._isPlaying}
      >
        ${this.timescale
          ? html`<daw-ruler
              .samplesPerPixel=${this.samplesPerPixel}
              .sampleRate=${this._sampleRate}
              .duration=${this._duration}
            ></daw-ruler>`
          : ''}
        <daw-playhead></daw-playhead>
        ${engineTracks.map(
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
