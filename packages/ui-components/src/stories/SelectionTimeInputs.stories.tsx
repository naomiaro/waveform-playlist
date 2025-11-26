import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { SelectionTimeInputs } from '../components/SelectionTimeInputs';

const meta: Meta<typeof SelectionTimeInputs> = {
  title: 'Components/SelectionTimeInputs',
  component: SelectionTimeInputs,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SelectionTimeInputs>;

export const Default: Story = {
  args: {
    selectionStart: 0,
    selectionEnd: 0,
  },
};

export const WithSelection: Story = {
  args: {
    selectionStart: 10.5,
    selectionEnd: 25.75,
  },
};

export const LongSelection: Story = {
  args: {
    selectionStart: 60,
    selectionEnd: 180.5,
  },
};

export const Interactive: Story = {
  render: () => {
    const [start, setStart] = useState(5);
    const [end, setEnd] = useState(15);

    const handleChange = (newStart: number, newEnd: number) => {
      setStart(newStart);
      setEnd(newEnd);
    };

    return (
      <div>
        <SelectionTimeInputs
          selectionStart={start}
          selectionEnd={end}
          onSelectionChange={handleChange}
        />
        <p style={{ marginTop: '1rem' }}>
          Start: {start.toFixed(3)}s, End: {end.toFixed(3)}s
        </p>
        <p>Duration: {(end - start).toFixed(3)}s</p>
      </div>
    );
  },
};
