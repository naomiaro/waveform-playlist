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
| Either provider | `PlayButton`, `PauseButton`, `StopButton`, `RewindButton`, `FastForwardButton`, `SkipBackwardButton`, `SkipForwardButton`, `ClearAllButton`, `AudioPosition`, `TimeFormatSelect`, `SelectionTimeInputs`, `AutomaticScrollCheckbox`, and, inside `<AnnotationProvider>`, `AnnotationList`, `ContinuousPlayCheckbox`, `LinkEndpointsCheckbox`, `EditableCheckbox` and `DownloadAnnotationsButton` |
| `MediaElementPlaylistProvider` only | `PlaybackRateSelect` |
| `WaveformPlaylistProvider` only | `LoopButton`, `SetLoopRegionButton`, `ZoomInButton`, `ZoomOutButton`, `MasterVolumeControl`, `KeyboardShortcuts`, `ExportWavButton`, and, among the children of `<WaveformTrackControls>`, `DefaultTrackControls` and the [track control pieces](#track-controls) |

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
  WaveformSelection,
  WaveformPlayhead,
  AnnotationList,
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
  <WaveformAnnotationBoxes />
  <WaveformSelection />
  <WaveformPlayhead />
</WaveformRoot>
<AnnotationList />
```

The two annotation components draw nothing while the playlist has no annotations.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Class of the view's outermost element |

What the view is made of is not an option of `Waveform`. To leave a part out, give a part an option (a label for the annotation boxes, a height or action buttons for the annotation list), set the width of the controls column or add your own element, write the composition yourself with `WaveformRoot`.

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
  <WaveformAnnotationBoxes />
  <WaveformSelection />
  <WaveformPlayhead />
</MediaElementWaveformRoot>
<AnnotationList />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `className` | `string` | - | Class of the view's outermost element |

Whether annotations can be edited and whether a dragged edge takes its neighbour along are options of the provider (`annotationList`, [`useAnnotationOptions()`](/docs/react/api/hooks#useannotationoptions)), not props of the view.

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
| `WaveformTrackControls` | the column of track controls, left of the scrolling area | `width`; children: the control panel of one track | `WaveformPlaylistProvider` |
| `WaveformTracks` | the track rows with their clips | `gainScaled`; children: the three parts below | either |
| `WaveformClipHeaders` | a header on every clip | none | either |
| `WaveformFades` | each clip's fade-in and fade-out curves | none | either |
| `WaveformRecordingPreview` | the take being recorded, in its track | `recordingState` | `WaveformPlaylistProvider` |
| `WaveformAnnotationBoxes` | the row of annotation boxes, with the drag of their edges | `getLabel`, `height` | either |
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
| `children` | `ReactNode` | `<DefaultTrackControls />` | The control panel of ONE track. The part renders it once per track, each copy inside that track's context, which `useTrack()` and the [pieces](#track-controls) read |

```tsx
<WaveformTrackControls width={180}>
  <DefaultTrackControls />
  <TrackRemoveButton onRemove={removeTrack} />
  <TrackReorderGrip />
</WaveformTrackControls>
```

Each track has a slot in the column: as wide as the column and as tall as the track's row, with `overflow: hidden`. A click anywhere in a slot selects the track. Inside the slot, the element that holds the panel has `data-track-controls="<track id>"`.

The part compares its children with the ones of the previous render (element types, keys and props; `children` recursively, `style` one level deep) and keeps the previous ones while they are equal. Children written inline therefore do not render the panels when the composing component renders, as long as their props keep their identity. A function or an object written inline as a prop (other than `style`) makes every panel render each time.

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

#### WaveformAnnotationBoxes

The row of annotation boxes, under either root. It needs the `AnnotationProvider` of `@waveform-playlist/annotations` and draws nothing without it or without annotations.

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `getLabel` | `GetAnnotationBoxLabelFn` | the annotation's id | Label of a box, from the annotation and its index. Pass a function that keeps its identity (defined outside the component, or memoized): a new one renders every box |
| `height` | `number` | `30` | Height of the row in pixels |

A click on a box makes its annotation the active one and plays it from its start; with continuous play off, playback ends where the annotation ends.

The part has its own `DragDropProvider` around the row and wires the drag of the edges itself. An edge can be dragged while the provider's `editable` option is on; whether it takes the edge it touches along is the provider's `linkEndpoints` option. The moves are shown as they happen and `onAnnotationsChange` is called once, on release. An edge can be dragged as far as the timeline is drawn, which can be past the end of the audio. A `DragDropProvider` of your own above the view, `ClipInteractionProvider` included, does not receive the drag of an annotation edge.

The drag starts after 1 px of pointer travel. With `touchOptimized` on a `ClipInteractionOptions` or `ClipInteractionProvider` above, a touch must be held 250 ms first.

The border of a box that is not active is the theme's `annotationBoxBorder`. See the [Annotations guide](/docs/react/guides/annotations).

#### WaveformPlayhead

| Prop | Type | Description |
|------|------|-------------|
| `renderPlayhead` | `RenderPlayheadFunction` | Custom playhead. See [Custom Playhead](#custom-playhead) |

The playhead is shown while playing, and at rest when no range is selected.

### Where a Part Must Be

- A part is a child of its root, or of a fragment in it. A part wrapped in your own component is not recognised: a wrapped `WaveformTimescale` or `WaveformTrackControls` is drawn in the tracks area, a wrapped `WaveformClipHeaders` does nothing.
- One `WaveformTracks` per root, as the root's own child.
- `WaveformTimescale`, `WaveformLoopRegion`, `WaveformTrackControls`, `WaveformTracks` and `WaveformAnnotationBoxes` throw outside a root ("The timescale must be rendered inside the waveform root").
- In development a part that is not where it can work says so once in the console. It does not throw.

The full list is in [Composing the View](/docs/react/guides/composing-the-view#where-a-part-must-be).

### AnnotationList

The annotation text list, under either provider. It is not a part of a root: render it anywhere under the provider (below the view, in a sidebar, more than once). It reads the annotations, the active annotation and the three annotation options from the provider, and reports edits through the provider's `onAnnotationsChange`.

```tsx
<AnnotationList height={300} actions={annotationActions} scrollActivePosition="start" />
```

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `height` | `number` | - | Height of the list in pixels. Without it the list is at most 200 px high |
| `actions` | `AnnotationAction[]` | - | Buttons shown on each row while the provider's `editable` option is on. An action is called with the annotation, its index, the annotations and `{ linkEndpoints, continuousPlay }` as the provider has them. Pass an array that keeps its identity: a new one renders every row |
| `scrollActivePosition` | `ScrollLogicalPosition \| 'none'` | `'center'` | Where the active annotation is put when the list scrolls to it during playback. `'none'`: the list does not follow |
| `scrollActiveContainer` | `'nearest' \| 'all'` | `'nearest'` | Which containers scroll: only the list, or the page too |
| `children` | `(item: RenderAnnotationItemProps) => ReactNode` | - | Draws a row in place of the default one. Called with `{ annotation, index, isActive, onClick, formatTime }`. Define it outside the component or memoize it: a new function renders every row |

- It draws nothing while there are no annotations.
- It needs the `AnnotationProvider` of `@waveform-playlist/annotations`. Without it the list draws nothing, and a development build warns once in the console.
- A click on a row makes the annotation the active one and plays it from its start, as a click on its box does. In the default row a click in a field that is being edited, or on an action button, does not.
- While `editable` is on, the text and the id of a default row can be edited in place.

See the [Annotations guide](/docs/react/guides/annotations#annotationlist).

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

The master volume is a number from 0 (silent) to 1 (full): that is what `usePlaylistMixer().masterVolume` holds and what the control passes to `setMasterVolume`. The `<input type="range">` it draws runs from 0 to 100, and the control divides by 100.

### Track volume

`<TrackVolumeSlider />`, among the children of `<WaveformTrackControls>`: see [Track Controls](#track-controls). For a slider outside the controls column, read the value from `usePlaylistMixer().trackStates[i]?.volume` (the entry of `tracks[i]`; `undefined` while that track is loading) and set it with `useEditorControls().setTrackVolume(tracks[i].id, volume)`.

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

It must be inside the `<AnnotationProvider>` of `@waveform-playlist/annotations` and throws without it, as `LinkEndpointsCheckbox`, `EditableCheckbox` and `DownloadAnnotationsButton` do. It shows the provider's `continuousPlay` option (`useAnnotationOptions()`) and sets it with `setContinuousPlay` of `usePlaybackControls()`.

### LinkEndpointsCheckbox and EditableCheckbox

Either provider. `LinkEndpointsCheckbox` shows and sets the provider's `linkEndpoints` option: whether a dragged annotation edge takes the edge it touches along. `EditableCheckbox` shows and sets the `editable` option: whether the edges of the annotation boxes can be dragged, and whether the text and ids in the annotation list can be edited and its action buttons are shown.

```tsx
<LinkEndpointsCheckbox />
<EditableCheckbox />
```

The three annotation checkboxes take a `className`. Their labels are "Continuous Play", "Link Endpoints" and "Editable Annotations". The `id` of each input is generated, so the same checkbox can be rendered twice on a page.

### AutomaticScrollCheckbox

Toggle for auto-scrolling during playback. While it is on, a drag on the waveform during playback does not select a range: the press and its release seek to where the press landed.

```tsx
<AutomaticScrollCheckbox />
```

---

## Track Controls

The control panel of a track is composed from pieces. Each piece is bound to the track whose panel it is rendered in: it takes no prop for the track and works only among the children of [`<WaveformTrackControls>`](#waveformtrackcontrols), which renders them once per track. Elsewhere a piece throws the message of [`useTrack()`](/docs/react/api/hooks#usetrack). The guide is [Track Management](/docs/react/guides/track-management).

```tsx
import {
  DefaultTrackControls,
  TrackName,
  TrackMuteButton,
  TrackSoloButton,
  TrackVolumeSlider,
  TrackPanSlider,
  TrackMenuButton,
  TrackRemoveButton,
  TrackReorderGrip,
} from '@waveform-playlist/browser';
```

While a track is loading (the provider has no mixer state for it yet), the mute and solo buttons, the two sliders and the two move buttons are disabled, and the name is "Track N".

### DefaultTrackControls

The default panel: the name, the track menu, mute, solo, volume and pan. It is what `<WaveformTrackControls />` draws when it has no children. It has no remove button and no reorder grip: render `<TrackRemoveButton>` or `<TrackReorderGrip />` beside it.

| Prop | Type | Description |
|------|------|-------------|
| `children` | `ReactNode` | Drawn inside the panel, below the pan slider |

```tsx
<WaveformTrackControls>
  <DefaultTrackControls>
    <MyTrackColorPicker />
  </DefaultTrackControls>
  <TrackRemoveButton onRemove={removeTrack} />
</WaveformTrackControls>
```

The panel fills the slot. An element rendered beside it in the normal flow is therefore outside the visible slot; a control of your own goes inside, as a child, unless it positions itself as the remove button and the grip do.

### TrackName

The track's name on one line, cut off with an ellipsis; "Track N" (N is the position, from 1) for a track without a name. No props. The element has the attribute `data-track-name`.

### TrackMuteButton and TrackSoloButton

Toggle buttons labelled "Mute" and "Solo", with `aria-pressed`. No props. Disabled while the track is loading.

### TrackVolumeSlider

The track's volume, 0 to 1 in steps of 0.01, between two speaker icons. The input is labelled "Volume". No props. Disabled while the track is loading.

### TrackPanSlider

The track's pan, -1 (left) to 1 (right) in steps of 0.01, between "L" and "R". The input is labelled "Pan". No props. Disabled while the track is loading.

### TrackMenuButton

The track's menu: how the track is drawn (waveform, spectrogram, both) and its spectrogram settings. No props. It draws nothing without a `SpectrogramProvider` above the view, and nothing for a MIDI track. A click on the button does not select the track.

### TrackRemoveButton

A close button at the top left corner of the track's slot (it positions itself; put it anywhere among the children). A click calls `onRemove` and does not select the track.

| Prop | Type | Description |
|------|------|-------------|
| `onRemove` | `(trackId: string) => void` | Called with the track's id. Removing the track from your `tracks` is yours to do |

Pass a function that keeps its identity (`useCallback`, or a hook's stable function): a new function on every render of your component renders every panel each time.

### TrackReorderGrip

A drag grip with a move-up and a move-down button, at the right edge of the track's slot (it positions itself). No props. The default panel makes room for it on both sides when the grip is rendered beside the panel, as a sibling (CSS `:has()`). The buttons work with no other setup; dragging needs a `ClipInteractionProvider` above the view. The up button is disabled for the first track, the down button for the last, both while the track is loading. Neither the grip nor the buttons select the track. The element around them has the attribute `data-track-reorder-grip`.

A reorder is committed with `useEditorControls().reorderTrack(trackId, toIndex)`; the new order arrives through the provider's `onTracksChange`.

For a grip element of your own, see [`useTrackReorderHandle()`](/docs/react/api/hooks#usetrackreorderhandle).

### A panel of your own

Any component among the children can read its track with [`useTrack()`](/docs/react/api/hooks#usetrack):

```tsx
function TrackGainReadout() {
  const { volume } = useTrack();
  return <span>{Math.round(volume * 100)}%</span>;
}

<WaveformTrackControls>
  <DefaultTrackControls>
    <TrackGainReadout />
  </DefaultTrackControls>
</WaveformTrackControls>
```

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
