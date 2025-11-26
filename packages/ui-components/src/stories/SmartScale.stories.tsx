import type { Meta, StoryObj } from '@storybook/react';
import { SmartScale } from '../components/SmartScale';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { DevicePixelRatioProvider } from '../contexts/DevicePixelRatio';

// Different zoom levels to demonstrate SmartScale behavior
const createPlaylistInfo = (samplesPerPixel: number, duration: number) => ({
  sampleRate: 48000,
  samplesPerPixel,
  zoomLevels: [500, 1000, 1500, 2000, 2500, 5000, 10000],
  waveHeight: 80,
  timeScaleHeight: 20,
  duration,
  controls: {
    show: false,
    width: 150,
  },
});

const meta: Meta<typeof SmartScale> = {
  title: 'Components/SmartScale',
  component: SmartScale,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SmartScale>;

export const ZoomedIn: Story = {
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(500, 30000)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Samples per pixel: 500 (zoomed in)
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const MediumZoom: Story = {
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(1500, 60000)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Samples per pixel: 1500 (medium zoom)
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const ZoomedOut: Story = {
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(5000, 180000)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Samples per pixel: 5000 (zoomed out)
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const VeryZoomedOut: Story = {
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(12000, 300000)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Samples per pixel: 12000 (very zoomed out)
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const ShortDuration: Story = {
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(500, 10000)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Short duration: 10 seconds
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const LongDuration: Story = {
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(10000, 600000)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Long duration: 10 minutes
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};
