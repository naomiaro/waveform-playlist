# Tick-Based Scheduler Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor `@dawcore/transport` Scheduler from float seconds to integer ticks, fixing loop boundary precision drift.

**Architecture:** Scheduler stores loop bounds and `_rightEdge` as integer ticks. Clock stays in seconds. TempoMap converts at boundaries. MetronomePlayer receives ticks; ClipPlayer converts ticks to samples. Each player converts tick→seconds for audio scheduling internally.

**Tech Stack:** TypeScript, vitest, tsup

**Spec:** `docs/superpowers/specs/2026-03-24-tick-based-scheduler-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/transport/src/types.ts` | Modify | `SchedulerEvent.tick` replaces `.transportTime` |
| `packages/transport/src/core/scheduler.ts` | Modify | Tick-based loop logic, TempoMap dependency |
| `packages/transport/src/timeline/tempo-map.ts` | Modify | `secondsToTicks()` returns `Math.round()` |
| `packages/transport/src/timeline/sample-timeline.ts` | Modify | Add `ticksToSamples()`, `samplesToTicks()` |
| `packages/transport/src/audio/metronome-player.ts` | Modify | `generate(fromTick, toTick)`, tick-based events |
| `packages/transport/src/audio/clip-player.ts` | Modify | `generate(fromTick, toTick)`, sample-based loop clamping |
| `packages/transport/src/transport.ts` | Modify | `setLoop` → ticks primary, add `setLoopSeconds`/`setLoopSamples`, update play/stop/seek |
| `packages/transport/src/adapter.ts` | Modify | `setLoop` calls `transport.setLoopSeconds()` |
| `packages/transport/src/__tests__/tempo-map.test.ts` | Modify | `toBeCloseTo` → `toBe` for round-trips |
| `packages/transport/src/__tests__/sample-timeline.test.ts` | Modify | Add tick conversion tests |
| `packages/transport/src/__tests__/scheduler.test.ts` | Rewrite | Tick-based mock listener, TempoMap in constructor |
| `packages/transport/src/__tests__/metronome-player.test.ts` | Modify | `generate()` takes ticks, events have `.tick` |
| `packages/transport/src/__tests__/clip-player.test.ts` | Modify | `generate()` takes ticks, `onPositionJump` takes ticks, sample-based loop |

---

### Task 1: TempoMap — `secondsToTicks()` returns integer

**Files:**
- Modify: `packages/transport/src/timeline/tempo-map.ts:62`
- Test: `packages/transport/src/__tests__/tempo-map.test.ts`

- [ ] **Step 1: Update round-trip test to expect exact integers**

In `packages/transport/src/__tests__/tempo-map.test.ts`, change line 22:

```typescript
// Before:
expect(tm.secondsToTicks(tm.ticksToSeconds(ticks))).toBeCloseTo(ticks);

// After:
expect(tm.secondsToTicks(tm.ticksToSeconds(ticks))).toBe(ticks);
```

Also update line 15-16 (single tempo secondsToTicks):

```typescript
// Before:
expect(tm.secondsToTicks(0.5)).toBeCloseTo(960);
expect(tm.secondsToTicks(1.0)).toBeCloseTo(1920);

// After:
expect(tm.secondsToTicks(0.5)).toBe(960);
expect(tm.secondsToTicks(1.0)).toBe(1920);
```

And lines 50-51 (multi-tempo secondsToTicks):

```typescript
// Before:
expect(tm.secondsToTicks(1.0)).toBeCloseTo(1920);
expect(tm.secondsToTicks(2.0)).toBeCloseTo(2880);

// After:
expect(tm.secondsToTicks(1.0)).toBe(1920);
expect(tm.secondsToTicks(2.0)).toBe(2880);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/transport && npx vitest run src/__tests__/tempo-map.test.ts`
Expected: FAIL — `secondsToTicks` returns float, not exact integer

- [ ] **Step 3: Add `Math.round()` to `secondsToTicks()`**

In `packages/transport/src/timeline/tempo-map.ts`, change line 62:

```typescript
// Before:
return entry.tick + secondsIntoSegment * ticksPerSecond;

// After:
return Math.round(entry.tick + secondsIntoSegment * ticksPerSecond);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/transport && npx vitest run src/__tests__/tempo-map.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/transport/src/timeline/tempo-map.ts packages/transport/src/__tests__/tempo-map.test.ts
git commit -m "feat(transport): secondsToTicks returns Math.round integer"
```

---

### Task 2: SampleTimeline — add tick conversion methods

**Files:**
- Modify: `packages/transport/src/timeline/sample-timeline.ts`
- Test: `packages/transport/src/__tests__/sample-timeline.test.ts`

- [ ] **Step 1: Write failing tests for new methods**

Add to `packages/transport/src/__tests__/sample-timeline.test.ts`:

```typescript
import { TempoMap } from '../timeline/tempo-map';

describe('SampleTimeline tick conversions', () => {
  it('ticksToSamples converts via seconds', () => {
    const tempoMap = new TempoMap(960, 120);
    const st = new SampleTimeline(48000);
    st.setTempoMap(tempoMap);
    // 960 ticks = 0.5s at 120 BPM = 24000 samples at 48kHz
    expect(st.ticksToSamples(960)).toBe(24000);
    expect(st.ticksToSamples(1920)).toBe(48000);
    expect(st.ticksToSamples(0)).toBe(0);
  });

  it('samplesToTicks converts via seconds', () => {
    const tempoMap = new TempoMap(960, 120);
    const st = new SampleTimeline(48000);
    st.setTempoMap(tempoMap);
    expect(st.samplesToTicks(24000)).toBe(960);
    expect(st.samplesToTicks(48000)).toBe(1920);
    expect(st.samplesToTicks(0)).toBe(0);
  });

  it('tick-sample round-trip is exact', () => {
    const tempoMap = new TempoMap(960, 120);
    const st = new SampleTimeline(48000);
    st.setTempoMap(tempoMap);
    const ticks = 4800;
    expect(st.samplesToTicks(st.ticksToSamples(ticks))).toBe(ticks);
  });

  it('ticksToSamples throws if no tempoMap set', () => {
    const st = new SampleTimeline(48000);
    expect(() => st.ticksToSamples(960)).toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/transport && npx vitest run src/__tests__/sample-timeline.test.ts`
Expected: FAIL — `setTempoMap`, `ticksToSamples`, `samplesToTicks` don't exist

- [ ] **Step 3: Implement tick conversion methods**

Replace `packages/transport/src/timeline/sample-timeline.ts` with:

