import { useEffect, useState } from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
} from '@waveform-playlist/browser';
import { useAudioTracks } from '@waveform-playlist/browser/tone';
import type { ClipTrack } from '@waveform-playlist/core';
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';

// Audio stems served from website/static (Vite publicDir).
const audioConfigs = [
  { src: '/media/audio/AlbertKader_Whiptails/03_Kick.opus', name: 'Kick' },
  { src: '/media/audio/AlbertKader_Whiptails/04_Snare.opus', name: 'Snare' },
  { src: '/media/audio/AlbertKader_Whiptails/07_Bass1.opus', name: 'Bass' },
];

// Amber/gold gradient bars on a dark surface — matches the page chrome.
// waveOutlineColor is the canvas background; waveFillColor draws the bars.
const theme: Partial<WaveformPlaylistTheme> = {
  waveOutlineColor: '#1d1d26',
  waveFillColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#d4a574' },
      { offset: 0.5, color: '#c49a6c' },
      { offset: 1, color: '#d4a574' },
    ],
  },
  waveProgressColor: 'rgba(232, 192, 144, 0.35)',
  selectedWaveOutlineColor: '#241f2b',
  selectedWaveFillColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#e8c090' },
      { offset: 0.5, color: '#d4a87c' },
      { offset: 1, color: '#e8c090' },
    ],
  },
  playlistBackgroundColor: '#16161e',
  timescaleBackgroundColor: '#1d1d26',
  timeColor: '#9a9aa6',
  playheadColor: '#d08070',
  selectionColor: 'rgba(212, 165, 116, 0.18)',
  // Track-controls surface (mute/solo/volume/pan panel)
  backgroundColor: '#16161e',
  surfaceColor: '#1d1d26',
  selectedTrackControlsBackground: '#2a2433',
  borderColor: '#2a2a35',
  textColor: '#e6e6ea',
  textColorMuted: '#9a9aa6',
  buttonBackground: '#26262f',
  buttonText: '#e6e6ea',
  buttonBorder: '#3a3a46',
  buttonHoverBackground: '#31313d',
  sliderTrackColor: '#3a3a46',
  sliderThumbColor: '#d4a574',
};

const Page = styled.div`
  max-width: 1100px;
  margin: 0 auto;
  padding: 2.5rem 1.5rem 4rem;
  color: #e6e6ea;
  font-family:
    system-ui,
    -apple-system,
    sans-serif;
`;

const Header = styled.header`
  margin-bottom: 1.5rem;

  h1 {
    margin: 0 0 0.4rem;
    color: #d08070;
    font-size: 1.5rem;
    letter-spacing: 0.02em;
  }
  p {
    margin: 0;
    color: #9a9aa6;
    font-size: 0.95rem;
  }
  code {
    font-family: 'Courier New', monospace;
    color: #c49a6c;
  }
`;

const Controls = styled.div`
  display: flex;
  gap: 1rem;
  align-items: center;
  flex-wrap: wrap;
  padding: 0.9rem 1.1rem;
  margin-bottom: 1.25rem;
  border: 1px solid #2a2a35;
  border-radius: 0.5rem;
  background: #1d1d26;
`;

const Status = styled.div`
  padding: 2rem;
  text-align: center;
  color: #9a9aa6;
`;

export function App() {
  // Decoding happens up front; the AudioContext stays suspended until the
  // first user gesture — see "AudioContext and user gestures" in README.md.
  const { tracks: loadedTracks, loading, error, loadedCount, totalCount } =
    useAudioTracks(audioConfigs);
  const [tracks, setTracks] = useState<ClipTrack[]>([]);

  // Sync local track state as peaks fill in; once loading finishes this stops
  // firing, so later updates come from onTracksChange.
  useEffect(() => {
    if (loadedTracks.length > 0) {
      setTracks(loadedTracks);
    }
  }, [loadedTracks]);

  if (error) {
    return (
      <Page>
        <Status>Error loading audio: {error}</Status>
      </Page>
    );
  }

  return (
    <Page>
      <Header>
        <h1>Waveform Playlist — React multitrack starter</h1>
        <p>
          <code>WaveformPlaylistProvider</code> with the default Tone.js engine: three stems,
          mute/solo/volume/pan per track, zoom, and master volume. Audio starts on the first
          Play click — never before a user gesture.
        </p>
      </Header>

      <WaveformPlaylistProvider
        tracks={tracks}
        onTracksChange={setTracks}
        deferEngineRebuild={loading}
        sampleRate={48000}
        samplesPerPixel={1024}
        mono
        waveHeight={90}
        automaticScroll
        controls={{ show: true, width: 200 }}
        timescale
        theme={theme}
        barWidth={3}
        barGap={1}
        roundedBars
      >
        <Controls>
          <PlayButton />
          <PauseButton />
          <StopButton />
          <ZoomInButton />
          <ZoomOutButton />
          <AudioPosition />
          <MasterVolumeControl />
          {loading && (
            <span style={{ fontSize: '0.875rem', color: '#9a9aa6' }}>
              Loading {loadedCount}/{totalCount}…
            </span>
          )}
        </Controls>

        <Waveform />
      </WaveformPlaylistProvider>
    </Page>
  );
}
