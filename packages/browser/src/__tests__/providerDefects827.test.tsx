// @vitest-environment jsdom
//
// #827: the smaller provider defects the #703 closing audit found.
//
// - `engine.play` that throws during a RESTART (a seek or an annotation
//   click while playing) left React's `isPlaying` at true, with the engine
//   and the animation loop stopped: the UI showed a playing state for audio
//   that was not playing.
// - `seekTo(NaN)` put NaN into the time refs, into the state and into the
//   engine; `setPlaybackRate(NaN)` put NaN into the speed. NaN is not a
//   position and not a speed: it is ignored. Infinity is not: it is clamped.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const mediaElement = vi.hoisted(() => ({
  created: [] as Array<{
    setPlaybackRate: ReturnType<typeof vi.fn>;
    seekTo: ReturnType<typeof vi.fn>;
    play: ReturnType<typeof vi.fn>;
  }>,
}));

// Stands in for the bundled engine: no `createPlayout` is passed below, so the
// provider asks this module for a player.
vi.mock('../playout/resolveMediaElementPlayout', () => ({
  resolveMediaElementPlayout: async () => {
    const fake = {
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
    mediaElement.created.push(fake);
    return fake;
  },
}));

import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import {
  usePlaybackControls,
  useCurrentTime,
  useIsPlaying,
  usePlaybackRate,
  usePlaylistTimeline,
} from '../contexts/playlistContexts';
import {
  TestProvider,
  recordingAdapter,
  testArrangement,
  type RecordingAdapter,
} from './helpers/arrangementProvider';
import { clip, track } from './helpers/engineHarness';

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

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  mediaElement.created.length = 0;
  vi.restoreAllMocks();
});

describe('the MediaElement provider and a NaN time or speed', () => {
  interface MediaProbe {
    controls: ReturnType<typeof usePlaybackControls>;
    currentTime: number;
    rate: ReturnType<typeof usePlaybackRate>;
  }

  let probe: MediaProbe;
  const Probe: React.FC = () => {
    probe = {
      controls: usePlaybackControls(),
      currentTime: useCurrentTime().currentTime,
      rate: usePlaybackRate(),
    };
    return null;
  };

  const ui = () => (
    <MediaElementPlaylistProvider track={TRACK}>
      <Probe />
    </MediaElementPlaylistProvider>
  );

  it('a seek to NaN leaves the time alone', async () => {
    render(ui());
    await waitFor(() => expect(mediaElement.created[0]?.seekTo).toBeDefined());
    act(() => probe.controls.seekTo(2));
    expect(probe.currentTime).toBe(2);

    act(() => probe.controls.seekTo(NaN));
    expect(probe.currentTime).toBe(2);
    expect(mediaElement.created[0].seekTo).toHaveBeenLastCalledWith(2);
  });

  it('a speed of NaN leaves the speed alone', async () => {
    render(ui());
    await waitFor(() => expect(mediaElement.created[0]?.setPlaybackRate).toBeDefined());
    act(() => probe.rate.setPlaybackRate(1.5));
    expect(probe.rate.playbackRate).toBe(1.5);

    act(() => probe.rate.setPlaybackRate(NaN));
    expect(probe.rate.playbackRate).toBe(1.5);
    expect(mediaElement.created[0].setPlaybackRate).toHaveBeenLastCalledWith(1.5);
  });

  it('a seek to Infinity still means the end of the audio', async () => {
    // Fast Forward asks for Infinity, which is a position (the end), not a
    // broken number: it must be clamped to the duration, not ignored.
    render(ui());
    await waitFor(() => expect(mediaElement.created[0]?.seekTo).toBeDefined());

    act(() => probe.controls.seekTo(Infinity));
    expect(probe.currentTime).toBe(waveformData.duration);
    expect(mediaElement.created[0].seekTo).toHaveBeenLastCalledWith(waveformData.duration);
  });
});

describe('the WebAudio provider and a play that throws during a restart', () => {
  interface WebAudioProbe {
    isPlaying: boolean;
    isReady: boolean;
    controls: ReturnType<typeof usePlaybackControls>;
  }

  let probe: WebAudioProbe;
  const Probe: React.FC = () => {
    probe = {
      isPlaying: useIsPlaying().isPlaying,
      isReady: usePlaylistTimeline().isReady,
      controls: usePlaybackControls(),
    };
    return null;
  };

  it('isPlaying goes back to false when the engine refuses to play', async () => {
    // The adapter plays once and then refuses: the restart (a seek while
    // playing) throws inside the engine, which re-throws it to the provider.
    let plays = 0;
    const createAdapter = () => {
      const adapter = recordingAdapter();
      const play = adapter.play;
      const failing: RecordingAdapter = {
        ...adapter,
        play: (...args: unknown[]) => {
          plays += 1;
          if (plays > 1) throw new Error('the engine refused to play');
          (play as (...a: unknown[]) => void)(...args);
        },
      };
      return failing;
    };

    const arrangement = testArrangement([track('t1', [clip('c1', 0, 2)])]);
    render(
      <TestProvider
        arrangement={arrangement}
        sampleRate={48000}
        indefinitePlayback
        createAdapter={createAdapter}
      >
        <Probe />
      </TestProvider>
    );
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      await probe.controls.play(0);
    });
    expect(probe.isPlaying).toBe(true);

    // The restart: a seek while playing. The engine throws, so the play
    // never starts, but the provider had already said it was playing.
    await act(async () => {
      await probe.controls.seekTo(1);
    });

    expect(probe.isPlaying).toBe(false);
  });
});
