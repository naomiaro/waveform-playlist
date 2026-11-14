/**
 * The audio an arrangement's clips name: which sources are wanted, the loader
 * that fetches them, and the switch of a loading clip to a loaded one.
 *
 * Wanted is every source a loading clip names in any state the arrangement
 * holds (the current tracks, each undo and redo state, an open transaction's
 * base), so an undo never starts a fetch again and a failed source stays
 * failed until `retry`. A loaded clip that carries both its `src` and its
 * `audioBuffer` gives the loader that buffer, and nothing is fetched for it.
 * (No state has a loading clip on a MIDI track: the arrangement refuses one.)
 *
 * Nothing here holds tracks. The arrangement hands in its states to declare
 * what is wanted and to have the loaded sources applied; `value` is derived
 * from the loader and from what those passes found.
 */

import { createSourceLoader, createValueSource, isLoadingClip } from '@waveform-playlist/core';
import type {
  ArrangementTrack,
  AudioClip,
  ClipSource,
  LoadingClip,
  SourceLoader,
  SourceState,
  ValueSource,
} from '@waveform-playlist/core';
import type { LoadSource } from './loadSource';
import { resolveLoadingClip } from './resolveLoadingClip';
import type { ResolvedLoadingClip } from './resolveLoadingClip';

type Tracks = readonly ArrangementTrack[];

/** Where one source is. `error` is there when it failed. */
export interface ArrangementSourceState {
  status: 'pending' | 'loaded' | 'failed';
  error?: Error;
}

/** What `arrangement.sources` holds. A new object only when a status changes. */
export interface ArrangementSourcesValue {
  /** Every source the arrangement's clips name. The order of the entries means nothing. */
  sources: ReadonlyMap<ClipSource, ArrangementSourceState>;
  pendingCount: number;
  failedCount: number;
  /** True while a source is pending. */
  isLoading: boolean;
}

const EMPTY_VALUE: ArrangementSourcesValue = {
  sources: new Map(),
  pendingCount: 0,
  failedCount: 0,
  isLoading: false,
};

/** What one track object names. Worked out once per object: tracks are never written to. */
interface TrackSources {
  /** The loading clips the track holds. */
  loading: readonly LoadingClip[];
  /** Loaded clips that carry their source and its audio. */
  carried: ReadonlyArray<readonly [ClipSource, AudioBuffer]>;
}

interface Deferred {
  promise: Promise<void>;
  resolve(): void;
}

