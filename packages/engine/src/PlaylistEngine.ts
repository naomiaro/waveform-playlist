/**
 * PlaylistEngine — Stateful, framework-agnostic timeline engine.
 *
 * Composes pure operations from ./operations with an event emitter
 * and optional PlayoutAdapter for audio playback delegation.
 */

import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { sortClipsByTime } from '@waveform-playlist/core';
import {
  constrainClipDrag,
  constrainBoundaryTrim,
  canSplitAt,
  splitClip as splitClipOp,
} from './operations/clipOperations';
import { calculateDuration, findClosestZoomIndex } from './operations/timelineOperations';
import type { PlayoutAdapter, EngineState, EngineEvents, PlaylistEngineOptions } from './types';

const DEFAULT_SAMPLE_RATE = 48000;
const DEFAULT_SAMPLES_PER_PIXEL = 1024;
const DEFAULT_ZOOM_LEVELS = [256, 512, 1024, 2048, 4096, 8192];
const DEFAULT_MIN_DURATION_SECONDS = 0.1;

type EventName = keyof EngineEvents;

export class PlaylistEngine {
  private _tracks: ClipTrack[] = [];
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
  private _tracksVersion = 0;
  private _adapter: PlayoutAdapter | null;
  private _animFrameId: number | null = null;
  private _disposed = false;
  // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
  private _listeners: Map<string, Set<Function>> = new Map();

  private _undoStack: ClipTrack[][] = [];
  private _redoStack: ClipTrack[][] = [];
  private _inTransaction = false;
  private _transactionSnapshot: ClipTrack[] | null = null;
  private _transactionMutated = false;
  readonly undoLimit: number;

  constructor(options: PlaylistEngineOptions = {}) {
    this._sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE;
    this._zoomLevels = [...(options.zoomLevels ?? DEFAULT_ZOOM_LEVELS)];
    this._adapter = options.adapter ?? null;
    this.undoLimit = options.undoLimit ?? 100;

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
  }

  // ---------------------------------------------------------------------------
  // Undo/Redo
  // ---------------------------------------------------------------------------

  get canUndo(): boolean {
    return this._undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this._redoStack.length > 0;
  }

  undo(): void {
    if (this._undoStack.length === 0) return;
    const snapshot = this._undoStack.pop()!;
    this._redoStack.push(this._snapshotTracks());
    this._restoreTracks(snapshot);
  }

  redo(): void {
    if (this._redoStack.length === 0) return;
    const snapshot = this._redoStack.pop()!;
    this._undoStack.push(this._snapshotTracks());
    this._restoreTracks(snapshot);
  }

  clearHistory(): void {
    this._undoStack = [];
    this._redoStack = [];
  }

  beginTransaction(): void {
    if (this._inTransaction) {
      console.warn(
        '[waveform-playlist/engine] beginTransaction: already in a transaction, ' +
          'previous snapshot will be overwritten'
      );
    }
    this._transactionSnapshot = this._snapshotTracks();
    this._inTransaction = true;
    this._transactionMutated = false;
  }

  commitTransaction(): void {
    if (!this._inTransaction || this._transactionSnapshot === null) {
      console.warn('[waveform-playlist/engine] commitTransaction: no active transaction to commit');
      return;
    }
    this._undoStack.push(this._transactionSnapshot);
    if (this._undoStack.length > this.undoLimit) {
      this._undoStack.shift();
    }
    this._redoStack = [];
    this._transactionSnapshot = null;
    this._inTransaction = false;
  }

  abortTransaction(): void {
    if (!this._inTransaction || this._transactionSnapshot === null) {
      console.warn('[waveform-playlist/engine] abortTransaction: no active transaction to abort');
      return;
    }
    const snapshot = this._transactionSnapshot;
    const mutated = this._transactionMutated;
    this._transactionSnapshot = null;
    this._inTransaction = false;
    this._transactionMutated = false;
    // Only restore if mutations occurred — avoids full adapter rebuild on click
    if (mutated) {
      this._restoreTracks(snapshot);
    }
  }

