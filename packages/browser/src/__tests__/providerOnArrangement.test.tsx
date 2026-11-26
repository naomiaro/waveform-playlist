// @vitest-environment jsdom
//
// `WaveformPlaylistProvider` on an arrangement (#812). The arrangement owns the
// tracks, the mix, the undo history and the loading; the provider builds and
// disposes engines around it and derives what it publishes. No app wiring is
// needed for an edit to land, a track edit builds no engine, and nothing in
// the library writes the tracks back from a listener.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../workers/peaksWorker', () => ({
  createPeaksWorker: vi.fn(() => ({
    generate: () => new Promise(() => {}),
    isTerminated: () => false,
    terminate: () => {},
  })),
}));

const exportCalls = vi.hoisted(() => [] as unknown[][]);
vi.mock('../hooks/useExportWav', () => ({
  useExportWav: () => ({
    exportWav: (...args: unknown[]) => {
      exportCalls.push(args);
      return Promise.resolve({ blob: new Blob(), audioBuffer: {}, duration: 0 });
    },
    isExporting: false,
    progress: 0,
    error: null,
  }),
}));

import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import React, { useEffect } from 'react';
import type { ArrangementTrack, AudioClip } from '@waveform-playlist/core';
import { clipPixelWidth, isLoadingClip } from '@waveform-playlist/core';
import type { EffectsFunction } from '@waveform-playlist/playout';
import type { Arrangement } from '@waveform-playlist/engine';
import {
  useArrangement,
  useCurrentTime,
  useEditorControls,
  useEngineRefs,
  useIsPlaying,
  usePlaybackControls,
  usePlaylistMixer,
  usePlaylistTimeline,
  usePlaylistZoom,
} from '../contexts/playlistContexts';
import { useClipDragHandlers } from '../hooks/useClipDragHandlers';
import { useClipSplitting } from '../hooks/useClipSplitting';
import { ExportWavButton } from '../components/ExportControls';
import { Waveform } from '../components/Waveform';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { renderWithArrangement, testArrangement } from './helpers/arrangementProvider';
import { clip, fakeBuffer, fakeLoads, flush, loading, track, RATE } from './helpers/engineHarness';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLES_PER_PIXEL = 1024;

type DragHandlers = ReturnType<typeof useClipDragHandlers>;

interface Probe {
  timeline: ReturnType<typeof usePlaylistTimeline>;
  mixer: ReturnType<typeof usePlaylistMixer>;
  isPlaying: boolean;
  currentTime: number;
  controls: ReturnType<typeof usePlaybackControls>;
  editor: ReturnType<typeof useEditorControls>;
  drag: DragHandlers;
  split: ReturnType<typeof useClipSplitting>;
  arrangement: ReturnType<typeof useArrangement>;
  engineRefs: ReturnType<typeof useEngineRefs>;
  zoom: ReturnType<typeof usePlaylistZoom>;
}

let probe: Probe;
const renders = { timeline: 0, mixer: 0 };

const ProbeChild: React.FC = () => {
  probe = {
    timeline: usePlaylistTimeline(),
    mixer: usePlaylistMixer(),
    isPlaying: useIsPlaying().isPlaying,
    currentTime: useCurrentTime().currentTime,
    controls: usePlaybackControls(),
    editor: useEditorControls(),
    drag: useClipDragHandlers({ samplesPerPixel: SAMPLES_PER_PIXEL }),
    split: useClipSplitting({ samplesPerPixel: SAMPLES_PER_PIXEL }),
    arrangement: useArrangement(),
    engineRefs: useEngineRefs(),
    zoom: usePlaylistZoom(),
  };
  return null;
};

const TimelineReader: React.FC = () => {
  usePlaylistTimeline();
  renders.timeline += 1;
  return null;
};
const MixerReader: React.FC = () => {
  usePlaylistMixer();
  renders.mixer += 1;
  return null;
};

const CHILDREN = (
  <>
    <ProbeChild />
    <TimelineReader />
    <MixerReader />
  </>
);

