import type { Meta, StoryObj } from '@storybook/react-webpack5';
import { ThemeProvider } from 'styled-components';
import { Track } from '../components/Track';
import { Channel } from '../components/Channel';
import { PlaylistInfoContext } from '../contexts/PlaylistInfo';
import { TrackControlsContext } from '../contexts/TrackControls';
import { defaultTheme, darkTheme } from '../wfpl-theme';
import { Controls, Header, ButtonGroup, Button, SliderWrapper, Slider, VolumeDownIcon, VolumeUpIcon } from '../components/TrackControls/index';

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
  zoomLevels: [1000, 1500, 2000, 2500],
  waveHeight: 80,
  timeScaleHeight: 15,
  duration: 30000,
  controls: {
    show: true,
    width: 150,
  },
};

const playlistInfoNoControls = {
  ...playlistInfo,
  controls: {
    show: false,
    width: 150,
  },
};

// Sample track controls component
const SampleTrackControls = () => (
  <Controls>
    <Header>
      <span>Vocals</span>
    </Header>
    <ButtonGroup>
      <Button $variant="outline">Mute</Button>
      <Button $variant="outline">Solo</Button>
    </ButtonGroup>
    <SliderWrapper>
      <VolumeDownIcon />
      <Slider type="range" min={0} max={1} step={0.01} defaultValue={1} />
      <VolumeUpIcon />
    </SliderWrapper>
  </Controls>
);

const meta: Meta<typeof Track> = {
  title: 'Components/Track',
  component: Track,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <ThemeProvider theme={defaultTheme}>
        <PlaylistInfoContext.Provider value={playlistInfo}>
          <TrackControlsContext.Provider value={<SampleTrackControls />}>
            <Story />
          </TrackControlsContext.Provider>
        </PlaylistInfoContext.Provider>
      </ThemeProvider>
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
      <Channel
        index={0}
        data={sampleData}
        bits={8}
        length={500}
        waveHeight={80}
        waveOutlineColor="#005BBB"
        waveFillColor="#FFD500"
      />
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
      <Channel
        index={0}
        data={sampleData}
        bits={8}
        length={500}
        waveHeight={80}
        waveOutlineColor="#005BBB"
        waveFillColor="#FFD500"
      />
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
      <Channel
        index={0}
        data={sampleData}
        bits={8}
        length={500}
        waveHeight={80}
        waveOutlineColor="#005BBB"
        waveFillColor="#FFD500"
      />
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
      <Channel
        index={0}
        data={sampleData}
        bits={8}
        length={500}
        waveHeight={80}
        waveOutlineColor="#005BBB"
        waveFillColor="#FFD500"
      />
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
      <Channel
        index={0}
        data={sampleData}
        bits={8}
        length={500}
        waveHeight={80}
        waveOutlineColor="#005BBB"
        waveFillColor="#FFD500"
      />
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
        <Channel
          index={0}
          data={sampleData}
          bits={8}
          length={500}
          waveHeight={80}
          waveOutlineColor="#005BBB"
          waveFillColor="#FFD500"
        />
        <div style={{ position: 'absolute', top: '80px', width: '100%' }}>
          <Channel
            index={1}
            data={sampleData}
            bits={8}
            length={500}
            waveHeight={80}
            waveOutlineColor="#005BBB"
            waveFillColor="#FFD500"
          />
        </div>
      </div>
    </Track>
  ),
};

export const NoControls: Story = {
  args: {
    numChannels: 1,
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={defaultTheme}>
        <PlaylistInfoContext.Provider value={playlistInfoNoControls}>
          <TrackControlsContext.Provider value={null}>
            <Story />
          </TrackControlsContext.Provider>
        </PlaylistInfoContext.Provider>
      </ThemeProvider>
    ),
  ],
  render: (args) => (
    <Track {...args}>
      <Channel
        index={0}
        data={sampleData}
        bits={8}
        length={500}
        waveHeight={80}
        waveOutlineColor="#005BBB"
        waveFillColor="#FFD500"
      />
    </Track>
  ),
};

export const DarkTheme: Story = {
  args: {
    numChannels: 1,
  },
  decorators: [
    (Story) => (
      <ThemeProvider theme={darkTheme}>
        <PlaylistInfoContext.Provider value={playlistInfo}>
          <TrackControlsContext.Provider value={<SampleTrackControls />}>
            <div style={{ background: darkTheme.backgroundColor }}>
              <Story />
            </div>
          </TrackControlsContext.Provider>
        </PlaylistInfoContext.Provider>
      </ThemeProvider>
    ),
  ],
  render: (args) => (
    <Track {...args}>
      <Channel
        index={0}
        data={sampleData}
        bits={8}
        length={500}
        waveHeight={80}
        waveOutlineColor={darkTheme.waveOutlineColor}
        waveFillColor={darkTheme.waveFillColor}
      />
    </Track>
  ),
};
