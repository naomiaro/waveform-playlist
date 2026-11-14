/**
 * The engine is disposed when the provider goes away, whichever path its
 * loading effect took last: after a track was added or filled in place that
 * effect has no cleanup of its own (#811).
 *
 * React runs this cleanup for a StrictMode remount and Fast Refresh too,
 * where the setup follows at once and the engine must live on: the dispose is
 * deferred by a microtask and the setup cancels it. A hidden `<Activity>` gets
 * no setup, so its engine is disposed and the loading effect builds a new one
 * on reveal. When the loading effect's own cleanup has already disposed the
 * engine, `engineRef` is empty and nothing is done twice.
 */

import { useEffect, useRef, type MutableRefObject } from 'react';
import type { PlaylistEngine, PlayoutAdapter } from '@waveform-playlist/engine';

export function useDisposeEngineOnUnmount(
  engineRef: MutableRefObject<PlaylistEngine | null>,
  adapterRef: MutableRefObject<PlayoutAdapter | null>,
  stopAnimationFrameLoop: () => void
): void {
  const releaseRequestedRef = useRef(false);
  useEffect(() => {
    releaseRequestedRef.current = false;
    return () => {
      releaseRequestedRef.current = true;
      queueMicrotask(() => {
        const engine = engineRef.current;
        if (!releaseRequestedRef.current || !engine) return;
        stopAnimationFrameLoop();
        engine.dispose();
        engineRef.current = null;
        adapterRef.current = null;
      });
    };
  }, [engineRef, adapterRef, stopAnimationFrameLoop]);
}
