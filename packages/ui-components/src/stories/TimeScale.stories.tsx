import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useTheme } from 'styled-components';
import { TimeScale } from '../components/TimeScale';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { DevicePixelRatioProvider } from '../contexts/DevicePixelRatio';
import type { WaveformPlaylistTheme } from '../wfpl-theme';

const playlistInfo = {
  sampleRate: 48000,
  samplesPerPixel: 1000,
  zoomLevels: [1000, 1500, 2000, 2500],
  waveHeight: 80,
  timeScaleHeight: 20,
  duration: 60000,
  controls: {
    show: false,
    width: 150,
  },
};

const playlistInfoWithControls = {
  ...playlistInfo,
  controls: {
    show: true,
    width: 150,
  },
};

// Wrapper component that gets theme from context and passes it as prop
const TimeScaleWithTheme = (props: Omit<React.ComponentProps<typeof TimeScale>, 'theme'>) => {
  const theme = useTheme() as WaveformPlaylistTheme;
  return <TimeScale {...props} theme={theme} />;
};

const meta: Meta<typeof TimeScaleWithTheme> = {
  title: 'Components/TimeScale',
  component: TimeScaleWithTheme,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'dark'
        ? { backgroundColor: '#1e1e1e' }
        : { backgroundColor: '#f5f5f5' };
      return (
        <DevicePixelRatioProvider>
          <PlaylistInfoContext.Provider value={playlistInfo}>
            <div style={{ background: theme.backgroundColor, padding: '1rem' }}>
              <Story />
            </div>
          </PlaylistInfoContext.Provider>
        </DevicePixelRatioProvider>
      );
    },
  ],
};

export default meta;
type Story = StoryObj<typeof TimeScaleWithTheme>;

export const Default: Story = {
  args: {
    duration: 60000,
    marker: 10000,
    bigStep: 5000,
    secondStep: 1000,
  },
};

export const ShortDuration: Story = {
  args: {
    duration: 15000,
    marker: 5000,
    bigStep: 1000,
    secondStep: 500,
  },
};

export const LongDuration: Story = {
  args: {
    duration: 180000,
    marker: 30000,
    bigStep: 10000,
    secondStep: 5000,
  },
};

export const FineTicks: Story = {
  args: {
    duration: 30000,
    marker: 5000,
    bigStep: 1000,
    secondStep: 200,
  },
};

export const WithControlsOffset: Story = {
  args: {
    duration: 60000,
    marker: 10000,
    bigStep: 5000,
    secondStep: 1000,
  },
  decorators: [
    (Story, context) => {
      const theme = context.globals.theme === 'dark'
        ? { backgroundColor: '#1e1e1e' }
        : { backgroundColor: '#f5f5f5' };
      return (
        <DevicePixelRatioProvider>
          <PlaylistInfoContext.Provider value={playlistInfoWithControls}>
            <div style={{ background: theme.backgroundColor, padding: '1rem' }}>
              <Story />
            </div>
          </PlaylistInfoContext.Provider>
        </DevicePixelRatioProvider>
      );
    },
  ],
};

export const CustomTimestampRenderer: Story = {
  args: {
    duration: 60000,
    marker: 10000,
    bigStep: 5000,
    secondStep: 1000,
    renderTimestamp: (timeMs: number, pixelPosition: number) => (
      <div
        style={{
          position: 'absolute',
          left: `${pixelPosition + 4}px`,
          fontSize: '0.7rem',
          color: '#0066cc',
          fontWeight: 'bold',
        }}
      >
        {Math.floor(timeMs / 1000)}s
      </div>
    ),
  },
};
