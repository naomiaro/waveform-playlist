import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Parsing arbitrary bytes with the real soundfont2 parser throws, so mock it.
// Kept in its own file: SoundFontCache.test.ts imports the REAL GeneratorType.
vi.mock('soundfont2', () => ({
  SoundFont2: vi.fn().mockImplementation(() => ({})),
}));

import { SoundFontCache } from '../SoundFontCache';

function okResponse(): Response {
  return {
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as unknown as Response;
}

describe('SoundFontCache.fromUrl', () => {
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

  it('resolves to a cache that is already loaded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const cache = await SoundFontCache.fromUrl('/media/soundfont/A320U.sf2');

    expect(cache).toBeInstanceOf(SoundFontCache);
    expect(cache.isLoaded).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe('/media/soundfont/A320U.sf2');
  });

  it('rejects when the fetch fails (no half-loaded cache escapes)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, statusText: 'Not Found' } as unknown as Response)
    );

    await expect(SoundFontCache.fromUrl('/missing.sf2')).rejects.toThrow(
      'Failed to fetch SoundFont /missing.sf2: Not Found'
    );
  });

  it('forwards the abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await SoundFontCache.fromUrl('/a.sf2', { signal: controller.signal });

    expect(fetchMock).toHaveBeenCalledWith('/a.sf2', { signal: controller.signal });
  });

  it('passes a provided context through to the constructor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    const ctx = { sampleRate: 48000 } as unknown as BaseAudioContext;

    const cache = await SoundFontCache.fromUrl('/a.sf2', { context: ctx });

    // White-box: context is private; reach in rather than exercising the full
    // getAudioBuffer pipeline, which needs real SF2 sample data.
    expect((cache as unknown as { context: BaseAudioContext }).context).toBe(ctx);
  });

  it('rejects when the SF2 fails to parse', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      } as unknown as Response)
    );
    const { SoundFont2 } = await import('soundfont2');
    (SoundFont2 as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('bad RIFF header');
    });

    await expect(SoundFontCache.fromUrl('/corrupt.sf2')).rejects.toThrow(
      'Failed to parse SoundFont /corrupt.sf2: bad RIFF header'
    );
  });
});
