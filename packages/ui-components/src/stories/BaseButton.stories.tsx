import type { Meta, StoryObj } from '@storybook/react';
import { BaseButton } from '../styled';

const meta: Meta<typeof BaseButton> = {
  title: 'Base/Button',
  component: BaseButton,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BaseButton>;

export const Default: Story = {
  args: {
    children: 'Button',
  },
};

export const Disabled: Story = {
  args: {
    children: 'Disabled Button',
    disabled: true,
  },
};
