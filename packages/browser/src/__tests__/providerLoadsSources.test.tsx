// @vitest-environment jsdom
//
// #812: a clip in the app's `tracks` may name its audio (a `LoadingClip`), and
// `WaveformPlaylistProvider` loads it. The app's `tracks` never change because
// a buffer arrived; the engine, the adapter and every context value only ever
// see resolved `AudioClip`s.
//
// Each case asserts through what reached the fake adapter, the number of
// `waveform-playlist:ready` events on `window` (one per FULL engine build),
// the calls of the fake `loadSource` (every call is kept pending until the
// test settles it) and what `onTracksChange` received.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../workers/peaksWorker', () => ({
  // Peaks are not the subject: a worker whose jobs never finish.
  createPeaksWorker: () => ({
    generate: () => new Promise(() => {}),
    isTerminated: () => false,
    terminate: () => {},
  }),
}));

// The status value has no context yet (a later step adds the hook). Until
// then the tests read what the provider's own call of the hook returned.
const captured = vi.hoisted(() => ({
  status: null as null | import('../providerInternals/useSourceLoading').SourceLoadingStatus,
}));
vi.mock('../providerInternals/useSourceLoading', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../providerInternals/useSourceLoading')>();
  return {
    ...actual,
    useSourceLoading: (options: Parameters<typeof actual.useSourceLoading>[0]) => {
      const value = actual.useSourceLoading(options);
      captured.status = value.status;
      return value;
    },
  };
});

import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
  useEngineRefs,
  useIsPlaying,
  usePlaybackControls,
  usePlaylistMixer,
  usePlaylistTimeline,
  useUndoRedo,
  type EngineRefsContextValue,
  type PlaybackControlsContextValue,
  type PlaylistTimelineContextValue,
} from '../contexts/playlistContexts';
import type { TrackState } from '../WaveformPlaylistContext';
import type {
  AudioClip,
  ClipSource,
  ClipTrack,
  LoadingClip,
  PlaylistTrack,
} from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { LoadSource } from '../utils/loadSource';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function fakeBuffer(seconds = 2): AudioBuffer {
  return {
    sampleRate: SAMPLE_RATE,
    length: SAMPLE_RATE * seconds,
    duration: seconds,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(SAMPLE_RATE * seconds),
  } as unknown as AudioBuffer;
}

/** A loaded clip the app made itself: no `src`, no buffer, two seconds long. */
function plainClip(id: string): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: SAMPLE_RATE * 2,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SAMPLE_RATE * 2,
    gain: 1,
  } as AudioClip;
}

function track(id: string, clips: (AudioClip | LoadingClip)[], over: object = {}): PlaylistTrack {
  return {
    id,
    name: id,
    kind: 'audio',
    clips,
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
    ...over,
  } as PlaylistTrack;
}

function plainTrack(id: string): PlaylistTrack {
  return track(id, [plainClip(id + '-clip')]);
}

function loadingClip(id: string, src: ClipSource, over: Partial<LoadingClip> = {}): LoadingClip {
  return { id, src, ...over };
}

function loadingTrack(id: string, src: ClipSource, over: Partial<LoadingClip> = {}) {
  return track(id, [loadingClip(id + '-clip', src, over)]);
}

interface PendingCall {
  src: ClipSource;
  signal: AbortSignal;
  resolve: (buffer: AudioBuffer) => void;
  reject: (error: Error) => void;
}

/** A `loadSource` that keeps every call pending until the test settles it. */
function heldLoadSource() {
  const calls: PendingCall[] = [];
  const loadSource: LoadSource = (src, { signal }) =>
    new Promise<AudioBuffer>((resolve, reject) => {
      calls.push({ src, signal, resolve, reject });
    });
  return { calls, loadSource };
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
    setTracks: vi.fn<(tracks: ClipTrack[]) => void>(),
    addTrack: vi.fn<(track: ClipTrack) => void>(),
    removeTrack: vi.fn(),
    updateTrack: vi.fn<(id: string, track: ClipTrack) => void>(),
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
  };
}
type FakeAdapter = ReturnType<typeof createFakeAdapter>;

let probe: {
  timeline: PlaylistTimelineContextValue;
  trackStates: TrackState[];
  canUndo: boolean;
  isPlaying: boolean;
  controls: PlaybackControlsContextValue;
  refs: EngineRefsContextValue;
};
let probeRenders = 0;

