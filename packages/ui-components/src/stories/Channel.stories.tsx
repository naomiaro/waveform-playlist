import type { Meta, StoryObj } from '@storybook/react';
import { Channel } from '../components/Channel';

// Generate sample waveform data for stories
function generateSamplePeaks(length: number, bits: 8 | 16 = 8): Int8Array | Int16Array {
  const data = bits === 8 ? new Int8Array(length * 2) : new Int16Array(length * 2);
  const maxValue = 2 ** (bits - 1) - 1;

  for (let i = 0; i < length; i++) {
    // Create a simple waveform pattern
    const amplitude = Math.sin(i * 0.05) * 0.7 + Math.sin(i * 0.1) * 0.3;
    const min = Math.floor(-Math.abs(amplitude) * maxValue);
    const max = Math.floor(Math.abs(amplitude) * maxValue);
    data[i * 2] = min;
    data[i * 2 + 1] = max;
  }

  return data;
}

const sampleData8bit = generateSamplePeaks(500, 8);
const sampleData16bit = generateSamplePeaks(500, 16);

const meta: Meta<typeof Channel> = {
  title: 'Components/Channel',
  component: Channel,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    waveHeight: {
      control: { type: 'range', min: 40, max: 200, step: 10 },
    },
    progress: {
      control: { type: 'range', min: 0, max: 500, step: 10 },
    },
  },
};

export default meta;
type Story = StoryObj<typeof Channel>;

export const Default: Story = {
  args: {
    index: 0,
    data: sampleData8bit,
    bits: 8,
    length: 500,
    waveHeight: 80,
    waveOutlineColor: '#005BBB',
    waveFillColor: '#FFD500',
    waveProgressColor: '#ff0000',
  },
};

export const WithProgress: Story = {
  args: {
    index: 0,
    data: sampleData8bit,
    bits: 8,
    length: 500,
    progress: 200,
    waveHeight: 80,
    waveOutlineColor: '#005BBB',
    waveFillColor: '#FFD500',
    waveProgressColor: '#ff0000',
  },
};

export const Bit16: Story = {
  args: {
    index: 0,
    data: sampleData16bit,
    bits: 16,
    length: 500,
    waveHeight: 80,
    waveOutlineColor: '#005BBB',
    waveFillColor: '#FFD500',
    waveProgressColor: '#ff0000',
  },
};

export const TallWaveform: Story = {
  args: {
    index: 0,
    data: sampleData8bit,
    bits: 8,
    length: 500,
    waveHeight: 150,
    waveOutlineColor: '#005BBB',
    waveFillColor: '#FFD500',
    waveProgressColor: '#ff0000',
  },
};

export const CustomColors: Story = {
  args: {
    index: 0,
    data: sampleData8bit,
    bits: 8,
    length: 500,
    waveHeight: 80,
    waveOutlineColor: '#4A9EFF',
    waveFillColor: '#1e1e1e',
    waveProgressColor: '#ff4444',
  },
};
