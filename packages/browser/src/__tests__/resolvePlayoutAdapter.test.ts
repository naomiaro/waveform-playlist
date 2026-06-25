import { describe, it, expect, vi, beforeEach } from 'vitest';

// A working stub for @waveform-playlist/playout. vi.hoisted so the mock factory
// (which is hoisted above imports) can reference these.
const h = vi.hoisted(() => {
  const adapter = { audioContext: { sampleRate: 48000 }, dispose: vi.fn() };
  return {
    adapter,
    createToneAdapter: vi.fn(() => adapter),
    configureGlobalContext: vi.fn(() => 48000),
  };
});

vi.mock('@waveform-playlist/playout', () => ({
  createToneAdapter: h.createToneAdapter,
  configureGlobalContext: h.configureGlobalContext,
}));

import { resolvePlayoutAdapter } from '../playout/resolvePlayoutAdapter';

beforeEach(() => {
  h.createToneAdapter.mockClear();
  h.configureGlobalContext.mockClear();
});

describe('resolvePlayoutAdapter', () => {
  it('returns the custom adapter without importing the default engine', async () => {
    const custom = { audioContext: { sampleRate: 44100 }, dispose: vi.fn() } as never;
    const result = await resolvePlayoutAdapter({ createAdapter: () => custom });
    expect(result).toBe(custom);
    expect(h.createToneAdapter).not.toHaveBeenCalled();
  });

  it('dynamically imports createToneAdapter when no factory is supplied', async () => {
    const fn = (() => {}) as never;
    const cache = {} as never;
    const result = await resolvePlayoutAdapter({ effects: fn, soundFontCache: cache });
    expect(result).toBe(h.adapter);
    expect(h.createToneAdapter).toHaveBeenCalledWith({ effects: fn, soundFontCache: cache });
  });

  it('configures the global context only when a sampleRate is provided', async () => {
    await resolvePlayoutAdapter({ sampleRate: 44100 });
    expect(h.configureGlobalContext).toHaveBeenCalledWith({ sampleRate: 44100 });

    h.configureGlobalContext.mockClear();
    await resolvePlayoutAdapter({});
    expect(h.configureGlobalContext).not.toHaveBeenCalled();
  });
});
