---
sidebar_position: 6
title: LLM API Reference
description: Machine-readable API reference for LLMs and coding agents. All TypeScript interfaces from source.
---

# LLM API Reference

This page contains all TypeScript interfaces extracted from source code. Designed for LLMs and coding agents — no prose, just types.

**Source of truth:** `packages/browser/src/WaveformPlaylistContext.tsx`, `packages/browser/src/MediaElementPlaylistContext.tsx`

**Requirements:** the React packages need `react` / `react-dom` `^19.0.0` and `styled-components` `^6.0.0`.

**Upgrading from an earlier major:** see the [upgrade guide](./react/upgrading.md) — one Find / Replace-with entry per breaking change.

---

## Provider Props (WaveformPlaylistProvider)

```typescript
interface WaveformPlaylistProviderProps {
  tracks: ClipTrack[];
  children: ReactNode;
  timescale?: boolean;
  mono?: boolean;
  waveHeight?: number;                    // Default: 80
  samplesPerPixel?: number;               // Default: 1024
  zoomLevels?: number[];
  automaticScroll?: boolean;              // Default: false
  theme?: Partial<WaveformPlaylistTheme>;
  controls?: { show: boolean; width: number }; // Default: { show: false, width: 0 }
  annotationList?: {
    annotations?: AnnotationData[];
    editable?: boolean;
    isContinuousPlay?: boolean;
    linkEndpoints?: boolean;
    controls?: AnnotationAction[];
  };
  effects?: EffectsFunction;
  /** A track's effects function by track id (`getTrackEffectsFunction` from
   *  `useTrackDynamicEffects()`). Tracks carry no `effects` field. Called when a
   *  track's audio graph is built; a new function identity rebuilds nothing. */
  trackEffects?: (trackId: string) => TrackEffectsFunction | undefined;
  onReady?: () => void;
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  /** Called when engine clip operations (move/trim/split) update tracks */
  onTracksChange?: (tracks: ClipTrack[]) => void;
  barWidth?: number;                      // Default: 1
  barGap?: number;                        // Default: 0
  roundedBars?: boolean;                  // Default: false — pill caps, radius barWidth/2
  progressBarWidth?: number;              // Default: barWidth + barGap
  /** Defer engine build during progressive loading — tracks render but engine isn't built */
  deferEngineRebuild?: boolean;           // Default: false
  /** SoundFont cache for sample-based MIDI playback */
  soundFontCache?: SoundFontCache;
  /** Disable end-of-timeline auto-stop — roll until explicit stop (DAW style). Implies fillViewport.
   *  Recording sessions suppress the auto-stop automatically. */
  indefinitePlayback?: boolean;           // Default: false
  /** Timeline visually fills the scroll container even when audio is shorter (layout only) */
  fillViewport?: boolean;                 // Default: false
  /** Desired AudioContext sample rate for pre-computed peaks matching */
  sampleRate?: number;
  /** Supply a custom playout adapter — skips dynamic import of @waveform-playlist/playout + tone */
  createAdapter?: () => PlayoutAdapter;
}
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
  waveHeight?: number;                   // Default: 100
  timescale?: boolean;                   // Default: false
  playbackRate?: number;                 // Default: 1 (range: 0.5–2.0)
  preservesPitch?: boolean;              // Default: true (set false for external pitch processor)
  automaticScroll?: boolean;             // Default: false
  theme?: Partial<WaveformPlaylistTheme>;
  controls?: { show: boolean; width: number }; // Default: { show: false, width: 0 }
  annotationList?: {
    annotations?: any[];
    isContinuousPlay?: boolean;
  };
  onAnnotationsChange?: (annotations: AnnotationData[]) => void;
  onReady?: () => void;                  // the media element has loaded its metadata; once per player. Pass a stable function
  onError?: (error: Error) => void;      // player could not be created, or the media failed (also mid-playback, which ends playback); the provider adds no URL to the message. Pass a stable function
  barWidth?: number;                     // Default: 1
  barGap?: number;                       // Default: 0
  roundedBars?: boolean;                 // Default: false — pill caps, radius barWidth/2
  progressBarWidth?: number;             // Default: barWidth + barGap
  /** Supply a custom MediaElementPlayout — skips dynamic import of @waveform-playlist/media-element-playout.
   *  It must implement on() and emit 'loadedmetadata' (without it isReady never turns true).
   *  The provider also listens for 'timeupdate', 'error' and 'playrejected'. */
  createPlayout?: () => MediaElementPlayout;
}
```

