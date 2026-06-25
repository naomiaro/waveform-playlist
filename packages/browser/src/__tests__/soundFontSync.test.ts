import { describe, it, expect, vi } from 'vitest';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { SoundFontCache } from '@waveform-playlist/playout';
import { syncSoundFontCacheToAdapter } from '../soundFontSync';

const cache = { isLoaded: true } as unknown as SoundFontCache;

describe('syncSoundFontCacheToAdapter', () => {
  it('forwards the cache to adapters that support soundfonts', () => {
    const setSoundFontCache = vi.fn();
    const adapter = { setSoundFontCache } as unknown as PlayoutAdapter;

    syncSoundFontCacheToAdapter(adapter, cache);

    expect(setSoundFontCache).toHaveBeenCalledWith(cache);
  });

  it('forwards undefined to revert to synthesis', () => {
    const setSoundFontCache = vi.fn();
    const adapter = { setSoundFontCache } as unknown as PlayoutAdapter;

    syncSoundFontCacheToAdapter(adapter, undefined);

    expect(setSoundFontCache).toHaveBeenCalledWith(undefined);
  });

  it('no-ops when the adapter is null', () => {
    expect(() => syncSoundFontCacheToAdapter(null, cache)).not.toThrow();
  });

  it('no-ops for adapters without soundfont support', () => {
    const adapter = {} as unknown as PlayoutAdapter;
    expect(() => syncSoundFontCacheToAdapter(adapter, cache)).not.toThrow();
  });
});