const Probe: React.FC = () => {
  probeRenders++;
  probe = {
    timeline: usePlaylistTimeline(),
    trackStates: usePlaylistMixer().trackStates,
    canUndo: useUndoRedo().canUndo,
    isPlaying: useIsPlaying().isPlaying,
    controls: usePlaybackControls(),
    refs: useEngineRefs(),
  };
  return null;
};

let readyEvents = 0;
const countReady = () => {
  readyEvents++;
};

interface MountOptions {
  loadSource?: LoadSource;
  /** One fake adapter per call when given; else one shared adapter. */
  createAdapter?: () => PlayoutAdapter;
  strict?: boolean;
  /** The app stores what `onTracksChange` hands it (default true). */
  store?: boolean;
  wrap?: (ui: React.ReactElement) => React.ReactElement;
}

function mount(initial: PlaylistTrack[], options: MountOptions = {}) {
  const adapter = createFakeAdapter();
  const createAdapter = vi.fn(
    options.createAdapter ?? (() => adapter as unknown as PlayoutAdapter)
  );
  const onReady = vi.fn();
  const onError = vi.fn<(error: Error) => void>();
  let current = initial;
  let rerender = () => {};
  const onTracksChange = vi.fn((next: PlaylistTrack[]) => {
    if (options.store === false) return;
    current = next;
    rerender();
  });
  const ui = () => {
    const provider = (
      <WaveformPlaylistProvider
        tracks={current}
        onTracksChange={onTracksChange}
        loadSource={options.loadSource}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
        onReady={onReady}
        onError={onError}
      >
        <Probe />
      </WaveformPlaylistProvider>
    );
    const wrapped = options.wrap ? options.wrap(provider) : provider;
    return options.strict ? <StrictMode>{wrapped}</StrictMode> : wrapped;
  };
  const view = render(ui());
  rerender = () => view.rerender(ui());
  return {
    adapter,
    createAdapter,
    onReady,
    onError,
    onTracksChange,
    unmount: view.unmount,
    tracks: () => current,
    setTracks: (next: PlaylistTrack[]) => {
      current = next;
      rerender();
    },
    rerender: () => rerender(),
  };
}

async function ready() {
  await waitFor(() => expect(probe.timeline.isReady).toBe(true));
}

/** Let awaited adapters, decode contexts and the promise chains after them run. */
async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

/** The clip lists the adapter was given by its latest full build. */
function builtClips(adapter: FakeAdapter): AudioClip[][] {
  const built = adapter.setTracks.mock.lastCall?.[0] ?? [];
  return built.map((t) => t.clips);
}

beforeEach(() => {
  readyEvents = 0;
  probeRenders = 0;
  captured.status = null;
  window.addEventListener('waveform-playlist:ready', countReady);
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  window.removeEventListener('waveform-playlist:ready', countReady);
  vi.restoreAllMocks();
});

