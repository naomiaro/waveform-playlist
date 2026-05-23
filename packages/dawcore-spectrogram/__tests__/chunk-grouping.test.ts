import { describe, it, expect } from 'vitest';
import { groupContiguousChunks } from '../src/orchestrator/chunk-grouping';

describe('groupContiguousChunks', () => {
  it('returns empty for empty input', () => {
    expect(groupContiguousChunks([])).toEqual([]);
  });

  it('returns a single group for a single chunk', () => {
    expect(groupContiguousChunks([{ chunkIndex: 5 }])).toEqual([[{ chunkIndex: 5 }]]);
  });

  it('groups contiguous chunks together', () => {
    const input = [{ chunkIndex: 10 }, { chunkIndex: 11 }, { chunkIndex: 12 }];
    expect(groupContiguousChunks(input)).toEqual([input]);
  });

  it('splits non-contiguous chunks into separate groups', () => {
    const a = { chunkIndex: 10 };
    const b = { chunkIndex: 14 };
    const c = { chunkIndex: 15 };
    const d = { chunkIndex: 20 };
    expect(groupContiguousChunks([a, b, c, d])).toEqual([[a], [b, c], [d]]);
  });

  it('handles unsorted input by sorting before grouping (regression: indices=[0,3,4,5] yields chunks=[10,14,15,11])', () => {
    const chunks = [
      { chunkIndex: 10 },
      { chunkIndex: 14 },
      { chunkIndex: 15 },
      { chunkIndex: 11 },
    ];
    const groups = groupContiguousChunks(chunks);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((c) => c.chunkIndex)).toEqual([10, 11]);
    expect(groups[1].map((c) => c.chunkIndex)).toEqual([14, 15]);
  });
});
