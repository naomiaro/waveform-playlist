/**
 * PlaylistEngine — Stateful, framework-agnostic timeline engine.
 *
 * Composes an Arrangement (the tracks, the mix, the undo history and
 * transactions) with an event emitter and optional PlayoutAdapter for audio
 * playback delegation. A track method calls the arrangement; the engine
 * subscribes to the arrangement and, for each change it is told about, makes
 * the adapter call and emits `statechange`.
 */

import type { ClipTrack } from '@waveform-playlist/core';
import { AdapterSync } from './adapterSync';
import type { TracksChange } from './adapterSync';
import { ArrangementImpl } from './arrangement/Arrangement';
import type { ArrangementChange, ArrangementVersions } from './arrangement/Arrangement';
import type { AddTrackOptions, ClipBounds, MixerChangeOptions } from './arrangement';
import { attachDecodeContext, attachTimeBase, isArrangement } from './arrangement/attach';
import { calculateDuration, findClosestZoomIndex } from './operations/timelineOperations';
import type {
  PlayoutAdapter,
  EngineState,
  EngineEvents,
  PlaylistEngineOptions,
  EngineDisposeOptions,
} from './types';

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_SAMPLES_PER_PIXEL = 1024;
const DEFAULT_ZOOM_LEVELS = [256, 512, 1024, 2048, 4096, 8192];

type EventName = keyof EngineEvents;

export class PlaylistEngine {
  private _arrangement: ArrangementImpl;
  private _stopFollowingArrangement: () => void;
  private _detachFromArrangement: () => void;
  private _detachDecodeContext: (() => void) | null = null;
  private _adapterSync: AdapterSync;
  private _currentTime = 0;
  private _playStartPosition = 0;
  private _isPlaying = false;
  private _selectedTrackId: string | null = null;
  private _sampleRate: number;
  private _zoomLevels: number[];
  private _zoomIndex: number;
  private _selectionStart = 0;
  private _selectionEnd = 0;
  private _masterVolume = 1.0;
  private _loopStart = 0;
  private _loopEnd = 0;
  private _isLoopEnabled = false;
  private _bpm: number;
  private _ppqn: number;
  private _adapter: PlayoutAdapter | null;
  private _disposed = false;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private _listeners: Map<string, Set<Function>> = new Map();

  readonly undoLimit: number;

