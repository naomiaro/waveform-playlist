import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TimeInput } from '../components/TimeInput';

const meta: Meta<typeof TimeInput> = {
  title: 'Components/TimeInput',
  component: TimeInput,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TimeInput>;

export const Default: Story = {
  args: {
    id: 'time-input',
    label: 'Time Input',
    value: 0,
    format: 'hh:mm:ss.uuu',
  },
};

export const WithTime: Story = {
  args: {
    id: 'time-input',
    label: 'Time Input',
    value: 90.5,
    format: 'hh:mm:ss.uuu',
  },
};

export const SecondsFormat: Story = {
  args: {
    id: 'time-input',
    label: 'Time Input',
    value: 123.456,
    format: 'seconds',
  },
};

export const ThousandthsFormat: Story = {
  args: {
    id: 'time-input',
    label: 'Time Input',
    value: 45.678,
    format: 'thousandths',
  },
};

export const ReadOnly: Story = {
  args: {
    id: 'time-input',
    label: 'Time Input',
    value: 60,
    format: 'hh:mm:ss',
    readOnly: true,
  },
};

export const Interactive: Story = {
  render: () => {
    const [value, setValue] = useState(30);
    return (
      <div>
        <TimeInput
          id="interactive-time"
          label="Interactive Time Input"
          value={value}
          format="hh:mm:ss.uuu"
          onChange={setValue}
        />
        <p style={{ marginTop: '1rem' }}>Value: {value.toFixed(3)} seconds</p>
      </div>
    );
  },
};