---

## MediaElement Context Hooks

### useMediaElementAnimation()

```typescript
interface MediaElementAnimationContextValue {
  isPlaying: boolean;
  currentTime: number;
  currentTimeRef: RefObject<number>;
}
```

### useMediaElementState()

```typescript
interface MediaElementStateContextValue {
  continuousPlay: boolean;
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  playbackRate: number;
  isAutomaticScroll: boolean;
}
```

### useMediaElementControls()

```typescript
interface MediaElementControlsContextValue {
  // Same rules as WaveformPlaylistProvider's controls.
  // play: from startTime (default: the cursor); with playDuration it stops by itself and the
  // cursor rests at the range's end, or at the selection's START when the range is the
  // highlighted selection (start inside it, end at its end). Queued if the player does not exist yet.
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;                      // cursor returns to where playback started (not to 0); while already stopped it does not move
  seekTo: (time: number) => void;        // while playing: restarts playback at `time`
  setPlaybackRate: (rate: number) => void;
  setContinuousPlay: (enabled: boolean) => void;
  setAnnotations: Dispatch<SetStateAction<AnnotationData[]>>;
  annotationPreview: ValueSourceHandle<AnnotationData[] | null>; // edge drag in progress; stable
  setActiveAnnotationId: (id: string | null) => void;
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;
}
```

### useMediaElementData()

```typescript
interface MediaElementDataContextValue {
  duration: number;                      // track.waveformData.duration, from the first render (never "0 until loaded")
  isReady: boolean;                      // media element has loaded its metadata; false again while a replaced player loads. Do NOT gate Play on it: play() before ready is queued or started, and some browsers load metadata only on play
  peaksDataArray: TrackClipPeaks[];
  sampleRate: number;
  waveHeight: number;
  timeScaleHeight: number;
  samplesPerPixel: number;
  playoutRef: RefObject<MediaElementPlayout | null>; // .outputNode for effects bridge
  controls: { show: boolean; width: number };
  barWidth: number;
  barGap: number;
  roundedBars: boolean;
  progressBarWidth: number;
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
}
```

---

## WaveformPlaylist Context Hooks

One hook per group of fields that change together; a component re-renders only for the hooks it calls. All require `WaveformPlaylistProvider`. The value types below are exported from `@waveform-playlist/browser`, with `ClipPeaks`, `TrackClipPeaks`, `TrackDragPreview`, `TrackState` and `FrameData`. They replace the three combined data / state / animation hooks of earlier majors — field-to-hook table in the [upgrade guide](./react/upgrading.md).

### useIsPlaying()

```typescript
// Re-renders on play, pause and stop.
interface IsPlayingContextValue {
  isPlaying: boolean;
}
```

### usePlaybackRefs()

