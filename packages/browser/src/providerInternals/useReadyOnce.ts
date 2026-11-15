/**
 * useReadyOnce
 *
 * "Ready" for `WaveformPlaylistProvider` on an arrangement (#812, QE). The
 * provider is the one owner of `isReady` and of "ready has fired".
 *
 * - `isReady` is false until an engine is attached and no source of the
 *   arrangement is pending, for the first time; from then on it is "an
 *   engine is attached" (false while a later engine is being built, true
 *   again when it is assigned, whatever is still loading then).
 * - `onReady` and the `waveform-playlist:ready` event fire ONCE per mount, at
 *   that first time: not again after a rebuild, a StrictMode remount or an
 *   `<Activity>` hide and reveal. The event's `trackCount` counts every track
 *   of the arrangement, its `duration` the loaded audio (A5).
 * - A failed source counts as settled, and is not reported through `onError`
 *   (QB). An `onReady` that throws is the app's own error: it is written to
 *   the console and given to `onError`.
 * - Play does nothing before that first time (maintainer, 2026-11-15):
 *   `refusePlayBeforeFirstReady()` says so to `play()` at call time, and
 *   writes one console warning per mount. It queues nothing, so Play pressed
 *   during the first load never starts by itself.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { Arrangement } from '@waveform-playlist/engine';
import { useArrangementSources } from '../hooks/useArrangementSources';

const READY_EVENT = 'waveform-playlist:ready';

const PLAY_BEFORE_READY_WARNING =
  '[waveform-playlist] play() was called before the playlist was ready and did nothing: ' +
  'playback starts once the playlist is ready. Wait for `isReady` ' +
  '(usePlaylistTimeline) or the `onReady` callback before calling play().';

interface ReadyEventDetail {
  trackCount: number;
  duration: number;
}

export interface UseReadyOnceOptions {
  /** From `useEngineLifetime`: false from the start of each build until its engine is assigned. */
  isEngineAttached: boolean;
  arrangement: Arrangement;
  /** The latest committed `onReady` (QG). */
  onReadyRef: React.RefObject<(() => void) | undefined>;
  /** The latest committed `onError` (QG). */
  onErrorRef: React.RefObject<((error: Error) => void) | undefined>;
  /** The number of tracks in the arrangement, loaded or not. */
  trackCount: number;
  /** The end, in seconds, of the loaded audio. */
  duration: number;
}

function callOnReady({
  onReadyRef,
  onErrorRef,
}: Pick<UseReadyOnceOptions, 'onReadyRef' | 'onErrorRef'>): void {
  try {
    onReadyRef.current?.();
  } catch (callbackError) {
    const thrown =
      callbackError instanceof Error ? callbackError : new Error(String(callbackError));
    console.error('[waveform-playlist] The onReady callback threw: ' + thrown.message);
    onErrorRef.current?.(thrown);
  }
}

export interface ReadyOnce {
  isReady: boolean;
  /**
   * True when the first ready of this mount has not happened yet, so a play
   * must do nothing; warns the first time per mount. Never changes identity.
   */
  refusePlayBeforeFirstReady: () => boolean;
}

export function useReadyOnce(options: UseReadyOnceOptions): ReadyOnce {
  const { isEngineAttached, arrangement, onReadyRef, onErrorRef, trackCount, duration } = options;
  const { pendingCount } = useArrangementSources(arrangement);
  // State, for the render; the ref, so that StrictMode's second run of the
  // effect and an <Activity> reveal do not fire again.
  const [hasBeenReady, setHasBeenReady] = useState(false);
  const firedRef = useRef(false);
  const isReady = isEngineAttached && (hasBeenReady || pendingCount === 0);
  // "The first ready has happened", for play() at call time. Written where
  // React commits, so a discarded render cannot leave it true; in a layout
  // effect, so that it is true before any passive effect of the same commit
  // (onReady included) can call play(). Never goes back to false.
  const firstReadyRef = useRef(false);
  const warnedPlayRef = useRef(false);
  useLayoutEffect(() => {
    if (isReady) firstReadyRef.current = true;
  }, [isReady]);

  const refusePlayBeforeFirstReady = useCallback(() => {
    if (firstReadyRef.current) return false;
    if (!warnedPlayRef.current) {
      warnedPlayRef.current = true;
      console.warn(PLAY_BEFORE_READY_WARNING);
    }
    return true;
  }, []);

  useEffect(() => {
    if (!isReady || firedRef.current) return;
    firedRef.current = true;
    setHasBeenReady(true);
    const detail: ReadyEventDetail = { trackCount, duration };
    window.dispatchEvent(new CustomEvent<ReadyEventDetail>(READY_EVENT, { detail }));
    callOnReady({ onReadyRef, onErrorRef });
  }, [isReady, trackCount, duration, onReadyRef, onErrorRef]);

  return { isReady, refusePlayBeforeFirstReady };
}
