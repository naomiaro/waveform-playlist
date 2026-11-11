// @vitest-environment jsdom
//
// #752: a track's effects reach the adapter through the provider's
// `trackEffects` prop (a lookup by track id), not through a field on the track
// object. Attaching the field meant copying every track on every `tracks`
// change, which defeated both of the provider's incremental paths: every clip
// move, trim, split and file drop disposed and rebuilt the whole engine.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, act, waitFor, cleanup } from '@testing-library/react';
import React, { useMemo, useState } from 'react';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { TrackEffectsFunction } from '@waveform-playlist/playout';
import type { PlaylistEngine } from '@waveform-playlist/engine';

const SAMPLE_RATE = 48000;

// The default (Tone) adapter path, with the engine package replaced by a
// counting fake: what the provider hands to createToneAdapter is the subject.
const h = vi.hoisted(() => {
  const makeAdapter = () => ({
    audioContext: { currentTime: 0, sampleRate: 48000, state: 'running', outputLatency: 0 },
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
  });
  const adapters: ReturnType<typeof makeAdapter>[] = [];
  const createToneAdapter = vi.fn((_options?: { trackEffects?: (id: string) => unknown }) => {
    const adapter = makeAdapter();
    adapters.push(adapter);
    return adapter;
  });
  return { adapters, createToneAdapter, configureGlobalContext: vi.fn(() => 48000) };
});

vi.mock('@waveform-playlist/playout', () => ({
  createToneAdapter: h.createToneAdapter,
  configureGlobalContext: h.configureGlobalContext,
}));

import { WaveformPlaylistProvider, usePlaylistData } from '../WaveformPlaylistContext';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

function makeClip(id: string, startSample = 0): AudioClip {
  return {
    id,
    startSample,
    durationSamples: SAMPLE_RATE * 4,
    offsetSamples: 0,
    sourceDurationSamples: SAMPLE_RATE * 4,
    sampleRate: SAMPLE_RATE,
  } as AudioClip;
}

function makeTrack(id: string, clips: AudioClip[]): ClipTrack {
  return { id, name: id, clips, muted: false, soloed: false, volume: 1, pan: 0 } as ClipTrack;
}

let engineRef: React.RefObject<PlaylistEngine | null>;
let isReady = false;
let setAppTracks: (update: (tracks: ClipTrack[]) => ClipTrack[]) => void;

const Probe: React.FC = () => {
  const data = usePlaylistData();
  engineRef = data.playoutRef;
  isReady = data.isReady;
  return null;
};

// What an app does: keep `tracks` in state, store what the provider reports.
// `copyTracks` is what apps did before #752 to attach `effects` to each track.
const App: React.FC<{
  trackEffects?: (trackId: string) => TrackEffectsFunction | undefined;
  copyTracks?: boolean;
}> = ({ trackEffects, copyTracks = false }) => {
  const [tracks, setTracks] = useState<ClipTrack[]>(() => [
    makeTrack('t1', [makeClip('c1')]),
    makeTrack('t2', [makeClip('c2', SAMPLE_RATE * 8)]),
  ]);
  setAppTracks = setTracks;
  const passed = useMemo(
    () => (copyTracks ? tracks.map((track) => ({ ...track })) : tracks),
    [tracks, copyTracks]
  );
  return (
    <WaveformPlaylistProvider
      tracks={passed}
      onTracksChange={setTracks}
      sampleRate={SAMPLE_RATE}
      trackEffects={trackEffects}
    >
      <Probe />
    </WaveformPlaylistProvider>
  );
};

const settle = () =>
  act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

const lookupGivenToAdapter = () => {
  const options = h.createToneAdapter.mock.lastCall![0];
  expect(options?.trackEffects).toBeTypeOf('function');
  return options!.trackEffects!;
};

