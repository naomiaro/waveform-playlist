// @vitest-environment jsdom
//
// #688, part 3. One playhead, one progress overlay, one custom-playhead
// wrapper and one selection overlay serve both providers; the MediaElement
// copies are gone. What that changes for a consumer:
//
// - a `renderPlayhead` function receives the same seven props under either
//   provider (a plain object: the five removed props are simply absent);
// - under MediaElementPlaylistProvider the resting playhead is hidden while a
//   range is highlighted, as it always was under WaveformPlaylistProvider;
// - two visualizations under one WaveformPlaylistProvider each animate their
//   playhead (they used to share one frame-callback id).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import type { PlayheadProps } from '@waveform-playlist/ui-components';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { ComposedMediaElementWaveform } from './testCompositions';
import { ComposedWaveform } from './testCompositions';
import {
  usePlaybackControls,
  usePlaylistTimeline,
  usePlaylistZoom,
} from '../contexts/playlistContexts';

const SHARED_PROPS = [
  'color',
  'currentTimeRef',
  'isPlaying',
  'position',
  'sampleRate',
  'samplesPerPixel',
  'visualTimeRef',
];
const REMOVED_PROPS = [
  'playbackStartTimeRef',
  'audioStartPositionRef',
  'getAudioContextTime',
  'getPlaybackTime',
  'controlsOffset',
];

// ---------------------------------------------------------------- frames

let frames: Map<number, FrameRequestCallback>;
let nextFrameId: number;
let originalRAF: typeof requestAnimationFrame;
let originalCAF: typeof cancelAnimationFrame;
const runFrame = () =>
  act(() => {
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb(performance.now());
  });

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  frames = new Map();
  nextFrameId = 1;
  originalRAF = globalThis.requestAnimationFrame;
  originalCAF = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) => {
    const id = nextFrameId++;
    frames.set(id, cb);
    return id;
  };
  globalThis.cancelAnimationFrame = (id: number) => {
    frames.delete(id);
  };
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  globalThis.requestAnimationFrame = originalRAF;
  globalThis.cancelAnimationFrame = originalCAF;
  vi.restoreAllMocks();
});

let controls: ReturnType<typeof usePlaybackControls>;
const ControlsProbe: React.FC = () => {
  controls = usePlaybackControls();
  return null;
};

// ---------------------------------------------------------- MediaElement

const ME_RATE = 44100;
const ME_SOURCE_SCALE = 441;
const ME_SPP = 882; // 50 px per second
const ME_SECONDS = 8;
const ME_LENGTH = (ME_SECONDS * ME_RATE) / ME_SOURCE_SCALE;
const ME_TRACK = {
  source: 'test.mp3',
  name: 'Test',
  waveformData: WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: ME_RATE,
    samples_per_pixel: ME_SOURCE_SCALE,
    bits: 8,
    length: ME_LENGTH,
    data: Array.from({ length: ME_LENGTH * 2 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
  }),
};
const ME_PX_PER_SECOND = ME_RATE / ME_SPP;

function createFakePlayout() {
  const listeners = new Map<string, Set<(...args: unknown[]) => void>>();
  const fake = {
    time: 0,
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    on(event: string, listener: (...args: unknown[]) => void) {
      if (!listeners.has(event)) listeners.set(event, new Set());
      listeners.get(event)!.add(listener);
    },
    off() {},
    emit(event: string, ...args: unknown[]) {
      listeners.get(event)?.forEach((listener) => listener(...args));
    },
    play: vi.fn((_when?: number, offset?: number) => {
      fake.time = offset ?? 0;
    }),
    pause: vi.fn(),
    stop: vi.fn(),
    seekTo: vi.fn((time: number) => {
      fake.time = time;
    }),
    setPlaybackRate() {},
    getCurrentTime: () => fake.time,
    dispose: vi.fn(),
  };
  return fake;
}

async function mountMediaElement(playlist: React.ReactElement = <ComposedMediaElementWaveform />) {
  const fake = createFakePlayout();
  const createPlayout = () => fake as unknown as MediaElementPlayout;
  const view = render(
    <MediaElementPlaylistProvider
      track={ME_TRACK}
      samplesPerPixel={ME_SPP}
      createPlayout={createPlayout}
    >
      {playlist}
      <ControlsProbe />
    </MediaElementPlaylistProvider>
  );
  await waitFor(() => expect(fake.addTrack).toHaveBeenCalled());
  await act(async () => {
    fake.emit('loadedmetadata');
  });
  return { fake, view };
}

// -------------------------------------------------------------- WebAudio

