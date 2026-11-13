// @vitest-environment jsdom
//
// #694: handlers and listener registrations that got a new identity far more
// often than their behaviour changed.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, render, cleanup, act } from '@testing-library/react';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlaylistEngine } from '@waveform-playlist/engine';

const SAMPLE_RATE = 48000;

// The hooks read sampleRate (and the provider reads more) from the playlist
// contexts. The tests supply those values directly.
let playlistData: Record<string, unknown> = { sampleRate: SAMPLE_RATE };
const playlistControls = {
  setSelectedTrackId: vi.fn(),
  reorderTrack: vi.fn(),
  bumpTrackReorderEpoch: vi.fn(),
  setTrackDragPreview: vi.fn(),
};
vi.mock('../contexts/playlistContexts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../contexts/playlistContexts')>()),
  usePlaylistView: () => playlistData,
  usePlaylistZoom: () => playlistData,
  usePlaylistTimeline: () => playlistData,
  useEngineRefs: () => playlistData,
  useEditorControls: () => playlistControls,
}));

// Capture what ClipInteractionProvider hands to dnd-kit.
let dndProps: Record<string, unknown> = {};
vi.mock('@dnd-kit/react', () => ({
  DragDropProvider: (props: Record<string, unknown> & { children: React.ReactNode }) => {
    dndProps = props;
    return <>{props.children}</>;
  },
}));
vi.mock('../hooks/useDragSensors', () => ({ useDragSensors: () => [] }));

