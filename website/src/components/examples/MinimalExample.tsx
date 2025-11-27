/**
 * Minimal Example
 *
 * Demonstrates the simplest usage of waveform-playlist:
 * - Load a single audio track
 * - Play/pause/stop controls
 * - Waveform visualization
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
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

// Gradient amber theme for minimal example (no scrolling, so gradient is safe)
const amberGradientTheme: Partial<WaveformPlaylistTheme> = {
  waveformDrawMode: 'inverted',
  // Gradient amber/gold for the waveform bars
  waveOutlineColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#d4a574' },
      { offset: 0.5, color: '#c49a6c' },
      { offset: 1, color: '#d4a574' },
    ],
  },
  waveFillColor: '#1a1612',
  waveProgressColor: 'rgba(100, 70, 40, 0.5)',
  selectedWaveOutlineColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#e8c090' },
      { offset: 0.5, color: '#d4a87c' },
      { offset: 1, color: '#e8c090' },
    ],
  },
  selectedWaveFillColor: '#241c14',
};

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

export function MinimalExample() {
  const { theme } = useDocusaurusTheme();

  // Define your track configuration - use useMemo to prevent re-creating on every render
  const audioConfigs = React.useMemo(() => [
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus',
      name: 'Bass',
    },
  ], []);

  // Load audio tracks and convert to ClipTrack format
  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  if (loading) {
    return (
      <Container>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Loading audio...
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
    <WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1500} mono theme={{ ...theme, ...amberGradientTheme }} barWidth={4} barGap={2}>
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