describe('the first load', () => {
  it('1: mounted with two loading tracks, nothing reaches the adapter until both settle; then ONE build', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(m.adapter.setTracks).not.toHaveBeenCalled();

    const bufferA = fakeBuffer();
    await act(async () => {
      calls[0].resolve(bufferA);
    });
    await flush();
    expect(m.adapter.setTracks).not.toHaveBeenCalled();
    expect(m.adapter.addTrack).not.toHaveBeenCalled();
    expect(readyEvents).toBe(0);
    expect(probe.timeline.isReady).toBe(false);

    await act(async () => {
      calls[1].resolve(fakeBuffer());
    });
    await ready();

    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(builtClips(m.adapter).map((clips) => clips.length)).toEqual([1, 1]);
    expect(builtClips(m.adapter)[0][0].audioBuffer).toBe(bufferA);
    expect(builtClips(m.adapter)[0][0].src).toBe('/a.mp3');
    expect(readyEvents).toBe(1);
    expect(m.onReady).toHaveBeenCalledTimes(1);
    // The adapter that gave the decode context is the one the build used.
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(m.adapter.dispose).not.toHaveBeenCalled();
    expect(m.adapter.addTrack).not.toHaveBeenCalled();
    expect(m.adapter.updateTrack).not.toHaveBeenCalled();
    // A buffer arriving never reaches the app.
    expect(m.onTracksChange).not.toHaveBeenCalled();
  });

  it('1c: a later full rebuild makes one more adapter: createAdapter calls equal builds', async () => {
    const { calls, loadSource } = heldLoadSource();
    const adapters: FakeAdapter[] = [];
    const a = loadingTrack('a', '/a.mp3');
    const b = plainTrack('b');
    const m = mount([a, b], {
      loadSource,
      createAdapter: () => {
        const next = createFakeAdapter();
        adapters.push(next);
        return next as unknown as PlayoutAdapter;
      },
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await ready();
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(readyEvents).toBe(1);

    // A track removed: a full rebuild.
    await act(async () => {
      m.setTracks([a]);
    });
    await waitFor(() => expect(readyEvents).toBe(2));
    expect(m.createAdapter).toHaveBeenCalledTimes(2);
    expect(adapters[0].dispose).toHaveBeenCalledTimes(1);
    expect(adapters[1].setTracks).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
  });

  it('1b: mounted with NO tracks, each track appended later arrives on its own', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([], { loadSource });
    await ready();
    expect(readyEvents).toBe(1);

    const a = loadingTrack('a', '/a.mp3');
    const b = loadingTrack('b', '/b.mp3');
    await act(async () => {
      m.setTracks([a, b]);
    });
    // Each enters at once as a track with no clips.
    expect(m.adapter.addTrack.mock.calls.map(([t]) => [t.id, t.clips.length])).toEqual([
      ['a', 0],
      ['b', 0],
    ]);
    await waitFor(() => expect(calls).toHaveLength(2));

    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    // The first has its clip while the second is still pending.
    expect(m.adapter.updateTrack.mock.calls.map(([id, t]) => [id, t.clips.length])).toEqual([
      ['a', 1],
    ]);
    expect(calls[1].signal.aborted).toBe(false);

    await act(async () => {
      calls[1].resolve(fakeBuffer());
    });
    expect(m.adapter.updateTrack.mock.calls.map(([id, t]) => [id, t.clips.length])).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
    expect(readyEvents).toBe(1);
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(m.adapter.dispose).not.toHaveBeenCalled();
  });

  it('1d: mounted with NO tracks, a track named before the first build has finished does not hold it back', async () => {
    const { calls, loadSource } = heldLoadSource();
    // One adapter per build attempt, each still on its way (as the dynamic
    // import of the default engine is). The track arrives while the build for
    // the empty timeline waits for its adapter, which starts the build again,
    // as any `tracks` change during a build does.
    const attempts: Array<{ adapter: FakeAdapter; arrive: () => void }> = [];
    const m = mount([], {
      loadSource,
      createAdapter: () => {
        const adapter = createFakeAdapter();
        let arrive = () => {};
        const pending = new Promise<PlayoutAdapter>((resolve) => {
          arrive = () => resolve(adapter as unknown as PlayoutAdapter);
        });
        attempts.push({ adapter, arrive });
        return pending as unknown as PlayoutAdapter;
      },
    });
    await flush();
    await act(async () => {
      m.setTracks([loadingTrack('a', '/a.mp3')]);
    });
    await flush();
    // No context yet, so nothing is fetched yet.
    expect(calls).toHaveLength(0);
    expect(readyEvents).toBe(0);

    await act(async () => {
      attempts.forEach((attempt) => attempt.arrive());
    });
    // Built without waiting for the source: the track is there, empty.
    await ready();
    const { adapter } = attempts[attempts.length - 1];
    expect(readyEvents).toBe(1);
    expect(adapter.setTracks.mock.lastCall?.[0].map((t) => [t.id, t.clips.length])).toEqual([
      ['a', 0],
    ]);
    expect(adapter.dispose).not.toHaveBeenCalled();
    for (const superseded of attempts.slice(0, -1)) {
      expect(superseded.adapter.dispose).toHaveBeenCalledTimes(1);
      expect(superseded.adapter.setTracks).not.toHaveBeenCalled();
    }
    // The build's adapter is the decode context the load was waiting for.
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    expect(adapter.updateTrack.mock.calls.map(([id, t]) => [id, t.clips.length])).toEqual([
      ['a', 1],
    ]);
    expect(readyEvents).toBe(1);
  });

  it('1e: a source named during the wait, after the adapter has arrived, is fetched at once', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const m = mount([a], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => {
      m.setTracks([a, loadingTrack('b', '/b.mp3')]);
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].src).toBe('/b.mp3');
    expect(m.adapter.setTracks).not.toHaveBeenCalled();
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
  });

  it('13: play() during the first-load wait does nothing', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/a.mp3')], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => {
      await probe.controls.play();
    });
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await ready();
    await flush();

    expect(probe.isPlaying).toBe(false);
    expect(m.adapter.play).not.toHaveBeenCalled();
  });

  it('5: one source fails: one build with the others, onError once; retry loads it with no second build', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(2));
    const failure = new Error('404');
    await act(async () => {
      calls[1].reject(failure);
    });
    expect(m.adapter.setTracks).not.toHaveBeenCalled();
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await ready();

    expect(readyEvents).toBe(1);
    expect(builtClips(m.adapter).map((clips) => clips.length)).toEqual([1, 0]);
    m.rerender();
    m.rerender();
    expect(m.onError).toHaveBeenCalledTimes(1);
    expect(m.onError).toHaveBeenCalledWith(failure);
    expect(captured.status?.sources.get('/b.mp3')).toEqual({ status: 'failed', error: failure });
    expect(captured.status?.failedCount).toBe(1);

    act(() => captured.status?.retry('/b.mp3'));
    await waitFor(() => expect(calls).toHaveLength(3));
    await act(async () => {
      calls[2].resolve(fakeBuffer());
    });

    expect(m.adapter.updateTrack.mock.calls.map(([id, t]) => [id, t.clips.length])).toEqual([
      ['b', 1],
    ]);
    expect(readyEvents).toBe(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(captured.status?.sources.get('/b.mp3')).toEqual({ status: 'loaded' });
    expect(m.onError).toHaveBeenCalledTimes(1);
  });

  it('10: unmounted before the decode context resolves: nothing is fetched and the adapter is disposed once', async () => {
    const { calls, loadSource } = heldLoadSource();
    const adapter = createFakeAdapter();
    let arrive: (value: PlayoutAdapter) => void = () => {};
    const pending = new Promise<PlayoutAdapter>((resolve) => {
      arrive = resolve;
    });
    const m = mount([loadingTrack('a', '/a.mp3')], {
      loadSource,
      // Awaited by resolvePlayoutAdapter, like the real dynamic import.
      createAdapter: () => pending as unknown as PlayoutAdapter,
    });
    await flush();
    expect(m.createAdapter).toHaveBeenCalledTimes(1);

    await act(async () => {
      m.unmount();
    });
    await act(async () => {
      arrive(adapter as unknown as PlayoutAdapter);
    });
    await flush();

    expect(calls).toHaveLength(0);
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
    expect(adapter.setTracks).not.toHaveBeenCalled();
    expect(readyEvents).toBe(0);
  });
});

