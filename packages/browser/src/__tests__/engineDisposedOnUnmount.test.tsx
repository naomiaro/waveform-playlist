// @vitest-environment jsdom
//
// #811: the provider disposed its engine (and the adapter with it) only from
// the cleanup of the loading effect's full-build path. The other paths of that
// effect (an engine clip operation, an incremental add or placeholder fill,
// the emptied timeline with the engine kept, a deferred rebuild) return no
// cleanup, so after any of them an unmount disposed nothing: the AudioContext
// stayed open and, on the Tone path, the transport kept running.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { StrictMode, useState } from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
  useEngineRefs,
  useIsPlaying,
  usePlaybackControls,
  usePlaylistTimeline,
} from '../contexts/playlistContexts';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter, PlaylistEngine } from '@waveform-playlist/engine';

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
let setAppTracks: (tracks: ClipTrack[]) => void;

const Probe: React.FC = () => {
  engineRef = useEngineRefs().playoutRef;
  isReady = usePlaylistTimeline().isReady;
  isPlaying = useIsPlaying().isPlaying;
  play = usePlaybackControls().play;
  return null;
};

// An app that keeps `tracks` in state and stores what the provider reports, so
// an engine clip operation comes back as the engine's own array.
const App: React.FC<{
  initial: ClipTrack[];
  deferEngineRebuild?: boolean;
  soundFontCache?: unknown;
}> = ({ initial, deferEngineRebuild, soundFontCache }) => {
  const [tracks, setTracks] = useState<ClipTrack[]>(initial);
  setAppTracks = setTracks;
  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      onTracksChange={setTracks}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
      deferEngineRebuild={deferEngineRebuild}
      soundFontCache={soundFontCache as never}
    >
      <Probe />
    </WaveformPlaylistProvider>
  );
};

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

const disposeCounts = () => adapters.map((adapter) => adapter.dispose.mock.calls.length);

const drums = () => makeTrack('t1', [makeClip('c1')]);

