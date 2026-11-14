/**
 * useMergedTracksChange
 *
 * Everything that reaches the app's `onTracksChange` goes through one merge
 * (#812): tracks handed back must still hold the clips that are loading, and
 * must not hold a placeholder as if it were a clip.
 *
 * Two entries, both stable for the provider's life:
 *  - `fromEngine`: the engine reported its tracks (a clip operation, an added
 *    track). The merged tracks are remembered so that the provider recognises
 *    them when they come back as the `tracks` prop: `engineTracksRef` holds
 *    the engine's own array, and the resolution cache is seeded so that each
 *    merged track resolves to the engine's track object.
 *  - `fromView`: a drag handler sends copies of the view's tracks (every move
 *    of a trim, a cancel). Nothing is remembered: the engine has not changed.
 */

import { useCallback, useRef, type MutableRefObject, type RefObject } from 'react';
import type { ClipTrack, PlaylistTrack } from '@waveform-playlist/core';
import type { PlaylistEngine } from '@waveform-playlist/engine';
import { mergeLoadingClips } from '../utils/mergeLoadingClips';
import { seedResolved, type ResolveCache } from '../utils/resolveTracks';
import { keepUnappliedClipsLoading } from '../utils/unappliedClips';

export interface UseMergedTracksChangeOptions {
  /** The app's callback, as passed on the latest render. */
  onTracksChange: ((tracks: PlaylistTrack[]) => void) | undefined;
  /** The app's `tracks` prop, as passed on the latest render. */
  tracks: PlaylistTrack[];
  /** Ids of the placeholder clips in the current view. */
  placeholderIds: ReadonlySet<string>;
  resolveCacheRef: MutableRefObject<ResolveCache>;
  engineTracksRef: MutableRefObject<ClipTrack[] | null>;
  engineRef: RefObject<PlaylistEngine | null>;
}

export interface MergedTracksChange {
  fromEngine: (engineTracks: ClipTrack[]) => void;
  fromView: (viewTracks: ClipTrack[]) => void;
}

export function useMergedTracksChange({
  onTracksChange,
  tracks,
  placeholderIds,
  resolveCacheRef,
  engineTracksRef,
  engineRef,
}: UseMergedTracksChangeOptions): MergedTracksChange {
  const latestRef = useRef({ onTracksChange, tracks, placeholderIds });
  latestRef.current = { onTracksChange, tracks, placeholderIds };

  const fromEngine = useCallback(
    (engineTracks: ClipTrack[]) => {
      const latest = latestRef.current;
      engineTracksRef.current = engineTracks;
      if (!latest.onTracksChange) {
        console.warn(
          '[waveform-playlist] Engine tracks changed but onTracksChange prop is not set — ' +
            'UI will revert on next render. Pass onTracksChange to WaveformPlaylistProvider.'
        );
        return;
      }
      const merged = mergeLoadingClips(engineTracks, latest.tracks, latest.placeholderIds);
      merged.forEach((track, index) => {
        if (track === engineTracks[index]) return;
        resolveCacheRef.current = seedResolved(resolveCacheRef.current, track, engineTracks[index]);
      });
      latest.onTracksChange(merged);
    },
    [engineTracksRef, resolveCacheRef]
  );

  const fromView = useCallback(
    (viewTracks: ClipTrack[]) => {
      const latest = latestRef.current;
      if (!latest.onTracksChange) return;
      const merged = mergeLoadingClips(viewTracks, latest.tracks, latest.placeholderIds);
      const engine = engineRef.current;
      latest.onTracksChange(
        engine ? keepUnappliedClipsLoading(merged, latest.tracks, engine.getState().tracks) : merged
      );
    },
    [engineRef]
  );

  return { fromEngine, fromView };
}
