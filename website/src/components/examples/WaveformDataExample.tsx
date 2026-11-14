import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import type WaveformData from 'waveform-data';
import { audioTrack, type PlaylistTrack } from '@waveform-playlist/core';
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
  MasterVolumeControl,
  loadWaveformData,
  WaveformViewOptions,
} from '@waveform-playlist/browser';
// Channel import removed - no longer using preview rendering
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { useLoadingProgress } from '../../hooks/useLoadingProgress';

// Track configuration with both audio and BBC peaks files
// Albert Kader "Ubiquitous" minimal techno - Using 8-bit peaks at 30 SPP
const trackConfigs = [
  {
    name: 'Kick',
    audioSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.opus',
    peaksSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/01_Kick.dat',
    peaksSize: 55, // KB (~27K points * 2 bytes)
    audioSize: 280, // KB (Opus is smaller than MP3)
  },
  {
    name: 'Bass',
    audioSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.opus',
    peaksSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/08_Bass.dat',
    peaksSize: 53,
    audioSize: 620,
  },
  {
    name: 'Synth 1',
    audioSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus',
    peaksSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.dat',
    peaksSize: 55,
    audioSize: 340,
  },
  {
    name: 'Synth 2',
    audioSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/11_Synth2.opus',
    peaksSrc: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/11_Synth2.dat',
    peaksSize: 55,
    audioSize: 380,
  },
];

// Calculate totals
const totalPeaksSize = trackConfigs.reduce((sum, t) => sum + t.peaksSize, 0);
const totalAudioSize = trackConfigs.reduce((sum, t) => sum + t.audioSize, 0);

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

const StatsContainer = styled.div`
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  flex-wrap: wrap;
`;

const StatBox = styled.div<{ $variant?: 'peaks' | 'audio' }>`
  padding: 0.75rem 1rem;
  background: ${props => props.$variant === 'peaks'
    ? 'var(--ifm-color-success-contrast-background, #d4edda)'
    : 'var(--ifm-color-warning-contrast-background, #fff3cd)'};
  border-radius: 0.25rem;
  font-size: 0.875rem;

  strong {
    display: block;
    font-size: 1.25rem;
    color: ${props => props.$variant === 'peaks'
      ? 'var(--ifm-color-success-dark, #155724)'
      : 'var(--ifm-color-warning-dark, #856404)'};
  }

  span {
    color: var(--ifm-font-color-secondary, #666);
  }
`;

// Removed preview-related styled components - progressive loading shows tracks directly

// Inside the provider: how many tracks have their audio, while audio loads
function AudioProgressStat() {
  const { isLoading, settledCount, totalCount } = useLoadingProgress();
  if (!isLoading) return null;
  return (
    <StatBox $variant="audio">
      <strong>{settledCount} / {totalCount}</strong>
      <span>Tracks loaded</span>
    </StatBox>
  );
}

// Inside the provider: the error of an audio file that failed to load
function AudioError() {
  const { errorMessage } = useLoadingProgress();
  if (!errorMessage) return null;
  return (
    <div style={{ padding: '2rem', color: 'red' }}>
      Error loading audio: {errorMessage}
    </div>
  );
}

/**
 * WaveformData Example
 *
 * Demonstrates fully progressive loading with BBC pre-computed peaks.
 * Each track appears as soon as its peaks load (~50KB), then audio
 * loads in the background (~3MB). No waiting for all tracks!
 *
 * Key features demonstrated:
 * - Progressive peaks: each track appears as its peaks file loads
 * - Progressive audio: tracks become playable as audio loads
 * - usePlaylistSources(): real-time progress tracking
 */
export function WaveformDataExample() {
  const { theme } = useDocusaurusTheme();
  // Starts empty: each track is appended when its peaks have loaded, with a
  // loading clip that names its audio and carries the peaks, so it is drawn
  // at once and becomes playable when the provider has decoded its audio.
  const [tracks, setTracks] = useState<PlaylistTrack[]>([]);

  // Load BBC peaks independently - each track appears as its peaks load
  useEffect(() => {
    let cancelled = false;
    // Peaks that have arrived (null: failed), by config index. Tracks are
    // appended in config order once every earlier one has arrived, so a track
    // never enters in front of one already shown.
    const arrived = new Map<number, WaveformData | null>();
    let next = 0;
    const appendArrived = () => {
      const ready: PlaylistTrack[] = [];
      while (arrived.has(next)) {
        const waveformData = arrived.get(next);
        const config = trackConfigs[next];
        if (waveformData) {
          ready.push(audioTrack({ src: config.audioSrc, name: config.name, waveformData }));
        }
        next++;
      }
      if (ready.length === 0) return;
      // A track already in the list (an effect run again by Fast Refresh) is not added twice.
      setTracks((prev) => [
        ...prev,
        ...ready.filter((track) => !prev.some((p) => p.name === track.name)),
      ]);
    };

    // Load each track's peaks independently (not Promise.all)
    trackConfigs.forEach(async (config, index) => {
      let waveformData: WaveformData | null = null;
      try {
        waveformData = await loadWaveformData(config.peaksSrc);
      } catch (error) {
        console.error(`Error loading peaks for ${config.name}:`, error);
      }
      if (cancelled) return;
      arrived.set(index, waveformData);
      appendArrived();
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <Container>
      <WaveformPlaylistProvider
        tracks={tracks}
        sampleRate={48000}
        samplesPerPixel={1024}
        mono
        automaticScroll
        theme={theme}
      >
      <AudioError />
      <StatsContainer>
        <StatBox $variant="peaks">
          <strong>{totalPeaksSize} KB</strong>
          <span>BBC Peaks (8-bit)</span>
        </StatBox>
        <StatBox $variant="audio">
          <strong>{(totalAudioSize / 1000).toFixed(1)} MB</strong>
          <span>Full Audio</span>
        </StatBox>
        <StatBox>
          <strong>{Math.round(totalAudioSize / totalPeaksSize)}x</strong>
          <span>smaller</span>
        </StatBox>
        {/* Show loading progress from the provider's source status */}
        <AudioProgressStat />
      </StatsContainer>

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
            <MasterVolumeControl />
          </ControlGroup>

          <ControlGroup>
            <AutomaticScrollCheckbox />
          </ControlGroup>
        </Controls>

        <WaveformViewOptions waveHeight={100} barWidth={4} barGap={0}>
          <Waveform />
        </WaveformViewOptions>
      </WaveformPlaylistProvider>
    </Container>
  );
}
