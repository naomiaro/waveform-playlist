import type { Meta, StoryObj } from '@storybook/react';
import React from 'react';
import type { ClipTrack } from '@waveform-playlist/core';
import {
  WaveformPlaylistProvider,
  Waveform,
  WaveformRoot,
  WaveformTrackControls,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  DefaultTrackControls,
  TrackName,
  TrackMuteButton,
  TrackSoloButton,
  TrackVolumeSlider,
  TrackReorderGrip,
  TrackRemoveButton,
  useTrack,
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
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import { useAudioTracks } from '@waveform-playlist/browser/tone';

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
    <WaveformPlaylistProvider tracks={createEmptyTracks(1)} samplesPerPixel={1024}>
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
    <WaveformPlaylistProvider tracks={createEmptyTracks(3)} samplesPerPixel={1024}>
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
    <WaveformPlaylistProvider tracks={createEmptyTracks(2)} samplesPerPixel={1024}>
      <div style={{ padding: '1rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
          <PlayButton />
          <PauseButton />
          <StopButton />
        </div>
        {/* No <WaveformTimescale />: a part is drawn because it is rendered. */}
        <WaveformRoot>
          <WaveformTrackControls />
          <WaveformTracks />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
      </div>
    </WaveformPlaylistProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The view composed without the timescale ruler: `<WaveformRoot>` with the track controls, the tracks, the selection and the playhead, and no `<WaveformTimescale />`. Useful for compact layouts. `<Waveform />` is the ready-made composition with the ruler.',
      },
    },
  },
};

export const Bare: Story = {
  render: () => (
    <WaveformPlaylistProvider tracks={createEmptyTracks(2)} samplesPerPixel={1024}>
      <div style={{ padding: '1rem' }}>
        {/* Only the tracks, the selection and the playhead: no ruler, no controls column. */}
        <WaveformRoot>
          <WaveformTracks />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
      </div>
    </WaveformPlaylistProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The bare view: `<WaveformRoot>` with the tracks, the selection and the playhead, and neither `<WaveformTimescale />` nor `<WaveformTrackControls />`. A part is drawn because it is rendered.',
      },
    },
  },
};

/** A control of the story's own: `useTrack()` is the track whose panel it is in. */
const TrackSummary: React.FC = () => {
  const { index, muted, volume } = useTrack();
  return (
    <small style={{ display: 'block', opacity: 0.7 }}>
      #{index + 1} · {muted ? 'muted' : `${Math.round(volume * 100)}%`}
    </small>
  );
};

const TracksThatCanBeRemoved: React.FC<{ children: (remove: (id: string) => void) => React.ReactNode }> = ({
  children,
}) => {
  const [tracks, setTracks] = React.useState(() => createEmptyTracks(3));
  const remove = React.useCallback(
    (trackId: string) => setTracks((current) => current.filter((track) => track.id !== trackId)),
    []
  );
  return (
    <WaveformPlaylistProvider tracks={tracks} onTracksChange={setTracks} samplesPerPixel={1024}>
      <div style={{ padding: '1rem' }}>{children(remove)}</div>
    </WaveformPlaylistProvider>
  );
};

export const TrackControlsWithRemoveAndReorder: Story = {
  render: () => (
    <TracksThatCanBeRemoved>
      {(remove) => (
        <WaveformRoot>
          {/* The children are the panel of ONE track; the part renders them once per track. */}
          <WaveformTrackControls>
            <DefaultTrackControls>
              <TrackSummary />
            </DefaultTrackControls>
            <TrackRemoveButton onRemove={remove} />
            <TrackReorderGrip />
          </WaveformTrackControls>
          <WaveformTracks />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
      )}
    </TracksThatCanBeRemoved>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'The default panel with one control of the story\'s own inside it (`useTrack()`), a remove button and a reorder grip beside it. A remove button and a grip are drawn by being rendered. The move buttons work here; dragging the grip needs a `ClipInteractionProvider` above the view.',
      },
    },
  },
};

export const TrackControlsFromPieces: Story = {
  render: () => (
    <WaveformPlaylistProvider tracks={createEmptyTracks(3)} samplesPerPixel={1024}>
      <div style={{ padding: '1rem' }}>
        <WaveformRoot>
          <WaveformTrackControls width={140}>
            <div style={{ height: '100%', padding: 6, boxSizing: 'border-box' }}>
              <TrackName />
              <div style={{ display: 'flex', justifyContent: 'center', gap: 4, margin: '4px 0' }}>
                <TrackMuteButton />
                <TrackSoloButton />
              </div>
              <TrackVolumeSlider />
            </div>
          </WaveformTrackControls>
          <WaveformTracks />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
      </div>
    </WaveformPlaylistProvider>
  ),
  parameters: {
    docs: {
      description: {
        story:
          'A panel composed from the pieces, in a 140 px column: name, mute, solo and volume, and no pan slider. Each piece is bound to the track it is drawn for. The slot is as wide as the column and as tall as the row; the panel fills it with `height: 100%`.',
      },
    },
  },
};

export const CustomTrackNames: Story = {
  render: () => {
    const tracks: ClipTrack[] = [
      {
        id: 'vocals',
        name: 'Lead Vocals',
        clips: [],
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
      },
      {
        id: 'guitar',
        name: 'Electric Guitar',
        clips: [],
        muted: false,
        soloed: false,
        volume: 1,
        pan: 0,
      },
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
