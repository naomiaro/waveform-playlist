# Tick-Based Scheduler Design

**Date:** 2026-03-24
**Package:** `@dawcore/transport` 0.0.3 (breaking change)
**Branch:** `feat/tick-based-scheduler`

## Problem

The transport Scheduler stores loop boundaries, the scheduling cursor (`_rightEdge`), and all comparisons in float seconds. Beat generation in MetronomePlayer converts `seconds -> ticks -> seconds`, accumulating floating-point precision errors. This causes:

1. **Metronome last-downbeat cutoff** — loop wraps ~1 beat early because float comparison drifts at the boundary.
2. **`isBarBoundary()` false negatives** — modulo on float ticks silently fails when ticks are fractionally off a beat grid position.
3. **Clip loop clamping drift** — `duration = loopEnd - clipStartTime` is pure float arithmetic, producing sub-sample gaps or overlaps.

## Solution

Refactor the Scheduler to work in integer ticks. The Clock stays in seconds (tied to `audioContext.currentTime`). The conversion seconds -> ticks happens once at the top of `advance()`. Everything downstream is integer math until the final ticks -> seconds conversion for `AudioBufferSourceNode.start()`.

ClipPlayer works in integer samples (its natural unit) rather than ticks.

## Design

### Half-Open Interval Convention

All time windows use half-open intervals: `[start, end)`. The Scheduler generates events in `[fromTick, toTick)`. Loop region is `[loopStart, loopEnd)` — the tick at `loopEnd` is never generated; playback wraps to `loopStart` before reaching it.

An 8-bar loop generates exactly 8 downbeats per cycle.

### Scheduler

Stores `_loopStart`, `_loopEnd`, and `_rightEdge` as **integer ticks**. Takes `TempoMap` as a new constructor dependency.

```typescript
interface SchedulerOptions {
  lookahead?: number;  // seconds (unchanged, default 0.2)
  onLoop?: (loopStartTimeSeconds: number) => void;  // stays in seconds for Clock.seekTo()
}

class Scheduler<T extends SchedulerEvent> {
  private _loopStart: number;    // integer ticks
  private _loopEnd: number;      // integer ticks
  private _rightEdge: number;    // integer ticks
  private _tempoMap: TempoMap;

  constructor(tempoMap: TempoMap, options?: SchedulerOptions);

  setLoop(enabled: boolean, startTick: number, endTick: number): void;
  setLoopSeconds(enabled: boolean, startSec: number, endSec: number): void;

  advance(currentTimeSeconds: number): void {
    const currentTick = this._tempoMap.secondsToTicks(currentTimeSeconds);
    const targetTick = this._tempoMap.secondsToTicks(
      currentTimeSeconds + this._lookahead  // lookahead added in seconds, then converted
    );

    // Non-loop path: generate if targetTick > _rightEdge
    // Loop path: integer comparisons
    // distToEnd = _loopEnd - _rightEdge (integer subtraction)
  }

  reset(timeSeconds: number): void {
    this._rightEdge = this._tempoMap.secondsToTicks(timeSeconds);
  }
}
```

**Loop wrap:** After wrap, `_rightEdge = _loopStart` (integer assignment). No accumulated drift across loops.

**`onLoop` callback:** The one exception to the ticks-everywhere pattern. Passes seconds to the Clock for seeking: `this._onLoop(this._tempoMap.ticksToSeconds(this._loopStart))`. The `SchedulerOptions.onLoop` signature stays `(loopStartTimeSeconds: number) => void` because the Clock operates in seconds (`Clock.seekTo()` takes seconds).

### SchedulerListener Interface

```typescript
interface SchedulerEvent {
  tick: number;  // was transportTime: number (seconds)
}

interface SchedulerListener<T extends SchedulerEvent> {
  generate(fromTick: number, toTick: number): T[];      // was (fromSeconds, toSeconds)
  consume(event: T): void;                               // unchanged signature
  onPositionJump(newTick: number): void;                 // was (newTimeSeconds)
  silence(): void;                                       // unchanged
}
```

**Breaking changes to the listener contract:**

- `generate()`: receives integer ticks instead of float seconds.
- `SchedulerEvent`: `tick: number` replaces `transportTime: number`. Each listener converts tick -> audio time internally via its existing `_toAudioTime` helper + TempoMap. The `_toAudioTime` signature stays `(transportTimeSeconds: number) => number` — callers wrap with `tempoMap.ticksToSeconds(event.tick)` before calling it.
- `onPositionJump()`: receives integer ticks instead of float seconds. Each listener converts to its native unit internally (MetronomePlayer: no-op since it works in ticks; ClipPlayer: ticks -> samples via SampleTimeline).
- `consume()` and `silence()`: unchanged.

