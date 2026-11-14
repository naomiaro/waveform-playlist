/**
 * The engine is disposed when the provider goes away, whichever path its
 * loading effect took last: after a track was added or filled in place that
 * effect has no cleanup of its own (#811).
 *
 * React runs this cleanup for a real unmount, a StrictMode remount, a hidden
 * `<Activity>` and Fast Refresh alike, and the engine is disposed in each: it
 * does not live on. The dispose is deferred to a microtask so that the loading
 * effect's own cleanup, which runs after this one, disposes first when it
 * applies; this one then finds `engineRef` empty and does nothing twice.
 * Where the setup follows at once (a StrictMode remount) it cancels the
 * deferred dispose. After a Fast Refresh the loading effect finds no change
 * it can apply incrementally and builds a new engine; a hidden `<Activity>`
 * gets a new one on reveal.
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
