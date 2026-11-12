// @vitest-environment jsdom
//
// #688, part 2 (third review). The bundled MediaElement engine is CREATED at
// the `playbackRate` prop's speed, as given. The provider must not then tell
// it that same speed through `setPlaybackRate`, which clamps (0.25 to 4): a
// prop of 5 played at 5 before this change and must still. A new player is
// told a speed only when it differs from the one it was created with.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';

const engine = vi.hoisted(() => ({
  created: [] as Array<{
    createdAt: number;
    setPlaybackRate: ReturnType<typeof vi.fn>;
    addTrack: ReturnType<typeof vi.fn>;
  }>,
}));

// Stands in for the bundled engine: no `createPlayout` is passed below, so the
// provider asks this module for a player and gives it the prop's speed.
vi.mock('../playout/resolveMediaElementPlayout', () => ({
  resolveMediaElementPlayout: async (options: { playbackRate?: number }) => {
    const fake = {
      createdAt: options.playbackRate ?? 1,
      addTrack: vi.fn(),
      getTrack: () => undefined,
      setOnPlaybackComplete() {},
      on() {},
      off() {},
      play: vi.fn(),
      pause: vi.fn(),
      stop: vi.fn(),
      seekTo: vi.fn(),
      setPlaybackRate: vi.fn(),
      getCurrentTime: () => 0,
      dispose: vi.fn(),
    };
    engine.created.push(fake);
    return fake;
  },
}));

import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import { usePlaybackRate } from '../contexts/playlistContexts';

const LENGTH = 800;
const waveformData = WaveformData.create({
  version: 2,
  channels: 1,
  sample_rate: 44100,
  samples_per_pixel: 441,
  bits: 8,
  length: LENGTH,
  data: Array.from({ length: LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
});
const TRACK = { source: 'test.mp3', waveformData, name: 'Test' };
const RENAMED = { ...TRACK, name: 'Renamed' };

let rate: ReturnType<typeof usePlaybackRate>;
const Probe: React.FC = () => {
  rate = usePlaybackRate();
  return null;
};

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  engine.created.length = 0;
  vi.restoreAllMocks();
});

const ui = (playbackRate: number, track = TRACK) => (
  <MediaElementPlaylistProvider track={track} playbackRate={playbackRate}>
    <Probe />
  </MediaElementPlaylistProvider>
);

describe('the bundled engine and the playbackRate prop', () => {
  it('is created at the prop as given and is not told it again, also outside the setter range', async () => {
    render(ui(5));
    await waitFor(() => expect(engine.created[0]?.addTrack).toHaveBeenCalled());
    expect(engine.created[0].createdAt).toBe(5);
    expect(engine.created[0].setPlaybackRate).not.toHaveBeenCalled();
    expect(rate.playbackRate).toBe(5);
  });

  it('a changed prop creates the next player at it, without a second instruction', async () => {
    const view = render(ui(1));
    await waitFor(() => expect(engine.created[0]?.addTrack).toHaveBeenCalled());
    view.rerender(ui(1.5));
    await waitFor(() => expect(engine.created[1]?.addTrack).toHaveBeenCalled());
    expect(engine.created[1].createdAt).toBe(1.5);
    expect(engine.created[1].setPlaybackRate).not.toHaveBeenCalled();
  });

  it("a replaced player is told the user's speed, which differs from the prop it was created at", async () => {
    const view = render(ui(1));
    await waitFor(() => expect(engine.created[0]?.addTrack).toHaveBeenCalled());
    act(() => rate.setPlaybackRate(1.5));
    expect(engine.created[0].setPlaybackRate).toHaveBeenLastCalledWith(1.5);
    view.rerender(ui(1, RENAMED));
    await waitFor(() => expect(engine.created[1]?.addTrack).toHaveBeenCalled());
    expect(engine.created[1].createdAt).toBe(1);
    expect(engine.created[1].setPlaybackRate).toHaveBeenCalledTimes(1);
    expect(engine.created[1].setPlaybackRate).toHaveBeenCalledWith(1.5);
  });
});
