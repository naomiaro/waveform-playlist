---
sidebar_position: 1
description: "WaveformPlaylistProvider API — the root React context provider for multitrack Web Audio editing"
---

# WaveformPlaylistProvider

The `WaveformPlaylistProvider` is the core component that manages all playlist state and provides context to child components. It uses the Web Audio API (via Tone.js) for multi-track playback, mixing, and effects processing.

:::caution Single Instance Per Page
Only one `WaveformPlaylistProvider` should be mounted at a time. It uses a shared Tone.js Transport singleton for scheduling — multiple instances will conflict with each other's playback, timing, and effects. For multiple independent players on the same page, use [`MediaElementPlaylistProvider`](/docs/react/api/providers/media-element-playlist-provider) which creates independent `HTMLAudioElement` instances.
:::

## Import

```tsx
import { WaveformPlaylistProvider } from '@waveform-playlist/browser';
```

## Basic Usage

```tsx
<WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1024}>
  <Waveform />
</WaveformPlaylistProvider>
```

The options that only affect how a view draws (row height, bar style, playhead width, the filled layout) are not provider props. Set them with [`<WaveformViewOptions>`](/docs/react/api/components#waveformviewoptions), above or below the provider:

```tsx
import { WaveformPlaylistProvider, Waveform, WaveformViewOptions } from '@waveform-playlist/browser';

<WaveformViewOptions waveHeight={128} barWidth={2} barGap={1}>
  <WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1024}>
    <Waveform />
  </WaveformPlaylistProvider>
</WaveformViewOptions>
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

`waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth` and `fillViewport` are props of [`<WaveformViewOptions>`](/docs/react/api/components#waveformviewoptions), not of the provider. A leftover one on the provider is a compile error in TypeScript and is ignored in plain JavaScript (the defaults are drawn). See the [upgrade guide](/docs/react/upgrading#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers).

The time ruler and the column of track controls are not provider props. They are parts of the view: `<Waveform />` draws both (the column 200 px wide), and a composition has them when it renders `<WaveformTimescale />` and `<WaveformTrackControls width={180} />`. See [Composing the View](/docs/react/guides/composing-the-view).

### Theming

#### `theme`

**Type:** `Partial<WaveformPlaylistTheme>`

Theme keys to change. The provider merges the object over `defaultTheme` (`{ ...defaultTheme, ...theme }`), so a key left out keeps its `defaultTheme` value; without the prop the theme is `defaultTheme`. See [Theming Guide](/docs/react/guides/theming).

```tsx
<WaveformPlaylistProvider
  tracks={tracks}
  theme={{
    waveFillColor: '#00ff00',
    playheadColor: '#ff0000',
  }}
>
```

The theme is a provider prop and not a view option: the transport controls, the checkboxes and the annotation list are drawn outside a view and read it too.

### Audio Effects

#### `effects`

**Type:** `EffectsFunction`

Master effects chain function from `useDynamicEffects()`.

#### `trackEffects`

**Type:** `(trackId: string) => TrackEffectsFunction | undefined`

Returns the effects function of a track, looked up by track id. Pass `getTrackEffectsFunction` from `useTrackDynamicEffects()`:

```tsx
const trackFx = useTrackDynamicEffects();

<WaveformPlaylistProvider tracks={tracks} trackEffects={trackFx.getTrackEffectsFunction}>
```

Tracks are plain data and have no `effects` field; pass `tracks` as they are. The provider calls the function when it builds a track's audio graph, using the function from the latest render, so a new function identity (an inline arrow) rebuilds nothing. If it returns a different effects function for a track that is already built, that takes effect the next time the track is built.

Like `effects`, this prop is used by the default Tone.js adapter only. With `createAdapter`, pass the same function to your own `createToneAdapter({ trackEffects })`.

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

Called with the full new array on every change to the annotations: the release of an edge drag, a text or id edit in the list, an action button, a `setAnnotations` call of your own (the annotation shortcuts of `<KeyboardShortcuts annotations />` go through `setAnnotations` too). It is the one report of an annotation change. Keep the array in your state and pass it back in `annotationList.annotations`; without this callback an edit is dropped, and a development build warns.

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

#### `onError`

**Type:** `(err: Error) => void`

Called when audio or engine initialization fails, for example a missing optional peer, a `createAdapter` that throws, or an invalid `zoomLevels` / `samplesPerPixel`. The provider already logs the error; use this to show it in your UI.

### Other options

#### `mono`

**Type:** `boolean`
**Default:** `false`

Draw and analyse every track as one channel. It is a provider option and not a view option because the provider computes the peaks with it.

#### `zoomLevels`

**Type:** `number[]`

Array of zoom levels in samples per pixel.

#### `automaticScroll`

**Type:** `boolean`
**Default:** `false`

Auto-scroll to keep playhead visible. While it is on, a drag on the waveform during playback does not select a range: the press and its release seek to where the press landed.

#### `indefinitePlayback`

**Type:** `boolean`
**Default:** `false`

Disables the automatic stop at the end of the longest track: the transport rolls until an explicit stop or pause. The multitrack view then draws the timeline as wide as its container, as `<WaveformViewOptions fillViewport>` does. It is a provider option and not a view option because the provider's animation loop and `seekTo` follow it. Recording sessions suppress the automatic stop themselves, so most recording UIs do not need it.

:::note End-of-timeline behavior (matched with dawcore)
By default playback **auto-stops** at the end of the timeline and the cursor returns to the play-start position (player style). `indefinitePlayback` opts out — the transport rolls until an explicit `stop()`/`pause()` (DAW style; same semantics as `<daw-editor indefinite-playback>`). Active recording sessions suppress the auto-stop automatically so punch-in takes can run past the end of existing audio. Selection and annotation playback stop at their explicit ends regardless.
:::

#### `deferEngineRebuild`

**Type:** `boolean`
**Default:** `false`

When `true`, the provider skips rebuilding the audio engine when `tracks` change. Set this to the `loading` value from `useAudioTracks` when using `{ immediate: true }` mode — placeholder tracks render instantly while audio decodes, then the engine builds once when all tracks are ready.

Turning it on after the playlist has loaded (a new set of files) disposes the engine. Until the deferral ends and the engine is built again, `isReady` is `false` and the view is `data-playlist-state="loading"`, as on the first load.

```tsx
const { tracks, loading } = useAudioTracks(configs, { immediate: true });

<WaveformPlaylistProvider tracks={tracks} deferEngineRebuild={loading}>
  <Waveform />
</WaveformPlaylistProvider>
```

## Context Values

The provider exposes state and controls through React Context. Access them using the provided hooks.

Each hook returns one group of fields that change together, and a component re-renders only when the value of a hook it calls changes. See [hooks.md](/docs/react/api/hooks#core-context-hooks) for what triggers each one and for the full interfaces with JSDoc comments.

The hooks marked "either provider" below are the same hooks `MediaElementPlaylistProvider` serves, so a component written against them works under both. The others need `WaveformPlaylistProvider` and throw when the nearest playlist provider is a `MediaElementPlaylistProvider`.

### Playing (useIsPlaying)

```typescript
interface IsPlayingContextValue {
  isPlaying: boolean;
}
```

### Playback refs (usePlaybackRefs)

Either provider. The value never changes, so calling this hook never re-renders the component.

```typescript
interface PlaybackRefsContextValue {
  /** The playback position, in seconds. Advances during playback. */
  currentTimeRef: RefObject<number>;
  /** The position to draw: the audible position (the raw time less output
   *  latency and lookahead) while playing, the raw position otherwise. */
  visualTimeRef: RefObject<number>;
  /** Register a per-frame callback driven by the single animation loop. */
  registerFrameCallback: (id: string, cb: (data: FrameData) => void) => void;
  /** Unregister a per-frame callback. */
  unregisterFrameCallback: (id: string) => void;
}
```

### Engine refs (useEngineRefs)

`WaveformPlaylistProvider` only. The value never changes.

```typescript
interface EngineRefsContextValue {
  playbackStartTimeRef: RefObject<number>;
  audioStartPositionRef: RefObject<number>;
  /** Returns current playback time from engine (auto-wraps at loop boundaries). */
  getPlaybackTime: () => number;
  /** Current time of the adapter's AudioContext, in seconds. */
  getAudioContextTime: () => number;
  /** Adapter scheduler lookahead in seconds (~0.1 s for Tone.js, 0 for native). */
  getLookAhead: () => number;
  /** Adapter AudioContext output latency in seconds. */
  getOutputLatency: () => number;
  /** The engine. `current` is null until the first build and during a rebuild. */
  playoutRef: RefObject<PlaylistEngine | null>;
  /** true during boundary trim drags */
  isDraggingRef: MutableRefObject<boolean>;
}
```

### Selection (useSelection)

```typescript
interface SelectionContextValue {
  selectionStart: number;
  selectionEnd: number;
}
```

### Resting cursor position (useCurrentTime)

```typescript
interface CurrentTimeContextValue {
  /** Where the cursor rests, in seconds. Does not advance during playback. */
  currentTime: number;
}
```

Changes on a seek, a pause, a stop and a selection whose start moves. For a live position during playback use `currentTimeRef` or a frame callback from `usePlaybackRefs()`.

### Active annotation (useActiveAnnotation)

```typescript
interface ActiveAnnotationContextValue {
  /** The annotation that is playing or was last chosen */
  activeAnnotationId: string | null;
}
```

### Annotations (useAnnotations)

Either provider.

```typescript
interface AnnotationsContextValue {
  annotations: AnnotationData[];
}
```

### Annotation options (useAnnotationOptions)

Either provider.

```typescript
interface AnnotationOptionsContextValue {
  editable: boolean;
  linkEndpoints: boolean;
  continuousPlay: boolean;
}
```

### Loop (useLoop)

```typescript
interface LoopContextValue {
  isLoopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}
```

### Selected track (useSelectedTrackId)

```typescript
interface SelectedTrackIdContextValue {
  selectedTrackId: string | null;
}
```

### Undo and redo (useUndoRedo)

```typescript
interface UndoRedoContextValue {
  canUndo: boolean;
  canRedo: boolean;
}
```

### Playback controls (usePlaybackControls)

Either provider. The actions both providers have. The value never changes.

```typescript
interface PlaybackControlsContextValue {
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  /** Ends playback and returns the cursor to where playback started. */
  stop: () => void;
  /** Moves the cursor, clamped to the audio. During playback, playback restarts there. */
  seekTo: (time: number) => void;
  /** Sets the selected range and moves the cursor to its start. During playback, playback
   *  restarts: a range is played start to end (open-ended under WaveformPlaylistProvider with
   *  looping on), a collapsed one carries on from there. */
  setSelection: (start: number, end: number) => void;
  setTimeFormat: (format: TimeFormat) => void;
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
  setContinuousPlay: (enabled: boolean) => void;
  setAnnotationsEditable: (enabled: boolean) => void;
  setLinkEndpoints: (enabled: boolean) => void;
  setAnnotations: Dispatch<SetStateAction<AnnotationData[]>>;
  annotationPreview: ValueSourceHandle<AnnotationData[] | null>; // edge drag in progress; stable
  setActiveAnnotationId: (id: string | null) => void;
  playAnnotation: (annotation: AnnotationData) => void; // what a click on a box or a list row does
}
```

### Editor controls (useEditorControls)

`WaveformPlaylistProvider` only. The actions only the multitrack editor has. The value never changes.

```typescript
interface EditorControlsContextValue {
  /** Moves the cursor without touching playback. Use seekTo from a control. */
  setCurrentTime: (time: number) => void;
  // Track mixer, by track id. A first argument that is not a string, or an
  // id no track has, is ignored.
  setTrackMute: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, soloed: boolean) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  reorderTrack: (trackId: string, toIndex: number) => void;
  /** Internal: call after every track-reorder drag interaction ends. */
  bumpTrackReorderEpoch: () => void;
  /** Internal wiring for ClipInteractionProvider. */
  setTrackDragPreview: Dispatch<SetStateAction<TrackDragPreview | null>>;
  setSelectedTrackId: (trackId: string | null) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  setMasterVolume: (volume: number) => void;
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setLoopRegionFromSelection: () => void;
  clearLoopRegion: () => void;
  undo: () => void;
  redo: () => void;
  /** Mark a recording session active/inactive. While active: (1) the
   *  end-of-audio auto-stop is suppressed so overdub playback runs past the
   *  end of existing material, and (2) with an armedTrackId, that track's
   *  existing content is transiently muted — punch-in replaces whatever the
   *  take overlaps — and restored when the session ends. `useRecordingSession`
   *  calls it for the life of a take; overdub flows should also call it
   *  eagerly (before play()). */
  setRecordingActive: (active: boolean, armedTrackId?: string | null) => void;
}
```

### View (usePlaylistView)

Either provider. What the provider was configured with that a view also reads. Changes on a prop change (and once when the real sample rate is known), not on a settings click.

```typescript
interface PlaylistViewContextValue {
  sampleRate: number;
  /** Whether tracks are drawn and analysed as one channel. Always false under the MediaElement provider. */
  mono: boolean;
  /** Whether playback continues past the end of the audio instead of stopping there.
   *  Always false under the MediaElement provider. */
  indefinitePlayback: boolean;
}
```

The view options (`waveHeight`, `barWidth`, `barGap`, `roundedBars`, `progressBarWidth`, `fillViewport`) are not in this value. They are set with `<WaveformViewOptions>`; a component drawn inside a root reads the resolved values with `usePlaylistInfo()` from `@waveform-playlist/ui-components` (all but `fillViewport`, which has no reader).

### Settings (usePlaylistSettings)

The two settings a user toggles. Changes when the user changes either.

```typescript
interface PlaylistSettingsContextValue {
  timeFormat: TimeFormat;
  isAutomaticScroll: boolean;
}
```

### Zoom (usePlaylistZoom)

```typescript
interface PlaylistZoomContextValue {
  samplesPerPixel: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
}
```

### Timeline (usePlaylistTimeline)

Changes on every clip operation, on every pointer move of a trim and on a zoom (`peaksDataArray` is computed per zoom level); also when loading finishes (`isReady`) and when peaks arrive.

```typescript
interface PlaylistTimelineContextValue {
  tracks: ClipTrack[];
  peaksDataArray: TrackClipPeaks[];
  duration: number;
  isReady: boolean;
  onTracksChange: ((tracks: ClipTrack[]) => void) | undefined;
}
```

### Mixer (usePlaylistMixer)

Changes on every mute, solo, volume or pan change (each step of a slider drag), and when tracks are added, removed or reordered.

```typescript
interface PlaylistMixerContextValue {
  trackStates: TrackState[];
  masterVolume: number;
}
```

`trackStates` has one entry per track, in the order of `tracks`. The entry of a track that is still loading is `undefined` at that track's position (the type does not say so: read `trackStates[i]?.muted`). The provider keeps this state by track id, so a track keeps its mute, solo, volume and pan when other tracks are removed, added or moved; a track with a new id starts from the fields of its `ClipTrack`. Details: [`usePlaylistMixer`](/docs/react/api/hooks#useplaylistmixer). Inside a track's control panel, [`useTrack()`](/docs/react/api/hooks#usetrack) has the state and the setters of that track.

### Track reorder preview (useTrackReorderPreview)

```typescript
interface TrackReorderPreviewContextValue {
  /** Non-null while a track-reorder drag is live; null otherwise */
  trackDragPreview: TrackDragPreview | null;
  /** Incremented after every track-reorder drag ends */
  trackReorderEpoch: number;
}
```

## Example: Custom Wrapper

Create a custom wrapper with your application's defaults:

```tsx
import type { ComponentProps, ReactNode } from 'react';
import { WaveformPlaylistProvider, WaveformViewOptions } from '@waveform-playlist/browser';
import type { ClipTrack } from '@waveform-playlist/core';

