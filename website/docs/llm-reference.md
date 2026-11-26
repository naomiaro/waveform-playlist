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
  /** The owner of the tracks, the mix, the undo history and the loading (#812):
   *  `useCreateArrangement` (see "Arrangement Hooks"). The provider derives what
   *  it publishes and never writes back. A new object remounts everything below
   *  (a new engine; playback stops; zoom, selection, loop, master volume and
   *  scroll start again) and warns once in development. Track changes never
   *  build an engine: one is built on mount, when `effects` changes identity and
   *  when `zoomLevels` changes content. */
  arrangement: Arrangement;
  children: ReactNode;
  /** Draw and analyse every track as one channel. A provider option, not a
   *  view option: the provider computes the peaks with it. */
  mono?: boolean;                         // Default: false
  samplesPerPixel?: number;               // Default: 1024
  zoomLevels?: number[];
  automaticScroll?: boolean;              // Default: false. While on, a drag during playback is one seek to the press, no range
  theme?: Partial<WaveformPlaylistTheme>; // merged over defaultTheme: { ...defaultTheme, ...theme }
  /** The owner of the annotations (#867): make it with `useCreateAnnotationStore`
   *  (see "Annotation Store") and change the annotations with its methods. The
   *  provider publishes what it holds and writes nothing back. Without it there
   *  are no annotations. The same prop on both providers. */
  annotationStore?: AnnotationStore;
  /** The three annotation options; the annotations are `annotationStore`'s. */
  annotationList?: AnnotationListProp;
  effects?: EffectsFunction;
  /** A track's effects function by track id (`getTrackEffectsFunction` from
   *  `useTrackDynamicEffects()`). Tracks carry no `effects` field. Called when a
   *  track's audio graph is built; a new function identity rebuilds nothing. */
  trackEffects?: (trackId: string) => TrackEffectsFunction | undefined;
  /** Once per mount: the first time an engine is attached and no source of the
   *  arrangement is pending (a failed source counts as settled; an empty
   *  arrangement is ready when its engine is). Not again after a rebuild, a
   *  StrictMode remount or an <Activity> reveal. Read when called (QG): a new
   *  identity builds nothing. Throws are logged and passed to onError. */
  onReady?: () => void;
  /** Called when the engine or its adapter cannot be built (e.g. a missing optional
   *  peer, a throwing `createAdapter`, or an invalid `zoomLevels`/`samplesPerPixel`),
   *  for a build that is still current, and when `onReady` throws. NOT for a source
   *  that fails to load (read useArrangementSources) and NOT for a track the
   *  arrangement refuses (that throws at the call). Read when called. */
  onError?: (err: Error) => void;
  /** SoundFont cache for sample-based MIDI playback */
  soundFontCache?: SoundFontCache;
  /** Disable end-of-timeline auto-stop — roll until explicit stop (DAW style). The multitrack
   *  view then draws the timeline as wide as its container, as `<WaveformViewOptions fillViewport>`
   *  does. Recording sessions suppress the auto-stop automatically. A provider option, not a
   *  view option: the animation loop and `seekTo` follow it. */
  indefinitePlayback?: boolean;           // Default: false
  /** Desired AudioContext sample rate for pre-computed peaks matching. Read at build
   *  time. Also the rate placeholders are drawn at before the first adapter exists:
   *  without it no placeholder is drawn until an adapter has been built. */
  sampleRate?: number;
  /** Supply a custom playout adapter — skips dynamic import of @waveform-playlist/playout + tone.
   *  Called once per engine build; read at build time. Audio is decoded with the current
   *  adapter's AudioContext: an adapter whose dispose() closes its context can fail a load
   *  still in flight at a rebuild (arrangement.retry(src) starts it again). */
  createAdapter?: () => PlayoutAdapter;
}
// Removed (#812): tracks, onTracksChange, deferEngineRebuild. A leftover one is ignored at
// runtime (TypeScript reports it). See upgrading.md.
// Removed (#867), from both providers: onAnnotationsChange, and the `annotations` field of
// annotationList. A leftover one is ignored at runtime: the provider shows no annotations. Without `arrangement` (or with a value that is
// not an object) the provider throws an Error while it renders, in every build:
// "[waveform-playlist] WaveformPlaylistProvider needs an `arrangement` prop: an arrangement made with
// `useCreateArrangement`, which owns the tracks. The `tracks` and `onTracksChange` props were removed.
// See https://naomiaro.github.io/waveform-playlist/docs/react/upgrading"
// Before the first ready, play() does nothing and queues nothing (one console.warn per mount
// in development). Edits, the mixer, seekTo and setSelection work before ready.
// A source that never settles (a hanging request; no load timeout yet, #840) keeps the
// playlist from ready: show useArrangementSources(arrangement).pendingCount / isLoading while > 0.
// Window event 'waveform-playlist:ready', once per mount with onReady:
//   detail: { trackCount: number /* every track of the arrangement */, duration: number /* loaded audio, s */ }
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
  annotationStore?: AnnotationStore;        // the same prop as on WaveformPlaylistProvider
  annotationList?: AnnotationListProp;      // the same prop as on WaveformPlaylistProvider
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
  /** The annotation store's list: never write to it (frozen in development).
   *  `[]` when the provider has no `annotationStore`. */
  annotations: readonly AnnotationData[];
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
 * The `annotationList` prop of both providers: the three annotation options.
 * The annotations themselves are the `annotationStore` prop's (#867). The
 * provider holds the three options as state (`useAnnotationOptions()`, and
 * the three setters of `usePlaybackControls()`), and that state follows the
 * prop: when the value of a field changes, the option takes it. Between two
 * changes of the prop a setter (or one of the checkboxes) changes the option;
 * the prop is not told.
 */
interface AnnotationListProp {
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
  /**
   * Where an annotation edge drag shows its moves while it is in progress.
   * Pass it to `useAnnotationDragHandlers({ preview })`; read it in a custom
   * annotation renderer with `useAnnotationsWithPreview`. Stable identity.
   */
  annotationPreview: AnnotationPreviewHandle;
  /**
   * The provider's `annotationStore` prop, or `undefined` without one: the
   * owner of the annotations. Change them with its `set` and `update`. Its
   * identity changes only when the prop does.
   */
  annotationStore: AnnotationStore | undefined;
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
// Removed (#867): setAnnotations. Write through `annotationStore` (set / update).
// The value changes only when the provider is given another `annotationStore` (#867).
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

### useArrangement()

```typescript
/**
 * The arrangement of the nearest WaveformPlaylistProvider: the owner of the
 * tracks, the mix, the undo history and the loading (#812). Change the tracks
 * through it; the provider and the engine follow. The value never changes,
 * so calling this never re-renders.
 */
function useArrangement(): Arrangement;
```

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

