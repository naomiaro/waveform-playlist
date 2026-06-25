// Separate file: vi.doMock makes the dynamic import REJECT, simulating the
// optional peer not being installed. (Pattern mirrors dawcore's
// daw-editor-load-midi-no-peer.test.ts.)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.doMock('@waveform-playlist/playout', () => {
  throw new Error("Cannot find module '@waveform-playlist/playout'");
});

import { resolvePlayoutAdapter } from '../playout/resolvePlayoutAdapter';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

describe('resolvePlayoutAdapter — @waveform-playlist/playout unavailable', () => {
  it('rejects with the friendly install hint', async () => {
    await expect(resolvePlayoutAdapter({})).rejects.toThrow(
      /npm install @waveform-playlist\/playout tone/
    );
  });

  it('console.warns the original module-resolution error', async () => {
    await expect(resolvePlayoutAdapter({})).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[waveform-playlist] @waveform-playlist/playout dynamic import failed:'
      )
    );
  });

  it('still bypasses the import when a custom adapter is supplied', async () => {
    const custom = { audioContext: { sampleRate: 44100 }, dispose: vi.fn() } as never;
    await expect(resolvePlayoutAdapter({ createAdapter: () => custom })).resolves.toBe(custom);
  });
});
