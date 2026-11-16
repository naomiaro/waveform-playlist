---
sidebar_position: 2
description: "Basic usage guide for creating a multitrack audio player with WaveformPlaylistProvider and React"
---

# Basic Usage

This guide walks you through creating a simple multitrack audio player.

## Minimal Example

The simplest way to get started is an arrangement that names the audio files, and the provider that plays it:

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  WaveformViewOptions,
  PlayButton,
  PauseButton,
  StopButton,
  useCreateArrangement,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

function App() {
  // One arrangement for the life of the component: it owns the tracks and loads their audio
  const arrangement = useCreateArrangement(() => [
    audioTrack({ src: '/audio/vocals.mp3', name: 'Vocals' }),
    audioTrack({ src: '/audio/guitar.mp3', name: 'Guitar' }),
  ]);

  return (
    <WaveformPlaylistProvider arrangement={arrangement} samplesPerPixel={1024}>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </div>
      <WaveformViewOptions waveHeight={128}>
        <Waveform />
      </WaveformViewOptions>
    </WaveformPlaylistProvider>
  );
}
```

## Understanding the Structure

### WaveformPlaylistProvider

The provider is the heart of the application. It manages:
- Audio playback state
- Zoom level and scroll position
- Selection and cursor position

The tracks, their mix (mute, solo, volume, pan) and the undo history belong to the arrangement. The provider plays and draws the arrangement and follows its changes.

```tsx
<WaveformPlaylistProvider
  arrangement={arrangement} // Required: from useCreateArrangement
  samplesPerPixel={1024}    // Zoom level (higher = more zoomed out)
>
  {/* Children have access to playlist context */}
</WaveformPlaylistProvider>
```

Keep one arrangement for the life of the playlist: a new `arrangement` object mounts everything below the provider again.

### WaveformViewOptions

The options that only affect how the view draws are set with `<WaveformViewOptions>`, not on the provider. It applies to every view below it and may sit above or below the provider:

```tsx
<WaveformViewOptions
  waveHeight={128}   // Height of one channel of a track in pixels (default 80)
  barWidth={2}       // Width of a waveform bar in pixels (default 1)
  barGap={1}         // Space between two bars in pixels (default 0)
>
  <Waveform />
</WaveformViewOptions>
```

See [WaveformViewOptions](/docs/react/api/components#waveformviewoptions) for every option.

### Waveform Component

The `<Waveform />` component renders:
- Canvas waveform visualization for each track
- Track controls (mute, solo, volume, pan), in a 200 px column
- Time ruler
- Playhead cursor

`<Waveform />` is a ready-made composition of the view's parts. To leave the time ruler or the track controls out, change the width of the controls column, show clip headers or add your own element, compose the parts yourself: see [Composing the View](/docs/react/guides/composing-the-view).

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

The arrangement fetches and decodes the files its tracks name, once the provider has its audio context. The playlist is drawn at once; each clip appears when its file has decoded (or at once as a placeholder when you give its `duration`), and Play starts working when the first files have settled:

```tsx
import { useArrangement, useArrangementSources } from '@waveform-playlist/browser';

const arrangement = useCreateArrangement(() => [
  audioTrack({ src: '/audio/vocals.mp3', name: 'Vocals' }),
  // Start this track 2 seconds into the timeline; with a duration it is drawn before it loads
  audioTrack({ src: '/audio/guitar.mp3', name: 'Guitar', start: 2, duration: 30 }),
]);

// Inside the provider: show loading progress
function LoadingStatus() {
  const { pendingCount, failedCount } = useArrangementSources(useArrangement());
  if (pendingCount > 0) return <div>Loading {pendingCount} file(s)…</div>;
  if (failedCount > 0) return <div>{failedCount} file(s) could not be loaded</div>;
  return null;
}
```

See [Loading Audio](/docs/react/guides/loading-audio) for pre-computed peaks, dropped files, errors and `retry`.

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
  WaveformViewOptions,
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  AudioPosition,
  useCreateArrangement,
} from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

function MyPlaylist() {
  const arrangement = useCreateArrangement(() => [
    audioTrack({ src: '/audio/drums.mp3', name: 'Drums' }),
    audioTrack({ src: '/audio/bass.mp3', name: 'Bass' }),
    audioTrack({ src: '/audio/keys.mp3', name: 'Keys' }),
    audioTrack({ src: '/audio/vocals.mp3', name: 'Vocals' }),
  ]);

  return (
    <WaveformPlaylistProvider arrangement={arrangement} samplesPerPixel={1024}>
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
      <WaveformViewOptions waveHeight={100}>
        <Waveform />
      </WaveformViewOptions>
    </WaveformPlaylistProvider>
  );
}

export default MyPlaylist;
```

## Next Steps

- [Composing the View](/docs/react/guides/composing-the-view) - Choose what the waveform view draws
- [Loading Audio](/docs/react/guides/loading-audio) - Advanced audio loading with BBC Peaks
- [Playback Controls](/docs/react/guides/playback-controls) - Detailed playback options
- [Track Management](/docs/react/guides/track-management) - Mute, solo, volume, pan
- [Theming](/docs/react/guides/theming) - Customize colors and appearance
