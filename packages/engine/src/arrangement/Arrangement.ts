/**
 * Arrangement — the tracks, their undo history and an open transaction.
 *
 * Immutable: a change replaces the tracks array and only the track and
 * clip objects that changed, and nothing is ever written into an object
 * that `getTracks()` has returned. Tracks are copied on their way in
 * (`setTracks`, `addTrack`, `updateTrack`), so the caller's objects are
 * never the arrangement's; what `getTracks()` returns is NOT a copy and
 * must not be written to (it is frozen outside production builds). A snapshot of the undo history is
 * therefore a reference to an earlier array, and two states share every
 * track that is the same in both (#812).
 *
 * The mixer values (volume, mute, solo, pan) are a part of their own, a Map
 * by track id (`getMixer()`, ./mixer.ts). A setter replaces the Map and one
 * entry and no track object; the history holds tracks only, so an undo
 * never changes the mix. The entry of a removed track is kept while any
 * state of the history still holds the track.
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
import { freezeTracksInDevelopment } from './devFreeze';
import { EMPTY_HISTORY, beginBase, pushStep, redoStep, undoStep } from './history';
import type { History, TransactionBase } from './history';
import { EMPTY_MIXER, retainMixer, seedMixer, setMixerValues } from './mixer';
import type { Mixer, TrackMixerValues } from './mixer';

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
  private _tracks: readonly ClipTrack[] = [];
  private _tracksVersion = 0;
  private _mixerVersion = 0;
  private _mixer: Mixer = EMPTY_MIXER;
  private _history: History = EMPTY_HISTORY;
  private _transaction: TransactionBase | null = null;
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

  /** The tracks. The same array until something changes; never written to. */
  getTracks(): readonly ClipTrack[] {
    return this._tracks;
  }

  /**
   * The current mixer values by track id. The same Map until a value
   * changes; never written to. A track's own mixer fields in `getTracks()`
   * are the values it entered with, not these.
   */
  getMixer(): Mixer {
    return this._mixer;
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
    return this._history.undo.length > 0;
  }

  get canRedo(): boolean {
    return this._history.redo.length > 0;
  }

  undo(): void {
    const step = undoStep(this._history, this._tracks);
    if (!step) return;
    this._history = step.history;
    this._restoreTracks(step.tracks);
  }

  redo(): void {
    const step = redoStep(this._history, this._tracks);
    if (!step) return;
    this._history = step.history;
    this._restoreTracks(step.tracks);
  }

  clearHistory(): void {
    this._history = EMPTY_HISTORY;
    this._mixer = retainMixer(this._mixer, this._heldStates());
  }

  beginTransaction(): void {
    if (this._transaction) {
      console.warn(
        '[waveform-playlist/engine] beginTransaction: already in a transaction, ' +
          'previous snapshot will be overwritten'
      );
    }
    this._transaction = beginBase(this._tracks);
  }

  commitTransaction(): void {
    const transaction = this._transaction;
    if (!transaction) {
      console.warn('[waveform-playlist/engine] commitTransaction: no active transaction to commit');
      return;
    }
    this._transaction = null;
    // Only push undo entry if mutations actually occurred during the transaction.
    // Without this, no-op drags (e.g., against a boundary) create phantom undo entries.
    if (transaction.changed) {
      this._history = pushStep(this._history, transaction.tracks, this.undoLimit);
    }
  }

  abortTransaction(): void {
    const transaction = this._transaction;
    if (!transaction) {
      console.warn('[waveform-playlist/engine] abortTransaction: no active transaction to abort');
      return;
    }
    this._transaction = null;
    // Only restore if mutations occurred — avoids full adapter rebuild on click
    if (transaction.changed) {
      this._restoreTracks(transaction.tracks);
    }
  }

  // ---------------------------------------------------------------------------
  // Track Management
  // ---------------------------------------------------------------------------

  // A track holds audio clips or MIDI clips, never both (#756). The three
  // methods that take a track check it before they change anything, so a
  // throw leaves the tracks, the undo history and every subscriber untouched.
  setTracks(tracks: readonly ClipTrack[]): void {
    tracks.forEach(assertTrackKind);
    this._history = EMPTY_HISTORY;
    this._tracks = tracks.map((track) => this._withStartTicks(track));
    // An id that is already there keeps its mix; entries of tracks that are gone are dropped.
    this._mixer = retainMixer(seedMixer(this._mixer, this._tracks), this._heldStates());
    this._tracksVersion++;
    this._emit({ type: 'set' });
  }

  /** Returns the track as stored (each clip given a `startTick`). */
  addTrack(track: ClipTrack): ClipTrack {
    assertTrackKind(track);
    this._pushUndoSnapshot();
    const enriched = this._withStartTicks(track);
    this._tracks = [...this._tracks, enriched];
    this._mixer = seedMixer(this._mixer, [enriched]);
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
   * The mixer fields of the given track are not read: the mix is in `getMixer()`.
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
  // Each replaces the Map and one entry, bumps mixerVersion and announces
  // the change. NOT structural changes: no track object is replaced,
  // tracksVersion stays (#501), and they are not undo steps. An id the
  // arrangement holds no entry for does nothing.

  setTrackVolume(trackId: string, volume: number): void {
    this._setMixerValues(trackId, { volume });
  }

  setTrackMute(trackId: string, muted: boolean): void {
    this._setMixerValues(trackId, { muted });
  }

  setTrackSolo(trackId: string, soloed: boolean): void {
    this._setMixerValues(trackId, { soloed });
  }

  setTrackPan(trackId: string, pan: number): void {
    this._setMixerValues(trackId, { pan });
  }

  // ---------------------------------------------------------------------------
  // Tempo
  // ---------------------------------------------------------------------------

  /** Re-derive `startSample` from `startTick` for every clip that has one (after a tempo change). */
  recomputeStartSamples(): void {
    const { ticksToSeconds, sampleRate } = this._timeBase;
    this._tracks = this._tracks.map((track) =>
      withClips(track, (clip) => {
        if (clip.startTick === undefined) return clip;
        const startSample = Math.round(ticksToSeconds(clip.startTick) * sampleRate);
        return startSample === clip.startSample ? clip : { ...clip, startSample };
      })
    );
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

  /**
   * A copy of a track on its way in, with a `startTick` on every clip. The
   * track and each clip are always copied, so the arrangement holds no
   * object its caller can still write to.
   */
  private _withStartTicks(track: ClipTrack): ClipTrack {
    return {
      ...track,
      clips: track.clips.map((clip) => ({
        ...clip,
        startTick: clip.startTick ?? this._tickAt(clip.startSample),
      })),
    };
  }

  private _setMixerValues(trackId: string, values: Partial<TrackMixerValues>): void {
    const next = setMixerValues(this._mixer, trackId, values);
    if (next === this._mixer) return;
    this._mixer = next;
    this._mixerVersion++;
    this._emit({ type: 'mixer', trackId });
  }

  /**
   * The tracks arrays the arrangement can still return to once the history
   * is empty, which is when mixer entries are dropped (`setTracks`,
   * `clearHistory`): the current one, and the base of an open transaction.
   */
  private _heldStates(): ReadonlyArray<readonly ClipTrack[]> {
    return this._transaction ? [this._tracks, this._transaction.tracks] : [this._tracks];
  }

  /** The state before a change: an undo step, or the mark that an open transaction changed. */
  private _pushUndoSnapshot(): void {
    if (this._transaction) {
      if (!this._transaction.changed) {
        this._transaction = { ...this._transaction, changed: true };
      }
      return;
    }
    this._history = pushStep(this._history, this._tracks, this.undoLimit);
  }

  private _restoreTracks(snapshot: readonly ClipTrack[]): void {
    const previous = this._tracks;
    this._tracks = snapshot;
    this._tracksVersion++;
    this._emit({ type: 'restore', previous });
  }

  private _emit(change: ArrangementChange): void {
    // Every change announces itself here, so this is where a new state is
    // frozen (outside production builds) before anyone can read it.
    freezeTracksInDevelopment(this._tracks);
    for (const listener of this._listeners) {
      try {
        listener(change);
      } catch (error) {
        console.warn('[waveform-playlist/engine] Error in arrangement change listener:', error);
      }
    }
  }
}

/** The track with `change` applied to each clip; the same track when no clip changed. */
function withClips(track: ClipTrack, change: (clip: AudioClip) => AudioClip): ClipTrack {
  let changed = false;
  const clips = track.clips.map((clip) => {
    const next = change(clip);
    if (next !== clip) changed = true;
    return next;
  });
  return changed ? { ...track, clips } : track;
}
