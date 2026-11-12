---
sidebar_position: 3
description: "React hooks API reference for playback, state, controls, effects, recording, and export"
---

# Hooks

React hooks for accessing playlist state and controls.

## Import

```tsx
import {
  // Core context hooks
  usePlaylistState,
  useSelection,
  useCurrentTime,
  useActiveAnnotation,
  usePlaylistControls,
  usePlaylistData,
  usePlaybackAnimation,

  // Specialized hooks
  useTimeFormat,

  // Engine-delegation hooks (internal, used by provider)
  useSelectionState,
  useLoopState,
  useSelectedTrack,
  useZoomControls,
  useMasterVolume,

  // Drag & drop
  useClipDragHandlers,
  useDragSensors,

  // Clip editing
  useClipSplitting,

  // Keyboard shortcuts
  useKeyboardShortcuts,
  usePlaybackShortcuts,
} from '@waveform-playlist/browser';

// Tone.js batteries-included hooks (import from /tone to keep core bundle engine-free)
import {
  useAudioTracks,
  useDynamicTracks,
  useDynamicEffects,
  useTrackDynamicEffects,
  useExportWav,
  useOutputMeter,
} from '@waveform-playlist/browser/tone';

// Recording primitives (lower-level hooks)
import {
  useMicrophoneAccess,
  useRecording,
  useMicrophoneLevel,
  useRecordingProgress,
} from '@waveform-playlist/recording';

// Throttled React state from a meter or any other value source
import { useMeterLevels, useThrottledValue } from '@waveform-playlist/ui-components';

// Annotation hooks
import {
  useAnnotationControls,
} from '@waveform-playlist/annotations';
```

---

## Core Context Hooks

These hooks access the playlist context provided by `WaveformPlaylistProvider`.

### usePlaylistData

Access static playlist configuration, refs, and loading state.

```typescript
function usePlaylistData(): {
  // Audio data
  sampleRate: number;
  duration: number;
  tracks: ClipTrack[];
  trackStates: TrackState[];
  peaksDataArray: TrackClipPeaks[];

  // Display settings
  samplesPerPixel: number;
  waveHeight: number;
  timeScaleHeight: number;
  mono: boolean;
  masterVolume: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  controls: { show: boolean; width: number };
  timeFormat: TimeFormat;
  barWidth: number;
  barGap: number;
  roundedBars: boolean;
  progressBarWidth: number;

  // Refs for direct access
  playoutRef: RefObject<PlaylistEngine | null>;  // from @waveform-playlist/engine
  isDraggingRef: MutableRefObject<boolean>;       // true during boundary trim drags

  // Track reordering
  /** Non-null while a track-reorder drag is live; null otherwise. Custom
   *  renderTrackControls consumers read this to mirror the drag preview. */
  trackDragPreview: TrackDragPreview | null;

  // Loading state
  isReady: boolean;  // True when all tracks are loaded

  // Callback
  onTracksChange: ((tracks: ClipTrack[]) => void) | undefined;
};
```

### usePlaybackAnimation

Access playback state, timing refs, and the per-frame animation registry. A single `requestAnimationFrame` loop inside the provider drives all visual updates; components register callbacks instead of spinning their own loops.

```typescript
interface FrameData {
  /** Raw engine time (use for state/logic — NOT for visual positioning). */
  readonly time: number;
  /** engine.getAudibleTime() while playing, raw time when resting. Use for any DOM
   *  positioning that should match the audible output. */
  readonly visualTime: number;
  readonly sampleRate: number;
  readonly samplesPerPixel: number;
}

function usePlaybackAnimation(): {
  isPlaying: boolean;

  // Refs for 60fps animation loops (read inside frame callbacks or rAF)
  currentTimeRef: RefObject<number>;
  /** Visually-aligned playback time: engine.getAudibleTime() (raw − outputLatency −
   *  lookAhead) while playing, raw time when resting. Read this for any static
   *  playhead positioning that should match the audible output. */
  visualTimeRef: RefObject<number>;
  playbackStartTimeRef: RefObject<number>;
  audioStartPositionRef: RefObject<number>;

  /** Raw playback time from engine (auto-wraps at loop boundaries). */
  getPlaybackTime: () => number;
  /** Current adapter scheduler lookahead (Tone ~0.1s, native 0). Use for any
   *  audible-latency calculation that must match the playhead. */
  getLookAhead: () => number;

  /** AudioContext.currentTime from the playout adapter (raw hardware clock). */
  getAudioContextTime: () => number;
  /** AudioContext.outputLatency from the playout adapter. */
  getOutputLatency: () => number;
  /** Register a per-frame callback driven by the shared animation loop. */
  registerFrameCallback: (id: string, cb: (data: FrameData) => void) => void;
  unregisterFrameCallback: (id: string) => void;
};
```

#### Example

Use `registerFrameCallback` rather than your own `requestAnimationFrame` loop — it shares the provider's single rAF, runs only while playing, and hands you a fresh `FrameData` so closure values can't go stale during zoom changes.

```tsx
function AnimatedPlayhead() {
  const { registerFrameCallback, unregisterFrameCallback } = usePlaybackAnimation();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    registerFrameCallback('playhead', ({ visualTime, sampleRate, samplesPerPixel }) => {
      if (!ref.current) return;
      const pixels = (visualTime * sampleRate) / samplesPerPixel;
      ref.current.style.transform = `translateX(${pixels}px)`;
    });
    return () => unregisterFrameCallback('playhead');
  }, [registerFrameCallback, unregisterFrameCallback]);

  return <div ref={ref} className="playhead" />;
}
```

For static positioning when playback is stopped (initial render, after pause/seek), read `visualTimeRef.current` instead — the loop keeps it current outside of playback too.

---

