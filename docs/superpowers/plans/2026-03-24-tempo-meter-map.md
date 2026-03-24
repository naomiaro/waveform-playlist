# Tempo & Meter Map Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add scheduled tempo and time signature changes to `@dawcore/transport` so the metronome can handle pieces with changing meters (e.g., 4/4 verse → 7/8 bridge).

**Architecture:** New `MeterMap` class parallel to `TempoMap`, storing time signature entries at tick positions. `MetronomePlayer` queries `MeterMap` per beat instead of using a single `beatsPerBar`. Transport exposes `setTempo(bpm, atTick?)` and `setMeter(numerator, denominator, atTick?)`.

**Tech Stack:** TypeScript, vitest, tsup. Zero dependencies.

**Spec:** `docs/superpowers/specs/2026-03-24-tempo-meter-map-design.md`

---

## Phase 1: Types + MeterMap

### Task 1: Add types to types.ts

**Files:**
- Modify: `packages/transport/src/types.ts`
- Modify: `packages/transport/src/index.ts`

- [ ] **Step 1: Add MeterSignature and MeterEntry to types.ts**

```typescript
// Add to packages/transport/src/types.ts

/** Public return type for getMeter() */
export interface MeterSignature {
  numerator: number;
  denominator: number;
}

/** Storage entry for MeterMap */
export interface MeterEntry {
  /** Tick position where this meter starts */
  tick: number;
  /** Time signature numerator (e.g., 6 in 6/8) */
  numerator: number;
  /** Time signature denominator (e.g., 8 in 6/8) */
  denominator: number;
  /** Cached cumulative bar count from tick 0 to this entry. Derived — do not set manually. */
  readonly barAtTick: number;
}
```

- [ ] **Step 2: Update TransportOptions — replace beatsPerBar with numerator/denominator**

```typescript
// In TransportOptions, remove beatsPerBar and add:
  /** Time signature numerator. Default: 4 */
  numerator?: number;
  /** Time signature denominator. Default: 4 */
  denominator?: number;
```

- [ ] **Step 3: Export new types from index.ts**

Add to `src/index.ts`:
```typescript
export type { MeterSignature, MeterEntry } from './types';
```

- [ ] **Step 4: Commit**

```bash
git add packages/transport/src/types.ts packages/transport/src/index.ts
git commit -m "feat(transport): add MeterSignature, MeterEntry types"
```

---

### Task 2: MeterMap — core methods

**Files:**
- Create: `packages/transport/src/timeline/meter-map.ts`
- Create: `packages/transport/src/__tests__/meter-map.test.ts`

- [ ] **Step 1: Write failing tests for core methods**

```typescript
// packages/transport/src/__tests__/meter-map.test.ts
import { describe, it, expect, vi } from 'vitest';
import { MeterMap } from '../timeline/meter-map';

describe('MeterMap', () => {
  it('defaults to 4/4', () => {
    const mm = new MeterMap(960);
    const meter = mm.getMeter();
    expect(meter.numerator).toBe(4);
    expect(meter.denominator).toBe(4);
  });

  it('constructor accepts initial meter', () => {
    const mm = new MeterMap(960, 6, 8);
    const meter = mm.getMeter();
    expect(meter.numerator).toBe(6);
    expect(meter.denominator).toBe(8);
  });

  it('ticksPerBeat for 4/4 at 960 PPQN', () => {
    const mm = new MeterMap(960);
    expect(mm.ticksPerBeat()).toBe(960); // quarter note
  });

  it('ticksPerBeat for 6/8 at 960 PPQN', () => {
    const mm = new MeterMap(960, 6, 8);
    expect(mm.ticksPerBeat()).toBe(480); // eighth note
  });

  it('ticksPerBar for 4/4', () => {
    const mm = new MeterMap(960);
    expect(mm.ticksPerBar()).toBe(3840);
  });

  it('ticksPerBar for 7/8', () => {
    const mm = new MeterMap(960, 7, 8);
    expect(mm.ticksPerBar()).toBe(3360);
  });

  it('ticksPerBar for 6/8', () => {
    const mm = new MeterMap(960, 6, 8);
    expect(mm.ticksPerBar()).toBe(2880);
  });

  it('ppqn getter returns PPQN', () => {
    const mm = new MeterMap(960);
    expect(mm.ppqn).toBe(960);
  });

  it('setMeter at tick 0 replaces default', () => {
    const mm = new MeterMap(960);
    mm.setMeter(3, 4);
    expect(mm.getMeter().numerator).toBe(3);
    expect(mm.getMeter().denominator).toBe(4);
  });

  it('validates numerator is positive integer', () => {
    const mm = new MeterMap(960);
    expect(() => mm.setMeter(0, 4)).toThrow();
    expect(() => mm.setMeter(-1, 4)).toThrow();
    expect(() => mm.setMeter(1.5, 4)).toThrow();
  });

  it('validates denominator is power of 2', () => {
    const mm = new MeterMap(960);
    expect(() => mm.setMeter(4, 3)).toThrow();
    expect(() => mm.setMeter(4, 5)).toThrow();
    expect(() => mm.setMeter(4, 0)).toThrow();
  });

  it('accepts denominator 1 (whole note) and 16', () => {
    const mm = new MeterMap(960);
    mm.setMeter(4, 1);
    expect(mm.ticksPerBeat()).toBe(3840); // whole note
    mm.setMeter(4, 16);
    expect(mm.ticksPerBeat()).toBe(240); // sixteenth note
  });

  it('validates atTick is non-negative', () => {
    const mm = new MeterMap(960);
    expect(() => mm.setMeter(4, 4, -1)).toThrow();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run src/__tests__/meter-map.test.ts`
