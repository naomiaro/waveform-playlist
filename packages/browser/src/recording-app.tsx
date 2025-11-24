import React, { useState, useEffect, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import styled from 'styled-components';
import { createTrack, type ClipTrack } from '@waveform-playlist/core';
import { DndContext, type DragEndEvent } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
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
  usePlaylistControls,
  usePlaylistState,
  useClipDragHandlers,
  useDragSensors,
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

const RecordingControlsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 15px;
  align-items: center;
  padding: 15px;
  background: #f5f5f5;
  border-radius: 4px;
  border: 2px solid #e0e0e0;
`;

const PlaybackControlsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
  align-items: center;
`;

const DropZone = styled.div<{ $isDragging: boolean }>`
  padding: 30px;
  margin-bottom: 20px;
  border: 2px dashed ${props => props.$isDragging ? '#2196F3' : '#ccc'};
  border-radius: 8px;
  background: ${props => props.$isDragging ? '#e3f2fd' : '#fafafa'};
  text-align: center;
  transition: all 0.2s ease;

  &:hover {
    border-color: #2196F3;
    background: #f5f5f5;
  }
`;

const DropZoneText = styled.p`
  margin: 0;
  color: #666;
  font-size: 14px;
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
  const { sampleRate, samplesPerPixel, controls } = usePlaylistData();
  const { scrollContainerRef, setSelectedTrackId: setProviderSelectedTrackId } = usePlaylistControls();
  const { isAutomaticScroll } = usePlaylistState();

  // Sync provider's selectedTrackId with local state whenever it changes
  useEffect(() => {
    setProviderSelectedTrackId(selectedTrackId);
  }, [selectedTrackId, setProviderSelectedTrackId]);

  // Configure sensors and drag handlers
  const sensors = useDragSensors();
  const { onDragStart, onDragMove, onDragEnd, collisionModifier } = useClipDragHandlers({
    tracks,
    onTracksChange: setTracks,
    samplesPerPixel,
    sampleRate,
  });

  // Drop zone state
  const [isDragging, setIsDragging] = useState(false);

  // Flag to auto-start recording after creating a new track
  const [shouldAutoStartRecording, setShouldAutoStartRecording] = useState(false);

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

  // Auto-start recording when a new track is created and selected
  useEffect(() => {
    if (shouldAutoStartRecording && selectedTrackId) {
      setShouldAutoStartRecording(false);
      startRecording();
    }
  }, [shouldAutoStartRecording, selectedTrackId, startRecording]);

  const handleRecordClick = () => {
    if (isRecording) {
      stopRecording();
      return;
    }

    // Auto-create track if none selected
    if (!selectedTrackId) {
      setShouldAutoStartRecording(true);
      onAddTrack();
      return;
    }

    // Track is selected, start recording immediately
    startRecording();
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

  // Auto-scroll to keep recording in view (only if automatic scroll is enabled)
  useEffect(() => {
    if (!isRecording || !isAutomaticScroll || !scrollContainerRef.current) return;

    const scrollContainer = scrollContainerRef.current;
    const controlWidth = controls.show ? controls.width : 0;

    // Calculate pixel position of recording end
    const recordingEndSample = recordingStartSample + Math.floor(duration * sampleRate);
    const recordingEndPixel = Math.floor(recordingEndSample / samplesPerPixel);

    // Get visible area (accounting for control width)
    const visibleStart = scrollContainer.scrollLeft;
    const visibleEnd = visibleStart + scrollContainer.clientWidth - controlWidth;

    // Add buffer zone (100px before edge)
    const bufferZone = 100;

    // Scroll if recording head is near or past the right edge
    if (recordingEndPixel > visibleEnd - bufferZone) {
      const targetScroll = recordingEndPixel - scrollContainer.clientWidth + controlWidth + bufferZone;
      scrollContainer.scrollLeft = Math.max(0, targetScroll);
    }
  }, [isRecording, isAutomaticScroll, duration, recordingStartSample, sampleRate, samplesPerPixel, controls]);

  // File drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));

    if (audioFiles.length === 0) {
      return;
    }

    // Create tracks from dropped files
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    for (const file of audioFiles) {
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

      const newTrack = createTrack({
        name: file.name,
        clips: [{
          id: `clip-${Date.now()}`,
          audioBuffer,
          startSample: 0,
          durationSamples: audioBuffer.length,
          offsetSamples: 0,
          gain: 1.0,
          name: file.name,
        }],
        muted: false,
        soloed: false,
        volume: 1.0,
        pan: 0,
      });

      setTracks([...tracks, newTrack]);
    }
  };

  return (
    <>
      {error && (
        <ErrorMessage>
          Error: {error.message}
        </ErrorMessage>
      )}

      {/* Recording Controls Row - Top */}
      <RecordingControlsRow>
        {!hasPermission ? (
          <EnableButton onClick={requestMicAccess}>
            🎤 Enable Microphone
          </EnableButton>
        ) : (
          <>
            <MicrophoneSelector
              devices={devices}
              selectedDeviceId={selectedDevice || undefined}
              onDeviceChange={changeDevice}
              disabled={isRecording}
            />
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
            <VUMeterWrapper>
              <Label>Input:</Label>
              <VUMeter level={level} peakLevel={peakLevel} width={200} height={20} />
            </VUMeterWrapper>
          </>
        )}
      </RecordingControlsRow>

      {/* Drop Zone */}
      <DropZone
        $isDragging={isDragging}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        <DropZoneText>
          Drop audio files here to create tracks, or click "+ New Track" to record on an empty track
        </DropZoneText>
        <NewTrackButton onClick={onAddTrack} style={{ marginTop: '10px' }}>
          + New Track
        </NewTrackButton>
      </DropZone>

      {/* Playback Controls Row - Bottom */}
      <PlaybackControlsRow>
        <ControlGroup>
          <PlayButton />
          <PauseButton />
          <StopButton />
        </ControlGroup>

        <ControlGroup>
          <ZoomInButton disabled={isRecording} />
          <ZoomOutButton disabled={isRecording} />
        </ControlGroup>

        <ControlGroup>
          <AudioPosition />
        </ControlGroup>

        <ControlGroup>
          <AutomaticScrollCheckbox />
        </ControlGroup>

        <ControlGroup>
          <MasterVolumeControl />
        </ControlGroup>
      </PlaybackControlsRow>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        modifiers={[restrictToHorizontalAxis, collisionModifier]}
      >
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
      </DndContext>
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
          Recording starts from max(cursor position, last clip end). Drag clips to reposition them!
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
