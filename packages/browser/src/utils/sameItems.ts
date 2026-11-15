/**
 * True when `a` holds the same items as `b`, in the same order, compared by
 * identity. The derivations that keep identities (`derivePeaks`,
 * `loadedTracks`, the view of an arrangement) hand back the previous array
 * when it does.
 */
export function sameItems<T>(a: readonly T[] | undefined, b: readonly T[]): a is T[] {
  return a !== undefined && a.length === b.length && a.every((item, i) => item === b[i]);
}
