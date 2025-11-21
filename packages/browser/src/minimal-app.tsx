/**
 * Minimal Example App
 *
 * Demonstrates the simplest usage of waveform-playlist:
 * - Load a single audio track
 * - Play/pause/stop controls
 * - Waveform visualization
 */

import React from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
} from './components';
import { Track } from '@waveform-playlist/core';

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
`;

function MinimalApp() {
  // Define your track
  const tracks: Track[] = [
    {
      src: 'media/audio/Vocals30.mp3',
      name: 'Vocals',
      gain: 1,
      muted: false,
      stereoPan: 0,
    },
  ];

  return (
    <WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1024}>
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

// Mount the app
const container = document.getElementById('playlist');
if (container) {
  const root = createRoot(container);
  root.render(<MinimalApp />);
}
