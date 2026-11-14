/**
 * useSourceLoading
 *
 * Owns the source loader of one `WaveformPlaylistProvider` (#812): which
 * sources the app's `tracks` name, the buffers the tracks already carry, the
 * loader's snapshot and the status value.
 *
 * The loader is created once and never cleared by a cleanup: loaded buffers
 * survive a StrictMode remount, Fast Refresh and a hidden `<Activity>`. Two
 * effects talk to it. One runs when `tracks` changes and has NO cleanup: it
 * hands over the buffers the tracks carry and declares the whole set of
 * sources, and the loader starts and drops only what differs, so a new
 * `tracks` array that names the same sources aborts nothing. The other is
 * mount-only and is only a cleanup: it suspends the loads in flight. Asking
 * again is the first effect's: React runs its setup too wherever it runs that
 * cleanup's counterpart (a StrictMode remount, Fast Refresh, an `<Activity>`
 * reveal), and `setWanted` restarts what was suspended.
 *
 * A MIDI track holds no audio: a loading clip on one is rejected by the
 * resolution, and its source is neither asked for nor waited for.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createSourceLoader, isLoadingClip, trackKind } from '@waveform-playlist/core';
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

const holdsAudio = (track: PlaylistTrack): boolean => trackKind(track) !== 'midi';

/** The `src` of every loading clip and of every loaded clip that carries one. */
function namedSources(tracks: PlaylistTrack[]): Set<ClipSource> {
  const named = new Set<ClipSource>();
  for (const track of tracks.filter(holdsAudio)) {
    for (const clip of track.clips) {
      if (clip.src !== undefined) named.add(clip.src);
    }
  }
  return named;
}

/** Hand the loader every buffer the tracks already carry for a source. */
function provideCarriedBuffers(
  tracks: PlaylistTrack[],
  provide: (src: ClipSource, buffer: AudioBuffer) => void
): void {
  for (const track of tracks.filter(holdsAudio)) {
    for (const clip of track.clips) {
      if (!isLoadingClip(clip) && clip.src !== undefined && clip.audioBuffer) {
        provide(clip.src, clip.audioBuffer);
      }
    }
  }
}

function isUnsettled(tracks: PlaylistTrack[], sources: SourceSnapshot): boolean {
  return tracks.filter(holdsAudio).some((track) =>
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

  // `tracks` changed: the buffers the tracks carry first (a no-op for a
  // source that is loaded; a pending or failed one becomes loaded and its
  // load is aborted), then the whole set of sources. No cleanup: a change
  // must not abort the loads that are still wanted. Both calls publish, so
  // they are made here and never during render.
  useEffect(() => {
    provideCarriedBuffers(tracks, loader.provide);
    loader.setWanted(namedSources(tracks));
  }, [loader, tracks]);

  // Only a cleanup, and it also runs for a StrictMode remount, Fast Refresh
  // and a hidden <Activity>: it aborts what is in flight and forgets nothing.
  // The effect above runs again in each of those cases and asks again.
  useEffect(() => () => loader.suspend(), [loader]);

  const sources = useSyncExternalStore(loader.subscribe, loader.getSnapshot, loader.getSnapshot);

  const retry = useCallback((src: ClipSource) => loader.retry(src), [loader]);
  const [entries] = useState(() => new WeakMap<SourceState<AudioBuffer>, SourceStatusEntry>());
  const status = useMemo(() => buildStatus(sources, entries, retry), [sources, entries, retry]);

  // Each failure is reported once, per source: the loader makes one state
  // object per failure, so a source that is retried and fails again (also
  // with the same Error object) is reported again, and two sources that fail
  // with one Error object are two reports.
  const [reported] = useState(() => new Map<ClipSource, SourceState<AudioBuffer>>());
  useEffect(() => {
    for (const src of [...reported.keys()]) {
      if (sources.get(src)?.status !== 'failed') reported.delete(src);
    }
    for (const [src, state] of sources) {
      if (state.status !== 'failed' || reported.get(src) === state) continue;
      reported.set(src, state);
      onErrorRef.current?.(state.error);
    }
  }, [sources, reported]);

  const hasUnsettledSource = useMemo(() => isUnsettled(tracks, sources), [tracks, sources]);

  return { sources, status, hasUnsettledSource };
}
