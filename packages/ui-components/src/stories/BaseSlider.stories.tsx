import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { BaseSlider } from '../styled';

const meta: Meta<typeof BaseSlider> = {
  title: 'Base/Slider',
  component: BaseSlider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BaseSlider>;

export const Default: Story = {
  args: {
    min: 0,
    max: 100,
    defaultValue: 50,
    style: { width: '200px' },
  },
};

export const Volume: Story = {
  render: () => {
    const [value, setValue] = useState(75);
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <BaseSlider
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          style={{ width: '200px' }}
        />
        <span>{value}%</span>
      </div>
    );
  },
};

export const Disabled: Story = {
  args: {
    min: 0,
    max: 100,
    defaultValue: 30,
    disabled: true,
    style: { width: '200px' },
  },
};