describe('WaveformPlaylistProvider trackEffects', () => {
  beforeEach(() => {
    h.adapters.length = 0;
    h.createToneAdapter.mockClear();
    isReady = false;
  });

  afterEach(() => {
    cleanup();
  });

  it('gives the adapter a lookup that returns the function for a track id', async () => {
    const reverb: TrackEffectsFunction = () => undefined;
    const trackEffects = (trackId: string) => (trackId === 't1' ? reverb : undefined);
    render(<App trackEffects={trackEffects} />);
    await waitFor(() => expect(isReady).toBe(true));

    const lookup = lookupGivenToAdapter();
    expect(lookup('t1')).toBe(reverb);
    expect(lookup('t2')).toBeUndefined();
  });

  // Guards the design, not a regression: the provider must not implement the
  // prop by attaching the function to the tracks it hands on (they come back
  // through onTracksChange).
  it('does not put a function on the tracks it gives the engine or reports back', async () => {
    const reverb: TrackEffectsFunction = () => undefined;
    render(<App trackEffects={() => reverb} />);
    await waitFor(() => expect(isReady).toBe(true));

    const given = h.adapters[0].setTracks.mock.calls[0][0] as ClipTrack[];
    expect(given.every((track) => !('effects' in track))).toBe(true);

    await act(async () => {
      engineRef.current!.moveClip('t1', 'c1', SAMPLE_RATE);
    });
    expect(engineRef.current!.getState().tracks.every((track) => !('effects' in track))).toBe(true);
  });

  it('follows a new trackEffects function without rebuilding the engine', async () => {
    const first: TrackEffectsFunction = () => undefined;
    const second: TrackEffectsFunction = () => undefined;
    // Inline arrows: a new identity on every render of the parent.
    const view = render(<App trackEffects={() => first} />);
    await waitFor(() => expect(isReady).toBe(true));
    const lookup = lookupGivenToAdapter();
    expect(lookup('t1')).toBe(first);

    view.rerender(<App trackEffects={() => second} />);
    await settle();

    expect(h.createToneAdapter).toHaveBeenCalledTimes(1);
    expect(h.adapters[0].dispose).not.toHaveBeenCalled();
    // The lookup the adapter already holds reads the current prop.
    expect(lookup('t1')).toBe(second);
  });

  // The reason for the prop. This case passes with or without `trackEffects`
  // (tracks passed through were always applied incrementally); the control
  // case after it shows what copying the tracks costs.
  it('keeps one engine through clip edits and added tracks', async () => {
    const reverb: TrackEffectsFunction = () => undefined;
    render(<App trackEffects={() => reverb} />);
    await waitFor(() => expect(isReady).toBe(true));
    const adapter = h.adapters[0];
    expect(adapter.setTracks).toHaveBeenCalledTimes(1);

    await act(async () => {
      engineRef.current!.moveClip('t1', 'c1', SAMPLE_RATE);
    });
    await settle();
    await act(async () => {
      engineRef.current!.trimClip('t1', 'c1', 'right', -SAMPLE_RATE);
    });
    await settle();
    await act(async () => {
      engineRef.current!.splitClip('t2', 'c2', SAMPLE_RATE * 10);
    });
    await settle();
    expect(adapter.updateTrack).toHaveBeenCalledTimes(3);

    // A dropped file that is already decoded.
    await act(async () => {
      setAppTracks((tracks) => [...tracks, makeTrack('t3', [makeClip('c3')])]);
    });
    await settle();
    // A placeholder, then its audio (useDynamicTracks).
    await act(async () => {
      setAppTracks((tracks) => [...tracks, makeTrack('t4', [])]);
    });
    await settle();
    await act(async () => {
      setAppTracks((tracks) =>
        tracks.map((track) => (track.id === 't4' ? { ...track, clips: [makeClip('c4')] } : track))
      );
    });
    await settle();

    expect(adapter.addTrack).toHaveBeenCalledTimes(2);
    expect(adapter.updateTrack).toHaveBeenCalledTimes(4);
    // No rebuild: one adapter, never disposed, setTracks only at mount.
    expect(h.createToneAdapter).toHaveBeenCalledTimes(1);
    expect(adapter.dispose).not.toHaveBeenCalled();
    expect(adapter.setTracks).toHaveBeenCalledTimes(1);
  });

  it('control: copied track objects rebuild the engine on a clip edit and on an added track', async () => {
    render(<App copyTracks />);
    await waitFor(() => expect(isReady).toBe(true));
    expect(h.createToneAdapter).toHaveBeenCalledTimes(1);

    await act(async () => {
      engineRef.current!.moveClip('t1', 'c1', SAMPLE_RATE);
    });
    await settle();
    await waitFor(() => expect(h.createToneAdapter).toHaveBeenCalledTimes(2));
    expect(h.adapters[0].dispose).toHaveBeenCalledTimes(1);

    await act(async () => {
      setAppTracks((tracks) => [...tracks, makeTrack('t3', [makeClip('c3')])]);
    });
    await settle();
    await waitFor(() => expect(h.createToneAdapter).toHaveBeenCalledTimes(3));
    expect(h.adapters[1].dispose).toHaveBeenCalledTimes(1);
  });

  // Checked by `pnpm typecheck` (vitest does not type-check).
  it('has no `effects` field on ClipTrack', () => {
    const track: ClipTrack = {
      ...makeTrack('t1', []),
      // @ts-expect-error a track is plain data; effects go through `trackEffects`
      effects: () => undefined,
    };
    expect(track.id).toBe('t1');
  });
});