Expected: FAIL — `MeterMap` not found

- [ ] **Step 3: Implement MeterMap core**

```typescript
// packages/transport/src/timeline/meter-map.ts
import type { MeterEntry, MeterSignature } from '../types';

interface MutableMeterEntry {
  tick: number;
  numerator: number;
  denominator: number;
  barAtTick: number;
}

function isPowerOf2(n: number): boolean {
  return n > 0 && (n & (n - 1)) === 0;
}

export class MeterMap {
  private _ppqn: number;
  private _entries: MutableMeterEntry[];

  constructor(ppqn: number, numerator: number = 4, denominator: number = 4) {
    this._ppqn = ppqn;
    this._entries = [{ tick: 0, numerator, denominator, barAtTick: 0 }];
  }

  get ppqn(): number {
    return this._ppqn;
  }

  getMeter(atTick: number = 0): MeterSignature {
    const entry = this._entryAt(atTick);
    return { numerator: entry.numerator, denominator: entry.denominator };
  }

  setMeter(numerator: number, denominator: number, atTick: number = 0): void {
    this._validateMeter(numerator, denominator);

    if (atTick === 0) {
      this._entries[0] = { ...this._entries[0], numerator, denominator };
      this._recomputeCache(0);
      return;
    }

    if (atTick < 0) {
      throw new Error('[waveform-playlist] MeterMap: atTick must be non-negative, got ' + atTick);
    }

    // Snap to bar boundary of preceding meter
    const snapped = this._snapToBarBoundary(atTick);
    if (snapped !== atTick) {
      console.warn(
        '[waveform-playlist] MeterMap.setMeter: tick ' + atTick +
        ' is not on a bar boundary, snapped to ' + snapped
      );
    }

    let i = this._entries.length - 1;
    while (i > 0 && this._entries[i].tick > snapped) i--;

    if (this._entries[i].tick === snapped) {
      this._entries[i] = { ...this._entries[i], numerator, denominator };
    } else {
      const barAtTick = this._computeBarAtTick(snapped);
      this._entries.splice(i + 1, 0, { tick: snapped, numerator, denominator, barAtTick });
      i = i + 1;
    }
    this._recomputeCache(i);
  }

  removeMeter(atTick: number): void {
    if (atTick === 0) {
      throw new Error('[waveform-playlist] MeterMap: cannot remove meter at tick 0');
    }
    const idx = this._entries.findIndex(e => e.tick === atTick);
    if (idx > 0) {
      this._entries.splice(idx, 1);
      this._recomputeCache(idx);
    }
  }

  clearMeters(): void {
    const first = this._entries[0];
    this._entries = [{ ...first, barAtTick: 0 }];
  }

  ticksPerBeat(atTick: number = 0): number {
    const entry = this._entryAt(atTick);
    return this._ppqn * (4 / entry.denominator);
  }

  ticksPerBar(atTick: number = 0): number {
    const entry = this._entryAt(atTick);
    return entry.numerator * this._ppqn * (4 / entry.denominator);
  }

  barToTick(bar: number): number {
    const targetBar = bar - 1; // 0-indexed
    for (let i = 0; i < this._entries.length; i++) {
      const nextBar = (i < this._entries.length - 1)
        ? this._entries[i + 1].barAtTick
        : Infinity;
      if (targetBar < nextBar) {
        const barsInto = targetBar - this._entries[i].barAtTick;
        const tpb = this._ticksPerBarForEntry(this._entries[i]);
        return this._entries[i].tick + barsInto * tpb;
      }
    }
    const last = this._entries[this._entries.length - 1];
    const barsInto = targetBar - last.barAtTick;
    return last.tick + barsInto * this._ticksPerBarForEntry(last);
  }

  tickToBar(tick: number): number {
    const entry = this._entryAt(tick);
    const ticksInto = tick - entry.tick;
    const tpb = this._ticksPerBarForEntry(entry);
    return entry.barAtTick + Math.floor(ticksInto / tpb) + 1; // 1-indexed
  }

  isBarBoundary(tick: number): boolean {
    const entry = this._entryAt(tick);
    const ticksInto = tick - entry.tick;
    const tpb = this._ticksPerBarForEntry(entry);
    return ticksInto % tpb === 0;
  }

  /** Internal: get the full entry at a tick (for MetronomePlayer beat grid anchoring) */
  getEntryAt(tick: number): MeterEntry {
    return this._entryAt(tick);
  }

  private _entryAt(tick: number): MutableMeterEntry {
    let lo = 0;
    let hi = this._entries.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (this._entries[mid].tick <= tick) {
        lo = mid;
      } else {
        hi = mid - 1;
      }
    }
    return this._entries[lo];
  }

  private _ticksPerBarForEntry(entry: MutableMeterEntry): number {
    return entry.numerator * this._ppqn * (4 / entry.denominator);
  }

  private _snapToBarBoundary(atTick: number): number {
    const entry = this._entryAt(atTick);
    const tpb = this._ticksPerBarForEntry(entry);
    const ticksInto = atTick - entry.tick;
    if (ticksInto % tpb === 0) return atTick;
    // Snap forward to next bar boundary
    return entry.tick + Math.ceil(ticksInto / tpb) * tpb;
  }

  private _computeBarAtTick(tick: number): number {
    const entry = this._entryAt(tick);
    const ticksInto = tick - entry.tick;
    const tpb = this._ticksPerBarForEntry(entry);
    return entry.barAtTick + ticksInto / tpb;
  }

  private _recomputeCache(fromIndex: number): void {
    for (let i = Math.max(1, fromIndex); i < this._entries.length; i++) {
      const prev = this._entries[i - 1];
      const tickDelta = this._entries[i].tick - prev.tick;
      const tpb = this._ticksPerBarForEntry(prev);
      this._entries[i] = {
        ...this._entries[i],
        barAtTick: prev.barAtTick + tickDelta / tpb,
      };
    }
  }

  private _validateMeter(numerator: number, denominator: number): void {
    if (!Number.isInteger(numerator) || numerator < 1 || numerator > 32) {
      throw new Error(
        '[waveform-playlist] MeterMap: numerator must be an integer 1-32, got ' + numerator
      );
    }
    if (!isPowerOf2(denominator) || denominator > 32) {
      throw new Error(
        '[waveform-playlist] MeterMap: denominator must be a power of 2 (1-32), got ' + denominator
      );
    }
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/transport && npx vitest run src/__tests__/meter-map.test.ts`
Expected: All PASS

