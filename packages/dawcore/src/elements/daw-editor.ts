import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { ClipTrack, FadeType, Peaks, PeakData } from '@waveform-playlist/core';
import type { TrackDescriptor, ClipDescriptor } from '../types';
import {
  createClip,
  createClipFromSeconds,
  createTrack,
  clipPixelWidth,
} from '@waveform-playlist/core';
import { PeakPipeline } from '../workers/peakPipeline';
import type { DawTrackElement } from './daw-track';
import type { DawClipElement } from './daw-clip';
import type { DawPlayheadElement } from './daw-playhead';
import type { PlaylistEngine } from '@waveform-playlist/engine';
import '../elements/daw-track-controls';
import { hostStyles, clipStyles } from '../styles/theme';
import { ViewportController } from '../controllers/viewport-controller';
import { AudioResumeController } from '../controllers/audio-resume-controller';
import { RecordingController } from '../controllers/recording-controller';
import type { RecordingOptions } from '../controllers/recording-controller';
import { PointerHandler } from '../interactions/pointer-handler';
import { ClipPointerHandler } from '../interactions/clip-pointer-handler';
import type {
  DawSelectionDetail,
  DawTrackIdDetail,
  DawTrackErrorDetail,
  DawErrorDetail,
  LoadFilesResult,
} from '../events';
import { loadFiles as loadFilesImpl } from '../interactions/file-loader';
import { addRecordedClip } from '../interactions/recording-clip';
import { splitAtPlayhead as performSplitAtPlayhead } from '../interactions/split-handler';
import { syncPeaksForChangedClips } from '../interactions/clip-peak-sync';
import { loadWaveformDataFromUrl } from '../interactions/peaks-loader';
import { extractPeaks } from '../workers/waveformDataUtils';

@customElement('daw-editor')
export class DawEditorElement extends LitElement {
  @property({ type: Number, attribute: 'samples-per-pixel', noAccessor: true })
  get samplesPerPixel(): number {
    return this._samplesPerPixel;
  }
  set samplesPerPixel(value: number) {
    const old = this._samplesPerPixel;
    if (!Number.isFinite(value) || value <= 0) return;
    const clamped =
      this._minSamplesPerPixel > 0 && value < this._minSamplesPerPixel
        ? this._minSamplesPerPixel
        : value;
    if (clamped !== value) {
      console.warn(
        '[dawcore] Zoom ' +
          value +
          ' spp rejected — pre-computed peaks limit is ' +
          this._minSamplesPerPixel +
          ' spp'
      );
    }
    this._samplesPerPixel = clamped;
    this.requestUpdate('samplesPerPixel', old);
  }
  private _samplesPerPixel = 1024;
  @property({ type: Number, attribute: 'wave-height' }) waveHeight = 128;
  @property({ type: Boolean }) timescale = false;
  @property({ type: Boolean }) mono = false;
  @property({ type: Number, attribute: 'bar-width' }) barWidth = 1;
  @property({ type: Number, attribute: 'bar-gap' }) barGap = 0;
  @property({ type: Boolean, attribute: 'file-drop' }) fileDrop = false;
  @property({ type: Boolean, attribute: 'clip-headers' }) clipHeaders = false;
  @property({ type: Number, attribute: 'clip-header-height' }) clipHeaderHeight = 20;
  @property({ type: Boolean, attribute: 'interactive-clips' }) interactiveClips = false;
  /** Desired sample rate. Creates a cross-browser AudioContext at this rate.
   *  Pre-computed .dat peaks render instantly when they match. */
  @property({ type: Number, attribute: 'sample-rate' }) sampleRate = 48000;
  /** Resolved sample rate — falls back to sampleRate property until first audio decode. */
  _resolvedSampleRate: number | null = null;
  @state() _tracks: Map<string, TrackDescriptor> = new Map();
  @state() _engineTracks: Map<string, ClipTrack> = new Map();
  @state() _peaksData: Map<string, PeakData> = new Map();
  @state() _isPlaying = false;
  @state() private _duration = 0;
  @state() _selectedTrackId: string | null = null;
  @state() _dragOver = false;
  // Not @state — updated directly to avoid 60fps Lit re-renders
  _selectionStartTime = 0;
  _selectionEndTime = 0;
  _currentTime = 0;
  /** Consumer-provided AudioContext. When set, used for decode, playback, and recording. */
  private _externalAudioContext: AudioContext | null = null;
  private _ownedAudioContext: AudioContext | null = null;