## useAudioTracks

Load and decode audio files into track objects.

### Signature

```typescript
function useAudioTracks(configs: AudioTrackConfig[]): {
  tracks: ClipTrack[];
  loading: boolean;
  error: string | null;
  loadedCount: number;
  totalCount: number;
};
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `configs` | `AudioTrackConfig[]` | Array of audio configurations |

### AudioTrackConfig

```typescript
interface AudioTrackConfig {
  id?: string;               // Track id (default: generated). Must be unique
  src?: string;              // URL to audio file
  audioBuffer?: AudioBuffer; // Pre-loaded AudioBuffer (skips fetch/decode)
  name?: string;             // Display name
  startTime?: number;        // Start position in seconds
  duration?: number;         // Clip duration in seconds
  offset?: number;           // Offset into source audio in seconds
  waveformData?: WaveformDataObject; // Pre-computed BBC audiowaveform data
  volume?: number;           // Initial volume 0-1
  muted?: boolean;           // Start muted
  soloed?: boolean;          // Start soloed
  pan?: number;              // Pan position -1 to 1
  color?: string;            // Waveform color
  fadeIn?: Fade;             // Fade in configuration
  fadeOut?: Fade;            // Fade out configuration
}
```

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `tracks` | `ClipTrack[]` | Loaded track objects |
| `loading` | `boolean` | Loading state |
| `error` | `string \| null` | Error message |
| `loadedCount` | `number` | Number of configs that have finished loading |
| `totalCount` | `number` | Total number of configs |

### Example

```tsx
const { tracks, loading, error, loadedCount, totalCount } = useAudioTracks([
  { src: '/audio/track1.mp3', name: 'Track 1' },
  { src: '/audio/track2.mp3', name: 'Track 2', startTime: 5 },
]);

if (loading) return <div>Loading {loadedCount} / {totalCount}…</div>;
if (error) return <div>Error: {error}</div>;
```

---

## useDynamicTracks

Imperative hook for adding tracks at runtime (drag-and-drop, file picker). Complements `useAudioTracks` which is declarative (configs-driven).

Placeholder tracks with `clips: []` appear instantly while audio decodes in parallel. Each placeholder is atomically replaced with the loaded track on success, or removed on error.

### Signature

```typescript
function useDynamicTracks(): UseDynamicTracksReturn;
```

### TrackSource

```typescript
type TrackSource =
  | File                            // Drag-and-drop / file input
  | Blob                            // Raw audio blob
  | string                          // URL shorthand
  | { src: string; name?: string }; // URL with optional name
```

### Returns

| Property | Type | Description |
|----------|------|-------------|
| `tracks` | `ClipTrack[]` | Current tracks (placeholders + loaded) |
| `addTracks` | `(sources: TrackSource[]) => void` | Add files or URLs at runtime |
| `removeTrack` | `(trackId: string) => void` | Remove a track by id. Aborts in-flight fetch if still loading. |
| `loadingCount` | `number` | Number of sources currently decoding |
| `isLoading` | `boolean` | `true` when any source is still decoding |
| `errors` | `TrackLoadError[]` | Tracks that failed to load (removed from `tracks` automatically) |

### TrackLoadError

```typescript
interface TrackLoadError {
  name: string;   // Display name of the source that failed
  error: Error;   // The underlying error
}
```

### Example

```tsx
function DragDropPlaylist() {
  const { tracks, addTracks, removeTrack, loadingCount, isLoading, errors } = useDynamicTracks();

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    if (files.length > 0) addTracks(files);
  };

  return (
    <div>
      <div onDrop={handleDrop} onDragOver={(e) => e.preventDefault()}>
        {isLoading
          ? `Decoding ${loadingCount} file(s)...`
          : 'Drop audio files here'}
      </div>

      {tracks.length > 0 && (
        <WaveformPlaylistProvider tracks={tracks}>
          <Waveform onRemoveTrack={(index) => removeTrack(tracks[index].id)} />
        </WaveformPlaylistProvider>
      )}
    </div>
  );
}
```

---

## useSelection

The selected time range, in seconds. It has its own context because it changes on every pointer move of a selection drag; a component that calls this hook re-renders that often, and components that only call `usePlaylistState()` do not.

### Signature

```typescript
function useSelection(): SelectionContextValue;
```

### Returns

```typescript
interface SelectionContextValue {
  /** Equal to `selectionEnd` when nothing is selected */
  selectionStart: number;
  selectionEnd: number;
}
```

### Example

```tsx
function SelectionReadout() {
  const { selectionStart, selectionEnd } = useSelection();
  const { setSelection } = usePlaylistControls();

  if (selectionStart === selectionEnd) return <span>No selection</span>;

  return (
    <span>
      {selectionStart.toFixed(2)}s to {selectionEnd.toFixed(2)}s{' '}
      <button onClick={() => setSelection(0, 0)}>Clear</button>
    </span>
  );
}
```

Available inside `WaveformPlaylistProvider` only.

---

## useCurrentTime

Where the cursor rests, in seconds: the position playback starts from. It changes on a seek (`seekTo`, `setCurrentTime`), a pause, a stop (including playback reaching the end) and a selection whose start moves. It does **not** advance during playback; for a live position read `currentTimeRef` or register a frame callback, both from `usePlaybackAnimation()`.

It has its own context so that a component reading `isPlaying` or a ref from `usePlaybackAnimation()` is not re-rendered by every seek, nor by every pointer move of a selection drag to the left.

### Signature

```typescript
function useCurrentTime(): CurrentTimeContextValue;
```

### Returns

```typescript
interface CurrentTimeContextValue {
  /** Where the cursor rests, in seconds. Does not advance during playback. */
  currentTime: number;
}
```

### Example

```tsx
function CursorReadout() {
  const { currentTime } = useCurrentTime();
  return <span>Cursor at {currentTime.toFixed(2)}s</span>;
}
```

Available inside `WaveformPlaylistProvider` only.

---

## useActiveAnnotation

The id of the annotation that is playing or was last chosen, or `null`. It has its own context because it changes at every annotation boundary during playback; a component that calls this hook re-renders that often, and components that only call `usePlaylistState()` do not.

### Signature

```typescript
function useActiveAnnotation(): ActiveAnnotationContextValue;
```

### Returns

```typescript
interface ActiveAnnotationContextValue {
  /** The annotation that is playing or was last chosen */
  activeAnnotationId: string | null;
}
```

### Example

```tsx
function NowPlaying() {
  const { annotations } = usePlaylistState();
  const { activeAnnotationId } = useActiveAnnotation();
  const active = annotations.find((a) => a.id === activeAnnotationId);

  return active ? <p>{active.lines.join(' ')}</p> : null;
}
```

Set it with `setActiveAnnotationId(id)` from `usePlaylistControls()`. Available inside `WaveformPlaylistProvider` only.

---

## usePlaylistState

Access the current playlist state.

### Signature

```typescript
function usePlaylistState(): PlaylistState;
```

### Returns

```typescript
interface PlaylistStateContextValue {
  continuousPlay: boolean;
  linkEndpoints: boolean;
  annotationsEditable: boolean;
  isAutomaticScroll: boolean;
  isLoopEnabled: boolean;
  annotations: AnnotationData[];
  selectedTrackId: string | null;
  loopStart: number;
  loopEnd: number;
  /** Whether playback rolls past the end instead of auto-stopping (implies fillViewport) */
  indefinitePlayback: boolean;
  /** Whether the timeline visually fills the scroll container (layout only) */
  fillViewport: boolean;
  /** Whether undo is available */
  canUndo: boolean;
  /** Whether redo is available */
  canRedo: boolean;
}
```

### Example

```tsx
function StatusBar() {
  const { continuousPlay, selectedTrackId } = usePlaylistState();
  const { isPlaying } = usePlaybackAnimation();
  const { duration } = usePlaylistData();

  return (
    <div>
      <span>{isPlaying ? 'Playing' : 'Stopped'}</span>
      <span>Duration: {duration.toFixed(2)}s</span>
      <span>Continuous: {continuousPlay ? 'On' : 'Off'}</span>
    </div>
  );
}
```

---

## usePlaylistControls

Access playlist control functions.

### Signature

```typescript
function usePlaylistControls(): PlaylistControls;
```

### Returns

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
  /** Mark a recording session active/inactive. While active: (1) the
   *  end-of-audio auto-stop is suppressed so overdub playback runs past the
   *  end of existing material, and (2) with an `armedTrackId`, that track's
   *  existing content is transiently muted — punch-in replaces whatever the
   *  take overlaps — and its previous mute state is restored when the
   *  session ends (audio-only, the UI mute control is untouched). Auto-wired
   *  from the Waveform `recordingState` prop; overdub flows should also call
   *  it eagerly (before `play()`). */
  setRecordingActive: (active: boolean, armedTrackId?: string | null) => void;
}
```

