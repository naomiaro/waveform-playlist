import { describe, it, expect, beforeEach } from 'vitest';
import { ColorLUTCache } from '../src/orchestrator/color-lut-cache';

describe('ColorLUTCache', () => {
  let cache: ColorLUTCache;
  beforeEach(() => {
    cache = new ColorLUTCache();
  });

  it('returns a Uint8Array LUT for a known color map name', () => {
    const lut = cache.get('viridis');
    expect(lut).toBeInstanceOf(Uint8Array);
    expect(lut.length).toBe(256 * 3); // 256 RGB entries — matches getColorMap shape
  });

  it('returns the same reference on repeated calls (caching)', () => {
    const a = cache.get('magma');
    const b = cache.get('magma');
    expect(a).toBe(b);
  });

  it('returns different references for different maps', () => {
    expect(cache.get('viridis')).not.toBe(cache.get('magma'));
  });

  it('clear() drops cached entries', () => {
    const a = cache.get('viridis');
    cache.clear();
    const b = cache.get('viridis');
    expect(a).not.toBe(b);
  });
});
