/**
 * Stereo Example
 *
 * Demonstrates stereo waveform rendering with separate L/R channels:
 * - Load stereo audio tracks
 * - Display separate left and right waveform channels
 * - Play/pause/stop controls
 */

import React from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  useAudioTracks,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
`;

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

export function StereoExample() {
  const { theme } = useDocusaurusTheme();

  // Load stereo tracks - these are stereo files from the Ubiquitous album
  const audioConfigs = React.useMemo(() => [
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus',
      name: 'Synth 1 (Stereo)',
    },
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/11_Synth2.opus',
      name: 'Synth 2 (Stereo)',
    },
  ], []);

  // Load audio tracks
  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  if (loading) {
    return (
      <Container>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Loading stereo audio...
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
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1000}
      theme={theme}
      barWidth={2}
      barGap={1}
      controls={{ show: true, width: 200 }}
    >
      <Controls>
        <PlayButton />
        <PauseButton />
        <StopButton />
        <AudioPosition />
      </Controls>

      <Waveform />
    </WaveformPlaylistProvider>
  );
}
