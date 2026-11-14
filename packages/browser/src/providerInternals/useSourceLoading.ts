/**
 * useSourceLoading
 *
 * Owns the source loader of one `WaveformPlaylistProvider` (#812): which
 * sources the app's `tracks` name, the buffers the tracks already carry, the
 * loader's snapshot and the status value.
 *
 * The loader is created once and never cleared by a cleanup: loaded buffers
 * survive a StrictMode remount, Fast Refresh and a hidden `<Activity>`. Two
 * effects talk to it. One runs when the SET of sources changes and has no
 * cleanup, so a new `tracks` array that names the same sources aborts
 * nothing. The other is mount-only: its cleanup suspends the loads in flight
 * and its setup asks for them again.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createSourceLoader, isLoadingClip } from '@waveform-playlist/core';
import type { ClipSource, PlaylistTrack, SourceState } from '@waveform-playlist/core';
import { defaultLoadSource, type LoadSource } from '../utils/loadSource';

export type SourceSnapshot = ReadonlyMap<ClipSource, SourceState<AudioBuffer>>;

/** One source as the status value shows it: no buffer, only how far it is. */
export interface SourceStatusEntry {
  status: 'pending' | 'loaded' | 'failed';
  error?: Error;
}

export interface SourceLoadingStatus {
  sources: ReadonlyMap<ClipSource, SourceStatusEntry>;
  pendingCount: number;
  failedCount: number;
  /** `pendingCount > 0` */
  isLoading: boolean;
  /** Start a failed source again. A no-op for any other state. */
  retry: (src: ClipSource) => void;
}

export interface UseSourceLoadingOptions {
  tracks: PlaylistTrack[];
  /** Read through a ref: its identity is not a dependency of anything. */
  loadSource?: LoadSource;
  /** Resolves to the context the audio is decoded with, once there is one. */
  getDecodeContext: () => Promise<BaseAudioContext>;
  /** Called once per failed source. */
  onError?: (error: Error) => void;
}

export interface UseSourceLoadingReturn {
  /** The loader's snapshot: the same Map until a source changes state. */
  sources: SourceSnapshot;
  /** Keeps its identity while no source changes state. */
  status: SourceLoadingStatus;
  /**
   * True while a loading clip of `tracks` names a source that has neither
   * loaded nor failed. A source the loader has not been told about yet (the
   * first render) counts.
   */
  hasUnsettledSource: boolean;
}

const NO_SOURCES: ReadonlySet<ClipSource> = new Set();

/** The `src` of every loading clip and of every loaded clip that carries one. */
function namedSources(tracks: PlaylistTrack[]): Set<ClipSource> {
  const named = new Set<ClipSource>();
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (clip.src !== undefined) named.add(clip.src);
    }
  }
  return named;
}

function sameMembers(a: ReadonlySet<ClipSource>, b: ReadonlySet<ClipSource>): boolean {
  if (a.size !== b.size) return false;
  for (const member of a) {
    if (!b.has(member)) return false;
  }
  return true;
}

/** Hand the loader every buffer the tracks already carry for a source. */
function provideCarriedBuffers(
  tracks: PlaylistTrack[],
  provide: (src: ClipSource, buffer: AudioBuffer) => void
): void {
  for (const track of tracks) {
    for (const clip of track.clips) {
      if (!isLoadingClip(clip) && clip.src !== undefined && clip.audioBuffer) {
        provide(clip.src, clip.audioBuffer);
      }
    }
  }
}

function isUnsettled(tracks: PlaylistTrack[], sources: SourceSnapshot): boolean {
  return tracks.some((track) =>
    track.clips.some((clip) => {
      if (!isLoadingClip(clip)) return false;
      const state = sources.get(clip.src);
      return state === undefined || state.status === 'pending';
    })
  );
}

function abortError(): Error {
  if (typeof DOMException !== 'undefined') return new DOMException('Aborted', 'AbortError');
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

function statusEntry(state: SourceState<AudioBuffer>): SourceStatusEntry {
  return state.status === 'failed'
    ? { status: 'failed', error: state.error }
    : { status: state.status };
}

function buildStatus(
  sources: SourceSnapshot,
  entries: WeakMap<SourceState<AudioBuffer>, SourceStatusEntry>,
  retry: (src: ClipSource) => void
): SourceLoadingStatus {
  const shown = new Map<ClipSource, SourceStatusEntry>();
  let pendingCount = 0;
  let failedCount = 0;
  for (const [src, state] of sources) {
    // One entry object per state object, so an unchanged source keeps its entry.
    const entry = entries.get(state) ?? statusEntry(state);
    entries.set(state, entry);
    shown.set(src, entry);
    if (state.status === 'pending') pendingCount++;
    if (state.status === 'failed') failedCount++;
  }
  return { sources: shown, pendingCount, failedCount, isLoading: pendingCount > 0, retry };
}

export function useSourceLoading({
  tracks,
  loadSource,
  getDecodeContext,
  onError,
}: UseSourceLoadingOptions): UseSourceLoadingReturn {
  const loadSourceRef = useRef(loadSource);
  loadSourceRef.current = loadSource;
  const getDecodeContextRef = useRef(getDecodeContext);
  getDecodeContextRef.current = getDecodeContext;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;

  const [loader] = useState(() =>
    createSourceLoader<ClipSource, AudioBuffer>({
      load: async (src, signal) => {
        const audioContext = await getDecodeContextRef.current();
        // Aborted while the context was on its way: nothing is fetched.
        if (signal.aborted) throw abortError();
        const load = loadSourceRef.current ?? defaultLoadSource;
        return load(src, { signal, audioContext });
      },
    })
  );

  // The set of sources, kept as the same object while its members are equal.
  // The ref only ever stands in for a set equal to the one just computed.
  const wantedRef = useRef<ReadonlySet<ClipSource>>(NO_SOURCES);
  const wanted = useMemo(() => {
    const named = namedSources(tracks);
    if (!sameMembers(named, wantedRef.current)) wantedRef.current = named;
    return wantedRef.current;
  }, [tracks]);

  // (a) The set changed: buffers the tracks carry first, then the whole set.
  // No cleanup: a change must not abort the loads that are still wanted.
  useEffect(() => {
    provideCarriedBuffers(tracksRef.current, loader.provide);
    loader.setWanted(wanted);
  }, [loader, wanted]);

  // (b) Mount only. The cleanup also runs for a StrictMode remount, Fast
  // Refresh and a hidden <Activity>: it aborts what is in flight and forgets
  // nothing, and the setup asks again.
  useEffect(() => {
    loader.setWanted(wantedRef.current);
    return () => loader.suspend();
  }, [loader]);

  const sources = useSyncExternalStore(loader.subscribe, loader.getSnapshot, loader.getSnapshot);

  const retry = useCallback((src: ClipSource) => loader.retry(src), [loader]);
  const [entries] = useState(() => new WeakMap<SourceState<AudioBuffer>, SourceStatusEntry>());
  const status = useMemo(() => buildStatus(sources, entries, retry), [sources, entries, retry]);

  // Each failure is reported once. A retry that fails again is a new failure.
  const [reported] = useState(() => new WeakSet<Error>());
  useEffect(() => {
    for (const state of sources.values()) {
      if (state.status !== 'failed' || reported.has(state.error)) continue;
      reported.add(state.error);
      onErrorRef.current?.(state.error);
    }
  }, [sources, reported]);

  const hasUnsettledSource = useMemo(() => isUnsettled(tracks, sources), [tracks, sources]);

  return { sources, status, hasUnsettledSource };
}