  // Track mixer, by track id (#687; by index until then). An id no track has
  // is ignored. They change the arrangement's mix, also while no engine is
  // attached (#812). Each call is an undo step of the arrangement (#843);
  // `options` (the engine's `MixerChangeOptions`) makes calls with one
  // `gesture` id one step, or a value with `undoable: false` no step. Inside
  // a track's control panel, `useTrack()` has the same actions already bound
  // to that track.
  setTrackMute: (trackId: string, muted: boolean, options?: MixerChangeOptions) => void;
  setTrackSolo: (trackId: string, soloed: boolean, options?: MixerChangeOptions) => void;
  setTrackVolume: (trackId: string, volume: number, options?: MixerChangeOptions) => void;
  setTrackPan: (trackId: string, pan: number, options?: MixerChangeOptions) => void;

  /** Move a track to a new index in the vertical track order. Purely
   *  organizational — playback is not interrupted. An undo step of the
   *  arrangement (#812). */
  reorderTrack: (trackId: string, toIndex: number) => void;

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

  // Undo/redo: the arrangement's history, engine or not (#812). Both do nothing
  // while a clip move, a clip trim or a track-reorder drag is in progress (#848).
  undo: () => void;
  redo: () => void;

  // Recording
  /** Mark a recording session active/inactive. While active: (1) the
   *  end-of-audio auto-stop is suppressed so overdub playback runs past the
   *  end of existing material, and (2) with a `recordingTrackId`, that track
   *  is marked in the arrangement as the one the take is recording onto
   *  (`setTrackRecording`, #843): punch-in recording replaces whatever the
   *  take overlaps (#579), so the doomed material must not play under the
   *  overdub. The take's mute plays the track muted and is no undo step.
   *  `trackStates` and the track's Mute button show it muted, the built-in
   *  `<TrackMuteButton />` of that track is disabled, and
   *  `useTrack().isRecording` is true for it, while
   *  `arrangement.getMixer()` keeps the track's own mute: nothing is written
   *  to it, so a mute changed during the take stays after it. One track is
   *  recorded onto at a time: naming one clears any other, and
   *  `setRecordingActive(false)` clears every track. `useRecordingSession`
   *  calls it for the length of a take; overdub flows should also call it
   *  eagerly (before `play()`). */
  setRecordingActive: (active: boolean, recordingTrackId?: string | null) => void;
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
}
```

### usePlaylistTimeline()

```typescript
/**
 * What is on the timeline (#768). Changes on every clip operation (a trim
 * once, on release: its moves are a preview only the dragged clip follows,
 * #812) and on a zoom (the peaks are computed per zoom level), so call
 * `usePlaylistTimeline()` only in a component
 * that draws tracks or needs the timeline length during render.
 */
