/**
 * arrangementIdentity
 *
 * Which arrangement object `WaveformPlaylistProvider` was given (#812). The
 * provider keys its body with the arrangement's number, so a new object is a
 * new mount of everything below it, and it says so once in development.
 *
 * Only numbers are kept: the map is weak, and the component remembers the
 * number of the first arrangement, not the object, so an arrangement the app
 * has let go of (its tracks, its decoded audio) can be collected.
 */
import { useEffect, useRef } from 'react';
import type { Arrangement } from '@waveform-playlist/engine';

const arrangementKeys = new WeakMap<Arrangement, number>();
let lastArrangementKey = 0;

/** The arrangement's own number: the same for the same object, new for another one. */
export function keyOf(arrangement: Arrangement): number {
  let key = arrangementKeys.get(arrangement);
  if (key === undefined) {
    lastArrangementKey += 1;
    key = lastArrangementKey;
    arrangementKeys.set(arrangement, key);
  }
  return key;
}

const NEW_ARRANGEMENT_WARNING =
  '[waveform-playlist] WaveformPlaylistProvider was given a new `arrangement` prop: ' +
  'everything below it mounts again (a new engine, the view and its state). Keep one ' +
  'arrangement for the life of the playlist (`useCreateArrangement`) and change it ' +
  'through its methods.';

/**
 * The key of the provider's body for `arrangement`. The first time it differs
 * from the key of the mount's first arrangement, says so in development.
 */
export function useArrangementKey(arrangement: Arrangement): number {
  const key = keyOf(arrangement);
  const firstKeyRef = useRef(key);
  const warnedRef = useRef(false);
  useEffect(() => {
    if (key === firstKeyRef.current || warnedRef.current) return;
    warnedRef.current = true;
    if (process.env.NODE_ENV !== 'production') console.warn(NEW_ARRANGEMENT_WARNING);
  }, [key]);
  return key;
}