  constructor(options: PlaylistEngineOptions = {}) {
    this._sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    this._zoomLevels = [...(options.zoomLevels ?? DEFAULT_ZOOM_LEVELS)];
    this._adapter = options.adapter ?? null;

    // Bounded playback (#608): adapters that self-terminate at an endTime
    // report completion here. Deferred via queueMicrotask — the Tone adapter
    // fires this from inside the Transport tick chain, which catches nothing;
    // stopping the Transport re-entrantly from a tick callback is the hazard
    // the microtask sidesteps. Re-check _isPlaying inside: a consumer stop()
    // can land between the callback and the microtask.
    this._adapter?.onPlaybackEnded?.(() => {
      queueMicrotask(() => {
        if (this._isPlaying && !this._disposed) {
          this.stop();
        }
      });
    });

    if (this._zoomLevels.length === 0) {
      throw new Error('PlaylistEngine: zoomLevels must not be empty');
    }

    const initialSpp = options.samplesPerPixel ?? DEFAULT_SAMPLES_PER_PIXEL;
    const zoomIndex = this._zoomLevels.indexOf(initialSpp);
    if (zoomIndex === -1) {
      throw new Error(
        `PlaylistEngine: samplesPerPixel ${initialSpp} is not in zoomLevels [${this._zoomLevels.join(', ')}]. ` +
          `Either pass a samplesPerPixel value that exists in zoomLevels, or include ${initialSpp} in your zoomLevels array.`
      );
    }
    this._zoomIndex = zoomIndex;
    this._bpm = options.bpm ?? 120;
    // Adapter is the source of truth for PPQN. Headless mode falls back to options.ppqn or 960.
    this._ppqn = options.adapter?.ppqn ?? options.ppqn ?? 960;

    const timeBase = {
      sampleRate: this._sampleRate,
      ppqn: this._ppqn,
      secondsToTicks: (seconds: number) => this._secondsToTicks(seconds),
      ticksToSeconds: (tick: number) => this._ticksToSeconds(tick),
    };
    if (options.arrangement) {
      this._arrangement = asArrangementImpl(options.arrangement);
      if (options.undoLimit !== undefined) {
        console.warn(
          '[waveform-playlist] PlaylistEngine: undoLimit is ignored when an arrangement is ' +
            'passed. Set it on createArrangement({ undoLimit }).'
        );
      }
    } else {
      this._arrangement = new ArrangementImpl({ undoLimit: options.undoLimit });
    }
    this.undoLimit = this._arrangement.undoLimit;

    // Attach first (clips without a tick get one), then follow, then bring
    // the adapter in step with the tracks that are already there.
    this._detachFromArrangement = attachTimeBase(this._arrangement, timeBase);
    this._adapterSync = new AdapterSync(this._arrangement, this._adapter);
    this._stopFollowingArrangement = this._arrangement.onChange((change, at) =>
      this._onArrangementChange(change, at)
    );
    try {
      this._adapterSync.sendInitialTracks();
    } catch (error) {
      // Nobody will hold this engine to dispose it: let go of the arrangement here.
      this._stopFollowingArrangement();
      this._detachFromArrangement();
      throw error;
    }
    // The arrangement's sources are decoded with the adapter's context, unless the host attaches one.
    const adapter = this._adapter;
    if (adapter && options.attachDecodeContext !== false) {
      this._detachDecodeContext = attachDecodeContext(
        this._arrangement,
        async () => adapter.audioContext
      );
    }
  }

  // ---------------------------------------------------------------------------
  // Undo/Redo
  // ---------------------------------------------------------------------------

  get canUndo(): boolean {
    return this._arrangement.canUndo;
  }

  get canRedo(): boolean {
    return this._arrangement.canRedo;
  }

  undo(): void {
    this._arrangement.undo();
  }

  redo(): void {
    this._arrangement.redo();
  }

  clearHistory(): void {
    this._arrangement.clearHistory();
  }

  beginTransaction(): void {
    this._arrangement.beginTransaction();
  }

  commitTransaction(): void {
    this._arrangement.commitTransaction();
  }

  abortTransaction(): void {
    this._arrangement.abortTransaction();
  }

  // ---------------------------------------------------------------------------
  // State snapshot
  // ---------------------------------------------------------------------------

  getState(): EngineState {
    return {
      tracks: this._adapterSync.tracks(),
      tracksVersion: this._arrangement.tracksVersion,
      mixerVersion: this._arrangement.mixerVersion,
      duration: calculateDuration(this._adapterSync.tracks()),
      currentTime: this._currentTime,
      isPlaying: this._isPlaying,
      samplesPerPixel: this._zoomLevels[this._zoomIndex],
      sampleRate: this._sampleRate,
      selectedTrackId: this._selectedTrackId,
      zoomIndex: this._zoomIndex,
      canZoomIn: this._zoomIndex > 0,
      canZoomOut: this._zoomIndex < this._zoomLevels.length - 1,
      selectionStart: this._selectionStart,
      selectionEnd: this._selectionEnd,
      masterVolume: this._masterVolume,
      loopStart: this._loopStart,
      loopEnd: this._loopEnd,
      isLoopEnabled: this._isLoopEnabled,
      bpm: this._bpm,
      ppqn: this._ppqn,
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    };
  }

  // ---------------------------------------------------------------------------
  // Track Management
  // ---------------------------------------------------------------------------

  // A track holds audio clips or MIDI clips, never both (#756). The three
  // methods that take a track check it before they change anything, so a
  // throw leaves the engine, the undo history and the adapter untouched.
  setTracks(tracks: readonly ClipTrack[]): void {
    this._arrangement.setTracks(tracks);
  }

