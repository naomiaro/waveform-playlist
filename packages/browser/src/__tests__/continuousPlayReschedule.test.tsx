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
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
  useCurrentTime,
  useActiveAnnotation,
  usePlaybackControls,
  usePlaylistTimeline,
  useAnnotationOptions,
  useIsPlaying,
} from '../contexts/playlistContexts';
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
  currentTime: number;
  continuousPlay: boolean;
  activeAnnotationId: string | null;
  duration: number;
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  setContinuousPlay: (enabled: boolean) => void;
  setSelection: (start: number, end: number) => void;
  stop: () => void;
}
let probe: Probe;

const ProbeChild: React.FC = () => {
  const { isPlaying } = useIsPlaying();
  const { currentTime } = useCurrentTime();
  const { play, setContinuousPlay, setSelection, stop } = usePlaybackControls();
  const { isReady, duration } = usePlaylistTimeline();
  const { continuousPlay } = useAnnotationOptions();
  const { activeAnnotationId } = useActiveAnnotation();
  probe = {
    isReady,
    isPlaying,
    currentTime,
    continuousPlay,
    activeAnnotationId,
    duration,
    play,
    setContinuousPlay,
    setSelection,
    stop,
  };
  return null;
};

const ANNOTATIONS: AnnotationData[] = [
  { id: 'a', start: 1, end: 2, lines: ['one'] },
  { id: 'b', start: 3, end: 4, lines: ['two'] },
];
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
    await wait(40); // let a frame read the new time
    // The loop has seen a frame inside the annotation.
    await waitFor(() => expect(probe.activeAnnotationId).toBe('a'));
    log.length = 0;

    await act(async () => {
      probe.setContinuousPlay(true);
    });
    await wait(60);
    expect(probe.continuousPlay).toBe(true);
    expect(probe.isPlaying).toBe(true);
    expect(log).toEqual(['stop', 'play(1.5,)']);

    // ...and playback really does run past the annotation's end (2 s): a frame
    // at 2.5 s clears the active annotation and does not stop.
    log.length = 0;
    setNow(2.5);
    await waitFor(() => expect(probe.activeAnnotationId).toBeNull());
    expect(probe.isPlaying).toBe(true);
    expect(log).toEqual([]);
  });

  it('a bounded play over an annotation that is not its end keeps its own end', async () => {
    // play(1.2, 0.5) with no selection highlighted: 1.2 s -> 1.7 s, inside
    // annotation "a" (1 s -> 2 s), which is therefore the active annotation.
    const { log, setNow } = await mount(false);
    await act(async () => {
      await probe.play(1.2, 0.5);
    });
    await wait(60);
    setNow(1.4);
    await wait(40);
    await waitFor(() => expect(probe.activeAnnotationId).toBe('a'));
    log.length = 0;

    await act(async () => {
      probe.setContinuousPlay(true);
    });
    await wait(60);
    expect(log).toEqual(['stop', 'play(1.4,1.7)']);

    setNow(1.8);
    await waitFor(() => expect(probe.isPlaying).toBe(false));
  });

  it('a bounded play that is not on an annotation keeps its end', async () => {
    // e.g. playing a selection, 4 s -> 6 s, away from the annotation.
    const { log, setNow } = await mount(false);
    await act(async () => {
      await probe.play(4, 2);
    });
    await wait(60);
    setNow(5);
    await wait(40);
    expect(probe.activeAnnotationId).toBeNull();
    log.length = 0;

    await act(async () => {
      probe.setContinuousPlay(true);
    });
    await wait(60);
    expect(log).toEqual(['stop', 'play(5,6)']);

    setNow(6.5);
    await waitFor(() => expect(probe.isPlaying).toBe(false));
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

  describe('while the selection is playing, continuous play has no effect', () => {
    /** Highlights 1.5 s -> 4 s and plays it, as the Play button does. */
    async function playSelection(continuous: boolean) {
      const mounted = await mount(continuous);
      await act(async () => {
        probe.setSelection(1.5, 4);
      });
      await wait(30);
      mounted.log.length = 0;
      await act(async () => {
        await probe.play(1.5, 2.5);
      });
      await wait(60);
      expect(mounted.log).toEqual(['stop', 'play(1.5,4)']);
      mounted.log.length = 0;
      return mounted;
    }

    it.each([false, true])(
      'the selection plays to its end across an annotation boundary (continuous play %s)',
      async (continuous) => {
        // Annotation "a" ends at 2 s, inside the selection. With continuous play
        // off, playback used to be cut there.
        const { setNow } = await playSelection(continuous);
        for (const time of [1.9, 2.1, 3.9]) {
          setNow(time);
          await wait(60);
          expect(probe.isPlaying).toBe(true);
        }
        setNow(4.1);
        await waitFor(() => expect(probe.isPlaying).toBe(false));
      }
    );

    it.each([false, true])(
      'switching the toggle midway (from %s) does not touch the audio or the end',
      async (continuous) => {
        const { log, setNow } = await playSelection(continuous);
        setNow(1.8);
        await wait(40);

        await act(async () => {
          probe.setContinuousPlay(!continuous);
        });
        await wait(60);
        expect(log).toEqual([]);

        setNow(2.5); // past annotation "a"
        await wait(60);
        expect(probe.isPlaying).toBe(true);
        setNow(4.1);
        await waitFor(() => expect(probe.isPlaying).toBe(false));
      }
    );

    it('the active annotation still follows the playhead', async () => {
      const { setNow } = await playSelection(false);
      setNow(1.8);
      await waitFor(() => expect(probe.activeAnnotationId).toBe('a'));
      setNow(2.5); // gap between annotations
      await waitFor(() => expect(probe.activeAnnotationId).toBeNull());
      setNow(3.2);
      await waitFor(() => expect(probe.activeAnnotationId).toBe('b'));
    });
  });

  describe('an annotation played while a selection is highlighted elsewhere', () => {
    /** Selection 5 s -> 6 s stays highlighted; annotation "a" (1 s -> 2 s) is played. */
    async function playAnnotationA(continuous: boolean) {
      const mounted = await mount(continuous);
      await act(async () => {
        probe.setSelection(5, 6);
      });
      await wait(30);
      mounted.log.length = 0;
      await act(async () => {
        // What a click on the annotation does: bounded only when continuous play is off.
        await probe.play(1, continuous ? undefined : 1);
      });
      await wait(60);
      mounted.setNow(1.5);
      await wait(40);
      await waitFor(() => expect(probe.activeAnnotationId).toBe('a'));
      return mounted;
    }

    it('continuous play off: stops at the annotation end, highlight stays on it', async () => {
      const { setNow } = await playAnnotationA(false);
      setNow(2.05);
      await waitFor(() => expect(probe.isPlaying).toBe(false));
      // The highlight does not move on at the stopping frame.
      expect(probe.activeAnnotationId).toBe('a');
    });

    it('continuous play on: plays on past the annotation', async () => {
      const { setNow } = await playAnnotationA(true);
      setNow(2.5);
      await waitFor(() => expect(probe.activeAnnotationId).toBeNull());
      expect(probe.isPlaying).toBe(true);
    });

    it('ticking continuous play midway extends it, selection or not', async () => {
      const { log, setNow } = await playAnnotationA(false);
      log.length = 0;
      await act(async () => {
        probe.setContinuousPlay(true);
      });
      await wait(60);
      expect(log).toEqual(['stop', 'play(1.5,)']);

      setNow(2.5);
      await waitFor(() => expect(probe.activeAnnotationId).toBeNull());
      expect(probe.isPlaying).toBe(true);
    });
  });

  describe('resuming inside the selection', () => {
    it('a play from inside the selection to its end is still selection playback', async () => {
      // What Space and the Play button do after a pause part-way through:
      // selection 1.5 s -> 4 s, resumed at 1.8 s. Annotation "a" ends at 2 s
      // and must not cut it, continuous play being off.
      const { log, setNow } = await mount(false);
      await act(async () => {
        probe.setSelection(1.5, 4);
      });
      await wait(30);
      log.length = 0;
      await act(async () => {
        await probe.play(1.8, 2.2);
      });
      await wait(60);
      expect(log).toEqual(['stop', 'play(1.8,4)']);
      for (const time of [1.9, 2.1, 3.9]) {
        setNow(time);
        await wait(60);
        expect(probe.isPlaying).toBe(true);
      }
      setNow(4.1);
      await waitFor(() => expect(probe.isPlaying).toBe(false));
    });
  });

  describe('where playback leaves the cursor and the highlight', () => {
    it('an annotation played with continuous play off returns the cursor to its start', async () => {
      const { setNow } = await mount(false);
      await act(async () => {
        await probe.play(1, 1); // annotation "a": 1 s -> 2 s
      });
      await wait(60);
      setNow(1.5);
      await waitFor(() => expect(probe.activeAnnotationId).toBe('a'));

      setNow(2.05);
      await waitFor(() => expect(probe.isPlaying).toBe(false));
      // Ready to play the same annotation again.
      expect(probe.currentTime).toBe(1);
    });

    it('the selection finishing returns the cursor to the selection start', async () => {
      const { setNow } = await mount(false);
      await act(async () => {
        probe.setSelection(1.5, 3);
      });
      await wait(30);
      await act(async () => {
        await probe.play(1.5, 1.5);
      });
      await wait(60);
      setNow(3.05);
      await waitFor(() => expect(probe.isPlaying).toBe(false));
      expect(probe.currentTime).toBe(1.5);
    });

    it('Stop pressed while stopped leaves a cursor placed since the last play where it is', async () => {
      const { setNow } = await mount(false);
      await act(async () => {
        probe.setSelection(1.5, 3);
      });
      await wait(30);
      await act(async () => {
        await probe.play(1.5, 1.5);
      });
      await wait(60);
      setNow(3.05);
      await waitFor(() => expect(probe.isPlaying).toBe(false));

      await act(async () => {
        probe.setSelection(7, 7); // click elsewhere while stopped
      });
      await wait(30);
      expect(probe.currentTime).toBe(7);
      await act(async () => {
        probe.stop(); // e.g. Escape
      });
      await wait(30);
      expect(probe.currentTime).toBe(7);
    });

    it('selection playback ending where an annotation starts does not highlight it', async () => {
      // Selection 1.5 s -> 3 s; annotation "b" starts at 3 s.
      const { setNow } = await mount(false);
      await act(async () => {
        probe.setSelection(1.5, 3);
      });
      await wait(30);
      await act(async () => {
        await probe.play(1.5, 1.5);
      });
      await wait(60);
      setNow(2.5); // gap between "a" and "b"
      await waitFor(() => expect(probe.activeAnnotationId).toBeNull());

      setNow(3.05); // the stopping frame, already inside "b"
      await waitFor(() => expect(probe.isPlaying).toBe(false));
      expect(probe.activeAnnotationId).toBeNull();
    });
  });

  describe('changing the selection during playback', () => {
    it('moving the cursor past the old end keeps playing from there', async () => {
      const { log, setNow } = await mount(false);
      await act(async () => {
        probe.setSelection(5, 6);
      });
      await wait(30);
      await act(async () => {
        await probe.play(5, 1);
      });
      await wait(60);
      setNow(5.5);
      await wait(40);
      log.length = 0;

      await act(async () => {
        probe.setSelection(8, 8); // a click further along the timeline
      });
      await wait(60);
      expect(log).toEqual(['stop', 'play(8,)']);
      setNow(8.3);
      await wait(60);
      expect(probe.isPlaying).toBe(true);
    });

    it('moving the cursor away from a playing annotation keeps playing from there', async () => {
      // Continuous play off, annotation "a" (1 s -> 2 s) playing and active.
      const { log, setNow } = await mount(false);
      await act(async () => {
        await probe.play(1, 1);
      });
      await wait(60);
      setNow(1.5);
      await wait(40);
      await waitFor(() => expect(probe.activeAnnotationId).toBe('a'));
      log.length = 0;

      await act(async () => {
        probe.setSelection(8, 8);
      });
      await wait(60);
      expect(log).toEqual(['stop', 'play(8,)']);
      // The annotation left behind must not stop playback, nor pull the cursor back.
      setNow(8.3);
      await wait(80);
      expect(probe.isPlaying).toBe(true);
      expect(probe.activeAnnotationId).toBeNull();
    });

    it('moving the cursor away from a selection playing over an annotation keeps playing', async () => {
      const { setNow } = await mount(false);
      await act(async () => {
        probe.setSelection(1.5, 4);
      });
      await wait(30);
      await act(async () => {
        await probe.play(1.5, 2.5);
      });
      await wait(60);
      setNow(1.8);
      await wait(40);
      await waitFor(() => expect(probe.activeAnnotationId).toBe('a'));

      await act(async () => {
        probe.setSelection(8, 8);
      });
      await wait(60);
      setNow(8.3);
      await wait(80);
      expect(probe.isPlaying).toBe(true);
    });

    it('a new selection made during playback plays from its start to its end', async () => {
      // Something else is playing (annotation "a"); a range is then selected,
      // for example by typing new selection times.
      const { log, setNow } = await mount(false);
      await act(async () => {
        await probe.play(1, 1);
      });
      await wait(60);
      setNow(1.5);
      await wait(40);
      log.length = 0;

      await act(async () => {
        probe.setSelection(1.6, 3.5);
      });
      await wait(60);
      expect(log).toEqual(['stop', 'play(1.6,3.5)']);
      // It is selection playback: not cut at the end of annotation "a" (2 s)
      // although continuous play is off...
      for (const time of [1.9, 2.1, 3.4]) {
        setNow(time);
        await wait(60);
        expect(probe.isPlaying).toBe(true);
      }
      // ...and it stops at the new selection's end.
      setNow(3.55);
      await waitFor(() => expect(probe.isPlaying).toBe(false));
    });

    it('ends selection playback: continuous play applies again', async () => {
      // Playing selection 1.5 s -> 4 s, then the cursor is moved to 1.2 s.
      const { setNow } = await mount(false);
      await act(async () => {
        probe.setSelection(1.5, 4);
      });
      await wait(30);
      await act(async () => {
        await probe.play(1.5, 2.5);
      });
      await wait(60);
      setNow(1.8);
      await wait(40);

      await act(async () => {
        probe.setSelection(1.2, 1.2);
      });
      await wait(60);
      setNow(1.6);
      await waitFor(() => expect(probe.activeAnnotationId).toBe('a'));
      expect(probe.isPlaying).toBe(true);
      // No longer the selection playing, and continuous play is off:
      // playback stops at the end of annotation "a" (2 s).
      setNow(2.05);
      await waitFor(() => expect(probe.isPlaying).toBe(false));
    });
  });
});
