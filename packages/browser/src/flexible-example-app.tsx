import React from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  SkipBackwardButton,
  SkipForwardButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  TimeFormatSelect,
  AudioPosition,
  SelectionTimeInputs,
  AutomaticScrollCheckbox,
  Waveform,
  useWaveformPlaylist,
} from './index';

// Custom styled components for layout
const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  height: 100vh;
  font-family: Arial, sans-serif;
`;

const TopBar = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1rem 1.5rem;
  background: #2c3e50;
  color: white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
`;

const TimeControlsBar = styled.div`
  padding: 1rem 1.5rem;
  background: #34495e;
  color: white;
  border-top: 1px solid #2c3e50;
`;

const TimeControlsSection = styled.div`
  display: flex;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
`;

const TimeDisplayGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
`;

const TimeLabel = styled.label`
  font-size: 0.75rem;
  color: #95a5a6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
`;

const TimeDisplay = styled.div`
  font-size: 1.75rem;
  font-weight: bold;
  font-family: 'Courier New', monospace;
  color: #3498db;
  letter-spacing: 0.05em;
  min-width: 200px;
  text-align: right;
`;

const FormatSelectGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const SelectionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
`;

const CompactSelectionInputs = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;

  input {
    width: 140px;
    font-size: 0.9rem;
    font-family: 'Courier New', monospace;
    padding: 0.375rem 0.5rem;
  }
`;

const PlaybackControls = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const ZoomControls = styled.div`
  display: flex;
  gap: 0.5rem;
`;

const MainContent = styled.div<{ $minHeight?: number }>`
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  background: #fff;
  min-height: ${props => props.$minHeight ? `${props.$minHeight}px` : '0'};
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: #34495e;
  color: white;
`;

// Custom track controls component
const CustomTrackControls: React.FC<{ trackIndex: number }> = ({ trackIndex }) => {
  const { trackStates, setTrackMute, setTrackSolo, setTrackVolume } = useWaveformPlaylist();
  const trackState = trackStates[trackIndex];

  if (!trackState) return null;

  return (
    <div
      style={{
        padding: '0.5rem',
        background: '#2c3e50',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        minWidth: '150px',
      }}
    >
      <h4 style={{ margin: 0, fontSize: '0.9rem' }}>Track {trackIndex + 1}</h4>
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <button
          onClick={() => setTrackMute(trackIndex, !trackState.muted)}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            background: trackState.muted ? '#e74c3c' : '#95a5a6',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
          }}
        >
          {trackState.muted ? 'Unmute' : 'Mute'}
        </button>
        <button
          onClick={() => setTrackSolo(trackIndex, !trackState.soloed)}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            background: trackState.soloed ? '#3498db' : '#95a5a6',
            color: 'white',
            border: 'none',
            borderRadius: '0.25rem',
            cursor: 'pointer',
          }}
        >
          {trackState.soloed ? 'Unsolo' : 'Solo'}
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <label style={{ fontSize: '0.75rem' }}>Vol:</label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.01"
          value={trackState.volume}
          onChange={(e) => setTrackVolume(trackIndex, parseFloat(e.target.value))}
          style={{ flex: 1 }}
        />
      </div>
    </div>
  );
};

// Custom AudioPosition wrapper for better display
const CustomAudioPosition: React.FC = () => {
  const { currentTime, formatTime } = useWaveformPlaylist();
  return (
    <TimeDisplayGroup>
      <TimeLabel>Current Time</TimeLabel>
      <TimeDisplay>{formatTime(currentTime)}</TimeDisplay>
    </TimeDisplayGroup>
  );
};

// Main app component showing the flexible layout
const FlexiblePlaylistApp: React.FC = () => {
  const { minimumPlaylistHeight } = useWaveformPlaylist();

  return (
    <AppContainer>
      <TopBar>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Flexible Waveform Playlist</h1>
      </TopBar>

      <div style={{ padding: '1rem', background: '#34495e', borderBottom: '1px solid #2c3e50' }}>
        <div style={{ display: 'flex', gap: '2rem', alignItems: 'center', justifyContent: 'center', flexWrap: 'wrap' }}>
          <PlaybackControls>
            <RewindButton />
            <SkipBackwardButton />
            <PlayButton />
            <PauseButton />
            <StopButton />
            <SkipForwardButton />
            <FastForwardButton />
          </PlaybackControls>

          <ZoomControls>
            <ZoomInButton />
            <ZoomOutButton />
          </ZoomControls>

          <MasterVolumeControl />
          <AutomaticScrollCheckbox />
        </div>
      </div>

      <MainContent $minHeight={minimumPlaylistHeight}>
        <Waveform
          renderTrackControls={(trackIndex) => (
            <CustomTrackControls trackIndex={trackIndex} />
          )}
        />
      </MainContent>

      <TimeControlsBar>
        <TimeControlsSection>
          <FormatSelectGroup>
            <TimeLabel>Time Format</TimeLabel>
            <TimeFormatSelect />
          </FormatSelectGroup>
          <CustomAudioPosition />
          <SelectionGroup>
            <TimeLabel>Selection Range</TimeLabel>
            <CompactSelectionInputs>
              <SelectionTimeInputs />
            </CompactSelectionInputs>
          </SelectionGroup>
        </TimeControlsSection>
      </TimeControlsBar>

      <Footer>
        <div>✨ This layout is completely customizable!</div>
        <div>Powered by the new flexible Waveform Playlist API</div>
      </Footer>
    </AppContainer>
  );
};

// Theme for waveform colors
const theme = {
  waveOutlineColor: '#005BBB',
  waveFillColor: '#FFD500',
  waveProgressColor: '#ff0000',
  timeColor: '#000',
};

// Tracks configuration
const tracks = [
  {
    src: 'media/audio/Vocals30.mp3',
    name: 'Vocals',
  },
  {
    src: 'media/audio/Guitar30.mp3',
    name: 'Guitar',
  },
  {
    src: 'media/audio/PianoSynth30.mp3',
    name: 'Pianos & Synth',
  },
  {
    src: 'media/audio/BassDrums30.mp3',
    name: 'Drums',
  },
];

// Initialize the app
export function initFlexibleExampleApp() {
  const container = document.getElementById('playlist');
  if (!container) {
    console.error('Playlist container not found');
    return;
  }

  const root = createRoot(container);
  root.render(
    <WaveformPlaylistProvider
      tracks={tracks}
      timescale={true}
      mono={true}
      waveHeight={100}
      samplesPerPixel={1024}
      theme={theme}
      controls={{
        show: true,
        width: 150,
      }}
      onReady={() => console.log('Flexible playlist loaded!')}
    >
      <FlexiblePlaylistApp />
    </WaveformPlaylistProvider>
  );
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFlexibleExampleApp);
} else {
  initFlexibleExampleApp();
}
