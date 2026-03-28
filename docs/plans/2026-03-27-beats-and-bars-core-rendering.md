# Beats & Bars Core Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a tick-linear beats & bars grid, ruler mode, and snap utility to dawcore.

**Architecture:** Pure tick computation in `@waveform-playlist/core` (reusable). Thin cache + new `<daw-grid>` element + ruler extension in `@dawcore/components`. Editor orchestrates via `scale-mode` attribute. Engine stays in seconds — beats mode is a UI coordinate transform.

**Tech Stack:** Lit 3, TypeScript, vitest, Canvas API, `@waveform-playlist/core` utilities

**Spec:** `docs/specs/2026-03-27-beats-and-bars-core-rendering.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `packages/core/src/utils/musicalTicks.ts` | `SnapTo` type, `snapToTicks()`, `snapTickToGrid()`, `computeMusicalTicks()`, output types |
| `packages/core/src/__tests__/musicalTicks.test.ts` | Tests for all new core functions |
| `packages/dawcore/src/utils/musical-tick-cache.ts` | One-slot memoization for `computeMusicalTicks()` |
| `packages/dawcore/src/elements/daw-grid.ts` | `<daw-grid>` element — chunked canvas with stripes + lines |
| `packages/dawcore/src/__tests__/daw-grid.test.ts` | Grid element tests |
| `packages/dawcore/dev/beats-grid.html` | Dev page (already created) |

### Modified Files

| File | Changes |
|------|---------|
| `packages/core/src/utils/index.ts` | Add `export * from './musicalTicks'` |
| `packages/core/src/types/index.ts` | Re-export `SnapTo` type |
| `packages/dawcore/src/index.ts` | Import/register `<daw-grid>`, export `DawGridElement` |
| `packages/dawcore/src/elements/daw-editor.ts` | New properties (`scaleMode`, `ticksPerPixel`, `bpm`, `timeSignature`, `snapTo`), property flow to ruler/grid/playhead, `_totalWidth` beats branch, track row transparency CSS |
| `packages/dawcore/src/elements/daw-ruler.ts` | New properties (`scaleMode`, `ticksPerPixel`, `timeSignature`, `ppqn`, `totalWidth`), beats mode rendering branch |
| `packages/dawcore/src/elements/daw-playhead.ts` | New `startBeatsAnimation()` / `stopBeatsAnimation()` methods for tick-space positioning |
| `packages/dawcore/src/interactions/pointer-handler.ts` | Snap pipeline for seek and selection in beats mode |

---

## Task 1: `SnapTo` Type and `snapToTicks()` Function

**Files:**
- Create: `packages/core/src/utils/musicalTicks.ts`
- Create: `packages/core/src/__tests__/musicalTicks.test.ts`
- Modify: `packages/core/src/utils/index.ts`

- [ ] **Step 1: Write failing tests for `snapToTicks()`**

```typescript
// packages/core/src/__tests__/musicalTicks.test.ts
import { describe, it, expect } from 'vitest';
import { snapToTicks } from '../utils/musicalTicks';