interface PlaylistTimelineContextValue {
  /**
   * The arrangement's tracks without the clips that are still loading
   * (#812): derived from the arrangement, never written back. Change them
   * through `useArrangement()`.
   */
  tracks: readonly ClipTrack[];
  /**
   * One row per track, in the order of `tracks`. A row also holds the
   * placeholder record (`isPlaceholder: true`) of each clip still loading,
   * which `tracks` does not have: find a record by `clipId`, never by position.
   */
  peaksDataArray: TrackClipPeaks[];
  /** The end, in seconds, of the loaded audio. */
  duration: number;
  /**
   * False until an engine is attached and the first sources have settled;
   * then false while a later engine is being built.
   */
  isReady: boolean;
}
```

### usePlaylistMixer()

```typescript
/** Mixer state (#768). Changes on every mute, solo, volume or pan change. */
interface PlaylistMixerContextValue {
  /** One entry per track of the arrangement, in the order of `tracks`:
   *  trackStates[i] belongs to tracks[i], and the length equals tracks.length.
   *  Every track has an entry from the moment it enters the arrangement, also
   *  while its audio loads (no `undefined` entries, #812). The values are the
   *  arrangement's mix (`arrangement.getMixer()`), by track id: a track keeps
   *  its state while its id is in the arrangement; an undo, a redo or an
   *  abort brings back the mix of the state it returns to (#843);
   *  an id with no mix yet starts from the track's own fields, which after
   *  that are only the values it entered with. The array keeps its identity
   *  while no entry changed. */
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

// Clips that name their audio. An arrangement (createArrangement() of @waveform-playlist/engine, or
// useCreateArrangement) holds and loads them; PlaylistEngine's own setTracks/addTrack/updateTrack take ClipTrack[].
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

type ArrangementTrack = Omit<ClipTrack, 'clips'> & { clips: (AudioClip | LoadingClip)[] };

isLoadingClip(clip: AudioClip | LoadingClip): clip is LoadingClip;  // True for a clip with no sampleRate

// AudioClip.src?: ClipSource            // The source the clip was loaded from. createClip, createClipFromSeconds
//                                       // and createClipFromTicks take `src` and carry it onto the clip.

interface AudioTrackOptions {
  id?: string; clipId?: string; name?: string;   // id and clipId: '' counts as none; name defaults to the file name of src, else 'Untitled'; the clip gets the same name
  src?: ClipSource; audioBuffer?: AudioBuffer; waveformData?: WaveformDataObject;
  start?: number; duration?: number; offset?: number;   // Seconds
  fadeIn?: Fade; fadeOut?: Fade; gain?: number;
  color?: string;                       // On the track and on the clip
  muted?: boolean; soloed?: boolean; volume?: number; pan?: number;
  renderMode?: RenderMode; spectrogramConfig?: SpectrogramConfig; spectrogramColorMap?: ColorMapValue;
}

audioTrack(options: AudioTrackOptions): ArrangementTrack;
// src without audioBuffer: one LoadingClip (it carries waveformData when given).
// audioBuffer (with or without src), or waveformData with no src: one AudioClip.
// None of the three: throws 'audioTrack: give src, audioBuffer or waveformData'.
// A negative or non-finite start or offset, or a duration that is not positive and finite, throws.
// With audioBuffer or waveformData, an offset at or past the end of the audio throws; a duration that runs past
// the end is cut to it, with one console.warn (compared in samples, one sample of tolerance).
// src: '' counts as not given.
```

A track whose clips do not match its kind is rejected: the arrangement's `setTracks/addTrack/updateTrack` (and `PlaylistEngine`'s) throw, before changing anything. The same holds for a clip still loading on a MIDI track, two tracks with one id, or two clips with one id on a track. Under `WaveformPlaylistProvider` the throw reaches whoever called the arrangement (#812): from the `useCreateArrangement` initializer it is a render error, for the nearest error boundary ABOVE the component that calls the hook; from `arrangement.addTrack()` in a handler it is that handler's exception. The provider's `onError` is not called for it. `onError` is for an engine or adapter that cannot be built and for an `onReady` that throws (a console error and `onError`; the playlist is ready).

```typescript
interface TrackState {
  name: string;
  /** The track's own mute, or true while a take is recording onto it (#843). */
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
  /** True for the record of a clip whose audio is still loading (WaveformPlaylistProvider, #812):
   *  drawn dimmed (theme placeholderClipOpacity, default 0.5) without drag or trim handles,
   *  container carries data-clip-placeholder="true". There is NO clip for it in
   *  usePlaylistTimeline().tracks: find a record by clipId, never by position. Required. */
  isPlaceholder: boolean;
}

type TrackClipPeaks = ClipPeaks[];

interface TrackDragPreview {
  trackId: string;
  toIndex: number;
}
```

---

## Arrangement Hooks

*From `@waveform-playlist/browser` (core entry, not `/tone`)*

`WaveformPlaylistProvider` takes the arrangement as its `arrangement` prop. `Arrangement`, `LoadSource`, `ArrangementSourcesValue` and `ArrangementSourceState` are from `@waveform-playlist/engine`; `ArrangementTrack`, `LoadingClip`, `ClipSource`, `audioTrack` and `isLoadingClip` are from `@waveform-playlist/core`. The arrangement's methods: see `Arrangement` under the engine below.

```typescript
function useCreateArrangement(
  init?: () => readonly ArrangementTrack[],
  options?: UseCreateArrangementOptions
): Arrangement;

interface UseCreateArrangementOptions {
  loadSource?: LoadSource; // how a clip's source is fetched and decoded
  undoLimit?: number; // how many undo steps the arrangement keeps (default 100)
}

/** The arrangement of the nearest WaveformPlaylistProvider. Never changes for a mount: never re-renders.
 *  Throws outside a provider and under MediaElementPlaylistProvider. */
function useArrangement(): Arrangement;

function useArrangementTracks(arrangement: Arrangement): readonly ArrangementTrack[];

function useArrangementSources(arrangement: Arrangement): ArrangementSourcesValue;
// { sources: ReadonlyMap<ClipSource, { status: 'pending' | 'loaded' | 'failed'; error?: Error }>,
//   pendingCount, failedCount, isLoading }
```

`useCreateArrangement` makes one arrangement per component instance and returns it on every render. `init` and `options` are read on the first render only, and only `loadSource` and `undoLimit` are read from the options; the initial tracks are not an undo step. An initializer that throws (a track of the wrong kind, a clip still loading on a MIDI track, a duplicate track id, two clips with one id on a track) throws out of the render, to the nearest error boundary above the calling component, not to a provider's `onError`. Under StrictMode the initializer runs twice and one result is kept. Creating an arrangement fetches nothing: `WaveformPlaylistProvider` attaches its first adapter's `AudioContext` as the decode context (and detaches it on unmount or an `<Activity>` hide, which aborts loads in flight; they start again on reveal). `useArrangementTracks` returns `arrangement.getTracks()`, loading clips included, and re-renders when the tracks change, not on a mixer change. `useArrangementSources` returns the same object until a source's status changes or a source is added or dropped. Both take a REQUIRED argument, so they work above the provider.

```tsx
import { WaveformPlaylistProvider, Waveform, useCreateArrangement } from '@waveform-playlist/browser';
import { audioTrack } from '@waveform-playlist/core';

const arrangement = useCreateArrangement(() => [
  audioTrack({ src: '/audio/vocals.mp3', name: 'Vocals' }),          // a LoadingClip: drawn once loaded
  audioTrack({ src: '/audio/drums.mp3', name: 'Drums', duration: 30 }), // with a duration: a placeholder at once
]);
// A dropped file: arrangement.addTrack(audioTrack({ src: file }))
// A failed source: useArrangementSources(arrangement).sources.get(src)?.error; arrangement.retry(src)
<WaveformPlaylistProvider arrangement={arrangement}><Waveform /></WaveformPlaylistProvider>
```

Placeholders: a clip still loading that has a `duration` or `waveformData` is drawn as a placeholder record in `peaksDataArray` (`isPlaceholder: true`; from its peaks, else a box of the clip's extent in the colour the waveform's bars are drawn in (`waveFillColor`, `selectedWaveFillColor` on the selected track, `grey` when the theme gives no usable colour), `<ClipPlaceholderBody />` from ui-components, `data-clip-placeholder-body="true"`, with or without clip headers and on spectrogram tracks too; the played-portion tint and fade curves draw over it), dimmed, without handles; a clip that names only its `src` is drawn once loaded. No placeholder is drawn before the provider knows its real sample rate (the `sampleRate` prop, else the first adapter's context). A placeholder's geometry is at the provider's sample rate, also when its peaks file has another.

Rule for apps: change tracks from a handler, an effect or a `sources` listener, not from inside `arrangement.subscribe()` or an engine `statechange` listener: two or more track edits made inside one listener run make the engine send the adapter every track (`setTracks`), which can interrupt playback.

Removed (#812) from `@waveform-playlist/browser/tone`: `useAudioTracks`, `useDynamicTracks`, and the types `AudioTrackConfig`, `TrackSource`, `TrackLoadError`, `UseDynamicTracksReturn`. Replacement: `audioTrack({ src | audioBuffer | waveformData, name, start, duration, offset, … })` in the arrangement (`start`, not `startTime`); loading state from `useArrangementSources`.

## Annotation Store

*`createAnnotationStore`, `applyAnnotationBounds` and the types from `@waveform-playlist/core`; the two hooks from `@waveform-playlist/browser` (core entry)*

Both providers take the store as their `annotationStore` prop (#867). It is the one owner of the annotations: the provider, the boxes, the list, the keyboard shortcuts and the app read it, and every change is a call to `set` or `update`.

```typescript
interface AnnotationStore {
  /** The current annotations. The same array until a change. Never write to
   *  it: outside production builds it is frozen. */
  getAnnotations(): readonly AnnotationData[];
  /** Be told after every change. Returns the function that unsubscribes. */
  subscribe(listener: () => void): () => void;
  /** Replace the annotations. */
  set(annotations: readonly AnnotationData[]): void;
  /** `fn` gets the current array and returns the next. Applied before `update`
   *  returns, so the next call's `current` already holds it. Returning
   *  `current` changes nothing. */
  update(fn: (current: readonly AnnotationData[]) => readonly AnnotationData[]): void;
}

interface AnnotationStoreOptions {
  /** The app's rule for every change: gets the proposed list and the current
   *  one, returns the list to store: `next` to accept, `current` to refuse
   *  (nobody is told), or another list to adjust. Not called for the initial
   *  list. A throw from it reaches the caller of `set` / `update`, and the
   *  store keeps its value. */
  beforeChange?: (
    next: readonly AnnotationData[],
    current: readonly AnnotationData[]
  ) => readonly AnnotationData[];
}

/** Throws a TypeError for an invalid initial list (see below). */
function createAnnotationStore(
  initial?: readonly AnnotationData[], // default []
  options?: AnnotationStoreOptions
): AnnotationStore;

interface AnnotationBoundsChange {
  id: string;
  start: number;
  end: number;
}
/** Writes `start`/`end` of each change onto the annotation with that id; every
 *  other field and annotation is kept (the same object); an id not in
 *  `current` is skipped. Returns `current` itself when nothing changes. */
function applyAnnotationBounds(
  current: readonly AnnotationData[],
  changes: readonly AnnotationBoundsChange[]
): readonly AnnotationData[];

/** One store per component instance; the same store on every render. `init`
 *  is read once, on the first render (a throw goes to the nearest error
 *  boundary above the calling component). `options.beforeChange` is followed:
 *  the store calls the function passed on the most recent committed render. */
function useCreateAnnotationStore(
  init?: () => readonly AnnotationData[],
  options?: AnnotationStoreOptions
): AnnotationStore;

/** The store's list; re-renders on a change. REQUIRED argument: works above
 *  the provider too. Never write to what it returns. */
function useStoredAnnotations(store: AnnotationStore): readonly AnnotationData[];
```

- Validation, in every build: the initial list, `set`, `update`'s result and `beforeChange`'s result. Every annotation needs finite numeric `start` and `end`; ids are unique. Otherwise a `TypeError` (`[waveform-playlist] Invalid annotations: annotation "<id>" needs numeric start and end (got <type> and <type>). …` / `… two annotations have the id "<id>".`) and the store keeps its value.
- In a development build (`process.env.NODE_ENV` set and not `'production'`; with no `process` at all nothing is frozen) the list, each annotation and its `lines` are frozen, including the objects passed in: an array write (`annotations.sort()`) throws in any code, a field assignment throws in strict code (every module). Copy first: `[...list].sort(…)`.
- Subscribers are told synchronously after a change; one that throws is warned about and the others are still told.
- Two `update`s in one tick both land, in either order, whoever makes them (an app write, a drag release, a boundary key, a list edit).
- What the library writes: an edge drag keeps the `start`/`end` of every annotation it touched (also one moved back) and works out each move over the store's current list with them on top (a neighbour moved elsewhere collides where it is now). With the preview, the release writes the touched bounds, by id, onto the store's list as it is then (an annotation added during the drag stays, and so does any other edit made elsewhere, except to the `start` and `end` of an annotation the drag has touched: those are the drag's; Escape writes nothing); without it every move writes them and Escape writes the drag-start bounds back. The drag ends, writing nothing more and clearing its preview, when the dragged annotation is removed (also "clear all"), when the provider is given another store, or on unmount. During a drag with the preview, the boxes and the list show the store's current list with the drag's bounds on top. Boundary keys find the active annotation by id when the key is pressed; a key at a clamp changes nothing and tells nobody. List text, id and action edits find their row by id; a blur with unchanged text tells nobody.
- `beforeChange` is not called when the proposed list is the current array, nor for a list that fails validation (validation runs first).
- Saving: `store.subscribe(() => save(store.getAnnotations()))`, or `useStoredAnnotations(store)` read in an effect.

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  useCreateArrangement,
  useCreateAnnotationStore,
} from '@waveform-playlist/browser';
import { AnnotationProvider, parseAeneas } from '@waveform-playlist/annotations';

const annotationStore = useCreateAnnotationStore(() => fragments.map(parseAeneas), {
  beforeChange: (next, current) => (locked ? current : next), // `locked`: the app's state, read when called
});
<WaveformPlaylistProvider arrangement={arrangement} annotationStore={annotationStore} annotationList={{ editable: true }}>
  <AnnotationProvider><Waveform /></AnnotationProvider>
</WaveformPlaylistProvider>
// Below the provider: const { annotationStore } = usePlaybackControls();
// annotationStore?.update((current) => [...current, { id, start, end, lines: [''] }]);
```

`AnnotationText` (`@waveform-playlist/annotations`), for a list outside the provider:

```typescript
interface AnnotationTextProps {
  /** What the list draws. */
  annotations: readonly AnnotationData[];
  activeAnnotationId?: string;
  shouldScrollToActive?: boolean;
  scrollActivePosition?: ScrollLogicalPosition; // default 'center'
  scrollActiveContainer?: 'nearest' | 'all';    // default 'nearest'
  editable?: boolean;
  controls?: AnnotationAction[];
  annotationListConfig?: AnnotationActionOptions;
  height?: number;
  onAnnotationClick?: (annotation: AnnotationData) => void;
  /** Where the edits are written (#867): text, id and control edits call
   *  `store.update`, find their annotation by id in the store's current list,
   *  and a field whose edit was not stored shows the stored value again.
   *  Without `store` the list is read-only: no field can be edited and no
   *  control is drawn, whatever `editable` says. */
  store?: AnnotationStore;
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => React.ReactNode;
}
// Removed (#867): onAnnotationUpdate. The id field refuses an empty id and an id another
// annotation has (nothing written; the stored id is shown again).
// The browser package types what it passes as AnnotationTextIntegrationProps (in
// AnnotationIntegration): the same fields, `store` included.
```

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
  /** usePlaybackControls().annotationStore. Without a store the handlers do nothing. */
  store: AnnotationStore | undefined;
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
  annotations: readonly AnnotationData[],
  preview: AnnotationPreviewHandle
): readonly AnnotationData[];

