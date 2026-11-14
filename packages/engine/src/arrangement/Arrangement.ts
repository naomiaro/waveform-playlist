/**
 * Arrangement — the tracks, their undo history and an open transaction.
 *
 * Extracted from PlaylistEngine by code motion (#812): every method here
 * does what the engine's method did to its own `_tracks`. Snapshots are
 * still copies and mixer values are still written in place; the
 * arrangement's own rules come in later steps.
 *
 * One order differs from the engine before the extraction: a mixer setter
 * bumps `mixerVersion` here, so before the engine's adapter call and not
 * after it. Only an adapter that reads the engine's state, throws, or calls
 * the engine from inside a mixer setter can tell.
 *
 * It knows nothing of adapters or playback. The engine calls a method,
 * then makes the adapter call and emits `statechange` itself.
 */

import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import { assertTrackKind, sortClipsByTime } from '@waveform-playlist/core';
import {
  constrainClipDrag,
  constrainBoundaryTrim,
  canSplitAt,
  splitClip as splitClipOp,
} from '../operations/clipOperations';

const DEFAULT_MIN_DURATION_SECONDS = 0.1;
const DEFAULT_UNDO_LIMIT = 100;

/** What changed, for a subscriber that has to act on it (the engine's adapter sync). */
export type ArrangementChange =
  | { type: 'set' }
  | { type: 'add'; trackId: string }
  | { type: 'remove'; trackId: string }
  | { type: 'update'; trackId: string }
  | { type: 'reorder' }
  | { type: 'restore'; previous: readonly ClipTrack[] }
  | { type: 'mixer'; trackId: string }
  | { type: 'recompute' }
  | { type: 'history' };

/** How the arrangement converts time. The engine provides it from its adapter and tempo. */
export interface ArrangementTimeBase {
  sampleRate: number;
  secondsToTicks(seconds: number): number;
  ticksToSeconds(tick: number): number;
}

export interface ArrangementOptions {
  /** Maximum number of undo steps (default 100). */
  undoLimit?: number;
  timeBase: ArrangementTimeBase;
}

export interface ClipBounds {
  offsetSamples: number;
  durationSamples: number;
  startSample: number;
  sourceDurationSamples: number;
}

type ChangeListener = (change: ArrangementChange) => void;

export class Arrangement {
  private _tracks: ClipTrack[] = [];
  private _tracksVersion = 0;
  private _mixerVersion = 0;
  private _undoStack: ClipTrack[][] = [];
  private _redoStack: ClipTrack[][] = [];
  private _inTransaction = false;
  private _transactionSnapshot: ClipTrack[] | null = null;
  private _transactionMutated = false;
  private _timeBase: ArrangementTimeBase;
  private _listeners: Set<ChangeListener> = new Set();
  readonly undoLimit: number;

