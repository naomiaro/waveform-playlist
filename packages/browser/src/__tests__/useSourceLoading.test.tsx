// @vitest-environment jsdom
//
// #812: `useSourceLoading` owns the provider's source loader. It tells the
// loader which sources the app's `tracks` name, hands it the buffers the
// tracks already carry, and publishes the loader's snapshot and a status
// value. These tests drive the hook alone; `providerLoadsSources.test.tsx`
// covers it inside the provider.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import React, { StrictMode } from 'react';
import type { AudioClip, ClipSource, LoadingClip, PlaylistTrack } from '@waveform-playlist/core';
import { useSourceLoading } from '../providerInternals/useSourceLoading';
import type { LoadSource } from '../utils/loadSource';

const SAMPLE_RATE = 48000;

function fakeBuffer(seconds = 1): AudioBuffer {
  return {
    sampleRate: SAMPLE_RATE,
    length: SAMPLE_RATE * seconds,
    duration: seconds,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(SAMPLE_RATE * seconds),
  } as unknown as AudioBuffer;
}

function loadingTrack(id: string, src: ClipSource): PlaylistTrack {
  const clip: LoadingClip = { id: id + '-clip', src };
  return { id, name: id, kind: 'audio', clips: [clip] } as PlaylistTrack;
}

function loadedTrack(id: string, src: ClipSource, audioBuffer: AudioBuffer): PlaylistTrack {
  const clip = {
    id: id + '-clip',
    src,
    audioBuffer,
    startSample: 0,
    durationSamples: audioBuffer.length,
    offsetSamples: 0,
    sampleRate: audioBuffer.sampleRate,
    sourceDurationSamples: audioBuffer.length,
    gain: 1,
  } as AudioClip;
  return { id, name: id, kind: 'audio', clips: [clip] } as PlaylistTrack;
}

interface PendingCall {
  src: ClipSource;
  signal: AbortSignal;
  resolve: (buffer: AudioBuffer) => void;
  reject: (error: Error) => void;
}

/** A `loadSource` that keeps every call pending until the test settles it. */
function heldLoadSource() {
  const calls: PendingCall[] = [];
  const loadSource: LoadSource = (src, { signal }) =>
    new Promise<AudioBuffer>((resolve, reject) => {
      calls.push({ src, signal, resolve, reject });
    });
  return { calls, loadSource };
}

const CONTEXT = { sampleRate: SAMPLE_RATE } as unknown as BaseAudioContext;
const contextNow = () => Promise.resolve(CONTEXT);

