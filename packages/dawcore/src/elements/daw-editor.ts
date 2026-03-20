import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ClipTrack, FadeType, Peaks, PeakData } from '@waveform-playlist/core';
import type { TrackDescriptor, ClipDescriptor } from '../types';
import { createClipFromSeconds, createTrack, clipPixelWidth } from '@waveform-playlist/core';
import { PeakPipeline } from '../workers/peakPipeline';
import type { DawTrackElement } from './daw-track';
import type { DawClipElement } from './daw-clip';
import type { DawPlayheadElement } from './daw-playhead';
import type { PlaylistEngine } from '@waveform-playlist/engine';
import '../elements/daw-track-controls';
import { hostStyles } from '../styles/theme';
import { ViewportController } from '../controllers/viewport-controller';
import { AudioResumeController } from '../controllers/audio-resume-controller';
import { PointerHandler } from '../interactions/pointer-handler';
import type {
  DawSelectionDetail,
  DawTrackIdDetail,
  DawTrackErrorDetail,
  DawErrorDetail,
  LoadFilesResult,
} from '../events';
import { loadFiles as loadFilesImpl } from '../interactions/file-loader';

@customElement('daw-editor')
export class DawEditorElement extends LitElement {
  @property({ type: Number, attribute: 'samples-per-pixel' }) samplesPerPixel = 1024;
  @property({ type: Number, attribute: 'wave-height' }) waveHeight = 128;
  @property({ type: Boolean }) timescale = false;
  @property({ type: Boolean }) mono = false;
  @property({ type: Number, attribute: 'bar-width' }) barWidth = 1;
  @property({ type: Number, attribute: 'bar-gap' }) barGap = 0;
  @property({ type: Boolean, attribute: 'file-drop' }) fileDrop = false;
  /** Initial sample rate hint. Overridden by decoded audio buffer's actual rate. */
  @property({ type: Number, attribute: 'sample-rate' }) sampleRate = 48000;

  /**
   * Resolved sample rate from decoded audio. Falls back to the `sampleRate`
   * property until the first audio buffer is decoded.
   */
  _resolvedSampleRate: number | null = null;

  @state() _tracks: Map<string, TrackDescriptor> = new Map();
  @state() _engineTracks: Map<string, ClipTrack> = new Map();
  @state() _peaksData: Map<string, PeakData> = new Map();
  @state() _isPlaying = false;
  @state() private _duration = 0;
  @state() _selectedTrackId: string | null = null;
  @state() _dragOver = false;

  // Not @state — selection updated directly on <daw-selection> element
  // during drag to avoid 60fps Lit re-renders (same pattern as _currentTime)
  _selectionStartTime = 0;
  _selectionEndTime = 0;
  _currentTime = 0;

  _engine: PlaylistEngine | null = null;
  private _enginePromise: Promise<PlaylistEngine> | null = null;
  private _audioInitialized = false;
  _audioCache = new Map<string, Promise<AudioBuffer>>();
  _clipBuffers = new Map<string, AudioBuffer>();
  _peakPipeline = new PeakPipeline();
  private _trackElements = new Map<string, DawTrackElement>();
  private _childObserver: MutationObserver | null = null;
  private _audioResume = new AudioResumeController(this);
  @property({ attribute: 'eager-resume' })
  eagerResume?: string;
  private _pointer = new PointerHandler(this);
  private _viewport = (() => {
    const v = new ViewportController(this);
    v.scrollSelector = '.scroll-area';
    return v;
  })();

  static styles = [
    hostStyles,
    css`
      :host {
        display: flex;
        position: relative;
        background: var(--daw-background, #1a1a2e);
        overflow: hidden;
      }
      .controls-column {
        flex-shrink: 0;
        width: var(--daw-controls-width, 180px);
      }
      .scroll-area {
        flex: 1;
        overflow-x: auto;
        overflow-y: hidden;
        min-height: var(--daw-min-height, 200px);
      }
      .timeline {
        position: relative;
        min-height: 100%;
        cursor: text;
      }
      .track-row {
        position: relative;
        background: var(--daw-track-background, #16213e);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .track-row.selected {
        background: rgba(99, 199, 95, 0.08);
      }
      .timeline.drag-over {
        outline: 2px dashed var(--daw-selection-color, rgba(99, 199, 95, 0.3));
        outline-offset: -2px;
      }
    `,
  ];

