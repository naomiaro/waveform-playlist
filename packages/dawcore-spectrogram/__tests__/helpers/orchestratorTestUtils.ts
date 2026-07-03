import { vi } from 'vitest';
import { SpectrogramOrchestrator } from '../../src/orchestrator/SpectrogramOrchestrator';
import type { SpectrogramConfig } from '@waveform-playlist/core';

export function makeMockWorker(): Worker {
  return {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null,
    onerror: null,
  } as unknown as Worker;
}

export interface MockPool {
  registerCanvas: ReturnType<typeof vi.fn>;
  unregisterCanvas: ReturnType<typeof vi.fn>;
  registerAudioData: ReturnType<typeof vi.fn>;
  unregisterAudioData: ReturnType<typeof vi.fn>;
  computeFFT: ReturnType<typeof vi.fn>;
  renderChunks: ReturnType<typeof vi.fn>;
  abortGeneration: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}

export function makeMockPool(): MockPool {
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

/** Orchestrator wired to a mock pool via the test-only `pool` seam. */
export function makeOrchestratorWithMockPool(
  config: SpectrogramConfig,
  workerPoolSize = 1
): { orch: SpectrogramOrchestrator; mockPool: MockPool } {
  const mockPool = makeMockPool();
  const orch = new SpectrogramOrchestrator({
    workerFactory: () => makeMockWorker(),
    workerPoolSize,
    config,
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (orch as any).pool = mockPool;
  return { orch, mockPool };
}