```typescript
interface FrameData {
  readonly time: number;          // Raw engine time (state/logic — NOT visual positioning)
  readonly visualTime: number;    // engine.getAudibleTime() while playing, raw time when resting (use for DOM positioning)
  readonly sampleRate: number;
  readonly samplesPerPixel: number;
}

// Refs and functions that keep their identity for the life of the provider.
// Calling this hook NEVER re-renders the component. Read a ref's .current in an
// event handler, an effect or a frame callback, not during render. A component
// that shows the stopped position from currentTimeRef.current (in render, or in
// an effect without deps) must ALSO call useCurrentTime(); one that needs to
// follow play/stop calls useIsPlaying(); one that needs tracks/duration/isReady
// calls usePlaylistTimeline(). TypeScript does not flag a missing call.
interface PlaybackRefsContextValue {
  currentTimeRef: RefObject<number>;   // live position; read it in callbacks and frame callbacks
  /** Visually-aligned playback time: engine.getAudibleTime() (raw − outputLatency − engine.lookAhead) while playing, raw time when resting. */
  visualTimeRef: RefObject<number>;
  playbackStartTimeRef: RefObject<number>;   // context.currentTime when playback started
  audioStartPositionRef: RefObject<number>;  // audio position when playback started
  /** Raw playback time from engine (auto-wraps at loop boundaries). */
  getPlaybackTime: () => number;
  /** Current time of the adapter's AudioContext, in seconds. */
  getAudioContextTime: () => number;
  /** Current adapter scheduler lookahead (Tone ~0.1s, native 0). */
  getLookAhead: () => number;
  /** AudioContext.outputLatency from the playout adapter. */
  getOutputLatency: () => number;
  /** Register/unregister per-frame callbacks driven by the shared rAF loop. */
  registerFrameCallback: (id: string, cb: (data: FrameData) => void) => void;
  unregisterFrameCallback: (id: string) => void;
  /** The engine (PlaylistEngine from @waveform-playlist/engine). current is null until the first build and during a rebuild. */
  playoutRef: RefObject<PlaylistEngine | null>;
  /** Ref set during boundary trim drags — when true, loadAudio skips engine rebuild */
  isDraggingRef: MutableRefObject<boolean>;
}
```

### useSelection()

```typescript
// The selected time range in seconds. Its own context: it changes on every
// pointer move of a selection drag.
// WaveformPlaylistProvider only. Set it with usePlaylistControls().setSelection(start, end).
interface SelectionContextValue {
  selectionStart: number;       // selectionStart === selectionEnd: nothing selected
  selectionEnd: number;
}
```

### useCurrentTime()

```typescript
// Where the cursor rests, in seconds. Its own context: it changes on every seek,
// pause and stop, and on every pointer move of a leftward selection drag.
// It does NOT advance during playback (use currentTimeRef or registerFrameCallback
// from usePlaybackRefs() for that).
// WaveformPlaylistProvider only. Set it with usePlaylistControls().seekTo(t) or .setCurrentTime(t).
interface CurrentTimeContextValue {
  currentTime: number;
}
```

### useActiveAnnotation()

```typescript
// The annotation that is playing or was last chosen. Its own context: it changes
// at every annotation boundary during playback.
// WaveformPlaylistProvider only. Set it with usePlaylistControls().setActiveAnnotationId(id).
interface ActiveAnnotationContextValue {
  activeAnnotationId: string | null;
}
```

### usePlaylistAnnotations()

```typescript
// Re-renders on an annotation edit and on an annotation settings toggle; an edge
// drag that uses the preview source changes it once, on release.
interface PlaylistAnnotationsContextValue {
  annotations: AnnotationData[];
  annotationsEditable: boolean;
  linkEndpoints: boolean;
  continuousPlay: boolean;             // annotation playback: off = stop at the annotation's end, on = continue. No effect on selection playback (Play/Space with a selection plays it start to end)
}
```

### useLoop()

```typescript
// Loop region (separate from the selection). Re-renders on a loop change.
interface LoopContextValue {
  isLoopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}
```

### useSelectedTrackId()

```typescript
// Re-renders when another track is selected.
interface SelectedTrackIdContextValue {
  selectedTrackId: string | null;
}
```

### useUndoRedo()

```typescript
// Re-renders after an edit.
interface UndoRedoContextValue {
  canUndo: boolean;
  canRedo: boolean;
}
```

### usePlaylistControls()

