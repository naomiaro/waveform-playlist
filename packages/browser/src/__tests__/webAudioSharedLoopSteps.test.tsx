// @vitest-environment jsdom
//
// #769: the steps of the WaveformPlaylistProvider animation loop that now come
// from the shared provider internals, seen through the real provider: frame
// callbacks get the frame's two times, automatic scroll follows the visual
// time from the first frame when the prop is set, and an annotation that
// plays to its end with continuous play off returns the cursor to where
// playback started.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import {
  WaveformPlaylistProvider,
  usePlaylistControls,
  usePlaylistTimeline,
  usePlaybackRefs,
  useIsPlaying,
  useCurrentTime,
  useActiveAnnotation,
  type FrameData,
} from '../WaveformPlaylistContext';
import type { ClipTrack, AudioClip, AnnotationData } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;
const SAMPLES_PER_PIXEL = 512; // 93.75 px per second
const OUTPUT_LATENCY = 0.25;

const TRACKS: ClipTrack[] = [
  {
    id: 't1',
    name: 't1',
    clips: [
      {
        id: 'c1',
        startSample: 0,
        durationSamples: 20 * SAMPLE_RATE,
        offsetSamples: 0,
        sampleRate: SAMPLE_RATE,
      } as AudioClip,
    ],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack,
];

const ANNOTATIONS: AnnotationData[] = [
  { id: 'a', start: 1, end: 2, lines: ['a'] },
  { id: 'b', start: 2, end: 3, lines: ['b'] },
];
const ANNOTATION_LIST = { annotations: ANNOTATIONS };

function createFakeAdapter() {
  let now = 0;
  const adapter = {
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: OUTPUT_LATENCY,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {},
    setTracks() {},
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play(_when: number, offset?: number) {
      now = offset ?? 0;
    },
    pause() {},
    stop: vi.fn(),
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
  return adapter as typeof adapter & PlayoutAdapter;
}

let probe: {
  isPlaying: boolean;
  isReady: boolean;
  currentTime: number;
  activeAnnotationId: string | null;
  controls: ReturnType<typeof usePlaylistControls>;
  refs: ReturnType<typeof usePlaybackRefs>;
};

const ProbeChild: React.FC = () => {
  probe = {
    isPlaying: useIsPlaying().isPlaying,
    isReady: usePlaylistTimeline().isReady,
    currentTime: useCurrentTime().currentTime,
    activeAnnotationId: useActiveAnnotation().activeAnnotationId,
    controls: usePlaylistControls(),
    refs: usePlaybackRefs(),
  };
  return null;
};

async function mount(automaticScroll = false) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  const onTracksChange = () => {};
  render(
    <WaveformPlaylistProvider
      tracks={TRACKS}
      onTracksChange={onTracksChange}
      sampleRate={SAMPLE_RATE}
      samplesPerPixel={SAMPLES_PER_PIXEL}
      createAdapter={createAdapter}
      annotationList={ANNOTATION_LIST}
      automaticScroll={automaticScroll}
    >
      <ProbeChild />
    </WaveformPlaylistProvider>
  );
  await waitFor(() => expect(probe.isReady).toBe(true));
  return adapter;
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('WaveformPlaylistProvider loop, shared steps', () => {
  it('calls registered frame callbacks with the raw and the visual time of the frame', async () => {
    const adapter = await mount();
    const seen: FrameData[] = [];
    probe.refs.registerFrameCallback('test', (data) => seen.push(data));

    await act(async () => {
      await probe.controls.play(0);
    });
    act(() => adapter.setNow(5));
    await waitFor(() => expect(seen.some((frame) => frame.time === 5)).toBe(true));

    const frame = seen.find((f) => f.time === 5)!;
    expect(frame.sampleRate).toBe(SAMPLE_RATE);
    expect(frame.samplesPerPixel).toBe(SAMPLES_PER_PIXEL);
    // The visual time is behind the raw time by the output latency.
    expect(frame.visualTime).toBeCloseTo(5 - OUTPUT_LATENCY, 5);
    expect(probe.refs.visualTimeRef.current).toBeCloseTo(5 - OUTPUT_LATENCY, 5);

    probe.refs.unregisterFrameCallback('test');
    const count = seen.length;
    act(() => adapter.setNow(6));
    await waitFor(() => expect(probe.refs.currentTimeRef.current).toBe(6));
    expect(seen.length).toBe(count);
    await act(async () => probe.controls.stop());
  });

  it('automatic scroll from the prop centres the VISUAL time, in whole pixels', async () => {
    const adapter = await mount(true);
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 201 });
    probe.controls.setScrollContainer(container);

    await act(async () => {
      await probe.controls.play(0);
    });
    act(() => adapter.setNow(5.013));
    await waitFor(() => expect(probe.refs.currentTimeRef.current).toBe(5.013));
    // (5.013 - 0.25) s * 93.75 px/s = 446.53 px; minus 100.5 = 346.03
    expect(container.scrollLeft).toBe(346);
    await act(async () => probe.controls.stop());
  });

  it('automatic scroll stays off when the prop is not set', async () => {
    const adapter = await mount(false);
    const container = document.createElement('div');
    Object.defineProperty(container, 'clientWidth', { value: 201 });
    probe.controls.setScrollContainer(container);

    await act(async () => {
      await probe.controls.play(0);
    });
    act(() => adapter.setNow(5));
    await waitFor(() => expect(probe.refs.currentTimeRef.current).toBe(5));
    expect(container.scrollLeft).toBe(0);

    // Switched on while playing: the running loop sees it on its next frame.
    act(() => probe.controls.setAutomaticScroll(true));
    act(() => adapter.setNow(6));
    await waitFor(() => expect(probe.refs.currentTimeRef.current).toBe(6));
    expect(container.scrollLeft).toBe(439); // 5.75 s * 93.75 - 100.5 = 438.56
    await act(async () => probe.controls.stop());
  });

  it('continuous play off: an annotation that reaches its end stops and the cursor returns to its start', async () => {
    const adapter = await mount();
    await act(async () => {
      probe.controls.setActiveAnnotationId('a');
      await probe.controls.play(1);
    });
    expect(probe.isPlaying).toBe(true);

    act(() => adapter.setNow(2.01));
    await waitFor(() => expect(probe.isPlaying).toBe(false));
    expect(adapter.stop).toHaveBeenCalled();
    expect(probe.currentTime).toBe(1);
    expect(probe.refs.currentTimeRef.current).toBe(1);
    expect(probe.activeAnnotationId).toBe('a');
  });
});
