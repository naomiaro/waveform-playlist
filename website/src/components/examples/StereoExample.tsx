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
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  WaveformRoot,
  WaveformTrackControls,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  WaveformViewOptions,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';

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

// Stereo tracks - these are stereo files from the Ubiquitous album. Defined
// once; the provider loads them.
const tracks = [
  audioTrack({
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus',
    name: 'Synth 1 (Stereo)',
  }),
  audioTrack({
    src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/11_Synth2.opus',
    name: 'Synth 2 (Stereo)',
  }),
];

// Inside the provider: "Loading: 1/2" while the files load, or the error of one that failed
function LoadingStatus() {
  const { isLoading, settledCount, totalCount, errorMessage } = useLoadingProgress();
  if (errorMessage) {
    return <span style={{ fontSize: '0.875rem', color: 'red' }}>Error loading audio: {errorMessage}</span>;
  }
  if (!isLoading) return null;
  return <span style={{ fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-600)' }}>Loading: {settledCount}/{totalCount}</span>;
}

export function StereoExample() {
  const { theme } = useDocusaurusTheme();

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      sampleRate={48000}
      samplesPerPixel={1024}
      theme={theme}
    >
      <Controls>
        <PlayButton />
        <PauseButton />
        <StopButton />
        <AudioPosition />
        <LoadingStatus />
      </Controls>

      <WaveformViewOptions barWidth={2} barGap={0}>
        <WaveformRoot>
          <WaveformTrackControls />
          <WaveformTracks />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
      </WaveformViewOptions>
    </WaveformPlaylistProvider>
  );
}
