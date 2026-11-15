// What the tests that mount `WaveformPlaylistProvider` share (#812): an
// arrangement that fetches nothing, a fake adapter that records every call
// that reaches it, a factory that makes one per engine build (and can hold a
// build open or fail it), and `renderWithArrangement`, which mounts the
// provider on an arrangement of the given tracks.
import { render, type RenderResult } from '@testing-library/react';
import React, { useState, type ReactNode } from 'react';
import { createArrangement } from '@waveform-playlist/engine';
import type { Arrangement, LoadSource, PlayoutAdapter } from '@waveform-playlist/engine';
import type { ArrangementTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  type WaveformPlaylistProviderProps,
} from '../../WaveformPlaylistContext';

export const TEST_SAMPLE_RATE = 48000;

/** A `loadSource` that never settles: a test that names a source fetches nothing. */
export const neverLoads: LoadSource = () => new Promise<AudioBuffer>(() => {});

export interface TestArrangementOptions {
  loadSource?: LoadSource;
  undoLimit?: number;
}

/** An arrangement of `tracks` that loads through `loadSource` (by default: never). */
export function testArrangement(
  tracks: readonly ArrangementTrack[],
  options: TestArrangementOptions = {}
): Arrangement {
  return createArrangement({
    tracks,
    loadSource: options.loadSource ?? neverLoads,
    undoLimit: options.undoLimit,
  });
}

export interface AdapterCall {
  method: string;
  args: unknown[];
}

export interface RecordingAdapter extends PlayoutAdapter {
  /** Every call that reached this adapter, in order. */
  calls: AdapterCall[];
  /** How many calls of `method` reached it. */
  count(method: string): number;
  disposed: boolean;
  /** What `getCurrentTime()` returns from now on. */
  setTime(seconds: number): void;
}

