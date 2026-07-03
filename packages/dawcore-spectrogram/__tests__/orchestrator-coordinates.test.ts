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

/**
 * Canvas `globalPixelOffset` is TIMELINE-absolute (<daw-spectrogram> registers
 * `originX + chunkIndex * 1000`, and viewport classification uses scroll
 * pixels). File-space sample math must therefore use CLIP-RELATIVE pixels —
 * `chunkIndex * MAX_CANVAS_WIDTH` — or a clip placed at timeline position T
 * computes its FFT over audio shifted late by T samples (#554).
 */
describe('SpectrogramOrchestrator — clip-relative sample ranges (#554)', () => {
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
  });

  it('a trimmed clip positioned mid-timeline gets an FFT range derived from clip-relative pixels', async () => {
    // Clip: audio-file offset 4000, 40000 samples long, placed at timeline
    // pixel 5000 (originX = 5000). Two 1000px chunks at 10 samples/pixel.
    orch.registerClip({
      clipId: 'c1',
      trackId: 't1',
      channelData: [new Float32Array(48000)],
      sampleRate: 48000,
      durationSamples: 40000,
      offsetSamples: 4000,
    });
    for (let i = 0; i < 2; i++) {
      orch.registerCanvas({
        canvasId: 'c1-ch0-chunk' + i,
        canvas: { width: 1000, height: 100 } as unknown as OffscreenCanvas,
        clipId: 'c1',
        trackId: 't1',
        channelIndex: 0,
        chunkIndex: i,
        globalPixelOffset: 5000 + i * 1000, // timeline-absolute
        widthPx: 1000,
        heightPx: 100,
      });
    }

    orch.setViewport({
      visibleStartPx: 5000,
      visibleEndPx: 7000,
      bufferStartPx: 5000,
      bufferEndPx: 7000,
      samplesPerPixel: 10,
    });
    await new Promise((r) => setTimeout(r, 10));

    expect(mockPool.computeFFT).toHaveBeenCalled();
    const fftParams = mockPool.computeFFT.mock.calls[0][0];
    // Clip-relative pixels 0..2000 at 10 spp → file samples 4000..24000,
    // padded by fftSize (2048) and clamped to the clip: [4000, 26048].
    expect(fftParams.sampleRange).toEqual({ start: 4000, end: 26048 });

    expect(mockPool.renderChunks).toHaveBeenCalled();
    const renderParams = mockPool.renderChunks.mock.calls[0][0];
    // renderChunks pixel offsets are clip-relative (chunkIndex * 1000),
    // matching the worker's fileSample = offsetSamples + pixel · spp mapping.
    expect(renderParams.globalPixelOffsets).toEqual([0, 1000]);
  });
});
