/**
 * Styling Example
 *
 * Demonstrates various waveform styling options:
 * - barWidth and barGap for bar-style waveforms
 * - Custom theme colors
 * - Different visual styles for waveforms
 *
 * Uses MediaElementPlaylistProvider for isolated playback — no shared
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
import type { WaveformPlaylistTheme } from '@waveform-playlist/ui-components';
import type WaveformData from 'waveform-data';

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

// Theme variants for demonstration
// Note: waveOutlineColor = waveform bars, waveFillColor = background
// IMPORTANT: Set selectedWave* colors to match unselected to prevent color change on track selection
const defaultTheme: Partial<WaveformPlaylistTheme> = {
  waveOutlineColor: '#E0EFF1',
  waveFillColor: '#4a9eff',
  waveProgressColor: 'orange',
  selectionColor: 'rgba(74, 158, 255, 0.3)',
  playheadColor: 'orange',
  selectedWaveOutlineColor: '#E0EFF1',
  selectedWaveFillColor: '#4a9eff',
};

const neonTheme: Partial<WaveformPlaylistTheme> = {
  waveOutlineColor: '#00ff88',
  waveFillColor: '#0a0a1a',
  waveProgressColor: '#ff00ff',
  selectionColor: 'rgba(255, 0, 255, 0.35)',
  playheadColor: '#ff00ff',
  selectedWaveOutlineColor: '#00ffcc',
  selectedWaveFillColor: '#0a1a2a',
};

const retroTheme: Partial<WaveformPlaylistTheme> = {
  waveOutlineColor: '#ff6b35',
  waveFillColor: '#1a1a1a',
  waveProgressColor: '#ffcc00',
  selectionColor: 'rgba(255, 204, 0, 0.4)',
  playheadColor: 'transparent',
  selectedWaveOutlineColor: '#ff8c42',
  selectedWaveFillColor: '#2a1a0a',
};

const boldTheme: Partial<WaveformPlaylistTheme> = {
  waveOutlineColor: '#E0EFF1',
  waveFillColor: '#4a9eff',
  waveProgressColor: 'transparent',
  selectionColor: 'rgba(74, 158, 255, 0.3)',
  playheadColor: 'orange',
  selectedWaveOutlineColor: '#E0EFF1',
  selectedWaveFillColor: '#4a9eff',
};

const minimalTheme: Partial<WaveformPlaylistTheme> = {
  waveOutlineColor: '#333333',
  waveFillColor: '#f0f0f0',
  waveProgressColor: '#f0f0f0',
  selectionColor: 'rgba(51, 51, 51, 0.2)',
  playheadColor: '#333333',
  selectedWaveOutlineColor: '#333333',
  selectedWaveFillColor: '#f0f0f0',
};

const AUDIO_SRC = '/waveform-playlist/media/audio/AlbertKader_Whiptails/09_Synth1.opus';
const PEAKS_SRC = '/waveform-playlist/media/audio/AlbertKader_Whiptails/09_Synth1.dat';

function PlaybackControls({ loading }: { loading?: boolean }) {
  const { play, stop } = useMediaElementControls();
  const { isPlaying } = useMediaElementAnimation();

  return (
    <Controls>
      <ControlButton onClick={() => play()} disabled={isPlaying}>
        Play
      </ControlButton>
      <ControlButton onClick={() => stop()} disabled={!isPlaying}>
        Stop
      </ControlButton>
      {loading && <span style={{ fontSize: '0.875rem', color: '#666' }}>Loading...</span>}
    </Controls>
  );
}

interface WaveformVariantProps {
  barWidth?: number;
  barGap?: number;
  theme?: Partial<WaveformPlaylistTheme>;
  waveformData: WaveformData;
  loading?: boolean;
}

function WaveformVariant({
  barWidth = 1,
  barGap = 0,
  theme = defaultTheme,
  waveformData,
  loading,
}: WaveformVariantProps) {
  const trackConfig = React.useMemo(
    () => ({
      source: AUDIO_SRC,
      waveformData,
      name: 'Synth',
    }),
    [waveformData]
  );

  return (
    <MediaElementPlaylistProvider
      track={trackConfig}
      samplesPerPixel={4096}
      waveHeight={80}
      theme={theme}
      barWidth={barWidth}
      barGap={barGap}
    >
      <PlaybackControls loading={loading} />
      <MediaElementWaveform />
    </MediaElementPlaylistProvider>
  );
}

export function StylingExample() {
  const [waveformData, setWaveformData] = React.useState<WaveformData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

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

  if (loading || !waveformData) {
    return (
      <Grid>
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          {error ? `Error: ${error}` : 'Loading waveform data...'}
        </div>
      </Grid>
    );
  }

  return (
    <Grid>
      <Section>
        <SectionTitle>Default (Continuous)</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 1, barGap: 0</Code> — <Code>waveOutlineColor: '#E0EFF1'</Code>, <Code>waveFillColor: '#4a9eff'</Code>, <Code>waveProgressColor: 'orange'</Code>
        </SectionDesc>
        <WaveformVariant barWidth={1} barGap={0} theme={defaultTheme} waveformData={waveformData} />
      </Section>

      <Section>
        <SectionTitle>Thin Bars</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 1, barGap: 1</Code> — same theme, thin bars with small gaps
        </SectionDesc>
        <WaveformVariant barWidth={1} barGap={1} theme={defaultTheme} waveformData={waveformData} />
      </Section>

      <Section>
        <SectionTitle>Medium Bars</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 2, barGap: 1</Code> — same theme, wider bars for a balanced look
        </SectionDesc>
        <WaveformVariant barWidth={2} barGap={1} theme={defaultTheme} waveformData={waveformData} />
      </Section>

      <Section>
        <SectionTitle>Wide Bars (SoundCloud Style)</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 3, barGap: 1</Code> — same theme, wide bars like SoundCloud
        </SectionDesc>
        <WaveformVariant barWidth={3} barGap={1} theme={defaultTheme} waveformData={waveformData} />
      </Section>

      <Section>
        <SectionTitle>Extra Wide Bars</SectionTitle>
        <SectionDesc>
          <Code>barWidth: 4, barGap: 2</Code> — <Code>waveProgressColor: 'transparent'</Code> hides the progress overlay
        </SectionDesc>
        <WaveformVariant barWidth={4} barGap={2} theme={boldTheme} waveformData={waveformData} />
      </Section>

      <Section>
        <SectionTitle>Neon Theme</SectionTitle>
        <SectionDesc>
          <Code>waveOutlineColor: '#00ff88'</Code>, <Code>waveProgressColor: '#ff00ff'</Code> on a dark background
        </SectionDesc>
        <WaveformVariant barWidth={2} barGap={1} theme={neonTheme} waveformData={waveformData} />
      </Section>

      <Section>
        <SectionTitle>Retro Theme</SectionTitle>
        <SectionDesc>
          <Code>waveOutlineColor: '#ff6b35'</Code>, <Code>waveProgressColor: '#ffcc00'</Code>, <Code>playheadColor: 'transparent'</Code>
        </SectionDesc>
        <WaveformVariant barWidth={2} barGap={0} theme={retroTheme} waveformData={waveformData} />
      </Section>

      <Section>
        <SectionTitle>Minimal Theme</SectionTitle>
        <SectionDesc>
          <Code>waveOutlineColor: '#333'</Code>, <Code>waveFillColor: '#f0f0f0'</Code> — grayscale, no progress contrast
        </SectionDesc>
        <WaveformVariant barWidth={1} barGap={2} theme={minimalTheme} waveformData={waveformData} />
      </Section>
    </Grid>
  );
}
