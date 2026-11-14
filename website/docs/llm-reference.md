---
sidebar_position: 6
title: LLM API Reference
description: Machine-readable API reference for LLMs and coding agents. All TypeScript interfaces from source.
---

# LLM API Reference

This page contains all TypeScript interfaces extracted from source code. Designed for LLMs and coding agents — no prose, just types.

**Source of truth:** `packages/browser/src/contexts/playlistContexts.ts` (context value types and hooks), `packages/browser/src/WaveformPlaylistContext.tsx`, `packages/browser/src/MediaElementPlaylistContext.tsx`

**Requirements:** the React packages need `react` / `react-dom` `^19.0.0` and `styled-components` `^6.0.0`.

**Upgrading from an earlier major:** see the [upgrade guide](./react/upgrading.md) — one Find / Replace-with entry per breaking change.

**One owner per name (#770):** among the React packages a name is exported by one package, and `browser`, `annotations`, `ui-components`, `spectrogram` and `recording` re-export nothing from another package. Import data types and helpers (`ClipTrack`, `AudioClip`, `Fade`, `AnnotationData`, `createTrack`, `KeyboardShortcut`, `handleKeyboardEvent`, the sample/pixel/second conversions, `SpectrogramCanvasRegistration`) from `@waveform-playlist/core`; `TimeFormat`, `TrackMenuItem` and `BeatsAndBarsSnapTo` from `@waveform-playlist/ui-components`; `EffectsFunction` and `TrackEffectsFunction` from `@waveform-playlist/playout`; the annotation checkboxes and `DownloadAnnotationsButton` from `@waveform-playlist/annotations`. Among the main entries of those five packages, `@waveform-playlist/browser/tone` and `@waveform-playlist/core`, the names two entry points share on purpose are `AutomaticScrollCheckbox`, `MasterVolumeControl`, `PlaybackRateSelect`, `SelectionTimeInputs` and `TimeFormatSelect`: the one in `ui-components` is driven by props, the one in `browser` reads the provider and wraps it. (`Track` is two different things under one name: a type in `@waveform-playlist/core` and a component in `@waveform-playlist/ui-components`.) One more pair is left: `createEffectInstance` is one function in `@waveform-playlist/browser/tone` and a different one in `@waveform-playlist/core`.

---

## Provider Props (WaveformPlaylistProvider)

```typescript
interface WaveformPlaylistProviderProps {
  tracks: ClipTrack[];
  children: ReactNode;
  /** Draw and analyse every track as one channel. A provider option, not a
   *  view option: the provider computes the peaks with it. */
  mono?: boolean;                         // Default: false
  samplesPerPixel?: number;               // Default: 1024
  zoomLevels?: number[];
  automaticScroll?: boolean;              // Default: false. While on, a drag during playback is one seek to the press, no range
  theme?: Partial<WaveformPlaylistTheme>; // merged over defaultTheme: { ...defaultTheme, ...theme }
  annotationList?: AnnotationListProp;
  effects?: EffectsFunction;
  /** A track's effects function by track id (`getTrackEffectsFunction` from
   *  `useTrackDynamicEffects()`). Tracks carry no `effects` field. Called when a
   *  track's audio graph is built; a new function identity rebuilds nothing. */
  trackEffects?: (trackId: string) => TrackEffectsFunction | undefined;
  onReady?: () => void;
  /** Called when audio/engine initialization fails (e.g. a missing optional peer,
   *  a throwing `createAdapter`, or an invalid `zoomLevels`/`samplesPerPixel`). The
   *  provider already logs the error; use this to surface it in your UI. */
  onError?: (err: Error) => void;
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  /** Called when engine clip operations (move/trim/split) update tracks */
  onTracksChange?: (tracks: ClipTrack[]) => void;
  /** Defer engine build during progressive loading — tracks render but engine isn't built */
  deferEngineRebuild?: boolean;           // Default: false
  /** SoundFont cache for sample-based MIDI playback */
  soundFontCache?: SoundFontCache;
  /** Disable end-of-timeline auto-stop — roll until explicit stop (DAW style). The multitrack
   *  view then draws the timeline as wide as its container, as `<WaveformViewOptions fillViewport>`
   *  does. Recording sessions suppress the auto-stop automatically. A provider option, not a
   *  view option: the animation loop and `seekTo` follow it. */
  indefinitePlayback?: boolean;           // Default: false
  /** Desired AudioContext sample rate for pre-computed peaks matching */
  sampleRate?: number;
  /** Supply a custom playout adapter — skips dynamic import of @waveform-playlist/playout + tone */
  createAdapter?: () => PlayoutAdapter;
}
// Not provider props (#689): waveHeight, barWidth, barGap, roundedBars, progressBarWidth,
// fillViewport. They are props of <WaveformViewOptions> (see "View options" below).
// The props type itself is not exported: use React.ComponentProps<typeof WaveformPlaylistProvider>.
```

---

## Provider Props (MediaElementPlaylistProvider)

```typescript
interface FadeConfig {
  duration: number;                      // Duration of the fade in seconds
  type?: FadeType;                       // 'linear' | 'logarithmic' | 'exponential' | 'sCurve'
}

interface MediaElementTrackConfig {
  source: string;                        // Audio source URL or Blob URL
  waveformData: WaveformDataObject;      // Pre-computed waveform data (required)
  name?: string;                         // Track name for display
  fadeIn?: FadeConfig;                   // Fade in (requires audioContext)
  fadeOut?: FadeConfig;                  // Fade out (requires audioContext)
}

interface MediaElementPlaylistProviderProps {
  track: MediaElementTrackConfig;
  children: ReactNode;
  audioContext?: AudioContext;            // Enables Web Audio routing (fades, effects)
  samplesPerPixel?: number;              // Default: 1024
  playbackRate?: number; // Default: 1. Not clamped by the provider (setPlaybackRate clamps to 0.5–2.0)
  preservesPitch?: boolean;              // Default: true (set false for external pitch processor)
  automaticScroll?: boolean;             // Default: false. While on, a drag during playback is one seek to the press, no range
  theme?: Partial<WaveformPlaylistTheme>;
  annotationList?: AnnotationListProp;      // the same prop as on WaveformPlaylistProvider
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  onReady?: () => void;                  // the media element has loaded its metadata; once per player. Pass a stable function
  onError?: (error: Error) => void;      // player could not be created, or the media failed (also mid-playback, which ends playback); the provider adds no URL to the message. Pass a stable function
  /** Supply a custom MediaElementPlayout — skips dynamic import of @waveform-playlist/media-element-playout.
   *  It must implement on() and emit 'loadedmetadata' (without it isReady never turns true).
   *  The provider also listens for 'timeupdate', 'error' and 'playrejected'. */
  createPlayout?: () => MediaElementPlayout;
}
// Not provider props (#689): waveHeight, barWidth, barGap, roundedBars, progressBarWidth.
// They are props of <WaveformViewOptions>. The default waveHeight is 80 under both providers
// (it was 100 under this one).
```

---

## Context Hooks: either provider

Rendered by both `WaveformPlaylistProvider` and `MediaElementPlaylistProvider`; each hook reads the nearest one. Outside both: `<hook> must be used within WaveformPlaylistProvider or MediaElementPlaylistProvider`. Interfaces copied from `packages/browser/src/contexts/playlistContexts.ts`; all value types are exported from `@waveform-playlist/browser`, with `ClipPeaks`, `TrackClipPeaks`, `TrackDragPreview`, `TrackState` and `FrameData`. Removed hooks and where their fields went: [upgrade guide](./react/upgrading.md#one-set-of-hooks-and-controls-for-both-providers).

### useIsPlaying()

```typescript
/**
 * Whether playback is running. Its own context (#768): it is the only value of
 * the playback state that changes on play, pause and stop, and a component
 * that needs a ref or a frame callback (`usePlaybackRefs`) must not re-render
 * with it.
 */
interface IsPlayingContextValue {
  isPlaying: boolean;
}
```

### useCurrentTime()

```typescript
/**
 * Where the cursor rests, in seconds: the position playback starts from. It
 * changes on a seek, a pause, a stop (including playback reaching the end) and
 * a selection whose start moves; it does NOT advance during playback (read
 * `currentTimeRef`, or register a frame callback, for that). Apart from the
 * other values so that a component reading `isPlaying` or a ref is not
 * re-rendered by every seek, nor by every pointer move of a leftward selection
 * drag (#740).
 */
interface CurrentTimeContextValue {
  currentTime: number;
}
```

### useSelection()

```typescript
/**
 * The selected time range, in seconds. Apart from the state context because it
 * is the only state that changes on every pointer move of a selection drag
 * (#733). `selectionStart === selectionEnd` means nothing is selected.
 */
interface SelectionContextValue {
  selectionStart: number;
  selectionEnd: number;
}
```

### useActiveAnnotation()

```typescript
/**
 * The annotation that is playing or was last chosen. Its own context because
 * it changes at every annotation boundary during playback (#740).
 */
interface ActiveAnnotationContextValue {
  activeAnnotationId: string | null;
}
```

### useAnnotations()

```typescript
/**
 * The annotations. Changes on an annotation edit; an edge drag changes it
 * once, on release (its moves go through the preview source).
 */
interface AnnotationsContextValue {
  annotations: AnnotationData[];
}
```

### useAnnotationOptions()

```typescript
/**
 * The three annotation options, under both providers (#686): whether
 * annotations can be edited, whether an edge takes the edge it touches along,
 * and whether playback runs on past the end of an annotation. They start from
 * the provider's `annotationList` prop and are set with
 * `setAnnotationsEditable`, `setLinkEndpoints` and `setContinuousPlay` of
 * `usePlaybackControls()`.
 */
interface AnnotationOptionsContextValue {
  editable: boolean;
  linkEndpoints: boolean;
  continuousPlay: boolean;
}

/**
 * The `annotationList` prop of both providers. The provider holds the three
 * options as state (`useAnnotationOptions()`, and the three setters of
 * `usePlaybackControls()`), and that state follows the prop: when the value
 * of a field changes, the option takes it. Between two changes of the prop a
 * setter (or one of the checkboxes) changes the option; the prop is not told.
 */
interface AnnotationListProp {
  annotations?: AnnotationData[];
  /** Whether annotations can be edited (text, ids, edges). Default: false. */
  editable?: boolean;
  /** Whether a dragged edge takes the edge it touches along. Default: false. */
  linkEndpoints?: boolean;
  /** Whether playback runs on past the end of an annotation. Default: false. */
  isContinuousPlay?: boolean;
}
```

### usePlaybackControls()

```typescript
/**
 * The actions both providers have (#688). The value never changes, so reading
 * it never re-renders.
 */
interface PlaybackControlsContextValue {
  /**
   * Starts playback at `startTime` (default: the cursor). With `playDuration`
   * it stops by itself after that many seconds of audio.
   */
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
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;

  setContinuousPlay: (enabled: boolean) => void;
  setAnnotationsEditable: (enabled: boolean) => void;
  setLinkEndpoints: (enabled: boolean) => void;
  setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>>;
  /**
   * Where an annotation edge drag shows its moves while it is in progress.
   * Pass it to `useAnnotationDragHandlers({ preview })`; read it in a custom
   * annotation renderer with `useAnnotationsWithPreview`. Stable identity.
   */
  annotationPreview: AnnotationPreviewHandle;
  setActiveAnnotationId: (id: string | null) => void;
  /**
   * What a click on an annotation does (its box, or its row in the list): the
   * annotation becomes the active one and is played from its start. With
   * continuous play off, playback ends where the annotation ends. Call it
   * from a box or a row of your own. Each provider plays an annotation its
   * own way: `WaveformPlaylistProvider` starts a play of the annotation's
   * length, `MediaElementPlaylistProvider` starts an open-ended play that its
   * loop ends with the active annotation. Left alone, both end at the
   * annotation's end. They differ when something changes during the play:
   * under MediaElement the play follows an end that is moved, and continuous
   * play switched on lets it run on; under WebAudio the first keeps the end
   * it started with. A start that fails is logged as a warning.
   */
  playAnnotation: (annotation: AnnotationData) => void;
}
```

### usePlaybackRefs()

```typescript
interface FrameData {
  /** Raw engine time (for state/logic — NOT for visual positioning). */
  readonly time: number;
  /** Visually-aligned time for DOM positioning: engine.getAudibleTime() while
   *  playing (matches speaker output), raw time when resting. */
  readonly visualTime: number;
  readonly sampleRate: number;
  readonly samplesPerPixel: number;
}

/**
 * Refs and functions that keep their identity for the life of the provider
 * (#768). Reading this never causes a re-render: read a ref's `.current` in an
 * event handler, an effect or a frame callback, not during render.
 */
interface PlaybackRefsContextValue {
  /** The playback position, in seconds. Advances during playback. */
  currentTimeRef: React.RefObject<number>;
  /**
   * The position to DRAW. Under the WebAudio provider it is the audible
   * position (the raw time less output latency and lookahead while playing);
   * under the MediaElement provider it is `currentTimeRef` itself, because a
   * media element reports the audible position.
   */
  visualTimeRef: React.RefObject<number>;
  /** Register a per-frame callback driven by the provider's one animation loop. */
  registerFrameCallback: (id: string, cb: (data: FrameData) => void) => void;
  /** Unregister a per-frame callback. */
  unregisterFrameCallback: (id: string) => void;
}
```

### usePlaylistView()

```typescript
/**
 * What the provider was configured with that a view also reads (#768, #689).
 * Changes on a prop change (and once when the real sample rate is known),
 * never during an interaction.
 *
 * The options that only affect how a view draws (row height, bar style,
 * playhead width, the filled layout) are not here: they are
 * `<WaveformViewOptions>`, and what is drawn reads them from ui-components'
 * `usePlaylistInfo()` inside a root.
 */
interface PlaylistViewContextValue {
  sampleRate: number;
  /**
   * Whether tracks are drawn and analysed as one channel. On the provider
   * because the provider computes the peaks with it. Always false under the
   * MediaElement provider.
   */
  mono: boolean;
  /**
   * Whether playback continues past the end of the audio instead of stopping
   * there. On the provider because its animation loop and `seekTo` follow it;
   * the multitrack root also draws the timeline as wide as its container
   * then. Always false under the MediaElement provider.
   */
  indefinitePlayback: boolean;
}
// Removed (#689): waveHeight, barWidth, barGap, roundedBars, progressBarWidth, fillViewport.
// A leftover read is undefined.
```

### usePlaylistSettings()

```typescript
/**
 * The two settings a user toggles (#768). Apart from the view value because
 * every clip overlay and the visualization shell read that one: a toggle here
 * renders only the components that show the setting.
 */
interface PlaylistSettingsContextValue {
  timeFormat: TimeFormat;
  isAutomaticScroll: boolean;
}
```

### usePlaylistZoom()

```typescript
/**
 * The zoom level (#768). Changes on a zoom. Under the MediaElement provider
 * the level is fixed: `canZoomIn` and `canZoomOut` are always false.
 */
interface PlaylistZoomContextValue {
  samplesPerPixel: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
}
```

---

## Context Hooks: WaveformPlaylistProvider only

Each throws under `MediaElementPlaylistProvider`, also when that provider is nested inside a `WaveformPlaylistProvider`: `<hook> needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it`.

### useEditorControls()

```typescript
/**
 * The actions only the multitrack editor has (#688). The value never changes.
 */
interface EditorControlsContextValue {
  /**
   * Moves the cursor without touching playback. `seekTo` is the one to use
   * from a control; this is for the view's own press and drag handling.
   */
  setCurrentTime: (time: number) => void;

  // Track mixer, by track id (by index until #687). An id no track has
  // is ignored; a first argument that is not a string is ignored with one
  // development warning per setter. Inside a track's control panel,
  // `useTrack()` has the same actions already bound to that track.
  setTrackMute: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, soloed: boolean) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;

  /** Move a track to a new index in the vertical track order. Purely
   *  organizational — playback is not interrupted. The reordered tracks
   *  array flows back through onTracksChange. */
  reorderTrack: (trackId: string, toIndex: number) => void;

  /** Internal: call after every track-reorder DRAG interaction ends
   *  (committed or canceled) to force the view's track-controls part to remount
   *  its slots, discarding any @dnd-kit sortable-plugin DOM
   *  corruption. Not needed for button-driven reorderTrack calls (they never
   *  touch dnd-kit's DOM). See bumpTrackReorderEpoch in the provider. */
  bumpTrackReorderEpoch: () => void;

  /** INTERNAL wiring for ClipInteractionProvider: publishes/clears the live
   *  track-reorder drag preview. Custom drag integrations may call it, but
   *  most consumers only ever READ trackDragPreview from useTrackReorderPreview(). */
  setTrackDragPreview: React.Dispatch<React.SetStateAction<TrackDragPreview | null>>;

  setSelectedTrackId: (trackId: string | null) => void;

  // Zoom
  zoomIn: () => void;
  zoomOut: () => void;

  // Master volume
  setMasterVolume: (volume: number) => void;

  // Loop controls
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setLoopRegionFromSelection: () => void;
  clearLoopRegion: () => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;

  // Recording
  /** Mark a recording session active/inactive. While active: (1) the
   *  end-of-audio auto-stop is suppressed so overdub playback runs past the
   *  end of existing material, and (2) with an `armedTrackId`, that track's
   *  existing content is transiently muted — punch-in recording replaces
   *  whatever the take overlaps (#579), so the doomed material must not play
   *  under the overdub; its previous mute state is restored when the session
   *  ends (audio-only, the UI mute control is untouched). `useRecordingSession`
   *  calls it for the life of a take; overdub flows should also call it
   *  eagerly (before `play()`). */
  setRecordingActive: (active: boolean, armedTrackId?: string | null) => void;
}
```

### useEngineRefs()

```typescript
/**
 * Refs and functions of the multitrack engine (#688). Like
 * `usePlaybackRefs()`, the value never changes.
 */
interface EngineRefsContextValue {
  // Refs for direct time calculation in animated components (avoids timing drift)
  playbackStartTimeRef: React.RefObject<number>; // context.currentTime when playback started
  audioStartPositionRef: React.RefObject<number>; // Audio position when playback started
  /** Returns raw playback time from engine (auto-wraps at loop boundaries). */
  getPlaybackTime: () => number;
  /** Current time of the adapter's AudioContext, in seconds. */
  getAudioContextTime: () => number;
  /**
   * Returns the current adapter scheduler lookahead (Tone ~0.1s, native 0).
   * Use this for any audible-latency calculation that must match the playhead
   * (e.g., recording live-preview peak slicing).
   */
  getLookAhead: () => number;
  /**
   * Returns the adapter AudioContext's output latency in seconds.
   * Use this for audible-latency calculations (e.g., recording live-preview peak slicing).
   */
  getOutputLatency: () => number;
  /** The engine. `current` is null until the first build and during a rebuild. */
  playoutRef: React.RefObject<PlaylistEngine | null>;
  /** Ref set by useClipDragHandlers during boundary trim drags.
   *  When true, loadAudio skips engine rebuild — visual updates flow via React state only. */
  isDraggingRef: React.MutableRefObject<boolean>;
}
```

### usePlaylistTimeline()

```typescript
/**
 * What is on the timeline (#768). Changes on every clip operation, on every
 * pointer move of a trim and on a zoom (the peaks are computed per zoom
 * level), so call `usePlaylistTimeline()` only in a component
 * that draws tracks or needs the timeline length during render.
 */
interface PlaylistTimelineContextValue {
  tracks: ClipTrack[]; // Original tracks array with IDs
  peaksDataArray: TrackClipPeaks[]; // Array of tracks, each containing array of clip peaks
  duration: number;
  /** Whether the playlist has finished loading all tracks */
  isReady: boolean;
  onTracksChange: ((tracks: ClipTrack[]) => void) | undefined;
}
```

### usePlaylistMixer()

```typescript
/** Mixer state (#768). Changes on every mute, solo, volume or pan change. */
interface PlaylistMixerContextValue {
  /** One entry per track, in the order of `tracks`: trackStates[i] belongs to
   *  tracks[i], and the length equals tracks.length. The entry of a track that
   *  is still loading is `undefined` AT ITS OWN POSITION (the type does not say
   *  so: read `trackStates[i]?.muted`, count with `.filter(Boolean).length`).
   *  Kept by track id: a track keeps its state while its id is in `tracks`
   *  (tracks removed, added in front, reordered); a new id starts from its
   *  ClipTrack fields. The array keeps its identity while no entry changed. */
  trackStates: TrackState[];
  masterVolume: number;
}
```

### useTrackReorderPreview()

```typescript
/** The live track-reorder drag (#768). Changes on every drag-over. */
interface TrackReorderPreviewContextValue {
  /** Non-null while a track-reorder drag is live: the dragged track and the
   *  index it would drop at. Both playlist columns derive their display
   *  layout from it. A control panel does not need it. */
  trackDragPreview: TrackDragPreview | null;
  /** Internal: incremented after every track-reorder drag interaction ends.
   *  The view's track-controls part folds this into each slot's `key` to
   *  force a remount, working around @dnd-kit sortable-plugin DOM corruption
   *  (see bumpTrackReorderEpoch in EditorControlsContextValue). Do not add it
   *  to keys of your own: the slot around every panel is keyed already. */
  trackReorderEpoch: number;
}
```

### useLoop()

```typescript
/** Loop region (separate from selection), Audacity-style loop points (#768). */
interface LoopContextValue {
  isLoopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}
```

### useSelectedTrackId()

```typescript
/** The track selected for editing operations (#768). */
interface SelectedTrackIdContextValue {
  selectedTrackId: string | null;
}
```

### useUndoRedo()

```typescript
/** Whether undo and redo are available (#768). Changes after an edit. */
interface UndoRedoContextValue {
  canUndo: boolean;
  canRedo: boolean;
}
```

---

## Context Hooks: MediaElementPlaylistProvider only

Each throws under `WaveformPlaylistProvider`, also when that provider is nested inside a `MediaElementPlaylistProvider`.

### usePlaybackRate()

```typescript
/** The playback speed and its setter (#688). Changes when the speed does. */
interface PlaybackRateContextValue {
  /** 0.5 to 2. */
  playbackRate: number;
  /** Clamped to 0.5–2. Stable identity. */
  setPlaybackRate: (rate: number) => void;
}
```

### useMediaElementTrack()

```typescript
/**
 * The one track of a MediaElement player (#688). Changes when the track or the
 * zoom level does, and when the player becomes ready.
 */
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

---

## Data Types

```typescript
// From @waveform-playlist/core
type TrackKind = 'audio' | 'midi';

interface ClipTrack {
  id: string;
  kind: TrackKind;        // Required. A track holds audio clips or MIDI clips (clips with midiNotes), never both
  name: string;
  clips: AudioClip[];
  muted: boolean;
  soloed: boolean;
  volume: number;         // 0.0 to 1.0+
  pan: number;            // -1.0 to 1.0
  color?: string;
  height?: number;
  renderMode?: RenderMode;  // Audio tracks only. A MIDI track is always drawn as a piano roll
  spectrogramConfig?: SpectrogramConfig;
  spectrogramColorMap?: ColorMapValue;
}

createTrack(options: { name: string; kind?: TrackKind /* default 'audio' */; clips?: AudioClip[]; /* … */ }): ClipTrack;
clipKind(clip): TrackKind;              // 'midi' when clip.midiNotes != null
trackKind(track): TrackKind;            // track.kind, or 'audio' when it is missing (plain JS)
assertTrackKind(track): void;           // Throws when a clip is not of the track's kind
splitTrackByKind(track, midiTrackId?): ClipTrack[];  // One track with its kind set, or two for a track holding both
                                                     // (audio keeps the id; MIDI gets id + '-midi' or midiTrackId)
```

```typescript
// From @waveform-playlist/core: loading a source by key (framework-free)
type SourceState<V> =
  | { status: 'pending' }
  | { status: 'loaded'; value: V }
  | { status: 'failed'; error: Error };

interface SourceLoader<K, V> {
  setWanted(keys: Iterable<K>): void;   // Declare the whole set of keys wanted now
  suspend(): void;                       // Abort every load in flight; wanted keys and loaded values are kept
  provide(key: K, value: V): void;       // Record a value the caller already holds as loaded
  retry(key: K): void;                   // Start a failed key again; a no-op for any other state
  subscribe(listener: (states: ReadonlyMap<K, SourceState<V>>) => void): () => void;
  getSnapshot(): ReadonlyMap<K, SourceState<V>>;   // A new Map object on every change
}

createSourceLoader<K, V>(options: {
  load: (key: K, signal: AbortSignal) => Promise<V>;
}): SourceLoader<K, V>;

// Clips that name their audio
type ClipSource = string | Blob;        // A string is a URL; a Blob or File is keyed by identity

interface LoadingClip {                 // Times in seconds
  id: string;
  src: ClipSource;
  start?: number;                       // Default 0
  duration?: number;                    // Default: the whole source from offset
  offset?: number;                      // Default 0
  name?: string;
  gain?: number;
  fadeIn?: Fade;
  fadeOut?: Fade;
  color?: string;
  waveformData?: WaveformDataObject;    // Pre-computed peaks
}

type PlaylistTrack = Omit<ClipTrack, 'clips'> & { clips: (AudioClip | LoadingClip)[] };

isLoadingClip(clip: AudioClip | LoadingClip): clip is LoadingClip;  // True for a clip with no sampleRate

// AudioClip.src?: ClipSource            // The source the clip was loaded from. createClip, createClipFromSeconds
//                                       // and createClipFromTicks take `src` and carry it onto the clip.

interface AudioTrackOptions {
  id?: string; clipId?: string; name?: string;   // '' counts as none; name defaults to the file name of src, else 'Untitled'
  src?: ClipSource; audioBuffer?: AudioBuffer; waveformData?: WaveformDataObject;
  start?: number; duration?: number; offset?: number;   // Seconds
  fadeIn?: Fade; fadeOut?: Fade; gain?: number; color?: string;
  muted?: boolean; soloed?: boolean; volume?: number; pan?: number;
  renderMode?: RenderMode; spectrogramConfig?: SpectrogramConfig; spectrogramColorMap?: ColorMapValue;
}

audioTrack(options: AudioTrackOptions): PlaylistTrack;
// src alone: one LoadingClip. audioBuffer or waveformData (with or without src): one AudioClip.
// None of the three: throws 'audioTrack: give src, audioBuffer or waveformData'.
// A negative or non-finite start or offset, or a duration that is not positive and finite, throws.
```

A track whose clips do not match its kind is rejected: `PlaylistEngine.setTracks/addTrack/updateTrack` throw. Under `WaveformPlaylistProvider` the throw does not reach React (an error boundary does not see it): the provider calls `onError(error)`, logs a console warning, and the playlist stays in its loading state until `tracks` is valid. Always pass `onError`.

```typescript
interface TrackState {
  name: string;
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
}

interface ClipPeaks {
  clipId: string;
  trackName: string;
  peaks: PeakData;
  startSample: number;
  durationSamples: number;
  fadeIn?: Fade;
  fadeOut?: Fade;
  /** MIDI note data — present for clips rendered as piano roll. */
  midiNotes?: MidiNoteData[];
  /** Source audio sample rate (waveformData rate when mismatched from context). */
  sampleRate?: number;
  /** Offset into the source audio in samples. */
  offsetSamples?: number;
  /** The clip's linear gain — drawn into the waveform under `<WaveformTracks gainScaled>`. */
  gain?: number;
}

type TrackClipPeaks = ClipPeaks[];

interface TrackDragPreview {
  trackId: string;
  toIndex: number;
}
```

---

## useAudioTracks

*From `@waveform-playlist/browser/tone`*

```typescript
function useAudioTracks(
  configs: AudioTrackConfig[],
  options?: UseAudioTracksOptions
): {
  tracks: ClipTrack[];
  loading: boolean;
  error: string | null;
  loadedCount: number;
  totalCount: number;
};

interface AudioTrackConfig {
  /** Track id. Optional (generated if absent); must be unique. Give one to key
   *  the provider's `trackEffects` lookup on an id the app knows up front. */
  id?: string;
  src?: string;
  audioBuffer?: AudioBuffer;
  name?: string;
  muted?: boolean;
  soloed?: boolean;
  volume?: number;
  pan?: number;
  color?: string;
  startTime?: number;
  duration?: number;
  offset?: number;
  fadeIn?: Fade;
  fadeOut?: Fade;
  waveformData?: WaveformDataObject;
}

interface UseAudioTracksOptions {
  immediate?: boolean;    // Default: false — render placeholders instantly, audio fills in
  /** @deprecated Use immediate */
  progressive?: boolean;  // Alias for immediate
}
```

---

## useDynamicTracks

*From `@waveform-playlist/browser/tone`*

```typescript
type TrackSource =
  | File                                      // Drag-and-drop / file input
  | Blob                                      // Raw audio blob
  | string                                    // URL shorthand
  | { src: string; name?: string };           // URL with optional name

interface TrackLoadError {
  name: string;                               // Display name of the failed source
  error: Error;                               // The underlying error
}

function useDynamicTracks(): UseDynamicTracksReturn;

interface UseDynamicTracksReturn {
  tracks: ClipTrack[];                        // Includes placeholders + loaded
  addTracks: (sources: TrackSource[]) => void; // Add files or URLs at runtime
  removeTrack: (trackId: string) => void;     // Remove by id, aborts in-flight fetch
  loadingCount: number;                       // Number currently decoding
  isLoading: boolean;                         // loadingCount > 0
  errors: TrackLoadError[];                   // Failed loads (tracks auto-removed)
}
```

Imperative complement to `useAudioTracks`. Creates placeholder tracks (`clips: []`) immediately when `addTracks()` is called. Placeholders show track controls with empty waveform area while audio decodes in parallel. Each placeholder is atomically replaced with the loaded track (same `id`) on success, or removed on error with the failure recorded in `errors`.

---

## Effects Hooks

*All effects hooks and factory/definition exports are from `@waveform-playlist/browser/tone`*

### useDynamicEffects

```typescript
function useDynamicEffects(fftSize?: number): UseDynamicEffectsReturn;

interface UseDynamicEffectsReturn {
  /**
   * The master chain, in order. Read it with `useActiveEffects(effects)` in
   * the component that draws the rack: this hook does not re-render when the
   * list changes, so a slider step re-renders that component only.
   */
  effects: ValueSource<ActiveEffect[]>;
  /**
   * The effects that can be added: the built-ins, then (in native-context
   * mode) every type registered with `registerEffect()`. Read when the calling
   * component renders, so register custom effects before it does.
   */
  availableEffects: EffectDefinition[];
  /**
   * Adds a built-in effect or a registered custom effect by id. A built-in is
   * in the chain before this returns. A registered type is added once its
   * `prepare` hook has run on the audio context, and requires native-context
   * mode (`configureGlobalContext({ nativeAudioContext: true })`).
   * Resolves with the new entry's instanceId; rejects for an unknown id.
   */
  addEffect: (effectId: string) => Promise<string>;
  /**
   * Hosts a WAM plugin from a module URL and appends it to the master chain.
   * Requires native-context mode — call configureGlobalContext({ nativeAudioContext: true })
   * from @waveform-playlist/playout before any audio initialization.
   * WAM entries render in offline WAV export (re-instantiated on the offline context).
   * Resolves with the new entry's instanceId.
   */
  addWamEffect: (url: string, initialState?: unknown) => Promise<string>;
  /** Live plugin handle for a hosted WAM entry (for GUI mounting via WamEffectGui). */
  getWamPlugin: (instanceId: string) => WamPluginInstance | undefined;
  removeEffect: (instanceId: string) => void;
  /** Set a parameter on the live effect. For a registered custom effect a
   *  value that is not a number is ignored. */
  updateParameter: (instanceId: string, paramName: string, value: EffectParameterValue) => void;
  toggleBypass: (instanceId: string) => void;
  reorderEffects: (fromIndex: number, toIndex: number) => void;
  /**
   * Remove and dispose every effect. An add that is still waiting (a
   * registered effect's `prepare`, a WAM plugin loading) is dropped too: its
   * promise rejects and nothing is appended after the clear.
   */
  clearAllEffects: () => void;
  masterEffects: EffectsFunction;
  /**
   * Returns the effects function for offline rendering (the same function on
   * every call). It rebuilds the chain as it is when the export runs:
   * built-in effects are re-created on the offline context, WAM entries
   * re-instantiated with the live instance's state, registered custom effects
   * prepared and created there; with no active effect it passes the audio
   * straight through. It is async and may reject — a WAV export never
   * silently renders without an effect the live chain has.
   */
  createOfflineEffectsFunction: () => OfflineEffectsFunction;
  analyserRef: RefObject<Analyser | null>;
}

type EffectParameterValue = number | string | boolean;

interface ActiveEffect {
  instanceId: string;
  effectId: string;
  /**
   * 'tone' = built-in Tone.js effect; 'wam' = hosted WAM plugin;
   * 'custom' = a type registered with `registerEffect()` from
   * `@waveform-playlist/core`.
   */
  kind: 'tone' | 'wam' | 'custom';
  /** Module URL for wam entries. */
  url?: string;
  definition: EffectDefinition;
  params: Record<string, EffectParameterValue>;
  bypassed: boolean;
  /**
   * The effect's wet/dry parameter, when it has one. Bypass sets it to 0 and
   * leaves the effect in the chain; an effect without one is bypassed by
   * disconnecting it.
   */
  wetParam?: string;
}
```

The hook does not re-render when the chain changes. Everything it returns keeps its identity for the life of the component (`masterEffects` follows `fftSize`; `availableEffects` is read from the registry each time the calling component renders, not subscribed: register custom effects before the component that shows the picker renders; adding by id does not depend on it). Call the hook once and pass its result down: a second call creates a second, empty chain.

The chains are state: they survive a StrictMode remount, Fast Refresh and a hidden `<Activity>` with their lists and live instances; the hooks run no cleanup on unmount. Add defaults on mount behind a ref guard (an unguarded mount effect adds twice under StrictMode in development). After a real unmount the instances are disposed when the chain is garbage-collected (`FinalizationRegistry`; best effort, not prompt, not guaranteed); call `clearAllEffects()` / `clearTrackEffects(trackId)` to dispose them at a known moment. A clear also drops an add still in flight: its promise rejects with "…aborted: the effects chain was cleared before …". An unmount does not abort an add. If a change cannot be wired (a node on another AudioContext), the previous chain is restored, the new instance is disposed, the list is not changed and the add rejects. A type re-registered while its `prepare` was running is added as the new definition.

### useTrackDynamicEffects

```typescript
function useTrackDynamicEffects(): UseTrackDynamicEffectsReturn;

interface UseTrackDynamicEffectsReturn {
  /**
   * One track's chain, in order. The same source is returned for the same
   * track id. Read it with `useActiveEffects(getTrackEffects(trackId))` in
   * the component that draws that track's effects: this hook does not
   * re-render when a chain changes.
   */
  getTrackEffects: (trackId: string) => ValueSource<TrackActiveEffect[]>;
  /**
   * Adds a built-in effect or a registered custom effect to a track by id. A
   * built-in is in the chain before this returns. A registered type is added
   * once its `prepare` hook has run on the audio context, and requires
   * native-context mode. Resolves with the new entry's instanceId; rejects
   * for an unknown id.
   */
  addEffectToTrack: (trackId: string, effectId: string) => Promise<string>;
  /**
   * Hosts a WAM plugin from a module URL and appends it to a track's chain.
   * Requires native-context mode — call configureGlobalContext({ nativeAudioContext: true })
   * from @waveform-playlist/playout before any audio initialization.
   * WAM entries render in offline WAV export (re-instantiated on the offline context).
   * Resolves with the new entry's instanceId.
   */
  addWamEffectToTrack: (trackId: string, url: string, initialState?: unknown) => Promise<string>;
  /** Live plugin handle for a hosted WAM entry (for GUI mounting via WamEffectGui). */
  getTrackWamPlugin: (trackId: string, instanceId: string) => WamPluginInstance | undefined;
  removeEffectFromTrack: (trackId: string, instanceId: string) => void;
  updateTrackEffectParameter: (
    trackId: string,
    instanceId: string,
    paramName: string,
    value: EffectParameterValue
  ) => void;
  toggleBypass: (trackId: string, instanceId: string) => void;
  reorderTrackEffects: (trackId: string, fromIndex: number, toIndex: number) => void;
  /** Remove and dispose every effect of one track. An add to that track that
   *  is still waiting is dropped too: its promise rejects. */
  clearTrackEffects: (trackId: string) => void;
  /**
   * The effects function of a track. The same function is returned for the
   * same track id. Pass this function itself to the provider:
   * `<WaveformPlaylistProvider trackEffects={getTrackEffectsFunction}>`.
   */
  getTrackEffectsFunction: (trackId: string) => TrackEffectsFunction;
  /**
   * Returns a track's effects function for offline rendering (the same
   * function for the same track id). It rebuilds the chain as it is when the
   * export runs; with no active effect it passes the audio straight through.
   * It is async and may reject — a WAV export never silently renders without
   * an effect the live chain has.
   */
  createOfflineTrackEffectsFunction: (trackId: string) => OfflineTrackEffectsFunction;
  /**
   * The effects that can be added: the built-ins, then (in native-context
   * mode) every type registered with `registerEffect()`. Read when the calling
   * component renders, so register custom effects before it does.
   */
  availableEffects: EffectDefinition[];
}

/** An entry of a track's chain. The same shape as a master-chain entry. */
type TrackActiveEffect = ActiveEffect;
```

### useActiveEffects

```typescript
/**
 * The effects of one chain, as React state: `effects` from
 * `useDynamicEffects()`, or `getTrackEffects(trackId)` from
 * `useTrackDynamicEffects()`. The calling component re-renders when that
 * chain changes (an effect added, removed, moved, bypassed, or a parameter
 * set), so call it in the component that draws the chain, not at the root of
 * the page.
 */
function useActiveEffects(effects: ValueSource<ActiveEffect[]>): ActiveEffect[];

// const activeEffects = useActiveEffects(effects);                    // master chain
// const trackEffects = useActiveEffects(getTrackEffects(trackId));    // one track
```

### Effect definitions and instances

```typescript
type ParameterType = 'number' | 'select' | 'boolean';

interface EffectParameter {
  name: string;
  label: string;
  type: ParameterType;
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean;
  unit?: string;
  options?: { value: string | number; label: string }[];
}

/** The categories the built-in effects use. */
type BuiltInEffectCategory =
  | 'delay'
  | 'reverb'
  | 'modulation'
  | 'distortion'
  | 'filter'
  | 'dynamics'
  | 'spatial'
  | 'wam';

/** The known names, or any other string. */
type EffectCategory = BuiltInEffectCategory | (string & {});

interface EffectDefinition {
  id: string;
  name: string;
  /**
   * The built-in effects use the listed categories and WAM plugins use
   * `'wam'`; a registered custom effect may name any category of its own.
   */
  category: EffectCategory;
  description: string;
  parameters: EffectParameter[];
}

interface EffectInstance {
  /** Where the chain connects into the effect. */
  input: ToneAudioNode | AudioNode;
  /** Where the chain continues from. The same node as `input` for a Tone.js
   *  effect or a WAM plugin; a registered custom effect may have two. */
  output: ToneAudioNode | AudioNode;
  id: string;
  instanceId: string;
  dispose: () => void;
  setParameter: (name: string, value: number | string | boolean) => void;
  getParameter: (name: string) => number | string | boolean | undefined;
  connect: (destination: InputNode) => void;
  disconnect: () => void;
}

interface CustomEffectInstance extends EffectInstance {
  kind: 'custom';
  /** What the registered definition's `create` returned. */
  native: NativeEffectInstance; // from @waveform-playlist/core
}

/**
 * The effects that can be added right now: the built-in effects, followed by
 * every registered custom effect when the app is in native-context mode (a
 * registered effect cannot be added without it). Returns the same array until
 * that set changes, so it is safe to read during render. It is a read, not a
 * subscription: a type registered later appears the next time this is called.
 */
function getAvailableEffects(): EffectDefinition[];

/** Create a registered effect on `audioContext`. The type's `prepare` hook
 *  must already have run on that context (`ensureEffectPrepared` from core). */
function createCustomEffectInstance(
  type: string,
  audioContext: BaseAudioContext,
  params?: Record<string, number | string | boolean>
): CustomEffectInstance;
```

### Effect registry (`@waveform-playlist/core`)

*Shared by `<daw-editor>` and the React effects hooks: one `registerEffect()` call serves both. The registry state lives on `globalThis`, so two installed copies of core share it. `@dawcore/components` no longer exports these; importing it still registers its `native-*` built-ins, each only if that name is not already registered. In React a registered type is added with `addEffect(id)` / `addEffectToTrack(trackId, id)` and requires native-context mode (`configureGlobalContext({ nativeAudioContext: true })`); `prepare` is awaited by `addEffect` on the live context and by WAV export on the offline context. With `<daw-editor>`, call `await editor.prepareEffect(type)` before the synchronous `addEffect()`.*

```typescript
function registerEffect(type: string, definition: NativeEffectDefinition): void;
/** Remove a registered type. Returns whether it was registered. Effects
 *  already created from it keep working. */
function unregisterEffect(type: string): boolean;
/** A copy — mutating the returned map does not affect the registry. */
function getEffectDefinitions(): Map<string, NativeEffectDefinition>;
/** Run a type's `prepare` hook for one context, once. A failed run is retried
 *  by the next call. Resolves immediately without a hook or for unknown types. */
function prepareEffect(type: string, audioContext: BaseAudioContext): Promise<void>;
/** Whether `type` has a prepare hook that has not completed on this context
 *  for its current definition. */
function needsPrepare(type: string, audioContext: BaseAudioContext): boolean;
/** Await a type's preparation until it holds for the definition registered now. */
function ensureEffectPrepared(type: string, audioContext: BaseAudioContext): Promise<void>;
/** Throws for an unknown type. A `create` throw on a context where the type's
 *  `prepare` has not completed is rethrown with a hint (original in `cause`).
 *  An instance whose initial `applyParams` throws is disposed before the
 *  error is rethrown. */
function createEffectInstance(
  type: string,
  audioContext: BaseAudioContext,
  params?: Record<string, number>
): CreatedNativeEffect;

/** Range/display metadata for one effect parameter. */
interface EffectParamDef {
  min: number;
  max: number;
  step?: number;
  /** 's', 'ms', 'Hz', 'dB', '%' … */
  unit?: string;
  /** Display name for a parameter panel. Defaults to the parameter's key. */
  label?: string;
}

/**
 * A live, wired effect. `input`/`output` are the chain attachment points
 * (the same node for single-node effects). `applyParams` updates AudioParams
 * in place — the chain never rebuilds for parameter changes.
 *
 * The host owns every connection OUT of `output`: when it rewires the chain
 * it disconnects all of them. Do not connect `output` to anything inside the
 * effect (a feedback path, say); take such a tap from a node before it.
 */
interface NativeEffectInstance {
  input: AudioNode;
  output: AudioNode;
  applyParams: (params: Record<string, number>) => void;
  dispose?: () => void;
  /** Serializable snapshot of plugin-internal state (WAM getState). */
  getState?: () => Promise<unknown>;
  /** Builds the plugin's own GUI element (WAM createGui). */
  createGui?: () => Promise<HTMLElement>;
  /** Releases a GUI element previously built by `createGui` (WAM destroyGui). */
  destroyGui?: (gui: HTMLElement) => void;
  /** Parameter metadata for the generic fallback panel (WAM getParameterInfo). */
  getParameterInfo?: () => Promise<unknown>;
}

/** A registered effect type. `create` must work on any BaseAudioContext so
 *  the same definitions serve offline rendering. */
interface NativeEffectDefinition {
  label: string;
  category: string;
  defaults: Record<string, number>;
  params: Record<string, EffectParamDef>;
  /** Name of the wet/dry param, when the effect has one. Bypass zeroes it
   *  (storing the original); effects without one are bypassed by disconnection. */
  wetParam?: string;
  /** Optional async setup that must finish before `create` can run on a given
   *  context — typically `audioContext.audioWorklet.addModule(url)`. Runs once
   *  per context, including the OfflineAudioContext of every export. Must be
   *  safe to run more than once on the same context. */
  prepare?: (audioContext: BaseAudioContext) => Promise<void>;
  create: (audioContext: BaseAudioContext, params: Record<string, number>) => NativeEffectInstance;
  /**
   * Set by a host library on the effects of its own catalogue (dawcore's
   * `native-*`), never by an app. A host lists its own catalogue plus what
   * the app registered: the React effect picker leaves these out. The effect
   * can still be added by id anywhere.
   */
  builtIn?: boolean;
}

/** Result of creating an effect via the registry. */
interface CreatedNativeEffect {
  instance: NativeEffectInstance;
  params: Record<string, number>;
  wetParam?: string;
}
```

---

## WAM Plugins (`@dawcore/wam` + native AudioContext mode)

*Native-context management is from `@waveform-playlist/playout`. `WamEffectGui`/`WamEffectInstance` are from `@waveform-playlist/browser/tone`. See the [WAM Plugins guide](/docs/wam-plugins).*

```typescript
interface AudioContextOptions {
  /** Create the global context around a native AudioContext (required for WAM 2.0
   *  hosting). Falls back to the default context on browsers missing AudioListener
   *  AudioParams (Firefox). */
  nativeAudioContext?: boolean;
  sampleRate?: number;
  latencyHint?: AudioContextLatencyCategory | number;
}

function configureGlobalContext(options: AudioContextOptions): number;

/** Whether this browser can run Tone.js on a raw native AudioContext (false on Firefox). */
function supportsNativeContextMode(): boolean;

/** True when the global context wraps a native AudioContext (WAM-capable). */
function isNativeGlobalContext(): boolean;

/** Effects wiring hooks consumed by dawcore's EffectsManager. All hooks require
 *  native-context mode. */
interface ToneEffectsTransport {
  /** Pre-fader track insert: clips → input … output → volume → pan → mute. */
  connectTrackEffects(trackId: string, input: AudioNode, output: AudioNode): void;
  disconnectTrackEffects(trackId: string): void;
  connectMasterOutput(node: AudioNode): void;
  disconnectMasterOutput(): void;
  readonly masterOutputNode: AudioNode;
}

// On ToneAdapter (createToneAdapter() return type):
//   readonly transport: ToneEffectsTransport;
```

```typescript
// From @waveform-playlist/browser/tone

interface WamEffectInstance extends EffectInstance {
  kind: 'wam';
  plugin: WamPluginInstance;   // from @dawcore/wam
  url?: string;
}

interface WamEffectGuiProps {
  /** Live plugin handle from getWamPlugin/getTrackWamPlugin. */
  plugin: WamPluginInstance | undefined;
  className?: string;
}

function loadWamModule(): Promise<typeof import('@dawcore/wam')>;
```

---

## Editing Hooks

### useAnnotationDragHandlers

```typescript
type AnnotationPreviewHandle = ValueSourceHandle<AnnotationData[] | null>; // from @waveform-playlist/core

function useAnnotationDragHandlers(options: {
  annotations: AnnotationData[];
  onAnnotationsChange: (annotations: AnnotationData[]) => void;
  samplesPerPixel: number;
  sampleRate?: number; // default 48000; pass the provider's
  duration: number;
  linkEndpoints: boolean;
  preview?: AnnotationPreviewHandle; // `annotationPreview` from usePlaybackControls() (either provider)
}): {
  onDragStart: (event: DragStartEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
};

// The annotations to draw: the previewed ones while an edge is dragged, else `annotations`.
function useAnnotationsWithPreview(
  annotations: AnnotationData[],
  preview: AnnotationPreviewHandle
): AnnotationData[];
```

With `preview`, each move is published to it (the built-in annotation boxes and list follow it) and `onAnnotationsChange` is called once, on release. Without it, `onAnnotationsChange` is called on every move. Either way a cancelled drag (Escape) restores every annotation the drag moved. `WaveformAnnotationBoxes` calls this hook itself, with the preview, inside its own `DragDropProvider`: call it only for a row of boxes you draw yourself.

### useClipDragHandlers

```typescript
function useClipDragHandlers(options: UseClipDragHandlersOptions): {
  onDragStart: (event: DragStartCallback) => void;
  onDragMove: (event: DragMoveCallback) => void;
  onDragEnd: (event: DragEndCallback) => void;
};

interface UseClipDragHandlersOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  samplesPerPixel: number;
  engineRef: RefObject<PlaylistEngine | null>;
  /** Ref toggled during boundary trim drags. Obtain from useEngineRefs(). */
  isDraggingRef: MutableRefObject<boolean>;
  /** Optional snap function for boundary trims — snaps a sample position to nearest grid line */
  snapSamplePosition?: (samplePos: number) => number;
}
```

Delegates move to `engine.moveClip()` and trim to `engine.trimClip()`. During trim drags, `isDraggingRef` prevents engine rebuild. Cancel is handled inside `onDragEnd` via `event.canceled` — reverts React state for boundary trims, resets `isDraggingRef`. Collision detection is handled separately by `ClipCollisionModifier` (passed to DragDropProvider's `modifiers` prop). The three handlers keep their identity while `tracks` and `onTracksChange` change (they are read through refs); they are re-created only when `samplesPerPixel` or the sample rate changes.

### useDragSensors

```typescript
function useDragSensors(options?: DragSensorOptions): PluginDescriptor[];

interface DragSensorOptions {
  touchOptimized?: boolean; // default false — all pointers use 1px distance activation
  touchDelay?: number; // default 250ms (only when touchOptimized)
  touchTolerance?: number; // default 5px (only when touchOptimized)
  mouseDistance?: number; // default 1px
}
```

Returns configured PointerSensor descriptors for DragDropProvider's `sensors` prop. Default mode uses distance-based activation for all pointer types. Touch-optimized mode uses delay-based activation for touch and distance-based for mouse/pen.

### ClipCollisionModifier

```typescript
class ClipCollisionModifier extends Modifier {
  static configure(options: {
    tracks: ClipTrack[] | (() => ClipTrack[]);
    samplesPerPixel: number;
  }): PluginDescriptor;
}
```

Collision detection modifier for clip moves — constrains horizontal drag to prevent overlapping clips. Passed to DragDropProvider's `modifiers` array alongside `RestrictToHorizontalAxis`. `tracks` may be a function that returns the current tracks (reading a ref, for example): the configured modifier then keeps its identity while tracks change, so a memoised `modifiers` array is not rebuilt on every edit.

### SnapToGridModifier

```typescript
// From @waveform-playlist/ui-components (named `SnapTo` there before #770).
// `SnapTo` of @waveform-playlist/core is another, longer list: the grid values
// of the web components.
type BeatsAndBarsSnapTo = 'bar' | 'beat' | 'off';

type SnapToGridOptions =
  | { mode: 'beats'; snapTo: BeatsAndBarsSnapTo; bpm: number; timeSignature: [number, number]; samplesPerPixel: number; sampleRate: number }
  | { mode: 'timescale'; gridSamples: number; samplesPerPixel: number };

class SnapToGridModifier extends Modifier {
  static configure(options: SnapToGridOptions): PluginDescriptor;
}
```

Snap-to-grid modifier for clip moves. `'beats'` mode quantizes in PPQN tick space; `'timescale'` mode quantizes by `gridSamples`. Snaps the clip's absolute timeline position to the grid (not the drag delta). Skips boundary trims (handled separately by `useClipDragHandlers`). Compose: snap first, then `ClipCollisionModifier` constrains the snapped position.

### useClipSplitting

```typescript
function useClipSplitting(options: UseClipSplittingOptions): UseClipSplittingResult;

interface UseClipSplittingOptions {
  tracks: ClipTrack[];
  samplesPerPixel: number;
  engineRef: RefObject<PlaylistEngine | null>;
}

interface UseClipSplittingResult {
  splitClipAtPlayhead: () => boolean;
  splitClipAt: (trackIndex: number, clipIndex: number, splitTime: number) => boolean;
}
```

Delegates to `engine.splitClip()` — engine handles clip creation, adapter sync, and statechange emission.

---

## MIDI (`@waveform-playlist/midi` + `@dawcore/midi`)

Load and parse MIDI files into `ClipTrack[]` with `midiNotes` for piano roll visualization and SoundFont/PolySynth playback. As of v13, the parser is framework-agnostic and lives in `@dawcore/midi`; `@waveform-playlist/midi` re-exports it and adds the React `useMidiTracks` hook on top.

### useMidiTracks

`configs` is compared by value, so it can be written inline: tracks reload only when a config actually changes. Files are fetched in parallel (a URL shared by several configs once) and tracks keep the config order. If you pass large `midiNotes` arrays, keep each array's identity stable (a constant or `useMemo`); a notes array rebuilt on every render is compared note by note on every render. Treat configs and notes as immutable: mutating one in place does not trigger a reload.

```typescript
function useMidiTracks(configs: MidiTrackConfig[], options: UseMidiTracksOptions): UseMidiTracksReturn;

interface MidiTrackConfig {
  src?: string;                    // URL to .mid file
  midiNotes?: MidiNoteData[];      // Pre-parsed notes (skip fetch+parse)
  name?: string;                   // Track display name
  muted?: boolean;
  soloed?: boolean;
  volume?: number;                 // Default: 1.0
  pan?: number;                    // Default: 0
  color?: string;
  startTime?: number;              // Clip position in seconds (default 0)
  duration?: number;               // Override clip duration in seconds
  flatten?: boolean;               // Merge all MIDI tracks into one (default false)
}

interface UseMidiTracksOptions {
  sampleRate: number;              // Required — pass AudioContext.sampleRate
}

interface UseMidiTracksReturn {
  tracks: ClipTrack[];             // Loaded tracks with midiNotes on clips
  loading: boolean;
  error: string | null;
  loadedCount: number;
  totalCount: number;
}
```

One `MidiTrackConfig` with `src` can produce multiple `ClipTrack` objects (one per MIDI channel in the file). Configs with `midiNotes` produce exactly one track. All tracks are returned at once after loading completes.

### parseMidiFile / parseMidiUrl

Defined in `@dawcore/midi` and re-exported from `@waveform-playlist/midi` for React consumers (no source change needed).

```typescript
function parseMidiFile(data: ArrayBuffer, options?: ParseMidiOptions): ParsedMidi;
function parseMidiUrl(url: string, options?: ParseMidiOptions, signal?: AbortSignal): Promise<ParsedMidi>;

interface ParseMidiOptions {
  flatten?: boolean;               // Merge all tracks into one
}

interface ParsedMidi {
  tracks: ParsedMidiTrack[];
  duration: number;                // Total duration in seconds (0 if no note-bearing tracks)
  name: string;                    // Song name from MIDI header
  bpm: number;                     // First tempo (default 120). Multi-tempo files have N tempo events but this field reports only the first; note timings are tempo-adjusted by @tonejs/midi.
  timeSignature: [number, number]; // Default [4, 4]
}

interface ParsedMidiTrack {
  name: string;                    // Track name
  notes: MidiNoteData[];           // Notes in MidiNoteData format
  duration: number;                // Duration in seconds
  channel: number;                 // MIDI channel (9 = percussion)
  instrument: string;              // GM instrument name
  programNumber: number;           // GM program number (0-127)
}
```

Pure functions — no React, no DOM. `parseMidiFile` takes an `ArrayBuffer`, `parseMidiUrl` fetches then parses. Notes are in seconds (tempo-adjusted by `@tonejs/midi`).

### editor.loadMidi (Web Components, from `@dawcore/components`)

Imperative MIDI loading on `<daw-editor>`. Requires the optional `@dawcore/midi` peer dep — dynamic-imported on first call.

```typescript
loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult>;

interface MidiLoadOptions {
  startTime?: number;                          // Timeline position in seconds applied to every created clip (default 0). Throws RangeError on NaN/negative.
  signal?: AbortSignal;                        // Forwarded to fetch() only. Aborts during the addTrack phase are a no-op.
}

interface MidiLoadResult {
  readonly trackIds: readonly string[];        // IDs of created <daw-track> elements, in MIDI track order
  readonly bpm: number;                        // Tempo from MIDI header (defaults 120)
  readonly timeSignature: readonly [number, number]; // Defaults [4, 4]
  readonly duration: number;                   // Max across tracks; 0 for empty files
  readonly name: string;                       // Song name; empty string when not set
}
```

Created tracks are MIDI tracks (`kind="midi"`), drawn as piano rolls. **Cleanup-on-failure:** any per-track rejection removes every `<daw-track>` appended during the call — both succeeded ones AND elements `addTrack` left in the DOM before rejecting. Editor returns to its pre-call state via `Promise.allSettled` + diff cleanup. If `@dawcore/midi` is not installed, rejects with a friendly install hint and `console.warn`s the original module-resolution error.

---

## Engine (`@waveform-playlist/engine`)

Framework-agnostic timeline engine. Used internally by the browser package provider.

`setTracks(tracks)`, `addTrack(track)` and `updateTrack(id, track)` throw an `Error` when a track's clips are not all of its `kind` (see `ClipTrack` under Data Types). The check runs before any state changes: no undo step, no adapter call.

```typescript
import { PlaylistEngine } from '@waveform-playlist/engine';
import type { EngineState, PlayoutAdapter, EngineEvents, PlaylistEngineOptions } from '@waveform-playlist/engine';

interface PlaylistEngineOptions {
  adapter?: PlayoutAdapter;
  sampleRate?: number;          // Default: 48000 (use AudioContext.sampleRate for hardware rate)
  samplesPerPixel?: number;     // Default: 1000
  zoomLevels?: number[];        // Default: [256, 512, 1024, 2048, 4096, 8192]
}

interface EngineState {
  tracks: ClipTrack[];
  tracksVersion: number;        // Monotonic counter; increments on structural track mutations only
  mixerVersion: number;         // Monotonic counter; increments on per-track mixer edits (volume/mute/solo/pan)
  duration: number;
  currentTime: number;
  isPlaying: boolean;
  samplesPerPixel: number;
  sampleRate: number;
  selectedTrackId: string | null;
  zoomIndex: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  selectionStart: number;       // Guaranteed: selectionStart <= selectionEnd
  selectionEnd: number;
  masterVolume: number;         // 0.0–1.0
  loopStart: number;            // Guaranteed: loopStart <= loopEnd
  loopEnd: number;
  isLoopEnabled: boolean;
}

// Key methods on PlaylistEngine:
// Track management: setTracks(), addTrack(), removeTrack(), selectTrack()
// Clip editing: moveClip(), trimClip(), splitClip()
// Playback: play(), pause(), stop(), seek()
// State: setSelection(), setLoopRegion(), setLoopEnabled(), setMasterVolume()
// Zoom: zoomIn(), zoomOut(), setZoomLevel()
// Events: on(event, listener), off(event, listener)
// Lifecycle: dispose()

// Pure operations (also exported for use without PlaylistEngine):
import { constrainClipDrag, constrainBoundaryTrim, canSplitAt, splitClip, calculateSplitPoint } from '@waveform-playlist/engine';
import { calculateDuration, clampSeekPosition, findClosestZoomIndex } from '@waveform-playlist/engine';
```

---

## Recording (`@waveform-playlist/recording`)

### Value sources (`@waveform-playlist/core`)

Meter levels and recording progress change about 60 times a second. The hooks
return them as a source, not as React state, so the component that calls the
hook does not re-render when they change.

```typescript
interface ValueSource<T> {
  /** Call listener with each new value. Returns the unsubscribe function. */
  subscribe(listener: (value: T) => void): () => void;
  /** The latest value. The same object is returned until the next change. */
  getSnapshot(): T;
}

interface MeterLevels {
  levels: number[];       // Per-channel smoothed peak levels (0-1)
  peakLevels: number[];   // Per-channel held peak levels since the last reset (0-1)
  rmsLevels: number[];    // Per-channel RMS levels (0-1)
}
type MeterSource = ValueSource<MeterLevels>;

interface RecordingProgress {
  duration: number;                   // Elapsed recording time in seconds
  peaks: (Int8Array | Int16Array)[];  // Per-channel min/max peak pairs for the live preview
}
type RecordingProgressSource = ValueSource<RecordingProgress>;
```

Ways to read a source:

```typescript
// 1. Hand it to a component that draws it: no re-render of your component.
<SegmentedVUMeter meter={meter} />
<WaveformRecordingPreview recordingState={{ isRecording: true, trackId, startSample, progress, bits: 16 }} /> // a child of <WaveformTracks>

// 2. Throttled React state (default 10 updates per second).
import { useMeterLevels, useThrottledValue } from '@waveform-playlist/ui-components';
import { useRecordingProgress } from '@waveform-playlist/recording';

function useThrottledValue<T>(source: ValueSource<T>, options?: { updateRate?: number }): T;
function useMeterLevels(meter: MeterSource, options?: { updateRate?: number }): MeterLevels;
function useRecordingProgress(
  progress: RecordingProgressSource,
  options?: { updateRate?: number }
): RecordingProgress;

// 3. Full-rate React state.
const { levels } = useSyncExternalStore(meter.subscribe, meter.getSnapshot);

// 4. Direct DOM or canvas drawing.
useEffect(() => meter.subscribe(({ levels }) => draw(levels)), [meter]);
```

### useIntegratedRecording

```typescript
function useIntegratedRecording(
  tracks: ClipTrack[],
  setTracks: (tracks: ClipTrack[]) => void,
  selectedTrackId: string | null,
  options?: IntegratedRecordingOptions
): UseIntegratedRecordingReturn;

interface IntegratedRecordingOptions {
  /** Current playback/cursor position in seconds. Punch-in semantics: the
   *  recorded clip lands exactly at this position and REPLACES any existing
   *  clip content it overlaps (partial overlaps trimmed, covered clips
   *  removed, spanning clips split). */
  currentTime?: number;
  audioConstraints?: MediaTrackConstraints;
  channelCount?: number;      // Default: 1 (auto-detected from stream; fallback)
  samplesPerPixel?: number;   // Default: 1024
  bits?: 8 | 16;             // Default: 16
  /** Latency to skip at the start of the recording, in seconds.
   *  Absolute replacement for the auto-computed outputLatency+lookAhead value.
   *  0 disables compensation; negative/non-finite treated as 0.
   *  Pass the same value to the preview's recordingState.latencyOffset so the live preview matches the finalized clip. */
  latencyOffset?: number;
}

interface UseIntegratedRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  /** The track the current take will be added to: the one selected when
   *  startRecording() was called. The target cannot be switched mid-take.
   *  null whenever isRecording is false. Use it for recordingState.trackId. */
  recordingTrackId: string | null;
  /** Live microphone levels. Stable identity; the hook does not re-render as
   *  they change. Array length = metered channel count. */
  meter: MeterSource;
  /** Elapsed time and live-preview peaks of the take. Stable identity; the
   *  hook does not re-render as they change. Pass to <WaveformRecordingPreview recordingState>. */
  progress: RecordingProgressSource;
  error: Error | null;
  stream: MediaStream | null;
  devices: MicrophoneDevice[];
  hasPermission: boolean;
  selectedDevice: string | null;
  /** Resolves true when the capture pipeline actually started — check before
   *  starting synchronized playback (overdub). */
  startRecording: () => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  requestMicAccess: () => Promise<void>;   // Refused while recording (would record silence)
  changeDevice: (deviceId: string) => Promise<void>; // Refused while recording
}
```

### useRecording

```typescript
function useRecording(stream: MediaStream | null, options?: RecordingOptions): UseRecordingReturn;

interface UseRecordingReturn {
  isRecording: boolean;
  isPaused: boolean;
  /** Elapsed time and live-preview peaks, published once per animation frame
   *  while recording. After a stop, duration is the recorded buffer's length;
   *  the next start resets both. */
  progress: RecordingProgressSource;
  audioBuffer: AudioBuffer | null;
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<AudioBuffer | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  error: Error | null;
}
```

### RecordingOptions (`@dawcore/components`)

Options for `editor.startRecording(stream?, options?)` on `<daw-editor>`:

```typescript
interface RecordingOptions {
  trackId?: string;
  bits?: 8 | 16;
  /** Fallback channel count when stream doesn't report one via getSettings(). Must be 1 or 2. */
  channelCount?: 1 | 2;
  startSample?: number;
  /** Start playback during recording so user hears existing tracks. */
  overdub?: boolean;
  /** Latency to skip at the start of the recording, in seconds.
   *  Absolute replacement for the auto-computed outputLatency-based value.
   *  0 disables compensation; negative/non-finite treated as 0.
   *  When omitted, the auto-computed outputLatency value is used. */
  latencyOffset?: number;
  /** Display name for the take: shown in the live-preview clip header while
   *  recording (falls back to "Recording…") and used as the finalized clip's
   *  name (falls back to "Recording"). */
  clipName?: string;
}
```

### useMicrophoneLevel

```typescript
function useMicrophoneLevel(
  stream: MediaStream | null,
  options?: {
    channelCount?: number;  // Default: 1
    updateRate?: number;    // Default: 60
  }
): UseMicrophoneLevelReturn;

interface UseMicrophoneLevelReturn {
  /** Live levels. Stable identity; the hook does not re-render as they change.
   *  Array length = detected mic channels (mono repeated up to channelCount). */
  meter: MeterSource;
  resetPeak: () => void;  // Reset held peaks
  error: Error | null;    // Meter setup error; cleared on successful re-setup
}
```

### enumerateMicrophones (`@waveform-playlist/core`)

Framework-agnostic, permission-free microphone listing — usable without React (dawcore/vanilla consumers):

```typescript
function enumerateMicrophones(mediaDevices?: MediaDevices): Promise<MicrophoneEnumeration>;
function watchMicrophoneDevices(
  listener: (enumeration: MicrophoneEnumeration) => void,
  mediaDevices?: MediaDevices
): () => void; // returns unsubscribe; fires immediately + on every devicechange

interface MicrophoneEnumeration {
  supported: boolean;   // false on SSR/insecure contexts (no navigator.mediaDevices)
  hasLabels: boolean;   // false pre-permission — browsers redact labels (and often deviceIds)
  devices: MicrophoneDeviceInfo[]; // fallback labels generated when redacted
}

interface MicrophoneDeviceInfo {
  deviceId: string;
  label: string;
  groupId: string;
}
```

### useOutputMeter

*From `@waveform-playlist/browser/tone`*

```typescript
function useOutputMeter(options?: UseOutputMeterOptions): UseOutputMeterReturn;

interface UseOutputMeterOptions {
  channelCount?: number;   // Default: 2
  updateRate?: number;     // Default: 60
  isPlaying?: boolean;     // Reset levels when false
}

interface UseOutputMeterReturn {
  /** Live output levels, one entry per channel. Stable identity; the hook
   *  does not re-render as they change. */
  meter: MeterSource;
  resetPeak: () => void;  // Reset all peak hold indicators
  error: Error | null;    // Meter setup error
}
```

### SegmentedVUMeter

```typescript
interface ColorStop {
  dB: number;
  color: string;
}

interface SegmentedVUMeterProps {
  /** A live meter (useOutputMeter().meter, useMicrophoneLevel().meter). The
   *  component draws each value straight to the DOM and does not re-render
   *  for it. Takes precedence over levels / peakLevels. */
  meter?: MeterSource;
  /** Per-channel levels (0-1) for a meter driven by props. */
  levels?: number[];
  peakLevels?: number[];
  channelLabels?: string[];
  orientation?: 'vertical' | 'horizontal';
  segmentCount?: number;
  dBRange?: [number, number];
  showScale?: boolean;
  colorStops?: ColorStop[];
  segmentWidth?: number;
  segmentHeight?: number;
  segmentGap?: number;
  coloredInactive?: boolean;
  labelColor?: string;
  className?: string;
}
```

---

## Export

*From `@waveform-playlist/browser/tone`*

### useExportWav

```typescript
function useExportWav(): UseExportWavReturn;

interface UseExportWavReturn {
  exportWav: (tracks: ClipTrack[], trackStates: TrackState[], options?: ExportOptions) => Promise<ExportResult>;
  isExporting: boolean;
  progress: number;
  error: string | null;
}

/** Cleanup returned by an offline effects function (disposes offline instances / WAM clones). */
type OfflineEffectsCleanup = void | (() => void);

/** Master-chain effects function for offline rendering. May return a Promise —
 *  WAM entries are re-instantiated asynchronously on the offline context. Every
 *  live EffectsFunction is assignable to this type. */
type OfflineEffectsFunction = (
  masterVolume: Volume,
  destination: ToneAudioNode,
  isOffline: boolean
) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;

/** Per-track variant of OfflineEffectsFunction. Pre-fader: wire trackInput
 *  through the effects into faderInput (the track's volume stage). */
type OfflineTrackEffectsFunction = (
  trackInput: Gain,
  faderInput: ToneAudioNode,
  isOffline: boolean
) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;

interface ExportOptions {
  filename?: string;
  mode?: 'master' | 'individual';
  trackIndex?: number;
  autoDownload?: boolean;
  applyEffects?: boolean;        // Default: true
  effectsFunction?: OfflineEffectsFunction;
  createOfflineTrackEffects?: (trackId: string) => OfflineTrackEffectsFunction | undefined;
  onProgress?: (progress: number) => void;
  bitDepth?: 16 | 32;
}

interface ExportResult {
  audioBuffer: AudioBuffer;
  blob: Blob;
  duration: number;
}
```

---

## Keyboard Shortcuts

```typescript
function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void;

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

interface KeyboardShortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  action: () => void;
  description?: string;
  preventDefault?: boolean;
}

