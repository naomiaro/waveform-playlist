import React, { useState, useEffect, useMemo } from 'react';
import styled from 'styled-components';
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
import { Channel } from '@waveform-playlist/ui-components';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

// Track configuration with both audio and BBC peaks files
// Using 8-bit peaks for smaller file sizes (~11KB vs ~22KB for 16-bit)
const trackConfigs = [
  {
    name: 'Vocals',
    audioSrc: '/waveform-playlist/media/audio/Vocals30.mp3',
    peaksSrc: '/waveform-playlist/media/audio/Vocals30-8bit.dat',
    peaksSize: 11, // KB
    audioSize: 469, // KB (~480KB)
  },
  {
    name: 'Guitar',
    audioSrc: '/waveform-playlist/media/audio/Guitar30.mp3',
    peaksSrc: '/waveform-playlist/media/audio/Guitar30-8bit.dat',
    peaksSize: 11,
    audioSize: 469,
  },
  {
    name: 'Pianos & Synth',
    audioSrc: '/waveform-playlist/media/audio/PianoSynth30.mp3',
    peaksSrc: '/waveform-playlist/media/audio/PianoSynth30-8bit.dat',
    peaksSize: 11,
    audioSize: 469,
  },
  {
    name: 'Drums',
    audioSrc: '/waveform-playlist/media/audio/BassDrums30.mp3',
    peaksSrc: '/waveform-playlist/media/audio/BassDrums30-8bit.dat',
    peaksSize: 11,
    audioSize: 469,
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

const LoadingStatus = styled.div`
  padding: 0.5rem 1rem;
  background: var(--ifm-color-primary-contrast-background, #e7f5ff);
  border-radius: 0.25rem;
  font-size: 0.875rem;
  color: var(--ifm-color-primary-dark, #0066cc);
  margin-bottom: 1rem;
`;

const PreviewContainer = styled.div`
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  margin-bottom: 1.5rem;
`;

const TrackPreview = styled.div`
  margin-bottom: 1rem;

  &:last-child {
    margin-bottom: 0;
  }
`;

const TrackLabel = styled.div`
  font-size: 0.75rem;
  font-weight: 600;
  margin-bottom: 0.25rem;
  color: var(--ifm-font-color-base, #1a1a2e);
`;

const WaveformContainer = styled.div`
  position: relative;
  height: 64px;
  background: #1a1a2e;
  border-radius: 4px;
  overflow: hidden;
`;

interface BBCPeaksData {
  data: Int8Array | Int16Array;
  bits: 8 | 16;
  length: number;
  sampleRate: number;
  metadata: {
    channels: number;
    duration: number;
    samplesPerPixel: number;
  };
}

/**
 * WaveformData Example
 *
 * Demonstrates fast waveform display using BBC pre-computed peaks.
 * BBC peaks load almost instantly (~50KB files) while full audio
 * buffers load in the background (~3MB files).
 */
export function WaveformDataExample() {
  const theme = useDocusaurusTheme();
  const [bbcPeaks, setBbcPeaks] = useState<Map<string, BBCPeaksData>>(new Map());
  const [peaksLoaded, setPeaksLoaded] = useState(false);

  // Memoize audio configs for useAudioTracks
  const audioConfigs = useMemo(() =>
    trackConfigs.map(config => ({
      src: config.audioSrc,
      name: config.name,
    })),
  []);

  // Load audio tracks (slower - full audio files)
  const { tracks, loading: audioLoading, error: audioError } = useAudioTracks(audioConfigs);

  // Load BBC peaks (faster - pre-computed waveform data)
  useEffect(() => {
    const loadPeaks = async () => {
      try {
        const peaksMap = new Map<string, BBCPeaksData>();

        await Promise.all(
          trackConfigs.map(async (config) => {
            const waveformData = await loadWaveformData(config.peaksSrc);
            const peaks = waveformDataToPeaks(waveformData, 0);
            const metadata = await getWaveformDataMetadata(config.peaksSrc);

            peaksMap.set(config.name, {
              data: peaks.data,
              bits: peaks.bits,
              length: peaks.length,
              sampleRate: peaks.sampleRate,
              metadata: {
                channels: metadata.channels,
                duration: metadata.duration,
                samplesPerPixel: metadata.samplesPerPixel,
              },
            });
          })
        );

        setBbcPeaks(peaksMap);
        setPeaksLoaded(true);
      } catch (error) {
        console.error('Error loading BBC peaks:', error);
      }
    };

    loadPeaks();
  }, []);

  // Device pixel ratio for crisp rendering
  const devicePixelRatio = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

  // Show BBC peaks preview while audio loads
  if (audioLoading && peaksLoaded) {
    return (
      <Container>
        <StatsContainer>
          <StatBox $variant="peaks">
            <strong>{totalPeaksSize} KB</strong>
            <span>BBC Peaks (loaded)</span>
          </StatBox>
          <StatBox $variant="audio">
            <strong>{(totalAudioSize / 1000).toFixed(1)} MB</strong>
            <span>Audio (loading...)</span>
          </StatBox>
          <StatBox>
            <strong>{Math.round(totalAudioSize / totalPeaksSize)}x</strong>
            <span>smaller</span>
          </StatBox>
        </StatsContainer>

        <PreviewContainer>
          <h4 style={{ margin: '0 0 1rem 0' }}>Preview (BBC Pre-computed Peaks)</h4>
          {trackConfigs.map((config) => {
            const peaks = bbcPeaks.get(config.name);
            if (!peaks) return null;

            return (
              <TrackPreview key={config.name}>
                <TrackLabel>{config.name}</TrackLabel>
                <WaveformContainer>
                  <div style={{ width: peaks.length, height: 64, position: 'relative' }}>
                    <Channel
                      index={0}
                      data={peaks.data}
                      bits={peaks.bits}
                      length={peaks.length}
                      waveHeight={64}
                      devicePixelRatio={devicePixelRatio}
                      waveOutlineColor={theme?.waveOutlineColor || '#005BBB'}
                      waveFillColor={theme?.waveFillColor || '#F4D35E'}
                    />
                  </div>
                </WaveformContainer>
              </TrackPreview>
            );
          })}
        </PreviewContainer>
      </Container>
    );
  }

  // Show loading state if peaks haven't loaded yet
  if (!peaksLoaded) {
    return (
      <Container>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Loading waveform data...
        </div>
      </Container>
    );
  }

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
      </StatsContainer>

      <WaveformPlaylistProvider
        tracks={tracks}
        samplesPerPixel={1024}
        mono={true}
        waveHeight={100}
        automaticScroll={true}
        controls={{ show: true, width: 200 }}
        theme={theme}
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
