import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import { createTrack, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  ZoomInButton,
  ZoomOutButton,
  AudioPosition,
  AutomaticScrollCheckbox,
  MasterVolumeControl,
  usePlaybackAnimation,
  usePlaylistData,
} from './index';
import { useIntegratedRecording } from './hooks/useIntegratedRecording';
import {
  RecordButton,
  MicrophoneSelector,
  VUMeter,
  RecordingIndicator,
} from '@waveform-playlist/recording';

const Container = styled.div`
  padding: 20px;
  max-width: 1400px;
  margin: 0 auto;
`;

const Header = styled.div`
  margin-bottom: 20px;
`;

const Title = styled.h2`
  margin: 0 0 10px 0;
  color: #333;
`;

const Description = styled.p`
  margin: 0;
  color: #666;
  font-size: 14px;
`;

const Controls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 5px;
  align-items: center;
  padding-right: 15px;
  border-right: 1px solid #ddd;

  &:last-child {
    border-right: none;
  }
`;

const NewTrackButton = styled.button`
  padding: 8px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;

  &:hover {
    background: #45a049;
  }
`;

const VUMeterWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f5f5f5;
  border-radius: 4px;
`;

const Label = styled.span`
  font-size: 12px;
  color: #666;
  font-weight: 500;
`;

const EnableButton = styled.button`
  padding: 8px 16px;
  background: #2196F3;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;

  &:hover {
    background: #1976D2;
  }
`;

const ErrorMessage = styled.div`
  padding: 10px 15px;
  background: #ffebee;
  border: 1px solid #ef5350;
  border-radius: 4px;
  color: #c62828;
  font-size: 14px;
  margin-bottom: 15px;
`;