```typescript
import type { TempoMap } from './tempo-map';

export class SampleTimeline {
  private _sampleRate: number;
  private _tempoMap: TempoMap | null = null;

  constructor(sampleRate: number) {
    this._sampleRate = sampleRate;
  }

  get sampleRate(): number {
    return this._sampleRate;
  }

  setTempoMap(tempoMap: TempoMap): void {
    this._tempoMap = tempoMap;
  }

  samplesToSeconds(samples: number): number {
    return samples / this._sampleRate;
  }

  secondsToSamples(seconds: number): number {
    return Math.round(seconds * this._sampleRate);
  }

  ticksToSamples(ticks: number): number {
    if (!this._tempoMap) {
      throw new Error('[waveform-playlist] SampleTimeline: tempoMap not set — call setTempoMap() first');
    }
    return Math.round(this._tempoMap.ticksToSeconds(ticks) * this._sampleRate);
  }

  samplesToTicks(samples: number): number {
    if (!this._tempoMap) {
      throw new Error('[waveform-playlist] SampleTimeline: tempoMap not set — call setTempoMap() first');
    }
    return this._tempoMap.secondsToTicks(samples / this._sampleRate);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/transport && npx vitest run src/__tests__/sample-timeline.test.ts`
Expected: PASS (all existing + new tests)

- [ ] **Step 5: Commit**

```bash
git add packages/transport/src/timeline/sample-timeline.ts packages/transport/src/__tests__/sample-timeline.test.ts
git commit -m "feat(transport): SampleTimeline tick-sample conversions via TempoMap"
```

---

### Task 3: SchedulerEvent and SchedulerListener — tick-based interface

**Files:**
- Modify: `packages/transport/src/types.ts:1-15`

- [ ] **Step 1: Update types**

In `packages/transport/src/types.ts`, replace lines 1-15:

```typescript
export interface SchedulerEvent {
  /** Tick position (integer) on the timeline */
  tick: number;
}

export interface SchedulerListener<T extends SchedulerEvent> {
  /** Generate events in the tick window [fromTick, toTick) */
  generate(fromTick: number, toTick: number): T[];
  /** Realize an event (create audio nodes, start sources) */
  consume(event: T): void;
  /** Position jumped (loop/seek) — stop active sources, re-schedule */
  onPositionJump(newTick: number): void;
  /** Stop all active audio immediately */
  silence(): void;
}
```

- [ ] **Step 2: Run typecheck to see what breaks**

Run: `cd packages/transport && pnpm typecheck`
Expected: FAIL — all references to `transportTime` are now errors. This is expected; we fix them in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
git add packages/transport/src/types.ts
git commit -m "feat(transport): SchedulerEvent.tick replaces transportTime, generate takes ticks"
```

---

### Task 4: Scheduler — tick-based loop logic with TempoMap

**Files:**
- Modify: `packages/transport/src/core/scheduler.ts`
- Test: `packages/transport/src/__tests__/scheduler.test.ts`

- [ ] **Step 1: Rewrite scheduler tests for tick-based API**

Replace `packages/transport/src/__tests__/scheduler.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { Scheduler } from '../core/scheduler';
import { TempoMap } from '../timeline/tempo-map';
import type { SchedulerEvent, SchedulerListener } from '../types';

interface TestEvent extends SchedulerEvent {
  id: string;
}

function createMockListener(): SchedulerListener<TestEvent> & {
  generated: TestEvent[];
  consumed: TestEvent[];
  jumpedTo: number[];
  silenced: number;
  generateRanges: Array<[number, number]>;
} {
  const state = {
    generated: [] as TestEvent[],
    consumed: [] as TestEvent[],
    jumpedTo: [] as number[],
    silenced: 0,
    generateRanges: [] as Array<[number, number]>,
  };
  return {
    ...state,
    generate(fromTick, toTick) {
      state.generateRanges.push([fromTick, toTick]);
      const events: TestEvent[] = [];
      // Generate an event every 480 ticks (eighth note at 960 ppqn)
      const step = 480;
      const start = Math.ceil(fromTick / step) * step;
      for (let t = start; t < toTick; t += step) {
        const event = { tick: t, id: 'e-' + t };
        events.push(event);
        state.generated.push(event);
      }
      return events;
    },
    consume(event) {
      state.consumed.push(event);
    },
    onPositionJump(newTick) {
      state.jumpedTo.push(newTick);
    },
    silence() {
      state.silenced++;
    },
  };
}

