import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ThemeProvider } from 'styled-components';
import { TimeScale } from '../components/TimeScale';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { DevicePixelRatioProvider } from '../contexts/DevicePixelRatio';
import { defaultTheme, darkTheme } from '../wfpl-theme';

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

const meta: Meta<typeof TimeScale> = {
  title: 'Components/TimeScale',
  component: TimeScale,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <ThemeProvider theme={defaultTheme}>
          <PlaylistInfoContext.Provider value={playlistInfo}>
            <div style={{ background: '#f5f5f5', padding: '1rem' }}>
              <Story />
            </div>
          </PlaylistInfoContext.Provider>
        </ThemeProvider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof TimeScale>;

export const Default: Story = {
  args: {
    theme: defaultTheme,
    duration: 60000,
    marker: 10000,
    bigStep: 5000,
    secondStep: 1000,
  },
};

export const ShortDuration: Story = {
  args: {
    theme: defaultTheme,
    duration: 15000,
    marker: 5000,
    bigStep: 1000,
    secondStep: 500,
  },
};

export const LongDuration: Story = {
  args: {
    theme: defaultTheme,
    duration: 180000,
    marker: 30000,
    bigStep: 10000,
    secondStep: 5000,
  },
};

export const FineTicks: Story = {
  args: {
    theme: defaultTheme,
    duration: 30000,
    marker: 5000,
    bigStep: 1000,
    secondStep: 200,
  },
};

export const WithControlsOffset: Story = {
  args: {
    theme: defaultTheme,
    duration: 60000,
    marker: 10000,
    bigStep: 5000,
    secondStep: 1000,
  },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <ThemeProvider theme={defaultTheme}>
          <PlaylistInfoContext.Provider value={playlistInfoWithControls}>
            <div style={{ background: '#f5f5f5', padding: '1rem' }}>
              <Story />
            </div>
          </PlaylistInfoContext.Provider>
        </ThemeProvider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const CustomTimestampRenderer: Story = {
  args: {
    theme: defaultTheme,
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

export const DarkTheme: Story = {
  args: {
    theme: darkTheme,
    duration: 60000,
    marker: 10000,
    bigStep: 5000,
    secondStep: 1000,
  },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <ThemeProvider theme={darkTheme}>
          <PlaylistInfoContext.Provider value={playlistInfo}>
            <div style={{ background: darkTheme.backgroundColor, padding: '1rem' }}>
              <Story />
            </div>
          </PlaylistInfoContext.Provider>
        </ThemeProvider>
      </DevicePixelRatioProvider>
    ),
  ],
};
