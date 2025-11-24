import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { MasterVolumeControl } from '../components/MasterVolumeControl';

const meta: Meta<typeof MasterVolumeControl> = {
  title: 'Components/MasterVolumeControl',
  component: MasterVolumeControl,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof MasterVolumeControl>;

export const Default: Story = {
  render: () => {
    const [volume, setVolume] = useState(1);
    return <MasterVolumeControl volume={volume} onChange={setVolume} />;
  },
};

export const HalfVolume: Story = {
  render: () => {
    const [volume, setVolume] = useState(0.5);
    return <MasterVolumeControl volume={volume} onChange={setVolume} />;
  },
};

export const Muted: Story = {
  render: () => {
    const [volume, setVolume] = useState(0);
    return <MasterVolumeControl volume={volume} onChange={setVolume} />;
  },
};

export const Disabled: Story = {
  render: () => {
    return <MasterVolumeControl volume={0.75} onChange={() => {}} disabled />;
  },
};
