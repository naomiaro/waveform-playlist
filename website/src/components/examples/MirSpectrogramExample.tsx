import React, { useCallback } from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  AudioPosition,
  ZoomInButton,
  ZoomOutButton,
  AutomaticScrollCheckbox,
  ClearAllButton,
  KeyboardShortcuts,
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  DefaultTrackControls,
  TrackRemoveButton,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  WaveformClipHeaders,
  WaveformViewOptions,
  useCreateArrangement,
  useArrangementTracks,
  useArrangementSources,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';
import type { AudioTrackOptions, SpectrogramConfig, RenderMode } from '@waveform-playlist/core';
import { SpectrogramProvider } from '@waveform-playlist/spectrogram';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { FileDropZone } from '../FileDropZone';
import { SourceLoadError } from './SourceLoadError';
import { FailedDropsAlert, useFailedDrops } from './FailedDrops';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const ControlBar = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  padding: 0.75rem 1rem;
  flex-wrap: wrap;
  background: var(--ifm-background-surface-color, #f5f5f5);
  border-radius: 6px;
  margin-bottom: 1rem;
`;



const StyledDropZone = styled(FileDropZone)`
  margin-top: 1rem;
`;

const TRACK_CONFIGS: { src: string; name: string; defaultMode: RenderMode }[] = [
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/09_Synth1.opus',
    name: 'Synth',
    defaultMode: 'waveform',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/07_Bass1.opus',
    name: 'Bass',
    defaultMode: 'waveform',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/03_Kick.opus',
    name: 'Kick',
    defaultMode: 'waveform',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/06_HiHat.opus',
    name: 'HiHat',
    defaultMode: 'waveform',
  },
];

const DEFAULT_SPECTROGRAM_CONFIG: SpectrogramConfig = {
  fftSize: 2048,
  windowFunction: 'hann',
  frequencyScale: 'mel',
  minFrequency: 0,
  maxFrequency: 20000,
  gainDb: 20,
  rangeDb: 80,
  labels: false,
};

const AUDIO_CONFIGS: AudioTrackOptions[] = TRACK_CONFIGS.map((tc) => ({
  src: tc.src,
  name: tc.name,
  renderMode: tc.defaultMode,
  spectrogramConfig: DEFAULT_SPECTROGRAM_CONFIG,
}));

export function MirSpectrogramExample() {
  const { theme } = useDocusaurusTheme();
  // The arrangement owns the tracks and loads their audio; dropped files are
  // added to it
  const arrangement = useCreateArrangement(() => AUDIO_CONFIGS.map((config) => audioTrack(config)));
  const tracks = useArrangementTracks(arrangement);
  const { isLoading } = useArrangementSources(arrangement);
  // Dropped files that could not be decoded: their tracks are removed, the list stays
  const failedDrops = useFailedDrops(arrangement);

  const handleRemoveTrack = useCallback(
    (trackId: string) => arrangement.removeTrack(trackId),
    [arrangement]
  );

  // ClearAllButton stops playback first
  const handleClearAll = useCallback(() => arrangement.setTracks([]), [arrangement]);

  // One track per file, named after the file without its extension
  const handleFiles = useCallback(
    (files: File[]) => {
      files
        .filter((f) => f.type.startsWith('audio/'))
        .forEach((file) =>
          arrangement.addTrack(
            audioTrack({ src: file, spectrogramConfig: DEFAULT_SPECTROGRAM_CONFIG })
          )
        );
    },
    [arrangement]
  );

  return (
    <Container>
      <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '0 0 0.75rem' }}>
        Use the <strong>...</strong> menu in each track's controls to change render mode or spectrogram settings per-track.
      </p>

      {isLoading && <div style={{ padding: '1rem', opacity: 0.7 }}>Loading tracks...</div>}

      {tracks.length > 0 && (
        <WaveformPlaylistProvider
          arrangement={arrangement}
          sampleRate={48000}
          theme={theme}
          automaticScroll
          samplesPerPixel={8192}
          zoomLevels={[512, 1024, 2048, 4096, 8192, 16384, 32768]}
        >
          <SpectrogramProvider colorMap="viridis">
          <KeyboardShortcuts playback />
          <ControlBar>
            <RewindButton />
            <PlayButton />
            <PauseButton />
            <StopButton />
            <AudioPosition />
            <ZoomInButton />
            <ZoomOutButton />
            <AutomaticScrollCheckbox />
            <ClearAllButton onClearAll={handleClearAll} />
            <SourceLoadError arrangement={arrangement} />
          </ControlBar>
          <WaveformViewOptions waveHeight={100} barWidth={1} barGap={0}>
            <WaveformRoot>
              <WaveformTimescale />
              <WaveformLoopRegion />
              <WaveformTrackControls width={180}>
                <DefaultTrackControls />
                <TrackRemoveButton onRemove={handleRemoveTrack} />
              </WaveformTrackControls>
              <WaveformTracks>
                <WaveformClipHeaders />
              </WaveformTracks>
              <WaveformSelection />
              <WaveformPlayhead />
            </WaveformRoot>
          </WaveformViewOptions>
          </SpectrogramProvider>
        </WaveformPlaylistProvider>
      )}

      <StyledDropZone
        accept="audio/*"
        onFiles={handleFiles}
        fileFilter={(f) => f.type.startsWith('audio/')}
        label="Drop audio files here to add tracks, or click to browse"
        dragLabel="Drop audio files here"
      />
      <FailedDropsAlert drops={failedDrops} />
    </Container>
  );
}