  /** Effective sample rate: decoded audio rate if available, otherwise the initial hint. */
  get effectiveSampleRate(): number {
    return this._resolvedSampleRate ?? this.sampleRate;
  }

  /** Derived pixel width from duration. */
  private get _totalWidth(): number {
    return Math.ceil((this._duration * this.effectiveSampleRate) / this.samplesPerPixel);
  }

  /** Setter for external handlers (e.g. PointerHandler) to update @state reactively. */
  _setSelectedTrackId(trackId: string | null) {
    this._selectedTrackId = trackId;
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
      new CustomEvent<DawSelectionDetail>('daw-selection', {
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
    this.addEventListener('daw-track-control', this._onTrackControl as EventListener);
    this.addEventListener('daw-track-remove', this._onTrackRemoveRequest as EventListener);

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
    this.removeEventListener('daw-track-control', this._onTrackControl as EventListener);
    this.removeEventListener('daw-track-remove', this._onTrackRemoveRequest as EventListener);
    this._childObserver?.disconnect();
    this._childObserver = null;
    this._trackElements.clear();
    this._audioCache.clear();
    this._clipBuffers.clear();
    this._peakPipeline.terminate();

    try {
      this._disposeEngine();
    } catch (err) {
      console.warn('[dawcore] Error disposing engine: ' + String(err));
    }
  }

  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('eagerResume')) {
      this._audioResume.target = this.eagerResume;
    }
    // Re-extract peaks at new zoom level from cached WaveformData (near-instant)
    if (changedProperties.has('samplesPerPixel') && this._clipBuffers.size > 0) {
      const reextracted = this._peakPipeline.reextractPeaks(
        this._clipBuffers,
        this.samplesPerPixel,
        this.mono
      );
      if (reextracted.size > 0) {
        const next = new Map(this._peaksData);
        for (const [clipId, peakData] of reextracted) {
          next.set(clipId, peakData);
        }
        this._peaksData = next;
      }
    }
  }

  // --- Track Events ---
  private _onTrackConnected = (e: CustomEvent) => {
    const trackId = e.detail?.trackId;
    const trackEl = e.detail?.element;
    if (!trackId || !(trackEl instanceof HTMLElement)) {
      console.warn('[dawcore] Invalid daw-track-connected event detail: ' + String(e.detail));
      return;
    }

    const descriptor = this._readTrackDescriptor(trackEl as DawTrackElement);
    this._tracks = new Map(this._tracks).set(trackId, descriptor);
    this._trackElements.set(trackId, trackEl as DawTrackElement);
    this._loadTrack(trackId, descriptor);
  };

