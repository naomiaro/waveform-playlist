import { describe, it, expect, vi } from 'vitest';

// The manager must create sources on the package's global playout context —
// Tone's raw getContext() would lazily create an orphaned default context
// when called before configureGlobalContext()/getGlobalContext().
const { mockGlobalContext, mockToneDefaultContext } = vi.hoisted(() => ({
  mockGlobalContext: {
    createMediaStreamSource: vi.fn(() => ({ disconnect: vi.fn() })),
  },
  mockToneDefaultContext: {
    createMediaStreamSource: vi.fn(() => ({ disconnect: vi.fn() })),
  },
}));

vi.mock('../audioContext', () => ({
  getGlobalContext: vi.fn(() => mockGlobalContext),
}));

vi.mock('tone', () => ({
  getContext: vi.fn(() => mockToneDefaultContext),
}));

import {
  getMediaStreamSource,
  releaseMediaStreamSource,
  hasMediaStreamSource,
} from '../mediaStreamSourceManager';

interface FakeTrack {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  fire: (event: string) => void;
}

function makeStreamTrack(): FakeTrack {
  const listeners = new Map<string, () => void>();
  return {
    addEventListener: vi.fn((event: string, fn: () => void) => listeners.set(event, fn)),
    removeEventListener: vi.fn((event: string) => listeners.delete(event)),
    fire: (event: string) => listeners.get(event)?.(),
  };
}

function makeStream(tracks: FakeTrack[]): MediaStream & { active: boolean } {
  return {
    active: true,
    getTracks: () => tracks,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  } as unknown as MediaStream & { active: boolean };
}

describe('mediaStreamSourceManager', () => {
  it('creates the source on the global playout context, not Tone default', () => {
    const stream = makeStream([makeStreamTrack()]);

    getMediaStreamSource(stream);

    expect(mockGlobalContext.createMediaStreamSource).toHaveBeenCalledWith(stream);
    expect(mockToneDefaultContext.createMediaStreamSource).not.toHaveBeenCalled();
  });

  it('returns the same source for repeated calls with the same stream', () => {
    const stream = makeStream([makeStreamTrack()]);

    const a = getMediaStreamSource(stream);
    const b = getMediaStreamSource(stream);

    expect(a).toBe(b);
  });

  // MediaStream itself has no 'ended'/'inactive' events (ended is track-level;
  // active/inactive were removed from the spec) — cleanup must hook the tracks.
  it('cleans up when all tracks end and the stream goes inactive', () => {
    const track = makeStreamTrack();
    const stream = makeStream([track]);

    const source = getMediaStreamSource(stream);
    stream.active = false;
    track.fire('ended');

    expect(hasMediaStreamSource(stream)).toBe(false);
    expect(source.disconnect).toHaveBeenCalled();
  });

  it('keeps the source while the stream is still active', () => {
    const track1 = makeStreamTrack();
    const track2 = makeStreamTrack();
    const stream = makeStream([track1, track2]);

    getMediaStreamSource(stream);
    track1.fire('ended'); // stream.active still true — one live track left

    expect(hasMediaStreamSource(stream)).toBe(true);
  });

  it('releaseMediaStreamSource disconnects and clears the entry', () => {
    const stream = makeStream([makeStreamTrack()]);

    const source = getMediaStreamSource(stream);
    releaseMediaStreamSource(stream);

    expect(source.disconnect).toHaveBeenCalled();
    expect(hasMediaStreamSource(stream)).toBe(false);
  });
});
