import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  AudioClip,
  ClipTrack,
  FadeType,
  Peaks,
  PeakData,
  SnapTo,
  MeterEntry,
} from '@waveform-playlist/core';
import type {
  TrackDescriptor,
  ClipDescriptor,
  DomClipDescriptor,
  TrackConfig,
  ClipConfig,
} from '../types';
import { isDomClip } from '../types';
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
import type { WaveformSegment } from './daw-waveform';
import type { PlaylistEngine, PlayoutAdapter } from '@waveform-playlist/engine';
import '../elements/daw-track-controls';
import '../elements/daw-grid';
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
  DawClipIdDetail,
  DawClipErrorDetail,
  DawErrorDetail,
  LoadFilesResult,
} from '../events';
import { loadFiles as loadFilesImpl } from '../interactions/file-loader';
import { addRecordedClip } from '../interactions/recording-clip';
import { splitAtPlayhead as performSplitAtPlayhead } from '../interactions/split-handler';
import { syncPeaksForChangedClips } from '../interactions/clip-peak-sync';
import { loadWaveformDataFromUrl } from '../interactions/peaks-loader';
import { extractPeaks } from '../workers/waveformDataUtils';

const NO_ADAPTER_ERROR =
  'No PlayoutAdapter set on <daw-editor>. ' +
  'Set editor.adapter before use.\n\n' +
  '  // Option 1: Native Web Audio (no Tone.js)\n' +
  '  npm install @dawcore/transport\n' +
  "  import { NativePlayoutAdapter } from '@dawcore/transport';\n" +
  '  editor.adapter = new NativePlayoutAdapter(new AudioContext());\n\n' +
  '  // Option 2: Tone.js (effects, MIDI synths)\n' +
  '  npm install @waveform-playlist/playout\n' +
  "  import { createToneAdapter } from '@waveform-playlist/playout';\n" +
  '  editor.adapter = createToneAdapter();';

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
  /**
   * When true, the timeline fills the visible viewport even if total clip
   * duration is less. Lets the ruler render before any audio is loaded —
   * useful for empty editors and recording UIs. In beats mode the 32-bar
   * floor already provides this; this attribute controls the temporal mode.
   */
  @property({ type: Boolean, attribute: 'indefinite-playback' }) indefinitePlayback = false;
  @property({ type: String, attribute: 'scale-mode' })
  scaleMode: 'temporal' | 'beats' = 'temporal';
  @property({ type: Number, attribute: 'ticks-per-pixel', noAccessor: true })
  get ticksPerPixel(): number {
    return this._ticksPerPixel;
  }
  set ticksPerPixel(value: number) {
    const old = this._ticksPerPixel;
    if (!Number.isFinite(value) || value <= 0) return;
    this._ticksPerPixel = value;
    this.requestUpdate('ticksPerPixel', old);
  }
  private _ticksPerPixel = 24;
  @property({ type: Number, noAccessor: true })
  get bpm(): number {
    return this._bpm;
  }
  set bpm(value: number) {
    const old = this._bpm;
    if (!Number.isFinite(value) || value <= 0) return;
    this._bpm = value;
    // Forward to engine (which forwards to adapter's Transport)
    if (this._engine) {
      this._engine.setTempo(value);
    }
    this.requestUpdate('bpm', old);
  }
  private _bpm = 120;
  @property({ attribute: false })
  timeSignature: [number, number] = [4, 4];
  @property({ attribute: false })
  meterEntries?: MeterEntry[];
  /** MeterEntries for grid/ruler: explicit meterEntries if set, otherwise derived from timeSignature. */
  get _meterEntries(): MeterEntry[] {
    if (this.meterEntries && this.meterEntries.length > 0) return this.meterEntries;
    return [{ tick: 0, numerator: this.timeSignature[0], denominator: this.timeSignature[1] }];
  }
  @property({ type: Number, noAccessor: true })
  get ppqn(): number {
    return this._ppqn;
  }
  set ppqn(value: number) {
    const old = this._ppqn;
    if (!Number.isFinite(value) || value <= 0) return;
    this._ppqn = value;
    this.requestUpdate('ppqn', old);
  }
  private _ppqn = 960;
  @property({ type: String, attribute: 'snap-to' })
  snapTo: SnapTo = 'off';
  /** Optional tempo-aware conversion: seconds → PPQN ticks. When provided, enables variable tempo. */
  @property({ attribute: false })
  secondsToTicks?: (seconds: number) => number;
  /** Optional tempo-aware conversion: PPQN ticks → seconds. Required alongside secondsToTicks. */
  @property({ attribute: false })
  ticksToSeconds?: (ticks: number) => number;
  /** Sample rate — reads from adapter's AudioContext when available, otherwise falls back to 48000. */
  get sampleRate(): number {
    return this._resolvedSampleRate ?? this._externalAdapter?.audioContext.sampleRate ?? 48000;
  }
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
  @property({ attribute: false })
  set adapter(value: PlayoutAdapter | null) {
    if (value && value.audioContext.state === 'closed') {
      console.warn('[dawcore] Adapter AudioContext is already closed. Ignoring.');
      return;
    }
    if (this._engine) {
      console.warn(
        '[dawcore] adapter set after engine is built. ' +
          'The engine will continue using the previous adapter.'
      );
    }
    this._externalAdapter = value;
  }
  get adapter(): PlayoutAdapter | null {
    return this._externalAdapter;
  }
  private _externalAdapter: PlayoutAdapter | null = null;

  get audioContext(): AudioContext {
    if (!this._externalAdapter) {
      throw new Error(NO_ADAPTER_ERROR);
    }
    return this._externalAdapter.audioContext;
  }
  _engine: PlaylistEngine | null = null;
  private _warnedMissingTicksToSeconds = false;
  private _warnedMissingSecondsToTicks = false;
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
  get renderSamplesPerPixel() {
    return this._renderSpp;
  }
  /** Re-extract peaks for a clip at new offset/duration from cached WaveformData. */
  reextractClipPeaks(
    clipId: string,
    offsetSamples: number,
    durationSamples: number
  ): PeakData | null {
    const buf = this._clipBuffers.get(clipId);
    if (!buf) return null;
    const singleClipBuffers = new Map([[clipId, buf]]);
    const singleClipOffsets = new Map([[clipId, { offsetSamples, durationSamples }]]);
    const result = this._peakPipeline.reextractPeaks(
      singleClipBuffers,
      this._renderSpp,
      this.mono,
      singleClipOffsets
    );
    return result.get(clipId) ?? null;
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
      :host([scale-mode='beats']) .track-row {
        background: transparent;
      }
      :host([scale-mode='beats']) .clip-container {
        background: var(--daw-track-background, #16213e);
      }
      :host([scale-mode='beats']) .track-row.selected .clip-container {
        box-shadow: inset 0 0 0 1000px rgba(99, 199, 95, 0.06);
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
  /**
   * In beats mode, derive samplesPerPixel from ticksPerPixel so that
   * clip positions, waveforms, and the tick-space grid all align.
   */
  private get _renderSpp(): number {
    if (this.scaleMode === 'beats') {
      // Round to integer — WaveformData.resample() uses integer scale math.
      const spp = Math.ceil(
        (60 * this.effectiveSampleRate * this.ticksPerPixel) / (this.ppqn * this.bpm)
      );
      // Floor at the peak pipeline's base scale so peaks can always be extracted.
      // Without this, fine zoom levels request a scale finer than what WaveformData
      // can resample to, causing blank waveforms.
      return this._minSamplesPerPixel > 0 ? Math.max(spp, this._minSamplesPerPixel) : spp;
    }
    return this.samplesPerPixel;
  }
  /** Convert seconds to ticks — uses callback if provided, otherwise single-BPM fallback. */
  _secondsToTicks(seconds: number): number {
    if (this.secondsToTicks) {
      if (!this.ticksToSeconds && !this._warnedMissingTicksToSeconds) {
        this._warnedMissingTicksToSeconds = true;
        console.warn(
          '[waveform-playlist] daw-editor: secondsToTicks is set but ticksToSeconds is missing. Both callbacks are required for variable tempo.'
        );
      }
      return this.secondsToTicks(seconds);
    }
    return (seconds * this.bpm * this.ppqn) / 60;
  }
  /** Convert ticks to seconds — uses callback if provided, otherwise single-BPM fallback. */
  _ticksToSeconds(ticks: number): number {
    if (this.ticksToSeconds) {
      if (!this.secondsToTicks && !this._warnedMissingSecondsToTicks) {
        this._warnedMissingSecondsToTicks = true;
        console.warn(
          '[waveform-playlist] daw-editor: ticksToSeconds is set but secondsToTicks is missing. Both callbacks are required for variable tempo.'
        );
      }
      return this.ticksToSeconds(ticks);
    }
    return (ticks * 60) / (this.bpm * this.ppqn);
  }
  private get _totalWidth(): number {
    if (this.scaleMode === 'beats') {
      const contentTicks = this._secondsToTicks(this._duration);
      // Floor at 32 bars so the grid is always visible — DAW convention.
      const [num] = this.timeSignature;
      const minTicks = 32 * num * this.ppqn;
      return Math.ceil(Math.max(contentTicks, minTicks) / this.ticksPerPixel);
    }
    const naturalWidth = Math.ceil(
      (this._duration * this.effectiveSampleRate) / this.samplesPerPixel
    );
    if (this.indefinitePlayback) {
      // Fill the visible viewport when natural duration is shorter — lets the
      // ruler render before any audio is loaded. ViewportController exposes
      // the scroll-area's clientWidth (updated on attach + ResizeObserver).
      return Math.max(naturalWidth, this._viewport.containerWidth);
    }
    return naturalWidth;
  }
  /** Grid height when no tracks exist — matches scroll area's rendered height. */
  private get _emptyGridHeight(): number {
    const scrollArea = this.shadowRoot?.querySelector('.scroll-area') as HTMLElement | null;
    return scrollArea?.clientHeight ?? 200;
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
    this.addEventListener('daw-clip-connected', this._onClipConnected as EventListener);
    this.addEventListener('daw-clip-update', this._onClipUpdate as EventListener);
    // Detect track + clip removal via MutationObserver (detached elements can't bubble events).
    this._childObserver = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node instanceof HTMLElement) {
            if (node.tagName === 'DAW-TRACK') {
              this._onTrackRemoved((node as DawTrackElement).trackId);
            } else if (node.tagName === 'DAW-CLIP') {
              this._onClipRemovedFromDom(node as DawClipElement);
            }
            const nestedTracks = node.querySelectorAll?.('daw-track');
            if (nestedTracks) {
              for (const track of nestedTracks) {
                this._onTrackRemoved((track as DawTrackElement).trackId);
              }
            }
            const nestedClips = node.querySelectorAll?.('daw-clip');
            if (nestedClips) {
              for (const clip of nestedClips) {
                this._onClipRemovedFromDom(clip as DawClipElement);
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
    this.removeEventListener('daw-clip-connected', this._onClipConnected as EventListener);
    this.removeEventListener('daw-clip-update', this._onClipUpdate as EventListener);
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
  }
  willUpdate(changedProperties: Map<string, unknown>) {
    if (changedProperties.has('eagerResume')) {
      this._audioResume.target = this.eagerResume;
    }
    // Restart playhead animation when zoom or beats params change during playback
    if (
      (changedProperties.has('samplesPerPixel') ||
        changedProperties.has('ticksPerPixel') ||
        changedProperties.has('bpm') ||
        changedProperties.has('secondsToTicks')) &&
      this._isPlaying
    ) {
      this._startPlayhead();
    }
    // Re-extract peaks at new zoom level from cached WaveformData (near-instant).
    // For worker-generated peaks, baseScale (128) is finest; for pre-computed .dat
    // peaks (only cached when rates match), the file's scale is the limit.
    // In beats mode, _renderSpp changes when ticksPerPixel or bpm changes.
    const zoomChanged =
      changedProperties.has('samplesPerPixel') ||
      changedProperties.has('ticksPerPixel') ||
      changedProperties.has('bpm') ||
      changedProperties.has('scaleMode') ||
      changedProperties.has('secondsToTicks');
    if (zoomChanged && this._clipBuffers.size > 0) {
      const re = this._peakPipeline.reextractPeaks(
        this._clipBuffers,
        this._renderSpp,
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
  // --- Clip lifecycle ---
  private _onClipConnected = (e: CustomEvent) => {
    const detail = e.detail as { clipId: string; element: DawClipElement };
    const clipEl = detail.element;
    if (!(clipEl instanceof HTMLElement)) return;
    const trackEl = clipEl.closest('daw-track') as DawTrackElement | null;
    if (!trackEl) return;
    const trackId = trackEl.trackId;
    // Skip during initial track load — daw-track-connected reads all <daw-clip>
    // children synchronously via _readTrackDescriptor. Late-append clips trigger
    // an incremental load below.
    if (!this._engineTracks.has(trackId)) {
      // _tracks is populated in _onTrackConnected before _loadTrack runs, so
      // having a descriptor without an engine track means the parent is still
      // loading. _readTrackDescriptor already captured each existing <daw-clip>
      // child's id into descriptor.clips — those deferred daw-clip-connected
      // events are redundant and silent skip is correct. Only a clipId that
      // wasn't in the pre-load capture is a true late-append that risks being
      // missed; warn for those.
      const desc = this._tracks.get(trackId);
      if (desc && !desc.clips.some((c) => isDomClip(c) && c.clipId === clipEl.clipId)) {
        console.warn(
          '[dawcore] daw-clip-connected fired while parent track "' +
            trackId +
            '" is still loading — late-appended clip may be missed. ' +
            'Wait for daw-track-ready before appending more <daw-clip> children, ' +
            'or use editor.addClip(trackId, config) after the track finishes loading.'
        );
      }
      return;
    }
    const clipDesc: ClipDescriptor = {
      kind: 'dom',
      clipId: clipEl.clipId,
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
    };
    this._loadAndAppendClip(trackId, clipDesc);
  };
  private _onClipUpdate = (e: CustomEvent) => {
    const clipEl = e.target as DawClipElement;
    if (!(clipEl instanceof HTMLElement) || clipEl.tagName !== 'DAW-CLIP') return;
    const detail = e.detail as { trackId: string; clipId: string };
    if (!detail.trackId) {
      // <daw-clip> mounted outside a <daw-track> — developer error.
      console.warn(
        '[dawcore] daw-clip-update fired from a <daw-clip> not nested in a <daw-track> — ignored'
      );
      return;
    }
    this._applyClipUpdate(detail.trackId, detail.clipId, clipEl);
  };
  private _onClipRemovedFromDom(clipEl: DawClipElement) {
    const clipId = clipEl.clipId;
    for (const [trackId, t] of this._engineTracks.entries()) {
      if (t.clips.some((c) => c.id === clipId)) {
        this._removeClipFromTrack(trackId, clipId);
        return;
      }
    }
    // No matching engine clip. May be benign (clip was removed before its load
    // completed), but it can also indicate a DOM/engine id mismatch — purge any
    // orphan cache entries and warn so the leak is visible.
    if (
      this._clipBuffers.has(clipId) ||
      this._clipOffsets.has(clipId) ||
      this._peaksData.has(clipId)
    ) {
      console.warn(
        '[dawcore] _onClipRemovedFromDom: orphaned cache entries for clip "' +
          clipId +
          '" — purging (DOM/engine id mismatch?)'
      );
      this._purgeClipCaches(clipId);
    }
  }
  private async _loadAndAppendClip(trackId: string, clipDesc: DomClipDescriptor) {
    if (!clipDesc.src) return; // empty/no-src clips can't be loaded
    // Late-append always comes via _onClipConnected, which only fires for
    // <daw-clip> elements — so clipId is always known. We use it for the
    // error dispatch so the consumer's addClip Promise rejects with a usable
    // identifier even if _finalizeAudioClip throws before clip.id is set.
    const clipId = clipDesc.clipId;
    // Track which clip id has been inserted into per-clip caches so the catch
    // block can roll back partial state on any error past the cache writes.
    let insertedClipId: string | null = null;
    try {
      // Concurrent fetches: peaks (if provided) + audio decode.
      const waveformDataPromise = clipDesc.peaksSrc
        ? this._resolvePeaks(clipDesc.peaksSrc)
        : Promise.resolve(null);
      const audioPromise = this._fetchAndDecode(clipDesc.src);
      const [waveformData, audioBuffer] = await Promise.all([waveformDataPromise, audioPromise]);
      this._resolvedSampleRate = audioBuffer.sampleRate;

      const clip = await this._finalizeAudioClip(clipDesc, audioBuffer, waveformData);
      insertedClipId = clip.id;

      const t = this._engineTracks.get(trackId);
      if (!t) {
        // Track was removed during load — purge clip state
        this._purgeClipCaches(clip.id);
        return;
      }
      const updatedTrack: ClipTrack = { ...t, clips: [...t.clips, clip] };
      this._engineTracks = new Map(this._engineTracks).set(trackId, updatedTrack);

      const desc = this._tracks.get(trackId);
      if (desc) {
        this._tracks = new Map(this._tracks).set(trackId, {
          ...desc,
          clips: [...desc.clips, clipDesc],
        });
      }
      this._commitTrackChange(trackId, updatedTrack);

      this.dispatchEvent(
        new CustomEvent<DawClipIdDetail>('daw-clip-ready', {
          bubbles: true,
          composed: true,
          detail: { trackId, clipId: clip.id },
        })
      );
    } catch (err) {
      // Always warn — even when disconnected — so the failure isn't silent.
      console.warn('[dawcore] _loadAndAppendClip failed: ' + String(err));
      // Roll back partial cache state so a retry isn't poisoned by stale entries.
      if (insertedClipId) this._purgeClipCaches(insertedClipId);
      // Detached elements can't bubble events, but the listener registered on
      // `this` via addClip will still fire — dispatch directly so the addClip
      // promise rejects instead of orphaning.
      this.dispatchEvent(
        new CustomEvent<DawClipErrorDetail>('daw-clip-error', {
          bubbles: true,
          composed: true,
          detail: { trackId, clipId: insertedClipId ?? clipId, error: err },
        })
      );
    }
  }
  /**
   * Resolve pre-computed peaks for a clip: fetch the .dat/.json, validate the
   * sample rate matches the AudioContext, return the WaveformData or null.
   * Warns on fetch failure and on sample-rate mismatch — never silent.
   *
   * Shared between `_loadTrack` (peaks-first preview path) and
   * `_loadAndAppendClip` (incremental late-append).
   */
  private async _resolvePeaks(peaksSrc: string): Promise<import('waveform-data').default | null> {
    try {
      const wd = await this._fetchPeaks(peaksSrc);
      const contextRate = this.audioContext.sampleRate;
      if (wd.sample_rate === contextRate) return wd;
      console.warn(
        '[dawcore] Pre-computed peaks at ' +
          wd.sample_rate +
          ' Hz do not match AudioContext at ' +
          contextRate +
          ' Hz — ignoring ' +
          peaksSrc +
          ', generating from audio'
      );
      return null;
    } catch (err) {
      console.warn(
        '[dawcore] Failed to load peaks from ' +
          peaksSrc +
          ': ' +
          String(err) +
          ' — falling back to AudioBuffer generation'
      );
      return null;
    }
  }
  /**
   * Construct an AudioClip from a decoded buffer (and optional WaveformData),
   * align its id with the source `<daw-clip>.clipId` when present, populate
   * `_clipBuffers` / `_clipOffsets`, generate peaks via the worker pipeline,
   * and populate `_peaksData`. Returns the finished AudioClip.
   *
   * Shared between `_loadTrack`'s standard path and `_loadAndAppendClip`.
   * Not used by `_loadTrack`'s peaks-first preview path because that path
   * uses sync `extractPeaks` and inserts a preview track BEFORE audio decode.
   */
  private async _finalizeAudioClip(
    clipDesc: ClipDescriptor,
    audioBuffer: AudioBuffer,
    waveformData: import('waveform-data').default | null
  ): Promise<AudioClip> {
    let clip: AudioClip;
    if (waveformData) {
      const wdRate = waveformData.sample_rate;
      clip = createClip({
        audioBuffer,
        waveformData,
        startSample: Math.round(clipDesc.start * wdRate),
        durationSamples: Math.round((clipDesc.duration || waveformData.duration) * wdRate),
        offsetSamples: Math.round(clipDesc.offset * wdRate),
        gain: clipDesc.gain,
        name: clipDesc.name,
        sampleRate: wdRate,
        sourceDurationSamples: Math.ceil(waveformData.duration * wdRate),
      });
      this._peakPipeline.cacheWaveformData(audioBuffer, waveformData);
    } else {
      clip = createClipFromSeconds({
        audioBuffer,
        startTime: clipDesc.start,
        duration: clipDesc.duration || audioBuffer.duration,
        offset: clipDesc.offset,
        gain: clipDesc.gain,
        name: clipDesc.name,
        sampleRate: audioBuffer.sampleRate,
        sourceDuration: audioBuffer.duration,
      });
    }
    if (isDomClip(clipDesc)) clip.id = clipDesc.clipId;

    this._clipBuffers = new Map(this._clipBuffers).set(clip.id, audioBuffer);
    this._clipOffsets.set(clip.id, {
      offsetSamples: clip.offsetSamples,
      durationSamples: clip.durationSamples,
    });
    // generatePeaks can fail (worker crash, CSP, OOM). Purge the cache entries
    // we just inserted so the caller's catch path doesn't leak. The caller may
    // also call _purgeClipCaches in its own error handler — _purgeClipCaches
    // is idempotent.
    let peakData: PeakData;
    try {
      peakData = await this._peakPipeline.generatePeaks(
        audioBuffer,
        this._renderSpp,
        this.mono,
        clip.offsetSamples,
        clip.durationSamples
      );
    } catch (err) {
      this._purgeClipCaches(clip.id);
      throw err;
    }
    this._peaksData = new Map(this._peaksData).set(clip.id, peakData);
    // Raise the zoom-floor only after generatePeaks succeeds — without this,
    // a generatePeaks failure would strand _minSamplesPerPixel at a value
    // backed by no actual peaks (CLAUDE.md `samplesPerPixel` Zoom Floor rule).
    if (waveformData) {
      this._minSamplesPerPixel = Math.max(this._minSamplesPerPixel, waveformData.scale);
    }
    return clip;
  }
  /** Remove a single clip from all per-clip caches. Used by error rollbacks. */
  private _purgeClipCaches(clipId: string) {
    const nextBuffers = new Map(this._clipBuffers);
    nextBuffers.delete(clipId);
    this._clipBuffers = nextBuffers;
    const nextPeaks = new Map(this._peaksData);
    nextPeaks.delete(clipId);
    this._peaksData = nextPeaks;
    this._clipOffsets.delete(clipId);
  }
  /**
   * Recompute duration and forward an updated track to the engine. Single
   * source of truth for the incremental-vs-full-rebuild policy used by every
   * clip-level mutation (addClip, updateClip, removeClip, _applyClipUpdate).
   * Use the engine's incremental updateTrack when available; otherwise fall
   * back to full setTracks (legacy adapters).
   */
  private _commitTrackChange(trackId: string, updatedTrack: ClipTrack) {
    this._recomputeDuration();
    if (this._engine?.updateTrack) this._engine.updateTrack(trackId, updatedTrack);
    else if (this._engine) this._engine.setTracks([...this._engineTracks.values()]);
  }
  private _applyClipUpdate(trackId: string, clipId: string, clipEl: DawClipElement) {
    const t = this._engineTracks.get(trackId);
    if (!t) {
      console.warn('[dawcore] _applyClipUpdate: no engine track for id "' + trackId + '"');
      return;
    }
    const idx = t.clips.findIndex((c) => c.id === clipId);
    if (idx === -1) {
      console.warn(
        '[dawcore] _applyClipUpdate: clip "' +
          clipId +
          '" not found in track "' +
          trackId +
          '" (DOM/engine clip-id misalignment?)'
      );
      return;
    }
    const oldClip = t.clips[idx];
    const sr = oldClip.sampleRate ?? this.effectiveSampleRate;
    const newStartSample = Math.round(clipEl.start * sr);
    const newDurationSamples =
      clipEl.duration > 0 ? Math.round(clipEl.duration * sr) : oldClip.durationSamples;
    const newOffsetSamples = Math.round(clipEl.offset * sr);
    const updatedClip = {
      ...oldClip,
      startSample: newStartSample,
      durationSamples: newDurationSamples,
      offsetSamples: newOffsetSamples,
      gain: clipEl.gain,
      name: clipEl.name || oldClip.name,
    };
    const updatedClips = [...t.clips];
    updatedClips[idx] = updatedClip;
    const updatedTrack: ClipTrack = { ...t, clips: updatedClips };
    this._engineTracks = new Map(this._engineTracks).set(trackId, updatedTrack);

    const boundsChanged =
      oldClip.offsetSamples !== newOffsetSamples || oldClip.durationSamples !== newDurationSamples;
    if (boundsChanged) {
      this._clipOffsets.set(clipId, {
        offsetSamples: newOffsetSamples,
        durationSamples: newDurationSamples,
      });
      const peaks = this.reextractClipPeaks(clipId, newOffsetSamples, newDurationSamples);
      if (peaks) {
        this._peaksData = new Map(this._peaksData).set(clipId, peaks);
      }
    }

    this._commitTrackChange(trackId, updatedTrack);
  }
  private _removeClipFromTrack(trackId: string, clipId: string) {
    const t = this._engineTracks.get(trackId);
    if (!t) {
      console.warn('[dawcore] _removeClipFromTrack: no engine track for id "' + trackId + '"');
      return;
    }
    const updatedClips = t.clips.filter((c) => c.id !== clipId);
    if (updatedClips.length === t.clips.length) {
      console.warn(
        '[dawcore] _removeClipFromTrack: clip "' + clipId + '" not found in track "' + trackId + '"'
      );
      return;
    }
    const updatedTrack: ClipTrack = { ...t, clips: updatedClips };
    this._engineTracks = new Map(this._engineTracks).set(trackId, updatedTrack);

    const nextBuffers = new Map(this._clipBuffers);
    nextBuffers.delete(clipId);
    this._clipBuffers = nextBuffers;
    this._clipOffsets.delete(clipId);
    const nextPeaks = new Map(this._peaksData);
    nextPeaks.delete(clipId);
    this._peaksData = nextPeaks;

    const desc = this._tracks.get(trackId);
    if (desc) {
      this._tracks = new Map(this._tracks).set(trackId, {
        ...desc,
        // Only DOM-sourced clips have an id to match; drop-sourced clips are
        // filtered through unchanged (their identity is the descriptor itself).
        clips: desc.clips.filter((c) => !(isDomClip(c) && c.clipId === clipId)),
      });
    }
    this._commitTrackChange(trackId, updatedTrack);
  }
  private _readTrackDescriptor(trackEl: DawTrackElement): TrackDescriptor {
    const clipEls = trackEl.querySelectorAll('daw-clip') as NodeListOf<DawClipElement>;
    const clips: ClipDescriptor[] = [];

    if (clipEls.length === 0 && trackEl.src) {
      // <daw-track src> shorthand — synthetic descriptor with no <daw-clip>
      // backing element. No DOM clipId to align with.
      clips.push({
        kind: 'drop',
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
          kind: 'dom',
          clipId: clipEl.clipId,
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
        // Per-clip try/catch: a single bad clip dispatches daw-clip-error and
        // skips to the next clip rather than aborting the whole track. Without
        // this, clip N's failure leaks earlier clips' cache writes from this
        // loop because the outer catch never reaches engine.setTracks().
        try {
          // Start both fetches concurrently — await peaks first to render preview before audio decode
          const waveformDataPromise = clipDesc.peaksSrc
            ? this._resolvePeaks(clipDesc.peaksSrc)
            : Promise.resolve(null);
          const audioPromise = this._fetchAndDecode(clipDesc.src);

          // --- Peaks-first path: render waveform before audio decode completes ---
          // _resolvePeaks returns null on fetch failure or sample-rate mismatch
          // (warns in either case); the standard path below handles the null case.
          const waveformData = await waveformDataPromise;
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
            // Align engine clip.id with the source <daw-clip>.clipId (if any) so
            // DOM and engine refer to the same clip — required for editor.removeClip
            // and editor.updateClip lookups.
            if (isDomClip(clipDesc)) clip.id = clipDesc.clipId;
            const effectiveScale = Math.max(this._renderSpp, waveformData.scale);
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
          // Reached only when the peaks-first branch above didn't kick in
          // (no peaksSrc, fetch failure, or sample-rate mismatch). waveformData
          // is always null here.
          const audioBuffer = await audioPromise;
          this._resolvedSampleRate = audioBuffer.sampleRate;
          const clip = await this._finalizeAudioClip(clipDesc, audioBuffer, null);
          clips.push(clip);
        } catch (clipErr) {
          // _finalizeAudioClip and the peaks-first audio-decode catch already
          // purged their own per-clip caches before throwing here. Dispatch
          // daw-clip-error so consumers can correlate the failure to a clip.
          console.warn(
            '[dawcore] _loadTrack: clip "' + clipDesc.src + '" failed: ' + String(clipErr)
          );
          if (this.isConnected) {
            this.dispatchEvent(
              new CustomEvent<DawClipErrorDetail>('daw-clip-error', {
                bubbles: true,
                composed: true,
                detail: {
                  trackId,
                  clipId: isDomClip(clipDesc) ? clipDesc.clipId : '',
                  error: clipErr,
                },
              })
            );
          }
        }
      }
      const track = createTrack({
        name: descriptor.name,
        clips,
        volume: descriptor.volume,
        pan: descriptor.pan,
        muted: descriptor.muted,
        soloed: descriptor.soloed,
      });
      // If clips were requested but ALL failed to load, surface as a track-level
      // error so addTrack({clips: [...]}) rejects appropriately. Per-clip
      // daw-clip-error events have already fired for each individual failure.
      const requestedClips = descriptor.clips.filter((c) => c.src).length;
      if (requestedClips > 0 && clips.length === 0) {
        throw new Error(
          'all ' + requestedClips + ' clip(s) failed to load — see prior daw-clip-error events'
        );
      }
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
    if (!this._externalAdapter) {
      throw new Error(NO_ADAPTER_ERROR);
    }

    const { PlaylistEngine } = await import('@waveform-playlist/engine');
    const adapter = this._externalAdapter;

    // Forward initial tempo if adapter supports it
    if (adapter.setTempo) {
      adapter.setTempo(this._bpm);
    } else if (this._bpm !== 120) {
      console.warn(
        '[dawcore] Adapter does not implement setTempo. ' +
          'Initial BPM ' +
          this._bpm +
          ' will not be applied — clips may use wrong tempo.'
      );
    }

    // Try to set the editor's desired PPQN on the adapter, then sync back.
    // Adapter is the source of truth — it may ignore the request.
    adapter.setPpqn?.(this._ppqn);
    this.ppqn = adapter.ppqn;

    const engine = new PlaylistEngine({
      adapter,
      sampleRate: this.effectiveSampleRate,
      samplesPerPixel: this.samplesPerPixel,
      bpm: this._bpm,
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
    engine.on('pause', () => {
      this._currentTime = engine.getCurrentTime();
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
  // --- Programmatic Track API ---
  /**
   * Build the engine if it hasn't been built yet. Lets consumers obtain a
   * non-null `editor.engine` before any track has been loaded — useful for
   * wiring analyzers, effects, or master taps before content arrives.
   */
  async ready(): Promise<PlaylistEngine> {
    return this._ensureEngine();
  }
  /**
   * Wait for either `readyEvent` or `errorEvent` to fire on this editor for
   * the entity matching `matchesId`. Listeners are wired synchronously, then
   * `setup` is called (typical: appendChild). Resolves with `resolveValue`
   * on ready; rejects with a normalized Error on error. Used by addTrack and
   * addClip to share their Promise-with-listener-cleanup machinery.
   */
  private _awaitId<T>(
    readyEvent: string,
    errorEvent: string,
    matchesId: (detail: { trackId?: string; clipId?: string }) => boolean,
    resolveValue: T,
    setup: () => void
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const onReady = (e: Event) => {
        if (!matchesId((e as CustomEvent).detail)) return;
        cleanup();
        resolve(resolveValue);
      };
      const onError = (e: Event) => {
        const detail = (e as CustomEvent).detail as { error?: unknown };
        if (!matchesId((e as CustomEvent).detail)) return;
        cleanup();
        const err = detail.error;
        reject(err instanceof Error ? err : new Error(String(err)));
      };
      const cleanup = () => {
        this.removeEventListener(readyEvent, onReady);
        this.removeEventListener(errorEvent, onError);
      };
      this.addEventListener(readyEvent, onReady);
      this.addEventListener(errorEvent, onError);
      setup();
    });
  }
  /**
   * Append a `<daw-track>` element built from `config` and resolve once the
   * track finishes loading (or reject on `daw-track-error`). Goes through
   * the same `_loadTrack` pipeline as declarative tracks, so descriptors,
   * peaks, and clip buffers are populated correctly.
   */
  addTrack(config: TrackConfig = {}): Promise<DawTrackElement> {
    const trackEl = document.createElement('daw-track') as DawTrackElement;
    if (config.name !== undefined) trackEl.setAttribute('name', config.name);
    if (config.volume !== undefined) trackEl.volume = config.volume;
    if (config.pan !== undefined) trackEl.pan = config.pan;
    if (config.muted) trackEl.setAttribute('muted', '');
    if (config.soloed) trackEl.setAttribute('soloed', '');

    for (const clipConfig of config.clips ?? []) {
      trackEl.appendChild(this._buildClipElement(clipConfig));
    }

    return this._awaitId(
      'daw-track-ready',
      'daw-track-error',
      (d) => d.trackId === trackEl.trackId,
      trackEl,
      () => this.appendChild(trackEl)
    );
  }
  /**
   * Remove a track by id. Equivalent to `trackElement.remove()` —
   * the editor's MutationObserver handles engine and cache cleanup.
   * No-op if no matching track exists.
   */
  removeTrack(trackId: string): void {
    const trackEl = this._trackElements.get(trackId);
    if (trackEl) {
      trackEl.remove();
    } else if (this._engineTracks.has(trackId)) {
      // File-dropped tracks have no DOM element; clean up engine state directly.
      this._onTrackRemoved(trackId);
    } else {
      console.warn('[dawcore] removeTrack: no track found for id "' + trackId + '"');
    }
  }
  /**
   * Update reflected attributes on a track. For DOM-element tracks the changes
   * are written to the `<daw-track>` element (which fires `daw-track-update`);
   * for tracks without a DOM element (file drops) the descriptor and engine
   * state are updated in place.
   */
  updateTrack(trackId: string, partial: Partial<TrackConfig>): void {
    const trackEl = this._trackElements.get(trackId);
    if (trackEl) {
      // Mutating reflected props triggers daw-track-update which propagates
      // to engine via _onTrackUpdate.
      if (partial.name !== undefined) trackEl.setAttribute('name', partial.name);
      if (partial.volume !== undefined) trackEl.volume = partial.volume;
      if (partial.pan !== undefined) trackEl.pan = partial.pan;
      if (partial.muted !== undefined) {
        if (partial.muted) trackEl.setAttribute('muted', '');
        else trackEl.removeAttribute('muted');
      }
      if (partial.soloed !== undefined) {
        if (partial.soloed) trackEl.setAttribute('soloed', '');
        else trackEl.removeAttribute('soloed');
      }
      return;
    }
    // No DOM element — apply directly to descriptor + engine.
    const oldDesc = this._tracks.get(trackId);
    if (!oldDesc) return;
    const newDesc: TrackDescriptor = {
      ...oldDesc,
      ...(partial.name !== undefined && { name: partial.name }),
      ...(partial.volume !== undefined && { volume: partial.volume }),
      ...(partial.pan !== undefined && { pan: partial.pan }),
      ...(partial.muted !== undefined && { muted: partial.muted }),
      ...(partial.soloed !== undefined && { soloed: partial.soloed }),
    };
    this._tracks = new Map(this._tracks).set(trackId, newDesc);
    if (this._engine) {
      if (partial.volume !== undefined) this._engine.setTrackVolume(trackId, partial.volume);
      if (partial.pan !== undefined) this._engine.setTrackPan(trackId, partial.pan);
      if (partial.muted !== undefined) this._engine.setTrackMute(trackId, partial.muted);
      if (partial.soloed !== undefined) this._engine.setTrackSolo(trackId, partial.soloed);
    }
  }
  /**
   * Append a clip to an existing track. Builds a `<daw-clip>` from `config`
   * and appends it to the track's DOM element when one exists; resolves with
   * the new clip's id once the audio decode + peak generation finish.
   */
  addClip(trackId: string, config: ClipConfig): Promise<string> {
    if (!config.src) {
      return Promise.reject(
        new Error(
          'addClip: config.src is required — pass a URL to load. ' +
            'Empty/recording clips are not yet supported via addClip.'
        )
      );
    }
    const trackEl = this._trackElements.get(trackId);
    if (!trackEl) {
      return Promise.reject(
        new Error(
          'addClip: no <daw-track> element for trackId "' +
            trackId +
            '" — addClip currently requires a DOM-backed track. Use editor.addTrack(config) first.'
        )
      );
    }
    const clipEl = this._buildClipElement(config);
    return this._awaitId(
      'daw-clip-ready',
      'daw-clip-error',
      (d) => d.clipId === clipEl.clipId,
      clipEl.clipId,
      () => trackEl.appendChild(clipEl)
    );
  }
  /**
   * Remove a clip by id. Removes the matching `<daw-clip>` DOM element when
   * present (MutationObserver handles cleanup); otherwise updates engine
   * state directly. No-op if no matching clip exists.
   */
  removeClip(trackId: string, clipId: string): void {
    const trackEl = this._trackElements.get(trackId);
    if (trackEl) {
      const clipEl = [...trackEl.querySelectorAll('daw-clip')].find(
        (c) => (c as DawClipElement).clipId === clipId
      ) as DawClipElement | undefined;
      if (clipEl) {
        clipEl.remove();
        return;
      }
    }
    if (this._engineTracks.has(trackId)) {
      this._removeClipFromTrack(trackId, clipId);
      return;
    }
    console.warn(
      '[dawcore] removeClip: no track found for id "' + trackId + '" (clipId "' + clipId + '")'
    );
  }
  /**
   * Update a clip's position (start/duration/offset) or properties (gain/name).
   * For DOM-element clips, writes properties on the `<daw-clip>` element which
   * fires `daw-clip-update`; otherwise applies directly via `_applyClipUpdate`.
   *
   * Re-decoding (changing `src`) is not supported via this method — remove and
   * re-add the clip instead.
   *
   * Note: `fadeIn` / `fadeOut` / `fadeType` on the partial are written to the
   * `<daw-clip>` element (so they round-trip in the descriptor), but engine-side
   * fade application from `<daw-clip>` properties is not yet implemented — see
   * the broader fade-engine integration tracked separately.
   */
  updateClip(trackId: string, clipId: string, partial: Partial<ClipConfig>): void {
    const trackEl = this._trackElements.get(trackId);
    if (trackEl) {
      const clipEl = [...trackEl.querySelectorAll('daw-clip')].find(
        (c) => (c as DawClipElement).clipId === clipId
      ) as DawClipElement | undefined;
      if (clipEl) {
        if (partial.start !== undefined) clipEl.start = partial.start;
        if (partial.duration !== undefined) clipEl.duration = partial.duration;
        if (partial.offset !== undefined) clipEl.offset = partial.offset;
        if (partial.gain !== undefined) clipEl.gain = partial.gain;
        if (partial.name !== undefined) clipEl.setAttribute('name', partial.name);
        if (partial.fadeIn !== undefined) clipEl.fadeIn = partial.fadeIn;
        if (partial.fadeOut !== undefined) clipEl.fadeOut = partial.fadeOut;
        if (partial.fadeType !== undefined) clipEl.setAttribute('fade-type', partial.fadeType);
        return;
      }
    }
    // No DOM element — apply changes directly.
    const t = this._engineTracks.get(trackId);
    if (!t) {
      console.warn('[dawcore] updateClip: no track found for id "' + trackId + '"');
      return;
    }
    const idx = t.clips.findIndex((c) => c.id === clipId);
    if (idx === -1) {
      console.warn(
        '[dawcore] updateClip: clip "' + clipId + '" not found in track "' + trackId + '"'
      );
      return;
    }
    const oldClip = t.clips[idx];
    const sr = oldClip.sampleRate ?? this.effectiveSampleRate;
    const updatedClip = {
      ...oldClip,
      ...(partial.start !== undefined && { startSample: Math.round(partial.start * sr) }),
      ...(partial.duration !== undefined &&
        partial.duration > 0 && { durationSamples: Math.round(partial.duration * sr) }),
      ...(partial.offset !== undefined && { offsetSamples: Math.round(partial.offset * sr) }),
      ...(partial.gain !== undefined && { gain: partial.gain }),
      ...(partial.name !== undefined && { name: partial.name }),
    };
    const updatedClips = [...t.clips];
    updatedClips[idx] = updatedClip;
    const updatedTrack: ClipTrack = { ...t, clips: updatedClips };
    this._engineTracks = new Map(this._engineTracks).set(trackId, updatedTrack);
    this._commitTrackChange(trackId, updatedTrack);
  }
  private _buildClipElement(config: ClipConfig): DawClipElement {
    const clipEl = document.createElement('daw-clip') as DawClipElement;
    if (config.src !== undefined) clipEl.setAttribute('src', config.src);
    if (config.peaksSrc !== undefined) clipEl.setAttribute('peaks-src', config.peaksSrc);
    if (config.start !== undefined) clipEl.start = config.start;
    if (config.duration !== undefined) clipEl.duration = config.duration;
    if (config.offset !== undefined) clipEl.offset = config.offset;
    if (config.gain !== undefined) clipEl.gain = config.gain;
    if (config.name !== undefined) clipEl.setAttribute('name', config.name);
    if (config.fadeIn !== undefined) clipEl.fadeIn = config.fadeIn;
    if (config.fadeOut !== undefined) clipEl.fadeOut = config.fadeOut;
    if (config.fadeType !== undefined) clipEl.setAttribute('fade-type', config.fadeType);
    return clipEl;
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
      currentTime: this.currentTime,
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
    // During playback, read live from engine (not cached _currentTime)
    if (this._isPlaying && this._engine) {
      return this._engine.getCurrentTime();
    }
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
  // --- RecordingHost bridge methods for cross-context worklet support ---
  // These delegate to the adapter's context type (native or standardized-audio-context).
  // The RecordingController calls these when available, falling back to native APIs.

  addWorkletModule(url: string): Promise<void> {
    return (
      this._externalAdapter?.addWorkletModule?.(url) ??
      this.audioContext.audioWorklet.addModule(url)
    );
  }

  createAudioWorkletNode(name: string, options?: AudioWorkletNodeOptions): AudioWorkletNode {
    return (
      this._externalAdapter?.createAudioWorkletNode?.(name, options) ??
      new AudioWorkletNode(this.audioContext, name, options)
    );
  }

  createMediaStreamSource(stream: MediaStream): MediaStreamAudioSourceNode {
    return (
      this._externalAdapter?.createMediaStreamSource?.(stream) ??
      this.audioContext.createMediaStreamSource(stream)
    );
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
    const renderSpp = this._renderSpp;
    const latencyPixels = Math.floor(rs.latencySamples / renderSpp);
    const left = Math.floor(rs.startSample / renderSpp);
    const w = Math.floor(audibleSamples / renderSpp);
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
    const ctx = this.audioContext;
    if (this.scaleMode === 'beats') {
      const secondsToTicksFn = (s: number) => this._secondsToTicks(s);
      playhead.startBeatsAnimationWithMap(
        () => {
          const latency = 'outputLatency' in ctx ? (ctx as AudioContext).outputLatency : 0;
          return Math.max(0, engine.getCurrentTime() - latency);
        },
        secondsToTicksFn,
        this.ticksPerPixel
      );
    } else {
      playhead.startAnimation(
        () => {
          const latency = 'outputLatency' in ctx ? (ctx as AudioContext).outputLatency : 0;
          return Math.max(0, engine.getCurrentTime() - latency);
        },
        this.effectiveSampleRate,
        this.samplesPerPixel
      );
    }
  }
  _stopPlayhead() {
    const playhead = this._getPlayhead();
    if (!playhead) return;
    if (this.scaleMode === 'beats') {
      playhead.stopBeatsAnimationWithMap(
        this._currentTime,
        (s: number) => this._secondsToTicks(s),
        this.ticksPerPixel
      );
    } else {
      playhead.stopAnimation(this._currentTime, this.effectiveSampleRate, this.samplesPerPixel);
    }
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
    const spp = this._renderSpp;
    // In beats mode, derive selection pixels from tick space (same as clip positions)
    // to avoid 1-2px quantization error from the sample round-trip.
    let selStartPx: number;
    let selEndPx: number;
    if (this.scaleMode === 'beats') {
      const startTick = this._secondsToTicks(this._selectionStartTime);
      const endTick = this._secondsToTicks(this._selectionEndTime);
      selStartPx = startTick / this.ticksPerPixel;
      selEndPx = endTick / this.ticksPerPixel;
    } else {
      selStartPx = (this._selectionStartTime * sr) / spp;
      selEndPx = (this._selectionEndTime * sr) / spp;
    }

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
      ${orderedTracks.length > 0 || this.indefinitePlayback
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
          ${(orderedTracks.length > 0 || this.scaleMode === 'beats' || this.indefinitePlayback) &&
          this.timescale
            ? html`<daw-ruler
                .samplesPerPixel=${spp}
                .sampleRate=${this.effectiveSampleRate}
                .duration=${this._duration}
                .scaleMode=${this.scaleMode}
                .ticksPerPixel=${this.ticksPerPixel}
                .meterEntries=${this._meterEntries}
                .ppqn=${this.ppqn}
                .totalWidth=${this._totalWidth}
              ></daw-ruler>`
            : ''}
          ${this.scaleMode === 'beats'
            ? html`<daw-grid
                style="top: ${this.timescale ? 30 : 0}px;"
                .ticksPerPixel=${this.ticksPerPixel}
                .meterEntries=${this._meterEntries}
                .ppqn=${this.ppqn}
                .visibleStart=${this._viewport.visibleStart}
                .visibleEnd=${this._viewport.visibleEnd}
                .length=${this._totalWidth}
                .height=${orderedTracks.length > 0
                  ? orderedTracks.reduce((sum, t) => sum + t.trackHeight + 1, 0)
                  : this._emptyGridHeight}
              ></daw-grid>`
            : ''}
          ${orderedTracks.length > 0 || this.scaleMode === 'beats' || this.indefinitePlayback
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
                  // In beats mode, derive pixel positions from tick space to
                  // match grid lines exactly. The sample→spp path introduces
                  // 1-2px quantization error from integer sample rounding.
                  let clipLeft: number;
                  let width: number;
                  if (this.scaleMode === 'beats') {
                    // Use startTick directly when available — stable across BPM changes.
                    // Fall back to sample→seconds→ticks for clips without startTick.
                    const startTick =
                      clip.startTick !== undefined
                        ? clip.startTick
                        : this._secondsToTicks(clip.startSample / sr);
                    const durSec = clip.durationSamples / sr;
                    const startSec =
                      clip.startTick !== undefined
                        ? this._ticksToSeconds(clip.startTick)
                        : clip.startSample / sr;
                    const endTick = this._secondsToTicks(startSec + durSec);
                    clipLeft = Math.round(startTick / this.ticksPerPixel);
                    width = Math.round(endTick / this.ticksPerPixel) - clipLeft;
                  } else {
                    clipLeft = Math.floor(clip.startSample / spp);
                    width = clipPixelWidth(clip.startSample, clip.durationSamples, spp);
                  }
                  // Per-segment waveform rendering for variable tempo.
                  // Uses base-scale (128) peaks directly — segments handle stretching,
                  // so no BPM-dependent intermediate resampling needed.
                  let clipSegments: WaveformSegment[] | undefined;
                  let segmentChannels: Peaks[] | undefined;
                  if (this.scaleMode === 'beats' && this.secondsToTicks) {
                    const audioBuffer = this._clipBuffers.get(clip.id);
                    const basePeaks = audioBuffer
                      ? this._peakPipeline.getBaseScalePeaks(
                          audioBuffer,
                          this.mono,
                          clip.offsetSamples,
                          clip.durationSamples
                        )
                      : null;
                    if (basePeaks) {
                      const baseScale = basePeaks.scale;
                      segmentChannels = basePeaks.peaks.data;
                      const MIN_RENDER_STEP = 80;
                      const stepTicks = Math.max(MIN_RENDER_STEP, Math.ceil(this.ticksPerPixel));
                      const startSec =
                        clip.startTick !== undefined
                          ? this._ticksToSeconds(clip.startTick)
                          : clip.startSample / sr;
                      const clipOffsetSec = clip.offsetSamples / sr;
                      const segStartTick =
                        clip.startTick !== undefined
                          ? clip.startTick
                          : this._secondsToTicks(startSec);
                      const endTick = this._secondsToTicks(startSec + clip.durationSamples / sr);
                      clipSegments = [];
                      for (let tick = segStartTick; tick < endTick; tick += stepTicks) {
                        const segEndTick = Math.min(tick + stepTicks, endTick);
                        const segStartAudioSec =
                          this._ticksToSeconds(tick) - startSec + clipOffsetSec;
                        const segEndAudioSec =
                          this._ticksToSeconds(segEndTick) - startSec + clipOffsetSec;
                        // Peak indices at base scale (128) — clamped to valid range.
                        const segStartSample = Math.round(segStartAudioSec * sr);
                        const segEndSample = Math.round(segEndAudioSec * sr);
                        const totalPeaks = clip.durationSamples / baseScale;
                        clipSegments.push({
                          peakStart: Math.max(0, (segStartSample - clip.offsetSamples) / baseScale),
                          peakEnd: Math.min(
                            totalPeaks,
                            (segEndSample - clip.offsetSamples) / baseScale
                          ),
                          pixelStart: (tick - segStartTick) / this.ticksPerPixel,
                          pixelEnd: (segEndTick - segStartTick) / this.ticksPerPixel,
                        });
                      }
                    }
                  }
                  const channels: Peaks[] = segmentChannels ??
                    peakData?.data ?? [new Int16Array(0)];
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
                          .segments=${clipSegments}
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
