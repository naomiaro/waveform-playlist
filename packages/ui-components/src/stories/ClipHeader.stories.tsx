import type { Meta, StoryObj } from '@storybook/react';
import { ClipHeader, ClipHeaderPresentational } from '../components/ClipHeader';

const meta: Meta<typeof ClipHeaderPresentational> = {
  title: 'Components/ClipHeader',
  component: ClipHeaderPresentational,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ClipHeaderPresentational>;

export const Default: Story = {
  args: {
    trackName: 'Vocals',
    isSelected: false,
  },
};

export const Selected: Story = {
  args: {
    trackName: 'Vocals',
    isSelected: true,
  },
};

export const LongTrackName: Story = {
  args: {
    trackName: 'Very Long Track Name That Might Overflow',
    isSelected: false,
  },
};

export const ShortTrackName: Story = {
  args: {
    trackName: 'BGM',
    isSelected: false,
  },
};
