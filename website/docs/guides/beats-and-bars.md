---
sidebar_position: 11
description: "Display bar and beat markers, configure BPM and time signatures, and snap clips to a musical grid"
---

# Beats & Bars

Waveform Playlist can display a musical timescale with bar and beat markers instead of the default time-based scale. Clips can snap to the beat or bar grid when dragged.

## Setup

Wrap your playlist content with `BeatsAndBarsProvider` from `@waveform-playlist/ui-components`:

```tsx
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import { BeatsAndBarsProvider } from '@waveform-playlist/ui-components';

<WaveformPlaylistProvider tracks={tracks} timescale>
  <BeatsAndBarsProvider bpm={120} timeSignature={[4, 4]} snapTo="beat">
    <Waveform showClipHeaders interactiveClips />
  </BeatsAndBarsProvider>
</WaveformPlaylistProvider>
```

When `BeatsAndBarsProvider` is present, the timescale automatically switches from temporal (minutes:seconds) to bar and beat markers.

## Provider Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `bpm` | `number` | — | Beats per minute |
| `timeSignature` | `[number, number]` | — | Time signature as `[beats, noteValue]`, e.g., `[4, 4]` |
| `snapTo` | `'bar' \| 'beat' \| 'off'` | `'off'` | Grid resolution for snap-to-grid |

## Snap-to-Grid

Wrap your `Waveform` with `ClipInteractionProvider` to enable drag/move/trim with snap-to-grid. Set `snap` to enable snapping — it auto-detects beats mode from `BeatsAndBarsProvider` context:

```tsx
import { WaveformPlaylistProvider, Waveform, ClipInteractionProvider } from '@waveform-playlist/browser';
import { BeatsAndBarsProvider } from '@waveform-playlist/ui-components';

<WaveformPlaylistProvider tracks={tracks} timescale>
  <BeatsAndBarsProvider bpm={120} timeSignature={[4, 4]} snapTo="beat">
    <ClipInteractionProvider snap>
      <Waveform showClipHeaders />
    </ClipInteractionProvider>
  </BeatsAndBarsProvider>
</WaveformPlaylistProvider>
```

`ClipInteractionProvider` handles all the drag sensors, collision detection, snap modifiers, and drag handlers internally. The `interactiveClips` prop on `Waveform` is auto-enabled when inside a `ClipInteractionProvider`.

When `snap` is enabled, the provider reads from `BeatsAndBarsProvider` context:
- If `scaleMode="beats"` and `snapTo` is `"beat"` or `"bar"` → clips snap to the beat/bar grid
- Otherwise → clips snap to the timescale grid (derived from zoom level)

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `snap` | `boolean` | `false` | Enable snap-to-grid (auto-detects beats vs timescale from context) |
| `touchOptimized` | `boolean` | `false` | 250ms delay activation for touch input |

:::info Advanced: Manual DragDropProvider Setup

For full control over drag sensors, modifiers, and handlers, you can bypass `ClipInteractionProvider` and configure `DragDropProvider` directly with `useClipDragHandlers`, `useDragSensors`, `ClipCollisionModifier`, and `SnapToGridModifier`. See the [LLM API Reference](/docs/api/llm-reference) for the complete hook and modifier signatures.

:::

### Snap Modes

- **`'bar'`** — Clips snap to bar boundaries (e.g., every 4 beats in 4/4 time)
- **`'beat'`** — Clips snap to individual beat boundaries
- **`'off'`** — Free positioning, no snapping

The modifier snaps the clip's **absolute position** to the grid, not the drag delta. This means an off-grid clip will snap to the nearest grid line, not stay at its original offset.

## PPQN (Pulses Per Quarter Note)

All beat/bar math uses **192 PPQN** — the same resolution as [Tone.js](https://tonejs.github.io/)'s internal transport. Positions are converted to integer ticks to avoid floating-point errors with non-integer beat durations.

The core math utilities are available from `@waveform-playlist/core`:

```tsx
import {
  ticksPerBeat,    // (ppqn) => ticks per beat
  ticksPerBar,     // (ppqn, timeSignature) => ticks per bar
  samplesToTicks,  // (samples, sampleRate, bpm, ppqn) => ticks
  ticksToSamples,  // (ticks, sampleRate, bpm, ppqn) => samples
  snapToGrid,      // (ticks, gridTicks) => nearest grid tick
  PPQN,            // 192
} from '@waveform-playlist/core';
```

### Why integer ticks?

Millisecond-based modular arithmetic breaks with non-integer beat durations. For example, at 119 BPM a beat is ~504.2 ms — checking `counter % 504.2 === 0` fails due to floating-point precision. Integer tick space (192 ticks per beat) eliminates this entirely.

## Time Signatures

Supported time signatures include any `[beats, noteValue]` combination:

| Signature | Beats per bar | Note value | Ticks per bar |
|-----------|---------------|------------|---------------|
| 4/4 | 4 | Quarter | 768 |
| 3/4 | 3 | Quarter | 576 |
| 6/8 | 6 | Eighth | 576 |
| 2/2 | 2 | Half | 768 |
| 5/4 | 5 | Quarter | 960 |
| 7/8 | 7 | Eighth | 672 |

## Dynamic BPM and Time Signature

The provider props are reactive — changing `bpm` or `timeSignature` re-renders the timescale and updates the snap grid:

```tsx
const [bpm, setBpm] = useState(120);
const [timeSig, setTimeSig] = useState<[number, number]>([4, 4]);

<BeatsAndBarsProvider bpm={bpm} timeSignature={timeSig} snapTo="beat">
  <input
    type="number"
    value={bpm}
    onChange={(e) => setBpm(Number(e.target.value))}
  />
  {/* Waveforms stretch/compress as BPM changes */}
</BeatsAndBarsProvider>
```

## Temporal Mode Fallback

The `SmartScale` component (used internally by `Waveform`) checks for `BeatsAndBarsProvider`. Without it, the timescale renders in temporal mode (minutes:seconds). You can also let users switch between modes — see the [Beats & Bars example](/examples/beats-and-bars) for a complete implementation with a mode selector.

## See Also

- [Beats & Bars Example](/examples/beats-and-bars) — Interactive demo with BPM, time signature, and snap controls
- [Loading Audio](/docs/guides/loading-audio) — Immediate mode for progressive loading
- [Track Management](/docs/guides/track-management) — Drag and trim clips
