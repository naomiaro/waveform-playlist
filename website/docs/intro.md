---
sidebar_position: 1
slug: /
---

# Introduction

Waveform Playlist is a multitrack Web Audio editor and player with canvas waveform visualization. Built with React and [Tone.js](https://tonejs.github.io/), it provides a complete solution for audio editing in the browser.

## Features

- **Multi-track editing** - Load, arrange, and mix multiple audio tracks
- **Waveform visualization** - High-performance canvas rendering with zoom support
- **Playback controls** - Play, pause, stop, seek, and loop
- **Track controls** - Mute, solo, volume, and pan per track
- **Audio effects** - Comprehensive effect library powered by Tone.js
- **Annotations** - Time-synchronized text annotations with drag-to-edit
- **Recording** - Record directly from microphone with level monitoring
- **Theming** - Light and dark themes with full customization
- **BBC Peaks support** - Pre-computed waveform data for large files

## Packages

The library is organized into focused packages:

| Package | Description |
|---------|-------------|
| `@waveform-playlist/browser` | Main React components and hooks |
| `@waveform-playlist/core` | Core data types and utilities |
| `@waveform-playlist/playout` | Tone.js audio engine |
| `@waveform-playlist/ui-components` | Styled UI components |
| `@waveform-playlist/annotations` | Annotation system |
| `@waveform-playlist/recording` | Recording functionality |

## Quick Example

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  useAudioTracks,
} from '@waveform-playlist/browser';

function MyPlaylist() {
  const { tracks, loading, error } = useAudioTracks([
    { src: '/audio/vocals.mp3', name: 'Vocals' },
    { src: '/audio/guitar.mp3', name: 'Guitar' },
  ]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={128}
      timescale
    >
      <div>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </div>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

## Browser Support

Waveform Playlist works in all modern browsers that support:
- Web Audio API
- Canvas API
- ES2020+

## Next Steps

- [Installation](/docs/getting-started/installation) - Install the packages
- [Basic Usage](/docs/getting-started/basic-usage) - Build your first playlist
- [Examples](/examples) - See live demos
