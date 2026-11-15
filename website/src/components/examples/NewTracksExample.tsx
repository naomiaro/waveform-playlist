/**
 * New Tracks Example
 *
 * Demonstrates dynamic track management:
 * - Drag and drop audio files to add tracks
 * - Remove tracks from the playlist
 * - Multiple tracks with independent controls
 */

import React, { useCallback } from 'react';
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
  useCreateArrangement,
  useArrangementTracks,
  useArrangementSources,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { FileDropZone } from '../FileDropZone';
import { FailedDropsAlert, useFailedDrops } from './FailedDrops';

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

export function NewTracksExample() {
  const { theme } = useDocusaurusTheme();
  // Starts empty: one track per dropped file, and the arrangement loads each one
  const arrangement = useCreateArrangement();
  const tracks = useArrangementTracks(arrangement);
  const sources = useArrangementSources(arrangement);
  const loadingCount = sources.pendingCount;
  // A dropped file whose audio failed is taken out again (not an undo step,
  // so no undo brings it back) and listed with its error
  const failedDrops = useFailedDrops(arrangement);

  const handleFiles = useCallback(
    (files: File[]) => {
      const audioFiles = files.filter((file) => file.type.startsWith('audio/'));
      // The track is named after the file, without its extension
      audioFiles.forEach((file) => arrangement.addTrack(audioTrack({ src: file })));
    },
    [arrangement]
  );

  const removeTrack = useCallback(
    (trackId: string) => arrangement.removeTrack(trackId),
    [arrangement]
  );

  return (
    <Container>
      <StyledDropZone
        accept="audio/*"
        onFiles={handleFiles}
        fileFilter={(f) => f.type.startsWith('audio/')}
        label="Drop audio files here to add tracks, or click to browse"
        dragLabel="Drop audio files here"
        loading={sources.isLoading}
        loadingContent={
          <>
            <p style={{ margin: 0, fontSize: '0.9rem' }}>
              Decoding {loadingCount} file{loadingCount !== 1 ? 's' : ''}...
            </p>
            <Subtext>Placeholder tracks are shown below while audio decodes</Subtext>
          </>
        }
      >
        <Subtext>Supports MP3, WAV, OGG, and more</Subtext>
      </StyledDropZone>

      <FailedDropsAlert drops={failedDrops} />

      {tracks.length > 0 && (
        <WaveformPlaylistProvider
          arrangement={arrangement}
          sampleRate={48000}
          samplesPerPixel={8192}
          zoomLevels={[512, 1024, 2048, 4096, 8192, 16384, 32768]}
          mono
          automaticScroll={true}
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
