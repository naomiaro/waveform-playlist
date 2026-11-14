// @vitest-environment jsdom
//
// #812, review: the engine is disposed when the provider unmounts, on every
// path the loading effect can have taken last. An arrival (a track added or
// filled in place) leaves that effect with no cleanup of its own (#811), so
// the dispose is the provider's, in a mount-only cleanup that a StrictMode
// remount does not trigger.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi } from 'vitest';

vi.mock('../workers/peaksWorker', () => ({
  createPeaksWorker: () => ({
    generate: () => new Promise(() => {}),
    isTerminated: () => false,
    terminate: () => {},
  }),
}));

import { act, waitFor } from '@testing-library/react';
import React from 'react';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import {
  createFakeAdapter,
  fakeBuffer,
  flush,
  heldLoadSource,
  loadingTrack,
  mount,
  plainTrack,
  probe,
  ready,
  readyEvents,
  installProviderHarness,
  type FakeAdapter,
} from './providerHarness';

installProviderHarness();

/** One fake adapter per `createAdapter` call. */
function adapterPerBuild() {
  const adapters: FakeAdapter[] = [];
  const createAdapter = () => {
    const next = createFakeAdapter();
    adapters.push(next);
    return next as unknown as PlayoutAdapter;
  };
  return { adapters, createAdapter };
}

async function unmount(m: { unmount: () => void }) {
  await act(async () => {
    m.unmount();
  });
  await flush();
}

describe('the engine is disposed on unmount', () => {
  it('control: after a full build and nothing else', async () => {
    const m = mount([plainTrack('a')]);
    await ready();
    await unmount(m);
    expect(m.adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it('after a track was appended and its source arrived', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([plainTrack('a')], { loadSource });
    await ready();
    await act(async () => {
      m.setTracks([m.tracks()[0], loadingTrack('b', '/b.mp3')]);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    expect(m.adapter.updateTrack).toHaveBeenCalledTimes(1);
    expect(m.adapter.dispose).not.toHaveBeenCalled();

    await unmount(m);
    expect(m.adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it('after an incremental add alone', async () => {
    const m = mount([plainTrack('a')]);
    await ready();
    await act(async () => {
      m.setTracks([m.tracks()[0], plainTrack('b')]);
    });
    expect(m.adapter.addTrack).toHaveBeenCalledTimes(1);
    await unmount(m);
    expect(m.adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it('mounted empty, a track appended, its source arrived', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([], { loadSource });
    await ready();
    await act(async () => {
      m.setTracks([loadingTrack('a', '/a.mp3')]);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    expect(m.adapter.updateTrack).toHaveBeenCalledTimes(1);

    await unmount(m);
    expect(m.adapter.dispose).toHaveBeenCalledTimes(1);
  });

  it('under StrictMode the engine in use is not disposed, still plays and takes arrivals; the unmount disposes it once', async () => {
    const { calls, loadSource } = heldLoadSource();
    const { adapters, createAdapter } = adapterPerBuild();
    const m = mount([], { loadSource, createAdapter, strict: true });
    await ready();
    await flush();
    // StrictMode starts the first build twice; the last adapter is the engine's.
    const live = adapters[adapters.length - 1];
    expect(live.setTracks).toHaveBeenCalledTimes(1);
    expect(live.dispose).not.toHaveBeenCalled();
    for (const superseded of adapters.slice(0, -1)) {
      expect(superseded.dispose).toHaveBeenCalledTimes(1);
    }
    expect(readyEvents).toBe(1);

    // It still takes an arrival...
    await act(async () => {
      m.setTracks([loadingTrack('a', '/a.mp3')]);
    });
    await waitFor(() => expect(calls.filter((c) => !c.signal.aborted)).toHaveLength(1));
    await act(async () => {
      calls.forEach((call) => call.resolve(fakeBuffer()));
    });
    expect(live.updateTrack).toHaveBeenCalledTimes(1);
    // ...and still plays.
    await act(async () => {
      await probe.controls.play(0);
    });
    expect(live.play).toHaveBeenCalledTimes(1);
    expect(probe.isPlaying).toBe(true);
    expect(live.dispose).not.toHaveBeenCalled();
    const made = adapters.length;

    await unmount(m);
    expect(live.dispose).toHaveBeenCalledTimes(1);
    expect(adapters.length).toBe(made);
  });

  it('hidden in an <Activity> after an incremental add: disposed once; the reveal builds a new engine that plays', async () => {
    const { adapters, createAdapter } = adapterPerBuild();
    let setMode: (mode: 'visible' | 'hidden') => void = () => {};
    const Shell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      const [mode, set] = React.useState<'visible' | 'hidden'>('visible');
      setMode = set;
      return <React.Activity mode={mode}>{children}</React.Activity>;
    };
    const m = mount([plainTrack('a')], { createAdapter, wrap: (ui) => <Shell>{ui}</Shell> });
    await ready();
    await act(async () => {
      m.setTracks([m.tracks()[0], plainTrack('b')]);
    });
    expect(adapters[0].addTrack).toHaveBeenCalledTimes(1);

    await act(async () => setMode('hidden'));
    await flush();
    expect(adapters[0].dispose).toHaveBeenCalledTimes(1);

    await act(async () => setMode('visible'));
    await waitFor(() => expect(readyEvents).toBe(2));
    expect(adapters).toHaveLength(2);
    expect(adapters[1].setTracks.mock.lastCall?.[0].map((t) => t.id)).toEqual(['a', 'b']);
    await act(async () => {
      await probe.controls.play(0);
    });
    expect(adapters[1].play).toHaveBeenCalledTimes(1);
    expect(adapters[0].play).not.toHaveBeenCalled();
    expect(adapters[0].dispose).toHaveBeenCalledTimes(1);
    expect(adapters[1].dispose).not.toHaveBeenCalled();
  });

  it('a full rebuild after an arrival disposes the old engine once and the unmount the new one once', async () => {
    const { calls, loadSource } = heldLoadSource();
    const { adapters, createAdapter } = adapterPerBuild();
    const m = mount([plainTrack('a')], { loadSource, createAdapter });
    await ready();
    await act(async () => {
      m.setTracks([m.tracks()[0], loadingTrack('b', '/b.mp3')]);
    });
    await waitFor(() => expect(calls).toHaveLength(1));
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    // A track removed: a full rebuild.
    await act(async () => {
      m.setTracks([m.tracks()[1]]);
    });
    await waitFor(() => expect(readyEvents).toBe(2));
    expect(adapters).toHaveLength(2);
    expect(adapters[0].dispose).toHaveBeenCalledTimes(1);
    expect(adapters[1].dispose).not.toHaveBeenCalled();

    await unmount(m);
    expect(adapters[0].dispose).toHaveBeenCalledTimes(1);
    expect(adapters[1].dispose).toHaveBeenCalledTimes(1);
  });
});