describe('Scheduler (tick-based)', () => {
  // 120 BPM, 960 PPQN: 1 beat = 960 ticks = 0.5s
  // Lookahead 0.2s = 384 ticks
  const ppqn = 960;
  const bpm = 120;

  function createScheduler(lookahead = 0.2, onLoop?: (t: number) => void) {
    const tempoMap = new TempoMap(ppqn, bpm);
    return new Scheduler<TestEvent>(tempoMap, { lookahead, onLoop });
  }

  it('advance generates and consumes events in lookahead window', () => {
    const scheduler = createScheduler(0.2);
    const listener = createMockListener();
    scheduler.addListener(listener);

    // advance(0) → window [0, 384) ticks
    scheduler.advance(0);
    // Events at tick 0 only (480 > 384, so no second event)
    expect(listener.consumed.length).toBe(1);
    expect(listener.consumed[0].tick).toBe(0);
  });

  it('advance does not re-generate consumed window', () => {
    const scheduler = createScheduler(0.2);
    const listener = createMockListener();
    scheduler.addListener(listener);

    scheduler.advance(0);
    const count1 = listener.consumed.length;
    scheduler.advance(0.05); // still mostly within first window
    expect(listener.consumed.length).toBeGreaterThanOrEqual(count1);
  });

  it('loop: wraps at loopEnd and generates from loopStart', () => {
    const loopCalls: number[] = [];
    const scheduler = createScheduler(0.3, (t) => loopCalls.push(t));
    const listener = createMockListener();
    scheduler.addListener(listener);

    // Loop region: [0, 960) ticks = [0, 0.5s)
    scheduler.setLoop(true, 0, 960);

    // advance(0.35) → targetTick = tempoMap.secondsToTicks(0.55) = 1056
    // rightEdge=0, loopEnd=960: generates [0, 960), wraps to 0, generates [0, 96)
    scheduler.advance(0.35);
    expect(listener.jumpedTo.length).toBe(1);
    expect(listener.jumpedTo[0]).toBe(0); // loopStart in ticks
    // onLoop callback receives seconds for Clock.seekTo
    expect(loopCalls.length).toBe(1);
    expect(loopCalls[0]).toBeCloseTo(0); // 0 ticks = 0 seconds
  });

  it('loop: _rightEdge is exact integer after wrap (no drift)', () => {
    const scheduler = createScheduler(0.2);
    const listener = createMockListener();
    scheduler.addListener(listener);

    // Short loop: [0, 480) ticks = [0, 0.25s)
    scheduler.setLoop(true, 0, 480);

    // Run many iterations to accumulate would-be drift
    for (let i = 0; i < 100; i++) {
      scheduler.advance(i * 0.01);
    }

    // All generate ranges should start at exact tick boundaries
    for (const [from] of listener.generateRanges) {
      expect(Number.isInteger(from)).toBe(true);
    }
  });

  it('loop: multi-wrap when lookahead spans multiple loop regions', () => {
    const scheduler = createScheduler(0.5); // 0.5s lookahead
    const listener = createMockListener();
    scheduler.addListener(listener);

    // Tiny loop: [0, 480) ticks = [0, 0.25s) — lookahead is 2x the loop
    scheduler.setLoop(true, 0, 480);

    scheduler.advance(0);
    // Should wrap at least twice: [0, 480), jump, [0, 480), jump, [0, remainder)
    expect(listener.jumpedTo.length).toBeGreaterThanOrEqual(2);
  });

  it('setLoop rejects start >= end', () => {
    const scheduler = createScheduler();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    scheduler.setLoop(true, 960, 480);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('setLoopSeconds converts seconds to ticks', () => {
    const scheduler = createScheduler(0.3);
    const listener = createMockListener();
    scheduler.addListener(listener);

    // 0.5s = 960 ticks at 120 BPM
    scheduler.setLoopSeconds(true, 0, 0.5);
    scheduler.advance(0.35);
    expect(listener.jumpedTo.length).toBe(1);
    expect(listener.jumpedTo[0]).toBe(0);
  });

  it('removeListener stops generating for that listener', () => {
    const scheduler = createScheduler();
    const listener = createMockListener();
    scheduler.addListener(listener);
    scheduler.removeListener(listener);

    scheduler.advance(0);
    expect(listener.consumed.length).toBe(0);
  });

  it('reset clears rightEdge', () => {
    const scheduler = createScheduler();
    const listener = createMockListener();
    scheduler.addListener(listener);

    scheduler.advance(1.0);
    const count1 = listener.consumed.length;
    scheduler.reset(0);
    scheduler.advance(0);
    expect(listener.consumed.length).toBeGreaterThan(count1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/transport && npx vitest run src/__tests__/scheduler.test.ts`
Expected: FAIL — Scheduler constructor doesn't accept TempoMap, no `setLoopSeconds`

- [ ] **Step 3: Rewrite Scheduler to work in ticks**

Replace `packages/transport/src/core/scheduler.ts`:

```typescript
import type { SchedulerEvent, SchedulerListener } from '../types';
import type { TempoMap } from '../timeline/tempo-map';

export interface SchedulerOptions {
  lookahead?: number;
  /** Called when the scheduler wraps at loopEnd — receives loopStart in seconds for Clock.seekTo */
  onLoop?: (loopStartTimeSeconds: number) => void;
}

export class Scheduler<T extends SchedulerEvent> {
  private _lookahead: number;
  private _rightEdge = 0; // integer ticks
  private _listeners: Set<SchedulerListener<T>> = new Set();
  private _loopEnabled = false;
  private _loopStart = 0; // integer ticks
  private _loopEnd = 0; // integer ticks
  private _onLoop: ((loopStartTimeSeconds: number) => void) | undefined;
  private _tempoMap: TempoMap;

  constructor(tempoMap: TempoMap, options: SchedulerOptions = {}) {
    this._tempoMap = tempoMap;
    this._lookahead = options.lookahead ?? 0.2;
    this._onLoop = options.onLoop;
  }

  addListener(listener: SchedulerListener<T>): void {
    this._listeners.add(listener);
  }

  removeListener(listener: SchedulerListener<T>): void {
    this._listeners.delete(listener);
  }

  /** Primary API — ticks as source of truth */
  setLoop(enabled: boolean, startTick: number, endTick: number): void {
    if (enabled && startTick >= endTick) {
      console.warn(
        '[waveform-playlist] Scheduler.setLoop: startTick (' +
          startTick +
          ') must be less than endTick (' +
          endTick +
          ')'
      );
      return;
    }
    this._loopEnabled = enabled;
    this._loopStart = Math.round(startTick);
    this._loopEnd = Math.round(endTick);
  }

  /** Convenience — converts seconds to ticks via TempoMap */
  setLoopSeconds(enabled: boolean, startSec: number, endSec: number): void {
    const startTick = this._tempoMap.secondsToTicks(startSec);
    const endTick = this._tempoMap.secondsToTicks(endSec);
    this.setLoop(enabled, startTick, endTick);
  }

  /** Reset scheduling cursor. Takes seconds (from Clock), converts to ticks. */
  reset(timeSeconds: number): void {
    this._rightEdge = this._tempoMap.secondsToTicks(timeSeconds);
  }

  /** Advance the scheduling window. Takes seconds (from Clock), converts to ticks. */
  advance(currentTimeSeconds: number): void {
    const currentTick = this._tempoMap.secondsToTicks(currentTimeSeconds);
    const targetTick = this._tempoMap.secondsToTicks(
      currentTimeSeconds + this._lookahead
    );

    if (this._loopEnabled && this._loopEnd > this._loopStart) {
      const loopDuration = this._loopEnd - this._loopStart;
      let remaining = targetTick - this._rightEdge;

      while (remaining > 0) {
        const distToEnd = this._loopEnd - this._rightEdge;
        if (distToEnd <= 0 || distToEnd > remaining) {
          this._generateAndConsume(this._rightEdge, this._rightEdge + remaining);
          this._rightEdge += remaining;
          break;
        }
        // Generate up to loopEnd
        this._generateAndConsume(this._rightEdge, this._loopEnd);
        remaining -= distToEnd;
        // Notify listeners of position jump (in ticks)
        for (const listener of this._listeners) {
          listener.onPositionJump(this._loopStart);
        }
        // Seek clock back to loopStart (in seconds)
        this._onLoop?.(this._tempoMap.ticksToSeconds(this._loopStart));
        this._rightEdge = this._loopStart;

        // Guard against infinite loop
        if (loopDuration <= 0) break;
      }
      return;
    }

    if (targetTick > this._rightEdge) {
      this._generateAndConsume(this._rightEdge, targetTick);
      this._rightEdge = targetTick;
    }
  }

  private _generateAndConsume(fromTick: number, toTick: number): void {
    for (const listener of this._listeners) {
      try {
        const events = listener.generate(fromTick, toTick);
        for (const event of events) {
          try {
            listener.consume(event);
          } catch (err) {
            console.warn('[waveform-playlist] Scheduler: error consuming event:', String(err));
          }
        }
      } catch (err) {
        console.warn('[waveform-playlist] Scheduler: error generating events:', String(err));
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/transport && npx vitest run src/__tests__/scheduler.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/transport/src/core/scheduler.ts packages/transport/src/__tests__/scheduler.test.ts
git commit -m "feat(transport): Scheduler works in integer ticks with TempoMap"
```

---

### Task 5: MetronomePlayer — tick-based generate and consume

**Files:**
- Modify: `packages/transport/src/audio/metronome-player.ts`
- Test: `packages/transport/src/__tests__/metronome-player.test.ts`

- [ ] **Step 1: Update tests for tick-based API**

In `packages/transport/src/__tests__/metronome-player.test.ts`, update all `generate()` calls and assertions:

**Test "generate produces beat events at correct times" (line 47-59):**

```typescript
  it('generate produces beat events at correct tick positions', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // At 120 BPM, 960 PPQN: beats at tick 0, 960, 1920, 2880...
    // Window [0, 2112) ticks — covers 0, 0.5s, 1.0s + a bit
    const events = player.generate(0, 2112);
    expect(events.length).toBe(3);
    expect(events[0].tick).toBe(0);
    expect(events[1].tick).toBe(960);
    expect(events[2].tick).toBe(1920);
  });
```

**Test "accent on beat 1 of each bar" (line 61-77):**

```typescript
  it('accent on beat 1 of each bar', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);

    const accent = createMockBuffer();
    const normal = createMockBuffer();
    player.setClickSounds(accent, normal);

    // At 120 BPM, 4/4, bar = 3840 ticks. Window covers 2+ bars.
    const events = player.generate(0, 4032);
    // Beats: 0(accent), 960, 1920, 2880, 3840(accent)
    expect(events[0].isAccent).toBe(true);
    expect(events[1].isAccent).toBe(false);
    expect(events[2].isAccent).toBe(false);
    expect(events[3].isAccent).toBe(false);
    expect(events[4].isAccent).toBe(true);
  });
```

**Test "setEnabled(false) produces no events" (line 79-86):**

```typescript
  it('setEnabled(false) produces no events', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(false);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 3840);
    expect(events.length).toBe(0);
  });
```

**Test "consume creates and starts a source" (line 88-99):**

```typescript
  it('consume creates and starts a source', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 384);
    expect(events.length).toBe(1);
    player.consume(events[0]);

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.start).toHaveBeenCalledTimes(1);
  });
```

**Test "silence stops active sources" (line 101-112):**

```typescript
  it('silence stops active sources', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 384);
    player.consume(events[0]);
    player.silence();

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });
```

**Test "onPositionJump clears active sources" (line 114-125):**

```typescript
  it('onPositionJump clears active sources', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    const events = player.generate(0, 384);
    player.consume(events[0]);
    player.onPositionJump(1920); // tick, not seconds

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
  });
