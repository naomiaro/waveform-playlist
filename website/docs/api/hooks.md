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
  usePlaylistControls,
  usePlaylistData,
  usePlaybackAnimation,

  // Specialized hooks
  useAudioTracks,
  useZoomControls,
  useTimeFormat,
  useMasterVolume,

  // Drag & drop
  useClipDragHandlers,
  useDragSensors,

  // Clip editing
  useClipSplitting,

  // Effects
  useDynamicEffects,
  useTrackDynamicEffects,

  // Keyboard shortcuts
  useKeyboardShortcuts,
  usePlaybackShortcuts,

  // Export
  useExportWav,
} from '@waveform-playlist/browser';

// Recording primitives (lower-level hooks)
import {
  useMicrophoneAccess,
  useRecording,
  useMicrophoneLevel,
} from '@waveform-playlist/recording';

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
  audioBuffers: AudioBuffer[];

  // Display settings
  samplesPerPixel: number;
  waveHeight: number;
  mono: boolean;
  controls: { show: boolean; width: number };

  // Refs for direct access
  playoutRef: RefObject<TonePlayout>;
  scrollContainerRef: RefObject<HTMLDivElement>;

  // Loading state
  isReady: boolean;  // True when all tracks are loaded
};
```

### usePlaybackAnimation

Access playback state and timing refs for smooth animations.

```typescript
function usePlaybackAnimation(): {
  isPlaying: boolean;
  currentTime: number;

  // Refs for 60fps animation loops
  currentTimeRef: RefObject<number>;
  playbackStartTimeRef: RefObject<number>;
  audioStartPositionRef: RefObject<number>;
};
```

#### Example

```tsx
function AnimatedPlayhead() {
  const { isPlaying, currentTimeRef, playbackStartTimeRef, audioStartPositionRef } = usePlaybackAnimation();
  const { samplesPerPixel, sampleRate } = usePlaylistData();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frameId: number;

    const animate = () => {
      if (ref.current && isPlaying) {
        const elapsed = getContext().currentTime - (playbackStartTimeRef.current ?? 0);
        const time = (audioStartPositionRef.current ?? 0) + elapsed;
        const pixels = (time * sampleRate) / samplesPerPixel;
        ref.current.style.transform = `translateX(${pixels}px)`;
      }
      frameId = requestAnimationFrame(animate);
    };

    if (isPlaying) frameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frameId);
  }, [isPlaying]);

  return <div ref={ref} className="playhead" />;
}
```

---

## useAudioTracks

Load and decode audio files into track objects.

### Signature

```typescript
function useAudioTracks(configs: AudioConfig[]): {
  tracks: ClipTrack[];
  loading: boolean;
  error: string | null;
  progress: number;
};
```

### Parameters

| Name | Type | Description |
|------|------|-------------|
| `configs` | `AudioConfig[]` | Array of audio configurations |

### AudioTrackConfig

```typescript
interface AudioTrackConfig {
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
| `progress` | `number` | Loading progress 0-1 |

### Example

```tsx
const { tracks, loading, error, progress } = useAudioTracks([
  { src: '/audio/track1.mp3', name: 'Track 1' },
  { src: '/audio/track2.mp3', name: 'Track 2', startTime: 5 },
]);

if (loading) return <div>Loading... {Math.round(progress * 100)}%</div>;
if (error) return <div>Error: {error}</div>;
```

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
  activeAnnotationId: string | null;
  selectionStart: number;
  selectionEnd: number;
  selectedTrackId: string | null;
  loopStart: number;
  loopEnd: number;
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

  // Selection
  setSelection: (start: number, end: number) => void;
  setSelectedTrackId: (trackId: string | null) => void;

  // Time format
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (seconds: number) => string;

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
  setActiveAnnotationId: (id: string | null) => void;

