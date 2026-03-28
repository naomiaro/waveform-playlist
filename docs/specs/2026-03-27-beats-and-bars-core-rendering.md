# Beats & Bars — Core Rendering

**Date:** 2026-03-27
**Status:** Draft
**Scope:** `<daw-grid>` element, ruler beats & bars mode, `snapToTicks()` utility, editor wiring

---

## Overview

Add a beats & bars visualization mode to dawcore. In this mode, the x-axis is tick-linear — a quarter note is always the same pixel width regardless of tempo. The grid draws striped backgrounds behind tracks, the ruler shows bar/beat labels, and snap quantizes interactions to musical grid boundaries.

This spec covers single tempo + single time signature. Multi-tempo/multi-meter rendering and engine PPQN are deferred to future specs.

## Design Decisions

### Tick-Linear X-Axis

In beats mode, zoom is `ticksPerPixel` (not `samplesPerPixel`). BPM does not affect visual spacing — it only converts real-time positions (playhead, seek, duration) to tick space at the editor boundary. Grid and ruler are pure tick arithmetic.

### UI-Only Coordinate Transform

The engine stays in seconds. Beats mode converts at the editor boundary:

- **Pixel → engine:** `pixel × ticksPerPixel → ticks → (ticks × 60) / (bpm × ppqn) → seconds`
- **Engine → pixel:** `seconds → (seconds × bpm × ppqn) / 60 → ticks → ticks / ticksPerPixel → pixel`

Engine PPQN (tick-native operations) is a prerequisite for multi-tempo beats mode, deferred to a future spec.

### Hybrid Computation + Cache

Pure `computeMusicalTicks()` in `@waveform-playlist/core` (testable, reusable by React package). Thin one-slot memoization cache in dawcore shared by grid and ruler — same visible range on the same frame, zero recomputation.

### Single Tempo + Single Meter

With one BPM and one time signature, grid spacing is perfectly uniform. Multi-tempo requires tick-space waveform rendering (stretching/compressing waveforms at tempo changes) — a separate future effort.

---

## 1. SnapTo Type & Utilities (`@waveform-playlist/core`)

### SnapTo Type

```typescript
type SnapTo =
  | 'bar'
  | 'beat'
  | '1/2' | '1/4' | '1/8' | '1/16' | '1/32'
  | '1/2T' | '1/4T' | '1/8T' | '1/16T'
  | 'off';
```

Added to `packages/core/src/types/index.ts` and re-exported from the package.

### `snapToTicks()`

Pure lookup. Converts a `SnapTo` value to its tick interval for a given time signature.

```typescript
function snapToTicks(
  snapTo: SnapTo,
  timeSignature: [numerator: number, denominator: number],
  ppqn: number = 960
): number
```

Reference values at 4/4, 960 PPQN:

| SnapTo | Ticks | Musical value |
|--------|-------|---------------|
| `bar` | 3840 | 1 bar |
| `beat` | 960 | quarter note |
| `1/2` | 1920 | half note |
| `1/4` | 960 | quarter note (same as beat in 4/4) |
| `1/8` | 480 | eighth note |
| `1/16` | 240 | sixteenth note |
| `1/32` | 120 | thirty-second note |
| `1/2T` | 1280 | half triplet |
| `1/4T` | 640 | quarter triplet |
| `1/8T` | 320 | eighth triplet |
| `1/16T` | 160 | sixteenth triplet |
| `off` | 0 | no snapping |

Triplets use `× 2/3` of the straight value.

### `snapTickToGrid()`

Snaps a tick position to the nearest grid boundary.

```typescript
function snapTickToGrid(
  tick: number,
  snapTo: SnapTo,
  timeSignature: [number, number],
  ppqn: number = 960
): number
```

Returns the original tick if `snapTo` is `'off'`. Otherwise rounds to nearest `snapToTicks()` multiple.

### Location

All functions and the `SnapTo` type go in `packages/core/src/beatsAndBars.ts` alongside the existing `ticksPerBeat`, `ticksPerBar`, `ticksToBarBeatLabel` functions.

