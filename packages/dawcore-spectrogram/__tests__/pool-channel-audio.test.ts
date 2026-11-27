import { describe, it, expect } from 'vitest';
import { createSpectrogramWorkerPool } from '../src/worker/createSpectrogramWorkerPool';
import { ackComputeFFTs, postedMessages, trackingWorkerFactory } from './helpers/poolTestUtils';

/**
 * What audio each worker of the pool holds (#925). Worker k computes only
 * channel k; worker 0 also computes the mono mix, which reads every channel.
 * So worker 0 gets the whole clip and worker k ≥ 1 gets channel k alone,
 * stored at index 0 (where the pool already points its renderChunks).
 *
 * Channel k is filled with the marker value k + 1, so the first sample of each
 * array a worker received names the channel (the client sends copies, so the
 * arrays are not the same objects).
 */

function markedChannels(count: number, length = 64): Float32Array[] {
  return Array.from({ length: count }, (_, k) => new Float32Array(length).fill(k + 1));
}

/** The channel numbers in each message of `type` posted into `worker`. */
function channelsIn(worker: unknown, type: string): number[][] {
  return postedMessages(worker)
    .filter((m) => m.type === type)
    .map((m) => (m.channelDataArrays as Float32Array[]).map((arr) => arr[0] - 1));
}

const fftParams = {
  config: {},
  sampleRate: 48000,
  offsetSamples: 0,
  durationSamples: 64,
  mono: false,
};

describe('worker pool — each worker holds only the channels it computes (#925)', () => {
  it('mono clip: worker 0 holds channel 0, worker 1 holds nothing', () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);

    pool.registerAudioData('clip', markedChannels(1), 48000);

    expect(channelsIn(workers[0], 'register-audio-data')).toEqual([[0]]);
    expect(channelsIn(workers[1], 'register-audio-data')).toEqual([]);
  });

  it('stereo clip: worker 0 holds both channels, worker 1 holds channel 1 only', () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);

    pool.registerAudioData('clip', markedChannels(2), 48000);

    expect(channelsIn(workers[0], 'register-audio-data')).toEqual([[0, 1]]);
    expect(channelsIn(workers[1], 'register-audio-data')).toEqual([[1]]);
  });

  it('4-channel clip on a pool of 4: worker k ≥ 1 holds channel k only', () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 4);

    pool.registerAudioData('clip', markedChannels(4), 48000);

    expect(workers.map((w) => channelsIn(w, 'register-audio-data'))).toEqual([
      [[0, 1, 2, 3]],
      [[1]],
      [[2]],
      [[3]],
    ]);
  });

  it('a grown pool replays channel k alone into the new worker k', async () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);
    pool.registerAudioData('clip', markedChannels(4), 48000);

    const promise = pool.computeFFT({ ...fftParams, clipId: 'clip', channelDataArrays: [] }, 1);

    expect(workers).toHaveLength(4);
    expect(workers.map((w) => channelsIn(w, 'register-audio-data'))).toEqual([
      [[0, 1, 2, 3]],
      [[1]],
      [[2]],
      [[3]],
    ]);

    for (const w of workers) ackComputeFFTs(w);
    await promise;
  });

  it('every worker is asked for index 0 of what it holds', async () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);
    pool.registerAudioData('clip', markedChannels(3), 48000);

    const promise = pool.computeFFT({ ...fftParams, clipId: 'clip', channelDataArrays: [] }, 1);

    const filters = workers.map(
      (w) => postedMessages(w).find((m) => m.type === 'compute-fft')?.channelFilter
    );
    expect(filters).toEqual([0, 0, 0]);

    for (const w of workers) ackComputeFFTs(w);
    await promise;
  });

  it('a compute-fft for audio that was not registered sends each worker its channel only', async () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);

    const promise = pool.computeFFT(
      { ...fftParams, clipId: 'unregistered', channelDataArrays: markedChannels(3) },
      1
    );

    // Worker 0 too: this request computes channel 0 there, not the mono mix.
    expect(workers.map((w) => channelsIn(w, 'compute-fft'))).toEqual([[[0]], [[1]], [[2]]]);

    for (const w of workers) ackComputeFFTs(w);
    await promise;
  });

  it('an id registered again with fewer channels is dropped by the workers past the new count', () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 3);
    pool.registerAudioData('clip', markedChannels(3), 48000);

    pool.registerAudioData('clip', markedChannels(1), 48000);

    // Worker 0 holds the new audio; workers 1 and 2 are told to drop the
    // channels they held, which the new audio does not have.
    const last = workers.map((w) => {
      const forClip = postedMessages(w).filter((m) => m.clipId === 'clip');
      return forClip[forClip.length - 1].type;
    });
    expect(last).toEqual(['register-audio-data', 'unregister-audio-data', 'unregister-audio-data']);
    expect(channelsIn(workers[0], 'register-audio-data')).toEqual([[0, 1, 2], [0]]);
  });

  it('an id registered again with as many or more channels is not dropped anywhere', () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 3);
    pool.registerAudioData('clip', markedChannels(2), 48000);

    pool.registerAudioData('clip', markedChannels(2), 48000);
    pool.registerAudioData('clip', markedChannels(3), 48000);

    for (const w of workers) {
      expect(postedMessages(w).some((m) => m.type === 'unregister-audio-data')).toBe(false);
    }
    expect(channelsIn(workers[2], 'register-audio-data')).toEqual([[2]]);
  });

  it('an id registered again with fewer channels is not replayed into a worker added later', async () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 1);
    pool.registerAudioData('clip', markedChannels(3), 48000);
    pool.registerAudioData('clip', markedChannels(1), 48000);

    const promise = pool.computeFFT(
      { ...fftParams, clipId: 'other', channelDataArrays: markedChannels(3) },
      1
    );

    expect(workers).toHaveLength(3);
    expect(channelsIn(workers[1], 'register-audio-data')).toEqual([]);
    expect(channelsIn(workers[2], 'register-audio-data')).toEqual([]);

    for (const w of workers) ackComputeFFTs(w);
    await promise;
  });

  it('mono computeFFT still sends worker 0 every channel', async () => {
    const { factory, workers } = trackingWorkerFactory();
    const pool = createSpectrogramWorkerPool(factory, 2);

    const promise = pool.computeFFT(
      { ...fftParams, mono: true, clipId: 'unregistered', channelDataArrays: markedChannels(2) },
      1
    );

    expect(channelsIn(workers[0], 'compute-fft')).toEqual([[0, 1]]);
    expect(channelsIn(workers[1], 'compute-fft')).toEqual([]);

    ackComputeFFTs(workers[0]);
    await promise;
  });
});
