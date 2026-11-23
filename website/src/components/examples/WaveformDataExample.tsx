import { sitePath } from '../../utils/sitePath';
import React, { useEffect, useState } from 'react';
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
  loadWaveformData,
  WaveformViewOptions,
  useCreateArrangement,
  useArrangementSources,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';
// Channel import removed - no longer using preview rendering
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import { findFailedSource } from './SourceLoadError';

// Track configuration with both audio and BBC peaks files
// Albert Kader "Ubiquitous" minimal techno - Using 8-bit peaks at 30 SPP
const trackConfigs = [
  {
    name: 'Kick',
    audioSrc: sitePath('/media/audio/AlbertKader_Ubiquitous/01_Kick.opus'),
    peaksSrc: sitePath('/media/audio/AlbertKader_Ubiquitous/01_Kick.dat'),
    peaksSize: 55, // KB (~27K points * 2 bytes)
    audioSize: 280, // KB (Opus is smaller than MP3)
  },
  {
    name: 'Bass',
    audioSrc: sitePath('/media/audio/AlbertKader_Ubiquitous/08_Bass.opus'),
    peaksSrc: sitePath('/media/audio/AlbertKader_Ubiquitous/08_Bass.dat'),
    peaksSize: 53,
    audioSize: 620,
  },
  {
    name: 'Synth 1',
    audioSrc: sitePath('/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus'),
    peaksSrc: sitePath('/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.dat'),
    peaksSize: 55,
    audioSize: 340,
  },
  {
    name: 'Synth 2',
    audioSrc: sitePath('/media/audio/AlbertKader_Ubiquitous/11_Synth2.opus'),
    peaksSrc: sitePath('/media/audio/AlbertKader_Ubiquitous/11_Synth2.dat'),
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

const MUTED_TEXT_STYLE = { padding: '2rem', color: 'var(--ifm-color-emphasis-600)' } as const;

/**
 * The peaks of each track, in config order. A peaks file that fails gives
 * null: that track is added without peaks, and its waveform is generated in
 * the browser once its audio has decoded.
 */
function loadAllPeaks(): Promise<(WaveformData | null)[]> {
  return Promise.all(
    trackConfigs.map(async (config) => {
      try {
        return await loadWaveformData(config.peaksSrc);
      } catch (error) {
        console.warn(
          `[waveform-playlist example] Could not load the peaks file ${config.peaksSrc}; the waveform of "${config.name}" will be generated from its audio.`,
          error
        );
        return null;
      }
    })
  );
}

/**
 * WaveformData Example
 *
 * Demonstrates progressive loading with BBC pre-computed peaks. The peaks
 * (~50KB per track) are fetched first; the tracks are then drawn from them at
 * once while the audio (~3MB) loads in the background.
 *
 * A track whose peaks file fails is still added: its row stays empty until its
 * audio has decoded, and then its waveform is generated in the browser.
 *
 * Key features demonstrated:
 * - Peaks first: every track is drawn from its peaks before its audio arrives
 * - Progressive audio: each track becomes playable when its own audio has decoded
 * - useArrangementSources(): real-time progress tracking
 */
export function WaveformDataExample() {
  const { theme } = useDocusaurusTheme();
  // Starts empty: the tracks are added when every peaks request has settled,
  // each with a clip that names its audio and carries its peaks (when they
  // loaded). The playlist is shown from then on, and it is ready when the
  // audio has decoded.
  const arrangement = useCreateArrangement();
  const [peaksSettled, setPeaksSettled] = useState(false);
  const sources = useArrangementSources(arrangement);
  const totalCount = sources.sources.size;
  const loadedCount = totalCount - sources.pendingCount - sources.failedCount;
  const failed = findFailedSource(sources);

  // Load the BBC peaks of every track, then add the tracks in config order
  useEffect(() => {
    let cancelled = false;
    loadAllPeaks().then((peaks) => {
      if (cancelled) return;
      // Tracks already there (an effect run again by Fast Refresh) are not added twice
      if (arrangement.getTracks().length === 0) {
        trackConfigs.forEach((config, index) => {
          // Without peaks (the file failed) the waveform comes from the audio
          const waveformData = peaks[index] ?? undefined;
          arrangement.addTrack(audioTrack({ src: config.audioSrc, name: config.name, waveformData }));
        });
        // The first load is not an undo step
        arrangement.clearHistory();
      }
      setPeaksSettled(true);
    });
    return () => {
      cancelled = true;
    };
  }, [arrangement]);

  return (
    <Container>
      {failed && (
        <div style={{ padding: '2rem', color: 'red' }}>
          Error loading audio: {failed.message}{' '}
          <button type="button" onClick={() => arrangement.retry(failed.src)}>
            Retry
          </button>
        </div>
      )}
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
        {/* Show loading progress from the arrangement's sources */}
        {sources.isLoading && (
          <StatBox $variant="audio">
            <strong>{loadedCount} / {totalCount}</strong>
            <span>Tracks loaded</span>
          </StatBox>
        )}
      </StatsContainer>

      {!peaksSettled && <div style={MUTED_TEXT_STYLE}>Loading peaks...</div>}
      {peaksSettled && (
        <WaveformPlaylistProvider
          arrangement={arrangement}
          sampleRate={48000}
          samplesPerPixel={1024}
          mono
          automaticScroll
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

          <WaveformViewOptions waveHeight={100} barWidth={4} barGap={0}>
            <Waveform />
          </WaveformViewOptions>
        </WaveformPlaylistProvider>
      )}
    </Container>
  );
}