```typescript
interface PlaylistControlsContextValue {
  // Playback
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setCurrentTime: (time: number) => void;

  // Track controls
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, soloed: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackPan: (trackIndex: number, pan: number) => void;
  /** Move a track to a new position in the track order (undoable). Purely
   *  organizational — never rebuilds the audio adapter. Clamps toIndex, no-ops
   *  on an unknown trackId or a same-index move. */
  reorderTrack: (trackId: string, toIndex: number) => void;

  // Selection
  setSelection: (start: number, end: number) => void;
  setSelectedTrackId: (trackId: string | null) => void;

  // Time format
  setTimeFormat: (format: TimeFormat) => void;

  // Zoom
  zoomIn: () => void;
  zoomOut: () => void;

  // Master volume
  setMasterVolume: (volume: number) => void;

  // Scroll
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: RefObject<HTMLDivElement | null>;

  // Annotation controls
  setContinuousPlay: (enabled: boolean) => void;
  setLinkEndpoints: (enabled: boolean) => void;
  setAnnotationsEditable: (enabled: boolean) => void;
  setAnnotations: Dispatch<SetStateAction<AnnotationData[]>>;
  annotationPreview: ValueSourceHandle<AnnotationData[] | null>; // edge drag in progress; stable
  setActiveAnnotationId: (id: string | null) => void;

  // Loop controls
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setLoopRegionFromSelection: () => void;
  clearLoopRegion: () => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;

  // Recording
  /** Mark a recording session active/inactive. While active: (1) the end-of-audio
   *  auto-stop is suppressed so overdub playback runs past existing material, and
   *  (2) with an armedTrackId, that track's existing content is transiently muted
   *  (punch-in replaces what the take overlaps) and restored when the session ends
   *  — audio-only, the UI mute control is untouched. Auto-wired from the Waveform
   *  recordingState prop; overdub flows should also call it eagerly (before play()). */
  setRecordingActive: (active: boolean, armedTrackId?: string | null) => void;
}
```

### usePlaylistView()

```typescript
// What the provider was configured with. Re-renders on a prop change (and once
// when the real sample rate is known), not on a settings click, never during an
// interaction.
interface PlaylistViewContextValue {
  sampleRate: number;
  waveHeight: number;
  timeScaleHeight: number;
  controls: { show: boolean; width: number };
  barWidth: number;
  barGap: number;
  roundedBars: boolean;
  progressBarWidth: number;
  mono: boolean;
  /** Whether playback rolls past the end instead of auto-stopping (implies fillViewport) */
  indefinitePlayback: boolean;
  /** Whether the timeline visually fills the scroll container (layout only) */
  fillViewport: boolean;
}
```

### usePlaylistSettings()

```typescript
// The two settings a user toggles. Re-renders when the user changes either.
// Apart from the view value because every clip's progress overlay and the
// visualization read that one.
interface PlaylistSettingsContextValue {
  timeFormat: TimeFormat;
  isAutomaticScroll: boolean;
}
```

### usePlaylistZoom()

```typescript
// Re-renders on a zoom.
interface PlaylistZoomContextValue {
  samplesPerPixel: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
}
```

### usePlaylistTimeline()

```typescript
// Re-renders on every clip operation, on every pointer move of a trim and on a
// zoom (peaksDataArray is computed per zoom level); also when loading finishes
// (isReady) and when peaks arrive. Call it
// only in a component that draws tracks or needs the timeline length during render.
interface PlaylistTimelineContextValue {
  tracks: ClipTrack[];
  peaksDataArray: TrackClipPeaks[];
  duration: number;
  isReady: boolean;
  onTracksChange: ((tracks: ClipTrack[]) => void) | undefined;
}
```

### usePlaylistMixer()

```typescript
// Re-renders on every mute, solo, volume or pan change (each step of a slider
// drag), and when tracks are added, removed or reordered.
interface PlaylistMixerContextValue {
  trackStates: TrackState[];
  masterVolume: number;
}
```

### useTrackReorderPreview()

