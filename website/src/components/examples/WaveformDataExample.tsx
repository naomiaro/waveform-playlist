import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
import type WaveformData from 'waveform-data';
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
  useAudioTracks,
  loadWaveformData,
  waveformDataToPeaks,
  getWaveformDataMetadata,
} from '@waveform-playlist/browser';
// Channel import removed - no longer using preview rendering
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

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

interface BBCPeaksData {
  data: Int8Array | Int16Array;
  bits: 8 | 16;
  length: number;
  sampleRate: number;
  waveformData: WaveformData; // Keep original for passing to clips
  metadata: {
    channels: number;
    duration: number;
    samplesPerPixel: number;
  };
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
 * - loadedCount/totalCount: real-time progress tracking
 */
export function WaveformDataExample() {
  const { theme } = useDocusaurusTheme();
  const [bbcPeaks, setBbcPeaks] = useState<Map<string, BBCPeaksData>>(new Map());

  // Load BBC peaks independently - each track appears as its peaks load
  useEffect(() => {
    // Load each track's peaks independently (not Promise.all)
    trackConfigs.forEach(async (config) => {
      try {
        const waveformData = await loadWaveformData(config.peaksSrc);
        const peaks = waveformDataToPeaks(waveformData, 0);
        const metadata = await getWaveformDataMetadata(config.peaksSrc);

        // Update state for THIS track immediately - triggers re-render
        setBbcPeaks(prev => {
          const newMap = new Map(prev);
          newMap.set(config.name, {
            data: peaks.data,
            bits: peaks.bits,
            length: peaks.length,
            sampleRate: peaks.sampleRate,
            waveformData,
            metadata: {
              channels: metadata.channels,
              duration: metadata.duration,
              samplesPerPixel: metadata.samplesPerPixel,
            },
          });
          return newMap;
        });
      } catch (error) {
        console.error(`Error loading peaks for ${config.name}:`, error);
      }
    });
  }, []);

  // Build audio configs - only include tracks that have peaks loaded
  const audioConfigs = useMemo(() =>
    trackConfigs
      .filter(config => bbcPeaks.has(config.name)) // Only tracks with peaks ready
      .map(config => ({
        src: config.audioSrc,
        name: config.name,
        waveformData: bbcPeaks.get(config.name)?.waveformData,
      })),
  [bbcPeaks]);

  // Load audio tracks with PROGRESSIVE LOADING enabled!
  // Tracks appear one-by-one as they load, with waveforms shown immediately from peaks
  const { tracks, loading: audioLoading, error: audioError, loadedCount, totalCount } = useAudioTracks(
    audioConfigs, // Configs added as peaks load
    { immediate: true } // Immediate placeholders, audio decodes in background
  );

  if (audioError) {
    return (
      <Container>
        <div style={{ padding: '2rem', color: 'red' }}>
          Error loading audio: {audioError}
        </div>
      </Container>
    );
  }

  return (
    <Container>
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
        {/* Show loading progress using loadedCount/totalCount */}
        {audioLoading && (
          <StatBox $variant="audio">
            <strong>{loadedCount} / {totalCount}</strong>
            <span>Tracks loaded</span>
          </StatBox>
        )}
      </StatsContainer>

      <WaveformPlaylistProvider
        tracks={tracks}
        sampleRate={48000}
        samplesPerPixel={1024}
        mono
        waveHeight={100}
        automaticScroll
        controls={{ show: true, width: 200 }}
        theme={theme}
        timescale
        barWidth={4}
        barGap={0}
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
            <MasterVolumeControl />
          </ControlGroup>

          <ControlGroup>
            <AutomaticScrollCheckbox />
          </ControlGroup>
        </Controls>

        <Waveform />
      </WaveformPlaylistProvider>
    </Container>
  );
}
