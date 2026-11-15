// @vitest-environment jsdom
//
// #812: a clip trim drag shows its moves through a view-only preview that only
// the dragged clip follows. The tracks change once, on release, through one
// `arrangement.trimClip`; Escape clears the preview and changes nothing.
//
// The real provider and view on an arrangement, with a fake adapter. dnd-kit's DragDropProvider is
// the real one; the test captures the handlers `ClipInteractionProvider` hands
// it and calls them with drag events, as dnd-kit would.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, renderHook, act, waitFor, cleanup } from '@testing-library/react';
import React, { startTransition, use } from 'react';
import { createValueSource } from '@waveform-playlist/core';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { Arrangement, PlaylistEngine, PlayoutAdapter } from '@waveform-playlist/engine';
import type { EffectsFunction } from '@waveform-playlist/playout';

const counts = vi.hoisted(() => ({
  clip: {} as Record<string, number>,
  track: {} as Record<string, number>,
  shell: 0,
  scaleDurationMs: -1,
  // The latest props each clip was drawn with, and every geometry it was drawn
  // with since `log` was last cleared.
  clipProps: {} as Record<string, { startSample: number; durationSamples: number }>,
  log: [] as Array<{ clipId: string; startSample: number; durationSamples: number }>,
  channel: {} as Record<string, { data: unknown; clipOffsetSeconds: number | undefined }>,
  dnd: {} as Record<string, unknown>,
}));

vi.mock('@waveform-playlist/ui-components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@waveform-playlist/ui-components')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    Clip: (props: React.ComponentProps<typeof actual.Clip>) => {
      counts.clip[props.clipId] = (counts.clip[props.clipId] ?? 0) + 1;
      const geometry = { startSample: props.startSample, durationSamples: props.durationSamples };
      counts.clipProps[props.clipId] = geometry;
      counts.log.push({ clipId: props.clipId, ...geometry });
      return createElement(actual.Clip, props);
    },
    SmartChannel: (props: React.ComponentProps<typeof actual.SmartChannel>) => {
      const id = props.spectrogramClipId ?? '?';
      counts.channel[id] = { data: props.data, clipOffsetSeconds: props.clipOffsetSeconds };
      return createElement(actual.SmartChannel, props);
    },
    Track: (props: React.ComponentProps<typeof actual.Track>) => {
      const id = props.trackId ?? '?';
      counts.track[id] = (counts.track[id] ?? 0) + 1;
      return createElement(actual.Track, props);
    },
    // Rendered unconditionally by the view's root: counts the root's renders.
    Playlist: (props: React.ComponentProps<typeof actual.Playlist>) => {
      counts.shell++;
      return createElement(actual.Playlist, props);
    },
    SmartScale: (props: React.ComponentProps<typeof actual.SmartScale>) => {
      counts.scaleDurationMs = props.durationMs;
      return createElement(actual.SmartScale, props);
    },
  };
});

// The real provider, with the handlers it is given captured.
vi.mock('@dnd-kit/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@dnd-kit/react')>();
  const { createElement } = await import('react');
  return {
    ...actual,
    DragDropProvider: (props: React.ComponentProps<typeof actual.DragDropProvider>) => {
      counts.dnd = props as unknown as Record<string, unknown>;
      return createElement(actual.DragDropProvider, props);
    },
  };
});
vi.mock('../hooks/useDragSensors', () => ({ useDragSensors: () => [] }));

import { TestProvider, testArrangement } from './helpers/arrangementProvider';
import {
  ArrangementContext,
  PlaylistViewContext,
  TrimPreviewContext,
  useEngineRefs,
  usePlaylistTimeline,
} from '../contexts/playlistContexts';
import { ClipInteractionProvider } from '../components/ClipInteractionProvider';
import { useClipDragHandlers } from '../hooks/useClipDragHandlers';
import { clipPeaksFor } from '../utils/derivePeaks';
import type { TrimPreview } from '../providerInternals/useTrimPreview';
import * as publicApi from '../index';
import * as toneApi from '../tone';
import { ComposedWaveform } from './testCompositions';
import {
  SAMPLE_RATE,
  SPP,
  SOURCE_SECONDS,
  makeWaveformData,
  initialTracks,
  singleAdapter,
  firstBuildOnly,
  trimEvent,
  moveEvent,
  type Boundary,
} from './trimPreviewFixtures';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