```typescript
// Re-renders on every drag-over of a track reorder.
interface TrackReorderPreviewContextValue {
  /** Non-null while a track-reorder drag is live; null otherwise */
  trackDragPreview: TrackDragPreview | null;
  /** Incremented after every track-reorder drag ends. A custom renderTrackControls
   *  that mounts SortableTrackControls itself folds it into its panel keys. */
  trackReorderEpoch: number;
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
  /** The clip's linear gain — drawn into the waveform under `<Waveform gainScaledWaveforms />`. */
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
  preview?: AnnotationPreviewHandle; // `annotationPreview` from usePlaylistControls() / useMediaElementControls()
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

With `preview`, each move is published to it (the built-in annotation boxes and list follow it) and `onAnnotationsChange` is called once, on release. Without it, `onAnnotationsChange` is called on every move. Either way a cancelled drag (Escape) restores every annotation the drag moved. `MediaElementWaveform`'s built-in boxes always drag with the preview.

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
  /** Ref toggled during boundary trim drags. Obtain from usePlaybackRefs(). */
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
type SnapTo = 'bar' | 'beat' | 'off';

type SnapToGridOptions =
  | { mode: 'beats'; snapTo: SnapTo; bpm: number; timeSignature: [number, number]; samplesPerPixel: number; sampleRate: number }
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
<Waveform recordingState={{ isRecording: true, trackId, startSample, progress, bits: 16 }} />

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
   *  Pass the same value to recordingState.latencyOffset so the live preview matches the finalized clip. */
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
   *  hook does not re-render as they change. Pass to <Waveform recordingState>. */
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
// Default shortcuts: Space (play/pause), Escape (stop), 0 (rewind)
// Space starts playback exactly as <PlayButton> does: the highlighted selection (looping off), else from the cursor.
// With the cursor inside the selection (e.g. paused there) both resume from the cursor to the selection's end.
// setSelection(start, end) during playback: a range restarts and plays start -> end; a collapsed selection continues open-ended.
// A shortcut is skipped when the focused control uses the key itself, however it got focus:
//   - input (every type, incl. range and checkbox), textarea, select, contenteditable: every key
//   - Escape while a modal <dialog> or [aria-modal="true"] is open
//   - Space / Enter on a focused <button> or <summary>; Enter (not Space) on a focused <a href>
//   - while an input/select/textarea has focus NO shortcut fires (incl. undo, split)
//   - so after clicking Mute, Space toggles Mute again; Space is play/pause when focus is not on a control
//   - elements with only an ARIA role (<div role="button">) are NOT covered
```

---

## Waveform Component Props

```typescript
interface WaveformProps {
  renderTrackControls?: (trackIndex: number) => ReactNode;
  // label: "m:ss" in the temporal scale, bar.beat (e.g. "2.3") in beats mode. There is no renderTimestamp.
  renderTick?: (label: string, pixelPosition: number) => ReactNode;
  renderPlayhead?: RenderPlayheadFunction;
  renderAnnotationItem?: (props: RenderAnnotationItemProps) => ReactNode;
  getAnnotationBoxLabel?: GetAnnotationBoxLabelFn;
  annotationControls?: AnnotationAction[];
  annotationListConfig?: AnnotationActionOptions;
  annotationTextHeight?: number;
  scrollActivePosition?: ScrollLogicalPosition;
  scrollActiveContainer?: 'nearest' | 'all';
  className?: string;
  showClipHeaders?: boolean;      // Default: false
  gainScaledWaveforms?: boolean;  // Default: false. Draw each clip's waveform scaled by clip.gain (clamped)
  showFades?: boolean;
  onRemoveTrack?: (trackIndex: number) => void;
  /** Enable vertical track reordering: a drag grip + move up/down buttons on
   *  each default track control panel. Drag requires ClipInteractionProvider;
   *  the buttons work regardless. Default: false. */
  trackReordering?: boolean;
  recordingState?: {
    isRecording: boolean;
    trackId: string;
    startSample: number;
    /** The take's elapsed time and per-channel preview peaks, from
     *  useRecording / useIntegratedRecording. Only the preview clip follows
     *  it frame by frame. While recording, the displayed timeline grows in
     *  10-second steps. */
    progress: RecordingProgressSource;
    bits: 8 | 16;                       // Bit depth of peak values
    /** Latency to skip in live preview, in seconds. Must match the latencyOffset passed to
     *  useIntegratedRecording so the preview aligns with the finalized clip.
     *  Omit to use the auto-computed value. */
    latencyOffset?: number;
  };
}
```

