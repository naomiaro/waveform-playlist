import type { Meta, StoryObj } from '@storybook/react';
import { useTheme } from 'styled-components';
import { DndContext } from '@dnd-kit/core';
import { Clip } from '../components/Clip';
import { Channel } from '../components/Channel';
import type { WaveformPlaylistTheme } from '../wfpl-theme';

// Generate sample waveform data for stories
function generateSamplePeaks(length: number, bits: 8 | 16 = 8): Int8Array | Int16Array {
  const data = bits === 8 ? new Int8Array(length * 2) : new Int16Array(length * 2);
  const maxValue = 2 ** (bits - 1) - 1;

  for (let i = 0; i < length; i++) {
    const amplitude = Math.sin(i * 0.05) * 0.7 + Math.sin(i * 0.1) * 0.3;
    const min = Math.floor(-Math.abs(amplitude) * maxValue);
    const max = Math.floor(Math.abs(amplitude) * maxValue);
    data[i * 2] = min;
    data[i * 2 + 1] = max;
  }

  return data;
}

const sampleData = generateSamplePeaks(200, 8);

// Wrapper component that uses theme from context for Channel colors
const ThemedChannel = ({ outlineColor, fillColor, ...props }: {
  index: number;
  data: Int8Array | Int16Array;
  bits: 8 | 16;
  length: number;
  waveHeight: number;
  outlineColor?: string;
  fillColor?: string;
}) => {
  const theme = useTheme() as WaveformPlaylistTheme;
  return (
    <Channel
      {...props}
      waveOutlineColor={outlineColor || theme.waveOutlineColor}
      waveFillColor={fillColor || theme.waveFillColor}
    />
  );
};

const meta: Meta<typeof Clip> = {
  title: 'Components/Clip',
  component: Clip,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <DndContext>
        <div style={{ position: 'relative', height: '120px', width: '600px' }}>
          <Story />
        </div>
      </DndContext>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Clip>;

export const Default: Story = {
  args: {
    clipId: 'clip-1',
    trackIndex: 0,
    clipIndex: 0,
    trackName: 'Vocals',
    startSample: 0,
    durationSamples: 96000,
    samplesPerPixel: 500,
    showHeader: false,
  },
  render: (args) => (
    <Clip {...args}>
      <ThemedChannel
        index={0}
        data={sampleData}
        bits={8}
        length={200}
        waveHeight={80}
      />
    </Clip>
  ),
};

export const WithHeader: Story = {
  args: {
    clipId: 'clip-1',
    trackIndex: 0,
    clipIndex: 0,
    trackName: 'Vocals',
    startSample: 0,
    durationSamples: 96000,
    samplesPerPixel: 500,
    showHeader: true,
    disableHeaderDrag: true,
  },
  render: (args) => (
    <Clip {...args}>
      <ThemedChannel
        index={0}
        data={sampleData}
        bits={8}
        length={200}
        waveHeight={80}
      />
    </Clip>
  ),
};

export const Selected: Story = {
  args: {
    clipId: 'clip-1',
    trackIndex: 0,
    clipIndex: 0,
    trackName: 'Vocals',
    startSample: 0,
    durationSamples: 96000,
    samplesPerPixel: 500,
    showHeader: true,
    isSelected: true,
    disableHeaderDrag: true,
  },
  render: (args) => (
    <Clip {...args}>
      <ThemedChannel
        index={0}
        data={sampleData}
        bits={8}
        length={200}
        waveHeight={80}
      />
    </Clip>
  ),
};

export const Offset: Story = {
  args: {
    clipId: 'clip-2',
    trackIndex: 0,
    clipIndex: 1,
    trackName: 'Guitar',
    startSample: 48000,
    durationSamples: 96000,
    samplesPerPixel: 500,
    showHeader: true,
    disableHeaderDrag: true,
  },
  render: (args) => (
    <Clip {...args}>
      <ThemedChannel
        index={0}
        data={sampleData}
        bits={8}
        length={200}
        waveHeight={80}
        outlineColor="#4A9EFF"
        fillColor="#1e1e1e"
      />
    </Clip>
  ),
};

export const Overlay: Story = {
  args: {
    clipId: 'clip-1',
    trackIndex: 0,
    clipIndex: 0,
    trackName: 'Vocals',
    startSample: 0,
    durationSamples: 96000,
    samplesPerPixel: 500,
    showHeader: true,
    isOverlay: true,
  },
  decorators: [
    (Story) => (
      <DndContext>
        <div style={{ position: 'relative', height: '120px', width: '300px', background: 'rgba(0,0,0,0.1)' }}>
          <Story />
        </div>
      </DndContext>
    ),
  ],
  render: (args) => (
    <Clip {...args}>
      <ThemedChannel
        index={0}
        data={sampleData}
        bits={8}
        length={200}
        waveHeight={80}
      />
    </Clip>
  ),
};