let probe: {
  timeline: ReturnType<typeof usePlaylistTimeline>;
  engineRefs: ReturnType<typeof useEngineRefs>;
  preview: () => TrimPreview | null;
};
const ProbeChild: React.FC = () => {
  const handle = use(TrimPreviewContext);
  probe = {
    timeline: usePlaylistTimeline(),
    engineRefs: useEngineRefs(),
    preview: () =>
      handle && typeof handle === 'object' ? (handle.source.getSnapshot() ?? null) : null,
  };
  return null;
};

function resetCounts() {
  counts.clip = {};
  counts.track = {};
  counts.shell = 0;
  counts.log = [];
}

// The arrangement of the test (#812), and every change of its tracks.
let arrangement: Arrangement;
const tracksChanged = vi.fn();

const App: React.FC<{ createAdapter: () => PlayoutAdapter; effects?: EffectsFunction }> = ({
  createAdapter,
  effects,
}) => {
  return (
    <TestProvider
      arrangement={arrangement}
      effects={effects}
      sampleRate={SAMPLE_RATE}
      samplesPerPixel={SPP}
      zoomLevels={[SPP]}
      createAdapter={createAdapter}
    >
      <ProbeChild />
      <ClipInteractionProvider>
        <ComposedWaveform showClipHeaders noControls />
      </ClipInteractionProvider>
    </TestProvider>
  );
};

async function mount(
  initial = initialTracks(),
  createAdapter: () => PlayoutAdapter = singleAdapter()
) {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // jsdom has no canvas: without this every drawn channel logs "Not implemented".
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  tracksChanged.mockClear();
  arrangement = testArrangement(initial);
  let version = arrangement.tracksVersion;
  arrangement.subscribe(() => {
    if (arrangement.tracksVersion === version) return;
    version = arrangement.tracksVersion;
    tracksChanged(arrangement.getTracks());
  });
  const view = render(<App createAdapter={createAdapter} />);
  await waitFor(() => expect(probe.timeline.isReady).toBe(true));
  await act(async () => {});
  // The engine attaching gives every clip its tick (one 'recompute'): not an edit.
  tracksChanged.mockClear();
  return {
    engine: () => probe.engineRefs.playoutRef.current as PlaylistEngine,
    warn,
    view,
  };
}

type Handler = (event: never) => void;
type HandlerName = 'onDragStart' | 'onDragMove' | 'onDragEnd';
const dnd = (name: HandlerName) => counts.dnd[name] as Handler;

/**
 * Calls a captured handler the way dnd-kit 0.5.0 does: `onDragStart`
 * directly, `onDragMove` and `onDragEnd` inside `startTransition` (its
 * DragDropProvider's `trackRendering`). Inside a transition, a state update
 * is a transition update while a `useSyncExternalStore` change renders at
 * once: the view reads both the arrangement and the preview that way (#812),
 * so the release's two changes are drawn together.
 */
function dispatch(name: HandlerName, event: never) {
  act(() => {
    if (name === 'onDragStart') dnd(name)(event);
    else startTransition(() => dnd(name)(event));
  });
}

/** The arrangement's track edits: what a drag may call, and only on release. */
function spyOnWrites(target: Arrangement) {
  return {
    trimClip: vi.spyOn(target, 'trimClip'),
    moveClip: vi.spyOn(target, 'moveClip'),
    beginTransaction: vi.spyOn(target, 'beginTransaction'),
    commitTransaction: vi.spyOn(target, 'commitTransaction'),
    abortTransaction: vi.spyOn(target, 'abortTransaction'),
    setTracks: vi.spyOn(target, 'setTracks'),
    updateTrack: vi.spyOn(target, 'updateTrack'),
  };
}