describe('which sources are requested', () => {
  it('2: an inline tracks array on every parent render: one call per source, bounded renders', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const b = loadingTrack('b', '/b.mp3');
    const adapter = createFakeAdapter();
    const createAdapter = () => adapter as unknown as PlayoutAdapter;
    let parentRenders = 0;
    const Parent: React.FC = () => {
      parentRenders++;
      return (
        <WaveformPlaylistProvider
          tracks={[a, b]}
          loadSource={loadSource}
          sampleRate={SAMPLE_RATE}
          createAdapter={createAdapter}
        >
          <Probe />
        </WaveformPlaylistProvider>
      );
    };
    const view = render(<Parent />);
    await waitFor(() => expect(calls).toHaveLength(2));
    view.rerender(<Parent />);
    view.rerender(<Parent />);
    await act(async () => {
      calls[0].resolve(fakeBuffer());
      calls[1].resolve(fakeBuffer());
    });
    await ready();
    await flush();

    expect(calls).toHaveLength(2);
    expect(parentRenders).toBe(3);
    expect(probeRenders).toBeLessThan(20);
    expect(readyEvents).toBe(1);
    expect(adapter.setTracks).toHaveBeenCalledTimes(1);
  });

  it('3: two clips naming one URL: one call, and both resolved clips share the buffer', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/same.mp3'), loadingTrack('b', '/same.mp3')], {
      loadSource,
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });
    await ready();

    expect(calls).toHaveLength(1);
    const clips = builtClips(m.adapter);
    expect(clips[0][0].audioBuffer).toBe(buffer);
    expect(clips[1][0].audioBuffer).toBe(buffer);
  });

  it('11: two different File objects with equal contents: two calls, two tracks', async () => {
    const { calls, loadSource } = heldLoadSource();
    const one = new File(['same bytes'], 'take.wav');
    const two = new File(['same bytes'], 'take.wav');
    const m = mount([loadingTrack('a', one), loadingTrack('b', two)], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0].src).toBe(one);
    expect(calls[1].src).toBe(two);
    const first = fakeBuffer();
    const second = fakeBuffer();
    await act(async () => {
      calls[0].resolve(first);
      calls[1].resolve(second);
    });
    await ready();
    const clips = builtClips(m.adapter);
    expect(clips[0][0].audioBuffer).toBe(first);
    expect(clips[1][0].audioBuffer).toBe(second);
  });

  it('4: under StrictMode sources load, at most two calls per source, one result used, one build', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')], {
      loadSource,
      strict: true,
    });
    await waitFor(() => expect(calls.filter((c) => !c.signal.aborted)).toHaveLength(2));
    for (const src of ['/a.mp3', '/b.mp3']) {
      const forSrc = calls.filter((c) => c.src === src);
      expect(forSrc.length).toBeLessThanOrEqual(2);
      expect(forSrc.filter((c) => !c.signal.aborted)).toHaveLength(1);
    }
    // Every call is settled, the aborted ones too, each with its own buffer.
    const buffers = calls.map(() => fakeBuffer());
    await act(async () => {
      calls.forEach((call, i) => call.resolve(buffers[i]));
    });
    await ready();
    await flush();

    expect(readyEvents).toBe(1);
    const built = m.adapter.setTracks.mock.lastCall?.[0] ?? [];
    expect(built.map((t) => t.id)).toEqual(['a', 'b']);
    expect(built.map((t) => t.clips.length)).toEqual([1, 1]);
    const liveBuffer = (src: string) =>
      buffers[calls.findIndex((c) => c.src === src && !c.signal.aborted)];
    expect(built[0].clips[0].audioBuffer).toBe(liveBuffer('/a.mp3'));
    expect(built[1].clips[0].audioBuffer).toBe(liveBuffer('/b.mp3'));
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(m.adapter.dispose).not.toHaveBeenCalled();
  });

  it('4b: a new tracks array on 20 renders while a load is in flight never aborts it', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const m = mount([a], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));
    for (let i = 0; i < 20; i++) {
      await act(async () => {
        m.setTracks([a]);
      });
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].signal.aborted).toBe(false);
  });

  it('14: loadSource as a new inline function on every render: no extra calls', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const adapter = createFakeAdapter();
    const createAdapter = () => adapter as unknown as PlayoutAdapter;
    const Parent: React.FC = () => (
      <WaveformPlaylistProvider
        tracks={[a]}
        loadSource={(src, context) => loadSource(src, context)}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
      >
        <Probe />
      </WaveformPlaylistProvider>
    );
    const view = render(<Parent />);
    await waitFor(() => expect(calls).toHaveLength(1));
    for (let i = 0; i < 10; i++) view.rerender(<Parent />);
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].signal.aborted).toBe(false);
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await ready();
    expect(readyEvents).toBe(1);
  });

  it('9: a track removed while its source is pending: that call is aborted and its late result changes nothing', async () => {
    const { calls, loadSource } = heldLoadSource();
    const keep = plainTrack('keep');
    const m = mount([keep], { loadSource });
    await ready();
    await act(async () => {
      m.setTracks([keep, loadingTrack('a', '/a.mp3')]);
    });
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => {
      m.setTracks([m.tracks()[0]]);
    });
    await flush();
    expect(calls[0].signal.aborted).toBe(true);
    const updatesBefore = m.adapter.updateTrack.mock.calls.length;
    const buildsBefore = m.adapter.setTracks.mock.calls.length;

    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await flush();
    expect(m.adapter.updateTrack.mock.calls.length).toBe(updatesBefore);
    expect(m.adapter.setTracks.mock.calls.length).toBe(buildsBefore);
    expect(probe.timeline.tracks.map((t) => t.id)).toEqual(['keep']);
    expect(captured.status?.sources.has('/a.mp3')).toBe(false);
  });

  it('12: a clip with src and audioBuffer is not fetched; a later loading clip for that src uses its buffer', async () => {
    const { calls, loadSource } = heldLoadSource();
    const buffer = fakeBuffer();
    const carried = {
      ...plainClip('a-clip'),
      src: '/a.mp3',
      audioBuffer: buffer,
    } as AudioClip;
    const a = track('a', [carried]);
    const m = mount([a], { loadSource });
    await ready();
    await flush();
    expect(calls).toHaveLength(0);
    expect(captured.status?.sources.get('/a.mp3')).toEqual({ status: 'loaded' });
    expect(readyEvents).toBe(1);

    await act(async () => {
      m.setTracks([m.tracks()[0], loadingTrack('b', '/a.mp3')]);
    });
    await flush();
    expect(calls).toHaveLength(0);
    const added = m.adapter.addTrack.mock.lastCall?.[0];
    expect(added?.id).toBe('b');
    expect(added?.clips[0].audioBuffer).toBe(buffer);
    expect(readyEvents).toBe(1);
  });

  it('15: hidden then revealed: what was loaded is not requested again, what was in flight is, once', async () => {
    const { calls, loadSource } = heldLoadSource();
    let setMode: (mode: 'visible' | 'hidden') => void = () => {};
    const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      const [mode, set] = React.useState<'visible' | 'hidden'>('visible');
      setMode = set;
      return <React.Activity mode={mode}>{children}</React.Activity>;
    };
    const m = mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')], {
      loadSource,
      wrap: (ui) => <Shell>{ui}</Shell>,
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    const bufferA = fakeBuffer();
    await act(async () => {
      calls[0].resolve(bufferA);
    });

    await act(async () => setMode('hidden'));
    expect(calls[1].signal.aborted).toBe(true);
    await act(async () => setMode('visible'));
    await waitFor(() => expect(calls).toHaveLength(3));
    await flush();

    expect(calls.map((c) => c.src)).toEqual(['/a.mp3', '/b.mp3', '/b.mp3']);
    await act(async () => {
      calls[2].resolve(fakeBuffer());
    });
    await ready();
    expect(readyEvents).toBe(1);
    expect(builtClips(m.adapter)[0][0].audioBuffer).toBe(bufferA);
    expect(builtClips(m.adapter).map((clips) => clips.length)).toEqual([1, 1]);
  });
});

