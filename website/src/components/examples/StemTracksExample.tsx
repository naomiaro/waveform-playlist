import React from 'react';
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
  AutomaticScrollCheckbox,
  MasterVolumeControl,
  useAudioTracks,
  usePlaybackShortcuts,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

// Stem tracks configuration - Albert Kader "Whiptails" minimal techno (all stems)
const audioConfigs = [
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/01_Loop1.opus',
    name: 'Loop 1',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/02_Loop2.opus',
    name: 'Loop 2',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/03_Kick.opus',
    name: 'Kick',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/04_Snare.opus',
    name: 'Snare',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/05_Claps.opus',
    name: 'Claps',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/06_HiHat.opus',
    name: 'HiHat',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/07_Bass1.opus',
    name: 'Bass 1',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/08_Bass2.opus',
    name: 'Bass 2',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/09_Synth1.opus',
    name: 'Synth 1',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/10_Synth2.opus',
    name: 'Synth 2',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/11_Vox_Dry.opus',
    name: 'Vox Dry',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/12_Vox_Wet.opus',
    name: 'Vox Wet',
  },
];

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding-right: 1rem;
  border-right: 1px solid var(--ifm-color-emphasis-300, #dee2e6);

  &:last-child {
    border-right: none;
  }
`;

// Component to enable keyboard shortcuts (must be inside provider)
function PlaybackShortcuts() {
  usePlaybackShortcuts();
  return null;
}

export function StemTracksExample() {
  const { theme } = useDocusaurusTheme();

  // Load audio tracks and convert to ClipTrack format
  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  if (loading) {
    return (
      <Container>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Loading audio tracks...
        </div>
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <div style={{ padding: '2rem', color: 'red' }}>
          Error loading audio: {error}
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <WaveformPlaylistProvider
        tracks={tracks}
        samplesPerPixel={512}
        mono
        waveHeight={100}
        automaticScroll={true}
        controls={{ show: true, width: 200 }}
        theme={theme}
        timescale
        barWidth={4}
        barGap={2}
      >
        <PlaybackShortcuts />
        <Controls>
          <ControlGroup>
            <PlayButton />
            <PauseButton />
            <StopButton />
          </ControlGroup>

          <ControlGroup>
            <ZoomInButton />
            <ZoomOutButton />
          </ControlGroup>

          <ControlGroup>
            <AudioPosition />
          </ControlGroup>

          <ControlGroup>
            <MasterVolumeControl />
          </ControlGroup>

          <ControlGroup>
            <AutomaticScrollCheckbox />
          </ControlGroup>

        </Controls>

        <Waveform />
      </WaveformPlaylistProvider>
    </Container>
  );
}
