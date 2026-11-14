import React, { useState, useCallback } from 'react';
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
} from '@waveform-playlist/browser';
import { audioTrack, type SpectrogramConfig, type RenderMode, type PlaylistTrack } from '@waveform-playlist/core';
import { SpectrogramProvider } from '@waveform-playlist/spectrogram';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';
import { FileDropZone } from '../FileDropZone';

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

// Inside the provider: "Loading tracks..." while sources load, or the error of one that failed.
function LoadingNotice() {
  const { isLoading, errorMessage } = useLoadingProgress();
  if (errorMessage) return <div>Error: {errorMessage}</div>;
  if (!isLoading) return null;
  return <div style={{ padding: '1rem', opacity: 0.7 }}>Loading tracks...</div>;
}

export function MirSpectrogramExample() {
  const { theme } = useDocusaurusTheme();
  // The provider loads the tracks and builds the engine once all have loaded.
  const [tracks, setTracks] = useState<PlaylistTrack[]>(() =>
    TRACK_CONFIGS.map((tc) =>
      audioTrack({
        src: tc.src,
        name: tc.name,
        renderMode: tc.defaultMode,
        spectrogramConfig: DEFAULT_SPECTROGRAM_CONFIG,
      })
    )
  );

  const handleRemoveTrack = useCallback((trackId: string) => {
    setTracks(prev => prev.filter((track) => track.id !== trackId));
  }, []);

  const handleClearAll = useCallback(() => {
    setTracks([]);
  }, []);

  // One track per dropped file; the provider loads it.
  const handleFiles = useCallback((files: File[]) => {
    const audioFiles = files.filter(f => f.type.startsWith('audio/'));
    if (audioFiles.length === 0) return;
    setTracks((prev) => [
      ...prev,
      ...audioFiles.map((file) => audioTrack({ src: file, spectrogramConfig: DEFAULT_SPECTROGRAM_CONFIG })),
    ]);
  }, []);

  return (
    <Container>
      <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '0 0 0.75rem' }}>
        Use the <strong>...</strong> menu in each track's controls to change render mode or spectrogram settings per-track.
      </p>

      {tracks.length > 0 && (
        <WaveformPlaylistProvider
          tracks={tracks}
          onTracksChange={setTracks}
          sampleRate={48000}
          theme={theme}
          automaticScroll
          samplesPerPixel={8192}
          zoomLevels={[512, 1024, 2048, 4096, 8192, 16384, 32768]}
        >
          <SpectrogramProvider colorMap="viridis">
          <LoadingNotice />
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
    </Container>
  );
}
