/**
 * resolveTracks
 *
 * Turns the app's `tracks` (which may hold `LoadingClip`s) into the two lists
 * of `ClipTrack` the provider uses, reusing everything from the previous pass
 * that still applies (the `derivePeaks` pattern):
 *  - `viewTracks`: what is drawn. A loaded clip is resolved; a pending or
 *    failed clip with a `duration` or `waveformData` is a placeholder.
 *  - `engineTracks`: what the audio engine gets. No placeholders.
 *
 * Identities kept: a resolved clip per loading-clip object and buffer (a
 * placeholder per loading-clip object and sample rate); a resolved track per
 * input track object and the clips it resolves to; both result arrays when
 * every element equals the previous pass.
 *
 * The ENGINE track of a track id also keeps its object across passes while
 * nothing the engine sees changed: its clips are the same objects and every
 * other field is equal (`Object.is`). That holds for a new input track object
 * too. The provider compares engine tracks by identity, and a new object for
 * an unchanged track is a full rebuild of the engine: a placeholder made
 * again at another sample rate, a pending loading clip added to a track that
 * has clips, a parent that re-creates its track objects on every render.
 *
 * The caches are WeakMaps shared by the caches of successive passes. Filling
 * one is the only mutation this file does. It is safe because a WeakMap is
 * keyed by object identity and an entry is checked against its inputs (buffer,
 * sample rate) before it is used, so a second call with the same arguments
 * (React StrictMode double-invokes `useMemo`) finds the first call's entries
 * instead of recomputing them, and never sees a different answer. A warning is
 * written when an entry is computed, never when one is read.
 */

import { createClip, isLoadingClip, trackKind } from '@waveform-playlist/core';
import type {
  AudioClip,
  ClipSource,
  ClipTrack,
  LoadingClip,
  PlaylistTrack,
  SourceState,
  WaveformDataObject,
} from '@waveform-playlist/core';

interface ClipEntry {
  /** The buffer this entry was made from; undefined for a placeholder. */
  buffer: AudioBuffer | undefined;
  /** The sample rate a placeholder was made at; undefined for a loaded clip. */
  rate: number | undefined;
  /** The result, or null when the clip is left out. */
  clip: AudioClip | null;
  placeholder: boolean;
}

interface TrackEntry {
  viewClips: AudioClip[];
  engineClips: AudioClip[];
  view: ClipTrack;
  engine: ClipTrack;
}

interface LastPass {
  viewTracks: ClipTrack[];
  engineTracks: ClipTrack[];
  placeholderIds: ReadonlySet<string>;
  rejected: readonly RejectedClip[];
}

export interface RejectedClip {
  trackId: string;
  clipId: string;
}

/** Opaque; pass the one a call returned to the next call. */
export interface ResolveCache {
  readonly clips: WeakMap<LoadingClip, ClipEntry> | null;
  readonly tracks: WeakMap<PlaylistTrack, TrackEntry> | null;
  readonly seeds: WeakMap<PlaylistTrack, ClipTrack> | null;
  readonly last: LastPass | null;
}

export interface ResolvedTracks {
  viewTracks: ClipTrack[];
  engineTracks: ClipTrack[];
  cache: ResolveCache;
  /** Ids of the placeholder clips in `viewTracks`. */
  placeholderIds: ReadonlySet<string>;
  /** Loading clips found on a MIDI track; they are left out of both lists. */
  rejected: readonly RejectedClip[];
}

export const EMPTY_RESOLVE_CACHE: ResolveCache = {
  clips: null,
  tracks: null,
  seeds: null,
  last: null,
};

const NO_IDS: ReadonlySet<string> = new Set();
const NO_REJECTED: readonly RejectedClip[] = [];

interface Maps {
  clips: WeakMap<LoadingClip, ClipEntry>;
  tracks: WeakMap<PlaylistTrack, TrackEntry>;
  seeds: WeakMap<PlaylistTrack, ClipTrack>;
}

function mapsOf(cache: ResolveCache): Maps {
  return {
    clips: cache.clips ?? new WeakMap(),
    tracks: cache.tracks ?? new WeakMap(),
    seeds: cache.seeds ?? new WeakMap(),
  };
}

