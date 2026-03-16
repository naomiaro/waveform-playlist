import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ClipTrack } from '@waveform-playlist/core';
import { createClipFromSeconds, createTrack, clipPixelWidth } from '@waveform-playlist/core';
import type { DawTrackElement } from './daw-track';
import type { DawClipElement } from './daw-clip';
import type { DawPlayheadElement } from './daw-playhead';
import { hostStyles } from '../styles/theme';
import { PointerHandler } from '../interactions/pointer-handler';

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
  @property({ type: Boolean, attribute: 'file-drop' }) fileDrop = false;
  @property({ type: Number, attribute: 'sample-rate' }) sampleRate = 48000;

  @state() private _tracks: Map<string, TrackDescriptor> = new Map();
  @state() private _engineTracks: Map<string, ClipTrack> = new Map();
  @state() private _peaksData: Map<string, { peaks: Int16Array; bits: 16; length: number }> =
    new Map();
  @state() _isPlaying = false;
  @state() private _duration = 0;
  @state() _selectedTrackId: string | null = null;
  @state() _dragOver = false;

  // Not @state — selection updated directly on <daw-selection> element
  // during drag to avoid 60fps Lit re-renders (same pattern as _currentTime)
  _selectionStartTime = 0;
  _selectionEndTime = 0;
  _currentTime = 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  _engine: any = null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _enginePromise: Promise<any> | null = null;
  private _audioInitialized = false;
  private _audioCache = new Map<string, Promise<AudioBuffer>>();
  private _trackElements = new Map<string, DawTrackElement>();
  private _childObserver: MutationObserver | null = null;
  private _pointer = new PointerHandler(this);

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
        cursor: text;
      }
      .track-row {
        position: relative;
        background: var(--daw-track-background, #16213e);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .track-row.selected {
        background: rgba(99, 199, 95, 0.08);
        box-shadow: inset 2px 0 0 var(--daw-progress-color, #63c75f);
      }
      .timeline.drag-over {
        outline: 2px dashed var(--daw-selection-color, rgba(99, 199, 95, 0.3));
        outline-offset: -2px;
      }
    `,
  ];

  /** Derived pixel width from duration. */
  private get _totalWidth(): number {
    return Math.ceil((this._duration * this.sampleRate) / this.samplesPerPixel);
  }

  get tracks(): TrackDescriptor[] {
    return [...this._tracks.values()];
  }

  get selectedTrackId(): string | null {
    return this._selectedTrackId;
  }

  get selection(): { start: number; end: number } | null {
    if (this._selectionStartTime === 0 && this._selectionEndTime === 0) return null;
    return { start: this._selectionStartTime, end: this._selectionEndTime };
  }

  setSelection(start: number, end: number) {
    this._selectionStartTime = Math.min(start, end);
    this._selectionEndTime = Math.max(start, end);
    if (this._engine) {
      this._engine.setSelection(this._selectionStartTime, this._selectionEndTime);
    }
    this.requestUpdate();
    this.dispatchEvent(
      new CustomEvent('daw-selection', {
        bubbles: true,
        composed: true,
        detail: { start: this._selectionStartTime, end: this._selectionEndTime },
      })
    );
  }

  // --- Lifecycle ---

  connectedCallback() {
    super.connectedCallback();
    this.addEventListener('daw-track-connected', this._onTrackConnected as EventListener);
    this.addEventListener('daw-track-update', this._onTrackUpdate as EventListener);

    // Detect track removal via MutationObserver (detached elements can't bubble events).
    this._childObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement) {
            if (node.tagName === 'DAW-TRACK') {
              this._onTrackRemoved((node as DawTrackElement).trackId);
            }
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

  // --- Track Events ---

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

    if (this._engine) {
      if (oldDescriptor?.volume !== descriptor.volume)
        this._engine.setTrackVolume(trackId, descriptor.volume);
      if (oldDescriptor?.pan !== descriptor.pan) this._engine.setTrackPan(trackId, descriptor.pan);
      if (oldDescriptor?.muted !== descriptor.muted)
        this._engine.setTrackMute(trackId, descriptor.muted);
      if (oldDescriptor?.soloed !== descriptor.soloed)
        this._engine.setTrackSolo(trackId, descriptor.soloed);
    }

    if (oldDescriptor?.src !== descriptor.src) {
      this._loadTrack(trackId, descriptor);
    }
  };

  private _readTrackDescriptor(trackEl: DawTrackElement): TrackDescriptor {
    const clipEls = trackEl.querySelectorAll('daw-clip') as NodeListOf<DawClipElement>;
    const clips: ClipDescriptor[] = [];

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

  // --- Audio Loading ---

  private async _loadTrack(trackId: string, descriptor: TrackDescriptor) {
    try {
      const clips = [];
      for (const clipDesc of descriptor.clips) {
        if (!clipDesc.src) continue;
        const audioBuffer = await this._fetchAndDecode(clipDesc.src);

        // Use the buffer's actual sample rate — the global AudioContext
        // decodes at the hardware rate, which may differ from this.sampleRate
        this.sampleRate = audioBuffer.sampleRate;

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
      console.warn('[dawcore] Failed to load track "' + trackId + '":', err);
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
          'Failed to fetch audio "' + src + '": ' + response.status + ' ' + response.statusText
        );
      }
      const arrayBuffer = await response.arrayBuffer();
      // Use the global AudioContext shared with Tone.js.
      // decodeAudioData works even while the context is suspended (pre-gesture).
      const { getGlobalAudioContext } = await import('@waveform-playlist/playout');
      return getGlobalAudioContext().decodeAudioData(arrayBuffer);
    })();

    this._audioCache.set(src, promise);
    try {
      return await promise;
    } catch (err) {
      this._audioCache.delete(src);
      throw err;
    }
  }

  private _generatePeaks(clipId: string, audioBuffer: AudioBuffer) {
    const numChannels = this.mono ? 1 : audioBuffer.numberOfChannels;
    const samplesPerPeak = this.samplesPerPixel;
    const totalSamples = audioBuffer.getChannelData(0).length;
    const peakCount = Math.ceil(totalSamples / samplesPerPeak);
    const peaks = new Int16Array(peakCount * 2);

    for (let i = 0; i < peakCount; i++) {
      const start = i * samplesPerPeak;
      const end = Math.min(start + samplesPerPeak, totalSamples);
      let min = 0;
      let max = 0;

      // Aggregate across channels; channel 0 only when mono=true
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
    this._duration = maxSample / this.sampleRate;
  }

  // --- Engine ---

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _ensureEngine(): Promise<any> {
    if (this._engine) return Promise.resolve(this._engine);
    if (this._enginePromise) return this._enginePromise;
    this._enginePromise = this._buildEngine().catch((err) => {
      this._enginePromise = null;
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
      sampleRate: this.sampleRate,
      samplesPerPixel: this.samplesPerPixel,
      zoomLevels: [256, 512, 1024, 2048, 4096, 8192, this.samplesPerPixel]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a - b),
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    engine.on('statechange', (engineState: any) => {
      this._isPlaying = engineState.isPlaying;
      this._duration = engineState.duration;
      this._selectedTrackId = engineState.selectedTrackId;
    });

    engine.on('timeupdate', (time: number) => {
      this._currentTime = time;
    });

    engine.on('stop', () => {
      this._currentTime = engine.getCurrentTime();
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

  // --- File Drop ---

  private _onDragOver = (e: DragEvent) => {
    if (!this.fileDrop) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    this._dragOver = true;
  };

  private _onDragLeave = (e: DragEvent) => {
    if (!this.fileDrop) return;
    // relatedTarget is null when cursor leaves the browser window — that's fine,
    // we still want to clear _dragOver in that case.
    const timeline = this.shadowRoot?.querySelector('.timeline');
    if (timeline && !timeline.contains(e.relatedTarget as Node)) {
      this._dragOver = false;
    }
  };

  private _onDrop = async (e: DragEvent) => {
    if (!this.fileDrop) return;
    e.preventDefault();
    this._dragOver = false;

    const files = e.dataTransfer?.files;
    if (!files || files.length === 0) return;

    try {
      await this.loadFiles(files);
    } catch (err) {
      console.warn('[dawcore] File drop failed: ' + String(err));
    }
  };

  async loadFiles(
    files: FileList | File[]
  ): Promise<{ loaded: string[]; failed: Array<{ file: File; error: unknown }> }> {
    if (!files) {
      console.warn('[dawcore] loadFiles called with null/undefined');
      return { loaded: [], failed: [] };
    }

    const fileArray = Array.from(files);
    const loaded: string[] = [];
    const failed: Array<{ file: File; error: unknown }> = [];

    for (const file of fileArray) {
      // Accept files with empty type (browser may not report MIME for .opus etc.)
      if (file.type && !file.type.startsWith('audio/')) {
        const skipped = new Error('Non-audio MIME type: ' + file.type);
        failed.push({ file, error: skipped });
        console.warn('[dawcore] Skipping non-audio file: ' + file.name + ' (' + file.type + ')');
        continue;
      }

      try {
        const audioBuffer = await this._fetchAndDecode(URL.createObjectURL(file));

        this.sampleRate = audioBuffer.sampleRate;

        const name = file.name.replace(/\.\w+$/, '');
        const clip = createClipFromSeconds({
          audioBuffer,
          startTime: 0,
          duration: audioBuffer.duration,
          offset: 0,
          gain: 1,
          name,
          sampleRate: audioBuffer.sampleRate,
          sourceDuration: audioBuffer.duration,
        });

        this._generatePeaks(clip.id, audioBuffer);

        const trackId = crypto.randomUUID();
        const track = createTrack({ name, clips: [clip] });

        // Add to both maps so editor.tracks includes dropped files
        this._tracks = new Map(this._tracks).set(trackId, {
          name,
          src: '',
          volume: 1,
          pan: 0,
          muted: false,
          soloed: false,
          clips: [
            {
              src: '',
              start: 0,
              duration: audioBuffer.duration,
              offset: 0,
              gain: 1,
              name,
              fadeIn: 0,
              fadeOut: 0,
              fadeType: 'linear',
            },
          ],
        });
        this._engineTracks = new Map(this._engineTracks).set(trackId, track);
        this._recomputeDuration();

        const engine = await this._ensureEngine();
        engine.setTracks([...this._engineTracks.values()]);

        loaded.push(trackId);
        this.dispatchEvent(
          new CustomEvent('daw-track-ready', {
            bubbles: true,
            composed: true,
            detail: { trackId },
          })
        );
      } catch (err) {
        console.warn('[dawcore] Failed to load file: ' + file.name + ' — ' + String(err));
        failed.push({ file, error: err });
        this.dispatchEvent(
          new CustomEvent('daw-files-load-error', {
            bubbles: true,
            composed: true,
            detail: { file, error: err },
          })
        );
      }
    }

    return { loaded, failed };
  }

  // --- Playback ---

  async play() {
    try {
      const engine = await this._ensureEngine();
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

  _startPlayhead() {
    const playhead = this._getPlayhead();
    if (!playhead || !this._engine) return;
    const engine = this._engine;
    playhead.startAnimation(
      () => (engine ? engine.getCurrentTime() : 0),
      this.sampleRate,
      this.samplesPerPixel
    );
  }

  _stopPlayhead() {
    const playhead = this._getPlayhead();
    if (!playhead) return;
    playhead.stopAnimation(this._currentTime, this.sampleRate, this.samplesPerPixel);
  }

  private _getPlayhead(): DawPlayheadElement | null {
    return this.shadowRoot?.querySelector('daw-playhead') as DawPlayheadElement | null;
  }

  /** Returns engine tracks sorted by DOM order of <daw-track> children. */
  private _getOrderedTracks(): Array<[string, ClipTrack]> {
    const domOrder: string[] = [...this.querySelectorAll('daw-track')].map(
      (el) => (el as DawTrackElement).trackId
    );
    return [...this._engineTracks.entries()].sort((a, b) => {
      const ai = domOrder.indexOf(a[0]);
      const bi = domOrder.indexOf(b[0]);
      return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
    });
  }

  // --- Render ---

  render() {
    const selStartPx = (this._selectionStartTime * this.sampleRate) / this.samplesPerPixel;
    const selEndPx = (this._selectionEndTime * this.sampleRate) / this.samplesPerPixel;

    return html`
      <div
        class="timeline ${this._dragOver ? 'drag-over' : ''}"
        style="width: ${Math.max(this._totalWidth, 100)}px;"
        data-playing=${this._isPlaying}
        @pointerdown=${this._pointer.onPointerDown}
        @dragover=${this._onDragOver}
        @dragleave=${this._onDragLeave}
        @drop=${this._onDrop}
      >
        ${this.timescale
          ? html`<daw-ruler
              .samplesPerPixel=${this.samplesPerPixel}
              .sampleRate=${this.sampleRate}
              .duration=${this._duration}
            ></daw-ruler>`
          : ''}
        <daw-selection .startPx=${selStartPx} .endPx=${selEndPx}></daw-selection>
        <daw-playhead></daw-playhead>
        ${this._getOrderedTracks().map(
          ([trackId, track]) => html`
            <div
              class="track-row ${trackId === this._selectedTrackId ? 'selected' : ''}"
              style="height: ${this.waveHeight}px;"
              data-track-id=${trackId}
            >
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
