// @vitest-environment jsdom
//
// Selection, loop, track selection and zoom calls made while there is no
// engine (#826).
//
// Until #826 the engine owned these values while it lived. It is null from a
// dispose until the next adapter resolves (a new `effects` function, other
// zoom levels), and on a mount until the first adapter arrives. A call in
// that window used to be `engineRef.current?.…`: dropped, with nothing said.
// The provider's hooks own them now and hand them to the engine there is.
//
// The provider is mounted with one recording adapter per build; `holdNext()`
// keeps a build open, as the default engine's dynamic import does.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import {
  renderWithArrangement,
  testArrangement,
  type ArrangementRender,
} from './helpers/arrangementProvider';
import {
  useArrangement,
  useEditorControls,
  useEngineRefs,
  useLoop,
  usePlaybackControls,
  usePlaylistMixer,
  usePlaylistTimeline,
  usePlaylistZoom,
  useSelectedTrackId,
  useSelection,
} from '../contexts/playlistContexts';
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';
import type { PlaylistEngine } from '@waveform-playlist/engine';
import type { EffectsFunction } from '@waveform-playlist/playout';

const SAMPLE_RATE = 48000;

function makeTrack(id: string): ClipTrack {
  const clip = {
    id: `${id}-clip`,
    startSample: 0,
    durationSamples: 10 * SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
  return {
    id,
    name: id,
    clips: [clip],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

type Probe = ReturnType<typeof useSelection> &
  ReturnType<typeof useLoop> &
  ReturnType<typeof usePlaylistZoom> &
  ReturnType<typeof useSelectedTrackId> &
  Pick<ReturnType<typeof usePlaybackControls>, 'setSelection' | 'play'> &
  Pick<
    ReturnType<typeof useEditorControls>,
    | 'setLoopEnabled'
    | 'setLoopRegion'
    | 'clearLoopRegion'
    | 'setSelectedTrackId'
    | 'zoomIn'
    | 'zoomOut'
    | 'setMasterVolume'
  > & {
    masterVolume: number;
    isReady: boolean;
    arrangement: ReturnType<typeof useArrangement>;
    engine: () => PlaylistEngine | null;
  };

let probe: Probe;

const ProbeChild: React.FC = () => {
  const selection = useSelection();
  const loop = useLoop();
  const zoom = usePlaylistZoom();
  const selectedTrack = useSelectedTrackId();
  const { setSelection, play } = usePlaybackControls();
  const {
    setLoopEnabled,
    setLoopRegion,
    clearLoopRegion,
    setSelectedTrackId,
    zoomIn,
    zoomOut,
    setMasterVolume,
  } = useEditorControls();
  const { masterVolume } = usePlaylistMixer();
  const { isReady } = usePlaylistTimeline();
  const arrangement = useArrangement();
  const { playoutRef } = useEngineRefs();
  probe = {
    arrangement,
    engine: () => playoutRef.current,
    ...selection,
    ...loop,
    ...zoom,
    ...selectedTrack,
    setSelection,
    play,
    setLoopEnabled,
    setLoopRegion,
    clearLoopRegion,
    setSelectedTrackId,
    zoomIn,
    zoomOut,
    setMasterVolume,
    masterVolume,
    isReady,
  };
  return null;
};

const firstEffects: EffectsFunction = () => undefined;
const changedEffects: EffectsFunction = () => undefined;

const settle = (ms = 30) => new Promise<void>((resolve) => setTimeout(resolve, ms));

async function mountReady(): Promise<ArrangementRender> {
  const view = renderWithArrangement([makeTrack('track-a'), makeTrack('track-b')], {
    effects: firstEffects,
    children: <ProbeChild />,
  });
  await waitFor(() => expect(probe.isReady).toBe(true));
  expect(view.adapters).toHaveLength(1);
  return view;
}

/** New effects: the old engine is disposed, the next one waits for `open()`. */
function startHeldRebuild(view: ArrangementRender): () => Promise<void> {
  const gate = view.factory.holdNext();
  act(() => {
    view.update({ effects: changedEffects });
  });
  expect(view.adapters[0].disposed).toBe(true);
  expect(view.adapters).toHaveLength(2);
  expect(probe.isReady).toBe(false);
  return async () => {
    await act(async () => {
      gate.open();
      await settle();
    });
    expect(probe.isReady).toBe(true);
  };
}

describe('calls made while the engine is being rebuilt (#826)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(async () => {
    await act(async () => {
      cleanup();
    });
    vi.restoreAllMocks();
  });

  it('setSelection is kept: shown at once and still there on the new engine', async () => {
    const view = await mountReady();
    act(() => probe.setSelection(1, 2));
    expect([probe.selectionStart, probe.selectionEnd]).toEqual([1, 2]);

    const finishBuild = startHeldRebuild(view);
    act(() => probe.setSelection(5, 7));
    expect([probe.selectionStart, probe.selectionEnd]).toEqual([5, 7]);

    await finishBuild();
    expect([probe.selectionStart, probe.selectionEnd]).toEqual([5, 7]);
  });

  it('setSelection puts the ends in order, as the engine does', async () => {
    const view = await mountReady();
    const finishBuild = startHeldRebuild(view);
    act(() => probe.setSelection(7, 5));
    expect([probe.selectionStart, probe.selectionEnd]).toEqual([5, 7]);
    await finishBuild();
    expect([probe.selectionStart, probe.selectionEnd]).toEqual([5, 7]);
  });

  it('the loop region and the loop switch are kept and reach the new adapter', async () => {
    const view = await mountReady();
    const finishBuild = startHeldRebuild(view);
    act(() => {
      probe.setLoopRegion(4, 2);
      probe.setLoopEnabled(true);
    });
    expect([probe.loopStart, probe.loopEnd, probe.isLoopEnabled]).toEqual([2, 4, true]);

    await finishBuild();
    expect([probe.loopStart, probe.loopEnd, probe.isLoopEnabled]).toEqual([2, 4, true]);
    const loopCalls = view.adapters[1].calls.filter((call) => call.method === 'setLoop');
    expect(loopCalls[loopCalls.length - 1].args).toEqual([true, 2, 4]);
  });

  it('switching the loop off and clearing its region are kept', async () => {
    const view = await mountReady();
    act(() => {
      probe.setLoopRegion(2, 4);
      probe.setLoopEnabled(true);
    });
    expect([probe.loopStart, probe.loopEnd, probe.isLoopEnabled]).toEqual([2, 4, true]);

    const finishBuild = startHeldRebuild(view);
    act(() => {
      probe.setLoopEnabled(false);
      probe.clearLoopRegion();
    });
    expect([probe.loopStart, probe.loopEnd, probe.isLoopEnabled]).toEqual([0, 0, false]);

    await finishBuild();
    expect([probe.loopStart, probe.loopEnd, probe.isLoopEnabled]).toEqual([0, 0, false]);
  });

  it('setSelectedTrackId is kept, also back to none', async () => {
    const view = await mountReady();
    act(() => probe.setSelectedTrackId('track-a'));
    expect(probe.selectedTrackId).toBe('track-a');

    let finishBuild = startHeldRebuild(view);
    act(() => probe.setSelectedTrackId('track-b'));
    expect(probe.selectedTrackId).toBe('track-b');
    await finishBuild();
    expect(probe.selectedTrackId).toBe('track-b');

    const gate = view.factory.holdNext();
    act(() => view.update({ effects: firstEffects }));
    finishBuild = async () => {
      await act(async () => {
        gate.open();
        await settle();
      });
    };
    act(() => probe.setSelectedTrackId(null));
    expect(probe.selectedTrackId).toBeNull();
    await finishBuild();
    expect(probe.selectedTrackId).toBeNull();
  });

  it('zoomIn and zoomOut step through the levels and the new engine starts there', async () => {
    const view = await mountReady();
    expect(probe.samplesPerPixel).toBe(1024);

    const finishBuild = startHeldRebuild(view);
    act(() => probe.zoomIn());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(512));
    act(() => probe.zoomIn());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(256));
    expect(probe.canZoomIn).toBe(false);
    // Already at the smallest level: nothing more to do.
    act(() => probe.zoomIn());
    act(() => probe.zoomOut());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(512));
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([true, true]);

    await finishBuild();
    expect(probe.samplesPerPixel).toBe(512);
    // The engine agrees: one more step from 512 is 256.
    act(() => probe.zoomIn());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(256));
  });

  it('zoom steps through the zoomLevels prop, not the default levels', async () => {
    const view = renderWithArrangement([makeTrack('track-a')], {
      effects: firstEffects,
      zoomLevels: [100, 1000, 3000],
      samplesPerPixel: 1000,
      children: <ProbeChild />,
    });
    await waitFor(() => expect(probe.isReady).toBe(true));

    const finishBuild = startHeldRebuild(view);
    act(() => probe.zoomOut());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(3000));
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([true, false]);
    await finishBuild();
    expect(probe.samplesPerPixel).toBe(3000);
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([true, false]);
  });

  it('calls before the first engine of a mount are kept too', async () => {
    const tracks = [makeTrack('track-a')];
    // Hold the first build: the factory is made by the helper, so the gate
    // is taken through a createAdapter of this test.
    let open!: () => void;
    const held = new Promise<void>((resolve) => {
      open = resolve;
    });
    const { recordingAdapter } = await import('./helpers/arrangementProvider');
    const adapter = recordingAdapter();
    renderWithArrangement(tracks, {
      createAdapter: () => held.then(() => adapter) as unknown as typeof adapter,
      children: <ProbeChild />,
    });
    expect(probe.isReady).toBe(false);

    act(() => {
      probe.setSelection(3, 6);
      probe.setSelectedTrackId('track-a');
      probe.setLoopRegion(1, 2);
      probe.zoomOut();
    });
    expect([probe.selectionStart, probe.selectionEnd]).toEqual([3, 6]);

    await act(async () => {
      open();
      await settle();
    });
    await waitFor(() => expect(probe.isReady).toBe(true));
    expect([probe.selectionStart, probe.selectionEnd]).toEqual([3, 6]);
    expect(probe.selectedTrackId).toBe('track-a');
    expect([probe.loopStart, probe.loopEnd]).toEqual([1, 2]);
    expect(probe.samplesPerPixel).toBe(2048);
  });

  it('other zoom levels: the steps that are possible follow the new levels', async () => {
    const view = renderWithArrangement([makeTrack('track-a')], {
      zoomLevels: [512, 1024, 2048],
      children: <ProbeChild />,
    });
    await waitFor(() => expect(probe.isReady).toBe(true));
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([true, true]);

    const gate = view.factory.holdNext();
    act(() => view.update({ zoomLevels: [1024, 2048] }));
    // Known before the new engine exists.
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([false, true]);
    await act(async () => {
      gate.open();
      await settle();
    });
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([false, true]);
  });

  it('removing the selected track selects nothing, with an engine', async () => {
    await mountReady();
    act(() => probe.setSelectedTrackId('track-b'));
    expect(probe.selectedTrackId).toBe('track-b');
    act(() => probe.arrangement.removeTrack('track-b'));
    expect(probe.selectedTrackId).toBeNull();
    act(() => probe.arrangement.undo());
    expect(probe.selectedTrackId).toBeNull();
  });

  it('setTracks that drops the selected track keeps the id, as the engine does', async () => {
    await mountReady();
    act(() => probe.setSelectedTrackId('track-b'));
    const tracks = probe.arrangement.getTracks();
    // A host empties the tracks and adds them again.
    act(() => probe.arrangement.setTracks([]));
    expect(probe.selectedTrackId).toBe('track-b');
    expect(probe.engine()!.getState().selectedTrackId).toBe('track-b');
    act(() => probe.arrangement.setTracks(tracks));
    expect(probe.selectedTrackId).toBe('track-b');
  });

  it('a track change that keeps the selected track keeps the selection', async () => {
    await mountReady();
    act(() => probe.setSelectedTrackId('track-b'));
    act(() => probe.arrangement.removeTrack('track-a'));
    expect(probe.selectedTrackId).toBe('track-b');
    act(() => probe.arrangement.undo());
    expect(probe.selectedTrackId).toBe('track-b');
  });

  it('removing the selected track while no engine exists selects nothing on the next one', async () => {
    const view = await mountReady();
    act(() => probe.setSelectedTrackId('track-b'));
    const finishBuild = startHeldRebuild(view);
    act(() => probe.arrangement.removeTrack('track-b'));
    expect(probe.selectedTrackId).toBeNull();
    await finishBuild();
    expect(probe.selectedTrackId).toBeNull();
    expect(probe.engine()!.getState().selectedTrackId).toBeNull();
  });

  it('the engine there is holds what the setters were given', async () => {
    await mountReady();
    act(() => {
      probe.setSelection(1, 2);
      probe.setLoopRegion(3, 4);
      probe.setLoopEnabled(true);
      probe.setSelectedTrackId('track-a');
      probe.zoomIn();
      probe.setMasterVolume(0.25);
    });
    expect(probe.engine()!.getState()).toMatchObject({
      masterVolume: 0.25,
      selectionStart: 1,
      selectionEnd: 2,
      loopStart: 3,
      loopEnd: 4,
      isLoopEnabled: true,
      selectedTrackId: 'track-a',
      samplesPerPixel: 512,
    });
  });

  it('setMasterVolume is kept and reaches the new adapter', async () => {
    const view = await mountReady();
    const finishBuild = startHeldRebuild(view);
    act(() => probe.setMasterVolume(0.4));
    expect(probe.masterVolume).toBe(0.4);
    await finishBuild();
    expect(probe.masterVolume).toBe(0.4);
    const volumeCalls = view.adapters[1].calls.filter((call) => call.method === 'setMasterVolume');
    expect(volumeCalls[volumeCalls.length - 1].args).toEqual([0.4]);
  });

  it('zoom steps by place in zoomLevels: a level given twice is two places', async () => {
    renderWithArrangement([makeTrack('track-a')], {
      zoomLevels: [512, 1024, 1024, 2048],
      samplesPerPixel: 512,
      children: <ProbeChild />,
    });
    await waitFor(() => expect(probe.isReady).toBe(true));
    act(() => probe.zoomOut());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(1024));
    // The second place holds the same level: the step changes no level.
    act(() => probe.zoomOut());
    await act(() => settle());
    expect(probe.samplesPerPixel).toBe(1024);
    expect(probe.canZoomOut).toBe(true);
    act(() => probe.zoomOut());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(2048));
    expect(probe.canZoomOut).toBe(false);
    expect(probe.engine()!.getState().samplesPerPixel).toBe(2048);
    act(() => probe.zoomIn());
    act(() => probe.zoomIn());
    act(() => probe.zoomIn());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(512));
    expect(probe.canZoomIn).toBe(false);
  });

  it('every place of unsorted, repeated zoomLevels is reached, in order', async () => {
    renderWithArrangement([makeTrack('track-a')], {
      zoomLevels: [1024, 512, 1024, 2048],
      samplesPerPixel: 1024,
      children: <ProbeChild />,
    });
    await waitFor(() => expect(probe.isReady).toBe(true));
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([false, true]);
    act(() => probe.zoomOut());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(512));
    act(() => probe.zoomOut());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(1024));
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([true, true]);
    act(() => probe.zoomOut());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(2048));
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([true, false]);
    act(() => probe.zoomIn());
    act(() => probe.zoomIn());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(512));
    act(() => probe.zoomIn());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(1024));
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([false, true]);
  });

  it('a level given twice at the end: the last place is the end', async () => {
    renderWithArrangement([makeTrack('track-a')], {
      zoomLevels: [512, 1024, 1024],
      samplesPerPixel: 512,
      children: <ProbeChild />,
    });
    await waitFor(() => expect(probe.isReady).toBe(true));
    act(() => probe.zoomOut());
    await waitFor(() => expect(probe.samplesPerPixel).toBe(1024));
    await waitFor(() => expect(probe.canZoomOut).toBe(true));
    act(() => probe.zoomOut());
    await waitFor(() => expect(probe.canZoomOut).toBe(false));
    expect(probe.samplesPerPixel).toBe(1024);
  });

  it('a level that is not one of zoomLevels has no step in either direction', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const onError = vi.fn();
    renderWithArrangement([makeTrack('track-a')], {
      samplesPerPixel: 1000,
      onError,
      children: <ProbeChild />,
    });
    // No engine can be built for it: the build fails and says so.
    await waitFor(() => expect(onError).toHaveBeenCalledTimes(1));
    expect([probe.canZoomIn, probe.canZoomOut]).toEqual([false, false]);
    act(() => {
      probe.zoomIn();
      probe.zoomOut();
    });
    expect(probe.samplesPerPixel).toBe(1000);
  });

  it('a selected track that is given a new id is no longer selected', async () => {
    await mountReady();
    act(() => probe.setSelectedTrackId('track-b'));
    act(() => probe.arrangement.updateTrack('track-b', makeTrack('track-c')));
    expect(probe.selectedTrackId).toBeNull();
    expect(probe.engine()!.getState().selectedTrackId).toBeNull();
  });

  it('an undo that takes the selected track away selects nothing', async () => {
    await mountReady();
    act(() => probe.arrangement.addTrack(makeTrack('track-c')));
    act(() => probe.setSelectedTrackId('track-c'));
    act(() => probe.arrangement.undo());
    expect(probe.selectedTrackId).toBeNull();
    act(() => probe.arrangement.redo());
    expect(probe.selectedTrackId).toBeNull();
  });

  it('an arrangement that does not say what changed: a removed selected track is still cleared', async () => {
    // An arrangement made by an older copy of the engine package calls its
    // subscribers with no argument.
    const arrangement = testArrangement([makeTrack('track-a'), makeTrack('track-b')]);
    const subscribe = arrangement.subscribe.bind(arrangement);
    vi.spyOn(arrangement, 'subscribe').mockImplementation((listener) =>
      subscribe(() => (listener as () => void)())
    );
    renderWithArrangement([], { arrangement, children: <ProbeChild /> });
    await waitFor(() => expect(probe.isReady).toBe(true));
    act(() => probe.setSelectedTrackId('track-b'));
    act(() => arrangement.removeTrack('track-b'));
    expect(probe.selectedTrackId).toBeNull();
    // The listener did not throw (a subscriber that throws is reported so).
    expect(console.warn).not.toHaveBeenCalledWith(
      expect.stringContaining('arrangement subscriber'),
      expect.anything()
    );
  });

  it('a play queued behind the rebuild plays the range the highlight shows', async () => {
    const view = await mountReady();
    act(() => probe.setSelection(1, 2));
    await act(async () => {
      await probe.play();
    });

    const finishBuild = startHeldRebuild(view);
    act(() => probe.setSelection(5, 7));
    expect([probe.selectionStart, probe.selectionEnd]).toEqual([5, 7]);
    await finishBuild();

    expect([probe.selectionStart, probe.selectionEnd]).toEqual([5, 7]);
    const plays = view.adapters[1].calls.filter((call) => call.method === 'play');
    expect(plays[plays.length - 1].args).toEqual([5, 7]);
  });
});