function usePlaybackShortcuts(options?: UsePlaybackShortcutsOptions): UsePlaybackShortcutsReturn;
// WaveformPlaylistProvider only: throws when the nearest playlist provider is MediaElementPlaylistProvider.
// Default shortcuts: Space (play/pause), Escape (stop), 0 (rewind: seekTo(0))
// Space starts playback exactly as <PlayButton> does: the highlighted selection (looping off), else from the cursor.
// With the cursor inside the selection (e.g. paused there) both resume from the cursor to the selection's end.
// setSelection(start, end) during playback: a range restarts and plays start -> end; a collapsed selection continues open-ended.
// Pointer on the waveform during playback: nothing before the release. Automatic scroll off: a drag is previewed, then becomes the selection (played);
// a click seeks to the press. Automatic scroll on: press + release = one seek to the press, no range.
// A shortcut is skipped when the focused control uses the key itself, however it got focus:
//   - input (every type, incl. range and checkbox), textarea, select, contenteditable: every key
//   - Escape while a modal <dialog> or [aria-modal="true"] is open
//   - Space / Enter on a focused <button> or <summary>; Enter (not Space) on a focused <a href>
//   - while an input/select/textarea has focus NO shortcut fires (incl. undo, split)
//   - so after clicking Mute, Space toggles Mute again; Space is play/pause when focus is not on a control
//   - elements with only an ARIA role (<div role="button">) are NOT covered
```

---

## The View: Roots, Parts, Ready-Made Compositions

The view is composed. A part is drawn because it is rendered inside a root; there are no props that switch a part on. All names are exported from `@waveform-playlist/browser`. Guide: [Composing the View](./react/guides/composing-the-view.md). Coming from the props that used to switch the parts: [upgrade guide](./react/upgrading.md#the-view-is-composed-from-parts-the-show-and-render-props-and-the-providers-timescale-and-controls-are-removed).

```tsx
// What <Waveform /> renders (WaveformPlaylistProvider):
<WaveformRoot className={className}>
  <WaveformTimescale />
  <WaveformLoopRegion />
  <WaveformTrackControls />          {/* a 200 px column */}
  <WaveformTracks />
  <WaveformAnnotationBoxes />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