  addTrack(track: ClipTrack, options?: AddTrackOptions): void {
    this._arrangement.addTrack(track, options);
  }

  removeTrack(trackId: string): void {
    this._arrangement.removeTrack(trackId);
  }

  /**
   * Move a track to a new position in the track order. Purely organizational —
   * track order is not audible (adapter nodes are keyed by track id), so the
   * adapter is deliberately NOT called: a setTracks() here would rebuild
   * playout and interrupt playback for a visual-only change.
   */
  reorderTrack(trackId: string, toIndex: number): void {
    this._arrangement.reorderTrack(trackId, toIndex);
  }

  /**
   * With a track: replace that track (an undo step). Without one: send the
   * current track to the adapter again (no full rebuild, no change of state).
   */
  updateTrack(trackId: string, track?: ClipTrack): void {
    if (track) {
      this._arrangement.updateTrack(trackId, track);
      return;
    }
    // A disposed engine no longer follows the arrangement, and its adapter is disposed.
    if (!this._disposed) this._adapterSync.sendTrack(trackId);
  }

  selectTrack(trackId: string | null): void {
    if (trackId === this._selectedTrackId) return;
    this._selectedTrackId = trackId;
    this._emitStateChange();
  }

  // ---------------------------------------------------------------------------
  // Clip Queries
  // ---------------------------------------------------------------------------

  /** Get a clip's full bounds for trim constraint computation. Returns null if not found. */
  getClipBounds(trackId: string, clipId: string): ClipBounds | null {
    return this._arrangement.getClipBounds(trackId, clipId);
  }

  /** Constrain a trim delta using the engine's collision/bounds logic.
   *  Uses the clip's current state and neighboring clips for constraints. */
  constrainTrimDelta(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): number {
    return this._arrangement.constrainTrimDelta(trackId, clipId, boundary, deltaSamples);
  }

  // ---------------------------------------------------------------------------
  // Clip Editing (delegates to the arrangement)
  // ---------------------------------------------------------------------------

  /**
   * Move a clip by deltaSamples. Returns the constrained delta actually applied (0 if no-op).
   * With `skipAdapter` the change is not sent to the adapter (a drag sends the track once, on drop).
   */
  moveClip(trackId: string, clipId: string, deltaSamples: number, skipAdapter = false): number {
    const mark = this._adapterSync.markSkip(skipAdapter);
    try {
      return this._arrangement.moveClip(trackId, clipId, deltaSamples);
    } finally {
      this._adapterSync.unmarkIfUnchanged(mark);
    }
  }

  splitClip(trackId: string, clipId: string, atSample: number): void {
    this._arrangement.splitClip(trackId, clipId, atSample);
  }

  trimClip(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number,
    skipAdapter = false
  ): void {
    const mark = this._adapterSync.markSkip(skipAdapter);
    try {
      this._arrangement.trimClip(trackId, clipId, boundary, deltaSamples);
    } finally {
      this._adapterSync.unmarkIfUnchanged(mark);
    }
  }

  // ---------------------------------------------------------------------------
  // Playback (delegates to adapter, no-ops without adapter)
  // ---------------------------------------------------------------------------

  async init(): Promise<void> {
    if (this._adapter) {
      await this._adapter.init();
    }
  }

