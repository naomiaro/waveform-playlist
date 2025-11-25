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
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

// Stem tracks configuration
const audioConfigs = [
  {
    src: '/waveform-playlist/media/audio/Vocals30.mp3',
    name: 'Vocals',
  },
  {
    src: '/waveform-playlist/media/audio/Guitar30.mp3',
    name: 'Guitar',
  },
  {
    src: '/waveform-playlist/media/audio/PianoSynth30.mp3',
    name: 'Pianos & Synth',
  },
  {
    src: '/waveform-playlist/media/audio/BassDrums30.mp3',
    name: 'Drums',
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
        samplesPerPixel={1024}
        mono
        waveHeight={100}
        automaticScroll={true}
        controls={{ show: true, width: 200 }}
        theme={theme}
      >
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

        <Waveform timescale />
      </WaveformPlaylistProvider>
    </Container>
  );
}