---

## 2. Musical Tick Computation (`@waveform-playlist/core`)

### Types

```typescript
type TickLevel = 'bar' | 'beat' | 'eighth' | 'sixteenth';
type ZoomLevel = 'coarse' | 'bar' | 'beat' | 'eighth' | 'sixteenth';

interface MusicalTick {
  pixel: number;         // x position
  level: TickLevel;      // hierarchy level
  label?: string;        // "5", "5.2" — only on labeled ticks
  index: number;         // 0-based global index at this level (for odd/even striping)
  //                        e.g., beat index 0,1,2,3,4,5... across all bars
}

interface MusicalTickData {
  ticks: MusicalTick[];       // visible ticks, sorted by pixel
  pixelsPerBar: number;       // constant (single tempo + meter)
  pixelsPerBeat: number;      // constant
  zoomLevel: ZoomLevel;       // finest visible level
  coarseBarStep?: number;     // at coarse zoom: show every Nth bar
}
```

### `computeMusicalTicks()`

```typescript
interface MusicalTickParams {
  timeSignature: [number, number];
  ticksPerPixel: number;        // zoom (lower = more zoomed in)
  startPixel: number;           // visible range start
  endPixel: number;             // visible range end
  ppqn?: number;                // default 960
}

function computeMusicalTicks(params: MusicalTickParams): MusicalTickData
```

No BPM. No sampleRate. Pure tick arithmetic.

**Derived constants:**

- `ticksPerBeat = ppqn × (4 / denominator)`
- `ticksPerBar = numerator × ticksPerBeat`
- `pixelsPerBeat = ticksPerBeat / ticksPerPixel`
- `pixelsPerBar = ticksPerBar / ticksPerPixel`

### Zoom Level Cascade

The grid drills into finer subdivisions as you zoom in. Each level requires ≥ 8px per unit.

| Zoom Level | Lines | Striping | Ruler Labels | Threshold |
|------------|-------|----------|--------------|-----------|
| `coarse` | Every Nth bar | None | Every Nth bar | pixelsPerBar < 8 |
| `bar` | Every bar | Odd/even bars | Bar number | pixelsPerBar ≥ 8 |
| `beat` | Every beat | Odd/even beats | Bar.beat | pixelsPerBeat ≥ 8 |
| `eighth` | Every 1/8 | Odd/even eighths | Bar.beat | pixelsPerEighth ≥ 8 |
| `sixteenth` | Every 1/16 | Odd/even sixteenths | Bar.beat | pixelsPerSixteenth ≥ 8 |

**Algorithm:** Compute pixels per unit for each level. Find the finest level with ≥ 8px. Iterate through the visible pixel range at that subdivision, emitting a `MusicalTick` per position. Higher-level ticks (bar lines at beat positions) carry their coarser level — the renderer draws stronger lines for coarser levels.

At coarse zoom, `coarseBarStep` indicates the bar skip factor (e.g., show every 4th bar).

### Location

`packages/core/src/beatsAndBars.ts` — new types and function alongside existing utilities.

---

## 3. Musical Tick Cache (`@dawcore/components`)

One-slot memoization so grid and ruler share the same `MusicalTickData` per frame.

```typescript
// packages/dawcore/src/utils/musical-tick-cache.ts

function getCachedMusicalTicks(params: MusicalTickParams): MusicalTickData
```

Cache key: `ticksPerPixel + timeSignature + startPixel + endPixel + ppqn`. Returns cached result if inputs match. Grid and ruler request the same visible range on the same frame, so one slot is sufficient.

---

## 4. `<daw-grid>` Element

New Shadow DOM element in `packages/dawcore/src/elements/daw-grid.ts`.

### Properties

```typescript
@property({ type: Number }) ticksPerPixel: number;
@property({ attribute: false }) timeSignature: [number, number];
@property({ type: Number }) ppqn: number = 960;
@property({ type: Number }) visibleStart: number;
@property({ type: Number }) visibleEnd: number;
@property({ type: Number }) length: number;   // total width in pixels
@property({ type: Number }) height: number;   // track area height
```

