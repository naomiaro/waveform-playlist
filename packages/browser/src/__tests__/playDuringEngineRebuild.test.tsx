// @vitest-environment jsdom
//
// Play pressed while the engine is being rebuilt (#675).
//
// A `tracks` change that needs a full rebuild disposes the old engine, then
// creates the new adapter asynchronously. In that window the provider used to
// keep pointing at the DISPOSED engine: play() ran against it (a silent
// no-op on the Tone adapter), set isPlaying=true, and nothing ever started
// the new engine — "playing" UI, no audio, frozen time display.
//
// The provider is mounted with injected fake adapters (createAdapter), one
// per engine build, that record what reaches them and whether they were
// already disposed at the time.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import {
  WaveformPlaylistProvider,
  usePlaylistControls,
  usePlaylistTimeline,
  useIsPlaying,
} from '../WaveformPlaylistContext';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeClip(startSeconds: number, durationSeconds: number, id: string): AudioClip {
  return {
    id,
    startSample: Math.floor(startSeconds * SAMPLE_RATE),
    durationSamples: Math.floor(durationSeconds * SAMPLE_RATE),
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: id, clips, muted: false, soloed: false, volume: 1, pan: 0 } as ClipTrack;
}

interface FakeAdapter extends PlayoutAdapter {
  disposed: boolean;
  /** Every play() that reached this adapter. */
  playCalls: Array<{ startTime: number; endTime: number | undefined; afterDispose: boolean }>;
  /** When set, init() waits for this promise (to hold play() mid-init). */
  initGate: Promise<void> | null;
}

function createFakeAdapter(): FakeAdapter {
  let now = 0;
  const adapter: FakeAdapter = {
    disposed: false,
    playCalls: [],
    initGate: null,
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {
      if (adapter.initGate) await adapter.initGate;
    },
    setTracks() {},
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play(startTime: number, endTime?: number) {
      adapter.playCalls.push({ startTime, endTime, afterDispose: adapter.disposed });
    },
    pause() {},
    stop() {},
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
    dispose() {
      adapter.disposed = true;
    },
  };
  return adapter;
}

interface Probe {
  isPlaying: boolean;
  isReady: boolean;
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  stop: () => void;
  pause: () => void;
}

let probe: Probe;

const ProbeChild: React.FC = () => {
  const { isPlaying } = useIsPlaying();
  const { play, stop, pause } = usePlaylistControls();
  const { isReady } = usePlaylistTimeline();
  probe = { isPlaying, isReady, play, stop, pause };
  return null;
};

/** One fake adapter per engine build, in build order. */
let adapters: FakeAdapter[];
/**
 * When set, the NEXT adapter is only delivered once this resolves — the
 * stand-in for the default engine's `await import('@waveform-playlist/playout')`,
 * which is what keeps the rebuild window open in a real page.
 */
let buildGate: Promise<void> | null;
/** When set, the NEXT adapter's init() waits for this promise. */
let nextInitGate: Promise<void> | null;

function Harness({ tracks }: { tracks: ClipTrack[] }) {
  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      onTracksChange={() => {}}
      sampleRate={SAMPLE_RATE}
      indefinitePlayback
      createAdapter={() => {
        const adapter = createFakeAdapter();
        adapter.initGate = nextInitGate;
        nextInitGate = null;
        adapters.push(adapter);
        const gate = buildGate;
        buildGate = null;
        // resolvePlayoutAdapter is async, so a promise here is awaited like
        // the dynamic import would be.
        return (gate ? gate.then(() => adapter) : adapter) as PlayoutAdapter;
      }}
    >
      <ProbeChild />
    </WaveformPlaylistProvider>
  );
}

const settle = (ms = 60) => new Promise<void>((resolve) => setTimeout(resolve, ms));

// A different track OBJECT with the same id forces the full-rebuild path
// (an appended track would take the incremental path and keep the engine).
const firstTracks = () => [makeTrack('track-a', [makeClip(0, 4, 'clip-a')])];
const changedTracks = () => [makeTrack('track-a', [makeClip(0, 6, 'clip-a2')])];
const changedAgainTracks = () => [makeTrack('track-a', [makeClip(0, 8, 'clip-a3')])];