function useAnnotationKeyboardControls(options: {
  /** usePlaybackControls().annotationStore. The keys read it; a boundary key changes the
   *  active annotation, found by id, in the store's list when the key is pressed.
   *  Without a store there is nothing to select or move. */
  store: AnnotationStore | undefined;
  activeAnnotationId: string | null;
  onActiveAnnotationChange?: (id: string | null) => void; // without it the selection keys are off
  duration: number;
  linkEndpoints: boolean;
  continuousPlay?: boolean; // default false
  enabled?: boolean; // default true
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  onPlay?: (startTime: number, duration?: number) => void;
  samplesPerPixel?: number; // default: the provider's
  sampleRate?: number; // default: the provider's
}): {
  moveStartBoundary: (delta: number) => void;
  moveEndBoundary: (delta: number) => void;
  selectPrevious: () => void;
  selectNext: () => void;
  selectFirst: () => void;
  selectLast: () => void;
  clearSelection: () => void;
  scrollToAnnotation: (annotationId: string) => void;
  playActiveAnnotation: () => void;
};
// Removed (#867) from both hooks: the options `annotations` and `onAnnotationsChange`.
```

Each move is worked out over the store's current list with the bounds of every annotation the drag has touched on top (kept also for one moved back to where it was). With `preview`, each move is published to it (the built-in annotation boxes and list follow it, so a change made elsewhere during the drag shows at once) and the store is written once, on release: the touched `start`/`end`, by id, onto the store's list as it is then. Without it, every move writes all the touched bounds. A cancelled drag (Escape) writes nothing with `preview`; without it the touched annotations' drag-start bounds are written back by id. The drag ends, writing nothing more and clearing the preview, when the dragged annotation leaves the store, when `store` becomes another store, or on unmount. `WaveformAnnotationBoxes` calls this hook itself, with the preview, inside its own `DragDropProvider`: call it only for a row of boxes you draw yourself.

### useClipDragHandlers

```typescript
function useClipDragHandlers(options: UseClipDragHandlersOptions): {
  onDragStart: (event: DragStartEvent) => void; // DragStartEvent, DragMoveEvent, DragEndEvent: @dnd-kit/abstract
  onDragMove: (event: DragMoveEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
};

interface UseClipDragHandlersOptions {
  samplesPerPixel: number;
  /** Optional snap function for boundary trims — snaps a sample position to nearest grid line */
  snapSamplePosition?: (samplePos: number) => number;
}
```

Reads the provider's arrangement (`useArrangement()`): throws outside `WaveformPlaylistProvider` and under `MediaElementPlaylistProvider` (#812; options `tracks` and `engineRef` removed). A move is one `arrangement.moveClip()` on drop and a trim one `arrangement.trimClip()` on release: each is one undo step, and neither opens a transaction. A move, trim or split made while no engine is attached (before the first build, during a rebuild) is kept, and the next engine plays it. While a trim handle is dragged, each move is constrained by `arrangement.constrainTrimDelta` and drawn as a preview of the dragged clip only (the preview is internal: no exported hook or context reads it); the tracks do not change until the release. Escape (`event.canceled`) clears the preview and changes nothing. From `onDragStart` of a clip to its `onDragEnd` (or the unmount of the component that holds the handlers) `useEditorControls().undo()` / `redo()` do nothing (#848); a setup that calls `onDragStart` must also call `onDragEnd`, or undo stays off until that component unmounts. A move or a trim commits the clip and track picked up at drag start, by their ids (also if the row moves or other clips change position during the drag); a move whose clip is no longer among the track's loaded clips at the drop is dropped with a console warning; `clipIndex` of the drag data is not read. The draggable ids are `clip/<trackId>/<clipId>`, `clip-boundary-left/<trackId>/<clipId>` and `clip-boundary-right/<trackId>/<clipId>` (each part `encodeURIComponent`-encoded). A clip still loading has no handles. Collision detection is handled separately by `ClipCollisionModifier` (passed to DragDropProvider's `modifiers` prop; give it `usePlaylistTimeline().tracks`). Within one provider mount (the arrangement and the provider's trim preview do not change then) `onDragStart` keeps its identity, `onDragMove` changes with `samplesPerPixel` or the sample rate and `onDragEnd` with `samplesPerPixel`.

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
    tracks: readonly ClipTrack[] | (() => readonly ClipTrack[]);
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
  samplesPerPixel: number; // options tracks and engineRef removed (#812)
}

interface UseClipSplittingResult {
  splitClipAtPlayhead: () => boolean;
  splitClipAt: (trackId: string, clipId: string, splitTime: number) => boolean;
}
```

Each split is one `arrangement.splitClip()` on the provider's arrangement (`useArrangement()`): an undo step, kept with no engine attached. Throws outside `WaveformPlaylistProvider` and under `MediaElementPlaylistProvider`. `splitClipAt` takes ids and returns `false`, changing nothing, for a track id or clip id that is not in the arrangement, for a clip still loading, and for a split point outside the clip or too close to an edge (with a console warning); otherwise `true`, also with no engine.

---

## MIDI (`@waveform-playlist/midi` + `@dawcore/midi`)

Load and parse MIDI files into `ClipTrack[]` with `midiNotes` for piano roll visualization and SoundFont/PolySynth playback. As of v13, the parser is framework-agnostic and lives in `@dawcore/midi`; `@waveform-playlist/midi` re-exports it and adds the plain function `loadMidiTracks` on top. The package has no React hook and no `react` peer dependency (`useMidiTracks` was removed: see the upgrade guide, "`useMidiTracks` is removed: load with `loadMidiTracks`").

### loadMidiTracks

A function, not a hook: no React state, no loading flags.

```typescript
function loadMidiTracks(
  src: string | File | Blob, // a URL, or the file itself
  options: LoadMidiTracksOptions
): Promise<ClipTrack[]>;

interface LoadMidiTracksOptions {
  sampleRate: number; // Required — pass AudioContext.sampleRate
  flatten?: boolean; // Merge all MIDI tracks of the file into one (default false)
  start?: number; // Clip position in seconds (default 0)
  duration?: number; // Clip duration in seconds (default: end of the track's last note)
  name?: string; // Names the track and its clip when the file yields exactly one track; several tracks keep their own MIDI names
  signal?: AbortSignal; // An aborted signal rejects with the signal's reason
}
```

Each track has `kind: 'midi'`, and every call makes new track and clip ids. To play them under `WaveformPlaylistProvider`, add each to the arrangement (`arrangement.addTrack(track)`), call `arrangement.clearHistory()` once so the first load is not an undo step, and render the provider after that (its ready waits only for audio sources, not for your load). A URL that does not answer with an OK status rejects with `Failed to fetch MIDI file <url>: <status>`, with the status text after the code when there is one (`Failed to fetch MIDI file /missing.mid: 404 Not Found`); data that is not a MIDI file rejects with `parseMidiFile: invalid or corrupt MIDI data (<n> bytes): …`.

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

`setTracks(tracks)`, `addTrack(track)` and `updateTrack(id, track)` throw an `Error` when a track's clips are not all of its `kind` (see `ClipTrack` under Data Types), when a track id is a duplicate, and when two clips of one track have the same id. The check runs before any state changes: no undo step, no adapter call. A `LoadingClip` is an audio clip for this check, so the arrangement refuses a `kind: 'midi'` track that holds one.

The arrangement (`createArrangement()`) owns the tracks, the mix and the undo history; a `PlaylistEngine` plays it, and makes its own when the `arrangement` option is left out. Nothing either hands out is a copy: `getState().tracks`, `arrangement.getTracks()` and the tracks an adapter receives are shared with the undo history and frozen outside production builds.

An arrangement's tracks are `ArrangementTrack` (core): a clip is an `AudioClip` or a `LoadingClip` (audio not loaded yet; narrow with `isLoadingClip` before reading sample fields). The arrangement loads every source its loading clips name, in the current tracks and in every undo and redo state, once a decode context is attached (an engine with an adapter attaches `adapter.audioContext`), and replaces each loading clip with an `AudioClip` of the same id when its audio arrives (seconds to integer samples at the decoded buffer's sample rate; not an undo step; one notification). `getState().tracks`, `getState().duration` and the tracks an adapter receives leave loading clips out. `PlaylistEngine`'s own `setTracks` / `addTrack` / `updateTrack` take `ClipTrack` (loaded clips only).

