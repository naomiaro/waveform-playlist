import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Selection } from '../components/Selection';

const meta: Meta<typeof Selection> = {
  title: 'Components/Selection',
  component: Selection,
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
    startPosition: {
      control: { type: 'range', min: 0, max: 400, step: 10 },
    },
    endPosition: {
      control: { type: 'range', min: 0, max: 500, step: 10 },
    },
    color: {
      control: 'color',
    },
  },
};

export default meta;
type Story = StoryObj<typeof Selection>;

export const Default: Story = {
  args: {
    startPosition: 100,
    endPosition: 300,
    color: '#00ff00',
  },
};

export const SmallSelection: Story = {
  args: {
    startPosition: 200,
    endPosition: 250,
    color: '#00ff00',
  },
};

export const FullWidth: Story = {
  args: {
    startPosition: 0,
    endPosition: 500,
    color: '#00ff00',
  },
};

export const HotPink: Story = {
  args: {
    startPosition: 100,
    endPosition: 350,
    color: 'rgba(255, 105, 180, 0.7)',
  },
};

export const NoSelection: Story = {
  args: {
    startPosition: 100,
    endPosition: 100,
    color: '#00ff00',
  },
};
