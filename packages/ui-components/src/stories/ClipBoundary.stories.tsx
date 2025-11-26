import type { Meta, StoryObj } from '@storybook/react';
import { useState } from 'react';
import { ClipBoundary } from '../components/ClipBoundary';

const meta: Meta<typeof ClipBoundary> = {
  title: 'Components/ClipBoundary',
  component: ClipBoundary,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{
        position: 'relative',
        width: '200px',
        height: '100px',
        background: 'rgba(0,0,0,0.1)',
        border: '1px solid #ccc',
      }}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof ClipBoundary>;

// Mock drag handle props for demonstration
const mockDragHandleProps = {
  attributes: {},
  listeners: {},
  setActivatorNodeRef: () => {},
  isDragging: false,
};

export const LeftEdge: Story = {
  args: {
    clipId: 'clip-1',
    trackIndex: 0,
    clipIndex: 0,
    edge: 'left',
    dragHandleProps: mockDragHandleProps,
  },
};

export const RightEdge: Story = {
  args: {
    clipId: 'clip-1',
    trackIndex: 0,
    clipIndex: 0,
    edge: 'right',
    dragHandleProps: mockDragHandleProps,
  },
};

export const LeftEdgeDragging: Story = {
  args: {
    clipId: 'clip-1',
    trackIndex: 0,
    clipIndex: 0,
    edge: 'left',
    dragHandleProps: { ...mockDragHandleProps, isDragging: true },
  },
};

export const RightEdgeDragging: Story = {
  args: {
    clipId: 'clip-1',
    trackIndex: 0,
    clipIndex: 0,
    edge: 'right',
    dragHandleProps: { ...mockDragHandleProps, isDragging: true },
  },
};

export const BothEdges: Story = {
  render: () => (
    <>
      <ClipBoundary
        clipId="clip-1"
        trackIndex={0}
        clipIndex={0}
        edge="left"
        dragHandleProps={mockDragHandleProps}
      />
      <ClipBoundary
        clipId="clip-1"
        trackIndex={0}
        clipIndex={0}
        edge="right"
        dragHandleProps={mockDragHandleProps}
      />
    </>
  ),
};

export const InteractiveHover: Story = {
  render: () => {
    const [leftHovered, setLeftHovered] = useState(false);
    const [rightHovered, setRightHovered] = useState(false);

    return (
      <div>
        <p style={{ marginBottom: '1rem', fontSize: '0.875rem' }}>
          Hover over the edges to see the hover effect
        </p>
        <div style={{
          position: 'relative',
          width: '200px',
          height: '100px',
          background: 'rgba(0,0,0,0.1)',
          border: '1px solid #ccc',
        }}>
          <ClipBoundary
            clipId="clip-1"
            trackIndex={0}
            clipIndex={0}
            edge="left"
            dragHandleProps={mockDragHandleProps}
          />
          <ClipBoundary
            clipId="clip-1"
            trackIndex={0}
            clipIndex={0}
            edge="right"
            dragHandleProps={mockDragHandleProps}
          />
        </div>
      </div>
    );
  },
};
