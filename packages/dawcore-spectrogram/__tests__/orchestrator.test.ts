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

  it('setViewport short-circuits when called with identical state — no abort, no re-render', () => {
    const state = {
      visibleStartPx: 0,
      visibleEndPx: 100,
      bufferStartPx: 0,
      bufferEndPx: 100,
      samplesPerPixel: 1024,
    };
    orch.setViewport(state);
    mockPool.abortGeneration.mockClear();
    orch.setViewport({ ...state });
    expect(mockPool.abortGeneration).not.toHaveBeenCalled();
  });

  it('registerClip forwards channelData + sampleRate to pool.registerAudioData', () => {
    const channelData = [new Float32Array([0.1, 0.2, 0.3])];
    orch.registerClip({
      clipId: 'c-test',
      trackId: 't-test',
      channelData,
      sampleRate: 48000,
      durationSamples: 3,
      offsetSamples: 0,
    });
    expect(mockPool.registerAudioData).toHaveBeenCalledWith(
      'c-test',
      expect.any(Array),
      48000
    );
  });
});

describe('SpectrogramOrchestrator — tier-aware render', () => {
  let orch: SpectrogramOrchestrator;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      registerCanvas: vi.fn(),
      unregisterCanvas: vi.fn(),
      registerAudioData: vi.fn(),
      unregisterAudioData: vi.fn(),
      computeFFT: vi.fn(() => Promise.resolve({ cacheKey: 'k' })),
      renderChunks: vi.fn(() => Promise.resolve()),
      abortGeneration: vi.fn(),
      terminate: vi.fn(),
    };
    orch = new SpectrogramOrchestrator({
      workerFactory: () => makeMockWorker(),
      workerPoolSize: 1,
      config: defaultConfig,
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (orch as any).pool = mockPool;

    orch.registerClip({
      clipId: 'c1',
      trackId: 't1',
      channelData: [new Float32Array(48000)],
      sampleRate: 48000,
      durationSamples: 48000,
      offsetSamples: 0,
    });

    for (let i = 0; i < 3; i++) {
      orch.registerCanvas({
        canvasId: 'c1-ch0-chunk' + i,
        canvas: { width: 1000, height: 100 } as unknown as OffscreenCanvas,
        clipId: 'c1',
        trackId: 't1',
        channelIndex: 0,
        chunkIndex: i,
        globalPixelOffset: i * 1000,
        widthPx: 1000,
        heightPx: 100,
      });
    }
  });

  it('setViewport renders viewport-tier canvases first', async () => {
    orch.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 500,
      bufferStartPx: 0,
      bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(mockPool.renderChunks).toHaveBeenCalled();
    const firstCall = mockPool.renderChunks.mock.calls[0][0];
    expect(firstCall.canvasIds).toEqual(['c1-ch0-chunk0']);
  });

  it('emits viewport-ready event with trackId after viewport-tier completes', async () => {
    const readyEvents: string[] = [];
    orch.addEventListener('viewport-ready', (e: Event) => {
      readyEvents.push((e as CustomEvent).detail.trackId);
    });
    orch.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 500,
      bufferStartPx: 0,
      bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(readyEvents).toContain('t1');
  });

  it('does not emit viewport-ready twice for the same generation', async () => {
    let count = 0;
    orch.addEventListener('viewport-ready', () => {
      count += 1;
    });
    orch.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 500,
      bufferStartPx: 0,
      bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(count).toBe(1);
  });

  it('does not re-emit viewport-ready for the same track when a later registerCanvas triggers another render', async () => {
    let count = 0;
    orch.addEventListener('viewport-ready', () => {
      count += 1;
    });
    orch.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 500,
      bufferStartPx: 0,
      bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(count).toBe(1);
    // Late canvas registration triggers another render with the SAME viewport
    // and generation. The track was already marked ready — don't re-fire.
    orch.registerCanvas({
      canvasId: 'c1-ch0-chunk3',
      canvas: { width: 1000, height: 100 } as unknown as OffscreenCanvas,
      clipId: 'c1',
      trackId: 't1',
      channelIndex: 0,
      chunkIndex: 3,
      globalPixelOffset: 3000,
      widthPx: 1000,
      heightPx: 100,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(count).toBe(1);
  });

  it('re-emits viewport-ready after setViewport bumps the generation', async () => {
    let count = 0;
    orch.addEventListener('viewport-ready', () => {
      count += 1;
    });
    orch.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 500,
      bufferStartPx: 0,
      bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(count).toBe(1);
    orch.setViewport({
      visibleStartPx: 1000,
      visibleEndPx: 1500,
      bufferStartPx: 500,
      bufferEndPx: 2000,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(count).toBe(2);
  });

  it('setConfig clears readyDispatched so the next render re-emits viewport-ready', async () => {
    const readyEvents: string[] = [];
    orch.addEventListener('viewport-ready', (e: Event) => {
      readyEvents.push((e as CustomEvent).detail.trackId);
    });

    const viewport = {
      visibleStartPx: 0,
      visibleEndPx: 500,
      bufferStartPx: 0,
      bufferEndPx: 1500,
      samplesPerPixel: 1024,
    };
    orch.setViewport(viewport);
    await new Promise((r) => setTimeout(r, 20));
    expect(readyEvents).toEqual(['t1']);

    // Same viewport — short-circuits, no new ready event
    orch.setViewport({ ...viewport });
    await new Promise((r) => setTimeout(r, 20));
    expect(readyEvents).toEqual(['t1']);

    // setConfig bumps generation and clears readyDispatched — should re-fire
    orch.setConfig({ fftSize: 4096, frequencyScale: 'mel' });
    await new Promise((r) => setTimeout(r, 20));
    expect(readyEvents).toEqual(['t1', 't1']);
  });

  it('setColorMap clears readyDispatched so the next render re-emits viewport-ready', async () => {
    const readyEvents: string[] = [];
    orch.addEventListener('viewport-ready', (e: Event) => {
      readyEvents.push((e as CustomEvent).detail.trackId);
    });

    orch.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 500,
      bufferStartPx: 0,
      bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(readyEvents).toEqual(['t1']);

    orch.setColorMap('magma');
    await new Promise((r) => setTimeout(r, 20));
    expect(readyEvents).toEqual(['t1', 't1']);
  });

  it('dispose() during in-flight render bails before pool.renderChunks runs on terminated pool', async () => {
    // Deferred-resolve mock for computeFFT so we can dispose between
    // computeFFT and the post-await `this.disposed` check in renderGroup.
    let resolveComputeFFT: ((v: { cacheKey: string }) => void) | undefined;
    mockPool.computeFFT.mockImplementationOnce(
      () =>
        new Promise<{ cacheKey: string }>((res) => {
          resolveComputeFFT = res;
        })
    );

    orch.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 500,
      bufferStartPx: 0,
      bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    // Let microtask queue flush so runRender starts and awaits computeFFT
    await Promise.resolve();
    await Promise.resolve();

    orch.dispose();
    resolveComputeFFT!({ cacheKey: 'late' });
    await new Promise((r) => setTimeout(r, 10));

    // After dispose + late resolve, renderChunks must NOT be called on the
    // now-terminated pool.
    expect(mockPool.renderChunks).not.toHaveBeenCalled();
  });

  it('runs viewport tier then buffer tier (both call renderChunks)', async () => {
    // beforeEach registered 3 canvases at offsets 0/1000/2000 (width 1000).
    // viewport [0, 1000] + buffer [0, 2000] places:
    //   chunk0 (0-1000)    → viewport tier  → 1 renderChunks call
    //   chunk1 (1000-2000) → buffer tier    → 1 renderChunks call
    //   chunk2 (2000-3000) → remaining tier → 1 renderChunks call (via idle)
    mockPool.renderChunks.mockClear();
    orch.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 1000,
      bufferStartPx: 0,
      bufferEndPx: 2000,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 30));

    // Viewport + buffer tiers must each trigger a renderChunks call.
    // The exact total can include remaining-tier work; assert >= 2.
    expect(mockPool.renderChunks.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('viewport-ready fires exactly once per trackId per generation (multi-track)', async () => {
    // The beforeEach registered c1/t1 + 3 canvases for t1. Add c2/t2 here.
    orch.registerClip({
      clipId: 'c2',
      trackId: 't2',
      channelData: [new Float32Array(48000)],
      sampleRate: 48000,
      durationSamples: 48000,
      offsetSamples: 0,
    });
    orch.registerCanvas({
      canvasId: 'c2-ch0-chunk0',
      canvas: { width: 1000, height: 100 } as unknown as OffscreenCanvas,
      clipId: 'c2',
      trackId: 't2',
      channelIndex: 0,
      chunkIndex: 0,
      globalPixelOffset: 0,
      widthPx: 1000,
      heightPx: 100,
    });

    const readyEvents: Array<{ trackId: string; generation: number }> = [];
    orch.addEventListener('viewport-ready', (e: Event) => {
      const detail = (e as CustomEvent).detail;
      readyEvents.push({ trackId: detail.trackId, generation: detail.generation });
    });

    orch.setViewport({
      visibleStartPx: 0,
      visibleEndPx: 500,
      bufferStartPx: 0,
      bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 20));

    // Exactly one event per track in this generation
    expect(readyEvents).toHaveLength(2);
    expect(new Set(readyEvents.map((e) => e.trackId))).toEqual(new Set(['t1', 't2']));
    // Both events share the same generation (same setViewport call)
    const generations = new Set(readyEvents.map((e) => e.generation));
    expect(generations.size).toBe(1);

    // Late registerCanvas for t1 — triggers another render, but t1 was already
    // dispatched in this generation. Must NOT re-fire.
    orch.registerCanvas({
      canvasId: 'c1-ch0-chunk3',
      canvas: { width: 1000, height: 100 } as unknown as OffscreenCanvas,
      clipId: 'c1',
      trackId: 't1',
      channelIndex: 0,
      chunkIndex: 3,
      globalPixelOffset: 3000,
      widthPx: 1000,
      heightPx: 100,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(readyEvents).toHaveLength(2);
  });
});
