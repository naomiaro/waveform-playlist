import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { DndContext } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { createTrack, createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  usePlaylistData,
  usePlaylistControls,
  useClipDragHandlers,
  useDragSensors,
  useClipSplitting,
  useKeyboardShortcuts,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  ZoomInButton,
  ZoomOutButton,
  AudioPosition,
  AutomaticScrollCheckbox,
  MasterVolumeControl,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

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
  border-right: 1px solid var(--ifm-color-emphasis-300, #ddd);

  &:last-child {
    border-right: none;
  }
`;

// Audio files - each file is loaded and decoded once
const audioFiles = [
  { id: 'vocals', src: '/waveform-playlist/media/audio/Vocals30.mp3' },
  { id: 'guitar', src: '/waveform-playlist/media/audio/Guitar30.mp3' },
  { id: 'piano', src: '/waveform-playlist/media/audio/PianoSynth30.mp3' },
  { id: 'bass', src: '/waveform-playlist/media/audio/BassDrums30.mp3' },
];

// Track configuration with multiple clips demonstrating gaps and positioning
const trackConfigs = [
  {
    name: 'Vocals',
    clips: [
      { fileId: 'vocals', startTime: 0, duration: 10, offset: 0 },
      { fileId: 'vocals', startTime: 20, duration: 10, offset: 20 },
    ],
  },
  {
    name: 'Guitar',
    clips: [
      { fileId: 'guitar', startTime: 0, duration: 30, offset: 0 },
    ],
  },
  {
    name: 'Piano',
    clips: [
      { fileId: 'piano', startTime: 5, duration: 10, offset: 5 },
      { fileId: 'piano', startTime: 20, duration: 10, offset: 20 },
    ],
  },
  {
    name: 'Bass',
    clips: [
      { fileId: 'bass', startTime: 0, duration: 8, offset: 0 },
      { fileId: 'bass', startTime: 10, duration: 6, offset: 10 },
      { fileId: 'bass', startTime: 20, duration: 10, offset: 20 },
    ],
  },
];

interface PlaylistWithDragProps {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
}

const PlaylistWithDrag: React.FC<PlaylistWithDragProps> = ({ tracks, onTracksChange }) => {
  const { samplesPerPixel, sampleRate } = usePlaylistData();
  const { setSelectedTrackId } = usePlaylistControls();

  const sensors = useDragSensors();
  const { onDragStart: handleDragStart, onDragMove, onDragEnd, collisionModifier } = useClipDragHandlers({
    tracks,
    onTracksChange,
    samplesPerPixel,
    sampleRate,
  });

  const onDragStart = (event: any) => {
    const trackIndex = event.active?.data?.current?.trackIndex;
    if (trackIndex !== undefined && tracks[trackIndex]) {
      setSelectedTrackId(tracks[trackIndex].id);
    }
    handleDragStart(event);
  };

  const { splitClipAtPlayhead } = useClipSplitting({
    tracks,
    onTracksChange,
    sampleRate,
    samplesPerPixel,
  });

  useKeyboardShortcuts({
    shortcuts: [
      {
        key: 's',
        action: splitClipAtPlayhead,
        description: 'Split clip at playhead',
        preventDefault: true,
      },
    ],
  });

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={[restrictToHorizontalAxis, collisionModifier]}
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
        <ControlGroup>
          <MasterVolumeControl />
        </ControlGroup>
      </Controls>

      <Waveform showClipHeaders={true} />
    </DndContext>
  );
};

export function MultiClipExample() {
  const theme = useDocusaurusTheme();
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadTracks = async () => {
      try {
        setLoading(true);
        setError(null);

        const audioContext = getGlobalAudioContext();

        // Load all audio files
        const fileLoadPromises = audioFiles.map(async (file) => {
          const response = await fetch(file.src);
          if (!response.ok) {
            throw new Error(`Failed to fetch ${file.src}: ${response.statusText}`);
          }

          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

          return { id: file.id, buffer: audioBuffer };
        });

        const loadedFiles = await Promise.all(fileLoadPromises);
        const fileBuffers = new Map(loadedFiles.map(f => [f.id, f.buffer]));

        // Create tracks
        const loadedTracks = trackConfigs.map((trackConfig) => {
          const clips = trackConfig.clips.map((clipConfig) => {
            const audioBuffer = fileBuffers.get(clipConfig.fileId);
            if (!audioBuffer) {
              throw new Error(`Audio file not found for ID: ${clipConfig.fileId}`);
            }

            return createClipFromSeconds({
              audioBuffer,
              startTime: clipConfig.startTime,
              duration: clipConfig.duration,
              offset: clipConfig.offset,
              name: `${trackConfig.name} ${clipConfig.offset}-${clipConfig.offset + clipConfig.duration}s`,
            });
          });

          return createTrack({
            name: trackConfig.name,
            clips,
            muted: false,
            soloed: false,
            volume: 1,
            pan: 0,
          });
        });

        if (!cancelled) {
          setTracks(loadedTracks);
          setLoading(false);
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Failed to load tracks:', err);
          setError(err as Error);
          setLoading(false);
        }
      }
    };

    loadTracks();

    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        Loading audio tracks...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: '2rem', color: 'red' }}>
        Error loading audio: {error.message}
      </div>
    );
  }

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      mono={true}
      waveHeight={100}
      automaticScroll={true}
      controls={{ show: true, width: 200 }}
      theme={theme}
    >
      <PlaylistWithDrag tracks={tracks} onTracksChange={setTracks} />
    </WaveformPlaylistProvider>
  );
}
