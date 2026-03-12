/**
 * Fades Example
 *
 * Demonstrates fade in/out functionality with 4 individual mini players,
 * each showcasing a different fade curve type.
 *
 * Uses MediaElementPlaylistProvider with Web Audio routing for isolated
 * playback with fade effects. All players share a single AudioContext
 * (each has its own HTMLAudioElement/MediaElementSourceNode). No shared
 * Tone.js Transport, so pressing play on one doesn't affect the others.
 */

import React from 'react';
import styled from 'styled-components';
import {
  MediaElementPlaylistProvider,
  MediaElementWaveform,
  useMediaElementControls,
  useMediaElementAnimation,
  loadWaveformData,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import type { FadeType } from '@waveform-playlist/core';
import type WaveformData from 'waveform-data';

const Container = styled.div`
  max-width: 1400px;
  margin: 0 auto;
`;

const FadeCard = styled.div`
  background: var(--ifm-background-surface-color, #f8f9fa);
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.75rem;
  padding: 1.5rem;
  margin-bottom: 2rem;
`;

const FadeTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  color: var(--ifm-font-color-base, #1c1e21);
  font-size: 1.25rem;
`;

const FadeDescription = styled.p`
  margin: 0 0 1rem 0;
  color: var(--ifm-font-color-secondary, #525860);
  font-size: 0.9rem;
`;

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  align-items: center;
  margin-bottom: 1rem;
`;

const WaveformWrapper = styled.div`
  border-radius: 0.5rem;
  overflow: hidden;
`;

const ControlButton = styled.button`
  padding: 0.375rem 0.75rem;
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.25rem;
  background: var(--ifm-background-color, #fff);
  color: var(--ifm-font-color-base, #1c1e21);
  cursor: pointer;
  font-size: 0.875rem;

  &:hover:not(:disabled) {
    background: var(--ifm-color-emphasis-100, #f0f0f0);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const AUDIO_SRC = '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus';
const PEAKS_SRC = '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.dat';
const FADE_DURATION = 1.5;
const SAMPLES_PER_PIXEL = 1024;

/**
 * Playback controls that read state from the MediaElement provider context.
 */
function PlaybackControls() {
  const { play, pause, stop } = useMediaElementControls();
  const { isPlaying } = useMediaElementAnimation();

  return (
    <Controls>
      <ControlButton onClick={() => play()} disabled={isPlaying}>
        Play
      </ControlButton>
      <ControlButton onClick={() => pause()} disabled={!isPlaying}>
        Pause
      </ControlButton>
      <ControlButton onClick={() => stop()} disabled={!isPlaying}>
        Stop
      </ControlButton>
    </Controls>
  );
}

interface FadePlayerProps {
  fadeType: FadeType;
  title: string;
  description: string;
  waveformData: WaveformData;
  audioContext: AudioContext;
  showFades: boolean;
}

function FadePlayer({ fadeType, title, description, waveformData, audioContext, showFades }: FadePlayerProps) {
  const { theme } = useDocusaurusTheme();

  const trackConfig = React.useMemo(
    () => ({
      source: AUDIO_SRC,
      waveformData,
      name: title,
      fadeIn: { duration: FADE_DURATION, type: fadeType },
      fadeOut: { duration: FADE_DURATION, type: fadeType },
    }),
    [waveformData, title, fadeType]
  );

  return (
    <FadeCard>
      <FadeTitle>{title}</FadeTitle>
      <FadeDescription>{description}</FadeDescription>
      <MediaElementPlaylistProvider
        track={trackConfig}
        audioContext={audioContext}
        samplesPerPixel={SAMPLES_PER_PIXEL}
        waveHeight={80}
        theme={theme}
        barWidth={4}
        barGap={0}
      >
        <PlaybackControls />
        <WaveformWrapper>
          <MediaElementWaveform showFades={showFades} />
        </WaveformWrapper>
      </MediaElementPlaylistProvider>
    </FadeCard>
  );
}

const CheckboxLabel = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.9rem;
  color: var(--ifm-font-color-base, #1c1e21);
  cursor: pointer;
  margin-bottom: 1.5rem;
`;

export function FadesExample() {
  const [waveformData, setWaveformData] = React.useState<WaveformData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [showFades, setShowFades] = React.useState(true);

  // Single shared AudioContext for all fade players. Each provider creates its
  // own HTMLAudioElement + MediaElementSourceNode, which is fine — multiple
  // source nodes can share one context.
  const [audioContext] = React.useState(() => new AudioContext());

  React.useEffect(() => {
    return () => {
      audioContext.close().catch(() => {});
    };
  }, [audioContext]);

  // Load peaks once — all 4 players use the same audio file
  React.useEffect(() => {
    loadWaveformData(PEAKS_SRC)
      .then((data) => {
        setWaveformData(data as WaveformData);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load peaks');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <Container>
        <div style={{ padding: '2rem', textAlign: 'center' }}>Loading waveform data...</div>
      </Container>
    );
  }

  if (error || !waveformData) {
    return (
      <Container>
        <div style={{ padding: '2rem', color: 'red' }}>Error: {error}</div>
      </Container>
    );
  }

  const fadeTypes: Array<{ type: FadeType; title: string; description: string }> = [
    {
      type: 'linear',
      title: 'Linear Fade',
      description:
        'Volume changes at a constant rate, creating a straight-line transition. Predictable and mechanical.',
    },
    {
      type: 'logarithmic',
      title: 'Logarithmic Fade',
      description:
        'Fast initial change that gradually slows down. Mimics human hearing perception - sounds natural for fade-outs.',
    },
    {
      type: 'exponential',
      title: 'Exponential Fade',
      description:
        'Slow initial change that accelerates toward the end. Great for dramatic fade-ins and builds.',
    },
    {
      type: 'sCurve',
      title: 'S-Curve Fade',
      description:
        'Smooth, gradual start and end with faster transition in the middle. Provides the smoothest perceived transition.',
    },
  ];

  return (
    <Container>
      <CheckboxLabel>
        <input
          type="checkbox"
          checked={showFades}
          onChange={(e) => setShowFades(e.target.checked)}
        />
        Show fade overlays
      </CheckboxLabel>
      {fadeTypes.map(({ type, title, description }, index) => (
        <FadePlayer
          key={type}
          fadeType={type}
          title={title}
          description={description}
          waveformData={waveformData}
          audioContext={audioContext}
          showFades={showFades}
        />
      ))}
    </Container>
  );
}
