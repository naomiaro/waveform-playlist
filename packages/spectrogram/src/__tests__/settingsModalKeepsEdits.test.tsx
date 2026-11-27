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
  useCreateArrangement,
  Waveform,
  SpectrogramIntegrationContext,
  useEditorControls,
  usePlaylistZoom,
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
  zoomIn = useEditorControls().zoomIn;
  samplesPerPixel = usePlaylistZoom().samplesPerPixel;
  return null;
};

afterEach(async () => {
  await act(async () => {
    cleanup();
  });
  vi.restoreAllMocks();
});

// The provider on an arrangement of TRACKS, made as an app makes it (#812).
const Playlist: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const arrangement = useCreateArrangement(() => TRACKS);
  return (
    <WaveformPlaylistProvider
      arrangement={arrangement}
      sampleRate={SAMPLE_RATE}
      createAdapter={createAdapter}
    >
      {children}
    </WaveformPlaylistProvider>
  );
};

describe('spectrogram settings modal on a track with no config', () => {
  it('keeps unapplied edits when the playlist re-renders', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <Playlist>
        <SpectrogramIntegrationContext value={INTEGRATION}>
          <Probe />
          <Waveform />
        </SpectrogramIntegrationContext>
      </Playlist>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Track menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open spectrogram settings' }));

    const fftSize = () => screen.getByLabelText('FFT Size') as HTMLSelectElement;
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

// #814: with no maxFrequency the field shows half the rate of the audio
// context the provider plays with, which the drawing goes up to.
describe('spectrogram settings modal: the default top frequency', () => {
  it('shows half the sample rate of the adapter’s audio context', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const CONTEXT_RATE = 44100;
    const adapterAt44k = () => {
      const adapter = createAdapter() as unknown as { audioContext: { sampleRate: number } };
      return { ...adapter, audioContext: { ...adapter.audioContext, sampleRate: CONTEXT_RATE } };
    };
    // No sampleRate prop: the provider learns the rate from the adapter.
    const At44k: React.FC<{ children: React.ReactNode }> = ({ children }) => {
      const arrangement = useCreateArrangement(() => TRACKS);
      return (
        <WaveformPlaylistProvider arrangement={arrangement} createAdapter={adapterAt44k as never}>
          {children}
        </WaveformPlaylistProvider>
      );
    };

    render(
      <At44k>
        <SpectrogramIntegrationContext value={INTEGRATION}>
          <Waveform />
        </SpectrogramIntegrationContext>
      </At44k>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Track menu' }));
    fireEvent.click(screen.getByRole('button', { name: 'Open spectrogram settings' }));

    const maxFrequency = screen.getByLabelText('Max Frequency (Hz)') as HTMLInputElement;
    expect(maxFrequency.value).toBe(String(CONTEXT_RATE / 2));
  });
});
