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
import { useAudioTracks } from './hooks';

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
`;

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

function MinimalApp() {
  // Define your track configuration - use useMemo to prevent re-creating on every render
  const audioConfigs = React.useMemo(() => [
    {
      src: 'media/audio/Vocals30.mp3',
      name: 'Vocals',
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
