// @vitest-environment jsdom
//
// #812: a clip trim drag shows its moves through a view-only preview that only
// the dragged clip follows. The tracks change once, on release, through one
// `engine.trimClip`; Escape clears the preview and changes nothing.
//
// The real provider and view with a fake adapter (the harness of
// trackControlsDisabledWhileLoading.test.tsx). dnd-kit's DragDropProvider is
// the real one; the test captures the handlers `ClipInteractionProvider` hands
// it and calls them with drag events, as dnd-kit would.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, renderHook, act, waitFor, cleanup } from '@testing-library/react';
import React, { use, useCallback, useState } from 'react';
import WaveformData from 'waveform-data';
import { createValueSource } from '@waveform-playlist/core';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlaylistEngine, PlayoutAdapter } from '@waveform-playlist/engine';

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

import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
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

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;
const SPP = 1000;

function makeWaveformData(seconds: number): WaveformData {
  const bins = Math.ceil((seconds * SAMPLE_RATE) / 256);
  const data: number[] = [];
  // Values that differ along the file, so two slices of it differ.
  for (let i = 0; i < bins; i++) data.push(-(i % 97), (i * 7) % 113);
  return WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: SAMPLE_RATE,
    samples_per_pixel: 256,
    bits: 16,
    length: bins,
    data,
  });
}

const SOURCE_SECONDS = 30;
const WAVEFORM = makeWaveformData(SOURCE_SECONDS);

