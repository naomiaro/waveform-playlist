// What the tests of the provider internals around an engine share (#812): a
// fake adapter per build that the test can hold back or fail, a `loadSource`
// that keeps every load pending until the test settles it, and a hook that
// gives `useEngineLifetime` the refs the provider will give it.
import { useLayoutEffect, useRef } from 'react';
import { createClip, createTrack } from '@waveform-playlist/core';
import type { ArrangementTrack, AudioClip, ClipSource, LoadingClip } from '@waveform-playlist/core';
import type {
  Arrangement,
  LoadSource,
  PlaylistEngine,
  PlayoutAdapter,
} from '@waveform-playlist/engine';
import type { EffectsFunction } from '@waveform-playlist/playout';
import { useEngineLifetime, type EngineLifetime } from '../../providerInternals/useEngineLifetime';

export const RATE = 48000;

export const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export function clip(id: string, startSeconds: number, seconds = 1): AudioClip {
  return {
    ...createClip({
      startSample: startSeconds * RATE,
      durationSamples: seconds * RATE,
      offsetSamples: 0,
      sampleRate: RATE,
      sourceDurationSamples: 8 * RATE,
    }),
    id,
  };
}

export function loading(id: string, fields: Partial<LoadingClip> = {}): LoadingClip {
  return { id, src: `/${id}.opus`, start: 0, duration: 1, ...fields } as LoadingClip;
}

export function track(id: string, clips: ArrangementTrack['clips'] = []): ArrangementTrack {
  return { ...createTrack({ name: id, clips: [] }), id, clips } as ArrangementTrack;
}

export function fakeBuffer(seconds: number): AudioBuffer {
  return {
    sampleRate: RATE,
    length: seconds * RATE,
    duration: seconds,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(seconds * RATE),
  } as unknown as AudioBuffer;
}

export interface PendingLoad {
  src: ClipSource;
  signal: AbortSignal;
  audioContext: BaseAudioContext;
  resolve(buffer: AudioBuffer): void;
  reject(error: unknown): void;
}

/** A `loadSource` that keeps every call pending until the test settles it. */
export function fakeLoads() {
  const calls: PendingLoad[] = [];
  const loadSource: LoadSource = (src, { signal, audioContext }) =>
    new Promise<AudioBuffer>((resolve, reject) => {
      calls.push({ src, signal, audioContext, resolve, reject });
    });
  const of = (src: ClipSource) => calls.filter((call) => call.src === src);
  return { calls, loadSource, of };
}

export interface FakeAdapter extends PlayoutAdapter {
  disposeCalls: number;
  playCalls: Array<{ startTime: number; endTime: number | undefined }>;
  setTracksCalls: number;
}

export function makeFakeAdapter(sampleRate: number, name: string): FakeAdapter {
  let now = 0;
  let playing = false;
  const adapter: FakeAdapter = {
    disposeCalls: 0,
    playCalls: [],
    setTracksCalls: 0,
    // A distinct object per adapter, so a test can tell which one a load used.
    audioContext: {
      name,
      currentTime: 0,
      sampleRate,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {},
    setTracks() {
      adapter.setTracksCalls += 1;
    },
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play(startTime: number, endTime?: number) {
      playing = true;
      now = startTime;
      adapter.playCalls.push({ startTime, endTime });
    },
    pause() {
      playing = false;
    },
    stop() {
      playing = false;
    },
    seek(time: number) {
      now = time;
    },
    getCurrentTime: () => now,
    isPlaying: () => playing,
    setMasterVolume() {},
    setTrackVolume() {},
    setTrackMute() {},
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {
      adapter.disposeCalls += 1;
    },
  };
  return adapter;
}

interface Gate {
  open(): void;
  fail(error: Error): void;
}

/**
 * `createAdapter` for the tests: one fake adapter per call, in `adapters`.
 * `holdNext()` delivers the next one only when the test opens the gate (the
 * stand-in for the default engine's dynamic import); `failNext()` makes the
 * next call throw.
 */
export function adapterFactory(sampleRate = RATE) {
  const adapters: FakeAdapter[] = [];
  let held: { promise: Promise<void>; gate: Gate } | null = null;
  let failure: Error | null = null;
  const createAdapter = (): PlayoutAdapter => {
    if (failure) {
      const error = failure;
      failure = null;
      throw error;
    }
    const adapter = makeFakeAdapter(sampleRate, `context ${adapters.length}`);
    adapters.push(adapter);
    const waiting = held;
    held = null;
    // resolvePlayoutAdapter awaits what the factory returns, as it awaits
    // the dynamic import.
    return (waiting ? waiting.promise.then(() => adapter) : adapter) as PlayoutAdapter;
  };
  const holdNext = (): Gate => {
    let gate!: Gate;
    const promise = new Promise<void>((resolve, reject) => {
      gate = { open: resolve, fail: reject };
    });
    held = { promise, gate };
    return gate;
  };
  const failNext = (error: Error) => {
    failure = error;
  };
  return { adapters, createAdapter, holdNext, failNext };
}

export interface LifetimeProps {
  arrangement: Arrangement;
  createAdapter: () => PlayoutAdapter;
  effects?: EffectsFunction;
  zoomLevels?: number[];
  sampleRate?: number;
  onError?: (error: Error) => void;
  seedEngine?: (engine: PlaylistEngine) => void;
  onEngine?: (engine: PlaylistEngine) => void;
  resolveTrackEffects?: () => undefined;
  stopAnimationFrameLoop?: () => void;
}

export interface LifetimeHarness {
  lifetime: EngineLifetime;
  playbackEndTimeRef: React.RefObject<number | null>;
}

const NONE = () => undefined;
const NOTHING = () => {};

/** `useEngineLifetime` with the refs the provider holds, as the provider will call it. */
export function useLifetimeForTest(props: LifetimeProps): LifetimeHarness {
  // The latest committed onError, as the provider keeps it (QG).
  const onErrorRef = useRef(props.onError);
  useLayoutEffect(() => {
    onErrorRef.current = props.onError;
  });
  const soundFontCacheRef = useRef(undefined);
  const samplesPerPixelRef = useRef(1024);
  const playbackEndTimeRef = useRef<number | null>(null);
  const lifetime = useEngineLifetime({
    arrangement: props.arrangement,
    createAdapter: props.createAdapter,
    effects: props.effects,
    resolveTrackEffects: props.resolveTrackEffects ?? NONE,
    soundFontCacheRef,
    sampleRateProp: props.sampleRate,
    zoomLevels: props.zoomLevels,
    samplesPerPixelRef,
    playbackEndTimeRef,
    seedEngine: props.seedEngine ?? NOTHING,
    onEngine: props.onEngine ?? NOTHING,
    stopAnimationFrameLoop: props.stopAnimationFrameLoop ?? NOTHING,
    onErrorRef,
  });
  return { lifetime, playbackEndTimeRef };
}