```typescript
import { PlaylistEngine, createArrangement, attachDecodeContext, defaultLoadSource } from '@waveform-playlist/engine';
import type { EngineState, PlayoutAdapter, EngineEvents, PlaylistEngineOptions } from '@waveform-playlist/engine';
import type {
  Arrangement,
  ArrangementSourceState,
  ArrangementSourcesValue,
  ClipBounds,
  CreateArrangementOptions,
  LoadSource,
  MixerChangeOptions,
  AddTrackOptions,
  RemoveTrackOptions,
  TrackMixerValues,
} from '@waveform-playlist/engine';

interface PlaylistEngineOptions {
  adapter?: PlayoutAdapter;
  arrangement?: Arrangement;    // From createArrangement(). Outlives the engine; left out, the engine makes its own. One engine at a time
  sampleRate?: number;          // Default: 48000 (use AudioContext.sampleRate for hardware rate)
  samplesPerPixel?: number;     // Default: 1024; must be one of zoomLevels
  zoomLevels?: number[];        // Default: [256, 512, 1024, 2048, 4096, 8192]
  undoLimit?: number;           // Default: 100. Only when the engine makes its own arrangement
  attachDecodeContext?: boolean; // Default: true: an engine with an adapter gives its arrangement adapter.audioContext to decode with, and takes it away in dispose().
                                // false: the host calls attachDecodeContext() itself. An engine without an adapter attaches nothing
  bpm?: number;                 // Default: 120
  ppqn?: number;                // Without an adapter (default 960); with one, adapter.ppqn is used
}

function createArrangement(options?: CreateArrangementOptions): Arrangement;

interface CreateArrangementOptions {
  tracks?: readonly ArrangementTrack[];  // The first tracks. Not an undo step
  undoLimit?: number;                    // Maximum number of undo steps (default 100)
  loadSource?: LoadSource;               // How a clip's source becomes an AudioBuffer. Default: defaultLoadSource
}

type LoadSource = (
  src: ClipSource,
  context: { signal: AbortSignal; audioContext: BaseAudioContext }
) => Promise<AudioBuffer>;

// fetch for a string, arrayBuffer() for a Blob or File, then audioContext.decodeAudioData. The signal is checked before
// the work starts and after each await. Its own messages ('Failed to fetch <source>: <status> <statusText>',
// 'Failed to fetch <source>' when fetch threw a TypeError, 'Decoded audio is empty: <source>',
// 'Failed to decode audio: <source>' for a decode rejection that is not an Error) name a URL without its query string,
// fragment and user name/password (a malformed URL the URL parser refuses loses only query and fragment), never echo a
// data: or blob: URL, and call a File by its name and a Blob 'Blob'. The TypeError is in `cause` only when <source> is the source unchanged;
// when anything was left out of it the error has no `cause` (the browser's message can quote the whole URL).
// A decode Error from the browser and an AbortError are rethrown as they are.
const defaultLoadSource: LoadSource;

// Give an arrangement the audio context its sources are decoded with. Nothing is fetched before; the sources are
// pending meanwhile. getContext is called for each load. Returns the function that takes the context away: loads in
// flight are aborted and stay pending, loaded sources are kept, and the next attach starts the aborted ones again.
// One context at a time: a second attach warns and replaces the first. Throws for anything that is not an arrangement.
function attachDecodeContext(
  arrangement: Arrangement,
  getContext: () => Promise<BaseAudioContext>
): () => void;

interface ArrangementSourceState {
  status: 'pending' | 'loaded' | 'failed';
  error?: Error;                         // There when it failed
}

interface ArrangementSourcesValue {      // What arrangement.sources holds. A new object only when a source is added or dropped, a status changes or a failure's error changes
  sources: ReadonlyMap<ClipSource, ArrangementSourceState>;  // Every source the arrangement's clips name. The order of the entries means nothing
  pendingCount: number;
  failedCount: number;
  isLoading: boolean;                    // True while a source is pending
}

interface AddTrackOptions {
  index?: number;                 // Where the track enters: cut to a whole number, held between 0 and the number of tracks. Left out: the end. Not a finite number: throws a TypeError, nothing changes
}

interface RemoveTrackOptions {
  undoable?: boolean;             // false: no undo step, and the track is taken out of every undo and redo state
}

/** How a mixer setter's change goes into the undo history. */
interface MixerChangeOptions {
  /** Changes with the same id, one after another, are one undo step. */
  gesture?: string;
  /** Not an undo step: the value is written into every saved state as well. */
  undoable?: false;
}
// No options: each call is an undo step. With both, undoable: false wins. Inside an open transaction an undoable
// mixer change is part of it (gesture ignored) and an abort takes it back; an undoable: false change is written into
// the transaction's base too, so an abort keeps it. A gesture step ends at another step, an undo, a redo,
// clearHistory, setTracks or a transaction (not at a take's mute, a call that changes nothing, or an undoable: false call
// that leaves the step); a gesture that ends where its step began leaves no step, and the history it found comes
// back (the redo states its first call cleared, and a step the undo limit evicted for it).

// The gesture ids of one slider: createMixerGesture() from @waveform-playlist/core (below).

interface TrackMixerValues {
  volume: number;
  muted: boolean;
  soloed: boolean;
  pan: number;
}

interface ClipBounds {
  offsetSamples: number;
  durationSamples: number;
  startSample: number;
  sourceDurationSamples: number;
}

interface Arrangement {
  // read
  getTracks(): readonly ArrangementTrack[];             // Loaded clips (AudioClip) and clips still loading (LoadingClip; isLoadingClip). The same array until the tracks change. A track's mixer fields are the values it entered with
  getMixer(): ReadonlyMap<string, TrackMixerValues>;    // Current volume, mute, solo, pan by track id (the stored mute: the take's track's is not forced). The same Map until a value changes, an entry is added or dropped, or an undo, a redo or an abort brings back another state's
  subscribe(listener: () => void): () => void;          // Once per change (tracks, mix or history), in order; returns the function that stops it
  readonly tracksVersion: number;                       // Counts changes to the tracks
  readonly mixerVersion: number;                        // Counts the changes of the current mix: the four mixer setters, an undo/redo/abort that brings back other values, the start or end of a take's mute on a current track (not entries added or dropped)

  // whole set
  setTracks(tracks: readonly ArrangementTrack[]): void; // Replace every track. Clears the undo history. An id that is in the tracks being replaced keeps its mix; any other id is seeded from the new track's fields

  // tracks
  addTrack(track: ArrangementTrack, options?: AddTrackOptions): void; // An undo step
  removeTrack(trackId: string, options?: RemoveTrackOptions): void;
  updateTrack(                                          // Changes nothing for an id no track has (the track object is still checked and may throw; a function is not called). The mix stays; a track given a new id takes its mix with it.
                                                        // In both forms a clip object the track already holds is kept as it is; every other clip is copied
    trackId: string,
    next: ArrangementTrack | ((track: ArrangementTrack) => ArrangementTrack)
  ): void;
  reorderTrack(trackId: string, toIndex: number): void;

  // clips. A clip that is still loading cannot be edited: moveClip/trimClip/splitClip warn and change nothing,
  // getClipBounds is null, constrainTrimDelta is 0, and loaded clips do not collide with it
  moveClip(trackId: string, clipId: string, deltaSamples: number): number;  // Returns the delta actually applied
  trimClip(trackId: string, clipId: string, boundary: 'left' | 'right', deltaSamples: number): void;
  splitClip(trackId: string, clipId: string, atSample: number): void; // the left half keeps clipId, the right half gets a new id
  getClipBounds(trackId: string, clipId: string): ClipBounds | null;
  constrainTrimDelta(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number
  ): number;

  // mixer (each call is an undo step, or a part of an open transaction; see
  // `MixerChangeOptions` for one step made of many calls, and for a value
  // that is no step. An undo, a redo or an abort brings back the mix of the
  // state it returns to. A value that does not change, or a track that is
  // not in the current tracks, changes nothing)
  setTrackVolume(trackId: string, volume: number, options?: MixerChangeOptions): void;
  setTrackMute(trackId: string, muted: boolean, options?: MixerChangeOptions): void;
  setTrackSolo(trackId: string, soloed: boolean, options?: MixerChangeOptions): void;
  setTrackPan(trackId: string, pan: number, options?: MixerChangeOptions): void;

  // recording mute (the track a take is recording onto)
  /**
   * The ids of the tracks a take is recording onto. The same Set until one
   * is added or removed; never write to it.
   */
  readonly recordingTrackIds: ReadonlySet<string>;
  /**
   * Mark a track as the one a take is recording onto, or clear it when the
   * take ends. Such a track plays muted: the engine's `getState().tracks`
   * and its adapter have it muted, while its mute in `getMixer()` stays as
   * it is and comes back when the take ends. This is not an undo step, and
   * undo, redo, an abort, `setTracks` and `clearHistory` do not change which
   * tracks are recording. An id that is not in the current tracks is
   * recorded too, and mutes nothing until a track of that id enters. The
   * same value changes nothing.
   */
  setTrackRecording(trackId: string, recording: boolean): void;
  /** The tracks a take is recording onto, read from the arrangement (the same set object until it changes; never write to it). */
  readonly recordingTrackIds: ReadonlySet<string>;

  // history
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  undo(): void;                                         // With a transaction open: aborts it first
  redo(): void;                                         // With a transaction open: aborts it first
  clearHistory(): void;
  beginTransaction(): void;                             // Changes made until commitTransaction are one undo step
  commitTransaction(): void;                            // No step when the tracks and the mix are back where the transaction began
  abortTransaction(): void;                             // Put the tracks and the mix back as they were when the transaction began

  // loading
  readonly sources: ValueSource<ArrangementSourcesValue>;  // Where each source is. Read with getSnapshot() or subscribe(); published after the tracks notification,
                                                        // so a subscribe() listener told of a loaded clip still reads its source as pending here.
                                                        // 'failed' is a load that failed (no track changes) or a clip in the CURRENT tracks that could not be made from its audio
                                                        // (it stays a LoadingClip; error.message is 'clip "<id>": <reason>'; other clips of the source are still loaded; a clip only an undo or redo state holds does not count)
  retry(src: ClipSource): void;                         // Start a source whose LOAD failed again. Does nothing for any other source, also one shown as failed because a clip could not be made
}

// Wanted sources: every src a LoadingClip names in the current tracks, an undo or redo state or an open transaction's base,
// plus the src of a loaded clip that carries BOTH src and audioBuffer (its buffer is used; nothing is fetched).
// A loaded clip with src and no audioBuffer is not fetched and not in `sources` (it never gets audio from the arrangement). A source no state names any more is dropped
// (its load aborted); named again, it is fetched again.
// The engine recognises an arrangement by a versioned Symbol.for key ('@waveform-playlist/engine/arrangement/time-base/v3'),
// not by instanceof, so an arrangement made by another installed copy of the package is accepted when both use the same
// key version (v1 until the mixer became undoable, v2 until addTrack took an index: copies of different key versions refuse each other).

interface EngineState {
  tracks: readonly ClipTrack[]; // Each track with its current mixer values (muted while a take records onto it) and without clips that are still loading. Shared, not a copy: never write to it. Frozen outside production builds
  tracksVersion: number;        // Monotonic counter; increments on structural track changes only
  mixerVersion: number;         // Monotonic counter; increments on every change of the current mix (the setters, an undo/redo/abort of the mix, the start or end of a take's mute on a current track)
  duration: number;             // Of the loaded clips
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
  bpm: number;                  // Current base tempo
  ppqn: number;                 // Pulses per quarter note
  canUndo: boolean;
  canRedo: boolean;
}

// Key methods on PlaylistEngine:
// Track management: setTracks(tracks: readonly ClipTrack[]), addTrack(), removeTrack(), updateTrack(), reorderTrack(), selectTrack()
// Clip editing: moveClip(), trimClip(), splitClip(), getClipBounds(), constrainTrimDelta()
// Track mix (undo steps): setTrackVolume(trackId, volume, options?: MixerChangeOptions), setTrackMute(), setTrackSolo(), setTrackPan()
// The take's mute (not an undo step; the track a take records onto plays muted): setTrackRecording(trackId: string, recording: boolean)
// History: undo(), redo(), clearHistory(), beginTransaction(), commitTransaction(), abortTransaction(), canUndo, canRedo
// Playback: play(), pause(), stop(), seek()
// State: setSelection(), setLoopRegion(), setLoopEnabled(), setMasterVolume(), setTempo()
// Zoom: zoomIn(), zoomOut(), setZoomLevel()
// Events: on(event, listener), off(event, listener)
// Lifecycle: dispose(options?: { keepAdapter?: boolean }) — keepAdapter: stop playback, let go of the
//   arrangement and onPlaybackEnded, leave the adapter undisposed for a new engine on another arrangement

// Pure operations (also exported for use without PlaylistEngine):
import { constrainClipDrag, constrainBoundaryTrim, canSplitAt, splitClip, calculateSplitPoint } from '@waveform-playlist/engine';
import { calculateDuration, clampSeekPosition, findClosestZoomIndex } from '@waveform-playlist/engine';
```

