import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { AutomaticScrollCheckbox } from '../components/AutomaticScrollCheckbox';

const meta: Meta<typeof AutomaticScrollCheckbox> = {
  title: 'Components/AutomaticScrollCheckbox',
  component: AutomaticScrollCheckbox,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AutomaticScrollCheckbox>;

export const Checked: Story = {
  args: {
    checked: true,
    onChange: () => {},
  },
};

export const Unchecked: Story = {
  args: {
    checked: false,
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    checked: true,
    onChange: () => {},
    disabled: true,
  },
};

export const Interactive: Story = {
  render: () => {
    const [checked, setChecked] = useState(true);
    return (
      <AutomaticScrollCheckbox
        checked={checked}
        onChange={setChecked}
      />
    );
  },
};
