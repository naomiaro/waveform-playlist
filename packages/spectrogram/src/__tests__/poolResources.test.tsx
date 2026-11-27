// #821: what the provider keeps in the worker pool. The pool is the one owner
// of which audio it holds (`registeredAudioClipIds`); the provider asks it, so
// a pool made again after a cleanup that keeps the component (an <Activity>
// hide and reveal, StrictMode) is given the audio again. Audio is registered
// once per AudioBuffer, only while a track that uses it draws a spectrogram,
// and released when no such clip is left.
//
// The provider with a fake worker pool that keeps its audio the way the real
// one does (terminate clears it), and the four browser hooks it reads, faked.
import React, { Activity, StrictMode } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import type {
  ClipTrack,
  AudioClip,
  RenderMode,
  SpectrogramCanvasRegistration,
  SpectrogramConfig,
  ColorMapValue,
} from '@waveform-playlist/core';

interface FakePool {
  audio: Map<string, number>;
  terminated: boolean;
  fftClipIds: string[];
}

const fake = vi.hoisted(() => ({
  arrangement: { updateTrack() {} },
  timeline: { tracks: [] as unknown[], isReady: true },
  values: [] as Array<{
    setTrackRenderMode: (trackId: string, mode: RenderMode) => void;
    setTrackSpectrogramConfig: (
      trackId: string,
      config: SpectrogramConfig,
      colorMap?: ColorMapValue
    ) => void;
    registerSpectrogramCanvas: (reg: SpectrogramCanvasRegistration) => void;
  }>,
  pools: [] as FakePool[],
  scrollContainerRef: { current: null },
  view: { mono: false },
  zoom: { samplesPerPixel: 100 },
}));

vi.mock('@dawcore/spectrogram', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dawcore/spectrogram')>();
  return {
    ...actual,
    createSpectrogramWorkerPool: () => {
      const pool: FakePool = { audio: new Map(), terminated: false, fftClipIds: [] };
      fake.pools.push(pool);
      return {
        registerAudioData(clipId: string, channelDataArrays: Float32Array[]) {
          if (pool.terminated) return;
          pool.audio.set(clipId, channelDataArrays.length);
        },
        unregisterAudioData(clipId: string) {
          if (pool.terminated) return;
          pool.audio.delete(clipId);
        },
        registeredAudioClipIds: () => [...pool.audio.keys()],
        abortGeneration() {},
        registerCanvas() {},
        unregisterCanvas() {},
        async computeFFT(params: { clipId: string }) {
          pool.fftClipIds.push(params.clipId);
          return { cacheKey: `key-${pool.fftClipIds.length}` };
        },
        async renderChunks() {},
        terminate() {
          pool.terminated = true;
          pool.audio.clear();
        },
      };
    },
  };
});

vi.mock('@waveform-playlist/browser', () => ({
  SpectrogramIntegrationContext: ({
    value,
    children,
  }: {
    value: (typeof fake.values)[number];
    children: React.ReactNode;
  }) => {
    fake.values.push(value);
    return children;
  },
  usePlaybackControls: () => ({ scrollContainerRef: fake.scrollContainerRef }),
  usePlaylistView: () => fake.view,
  usePlaylistZoom: () => fake.zoom,
  usePlaylistTimeline: () => fake.timeline,
  // The setters' writes are covered with a real arrangement in
  // choicesOnTheTrack.test.tsx; here the tracks are set by the test.
  // One object, as the real hook returns.
  useArrangement: () => fake.arrangement,
}));

import { SpectrogramProvider } from '../SpectrogramProvider';

const SAMPLE_RATE = 48000;

function makeBuffer(): AudioBuffer {
  const channel = new Float32Array(SAMPLE_RATE);
  return {
    numberOfChannels: 1,
    sampleRate: SAMPLE_RATE,
    getChannelData: () => channel,
  } as unknown as AudioBuffer;
}

function makeClip(id: string, audioBuffer: AudioBuffer): AudioClip {
  return {
    id,
    startSample: 0,
    offsetSamples: 0,
    durationSamples: SAMPLE_RATE,
    sampleRate: SAMPLE_RATE,
    audioBuffer,
  } as AudioClip;
}