function makeClip(id: string, startSeconds: number, seconds: number, offsetSeconds = 1): AudioClip {
  return {
    id,
    name: id,
    startSample: startSeconds * SAMPLE_RATE,
    durationSamples: seconds * SAMPLE_RATE,
    offsetSamples: offsetSeconds * SAMPLE_RATE,
    sampleRate: SAMPLE_RATE,
    sourceDurationSamples: SOURCE_SECONDS * SAMPLE_RATE,
    gain: 1,
    waveformData: WAVEFORM,
  } as AudioClip;
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return {
    id,
    name: id,
    kind: 'audio',
    clips,
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

// t1: a (0..1 s), b (2..3 s, from 1 s into its file). t2: c (0..1 s).
// The timeline ends at 3 s, with b.
function initialTracks(): ClipTrack[] {
  return [
    makeTrack('t1', [makeClip('a', 0, 1), makeClip('b', 2, 1)]),
    makeTrack('t2', [makeClip('c', 0, 1)]),
  ];
}

function createFakeAdapter(): PlayoutAdapter {
  return {
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {},
    setTracks() {},
    addTrack() {},
    removeTrack() {},
    updateTrack() {},
    play() {},
    pause() {},
    stop() {},
    seek() {},
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume() {},
    setTrackVolume() {},
    setTrackMute() {},
    setTrackSolo() {},
    setTrackPan() {},
    setLoop() {},
    dispose() {},
  } as unknown as PlayoutAdapter;
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

let setAppTracks: (tracks: ClipTrack[]) => void = () => {};
const onTracksChange = vi.fn();

const App: React.FC<{ initial: ClipTrack[]; createAdapter: () => PlayoutAdapter }> = ({
  initial,
  createAdapter,
}) => {
  const [tracks, setTracks] = useState(initial);
  setAppTracks = setTracks;
  const handleTracksChange = useCallback((next: ClipTrack[]) => {
    onTracksChange(next);
    setTracks(next);
  }, []);
  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      onTracksChange={handleTracksChange}
      sampleRate={SAMPLE_RATE}
      samplesPerPixel={SPP}
      zoomLevels={[SPP]}
      createAdapter={createAdapter}
    >
      <ProbeChild />
      <ClipInteractionProvider>
        <ComposedWaveform showClipHeaders noControls />
      </ClipInteractionProvider>
    </WaveformPlaylistProvider>
  );
};

async function mount(initial = initialTracks()) {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
  onTracksChange.mockClear();
  const adapter = createFakeAdapter();
  const createAdapter = () => adapter;
  render(<App initial={initial} createAdapter={createAdapter} />);
  await waitFor(() => expect(probe.timeline.isReady).toBe(true));
  await act(async () => {});
  return { engine: () => probe.engineRefs.playoutRef.current as PlaylistEngine };
}

type Boundary = 'left' | 'right';

/** A dnd-kit event for a boundary of clip `b` (track 0, clip 1), dragged by `dx` pixels. */
function trimEvent(dx: number, boundary: Boundary = 'left', extra: Record<string, unknown> = {}) {
  return {
    canceled: false,
    to: { x: 100 + dx, y: 0 },
    operation: {
      source: { data: { clipId: 'b', trackIndex: 0, clipIndex: 1, boundary } },
      position: { initial: { x: 100, y: 0 }, current: { x: 100, y: 0 } },
      transform: { x: dx, y: 0 },
    },
    ...extra,
  } as never;
}

function moveEvent(dx: number) {
  return {
    canceled: false,
    to: { x: 100 + dx, y: 0 },
    operation: {
      source: { data: { clipId: 'b', trackIndex: 0, clipIndex: 1 } },
      position: { initial: { x: 100, y: 0 }, current: { x: 100, y: 0 } },
      transform: { x: dx, y: 0 },
    },
  } as never;
}

type Handler = (event: never) => void;
const dnd = (name: 'onDragStart' | 'onDragMove' | 'onDragEnd') => counts.dnd[name] as Handler;

function spyOnWrites(engine: PlaylistEngine) {
  return {
    trimClip: vi.spyOn(engine, 'trimClip'),
    moveClip: vi.spyOn(engine, 'moveClip'),
    beginTransaction: vi.spyOn(engine, 'beginTransaction'),
    commitTransaction: vi.spyOn(engine, 'commitTransaction'),
    abortTransaction: vi.spyOn(engine, 'abortTransaction'),
    setTracks: vi.spyOn(engine, 'setTracks'),
    updateTrack: vi.spyOn(engine, 'updateTrack'),
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
  it('each move of a trim publishes a preview and calls neither `onTracksChange` nor the engine', async () => {
    const { engine } = await mount();
    const writes = spyOnWrites(engine());

    act(() => dnd('onDragStart')(trimEvent(0)));
    act(() => dnd('onDragMove')(trimEvent(10)));
    expect(probe.preview()).toEqual({
      trackId: 't1',
      clipId: 'b',
      startSample: 2 * SAMPLE_RATE + 10 * SPP,
      durationSamples: SAMPLE_RATE - 10 * SPP,
      offsetSamples: SAMPLE_RATE + 10 * SPP,
    });
    const first = probe.preview();
    act(() => dnd('onDragMove')(trimEvent(20)));
    expect(probe.preview()).not.toBe(first);
    expect(probe.preview()?.startSample).toBe(2 * SAMPLE_RATE + 20 * SPP);

    expect(onTracksChange).not.toHaveBeenCalled();
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
    act(() => dnd('onDragStart')(trimEvent(0)));
    act(() => dnd('onDragMove')(trimEvent(5)));
    resetCounts();

    act(() => dnd('onDragMove')(trimEvent(10)));

    expect(counts.clip).toEqual({ b: 1 });
    expect(counts.track).toEqual({});
    expect(counts.shell).toBe(0);
  });

  it('release calls `engine.trimClip` once with the final delta and clears the preview in the same flush; `onTracksChange` is called once', async () => {
    const { engine } = await mount();
    const writes = spyOnWrites(engine());

    act(() => dnd('onDragStart')(trimEvent(0)));
    act(() => dnd('onDragMove')(trimEvent(10)));
    act(() => dnd('onDragMove')(trimEvent(25)));
    counts.log = [];
    act(() => dnd('onDragEnd')(trimEvent(25)));

    expect(writes.trimClip).toHaveBeenCalledTimes(1);
    expect(writes.trimClip).toHaveBeenCalledWith('t1', 'b', 'left', 25 * SPP);
    expect(probe.preview()).toBeNull();
    expect(onTracksChange).toHaveBeenCalledTimes(1);
    const committed = clipOf(onTracksChange.mock.calls[0][0] as ClipTrack[], 'b');
    expect(committed).toMatchObject({
      startSample: 2 * SAMPLE_RATE + 25 * SPP,
      durationSamples: SAMPLE_RATE - 25 * SPP,
      offsetSamples: SAMPLE_RATE + 25 * SPP,
    });
    // No frame between the preview and the committed clip shows the clip
    // where it was before the drag. (Removing the handler's `flushSync`, or
    // clearing before committing, passes this too: React renders two updates
    // made in one synchronous call together, inside `act` or not. The
    // `flushSync` makes it a guarantee, as on the annotation edge release.)
    const drawnB = counts.log.filter((entry) => entry.clipId === 'b');
    expect(drawnB.length).toBeGreaterThan(0);
    for (const entry of drawnB) expect(entry.startSample).toBe(2 * SAMPLE_RATE + 25 * SPP);
    // No transaction: the trim is one undo step by itself.
    expect(writes.beginTransaction).not.toHaveBeenCalled();
    expect(writes.commitTransaction).not.toHaveBeenCalled();
  });

  it('Escape clears the preview and changes no track', async () => {
    const { engine } = await mount();
    const writes = spyOnWrites(engine());
    const before = probe.timeline.tracks;

    act(() => dnd('onDragStart')(trimEvent(0, 'right')));
    act(() => dnd('onDragMove')(trimEvent(-30, 'right')));
    expect(counts.clipProps.b.durationSamples).toBe(SAMPLE_RATE - 30 * SPP);
    act(() => dnd('onDragEnd')(trimEvent(-30, 'right', { canceled: true })));

    expect(probe.preview()).toBeNull();
    expect(onTracksChange).not.toHaveBeenCalled();
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

    act(() => dnd('onDragStart')(trimEvent(0)));
    // 30 px to the left: 0.625 s more of the file, from 0.375 s in.
    act(() => dnd('onDragMove')(trimEvent(-30)));

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

  it('a new `tracks` prop during the drag (audio arrived for another clip of the track) keeps the preview and the release still trims the dragged clip', async () => {
    const { engine } = await mount();
    const engineBefore = engine();

    act(() => dnd('onDragStart')(trimEvent(0)));
    act(() => dnd('onDragMove')(trimEvent(10)));

    // Clip `a` of the same track gets its audio: a new clip object, so the
    // track changed and the provider rebuilds the engine.
    const arrived = { ...makeClip('a', 0, 1), waveformData: makeWaveformData(SOURCE_SECONDS) };
    await act(async () => {
      setAppTracks([
        makeTrack('t1', [arrived, makeClip('b', 2, 1)]),
        makeTrack('t2', [makeClip('c', 0, 1)]),
      ]);
    });
    await waitFor(() => {
      expect(engine()).not.toBeNull();
      expect(engine()).not.toBe(engineBefore);
    });
    await waitFor(() => expect(probe.timeline.isReady).toBe(true));

    expect(probe.preview()?.startSample).toBe(2 * SAMPLE_RATE + 10 * SPP);
    expect(counts.clipProps.b.startSample).toBe(2 * SAMPLE_RATE + 10 * SPP);

    act(() => dnd('onDragMove')(trimEvent(40)));
    const previewed = probe.preview() as TrimPreview;
    act(() => dnd('onDragEnd')(trimEvent(40)));

    expect(probe.preview()).toBeNull();
    expect(onTracksChange).toHaveBeenCalledTimes(1);
    const tracks = onTracksChange.mock.calls[0][0] as ClipTrack[];
    expect(clipOf(tracks, 'b')).toMatchObject({
      startSample: previewed.startSample,
      durationSamples: previewed.durationSamples,
      offsetSamples: previewed.offsetSamples,
    });
    expect(previewed.startSample).toBe(2 * SAMPLE_RATE + 40 * SPP);
    // The clip whose audio arrived is still there, with that audio.
    expect(clipOf(tracks, 'a')?.waveformData).toBe(arrived.waveformData);
    expect(probe.timeline.tracks).toBe(tracks);
  });

  it('a move drag makes one `engine.moveClip` on drop and opens no transaction', async () => {
    const { engine } = await mount();
    const writes = spyOnWrites(engine());

    act(() => dnd('onDragStart')(moveEvent(0)));
    act(() => dnd('onDragMove')(moveEvent(50)));
    act(() => dnd('onDragEnd')(moveEvent(50)));

    expect(writes.moveClip).toHaveBeenCalledTimes(1);
    expect(writes.moveClip).toHaveBeenCalledWith('t1', 'b', 50 * SPP);
    expect(writes.beginTransaction).not.toHaveBeenCalled();
    expect(writes.commitTransaction).not.toHaveBeenCalled();
    expect(writes.abortTransaction).not.toHaveBeenCalled();
    expect(probe.preview()).toBeNull();
    expect(onTracksChange).toHaveBeenCalledTimes(1);
    expect(clipOf(probe.timeline.tracks, 'b')?.startSample).toBe(2 * SAMPLE_RATE + 50 * SPP);
  });

  it('a right trim past the end of the timeline widens the view to the next 10 seconds, once per step', async () => {
    await mount();
    expect(counts.scaleDurationMs).toBe(3000);
    act(() => dnd('onDragStart')(trimEvent(0, 'right')));
    resetCounts();

    // 48 px is a second. To 3.5 s: past the end (3 s), so the view is 10 s wide.
    act(() => dnd('onDragMove')(trimEvent(24, 'right')));
    expect(counts.scaleDurationMs).toBe(10_000);
    expect(counts.shell).toBe(1);
    // To 9 s: the same step, the root does not render.
    act(() => dnd('onDragMove')(trimEvent(288, 'right')));
    expect(counts.shell).toBe(1);
    // To 12 s: the next step.
    act(() => dnd('onDragMove')(trimEvent(432, 'right')));
    expect(counts.scaleDurationMs).toBe(20_000);
    expect(counts.shell).toBe(2);
    // Back inside the timeline, then cancelled: the view is 3 s again.
    act(() => dnd('onDragMove')(trimEvent(-100, 'right')));
    expect(counts.scaleDurationMs).toBe(3000);
    act(() => dnd('onDragEnd')(trimEvent(-100, 'right', { canceled: true })));
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
  const engine = {
    constrainTrimDelta: vi.fn((_t: string, _c: string, _b: Boundary, delta: number) =>
      constrain(delta)
    ),
    trimClip: vi.fn(),
    moveClip: vi.fn(),
  };
  const view = { sampleRate: SAMPLE_RATE, mono: false, indefinitePlayback: false };
  const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <PlaylistViewContext value={view}>
      <TrimPreviewContext value={handle}>{children}</TrimPreviewContext>
    </PlaylistViewContext>
  );
  const tracks = hookTracks();
  const hook = renderHook(
    () =>
      useClipDragHandlers({
        tracks,
        onTracksChange: () => {},
        samplesPerPixel: SPP,
        engineRef: { current: engine as unknown as PlaylistEngine },
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

  it("the engine's constraint decides the preview, and the release sends the delta of the last preview", () => {
    // The engine allows at most 0.1 s of a trim, either way.
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
