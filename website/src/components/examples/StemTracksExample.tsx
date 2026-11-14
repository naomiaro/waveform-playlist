import React, { useState } from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  ClipInteractionProvider,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
  ZoomInButton,
  ZoomOutButton,
  AutomaticScrollCheckbox,
  MasterVolumeControl,
  KeyboardShortcuts,
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  DefaultTrackControls,
  TrackReorderGrip,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  WaveformViewOptions,
} from '@waveform-playlist/browser';
import { PlayheadWithMarker } from '@waveform-playlist/ui-components';
import { audioTrack, type PlaylistTrack } from '@waveform-playlist/core';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';

// Stem tracks configuration - Albert Kader "Whiptails" minimal techno (all stems)
const audioConfigs = [
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/01_Loop1.opus',
    name: 'Loop 1',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/02_Loop2.opus',
    name: 'Loop 2',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/03_Kick.opus',
    name: 'Kick',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/04_Snare.opus',
    name: 'Snare',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/05_Claps.opus',
    name: 'Claps',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/06_HiHat.opus',
    name: 'HiHat',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/07_Bass1.opus',
    name: 'Bass 1',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/08_Bass2.opus',
    name: 'Bass 2',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/09_Synth1.opus',
    name: 'Synth 1',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/10_Synth2.opus',
    name: 'Synth 2',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/11_Vox_Dry.opus',
    name: 'Vox Dry',
  },
  {
    src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/12_Vox_Wet.opus',
    name: 'Vox Wet',
  },
];

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

// "Loading: 3/12" while the stems load, or the error of one that failed.
// Inside the provider: it reads the provider's source status.
function LoadingStatus() {
  const { isLoading, settledCount, totalCount, errorMessage } = useLoadingProgress();
  if (errorMessage) {
    return <span style={{ fontSize: '0.875rem', color: 'red' }}>Error loading audio: {errorMessage}</span>;
  }
  if (!isLoading) return null;
  return <span style={{ fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-600)' }}>Loading: {settledCount}/{totalCount}</span>;
}

export function StemTracksExample() {
  const { theme } = useDocusaurusTheme();

  // One track per stem; the provider loads them and builds the engine once
  // all have loaded.
  const [tracks, setTracks] = useState<PlaylistTrack[]>(() => audioConfigs.map((config) => audioTrack(config)));

  return (
    <Container>
      <WaveformPlaylistProvider
        tracks={tracks}
        onTracksChange={setTracks}
        sampleRate={48000}
        samplesPerPixel={512}
        mono
        automaticScroll={true}
        theme={theme}
      >
        <ClipInteractionProvider>
          <KeyboardShortcuts playback />
          <Controls>
            <ControlGroup>
              <PlayButton />
              <PauseButton />
              <StopButton />
              <LoadingStatus />
            </ControlGroup>

            <ControlGroup>
              <ZoomInButton />
              <ZoomOutButton />
            </ControlGroup>

            <ControlGroup>
              <AudioPosition />
            </ControlGroup>

            <ControlGroup>
              <MasterVolumeControl />
            </ControlGroup>

            <ControlGroup>
              <AutomaticScrollCheckbox />
            </ControlGroup>

          </Controls>

          <WaveformViewOptions waveHeight={100} barWidth={4} barGap={0}>
            <WaveformRoot>
              <WaveformTimescale />
              <WaveformLoopRegion />
              <WaveformTrackControls>
                <DefaultTrackControls />
                <TrackReorderGrip />
              </WaveformTrackControls>
              <WaveformTracks />
              <WaveformSelection />
              <WaveformPlayhead renderPlayhead={PlayheadWithMarker} />
            </WaveformRoot>
          </WaveformViewOptions>
        </ClipInteractionProvider>
      </WaveformPlaylistProvider>
    </Container>
  );
}
