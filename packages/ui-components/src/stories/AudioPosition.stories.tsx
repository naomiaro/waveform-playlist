import type { Meta, StoryObj } from '@storybook/react';
import { AudioPosition } from '../components/AudioPosition';

const meta: Meta<typeof AudioPosition> = {
  title: 'Components/AudioPosition',
  component: AudioPosition,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AudioPosition>;

export const Default: Story = {
  args: {
    formattedTime: '00:00:00.000',
  },
};

export const WithTime: Story = {
  args: {
    formattedTime: '01:23:45.678',
  },
};

export const SecondsFormat: Story = {
  args: {
    formattedTime: '123.456',
  },
};

export const ShortFormat: Story = {
  args: {
    formattedTime: '1:30',
  },
};
