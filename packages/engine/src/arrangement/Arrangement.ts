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
 * state of the history still holds the track, and dropped when none does.
 *
 * It knows nothing of adapters or playback. The engine subscribes with
 * `onChange` and makes the adapter call for each change it is told about.
 *
 * A change is announced after the state has changed, to every listener, in
 * the order the changes were made: a change made from inside a listener is
 * delivered after the one being handled has reached everyone.
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
import {
  EMPTY_HISTORY,
  beginBase,
  purgeTrack,
  pushStep,
  redoStep,
  sameTracks,
  undoStep,
  withoutTrack,
} from './history';
import type { History, TransactionBase } from './history';
import { EMPTY_MIXER, carryMixerEntry, retainMixer, seedMixer, setMixerValues } from './mixer';
import type { Mixer, TrackMixerValues } from './mixer';
import { tickConverter, withClips } from './ticks';
import { assertUniqueClipIds, assertUniqueTrackIds, duplicateTrackId } from './validate';
import type { Arrangement, ClipBounds, RemoveTrackOptions } from './types';

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
  | { type: 'mixer'; trackId: string; values: Partial<TrackMixerValues> }
  | { type: 'recompute' }
  | { type: 'history' };

/** How the arrangement converts time. The engine provides it from its adapter and tempo. */
export interface ArrangementTimeBase {
  sampleRate: number;
  /** The unit of the ticks this time base converts to and from: ticks per quarter note. */
  ppqn: number;
  secondsToTicks(seconds: number): number;
  ticksToSeconds(tick: number): number;
}

export interface ArrangementOptions {
  /** Maximum number of undo steps (default 100). */
  undoLimit?: number;
  /** Left out: no engine is attached yet (see `attachEngine`). */
  timeBase?: ArrangementTimeBase;
  /** The first tracks. Not an undo step. */
  tracks?: readonly ClipTrack[];
}

/** The versions the arrangement had right after a change. */
export interface ArrangementVersions {
  tracksVersion: number;
  mixerVersion: number;
}

type ChangeListener = (change: ArrangementChange, at: ArrangementVersions) => void;

export class ArrangementImpl implements Arrangement {
  private _tracks: readonly ClipTrack[] = [];
  private _tracksVersion = 0;
  private _mixerVersion = 0;
  private _mixer: Mixer = EMPTY_MIXER;
  private _history: History = EMPTY_HISTORY;
  private _transaction: TransactionBase | null = null;
  private _timeBase: ArrangementTimeBase | null;
  /** The ppqn the stored ticks are counted in. Null until an engine has attached. */
  private _tickPpqn: number | null;
  private _subscribers: Set<() => void> = new Set();
  private _listeners: Set<ChangeListener> = new Set();
  private _pending: Array<{ change: ArrangementChange; at: ArrangementVersions }> = [];
  private _delivering = false;
  readonly undoLimit: number;

