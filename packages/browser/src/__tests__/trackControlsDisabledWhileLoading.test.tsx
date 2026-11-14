// @vitest-environment jsdom
//
// While the tracks the provider was mounted with are still loading (a clip
// names its audio and the source has not arrived), a track row is on screen
// before the provider has mixer state for it and before the engine knows it.
// The default track controls are disabled in that window.
//
// This is also the first test that mounts the full <Waveform /> under jsdom,
// which needs a single React copy across the workspace (#702).
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, act, waitFor, cleanup, screen } from '@testing-library/react';
import React from 'react';
import WaveformData from 'waveform-data';
import { WaveformPlaylistProvider } from '../WaveformPlaylistContext';
import { usePlaylistMixer } from '../contexts/playlistContexts';
import { Waveform } from '../components/Waveform';
import type { PlaylistTrack } from '@waveform-playlist/core';
import type { PlayoutAdapter } from '@waveform-playlist/engine';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

const SAMPLE_RATE = 48000;

/** A track whose one clip names its audio and is drawn from peaks meanwhile. */
function makeLoadingTrack(id: string): PlaylistTrack {
  const waveformData = WaveformData.create({
    version: 2,
    channels: 1,
    sample_rate: SAMPLE_RATE,
    samples_per_pixel: 256,
    bits: 16,
    length: 188,
    data: new Array(376).fill(0),
  });
  return {
    id,
    name: id,
    kind: 'audio',
    clips: [{ id: id + '-clip', src: `/${id}.mp3`, duration: 1, waveformData }],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as PlaylistTrack;
}

function oneSecondBuffer(): AudioBuffer {
  return {
    sampleRate: SAMPLE_RATE,
    length: SAMPLE_RATE,
    duration: 1,
    numberOfChannels: 1,
    getChannelData: () => new Float32Array(SAMPLE_RATE),
  } as unknown as AudioBuffer;
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
  // One entry per track since #687; the entry of a loading track is undefined.
  trackStateCount = usePlaylistMixer().trackStates.filter(Boolean).length;
  return null;
};

const TRACKS = [makeLoadingTrack('track-1')];

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
    // The source is held back: every call is kept until the test settles it.
    const pending: Array<(buffer: AudioBuffer) => void> = [];
    const loadSource = () => new Promise<AudioBuffer>((resolve) => pending.push(resolve));
    const App: React.FC = () => (
      <WaveformPlaylistProvider
        tracks={TRACKS}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
        loadSource={loadSource}
      >
        <Probe />
        <Waveform />
      </WaveformPlaylistProvider>
    );

    render(<App />);

    const mute = await screen.findByRole('button', { name: 'Mute' });
    // Precondition: this is the window the test is about. The source was
    // asked for, has not arrived, and the row is drawn from its placeholder.
    await waitFor(() => expect(pending).toHaveLength(1));
    expect(document.querySelectorAll('[data-clip-container]')).toHaveLength(1);
    expect(trackStateCount).toBe(0);
    expect(mute).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Solo' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveProperty('disabled', true);
    expect(screen.getByRole('slider', { name: 'Pan' })).toHaveProperty('disabled', true);

    await act(async () => {
      pending[0](oneSecondBuffer());
    });

    await waitFor(() => expect(trackStateCount).toBe(1));
    expect(screen.getByRole('button', { name: 'Mute' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('button', { name: 'Solo' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('slider', { name: 'Volume' })).toHaveProperty('disabled', false);
    expect(screen.getByRole('slider', { name: 'Pan' })).toHaveProperty('disabled', false);
  });
});
