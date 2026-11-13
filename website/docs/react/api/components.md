---
sidebar_position: 2
description: "React component API reference for the waveform view (roots, parts, ready-made compositions), buttons, controls, and playhead components"
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

## The View: Roots, Parts and Ready-Made Compositions

The waveform view is composed. Each thing it draws is a component, a **part**, and it is drawn because it is rendered inside a **root**. Three ready-made compositions cover the common cases. The guide is [Composing the View](/docs/react/guides/composing-the-view).

```tsx
import {
  Waveform,
  WaveformEditor,
  MediaElementWaveform,
  WaveformRoot,
  MediaElementWaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformClipHeaders,
  WaveformFades,
  WaveformRecordingPreview,
  WaveformAnnotationBoxes,
  MediaElementAnnotationBoxes,
  WaveformSelection,
  WaveformPlayhead,
} from '@waveform-playlist/browser';
```

### Waveform

The multitrack view, ready-made: the timescale, the loop region, the track controls (a 200 px column), the tracks, the annotation boxes, the selection and the playhead, with the annotation text list below when there are annotations.

```tsx
<WaveformPlaylistProvider tracks={tracks}>
  <Waveform />
</WaveformPlaylistProvider>
```

It renders this composition:

```tsx
<WaveformRoot className={className}>
  <WaveformTimescale />
  <WaveformLoopRegion />
  <WaveformTrackControls />
  <WaveformTracks />
  <WaveformAnnotationBoxes getAnnotationBoxLabel={getAnnotationBoxLabel} />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
```

followed by `<PlaylistAnnotationList>` when the playlist has annotations.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Class of the view's outermost element |
| `annotationControls` | `AnnotationAction[]` | - | Action buttons on each item of the annotation text list |
| `annotationListConfig` | `AnnotationActionOptions` | - | Overrides `{ linkEndpoints, continuousPlay }` for the list's actions |
| `annotationTextHeight` | `number` | - | Height of the annotation text list in pixels |
| `renderAnnotationItem` | `(props: RenderAnnotationItemProps) => ReactNode` | - | Custom item of the annotation text list |
| `getAnnotationBoxLabel` | `GetAnnotationBoxLabelFn` | - | Label of an annotation box. Default: the annotation's id |
| `scrollActivePosition` | `ScrollLogicalPosition` | `'center'` | Where the active annotation is placed when the list scrolls to it |
| `scrollActiveContainer` | `'nearest' \| 'all'` | `'nearest'` | Which scrollable containers are scrolled |

What the view is made of is not an option of `Waveform`. To leave a part out, give a part an option, set the width of the controls column or add your own element, write the composition yourself with `WaveformRoot`.

Whether clips can be dragged and trimmed, and whether their trim handles are widened for touch, is not a prop either. Wrap the view in `ClipInteractionProvider`, or, with your own `DragDropProvider`, in `ClipInteractionOptions`:

| `ClipInteractionOptions` prop | Type | Default | Description |
|------|------|---------|-------------|
| `enabled` | `boolean` | inherited, `false` at the top | Clips below can be dragged and trimmed |
| `touchOptimized` | `boolean` | inherited, `false` at the top | Clips below get 24px trim handles instead of 8px |