/** Messages already written, per loading-clip object, for the life of the page. */
const warned = new WeakMap<LoadingClip, Set<string>>();

function warn(lc: LoadingClip, message: string): void {
  const seen = warned.get(lc) ?? new Set<string>();
  warned.set(lc, seen);
  if (seen.has(message)) return;
  seen.add(message);
  console.warn(`[waveform-playlist] clip "${lc.id}": ${message}`);
}

const isNonNegative = (n: number): boolean => Number.isFinite(n) && n >= 0;

/** Checks the loading clip's own numbers; warns and returns false when bad. */
function validFields(lc: LoadingClip): boolean {
  if (!isNonNegative(lc.start ?? 0)) {
    warn(
      lc,
      `start must be a finite number of seconds >= 0, got ${String(lc.start)}; clip left out`
    );
    return false;
  }
  if (!isNonNegative(lc.offset ?? 0)) {
    warn(
      lc,
      `offset must be a finite number of seconds >= 0, got ${String(lc.offset)}; clip left out`
    );
    return false;
  }
  if (lc.duration !== undefined && !(Number.isFinite(lc.duration) && lc.duration > 0)) {
    warn(
      lc,
      `duration must be a positive, finite number of seconds, got ${String(lc.duration)}; clip left out`
    );
    return false;
  }
  return true;
}

function display(lc: LoadingClip, waveformData: WaveformDataObject | undefined) {
  return {
    gain: lc.gain,
    name: lc.name,
    color: lc.color,
    fadeIn: lc.fadeIn,
    fadeOut: lc.fadeOut,
    waveformData,
    src: lc.src,
  };
}

/** The clip's duration in samples against a source of `total` samples; null leaves the clip out. */
function fitDuration(lc: LoadingClip, offsetSamples: number, total: number, rate: number) {
  if (!(offsetSamples < total)) {
    warn(lc, 'offset is at or past the end of the audio; clip left out');
    return null;
  }
  const rest = total - offsetSamples;
  const wanted = lc.duration === undefined ? rest : Math.round(lc.duration * rate);
  if (!(wanted >= 1)) {
    warn(lc, 'duration is shorter than one sample; clip left out');
    return null;
  }
  if (wanted > rest + 1) warn(lc, 'duration runs past the end of the audio and was cut to it');
  return Math.min(wanted, rest);
}

const samplesOk = (...n: number[]): boolean => n.every((x) => Number.isSafeInteger(x));

function loadedClip(lc: LoadingClip, buffer: AudioBuffer): AudioClip | null {
  const r = buffer.sampleRate;
  if (!(Number.isFinite(r) && r > 0 && buffer.length >= 1)) {
    warn(lc, 'the decoded buffer is empty or has no usable sample rate; clip left out');
    return null;
  }
  if (!validFields(lc)) return null;
  const offsetSamples = Math.round((lc.offset ?? 0) * r);
  const startSample = Math.round((lc.start ?? 0) * r);
  if (!samplesOk(offsetSamples, startSample)) {
    warn(lc, 'start or offset is too large; clip left out');
    return null;
  }
  const durationSamples = fitDuration(lc, offsetSamples, buffer.length, r);
  if (durationSamples === null) return null;
  return {
    ...createClip({
      audioBuffer: buffer,
      startSample,
      offsetSamples,
      durationSamples,
      ...display(lc, lc.waveformData),
    }),
    id: lc.id,
  };
}

function usableWaveformData(lc: LoadingClip): WaveformDataObject | undefined {
  const w = lc.waveformData;
  if (!w) return undefined;
  const sr = w.sample_rate;
  const d = w.duration;
  if (Number.isFinite(sr) && sr > 0 && Number.isFinite(d) && d >= 0) return w;
  warn(lc, 'waveformData has no usable sample_rate or duration; it is ignored');
  return undefined;
}

