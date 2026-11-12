---
sidebar_position: 2
description: "React component API reference for Waveform, buttons, controls, and playhead components"
---

# Components

Pre-built React components for building audio applications.

## Import

```tsx
import {
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  // ... other components
} from '@waveform-playlist/browser';
```

## Which Provider Each Control Needs

The controls on this page read the nearest playlist provider.

| Works under | Components |
| --- | --- |
| Either provider | `PlayButton`, `PauseButton`, `StopButton`, `RewindButton`, `FastForwardButton`, `SkipBackwardButton`, `SkipForwardButton`, `ClearAllButton`, `AudioPosition`, `TimeFormatSelect`, `SelectionTimeInputs`, `AutomaticScrollCheckbox`, and, inside `<AnnotationProvider>`, `ContinuousPlayCheckbox` and `DownloadAnnotationsButton` |
| `MediaElementPlaylistProvider` only | `PlaybackRateSelect` |
| `WaveformPlaylistProvider` only | `LoopButton`, `SetLoopRegionButton`, `ZoomInButton`, `ZoomOutButton`, `MasterVolumeControl`, `LinkEndpointsCheckbox`, `EditableCheckbox`, `KeyboardShortcuts`, `ExportWavButton` |

A control under a provider that does not serve it throws when it renders, also when a provider of the right kind is further out. The message names the hook and both providers, for example: "useLoop needs WaveformPlaylistProvider, and the nearest playlist provider here is MediaElementPlaylistProvider, which does not provide it".

## Waveform

The main visualization component that renders tracks and handles interactions.

```tsx
<Waveform />
```

### Features

- Canvas-based waveform rendering
- Click to seek
- Drag to select
- Drag clips to move/trim
- Keyboard shortcuts
- Custom playhead rendering

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `showClipHeaders` | `boolean` | `false` | Show clip name headers above waveforms |
| `gainScaledWaveforms` | `boolean` | `false` | Draw each clip's waveform scaled by its `gain` (clamped to the channel height), so clips levelled with clip gain look the way they sound. Draw-time only — peaks are not regenerated |
| `renderPlayhead` | `RenderPlayheadFunction` | - | Custom playhead render function |
| `renderTrackControls` | `(trackIndex: number) => ReactNode` | - | Custom track controls renderer |
| `trackReordering` | `boolean` | `false` | Show a drag grip + move up/down buttons on the default track control panel for vertical track reordering. Drag requires `ClipInteractionProvider`; the buttons work regardless |

Note: The `timescale` prop is set on `WaveformPlaylistProvider`, not on `Waveform`.

Note: whether clips can be dragged and trimmed, and whether their trim handles are widened for touch, is not a `Waveform` prop. Wrap the `Waveform` in `ClipInteractionProvider`, or, with your own `DragDropProvider`, in `ClipInteractionOptions`:

| `ClipInteractionOptions` prop | Type | Default | Description |
|------|------|---------|-------------|
| `enabled` | `boolean` | inherited, `false` at the top | Clips below can be dragged and trimmed |
| `touchOptimized` | `boolean` | inherited, `false` at the top | Clips below get 24px trim handles instead of 8px |

