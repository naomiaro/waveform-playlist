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
import { isDevelopmentBuild } from '../utils/isDevelopmentBuild';

const arrangementKeys = new WeakMap<Arrangement, number>();
let lastArrangementKey = 0;

const MISSING_ARRANGEMENT_ERROR =
  '[waveform-playlist] WaveformPlaylistProvider needs an `arrangement` prop: an ' +
  'arrangement made with `useCreateArrangement`, which owns the tracks. The `tracks` and ' +
  '`onTracksChange` props were removed. See ' +
  'https://naomiaro.github.io/waveform-playlist/docs/react/upgrading';

/**
 * The arrangement's own number: the same for the same object, new for another
 * one. Anything that is not an object (plain JavaScript, or code that still
 * passes only `tracks`) throws: the provider cannot run without one.
 */
export function keyOf(arrangement: Arrangement): number {
  if (typeof arrangement !== 'object' || arrangement === null) {
    throw new Error(MISSING_ARRANGEMENT_ERROR);
  }
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
    if (isDevelopmentBuild()) console.warn(NEW_ARRANGEMENT_WARNING);
  }, [key]);
  return key;
}