function placeholderClip(lc: LoadingClip, contextRate: number): AudioClip | null {
  const wdata = usableWaveformData(lc);
  if (lc.duration === undefined && !wdata) return null;
  if (!validFields(lc)) return null;
  const r = wdata ? wdata.sample_rate : contextRate;
  const offsetSamples = Math.round((lc.offset ?? 0) * r);
  const startSample = Math.round((lc.start ?? 0) * r);
  const sourceDurationSamples = wdata ? Math.ceil(wdata.duration * r) : undefined;
  let durationSamples: number | null;
  if (sourceDurationSamples !== undefined) {
    durationSamples = fitDuration(lc, offsetSamples, sourceDurationSamples, r);
  } else {
    durationSamples = Math.round((lc.duration ?? 0) * r);
  }
  if (durationSamples === null) return null;
  const sourceLength = sourceDurationSamples ?? offsetSamples + durationSamples;
  if (
    !(durationSamples >= 1) ||
    !samplesOk(startSample, offsetSamples, durationSamples, sourceLength)
  ) {
    warn(lc, 'a time is too large or too small for whole samples; clip left out');
    return null;
  }
  return {
    ...createClip({
      startSample,
      offsetSamples,
      durationSamples,
      sampleRate: r,
      sourceDurationSamples: sourceLength,
      ...display(lc, wdata),
    }),
    id: lc.id,
  };
}

function clipEntry(
  lc: LoadingClip,
  state: SourceState<AudioBuffer> | undefined,
  rate: number,
  clips: WeakMap<LoadingClip, ClipEntry>
): ClipEntry {
  const buffer = state?.status === 'loaded' ? state.value : undefined;
  const hit = clips.get(lc);
  if (hit && hit.buffer === buffer && (buffer !== undefined || hit.rate === rate)) return hit;
  const entry: ClipEntry = buffer
    ? { buffer, rate: undefined, clip: loadedClip(lc, buffer), placeholder: false }
    : { buffer: undefined, rate, clip: placeholderClip(lc, rate), placeholder: true };
  clips.set(lc, entry);
  return entry;
}

function sameElements<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((x, i) => x === b[i]);
}

interface TrackResult {
  view: ClipTrack;
  engine: ClipTrack;
  placeholders: string[];
  rejected: RejectedClip[];
}

/** True when the two tracks have the same own enumerable fields, `clips` aside. */
function sameFieldsApartFromClips(a: ClipTrack, b: ClipTrack): boolean {
  const aKeys = Object.keys(a).filter((key) => key !== 'clips');
  const bKeys = Object.keys(b).filter((key) => key !== 'clips');
  if (aKeys.length !== bKeys.length) return false;
  const left = a as unknown as Record<string, unknown>;
  const right = b as unknown as Record<string, unknown>;
  return aKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && Object.is(left[key], right[key])
  );
}

/** The previous pass's engine track for this id, when the engine would see no difference. */
function unchangedEngineTrack(
  previous: ClipTrack | undefined,
  built: ClipTrack,
  engineClips: AudioClip[]
): ClipTrack | undefined {
  if (!previous || previous === built) return previous;
  if (!sameElements(previous.clips, engineClips)) return undefined;
  return sameFieldsApartFromClips(previous, built) ? previous : undefined;
}

function resolveTrack(
  input: PlaylistTrack,
  sources: ReadonlyMap<ClipSource, SourceState<AudioBuffer>>,
  rate: number,
  maps: Maps,
  previousEngineById: ReadonlyMap<string, ClipTrack>
): TrackResult {
  const hasLoading = input.clips.some(isLoadingClip);
  const midi = trackKind(input) === 'midi';
  const viewClips: AudioClip[] = [];
  const engineClips: AudioClip[] = [];
  const placeholders: string[] = [];
  const rejected: RejectedClip[] = [];
  for (const clip of input.clips) {
    if (!isLoadingClip(clip)) {
      viewClips.push(clip);
      engineClips.push(clip);
    } else if (midi) {
      rejected.push({ trackId: input.id, clipId: clip.id });
    } else {
      const entry = clipEntry(clip, sources.get(clip.src), rate, maps.clips);
      if (!entry.clip) continue;
      viewClips.push(entry.clip);
      if (entry.placeholder) placeholders.push(clip.id);
      else engineClips.push(entry.clip);
    }
  }
  const built = hasLoading
    ? buildTrack(input, viewClips, engineClips, maps.tracks)
    : { view: input as ClipTrack, engine: input as ClipTrack };
  // A seed counts only while it still describes the built result.
  const seed = maps.seeds.get(input);
  const seedFits = seed !== undefined && sameElements(seed.clips, engineClips);
  if (seedFits) {
    return {
      view: placeholders.length === 0 ? seed : built.view,
      engine: seed,
      placeholders,
      rejected,
    };
  }
  const engine =
    unchangedEngineTrack(previousEngineById.get(input.id), built.engine, engineClips) ??
    built.engine;
  // Without a placeholder the view track IS the engine track.
  const view = built.view === built.engine ? engine : built.view;
  return { view, engine, placeholders, rejected };
}