---

## Pre-built Components

```
Buttons (from @waveform-playlist/browser):
         PlayButton, PauseButton, StopButton, RewindButton, FastForwardButton,
         SkipBackwardButton, SkipForwardButton, LoopButton, SetLoopRegionButton,
         ZoomInButton, ZoomOutButton, DownloadAnnotationsButton
Buttons (from @waveform-playlist/browser/tone):
         ExportWavButton
Controls: MasterVolumeControl, TimeFormatSelect, AudioPosition, SelectionTimeInputs
Checkboxes: AutomaticScrollCheckbox, ContinuousPlayCheckbox, LinkEndpointsCheckbox, EditableCheckbox
Playheads: Playhead, PlayheadWithMarker (from @waveform-playlist/ui-components)
Error Handling: PlaylistErrorBoundary (from @waveform-playlist/ui-components)
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

Declarative wrapper that encapsulates all clip drag/move/trim/snap/collision setup. Replaces manual `DragDropProvider` + `useClipDragHandlers` + `useDragSensors` + modifier configuration. Every clip below it (under `Waveform` or `PlaylistVisualization`) can be dragged and trimmed: the provider renders `ClipInteractionOptions` (next), which is the only source of that; `Waveform` has no `interactiveClips` or `touchOptimized` prop. When `snap` is enabled, reads `BeatsAndBarsProvider` context: if `scaleMode="beats"` and `snapTo!="off"`, clips snap to beats/bars; otherwise falls back to timescale-based snapping.

#### `ClipInteractionOptions`

```typescript
import { ClipInteractionOptions } from '@waveform-playlist/browser';

interface ClipInteractionOptionsProps {
  enabled?: boolean;         // Clips below can be dragged and trimmed. Left out: inherited (false at the top)
  touchOptimized?: boolean;  // Clips below get 24px trim handles instead of 8px. Left out: inherited (false at the top)
  children: React.ReactNode;
}
```

The one source of the two clip interaction options; each clip reads them from this context. Use it with your own `DragDropProvider` (`<ClipInteractionOptions enabled><Waveform showClipHeaders /></ClipInteractionOptions>`; without `enabled`, clips show no trim handles and their headers do not drag), or nested inside a `ClipInteractionProvider` to change one option for part of the tree (`<ClipInteractionOptions touchOptimized={false}>` keeps 8px handles under a touch-optimized provider). It configures no sensors: pair `touchOptimized` with `useDragSensors({ touchOptimized: true })`.

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

Self-closing component that sets up keyboard shortcuts declaratively. Must be inside `WaveformPlaylistProvider`. Reads all required data (tracks, sampleRate, samplesPerPixel, annotations, etc.) from context internally. Replaces manual `usePlaybackShortcuts` + `useClipSplitting` + `useAnnotationKeyboardControls` wiring.

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
type SnapTo = 'bar' | 'beat' | 'off';

interface BeatsAndBarsProviderProps {
  bpm: number;
  timeSignature: [number, number];     // [numerator, denominator]
  snapTo: SnapTo;
  children: React.ReactNode;
}

interface BeatsAndBarsContextValue {
  bpm: number;
  timeSignature: [number, number];
  snapTo: SnapTo;
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
export type { SpectrogramIntegration, SpectrogramWorkerApi } from '@waveform-playlist/browser';
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

// Keyboard
getShortcutLabel(shortcut: KeyboardShortcut): string;
// Returns e.g. "Cmd+Shift+S" on Mac, "Ctrl+Shift+S" on Windows
```
