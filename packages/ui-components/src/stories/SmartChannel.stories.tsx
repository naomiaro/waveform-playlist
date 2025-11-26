import type { Meta, StoryObj } from '@storybook/react';
import { SmartChannel } from '../components/SmartChannel';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { DevicePixelRatioProvider } from '../contexts/DevicePixelRatio';

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

const sampleData8bit = generateSamplePeaks(500, 8);

const playlistInfo = {
  sampleRate: 48000,
  samplesPerPixel: 1000,
  zoomLevels: [1000, 1500, 2000, 2500],
  waveHeight: 80,
  timeScaleHeight: 15,
  duration: 30000,
  controls: {
    show: false,
    width: 150,
  },
};

const meta: Meta<typeof SmartChannel> = {
  title: 'Components/SmartChannel',
  component: SmartChannel,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={playlistInfo}>
          <Story />
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SmartChannel>;

export const Default: Story = {
  args: {
    index: 0,
    data: sampleData8bit,
    bits: 8,
    length: 500,
  },
};

export const WithProgress: Story = {
  args: {
    index: 0,
    data: sampleData8bit,
    bits: 8,
    length: 500,
    progress: 200,
  },
};

export const Selected: Story = {
  args: {
    index: 0,
    data: sampleData8bit,
    bits: 8,
    length: 500,
    isSelected: true,
  },
};
