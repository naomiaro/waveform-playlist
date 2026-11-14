/**
 * New Tracks Example
 *
 * Demonstrates dynamic track management:
 * - Drag and drop audio files to add tracks
 * - Remove tracks from the playlist
 * - Multiple tracks with independent controls
 */

import React, { useCallback, useState } from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  ZoomInButton,
  ZoomOutButton,
  AutomaticScrollCheckbox,
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  DefaultTrackControls,
  TrackRemoveButton,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  WaveformViewOptions,
  usePlaylistSources,
} from '@waveform-playlist/browser';
import { audioTrack, type PlaylistTrack } from '@waveform-playlist/core';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { RemoveFailedDrops, FailedDropsAlert, type FailedDrop } from '../../hooks/useRemoveFailedDrops';
import { FileDropZone } from '../FileDropZone';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding-right: 1rem;
  border-right: 1px solid var(--ifm-color-emphasis-300, #dee2e6);

  &:last-child {
    border-right: none;
  }
`;

const Subtext = styled.p`
  margin: 0.25rem 0 0 0;
  color: var(--ifm-color-emphasis-700, #6c757d);
  font-size: 0.875rem;
`;

const StyledDropZone = styled(FileDropZone)`
  margin-bottom: 1.5rem;
`;

interface TrackDropZoneProps {
  onFiles: (files: File[]) => void;
  /** Files still decoding (0 outside the provider: nothing is loading there). */
  loadingCount?: number;
}

const TrackDropZone: React.FC<TrackDropZoneProps> = ({ onFiles, loadingCount = 0 }) => (
  <StyledDropZone
    accept="audio/*"
    onFiles={onFiles}
    fileFilter={(f) => f.type.startsWith('audio/')}
    label="Drop audio files here to add tracks, or click to browse"
    dragLabel="Drop audio files here"
    loadingContent={
      loadingCount > 0 ? (
        <>
          <p style={{ margin: 0 }}>
            Decoding {loadingCount} file{loadingCount !== 1 ? 's' : ''}...
          </p>
          <Subtext>Placeholder tracks are shown below while audio decodes</Subtext>
        </>
      ) : undefined
    }
  >
    <Subtext>Supports MP3, WAV, OGG, and more</Subtext>
  </StyledDropZone>
);

// Inside the provider: the drop zone with the number of files still decoding,
// from the provider's source status.
const DropZoneWithStatus: React.FC<{ onFiles: (files: File[]) => void }> = ({ onFiles }) => {
  const { pendingCount } = usePlaylistSources();
  return <TrackDropZone onFiles={onFiles} loadingCount={pendingCount} />;
};

export function NewTracksExample() {
  const { theme } = useDocusaurusTheme();
  // One track per dropped file; the provider loads each one.
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);
  // Files that could not be decoded: their tracks are removed, the list stays.
  const [failures, setFailures] = useState<FailedDrop[]>([]);
  const handleFailed = useCallback((failure: FailedDrop) => {
    setFailures((prev) => [...prev, failure]);
  }, []);

  const handleFiles = useCallback((files: File[]) => {
    const audioFiles = files.filter((file) => file.type.startsWith('audio/'));
    if (audioFiles.length > 0) {
      setTracks((prev) => [...prev, ...audioFiles.map((file) => audioTrack({ src: file }))]);
    }
  }, []);

  const removeTrack = useCallback((trackId: string) => {
    setTracks((prev) => prev.filter((track) => track.id !== trackId));
  }, []);

  return (
    <Container>
      {tracks.length === 0 && (
        <>
          <TrackDropZone onFiles={handleFiles} />
          <FailedDropsAlert failures={failures} />
        </>
      )}

      {tracks.length > 0 && (
        <WaveformPlaylistProvider
          tracks={tracks}
          onTracksChange={setTracks}
          sampleRate={48000}
          samplesPerPixel={8192}
          zoomLevels={[512, 1024, 2048, 4096, 8192, 16384, 32768]}
          mono
          automaticScroll={true}
          theme={theme}
        >
          <RemoveFailedDrops setTracks={setTracks} onFailed={handleFailed} />
          <DropZoneWithStatus onFiles={handleFiles} />
          <FailedDropsAlert failures={failures} />

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
              <AutomaticScrollCheckbox />
            </ControlGroup>
          </Controls>

          <WaveformViewOptions waveHeight={120} barWidth={4} barGap={0}>
            <WaveformRoot>
              <WaveformTimescale />
              <WaveformLoopRegion />
              <WaveformTrackControls>
                <DefaultTrackControls />
                <TrackRemoveButton onRemove={removeTrack} />
              </WaveformTrackControls>
              <WaveformTracks />
              <WaveformSelection />
              <WaveformPlayhead />
            </WaveformRoot>
          </WaveformViewOptions>
        </WaveformPlaylistProvider>
      )}
    </Container>
  );
}