  // ---------------------------------------------------------------------------
  // State snapshot
  // ---------------------------------------------------------------------------

  getState(): EngineState {
    return {
      tracks: this._tracks.map((t) => ({ ...t, clips: [...t.clips] })),
      tracksVersion: this._tracksVersion,
      duration: calculateDuration(this._tracks),
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
      canUndo: this.canUndo,
      canRedo: this.canRedo,
    };
  }

  // ---------------------------------------------------------------------------
  // Track Management
  // ---------------------------------------------------------------------------

  setTracks(tracks: ClipTrack[]): void {
    this.clearHistory();
    this._tracks = [...tracks];
    this._tracksVersion++;
    this._adapter?.setTracks(this._tracks);
    this._emitStateChange();
  }

  addTrack(track: ClipTrack): void {
    this._pushUndoSnapshot();
    this._tracks = [...this._tracks, track];
    this._tracksVersion++;
    if (this._adapter?.addTrack) {
      this._adapter.addTrack(track);
    } else {
      this._adapter?.setTracks(this._tracks);
    }
    this._emitStateChange();
  }

  removeTrack(trackId: string): void {
    if (!this._tracks.some((t) => t.id === trackId)) return;
    this._pushUndoSnapshot();
    this._tracks = this._tracks.filter((t) => t.id !== trackId);
    this._tracksVersion++;
    if (this._selectedTrackId === trackId) {
      this._selectedTrackId = null;
    }
    if (this._adapter?.removeTrack) {
      this._adapter.removeTrack(trackId);
    } else {
      this._adapter?.setTracks(this._tracks);
    }
    this._emitStateChange();
  }

  /** Update a single track's clips on the adapter (no full rebuild). */
  updateTrack(trackId: string, track?: ClipTrack): void {
    const resolved = track ?? this._tracks.find((t) => t.id === trackId);
    if (!resolved) return;
    if (track) {
      this._pushUndoSnapshot();
      this._tracks = this._tracks.map((t) => (t.id === trackId ? track : t));
      this._tracksVersion++;
    }
    if (this._adapter?.updateTrack) {
      this._adapter.updateTrack(trackId, resolved);
    } else {
      this._adapter?.setTracks(this._tracks);
    }
    // Only emit statechange when internal state actually changed
    if (track) this._emitStateChange();
  }

