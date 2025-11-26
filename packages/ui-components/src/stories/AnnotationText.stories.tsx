import type { Meta, StoryObj } from '@storybook/react';
import { AnnotationText } from '@waveform-playlist/annotations';
import type { AnnotationData, AnnotationAction } from '@waveform-playlist/annotations';

const sampleAnnotations: AnnotationData[] = [
  {
    id: 'annotation-1',
    start: 0,
    end: 5.5,
    lines: ['Verse 1', 'First line of vocals'],
  },
  {
    id: 'annotation-2',
    start: 5.5,
    end: 12.3,
    lines: ['Chorus', 'Main hook section'],
  },
  {
    id: 'annotation-3',
    start: 12.3,
    end: 18.0,
    lines: ['Verse 2', 'Second verse starts here'],
  },
  {
    id: 'annotation-4',
    start: 18.0,
    end: 25.7,
    lines: ['Bridge', 'Instrumental transition'],
  },
];

const deleteAction: AnnotationAction = {
  text: '🗑',
  title: 'Delete annotation',
  action: (annotation: AnnotationData, index: number, annotations: AnnotationData[]) => {
    annotations.splice(index, 1);
  },
};

const editAction: AnnotationAction = {
  text: '✏️',
  title: 'Edit annotation',
  action: (annotation: AnnotationData) => {
    console.log('Edit annotation:', annotation);
  },
};

const meta: Meta<typeof AnnotationText> = {
  title: 'Annotations/AnnotationText',
  component: AnnotationText,
  parameters: {
    layout: 'padded',
    docs: {
      description: {
        component: 'Displays a scrollable list of annotations with time ranges. Shows hardcoded light theme colors that need dark theme support.',
      },
    },
  },
  tags: ['autodocs'],
  argTypes: {
    annotations: {
      description: 'Array of annotation data objects',
    },
    activeAnnotationId: {
      description: 'ID of the currently active annotation',
      control: 'select',
      options: [undefined, 'annotation-1', 'annotation-2', 'annotation-3', 'annotation-4'],
    },
    shouldScrollToActive: {
      description: 'Whether to auto-scroll to the active annotation',
      control: 'boolean',
    },
    editable: {
      description: 'Whether annotation text is editable',
      control: 'boolean',
    },
  },
};

export default meta;
type Story = StoryObj<typeof AnnotationText>;

export const Default: Story = {
  args: {
    annotations: sampleAnnotations,
    activeAnnotationId: undefined,
    shouldScrollToActive: false,
    editable: false,
  },
};

export const WithActiveAnnotation: Story = {
  args: {
    annotations: sampleAnnotations,
    activeAnnotationId: 'annotation-2',
    shouldScrollToActive: true,
    editable: false,
  },
};

export const Editable: Story = {
  args: {
    annotations: sampleAnnotations,
    activeAnnotationId: undefined,
    shouldScrollToActive: false,
    editable: true,
  },
};

export const WithControls: Story = {
  args: {
    annotations: sampleAnnotations,
    activeAnnotationId: 'annotation-1',
    shouldScrollToActive: false,
    editable: false,
    controls: [editAction, deleteAction],
  },
};

export const Empty: Story = {
  args: {
    annotations: [],
    editable: false,
  },
};

export const SingleAnnotation: Story = {
  args: {
    annotations: [sampleAnnotations[0]],
    activeAnnotationId: 'annotation-1',
    editable: false,
  },
};

export const LongText: Story = {
  args: {
    annotations: [
      {
        id: 'long-1',
        start: 0,
        end: 10,
        lines: [
          'This is a very long annotation that demonstrates how the component handles text that might wrap to multiple lines.',
          'It also includes multiple paragraphs of text to show the line spacing and overall layout behavior.',
          'The third line continues the pattern to test scrolling and overflow handling within the container.',
        ],
      },
    ],
    editable: true,
  },
};
