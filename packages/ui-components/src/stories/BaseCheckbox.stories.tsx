import type { Meta, StoryObj } from '@storybook/react';
import React, { useState } from 'react';
import { BaseCheckboxWrapper, BaseCheckbox, BaseCheckboxLabel } from '../styled';

interface CheckboxDemoProps {
  checked?: boolean;
  disabled?: boolean;
}

const CheckboxDemo = ({ checked: initialChecked = false, disabled = false }: CheckboxDemoProps) => {
  const [checked, setChecked] = useState(initialChecked);

  return (
    <BaseCheckboxWrapper>
      <BaseCheckbox
        type="checkbox"
        id="demo-checkbox"
        checked={checked}
        onChange={(e) => setChecked(e.target.checked)}
        disabled={disabled}
      />
      <BaseCheckboxLabel htmlFor="demo-checkbox">
        {disabled ? 'Disabled checkbox' : 'Click to toggle'}
      </BaseCheckboxLabel>
    </BaseCheckboxWrapper>
  );
};

const meta: Meta<typeof CheckboxDemo> = {
  title: 'Base/Checkbox',
  component: CheckboxDemo,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof CheckboxDemo>;

export const Unchecked: Story = {
  args: {
    checked: false,
  },
};

export const Checked: Story = {
  args: {
    checked: true,
  },
};

export const Disabled: Story = {
  args: {
    checked: false,
    disabled: true,
  },
};