- [ ] **Step 5: Export from index.ts**

Add to `src/index.ts`:
```typescript
export { MeterMap } from './timeline/meter-map';
```

- [ ] **Step 6: Commit**

```bash
git add packages/transport/src/timeline/meter-map.ts packages/transport/src/__tests__/meter-map.test.ts packages/transport/src/index.ts
git commit -m "feat(transport): add MeterMap — time signature changes at tick positions"
```

---

### Task 3: MeterMap — multi-meter and bar conversion tests

**Files:**
- Modify: `packages/transport/src/__tests__/meter-map.test.ts`

- [ ] **Step 1: Add tests for setMeter at non-zero ticks, barToTick, tickToBar, isBarBoundary**

```typescript
// Add to existing describe('MeterMap', ...)

  it('setMeter at bar boundary inserts entry', () => {
    const mm = new MeterMap(960); // 4/4, ticksPerBar = 3840
    mm.setMeter(7, 8, 3840); // switch to 7/8 at bar 2
    expect(mm.getMeter(0).numerator).toBe(4);
    expect(mm.getMeter(3840).numerator).toBe(7);
    expect(mm.getMeter(3840).denominator).toBe(8);
  });

  it('setMeter snaps to bar boundary with warning', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mm = new MeterMap(960); // 4/4, ticksPerBar = 3840
    mm.setMeter(3, 4, 1000); // mid-bar → snaps to 3840
    expect(warnSpy).toHaveBeenCalled();
    expect(mm.getMeter(3840).numerator).toBe(3);
    // No entry at the original tick — it was snapped
    expect(mm.getMeter(1000).numerator).toBe(4); // still 4/4
    warnSpy.mockRestore();
  });

  it('setMeter at tick 0 preserves downstream entries', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840); // bar 2 = 7/8
    mm.setMeter(6, 8); // change tick 0 to 6/8
    expect(mm.getMeter(0).numerator).toBe(6);
    expect(mm.getMeter(3840).numerator).toBe(7); // still 7/8
  });

  it('clearMeters preserves non-default initial meter', () => {
    const mm = new MeterMap(960, 6, 8);
    mm.setMeter(4, 4, 2880);
    mm.clearMeters();
    expect(mm.getMeter().numerator).toBe(6);
    expect(mm.getMeter().denominator).toBe(8);
  });

  it('barToTick round-trips after removeMeter', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840);
    mm.removeMeter(3840);
    // After removal, back to 4/4 everywhere
    expect(mm.barToTick(2)).toBe(3840);
    expect(mm.barToTick(3)).toBe(7680);
    expect(mm.tickToBar(3840)).toBe(2);
  });

  it('barToTick with single meter', () => {
    const mm = new MeterMap(960); // 4/4
    expect(mm.barToTick(1)).toBe(0);
    expect(mm.barToTick(2)).toBe(3840);
    expect(mm.barToTick(3)).toBe(7680);
  });

  it('barToTick with mixed meters', () => {
    const mm = new MeterMap(960); // 4/4
    mm.setMeter(7, 8, 3840); // bar 2 starts 7/8 (ticksPerBar = 3360)
    expect(mm.barToTick(1)).toBe(0);      // bar 1: 4/4
    expect(mm.barToTick(2)).toBe(3840);   // bar 2: 7/8 starts
    expect(mm.barToTick(3)).toBe(3840 + 3360); // bar 3: still 7/8
  });

  it('tickToBar with single meter', () => {
    const mm = new MeterMap(960);
    expect(mm.tickToBar(0)).toBe(1);
    expect(mm.tickToBar(3840)).toBe(2);
    expect(mm.tickToBar(5000)).toBe(2); // mid-bar 2
  });

  it('tickToBar with mixed meters', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840);
    expect(mm.tickToBar(0)).toBe(1);
    expect(mm.tickToBar(3840)).toBe(2);
    expect(mm.tickToBar(3840 + 3360)).toBe(3);
  });

  it('isBarBoundary', () => {
    const mm = new MeterMap(960); // 4/4
    expect(mm.isBarBoundary(0)).toBe(true);
    expect(mm.isBarBoundary(960)).toBe(false); // beat 2
    expect(mm.isBarBoundary(3840)).toBe(true); // bar 2
  });

  it('isBarBoundary with 6/8', () => {
    const mm = new MeterMap(960, 6, 8); // ticksPerBar = 2880
    expect(mm.isBarBoundary(0)).toBe(true);
    expect(mm.isBarBoundary(480)).toBe(false); // beat 2 (eighth note)
    expect(mm.isBarBoundary(2880)).toBe(true); // bar 2
  });

  it('removeMeter removes entry', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840);
    mm.removeMeter(3840);
    expect(mm.getMeter(3840).numerator).toBe(4); // back to 4/4
  });

  it('removeMeter at tick 0 throws', () => {
    const mm = new MeterMap(960);
    expect(() => mm.removeMeter(0)).toThrow();
  });

  it('clearMeters resets to single entry', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840);
    mm.setMeter(3, 4, 7200);
    mm.clearMeters();
    expect(mm.getMeter(3840).numerator).toBe(4); // default 4/4
  });

  it('barToTick round-trips with tickToBar', () => {
    const mm = new MeterMap(960);
    mm.setMeter(7, 8, 3840);
    for (let bar = 1; bar <= 10; bar++) {
      const tick = mm.barToTick(bar);
      expect(mm.tickToBar(tick)).toBe(bar);
    }
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/transport && npx vitest run src/__tests__/meter-map.test.ts`
Expected: All PASS

