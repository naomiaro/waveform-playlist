import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SpectrogramOrchestrator } from '../src/orchestrator/SpectrogramOrchestrator';
import type { SpectrogramConfig } from '@waveform-playlist/core';

const defaultConfig: SpectrogramConfig = { fftSize: 2048, frequencyScale: 'mel' };

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

/**
 * renderGroup's clip-relative sample math assumes chunk k sits at clip pixel
 * k * MAX_CANVAS_WIDTH (1000). A consumer registering a different layout gets
 * silently shifted audio — the orchestrator must at least warn (#559 review,
 * finding on the #554 fix).
 */
describe('SpectrogramOrchestrator — chunk layout contract validation', () => {
  let orch: SpectrogramOrchestrator;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  function register(clipId: string, chunkIndex: number, globalPixelOffset: number): void {
    orch.registerCanvas({
      canvasId: clipId + '-ch0-chunk' + chunkIndex,
      canvas: { width: 1000, height: 100 } as unknown as OffscreenCanvas,
      clipId,
      trackId: 't1',
      channelIndex: 0,
      chunkIndex,
      globalPixelOffset,
      widthPx: 1000,
      heightPx: 100,
    });
  }

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    orch = new SpectrogramOrchestrator({
      workerFactory: () => makeMockWorker(),
      workerPoolSize: 1,
      config: defaultConfig,
    });
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('accepts a conforming chunked layout without warning', () => {
    register('c1', 0, 5000);
    register('c1', 1, 6000);
    register('c1', 2, 7000);
    const layoutWarnings = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('layout')
    );
    expect(layoutWarnings).toEqual([]);
  });

  it('warns when a clip canvas violates the chunkIndex * MAX_CANVAS_WIDTH layout', () => {
    register('c1', 0, 5000);
    register('c1', 1, 6200); // expected 6000 — 200px drift would shift audio
    const layoutWarnings = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('layout')
    );
    expect(layoutWarnings.length).toBe(1);
  });

  it('does not warn when a clip re-registers at a new origin after full unregistration (clip moved)', () => {
    register('c1', 0, 5000);
    register('c1', 1, 6000);
    orch.unregisterCanvas('c1-ch0-chunk0');
    orch.unregisterCanvas('c1-ch0-chunk1');
    // Clip moved on the timeline; fresh registration cycle at a new origin.
    register('c1', 0, 9000);
    register('c1', 1, 10000);
    const layoutWarnings = warnSpy.mock.calls.filter((c) =>
      String(c[0]).includes('layout')
    );
    expect(layoutWarnings).toEqual([]);
  });
});
