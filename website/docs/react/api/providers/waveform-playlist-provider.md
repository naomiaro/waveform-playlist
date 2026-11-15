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
import { WaveformPlaylistProvider, Waveform, useCreateArrangement } from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

function Editor() {
  const arrangement = useCreateArrangement(() => [
    audioTrack({ src: '/audio/vocals.mp3', name: 'Vocals' }),
    audioTrack({ src: '/audio/drums.mp3', name: 'Drums' }),
  ]);

  return (
    <WaveformPlaylistProvider arrangement={arrangement} samplesPerPixel={1024}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

The options that only affect how a view draws (row height, bar style, playhead width, the filled layout) are not provider props. Set them with [`<WaveformViewOptions>`](/docs/react/api/components#waveformviewoptions), above or below the provider:

```tsx
import { WaveformPlaylistProvider, Waveform, WaveformViewOptions } from '@waveform-playlist/browser';

<WaveformViewOptions waveHeight={128} barWidth={2} barGap={1}>
  <WaveformPlaylistProvider arrangement={arrangement} samplesPerPixel={1024}>
    <Waveform />
  </WaveformPlaylistProvider>
</WaveformViewOptions>
```

## Props

### Required Props

#### `arrangement`

**Type:** `Arrangement` (from `@waveform-playlist/engine`)

What the provider plays and draws. The arrangement owns the tracks and their clips, the mix (volume, mute, solo and pan by track id), the undo history and the loading of the audio the clips name. The provider derives everything it publishes from it (`usePlaylistTimeline()`, `usePlaylistMixer()`, `useUndoRedo()`) and never keeps a copy of its own. Make it with [`useCreateArrangement`](/docs/react/api/hooks#usecreatearrangement), declare the first tracks in its initializer, and change it through its methods: `addTrack`, `removeTrack`, `updateTrack`, `setTracks`, the mixer setters, `undo` and so on. Below the provider, `useArrangement()` returns the same object.

```tsx
const arrangement = useCreateArrangement(() => [audioTrack({ src: '/audio/track.mp3', name: 'Track' })]);

// From a handler: the provider and the engine follow
const addFile = (file: File) => arrangement.addTrack(audioTrack({ src: file }));

<WaveformPlaylistProvider arrangement={arrangement}>
```

The prop is required: without it (or with a value that is not an object) the provider throws an `Error` while it renders, in every build, whose message starts `` [waveform-playlist] WaveformPlaylistProvider needs an `arrangement` prop `` and links to the [upgrade guide](/docs/react/upgrading).

Keep one arrangement for the life of the playlist. A new `arrangement` object is a new playlist: everything below the provider mounts again, with a new engine. Playback stops, and the zoom, the selection, the loop, the master volume and the scroll position start from their initial values. A development build says so once with a console warning.

A track change (added, removed, replaced, all tracks set) never builds a new engine: the engine follows the arrangement. An engine is built when the provider mounts, when `effects` changes identity and when `zoomLevels` changes content. `createAdapter` and `sampleRate` are read when an engine is built.

Audio starts loading when the provider has its first adapter: nothing is fetched before. See [Loading Audio](/docs/react/guides/loading-audio).

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
  arrangement={arrangement}
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

<WaveformPlaylistProvider arrangement={arrangement} trackEffects={trackFx.getTrackEffectsFunction}>
```

Tracks are plain data and have no `effects` field. The provider calls the function when it builds a track's audio graph, using the function from the latest render, so a new function identity (an inline arrow) rebuilds nothing. If it returns a different effects function for a track that is already built, that takes effect the next time the track is built.

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

There is no `onTracksChange`: a clip move, trim or split, a reorder, an undo and a take each change the arrangement, and the arrangement is where you read the tracks (`arrangement.getTracks()`, `arrangement.subscribe()`, or `useArrangementTracks(arrangement)` in a component).

#### `onReady`

**Type:** `() => void`

Called once per mount of the provider: the first time an engine is attached and no source of the arrangement is still pending. A source whose load failed counts as settled. An empty arrangement is ready as soon as its engine is attached. It is not called again after a later engine build, a StrictMode remount or an `<Activity>` hide and reveal. At the same moment the provider dispatches the window event `waveform-playlist:ready` and `usePlaylistTimeline().isReady` turns true (see [Loading Audio](/docs/react/guides/loading-audio#ready)).

`play()` does nothing before that moment. `play()` called from `onReady` itself works.

The function is read when it is called: a new function identity (an inline arrow) builds nothing. If the callback throws, the provider logs `[waveform-playlist] The onReady callback threw: …` as a console error and calls `onError` with the error; the playlist is ready all the same.

#### `onError`

**Type:** `(err: Error) => void`

Called when the engine or its adapter cannot be built, for example a missing optional peer, a `createAdapter` that throws, or an invalid `zoomLevels` / `samplesPerPixel`, and when `onReady` throws. It is called only for a build that is still current: not for one replaced by a newer build or a remount, nor after the provider unmounted. The provider already logs the error; use this to show it in your UI. Like `onReady`, it is read when it is called.

It is not called for audio that fails to load: that is in `useArrangementSources(arrangement)`, with its error. A track the arrangement refuses (a duplicate id, a clip of the wrong kind) throws at the call that offered it, not here: see [Where errors land](/docs/react/guides/loading-audio#where-errors-land).

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

#### `sampleRate`

**Type:** `number`

The sample rate to create the `AudioContext` at (default Tone.js adapter). Pre-computed peaks (`.dat` files) are drawn from the file when their rate matches; otherwise peaks are generated from the decoded audio. Read when an engine is built.

It also tells the provider its sample rate before the first adapter exists. Placeholders for clips that are still loading are drawn only once the provider knows its real rate: from mount with this prop, otherwise from the first adapter on. Without the prop, and with an adapter that can never be built, no placeholder is drawn.

#### `createAdapter`

**Type:** `() => PlayoutAdapter`

A factory for your own playout adapter. Without it the Tone.js adapter (`@waveform-playlist/playout`) is imported dynamically, so with it an app needs neither that package nor `tone`. It is called once per engine build, and the provider disposes the adapter with its engine. Read when an engine is built: a new function identity builds nothing.

The provider decodes audio with the current adapter's `AudioContext`. A load in flight when an engine is rebuilt carries on with the previous adapter's context, so an adapter whose `dispose()` closes its context can make such a load fail; `arrangement.retry(src)` starts it again.

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
  // Track mixer, by track id: the arrangement's mix, also while no engine is
  // attached. A first argument that is not a string, or an id no track has,
  // is ignored.
  setTrackMute: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, soloed: boolean) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  /** An undo step of the arrangement. */
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
  /** The arrangement's history, engine or not. */
  undo: () => void;
  redo: () => void;
  /** Mark a recording session active/inactive. While active: (1) the
   *  end-of-audio auto-stop is suppressed so overdub playback runs past the
   *  end of existing material, and (2) with an armedTrackId, that track is
   *  muted in the arrangement's mix: the mixer and the track's Mute button show
   *  it muted, the built-in <TrackMuteButton /> of that track is disabled and
   *  useTrack().isRecordingArmed is true for it. The mute from before the
   *  session is written back when it ends, when the armed track changes and
   *  when the provider unmounts, whatever was set in between.
   *  `useRecordingSession` calls it for the life of a take; overdub flows
   *  should also call it eagerly (before play()). */
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

Changes on every clip operation (a trim once, on release), on a zoom (`peaksDataArray` is computed per zoom level), when audio arrives for a clip, when peaks arrive and when `isReady` changes.

```typescript
interface PlaylistTimelineContextValue {
  /** The arrangement's tracks without the clips that are still loading. Never write to them. */
  tracks: readonly ClipTrack[];
  /** One row per track. A row also holds a placeholder record (isPlaceholder: true)
   *  for each clip still loading that can be drawn. */
  peaksDataArray: TrackClipPeaks[];
  /** The end, in seconds, of the loaded audio. */
  duration: number;
  /** False until an engine is attached and the first sources have settled;
   *  then false while a later engine is being built. */
  isReady: boolean;
}
```

`tracks`, `peaksDataArray` and `trackStates` (from `usePlaylistMixer()`) have one entry per track of the arrangement, in its order, so `tracks[i]`, `peaksDataArray[i]` and `trackStates[i]` are the same track. Below the track, nothing pairs by position: a placeholder record in `peaksDataArray[i]` has no clip in `tracks[i].clips`, so find a clip's record by `clipId`. A track whose clips are all loaded is the arrangement's own object, frozen outside production builds; one that holds a clip still loading is a copy without that clip. Change tracks through the arrangement.

`duration` counts loaded audio only; the view is still drawn wide enough for a placeholder that ends later.

### Mixer (usePlaylistMixer)

Changes on every mute, solo, volume or pan change (each step of a slider drag), and when tracks are added, removed, renamed or reordered.

```typescript
interface PlaylistMixerContextValue {
  trackStates: TrackState[];
  masterVolume: number;
}
```

`trackStates` has one entry per track, in the order of `tracks`, from the moment the track enters the arrangement (also while its audio loads). The values are the arrangement's mix (`arrangement.getMixer()`), kept by track id, so a track keeps its mute, solo, volume and pan when other tracks are removed, added or moved, and an undo never changes them. A track's own `volume`, `muted`, `soloed` and `pan` fields are only the values it entered with. Details: [`usePlaylistMixer`](/docs/react/api/hooks#useplaylistmixer). Inside a track's control panel, [`useTrack()`](/docs/react/api/hooks#usetrack) has the state and the setters of that track.

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
import type { Arrangement } from '@waveform-playlist/engine';

// The props type is not exported; take it from the component.
type ProviderProps = ComponentProps<typeof WaveformPlaylistProvider>;

interface MyPlaylistProps extends Partial<ProviderProps> {
  arrangement: Arrangement;
  children: ReactNode;
}

function MyPlaylistProvider({ arrangement, children, ...props }: MyPlaylistProps) {
  return (
    <WaveformViewOptions waveHeight={100}>
      <WaveformPlaylistProvider arrangement={arrangement} samplesPerPixel={1024} theme={myTheme} {...props}>
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
  /** The tracks, the mix, the undo history and the loading. A new object mounts everything below again. */
  arrangement: Arrangement;
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

  // Callbacks (read when called: a new identity builds nothing)
  /** Once per mount: the first time an engine is attached and no source is pending. */
  onReady?: () => void;
  /** The engine or its adapter could not be built, or onReady threw. Not for a source that
   *  fails to load (see useArrangementSources). The provider already logs the error. */
  onError?: (err: Error) => void;
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;

  // Advanced
  /** SoundFont cache for sample-based MIDI playback */
  soundFontCache?: SoundFontCache;
  /** Disable automatic stop when the cursor reaches the end of the longest
   *  track — the transport rolls until explicit stop (DAW style, = dawcore's
   *  indefinite-playback). The multitrack view then draws the timeline as wide
   *  as its container, as <WaveformViewOptions fillViewport> does. Recording
   *  sessions suppress the auto-stop automatically. */
  indefinitePlayback?: boolean;
  /** Desired AudioContext sample rate. Pre-computed peaks (.dat) render
   *  instantly when they match. On mismatch, falls back to worker. Read at build time. */
  sampleRate?: number;
  /** Supply a custom playout adapter — skips dynamic import of @waveform-playlist/playout + tone.
   *  Called once per engine build. Read at build time. */
  createAdapter?: () => PlayoutAdapter;
}
```

## See Also

- [Waveform Component](/docs/react/api/components#waveform)
- [WaveformViewOptions](/docs/react/api/components#waveformviewoptions)
- [Core Context Hooks](/docs/react/api/hooks#core-context-hooks)
- [Arrangement Hooks](/docs/react/api/hooks#arrangement-hooks)
- [Loading Audio](/docs/react/guides/loading-audio)
- [usePlaybackControls Hook](/docs/react/api/hooks#useplaybackcontrols)
- [useEditorControls Hook](/docs/react/api/hooks#useeditorcontrols)
