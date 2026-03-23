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
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  ZoomInButton,
  ZoomOutButton,
  AutomaticScrollCheckbox,
  useDynamicTracks,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
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

export function NewTracksExample() {
  const { theme } = useDocusaurusTheme();
  const { tracks, addTracks, removeTrack, loadingCount, isLoading, errors } = useDynamicTracks();

  const handleFiles = useCallback(
    (files: File[]) => {
      const audioFiles = files.filter((file) => file.type.startsWith('audio/'));
      if (audioFiles.length > 0) {
        addTracks(audioFiles);
      }
    },
    [addTracks]
  );

  const handleRemoveTrack = (index: number) => {
    const track = tracks[index];
    if (track) {
      removeTrack(track.id);
    }
  };

  return (
    <Container>
      <StyledDropZone
        accept="audio/*"
        onFiles={handleFiles}
        fileFilter={(f) => f.type.startsWith('audio/')}
        label="Drop audio files here to add tracks, or click to browse"
        dragLabel="Drop audio files here"
        loadingContent={
          isLoading ? (
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

      {errors.length > 0 && (
        <div role="alert" style={{
          padding: '0.75rem 1rem',
          marginBottom: '1rem',
          background: 'var(--ifm-color-danger-contrast-background, #fdf0ef)',
          border: '1px solid var(--ifm-color-danger-dark, #c0392b)',
          borderRadius: '0.5rem',
          color: 'var(--ifm-color-danger-darkest, #7f1d1d)',
          fontSize: '0.875rem',
        }}>
          {errors.map((e, i) => (
            <div key={i}>Failed to load &quot;{e.name}&quot;: {e.error.message}</div>
          ))}
        </div>
      )}

      {tracks.length > 0 && (
        <WaveformPlaylistProvider
          tracks={tracks}
          sampleRate={48000}
          samplesPerPixel={8192}
          zoomLevels={[512, 1024, 2048, 4096, 8192, 16384, 32768]}
          mono
          waveHeight={120}
          automaticScroll={true}
          controls={{ show: true, width: 200 }}
          theme={theme}
          timescale
          barWidth={4}
          barGap={0}
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

          <Waveform
            onRemoveTrack={handleRemoveTrack}
          />
        </WaveformPlaylistProvider>
      )}
    </Container>
  );
}
