import { describe, it, expect } from 'vitest';
import {
  applyTrackOrderPreview,
  computeTrackLayout,
  type TrackDragPreview,
} from '../trackOrderPreview';

const t = (id: string) => ({ id });
const tracks = [t('a'), t('b'), t('c'), t('d')];

describe('applyTrackOrderPreview', () => {
  it('returns the same array reference when preview is null', () => {
    expect(applyTrackOrderPreview(tracks, null)).toBe(tracks);
  });

  it('moves a track down', () => {
    const preview: TrackDragPreview = { trackId: 'a', toIndex: 2 };
    expect(applyTrackOrderPreview(tracks, preview).map((x) => x.id)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves a track up', () => {
    const preview: TrackDragPreview = { trackId: 'd', toIndex: 0 };
    expect(applyTrackOrderPreview(tracks, preview).map((x) => x.id)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('is identity when toIndex equals the current index', () => {
    expect(applyTrackOrderPreview(tracks, { trackId: 'b', toIndex: 1 })).toBe(tracks);
  });

  it('is identity for an unknown trackId', () => {
    expect(applyTrackOrderPreview(tracks, { trackId: 'zzz', toIndex: 0 })).toBe(tracks);
  });

  it('clamps out-of-range toIndex into bounds', () => {
    expect(applyTrackOrderPreview(tracks, { trackId: 'a', toIndex: 99 }).map((x) => x.id)).toEqual([
      'b',
      'c',
      'd',
      'a',
    ]);
    expect(applyTrackOrderPreview(tracks, { trackId: 'c', toIndex: -5 }).map((x) => x.id)).toEqual([
      'c',
      'a',
      'b',
      'd',
    ]);
  });

  it('does not mutate the input array', () => {
    const before = tracks.slice();
    applyTrackOrderPreview(tracks, { trackId: 'a', toIndex: 3 });
    expect(tracks).toEqual(before);
  });
});

describe('computeTrackLayout', () => {
  it('computes cumulative tops and totalHeight for varying heights', () => {
    const heights = new Map([
      ['a', 100],
      ['b', 60],
      ['c', 140],
    ]);
    const layout = computeTrackLayout(['a', 'b', 'c'], heights);
    expect(layout.topById.get('a')).toBe(0);
    expect(layout.topById.get('b')).toBe(100);
    expect(layout.topById.get('c')).toBe(160);
    expect(layout.totalHeight).toBe(300);
  });

  it('reflects a previewed order (tops follow the order, heights follow the id)', () => {
    const heights = new Map([
      ['a', 100],
      ['b', 60],
      ['c', 140],
    ]);
    const layout = computeTrackLayout(['b', 'c', 'a'], heights);
    expect(layout.topById.get('b')).toBe(0);
    expect(layout.topById.get('c')).toBe(60);
    expect(layout.topById.get('a')).toBe(200);
    expect(layout.totalHeight).toBe(300);
  });

  it('treats ids with no height entry as height 0', () => {
    const layout = computeTrackLayout(
      ['a', 'ghost', 'b'],
      new Map([
        ['a', 50],
        ['b', 50],
      ])
    );
    expect(layout.topById.get('ghost')).toBe(50);
    expect(layout.topById.get('b')).toBe(50);
    expect(layout.totalHeight).toBe(100);
  });

  it('empty input gives empty map and zero height', () => {
    const layout = computeTrackLayout([], new Map());
    expect(layout.topById.size).toBe(0);
    expect(layout.totalHeight).toBe(0);
  });
});
