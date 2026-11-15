// @vitest-environment jsdom
//
// #812: `clipIndex` in the drag data is the clip's position in the DRAWN row,
// which from the next change can include placeholders for clips that are still
// loading. Split and the clip drags find a clip by its id, never by
// `track.clips[clipIndex]`.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import React, { startTransition } from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, act, cleanup } from '@testing-library/react';
import { createValueSource } from '@waveform-playlist/core';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlaylistEngine } from '@waveform-playlist/engine';

const SAMPLE_RATE = 48000;

let selectedTrackId: string | null = 'track-1';
let currentTime = 0;
vi.mock('../contexts/playlistContexts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../contexts/playlistContexts')>()),
  usePlaylistView: () => ({ sampleRate: SAMPLE_RATE }),
  usePlaybackRefs: () => ({ currentTimeRef: { current: currentTime } }),
  useSelectedTrackId: () => ({ selectedTrackId }),
}));

import { useClipDragHandlers } from '../hooks/useClipDragHandlers';
import { useClipSplitting } from '../hooks/useClipSplitting';
import { TrimPreviewContext } from '../contexts/playlistContexts';
import type { TrimPreview } from '../providerInternals/useTrimPreview';
import { ClipCollisionModifier } from '../modifiers/ClipCollisionModifier';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  selectedTrackId = 'track-1';
  currentTime = 0;
});

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

// a (0..1 s), b (2..4 s), c (6..7 s), stored in that order
function makeTracks(): ClipTrack[] {
  return [
    {
      id: 'track-1',
      name: 'Track 1',
      clips: [
        clip('a', 0, SAMPLE_RATE),
        clip('b', 2 * SAMPLE_RATE, 2 * SAMPLE_RATE),
        clip('c', 6 * SAMPLE_RATE, SAMPLE_RATE),
      ],
    } as ClipTrack,
  ];
}

function fakeEngine() {
  return {
    constrainTrimDelta: vi.fn((_t: string, _c: string, _b: string, delta: number) => delta),
    trimClip: vi.fn(),
    moveClip: vi.fn(),
    splitClip: vi.fn(),
  };
}

describe('splitClipAt by ids', () => {
  function setup() {
    const engine = fakeEngine();
    const engineRef = { current: engine as unknown as PlaylistEngine };
    const tracks = makeTracks();
    const { result } = renderHook(() =>
      useClipSplitting({ tracks, samplesPerPixel: 1000, engineRef })
    );
    return { engine, result, tracks };
  }

  it('splits the named clip when it is not the first of its track', () => {
    const { engine, result } = setup();
    expect(result.current.splitClipAt('track-1', 'b', 3)).toBe(true);
    expect(engine.splitClip).toHaveBeenCalledTimes(1);
    expect(engine.splitClip).toHaveBeenCalledWith('track-1', 'b', 3 * SAMPLE_RATE);
  });

  it('an unknown clip id returns false and changes nothing', () => {
    const { engine, result } = setup();
    expect(result.current.splitClipAt('track-1', 'nope', 3)).toBe(false);
    expect(engine.splitClip).not.toHaveBeenCalled();
  });

  it('an unknown track id returns false and changes nothing', () => {
    const { engine, result } = setup();
    expect(result.current.splitClipAt('nope', 'b', 3)).toBe(false);
    expect(engine.splitClip).not.toHaveBeenCalled();
  });

  it('says the split was dropped when no engine is attached', () => {
    const tracks = makeTracks();
    const engineRef = { current: null };
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() =>
      useClipSplitting({ tracks, samplesPerPixel: 1000, engineRef })
    );
    expect(result.current.splitClipAt('track-1', 'b', 3)).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('The split was dropped'));
  });

  it('the playhead split names the clip under the playhead on the selected track', () => {
    currentTime = 3;
    const { engine, result } = setup();
    expect(result.current.splitClipAtPlayhead()).toBe(true);
    expect(engine.splitClip).toHaveBeenCalledWith('track-1', 'b', 3 * SAMPLE_RATE);
  });
});