<AnnotationList />                   {/* draws nothing while there are no annotations */}

// <WaveformEditor />: the same, with
<WaveformTracks>
  <WaveformClipHeaders />
  <WaveformFades />
</WaveformTracks>

// What <MediaElementWaveform /> renders (MediaElementPlaylistProvider):
<MediaElementWaveformRoot className={className}>
  <WaveformTimescale />
  <WaveformTracks />
  <WaveformAnnotationBoxes />
  <WaveformSelection />
  <WaveformPlayhead />
</MediaElementWaveformRoot>
<AnnotationList />
```

```typescript
// The ready-made compositions take className only.
interface WaveformProps {
  className?: string;
}
type WaveformEditorProps = WaveformProps;

interface MediaElementWaveformProps {
  className?: string;
}

// Roots. WaveformRoot: WaveformPlaylistProvider. MediaElementWaveformRoot: MediaElementPlaylistProvider.
interface WaveformRootProps {
  className?: string;
  /** The parts, and anything else to draw over the tracks. */
  children?: ReactNode;
}
interface MediaElementWaveformRootProps {
  className?: string;
  /** The parts, and anything else to draw over the track. */
  children?: ReactNode;
}

// Parts.
interface WaveformTimescaleProps {
  /** Custom tick label. `label` is already formatted for the scale mode:
   *  "m:ss" in the temporal scale, bar.beat (e.g. "2.3") in beats mode. There is no renderTimestamp. */
  renderTick?: (label: string, pixelPosition: number) => ReactNode;
  /**
   * Height in pixels of the timescale strip. The root reads it from the
   * element, as it reads the width of the controls part: the strip is the
   * root's own, above the scrolling area. Default: 30
   */
  height?: number;
}
// A height that is not a positive number: 30 is drawn, one development warning. The first
// WaveformTimescale among the root's children decides; a strip with only a WaveformLoopRegion is 30.
// WaveformLoopRegion: no props. WaveformPlaylistProvider only.

