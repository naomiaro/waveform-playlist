// @vitest-environment jsdom
//
// Play does nothing before the first ready (#812, the maintainer's choice).
// Before this provider mount has first had an engine attached with no source
// pending, `play()` returns without doing anything and queues nothing; edits,
// the mixer and seeking keep working. After it, playback is as before, and a
// play during a later rebuild is queued as #675 says, pending sources or not.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../workers/peaksWorker', () => ({
  createPeaksWorker: vi.fn(() => ({
    generate: () => new Promise(() => {}),
    isTerminated: () => false,
    terminate: () => {},
  })),
}));

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import React from 'react';
import type { AnnotationData } from '@waveform-playlist/core';
import type { EffectsFunction } from '@waveform-playlist/playout';
import {
  useActiveAnnotation,
  useCurrentTime,
  useEditorControls,
  useEngineRefs,
  useIsPlaying,
  usePlaybackControls,
  usePlaylistMixer,
  usePlaylistTimeline,
  useSelection,
} from '../contexts/playlistContexts';
import { KeyboardShortcuts } from '../components/KeyboardShortcuts';
import {
  adapterFactory,
  renderWithArrangement,
  TestProvider,
  testArrangement,
  type RecordingAdapter,
} from './helpers/arrangementProvider';
import { clip, fakeBuffer, fakeLoads, flush, loading, track, RATE } from './helpers/engineHarness';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

interface Probe {
  timeline: ReturnType<typeof usePlaylistTimeline>;
  mixer: ReturnType<typeof usePlaylistMixer>;
  isPlaying: boolean;
  currentTime: number;
  selection: ReturnType<typeof useSelection>;
  activeAnnotationId: string | null;
  controls: ReturnType<typeof usePlaybackControls>;
  editor: ReturnType<typeof useEditorControls>;
  engineRefs: ReturnType<typeof useEngineRefs>;
}

let probe: Probe;

const ProbeChild: React.FC = () => {
  probe = {
    timeline: usePlaylistTimeline(),
    mixer: usePlaylistMixer(),
    isPlaying: useIsPlaying().isPlaying,
    currentTime: useCurrentTime().currentTime,
    selection: useSelection(),
    activeAnnotationId: useActiveAnnotation().activeAnnotationId,
    controls: usePlaybackControls(),
    editor: useEditorControls(),
    engineRefs: useEngineRefs(),
  };
  return null;
};

const CHILDREN = (
  <>
    <ProbeChild />
    <KeyboardShortcuts playback />
  </>
);

const effectsA: EffectsFunction = () => undefined;
const effectsB: EffectsFunction = () => undefined;

const ANNOTATION: AnnotationData = { id: 'n1', start: 1, end: 2, lines: ['one'] };

const settle = (ms = 40) =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, ms));
  });

/** The engine is attached and a first source is still pending: before the first ready. */
async function attachedWhilePending(adapters: RecordingAdapter[]) {
  await waitFor(() => expect(adapters[0]?.count('setTracks')).toBe(1));
  await act(flush);
  expect(probe.timeline.isReady).toBe(false);
}

async function ready() {
  await waitFor(() => expect(probe.timeline.isReady).toBe(true));
}

/** The warnings that say Play waits for ready. */
function playBeforeReadyWarnings(): string[] {
  return vi
    .mocked(console.warn)
    .mock.calls.map((args) => String(args[0]))
    .filter((message) => message.includes('playback starts once the playlist is ready'));
}

async function pressSpace() {
  await act(async () => {
    fireEvent.keyDown(document.body, { key: ' ' });
  });
  await settle();
}

/** A loaded track A and a track B whose one clip loads until the test settles it. */
function withPendingSource() {
  const loads = fakeLoads();
  const view = renderWithArrangement(
    [track('A', [clip('a1', 0, 4)]), track('B', [loading('LB', { duration: 2 })])],
    { children: CHILDREN, loadSource: loads.loadSource, indefinitePlayback: true }
  );
  return { loads, view };
}

beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('Play before the first ready (#812)', () => {
  it('play() before the first ready does nothing: no adapter play, `isPlaying` stays false, nothing is queued, and the same call after ready plays', async () => {
    const { loads, view } = withPendingSource();
    await attachedWhilePending(view.adapters);
    const adapter = view.factory.latest();

    let result: unknown = 'not settled';
    await act(async () => {
      result = await probe.controls.play(1, 2);
    });
    await act(async () => {
      await probe.controls.play(1, 2);
    });
    expect(result).toBeUndefined();
    expect(adapter.count('play')).toBe(0);
    expect(adapter.count('init')).toBe(0);
    expect(probe.isPlaying).toBe(false);
    // No time ref written.
    expect(probe.currentTime).toBe(0);
    expect(probe.engineRefs.audioStartPositionRef.current).toBe(0);
    // One warning for the mount, however many presses.
    expect(playBeforeReadyWarnings()).toHaveLength(1);
    expect(playBeforeReadyWarnings()[0]).toMatch(/^\[waveform-playlist\] /);
    expect(playBeforeReadyWarnings()[0]).toContain('isReady');
    expect(playBeforeReadyWarnings()[0]).toContain('onReady');

    await act(async () => {
      loads.calls[0].resolve(fakeBuffer(2));
      await flush();
    });
    await ready();
    // Nothing was queued: ready starts nothing.
    await settle();
    expect(adapter.count('play')).toBe(0);
    // Nor did the ignored play set where a Stop returns the cursor.
    act(() => probe.controls.stop());
    expect(probe.currentTime).toBe(0);

    await act(async () => {
      await probe.controls.play(1, 2);
    });
    expect(adapter.count('play')).toBe(1);
    expect(probe.isPlaying).toBe(true);
    expect(probe.engineRefs.audioStartPositionRef.current).toBe(1);
    expect(view.adapters).toHaveLength(1);
    expect(playBeforeReadyWarnings()).toHaveLength(1);
  });

  it('in a production build an ignored play warns nothing and still does nothing', async () => {
    // As the test of `warnOnce` does (waveformPublicParts.test.tsx).
    const before = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';
    try {
      const { view } = withPendingSource();
      await attachedWhilePending(view.adapters);
      await act(async () => {
        await probe.controls.play(1, 2);
      });
      act(() => probe.controls.playAnnotation(ANNOTATION));
      await settle();
      expect(view.factory.latest().count('play')).toBe(0);
      expect(probe.isPlaying).toBe(false);
      expect(probe.activeAnnotationId).toBeNull();
      expect(playBeforeReadyWarnings()).toHaveLength(0);
    } finally {
      process.env.NODE_ENV = before;
    }
  });

  it('a Play pressed before ready does NOT start by itself when ready arrives', async () => {
    const { loads, view } = withPendingSource();
    // While the first engine is still being built: the path that would queue.
    act(() => {
      void probe.controls.play(0);
    });
    await attachedWhilePending(view.adapters);
    // And again with the engine attached and the source pending.
    await act(async () => {
      await probe.controls.play(0);
    });

    await act(async () => {
      loads.calls[0].resolve(fakeBuffer(2));
      await flush();
    });
    await ready();
    await settle();
    expect(view.factory.latest().count('play')).toBe(0);
    expect(probe.isPlaying).toBe(false);
  });

  it('an empty arrangement is ready when its engine is attached and plays', async () => {
    const view = renderWithArrangement([], { children: CHILDREN, indefinitePlayback: true });
    await ready();
    await act(async () => {
      await probe.controls.play(0);
    });
    expect(view.factory.latest().count('play')).toBe(1);
    expect(probe.isPlaying).toBe(true);
    expect(playBeforeReadyWarnings()).toHaveLength(0);
  });

  it('a failed first source counts as settled: Play works after it', async () => {
    const { loads, view } = withPendingSource();
    await attachedWhilePending(view.adapters);
    await act(async () => {
      loads.calls[0].reject(new Error('404'));
      await flush();
    });
    await ready();
    await act(async () => {
      await probe.controls.play(0);
    });
    expect(view.factory.latest().count('play')).toBe(1);
    expect(probe.isPlaying).toBe(true);
  });

  it('after the first ready, play() during a later rebuild with a pending source is queued and starts on the new engine', async () => {
    const loads = fakeLoads();
    const view = renderWithArrangement([track('A', [clip('a1', 0, 4)])], {
      children: CHILDREN,
      loadSource: loads.loadSource,
      effects: effectsA,
      indefinitePlayback: true,
    });
    await ready();
    // A file is added and stays pending through the rebuild.
    await act(async () => {
      view.arrangement.addTrack(track('B', [loading('LB')]));
      await flush();
    });
    const gate = view.factory.holdNext();
    act(() => view.update({ effects: effectsB }));
    expect(view.adapters[0].disposed).toBe(true);
    expect(probe.timeline.isReady).toBe(false);

    await act(async () => {
      await probe.controls.play(1);
    });
    expect(probe.isPlaying).toBe(false);

    await act(async () => {
      gate.open();
      await flush();
    });
    await settle();
    expect(view.arrangement.sources.getSnapshot().pendingCount).toBe(1);
    const rebuilt = view.factory.latest();
    expect(view.adapters).toHaveLength(2);
    expect(rebuilt.count('play')).toBe(1);
    expect(probe.isPlaying).toBe(true);
    expect(playBeforeReadyWarnings()).toHaveLength(0);
  });

  it('`playAnnotation` and the Space shortcut before the first ready do nothing', async () => {
    const { loads, view } = withPendingSource();
    await attachedWhilePending(view.adapters);
    const adapter = view.factory.latest();

    act(() => probe.controls.playAnnotation(ANNOTATION));
    await settle();
    await pressSpace();
    expect(adapter.count('play')).toBe(0);
    expect(probe.isPlaying).toBe(false);
    expect(probe.activeAnnotationId).toBeNull();
    expect(probe.currentTime).toBe(0);

    // The control: after ready the same key plays.
    await act(async () => {
      loads.calls[0].resolve(fakeBuffer(2));
      await flush();
    });
    await ready();
    await pressSpace();
    expect(adapter.count('play')).toBe(1);
    expect(probe.isPlaying).toBe(true);
  });

  it('edits, mixer changes and `seekTo` before the first ready are applied', async () => {
    const { view } = withPendingSource();
    await attachedWhilePending(view.adapters);
    const adapter = view.factory.latest();

    act(() => probe.controls.seekTo(2));
    expect(probe.currentTime).toBe(2);
    act(() => probe.editor.setCurrentTime(3));
    expect(probe.currentTime).toBe(3);
    act(() => probe.controls.setSelection(1, 1.5));
    expect(probe.selection).toEqual({ selectionStart: 1, selectionEnd: 1.5 });
    expect(probe.currentTime).toBe(1);

    act(() => probe.editor.setTrackVolume('A', 0.25));
    expect(probe.mixer.trackStates[0].volume).toBe(0.25);
    expect(adapter.count('setTrackVolume')).toBeGreaterThan(0);

    act(() => {
      view.arrangement.moveClip('A', 'a1', RATE);
    });
    expect(probe.timeline.tracks[0].clips[0].startSample).toBe(RATE);
    act(() => probe.editor.undo());
    expect(probe.timeline.tracks[0].clips[0].startSample).toBe(0);
    act(() => probe.editor.redo());
    expect(probe.timeline.tracks[0].clips[0].startSample).toBe(RATE);

    expect(adapter.count('play')).toBe(0);
    expect(probe.timeline.isReady).toBe(false);
  });

  it('what the warning says to do works: a play from `onReady`, and from a child effect when `isReady` turns true', async () => {
    let playsFromChild = 0;
    const PlayWhenReady: React.FC = () => {
      const { isReady } = usePlaylistTimeline();
      const { play } = usePlaybackControls();
      React.useEffect(() => {
        if (!isReady) return;
        playsFromChild += 1;
        void play(0);
      }, [isReady, play]);
      return null;
    };
    const fromChild = renderWithArrangement([track('A', [clip('a1', 0, 4)])], {
      children: (
        <>
          <ProbeChild />
          <PlayWhenReady />
        </>
      ),
      indefinitePlayback: true,
    });
    await ready();
    await settle();
    expect(playsFromChild).toBe(1);
    expect(fromChild.factory.latest().count('play')).toBe(1);
    await act(async () => {
      cleanup();
    });

    const fromOnReady = renderWithArrangement([track('A', [clip('a1', 0, 4)])], {
      children: CHILDREN,
      indefinitePlayback: true,
      onReady: () => void probe.controls.play(0),
    });
    await ready();
    await settle();
    expect(fromOnReady.factory.latest().count('play')).toBe(1);
    expect(probe.isPlaying).toBe(true);
    expect(playBeforeReadyWarnings()).toHaveLength(0);
  });

  it('a child that calls play() from a layout effect on the first isReady plays', async () => {
    let playsFromLayout = 0;
    const PlayWhenReadyInLayout: React.FC = () => {
      const { isReady } = usePlaylistTimeline();
      const { play } = usePlaybackControls();
      React.useLayoutEffect(() => {
        if (!isReady) return;
        playsFromLayout += 1;
        void play(0);
      }, [isReady, play]);
      return null;
    };
    const view = renderWithArrangement([track('A', [clip('a1', 0, 4)])], {
      children: (
        <>
          <ProbeChild />
          <PlayWhenReadyInLayout />
        </>
      ),
      indefinitePlayback: true,
    });
    await ready();
    await settle();
    expect(playsFromLayout).toBe(1);
    expect(view.factory.latest().count('play')).toBe(1);
    expect(probe.isPlaying).toBe(true);
    expect(playBeforeReadyWarnings()).toHaveLength(0);
  });

  it('an <Activity> hide and reveal during the first load does not make it ready: Play still does nothing until the source settles (a check)', async () => {
    const loads = fakeLoads();
    const arrangement = testArrangement(
      [track('A', [clip('a1', 0, 4)]), track('B', [loading('LB')])],
      { loadSource: loads.loadSource }
    );
    const factory = adapterFactory();
    const ui = (mode: 'visible' | 'hidden') => (
      <React.Activity mode={mode}>
        <TestProvider
          arrangement={arrangement}
          sampleRate={RATE}
          createAdapter={factory.createAdapter}
          indefinitePlayback
        >
          <ProbeChild />
        </TestProvider>
      </React.Activity>
    );
    const view = render(ui('visible'));
    await attachedWhilePending(factory.adapters);
    view.rerender(ui('hidden'));
    await act(flush);
    view.rerender(ui('visible'));
    await act(flush);
    await waitFor(() => expect(factory.adapters).toHaveLength(2));
    await act(flush);
    expect(probe.timeline.isReady).toBe(false);

    await act(async () => {
      await probe.controls.play(0);
    });
    expect(factory.latest().count('play')).toBe(0);
    expect(probe.isPlaying).toBe(false);

    // The hide may have cancelled the first load and the reveal asked again.
    await act(async () => {
      loads.calls.forEach((call) => call.resolve(fakeBuffer(1)));
      await flush();
    });
    await ready();
    await act(async () => {
      await probe.controls.play(0);
    });
    expect(factory.latest().count('play')).toBe(1);
    expect(probe.isPlaying).toBe(true);
  });
});
