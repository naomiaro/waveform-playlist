import type { AudioClip } from '@waveform-playlist/core';

const cache = new WeakMap<readonly AudioClip[], AudioClip[]>();

/**
 * A track's clips in timeline order.
 *
 * The result is cached per clips array, so calling this on every pointer move
 * of a drag sorts once: tracks are updated immutably, and a clips array that
 * has not been replaced has not changed order. Do not mutate the result.
 */
export function sortedClipsOf(clips: readonly AudioClip[]): AudioClip[] {
  let sorted = cache.get(clips);
  if (!sorted) {
    sorted = [...clips].sort((a, b) => a.startSample - b.startSample);
    cache.set(clips, sorted);
  }
  return sorted;
}