All set by `<daw-editor>`.

### Rendering

Chunked 1000px canvases with virtual scrolling — same pattern as `<daw-waveform>` and `<daw-ruler>`. Only visible chunks (viewport + overscan) are mounted.

Each chunk draws:

1. **Stripes** — odd/even alternating fills at the finest visible level. Colors: `--daw-grid-odd` (default `rgba(255, 255, 255, 0.03)`), `--daw-grid-even` (default `rgba(255, 255, 255, 0.06)`).
2. **Lines** — vertical, full height. Opacity varies by level: bar = strongest, beat = medium, subdivisions = lightest. Color: `--daw-grid-line-color` (default `rgba(255, 255, 255, 0.1)`).

### CSS Custom Properties

```css
--daw-grid-odd:        rgba(255, 255, 255, 0.03);
--daw-grid-even:       rgba(255, 255, 255, 0.06);
--daw-grid-line-color: rgba(255, 255, 255, 0.1);
```

Inheritable through Shadow DOM.

### Layer Order (Bottom to Top)

1. `--daw-background` (editor base)
2. `<daw-grid>` stripes + lines
3. Clip backgrounds (opaque)
4. Waveforms
5. `<daw-playhead>`
6. `<daw-selection>`

Track rows go transparent when grid is active (see Section 6).

### Redraw Triggers

| Trigger | Action |
|---------|--------|
| Scroll | Mount/unmount chunks (virtual scrolling). Already-drawn chunks kept. |
| Zoom change | Recompute `MusicalTickData`, redraw all visible chunks |
| Time signature change | Recompute + redraw |
| Resize (track height) | Redraw (canvas height changes) |

No RAF loop — the grid is static between these events.

---

## 5. `<daw-ruler>` Beats & Bars Mode

Extend the existing ruler with a beats & bars rendering branch.

### New Properties

```typescript
@property({ type: String }) scaleMode: 'temporal' | 'beats' = 'temporal';
@property({ type: Number }) ticksPerPixel: number;
@property({ attribute: false }) timeSignature: [number, number];
@property({ type: Number }) ppqn: number = 960;
```

### Rendering Branch

In `updated()`, the ruler selects its tick data source:

- **`scaleMode === 'beats'`:** Calls `getCachedMusicalTicks()` with tick params. Draws ticks from `MusicalTickData`.
- **`scaleMode === 'temporal'`:** Calls existing `computeTemporalTicks()`. No change.

Canvas chunking and virtual scrolling are unchanged — only the tick data source differs.

### Tick Drawing (Beats Mode)

Tick heights as fraction of ruler height:

| Level | Height | Labeled |
|-------|--------|---------|
| `bar` | 100% | Always (bar number or bar.beat) |
| `beat` | 50% | At beat zoom and finer |
| `eighth` | 30% | No |
| `sixteenth` | 20% | No |

Label formats by zoom level:

- Coarse: `"1"`, `"5"`, `"9"` (every Nth bar)
- Bar: `"1"`, `"2"`, `"3"` (every bar)
- Beat and finer: `"1"`, `"1.2"`, `"1.3"`, `"1.4"` (bar.beat)

### Shared Drawing Helper

A `drawRulerChunk(ctx, ticks, offset, height)` helper can serve both temporal and beats modes, reading `level` for tick height and `label` for text. This reduces code duplication.

---

## 6. Editor Wiring (`<daw-editor>`)

### New Properties

```typescript
@property({ type: String, attribute: 'scale-mode' })
scaleMode: 'temporal' | 'beats' = 'temporal';

@property({ type: Number, attribute: 'ticks-per-pixel' })
ticksPerPixel: number = 4;

@property({ type: Number }) bpm: number = 120;

@property({ attribute: false })
timeSignature: [number, number] = [4, 4];

@property({ type: Number }) ppqn: number = 960;

@property({ type: String, attribute: 'snap-to' })
snapTo: SnapTo = 'off';
```

