// @vitest-environment jsdom
//
// #812: a clip in the app's `tracks` may name its audio (a `LoadingClip`), and
// `WaveformPlaylistProvider` loads it. This file: the first load (only the tracks the provider
// is mounted with wait for every source) and the decode context.
//
// The harness (`providerHarness.tsx`) mounts the real provider with a fake
// adapter, a `loadSource` whose calls stay pending until the test settles
// them, and a counter of `waveform-playlist:ready` events (one per FULL
// engine build).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi } from 'vitest';

vi.mock('../workers/peaksWorker', () => ({
  // Peaks are not the subject: a worker whose jobs never finish.
  createPeaksWorker: () => ({
    generate: () => new Promise(() => {}),
    isTerminated: () => false,
    terminate: () => {},
  }),
}));

import { act, waitFor } from '@testing-library/react';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import {
  builtClips,
  createFakeAdapter,
  fakeBuffer,
  flush,
  heldLoadSource,
  loadingClip,
  loadingTrack,
  mount,
  plainTrack,
  probe,
  sourceStatus,
  ready,
  readyEvents,
  track,
  installProviderHarness,
  type FakeAdapter,
} from './providerHarness';

installProviderHarness();

describe('the first load', () => {
  it('1: mounted with two loading tracks, nothing reaches the adapter until both settle; then ONE build', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(m.adapter.setTracks).not.toHaveBeenCalled();

    const bufferA = fakeBuffer();
    await act(async () => {
      calls[0].resolve(bufferA);
    });
    await flush();
    expect(m.adapter.setTracks).not.toHaveBeenCalled();
    expect(m.adapter.addTrack).not.toHaveBeenCalled();
    expect(readyEvents).toBe(0);
    expect(probe.timeline.isReady).toBe(false);

    await act(async () => {
      calls[1].resolve(fakeBuffer());
    });
    await ready();

    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(builtClips(m.adapter).map((clips) => clips.length)).toEqual([1, 1]);
    expect(builtClips(m.adapter)[0][0].audioBuffer).toBe(bufferA);
    expect(builtClips(m.adapter)[0][0].src).toBe('/a.mp3');
    expect(readyEvents).toBe(1);
    expect(m.onReady).toHaveBeenCalledTimes(1);
    // The adapter that gave the decode context is the one the build used.
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(m.adapter.dispose).not.toHaveBeenCalled();
    expect(m.adapter.addTrack).not.toHaveBeenCalled();
    expect(m.adapter.updateTrack).not.toHaveBeenCalled();
    // A buffer arriving never reaches the app.
    expect(m.onTracksChange).not.toHaveBeenCalled();
  });

  it('1c: a later full rebuild makes one more adapter: createAdapter calls equal builds', async () => {
    const { calls, loadSource } = heldLoadSource();
    const adapters: FakeAdapter[] = [];
    const a = loadingTrack('a', '/a.mp3');
    const b = plainTrack('b');
    const m = mount([a, b], {
      loadSource,
      createAdapter: () => {
        const next = createFakeAdapter();
        adapters.push(next);
        return next as unknown as PlayoutAdapter;
      },
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await ready();
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(readyEvents).toBe(1);

    // A track removed: a full rebuild.
    await act(async () => {
      m.setTracks([a]);
    });
    await waitFor(() => expect(readyEvents).toBe(2));
    expect(m.createAdapter).toHaveBeenCalledTimes(2);
    expect(adapters[0].dispose).toHaveBeenCalledTimes(1);
    expect(adapters[1].setTracks).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(1);
  });

  it('1b: mounted with NO tracks, each track appended later arrives on its own', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([], { loadSource });
    await ready();
    expect(readyEvents).toBe(1);

    const a = loadingTrack('a', '/a.mp3');
    const b = loadingTrack('b', '/b.mp3');
    await act(async () => {
      m.setTracks([a, b]);
    });
    // Each enters at once as a track with no clips.
    expect(m.adapter.addTrack.mock.calls.map(([t]) => [t.id, t.clips.length])).toEqual([
      ['a', 0],
      ['b', 0],
    ]);
    await waitFor(() => expect(calls).toHaveLength(2));

    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    // The first has its clip while the second is still pending.
    expect(m.adapter.updateTrack.mock.calls.map(([id, t]) => [id, t.clips.length])).toEqual([
      ['a', 1],
    ]);
    expect(calls[1].signal.aborted).toBe(false);

    await act(async () => {
      calls[1].resolve(fakeBuffer());
    });
    expect(m.adapter.updateTrack.mock.calls.map(([id, t]) => [id, t.clips.length])).toEqual([
      ['a', 1],
      ['b', 1],
    ]);
    expect(readyEvents).toBe(1);
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(m.adapter.dispose).not.toHaveBeenCalled();
  });

  it('1d: mounted with NO tracks, a track named before the first build has finished does not hold it back', async () => {
    const { calls, loadSource } = heldLoadSource();
    // One adapter per build attempt, each still on its way (as the dynamic
    // import of the default engine is). The track arrives while the build for
    // the empty timeline waits for its adapter, which starts the build again,
    // as any `tracks` change during a build does.
    const attempts: Array<{ adapter: FakeAdapter; arrive: () => void }> = [];
    const m = mount([], {
      loadSource,
      createAdapter: () => {
        const adapter = createFakeAdapter();
        let arrive = () => {};
        const pending = new Promise<PlayoutAdapter>((resolve) => {
          arrive = () => resolve(adapter as unknown as PlayoutAdapter);
        });
        attempts.push({ adapter, arrive });
        return pending as unknown as PlayoutAdapter;
      },
    });
    await flush();
    await act(async () => {
      m.setTracks([loadingTrack('a', '/a.mp3')]);
    });
    await flush();
    // No context yet, so nothing is fetched yet.
    expect(calls).toHaveLength(0);
    expect(readyEvents).toBe(0);

    await act(async () => {
      attempts.forEach((attempt) => attempt.arrive());
    });
    // Built without waiting for the source: the track is there, empty.
    await ready();
    const { adapter } = attempts[attempts.length - 1];
    expect(readyEvents).toBe(1);
    expect(adapter.setTracks.mock.lastCall?.[0].map((t) => [t.id, t.clips.length])).toEqual([
      ['a', 0],
    ]);
    expect(adapter.dispose).not.toHaveBeenCalled();
    for (const superseded of attempts.slice(0, -1)) {
      expect(superseded.adapter.dispose).toHaveBeenCalledTimes(1);
      expect(superseded.adapter.setTracks).not.toHaveBeenCalled();
    }
    // The build's adapter is the decode context the load was waiting for.
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    expect(adapter.updateTrack.mock.calls.map(([id, t]) => [id, t.clips.length])).toEqual([
      ['a', 1],
    ]);
    expect(readyEvents).toBe(1);
  });

  it('1e: a source named during the wait, after the adapter has arrived, is fetched at once', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const m = mount([a], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => {
      m.setTracks([a, loadingTrack('b', '/b.mp3')]);
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[1].src).toBe('/b.mp3');
    expect(m.adapter.setTracks).not.toHaveBeenCalled();
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
  });

  // Review of #812. With no `sampleRate` prop the provider resolves at a
  // provisional 48000 until the adapter tells it the real rate. A placeholder
  // is made again at that rate; the engine sees nothing of a placeholder, so
  // that must not be a second build.
  it('18: the sample rate reconciled after the first build is not a second build', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3', { duration: 3 })], {
      loadSource,
      sampleRate: null,
      adapterSampleRate: 44100,
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    // Drawn at the provisional rate while it loads.
    expect(probe.timeline.tracks[1].clips[0].sampleRate).toBe(48000);
    await act(async () => {
      calls[1].reject(new Error('404'));
      calls[0].resolve(fakeBuffer());
    });
    await ready();
    await flush();

    // The failed clip's placeholder is now at the adapter's rate...
    expect(probe.timeline.tracks[1].clips[0].sampleRate).toBe(44100);
    // ...and there was one build.
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(readyEvents).toBe(1);
    expect(m.onReady).toHaveBeenCalledTimes(1);
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(m.adapter.dispose).not.toHaveBeenCalled();
  });

  it('19: a loading clip on a MIDI track is not fetched and does not hold back the first build', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { calls, loadSource } = heldLoadSource();
    const midi = track('m', [loadingClip('m-clip', '/m.mp3')], { kind: 'midi' });
    const m = mount([midi, loadingTrack('a', '/a.mp3')], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));
    await flush();
    expect(calls.map((c) => c.src)).toEqual(['/a.mp3']);

    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await ready();
    await flush();

    expect(readyEvents).toBe(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(builtClips(m.adapter).map((clips) => clips.length)).toEqual([0, 1]);
    expect(calls).toHaveLength(1);
    expect(sourceStatus?.sources.has('/m.mp3')).toBe(false);
    const rejected = m.onError.mock.calls.filter(([error]) => error.message.includes('"m-clip"'));
    expect(rejected).toHaveLength(1);
    expect(m.onError).toHaveBeenCalledTimes(1);
  });

  it('13: play() during the first-load wait does nothing', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/a.mp3')], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => {
      await probe.controls.play();
    });
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await ready();
    await flush();

    expect(probe.isPlaying).toBe(false);
    expect(m.adapter.play).not.toHaveBeenCalled();
  });

  it('5: one source fails: one build with the others, onError once; retry loads it with no second build', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(2));
    const failure = new Error('404');
    await act(async () => {
      calls[1].reject(failure);
    });
    expect(m.adapter.setTracks).not.toHaveBeenCalled();
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await ready();

    expect(readyEvents).toBe(1);
    expect(builtClips(m.adapter).map((clips) => clips.length)).toEqual([1, 0]);
    m.rerender();
    m.rerender();
    expect(m.onError).toHaveBeenCalledTimes(1);
    expect(m.onError).toHaveBeenCalledWith(failure);
    expect(sourceStatus?.sources.get('/b.mp3')).toEqual({ status: 'failed', error: failure });
    expect(sourceStatus?.failedCount).toBe(1);

    act(() => sourceStatus?.retry('/b.mp3'));
    await waitFor(() => expect(calls).toHaveLength(3));
    await act(async () => {
      calls[2].resolve(fakeBuffer());
    });

    expect(m.adapter.updateTrack.mock.calls.map(([id, t]) => [id, t.clips.length])).toEqual([
      ['b', 1],
    ]);
    expect(readyEvents).toBe(1);
    expect(m.adapter.setTracks).toHaveBeenCalledTimes(1);
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(sourceStatus?.sources.get('/b.mp3')).toEqual({ status: 'loaded' });
    expect(m.onError).toHaveBeenCalledTimes(1);
  });

  it('10: unmounted before the decode context resolves: nothing is fetched and the adapter is disposed once', async () => {
    const { calls, loadSource } = heldLoadSource();
    const adapter = createFakeAdapter();
    let arrive: (value: PlayoutAdapter) => void = () => {};
    const pending = new Promise<PlayoutAdapter>((resolve) => {
      arrive = resolve;
    });
    const m = mount([loadingTrack('a', '/a.mp3')], {
      loadSource,
      // Awaited by resolvePlayoutAdapter, like the real dynamic import.
      createAdapter: () => pending as unknown as PlayoutAdapter,
    });
    await flush();
    expect(m.createAdapter).toHaveBeenCalledTimes(1);

    await act(async () => {
      m.unmount();
    });
    await act(async () => {
      arrive(adapter as unknown as PlayoutAdapter);
    });
    await flush();

    expect(calls).toHaveLength(0);
    expect(adapter.dispose).toHaveBeenCalledTimes(1);
    expect(adapter.setTracks).not.toHaveBeenCalled();
    expect(readyEvents).toBe(0);
  });
});