/** dnd-kit's source data for a clip move or a trim (see `Clip` in ui-components). */
function dragEvent(data: Record<string, unknown>, x = 0, canceled = false) {
  return {
    canceled,
    to: { x, y: 0 },
    operation: {
      source: { data },
      transform: { x, y: 0 },
      position: { initial: { x: 0, y: 0 }, current: { x, y: 0 } },
    },
  } as never;
}

function moveClipByDrag(trackIndex: number, clipId: string, pixels: number) {
  const data = { clipId, trackIndex, clipIndex: 0 };
  probe.drag.onDragStart(dragEvent(data));
  probe.drag.onDragEnd(dragEvent(data, pixels));
}

const ONE_SECOND_PX = RATE / SAMPLES_PER_PIXEL;

function startOf(trackIndex: number, clipId: string): number | undefined {
  return probe.timeline.tracks[trackIndex].clips.find((c) => c.id === clipId)?.startSample;
}

async function ready() {
  await waitFor(() => expect(probe.timeline.isReady).toBe(true));
}

/** An engine is attached; not ready while a first source is pending (QE). */
async function engineAttached(view: { adapters: Array<{ count(method: string): number }> }) {
  await waitFor(() => expect(view.adapters[0]?.count('setTracks')).toBe(1));
  await act(flush);
  expect(probe.timeline.isReady).toBe(false);
}

/** The arrangement's writing methods. */
const WRITES = [
  'setTracks',
  'addTrack',
  'removeTrack',
  'updateTrack',
  'reorderTrack',
  'moveClip',
  'trimClip',
  'splitClip',
  'undo',
  'redo',
  'setTrackVolume',
  'setTrackMute',
  'setTrackSolo',
  'setTrackPan',
  'clearHistory',
  'beginTransaction',
  'commitTransaction',
  'abortTransaction',
] as const;

/** Spies on every write; each call of the result gives the writes since the last one. */
function spyOnWrites(arrangement: Arrangement): () => Record<string, number> {
  const spies = WRITES.map((method) => [method, vi.spyOn(arrangement, method)] as const);
  const seen = new Map<string, number>();
  return () => {
    const since: Record<string, number> = {};
    for (const [method, spy] of spies) {
      const total = spy.mock.calls.length;
      const count = total - (seen.get(method) ?? 0);
      if (count > 0) since[method] = count;
      seen.set(method, total);
    }
    return since;
  };
}

const effectsA: EffectsFunction = () => undefined;
const effectsB: EffectsFunction = () => undefined;
const effectsC: EffectsFunction = () => undefined;