describe('snapToTicks', () => {
  describe('4/4 at 960 PPQN', () => {
    const ts: [number, number] = [4, 4];
    const ppqn = 960;

    it('bar returns 3840', () => expect(snapToTicks('bar', ts, ppqn)).toBe(3840));
    it('beat returns 960', () => expect(snapToTicks('beat', ts, ppqn)).toBe(960));
    it('1/2 returns 1920', () => expect(snapToTicks('1/2', ts, ppqn)).toBe(1920));
    it('1/4 returns 960', () => expect(snapToTicks('1/4', ts, ppqn)).toBe(960));
    it('1/8 returns 480', () => expect(snapToTicks('1/8', ts, ppqn)).toBe(480));
    it('1/16 returns 240', () => expect(snapToTicks('1/16', ts, ppqn)).toBe(240));
    it('1/32 returns 120', () => expect(snapToTicks('1/32', ts, ppqn)).toBe(120));
    it('1/2T returns 1280', () => expect(snapToTicks('1/2T', ts, ppqn)).toBe(1280));
    it('1/4T returns 640', () => expect(snapToTicks('1/4T', ts, ppqn)).toBe(640));
    it('1/8T returns 320', () => expect(snapToTicks('1/8T', ts, ppqn)).toBe(320));
    it('1/16T returns 160', () => expect(snapToTicks('1/16T', ts, ppqn)).toBe(160));
    it('off returns 0', () => expect(snapToTicks('off', ts, ppqn)).toBe(0));
  });

  describe('6/8 at 960 PPQN', () => {
    const ts: [number, number] = [6, 8];
    const ppqn = 960;

    it('bar returns 2880', () => expect(snapToTicks('bar', ts, ppqn)).toBe(2880));
    it('beat returns 480', () => expect(snapToTicks('beat', ts, ppqn)).toBe(480));
    it('1/8 returns 480', () => expect(snapToTicks('1/8', ts, ppqn)).toBe(480));
    it('1/16 returns 240', () => expect(snapToTicks('1/16', ts, ppqn)).toBe(240));
  });

  describe('3/4 at 960 PPQN', () => {
    const ts: [number, number] = [3, 4];
    const ppqn = 960;

    it('bar returns 2880', () => expect(snapToTicks('bar', ts, ppqn)).toBe(2880));
    it('beat returns 960', () => expect(snapToTicks('beat', ts, ppqn)).toBe(960));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/__tests__/musicalTicks.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `SnapTo` type and `snapToTicks()`**

```typescript
// packages/core/src/utils/musicalTicks.ts

export type SnapTo =
  | 'bar'
  | 'beat'
  | '1/2' | '1/4' | '1/8' | '1/16' | '1/32'
  | '1/2T' | '1/4T' | '1/8T' | '1/16T'
  | 'off';

/**
 * Convert a SnapTo value to its tick interval.
 * Returns 0 for 'off'.
 */
export function snapToTicks(
  snapTo: SnapTo,
  timeSignature: [number, number],
  ppqn = 960
): number {
  if (snapTo === 'off') return 0;

  const ticksPerQuarter = ppqn;
  const [numerator, denominator] = timeSignature;
  const beatsPerBar = ppqn * (4 / denominator);
  const barTicks = numerator * beatsPerBar;

  const map: Record<Exclude<SnapTo, 'off'>, number> = {
    'bar': barTicks,
    'beat': beatsPerBar,
    '1/2': ticksPerQuarter * 2,
    '1/4': ticksPerQuarter,
    '1/8': ticksPerQuarter / 2,
    '1/16': ticksPerQuarter / 4,
    '1/32': ticksPerQuarter / 8,
    '1/2T': ticksPerQuarter * 2 * (2 / 3),
    '1/4T': ticksPerQuarter * (2 / 3),
    '1/8T': (ticksPerQuarter / 2) * (2 / 3),
    '1/16T': (ticksPerQuarter / 4) * (2 / 3),
  };

  return map[snapTo];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/__tests__/musicalTicks.test.ts`
Expected: PASS (all 18 tests)

- [ ] **Step 5: Export from core utils**

Add to `packages/core/src/utils/index.ts`:
```typescript
export * from './musicalTicks';
```

- [ ] **Step 6: Commit**

```bash
git add packages/core/src/utils/musicalTicks.ts packages/core/src/__tests__/musicalTicks.test.ts packages/core/src/utils/index.ts
git commit -m "feat(core): add SnapTo type and snapToTicks utility"
```

---

## Task 2: `snapTickToGrid()` Function

**Files:**
- Modify: `packages/core/src/utils/musicalTicks.ts`
- Modify: `packages/core/src/__tests__/musicalTicks.test.ts`

- [ ] **Step 1: Write failing tests**

Append to `packages/core/src/__tests__/musicalTicks.test.ts`:
```typescript
import { snapTickToGrid } from '../utils/musicalTicks';

describe('snapTickToGrid', () => {
  const ts: [number, number] = [4, 4];
  const ppqn = 960;

  it('snaps to nearest beat', () => {
    expect(snapTickToGrid(500, 'beat', ts, ppqn)).toBe(480);
  });

  it('snaps up when closer to next beat', () => {
    expect(snapTickToGrid(800, 'beat', ts, ppqn)).toBe(960);
  });

  it('returns exact value when on grid', () => {
    expect(snapTickToGrid(960, 'beat', ts, ppqn)).toBe(960);
  });

  it('returns original tick when snap is off', () => {
    expect(snapTickToGrid(500, 'off', ts, ppqn)).toBe(500);
  });

  it('snaps to bar boundaries', () => {
    expect(snapTickToGrid(2000, 'bar', ts, ppqn)).toBe(1920);
  });

  it('snaps to nearest 1/16', () => {
    expect(snapTickToGrid(250, '1/16', ts, ppqn)).toBe(240);
  });

  it('snaps to nearest triplet', () => {
    // 1/8T = 320 ticks. 500 / 320 = 1.5625 rounds to 2 = 640
    expect(snapTickToGrid(500, '1/8T', ts, ppqn)).toBe(640);
  });

  it('snaps tick 0 to 0', () => {
    expect(snapTickToGrid(0, 'beat', ts, ppqn)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/__tests__/musicalTicks.test.ts`
Expected: FAIL — `snapTickToGrid` not found

- [ ] **Step 3: Implement `snapTickToGrid()`**

Append to `packages/core/src/utils/musicalTicks.ts`:
```typescript
/**
 * Snap a tick position to the nearest grid boundary.
 * Returns the original tick if snapTo is 'off'.
 */
export function snapTickToGrid(
  tick: number,
  snapTo: SnapTo,
  timeSignature: [number, number],
  ppqn = 960
): number {
  const gridSize = snapToTicks(snapTo, timeSignature, ppqn);
  if (gridSize === 0) return tick;
  return Math.round(tick / gridSize) * gridSize;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/__tests__/musicalTicks.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/utils/musicalTicks.ts packages/core/src/__tests__/musicalTicks.test.ts
git commit -m "feat(core): add snapTickToGrid utility"
```

---

## Task 3: `computeMusicalTicks()` — Types and Zoom Level Detection

**Files:**
- Modify: `packages/core/src/utils/musicalTicks.ts`
- Modify: `packages/core/src/__tests__/musicalTicks.test.ts`

- [ ] **Step 1: Write failing tests for zoom level detection**

Append to `packages/core/src/__tests__/musicalTicks.test.ts`:
```typescript
import { computeMusicalTicks } from '../utils/musicalTicks';

describe('computeMusicalTicks', () => {
  const ts: [number, number] = [4, 4];
  const ppqn = 960;

  describe('zoom level detection', () => {
    it('returns coarse when pixelsPerBar < 8', () => {
      // ticksPerBar = 3840. For pixelsPerBar < 8: ticksPerPixel > 480
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 500,
        startPixel: 0, endPixel: 100, ppqn,
      });
      expect(result.zoomLevel).toBe('coarse');
    });

    it('returns bar when pixelsPerBar >= 8 but pixelsPerBeat < 8', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 200,
        startPixel: 0, endPixel: 100, ppqn,
      });
      expect(result.zoomLevel).toBe('bar');
    });

    it('returns beat when pixelsPerBeat >= 8 but pixelsPerEighth < 8', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 100,
        startPixel: 0, endPixel: 200, ppqn,
      });
      expect(result.zoomLevel).toBe('beat');
    });

    it('returns eighth when pixelsPerEighth >= 8 but pixelsPerSixteenth < 8', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 40,
        startPixel: 0, endPixel: 200, ppqn,
      });
      expect(result.zoomLevel).toBe('eighth');
    });

    it('returns sixteenth when pixelsPerSixteenth >= 8', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 10,
        startPixel: 0, endPixel: 200, ppqn,
      });
      expect(result.zoomLevel).toBe('sixteenth');
    });
  });

  describe('pixelsPerBar and pixelsPerBeat', () => {
    it('returns correct constant values', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 4,
        startPixel: 0, endPixel: 2000, ppqn,
      });
      expect(result.pixelsPerBeat).toBe(240);
      expect(result.pixelsPerBar).toBe(960);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/core && npx vitest run src/__tests__/musicalTicks.test.ts`
Expected: FAIL — `computeMusicalTicks` not found

- [ ] **Step 3: Add types and `computeMusicalTicks()` with zoom detection**

Append to `packages/core/src/utils/musicalTicks.ts`:
```typescript
import { ticksToBarBeatLabel } from './beatsAndBars';

export type TickLevel = 'bar' | 'beat' | 'eighth' | 'sixteenth';
export type ZoomLevel = 'coarse' | 'bar' | 'beat' | 'eighth' | 'sixteenth';

export interface MusicalTick {
  pixel: number;
  level: TickLevel;
  label?: string;
  index: number;
}

export interface MusicalTickData {
  ticks: MusicalTick[];
  pixelsPerBar: number;
  pixelsPerBeat: number;
  zoomLevel: ZoomLevel;
  coarseBarStep?: number;
}

export interface MusicalTickParams {
  timeSignature: [number, number];
  ticksPerPixel: number;
  startPixel: number;
  endPixel: number;
  ppqn?: number;
}

const MIN_PX_PER_UNIT = 8;

export function computeMusicalTicks(params: MusicalTickParams): MusicalTickData {
  const { timeSignature, ticksPerPixel, startPixel, endPixel, ppqn: ppqnParam } = params;
  const ppqn = ppqnParam ?? 960;
  const [numerator, denominator] = timeSignature;

  const tpBeat = ppqn * (4 / denominator);
  const tpBar = numerator * tpBeat;
  const tpEighth = ppqn / 2;
  const tpSixteenth = ppqn / 4;

  const pixelsPerBeat = tpBeat / ticksPerPixel;
  const pixelsPerBar = tpBar / ticksPerPixel;
  const pixelsPerEighth = tpEighth / ticksPerPixel;
  const pixelsPerSixteenth = tpSixteenth / ticksPerPixel;

  let zoomLevel: ZoomLevel;
  if (pixelsPerBar < MIN_PX_PER_UNIT) zoomLevel = 'coarse';
  else if (pixelsPerBeat < MIN_PX_PER_UNIT) zoomLevel = 'bar';
  else if (pixelsPerEighth < MIN_PX_PER_UNIT) zoomLevel = 'beat';
  else if (pixelsPerSixteenth < MIN_PX_PER_UNIT) zoomLevel = 'eighth';
  else zoomLevel = 'sixteenth';

  // Determine finest subdivision to iterate at
  let stepTicks: number;
  let coarseBarStep: number | undefined;
  if (zoomLevel === 'sixteenth') stepTicks = tpSixteenth;
  else if (zoomLevel === 'eighth') stepTicks = tpEighth;
  else if (zoomLevel === 'beat') stepTicks = tpBeat;
  else if (zoomLevel === 'bar') stepTicks = tpBar;
  else {
    coarseBarStep = Math.ceil(MIN_PX_PER_UNIT / pixelsPerBar);
    stepTicks = tpBar * coarseBarStep;
  }

  // Convert pixel range to tick range and align to step boundary
  const startTick = Math.floor(startPixel * ticksPerPixel);
  const endTick = Math.ceil(endPixel * ticksPerPixel);
  const firstTick = Math.floor(startTick / stepTicks) * stepTicks;

  const ticks: MusicalTick[] = [];

  for (let tick = firstTick; tick <= endTick; tick += stepTicks) {
    const pixel = tick / ticksPerPixel;
    if (pixel < startPixel || pixel > endPixel) continue;

    // Classify this tick's level
    let level: TickLevel;
    if (tick % tpBar === 0) level = 'bar';
    else if (tick % tpBeat === 0) level = 'beat';
    else if (tick % tpEighth === 0) level = 'eighth';
    else level = 'sixteenth';

    // Global index at the classified level (for odd/even striping)
    let index: number;
    if (level === 'bar') index = tick / tpBar;
    else if (level === 'beat') index = tick / tpBeat;
    else if (level === 'eighth') index = tick / tpEighth;
    else index = tick / tpSixteenth;

    // Labels: bar lines always, beat lines at beat zoom or finer
    let label: string | undefined;
    if (level === 'bar') {
      label = ticksToBarBeatLabel(tick, timeSignature, ppqn);
    } else if (level === 'beat' && zoomLevel !== 'bar') {
      label = ticksToBarBeatLabel(tick, timeSignature, ppqn);
    }

    ticks.push({ pixel, level, label, index });
  }

  const result: MusicalTickData = { ticks, pixelsPerBar, pixelsPerBeat, zoomLevel };
  if (coarseBarStep !== undefined) result.coarseBarStep = coarseBarStep;
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/core && npx vitest run src/__tests__/musicalTicks.test.ts`
Expected: PASS (all tests)

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/utils/musicalTicks.ts packages/core/src/__tests__/musicalTicks.test.ts
git commit -m "feat(core): add computeMusicalTicks with zoom level detection"
```

---

## Task 4: `computeMusicalTicks()` — Tick Generation Tests

**Files:**
- Modify: `packages/core/src/__tests__/musicalTicks.test.ts`

- [ ] **Step 1: Add tick generation tests**

Append inside the `computeMusicalTicks` describe block:
```typescript
  describe('tick generation', () => {
    it('generates bar ticks at bar zoom', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 200,
        startPixel: 0, endPixel: 100, ppqn,
      });
      expect(result.zoomLevel).toBe('bar');
      const barTicks = result.ticks.filter((t) => t.level === 'bar');
      expect(barTicks.length).toBeGreaterThan(0);
      expect(barTicks[0].pixel).toBe(0);
      expect(barTicks[0].label).toBe('1');
      expect(barTicks[0].index).toBe(0);
    });

    it('generates beat ticks at beat zoom', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 100,
        startPixel: 0, endPixel: 50, ppqn,
      });
      expect(result.zoomLevel).toBe('beat');
      const beatTicks = result.ticks.filter((t) => t.level === 'beat');
      expect(beatTicks.length).toBeGreaterThan(0);
      expect(beatTicks[0].label).toBe('1.2');
    });

    it('filters ticks to visible range only', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 4,
        startPixel: 1000, endPixel: 2000, ppqn,
      });
      for (const tick of result.ticks) {
        expect(tick.pixel).toBeGreaterThanOrEqual(1000);
        expect(tick.pixel).toBeLessThanOrEqual(2000);
      }
    });

    it('ticks are sorted by pixel', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 10,
        startPixel: 0, endPixel: 500, ppqn,
      });
      for (let i = 1; i < result.ticks.length; i++) {
        expect(result.ticks[i].pixel).toBeGreaterThanOrEqual(result.ticks[i - 1].pixel);
      }
    });

    it('bar ticks have sequential indices for striping', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 200,
        startPixel: 0, endPixel: 200, ppqn,
      });
      const barTicks = result.ticks.filter((t) => t.level === 'bar');
      for (let i = 0; i < barTicks.length; i++) {
        expect(barTicks[i].index).toBe(i);
      }
    });

    it('coarse zoom skips bars', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 500,
        startPixel: 0, endPixel: 200, ppqn,
      });
      expect(result.zoomLevel).toBe('coarse');
      expect(result.coarseBarStep).toBeGreaterThan(1);
    });

    it('includes all levels at sixteenth zoom', () => {
      const result = computeMusicalTicks({
        timeSignature: ts, ticksPerPixel: 10,
        startPixel: 0, endPixel: 500, ppqn,
      });
      expect(result.zoomLevel).toBe('sixteenth');
      const levels = new Set(result.ticks.map((t) => t.level));
      expect(levels.has('bar')).toBe(true);
      expect(levels.has('beat')).toBe(true);
      expect(levels.has('sixteenth')).toBe(true);
    });
  });