function clipOf(tracks: readonly ClipTrack[], clipId: string): AudioClip | undefined {
  for (const track of tracks) {
    const found = track.clips.find((c) => c.id === clipId);
    if (found) return found;
  }
  return undefined;
}

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('a trim previews in the view (#812)', () => {
  it('each move of a trim publishes a preview and changes no track', async () => {
    await mount();
    const writes = spyOnWrites(arrangement);

    dispatch('onDragStart', trimEvent(0));
    dispatch('onDragMove', trimEvent(10));
    expect(probe.preview()).toEqual({
      trackId: 't1',
      clipId: 'b',
      startSample: 2 * SAMPLE_RATE + 10 * SPP,
      durationSamples: SAMPLE_RATE - 10 * SPP,
      offsetSamples: SAMPLE_RATE + 10 * SPP,
    });
    const first = probe.preview();
    dispatch('onDragMove', trimEvent(20));
    expect(probe.preview()).not.toBe(first);
    expect(probe.preview()?.startSample).toBe(2 * SAMPLE_RATE + 20 * SPP);

    expect(tracksChanged).not.toHaveBeenCalled();
    for (const spy of Object.values(writes)) expect(spy).not.toHaveBeenCalled();
    // The tracks the provider holds are the ones from before the drag.
    expect(clipOf(probe.timeline.tracks, 'b')?.startSample).toBe(2 * SAMPLE_RATE);
    // The dragged clip is drawn where the preview says.
    expect(counts.clipProps.b).toEqual({
      startSample: 2 * SAMPLE_RATE + 20 * SPP,
      durationSamples: SAMPLE_RATE - 20 * SPP,
    });
  });

  it("a move renders the dragged clip's view and no other clip, row or the root", async () => {
    await mount();
    dispatch('onDragStart', trimEvent(0));
    dispatch('onDragMove', trimEvent(5));
    resetCounts();

    dispatch('onDragMove', trimEvent(10));

    expect(counts.clip).toEqual({ b: 1 });
    expect(counts.track).toEqual({});
    expect(counts.shell).toBe(0);
  });

  it('release calls `arrangement.trimClip` once with the final delta and clears the preview in the same flush; the tracks change once', async () => {
    await mount();
    const writes = spyOnWrites(arrangement);

    dispatch('onDragStart', trimEvent(0));
    dispatch('onDragMove', trimEvent(10));
    dispatch('onDragMove', trimEvent(25));
    counts.log = [];
    dispatch('onDragEnd', trimEvent(25));

    expect(writes.trimClip).toHaveBeenCalledTimes(1);
    expect(writes.trimClip).toHaveBeenCalledWith('t1', 'b', 'left', 25 * SPP);
    expect(probe.preview()).toBeNull();
    expect(tracksChanged).toHaveBeenCalledTimes(1);
    const committed = clipOf(tracksChanged.mock.calls[0][0] as ClipTrack[], 'b');
    expect(committed).toMatchObject({
      startSample: 2 * SAMPLE_RATE + 25 * SPP,
      durationSamples: SAMPLE_RATE - 25 * SPP,
      offsetSamples: SAMPLE_RATE + 25 * SPP,
    });
    // No frame after the release shows the clip where it was before the drag.
    // dnd-kit calls onDragEnd inside `startTransition`. The trim reaches the
    // view through the arrangement and the cleared preview through its
    // source, both `useSyncExternalStore`, so they render together and the
    // clip is never drawn cleared over the old tracks (back at 2 s for a
    // frame, then at its new start). Until #812 the app's `setTracks` was a
    // transition update here, and the handler needed a `flushSync`.
    const drawnB = counts.log.filter((entry) => entry.clipId === 'b').map((e) => e.startSample);
    expect(drawnB.length).toBeGreaterThan(0);
    expect(drawnB).not.toContain(2 * SAMPLE_RATE);
    expect(new Set(drawnB)).toEqual(new Set([2 * SAMPLE_RATE + 25 * SPP]));
    // No transaction: the trim is one undo step by itself.
    expect(writes.beginTransaction).not.toHaveBeenCalled();
    expect(writes.commitTransaction).not.toHaveBeenCalled();
  });

  it('Escape clears the preview and changes no track', async () => {
    await mount();
    const writes = spyOnWrites(arrangement);
    const before = probe.timeline.tracks;

    dispatch('onDragStart', trimEvent(0, 'right'));
    dispatch('onDragMove', trimEvent(-30, 'right'));
    expect(counts.clipProps.b.durationSamples).toBe(SAMPLE_RATE - 30 * SPP);
    dispatch('onDragEnd', trimEvent(-30, 'right', { canceled: true }));

    expect(probe.preview()).toBeNull();
    expect(tracksChanged).not.toHaveBeenCalled();
    for (const spy of Object.values(writes)) expect(spy).not.toHaveBeenCalled();
    expect(probe.timeline.tracks).toBe(before);
    expect(counts.clipProps.b).toEqual({
      startSample: 2 * SAMPLE_RATE,
      durationSamples: SAMPLE_RATE,
    });
  });

  it('the previewed left trim draws the peaks of the previewed offset', async () => {
    await mount();
    const committedPeaks = counts.channel.b.data;

    dispatch('onDragStart', trimEvent(0));
    // 30 px to the left: 0.625 s more of the file, from 0.375 s in.
    dispatch('onDragMove', trimEvent(-30));

    const preview = probe.preview() as TrimPreview;
    expect(preview).toMatchObject({
      startSample: 2 * SAMPLE_RATE - 30 * SPP,
      durationSamples: SAMPLE_RATE + 30 * SPP,
      offsetSamples: SAMPLE_RATE - 30 * SPP,
    });
    const b = clipOf(probe.timeline.tracks, 'b') as AudioClip;
    const expected = clipPeaksFor(
      {
        ...b,
        startSample: preview.startSample,
        durationSamples: preview.durationSamples,
        offsetSamples: preview.offsetSamples,
      },
      't1',
      { samplesPerPixel: SPP, mono: false, getGeneratedWaveformData: () => undefined }
    ).clipPeaks;

    expect(counts.clipProps.b).toEqual({
      startSample: preview.startSample,
      durationSamples: preview.durationSamples,
    });
    expect(counts.channel.b.clipOffsetSeconds).toBe(preview.offsetSamples / SAMPLE_RATE);
    expect(counts.channel.b.data).toEqual(expected.peaks.data[0]);
    expect(counts.channel.b.data).not.toEqual(committedPeaks);
  });

  it('a change of another clip of the track during the drag (its peaks arrived) keeps the preview and the release still trims the dragged clip', async () => {
    const { engine } = await mount();
    const engineBefore = engine();

    dispatch('onDragStart', trimEvent(0));
    dispatch('onDragMove', trimEvent(10));

    // Clip `a` of the same track gets its peaks: the track changes; the
    // engine follows it and is not rebuilt (#812).
    const waveformData = makeWaveformData(SOURCE_SECONDS);
    await act(async () => {
      arrangement.updateTrack('t1', (track) => ({
        ...track,
        clips: track.clips.map((c) => (c.id === 'a' ? { ...c, waveformData } : c)),
      }));
    });
    expect(engine()).toBe(engineBefore);
    tracksChanged.mockClear();

    expect(probe.preview()?.startSample).toBe(2 * SAMPLE_RATE + 10 * SPP);
    expect(counts.clipProps.b.startSample).toBe(2 * SAMPLE_RATE + 10 * SPP);

    dispatch('onDragMove', trimEvent(40));
    const previewed = probe.preview() as TrimPreview;
    dispatch('onDragEnd', trimEvent(40));

    expect(probe.preview()).toBeNull();
    expect(tracksChanged).toHaveBeenCalledTimes(1);
    const tracks = probe.timeline.tracks;
    expect(clipOf(tracks, 'b')).toMatchObject({
      startSample: previewed.startSample,
      durationSamples: previewed.durationSamples,
      offsetSamples: previewed.offsetSamples,
    });
    expect(previewed.startSample).toBe(2 * SAMPLE_RATE + 40 * SPP);
    // The clip whose peaks arrived is still there, with them.
    expect(clipOf(tracks, 'a')?.waveformData).toBe(waveformData);
  });

  it('a move drag makes one `arrangement.moveClip` on drop and opens no transaction', async () => {
    await mount();
    const writes = spyOnWrites(arrangement);

    dispatch('onDragStart', moveEvent(0));
    dispatch('onDragMove', moveEvent(50));
    dispatch('onDragEnd', moveEvent(50));

    expect(writes.moveClip).toHaveBeenCalledTimes(1);
    expect(writes.moveClip).toHaveBeenCalledWith('t1', 'b', 50 * SPP);
    expect(writes.beginTransaction).not.toHaveBeenCalled();
    expect(writes.commitTransaction).not.toHaveBeenCalled();
    expect(writes.abortTransaction).not.toHaveBeenCalled();
    expect(probe.preview()).toBeNull();
    expect(tracksChanged).toHaveBeenCalledTimes(1);
    expect(clipOf(probe.timeline.tracks, 'b')?.startSample).toBe(2 * SAMPLE_RATE + 50 * SPP);
  });

  it('a cancelled move changes no track', async () => {
    await mount();
    const writes = spyOnWrites(arrangement);

    dispatch('onDragStart', moveEvent(0));
    dispatch('onDragMove', moveEvent(50));
    dispatch('onDragEnd', moveEvent(50, { canceled: true }));

    for (const spy of Object.values(writes)) expect(spy).not.toHaveBeenCalled();
    expect(tracksChanged).not.toHaveBeenCalled();
    expect(clipOf(probe.timeline.tracks, 'b')?.startSample).toBe(2 * SAMPLE_RATE);
  });

  it('a move whose track is gone changes no track', async () => {
    const { warn } = await mount();
    const writes = spyOnWrites(arrangement);

    // Two tracks: there is none at index 2.
    dispatch('onDragStart', moveEvent(0, { trackIndex: 2 }));
    dispatch('onDragMove', moveEvent(50, { trackIndex: 2 }));
    dispatch('onDragEnd', moveEvent(50, { trackIndex: 2 }));

    for (const spy of Object.values(writes)) expect(spy).not.toHaveBeenCalled();
    expect(tracksChanged).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('The move was dropped'));
  });

  it('release while no engine is attached commits the trim to the arrangement and clears the preview', async () => {
    const createAdapter = firstBuildOnly();
    const { engine, warn, view } = await mount(initialTracks(), createAdapter);
    const writes = spyOnWrites(arrangement);

    dispatch('onDragStart', trimEvent(0));
    dispatch('onDragMove', trimEvent(10));
    // A rebuild (new effects) starts mid-drag and does not finish.
    await act(async () => {
      view.rerender(<App createAdapter={createAdapter} effects={() => undefined} />);
    });
    expect(engine()).toBeNull();
    warn.mockClear();

    dispatch('onDragMove', trimEvent(20));
    dispatch('onDragEnd', trimEvent(20));

    expect(probe.preview()).toBeNull();
    expect(writes.trimClip).toHaveBeenCalledTimes(1);
    expect(tracksChanged).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
    // The clip is drawn where the release put it.
    expect(counts.clipProps.b).toEqual({
      startSample: 2 * SAMPLE_RATE + 20 * SPP,
      durationSamples: SAMPLE_RATE - 20 * SPP,
    });
  });

  it('a right trim past the end of the timeline widens the view to the next 10 seconds, once per step', async () => {
    await mount();
    expect(counts.scaleDurationMs).toBe(3000);
    dispatch('onDragStart', trimEvent(0, 'right'));
    resetCounts();

    // 48 px is a second. To 3.5 s: past the end (3 s), so the view is 10 s wide.
    dispatch('onDragMove', trimEvent(24, 'right'));
    expect(counts.scaleDurationMs).toBe(10_000);
    expect(counts.shell).toBe(1);
    // To 9 s: the same step, the root does not render.
    dispatch('onDragMove', trimEvent(288, 'right'));
    expect(counts.shell).toBe(1);
    // To 12 s: the next step.
    dispatch('onDragMove', trimEvent(432, 'right'));
    expect(counts.scaleDurationMs).toBe(20_000);
    expect(counts.shell).toBe(2);
    // Back inside the timeline, then cancelled: the view is 3 s again.
    dispatch('onDragMove', trimEvent(-100, 'right'));
    expect(counts.scaleDurationMs).toBe(3000);
    dispatch('onDragEnd', trimEvent(-100, 'right', { canceled: true }));
    expect(counts.scaleDurationMs).toBe(3000);
  });

  it('the preview context is internal: not exported from the package entry or `/tone`', () => {
    expect('TrimPreviewContext' in publicApi).toBe(false);
    expect('TrimPreviewContext' in toneApi).toBe(false);
    expect('TrimPreviewPeaksContext' in publicApi).toBe(false);
    expect('TrimPreviewPeaksContext' in toneApi).toBe(false);
  });
});

