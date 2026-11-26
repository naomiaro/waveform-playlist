// @vitest-environment jsdom
//
// #687: the provider keeps the mixer state by track id.
//
// Until then `trackStates` was an array by position and the mixer setters took
// an index. Removing a track re-created the array from the `ClipTrack` fields
// (every remaining track lost its mute, solo, volume and pan in the panel),
// while the new engine was seeded from the OLD array by index (so the audio
// got the removed track's neighbour's values). Since #812 the mix by id is
// the arrangement's (its own rules are tested in the engine package); here:
// the setters' signature, and that the provider publishes each track's own
// values, also after a track is removed.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { TestProvider, testArrangement } from './helpers/arrangementProvider';
import {
  useEditorControls,
  usePlaylistTimeline,
  usePlaylistMixer,
  type EditorControlsContextValue,
} from '../contexts/playlistContexts';
import type { TrackState } from '../WaveformPlaylistContext';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeClip(id: string): AudioClip {
  return {
    id,
    startSample: 0,
    durationSamples: SAMPLE_RATE,
    offsetSamples: 0,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
}

function makeTrack(id: string): ClipTrack {
  return {
    id,
    name: id,
    clips: [makeClip(id + '-clip')],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack;
}

interface FakeAdapter extends PlayoutAdapter {
  builds: ClipTrack[][];
  calls: Array<[string, string, unknown]>;
  updates: Array<[string, ClipTrack]>;
  removed: string[];
}

function createFakeAdapter(): FakeAdapter {
  const builds: ClipTrack[][] = [];
  const calls: Array<[string, string, unknown]> = [];
  const updates: Array<[string, ClipTrack]> = [];
  const removed: string[] = [];
  return {
    builds,
    calls,
    updates,
    removed,
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    async init() {},
    setTracks(tracks: ClipTrack[]) {
      builds.push(tracks);
    },
    addTrack() {},
    removeTrack(id: string) {
      removed.push(id);
    },
    updateTrack(id: string, track: ClipTrack) {
      updates.push([id, track]);
    },
    play() {},
    pause() {},
    stop() {},
    seek() {},
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume() {},
    setTrackVolume: (id: string, value: number) => void calls.push(['volume', id, value]),
    setTrackMute: (id: string, value: boolean) => void calls.push(['mute', id, value]),
    setTrackSolo: (id: string, value: boolean) => void calls.push(['solo', id, value]),
    setTrackPan: (id: string, value: number) => void calls.push(['pan', id, value]),
    setLoop() {},
    dispose() {},
  } as unknown as FakeAdapter;
}

let probe: {
  tracks: readonly ClipTrack[];
  trackStates: TrackState[];
  isReady: boolean;
  controls: EditorControlsContextValue;
};

const ProbeChild: React.FC = () => {
  const { tracks, isReady } = usePlaylistTimeline();
  const { trackStates } = usePlaylistMixer();
  const controls = useEditorControls();
  probe = { tracks, trackStates, isReady, controls };
  return null;
};

function mount(initial: ClipTrack[]) {
  const adapter = createFakeAdapter();
  const arrangement = testArrangement(initial);
  render(
    <TestProvider arrangement={arrangement} sampleRate={SAMPLE_RATE} createAdapter={() => adapter}>
      <ProbeChild />
    </TestProvider>
  );
  return { adapter, arrangement };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('mixer setters take a track id', () => {
  it('changes the state of that track and tells the engine its id', async () => {
    const { adapter } = mount([makeTrack('a'), makeTrack('b'), makeTrack('c')]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    act(() => {
      probe.controls.setTrackMute('b', true);
      probe.controls.setTrackSolo('c', true);
      probe.controls.setTrackVolume('b', 0.25);
      probe.controls.setTrackPan('a', -0.5);
    });

    expect(probe.trackStates.map((s) => s.muted)).toEqual([false, true, false]);
    expect(probe.trackStates.map((s) => s.soloed)).toEqual([false, false, true]);
    expect(probe.trackStates.map((s) => s.volume)).toEqual([1, 0.25, 1]);
    expect(probe.trackStates.map((s) => s.pan)).toEqual([-0.5, 0, 0]);
    expect(adapter.calls).toEqual([
      ['mute', 'b', true],
      ['solo', 'c', true],
      ['volume', 'b', 0.25],
      ['pan', 'a', -0.5],
    ]);
  });

  it('passes the undo options on to the arrangement (#843)', async () => {
    const { arrangement } = mount([makeTrack('a')]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    const spies = {
      volume: vi.spyOn(arrangement, 'setTrackVolume'),
      mute: vi.spyOn(arrangement, 'setTrackMute'),
      solo: vi.spyOn(arrangement, 'setTrackSolo'),
      pan: vi.spyOn(arrangement, 'setTrackPan'),
    };
    const gesture = { gesture: 'g1' };
    const notAStep = { undoable: false } as const;

    act(() => {
      probe.controls.setTrackVolume('a', 0.5, gesture);
      probe.controls.setTrackMute('a', true, notAStep);
      probe.controls.setTrackSolo('a', true, gesture);
      probe.controls.setTrackPan('a', 0.5, notAStep);
    });

    expect(spies.volume.mock.calls).toEqual([['a', 0.5, gesture]]);
    expect(spies.mute.mock.calls).toEqual([['a', true, notAStep]]);
    expect(spies.solo.mock.calls).toEqual([['a', true, gesture]]);
    expect(spies.pan.mock.calls).toEqual([['a', 0.5, notAStep]]);
  });

  it('changes only the object of the track that was set', async () => {
    mount([makeTrack('a'), makeTrack('b')]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    const before = probe.trackStates;
    act(() => probe.controls.setTrackVolume('b', 0.5));
    expect(probe.trackStates[0]).toBe(before[0]);
    expect(probe.trackStates[1]).not.toBe(before[1]);
  });

  it('ignores an index left over from the old signature and says so once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { adapter } = mount([makeTrack('a'), makeTrack('b')]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    const before = probe.trackStates;

    act(() => {
      (probe.controls.setTrackMute as unknown as (i: number, m: boolean) => void)(0, true);
      (probe.controls.setTrackMute as unknown as (i: number, m: boolean) => void)(1, true);
    });

    expect(probe.trackStates).toBe(before);
    expect(adapter.calls).toEqual([]);
    const messages = warn.mock.calls.map((call) => String(call[0]));
    const about = messages.filter((m) => m.includes('setTrackMute') && m.includes('track id'));
    expect(about).toHaveLength(1);
  });

  it('ignores an id that no track has', async () => {
    const { adapter } = mount([makeTrack('a')]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    const before = probe.trackStates;
    act(() => probe.controls.setTrackMute('nobody', true));
    expect(probe.trackStates).toBe(before);
    expect(adapter.calls).toEqual([]);
  });
});

describe('a track keeps its mixer state when the list of tracks changes', () => {
  it('removing a track leaves the others as the user set them, in the panel and in the engine', async () => {
    const a = makeTrack('a');
    const b = makeTrack('b');
    const c = makeTrack('c');
    const { adapter, arrangement } = mount([a, b, c]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    act(() => {
      probe.controls.setTrackVolume('b', 0.3);
      probe.controls.setTrackMute('c', true);
      // The removed track's own values must not land on a neighbour.
      probe.controls.setTrackPan('a', 1);
      probe.controls.setTrackSolo('a', true);
    });
    const buildsBefore = adapter.builds.length;

    await act(async () => {
      arrangement.removeTrack('a');
    });

    expect(probe.tracks.map((t) => t.id)).toEqual(['b', 'c']);
    expect(probe.trackStates.map((s) => s.volume)).toEqual([0.3, 1]);
    expect(probe.trackStates.map((s) => s.muted)).toEqual([false, true]);
    expect(probe.trackStates.map((s) => s.pan)).toEqual([0, 0]);
    expect(probe.trackStates.map((s) => s.soloed)).toEqual([false, false]);
    // No rebuild: the running engine let go of the one track.
    expect(adapter.builds.length).toBe(buildsBefore);
    expect(adapter.removed).toEqual(['a']);
  });
});
