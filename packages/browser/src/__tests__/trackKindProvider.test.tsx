// @vitest-environment jsdom
//
// #756: a track holds one kind of clip, and the engine throws on a track that
// breaks this. In the provider both places that hand tracks to the engine are
// inside the async load, so the throw does not reach React (an error boundary
// never sees it): the provider reports it through `onError`, nothing reaches
// the adapter, and the playlist does not become ready.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider, usePlaylistData } from '../WaveformPlaylistContext';
import type { ClipTrack, AudioClip, TrackKind } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function clip(id: string, midi = false): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sourceDurationSamples: SAMPLE_RATE,
    sampleRate: SAMPLE_RATE,
    gain: 1,
    ...(midi && {
      midiNotes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }],
    }),
  };
}

function track(id: string, kind: TrackKind, clips: AudioClip[]): ClipTrack {
  return { id, kind, name: id, clips, muted: false, soloed: false, volume: 1, pan: 0 };
}

function createFakeAdapter() {
  return {
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    init: vi.fn(async () => {}),
    setTracks: vi.fn(),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    updateTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  } satisfies PlayoutAdapter;
}

let isReady = false;
const Probe: React.FC = () => {
  isReady = usePlaylistData().isReady;
  return null;
};

function mount(tracks: ClipTrack[]) {
  const adapters: ReturnType<typeof createFakeAdapter>[] = [];
  const onError = vi.fn();
  const view = (next: ClipTrack[]) => (
    <WaveformPlaylistProvider
      tracks={next}
      sampleRate={SAMPLE_RATE}
      onError={onError}
      createAdapter={() => {
        const adapter = createFakeAdapter();
        adapters.push(adapter);
        return adapter;
      }}
    >
      <Probe />
    </WaveformPlaylistProvider>
  );
  const rendered = render(view(tracks));
  return { adapters, onError, rerender: (next: ClipTrack[]) => rendered.rerender(view(next)) };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  isReady = false;
});

describe('a wrong-kind track in the provider (#756)', () => {
  it('is reported through onError; the page keeps rendering and the playlist is not ready', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mixed = track('t1', 'audio', [clip('a'), clip('m', true)]);

    const { adapters, onError } = mount([mixed]);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0]).toBeInstanceOf(Error);
    expect(onError.mock.calls[0][0].message).toMatch(
      /"t1" is an audio track[\s\S]*"m" is a midi clip/
    );
    expect(isReady).toBe(false);
    for (const adapter of adapters) {
      const withTracks = adapter.setTracks.mock.calls.filter(([list]) => list.length > 0);
      expect(withTracks).toEqual([]);
    }
  });

  it('tracks appended to a running playlist: a bad one is reported and none of the batch is added first', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = track('a', 'audio', [clip('c1')]);
    const { adapters, onError, rerender } = mount([first]);
    await waitFor(() => expect(isReady).toBe(true));
    const running = adapters[adapters.length - 1];

    // Same first track object, two appended: the incremental path.
    rerender([first, track('b', 'audio', [clip('c2')]), track('m', 'audio', [clip('c3', true)])]);

    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect(onError.mock.calls[0][0].message).toMatch(/"m" is an audio track/);
    expect(running.addTrack).not.toHaveBeenCalled();
    expect(isReady).toBe(false);
  });

  it('a later valid tracks prop recovers', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { onError, rerender } = mount([track('t1', 'audio', [clip('m', true)])]);
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));

    rerender([track('t1', 'midi', [clip('m', true)])]);

    await waitFor(() => expect(isReady).toBe(true));
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('accepts an audio track and a MIDI track side by side', async () => {
    const { onError } = mount([
      track('a', 'audio', [clip('c1')]),
      track('m', 'midi', [clip('c2', true)]),
    ]);

    await waitFor(() => expect(isReady).toBe(true));
    expect(onError).not.toHaveBeenCalled();
  });
});