describe('a source that settles after the first build', () => {
  it('6: an appended track with a pending clip enters empty at once, is updated on settle, and undo is cleared', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([plainTrack('a')], { loadSource });
    await ready();

    await act(async () => {
      m.setTracks([m.tracks()[0], loadingTrack('b', '/b.mp3')]);
    });
    expect(m.adapter.addTrack).toHaveBeenCalledTimes(1);
    expect(m.adapter.addTrack.mock.calls[0][0].id).toBe('b');
    expect(m.adapter.addTrack.mock.calls[0][0].clips).toEqual([]);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    // Precondition for the undo assertion below: the add can be undone.
    expect(probe.canUndo).toBe(true);
    await waitFor(() => expect(calls).toHaveLength(1));
    const tracksBefore = m.tracks();
    const mirroredBefore = m.onTracksChange.mock.calls.length;

    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });

    expect(m.adapter.updateTrack).toHaveBeenCalledTimes(1);
    expect(m.adapter.updateTrack.mock.calls[0][0]).toBe('b');
    expect(m.adapter.updateTrack.mock.calls[0][1].clips[0].audioBuffer).toBe(buffer);
    expect(readyEvents).toBe(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(probe.canUndo).toBe(false);
    // The arrival changed nothing in the app's state and was not mirrored.
    expect(m.tracks()).toBe(tracksBefore);
    expect(m.onTracksChange.mock.calls.length).toBe(mirroredBefore);
    // The view shows the resolved clip.
    expect(probe.timeline.tracks[1].clips[0].audioBuffer).toBe(buffer);
  });
});