### Example

```tsx
function CustomControls() {
  const { play, pause, stop, seekTo } = usePlaylistControls();

  return (
    <div>
      <button onClick={() => play()}>Play</button>
      <button onClick={() => pause()}>Pause</button>
      <button onClick={() => stop()}>Stop</button>
      <button onClick={() => seekTo(0)}>Go to Start</button>
    </div>
  );
}
```

---

## useZoomControls

Zoom state management with engine delegation. Internal hook used by the provider — delegates `zoomIn()` / `zoomOut()` to the engine and mirrors state via `onEngineState()`.

### Signature

```typescript
function useZoomControls(props: {
  engineRef: RefObject<PlaylistEngine | null>;
  initialSamplesPerPixel: number;
}): {
  samplesPerPixel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
  onEngineState: (state: EngineState) => void;
};
```

Note: For zooming in consumer components, use `zoomIn()` and `zoomOut()` from `usePlaylistControls()`, or the `ZoomInButton` / `ZoomOutButton` components. The `canZoomIn` / `canZoomOut` / `samplesPerPixel` values are also available from `usePlaylistData()`.

### Example

```tsx
function ZoomControls() {
  const { zoomIn, zoomOut } = usePlaylistControls();
  const { canZoomIn, canZoomOut, samplesPerPixel } = usePlaylistData();

  return (
    <div>
      <button onClick={zoomIn} disabled={!canZoomIn}>+</button>
      <span>{samplesPerPixel} spp</span>
      <button onClick={zoomOut} disabled={!canZoomOut}>-</button>
    </div>
  );
}
```

---

## useMasterVolume

Master volume state with engine delegation. Internal hook used by the provider.

### Signature

```typescript
function useMasterVolume(props: {
  engineRef: RefObject<PlaylistEngine | null>;
  initialVolume?: number;  // Default: 1.0
}): {
  masterVolume: number;
  setMasterVolume: (volume: number) => void;
  masterVolumeRef: RefObject<number>;
  onEngineState: (state: EngineState) => void;
};
```

Note: For consumer components, use `setMasterVolume()` from `usePlaylistControls()` and `masterVolume` from `usePlaylistData()`, or the `MasterVolumeControl` component.

---

## Engine-Delegation Hooks

These hooks follow the **onEngineState pattern**: they delegate mutations to `PlaylistEngine` methods and mirror engine state into React via an `onEngineState()` callback. They are used internally by `WaveformPlaylistProvider` but can be useful for advanced custom providers.

