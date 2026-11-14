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
import { Arrangement } from './arrangement';
import type { ArrangementChange, ArrangementVersions, ClipBounds } from './arrangement';
import { freezeTrackInDevelopment, freezeTracksInDevelopment } from './arrangement/devFreeze';
import { withMixerValues } from './arrangement/mixer';
import type { TrackMixerValues } from './arrangement/mixer';
import { calculateDuration, findClosestZoomIndex } from './operations/timelineOperations';
import type { PlayoutAdapter, EngineState, EngineEvents, PlaylistEngineOptions } from './types';

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_SAMPLES_PER_PIXEL = 1024;
const DEFAULT_ZOOM_LEVELS = [256, 512, 1024, 2048, 4096, 8192];

type EventName = keyof EngineEvents;

export class PlaylistEngine {
  private _arrangement: Arrangement;
  private _stopFollowingArrangement: () => void;
  /**
   * The `tracksVersion` of each change made with `skipAdapter`. A change is
   * delivered later than it is made when it comes from inside a listener, so
   * the mark travels with the change's version, not with the call.
   */
  private _skipAdapterAt = new Set<number>();
  private _projection: {
    tracksVersion: number;
    mixerVersion: number;
    tracks: readonly ClipTrack[];
  } | null = null;
  private _withMixMemo = new WeakMap<
    ClipTrack,
    { values: TrackMixerValues | undefined; merged: ClipTrack }
  >();
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
    this.undoLimit = options.undoLimit ?? 100;

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

    this._arrangement = new Arrangement({
      undoLimit: this.undoLimit,
      timeBase: {
        sampleRate: this._sampleRate,
        secondsToTicks: (seconds) => this._secondsToTicks(seconds),
        ticksToSeconds: (tick) => this._ticksToSeconds(tick),
      },
    });
    this._stopFollowingArrangement = this._arrangement.onChange((change, at) =>
      this._onArrangementChange(change, at)
    );
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
      tracks: this._tracksForAdapter(),
      tracksVersion: this._arrangement.tracksVersion,
      mixerVersion: this._arrangement.mixerVersion,
      duration: calculateDuration(this._arrangement.getTracks()),
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

  addTrack(track: ClipTrack): void {
    this._arrangement.addTrack(track);
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
    this._updateTrackOnAdapter(trackId);
  }

