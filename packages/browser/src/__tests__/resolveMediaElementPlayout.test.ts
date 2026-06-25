import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const instance = { addTrack: vi.fn(), dispose: vi.fn() };
  const MediaElementPlayout = vi.fn(() => instance);
  return { instance, MediaElementPlayout };
});

vi.mock('@waveform-playlist/media-element-playout', () => ({
  MediaElementPlayout: h.MediaElementPlayout,
}));

import { resolveMediaElementPlayout } from '../playout/resolveMediaElementPlayout';

beforeEach(() => {
  h.MediaElementPlayout.mockClear();
});

describe('resolveMediaElementPlayout', () => {
  it('returns the custom playout without importing the default engine', async () => {
    const custom = { addTrack: vi.fn(), dispose: vi.fn() } as never;
    const result = await resolveMediaElementPlayout({ createPlayout: () => custom });
    expect(result).toBe(custom);
    expect(h.MediaElementPlayout).not.toHaveBeenCalled();
  });

  it('dynamically constructs MediaElementPlayout with options when no factory is supplied', async () => {
    const result = await resolveMediaElementPlayout({ playbackRate: 1.5, preservesPitch: false });
    expect(result).toBe(h.instance);
    expect(h.MediaElementPlayout).toHaveBeenCalledWith({
      playbackRate: 1.5,
      preservesPitch: false,
    });
  });
});
