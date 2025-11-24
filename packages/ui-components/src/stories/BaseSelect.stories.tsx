import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { BaseSelect } from '../styled';

const meta: Meta<typeof BaseSelect> = {
  title: 'Base/Select',
  component: BaseSelect,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BaseSelect>;

export const Default: Story = {
  render: () => (
    <BaseSelect>
      <option value="">Select an option...</option>
      <option value="1">Option 1</option>
      <option value="2">Option 2</option>
      <option value="3">Option 3</option>
    </BaseSelect>
  ),
};

export const WithValue: Story = {
  render: () => (
    <BaseSelect defaultValue="2">
      <option value="1">Option 1</option>
      <option value="2">Option 2</option>
      <option value="3">Option 3</option>
    </BaseSelect>
  ),
};

export const Disabled: Story = {
  render: () => (
    <BaseSelect disabled>
      <option value="">Disabled</option>
    </BaseSelect>
  ),
};
