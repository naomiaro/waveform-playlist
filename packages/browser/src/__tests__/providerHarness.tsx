// @vitest-environment jsdom
//
// Shared harness of the `providerLoadsSources.*.test.tsx` files (#812): the
// real `WaveformPlaylistProvider` with a fake adapter whose calls are counted,
// a `loadSource` that keeps every call pending until the test settles it, a
// probe child, and a counter of `waveform-playlist:ready` events (one per
// FULL engine build). Not a test file.
import { beforeEach, afterEach, expect, vi, type Mock } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { StrictMode } from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
  useEditorControls,
  useEngineRefs,
  useIsPlaying,
  usePlaybackControls,
  usePlaylistMixer,
  usePlaylistSources,
  usePlaylistTimeline,
  useUndoRedo,
  type EditorControlsContextValue,
  type EngineRefsContextValue,
  type PlaybackControlsContextValue,
  type PlaylistSourcesValue,
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

export const SAMPLE_RATE = 48000;

export function fakeBuffer(seconds = 2): AudioBuffer {
  return {
    sampleRate: SAMPLE_RATE,
    length: SAMPLE_RATE * seconds,
    duration: seconds,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(SAMPLE_RATE * seconds),
  } as unknown as AudioBuffer;
}

/** A loaded clip the app made itself: no `src`, no buffer, two seconds long. */
export function plainClip(id: string): AudioClip {
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

export function track(
  id: string,
  clips: (AudioClip | LoadingClip)[],
  over: object = {}
): PlaylistTrack {
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

export function plainTrack(id: string): PlaylistTrack {
  return track(id, [plainClip(id + '-clip')]);
}

export function loadingClip(
  id: string,
  src: ClipSource,
  over: Partial<LoadingClip> = {}
): LoadingClip {
  return { id, src, ...over };
}

export function loadingTrack(id: string, src: ClipSource, over: Partial<LoadingClip> = {}) {
  return track(id, [loadingClip(id + '-clip', src, over)]);
}

export interface PendingCall {
  src: ClipSource;
  signal: AbortSignal;
  resolve: (buffer: AudioBuffer) => void;
  reject: (error: Error) => void;
}

/** A `loadSource` that keeps every call pending until the test settles it. */
export function heldLoadSource() {
  const calls: PendingCall[] = [];
  const loadSource: LoadSource = (src, { signal }) =>
    new Promise<AudioBuffer>((resolve, reject) => {
      calls.push({ src, signal, resolve, reject });
    });
  return { calls, loadSource };
}

type Fn = Mock<(...args: unknown[]) => unknown>;

export interface FakeAdapter {
  audioContext: AudioContext;
  ppqn: number;
  init: Mock<() => Promise<void>>;
  setTracks: Mock<(tracks: ClipTrack[]) => void>;
  addTrack: Mock<(track: ClipTrack) => void>;
  removeTrack: Fn;
  updateTrack: Mock<(id: string, track: ClipTrack) => void>;
  play: Fn;
  pause: Fn;
  stop: Fn;
  seek: Fn;
  getCurrentTime: () => number;
  isPlaying: () => boolean;
  setMasterVolume: Fn;
  setTrackVolume: Fn;
  setTrackMute: Fn;
  setTrackSolo: Fn;
  setTrackPan: Fn;
  setLoop: Fn;
  dispose: Fn;
}

export function createFakeAdapter(sampleRate = SAMPLE_RATE): FakeAdapter {
  return {
    audioContext: {
      currentTime: 0,
      sampleRate,
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

export let probe: {
  timeline: PlaylistTimelineContextValue;
  trackStates: TrackState[];
  canUndo: boolean;
  isPlaying: boolean;
  controls: PlaybackControlsContextValue;
  refs: EngineRefsContextValue;
  editor: EditorControlsContextValue;
};
export let probeRenders = 0;

/** The latest loading status of the provider's sources (`usePlaylistSources()`); null before the first render. */
export let sourceStatus: PlaylistSourcesValue | null = null;

/** Reads the status in a component of its own, so that a settle does not render `Probe`. */
const StatusProbe: React.FC = () => {
  sourceStatus = usePlaylistSources();
  return null;
};

export const Probe: React.FC = () => {
  probeRenders++;
  probe = {
    timeline: usePlaylistTimeline(),
    trackStates: usePlaylistMixer().trackStates,
    canUndo: useUndoRedo().canUndo,
    isPlaying: useIsPlaying().isPlaying,
    controls: usePlaybackControls(),
    refs: useEngineRefs(),
    editor: useEditorControls(),
  };
  return <StatusProbe />;
};

/** `waveform-playlist:ready` events on `window` since the test began: one per FULL engine build. */
export let readyEvents = 0;
const countReady = () => {
  readyEvents++;
};

export interface MountOptions {
  loadSource?: LoadSource;
  /** One fake adapter per call when given; else one shared adapter. */
  createAdapter?: () => PlayoutAdapter;
  strict?: boolean;
  /** The app stores what `onTracksChange` hands it (default true). */
  store?: boolean;
  wrap?: (ui: React.ReactElement) => React.ReactElement;
  /** The `sampleRate` prop; `null` passes none (the provisional 48000). */
  sampleRate?: number | null;
  /** The rate of the shared fake adapter's AudioContext. */
  adapterSampleRate?: number;
  /** Rendered inside the provider, after the probe. */
  children?: React.ReactNode;
}

export interface Mounted {
  /** The shared fake adapter (unused when `createAdapter` is given). */
  adapter: FakeAdapter;
  createAdapter: Mock<() => PlayoutAdapter>;
  onReady: Mock<() => void>;
  onError: Mock<(error: Error) => void>;
  onTracksChange: Mock<(next: PlaylistTrack[]) => void>;
  unmount: () => void;
  /** The app's current `tracks` state. */
  tracks: () => PlaylistTrack[];
  setTracks: (next: PlaylistTrack[]) => void;
  rerender: () => void;
}

export function mount(initial: PlaylistTrack[], options: MountOptions = {}): Mounted {
  const adapter = createFakeAdapter(options.adapterSampleRate);
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
        sampleRate={options.sampleRate === null ? undefined : (options.sampleRate ?? SAMPLE_RATE)}
        createAdapter={createAdapter}
        onReady={onReady}
        onError={onError}
      >
        <Probe />
        {options.children}
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

export async function ready() {
  await waitFor(() => expect(probe.timeline.isReady).toBe(true));
}

/** Let awaited adapters, decode contexts and the promise chains after them run. */
export async function flush() {
  await act(async () => {
    for (let i = 0; i < 6; i++) await Promise.resolve();
  });
}

/** The clip lists the adapter was given by its latest full build. */
export function builtClips(adapter: FakeAdapter): AudioClip[][] {
  const built = adapter.setTracks.mock.lastCall?.[0] ?? [];
  return built.map((t) => t.clips);
}

/** Call once at the top of a test file: resets the counters and cleans up. */
export function installProviderHarness(): void {
  beforeEach(() => {
    readyEvents = 0;
    probeRenders = 0;
    sourceStatus = null;
    window.addEventListener('waveform-playlist:ready', countReady);
  });

  afterEach(async () => {
    await act(async () => {
      cleanup();
    });
    window.removeEventListener('waveform-playlist:ready', countReady);
    vi.restoreAllMocks();
  });
}