  play(startTime?: number, endTime?: number): void {
    const prevCurrentTime = this._currentTime;
    const prevPlayStartPosition = this._playStartPosition;

    if (startTime !== undefined) {
      this._currentTime = Math.max(0, startTime);
    }

    // Remember where playback started (Audacity-style: stop returns here)
    this._playStartPosition = this._currentTime;

    if (this._adapter) {
      // Configure loop state BEFORE play(). The adapter caches loopStart/
      // loopEnd/enabled from setLoop(), then TonePlayout.play() applies
      // them to the Transport before transport.start() and advances
      // Clock._lastUpdate to skip stale ghost ticks.
      if (endTime !== undefined) {
        // Disable Transport loop for duration-limited playback (selection/annotation)
        this._adapter.setLoop(false, this._loopStart, this._loopEnd);
      } else if (this._isLoopEnabled) {
        // Activate Transport loop if starting before loopEnd. Starting at or
        // past loopEnd plays to the end without looping (click-past-loop behavior).
        const beforeLoopEnd = this._currentTime < this._loopEnd;
        this._adapter.setLoop(beforeLoopEnd, this._loopStart, this._loopEnd);
      }
      try {
        this._adapter.play(this._currentTime, endTime);
      } catch (err) {
        // Restore state so the engine isn't left with a moved playhead
        // but no audio. The throw propagates to the caller.
        this._currentTime = prevCurrentTime;
        this._playStartPosition = prevPlayStartPosition;
        throw err;
      }
    }

    this._isPlaying = true;
    this._emit('play');
    this._emitStateChange();
  }

  pause(): void {
    this._isPlaying = false;
    this._adapter?.pause();
    if (this._adapter) {
      this._currentTime = this._adapter.getCurrentTime();
    }
    this._emit('pause');
    this._emitStateChange();
  }

  stop(): void {
    this._isPlaying = false;
    this._currentTime = this._playStartPosition;
    this._adapter?.setLoop(false, this._loopStart, this._loopEnd);
    this._adapter?.stop();
    // Seek adapter to play-start position so getCurrentTime() returns it
    this._adapter?.seek(this._currentTime);
    this._emit('stop');
    this._emitStateChange();
  }

  seek(time: number): void {
    this._currentTime = Math.max(0, time);
    this._adapter?.seek(this._currentTime);
    this._emitStateChange();
  }

  setMasterVolume(volume: number): void {
    if (volume === this._masterVolume) return;
    this._masterVolume = volume;
    this._adapter?.setMasterVolume(volume);
    this._emitStateChange();
  }

  setTempo(bpm: number, atTick?: number): void {
    if (!Number.isFinite(bpm) || bpm <= 0) {
      console.warn('[waveform-playlist/engine] setTempo: bpm must be a positive finite number');
      return;
    }
    if (bpm === this._bpm && atTick === undefined) return;
    if (this._disposed) return;
    // Commit only when the adapter accepts (an explicit `false` means refused,
    // e.g. the transport's multi-entry tempo-map guard — #407). Void-returning
    // and absent adapters count as accepted.
    const accepted = this._adapter?.setTempo?.(bpm, atTick);
    if (accepted === false) return;
    this._bpm = bpm;
    // The arrangement announces the recompute; the engine's listener sends
    // every track to the adapter and emits statechange.
    this._arrangement.recomputeStartSamples();
  }

  getCurrentTime(): number {
    if (this._adapter) {
      return this._adapter.getCurrentTime();
    }
    return this._currentTime;
  }

  /**
   * Audio scheduling lookahead in seconds — `getCurrentTime()` is this far ahead of
   * what the listener actually hears. Tone.js Transport reports a position that's
   * `lookAhead` ahead of audible (default 0.1s); native AudioContext-based adapters
   * have no lookahead and return 0. Visual consumers should use `getAudibleTime()`,
   * which applies this compensation only while playing.
   */
  get lookAhead(): number {
    return this._adapter?.lookAhead ?? 0;
  }

