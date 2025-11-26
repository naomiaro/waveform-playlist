import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import type { ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  AudioPosition,
} from '@waveform-playlist/browser';

const meta: Meta<typeof Waveform> = {
  title: 'Browser/Waveform',
  component: Waveform,
  parameters: {
    layout: 'fullscreen',
    docs: {
      description: {
        component: `
The Waveform component provides the main visualization and interaction surface for audio tracks.

**Features:**
- Multi-track waveform display
- Track controls (mute, solo, volume, pan)
- Click-to-seek and selection
- Playhead visualization
- Timescale display

**Note:** These stories show the Waveform component with empty tracks.
To display actual waveforms, use the \`useAudioTracks\` hook to load real audio files.

\`\`\`tsx
import { useAudioTracks, WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';

function MyPlaylist() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/track1.mp3', name: 'Vocals' },
    { src: '/audio/track2.mp3', name: 'Guitar' },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1024}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
\`\`\`
        `,
      },
    },
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Waveform>;

// Create empty tracks for demonstration
const createEmptyTracks = (count: number): ClipTrack[] => {
  return Array.from({ length: count }, (_, i) => ({
    id: `track-${i + 1}`,
    name: `Track ${i + 1}`,
    clips: [],
    muted: false,
    soloed: false,
    volume: 1,
    pan: 0,
  }));
};

export const EmptyPlaylist: Story = {
  render: () => (
    <WaveformPlaylistProvider
      tracks={createEmptyTracks(1)}
      samplesPerPixel={1024}
    >
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <PlayButton />
          <PauseButton />
          <StopButton />
          <AudioPosition />
        </div>
        <Waveform />
      </div>
    </WaveformPlaylistProvider>
  ),
  parameters: {
    docs: {
      description: {
        story: 'An empty playlist with one track, ready for recording or loading audio.',
      },
    },
  },
};

export const MultipleEmptyTracks: Story = {
  render: () => (
    <WaveformPlaylistProvider
      tracks={createEmptyTracks(3)}
      samplesPerPixel={1024}
    >
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <PlayButton />
          <PauseButton />
          <StopButton />
          <AudioPosition />
        </div>
        <Waveform />
      </div>
    </WaveformPlaylistProvider>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Multiple empty tracks showing the track controls layout.',
      },
    },
  },
};

export const WithoutTimescale: Story = {
  render: () => (
    <WaveformPlaylistProvider
      tracks={createEmptyTracks(2)}
      samplesPerPixel={1024}
      // Note: timescale is not set, so no timescale will be displayed
    >
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <PlayButton />
          <PauseButton />
          <StopButton />
        </div>
        <Waveform />
      </div>
    </WaveformPlaylistProvider>
  ),
  parameters: {
    docs: {
      description: {
        story: 'Waveform without the timescale ruler - controlled via the `timescale` prop on WaveformPlaylistProvider. Useful for compact layouts.',
      },
    },
  },
};

export const CustomTrackNames: Story = {
  render: () => {
    const tracks: ClipTrack[] = [
      { id: 'vocals', name: 'Lead Vocals', clips: [], muted: false, soloed: false, volume: 1, pan: 0 },
      { id: 'guitar', name: 'Electric Guitar', clips: [], muted: false, soloed: false, volume: 1, pan: 0 },
      { id: 'bass', name: 'Bass', clips: [], muted: false, soloed: false, volume: 1, pan: 0 },
      { id: 'drums', name: 'Drums', clips: [], muted: false, soloed: false, volume: 1, pan: 0 },
    ];

    return (
      <WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1024}>
        <div style={{ padding: '1rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <PlayButton />
            <PauseButton />
            <StopButton />
            <AudioPosition />
          </div>
          <Waveform />
        </div>
      </WaveformPlaylistProvider>
    );
  },
  parameters: {
    docs: {
      description: {
        story: 'Tracks with custom names showing a typical multitrack recording setup.',
      },
    },
  },
};
