import type { Meta, StoryObj, Decorator } from '@storybook/react';
import React, { useState } from 'react';
import { TrackControlsWithDelete } from '../components/TrackControlsWithDelete';
import { fn } from 'storybook/test';

const meta: Meta<typeof TrackControlsWithDelete> = {
  title: 'Components/TrackControlsWithDelete',
  component: TrackControlsWithDelete,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    ((Story) => (
      <div style={{ width: '200px', height: '180px' }}>
        <Story />
      </div>
    )) as Decorator,
  ],
};

export default meta;
type Story = StoryObj<typeof TrackControlsWithDelete>;

export const Default: Story = {
  args: {
    trackIndex: 0,
    trackName: 'Vocals',
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
    onMuteChange: fn(),
    onSoloChange: fn(),
    onVolumeChange: fn(),
    onPanChange: fn(),
    onDelete: fn(),
  },
};

export const Muted: Story = {
  args: {
    ...Default.args,
    muted: true,
  },
};

export const Soloed: Story = {
  args: {
    ...Default.args,
    soloed: true,
  },
};

export const LowVolume: Story = {
  args: {
    ...Default.args,
    volume: 0.3,
  },
};

export const PannedLeft: Story = {
  args: {
    ...Default.args,
    pan: -0.7,
  },
};

export const PannedRight: Story = {
  args: {
    ...Default.args,
    pan: 0.7,
  },
};

export const Interactive: Story = {
  render: () => {
    const [muted, setMuted] = useState(false);
    const [soloed, setSoloed] = useState(false);
    const [volume, setVolume] = useState(1);
    const [pan, setPan] = useState(0);

    return (
      <TrackControlsWithDelete
        trackIndex={0}
        trackName="Interactive Track"
        muted={muted}
        soloed={soloed}
        volume={volume}
        pan={pan}
        onMuteChange={setMuted}
        onSoloChange={setSoloed}
        onVolumeChange={setVolume}
        onPanChange={setPan}
        onDelete={() => alert('Track deleted!')}
      />
    );
  },
};

export const LongTrackName: Story = {
  args: {
    ...Default.args,
    trackName: 'Very Long Track Name That Overflows',
  },
};