interface WaveformTrackControlsProps {   // WaveformPlaylistProvider only
  /** Width of the controls column in pixels. Default 200. The root reads it
   *  from the element, so it must be on the part itself. */
  width?: number;
  /** The control panel of a track, as a template: it is rendered once per
   *  track, inside that track's context, which `useTrack()` and the built-in
   *  pieces (`<TrackName />`, `<TrackMuteButton />`, …) read. Default:
   *  `<DefaultTrackControls />`. */
  children?: ReactNode;
}
// Removed (#687): renderTrackControls, onRemoveTrack, trackReordering, SortableTrackControls.

// The control panel of a track. Everything below works ONLY among the children of
// <WaveformTrackControls>; elsewhere useTrack() (and so every piece) throws
// "useTrack must be used within <WaveformTrackControls>…".

/** What `useTrack()` returns: one track's identity, mixer state and bound actions. */
interface TrackContextValue {
  /** The track's id. */
  id: string;
  /** `'audio'` or `'midi'`. */
  kind: TrackKind;
  /** The track's position in the list of tracks, from 0. Changes on a reorder. */
  index: number;

  /** The track's name, or "Track N" (N is the position, from 1) when it has none. */
  name: string;
  muted: boolean;
  soloed: boolean;
  /** 0 to 1. */
  volume: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  /** How the track is drawn. Always `'waveform'` for a MIDI track. */
  renderMode: RenderMode;