  private _onTrackRemoved(trackId: string) {
    this._trackElements.delete(trackId);
    // Clean up per-clip data before removing the track (need clip IDs from engine tracks)
    const removedTrack = this._engineTracks.get(trackId);
    if (removedTrack) {
      const nextPeaks = new Map(this._peaksData);
      for (const clip of removedTrack.clips) {
        this._clipBuffers.delete(clip.id);
        nextPeaks.delete(clip.id);
      }
      this._peaksData = nextPeaks;
    }
    const nextTracks = new Map(this._tracks);
    nextTracks.delete(trackId);
    this._tracks = nextTracks;
    const nextEngine = new Map(this._engineTracks);
    nextEngine.delete(trackId);
    this._engineTracks = nextEngine;
    this._recomputeDuration();
    if (this._engine) {
      // Incremental removal preserves playback (no playout rebuild)
      this._engine.removeTrack(trackId);
    }
    if (nextEngine.size === 0) {
      this._currentTime = 0;
      this._stopPlayhead();
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

  private static _CONTROL_PROPS = new Set(['volume', 'pan', 'muted', 'soloed']);

  private _onTrackControl = (e: CustomEvent) => {
    const { trackId, prop, value } = e.detail ?? {};
    if (!trackId || !prop || !DawEditorElement._CONTROL_PROPS.has(prop)) return;

    const oldDescriptor = this._tracks.get(trackId);
    if (oldDescriptor) {
      const descriptor = { ...oldDescriptor, [prop]: value };
      this._tracks = new Map(this._tracks).set(trackId, descriptor);

      // Forward to engine with validated values
      if (this._engine) {
        if (prop === 'volume')
          this._engine.setTrackVolume(trackId, Math.max(0, Math.min(1, Number(value))));
        if (prop === 'pan')
          this._engine.setTrackPan(trackId, Math.max(-1, Math.min(1, Number(value))));
        if (prop === 'muted') this._engine.setTrackMute(trackId, Boolean(value));
        if (prop === 'soloed') this._engine.setTrackSolo(trackId, Boolean(value));
      }
    }

    // Note: we don't sync back to the <daw-track> DOM element to avoid
    // a redundant daw-track-update → _onTrackUpdate loop. The _tracks
    // descriptor map is the source of truth for control values.
  };

  private _onTrackRemoveRequest = (e: CustomEvent) => {
    const { trackId } = e.detail ?? {};
    if (!trackId) return;
    const trackEl = this._trackElements.get(trackId);
    if (trackEl) {
      trackEl.remove(); // MutationObserver will trigger _onTrackRemoved
    } else {
      this._onTrackRemoved(trackId); // File-dropped tracks: no DOM element
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
          fadeType: clipEl.fadeType as FadeType,
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
        // decodes at the hardware rate, which may differ from the initial hint
        this._resolvedSampleRate = audioBuffer.sampleRate;

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

        this._clipBuffers = new Map(this._clipBuffers).set(clip.id, audioBuffer);
        const peakData = await this._peakPipeline.generatePeaks(
          audioBuffer,
          this.samplesPerPixel,
          this.mono
        );
        this._peaksData = new Map(this._peaksData).set(clip.id, peakData);
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
      // Align track.id with the editor's trackId so engine.setTrackSolo/Mute/etc. find it
      track.id = trackId;

      this._engineTracks = new Map(this._engineTracks).set(trackId, track);
      this._recomputeDuration();

      const engine = await this._ensureEngine();
      engine.setTracks([...this._engineTracks.values()]);

      this.dispatchEvent(
        new CustomEvent<DawTrackIdDetail>('daw-track-ready', {
          bubbles: true,
          composed: true,
          detail: { trackId },
        })
      );
    } catch (err) {
      // Guard against dispatching on a disconnected element (CLAUDE.md pattern #36)
      if (!this.isConnected) return;
      console.warn('[dawcore] Failed to load track "' + trackId + '": ' + String(err));
      this.dispatchEvent(
        new CustomEvent<DawTrackErrorDetail>('daw-track-error', {
          bubbles: true,
          composed: true,
          detail: { trackId, error: err },
        })
      );
    }
  }

  async _fetchAndDecode(src: string): Promise<AudioBuffer> {
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

  _recomputeDuration() {
    let maxSample = 0;
    for (const track of this._engineTracks.values()) {
      for (const clip of track.clips) {
        const endSample = clip.startSample + clip.durationSamples;
        if (endSample > maxSample) maxSample = endSample;
      }
    }
    this._duration = maxSample / this.effectiveSampleRate;
  }

  // --- Engine ---
  _ensureEngine(): Promise<PlaylistEngine> {
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
      sampleRate: this.effectiveSampleRate,
      samplesPerPixel: this.samplesPerPixel,
      zoomLevels: [256, 512, 1024, 2048, 4096, 8192, this.samplesPerPixel]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a - b),
    });

    engine.on('statechange', (engineState) => {
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
      this.dispatchEvent(
        new CustomEvent<DawErrorDetail>('daw-error', {
          bubbles: true,
          composed: true,
          detail: { operation: 'file-drop', error: err },
        })
      );
    }
  };

  async loadFiles(files: FileList | File[]): Promise<LoadFilesResult> {
    return loadFilesImpl(this, files);
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
      console.warn('[dawcore] Playback failed: ' + String(err));
      this.dispatchEvent(
        new CustomEvent<DawErrorDetail>('daw-error', {
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
      () => engine.getCurrentTime(),
      this.effectiveSampleRate,
      this.samplesPerPixel
    );
  }

  _stopPlayhead() {
    const playhead = this._getPlayhead();
    if (!playhead) return;
    playhead.stopAnimation(this._currentTime, this.effectiveSampleRate, this.samplesPerPixel);
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
      // Both not in DOM (e.g. file drops): preserve Map insertion order
      if (ai === -1 && bi === -1) return 0;
      // Only one not in DOM: sort it after DOM tracks
      if (ai === -1) return 1;
      if (bi === -1) return -1;
      return ai - bi;
    });
  }

  // --- Render ---
  render() {
    const sr = this.effectiveSampleRate;
    const selStartPx = (this._selectionStartTime * sr) / this.samplesPerPixel;
    const selEndPx = (this._selectionEndTime * sr) / this.samplesPerPixel;

    // Precompute track info once for both controls column and timeline
    const orderedTracks = this._getOrderedTracks().map(([trackId, track]) => {
      const descriptor = this._tracks.get(trackId);
      const firstPeaks = track.clips
        .map((c) => this._peaksData.get(c.id))
        .find((p) => p && p.data.length > 0);
      const numChannels = firstPeaks ? firstPeaks.data.length : 1;
      return {
        trackId,
        track,
        descriptor,
        numChannels,
        trackHeight: this.waveHeight * numChannels,
      };
    });

    return html`
      ${orderedTracks.length > 0
        ? html`<div class="controls-column">
            ${this.timescale ? html`<div style="height: 30px;"></div>` : ''}
            ${orderedTracks.map(
              (t) => html`
                <daw-track-controls
                  style="height: ${t.trackHeight}px;"
                  .trackId=${t.trackId}
                  .trackName=${t.descriptor?.name ?? 'Untitled'}
                  .volume=${t.descriptor?.volume ?? 1}
                  .pan=${t.descriptor?.pan ?? 0}
                  .muted=${t.descriptor?.muted ?? false}
                  .soloed=${t.descriptor?.soloed ?? false}
                ></daw-track-controls>
              `
            )}
          </div>`
        : ''}
      <div class="scroll-area">
        <div
          class="timeline ${this._dragOver ? 'drag-over' : ''}"
          style="width: ${this._totalWidth > 0 ? this._totalWidth + 'px' : '100%'};"
          data-playing=${this._isPlaying}
          @pointerdown=${this._pointer.onPointerDown}
          @dragover=${this._onDragOver}
          @dragleave=${this._onDragLeave}
          @drop=${this._onDrop}
        >
          ${orderedTracks.length > 0 && this.timescale
            ? html`<daw-ruler
                .samplesPerPixel=${this.samplesPerPixel}
                .sampleRate=${this.effectiveSampleRate}
                .duration=${this._duration}
              ></daw-ruler>`
            : ''}
          ${orderedTracks.length > 0
            ? html`<daw-selection .startPx=${selStartPx} .endPx=${selEndPx}></daw-selection>
                <daw-playhead></daw-playhead>`
            : ''}
          ${orderedTracks.map((t) => {
            const channelHeight = this.waveHeight;
            return html`
              <div
                class="track-row ${t.trackId === this._selectedTrackId ? 'selected' : ''}"
                style="height: ${t.trackHeight}px;"
                data-track-id=${t.trackId}
              >
                ${t.track.clips.map((clip) => {
                  const peakData = this._peaksData.get(clip.id);
                  const width = clipPixelWidth(
                    clip.startSample,
                    clip.durationSamples,
                    this.samplesPerPixel
                  );
                  const clipLeft = Math.floor(clip.startSample / this.samplesPerPixel);
                  const channels: Peaks[] = peakData?.data ?? [new Int16Array(0)];
                  return channels.map(
                    (channelPeaks, chIdx) => html`
                      <daw-waveform
                        style="position: absolute; left: ${clipLeft}px; top: ${chIdx *
                        channelHeight}px;"
                        .peaks=${channelPeaks}
                        .bits=${16}
                        .length=${peakData?.length ?? width}
                        .waveHeight=${channelHeight}
                        .barWidth=${this.barWidth}
                        .barGap=${this.barGap}
                        .visibleStart=${this._viewport.visibleStart}
                        .visibleEnd=${this._viewport.visibleEnd}
                        .originX=${clipLeft}
                      ></daw-waveform>
                    `
                  );
                })}
              </div>
            `;
          })}
        </div>
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