The Scheduler stays free of audio-context concerns. Listeners own the tick -> seconds conversion for audio scheduling.

### MetronomePlayer

Receives integer ticks directly in `generate()`. No more seconds <-> ticks round-trip.

```typescript
generate(fromTick: number, toTick: number): MetronomeEvent[] {
  const entry = this._meterMap.getEntryAt(fromTick);
  const beatSize = this._meterMap.ticksPerBeat(fromTick); // integer
  const tickIntoSection = fromTick - entry.tick;           // integer
  let tick = entry.tick + Math.ceil(tickIntoSection / beatSize) * beatSize;

  const events: MetronomeEvent[] = [];
  while (tick < toTick) {  // integer comparison, half-open
    const isAccent = this._meterMap.isBarBoundary(tick); // integer modulo — exact
    events.push({ tick, isAccent, buffer: isAccent ? this._accentBuffer : this._beatBuffer });
    tick += this._meterMap.ticksPerBeat(tick);
  }
  return events;
}
```

`MetronomeEvent` stores `tick: number` instead of `transportTime: number`. `consume()` converts `tick` -> audio time internally via `this._toAudioTime(this._tempoMap.ticksToSeconds(event.tick))`.

### ClipPlayer

Works in **integer samples** as its native unit. Stores loop boundaries in samples. Has two `setLoop` methods: `setLoop(enabled, startTick, endTick)` converts ticks -> samples internally, and `setLoopSamples(enabled, startSample, endSample)` stores samples directly.

**Updated `ClipEvent` interface:**

```typescript
interface ClipEvent extends SchedulerEvent {
  tick: number;              // was transportTime (seconds) — inherited from SchedulerEvent
  offsetSamples: number;     // was offset (seconds)
  durationSamples: number;   // was duration (seconds)
  startSample: number;       // clip position on timeline (integer samples)
  // ... other clip fields (buffer, track info)
}
```

```typescript
class ClipPlayer implements SchedulerListener<ClipEvent> {
  private _loopEnabled: boolean;
  private _loopStartSamples: number;  // integer
  private _loopEndSamples: number;    // integer

  setLoopSamples(enabled: boolean, startSample: number, endSample: number): void;
  setLoop(enabled: boolean, startTick: number, endTick: number): void;

  generate(fromTick: number, toTick: number): ClipEvent[] {
    const fromSample = this._sampleTimeline.ticksToSamples(fromTick);
    const toSample = this._sampleTimeline.ticksToSamples(toTick);

    // All comparisons and clamping in integer samples
    // duration = _loopEndSamples - clip.startSample (integer subtraction)
    // Skip zero-duration events
  }

  // onPositionJump receives ticks, converts to samples for mid-clip source creation
  onPositionJump(newTick: number): void {
    const newSample = this._sampleTimeline.ticksToSamples(newTick);
    // Re-create sources for clips spanning newSample (existing logic, now in samples)
  }

  consume(event: ClipEvent): void {
    const audioTime = this._toAudioTime(this._tempoMap.ticksToSeconds(event.tick));
    const offset = event.offsetSamples / this._sampleRate;
    const duration = event.durationSamples / this._sampleRate;
    source.start(audioTime, offset, duration);
  }
}
```

### SampleTimeline

New methods for tick <-> sample conversion:

```typescript
class SampleTimeline {
  // Existing
  samplesToSeconds(samples: number): number;
  secondsToSamples(seconds: number): number;

  // New
  ticksToSamples(ticks: number): number;   // Math.round(ticksToSeconds(ticks) * sampleRate)
  samplesToTicks(samples: number): number;  // Math.round(secondsToTicks(samples / sampleRate))
}
```

Both new methods return integers via `Math.round()`. The intermediate float conversion is unavoidable (ticks -> seconds -> samples), but rounding happens once at the boundary.

### TempoMap

`secondsToTicks()` returns `Math.round()` (integer). `ticksToSeconds()` stays float for audio scheduling.

```typescript
secondsToTicks(seconds: number): number {
  // ... binary search for entry
  const ticksPerSecond = (entry.bpm / 60) * this._ppqn;
  return Math.round(entry.tick + secondsIntoSegment * ticksPerSecond);
}
```

At 960 PPQN and 120 BPM, one tick = ~0.52ms. Rounding to the nearest tick is inaudible (< 1 sample at 48kHz).

**Round-trip guarantee:** `secondsToTicks(ticksToSeconds(tick))` should equal `tick` for all practical values. At float64 precision this holds for ticks up to ~2^43, well beyond any realistic timeline. Tests should use `toBe()` (exact) instead of `toBeCloseTo()`.

### Transport API

