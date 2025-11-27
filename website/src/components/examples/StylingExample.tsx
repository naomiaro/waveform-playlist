/**
 * Styling Example
 *
 * Demonstrates various waveform styling options:
 * - barWidth and barGap for bar-style waveforms
 * - Custom theme colors
 * - Different visual styles for waveforms
 */

import React from 'react';
import styled from 'styled-components';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  StopButton,
  useAudioTracks,
} from '@waveform-playlist/browser';
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';

const Grid = styled.div`
  display: grid;
  gap: 2rem;
`;

const Section = styled.div`
  border: 1px solid var(--ifm-color-emphasis-300, #dee2e6);
  border-radius: 0.5rem;
  padding: 1rem;
  background: var(--ifm-background-surface-color, #f8f9fa);
`;

const SectionTitle = styled.h3`
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  color: var(--ifm-heading-color, inherit);
`;

const SectionDesc = styled.p`
  margin: 0 0 0.5rem 0;
  font-size: 0.9rem;
  color: var(--ifm-color-emphasis-600, #6c757d);
`;

const Controls = styled.div`
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
`;

const Code = styled.code`
  background: var(--ifm-code-background, #f0f0f0);
  padding: 0.2rem 0.4rem;
  border-radius: 3px;
  font-size: 0.85em;
`;

// Theme variants for demonstration
// Note: waveOutlineColor = waveform bars, waveFillColor = background
// For earlier examples, selection blends with background (barely visible)
// For themed examples, selection matches theme accent colors
// IMPORTANT: Set selectedWave* colors to match unselected to prevent color change on track selection
const defaultTheme: Partial<WaveformPlaylistTheme> = {
  waveOutlineColor: '#E0EFF1',
  waveFillColor: '#4a9eff',
  waveProgressColor: 'orange',
  selectionColor: 'rgba(74, 158, 255, 0.3)', // Matches waveFillColor - subtle/blended
  playheadColor: 'orange',
  // Match selected colors to unselected so track selection doesn't change appearance
  selectedWaveOutlineColor: '#E0EFF1',
  selectedWaveFillColor: '#4a9eff',
};

const neonTheme: Partial<WaveformPlaylistTheme> = {
  waveOutlineColor: '#00ff88',  // Bright green waveform
  waveFillColor: '#0a0a1a',     // Very dark background
  waveProgressColor: '#ff00ff', // Magenta progress
  selectionColor: 'rgba(255, 0, 255, 0.35)', // Magenta selection - matches progress
  playheadColor: '#ff00ff', // Magenta playhead - matches progress
  // Selected: brighter cyan glow effect
  selectedWaveOutlineColor: '#00ffcc',
  selectedWaveFillColor: '#0a1a2a',
};

const retroTheme: Partial<WaveformPlaylistTheme> = {
  waveOutlineColor: '#ff6b35',  // Orange waveform
  waveFillColor: '#1a1a1a',     // Dark background
  waveProgressColor: '#ffcc00', // Yellow progress
  selectionColor: 'rgba(255, 204, 0, 0.4)', // Yellow selection - matches progress
  playheadColor: '#ffcc00', // Yellow playhead - matches progress
  // Selected: warmer orange/amber glow
  selectedWaveOutlineColor: '#ff8c42',
  selectedWaveFillColor: '#2a1a0a',
};

const minimalTheme: Partial<WaveformPlaylistTheme> = {
  waveOutlineColor: '#333333',  // Dark gray waveform
  waveFillColor: '#f0f0f0',     // Light gray background
  waveProgressColor: '#f0f0f0', // Same as fill - progress is invisible, only playhead shows
  selectionColor: 'rgba(51, 51, 51, 0.2)', // Dark gray selection - matches waveform
  playheadColor: '#333333', // Dark gray playhead
  // Match selected colors to unselected
  selectedWaveOutlineColor: '#333333',
  selectedWaveFillColor: '#f0f0f0',
};

interface WaveformVariantProps {
  barWidth?: number;
  barGap?: number;
  theme?: Partial<WaveformPlaylistTheme>;
}

function WaveformVariant({
  barWidth = 1,
  barGap = 0,
  theme = defaultTheme,
}: WaveformVariantProps) {
  const audioConfigs = React.useMemo(
    () => [
      {
        src: '/waveform-playlist/media/audio/AlbertKader_Whiptails/09_Synth1.opus',
        name: 'Synth',
      },
    ],
    []
  );

  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  if (loading) {
    return <div style={{ padding: '1rem', textAlign: 'center', color: '#666' }}>Loading...</div>;
  }

  if (error) {
    return <div style={{ padding: '1rem', color: 'red' }}>Error: {error}</div>;
  }

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={3000}
      progressBarWidth={0}
      mono
      theme={theme}
      barWidth={barWidth}
      barGap={barGap}
    >
      <Controls>
        <PlayButton />
        <StopButton />
      </Controls>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

export function StylingExample() {
  return (
    <Grid>
      {/* Default - continuous waveform */}
      <Section>
        <SectionTitle>Default (Continuous)</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 1, barGap: 0</Code> - Classic continuous waveform
        </SectionDesc>
        <WaveformVariant barWidth={1} barGap={0} theme={defaultTheme} />
      </Section>

      {/* Thin bars with small gap */}
      <Section>
        <SectionTitle>Thin Bars</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 1, barGap: 1</Code> - Thin bars with small gaps
        </SectionDesc>
        <WaveformVariant barWidth={1} barGap={1} theme={defaultTheme} />
      </Section>

      {/* Medium bars */}
      <Section>
        <SectionTitle>Medium Bars</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 2, barGap: 1</Code> - Wider bars, balanced look
        </SectionDesc>
        <WaveformVariant barWidth={2} barGap={1} theme={defaultTheme} />
      </Section>

      {/* Wide bars - SoundCloud style */}
      <Section>
        <SectionTitle>Wide Bars (SoundCloud Style)</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 3, barGap: 1</Code> - Wide bars like SoundCloud
        </SectionDesc>
        <WaveformVariant barWidth={3} barGap={1} theme={defaultTheme} />
      </Section>

      {/* Extra wide bars */}
      <Section>
        <SectionTitle>Extra Wide Bars</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 4, barGap: 2</Code> - Bold, chunky bars
        </SectionDesc>
        <WaveformVariant barWidth={4} barGap={2} theme={defaultTheme} />
      </Section>

      {/* Neon theme with bars */}
      <Section>
        <SectionTitle>Neon Theme</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 2, barGap: 1</Code> with neon colors
        </SectionDesc>
        <WaveformVariant barWidth={2} barGap={1} theme={neonTheme} />
      </Section>

      {/* Retro theme */}
      <Section>
        <SectionTitle>Retro Theme</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 2, barGap: 0</Code> with retro orange accent
        </SectionDesc>
        <WaveformVariant barWidth={2} barGap={0} theme={retroTheme} />
      </Section>

      {/* Minimal theme */}
      <Section>
        <SectionTitle>Minimal Theme</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 1, barGap: 2</Code> with minimal grayscale colors
        </SectionDesc>
        <WaveformVariant barWidth={1} barGap={2} theme={minimalTheme} />
      </Section>
    </Grid>
  );
}
