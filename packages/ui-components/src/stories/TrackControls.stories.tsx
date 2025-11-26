import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import { Button, ButtonGroup, Header, Controls, Slider, SliderWrapper, VolumeDownIcon, VolumeUpIcon, TrashIcon } from '../components/TrackControls/index';

// Button stories
const ButtonMeta: Meta<typeof Button> = {
  title: 'Components/TrackControls/Button',
  component: Button,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default ButtonMeta;
type ButtonStory = StoryObj<typeof Button>;

export const Outline: ButtonStory = {
  args: {
    children: 'Mute',
    $variant: 'outline',
  },
};

export const Danger: ButtonStory = {
  args: {
    children: 'Delete',
    $variant: 'danger',
  },
};

export const Info: ButtonStory = {
  args: {
    children: 'Solo',
    $variant: 'info',
  },
};

export const ButtonGroupExample: ButtonStory = {
  render: () => (
    <ButtonGroup>
      <Button $variant="outline">Mute</Button>
      <Button $variant="outline">Solo</Button>
    </ButtonGroup>
  ),
};

// Header stories
export const HeaderExample: ButtonStory = {
  render: () => (
    <div style={{ width: '200px', background: '#f5f5f5' }}>
      <Header>
        <span>Vocals</span>
        <Button $variant="danger" style={{ padding: '0.1rem 0.2rem' }}>
          <TrashIcon />
        </Button>
      </Header>
    </div>
  ),
};

// Controls wrapper stories
export const ControlsExample: ButtonStory = {
  render: () => (
    <div style={{ width: '200px', height: '150px' }}>
      <Controls>
        <Header>
          <span>Vocals</span>
        </Header>
        <ButtonGroup>
          <Button $variant="outline">Mute</Button>
          <Button $variant="outline">Solo</Button>
        </ButtonGroup>
        <SliderWrapper>
          <VolumeDownIcon />
          <Slider type="range" min={0} max={1} step={0.01} defaultValue={1} />
          <VolumeUpIcon />
        </SliderWrapper>
      </Controls>
    </div>
  ),
};

// Slider stories
export const SliderDefault: ButtonStory = {
  render: () => (
    <SliderWrapper style={{ width: '200px' }}>
      <VolumeDownIcon />
      <Slider type="range" min={0} max={1} step={0.01} defaultValue={1} />
      <VolumeUpIcon />
    </SliderWrapper>
  ),
};

// Icon stories
export const Icons: ButtonStory = {
  render: () => (
    <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
      <VolumeDownIcon />
      <VolumeUpIcon />
      <TrashIcon />
    </div>
  ),
};
