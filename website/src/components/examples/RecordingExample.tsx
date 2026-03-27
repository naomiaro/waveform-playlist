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

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import styled from 'styled-components';
import { Theme, Button, Text } from '@radix-ui/themes';
import '@radix-ui/themes/styles.css';
import { createTrack, type ClipTrack } from '@waveform-playlist/core';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { decodeAudioFiles } from '../../utils/decodeAudioFiles';
import {
  WaveformPlaylistProvider,
  Waveform,
  // PlayButton, PauseButton, StopButton omitted — recording example uses
  // custom versions that are disabled during recording
  AudioPosition,
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
import {
  RecordButton,
  TransportPlayButton,
  TransportPauseButton,
  TransportStopButton,
  RewindButton,
  MicrophoneSelector,
} from './RecordingControls';
import { SegmentedVUMeter, BaseControlButton } from '@waveform-playlist/ui-components';
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

// --- DAW Toolbar ---

const Toolbar = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--gray-6);
  border-radius: 6px;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  min-height: 44px;
  overflow: hidden;
`;

const ToolbarSection = styled.div<{ $grow?: boolean; $noBorder?: boolean }>`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 8px;
  border-right: ${(props) => (props.$noBorder ? 'none' : '1px solid var(--gray-5)')};
  ${(props) => props.$grow && 'flex: 1; min-width: 0; overflow: hidden;'}
  white-space: nowrap;
  flex-shrink: 0;
  ${(props) => props.$grow && 'flex-shrink: 1;'}
`;

const MeterLabel = styled.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--gray-9);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  min-width: 28px;
  user-select: none;
`;

