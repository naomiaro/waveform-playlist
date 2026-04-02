# Multi-Meter Beat Maps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect meter changes from beat map files and render the grid with correct bar boundaries per meter region.

**Architecture:** Add `MeterEntry` type and `detectMeterChanges()` to core. Refactor `computeMusicalTicks` to accept `meterEntries` instead of `timeSignature`, walking segments per meter. Update all callers (daw-grid, daw-ruler, snap, cache). Wire detection into beat-map-grid demo.

**Tech Stack:** TypeScript, vitest, Lit web components, pnpm monorepo

**Spec:** `docs/specs/2026-04-01-multi-meter-beat-maps.md`

---

## File Map

| Package | File | Action | Responsibility |
|---------|------|--------|----------------|
| core | `src/utils/musicalTicks.ts` | Modify | Add `MeterEntry`, refactor `computeMusicalTicks` to accept `meterEntries`, rename `pixelsPerBeat`→`pixelsPerQuarterNote`, remove `pixelsPerBar`, remove `ticksToBarBeatLabel` usage, update `snapToTicks`/`snapTickToGrid` |
| core | `src/utils/beatsAndBars.ts` | Modify | Remove `ticksToBarBeatLabel` |
| core | `src/utils/meterDetection.ts` | Create | `detectMeterChanges()` function |
| core | `src/__tests__/meterDetection.test.ts` | Create | Tests for meter detection |
| core | `src/__tests__/musicalTicks.test.ts` | Modify | Update all tests to use `meterEntries` |
| core | `src/__tests__/beatsAndBars.test.ts` | Modify | Remove `ticksToBarBeatLabel` tests |
| core | `src/index.ts` | Modify | Export new types/functions |
| dawcore | `src/utils/musical-tick-cache.ts` | Modify | Update `paramsMatch` for `meterEntries` |
| dawcore | `src/__tests__/musical-tick-cache.test.ts` | Modify | Update tests for `meterEntries` |
| dawcore | `src/elements/daw-grid.ts` | Modify | Replace `timeSignature` prop with `meterEntries` |
| dawcore | `src/elements/daw-ruler.ts` | Modify | Replace `timeSignature` prop with `meterEntries` |
| dawcore | `src/elements/daw-editor.ts` | Modify | Pass `meterEntries` to grid/ruler |
| dawcore | `src/interactions/clip-pointer-handler.ts` | Modify | Update `snapTickToGrid` call |
| dawcore | `dev/beat-map-grid.html` | Modify | Call `detectMeterChanges`, apply to transport |

---

### Task 1: Add `MeterEntry` type and `detectMeterChanges` function

**Files:**
- Create: `packages/core/src/utils/meterDetection.ts`
- Create: `packages/core/src/__tests__/meterDetection.test.ts`
- Modify: `packages/core/src/index.ts`

- [ ] **Step 1: Write failing tests**

