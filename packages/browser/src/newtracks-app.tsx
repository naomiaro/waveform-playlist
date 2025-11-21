/**
 * New Tracks Example App
 *
 * Demonstrates dynamic track management:
 * - Drag and drop audio files to add tracks
 * - Remove tracks from the playlist
 * - Multiple tracks with independent controls
 */

import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
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
} from './components';
import { TrackControlsWithDelete } from '@waveform-playlist/ui-components';
import { Track } from '@waveform-playlist/core';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 1rem;
  background: #f8f9fa;
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
`;

const ControlGroup = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding-right: 1rem;
  border-right: 1px solid #dee2e6;

  &:last-child {
    border-right: none;
  }
`;

const DropZone = styled.div<{ $isDragging: boolean }>`
  padding: 3rem 2rem;
  border: 3px dashed ${(props) => (props.$isDragging ? '#3498db' : '#ced4da')};
  border-radius: 0.5rem;
  text-align: center;
  background: ${(props) => (props.$isDragging ? '#e3f2fd' : '#f8f9fa')};
  margin-bottom: 1.5rem;
  transition: all 0.2s ease-in-out;
  cursor: pointer;

  &:hover {
    border-color: #3498db;
    background: #e3f2fd;
  }
`;

const DropZoneText = styled.p`
  margin: 0;
  color: #495057;
  font-size: 1rem;
`;

const DropZoneSubtext = styled.p`
  margin: 0.5rem 0 0 0;
  color: #6c757d;
  font-size: 0.875rem;
`;

const HiddenFileInput = styled.input`
  display: none;
`;

function NewTracksApp() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Handle file drop
  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);

      const files = Array.from(e.dataTransfer.files).filter((file) =>
        file.type.startsWith('audio/')
      );

      if (files.length > 0) {
        addFiles(files);
      }
    },
    [tracks]
  );

  // Handle file input change
  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (files && files.length > 0) {
        addFiles(Array.from(files));
      }
    },
    [tracks]
  );

  // Add files as tracks
  const addFiles = (files: File[]) => {
    const newTracks: Track[] = files.map((file) => {
      // Create an object URL for the file
      const url = URL.createObjectURL(file);

      return {
        src: url,
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        gain: 1,
        muted: false,
        stereoPan: 0,
      };
    });

    setTracks([...tracks, ...newTracks]);
  };

  // Remove a track
  const handleRemoveTrack = (index: number) => {
    const newTracks = tracks.filter((_, i) => i !== index);
    setTracks(newTracks);
  };

  // Handle drag events
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Handle click to open file picker
  const handleDropZoneClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <Container>
      <DropZone
        $isDragging={isDragging}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleDropZoneClick}
      >
        <DropZoneText>
          {isDragging ? '📂 Drop audio files here' : '🎵 Drop audio files here to add tracks'}
        </DropZoneText>
        <DropZoneSubtext>
          or click to browse (supports MP3, WAV, OGG, and more)
        </DropZoneSubtext>
      </DropZone>

      <HiddenFileInput
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        multiple
        onChange={handleFileInput}
      />

      {tracks.length > 0 && (
        <WaveformPlaylistProvider
          tracks={tracks}
          samplesPerPixel={2048}
          controls={{ show: true, width: 200 }}
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
          </Controls>

          <Waveform
            renderTrackControls={(trackIndex) => {
              const track = tracks[trackIndex];
              if (!track) return null;

              return (
                <TrackControlsWithDelete
                  trackIndex={trackIndex}
                  trackName={track.name}
                  muted={track.muted || false}
                  soloed={false}
                  volume={track.gain || 1}
                  pan={track.stereoPan || 0}
                  onMuteChange={(muted) => {
                    const updatedTracks = [...tracks];
                    updatedTracks[trackIndex] = { ...track, muted };
                    setTracks(updatedTracks);
                  }}
                  onSoloChange={() => {
                    // Solo not implemented in this example
                  }}
                  onVolumeChange={(volume) => {
                    const updatedTracks = [...tracks];
                    updatedTracks[trackIndex] = { ...track, gain: volume };
                    setTracks(updatedTracks);
                  }}
                  onPanChange={(pan) => {
                    const updatedTracks = [...tracks];
                    updatedTracks[trackIndex] = { ...track, stereoPan: pan };
                    setTracks(updatedTracks);
                  }}
                  onDelete={() => handleRemoveTrack(trackIndex)}
                />
              );
            }}
          />
        </WaveformPlaylistProvider>
      )}
    </Container>
  );
}

// Mount the app
const container = document.getElementById('playlist');
if (container) {
  const root = createRoot(container);
  root.render(<NewTracksApp />);
}