- [ ] **Step 3: Commit**

```bash
git add packages/transport/src/__tests__/meter-map.test.ts
git commit -m "test(transport): add MeterMap multi-meter and bar conversion tests"
```

---

## Phase 2: MetronomePlayer Update

### Task 4: Update MetronomePlayer to use MeterMap

**Files:**
- Modify: `packages/transport/src/audio/metronome-player.ts`
- Modify: `packages/transport/src/__tests__/metronome-player.test.ts`

- [ ] **Step 1: Write failing tests for meter-aware generation**

```typescript
// Add to existing metronome-player.test.ts
import { MeterMap } from '../timeline/meter-map';

// Update createMockMetronomePlayer to accept MeterMap instead of TickTimeline

it('generates beats using MeterMap beat size (6/8 = eighth notes)', () => {
  const meterMap = new MeterMap(960, 6, 8);
  const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
  player.setEnabled(true);
  player.setClickSounds(createMockBuffer(), createMockBuffer());

  // At 120 BPM, 6/8: beat = eighth note = 0.25s
  const events = player.generate(0, 0.6);
  // Should get beats at 0.0, 0.25, 0.5 (3 eighth-note beats)
  expect(events.length).toBe(3);
  expect(events[0].transportTime).toBeCloseTo(0.0);
  expect(events[1].transportTime).toBeCloseTo(0.25);
});

it('accents on bar boundaries with mixed meters', () => {
  const meterMap = new MeterMap(960);
  meterMap.setMeter(3, 4, 3840); // switch to 3/4 at bar 2
  const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
  player.setEnabled(true);
  player.setClickSounds(createMockBuffer(), createMockBuffer());

  // Bar 1 (4/4): beats at 0, 0.5, 1.0, 1.5 — accent at 0
  // Bar 2 (3/4): beats at 2.0, 2.5, 3.0 — accent at 2.0
  const events = player.generate(0, 3.1);
  expect(events[0].isAccent).toBe(true);  // beat 1 of bar 1
  expect(events[1].isAccent).toBe(false); // beat 2
  expect(events[4].isAccent).toBe(true);  // beat 1 of bar 2 (3/4)
  // Bar 2 should have 3 beats (not 4)
  expect(events[5].isAccent).toBe(false); // beat 2 of bar 2
  expect(events[6].isAccent).toBe(false); // beat 3 of bar 2
});

it('beat step size changes at meter boundary within scheduling window', () => {
  const meterMap = new MeterMap(960);
  meterMap.setMeter(6, 8, 3840); // switch to 6/8 at bar 2
  const player = new MetronomePlayer(ctx, tempoMap, meterMap, destination, (t) => t);
  player.setEnabled(true);
  player.setClickSounds(createMockBuffer(), createMockBuffer());

  // At 120 BPM: bar 1 (4/4) beats every 0.5s, bar 2 (6/8) beats every 0.25s
  const events = player.generate(0, 3.5);

  // Bar 1: 4 quarter-note beats (0.0, 0.5, 1.0, 1.5)
  expect(events[0].transportTime).toBeCloseTo(0.0);
  expect(events[1].transportTime).toBeCloseTo(0.5);
  expect(events[3].transportTime).toBeCloseTo(1.5);

  // Bar 2: 6 eighth-note beats starting at 2.0 (0.25s apart)
  expect(events[4].transportTime).toBeCloseTo(2.0);
  expect(events[5].transportTime).toBeCloseTo(2.25);
  expect(events[6].transportTime).toBeCloseTo(2.5);
});
```

