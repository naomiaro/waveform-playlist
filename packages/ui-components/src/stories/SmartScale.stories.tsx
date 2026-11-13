import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { SmartScale } from '../components/SmartScale';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { DevicePixelRatioProvider } from '../contexts/DevicePixelRatio';
import { BeatsAndBarsProvider } from '../contexts/BeatsAndBars';

// Different zoom levels to demonstrate SmartScale behavior
const createPlaylistInfo = (samplesPerPixel: number) => ({
  sampleRate: 48000,
  samplesPerPixel,
  waveHeight: 80,
  timeScaleHeight: 20,
  barWidth: 1,
  barGap: 0,
  roundedBars: false,
  progressBarWidth: 1,
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

// --- Temporal mode stories ---

export const TemporalZoomedIn: Story = {
  args: { durationMs: 30000 },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(500)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Temporal · Samples per pixel: 500 (zoomed in)
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const TemporalMediumZoom: Story = {
  args: { durationMs: 60000 },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(1500)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Temporal · Samples per pixel: 1500 (medium zoom)
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const TemporalZoomedOut: Story = {
  args: { durationMs: 180000 },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(5000)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Temporal · Samples per pixel: 5000 (zoomed out)
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const TemporalVeryZoomedOut: Story = {
  args: { durationMs: 300000 },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(12000)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Temporal · Samples per pixel: 12000 (very zoomed out)
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const TemporalCustomLabels: Story = {
  args: {
    durationMs: 60000,
    renderTick: (label: string, pixelPosition: number) => (
      <div
        style={{
          position: 'absolute',
          left: `${pixelPosition + 4}px`,
          fontSize: '0.7rem',
          color: '#0066cc',
          fontWeight: 'bold',
        }}
      >
        {label}
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(1000)}>
          <div style={{ padding: '1rem' }}>
            <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
              Temporal · Custom labels (seconds only, blue)
            </p>
            <Story />
          </div>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

// --- Beats & bars mode stories ---

export const BeatsAndBars120BPM: Story = {
  args: { durationMs: 30000 },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(1000)}>
          <BeatsAndBarsProvider bpm={120} timeSignature={[4, 4]} snapTo="beat">
            <div style={{ padding: '1rem' }}>
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Beats & Bars · 120 BPM · 4/4
              </p>
              <Story />
            </div>
          </BeatsAndBarsProvider>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const BeatsAndBars119BPM: Story = {
  args: { durationMs: 30000 },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(1000)}>
          <BeatsAndBarsProvider bpm={119} timeSignature={[4, 4]} snapTo="beat">
            <div style={{ padding: '1rem' }}>
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Beats & Bars · 119 BPM · 4/4 (non-integer ms per beat)
              </p>
              <Story />
            </div>
          </BeatsAndBarsProvider>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const BeatsAndBarsWaltzTime: Story = {
  args: { durationMs: 30000 },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(1000)}>
          <BeatsAndBarsProvider bpm={140} timeSignature={[3, 4]} snapTo="beat">
            <div style={{ padding: '1rem' }}>
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Beats & Bars · 140 BPM · 3/4 (waltz time)
              </p>
              <Story />
            </div>
          </BeatsAndBarsProvider>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const BeatsAndBars78Time: Story = {
  args: { durationMs: 30000 },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(1000)}>
          <BeatsAndBarsProvider bpm={160} timeSignature={[7, 8]} snapTo="beat">
            <div style={{ padding: '1rem' }}>
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Beats & Bars · 160 BPM · 7/8 (odd meter)
              </p>
              <Story />
            </div>
          </BeatsAndBarsProvider>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const BeatsAndBarsZoomedOut: Story = {
  args: { durationMs: 120000 },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(3000)}>
          <BeatsAndBarsProvider bpm={120} timeSignature={[4, 4]} snapTo="bar">
            <div style={{ padding: '1rem' }}>
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Beats & Bars · 120 BPM · 4/4 · Zoomed out (spp: 3000, 2 min)
              </p>
              <Story />
            </div>
          </BeatsAndBarsProvider>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};

export const BeatsAndBarsCustomLabels: Story = {
  args: {
    durationMs: 30000,
    renderTick: (label: string, pixelPosition: number) => (
      <div
        style={{
          position: 'absolute',
          left: `${pixelPosition + 4}px`,
          fontSize: '0.7rem',
          color: '#cc6600',
          fontWeight: 'bold',
          fontFamily: 'monospace',
        }}
      >
        {label}
      </div>
    ),
  },
  decorators: [
    (Story) => (
      <DevicePixelRatioProvider>
        <PlaylistInfoContext.Provider value={createPlaylistInfo(1000)}>
          <BeatsAndBarsProvider bpm={120} timeSignature={[4, 4]} snapTo="beat">
            <div style={{ padding: '1rem' }}>
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>
                Beats & Bars · Custom labels (seconds, orange monospace)
              </p>
              <Story />
            </div>
          </BeatsAndBarsProvider>
        </PlaylistInfoContext.Provider>
      </DevicePixelRatioProvider>
    ),
  ],
};
