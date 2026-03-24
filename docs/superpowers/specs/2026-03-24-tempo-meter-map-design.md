# Tempo & Meter Map Design

**Date:** 2026-03-24
**Status:** Approved
**Branch:** `feat/metronome-demo`

## Problem

The transport package has no way to schedule tempo or time signature changes at specific positions. `Transport.setTempo(bpm)` only changes at tick 0. `MetronomePlayer` uses a single `beatsPerBar` value. This prevents use cases like a song that goes 4/4 for the verse then 7/8 for the bridge.

## Solution

1. Expose `TempoMap.setTempo(bpm, atTick)` through the Transport API
2. New `MeterMap` class — parallel to `TempoMap` — storing time signature changes at tick positions
3. Update `MetronomePlayer` to query `MeterMap` per beat instead of using a single `beatsPerBar`

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Position system | Tick-based (absolute PPQN) | Mirrors TempoMap, O(log n) binary search, no circular dependency |
| Storage | Absolute tick + cached bar count | Same pattern as TempoMap's `secondsAtTick` cache |
| Meter format | Numerator + denominator | 6/8 and 3/4 have different accent groupings; denominator determines beat unit |
| Separate vs combined | Separate `MeterMap` class | Tempo and meter are independent concerns; clean separation |
| Insert behavior | Insert/replace at tick, don't clear subsequent | Matches TempoMap behavior, non-destructive |

## MeterMap

New class: `packages/transport/src/timeline/meter-map.ts`

### Entry Structure

```typescript
interface MeterEntry {
  /** Tick position where this meter starts */
  tick: number;
  /** Time signature numerator (e.g., 6 in 6/8) */
  numerator: number;
  /** Time signature denominator (e.g., 8 in 6/8) */
  denominator: number;
  /** Cached cumulative bar count from tick 0 to this entry */
  readonly barAtTick: number;
}
```

### Beat Unit Derivation

The denominator determines the beat unit in PPQN:

```
ticksPerBeat = ppqn * (4 / denominator)
```

Examples at 960 PPQN:
- 4/4: ticksPerBeat = 960 (quarter note), ticksPerBar = 3840
- 3/4: ticksPerBeat = 960 (quarter note), ticksPerBar = 2880
- 6/8: ticksPerBeat = 480 (eighth note), ticksPerBar = 2880
- 7/8: ticksPerBeat = 480 (eighth note), ticksPerBar = 3360
- 5/4: ticksPerBeat = 960 (quarter note), ticksPerBar = 4800

### Methods

```typescript
class MeterMap {
  constructor(ppqn: number, numerator?: number, denominator?: number)

  /** Insert or replace a meter change at the given tick position */
  setMeter(numerator: number, denominator: number, atTick?: number): void

  /** Get the active meter at a tick position */
  getMeter(atTick?: number): MeterSignature

  /** Remove a meter change (not allowed at tick 0) */
  removeMeter(atTick: number): void

  /** Reset to a single entry at tick 0 */
  clearMeters(): void

  /** Ticks per bar at the given tick position */
  ticksPerBar(atTick?: number): number

  /** Ticks per beat at the given tick position */
  ticksPerBeat(atTick?: number): number

  /** Convert 1-indexed bar number to absolute tick position */
  barToTick(bar: number): number

  /** Get bar number (1-indexed) at a tick position */
  tickToBar(tick: number): number

  /** Is this tick exactly on a bar boundary? */
  isBarBoundary(tick: number): boolean
}
```

### Cache

`barAtTick` is a cached cumulative bar count computed from preceding entries. Recomputed via `_recomputeCache(fromIndex)` when entries are inserted or modified — same pattern as `TempoMap.secondsAtTick`.

```
tpb = entries[i-1].numerator * ppqn * (4 / entries[i-1].denominator)
barAtTick[i] = barAtTick[i-1] + (tick[i] - tick[i-1]) / tpb
```

### Bar boundary constraint

`setMeter(n, d, atTick)` requires `atTick` to fall on a bar boundary of the preceding meter. If it doesn't, the tick is snapped forward to the next bar boundary and a warning is logged. This ensures `barAtTick` is always an integer — fractional bars would break `barToTick`/`tickToBar` and accent detection.

### barToTick algorithm

Walk entries to find which segment contains the target bar, then compute the tick offset within that segment:

```
barToTick(bar):  // bar is 1-indexed
  targetBar = bar - 1  // convert to 0-indexed
  for each entry[i]:
    nextBar = (i < last) ? entries[i+1].barAtTick : Infinity
    if targetBar < nextBar:
      barsIntoSegment = targetBar - entries[i].barAtTick
      tpb = entries[i].numerator * ppqn * (4 / entries[i].denominator)
      return entries[i].tick + barsIntoSegment * tpb
  // beyond last entry
  barsIntoSegment = targetBar - lastEntry.barAtTick
  tpb = lastEntry.numerator * ppqn * (4 / lastEntry.denominator)
  return lastEntry.tick + barsIntoSegment * tpb
```

### Validation

