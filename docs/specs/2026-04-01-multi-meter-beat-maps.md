# Multi-Meter Beat Map Support

**Date:** 2026-04-01
**Branch:** `feat/multi-meter-beat-maps`
**Status:** Design approved

## Problem

The grid assumes a single time signature throughout. Songs with meter changes (e.g., 4/4 to 3/4 mid-song) render with wrong bar boundaries. The `.beats` file format already encodes meter information via beat numbers — it just needs to be extracted and wired through.

## Solution

Detect meter changes from beat number sequences in `.beats` files. Pass meter entries through `computeMusicalTicks` so the grid renders correct bar widths per meter region. The transport layer's `MeterMap` already supports multi-meter — this work is about wiring it to the grid and demo.

## MeterEntry Type (core)

```typescript
interface MeterEntry {
  tick: number;
  numerator: number;
  denominator: number;
}
```

Required. All callers must provide at least one entry (tick 0).

## detectMeterChanges (core, new function)

```typescript
function detectMeterChanges(
  beats: { time: number; beat: number }[],
  firstBeatTick: number,
  ppqn: number
): MeterEntry[]
```

Scans beat number sequences. When beats cycle `1->2->3->1` that's 3/4; `1->2->3->4->1` is 4/4. Returns meter entries at the correct tick positions. Always includes an entry at tick 0 (defaults to the first detected meter).

## computeMusicalTicks Changes (core)

Replace `timeSignature: [number, number]` with `meterEntries: MeterEntry[]` in `MusicalTickParams`. The function:

1. Walks the timeline in segments (one per meter entry)
2. Each segment uses that meter's `tpBar`/`tpBeat` for tick classification and step sizing
3. Bar numbers computed cumulatively (bar count carries forward across segments)
4. Labels generated inline (no `ticksToBarBeatLabel` calls)
5. Zoom level determined from `pixelsPerQuarterNote` (constant regardless of meter)

All callers updated to pass `meterEntries` instead of `timeSignature`. `ticksToBarBeatLabel` removed (labels computed inline). `snapToTicks` and `snapTickToGrid` updated to take `meterEntries` — use the meter at the snap position.

### MusicalTickData Changes

```typescript
interface MusicalTickData {
  ticks: MusicalTick[];
  pixelsPerQuarterNote: number;  // renamed from pixelsPerBeat
  zoomLevel: ZoomLevel;
  coarseBarStep?: number;
}
```

`pixelsPerBar` removed — varies with meter, no single value is meaningful. Zoom thresholds use `pixelsPerQuarterNote` instead.

## daw-grid.ts

Gains a `meterEntries` property (JS property, not attribute). Passes it to `computeMusicalTicks`.

## beat-map-grid.html Demo

`buildTempoCurve` calls `detectMeterChanges`, applies entries via `transport.setMeter(num, denom, atTick)`, passes entries to the editor for grid rendering.

## What Doesn't Change

- `MeterMap` in transport — already supports multi-meter
- `NativePlayoutAdapter.setMeter` — already implemented

## What Gets Removed

- `ticksToBarBeatLabel` — replaced by inline label computation in `computeMusicalTicks`
- `timeSignature` param on `MusicalTickParams` — replaced by `meterEntries`
- `pixelsPerBar` and `pixelsPerBeat` on `MusicalTickData` — replaced by `pixelsPerQuarterNote`

## Testing

- Unit tests for `detectMeterChanges` (4/4 only, 3/4 only, mixed meters, pickup beats)
- Unit tests for `computeMusicalTicks` with variable meter (bar numbering across meter changes, tick classification, label generation)
- Update existing `computeMusicalTicks` tests to use `meterEntries`

## Scope

In scope: meter detection, grid rendering, demo wiring.
Out of scope: snap-to-grid with variable meter (uses local time signature, already works), ruler labels (computed by `computeMusicalTicks`).