```typescript
class Transport {
  // Primary — ticks as source of truth
  setLoop(enabled: boolean, startTick: number, endTick: number): void {
    this._scheduler.setLoop(enabled, startTick, endTick);
    this._clipPlayer.setLoop(enabled, startTick, endTick);
  }

  // Convenience
  setLoopSeconds(enabled: boolean, startSec: number, endSec: number): void {
    const startTick = this._tempoMap.secondsToTicks(startSec);
    const endTick = this._tempoMap.secondsToTicks(endSec);
    this.setLoop(enabled, startTick, endTick);
  }

  // Convenience for sample-based callers (dawcore)
  setLoopSamples(enabled: boolean, startSample: number, endSample: number): void {
    this._clipPlayer.setLoopSamples(enabled, startSample, endSample);
    const startTick = this._sampleTimeline.samplesToTicks(startSample);
    const endTick = this._sampleTimeline.samplesToTicks(endSample);
    this._scheduler.setLoop(enabled, startTick, endTick);
  }
}
```

### Conversion Flow

```
Caller (seconds / samples / ticks)
  | convert once at Transport boundary
  v
Scheduler (ticks) --- advance() ---> generate(fromTick, toTick)
  |                                        |
  |                          MetronomePlayer: pure tick math
  |                          ClipPlayer: ticks -> samples, pure sample math
  v
consume(event) -- each listener converts event.tick -> audioTime internally
  |
  v
AudioBufferSourceNode.start(audioTime, ...) <-- final seconds for Web Audio
```

Seconds -> ticks happens once (Clock -> Scheduler in `advance()`, or caller -> Transport in `setLoop()`). Ticks -> seconds happens once per listener in `consume()` for audio scheduling. Everything in between is integer math.

## Error Handling

- **Non-integer ticks:** `setLoop()` logs `console.warn` and applies `Math.round()` fallback.
- **Invalid loop:** `start >= end` logs warning, loop not set (existing behavior).
- **Tempo change while looping:** Loop boundaries are stored as ticks — tick positions don't change when tempo changes. `advance()` converts Clock seconds -> ticks on every call, so tempo changes are picked up automatically.
- **Zero-duration clips at loop edge:** `durationSamples = _loopEndSamples - clip.startSample` could be 0 — skip, don't schedule.
- **Stale `advance()` call:** `targetTick <= _rightEdge` means no generation needed (integer comparison). The guard uses `targetTick` (not `currentTick`) to match the current implementation pattern — `currentTick` could be behind `_rightEdge` while `targetTick` (with lookahead) still has valid window.

## Testing

### New Tests

1. **Scheduler tick-based loop** — `generate()` receives integer ticks, wraps exactly at `_loopEnd`, `_rightEdge` resets to exact `_loopStart` with zero drift after many iterations.
2. **Scheduler multi-wrap** — lookahead window spans multiple loop regions (short loop, long lookahead). Each wrap is exact.
3. **MetronomePlayer `isBarBoundary()` with integer ticks** — accent detection is exact at loop boundaries.
4. **MetronomePlayer 8-bar loop** — loop `[bar1Tick, bar9Tick)`, verify exactly 8 downbeats per cycle, no 9th downbeat, next cycle starts from `bar1Tick`.
5. **ClipPlayer sample-based loop clamping** — clip at loop boundary, `durationSamples` is exact integer, no zero-duration events.
6. **Transport convenience APIs** — `setLoopSeconds()` and `setLoopSamples()` round correctly and propagate to Scheduler and ClipPlayer.
7. **TempoMap `secondsToTicks()` returns integers** — round-trip test with `toBe()` instead of `toBeCloseTo()`.
8. **Tempo change mid-loop** — loop boundaries stay in ticks, conversion adapts to new tempo.
9. **SampleTimeline `ticksToSamples()` / `samplesToTicks()`** — new methods return integers, round-trip is exact.

### Updated Tests

- Scheduler tests: seconds -> ticks in assertions.
- MetronomePlayer tests: verify `tick` field instead of `transportTime`.
- ClipPlayer tests: sample-based loop boundaries.

## Scope

### In Scope

- Scheduler loop logic refactored to integer ticks
- MetronomePlayer receives ticks in `generate()`
- ClipPlayer receives ticks, works in samples internally
- TempoMap `secondsToTicks()` returns integer
- SampleTimeline new tick <-> sample methods
- Transport dual API (`setLoop`, `setLoopSeconds`, `setLoopSamples`)
- `NativePlayoutAdapter.setLoop()` updated to call `transport.setLoopSeconds()` (adapter receives seconds from engine)
- All affected tests updated

### Out of Scope

- Clock changes (stays in seconds)
- Timer changes (unchanged)
- MeterMap internal refactoring (already works in integer ticks)
- `barAtTick` float issue in MeterMap (separate concern)
- Multi-tempo runtime changes (TempoMap already supports this)
- dawcore integration (separate PR after transport 0.0.3)
