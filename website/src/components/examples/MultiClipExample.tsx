import React from 'react';
import styled from 'styled-components';
import { createTrack, type ArrangementTrack, type LoadingClip } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  ClipInteractionProvider,
  KeyboardShortcuts,
  PlayButton,
  PauseButton,
  StopButton,
  LoopButton,
  ZoomInButton,
  ZoomOutButton,
  AudioPosition,
  AutomaticScrollCheckbox,
  MasterVolumeControl,
  WaveformEditor,
  WaveformViewOptions,
  useCreateArrangement,
  useArrangementSources,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { SourceLoadError } from './SourceLoadError';

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

// Audio files - each file is loaded and decoded once by the arrangement,
// however many clips name it
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
      // The whole file: it decodes to 16.645 s (48 kHz), so the clip ends with it.
      { fileId: 'bass', startTime: 0, duration: 16.64, offset: 0 },
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

const fileSrc = (fileId: string): string => {
  const file = audioFiles.find((f) => f.id === fileId);
  if (!file) throw new Error(`Audio file not found for ID: ${fileId}`);
  return file.src;
};

// Build tracks from config. Each clip is a loading clip in seconds that names
// its file; its duration lets the waveform draw it as a placeholder at once,
// and the arrangement makes it a playable clip when the file has decoded.
const buildTracks = (): ArrangementTrack[] =>
  trackConfigs.map((trackConfig) => {
    const clips: LoadingClip[] = trackConfig.clips.map((clipConfig, index) => ({
      id: `${clipConfig.fileId}-${index}`,
      src: fileSrc(clipConfig.fileId),
      start: clipConfig.startTime,
      duration: clipConfig.duration,
      offset: clipConfig.offset,
      name: `${trackConfig.name} ${clipConfig.offset}-${clipConfig.offset + clipConfig.duration}s`,
    }));

    return {
      ...createTrack({
        name: trackConfig.name,
        clips: [],
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
      }),
      clips,
    };
  });

export function MultiClipExample() {
  const { theme } = useDocusaurusTheme();
  // The arrangement owns the tracks and loads their audio
  const arrangement = useCreateArrangement(buildTracks);
  const sources = useArrangementSources(arrangement);
  const totalCount = sources.sources.size;
  const loadedCount = totalCount - sources.pendingCount - sources.failedCount;

  return (
    <WaveformPlaylistProvider
      arrangement={arrangement}
      sampleRate={48000}
      samplesPerPixel={1024}
      mono
      automaticScroll={true}
      theme={theme}
    >
      <ClipInteractionProvider>
        <KeyboardShortcuts playback clipSplitting undo />
        <Controls>
          <ControlGroup>
            <PlayButton />
            <PauseButton />
            <StopButton />
            <LoopButton />
            {sources.isLoading && <span style={{ fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-600)' }}>Loading: {loadedCount}/{totalCount}</span>}
            <SourceLoadError arrangement={arrangement} />
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

        <WaveformViewOptions waveHeight={100} barWidth={4} barGap={0}>
          <WaveformEditor />
        </WaveformViewOptions>
      </ClipInteractionProvider>
    </WaveformPlaylistProvider>
  );
}