// The props type is not exported; take it from the component.
type ProviderProps = ComponentProps<typeof WaveformPlaylistProvider>;

interface MyPlaylistProps extends Partial<ProviderProps> {
  tracks: ClipTrack[];
  children: ReactNode;
}

function MyPlaylistProvider({ tracks, children, ...props }: MyPlaylistProps) {
  return (
    <WaveformViewOptions waveHeight={100}>
      <WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1024} theme={myTheme} {...props}>
        {children}
      </WaveformPlaylistProvider>
    </WaveformViewOptions>
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
  /** Draw and analyse every track as one channel. The provider computes the peaks with it. */
  mono?: boolean;
  zoomLevels?: number[];
  automaticScroll?: boolean;

  // Theming
  theme?: Partial<WaveformPlaylistTheme>;

  // Audio
  effects?: EffectsFunction;
  trackEffects?: (trackId: string) => TrackEffectsFunction | undefined;

  // Annotations
  annotationList?: AnnotationListProp; // { annotations?, editable?, linkEndpoints?, isContinuousPlay? }

  // Callbacks
  onReady?: () => void;
  /** Called when audio/engine initialization fails. The provider already logs the error. */
  onError?: (err: Error) => void;
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  /** Called when engine clip operations (move/trim/split) update tracks */
  onTracksChange?: (tracks: ClipTrack[]) => void;

  // Advanced
  /** SoundFont cache for sample-based MIDI playback */
  soundFontCache?: SoundFontCache;
  /** Defer engine build during progressive loading */
  deferEngineRebuild?: boolean;
  /** Disable automatic stop when the cursor reaches the end of the longest
   *  track — the transport rolls until explicit stop (DAW style, = dawcore's
   *  indefinite-playback). The multitrack view then draws the timeline as wide
   *  as its container, as <WaveformViewOptions fillViewport> does. Recording
   *  sessions suppress the auto-stop automatically. */
  indefinitePlayback?: boolean;
  /** Desired AudioContext sample rate. Pre-computed peaks (.dat) render
   *  instantly when they match. On mismatch, falls back to worker. */
  sampleRate?: number;
  /** Supply a custom playout adapter — skips dynamic import of @waveform-playlist/playout + tone */
  createAdapter?: () => PlayoutAdapter;
}
```

## See Also

- [Waveform Component](/docs/react/api/components#waveform)
- [WaveformViewOptions](/docs/react/api/components#waveformviewoptions)
- [Core Context Hooks](/docs/react/api/hooks#core-context-hooks)
- [usePlaybackControls Hook](/docs/react/api/hooks#useplaybackcontrols)
- [useEditorControls Hook](/docs/react/api/hooks#useeditorcontrols)