function deferred(): Deferred {
  let resolve = () => {};
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function sameMembers<T>(a: ReadonlySet<T>, b: ReadonlySet<T>): boolean {
  if (a.size !== b.size) return false;
  for (const member of a) if (!b.has(member)) return false;
  return true;
}

export class ArrangementSources {
  readonly value: ValueSource<ArrangementSourcesValue>;
  private readonly _publish: (value: ArrangementSourcesValue) => void;
  private readonly _loader: SourceLoader<ClipSource, AudioBuffer>;
  private readonly _trackSources = new WeakMap<ArrangementTrack, TrackSources>();
  /** A loading clip and the buffer it was converted with: the same clip object every time. */
  private readonly _resolved = new WeakMap<
    LoadingClip,
    { buffer: AudioBuffer; result: ResolvedLoadingClip }
  >();
  private _wanted: ReadonlySet<ClipSource> = new Set();
  /** Per source, the reason a clip of the CURRENT tracks could not be made (found by the last pass). */
  private _unusable: ReadonlyMap<ClipSource, string> = new Map();
  private _getContext: (() => Promise<BaseAudioContext>) | null = null;
  private _attached = deferred();
  /** While `declare` talks to the loader, its notifications are not acted on. */
  private _declaring = false;

  /**
   * @param loadSource how a source becomes an AudioBuffer
   * @param onSettled called when a source settled by itself (a load finished or failed)
   */
  constructor(loadSource: LoadSource, onSettled: () => void) {
    const { source, publish } = createValueSource<ArrangementSourcesValue>(EMPTY_VALUE);
    this.value = source;
    this._publish = publish;
    this._loader = createSourceLoader<ClipSource, AudioBuffer>({
      load: async (src, signal) => {
        // Nothing is fetched until there is a context to decode with.
        let getContext = this._getContext;
        while (!getContext) {
          await this._attached.promise;
          getContext = this._getContext;
        }
        signal.throwIfAborted();
        const audioContext = await getContext();
        signal.throwIfAborted();
        return loadSource(src, { signal, audioContext });
      },
    });
    this._loader.subscribe(() => {
      if (!this._declaring) onSettled();
    });
  }

  /**
   * Give the loader a context to decode with; loads that were waiting start.
   * Returns the function that takes it away again: loads in flight are
   * aborted, loaded sources are kept, and the next attach starts the aborted
   * ones again.
   */
  attachDecodeContext(getContext: () => Promise<BaseAudioContext>): () => void {
    if (this._getContext) {
      console.warn(
        '[waveform-playlist] An arrangement decodes with one audio context at a time: a ' +
          'context was attached while another still is. Detach the first (dispose its ' +
          'engine) before attaching another.'
      );
    }
    this._getContext = getContext;
    this._attached.resolve();
    // Loads a detach aborted are pending without a load: this starts them.
    this._loader.setWanted(this._wanted);
    return () => {
      if (this._getContext !== getContext) return;
      this._getContext = null;
      this._attached = deferred();
      this._loader.suspend();
    };
  }

  /** Start a source whose load failed again. Does nothing for any other source. */
  retry(src: ClipSource): void {
    this._loader.retry(src);
  }

  /**
   * Tell the loader what `states` name. The loader is touched only when the
   * set of wanted sources changed or a clip brought the audio of a source
   * that is not loaded yet.
   */
  declare(states: Iterable<Tracks>): void {
    const wanted = new Set<ClipSource>();
    const carried = new Map<ClipSource, AudioBuffer>();
    for (const tracks of states) {
      for (const track of tracks) {
        const named = this._sourcesOf(track);
        for (const clip of named.loading) wanted.add(clip.src);
        for (const [src, buffer] of named.carried) if (!carried.has(src)) carried.set(src, buffer);
      }
    }
    // A source a loaded clip carries is kept as loaded for as long as it is named.
    for (const src of carried.keys()) wanted.add(src);

    this._declaring = true;
    try {
      // The loader keeps the buffer it has for a source that is loaded already.
      for (const [src, buffer] of carried) this._loader.provide(src, buffer);
      if (!sameMembers(wanted, this._wanted)) {
        this._wanted = wanted;
        this._loader.setWanted(wanted);
      }
    } finally {
      this._declaring = false;
    }
  }

  /**
   * One pass over every state: two functions that replace, in a tracks
   * array, every loading clip whose source is loaded with its loaded clip.
   * They remember each track they have seen, so states that shared a track
   * object go on sharing one, and they return the same array when nothing in
   * it changed. Call `current` with the current tracks FIRST, then `stored`
   * for each stored state, then `finishPass()`.
   *
   * A clip that cannot be made fails its source only while it is in the
   * current tracks: one that only an undo or redo state holds is not
   * something the app can see or mend.
   *
   * @param tickAt the tick of a sample position (undefined without an engine)
   */
  beginPass(tickAt: (startSample: number) => number | undefined): {
    current(tracks: Tracks): Tracks;
    stored(tracks: Tracks): Tracks;
  } {
    const loaded = this._loader.getSnapshot();
    const unusable = new Map<ClipSource, string>();
    this._unusable = unusable;
    const seen = new Map<ArrangementTrack, ArrangementTrack>();
    let inCurrentTracks = false;

    const switched = (clip: LoadingClip): AudioClip | LoadingClip => {
      const state = loaded.get(clip.src);
      if (state?.status !== 'loaded') return clip;
      const result = this._resolve(clip, state.value, tickAt);
      if ('clip' in result) return result.clip;
      if (inCurrentTracks && !unusable.has(clip.src)) unusable.set(clip.src, result.unusable);
      return clip;
    };

    const mapTrack = (track: ArrangementTrack): ArrangementTrack => {
      const known = seen.get(track);
      if (known) return known;
      let next = track;
      if (this._sourcesOf(track).loading.length > 0) {
        const clips = track.clips.map((clip) => (isLoadingClip(clip) ? switched(clip) : clip));
        if (clips.some((clip, i) => clip !== track.clips[i])) next = { ...track, clips };
      }
      seen.set(track, next);
      return next;
    };

    const apply = (tracks: Tracks): Tracks => {
      const next = tracks.map(mapTrack);
      return next.some((track, i) => track !== tracks[i]) ? next : tracks;
    };
    return {
      current: (tracks) => {
        inCurrentTracks = true;
        try {
          return apply(tracks);
        } finally {
          inCurrentTracks = false;
        }
      },
      stored: (tracks) => apply(tracks),
    };
  }

  /** After a pass over every state: publish `value` if a status changed. */
  finishPass(): void {
    const next = this._currentValue();
    const previous = this.value.getSnapshot();
    if (!sameValue(previous, next)) this._publish(next);
  }

  private _resolve(
    clip: LoadingClip,
    buffer: AudioBuffer,
    tickAt: (startSample: number) => number | undefined
  ): ResolvedLoadingClip {
    const memo = this._resolved.get(clip);
    if (memo && memo.buffer === buffer) return memo.result;
    let result = resolveLoadingClip(clip, buffer);
    if ('clip' in result) {
      result = { clip: { ...result.clip, startTick: tickAt(result.clip.startSample) } };
    }
    this._resolved.set(clip, { buffer, result });
    return result;
  }

  private _sourcesOf(track: ArrangementTrack): TrackSources {
    const known = this._trackSources.get(track);
    if (known) return known;
    const loading: LoadingClip[] = [];
    const carried: Array<readonly [ClipSource, AudioBuffer]> = [];
    for (const clip of track.clips) {
      if (isLoadingClip(clip)) loading.push(clip);
      else if (clip.src !== undefined && clip.audioBuffer)
        carried.push([clip.src, clip.audioBuffer]);
    }
    const named: TrackSources = { loading, carried };
    this._trackSources.set(track, named);
    return named;
  }

  private _failure(src: ClipSource, message: string): Error {
    // The Error the value already shows for it, so an unchanged failure is the same state.
    const shown = this.value.getSnapshot().sources.get(src)?.error;
    return shown && shown.message === message ? shown : new Error(message);
  }

  private _currentValue(): ArrangementSourcesValue {
    const sources = new Map<ClipSource, ArrangementSourceState>();
    const loaderStates = this._loader.getSnapshot();
    for (const src of this._wanted) {
      const state: SourceState<AudioBuffer> = loaderStates.get(src) ?? { status: 'pending' };
      const reason = this._unusable.get(src);
      if (state.status === 'failed') {
        sources.set(src, { status: 'failed', error: state.error });
      } else if (state.status === 'loaded' && reason !== undefined) {
        sources.set(src, { status: 'failed', error: this._failure(src, reason) });
      } else {
        sources.set(src, { status: state.status });
      }
    }
    let pendingCount = 0;
    let failedCount = 0;
    for (const state of sources.values()) {
      if (state.status === 'pending') pendingCount++;
      else if (state.status === 'failed') failedCount++;
    }
    return { sources, pendingCount, failedCount, isLoading: pendingCount > 0 };
  }
}

function sameValue(a: ArrangementSourcesValue, b: ArrangementSourcesValue): boolean {
  if (a.sources.size !== b.sources.size) return false;
  for (const [src, state] of b.sources) {
    const before = a.sources.get(src);
    if (!before || before.status !== state.status || before.error !== state.error) return false;
  }
  return true;
}