const WA_RATE = 48000;

function makeClip(id: string): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: WA_RATE * 4,
    offsetSamples: 0,
    sampleRate: WA_RATE,
    sourceDurationSamples: WA_RATE * 4,
    gain: 1,
  } as AudioClip;
}

const WA_TRACKS: ClipTrack[] = [
  { id: 't1', name: 't1', clips: [makeClip('a')], muted: false, soloed: false, volume: 1, pan: 0 },
] as ClipTrack[];

function createFakeAdapter() {
  let now = 0;
  return {
    audioContext: {
      currentTime: 0,
      sampleRate: WA_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {},
    setTracks() {},
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play() {},
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
    dispose() {},
    setNow(seconds: number) {
      now = seconds;
    },
  };
}

let isReady = false;
let waSamplesPerPixel = 0;
const ReadyProbe: React.FC = () => {
  isReady = usePlaylistTimeline().isReady;
  waSamplesPerPixel = usePlaylistZoom().samplesPerPixel;
  return null;
};
const waPx = (seconds: number) => (seconds * WA_RATE) / waSamplesPerPixel;

async function mountWebAudio(children: React.ReactNode) {
  isReady = false;
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter as unknown as PlayoutAdapter;
  const view = render(
    <WaveformPlaylistProvider tracks={WA_TRACKS} sampleRate={WA_RATE} createAdapter={createAdapter}>
      <ControlsProbe />
      <ReadyProbe />
      {children}
    </WaveformPlaylistProvider>
  );
  await waitFor(() => expect(isReady).toBe(true));
  await act(async () => {});
  return { adapter, view };
}

// ----------------------------------------------------------------- tests

function capturePlayhead() {
  const calls: PlayheadProps[] = [];
  const renderPlayhead = (props: PlayheadProps) => {
    calls.push(props);
    return <div data-custom-playhead />;
  };
  return { calls, renderPlayhead, last: () => calls[calls.length - 1] };
}

function expectRemovedPropsToBeAbsent(props: PlayheadProps) {
  const loose = props as unknown as Record<string, unknown>;
  for (const name of REMOVED_PROPS) {
    // A plain object: a leftover read is `undefined`, not an error.
    expect(name in loose, name).toBe(false);
    expect(loose[name], name).toBeUndefined();
  }
}

describe('a custom playhead gets the same props under both providers', () => {
  it('MediaElementPlaylistProvider: the seven shared props, visualTimeRef included', async () => {
    const { calls, renderPlayhead, last } = capturePlayhead();
    await mountMediaElement(<ComposedMediaElementWaveform renderPlayhead={renderPlayhead} />);
    expect(calls.length).toBeGreaterThan(0);
    expect(Object.keys(last()).sort()).toEqual(SHARED_PROPS);
    // No output latency to compensate for: one ref serves as both.
    expect(last().visualTimeRef).toBe(last().currentTimeRef);

    act(() => controls.seekTo(2));
    expect(last().position).toBe(2 * ME_PX_PER_SECOND);
    expect(last().visualTimeRef.current).toBe(2);
    expect(last().isPlaying).toBe(false);
    expect(last().sampleRate).toBe(ME_RATE);
    expect(last().samplesPerPixel).toBe(ME_SPP);
  });

  it('WaveformPlaylistProvider: the same seven', async () => {
    const { calls, renderPlayhead, last } = capturePlayhead();
    await mountWebAudio(<ComposedWaveform renderPlayhead={renderPlayhead} />);
    expect(calls.length).toBeGreaterThan(0);
    expect(Object.keys(last()).sort()).toEqual(SHARED_PROPS);
    expect(last().visualTimeRef).not.toBe(last().currentTimeRef);

    act(() => controls.seekTo(1.5));
    expect(last().position).toBe(waPx(1.5));
    expect(last().visualTimeRef.current).toBe(1.5);
  });

  it('isPlaying follows playback, under either provider', async () => {
    const mediaElement = capturePlayhead();
    await mountMediaElement(
      <ComposedMediaElementWaveform renderPlayhead={mediaElement.renderPlayhead} />
    );
    expect(mediaElement.last().isPlaying).toBe(false);
    await act(async () => {
      await controls.play();
    });
    expect(mediaElement.last().isPlaying).toBe(true);
    act(() => controls.pause());
    expect(mediaElement.last().isPlaying).toBe(false);
    await act(async () => {
      cleanup();
    });

    const webAudio = capturePlayhead();
    await mountWebAudio(<ComposedWaveform renderPlayhead={webAudio.renderPlayhead} />);
    expect(webAudio.last().isPlaying).toBe(false);
    await act(async () => {
      await controls.play(0);
    });
    expect(webAudio.last().isPlaying).toBe(true);
    act(() => controls.pause());
    expect(webAudio.last().isPlaying).toBe(false);
  });

  it('the five removed props are not passed, under either provider', async () => {
    const mediaElement = capturePlayhead();
    await mountMediaElement(
      <ComposedMediaElementWaveform renderPlayhead={mediaElement.renderPlayhead} />
    );
    expectRemovedPropsToBeAbsent(mediaElement.last());
    await act(async () => {
      cleanup();
    });

    const webAudio = capturePlayhead();
    await mountWebAudio(<ComposedWaveform renderPlayhead={webAudio.renderPlayhead} />);
    expectRemovedPropsToBeAbsent(webAudio.last());
  });
});

describe('the resting playhead under MediaElementPlaylistProvider', () => {
  const playhead = (container: HTMLElement) =>
    container.querySelector<HTMLElement>('[data-playhead]');

  it('is hidden while a range is highlighted and comes back when the selection collapses', async () => {
    const { view } = await mountMediaElement();
    expect(playhead(view.container)).not.toBeNull();

    act(() => controls.setSelection(2, 4));
    expect(playhead(view.container)).toBeNull();

    act(() => controls.setSelection(3, 3));
    expect(playhead(view.container)?.style.transform).toBe(
      `translate3d(${3 * ME_PX_PER_SECOND}px, 0, 0)`
    );
  });

  it('is shown during playback even with a range highlighted, and hidden again at rest', async () => {
    const { fake, view } = await mountMediaElement();
    act(() => controls.setSelection(2, 4));
    await act(async () => {
      await controls.play(2, 2);
    });
    fake.time = 2.5;
    await runFrame();
    expect(playhead(view.container)?.style.transform).toBe(
      `translate3d(${2.5 * ME_PX_PER_SECOND}px, 0, 0)`
    );

    act(() => controls.pause());
    expect(playhead(view.container)).toBeNull();
  });

  it('a custom playhead is not rendered either while a range is highlighted at rest', async () => {
    const { renderPlayhead } = capturePlayhead();
    const { view } = await mountMediaElement(
      <ComposedMediaElementWaveform renderPlayhead={renderPlayhead} />
    );
    expect(view.container.querySelector('[data-custom-playhead]')).not.toBeNull();
    act(() => controls.setSelection(2, 4));
    expect(view.container.querySelector('[data-custom-playhead]')).toBeNull();
  });
});

describe('two visualizations under one WaveformPlaylistProvider', () => {
  it('each animates its own playhead', async () => {
    const { adapter, view } = await mountWebAudio(
      <>
        <ComposedWaveform />
        <ComposedWaveform />
      </>
    );
    const playheads = () =>
      Array.from(view.container.querySelectorAll<HTMLElement>('[data-playhead]'));
    expect(playheads()).toHaveLength(2);

    await act(async () => {
      await controls.play(0);
    });
    adapter.setNow(1);
    await runFrame();
    const at = `translate3d(${waPx(1)}px, 0, 0)`;
    expect(playheads().map((el) => el.style.transform)).toEqual([at, at]);

    adapter.setNow(2);
    await runFrame();
    const later = `translate3d(${waPx(2)}px, 0, 0)`;
    expect(playheads().map((el) => el.style.transform)).toEqual([later, later]);
  });
});

describe('the MediaElement copies are gone', () => {
  const components = resolve(__dirname, '../components');

  it('there is one file for each part', () => {
    expect(existsSync(resolve(components, 'AnimatedPlayhead.tsx'))).toBe(true);
    expect(existsSync(resolve(components, 'ChannelWithProgress.tsx'))).toBe(true);
    expect(existsSync(resolve(components, 'AnimatedMediaElementPlayhead.tsx'))).toBe(false);
    expect(existsSync(resolve(components, 'ChannelWithMediaElementProgress.tsx'))).toBe(false);
  });

  it('MediaElementWaveform defines no playhead wrapper, selection overlay or stub ref of its own', () => {
    const source = readFileSync(resolve(components, 'MediaElementWaveform.tsx'), 'utf8');
    expect(source).not.toMatch(/ZERO_REF/);
    expect(source).not.toMatch(/CustomMediaElementPlayhead/);
    expect(source).not.toMatch(/MediaElementSelectionOverlay/);
    expect(source).not.toMatch(/useSelection\b/);
    expect(source).not.toMatch(/useCurrentTime\b/);
  });
});
