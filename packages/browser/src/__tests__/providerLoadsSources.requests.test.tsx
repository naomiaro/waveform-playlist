// @vitest-environment jsdom
//
// #812: a clip in the app's `tracks` may name its audio (a `LoadingClip`), and
// `WaveformPlaylistProvider` loads it. This file: which sources are requested, and when a
// request is aborted or made again.
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

import { render, act, waitFor } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import type { AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import {
  SAMPLE_RATE,
  Probe,
  builtClips,
  createFakeAdapter,
  fakeBuffer,
  flush,
  heldLoadSource,
  loadingTrack,
  mount,
  plainClip,
  plainTrack,
  probe,
  sourceStatus,
  probeRenders,
  ready,
  readyEvents,
  track,
  installProviderHarness,
  type FakeAdapter,
} from './providerHarness';

installProviderHarness();

describe('which sources are requested', () => {
  it('2: an inline tracks array on every parent render: one call per source, bounded renders', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const b = loadingTrack('b', '/b.mp3');
    const adapter = createFakeAdapter();
    const createAdapter = () => adapter as unknown as PlayoutAdapter;
    let parentRenders = 0;
    const Parent: React.FC = () => {
      parentRenders++;
      return (
        <WaveformPlaylistProvider
          tracks={[a, b]}
          loadSource={loadSource}
          sampleRate={SAMPLE_RATE}
          createAdapter={createAdapter}
        >
          <Probe />
        </WaveformPlaylistProvider>
      );
    };
    const view = render(<Parent />);
    await waitFor(() => expect(calls).toHaveLength(2));
    view.rerender(<Parent />);
    view.rerender(<Parent />);
    await act(async () => {
      calls[0].resolve(fakeBuffer());
      calls[1].resolve(fakeBuffer());
    });
    await ready();
    await flush();

    expect(calls).toHaveLength(2);
    expect(parentRenders).toBe(3);
    expect(probeRenders).toBeLessThan(20);
    expect(readyEvents).toBe(1);
    expect(adapter.setTracks).toHaveBeenCalledTimes(1);
  });

  it('3: two clips naming one URL: one call, and both resolved clips share the buffer', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/same.mp3'), loadingTrack('b', '/same.mp3')], {
      loadSource,
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    const buffer = fakeBuffer();
    await act(async () => {
      calls[0].resolve(buffer);
    });
    await ready();

    expect(calls).toHaveLength(1);
    const clips = builtClips(m.adapter);
    expect(clips[0][0].audioBuffer).toBe(buffer);
    expect(clips[1][0].audioBuffer).toBe(buffer);
  });

  it('11: two different File objects with equal contents: two calls, two tracks', async () => {
    const { calls, loadSource } = heldLoadSource();
    const one = new File(['same bytes'], 'take.wav');
    const two = new File(['same bytes'], 'take.wav');
    const m = mount([loadingTrack('a', one), loadingTrack('b', two)], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(calls[0].src).toBe(one);
    expect(calls[1].src).toBe(two);
    const first = fakeBuffer();
    const second = fakeBuffer();
    await act(async () => {
      calls[0].resolve(first);
      calls[1].resolve(second);
    });
    await ready();
    const clips = builtClips(m.adapter);
    expect(clips[0][0].audioBuffer).toBe(first);
    expect(clips[1][0].audioBuffer).toBe(second);
  });

  it('4: under StrictMode sources load, at most two calls per source, one result used, one build', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')], {
      loadSource,
      strict: true,
    });
    await waitFor(() => expect(calls.filter((c) => !c.signal.aborted)).toHaveLength(2));
    for (const src of ['/a.mp3', '/b.mp3']) {
      const forSrc = calls.filter((c) => c.src === src);
      expect(forSrc.length).toBeLessThanOrEqual(2);
      expect(forSrc.filter((c) => !c.signal.aborted)).toHaveLength(1);
    }
    // Every call is settled, the aborted ones too, each with its own buffer.
    const buffers = calls.map(() => fakeBuffer());
    await act(async () => {
      calls.forEach((call, i) => call.resolve(buffers[i]));
    });
    await ready();
    await flush();

    expect(readyEvents).toBe(1);
    const built = m.adapter.setTracks.mock.lastCall?.[0] ?? [];
    expect(built.map((t) => t.id)).toEqual(['a', 'b']);
    expect(built.map((t) => t.clips.length)).toEqual([1, 1]);
    const liveBuffer = (src: string) =>
      buffers[calls.findIndex((c) => c.src === src && !c.signal.aborted)];
    expect(built[0].clips[0].audioBuffer).toBe(liveBuffer('/a.mp3'));
    expect(built[1].clips[0].audioBuffer).toBe(liveBuffer('/b.mp3'));
    expect(m.createAdapter).toHaveBeenCalledTimes(1);
    expect(m.adapter.dispose).not.toHaveBeenCalled();
  });

  it('4b: a new tracks array on 20 renders while a load is in flight never aborts it', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const m = mount([a], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));
    for (let i = 0; i < 20; i++) {
      await act(async () => {
        m.setTracks([a]);
      });
    }
    expect(calls).toHaveLength(1);
    expect(calls[0].signal.aborted).toBe(false);
  });

  it('14: loadSource as a new inline function on every render: no extra calls', async () => {
    const { calls, loadSource } = heldLoadSource();
    const a = loadingTrack('a', '/a.mp3');
    const adapter = createFakeAdapter();
    const createAdapter = () => adapter as unknown as PlayoutAdapter;
    const Parent: React.FC = () => (
      <WaveformPlaylistProvider
        tracks={[a]}
        loadSource={(src, context) => loadSource(src, context)}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
      >
        <Probe />
      </WaveformPlaylistProvider>
    );
    const view = render(<Parent />);
    await waitFor(() => expect(calls).toHaveLength(1));
    for (let i = 0; i < 10; i++) view.rerender(<Parent />);
    await flush();
    expect(calls).toHaveLength(1);
    expect(calls[0].signal.aborted).toBe(false);
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await ready();
    expect(readyEvents).toBe(1);
  });

  it('9: a track removed while its source is pending: that call is aborted and its late result changes nothing', async () => {
    const { calls, loadSource } = heldLoadSource();
    const keep = plainTrack('keep');
    const m = mount([keep], { loadSource });
    await ready();
    await act(async () => {
      m.setTracks([keep, loadingTrack('a', '/a.mp3')]);
    });
    await waitFor(() => expect(calls).toHaveLength(1));

    await act(async () => {
      m.setTracks([m.tracks()[0]]);
    });
    await flush();
    expect(calls[0].signal.aborted).toBe(true);
    const updatesBefore = m.adapter.updateTrack.mock.calls.length;
    const buildsBefore = m.adapter.setTracks.mock.calls.length;

    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await flush();
    expect(m.adapter.updateTrack.mock.calls.length).toBe(updatesBefore);
    expect(m.adapter.setTracks.mock.calls.length).toBe(buildsBefore);
    expect(probe.timeline.tracks.map((t) => t.id)).toEqual(['keep']);
    expect(sourceStatus?.sources.has('/a.mp3')).toBe(false);
  });

  it('12: a clip with src and audioBuffer is not fetched; a later loading clip for that src uses its buffer', async () => {
    const { calls, loadSource } = heldLoadSource();
    const buffer = fakeBuffer();
    const carried = {
      ...plainClip('a-clip'),
      src: '/a.mp3',
      audioBuffer: buffer,
    } as AudioClip;
    const a = track('a', [carried]);
    const m = mount([a], { loadSource });
    await ready();
    await flush();
    expect(calls).toHaveLength(0);
    expect(sourceStatus?.sources.get('/a.mp3')).toEqual({ status: 'loaded' });
    expect(readyEvents).toBe(1);

    await act(async () => {
      m.setTracks([m.tracks()[0], loadingTrack('b', '/a.mp3')]);
    });
    await flush();
    expect(calls).toHaveLength(0);
    const added = m.adapter.addTrack.mock.lastCall?.[0];
    expect(added?.id).toBe('b');
    expect(added?.clips[0].audioBuffer).toBe(buffer);
    expect(readyEvents).toBe(1);
  });

  it('15: hidden then revealed: what was loaded is not requested again, what was in flight is, once', async () => {
    const { calls, loadSource } = heldLoadSource();
    let setMode: (mode: 'visible' | 'hidden') => void = () => {};
    const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      const [mode, set] = React.useState<'visible' | 'hidden'>('visible');
      setMode = set;
      return <React.Activity mode={mode}>{children}</React.Activity>;
    };
    const adapters: FakeAdapter[] = [];
    const m = mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')], {
      loadSource,
      wrap: (ui) => <Shell>{ui}</Shell>,
      createAdapter: () => {
        const next = createFakeAdapter();
        adapters.push(next);
        return next as unknown as PlayoutAdapter;
      },
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    const bufferA = fakeBuffer();
    await act(async () => {
      calls[0].resolve(bufferA);
    });

    await act(async () => setMode('hidden'));
    expect(calls[1].signal.aborted).toBe(true);
    await act(async () => setMode('visible'));
    await waitFor(() => expect(calls).toHaveLength(3));
    await flush();

    expect(calls.map((c) => c.src)).toEqual(['/a.mp3', '/b.mp3', '/b.mp3']);
    await act(async () => {
      calls[2].resolve(fakeBuffer());
    });
    await ready();
    expect(readyEvents).toBe(1);
    // React gives a hidden tree the cleanup of an unmount: the adapter that
    // was waiting for the first build was disposed, and the reveal made the
    // one the build used.
    expect(m.createAdapter).toHaveBeenCalledTimes(2);
    expect(adapters[0].dispose).toHaveBeenCalledTimes(1);
    expect(adapters[0].setTracks).not.toHaveBeenCalled();
    expect(adapters[1].dispose).not.toHaveBeenCalled();
    expect(builtClips(adapters[1])[0][0].audioBuffer).toBe(bufferA);
    expect(builtClips(adapters[1]).map((clips) => clips.length)).toEqual([1, 1]);
  });

  it('20: a pending loading clip replaced by a clip that carries the buffer: provided, the load aborted', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([plainTrack('a')], { loadSource });
    await ready();
    await act(async () => {
      m.setTracks([m.tracks()[0], loadingTrack('b', '/b.mp3')]);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(sourceStatus?.sources.get('/b.mp3')).toEqual({ status: 'pending' });

    // The app got the audio another way and puts the loaded clip in itself.
    const own = fakeBuffer();
    const carried = { ...plainClip('b-clip'), src: '/b.mp3', audioBuffer: own } as AudioClip;
    await act(async () => {
      m.setTracks([m.tracks()[0], { ...m.tracks()[1], clips: [carried] }]);
    });
    await flush();

    expect(sourceStatus?.sources.get('/b.mp3')).toEqual({ status: 'loaded' });
    expect(calls[0].signal.aborted).toBe(true);
    expect(m.adapter.updateTrack.mock.lastCall?.[0]).toBe('b');
    expect(m.adapter.updateTrack.mock.lastCall?.[1].clips[0].audioBuffer).toBe(own);
    const updates = m.adapter.updateTrack.mock.calls.length;

    // The decode that was in flight arrives late: nothing is made from it.
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await flush();
    expect(m.adapter.updateTrack.mock.calls.length).toBe(updates);
    expect(probe.timeline.tracks[1].clips[0].audioBuffer).toBe(own);
    expect(readyEvents).toBe(1);
  });
});
