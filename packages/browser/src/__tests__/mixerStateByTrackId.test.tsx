// @vitest-environment jsdom
//
// #687: the provider keeps the mixer state by track id.
//
// Until then `trackStates` was an array by position and the mixer setters took
// an index. Removing a track re-created the array from the `ClipTrack` fields
// (every remaining track lost its mute, solo, volume and pan in the panel),
// while the new engine was seeded from the OLD array by index (so the audio
// got the removed track's neighbour's values). Both are asserted here, with
// the setters' new signature.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import {
  useEditorControls,
  usePlaylistTimeline,
  usePlaylistMixer,
  type EditorControlsContextValue,
} from '../contexts/playlistContexts';
import type { TrackState } from '../WaveformPlaylistContext';
import type { ClipTrack, AudioClip, PlaylistTrack } from '@waveform-playlist/core';
import type { LoadSource } from '../utils/loadSource';
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
}

function createFakeAdapter(): FakeAdapter {
  const builds: ClipTrack[][] = [];
  const calls: Array<[string, string, unknown]> = [];
  const updates: Array<[string, ClipTrack]> = [];
  return {
    builds,
    calls,
    updates,
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
    removeTrack() {},
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
  tracks: ClipTrack[];
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

function mount(initial: PlaylistTrack[], props: { loadSource?: LoadSource } = {}) {
  const adapter = createFakeAdapter();
  let externalTracks = initial;
  let extra = props;
  const Wrapper: React.FC = () => (
    <WaveformPlaylistProvider
      tracks={externalTracks}
      onTracksChange={(next) => {
        externalTracks = next;
        rerender();
      }}
      sampleRate={SAMPLE_RATE}
      createAdapter={() => adapter}
      {...extra}
    >
      <ProbeChild />
    </WaveformPlaylistProvider>
  );
  const { rerender: doRerender } = render(<Wrapper />);
  const rerender = () => doRerender(<Wrapper />);
  return {
    adapter,
    setTracks: (next: PlaylistTrack[], nextProps = extra) => {
      externalTracks = next;
      extra = nextProps;
      rerender();
    },
  };
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
    const { adapter, setTracks } = mount([a, b, c]);
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
      setTracks([b, c]);
    });
    await waitFor(() => expect(probe.isReady).toBe(true));

    expect(probe.tracks.map((t) => t.id)).toEqual(['b', 'c']);
    expect(probe.trackStates.map((s) => s.volume)).toEqual([0.3, 1]);
    expect(probe.trackStates.map((s) => s.muted)).toEqual([false, true]);
    expect(probe.trackStates.map((s) => s.pan)).toEqual([0, 0]);
    expect(probe.trackStates.map((s) => s.soloed)).toEqual([false, false]);

    // What the rebuilt engine was given.
    expect(adapter.builds.length).toBeGreaterThan(buildsBefore);
    const built = adapter.builds[adapter.builds.length - 1];
    expect(built.map((t) => [t.id, t.volume, t.muted, t.pan, t.soloed])).toEqual([
      ['b', 0.3, false, 0, false],
      ['c', 1, true, 0, false],
    ]);
  });

  it('a track replaced by another one of the same count starts from its own fields', async () => {
    const a = makeTrack('a');
    const b = makeTrack('b');
    const { setTracks } = mount([a, b]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    act(() => probe.controls.setTrackMute('b', true));

    await act(async () => {
      setTracks([a, { ...makeTrack('z'), volume: 0.6 }]);
    });
    await waitFor(() => expect(probe.isReady).toBe(true));

    expect(probe.trackStates.map((s) => [s.name, s.muted, s.volume])).toEqual([
      ['a', false, 1],
      ['z', false, 0.6],
    ]);
  });

  it('tracks put in another order by the consumer: the rebuilt engine gets each track its own values', async () => {
    const a = makeTrack('a');
    const b = makeTrack('b');
    const { adapter, setTracks } = mount([a, b]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    act(() => {
      probe.controls.setTrackVolume('a', 0.3);
      probe.controls.setTrackMute('b', true);
    });

    await act(async () => {
      setTracks([b, a]);
    });
    await waitFor(() => expect(probe.isReady).toBe(true));

    expect(probe.trackStates.map((s) => [s.name, s.volume, s.muted])).toEqual([
      ['b', 1, true],
      ['a', 0.3, false],
    ]);
    const built = adapter.builds[adapter.builds.length - 1];
    expect(built.map((t) => [t.id, t.volume, t.muted])).toEqual([
      ['b', 1, true],
      ['a', 0.3, false],
    ]);
  });

  it('a placeholder that gets its clips is handed to the engine with what the user set on it', async () => {
    const a = makeTrack('a');
    const placeholder = { ...makeTrack('p'), name: 'p (loading...)', clips: [] } as ClipTrack;
    const { adapter, setTracks } = mount([a, placeholder]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    act(() => {
      probe.controls.setTrackMute('p', true);
      probe.controls.setTrackVolume('p', 0.2);
    });
    const buildsBefore = adapter.builds.length;

    await act(async () => {
      setTracks([a, { ...placeholder, name: 'p', clips: [makeClip('p-clip')] } as ClipTrack]);
    });

    // Applied to the running engine, not by a rebuild.
    expect(adapter.builds.length).toBe(buildsBefore);
    expect(adapter.updates).toHaveLength(1);
    expect(adapter.updates[0][0]).toBe('p');
    expect(adapter.updates[0][1]).toMatchObject({ muted: true, volume: 0.2 });
    expect(probe.trackStates[1]).toMatchObject({ name: 'p', muted: true, volume: 0.2 });
  });

  // A control: it passed before #687 too (a changed count re-created every
  // state), and it goes through a rebuild for 0 tracks, whose
  // `mixerForTracks(prev, [])` drops the entries. It pins the behaviour, not
  // the line that clears the map in the keep-the-engine branch.
  it('an emptied timeline forgets the mixer state: the same track added again starts from its fields', async () => {
    const a = makeTrack('a');
    const { setTracks } = mount([a]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    act(() => probe.controls.setTrackMute('a', true));
    expect(probe.trackStates[0].muted).toBe(true);

    await act(async () => {
      setTracks([]);
    });
    await act(async () => {
      setTracks([a]);
    });
    await waitFor(() => expect(probe.isReady).toBe(true));
    expect(probe.trackStates[0].muted).toBe(false);
  });

  it('new track objects with the same ids leave the published array alone', async () => {
    const a = makeTrack('a');
    const b = makeTrack('b');
    const { setTracks } = mount([a, b]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    const before = probe.trackStates;

    // What every move of a trim does: the same tracks as new objects.
    await act(async () => {
      setTracks([{ ...a }, { ...b }]);
    });
    await waitFor(() => expect(probe.isReady).toBe(true));
    expect(probe.trackStates).toBe(before);
  });

  // Until #812 this test put a new track in FRONT of a loaded one while the
  // engine rebuild was deferred (`deferEngineRebuild`), and saw `undefined`
  // beside the loaded track's own state. That mix cannot be reached through
  // the provider any more: after the first build nothing waits, and a new
  // track gets its state in the commit that brings it. (The pure function
  // still covers it: "leaves a track without state undefined, wherever it
  // is" in trackMixerState.test.ts.) What can be reached is the first load:
  // while a source the provider was mounted with is held back, no track has
  // an entry, each at its own position.
  it('a track the provider has not loaded yet has no entry, wherever it is in the list', async () => {
    const pending: Array<(buffer: AudioBuffer) => void> = [];
    const loadSource: LoadSource = () => new Promise((resolve) => pending.push(resolve));
    const loading = {
      ...makeTrack('new'),
      clips: [{ id: 'new-clip', src: '/new.mp3' }],
    } as PlaylistTrack;
    const a = makeTrack('a');
    // The loading track is in FRONT of the loaded one.
    mount([loading, a], { loadSource });
    await waitFor(() => expect(pending).toHaveLength(1));

    expect(probe.tracks.map((t) => t.id)).toEqual(['new', 'a']);
    expect(probe.isReady).toBe(false);
    expect(probe.trackStates).toHaveLength(2);
    expect(probe.trackStates[0]).toBeUndefined();
    expect(probe.trackStates[1]).toBeUndefined();

    await act(async () => {
      pending[0]({
        sampleRate: SAMPLE_RATE,
        length: SAMPLE_RATE,
        duration: 1,
        numberOfChannels: 1,
        getChannelData: () => new Float32Array(SAMPLE_RATE),
      } as unknown as AudioBuffer);
    });
    await waitFor(() => expect(probe.isReady).toBe(true));
    expect(probe.trackStates.map((s) => s.name)).toEqual(['new', 'a']);
  });
});