describe('a drag whose clipIndex does not match the clip', () => {
  function setup(tracks = makeTracks()) {
    const engine = fakeEngine();
    const engineRef = { current: engine as unknown as PlaylistEngine };
    const preview = createValueSource<TrimPreview | null>(null);
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <TrimPreviewContext value={preview}>{children}</TrimPreviewContext>
    );
    let current = tracks;
    const hook = renderHook(
      () => useClipDragHandlers({ tracks: current, samplesPerPixel: 1000, engineRef }),
      { wrapper }
    );
    const setTracks = (next: ClipTrack[]) => {
      current = next;
      hook.rerender();
    };
    return { hook, engine, setTracks, preview: () => preview.source.getSnapshot() };
  }

  // `b` is at index 1 of the track; the drag data says 0 (a placeholder row).
  function event(dx: number, data: Record<string, unknown>, canceled = false) {
    return {
      canceled,
      to: { x: 100 + dx, y: 0 },
      operation: {
        source: { data: { trackIndex: 0, clipIndex: 0, ...data } },
        position: { initial: { x: 100, y: 0 }, current: { x: 100, y: 0 } },
        transform: { x: dx, y: 0 },
      },
    } as never;
  }

  it('a trim still previews and trims the clip named by clipId', () => {
    const { hook, engine, preview } = setup();
    const data = { clipId: 'b', boundary: 'left' };
    hook.result.current.onDragStart(event(0, data));
    hook.result.current.onDragMove(event(-10, data));
    expect(preview()).toMatchObject({ clipId: 'b', startSample: 2 * SAMPLE_RATE - 10000 });
    hook.result.current.onDragEnd(event(-10, data));
    expect(engine.trimClip).toHaveBeenCalledWith('track-1', 'b', 'left', -10000);
  });

  it('a trim is held back by the neighbours of the clip named by clipId', () => {
    // b has plenty of audio before it, so only its neighbour a (ending at 1 s)
    // can stop a trim to the left: by 1 s, not by the 5 s of the pointer.
    const tracks = makeTracks();
    const [a, b, c] = tracks[0].clips;
    const roomy = { ...b, offsetSamples: 5 * SAMPLE_RATE, sourceDurationSamples: 8 * SAMPLE_RATE };
    const { hook, engine, preview } = setup([{ ...tracks[0], clips: [a, roomy, c] } as ClipTrack]);
    const data = { clipId: 'b', boundary: 'left' };
    hook.result.current.onDragStart(event(0, data));
    hook.result.current.onDragMove(event(-5000, data));
    expect(preview()).toMatchObject({ clipId: 'b', startSample: SAMPLE_RATE });
    hook.result.current.onDragEnd(event(-5000, data));
    expect(engine.trimClip).toHaveBeenCalledWith('track-1', 'b', 'left', -SAMPLE_RATE);
  });

  it('a trim of the right boundary is held back by the source of the clip named by clipId', () => {
    // b has 1 s of audio left after its end (c is 2 s away): the clip at
    // clipIndex 0 has other bounds.
    const tracks = makeTracks();
    const [a, b, c] = tracks[0].clips;
    const roomy = { ...b, offsetSamples: 5 * SAMPLE_RATE, sourceDurationSamples: 8 * SAMPLE_RATE };
    const { hook, engine, preview } = setup([{ ...tracks[0], clips: [a, roomy, c] } as ClipTrack]);
    const data = { clipId: 'b', boundary: 'right' };
    hook.result.current.onDragStart(event(0, data));
    hook.result.current.onDragMove(event(5000, data));
    expect(preview()).toMatchObject({ durationSamples: 3 * SAMPLE_RATE });
    hook.result.current.onDragEnd(event(5000, data));
    expect(engine.trimClip).toHaveBeenCalledWith('track-1', 'b', 'right', SAMPLE_RATE);
  });

  it('a trim follows a neighbour that is replaced mid-drag', () => {
    const tracks = makeTracks();
    const [a, b, c] = tracks[0].clips;
    const roomy = { ...b, offsetSamples: 5 * SAMPLE_RATE, sourceDurationSamples: 8 * SAMPLE_RATE };
    const { hook, setTracks, preview } = setup([
      { ...tracks[0], clips: [a, roomy, c] } as ClipTrack,
    ]);
    const data = { clipId: 'b', boundary: 'left' };
    hook.result.current.onDragStart(event(0, data));
    // a is replaced by a longer one, ending at 1.5 s: 0.5 s is left to trim.
    setTracks([
      {
        ...tracks[0],
        clips: [{ ...a, durationSamples: 1.5 * SAMPLE_RATE }, roomy, c],
      } as ClipTrack,
    ]);
    hook.result.current.onDragMove(event(-5000, data));
    expect(preview()).toMatchObject({ startSample: 1.5 * SAMPLE_RATE });
  });

  it('a move still moves the clip named by clipId', () => {
    const { hook, engine } = setup();
    const data = { clipId: 'b' };
    hook.result.current.onDragStart(event(0, data));
    hook.result.current.onDragEnd(event(5, data));
    expect(engine.moveClip).toHaveBeenCalledWith('track-1', 'b', 5000);
  });

  it('a trim of a clip id that is not in the track does nothing and does not throw', () => {
    const { hook, engine, preview } = setup();
    const data = { clipId: 'placeholder', boundary: 'left', clipIndex: 1 };
    expect(() => {
      hook.result.current.onDragStart(event(0, data));
      hook.result.current.onDragMove(event(-10, data));
      hook.result.current.onDragEnd(event(-10, data));
    }).not.toThrow();
    expect(preview()).toBeNull();
    expect(engine.constrainTrimDelta).not.toHaveBeenCalled();
    expect(engine.trimClip).not.toHaveBeenCalled();
  });
});