  /** Send the arrangement's current track to the adapter. False when there is no such track. */
  private _updateTrackOnAdapter(trackId: string): boolean {
    const t = this._arrangement.getTracks().find((tr) => tr.id === trackId);
    if (!t) return false;
    if (this._adapter?.updateTrack) {
      this._adapter.updateTrack(trackId, this._withMix(t));
    } else {
      this._adapter?.setTracks(this._tracksForAdapter());
    }
    return true;
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
    const mark = this._markSkipAdapter(skipAdapter);
    const constrainedDelta = this._arrangement.moveClip(trackId, clipId, deltaSamples);
    this._unmarkIfUnchanged(mark);
    return constrainedDelta;
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
    const mark = this._markSkipAdapter(skipAdapter);
    this._arrangement.trimClip(trackId, clipId, boundary, deltaSamples);
    this._unmarkIfUnchanged(mark);
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
  // the engine's listener then calls the adapter and emits statechange. For a
  // track the arrangement does not hold nothing changes, and the adapter is
  // still called from here (a consumer may target a track that has not been
  // ingested yet). These are NOT structural
  // changes, so they deliberately do NOT bump tracksVersion — that would make
  // tracksVersion-gated consumers re-run expensive structural work (audio-graph
  // rewire, peak regeneration) on every volume/pan drag frame. Consumers that
  // cache a track snapshot (e.g. @dawcore/components' <daw-editor>) watch
  // mixerVersion to refresh that cache cheaply, so an unrelated setTracks
  // rebuild no longer reverts live mixer state (#501).

  setTrackVolume(trackId: string, volume: number): void {
    const changed = this._mixerChanged(() => this._arrangement.setTrackVolume(trackId, volume));
    if (!changed) this._adapter?.setTrackVolume(trackId, volume);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const changed = this._mixerChanged(() => this._arrangement.setTrackMute(trackId, muted));
    if (!changed) this._adapter?.setTrackMute(trackId, muted);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    const changed = this._mixerChanged(() => this._arrangement.setTrackSolo(trackId, soloed));
    if (!changed) this._adapter?.setTrackSolo(trackId, soloed);
  }

  setTrackPan(trackId: string, pan: number): void {
    const changed = this._mixerChanged(() => this._arrangement.setTrackPan(trackId, pan));
    if (!changed) this._adapter?.setTrackPan(trackId, pan);
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

  dispose(): void {
    if (this._disposed) return;
    this._disposed = true;
    this._stopFollowingArrangement();
    this._isPlaying = false;
    this._adapter?.onPlaybackEnded?.(null);
    try {
      this._adapter?.dispose();
    } catch (err) {
      console.warn('[waveform-playlist/engine] Error disposing adapter:', err);
    }
    this._listeners.clear();
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /**
   * The arrangement's tracks with the current mixer values in their fields:
   * what every adapter track call and `getState().tracks` use. Derived, never
   * written back. The same array until the tracks or the mix change, and the
   * same track object while neither that track nor its mix changed.
   */
  private _tracksForAdapter(): readonly ClipTrack[] {
    const { tracksVersion, mixerVersion } = this._arrangement;
    const cached = this._projection;
    if (cached && cached.tracksVersion === tracksVersion && cached.mixerVersion === mixerVersion) {
      return cached.tracks;
    }
    const tracks = freezeTracksInDevelopment(
      this._arrangement.getTracks().map((track) => this._withMix(track))
    );
    this._projection = { tracksVersion, mixerVersion, tracks };
    return tracks;
  }

  /** One track with its current mixer values in its fields (memoized per track object). */
  private _withMix(track: ClipTrack): ClipTrack {
    const values = this._arrangement.getMixer().get(track.id);
    const memo = this._withMixMemo.get(track);
    if (memo && memo.values === values) return memo.merged;
    const merged = freezeTrackInDevelopment(withMixerValues(track, values));
    this._withMixMemo.set(track, { values, merged });
    return merged;
  }

  /** Runs a mixer setter on the arrangement. True when a value changed. */
  private _mixerChanged(change: () => void): boolean {
    const version = this._arrangement.mixerVersion;
    change();
    return this._arrangement.mixerVersion !== version;
  }

  /**
   * The arrangement changed: bring the adapter in step, then emit
   * `statechange`. Every change is one emission. An adapter that throws
   * stops the emission, and the arrangement hands the error to whoever made
   * the change.
   */
  private _onArrangementChange(change: ArrangementChange, at: ArrangementVersions): void {
    switch (change.type) {
      case 'set':
        this._adapter?.setTracks(this._tracksForAdapter());
        break;
      case 'add':
        this._addTrackOnAdapter(change.trackId);
        break;
      case 'remove':
        this._clearSelectionIfGone();
        if (this._adapter?.removeTrack) {
          this._adapter.removeTrack(change.trackId);
        } else {
          this._adapter?.setTracks(this._tracksForAdapter());
        }
        break;
      case 'update':
        if (this._skipAdapterAt.delete(at.tracksVersion)) break;
        // A track that was given a new id is not found under the old one.
        if (!this._updateTrackOnAdapter(change.trackId)) {
          this._adapter?.setTracks(this._tracksForAdapter());
        }
        break;
      case 'restore':
        this._clearSelectionIfGone();
        this._restoreOnAdapter(change.previous);
        break;
      case 'mixer':
        this._setMixerOnAdapter(change.trackId, change.values);
        break;
      case 'recompute':
        // Use incremental updates to avoid full playout rebuild during playback
        for (const track of this._arrangement.getTracks()) {
          this._updateTrackOnAdapter(track.id);
        }
        break;
      case 'reorder': // not audible: adapter nodes are keyed by track id
      case 'history':
        break;
    }
    this._emitStateChange();
  }

  private _addTrackOnAdapter(trackId: string): void {
    const track = this._arrangement.getTracks().find((t) => t.id === trackId);
    if (track && this._adapter?.addTrack) {
      this._adapter.addTrack(this._withMix(track));
    } else {
      this._adapter?.setTracks(this._tracksForAdapter());
    }
  }

  /**
   * After an undo, a redo or an abort. Use incremental adapter updates when
   * the same tracks are there before and after — avoids full playout rebuild
   * that interrupts playback. A track the restore did not touch is the same
   * object in both states and is skipped; so is a change of order only.
   */
  private _restoreOnAdapter(previous: readonly ClipTrack[]): void {
    const restored = this._arrangement.getTracks();
    const oldById = new Map(previous.map((t) => [t.id, t]));
    const sameSet = previous.length === restored.length && restored.every((t) => oldById.has(t.id));
    if (this._adapter && sameSet) {
      for (const track of restored) {
        if (oldById.get(track.id) !== track) {
          this._updateTrackOnAdapter(track.id);
        }
      }
    } else {
      this._adapter?.setTracks(this._tracksForAdapter());
    }
  }

  private _setMixerOnAdapter(trackId: string, values: Partial<TrackMixerValues>): void {
    if (values.volume !== undefined) this._adapter?.setTrackVolume(trackId, values.volume);
    if (values.muted !== undefined) this._adapter?.setTrackMute(trackId, values.muted);
    if (values.soloed !== undefined) this._adapter?.setTrackSolo(trackId, values.soloed);
    if (values.pan !== undefined) this._adapter?.setTrackPan(trackId, values.pan);
  }

  /** The selected track id names a track; when that track is gone, nothing is selected. */
  private _clearSelectionIfGone(): void {
    const selected = this._selectedTrackId;
    if (selected !== null && !this._arrangement.getTracks().some((t) => t.id === selected)) {
      this._selectedTrackId = null;
    }
  }

  /**
   * Before a change made with `skipAdapter`: mark the version that change
   * will have. Returns the mark, or null without `skipAdapter`.
   */
  private _markSkipAdapter(skipAdapter: boolean): number | null {
    if (!skipAdapter) return null;
    const mark = this._arrangement.tracksVersion + 1;
    this._skipAdapterAt.add(mark);
    return mark;
  }

  /** After the call: a call that changed nothing has no change to carry its mark. */
  private _unmarkIfUnchanged(mark: number | null): void {
    if (mark !== null && this._arrangement.tracksVersion < mark) {
      this._skipAdapterAt.delete(mark);
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
