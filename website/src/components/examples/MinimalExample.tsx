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
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  WaveformRoot,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  WaveformViewOptions,
  useCreateArrangement,
  useArrangementSources,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';
import type { AudioTrackOptions } from '@waveform-playlist/core';
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { SourceLoadError } from './SourceLoadError';

// Dark mode: Amber/gold gradient waveform on dark brown background
const darkModeGradientTheme: Partial<WaveformPlaylistTheme> = {
  waveformDrawMode: 'inverted',
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

// Light mode: Teal gradient waveform bars on light background
const lightModeGradientTheme: Partial<WaveformPlaylistTheme> = {
  waveformDrawMode: 'normal',
  waveOutlineColor: '#f5f5f5', // Background
  waveFillColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#3d8b8b' },
      { offset: 0.5, color: '#2a7070' },
      { offset: 1, color: '#3d8b8b' },
    ],
  },
  waveProgressColor: 'rgba(42, 112, 112, 0.3)',
  selectedWaveOutlineColor: '#e8e8e8', // Background when selected
  selectedWaveFillColor: {
    type: 'linear',
    direction: 'vertical',
    stops: [
      { offset: 0, color: '#4a9e9e' },
      { offset: 0.5, color: '#3d8b8b' },
      { offset: 1, color: '#4a9e9e' },
    ],
  },
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

// Define your track configuration once, outside the component
const audioConfigs: AudioTrackOptions[] = [
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus',
    name: 'Bass',
  },
];

export function MinimalExample() {
  const { theme, isDarkMode } = useDocusaurusTheme();
  const gradientTheme = isDarkMode ? darkModeGradientTheme : lightModeGradientTheme;

  // The arrangement owns the tracks and loads their audio; the waveform
  // shows a placeholder until it arrives
  const arrangement = useCreateArrangement(() => audioConfigs.map((config) => audioTrack(config)));
  const sources = useArrangementSources(arrangement);

  return (
    <WaveformPlaylistProvider arrangement={arrangement} sampleRate={48000} samplesPerPixel={2048} mono theme={{ ...theme, ...gradientTheme }}>
      <Controls>
        <PlayButton />
        <PauseButton />
        <StopButton />
        <AudioPosition />
        {sources.isLoading && <span style={{ fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-600)' }}>Loading...</span>}
        <SourceLoadError arrangement={arrangement} />
      </Controls>

      <WaveformViewOptions progressBarWidth={2}>
        <WaveformRoot>
          <WaveformTracks />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
      </WaveformViewOptions>
    </WaveformPlaylistProvider>
  );
}