  /** Internal: update adapter after modifying this._tracks in place. */
  private _updateTrackOnAdapter(trackId: string): void {
    const t = this._tracks.find((tr) => tr.id === trackId);
    if (!t) return;
    if (this._adapter?.updateTrack) {
      this._adapter.updateTrack(trackId, t);
    } else {
      this._adapter?.setTracks(this._tracks);
    }
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
  getClipBounds(
    trackId: string,
    clipId: string
  ): {
    offsetSamples: number;
    durationSamples: number;
    startSample: number;
    sourceDurationSamples: number;
  } | null {
    const track = this._tracks.find((t) => t.id === trackId);
    if (!track) return null;
    const clip = track.clips.find((c: AudioClip) => c.id === clipId);
    if (!clip) return null;
    return {
      offsetSamples: clip.offsetSamples,
      durationSamples: clip.durationSamples,
      startSample: clip.startSample,
      sourceDurationSamples: clip.sourceDurationSamples,
    };
  }

  /** Constrain a trim delta using the engine's collision/bounds logic.
   *  Uses the clip's current state and neighboring clips for constraints. */
  constrainTrimDelta(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): number {
    const track = this._tracks.find((t) => t.id === trackId);
    if (!track) return 0;
    const clipIndex = track.clips.findIndex((c: AudioClip) => c.id === clipId);
    if (clipIndex === -1) return 0;

    const clip = track.clips[clipIndex];
    const sortedClips = sortClipsByTime(track.clips);
    const sortedIndex = sortedClips.findIndex((c: AudioClip) => c.id === clipId);
    const minDuration = Math.floor(DEFAULT_MIN_DURATION_SECONDS * this._sampleRate);

    return constrainBoundaryTrim(
      clip,
      deltaSamples,
      boundary,
      sortedClips,
      sortedIndex,
      minDuration
    );
  }

  // ---------------------------------------------------------------------------
  // Clip Editing (delegates to operations/)
  // ---------------------------------------------------------------------------

  /** Move a clip by deltaSamples. Returns the constrained delta actually applied (0 if no-op). */
  moveClip(trackId: string, clipId: string, deltaSamples: number, skipAdapter = false): number {
    const track = this._tracks.find((t) => t.id === trackId);
    if (!track) {
      console.warn(`[waveform-playlist/engine] moveClip: track "${trackId}" not found`);
      return 0;
    }

    const clipIndex = track.clips.findIndex((c: AudioClip) => c.id === clipId);
    if (clipIndex === -1) {
      console.warn(
        `[waveform-playlist/engine] moveClip: clip "${clipId}" not found in track "${trackId}"`
      );
      return 0;
    }

    const clip = track.clips[clipIndex];
    const sortedClips = sortClipsByTime(track.clips);
    const sortedIndex = sortedClips.findIndex((c: AudioClip) => c.id === clipId);

    const constrainedDelta = constrainClipDrag(clip, deltaSamples, sortedClips, sortedIndex);

    if (constrainedDelta === 0) return 0;

    this._pushUndoSnapshot();

    this._tracks = this._tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newClips = t.clips.map((c: AudioClip, i: number) =>
        i === clipIndex
          ? {
              ...c,
              startSample: Math.floor(c.startSample + constrainedDelta),
            }
          : c
      );
      return { ...t, clips: newClips };
    });