In `packages/core/src/__tests__/meterDetection.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { detectMeterChanges } from '../utils/meterDetection';
import type { MeterEntry } from '../utils/meterDetection';

describe('detectMeterChanges', () => {
  const ppqn = 960;
  const ticksPerBeat = ppqn;

  it('detects 4/4 throughout', () => {
    const beats = [
      { time: 0, beat: 1 },
      { time: 0.5, beat: 2 },
      { time: 1.0, beat: 3 },
      { time: 1.5, beat: 4 },
      { time: 2.0, beat: 1 },
      { time: 2.5, beat: 2 },
      { time: 3.0, beat: 3 },
      { time: 3.5, beat: 4 },
    ];
    const result = detectMeterChanges(beats, 0, ppqn);
    expect(result).toEqual([{ tick: 0, numerator: 4, denominator: 4 }]);
  });

  it('detects 3/4 throughout', () => {
    const beats = [
      { time: 0, beat: 1 },
      { time: 0.5, beat: 2 },
      { time: 1.0, beat: 3 },
      { time: 1.5, beat: 1 },
      { time: 2.0, beat: 2 },
      { time: 2.5, beat: 3 },
    ];
    const result = detectMeterChanges(beats, 0, ppqn);
    expect(result).toEqual([{ tick: 0, numerator: 3, denominator: 4 }]);
  });

  it('detects meter change from 4/4 to 3/4', () => {
    const beats = [
      { time: 0, beat: 1 },
      { time: 0.5, beat: 2 },
      { time: 1.0, beat: 3 },
      { time: 1.5, beat: 4 },
      { time: 2.0, beat: 1 }, // bar 2: switches to 3/4
      { time: 2.5, beat: 2 },
      { time: 3.0, beat: 3 },
      { time: 3.5, beat: 1 }, // bar 3 starts after 3 beats
    ];
    const result = detectMeterChanges(beats, 0, ppqn);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ tick: 0, numerator: 4, denominator: 4 });
    // Bar 2 starts at beat index 4 → tick 4 * 960 = 3840
    // But the first bar is 4/4 = 4 beats = 3840 ticks, so bar 2 at tick 3840
    expect(result[1].numerator).toBe(3);
    expect(result[1].denominator).toBe(4);
    expect(result[1].tick).toBe(4 * ticksPerBeat); // tick 3840
  });

  it('detects meter change from 3/4 to 4/4', () => {
    const beats = [
      { time: 0, beat: 1 },
      { time: 0.5, beat: 2 },
      { time: 1.0, beat: 3 },
      { time: 1.5, beat: 1 }, // bar 2: switches to 4/4
      { time: 2.0, beat: 2 },
      { time: 2.5, beat: 3 },
      { time: 3.0, beat: 4 },
      { time: 3.5, beat: 1 },
    ];
    const result = detectMeterChanges(beats, 0, ppqn);
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ tick: 0, numerator: 3, denominator: 4 });
    expect(result[1].numerator).toBe(4);
    expect(result[1].tick).toBe(3 * ticksPerBeat); // tick 2880
  });

  it('handles firstBeatTick offset', () => {
    const beats = [
      { time: 1.0, beat: 1 },
      { time: 1.5, beat: 2 },
      { time: 2.0, beat: 3 },
      { time: 2.5, beat: 4 },
      { time: 3.0, beat: 1 },
    ];
    // firstBeatTick = 3840 (beat 1 at bar 2)
    const result = detectMeterChanges(beats, 3840, ppqn);
    expect(result).toEqual([{ tick: 0, numerator: 4, denominator: 4 }]);
  });

  it('handles pickup beats before first downbeat', () => {
    const beats = [
      { time: 0, beat: 3 }, // pickup
      { time: 0.5, beat: 4 }, // pickup
      { time: 1.0, beat: 1 }, // downbeat
      { time: 1.5, beat: 2 },
      { time: 2.0, beat: 3 },
      { time: 2.5, beat: 4 },
      { time: 3.0, beat: 1 },
    ];
    const result = detectMeterChanges(beats, 1920, ppqn);
    // First detected meter is from the first full bar (4 beats)
    expect(result[0].numerator).toBe(4);
  });

  it('handles single beat (minimum input)', () => {
    const beats = [{ time: 0, beat: 1 }];
    const result = detectMeterChanges(beats, 0, ppqn);
    // Default to 4/4 when not enough beats to determine
    expect(result).toEqual([{ tick: 0, numerator: 4, denominator: 4 }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/core && npx vitest run src/__tests__/meterDetection.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `detectMeterChanges`**

Create `packages/core/src/utils/meterDetection.ts`:

```typescript
/**
 * A meter (time signature) entry at a tick position.
 */
export interface MeterEntry {
  tick: number;
  numerator: number;
  denominator: number;
}

/**
 * Detect meter changes from beat number sequences in a beat map.
 *
 * Scans beat numbers for downbeat resets (beat === 1). The number of beats
 * between consecutive downbeats determines the numerator. Denominator is
 * always 4 (quarter note beat unit) since beat maps don't encode beat unit.
 *
 * @param beats - Beat map entries with time (seconds) and beat number
 * @param firstBeatTick - Tick position of the first beat in the array
 * @param ppqn - Pulses per quarter note
 * @returns Array of MeterEntry sorted by tick, always includes tick 0
 */
