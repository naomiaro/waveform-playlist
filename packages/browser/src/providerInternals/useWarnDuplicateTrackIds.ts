/**
 * Track ids must be unique: the mixer state, the incremental paths and the
 * `trackEffects` lookup are keyed by id. Two tracks with one id are warned
 * about once per set of duplicate ids, in development, from an effect.
 */

import { useEffect } from 'react';
import { warnOnce } from '../components/partWarnings';
import { duplicateTrackIds } from '../utils/duplicateTrackIds';

export function useWarnDuplicateTrackIds(tracks: readonly { id: string }[]): void {
  useEffect(() => {
    if (process.env.NODE_ENV === 'production') return;
    const duplicates = duplicateTrackIds(tracks);
    if (duplicates.length === 0) return;
    warnOnce(
      'Track ids must be unique, but these are used more than once: ' + duplicates.join(', ')
    );
  }, [tracks]);
}
