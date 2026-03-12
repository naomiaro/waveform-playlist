---
sidebar_position: 2
description: "MediaElementPlaylistProvider API — single-track HTMLAudioElement provider with pitch-preserving playback rate"
---

# MediaElementPlaylistProvider

A simplified playlist provider for single-track playback using `HTMLAudioElement`. Ideal for language learning apps, podcast players, and single-track audio viewers.

## Key Differences from WaveformPlaylistProvider

| Feature | MediaElementPlaylistProvider | WaveformPlaylistProvider |
|---------|------------------------------|--------------------------|
| Instances | Multiple per page | **Single instance only** (shared Tone.js Transport) |
| Tracks | Single track (`track` prop) | Multiple tracks (`tracks` prop) |
| Audio engine | HTMLAudioElement | Tone.js / Web Audio API |
| Waveform data | Pre-computed (`WaveformDataObject`) | Decoded from AudioBuffer |
| Playback rate | Pitch-preserving (0.5x - 2.0x) | Not built-in |
| Editing | View only | Drag, trim, split |
| Effects | Via Tone.js bridge (see [guide](/docs/guides/media-element-playout#tonejs-effects)) | 20 built-in Tone.js effects |

## Import

```tsx
import { MediaElementPlaylistProvider } from '@waveform-playlist/browser';
```

## Basic Usage

```tsx
import { MediaElementPlaylistProvider, MediaElementWaveform } from '@waveform-playlist/browser';

<MediaElementPlaylistProvider
  track={{
    source: '/audio/episode.mp3',
    waveformData: waveformDataJson,
    name: 'Episode 1',
  }}
  samplesPerPixel={1024}
  waveHeight={100}
  timescale
>
  <MediaElementWaveform />
</MediaElementPlaylistProvider>
```

## Props

### Required Props

#### `track`

**Type:** `MediaElementTrackConfig`

Single track configuration object.

```typescript
interface MediaElementTrackConfig {
  /** Audio source URL or Blob URL */
  source: string;
  /** Pre-computed waveform data (required for visualization) */
  waveformData: WaveformDataObject;
  /** Track name for display */
  name?: string;
  /** Fade in configuration (requires audioContext on provider) */
  fadeIn?: FadeConfig;
  /** Fade out configuration (requires audioContext on provider) */
  fadeOut?: FadeConfig;
}

interface FadeConfig {
  /** Duration of the fade in seconds */
  duration: number;
  /** Type of fade curve (default: 'linear') */
  type?: 'linear' | 'logarithmic' | 'exponential' | 'sCurve';
}
```

### Display Props

#### `samplesPerPixel`

**Type:** `number`
**Default:** `1024`

Zoom level for waveform rendering.

#### `waveHeight`

**Type:** `number`
**Default:** `100`

Height of the waveform track in pixels.

#### `timescale`

**Type:** `boolean`
**Default:** `false`

Show the time ruler at the top of the playlist.

#### `controls`

**Type:** `{ show: boolean; width: number }`
**Default:** `{ show: false, width: 0 }`

Track controls panel configuration.

### Web Audio

#### `audioContext`

**Type:** `AudioContext`

When provided, audio routes through a Web Audio graph enabling fades and effects. Required for `fadeIn`/`fadeOut` on the track config and for bridging into Tone.js effects. Each provider instance should use its own `AudioContext` — `createMediaElementSource()` is called once per audio element.

### Playback

#### `playbackRate`

**Type:** `number`
**Default:** `1`

Initial playback rate. Range: 0.5 to 2.0. Pitch is preserved automatically by the HTMLAudioElement.

#### `automaticScroll`

**Type:** `boolean`
**Default:** `false`

Auto-scroll to keep the playhead centered during playback.

### Theming

#### `theme`

**Type:** `Partial<WaveformPlaylistTheme>`
**Default:** `defaultTheme`

Custom theme object. See [Theming Guide](/docs/guides/theming).

### Annotations

#### `annotationList`

**Type:** `{ annotations?: any[]; isContinuousPlay?: boolean }`

Annotation configuration. When using editable annotations, pair with `onAnnotationsChange`.

#### `onAnnotationsChange`

**Type:** `(annotations: AnnotationData[]) => void`

Callback when annotations change. Required for edits to persist.

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

### Callbacks

#### `onReady`

**Type:** `() => void`

Called when the audio track is ready for playback.

## Context Hooks

### useMediaElementAnimation

High-frequency animation state for smooth playhead updates.

```typescript
interface MediaElementAnimationContextValue {
  isPlaying: boolean;
  currentTime: number;
  currentTimeRef: React.RefObject<number>;
}
```

### useMediaElementState

Playlist state values.

```typescript
interface MediaElementStateContextValue {
  continuousPlay: boolean;
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  playbackRate: number;
  isAutomaticScroll: boolean;
}
```

### useMediaElementControls

Playback and annotation controls.

```typescript
interface MediaElementControlsContextValue {
  play: (startTime?: number) => void;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setPlaybackRate: (rate: number) => void;
  setContinuousPlay: (enabled: boolean) => void;
  setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>>;
  setActiveAnnotationId: (id: string | null) => void;
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}
```

### useMediaElementData

Playlist data for rendering.

```typescript
interface MediaElementDataContextValue {
  duration: number;
  peaksDataArray: TrackClipPeaks[];
  sampleRate: number;
  waveHeight: number;
  timeScaleHeight: number;
  samplesPerPixel: number;
  playoutRef: React.RefObject<MediaElementPlayout | null>;
  controls: { show: boolean; width: number };
  barWidth: number;
  barGap: number;
  progressBarWidth: number;
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
}
```

`playoutRef.current.outputNode` returns the native `GainNode` output — use it to bridge into Tone.js effect chains (see [guide](/docs/guides/media-element-playout#tonejs-effects)).

## TypeScript

Full type definition:

```typescript
interface MediaElementPlaylistProviderProps {
  // Required
  track: MediaElementTrackConfig;
  children: React.ReactNode;

  // Display
  samplesPerPixel?: number;
  waveHeight?: number;
  timescale?: boolean;
  controls?: { show: boolean; width: number };

  // Web Audio
  audioContext?: AudioContext;

  // Playback
  playbackRate?: number;
  automaticScroll?: boolean;

  // Theming
  theme?: Partial<WaveformPlaylistTheme>;

  // Annotations
  annotationList?: {
    annotations?: any[];
    isContinuousPlay?: boolean;
  };

  // Callbacks
  onReady?: () => void;
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;

  // Waveform rendering
  barWidth?: number;
  barGap?: number;
  progressBarWidth?: number;
}
```

## See Also

- [WaveformPlaylistProvider](/docs/api/providers/waveform-playlist-provider) - Multi-track provider with full editing support