- [ ] **Step 2: Update MetronomePlayer constructor — replace TickTimeline with MeterMap**

Replace `_tickTimeline: TickTimeline` with `_meterMap: MeterMap`. Remove `_beatsPerBar` field. Keep `setBeatsPerBar` as a deprecated wrapper calling `_meterMap.setMeter(beats, 4)`.

- [ ] **Step 3: Rewrite generate() with meter-aware beat grid**

Use the pseudocode from the spec: anchor beat grid to active meter entry's start tick, re-snap at meter boundaries.

- [ ] **Step 4: Update existing tests to use MeterMap**

Replace `new TickTimeline(960)` with `new MeterMap(960)` in test setup. Adjust constructor calls.

- [ ] **Step 5: Run all tests**

Run: `cd packages/transport && npx vitest run`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add packages/transport/src/audio/metronome-player.ts packages/transport/src/__tests__/metronome-player.test.ts
git commit -m "feat(transport): MetronomePlayer uses MeterMap for per-beat meter queries"
```

---

## Phase 3: Transport API

### Task 5: Wire MeterMap into Transport

**Files:**
- Modify: `packages/transport/src/transport.ts`
- Modify: `packages/transport/src/__tests__/transport.test.ts`

- [ ] **Step 1: Add MeterMap to Transport constructor, remove TickTimeline**

Replace `beatsPerBar` with `numerator`/`denominator`. Create `MeterMap` alongside `TempoMap`. Pass `MeterMap` to `MetronomePlayer` instead of `TickTimeline`. Remove `_tickTimeline` field and its import — `MeterMap` now provides `ppqn` and bar/beat info.

- [ ] **Step 2: Update _validateOptions for numerator/denominator**

Replace `beatsPerBar` validation with:
- `numerator`: positive integer 1-32
- `denominator`: power of 2, 1-32

- [ ] **Step 3: Expose setTempo atTick parameter**

```typescript
setTempo(bpm: number, atTick?: number): void {
  this._tempoMap.setTempo(bpm, atTick);
  this._emit('tempochange');
}