// Every clip has a second of unused audio before it and three after, so only
// its neighbours and the minimum duration stop a trim.
function hookClip(id: string, startSample: number, durationSamples: number): AudioClip {
  return {
    id,
    startSample,
    durationSamples,
    offsetSamples: SAMPLE_RATE,
    sourceDurationSamples: durationSamples + 4 * SAMPLE_RATE,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
}

// One track, clips stored out of timeline order: b (1 s..2 s), a (0..0.5 s), c (3 s..4 s)
function hookTracks(): ClipTrack[] {
  return [
    {
      id: 'track-1',
      name: 'Track 1',
      clips: [
        hookClip('b', SAMPLE_RATE, SAMPLE_RATE),
        hookClip('a', 0, SAMPLE_RATE / 2),
        hookClip('c', 3 * SAMPLE_RATE, SAMPLE_RATE),
      ],
    } as ClipTrack,
  ];
}

/** A dnd-kit event for a boundary of clip `b` (clip 0 of the hook tracks). */
function hookTrimEvent(dx: number, boundary: Boundary = 'left', canceled = false) {
  return {
    canceled,
    to: { x: 100 + dx, y: 0 },
    operation: {
      source: { data: { clipId: 'b', trackIndex: 0, clipIndex: 0, boundary } },
      position: { initial: { x: 100, y: 0 }, current: { x: 100, y: 0 } },
      transform: { x: dx, y: 0 },
    },
  } as never;
}

function renderHandlers(
  options: {
    snapSamplePosition?: (sample: number) => number;
    constrainTrimDelta?: (delta: number) => number;
  } = {}
) {
  const handle = createValueSource<TrimPreview | null>(null);
  const constrain = options.constrainTrimDelta ?? ((delta: number) => delta);
  const tracks = hookTracks();
  // The hooks read the arrangement from context (#812): a fake that hands out
  // the tracks and records the edits.
  const engine = {
    getTracks: () => tracks,
    constrainTrimDelta: vi.fn((_t: string, _c: string, _b: Boundary, delta: number) =>
      constrain(delta)
    ),
    trimClip: vi.fn(),
    moveClip: vi.fn(),
  };
  const view = { sampleRate: SAMPLE_RATE, mono: false, indefinitePlayback: false };
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <ArrangementContext value={engine as unknown as Arrangement}>
      <PlaylistViewContext value={view}>
        <TrimPreviewContext value={handle}>{children}</TrimPreviewContext>
      </PlaylistViewContext>
    </ArrangementContext>
  );
  const hook = renderHook(
    () =>
      useClipDragHandlers({
        samplesPerPixel: SPP,
        snapSamplePosition: options.snapSamplePosition,
      }),
    { wrapper }
  );
  const drag = (dx: number, boundary: Boundary = 'left') => {
    const handlers = hook.result.current;
    act(() => handlers.onDragStart(hookTrimEvent(0, boundary)));
    act(() => handlers.onDragMove(hookTrimEvent(dx, boundary)));
    const preview = handle.source.getSnapshot();
    act(() => handlers.onDragEnd(hookTrimEvent(dx, boundary, true)));
    return preview as TrimPreview;
  };
  const release = (dx: number, boundary: Boundary = 'left') => {
    const handlers = hook.result.current;
    act(() => handlers.onDragStart(hookTrimEvent(0, boundary)));
    act(() => handlers.onDragMove(hookTrimEvent(dx, boundary)));
    const preview = handle.source.getSnapshot();
    act(() => handlers.onDragEnd(hookTrimEvent(dx, boundary)));
    return preview as TrimPreview;
  };
  return { drag, release, engine, handle };
}

