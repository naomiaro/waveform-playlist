// @vitest-environment jsdom
//
// #811: the provider disposed its engine (and the adapter with it) only from
// the cleanup of the loading effect's full-build path; after any of its other
// paths an unmount disposed nothing. Since #812 there is one path: an engine
// is built on the arrangement on mount and when `effects` or the zoom levels
// change, a track edit builds nothing, and every cleanup of the build effect
// disposes. One case per remaining way the provider can be left: after a
// build, after track edits, while a build is in flight, after a failed build,
// StrictMode, an <Activity> hide, and playback across each.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { TestProvider, testArrangement } from './helpers/arrangementProvider';
import {
  useEngineRefs,
  useIsPlaying,
  usePlaybackControls,
  usePlaylistTimeline,
} from '../contexts/playlistContexts';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { Arrangement, PlayoutAdapter, PlaylistEngine } from '@waveform-playlist/engine';
import type { EffectsFunction } from '@waveform-playlist/playout';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeClip(id: string, startSample = 0): AudioClip {
  return {
    id,
    startSample,
    durationSamples: SAMPLE_RATE * 4,
    offsetSamples: 0,
    sourceDurationSamples: SAMPLE_RATE * 4,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: id, clips, muted: false, soloed: false, volume: 1, pan: 0 } as ClipTrack;
}

function makeAdapter() {
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
    setSoundFontCache: vi.fn(),
    dispose: vi.fn(),
  };
}
type FakeAdapter = ReturnType<typeof makeAdapter>;

let adapters: FakeAdapter[];
let failNextAdapter: boolean;
const createAdapter = () => {
  if (failNextAdapter) {
    failNextAdapter = false;
    throw new Error('adapter creation failed');
  }
  const adapter = makeAdapter();
  adapters.push(adapter);
  return adapter as unknown as PlayoutAdapter;
};

let engineRef: React.RefObject<PlaylistEngine | null>;
let isReady: boolean;
let isPlaying: boolean;
let play: (startTime?: number) => Promise<void>;
let arrangement: Arrangement;

const Probe: React.FC = () => {
  engineRef = useEngineRefs().playoutRef;
  isReady = usePlaylistTimeline().isReady;
  isPlaying = useIsPlaying().isPlaying;
  play = usePlaybackControls().play;
  return null;
};

// The provider on the test's arrangement; a new `effects` function builds a
// new engine on it.
const App: React.FC<{ effects?: EffectsFunction; createAdapter?: () => PlayoutAdapter }> = ({
  effects,
  createAdapter: create = createAdapter,
}) => (
  <TestProvider
    arrangement={arrangement}
    sampleRate={SAMPLE_RATE}
    createAdapter={create}
    effects={effects}
  >
    <Probe />
  </TestProvider>
);

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

const disposeCounts = () => adapters.map((adapter) => adapter.dispose.mock.calls.length);

const drums = () => makeTrack('t1', [makeClip('c1')]);
const effectsB: EffectsFunction = () => undefined;

function reset() {
  adapters = [];
  failNextAdapter = false;
  isReady = false;
  isPlaying = false;
  arrangement = testArrangement([drums()]);
}