getTempo(atTick?: number): number {
  return this._tempoMap.getTempo(atTick);
}
```

- [ ] **Step 4: Add meter methods**

```typescript
setMeter(numerator: number, denominator: number, atTick?: number): void {
  this._meterMap.setMeter(numerator, denominator, atTick);
  this._emit('meterchange');
}

getMeter(atTick?: number): MeterSignature {
  return this._meterMap.getMeter(atTick);
}

removeMeter(atTick: number): void {
  this._meterMap.removeMeter(atTick);
  this._emit('meterchange');
}

barToTick(bar: number): number {
  return this._meterMap.barToTick(bar);
}
```

- [ ] **Step 5: Add 'meterchange' to TransportEvents**

```typescript
export interface TransportEvents {
  play: () => void;
  pause: () => void;
  stop: () => void;
  loop: () => void;
  tempochange: () => void;
  meterchange: () => void;
}
```

- [ ] **Step 6: Keep setBeatsPerBar as deprecated wrapper**

```typescript
/** @deprecated Use setMeter(beats, 4) instead */
setBeatsPerBar(beats: number): void {
  this.setMeter(beats, 4);
}
```

- [ ] **Step 7: Add transport tests**

```typescript
// Add to transport.test.ts

it('setTempo with atTick schedules tempo change', () => {
  const ctx = mockAudioContext();
  const transport = new Transport(ctx);
  transport.setTempo(140, 3840); // 140 BPM at bar 2
  expect(transport.getTempo(0)).toBe(120); // default
  expect(transport.getTempo(3840)).toBe(140);
});

it('setMeter changes time signature', () => {
  const ctx = mockAudioContext();
  const transport = new Transport(ctx);
  transport.setMeter(7, 8);
  const meter = transport.getMeter();
  expect(meter.numerator).toBe(7);
  expect(meter.denominator).toBe(8);
});