See [Custom Drag Setup](/docs/react/guides/custom-drag-setup#clipinteractionoptions).

### WaveformEditor

`Waveform` with clip headers and fade curves: its tracks part holds `<WaveformClipHeaders />` and `<WaveformFades />`. Same props as `Waveform` (`WaveformEditorProps`). Inside a `ClipInteractionProvider` the header is what a clip is dragged by, and the trim handles come with it.

```tsx
<ClipInteractionProvider>
  <WaveformEditor />
</ClipInteractionProvider>
```

### MediaElementWaveform

The view of `MediaElementPlaylistProvider`, ready-made: the timescale, the one track, the annotation boxes, the selection and the playhead, with the annotation text list below when there are annotations.

```tsx
<MediaElementPlaylistProvider track={track}>
  <MediaElementWaveform />
</MediaElementPlaylistProvider>
```

It renders this composition:

```tsx
<MediaElementWaveformRoot className={className}>
  <WaveformTimescale />
  <WaveformTracks />
  <MediaElementAnnotationBoxes
    getAnnotationBoxLabel={getAnnotationBoxLabel}
    editable={editable}
    linkEndpoints={linkEndpoints}
    onAnnotationUpdate={onAnnotationUpdate}
  />
  <WaveformSelection />
  <WaveformPlayhead />
</MediaElementWaveformRoot>
```

followed by `<MediaElementAnnotationList>` when there are annotations.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Class of the view's outermost element |
| `annotationTextHeight` | `number` | - | Height of the annotation text list in pixels |
| `getAnnotationBoxLabel` | `GetAnnotationBoxLabelFn` | - | Label of an annotation box |
| `renderAnnotationItem` | `(props: RenderAnnotationItemProps) => ReactNode` | - | Custom item of the annotation text list |
| `editable` | `boolean` | `false` | Annotation boundaries can be dragged |
| `linkEndpoints` | `boolean` | `false` | Dragging a boundary also moves the boundary of the annotation it touches |
| `onAnnotationUpdate` | `OnAnnotationUpdateFn` | - | Called with the full annotations array after an edit |
| `scrollActivePosition` | `ScrollLogicalPosition` | `'center'` | Where the active annotation is placed when the list scrolls to it |
| `scrollActiveContainer` | `'nearest' \| 'all'` | `'nearest'` | Which scrollable containers are scrolled |

### WaveformRoot and MediaElementWaveformRoot

The frame of the view: the scrolling area, the timescale strip above it and the controls column beside it. A root sorts its children into those places by the type of the element; a child that is not a part is drawn in the scrolling tracks area, in the order written.

`WaveformRoot` needs `WaveformPlaylistProvider`; `MediaElementWaveformRoot` needs `MediaElementPlaylistProvider`. Each throws under the other provider.

| Prop | Type | Description |
|------|------|-------------|
| `className` | `string` | Class of the view's outermost element |
| `children` | `ReactNode` | The parts, and anything else to draw over the tracks |

A press on the tracks area starts the selection drag; under `WaveformRoot` it also selects the track under the pointer.

### Parts

| Part | Draws | Props | Provider |
| --- | --- | --- | --- |
| `WaveformTimescale` | the time ruler, in a strip above the tracks | `renderTick` | either |
| `WaveformLoopRegion` | the draggable loop region, in the same strip; nothing while looping is off | none | `WaveformPlaylistProvider` |
| `WaveformTrackControls` | the column of track controls, left of the scrolling area | `width`, `renderTrackControls`, `onRemoveTrack`, `trackReordering` | `WaveformPlaylistProvider` |
| `WaveformTracks` | the track rows with their clips | `gainScaled`; children: the three parts below | either |
| `WaveformClipHeaders` | a header on every clip | none | either |
| `WaveformFades` | each clip's fade-in and fade-out curves | none | either |
| `WaveformRecordingPreview` | the take being recorded, in its track | `recordingState` | `WaveformPlaylistProvider` |
| `WaveformAnnotationBoxes` | the row of annotation boxes | `getAnnotationBoxLabel` | `WaveformPlaylistProvider` |
| `MediaElementAnnotationBoxes` | the row of annotation boxes of the MediaElement player, with its edge drag | `getAnnotationBoxLabel`, `editable`, `linkEndpoints`, `onAnnotationUpdate` | `MediaElementPlaylistProvider` |
| `WaveformSelection` | the highlighted selection; nothing for a collapsed selection | none | either |
| `WaveformPlayhead` | the playhead | `renderPlayhead` | either |

#### WaveformTimescale

| Prop | Type | Description |
|------|------|-------------|
| `renderTick` | `(label: string, pixelPosition: number) => ReactNode` | Custom tick label. `label` is already formatted for the scale mode |

The strip is 30 px tall and exists when a root has a `WaveformTimescale` or a `WaveformLoopRegion`.

#### WaveformTrackControls

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `width` | `number` | `200` | Width of the controls column in pixels. The root reads it from the element, so it must be on the part itself |
| `renderTrackControls` | `(trackIndex: number) => ReactNode` | - | Custom control panel for a track |
| `onRemoveTrack` | `(trackIndex: number) => void` | - | The close button of the default panel is drawn only when this is given |
| `trackReordering` | `boolean` | `false` | A drag grip and move up/down buttons on each default panel. The drag requires `ClipInteractionProvider` (or another `@dnd-kit/react` `DragDropProvider`); the buttons work regardless |

Under `MediaElementWaveformRoot` it draws nothing.

#### WaveformTracks

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `gainScaled` | `boolean` | `false` | Draw each clip's waveform scaled by its `gain` (clamped to the channel height), so clips levelled with clip gain look the way they sound. Draw-time only: peaks are not regenerated |
| `children` | `ReactNode` | - | `WaveformClipHeaders`, `WaveformFades`, `WaveformRecordingPreview`. Nothing else is rendered from here |

`WaveformClipHeaders`, `WaveformFades` and `WaveformRecordingPreview` are markers: `WaveformTracks` and the root read them from its children, and they draw nothing anywhere else. With clip interaction enabled, the header is what a clip is dragged by, and the trim handles come with it. Under `MediaElementPlaylistProvider` the header shows the track's `name` ("Track" without one), and nothing supports dragging the clip: leave clip interaction off above that provider.

```tsx
<WaveformTracks gainScaled>
  <WaveformClipHeaders />
  {showFades ? <WaveformFades /> : null}
</WaveformTracks>
```

#### WaveformRecordingPreview

| Prop | Type | Description |
|------|------|-------------|
| `recordingState` | `WaveformRecordingState` | The take: `isRecording`, `trackId`, `startSample`, `progress` (from `useIntegratedRecording` / `useRecording`), `bits`, optional `latencyOffset` |

It only draws the take. Call [`useRecordingSession`](/docs/react/api/hooks#userecordingsession) so the provider mutes what the armed track already holds for the take. See the [Recording guide](/docs/react/guides/recording).

#### WaveformAnnotationBoxes and MediaElementAnnotationBoxes

Both need the `AnnotationProvider` of `@waveform-playlist/annotations` and draw nothing without it or without annotations.

| Prop | On | Type | Default | Description |
|------|----|------|---------|-------------|
| `getAnnotationBoxLabel` | both | `GetAnnotationBoxLabelFn` | the annotation's id | Label of a box |
| `editable` | `MediaElementAnnotationBoxes` | `boolean` | `false` | The edges of a box can be dragged |
| `linkEndpoints` | `MediaElementAnnotationBoxes` | `boolean` | `false` | Dragging an edge also moves the edge of the box it touches |
| `onAnnotationUpdate` | `MediaElementAnnotationBoxes` | `OnAnnotationUpdateFn` | - | Called with the full annotations array after a drag |

Under `WaveformPlaylistProvider` whether boxes can be edited comes from the provider (`annotationList.editable`, `setAnnotationsEditable`). Dragging an edge needs `useAnnotationDragHandlers` wired into a `DragDropProvider` of your own around the view (see the [Annotations guide](/docs/react/guides/annotations)); `ClipInteractionProvider` handles clip drags and track reordering, not annotation edges. `MediaElementAnnotationBoxes` brings its own drag wiring.

#### WaveformPlayhead

| Prop | Type | Description |
|------|------|-------------|
| `renderPlayhead` | `RenderPlayheadFunction` | Custom playhead. See [Custom Playhead](#custom-playhead) |

The playhead is shown while playing, and at rest when no range is selected.

### Where a Part Must Be

- A part is a child of its root, or of a fragment in it. A part wrapped in your own component is not recognised: a wrapped `WaveformTimescale` or `WaveformTrackControls` is drawn in the tracks area, a wrapped `WaveformClipHeaders` does nothing.
- One `WaveformTracks` per root, as the root's own child.
- `WaveformTimescale`, `WaveformLoopRegion`, `WaveformTrackControls`, `WaveformTracks` and both annotation rows throw outside a root ("The timescale must be rendered inside the waveform root").
- In development a part that is not where it can work says so once in the console. It does not throw.

The full list is in [Composing the View](/docs/react/guides/composing-the-view#where-a-part-must-be).

---

## Custom Playhead

Replace the default playhead with a custom component: pass `renderPlayhead` to `<WaveformPlayhead>` in your composition.

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
   * on every frame of playback, and on a seek, a stop and the end of playback
   * (after a pause under MediaElementPlaylistProvider it is not rewritten: it
   * holds the last time the loop or the element's `timeupdate` reported,
   * normally within a frame of the paused position). Under
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

`<WaveformPlayhead>` renders nothing (and `renderPlayhead` is not called) while a range is highlighted and playback is stopped or paused.

Engine values are not props. A playhead for `WaveformPlaylistProvider` that needs one calls [`useEngineRefs()`](/docs/react/api/hooks#useenginerefs); the function passed as `renderPlayhead` may call hooks, the same ones on every render (or return your own component: `(props) => <MyPlayhead {...props} />`). A custom playhead is unmounted while it is hidden, so state it holds starts again.

### Built-in Playhead Components

Import pre-built playhead variants:

```tsx
import { Playhead, PlayheadWithMarker } from '@waveform-playlist/ui-components';
```

#### Default Playhead

A simple vertical line (used by default):

```tsx
<WaveformPlayhead />
// or explicitly:
<WaveformPlayhead renderPlayhead={(props) => <Playhead {...props} />} />
```

#### PlayheadWithMarker

A playhead with a triangle marker at the top, positioned to sit in the timescale area:

```tsx
<WaveformRoot>
  <WaveformTimescale />
  <WaveformLoopRegion />
  <WaveformTrackControls />
  <WaveformTracks />
  <WaveformSelection />
  <WaveformPlayhead renderPlayhead={(props) => <PlayheadWithMarker {...props} />} />
</WaveformRoot>
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
<WaveformPlayhead renderPlayhead={(props) => <GlowingPlayhead {...props} />} />
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

### Track volume

There is no exported per-track volume component. The volume slider of a track is part of the default control panel that `<WaveformTrackControls />` draws. For your own slider, read the value from `usePlaylistMixer().trackStates[trackIndex].volume` and set it with `useEditorControls().setTrackVolume(trackIndex, volume)`, in a panel you pass as `renderTrackControls`.

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

It must be inside the `<AnnotationProvider>` of `@waveform-playlist/annotations` and throws without it, as `LinkEndpointsCheckbox`, `EditableCheckbox` and `DownloadAnnotationsButton` do.

### AutomaticScrollCheckbox

Toggle for auto-scrolling during playback. While it is on, a drag on the waveform during playback does not select a range: the press and its release seek to where the press landed.

```tsx
<AutomaticScrollCheckbox />
```

---

## Track Controls

### The default panel

The built-in control panel of a track is not exported as a component of its own: `<WaveformTrackControls />` draws one per track.

**Includes:**
- Track name
- Mute button
- Solo button
- Volume slider
- Pan slider
- A close button, when `onRemoveTrack` is given
- A drag grip and move up/down buttons, with `trackReordering`

Pass `renderTrackControls` to draw your own panel instead.

### SortableTrackControls

Registers a custom track-controls row as a vertical drag source for reordering. Use this when rendering your own track control panel (via `renderTrackControls` on `<WaveformTrackControls>`) instead of the default one — the default panel already wires this up internally when `trackReordering` is set on `<WaveformTrackControls>`.

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
  WaveformRoot,
  WaveformTimescale,
  WaveformLoopRegion,
  WaveformTrackControls,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
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
  AutomaticScrollCheckbox,
} from '@waveform-playlist/browser';
import { ExportWavButton, useAudioTracks } from '@waveform-playlist/browser/tone';

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
        <AutomaticScrollCheckbox />
      </div>

      {/* Export */}
      <div style={{ marginBottom: '1rem' }}>
        <ExportWavButton filename="my-mix" />
      </div>

      {/* The view: the parts of <Waveform /> without the annotation row, with a 180 px controls column */}
      <WaveformRoot>
        <WaveformTimescale />
        <WaveformLoopRegion />
        <WaveformTrackControls width={180} />
        <WaveformTracks />
        <WaveformSelection />
        <WaveformPlayhead />
      </WaveformRoot>
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