export function detectMeterChanges(
  beats: { time: number; beat: number }[],
  firstBeatTick: number,
  ppqn: number
): MeterEntry[] {
  if (beats.length < 2) {
    return [{ tick: 0, numerator: 4, denominator: 4 }];
  }

  const ticksPerBeat = ppqn;
  const entries: MeterEntry[] = [];

  // Find downbeat positions (beat === 1)
  let currentMeter = 0; // beats per bar (0 = not yet determined)
  let beatsInCurrentBar = 0;
  let currentBarStartTick = firstBeatTick;

  for (let i = 0; i < beats.length; i++) {
    if (beats[i].beat === 1 && i > 0) {
      // Downbeat: the previous bar had beatsInCurrentBar beats
      if (beatsInCurrentBar !== currentMeter) {
        currentMeter = beatsInCurrentBar;
        entries.push({
          tick: currentBarStartTick,
          numerator: currentMeter,
          denominator: 4,
        });
      }
      currentBarStartTick += beatsInCurrentBar * ticksPerBeat;
      beatsInCurrentBar = 0;
    }
    beatsInCurrentBar++;
  }

  // If no meter entries yet (no second downbeat found), detect from first bar
  if (entries.length === 0) {
    // Count beats until first reset or end
    const firstDownbeat = beats.findIndex((b, i) => i > 0 && b.beat === 1);
    const beatsPerBar = firstDownbeat > 0 ? firstDownbeat : 4;
    entries.push({ tick: 0, numerator: beatsPerBar, denominator: 4 });
  }

  // Ensure tick 0 has an entry — use the first detected meter
  if (entries[0].tick !== 0) {
    entries.unshift({ tick: 0, numerator: entries[0].numerator, denominator: 4 });
  }

  return entries;
}
```

- [ ] **Step 4: Export from core index**

In `packages/core/src/index.ts`, add:

```typescript
export { detectMeterChanges } from './utils/meterDetection';
export type { MeterEntry } from './utils/meterDetection';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/__tests__/meterDetection.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/utils/meterDetection.ts packages/core/src/__tests__/meterDetection.test.ts packages/core/src/index.ts
git commit -m "feat(core): add MeterEntry type and detectMeterChanges function"
```

---

### Task 2: Refactor `computeMusicalTicks` for multi-meter

**Files:**
- Modify: `packages/core/src/utils/musicalTicks.ts`
- Modify: `packages/core/src/utils/beatsAndBars.ts`
- Modify: `packages/core/src/__tests__/musicalTicks.test.ts`
- Modify: `packages/core/src/__tests__/beatsAndBars.test.ts`

- [ ] **Step 1: Update `MusicalTickParams` and `MusicalTickData`**

In `packages/core/src/utils/musicalTicks.ts`:

Replace the `timeSignature` field in `MusicalTickParams`:

```typescript
import type { MeterEntry } from './meterDetection';
```

Change `MusicalTickParams`:
```typescript
export interface MusicalTickParams {
  meterEntries: MeterEntry[];
  ticksPerPixel: number;
  startPixel: number;
  endPixel: number;
  ppqn?: number;
}
```

Change `MusicalTickData`:
```typescript
export interface MusicalTickData {
  ticks: MusicalTick[];
  pixelsPerQuarterNote: number;
  zoomLevel: ZoomLevel;
  coarseBarStep?: number;
}
```

- [ ] **Step 2: Update `snapToTicks` and `snapTickToGrid`**

Change signatures to accept `meterEntries`:

```typescript
export function snapToTicks(snapTo: SnapTo, meterEntries: MeterEntry[], ppqn = 960): number {
  // Use the first meter entry for the snap grid size
  const meter = meterEntries[0] ?? { numerator: 4, denominator: 4 };
  const ts: [number, number] = [meter.numerator, meter.denominator];
  switch (snapTo) {
    case 'bar':
      return ticksPerBar(ts, ppqn);
    case 'beat':
      return ticksPerBeat(ts, ppqn);
    // ... rest unchanged
  }
}

