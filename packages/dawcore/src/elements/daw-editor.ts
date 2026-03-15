import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ClipTrack } from '@waveform-playlist/core';
import { createClipFromSeconds, createTrack, clipPixelWidth } from '@waveform-playlist/core';
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
  @state() private _duration = 0;
  @state() private _sampleRate = 48000;

  // Not @state — updated only in RAF loop, read only in _stopPlayhead
  private _currentTime = 0;

  // Engine is dynamically imported; typed as any to avoid a static import
  // that would defeat code-splitting
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _engine: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _enginePromise: Promise<any> | null = null;
  private _audioInitialized = false;
  private _audioCache = new Map<string, Promise<AudioBuffer>>();
  private _trackElements = new Map<string, DawTrackElement>();
  private _childObserver: MutationObserver | null = null;

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
   * Derived pixel width — computed from duration, sampleRate, and samplesPerPixel.
   * Not stored as @state() to avoid update loops.
   */
  private get _totalWidth(): number {
    return Math.ceil((this._duration * this._sampleRate) / this.samplesPerPixel);
  }

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
    this.addEventListener('daw-track-update', this._onTrackUpdate as EventListener);

    // Detect track removal via MutationObserver since disconnectedCallback
    // events from detached elements cannot bubble to ancestors.
    // subtree: true catches tracks wrapped in container elements.
    this._childObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement) {
            // Direct daw-track removal
            if (node.tagName === 'DAW-TRACK') {
              this._onTrackRemoved((node as DawTrackElement).trackId);
            }
            // Nested daw-track removal (wrapper removed)
            const nested = node.querySelectorAll?.('daw-track');
            if (nested) {
              for (const track of nested) {
                this._onTrackRemoved((track as DawTrackElement).trackId);
              }
            }
          }
        }
      }
    });
    this._childObserver.observe(this, { childList: true, subtree: true });

    // Engine built lazily on first _loadTrack to use the correct sampleRate
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('daw-track-connected', this._onTrackConnected as EventListener);
    this.removeEventListener('daw-track-update', this._onTrackUpdate as EventListener);
    this._childObserver?.disconnect();
    this._childObserver = null;
    this._trackElements.clear();
    this._audioCache.clear();

    try {
      this._disposeEngine();
    } catch (err) {
      console.warn('[dawcore] Error disposing engine:', err);
    }
  }

  // --- Event Handlers ---

  private _onTrackConnected = (e: CustomEvent) => {
    const trackId = e.detail?.trackId;
    const trackEl = e.detail?.element;
    if (!trackId || !(trackEl instanceof HTMLElement)) {
      console.warn('[dawcore] Invalid daw-track-connected event detail:', e.detail);
      return;
    }

    const descriptor = this._readTrackDescriptor(trackEl as DawTrackElement);
    this._tracks = new Map(this._tracks).set(trackId, descriptor);
    this._trackElements.set(trackId, trackEl as DawTrackElement);

    // Load audio for this track
    this._loadTrack(trackId, descriptor);
  };

  private _onTrackRemoved(trackId: string) {
    this._trackElements.delete(trackId);

    const nextTracks = new Map(this._tracks);
    nextTracks.delete(trackId);
    this._tracks = nextTracks;

    const nextEngine = new Map(this._engineTracks);
    nextEngine.delete(trackId);
    this._engineTracks = nextEngine;

    this._recomputeDuration();

    // Update the engine so the removed track stops playing
    if (this._engine) {
      this._engine.setTracks([...nextEngine.values()]);
    }
  }

  private _onTrackUpdate = (e: CustomEvent) => {
    const trackId = e.detail?.trackId as string;
    if (!trackId) return;
    const trackEl = (e.target as HTMLElement).closest('daw-track') as DawTrackElement | null;
    if (!trackEl) return;

    const oldDescriptor = this._tracks.get(trackId);
    const descriptor = this._readTrackDescriptor(trackEl);
    this._tracks = new Map(this._tracks).set(trackId, descriptor);

    // Forward mix changes to engine
    if (this._engine) {
      if (oldDescriptor?.volume !== descriptor.volume) {
        this._engine.setTrackVolume(trackId, descriptor.volume);
      }
      if (oldDescriptor?.pan !== descriptor.pan) {
        this._engine.setTrackPan(trackId, descriptor.pan);
      }
      if (oldDescriptor?.muted !== descriptor.muted) {
        this._engine.setTrackMute(trackId, descriptor.muted);
      }
      if (oldDescriptor?.soloed !== descriptor.soloed) {
        this._engine.setTrackSolo(trackId, descriptor.soloed);
      }
    }

    // Reload audio if src changed
    if (oldDescriptor?.src !== descriptor.src) {
      this._loadTrack(trackId, descriptor);
    }
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
    try {
      const clips = [];

      for (const clipDesc of descriptor.clips) {
        if (!clipDesc.src) continue;

        const audioBuffer = await this._fetchAndDecode(clipDesc.src);

        // Set sampleRate from first decoded buffer — engine uses this
        if (this._sampleRate === 48000 && audioBuffer.sampleRate !== 48000) {
          this._sampleRate = audioBuffer.sampleRate;
        }

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

      // Feed all tracks to engine — setTracks builds the playout,
      // addTrack requires playout to already exist
      const engine = await this._ensureEngine();
      engine.setTracks([...this._engineTracks.values()]);

      this.dispatchEvent(
        new CustomEvent('daw-track-ready', {
          bubbles: true,
          composed: true,
          detail: { trackId },
        })
      );
    } catch (err) {
      console.warn(`[dawcore] Failed to load track "${trackId}" (${descriptor.name}):`, err);
      this.dispatchEvent(
        new CustomEvent('daw-track-error', {
          bubbles: true,
          composed: true,
          detail: { trackId, error: err },
        })
      );
    }
  }

  private async _fetchAndDecode(src: string): Promise<AudioBuffer> {
    if (this._audioCache.has(src)) {
      return this._audioCache.get(src)!;
    }

    const promise = (async () => {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch audio "${src}": ${response.status} ${response.statusText}`
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      // OfflineAudioContext doesn't require user gesture (unlike AudioContext).
      // The sampleRate parameter doesn't affect decodeAudioData output —
      // the decoded buffer retains its native sample rate.
      const ctx = new OfflineAudioContext(1, 1, 44100);
      return ctx.decodeAudioData(arrayBuffer);
    })();

    this._audioCache.set(src, promise);

    try {
      return await promise;
    } catch (err) {
      this._audioCache.delete(src); // Allow retry on failure
      throw err;
    }
  }

  private _generatePeaks(clipId: string, audioBuffer: AudioBuffer) {
    const numChannels = this.mono ? 1 : audioBuffer.numberOfChannels;
    const samplesPerPeak = this.samplesPerPixel;
    const peakCount = Math.ceil(audioBuffer.getChannelData(0).length / samplesPerPeak);
    const peaks = new Int16Array(peakCount * 2);

    for (let i = 0; i < peakCount; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, audioBuffer.getChannelData(0).length);
      let min = 0;
      let max = 0;

      // Aggregate across all channels (min-of-mins, max-of-maxes);
      // channel 0 only when mono=true
      for (let ch = 0; ch < numChannels; ch++) {
        const channelData = audioBuffer.getChannelData(ch);
        for (let j = start; j < end; j++) {
          const sample = channelData[j];
          if (sample < min) min = sample;
          if (sample > max) max = sample;
        }
      }

      peaks[i * 2] = Math.round(min * 32767);
      peaks[i * 2 + 1] = Math.round(max * 32767);
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
  }

  // --- Engine Management ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _ensureEngine(): Promise<any> {
    if (this._engine) return Promise.resolve(this._engine);
    if (this._enginePromise) return this._enginePromise;

    this._enginePromise = this._buildEngine().catch((err) => {
      this._enginePromise = null; // Allow retry on failure
      throw err;
    });
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
      // Include samplesPerPixel in zoom levels so arbitrary values don't throw
      zoomLevels: [256, 512, 1024, 2048, 4096, 8192, this.samplesPerPixel]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a - b),
    });

    // statechange fires on play/pause/stop/seek — not every frame
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    engine.on('statechange', (engineState: any) => {
      this._isPlaying = engineState.isPlaying;
      this._duration = engineState.duration;
    });

    // timeupdate fires every RAF frame — only update the non-reactive field
    engine.on('timeupdate', (time: number) => {
      this._currentTime = time;
    });

    engine.on('stop', () => {
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
    this._enginePromise = null;
  }

  // --- Playback Methods ---

  async play() {
    try {
      const engine = await this._ensureEngine();

      // First play: resume AudioContext (requires user gesture)
      if (!this._audioInitialized) {
        await engine.init();
        this._audioInitialized = true;
      }

      engine.play();
      this._startPlayhead();

      this.dispatchEvent(new CustomEvent('daw-play', { bubbles: true, composed: true }));
    } catch (err) {
      console.warn('[dawcore] Playback failed:', err);
      this.dispatchEvent(
        new CustomEvent('daw-error', {
          bubbles: true,
          composed: true,
          detail: { operation: 'play', error: err },
        })
      );
    }
  }

  pause() {
    if (!this._engine) return;
    this._engine.pause();
    this._stopPlayhead();

    this.dispatchEvent(new CustomEvent('daw-pause', { bubbles: true, composed: true }));
  }

  stop() {
    if (!this._engine) return;
    this._engine.stop();
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
    const engine = this._engine;
    playhead.startAnimation(
      () => {
        if (!engine) return 0;
        return engine.getCurrentTime();
      },
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
                const width = clipPixelWidth(
                  clip.startSample,
                  clip.durationSamples,
                  this.samplesPerPixel
                );
                const clipLeft = Math.floor(clip.startSample / this.samplesPerPixel);
                return html`
                  <daw-waveform
                    style="position: absolute; left: ${clipLeft}px;"
                    .peaks=${peakData?.peaks ?? new Int16Array(0)}
                    .bits=${16}
                    .length=${peakData?.length ?? width}
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