describe('a drag follows its clip and its track by id', () => {
  function setup(engine: ReturnType<typeof fakeEngine> | null = fakeEngine()) {
    const engineRef = { current: engine as unknown as PlaylistEngine | null };
    const preview = createValueSource<TrimPreview | null>(null);
    const wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
      <TrimPreviewContext value={preview}>{children}</TrimPreviewContext>
    );
    let current = makeTracks();
    const hook = renderHook(
      () => useClipDragHandlers({ tracks: current, samplesPerPixel: 1000, engineRef }),
      { wrapper }
    );
    const setTracks = (next: ClipTrack[]) => {
      current = next;
      hook.rerender();
    };
    type Name = 'onDragStart' | 'onDragMove' | 'onDragEnd';
    // As dnd-kit 0.5.0 calls them: move and end inside `startTransition`.
    const dispatch = (name: Name, e: never) =>
      act(() => {
        const handler = hook.result.current[name] as (e: never) => void;
        if (name === 'onDragStart') handler(e);
        else startTransition(() => handler(e));
      });
    return { engine, setTracks, dispatch, preview: () => preview.source.getSnapshot() };
  }

  function event(dx: number, data: Record<string, unknown>) {
    return {
      canceled: false,
      to: { x: 100 + dx, y: 0 },
      operation: {
        source: { data: { trackIndex: 0, clipIndex: 1, ...data } },
        position: { initial: { x: 100, y: 0 }, current: { x: 100, y: 0 } },
        transform: { x: dx, y: 0 },
      },
    } as never;
  }

  it("a trim keeps following the pointer when the track's row position changes mid-drag", () => {
    const { engine, setTracks, dispatch, preview } = setup();
    const data = { clipId: 'b', boundary: 'right' };
    dispatch('onDragStart', event(0, data));
    dispatch('onDragMove', event(-10, data));
    // Another track is put above it: track-1 is now the second row, and the
    // drag data still says row 0.
    const other = { id: 'track-0', name: 'Track 0', clips: [] } as unknown as ClipTrack;
    setTracks([other, ...makeTracks()]);
    dispatch('onDragMove', event(-20, data));
    expect(preview()).toMatchObject({
      trackId: 'track-1',
      clipId: 'b',
      durationSamples: 2 * SAMPLE_RATE - 20000,
    });
    dispatch('onDragEnd', event(-20, data));
    expect(engine!.trimClip).toHaveBeenCalledWith('track-1', 'b', 'right', -20000);
  });

  it('a move of a clip id that is not in the track makes no engine call', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { engine, dispatch } = setup();
    const data = { clipId: 'placeholder' };
    dispatch('onDragStart', event(0, data));
    dispatch('onDragEnd', event(5, data));
    expect(engine!.moveClip).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('The move was dropped'));
  });

  it('a move released while no engine is attached is dropped and warns', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { dispatch } = setup(null);
    const data = { clipId: 'b' };
    dispatch('onDragStart', event(0, data));
    dispatch('onDragEnd', event(5, data));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toMatch(/The move was dropped: no engine is attached/);
  });
});

describe('ClipCollisionModifier by id', () => {
  it('constrains the clip named by clipId, not the one at clipIndex', () => {
    const tracks = makeTracks();
    const modifier = new ClipCollisionModifier({} as never, { tracks, samplesPerPixel: 1000 });
    // b may move left by at most 1 s (a ends at 1 s, b starts at 2 s): 48 px.
    const op = (clipId: string) =>
      ({
        transform: { x: -500, y: 0 },
        source: { data: { clipId, trackIndex: 0, clipIndex: 0 } },
      }) as unknown as Parameters<ClipCollisionModifier['apply']>[0];
    expect(modifier.apply(op('b')).x).toBeCloseTo(-SAMPLE_RATE / 1000);
    // An id that is not in the track leaves the transform alone.
    expect(modifier.apply(op('placeholder')).x).toBe(-500);
  });
});