/** A fake adapter that records every call; `getCurrentTime()` is what the test sets. */
export function recordingAdapter(sampleRate = TEST_SAMPLE_RATE): RecordingAdapter {
  let now = 0;
  let playing = false;
  const calls: AdapterCall[] = [];
  const record =
    (method: string, run?: (...args: unknown[]) => void) =>
    (...args: unknown[]) => {
      calls.push({ method, args });
      run?.(...args);
    };
  const adapter: RecordingAdapter = {
    calls,
    count: (method) => calls.filter((call) => call.method === method).length,
    disposed: false,
    setTime: (seconds) => {
      now = seconds;
    },
    audioContext: {
      currentTime: 0,
      sampleRate,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {
      calls.push({ method: 'init', args: [] });
    },
    setTracks: record('setTracks'),
    addTrack: record('addTrack'),
    removeTrack: record('removeTrack'),
    updateTrack: record('updateTrack'),
    play: record('play', (start) => {
      playing = true;
      now = start as number;
    }),
    pause: record('pause', () => {
      playing = false;
    }),
    stop: record('stop', () => {
      playing = false;
    }),
    seek: record('seek', (time) => {
      now = time as number;
    }),
    getCurrentTime: () => now,
    isPlaying: () => playing,
    setMasterVolume: record('setMasterVolume'),
    setTrackVolume: record('setTrackVolume'),
    setTrackMute: record('setTrackMute'),
    setTrackSolo: record('setTrackSolo'),
    setTrackPan: record('setTrackPan'),
    setLoop: record('setLoop'),
    dispose: record('dispose', () => {
      adapter.disposed = true;
    }),
  };
  return adapter;
}

export interface BuildGate {
  open(): void;
  fail(error: Error): void;
}

/**
 * `createAdapter` for the tests: one recording adapter per engine build, in
 * `adapters`. `holdNext()` delivers the next one only when the test opens the
 * gate (the stand-in for the default engine's dynamic import); `failNext()`
 * makes the next call throw.
 */
export function adapterFactory(sampleRate = TEST_SAMPLE_RATE) {
  const adapters: RecordingAdapter[] = [];
  let held: Promise<void> | null = null;
  let failure: Error | null = null;
  const createAdapter = (): PlayoutAdapter => {
    if (failure) {
      const error = failure;
      failure = null;
      throw error;
    }
    const adapter = recordingAdapter(sampleRate);
    adapters.push(adapter);
    const waiting = held;
    held = null;
    // resolvePlayoutAdapter awaits what the factory returns, as it awaits
    // the dynamic import.
    return (waiting ? waiting.then(() => adapter) : adapter) as PlayoutAdapter;
  };
  const holdNext = (): BuildGate => {
    let gate!: BuildGate;
    held = new Promise<void>((resolve, reject) => {
      gate = { open: resolve, fail: reject };
    });
    return gate;
  };
  const failNext = (error: Error) => {
    failure = error;
  };
  const latest = (): RecordingAdapter => adapters[adapters.length - 1];
  return { adapters, createAdapter, holdNext, failNext, latest };
}

export type AdapterFactory = ReturnType<typeof adapterFactory>;

type ProviderOptions = Partial<Omit<WaveformPlaylistProviderProps, 'arrangement' | 'children'>>;

export interface RenderWithArrangementOptions extends ProviderOptions {
  children?: ReactNode;
  /** Mount on this arrangement instead of making one of the tracks. */
  arrangement?: Arrangement;
  loadSource?: LoadSource;
  /** Around the provider (StrictMode, an <Activity>). */
  wrapper?: React.ComponentType<{ children: ReactNode }>;
}

export interface ArrangementRender extends RenderResult {
  arrangement: Arrangement;
  factory: AdapterFactory;
  /** The adapters made so far, one per engine build. */
  adapters: RecordingAdapter[];
  /** Render the provider again with these props changed (the same arrangement unless given). */
  update(next: ProviderOptions & { children?: ReactNode; arrangement?: Arrangement }): void;
}

/**
 * Mount `WaveformPlaylistProvider` on an arrangement of `tracks`, with a
 * recording adapter per build (unless `createAdapter` is given) and the
 * sample rate known from the first render (unless `sampleRate` is given).
 */
export function renderWithArrangement(
  tracks: readonly ArrangementTrack[],
  options: RenderWithArrangementOptions = {}
): ArrangementRender {
  const { children, arrangement: given, loadSource, wrapper, ...providerProps } = options;
  let arrangement = given ?? testArrangement(tracks, { loadSource });
  const factory = adapterFactory(providerProps.sampleRate ?? TEST_SAMPLE_RATE);
  let props: ProviderOptions = {
    sampleRate: TEST_SAMPLE_RATE,
    createAdapter: factory.createAdapter,
    ...providerProps,
  };
  let content = children;
  const ui = () => (
    <WaveformPlaylistProvider arrangement={arrangement} {...props}>
      {content}
    </WaveformPlaylistProvider>
  );
  const result = render(ui(), wrapper ? { wrapper } : undefined);
  return {
    ...result,
    get arrangement() {
      return arrangement;
    },
    factory,
    adapters: factory.adapters,
    update(next) {
      const { children: nextChildren, arrangement: nextArrangement, ...nextProps } = next;
      if (nextArrangement) arrangement = nextArrangement;
      if ('children' in next) content = nextChildren;
      props = { ...props, ...nextProps };
      result.rerender(ui());
    },
  };
}

export interface TestProviderProps extends ProviderOptions {
  /** The tracks of the arrangement, read on the first render only. */
  tracks?: readonly ArrangementTrack[];
  /** Mount on this arrangement instead of making one of `tracks`. */
  arrangement?: Arrangement;
  loadSource?: LoadSource;
  children?: ReactNode;
}

/**
 * `WaveformPlaylistProvider` on an arrangement of `tracks`, made once per
 * mount, for a test whose subject is not the tracks. To change them, change
 * the arrangement (`useArrangement()`, or pass `arrangement`): a later render
 * with other track ids throws, so a test cannot keep relying on a `tracks`
 * prop that is no longer read.
 */
export const TestProvider: React.FC<TestProviderProps> = ({
  tracks = NO_TRACKS,
  arrangement: given,
  loadSource,
  children,
  ...providerProps
}) => {
  const [made] = useState(() => given ?? testArrangement(tracks, { loadSource }));
  const [firstIds] = useState(() => idsOf(tracks));
  if (!given && idsOf(tracks) !== firstIds) {
    throw new Error(
      'TestProvider: `tracks` changed after the first render; change the arrangement instead'
    );
  }
  return (
    <WaveformPlaylistProvider arrangement={given ?? made} {...providerProps}>
      {children}
    </WaveformPlaylistProvider>
  );
};

const NO_TRACKS: readonly ArrangementTrack[] = [];
const idsOf = (tracks: readonly ArrangementTrack[]) => tracks.map((t) => t.id).join('\u0000');
