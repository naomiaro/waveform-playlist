import { describe, it, expect } from 'vitest';
import { getVisibleChunkIndices } from '../utils/viewport';

describe('getVisibleChunkIndices', () => {
  // 5000px total, 1000px chunks → indices 0-4
  const totalWidth = 5000;
  const chunkWidth = 1000;

  it('returns all chunks when viewport covers entire content', () => {
    expect(getVisibleChunkIndices(totalWidth, chunkWidth, 0, 5000)).toEqual([0, 1, 2, 3, 4]);
  });

  it('returns all chunks with -Infinity/Infinity (permissive defaults)', () => {
    expect(getVisibleChunkIndices(totalWidth, chunkWidth, -Infinity, Infinity)).toEqual([
      0, 1, 2, 3, 4,
    ]);
  });

  it('returns only chunks intersecting the viewport', () => {
    // Viewport [1500, 3500] → chunks 1 (1000-2000), 2 (2000-3000), 3 (3000-4000)
    expect(getVisibleChunkIndices(totalWidth, chunkWidth, 1500, 3500)).toEqual([1, 2, 3]);
  });

  it('includes partially visible chunks at viewport edges', () => {
    // Viewport [999, 1001] → chunk 0 (0-1000) and chunk 1 (1000-2000)
    expect(getVisibleChunkIndices(totalWidth, chunkWidth, 999, 1001)).toEqual([0, 1]);
  });

  it('excludes chunks exactly at viewport boundary (start == end)', () => {
    // Viewport [1000, 2000] → chunk 0 ends at 1000 (not > 1000), excluded
    // chunk 1 (1000-2000) starts at 1000 (not < 2000? 1000 < 2000 yes), included
    // chunk 2 starts at 2000 (not < 2000), excluded
    expect(getVisibleChunkIndices(totalWidth, chunkWidth, 1000, 2000)).toEqual([1]);
  });

  it('returns empty array when viewport is before all content', () => {
    expect(getVisibleChunkIndices(totalWidth, chunkWidth, -500, -100)).toEqual([]);
  });

  it('returns empty array when viewport is after all content', () => {
    expect(getVisibleChunkIndices(totalWidth, chunkWidth, 6000, 7000)).toEqual([]);
  });

  it('returns empty array for zero-width content', () => {
    expect(getVisibleChunkIndices(0, chunkWidth, 0, 5000)).toEqual([]);
  });

  it('handles originX offset correctly', () => {
    // Content starts at x=2000, 3000px wide → chunks at 2000-3000, 3000-4000, 4000-5000
    // Viewport [0, 3500] → chunk 0 (2000-3000) and chunk 1 (3000-4000)
    expect(getVisibleChunkIndices(3000, chunkWidth, 0, 3500, 2000)).toEqual([0, 1]);
  });

  it('excludes offset content entirely outside viewport', () => {
    // Content starts at x=5000, viewport [0, 1000]
    expect(getVisibleChunkIndices(3000, chunkWidth, 0, 1000, 5000)).toEqual([]);
  });

  it('handles non-even totalWidth (partial last chunk)', () => {
    // 2500px → 3 chunks: 0-1000, 1000-2000, 2000-3000 (last chunk partially filled)
    expect(getVisibleChunkIndices(2500, chunkWidth, -Infinity, Infinity)).toEqual([0, 1, 2]);
  });
});