:::tip Using the engine without React?
For Svelte, Vue, vanilla JS, or headless editing, see [Using the Engine Directly](/docs/framework-agnostic/engine) — the `PlaylistEngine` class works without any framework.
:::

### useSelectionState

Selection state (start/end) with engine delegation.

```typescript
function useSelectionState(props: {
  engineRef: RefObject<PlaylistEngine | null>;
}): {
  selectionStart: number;
  selectionEnd: number;
  setSelection: (start: number, end: number) => void;
  selectionStartRef: RefObject<number>;
  selectionEndRef: RefObject<number>;
  onEngineState: (state: EngineState) => void;
};
```

Note: For consumer components, use `setSelection()` from `usePlaylistControls()` and `selectionStart` / `selectionEnd` from `useSelection()`.

### useLoopState

Loop region state with engine delegation.

```typescript
function useLoopState(props: {
  engineRef: RefObject<PlaylistEngine | null>;
}): {
  isLoopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  isLoopEnabledRef: RefObject<boolean>;
  loopStartRef: RefObject<number>;
  loopEndRef: RefObject<number>;
  onEngineState: (state: EngineState) => void;
};
```

Note: For consumer components, use `setLoopEnabled()` / `setLoopRegion()` / `clearLoopRegion()` from `usePlaylistControls()` and loop state from `usePlaylistState()`.

### useSelectedTrack

Selected track ID with engine delegation.

```typescript
function useSelectedTrack(props: {
  engineRef: RefObject<PlaylistEngine | null>;
}): {
  selectedTrackId: string | null;
  setSelectedTrackId: (trackId: string | null) => void;
  selectedTrackIdRef: RefObject<string | null>;
  onEngineState: (state: EngineState) => void;
};
```

Note: For consumer components, use `setSelectedTrackId()` from `usePlaylistControls()` and `selectedTrackId` from `usePlaylistState()`.

---

## useTimeFormat

Control time format display.

### Signature

```typescript
function useTimeFormat(): {
  timeFormat: string;
  setTimeFormat: (format: string) => void;
  formatTime: (seconds: number) => string;
};
```

### Available Formats

| Format | Example |
|--------|---------|
| `seconds` | 123.456 |
| `thousandths` | 2:03.456 |
| `hh:mm:ss` | 0:02:03 |
| `hh:mm:ss.u` | 0:02:03.4 |
| `hh:mm:ss.uu` | 0:02:03.45 |
| `hh:mm:ss.uuu` | 0:02:03.456 |

### Example

```tsx
function TimeDisplay() {
  // The resting cursor position; it does not advance during playback
  const { currentTime } = useCurrentTime();
  const { formatTime, setTimeFormat } = useTimeFormat();

  return (
    <div>
      <span>{formatTime(currentTime)}</span>
      <select onChange={(e) => setTimeFormat(e.target.value)}>
        <option value="thousandths">0:00.000</option>
        <option value="hh:mm:ss">0:00:00</option>
        <option value="seconds">Seconds</option>
      </select>
    </div>
  );
}
```

---

## Integrated Recording

### useIntegratedRecording

*From `@waveform-playlist/recording`*

Full-featured recording hook that integrates with the playlist - handles microphone access, recording, live peaks, and automatic track/clip creation.

```typescript
function useIntegratedRecording(
  tracks: ClipTrack[],
  setTracks: (tracks: ClipTrack[]) => void,
  selectedTrackId: string | null,
  options?: IntegratedRecordingOptions
): UseIntegratedRecordingReturn;
```

#### Options

```typescript
interface IntegratedRecordingOptions {
  currentTime?: number;                  // Current playhead position for recording start
  audioConstraints?: MediaTrackConstraints; // Override recording-optimized defaults
  channelCount?: number;                 // Default: 1 (auto-detected from stream; fallback)
  samplesPerPixel?: number;              // Default: 1024
  bits?: 8 | 16;                         // Default: 16
}
```

#### Returns

```typescript
interface UseIntegratedRecordingReturn {
  // Recording state
  isRecording: boolean;
  isPaused: boolean;

  // Live microphone levels: { levels, peakLevels, rmsLevels } per channel (0-1).
  // A source, not state: the hook does not re-render as levels change.
  meter: MeterSource;

  // Elapsed time and live-preview peaks of the take: { duration, peaks }.
  // A source, not state. Pass it to <Waveform recordingState={{ …, progress }} />.
  progress: RecordingProgressSource;

  // Device management
  stream: MediaStream | null;
  devices: MicrophoneDevice[];
  hasPermission: boolean;
  selectedDevice: string | null;

  // Controls
  /** Resolves true when the capture pipeline actually started. */
  startRecording: () => Promise<boolean>;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  requestMicAccess: () => Promise<void>;
  changeDevice: (deviceId: string) => Promise<void>;

  // Error handling
  error: Error | null;
}
```