```

- [ ] **Step 2: Run tests — they should already pass**

Run: `cd packages/core && npx vitest run src/__tests__/musicalTicks.test.ts`
Expected: PASS (tick generation was implemented in Task 3)

- [ ] **Step 3: Commit**

```bash
git add packages/core/src/__tests__/musicalTicks.test.ts
git commit -m "test(core): add tick generation tests for computeMusicalTicks"
```

---

## Task 5: Musical Tick Cache

**Files:**
- Create: `packages/dawcore/src/utils/musical-tick-cache.ts`
- Create: `packages/dawcore/src/__tests__/musical-tick-cache.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/dawcore/src/__tests__/musical-tick-cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@waveform-playlist/core', async () => {
  const actual = await vi.importActual('@waveform-playlist/core');
  return {
    ...actual,
    computeMusicalTicks: vi.fn((params: { ticksPerPixel: number }) => ({
      ticks: [],
      pixelsPerBar: 3840 / params.ticksPerPixel,
      pixelsPerBeat: 960 / params.ticksPerPixel,
      zoomLevel: 'beat' as const,
    })),
  };
});

import { getCachedMusicalTicks, clearMusicalTickCache } from '../utils/musical-tick-cache';
import { computeMusicalTicks } from '@waveform-playlist/core';

describe('getCachedMusicalTicks', () => {
  beforeEach(() => {
    clearMusicalTickCache();
    vi.mocked(computeMusicalTicks).mockClear();
  });

  const params = {
    timeSignature: [4, 4] as [number, number],
    ticksPerPixel: 4,
    startPixel: 0,
    endPixel: 1000,
    ppqn: 960,
  };

  it('calls computeMusicalTicks on first call', () => {
    getCachedMusicalTicks(params);
    expect(computeMusicalTicks).toHaveBeenCalledTimes(1);
  });

  it('returns cached result on same params', () => {
    const a = getCachedMusicalTicks(params);
    const b = getCachedMusicalTicks(params);
    expect(computeMusicalTicks).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
  });

  it('recomputes on changed ticksPerPixel', () => {
    getCachedMusicalTicks(params);
    getCachedMusicalTicks({ ...params, ticksPerPixel: 8 });
    expect(computeMusicalTicks).toHaveBeenCalledTimes(2);
  });

  it('recomputes on changed startPixel', () => {
    getCachedMusicalTicks(params);
    getCachedMusicalTicks({ ...params, startPixel: 500 });
    expect(computeMusicalTicks).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/musical-tick-cache.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement cache**

```typescript
// packages/dawcore/src/utils/musical-tick-cache.ts
import { computeMusicalTicks } from '@waveform-playlist/core';
import type { MusicalTickParams, MusicalTickData } from '@waveform-playlist/core';

let cachedParams: MusicalTickParams | null = null;
let cachedResult: MusicalTickData | null = null;

function paramsMatch(a: MusicalTickParams, b: MusicalTickParams): boolean {
  return (
    a.ticksPerPixel === b.ticksPerPixel &&
    a.startPixel === b.startPixel &&
    a.endPixel === b.endPixel &&
    a.timeSignature[0] === b.timeSignature[0] &&
    a.timeSignature[1] === b.timeSignature[1] &&
    (a.ppqn ?? 960) === (b.ppqn ?? 960)
  );
}

export function getCachedMusicalTicks(params: MusicalTickParams): MusicalTickData {
  if (cachedParams && cachedResult && paramsMatch(cachedParams, params)) {
    return cachedResult;
  }
  cachedResult = computeMusicalTicks(params);
  cachedParams = { ...params, timeSignature: [...params.timeSignature] };
  return cachedResult;
}

export function clearMusicalTickCache(): void {
  cachedParams = null;
  cachedResult = null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/musical-tick-cache.test.ts`
Expected: PASS (all 4 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/utils/musical-tick-cache.ts packages/dawcore/src/__tests__/musical-tick-cache.test.ts
git commit -m "feat(dawcore): add musical tick cache for grid/ruler sharing"
```

---

## Task 6: `<daw-grid>` Element

**Files:**
- Create: `packages/dawcore/src/elements/daw-grid.ts`
- Create: `packages/dawcore/src/__tests__/daw-grid.test.ts`
- Modify: `packages/dawcore/src/index.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// packages/dawcore/src/__tests__/daw-grid.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import '../elements/daw-grid';
import type { DawGridElement } from '../elements/daw-grid';

function createGrid(): DawGridElement {
  const el = document.createElement('daw-grid') as DawGridElement;
  el.ticksPerPixel = 4;
  el.timeSignature = [4, 4];
  el.ppqn = 960;
  el.visibleStart = 0;
  el.visibleEnd = 2000;
  el.length = 2000;
  el.height = 200;
  document.body.appendChild(el);
  return el;
}

describe('daw-grid', () => {
  beforeEach(() => {
    document.body.querySelectorAll('daw-grid').forEach((el) => el.remove());
  });

  it('is defined as a custom element', () => {
    expect(customElements.get('daw-grid')).toBeDefined();
  });

  it('creates shadow root', () => {
    const el = createGrid();
    expect(el.shadowRoot).not.toBeNull();
  });

  it('renders canvas chunks', async () => {
    const el = createGrid();
    await el.updateComplete;
    const canvases = el.shadowRoot!.querySelectorAll('canvas');
    expect(canvases.length).toBeGreaterThan(0);
  });

  it('renders no canvases when length is 0', async () => {
    const el = createGrid();
    el.length = 0;
    await el.updateComplete;
    const canvases = el.shadowRoot!.querySelectorAll('canvas');
    expect(canvases.length).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-grid.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `<daw-grid>` element**

```typescript
// packages/dawcore/src/elements/daw-grid.ts
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { getCachedMusicalTicks } from '../utils/musical-tick-cache';
import type { MusicalTickData } from '@waveform-playlist/core';
import { getVisibleChunkIndices } from '../utils/viewport';

const MAX_CANVAS_WIDTH = 1000;

@customElement('daw-grid')
export class DawGridElement extends LitElement {
  @property({ type: Number, attribute: false }) ticksPerPixel = 4;
  @property({ attribute: false }) timeSignature: [number, number] = [4, 4];
  @property({ type: Number, attribute: false }) ppqn = 960;
  @property({ type: Number, attribute: false }) visibleStart = -Infinity;
  @property({ type: Number, attribute: false }) visibleEnd = Infinity;
  @property({ type: Number, attribute: false }) length = 0;
  @property({ type: Number, attribute: false }) height = 200;

  private _tickData: MusicalTickData | null = null;

  static styles = css`
    :host {
      display: block;
      position: absolute;
      top: 0;
      left: 0;
      pointer-events: none;
      z-index: 0;
    }
    .container {
      position: relative;
    }
    canvas {
      position: absolute;
      top: 0;
    }
  `;

  willUpdate() {
    if (this.length > 0) {
      this._tickData = getCachedMusicalTicks({
        timeSignature: this.timeSignature,
        ticksPerPixel: this.ticksPerPixel,
        startPixel: 0,
        endPixel: this.length,
        ppqn: this.ppqn,
      });
    } else {
      this._tickData = null;
    }
  }

  private _getVisibleChunkIndices(): number[] {
    return getVisibleChunkIndices(
      this.length, MAX_CANVAS_WIDTH, this.visibleStart, this.visibleEnd
    );
  }

  render() {
    if (!this._tickData || this.length <= 0) return html``;

    const indices = this._getVisibleChunkIndices();
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;

    return html`
      <div class="container" style="width: ${this.length}px; height: ${this.height}px;">
        ${indices.map((i) => {
          const width = Math.min(MAX_CANVAS_WIDTH, this.length - i * MAX_CANVAS_WIDTH);
          return html`
            <canvas
              data-index=${i}
              width=${width * dpr}
              height=${this.height * dpr}
              style="left: ${i * MAX_CANVAS_WIDTH}px; width: ${width}px; height: ${this.height}px;"
            ></canvas>
          `;
        })}
      </div>
    `;
  }

  updated() {
    this._drawGrid();
  }

  private _drawGrid() {
    if (!this._tickData) return;
    const canvases = this.shadowRoot?.querySelectorAll('canvas');
    if (!canvases) return;

    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const style = getComputedStyle(this);
    const oddColor = style.getPropertyValue('--daw-grid-odd').trim() || 'rgba(255,255,255,0.03)';
    const evenColor = style.getPropertyValue('--daw-grid-even').trim() || 'rgba(255,255,255,0.06)';
    const lineColor =
      style.getPropertyValue('--daw-grid-line-color').trim() || 'rgba(255,255,255,0.1)';

    const { ticks, zoomLevel, pixelsPerBar, pixelsPerBeat } = this._tickData;

    let stripeWidth: number;
    if (zoomLevel === 'coarse') stripeWidth = 0;
    else if (zoomLevel === 'bar') stripeWidth = pixelsPerBar;
    else if (zoomLevel === 'beat') stripeWidth = pixelsPerBeat;
    else if (zoomLevel === 'eighth') stripeWidth = pixelsPerBeat / 2;
    else stripeWidth = pixelsPerBeat / 4;

    for (const canvas of canvases) {
      const idx = Number(canvas.dataset.index);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const canvasWidth = Math.min(MAX_CANVAS_WIDTH, this.length - idx * MAX_CANVAS_WIDTH);
      const globalOffset = idx * MAX_CANVAS_WIDTH;

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);

      // Draw stripes
      if (stripeWidth > 0) {
        for (const tick of ticks) {
          const localX = tick.pixel - globalOffset;
          if (localX + stripeWidth < 0 || localX >= canvasWidth) continue;
          ctx.fillStyle = tick.index % 2 === 0 ? evenColor : oddColor;
          const x = Math.max(0, localX);
          const w = Math.min(stripeWidth, canvasWidth - x);
          ctx.fillRect(x, 0, w, this.height);
        }
      }

      // Draw lines
      ctx.lineWidth = 1;
      for (const tick of ticks) {
        const localX = tick.pixel - globalOffset;
        if (localX < 0 || localX >= canvasWidth) continue;

        ctx.globalAlpha =
          tick.level === 'bar' ? 1.0
          : tick.level === 'beat' ? 0.6
          : tick.level === 'eighth' ? 0.4
          : 0.3;
        ctx.strokeStyle = lineColor;
        ctx.beginPath();
        ctx.moveTo(localX + 0.5, 0);
        ctx.lineTo(localX + 0.5, this.height);
        ctx.stroke();
      }
      ctx.globalAlpha = 1.0;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-grid': DawGridElement;
  }
}
```

- [ ] **Step 4: Register in index.ts**

Add import to `packages/dawcore/src/index.ts` (element imports section):
```typescript
import './elements/daw-grid';
```
Add export (exports section):
```typescript
export { DawGridElement } from './elements/daw-grid';
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-grid.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-grid.ts packages/dawcore/src/__tests__/daw-grid.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add daw-grid element with chunked canvas rendering"
```

---

## Task 7: Editor Properties and Grid/Ruler Wiring

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

- [ ] **Step 1: Add imports and new properties**

Add import at top of `daw-editor.ts`:
```typescript
import type { SnapTo } from '@waveform-playlist/core';
```

Add after line 72 (`interactiveClips` property):
```typescript
  @property({ type: String, attribute: 'scale-mode' })
  scaleMode: 'temporal' | 'beats' = 'temporal';
  @property({ type: Number, attribute: 'ticks-per-pixel' })
  ticksPerPixel = 4;
  @property({ type: Number }) bpm = 120;
  @property({ attribute: false })
  timeSignature: [number, number] = [4, 4];
  @property({ type: Number }) ppqn = 960;
  @property({ type: String, attribute: 'snap-to' })
  snapTo: SnapTo = 'off';
```

- [ ] **Step 2: Update `_totalWidth` getter**

Replace the `_totalWidth` getter (line 214-216):
```typescript
  private get _totalWidth(): number {
    if (this.scaleMode === 'beats') {
      const totalTicks = (this._duration * this.bpm * this.ppqn) / 60;
      return Math.ceil(totalTicks / this.ticksPerPixel);
    }
    return Math.ceil((this._duration * this.effectiveSampleRate) / this.samplesPerPixel);
  }
```

- [ ] **Step 3: Add track row transparency CSS**

In `static styles`, add after the `.track-row` rule:
```css
:host([scale-mode="beats"]) .track-row {
  background: transparent;
}
```

- [ ] **Step 4: Wire grid and ruler in `render()`**

Update the ruler template to pass new props:
```typescript
          ${orderedTracks.length > 0 && this.timescale
            ? html`<daw-ruler
                .samplesPerPixel=${this.samplesPerPixel}
                .sampleRate=${this.effectiveSampleRate}
                .duration=${this._duration}
                .scaleMode=${this.scaleMode}
                .ticksPerPixel=${this.ticksPerPixel}
                .timeSignature=${this.timeSignature}
                .ppqn=${this.ppqn}
                .totalWidth=${this._totalWidth}
              ></daw-ruler>`
            : ''}
```

Add grid rendering after the ruler block, before selection/playhead:
```typescript
          ${orderedTracks.length > 0 && this.scaleMode === 'beats'
            ? html`<daw-grid
                .ticksPerPixel=${this.ticksPerPixel}
                .timeSignature=${this.timeSignature}
                .ppqn=${this.ppqn}
                .visibleStart=${this._viewport.visibleStart}
                .visibleEnd=${this._viewport.visibleEnd}
                .length=${this._totalWidth}
                .height=${orderedTracks.reduce((sum, t) => sum + t.trackHeight, 0)}
              ></daw-grid>`
            : ''}
```

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts
git commit -m "feat(dawcore): add beats mode properties and grid/ruler wiring to editor"
```

---

## Task 8: Ruler Beats & Bars Mode

**Files:**
- Modify: `packages/dawcore/src/elements/daw-ruler.ts`

- [ ] **Step 1: Add imports and new properties**

Add imports:
```typescript
import { getCachedMusicalTicks } from '../utils/musical-tick-cache';
import type { MusicalTickData, MusicalTick } from '@waveform-playlist/core';
```

Add properties after line 12:
```typescript
  @property({ type: String, attribute: false }) scaleMode: 'temporal' | 'beats' = 'temporal';
  @property({ type: Number, attribute: false }) ticksPerPixel = 4;
  @property({ attribute: false }) timeSignature: [number, number] = [4, 4];
  @property({ type: Number, attribute: false }) ppqn = 960;
  @property({ type: Number, attribute: false }) totalWidth = 0;
```

Add private field:
```typescript
  private _musicalTickData: MusicalTickData | null = null;
```

- [ ] **Step 2: Update `willUpdate()`**

Replace `willUpdate()`:
```typescript
  willUpdate() {
    if (this.scaleMode === 'beats' && this.totalWidth > 0) {
      this._musicalTickData = getCachedMusicalTicks({
        timeSignature: this.timeSignature,
        ticksPerPixel: this.ticksPerPixel,
        startPixel: 0,
        endPixel: this.totalWidth,
        ppqn: this.ppqn,
      });
      this._tickData = null;
    } else if (this.duration > 0) {
      this._musicalTickData = null;
      this._tickData = computeTemporalTicks(
        this.samplesPerPixel, this.sampleRate, this.duration, this.rulerHeight
      );
    } else {
      this._musicalTickData = null;
      this._tickData = null;
    }
  }
```

- [ ] **Step 3: Update `render()`**

Replace `render()`:
```typescript
  render() {
    const widthX = this.scaleMode === 'beats' ? this.totalWidth : (this._tickData?.widthX ?? 0);
    if (widthX <= 0) return html``;

    const totalChunks = Math.ceil(widthX / MAX_CANVAS_WIDTH);
    const indices = Array.from({ length: totalChunks }, (_, i) => i);
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;

    const beatsLabels = this.scaleMode === 'beats'
      ? (this._musicalTickData?.ticks.filter((t) => t.label) ?? [])
      : [];
    const temporalLabels = this.scaleMode !== 'beats' ? (this._tickData?.labels ?? []) : [];

    return html`
      <div class="container" style="width: ${widthX}px; height: ${this.rulerHeight}px;">
        ${indices.map((i) => {
          const width = Math.min(MAX_CANVAS_WIDTH, widthX - i * MAX_CANVAS_WIDTH);
          return html`
            <canvas
              data-index=${i}
              width=${width * dpr}
              height=${this.rulerHeight * dpr}
              style="left: ${i * MAX_CANVAS_WIDTH}px; width: ${width}px; height: ${this.rulerHeight}px;"
            ></canvas>
          `;
        })}
        ${this.scaleMode === 'beats'
          ? beatsLabels.map(
              (t) => html`<span class="label" style="left: ${t.pixel + 4}px;">${t.label}</span>`
            )
          : temporalLabels.map(
              ({ pix, text }) => html`<span class="label" style="left: ${pix + 4}px;">${text}</span>`
            )}
      </div>
    `;
  }
```

- [ ] **Step 4: Update `_drawTicks()`**

Replace `_drawTicks()`:
```typescript
  private _drawTicks() {
    const canvases = this.shadowRoot?.querySelectorAll('canvas');
    if (!canvases) return;

    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const rulerColor =
      getComputedStyle(this).getPropertyValue('--daw-ruler-color').trim() || '#c49a6c';

    const widthX = this.scaleMode === 'beats' ? this.totalWidth : (this._tickData?.widthX ?? 0);

    for (const canvas of canvases) {
      const idx = Number(canvas.dataset.index);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const canvasWidth = Math.min(MAX_CANVAS_WIDTH, widthX - idx * MAX_CANVAS_WIDTH);
      const globalOffset = idx * MAX_CANVAS_WIDTH;

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.strokeStyle = rulerColor;
      ctx.lineWidth = 1;

      if (this.scaleMode === 'beats' && this._musicalTickData) {
        for (const tick of this._musicalTickData.ticks) {
          const localX = tick.pixel - globalOffset;
          if (localX < 0 || localX >= canvasWidth) continue;

          const heightFraction =
            tick.level === 'bar' ? 1.0
            : tick.level === 'beat' ? 0.5
            : tick.level === 'eighth' ? 0.3
            : 0.2;

          ctx.beginPath();
          ctx.moveTo(localX + 0.5, this.rulerHeight);
          ctx.lineTo(localX + 0.5, this.rulerHeight * (1 - heightFraction));
          ctx.stroke();
        }
      } else if (this._tickData) {
        for (const [pix, height] of this._tickData.canvasInfo) {
          const localX = pix - globalOffset;
          if (localX < 0 || localX >= canvasWidth) continue;
          ctx.beginPath();
          ctx.moveTo(localX + 0.5, this.rulerHeight);
          ctx.lineTo(localX + 0.5, this.rulerHeight - height);
          ctx.stroke();
        }
      }
    }
  }
```

- [ ] **Step 5: Run typecheck and existing ruler tests**

Run: `cd packages/dawcore && pnpm typecheck && npx vitest run src/__tests__/daw-ruler.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-ruler.ts
git commit -m "feat(dawcore): add beats and bars mode to daw-ruler"
```

---

## Task 9: Playhead Beats Mode

**Files:**
- Modify: `packages/dawcore/src/elements/daw-playhead.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

- [ ] **Step 1: Add beats mode methods to playhead**

Add after `stopAnimation()` in `daw-playhead.ts`:
```typescript
  startBeatsAnimation(
    getTime: () => number, bpm: number, ppqn: number, ticksPerPixel: number
  ) {
    const ticksPerSecond = (bpm * ppqn) / 60;
    this._animation.start(() => {
      const time = getTime();
      const px = (time * ticksPerSecond) / ticksPerPixel;
      if (this._line) {
        this._line.style.transform = `translate3d(${px}px, 0, 0)`;
      }
    });
  }

  stopBeatsAnimation(time: number, bpm: number, ppqn: number, ticksPerPixel: number) {
    this._animation.stop();
    const px = (time * bpm * ppqn) / (60 * ticksPerPixel);
    if (this._line) {
      this._line.style.transform = `translate3d(${px}px, 0, 0)`;
    }
  }
```

- [ ] **Step 2: Update editor `_startPlayhead()` and `_stopPlayhead()`**

Replace `_startPlayhead()` in `daw-editor.ts`:
```typescript
  _startPlayhead() {
    const playhead = this._getPlayhead();
    if (!playhead || !this._engine) return;
    const engine = this._engine;
    const ctx = this.audioContext;
    if (this.scaleMode === 'beats') {
      playhead.startBeatsAnimation(
        () => {
          const latency = 'outputLatency' in ctx ? (ctx as AudioContext).outputLatency : 0;
          return Math.max(0, engine.getCurrentTime() - latency);
        },
        this.bpm, this.ppqn, this.ticksPerPixel
      );
    } else {
      playhead.startAnimation(
        () => {
          const latency = 'outputLatency' in ctx ? (ctx as AudioContext).outputLatency : 0;
          return Math.max(0, engine.getCurrentTime() - latency);
        },
        this.effectiveSampleRate, this.samplesPerPixel
      );
    }
  }
```

Replace `_stopPlayhead()`:
```typescript
  _stopPlayhead() {
    const playhead = this._getPlayhead();
    if (!playhead) return;
    if (this.scaleMode === 'beats') {
      playhead.stopBeatsAnimation(this._currentTime, this.bpm, this.ppqn, this.ticksPerPixel);
    } else {
      playhead.stopAnimation(this._currentTime, this.effectiveSampleRate, this.samplesPerPixel);
    }
  }
```

- [ ] **Step 3: Run typecheck**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add packages/dawcore/src/elements/daw-playhead.ts packages/dawcore/src/elements/daw-editor.ts
git commit -m "feat(dawcore): add beats mode playhead positioning"
```

---

## Task 10: Pointer Handler Snap Integration

**Files:**
- Modify: `packages/dawcore/src/interactions/pointer-handler.ts`

- [ ] **Step 1: Extend PointerHandlerHost and add imports**

Add import:
```typescript
import { pixelsToSeconds, snapTickToGrid } from '@waveform-playlist/core';
import type { SnapTo } from '@waveform-playlist/core';
```

(Remove the existing `import { pixelsToSeconds } from '@waveform-playlist/core';` line.)

Add to `PointerHandlerHost` interface:
```typescript
  readonly scaleMode: 'temporal' | 'beats';
  readonly ticksPerPixel: number;
  readonly bpm: number;
  readonly ppqn: number;
  readonly timeSignature: [number, number];
  readonly snapTo: SnapTo;
```

- [ ] **Step 2: Add coordinate conversion helpers**

Add private methods to `PointerHandler`:
```typescript
  private _pxToTime(px: number): number {
    const h = this._host;
    if (h.scaleMode === 'beats') {
      let tick = px * h.ticksPerPixel;
      tick = snapTickToGrid(tick, h.snapTo, h.timeSignature, h.ppqn);
      return (tick * 60) / (h.bpm * h.ppqn);
    }
    return pixelsToSeconds(px, h.samplesPerPixel, h.effectiveSampleRate);
  }

  private _timeToPx(time: number): number {
    const h = this._host;
    if (h.scaleMode === 'beats') {
      const tick = (time * h.bpm * h.ppqn) / 60;
      return tick / h.ticksPerPixel;
    }
    return (time * h.effectiveSampleRate) / h.samplesPerPixel;
  }
```

- [ ] **Step 3: Update `_handleSeekClick()`**

Replace line 182 (`const time = pixelsToSeconds(...)`) with:
```typescript
    const time = this._pxToTime(px);
```

- [ ] **Step 4: Update `_onPointerMove()` selection**

Replace lines 116-121 (the `startTime`/`endTime` computation):
```typescript
      const startTime = this._pxToTime(this._dragStartPx);
      const endTime = this._pxToTime(currentPx);
```

Replace lines 130-131 (selection pixel update):
```typescript
        sel.startPx = this._timeToPx(h._selectionStartTime);
        sel.endPx = this._timeToPx(h._selectionEndTime);
```

- [ ] **Step 5: Run typecheck**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/interactions/pointer-handler.ts
git commit -m "feat(dawcore): add snap pipeline to pointer handler for beats mode"
```

---

## Task 11: Dev Page and Manual Verification

**Files:**
- Already created: `packages/dawcore/dev/beats-grid.html`

- [ ] **Step 1: Build and run dev page**

Run: `cd packages/dawcore && pnpm dev:page`
Open: `http://localhost:5173/dev/beats-grid.html`

- [ ] **Step 2: Verify grid renders**

Check: grid stripes behind tracks, bar lines strongest, zoom cascade works (+/- buttons), track rows transparent.

- [ ] **Step 3: Verify ruler shows beat labels**

Check: bar numbers at coarse zoom, bar.beat at fine zoom, tick heights match hierarchy.

- [ ] **Step 4: Verify playhead and snap**

Click Play — playhead moves in tick space. Set snap to Beat, click timeline — seek snaps to beat boundaries.

- [ ] **Step 5: Commit dev page**

```bash
git add packages/dawcore/dev/beats-grid.html
git commit -m "feat(dawcore): add beats grid dev page"
```

---

## Task 12: Full Build and Lint

- [ ] **Step 1: Run lint and format**

```bash
pnpm format && pnpm lint
```
Expected: PASS

- [ ] **Step 2: Run full build**

```bash
pnpm build
```
Expected: PASS

- [ ] **Step 3: Run all tests**

```bash
cd packages/core && npx vitest run && cd ../dawcore && npx vitest run
```
Expected: All PASS

- [ ] **Step 4: Kill stray vitest processes**

```bash
pkill -f vitest 2>/dev/null || true
```