it('setMeter at tick fires meterchange event', () => {
  const ctx = mockAudioContext();
  const transport = new Transport(ctx);
  const onMeter = vi.fn();
  transport.on('meterchange', onMeter);
  transport.setMeter(3, 4, 3840);
  expect(onMeter).toHaveBeenCalledTimes(1);
});

it('barToTick delegates to MeterMap', () => {
  const ctx = mockAudioContext();
  const transport = new Transport(ctx);
  expect(transport.barToTick(1)).toBe(0);
  expect(transport.barToTick(2)).toBe(3840); // 4/4 default
});

it('setBeatsPerBar backwards compat calls setMeter', () => {
  const ctx = mockAudioContext();
  const transport = new Transport(ctx);
  transport.setBeatsPerBar(3);
  expect(transport.getMeter().numerator).toBe(3);
  expect(transport.getMeter().denominator).toBe(4);
});

it('removeMeter fires meterchange event', () => {
  const ctx = mockAudioContext();
  const transport = new Transport(ctx);
  transport.setMeter(7, 8, 3840);
  const onMeter = vi.fn();
  transport.on('meterchange', onMeter);
  transport.removeMeter(3840);
  expect(onMeter).toHaveBeenCalledTimes(1);
});

it('constructor accepts numerator/denominator options', () => {
  const ctx = mockAudioContext();
  const transport = new Transport(ctx, { numerator: 6, denominator: 8 });
  expect(transport.getMeter().numerator).toBe(6);
  expect(transport.getMeter().denominator).toBe(8);
});
```

- [ ] **Step 8: Run all tests + build**

Run: `cd packages/transport && npx vitest run && pnpm build`
Expected: All PASS, clean build

- [ ] **Step 9: Commit**

```bash
git add packages/transport/src/transport.ts packages/transport/src/__tests__/transport.test.ts packages/transport/src/types.ts
git commit -m "feat(transport): add setMeter/setTempo atTick to Transport API"
```

---

## Phase 4: Demo Update

### Task 6: Update metronome demo with preset sequences

**Files:**
- Modify: `packages/dawcore/dev/metronome.html`

- [ ] **Step 1: Add preset sequences section to the demo**

Add a "Sequences" section with buttons for preset 8-bar patterns:
- **Rock** — 4/4 at 120 BPM, 8 bars
- **Jazz Waltz** — 3/4 at 140 BPM, 8 bars
- **Progressive** — 4/4 4/4 7/8 7/8 4/4 4/4 3/4 3/4 at 100 BPM
- **Balkan** — 7/8 7/8 11/8 11/8 7/8 7/8 9/8 9/8 at 160 BPM
- **Mixed Tempo** — 4/4 at 120→140 BPM ramp over 8 bars

Each preset calls `transport.setMeter()` and `transport.setTempo()` at the appropriate tick positions using `transport.barToTick()`.

- [ ] **Step 2: Add loop for sequence playback**

Use `transport.setLoop(true, 0, endTick)` where `endTick = transport.barToTick(9)` (after bar 8).

- [ ] **Step 3: Update beat dots to use current meter**

Read `transport.getMeter()` in the animation tick to set the correct number of dots dynamically.

- [ ] **Step 4: Test manually**

Run: `cd packages/dawcore && pnpm dev:page`
Open: `http://localhost:5173/dev/metronome.html`
Verify: each preset plays correct rhythms, meter changes audible, dots sync

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/dev/metronome.html
git commit -m "feat(dawcore): add preset sequences to metronome demo"
```

---

### Task 7: Documentation

**Files:**
- Modify: `packages/transport/CLAUDE.md`
- Modify: `packages/transport/README.md`
- Modify: `packages/transport/TRANSPORT.md`

- [ ] **Step 1: Update CLAUDE.md with MeterMap patterns**
- [ ] **Step 2: Add meter API to README.md**
- [ ] **Step 3: Add meter section to TRANSPORT.md architecture guide**
- [ ] **Step 4: Commit**

```bash
git commit -m "docs(transport): add MeterMap documentation"
```