  /** Set an AudioContext to use for all audio operations. Must be set before tracks load. */
  set audioContext(ctx: AudioContext | null) {
    if (ctx && ctx.state === 'closed') {
      console.warn('[dawcore] Provided AudioContext is already closed. Ignoring.');
      return;
    }
    if (this._engine) {
      console.warn(
        '[dawcore] audioContext set after engine is built. ' +
          'The engine will continue using the previous context.'
      );
    }
    this._externalAudioContext = ctx;
  }

  get audioContext(): AudioContext {
    if (this._externalAudioContext) return this._externalAudioContext;
    if (!this._ownedAudioContext) {
      this._ownedAudioContext = new AudioContext({ sampleRate: this.sampleRate });
      if (this._ownedAudioContext.sampleRate !== this.sampleRate) {
        console.warn(
          '[dawcore] Requested sampleRate ' +
            this.sampleRate +
            ' but AudioContext is running at ' +
            this._ownedAudioContext.sampleRate
        );
      }
    }
    return this._ownedAudioContext;
  }
  _engine: PlaylistEngine | null = null;
  private _enginePromise: Promise<PlaylistEngine> | null = null;
  _audioCache = new Map<string, Promise<AudioBuffer>>();
  private _peaksCache = new Map<string, Promise<import('waveform-data').default>>();
  _clipBuffers = new Map<string, AudioBuffer>();
  _clipOffsets = new Map<string, { offsetSamples: number; durationSamples: number }>();
  _peakPipeline = new PeakPipeline();
  /** Coarsest scale from pre-computed peaks — zoom cannot go finer than this. 0 = no limit. */
  private _minSamplesPerPixel = 0;
  private _trackElements = new Map<string, DawTrackElement>();
  private _childObserver: MutationObserver | null = null;
  private _audioResume = new AudioResumeController(this);
  @property({ attribute: 'eager-resume' })
  eagerResume?: string;
  private _recordingController = new RecordingController(this);
  private _clipPointer = new ClipPointerHandler(this);
  get _clipHandler() {
    return this.interactiveClips ? this._clipPointer : null;
  }
  get engine() {
    return this._engine;
  }
  /** Re-extract peaks for a clip at new offset/duration from cached WaveformData. */
  reextractClipPeaks(clipId: string, offsetSamples: number, durationSamples: number) {
    const buf = this._clipBuffers.get(clipId);
    if (!buf) return null;
    const singleClipBuffers = new Map([[clipId, buf]]);
    const singleClipOffsets = new Map([[clipId, { offsetSamples, durationSamples }]]);
    const result = this._peakPipeline.reextractPeaks(
      singleClipBuffers,
      this.samplesPerPixel,
      this.mono,
      singleClipOffsets
    );
    const peakData = result.get(clipId);
    if (!peakData) return null;
    return { data: peakData.data, length: peakData.length };
  }
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
    clipStyles,
  ];

  get effectiveSampleRate(): number {
    return this._resolvedSampleRate ?? this.sampleRate;
  }
  resolveAudioContextSampleRate(rate: number) {
    if (!this._resolvedSampleRate) this._resolvedSampleRate = rate;
  }
  private get _totalWidth(): number {
    return Math.ceil((this._duration * this.effectiveSampleRate) / this.samplesPerPixel);
  }
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
    this._peaksCache.clear();
    this._clipBuffers.clear();
    this._clipOffsets.clear();
    this._peakPipeline.terminate();
    this._minSamplesPerPixel = 0;
    try {
      this._disposeEngine();
    } catch (err) {
      console.warn('[dawcore] Error disposing engine: ' + String(err));
    }
    // Close owned AudioContext to release hardware resources.
    // Skip when consumer provided an external context (they own its lifecycle).
    if (this._ownedAudioContext) {
      this._ownedAudioContext.close().catch((err) => {
        console.warn('[dawcore] Error closing AudioContext: ' + String(err));
      });
      this._ownedAudioContext = null;
    }
  }
  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('eagerResume')) {
      this._audioResume.target = this.eagerResume;
    }
    // Restart playhead animation with new samplesPerPixel if playing
    if (changedProperties.has('samplesPerPixel') && this._isPlaying) {
      this._startPlayhead();
    }
    // Re-extract peaks at new zoom level from cached WaveformData (near-instant).
    // For worker-generated peaks, baseScale (128) is finest; for pre-computed .dat
    // peaks (only cached when rates match), the file's scale is the limit.
    if (changedProperties.has('samplesPerPixel') && this._clipBuffers.size > 0) {
      const re = this._peakPipeline.reextractPeaks(
        this._clipBuffers,
        this.samplesPerPixel,
        this.mono,
        this._clipOffsets
      );
      if (re.size > 0) {
        const next = new Map(this._peaksData);
        for (const [id, pd] of re) next.set(id, pd);
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
        this._clipOffsets.delete(clip.id);
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
    // Recompute zoom floor from remaining cached WaveformData scales
    this._minSamplesPerPixel = this._peakPipeline.getMaxCachedScale(this._clipBuffers);
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
    // Select the track when interacting with its controls
    if (this._selectedTrackId !== trackId) {
      this._setSelectedTrackId(trackId);
      if (this._engine) {
        this._engine.selectTrack(trackId);
      }
      this.dispatchEvent(
        new CustomEvent('daw-track-select', {
          bubbles: true,
          composed: true,
          detail: { trackId },
        })
      );
    }
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
    // Don't sync back to <daw-track> DOM element — avoids daw-track-update loop.
    // _tracks descriptor map is the source of truth for control values.
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
        peaksSrc: '',
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
          peaksSrc: clipEl.peaksSrc,
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

        // Start both fetches concurrently — await peaks first to render preview before audio decode
        const waveformDataPromise = clipDesc.peaksSrc ? this._fetchPeaks(clipDesc.peaksSrc) : null;
        const audioPromise = this._fetchAndDecode(clipDesc.src);

        // --- Peaks-first path: render waveform before audio decode completes ---
        // Separate try/catch for peaks so audio errors aren't misattributed.
        // If the .dat sample rate doesn't match the AudioContext rate, skip the
        // pre-computed peaks entirely — rate conversion creates subtle mismatches
        // in trim/split/zoom. The worker generates correct peaks from decoded audio.
        let waveformData: any = null;
        if (waveformDataPromise) {
          try {
            const wd = await waveformDataPromise;
            const contextRate = this.audioContext.sampleRate;
            if (wd.sample_rate === contextRate) {
              waveformData = wd;
            } else {
              console.warn(
                '[dawcore] Pre-computed peaks at ' +
                  wd.sample_rate +
                  ' Hz do not match AudioContext at ' +
                  contextRate +
                  ' Hz — ignoring ' +
                  clipDesc.peaksSrc +
                  ', generating from audio'
              );
            }
          } catch (err) {
            console.warn(
              '[dawcore] Failed to load peaks from ' +
                clipDesc.peaksSrc +
                ': ' +
                String(err) +
                ' — falling back to AudioBuffer generation'
            );
          }
        }
        if (waveformData) {
          // Create clip with integer samples to avoid float round-trip drift
          // (CLAUDE.md pattern #40: prefer createClip when samples known)
          const wdRate = waveformData.sample_rate;
          const clip = createClip({
            waveformData,
            startSample: Math.round(clipDesc.start * wdRate),
            durationSamples: Math.round((clipDesc.duration || waveformData.duration) * wdRate),
            offsetSamples: Math.round(clipDesc.offset * wdRate),
            gain: clipDesc.gain,
            name: clipDesc.name,
            sampleRate: wdRate,
            sourceDurationSamples: Math.ceil(waveformData.duration * wdRate),
          });
          const effectiveScale = Math.max(this.samplesPerPixel, waveformData.scale);
          const peakData = extractPeaks(
            waveformData,
            effectiveScale,
            this.mono,
            clip.offsetSamples,
            clip.durationSamples
          );
          this._clipOffsets.set(clip.id, {
            offsetSamples: clip.offsetSamples,
            durationSamples: clip.durationSamples,
          });
          this._peaksData = new Map(this._peaksData).set(clip.id, peakData);
          this._minSamplesPerPixel = Math.max(this._minSamplesPerPixel, waveformData.scale);

          // Render preview track immediately with peaks (render-only until audio
          // completes and engine.setTracks() runs at end of _loadTrack)
          const previewTrack = createTrack({
            name: descriptor.name,
            clips: [clip],
            volume: descriptor.volume,
            pan: descriptor.pan,
            muted: descriptor.muted,
            soloed: descriptor.soloed,
          });
          previewTrack.id = trackId;
          this._engineTracks = new Map(this._engineTracks).set(trackId, previewTrack);
          this._recomputeDuration();

          // Wait for audio decode — clean up preview state if it fails
          let audioBuffer: AudioBuffer;
          try {
            audioBuffer = await audioPromise;
          } catch (audioErr) {
            // Remove ghost preview so the user doesn't see a waveform with no audio
            const nextPeaks = new Map(this._peaksData);
            nextPeaks.delete(clip.id);
            this._peaksData = nextPeaks;
            this._clipOffsets.delete(clip.id);
            const nextEngine = new Map(this._engineTracks);
            nextEngine.delete(trackId);
            this._engineTracks = nextEngine;
            this._minSamplesPerPixel = this._peakPipeline.getMaxCachedScale(this._clipBuffers);
            this._recomputeDuration();
            throw audioErr; // Propagate to outer catch for daw-track-error event
          }
          this._resolvedSampleRate = audioBuffer.sampleRate;
          // Backfill audioBuffer immutably: new clip replaces the preview clip
          const updatedClip = { ...clip, audioBuffer };
          this._clipBuffers = new Map(this._clipBuffers).set(clip.id, audioBuffer);
          this._peakPipeline.cacheWaveformData(audioBuffer, waveformData);
          clips.push(updatedClip);
          continue;
        }

        // --- Standard path: decode audio first, then generate peaks ---
        const audioBuffer = await audioPromise;
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
        this._clipOffsets.set(clip.id, {
          offsetSamples: clip.offsetSamples,
          durationSamples: clip.durationSamples,
        });
        const peakData = await this._peakPipeline.generatePeaks(
          audioBuffer,
          this.samplesPerPixel,
          this.mono,
          clip.offsetSamples,
          clip.durationSamples
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
      return this.audioContext.decodeAudioData(arrayBuffer);
    })();
    this._audioCache.set(src, promise);
    try {
      return await promise;
    } catch (err) {
      this._audioCache.delete(src);
      throw err;
    }
  }
  private _fetchPeaks(src: string): Promise<import('waveform-data').default> {
    const cached = this._peaksCache.get(src);
    if (cached) return cached;
    const promise = loadWaveformDataFromUrl(src).catch((err) => {
      this._peaksCache.delete(src);
      throw err;
    });
    this._peaksCache.set(src, promise);
    return promise;
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
    const [{ PlaylistEngine }, { NativePlayoutAdapter }] = await Promise.all([
      import('@waveform-playlist/engine'),
      import('@dawcore/transport'),
    ]);
    const adapter = new NativePlayoutAdapter(this.audioContext);
    const engine = new PlaylistEngine({
      adapter,
      sampleRate: this.effectiveSampleRate,
      samplesPerPixel: this.samplesPerPixel,
      zoomLevels: [256, 512, 1024, 2048, 4096, 8192, this.samplesPerPixel]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a - b),
    });
    let lastTracksVersion = -1;
    engine.on('statechange', (engineState) => {
      this._isPlaying = engineState.isPlaying;
      this._duration = engineState.duration;
      this._selectedTrackId = engineState.selectedTrackId;
      // Sync clip positions when tracks change (moveClip, trimClip, splitClip)
      if (engineState.tracksVersion !== lastTracksVersion) {
        lastTracksVersion = engineState.tracksVersion;
        const nextTracks = new Map<string, ClipTrack>();
        for (const track of engineState.tracks) {
          nextTracks.set(track.id, track);
        }
        this._engineTracks = nextTracks;
        // Regenerate peaks for new or trimmed clips
        syncPeaksForChangedClips(this, engineState.tracks);
      }
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
  async play(startTime?: number) {
    try {
      const engine = await this._ensureEngine();
      // Always init — resumes AudioContext if suspended (requires user gesture).
      await engine.init();
      engine.play(startTime);
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
  /** Toggle between play and pause. */
  togglePlayPause() {
    if (this._isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }
  seekTo(time: number) {
    if (!this._engine) {
      console.warn('[dawcore] seekTo: engine not ready, call ignored');
      return;
    }
    if (this._isPlaying) {
      // Transport needs stop+play to reschedule audio sources at new position
      this.stop();
      this.play(time);
    } else {
      this._engine.seek(time);
      this._currentTime = time;
      this._stopPlayhead();
    }
  }

  /** Undo the last structural edit. */
  undo(): void {
    if (!this._engine) {
      console.warn('[dawcore] undo: engine not ready, call ignored');
      return;
    }
    this._engine.undo();
  }

  /** Redo the last undone edit. */
  redo(): void {
    if (!this._engine) {
      console.warn('[dawcore] redo: engine not ready, call ignored');
      return;
    }
    this._engine.redo();
  }

  /** Whether undo is available. */
  get canUndo(): boolean {
    return this._engine?.canUndo ?? false;
  }

  /** Whether redo is available. */
  get canRedo(): boolean {
    return this._engine?.canRedo ?? false;
  }

  /** Split the clip under the playhead on the selected track. */
  splitAtPlayhead(): boolean {
    return performSplitAtPlayhead({
      effectiveSampleRate: this.effectiveSampleRate,
      currentTime: this._currentTime,
      isPlaying: this._isPlaying,
      engine: this._engine,
      dispatchEvent: (e: Event) => this.dispatchEvent(e),
      stop: () => {
        this._engine?.stop();
        this._stopPlayhead();
      },
      // Call engine.play directly (synchronous) — not the async editor play()
      // which yields to microtask queue via await engine.init(). Engine is
      // already initialized at split time; the async gap causes audio desync.
      play: (time: number) => {
        this._engine?.play(time);
        this._startPlayhead();
      },
    });
  }

  // --- Recording ---
  recordingStream: MediaStream | null = null;
  get currentTime(): number {
    return this._currentTime;
  }
  get isRecording(): boolean {
    return this._recordingController.isRecording;
  }
  pauseRecording(): void {
    this._recordingController.pauseRecording();
  }
  resumeRecording(): void {
    this._recordingController.resumeRecording();
  }
  stopRecording(): void {
    this._recordingController.stopRecording();
  }
  _addRecordedClip(
    trackId: string,
    buf: AudioBuffer,
    startSample: number,
    durSamples: number,
    offsetSamples = 0
  ) {
    addRecordedClip(this, trackId, buf, startSample, durSamples, offsetSamples);
  }
  async startRecording(stream?: MediaStream, options?: RecordingOptions): Promise<void> {
    const s = stream ?? this.recordingStream;
    if (!s) {
      console.warn('[dawcore] startRecording: no stream provided and recordingStream is null');
      return;
    }
    await this._recordingController.startRecording(s, options);
  }

  private _renderRecordingPreview(trackId: string, chH: number) {
    const rs = this._recordingController.getSession(trackId);
    if (!rs) return '';
    // Skip latency samples in the preview — they'll be sliced on finalization.
    // Position stays at startSample (same as finalized clip).
    const audibleSamples = Math.max(0, rs.totalSamples - rs.latencySamples);
    if (audibleSamples === 0) return '';
    const latencyPixels = Math.floor(rs.latencySamples / this.samplesPerPixel);
    const left = Math.floor(rs.startSample / this.samplesPerPixel);
    const w = Math.floor(audibleSamples / this.samplesPerPixel);
    return rs.peaks.map((chPeaks, ch) => {
      // Slice peaks to skip latency prefix (2 entries per pixel: min/max)
      const slicedPeaks = latencyPixels > 0 ? chPeaks.slice(latencyPixels * 2) : chPeaks;
      return html`
        <daw-waveform
          data-recording-track=${trackId}
          data-recording-channel=${ch}
          style="position:absolute;left:${left}px;top:${ch * chH}px;"
          .peaks=${slicedPeaks}
          .length=${w}
          .waveHeight=${chH}
          .barWidth=${this.barWidth}
          .barGap=${this.barGap}
          .visibleStart=${this._viewport.visibleStart}
          .visibleEnd=${this._viewport.visibleEnd}
          .originX=${left}
        ></daw-waveform>
      `;
    });
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
      // Use recording session channel count if no finalized clips yet
      const recSession = this._recordingController.getSession(trackId);
      const numChannels = firstPeaks
        ? firstPeaks.data.length
        : recSession
          ? recSession.channelCount
          : 1;
      return {
        trackId,
        track,
        descriptor,
        numChannels,
        trackHeight: this.waveHeight * numChannels + (this.clipHeaders ? this.clipHeaderHeight : 0),
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
                  const hdrH = this.clipHeaders ? this.clipHeaderHeight : 0;
                  const chH = this.waveHeight;
                  return html` <div
                    class="clip-container"
                    style="left:${clipLeft}px;top:0;width:${width}px;height:${t.trackHeight}px;"
                    data-clip-id=${clip.id}
                  >
                    ${hdrH > 0
                      ? html`<div
                          class="clip-header"
                          data-clip-id=${clip.id}
                          data-track-id=${t.trackId}
                          ?data-interactive=${this.interactiveClips}
                        >
                          <span>${clip.name || t.descriptor?.name || ''}</span>
                        </div>`
                      : ''}
                    ${channels.map(
                      (chPeaks, chIdx) =>
                        html` <daw-waveform
                          style="position:absolute;left:0;top:${hdrH + chIdx * chH}px;"
                          .peaks=${chPeaks}
                          .length=${peakData?.length ?? width}
                          .waveHeight=${chH}
                          .barWidth=${this.barWidth}
                          .barGap=${this.barGap}
                          .visibleStart=${this._viewport.visibleStart}
                          .visibleEnd=${this._viewport.visibleEnd}
                          .originX=${clipLeft}
                        ></daw-waveform>`
                    )}
                    ${this.interactiveClips
                      ? html` <div
                            class="clip-boundary"
                            data-boundary-edge="left"
                            data-clip-id=${clip.id}
                            data-track-id=${t.trackId}
                          ></div>
                          <div
                            class="clip-boundary"
                            data-boundary-edge="right"
                            data-clip-id=${clip.id}
                            data-track-id=${t.trackId}
                          ></div>`
                      : ''}
                  </div>`;
                })}
                ${this._renderRecordingPreview(t.trackId, channelHeight)}
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
