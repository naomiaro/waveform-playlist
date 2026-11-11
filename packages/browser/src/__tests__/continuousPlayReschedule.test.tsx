// @vitest-environment jsdom
//
// Turning continuous play ON during playback reschedules the audio without an
// end, so it runs past the current annotation (#701). That stop/play must
// happen only for that transition. The effect behind it also re-runs when
// playback starts and when the animation loop is rebuilt (a duration change);
// with continuous play already on, those used to restart the audio too.
import './jsdom-polyfills'; // must be first
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, waitFor } from '@testing-library/react';
import React from 'react';
import {
  WaveformPlaylistProvider,
  usePlaybackAnimation,
  usePlaylistControls,
  usePlaylistData,
  usePlaylistState,
} from '../WaveformPlaylistContext';
import type { ClipTrack, AudioClip, AnnotationData } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeTrack(id: string, seconds: number): ClipTrack {
  return {
    id,
    name: id,
    clips: [
      {
        id: id + '-clip',
        startSample: 0,
        durationSamples: seconds * SAMPLE_RATE,
        offsetSamples: 0,
        sampleRate: SAMPLE_RATE,
      } as AudioClip,
    ],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

interface LoggingAdapter {
  adapter: PlayoutAdapter;
  /** `play(start,end)` and `stop` calls, in order. */
  log: string[];
  setNow(seconds: number): void;
}

function createLoggingAdapter(): LoggingAdapter {
  const log: string[] = [];
  let now = 0;
  const adapter = {
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
    play(startTime: number, endTime?: number) {
      log.push('play(' + startTime + ',' + (endTime ?? '') + ')');
    },
    pause() {},
    stop() {
      log.push('stop');
    },
    seek(time: number) {
      now = time;
    },
    getCurrentTime: () => now,
    isPlaying: () => false,
    setMasterVolume() {},
    setTrackVolume() {},
    setTrackMute() {},
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {},
  } as unknown as PlayoutAdapter;
  return {
    adapter,
    log,
    setNow: (seconds) => {
      now = seconds;
    },
  };
}

interface Probe {
  isReady: boolean;
  isPlaying: boolean;
  continuousPlay: boolean;
  duration: number;
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  setContinuousPlay: (enabled: boolean) => void;
}
let probe: Probe;

const ProbeChild: React.FC = () => {
  const { isPlaying } = usePlaybackAnimation();
  const { play, setContinuousPlay } = usePlaylistControls();
  const { isReady, duration } = usePlaylistData();
  const { continuousPlay } = usePlaylistState();
  probe = { isReady, isPlaying, continuousPlay, duration, play, setContinuousPlay };
  return null;
};

const ANNOTATIONS: AnnotationData[] = [{ id: 'a', start: 1, end: 2, lines: ['one'] }];
const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

async function mount(isContinuousPlay: boolean) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const logging = createLoggingAdapter();
  const createAdapter = () => logging.adapter;
  const annotationList = { annotations: ANNOTATIONS, isContinuousPlay };
  const short = makeTrack('short', 10);
  const App: React.FC<{ tracks: ClipTrack[] }> = ({ tracks }) => (
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
      annotationList={annotationList}
    >
      <ProbeChild />
    </WaveformPlaylistProvider>
  );
  const view = render(<App tracks={[short]} />);
  await waitFor(() => expect(probe.isReady).toBe(true));
  logging.log.length = 0;
  return {
    ...logging,
    /** Appends a longer track: duration 10 s -> 20 s on the incremental path. */
    async growDuration() {
      await act(async () => {
        view.rerender(<App tracks={[short, makeTrack('long', 20)]} />);
      });
      await waitFor(() => expect(probe.duration).toBe(20));
      await wait(60);
    },
  };
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('continuous play and audio rescheduling', () => {
  it('starting playback with continuous play on starts the audio once', async () => {
    const { log } = await mount(true);
    await act(async () => {
      await probe.play(0);
    });
    await wait(60);
    expect(probe.isPlaying).toBe(true);
    // play() itself stops any previous playout, then plays.
    expect(log).toEqual(['stop', 'play(0,)']);
  });

  it('a duration change during playback does not restart the audio', async () => {
    const { log, setNow, growDuration } = await mount(true);
    await act(async () => {
      await probe.play(0);
    });
    await wait(60);
    setNow(3);
    await wait(40);
    log.length = 0;

    await growDuration();
    expect(probe.isPlaying).toBe(true);
    expect(log).toEqual([]);
  });

  it('turning continuous play on during playback reschedules once, without an end', async () => {
    const { log, setNow } = await mount(false);
    await act(async () => {
      await probe.play(1, 1); // one annotation: 1 s -> 2 s
    });
    await wait(60);
    expect(log).toEqual(['stop', 'play(1,2)']);
    setNow(1.5);
    await wait(40);
    log.length = 0;

    await act(async () => {
      probe.setContinuousPlay(true);
    });
    await wait(60);
    expect(probe.continuousPlay).toBe(true);
    expect(probe.isPlaying).toBe(true);
    expect(log).toEqual(['stop', 'play(1.5,)']);

    // ...and playback really does run past the annotation's end (2 s).
    log.length = 0;
    setNow(2.5);
    await wait(80);
    expect(probe.isPlaying).toBe(true);
    expect(log).toEqual([]);
  });

  it('turning continuous play off during playback leaves the audio alone', async () => {
    const { log, setNow } = await mount(true);
    await act(async () => {
      await probe.play(0);
    });
    await wait(60);
    setNow(3);
    await wait(40);
    log.length = 0;

    await act(async () => {
      probe.setContinuousPlay(false);
    });
    await wait(60);
    expect(probe.isPlaying).toBe(true);
    expect(log).toEqual([]);
  });

  it('turning it on while stopped, then playing, starts the audio once', async () => {
    const { log } = await mount(false);
    await act(async () => {
      probe.setContinuousPlay(true);
    });
    await wait(30);
    expect(log).toEqual([]);
    await act(async () => {
      await probe.play(0);
    });
    await wait(60);
    expect(log).toEqual(['stop', 'play(0,)']);
  });
});
