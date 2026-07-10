// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

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

function makeTrack(trackId: string, clipId: string, audioBuffer: AudioBuffer): any {
  return { id: trackId, clips: [{ id: clipId, audioBuffer }] };
}

const fakeWaveformData = { scale: 128 } as any;

describe('useWaveformDataCache worker recovery', () => {
  it('recreates the worker after a crash instead of rejecting forever', async () => {
    // A crashed worker (onerror) marks itself terminated; the hook must not
    // keep reusing it — that poisons every later generation until remount.
    const crashedWorker = {
      generate: vi.fn(() => Promise.reject(new Error('Worker terminated'))),
      isTerminated: vi.fn(() => true),
      terminate: vi.fn(),
    };
    const healthyWorker = {
      generate: vi.fn(() => Promise.resolve(fakeWaveformData)),
      isTerminated: vi.fn(() => false),
      terminate: vi.fn(),
    };
    vi.mocked(createPeaksWorker)
      .mockImplementationOnce(() => crashedWorker as any)
      .mockImplementation(() => healthyWorker as any);

    const buf1 = makeBuffer();
    const { result, rerender } = renderHook(({ tracks }) => useWaveformDataCache(tracks, 128), {
      initialProps: { tracks: [makeTrack('t1', 'c1', buf1)] },
    });
    await waitFor(() => expect(crashedWorker.generate).toHaveBeenCalled());

    // A new buffer arrives after the crash — it must get a FRESH worker.
    const buf2 = makeBuffer();
    rerender({ tracks: [makeTrack('t1', 'c1', buf1), makeTrack('t2', 'c2', buf2)] });

    await waitFor(() => expect(result.current.cache.has('c2')).toBe(true));
    expect(healthyWorker.generate).toHaveBeenCalled();
  });
});
