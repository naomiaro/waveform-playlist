import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Parsing arbitrary bytes with the real soundfont2 parser throws, so mock it.
// Kept out of SoundFontCache.test.ts, which imports the REAL GeneratorType
// (same convention as SoundFontCache.fromUrl.test.ts).
vi.mock('soundfont2', () => ({
  SoundFont2: vi.fn().mockImplementation(() => ({})),
}));

import { SoundFontCache } from '../SoundFontCache';

/** White-box handle on the private per-sample-index AudioBuffer cache. */
function bufferCacheOf(cache: SoundFontCache): Map<number, AudioBuffer> {
  return (cache as unknown as { audioBufferCache: Map<number, AudioBuffer> }).audioBufferCache;
}

describe('SoundFontCache reload invalidation', () => {
  beforeEach(() => {
    // Node has no OfflineAudioContext; the no-context constructor path needs it.
    vi.stubGlobal(
      'OfflineAudioContext',
      vi.fn().mockImplementation(() => ({}))
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  // AudioBuffers are cached by numeric sample index. After a hot-swap the same
  // index refers to a DIFFERENT sample in the new font — stale entries pair an
  // old font's buffer with the new font's pitch/loop/envelope (mispitched audio).

  it('loadFromBuffer clears AudioBuffers cached from the previous font', () => {
    const cache = new SoundFontCache();
    cache.loadFromBuffer(new ArrayBuffer(8));
    bufferCacheOf(cache).set(0, {} as AudioBuffer); // sample cached under font 1

    cache.loadFromBuffer(new ArrayBuffer(8)); // hot-swap to font 2

    expect(bufferCacheOf(cache).size).toBe(0);
  });

  it('load clears AudioBuffers cached from the previous font', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as unknown as Response)
    );
    const cache = new SoundFontCache();
    await cache.load('/font1.sf2');
    bufferCacheOf(cache).set(0, {} as AudioBuffer);

    await cache.load('/font2.sf2');

    expect(bufferCacheOf(cache).size).toBe(0);
  });

  it('a failed reload keeps the previous font AND its cache intact', async () => {
    const cache = new SoundFontCache();
    cache.loadFromBuffer(new ArrayBuffer(8));
    const buf = {} as AudioBuffer;
    bufferCacheOf(cache).set(0, buf);

    // Parser rejects the new bytes — the old font stays loaded, so its
    // cache entries are still valid and must survive.
    const { SoundFont2 } = await import('soundfont2');
    (SoundFont2 as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('bad RIFF header');
    });

    expect(() => cache.loadFromBuffer(new ArrayBuffer(8))).toThrow('Failed to parse SoundFont');
    expect(cache.isLoaded).toBe(true);
    expect(bufferCacheOf(cache).get(0)).toBe(buf);
  });
});
