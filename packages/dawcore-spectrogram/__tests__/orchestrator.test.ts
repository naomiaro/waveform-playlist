import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpectrogramOrchestrator } from '../src/orchestrator/SpectrogramOrchestrator';
import type { SpectrogramConfig } from '@waveform-playlist/core';

const defaultConfig: SpectrogramConfig = {
  fftSize: 2048,
  frequencyScale: 'mel',
};

function makeMockWorker() {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
  };
  return worker as unknown as Worker;
}

describe('SpectrogramOrchestrator — construction', () => {
  it('creates a worker pool via the supplied factory', () => {
    const factory = vi.fn(() => makeMockWorker());
    new SpectrogramOrchestrator({
      workerFactory: factory,
      workerPoolSize: 2,
      config: defaultConfig,
    });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('defaults workerPoolSize to 2 when omitted', () => {
    const factory = vi.fn(() => makeMockWorker());
    new SpectrogramOrchestrator({ workerFactory: factory, config: defaultConfig });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('dispose() terminates each worker exactly once', () => {
    const workers: ReturnType<typeof makeMockWorker>[] = [];
    const factory = vi.fn(() => {
      const w = makeMockWorker();
      workers.push(w);
      return w;
    });
    const orch = new SpectrogramOrchestrator({
      workerFactory: factory,
      workerPoolSize: 3,
      config: defaultConfig,
    });
    orch.dispose();
    for (const w of workers) {
      expect(w.terminate).toHaveBeenCalledTimes(1);
    }
  });
});

describe('SpectrogramOrchestrator — clip registration', () => {
  let orch: SpectrogramOrchestrator;
  beforeEach(() => {
    orch = new SpectrogramOrchestrator({
      workerFactory: () => makeMockWorker(),
      workerPoolSize: 2,
      config: defaultConfig,
    });
  });

  it('registerClip stores clip metadata accessible by clipId', () => {
    orch.registerClip({
      clipId: 'c1',
      trackId: 't1',
      channelData: [new Float32Array(1024), new Float32Array(1024)],
      sampleRate: 44100,
      durationSamples: 1024,
      offsetSamples: 0,
    });
    expect(() => orch.unregisterClip('c1')).not.toThrow();
  });

  it('unregisterClip on unknown clipId is a no-op (does not throw)', () => {
    expect(() => orch.unregisterClip('nonexistent')).not.toThrow();
  });
});

describe('SpectrogramOrchestrator — canvas registration', () => {
  let orch: SpectrogramOrchestrator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPool: any;

  function makeMockPool() {
    return {
      registerCanvas: vi.fn(),
      unregisterCanvas: vi.fn(),
      registerAudioData: vi.fn(),
      unregisterAudioData: vi.fn(),
      computeFFT: vi.fn(() => Promise.resolve({ cacheKey: 'key' })),
      renderChunks: vi.fn(() => Promise.resolve()),
      abortGeneration: vi.fn(),
      terminate: vi.fn(),
    };
  }

  beforeEach(() => {
    mockPool = makeMockPool();
    orch = new SpectrogramOrchestrator({
      workerFactory: () => makeMockWorker(),
      workerPoolSize: 2,
      config: defaultConfig,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (orch as any).pool = mockPool; // test-only seam
  });

  it('registerCanvas forwards OffscreenCanvas to worker pool', () => {
    const canvas = { width: 100, height: 100 } as unknown as OffscreenCanvas;
    orch.registerCanvas({
      canvasId: 'c1-ch0-chunk0',
      canvas,
      clipId: 'c1',
      trackId: 't1',
      channelIndex: 0,
      chunkIndex: 0,
      globalPixelOffset: 0,
      widthPx: 1000,
      heightPx: 100,
    });
    expect(mockPool.registerCanvas).toHaveBeenCalledWith('c1-ch0-chunk0', canvas);
  });

  it('unregisterCanvas forwards to worker pool', () => {
    orch.registerCanvas({
      canvasId: 'c1-ch0-chunk0',
      canvas: {} as OffscreenCanvas,
      clipId: 'c1',
      trackId: 't1',
      channelIndex: 0,
      chunkIndex: 0,
      globalPixelOffset: 0,
      widthPx: 1000,
      heightPx: 100,
    });
    orch.unregisterCanvas('c1-ch0-chunk0');
    expect(mockPool.unregisterCanvas).toHaveBeenCalledWith('c1-ch0-chunk0');
  });

  it('setViewport increments generation and aborts previous', () => {
    orch.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 100,
      bufferStartPx: 0,
      bufferEndPx: 100,
      samplesPerPixel: 1024,
    });
    orch.setViewport({
      visibleStartPx: 100,
      visibleEndPx: 200,
      bufferStartPx: 50,
      bufferEndPx: 250,
      samplesPerPixel: 1024,
    });
    expect(mockPool.abortGeneration).toHaveBeenCalled();
  });
});