### Property Flow

The editor passes properties to child elements:

- **`<daw-ruler>`:** `scaleMode`, `ticksPerPixel`, `timeSignature`, `ppqn`
- **`<daw-grid>`:** `ticksPerPixel`, `timeSignature`, `ppqn`, `height`, `length`, `visibleStart`, `visibleEnd`
- **`<daw-playhead>`:** `scaleMode`, `ticksPerPixel`, `bpm`, `ppqn`

### Track Row Transparency

```css
:host([scale-mode="beats"]) .track-row {
  background: transparent;
}
```

Track rows drop their opaque `--daw-track-background` when grid is active, allowing grid stripes to show through between clips. Clips retain their own opaque background.

### Timeline Width

```
temporal: duration × sampleRate / samplesPerPixel
beats:    (duration × bpm × ppqn / 60) / ticksPerPixel
```

BPM is used here to convert audio duration (seconds) to tick space.

### Playhead Positioning

```
temporal: currentTime × sampleRate / samplesPerPixel
beats:    (currentTime × bpm × ppqn / 60) / ticksPerPixel
```

The playhead animates smoothly — `currentTime` updates every RAF frame, and the tick conversion is a linear transform (single tempo).

### Seek & Selection Snap

In beats mode, pixel→seconds conversion includes an optional snap step:

1. `pixelX × ticksPerPixel` → raw tick
2. `snapTickToGrid(rawTick, snapTo, timeSignature, ppqn)` → snapped tick
3. `(snappedTick × 60) / (bpm × ppqn)` → seconds
4. Pass to engine

Snap applies to click-to-seek and selection drag. Clip move/trim snap is deferred (requires clip positioning in tick space).

### Usage

```html
<!-- Temporal mode (default, unchanged) -->
<daw-editor id="editor" samples-per-pixel="512">
  <daw-track src="/audio/drums.opus" name="Drums"></daw-track>
</daw-editor>

<!-- Beats & bars mode -->
<daw-editor id="editor" scale-mode="beats"
            ticks-per-pixel="4" bpm="120" snap-to="beat">
  <daw-grid></daw-grid>
  <daw-track src="/audio/drums.opus" name="Drums"></daw-track>
</daw-editor>
```

---

## Testing

### Unit Tests (core)

- `snapToTicks()` — all SnapTo values at 4/4 and 6/8, both 960 and 192 PPQN
- `snapTickToGrid()` — round-to-nearest behavior, `'off'` passthrough, boundary cases
- `computeMusicalTicks()` — each zoom level, visible range filtering, label formatting, coarse bar stepping

### Unit Tests (dawcore)

- `getCachedMusicalTicks()` — cache hit on same params, cache miss on changed params
- `<daw-grid>` — chunk rendering, redraw triggers, CSS custom property reading
- `<daw-ruler>` — beats mode branch selection, temporal mode unchanged
- `<daw-editor>` — property flow to children, timeline width in both modes, track row transparency

### Manual Testing

- Dev page with `scale-mode="beats"` showing grid + ruler at various zoom levels
- Verify zoom cascade: zooming in reveals beats, then eighths, then sixteenths
- Verify striping: odd/even alternation at each level
- Verify playhead tracks correctly in beats mode
- Verify seek snaps to grid when `snap-to` is set

---

## Deferred Work

- **Control elements:** `<daw-tempo>`, `<daw-time-signature>`, `<daw-snap-to>`, `<daw-scale-mode>`, `<daw-time-format>` — UI elements that set the editor properties added in this spec
- **Multi-tempo / multi-meter:** Requires tick-space waveform rendering (stretching waveforms at tempo changes). `computeMusicalTicks()` params would change from simple values to callback interfaces.
- **Engine PPQN:** Engine operations in tick space. Prerequisite for multi-tempo beats mode. Eliminates seconds conversion at editor boundary.
- **Clip move/trim snap:** Requires clip positioning in tick space. Currently clips are positioned in samples.
- **React browser package:** Port beats & bars mode to the React `SmartScale` and add a grid component.
