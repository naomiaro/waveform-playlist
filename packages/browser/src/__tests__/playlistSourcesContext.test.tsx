// @vitest-environment jsdom
//
// #812: `usePlaylistSources()`, the loading status of the sources
// `WaveformPlaylistProvider` loads. Served by that provider only; nothing in
// the view reads it. The throw under `MediaElementPlaylistProvider` (also
// nested both ways) and outside any provider is pinned for every hook by
// `sharedPlaybackInterface.test.tsx` and `contextSplitByChangeRate.test.tsx`,
// which list this one; the cases here are the same checks, written out.
//
// The harness (`providerHarness.tsx`) mounts the real provider with a fake
// adapter and a `loadSource` that stays pending until the test settles it.
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
import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { usePlaylistSources } from '../contexts/playlistContexts';
import type { PlaylistSourcesValue } from '../contexts/playlistContexts';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import {
  SAMPLE_RATE,
  createFakeAdapter,
  fakeBuffer,
  flush,
  heldLoadSource,
  installProviderHarness,
  loadingTrack,
  mount,
  plainTrack,
  probe,
  readyEvents,
  sourceStatus,
} from './providerHarness';

installProviderHarness();

const status = (): PlaylistSourcesValue => {
  if (!sourceStatus) throw new Error('no status read yet');
  return sourceStatus;
};

/** A reader of this hook only, so its render count is the hook's. */
function countingReader() {
  const counts = { renders: 0 };
  const Reader: React.FC = () => {
    counts.renders++;
    usePlaylistSources();
    return null;
  };
  return { counts, element: <Reader /> };
}

describe('usePlaylistSources: the value', () => {
  it('has exactly the documented fields', async () => {
    const { calls, loadSource } = heldLoadSource();
    mount([loadingTrack('a', '/a.mp3'), plainTrack('p')], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));
    expect(Object.keys(status()).sort()).toEqual([
      'failedCount',
      'isLoading',
      'pendingCount',
      'retry',
      'sources',
    ]);
    expect(status().sources).toBeInstanceOf(Map);
  });

  it('isLoading is pendingCount > 0, and the counts follow each source', async () => {
    const { calls, loadSource } = heldLoadSource();
    mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(2));
    expect(status()).toMatchObject({ pendingCount: 2, failedCount: 0, isLoading: true });

    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    expect(status()).toMatchObject({ pendingCount: 1, failedCount: 0, isLoading: true });

    await act(async () => {
      calls[1].reject(new Error('404'));
    });
    expect(status()).toMatchObject({ pendingCount: 0, failedCount: 1, isLoading: false });
  });

  it('holds no AudioBuffer: an entry has `status`, and `error` for a failed source only', async () => {
    const { calls, loadSource } = heldLoadSource();
    mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3'), loadingTrack('c', '/c.mp3')], {
      loadSource,
    });
    await waitFor(() => expect(calls).toHaveLength(3));
    await act(async () => {
      calls[0].resolve(fakeBuffer());
      calls[1].reject(new Error('nope'));
    });
    const keys = Object.fromEntries(
      [...status().sources].map(([src, entry]) => [src, Object.keys(entry)])
    );
    expect(keys).toEqual({
      '/a.mp3': ['status'],
      '/b.mp3': ['status', 'error'],
      '/c.mp3': ['status'],
    });
    expect(status().sources.get('/a.mp3')).toEqual({ status: 'loaded' });
    expect(status().sources.get('/c.mp3')).toEqual({ status: 'pending' });
  });
});