  // Loop controls
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setLoopRegionFromSelection: () => void;
  clearLoopRegion: () => void;
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

Control zoom level.

### Signature

```typescript
function useZoomControls(): {
  samplesPerPixel: number;
  zoomIn: () => void;
  zoomOut: () => void;
  canZoomIn: boolean;
  canZoomOut: boolean;
};
```

Note: `useZoomControls` is an internal hook used by the provider. For zooming, use `zoomIn()` and `zoomOut()` from `usePlaylistControls()`, or the `ZoomInButton` / `ZoomOutButton` components.

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
  const { currentTime } = usePlaybackAnimation();
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
  currentTime?: number;  // Current playhead position for recording start
}
```

#### Returns

```typescript
interface UseIntegratedRecordingReturn {
  // Recording state
  isRecording: boolean;
  duration: number;

  // Microphone levels
  level: number;      // Current RMS level (0-1)
  peakLevel: number;  // Peak level with decay (0-1)

  // Device management
  devices: MediaDeviceInfo[];
  hasPermission: boolean;
  selectedDevice: string | null;

  // Controls
  startRecording: () => Promise<void>;
  stopRecording: () => void;
  requestMicAccess: () => Promise<void>;
  changeDevice: (deviceId: string) => void;

  // Live waveform data
  recordingPeaks: number[];

  // Error handling
  error: Error | null;
}
```

#### Example

```tsx
function RecordingControls() {
  const [tracks, setTracks] = useState<ClipTrack[]>([]);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const { currentTime } = usePlaybackAnimation();

  const {
    isRecording,
    duration,
    level,
    peakLevel,
    devices,
    hasPermission,
    startRecording,
    stopRecording,
    requestMicAccess,
    changeDevice,
    recordingPeaks,
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
      {isRecording && <span>Recording: {duration.toFixed(1)}s</span>}
      <VUMeter level={level} peakLevel={peakLevel} />
    </div>
  );
}
```

---

## Drag & Drop Hooks

### useClipDragHandlers

Handles clip dragging (move) and boundary trimming with collision detection.

```typescript
function useClipDragHandlers(options: UseClipDragHandlersOptions): {
  onDragStart: (event: DragStartEvent) => void;
  onDragMove: (event: DragMoveEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
  collisionModifier: Modifier;
};
```

#### Options

```typescript
interface UseClipDragHandlersOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  samplesPerPixel: number;
  sampleRate: number;
}
```

#### Example

```tsx
import { DndContext } from '@dnd-kit/core';
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers';

function EditablePlaylist() {
  const [tracks, setTracks] = useState<ClipTrack[]>(initialTracks);
  const { samplesPerPixel, sampleRate } = usePlaylistData();
  const sensors = useDragSensors();

  const { onDragStart, onDragMove, onDragEnd, collisionModifier } = useClipDragHandlers({
    tracks,
    onTracksChange: setTracks,
    samplesPerPixel,
    sampleRate,
  });

  return (
    <DndContext
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={[restrictToHorizontalAxis, collisionModifier]}
    >
      <Waveform interactiveClips showClipHeaders />
    </DndContext>
  );
}
```

### useDragSensors

Pre-configured drag sensors for clip editing.

```typescript
function useDragSensors(): SensorDescriptor<any>[];
```

### useAnnotationDragHandlers

Similar to `useClipDragHandlers` but for annotation boxes.

---

## Clip Editing Hooks

### useClipSplitting

Split clips at the playhead position.

```typescript
function useClipSplitting(options: UseClipSplittingOptions): UseClipSplittingResult;
```

#### Options

```typescript
interface UseClipSplittingOptions {
  tracks: ClipTrack[];
  onTracksChange: (tracks: ClipTrack[]) => void;
  selectedTrackId?: string | null;
  selectedClipId?: string | null;
}
```

#### Returns

```typescript
interface UseClipSplittingResult {
  splitClipAtPlayhead: () => void;
  canSplit: boolean;
}
```

#### Example

```tsx
function SplitButton() {
  const { selectedTrackId } = usePlaylistState();
  const { tracks } = usePlaylistData();
  const [localTracks, setLocalTracks] = useState(tracks);

  const { splitClipAtPlayhead, canSplit } = useClipSplitting({
    tracks: localTracks,
    onTracksChange: setLocalTracks,
    selectedTrackId,
    selectedClipId: null, // Set from your own state if needed
  });

  return (
    <button onClick={splitClipAtPlayhead} disabled={!canSplit}>
      Split Clip (S)
    </button>
  );
}
```

---

## Effects Hooks

### useDynamicEffects

Manage master effects chain with real-time parameter updates.

```typescript
function useDynamicEffects(): UseDynamicEffectsReturn;
```

#### Returns

```typescript
interface UseDynamicEffectsReturn {
  activeEffects: ActiveEffect[];
  availableEffects: EffectDefinition[];
  addEffect: (effectId: string) => void;
  removeEffect: (instanceId: string) => void;
  updateParameter: (instanceId: string, paramName: string, value: number | string | boolean) => void;
  toggleBypass: (instanceId: string) => void;
  reorderEffects: (fromIndex: number, toIndex: number) => void;
  clearAllEffects: () => void;
  masterEffects: EffectsFunction;
  createOfflineEffectsFunction: () => EffectsFunction | undefined;
  analyserRef: RefObject<any>;
}