```

**Test "generates beats using MeterMap beat size (6/8)" (line 127-139):**

```typescript
  it('generates beats using MeterMap beat size (6/8 = eighth notes)', () => {
    const sixEightMap = new MeterMap(960, 6, 8);
    const player = new MetronomePlayer(ctx, tempoMap, sixEightMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // At 120 BPM, 6/8: beat = 480 ticks (eighth note). Window [0, 1152) ticks.
    const events = player.generate(0, 1152);
    expect(events.length).toBe(3);
    expect(events[0].tick).toBe(0);
    expect(events[1].tick).toBe(480);
    expect(events[2].tick).toBe(960);
  });
```

**Test "accents on bar boundaries with mixed meters" (line 141-157):**

```typescript
  it('accents on bar boundaries with mixed meters', () => {
    const mixedMap = new MeterMap(960);
    mixedMap.setMeter(3, 4, 3840); // switch to 3/4 at bar 2
    const player = new MetronomePlayer(ctx, tempoMap, mixedMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // Bar 1 (4/4): ticks 0, 960, 1920, 2880 — accent at 0
    // Bar 2 (3/4): ticks 3840, 4800, 5760 — accent at 3840
    const events = player.generate(0, 5952);
    expect(events[0].isAccent).toBe(true);
    expect(events[1].isAccent).toBe(false);
    expect(events[4].isAccent).toBe(true);
    expect(events[5].isAccent).toBe(false);
    expect(events[6].isAccent).toBe(false);
  });
```

**Test "beat step size changes at meter boundary" (line 159-178):**

```typescript
  it('beat step size changes at meter boundary within scheduling window', () => {
    const mixedMap = new MeterMap(960);
    mixedMap.setMeter(6, 8, 3840); // switch to 6/8 at bar 2
    const player = new MetronomePlayer(ctx, tempoMap, mixedMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // Bar 1 (4/4): quarter beats (960 ticks apart)
    // Bar 2 (6/8): eighth beats (480 ticks apart)
    const events = player.generate(0, 6720);

    // Bar 1: 0, 960, 1920, 2880
    expect(events[0].tick).toBe(0);
    expect(events[1].tick).toBe(960);
    expect(events[3].tick).toBe(2880);

    // Bar 2: 3840, 4320, 4800, 5280, 5760, 6240
    expect(events[4].tick).toBe(3840);
    expect(events[5].tick).toBe(4320);
    expect(events[6].tick).toBe(4800);
  });
```

**Test "generate with mid-beat fromTick snaps to next beat" (line 180-191):**

```typescript
  it('generate with mid-beat fromTick snaps to next beat', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // At 120 BPM, 4/4: beats at 0, 960, 1920...
    // Start mid-beat at tick 576 — should snap to 960
    const events = player.generate(576, 2112);
    expect(events.length).toBe(2);
    expect(events[0].tick).toBe(960);
    expect(events[1].tick).toBe(1920);
  });
```

**Add new test: 8-bar loop generates exactly 8 downbeats:**

```typescript
  it('8-bar loop generates exactly 8 downbeats (half-open interval)', () => {
    const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
    player.setEnabled(true);
    player.setClickSounds(createMockBuffer(), createMockBuffer());

    // 4/4 at 120 BPM: 1 bar = 3840 ticks
    // 8 bars = 30720 ticks. Bar 9 starts at 30720.
    // Half-open: [0, 30720) — should NOT include tick 30720
    const events = player.generate(0, 30720);
    const downbeats = events.filter((e) => e.isAccent);
    expect(downbeats.length).toBe(8);
    // Total beats: 8 bars * 4 beats = 32
    expect(events.length).toBe(32);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/transport && npx vitest run src/__tests__/metronome-player.test.ts`
Expected: FAIL — `generate()` still takes seconds, events have `transportTime`

- [ ] **Step 3: Update MetronomePlayer to tick-based API**

Replace `packages/transport/src/audio/metronome-player.ts`:

```typescript
import type { SchedulerEvent, SchedulerListener } from '../types';
import type { TempoMap } from '../timeline/tempo-map';
import { MeterMap } from '../timeline/meter-map';

export interface MetronomeEvent extends SchedulerEvent {
  isAccent: boolean;
  buffer: AudioBuffer;
}

export class MetronomePlayer implements SchedulerListener<MetronomeEvent> {
  private _audioContext: AudioContext;
  private _tempoMap: TempoMap;
  private _meterMap: MeterMap;
  private _destination: AudioNode;
  private _toAudioTime: (transportTimeSeconds: number) => number;
  private _enabled = false;
  private _accentBuffer: AudioBuffer | null = null;
  private _normalBuffer: AudioBuffer | null = null;
  private _activeSources: Set<AudioBufferSourceNode> = new Set();

  constructor(
    audioContext: AudioContext,
    tempoMap: TempoMap,
    meterMap: MeterMap,
    destination: AudioNode,
    toAudioTime: (transportTimeSeconds: number) => number
  ) {
    this._audioContext = audioContext;
    this._tempoMap = tempoMap;
    this._meterMap = meterMap;
    this._destination = destination;
    this._toAudioTime = toAudioTime;
  }

  setEnabled(enabled: boolean): void {
    this._enabled = enabled;
    if (!enabled) {
      this.silence();
    }
  }

  setClickSounds(accent: AudioBuffer, normal: AudioBuffer): void {
    this._accentBuffer = accent;
    this._normalBuffer = normal;
  }

  generate(fromTick: number, toTick: number): MetronomeEvent[] {
    if (!this._enabled || !this._accentBuffer || !this._normalBuffer) {
      return [];
    }

    const events: MetronomeEvent[] = [];

    // Snap to first beat: align to beat grid anchored at the active meter entry
    let entry = this._meterMap.getEntryAt(fromTick);
    let beatSize = this._meterMap.ticksPerBeat(fromTick);
    const tickIntoSection = fromTick - entry.tick;
    let tick = entry.tick + Math.ceil(tickIntoSection / beatSize) * beatSize;

    while (tick < toTick) {
      // Re-snap at meter boundaries
      const currentEntry = this._meterMap.getEntryAt(tick);
      if (currentEntry.tick !== entry.tick) {
        entry = currentEntry;
        beatSize = this._meterMap.ticksPerBeat(tick);
      }

      const isAccent = this._meterMap.isBarBoundary(tick);

      events.push({
        tick,
        isAccent,
        buffer: isAccent ? this._accentBuffer : this._normalBuffer,
      });

      beatSize = this._meterMap.ticksPerBeat(tick);
      tick += beatSize;
    }

    return events;
  }

  consume(event: MetronomeEvent): void {
    const source = this._audioContext.createBufferSource();
    source.buffer = event.buffer;
    source.connect(this._destination);

    this._activeSources.add(source);
    source.addEventListener('ended', () => {
      this._activeSources.delete(source);
      try {
        source.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] MetronomePlayer: error disconnecting source:',
          String(err)
        );
      }
    });

    // Convert tick → seconds → audio time
    const transportTimeSeconds = this._tempoMap.ticksToSeconds(event.tick);
    source.start(this._toAudioTime(transportTimeSeconds));
  }

  onPositionJump(_newTick: number): void {
    this.silence();
  }

  silence(): void {
    for (const source of this._activeSources) {
      try {
        source.stop();
      } catch (err) {
        console.warn(
          '[waveform-playlist] MetronomePlayer.silence: error stopping source:',
          String(err)
        );
      }
      try {
        source.disconnect();
      } catch (err) {
        console.warn(
          '[waveform-playlist] MetronomePlayer.silence: error disconnecting:',
          String(err)
        );
      }
    }
    this._activeSources.clear();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/transport && npx vitest run src/__tests__/metronome-player.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/transport/src/audio/metronome-player.ts packages/transport/src/__tests__/metronome-player.test.ts
git commit -m "feat(transport): MetronomePlayer tick-based generate, 8-bar loop test"
```

---

### Task 6: ClipPlayer — tick-based generate with sample-based loop clamping

**Files:**
- Modify: `packages/transport/src/audio/clip-player.ts`
- Test: `packages/transport/src/__tests__/clip-player.test.ts`

- [ ] **Step 1: Update tests for tick-based API**

In `packages/transport/src/__tests__/clip-player.test.ts`, add TempoMap import and update all `generate()`, `setLoop()`, and `onPositionJump()` calls.

At the top, add import:

```typescript
import { TempoMap } from '../timeline/tempo-map';
```

In `beforeEach`, add tempoMap and pass to SampleTimeline:

```typescript
  let tempoMap: TempoMap;

  beforeEach(() => {
    ctx = createMockAudioContext();
    tempoMap = new TempoMap(960, 120);
    sampleTimeline = new SampleTimeline(48000);
    sampleTimeline.setTempoMap(tempoMap);
  });
```

Update ClipPlayer construction to pass tempoMap:

```typescript
// All instances of:
const player = new ClipPlayer(ctx, sampleTimeline, (t) => t);
// Become:
const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
```

**Test "generate returns events for clips overlapping the time window" (line 88-100):**

```typescript
  it('generate returns events for clips overlapping the time window', () => {
    const clip = makeClip({ startSample: 0, durationSamples: 48000 }); // 0-1s
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    // Window [0, 960) ticks = [0, 0.5s)
    const events = player.generate(0, 960);
    expect(events.length).toBe(1);
    expect(events[0].tick).toBe(0);
    expect(events[0].offsetSamples).toBe(0);
    expect(events[0].durationSamples).toBe(48000);
  });
```

**Test "generate clamps clip duration at loopEnd" (line 224-241):**

```typescript
  it('generate clamps clip duration at loopEnd (sample-based)', () => {
    const clip = makeClip({
      startSample: 0,
      durationSamples: 96000, // 2s
      offsetSamples: 0,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));
    // Loop [0, 48000) samples
    player.setLoopSamples(true, 0, 48000);

    const events = player.generate(0, 384);
    expect(events.length).toBe(1);
    // Duration clamped to 48000 samples (loopEndSamples - clipStartSample)
    expect(events[0].durationSamples).toBe(48000);
  });
```

**Test "consume calls source.start with correct arguments" (line 134-152):**

```typescript
  it('consume calls source.start with correct arguments', () => {
    const clip = makeClip({ startSample: 0, durationSamples: 48000, offsetSamples: 0 });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 384);
    expect(events.length).toBe(1);
    player.consume(events[0]);

    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.start).toHaveBeenCalledTimes(1);
    const [when, offset, duration] = source.start.mock.calls[0];
    expect(when).toBeCloseTo(0);
    expect(offset).toBeCloseTo(0);
    expect(duration).toBeCloseTo(1); // 48000/48000 = 1s
  });
```

**Test "onPositionJump" (line 169-192):**

```typescript
  it('onPositionJump stops active sources and reschedules mid-clip', () => {
    const clip = makeClip({
      startSample: 0,
      durationSamples: 96000,
      offsetSamples: 0,
    });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 384);
    player.consume(events[0]);

    // Jump to 0.5s = 960 ticks
    player.onPositionJump(960);
    const source = (ctx.createBufferSource as any).mock.results[0].value;
    expect(source.stop).toHaveBeenCalledTimes(1);
    expect((ctx.createBufferSource as any).mock.results.length).toBeGreaterThan(1);
  });
```

Update remaining tests similarly — all `generate()` calls use tick ranges, all `setLoop()` uses `setLoopSamples()`, all `onPositionJump()` uses ticks. The key conversion: at 120 BPM / 960 PPQN / 48kHz, 0.5s = 960 ticks = 24000 samples.

Also add the `generate` calls for tests at lines 102-132 that test skip/empty:

```typescript
  it('generate skips clips with durationSamples === 0', () => {
    const clip = makeClip({ durationSamples: 0 });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 1920);
    expect(events.length).toBe(0);
  });

  it('generate skips clips with no audioBuffer (peaks-first)', () => {
    const clip = makeClip({ audioBuffer: undefined });
    const track = makeTrack([clip]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 1920);
    expect(events.length).toBe(0);
  });

  it('generate returns [] for empty tracks', () => {
    const track = makeTrack([]);
    const trackNode = createMockTrackNode('track-1');
    const player = new ClipPlayer(ctx, sampleTimeline, tempoMap, (t) => t);
    player.setTracks([track], new Map([['track-1', trackNode]]));

    const events = player.generate(0, 1920);
    expect(events.length).toBe(0);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/transport && npx vitest run src/__tests__/clip-player.test.ts`
Expected: FAIL — ClipPlayer constructor signature changed, no `setLoopSamples`, generate still takes seconds

- [ ] **Step 3: Update ClipPlayer for tick-based generate with sample loop clamping**

Replace `packages/transport/src/audio/clip-player.ts`:

```typescript
import type { ClipTrack, AudioClip } from '@waveform-playlist/core';
import type { SchedulerEvent, SchedulerListener } from '../types';
import type { SampleTimeline } from '../timeline/sample-timeline';
import type { TempoMap } from '../timeline/tempo-map';
import type { TrackNode } from './track-node';

export interface ClipEvent extends SchedulerEvent {
  trackId: string;
  clipId: string;
  audioBuffer: AudioBuffer;
  /** Offset into the audioBuffer (integer samples) */
  offsetSamples: number;
  /** Duration to play (integer samples) */
  durationSamples: number;
  /** Clip gain multiplier */
  gain: number;
  /** Fade in duration in samples */
  fadeInDurationSamples: number;
  /** Fade out duration in samples */
  fadeOutDurationSamples: number;
}

interface TrackClipState {
  track: ClipTrack;
  clips: AudioClip[];
}

export class ClipPlayer implements SchedulerListener<ClipEvent> {
  private _audioContext: AudioContext;
  private _sampleTimeline: SampleTimeline;
  private _tempoMap: TempoMap;
  private _toAudioTime: (transportTimeSeconds: number) => number;
  private _tracks: Map<string, TrackClipState> = new Map();
  private _trackNodes: Map<string, TrackNode> = new Map();
  private _activeSources: Map<AudioBufferSourceNode, { trackId: string; gainNode: GainNode }> =
    new Map();
  private _loopEnabled = false;
  private _loopEndSamples = 0;

  constructor(
    audioContext: AudioContext,
    sampleTimeline: SampleTimeline,
    tempoMap: TempoMap,
    toAudioTime: (transportTimeSeconds: number) => number
  ) {
    this._audioContext = audioContext;
    this._sampleTimeline = sampleTimeline;
    this._tempoMap = tempoMap;
    this._toAudioTime = toAudioTime;
  }

  setTracks(tracks: ClipTrack[], trackNodes: Map<string, TrackNode>): void {
    this._tracks.clear();
    this._trackNodes = trackNodes;
    for (const track of tracks) {
      this._tracks.set(track.id, { track, clips: track.clips });
    }
  }

  /** Set loop boundaries in ticks — converts to samples internally */
  setLoop(enabled: boolean, _startTick: number, endTick: number): void {
    this._loopEnabled = enabled;
    this._loopEndSamples = this._sampleTimeline.ticksToSamples(endTick);
  }

  /** Set loop boundaries directly in samples */
  setLoopSamples(enabled: boolean, _startSample: number, endSample: number): void {
    this._loopEnabled = enabled;
    this._loopEndSamples = endSample;
  }

  updateTrack(trackId: string, track: ClipTrack): void {
    this._tracks.set(trackId, { track, clips: track.clips });
    this._silenceTrack(trackId);
  }

  generate(fromTick: number, toTick: number): ClipEvent[] {
    const events: ClipEvent[] = [];

    const fromSample = this._sampleTimeline.ticksToSamples(fromTick);
    const toSample = this._sampleTimeline.ticksToSamples(toTick);

    for (const [trackId, state] of this._tracks) {
      for (const clip of state.clips) {
        if (clip.durationSamples === 0) continue;
        if (!clip.audioBuffer) continue;

        // Only schedule when the clip START falls within this window.
        if (clip.startSample < fromSample) continue;
        if (clip.startSample >= toSample) continue;

        const fadeInDurationSamples = clip.fadeIn?.duration ?? 0;
        const fadeOutDurationSamples = clip.fadeOut?.duration ?? 0;

        // Clamp duration at loopEnd so the source stops exactly at the boundary.
        let durationSamples = clip.durationSamples;
        if (this._loopEnabled && clip.startSample + durationSamples > this._loopEndSamples) {
          durationSamples = this._loopEndSamples - clip.startSample;
        }

        // Skip zero-duration events at loop boundary
        if (durationSamples <= 0) continue;

        // Convert clip startSample to tick for the event
        const tick = this._sampleTimeline.samplesToTicks(clip.startSample);

        events.push({
          tick,
          trackId,
          clipId: clip.id,
          audioBuffer: clip.audioBuffer,
          offsetSamples: clip.offsetSamples,
          durationSamples,
          gain: clip.gain,
          fadeInDurationSamples,
          fadeOutDurationSamples,
        });
      }
    }

    return events;
  }

  consume(event: ClipEvent): void {
    const trackNode = this._trackNodes.get(event.trackId);
    if (!trackNode) {
      console.warn(
        '[waveform-playlist] ClipPlayer.consume: no TrackNode for trackId "' +
          event.trackId +
          '", clipId "' +
          event.clipId +
          '" — clip will not play'
      );
      return;
    }

    const sampleRate = this._sampleTimeline.sampleRate;
    const offset = event.offsetSamples / sampleRate;
    const duration = event.durationSamples / sampleRate;

    // Guard against invalid offset
    if (offset >= event.audioBuffer.duration) {
      return;
    }

    const source = this._audioContext.createBufferSource();
    source.buffer = event.audioBuffer;

    // Convert tick → seconds → AudioContext.currentTime for scheduling
    const transportTimeSeconds = this._tempoMap.ticksToSeconds(event.tick);
    const when = this._toAudioTime(transportTimeSeconds);

    // Create a gain node for per-clip gain and fades
    const gainNode = this._audioContext.createGain();
    gainNode.gain.value = event.gain;

    // Apply fades (AudioParam scheduling uses AudioContext time)
    let fadeIn = event.fadeInDurationSamples / sampleRate;
    let fadeOut = event.fadeOutDurationSamples / sampleRate;
    if (fadeIn + fadeOut > duration) {
      const ratio = duration / (fadeIn + fadeOut);
      fadeIn *= ratio;
      fadeOut *= ratio;
    }

    if (fadeIn > 0) {
      gainNode.gain.setValueAtTime(0, when);
      gainNode.gain.linearRampToValueAtTime(event.gain, when + fadeIn);
    }
    if (fadeOut > 0) {
      const fadeOutStart = when + duration - fadeOut;
      gainNode.gain.setValueAtTime(event.gain, fadeOutStart);
      gainNode.gain.linearRampToValueAtTime(0, when + duration);
    }

    source.connect(gainNode);
    gainNode.connect(trackNode.input);

    this._activeSources.set(source, {
      trackId: event.trackId,
      gainNode,
    });

    source.addEventListener('ended', () => {
      this._activeSources.delete(source);
      try {
        gainNode.disconnect();
      } catch (err) {
        console.warn('[waveform-playlist] ClipPlayer: error disconnecting gain node:', String(err));
      }
    });

    source.start(when, offset, duration);
  }

  onPositionJump(newTick: number): void {
    this.silence();

    const sampleRate = this._sampleTimeline.sampleRate;
    const newSample = this._sampleTimeline.ticksToSamples(newTick);
    const newTimeSeconds = this._tempoMap.ticksToSeconds(newTick);

    // Re-schedule mid-clip sources for clips that span the new position
    for (const [trackId, state] of this._tracks) {
      for (const clip of state.clips) {
        if (clip.durationSamples === 0) continue;
        if (!clip.audioBuffer) continue;

        const clipEndSample = clip.startSample + clip.durationSamples;

        // Check if clip spans the new position (in samples)
        if (clip.startSample <= newSample && clipEndSample > newSample) {
          const offsetIntoClipSamples = newSample - clip.startSample;
          const offsetSamples = clip.offsetSamples + offsetIntoClipSamples;
          const durationSamples = clipEndSample - newSample;

          const fadeOutDurationSamples = clip.fadeOut?.duration ?? 0;

          // Convert newSample to tick for the event
          const tick = this._sampleTimeline.samplesToTicks(newSample);

          this.consume({
            tick,
            trackId,
            clipId: clip.id,
            audioBuffer: clip.audioBuffer,
            offsetSamples,
            durationSamples,
            gain: clip.gain,
            fadeInDurationSamples: 0,
            fadeOutDurationSamples,
          });
        }
      }
    }
  }

  silence(): void {
    for (const [source, { gainNode }] of this._activeSources) {
      try {
        source.stop();
      } catch (err) {
        console.warn('[waveform-playlist] ClipPlayer.silence: error stopping source:', String(err));
      }
      try {
        gainNode.disconnect();
      } catch (err) {
        console.warn('[waveform-playlist] ClipPlayer.silence: error disconnecting:', String(err));
      }
    }
    this._activeSources.clear();
  }

  private _silenceTrack(trackId: string): void {
    const toDelete: AudioBufferSourceNode[] = [];
    for (const [source, info] of this._activeSources) {
      if (info.trackId === trackId) {
        try {
          source.stop();
        } catch (err) {
          console.warn(
            '[waveform-playlist] ClipPlayer._silenceTrack: error stopping source:',
            String(err)
          );
        }
        try {
          info.gainNode.disconnect();
        } catch (err) {
          console.warn(
            '[waveform-playlist] ClipPlayer._silenceTrack: error disconnecting:',
            String(err)
          );
        }
        toDelete.push(source);
      }
    }
    for (const source of toDelete) {
      this._activeSources.delete(source);
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/transport && npx vitest run src/__tests__/clip-player.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/transport/src/audio/clip-player.ts packages/transport/src/__tests__/clip-player.test.ts
git commit -m "feat(transport): ClipPlayer tick-based generate, sample-based loop clamping"
```

---

### Task 7: Transport — tick-based setLoop, setLoopSeconds, setLoopSamples

**Files:**
- Modify: `packages/transport/src/transport.ts:45-78` (constructor), `302-316` (setLoop), `86-111` (play), `123-134` (stop), `136-156` (seek)

- [ ] **Step 1: Write failing test for Transport loop APIs**

Create `packages/transport/src/__tests__/transport-loop.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { Transport } from '../transport';

function createMockAudioContext() {
  return {
    sampleRate: 48000,
    currentTime: 0,
    state: 'running',
    createGain: vi.fn(() => ({
      gain: { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createStereoPanner: vi.fn(() => ({
      pan: { value: 0 },
      connect: vi.fn(),
      disconnect: vi.fn(),
    })),
    createBufferSource: vi.fn(() => ({
      buffer: null,
      connect: vi.fn(),
      disconnect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
      addEventListener: vi.fn(),
    })),
    destination: { connect: vi.fn() },
  } as unknown as AudioContext;
}

describe('Transport loop APIs', () => {
  it('setLoop accepts ticks as primary API', () => {
    const ctx = createMockAudioContext();
    const transport = new Transport(ctx);
    // Should not throw — 0 to 3840 ticks (1 bar at 4/4, 120 BPM)
    expect(() => transport.setLoop(true, 0, 3840)).not.toThrow();
  });

  it('setLoopSeconds converts seconds to ticks', () => {
    const ctx = createMockAudioContext();
    const transport = new Transport(ctx);
    // 2s at 120 BPM = 3840 ticks
    expect(() => transport.setLoopSeconds(true, 0, 2)).not.toThrow();
  });

  it('setLoopSamples converts samples to ticks', () => {
    const ctx = createMockAudioContext();
    const transport = new Transport(ctx);
    // 96000 samples at 48kHz = 2s = 3840 ticks
    expect(() => transport.setLoopSamples(true, 0, 96000)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/transport && npx vitest run src/__tests__/transport-loop.test.ts`
Expected: FAIL — `setLoopSeconds` and `setLoopSamples` don't exist

- [ ] **Step 3: Update Transport**

In `packages/transport/src/transport.ts`:

**Constructor (line 58-63):** Pass `tempoMap` to Scheduler:

```typescript
// Before:
this._scheduler = new Scheduler({
  lookahead,
  onLoop: (loopStartTime: number) => {
    this._clock.seekTo(loopStartTime);
  },
});

// After:
this._scheduler = new Scheduler(this._tempoMap, {
  lookahead,
  onLoop: (loopStartTimeSeconds: number) => {
    this._clock.seekTo(loopStartTimeSeconds);
  },
});
```

**`_initAudioGraph` method:** Pass `tempoMap` to ClipPlayer. Find where `new ClipPlayer(...)` is called and add `this._tempoMap` as third argument:

```typescript
// Before:
this._clipPlayer = new ClipPlayer(audioContext, this._sampleTimeline, toAudioTime);

// After:
this._clipPlayer = new ClipPlayer(audioContext, this._sampleTimeline, this._tempoMap, toAudioTime);
```

Also wire SampleTimeline to TempoMap. After `this._tempoMap = new TempoMap(ppqn, tempo);` in constructor, add:

```typescript
this._sampleTimeline.setTempoMap(this._tempoMap);
```

**`setLoop` method (line 302-316):** Change to tick-based primary:

```typescript
  // --- Loop ---

  /** Primary loop API — ticks as source of truth */
  setLoop(enabled: boolean, startTick: number, endTick: number): void {
    if (enabled && startTick >= endTick) {
      console.warn(
        '[waveform-playlist] Transport.setLoop: startTick (' +
          startTick +
          ') must be less than endTick (' +
          endTick +
          ')'
      );
      return;
    }
    this._scheduler.setLoop(enabled, startTick, endTick);
    this._clipPlayer.setLoop(enabled, startTick, endTick);
    this._emit('loop');
  }

  /** Convenience — converts seconds to ticks */
  setLoopSeconds(enabled: boolean, startSec: number, endSec: number): void {
    const startTick = this._tempoMap.secondsToTicks(startSec);
    const endTick = this._tempoMap.secondsToTicks(endSec);
    this.setLoop(enabled, startTick, endTick);
  }

  /** Convenience — sets loop in samples, optimized for sample-based callers */
  setLoopSamples(enabled: boolean, startSample: number, endSample: number): void {
    this._clipPlayer.setLoopSamples(enabled, startSample, endSample);
    const startTick = this._sampleTimeline.samplesToTicks(startSample);
    const endTick = this._sampleTimeline.samplesToTicks(endSample);
    this._scheduler.setLoop(enabled, startTick, endTick);
    this._emit('loop');
  }
```

**`play()` method (line 97,106):** `scheduler.reset` and `clipPlayer.onPositionJump` receive seconds — Scheduler converts internally, but ClipPlayer now expects ticks:

```typescript
// Line 97: scheduler.reset already takes seconds and converts internally — no change
// Line 106: clipPlayer.onPositionJump now takes ticks
const currentTime = this._clock.getTime();
this._scheduler.reset(currentTime);
// ...
const currentTick = this._tempoMap.secondsToTicks(currentTime);
this._clipPlayer.onPositionJump(currentTick);
```

**`stop()` method (line 127):** `scheduler.reset(0)` — 0 seconds = 0 ticks, no change needed. No `clipPlayer.onPositionJump` call in stop.

**`seek()` method (line 145):** Same pattern as play:

```typescript
this._scheduler.reset(time);
// ...
const seekTick = this._tempoMap.secondsToTicks(time);
this._clipPlayer.onPositionJump(seekTick);
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/transport && npx vitest run src/__tests__/transport-loop.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/transport/src/transport.ts packages/transport/src/__tests__/transport-loop.test.ts
git commit -m "feat(transport): Transport tick-based setLoop with seconds/samples convenience"
```

---

### Task 8: NativePlayoutAdapter — call setLoopSeconds

**Files:**
- Modify: `packages/transport/src/adapter.ts:88-90`

- [ ] **Step 1: Update adapter to call setLoopSeconds**

In `packages/transport/src/adapter.ts`, line 88-90:

```typescript
// Before:
setLoop(enabled: boolean, start: number, end: number): void {
  this._transport.setLoop(enabled, start, end);
}

// After:
setLoop(enabled: boolean, start: number, end: number): void {
  this._transport.setLoopSeconds(enabled, start, end);
}
```

The adapter receives seconds from the engine's `PlayoutAdapter` interface, so it calls the seconds convenience method.

- [ ] **Step 2: Run typecheck**

Run: `cd packages/transport && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/transport/src/adapter.ts
git commit -m "feat(transport): adapter.setLoop calls transport.setLoopSeconds"
```

---

### Task 9: Full build and test verification

- [ ] **Step 1: Run all transport tests**

Run: `cd packages/transport && npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run typecheck**

Run: `cd packages/transport && pnpm typecheck`
Expected: PASS — no type errors

- [ ] **Step 3: Build**

Run: `pnpm build`
Expected: PASS

- [ ] **Step 4: Lint**

Run: `pnpm lint`
Expected: PASS (fix formatting with `pnpm format` if needed)

- [ ] **Step 5: Kill stray vitest processes**

Run: `pgrep -f vitest && pkill -f vitest || echo "no strays"`

---

### Task 10: Update CLAUDE.md for transport package

**Files:**
- Modify: `packages/transport/CLAUDE.md`

- [ ] **Step 1: Update Scheduler section**

In the "Core Layer > Scheduler" section, update to reflect tick-based operation:

Replace the line "Both coordinate systems convert to seconds at the scheduler boundary. The scheduler only works in seconds." with:

"SampleTimeline converts between samples, seconds, and ticks (via TempoMap). The Scheduler works in integer ticks — seconds from the Clock are converted at the top of `advance()`. MetronomePlayer receives ticks directly; ClipPlayer converts ticks to samples."

Add to the Scheduler subsection:

"**Tick-based internals (v0.0.3):** Loop boundaries (`_loopStart`, `_loopEnd`) and the scheduling cursor (`_rightEdge`) are integer ticks. `advance()` converts Clock seconds → ticks via TempoMap at entry, then uses integer comparisons for loop wrap logic. `onLoop` callback converts back to seconds for `Clock.seekTo()`. This eliminates float precision drift at loop boundaries."

- [ ] **Step 2: Update Transport loop section**

Add note about the three loop APIs:

"**Loop APIs:** `setLoop(enabled, startTick, endTick)` is the primary tick-based API. `setLoopSeconds()` and `setLoopSamples()` are convenience methods that convert at the boundary. `NativePlayoutAdapter.setLoop()` calls `setLoopSeconds()` since the engine speaks seconds."

- [ ] **Step 3: Commit**

```bash
git add packages/transport/CLAUDE.md
git commit -m "docs(transport): update CLAUDE.md for tick-based scheduler"
```