function makeTrack(id: string, renderMode: RenderMode, clips: AudioClip[]): ClipTrack {
  return {
    id,
    name: id,
    kind: 'audio',
    renderMode,
    clips,
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as unknown as ClipTrack;
}

function canvas(clipId: string): SpectrogramCanvasRegistration {
  return {
    canvasId: `${clipId}-ch0-chunk0`,
    canvas: {} as OffscreenCanvas,
    clipId,
    channelIndex: 0,
    chunkIndex: 0,
    widthPx: 480,
    heightPx: 80,
  };
}

function setTracks(tracks: ClipTrack[]) {
  fake.timeline = { tracks, isReady: true };
}

/** The pool the provider uses now: the last one made, not terminated. */
function livePool(): FakePool {
  const pool = fake.pools[fake.pools.length - 1];
  expect(pool?.terminated).toBe(false);
  return pool;
}

const latestValue = () => fake.values[fake.values.length - 1];

const settle = () => act(async () => {});

afterEach(() => {
  cleanup();
  fake.pools = [];
  fake.values = [];
});

describe('SpectrogramProvider keeps the pool it has with the audio it needs (#821)', () => {
  it('under StrictMode the pool in use holds the audio after the simulated remount', async () => {
    setTracks([makeTrack('t1', 'spectrogram', [makeClip('c1', makeBuffer())])]);
    render(
      <StrictMode>
        <SpectrogramProvider>
          <div />
        </SpectrogramProvider>
      </StrictMode>
    );
    await settle();

    expect(fake.pools.length).toBeGreaterThan(1);
    expect(livePool().audio.size).toBe(1);
  });

  it('after an <Activity> hide and reveal the pool in use holds the audio', async () => {
    setTracks([makeTrack('t1', 'spectrogram', [makeClip('c1', makeBuffer())])]);
    const tree = (mode: 'visible' | 'hidden') => (
      <Activity mode={mode}>
        <SpectrogramProvider>
          <div />
        </SpectrogramProvider>
      </Activity>
    );
    const view = render(tree('visible'));
    await settle();
    view.rerender(tree('hidden'));
    await settle();
    expect(fake.pools.every((p) => p.terminated)).toBe(true);

    view.rerender(tree('visible'));
    await settle();

    expect(livePool().audio.size).toBe(1);
  });

  it('removing the last track releases its audio', async () => {
    setTracks([makeTrack('t1', 'spectrogram', [makeClip('c1', makeBuffer())])]);
    const view = render(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await settle();
    expect(livePool().audio.size).toBe(1);

    setTracks([]);
    view.rerender(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await settle();

    expect(livePool().audio.size).toBe(0);
  });
});

describe('SpectrogramProvider sends audio only while a track draws a spectrogram (#821)', () => {
  it('a waveform track sends nothing and makes no pool', async () => {
    setTracks([makeTrack('t1', 'waveform', [makeClip('c1', makeBuffer())])]);
    render(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await settle();

    expect(fake.pools).toEqual([]);
  });

  it.each([
    ['before', 'after'],
    ['after', 'before'],
  ])(
    "a waveform track's clip on a buffer a spectrogram track also uses keeps that audio (spectrogram track %s)",
    async (spectrogramPosition) => {
      const buffer = makeBuffer();
      const spectrogramTrack = makeTrack('t2', 'spectrogram', [makeClip('c2', buffer)]);
      const waveformTrack = makeTrack('t1', 'waveform', [makeClip('c1', buffer)]);
      setTracks(
        spectrogramPosition === 'before'
          ? [spectrogramTrack, waveformTrack]
          : [waveformTrack, spectrogramTrack]
      );
      render(
        <SpectrogramProvider>
          <div />
        </SpectrogramProvider>
      );
      await settle();

      expect(livePool().audio.size).toBe(1);
    }
  );
});

describe('SpectrogramProvider registers each AudioBuffer once (#821)', () => {
  it('two clips on one buffer (a split) share one registration and one audio key', async () => {
    const buffer = makeBuffer();
    setTracks([makeTrack('t1', 'spectrogram', [makeClip('c1', buffer), makeClip('c2', buffer)])]);
    render(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await settle();
    expect(livePool().audio.size).toBe(1);

    await act(async () => {
      latestValue().registerSpectrogramCanvas(canvas('c1'));
      latestValue().registerSpectrogramCanvas(canvas('c2'));
    });
    await settle();

    const [key] = [...livePool().audio.keys()];
    expect(livePool().fftClipIds.length).toBeGreaterThanOrEqual(2);
    expect(new Set(livePool().fftClipIds)).toEqual(new Set([key]));
  });

  it('clips on different buffers get different registrations', async () => {
    setTracks([
      makeTrack('t1', 'spectrogram', [makeClip('c1', makeBuffer()), makeClip('c2', makeBuffer())]),
    ]);
    render(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await settle();

    expect(livePool().audio.size).toBe(2);
  });

  it('the audio stays while one clip on the buffer is left, and goes with the last', async () => {
    const buffer = makeBuffer();
    const c1 = makeClip('c1', buffer);
    const c2 = makeClip('c2', buffer);
    setTracks([makeTrack('t1', 'spectrogram', [c1, c2])]);
    const view = render(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await settle();

    setTracks([makeTrack('t1', 'spectrogram', [c2])]);
    view.rerender(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await settle();
    expect(livePool().audio.size).toBe(1);

    setTracks([makeTrack('t1', 'spectrogram', [])]);
    view.rerender(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await settle();
    expect(livePool().audio.size).toBe(0);
  });
});

describe('SpectrogramProvider compares config and colorMap by content (#821)', () => {
  function mountWith(config: SpectrogramConfig, colorMap: ColorMapValue) {
    setTracks([makeTrack('t1', 'spectrogram', [makeClip('c1', makeBuffer())])]);
    return render(
      <SpectrogramProvider config={config} colorMap={colorMap}>
        <div />
      </SpectrogramProvider>
    );
  }

  it('an inline config and colour map equal to the last ones keep the integration value', async () => {
    const view = mountWith({ fftSize: 2048 }, [
      [0, 0, 0],
      [255, 255, 255],
    ]);
    await settle();
    const before = latestValue();

    view.rerender(
      <SpectrogramProvider
        config={{ fftSize: 2048 }}
        colorMap={[
          [0, 0, 0],
          [255, 255, 255],
        ]}
      >
        <div />
      </SpectrogramProvider>
    );
    await settle();

    expect(latestValue()).toBe(before);
  });

  it('a config with other content gives a new integration value', async () => {
    const view = mountWith({ fftSize: 2048 }, 'viridis');
    await settle();
    const before = latestValue();

    view.rerender(
      <SpectrogramProvider config={{ fftSize: 4096 }} colorMap="viridis">
        <div />
      </SpectrogramProvider>
    );
    await settle();

    expect(latestValue()).not.toBe(before);
  });

  it('a colour map with other content gives a new integration value', async () => {
    const view = mountWith({ fftSize: 2048 }, 'viridis');
    await settle();
    const before = latestValue();

    view.rerender(
      <SpectrogramProvider config={{ fftSize: 2048 }} colorMap="magma">
        <div />
      </SpectrogramProvider>
    );
    await settle();

    expect(latestValue()).not.toBe(before);
  });
});