  /**
   * Playback position aligned with what the listener actually hears, for
   * visual consumers (playhead, progress overlays, auto-scroll).
   *
   * While playing: `getCurrentTime() − outputLatency − lookAhead`, held at
   * the play-start position during the pre-roll window (audio at the start
   * position isn't audible until ~outputLatency + lookAhead after `play()`,
   * so the cursor waits there instead of jumping backward).
   *
   * While not playing: the raw resting position. A stationary cursor has no
   * audible counterpart — seek/stop/pause positions display exactly.
   *
   * Storage stays raw: never feed this value back into `play()`/`seek()`,
   * which compounds the subtraction on every cycle. Use `getCurrentTime()`
   * for storage and resume positions.
   */
  getAudibleTime(): number {
    if (!this._isPlaying) {
      return this._currentTime;
    }
    const ctx = this._adapter?.audioContext;
    const outputLatency =
      ctx && 'outputLatency' in ctx ? ((ctx as AudioContext).outputLatency ?? 0) : 0;
    const raw = this.getCurrentTime();
    let t = raw - outputLatency - this.lookAhead;
    if (raw >= this._playStartPosition && t < this._playStartPosition) {
      t = this._playStartPosition;
    }
    return Number.isFinite(t) ? Math.max(0, t) : 0;
  }

  // ---------------------------------------------------------------------------
  // Selection & Loop
  // ---------------------------------------------------------------------------

  setSelection(start: number, end: number): void {
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    if (s === this._selectionStart && e === this._selectionEnd) return;
    this._selectionStart = s;
    this._selectionEnd = e;
    this._emitStateChange();
  }

  setLoopRegion(start: number, end: number): void {
    const s = Math.min(start, end);
    const e = Math.max(start, end);
    if (s === this._loopStart && e === this._loopEnd) return;
    this._loopStart = s;
    this._loopEnd = e;
    this._adapter?.setLoop(
      this._isLoopEnabled && this._isBeforeLoopEnd(),
      this._loopStart,
      this._loopEnd
    );
    this._emitStateChange();
  }

  setLoopEnabled(enabled: boolean): void {
    if (enabled === this._isLoopEnabled) return;
    this._isLoopEnabled = enabled;
    this._adapter?.setLoop(enabled && this._isBeforeLoopEnd(), this._loopStart, this._loopEnd);
    this._emitStateChange();
  }

  // ---------------------------------------------------------------------------
  // Per-Track Audio (persists into the arrangement, forwards to adapter, emits)
  // ---------------------------------------------------------------------------
  //
  // Each setter writes the value into the arrangement's mixer part (so a later
  // adapter rebuild via setTracks keeps the value, and mixerVersion is bumped);
  // the engine's listener then calls the adapter and emits statechange. Each
  // call is an undo step, unless `options` says otherwise: the same `gesture`
  // id joins one step, `undoable: false` is no step (`MixerChangeOptions`).
  //
  // When the arrangement changes nothing (a track it does not hold, or the
  // value the track already has), the adapter is still called from here,
  // with no statechange (a consumer may target a track that has not been
  // ingested yet). These are NOT structural
  // changes, so they deliberately do NOT bump tracksVersion — that would make
  // tracksVersion-gated consumers re-run expensive structural work (audio-graph
  // rewire, peak regeneration) on every volume/pan drag frame. Consumers that
  // cache a track snapshot (e.g. @dawcore/components' <daw-editor>) watch
  // mixerVersion to refresh that cache cheaply, so an unrelated setTracks
  // rebuild no longer reverts live mixer state (#501).

  setTrackVolume(trackId: string, volume: number, options?: MixerChangeOptions): void {
    const changed = this._mixerChanged(() =>
      this._arrangement.setTrackVolume(trackId, volume, options)
    );
    if (!changed && !this._disposed) this._adapter?.setTrackVolume(trackId, volume);
  }

  setTrackMute(trackId: string, muted: boolean, options?: MixerChangeOptions): void {
    const changed = this._mixerChanged(() =>
      this._arrangement.setTrackMute(trackId, muted, options)
    );
    // Through the adapter sync, so the track a take is recording onto stays
    // muted; a track it does not hold is sent the value given.
    if (!changed && !this._disposed) this._adapterSync.sendMixerValues(trackId, { muted });
  }