export function snapTickToGrid(
  tick: number,
  snapTo: SnapTo,
  meterEntries: MeterEntry[],
  ppqn = 960
): number {
  if (snapTo === 'off') return tick;
  // Find the meter at this tick position
  let meter = meterEntries[0] ?? { numerator: 4, denominator: 4 };
  for (const entry of meterEntries) {
    if (entry.tick <= tick) meter = entry;
    else break;
  }
  const ts: [number, number] = [meter.numerator, meter.denominator];
  const gridSize = snapToTicks(snapTo, [{ tick: 0, numerator: ts[0], denominator: ts[1] }], ppqn);
  if (gridSize <= 0) return tick;
  // Snap relative to the meter entry's start tick for correct alignment
  const offset = tick - meter.tick;
  return meter.tick + Math.round(offset / gridSize) * gridSize;
}
```

- [ ] **Step 3: Rewrite `computeMusicalTicks`**

Replace the function body. The new version walks meter entries in segments:

```typescript
export function computeMusicalTicks(params: MusicalTickParams): MusicalTickData {
  const { meterEntries, ticksPerPixel, startPixel, endPixel, ppqn = 960 } = params;

  if (ticksPerPixel <= 0 || ppqn <= 0 || meterEntries.length === 0) {
    return { ticks: [], pixelsPerQuarterNote: 0, zoomLevel: 'coarse' };
  }

  const pixelsPerQuarterNote = ppqn / ticksPerPixel;

  // Zoom level from quarter note density (meter-independent)
  let zoomLevel: ZoomLevel;
  const pxPerEighth = (ppqn / 2) / ticksPerPixel;
  const pxPerSixteenth = (ppqn / 4) / ticksPerPixel;
  // Use the first meter for bar/beat thresholds
  const firstMeter = meterEntries[0];
  const firstTs: [number, number] = [firstMeter.numerator, firstMeter.denominator];
  const firstTpBar = ticksPerBar(firstTs, ppqn);
  const firstTpBeat = ticksPerBeat(firstTs, ppqn);
  const pxPerBar = firstTpBar / ticksPerPixel;
  const pxPerBeat = firstTpBeat / ticksPerPixel;

  if (pxPerBar < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'coarse';
  } else if (pxPerBeat < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'bar';
  } else if (pxPerEighth < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'beat';
  } else if (pxPerSixteenth < MIN_PIXELS_PER_UNIT) {
    zoomLevel = 'eighth';
  } else {
    zoomLevel = 'sixteenth';
  }

  const startTick = startPixel * ticksPerPixel;
  const endTick = endPixel * ticksPerPixel;

  const ticks: MusicalTick[] = [];
  let cumulativeBar = 0; // running bar count across meter changes

  for (let mIdx = 0; mIdx < meterEntries.length; mIdx++) {
    const meter = meterEntries[mIdx];
    const ts: [number, number] = [meter.numerator, meter.denominator];
    const tpBeat = ticksPerBeat(ts, ppqn);
    const tpBar = ticksPerBar(ts, ppqn);

    // Segment range: from this meter's tick to the next meter's tick (or endTick)
    const segStart = meter.tick;
    const segEnd = mIdx + 1 < meterEntries.length ? meterEntries[mIdx + 1].tick : endTick + ticksPerPixel;

    // Step size for this segment
    let stepTicks: number;
    let coarseBarStep: number | undefined;

    if (zoomLevel === 'coarse') {
      let multiplier = 2;
      while ((tpBar * multiplier) / ticksPerPixel < MIN_PIXELS_PER_UNIT) {
        multiplier *= 2;
      }
      stepTicks = tpBar * multiplier;
      coarseBarStep = multiplier;
    } else if (zoomLevel === 'bar') {
      stepTicks = tpBar;
    } else if (zoomLevel === 'beat') {
      stepTicks = tpBeat;
    } else if (zoomLevel === 'eighth') {
      stepTicks = ppqn / 2;
    } else {
      stepTicks = ppqn / 4;
    }

    // Align first step to step boundary relative to segment start
    const firstStep = segStart + Math.floor(Math.max(0, startTick - segStart) / stepTicks) * stepTicks;

    for (let tick = firstStep; tick < segEnd && tick <= endTick; tick += stepTicks) {
      const pixel = tick / ticksPerPixel;
      if (pixel < startPixel || pixel > endPixel) continue;

      // Classify tick relative to THIS meter's bar/beat boundaries
      const tickInSegment = tick - segStart;
      let type: TickType;
      if (tickInSegment % tpBar === 0) {
        type = 'major';
      } else if (tickInSegment % tpBeat === 0) {
        type = 'minor';
      } else {
        type = 'minorMinor';
      }

      // Bar index: cumulative bars from previous segments + bars in this segment
      const barIndex = cumulativeBar + Math.floor(tickInSegment / tpBar);

      // Label: bar.beat computed from cumulative bar count
      let label: string | undefined;
      if (type === 'major') {
        const barNum = barIndex + 1;
        label = `${barNum}`;
      } else if (type === 'minor' && pxPerBeat >= MIN_PIXELS_PER_LABEL) {
        const barNum = cumulativeBar + Math.floor(tickInSegment / tpBar) + 1;
        const beatInBar = Math.floor((tickInSegment % tpBar) / tpBeat) + 1;
        label = `${barNum}.${beatInBar}`;
      }

      ticks.push({ pixel, type, barIndex, ...(label !== undefined ? { label } : {}) });
    }

    // Accumulate bar count for this segment
    if (mIdx + 1 < meterEntries.length) {
      const segmentTicks = meterEntries[mIdx + 1].tick - segStart;
      cumulativeBar += Math.floor(segmentTicks / tpBar);
    }
  }

  const result: MusicalTickData = {
    ticks,
    pixelsPerQuarterNote,
    zoomLevel,
    ...(zoomLevel === 'coarse' ? { coarseBarStep: ticks.length > 0 ? undefined : undefined } : {}),
  };

  // Compute coarseBarStep from the first meter
  if (zoomLevel === 'coarse') {
    let multiplier = 2;
    while ((firstTpBar * multiplier) / ticksPerPixel < MIN_PIXELS_PER_UNIT) {
      multiplier *= 2;
    }
    result.coarseBarStep = multiplier;
  }

  return result;
}
```

- [ ] **Step 4: Remove `ticksToBarBeatLabel` from `beatsAndBars.ts`**

In `packages/core/src/utils/beatsAndBars.ts`, remove the `ticksToBarBeatLabel` function (lines 41-53). Also remove its import from `musicalTicks.ts` (line 1).

- [ ] **Step 5: Update `beatsAndBars.test.ts`**

In `packages/core/src/__tests__/beatsAndBars.test.ts`, remove all `ticksToBarBeatLabel` tests. Keep the other tests (`ticksPerBeat`, `ticksPerBar`, `ticksToSamples`, `samplesToTicks`, `snapToGrid`).

- [ ] **Step 6: Update `musicalTicks.test.ts`**

Update all tests to use `meterEntries` instead of `timeSignature`. Replace `pixelsPerBeat`/`pixelsPerBar` assertions with `pixelsPerQuarterNote`. Update `snapToTicks`/`snapTickToGrid` test calls to pass `meterEntries`.

Example update for the existing `computeMusicalTicks` test:

```typescript
// Before:
const result = computeMusicalTicks({
  timeSignature: [4, 4],
  ticksPerPixel: 100,
  startPixel: 0,
  endPixel: 1000,
  ppqn: 960,
});

