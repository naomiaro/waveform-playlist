import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSpectrogramWorkerPool } from '../src/worker/createSpectrogramWorkerPool';
import {
  trackingWorkerFactory,
  postedMessages,
  ackComputeFFTs,
} from './helpers/poolTestUtils';

const stereoParams = {
  clipId: 'clip1',
  channelDataArrays: [new Float32Array(64), new Float32Array(64)],
  config: {},
  sampleRate: 48000,
  offsetSamples: 0,
  durationSamples: 64,
  mono: false,
};

const renderParams = {
  cacheKey: 'k',
  canvasIds: ['clip1-ch0-chunk0'],
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
  channelIndex: 0,
};

describe('worker pool — hardening (review of #559)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('terminate() prevents resurrection: no new workers, calls reject/no-op', async () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);
    pool.terminate();

    const createdBefore = workers.length;
    // registerCanvas for a channel beyond pool size must NOT spawn workers.
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    pool.registerCanvas('clip1-ch5-chunk0', {} as OffscreenCanvas);
    expect(workers.length).toBe(createdBefore);

    await expect(pool.computeFFT(stereoParams, 1)).rejects.toThrow(/terminated/i);
    await expect(pool.renderChunks(renderParams, 1)).rejects.toThrow(/terminated/i);
    expect(workers.length).toBe(createdBefore);
    warnSpy.mockRestore();
  });

  it('clamps constructor poolSize to the channel cap instead of spawning unreachable workers', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { factory, workers } = trackingWorkerFactory();
    createSpectrogramWorkerPool(factory, 64);
    expect(workers.length).toBe(32);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('registerCanvas beyond the channel cap warns and does NOT transfer the canvas anywhere', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);

    pool.registerCanvas('clip1-ch40-chunk0', {} as OffscreenCanvas);

    expect(warnSpy).toHaveBeenCalled();
    for (const w of workers) {
      expect(postedMessages(w).some((m) => m.type === 'register-canvas')).toBe(false);
    }
    warnSpy.mockRestore();
  });

  it('renderChunks rejects on non-integer or negative channelIndex without growing the pool', async () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);
    const createdBefore = workers.length;

    await expect(
      pool.renderChunks({ ...renderParams, channelIndex: Number.NaN }, 1)
    ).rejects.toThrow(/channel index/i);
    await expect(pool.renderChunks({ ...renderParams, channelIndex: -1 }, 1)).rejects.toThrow(
      /channel index/i
    );
    await expect(pool.renderChunks({ ...renderParams, channelIndex: 1.5 }, 1)).rejects.toThrow(
      /channel index/i
    );
    expect(workers.length).toBe(createdBefore);
  });

  it('mono computeFFT with empty arrays and no registered audio rejects instead of caching NaN', async () => {
    const { factory } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);
    await expect(
      pool.computeFFT({ ...stereoParams, mono: true, channelDataArrays: [] }, 1)
    ).rejects.toThrow(/no channel data/i);
  });

  it('mono computeFFT with empty arrays but registered audio is allowed (pre-registration path)', async () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);
    pool.registerAudioData('clip1', stereoParams.channelDataArrays, 48000);

    const promise = pool.computeFFT({ ...stereoParams, mono: true, channelDataArrays: [] }, 1);
    ackComputeFFTs(workers[0]);
    await expect(promise).resolves.toEqual({ cacheKey: 'k' });
  });

  it('registerAudioData only fans out to workers that can compute one of the clip channels', () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 3);

    pool.registerAudioData('mono-clip', [new Float32Array(8)], 48000);

    const receivers = workers.map((w) =>
      postedMessages(w).some((m) => m.type === 'register-audio-data' && m.clipId === 'mono-clip')
    );
    // Worker 0 computes channel 0 (and all mono mixes); workers 1 and 2 can
    // never compute any channel of a mono clip.
    expect(receivers).toEqual([true, false, false]);
  });

  it('growth replays only clips that have the new worker\'s channel', async () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);

    pool.registerAudioData('mono-clip', [new Float32Array(8)], 48000);
    const surround = [
      new Float32Array(64),
      new Float32Array(64),
      new Float32Array(64),
    ];
    pool.registerAudioData('surround-clip', surround, 48000);

    const promise = pool.computeFFT(
      { ...stereoParams, clipId: 'surround-clip', channelDataArrays: surround },
      1
    );

    const lateWorker = workers[2];
    const replayed = postedMessages(lateWorker)
      .filter((m) => m.type === 'register-audio-data')
      .map((m) => m.clipId);
    // The 3-channel clip has a channel 2; the mono clip does not.
    expect(replayed).toEqual(['surround-clip']);

    for (const w of workers) ackComputeFFTs(w);
    await promise;
  });
});
