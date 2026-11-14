/**
 * useEarlyAdapter
 *
 * Audio is decoded with the playout adapter's `AudioContext`, and a provider
 * that is mounted with sources to load needs that context before its first
 * engine build (#812). The adapter is therefore created ahead of the build,
 * kept here, and the build TAKES it: no adapter is ever made just for its
 * context.
 *
 * `getDecodeContext()` resolves as soon as there is a live adapter: the early
 * one, or the adapter of the engine that is running. A load that asks while
 * none exists (an engine rebuild in flight) waits for the next one.
 *
 * An early adapter nobody took is disposed when the provider goes away. React
 * runs the same cleanup for an unmount, a StrictMode remount and a hidden
 * `<Activity>`; the release is therefore deferred by a microtask, and a setup
 * that follows at once (StrictMode) keeps the adapter.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

interface Early {
  promise: Promise<PlayoutAdapter>;
  /** Set when the promise has resolved. */
  adapter: PlayoutAdapter | null;
  /** `waiting`: ours. `taken`: an engine build owns it. `released`: dispose on arrival. */
  state: 'waiting' | 'taken' | 'released';
}

export interface EarlyAdapter {
  /** The context to decode with, once a live adapter exists. Stable. */
  getDecodeContext: () => Promise<BaseAudioContext>;
  /** Create the adapter ahead of the build. A no-op while one is waiting. */
  ensure: (create: () => Promise<PlayoutAdapter>, onFailure: (error: unknown) => void) => void;
  /** Hand the waiting adapter to an engine build, which owns it from then on. */
  take: () => Promise<PlayoutAdapter> | null;
  /** A build assigned its engine: loads waiting for a context can go on. */
  announce: (adapter: PlayoutAdapter) => void;
}

function disposeQuietly(adapter: PlayoutAdapter): void {
  try {
    adapter.dispose();
  } catch (err) {
    console.warn('[waveform-playlist] disposing an unused adapter threw: ' + String(err));
  }
}

/** `currentAdapter` returns the running engine's adapter, or null. Read through a ref. */
export function useEarlyAdapter(currentAdapter: () => PlayoutAdapter | null): EarlyAdapter {
  const currentAdapterRef = useRef(currentAdapter);
  currentAdapterRef.current = currentAdapter;
  const earlyRef = useRef<Early | null>(null);
  const waitersRef = useRef<Array<(context: BaseAudioContext) => void>>([]);
  const releaseRequestedRef = useRef(false);

  const announce = useCallback((adapter: PlayoutAdapter) => {
    const waiters = waitersRef.current;
    waitersRef.current = [];
    for (const resolve of waiters) resolve(adapter.audioContext);
  }, []);

  const getDecodeContext = useCallback(() => {
    const adapter = earlyRef.current?.adapter ?? currentAdapterRef.current();
    if (adapter) return Promise.resolve<BaseAudioContext>(adapter.audioContext);
    return new Promise<BaseAudioContext>((resolve) => {
      waitersRef.current.push(resolve);
    });
  }, []);

  const ensure = useCallback(
    (create: () => Promise<PlayoutAdapter>, onFailure: (error: unknown) => void) => {
      if (earlyRef.current) return;
      const early: Early = { promise: create(), adapter: null, state: 'waiting' };
      earlyRef.current = early;
      early.promise.then(
        (adapter) => {
          if (early.state === 'released') {
            disposeQuietly(adapter);
            return;
          }
          early.adapter = adapter;
          announce(adapter);
        },
        (error: unknown) => {
          // A build that took the promise reports the failure itself.
          if (early.state !== 'waiting') return;
          if (earlyRef.current === early) earlyRef.current = null;
          onFailure(error);
        }
      );
    },
    [announce]
  );

  const take = useCallback(() => {
    const early = earlyRef.current;
    if (!early) return null;
    early.state = 'taken';
    earlyRef.current = null;
    return early.promise;
  }, []);

  useEffect(() => {
    releaseRequestedRef.current = false;
    return () => {
      releaseRequestedRef.current = true;
      queueMicrotask(() => {
        const early = earlyRef.current;
        if (!releaseRequestedRef.current || !early) return;
        early.state = 'released';
        earlyRef.current = null;
        if (early.adapter) disposeQuietly(early.adapter);
      });
    };
  }, []);

  return useMemo(
    () => ({ getDecodeContext, ensure, take, announce }),
    [getDecodeContext, ensure, take, announce]
  );
}