describe('the preview is computed as the release commits', () => {
  it('the preview is constrained and snapped as before', () => {
    const { drag } = renderHandlers();
    // Far past clip `a`, which ends at 0.5 s. `a` is stored AFTER `b` in the
    // clips array, so a wrong sorted index would pick the wrong neighbour.
    expect(drag(-5000).startSample).toBe(SAMPLE_RATE / 2);
    // A right trim stops exactly at the start of the next clip.
    const right = drag(5000, 'right');
    expect(right.startSample + right.durationSamples).toBe(3 * SAMPLE_RATE);
    // No shorter than 0.1 s.
    expect(drag(5000).durationSamples).toBe(SAMPLE_RATE / 10);

    // Snapped to a 0.25 s grid: the boundary's absolute position snaps.
    const grid = SAMPLE_RATE / 4;
    const snapped = renderHandlers({ snapSamplePosition: (s) => Math.round(s / grid) * grid });
    // Left by 13 px (0.27 s): start at 0.73 s, snapped to 0.75 s.
    expect(snapped.drag(-13)).toMatchObject({
      startSample: 0.75 * SAMPLE_RATE,
      durationSamples: 1.25 * SAMPLE_RATE,
      offsetSamples: 0.75 * SAMPLE_RATE,
    });
    // Right by 20 px (0.42 s): end at 2.42 s, snapped to 2.5 s.
    expect(snapped.drag(20, 'right')).toMatchObject({
      startSample: SAMPLE_RATE,
      durationSamples: 1.5 * SAMPLE_RATE,
      offsetSamples: SAMPLE_RATE,
    });
  });

  it("the arrangement's constraint decides the preview, and the release sends the delta of the last preview", () => {
    // The arrangement allows at most 0.1 s of a trim, either way.
    const limit = SAMPLE_RATE / 10;
    const { release, engine } = renderHandlers({
      constrainTrimDelta: (delta) => Math.max(-limit, Math.min(limit, delta)),
    });

    // 10 px is 0.21 s, which the track allows.
    const preview = release(-10);
    expect(engine.constrainTrimDelta).toHaveBeenLastCalledWith('track-1', 'b', 'left', -10 * SPP);
    expect(preview).toMatchObject({
      startSample: SAMPLE_RATE - limit,
      durationSamples: SAMPLE_RATE + limit,
      offsetSamples: SAMPLE_RATE - limit,
    });
    expect(engine.trimClip).toHaveBeenCalledTimes(1);
    expect(engine.trimClip).toHaveBeenCalledWith('track-1', 'b', 'left', -limit);
  });
});