describe('onTracksChange', () => {
  /** [a: a plain clip], ready, then [a, b: a loading clip that is pending]. */
  async function loadedPlusPending(over: Partial<LoadingClip> = {}, options: MountOptions = {}) {
    const held = heldLoadSource();
    const m = mount([plainTrack('a')], { loadSource: held.loadSource, ...options });
    await ready();
    const pendingClip = loadingClip('b-clip', '/b.mp3', over);
    await act(async () => {
      m.setTracks([m.tracks()[0], track('b', [pendingClip])]);
    });
    await waitFor(() => expect(held.calls).toHaveLength(1));
    return { m, calls: held.calls, pendingClip };
  }

  function adapterCalls(adapter: FakeAdapter) {
    return {
      setTracks: adapter.setTracks.mock.calls.length,
      addTrack: adapter.addTrack.mock.calls.length,
      updateTrack: adapter.updateTrack.mock.calls.length,
    };
  }

  it('7: a trim while another track loads hands the loading clip back, and feeding it back does nothing', async () => {
    const { m, calls, pendingClip } = await loadedPlusPending({ duration: 3 });
    // The pending clip is drawn as a placeholder, three seconds long.
    expect(probe.timeline.tracks[1].clips[0].durationSamples).toBe(3 * SAMPLE_RATE);
    const before = adapterCalls(m.adapter);
    const mirroredBefore = m.onTracksChange.mock.calls.length;

    await act(async () => {
      probe.refs.playoutRef.current?.trimClip('a', 'a-clip', 'right', -SAMPLE_RATE / 2);
    });
    await flush();

    // One call, with the trimmed clip and the loading clip still in place.
    expect(m.onTracksChange.mock.calls.length).toBe(mirroredBefore + 1);
    const handed = m.onTracksChange.mock.lastCall?.[0] as PlaylistTrack[];
    expect((handed[0].clips[0] as AudioClip).durationSamples).toBe(SAMPLE_RATE * 1.5);
    expect(handed[1].clips).toEqual([pendingClip]);
    expect(handed[1].clips[0]).toBe(pendingClip);
    // The app stored it (the mount helper does) and it came back as the prop:
    // no rebuild, no add; the one updateTrack is the engine's own for the trim.
    expect(m.tracks()).toBe(handed);
    expect(adapterCalls(m.adapter)).toEqual({ ...before, updateTrack: before.updateTrack + 1 });
    expect(m.adapter.updateTrack.mock.lastCall?.[0]).toBe('a');
    expect(readyEvents).toBe(1);
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(probe.canUndo).toBe(true);
    // The view still draws the placeholder beside the trimmed clip.
    expect(probe.timeline.tracks[0].clips[0].durationSamples).toBe(SAMPLE_RATE * 1.5);
    expect(probe.timeline.tracks[1].clips[0].durationSamples).toBe(3 * SAMPLE_RATE);

    // The source then arrives through the normal path: the seed does not hide it.
    const buffer = fakeBuffer(4);
    await act(async () => {
      calls[0].resolve(buffer);
    });
    expect(m.adapter.updateTrack.mock.lastCall?.[0]).toBe('b');
    expect(m.adapter.updateTrack.mock.lastCall?.[1].clips[0].audioBuffer).toBe(buffer);
    expect(readyEvents).toBe(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
  });

  it('7b: the onTracksChange the timeline publishes strips placeholders and keeps the loading clip', async () => {
    const { m, pendingClip } = await loadedPlusPending({ duration: 3 });
    const published = probe.timeline.onTracksChange;
    // What a move of a trim sends: copies of the view's tracks.
    const copies = probe.timeline.tracks.map((t) => ({ ...t, clips: [...t.clips] }));
    expect(copies[1].clips[0].id).toBe('b-clip');
    expect(copies[1].clips[0]).not.toBe(pendingClip);

    await act(async () => {
      published?.(copies);
    });

    const handed = m.onTracksChange.mock.lastCall?.[0] as PlaylistTrack[];
    expect(handed[1].clips).toHaveLength(1);
    expect(handed[1].clips[0]).toBe(pendingClip);
    // And it keeps its identity while the app passes an inline callback.
    m.rerender();
    expect(probe.timeline.onTracksChange).toBe(published);
  });

  it('8: a source that settles during a drag is applied after the release, with no rebuild', async () => {
    const { m, calls } = await loadedPlusPending();
    const before = adapterCalls(m.adapter);

    probe.refs.isDraggingRef.current = true;
    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });
    await flush();
    // Held back while the drag is on; drawn already.
    expect(adapterCalls(m.adapter)).toEqual(before);
    expect(probe.timeline.tracks[1].clips[0].audioBuffer).toBe(buffer);

    await act(async () => {
      probe.refs.isDraggingRef.current = false;
    });
    await flush();

    expect(adapterCalls(m.adapter)).toEqual({ ...before, updateTrack: before.updateTrack + 1 });
    expect(m.adapter.updateTrack.mock.lastCall?.[0]).toBe('b');
    expect(m.adapter.updateTrack.mock.lastCall?.[1].clips[0].audioBuffer).toBe(buffer);
    expect(readyEvents).toBe(1);
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
  });

  it('8b: the same with moves of the trim before and after the arrival, and a release that trims', async () => {
    const { m, calls, pendingClip } = await loadedPlusPending();
    const before = adapterCalls(m.adapter);
    /** One pointer move of a trim of a-clip: copies of the view's tracks. */
    const move = async (durationSamples: number) => {
      const copies = probe.timeline.tracks.map((t, i) =>
        i === 0 ? { ...t, clips: t.clips.map((c) => ({ ...c, durationSamples })) } : t
      );
      await act(async () => {
        probe.timeline.onTracksChange?.(copies);
      });
    };

    probe.refs.isDraggingRef.current = true;
    await move(SAMPLE_RATE * 1.8);
    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });
    await move(SAMPLE_RATE * 1.5);
    // The view draws the arrived clip, but the app's state still names it as
    // loading: the engine does not hold it yet.
    expect(probe.timeline.tracks[1].clips[0].audioBuffer).toBe(buffer);
    expect(m.tracks()[1].clips[0]).toBe(pendingClip);
    expect(adapterCalls(m.adapter)).toEqual(before);

    // The release, as useClipDragHandlers does it.
    await act(async () => {
      probe.refs.isDraggingRef.current = false;
      probe.refs.playoutRef.current?.trimClip('a', 'a-clip', 'right', -SAMPLE_RATE / 2);
    });
    await flush();

    const updates = m.adapter.updateTrack.mock.calls.slice(before.updateTrack);
    expect(updates.map(([id]) => id)).toEqual(['a', 'b']);
    expect(updates[1][1].clips[0].audioBuffer).toBe(buffer);
    expect(m.adapter.setTracks.mock.calls.length).toBe(before.setTracks);
    expect(readyEvents).toBe(1);
    expect(probe.timeline.tracks[0].clips[0].durationSamples).toBe(SAMPLE_RATE * 1.5);
    expect(probe.timeline.tracks[1].clips[0].audioBuffer).toBe(buffer);
  });
});

