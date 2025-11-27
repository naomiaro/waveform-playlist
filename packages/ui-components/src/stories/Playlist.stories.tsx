import type { Meta, StoryObj } from '@storybook/react';
import { useTheme } from 'styled-components';
import { Playlist } from '../components/Playlist';
import { Track } from '../components/Track';
import { Channel } from '../components/Channel';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { TrackControlsContext } from '../contexts/TrackControls';
import type { WaveformPlaylistTheme } from '../wfpl-theme';
import { fn } from 'storybook/test';

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
const sampleData2 = generateSamplePeaks(400, 8);

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

// Simple timescale component for demos
const SimpleTimescale = () => (
  <div style={{
    height: '20px',
    background: '#f0f0f0',
    borderBottom: '1px solid #ddd',
    display: 'flex',
    alignItems: 'flex-end',
    paddingLeft: '10px',
    fontSize: '0.75rem',
    color: '#666',
  }}>
    <span style={{ marginRight: '100px' }}>0:00</span>
    <span style={{ marginRight: '100px' }}>0:10</span>
    <span style={{ marginRight: '100px' }}>0:20</span>
    <span>0:30</span>
  </div>
);

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

const meta: Meta<typeof Playlist> = {
  title: 'Components/Playlist',
  component: Playlist,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <PlaylistInfoContext.Provider value={playlistInfo}>
        <TrackControlsContext.Provider value={null}>
          <Story />
        </TrackControlsContext.Provider>
      </PlaylistInfoContext.Provider>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof Playlist>;

export const Default: Story = {
  args: {
    tracksWidth: 600,
  },
  render: (args) => (
    <Playlist {...args}>
      <Track numChannels={1}>
        <ThemedChannel
          index={0}
          data={sampleData}
          bits={8}
          length={500}
          waveHeight={80}
        />
      </Track>
    </Playlist>
  ),
};

export const WithTimescale: Story = {
  args: {
    tracksWidth: 600,
    timescaleWidth: 600,
    timescale: <SimpleTimescale />,
  },
  render: (args) => (
    <Playlist {...args}>
      <Track numChannels={1}>
        <ThemedChannel
          index={0}
          data={sampleData}
          bits={8}
          length={500}
          waveHeight={80}
        />
      </Track>
    </Playlist>
  ),
};

export const MultipleTracks: Story = {
  args: {
    tracksWidth: 600,
    timescaleWidth: 600,
    timescale: <SimpleTimescale />,
  },
  render: (args) => (
    <Playlist {...args}>
      <Track numChannels={1} backgroundColor="#e8f4ff">
        <ThemedChannel
          index={0}
          data={sampleData}
          bits={8}
          length={500}
          waveHeight={80}
        />
      </Track>
      <Track numChannels={1} backgroundColor="#fff5e6">
        <ThemedChannel
          index={0}
          data={sampleData2}
          bits={8}
          length={400}
          waveHeight={80}
          outlineColor="#FF6B35"
          fillColor="#1e1e1e"
        />
      </Track>
      <Track numChannels={1} backgroundColor="#e8ffe8">
        <ThemedChannel
          index={0}
          data={sampleData}
          bits={8}
          length={500}
          waveHeight={80}
          outlineColor="#2E8B57"
          fillColor="#90EE90"
        />
      </Track>
    </Playlist>
  ),
};

export const WithClickHandler: Story = {
  args: {
    tracksWidth: 600,
    onTracksClick: fn(),
    onTracksMouseDown: fn(),
    onTracksMouseMove: fn(),
    onTracksMouseUp: fn(),
  },
  render: (args) => (
    <Playlist {...args}>
      <Track numChannels={1}>
        <ThemedChannel
          index={0}
          data={sampleData}
          bits={8}
          length={500}
          waveHeight={80}
        />
      </Track>
    </Playlist>
  ),
};

export const Scrollable: Story = {
  args: {
    tracksWidth: 1200,
    scrollContainerWidth: 1200,
  },
  decorators: [
    (Story) => (
      <PlaylistInfoContext.Provider value={playlistInfo}>
        <TrackControlsContext.Provider value={null}>
          <div style={{ width: '600px', overflow: 'hidden' }}>
            <Story />
          </div>
        </TrackControlsContext.Provider>
      </PlaylistInfoContext.Provider>
    ),
  ],
  render: (args) => (
    <Playlist {...args}>
      <Track numChannels={1}>
        <ThemedChannel
          index={0}
          data={sampleData}
          bits={8}
          length={500}
          waveHeight={80}
        />
      </Track>
    </Playlist>
  ),
};
