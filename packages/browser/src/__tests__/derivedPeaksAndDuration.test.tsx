// @vitest-environment jsdom
//
// #692: `peaksDataArray` and `duration` are derived from `tracks` during
// render instead of being written by effects. So they are correct in the same
// render that sees the new tracks, an edit to one clip leaves the other clips'
// peak arrays alone, and a `tracks` change renders consumers once.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import { WaveformPlaylistProvider, usePlaylistData } from '../WaveformPlaylistContext';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeWaveformData(bins: number): WaveformData {
  const data: number[] = [];
  for (let i = 0; i < bins; i++) {
    data.push(-(i % 100), i % 100);
  }
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: SAMPLE_RATE,
    samples_per_pixel: 256,
    bits: 16,
    length: bins,
    data,
  });
}

function makeClip(id: string, overrides: Partial<AudioClip> = {}): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SAMPLE_RATE * 2,
    gain: 1,
    waveformData: makeWaveformData(400),
    ...overrides,
  } as AudioClip;
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: id, clips, muted: false, soloed: false, volume: 1, pan: 0 } as ClipTrack;
}

function createFakeAdapter(): PlayoutAdapter {
  return {
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {},
    setTracks() {},
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play: vi.fn(),
    pause() {},
    stop() {},
    seek() {},
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume() {},
    setTrackVolume() {},
    setTrackMute() {},
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {},
  } as unknown as PlayoutAdapter;
}

type Data = ReturnType<typeof usePlaylistData>;

// Every render of the data consumer, in order. A render in which the peaks or
// the duration disagree with the tracks it was given is a stale render.
let renders: Data[] = [];

const ProbeChild: React.FC = () => {
  renders.push(usePlaylistData());
  return null;
};

function latest(): Data {
  return renders[renders.length - 1];
}

function mount(initialTracks: ClipTrack[]) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  renders = [];
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  const ui = (tracks: ClipTrack[]) => (
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
    >
      <ProbeChild />
    </WaveformPlaylistProvider>
  );
  const utils = render(ui(initialTracks));
  return { setTracks: (tracks: ClipTrack[]) => utils.rerender(ui(tracks)) };
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('peaks and duration are derived from tracks (#692)', () => {
  it('has peaks and duration in the very first render', () => {
    mount([makeTrack('t1', [makeClip('a'), makeClip('b', { startSample: SAMPLE_RATE * 2 })])]);

    const first = renders[0];
    expect(first.peaksDataArray).toHaveLength(1);
    expect(first.peaksDataArray[0]).toHaveLength(2);
    expect(first.peaksDataArray[0][0].peaks.length).toBeGreaterThan(0);
    expect(first.duration).toBe(3);
  });

  it('never renders peaks or duration that lag the tracks', async () => {
    const a = makeClip('a');
    const { setTracks } = mount([makeTrack('t1', [a])]);
    await waitFor(() => expect(latest().isReady).toBe(true));

    await act(async () => {
      setTracks([
        makeTrack('t1', [a]),
        makeTrack('t2', [makeClip('c', { startSample: SAMPLE_RATE * 4 })]),
      ]);
    });
    await waitFor(() => expect(latest().isReady).toBe(true));

    for (const data of renders) {
      expect(data.peaksDataArray).toHaveLength(data.tracks.length);
      const end = Math.max(
        0,
        ...data.tracks.flatMap((t) =>
          t.clips.map((c) => (c.startSample + c.durationSamples) / c.sampleRate)
        )
      );
      expect(data.duration).toBe(end);
    }
  });

  it('keeps the other clips peak arrays when one clip is trimmed', async () => {
    const a = makeClip('a');
    const b = makeClip('b', { startSample: SAMPLE_RATE * 2 });
    const c = makeClip('c');
    const { setTracks } = mount([makeTrack('t1', [a, b]), makeTrack('t2', [c])]);
    await waitFor(() => expect(latest().isReady).toBe(true));
    const before = latest().peaksDataArray;

    const trimmed = { ...a, durationSamples: SAMPLE_RATE / 2 };
    await act(async () => {
      setTracks([makeTrack('t1', [trimmed, b]), makeTrack('t2', [c])]);
    });
    await waitFor(() => expect(latest().isReady).toBe(true));
    const after = latest().peaksDataArray;

    expect(after[0][0].peaks).not.toBe(before[0][0].peaks);
    expect(after[0][0].durationSamples).toBe(SAMPLE_RATE / 2);
    expect(after[0][1]).toBe(before[0][1]);
    expect(after[1]).toBe(before[1]);
  });

  it('keeps the whole peaks array when a re-render passes equal tracks', async () => {
    const a = makeClip('a');
    const { setTracks } = mount([makeTrack('t1', [a])]);
    await waitFor(() => expect(latest().isReady).toBe(true));
    const before = latest().peaksDataArray;

    await act(async () => {
      setTracks([makeTrack('t1', [a])]);
    });
    await waitFor(() => expect(latest().isReady).toBe(true));

    expect(latest().peaksDataArray).toBe(before);
  });

  it('clears peaks and duration when the tracks are removed', async () => {
    const { setTracks } = mount([makeTrack('t1', [makeClip('a')])]);
    await waitFor(() => expect(latest().isReady).toBe(true));

    await act(async () => {
      setTracks([]);
    });

    expect(latest().peaksDataArray).toEqual([]);
    expect(latest().duration).toBe(0);
  });

  it('no longer exposes audioBuffers', async () => {
    mount([makeTrack('t1', [makeClip('a')])]);
    await waitFor(() => expect(latest().isReady).toBe(true));
    expect('audioBuffers' in latest()).toBe(false);
  });
});