// After:
const result = computeMusicalTicks({
  meterEntries: [{ tick: 0, numerator: 4, denominator: 4 }],
  ticksPerPixel: 100,
  startPixel: 0,
  endPixel: 1000,
  ppqn: 960,
});
```

Replace `result.pixelsPerBeat` with `result.pixelsPerQuarterNote` (value = `960 / ticksPerPixel`).
Replace `result.pixelsPerBar` assertions — remove them (field no longer exists).

Add new test for multi-meter:

```typescript
it('handles meter change from 4/4 to 3/4', () => {
  const result = computeMusicalTicks({
    meterEntries: [
      { tick: 0, numerator: 4, denominator: 4 },
      { tick: 3840, numerator: 3, denominator: 4 },
    ],
    ticksPerPixel: 100,
    startPixel: 0,
    endPixel: 1000,
    ppqn: 960,
  });
  // Bar 1 (4/4): major ticks at 0, 3840
  // Bar 2 (3/4): major ticks at 3840, 6720 (3840 + 2880)
  const majors = result.ticks.filter(t => t.type === 'major');
  expect(majors.length).toBeGreaterThan(0);
  expect(majors[0].pixel).toBeCloseTo(0);
  // Bar 2 at tick 3840 = pixel 38.4
  const bar2 = majors.find(t => Math.abs(t.pixel - 38.4) < 0.1);
  expect(bar2).toBeDefined();
  expect(bar2!.label).toBe('2');
});
```

- [ ] **Step 7: Run all core tests**

Run: `cd packages/core && npx vitest run`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add packages/core/src/utils/musicalTicks.ts packages/core/src/utils/beatsAndBars.ts packages/core/src/__tests__/musicalTicks.test.ts packages/core/src/__tests__/beatsAndBars.test.ts
git commit -m "feat(core): refactor computeMusicalTicks for multi-meter support

Replace timeSignature with meterEntries array. Remove pixelsPerBar
and pixelsPerBeat, add pixelsPerQuarterNote. Remove ticksToBarBeatLabel
(labels computed inline). Update snapToTicks/snapTickToGrid to accept
meterEntries."
```