  /** True while the provider has no mixer state for the track (it is still
   *  loading): the engine does not know it yet, so a value set with the mixer
   *  actions is not kept and a reorder does nothing. The built-in pieces are
   *  disabled then.
   *  muted/soloed/volume/pan read false/false/1/0 and name "Track N". */
  isLoading: boolean;
  /** Whether this is the selected track. */
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  /** True for an audio track under a `<SpectrogramProvider>`: `setRenderMode`
   *  and `openSpectrogramSettings` then do something. */
  hasSpectrogram: boolean;

  // Actions. Each keeps its identity while the track's slot is mounted and a
  // track menu neither becomes available nor stops being so.
  setMuted: (muted: boolean) => void;
  setSoloed: (soloed: boolean) => void;
  setVolume: (volume: number) => void;
  setPan: (pan: number) => void;
  /** Makes this the selected track. */
  select: () => void;
  /** Moves the track one position up. Nothing happens for the first track. */
  moveUp: () => void;
  /** Moves the track one position down. Nothing happens for the last track. */
  moveDown: () => void;
  /** Nothing happens without a `<SpectrogramProvider>`. */
  setRenderMode: (mode: RenderMode) => void;
  /** Opens the spectrogram settings of this track. Nothing happens without a `<SpectrogramProvider>`. */
  openSpectrogramSettings: () => void;
}
function useTrack(): TrackContextValue;