  setTrackSolo(trackId: string, soloed: boolean, options?: MixerChangeOptions): void {
    const changed = this._mixerChanged(() =>
      this._arrangement.setTrackSolo(trackId, soloed, options)
    );
    if (!changed && !this._disposed) this._adapter?.setTrackSolo(trackId, soloed);
  }

  setTrackPan(trackId: string, pan: number, options?: MixerChangeOptions): void {
    const changed = this._mixerChanged(() => this._arrangement.setTrackPan(trackId, pan, options));
    if (!changed && !this._disposed) this._adapter?.setTrackPan(trackId, pan);
  }

  /**
   * Mark a track as the one a take is recording onto, or clear it when the
   * take ends: the arrangement's `setTrackRecording`. That track plays muted
   * (here and in the adapter) while its mute in the mix stays as it is; the
   * take's mute is not an undo step. The arrangement's `'recording'`
   * announcement brings the adapter in step, so there is no adapter call of
   * its own here; a disposed engine changes the arrangement only.
   */
  setTrackRecording(trackId: string, recording: boolean): void {
    this._arrangement.setTrackRecording(trackId, recording);
  }

  /**
   * The tracks a take is recording onto, read from the arrangement (the
   * owner; no copy). The same set object until it changes; never write to
   * it, use `setTrackRecording`. Such a track plays muted, so a UI can
   * disable its mute control while the id is in the set.
   */
  get recordingTrackIds(): ReadonlySet<string> {
    return this._arrangement.recordingTrackIds;
  }

  // ---------------------------------------------------------------------------
  // Zoom
  // ---------------------------------------------------------------------------

  zoomIn(): void {
    if (this._zoomIndex > 0) {
      this._zoomIndex--;
      this._emitStateChange();
    }
  }

  zoomOut(): void {
    if (this._zoomIndex < this._zoomLevels.length - 1) {
      this._zoomIndex++;
      this._emitStateChange();
    }
  }