  constructor(options: ArrangementOptions) {
    this.undoLimit = options.undoLimit ?? DEFAULT_UNDO_LIMIT;
    this._timeBase = options.timeBase;
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /** The live array of tracks. */
  getTracks(): ClipTrack[] {
    return this._tracks;
  }

  /** Counts structural changes. */
  get tracksVersion(): number {
    return this._tracksVersion;
  }

  /** Counts mixer changes. */
  get mixerVersion(): number {
    return this._mixerVersion;
  }

  /** Subscribe to changes. The listener is called after the state has changed. */
  onChange(listener: ChangeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
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
    // Only push undo entry if mutations actually occurred during the transaction.
    // Without this, no-op drags (e.g., against a boundary) create phantom undo entries.
    if (this._transactionMutated) {
      this._undoStack.push(this._transactionSnapshot);
      if (this._undoStack.length > this.undoLimit) {
        this._undoStack.shift();
      }
      this._redoStack = [];
    }
    this._transactionSnapshot = null;
    this._inTransaction = false;
    this._transactionMutated = false;
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
  // Track Management
  // ---------------------------------------------------------------------------

  // A track holds audio clips or MIDI clips, never both (#756). The three
  // methods that take a track check it before they change anything, so a
  // throw leaves the tracks, the undo history and every subscriber untouched.
  setTracks(tracks: ClipTrack[]): void {
    tracks.forEach(assertTrackKind);
    this.clearHistory();
    this._tracks = tracks.map((track) => this._withStartTicks(track));
    this._tracksVersion++;
    this._emit({ type: 'set' });
  }

  /** Returns the track as stored (each clip given a `startTick`). */
  addTrack(track: ClipTrack): ClipTrack {
    assertTrackKind(track);
    this._pushUndoSnapshot();
    const enriched = this._withStartTicks(track);
    this._tracks = [...this._tracks, enriched];
    this._tracksVersion++;
    this._emit({ type: 'add', trackId: track.id });
    return enriched;
  }

  removeTrack(trackId: string): void {
    if (!this._tracks.some((t) => t.id === trackId)) return;
    this._pushUndoSnapshot();
    this._tracks = this._tracks.filter((t) => t.id !== trackId);
    this._tracksVersion++;
    this._emit({ type: 'remove', trackId });
  }

  /**
   * Move a track to a new position in the track order. Purely organizational —
   * track order is not audible.
   */
  reorderTrack(trackId: string, toIndex: number): void {
    const fromIndex = this._tracks.findIndex((t) => t.id === trackId);
    if (fromIndex === -1) return;
    const clamped = Math.max(0, Math.min(toIndex, this._tracks.length - 1));
    if (clamped === fromIndex) return;
    this._pushUndoSnapshot();
    const track = this._tracks[fromIndex];
    const without = this._tracks.filter((t) => t.id !== trackId);
    this._tracks = [...without.slice(0, clamped), track, ...without.slice(clamped)];
    this._tracksVersion++;
    this._emit({ type: 'reorder' });
  }

  /**
   * Replace a track. Returns the track as stored (each clip given a `startTick`).
   * An id no track has still pushes an undo step, bumps the version and
   * announces the change, and adds no track, as the engine did.
   */
  updateTrack(trackId: string, track: ClipTrack): ClipTrack {
    assertTrackKind(track);
    this._pushUndoSnapshot();
    const enriched = this._withStartTicks(track);
    this._tracks = this._tracks.map((t) => (t.id === trackId ? enriched : t));
    this._tracksVersion++;
    this._emit({ type: 'update', trackId });
    return enriched;
  }

  // ---------------------------------------------------------------------------
  // Clip Queries
  // ---------------------------------------------------------------------------

  /** Get a clip's full bounds for trim constraint computation. Returns null if not found. */
  getClipBounds(trackId: string, clipId: string): ClipBounds | null {
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

  /** Constrain a trim delta using the collision/bounds logic.
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
    const minDuration = this._minDuration();

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
  moveClip(trackId: string, clipId: string, deltaSamples: number): number {
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
      const newClips = t.clips.map((c: AudioClip, i: number) => {
        if (i !== clipIndex) return c;
        const newStartSample = Math.floor(c.startSample + constrainedDelta);
        return {
          ...c,
          startSample: newStartSample,
          startTick: c.startTick !== undefined ? this._tickAt(newStartSample) : undefined,
        };
      });
      return { ...t, clips: newClips };
    });

    this._tracksVersion++;
    this._emit({ type: 'update', trackId });
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
    const minDuration = this._minDuration();

    if (!canSplitAt(clip, atSample, minDuration)) {
      console.warn(
        `[waveform-playlist/engine] splitClip: cannot split clip "${clipId}" at sample ${atSample} ` +
          `(clip range: ${clip.startSample}–${clip.startSample + clip.durationSamples}, minDuration: ${minDuration})`
      );
      return;
    }

    this._pushUndoSnapshot();

    const { left, right } = splitClipOp(clip, atSample);

    // Enrich split clips with startTick if the original had one
    const enrichedLeft =
      clip.startTick !== undefined ? { ...left, startTick: this._tickAt(left.startSample) } : left;
    const enrichedRight =
      clip.startTick !== undefined
        ? { ...right, startTick: this._tickAt(right.startSample) }
        : right;

    this._tracks = this._tracks.map((t) => {
      if (t.id !== trackId) return t;
      const newClips = [...t.clips];
      newClips.splice(clipIndex, 1, enrichedLeft, enrichedRight);
      return { ...t, clips: newClips };
    });

    this._tracksVersion++;
    this._emit({ type: 'update', trackId });
  }

  trimClip(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
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
    const minDuration = this._minDuration();

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
          const newStartSample = c.startSample + constrained;
          return {
            ...c,
            startSample: newStartSample,
            startTick: c.startTick !== undefined ? this._tickAt(newStartSample) : undefined,
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
    this._emit({ type: 'update', trackId });
  }

  // ---------------------------------------------------------------------------
  // Mixer values
  // ---------------------------------------------------------------------------
  //
  // Written into the track in place, so a later adapter rebuild keeps the
  // value. NOT structural changes: they bump mixerVersion, never
  // tracksVersion (#501). An id no track has changes no track and still
  // bumps the version and announces the change, as the engine did.

  setTrackVolume(trackId: string, volume: number): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (track) track.volume = volume;
    this._mixerChanged(trackId);
  }

  setTrackMute(trackId: string, muted: boolean): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (track) track.muted = muted;
    this._mixerChanged(trackId);
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (track) track.soloed = soloed;
    this._mixerChanged(trackId);
  }

  setTrackPan(trackId: string, pan: number): void {
    const track = this._tracks.find((t) => t.id === trackId);
    if (track) track.pan = pan;
    this._mixerChanged(trackId);
  }

  // ---------------------------------------------------------------------------
  // Tempo
  // ---------------------------------------------------------------------------

  /** Re-derive `startSample` from `startTick` for every clip that has one (after a tempo change). */
  recomputeStartSamples(): void {
    this._tracks = this._tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => {
        if (clip.startTick === undefined) return clip;
        return {
          ...clip,
          startSample: Math.round(
            this._timeBase.ticksToSeconds(clip.startTick) * this._timeBase.sampleRate
          ),
        };
      }),
    }));
    this._tracksVersion++;
    this._emit({ type: 'recompute' });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private _tickAt(startSample: number): number {
    return this._timeBase.secondsToTicks(startSample / this._timeBase.sampleRate);
  }

  private _minDuration(): number {
    return Math.floor(DEFAULT_MIN_DURATION_SECONDS * this._timeBase.sampleRate);
  }

  /** A copy of the track in which every clip has a `startTick`. */
  private _withStartTicks(track: ClipTrack): ClipTrack {
    return {
      ...track,
      clips: track.clips.map((clip) => ({
        ...clip,
        startTick: clip.startTick ?? this._tickAt(clip.startSample),
      })),
    };
  }

  private _mixerChanged(trackId: string): void {
    this._mixerVersion++;
    this._emit({ type: 'mixer', trackId });
  }

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
    const previous = this._tracks;
    this._tracks = snapshot;
    this._tracksVersion++;
    this._emit({ type: 'restore', previous });
  }

  private _emit(change: ArrangementChange): void {
    for (const listener of this._listeners) {
      try {
        listener(change);
      } catch (error) {
        console.warn('[waveform-playlist/engine] Error in arrangement change listener:', error);
      }
    }
  }
}
