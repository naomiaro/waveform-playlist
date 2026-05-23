import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpectrogramController } from '../controllers/spectrogram-controller';

const mockOrchestrator = {
  registerClip: vi.fn(),
  unregisterClip: vi.fn(),
  registerCanvas: vi.fn(),
  unregisterCanvas: vi.fn(),
  setConfig: vi.fn(),
  setColorMap: vi.fn(),
  setViewport: vi.fn(),
  setDevicePixelRatio: vi.fn(),
  dispose: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.mock('@dawcore/spectrogram', () => ({
  SpectrogramOrchestrator: vi.fn().mockImplementation(() => mockOrchestrator),
}));

function makeHost() {
  return {
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
    dispatchEvent: vi.fn(),
  };
}

function makeCanvasReg(canvasId = 'c') {
  return {
    canvasId,
    canvas: {} as OffscreenCanvas,
    clipId: 'c1',
    trackId: 't1',
    channelIndex: 0,
    chunkIndex: 0,
    globalPixelOffset: 0,
    widthPx: 100,
    heightPx: 100,
  };
}

describe('SpectrogramController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('lazily creates orchestrator on first registerCanvas', async () => {
    const host = makeHost();
    const controller = new SpectrogramController(host, () => new Worker(''));
    const mod = await import('@dawcore/spectrogram');
    expect(mod.SpectrogramOrchestrator).not.toHaveBeenCalled();
    controller.registerCanvas(makeCanvasReg());
    expect(mod.SpectrogramOrchestrator).toHaveBeenCalledTimes(1);
  });

  it('dispose terminates the orchestrator if created', () => {
    const host = makeHost();
    const controller = new SpectrogramController(host, () => new Worker(''));
    controller.registerCanvas(makeCanvasReg());
    controller.dispose();
    expect(mockOrchestrator.dispose).toHaveBeenCalledTimes(1);
  });

  it('dispose is a no-op when orchestrator was never created', () => {
    const host = makeHost();
    const controller = new SpectrogramController(host, () => new Worker(''));
    controller.dispose();
    expect(mockOrchestrator.dispose).not.toHaveBeenCalled();
  });

  it('editor config + colorMap are applied after lazy orchestrator creation', () => {
    const host = makeHost();
    const controller = new SpectrogramController(host, () => new Worker(''));
    controller.setEditorConfig({ fftSize: 2048, frequencyScale: 'mel' });
    controller.setEditorColorMap('magma');
    controller.registerCanvas(makeCanvasReg());

    const lastConfig = mockOrchestrator.setConfig.mock.calls.at(-1)?.[0];
    const lastColorMap = mockOrchestrator.setColorMap.mock.calls.at(-1)?.[0];
    expect(lastConfig.fftSize).toBe(2048);
    expect(lastColorMap).toBe('magma');
  });
});
