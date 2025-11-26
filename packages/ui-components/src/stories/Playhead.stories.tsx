import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Playhead } from '../components/Playhead';

const meta: Meta<typeof Playhead> = {
  title: 'Components/Playhead',
  component: Playhead,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{ position: 'relative', width: '500px', height: '200px', background: '#f0f0f0' }}>
        <Story />
      </div>
    ),
  ],
  argTypes: {
    position: {
      control: { type: 'range', min: 0, max: 500, step: 10 },
    },
    color: {
      control: 'color',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Playhead>;

export const Default: Story = {
  args: {
    position: 100,
    color: '#ff0000',
  },
};

export const AtStart: Story = {
  args: {
    position: 0,
    color: '#ff0000',
  },
};

export const AtMiddle: Story = {
  args: {
    position: 250,
    color: '#ff0000',
  },
};

export const CustomColor: Story = {
  args: {
    position: 150,
    color: '#00ff00',
  },
};

export const DarkThemeColor: Story = {
  args: {
    position: 200,
    color: '#ff4444',
  },
};