describe('usePlaylistSources: identity and renders', () => {
  it('keeps its identity across a trim, a zoom, play and stop, a mixer change and a parent render with a new tracks array', async () => {
    const m = mount([plainTrack('a'), loadingTrack('b', '/b.mp3')], {
      loadSource: heldLoadSource().loadSource,
    });
    await waitFor(() => expect(probe.timeline.isReady).toBe(false));
    await flush();
    const before = status();

    await act(async () => {
      probe.editor.zoomIn();
    });
    expect(status()).toBe(before);

    await act(async () => {
      probe.editor.setTrackVolume('a', 0.4);
    });
    expect(status()).toBe(before);

    await act(async () => {
      probe.controls.play();
    });
    await act(async () => {
      probe.controls.stop();
    });
    expect(status()).toBe(before);

    // A trim of a clip (the engine hands the new tracks back through the provider).
    await act(async () => {
      probe.refs.playoutRef.current?.trimClip('a', 'a-clip', 'right', -SAMPLE_RATE / 2);
    });
    await flush();
    expect(status()).toBe(before);

    // A parent render that hands over a new array of the same tracks.
    m.setTracks([...m.tracks()]);
    m.rerender();
    expect(status()).toBe(before);
    expect(status().retry).toBe(before.retry);
  });

  it('a reader renders once per settle, and not for a mixer change or a selection', async () => {
    const { calls, loadSource } = heldLoadSource();
    const reader = countingReader();
    mount([loadingTrack('a', '/a.mp3'), loadingTrack('b', '/b.mp3')], {
      loadSource,
      children: reader.element,
    });
    await waitFor(() => expect(calls).toHaveLength(2));
    await flush();

    let before = reader.counts.renders;
    await act(async () => {
      calls[0].resolve(fakeBuffer());
    });
    await flush();
    expect(reader.counts.renders).toBe(before + 1);

    before = reader.counts.renders;
    await act(async () => {
      calls[1].reject(new Error('404'));
    });
    await flush();
    expect(reader.counts.renders).toBe(before + 1);

    before = reader.counts.renders;
    await act(async () => {
      probe.editor.setTrackVolume('a', 0.3);
      probe.editor.setMasterVolume(0.5);
    });
    await act(async () => {
      probe.controls.setSelection(0.1, 0.5);
    });
    expect(reader.counts.renders).toBe(before);
  });

  it('retry keeps its identity for the provider life and restarts a failed source from the value', async () => {
    const { calls, loadSource } = heldLoadSource();
    const m = mount([plainTrack('a'), loadingTrack('b', '/b.mp3')], { loadSource });
    await waitFor(() => expect(calls).toHaveLength(1));
    const retry = status().retry;

    await act(async () => {
      calls[0].reject(new Error('404'));
    });
    expect(status().retry).toBe(retry);
    expect(status().sources.get('/b.mp3')?.status).toBe('failed');

    const events = readyEvents;
    act(() => status().retry('/b.mp3'));
    expect(status().sources.get('/b.mp3')).toEqual({ status: 'pending' });
    await waitFor(() => expect(calls).toHaveLength(2));
    await act(async () => {
      calls[1].resolve(fakeBuffer());
    });
    await flush();

    expect(status().sources.get('/b.mp3')).toEqual({ status: 'loaded' });
    expect(status().retry).toBe(retry);
    // The clip entered the engine in place: no second full build.
    expect(readyEvents).toBe(events);
    const ids = [
      ...m.adapter.addTrack.mock.calls.map(([t]) => t.id),
      ...m.adapter.updateTrack.mock.calls.map(([id]) => id),
    ];
    expect(ids).toContain('b');
  });
});

describe('usePlaylistSources: which provider serves it', () => {
  const Reader: React.FC = () => {
    usePlaylistSources();
    return null;
  };
  class Boundary extends React.Component<
    { children: React.ReactNode; onError: (e: Error) => void },
    { failed: boolean }
  > {
    state = { failed: false };
    static getDerivedStateFromError() {
      return { failed: true };
    }
    componentDidCatch(error: Error) {
      this.props.onError(error);
    }
    render() {
      return this.state.failed ? null : this.props.children;
    }
  }
  const thrownBy = (wrap: (child: React.ReactNode) => React.ReactElement): string | null => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    let message: string | null = null;
    render(
      wrap(
        <Boundary onError={(e) => (message = e.message)}>
          <Reader />
        </Boundary>
      )
    );
    return message;
  };
  const webAudio = (child: React.ReactNode) => (
    <WaveformPlaylistProvider
      tracks={[]}
      createAdapter={() => createFakeAdapter() as unknown as PlayoutAdapter}
    >
      {child}
    </WaveformPlaylistProvider>
  );
  const mediaElement = (child: React.ReactNode) => (
    <MediaElementPlaylistProvider
      track={{ source: 'x.mp3', waveformData: { sample_rate: 48000, duration: 1 } as never }}
      createPlayout={() =>
        ({
          addTrack() {},
          setOnPlaybackComplete() {},
          on() {},
          off() {},
          dispose() {},
          pause() {},
          stop() {},
        }) as never
      }
    >
      {child}
    </MediaElementPlaylistProvider>
  );

  it('throws outside any provider', () => {
    expect(thrownBy((c) => <>{c}</>)).toBe(
      'usePlaylistSources must be used within WaveformPlaylistProvider'
    );
  });

  it('throws the blocked-hook message under MediaElementPlaylistProvider', () => {
    expect(thrownBy(mediaElement)).toMatch(/needs WaveformPlaylistProvider/);
  });

  it('the nearest provider wins, nested both ways', () => {
    expect(thrownBy((c) => webAudio(mediaElement(c)))).toMatch(
      /nearest playlist provider here is MediaElementPlaylistProvider/
    );
    expect(thrownBy((c) => mediaElement(webAudio(c)))).toBeNull();
  });
});
