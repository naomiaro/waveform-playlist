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
 * entry and no track object. The current Map holds an entry for each current
 * track; a saved state (an undo or redo step, a transaction's base) holds the
 * tracks AND the Map from its moment, so undo, redo and abort bring back the
 * mix as well (#843).
 *
 * It knows nothing of adapters or playback. The engine subscribes with
 * `onChange` and makes the adapter call for each change it is told about.
 *
 * A change is announced after the state has changed, to every listener, in
 * the order the changes were made: a change made from inside a listener is
 * delivered after the one being handled has reached everyone.
 */

import type {
  ArrangementTrack,
  AudioClip,
  ClipSource,
  LoadingClip,
  ValueSource,
} from '@waveform-playlist/core';
import { isLoadingClip } from '@waveform-playlist/core';
import { ARRANGEMENT_ATTACH_DECODE, ARRANGEMENT_ATTACH_TIME_BASE } from './attach';
import type { ArrangementTimeBase, GetDecodeContext } from './attach';
import { clipBounds, constrainTrim, moveClip, splitClip, trimClip } from './clipEdits';
import type { ClipEditTime } from './clipEdits';
import { freezeTracksInDevelopment } from './devFreeze';
import { defaultLoadSource } from './loadSource';
import type { LoadSource } from './loadSource';
import { ArrangementSources } from './sources';
import type { ArrangementSourcesValue } from './sources';
import {
  EMPTY_HISTORY,
  beginBase,
  mapHistoryTracks,
  purgeTrack,
  pushStep,
  redoStep,
  sameState,
  stateWithoutTrack,
  undoStep,
  withStateTracks,
} from './history';
import type { History, SavedState, TransactionBase } from './history';
import {
  EMPTY_MIXER,
  carryMixerEntry,
  mixerChanges,
  mixerOf,
  seedMixer,
  setMixerValues,
  withoutEntry,
} from './mixer';
import type { Mixer, TrackMixerValues } from './mixer';
import { forLoadedClips, tickPreparer, withClips } from './ticks';
import {
  assertClipsOfTrackKind,
  assertUniqueClipIds,
  assertUniqueTrackIds,
  duplicateTrackId,
} from './validate';
import type { Arrangement, ClipBounds, RemoveTrackOptions } from './types';

const DEFAULT_MIN_DURATION_SECONDS = 0.1;
const DEFAULT_UNDO_LIMIT = 100;

/** What changed, for a subscriber that has to act on it (the engine's adapter sync). */
export type ArrangementChange =
  | { type: 'set' }
  | { type: 'add'; trackId: string }
  | { type: 'remove'; trackId: string }
  /** `previous`: the track object that was replaced (for a listener that sends only what differs). */
  | { type: 'update'; trackId: string; previous: ArrangementTrack }
  | { type: 'reorder' }
  /**
   * An undo, a redo or an abort that changed the tracks (and maybe the mix):
   * `previous` and `previousMixer` are the tracks and the mix from before.
   */
  | { type: 'restore'; previous: readonly ArrangementTrack[]; previousMixer: Mixer }
  /** An undo, a redo or an abort that changed the mix only. */
  | { type: 'restoreMix'; previousMixer: Mixer }
  /** Audio arrived: loading clips of the current tracks became loaded clips. */
  | { type: 'load'; previous: readonly ArrangementTrack[] }
  | { type: 'mixer'; trackId: string; values: Partial<TrackMixerValues> }
  | { type: 'recompute' }
  | { type: 'history' };

export type { ArrangementTimeBase };

export interface ArrangementOptions {
  /** Maximum number of undo steps (default 100). */
  undoLimit?: number;
  /** Left out: no engine is attached yet (see `attachEngine`). */
  timeBase?: ArrangementTimeBase;
  /** The first tracks. Not an undo step. */
  tracks?: readonly ArrangementTrack[];
  /** How a clip's source becomes an AudioBuffer. Default: fetch (or read) and decode. */
  loadSource?: LoadSource;
}

/** The versions the arrangement had right after a change. */
export interface ArrangementVersions {
  tracksVersion: number;
  mixerVersion: number;
  /**
   * Set when, inside this change, clips of OTHER tracks became loaded clips
   * (a clip that came in carried the audio of a source they were waiting
   * for): the tracks from before that switch, so that a listener can tell
   * which tracks gained a clip besides the one the change names.
   */
  switched?: readonly ArrangementTrack[];
}

type ChangeListener = (change: ArrangementChange, at: ArrangementVersions) => void;

export class ArrangementImpl implements Arrangement {
  private _tracks: readonly ArrangementTrack[] = [];
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
  private readonly _sources: ArrangementSources;
  readonly undoLimit: number;

  constructor(options: ArrangementOptions = {}) {
    this.undoLimit = options.undoLimit ?? DEFAULT_UNDO_LIMIT;
    this._timeBase = options.timeBase ?? null;
    this._tickPpqn = options.timeBase?.ppqn ?? null;
    this._sources = new ArrangementSources(options.loadSource ?? defaultLoadSource, () =>
      this._onSourceSettled()
    );
    if (options.tracks) this.setTracks(options.tracks);
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  /** The tracks. The same array until something changes; never written to. */
  getTracks(): readonly ArrangementTrack[] {
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

  /**
   * Where each source the clips name is: pending, loaded or failed. The same
   * object until a status changes.
   */
  get sources(): ValueSource<ArrangementSourcesValue> {
    return this._sources.value;
  }

  /** Start a source whose LOAD failed again. See `Arrangement.retry`. */
  retry(src: ClipSource): void {
    this._sources.retry(src);
  }

  /** The attach point of `attachDecodeContext()` (./attach.ts): a context to decode with. */
  [ARRANGEMENT_ATTACH_DECODE](getContext: GetDecodeContext): () => void {
    return this._sources.attachDecodeContext(getContext);
  }

  /** The attach point an engine uses (./attach.ts): `attachEngine`. */
  [ARRANGEMENT_ATTACH_TIME_BASE](timeBase: ArrangementTimeBase): () => void {
    return this.attachEngine(timeBase);
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
   * that fails must fail the call that caused it). A `'load'` has no caller
   * (audio arrived by itself): the engine catches its adapter's error for
   * that change and reports it.
   */
  onChange(listener: ChangeListener): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  /**
   * Internal, for the engine: how to convert time, for as long as the engine
   * lives. In every state the arrangement holds (the current tracks, the
   * undo and redo states, an open transaction's base), ticks counted in
   * another engine's ppqn are converted to this one's and clips that have no
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
    // Work everything out first: the engine's tempo map may throw, and then
    // nothing here has changed and the arrangement is not attached.
    const prepare = tickPreparer(timeBase, this._tickPpqn);
    const tracks = prepare(this._tracks);
    const history = mapHistoryTracks(this._history, prepare);
    const transaction = this._transaction && {
      ...this._transaction,
      state: withStateTracks(this._transaction.state, prepare(this._transaction.state.tracks)),
    };

    this._timeBase = timeBase;
    this._tickPpqn = timeBase.ppqn;
    this._history = history;
    this._transaction = transaction;
    if (tracks !== this._tracks) {
      this._tracks = tracks;
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
    const step = undoStep(this._history, this._currentState());
    if (!step) return;
    this._history = step.history;
    // A step that equals the current state still moved the history.
    if (!this._restoreState(step.state)) this._emit({ type: 'history' });
  }

  redo(): void {
    this._abortOpenTransaction();
    const step = redoStep(this._history, this._currentState());
    if (!step) return;
    this._history = step.history;
    if (!this._restoreState(step.state)) this._emit({ type: 'history' });
  }

  clearHistory(): void {
    const hadHistory = this.canUndo || this.canRedo;
    this._history = EMPTY_HISTORY;
    if (hadHistory) this._emit({ type: 'history' });
  }

  beginTransaction(): void {
    if (this._transaction) {
      console.warn(
        '[waveform-playlist/engine] beginTransaction: already in a transaction, ' +
          'previous snapshot will be overwritten'
      );
    }
    const replaced = this._transaction !== null;
    this._transaction = beginBase(this._currentState());
    // The base that was dropped may have been the last state naming a source.
    if (replaced) this._resyncSourcesQuietly();
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
    // ... and only if the tracks and the mix are not back where the transaction began.
    if (transaction.changed && !sameState(transaction.state, this._currentState())) {
      this._pushStep(transaction.state);
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
  setTracks(tracks: readonly ArrangementTrack[]): void {
    tracks.forEach(assertClipsOfTrackKind);
    assertUniqueTrackIds(tracks);
    tracks.forEach(assertUniqueClipIds);
    // Everything before is replaced, an open transaction included.
    this._transaction = null;
    this._history = EMPTY_HISTORY;
    // An id that is in the tracks being replaced keeps its mix (the current
    // Map holds the current tracks only); a new id is seeded, and the entry of
    // an id that is not in the new tracks is dropped.
    this._tracks = tracks.map((track) => this._ingest(track));
    this._mixer = mixerOf(this._mixer, this._tracks);
    this._tracksVersion++;
    this._emit({ type: 'set' });
  }

  addTrack(track: ArrangementTrack): void {
    assertClipsOfTrackKind(track);
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
    // The saved state from before keeps the entry; the current Map holds
    // the current tracks only. Dropping is not a mixer change.
    this._mixer = withoutEntry(this._mixer, trackId);
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
   * The track is copied on its way in, and so is each clip, except a clip
   * object this track already holds (one taken from `getTracks()`): that
   * one is kept as it is, so states go on sharing it and a listener can see
   * that it did not change.
   */
  updateTrack(
    trackId: string,
    next: ArrangementTrack | ((track: ArrangementTrack) => ArrangementTrack)
  ): void {
    const current = this._tracks.find((t) => t.id === trackId);
    const byFunction = typeof next === 'function';
    if (byFunction && !current) return;
    const track = byFunction ? next(current as ArrangementTrack) : next;
    if (byFunction && track === current) return;

    assertClipsOfTrackKind(track);
    assertUniqueClipIds(track);
    if (track.id !== trackId && this._tracks.some((t) => t.id === track.id)) {
      throw duplicateTrackId(track.id);
    }
    if (!current) return;
    this._pushUndoSnapshot();
    // A clip object this track already holds is kept, in either form.
    const enriched = this._ingest(track, new Set(current.clips));
    this._tracks = this._tracks.map((t) => (t.id === trackId ? enriched : t));
    // A track that is given a new id takes its mix with it, and the old id's
    // entry goes (the saved state from before keeps it).
    this._mixer = seedMixer(carryMixerEntry(this._mixer, trackId, enriched.id), [enriched]);
    this._tracksVersion++;
    this._emit({ type: 'update', trackId, previous: current });
  }

  // ---------------------------------------------------------------------------
  // Clips (the edits themselves are pure functions in ./clipEdits)
  // ---------------------------------------------------------------------------

  /** Get a clip's full bounds for trim constraint computation. Returns null if not found. */
  getClipBounds(trackId: string, clipId: string): ClipBounds | null {
    return clipBounds(this._tracks, trackId, clipId);
  }

  /** Constrain a trim delta using the collision/bounds logic.
   *  Uses the clip's current state and neighboring clips for constraints. */
  constrainTrimDelta(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): number {
    return constrainTrim(this._tracks, trackId, clipId, boundary, deltaSamples, this._clipTime);
  }

  /** Move a clip by deltaSamples. Returns the constrained delta actually applied (0 if no-op). */
  moveClip(trackId: string, clipId: string, deltaSamples: number): number {
    const moved = moveClip(this._tracks, trackId, clipId, deltaSamples, this._clipTime);
    if (!moved) return 0;
    this._replaceTrack(trackId, moved.tracks);
    return moved.delta;
  }

  splitClip(trackId: string, clipId: string, atSample: number): void {
    const next = splitClip(this._tracks, trackId, clipId, atSample, this._clipTime);
    if (next) this._replaceTrack(trackId, next);
  }

  trimClip(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): void {
    const next = trimClip(this._tracks, trackId, clipId, boundary, deltaSamples, this._clipTime);
    if (next) this._replaceTrack(trackId, next);
  }

  // ---------------------------------------------------------------------------
  // Mixer values
  // ---------------------------------------------------------------------------
  //
  // Each replaces the Map and one entry, bumps mixerVersion and announces
  // the change. NOT structural changes: no track object is replaced,
  // tracksVersion stays (#501). Outside a transaction they are not undo
  // steps; inside one they are part of it, like any other change (#843). An
  // id that is not in the current tracks does nothing.

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
      withClips(
        track,
        forLoadedClips((clip) => {
          if (clip.startTick === undefined) return clip;
          const startSample = Math.round(ticksToSeconds(clip.startTick) * sampleRate);
          return startSample === clip.startSample ? clip : { ...clip, startSample };
        })
      )
    );
    this._tracksVersion++;
    this._emit({ type: 'recompute' });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  /** The tracks after an edit of one track: an undo step, the new array, the announcement. */
  private _replaceTrack(trackId: string, tracks: readonly ArrangementTrack[]): void {
    // The edit found the track, so it is there.
    const previous = this._tracks.find((t) => t.id === trackId) as ArrangementTrack;
    this._pushUndoSnapshot();
    this._tracks = tracks;
    this._tracksVersion++;
    this._emit({ type: 'update', trackId, previous });
  }

  /** How the clip edits convert time: through the attached engine, or not at all. */
  private readonly _clipTime: ClipEditTime = {
    tickAt: (startSample) => this._tickAt(startSample),
    minDuration: (clip) => this._minDuration(clip),
  };

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
  private _ingest(
    track: ArrangementTrack,
    held?: ReadonlySet<AudioClip | LoadingClip>
  ): ArrangementTrack {
    return {
      ...track,
      clips: track.clips.map((clip) => {
        if (held?.has(clip)) return clip;
        // A clip that is still loading has no samples to count a tick from.
        if (isLoadingClip(clip)) return { ...clip };
        return { ...clip, startTick: clip.startTick ?? this._tickAt(clip.startSample) };
      }),
    };
  }

  private _setMixerValues(trackId: string, values: Partial<TrackMixerValues>): void {
    if (!this._tracks.some((t) => t.id === trackId)) return;
    const next = setMixerValues(this._mixer, trackId, values);
    if (next === this._mixer) return;
    this._markTransactionChanged();
    this._mixer = next;
    this._mixerVersion++;
    this._emit({ type: 'mixer', trackId, values });
  }

  /** The tracks and the mix as they are now: what an undo step or a transaction's base saves. */
  private _currentState(): SavedState {
    return { tracks: this._tracks, mixer: this._mixer };
  }

  /** Every tracks array the arrangement can still return to, and the current one (for the sources). */
  private _heldStates(): ReadonlyArray<readonly ArrangementTrack[]> {
    return [
      this._tracks,
      ...this._history.undo.map((state) => state.tracks),
      ...this._history.redo.map((state) => state.tracks),
      ...(this._transaction ? [this._transaction.state.tracks] : []),
    ];
  }

  /** `removeTrack` with `undoable: false`: out of the current tracks and out of every stored state. */
  private _removeTrackEverywhere(trackId: string): void {
    const wasThere = this._tracks.some((t) => t.id === trackId);
    const purged = purgeTrack(this._history, this._currentState(), trackId);
    const historyChanged = purged.history !== this._history;
    this._history = purged.history;
    if (this._transaction) {
      // An abort goes back to the base: the track must not be in it either.
      this._transaction = {
        ...this._transaction,
        state: stateWithoutTrack(trackId)(this._transaction.state),
      };
    }
    this._tracks = purged.current.tracks;
    this._mixer = purged.current.mixer;
    if (wasThere) {
      this._tracksVersion++;
      this._emit({ type: 'remove', trackId });
    } else if (historyChanged) {
      this._emit({ type: 'history' });
    } else {
      // Only an open transaction's base held it.
      this._resyncSourcesQuietly();
    }
  }

  /** The state before a change: an undo step, or the mark that an open transaction changed. */
  private _pushUndoSnapshot(): void {
    if (this._transaction) {
      this._markTransactionChanged();
      return;
    }
    this._pushStep(this._currentState());
  }

  /** An open transaction has changed something. */
  private _markTransactionChanged(): void {
    if (this._transaction && !this._transaction.changed) {
      this._transaction = { ...this._transaction, changed: true };
    }
  }

  /** Add an undo step. */
  private _pushStep(state: SavedState): void {
    this._history = pushStep(this._history, state, this.undoLimit);
  }

  /**
   * Make a saved state the current one (an undo, a redo, an abort) and
   * announce it: `'restore'` when the tracks array is another one (with the
   * mix from before, which may differ too), `'restoreMix'` when only mixer
   * values differ. `mixerVersion` counts it when a track that is in both
   * states has other values; an entry that comes or goes with its track is
   * not a mixer change. Returns false when nothing differed and nothing was
   * announced.
   */
  private _restoreState(state: SavedState): boolean {
    const previous = this._tracks;
    const previousMixer = this._mixer;
    const tracksChanged = state.tracks !== previous;
    const mixChanged = mixerChanges(previousMixer, state.mixer).length > 0;
    this._tracks = state.tracks;
    this._mixer = state.mixer;
    if (mixChanged) this._mixerVersion++;
    if (tracksChanged) {
      this._tracksVersion++;
      this._emit({ type: 'restore', previous, previousMixer });
    } else if (mixChanged) {
      this._emit({ type: 'restoreMix', previousMixer });
    }
    return tracksChanged || mixChanged;
  }

  /** Ends an open transaction, restoring the state it began from if it changed anything. */
  private _abortOpenTransaction(): void {
    const transaction = this._transaction;
    if (!transaction) return;
    this._transaction = null;
    // Only restore if mutations occurred — avoids full adapter rebuild on click
    if (transaction.changed) {
      this._restoreState(transaction.state);
    }
  }

  /** Declare the sources every state names, and switch the clips whose audio is there. */
  private _syncSources(): readonly ArrangementTrack[] | null {
    this._sources.declare(this._heldStates());
    return this._switchLoaded();
  }

  /** The stored states changed with nothing to announce: the sources they name may have. */
  private _resyncSourcesQuietly(): void {
    this._syncSources();
    this._sources.finishPass();
  }

  /**
   * Replace every loading clip whose source is loaded with its loaded clip,
   * in the current tracks and in every state the arrangement can return to.
   * The same loading-clip object becomes the same loaded clip everywhere, and
   * states go on sharing the tracks they shared. Not an undo step. Returns
   * the current tracks from before, or null when they did not change.
   */
  private _switchLoaded(): readonly ArrangementTrack[] | null {
    const pass = this._sources.beginPass((startSample) => this._tickAt(startSample));
    const previous = this._tracks;
    this._tracks = pass.current(previous);
    this._history = mapHistoryTracks(this._history, pass.stored);
    if (this._transaction) {
      const { state } = this._transaction;
      this._transaction = {
        ...this._transaction,
        state: withStateTracks(state, pass.stored(state.tracks)),
      };
    }
    return this._tracks === previous ? null : previous;
  }

  /** A load finished or failed by itself (not inside one of this arrangement's methods). */
  private _onSourceSettled(): void {
    const previous = this._switchLoaded();
    if (previous) {
      this._tracksVersion++;
      this._emit({ type: 'load', previous });
    } else {
      this._sources.finishPass();
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
    // The states may name other sources now, and a clip that came in may name
    // one that is loaded already: it is a loaded clip before anyone is told.
    // A change of the mix alone names no other source.
    const mixOnly = change.type === 'mixer' || change.type === 'restoreMix';
    const switched = mixOnly ? null : this._syncSources();
    // Every change announces itself here, so this is where a new state is
    // frozen (outside production builds) before anyone can read it.
    freezeTracksInDevelopment(this._tracks);
    const at: ArrangementVersions = {
      tracksVersion: this._tracksVersion,
      mixerVersion: this._mixerVersion,
    };
    // An add or an update names one track; the others that gained a clip go with it.
    if (switched && (change.type === 'add' || change.type === 'update')) at.switched = switched;
    this._pending.push({ change, at });
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
    // Last: whoever follows `sources` finds the tracks as they are now, and a
    // change it makes in answer is a call of its own.
    this._sources.finishPass();
    if (failed) throw firstError;
  }
}