/** Let the awaited decode context and the promise chains after it run. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  });
}

interface Props {
  tracks: PlaylistTrack[];
  loadSource?: LoadSource;
  getDecodeContext?: () => Promise<BaseAudioContext>;
  onError?: (error: Error) => void;
}

function mountHook(initial: Props, strict = false) {
  return renderHook(
    (props: Props) =>
      useSourceLoading({
        tracks: props.tracks,
        loadSource: props.loadSource,
        getDecodeContext: props.getDecodeContext ?? contextNow,
        onError: props.onError,
      }),
    { initialProps: initial, wrapper: strict ? StrictMode : undefined }
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useSourceLoading', () => {
  it('asks for each source the tracks name once and publishes pending, then loaded', async () => {
    const { calls, loadSource } = heldLoadSource();
    const tracks = [loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')];
    const { result } = mountHook({ tracks, loadSource });
    await flush();

    expect(calls.map((c) => c.src)).toEqual(['/a.mp3', '/b.mp3']);
    expect(result.current.status.pendingCount).toBe(2);
    expect(result.current.status.isLoading).toBe(true);
    expect(result.current.hasUnsettledSource).toBe(true);
    expect(result.current.status.sources.get('/a.mp3')).toEqual({ status: 'pending' });

    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });
    expect(result.current.status.sources.get('/a.mp3')).toEqual({ status: 'loaded' });
    expect(result.current.sources.get('/a.mp3')).toEqual({ status: 'loaded', value: buffer });
    expect(result.current.status.pendingCount).toBe(1);

    await act(async () => {
      calls[1].resolve(fakeBuffer());
    });
    expect(result.current.status.isLoading).toBe(false);
    expect(result.current.hasUnsettledSource).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it('counts a source as unsettled on the very first render, before the loader was told', () => {
    const { loadSource } = heldLoadSource();
    const seen: boolean[] = [];
    renderHook(() => {
      const value = useSourceLoading({
        tracks: TRACKS_ONE,
        loadSource,
        getDecodeContext: contextNow,
      });
      seen.push(value.hasUnsettledSource);
      return value;
    });
    expect(seen[0]).toBe(true);
  });

  it('hands the decode context and the signal to loadSource', async () => {
    const { calls, loadSource } = heldLoadSource();
    const spy = vi.fn(loadSource);
    mountHook({ tracks: [loadingTrack('a', '/a.mp3')], loadSource: spy });
    await flush();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy.mock.calls[0][1].audioContext).toBe(CONTEXT);
    expect(spy.mock.calls[0][1].signal).toBe(calls[0].signal);
  });

  it('a new tracks array with the same sources aborts nothing and asks for nothing', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const { rerender } = mountHook({ tracks: [a], loadSource });
    await flush();
    for (let i = 0; i < 20; i++) rerender({ tracks: [a], loadSource });
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].signal.aborted).toBe(false);
  });

  it('keeps the status value and retry while no source changes state', async () => {
    const { loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const { result, rerender } = mountHook({ tracks: [a], loadSource });
    await flush();
    const status = result.current.status;
    rerender({ tracks: [{ ...a }], loadSource });
    expect(result.current.status).toBe(status);
    expect(result.current.status.retry).toBe(status.retry);
  });

  it('reads loadSource through a ref: an inline function on every render causes no new call', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const { rerender } = mountHook({ tracks: [a], loadSource: (s, c) => loadSource(s, c) });
    await flush();
    for (let i = 0; i < 5; i++) rerender({ tracks: [a], loadSource: (s, c) => loadSource(s, c) });
    await flush();
    expect(calls).toHaveLength(1);
  });

  it('a source no track names any more is aborted and forgotten', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const b = loadingTrack('b', '/b.mp3');
    const { result, rerender } = mountHook({ tracks: [a, b], loadSource });
    await flush();
    rerender({ tracks: [a], loadSource });
    expect(calls[1].signal.aborted).toBe(true);
    await act(async () => {
      calls[1].resolve(fakeBuffer());
    });
    expect(result.current.status.sources.has('/b.mp3')).toBe(false);
    expect(result.current.status.pendingCount).toBe(1);
  });

  it('a clip that carries src and audioBuffer is provided, not fetched', async () => {
    const { calls, loadSource } = heldLoadSource();
    const buffer = fakeBuffer();
    const { result, rerender } = mountHook({
      tracks: [loadedTrack('a', '/a.mp3', buffer)],
      loadSource,
    });
    await flush();
    expect(calls).toHaveLength(0);
    expect(result.current.status.sources.get('/a.mp3')).toEqual({ status: 'loaded' });
    expect(result.current.hasUnsettledSource).toBe(false);

    // A loading clip for the same source added later resolves from that buffer.
    rerender({
      tracks: [loadedTrack('a', '/a.mp3', buffer), loadingTrack('b', '/a.mp3')],
      loadSource,
    });
    await flush();
    expect(calls).toHaveLength(0);
    expect(result.current.sources.get('/a.mp3')).toEqual({ status: 'loaded', value: buffer });
  });

  it('reports a failed source once, and retry loads it', async () => {
    const { calls, loadSource } = heldLoadSource();
    const onError = vi.fn();
    const a = loadingTrack('a', '/a.mp3');
    const { result, rerender } = mountHook({ tracks: [a], loadSource, onError });
    await flush();
    const failure = new Error('no such file');
    await act(async () => {
      calls[0].reject(failure);
    });
    expect(result.current.status.sources.get('/a.mp3')).toEqual({
      status: 'failed',
      error: failure,
    });
    expect(result.current.status.failedCount).toBe(1);
    expect(result.current.hasUnsettledSource).toBe(false);
    rerender({ tracks: [{ ...a }], loadSource, onError });
    rerender({ tracks: [a], loadSource, onError });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onError).toHaveBeenCalledWith(failure);

    act(() => result.current.status.retry('/a.mp3'));
    await flush();
    expect(calls).toHaveLength(2);
    expect(result.current.status.sources.get('/a.mp3')).toEqual({ status: 'pending' });
    await act(async () => {
      calls[1].resolve(fakeBuffer());
    });
    expect(result.current.status.sources.get('/a.mp3')).toEqual({ status: 'loaded' });
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it('does not call loadSource when the load was aborted before the decode context arrived', async () => {
    const { calls, loadSource } = heldLoadSource();
    let release: (context: BaseAudioContext) => void = () => {};
    const getDecodeContext = () =>
      new Promise<BaseAudioContext>((resolve) => {
        release = resolve;
      });
    const { unmount } = mountHook({
      tracks: [loadingTrack('a', '/a.mp3')],
      loadSource,
      getDecodeContext,
    });
    await flush();
    unmount();
    await act(async () => {
      release(CONTEXT);
    });
    await flush();
    expect(calls).toHaveLength(0);
  });

  it('under StrictMode: one live load per source, and its result is used', async () => {
    const { calls, loadSource } = heldLoadSource();
    const { result } = mountHook({ tracks: [loadingTrack('a', '/a.mp3')], loadSource }, true);
    await flush();
    expect(calls.length).toBeGreaterThanOrEqual(1);
    expect(calls.length).toBeLessThanOrEqual(2);
    const live = calls.filter((c) => !c.signal.aborted);
    expect(live).toHaveLength(1);
    const buffer = fakeBuffer();
    await act(async () => {
      live[0].resolve(buffer);
    });
    expect(result.current.sources.get('/a.mp3')).toEqual({ status: 'loaded', value: buffer });
  });

  it('a remount keeps what was loaded and asks again only for what was in flight', async () => {
    const { calls, loadSource } = heldLoadSource();
    const tracks = [loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')];
    let setMode: (mode: 'visible' | 'hidden') => void = () => {};
    const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      const [mode, set] = React.useState<'visible' | 'hidden'>('visible');
      setMode = set;
      return <React.Activity mode={mode}>{children}</React.Activity>;
    };
    const { result } = renderHook(
      () => useSourceLoading({ tracks, loadSource, getDecodeContext: contextNow }),
      { wrapper: Wrapper }
    );
    await flush();
    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });
    expect(calls).toHaveLength(2);

    await act(async () => setMode('hidden'));
    expect(calls[1].signal.aborted).toBe(true);
    await act(async () => setMode('visible'));
    await flush();

    expect(calls.map((c) => c.src)).toEqual(['/a.mp3', '/b.mp3', '/b.mp3']);
    expect(calls[2].signal.aborted).toBe(false);
    expect(result.current.sources.get('/a.mp3')).toEqual({ status: 'loaded', value: buffer });
  });
});

const TRACKS_ONE = [loadingTrack('one', '/one.mp3')];