  constructor(options: ArrangementOptions = {}) {
    this.undoLimit = options.undoLimit ?? DEFAULT_UNDO_LIMIT;
    this._timeBase = options.timeBase ?? null;
    this._tickPpqn = options.timeBase?.ppqn ?? null;
    if (options.tracks) this.setTracks(options.tracks);
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
   * changes, a track with a new id enters or entries are dropped; never
   * written to. A track's own mixer fields in `getTracks()`
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

  /** Be told after every change. See `Arrangement.subscribe`. */
  subscribe(listener: () => void): () => void {
    // Each call gets its own entry, so one function subscribed twice is told twice.
    const entry = () => listener();
    this._subscribers.add(entry);
    return () => {
      this._subscribers.delete(entry);
    };
  }

  /**
   * Internal, for the engine: be told WHAT changed, before the subscribers
   * are. A listener here that throws fails the change's caller (an adapter
   * that fails must fail the call that caused it).
   */
  onChange(listener: ChangeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Internal, for the engine: how to convert time, for as long as the engine
   * lives. Ticks counted in another engine's ppqn are converted to this
   * one's, in every state the arrangement holds, and clips that have no
   * `startTick` yet are given one. Returns the function that detaches;
   * afterwards clips are given no ticks until the next engine attaches.
   *
   * Ticks a clip came with before any engine attached are read in the first
   * engine's ppqn. A different TEMPO is not converted: a tick is the musical
   * position, and `startSample` follows it at the next tempo change.
   */
  attachEngine(timeBase: ArrangementTimeBase): () => void {
    if (this._timeBase) {
      console.warn(
        '[waveform-playlist] An arrangement plays through one engine at a time: a second ' +
          'engine was built on an arrangement whose first engine has not been disposed. ' +
          'Dispose the first engine before building another.'
      );
    }
    this._timeBase = timeBase;
    const before = this._tracks;
    if (this._tickPpqn !== null && this._tickPpqn !== timeBase.ppqn) {
      this._convertTicks(this._tickPpqn, timeBase.ppqn);
    }
    this._tickPpqn = timeBase.ppqn;
    const withTicks = this._tracks.map((track) =>
      withClips(track, (clip) =>
        clip.startTick !== undefined ? clip : { ...clip, startTick: this._tickAt(clip.startSample) }
      )
    );
    if (withTicks.some((track, i) => track !== this._tracks[i])) this._tracks = withTicks;
    if (this._tracks !== before) {
      this._tracksVersion++;
      this._emit({ type: 'recompute' });
    }
    return () => {
      if (this._timeBase === timeBase) this._timeBase = null;
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
    this._abortOpenTransaction();
    const step = undoStep(this._history, this._tracks);
    if (!step) return;
    this._history = step.history;
    this._restoreTracks(step.tracks);
  }

  redo(): void {
    this._abortOpenTransaction();
    const step = redoStep(this._history, this._tracks);
    if (!step) return;
    this._history = step.history;
    this._restoreTracks(step.tracks);
  }

  clearHistory(): void {
    const hadHistory = this.canUndo || this.canRedo;
    this._history = EMPTY_HISTORY;
    this._mixer = retainMixer(this._mixer, this._heldStates());
    if (hadHistory) this._emit({ type: 'history' });
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
    // ... and only if the tracks are not back where the transaction began.
    if (transaction.changed && !sameTracks(transaction.tracks, this._tracks)) {
      this._pushStep(transaction.tracks);
      this._emit({ type: 'history' });
    }
  }

  abortTransaction(): void {
    const transaction = this._transaction;
    if (!transaction) {
      console.warn('[waveform-playlist/engine] abortTransaction: no active transaction to abort');
      return;
    }
    this._abortOpenTransaction();
  }

  // ---------------------------------------------------------------------------
  // Track Management
  // ---------------------------------------------------------------------------

  // A track holds audio clips or MIDI clips, never both (#756); track ids are
  // unique, and so are clip ids within a track. The three methods that take a
  // track check it before they change anything, so a throw leaves the tracks,
  // the undo history, the mixer and every subscriber untouched.
  setTracks(tracks: readonly ClipTrack[]): void {
    tracks.forEach(assertTrackKind);
    assertUniqueTrackIds(tracks);
    tracks.forEach(assertUniqueClipIds);
    // Everything before is replaced, an open transaction included.
    this._transaction = null;
    this._history = EMPTY_HISTORY;
    // An id that is in the tracks being replaced keeps its mix; every other
    // entry is dropped (a track that only the history held is gone with it).
    const kept = retainMixer(this._mixer, [this._tracks]);
    this._tracks = tracks.map((track) => this._ingest(track));
    this._mixer = retainMixer(seedMixer(kept, this._tracks), [this._tracks]);
    this._tracksVersion++;
    this._emit({ type: 'set' });
  }

  addTrack(track: ClipTrack): void {
    assertTrackKind(track);
    assertUniqueClipIds(track);
    if (this._tracks.some((t) => t.id === track.id)) throw duplicateTrackId(track.id);
    this._pushUndoSnapshot();
    const enriched = this._ingest(track);
    this._tracks = [...this._tracks, enriched];
    this._mixer = seedMixer(this._mixer, [enriched]);
    this._tracksVersion++;
    this._emit({ type: 'add', trackId: track.id });
  }

  /**
   * Remove a track: an undo step. With `undoable: false` there is no step,
   * and the track is also taken out of every undo and redo state, so that no
   * undo or redo brings it back (a dropped file that could not be decoded).
   */
  removeTrack(trackId: string, options?: RemoveTrackOptions): void {
    if (options?.undoable === false) {
      this._removeTrackEverywhere(trackId);
      return;
    }
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
   * Replace a track, with a track or with a function of the current one. The
   * mixer fields of the new track are not read: the mix is in `getMixer()`.
   * An id no track has changes nothing (a track object is still checked and
   * may throw; a function is not called for it).
   *
   * A track object is copied on its way in. A function's result keeps the
   * clip objects the arrangement already held, so states go on sharing them.
   */
  updateTrack(trackId: string, next: ClipTrack | ((track: ClipTrack) => ClipTrack)): void {
    const current = this._tracks.find((t) => t.id === trackId);
    const byFunction = typeof next === 'function';
    if (byFunction && !current) return;
    const track = byFunction ? next(current as ClipTrack) : next;
    if (byFunction && track === current) return;

    assertTrackKind(track);
    assertUniqueClipIds(track);
    if (track.id !== trackId && this._tracks.some((t) => t.id === track.id)) {
      throw duplicateTrackId(track.id);
    }
    if (!current) return;
    this._pushUndoSnapshot();
    const enriched = this._ingest(track, byFunction ? new Set(current.clips) : undefined);
    this._tracks = this._tracks.map((t) => (t.id === trackId ? enriched : t));
    // A track that is given a new id takes its mix with it.
    this._mixer = seedMixer(carryMixerEntry(this._mixer, trackId, enriched.id), [enriched]);
    this._tracksVersion++;
    this._emit({ type: 'update', trackId });
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
    const minDuration = this._minDuration(clip);

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
    const minDuration = this._minDuration(clip);

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
    const minDuration = this._minDuration(clip);

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
  // tracksVersion stays (#501), and they are not undo steps. An id that is
  // not in the current tracks does nothing.

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
    if (!this._timeBase) return;
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

  /**
   * The tick of a sample position. Without an engine there is no tempo to
   * convert with, so there is no tick: a clip that is placed, moved or cut
   * meanwhile has none, and is given one when the next engine attaches.
   */
  private _tickAt(startSample: number): number | undefined {
    if (!this._timeBase) return undefined;
    return this._timeBase.secondsToTicks(startSample / this._timeBase.sampleRate);
  }

  /** The shortest a clip may be: a tenth of a second, at the engine's rate or else the clip's own. */
  private _minDuration(clip: AudioClip): number {
    const sampleRate = this._timeBase?.sampleRate ?? clip.sampleRate;
    return Math.floor(DEFAULT_MIN_DURATION_SECONDS * sampleRate);
  }

  /**
   * A copy of a track on its way in, with a `startTick` on every clip when
   * an engine is attached (and none added when there is no engine). The track and each clip are copied, so the
   * arrangement holds no object its caller can still write to; a clip in
   * `held` is one the arrangement already holds and is kept as it is.
   */
  private _ingest(track: ClipTrack, held?: ReadonlySet<AudioClip>): ClipTrack {
    return {
      ...track,
      clips: track.clips.map((clip) =>
        held?.has(clip)
          ? clip
          : { ...clip, startTick: clip.startTick ?? this._tickAt(clip.startSample) }
      ),
    };
  }

  private _setMixerValues(trackId: string, values: Partial<TrackMixerValues>): void {
    // The entry of a removed track is kept for an undo; it is not a track to mix.
    if (!this._tracks.some((t) => t.id === trackId)) return;
    const next = setMixerValues(this._mixer, trackId, values);
    if (next === this._mixer) return;
    this._mixer = next;
    this._mixerVersion++;
    this._emit({ type: 'mixer', trackId, values });
  }

  /** Every tracks array the arrangement can still return to, and the current one. */
  private _heldStates(): ReadonlyArray<readonly ClipTrack[]> {
    return [
      this._tracks,
      ...this._history.undo,
      ...this._history.redo,
      ...(this._transaction ? [this._transaction.tracks] : []),
    ];
  }

  /** `removeTrack` with `undoable: false`: out of the current tracks and out of every stored state. */
  private _removeTrackEverywhere(trackId: string): void {
    const wasThere = this._tracks.some((t) => t.id === trackId);
    const purged = purgeTrack(this._history, this._tracks, trackId);
    const historyChanged = purged.history !== this._history;
    this._history = purged.history;
    if (this._transaction) {
      // An abort goes back to the base: the track must not be in it either.
      this._transaction = {
        ...this._transaction,
        tracks: withoutTrack(this._transaction.tracks, trackId),
      };
    }
    this._tracks = purged.current;
    this._mixer = retainMixer(this._mixer, this._heldStates());
    if (wasThere) {
      this._tracksVersion++;
      this._emit({ type: 'remove', trackId });
    } else if (historyChanged) {
      this._emit({ type: 'history' });
    }
  }

  /** The state before a change: an undo step, or the mark that an open transaction changed. */
  private _pushUndoSnapshot(): void {
    if (this._transaction) {
      if (!this._transaction.changed) {
        this._transaction = { ...this._transaction, changed: true };
      }
      return;
    }
    this._pushStep(this._tracks);
  }

  /** Add an undo step. The history may let go of states with it (the redo stack, a step past the limit). */
  private _pushStep(tracks: readonly ClipTrack[]): void {
    const letsGo = this._history.redo.length > 0 || this._history.undo.length >= this.undoLimit;
    this._history = pushStep(this._history, tracks, this.undoLimit);
    if (letsGo) this._mixer = retainMixer(this._mixer, this._heldStates());
  }

  private _restoreTracks(snapshot: readonly ClipTrack[]): void {
    const previous = this._tracks;
    this._tracks = snapshot;
    this._tracksVersion++;
    this._emit({ type: 'restore', previous });
  }

  /** Every stored tick, from one engine's unit to another's: the current tracks and every state held. */
  private _convertTicks(fromPpqn: number, toPpqn: number): void {
    const convert = tickConverter(fromPpqn, toPpqn);
    this._tracks = convert(this._tracks);
    this._history = {
      undo: this._history.undo.map(convert),
      redo: this._history.redo.map(convert),
    };
    if (this._transaction) {
      this._transaction = { ...this._transaction, tracks: convert(this._transaction.tracks) };
    }
  }

  /** Ends an open transaction, restoring the tracks it began from if it changed them. */
  private _abortOpenTransaction(): void {
    const transaction = this._transaction;
    if (!transaction) return;
    this._transaction = null;
    // Only restore if mutations occurred — avoids full adapter rebuild on click
    if (transaction.changed) {
      this._restoreTracks(transaction.tracks);
    }
  }

  /**
   * Announce a change. Called after the state has changed. When a listener
   * makes a change of its own, that change waits here until the one being
   * delivered has reached every listener, so all of them see the changes in
   * the order they were made.
   *
   * A listener that throws does not stop the delivery; the first error is
   * thrown to the caller once everyone has been told (the engine's listener
   * throws when its adapter does, and the caller of the engine method has
   * always received that error).
   */
  private _emit(change: ArrangementChange): void {
    // Every change announces itself here, so this is where a new state is
    // frozen (outside production builds) before anyone can read it.
    freezeTracksInDevelopment(this._tracks);
    this._pending.push({
      change,
      at: { tracksVersion: this._tracksVersion, mixerVersion: this._mixerVersion },
    });
    if (this._delivering) return;

    this._delivering = true;
    let failed = false;
    let firstError: unknown;
    try {
      for (let next = this._pending.shift(); next; next = this._pending.shift()) {
        for (const listener of [...this._listeners]) {
          try {
            listener(next.change, next.at);
          } catch (error) {
            if (!failed) {
              failed = true;
              firstError = error;
            }
          }
        }
        // The engine has brought its adapter in step; now everyone else.
        for (const subscriber of [...this._subscribers]) {
          try {
            subscriber();
          } catch (error) {
            console.warn('[waveform-playlist] Error in an arrangement subscriber:', error);
          }
        }
      }
    } finally {
      this._delivering = false;
    }
    if (failed) throw firstError;
  }
}
