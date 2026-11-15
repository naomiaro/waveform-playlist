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
 */
import { useEffect, useRef, useState } from 'react';
import type { Arrangement } from '@waveform-playlist/engine';
import { useArrangementSources } from '../hooks/useArrangementSources';

const READY_EVENT = 'waveform-playlist:ready';

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

export function useReadyOnce(options: UseReadyOnceOptions): boolean {
  const { isEngineAttached, arrangement, onReadyRef, onErrorRef, trackCount, duration } = options;
  const { pendingCount } = useArrangementSources(arrangement);
  // State, for the render; the ref, so that StrictMode's second run of the
  // effect and an <Activity> reveal do not fire again.
  const [hasBeenReady, setHasBeenReady] = useState(false);
  const firedRef = useRef(false);
  const isReady = isEngineAttached && (hasBeenReady || pendingCount === 0);

  useEffect(() => {
    if (!isReady || firedRef.current) return;
    firedRef.current = true;
    setHasBeenReady(true);
    const detail: ReadyEventDetail = { trackCount, duration };
    window.dispatchEvent(new CustomEvent<ReadyEventDetail>(READY_EVENT, { detail }));
    callOnReady({ onReadyRef, onErrorRef });
  }, [isReady, trackCount, duration, onReadyRef, onErrorRef]);

  return isReady;
}