---

### Task 3: Update dawcore callers

**Files:**
- Modify: `packages/dawcore/src/utils/musical-tick-cache.ts`
- Modify: `packages/dawcore/src/__tests__/musical-tick-cache.test.ts`
- Modify: `packages/dawcore/src/elements/daw-grid.ts`
- Modify: `packages/dawcore/src/elements/daw-ruler.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts`
- Modify: `packages/dawcore/src/interactions/clip-pointer-handler.ts`
- Modify: `packages/dawcore/src/__tests__/clip-pointer-handler.test.ts`
- Modify: `packages/dawcore/src/__tests__/pointer-handler.test.ts`

- [ ] **Step 1: Update `musical-tick-cache.ts`**

Replace `timeSignature` matching with `meterEntries` matching:

```typescript
import { computeMusicalTicks } from '@waveform-playlist/core';
import type { MusicalTickParams, MusicalTickData } from '@waveform-playlist/core';

let cachedParams: MusicalTickParams | null = null;
let cachedResult: MusicalTickData | null = null;

function meterEntriesMatch(
  a: { tick: number; numerator: number; denominator: number }[],
  b: { tick: number; numerator: number; denominator: number }[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].tick !== b[i].tick || a[i].numerator !== b[i].numerator || a[i].denominator !== b[i].denominator) {
      return false;
    }
  }
  return true;
}

function paramsMatch(a: MusicalTickParams, b: MusicalTickParams): boolean {
  return (
    a.ticksPerPixel === b.ticksPerPixel &&
    a.startPixel === b.startPixel &&
    a.endPixel === b.endPixel &&
    meterEntriesMatch(a.meterEntries, b.meterEntries) &&
    (a.ppqn ?? 960) === (b.ppqn ?? 960)
  );
}

export function getCachedMusicalTicks(params: MusicalTickParams): MusicalTickData {
  if (cachedParams && cachedResult && paramsMatch(cachedParams, params)) {
    return cachedResult;
  }
  cachedResult = computeMusicalTicks(params);
  cachedParams = { ...params, meterEntries: params.meterEntries.map(e => ({ ...e })) };
  return cachedResult;
}

export function clearMusicalTickCache(): void {
  cachedParams = null;
  cachedResult = null;
}
```

- [ ] **Step 2: Update `daw-grid.ts`**

Replace `timeSignature` property with `meterEntries`:

```typescript
// Change property declaration:
@property({ attribute: false }) meterEntries: MeterEntry[] = [{ tick: 0, numerator: 4, denominator: 4 }];

// Update willUpdate():
this._tickData = getCachedMusicalTicks({
  ticksPerPixel: this.ticksPerPixel,
  meterEntries: this.meterEntries,
  ppqn: this.ppqn,
  startPixel: 0,
  endPixel: this.length,
});
```

Add import: `import type { MeterEntry } from '@waveform-playlist/core';`

For zebra stripes, replace `pixelsPerBar` usage. Instead of checking `pixelsPerBar >= MIN_PIXELS_PER_UNIT`, check `pixelsPerQuarterNote * firstMeter.numerator >= MIN_PIXELS_PER_UNIT` (approximate). For the last bar extent, use the next major tick's pixel position instead of `x + pixelsPerBar`:

```typescript
const { ticks, pixelsPerQuarterNote } = this._tickData;
// ...
// Zebra stripes
const firstMeter = this.meterEntries[0] ?? { numerator: 4, denominator: 4 };
const approxPixelsPerBar = pixelsPerQuarterNote * firstMeter.numerator;
if (approxPixelsPerBar >= MIN_PIXELS_PER_UNIT) {
  ctx.fillStyle = barHighlight;
  const majorTicks = ticks.filter((t) => t.type === 'major');
  for (let i = 0; i < majorTicks.length; i++) {
    if (majorTicks[i].barIndex % 2 === 1) {
      const x = majorTicks[i].pixel - chunkLeft;
      const nextX =
        i + 1 < majorTicks.length
          ? majorTicks[i + 1].pixel - chunkLeft
          : x + approxPixelsPerBar;
      ctx.fillRect(x, 0, nextX - x, this.height);
    }
  }
}
```

- [ ] **Step 3: Update `daw-ruler.ts`**

Replace `timeSignature` property with `meterEntries` and update `getCachedMusicalTicks` call.

- [ ] **Step 4: Update `daw-editor.ts`**

Replace `.timeSignature=${this.timeSignature}` with `.meterEntries=${this._meterEntries}` on `<daw-grid>` and `<daw-ruler>`.

Add a `_meterEntries` getter or computed property:

```typescript
private get _meterEntries(): MeterEntry[] {
  // Default: single entry from timeSignature
  return [{ tick: 0, numerator: this.timeSignature[0], denominator: this.timeSignature[1] }];
}
```

This keeps the editor's existing `timeSignature` property working for non-beat-map use. The beat-map-grid demo can set a more specific property later.

- [ ] **Step 5: Update `clip-pointer-handler.ts`**

Change the `snapTickToGrid` call to pass `meterEntries`:

```typescript
// Before:
snapTickToGrid(targetTick, h.snapTo, h.timeSignature, h.ppqn)

// After:
snapTickToGrid(targetTick, h.snapTo, [{ tick: 0, numerator: h.timeSignature[0], denominator: h.timeSignature[1] }], h.ppqn)
```

Or if the host gains a `meterEntries` property, use that.

- [ ] **Step 6: Update `musical-tick-cache.test.ts`**

Update all test params from `timeSignature: [4, 4]` to `meterEntries: [{ tick: 0, numerator: 4, denominator: 4 }]`. Remove `pixelsPerBar`/`pixelsPerBeat` assertions.

- [ ] **Step 7: Update `clip-pointer-handler.test.ts` and `pointer-handler.test.ts`**

Update mock host objects to replace `timeSignature` with `meterEntries` if the interface changes, or keep `timeSignature` if it's still on the host (the host converts to `meterEntries` at the call site).

- [ ] **Step 8: Typecheck and test**

Run: `cd packages/core && npx vitest run && pnpm typecheck`
Run: `cd packages/dawcore && npx vitest run && pnpm typecheck`
Expected: All pass

- [ ] **Step 9: Commit**

```bash
git add packages/dawcore/src/ packages/core/src/
git commit -m "feat(dawcore): update callers to use meterEntries

daw-grid, daw-ruler, clip-pointer-handler, and musical-tick-cache
updated to pass meterEntries instead of timeSignature. Editor derives
meterEntries from its timeSignature property for single-meter compat."
```

