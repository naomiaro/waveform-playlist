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
| Effects | Via Tone.js bridge (see [guide](/docs/react/guides/media-element-playout#tonejs-effects)) | 20 built-in Tone.js effects |

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
>
  <MediaElementWaveform />
</MediaElementPlaylistProvider>
```

The options that only affect how the view draws (row height, bar style, playhead width) are not provider props. Set them with [`<WaveformViewOptions>`](/docs/react/api/components#waveformviewoptions), which may sit above several providers:

```tsx
import {
  MediaElementPlaylistProvider,
  MediaElementWaveform,
  WaveformViewOptions,
} from '@waveform-playlist/browser';

<WaveformViewOptions waveHeight={100} barWidth={2} barGap={1}>
  <MediaElementPlaylistProvider track={episodeOne}>
    <MediaElementWaveform />
  </MediaElementPlaylistProvider>
  <MediaElementPlaylistProvider track={episodeTwo}>
    <MediaElementWaveform />
  </MediaElementPlaylistProvider>
</WaveformViewOptions>
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

`waveHeight`, `barWidth`, `barGap`, `roundedBars` and `progressBarWidth` are props of [`<WaveformViewOptions>`](/docs/react/api/components#waveformviewoptions), not of the provider. `waveHeight` is the height of one channel and is 80 px by default (it was 100 while it was a prop of this provider); the row is that times the number of channels, plus the clip header when the view has one. A leftover one on the provider is a compile error in TypeScript and is ignored in plain JavaScript (the defaults are drawn). See the [upgrade guide](/docs/react/upgrading#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers).

The time ruler is not a provider prop. It is a part of the view: `<MediaElementWaveform />` draws it, and a composition has it when it renders `<WaveformTimescale />` inside `<MediaElementWaveformRoot>`. There is no controls column for this player. See [Composing the View](/docs/react/guides/composing-the-view).

### Web Audio

#### `audioContext`

**Type:** `AudioContext`

When provided, audio routes through a Web Audio graph enabling fades and effects. Required for `fadeIn`/`fadeOut` on the track config and for bridging into Tone.js effects. Each provider instance should use its own `AudioContext` — `createMediaElementSource()` is called once per audio element.

### Playback

#### `playbackRate`

**Type:** `number`
**Default:** `1`

The playback rate. The bundled engine is created at this speed as given; the provider does not clamp the prop (its `setPlaybackRate` clamps to 0.5–2). The user can change the speed with `setPlaybackRate` from `usePlaybackRate()` (the `PlaybackRateSelect` control); a later change of this prop replaces their choice, for the audio and for the value `usePlaybackRate()` returns, until they choose again. A player that replaces another plays at the current speed, with two exceptions: a child that sets a speed in a `useLayoutEffect` in the same commit as a change of this prop (the new player gets the prop's speed; use `useEffect`), and a `setPlaybackRate` call made while the provider is inside a hidden `<Activity>` after this prop changed while hidden (on reveal the player gets the prop's speed). A player from a custom `createPlayout` is not created with the speed: the provider calls its `setPlaybackRate` with the current speed when it arrives. Changing the prop recreates the player.

#### `preservesPitch`

**Type:** `boolean`
**Default:** `true`

Whether to preserve pitch when changing playback rate. When `true`, the browser's built-in time-stretching keeps pitch constant while speed changes. Set to `false` when using an external pitch processor (e.g., SoundTouch AudioWorklet) that handles pitch compensation itself.

#### `automaticScroll`

**Type:** `boolean`
**Default:** `false`

Auto-scroll to keep the playhead centered during playback. While it is on, a drag on the waveform during playback does not select a range: the press and its release seek to where the press landed.

### Theming

#### `theme`

**Type:** `Partial<WaveformPlaylistTheme>`

Theme keys to change. The provider merges the object over `defaultTheme` (`{ ...defaultTheme, ...theme }`), so a key left out keeps its `defaultTheme` value; without the prop the theme is `defaultTheme`. It is a provider prop and not a view option: the transport controls, the checkboxes and the annotation list are drawn outside a view and read it too. See [Theming Guide](/docs/react/guides/theming).

### Annotations

#### `annotationList`

**Type:** `AnnotationListProp`: `{ annotations?: AnnotationData[]; editable?: boolean; linkEndpoints?: boolean; isContinuousPlay?: boolean }`

The annotations and the starting values of the three annotation options. The same prop on both providers.

- `annotations`: the annotations to show. `start` and `end` are numbers, in seconds.
- `editable`: annotations can be edited (text, ids, edges). Default `false`.
- `linkEndpoints`: a dragged edge takes the edge it touches along. Default `false`.
- `isContinuousPlay`: playback runs on past the end of an annotation. Default `false`.

The three options are provider state that follows the prop: each starts from its field, and when the value of a field changes, the option takes the new value. A field left out is `false`. Between two changes of the prop, a setter of `usePlaybackControls()` (`setAnnotationsEditable`, `setLinkEndpoints`, `setContinuousPlay`) or one of the checkboxes changes the option; the prop is not told. Read the options with `useAnnotationOptions()`.

The action buttons of the annotation list are not set here: pass them to `<AnnotationList actions>`.

#### `onAnnotationsChange`

**Type:** `(annotations: AnnotationData[]) => void`

Called with the full new array on every change to the annotations: the release of an edge drag, a text or id edit in the list, an action button, a `setAnnotations` call of your own. It is the one report of an annotation change. Keep the array in your state and pass it back in `annotationList.annotations`; without this callback an edit is dropped, and a development build warns.

### Callbacks

#### `onReady`

**Type:** `() => void`

Called when the media element has loaded its metadata: it knows its length and can be played and seeked. Called each time a player's media has loaded: once per player (the player is created again when the track or one of the player options changes), and again if your code calls `playoutRef.current.setSource()`. Not called for a source that cannot be loaded; see `onError`. Some browsers load metadata only when playback is asked for, so do not make Play wait for it. Pass a stable function: a new identity creates the player again.

#### `onError`

**Type:** `(error: Error) => void`

Called when the player could not be created (a missing optional peer, a throwing `createPlayout`, an error from the engine's `addTrack`) and when the media element reports an error (a source that cannot be loaded or decoded, or a network failure during playback, which also ends playback). The provider does not put the source URL in the message. The provider also logs a warning. Pass a stable function.

## Context Hooks

`MediaElementPlaylistProvider` publishes what it shares with `WaveformPlaylistProvider` through the same hooks, so a component written against them works under either provider. The interfaces are in the [hooks reference](/docs/react/api/hooks#core-context-hooks).

| Hook | Returns under this provider |
|------|-----------|
| `useIsPlaying()` | `isPlaying` |
| `useCurrentTime()` | `currentTime`: where the cursor rests. It does not advance during playback |
| `useSelection()` | `selectionStart`, `selectionEnd` |
| `useActiveAnnotation()` | `activeAnnotationId` |
| `useAnnotations()` | `annotations` |
| `useAnnotationOptions()` | `editable`, `linkEndpoints`, `continuousPlay` |
| `usePlaybackControls()` | `play`, `pause`, `stop`, `seekTo`, `setSelection`, `setTimeFormat`, `setAutomaticScroll`, `setScrollContainer`, `scrollContainerRef`, `setContinuousPlay`, `setAnnotationsEditable`, `setLinkEndpoints`, `setAnnotations`, `annotationPreview`, `setActiveAnnotationId`, `playAnnotation` |
| `usePlaybackRefs()` | `currentTimeRef`, `visualTimeRef` (the same ref as `currentTimeRef` here: a media element reports the audible position), `registerFrameCallback`, `unregisterFrameCallback` |
| `usePlaylistView()` | `sampleRate`; `mono` and `indefinitePlayback` are always `false`. The view options are not here: inside a root, `usePlaylistInfo()` from `@waveform-playlist/ui-components` has the resolved `waveHeight`, `barWidth`, `barGap`, `roundedBars` and `progressBarWidth` |
| `usePlaylistSettings()` | `timeFormat` (default `'hh:mm:ss.uuu'`), `isAutomaticScroll` |
| `usePlaylistZoom()` | `samplesPerPixel`; `canZoomIn` and `canZoomOut` are always `false` |

Two hooks exist under this provider only:

### usePlaybackRate

The playback speed and its setter.

```typescript
interface PlaybackRateContextValue {
  /** 0.5 to 2. */
  playbackRate: number;
  /** Clamped to 0.5–2. Stable identity. */
  setPlaybackRate: (rate: number) => void;
}
```

### useMediaElementTrack

The one track of the player.

```typescript
interface MediaElementTrackContextValue {
  /** The length of the track's audio, from its waveform data. Never 0 for a real track. */
  duration: number;
  /**
   * True once the media element has loaded its metadata, false again while a
   * replaced player loads. Use this, not `duration`, as "the player can be used".
   */
  isReady: boolean;
  /** One track with one clip (`[]` when the peak data could not be read). The clip carries the track's fadeIn / fadeOut. */
  peaksDataArray: TrackClipPeaks[];
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
  /** The player. `current` is null until it has been created. */
  playoutRef: React.RefObject<MediaElementPlayout | null>;
}
```

### Hooks that throw under this provider

`useEditorControls()`, `useEngineRefs()`, `usePlaylistTimeline()`, `usePlaylistMixer()`, `useTrackReorderPreview()`, `useLoop()`, `useSelectedTrackId()` and `useUndoRedo()` need `WaveformPlaylistProvider`. Under this provider they throw, also when it is nested inside a `WaveformPlaylistProvider`: every hook reads the nearest playlist provider. The message reads, for example, "useLoop needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it".

### Controls

The library's `PlayButton`, `PauseButton`, `StopButton`, `RewindButton`, `FastForwardButton`, `SkipBackwardButton`, `SkipForwardButton`, `ClearAllButton`, `AudioPosition`, `TimeFormatSelect`, `SelectionTimeInputs`, `AutomaticScrollCheckbox` and `AnnotationList` (which draws nothing without `<AnnotationProvider>`) work under this provider, and so do `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` and `DownloadAnnotationsButton` of `@waveform-playlist/annotations`. `PlaybackRateSelect` works under this provider only. `KeyboardShortcuts`, the loop and zoom buttons, `MasterVolumeControl` and `ExportWavButton` do not: there is no loop and no zoom here, and the library installs no keyboard shortcuts (`usePlaybackShortcuts()` throws here too; `useKeyboardShortcuts()` and `useAnnotationKeyboardControls()` can be called by your own component). See [Components](/docs/react/api/components#which-provider-each-control-needs).

`playoutRef.current.outputNode` returns the native `GainNode` output — use it to bridge into Tone.js effect chains (see [guide](/docs/react/guides/media-element-playout#tonejs-effects)).

## TypeScript

Full type definition:

```typescript
interface MediaElementPlaylistProviderProps {
  // Required
  track: MediaElementTrackConfig;
  children: React.ReactNode;

  // Display
  samplesPerPixel?: number;

  // Web Audio
  audioContext?: AudioContext;

  // Playback
  playbackRate?: number;
  preservesPitch?: boolean;
  automaticScroll?: boolean;

  // Theming
  theme?: Partial<WaveformPlaylistTheme>;

  // Annotations
  annotationList?: AnnotationListProp; // { annotations?, editable?, linkEndpoints?, isContinuousPlay? }

  // Callbacks
  onReady?: () => void;
  onError?: (error: Error) => void;
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;

  // Custom engine
  /** Supply a custom MediaElementPlayout — skips dynamic import of @waveform-playlist/media-element-playout.
   *  It must implement on() and emit 'loadedmetadata'. */
  createPlayout?: () => MediaElementPlayout;
}
```

## See Also

- [WaveformPlaylistProvider](/docs/react/api/providers/waveform-playlist-provider) - Multi-track provider with full editing support
