---
sidebar_position: 12
description: "Advanced: manually configure DragDropProvider with custom sensors, modifiers, and drag handlers for clip interactions"
---

# Custom Drag Setup

For most use cases, [`ClipInteractionProvider`](/docs/guides/beats-and-bars#snap-to-grid) handles all clip drag/move/trim/snap/collision setup automatically. This guide covers the **manual approach** — configuring `DragDropProvider` directly when you need full control over sensors, modifiers, or drag behavior.

## When to Use Manual Setup

Use this approach when you need to:

- Combine clip dragging with annotation dragging in a single `DragDropProvider`
- Add custom modifiers beyond snap-to-grid and collision detection
- Customize drag start behavior (e.g., custom track selection logic)
- Use custom sensors or activation constraints
- Handle drag events with side effects not covered by the provider

For standard clip interactions, use `ClipInteractionProvider` instead — it eliminates ~120 lines of boilerplate.

## Required Imports

```tsx
import { DragDropProvider } from '@dnd-kit/react';
import { RestrictToHorizontalAxis } from '@dnd-kit/abstract/modifiers';
import {
  usePlaylistData,
  usePlaylistControls,
  useClipDragHandlers,
  useDragSensors,
  ClipCollisionModifier,
  SnapToGridModifier,     // Only if using snap-to-grid
  noDropAnimationPlugins,
  Waveform,
} from '@waveform-playlist/browser';
```

## Basic Setup (No Snap)

The minimal setup for interactive clips with collision detection:

```tsx
function PlaylistWithDrag({ tracks, onTracksChange }) {
  const { samplesPerPixel, playoutRef, isDraggingRef } = usePlaylistData();
  const { setSelectedTrackId } = usePlaylistControls();

  // Configure drag sensors (pointer activation with 1px distance threshold)
  const sensors = useDragSensors();

  // Get drag event handlers for clip move and boundary trim
  const {
    onDragStart: handleDragStart,
    onDragMove,
    onDragEnd,
  } = useClipDragHandlers({
    tracks,
    onTracksChange,
    samplesPerPixel,
    engineRef: playoutRef,
    isDraggingRef,
  });

  // Auto-select track when dragging starts
  const onDragStart = (event) => {
    const trackIndex = event.operation?.source?.data?.trackIndex;
    if (trackIndex !== undefined && tracks[trackIndex]) {
      setSelectedTrackId(tracks[trackIndex].id);
    }
    handleDragStart(event);
  };

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={[
        RestrictToHorizontalAxis,
        ClipCollisionModifier.configure({ tracks, samplesPerPixel }),
      ]}
      plugins={noDropAnimationPlugins}
    >
      <Waveform showClipHeaders interactiveClips />
    </DragDropProvider>
  );
}
```

:::note Key Components

- **`useDragSensors()`** — Configures pointer activation. Pass `{ touchOptimized: true }` for mobile (250ms touch delay).
- **`useClipDragHandlers()`** — Returns `onDragStart`, `onDragMove`, `onDragEnd` for clip movement and boundary trimming.
- **`ClipCollisionModifier`** — Prevents clips from overlapping on the same track.
- **`noDropAnimationPlugins`** — Disables the default snap-back animation on drop.
- **`RestrictToHorizontalAxis`** — Constrains drag to horizontal movement only.

:::

## Adding Snap-to-Grid

### Beats & Bars Snap

For musical grid snapping, add `SnapToGridModifier` in beats mode and a `snapSamplePosition` callback for boundary trim snapping:

```tsx
import {
  samplesToTicks,
  ticksToSamples,
  snapToGrid,
  ticksPerBeat,
  ticksPerBar,
} from '@waveform-playlist/core';
import { useBeatsAndBars } from '@waveform-playlist/ui-components';

function PlaylistWithBeatsSnap({ tracks, onTracksChange }) {
  const { samplesPerPixel, sampleRate, playoutRef, isDraggingRef } = usePlaylistData();
  const beatsAndBars = useBeatsAndBars();

  const { bpm, timeSignature, snapTo } = beatsAndBars;

  // Snap function for boundary trims (snaps absolute sample position to grid)
  const snapSamplePosition = useMemo(() => {
    if (snapTo === 'off') return undefined;
    const gridTicks =
      snapTo === 'bar' ? ticksPerBar(timeSignature) : ticksPerBeat(timeSignature);
    return (samplePos: number) => {
      const ticks = samplesToTicks(samplePos, bpm, sampleRate);
      const snapped = snapToGrid(ticks, gridTicks);
      return ticksToSamples(snapped, bpm, sampleRate);
    };
  }, [snapTo, bpm, timeSignature, sampleRate]);

  const sensors = useDragSensors();
  const { onDragStart, onDragMove, onDragEnd } = useClipDragHandlers({
    tracks,
    onTracksChange,
    samplesPerPixel,
    engineRef: playoutRef,
    isDraggingRef,
    snapSamplePosition, // Snaps boundary trims to grid
  });

  // Build modifiers array — snap modifier only when snap is enabled
  const modifiers = useMemo(() => {
    const mods = [RestrictToHorizontalAxis];

    if (snapTo !== 'off') {
      mods.push(
        SnapToGridModifier.configure({
          mode: 'beats',
          snapTo,
          bpm,
          timeSignature,
          samplesPerPixel,
          sampleRate,
        })
      );
    }

    mods.push(ClipCollisionModifier.configure({ tracks, samplesPerPixel }));
    return mods;
  }, [snapTo, bpm, timeSignature, tracks, samplesPerPixel, sampleRate]);

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={modifiers}
      plugins={noDropAnimationPlugins}
    >
      <Waveform showClipHeaders interactiveClips />
    </DragDropProvider>
  );
}
```

### Timescale Snap

For time-based grid snapping (derived from the current zoom level):

```tsx
import { getScaleInfo } from '@waveform-playlist/ui-components';

// In your component:
const gridSamples = Math.round(
  (getScaleInfo(samplesPerPixel).smallStep / 1000) * sampleRate
);

// Snap modifier for clip moves
SnapToGridModifier.configure({
  mode: 'timescale',
  gridSamples,
  samplesPerPixel,
})

// Snap function for boundary trims
const snapSamplePosition = (samplePos: number) =>
  Math.round(samplePos / gridSamples) * gridSamples;
```

## Modifier Order

The order of modifiers matters:

```
[RestrictToHorizontalAxis, SnapToGridModifier?, ClipCollisionModifier]
```

1. **RestrictToHorizontalAxis** — Applied first (efficient, constrains axis)
2. **SnapToGridModifier** — Applied second (snaps to grid, if enabled)
3. **ClipCollisionModifier** — Applied last (validates snapped position against other clips)

## Two Types of Snapping

There are two separate snap mechanisms:

| Mechanism | What it snaps | Where configured |
|-----------|--------------|-----------------|
| **`SnapToGridModifier`** | Clip **moves** (whole clip dragging) | `modifiers` array on `DragDropProvider` |
| **`snapSamplePosition`** | Boundary **trims** (adjusting clip edges) | `useClipDragHandlers()` option |

Both snap the **absolute position** to the grid, not the drag delta. This means an off-grid clip will snap to the nearest grid line when moved.

## Combining with Annotation Dragging

The main reason to use manual setup is combining clip and annotation drag in a single `DragDropProvider`. The [Annotations example](/examples/annotations) demonstrates this pattern:

```tsx
import {
  useClipDragHandlers,
  useAnnotationDragHandlers,
  useDragSensors,
} from '@waveform-playlist/browser';

function PlaylistWithAnnotations({ tracks, onTracksChange, annotations, onAnnotationsChange }) {
  const sensors = useDragSensors();

  // Clip drag handlers
  const {
    onDragStart: clipDragStart,
    onDragMove: clipDragMove,
    onDragEnd: clipDragEnd,
  } = useClipDragHandlers({ tracks, onTracksChange, /* ... */ });

  // Annotation drag handlers
  const {
    onDragStart: annotationDragStart,
    onDragMove: annotationDragMove,
    onDragEnd: annotationDragEnd,
  } = useAnnotationDragHandlers({
    annotations,
    onAnnotationsChange,
    /* ... */
  });

  // Combine handlers — route based on drag source type
  const onDragStart = (event) => {
    const data = event.operation?.source?.data;
    if (data?.boundary) {
      // Annotation boundary or clip boundary
      if (data.annotationId) {
        annotationDragStart(event);
      } else {
        clipDragStart(event);
      }
    } else {
      clipDragStart(event);
    }
  };

  // Similar routing for onDragMove and onDragEnd...

  return (
    <DragDropProvider
      sensors={sensors}
      onDragStart={onDragStart}
      onDragMove={onDragMove}
      onDragEnd={onDragEnd}
      modifiers={[RestrictToHorizontalAxis, ClipCollisionModifier.configure({ tracks, samplesPerPixel })]}
      plugins={noDropAnimationPlugins}
    >
      <Waveform showClipHeaders interactiveClips />
    </DragDropProvider>
  );
}
```

## Touch-Optimized Sensors

For mobile, configure touch-optimized sensors with a 250ms delay:

```tsx
const sensors = useDragSensors({ touchOptimized: true });
```

This uses delay-based activation for touch events (distinguishes drag from scroll) while keeping distance-based activation for mouse/pen.

## Hook Reference

### `useDragSensors(options?)`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `touchOptimized` | `boolean` | `false` | Enable 250ms touch delay |
| `touchDelay` | `number` | `250` | Delay in ms for touch activation |
| `touchTolerance` | `number` | `5` | Pixel tolerance during touch delay |

### `useClipDragHandlers(options)`

| Option | Type | Required | Description |
|--------|------|----------|-------------|
| `tracks` | `ClipTrack[]` | Yes | Current tracks state |
| `onTracksChange` | `(tracks: ClipTrack[]) => void` | Yes | Callback when tracks change |
| `samplesPerPixel` | `number` | Yes | Current zoom level |
| `engineRef` | `RefObject<PlaylistEngine>` | Yes | Engine ref from `usePlaylistData().playoutRef` |
| `isDraggingRef` | `MutableRefObject<boolean>` | Yes | Drag state ref from `usePlaylistData().isDraggingRef` |
| `snapSamplePosition` | `(sample: number) => number` | No | Snap function for boundary trims |

### `ClipCollisionModifier.configure(options)`

| Option | Type | Description |
|--------|------|-------------|
| `tracks` | `ClipTrack[]` | Current tracks for collision detection |
| `samplesPerPixel` | `number` | Current zoom level |

### `SnapToGridModifier.configure(options)`

**Beats mode:**

| Option | Type | Description |
|--------|------|-------------|
| `mode` | `'beats'` | Snap in PPQN tick space |
| `snapTo` | `'bar' \| 'beat'` | Grid resolution |
| `bpm` | `number` | Beats per minute |
| `timeSignature` | `[number, number]` | Time signature |
| `samplesPerPixel` | `number` | Current zoom level |
| `sampleRate` | `number` | Audio sample rate |

**Timescale mode:**

| Option | Type | Description |
|--------|------|-------------|
| `mode` | `'timescale'` | Snap by sample count |
| `gridSamples` | `number` | Samples per grid line |
| `samplesPerPixel` | `number` | Current zoom level |

## See Also

- [Beats & Bars](/docs/guides/beats-and-bars) — Musical timescale with `ClipInteractionProvider`
- [Annotations Example](/examples/annotations) — Combined clip + annotation dragging
- [LLM API Reference](/docs/api/llm-reference) — Complete TypeScript interfaces
