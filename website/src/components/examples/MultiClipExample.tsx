import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { getGlobalAudioContext } from '@waveform-playlist/playout';
import { createTrack, createClipFromSeconds, type ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  ClipInteractionProvider,
  KeyboardShortcuts,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  LoopButton,
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
// All from Ubiquitous for consistency
const audioFiles = [
  { id: 'kick', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.opus' },
  { id: 'hihat', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/02_HiHat1.opus' },
  { id: 'claps', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/04_Claps.opus' },
  { id: 'shakers', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/07_Shakers.opus' },
  { id: 'bass', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus' },
  { id: 'synth1', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus' },
  { id: 'synth2', src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/11_Synth2.opus' },
];

// Track configuration with multiple clips demonstrating gaps and positioning
const trackConfigs = [
  {
    name: 'Kick',
    clips: [
      { fileId: 'kick', startTime: 0, duration: 8, offset: 0 },
      { fileId: 'kick', startTime: 12, duration: 8, offset: 8 },
    ],
  },
  {
    name: 'HiHat',
    clips: [
      { fileId: 'hihat', startTime: 4, duration: 12, offset: 4 },
    ],
  },
  {
    name: 'Claps',
    clips: [
      { fileId: 'claps', startTime: 8, duration: 4, offset: 0 },
      { fileId: 'claps', startTime: 16, duration: 4, offset: 4 },
    ],
  },
  {
    name: 'Shakers',
    clips: [
      { fileId: 'shakers', startTime: 0, duration: 6, offset: 0 },
      { fileId: 'shakers', startTime: 10, duration: 6, offset: 6 },
    ],
  },
  {
    name: 'Bass',
    clips: [
      { fileId: 'bass', startTime: 0, duration: 20, offset: 0 },
    ],
  },
  {
    name: 'Synth 1',
    clips: [
      { fileId: 'synth1', startTime: 4, duration: 8, offset: 2 },
      { fileId: 'synth1', startTime: 14, duration: 6, offset: 10 },
    ],
  },
  {
    name: 'Synth 2',
    clips: [
      { fileId: 'synth2', startTime: 0, duration: 4, offset: 0 },
      { fileId: 'synth2', startTime: 8, duration: 4, offset: 4 },
      { fileId: 'synth2', startTime: 16, duration: 4, offset: 8 },
    ],
  },
];

// Helper to get required file IDs for a track
const getRequiredFileIds = (trackConfig: typeof trackConfigs[0]): string[] => {
  return [...new Set(trackConfig.clips.map(clip => clip.fileId))];
};

// Helper to create a track when all its required files are loaded
const createTrackFromConfig = (
  trackConfig: typeof trackConfigs[0],
  fileBuffers: Map<string, AudioBuffer>
): ClipTrack => {
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
};

export function MultiClipExample() {
  const { theme } = useDocusaurusTheme();
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [loadedFiles, setLoadedFiles] = useState<Map<string, AudioBuffer>>(new Map());
  const [error, setError] = useState<Error | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);

  // Load audio files PROGRESSIVELY - each file loads independently
  useEffect(() => {
    let cancelled = false;
    const audioContext = getGlobalAudioContext();

    // Load each file independently (not Promise.all)
    audioFiles.forEach(async (file) => {
      try {
        const response = await fetch(file.src);
        if (!response.ok) {
          throw new Error(`Failed to fetch ${file.src}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        if (!cancelled) {
          // Update loaded files map for THIS file immediately
          setLoadedFiles(prev => {
            const newMap = new Map(prev);
            newMap.set(file.id, audioBuffer);
            return newMap;
          });
          setLoadedCount(prev => prev + 1);
        }
      } catch (err) {
        if (!cancelled) {
          console.error(`Failed to load ${file.id}:`, err);
          setError(err as Error);
        }
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  // Build tracks progressively as files load
  useEffect(() => {
    // For each track config, check if all required files are loaded
    const newTracks: ClipTrack[] = [];

    for (const trackConfig of trackConfigs) {
      const requiredFileIds = getRequiredFileIds(trackConfig);
      const allFilesLoaded = requiredFileIds.every(id => loadedFiles.has(id));

      if (allFilesLoaded) {
        newTracks.push(createTrackFromConfig(trackConfig, loadedFiles));
      }
    }

    setTracks(newTracks);
  }, [loadedFiles]);

  const loading = loadedCount < audioFiles.length;

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
      onTracksChange={setTracks}
      samplesPerPixel={1024}
      mono
      waveHeight={100}
      automaticScroll={true}
      controls={{ show: true, width: 200 }}
      theme={theme}
      timescale
      barWidth={4}
      barGap={0}
    >
      <ClipInteractionProvider>
        <KeyboardShortcuts playback clipSplitting undo />
        <Controls>
          <ControlGroup>
            <PlayButton />
            <PauseButton />
            <StopButton />
            <LoopButton />
            {loading && <span style={{ fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-600)' }}>Loading: {loadedCount}/{audioFiles.length}</span>}
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

        <Waveform showClipHeaders />
      </ClipInteractionProvider>
    </WaveformPlaylistProvider>
  );
}
