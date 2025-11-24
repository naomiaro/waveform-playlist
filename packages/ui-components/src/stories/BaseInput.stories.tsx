import type { Meta, StoryObj } from '@storybook/react';
import { BaseInput } from '../styled';

const meta: Meta<typeof BaseInput> = {
  title: 'Base/Input',
  component: BaseInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BaseInput>;

export const Default: Story = {
  args: {
    placeholder: 'Enter text...',
  },
};

export const WithValue: Story = {
  args: {
    value: 'Hello World',
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    placeholder: 'Disabled input',
    disabled: true,
  },
};

export const ReadOnly: Story = {
  args: {
    value: 'Read only value',
    readOnly: true,
  },
};
