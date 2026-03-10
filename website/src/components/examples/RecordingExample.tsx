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
import { createTrack, createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';
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
  ClipInteractionProvider,
  usePlaybackAnimation,
  usePlaylistData,
  usePlaylistControls,
  usePlaylistState,
  useOutputMeter,
  KeyboardShortcuts,
} from '@waveform-playlist/browser';
import { useIntegratedRecording } from '@waveform-playlist/recording';
import { RecordButton, MicrophoneSelector, RecordingIndicator } from './RecordingControls';
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { MicrophoneIcon, SpeakerHighIcon } from '@phosphor-icons/react';
import { FileDropZone } from '../FileDropZone';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const StyledDropZone = styled(FileDropZone)`
  margin-bottom: 1.5rem;
`;

const RecordingControlsRow = styled.div`
  display: flex;
  align-items: flex-end;
  gap: 1rem;
  flex-wrap: wrap;
`;

const ErrorCard = styled(Card)`
  background: var(--red-3);
  border: 1px solid var(--red-6);
  margin-bottom: 1rem;
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
  const { currentTime, isPlaying } = usePlaybackAnimation();
  const { sampleRate, samplesPerPixel, controls } = usePlaylistData();
  const { scrollContainerRef, setSelectedTrackId: setProviderSelectedTrackId } = usePlaylistControls();
  const { isAutomaticScroll } = usePlaylistState();

  // Sync provider's selectedTrackId with local state
  useEffect(() => {
    setProviderSelectedTrackId(selectedTrackId);
  }, [selectedTrackId, setProviderSelectedTrackId]);

  // Flag to auto-start recording after creating a new track
  const [shouldAutoStartRecording, setShouldAutoStartRecording] = useState(false);

  // Integrated recording hook
  const {
    isRecording,
    duration,
    level,
    peakLevel,
    levels: inputLevels,
    peakLevels: inputPeaks,
    devices,
    hasPermission,
    selectedDevice,
    startRecording,
    stopRecording,
    requestMicAccess,
    changeDevice,
    error,
    recordingPeaks,
  } = useIntegratedRecording(tracks, setTracks, selectedTrackId, { currentTime, channelCount: 2 });

  // Output meter for master bus
  const { levels: outputLevels, peakLevels: outputPeaks } = useOutputMeter({ channelCount: 2, isPlaying });

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

  // Handle dropped/selected audio files
  const handleFiles = useCallback(
    async (files: File[]) => {
      const audioFiles = files.filter(file => file.type.startsWith('audio/'));
      if (audioFiles.length === 0) return;

      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

      for (const file of audioFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        const clip = createClipFromSeconds({
          audioBuffer,
          startTime: 0,
          name: file.name,
        });

        const newTrack = createTrack({
          name: file.name,
          clips: [clip],
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

  const handleRemoveTrack = useCallback(
    async (trackIndex: number) => {
      const trackToRemove = tracks[trackIndex];
      if (!trackToRemove) return;

      // Stop recording if we're removing the track being recorded to
      // Must await so the recorded clip is saved before the track is removed
      if (isRecording && trackToRemove.id === selectedTrackId) {
        await stopRecording();
      }

      // Clear selection if removed track was selected
      if (trackToRemove.id === selectedTrackId) {
        setSelectedTrackId(null);
      }

      setTracks(tracks.filter((_, i) => i !== trackIndex));
    },
    [tracks, setTracks, selectedTrackId, setSelectedTrackId, isRecording, stopRecording]
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

      {/* Controls Bar */}
      <Card style={{ marginBottom: '1.5rem' }}>
        <Flex gap="3" align="center" wrap="wrap">
          {/* Recording Controls */}
          {!hasPermission ? (
            <Button size="2" variant="solid" color="blue" onClick={requestMicAccess}>
              <MicrophoneIcon size={18} weight="light" style={{ marginRight: '6px' }} /> Enable Mic
            </Button>
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
            </>
          )}

          <Separator orientation="vertical" />

          {/* Playback Controls */}
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
            label="Export"
            filename="recording"
          />

          <Separator orientation="vertical" />

          {/* Inline VU Meters — always visible */}
          <Flex gap="3" align="center">
            <Flex gap="1" align="center">
              <MicrophoneIcon size={14} weight="bold" style={{ color: 'var(--gray-9)', flexShrink: 0 }} />
              <SegmentedVUMeter
                levels={inputLevels}
                peakLevels={inputPeaks}
                orientation="horizontal"
                segmentCount={40}
                segmentWidth={14}
                segmentHeight={4}
                segmentGap={1}
                coloredInactive
                labelColor="var(--gray-9)"
              />
            </Flex>
            <Flex gap="1" align="center">
              <SpeakerHighIcon size={14} weight="bold" style={{ color: 'var(--gray-9)', flexShrink: 0 }} />
              <SegmentedVUMeter
                levels={outputLevels}
                peakLevels={outputPeaks}
                orientation="horizontal"
                segmentCount={40}
                segmentWidth={14}
                segmentHeight={4}
                segmentGap={1}
                coloredInactive
              />
            </Flex>
          </Flex>
        </Flex>
      </Card>

      {/* Waveform */}
      <ClipInteractionProvider>
        <Waveform
          showClipHeaders
          onRemoveTrack={handleRemoveTrack}
          recordingState={
            isRecording && selectedTrackId
              ? {
                  isRecording: true,
                  trackId: selectedTrackId,
                  startSample: recordingStartSample,
                  durationSamples: Math.floor(duration * sampleRate),
                  peaks: recordingPeaks,
                  bits: 16,
                }
              : undefined
          }
        />
      </ClipInteractionProvider>

      {tracks.length === 0 && (
        <Flex justify="center" style={{ padding: '3rem', color: 'var(--gray-9)' }}>
          <Text size="2">
            Click &quot;+ New Track&quot; to add a track, then start recording!
          </Text>
        </Flex>
      )}

      {/* Drop Zone */}
      <StyledDropZone
        accept="audio/*"
        onFiles={handleFiles}
        fileFilter={(f) => f.type.startsWith('audio/')}
        label="Drop audio files or click to browse"
        dragLabel="Drop audio files here"
      >
        <Button size="2" variant="solid" color="blue" style={{ marginTop: '0.5rem' }} onClick={(e) => {
          e.stopPropagation();
          onAddTrack();
        }}>
          + New Track
        </Button>
      </StyledDropZone>
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
          onTracksChange={setTracks}
          samplesPerPixel={1024}
          zoomLevels={[256, 512, 1024, 2048, 4096]}
          waveHeight={100}
          automaticScroll={true}
          controls={{ show: true, width: 200 }}
          theme={theme}
          timescale
          barWidth={1}
          barGap={0}
        >
          <KeyboardShortcuts playback />
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