const MeterChannel = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
`;

const MeterGroup = styled.div`
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex-shrink: 0;
`;

const BottomBar = styled.div`
  background: var(--color-surface);
  border: 1px solid var(--gray-6);
  border-radius: 6px;
  padding: 6px 12px;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ErrorBanner = styled.div`
  background: var(--red-3);
  border: 1px solid var(--red-6);
  border-radius: 6px;
  padding: 8px 12px;
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
  const { currentTime, isPlaying, currentTimeRef } = usePlaybackAnimation();
  const { sampleRate, samplesPerPixel, controls } = usePlaylistData();
  const { scrollContainerRef, setSelectedTrackId: setProviderSelectedTrackId, play, stop, pause, seekTo } = usePlaylistControls();
  const {
    isAutomaticScroll,
    selectionStart,
    selectionEnd,
    isLoopEnabled,
    selectedTrackId: providerSelectedTrackId,
  } = usePlaylistState();

  // Sync local → provider when local state changes (e.g. auto-create track)
  useEffect(() => {
    setProviderSelectedTrackId(selectedTrackId);
  }, [selectedTrackId, setProviderSelectedTrackId]);

  // Sync provider → local when user clicks a track in the waveform area.
  // Only react to provider changes (not local), to avoid overwriting local
  // state with stale provider values during auto-create track flows.
  const prevProviderTrackIdRef = useRef(providerSelectedTrackId);
  useEffect(() => {
    if (providerSelectedTrackId !== prevProviderTrackIdRef.current) {
      prevProviderTrackIdRef.current = providerSelectedTrackId;
      setSelectedTrackId(providerSelectedTrackId);
    }
  }, [providerSelectedTrackId, setSelectedTrackId]);

  // Flag to auto-start recording after creating a new track
  const [shouldAutoStartRecording, setShouldAutoStartRecording] = useState(false);

  // Capture timeline position at record start for live preview positioning
  const recordStartTimeRef = useRef(0);

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
    stream,
    startRecording,
    stopRecording,
    requestMicAccess,
    changeDevice,
    error,
    recordingPeaks,
  } = useIntegratedRecording(tracks, setTracks, selectedTrackId, { currentTime, channelCount: 2 });

  // Sample rate info — flag potential resampling between mic and AudioContext
  const micSampleRate = stream?.getAudioTracks()[0]?.getSettings()?.sampleRate ?? null;
  const ctxSampleRate = sampleRate;
  const isResampling = micSampleRate != null && ctxSampleRate > 0 && micSampleRate !== ctxSampleRate;

  // Output meter for master bus
  const { levels: outputLevels, peakLevels: outputPeaks } = useOutputMeter({ channelCount: 2, isPlaying });

  // Auto-request mic access on mount
  useEffect(() => {
    if (!hasPermission) {
      requestMicAccess().catch(() => {
        // Error already surfaced via useIntegratedRecording's error state
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Start recording and playback together (overdub)
  const startRecordingWithPlayback = useCallback(async () => {
    // Read from ref to avoid stale closure (currentTime updates at 60fps)
    recordStartTimeRef.current = currentTimeRef.current;
    await startRecording();
    // Start Transport so playhead advances and user hears existing tracks (overdub)
    await play(currentTimeRef.current);
  }, [startRecording, play, currentTimeRef]);

  // Auto-start recording when a new track is created and selected
  useEffect(() => {
    if (shouldAutoStartRecording && selectedTrackId) {
      setShouldAutoStartRecording(false);
      startRecordingWithPlayback();
    }
  }, [shouldAutoStartRecording, selectedTrackId, startRecordingWithPlayback]);

  // Rewind to start
  const handleRewind = useCallback(() => {
    stop();
    seekTo(0);
  }, [stop, seekTo]);

  // Play with selection/loop awareness (mirrors PlayButton logic)
  const handlePlay = useCallback(async () => {
    const hasSelection = selectionStart !== selectionEnd && selectionEnd > selectionStart;
    if (hasSelection && !isLoopEnabled) {
      const duration = selectionEnd - selectionStart;
      await play(selectionStart, duration);
    } else {
      await play(currentTimeRef.current ?? 0);
    }
  }, [selectionStart, selectionEnd, isLoopEnabled, play, currentTimeRef]);

  // Stop both playback and recording
  const handleStop = useCallback(() => {
    if (isRecording) {
      stopRecording();
    }
    stop();
  }, [isRecording, stopRecording, stop]);

  const handleRecordClick = (e: React.MouseEvent) => {
    if (isRecording) return;

    // Shift+click: always create a new track (like Shift+R)
    if (e.shiftKey) {
      setShouldAutoStartRecording(true);
      onAddTrack();
      return;
    }

    // Auto-create track if none selected
    if (!selectedTrackId) {
      setShouldAutoStartRecording(true);
      onAddTrack();
      return;
    }

    // Track is selected, start recording immediately
    startRecordingWithPlayback();
  };

  // Shift+R: always create a new track and record on it
  const handleForceNewTrackRecord = useCallback(() => {
    if (isRecording || !hasPermission) return;
    setShouldAutoStartRecording(true);
    onAddTrack();
  }, [isRecording, hasPermission, onAddTrack]);

  // R: record on selected track (auto-create if none selected)
  const handleRecordShortcut = useCallback(() => {
    if (isRecording || !hasPermission) return;

    if (!selectedTrackId) {
      setShouldAutoStartRecording(true);
      onAddTrack();
      return;
    }

    startRecordingWithPlayback();
  }, [isRecording, hasPermission, selectedTrackId, onAddTrack, startRecordingWithPlayback]);

  // Toggle play/pause
  const handleTogglePlayPause = useCallback(() => {
    if (isPlaying) {
      pause();
    } else {
      handlePlay();
    }
  }, [isPlaying, pause, handlePlay]);

  // All keyboard shortcuts — no presets, fully recording-aware
  const allShortcuts = useMemo(() => [
    {
      key: ' ',
      action: handleTogglePlayPause,
      description: 'Play/Pause',
      preventDefault: true,
    },
    {
      key: 'Escape',
      action: handleStop,
      description: 'Stop playback and recording',
      preventDefault: true,
    },
    {
      key: '0',
      action: handleRewind,
      description: 'Rewind to start',
      preventDefault: true,
    },
    {
      key: 'r',
      shiftKey: true,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      action: handleForceNewTrackRecord,
      description: 'Create new track and record',
      preventDefault: true,
    },
    {
      key: 'r',
      shiftKey: false,
      metaKey: false,
      ctrlKey: false,
      altKey: false,
      action: handleRecordShortcut,
      description: 'Record on selected track',
      preventDefault: true,
    },
  ], [handleTogglePlayPause, handleStop, handleRewind, handleRecordShortcut, handleForceNewTrackRecord]);

  // Calculate recording start position for live preview
  // Uses captured start time (not live currentTime which advances during overdub)
  let recordingStartSample = 0;
  if (isRecording && selectedTrackId) {
    const selectedTrack = tracks.find(t => t.id === selectedTrackId);
    if (selectedTrack) {
      const startTimeSamples = Math.floor(recordStartTimeRef.current * sampleRate);
      let lastClipEndSample = 0;
      if (selectedTrack.clips.length > 0) {
        const endSamples = selectedTrack.clips.map(clip =>
          clip.startSample + clip.durationSamples
        );
        lastClipEndSample = Math.max(...endSamples);
      }
      recordingStartSample = Math.max(startTimeSamples, lastClipEndSample);
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

      const audioContext = getGlobalAudioContext();
      const newTracks = await decodeAudioFiles(audioContext, audioFiles);
      if (newTracks.length > 0) setTracks(prev => [...prev, ...newTracks]);
    },
    [setTracks]
  );

  const handleRemoveTrack = useCallback(
    async (trackIndex: number) => {
      const trackToRemove = tracks[trackIndex];
      if (!trackToRemove) return;

      // Stop recording if we're removing the track being recorded to
      // Must await so the recorded clip is saved before the track is removed
      if (isRecording && trackToRemove.id === selectedTrackId) {
        await stopRecording();
        stop();
      }

      // Clear selection if removed track was selected
      if (trackToRemove.id === selectedTrackId) {
        setSelectedTrackId(null);
      }

      setTracks(tracks.filter((_, i) => i !== trackIndex));
    },
    [tracks, setTracks, selectedTrackId, setSelectedTrackId, isRecording, stopRecording, stop]
  );

  return (
    <>
      <KeyboardShortcuts additionalShortcuts={allShortcuts} />
      {error && (
        <ErrorBanner>
          <Text size="2" color="red">
            Error: {error.message}
          </Text>
        </ErrorBanner>
      )}

      {/* DAW Toolbar — single row */}
      <Toolbar>
        {/* Transport */}
        <ToolbarSection>
          <RewindButton onClick={handleRewind} disabled={isRecording} />
          <TransportPlayButton onClick={handlePlay} disabled={isPlaying || isRecording} active={isPlaying} />
          <RecordButton
            isRecording={isRecording}
            onClick={handleRecordClick}
            disabled={!hasPermission}
          />
          <TransportPauseButton onClick={pause} disabled={!isPlaying} />
          <TransportStopButton onClick={handleStop} disabled={!isPlaying && !isRecording} />
        </ToolbarSection>

        {/* Mic selector */}
        <ToolbarSection>
          {!hasPermission ? (
            <Button size="1" variant="soft" color="blue" onClick={requestMicAccess}>
              <MicrophoneIcon size={14} weight="light" /> Enable Mic
            </Button>
          ) : (
            <MicrophoneSelector
              devices={devices}
              selectedDeviceId={selectedDevice || undefined}
              onDeviceChange={changeDevice}
              disabled={isRecording}
              hint={
                micSampleRate != null ? (
                  <>
                    <MicrophoneIcon size={10} weight="bold" /> {micSampleRate}Hz &rarr;{' '}
                    <SpeakerHighIcon size={10} weight="bold" /> {ctxSampleRate}Hz
                    {isResampling && ' (resampling)'}
                  </>
                ) : undefined
              }
            />
          )}
        </ToolbarSection>

        {/* Meters */}
        <ToolbarSection $grow>
          <MeterGroup>
            <MeterChannel>
              <MicrophoneIcon size={12} weight="bold" style={{ color: 'var(--gray-9)', flexShrink: 0 }} />
              <MeterLabel>In</MeterLabel>
              <SegmentedVUMeter
                levels={inputLevels}
                peakLevels={inputPeaks}
                orientation="horizontal"
                segmentCount={40}
                segmentWidth={14}
                segmentHeight={4}
                segmentGap={1}
                dBRange={[-50, 0]}
                coloredInactive
                labelColor="var(--gray-9)"
              />
            </MeterChannel>
            <MeterChannel>
              <SpeakerHighIcon size={12} weight="bold" style={{ color: 'var(--gray-9)', flexShrink: 0 }} />
              <MeterLabel>Out</MeterLabel>
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
            </MeterChannel>
          </MeterGroup>
        </ToolbarSection>

        <ToolbarSection $noBorder>
          <BaseControlButton onClick={onAddTrack}>
            + New Track
          </BaseControlButton>
          <ExportWavButton
            label="Export"
            filename="recording"
          />
        </ToolbarSection>
      </Toolbar>

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

      {/* Position display — bottom bar */}
      <BottomBar>
        <AudioPosition />
      </BottomBar>

      {tracks.length === 0 && (
        <div style={{ padding: '3rem', color: 'var(--gray-9)', textAlign: 'center' }}>
          <Text size="2">
            Click &quot;+ New Track&quot; in the toolbar to add a track, then start recording!
          </Text>
        </div>
      )}

      {/* Drop Zone */}
      <StyledDropZone
        accept="audio/*"
        onFiles={handleFiles}
        fileFilter={(f) => f.type.startsWith('audio/')}
        label="Drop audio files or click to browse"
        dragLabel="Drop audio files here"
      />
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
          sampleRate={48000}
          onTracksChange={setTracks}
          samplesPerPixel={1024}
          zoomLevels={[256, 512, 1024, 2048, 4096]}
          waveHeight={100}
          automaticScroll
          indefinitePlayback
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