/** The default panel: name, track menu, mute, solo, volume, pan. No remove
 *  button and no reorder grip. */
interface DefaultTrackControlsProps {
  /** Drawn inside the panel, below the pan slider. */
  children?: ReactNode;
}

// Pieces without props, each bound to the track whose panel it is rendered in:
//   TrackName          the name on one line ("Track N" without one); attribute data-track-name
//   TrackMuteButton    "Mute", aria-pressed; disabled while the track is loading
//   TrackSoloButton    "Solo", aria-pressed; disabled while the track is loading
//   TrackVolumeSlider  0 to 1, aria-label "Volume"; disabled while loading
//   TrackPanSlider     -1 to 1, aria-label "Pan"; disabled while loading
//   TrackMenuButton    render mode + spectrogram settings; draws nothing without a
//                      SpectrogramProvider and nothing for a MIDI track
//   TrackReorderGrip   drag grip + move up/down buttons; buttons work with no setup, the
//                      drag needs ClipInteractionProvider; attribute data-track-reorder-grip

interface TrackRemoveButtonProps {
  /** Called with the track's id. Removing the track from your `tracks` is yours to do. */
  onRemove: (trackId: string) => void;
}

/** `useTrackReorderHandle()`: for a drag grip of your own. Once per panel. */
interface TrackReorderHandle {
  /** Attach to the element the track is dragged by (a grip). */
  handleRef: (element: Element | null) => void;
  /** True while this track is the one being dragged. */
  isDragSource: boolean;
}
function useTrackReorderHandle(): TrackReorderHandle;

// Placement and cost:
// - Each track has a slot in the column: as wide as the column, as tall as the track's
//   row, overflow hidden. A custom panel fills it with height: 100%. The element inside
//   the slot that holds the panel has data-track-controls="<track id>"; it is the element
//   a reorder drag moves.
// - A click anywhere in a slot selects the track. TrackRemoveButton, the button of
//   TrackMenuButton and the grip and buttons of TrackReorderGrip do not select; a
//   render-mode choice in the open track menu does.
// - Children that are false, 0 or '' draw empty panels; only null and undefined mean
//   "the default panel". One reorder handle per panel.
// - TrackRemoveButton places itself at the slot's top left, TrackReorderGrip at its right
//   edge (the default panel makes room for the grip). DefaultTrackControls fills the
//   slot: an element rendered BESIDE it in the flow is outside the visible slot, so a
//   control of your own goes INSIDE, as a child of <DefaultTrackControls>.
// - The part keeps its previous children while the new ones are equal (element types,
//   keys, props by Object.is; `children` recursively; `style` one level deep). Inline
//   children cost nothing while their props are stable; an inline function or object as
//   a prop renders every panel on each render of the composing component.
//
//   <WaveformTrackControls width={180}>
//     <DefaultTrackControls />
//     <TrackRemoveButton onRemove={removeTrack} />   // removeTrack(trackId), stable
//     <TrackReorderGrip />
//   </WaveformTrackControls>

interface WaveformTracksProps {
  /** Draw each clip's waveform scaled by its gain (clamped). Default: false. */
  gainScaled?: boolean;
  /** `WaveformClipHeaders`, `WaveformFades`, `WaveformRecordingPreview`: markers that
   *  switch a per-clip part on. Nothing else is rendered from here. */
  children?: ReactNode;
}
// WaveformClipHeaders, WaveformFades: no props. Children of WaveformTracks only.

interface WaveformRecordingPreviewProps {   // child of WaveformTracks; WaveformPlaylistProvider only
  recordingState: WaveformRecordingState;
}
/** Live recording state for the real-time waveform preview. */
interface WaveformRecordingState {
  isRecording: boolean;
  /** Which track is being recorded into. */
  trackId: string;
  /** Where on the timeline the take started. */
  startSample: number;
  /** The take's elapsed time and per-channel preview peaks, from
   *  useRecording / useIntegratedRecording. Only the preview clip follows
   *  it frame by frame. */
  progress: RecordingProgressSource;
  /** Bit depth of the peak values. */
  bits: 8 | 16;
  /** Latency to skip in the live preview, in seconds. Pass the same value given to
   *  useIntegratedRecording so preview and finalized clip match. Omit for the auto-computed value. */
  latencyOffset?: number;
}

interface WaveformAnnotationBoxesProps {   // either provider
  /**
   * The label of a box, from the annotation and its index. Default: the
   * annotation's id. Pass a function that keeps its identity (defined outside
   * the component, or memoized): a new one renders every box.
   */
  getLabel?: GetAnnotationBoxLabelFn;
  /** Height of the row in pixels. Default: 30. */
  height?: number;
}
type GetAnnotationBoxLabelFn = (annotation: AnnotationData, index: number) => string;