interface ActiveEffect {
  instanceId: string;
  effectId: string;
  parameters: Record<string, number>;
  bypassed: boolean;
}
```

### useTrackDynamicEffects

Per-track effects management.

```typescript
function useTrackDynamicEffects(): UseTrackDynamicEffectsReturn;
```

#### Returns

```typescript
interface UseTrackDynamicEffectsReturn {
  trackEffects: Map<string, TrackActiveEffect[]>;
  addTrackEffect: (trackId: string, effectId: string) => void;
  removeTrackEffect: (trackId: string, instanceId: string) => void;
  updateTrackParameter: (trackId: string, instanceId: string, paramId: string, value: number) => void;
  toggleTrackBypass: (trackId: string, instanceId: string) => void;
  createTrackEffectsFunction: (trackId: string) => TrackEffectsFunction;
  createOfflineTrackEffectsFunction: (trackId: string) => TrackEffectsFunction;
}
```

---

## Recording Hooks

From `@waveform-playlist/recording`:

### useMicrophoneAccess

```typescript
function useMicrophoneAccess(options?: {
  audioConstraints?: MediaTrackConstraints;
}): {
  hasAccess: boolean;
  isRequesting: boolean;
  error: string | null;
  requestAccess: () => Promise<void>;
  revokeAccess: () => void;
};
```

### useRecording

```typescript
function useRecording(): {
  isRecording: boolean;
  isPaused: boolean;
  duration: number;
  recordedBlob: Blob | null;
  startRecording: () => void;
  stopRecording: () => void;
  pauseRecording: () => void;
  resumeRecording: () => void;
  clearRecording: () => void;
};
```

### useMicrophoneLevel

```typescript
function useMicrophoneLevel(): {
  level: number;  // 0-1 RMS level
  peak: number;   // 0-1 peak with decay
};
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
  effectsFunction?: EffectsFunction;  // Tone.js effects chain for export
  autoDownload?: boolean; // Trigger automatic download (default: true)
  onProgress?: (progress: number) => void;
}
```

### Effects Function

When an `effectsFunction` is provided and `applyEffects` is true, export uses `Tone.Offline` to render through the effects chain. This allows exporting with reverb, delay, and other Tone.js effects.

```typescript
type EffectsFunction = (
  masterVolume: Volume,
  destination: ToneAudioNode,
  isOffline: boolean  // true during export
) => void | (() => void);
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

Prefer the split context hooks over the legacy combined hook:

```tsx
// Better - only subscribes to playback animation state
const { isPlaying } = usePlaybackAnimation();
const { play, pause } = usePlaylistControls();

// Less efficient - subscribes to all state
const { isPlaying, play, pause } = useWaveformPlaylist();
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

- [WaveformPlaylistProvider](/docs/api/providers/waveform-playlist-provider)
- [Components](/docs/api/components)
- [Recording Guide](/docs/guides/recording)
- [Annotations Guide](/docs/guides/annotations)
