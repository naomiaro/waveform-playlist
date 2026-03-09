import type { Meta, StoryObj } from '@storybook/react';
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

const meta: Meta<typeof SegmentedVUMeter> = {
  title: 'Components/SegmentedVUMeter',
  component: SegmentedVUMeter,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider theme={defaultTheme}>
        <div style={{ padding: '2rem', background: '#111' }}>
          <Story />
        </div>
      </ThemeProvider>
    ),
  ],
  argTypes: {
    levels: { control: false },
    peakLevels: { control: false },
    orientation: { control: 'radio', options: ['vertical', 'horizontal'] },
    segmentCount: { control: { type: 'range', min: 8, max: 60, step: 1 } },
    segmentWidth: { control: { type: 'range', min: 4, max: 30, step: 1 } },
    segmentHeight: { control: { type: 'range', min: 2, max: 20, step: 1 } },
    segmentGap: { control: { type: 'range', min: 0, max: 5, step: 1 } },
    showScale: { control: 'boolean' },
    colorStops: { control: false },
  },
};

export default meta;

type StoryWithLevels = StoryObj<
  typeof SegmentedVUMeter & { leftLevel: number; rightLevel: number }
>;

export const StereoVertical: StoryWithLevels = {
  name: 'Stereo Vertical',
  argTypes: {
    leftLevel: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    rightLevel: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
  },
  args: {
    leftLevel: 0.65,
    rightLevel: 0.45,
    segmentCount: 24,
    segmentWidth: 20,
    segmentHeight: 8,
    segmentGap: 2,
    showScale: true,
    orientation: 'vertical',
  },
  render: ({ leftLevel, rightLevel, ...props }) => (
    <SegmentedVUMeter levels={[leftLevel, rightLevel]} {...props} />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Default stereo meter with L/R channels, peak indicators, and dB scale. Use the level sliders to see all colour ranges.',
      },
    },
  },
};

export const MonoVertical: StoryWithLevels = {
  name: 'Mono Vertical',
  argTypes: {
    leftLevel: { control: { type: 'range', min: 0, max: 1, step: 0.01 }, name: 'level' },
    rightLevel: { table: { disable: true } },
  },
  args: {
    leftLevel: 0.55,
    showScale: true,
  },
  render: ({ leftLevel, ...props }) => (
    <SegmentedVUMeter levels={[leftLevel]} channelLabels={['M']} {...props} />
  ),
  parameters: {
    docs: { description: { story: 'Single channel mono meter with "M" label.' } },
  },
};

export const Horizontal: StoryWithLevels = {
  name: 'Horizontal',
  argTypes: {
    leftLevel: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    rightLevel: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
  },
  args: {
    leftLevel: 0.7,
    rightLevel: 0.5,
    orientation: 'horizontal',
    showScale: true,
  },
  render: ({ leftLevel, rightLevel, ...props }) => (
    <SegmentedVUMeter levels={[leftLevel, rightLevel]} {...props} />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Horizontal orientation with dB scale below. Segments render left-to-right (low to high dB).',
      },
    },
  },
};

export const HorizontalCompact: StoryWithLevels = {
  name: 'Horizontal Compact (DAW-style)',
  argTypes: {
    leftLevel: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    rightLevel: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
  },
  args: {
    leftLevel: 0.7,
    rightLevel: 0.5,
    orientation: 'horizontal',
    segmentCount: 40,
    segmentWidth: 14,
    segmentHeight: 4,
    segmentGap: 1,
    showScale: true,
  },
  render: ({ leftLevel, rightLevel, ...props }) => (
    <SegmentedVUMeter levels={[leftLevel, rightLevel]} {...props} />
  ),
  parameters: {
    docs: {
      description: {
        story:
          'Compact horizontal meter suitable for toolbars. 40 segments, thin bars, auto-spaced labels.',
      },
    },
  },
};

export const CustomColors: StoryObj = {
  name: 'Custom Colors',
  render: () => (
    <SegmentedVUMeter
      levels={[0.7, 0.5]}
      peakLevels={[0.85, 0.65]}
      colorStops={[
        { dB: -1, color: '#ff0055' },
        { dB: -3, color: '#ff6600' },
        { dB: -6, color: '#ffcc00' },
        { dB: -12, color: '#00ff88' },
        { dB: -25, color: '#00ccff' },
        { dB: -50, color: '#0066ff' },
      ]}
    />
  ),
  parameters: {
    docs: { description: { story: 'Custom color stops for a different visual style.' } },
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
        prev.map((peak) => {
          const simulated = 0.2 + Math.random() * 0.6;
          return simulated > peak ? simulated : peak * 0.995;
        })
      );
    }, 50);

    return () => clearInterval(interval);
  }, []);

  return <SegmentedVUMeter levels={levels} peakLevels={peakLevels} />;
};

export const Animated: StoryObj = {
  name: 'Animated',
  render: () => <AnimatedMeterDemo />,
  parameters: {
    docs: {
      description: { story: 'Simulated real-time levels using a random walk with peak decay.' },
    },
  },
};

export const CompactSize: StoryWithLevels = {
  name: 'Compact Size',
  argTypes: {
    leftLevel: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
    rightLevel: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
  },
  args: {
    leftLevel: 0.6,
    rightLevel: 0.4,
    segmentWidth: 12,
    segmentHeight: 5,
    segmentGap: 1,
    segmentCount: 16,
    showScale: true,
  },
  render: ({ leftLevel, rightLevel, ...props }) => (
    <SegmentedVUMeter levels={[leftLevel, rightLevel]} {...props} />
  ),
  parameters: {
    docs: {
      description: { story: 'Compact meter with smaller segments (12x5, gap 1, 16 segments).' },
    },
  },
};

export const NoScale: StoryObj = {
  name: 'No Scale',
  render: () => <SegmentedVUMeter levels={[0.6, 0.45]} peakLevels={[0.8, 0.6]} showScale={false} />,
  parameters: {
    docs: { description: { story: 'Meter without the dB scale column, for tighter layouts.' } },
  },
};