// Not a part: the annotation text list, anywhere under either provider.
interface AnnotationListProps {
  /** Height of the list in pixels. Without it the list is at most 200 px high. */
  height?: number;
  /**
   * Buttons shown on each row while the provider's `editable` option is on
   * (delete, split, …). An action is called with the annotation, its index,
   * the annotations and `{ linkEndpoints, continuousPlay }` as the provider
   * has them. Pass an array that keeps its identity: a new one renders every
   * row.
   */
  actions?: AnnotationAction[];
  /**
   * Where the active annotation is put when the list scrolls to it during
   * playback, or `'none'` for a list that does not follow. Default: `'center'`.
   */
  scrollActivePosition?: ScrollLogicalPosition | 'none';
  /** Which containers scroll: only the list (`'nearest'`), or the page too (`'all'`). Default: `'nearest'`. */
  scrollActiveContainer?: 'nearest' | 'all';
  /**
   * Draws a row, in place of the default one: called with
   * `{ annotation, index, isActive, onClick, formatTime }`. Define the
   * function outside the component (or memoize it): one written inline is a
   * new function on every render of your component and renders every row.
   */
  children?: (item: RenderAnnotationItemProps) => React.ReactNode;
}

// From @waveform-playlist/core:
interface AnnotationActionOptions {
  /** Whether annotation endpoints are linked (moving one endpoint moves the other) */
  linkEndpoints?: boolean;
  /** Whether to continue playing after an annotation ends */
  continuousPlay?: boolean;
  /** Additional custom properties */
  [key: string]: unknown;
}
interface AnnotationAction {
  class?: string;
  text?: string;
  title: string;
  action: (
    annotation: AnnotationData,
    index: number,
    annotations: AnnotationData[],
    opts: AnnotationActionOptions
  ) => void;
}
interface RenderAnnotationItemProps {
  annotation: AnnotationData;
  index: number;
  isActive: boolean;
  onClick: () => void;
  formatTime: (seconds: number) => string;
}
// WaveformSelection: no props. Either provider.
interface WaveformPlayheadProps {   // either provider
  /** Custom playhead render function. Receives position (pixels) and color from theme. */
  renderPlayhead?: RenderPlayheadFunction;
}

// The view only draws a take. This tells the provider one is running
// (WaveformPlaylistProvider only): playback runs past the end of the audio and
// the armed track's existing content is muted for the take.
function useRecordingSession(options: RecordingSessionOptions): void;
interface RecordingSessionOptions {
  /** True while a take is being recorded. */
  isRecording: boolean;
  /** The track being recorded into, or null when there is none. */
  trackId: string | null | undefined;
}
```

Rules:

- A part must be a child of its root (a fragment is fine). A part wrapped in your own component is not recognised: a wrapped `WaveformTimescale` / `WaveformTrackControls` is drawn among the tracks, a wrapped `WaveformClipHeaders` does nothing. Development builds warn once in the console (`[waveform-playlist] …`); nothing throws for this.
- `WaveformClipHeaders`, `WaveformFades`, `WaveformRecordingPreview` are children of `WaveformTracks` and draw nothing elsewhere. One `WaveformTracks` per root, as the root's own child.
- The timescale strip (30 px, or the `height` of the first `WaveformTimescale`) exists when the root has a `WaveformTimescale` or a `WaveformLoopRegion`; the controls column exists when it has a `WaveformTrackControls`.
- A child of a root that is not a part is drawn in the scrolling tracks area, in order.
- Under `MediaElementPlaylistProvider`: `WaveformLoopRegion` throws, `WaveformTrackControls` draws nothing as a child of the root (wrapped in a component it throws), `WaveformClipHeaders` shows the track's `name` ("Track" without one) and nothing supports dragging the clip.
- `WaveformTimescale`, `WaveformLoopRegion`, `WaveformTrackControls`, `WaveformTracks` and `WaveformAnnotationBoxes` throw outside a root. `WaveformSelection` and `WaveformPlayhead` draw wherever they are rendered under a provider.
- Switch a part with `{flag ? <Part /> : null}`; a list of changing length remounts later parts unless they have keys.
- The time ruler and the controls column are not provider props and not in `usePlaylistView()`: they exist when their parts are rendered.

### View options

Row height, bar style, playhead width and the filled layout are set with `<WaveformViewOptions>` (`@waveform-playlist/browser`), for every root below it, under either provider. It may sit above the provider and above several providers. The roots, the parts, the ready-made compositions and the providers take none of these options. Upgrade entry: [view options](./react/upgrading.md#the-options-that-only-affect-how-a-view-draws-are-waveformviewoptions-they-leave-the-providers).

```typescript
// packages/browser/src/components/WaveformViewOptions.tsx
interface WaveformViewOptionsProps {
  /** Height in pixels of one channel of a track. Default: 80 */
  waveHeight?: number;
  /** Width in pixels of a waveform bar. Default: 1 */
  barWidth?: number;
  /** Space in pixels between two bars. Default: 0 */
  barGap?: number;
  /** Draw bars with rounded caps (radius `barWidth / 2`). Default: false */
  roundedBars?: boolean;
  /** Width in pixels of the playhead line. Default: `barWidth + barGap` */
  progressBarWidth?: number;
  /**
   * Draw the timeline at least as wide as its scroll container when the audio
   * is shorter. `WaveformRoot` only: a MediaElement timeline is as long as
   * its audio. Default: false
   */
  fillViewport?: boolean;
  children?: ReactNode;
}
```

```tsx
<WaveformViewOptions waveHeight={100} barWidth={2} barGap={1}>
  <MediaElementPlaylistProvider track={a}><MediaElementWaveform /></MediaElementPlaylistProvider>
  <MediaElementPlaylistProvider track={b}><MediaElementWaveform /></MediaElementPlaylistProvider>
</WaveformViewOptions>
```

- A prop left out is inherited from the `<WaveformViewOptions>` above (`??`, so `0` and `false` are values), then from the defaults. A nested one cannot return an option to its default: write the value (`progressBarWidth={7}` outside and `barWidth={4}` inside leaves the playhead 7 px).
- It goes ABOVE a root. A root reads the options above itself, so one written among a root's children does nothing for that root, the parts inside it are not recognised, and a development build warns once.
- Corrected by the root, one development warning per message: `waveHeight` or `barWidth` not above 0 becomes the default; a `barGap` that is `NaN` becomes 0; a `barGap` that makes `barWidth + barGap` less than 1 becomes `1 - barWidth`; a `progressBarWidth` not above 0 becomes `barWidth + barGap` (leave `<WaveformPlayhead>` out to draw no playhead). `null` means not given.
- Inside a root, the resolved values are read with `usePlaylistInfo()` from `@waveform-playlist/ui-components`. `fillViewport` has no reader.
- Two roots under one provider share zoom, selection and playback and may differ in view options. Limits (issue #803): automatic scroll moves only the root mounted last; a spectrogram track is drawn in only one of them. Another zoom level: under `MediaElementPlaylistProvider`, another provider (each is independent); under `WaveformPlaylistProvider` with the default Tone.js engine, not available by adding a provider (one instance per page, shared Tone.js transport; issue #805).

```typescript
// packages/ui-components/src/contexts/PlaylistInfo.tsx
type PlaylistInfo = {
  sampleRate: number;
  samplesPerPixel: number;
  /** Height in pixels of one channel. Default: 80 */
  waveHeight: number;
  /** Height in pixels of the timescale strip; 0 when there is none. */
  timeScaleHeight: number;
  /** Width in pixels of waveform bars. Default: 1 */
  barWidth: number;
  /** Spacing in pixels between waveform bars. Default: 0 */
  barGap: number;
  /** Draw bars with pill-shaped rounded caps (radius barWidth/2). Default: false */
  roundedBars: boolean;
  /** Width in pixels of the playhead line. Default: barWidth + barGap. */
  progressBarWidth: number;
};
const usePlaylistInfo: () => PlaylistInfo;      // use(PlaylistInfoContext)
const DEFAULT_WAVE_HEIGHT = 80;
const DEFAULT_BAR_WIDTH = 1;
const DEFAULT_BAR_GAP = 0;
// Without a root above, PlaylistInfoContext's default applies: sampleRate 48000,
// samplesPerPixel 1000, waveHeight 80, timeScaleHeight 15, barWidth 1, barGap 0,
// roundedBars false, progressBarWidth 1.
// Removed (#689): controls, zoomLevels. A <PlaylistInfoContext value={…}> of your own must give this shape.
// Theme key spectrogramBackgroundColor (optional, '#000' without it): the background of the area a
// spectrogram is drawn in; it shows until the spectrogram has been drawn and where a chunk is not mounted.
```

---

## Pre-built Components

```
Under either provider (from @waveform-playlist/browser):
         PlayButton, PauseButton, StopButton, RewindButton, FastForwardButton,
         SkipBackwardButton, SkipForwardButton, ClearAllButton,
         AudioPosition, TimeFormatSelect, SelectionTimeInputs, AutomaticScrollCheckbox,
         AnnotationList (draws nothing without <AnnotationProvider>)
Under either provider (from @waveform-playlist/annotations; no <AnnotationProvider> needed,
a playlist provider is; NOT exported by @waveform-playlist/browser since #770):
         ContinuousPlayCheckbox, LinkEndpointsCheckbox, EditableCheckbox
           props { className?, disabled?, children? }  (children = the label; type AnnotationCheckboxProps)
         DownloadAnnotationsButton
           props { filename?, disabled?, className?, children?, title? }  (children = the label,
           default "Download JSON"; filename default "annotations.json"; title = the tooltip,
           default one of two English sentences)
         Every string the four draw can be supplied: children on all four, title on the button.
         They read useAnnotationOptions() / usePlaybackControls() / useAnnotations() and have no
         controlled form: `checked`, `onChange` and `annotations` props are ignored.
MediaElementPlaylistProvider only (from @waveform-playlist/browser):
         PlaybackRateSelect
WaveformPlaylistProvider only (from @waveform-playlist/browser):
         LoopButton, SetLoopRegionButton, ZoomInButton, ZoomOutButton, MasterVolumeControl,
         KeyboardShortcuts
WaveformPlaylistProvider only (from @waveform-playlist/browser/tone):
         ExportWavButton
Playheads: Playhead, PlayheadWithMarker (from @waveform-playlist/ui-components)
           both take PlayheadProps; see "Custom playhead" below
Error Handling: PlaylistErrorBoundary (from @waveform-playlist/ui-components)
```

### Custom playhead

```typescript
// from @waveform-playlist/ui-components. The same seven props under
// WaveformPlaylistProvider and MediaElementPlaylistProvider.
interface PlayheadProps {
  position: number; // px from the left edge; valid while not playing
  color?: string; // theme.playheadColor
  isPlaying: boolean;
  currentTimeRef: React.RefObject<number>; // raw position, seconds
  // Time to draw at, seconds; kept current per frame of playback and on a
  // seek, a stop and the end of playback. MediaElement: the same ref as
  // currentTimeRef (after a pause: the last reported time).
  visualTimeRef: React.RefObject<number>;
  samplesPerPixel: number; // x = (time * sampleRate) / samplesPerPixel
  sampleRate: number;
}
type RenderPlayheadFunction = (props: PlayheadProps) => React.ReactNode;
// <WaveformPlayhead renderPlayhead={PlayheadWithMarker} />   (under either provider's root)
// <WaveformPlayhead renderPlayhead={(props) => <PlayheadWithMarker {...props} />} />
```

Removed from `PlayheadProps`: `getPlaybackTime`, `getAudioContextTime`, `playbackStartTimeRef`, `audioStartPositionRef` (call `useEngineRefs()` in the playhead, `WaveformPlaylistProvider` only) and `controlsOffset` (always 0). The props are a plain object: a removed name reads `undefined`. The playhead (default or custom) is not rendered while a range is highlighted and playback is stopped or paused, under either provider; a custom playhead is unmounted while hidden. `PlayheadWithMarker` rendered by your own code needs `visualTimeRef`.

```typescript
// @waveform-playlist/browser: reads usePlaybackRate(). MediaElementPlaylistProvider only.
const PlaybackRateSelect: React.FC<{ rates?: readonly number[]; className?: string }>;

// @waveform-playlist/ui-components: the base component, driven by props.
const DEFAULT_PLAYBACK_RATES: readonly number[]; // [0.5, 0.75, 1, 1.25, 1.5, 2]
interface PlaybackRateSelectProps {
  /** The current speed, where 1 is normal. */
  value: number;
  onChange: (rate: number) => void;
  /** The speeds to offer, in the order to list them. */
  rates?: readonly number[];
  disabled?: boolean;
  className?: string;
}
// A native <select> with aria-label="Playback speed". A current speed that is not
// among `rates` is listed as an extra option.

// StopButton is disabled unless playing. RewindButton / FastForwardButton /
// SkipBackwardButton / SkipForwardButton call seekTo only: seekTo(0), seekTo(Infinity),
// seekTo(currentTimeRef.current ± skipAmount) (skipAmount default 5).
// FastForwardButton is disabled under a WaveformPlaylistProvider with indefinitePlayback.
```

All button/control components connect to context automatically. No props required for basic usage. All accept `className` and `style`.

### ClipInteractionProvider

```typescript
import { ClipInteractionProvider } from '@waveform-playlist/browser';

interface ClipInteractionProviderProps {
  snap?: boolean;                      // Default: false — enable snap-to-grid (auto-detects beats vs timescale from context)
  touchOptimized?: boolean;            // 250ms delay activation for touch input AND wider (24px) clip trim handles on every clip below. Left out: inherited from a ClipInteractionOptions/ClipInteractionProvider above (false at the top)
  children: React.ReactNode;
}
```

Declarative wrapper that encapsulates all clip drag/move/trim/snap/collision setup. Replaces manual `DragDropProvider` + `useClipDragHandlers` + `useDragSensors` + modifier configuration. Every clip below it (drawn by `WaveformTracks`, so under `Waveform`, `WaveformEditor` or your own `WaveformRoot`) can be dragged and trimmed: the provider renders `ClipInteractionOptions` (next), which is the only source of that; `Waveform` has no `interactiveClips` or `touchOptimized` prop. When `snap` is enabled, reads `BeatsAndBarsProvider` context: if `scaleMode="beats"` and `snapTo!="off"`, clips snap to beats/bars; otherwise falls back to timescale-based snapping.

#### `ClipInteractionOptions`

```typescript
import { ClipInteractionOptions } from '@waveform-playlist/browser';

interface ClipInteractionOptionsProps {
  enabled?: boolean;         // Clips below can be dragged and trimmed. Left out: inherited (false at the top)
  touchOptimized?: boolean;  // Clips below get 24px trim handles instead of 8px. Left out: inherited (false at the top)
  children: React.ReactNode;
}
```

The one source of the two clip interaction options; each clip reads them from this context. Use it with your own `DragDropProvider` (`<ClipInteractionOptions enabled><WaveformEditor /></ClipInteractionOptions>`; without `enabled`, clips show no trim handles and their headers do not drag), or nested inside a `ClipInteractionProvider` to change one option for part of the tree (`<ClipInteractionOptions touchOptimized={false}>` keeps 8px handles under a touch-optimized provider). It configures no sensors: pair `touchOptimized` with `useDragSensors({ touchOptimized: true })`.

#### `useClipInteractionEnabled()`

```typescript
import { useClipInteractionEnabled } from '@waveform-playlist/browser';

function useClipInteractionEnabled(): boolean;
```

Returns `true` when clips at this point of the tree can be dragged and trimmed: inside a `ClipInteractionProvider`, or inside `<ClipInteractionOptions enabled>`, and not under a nearer `<ClipInteractionOptions enabled={false}>`.

### KeyboardShortcuts

```typescript
import { KeyboardShortcuts } from '@waveform-playlist/browser';

interface KeyboardShortcutsProps {
  playback?: boolean;                  // Default: false — Space (play/pause), Escape (stop), 0 (rewind)
  clipSplitting?: boolean;             // Default: false — 's' key splits clip at playhead
  annotations?: boolean;               // Default: false — arrow nav, boundary editing, Enter to play
  undo?: boolean;                      // Default: false — Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo)
  additionalShortcuts?: KeyboardShortcut[];  // Appended to enabled defaults
}
```

Self-closing component that sets up keyboard shortcuts declaratively. Must be inside `WaveformPlaylistProvider`; it throws when the nearest playlist provider is `MediaElementPlaylistProvider`. Reads all required data (tracks, sampleRate, samplesPerPixel, annotations, etc.) from context internally. Replaces manual `usePlaybackShortcuts` + `useClipSplitting` + `useAnnotationKeyboardControls` wiring.

### PlaylistErrorBoundary

```typescript
import { PlaylistErrorBoundary } from '@waveform-playlist/ui-components';

interface PlaylistErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ReactNode; // Custom fallback UI
}
```

Catches render errors in child components. Uses plain CSS (works without ThemeProvider).

---

## Beats & Bars (@waveform-playlist/ui-components)

```typescript
// Named `SnapTo` before #770. Core's `SnapTo` is a different, longer list.
type BeatsAndBarsSnapTo = 'bar' | 'beat' | 'off';
type ScaleMode = 'beats' | 'temporal';