describe('WaveformPlaylistProvider disposes its engine on unmount (#811)', () => {
  beforeEach(() => {
    adapters = [];
    failNextAdapter = false;
    isReady = false;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // Control: the path that worked before #811.
  it('after the initial build', async () => {
    const view = render(<App initial={[drums()]} />);
    await waitFor(() => expect(isReady).toBe(true));

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('after a track is appended (incremental add)', async () => {
    const t1 = drums();
    const view = render(<App initial={[t1]} />);
    await waitFor(() => expect(isReady).toBe(true));

    await act(async () => {
      setAppTracks([t1, makeTrack('t2', [makeClip('c2')])]);
    });
    await settle();
    expect(adapters).toHaveLength(1);
    expect(adapters[0].addTrack).toHaveBeenCalledTimes(1);

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('after a placeholder track gets its clips (incremental fill)', async () => {
    const t1 = drums();
    const placeholder = makeTrack('t2', []);
    const view = render(<App initial={[t1, placeholder]} />);
    await waitFor(() => expect(isReady).toBe(true));

    await act(async () => {
      setAppTracks([t1, { ...placeholder, clips: [makeClip('c2')] }]);
    });
    await settle();
    expect(adapters).toHaveLength(1);
    expect(adapters[0].updateTrack).toHaveBeenCalledTimes(1);

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('after an engine clip operation (the tracks come back from the engine)', async () => {
    const view = render(<App initial={[drums()]} />);
    await waitFor(() => expect(isReady).toBe(true));

    await act(async () => {
      engineRef.current!.moveClip('t1', 'c1', SAMPLE_RATE);
    });
    await settle();
    expect(adapters).toHaveLength(1);

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('after the timeline is emptied with the engine kept', async () => {
    const t1 = drums();
    const view = render(<App initial={[t1]} />);
    await waitFor(() => expect(isReady).toBe(true));
    // An incremental change first, so the run before the emptying returned no
    // cleanup and the emptying takes the keep-the-engine branch.
    await act(async () => {
      setAppTracks([t1, makeTrack('t2', [makeClip('c2')])]);
    });
    await act(async () => {
      setAppTracks([]);
    });
    await settle();
    expect(adapters).toHaveLength(1);

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('while a rebuild is deferred', async () => {
    const t1 = drums();
    const view = render(<App initial={[t1]} />);
    await waitFor(() => expect(isReady).toBe(true));
    await act(async () => {
      setAppTracks([t1, makeTrack('t2', [makeClip('c2')])]);
    });
    // A change that would rebuild, made while rebuilds are deferred.
    view.rerender(<App initial={[t1]} deferEngineRebuild />);
    await act(async () => {
      setAppTracks([{ ...t1, clips: [makeClip('c1', SAMPLE_RATE)] }]);
    });
    await settle();
    expect(adapters).toHaveLength(1);

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('under StrictMode: the engine survives the mount, cleanup, mount and goes on unmount', async () => {
    const t1 = drums();
    const view = render(
      <StrictMode>
        <App initial={[t1]} />
      </StrictMode>
    );
    await waitFor(() => expect(isReady).toBe(true));
    const live = adapters[adapters.length - 1];
    expect(engineRef.current).not.toBeNull();
    expect(live.dispose).not.toHaveBeenCalled();
    // Every adapter but the live one was disposed (the first build was cancelled).
    expect(adapters.slice(0, -1).every((a) => a.dispose.mock.calls.length === 1)).toBe(true);

    await act(async () => {
      setAppTracks([t1, makeTrack('t2', [makeClip('c2')])]);
    });
    expect(adapters[adapters.length - 1]).toBe(live);
    expect(live.dispose).not.toHaveBeenCalled();

    view.unmount();

    expect(disposeCounts().every((count) => count === 1)).toBe(true);
  });

  // An <Activity> hide runs the same cleanups as an unmount. On reveal React
  // runs each effect again with the closure of the LATEST render, also when
  // its dependencies did not change. Here that render is the engine clip
  // operation's (made in the commit of the hide), whose path returns early;
  // with the engine gone it must build one instead.
  it('rebuilds on an <Activity> reveal after a hide that disposed it', async () => {
    const tree = (mode: 'visible' | 'hidden') => (
      <React.Activity mode={mode}>
        <App initial={[drums()]} />
      </React.Activity>
    );
    const view = render(tree('visible'));
    await waitFor(() => expect(isReady).toBe(true));

    await act(async () => {
      engineRef.current!.moveClip('t1', 'c1', SAMPLE_RATE);
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

  // A deferred rebuild builds nothing, so after a hide that disposed the
  // engine the view is not ready until the deferral ends, as on a mount with
  // deferEngineRebuild set (it must not say ready with no engine to play).
  it('an <Activity> reveal while a rebuild is deferred is not ready until the deferral ends', async () => {
    const t1 = drums();
    const tree = (mode: 'visible' | 'hidden', defer: boolean) => (
      <React.Activity mode={mode}>
        <App initial={[t1]} deferEngineRebuild={defer} />
      </React.Activity>
    );
    const view = render(tree('visible', false));
    await waitFor(() => expect(isReady).toBe(true));
    view.rerender(tree('visible', true));
    await act(async () => {
      setAppTracks([t1, makeTrack('t2', [makeClip('c2')])]);
    });
    await settle();

    view.rerender(tree('hidden', true));
    await settle();
    view.rerender(tree('visible', true));
    await settle();
    expect(engineRef.current).toBeNull();
    expect(isReady).toBe(false);

    view.rerender(tree('visible', false));
    await waitFor(() => expect(isReady).toBe(true));
    expect(engineRef.current).not.toBeNull();
    expect(adapters).toHaveLength(2);
    expect(disposeCounts()).toEqual([1, 0]);
  });
});

// Maintainer's choice (2026-11-13): a provider hidden in an <Activity> during
// playback stops its audio (the engine is disposed with the hide) and resumes
// from where it was hidden when it is shown again.
describe('playback across an unmount or an <Activity> hide (#811)', () => {
  beforeEach(() => {
    adapters = [];
    failNextAdapter = false;
    isReady = false;
    isPlaying = false;
  });

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
    const t1 = drums();
    const view = render(<App initial={[t1]} />);
    await waitFor(() => expect(isReady).toBe(true));
    await act(async () => {
      setAppTracks([t1, makeTrack('t2', [makeClip('c2')])]);
    });
    await startPlayingAt(2.5);

    view.unmount();

    expect(disposeCounts()).toEqual([1]);
  });

  it('a hide during playback stops the audio; the reveal resumes where it was hidden', async () => {
    const t1 = drums();
    const tree = (mode: 'visible' | 'hidden') => (
      <React.Activity mode={mode}>
        <App initial={[t1]} />
      </React.Activity>
    );
    const view = render(tree('visible'));
    await waitFor(() => expect(isReady).toBe(true));
    await act(async () => {
      setAppTracks([t1, makeTrack('t2', [makeClip('c2')])]);
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
  beforeEach(() => {
    adapters = [];
    failNextAdapter = false;
    isReady = false;
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  // The failed-load path disposes `adapterRef.current` when no engine was
  // built. A full build's cleanup cleared the ref, but a rebuild that follows
  // a run with no cleanup (here an incremental add) disposed the old engine
  // inside loadAudio without clearing it, so a failure to create the
  // replacement disposed the old adapter a second time.
  it('a rebuild whose adapter creation fails does not dispose the old adapter again', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const t1 = drums();
    const t2 = makeTrack('t2', [makeClip('c2')]);
    render(<App initial={[t1]} />);
    await waitFor(() => expect(isReady).toBe(true));
    await act(async () => {
      setAppTracks([t1, t2]);
    });

    failNextAdapter = true;
    await act(async () => {
      setAppTracks([{ ...t1, clips: [makeClip('c1', SAMPLE_RATE)] }, t2]);
    });
    await settle();

    expect(disposeCounts()).toEqual([1]);
  });
});
