import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type {
  ArrangementTrack,
  AudioClip,
  ClipTrack,
  FadeType,
  TrackKind,
  LoadingClip,
  Peaks,
  PeakData,
  SnapTo,
  MeterEntry,
  SpectrogramConfig,
  ColorMapValue,
} from '@waveform-playlist/core';
import type {
  StoredTrackDescriptor,
  TrackExtras,
  TrackRenderMode,
  TrackWithId,
  ClipDescriptor,
  DomClipDescriptor,
  DropClipDescriptor,
  TrackConfig,
  ClipConfig,
} from '../types';
import { isDomClip, normalizeRenderMode, trackDescriptorRenderMode } from '../types';
import {
  createMixerGesture,
  clipPixelWidth,
  isLoadingClip,
  trackKind,
} from '@waveform-playlist/core';
import { PeakPipeline } from '../workers/peakPipeline';
import type { DawTrackElement } from './daw-track';
import type { DawClipElement } from './daw-clip';
import type { DawPlayheadElement } from './daw-playhead';
import type { WaveformSegment } from './daw-waveform';
// Register the visual child elements this editor's template always renders.
// The shadow template emits <daw-playhead>/<daw-waveform>/<daw-ruler> directly,
// so the editor must guarantee they're defined. Without these side-effect
// imports, importing daw-editor alone (not the package barrel) leaves the
// elements un-upgraded — querySelector returns generic HTMLElements, and calls
// like playhead.setPosition() throw "is not a function". (Module caching +
// @customElement make this safe to import here and from the index barrel.)
import './daw-playhead';
import './daw-waveform';
import './daw-ruler';
import { createArrangement, PlaylistEngine } from '@waveform-playlist/engine';
import type {
  Arrangement,
  EngineState,
  MixerChangeOptions,
  PlayoutAdapter,
  TrackMixerValues,
} from '@waveform-playlist/engine';
import { DEFAULT_TRACK_MIX, clampNumber, mixOfElement, mixOfTrack } from '../utils/track-mix';
import '../elements/daw-track-controls';
import '../elements/daw-grid';
import { hostStyles, clipStyles } from '../styles/theme';
import { ViewportController } from '../controllers/viewport-controller';
import { AudioResumeController } from '../controllers/audio-resume-controller';
import { RecordingController } from '../controllers/recording-controller';
import type { RecordingOptions } from '../controllers/recording-controller';
import { AnnotationController, ANNOTATION_LANE_HEIGHT } from '../controllers/annotation-controller';
import type { DawAnnotationTrackElement } from './daw-annotation-track';
import { SpectrogramController } from '../controllers/spectrogram-controller';
import { PointerHandler } from '../interactions/pointer-handler';
import { ClipPointerHandler } from '../interactions/clip-pointer-handler';
import { AnnotationDragHandler } from '../interactions/annotation-drag';
import { TrackReorderHandler } from '../interactions/track-reorder-handler';
import type {
  DawSelectionDetail,
  DawTrackIdDetail,
  DawTrackControlDetail,
  DawTrackUpdateDetail,
  DawTrackErrorDetail,
  DawTrackReorderDetail,
  DawTrackReorderGrabDetail,
  DawClipErrorDetail,
  DawClipIdDetail,
  DawRecordingErrorDetail,
  DawErrorDetail,
  DawTimeFormatChangeDetail,
  LoadFilesResult,
} from '../events';
import {
  isTimeDisplayFormat,
  TIME_DISPLAY_FORMATS,
  type TimeDisplayFormat,
} from '../utils/time-display-format';
import { loadFiles as loadFilesImpl } from '../interactions/file-loader';
import {
  loadMidiImpl,
  type MidiLoaderHost,
  type MidiLoadOptions,
  type MidiLoadResult,
} from '../interactions/midi-loader';
import { addRecordedClip } from '../interactions/recording-clip';
import { splitAtPlayhead as performSplitAtPlayhead } from '../interactions/split-handler';
import { syncPeaksForChangedClips } from '../interactions/clip-peak-sync';
import {
  buildArrangementTrack,
  buildLoadingClip,
  buildMidiClip,
  clipKindError,
  clipSourceOf,
  entryIndex,
  isMidiDescriptor,
  validMidiNotes,
} from '../interactions/track-entry';
import { LoadAnnouncer } from '../interactions/load-announcer';
import { clipSeconds, loadedTrack, mixOf } from '../interactions/arrangement-view';
import { normalizeHandedIn, swapArrangement } from '../interactions/arrangement-swap';
import {
  refreshLinkStates,
  type ClipLinkValues,
  type LinkState,
  type TrackLinkValues,
} from '../interactions/element-links';
import { EffectsManager } from '../effects/effects-manager';
import { exportAudioImpl } from '../interactions/export-audio';
import type { ExportOptions } from '../interactions/export-audio';
import type { EffectState, SerializedEffectEntry } from '../effects/types';
import { loadWaveformDataFromUrl } from '../interactions/peaks-loader';
import { extractPeaks } from '../workers/waveformDataUtils';
import { ScrollSyncController } from '../controllers/scroll-sync-controller';
import { PlaybackAnimationController } from '../controllers/playback-animation-controller';
import { installCommand } from '../utils/install-command';

/** Height of the ruler band — single source for the ruler element and the header row. */
const RULER_HEIGHT = 30;

/**
 * A track registered and not in the arrangement yet (#848): a `<daw-track>`
 * (read when it enters, with clips `addClip()` gave it meanwhile), or a
 * declaration with no element (`addTrack()`, a dropped file) and its mix.
 */
type PendingEntry =
  | { element: DawTrackElement; extraClips: DropClipDescriptor[] }
  | { descriptor: StoredTrackDescriptor; mix: TrackMixerValues };

/** The values a clip change is computed from: the live values with the request applied (#848). */
type ClipUpdateValues = ClipLinkValues & { src: string };

/** What a row of the template reads about its track (#848: from the arrangement and the extras). */
interface RowInfo {
  name: string;
  kind: TrackKind;
  renderMode: TrackRenderMode;
}

/** The descriptor of a clip from `addTrack()` / `addClip()` config: no element, a new id. */
function clipDescriptorOf(config: ClipConfig): DropClipDescriptor & { clipId: string } {
  return {
    kind: 'drop',
    clipId: crypto.randomUUID(),
    src: config.src ?? '',
    peaksSrc: config.peaksSrc ?? '',
    start: config.start ?? 0,
    duration: config.duration ?? 0,
    offset: config.offset ?? 0,
    gain: config.gain ?? 1,
    name: config.name ?? '',
    fadeIn: config.fadeIn ?? 0,
    fadeOut: config.fadeOut ?? 0,
    fadeType: config.fadeType ?? 'linear',
    midiNotes: config.midiNotes ?? null,
    midiChannel: config.midiChannel ?? null,
    midiProgram: config.midiProgram ?? null,
  };
}

/** The extras of a track entering with this declaration: every clip it takes, with its `peaks-src`. */
function extrasOf(descriptor: StoredTrackDescriptor): TrackExtras {
  return {
    kind: descriptor.kind,
    renderMode: descriptor.renderMode,
    spectrogramConfig: descriptor.spectrogramConfig,
    src: descriptor.src,
    peaksSrc: new Map(
      descriptor.clips.flatMap((c) => (c.clipId ? [[c.clipId, c.peaksSrc] as const] : []))
    ),
  };
}

// Built when thrown, so a bundler can drop it with the code that throws it.
const noAdapterError = (): string =>
  'No PlayoutAdapter set on <daw-editor>. ' +
  'Set editor.adapter before use.\n\n' +
  '  // Option 1: Native Web Audio (no Tone.js)\n' +
  '  ' +
  installCommand('@dawcore/transport') +
  '\n' +
  "  import { NativePlayoutAdapter } from '@dawcore/transport';\n" +
  '  editor.adapter = new NativePlayoutAdapter(new AudioContext());\n\n' +
  '  // Option 2: Tone.js (effects, MIDI synths)\n' +
  '  ' +
  installCommand('@waveform-playlist/playout') +
  '\n' +
  "  import { createToneAdapter } from '@waveform-playlist/playout';\n" +
  '  editor.adapter = createToneAdapter();';

