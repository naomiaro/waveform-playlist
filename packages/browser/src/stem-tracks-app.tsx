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
  ZoomInButton,
  ZoomOutButton,
  AutomaticScrollCheckbox,
  MasterVolumeControl,
} from './components';
import { useAudioTracks } from './hooks';
import { defaultTheme, darkTheme } from '@waveform-playlist/ui-components';

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
  background: #f8f9fa;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding-right: 1rem;
  border-right: 1px solid #dee2e6;

  &:last-child {
    border-right: none;
  }
`;

function StemTracksApp() {
  // Detect Docusaurus theme via data-theme attribute
  const [isDark, setIsDark] = React.useState(() => {
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'dark';
    }
    return false;
  });

  React.useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.getAttribute('data-theme') === 'dark');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    return () => observer.disconnect();
  }, []);

  const theme = isDark ? darkTheme : defaultTheme;

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
        mono={true}
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

        <Waveform />
      </WaveformPlaylistProvider>
    </Container>
  );
}

// Initialize the app
export function initStemTracksApp() {
  const container = document.getElementById('playlist');
  if (!container) {
    console.error('Playlist container not found');
    return;
  }

  const root = createRoot(container);
  root.render(<StemTracksApp />);
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initStemTracksApp);
} else {
  initStemTracksApp();
}
