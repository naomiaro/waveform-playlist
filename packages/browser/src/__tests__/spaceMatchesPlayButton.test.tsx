// @vitest-environment jsdom
//
// Space must start playback exactly as the Play button does: the highlighted
// selection when there is one (and looping is off), otherwise from the cursor.
// The shortcut used to always play from the cursor with no end.
import './jsdom-polyfills'; // must be first
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup, waitFor, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { usePlaylistControls, usePlaylistTimeline, useIsPlaying } from '../contexts/playlistContexts';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import { PlayButton } from '../components/PlaybackControls';
import { KeyboardShortcuts } from '../components/KeyboardShortcuts';
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
  /** Report that a bounded play finished, as the Tone and native adapters do. */
  finishBoundedPlay(): void;
}

function createLoggingAdapter(): LoggingAdapter {
  const log: string[] = [];
  let now = 0;
  let onEnded: (() => void) | null = null;
  const adapter = {
    onPlaybackEnded(callback: (() => void) | null) {
      onEnded = callback;
    },
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
    finishBoundedPlay: () => onEnded?.(),
  };
}

interface Probe {
  isReady: boolean;
  isPlaying: boolean;
  setSelection: (start: number, end: number) => void;
  setCurrentTime: (time: number) => void;
  setLoopEnabled: (enabled: boolean) => void;
  stop: () => void;
  pause: () => void;
}
let probe: Probe;

const ProbeChild: React.FC = () => {
  const { isPlaying } = useIsPlaying();
  const { setSelection, setCurrentTime, setLoopEnabled, stop, pause } = usePlaylistControls();
  const { isReady } = usePlaylistTimeline();
  probe = { isReady, isPlaying, setSelection, setCurrentTime, setLoopEnabled, stop, pause };
  return null;
};

const wait = (ms: number) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

async function mount() {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const logging = createLoggingAdapter();
  const createAdapter = () => logging.adapter;
  const tracks = [makeTrack('track', 10)];
  render(
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
    >
      <ProbeChild />
      <KeyboardShortcuts playback />
      <PlayButton />
    </WaveformPlaylistProvider>
  );
  await waitFor(() => expect(probe.isReady).toBe(true));
  return logging;
}

async function pressSpace() {
  await act(async () => {
    fireEvent.keyDown(document.body, { key: ' ' });
  });
  await wait(60);
}

async function clickPlay() {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Play' }));
  });
  await wait(60);
}

/** The adapter play() call a start produced, e.g. "play(2,4)". */
const lastPlay = (log: string[]) => log.filter((entry) => entry.startsWith('play(')).pop();

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe.each([
  ['Space', pressSpace],
  ['the Play button', clickPlay],
] as const)('starting playback with %s', (_name, start) => {
  it('plays the highlighted selection, start to end', async () => {
    const { log } = await mount();
    await act(async () => {
      probe.setSelection(2, 4);
    });
    await wait(30);
    log.length = 0;

    await start();
    expect(probe.isPlaying).toBe(true);
    expect(lastPlay(log)).toBe('play(2,4)');
  });

  it('after a pause inside the selection, resumes from the cursor to the selection end', async () => {
    const { log, setNow } = await mount();
    await act(async () => {
      probe.setSelection(2, 4);
    });
    await wait(30);
    await start();
    expect(lastPlay(log)).toBe('play(2,4)');
    setNow(3);
    await wait(40);
    await act(async () => {
      probe.pause();
    });
    await wait(30);
    expect(probe.isPlaying).toBe(false);
    log.length = 0;

    await start();
    expect(probe.isPlaying).toBe(true);
    expect(lastPlay(log)).toBe('play(3,4)');
  });

  it('once the selection has played to its end, plays it again from its start', async () => {
    const { log, setNow } = await mount();
    await act(async () => {
      probe.setSelection(2, 4);
    });
    await wait(30);
    await start();
    setNow(4.05);
    await waitFor(() => expect(probe.isPlaying).toBe(false));
    log.length = 0;

    await start();
    expect(lastPlay(log)).toBe('play(2,4)');
  });

  describe('after a resume, the selection can still be played from its start', () => {
    /** Selection 2 s -> 4 s, paused at 3 s, resumed: play(3,4) is running. */
    async function resumeInsideSelection() {
      const mounted = await mount();
      await act(async () => {
        probe.setSelection(2, 4);
      });
      await wait(30);
      await start();
      mounted.setNow(3);
      await wait(40);
      await act(async () => {
        probe.pause();
      });
      await wait(30);
      await start();
      expect(lastPlay(mounted.log)).toBe('play(3,4)');
      return mounted;
    }

    it('when Stop is pressed during the resumed play', async () => {
      const { log } = await resumeInsideSelection();
      await act(async () => {
        probe.stop();
      });
      await wait(30);
      log.length = 0;

      await start();
      expect(lastPlay(log)).toBe('play(2,4)');
    });

    it('when the engine itself ends the resumed play at the selection end', async () => {
      // The Tone and native adapters report the end of a bounded play; the
      // engine then stops on its own and rewinds to where ITS play began (3 s).
      const { log, finishBoundedPlay } = await resumeInsideSelection();
      await act(async () => {
        finishBoundedPlay();
        await Promise.resolve();
      });
      await waitFor(() => expect(probe.isPlaying).toBe(false));
      log.length = 0;

      await start();
      expect(lastPlay(log)).toBe('play(2,4)');
    });
  });

  it('with the cursor outside the selection, plays the selection from its start', async () => {
    const { log } = await mount();
    await act(async () => {
      probe.setSelection(2, 4);
    });
    await wait(30);
    await act(async () => {
      probe.setCurrentTime(7);
    });
    await wait(30);
    log.length = 0;

    await start();
    expect(lastPlay(log)).toBe('play(2,4)');
  });

  it('plays from the cursor, with no end, when nothing is selected', async () => {
    const { log } = await mount();
    await act(async () => {
      probe.setCurrentTime(3);
    });
    await wait(30);
    log.length = 0;

    await start();
    expect(probe.isPlaying).toBe(true);
    expect(lastPlay(log)).toBe('play(3,)');
  });

  it('plays from the cursor when looping is on, even with a selection', async () => {
    const { log } = await mount();
    await act(async () => {
      probe.setSelection(2, 4);
      probe.setLoopEnabled(true);
    });
    await wait(30);
    await act(async () => {
      probe.setCurrentTime(1);
    });
    await wait(30);
    log.length = 0;

    await start();
    expect(probe.isPlaying).toBe(true);
    expect(lastPlay(log)).toBe('play(1,)');
  });
});

describe('Space while playing', () => {
  it('pauses, and does not restart the selection', async () => {
    const { log } = await mount();
    await act(async () => {
      probe.setSelection(2, 4);
    });
    await wait(30);
    await pressSpace();
    expect(probe.isPlaying).toBe(true);
    log.length = 0;

    await pressSpace();
    expect(probe.isPlaying).toBe(false);
    expect(lastPlay(log)).toBeUndefined();
  });
});
