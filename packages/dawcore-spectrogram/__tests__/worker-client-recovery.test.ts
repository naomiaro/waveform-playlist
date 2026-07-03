import { describe, it, expect, vi } from 'vitest';
import { createSpectrogramWorker } from '../src/worker/createSpectrogramWorker';
import { createMockNativeWorker, respondToWorker, postedMessages } from './helpers/poolTestUtils';

const fftParams = {
  clipId: 'clip1',
  channelDataArrays: [new Float32Array(16)],
  config: {},
  sampleRate: 48000,
  offsetSamples: 0,
  durationSamples: 16,
  mono: false,
};

/**
 * An uncaught error inside a worker's message handler fires `worker.onerror`
 * but does NOT kill the worker thread. The client must reject the operations
 * that were pending at crash time, but stay usable for new calls (#558).
 */
describe('createSpectrogramWorker — recovery after onerror', () => {
  it('rejects pending operations on worker error but keeps the API usable', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const native = createMockNativeWorker();
    const api = createSpectrogramWorker(native);

    const pending = api.computeFFT(fftParams, 1);
    (native as unknown as { onerror: (e: ErrorEvent) => void }).onerror({
      message: 'boom',
    } as ErrorEvent);
    await expect(pending).rejects.toThrow(/crashed/i);

    // The worker is still alive — a new call must go through, not reject
    // with "Worker terminated".
    const retry = api.computeFFT(fftParams, 2);
    const fftMessages = postedMessages(native).filter((m) => m.type === 'compute-fft');
    expect(fftMessages.length).toBe(2);
    respondToWorker(native, {
      id: fftMessages[1].id,
      type: 'cache-key',
      cacheKey: 'k2',
    });
    await expect(retry).resolves.toEqual({ cacheKey: 'k2' });
    errorSpy.mockRestore();
  });

  it('explicit terminate() still permanently rejects new calls', async () => {
    const api = createSpectrogramWorker(createMockNativeWorker());
    api.terminate();
    await expect(api.computeFFT(fftParams, 1)).rejects.toThrow(/terminated/i);
  });
});
