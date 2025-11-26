import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import styled from 'styled-components';
import { FadeOverlay } from '../components/FadeOverlay';

// Container to show the fade overlay in context (simulating a clip)
const ClipContainer = styled.div<{ $width: number }>`
  position: relative;
  width: ${props => props.$width}px;
  height: 100px;
  background: linear-gradient(90deg, #005BBB 0%, #FFD500 100%);
  border-radius: 4px;
  overflow: hidden;
`;

// Wrapper for side-by-side comparison
const ComparisonWrapper = styled.div`
  display: flex;
  gap: 32px;
  flex-wrap: wrap;
`;

const LabeledExample = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.span`
  font-size: 12px;
  color: ${props => props.theme.textColor || '#666'};
`;

const meta: Meta<typeof FadeOverlay> = {
  title: 'Components/FadeOverlay',
  component: FadeOverlay,
  parameters: {
    layout: 'padded',
  },
  tags: ['autodocs'],
  argTypes: {
    left: {
      control: { type: 'range', min: 0, max: 200, step: 1 },
      description: 'Position in pixels from the start of the clip',
    },
    width: {
      control: { type: 'range', min: 10, max: 200, step: 1 },
      description: 'Width of the fade region in pixels',
    },
    type: {
      control: { type: 'select' },
      options: ['fadeIn', 'fadeOut'],
      description: 'Type of fade: fadeIn or fadeOut',
    },
    curveType: {
      control: { type: 'select' },
      options: ['linear', 'logarithmic', 'exponential', 'sCurve'],
      description: 'The shape of the fade curve',
    },
    color: {
      control: { type: 'color' },
      description: 'Custom fill color for the fade overlay',
    },
  },
  decorators: [
    (Story, context) => (
      <ClipContainer $width={300}>
        <Story />
      </ClipContainer>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof FadeOverlay>;

export const FadeIn: Story = {
  args: {
    left: 0,
    width: 100,
    type: 'fadeIn',
    curveType: 'logarithmic',
  },
};

export const FadeOut: Story = {
  args: {
    left: 200,
    width: 100,
    type: 'fadeOut',
    curveType: 'logarithmic',
  },
};

export const LinearCurve: Story = {
  args: {
    left: 0,
    width: 100,
    type: 'fadeIn',
    curveType: 'linear',
  },
};

export const ExponentialCurve: Story = {
  args: {
    left: 0,
    width: 100,
    type: 'fadeIn',
    curveType: 'exponential',
  },
};

export const SCurve: Story = {
  args: {
    left: 0,
    width: 100,
    type: 'fadeIn',
    curveType: 'sCurve',
  },
};

export const CustomColor: Story = {
  args: {
    left: 0,
    width: 100,
    type: 'fadeIn',
    curveType: 'logarithmic',
    color: 'rgba(255, 0, 0, 0.5)',
  },
};

// Story showing all curve types side by side
export const AllCurveTypes: Story = {
  decorators: [
    () => (
      <ComparisonWrapper>
        <LabeledExample>
          <Label>Linear</Label>
          <ClipContainer $width={150}>
            <FadeOverlay left={0} width={100} type="fadeIn" curveType="linear" />
          </ClipContainer>
        </LabeledExample>
        <LabeledExample>
          <Label>Logarithmic (default)</Label>
          <ClipContainer $width={150}>
            <FadeOverlay left={0} width={100} type="fadeIn" curveType="logarithmic" />
          </ClipContainer>
        </LabeledExample>
        <LabeledExample>
          <Label>Exponential</Label>
          <ClipContainer $width={150}>
            <FadeOverlay left={0} width={100} type="fadeIn" curveType="exponential" />
          </ClipContainer>
        </LabeledExample>
        <LabeledExample>
          <Label>S-Curve</Label>
          <ClipContainer $width={150}>
            <FadeOverlay left={0} width={100} type="fadeIn" curveType="sCurve" />
          </ClipContainer>
        </LabeledExample>
      </ComparisonWrapper>
    ),
  ],
  parameters: {
    controls: { disable: true },
  },
};

// Story showing fade in and fade out side by side
export const FadeInVsFadeOut: Story = {
  decorators: [
    () => (
      <ComparisonWrapper>
        <LabeledExample>
          <Label>Fade In</Label>
          <ClipContainer $width={200}>
            <FadeOverlay left={0} width={100} type="fadeIn" curveType="logarithmic" />
          </ClipContainer>
        </LabeledExample>
        <LabeledExample>
          <Label>Fade Out (mirrored)</Label>
          <ClipContainer $width={200}>
            <FadeOverlay left={100} width={100} type="fadeOut" curveType="logarithmic" />
          </ClipContainer>
        </LabeledExample>
      </ComparisonWrapper>
    ),
  ],
  parameters: {
    controls: { disable: true },
  },
};

// Story showing a full clip with both fades
export const FullClipWithFades: Story = {
  decorators: [
    () => (
      <LabeledExample>
        <Label>Clip with fade in and fade out</Label>
        <ClipContainer $width={400}>
          <FadeOverlay left={0} width={80} type="fadeIn" curveType="logarithmic" />
          <FadeOverlay left={320} width={80} type="fadeOut" curveType="logarithmic" />
        </ClipContainer>
      </LabeledExample>
    ),
  ],
  parameters: {
    controls: { disable: true },
  },
};
