import type { StoryObj } from '@storybook/react';
import React, { useState, useEffect } from 'react';
import { ThemeProvider } from 'styled-components';
import { defaultTheme } from '../wfpl-theme';
import { SegmentedVUMeter } from '../components/SegmentedVUMeter';

/**
 * SegmentedVUMeter
 *
 * A segmented LED-style VU meter supporting multiple channels,
 * vertical/horizontal orientation, customizable colors, and dB scale.
 */

export default {
  title: 'Components/SegmentedVUMeter',
  tags: ['autodocs'],
};

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <ThemeProvider theme={defaultTheme}>
    <div style={{ padding: '2rem', background: '#111' }}>{children}</div>
  </ThemeProvider>
);

export const StereoVertical: StoryObj = {
  name: 'Stereo Vertical',
  render: () => (
    <Wrapper>
      <SegmentedVUMeter
        levels={[0.65, 0.45]}
        peakLevels={[0.8, 0.6]}
      />
    </Wrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Default stereo meter with L/R channels, peak indicators, and dB scale.',
      },
    },
  },
};

export const MonoVertical: StoryObj = {
  name: 'Mono Vertical',
  render: () => (
    <Wrapper>
      <SegmentedVUMeter
        levels={[0.55]}
        peakLevels={[0.75]}
        channelLabels={['M']}
      />
    </Wrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Single channel mono meter with "M" label.',
      },
    },
  },
};

export const Horizontal: StoryObj = {
  name: 'Horizontal',
  render: () => (
    <Wrapper>
      <SegmentedVUMeter
        levels={[0.7, 0.5]}
        peakLevels={[0.85, 0.65]}
        orientation="horizontal"
        segmentWidth={5}
        segmentHeight={20}
      />
    </Wrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Horizontal orientation with adjusted segment dimensions (wider segments, shorter height).',
      },
    },
  },
};

export const CustomColors: StoryObj = {
  name: 'Custom Colors',
  render: () => (
    <Wrapper>
      <SegmentedVUMeter
        levels={[0.7, 0.5]}
        peakLevels={[0.85, 0.65]}
        colorStops={[
          { dB: 2, color: '#ff0055' },
          { dB: 0, color: '#ff6600' },
          { dB: -3, color: '#ffcc00' },
          { dB: -8, color: '#00ff88' },
          { dB: -15, color: '#00ccff' },
          { dB: -50, color: '#0066ff' },
        ]}
      />
    </Wrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Custom color stops for a different visual style.',
      },
    },
  },
};

const AnimatedMeterDemo: React.FC = () => {
  const [levels, setLevels] = useState([0.3, 0.3]);
  const [peakLevels, setPeakLevels] = useState([0.3, 0.3]);

  useEffect(() => {
    const interval = setInterval(() => {
      setLevels((prev) => {
        const walk = (v: number) => {
          const delta = (Math.random() - 0.5) * 0.15;
          return Math.max(0.01, Math.min(0.95, v + delta));
        };
        return prev.map(walk);
      });
      setPeakLevels((prev) =>
        prev.map((peak, i) => {
          const currentLevel = levels[i];
          if (currentLevel > peak) return currentLevel;
          return peak * 0.995;
        })
      );
    }, 50);

    return () => clearInterval(interval);
  }, [levels]);

  return (
    <SegmentedVUMeter
      levels={levels}
      peakLevels={peakLevels}
    />
  );
};

export const Animated: StoryObj = {
  name: 'Animated',
  render: () => (
    <Wrapper>
      <AnimatedMeterDemo />
    </Wrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Simulated real-time levels using a random walk with peak decay.',
      },
    },
  },
};

export const CompactSize: StoryObj = {
  name: 'Compact Size',
  render: () => (
    <Wrapper>
      <SegmentedVUMeter
        levels={[0.6, 0.4]}
        peakLevels={[0.75, 0.55]}
        segmentWidth={12}
        segmentHeight={5}
        segmentGap={1}
        segmentCount={16}
      />
    </Wrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Compact meter with smaller segments (12x5, gap 1, 16 segments).',
      },
    },
  },
};

export const NoScale: StoryObj = {
  name: 'No Scale',
  render: () => (
    <Wrapper>
      <SegmentedVUMeter
        levels={[0.6, 0.45]}
        peakLevels={[0.8, 0.6]}
        showScale={false}
      />
    </Wrapper>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Meter without the dB scale column, for tighter layouts.',
      },
    },
  },
};