    this._tracksVersion++;
    if (!skipAdapter) {
      this._updateTrackOnAdapter(trackId);
    }
    this._emitStateChange();
    return constrainedDelta;
  }

  splitClip(trackId: string, clipId: string, atSample: number): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (!track) {
      console.warn(`[waveform-playlist/engine] splitClip: track "${trackId}" not found`);
      return;
    }

    const clipIndex = track.clips.findIndex((c: AudioClip) => c.id === clipId);
    if (clipIndex === -1) {
      console.warn(
        `[waveform-playlist/engine] splitClip: clip "${clipId}" not found in track "${trackId}"`
      );
      return;
    }

    const clip = track.clips[clipIndex];
    const minDuration = Math.floor(DEFAULT_MIN_DURATION_SECONDS * this._sampleRate);

    if (!canSplitAt(clip, atSample, minDuration)) {
      console.warn(
        `[waveform-playlist/engine] splitClip: cannot split clip "${clipId}" at sample ${atSample} ` +
          `(clip range: ${clip.startSample}–${clip.startSample + clip.durationSamples}, minDuration: ${minDuration})`
      );
      return;
    }

    this._pushUndoSnapshot();

    const { left, right } = splitClipOp(clip, atSample);

    this._tracks = this._tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newClips = [...t.clips];
      newClips.splice(clipIndex, 1, left, right);
      return { ...t, clips: newClips };
    });

    this._tracksVersion++;
    this._updateTrackOnAdapter(trackId);
    this._emitStateChange();
  }

  trimClip(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number,
    skipAdapter = false
  ): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (!track) {
      console.warn(`[waveform-playlist/engine] trimClip: track "${trackId}" not found`);
      return;
    }

    const clipIndex = track.clips.findIndex((c: AudioClip) => c.id === clipId);
    if (clipIndex === -1) {
      console.warn(
        `[waveform-playlist/engine] trimClip: clip "${clipId}" not found in track "${trackId}"`
      );
      return;
    }

    const clip = track.clips[clipIndex];
    const sortedClips = sortClipsByTime(track.clips);
    const sortedIndex = sortedClips.findIndex((c: AudioClip) => c.id === clipId);
    const minDuration = Math.floor(DEFAULT_MIN_DURATION_SECONDS * this._sampleRate);

    const constrained = constrainBoundaryTrim(
      clip,
      deltaSamples,
      boundary,
      sortedClips,
      sortedIndex,
      minDuration
    );

    if (constrained === 0) return;

    this._pushUndoSnapshot();

    this._tracks = this._tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newClips = t.clips.map((c: AudioClip, i: number) => {
        if (i !== clipIndex) return c;
        if (boundary === 'left') {
          return {
            ...c,
            startSample: c.startSample + constrained,
            offsetSamples: c.offsetSamples + constrained,
            durationSamples: c.durationSamples - constrained,
          };
        } else {
          return { ...c, durationSamples: c.durationSamples + constrained };
        }
      });
      return { ...t, clips: newClips };
    });

    this._tracksVersion++;
    if (!skipAdapter) {
      this._updateTrackOnAdapter(trackId);
    }
    this._emitStateChange();
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
    this._startTimeUpdateLoop();
    this._emit('play');
    this._emitStateChange();
  }

  pause(): void {
    this._isPlaying = false;
    this._stopTimeUpdateLoop();
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
    this._stopTimeUpdateLoop();
    this._adapter?.setLoop(false, this._loopStart, this._loopEnd);
    this._adapter?.stop();
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

  getCurrentTime(): number {
    if (this._isPlaying && this._adapter) {
      return this._adapter.getCurrentTime();
    }
    return this._currentTime;
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
  // Per-Track Audio (delegates to adapter)
  // ---------------------------------------------------------------------------

  setTrackVolume(trackId: string, volume: number): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (track) track.volume = volume;
    this._adapter?.setTrackVolume(trackId, volume);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (track) track.muted = muted;
    this._adapter?.setTrackMute(trackId, muted);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (track) track.soloed = soloed;
    this._adapter?.setTrackSolo(trackId, soloed);
  }

  setTrackPan(trackId: string, pan: number): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (track) track.pan = pan;
    this._adapter?.setTrackPan(trackId, pan);
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
    this._stopTimeUpdateLoop();
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

  private _snapshotTracks(): ClipTrack[] {
    return this._tracks.map((t) => ({ ...t, clips: t.clips.map((c) => ({ ...c })) }));
  }

  private _pushUndoSnapshot(): void {
    if (this._inTransaction) {
      this._transactionMutated = true;
      return;
    }
    this._undoStack.push(this._snapshotTracks());
    if (this._undoStack.length > this.undoLimit) {
      this._undoStack.shift();
    }
    this._redoStack = [];
  }

  private _restoreTracks(snapshot: ClipTrack[]): void {
    const oldTracks = this._tracks;
    this._tracks = snapshot;
    this._tracksVersion++;
    // Use incremental adapter updates when track count is unchanged —
    // avoids full playout rebuild that interrupts playback during undo/redo.
    if (this._adapter && oldTracks.length === snapshot.length) {
      for (let i = 0; i < snapshot.length; i++) {
        if (oldTracks[i] !== snapshot[i]) {
          this._updateTrackOnAdapter(snapshot[i].id);
        }
      }
    } else {
      this._adapter?.setTracks(this._tracks);
    }
    this._emitStateChange();
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

  private _emitStateChange(): void {
    this._emit('statechange', this.getState());
  }

  private _startTimeUpdateLoop(): void {
    // Guard for Node.js / SSR environments where RAF is unavailable
    if (typeof requestAnimationFrame === 'undefined') return;

    this._stopTimeUpdateLoop();

    const tick = () => {
      if (this._disposed || !this._isPlaying) return;
      if (this._adapter) {
        this._currentTime = this._adapter.getCurrentTime();
        this._emit('timeupdate', this._currentTime);
      }
      this._animFrameId = requestAnimationFrame(tick);
    };

    this._animFrameId = requestAnimationFrame(tick);
  }

  private _stopTimeUpdateLoop(): void {
    if (this._animFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this._animFrameId);
      this._animFrameId = null;
    }
  }
}
