// @vitest-environment jsdom
//
// #704 close-out: `useDynamicTracks` appends an empty placeholder per dropped
// file and replaces it with the decoded track when the decode finishes. The
// array keeps its length, so the provider took that for a modification and
// disposed and rebuilt the whole engine once per file.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React from 'react';
import {
  WaveformPlaylistProvider,
  usePlaylistTimeline,
  usePlaylistMixer,
  useUndoRedo,
} from '../WaveformPlaylistContext';
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

function makeTrack(id: string, name: string, clips: AudioClip[]): ClipTrack {
  return { id, name, clips, muted: false, soloed: false, volume: 1, pan: 0 } as ClipTrack;
}

function createFakeAdapter() {
  return {
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    init: vi.fn(async () => {}),
    setTracks: vi.fn(),
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    updateTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    getCurrentTime: () => 0,
    isPlaying: () => false,
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  };
}

let probe: {
  trackStates: { name: string; volume: number }[];
  isReady: boolean;
  canUndo: boolean;
};

const ProbeChild: React.FC = () => {
  const { isReady } = usePlaylistTimeline();
  const { trackStates } = usePlaylistMixer();
  const { canUndo } = useUndoRedo();
  probe = { trackStates, isReady, canUndo };
  return null;
};

function mount(initial: ClipTrack[]) {
  const adapter = createFakeAdapter();
  const createAdapter = vi.fn(() => adapter as unknown as PlayoutAdapter);
  const onTracksChange = vi.fn();
  const ui = (tracks: ClipTrack[]) => (
    <WaveformPlaylistProvider
      tracks={tracks}
      onTracksChange={onTracksChange}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
    >
      <ProbeChild />
    </WaveformPlaylistProvider>
  );
  const view = render(ui(initial));
  return {
    adapter,
    createAdapter,
    onTracksChange,
    setTracks: (tracks: ClipTrack[]) => view.rerender(ui(tracks)),
  };
}

describe('a placeholder track that gets its clips', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it('is applied to the running engine without a rebuild', async () => {
    const loaded = makeTrack('t1', 'Drums', [makeClip('c1')]);
    const placeholder = makeTrack('t2', 'Guitar (loading...)', []);
    const { adapter, createAdapter, onTracksChange, setTracks } = mount([loaded, placeholder]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    expect(createAdapter).toHaveBeenCalledTimes(1);
    adapter.setTracks.mockClear();
    onTracksChange.mockClear();

    const filled = { ...placeholder, name: 'Guitar', clips: [makeClip('c2')] } as ClipTrack;
    await act(async () => {
      setTracks([loaded, filled]);
    });

    expect(createAdapter).toHaveBeenCalledTimes(1);
    expect(adapter.dispose).not.toHaveBeenCalled();
    expect(adapter.setTracks).not.toHaveBeenCalled();
    expect(adapter.updateTrack).toHaveBeenCalledTimes(1);
    expect(adapter.updateTrack.mock.calls[0][0]).toBe('t2');
    expect(adapter.updateTrack.mock.calls[0][1].clips).toHaveLength(1);
    expect(probe.isReady).toBe(true);
    // The name shown in the controls follows the track.
    expect(probe.trackStates.map((s) => s.name)).toEqual(['Drums', 'Guitar']);
    // The parent already has these tracks: nothing is echoed back to it.
    expect(onTracksChange).not.toHaveBeenCalled();
  });

  it('keeps the mixer state the engine track is given in step with the UI', async () => {
    const placeholder = makeTrack('t1', 'Guitar (loading...)', []);
    const { adapter, setTracks } = mount([placeholder]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    const filled = { ...placeholder, name: 'Guitar', clips: [makeClip('c1')] } as ClipTrack;
    await act(async () => {
      setTracks([filled]);
    });

    expect(adapter.updateTrack.mock.calls[0][1]).toMatchObject({ volume: 1, muted: false, pan: 0 });
  });

  // "The audio arrived" is not a step to undo back to an empty placeholder.
  it('leaves nothing to undo', async () => {
    const placeholder = makeTrack('t1', 'Guitar (loading...)', []);
    const { setTracks } = mount([placeholder]);
    await waitFor(() => expect(probe.isReady).toBe(true));

    await act(async () => {
      setTracks([{ ...placeholder, name: 'Guitar', clips: [makeClip('c1')] } as ClipTrack]);
    });

    expect(probe.canUndo).toBe(false);
  });

  // An added track is mirrored to the parent. What is mirrored must already
  // hold the filled track, or a parent that stores it loses the fill.
  it('a fill and an add in one change mirror the filled track, not the placeholder', async () => {
    const loaded = makeTrack('t1', 'Drums', [makeClip('c1')]);
    const placeholder = makeTrack('t2', 'Guitar (loading...)', []);
    const { adapter, onTracksChange, setTracks } = mount([loaded, placeholder]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    adapter.setTracks.mockClear();
    onTracksChange.mockClear();

    const filled = { ...placeholder, name: 'Guitar', clips: [makeClip('c2')] } as ClipTrack;
    await act(async () => {
      setTracks([loaded, filled, makeTrack('t3', 'Bass', [])]);
    });

    expect(adapter.setTracks).not.toHaveBeenCalled();
    const mirrored = onTracksChange.mock.lastCall?.[0] as ClipTrack[];
    expect(mirrored.map((t) => t.id)).toEqual(['t1', 't2', 't3']);
    expect(mirrored[1].name).toBe('Guitar');
    expect(mirrored[1].clips).toHaveLength(1);
  });

  it('still rebuilds when a track that has clips is replaced', async () => {
    const loaded = makeTrack('t1', 'Drums', [makeClip('c1')]);
    const { adapter, setTracks } = mount([loaded]);
    await waitFor(() => expect(probe.isReady).toBe(true));
    adapter.setTracks.mockClear();

    await act(async () => {
      setTracks([{ ...loaded, clips: [makeClip('c1'), makeClip('c3')] } as ClipTrack]);
    });

    await waitFor(() => expect(adapter.setTracks).toHaveBeenCalled());
    expect(adapter.updateTrack).not.toHaveBeenCalled();
  });
});
