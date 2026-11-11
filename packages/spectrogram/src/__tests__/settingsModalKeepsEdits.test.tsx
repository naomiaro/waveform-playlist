// Reproduction for #698: with the settings modal open on a track that has no
// spectrogram config at any level, a re-render of the playlist (playback
// starting, a zoom step) must not discard the edits the user has not applied yet.
//
// Mounts the real <Waveform /> call site with the real modal. The spectrogram
// integration is a minimal fake so no worker pool is needed.
import './jsdom-polyfills'; // must be first — sets globals the import graph needs
import React from 'react';
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup, screen, fireEvent } from '@testing-library/react';
import {
  WaveformPlaylistProvider,
  Waveform,
  SpectrogramIntegrationProvider,
  usePlaylistControls,
  usePlaylistData,
  type SpectrogramIntegration,
} from '@waveform-playlist/browser';
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import { SpectrogramSettingsModal } from '../components/SpectrogramSettingsModal';

if (typeof globalThis.requestAnimationFrame === 'undefined') {
  globalThis.requestAnimationFrame = (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 16) as unknown as number;
  globalThis.cancelAnimationFrame = (id: number) => clearTimeout(id);
}

beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.open = true;
    };
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.open = false;
      this.dispatchEvent(new Event('close'));
    };
  }
});

const SAMPLE_RATE = 48000;

// No spectrogramConfig on the track, none on the integration, no override.
const TRACKS: ClipTrack[] = [
  {
    id: 'track-1',
    name: 'track-1',
    clips: [
      {
        id: 'clip-1',
        startSample: 0,
        durationSamples: SAMPLE_RATE,
        offsetSamples: 0,
        sampleRate: SAMPLE_RATE,
      } as AudioClip,
    ],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  } as ClipTrack,
];

const createAdapter = () =>
  ({
    audioContext: {
      currentTime: 0,
      sampleRate: SAMPLE_RATE,
      state: 'running',
      outputLatency: 0,
    },
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
  }) as never;

const INTEGRATION: SpectrogramIntegration = {
  trackSpectrogramOverrides: new Map(),
  setTrackRenderMode: () => {},
  setTrackSpectrogramConfig: () => {},
  registerSpectrogramCanvas: () => {},
  unregisterSpectrogramCanvas: () => {},
  renderMenuItems: ({ onOpenSettings }) => [
    {
      id: 'settings',
      content: (
        <button type="button" onClick={onOpenSettings}>
          Open spectrogram settings
        </button>
      ),
    },
  ],
  SettingsModal: SpectrogramSettingsModal,
  getColorMap: () => new Uint8Array(256 * 3),
  getFrequencyScale: () => (f: number) => f,
};

let zoomIn: () => void = () => {};
let samplesPerPixel = 0;
const Probe: React.FC = () => {
  zoomIn = usePlaylistControls().zoomIn;
  samplesPerPixel = usePlaylistData().samplesPerPixel;
  return null;
};

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

describe('spectrogram settings modal on a track with no config', () => {
  it('keeps unapplied edits when the playlist re-renders', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <WaveformPlaylistProvider
        tracks={TRACKS}
        sampleRate={SAMPLE_RATE}
        createAdapter={createAdapter}
        controls={{ show: true, width: 200 }}
      >
        <SpectrogramIntegrationProvider value={INTEGRATION}>
          <Probe />
          <Waveform />
        </SpectrogramIntegrationProvider>
      </WaveformPlaylistProvider>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Track menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open spectrogram settings' }));

    const fftSize = () => screen.getAllByRole('combobox', { hidden: true })[0] as HTMLSelectElement;
    expect(fftSize().value).toBe('2048');
    fireEvent.change(fftSize(), { target: { value: '8192' } });
    expect(fftSize().value).toBe('8192');

    // Any playlist re-render: here, a zoom step.
    const before = samplesPerPixel;
    await act(async () => {
      zoomIn();
    });
    expect(samplesPerPixel).not.toBe(before);

    expect(fftSize().value).toBe('8192');
  });
});
