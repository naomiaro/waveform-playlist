import React, { useEffect, useState } from 'react';
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
import { useAudioTracks } from '@waveform-playlist/browser/tone';
import { PlayheadWithMarker } from '@waveform-playlist/ui-components';
import { type ClipTrack } from '@waveform-playlist/core';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

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

export function StemTracksExample() {
  const { theme } = useDocusaurusTheme();

  // Load audio tracks with immediate placeholders - peaks fill in as files decode
  const { tracks: loadedTracks, loading, error, loadedCount, totalCount } = useAudioTracks(audioConfigs, { immediate: true });
  const [tracks, setTracks] = useState<ClipTrack[]>([]);

  // Sync local track state as peaks fill in; once loading finishes this stops
  // firing, so subsequent updates (e.g. track reordering) come from onTracksChange.
  useEffect(() => {
    if (loadedTracks.length > 0) {
      setTracks(loadedTracks);
    }
  }, [loadedTracks]);

  if (error) {
    return (
      <Container>
        <div style={{ padding: '2rem', color: 'red' }}>
          Error loading audio: {error}
        </div>
      </Container>
    );
  }

  return (
    <Container>
      <WaveformPlaylistProvider
        tracks={tracks}
        onTracksChange={setTracks}
        deferEngineRebuild={loading}
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
              {loading && <span style={{ fontSize: '0.875rem', color: 'var(--ifm-color-emphasis-600)' }}>Loading: {loadedCount}/{totalCount}</span>}
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