interface BeatsAndBarsProviderProps {
  bpm: number;
  timeSignature: [number, number];     // [numerator, denominator]
  snapTo: BeatsAndBarsSnapTo;
  scaleMode?: ScaleMode;               // which timescale is drawn; default 'beats'
  children: React.ReactNode;
}

interface BeatsAndBarsContextValue {
  bpm: number;
  timeSignature: [number, number];
  snapTo: BeatsAndBarsSnapTo;
  scaleMode: ScaleMode;
  ticksPerBeat: number;                // Derived from timeSignature + PPQN
  ticksPerBar: number;                 // Derived from timeSignature + PPQN
}
```

Optional context — `useBeatsAndBars()` returns `null` when no provider is present. When present, `SmartScale` renders beats & bars ticks instead of temporal ticks.

```typescript
// Zoom-dependent temporal scale thresholds
function getScaleInfo(samplesPerPixel: number): {
  marker: number;   // ms between major labeled ticks
  bigStep: number;  // ms between medium ticks
  smallStep: number; // ms between minor ticks
};
```

---

## Virtual Scrolling (@waveform-playlist/ui-components)

Viewport-aware canvas rendering — only mounts canvas chunks visible in the scroll container plus a 1.5x overscan buffer.

```typescript
// ScrollViewport — viewport state
interface ScrollViewport {
  scrollLeft: number;
  containerWidth: number;
  visibleStart: number;  // Left edge including overscan buffer
  visibleEnd: number;    // Right edge including overscan buffer
}

// ScrollViewportProvider — wraps scrollable container
interface ScrollViewportProviderProps {
  containerRef: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}
const ScrollViewportProvider: React.FC<ScrollViewportProviderProps>;

// useScrollViewport — full viewport state (re-renders on every scroll update)
function useScrollViewport(): ScrollViewport | null;

// useScrollViewportSelector — fine-grained subscription (re-renders only when selector result changes)
function useScrollViewportSelector<T>(selector: (viewport: ScrollViewport | null) => T): T;

// useVisibleChunkIndices — which canvas chunks are visible
// originX converts local chunk coords to global viewport space (for clips not at position 0)
function useVisibleChunkIndices(totalWidth: number, chunkWidth: number, originX?: number): number[];

// ClipViewportOriginProvider — provides clip's pixel offset to descendant Channel/SpectrogramChannel
interface ClipViewportOriginProviderProps {
  originX: number;       // Clip's pixel-space left offset within the timeline
  children: React.ReactNode;
}
const ClipViewportOriginProvider: React.FC<ClipViewportOriginProviderProps>;

// useClipViewportOrigin — read clip's pixel offset (defaults to 0 outside provider)
function useClipViewportOrigin(): number;
```

Used internally by `Channel`, `SpectrogramChannel`, and `TimeScale`. Returns `null` without provider (backwards compatible).

---

## Spectrogram (`@waveform-playlist/spectrogram` + `@dawcore/spectrogram`)

The computation, Web Worker, and orchestrator are framework-agnostic and live in `@dawcore/spectrogram`. `@waveform-playlist/spectrogram` is the React Provider + UI layer on top.

Spectrogram is an **optional** package. Integrate via `SpectrogramProvider`:

```typescript
import { SpectrogramProvider } from '@waveform-playlist/spectrogram';

<WaveformPlaylistProvider tracks={tracks}>
  <SpectrogramProvider config={spectrogramConfig} colorMap="viridis">
    <Waveform />
  </SpectrogramProvider>
</WaveformPlaylistProvider>

interface SpectrogramProviderProps {
  config?: SpectrogramConfig;
  colorMap?: ColorMapValue;
  /** Number of Web Workers for parallel FFT computation. Default: 2 (one per stereo channel). */
  workerPoolSize?: number;
  children: ReactNode;
}
```

```typescript
// From @waveform-playlist/core
type FFTSize = 256 | 512 | 1024 | 2048 | 4096 | 8192;
type ColorMapEntry = [number, number, number] | [number, number, number, number];
type ColorMapName = 'viridis' | 'magma' | 'inferno' | 'grayscale' | 'igray' | 'roseus';
type ColorMapValue = ColorMapName | ColorMapEntry[];
type RenderMode = 'waveform' | 'spectrogram' | 'both';

interface SpectrogramConfig {
  fftSize?: FFTSize;                    // Default: 2048
  hopSize?: number;                     // Default: fftSize / 4
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'rectangular' | 'bartlett' | 'blackman-harris';
  alpha?: number;                       // Window function parameter (0-1)
  frequencyScale?: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb'; // Default: 'mel'
  minFrequency?: number;               // Default: 0
  maxFrequency?: number;               // Default: sampleRate / 2
  gainDb?: number;                     // Default: 20
  rangeDb?: number;                    // Default: 80
  zeroPaddingFactor?: number;          // Default: 2
  labels?: boolean;                    // Default: false
  labelsColor?: string;
  labelsBackground?: string;
}

interface SpectrogramData {
  fftSize: number;
  windowSize: number;
  frequencyBinCount: number;
  sampleRate: number;
  hopSize: number;
  frameCount: number;
  data: Float32Array;                  // frameCount * frequencyBinCount (row-major)
  gainDb: number;
  rangeDb: number;
}

interface TrackSpectrogramOverrides {
  renderMode: RenderMode;
  config?: SpectrogramConfig;
  colorMap?: ColorMapValue;
}

// From @dawcore/spectrogram
interface SpectrogramWorkerApi {
  computeFFT(params: SpectrogramWorkerFFTParams, generation?: number): Promise<{ cacheKey: string }>;
  renderChunks(params: SpectrogramWorkerRenderChunksParams, generation?: number): Promise<void>;
  abortGeneration(generation: number): void;
  registerCanvas(canvasId: string, canvas: OffscreenCanvas): void;
  unregisterCanvas(canvasId: string): void;
  registerAudioData(clipId: string, channelDataArrays: Float32Array[], sampleRate: number): void;
  unregisterAudioData(clipId: string): void;
  terminate(): void;
}

class SpectrogramAbortError extends Error {}  // instanceof check for aborted FFT computations

// Key exports — note the split:
//   computation/worker/orchestrator → @dawcore/spectrogram (framework-agnostic, used by both layers)
//   React Provider + UI components  → @waveform-playlist/spectrogram (no re-exports of @dawcore/spectrogram symbols)
export { computeSpectrogram, computeSpectrogramMono, getColorMap, getFrequencyScale } from '@dawcore/spectrogram';
export { createSpectrogramWorker, createSpectrogramWorkerPool, SpectrogramAbortError } from '@dawcore/spectrogram';
export { SpectrogramOrchestrator } from '@dawcore/spectrogram/orchestrator';
export { SpectrogramProvider, SpectrogramMenuItems, SpectrogramSettingsModal } from '@waveform-playlist/spectrogram';

// Integration context (from @waveform-playlist/browser)
export { useSpectrogramIntegration, SpectrogramIntegrationProvider } from '@waveform-playlist/browser';
export type { SpectrogramIntegration } from '@waveform-playlist/browser';
// SpectrogramWorkerApi (above) is a type of @dawcore/spectrogram; browser does not export it.
// SpectrogramCanvasRegistration (what a spectrogram canvas registers with) is declared once,
// in @waveform-playlist/core; browser and ui-components do not export it.
// TrackMenuItem (what SpectrogramMenuItems returns an array of) is from
// @waveform-playlist/ui-components; the spectrogram package does not export it.
```

---

## Utilities

```typescript
// Waveform data (BBC audiowaveform)
loadWaveformData(src: string): Promise<WaveformData>;
waveformDataToPeaks(data: WaveformData, samplesPerPixel: number): PeakData;
loadPeaksFromWaveformData(src: string, samplesPerPixel: number): Promise<PeakData>;
getWaveformDataMetadata(data: WaveformData): { sampleRate: number; duration: number; channels: number };

// Effects (from `@waveform-playlist/browser/tone`; built-in Tone.js effects only)
effectDefinitions: EffectDefinition[];
effectCategories: { id: EffectCategory; name: string }[];
getEffectDefinition(id: string): EffectDefinition | undefined;
getEffectsByCategory(category: EffectCategory): EffectDefinition[];
createEffectInstance(
  definition: EffectDefinition,
  initialParams?: Record<string, number | string | boolean>
): EffectInstance;
createEffectChain(effects: EffectInstance[]): {
  input: ToneAudioNode | AudioNode;
  output: ToneAudioNode | AudioNode;
  dispose: () => void;
};
getAvailableEffects(): EffectDefinition[]; // built-ins, then (native-context mode only) the custom types the app registered; another host's `builtIn` catalogue (dawcore's native-*) is left out
// The registry functions (registerEffect, a different createEffectInstance, …)
// are from `@waveform-playlist/core` — see "Effect registry" above.

// Pan stage (from `@waveform-playlist/core`) — every renderer pans tracks with
// this, never a StereoPannerNode or Tone Panner: the law comes from the track's
// SOURCE channel count, not from the layout its pre-fader effects output.
interface PanMatrix { ll: number; lr: number; rl: number; rr: number }
type PanStageContext = Pick<
  BaseAudioContext,
  'createGain' | 'createChannelSplitter' | 'createChannelMerger'
>;
interface PanStage {
  readonly input: AudioNode;
  readonly output: AudioNode;
  setPan(pan: number): void; // -1 … 1
  setSourceChannelCount(sourceChannelCount: number): void; // 1 = mono law, 2+ = stereo law
  dispose(): void;
}
panMatrix(pan: number, sourceChannelCount: number): PanMatrix;
createPanStage(context: PanStageContext, pan: number, sourceChannelCount: number): PanStage;
trackChannelCount(track: { clips: ReadonlyArray<{ audioBuffer?: { numberOfChannels: number } }> }): number;

// Keyboard: the `KeyboardShortcut` type and `handleKeyboardEvent` are from
// `@waveform-playlist/core` (not exported by `@waveform-playlist/browser`).
// `getShortcutLabel` is removed from both packages (#770): build a label from the
// shortcut's fields (key, metaKey, ctrlKey, altKey, shiftKey) with the app's own strings.
```