describe('WaveformPlaylistProvider disposes its engine on unmount (#811)', () => {
  beforeEach(reset);

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('after the initial build', async () => {
    const view = render(<App />);
    await waitFor(() => expect(isReady).toBe(true));

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('after track edits (an add, a clip move, the timeline emptied): one engine, disposed once', async () => {
    const view = render(<App />);
    await waitFor(() => expect(isReady).toBe(true));

    await act(async () => {
      arrangement.addTrack(makeTrack('t2', [makeClip('c2')]));
      arrangement.moveClip('t1', 'c1', SAMPLE_RATE);
      arrangement.removeTrack('t1');
      arrangement.removeTrack('t2');
    });
    await settle();
    expect(adapters).toHaveLength(1);
    expect(adapters[0].addTrack).toHaveBeenCalledTimes(1);
    expect(adapters[0].dispose).not.toHaveBeenCalled();

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('while a build is in flight: the adapter that arrives after the unmount is disposed', async () => {
    let deliver!: () => void;
    const held = makeAdapter();
    const holding = () => {
      adapters.push(held);
      return new Promise<FakeAdapter>((resolve) => {
        deliver = () => resolve(held);
      }) as unknown as PlayoutAdapter;
    };
    const view = render(<App createAdapter={holding} />);
    await settle();
    expect(engineRef.current).toBeNull();

    view.unmount();
    await act(async () => {
      deliver();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    expect(disposeCounts()).toEqual([1]);
  });

  it('after a failed build: nothing is left to dispose, and the unmount disposes nothing twice', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<App />);
    await waitFor(() => expect(isReady).toBe(true));
    failNextAdapter = true;
    view.rerender(<App effects={effectsB} />);
    await settle();
    expect(engineRef.current).toBeNull();
    expect(disposeCounts()).toEqual([1]);

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('under StrictMode: the engine survives the mount, cleanup, mount and goes on unmount', async () => {
    const view = render(
      <StrictMode>
        <App />
      </StrictMode>
    );
    await waitFor(() => expect(isReady).toBe(true));
    const live = adapters[adapters.length - 1];
    expect(engineRef.current).not.toBeNull();
    expect(live.dispose).not.toHaveBeenCalled();
    // Every adapter but the live one was disposed (the first build was cancelled).
    expect(adapters.slice(0, -1).every((a) => a.dispose.mock.calls.length === 1)).toBe(true);

    await act(async () => {
      arrangement.addTrack(makeTrack('t2', [makeClip('c2')]));
    });
    expect(adapters[adapters.length - 1]).toBe(live);
    expect(live.dispose).not.toHaveBeenCalled();

    view.unmount();

    expect(disposeCounts().every((count) => count === 1)).toBe(true);
  });

  // An <Activity> hide runs the same cleanups as an unmount; the reveal runs
  // the build effect again. A clip edit made in the commit of the hide is the
  // arrangement's, so the rebuilt engine has it.
  it('rebuilds on an <Activity> reveal after a hide that disposed it, with the edit made meanwhile', async () => {
    const tree = (mode: 'visible' | 'hidden') => (
      <React.Activity mode={mode}>
        <App />
      </React.Activity>
    );
    const view = render(tree('visible'));
    await waitFor(() => expect(isReady).toBe(true));

    await act(async () => {
      arrangement.moveClip('t1', 'c1', SAMPLE_RATE);
      view.rerender(tree('hidden'));
    });
    await settle();
    expect(disposeCounts()).toEqual([1]);

    view.rerender(tree('visible'));
    await waitFor(() => expect(adapters).toHaveLength(2));
    await waitFor(() => expect(engineRef.current).not.toBeNull());
    expect(adapters[1].dispose).not.toHaveBeenCalled();
    // The rebuilt engine has the moved clip.
    const given = adapters[1].setTracks.mock.lastCall![0] as ClipTrack[];
    expect(given[0].clips[0].startSample).toBe(SAMPLE_RATE);
  });
});

// Maintainer's choice (2026-11-13): a provider hidden in an <Activity> during
// playback stops its audio (the engine is disposed with the hide) and resumes
// from where it was hidden when it is shown again.
describe('playback across an unmount or an <Activity> hide (#811)', () => {
  beforeEach(reset);

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const startPlayingAt = async (seconds: number) => {
    await act(async () => {
      await play(1);
    });
    expect(isPlaying).toBe(true);
    expect(adapters[0].play).toHaveBeenCalled();
    // Where the transport has got to when the provider goes away.
    adapters[0].getCurrentTime = () => seconds;
  };

  it('an unmount during playback disposes the playing adapter', async () => {
    const view = render(<App />);
    await waitFor(() => expect(isReady).toBe(true));
    await act(async () => {
      arrangement.addTrack(makeTrack('t2', [makeClip('c2')]));
    });
    await startPlayingAt(2.5);

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('a hide during playback stops the audio; the reveal resumes where it was hidden', async () => {
    const tree = (mode: 'visible' | 'hidden') => (
      <React.Activity mode={mode}>
        <App />
      </React.Activity>
    );
    const view = render(tree('visible'));
    await waitFor(() => expect(isReady).toBe(true));
    await act(async () => {
      arrangement.addTrack(makeTrack('t2', [makeClip('c2')]));
    });
    await startPlayingAt(2.5);

    view.rerender(tree('hidden'));
    await settle();
    expect(disposeCounts()).toEqual([1]);

    view.rerender(tree('visible'));
    await waitFor(() => expect(adapters).toHaveLength(2));
    await waitFor(() => expect(adapters[1].play).toHaveBeenCalled());
    expect(adapters[1].play.mock.calls[0][0]).toBe(2.5);
    expect(isPlaying).toBe(true);
    expect(adapters[1].dispose).not.toHaveBeenCalled();
  });
});

describe('adapterRef never points at a disposed adapter (#811)', () => {
  beforeEach(reset);

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // A failure to create the replacement adapter must not dispose the old one
  // a second time.
  it('a rebuild whose adapter creation fails does not dispose the old adapter again', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const view = render(<App />);
    await waitFor(() => expect(isReady).toBe(true));
    await act(async () => {
      arrangement.addTrack(makeTrack('t2', [makeClip('c2')]));
    });

    failNextAdapter = true;
    view.rerender(<App effects={effectsB} />);
    await settle();

    expect(disposeCounts()).toEqual([1]);
  });
});