import { useClipDragHandlers } from '../hooks/useClipDragHandlers';
import { useKeyboardShortcuts, type KeyboardShortcut } from '../hooks/useKeyboardShortcuts';
import { ClipInteractionProvider } from '../components/ClipInteractionProvider';
import { ClipCollisionModifier } from '../modifiers/ClipCollisionModifier';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// Every clip has a second of unused audio before and after it, so a trim can
// grow it in either direction and only its neighbours stop it.
function clip(id: string, startSample: number, durationSamples: number): AudioClip {
  return {
    id,
    startSample,
    durationSamples,
    offsetSamples: SAMPLE_RATE,
    sourceDurationSamples: durationSamples + 2 * SAMPLE_RATE,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
}

// One track, clips stored out of timeline order: b (1 s..2 s), a (0..0.5 s), c (3 s..4 s)
function makeTracks(): ClipTrack[] {
  return [
    {
      id: 'track-1',
      name: 'Track 1',
      clips: [
        clip('b', SAMPLE_RATE, SAMPLE_RATE),
        clip('a', 0, SAMPLE_RATE / 2),
        clip('c', 3 * SAMPLE_RATE, SAMPLE_RATE),
      ],
    } as ClipTrack,
  ];
}

function fakeEngine() {
  return {
    beginTransaction: vi.fn(),
    commitTransaction: vi.fn(),
    abortTransaction: vi.fn(),
    trimClip: vi.fn(),
    moveClip: vi.fn(),
  };
}

/** A dnd-kit event for the left boundary of clip `b`, dragged by `dx` pixels. */
function trimEvent(
  dx: number,
  extra: Record<string, unknown> = {},
  boundary: 'left' | 'right' = 'left'
) {
  return {
    canceled: false,
    to: { x: 100 + dx, y: 0 },
    operation: {
      source: { data: { clipId: 'b', trackIndex: 0, clipIndex: 0, boundary } },
      position: { initial: { x: 100, y: 0 }, current: { x: 100, y: 0 } },
      transform: { x: dx, y: 0 },
    },
    ...extra,
  } as never;
}

describe('useClipDragHandlers', () => {
  function setup() {
    const engine = fakeEngine();
    const engineRef = { current: engine as unknown as PlaylistEngine };
    const isDraggingRef = { current: false };
    let tracks = makeTracks();
    const onTracksChange = vi.fn((next: ClipTrack[]) => {
      tracks = next;
    });
    const hook = renderHook(() =>
      useClipDragHandlers({
        tracks,
        onTracksChange,
        samplesPerPixel: 1000,
        engineRef,
        isDraggingRef,
      })
    );
    return { hook, engine, isDraggingRef, onTracksChange, getTracks: () => tracks };
  }

  it('keeps the same handlers while a trim updates tracks on every move', () => {
    const { hook, onTracksChange } = setup();
    const first = hook.result.current;

    act(() => first.onDragStart(trimEvent(0)));
    act(() => first.onDragMove(trimEvent(10)));
    hook.rerender();
    act(() => hook.result.current.onDragMove(trimEvent(20)));
    hook.rerender();

    expect(onTracksChange).toHaveBeenCalledTimes(2);
    expect(hook.result.current.onDragStart).toBe(first.onDragStart);
    expect(hook.result.current.onDragMove).toBe(first.onDragMove);
    expect(hook.result.current.onDragEnd).toBe(first.onDragEnd);
  });

  it('applies each move to the latest tracks, from the original clip', () => {
    const { hook, getTracks } = setup();
    const handlers = hook.result.current;

    act(() => handlers.onDragStart(trimEvent(0)));
    act(() => handlers.onDragMove(trimEvent(10)));
    hook.rerender();
    // Called through the handler captured before the re-render.
    act(() => handlers.onDragMove(trimEvent(20)));

    const b = getTracks()[0].clips[0];
    expect(b.startSample).toBe(SAMPLE_RATE + 20_000);
    expect(b.offsetSamples).toBe(SAMPLE_RATE + 20_000);
    expect(b.durationSamples).toBe(SAMPLE_RATE - 20_000);
    // Untouched clips keep their identity.
    expect(getTracks()[0].clips[1].id).toBe('a');
  });

  it('stops a left trim exactly at the end of the previous clip', () => {
    const { hook, getTracks } = setup();
    const handlers = hook.result.current;

    act(() => handlers.onDragStart(trimEvent(0)));
    act(() => handlers.onDragMove(trimEvent(-10)));
    hook.rerender();
    // Far past clip `a`, which ends at 0.5 s. `a` is stored AFTER `b` in the
    // clips array, so a wrong sorted index would pick the wrong neighbour.
    act(() => handlers.onDragMove(trimEvent(-5000)));

    expect(getTracks()[0].clips[0].startSample).toBe(SAMPLE_RATE / 2);
  });

  it('stops a right trim exactly at the start of the next clip', () => {
    const { hook, getTracks } = setup();
    const handlers = hook.result.current;

    act(() => handlers.onDragStart(trimEvent(0, {}, 'right')));
    act(() => handlers.onDragMove(trimEvent(10, {}, 'right')));
    hook.rerender();
    act(() => handlers.onDragMove(trimEvent(5000, {}, 'right')));

    const b = getTracks()[0].clips[0];
    expect(b.startSample + b.durationSamples).toBe(3 * SAMPLE_RATE);
  });

  it('follows a neighbour that is replaced during the drag (undo mid-trim)', () => {
    const engine = fakeEngine();
    let tracks = makeTracks();
    const onTracksChange = (next: ClipTrack[]) => {
      tracks = next;
    };
    const hook = renderHook(() =>
      useClipDragHandlers({
        tracks,
        onTracksChange,
        samplesPerPixel: 1000,
        engineRef: { current: engine as unknown as PlaylistEngine },
        isDraggingRef: { current: false },
      })
    );
    const handlers = hook.result.current;

    act(() => handlers.onDragStart(trimEvent(0, {}, 'right')));
    act(() => handlers.onDragMove(trimEvent(10, {}, 'right')));
    hook.rerender();

    // Something else moves clip `c` 0.5 s earlier while the trim is in progress.
    tracks = tracks.map((track) => ({
      ...track,
      clips: track.clips.map((c) => (c.id === 'c' ? { ...c, startSample: 2.5 * SAMPLE_RATE } : c)),
    }));
    hook.rerender();
    act(() => handlers.onDragMove(trimEvent(5000, {}, 'right')));

    const b = tracks[0].clips[0];
    expect(b.startSample + b.durationSamples).toBe(2.5 * SAMPLE_RATE);
  });

  it('sorts the track once per drag, not on every move', () => {
    const { hook } = setup();
    const handlers = hook.result.current;
    const sort = vi.spyOn(Array.prototype, 'sort');

    act(() => handlers.onDragStart(trimEvent(0)));
    for (let dx = 1; dx <= 20; dx++) {
      act(() => handlers.onDragMove(trimEvent(dx)));
      hook.rerender();
    }

    expect(sort.mock.calls.length).toBeLessThanOrEqual(1);
  });

  it('commits the last delta on drop and reverts on cancel', () => {
    const { hook, engine, isDraggingRef, getTracks } = setup();
    const handlers = hook.result.current;

    act(() => handlers.onDragStart(trimEvent(0)));
    expect(isDraggingRef.current).toBe(true);
    act(() => handlers.onDragMove(trimEvent(10)));
    hook.rerender();
    act(() => handlers.onDragEnd(trimEvent(10)));
    expect(engine.trimClip).toHaveBeenCalledWith('track-1', 'b', 'left', 10_000);
    expect(engine.commitTransaction).toHaveBeenCalledTimes(1);
    expect(isDraggingRef.current).toBe(false);

    act(() => handlers.onDragStart(trimEvent(0)));
    const before = getTracks()[0].clips[0].startSample;
    act(() => handlers.onDragMove(trimEvent(30)));
    hook.rerender();
    act(() => handlers.onDragEnd(trimEvent(30, { canceled: true })));
    expect(getTracks()[0].clips[0].startSample).toBe(before);
    expect(engine.abortTransaction).toHaveBeenCalledTimes(1);
  });
});

describe('ClipInteractionProvider', () => {
  it('hands dnd-kit the same handlers and modifiers when only tracks change', () => {
    const base = {
      samplesPerPixel: 1000,
      sampleRate: SAMPLE_RATE,
      playoutRef: { current: null },
      isDraggingRef: { current: false },
      onTracksChange: () => {},
    };
    playlistData = { ...base, tracks: makeTracks() };
    // A new element each time: the mocked context hook is not reactive, and
    // React skips a re-render of the identical element.
    const ui = () => (
      <ClipInteractionProvider>
        <div />
      </ClipInteractionProvider>
    );
    const { rerender } = render(ui());
    const first = { ...dndProps };

    const nextTracks = makeTracks();
    playlistData = { ...base, tracks: nextTracks };
    rerender(ui());

    expect(dndProps.modifiers).toBe(first.modifiers);
    expect(dndProps.onDragStart).toBe(first.onDragStart);
    expect(dndProps.onDragMove).toBe(first.onDragMove);
    expect(dndProps.onDragEnd).toBe(first.onDragEnd);

    // The collision modifier still sees the current tracks.
    const descriptor = (dndProps.modifiers as Array<{ options?: { tracks: unknown } }>).find(
      (entry) => (entry as { plugin?: unknown }).plugin === ClipCollisionModifier
    );
    const tracksOption = descriptor?.options?.tracks;
    expect(typeof tracksOption).toBe('function');
    expect((tracksOption as () => ClipTrack[])()).toBe(nextTracks);
  });
});

describe('ClipInteractionProvider: the track-reorder preview', () => {
  it('follows drag-overs only between the start and the end of a reorder drag', () => {
    // dnd-kit can send one more dragover after the dragend of a canceled
    // drag; it must not set the preview again (#687).
    const previews: unknown[] = [];
    const setTrackDragPreview = vi.fn((update: unknown) => {
      previews.push(typeof update === 'function' ? (update as (p: null) => unknown)(null) : update);
    });
    playlistData = {
      samplesPerPixel: 1000,
      sampleRate: SAMPLE_RATE,
      playoutRef: { current: null },
      isDraggingRef: { current: false },
      onTracksChange: () => {},
      tracks: makeTracks(),
    };
    playlistControls.setTrackDragPreview.mockImplementation(setTrackDragPreview);
    render(
      <ClipInteractionProvider>
        <div />
      </ClipInteractionProvider>
    );
    const event = (index: number, canceled = false) => ({
      canceled,
      operation: {
        source: {
          data: { kind: 'track-reorder', trackId: 't1' },
          sortable: { index, initialIndex: 0 },
        },
      },
    });
    const over = dndProps.onDragOver as (e: unknown) => void;
    const start = dndProps.onDragStart as (e: unknown) => void;
    const end = dndProps.onDragEnd as (e: unknown) => void;

    over(event(1));
    expect(previews).toEqual([]);

    start(event(0));
    over(event(1));
    expect(previews).toEqual([{ trackId: 't1', toIndex: 1 }]);

    end(event(1, true));
    expect(previews).toEqual([{ trackId: 't1', toIndex: 1 }, null]);

    // The late one.
    over(event(0));
    expect(previews).toEqual([{ trackId: 't1', toIndex: 1 }, null]);
  });
});

describe('useKeyboardShortcuts', () => {
  const keydownRegistrations = (spy: { mock: { calls: unknown[][] } }) =>
    spy.mock.calls.filter(([type]) => type === 'keydown').length;

  it('subscribes once, however often the shortcuts array is rebuilt', () => {
    const add = vi.spyOn(window, 'addEventListener');
    const remove = vi.spyOn(window, 'removeEventListener');
    const first = vi.fn();
    const latest = vi.fn();
    const shortcut = (action: () => void): KeyboardShortcut[] => [{ key: 'k', action }];

    const { rerender } = renderHook(
      ({ action }: { action: () => void }) => useKeyboardShortcuts({ shortcuts: shortcut(action) }),
      { initialProps: { action: first } }
    );
    rerender({ action: first });
    rerender({ action: latest });

    expect(keydownRegistrations(add)).toBe(1);
    expect(keydownRegistrations(remove)).toBe(0);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));
    expect(first).not.toHaveBeenCalled();
    expect(latest).toHaveBeenCalledTimes(1);
  });

  it('listens only while enabled', () => {
    const action = vi.fn();
    const shortcuts: KeyboardShortcut[] = [{ key: 'k', action }];
    const press = () =>
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', bubbles: true }));

    const { rerender, unmount } = renderHook(
      ({ enabled }: { enabled: boolean }) => useKeyboardShortcuts({ shortcuts, enabled }),
      { initialProps: { enabled: false } }
    );
    press();
    expect(action).not.toHaveBeenCalled();

    rerender({ enabled: true });
    press();
    expect(action).toHaveBeenCalledTimes(1);

    rerender({ enabled: false });
    press();
    unmount();
    press();
    expect(action).toHaveBeenCalledTimes(1);
  });
});