See [Custom Drag Setup](/docs/react/guides/custom-drag-setup#clipinteractionoptions).

### Usage

```tsx
<WaveformPlaylistProvider tracks={tracks}>
  <Waveform />
</WaveformPlaylistProvider>
```

The Waveform component reads configuration from the provider context.

---

## Custom Playhead

Replace the default playhead with a custom component using the `renderPlayhead` prop.

### PlayheadProps

The render function receives these props, under either provider:

```typescript
interface PlayheadProps {
  /** Position in pixels from left edge (valid while not playing) */
  position: number;
  /** Playhead color from theme (default: #ff0000) */
  color?: string;
  /** Whether audio is currently playing */
  isPlaying: boolean;
  /** Raw playback position in seconds */
  currentTimeRef: React.RefObject<number>;
  /**
   * The time to draw the playhead at, in seconds. The provider keeps it current
   * on every frame of playback and when playback comes to rest. Under
   * WaveformPlaylistProvider it is the audible time while playing (raw minus
   * output latency and look-ahead); under MediaElementPlaylistProvider it is
   * the same ref as currentTimeRef.
   */
  visualTimeRef: React.RefObject<number>;
  /** For converting time to pixels: (time * sampleRate) / samplesPerPixel */
  samplesPerPixel: number;
  sampleRate: number;
}
```

`position` is enough for a playhead that only needs to be right while stopped. To move during playback, read `visualTimeRef.current` in your own animation frame while `isPlaying` is true, as `PlayheadWithMarker` does.

The playhead is not rendered (and `renderPlayhead` is not called) while a range is highlighted and playback is stopped or paused.

Engine values are not props. A playhead for `WaveformPlaylistProvider` that needs one calls [`useEngineRefs()`](/docs/react/api/hooks#useenginerefs); the function passed as `renderPlayhead` may call hooks, the same ones on every render (or return your own component: `(props) => <MyPlayhead {...props} />`). A custom playhead is unmounted while it is hidden, so state it holds starts again.

### Built-in Playhead Components

Import pre-built playhead variants:

```tsx
import { Playhead, PlayheadWithMarker } from '@waveform-playlist/ui-components';
```

#### Default Playhead

A simple vertical line (used by default):

```tsx
<Waveform />
// or explicitly:
<Waveform renderPlayhead={(props) => <Playhead {...props} />} />
```

#### PlayheadWithMarker

A playhead with a triangle marker at the top, positioned to sit in the timescale area:

```tsx
<Waveform
  timescale
  renderPlayhead={(props) => <PlayheadWithMarker {...props} />}
/>
```

### Custom Playhead Example

Create your own playhead component:

```tsx
import styled from 'styled-components';

const CustomPlayheadLine = styled.div<{ $position: number; $color: string }>`
  position: absolute;
  top: 0;
  left: 0;
  width: 3px;
  height: 100%;
  background: ${(props) => props.$color};
  transform: translate3d(${(props) => props.$position}px, 0, 0);
  z-index: 150;
  pointer-events: none;
  will-change: transform;
  border-radius: 2px;
  box-shadow: 0 0 4px ${(props) => props.$color};
`;

const GlowingPlayhead = ({ position, color = '#ff0000' }) => (
  <CustomPlayheadLine $position={position} $color={color} />
);

// Usage
<Waveform renderPlayhead={(props) => <GlowingPlayhead {...props} />} />
```

### Performance Tips

- Use `transform: translate3d()` for GPU-accelerated positioning
- Add `will-change: transform` for smooth animation
- Set `pointer-events: none` to prevent interference with track interactions

---

## Playback Buttons

### PlayButton

Starts playback from the current cursor position, or plays the highlighted selection.

```tsx
<PlayButton />
```

**Behavior:**
- Disabled during playback
- With a selection highlighted (and, under `WaveformPlaylistProvider`, looping off) it plays the selection and stops at its end. If the cursor is inside the selection, it resumes from the cursor
- Otherwise it plays from the cursor
- Works the same way under `MediaElementPlaylistProvider`, which has no loop

### PauseButton

Pauses playback, maintaining cursor position.

```tsx
<PauseButton />
```

**Behavior:**
- Disabled when not playing

### StopButton

Stops playback and returns the cursor to where playback started.

```tsx
<StopButton />
```

**Behavior:**
- Disabled when not playing, under both providers. After Pause it is disabled and the cursor stays at the pause point

### RewindButton

Moves the cursor to the start: `seekTo(0)`. During playback, playback restarts there.

```tsx
<RewindButton />
```

### FastForwardButton

Moves the cursor to the end of the audio: `seekTo(Infinity)`, which the provider clamps. Disabled under a `WaveformPlaylistProvider` with `indefinitePlayback`, where the transport has no end.

```tsx
<FastForwardButton />
```

### SkipBackwardButton and SkipForwardButton

Move the cursor back or forward by `skipAmount` seconds from the current playback position, clamped to the audio. Under a `WaveformPlaylistProvider` with `indefinitePlayback`, and during a recording session, the position is not clamped at the end of the audio: Skip Forward keeps going. During playback, playback restarts at the new position.

```tsx
<SkipBackwardButton />
<SkipForwardButton skipAmount={10} />
```

**Props:**
- `skipAmount` (optional): seconds to skip. Default 5

### SetLoopRegionButton

Creates a loop region from the current selection, or clears an existing loop region.

```tsx
<SetLoopRegionButton />
```

**Behavior:**
- Disabled when no selection exists and no loop region is set
- Shows "Set Loop" when no loop region exists
- Shows "Clear Loop" when a loop region is set
- Click to toggle between setting and clearing the loop region

### LoopButton

Toggles loop mode for the loop region.

```tsx
<LoopButton />
```

**Behavior:**
- Shows "Loop Off" when disabled, "Loop On" when enabled
- If no loop region exists when enabling, creates a default loop region (first 10s or 25% of duration)
- When enabled, playback loops when the cursor enters and reaches the end of the loop region
- Loop region is displayed in the timescale area and can be dragged to adjust

**Workflow:**
1. Create a selection by clicking and dragging on the waveform
2. Click SetLoopRegionButton to create a loop region from the selection (or drag in the timescale)
3. Click LoopButton to enable looping
4. Play - when the cursor reaches the loop region, it will loop

---

## Zoom Controls

### ZoomInButton

Decreases samplesPerPixel for more detail.

```tsx
<ZoomInButton />
```

**Behavior:**
- Disabled at minimum zoom (128 spp)

### ZoomOutButton

Increases samplesPerPixel for wider view.

```tsx
<ZoomOutButton />
```

**Behavior:**
- Disabled at maximum zoom (8192 spp)

---

## Volume Controls

### MasterVolumeControl

Slider for overall output volume.

```tsx
<MasterVolumeControl />
```

**Range:** 0 (silent) to 1 (full)

### TrackVolumeControl

Volume slider for a specific track.

```tsx
<TrackVolumeControl trackIndex={0} />
```

**Props:**
- `trackIndex` (required): Index of the track

---

## Position Display

### AudioPosition

Shows the current playback position. It follows playback through the provider's animation loop, and shows the resting cursor position while stopped.

```tsx
<AudioPosition />
```

The format is the provider's current time format (`TimeFormatSelect`, or `setTimeFormat` from `usePlaybackControls()`); the default is `hh:mm:ss.uuu`. Works under either provider.

---

## Playback Speed

### PlaybackRateSelect

`MediaElementPlaylistProvider` only. A dropdown (a native `<select>` with the accessible name "Playback speed") that shows and sets the provider's playback rate.

```tsx
<PlaybackRateSelect />
<PlaybackRateSelect rates={[0.75, 1, 1.5]} />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `rates` | `readonly number[]` | `[0.5, 0.75, 1, 1.25, 1.5, 2]` | The speeds to offer, in the order to list them |
| `className` | `string` | - | Class for the wrapper element |

A current speed that is not among `rates` (set from code with `setPlaybackRate`) is listed as an extra option. The base component of the same name in `@waveform-playlist/ui-components` takes `value`, `onChange`, `rates`, `disabled` and `className`, for use without the provider.

---

## Time Format

### TimeFormatSelect

Dropdown for selecting time display format.

```tsx
<TimeFormatSelect />
```

**Options:**
- `seconds` - 0.000
- `thousandths` - 0:00.000
- `hh:mm:ss` - 0:00:00
- `hh:mm:ss.u` - 0:00:00.0
- `hh:mm:ss.uu` - 0:00:00.00
- `hh:mm:ss.uuu` - 0:00:00.000

---

## Checkboxes

### ContinuousPlayCheckbox

Toggle for continuous play, which governs annotation playback:

- **Off:** playing an annotation stops at that annotation's end.
- **On:** playback continues through the following annotations.

Switching it on while an annotation is playing lets playback continue past that annotation. Playing the selection (the Play button or Space with a selection highlighted) is not affected by the toggle: the selection plays from its start to its end either way. An annotation you click follows the toggle even while a selection is highlighted elsewhere, and the selection stays highlighted. It is not the loop control; see `LoopButton`.

```tsx
<ContinuousPlayCheckbox />
```

### AutomaticScrollCheckbox

Toggle for auto-scrolling during playback.

```tsx
<AutomaticScrollCheckbox />
```

---

## Track Controls

### TrackControls

Built-in control panel for a track.

```tsx
<TrackControls trackIndex={0} />
```

**Includes:**
- Track name
- Mute button
- Solo button
- Volume slider
- Pan slider

### SortableTrackControls

Registers a custom track-controls row as a vertical drag source for reordering. Use this when rendering your own track control panel (via `renderTrackControls`) instead of the default one — the default panel already wires this up internally when `trackReordering` is set on `Waveform`.

```tsx
<SortableTrackControls trackId={track.id} index={trackIndex}>
  {({ ref, handleRef, isDragSource }) => (
    <div ref={ref} style={{ opacity: isDragSource ? 0.5 : 1 }}>
      <button ref={handleRef}>Drag</button>
      {/* rest of your custom track controls */}
    </div>
  )}
</SortableTrackControls>
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `trackId` | `string` | - | The track's id |
| `index` | `number` | - | The track's current position |
| `disabled` | `boolean` | `false` | Disable the drag source |
| `children` | `(props: SortableTrackControlsRenderProps) => ReactNode` | - | Render prop receiving `ref` (sortable item wrapper), `handleRef` (drag grip), and `isDragSource` |

Requires `ClipInteractionProvider` (or another ambient `@dnd-kit/react` `DragDropProvider`) — drags are committed by calling `useEditorControls().reorderTrack(trackId, toIndex)` from the shared `onDragEnd` handler.

---

## Export Controls

### ExportWavButton

Export the playlist to a WAV file.

```tsx
<ExportWavButton />
```

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `label` | `string` | `'Export WAV'` | Button label |
| `filename` | `string` | `'export'` | Downloaded file name (without extension) |
| `mode` | `'master' \| 'individual'` | `'master'` | Export all tracks mixed or single track |
| `trackIndex` | `number` | - | Track index for individual export |
| `bitDepth` | `16 \| 32` | `16` | WAV bit depth (16-bit PCM or 32-bit float) |
| `applyEffects` | `boolean` | `true` | Apply fades and other clip effects |
| `effectsFunction` | `EffectsFunction` | - | Tone.js effects chain for export with effects |
| `className` | `string` | - | CSS class name |
| `onExportComplete` | `(blob: Blob) => void` | - | Callback when export succeeds |
| `onExportError` | `(error: Error) => void` | - | Callback when export fails |

**Behavior:**
- Shows progress percentage during export
- Disabled when no tracks loaded
- Automatically triggers download when complete

**Example:**

```tsx
<ExportWavButton
  filename="my-mix"
  mode="master"
  bitDepth={16}
  onExportComplete={(blob) => console.log('Exported:', blob.size, 'bytes')}
/>
```

**Individual Track Export:**

```tsx
<ExportWavButton
  label="Export Track 1"
  filename="track-1"
  mode="individual"
  trackIndex={0}
/>
```

**Export Without Effects (Raw Audio):**

```tsx
<ExportWavButton
  label="Export Raw"
  filename="raw-export"
  applyEffects={false}
/>
```

**Export With Tone.js Effects:**

```tsx
import { Reverb } from 'tone';

// Define effects chain
const createEffectsChain = (masterVolume, destination, isOffline) => {
  const reverb = new Reverb({ decay: 2.5, wet: 0.3 });
  masterVolume.connect(reverb);
  reverb.connect(destination);

  // Return cleanup function
  return () => {
    reverb.dispose();
  };
};

// Use in export button
<ExportWavButton
  label="Export with Reverb"
  filename="mix-with-effects"
  effectsFunction={createEffectsChain}
/>
```

---

## Complete Example

```tsx
import {
  WaveformPlaylistProvider,
  Waveform,
  PlayButton,
  PauseButton,
  StopButton,
  RewindButton,
  FastForwardButton,
  SetLoopRegionButton,
  LoopButton,
  ZoomInButton,
  ZoomOutButton,
  MasterVolumeControl,
  AudioPosition,
  TimeFormatSelect,
  ContinuousPlayCheckbox,
  AutomaticScrollCheckbox,
  ExportWavButton,
  useAudioTracks,
} from '@waveform-playlist/browser';

function FullFeaturedPlaylist() {
  const { tracks, loading, error } = useAudioTracks([
    { src: '/audio/track1.mp3', name: 'Track 1' },
    { src: '/audio/track2.mp3', name: 'Track 2' },
  ]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider
      tracks={tracks}
      samplesPerPixel={1024}
      waveHeight={100}
      timescale
      controls={{ show: true, width: 180 }}
    >
      {/* Transport Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <RewindButton />
        <PlayButton />
        <PauseButton />
        <StopButton />
        <FastForwardButton />
        <SetLoopRegionButton />
        <LoopButton />
      </div>

      {/* Zoom Controls */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
        <ZoomInButton />
        <ZoomOutButton />
      </div>

      {/* Volume and Position */}
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
        <MasterVolumeControl />
        <AudioPosition />
        <TimeFormatSelect />
      </div>

      {/* Options */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
        <ContinuousPlayCheckbox />
        <AutomaticScrollCheckbox />
      </div>

      {/* Export */}
      <div style={{ marginBottom: '1rem' }}>
        <ExportWavButton filename="my-mix" />
      </div>

      {/* Waveform */}
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

---

## Styling Components

All components accept standard React props including `className` and `style`:

```tsx
<PlayButton className="my-play-button" />
<PlayButton style={{ backgroundColor: 'green' }} />
```

For consistent styling, use the theme system or wrap components:

```tsx
const StyledPlayButton = styled(PlayButton)`
  background: #0066cc;
  color: white;
  border: none;
  padding: 0.5rem 1rem;
  border-radius: 4px;
  cursor: pointer;

  &:hover {
    background: #0055aa;
  }

  &:disabled {
    background: #cccccc;
    cursor: not-allowed;
  }
`;
```

## See Also

- [WaveformPlaylistProvider](/docs/react/api/providers/waveform-playlist-provider)
- [Hooks](/docs/react/api/hooks)
- [Theming Guide](/docs/react/guides/theming)
