import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { ThemeProvider } from 'styled-components';
import { defaultTheme } from '../wfpl-theme';
import { SegmentedVUMeter } from '../components/SegmentedVUMeter';
import { dBToNormalized } from '@waveform-playlist/core';

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
        <div style={{ padding: '2rem' }}>
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
    coloredInactive: { control: 'boolean' },
    labelColor: { control: 'color' },
    colorStops: { control: false },
  },
};

export default meta;

type StoryWithLevels = StoryObj<
  typeof SegmentedVUMeter & { leftLevelDb: number; rightLevelDb: number }
>;

export const StereoVertical: StoryWithLevels = {
  name: 'Stereo Vertical',
  argTypes: {
    leftLevelDb: {
      control: { type: 'range', min: -50, max: 5, step: 0.5 },
      name: 'Left (dB)',
    },
    rightLevelDb: {
      control: { type: 'range', min: -50, max: 5, step: 0.5 },
      name: 'Right (dB)',
    },
  },
  args: {
    leftLevelDb: -6,
    rightLevelDb: -12,
    segmentCount: 24,
    segmentWidth: 20,
    segmentHeight: 8,
    segmentGap: 2,
    showScale: true,
    orientation: 'vertical',
  },
  render: ({ leftLevelDb, rightLevelDb, ...props }) => (
    <SegmentedVUMeter
      levels={[dBToNormalized(leftLevelDb), dBToNormalized(rightLevelDb)]}
      {...props}
    />
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
    leftLevelDb: {
      control: { type: 'range', min: -50, max: 5, step: 0.5 },
      name: 'Level (dB)',
    },
    rightLevelDb: { table: { disable: true } },
  },
  args: {
    leftLevelDb: -10,
    showScale: true,
  },
  render: ({ leftLevelDb, ...props }) => (
    <SegmentedVUMeter levels={[dBToNormalized(leftLevelDb)]} channelLabels={['M']} {...props} />
  ),
  parameters: {
    docs: { description: { story: 'Single channel mono meter with "M" label.' } },
  },
};

export const Horizontal: StoryWithLevels = {
  name: 'Horizontal',
  argTypes: {
    leftLevelDb: {
      control: { type: 'range', min: -50, max: 5, step: 0.5 },
      name: 'Left (dB)',
    },
    rightLevelDb: {
      control: { type: 'range', min: -50, max: 5, step: 0.5 },
      name: 'Right (dB)',
    },
  },
  args: {
    leftLevelDb: -4,
    rightLevelDb: -10,
    orientation: 'horizontal',
    showScale: true,
  },
  render: ({ leftLevelDb, rightLevelDb, ...props }) => (
    <SegmentedVUMeter
      levels={[dBToNormalized(leftLevelDb), dBToNormalized(rightLevelDb)]}
      {...props}
    />
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
    leftLevelDb: {
      control: { type: 'range', min: -50, max: 5, step: 0.5 },
      name: 'Left (dB)',
    },
    rightLevelDb: {
      control: { type: 'range', min: -50, max: 5, step: 0.5 },
      name: 'Right (dB)',
    },
  },
  args: {
    leftLevelDb: -4,
    rightLevelDb: -10,
    orientation: 'horizontal',
    segmentCount: 40,
    segmentWidth: 14,
    segmentHeight: 4,
    segmentGap: 1,
    showScale: true,
  },
  render: ({ leftLevelDb, rightLevelDb, ...props }) => (
    <SegmentedVUMeter
      levels={[dBToNormalized(leftLevelDb), dBToNormalized(rightLevelDb)]}
      {...props}
    />
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
        { dB: 2, color: '#ff0055' },
        { dB: 0, color: '#ff3300' },
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

export const CompactSize: StoryWithLevels = {
  name: 'Compact Size',
  argTypes: {
    leftLevelDb: {
      control: { type: 'range', min: -50, max: 5, step: 0.5 },
      name: 'Left (dB)',
    },
    rightLevelDb: {
      control: { type: 'range', min: -50, max: 5, step: 0.5 },
      name: 'Right (dB)',
    },
  },
  args: {
    leftLevelDb: -8,
    rightLevelDb: -15,
    segmentWidth: 12,
    segmentHeight: 5,
    segmentGap: 1,
    segmentCount: 16,
    showScale: true,
  },
  render: ({ leftLevelDb, rightLevelDb, ...props }) => (
    <SegmentedVUMeter
      levels={[dBToNormalized(leftLevelDb), dBToNormalized(rightLevelDb)]}
      {...props}
    />
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
