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

const viewportA = {
  visibleStartPx: 0,
  visibleEndPx: 500,
  bufferStartPx: 0,
  bufferEndPx: 1000,
  samplesPerPixel: 1024,
};
const viewportB = { ...viewportA, visibleStartPx: 100, visibleEndPx: 600 };

/**
 * Worker staleness semantics (spectrogram.worker.ts): on `abort-generation`
 * the worker sets `latestGeneration = max(latest, msg.generation)` and treats
 * work as stale iff `generation < latestGeneration`. So the caller must pass
 * the NEW generation — the previous generation's in-flight work is stale only
 * when the abort argument is strictly greater than it (#555).
 */
describe('SpectrogramOrchestrator — abortGeneration passes the new generation (#555)', () => {
  let orch: SpectrogramOrchestrator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPool: any;

  beforeEach(() => {
    mockPool = makeMockPool();
    orch = new SpectrogramOrchestrator({
      workerFactory: () => makeMockWorker(),
      workerPoolSize: 1,
      config: defaultConfig,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (orch as any).pool = mockPool; // test-only seam (same as orchestrator.test.ts)

    orch.registerClip({
      clipId: 'c1',
      trackId: 't1',
      channelData: [new Float32Array(48000)],
      sampleRate: 48000,
      durationSamples: 48000,
      offsetSamples: 0,
    });
    orch.registerCanvas({
      canvasId: 'c1-ch0-chunk0',
      canvas: { width: 1000, height: 100 } as unknown as OffscreenCanvas,
      clipId: 'c1',
      trackId: 't1',
      channelIndex: 0,
      chunkIndex: 0,
      globalPixelOffset: 0,
      widthPx: 1000,
      heightPx: 100,
    });
  });

  it('setViewport aborts with a generation that makes the previous render stale', async () => {
    orch.setViewport(viewportA);
    await new Promise((r) => setTimeout(r, 10));
    const firstRenderGen = mockPool.computeFFT.mock.calls[0][1];

    orch.setViewport(viewportB);
    await new Promise((r) => setTimeout(r, 10));

    const abortArg =
      mockPool.abortGeneration.mock.calls[mockPool.abortGeneration.mock.calls.length - 1][0];
    // Strict-< staleness in the worker: the previous generation is cancelled
    // only if the abort argument is greater than it.
    expect(abortArg).toBeGreaterThan(firstRenderGen);

    // ...and the new render must survive its own abort (stale iff gen < abortArg).
    const secondRenderGen =
      mockPool.computeFFT.mock.calls[mockPool.computeFFT.mock.calls.length - 1][1];
    expect(abortArg).toBe(secondRenderGen);
  });

  it.each(['setConfig', 'setColorMap', 'setDevicePixelRatio'] as const)(
    '%s aborts with a generation greater than the in-flight render generation',
    async (setter) => {
      orch.setViewport(viewportA);
      await new Promise((r) => setTimeout(r, 10));
      const firstRenderGen = mockPool.computeFFT.mock.calls[0][1];

      if (setter === 'setConfig') orch.setConfig({ ...defaultConfig, gainDb: 30 });
      else if (setter === 'setColorMap') orch.setColorMap('magma');
      else orch.setDevicePixelRatio(3);

      const abortArg =
        mockPool.abortGeneration.mock.calls[mockPool.abortGeneration.mock.calls.length - 1][0];
      expect(abortArg).toBeGreaterThan(firstRenderGen);
    }
  );
});