function gate(): { promise: Promise<void>; open: () => void } {
  let open!: () => void;
  const promise = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

/** Re-render with changed tracks and hold the new engine's build open. */
function startGatedRebuild(view: { rerender: (ui: React.ReactElement) => void }): () => void {
  let open!: () => void;
  buildGate = new Promise<void>((resolve) => {
    open = resolve;
  });
  act(() => {
    view.rerender(<Harness tracks={changedTracks()} />);
  });
  // The old engine is gone and the new one is not there yet.
  expect(adapters[0].disposed).toBe(true);
  expect(adapters).toHaveLength(2);
  return open;
}

async function mountReady() {
  const view = render(<Harness tracks={firstTracks()} />);
  await waitFor(() => expect(probe.isReady).toBe(true));
  expect(adapters).toHaveLength(1);
  return view;
}

describe('play() while the engine is being rebuilt (#675)', () => {
  beforeEach(() => {
    adapters = [];
    buildGate = null;
    nextInitGate = null;
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => {
      cleanup();
    });
    vi.restoreAllMocks();
  });

  it('starts on the NEW engine once it is ready, never on the disposed one', async () => {
    const view = await mountReady();

    // Tracks change → the old engine is disposed and the new adapter is
    // still being created when Play is pressed.
    const finishBuild = startGatedRebuild(view);
    await act(async () => {
      await probe.play(0);
    });
    // Nothing is playing yet, and the UI must not claim otherwise.
    expect(adapters[0].playCalls).toEqual([]);
    expect(adapters[1].playCalls).toEqual([]);
    expect(probe.isPlaying).toBe(false);

    await act(async () => {
      finishBuild();
      await settle();
    });

    expect(adapters).toHaveLength(2);
    expect(adapters[0].playCalls.filter((c) => c.afterDispose)).toEqual([]);
    expect(adapters[1].playCalls).toEqual([
      { startTime: 0, endTime: undefined, afterDispose: false },
    ]);
    expect(probe.isPlaying).toBe(true);
  });

  it('keeps the requested position and duration for the queued play', async () => {
    const view = await mountReady();

    const finishBuild = startGatedRebuild(view);
    await act(async () => {
      await probe.play(1, 0.5); // selection playback: 1 s → 1.5 s
      finishBuild();
      await settle();
    });

    expect(adapters[1].playCalls).toEqual([{ startTime: 1, endTime: 1.5, afterDispose: false }]);
    expect(probe.isPlaying).toBe(true);
  });

  it('stop() before the new engine is ready cancels the queued play', async () => {
    const view = await mountReady();

    const finishBuild = startGatedRebuild(view);
    await act(async () => {
      await probe.play(0);
      probe.stop();
      finishBuild();
      await settle();
    });

    expect(adapters[0].playCalls.filter((c) => c.afterDispose)).toEqual([]);
    expect(adapters).toHaveLength(2);
    expect(adapters[1].playCalls).toEqual([]);
    expect(probe.isPlaying).toBe(false);
  });

  it('pause() before the new engine is ready cancels the queued play', async () => {
    const view = await mountReady();

    const finishBuild = startGatedRebuild(view);
    await act(async () => {
      await probe.play(0);
      probe.pause();
      finishBuild();
      await settle();
    });

    expect(adapters[0].playCalls.filter((c) => c.afterDispose)).toEqual([]);
    expect(adapters[1].playCalls).toEqual([]);
    expect(probe.isPlaying).toBe(false);
  });

  it('a rebuild that starts while play() is awaiting init() moves the play to the new engine', async () => {
    const view = await mountReady();

    // Hold the first play inside engine.init() (AudioContext resume).
    let openGate!: () => void;
    adapters[0].initGate = new Promise<void>((resolve) => {
      openGate = resolve;
    });
    let playPromise!: Promise<void>;
    act(() => {
      playPromise = probe.play(0);
    });

    // The rebuild begins — and stays in flight — while init() is pending.
    const finishBuild = startGatedRebuild(view);
    await act(async () => {
      openGate();
      await playPromise;
    });
    expect(probe.isPlaying).toBe(false);
    await act(async () => {
      finishBuild();
      await settle();
    });

    expect(adapters).toHaveLength(2);
    expect(adapters[0].playCalls.filter((c) => c.afterDispose)).toEqual([]);
    expect(adapters[1].playCalls).toEqual([
      { startTime: 0, endTime: undefined, afterDispose: false },
    ]);
    expect(probe.isPlaying).toBe(true);
  });

  it('playback already running when the rebuild starts resumes on the new engine', async () => {
    const view = await mountReady();
    await act(async () => {
      await probe.play(0);
    });
    expect(probe.isPlaying).toBe(true);
    expect(adapters[0].playCalls).toHaveLength(1);

    const finishBuild = startGatedRebuild(view);
    await act(async () => {
      await settle();
      finishBuild();
      await settle();
    });

    expect(adapters).toHaveLength(2);
    expect(adapters[0].playCalls.filter((c) => c.afterDispose)).toEqual([]);
    expect(adapters[1].playCalls).toHaveLength(1);
    expect(probe.isPlaying).toBe(true);
  });

  it('a play that starts between the tracks commit and the rebuild effect is carried over', async () => {
    // React commits the new `tracks` and runs the rebuild effect in a LATER
    // task. A play() whose init() resolves in between starts the old engine,
    // which the effect then disposes. `isPlayingRef` is still a render behind
    // at that point, so "was it playing?" has to come from the engine itself.
    //
    // Reproducing that ordering needs real scheduling (act() flushes effects
    // before microtasks): the tracks change is made outside act(), and a
    // layout effect — which runs inside the commit — releases init().
    let openInit!: () => void;
    let setTracksOutsideAct!: (tracks: ClipTrack[]) => void;
    const StatefulHarness: React.FC = () => {
      const [tracks, setTracks] = React.useState(firstTracks);
      setTracksOutsideAct = setTracks;
      const committed = React.useRef(tracks);
      React.useLayoutEffect(() => {
        if (committed.current !== tracks) {
          committed.current = tracks;
          openInit(); // the play() continuation is now the next microtask
        }
      }, [tracks]);
      return <Harness tracks={tracks} />;
    };
    render(<StatefulHarness />);
    await waitFor(() => expect(probe.isReady).toBe(true));

    adapters[0].initGate = new Promise<void>((resolve) => {
      openInit = resolve;
    });
    let openBuild!: () => void;
    buildGate = new Promise<void>((resolve) => {
      openBuild = resolve;
    });

    const actEnvironment = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const previous = actEnvironment.IS_REACT_ACT_ENVIRONMENT;
    actEnvironment.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      void probe.play(1.5); // parked inside engine.init()
      setTracksOutsideAct(changedTracks());
      await settle(150);
      // The play reached the old engine before the effect disposed it.
      expect(adapters[0].playCalls).toEqual([
        { startTime: 1.5, endTime: undefined, afterDispose: false },
      ]);
      expect(adapters[0].disposed).toBe(true);
      openBuild();
      await settle(150);
    } finally {
      actEnvironment.IS_REACT_ACT_ENVIRONMENT = previous;
    }

    expect(adapters).toHaveLength(2);
    expect(adapters[1].playCalls).toHaveLength(1);
    expect(adapters[1].playCalls[0]).toMatchObject({ startTime: 1.5, afterDispose: false });
    expect(probe.isPlaying).toBe(true);
  });

  describe('stop / pause while a rebuild that began DURING playback is in flight', () => {
    it.each(['stop', 'pause'] as const)(
      '%s() ends playback: isPlaying resets and the new engine stays silent',
      async (control) => {
        const view = await mountReady();
        await act(async () => {
          await probe.play(0);
        });
        expect(probe.isPlaying).toBe(true);

        const finishBuild = startGatedRebuild(view);
        // No engine exists right now — the control must still take effect.
        act(() => {
          probe[control]();
        });
        expect(probe.isPlaying).toBe(false);

        await act(async () => {
          finishBuild();
          await settle();
        });
        expect(adapters[1].playCalls).toEqual([]);
        expect(probe.isPlaying).toBe(false);
      }
    );
  });

  it('a resume handed over while ITS init() was pending starts on the engine that replaced it', async () => {
    const view = await mountReady();
    await act(async () => {
      await probe.play(0);
    });

    // Rebuild 1 → engine B, whose init() (the resume's) is held open.
    const initB = gate();
    nextInitGate = initB.promise;
    await act(async () => {
      view.rerender(<Harness tracks={changedTracks()} />);
      await settle();
    });
    expect(adapters).toHaveLength(2);
    expect(adapters[1].playCalls).toEqual([]); // parked in B.init()

    // Rebuild 2 → engine C is built and assigned while B.init() is pending.
    await act(async () => {
      view.rerender(<Harness tracks={changedAgainTracks()} />);
      await settle();
    });
    expect(adapters).toHaveLength(3);

    await act(async () => {
      initB.open();
      await settle();
    });

    expect(adapters[1].playCalls).toEqual([]);
    expect(adapters[2].playCalls).toHaveLength(1);
    expect(probe.isPlaying).toBe(true);
  });

  it('stop() while play() is awaiting init() across a rebuild is final', async () => {
    const view = await mountReady();
    const init = gate();
    adapters[0].initGate = init.promise;
    let playPromise!: Promise<void>;
    act(() => {
      playPromise = probe.play(0); // parked in init()
    });
    const finishBuild = startGatedRebuild(view);
    act(() => {
      probe.stop(); // the user changed their mind
    });

    await act(async () => {
      init.open();
      await playPromise;
      finishBuild();
      await settle();
    });

    expect(adapters[1].playCalls).toEqual([]);
    expect(probe.isPlaying).toBe(false);
  });

  it('stop() while play() is awaiting init() is final without any rebuild too', async () => {
    await mountReady();
    const init = gate();
    adapters[0].initGate = init.promise;
    let playPromise!: Promise<void>;
    act(() => {
      playPromise = probe.play(0);
      probe.stop();
    });
    await act(async () => {
      init.open();
      await playPromise;
      await settle();
    });

    expect(adapters[0].playCalls).toEqual([]);
    expect(probe.isPlaying).toBe(false);
  });

  it('a newer play queued during the rebuild is not replaced by an older one finishing init()', async () => {
    const view = await mountReady();
    const init = gate();
    adapters[0].initGate = init.promise;
    let olderPlay!: Promise<void>;
    act(() => {
      olderPlay = probe.play(0); // parked in init()
    });
    const finishBuild = startGatedRebuild(view);
    await act(async () => {
      await probe.play(5); // queued for the new engine
      init.open();
      await olderPlay;
      finishBuild();
      await settle();
    });

    expect(adapters[1].playCalls).toEqual([
      { startTime: 5, endTime: undefined, afterDispose: false },
    ]);
  });

  it('a play that outlives a FAILED build is dropped, not replayed on a later rebuild', async () => {
    const view = await mountReady();
    const init = gate();
    adapters[0].initGate = init.promise;
    let playPromise!: Promise<void>;
    act(() => {
      playPromise = probe.play(0); // parked in init()
    });

    // The rebuild fails: no engine is coming.
    buildGate = Promise.reject(new Error('adapter failed to load'));
    buildGate.catch(() => {});
    await act(async () => {
      view.rerender(<Harness tracks={changedTracks()} />);
      await settle();
    });
    await act(async () => {
      init.open();
      await playPromise;
      await settle();
    });

    // A later, successful rebuild must not start playback by itself.
    await act(async () => {
      view.rerender(<Harness tracks={changedAgainTracks()} />);
      await settle();
    });
    const last = adapters[adapters.length - 1];
    expect(last.disposed).toBe(false);
    expect(last.playCalls).toEqual([]);
    expect(probe.isPlaying).toBe(false);
  });

  it('play() with no rebuild in flight still starts immediately', async () => {
    await mountReady();
    await act(async () => {
      await probe.play(2);
    });

    expect(adapters[0].playCalls).toEqual([
      { startTime: 2, endTime: undefined, afterDispose: false },
    ]);
    expect(probe.isPlaying).toBe(true);
  });
});
