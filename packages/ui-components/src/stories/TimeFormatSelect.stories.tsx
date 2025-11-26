import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { TimeFormatSelect } from '../components/TimeFormatSelect';
import type { TimeFormat } from '../utils/timeFormat';

const meta: Meta<typeof TimeFormatSelect> = {
  title: 'Components/TimeFormatSelect',
  component: TimeFormatSelect,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TimeFormatSelect>;

export const Default: Story = {
  args: {
    value: 'hh:mm:ss.uuu',
    onChange: () => {},
  },
};

export const Seconds: Story = {
  args: {
    value: 'seconds',
    onChange: () => {},
  },
};

export const Thousandths: Story = {
  args: {
    value: 'thousandths',
    onChange: () => {},
  },
};

export const Disabled: Story = {
  args: {
    value: 'hh:mm:ss',
    onChange: () => {},
    disabled: true,
  },
};

export const Interactive: Story = {
  render: () => {
    const [format, setFormat] = useState<TimeFormat>('hh:mm:ss.uuu');
    return (
      <div>
        <TimeFormatSelect value={format} onChange={setFormat} />
        <p style={{ marginTop: '1rem' }}>Selected: {format}</p>
      </div>
    );
  },
};
