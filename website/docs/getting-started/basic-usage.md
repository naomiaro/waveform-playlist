---
sidebar_position: 2
---

# Basic Usage

This guide walks you through creating a simple multitrack audio player.

## Minimal Example

The simplest way to get started is with the `useAudioTracks` hook and the provider pattern:

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  useAudioTracks,
} from '@waveform-playlist/browser';

function App() {
  const { tracks, loading, error } = useAudioTracks([
    { src: '/audio/vocals.mp3', name: 'Vocals' },
    { src: '/audio/guitar.mp3', name: 'Guitar' },
  ]);

  if (loading) return <div>Loading audio...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={128}
      timescale
      controls={{ show: true, width: 200 }}
    >
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </div>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Understanding the Structure

### WaveformPlaylistProvider

The provider is the heart of the application. It manages:
- Audio playback state
- Track data and controls
- Zoom level and scroll position
- Selection and cursor position

```tsx
<WaveformPlaylistProvider
  tracks={tracks}           // Required: array of ClipTrack objects
  samplesPerPixel={1024}    // Zoom level (higher = more zoomed out)
  waveHeight={128}          // Height of each track in pixels
  timescale                 // Show time ruler at top
  controls={{ show: true, width: 200 }}  // Show track controls
>
  {/* Children have access to playlist context */}
</WaveformPlaylistProvider>
```

### Waveform Component

The `<Waveform />` component renders:
- Canvas waveform visualization for each track
- Track controls (mute, solo, volume, pan)
- Time ruler (if `timescale` is enabled)
- Playhead cursor

### Control Buttons

Pre-built button components connect to the playlist context:

```tsx
import {
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  ZoomInButton,
  ZoomOutButton,
} from '@waveform-playlist/browser';
```

## Loading Audio

The `useAudioTracks` hook handles loading and decoding audio files:

```tsx
const { tracks, loading, error, progress } = useAudioTracks([
  {
    src: '/audio/vocals.mp3',
    name: 'Vocals',
    // Optional: pre-computed waveform data (BBC Peaks)
    waveformDataUrl: '/audio/vocals.json',
  },
  {
    src: '/audio/guitar.mp3',
    name: 'Guitar',
    // Start this track 2 seconds into the timeline
    startTime: 2,
  },
]);

// Show loading progress
if (loading) {
  return <div>Loading... {Math.round(progress * 100)}%</div>;
}
```

## Adding Volume and Position Display

```tsx
import {
  MasterVolumeControl,
  AudioPosition,
} from '@waveform-playlist/browser';

function Controls() {
  return (
    <div>
      <PlayButton />
      <PauseButton />
      <StopButton />
      <MasterVolumeControl />
      <AudioPosition />
    </div>
  );
}
```

## Complete Example

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  AudioPosition,
  useAudioTracks,
} from '@waveform-playlist/browser';

function MyPlaylist() {
  const { tracks, loading, error } = useAudioTracks([
    { src: '/audio/drums.mp3', name: 'Drums' },
    { src: '/audio/bass.mp3', name: 'Bass' },
    { src: '/audio/keys.mp3', name: 'Keys' },
    { src: '/audio/vocals.mp3', name: 'Vocals' },
  ]);

  if (loading) return <div>Loading tracks...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      timescale
      controls={{ show: true, width: 180 }}
    >
      <div style={{ display: 'flex', gap: '0.5rem', padding: '1rem' }}>
        <RewindButton />
        <PlayButton />
        <PauseButton />
        <StopButton />
        <FastForwardButton />
        <ZoomInButton />
        <ZoomOutButton />
        <MasterVolumeControl />
        <AudioPosition />
      </div>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

export default MyPlaylist;
```

## Next Steps

- [Loading Audio](/docs/guides/loading-audio) - Advanced audio loading with BBC Peaks
- [Playback Controls](/docs/guides/playback-controls) - Detailed playback options
- [Track Management](/docs/guides/track-management) - Mute, solo, volume, pan
- [Theming](/docs/guides/theming) - Customize colors and appearance
