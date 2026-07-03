import { describe, it, expect, vi } from 'vitest';
import { createSpectrogramWorkerPool } from '../src/worker/createSpectrogramWorkerPool';

function createMockNativeWorker() {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
  };
  return worker as unknown as Worker;
}

function respondToWorker(worker: unknown, data: Record<string, unknown>) {
  const w = worker as { onmessage: ((e: { data: unknown }) => void) | null };
  w.onmessage?.({ data } as MessageEvent);
}

function postedMessages(worker: unknown): Array<Record<string, unknown>> {
  return (worker as { postMessage: ReturnType<typeof vi.fn> }).postMessage.mock.calls.map(
    (c: unknown[]) => c[0] as Record<string, unknown>
  );
}

/** Acknowledge every pending compute-fft on a worker with a cache-key response. */
function ackComputeFFTs(worker: unknown) {
  for (const msg of postedMessages(worker)) {
    if (msg.type === 'compute-fft') {
      respondToWorker(worker, { id: msg.id, type: 'cache-key', cacheKey: 'k' });
    }
  }
}

const threeChannelParams = {
  clipId: 'clip1',
  channelDataArrays: [new Float32Array(64), new Float32Array(64), new Float32Array(64)],
  config: {},
  sampleRate: 48000,
  offsetSamples: 0,
  durationSamples: 64,
  mono: false,
};

describe('worker pool — channels beyond poolSize (#556)', () => {
  it('computeFFT with 3 channels on a 2-worker pool creates a 3rd worker and computes every channel', async () => {
    const nativeWorkers: Worker[] = [];
    const factory = vi.fn(() => {
      const w = createMockNativeWorker();
      nativeWorkers.push(w);
      return w;
    });
    const pool = createSpectrogramWorkerPool(factory, 2);
    expect(factory).toHaveBeenCalledTimes(2);

    const promise = pool.computeFFT(threeChannelParams, 1);

    // A third worker must have been created for channel 2.
    expect(factory).toHaveBeenCalledTimes(3);

    // Each of the three workers received exactly its own channelFilter.
    const filters = nativeWorkers.map((w) => {
      const fft = postedMessages(w).find((m) => m.type === 'compute-fft');
      return fft?.channelFilter;
    });
    expect(filters).toEqual([0, 1, 2]);

    for (const w of nativeWorkers) ackComputeFFTs(w);
    await expect(promise).resolves.toEqual({ cacheKey: 'k' });
  });

  it('replays previously registered audio data into late-created workers before their compute-fft', async () => {
    const nativeWorkers: Worker[] = [];
    const pool = createSpectrogramWorkerPool(() => {
      const w = createMockNativeWorker();
      nativeWorkers.push(w);
      return w;
    }, 2);

    pool.registerAudioData('clip1', threeChannelParams.channelDataArrays, 48000);

    const promise = pool.computeFFT(threeChannelParams, 1);

    const lateWorker = nativeWorkers[2];
    const messages = postedMessages(lateWorker);
    const registerIdx = messages.findIndex((m) => m.type === 'register-audio-data');
    const computeIdx = messages.findIndex((m) => m.type === 'compute-fft');
    // The grown worker needs the clip audio registered before it computes.
    expect(registerIdx).toBeGreaterThanOrEqual(0);
    expect(computeIdx).toBeGreaterThan(registerIdx);
    expect(messages[registerIdx].clipId).toBe('clip1');

    for (const w of nativeWorkers) ackComputeFFTs(w);
    await promise;
  });

  it('registerCanvas and renderChunks for channel 2 route to the grown worker', async () => {
    const nativeWorkers: Worker[] = [];
    const pool = createSpectrogramWorkerPool(() => {
      const w = createMockNativeWorker();
      nativeWorkers.push(w);
      return w;
    }, 2);

    pool.registerCanvas('clip1-ch2-chunk0', {} as OffscreenCanvas);
    expect(nativeWorkers.length).toBe(3);
    const lateWorker = nativeWorkers[2];
    expect(postedMessages(lateWorker).some((m) => m.type === 'register-canvas')).toBe(true);

    const renderPromise = pool.renderChunks(
      {
        cacheKey: 'k',
        canvasIds: ['clip1-ch2-chunk0'],
        canvasWidths: [100],
        globalPixelOffsets: [0],
        canvasHeight: 10,
        devicePixelRatio: 1,
        samplesPerPixel: 512,
        colorLUT: new Uint8Array(768),
        frequencyScale: 'mel',
        minFrequency: 0,
        maxFrequency: 0,
        gainDb: 20,
        rangeDb: 80,
        channelIndex: 2,
      },
      1
    );

    const render = postedMessages(lateWorker).find((m) => m.type === 'render-chunks');
    expect(render).toBeTruthy();
    // Each worker stores its channel at index 0.
    expect(render!.channelIndex).toBe(0);

    respondToWorker(lateWorker, { id: render!.id, type: 'done' });
    await expect(renderPromise).resolves.toBeUndefined();
  });

  it('computeFFT with empty channelDataArrays rejects with a clear error instead of a TypeError', async () => {
    const pool = createSpectrogramWorkerPool(() => createMockNativeWorker(), 2);
    await expect(
      pool.computeFFT({ ...threeChannelParams, channelDataArrays: [] }, 1)
    ).rejects.toThrow(/no channel data/i);
  });
});
