/**
 * Recording Example
 *
 * Demonstrates multi-track recording functionality:
 * - Live microphone recording with real-time waveform
 * - Multiple track recording
 * - Drag & drop audio file import
 * - VU meter for input level monitoring
 * - Recording starts from max(cursor position, last clip end)
 * - Auto-scroll keeps recording in view
 */

import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { Theme, Button, Flex, Card, Text, Separator } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import { DndContext } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
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
  ExportWavButton,
  usePlaybackAnimation,
  usePlaylistData,
  usePlaylistControls,
  usePlaylistState,
  useClipDragHandlers,
  useDragSensors,
  useIntegratedRecording,
} from '@waveform-playlist/browser';
import {
  RecordButton,
  MicrophoneSelector,
  VUMeter,
  RecordingIndicator,
} from '@waveform-playlist/recording';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { MicrophoneIcon, FolderOpenIcon, MusicNotesIcon } from '@phosphor-icons/react';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const DropZone = styled.div<{ $isDragging: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1.5rem 2rem;
  border: 2px dashed ${props => props.$isDragging ? 'var(--accent-9)' : 'var(--gray-6)'};
  border-radius: var(--radius-3);
  background: ${props => props.$isDragging ? 'var(--accent-3)' : 'var(--gray-2)'};
  text-align: center;
  transition: all 0.2s ease;
  cursor: pointer;
  margin-bottom: 1.5rem;

  &:hover {
    border-color: var(--accent-9);
    background: var(--gray-3);
  }
`;

const VUMeterWrapper = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  background: var(--gray-3);
  border-radius: var(--radius-2);
`;

const RecordingControlsRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
`;

const Label = styled.span`
  font-size: 0.875rem;
  color: var(--gray-11);
  font-weight: 500;
`;

const ErrorCard = styled(Card)`
  background: var(--red-3);
  border: 1px solid var(--red-6);
  margin-bottom: 1rem;
`;

const HiddenFileInput = styled.input`
  display: none;
`;

// Inner component that uses playlist context
interface RecordingControlsInnerProps {
  tracks: ClipTrack[];
  setTracks: (tracks: ClipTrack[]) => void;
  selectedTrackId: string | null;
  setSelectedTrackId: (id: string | null) => void;
  onAddTrack: () => void;
}

const RecordingControlsInner: React.FC<RecordingControlsInnerProps> = ({
  tracks,
  setTracks,
  selectedTrackId,
  setSelectedTrackId,
  onAddTrack,
}) => {
  const { currentTime } = usePlaybackAnimation();
  const { sampleRate, samplesPerPixel, controls } = usePlaylistData();
  const { scrollContainerRef, setSelectedTrackId: setProviderSelectedTrackId } = usePlaylistControls();
  const { isAutomaticScroll } = usePlaylistState();

  // Sync provider's selectedTrackId with local state
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
  const fileInputRef = React.useRef<HTMLInputElement>(null);

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

  // Auto-scroll to keep recording in view
  useEffect(() => {
    if (!isRecording || !isAutomaticScroll || !scrollContainerRef.current) return;

    const scrollContainer = scrollContainerRef.current;
    const controlWidth = controls.show ? controls.width : 0;

    const recordingEndSample = recordingStartSample + Math.floor(duration * sampleRate);
    const recordingEndPixel = Math.floor(recordingEndSample / samplesPerPixel);

    const visibleStart = scrollContainer.scrollLeft;
    const visibleEnd = visibleStart + scrollContainer.clientWidth - controlWidth;
    const bufferZone = 100;

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

    const files = Array.from(e.dataTransfer.files) as File[];
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));

    if (audioFiles.length === 0) return;

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

  const handleFileInput = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files || files.length === 0) return;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioFiles = (Array.from(files) as File[]).filter(file => file.type.startsWith('audio/'));

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
    },
    [tracks, setTracks]
  );

  return (
    <>
      {error && (
        <ErrorCard>
          <Text size="2" color="red">
            Error: {error.message}
          </Text>
        </ErrorCard>
      )}

      {/* Recording Controls */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <Flex direction="column" gap="3">
          {!hasPermission ? (
            <Button size="3" variant="solid" color="blue" onClick={requestMicAccess}>
              <MicrophoneIcon size={18} weight="light" style={{ marginRight: '6px' }} /> Enable Microphone
            </Button>
          ) : (
            <RecordingControlsRow>
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
            </RecordingControlsRow>
          )}
        </Flex>
      </Card>

      {/* Drop Zone */}
      <DropZone
        $isDragging={isDragging}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <Text size="3" weight="medium">
          {isDragging ? <><FolderOpenIcon size={18} weight="light" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} /> Drop audio files here</> : <><MusicNotesIcon size={18} weight="light" style={{ marginRight: '6px', verticalAlign: 'text-bottom' }} /> Drop audio files or click to browse</>}
        </Text>
        <Text size="2" color="gray">
          Supports MP3, WAV, OGG, and more
        </Text>
        <Button size="2" variant="solid" color="blue" style={{ marginTop: '0.5rem' }} onClick={(e) => {
          e.stopPropagation();
          onAddTrack();
        }}>
          + New Track
        </Button>
      </DropZone>

      <HiddenFileInput
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileInput}
      />

      {/* Playback Controls */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <Flex gap="3" align="center" wrap="wrap">
          <Flex gap="2">
            <PlayButton />
            <PauseButton />
            <StopButton />
          </Flex>

          <Separator orientation="vertical" />

          <Flex gap="2">
            <ZoomInButton disabled={isRecording} />
            <ZoomOutButton disabled={isRecording} />
          </Flex>

          <Separator orientation="vertical" />

          <AudioPosition />

          <Separator orientation="vertical" />

          <AutomaticScrollCheckbox />

          <Separator orientation="vertical" />

          <MasterVolumeControl />

          <Separator orientation="vertical" />

          <ExportWavButton
            label="Export Recording"
            filename="recording"
          />
        </Flex>
      </Card>

      <DndContext
        sensors={sensors}
        onDragStart={onDragStart}
        onDragMove={onDragMove}
        onDragEnd={onDragEnd}
        modifiers={[restrictToHorizontalAxis, collisionModifier]}
      >
        <Waveform
          showClipHeaders
          interactiveClips
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

      {tracks.length === 0 && (
        <Flex justify="center" style={{ padding: '3rem', color: 'var(--gray-9)' }}>
          <Text size="2">
            Click "+ New Track" to add a track, then start recording!
          </Text>
        </Flex>
      )}
    </>
  );
};

// Main component
export function RecordingExample() {
  const { theme, isDarkMode: isDark } = useDocusaurusTheme();
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
    setSelectedTrackId(newTrack.id);
  };

  return (
    <Theme appearance={isDark ? 'dark' : 'light'} accentColor="blue" grayColor="slate" radius="medium">
      <Container>
        <WaveformPlaylistProvider
          tracks={tracks}
          samplesPerPixel={1024}
          zoomLevels={[256, 512, 1024, 2048, 4096]}
          mono
          waveHeight={100}
          automaticScroll={true}
          controls={{ show: true, width: 200 }}
          theme={theme}
          timescale
          barWidth={1}
          barGap={0}
        >
          <RecordingControlsInner
            tracks={tracks}
            setTracks={setTracks}
            selectedTrackId={selectedTrackId}
            setSelectedTrackId={setSelectedTrackId}
            onAddTrack={handleAddTrack}
          />
        </WaveformPlaylistProvider>
      </Container>
    </Theme>
  );
}
