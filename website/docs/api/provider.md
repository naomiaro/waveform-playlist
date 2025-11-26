---
sidebar_position: 1
---

# WaveformPlaylistProvider

The `WaveformPlaylistProvider` is the core component that manages all playlist state and provides context to child components.

## Import

```tsx
import { WaveformPlaylistProvider } from '@waveform-playlist/browser';
```

## Basic Usage

```tsx
<WaveformPlaylistProvider
  tracks={tracks}
  samplesPerPixel={1024}
  waveHeight={128}
  timescale
>
  <Waveform />
</WaveformPlaylistProvider>
```

## Props

### Required Props

#### `tracks`

**Type:** `ClipTrack[]`

Array of track objects to display. Use `useAudioTracks` to create tracks from audio files.

```tsx
const { tracks, loading } = useAudioTracks([
  { src: '/audio/track.mp3', name: 'Track' },
]);

<WaveformPlaylistProvider tracks={tracks}>
```

### Display Props

#### `samplesPerPixel`

**Type:** `number`
**Default:** `1024`

Zoom level. Higher values show more audio, lower values show more detail.

| Value | Use Case |
|-------|----------|
| 256 | Detailed editing |
| 512 | Close view |
| 1024 | Default view |
| 2048 | Overview |
| 4096+ | Long files |

#### `waveHeight`

**Type:** `number`
**Default:** `128`

Height of each track in pixels.

#### `timescale`

**Type:** `boolean`
**Default:** `false`

Show the time ruler at the top of the playlist.

```tsx
<WaveformPlaylistProvider tracks={tracks} timescale>
```

#### `controls`

**Type:** `{ show: boolean; width: number }`
**Default:** `{ show: false, width: 200 }`

Track controls panel configuration.

```tsx
<WaveformPlaylistProvider
  tracks={tracks}
  controls={{ show: true, width: 180 }}
>
```

### Theming

#### `theme`

**Type:** `Partial<WaveformPlaylistTheme>`
**Default:** `defaultTheme`

Custom theme object. See [Theming Guide](/docs/guides/theming).

```tsx
<WaveformPlaylistProvider
  tracks={tracks}
  theme={{
    waveColor: '#00ff00',
    cursorColor: '#ff0000',
  }}
>
```

### Audio Configuration

#### `sampleRate`

**Type:** `number`
**Default:** `44100`

Audio sample rate. Should match your audio files.

### Initial State

#### `cursorPosition`

**Type:** `number`
**Default:** `0`

Initial cursor position in seconds.

#### `selection`

**Type:** `{ start: number; end: number }`
**Default:** `{ start: 0, end: 0 }`

Initial selection range.

#### `isContinuousPlay`

**Type:** `boolean`
**Default:** `false`

Enable looping playback.

#### `isAutomaticScroll`

**Type:** `boolean`
**Default:** `true`

Auto-scroll to keep playhead visible.

## Context Values

The provider exposes state and controls through React Context. Access them using the provided hooks.

### State (usePlaylistState)

```typescript
interface PlaylistState {
  // Tracks
  tracks: ClipTrack[];
  selectedTrackIndex: number | null;
  selectedClipIndex: number | null;

  // Playback
  isPlaying: boolean;
  isPaused: boolean;
  cursorPosition: number;
  duration: number;

  // Selection
  selection: { start: number; end: number };

  // Display
  samplesPerPixel: number;
  waveHeight: number;
  sampleRate: number;

  // Settings
  isContinuousPlay: boolean;
  isAutomaticScroll: boolean;
  masterVolume: number;
  timeFormat: string;
}
```

### Controls (usePlaylistControls)

```typescript
interface PlaylistControls {
  // Playback
  play: (start?: number, end?: number) => void;
  pause: () => void;
  stop: () => void;
  seek: (position: number) => void;

  // Zoom
  zoomIn: () => void;
  zoomOut: () => void;
  setSamplesPerPixel: (spp: number) => void;

  // Tracks
  addTrack: (track: ClipTrack) => void;
  removeTrack: (index: number) => void;
  moveTrack: (fromIndex: number, toIndex: number) => void;
  selectTrack: (index: number | null) => void;

  // Settings
  setIsContinuousPlay: (value: boolean) => void;
  setIsAutomaticScroll: (value: boolean) => void;
  setMasterVolume: (value: number) => void;
  setTimeFormat: (format: string) => void;
}
```

## Example: Custom Wrapper

Create a custom wrapper with your application's defaults:

```tsx
import { WaveformPlaylistProvider, WaveformPlaylistProviderProps } from '@waveform-playlist/browser';

interface MyPlaylistProps extends Partial<WaveformPlaylistProviderProps> {
  tracks: ClipTrack[];
  children: React.ReactNode;
}

function MyPlaylistProvider({ tracks, children, ...props }: MyPlaylistProps) {
  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      timescale
      controls={{ show: true, width: 180 }}
      theme={myTheme}
      {...props}
    >
      {children}
    </WaveformPlaylistProvider>
  );
}
```

## TypeScript

Full type definition:

```typescript
interface WaveformPlaylistProviderProps {
  // Required
  tracks: ClipTrack[];
  children: React.ReactNode;

  // Display
  samplesPerPixel?: number;
  waveHeight?: number;
  timescale?: boolean;
  controls?: {
    show: boolean;
    width: number;
  };

  // Theming
  theme?: Partial<WaveformPlaylistTheme>;

  // Audio
  sampleRate?: number;

  // Initial state
  cursorPosition?: number;
  selection?: { start: number; end: number };
  isContinuousPlay?: boolean;
  isAutomaticScroll?: boolean;
}
```

## See Also

- [Waveform Component](/docs/api/components#waveform)
- [usePlaylistState Hook](/docs/api/hooks#useplayliststate)
- [usePlaylistControls Hook](/docs/api/hooks#useplaylistcontrols)
