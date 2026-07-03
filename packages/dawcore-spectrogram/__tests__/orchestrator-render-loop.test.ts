import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SpectrogramOrchestrator } from '../src/orchestrator/SpectrogramOrchestrator';
import type { SpectrogramConfig } from '@waveform-playlist/core';
import { makeOrchestratorWithMockPool, type MockPool } from './helpers/orchestratorTestUtils';

const defaultConfig: SpectrogramConfig = { fftSize: 2048, frequencyScale: 'mel' };

const viewport = {
  visibleStartPx: 0,
  visibleEndPx: 2000,
  bufferStartPx: 0,
  bufferEndPx: 2000,
  samplesPerPixel: 10,
};

function registerClipAndCanvas(orch: SpectrogramOrchestrator, chunkIndex = 0): void {
  if (chunkIndex === 0) {
    orch.registerClip({
      clipId: 'c1',
      trackId: 't1',
      channelData: [new Float32Array(48000)],
      sampleRate: 48000,
      durationSamples: 48000,
      offsetSamples: 0,
    });
  }
  orch.registerCanvas({
    canvasId: 'c1-ch0-chunk' + chunkIndex,
    canvas: { width: 1000, height: 100 } as unknown as OffscreenCanvas,
    clipId: 'c1',
    trackId: 't1',
    channelIndex: 0,
    chunkIndex,
    globalPixelOffset: chunkIndex * 1000,
    widthPx: 1000,
    heightPx: 100,
  });
}

describe('SpectrogramOrchestrator — render loop (#558)', () => {
  let orch: SpectrogramOrchestrator;
  let mockPool: MockPool;

  beforeEach(() => {
    ({ orch, mockPool } = makeOrchestratorWithMockPool(defaultConfig));
  });

  it('coalesces schedule requests that arrive while a render is in flight', async () => {
    let releaseCompute: (v: { cacheKey: string }) => void = () => {};
    mockPool.computeFFT.mockImplementation(
      () => new Promise<{ cacheKey: string }>((resolve) => (releaseCompute = resolve))
    );

    registerClipAndCanvas(orch, 0);
    orch.setViewport(viewport);
    await new Promise((r) => setTimeout(r, 5));
    expect(mockPool.computeFFT).toHaveBeenCalledTimes(1);

    // A canvas registration mid-render must NOT start a concurrent runRender
    // for the same generation.
    registerClipAndCanvas(orch, 1);
    await new Promise((r) => setTimeout(r, 5));
    expect(mockPool.computeFFT).toHaveBeenCalledTimes(1);

    // ...but the queued request must run after the in-flight render settles,
    // picking up the new canvas.
    mockPool.computeFFT.mockImplementation(() => Promise.resolve({ cacheKey: 'k' }));
    releaseCompute({ cacheKey: 'k' });
    await new Promise((r) => setTimeout(r, 10));
    expect(mockPool.computeFFT.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('retries a render group once when the FFT cache entry was evicted between compute and render', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const errors: unknown[] = [];
    orch.addEventListener('viewport-error', (e) => errors.push((e as CustomEvent).detail));

    mockPool.renderChunks
      .mockImplementationOnce(() =>
        Promise.reject(new Error('cache-miss: key "k" not found (cache has 0 entries)'))
      )
      .mockImplementation(() => Promise.resolve());

    registerClipAndCanvas(orch, 0);
    orch.setViewport(viewport);
    await new Promise((r) => setTimeout(r, 15));

    // Recomputed + re-rendered instead of surfacing a viewport-error.
    expect(mockPool.computeFFT).toHaveBeenCalledTimes(2);
    expect(mockPool.renderChunks).toHaveBeenCalledTimes(2);
    expect(errors).toEqual([]);
    warnSpy.mockRestore();
  });
});
