import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import {
  WaveformPlaylistProvider,
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  SkipBackwardButton,
  SkipForwardButton,
} from '@waveform-playlist/browser';

// A simple decorator that provides the WaveformPlaylistProvider context
// with an empty track list for UI demonstration
const WaveformProviderDecorator = (Story: React.FC) => {
  // Empty tracks - controls will be in their default/disabled state
  // This allows us to showcase the UI without loading audio files
  return (
    <WaveformPlaylistProvider tracks={[]} samplesPerPixel={1024}>
      <Story />
    </WaveformPlaylistProvider>
  );
};

const meta: Meta = {
  title: 'Browser/PlaybackControls',
  decorators: [WaveformProviderDecorator],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
Playback control buttons that work with the WaveformPlaylistProvider context.

These components automatically connect to the playlist state and handle:
- Play/Pause/Stop operations
- Seeking (Rewind, FastForward, Skip)
- Disabled states based on playback status

**Note:** These stories show the UI without audio - controls will be in their default states.
In a real app, use \`useAudioTracks\` to load audio files first.
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;

export const AllControls: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
      <PlayButton />
      <PauseButton />
      <StopButton />
      <RewindButton />
      <FastForwardButton />
      <SkipBackwardButton />
      <SkipForwardButton />
    </div>
  ),
};

export const PlayPauseStop: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <PlayButton />
      <PauseButton />
      <StopButton />
    </div>
  ),
};

export const NavigationControls: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <RewindButton />
      <SkipBackwardButton skipAmount={5} />
      <SkipForwardButton skipAmount={5} />
      <FastForwardButton />
    </div>
  ),
};

export const CustomSkipAmount: StoryObj = {
  render: () => (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
      <SkipBackwardButton skipAmount={10} />
      <span style={{ fontSize: '0.875rem', color: '#666' }}>10 second skip</span>
      <SkipForwardButton skipAmount={10} />
    </div>
  ),
};