---

### Task 4: Wire meter detection into beat-map-grid demo

**Files:**
- Modify: `packages/dawcore/dev/beat-map-grid.html`

- [ ] **Step 1: Import `detectMeterChanges` and update `buildTempoCurve`**

In `beat-map-grid.html`, add to the script imports:

```javascript
import { detectMeterChanges } from '@waveform-playlist/core';
```

In `buildTempoCurve`, after building tempo events, detect meter changes:

```javascript
// After the tempo event loop:
const meterChanges = detectMeterChanges(beats, firstBeatTick, ppqn);
return { medianBpm, tempoEvents, totalBeats: beats.length, firstBeatTick, clipStartTick, meterChanges };
```

- [ ] **Step 2: Apply meter changes in `applyTempoCurve`**

Update `applyTempoCurve` to apply detected meters to the transport:

```javascript
function applyTempoCurve(curve) {
  lastCurve = curve;
  applyTempoToTransport(transport, curve);

  // Apply detected meter changes
  for (const meter of curve.meterChanges) {
    transport.setMeter(meter.numerator, meter.denominator, meter.tick);
  }

  editor.secondsToTicks = (s) => transport.timeToTick(s);
  editor.ticksToSeconds = (t) => transport.tickToTime(t);
  editor.bpm = Math.round(curve.medianBpm);
}
```

Also apply to the editor transport in `applyTempoToEditorTransport`:

```javascript
function applyTempoToEditorTransport() {
  const editorTransport = editor.transport;
  if (!editorTransport || !lastCurve) return;
  applyTempoToTransport(editorTransport, lastCurve);
  for (const meter of lastCurve.meterChanges) {
    editorTransport.setMeter(meter.numerator, meter.denominator, meter.tick);
  }
  editor.secondsToTicks = (s) => editorTransport.timeToTick(s);
  editor.ticksToSeconds = (t) => editorTransport.tickToTime(t);
}
```

- [ ] **Step 3: Log detected meters**

Add to the debug logging after loading:

```javascript
addLog('meters: ' + lastCurve.meterChanges.map(m => m.numerator + '/' + m.denominator + ' @tick ' + m.tick).join(', '));
```

- [ ] **Step 4: Test manually**

Run: `pnpm dev:page` from `packages/dawcore`
- Drop a 4/4 song + beats → grid should show 4/4 bars
- Drop a 3/4 song + beats → grid should show 3/4 bars
- Drop a song with meter changes → grid should show different bar widths

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/dev/beat-map-grid.html
git commit -m "feat(dawcore): wire meter detection into beat-map-grid demo

detectMeterChanges extracts time signature changes from beat number
sequences. Applied to both demo and editor transports. Grid renders
correct bar widths per meter region."
```

---

### Task 5: Build, lint, cleanup

- [ ] **Step 1: Build all packages**

Run: `pnpm build`
Expected: All pass

- [ ] **Step 2: Run all tests**

Run: `cd packages/core && npx vitest run && cd ../engine && npx vitest run && cd ../transport && npx vitest run && cd ../dawcore && npx vitest run`
Expected: All pass

- [ ] **Step 3: Lint**

Run: `pnpm lint`
Expected: 0 errors

- [ ] **Step 4: Fix formatting if needed**

Run: `pnpm format` then re-check `pnpm lint`

- [ ] **Step 5: Remove spec file**

```bash
git rm docs/specs/2026-04-01-multi-meter-beat-maps.md docs/superpowers/plans/2026-04-01-multi-meter-beat-maps.md
git commit -m "chore: remove spec and plan files"
```

---

## Post-Implementation Notes

**What this enables:**
- Songs with meter changes (prog rock, film scores) display correct grid
- Beat map demo auto-detects meter from beat number patterns
- Foundation for multi-meter editing (snap-to-grid already accounts for local meter)

**Future work:**
- UI indication of meter changes on the ruler
- Manual meter insertion (not just beat-map detection)
- MetronomePlayer accent pattern changes at meter boundaries (already supported by MeterMap)
