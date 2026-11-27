// #812: the view draws a clip for a range of its audio the tracks may not have
// yet (a trim being dragged), and its canvases register with that range. The
// provider renders each clip for the range its canvases registered with, and
// for the track's clip when a registration has none.
//
// The provider with a fake worker pool (what the worker is asked to compute and
// draw is recorded) and the four browser hooks it reads, faked.
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import type { ClipTrack, AudioClip, SpectrogramCanvasRegistration } from '@waveform-playlist/core';

const fake = vi.hoisted(() => ({
  arrangement: { updateTrack() {} },
  timeline: { tracks: [] as unknown[], isReady: true },
  integration: null as null | {
    registerSpectrogramCanvas: (reg: SpectrogramCanvasRegistration) => void;
    unregisterSpectrogramCanvas: (canvasId: string) => void;
  },
  computeFFT: [] as Array<{ offsetSamples: number; durationSamples: number }>,
  renderChunks: [] as Array<{ canvasIds: string[] }>,
  registerCanvas: [] as string[],
  scrollContainerRef: { current: null },
  view: { mono: false },
  zoom: { samplesPerPixel: 100 },
}));

vi.mock('@dawcore/spectrogram', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dawcore/spectrogram')>();
  return {
    ...actual,
    createSpectrogramWorkerPool: () => {
      const audio = new Set<string>();
      return {
        registerAudioData(key: string) {
          audio.add(key);
        },
        unregisterAudioData(key: string) {
          audio.delete(key);
        },
        registeredAudioClipIds: () => [...audio],
        abortGeneration() {},
        registerCanvas(canvasId: string) {
          fake.registerCanvas.push(canvasId);
        },
        unregisterCanvas() {},
        async computeFFT(params: { offsetSamples: number; durationSamples: number }) {
          fake.computeFFT.push({
            offsetSamples: params.offsetSamples,
            durationSamples: params.durationSamples,
          });
          return { cacheKey: `key-${fake.computeFFT.length}` };
        },
        async renderChunks(params: { canvasIds: string[] }) {
          fake.renderChunks.push({ canvasIds: params.canvasIds });
        },
        terminate() {},
      };
    },
  };
});

vi.mock('@waveform-playlist/browser', () => ({
  SpectrogramIntegrationProvider: ({
    value,
    children,
  }: {
    value: typeof fake.integration;
    children: React.ReactNode;
  }) => {
    fake.integration = value;
    return children;
  },
  usePlaybackControls: () => ({ scrollContainerRef: fake.scrollContainerRef }),
  usePlaylistView: () => fake.view,
  usePlaylistZoom: () => fake.zoom,
  usePlaylistTimeline: () => fake.timeline,
  // One object, as the real hook returns.
  useArrangement: () => fake.arrangement,
}));

import { SpectrogramProvider } from '../SpectrogramProvider';

const SAMPLE_RATE = 48000;

function makeTrack(clip: Partial<AudioClip>): ClipTrack {
  const audioBuffer = {
    numberOfChannels: 1,
    sampleRate: SAMPLE_RATE,
    getChannelData: () => new Float32Array(SAMPLE_RATE * 4),
  } as unknown as AudioBuffer;
  return {
    id: 't1',
    name: 't1',
    kind: 'audio',
    renderMode: 'spectrogram',
    clips: [
      {
        id: 'c1',
        startSample: 0,
        offsetSamples: SAMPLE_RATE,
        durationSamples: SAMPLE_RATE,
        sampleRate: SAMPLE_RATE,
        audioBuffer,
        ...clip,
      } as AudioClip,
    ],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

function registration(extra: Partial<SpectrogramCanvasRegistration> = {}) {
  return {
    canvasId: 'c1-ch0-chunk0',
    canvas: {} as OffscreenCanvas,
    clipId: 'c1',
    channelIndex: 0,
    chunkIndex: 0,
    widthPx: 480,
    heightPx: 80,
    ...extra,
  };
}

async function mount(track: ClipTrack) {
  fake.timeline = { tracks: [track], isReady: true };
  const view = render(
    <SpectrogramProvider>
      <div />
    </SpectrogramProvider>
  );
  await act(async () => {});
  return view;
}

/** Registers a canvas, lets the render effect run and the worker calls settle. */
async function register(reg: SpectrogramCanvasRegistration) {
  await act(async () => {
    fake.integration!.registerSpectrogramCanvas(reg);
  });
  await act(async () => {});
}

function resetCalls() {
  fake.computeFFT = [];
  fake.renderChunks = [];
  fake.registerCanvas = [];
}

afterEach(() => {
  cleanup();
  resetCalls();
});

describe('SpectrogramProvider renders the range a canvas registered with (#812)', () => {
  it("a clip is rendered with the geometry its canvases registered with, not the committed track's", async () => {
    await mount(makeTrack({}));
    resetCalls();

    // The view draws the clip trimmed: 0.25 s further into the audio, 0.25 s shorter.
    await register(registration({ offsetSamples: 60_000, durationSamples: 36_000 }));

    expect(fake.computeFFT).toEqual([{ offsetSamples: 60_000, durationSamples: 36_000 }]);
    // What one registration costs: one canvas handed over, one FFT, one draw.
    expect(fake.registerCanvas).toEqual(['c1-ch0-chunk0']);
    expect(fake.renderChunks).toEqual([{ canvasIds: ['c1-ch0-chunk0'] }]);
  });

  it('a registration without geometry is rendered from the committed track', async () => {
    await mount(makeTrack({}));
    resetCalls();

    await register(registration());

    expect(fake.computeFFT).toEqual([{ offsetSamples: SAMPLE_RATE, durationSamples: SAMPLE_RATE }]);
  });

  it('a canvas registered again without geometry is rendered from the committed track again', async () => {
    await mount(makeTrack({}));
    await register(registration({ offsetSamples: 60_000, durationSamples: 36_000 }));
    resetCalls();

    // The same canvas id with a new canvas and no range: the old range is gone.
    await register(registration());

    expect(fake.computeFFT).toEqual([{ offsetSamples: SAMPLE_RATE, durationSamples: SAMPLE_RATE }]);
  });

  it('a committed track equal to the registered range redraws nothing (the release of a trim)', async () => {
    const view = await mount(makeTrack({}));
    await register(registration({ offsetSamples: 60_000, durationSamples: 36_000 }));
    resetCalls();

    // The trim is committed as it was drawn: the canvases do not register again.
    fake.timeline = {
      tracks: [makeTrack({ offsetSamples: 60_000, durationSamples: 36_000, startSample: 12_000 })],
      isReady: true,
    };
    view.rerender(
      <SpectrogramProvider>
        <div />
      </SpectrogramProvider>
    );
    await act(async () => {});

    expect(fake.computeFFT).toEqual([]);
    expect(fake.renderChunks).toEqual([]);
  });
});