  setZoomLevel(samplesPerPixel: number): void {
    const newIndex = findClosestZoomIndex(samplesPerPixel, this._zoomLevels);
    if (newIndex === this._zoomIndex) return;
    this._zoomIndex = newIndex;
    this._emitStateChange();
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  on<K extends EventName>(event: K, listener: EngineEvents[K]): void {
    if (!this._listeners.has(event)) {
      this._listeners.set(event, new Set());
    }
    this._listeners.get(event)!.add(listener);
  }

  off<K extends EventName>(event: K, listener: EngineEvents[K]): void {
    this._listeners.get(event)?.delete(listener);
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  dispose(options: EngineDisposeOptions = {}): void {
    if (this._disposed) return;
    // The adapter outlives this engine: stop what it plays first.
    if (options.keepAdapter && this._isPlaying) this.stop();
    this._disposed = true;
    this._stopFollowingArrangement();
    this._detachFromArrangement();
    this._detachDecodeContext?.();
    this._detachDecodeContext = null;
    this._isPlaying = false;
    this._adapter?.onPlaybackEnded?.(null);
    try {
      // A kept adapter is emptied: the next engine may have nothing to send
      // (an empty arrangement sends no setTracks), and this one's tracks must
      // not go on playing through it (#848).
      if (options.keepAdapter) this._adapter?.setTracks([]);
      else this._adapter?.dispose();
    } catch (err) {
      console.warn('[waveform-playlist/engine] Error disposing adapter:', err);
    }
    this._listeners.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** Runs a mixer setter on the arrangement. True when a value changed. */
  private _mixerChanged(change: () => void): boolean {
    const version = this._arrangement.mixerVersion;
    change();
    return this._arrangement.mixerVersion !== version;
  }

  /**
   * The arrangement changed: bring the adapter in step, then emit
   * `statechange`. Every change is one emission. An adapter that throws
   * stops the emission and fails the arrangement call that is delivering
   * (for a change made from inside a listener, that is the outer call).
   */
  private _onArrangementChange(change: ArrangementChange, at: ArrangementVersions): void {
    switch (change.type) {
      case 'mixer':
        this._adapterSync.sendMixerValues(change.trackId, change.values);
        break;
      case 'restoreMix': // an undo, a redo or an abort of the mix only: no track call
        this._adapterSync.sendMixerDiff(change.previousMixer);
        break;
      case 'recording': {
        // The stored mute, which the adapter sync sends as the mute the track
        // plays with. A recording id that is not a current track has nothing to send.
        const values = this._arrangement.getMixer().get(change.trackId);
        if (values) this._adapterSync.sendMixerValues(change.trackId, { muted: values.muted });
        break;
      }
      case 'reorder': // not audible: adapter nodes are keyed by track id
      case 'history':
        break;
      default:
        // The selected track id is cleared when its track is removed, taken
        // away by an undo, a redo or an abort, or given a new id. Not by
        // `setTracks`: a host may empty the tracks and add them again.
        if (change.type === 'remove' || change.type === 'restore' || change.type === 'update') {
          this._clearSelectionIfGone();
        }
        if (change.type === 'load') {
          this._followLoad(change, at);
        } else {
          this._adapterSync.follow(change, at);
          // A track call does not carry the mix to every adapter (Tone's
          // updateTrack replaces clips only): the setters for what differs.
          if (change.type === 'restore') this._adapterSync.sendMixerDiff(change.previousMixer);
        }
    }
    this._emitStateChange();
  }

  /**
   * Audio arrived by itself: there is no caller to fail when the adapter
   * throws. The error is reported, the `statechange` is still emitted (the
   * tracks did change), and the next track change sends the adapter every
   * track.
   */
  private _followLoad(change: TracksChange, at: ArrangementVersions): void {
    try {
      this._adapterSync.follow(change, at);
    } catch (error) {
      console.error(
        '[waveform-playlist] The playout adapter failed while loaded audio was applied:',
        error
      );
    }
  }

  /** The selected track id names a track; when that track is gone, nothing is selected. */
  private _clearSelectionIfGone(): void {
    const selected = this._selectedTrackId;
    if (selected !== null && !this._arrangement.getTracks().some((t) => t.id === selected)) {
      this._selectedTrackId = null;
    }
  }

  private _emit(event: string, ...args: unknown[]): void {
    const listeners = this._listeners.get(event);
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(...args);
        } catch (error) {
          console.warn('[waveform-playlist/engine] Error in event listener:', error);
        }
      }
    }
  }

  /**
   * Returns whether the current playback position is before loopEnd.
   * Used by setLoopEnabled/setLoopRegion during playback — if past loopEnd,
   * Transport loop stays off so playback continues to the end.
   * Note: play() uses an inline check instead — _isPlaying is still false
   * when play() runs, and this method returns true unconditionally when
   * not playing.
   */
  private _isBeforeLoopEnd(): boolean {
    if (!this._isPlaying) return true;
    const t = this._adapter?.getCurrentTime() ?? this._currentTime;
    return t < this._loopEnd;
  }

  private _ticksToSeconds(tick: number): number {
    if (this._adapter?.ticksToSeconds) {
      return this._adapter.ticksToSeconds(tick);
    }
    return (tick * 60) / (this._ppqn * this._bpm);
  }

  private _secondsToTicks(seconds: number): number {
    if (this._adapter?.secondsToTicks) {
      return this._adapter.secondsToTicks(seconds);
    }
    return Math.round((seconds * this._ppqn * this._bpm) / 60);
  }

  private _emitStateChange(): void {
    this._emit('statechange', this.getState());
  }
}

/** The object behind an `Arrangement` from `createArrangement()`. */
function asArrangementImpl(arrangement: unknown): ArrangementImpl {
  // By key, not `instanceof`: the arrangement may come from another copy of this package.
  if (isArrangement(arrangement)) return arrangement as ArrangementImpl;
  throw new Error(
    '[waveform-playlist] PlaylistEngine: the `arrangement` option must be an arrangement ' +
      'made by createArrangement().'
  );
}