### Mixer gestures (`@waveform-playlist/core`)

```typescript
import { createMixerGesture } from '@waveform-playlist/core';
import type { MixerGesture } from '@waveform-playlist/core';
// The gesture ids of one control (one helper per slider). attach() ends the gesture on the input's `change`
// (the end of a pointer drag), except while an arrow, PageUp/PageDown, Home or End key is down: then on that
// key's `keyup` (a held key is one step). `blur` ends it too. Ids are unique per helper, also across two
// installed copies of the package. Mute and solo buttons need no helper: each click is a step.
function createMixerGesture(): MixerGesture;

interface MixerGesture {
  /** The id to pass while a gesture is going on. */
  readonly id: string;
  /** The gesture is over: the next change starts a new one. */
  end(): void;
  /** Ends the gesture on the input's own events; returns the detach function. */
  attach(input: HTMLInputElement): () => void;
}

const gesture = createMixerGesture();
const detach = gesture.attach(slider);
slider.addEventListener('input', () =>
  engine.setTrackVolume(trackId, slider.valueAsNumber, { gesture: gesture.id })
);
```

### Track events of `<daw-editor>` (`@dawcore/components`)

```typescript
import type { DawTrackUpdateDetail, DawTrackControlDetail } from '@dawcore/components';

// 'daw-track-update', fired by <daw-track> after a property changes.
interface DawTrackUpdateDetail {
  trackId: string;
  /**
   * The `<daw-track>` properties this update changed, by property name
   * (`'volume'`, `'pan'`, `'muted'`, `'soloed'`, `'src'`, `'name'`, `'kind'`,
   * `'renderMode'`, `'spectrogramConfig'`). The editor sends a mixer property
   * to the engine only when it is in this list, and one update is one undo
   * step (#843).
   */
  changed: readonly string[];
}

// 'daw-track-control', fired by <daw-track-controls> when a control moves.
interface DawTrackControlDetail {
  trackId: string;
  prop: string;
  value: number | boolean;
  /**
   * The slider's gesture id (#843): events of one volume or pan drag, or of
   * one key press, carry the same id and are one undo step. Mute and solo
   * send none: each click is a step.
   */
  gesture?: string;
}
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
  arrangement: Arrangement,       // the owner of the tracks (#812; was tracks, setTracks)
  selectedTrackId: string | null, // the track the next take is recorded onto
  options?: IntegratedRecordingOptions
): UseIntegratedRecordingReturn;
// Reads the arrangement when a take starts and ends; keeps no copy. The take is added with
// one arrangement.updateTrack() (take + punch-in carve): one undo step.

interface IntegratedRecordingOptions {
  /** Current playback/cursor position in seconds. Punch-in semantics: the
   *  recorded clip lands exactly at this position and REPLACES any existing
   *  clip content it overlaps (partial overlaps trimmed, covered clips
   *  removed, spanning clips split). */
  currentTime?: number;
  audioConstraints?: MediaTrackConstraints;
  channelCount?: number;      // Default: 1 (auto-detected from stream; fallback)
  samplesPerPixel?: number;   // Default: 1024
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
   *  starting synchronized playback (overdub). Resolves false and sets `error`
   *  ("Cannot start recording: …", naming the track), recording nothing, when no
   *  track is selected, when the arrangement holds no track of the selected id,
   *  for a MIDI track, and for a track holding a clip whose audio is not loaded
   *  (still loading, failed, or a clip that cannot be made from it). */
  startRecording: () => Promise<boolean>;
  /** Stops the take and adds it to the track it was started on: one undo step.
   *  A track gone by then, or one the arrangement refuses the take on, sets
   *  `error` ("Recording completed but …") and keeps nothing. */
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
  /** Pass usePlaylistTimeline().tracks (loaded clips only: an export during loading renders what has loaded). */
  exportWav: (tracks: readonly ClipTrack[], trackStates: readonly TrackState[], options?: ExportOptions) => Promise<ExportResult>;
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
// An Escape whose default something other than a shortcut list already prevented fires no shortcut (#848):
//   dnd-kit prevents it when it cancels a drag, so Escape during a drag only cancels the drag; an app's own
//   preventDefault() on Escape before the library's window listener also switches off Stop and the deselect.
//   Two shortcut lists that both bind Escape both run.
// Undo / redo (useEditorControls, <KeyboardShortcuts undo />) do nothing while a clip move, a clip trim or a track-reorder drag is in progress (#848).
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
  /** The track's own mute, or true while a take is recording onto it (`isRecording`). */
  muted: boolean;
  soloed: boolean;
  /** 0 to 1. */
  volume: number;
  /** -1 (left) to 1 (right). */
  pan: number;
  /** How the track is drawn. Always `'waveform'` for a MIDI track. */
  renderMode: RenderMode;

  /** Whether this is the selected track. */
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  /** True for an audio track under a `<SpectrogramProvider>`: `setRenderMode`
   *  and `openSpectrogramSettings` then do something. */
  hasSpectrogram: boolean;
  /**
   * True while a take is being recorded onto this track (`setRecordingActive`,
   * `useRecordingSession`). The track plays muted for the take and `muted` is
   * true, while the track's own mute (`arrangement.getMixer()`) is not
   * changed by the take: a mute set meanwhile stays after it (#843). The
   * built-in `<TrackMuteButton />` is disabled while this is true; an app's
   * own mute control can do the same, since toggling from `muted` here would
   * set the track's own mute from the take's mute.
   */
  isRecording: boolean;
  // Removed (#812): isLoading. The values above are the arrangement's mix also while
  // the track's audio loads, the actions work then, and the pieces are enabled.

  // Actions. Each keeps its identity while the track's slot is mounted and a
  // track menu neither becomes available nor stops being so. The four mixer
  // actions are undo steps (#843); `options` (the engine's
  // `MixerChangeOptions`) makes calls with one `gesture` id one step, or a
  // value with `undoable: false` no step.
  setMuted: (muted: boolean, options?: MixerChangeOptions) => void;
  setSoloed: (soloed: boolean, options?: MixerChangeOptions) => void;
  setVolume: (volume: number, options?: MixerChangeOptions) => void;
  setPan: (pan: number, options?: MixerChangeOptions) => void;
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
//   TrackMuteButton    "Mute", aria-pressed; disabled while a take is recorded onto the track
//   TrackSoloButton    "Solo", aria-pressed
//   TrackVolumeSlider  0 to 1, aria-label "Volume"
//   TrackPanSlider     -1 to 1, aria-label "Pan"
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
//   the slot that holds the panel has data-track-controls="<track id>"; a reorder drag
//   moves the slot around it. No reorder remounts a slot, so state inside a panel survives.
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
// The list (AnnotationList, AnnotationText with a store) calls `action` with copies of the
// store's list as it is at the click: a new array and a copy of each annotation with its
// `lines`, so the action changes them in place. `index` is the position in that list. The
// result is written with store.update; annotations the action left unchanged keep their objects.
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
// the track is marked in the arrangement as the take's (setTrackRecording,
// #843), which plays it muted and is no undo step: trackStates and its Mute
// button show it muted, its <TrackMuteButton /> is disabled,
// useTrack().isRecording is true, and arrangement.getMixer() keeps the
// track's own mute (a mute changed during the take stays after it). The
// take's mute is cleared when the take ends, the track changes, this
// component unmounts or the provider unmounts. play() does nothing before
// the first ready, so a take started during the first load records without
// playback.
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
// Theme key placeholderClipOpacity (optional, 0.5 without it or with a value that is not a number from 0 to 1): the opacity of a Clip with isPlaceholder, header included.
interface ClipPlaceholderBodyProps {
  isSelected?: boolean; // the selected bar colour (selectedWaveFillColor). Default false
}
// <ClipPlaceholderBody /> (#812): the body of a placeholder Clip with no peaks: a box over the clip's
// channel area (its width, the height below the header) in the colour of the waveform's bars
// (waveFillColor; selectedWaveFillColor with isSelected; 'grey' when the theme gives no usable colour).
// data-clip-placeholder-body="true". Sets no opacity: render it as a child of <Clip isPlaceholder>, which dims it.
const ClipPlaceholderBody: React.FC<ClipPlaceholderBodyProps>;
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

Catches render errors in child components. Uses plain CSS (works without ThemeProvider). A track the arrangement refuses in the `useCreateArrangement` initializer is a render error of the component that calls the hook, so the boundary goes around THAT component (a boundary inside it, around the provider, does not catch it):

```tsx
function Editor() {
  const arrangement = useCreateArrangement(() => [audioTrack({ src: '/vocals.mp3' })]);
  return (
    <WaveformPlaylistProvider arrangement={arrangement}>
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

<PlaylistErrorBoundary fallback={<p>The playlist could not be created.</p>}>
  <Editor />
</PlaylistErrorBoundary>
```

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

<WaveformPlaylistProvider arrangement={arrangement}>
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
// in @waveform-playlist/core; browser and ui-components do not export it:
//   { canvasId, canvas, clipId, channelIndex, chunkIndex, widthPx, heightPx,
//     offsetSamples?, durationSamples? }
// offsetSamples / durationSamples: the range of the audio the canvas is drawn for (the view
// draws a trim being dragged before the tracks have it); SpectrogramProvider draws a clip for
// the range its canvases registered with, and for the clip's own when they are omitted.
// SpectrogramChannel (ui-components) takes them as optional props of the same names (SmartChannel:
// spectrogramOffsetSamples, spectrogramDurationSamples) and mounts new canvases when they change.
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