// Inner component that uses playlist context
const RecordingControlsInner: React.FC<{
  tracks: ClipTrack[];
  setTracks: (tracks: ClipTrack[]) => void;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  onAddTrack: () => void;
}> = ({ tracks, setTracks, selectedTrackId, setSelectedTrackId, onAddTrack }) => {
  // Get current time from playlist context
  const { currentTime } = usePlaybackAnimation();
  const { sampleRate } = usePlaylistData();

  // Integrated recording hook
  const {
    isRecording,
    duration,
    level,
    peakLevel,
    devices,
    hasPermission,
    selectedDevice,
    startRecording,
    stopRecording,
    requestMicAccess,
    changeDevice,
    error,
    recordingPeaks,
  } = useIntegratedRecording(tracks, setTracks, selectedTrackId, { currentTime });

  const handleRecordClick = () => {
    // If no track selected and we have tracks, select the last one
    if (!selectedTrackId && tracks.length > 0) {
      setSelectedTrackId(tracks[tracks.length - 1].id);
    }
    // If no tracks at all, create one
    if (tracks.length === 0) {
      onAddTrack();
      // The track will be selected in onAddTrack
      // Need to wait a tick for state to update before starting recording
      setTimeout(() => {
        if (isRecording) {
          stopRecording();
        } else {
          startRecording();
        }
      }, 0);
      return;
    }

    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  // Calculate recording start position for live preview
  let recordingStartSample = 0;
  if (isRecording && selectedTrackId) {
    const selectedTrack = tracks.find(t => t.id === selectedTrackId);
    if (selectedTrack) {
      const currentTimeSamples = Math.floor(currentTime * sampleRate);
      let lastClipEndSample = 0;
      if (selectedTrack.clips.length > 0) {
        const endSamples = selectedTrack.clips.map(clip =>
          clip.startSample + clip.durationSamples
        );
        lastClipEndSample = Math.max(...endSamples);
      }
      recordingStartSample = Math.max(currentTimeSamples, lastClipEndSample);
    }
  }

  return (
    <>
      {error && (
        <ErrorMessage>
          Error: {error.message}
        </ErrorMessage>
      )}

      <Controls>
        {/* Playback Controls */}
        <ControlGroup>
          <PlayButton />
          <PauseButton />
          <StopButton />
        </ControlGroup>

        {/* Track Management */}
        <ControlGroup>
          <NewTrackButton onClick={onAddTrack}>
            + New Track
          </NewTrackButton>
        </ControlGroup>

        {/* Recording Controls */}
        {!hasPermission ? (
          <ControlGroup>
            <EnableButton onClick={requestMicAccess}>
              🎤 Enable Microphone
            </EnableButton>
          </ControlGroup>
        ) : (
          <>
            <ControlGroup>
              <MicrophoneSelector
                devices={devices}
                selectedDeviceId={selectedDevice || undefined}
                onDeviceChange={changeDevice}
                disabled={isRecording}
              />
            </ControlGroup>

            <ControlGroup>
              <RecordButton
                isRecording={isRecording}
                onClick={handleRecordClick}
                disabled={false}
              />
              {isRecording && (
                <RecordingIndicator
                  isRecording={isRecording}
                  duration={duration}
                />
              )}
            </ControlGroup>

            <ControlGroup>
              <VUMeterWrapper>
                <Label>Input:</Label>
                <VUMeter level={level} peakLevel={peakLevel} width={200} height={20} />
              </VUMeterWrapper>
            </ControlGroup>
          </>
        )}

        {/* Zoom Controls */}
        <ControlGroup>
          <ZoomInButton />
          <ZoomOutButton />
        </ControlGroup>

        {/* Position Display */}
        <ControlGroup>
          <AudioPosition />
        </ControlGroup>

        {/* Other Controls */}
        <ControlGroup>
          <AutomaticScrollCheckbox />
        </ControlGroup>

        <ControlGroup>
          <MasterVolumeControl />
        </ControlGroup>
      </Controls>

      <Waveform
        showClipHeaders={true}
        recordingState={
          isRecording && selectedTrackId
            ? {
                isRecording: true,
                trackId: selectedTrackId,
                startSample: recordingStartSample,
                durationSamples: Math.floor(duration * sampleRate),
                peaks: recordingPeaks,
              }
            : undefined
        }
      />
    </>
  );
};

// Main component
const IntegratedRecordingExample: React.FC = () => {
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);

  const handleAddTrack = () => {
    const newTrack = createTrack({
      name: `Track ${tracks.length + 1}`,
      clips: [],
      muted: false,
      soloed: false,
      volume: 1.0,
      pan: 0,
    });
    setTracks([...tracks, newTrack]);
    // Auto-select the new track for recording
    setSelectedTrackId(newTrack.id);
  };

  return (
    <Container>
      <Header>
        <Title>🎙️ Integrated Multi-Track Recording</Title>
        <Description>
          Recording starts from max(cursor position, last clip end). Click "+ New Track" to add a track, then hit record!
        </Description>
      </Header>

      <WaveformPlaylistProvider
        tracks={tracks}
        samplesPerPixel={1024}
        zoomLevels={[256, 512, 1024, 2048, 4096]}
        mono={true}
        waveHeight={100}
        automaticScroll={true}
        controls={{ show: true, width: 200 }}
        theme={{
          waveOutlineColor: '#4CAF50',
          waveFillColor: '#81C784',
          waveProgressColor: '#2196F3',
          selectedWaveOutlineColor: '#2196F3',
          selectedWaveFillColor: '#64B5F6',
          selectedTrackControlsBackground: '#e3f2fd',
          selectedClipHeaderBackgroundColor: '#bbdefb',
        }}
      >
        <RecordingControlsInner
          tracks={tracks}
          setTracks={setTracks}
          selectedTrackId={selectedTrackId}
          setSelectedTrackId={setSelectedTrackId}
          onAddTrack={handleAddTrack}
        />
      </WaveformPlaylistProvider>

      {tracks.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '40px',
          color: '#999',
          fontSize: '14px'
        }}>
          Click "+ New Track" to add a track, then start recording!
        </div>
      )}
    </Container>
  );
};

// Mount the app
const container = document.getElementById('playlist');
if (container) {
  const root = createRoot(container);
  root.render(<IntegratedRecordingExample />);
}