function buildTrack(
  input: PlaylistTrack,
  viewClips: AudioClip[],
  engineClips: AudioClip[],
  tracks: WeakMap<PlaylistTrack, TrackEntry>
): TrackEntry {
  const hit = tracks.get(input);
  if (hit && sameElements(hit.viewClips, viewClips) && sameElements(hit.engineClips, engineClips)) {
    return hit;
  }
  const noPlaceholder = sameElements(viewClips, engineClips);
  const engine: ClipTrack = { ...input, clips: engineClips };
  const entry: TrackEntry = {
    viewClips: noPlaceholder ? engineClips : viewClips,
    engineClips,
    engine,
    view: noPlaceholder ? engine : { ...input, clips: viewClips },
  };
  tracks.set(input, entry);
  return entry;
}

/** Keeps `previous` when `next` has the same members, so equality is identity. */
function reuseSet(previous: ReadonlySet<string> | undefined, next: string[]): ReadonlySet<string> {
  if (next.length === 0) return NO_IDS;
  if (previous && previous.size === next.length && next.every((id) => previous.has(id))) {
    return previous;
  }
  return new Set(next);
}

function reuseRejected(
  previous: readonly RejectedClip[] | undefined,
  next: RejectedClip[]
): readonly RejectedClip[] {
  if (next.length === 0) return NO_REJECTED;
  const same = (a: RejectedClip, b: RejectedClip) =>
    a.trackId === b.trackId && a.clipId === b.clipId;
  if (previous && previous.length === next.length && next.every((r, i) => same(r, previous[i]))) {
    return previous;
  }
  return next;
}

export function resolveTracks(
  tracks: PlaylistTrack[],
  sources: ReadonlyMap<ClipSource, SourceState<AudioBuffer>>,
  sampleRate: number,
  previous: ResolveCache
): ResolvedTracks {
  const maps = mapsOf(previous);
  const last = previous.last;
  const previousEngineById = new Map((last?.engineTracks ?? []).map((t) => [t.id, t]));
  const results = tracks.map((t) => resolveTrack(t, sources, sampleRate, maps, previousEngineById));
  const view = results.map((r) => r.view);
  const engine = results.map((r) => r.engine);
  const viewTracks = last && sameElements(last.viewTracks, view) ? last.viewTracks : view;
  const engineTracks = last && sameElements(last.engineTracks, engine) ? last.engineTracks : engine;
  const placeholderIds = reuseSet(
    last?.placeholderIds,
    results.flatMap((r) => r.placeholders)
  );
  const rejected = reuseRejected(
    last?.rejected,
    results.flatMap((r) => r.rejected)
  );
  const cache: ResolveCache = {
    ...maps,
    last: { viewTracks, engineTracks, placeholderIds, rejected },
  };
  return { viewTracks, engineTracks, cache, placeholderIds, rejected };
}

/**
 * Tell the cache that `input` resolves to `engineTrack`: the next call returns
 * it in `engineTracks`, and in `viewTracks` too when the input has no
 * placeholder, but only while the seed's clips are the same objects as the
 * clips the input resolves to for the engine; a seed that no longer matches
 * (a loading clip has loaded since) is ignored. Returns a new cache object.
 * The seed is stored in a WeakMap shared with the given cache, so it is
 * visible through any cache that shares the maps; that is safe because a seed
 * is only used while it matches the built result.
 */
export function seedResolved(
  cache: ResolveCache,
  input: PlaylistTrack,
  engineTrack: ClipTrack
): ResolveCache {
  const maps = mapsOf(cache);
  maps.seeds.set(input, engineTrack);
  return { ...maps, last: cache.last };
}