beforeEach(() => {
  renders.timeline = 0;
  renders.mixer = 0;
  exportCalls.length = 0;
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // jsdom has no canvas: without this every drawn channel logs "Not implemented".
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('WaveformPlaylistProvider on an arrangement (#812)', () => {
  it('a clip move needs no app wiring: the view shows the moved clip and the adapter got one `updateTrack`', async () => {
    const view = renderWithArrangement([track('A', [clip('a1', 0, 1)])], { children: CHILDREN });
    await ready();
    const adapter = view.factory.latest();
    expect(adapter.count('updateTrack')).toBe(0);

    act(() => moveClipByDrag(0, 'a1', ONE_SECOND_PX));

    expect(startOf(0, 'a1')).toBe(RATE);
    expect(adapter.count('updateTrack')).toBe(1);
    expect(view.adapters).toHaveLength(1);
  });

  it('a move dropped after the tracks were reordered mid-drag moves the clip on its own track', async () => {
    const view = renderWithArrangement(
      [track('A', [clip('a1', 0, 1)]), track('B', [clip('b1', 0, 1)])],
      { children: CHILDREN }
    );
    await ready();
    const data = { clipId: 'a1', trackIndex: 0, clipIndex: 0 };
    act(() => probe.drag.onDragStart(dragEvent(data)));
    // The drag began on row 0 (A); a reorder puts B there before the drop.
    act(() => view.arrangement.reorderTrack('A', 1));
    act(() => probe.drag.onDragEnd(dragEvent(data, ONE_SECOND_PX)));

    expect(probe.timeline.tracks.map((t) => t.id)).toEqual(['B', 'A']);
    expect(startOf(1, 'a1')).toBe(RATE);
    expect(startOf(0, 'b1')).toBe(0);
  });

  it('a move whose drop names another clip moves the clip picked up at drag start', async () => {
    const view = renderWithArrangement([track('A', [clip('a1', 0, 1), clip('a2', 2, 1)])], {
      children: CHILDREN,
    });
    await ready();
    const moveClip = vi.spyOn(view.arrangement, 'moveClip');
    act(() => probe.drag.onDragStart(dragEvent({ clipId: 'a2', trackIndex: 0, clipIndex: 1 })));
    // The drop's data is another clip's: what a draggable id that changed
    // hands over when the row shifted under the drag.
    act(() =>
      probe.drag.onDragEnd(dragEvent({ clipId: 'a1', trackIndex: 0, clipIndex: 1 }, ONE_SECOND_PX))
    );

    expect(moveClip).toHaveBeenCalledTimes(1);
    expect(moveClip.mock.calls[0].slice(0, 2)).toEqual(['A', 'a2']);
    expect(startOf(0, 'a1')).toBe(0);
    expect(startOf(0, 'a2')).toBe(3 * RATE);
  });

  it('removing a track during playback makes one `adapter.removeTrack`, builds no engine and keeps `isPlaying` (#798)', async () => {
    const view = renderWithArrangement(
      [track('A', [clip('a1', 0, 4)]), track('B', [clip('b1', 0, 4)])],
      { children: CHILDREN, indefinitePlayback: true }
    );
    await ready();
    await act(async () => {
      await probe.controls.play(0);
    });
    expect(probe.isPlaying).toBe(true);
    const adapter = view.factory.latest();

    await act(async () => {
      view.arrangement.removeTrack('B');
      await flush();
    });

    expect(adapter.count('removeTrack')).toBe(1);
    expect(adapter.count('setTracks')).toBe(1);
    expect(view.adapters).toHaveLength(1);
    expect(adapter.disposed).toBe(false);
    expect(probe.isPlaying).toBe(true);
    expect(probe.timeline.tracks.map((t) => t.id)).toEqual(['A']);
  });

  it('a file added while playing: the row appears with its placeholder, playback continues, the clip is applied on arrival', async () => {
    const loads = fakeLoads();
    const view = renderWithArrangement([track('A', [clip('a1', 0, 4)])], {
      children: CHILDREN,
      indefinitePlayback: true,
      loadSource: loads.loadSource,
    });
    await ready();
    await act(async () => {
      await probe.controls.play(0);
    });
    const adapter = view.factory.latest();

    await act(async () => {
      view.arrangement.addTrack(track('C', [loading('LC', { start: 1, duration: 2 })]));
      await flush();
    });
    expect(probe.timeline.tracks.map((t) => t.id)).toEqual(['A', 'C']);
    expect(probe.timeline.tracks[1].clips).toHaveLength(0);
    expect(probe.timeline.peaksDataArray[1].map((r) => [r.clipId, r.isPlaceholder])).toEqual([
      ['LC', true],
    ]);
    expect(probe.isPlaying).toBe(true);
    expect(loads.calls).toHaveLength(1);

    await act(async () => {
      loads.calls[0].resolve(fakeBuffer(4));
      await flush();
    });
    expect(probe.timeline.tracks[1].clips.map((c) => c.id)).toEqual(['LC']);
    expect(probe.timeline.peaksDataArray[1].some((r) => r.isPlaceholder)).toBe(false);
    expect(adapter.count('addTrack')).toBe(1);
    expect(adapter.count('updateTrack')).toBe(1);
    expect(adapter.count('setTracks')).toBe(1);
    expect(view.adapters).toHaveLength(1);
    expect(probe.isPlaying).toBe(true);
  });

  it('edits and undo work while no engine is attached (during a rebuild) and the new engine plays the result', async () => {
    const view = renderWithArrangement([track('A', [clip('a1', 0, 1)])], {
      children: CHILDREN,
      effects: effectsA,
    });
    await ready();
    const gate = view.factory.holdNext();
    act(() => view.update({ effects: effectsB }));
    expect(view.adapters[0].disposed).toBe(true);
    expect(probe.timeline.isReady).toBe(false);

    act(() => moveClipByDrag(0, 'a1', ONE_SECOND_PX));
    act(() => moveClipByDrag(0, 'a1', ONE_SECOND_PX));
    act(() => probe.editor.setTrackVolume('A', 0.25));
    // Rule (#843): the volume change is an undo step of its own, so the first
    // undo takes it back and the second the last move. Before, one undo took
    // back the last move and the volume stayed at 0.25 (also in the rebuilt
    // adapter's setTracks).
    act(() => probe.editor.undo());
    expect(startOf(0, 'a1')).toBe(2 * RATE);
    expect(probe.mixer.trackStates[0].volume).toBe(1);
    act(() => probe.editor.redo());
    expect(probe.mixer.trackStates[0].volume).toBe(0.25);
    act(() => probe.editor.undo());
    act(() => probe.editor.undo());
    expect(startOf(0, 'a1')).toBe(RATE);
    expect(probe.mixer.trackStates[0].volume).toBe(1);

    await act(async () => {
      gate.open();
      await flush();
    });
    await ready();
    const rebuilt = view.factory.latest();
    expect(view.adapters).toHaveLength(2);
    const sent = rebuilt.calls.find((call) => call.method === 'setTracks')?.args[0] as
      | ArrangementTrack[]
      | undefined;
    expect((sent?.[0].clips[0] as AudioClip).startSample).toBe(RATE);
    expect(sent?.[0].volume).toBe(1);

    await act(async () => {
      await probe.controls.play(0);
    });
    expect(rebuilt.count('play')).toBe(1);
    expect(probe.isPlaying).toBe(true);
  });

  it('a fader step renders what it renders today', async () => {
    renderWithArrangement([track('A', [clip('a1', 0, 1)])], { children: CHILDREN });
    await ready();
    const before = { ...renders };
    act(() => probe.editor.setTrackVolume('A', 0.5));
    expect(renders.mixer - before.mixer).toBe(1);
    expect(renders.timeline - before.timeline).toBe(0);
    expect(probe.mixer.trackStates[0].volume).toBe(0.5);
  });

  it('no library subscriber makes a track edit: across load, arrival, drag, split, undo and a recorded take, the arrangement gets exactly the writes each step asks for, and the adapter no `setTracks` after its initial one', async () => {
    const loads = fakeLoads();
    const arrangement = testArrangement(
      [track('A', [clip('a1', 0, 4)]), track('B', [loading('LB', { duration: 2 })])],
      { loadSource: loads.loadSource }
    );
    const writes = spyOnWrites(arrangement);
    const view = renderWithArrangement([], { arrangement, children: CHILDREN });

    // Load: the engine is built and attached; nothing writes.
    await act(flush);
    const adapter = view.factory.latest();
    expect(adapter.count('setTracks')).toBe(1);
    expect(writes()).toEqual({});

    // Arrival: the arrangement switches the clip itself; nothing writes.
    await act(async () => {
      loads.calls[0].resolve(fakeBuffer(2));
      await flush();
    });
    await ready();
    expect(writes()).toEqual({});

    // A drag: the drop's one move.
    act(() => moveClipByDrag(0, 'a1', ONE_SECOND_PX));
    expect(writes()).toEqual({ moveClip: 1 });

    // A split: one split.
    act(() => {
      probe.split.splitClipAt('A', 'a1', 2);
    });
    expect(writes()).toEqual({ splitClip: 1 });

    // An undo: one undo.
    act(() => probe.editor.undo());
    expect(writes()).toEqual({ undo: 1 });

    // A recorded take, as useIntegratedRecording will put it: the test's one update.
    act(() =>
      arrangement.updateTrack('B', (current) => ({
        ...current,
        clips: [...current.clips, clip('take', 3, 1)],
      }))
    );
    await act(flush);
    expect(writes()).toEqual({ updateTrack: 1 });

    expect(probe.timeline.tracks[1].clips.map((c) => c.id)).toEqual(['LB', 'take']);
    expect(adapter.count('setTracks')).toBe(1);
    expect(view.adapters).toHaveLength(1);
  });

  it('the `arrangement` prop given a new object remounts the tree and warns once', async () => {
    let mounts = 0;
    const Mounts: React.FC = () => {
      useEffect(() => {
        mounts += 1;
      }, []);
      return null;
    };
    const children = (
      <>
        <ProbeChild />
        <Mounts />
      </>
    );
    const view = renderWithArrangement([track('A', [clip('a1', 0, 1)])], { children });
    await ready();
    expect(mounts).toBe(1);
    const warn = vi.mocked(console.warn);
    const identityWarnings = () =>
      warn.mock.calls.filter((args) => String(args[0]).includes('`arrangement` prop')).length;
    // Not on mount, and not for a re-render with the same arrangement.
    act(() => view.update({}));
    expect(identityWarnings()).toBe(0);

    act(() => view.update({ arrangement: testArrangement([track('B', [clip('b1', 0, 1)])]) }));
    await ready();
    expect(mounts).toBe(2);
    expect(probe.timeline.tracks.map((t) => t.id)).toEqual(['B']);
    expect(identityWarnings()).toBe(1);

    act(() => view.update({ arrangement: testArrangement([track('C', [clip('c1', 0, 1)])]) }));
    await ready();
    expect(mounts).toBe(3);
    expect(identityWarnings()).toBe(1);

    // The same object again is not a change.
    act(() => view.update({}));
    expect(mounts).toBe(3);
  });

  it('a provider with no arrangement throws an error that names the prop', () => {
    // console.error is silenced for every test of this file (beforeEach): React
    // logs the error the boundary catches.
    let caught: unknown;
    class Boundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
      state = { failed: false };
      static getDerivedStateFromError() {
        return { failed: true };
      }
      componentDidCatch(error: unknown) {
        caught = error;
      }
      render() {
        return this.state.failed ? null : this.props.children;
      }
    }
    const message = (arrangement: unknown) => {
      caught = undefined;
      render(
        <Boundary>
          <WaveformPlaylistProvider arrangement={arrangement as Arrangement}>
            <ProbeChild />
          </WaveformPlaylistProvider>
        </Boundary>
      );
      cleanup();
      expect(caught).toBeInstanceOf(Error);
      return (caught as Error).message;
    };
    for (const missing of [undefined, null, 'tracks']) {
      const text = message(missing);
      expect(text).toMatch(/^\[waveform-playlist\] WaveformPlaylistProvider /);
      expect(text).toContain('`arrangement`');
      expect(text).toContain('useCreateArrangement');
      expect(text).toContain('`tracks` and `onTracksChange`');
      expect(text).toContain('https://naomiaro.github.io/waveform-playlist/docs/react/upgrading');
    }
    // A real arrangement is untouched.
    caught = undefined;
    renderWithArrangement([], { children: <ProbeChild />, wrapper: Boundary });
    expect(caught).toBeUndefined();
    expect(probe.timeline.tracks).toEqual([]);
  });

  it('`usePlaylistTimeline().tracks` never holds a loading clip; the row of `peaksDataArray[i]` has more records than `tracks[i].clips` while one loads', async () => {
    const view = renderWithArrangement(
      [track('A', [clip('a1', 0, 1), loading('LA', { start: 2 })])],
      {
        children: CHILDREN,
      }
    );
    await engineAttached(view);
    const { tracks, peaksDataArray } = probe.timeline;
    expect(tracks[0].clips.some((c) => isLoadingClip(c))).toBe(false);
    expect(tracks[0].clips.map((c) => c.id)).toEqual(['a1']);
    expect(peaksDataArray[0].map((r) => r.clipId)).toEqual(['a1', 'LA']);
    expect(peaksDataArray[0].length).toBeGreaterThan(tracks[0].clips.length);
  });

  it('a click on a placeholder beyond the loaded audio puts the cursor where the click was; the view covers the placeholder; Play from there stops at `duration`', async () => {
    const view = renderWithArrangement([track('A', [clip('a1', 0, 1)])], {
      children: (
        <>
          <ProbeChild />
          <Waveform />
        </>
      ),
    });
    // Play does nothing before the first ready, so the placeholder comes from
    // a file added after it (its source never settles here).
    await ready();
    await act(async () => {
      view.arrangement.addTrack(track('B', [loading('LB', { start: 5, duration: 3 })]));
      await flush();
    });
    expect(view.arrangement.sources.getSnapshot().pendingCount).toBe(1);
    expect(probe.timeline.duration).toBe(1);

    // The timeline is drawn to the end of the placeholder (8 s), not 1 s.
    const scroll = view.container.querySelector('[data-scroll-container]') as HTMLElement;
    const sized = [...scroll.querySelectorAll<HTMLElement>('*')].find((el) => el.style.width);
    const widthPx = parseFloat(sized?.style.width ?? '0');
    expect(widthPx).toBeGreaterThanOrEqual((8 * RATE) / SAMPLES_PER_PIXEL - 1);

    const overlay = clickOverlay();
    const rect = { left: 0, top: 0, right: widthPx, bottom: 200, width: widthPx, height: 200 };
    overlay.getBoundingClientRect = () => ({ ...rect, x: 0, y: 0, toJSON: () => rect });
    const clickX = Math.round(6 * ONE_SECOND_PX);
    await act(async () => {
      fireEvent.mouseDown(overlay, { button: 0, clientX: clickX, clientY: 100 });
    });
    await act(async () => {
      fireEvent.mouseUp(window, { button: 0, clientX: clickX, clientY: 100 });
    });
    const clickTime = (clickX * SAMPLES_PER_PIXEL) / RATE;
    expect(probe.currentTime).toBeCloseTo(clickTime, 6);

    await act(async () => {
      await probe.controls.play();
    });
    // The play did start (from the click), then stopped at the loaded audio's end.
    expect(view.factory.latest().count('play')).toBe(1);
    await waitFor(() => expect(probe.isPlaying).toBe(false));
    expect(probe.currentTime).toBeCloseTo(clickTime, 6);
  });

  it('under <Waveform /> (no clip headers) a loading clip with a `duration` and no peaks draws its body, as wide as the clip', async () => {
    const view = renderWithArrangement(
      [track('A', [clip('a1', 0, 1)]), track('B', [loading('LB', { start: 1, duration: 2 })])],
      {
        children: (
          <>
            <ProbeChild />
            <Waveform />
          </>
        ),
      }
    );
    await engineAttached(view);
    const containers = [...view.container.querySelectorAll<HTMLElement>('[data-clip-container]')];
    const placeholder = containers.find((el) => el.hasAttribute('data-clip-placeholder'));
    const loadedClip = containers.find((el) => !el.hasAttribute('data-clip-placeholder'));
    expect(placeholder).toBeDefined();
    expect(loadedClip).toBeDefined();
    // No header: the body is the clip's only drawing, and fills its channel area.
    expect(placeholder!.textContent).toBe('');
    expect(placeholder!.querySelectorAll('[data-clip-placeholder-body]')).toHaveLength(1);
    const spp = probe.zoom.samplesPerPixel;
    expect(placeholder!.style.width).toBe(`${clipPixelWidth(RATE, 2 * RATE, spp)}px`);
    expect(loadedClip!.querySelector('[data-clip-placeholder-body]')).toBeNull();
  });

  it('export while a clip loads renders the loaded clips only', async () => {
    const view = renderWithArrangement(
      [track('A', [clip('a1', 0, 1), loading('LA', { start: 2 })]), track('B', [loading('LB')])],
      {
        children: (
          <>
            <ProbeChild />
            <ExportWavButton label="Export" />
          </>
        ),
      }
    );
    await engineAttached(view);
    const button = document.querySelector('button') as HTMLButtonElement;
    await act(async () => {
      fireEvent.click(button);
    });
    expect(exportCalls).toHaveLength(1);
    const [tracks, trackStates] = exportCalls[0] as [ArrangementTrack[], unknown[]];
    expect(tracks.map((t) => t.clips.map((c) => c.id))).toEqual([['a1'], []]);
    expect(tracks.some((t) => t.clips.some((c) => isLoadingClip(c)))).toBe(false);
    expect(trackStates).toHaveLength(2);
  });

  it("the 'clip has no audio data' warning is not written for a loading clip", async () => {
    const view = renderWithArrangement(
      [track('A', [clip('a1', 0, 1)]), track('B', [loading('LB')])],
      {
        children: CHILDREN,
      }
    );
    await engineAttached(view);
    const messages = vi.mocked(console.warn).mock.calls.map((args) => String(args[0]));
    const noData = messages.filter((m) => m.includes('has no audio data'));
    // The control: a loaded clip with nothing to draw from is reported.
    expect(noData.some((m) => m.includes('"a1"'))).toBe(true);
    expect(noData.some((m) => m.includes('"LB"'))).toBe(false);
  });

  it('a rebuild gives the new engine what the old one held: selection, loop, master volume, selected track', async () => {
    const view = renderWithArrangement(
      [track('A', [clip('a1', 0, 4)]), track('B', [clip('b1', 0, 4)])],
      { children: CHILDREN, effects: effectsA }
    );
    await ready();
    act(() => {
      probe.controls.setSelection(1, 2);
      probe.editor.setLoopRegion(0.5, 3);
      probe.editor.setLoopEnabled(true);
      probe.editor.setMasterVolume(0.4);
      probe.editor.setSelectedTrackId('B');
    });

    act(() => view.update({ effects: effectsB }));
    await ready();

    expect(view.adapters).toHaveLength(2);
    const state = probe.engineRefs.playoutRef.current!.getState();
    expect(state).toMatchObject({
      selectionStart: 1,
      selectionEnd: 2,
      loopStart: 0.5,
      loopEnd: 3,
      isLoopEnabled: true,
      masterVolume: 0.4,
      selectedTrackId: 'B',
    });
  });

  it("the first engine's state reaches the zoom value: at the finest level it cannot zoom in", async () => {
    renderWithArrangement([track('A', [clip('a1', 0, 1)])], {
      children: CHILDREN,
      samplesPerPixel: 256,
      zoomLevels: [256, 512, 1024],
    });
    await ready();
    expect(probe.zoom).toMatchObject({ samplesPerPixel: 256, canZoomIn: false, canZoomOut: true });
  });

  it('playback that was running when a rebuild failed shows stopped; Play after a later successful build starts', async () => {
    const onError = vi.fn();
    const view = renderWithArrangement([track('A', [clip('a1', 0, 4)])], {
      children: CHILDREN,
      effects: effectsA,
      indefinitePlayback: true,
      onError,
    });
    await ready();
    await act(async () => {
      await probe.controls.play(0);
    });
    view.factory.latest().setTime(1.5);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    expect(probe.isPlaying).toBe(true);

    const gate = view.factory.holdNext();
    act(() => view.update({ effects: effectsB }));
    await act(async () => {
      gate.fail(new Error('no engine'));
      await flush();
    });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(probe.isPlaying).toBe(false);
    // The cursor stays where playback was.
    expect(probe.currentTime).toBeCloseTo(1.5, 6);

    act(() => view.update({ effects: effectsC }));
    await ready();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 40));
    });
    const rebuilt = view.factory.latest();
    // Nothing starts by itself.
    expect(probe.isPlaying).toBe(false);
    expect(rebuilt.count('play')).toBe(0);

    await act(async () => {
      await probe.controls.play();
    });
    expect(rebuilt.count('play')).toBe(1);
    expect(probe.isPlaying).toBe(true);
  });
});

/** The overlay that takes presses on the tracks: the sibling laid over the rows. */
function clickOverlay(): HTMLElement {
  let element: Element | null = document.querySelector('[data-track-row]');
  while (element && element.parentElement) {
    const last = element.parentElement.lastElementChild;
    if (last && last !== element && !last.contains(element) && last.childElementCount === 0) {
      return last as HTMLElement;
    }
    element = element.parentElement;
  }
  throw new Error('click overlay not found');
}
