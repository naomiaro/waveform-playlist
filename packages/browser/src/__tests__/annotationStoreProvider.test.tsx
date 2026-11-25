// @vitest-environment jsdom
//
// Both providers take an `annotationStore` and publish its annotations; the
// store is the one owner (#867).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import React, { useDeferredValue } from 'react';
import { createAnnotationStore } from '@waveform-playlist/core';
import type { AnnotationData, AnnotationStore } from '@waveform-playlist/core';
import WaveformData from 'waveform-data';
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';
import { TestProvider } from './helpers/arrangementProvider';
import { MediaElementPlaylistProvider } from '../MediaElementPlaylistContext';
import { useAnnotations, usePlaybackControls } from '../contexts/playlistContexts';
import { useStoredAnnotations } from '../hooks/useStoredAnnotations';

const note = (id: string, start = 0, end = 1): AnnotationData => ({
  id,
  start,
  end,
  lines: [id],
});
const ids = (list: readonly AnnotationData[]) => list.map((a) => a.id);

const WAVEFORM_DATA = WaveformData.create({
  version: 2,
  channels: 1,
  sample_rate: 44100,
  samples_per_pixel: 441,
  bits: 8,
  length: 400,
  data: Array.from({ length: 800 }, (_, i) => (i % 2 === 0 ? -10 : 10)),
});

function createFakePlayout() {
  return {
    addTrack: vi.fn(),
    getTrack: () => undefined,
    setOnPlaybackComplete() {},
    on(event: string, listener: () => void) {
      if (event === 'loadedmetadata') queueMicrotask(listener);
    },
    off() {},
    play: vi.fn(),
    pause() {},
    stop() {},
    seekTo() {},
    setPlaybackRate() {},
    getCurrentTime: () => 0,
    dispose() {},
  };
}

let probe: {
  annotations: readonly AnnotationData[];
  controls: ReturnType<typeof usePlaybackControls>;
};
const Probe: React.FC = () => {
  probe = { annotations: useAnnotations().annotations, controls: usePlaybackControls() };
  return null;
};

type Kind = 'WaveformPlaylistProvider' | 'MediaElementPlaylistProvider';
const KINDS: Kind[] = ['WaveformPlaylistProvider', 'MediaElementPlaylistProvider'];

function mount(kind: Kind, store: AnnotationStore | undefined, extra?: React.ReactNode) {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  const playout = createFakePlayout();
  const tree = (current: AnnotationStore | undefined) =>
    kind === 'WaveformPlaylistProvider' ? (
      <TestProvider annotationStore={current}>
        <Probe />
        {extra}
      </TestProvider>
    ) : (
      <MediaElementPlaylistProvider
        track={{ source: 'test.mp3', name: 'Test', waveformData: WAVEFORM_DATA }}
        createPlayout={() => playout as unknown as MediaElementPlayout}
        annotationStore={current}
      >
        <Probe />
        {extra}
      </MediaElementPlaylistProvider>
    );
  const view = render(tree(store));
  return { swap: (next: AnnotationStore | undefined) => view.rerender(tree(next)) };
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe.each(KINDS)('%s with an annotationStore', (kind) => {
  it("publishes the store's annotations and follows its updates", () => {
    const store = createAnnotationStore([note('a')]);
    mount(kind, store);
    expect(probe.annotations).toBe(store.getAnnotations());
    act(() => {
      store.update((c) => [...c, note('b', 2, 3)]);
    });
    expect(ids(probe.annotations)).toEqual(['a', 'b']);
    expect(probe.annotations).toBe(store.getAnnotations());
  });

  it('two setAnnotations(fn) calls in one tick both land (#867)', () => {
    const store = createAnnotationStore([note('z0')]);
    mount(kind, store);
    act(() => {
      probe.controls.setAnnotations((c) => [...c, note('a', 1, 2)]);
      probe.controls.setAnnotations((c) => [...c, note('b', 2, 3)]);
    });
    expect(ids(store.getAnnotations())).toEqual(['z0', 'a', 'b']);
    expect(ids(probe.annotations)).toEqual(['z0', 'a', 'b']);
  });

  it('setAnnotations with an array replaces the list', () => {
    const store = createAnnotationStore([note('a')]);
    mount(kind, store);
    act(() => {
      probe.controls.setAnnotations([note('x')]);
    });
    expect(ids(store.getAnnotations())).toEqual(['x']);
  });

  it('usePlaybackControls().annotationStore is the prop', () => {
    const store = createAnnotationStore();
    mount(kind, store);
    expect(probe.controls.annotationStore).toBe(store);
  });

  it('an app reading through useDeferredValue loses no edit', async () => {
    const store = createAnnotationStore([note('z0')]);
    let deferred: readonly AnnotationData[] = [];
    const DeferredReader = () => {
      deferred = useDeferredValue(useStoredAnnotations(store));
      return null;
    };
    mount(kind, store, <DeferredReader />);
    act(() => {
      probe.controls.setAnnotations((c) => [...c, note('a', 1, 2)]);
    });
    act(() => {
      probe.controls.setAnnotations((c) => [...c, note('b', 2, 3)]);
    });
    await act(async () => {});
    expect(ids(store.getAnnotations())).toEqual(['z0', 'a', 'b']);
    expect(deferred).toBe(store.getAnnotations());
  });

  it("swapping the store shows the new one's annotations, and the old one is not followed", () => {
    const first = createAnnotationStore([note('a')]);
    const second = createAnnotationStore([note('x')]);
    const { swap } = mount(kind, first);
    swap(second);
    expect(ids(probe.annotations)).toEqual(['x']);
    expect(probe.controls.annotationStore).toBe(second);
    act(() => {
      first.update((c) => [...c, note('late', 5, 6)]);
    });
    expect(ids(probe.annotations)).toEqual(['x']);
  });
});

describe.each(KINDS)('%s without an annotationStore', (kind) => {
  it('usePlaybackControls().annotationStore is undefined', () => {
    mount(kind, undefined);
    expect(probe.controls.annotationStore).toBeUndefined();
    expect(probe.annotations).toEqual([]);
  });
});
