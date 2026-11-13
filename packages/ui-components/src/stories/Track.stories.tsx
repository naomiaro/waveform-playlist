import type { Meta, StoryObj } from '@storybook/react';
import { useTheme } from 'styled-components';
import { Track } from '../components/Track';
import { Channel } from '../components/Channel';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
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

const sampleData = generateSamplePeaks(500, 8);

const playlistInfo = {
  sampleRate: 48000,
  samplesPerPixel: 1000,
  waveHeight: 80,
  timeScaleHeight: 15,
  barWidth: 1,
  barGap: 0,
  roundedBars: false,
  progressBarWidth: 1,
};

// Wrapper component that uses theme from context for Channel colors
const ThemedChannel = ({
  outlineColor,
  fillColor,
  ...props
}: {
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

const meta: Meta<typeof Track> = {
  title: 'Components/Track',
  component: Track,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <PlaylistInfoContext.Provider value={playlistInfo}>
        <Story />
      </PlaylistInfoContext.Provider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Track>;

export const Default: Story = {
  args: {
    numChannels: 1,
  },
  render: (args) => (
    <Track {...args}>
      <ThemedChannel index={0} data={sampleData} bits={8} length={500} waveHeight={80} />
    </Track>
  ),
};

export const WithBackground: Story = {
  args: {
    numChannels: 1,
    backgroundColor: '#e8f4ff',
  },
  render: (args) => (
    <Track {...args}>
      <ThemedChannel index={0} data={sampleData} bits={8} length={500} waveHeight={80} />
    </Track>
  ),
};

export const Selected: Story = {
  args: {
    numChannels: 1,
    isSelected: true,
  },
  render: (args) => (
    <Track {...args}>
      <ThemedChannel index={0} data={sampleData} bits={8} length={500} waveHeight={80} />
    </Track>
  ),
};

export const WithOffset: Story = {
  args: {
    numChannels: 1,
    offset: 100,
  },
  render: (args) => (
    <Track {...args}>
      <ThemedChannel index={0} data={sampleData} bits={8} length={500} waveHeight={80} />
    </Track>
  ),
};

export const WithClipHeaders: Story = {
  args: {
    numChannels: 1,
    hasClipHeaders: true,
  },
  render: (args) => (
    <Track {...args}>
      <ThemedChannel index={0} data={sampleData} bits={8} length={500} waveHeight={80} />
    </Track>
  ),
};

export const StereoTrack: Story = {
  args: {
    numChannels: 2,
  },
  render: (args) => (
    <Track {...args}>
      <div style={{ position: 'relative', height: '160px' }}>
        <ThemedChannel index={0} data={sampleData} bits={8} length={500} waveHeight={80} />
        <div style={{ position: 'absolute', top: '80px', width: '100%' }}>
          <ThemedChannel index={1} data={sampleData} bits={8} length={500} waveHeight={80} />
        </div>
      </div>
    </Track>
  ),
};
