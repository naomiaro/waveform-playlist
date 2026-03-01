---
sidebar_position: 1
description: "WaveformPlaylistProvider API — the root React context provider for multitrack Web Audio editing"
---

# WaveformPlaylistProvider

The `WaveformPlaylistProvider` is the core component that manages all playlist state and provides context to child components. It uses the Web Audio API (via Tone.js) for multi-track playback, mixing, and effects processing.

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

### Audio Effects

#### `effects`

**Type:** `EffectsFunction`

Master effects chain function from `useDynamicEffects()`.

### Annotations

#### `annotationList`

**Type:** `{ annotations?: any[]; editable?: boolean; isContinuousPlay?: boolean; linkEndpoints?: boolean; controls?: any[] }`

Annotation configuration. When using editable annotations, pair with `onAnnotationsChange`.

#### `onAnnotationsChange`

**Type:** `(annotations: AnnotationData[]) => void`

Callback when annotations change. Required for editable annotations to persist.

### Callbacks

#### `onTracksChange`

**Type:** `(tracks: ClipTrack[]) => void`

Called when engine clip operations (move, trim, split) update the tracks. Use this to keep your parent state in sync with engine mutations:

```tsx
const [tracks, setTracks] = useState<ClipTrack[]>(initialTracks);

<WaveformPlaylistProvider tracks={tracks} onTracksChange={setTracks}>
```

#### `onReady`

**Type:** `() => void`

Called when all tracks finish loading.

### Waveform Rendering

#### `barWidth`

**Type:** `number`
**Default:** `1`

Width in pixels of waveform bars.

#### `barGap`

**Type:** `number`
**Default:** `0`

Spacing in pixels between waveform bars.

#### `progressBarWidth`

**Type:** `number`
**Default:** `barWidth + barGap`

Width in pixels of progress bars.

#### `mono`

**Type:** `boolean`
**Default:** `false`

Render mono waveforms.

#### `zoomLevels`

**Type:** `number[]`

Array of zoom levels in samples per pixel.

#### `automaticScroll`

**Type:** `boolean`
**Default:** `false`

Auto-scroll to keep playhead visible.

## Context Values

The provider exposes state and controls through React Context. Access them using the provided hooks.

### Playback Animation (usePlaybackAnimation)

```typescript
interface PlaybackAnimationContextValue {
  isPlaying: boolean;
  currentTime: number;
  currentTimeRef: RefObject<number>;
  playbackStartTimeRef: RefObject<number>;
  audioStartPositionRef: RefObject<number>;
}
```

### State (usePlaylistState)

```typescript
interface PlaylistStateContextValue {
  continuousPlay: boolean;
  linkEndpoints: boolean;
  annotationsEditable: boolean;
  isAutomaticScroll: boolean;
  isLoopEnabled: boolean;
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  selectionStart: number;
  selectionEnd: number;
  selectedTrackId: string | null;
  loopStart: number;
  loopEnd: number;
}
```

### Controls (usePlaylistControls)

```typescript
interface PlaylistControlsContextValue {
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setCurrentTime: (time: number) => void;
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, soloed: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackPan: (trackIndex: number, pan: number) => void;
  setSelection: (start: number, end: number) => void;
  setSelectedTrackId: (trackId: string | null) => void;
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (seconds: number) => string;
  zoomIn: () => void;
  zoomOut: () => void;
  setMasterVolume: (volume: number) => void;
  setAutomaticScroll: (enabled: boolean) => void;
  setContinuousPlay: (enabled: boolean) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setLoopRegionFromSelection: () => void;
  clearLoopRegion: () => void;
}
```

### Data (usePlaylistData)

```typescript
interface PlaylistDataContextValue {
  duration: number;
  audioBuffers: AudioBuffer[];
  peaksDataArray: TrackClipPeaks[];
  trackStates: TrackState[];
  tracks: ClipTrack[];
  sampleRate: number;
  waveHeight: number;
  samplesPerPixel: number;
  timeFormat: TimeFormat;
  masterVolume: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  isReady: boolean;
  mono: boolean;
  playoutRef: RefObject<PlaylistEngine | null>;  // from @waveform-playlist/engine
  isDraggingRef: MutableRefObject<boolean>;       // true during boundary trim drags
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
  mono?: boolean;
  zoomLevels?: number[];
  automaticScroll?: boolean;
  controls?: { show: boolean; width: number };

  // Theming
  theme?: Partial<WaveformPlaylistTheme>;

  // Audio
  effects?: EffectsFunction;

  // Annotations
  annotationList?: {
    annotations?: any[];
    editable?: boolean;
    isContinuousPlay?: boolean;
    linkEndpoints?: boolean;
    controls?: any[];
  };

  // Callbacks
  onReady?: () => void;
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  /** Called when engine clip operations (move/trim/split) update tracks */
  onTracksChange?: (tracks: ClipTrack[]) => void;

  // Waveform rendering
  barWidth?: number;
  barGap?: number;
  progressBarWidth?: number;
}
```

## See Also

- [Waveform Component](/docs/api/components#waveform)
- [usePlaylistState Hook](/docs/api/hooks#useplayliststate)
- [usePlaylistControls Hook](/docs/api/hooks#useplaylistcontrols)
