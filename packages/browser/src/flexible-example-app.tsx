import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import type { ClipTrack } from '@waveform-playlist/core';
import { CLIP_HEADER_HEIGHT } from '@waveform-playlist/ui-components';
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
  usePlaylistData,
  useClipDragHandlers,
} from './index';
import { useAudioTracks } from './hooks';

// Custom styled components for layout with polished styling
const AppContainer = styled.div`
  display: flex;
  flex-direction: column;
  margin-bottom: 2rem;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  animation: fadeIn 0.3s ease;

  /* Global button styles with all interaction states */
  button {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    position: relative;
    font-weight: 600;
    cursor: pointer;
    border: none;

    &:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
      filter: brightness(1.15);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2);
      filter: brightness(1.05);
    }

    &:focus-visible {
      outline: 3px solid #3498db;
      outline-offset: 2px;
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
      transform: none !important;
      filter: grayscale(0.3);
    }
  }

  /* Global input/select styles */
  input, select {
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  }
`;

const TopBar = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  color: white;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);

  @keyframes slideDown {
    from {
      transform: translateY(-100%);
    }
    to {
      transform: translateY(0);
    }
  }

  animation: slideDown 0.4s cubic-bezier(0.4, 0, 0.2, 1);

  h1 {
    text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }
`;

const TimeControlsBar = styled.div`
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
  color: white;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);
`;

const TimeControlsSection = styled.div`
  display: flex;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 1rem;
  }
`;

const TimeDisplayGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 0.5rem;
`;

const TimeLabel = styled.label`
  font-size: 0.7rem;
  color: #bdc3c7;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-weight: 700;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
`;

const TimeDisplay = styled.div`
  font-size: 1.5rem;
  font-weight: bold;
  font-family: 'Courier New', Monaco, monospace;
  color: #5dade2;
  letter-spacing: 0.08em;
  min-width: 180px;
  text-align: center;
  text-shadow: 0 0 20px rgba(93, 173, 226, 0.5);
  padding: 0;

  @media (max-width: 768px) {
    font-size: 1.2rem;
    min-width: 150px;
  }
`;

const FormatSelectGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;

  select {
    padding: 0.5rem 0.75rem;
    background: #2c3e50;
    border: 1px solid #546e7a;
    border-radius: 0.375rem;
    color: #ecf0f1;
    font-size: 0.9rem;
    cursor: pointer;

    &:hover {
      border-color: #7f8c8d;
      background: #273746;
    }

    &:focus {
      outline: none;
      border-color: #3498db;
      box-shadow: 0 0 0 3px rgba(52, 152, 219, 0.2);
    }
  }
`;

const SelectionGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const CompactSelectionInputs = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;

  input {
    width: 140px;
    font-size: 1rem;
    font-family: 'Courier New', Monaco, monospace;
    font-weight: 600;
    padding: 0.5rem 0.75rem;
    background: #2c3e50;
    border: 1px solid #546e7a;
    border-radius: 0.375rem;
    color: #ecf0f1;

    &:focus {
      outline: none;
      border-color: #5dade2;
      box-shadow: 0 0 0 3px rgba(93, 173, 226, 0.3);
      background: #1a252f;
      color: #ffffff;
    }

    &:hover:not(:focus) {
      border-color: #7f8c8d;
      background: #273746;
    }

    @media (max-width: 768px) {
      width: 100px;
      font-size: 0.85rem;
      padding: 0.375rem 0.5rem;
    }
  }

  label {
    font-size: 0.85rem;
    color: #bdc3c7;
  }
`;

const PlaybackControls = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const ZoomControls = styled.div`
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
`;

const VolumeControlGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StyledVolumeSlider = styled.input.attrs({ type: 'range' })<{ $value: number }>`
  -webkit-appearance: none;
  appearance: none;
  width: 150px;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    #5dade2 0%,
    #5dade2 ${props => props.$value}%,
    rgba(255, 255, 255, 0.2) ${props => props.$value}%,
    rgba(255, 255, 255, 0.2) 100%
  );
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #5dade2;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.3);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), 0 0 8px rgba(93, 173, 226, 0.5);
    }

    &:active {
      transform: scale(1.15);
    }
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #5dade2;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    border: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.3);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), 0 0 8px rgba(93, 173, 226, 0.5);
    }

    &:active {
      transform: scale(1.15);
    }
  }
`;

const CheckboxGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
`;

const StyledCheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #5dade2;
  }
`;

const MainContent = styled.div<{ $minHeight?: number }>`
  flex: 1;
  overflow-x: auto;
  overflow-y: auto;
  background: #ecf0f1;
  min-height: ${props => props.$minHeight ? `${props.$minHeight}px` : '0'};
  box-shadow: inset 0 4px 8px rgba(0, 0, 0, 0.08);

  /* Remove any extra padding from waveform container */
  > div {
    padding: 0;
    margin: 0;
  }
`;

const Footer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 1.5rem;
  background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
  color: white;
  font-size: 0.9rem;
  box-shadow: 0 -2px 8px rgba(0, 0, 0, 0.1);

  @media (max-width: 768px) {
    flex-direction: column;
    gap: 0.5rem;
    text-align: center;
    font-size: 0.8rem;
  }
`;

// Styled components for track controls
// Height accounts for clip header (22px) + controls content
const TrackControlsContainer = styled.div`
  padding: 0.4rem 0.5rem;
  background: linear-gradient(135deg, #2c3e50 0%, #1a252f 100%);
  color: white;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  width: 120px;
  height: ${100 + CLIP_HEADER_HEIGHT}px; /* 122px total: 100px controls + 22px header */
  box-sizing: border-box;
  border-right: 1px solid rgba(255, 255, 255, 0.08);
  box-shadow: 2px 0 8px rgba(0, 0, 0, 0.15);
  transition: all 0.2s ease;

  &:hover {
    background: linear-gradient(135deg, #34495e 0%, #1f2d3a 100%);
  }
`;

const TrackTitle = styled.h4`
  margin: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.03em;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
  text-align: center;
  padding-bottom: 0.2rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
`;

const TrackButtonsRow = styled.div`
  display: flex;
  gap: 0.3rem;
`;

const TrackButton = styled.button<{ $active?: boolean; $type?: 'mute' | 'solo' }>`
  padding: 0.25rem 0.4rem;
  font-size: 0.625rem;
  background: ${props => {
    if (props.$active) {
      return props.$type === 'mute' ? '#e74c3c' : '#3498db';
    }
    return '#455a64';
  }};
  color: white;
  border: none;
  border-radius: 0.25rem;
  cursor: pointer;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  flex: 1;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  min-width: 0;

  &:hover:not(:disabled) {
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
`;

const VolumeContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  padding: 0 0.5rem;
`;

const VolumeLabel = styled.label`
  font-size: 0.6rem;
  font-weight: 600;
  color: #95a5a6;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  text-align: center;
`;

const StyledRangeInput = styled.input.attrs({ type: 'range' })<{ $value: number }>`
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  border-radius: 2px;
  background: linear-gradient(
    to right,
    #5dade2 0%,
    #5dade2 ${props => props.$value * 100}%,
    #1a252f ${props => props.$value * 100}%,
    #1a252f 100%
  );
  outline: none;
  cursor: pointer;

  &::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #5dade2;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.3);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), 0 0 8px rgba(93, 173, 226, 0.5);
    }

    &:active {
      transform: scale(1.15);
    }
  }

  &::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: #5dade2;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.4);
    border: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

    &:hover {
      transform: scale(1.3);
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.5), 0 0 8px rgba(93, 173, 226, 0.5);
    }

    &:active {
      transform: scale(1.15);
    }
  }
`;

// Custom track controls component
const CustomTrackControls: React.FC<{ trackIndex: number }> = ({ trackIndex }) => {
  const { trackStates, setTrackMute, setTrackSolo, setTrackVolume } = useWaveformPlaylist();
  const trackState = trackStates[trackIndex];

  if (!trackState) return null;

  // Get track name from the track state (from the ClipTrack data)
  const trackName = trackState.name || `Track ${trackIndex + 1}`;

  return (
    <TrackControlsContainer>
      <TrackTitle>{trackName}</TrackTitle>
      <TrackButtonsRow>
        <TrackButton
          onClick={() => setTrackMute(trackIndex, !trackState.muted)}
          $active={trackState.muted}
          $type="mute"
        >
          M
        </TrackButton>
        <TrackButton
          onClick={() => setTrackSolo(trackIndex, !trackState.soloed)}
          $active={trackState.soloed}
          $type="solo"
        >
          S
        </TrackButton>
      </TrackButtonsRow>
      <VolumeContainer>
        <VolumeLabel>Volume</VolumeLabel>
        <StyledRangeInput
          min="0"
          max="1"
          step="0.01"
          value={trackState.volume}
          $value={trackState.volume}
          onChange={(e) => setTrackVolume(trackIndex, parseFloat(e.target.value))}
        />
      </VolumeContainer>
    </TrackControlsContainer>
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

// Custom Master Volume Control with consistent styling
const CustomMasterVolumeControl: React.FC = () => {
  const { masterVolume, setMasterVolume } = useWaveformPlaylist();

  return (
    <VolumeControlGroup>
      <TimeLabel>Master Volume</TimeLabel>
      <StyledVolumeSlider
        min="0"
        max="100"
        value={masterVolume}
        $value={masterVolume}
        onChange={(e) => setMasterVolume(parseFloat(e.target.value))}
      />
    </VolumeControlGroup>
  );
};

// Styled wrapper for AutomaticScrollCheckbox
const StyledAutomaticScrollCheckbox = styled(AutomaticScrollCheckbox)`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;

  input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: #5dade2;
  }

  label {
    font-size: 0.7rem;
    color: #bdc3c7;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-weight: 700;
    cursor: pointer;
  }
`;

// Styled control bar section
const ControlBar = styled.div`
  padding: 1.25rem 1.5rem;
  background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
`;

const ControlBarContent = styled.div`
  display: flex;
  gap: 2rem;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;

  @media (max-width: 768px) {
    gap: 1rem;
  }
`;

const ControlDivider = styled.div`
  width: 1px;
  height: 30px;
  background: rgba(255, 255, 255, 0.2);

  @media (max-width: 768px) {
    display: none;
  }
`;

// Custom timestamp component with enhanced styling
const CustomTimestamp = styled.div<{ $left: number }>`
  position: absolute;
  left: ${(props) => props.$left + 4}px;
  font-size: 0.7rem;
  font-weight: 600;
  color: #5dade2;
  background: rgba(44, 62, 80, 0.9);
  padding: 2px 6px;
  border-radius: 3px;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(93, 173, 226, 0.3);
  letter-spacing: 0.05em;
`;

// Inner component with drag handling - has access to playlist context
interface PlaylistWithDragProps {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
}

const PlaylistWithDrag: React.FC<PlaylistWithDragProps> = ({ tracks, onTracksChange }) => {
  const { minimumPlaylistHeight } = useWaveformPlaylist();
  const { samplesPerPixel, sampleRate } = usePlaylistData();

  // Use the clip drag handlers hook for all drag operations
  const { onDragStart, onDragMove, onDragEnd, collisionModifier } = useClipDragHandlers({
    tracks,
    onTracksChange,
    samplesPerPixel,
    sampleRate,
  });
  return (
    <AppContainer>
      <TopBar>
        <h1 style={{ margin: 0, fontSize: '1.5rem' }}>Flexible Waveform Playlist</h1>
      </TopBar>

      <ControlBar>
        <ControlBarContent>
          <PlaybackControls>
            <RewindButton />
            <SkipBackwardButton />
            <PlayButton />
            <PauseButton />
            <StopButton />
            <SkipForwardButton />
            <FastForwardButton />
          </PlaybackControls>

          <ControlDivider />

          <ZoomControls>
            <ZoomInButton />
            <ZoomOutButton />
          </ZoomControls>

          <ControlDivider />

          <CustomMasterVolumeControl />

          <ControlDivider />

          <StyledAutomaticScrollCheckbox />
        </ControlBarContent>
      </ControlBar>

      <MainContent $minHeight={minimumPlaylistHeight}>
        <DndContext
          onDragStart={onDragStart}
          onDragMove={onDragMove}
          onDragEnd={onDragEnd}
          modifiers={[restrictToHorizontalAxis, collisionModifier]}
        >
          <Waveform
            theme={theme}
            renderTrackControls={(trackIndex) => (
              <CustomTrackControls trackIndex={trackIndex} />
            )}
            renderTimestamp={(timeMs, position) => {
              const seconds = Math.floor(timeMs / 1000);
              const s = seconds % 60;
              const m = Math.floor(seconds / 60);
              const formattedTime = `${m}:${String(s).padStart(2, '0')}`;

              return (
                <CustomTimestamp $left={position}>
                  {formattedTime}
                </CustomTimestamp>
              );
            }}
            showClipHeaders={true}
          />
        </DndContext>
      </MainContent>

      <TimeControlsBar>
        <TimeControlsSection>
          <FormatSelectGroup>
            <TimeLabel>Time Format</TimeLabel>
            <TimeFormatSelect />
          </FormatSelectGroup>
          <SelectionGroup>
            <TimeLabel>Selection Range</TimeLabel>
            <CompactSelectionInputs>
              <SelectionTimeInputs />
            </CompactSelectionInputs>
          </SelectionGroup>
          <CustomAudioPosition />
        </TimeControlsSection>
      </TimeControlsBar>

      <Footer>
        <div>✨ This layout is completely customizable! Drag clip headers to reposition clips.</div>
        <div>Powered by the new flexible Waveform Playlist API</div>
      </Footer>
    </AppContainer>
  );
};

// Theme for waveform colors - matching the dark blue/teal aesthetic
const theme = {
  waveOutlineColor: '#1e3a5f',
  waveFillColor: '#5dade2',
  waveProgressColor: '#e74c3c',
  selectedWaveOutlineColor: '#3a5a8f', // Brighter blue for selected waveforms
  selectedWaveFillColor: '#5dade2', // '#2c5f7f', // Darker fill to balance the brighter outline
  selectedTrackControlsBackground: 'rgba(52, 152, 219, 0.2)', // Subtle blue tint for selected controls
  selectedClipHeaderBackgroundColor: 'rgba(52, 152, 219, 0.4)', // Brighter blue for selected clip headers
  timeColor: '#ecf0f1', // Light text for dark background
  timescaleBackgroundColor: '#2c3e50', // Dark background to match the overall theme
  playheadColor: '#8b0000', // Dark red playhead for contrast with blue waveforms
  selectionColor: 'rgba(231, 76, 60, 0.5)', // Light red selection for contrast with blue waveforms
  clipHeaderBackgroundColor: 'rgba(44, 62, 80, 0.85)', // Dark blue-gray matching theme
  clipHeaderBorderColor: 'rgba(93, 173, 226, 0.4)', // Light blue accent border
  clipHeaderTextColor: '#ecf0f1', // Light text for readability
};

// Audio configs - will be loaded with useAudioTracks hook
const audioConfigs = [
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

// Wrapper component that loads audio tracks
const FlexibleExampleAppWithAudio: React.FC = () => {
  // Use useMemo to prevent re-creating audioConfigs on every render
  const configs = React.useMemo(() => audioConfigs, []);

  const { tracks: loadedTracks, loading, error } = useAudioTracks(configs);

  // Local state for tracks so we can update clip positions on drag
  const [tracks, setTracks] = useState<ClipTrack[]>([]);

  // Update local tracks when loading completes
  React.useEffect(() => {
    if (loadedTracks.length > 0) {
      setTracks(loadedTracks);
    }
  }, [loadedTracks]);

  if (loading) {
    return (
      <AppContainer>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Loading audio tracks...
        </div>
      </AppContainer>
    );
  }

  if (error) {
    return (
      <AppContainer>
        <div style={{ padding: '2rem', color: 'red' }}>
          Error loading audio: {error}
        </div>
      </AppContainer>
    );
  }

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      timescale={true}
      mono={true}
      waveHeight={100}
      samplesPerPixel={1024}
      theme={theme}
      controls={{
        show: true,
        width: 120,
      }}
      onReady={() => console.log('Flexible playlist loaded!')}
    >
      <PlaylistWithDrag tracks={tracks} onTracksChange={setTracks} />
    </WaveformPlaylistProvider>
  );
};

// Initialize the app
export function initFlexibleExampleApp() {
  const container = document.getElementById('playlist');
  if (!container) {
    console.error('Playlist container not found');
    return;
  }

  const root = createRoot(container);
  root.render(<FlexibleExampleAppWithAudio />);
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initFlexibleExampleApp);
} else {
  initFlexibleExampleApp();
}
