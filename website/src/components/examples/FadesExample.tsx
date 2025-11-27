/**
 * Fades Example
 *
 * Demonstrates fade in/out functionality with 4 individual mini players,
 * each showcasing a different fade curve type.
 */

import React from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  useAudioTracks,
  type AudioTrackConfig,
} from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';
import type { FadeType } from '@waveform-playlist/core';

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

const Checkbox = styled.label`
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
  user-select: none;
  font-size: 0.9rem;
  color: var(--ifm-font-color-base, #1c1e21);

  input {
    width: 1rem;
    height: 1rem;
    cursor: pointer;
  }
`;

interface FadePlayerProps {
  fadeType: FadeType;
  title: string;
  description: string;
}

function FadePlayer({ fadeType, title, description }: FadePlayerProps) {
  const { theme } = useDocusaurusTheme();
  const [showFades, setShowFades] = React.useState(true);

  // Use 5.85 seconds of vocals with 1.5 second fades
  const audioConfigs: AudioTrackConfig[] = React.useMemo(() => [
    {
      src: '/waveform-playlist/media/audio/AlbertKader_Ubiquitous/09_Synth1_Unmodulated.opus',
      name: title,
      duration: 5.85,
      fadeIn: { duration: 1.5, type: fadeType },
      fadeOut: { duration: 1.5, type: fadeType },
    },
  ], [fadeType, title]);

  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  if (loading) {
    return (
      <FadeCard>
        <FadeTitle>{title}</FadeTitle>
        <FadeDescription>{description}</FadeDescription>
        <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--ifm-font-color-secondary)' }}>
          Loading...
        </div>
      </FadeCard>
    );
  }

  if (error) {
    return (
      <FadeCard>
        <FadeTitle>{title}</FadeTitle>
        <FadeDescription>{description}</FadeDescription>
        <div style={{ padding: '1rem', color: 'red' }}>
          Error: {error}
        </div>
      </FadeCard>
    );
  }

  return (
    <FadeCard>
      <FadeTitle>{title}</FadeTitle>
      <FadeDescription>{description}</FadeDescription>
      <WaveformPlaylistProvider tracks={tracks} samplesPerPixel={512} mono theme={theme} barWidth={4} barGap={2}>
        <Controls>
          <PlayButton />
          <PauseButton />
          <StopButton />
          <Checkbox>
            <input
              type="checkbox"
              checked={showFades}
              onChange={(e) => setShowFades(e.target.checked)}
            />
            Show Fades
          </Checkbox>
        </Controls>
        <WaveformWrapper>
          <Waveform showFades={showFades} />
        </WaveformWrapper>
      </WaveformPlaylistProvider>
    </FadeCard>
  );
}

export function FadesExample() {
  const fadeTypes: Array<{ type: FadeType; title: string; description: string }> = [
    {
      type: 'linear',
      title: 'Linear Fade',
      description: 'Volume changes at a constant rate, creating a straight-line transition. Predictable and mechanical.',
    },
    {
      type: 'logarithmic',
      title: 'Logarithmic Fade',
      description: 'Fast initial change that gradually slows down. Mimics human hearing perception - sounds natural for fade-outs.',
    },
    {
      type: 'exponential',
      title: 'Exponential Fade',
      description: 'Slow initial change that accelerates toward the end. Great for dramatic fade-ins and builds.',
    },
    {
      type: 'sCurve',
      title: 'S-Curve Fade',
      description: 'Smooth, gradual start and end with faster transition in the middle. Provides the smoothest perceived transition.',
    },
  ];

  return (
    <Container>
      {fadeTypes.map(({ type, title, description }) => (
        <FadePlayer
          key={type}
          fadeType={type}
          title={title}
          description={description}
        />
      ))}
    </Container>
  );
}
