import React, { useState, useCallback, useRef, useEffect } from 'react';
import styled from 'styled-components';
import * as Tone from 'tone';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  AudioPosition,
  ZoomInButton,
  ZoomOutButton,
  AutomaticScrollCheckbox,
  ClearAllButton,
  useAudioTracks,
  KeyboardShortcuts,
} from '@waveform-playlist/browser';
import type { SpectrogramConfig, RenderMode, ClipTrack } from '@waveform-playlist/core';
import { SpectrogramProvider } from '@waveform-playlist/spectrogram';
import type { AudioTrackConfig } from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { FileDropZone } from '../FileDropZone';
import { decodeAudioFiles } from '../../utils/decodeAudioFiles';

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

const AUDIO_CONFIGS: AudioTrackConfig[] = TRACK_CONFIGS.map((tc) => ({
  src: tc.src,
  name: tc.name,
  renderMode: tc.defaultMode,
  spectrogramConfig: DEFAULT_SPECTROGRAM_CONFIG,
}));

export function MirSpectrogramExample() {
  const { theme } = useDocusaurusTheme();
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const baseTracksLoadedRef = useRef(false);

  const { tracks: baseTracks, loading, error } = useAudioTracks(AUDIO_CONFIGS, { immediate: true });

  // Seed tracks from baseTracks when loading completes (once)
  useEffect(() => {
    if (!loading && baseTracks.length > 0 && !baseTracksLoadedRef.current) {
      baseTracksLoadedRef.current = true;
      setTracks(baseTracks);
    }
  }, [loading, baseTracks]);

  const handleRemoveTrack = useCallback((index: number) => {
    setTracks(prev => prev.filter((_, i) => i !== index));
  }, []);

  const handleClearAll = useCallback(() => {
    setTracks([]);
  }, []);

  const addFiles = async (files: File[]) => {
    const audioContext = Tone.getContext().rawContext as AudioContext;
    const newTracks = await decodeAudioFiles(audioContext, files, {
      trackDefaults: { spectrogramConfig: DEFAULT_SPECTROGRAM_CONFIG },
    });
    if (newTracks.length > 0) {
      setTracks((prev) => [...prev, ...newTracks]);
    }
  };

  const handleFiles = useCallback((files: File[]) => {
    const audioFiles = files.filter(f => f.type.startsWith('audio/'));
    if (audioFiles.length > 0) addFiles(audioFiles);
  }, []);

  if (error) return <div>Error: {error}</div>;

  return (
    <Container>
      <p style={{ fontSize: '0.85rem', opacity: 0.7, margin: '0 0 0.75rem' }}>
        Use the <strong>...</strong> menu in each track's controls to change render mode or spectrogram settings per-track.
      </p>

      {loading && <div style={{ padding: '1rem', opacity: 0.7 }}>Loading tracks...</div>}

      {tracks.length > 0 && (
        <WaveformPlaylistProvider
          tracks={tracks}
          onTracksChange={setTracks}
          sampleRate={48000}
          theme={theme}
          timescale
          automaticScroll
          waveHeight={100}
          samplesPerPixel={8192}
          barWidth={1}
          barGap={0}
          zoomLevels={[512, 1024, 2048, 4096, 8192, 16384, 32768]}
          controls={{ show: true, width: 180 }}
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
          </ControlBar>
          <Waveform onRemoveTrack={handleRemoveTrack} showClipHeaders />
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
