import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { Slider } from '../components/TrackControls';

const meta: Meta<typeof Slider> = {
  title: 'TrackControls/Slider',
  component: Slider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const Default: Story = {
  args: {
    min: 0,
    max: 100,
    defaultValue: 50,
  },
};

export const Volume: Story = {
  render: () => {
    const [value, setValue] = useState(100);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '150px' }}>
        <span style={{ fontSize: '12px' }}>Vol:</span>
        <Slider
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <span style={{ fontSize: '12px', minWidth: '30px' }}>{value}</span>
      </div>
    );
  },
};

export const Pan: Story = {
  render: () => {
    const [value, setValue] = useState(0);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '150px' }}>
        <span style={{ fontSize: '12px' }}>Pan:</span>
        <Slider
          min={-100}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
        />
        <span style={{ fontSize: '12px', minWidth: '30px' }}>{value}</span>
      </div>
    );
  },
};
