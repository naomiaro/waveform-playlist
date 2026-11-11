// @vitest-environment jsdom
//
// #692: worker results are looked up by AudioBuffer during render, and the
// hook's only state is a version counter bumped when a job finishes. A
// `tracks` change over already-generated buffers (every pointer move of a
// trim) must not set state, and must not start the job again.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('../workers/peaksWorker', () => ({
  createPeaksWorker: vi.fn(),
}));

import { createPeaksWorker } from '../workers/peaksWorker';
import { useWaveformDataCache } from '../hooks/useWaveformDataCache';

function makeBuffer(length = 48000): AudioBuffer {
  return {
    length,
    duration: length / 48000,
    sampleRate: 48000,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(length),
  } as unknown as AudioBuffer;
}

function makeTrack(trackId: string, clips: Array<{ id: string; audioBuffer?: AudioBuffer }>): any {
  return { id: trackId, clips };
}

interface Deferred {
  resolve: (value: unknown) => void;
  reject: (reason: unknown) => void;
}

function mockWorker() {
  const jobs: Deferred[] = [];
  const worker = {
    generate: vi.fn(
      () =>
        new Promise((resolve, reject) => {
          jobs.push({ resolve, reject });
        })
    ),
    isTerminated: vi.fn(() => false),
    terminate: vi.fn(),
  };
  vi.mocked(createPeaksWorker).mockImplementation(() => worker as any);
  return { worker, jobs };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.mocked(createPeaksWorker).mockReset();
});

describe('useWaveformDataCache', () => {
  it('generates once per buffer and bumps the version when the job finishes', async () => {
    const { worker, jobs } = mockWorker();
    const buffer = makeBuffer();
    const waveformData = { scale: 128 } as any;
    const tracks = [
      makeTrack('t1', [
        { id: 'a', audioBuffer: buffer },
        { id: 'b', audioBuffer: buffer },
      ]),
    ];

    const { result } = renderHook(() => useWaveformDataCache(tracks, 128));
    expect(worker.generate).toHaveBeenCalledTimes(1);
    expect(result.current.getWaveformData(buffer)).toBeUndefined();
    expect(result.current.version).toBe(0);

    await act(async () => {
      jobs[0].resolve(waveformData);
    });

    expect(result.current.getWaveformData(buffer)).toBe(waveformData);
    expect(result.current.version).toBe(1);
  });

  it('does not set state or regenerate when tracks change over generated buffers', async () => {
    const { worker, jobs } = mockWorker();
    const buffer = makeBuffer();
    let renderCount = 0;

    const { result, rerender } = renderHook(
      ({ tracks }) => {
        renderCount++;
        return useWaveformDataCache(tracks, 128);
      },
      { initialProps: { tracks: [makeTrack('t1', [{ id: 'a', audioBuffer: buffer }])] } }
    );
    await act(async () => {
      jobs[0].resolve({ scale: 128 });
    });
    const getter = result.current.getWaveformData;
    const rendersBefore = renderCount;

    // A trim: same buffer, new clip and track objects, plus a split-off clip.
    rerender({
      tracks: [
        makeTrack('t1', [
          { id: 'a', audioBuffer: buffer },
          { id: 'a2', audioBuffer: buffer },
        ]),
      ],
    });

    expect(renderCount).toBe(rendersBefore + 1);
    expect(result.current.version).toBe(1);
    expect(result.current.getWaveformData).toBe(getter);
    expect(worker.generate).toHaveBeenCalledTimes(1);
  });

  it('keeps a running job across a tracks change instead of starting it again', async () => {
    const { worker, jobs } = mockWorker();
    const buffer = makeBuffer();
    const waveformData = { scale: 128 } as any;

    const { result, rerender } = renderHook(({ tracks }) => useWaveformDataCache(tracks, 128), {
      initialProps: { tracks: [makeTrack('t1', [{ id: 'a', audioBuffer: buffer }])] },
    });
    rerender({
      tracks: [makeTrack('t1', [{ id: 'a', audioBuffer: buffer }]), makeTrack('t2', [])],
    });
    expect(worker.generate).toHaveBeenCalledTimes(1);

    await act(async () => {
      jobs[0].resolve(waveformData);
    });
    expect(result.current.getWaveformData(buffer)).toBe(waveformData);
    expect(result.current.version).toBe(1);
  });

  it('retries a failed buffer on the next tracks change', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { worker, jobs } = mockWorker();
    const buffer = makeBuffer();

    const { rerender } = renderHook(({ tracks }) => useWaveformDataCache(tracks, 128), {
      initialProps: { tracks: [makeTrack('t1', [{ id: 'a', audioBuffer: buffer }])] },
    });
    await act(async () => {
      jobs[0].reject(new Error('boom'));
    });
    expect(console.warn).toHaveBeenCalledTimes(1);

    rerender({ tracks: [makeTrack('t1', [{ id: 'a', audioBuffer: buffer }])] });
    await waitFor(() => expect(worker.generate).toHaveBeenCalledTimes(2));
  });

  it('does not set state or warn for a job that settles after unmount', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { worker, jobs } = mockWorker();
    const buffer = makeBuffer();

    const { unmount } = renderHook(() =>
      useWaveformDataCache([makeTrack('t1', [{ id: 'a', audioBuffer: buffer }])], 128)
    );
    unmount();
    expect(worker.terminate).toHaveBeenCalled();

    await act(async () => {
      jobs[0].reject(new Error('Worker terminated'));
    });
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
