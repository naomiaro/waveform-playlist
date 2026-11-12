// @vitest-environment jsdom
//
// While tracks are still loading (`deferEngineRebuild`), a track row can be on
// screen before the provider has mixer state for it and before the engine
// knows it. The default track controls are disabled in that window.
//
// This is also the first test that mounts the full <Waveform /> under jsdom,
// which needs a single React copy across the workspace (#702).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, screen } from '@testing-library/react';
import React from 'react';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { usePlaylistMixer } from '../contexts/playlistContexts';
import { Waveform } from '../components/Waveform';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

function makeTrack(id: string): ClipTrack {
  const clip = {
    id: id + '-clip',
    startSample: 0,
    durationSamples: SAMPLE_RATE,
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

let trackStateCount = -1;
const Probe: React.FC = () => {
  trackStateCount = usePlaylistMixer().trackStates.length;
  return null;
};

const TRACKS = [makeTrack('track-1')];

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('default track controls while tracks are loading', () => {
  it('are disabled until the track has mixer state, then enabled', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const adapter = createFakeAdapter();
    const createAdapter = () => adapter;
    const App: React.FC<{ loading: boolean }> = ({ loading }) => (
      <WaveformPlaylistProvider
        tracks={TRACKS}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
        controls={{ show: true, width: 200 }}
        deferEngineRebuild={loading}
      >
        <Probe />
        <Waveform />
      </WaveformPlaylistProvider>
    );

    const { rerender } = render(<App loading />);

    const mute = await screen.findByRole('button', { name: 'Mute' });
    // Precondition: this is the window the test is about.
    expect(trackStateCount).toBe(0);
    expect(mute).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Solo' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('slider', { name: 'Pan' })).toHaveProperty('disabled', true);

    await act(async () => {
      rerender(<App loading={false} />);
    });

    await waitFor(() => expect(trackStateCount).toBe(1));
    expect(screen.getByRole('button', { name: 'Mute' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Solo' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('slider', { name: 'Pan' })).toHaveProperty('disabled', false);
  });
});