describe('what is reported', () => {
  it('16: a loading clip on a MIDI track is rejected through onError, once per clip', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { loadSource } = heldLoadSource();
    const midi = track('m', [loadingClip('m-clip', '/m.mp3')], { kind: 'midi' });
    const m = mount([midi], { loadSource });
    await flush();
    m.rerender();
    await act(async () => {
      m.setTracks([{ ...midi }]);
    });
    await flush();
    // A second rejected clip makes the list of rejected clips a new one; the
    // first clip is the same object and is not reported again.
    const other = track('n', [loadingClip('n-clip', '/n.mp3')], { kind: 'midi' });
    await act(async () => {
      m.setTracks([midi, other]);
    });
    await flush();

    const about = (id: string) =>
      m.onError.mock.calls.filter(([error]) => error.message.includes(`"${id}"`));
    expect(about('m-clip')).toHaveLength(1);
    expect(about('m-clip')[0][0].message).toMatch(/MIDI/);
    expect(about('n-clip')).toHaveLength(1);
  });

  it('17: a placeholder is not warned about as a clip with no audio data', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { calls, loadSource } = heldLoadSource();
    mount([loadingTrack('a', '/a.mp3', { duration: 2 })], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));
    await flush();
    expect(probe.timeline.tracks[0].clips).toHaveLength(1);
    const messages = warn.mock.calls.map((call) => String(call[0]));
    expect(messages.filter((text) => text.includes('no audio data'))).toEqual([]);
  });
});
