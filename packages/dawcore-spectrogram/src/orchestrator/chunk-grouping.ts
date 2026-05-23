export interface ChunkLike {
  chunkIndex: number;
}

/**
 * Group a list of chunks into runs of contiguous chunk indices.
 *
 * Sorts input first (input may be non-monotonic from viewport classification).
 * Returns groups in ascending chunk-index order.
 *
 * Without this, computing FFT for chunks [10, 14, 15, 11] would compute a
 * single FFT spanning chunks 10–15 (~96K frames / 4.5s of audio) instead of
 * two smaller FFTs (10–11, 14–15) totaling ~32K frames.
 */
export function groupContiguousChunks<T extends ChunkLike>(chunks: T[]): T[][] {
  if (chunks.length === 0) return [];

  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const groups: T[][] = [];
  let current: T[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].chunkIndex;
    const curr = sorted[i].chunkIndex;
    if (curr === prev + 1) {
      current.push(sorted[i]);
    } else {
      groups.push(current);
      current = [sorted[i]];
    }
  }
  groups.push(current);
  return groups;
}
