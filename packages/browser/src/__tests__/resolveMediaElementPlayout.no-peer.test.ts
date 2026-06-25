import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.doMock('@waveform-playlist/media-element-playout', () => {
  throw new Error("Cannot find module '@waveform-playlist/media-element-playout'");
});

import { resolveMediaElementPlayout } from '../playout/resolveMediaElementPlayout';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

describe('resolveMediaElementPlayout — package unavailable', () => {
  it('rejects with the friendly install hint', async () => {
    await expect(resolveMediaElementPlayout({})).rejects.toThrow(
      /npm install @waveform-playlist\/media-element-playout/
    );
  });

  it('console.warns the original module-resolution error', async () => {
    await expect(resolveMediaElementPlayout({})).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[waveform-playlist] @waveform-playlist/media-element-playout dynamic import failed:'
      )
    );
  });

  it('still bypasses the import when a custom playout is supplied', async () => {
    const custom = { addTrack: vi.fn(), dispose: vi.fn() } as never;
    await expect(resolveMediaElementPlayout({ createPlayout: () => custom })).resolves.toBe(custom);
  });
});