- `numerator` must be a positive integer (1-32)
- `denominator` must be a power of 2 (1, 2, 4, 8, 16, 32)
- `removeMeter(0)` throws — tick 0 entry is permanent
- `atTick` must be non-negative
- `atTick` must be on a bar boundary of the preceding meter (snapped if not)
- `removeMeter` during playback: recomputes cache immediately; already-scheduled beats in the lookahead window are not affected (they play out, next window uses updated map)

## MetronomePlayer Changes

Currently:
- Single `_beatsPerBar` field
- `generate()` steps by `ppqn` (quarter notes)
- Accent detection: `tick % ticksPerBar === 0`

Updated:
- Remove `_beatsPerBar` field
- Accept `MeterMap` in constructor (replace `TickTimeline` dependency for bar info)
- `MeterMap` exposes `ppqn` getter so MetronomePlayer can read it (replaces `TickTimeline.ppqn`)
- `generate()` steps by `meterMap.ticksPerBeat(tick)` — varies per meter region
- Accent detection: `meterMap.isBarBoundary(tick)`
- Beat step size changes at meter boundaries within the scheduling window

### Updated generate() pseudocode

Beat grid alignment must be anchored to the active meter entry's start tick, not tick 0. When the loop crosses a meter boundary, re-snap to the new section's beat grid.

```
generate(fromTime, toTime):
  fromTicks = tempoMap.secondsToTicks(fromTime)
  toTicks = tempoMap.secondsToTicks(toTime)

  // Snap to first beat: align to beat grid anchored at the active meter entry
  entry = meterMap.getEntryAt(fromTicks)  // internal: returns the MeterEntry
  beatSize = meterMap.ticksPerBeat(fromTicks)
  tickIntoSection = fromTicks - entry.tick
  tick = entry.tick + ceil(tickIntoSection / beatSize) * beatSize

  while tick < toTicks:
    // Re-snap at meter boundaries
    currentEntry = meterMap.getEntryAt(tick)
    if currentEntry.tick != entry.tick:
      entry = currentEntry
      beatSize = meterMap.ticksPerBeat(tick)
      // tick is already at the meter boundary (bar boundary constraint ensures this)

    isAccent = meterMap.isBarBoundary(tick)
    transportTime = tempoMap.ticksToSeconds(tick)

    emit event { transportTime, isAccent, buffer }

    beatSize = meterMap.ticksPerBeat(tick)  // re-read in case next tick crosses boundary
    tick += beatSize
```

### Seek and loop wrap

Meter queries are stateless — `generate()` reads `MeterMap` per tick with no internal state. Seek and loop wrap require no special handling beyond what `onPositionJump` already does (calls `silence()`). The next `generate()` call queries the correct meter at the new position automatically.

## Transport API Changes

### New methods

```typescript
// Tempo — expose atTick parameter (was internal-only)
setTempo(bpm: number, atTick?: number): void
getTempo(atTick?: number): number

// Meter
setMeter(numerator: number, denominator: number, atTick?: number): void
getMeter(atTick?: number): MeterSignature
removeMeter(atTick: number): void

// Convenience
barToTick(bar: number): number
```

### Deprecated

`setBeatsPerBar(beats: number)` — replaced by `setMeter(beats, 4)`. Keep as a wrapper for backwards compatibility in 0.0.x.

### TransportOptions changes

```typescript
interface TransportOptions {
  sampleRate?: number;
  ppqn?: number;
  tempo?: number;
  schedulerLookahead?: number;
  // Remove: beatsPerBar?: number;
  // Add:
  /** Time signature numerator. Default: 4 */
  numerator?: number;
  /** Time signature denominator. Default: 4 */
  denominator?: number;
}
```

## Types (in types.ts)

```typescript
/** Public return type for getMeter() */
interface MeterSignature {
  numerator: number;
  denominator: number;
}

/** Storage entry for MeterMap */
interface MeterEntry {
  tick: number;
  numerator: number;
  denominator: number;
  readonly barAtTick: number;
}
```

`_validateOptions` in Transport must be updated to validate `numerator` (positive integer 1-32) and `denominator` (power of 2) instead of `beatsPerBar`.

## What Doesn't Change

- `TempoMap` — untouched internally, just expose `atTick` through Transport
- `Clock`, `Scheduler`, `Timer` — no changes
- `SampleTimeline` — no changes
- `ClipPlayer` — clips are sample-based, not meter-aware
- `TrackNode`, `MasterNode` — no changes
- `NativePlayoutAdapter` — no changes; meter accessed via `adapter.transport`

## Testing Strategy

- **MeterMap** — pure math, extensive unit tests: single meter, multiple meters, bar/tick conversion, cache invalidation, denominator variations (4/4, 6/8, 7/8, 5/4), edge cases (tick 0 removal, overlapping entries)
- **MetronomePlayer** — verify accent pattern changes at meter boundaries, correct beat step size per meter region
- **Transport** — integration: setMeter during playback, barToTick accuracy, backwards compatibility of setBeatsPerBar

## Reference

- **openDAW** — `SignatureTrackAdapter` with per-bar meter events, `accumulatedPpqn`/`accumulatedBars` caching, metronome queries meter per beat during generate
- **Tone.js** — single `timeSignature` property (not scheduled), normalized to scalar. No meter map.