`meter` and `progress` keep the same identity for the life of the hook. See [Value sources](#value-sources) for how to read them.

#### Example

```tsx
function RecordingControls() {
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const { currentTime } = useCurrentTime();

  const {
    isRecording,
    meter,
    progress,
    devices,
    hasPermission,
    startRecording,
    stopRecording,
    requestMicAccess,
    changeDevice,
    error,
  } = useIntegratedRecording(tracks, setTracks, selectedTrackId, { currentTime });

  if (!hasPermission) {
    return <button onClick={requestMicAccess}>Enable Microphone</button>;
  }

  return (
    <div>
      <select onChange={(e) => changeDevice(e.target.value)}>
        {devices.map(d => <option key={d.deviceId} value={d.deviceId}>{d.label}</option>)}
      </select>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop' : 'Record'}
      </button>
      {isRecording && <ElapsedTime progress={progress} />}
      <SegmentedVUMeter meter={meter} />
    </div>
  );
}

// Only this small component re-renders as the take grows (10 times a second).
function ElapsedTime({ progress }: { progress: RecordingProgressSource }) {
  const { duration } = useRecordingProgress(progress);
  return <span>Recording: {duration.toFixed(1)}s</span>;
}
```

---

## Drag & Drop Hooks

### useClipDragHandlers

Handles clip dragging (move) and boundary trimming with collision detection. Delegates move operations to `engine.moveClip()` and trim operations to `engine.trimClip()`.

```typescript
function useClipDragHandlers(options: UseClipDragHandlersOptions): {
  onDragStart: (event: DragStartEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  onDragCancel: (event: DragCancelEvent) => void;
  collisionModifier: Modifier;
};
```

#### Options

```typescript
interface UseClipDragHandlersOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  samplesPerPixel: number;
  engineRef: RefObject<PlaylistEngine | null>;
  /** Ref toggled during boundary trim drags. Obtain from usePlaylistData(). */
  isDraggingRef: MutableRefObject<boolean>;
}
```

#### Example

```tsx
import { DragDropProvider } from '@dnd-kit/react';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import {
  ClipCollisionModifier,
  ClipInteractionOptions,
  useDragSensors,
} from '@waveform-playlist/browser';

function EditablePlaylist() {
  const [tracks, setTracks] = useState<ClipTrack[]>(initialTracks);
  const { samplesPerPixel, playoutRef, isDraggingRef } = usePlaylistData();
  const sensors = useDragSensors();

  const { onDragStart, onDragMove, onDragEnd } = useClipDragHandlers({
    tracks,
    onTracksChange: setTracks,
    samplesPerPixel,
    engineRef: playoutRef,
    isDraggingRef,
  });

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={[RestrictToHorizontalAxis, ClipCollisionModifier.configure({ tracks, samplesPerPixel })]}
    >
      <ClipInteractionOptions enabled>
        <Waveform showClipHeaders />
      </ClipInteractionOptions>
    </DragDropProvider>
  );
}
```

### useDragSensors

Pre-configured drag sensors for clip editing.

```typescript
function useDragSensors(options?: DragSensorOptions): PluginDescriptor[];
```

### useAnnotationDragHandlers

Drag handlers for the edges of annotation boxes, for `@dnd-kit/react`'s `DragDropProvider`.

```typescript
function useAnnotationDragHandlers(options: {
  annotations: AnnotationData[];
  onAnnotationsChange: (annotations: AnnotationData[]) => void;
  samplesPerPixel: number;
  sampleRate?: number; // default 48000; pass the provider's
  duration: number;
  linkEndpoints: boolean;
  preview?: AnnotationPreviewHandle;
}): { onDragStart; onDragMove; onDragEnd };
```

Pass `preview: annotationPreview` (from `usePlaylistControls()`) to keep the drag out of your own state: each move is published to the preview, which the built-in annotation boxes and list follow, and `onAnnotationsChange` is called once, on release. Without `preview`, `onAnnotationsChange` is called on every move, which re-renders whatever component holds the annotations for each one.

Pressing Escape cancels the drag and puts back every annotation it moved, linked and pushed neighbours included.

### useAnnotationsWithPreview

```typescript
function useAnnotationsWithPreview(
  annotations: AnnotationData[],
  preview: AnnotationPreviewHandle
): AnnotationData[];
```

For a custom annotation list or row of boxes: returns the previewed annotations while an edge is being dragged with a preview, and `annotations` otherwise. Call it in the component that draws the annotations, so that only it re-renders per pointer move.

---

## Clip Editing Hooks

### useClipSplitting

Split clips at the playhead position. Delegates to `engine.splitClip()` — the engine handles clip creation, adapter sync, and statechange emission.

```typescript
function useClipSplitting(options: UseClipSplittingOptions): UseClipSplittingResult;
```

#### Options

```typescript
interface UseClipSplittingOptions {
  tracks: ClipTrack[];
  samplesPerPixel: number;
  engineRef: RefObject<PlaylistEngine | null>;
}
```

#### Returns

```typescript
interface UseClipSplittingResult {
  splitClipAtPlayhead: () => boolean;
  splitClipAt: (trackIndex: number, clipIndex: number, splitTime: number) => boolean;
}
```

#### Example

```tsx
function SplitButton() {
  const { tracks, samplesPerPixel, playoutRef } = usePlaylistData();

  const { splitClipAtPlayhead } = useClipSplitting({
    tracks,
    samplesPerPixel,
    engineRef: playoutRef,
  });

  return (
    <button onClick={splitClipAtPlayhead}>
      Split Clip (S)
    </button>
  );
}
```

---

## Effects Hooks

Both effects hooks also host third-party [WAM 2.0](https://www.webaudiomodules.com/) plugins alongside the built-in Tone.js effects — see the [WAM Plugins guide](/docs/wam-plugins) for native-context setup, bypass semantics, `WamEffectGui`, and plugin discovery.

### useDynamicEffects

Manage master effects chain with real-time parameter updates. The hook does not re-render when the chain changes, and everything it returns keeps its identity for the life of the component (`masterEffects` follows `fftSize`; `availableEffects` is read from the registry each time the calling component renders). Read the chain with [`useActiveEffects`](#useactiveeffects).

The chains are state: they survive a StrictMode remount, Fast Refresh and a hidden `<Activity>` with their lists and live instances; the hooks run no cleanup on unmount. Add defaults on mount behind a ref guard (an unguarded mount effect adds twice under StrictMode in development). After a real unmount the instances are disposed when the chain is garbage-collected (`FinalizationRegistry`; best effort, not prompt, not guaranteed); call `clearAllEffects()` / `clearTrackEffects(trackId)` to dispose them at a known moment. A clear also drops an add still in flight: its promise rejects with "…aborted: the effects chain was cleared before …". An unmount does not abort an add. If a change cannot be wired (a node on another AudioContext), the previous chain is restored, the new instance is disposed, the list is not changed and the add rejects. A type re-registered while its `prepare` was running is added as the new definition. See [Lifetime of a chain](/docs/react/guides/effects#lifetime-of-a-chain).

```typescript
function useDynamicEffects(fftSize?: number): UseDynamicEffectsReturn; // default: 256
```

#### Returns

```typescript
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

`ValueSource` is from `@waveform-playlist/core` (see [Value sources](#value-sources)).

### useTrackDynamicEffects

Per-track effects management. Each track id has its own chain. The hook does not re-render when a chain changes. The chains have the same lifetime as the master chain (see above): they survive a remount, and `clearTrackEffects(trackId)` disposes one track's effects.

```typescript
function useTrackDynamicEffects(): UseTrackDynamicEffectsReturn;
```

#### Returns

```typescript
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

Subscribe a component to one effects chain.

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
```

```tsx
import { WaveformPlaylistProvider, Waveform, type ClipTrack } from '@waveform-playlist/browser';
import {
  useDynamicEffects,
  useTrackDynamicEffects,
  useActiveEffects,
  type UseDynamicEffectsReturn,
  type UseTrackDynamicEffectsReturn,
} from '@waveform-playlist/browser/tone';

function App({ tracks }: { tracks: ClipTrack[] }) {
  // Call each hook once and pass the result down. A second call creates a
  // second, empty set of chains.
  const masterFx = useDynamicEffects();
  const trackFx = useTrackDynamicEffects();

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      effects={masterFx.masterEffects}
      trackEffects={trackFx.getTrackEffectsFunction}
    >
      <MasterRack masterFx={masterFx} />
      {tracks.map((track) => (
        <TrackRack key={track.id} trackId={track.id} trackFx={trackFx} />
      ))}
      <Waveform />
    </WaveformPlaylistProvider>
  );
}

function MasterRack({ masterFx }: { masterFx: UseDynamicEffectsReturn }) {
  const activeEffects = useActiveEffects(masterFx.effects);
  return (
    <ul>
      {activeEffects.map((effect) => (
        <li key={effect.instanceId}>{effect.definition.name}</li>
      ))}
    </ul>
  );
}

function TrackRack({
  trackId,
  trackFx,
}: {
  trackId: string;
  trackFx: UseTrackDynamicEffectsReturn;
}) {
  const trackEffects = useActiveEffects(trackFx.getTrackEffects(trackId));
  return (
    <ul>
      {trackEffects.map((effect) => (
        <li key={effect.instanceId}>{effect.definition.name}</li>
      ))}
    </ul>
  );
}
```

### getAvailableEffects

```typescript
/**
 * The effects that can be added right now: the built-in effects, followed by
 * every registered custom effect when the app is in native-context mode (a
 * registered effect cannot be added without it). Returns the same array until
 * that set changes, so it is safe to read during render. It is a read, not a
 * subscription: a type registered later appears the next time this is called.
 */
function getAvailableEffects(): EffectDefinition[];
```

Both hooks return this list as `availableEffects`, read when the calling component renders. Register custom effects before the component that shows the picker renders. Adding by id (`addEffect('my-id')`) does not depend on the list. Effects that belong to another library's own catalogue in the shared registry are not listed: when `@dawcore/components` is loaded on the same page, its `native-*` effects stay out of the React list (they are marked `builtIn`), and can still be added by id.

### Effect types

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
```

### Custom effects

A type registered with `registerEffect()` from `@waveform-playlist/core` can be added by id with `addEffect(id)` / `addEffectToTrack(trackId, id)`. It requires native-context mode. `addEffect` awaits the definition's `prepare` itself; with `<daw-editor>`, whose `addEffect()` is synchronous, call `await editor.prepareEffect(type)` first. See the [Custom Effects guide](/docs/react/guides/effects#custom-effects).

```typescript
// From @waveform-playlist/core
function registerEffect(type: string, definition: NativeEffectDefinition): void;
function unregisterEffect(type: string): boolean;
function getEffectDefinitions(): Map<string, NativeEffectDefinition>;

interface NativeEffectDefinition {
  label: string;
  category: string;
  defaults: Record<string, number>;
  params: Record<string, EffectParamDef>;
  /** Name of the wet/dry param, when the effect has one. Bypass zeroes it;
   *  effects without one are bypassed by disconnection. */
  wetParam?: string;
  /** Async setup that must finish before `create` can run on a context
   *  (typically `audioContext.audioWorklet.addModule(url)`). Runs once per
   *  context, including the OfflineAudioContext of every export. Must be safe
   *  to run more than once on the same context. */
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
  getState?: () => Promise<unknown>;
  createGui?: () => Promise<HTMLElement>;
  destroyGui?: (gui: HTMLElement) => void;
  getParameterInfo?: () => Promise<unknown>;
}
```

---

## Recording Hooks

From `@waveform-playlist/recording`:

### useMicrophoneAccess

```typescript
function useMicrophoneAccess(): {
  stream: MediaStream | null;
  devices: MicrophoneDevice[];
  hasPermission: boolean;
  isLoading: boolean;
  error: Error | null;
  requestAccess: (deviceId?: string, audioConstraints?: MediaTrackConstraints) => Promise<void>;
  stopStream: () => void;
};
```

### useRecording

```typescript
function useRecording(
  stream: MediaStream | null,
  options?: RecordingOptions
): {
  isRecording: boolean;
  isPaused: boolean;
  /** Elapsed time and live-preview peaks: { duration, peaks }. A source, not
   *  state; published once per animation frame while recording. After a stop,
   *  duration is the recorded buffer's length. */
  progress: RecordingProgressSource;
  audioBuffer: AudioBuffer | null;
  /** Resolves true when the capture pipeline actually started. */
  startRecording: () => Promise<boolean>;
  stopRecording: () => Promise<AudioBuffer | null>;
  pauseRecording: () => void;
  resumeRecording: () => void;
  error: Error | null;
};
```

### useRecordingProgress

A recording's elapsed time and preview peaks as React state, at most `updateRate` times a second. Use it for slow displays such as an elapsed-time label. The live waveform takes the source itself (`<Waveform recordingState={{ …, progress }} />`).

```typescript
function useRecordingProgress(
  progress: RecordingProgressSource,
  options?: { updateRate?: number } // Default: 10 (updates per second)
): RecordingProgress; // { duration: number; peaks: (Int8Array | Int16Array)[] }
```

### useMicrophoneLevel

```typescript
function useMicrophoneLevel(
  stream: MediaStream | null,
  options?: {
    channelCount?: number;  // Default: 1 (mono). Set to 2 for stereo.
    updateRate?: number;    // Default: 60 (Hz)
  }
): {
  meter: MeterSource;     // Live { levels, peakLevels, rmsLevels } per channel (0-1); a source, not state
  resetPeak: () => void;  // Reset all held peak levels
  error: Error | null;    // Meter setup error
};
```

### Value sources

Meter levels and recording progress change about 60 times a second. Held in React state, they would re-render the component that calls the hook at that rate. The hooks return a source instead, and the hook's component does not re-render when the value changes.

```typescript
// From @waveform-playlist/core
interface ValueSource<T> {
  subscribe(listener: (value: T) => void): () => void; // returns unsubscribe
  getSnapshot(): T; // same object until the next change
}

interface MeterLevels {
  levels: number[];     // Per-channel smoothed peak levels (0-1)
  peakLevels: number[]; // Per-channel held peak levels since the last reset (0-1)
  rmsLevels: number[];  // Per-channel RMS levels (0-1)
}
type MeterSource = ValueSource<MeterLevels>;

interface RecordingProgress {
  duration: number;                  // Elapsed seconds
  peaks: (Int8Array | Int16Array)[]; // Per-channel preview peaks
}
type RecordingProgressSource = ValueSource<RecordingProgress>;
```

Four ways to read one:

```tsx
// 1. Hand it to the component that draws it.
<SegmentedVUMeter meter={meter} />

// 2. Throttled React state: at most `updateRate` renders a second (default 10).
const { levels, peakLevels, rmsLevels } = useMeterLevels(meter, { updateRate: 10 });
const { duration } = useRecordingProgress(progress);
const value = useThrottledValue(anySource); // generic form

// 3. Full-rate React state.
const { levels } = useSyncExternalStore(meter.subscribe, meter.getSnapshot);

// 4. Draw it yourself, without rendering.
useEffect(() => meter.subscribe(({ levels }) => drawBars(levels)), [meter]);
```

`useMeterLevels` and `useThrottledValue` come from `@waveform-playlist/ui-components`; `useRecordingProgress` from `@waveform-playlist/recording`.

### useOutputMeter

*From `@waveform-playlist/browser/tone`*

Monitor the master output level of the playlist. Must be used inside `WaveformPlaylistProvider`.

```typescript
function useOutputMeter(options?: UseOutputMeterOptions): UseOutputMeterReturn;
```

#### Options

```typescript
interface UseOutputMeterOptions {
  channelCount?: number;   // Default: 2
  updateRate?: number;     // Default: 60 (Hz)
  isPlaying?: boolean;     // Reset levels when false (prevents frozen meters)
}
```

#### Returns

```typescript
interface UseOutputMeterReturn {
  meter: MeterSource;     // Live { levels, peakLevels, rmsLevels } per channel (0-1); a source, not state
  resetPeak: () => void;  // Reset all peak hold indicators
  error: Error | null;    // Meter setup error
}
```

#### Example

```tsx
import { useOutputMeter } from '@waveform-playlist/browser/tone';
import { useMeterLevels } from '@waveform-playlist/ui-components';

function OutputMeter() {
  const { meter, resetPeak } = useOutputMeter({ channelCount: 2 });
  // Text readout: 10 renders a second is enough.
  const { levels, peakLevels } = useMeterLevels(meter);

  return (
    <div>
      {levels.map((level, ch) => (
        <div key={ch}>
          <span>{ch === 0 ? 'L' : 'R'}: {(level * 100).toFixed(0)}%</span>
          <span>Peak: {(peakLevels[ch] * 100).toFixed(0)}%</span>
        </div>
      ))}
      <button onClick={resetPeak}>Reset Peak</button>
    </div>
  );
}
```

---

## Export Hooks

### useExportWav

Export the playlist to WAV format using offline rendering.

```typescript
function useExportWav(): {
  exportWav: (tracks: ClipTrack[], trackStates: TrackState[], options?: ExportOptions) => Promise<ExportResult>;
  isExporting: boolean;
  progress: number;
  error: string | null;
};
```

### ExportOptions

```typescript
interface ExportOptions {
  filename?: string;      // Filename for download (default: 'export')
  mode?: 'master' | 'individual';  // Export all tracks mixed or single track
  trackIndex?: number;    // Track index for individual export
  bitDepth?: 16 | 32;     // WAV bit depth (default: 16)
  applyEffects?: boolean; // Apply fades and effects (default: true)
  effectsFunction?: OfflineEffectsFunction;  // Effects chain for export (native + WAM)
  autoDownload?: boolean; // Trigger automatic download (default: true)
  onProgress?: (progress: number) => void;
}
```

### Effects Function

When an `effectsFunction` is provided and `applyEffects` is true, export renders through the effects chain — native Tone.js effects and hosted WAM plugins alike. WAM entries are re-instantiated on the offline context from their URL-cached factories with the live instance's state transferred; a WAM plugin that fails to re-instantiate fails the export. The function may return a cleanup callback synchronously or asynchronously.

```typescript
type OfflineEffectsCleanup = void | (() => void);

type OfflineEffectsFunction = (
  masterVolume: Volume,
  destination: ToneAudioNode,
  isOffline: boolean  // true during export
) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;
```

### ExportResult

```typescript
interface ExportResult {
  audioBuffer: AudioBuffer;  // Rendered audio buffer
  blob: Blob;               // WAV file as Blob
  duration: number;         // Duration in seconds
}
```

### Example

```tsx
function ExportButton() {
  const { tracks, trackStates } = usePlaylistData();
  const { exportWav, isExporting, progress } = useExportWav();

  const handleExport = async () => {
    try {
      const result = await exportWav(tracks, trackStates, {
        filename: 'my-mix',
        mode: 'master',
        bitDepth: 16,
      });
      console.log('Exported:', result.duration, 'seconds');
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  return (
    <button onClick={handleExport} disabled={isExporting}>
      {isExporting ? `Exporting ${Math.round(progress * 100)}%` : 'Export WAV'}
    </button>
  );
}
```

---

## Annotations Hooks

From `@waveform-playlist/annotations`:

### useAnnotationControls

```typescript
function useAnnotationControls(): {
  annotations: Annotation[];
  selectedAnnotationId: string | null;
  addAnnotation: (annotation: Annotation) => void;
  updateAnnotation: (id: string, updates: Partial<Annotation>) => void;
  deleteAnnotation: (id: string) => void;
  selectAnnotation: (id: string | null) => void;
  setAnnotations: (annotations: Annotation[]) => void;
};
```

---

## Keyboard Shortcuts

### usePlaybackShortcuts

Enable common playback keyboard shortcuts.

#### Default Shortcuts

| Key | Action |
|-----|--------|
| `Space` | Toggle play/pause |
| `Escape` | Stop playback |
| `0` | Rewind to start |

#### Signature

```typescript
function usePlaybackShortcuts(options?: UsePlaybackShortcutsOptions): {
  togglePlayPause: () => void;
  stopPlayback: () => void;
  rewindToStart: () => void;
  shortcuts: KeyboardShortcut[];
};
```

#### Options

```typescript
interface UsePlaybackShortcutsOptions {
  enabled?: boolean;              // Enable shortcuts (default: true)
  additionalShortcuts?: KeyboardShortcut[];  // Add custom shortcuts
  shortcuts?: KeyboardShortcut[]; // Override all shortcuts
}
```

#### Example

```tsx
// Basic usage - enables default shortcuts
usePlaybackShortcuts();

// With additional custom shortcuts
usePlaybackShortcuts({
  additionalShortcuts: [
    { key: 's', action: splitClipAtPlayhead, description: 'Split clip' },
    { key: ' ', action: togglePlay, description: 'Play/Pause' },
  ],
});

// Override defaults completely
usePlaybackShortcuts({
  shortcuts: [
    { key: 'Home', action: rewindToStart, description: 'Go to start' },
  ],
});
```

---

### useKeyboardShortcuts

Low-level hook for custom keyboard shortcuts.

#### Signature

```typescript
function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void;
```

#### KeyboardShortcut

```typescript
interface KeyboardShortcut {
  key: string;           // Key to listen for
  action: () => void;    // Function to call
  ctrlKey?: boolean;     // Require Ctrl modifier
  shiftKey?: boolean;    // Require Shift modifier
  metaKey?: boolean;     // Require Meta/Cmd modifier
  altKey?: boolean;      // Require Alt modifier
  description?: string;  // Human-readable description
  preventDefault?: boolean;  // Prevent default behavior (default: true)
}
```

#### Example

```tsx
useKeyboardShortcuts({
  shortcuts: [
    {
      key: 's',
      action: () => splitClip(),
      description: 'Split clip at playhead',
    },
    {
      key: 'z',
      metaKey: true,
      action: () => undo(),
      description: 'Undo',
    },
    {
      key: 'z',
      metaKey: true,
      shiftKey: true,
      action: () => redo(),
      description: 'Redo',
    },
  ],
  enabled: !isInputFocused,
});
```

#### getShortcutLabel

Get a human-readable label for a shortcut:

```tsx
import { getShortcutLabel } from '@waveform-playlist/browser';

const shortcut = { key: 's', metaKey: true, shiftKey: true };
const label = getShortcutLabel(shortcut);
// On Mac: "Cmd+Shift+S"
// On Windows: "Ctrl+Shift+S"
```

---

## Best Practices

### 1. Use Specific Hooks

Use the split context hooks for optimal performance:

```tsx
// Only subscribes to playback animation state
const { isPlaying } = usePlaybackAnimation();
const { play, pause } = usePlaylistControls();
```

### 2. Memoize Callbacks

When passing to child components:

```tsx
const handleVolumeChange = useCallback((value: number) => {
  setVolume(value);
}, [setVolume]);
```

### 3. Context Boundaries

Hooks must be used within their providers:

```tsx
// Correct
<WaveformPlaylistProvider>
  <ComponentUsingHooks />
</WaveformPlaylistProvider>

// Error
<ComponentUsingHooks /> // Outside provider
```

## See Also

- [WaveformPlaylistProvider](/docs/react/api/providers/waveform-playlist-provider)
- [Components](/docs/react/api/components)
- [Recording Guide](/docs/react/guides/recording)
- [Annotations Guide](/docs/react/guides/annotations)
- [WAM Plugins Guide](/docs/wam-plugins)
