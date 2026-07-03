import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpectrogramOrchestrator } from '../src/orchestrator/SpectrogramOrchestrator';
import type { SpectrogramConfig } from '@waveform-playlist/core';

const defaultConfig: SpectrogramConfig = {
  fftSize: 2048,
  frequencyScale: 'mel',
};

function makeMockWorker() {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null,
    onerror: null,
  } as unknown as Worker;
}

function makeMockPool() {
  return {
    registerCanvas: vi.fn(),
    unregisterCanvas: vi.fn(),
    registerAudioData: vi.fn(),
    unregisterAudioData: vi.fn(),
    computeFFT: vi.fn(() => Promise.resolve({ cacheKey: 'k' })),
    renderChunks: vi.fn(() => Promise.resolve()),
    abortGeneration: vi.fn(),
    terminate: vi.fn(),
  };
}

const wideViewport = {
  visibleStartPx: 0,
  visibleEndPx: 10000,
  bufferStartPx: 0,
  bufferEndPx: 10000,
  samplesPerPixel: 1024,
};

describe('SpectrogramOrchestrator — render groups never mix channels or clips (#553)', () => {
  let orch: SpectrogramOrchestrator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPool: any;

  beforeEach(() => {
    mockPool = makeMockPool();
    orch = new SpectrogramOrchestrator({
      workerFactory: () => makeMockWorker(),
      workerPoolSize: 2,
      config: defaultConfig,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (orch as any).pool = mockPool; // test-only seam (same as orchestrator.test.ts)
  });

  function registerCanvases(clipId: string, channelIndex: number, chunkCount: number): void {
    for (let i = 0; i < chunkCount; i++) {
      orch.registerCanvas({
        canvasId: clipId + '-ch' + channelIndex + '-chunk' + i,
        canvas: { width: 1000, height: 100 } as unknown as OffscreenCanvas,
        clipId,
        trackId: 't1',
        channelIndex,
        chunkIndex: i,
        globalPixelOffset: i * 1000,
        widthPx: 1000,
        heightPx: 100,
      });
    }
  }

  it('stereo track: every renderChunks call contains canvases of a single channel, routed by that channel', async () => {
    orch.registerClip({
      clipId: 'c1',
      trackId: 't1',
      channelData: [new Float32Array(48000), new Float32Array(48000)],
      sampleRate: 48000,
      durationSamples: 48000,
      offsetSamples: 0,
    });
    // Same registration order as <daw-spectrogram>: all ch0 chunks, then all ch1 chunks.
    registerCanvases('c1', 0, 3);
    registerCanvases('c1', 1, 3);

    orch.setViewport(wideViewport);
    await new Promise((r) => setTimeout(r, 20));

    const calls = mockPool.renderChunks.mock.calls.map(
      (c: [{ canvasIds: string[]; channelIndex: number }]) => c[0]
    );
    expect(calls.length).toBeGreaterThan(0);

    const renderedIds = new Set<string>();
    for (const params of calls) {
      const channelsInCall = new Set(
        params.canvasIds.map((id: string) => /-ch(\d+)-/.exec(id)![1])
      );
      // A single renderChunks call must never span two channels.
      expect(channelsInCall.size).toBe(1);
      // And its routing channelIndex must match the canvases it carries.
      expect(String(params.channelIndex)).toBe([...channelsInCall][0]);
      for (const id of params.canvasIds) renderedIds.add(id);
    }

    // Every registered canvas gets rendered — none dropped by mixed grouping.
    for (const ch of [0, 1]) {
      for (let i = 0; i < 3; i++) {
        expect(renderedIds.has('c1-ch' + ch + '-chunk' + i)).toBe(true);
      }
    }
  });

  it('two mono clips on one track: every renderChunks call belongs to a single clip', async () => {
    for (const clipId of ['cA', 'cB']) {
      orch.registerClip({
        clipId,
        trackId: 't1',
        channelData: [new Float32Array(48000)],
        sampleRate: 48000,
        durationSamples: 48000,
        offsetSamples: 0,
      });
      registerCanvases(clipId, 0, 2);
    }

    orch.setViewport(wideViewport);
    await new Promise((r) => setTimeout(r, 20));

    const calls = mockPool.renderChunks.mock.calls.map(
      (c: [{ canvasIds: string[] }]) => c[0]
    );
    expect(calls.length).toBeGreaterThan(0);

    const renderedIds = new Set<string>();
    for (const params of calls) {
      const clipsInCall = new Set(
        params.canvasIds.map((id: string) => id.split('-ch')[0])
      );
      expect(clipsInCall.size).toBe(1);
      for (const id of params.canvasIds) renderedIds.add(id);
    }
    expect(renderedIds.size).toBe(4);
  });

  it('contiguous same-clip same-channel chunks still batch into one renderChunks call', async () => {
    orch.registerClip({
      clipId: 'c1',
      trackId: 't1',
      channelData: [new Float32Array(48000)],
      sampleRate: 48000,
      durationSamples: 48000,
      offsetSamples: 0,
    });
    registerCanvases('c1', 0, 3);

    orch.setViewport(wideViewport);
    await new Promise((r) => setTimeout(r, 20));

    // All three chunks are in the viewport tier and contiguous → single grouped call.
    const viewportCall = mockPool.renderChunks.mock.calls[0][0];
    expect(viewportCall.canvasIds).toEqual([
      'c1-ch0-chunk0',
      'c1-ch0-chunk1',
      'c1-ch0-chunk2',
    ]);
  });
});
