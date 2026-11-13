import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { useTheme } from 'styled-components';
import { TimeScale } from '../components/TimeScale';
import type { PrecomputedTickData } from '../components/TimeScale';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { DevicePixelRatioProvider } from '../contexts/DevicePixelRatio';
import type { WaveformPlaylistTheme } from '../wfpl-theme';

const playlistInfo = {
  sampleRate: 48000,
  samplesPerPixel: 1000,
  waveHeight: 80,
  timeScaleHeight: 20,
  barWidth: 1,
  barGap: 0,
  roundedBars: false,
  progressBarWidth: 1,
};

/**
 * Build simple tick data for demonstration.
 * In production, SmartScale computes this — these stories test
 * the pure tick renderer in isolation.
 */
function buildTickData(
  totalWidth: number,
  ticks: Array<{ pix: number; height: number; label?: string }>
): PrecomputedTickData {
  const canvasInfo = new Map<number, number>();
  const timeMarkersWithPositions: Array<{ pix: number; element: React.ReactNode }> = [];

  for (const tick of ticks) {
    canvasInfo.set(tick.pix, tick.height);
    if (tick.label) {
      timeMarkersWithPositions.push({
        pix: tick.pix,
        element: (
          <div
            key={`label-${tick.pix}`}
            style={{
              position: 'absolute',
              left: `${tick.pix + 4}px`,
              fontSize: '0.75rem',
              whiteSpace: 'nowrap',
            }}
          >
            {tick.label}
          </div>
        ),
      });
    }
  }

  return { widthX: totalWidth, canvasInfo, timeMarkersWithPositions };
}

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
      const theme =
        context.globals.theme === 'dark'
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

/**
 * TimeScale is a pure tick renderer. It receives pre-computed pixel
 * positions, tick heights, and label elements — it doesn't know about
 * milliseconds, BPM, or time signatures. Use SmartScale stories to
 * see temporal and beats & bars modes in action.
 */
export const Default: Story = {
  args: {
    tickData: buildTickData(800, [
      { pix: 0, height: 20, label: '0:00' },
      { pix: 48, height: 4 },
      { pix: 96, height: 4 },
      { pix: 144, height: 4 },
      { pix: 192, height: 10 },
      { pix: 240, height: 4 },
      { pix: 288, height: 4 },
      { pix: 336, height: 4 },
      { pix: 384, height: 4 },
      { pix: 432, height: 10 },
      { pix: 480, height: 20, label: '0:10' },
      { pix: 528, height: 4 },
      { pix: 576, height: 4 },
      { pix: 624, height: 4 },
      { pix: 672, height: 10 },
      { pix: 720, height: 4 },
      { pix: 768, height: 4 },
    ]),
  },
};

export const CustomLabels: Story = {
  args: {
    tickData: buildTickData(600, [
      { pix: 0, height: 20, label: 'Bar 1' },
      { pix: 100, height: 10 },
      { pix: 200, height: 20, label: 'Bar 2' },
      { pix: 300, height: 10 },
      { pix: 400, height: 20, label: 'Bar 3' },
      { pix: 500, height: 10 },
    ]),
  },
};

export const DenseTickMarks: Story = {
  args: {
    tickData: buildTickData(
      500,
      Array.from({ length: 50 }, (_, i) => ({
        pix: i * 10,
        height: i % 10 === 0 ? 20 : i % 5 === 0 ? 10 : 4,
        label: i % 10 === 0 ? `${i / 10}s` : undefined,
      }))
    ),
  },
};