@customElement('daw-editor')
export class DawEditorElement extends LitElement implements MidiLoaderHost {
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
          ' spp clamped to the peak floor (' +
          this._minSamplesPerPixel +
          ' spp) — peaks for the loaded audio (worker-generated or pre-computed) ' +
          'can only render at or above that scale'
      );
    }
    this._samplesPerPixel = clamped;
    this.requestUpdate('samplesPerPixel', old);
  }
  private _samplesPerPixel = 1024;

  /** Raise the zoom floor and re-clamp the LIVE samplesPerPixel when it's
   * now below the floor. Peaks can only be extracted at >= the floor scale —
   * the setter alone clamps only FUTURE sets, so without the re-clamp an
   * already-finer spp keeps sizing clip containers while the waveforms
   * render at the coarser scale: half/quarter width, misaligned against the
   * ruler and playhead. */
  _raiseZoomFloor(scale: number): void {
    if (!Number.isFinite(scale) || scale <= 0) return;
    if (scale > this._minSamplesPerPixel) {
      this._minSamplesPerPixel = scale;
    }
    if (this._samplesPerPixel < this._minSamplesPerPixel) {
      this.samplesPerPixel = this._minSamplesPerPixel; // setter warns + requestUpdate
    }
  }

  /** Recompute the floor from the surviving cached scales (track removal /
   * load cancellation / preview cleanup). Usually LOWERS the floor, freeing
   * finer zoom — but a buffer whose scale never raised the floor (or a mix
   * of scales) can raise it above the live spp, so re-clamp like
   * _raiseZoomFloor. Never mutate _minSamplesPerPixel directly. */
  private _recomputeZoomFloor(): void {
    this._minSamplesPerPixel = this._peakPipeline.getMaxCachedScale(this._clipBuffers);
    if (this._minSamplesPerPixel > 0 && this._samplesPerPixel < this._minSamplesPerPixel) {
      this.samplesPerPixel = this._minSamplesPerPixel;
    }
  }

  private _timeFormat: TimeDisplayFormat = 'hh:mm:ss.sss';

  /**
   * Time display format used by <daw-time-display> and (future, #463) the
   * selection inputs. Lives on the editor — the target element owns the
   * state, the transport controls reflect it (native-form style).
   */
  @property({ attribute: 'time-format', reflect: true, noAccessor: true })
  get timeFormat(): TimeDisplayFormat {
    return this._timeFormat;
  }
  set timeFormat(value: TimeDisplayFormat) {
    if (!isTimeDisplayFormat(value)) {
      console.warn(
        '[dawcore] timeFormat: invalid format "' +
          String(value) +
          '" ignored. Valid formats: ' +
          TIME_DISPLAY_FORMATS.join(', ')
      );
      // Self-heal the DOM: a rejected attribute value would otherwise stick
      // (reflection never runs for a rejected set), leaving attribute and
      // property permanently divergent.
      if (
        this.hasAttribute('time-format') &&
        this.getAttribute('time-format') !== this._timeFormat
      ) {
        this.setAttribute('time-format', this._timeFormat);
      }
      return;
    }
    if (value === this._timeFormat) return;
    const old = this._timeFormat;
    this._timeFormat = value;
    this.requestUpdate('timeFormat', old);
    this.dispatchEvent(
      new CustomEvent<DawTimeFormatChangeDetail>('daw-time-format-change', {
        bubbles: true,
        composed: true,
        detail: { format: value },
      })
    );
  }

  /** Set the time display format. Sugar over the `timeFormat` property. */
  setTimeFormat(format: TimeDisplayFormat): void {
    this.timeFormat = format;
  }

  @property({ type: Number, attribute: 'wave-height' }) waveHeight = 128;
  @property({ type: Boolean }) timescale = false;
  @property({ type: Boolean }) mono = false;
  @property({ type: Number, attribute: 'bar-width' }) barWidth = 1;
  @property({ type: Number, attribute: 'bar-gap' }) barGap = 0;
  @property({ type: Boolean, attribute: 'rounded-bars' }) roundedBars = false;
  @property({ type: Boolean, attribute: 'file-drop' }) fileDrop = false;
  @property({ type: Boolean, attribute: 'clip-headers' }) clipHeaders = false;
  /** Scale each clip's drawn waveform by its `gain` (clamped to the channel
   *  height), so levelled clips look the way they sound. Off by default:
   *  waveforms show source level. Draw-time only — no peak regeneration. */
  @property({ type: Boolean, attribute: 'gain-scaled-waveforms' }) gainScaledWaveforms = false;
  @property({ type: Number, attribute: 'clip-header-height' }) clipHeaderHeight = 20;
  @property({ type: Boolean, attribute: 'interactive-clips' }) interactiveClips = false;
  /**
   * Disable the end-of-timeline auto-stop — the transport rolls until an
   * explicit stop/pause (DAW style). Implies the fill-viewport layout.
   * Recording sessions suppress the auto-stop automatically, so recording
   * UIs usually want `fill-viewport` instead. Parity with the React
   * provider's `indefinitePlayback` prop.
   */
  @property({ type: Boolean, attribute: 'indefinite-playback' }) indefinitePlayback = false;
  /**
   * When true, the timeline fills the visible viewport even if total clip
   * duration is less (layout only — playback still auto-stops at the end).
   * Lets the ruler render before any audio is loaded — useful for empty
   * editors and recording UIs. In beats mode the 32-bar floor already
   * provides this; this attribute controls the temporal mode. Parity with
   * the React provider's `fillViewport` prop.
   */
  @property({ type: Boolean, attribute: 'fill-viewport' }) fillViewport = false;
  /**
   * Enable vertical track reordering UI: grip + move up/down buttons on each
   * track's controls. Reordering is purely organizational.
   */
  @property({ type: Boolean, attribute: 'track-reordering' }) trackReordering = false;
  /**
   * Default spectrogram FFT/render config inherited by tracks with
   * `render-mode="spectrogram"` that do not set their own. Wired into the
   * orchestrator by `SpectrogramController` in Task 14.
   */
  @property({ attribute: false, noAccessor: true })
  get spectrogramConfig(): SpectrogramConfig | null {
    return this._spectrogramConfig;
  }
  set spectrogramConfig(value: SpectrogramConfig | null) {
    const old = this._spectrogramConfig;
    this._spectrogramConfig = value;
    this._spectrogramController?.setEditorConfig(value);
    this.requestUpdate('spectrogramConfig', old);
  }
  private _spectrogramConfig: SpectrogramConfig | null = null;

  /**
   * Default color map for spectrogram tracks. Tracks may override via
   * their own per-track property in a future iteration. Separate from
   * `spectrogramConfig` because `ColorMapValue` is not part of the
   * `SpectrogramConfig` shape.
   */
  @property({ attribute: false, noAccessor: true })
  get spectrogramColorMap(): ColorMapValue | null {
    return this._spectrogramColorMap;
  }
  set spectrogramColorMap(value: ColorMapValue | null) {
    const old = this._spectrogramColorMap;
    this._spectrogramColorMap = value;
    this._spectrogramController?.setEditorColorMap(value);
    this.requestUpdate('spectrogramColorMap', old);
  }
  private _spectrogramColorMap: ColorMapValue | null = null;

  private _ensureSpectrogramController(): SpectrogramController {
    if (!this._spectrogramController) {
      this._spectrogramController = new SpectrogramController(
        this,
        () =>
          new Worker(new URL('@dawcore/spectrogram/worker/spectrogram.worker', import.meta.url), {
            type: 'module',
          })
      );
      if (this._spectrogramConfig) {
        this._spectrogramController.setEditorConfig(this._spectrogramConfig);
      }
      if (this._spectrogramColorMap) {
        this._spectrogramController.setEditorColorMap(this._spectrogramColorMap);
      }
    }
    return this._spectrogramController;
  }

  /** Called by <daw-spectrogram> after transferControlToOffscreen. */
  _spectrogramRegisterCanvas(reg: {
    canvasId: string;
    canvas: OffscreenCanvas;
    clipId: string;
    trackId: string;
    channelIndex: number;
    chunkIndex: number;
    globalPixelOffset: number;
    widthPx: number;
    heightPx: number;
  }): void {
    this._ensureSpectrogramController().registerCanvas(reg);
  }

  /** Called by <daw-spectrogram> on chunk unmount / element disconnect. */
  _spectrogramUnregisterCanvas(canvasId: string): void {
    this._spectrogramController?.unregisterCanvas(canvasId);
  }

  /**
   * Forward a clip's AudioBuffer to the spectrogram controller if the parent
   * track is in spectrogram render-mode. Eagerly creates the controller via
   * `_ensureSpectrogramController` so the audio data is queued for the first
   * render — even if no canvases have been registered yet.
   */
  private _maybeRegisterSpectrogramClipAudio(trackId: string, clip: AudioClip): void {
    if (this._renderModeOf(trackId) !== 'spectrogram') return;
    // Read the buffer off the clip itself — `_clipBuffers` is mutated in-place
    // by `cleanupOrphanedClipData` during concurrent track loading and may
    // briefly miss this clip even though the clip object still holds the
    // buffer reference.
    const buffer = clip.audioBuffer ?? this._clipBuffers.get(clip.id);
    if (!buffer) return;
    const channelData: Float32Array[] = [];
    for (let i = 0; i < buffer.numberOfChannels; i++) {
      channelData.push(buffer.getChannelData(i));
    }
    this._ensureSpectrogramController().registerClipAudio({
      clipId: clip.id,
      trackId,
      channelData,
      sampleRate: buffer.sampleRate,
      durationSamples: clip.durationSamples,
      offsetSamples: clip.offsetSamples,
    });
  }
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
    // Forward to engine (which forwards to adapter's Transport) — unless the
    // consumer provided tick callbacks, in which case the external tempo map
    // is authoritative and bpm is display/grid-only (#407).
    if (this._engine && !this._hasTickCallbacks) {
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
  /** Optional tempo-aware conversion: seconds → PPQN ticks. When provided
   *  together with ticksToSeconds, enables variable tempo AND makes `bpm`
   *  display/grid-only (no engine/adapter tempo forwarding — #407). */
  @property({ attribute: false })
  secondsToTicks?: (seconds: number) => number;
  /** Optional tempo-aware conversion: PPQN ticks → seconds. Required alongside
   *  secondsToTicks — see that property for the variable-tempo and bpm
   *  display-only semantics enabled when both are set (#407). */
  @property({ attribute: false })
  ticksToSeconds?: (ticks: number) => number;
  /** True when the consumer provided BOTH tick conversion callbacks — the
   *  external tempo map is authoritative and `bpm` is display/grid-only (#407). */
  get _hasTickCallbacks(): boolean {
    return !!(this.secondsToTicks && this.ticksToSeconds);
  }
  /**
   * Sample rate: the adapter's AudioContext rate. Without an adapter (after a
   * disconnect let it go), the rate of the loaded clips the arrangement holds,
   * else 48000. Decoded audio is at the context's rate, so the two agree.
   */
  get sampleRate(): number {
    return this._externalAdapter?.audioContext.sampleRate ?? this._loadedClipSampleRate() ?? 48000;
  }
  private _loadedClipSampleRate(): number | null {
    for (const track of this._arrangement.getTracks()) {
      for (const clip of track.clips) {
        if ('sampleRate' in clip && typeof clip.sampleRate === 'number') return clip.sampleRate;
      }
    }
    return null;
  }
  /**
   * The editor's own arrangement (#848): the one owner of the tracks, the
   * clips, the mix, the undo history and loading of what the `<daw-track>`
   * children declare. Made with the editor, kept across a disconnect.
   */
  readonly _ownArrangement: Arrangement = createArrangement();
  /** An arrangement the app handed in (`editor.arrangement`), played alone; null: the own one. */
  _handedIn: Arrangement | null = null;
  /** The arrangement played now: a handed-in one, else the editor's own. */
  get _arrangement(): Arrangement {
    return this._handedIn ?? this._ownArrangement;
  }
  /**
   * The arrangement the editor plays (#848 PR 3): one handed in by the app,
   * or else the editor's own, whose content the `<daw-track>` children
   * declare. Setting one plays it alone, like `video.srcObject`: the
   * children are not added to it and show `:state(detached)` while it is
   * set; `null` (or the editor's own) goes back to the own arrangement with
   * what it held. A swap keeps the adapter: playback stops, a new engine is
   * built on the new arrangement. Refused (with a warning) during a take.
   * The editor never disposes or clears an arrangement it was handed.
   * Throws a `TypeError` for a value that is not an arrangement.
   */
  get arrangement(): Arrangement {
    return this._arrangement;
  }
  set arrangement(value: Arrangement | null) {
    swapArrangement(this, normalizeHandedIn(value, this._ownArrangement));
  }
  /** Sends the load events, read from the arrangement played (#848; a new one per swap). */
  private _announcer = new LoadAnnouncer((event) => this.dispatchEvent(event));
  /** Stops following the arrangement played (its sources and its tracks). */
  private _unfollow: () => void = () => {};
  constructor() {
    super();
    this._follow(this._ownArrangement);
  }
  /**
   * Follow the arrangement played: a source that fails changes no track,
   * only `sources` tells of it (the events, the failed look); the elements'
   * link states follow its tracks (a structural change only, not every
   * mixer frame).
   */
  private _follow(arrangement: Arrangement): void {
    this._unfollow();
    const stopSources = arrangement.sources.subscribe(() => {
      this._announceLoading();
      this.requestUpdate();
    });
    let tracksVersion = arrangement.tracksVersion;
    const stopTracks = arrangement.subscribe(() => {
      if (arrangement.tracksVersion === tracksVersion) return;
      tracksVersion = arrangement.tracksVersion;
      this._refreshLinkStates();
    });
    this._unfollow = () => {
      stopSources();
      stopTracks();
    };
  }
  // --- The swap (interactions/arrangement-swap.ts) ---
  /** @internal */
  _releaseEngine(): void {
    if (!this._engine) return;
    try {
      this._engine.dispose({ keepAdapter: true });
    } catch (err) {
      console.warn('[dawcore] Error releasing the engine: ' + String(err));
    }
    this._engine = null;
  }
  /** @internal */
  _disposeTrackChain(trackId: string): void {
    this._effectsManager?.disposeTrackChain(trackId);
  }
  /** @internal */
  _playArrangement(next: Arrangement | null): void {
    this._handedIn = next;
    // A new load cycle: every track of the arrangement now played is announced.
    this._announcer = new LoadAnnouncer((event) => this.dispatchEvent(event));
    this._follow(this._arrangement);
    this._currentTime = 0;
    this._stopPlayhead();
    this._recomputeDuration();
    this._refreshLinkStates();
    this._announceLoading();
    this.requestUpdate();
  }
  /** @internal */
  _buildEngineIfReady(): void {
    if (this._externalAdapter && this.isConnected && !this._engine) this._buildEngineReporting();
  }
  /**
   * Ids of tracks registered (a `<daw-track>` connected, a file dropped) and
   * not yet in the arrangement: they enter at the next flush, once there is
   * an engine (#848).
   */
  private _entryQueue: string[] = [];
  private _entryFlushScheduled = false;
  /**
   * Clips an `addClip()` is waiting for, with their track and the way to
   * reject the call: a removal of the clip or of its track before the clip
   * loads settles it here, without a public event (#917).
   */
  private _awaitedClips = new Map<string, { trackId: string; reject: (error: Error) => void }>();
  /** Reject the `addClip()` calls waiting for clips that match `which`. */
  private _rejectAwaitedClips(
    which: (clipId: string, trackId: string) => boolean,
    message: string
  ): void {
    for (const [clipId, awaited] of [...this._awaitedClips]) {
      if (which(clipId, awaited.trackId)) awaited.reject(new Error(message));
    }
  }
  /** `.dat` peaks drawn for a clip still loading, by clip id (an editor-only render cache). */
  @state() _previewPeaks: Map<string, PeakData> = new Map();
  /** The `.dat` data of those clips, handed to the peak pipeline when the audio arrives. */
  private _previewWaveforms = new Map<string, import('waveform-data').default>();
  /**
   * Tracks registered and not in the arrangement yet, with their declaration
   * (#848): a `<daw-track>` is read when it enters (its clips and attributes
   * as they are then); a dropped file carries its descriptor. The one place a
   * track's state lives until it enters.
   */
  _pending: Map<string, PendingEntry> = new Map();
  /** What the arrangement has no field for, by track id (#848; render mode, `peaks-src`). */
  @state() _extras: Map<string, TrackExtras> = new Map();
  @state() _peaksData: Map<string, PeakData> = new Map();
  @state() _isPlaying = false;
  @state() _duration = 0;
  @state() _selectedTrackId: string | null = null;
  @state() _dragOver = false;
  // Not @state — updated directly to avoid 60fps Lit re-renders
  _selectionStartTime = 0;
  _selectionEndTime = 0;
  _currentTime = 0;
  // Bounded-playback watermark for the current play(start, end) call
  // (selection/annotation playback). Adapters with the engine's
  // onPlaybackEnded hook (Tone, and native since #636) report their
  // endTime self-stop through the engine's `stop` event; this watermark is
  // the fallback check in the _startPlayhead loop for adapters without the
  // hook, same pattern as the whole-track _duration check.
  _activePlayEndTime: number | null = null;
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
    if (this._effectsManager) {
      // Chains are wired into the previous adapter's transport/graph and
      // cannot be migrated. Sever them there BEFORE the swap so the old
      // graph is left clean; consumers re-add effects on the new adapter.
      console.warn(
        '[dawcore] adapter replaced — existing effect chains were disposed. ' +
          'Re-add effects on the new adapter.'
      );
      this._effectsManager.disposeAll();
      this._effectsManager = null;
    }
    this._externalAdapter = value;
    // The engine is built as soon as the editor is connected with an adapter (#848).
    if (value && this.isConnected && !this._engine) this._buildEngineReporting();
  }
  get adapter(): PlayoutAdapter | null {
    return this._externalAdapter;
  }
  private _externalAdapter: PlayoutAdapter | null = null;

  // --- Effects (master chain; per-track chains delegated from <daw-track>) ---

  private _effectsManager: EffectsManager | null = null;

  private get _effects(): EffectsManager {
    if (!this._effectsManager) {
      this._effectsManager = new EffectsManager(() => this._externalAdapter, this);
    }
    return this._effectsManager;
  }

  /**
   * Run a registered effect type's async `prepare` hook (e.g. an
   * `audioWorklet.addModule`) on this editor's audio context. Await it before
   * the synchronous `addEffect`/`addTrackEffect` for effect types that define
   * one; `setEffectsState()` and `exportAudio()` run it themselves. Idempotent
   * per context, and a no-op for types without a hook.
   */
  prepareEffect(type: string): Promise<void> {
    return this._effects.prepareEffect(type);
  }

  /** Master effects chain — inserted between the master bus and the destination. */
  addEffect(type: string, params?: Record<string, number>): string {
    return this._effects.addMasterEffect(type, params);
  }

  removeEffect(effectId: string): void {
    this._effects.masterOp('remove', effectId);
  }

  setEffectParams(effectId: string, params: Record<string, number>): void {
    this._effects.masterOp('setParams', effectId, params);
  }

  setEffectBypassed(effectId: string, bypassed: boolean): void {
    this._effects.masterOp('setBypassed', effectId, bypassed);
  }

  moveEffect(effectId: string, newIndex: number): void {
    this._effects.masterOp('move', effectId, newIndex);
  }

  get effects(): EffectState[] {
    return this._effectsManager?.masterEffects() ?? [];
  }

  /** Load a WAM plugin (via the optional @dawcore/wam peer) into the master chain. */
  addWamPlugin(url: string, initialState?: unknown): Promise<string> {
    return this._effects.addMasterWamPlugin(url, initialState);
  }

  /**
   * Compile Faust DSP source in the browser (via the optional @dawcore/faust
   * peer) and add the resulting WAM to the master chain. Compile errors keep
   * their Faust line/column diagnostics and leave the chain untouched.
   */
  addFaustEffect(dspCode: string, options?: { name?: string }): Promise<string> {
    return this._effects.addMasterFaustEffect(dspCode, options);
  }

  /**
   * Open (lazily creating) the GUI for a master-chain effect into a
   * consumer-provided container. WAM plugins mount their own GUI; plugins
   * without one — and native effects — get the generic parameter panel from
   * @dawcore/wam. The element is cached: closeEffectGui hides it without
   * interrupting audio, reopening remounts the same element.
   */
  openEffectGui(effectId: string, container: HTMLElement): Promise<HTMLElement> {
    return this._effects.openMasterEffectGui(effectId, container);
  }

  /** Hide a master-chain effect's GUI (cached for reopen — never destroys). */
  closeEffectGui(effectId: string): void {
    this._effects.closeEffectGui(effectId);
  }

  /** Snapshot the master chain in its persisted form (see dawcore README). */
  getEffectsState(): Promise<SerializedEffectEntry[]> {
    return this._effectsManager?.getMasterEffectsState() ?? Promise.resolve([]);
  }

  /** Replace the master chain with a persisted snapshot. */
  setEffectsState(entries: SerializedEffectEntry[]): Promise<void> {
    return this._effects.setMasterEffectsState(entries);
  }

  /**
   * Render the session offline through all effect chains (per-track +
   * master), including WAM plugins (re-instantiated on the offline context
   * with their live state). Returns the rendered AudioBuffer.
   */
  exportAudio(options?: ExportOptions): Promise<AudioBuffer> {
    return exportAudioImpl(
      {
        effectiveSampleRate: this.effectiveSampleRate,
        duration: this._duration,
        tracks: this._loadedTracks(),
        masterVolume: this._engine?.getState().masterVolume ?? 1,
        getMasterEffectsState: () => this.getEffectsState(),
        getTrackEffectsState: (trackId) => this.getTrackEffectsState(trackId),
      },
      options
    );
  }

  // --- Per-track effects API (public, keyed by trackId) ---
  // Mirrors the master-chain methods above and the <daw-track> element methods,
  // but addresses a track by id so element-less tracks (drag-dropped, or
  // programmatic tracks the consumer doesn't hold an element for) can carry
  // their own insert chain. Effect events dispatch from the track's <daw-track>
  // element when one exists, else from the editor (see _trackEventTarget).

  /** Add a native registry effect to a track's chain. */
  addTrackEffect(trackId: string, type: string, params?: Record<string, number>): string {
    return this._effects.addTrackEffect(trackId, this._trackEventTarget(trackId), type, params);
  }

  /** Snapshot of a track's effect chain (empty array for an unknown track). */
  trackEffects(trackId: string): EffectState[] {
    return this._effectsManager?.trackEffects(trackId) ?? [];
  }

  removeTrackEffect(trackId: string, effectId: string): void {
    this._effects.trackOp(trackId, this._trackEventTarget(trackId), 'remove', effectId);
  }

  setTrackEffectParams(trackId: string, effectId: string, params: Record<string, number>): void {
    this._effects.trackOp(trackId, this._trackEventTarget(trackId), 'setParams', effectId, params);
  }

  setTrackEffectBypassed(trackId: string, effectId: string, bypassed: boolean): void {
    this._effects.trackOp(
      trackId,
      this._trackEventTarget(trackId),
      'setBypassed',
      effectId,
      bypassed
    );
  }

  moveTrackEffect(trackId: string, effectId: string, newIndex: number): void {
    this._effects.trackOp(trackId, this._trackEventTarget(trackId), 'move', effectId, newIndex);
  }

  /** Load a WAM plugin (via the optional @dawcore/wam peer) into a track's chain. */
  addTrackWamPlugin(trackId: string, url: string, initialState?: unknown): Promise<string> {
    return this._effects.addTrackWamPlugin(
      trackId,
      this._trackEventTarget(trackId),
      url,
      initialState
    );
  }

  /** Compile Faust DSP (via the optional @dawcore/faust peer) into a track's chain. */
  addTrackFaustEffect(
    trackId: string,
    dspCode: string,
    options?: { name?: string }
  ): Promise<string> {
    return this._effects.addTrackFaustEffect(
      trackId,
      this._trackEventTarget(trackId),
      dspCode,
      options
    );
  }

  /** Open (lazily creating) the GUI for a track-chain effect into a container. */
  openTrackEffectGui(
    trackId: string,
    effectId: string,
    container: HTMLElement
  ): Promise<HTMLElement> {
    return this._effects.openTrackEffectGui(
      trackId,
      this._trackEventTarget(trackId),
      effectId,
      container
    );
  }

  /** Hide a track-chain effect's GUI (cached for reopen — never destroys). */
  closeTrackEffectGui(_trackId: string, effectId: string): void {
    this._effects.closeEffectGui(effectId);
  }

  /** Snapshot a track's chain in its persisted form (see dawcore README). */
  getTrackEffectsState(trackId: string): Promise<SerializedEffectEntry[]> {
    return this._effectsManager?.getTrackEffectsState(trackId) ?? Promise.resolve([]);
  }

  /** Replace a track's chain from a persisted snapshot. */
  setTrackEffectsState(trackId: string, entries: SerializedEffectEntry[]): Promise<void> {
    return this._effects.setTrackEffectsState(trackId, this._trackEventTarget(trackId), entries);
  }

  /**
   * Event-dispatch source for a per-track effect op: the track's `<daw-track>`
   * element when one exists (so `daw-effect-*` bubble from it exactly as the
   * element-method path does), else the editor itself for element-less tracks
   * (drag-dropped / programmatic). Reads the `_trackElements` index the editor
   * already maintains across the track connect/remove lifecycle — O(1), and the
   * same resolution `removeTrack` uses — rather than re-querying the DOM per op.
   */
  private _trackEventTarget(trackId: string): EventTarget {
    return this._trackElements.get(trackId) ?? this;
  }

  get audioContext(): AudioContext {
    if (!this._externalAdapter) {
      throw new Error(noAdapterError());
    }
    return this._externalAdapter.audioContext;
  }
  _engine: PlaylistEngine | null = null;
  private _warnedMissingTicksToSeconds = false;
  private _warnedMissingSecondsToTicks = false;
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
  private _annotations = new AnnotationController(this);
  /** Last engine BPM seen by the statechange handler — re-derives tick
   * annotation seconds caches only when it actually changes. */
  private _lastAnnotationBpm: number | null = null;
  // Closures (not direct references) — _timeToPixels/_getPlayhead are
  // declared later in the class body; class-field init order would read
  // `undefined` for a direct reference here.
  private _playbackAnimation = new PlaybackAnimationController(this, {
    timeToPixels: (time) => this._timeToPixels(time),
    getPlayhead: () => this._getPlayhead(),
  });
  /**
   * True while a seek-while-playing stop+play transition is in flight.
   * Suppresses the transient settle dispatch from the engine 'stop' handler
   * (which would otherwise leak a backward-jumping daw-timeupdate at the
   * play-start position). Non-private: pointer-handler's seek path sets it.
   */
  _inSeekTransition = false;
  /**
   * True while `stop()` (the public API) is actively calling `this._engine.stop()`.
   * Suppresses the engine 'stop' handler's own `daw-stop` dispatch — `stop()`
   * dispatches its own, and without this guard a consumer-initiated stop would
   * fire `daw-stop` twice. See the engine 'stop' handler for the counterpart
   * engine-initiated case this flag does NOT suppress.
   */
  private _inConsumerStop = false;
  private _spectrogramController: SpectrogramController | null = null;
  private _clipPointer = new ClipPointerHandler(this);
  private _annotationDrag = new AnnotationDragHandler(this);
  private _trackReorderDrag = new TrackReorderHandler(this);
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

  /**
   * Returns true if the clip is a MIDI clip (has midiNotes).
   * Used by ClipPointerHandler to make trim handles inert for MIDI clips.
   * Returns false for unknown track/clip IDs (defensive).
   */
  isMidiClip(trackId: string, clipId: string): boolean {
    const clip = this._loadedClip(trackId, clipId);
    return clip?.midiNotes != null;
  }
  /** The arrangement's tracks as they are played: loaded clips, the current mix (#848). */
  _loadedTracks(): ClipTrack[] {
    const arrangement = this._arrangement;
    return arrangement
      .getTracks()
      .map((t) =>
        loadedTrack(
          t,
          arrangement.getMixer().get(t.id) ?? mixOfTrack(t as ClipTrack),
          arrangement.recordingTrackIds.has(t.id)
        )
      );
  }
  /** A loaded clip of a track of the arrangement, or undefined. */
  private _loadedClip(trackId: string, clipId: string): AudioClip | undefined {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    const clip = track?.clips.find((c) => c.id === clipId);
    return clip && !isLoadingClip(clip) ? clip : undefined;
  }

  private _pointer = new PointerHandler(this);
  private _viewport = (() => {
    const v = new ViewportController(this);
    v.scrollSelector = '.scroll-area';
    return v;
  })();
  private _scrollSync = (() => {
    const s = new ScrollSyncController(this);
    s.scrollSelector = '.scroll-area';
    // xTargetSelector, yTargetSelector, and wheelForwardSelector are kept
    // truthful by updated() — they start empty and are set before any scroll
    // is possible (updated() runs before paint on every reactive update).
    return s;
  })();

  static styles = [
    hostStyles,
    css`
      :host {
        display: flex;
        flex-direction: column;
        position: relative;
        background: var(--daw-background, #1a1a2e);
        overflow: hidden;
      }
      .header-row {
        display: flex;
        flex-shrink: 0;
      }
      .ruler-gap {
        flex-shrink: 0;
        width: var(--daw-controls-width, 180px);
      }
      .ruler-viewport {
        flex: 1;
        position: relative;
        overflow: hidden;
        cursor: text;
      }
      .ruler-content {
        will-change: transform;
      }
      .body {
        flex: 1;
        min-height: 0;
        display: flex;
      }
      .controls-viewport {
        flex-shrink: 0;
        width: var(--daw-controls-width, 180px);
        overflow: hidden;
      }
      .controls-column {
        will-change: transform;
      }
      .scroll-area {
        flex: 1;
        overflow: auto;
        overflow-anchor: none;
        min-height: var(--daw-min-height, 200px);
      }
      .timeline {
        position: relative;
        min-height: 100%;
        cursor: text;
      }
      .track-row {
        position: relative;
        box-sizing: border-box;
        background: var(--daw-track-background, #16213e);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
      .track-row.selected {
        background: rgba(99, 199, 95, 0.08);
      }
      .track-row[data-track-drag-source] {
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
      .annotation-lane {
        position: relative;
        box-sizing: border-box;
        border-bottom: 1px solid var(--daw-annotation-lane-border, rgba(255, 255, 255, 0.08));
        background: var(--daw-annotation-lane-background, rgba(0, 0, 0, 0.15));
        user-select: none;
        -webkit-user-drag: none;
      }
      .annotation-lane-spacer {
        box-sizing: border-box;
        border-bottom: 1px solid var(--daw-annotation-lane-border, rgba(255, 255, 255, 0.08));
        display: flex;
        align-items: center;
        overflow: hidden;
      }
      .annotation-lane-name {
        padding: 0 10px;
        font-size: 11px;
        color: var(--daw-controls-text, #e0d4c8);
        opacity: 0.8;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .annotation-box {
        position: absolute;
        top: 3px;
        bottom: 3px;
        overflow: hidden;
        display: flex;
        align-items: center;
        border: 1px solid var(--daw-annotation-box-border, #c49a6c);
        border-radius: 3px;
        background: var(--daw-annotation-box-background, rgba(196, 154, 108, 0.2));
        color: var(--daw-annotation-text-color, #e0d4c8);
        font-size: 11px;
        cursor: pointer;
      }
      .annotation-box.playing {
        box-shadow: inset 0 0 0 1px var(--daw-annotation-box-border, #c49a6c);
        background: var(--daw-annotation-playing-background, rgba(196, 154, 108, 0.32));
      }
      .annotation-box.active {
        background: var(--daw-annotation-active-background, rgba(196, 154, 108, 0.45));
      }
      .annotation-box-text {
        padding: 0 6px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        pointer-events: none;
      }
      .annotation-boundary {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 6px;
        cursor: ew-resize;
        flex-shrink: 0;
      }
      .annotation-boundary[data-edge='start'] {
        left: 0;
      }
      .annotation-boundary[data-edge='end'] {
        right: 0;
      }
    `,
    clipStyles,
  ];

  get effectiveSampleRate(): number {
    return this.sampleRate;
  }
  /**
   * In beats mode, derive samplesPerPixel from ticksPerPixel so that
   * clip positions, waveforms, and the tick-space grid all align.
   */
  get _renderSpp(): number {
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
  /** Clamp limit for annotation boundary edits. indefinite-playback removes the
   * end-of-timeline bound — annotations may extend past the audio (DAW-style
   * unbounded timeline); the shared boundary math treats Infinity as "no end cap". */
  get _annotationClampDuration(): number {
    return this.indefinitePlayback ? Infinity : this._duration;
  }
  private get _totalWidth(): number {
    if (this.scaleMode === 'beats') {
      const contentTicks = this._secondsToTicks(this._duration);
      // Floor at 32 bars so the grid is always visible — DAW convention.
      const [num] = this.timeSignature;
      const minTicks = 32 * num * this.ppqn;
      return Math.ceil(Math.max(contentTicks, minTicks) / this.ticksPerPixel);
    }
    // Extend past the natural (clip-derived) duration to cover annotations
    // that reach beyond the audio — DAW-style unbounded timeline (temporal
    // mode only; beats-mode annotation extent is a documented limitation).
    const naturalDuration = Math.max(this._duration, this._annotations.maxAnnotationEndSeconds);
    const naturalWidth = Math.ceil(
      (naturalDuration * this.effectiveSampleRate) / this.samplesPerPixel
    );
    if (this.indefinitePlayback || this.fillViewport) {
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
  /**
   * Every track: those in the arrangement, in its order, then those still
   * waiting to enter (#848). A `<daw-track>` whose track an Undo took out of
   * the arrangement is not listed (its descriptor stays for a Redo).
   */
  get tracks(): TrackWithId[] {
    const listed = this._arrangement.getTracks().map((track) => this._listTrack(track));
    const waiting = this._entryQueue.flatMap((trackId) => {
      const descriptor = this._pendingDescriptor(trackId);
      return descriptor ? [{ trackId, ...descriptor, ...this._mixOf(trackId) }] : [];
    });
    return [...listed, ...waiting];
  }
  /** A track of the arrangement as `editor.tracks` lists it: everything read from the arrangement. */
  private _listTrack(track: ArrangementTrack): TrackWithId {
    const extras = this._extras.get(track.id);
    const clipEls = new Map<string, DawClipElement>(
      [...(this._trackElements.get(track.id)?.querySelectorAll('daw-clip') ?? [])].map((el) => [
        (el as DawClipElement).clipId,
        el as DawClipElement,
      ])
    );
    const sr = this.effectiveSampleRate;
    const clips: ClipDescriptor[] = track.clips.map((clip) => {
      const el = clipEls.get(clip.id);
      const times = clipSeconds(clip, sr);
      const midi = isLoadingClip(clip) ? null : clip;
      const base = {
        src: typeof clip.src === 'string' ? clip.src : '',
        peaksSrc: extras?.peaksSrc.get(clip.id) ?? '',
        ...times,
        gain: clip.gain ?? 1,
        name: clip.name ?? '',
        fadeIn: el?.fadeIn ?? 0,
        fadeOut: el?.fadeOut ?? 0,
        fadeType: ((el?.fadeType as FadeType) ?? 'linear') as FadeType,
        midiNotes: midi?.midiNotes ?? null,
        midiChannel: midi?.midiChannel ?? null,
        midiProgram: midi?.midiProgram ?? null,
      };
      return el
        ? { kind: 'dom' as const, clipId: clip.id, ...base }
        : { kind: 'drop' as const, clipId: clip.id, ...base };
    });
    return {
      trackId: track.id,
      name: track.name ?? '',
      src: extras?.src ?? '',
      kind: trackKind(track),
      renderMode: this._renderModeOf(track.id),
      spectrogramConfig: extras?.spectrogramConfig ?? null,
      clips,
      ...this._mixOf(track.id),
    };
  }
  /** A pending track's declaration: its element's attributes and clips now, or its descriptor. */
  private _pendingDescriptor(trackId: string): StoredTrackDescriptor | null {
    const pending = this._pending.get(trackId);
    if (!pending) return null;
    if (!('element' in pending)) return pending.descriptor;
    const read = this._readTrackDescriptor(pending.element);
    return pending.extraClips.length > 0
      ? { ...read, clips: [...read.clips, ...pending.extraClips] }
      : read;
  }
  /** The extras a track of the arrangement takes when the editor has none for it. */
  private _defaultExtras(trackId: string): TrackExtras | null {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    if (!track) return null;
    const kind = trackKind(track);
    return {
      kind,
      renderMode: trackDescriptorRenderMode(kind, 'waveform'),
      src: '',
      peaksSrc: new Map(),
    };
  }
  /** How a track is drawn: its extras, else from its kind (an undo-restored track has none). */
  _renderModeOf(trackId: string): TrackRenderMode {
    const extras = this._extras.get(trackId);
    if (extras) return extras.renderMode;
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    return trackDescriptorRenderMode(track ? trackKind(track) : 'audio', 'waveform');
  }
  /**
   * A track's mix, from its one owner, the arrangement (#843), as the engine
   * plays it: its projection carries the take's mute, which `getMixer()`
   * leaves out (the stored mute comes back when the take ends). A track still
   * waiting to enter shows what its element declares.
   */
  _mixOf(trackId: string): TrackMixerValues {
    const mix = mixOf(this._arrangement, trackId);
    if (mix) return mix;
    const pending = this._pending.get(trackId);
    if (pending && 'mix' in pending) return pending.mix;
    const el = this._trackElements.get(trackId);
    return el ? mixOfElement(el) : DEFAULT_TRACK_MIX;
  }
  // --- Element links (#848, interactions/element-links.ts) ---
  /** @internal */
  _trackLinkState(trackId: string): LinkState {
    // While a handed-in arrangement is set, the children are not played (P7).
    if (this._handedIn && this._trackElements.has(trackId)) return 'detached';
    if (this._isEntered(trackId)) return 'live';
    return this._extras.has(trackId) && !this._pending.has(trackId) ? 'detached' : 'pending';
  }
  /** @internal */
  _clipLinkState(trackId: string, clipId: string): LinkState {
    const track = this._trackLinkState(trackId);
    if (track !== 'live') return track;
    const held = this._arrangement
      .getTracks()
      .find((t) => t.id === trackId)
      ?.clips.some((c) => c.id === clipId);
    if (held) return 'live';
    return this._extras.get(trackId)?.peaksSrc.has(clipId) ? 'detached' : 'pending';
  }
  /** @internal The stored mix (not a take's mute) and the name. */
  _trackValues(trackId: string): TrackLinkValues | null {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    const mix = this._arrangement.getMixer().get(trackId);
    if (!track || !mix) return null;
    return { ...mix, name: track.name ?? '' };
  }
  /** @internal */
  _clipValues(trackId: string, clipId: string): ClipLinkValues | null {
    const clip = this._arrangement
      .getTracks()
      .find((t) => t.id === trackId)
      ?.clips.find((c) => c.id === clipId);
    if (!clip) return null;
    const midi = isLoadingClip(clip) ? null : clip;
    return {
      ...clipSeconds(clip, this.effectiveSampleRate),
      gain: clip.gain ?? 1,
      name: clip.name ?? '',
      midiNotes: midi?.midiNotes ?? null,
      midiChannel: midi?.midiChannel ?? null,
      midiProgram: midi?.midiProgram ?? null,
    };
  }
  /** @internal A property or attribute set on a live `<daw-track>`: one undo step per field kind. */
  _requestTrackChange(trackId: string, partial: Partial<TrackLinkValues>): void {
    const { name, ...mix } = partial;
    if (Object.keys(mix).length > 0) this._writeMixFields(trackId, mix, this._taskGesture(trackId));
    if (name !== undefined) this._renameTrack(trackId, name || 'Untitled');
  }
  /** One gesture id per track for the rest of this task: mix sets made together are one step (#843). */
  private _taskGestures = new Map<string, string>();
  private _taskGesture(trackId: string): string {
    let id = this._taskGestures.get(trackId);
    if (!id) {
      id = createMixerGesture().id;
      this._taskGestures.set(trackId, id);
      if (this._taskGestures.size === 1) queueMicrotask(() => this._taskGestures.clear());
    }
    return id;
  }
  /** @internal A property or attribute set on a live `<daw-clip>`: one undo step. */
  _requestClipChange(trackId: string, clipId: string, partial: Partial<ClipLinkValues>): void {
    const current = this._clipValues(trackId, clipId);
    if (!current) return;
    const clip = this._arrangement
      .getTracks()
      .find((t) => t.id === trackId)
      ?.clips.find((c) => c.id === clipId);
    const src = clip && typeof clip.src === 'string' ? clip.src : '';
    this._applyClipUpdate(trackId, clipId, { ...current, ...partial, src });
  }
  /** @internal */
  _trackIndex(trackId: string): number {
    return this._arrangement.getTracks().findIndex((t) => t.id === trackId);
  }
  /** @internal */
  _detachedReason(): string {
    return this._handedIn
      ? 'a handed-in arrangement is set (editor.arrangement)'
      : 'its track or clip is not in the arrangement the editor plays';
  }
  /** Set or clear `:state(detached)` on every registered element (#848). */
  private _refreshLinkStates(): void {
    refreshLinkStates(this, this._trackElements);
  }
  /**
   * Change one mixer field of a track: the arrangement's setter with
   * `options` (an undo step; changes with one `gesture` id are one step). A
   * track that has not entered yet changes nothing.
   */
  private _writeMix<K extends keyof TrackMixerValues>(
    trackId: string,
    field: K,
    value: TrackMixerValues[K],
    options?: MixerChangeOptions
  ): void {
    const arrangement = this._arrangement;
    if (field === 'volume') arrangement.setTrackVolume(trackId, value as number, options);
    else if (field === 'pan') arrangement.setTrackPan(trackId, value as number, options);
    else if (field === 'muted') arrangement.setTrackMute(trackId, value as boolean, options);
    else arrangement.setTrackSolo(trackId, value as boolean, options);
  }
  /**
   * Change the given mixer fields of a track as ONE undo step (#843): all
   * of them carry one fresh gesture id. A field left out is not sent.
   */
  private _writeMixFields(
    trackId: string,
    mix: Partial<TrackMixerValues>,
    gesture: string = createMixerGesture().id
  ): void {
    const options: MixerChangeOptions = { gesture };
    if (mix.volume !== undefined) this._writeMix(trackId, 'volume', mix.volume, options);
    if (mix.pan !== undefined) this._writeMix(trackId, 'pan', mix.pan, options);
    if (mix.muted !== undefined) this._writeMix(trackId, 'muted', mix.muted, options);
    if (mix.soloed !== undefined) this._writeMix(trackId, 'soloed', mix.soloed, options);
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
    // Capture on window: runs before <daw-keyboard-shortcuts>' document listener.
    window.addEventListener('keydown', this._onDragEscape, { capture: true });
    this.addEventListener('daw-track-connected', this._onTrackConnected as EventListener);
    this.addEventListener('daw-track-update', this._onTrackUpdate as EventListener);
    this.addEventListener('daw-track-control', this._onTrackControl as EventListener);
    this.addEventListener('daw-track-remove', this._onTrackRemoveRequest as EventListener);
    this.addEventListener('daw-clip-connected', this._onClipConnected as EventListener);
    this.addEventListener(
      'daw-annotation-track-connected',
      this._onAnnotationTrackConnected as EventListener
    );
    this.addEventListener('daw-annotation-select', this._onAnnotationSelect as EventListener);
    this.addEventListener('daw-track-reorder', this._onTrackReorder as EventListener);
    this.addEventListener('daw-track-reorder-grab', this._onTrackReorderGrab as EventListener);
    // Detect track + clip removal via MutationObserver (detached elements can't
    // bubble events). A node present in BOTH removedNodes and addedNodes within
    // one batch is a MOVE (insertBefore fires remove+insert) — treated as a
    // reorder, never a teardown (#612).
    this._childObserver = new MutationObserver((mutations) => {
      const removedTracks = new Map<string, DawTrackElement>();
      const removedClips = new Set<DawClipElement>();
      const addedTrackIds = new Set<string>();
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.tagName === 'DAW-TRACK') {
            addedTrackIds.add((node as DawTrackElement).trackId);
          }
          node.querySelectorAll?.('daw-track').forEach((t) => {
            addedTrackIds.add((t as DawTrackElement).trackId);
          });
        }
        for (const node of mutation.removedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.tagName === 'DAW-TRACK') {
            removedTracks.set((node as DawTrackElement).trackId, node as DawTrackElement);
          } else if (node.tagName === 'DAW-CLIP') {
            removedClips.add(node as DawClipElement);
          }
          node.querySelectorAll?.('daw-track').forEach((t) => {
            removedTracks.set((t as DawTrackElement).trackId, t as DawTrackElement);
          });
          node.querySelectorAll?.('daw-clip').forEach((c) => {
            removedClips.add(c as DawClipElement);
          });
        }
      }
      const movedTrackIds = new Set<string>();
      for (const [trackId] of removedTracks) {
        if (addedTrackIds.has(trackId)) {
          movedTrackIds.add(trackId); // move, not removal
          continue;
        }
        this._onTrackRemoved(trackId);
      }
      for (const clip of removedClips) {
        // A clip that moved with its track (or was re-slotted) is still connected.
        if (clip.isConnected) continue;
        this._onClipRemovedFromDom(clip);
      }
      if (movedTrackIds.size > 0) this._placeMovedTracks(movedTrackIds);
    });
    this._childObserver.observe(this, { childList: true, subtree: true });
    // A <daw-track> the page removed while the editor was detached (the
    // observer was off): its track goes now, as the observer would have done
    // (#917; `_trackElements` is kept across a disconnect).
    for (const [trackId, el] of [...this._trackElements]) {
      if (!this.contains(el)) this._onTrackRemoved(trackId);
    }
    // ... and a <daw-clip> the page removed meanwhile: its clip goes (#848).
    for (const [trackId, el] of this._trackElements) {
      const present = new Set(
        [...el.querySelectorAll('daw-clip')].map((c) => (c as DawClipElement).clipId as string)
      );
      for (const clipId of this._extras.get(trackId)?.peaksSrc.keys() ?? []) {
        if (present.has(clipId)) continue;
        if (this._clipLinkState(trackId, clipId) === 'live')
          this._removeClipFromTrack(trackId, clipId);
        else this._forgetClip(trackId, clipId);
      }
    }
    if (this._externalAdapter && !this._engine) this._buildEngineReporting();
  }
  disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('keydown', this._onDragEscape, { capture: true });
    this._effectsManager?.disposeAll();
    this._effectsManager = null;
    this.removeEventListener('daw-track-connected', this._onTrackConnected as EventListener);
    this.removeEventListener('daw-track-update', this._onTrackUpdate as EventListener);
    this.removeEventListener('daw-track-control', this._onTrackControl as EventListener);
    this.removeEventListener('daw-track-remove', this._onTrackRemoveRequest as EventListener);
    this.removeEventListener('daw-clip-connected', this._onClipConnected as EventListener);
    this.removeEventListener(
      'daw-annotation-track-connected',
      this._onAnnotationTrackConnected as EventListener
    );
    this.removeEventListener('daw-annotation-select', this._onAnnotationSelect as EventListener);
    this.removeEventListener('daw-track-reorder', this._onTrackReorder as EventListener);
    this.removeEventListener('daw-track-reorder-grab', this._onTrackReorderGrab as EventListener);
    // Before the engine is disposed: every pointer interaction ends here.
    this._cancelDrags(true);
    // No audio loads while detached (the decode context goes with the
    // engine). A dropped file whose track has entered is kept and counts as
    // loaded: it loads after a reparent, like the page's tracks (maintainer,
    // #917). One not entered yet is not added.
    for (const end of [...this._loadWaitEnds]) end();
    for (const trackId of this._entryQueue) {
      const pending = this._pending.get(trackId);
      if (!pending || 'element' in pending || !this._entryWaiters.has(trackId)) continue;
      const nextPending = new Map(this._pending);
      nextPending.delete(trackId);
      this._pending = nextPending;
      this._entryQueue = this._entryQueue.filter((id) => id !== trackId);
      this._settleEntry(
        trackId,
        new Error('<daw-editor> was disconnected before the file entered')
      );
    }
    this._childObserver?.disconnect();
    this._childObserver = null;
    // `_trackElements` is kept (#917): the build on a fresh adapter can run
    // before the children's deferred reconnect, and its descriptor reconcile
    // must still see which tracks have an element.
    this._peaksCache.clear();
    // The worker goes; the pipeline makes a new one on its next use.
    this._peakPipeline.terminate();
    this._spectrogramController?.dispose();
    this._spectrogramController = null;
    this._lastSpectrogramViewport = null;
    const hadEngine = this._engine !== null;
    try {
      this._disposeEngine();
    } catch (err) {
      console.warn('[dawcore] Error disposing engine: ' + String(err));
    }
    // engine.dispose() disposed the CONSUMER's adapter. Some adapters
    // (NativePlayoutAdapter) leave the AudioContext open, so building on it
    // again would decode into a dead transport graph: waveforms, no audio.
    // The editor lets go of it; a fresh editor.adapter builds a new engine
    // on the kept arrangement (#848).
    if (hadEngine) {
      this._externalAdapter = null;
    }
    // The arrangement stays, as a moved <input> keeps its value (#848), and
    // so do the descriptors and the peak caches that draw it: the editor
    // shows its tracks while detached, and a fresh adapter plays them. The
    // children's reconnect finds their descriptors and enters nothing again.
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
    // `mono` changes the derived peak data too (per-channel vs merged) —
    // without it here, toggling mono keeps the stale channel layout until
    // the next zoom change, then snaps mid-session.
    const peaksInputChanged =
      changedProperties.has('samplesPerPixel') ||
      changedProperties.has('ticksPerPixel') ||
      changedProperties.has('bpm') ||
      changedProperties.has('scaleMode') ||
      changedProperties.has('secondsToTicks') ||
      changedProperties.has('mono');
    if (peaksInputChanged && this._clipBuffers.size > 0) {
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

  /**
   * Cache of the last ViewportState forwarded to the spectrogram controller.
   * Lit's `updated()` fires on every reactive state change (`_isPlaying`,
   * `_selectedTrackId`, etc.) — most of which don't affect the spectrogram
   * viewport. Skip the cross-controller call when nothing changed.
   *
   * The orchestrator dedupes identical viewports too, so removing this cache
   * wouldn't change observable behavior — but it would push a fresh
   * `setViewport` call (with object allocation) into every Lit reactive
   * update for properties unrelated to the viewport.
   */
  private _lastSpectrogramViewport: {
    vs: number;
    ve: number;
    spp: number;
  } | null = null;

  protected updated(_changed: Map<string, unknown>): void {
    // Keep selectors truthful so the controller can distinguish "intentionally
    // not rendered" from "selector broken" (it warns on the latter when scrolled).
    this._scrollSync.xTargetSelector = this._showRuler ? '.ruler-content' : '';
    this._scrollSync.yTargetSelector = this._showControls ? '.controls-column' : '';
    this._scrollSync.wheelForwardSelector = [
      this._showControls ? '.controls-viewport' : '',
      this._showRuler ? '.ruler-viewport' : '',
    ]
      .filter(Boolean)
      .join(', ');
    // Re-applies transforms clobbered by the .ruler-content style binding —
    // Lit rewrites the style attribute (width) on _totalWidth changes, wiping
    // the imperatively-set transform. Must run before paint on every update.
    this._scrollSync.sync();
    // Forward viewport + zoom into the spectrogram controller on every update
    // so scroll, resize, and zoom all trigger orchestrator.setViewport.
    if (this._spectrogramController) {
      const vs = this._viewport.visibleStart;
      const ve = this._viewport.visibleEnd;
      const spp = this._renderSpp;
      if (Number.isFinite(vs) && Number.isFinite(ve)) {
        const prev = this._lastSpectrogramViewport;
        if (prev && prev.vs === vs && prev.ve === ve && prev.spp === spp) return;
        this._lastSpectrogramViewport = { vs, ve, spp };
        const span = ve - vs;
        const bufferPad = span * 0.25;
        this._spectrogramController.setViewport({
          visibleStartPx: vs,
          visibleEndPx: ve,
          bufferStartPx: Math.max(0, vs - bufferPad),
          bufferEndPx: ve + bufferPad,
          samplesPerPixel: spp,
        });
      }
    }
  }

  // --- Annotation Events ---
  private _onAnnotationTrackConnected = (e: CustomEvent<{ element: HTMLElement }>) => {
    this._annotations.handleTrackConnected(e.detail.element as DawAnnotationTrackElement);
  };
  private _onAnnotationSelect = (e: CustomEvent<{ annotation: { start: number } | null }>) => {
    const annotation = e.detail.annotation;
    if (!annotation) return;
    const scrollArea = this.shadowRoot?.querySelector('.scroll-area') as HTMLElement | null;
    if (!scrollArea) return;
    const px = Math.floor((annotation.start * this.effectiveSampleRate) / this._renderSpp);
    scrollArea.scrollLeft = Math.max(0, px - scrollArea.clientWidth / 2);
  };

  // --- Track Events ---
  private _onTrackConnected = (e: CustomEvent) => {
    const trackId = e.detail?.trackId;
    const trackEl = e.detail?.element;
    if (!trackId || !(trackEl instanceof HTMLElement)) {
      console.warn('[dawcore] Invalid daw-track-connected event detail: ' + String(e.detail));
      return;
    }
    // Custom elements fire disconnectedCallback+connectedCallback on a pure
    // DOM MOVE (e.g. insertBefore during a consumer reorder), not just on a
    // genuine removal — no moveBefore() is used anywhere in this codebase.
    // daw-track.ts's connectedCallback re-dispatches a deferred
    // daw-track-connected for the SAME trackId in that case. If the track is
    // already registered (loading or fully loaded), this is a reconnect from
    // a move, not a first-time registration: refresh the element mapping and
    // bail out WITHOUT re-reading the descriptor or entering it again. The
    // same holds when the EDITOR itself was reparented: the disconnect keeps
    // the arrangement and the descriptors (#848), so the children's
    // reconnect enters nothing again, also a track an Undo took out.
    if (this._pending.has(trackId) || this._extras.has(trackId) || this._isEntered(trackId)) {
      this._trackElements.set(trackId, trackEl as DawTrackElement);
      return;
    }
    // Its declaration is read when it enters (#848 PR 3).
    this._pending = new Map(this._pending).set(trackId, {
      element: trackEl as DawTrackElement,
      extraClips: [],
    });
    this._trackElements.set(trackId, trackEl as DawTrackElement);
    // It enters the arrangement at the next flush, in DOM position (#848).
    this._queueEntry(trackId);
  };
  private _onTrackRemoved(trackId: string) {
    // Captured before the cleanup below — gates the outbound event so it only
    // fires for a track that was actually registered.
    const existed =
      this._pending.has(trackId) || this._extras.has(trackId) || this._isEntered(trackId);
    // An addClip() waiting for a clip of this track would never settle (the
    // clip may not even have connected yet): reject it (#917).
    this._rejectAwaitedClips(
      (_, awaitedTrackId) => awaitedTrackId === trackId,
      'the track of the clip was removed before the clip loaded'
    );
    this._entryQueue = this._entryQueue.filter((id) => id !== trackId);
    this._settleEntry(trackId, new Error('track "' + trackId + '" was removed before it entered'));
    // A page track removed while a handed-in arrangement is played is the own one's (P7).
    const holder = this._arrangementOf(trackId);
    const arrangementTrack = holder.getTracks().find((t) => t.id === trackId);
    const clipIds = arrangementTrack?.clips.map((c) => c.id) ?? [];
    this._announcer.forget(trackId, clipIds);
    if (clipIds.some((id) => this._previewPeaks.has(id))) {
      const nextPreview = new Map(this._previewPeaks);
      for (const id of clipIds) nextPreview.delete(id);
      this._previewPeaks = nextPreview;
    }
    for (const id of clipIds) this._previewWaveforms.delete(id);
    this._trackElements.delete(trackId);
    this._effectsManager?.disposeTrackChain(trackId);
    // Clean up per-clip data before removing the track
    if (arrangementTrack) {
      const nextPeaks = new Map(this._peaksData);
      for (const clip of arrangementTrack.clips) {
        this._clipBuffers.delete(clip.id);
        this._clipOffsets.delete(clip.id);
        nextPeaks.delete(clip.id);
        this._spectrogramController?.unregisterClipAudio(clip.id);
      }
      this._peaksData = nextPeaks;
    }
    const nextPending = new Map(this._pending);
    nextPending.delete(trackId);
    this._pending = nextPending;
    const nextExtras = new Map(this._extras);
    nextExtras.delete(trackId);
    this._extras = nextExtras;
    // An undo step; the engine follows (incremental removal, playback goes on).
    if (arrangementTrack) holder.removeTrack(trackId);
    this._recomputeDuration();
    // Recompute zoom floor from remaining cached WaveformData scales
    this._recomputeZoomFloor();
    this._disposeSpectrogramControllerIfEmpty();
    // `existed` gate: the MutationObserver fires this for never-registered
    // <daw-track> churn too (element added+removed before its deferred
    // connect) — that must not rewind the user's cursor on an empty timeline.
    if (existed && this._arrangement.getTracks().length === 0) {
      if (this._engine) {
        // The editor rewinds to 0 when the last track goes away — the engine
        // must follow (engine.removeTrack never touches time), or the next
        // play() resumes from the stale position while the display shows 0.
        // Stop first if rolling: an empty timeline has nothing to play, and
        // without it isPlaying stays true with a dead playhead RAF. Suppress
        // the stop settle — the final resting position is 0, dispatched by
        // _stopPlayhead below.
        if (this._isPlaying) {
          this._withSeekSuppression(() => this._engine!.stop());
          // Announce like every other stop path — transport UIs key on
          // daw-play/daw-stop, and editor.stop() (the usual dispatcher) is
          // bypassed here.
          this.dispatchEvent(new CustomEvent('daw-stop', { bubbles: true, composed: true }));
        }
        this._engine.seek(0);
      }
      this._currentTime = 0;
      this._stopPlayhead();
    }
    // Outbound notification (symmetric with daw-track-ready) — fired after
    // the removal so handlers reading editor.tracks see it.
    // Only for a track that was registered, and never on a detached editor
    // (a bubbling/composed event can't reach ancestors — CLAUDE.md pattern #36).
    if (existed && this.isConnected) {
      this.dispatchEvent(
        new CustomEvent<DawTrackIdDetail>('daw-track-removed', {
          bubbles: true,
          composed: true,
          detail: { trackId },
        })
      );
    }
  }
  private _onTrackUpdate = (e: CustomEvent<DawTrackUpdateDetail>) => {
    const trackId = e.detail?.trackId;
    if (!trackId) return;
    const trackEl = (e.target as HTMLElement).closest('daw-track') as DawTrackElement | null;
    if (!trackEl) return;
    // A track that has not entered is read when it enters; one an Undo took
    // out keeps what it had (#848).
    const old = this._extras.get(trackId);
    if (!old || !this._isEntered(trackId)) return;
    const changed = Array.isArray(e.detail.changed) ? e.detail.changed : [];
    if (changed.includes('kind') && old.kind !== trackEl.kind) {
      // The clips already loaded are of the old kind (#756). The element keeps
      // what the page set (the editor writes no attribute, #848).
      console.warn(
        '[dawcore] <daw-track> "' +
          (trackEl.name || 'Untitled') +
          '": kind cannot change after the track has loaded (still "' +
          old.kind +
          '"). Remove the track and add one of the other kind.'
      );
    }
    const next: TrackExtras = {
      ...old,
      renderMode: trackDescriptorRenderMode(old.kind, trackEl.renderMode),
      spectrogramConfig: trackEl.spectrogramConfig,
      src: trackEl.src,
    };
    this._extras = new Map(this._extras).set(trackId, next);
    // The mix and the name are not handled here: the element's setters ask
    // the arrangement directly (#848, element-links.ts).
    if (old.src !== next.src) this._replaceShorthandClips(trackId, trackEl);
    const loaded = this._loadedTracks().find((t) => t.id === trackId)?.clips ?? [];
    // Track switched into spectrogram mode — push existing clip audio into the controller.
    if (next.renderMode === 'spectrogram' && old.renderMode !== 'spectrogram') {
      for (const clip of loaded) this._maybeRegisterSpectrogramClipAudio(trackId, clip);
    }
    // Track switched OUT of spectrogram mode — drop clip audio.
    if (next.renderMode !== 'spectrogram' && old.renderMode === 'spectrogram') {
      if (this._spectrogramController) {
        for (const clip of loaded) this._spectrogramController.unregisterClipAudio(clip.id);
      }
      this._disposeSpectrogramControllerIfEmpty();
    }
    if (next.spectrogramConfig !== old.spectrogramConfig) {
      this._spectrogramController?.setTrackConfig(trackId, next.spectrogramConfig ?? null);
    }
  };
  /** The arrangement that holds a track: the one played, else the own one (a page track while handed in). */
  private _arrangementOf(trackId: string): Arrangement {
    const has = (a: Arrangement) => a.getTracks().some((t) => t.id === trackId);
    return has(this._arrangement) || !has(this._ownArrangement)
      ? this._arrangement
      : this._ownArrangement;
  }
  /** Rename a track in the arrangement (an undo step); the same name changes nothing. */
  private _renameTrack(trackId: string, name: string): void {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    if (!track || track.name === name) return;
    this._arrangement.updateTrack(trackId, (current) => ({ ...current, name }));
  }

  /** Drop the controller when no spectrogram tracks remain. */
  private _disposeSpectrogramControllerIfEmpty(): void {
    if (!this._spectrogramController) return;
    const stillNeeded = Array.from(this._extras.values()).some(
      (d) => d.renderMode === 'spectrogram'
    );
    if (!stillNeeded) {
      this._spectrogramController.dispose();
      this._spectrogramController = null;
      // A recreated controller diffs new viewports against this cache — a
      // stale entry suppresses the fresh orchestrator's initial setViewport
      // and every canvas stays black until a >=100px scroll or zoom change.
      this._lastSpectrogramViewport = null;
    }
  }

  private static _CONTROL_PROPS = new Set(['volume', 'pan', 'muted', 'soloed']);
  private _onTrackControl = (e: CustomEvent<Partial<DawTrackControlDetail>>) => {
    const { trackId, prop, value, gesture } = e.detail ?? {};
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
    if (this._isEntered(trackId)) {
      // Validated values to the arrangement's setters (also while the track
      // loads, #848). A slider's gesture id makes its drag one undo step
      // (#843); a control without one (mute, solo) is a step per event.
      const options: MixerChangeOptions | undefined =
        typeof gesture === 'string' ? { gesture } : undefined;
      if (prop === 'volume') this._writeMix(trackId, 'volume', clampNumber(value, 0, 1), options);
      if (prop === 'pan') this._writeMix(trackId, 'pan', clampNumber(value, -1, 1), options);
      if (prop === 'muted') this._writeMix(trackId, 'muted', Boolean(value), options);
      if (prop === 'soloed') this._writeMix(trackId, 'soloed', Boolean(value), options);
    }
    // Don't sync back to <daw-track> DOM element — avoids daw-track-update loop.
    // The arrangement holds the control values.
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
    if (!this._isEntered(trackId)) {
      // Neither entered nor waiting to enter: an Undo took the track out
      // between an addClip() and this deferred connect, or the arrangement
      // refused it. Nothing will take the clip, so its addClip() is rejected
      // (#917). A track waiting to enter reads its <daw-clip> children when
      // it enters (#848 PR 3), this one included.
      if (!this._entryQueue.includes(trackId)) {
        this._rejectAwaitedClips(
          (id) => id === clipEl.clipId,
          'addClip: track "' + trackId + '" is not in the editor (an Undo took it out)'
        );
      }
      return;
    }
    // A clip the editor took already: read when its track entered (this is
    // its own deferred connect), or a reconnect from a DOM move (custom
    // elements fire disconnectedCallback+connectedCallback on insertBefore).
    if (this._extras.get(trackId)?.peaksSrc.has(clipEl.clipId)) return;
    this._loadAndAppendClip(trackId, this._readClipDescriptor(clipEl));
  };
  private _onClipRemovedFromDom(clipEl: DawClipElement) {
    const clipId = clipEl.clipId;
    for (const t of this._arrangement.getTracks()) {
      if (t.clips.some((c) => c.id === clipId)) {
        this._removeClipFromTrack(t.id, clipId);
        return;
      }
    }
    // A clip the arrangement refused (its kind): it goes from what the editor took.
    for (const [trackId, extras] of this._extras) {
      if (!extras.peaksSrc.has(clipId)) continue;
      this._forgetClip(trackId, clipId);
      return;
    }
    // Removed before its deferred connect, or from a track that has not
    // entered (it reads its clips when it enters) (in the task of its addClip()): the
    // connect will never reach the editor, so the addClip() is rejected (#917).
    this._rejectAwaitedClips((id) => id === clipId, 'the clip was removed before it loaded');
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
  /**
   * A `<daw-clip>` appended to a track that has entered: the clip goes in as
   * a loading clip (a loaded one for MIDI), one undo step. Its audio loads
   * like any other; `daw-clip-ready` or `daw-clip-error` follows (#848).
   */
  private _loadAndAppendClip(trackId: string, clipDesc: ClipDescriptor & { clipId: string }) {
    const extras = this._extras.get(trackId);
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    if (!extras || !track) return;
    // A <daw-clip>'s clip is taken, also when refused: its own deferred
    // connect must not add it again. One from addClip() has no element.
    if (isDomClip(clipDesc)) this._takeClip(trackId, clipDesc.clipId, clipDesc.peaksSrc);
    const clipIsMidi = isMidiDescriptor(clipDesc);
    const kindError = clipKindError(
      track.name ?? '',
      extras.kind,
      clipIsMidi,
      clipDesc.name || clipDesc.src || clipDesc.clipId
    );
    const clip = clipIsMidi
      ? buildMidiClip(clipDesc, this.effectiveSampleRate)
      : buildLoadingClip(clipDesc);
    if (!clipIsMidi) this._announcer.expectClip(clipDesc.clipId);
    try {
      if (kindError) throw kindError;
      // The function form: the track's loading clips stay as they are.
      this._arrangement.updateTrack(trackId, (current) => ({
        ...current,
        clips: [...current.clips, clip],
      }));
    } catch (err) {
      console.warn('[dawcore] _loadAndAppendClip failed: ' + String(err));
      this.dispatchEvent(
        new CustomEvent<DawClipErrorDetail>('daw-clip-error', {
          bubbles: true,
          composed: true,
          detail: { trackId, clipId: clipDesc.clipId, error: err },
        })
      );
      return;
    }
    if (!clipIsMidi && clipDesc.peaksSrc) this._requestPreview(clipDesc.clipId, clipDesc.peaksSrc);
  }
  /**
   * Resolve pre-computed peaks for a clip: fetch the .dat/.json, validate the
   * sample rate matches the AudioContext, return the WaveformData or null.
   * Warns on fetch failure and on sample-rate mismatch — never silent.
   *
   * Used by `_requestPreview` for a clip that is still loading.
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
  /** Remove a single clip from all per-clip caches. Used by error rollbacks. */
  private _purgeClipCaches(clipId: string) {
    const nextBuffers = new Map(this._clipBuffers);
    nextBuffers.delete(clipId);
    this._clipBuffers = nextBuffers;
    const nextPeaks = new Map(this._peaksData);
    nextPeaks.delete(clipId);
    this._peaksData = nextPeaks;
    this._clipOffsets.delete(clipId);
    this._spectrogramController?.unregisterClipAudio(clipId);
  }
  /**
   * Replace one loaded clip of a track in the arrangement: an undo step. The
   * function form, so the track's loading clips stay as they are (#848).
   */
  private _replaceClip(trackId: string, clipId: string, clip: AudioClip) {
    this._arrangement.updateTrack(trackId, (current) => ({
      ...current,
      clips: current.clips.map((c) => (c.id === clipId ? clip : c)),
    }));
  }
  private _applyClipUpdate(trackId: string, clipId: string, clipEl: ClipUpdateValues) {
    const t = this._arrangement.getTracks().find((track) => track.id === trackId);
    if (!t) {
      console.warn('[dawcore] _applyClipUpdate: no track for id "' + trackId + '"');
      return;
    }
    const loadedClip = this._loadedClip(trackId, clipId);
    if (!loadedClip) {
      const loading = t.clips.find((c) => c.id === clipId);
      if (loading && isLoadingClip(loading)) {
        this._updateLoadingClip(trackId, loading, clipEl);
        return;
      }
      console.warn(
        '[dawcore] _applyClipUpdate: clip "' +
          clipId +
          '" not found in track "' +
          trackId +
          '" (DOM/engine clip-id misalignment?)'
      );
      return;
    }
    const oldClip = loadedClip;
    const sr = oldClip.sampleRate ?? this.effectiveSampleRate;

    // MIDI clips: rebuild the clip when notes/channel/program change. Detect
    // MIDI by either current or previous state being MIDI. oldClip.midiNotes
    // is an array (possibly empty []) for any clip registered via _buildMidiClip
    // — including placeholders. For audio clips it is undefined.
    // Use loose != null consistently: treats both null and undefined as "not MIDI"
    // for both clipEl.midiNotes (DawClipElement defaults to null) and oldClip.midiNotes.
    // A clip with a src is an audio clip even if notes are set on it, as at
    // load (isMidiDescriptor: "treating as audio, notes will be ignored").
    const isMidiNow = clipEl.midiNotes != null && !clipEl.src;
    const wasMidi = oldClip.midiNotes != null;
    if (isMidiNow && trackKind(t) !== 'midi') {
      // Notes assigned to a clip of an audio track: the clip would become a
      // MIDI clip on an audio track (#756). Leave the engine clip as it is.
      const kindError = clipKindError(t.name ?? '', 'audio', true, clipEl.name || clipId);
      console.warn('[dawcore] _applyClipUpdate: ' + kindError?.message);
      this.dispatchEvent(
        new CustomEvent<DawClipErrorDetail>('daw-clip-error', {
          bubbles: true,
          composed: true,
          detail: { trackId, clipId, error: kindError },
        })
      );
      return;
    }
    if (isMidiNow || wasMidi) {
      // The value the arrangement holds already changes nothing (#848).
      if (
        clipEl.midiNotes === oldClip.midiNotes &&
        (clipEl.midiChannel ?? undefined) === oldClip.midiChannel &&
        (clipEl.midiProgram ?? undefined) === oldClip.midiProgram &&
        Math.round(clipEl.start * sr) === oldClip.startSample &&
        Math.round(clipEl.offset * sr) === oldClip.offsetSamples &&
        (clipEl.duration <= 0 || Math.round(clipEl.duration * sr) === oldClip.durationSamples) &&
        clipEl.gain === (oldClip.gain ?? 1) &&
        (clipEl.name || oldClip.name) === oldClip.name
      ) {
        return;
      }
      const notes = validMidiNotes(clipEl.midiNotes ?? []);
      const noteSpanSeconds = notes.length
        ? notes.reduce((max, n) => Math.max(max, n.time + n.duration), 0)
        : 0;
      const sourceDurationSamples = Math.ceil(Math.max(noteSpanSeconds, clipEl.duration, 1) * sr);
      const requestedDurationSamples =
        clipEl.duration > 0 ? Math.round(clipEl.duration * sr) : sourceDurationSamples;

      const updatedClip: AudioClip = {
        ...oldClip,
        audioBuffer: undefined,
        startSample: Math.round(clipEl.start * sr),
        offsetSamples: Math.round(clipEl.offset * sr),
        durationSamples: requestedDurationSamples,
        sourceDurationSamples,
        gain: clipEl.gain,
        name: clipEl.name || oldClip.name,
        midiNotes: notes,
        midiChannel: clipEl.midiChannel ?? undefined,
        midiProgram: clipEl.midiProgram ?? undefined,
      };
      // Drop any audio caches in case this clip was previously loaded as audio.
      this._purgeClipCaches(clipId);
      this._replaceClip(trackId, clipId, updatedClip);
      return;
    }

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
    // The value the arrangement holds already changes nothing (#848).
    if (
      newStartSample === oldClip.startSample &&
      newDurationSamples === oldClip.durationSamples &&
      newOffsetSamples === oldClip.offsetSamples &&
      updatedClip.gain === (oldClip.gain ?? 1) &&
      updatedClip.name === oldClip.name
    ) {
      return;
    }
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

    this._replaceClip(trackId, clipId, updatedClip);
  }
  /**
   * A change to a clip still loading (#848 P10): its times, gain and name in
   * seconds on the `LoadingClip`, one undo step; the audio loads into it.
   */
  private _updateLoadingClip(trackId: string, clip: LoadingClip, values: ClipUpdateValues): void {
    const next: LoadingClip = {
      ...clip,
      start: values.start,
      ...(values.duration > 0 ? { duration: values.duration } : {}),
      offset: values.offset,
      gain: values.gain,
      ...(values.name ? { name: values.name } : {}),
    };
    if (
      (next.start ?? 0) === (clip.start ?? 0) &&
      next.duration === clip.duration &&
      (next.offset ?? 0) === (clip.offset ?? 0) &&
      (next.gain ?? 1) === (clip.gain ?? 1) &&
      next.name === clip.name
    ) {
      return;
    }
    this._arrangement.updateTrack(trackId, (current) => ({
      ...current,
      clips: current.clips.map((c) => (c.id === clip.id ? next : c)),
    }));
  }
  /** Remove a clip (loaded or still loading) from a track of the arrangement: an undo step. */
  private _removeClipFromTrack(trackId: string, clipId: string) {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    if (!track) {
      console.warn('[dawcore] _removeClipFromTrack: no track for id "' + trackId + '"');
      return;
    }
    if (!track.clips.some((c) => c.id === clipId)) {
      console.warn(
        '[dawcore] _removeClipFromTrack: clip "' + clipId + '" not found in track "' + trackId + '"'
      );
      return;
    }
    this._purgeClipCaches(clipId);
    this._previewWaveforms.delete(clipId);
    if (this._previewPeaks.has(clipId)) {
      const nextPreview = new Map(this._previewPeaks);
      nextPreview.delete(clipId);
      this._previewPeaks = nextPreview;
    }
    this._forgetClip(trackId, clipId);
    const wasLoading = track.clips.some((c) => c.id === clipId && isLoadingClip(c));
    this._arrangement.updateTrack(trackId, (current) => ({
      ...current,
      clips: current.clips.filter((c) => c.id !== clipId),
    }));
    // Its load will never be announced (an addClip() waiting for it watches
    // the arrangement and rejects).
    if (wasLoading) this._announcer.forgetClip(clipId);
  }
  /** Record that the editor took a clip of a track (with its `peaks-src`, '' when none). */
  private _takeClip(trackId: string, clipId: string, peaksSrc: string): void {
    const extras = this._extras.get(trackId);
    if (!extras || extras.peaksSrc.get(clipId) === peaksSrc) return;
    const next = new Map(extras.peaksSrc).set(clipId, peaksSrc);
    this._extras = new Map(this._extras).set(trackId, { ...extras, peaksSrc: next });
  }
  /** The editor no longer holds anything for a clip of a track. */
  private _forgetClip(trackId: string, clipId: string): void {
    const extras = this._extras.get(trackId);
    if (!extras?.peaksSrc.has(clipId)) return;
    const next = new Map(extras.peaksSrc);
    next.delete(clipId);
    this._extras = new Map(this._extras).set(trackId, { ...extras, peaksSrc: next });
  }
  private _readTrackDescriptor(trackEl: DawTrackElement): StoredTrackDescriptor {
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
        midiNotes: null,
        midiChannel: null,
        midiProgram: null,
      });
    } else {
      for (const clipEl of clipEls) clips.push(this._readClipDescriptor(clipEl));
    }
    return {
      name: trackEl.name || 'Untitled',
      src: trackEl.src,
      kind: trackEl.kind,
      renderMode: trackDescriptorRenderMode(trackEl.kind, trackEl.renderMode),
      clips,
    };
  }
  private _readClipDescriptor(clipEl: DawClipElement): DomClipDescriptor {
    return {
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
      midiNotes: clipEl.midiNotes,
      midiChannel: clipEl.midiChannel,
      midiProgram: clipEl.midiProgram,
    };
  }
  // --- Entering the arrangement (#848) ---
  private _isEntered(trackId: string): boolean {
    return this._arrangement.getTracks().some((t) => t.id === trackId);
  }
  /** Queue a registered track for the next flush. */
  _queueEntry(trackId: string): void {
    if (!this._entryQueue.includes(trackId)) this._entryQueue = [...this._entryQueue, trackId];
    if (this._entryFlushScheduled) return;
    this._entryFlushScheduled = true;
    // A microtask: tracks connected in one task (an innerHTML, a script
    // appending several) enter together, at once. The page's children connect
    // in tasks of their own and enter one by one; the history rule holds for
    // each, because the flush before cleared what it added.
    queueMicrotask(() => {
      this._entryFlushScheduled = false;
      this._flushTrackEntries();
    });
  }
  /**
   * Enter the queued tracks into the arrangement, in DOM order. Without an
   * engine they wait (the sample rate of a MIDI clip comes from the
   * adapter); the engine's build flushes again. The page's tracks entering
   * while the arrangement has no history are not undo steps: the history is
   * cleared after them, so Undo right after load removes nothing (and the
   * next page track finds it empty again).
   */
  _flushTrackEntries(): void {
    if (this._entryQueue.length === 0) return;
    // Without an engine the queue waits, silently (maintainer, #917; play()
    // without an adapter warns and fires daw-error with the no-adapter error).
    if (!this._engine) return;
    // No drag holds a transaction (#848 PR 3): a track enters during a drag
    // as at any other time, an undo step of its own.
    const isPageTrack = (id: string) => this._trackElements.has(id);
    // The children declare the editor's OWN arrangement: while a handed-in
    // one is played they wait (P7); addTrack() and drops go to the one played.
    const queued = this._handedIn
      ? this._entryQueue.filter((id) => !isPageTrack(id))
      : this._entryQueue;
    this._entryQueue = this._handedIn ? this._entryQueue.filter(isPageTrack) : [];
    const domOrder: string[] = [...this.querySelectorAll('daw-track')].map(
      (el) => (el as DawTrackElement).trackId
    );
    const position = (id: string) => {
      const at = domOrder.indexOf(id);
      return at === -1 ? domOrder.length : at;
    };
    const ordered = [...queued].sort((a, b) => position(a) - position(b));
    const arrangement = this._arrangement;
    const historyWasEmpty = !arrangement.canUndo && !arrangement.canRedo;
    let pageEntered = false;
    for (const id of ordered.filter(isPageTrack)) {
      if (this._enterTrack(id)) pageEntered = true;
    }
    if (historyWasEmpty && pageEntered) arrangement.clearHistory();
    for (const id of ordered.filter((id) => !isPageTrack(id))) this._enterTrack(id);
  }
  /** Enter one registered track. False when it is gone, already in, or refused. */
  private _enterTrack(trackId: string): boolean {
    const descriptor = this._pendingDescriptor(trackId);
    if (!descriptor || this._isEntered(trackId)) return false;
    const el = this._trackElements.get(trackId);
    const built = buildArrangementTrack(
      trackId,
      descriptor,
      this._mixOf(trackId),
      this.effectiveSampleRate
    );
    // From here the arrangement holds it; the editor keeps only what the
    // arrangement has no field for (#848 PR 3).
    const nextPending = new Map(this._pending);
    nextPending.delete(trackId);
    this._pending = nextPending;
    this._extras = new Map(this._extras).set(trackId, extrasOf(built.descriptor));
    for (const { clipId, error } of built.refused) {
      console.warn('[dawcore] ' + error.message);
      this.dispatchEvent(
        new CustomEvent<DawClipErrorDetail>('daw-clip-error', {
          bubbles: true,
          composed: true,
          detail: { trackId, clipId, error },
        })
      );
    }
    const index = el
      ? entryIndex(
          [...this.querySelectorAll('daw-track')] as DawTrackElement[],
          trackId,
          this._arrangement.getTracks().map((t) => t.id)
        )
      : undefined;
    // Before the add: the announcement it causes counts the refused clips,
    // and a clip whose source is loaded already is still announced ready.
    this._announcer.expect(trackId, built.refused.length);
    for (const clip of built.track.clips) {
      if (isLoadingClip(clip)) this._announcer.expectClip(clip.id);
    }
    try {
      this._arrangement.addTrack(built.track, index === undefined ? undefined : { index });
    } catch (err) {
      console.warn('[dawcore] Failed to add track "' + trackId + '": ' + String(err));
      // An element stays linked to the refused track (it is not added
      // again); a track with no element is gone.
      if (!el) {
        const nextExtras = new Map(this._extras);
        nextExtras.delete(trackId);
        this._extras = nextExtras;
      }
      this._refreshLinkStates();
      this._settleEntry(trackId, err instanceof Error ? err : new Error(String(err)));
      this.dispatchEvent(
        new CustomEvent<DawTrackErrorDetail>('daw-track-error', {
          bubbles: true,
          composed: true,
          detail: { trackId, error: err },
        })
      );
      return false;
    }
    this._settleEntry(trackId, null);
    for (const clipDesc of built.descriptor.clips) {
      if (clipDesc.peaksSrc && clipDesc.clipId && clipSourceOf(clipDesc)) {
        this._requestPreview(clipDesc.clipId, clipDesc.peaksSrc);
      }
    }
    return true;
  }
  /**
   * The `<daw-track src>` shorthand changed its src: the entered track gets a
   * new loading clip for it, one undo step. A track whose clips are
   * `<daw-clip>` children keeps them. A track still queued reads the new
   * descriptor when it enters.
   */
  private _replaceShorthandClips(trackId: string, trackEl: DawTrackElement): void {
    const descriptor = this._readTrackDescriptor(trackEl);
    if (!this._isEntered(trackId) || descriptor.clips.some(isDomClip)) return;
    const built = buildArrangementTrack(
      trackId,
      descriptor,
      DEFAULT_TRACK_MIX,
      this.effectiveSampleRate
    );
    const extras = this._extras.get(trackId);
    if (extras) {
      this._extras = new Map(this._extras).set(trackId, {
        ...extras,
        peaksSrc: extrasOf(built.descriptor).peaksSrc,
      });
    }
    this._arrangement.updateTrack(trackId, (current) => ({ ...current, clips: built.track.clips }));
  }
  /** Run the load announcements over the arrangement's current state. */
  private _announceLoading(): void {
    this._announcer.update(
      this._arrangement.getTracks(),
      this._arrangement.sources.getSnapshot().sources
    );
  }
  /**
   * Fetch a loading clip's `.dat` peaks and draw them until its audio
   * arrives (an editor-only cache, not the arrangement: writing the clip
   * after it entered would be an undo step).
   */
  private async _requestPreview(clipId: string, peaksSrc: string): Promise<void> {
    const waveformData = await this._resolvePeaks(peaksSrc);
    if (!waveformData) return;
    const clip = this._arrangement
      .getTracks()
      .flatMap((t) => t.clips)
      .find((c) => c.id === clipId);
    // Loaded first (the worker draws it), or gone.
    if (!clip || !isLoadingClip(clip)) return;
    const rate = waveformData.sample_rate;
    const offset = clip.offset ?? 0;
    const seconds = clip.duration ?? Math.max(0, waveformData.duration - offset);
    const peakData = extractPeaks(
      waveformData,
      Math.max(this._renderSpp, waveformData.scale),
      this.mono,
      Math.round(offset * rate),
      Math.round(seconds * rate)
    );
    this._previewPeaks = new Map(this._previewPeaks).set(clipId, peakData);
    this._previewWaveforms.set(clipId, waveformData);
    this._raiseZoomFloor(waveformData.scale);
    this._recomputeDuration();
  }
  /** The peak sync made a clip's peaks: its zoom floor holds, its preview goes. */
  _clipPeaksReady(clipId: string, audioBuffer: AudioBuffer): void {
    this._raiseZoomFloor(this._peakPipeline.getCachedScale(audioBuffer));
    if (!this._previewPeaks.has(clipId)) return;
    const next = new Map(this._previewPeaks);
    next.delete(clipId);
    this._previewPeaks = next;
  }
  /** Who waits for a track to enter (addTrack, a dropped file). */
  private _entryWaiters = new Map<
    string,
    { resolve: (trackId: string) => void; reject: (error: Error) => void }
  >();
  private _waitForEntry(trackId: string): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this._entryWaiters.set(trackId, { resolve, reject });
    });
  }
  /** Settle the wait for a track's entry: entered (`null`), or refused or gone. */
  private _settleEntry(trackId: string, error: Error | null): void {
    const waiter = this._entryWaiters.get(trackId);
    if (!waiter) return;
    this._entryWaiters.delete(trackId);
    if (error) waiter.reject(error);
    else waiter.resolve(trackId);
  }
  /**
   * A dropped file as a track with no element (a File cannot be an attribute):
   * one loading clip whose source is the file. Resolves with the track id once
   * it has entered, an undo step like any track an editor method adds.
   */
  _addDroppedFile(file: File): Promise<string> {
    const trackId = crypto.randomUUID();
    const name = file.name.replace(/\.\w+$/, '');
    const descriptor: StoredTrackDescriptor = {
      name,
      src: '',
      kind: 'audio',
      renderMode: trackDescriptorRenderMode('audio', 'waveform'),
      clips: [
        {
          kind: 'drop',
          file,
          src: '',
          peaksSrc: '',
          start: 0,
          duration: 0,
          offset: 0,
          gain: 1,
          name,
          fadeIn: 0,
          fadeOut: 0,
          fadeType: 'linear',
          midiNotes: null,
          midiChannel: null,
          midiProgram: null,
        },
      ],
    };
    this._pending = new Map(this._pending).set(trackId, { descriptor, mix: DEFAULT_TRACK_MIX });
    const entered = this._waitForEntry(trackId);
    this._queueEntry(trackId);
    return entered;
  }
  /**
   * Take a track out for good: no undo step, and no undo or redo brings it
   * back (a dropped file that could not be loaded was never a declaration).
   */
  _discardTrack(trackId: string): void {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    this._announcer.forget(trackId, track?.clips.map((c) => c.id) ?? []);
    this._arrangement.removeTrack(trackId, { undoable: false });
    this._onTrackRemoved(trackId);
  }
  /** Ends the waits of `_whenTrackLoaded` (as loaded) when the editor is disconnected. */
  private _loadWaitEnds = new Set<() => void>();
  /**
   * Resolves once the track has loaded (`daw-track-ready`), or when the
   * editor is disconnected meanwhile (the track is kept and loads after a
   * reparent); rejects when its audio failed (`daw-track-error`).
   */
  _whenTrackLoaded(trackId: string): Promise<void> {
    const state = this._announcer.stateOf(trackId);
    if (state === 'ready') return Promise.resolve();
    if (state === 'failed') return Promise.reject(this._announcer.errorOf(trackId));
    return new Promise<void>((resolve, reject) => {
      const cleanup = () => {
        this.removeEventListener('daw-track-ready', onReady);
        this.removeEventListener('daw-track-error', onError);
        this._loadWaitEnds.delete(end);
      };
      const onReady = (e: Event) => {
        if ((e as CustomEvent<DawTrackIdDetail>).detail.trackId !== trackId) return;
        cleanup();
        resolve();
      };
      const onError = (e: Event) => {
        const detail = (e as CustomEvent<DawTrackErrorDetail>).detail;
        if (detail.trackId !== trackId) return;
        cleanup();
        reject(detail.error instanceof Error ? detail.error : new Error(String(detail.error)));
      };
      const end = () => {
        cleanup();
        resolve();
      };
      this.addEventListener('daw-track-ready', onReady);
      this.addEventListener('daw-track-error', onError);
      this._loadWaitEnds.add(end);
    });
  }
  /**
   * Load again every failed source the track's clips name (#848). A track
   * whose audio failed stays in the editor, like a broken `<img>`;
   * `daw-track-ready` follows when it loads.
   */
  retryTrack(trackId: string): void {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    if (!track) {
      console.warn('[dawcore] retryTrack: no track found for id "' + trackId + '"');
      return;
    }
    const sources = this._arrangement.sources.getSnapshot().sources;
    const failed = new Set(
      track.clips
        .filter(isLoadingClip)
        .map((clip) => clip.src)
        .filter((src) => sources.get(src)?.status === 'failed')
    );
    for (const src of failed) this._arrangement.retry(src);
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
  /**
   * The timeline's duration, the one writer of `_duration`: the loaded clips,
   * and the clips still loading whose length is known (a duration, or `.dat`
   * peaks), so the timeline is as wide as what is drawn (#848).
   */
  _recomputeDuration() {
    const sr = this.effectiveSampleRate;
    let maxSample = 0;
    for (const track of this._loadedTracks()) {
      for (const clip of track.clips) {
        const endSample = clip.startSample + clip.durationSamples;
        if (endSample > maxSample) maxSample = endSample;
      }
    }
    for (const track of this._arrangement.getTracks()) {
      for (const clip of track.clips) {
        if (!isLoadingClip(clip)) continue;
        const seconds = this._placeholderSeconds(clip);
        if (seconds === null) continue;
        maxSample = Math.max(maxSample, Math.round(((clip.start ?? 0) + seconds) * sr));
      }
    }
    this._duration = maxSample / sr;
  }
  /** How long a loading clip is drawn: its duration, else what its `.dat` peaks cover; null when unknown. */
  private _placeholderSeconds(clip: LoadingClip): number | null {
    if (clip.duration != null && clip.duration > 0) return clip.duration;
    const waveformData = this._previewWaveforms.get(clip.id);
    if (!waveformData) return null;
    const seconds = waveformData.duration - (clip.offset ?? 0);
    return seconds > 0 ? seconds : null;
  }
  // --- Engine ---
  /**
   * The engine, built now when the editor is connected with an adapter.
   * Rejects without an adapter, and on a detached editor (an engine built
   * there would hold the adapter's graph with nothing to dispose it).
   */
  _ensureEngine(): Promise<PlaylistEngine> {
    if (this._engine) return Promise.resolve(this._engine);
    try {
      if (!this.isConnected && this._externalAdapter) {
        throw new Error('[dawcore] <daw-editor> is not connected: no engine is built for it.');
      }
      return Promise.resolve(this._buildEngine());
    } catch (err) {
      return Promise.reject(err);
    }
  }
  /** Build the engine from the adapter setter or a connect: a failure is reported, not thrown. */
  private _buildEngineReporting(): void {
    try {
      this._buildEngine();
    } catch (err) {
      console.warn('[dawcore] Failed to build the engine: ' + String(err));
      // An addTrack() waiting to enter would wait for an engine that does not
      // come (#848): it fails with the build's error, and its track goes.
      const error = err instanceof Error ? err : new Error(String(err));
      for (const trackId of [...this._entryQueue]) {
        const pending = this._pending.get(trackId);
        if (!pending || 'element' in pending || !this._entryWaiters.has(trackId)) continue;
        const nextPending = new Map(this._pending);
        nextPending.delete(trackId);
        this._pending = nextPending;
        this._entryQueue = this._entryQueue.filter((id) => id !== trackId);
        this._settleEntry(trackId, error);
      }
      this.dispatchEvent(
        new CustomEvent<DawErrorDetail>('daw-error', {
          bubbles: true,
          composed: true,
          detail: { operation: 'engine', error: err },
        })
      );
    }
  }
  /** Last versions the statechange handler worked from; reset for each engine. */
  private _lastTracksVersion = -1;
  private _lastMixerVersion = -1;
  private _buildEngine(): PlaylistEngine {
    if (!this._externalAdapter) {
      throw new Error(noAdapterError());
    }
    const adapter = this._externalAdapter;

    // Forward initial tempo if adapter supports it — skipped when tick
    // callbacks are present (external tempo map is authoritative, #407)
    if (!this._hasTickCallbacks) {
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
    }

    // Try to set the editor's desired PPQN on the adapter, then sync back.
    // Adapter is the source of truth — it may ignore the request.
    adapter.setPpqn?.(this._ppqn);
    this.ppqn = adapter.ppqn;

    const engine = new PlaylistEngine({
      adapter,
      arrangement: this._arrangement,
      sampleRate: adapter.audioContext.sampleRate,
      samplesPerPixel: this.samplesPerPixel,
      bpm: this._bpm,
      zoomLevels: [256, 512, 1024, 2048, 4096, 8192, this.samplesPerPixel]
        .filter((v, i, a) => a.indexOf(v) === i)
        .sort((a, b) => a - b),
    });
    this._lastTracksVersion = -1;
    this._lastMixerVersion = -1;
    engine.on('statechange', (engineState) => this._onEngineState(engineState));
    engine.on('pause', () => {
      this._currentTime = engine.getCurrentTime();
    });
    engine.on('stop', () => this._onEngineStop(engine));
    this._engine = engine;
    // A kept arrangement (a reconnect) already has tracks: draw them now,
    // and give a spectrogram track its audio again (the controller went with
    // the disconnect).
    this._onEngineState(engine.getState());
    for (const track of this._loadedTracks()) {
      for (const clip of track.clips) this._maybeRegisterSpectrogramClipAudio(track.id, clip);
    }
    this._flushTrackEntries();
    return engine;
  }
  /**
   * Clips whose audio has just arrived: a `.dat` preview's data goes to the
   * peak pipeline (no worker run), a spectrogram track gets the audio. The
   * peak sync then makes their peaks.
   */
  private _adoptLoadedClips(tracks: readonly ClipTrack[]): void {
    for (const track of tracks) {
      for (const clip of track.clips) {
        const waveformData = this._previewWaveforms.get(clip.id);
        if (waveformData && clip.audioBuffer) {
          if (waveformData.sample_rate === clip.audioBuffer.sampleRate) {
            this._peakPipeline.cacheWaveformData(clip.audioBuffer, waveformData);
          }
          this._previewWaveforms.delete(clip.id);
        }
        if (!this._clipBuffers.has(clip.id))
          this._maybeRegisterSpectrogramClipAudio(track.id, clip);
      }
    }
  }
  /** The engine's state changed: draw it (the rows are read from the arrangement). */
  private _onEngineState(engineState: EngineState): void {
    this._isPlaying = engineState.isPlaying;
    this._selectedTrackId = engineState.selectedTrackId;
    const structuralChange = engineState.tracksVersion !== this._lastTracksVersion;
    // Per-track mixer edits (volume/mute/solo/pan) bump mixerVersion, NOT
    // tracksVersion (#501). Draw again on either so the controls show the
    // current mix — but only run the
    // expensive structural work below for true structural changes, never on
    // every volume/pan drag frame.
    const mixerChange = engineState.mixerVersion !== this._lastMixerVersion;
    if (structuralChange || mixerChange) {
      this._lastTracksVersion = engineState.tracksVersion;
      this._lastMixerVersion = engineState.mixerVersion;
      this.requestUpdate();
    }
    // Sync clip positions when tracks change structurally (moveClip, trimClip,
    // splitClip, setTracks, addTrack, removeTrack).
    if (structuralChange) {
      this._recomputeDuration();
      // Transport setTracks rebuilds TrackNodes, severing effects hookups.
      this._effectsManager?.rewireTrackChains();
      // Regenerate peaks for new or trimmed clips.
      // MIDI tracks have no AudioBuffer — skip them to avoid noisy
      // "no AudioBuffer" warnings on every tracksVersion bump.
      const audioTracks = engineState.tracks.filter((t) => trackKind(t) !== 'midi');
      this._adoptLoadedClips(audioTracks);
      syncPeaksForChangedClips(this, audioTracks);
      this._announceLoading();
    }
    // Tick-based annotations: BPM changes move their time-domain positions —
    // re-derive the seconds caches (write-only-on-change; loop-safe).
    if (engineState.bpm !== this._lastAnnotationBpm) {
      this._lastAnnotationBpm = engineState.bpm;
      this._annotations.deriveSecondsCaches();
    }
  }
  private _onEngineStop(engine: PlaylistEngine): void {
    // Fires synchronously from PlaylistEngine.stop() (see engine CLAUDE.md
    // "Bounded playback" / #608) — reached via EITHER a consumer-initiated
    // stop (editor.stop(), or a seek-adjacent stop+reschedule guarded by
    // _inSeekTransition — pointer-handler seek, seekTo, splitAtPlayhead,
    // empty-timeline rewind) OR the engine's OWN bounded-playback
    // completion path: an adapter (Tone, native) reports `onPlaybackEnded` for a
    // duration-limited play(start, end) (selection/annotation playback),
    // and the engine calls `this.stop()` internally from a queued
    // microtask with no consumer call in sight. That engine-initiated case
    // has no other `daw-stop` dispatcher — mirror it here so consumers
    // still get a daw-stop paired with their earlier daw-play. Consumer
    // stops dispatch their own daw-stop (editor.stop(), guarded by
    // _inConsumerStop) or intentionally suppress it (seek-adjacent stops,
    // guarded by _inSeekTransition) — this handler must not double-fire
    // for those.
    this._currentTime = engine.getCurrentTime();
    this._stopPlayhead();
    this._activePlayEndTime = null;
    if (!this._inConsumerStop && !this._inSeekTransition && this.isConnected) {
      this.dispatchEvent(new CustomEvent('daw-stop', { bubbles: true, composed: true }));
    }
  }
  private _disposeEngine() {
    if (this._engine) {
      this._engine.dispose();
      this._engine = null;
    }
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
  /**
   * Imperatively load a `.mid` file (URL or File) and create N `<daw-track>`
   * elements — one per note-bearing MIDI track. On any per-track failure,
   * every `<daw-track>` appended during the call is removed (both successful
   * and failed) so the editor returns to its pre-call state.
   *
   * `options.signal` is forwarded to `fetch()` only for URL sources; aborting
   * after parsing does not cancel in-flight `addTrack` calls.
   *
   * Requires the optional `@dawcore/midi` peer dep — throws with an install
   * hint (and `console.warn`s the original error) when the dynamic import
   * fails for any reason.
   */
  async loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult> {
    return loadMidiImpl(this, source, options);
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
   * Add a track built from `config` to the arrangement the editor plays and
   * resolve with its id once it has entered (#848), before its audio has
   * loaded. No element is created: the track is drawn and listed like any
   * other, and `<daw-track>` children stay the page's declaration. To follow
   * loading, add the `daw-track-ready` / `daw-track-error` listener BEFORE
   * calling: for a track with nothing to fetch it fires before this
   * resolves. Without `editor.adapter` it waits for one. Rejects when the
   * arrangement refuses the track, when it is removed before it enters, or
   * when the engine cannot be built.
   */
  addTrack(config: TrackConfig = {}): Promise<string> {
    const trackId = crypto.randomUUID();
    let kind: TrackKind = config.kind ?? (config.midi ? 'midi' : 'audio');
    if (kind !== 'audio' && kind !== 'midi') {
      console.warn(
        '[dawcore] addTrack: kind "' +
          String(kind) +
          "\" is not a track kind ('audio' or 'midi'); using \"audio\""
      );
      kind = 'audio';
    }
    let renderMode = normalizeRenderMode(config.renderMode);
    if (renderMode === 'both') {
      console.warn(
        '[dawcore] render-mode="both" is not yet supported; falling back to \'spectrogram\''
      );
      renderMode = 'spectrogram';
    }
    const clipConfigs: ClipConfig[] = [...(config.clips ?? [])];
    if (config.midi) {
      clipConfigs.push({
        midiNotes: config.midi.notes,
        midiChannel: config.midi.channel,
        midiProgram: config.midi.program,
      });
    }
    const descriptor: StoredTrackDescriptor = {
      name: config.name || 'Untitled',
      src: '',
      kind,
      renderMode: trackDescriptorRenderMode(kind, renderMode),
      spectrogramConfig: config.spectrogramConfig ?? null,
      clips: clipConfigs.map((c) => clipDescriptorOf(c)),
    };
    const mix: TrackMixerValues = {
      volume: config.volume ?? DEFAULT_TRACK_MIX.volume,
      pan: config.pan ?? DEFAULT_TRACK_MIX.pan,
      muted: config.muted ?? false,
      soloed: config.soloed ?? false,
    };
    this._pending = new Map(this._pending).set(trackId, { descriptor, mix });
    const entered = this._waitForEntry(trackId);
    this._queueEntry(trackId);
    return entered;
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
      // Detached, the MutationObserver is off: remove the track here (#917).
      if (!this.isConnected) this._onTrackRemoved(trackId);
    } else if (
      this._pending.has(trackId) ||
      this._extras.has(trackId) ||
      this._isEntered(trackId)
    ) {
      // File-dropped and undo-restored tracks have no DOM element.
      this._onTrackRemoved(trackId);
    } else {
      console.warn('[dawcore] removeTrack: no track found for id "' + trackId + '"');
    }
  }
  /**
   * Move a track to a 0-based position in the arrangement's order (every
   * track counts, those with no element too; `trackEl.index` and
   * `editor.tracks` give the positions). One undo step; no element moves.
   */
  reorderTrack(trackId: string, toIndex: number): void {
    if (!Number.isFinite(toIndex)) {
      console.warn('[dawcore] reorderTrack: invalid toIndex ' + String(toIndex));
      return;
    }
    if (!this._isEntered(trackId)) {
      console.warn('[dawcore] reorderTrack: no track found for id "' + trackId + '"');
      return;
    }
    // The arrangement's order; no element moves (#848: the markup is the
    // starting declaration, order included).
    const last = this._arrangement.getTracks().length - 1;
    this._arrangement.reorderTrack(trackId, Math.max(0, Math.min(Math.trunc(toIndex), last)));
  }

  private _onTrackReorder = (e: CustomEvent<DawTrackReorderDetail>) => {
    this.reorderTrack(e.detail.trackId, e.detail.toIndex);
  };

  private _onTrackReorderGrab = (e: CustomEvent<DawTrackReorderGrabDetail>) => {
    if (!this.trackReordering) return;
    this._trackReorderDrag.onGrab(e.detail.trackId, e.detail.pointerEvent, e.detail.gripElement);
  };

  /**
   * Change a track: the mix (one undo step, #843), the name (an undo step),
   * the render mode and spectrogram config (the editor's). The arrangement
   * is changed, never an element's attributes (#848): a `<daw-track>`'s
   * properties show the change. A track that has not entered yet gets it as
   * the value it enters with.
   */
  updateTrack(trackId: string, partial: Partial<TrackConfig>): void {
    if (!this._isEntered(trackId)) {
      this._updatePendingTrack(trackId, partial);
      return;
    }
    const mix: Partial<TrackMixerValues> = {
      volume: partial.volume,
      pan: partial.pan,
      muted: partial.muted,
      soloed: partial.soloed,
    };
    this._writeMixFields(trackId, mix);
    if (partial.name !== undefined) this._renameTrack(trackId, partial.name);
    const extras = this._extras.get(trackId) ?? this._defaultExtras(trackId);
    if (!extras) return;
    let renderMode =
      partial.renderMode === undefined ? undefined : normalizeRenderMode(partial.renderMode);
    if (renderMode === 'both') {
      console.warn(
        '[dawcore] render-mode="both" is not yet supported; falling back to \'spectrogram\''
      );
      renderMode = 'spectrogram';
    }
    if (renderMode === undefined && partial.spectrogramConfig === undefined) return;
    const next: TrackExtras = {
      ...extras,
      ...(renderMode !== undefined && {
        renderMode: trackDescriptorRenderMode(extras.kind, renderMode),
      }),
      ...(partial.spectrogramConfig !== undefined && {
        spectrogramConfig: partial.spectrogramConfig,
      }),
    };
    this._extras = new Map(this._extras).set(trackId, next);
    if (next.spectrogramConfig !== extras.spectrogramConfig) {
      this._spectrogramController?.setTrackConfig(trackId, next.spectrogramConfig ?? null);
    }
  }
  /** `updateTrack` on a track waiting to enter: the values it will enter with. */
  private _updatePendingTrack(trackId: string, partial: Partial<TrackConfig>): void {
    const pending = this._pending.get(trackId);
    if (!pending) {
      console.warn('[dawcore] updateTrack: no track found for id "' + trackId + '"');
      return;
    }
    if ('element' in pending) {
      // Before entry an element's properties are its declaration (P9).
      const el = pending.element;
      if (partial.name !== undefined) el.name = partial.name;
      if (partial.volume !== undefined) el.volume = partial.volume;
      if (partial.pan !== undefined) el.pan = partial.pan;
      if (partial.muted !== undefined) el.muted = partial.muted;
      if (partial.soloed !== undefined) el.soloed = partial.soloed;
      if (partial.renderMode !== undefined) el.renderMode = partial.renderMode;
      return;
    }
    const { descriptor, mix } = pending;
    this._pending = new Map(this._pending).set(trackId, {
      descriptor: {
        ...descriptor,
        ...(partial.name !== undefined && { name: partial.name }),
        ...(partial.renderMode !== undefined && {
          renderMode: trackDescriptorRenderMode(
            descriptor.kind,
            normalizeRenderMode(partial.renderMode)
          ),
        }),
      },
      mix: {
        volume: partial.volume ?? mix.volume,
        pan: partial.pan ?? mix.pan,
        muted: partial.muted ?? mix.muted,
        soloed: partial.soloed ?? mix.soloed,
      },
    });
  }
  /**
   * Add a clip to a track (with or without an element) and resolve with its
   * id once its audio has loaded (`daw-clip-ready`, before its peaks are
   * drawn). The clip enters the arrangement as a loading clip, one undo
   * step; no `<daw-clip>` is created (#848). Rejects when it fails to load,
   * is refused (its kind), or leaves the arrangement before it loads (a
   * removal, an Undo). A clip added while the editor is detached loads once
   * a fresh adapter is set.
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
    const pending = this._pending.get(trackId);
    if (!this._isEntered(trackId) && !pending) {
      return Promise.reject(
        new Error(
          'addClip: track "' +
            trackId +
            '" is not in the editor (an Undo took it out, the arrangement refused it, or no ' +
            'track has this id)'
        )
      );
    }
    const clipDesc = clipDescriptorOf(config);
    const clipId = clipDesc.clipId;
    // Settled by daw-clip-ready / daw-clip-error for this clip; and, since a
    // clip that leaves the arrangement before its audio loads (a removal, an
    // Undo, its track removed) is never announced, rejected once it has been
    // in the arrangement and is gone (#917). Every way out removes all three
    // listeners.
    return new Promise<string>((resolve, reject) => {
      let seen = false;
      const onReady = (e: Event) => {
        if ((e as CustomEvent<DawClipIdDetail>).detail.clipId !== clipId) return;
        cleanup();
        resolve(clipId);
      };
      const onError = (e: Event) => {
        const detail = (e as CustomEvent<DawClipErrorDetail>).detail;
        if (detail.clipId !== clipId) return;
        cleanup();
        reject(detail.error instanceof Error ? detail.error : new Error(String(detail.error)));
      };
      const stopWatching = this._arrangement.subscribe(() => {
        const present = this._arrangement
          .getTracks()
          .some((t) => t.clips.some((c) => c.id === clipId));
        if (present) {
          seen = true;
        } else if (seen) {
          cleanup();
          reject(new Error('clip "' + clipId + '" was removed before its audio loaded'));
        }
      });
      const cleanup = () => {
        this.removeEventListener('daw-clip-ready', onReady);
        this.removeEventListener('daw-clip-error', onError);
        stopWatching();
        this._awaitedClips.delete(clipId);
      };
      this.addEventListener('daw-clip-ready', onReady);
      this.addEventListener('daw-clip-error', onError);
      this._awaitedClips.set(clipId, {
        trackId,
        reject: (error) => {
          cleanup();
          reject(error);
        },
      });
      if (this._isEntered(trackId)) {
        seen = true;
        this._loadAndAppendClip(trackId, clipDesc);
      } else if (pending) {
        // It enters with its track.
        this._pending = new Map(this._pending).set(
          trackId,
          'element' in pending
            ? { ...pending, extraClips: [...pending.extraClips, clipDesc] }
            : {
                ...pending,
                descriptor: {
                  ...pending.descriptor,
                  clips: [...pending.descriptor.clips, clipDesc],
                },
              }
        );
      }
    });
  }
  /**
   * Remove a clip by id: its `<daw-clip>` when there is one (the observer
   * removes the clip, as `select.remove(i)` removes an option), otherwise
   * the clip itself, one undo step. Undo brings the clip back with no
   * element. No-op with a warning when there is no such clip.
   */
  removeClip(trackId: string, clipId: string): void {
    const trackEl = this._trackElements.get(trackId);
    const clipEl = trackEl
      ? ([...trackEl.querySelectorAll('daw-clip')].find(
          (c) => (c as DawClipElement).clipId === clipId
        ) as DawClipElement | undefined)
      : undefined;
    if (clipEl) {
      clipEl.remove();
      // Detached, the MutationObserver is off: remove the clip here.
      if (!this.isConnected && this._isEntered(trackId)) this._removeClipFromTrack(trackId, clipId);
      return;
    }
    if (this._isEntered(trackId)) {
      this._removeClipFromTrack(trackId, clipId);
      return;
    }
    // A clip addClip() gave a track that has not entered yet.
    const pending = this._pending.get(trackId);
    if (pending) {
      const without = (clips: ClipDescriptor[]) => clips.filter((c) => c.clipId !== clipId);
      this._pending = new Map(this._pending).set(
        trackId,
        'element' in pending
          ? { ...pending, extraClips: without(pending.extraClips) as DropClipDescriptor[] }
          : {
              ...pending,
              descriptor: { ...pending.descriptor, clips: without(pending.descriptor.clips) },
            }
      );
      this._rejectAwaitedClips((id) => id === clipId, 'the clip was removed before it loaded');
      return;
    }
    console.warn(
      '[dawcore] removeClip: no track found for id "' + trackId + '" (clipId "' + clipId + '")'
    );
  }
  /**
   * Change a clip's position (start/duration/offset), gain or name: one undo
   * step on the arrangement (#848; a clip still loading changes its loading
   * clip). A `<daw-clip>`'s properties show the change, its attributes do
   * not. Fades are a `<daw-clip>` declaration only (engine-side fades are
   * #489): `fadeIn` / `fadeOut` / `fadeType` here change nothing.
   *
   * Re-decoding (changing `src`) is not supported via this method — remove and
   * re-add the clip instead.
   */
  updateClip(trackId: string, clipId: string, partial: Partial<ClipConfig>): void {
    if (!this._isEntered(trackId)) {
      console.warn('[dawcore] updateClip: no track found for id "' + trackId + '"');
      return;
    }
    if (!this._clipValues(trackId, clipId)) {
      console.warn(
        '[dawcore] updateClip: clip "' + clipId + '" not found in track "' + trackId + '"'
      );
      return;
    }
    const request: Partial<ClipLinkValues> = {};
    if (partial.start !== undefined) request.start = partial.start;
    if (partial.duration !== undefined) request.duration = partial.duration;
    if (partial.offset !== undefined) request.offset = partial.offset;
    if (partial.gain !== undefined) request.gain = partial.gain;
    if (partial.name !== undefined) request.name = partial.name;
    if (partial.midiNotes !== undefined) request.midiNotes = partial.midiNotes;
    if (partial.midiChannel !== undefined) request.midiChannel = partial.midiChannel;
    if (partial.midiProgram !== undefined) request.midiProgram = partial.midiProgram;
    this._requestClipChange(trackId, clipId, request);
  }
  // --- Playback ---
  /**
   * Start playback, optionally seeking to `startTime` first. When `endTime`
   * is provided, playback stops at that time (selection/annotation playback).
   */
  async play(startTime?: number, endTime?: number) {
    try {
      const engine = await this._ensureEngine();
      // Always init — resumes AudioContext if suspended (requires user gesture).
      await engine.init();
      // Register the editor's rAF loop BEFORE starting the low-level engine
      // playback: the catch block below relies on it having been started so
      // it can undo it. Bounded play(start, end) completion does NOT depend
      // on this loop racing the transport: the native transport's timer runs
      // in a Worker (not rAF, #636) and reports its endTime self-stop through
      // the adapter's onPlaybackEnded hook → engine 'stop' → the daw-stop
      // dispatch in the engine stop handler. This loop's own time >= endTime
      // check is a belt-and-braces path for adapters without the hook.
      this._activePlayEndTime = endTime ?? null;
      this._startPlayhead();
      engine.play(startTime, endTime);
      this.dispatchEvent(new CustomEvent('daw-play', { bubbles: true, composed: true }));
    } catch (err) {
      // _startPlayhead() above runs BEFORE engine.play() (see the ordering
      // comment above), so a throwing engine.play() (PlaylistEngine rolls
      // back its own state and rethrows on adapter.play() failure) leaves a
      // dangling rAF loop unless we undo the pre-start here — mirrors stop().
      this._stopPlayhead();
      this._activePlayEndTime = null;
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
    this._activePlayEndTime = null;
    // The engine 'stop' handler fires SYNCHRONOUSLY during engine.stop() —
    // bracket it so that handler's own daw-stop dispatch is suppressed and
    // this method remains the single dispatcher for a consumer-initiated stop.
    this._inConsumerStop = true;
    try {
      this._engine.stop();
    } finally {
      this._inConsumerStop = false;
    }
    this._stopPlayhead();
    this.dispatchEvent(new CustomEvent('daw-stop', { bubbles: true, composed: true }));
  }
  /** Toggle between play and pause. */
  togglePlayPause() {
    if (this.isRecording) {
      this.togglePauseRecording();
    } else if (this._isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }
  /** Run `fn` with the stop-settle daw-timeupdate suppressed. Every
   * stop-adjacent code path that immediately re-positions (seek, split,
   * empty-timeline rewind) must use this — engine.stop() rewinds to the
   * play-start position and the settle would leak a backward-jumping
   * daw-timeupdate to consumers (CLAUDE.md seek-while-playing invariant).
   * The `finally` is load-bearing: a wedged true silently drops every
   * subsequent stop-settle dispatch. */
  private _withSeekSuppression(fn: () => void) {
    this._inSeekTransition = true;
    try {
      fn();
    } finally {
      this._inSeekTransition = false;
    }
  }

  seekTo(time: number) {
    if (!this._engine) {
      console.warn('[dawcore] seekTo: engine not ready, call ignored');
      return;
    }
    if (!Number.isFinite(time)) {
      // NaN would reach the adapter clock and wedge playback until a valid seek.
      console.warn('[dawcore] seekTo: ignoring non-finite time ' + String(time));
      return;
    }
    const target = Math.max(0, time);
    if (this._isPlaying) {
      // Transport needs stop+play to reschedule audio sources at the new
      // position — but via DIRECT engine calls (synchronous), not the public
      // stop()/play(): those dispatch daw-stop/daw-play (spurious for a
      // seek — consumers keyed on them misfire on every programmatic seek)
      // and the async play() opens a window where a user pause is overridden
      // by the deferred play. The engine is already initialized while
      // playing. Mirrors the pointer-handler seek path.
      try {
        this._withSeekSuppression(() => this._engine!.stop());
        this._engine.play(target);
      } catch (err) {
        // The engine rethrows adapter failures — surface via daw-error like
        // the public play() path does, instead of an unheralded throw.
        console.warn('[dawcore] seekTo: engine reschedule failed: ' + String(err));
        this.dispatchEvent(
          new CustomEvent('daw-error', {
            bubbles: true,
            composed: true,
            detail: { operation: 'seek', error: err },
          })
        );
        return;
      }
      // Seeking past a bounded (selection/annotation) play reschedules via
      // the engine directly (no endTime) — clear the stale watermark so
      // the rAF loop doesn't stop the resumed playback prematurely at the
      // old bound. Mirrors Transport.seek()'s own _endTime clearing.
      this._activePlayEndTime = null;
      this._currentTime = target;
      this._startPlayhead();
    } else {
      this._engine.seek(target);
      this._currentTime = target;
      this._stopPlayhead();
    }
    this.dispatchEvent(
      new CustomEvent('daw-seek', {
        bubbles: true,
        composed: true,
        detail: { time: target },
      })
    );
  }

  /**
   * A clip or track drag is in progress: undo and redo do nothing until it
   * ends (#848). A clip counts once its pointer has moved past the drag
   * threshold; annotation drags do not count (annotations are not in the
   * undo history).
   */
  get _dragInProgress(): boolean {
    return this._clipPointer.isDragging || this._trackReorderDrag.isActive;
  }

  /**
   * Cancel every drag in progress, as a `pointercancel` would. Returns whether
   * one was. A clip or annotation press that has not moved is not a drag and
   * is left alone, unless `includePresses` (the editor's disconnect, which
   * ends every pointer interaction).
   */
  _cancelDrags(includePresses = false): boolean {
    let cancelled = false;
    if (includePresses || this._clipPointer.isDragging) {
      cancelled = this._pointer.cancelClipDrag() || cancelled;
    }
    if (this._trackReorderDrag.isActive) {
      this._trackReorderDrag.cancel();
      cancelled = true;
    }
    const annotation = this._annotationDrag;
    if (includePresses ? annotation.isActive : annotation.isDragging) {
      annotation.cancel();
      cancelled = true;
    }
    return cancelled;
  }

  /**
   * Escape during a drag cancels it and does nothing else: the default is
   * prevented, so `<daw-keyboard-shortcuts>` (core's `handleKeyboardEvent`)
   * does not also stop playback. No `stopPropagation`: an app's own listener
   * can read `defaultPrevented`.
   */
  private _onDragEscape = (e: KeyboardEvent) => {
    if (e.key !== 'Escape') return;
    if (this._cancelDrags()) e.preventDefault();
  };

  /** Undo the last edit. Does nothing while a drag is in progress. */
  undo(): void {
    if (this._dragInProgress) return;
    if (!this._engine) {
      console.warn('[dawcore] undo: engine not ready, call ignored');
      return;
    }
    this._engine.undo();
  }

  /** Redo the last undone edit. Does nothing while a drag is in progress. */
  redo(): void {
    if (this._dragInProgress) return;
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
        // Suppressed settle: without it every split during playback leaks a
        // backward-jumping daw-timeupdate (30→0→30) before play(time) resumes.
        this._withSeekSuppression(() => {
          this._engine?.stop();
          this._stopPlayhead();
        });
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
  /** Read-only: whether playback is running (HTMLMediaElement-adjacent). */
  get isPlaying(): boolean {
    return this._isPlaying;
  }
  /** Read-only: total content duration in seconds. */
  get duration(): number {
    return this._duration;
  }
  get isRecording(): boolean {
    return this._recordingController.isRecording;
  }
  get isRecordingPaused(): boolean {
    return this._recordingController.isPaused;
  }
  pauseRecording(): void {
    this._recordingController.pauseRecording();
  }
  resumeRecording(): void {
    this._recordingController.resumeRecording();
    // Programmatic resume bypasses togglePauseRecording — clear the
    // ref so the next pause cycle doesn't restart Transport based on
    // stale state from an earlier toggle.
    this._wasPlayingDuringRecording = false;
  }
  /**
   * Audacity-style pause toggle for active recordings: pauses both the
   * worklet capture and (if running) the playback Transport. On resume,
   * Transport restarts only if it was running before — non-overdub
   * recordings stay silent on resume.
   */
  togglePauseRecording(): void {
    if (!this.isRecording) return;
    if (this.isRecordingPaused) {
      // Snapshot the flag before resumeRecording — that method clears
      // the ref defensively (so external callers don't leak it into the
      // next cycle), so reading after the call is too late.
      const wasPlaying = this._wasPlayingDuringRecording;
      this.resumeRecording();
      if (wasPlaying) {
        // play() is async on the editor; fire and forget — caller doesn't await.
        void this.play(this.currentTime);
      }
    } else {
      this.pauseRecording();
      if (this._isPlaying) {
        this._wasPlayingDuringRecording = true;
        this.pause();
      }
    }
  }
  /** Set in togglePauseRecording when Transport is paused alongside the
   * worklet, so resume can restart it. Cleared on resume and on stop. */
  private _wasPlayingDuringRecording = false;
  stopRecording(): Promise<void> {
    this._wasPlayingDuringRecording = false;
    return this._recordingController.stopRecording();
  }
  _addRecordedClip(
    trackId: string,
    buf: AudioBuffer,
    startSample: number,
    durSamples: number,
    offsetSamples = 0,
    clipName?: string
  ) {
    addRecordedClip(this, trackId, buf, startSample, durSamples, offsetSamples, clipName);
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
    // A take is audio: it cannot land on a MIDI track (#756).
    const targetId = options?.trackId ?? this._selectedTrackId;
    const target = targetId
      ? this._arrangement.getTracks().find((t) => t.id === targetId)
      : undefined;
    if (targetId && target && trackKind(target) === 'midi') {
      const error = new Error(
        'Cannot record onto MIDI track "' +
          target.name +
          '": a recording is audio. Select or create an audio track first.'
      );
      console.warn('[dawcore] startRecording: ' + error.message);
      this.dispatchEvent(
        new CustomEvent<DawRecordingErrorDetail>('daw-recording-error', {
          bubbles: true,
          composed: true,
          detail: { trackId: targetId, error },
        })
      );
      return;
    }
    await this._recordingController.startRecording(s, options);
  }

  /** Live-recording preview left/width. Beats mode uses the same tick-space
   * math as finalized clips — the sample÷renderSpp path is ceil-quantized,
   * so the take would visibly jump sideways on finalization (drift grows
   * with distance from t=0; CLAUDE.md live-preview parity invariant). */
  private _previewPosition(
    startSample: number,
    audibleSamples: number
  ): { left: number; width: number } {
    if (this.scaleMode === 'beats') {
      const sr = this.effectiveSampleRate;
      const startSec = startSample / sr;
      const startTick = this._secondsToTicks(startSec);
      const endTick = this._secondsToTicks(startSec + audibleSamples / sr);
      const left = Math.round(startTick / this.ticksPerPixel);
      return { left, width: Math.round(endTick / this.ticksPerPixel) - left };
    }
    const renderSpp = this._renderSpp;
    return {
      left: Math.floor(startSample / renderSpp),
      width: Math.floor(audibleSamples / renderSpp),
    };
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
    const { left, width: w } = this._previewPosition(rs.startSample, audibleSamples);
    // Same container + header chrome as finalized clips so the take reads as
    // a clip WHILE it's being captured, and the waveforms sit at the same
    // vertical offset they'll have after finalization. The container's width
    // stays in sync with the growing take: the RecordingController calls
    // requestUpdate() whenever the preview grows a pixel (overflow:hidden on
    // .clip-container would otherwise clip the live canvas growth).
    const hdrH = this.clipHeaders ? this.clipHeaderHeight : 0;
    const height = hdrH + chH * rs.peaks.length;
    return html`<div
      class="clip-container recording-preview"
      style="left:${left}px;top:0;width:${w}px;height:${height}px;"
    >
      ${hdrH > 0
        ? html`<div class="clip-header" data-track-id=${trackId}>
            <span>${rs.clipName ?? 'Recording…'}</span>
          </div>`
        : ''}
      ${rs.peaks.map((chPeaks, ch) => {
        // Slice peaks to skip latency prefix (2 entries per pixel: min/max)
        const slicedPeaks = latencyPixels > 0 ? chPeaks.slice(latencyPixels * 2) : chPeaks;
        return html`
          <daw-waveform
            data-recording-track=${trackId}
            data-recording-channel=${ch}
            style="position:absolute;left:0;top:${hdrH + ch * chH}px;"
            .peaks=${slicedPeaks}
            .length=${w}
            .waveHeight=${chH}
            .barWidth=${this.barWidth}
            .barGap=${this.barGap}
            .roundedBars=${this.roundedBars}
            .visibleStart=${this._viewport.visibleStart}
            .visibleEnd=${this._viewport.visibleEnd}
            .originX=${left}
          ></daw-waveform>
        `;
      })}
    </div>`;
  }
  // --- Playback animation (single RAF loop: playhead + daw-timeupdate) ---
  /** Convert playback seconds to a timeline pixel offset for the active mode. */
  private _timeToPixels = (time: number): number => {
    if (this.scaleMode === 'beats') {
      return this._secondsToTicks(time) / this.ticksPerPixel;
    }
    return (time * this.effectiveSampleRate) / this.samplesPerPixel;
  };

  _startPlayhead() {
    if (!this._engine) return;
    const engine = this._engine;
    // engine.getAudibleTime(): while playing, engine time minus hardware DAC
    // latency (outputLatency) and scheduler lookahead (0.1s on Tone-backed
    // adapters, 0 native), held at the play-start position during the
    // pre-roll window. Without the subtraction the playhead leads audio by
    // ~100ms with the Tone adapter.
    // Runs even when the playhead element isn't rendered (empty/indefinite
    // editors) so daw-timeupdate consumers still get frames.
    this._playbackAnimation.start(() => {
      // Bounded playback (selection/annotation via play(start, end)): an
      // adapter with the onPlaybackEnded hook reports its endTime self-stop
      // through the engine's `stop` event; this check is the fallback for
      // adapters without it. Checked before the whole-track duration bound
      // below.
      if (
        this._activePlayEndTime !== null &&
        !this.isRecording &&
        engine.getCurrentTime() >= this._activePlayEndTime
      ) {
        this.stop();
        const t = this._currentTime;
        return Number.isFinite(t) ? Math.max(0, t) : 0;
      }
      // Auto-stop at the end of the timeline (player-style default — parity
      // with the React provider's animation loop). `indefinite-playback`
      // opts out (DAW-style: roll until explicit stop), and an active
      // recording session must run past the end of existing material
      // (punch-in takes land beyond the current duration). Raw engine time
      // is the boundary check, matching React's loop.
      if (
        !this.indefinitePlayback &&
        !this.isRecording &&
        engine.getCurrentTime() >= this._duration
      ) {
        this.stop();
        // stop() rewinds to the play-start position via the engine 'stop'
        // handler; settle this frame on that resting position.
        const t = this._currentTime;
        return Number.isFinite(t) ? Math.max(0, t) : 0;
      }
      return engine.getAudibleTime();
    });
  }
  _stopPlayhead() {
    // Resting playhead displays the raw position — latency compensation is a
    // playback-time concept (Transport scheduling vs audible output). A
    // seeked/stopped/paused cursor shows exactly the commanded position.
    // Storage (`_currentTime`) is already raw, so play() resumes correctly.
    const t = this._currentTime;
    const visualTime = Number.isFinite(t) ? Math.max(0, t) : 0;
    this._playbackAnimation.stop(visualTime, { dispatch: !this._inSeekTransition });
  }
  private _getPlayhead(): DawPlayheadElement | null {
    return this.shadowRoot?.querySelector('daw-playhead') as DawPlayheadElement | null;
  }

  /** True when the controls column should be rendered (and its selector is valid). */
  private get _showControls(): boolean {
    return this._getOrderedTracks().length > 0 || this.indefinitePlayback || this.fillViewport;
  }

  /** True when the ruler header band should be rendered (and its selector is valid). */
  private get _showRuler(): boolean {
    return (
      (this._getOrderedTracks().length > 0 ||
        this.scaleMode === 'beats' ||
        this.indefinitePlayback ||
        this.fillViewport) &&
      this.timescale
    );
  }

  /**
   * `<daw-track>` elements the page moved (one MutationObserver batch): each
   * is placed after the arrangement track of the nearest `<daw-track>` before
   * it, in DOM order, as one undo step (#848 P13). Elements whose track is
   * not in the arrangement are left alone (a queued one enters at its DOM
   * position). The arrangement's own order changes (an Undo) move no element.
   */
  private _placeMovedTracks(movedIds: ReadonlySet<string>): void {
    const els = [...this.querySelectorAll('daw-track')] as DawTrackElement[];
    const moved = els.filter((el) => movedIds.has(el.trackId) && this._isEntered(el.trackId));
    if (moved.length === 0) return;
    const arrangement = this._arrangement;
    arrangement.beginTransaction();
    try {
      for (const el of moved) {
        const others = arrangement
          .getTracks()
          .map((t) => t.id)
          .filter((id) => id !== el.trackId);
        // The index it already has changes nothing.
        arrangement.reorderTrack(el.trackId, entryIndex(els, el.trackId, others));
      }
    } finally {
      arrangement.commitTransaction();
    }
  }

  /**
   * The rows, in the arrangement's order (#848): each track's loaded clips
   * (the engine's projection, with the current mix) and the clips still loading.
   */
  private _getOrderedTracks(): Array<[string, ClipTrack, LoadingClip[]]> {
    const rows: Array<[string, ClipTrack, LoadingClip[]]> = [];
    for (const track of this._arrangement.getTracks()) {
      const loaded = loadedTrack(
        track,
        this._mixOf(track.id),
        this._arrangement.recordingTrackIds.has(track.id)
      );
      rows.push([track.id, loaded, track.clips.filter(isLoadingClip)]);
    }
    return rows;
  }
  /**
   * A clip still loading: a placeholder box where its length is known, with
   * its `.dat` peaks when they came, drawn failed when its source failed. Its
   * header carries no clip id, so it cannot be dragged.
   */
  private _renderPlaceholder(
    clip: LoadingClip,
    row: { trackId: string; trackHeight: number; descriptor?: RowInfo }
  ) {
    const seconds = this._placeholderSeconds(clip);
    if (seconds === null) return '';
    const sr = this.effectiveSampleRate;
    const spp = this._renderSpp;
    const startSec = clip.start ?? 0;
    let left: number;
    let width: number;
    if (this.scaleMode === 'beats') {
      left = Math.round(this._secondsToTicks(startSec) / this.ticksPerPixel);
      width = Math.round(this._secondsToTicks(startSec + seconds) / this.ticksPerPixel) - left;
    } else {
      const startSample = Math.round(startSec * sr);
      left = Math.floor(startSample / spp);
      width = clipPixelWidth(startSample, Math.round(seconds * sr), spp);
    }
    const failed =
      this._arrangement.sources.getSnapshot().sources.get(clip.src)?.status === 'failed';
    const peakData = this._previewPeaks.get(clip.id);
    const hdrH = this.clipHeaders ? this.clipHeaderHeight : 0;
    const chH = this.waveHeight;
    return html`<div
      class="clip-container placeholder ${failed ? 'failed' : ''}"
      style="left:${left}px;top:0;width:${width}px;height:${row.trackHeight}px;"
      data-clip-id=${clip.id}
    >
      ${hdrH > 0
        ? html`<div class="clip-header">
            <span>${clip.name || row.descriptor?.name || ''}</span>
          </div>`
        : ''}
      ${(peakData?.data ?? []).map(
        (chPeaks, chIdx) =>
          html`<daw-waveform
            style="position:absolute;left:0;top:${hdrH + chIdx * chH}px;"
            .peaks=${chPeaks}
            .length=${peakData?.length ?? width}
            .waveHeight=${chH}
            .barWidth=${this.barWidth}
            .barGap=${this.barGap}
            .roundedBars=${this.roundedBars}
            .visibleStart=${this._viewport.visibleStart}
            .visibleEnd=${this._viewport.visibleEnd}
            .originX=${left}
          ></daw-waveform>`
      )}
    </div>`;
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
    const orderedTracks = this._getOrderedTracks().map(([trackId, track, loading]) => {
      // What the template reads about the track: from the arrangement and the extras.
      const descriptor: RowInfo = {
        name: track.name ?? '',
        kind: trackKind(track),
        renderMode: this._renderModeOf(trackId),
      };
      const firstPeaks = [...track.clips, ...loading]
        .map((c) => this._peaksData.get(c.id) ?? this._previewPeaks.get(c.id))
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
        loading,
        descriptor,
        numChannels,
        trackHeight: this.waveHeight * numChannels + (this.clipHeaders ? this.clipHeaderHeight : 0),
      };
    });

    const showControls = this._showControls;
    const showRuler = this._showRuler;

    return html`
      ${showRuler
        ? html`<div class="header-row" style="height: ${RULER_HEIGHT}px;">
            ${showControls ? html`<div class="ruler-gap"></div>` : ''}
            <div class="ruler-viewport" @pointerdown=${this._pointer.onPointerDown}>
              <div
                class="ruler-content"
                style="width: ${this._totalWidth > 0 ? this._totalWidth + 'px' : '100%'};"
              >
                <daw-ruler
                  .samplesPerPixel=${spp}
                  .sampleRate=${this.effectiveSampleRate}
                  .duration=${this._duration}
                  .scaleMode=${this.scaleMode}
                  .ticksPerPixel=${this.ticksPerPixel}
                  .meterEntries=${this._meterEntries}
                  .ppqn=${this.ppqn}
                  .totalWidth=${this._totalWidth}
                  .rulerHeight=${RULER_HEIGHT}
                ></daw-ruler>
              </div>
            </div>
          </div>`
        : ''}
      <div class="body">
        ${showControls
          ? html`<div class="controls-viewport">
              <div class="controls-column">
                ${this._annotations.tracks.map(
                  (track) =>
                    html`<div
                      class="annotation-lane-spacer"
                      style="height: ${ANNOTATION_LANE_HEIGHT}px;"
                    >
                      <span class="annotation-lane-name">${track.name}</span>
                    </div>`
                )}
                ${orderedTracks.map((t, i) => {
                  const mix = this._mixOf(t.trackId);
                  return html`
                    <daw-track-controls
                      style="height: ${t.trackHeight}px;"
                      .trackId=${t.trackId}
                      .trackName=${t.descriptor?.name ?? 'Untitled'}
                      .volume=${mix.volume}
                      .pan=${mix.pan}
                      .muted=${mix.muted}
                      .recording=${this._engine?.recordingTrackIds.has(t.trackId) ?? false}
                      .soloed=${mix.soloed}
                      .reorderable=${this.trackReordering}
                      .trackIndex=${i}
                      .trackCount=${orderedTracks.length}
                    ></daw-track-controls>
                  `;
                })}
              </div>
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
            ${this._annotations.renderLanes(
              spp,
              this.effectiveSampleRate,
              this._annotationDrag.onPointerDown,
              this.scaleMode === 'beats' ? this.ticksPerPixel : null
            )}
            ${this.scaleMode === 'beats'
              ? html`<daw-grid
                  style="top: ${this._annotations.totalLaneHeight}px;"
                  .ticksPerPixel=${this.ticksPerPixel}
                  .meterEntries=${this._meterEntries}
                  .ppqn=${this.ppqn}
                  .visibleStart=${this._viewport.visibleStart}
                  .visibleEnd=${this._viewport.visibleEnd}
                  .length=${this._totalWidth}
                  .height=${orderedTracks.length > 0
                    ? orderedTracks.reduce((sum, t) => sum + t.trackHeight, 0)
                    : this._emptyGridHeight}
                ></daw-grid>`
              : ''}
            ${orderedTracks.length > 0 ||
            this.scaleMode === 'beats' ||
            this.indefinitePlayback ||
            this.fillViewport
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
                    const peakData =
                      this._peaksData.get(clip.id) ?? this._previewPeaks.get(clip.id);
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
                            peakStart: Math.max(
                              0,
                              (segStartSample - clip.offsetSamples) / baseScale
                            ),
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
                      ${t.descriptor?.kind === 'midi'
                        ? html`<daw-piano-roll
                            style="position:absolute;left:0;top:${hdrH}px;"
                            .midiNotes=${clip.midiNotes ?? []}
                            .length=${peakData?.length ?? width}
                            .waveHeight=${chH * channels.length}
                            .samplesPerPixel=${this._renderSpp}
                            .sampleRate=${this.effectiveSampleRate}
                            .clipOffsetSeconds=${(clip.offsetSamples ?? 0) /
                            this.effectiveSampleRate}
                            .visibleStart=${this._viewport.visibleStart}
                            .visibleEnd=${this._viewport.visibleEnd}
                            .originX=${clipLeft}
                            ?selected=${t.trackId === this._selectedTrackId}
                          ></daw-piano-roll>`
                        : t.descriptor?.renderMode === 'spectrogram'
                          ? channels.map(
                              (_chPeaks, chIdx) =>
                                html`<daw-spectrogram
                                  style="position:absolute;left:0;top:${hdrH +
                                  chIdx * chH}px;height:${chH}px;width:${peakData?.length ??
                                  width}px;"
                                  .clipId=${clip.id}
                                  .trackId=${t.trackId}
                                  .channelIndex=${chIdx}
                                  .length=${peakData?.length ?? width}
                                  .waveHeight=${chH}
                                  .samplesPerPixel=${this._renderSpp}
                                  .sampleRate=${this.effectiveSampleRate}
                                  .clipOffsetSeconds=${(clip.offsetSamples ?? 0) /
                                  this.effectiveSampleRate}
                                  .visibleStart=${this._viewport.visibleStart}
                                  .visibleEnd=${this._viewport.visibleEnd}
                                  .originX=${clipLeft}
                                ></daw-spectrogram>`
                            )
                          : channels.map(
                              (chPeaks, chIdx) =>
                                html` <daw-waveform
                                  style="position:absolute;left:0;top:${hdrH + chIdx * chH}px;"
                                  .peaks=${chPeaks}
                                  .length=${peakData?.length ?? width}
                                  .waveHeight=${chH}
                                  .barWidth=${this.barWidth}
                                  .barGap=${this.barGap}
                                  .roundedBars=${this.roundedBars}
                                  .gain=${this.gainScaledWaveforms ? (clip.gain ?? 1) : 1}
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
                  ${t.loading.map((clip) => this._renderPlaceholder(clip, t))}
                  ${this._renderRecordingPreview(t.trackId, channelHeight)}
                </div>
              `;
            })}
          </div>
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
