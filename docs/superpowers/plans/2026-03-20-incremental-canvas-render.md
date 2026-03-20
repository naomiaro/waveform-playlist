# Incremental Canvas Rendering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dirty pixel tracking to `daw-waveform` so only changed peak regions are cleared and redrawn, enabling efficient incremental rendering for recording.

**Architecture:** Replace the current full-redraw-on-every-update approach with a dirty `Set<number>` of peak indices. A `requestAnimationFrame`-batched draw loop clears and redraws only the dirty region per canvas chunk. Full redraws (zoom, load) mark all peaks dirty through the same code path.

**Tech Stack:** Lit web components, vitest + happy-dom, canvas 2D API

**Spec:** `docs/superpowers/specs/2026-03-20-incremental-canvas-render-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `packages/dawcore/src/elements/daw-waveform.ts` | Dirty tracking, `updatePeaks()`, rAF draw, peaks getter/setter |
| Modify | `packages/dawcore/src/__tests__/daw-waveform.test.ts` | Tests for incremental rendering |
| Modify | `packages/dawcore/src/elements/daw-editor.ts` | Remove `.bits` binding from template |

---

### Task 1: Convert `peaks` from Lit `@property` to getter/setter with dirty marking

**Files:**
- Modify: `packages/dawcore/src/elements/daw-waveform.ts`
- Modify: `packages/dawcore/src/__tests__/daw-waveform.test.ts`

- [ ] **Step 1: Write tests for derived bits and peak count**

Add to `packages/dawcore/src/__tests__/daw-waveform.test.ts`:

```typescript
import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

let rafCallbacks: Array<(time: number) => void>;

function flushRaf() {
  const cbs = rafCallbacks.splice(0);
  cbs.forEach((cb) => cb(performance.now()));
}

beforeAll(async () => {
  await import('../elements/daw-waveform');
});

beforeEach(() => {
  rafCallbacks = [];
  vi.stubGlobal(
    'requestAnimationFrame',
    vi.fn((cb: (time: number) => void) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    })
  );
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('devicePixelRatio', 1);
});

afterEach(() => {
  vi.unstubAllGlobals();
});
```

Replace the existing `'has default property values'` test and add:

```typescript
  it('has default property values', () => {
    const el = document.createElement('daw-waveform') as any;
    expect(el.waveHeight).toBe(128);
    expect(el.barWidth).toBe(1);
    expect(el.barGap).toBe(0);
    expect(el.length).toBe(0);
    expect(el.peaks).toBeInstanceOf(Int16Array);
    expect(el.peaks.length).toBe(0);
  });

  it('derives bits=8 from Int8Array peaks', () => {
    const el = document.createElement('daw-waveform') as any;
    el.peaks = new Int8Array([0, 10, -5, 20]);
    expect(el.bits).toBe(8);
  });

  it('derives bits=16 from Int16Array peaks (default)', () => {
    const el = document.createElement('daw-waveform') as any;
    expect(el.bits).toBe(16); // default Int16Array
    el.peaks = new Int16Array([0, 1000, -500, 2000]);
    expect(el.bits).toBe(16);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: Tests should still pass (peaks property exists). This is the baseline.

- [ ] **Step 3: Convert peaks from @property to getter/setter**

In `packages/dawcore/src/elements/daw-waveform.ts`, replace:

```typescript
@property({ type: Object, attribute: false }) peaks: Peaks = new Int16Array(0);
@property({ type: Number, attribute: false }) bits: Bits = 16;
```

With:

```typescript
private _peaks: Peaks = new Int16Array(0);
private _dirtyPixels: Set<number> = new Set();
private _drawScheduled = false;

set peaks(value: Peaks) {
  this._peaks = value;
  this._markAllDirty();
  this.requestUpdate();
}

get peaks(): Peaks {
  return this._peaks;
}
```

Keep the `Bits` import (needed for the getter return type):

```typescript
import type { Peaks, Bits } from '@waveform-playlist/core';
```

Add public getter to derive bits from the typed array:

```typescript
get bits(): Bits {
  return this._peaks instanceof Int8Array ? 8 : 16;
}
```

Add `_markAllDirty()`:

```typescript
private _markAllDirty() {
  const peakCount = Math.floor(this._peaks.length / 2);
  for (let i = 0; i < peakCount; i++) {
    this._dirtyPixels.add(i);
  }
  this._scheduleDraw();
}

private _rafId = 0;

private _scheduleDraw() {
  if (!this._drawScheduled) {
    this._drawScheduled = true;
    this._rafId = requestAnimationFrame(() => {
      this._drawScheduled = false;
      this._drawDirty();
    });
  }
}

disconnectedCallback() {
  super.disconnectedCallback();
  if (this._drawScheduled) {
    cancelAnimationFrame(this._rafId);
    this._drawScheduled = false;
  }
  this._dirtyPixels.clear();
}
```

Add empty `_drawDirty()` stub (implemented in Task 2):

```typescript
private _drawDirty() {
  this._dirtyPixels.clear();
}
```

Update `_drawVisibleChunks()` to use `this._peaks` and `this.bits` (the public getter) instead of the old `this.peaks` and `this.bits` property references. The `this.bits` getter derives from `this._peaks`, so it still works correctly.

Update `updated()` to mark all dirty instead of drawing directly:

```typescript
updated() {
  this._markAllDirty();
}
```

**Note:** When `.peaks` is set, `_markAllDirty()` is called twice: once from the setter, once from `updated()` (triggered by `requestUpdate()`). This is harmless — the Set deduplicates, and only one rAF draw is scheduled. The double-mark ensures new canvas chunks created by Lit's re-render also get drawn.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-waveform.ts packages/dawcore/src/__tests__/daw-waveform.test.ts
git commit -m "refactor(dawcore): convert daw-waveform peaks to getter/setter with dirty tracking

Remove bits @property — derived from typed array (Int8Array→8, Int16Array→16).
Add _dirtyPixels Set, _markAllDirty(), _scheduleDraw() scaffolding.
updated() marks all dirty instead of drawing directly."
```

---

### Task 2: Implement rAF-batched dirty drawing

**Files:**
- Modify: `packages/dawcore/src/elements/daw-waveform.ts`
- Modify: `packages/dawcore/src/__tests__/daw-waveform.test.ts`

- [ ] **Step 1: Write tests for full redraw via dirty path**

Add to the test file:

```typescript
  it('calls clearRect on full canvas width when peaks are set', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 100;
    document.body.appendChild(el);

    // Wait for Lit render to create canvas elements
    await new Promise((r) => setTimeout(r, 50));

    const canvas = el.shadowRoot?.querySelector('canvas');
    expect(canvas).toBeTruthy();
    const ctx = canvas.getContext('2d');
    const clearSpy = vi.spyOn(ctx, 'clearRect');

    // Set peaks — marks all dirty
    el.peaks = new Int16Array([0, 100, -50, 200, 0, 150, -100, 300]);
    flushRaf();

    expect(clearSpy).toHaveBeenCalled();
    // clearRect should cover the full canvas width (4 peak pairs = 4 pixels)
    const [, , width] = clearSpy.mock.calls[0];
    expect(width).toBeGreaterThan(0);

    document.body.removeChild(el);
  });

  it('skips draw when dirty set is empty', () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 100;
    document.body.appendChild(el);

    // Flush any pending draws from mount
    flushRaf();

    const canvas = el.shadowRoot?.querySelector('canvas');
    if (canvas) {
      const ctx = canvas.getContext('2d');
      const clearSpy = vi.spyOn(ctx, 'clearRect');

      // No peaks set, no updatePeaks called — dirty set should be empty
      flushRaf();
      expect(clearSpy).not.toHaveBeenCalled();
    }

    document.body.removeChild(el);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: FAIL — `_drawDirty()` is a stub that just clears the set

- [ ] **Step 3: Implement `_drawDirty()` with partial clear**

Replace the `_drawDirty()` stub in `daw-waveform.ts`:

```typescript
private _drawDirty() {
  if (this._dirtyPixels.size === 0 || this.length === 0 || this._peaks.length === 0) {
    this._dirtyPixels.clear();
    return;
  }

  const canvases = this.shadowRoot?.querySelectorAll('canvas');
  if (!canvases || canvases.length === 0) {
    this._dirtyPixels.clear();
    return;
  }

  const step = this.barWidth + this.barGap;
  const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
  const halfHeight = this.waveHeight / 2;
  const bits = this.bits;
  const waveColor =
    getComputedStyle(this).getPropertyValue('--daw-wave-color').trim() || '#c49a6c';

  // Group dirty peak indices by chunk
  const dirtyByChunk = new Map<number, { min: number; max: number }>();
  for (const peakIdx of this._dirtyPixels) {
    const chunkIdx = Math.floor(peakIdx / MAX_CANVAS_WIDTH);
    const existing = dirtyByChunk.get(chunkIdx);
    if (existing) {
      existing.min = Math.min(existing.min, peakIdx);
      existing.max = Math.max(existing.max, peakIdx);
    } else {
      dirtyByChunk.set(chunkIdx, { min: peakIdx, max: peakIdx });
    }
  }

  for (const canvas of canvases) {
    const chunkIdx = Number(canvas.dataset.index);
    const range = dirtyByChunk.get(chunkIdx);
    if (!range) continue;

    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    const globalOffset = chunkIdx * MAX_CANVAS_WIDTH;

    // Convert dirty peak range to local pixel coordinates
    const dirtyLocalStart = range.min - globalOffset;
    const dirtyLocalEnd = range.max - globalOffset;

    // Align to bar boundaries
    const firstBar = calculateFirstBarPosition(
      globalOffset + dirtyLocalStart,
      this.barWidth,
      step
    );
    const clearStart = Math.max(0, firstBar - globalOffset);
    const clearEnd = dirtyLocalEnd + this.barWidth;
    const clearWidth = clearEnd - clearStart;

    // Partial clear
    ctx.resetTransform();
    ctx.clearRect(
      clearStart * dpr,
      0,
      clearWidth * dpr,
      canvas.height
    );
    ctx.scale(dpr, dpr);
    ctx.fillStyle = waveColor;

    // Draw only bars in the dirty region
    const canvasWidth = Math.min(MAX_CANVAS_WIDTH, this.length - globalOffset);
    const regionEnd = Math.min(globalOffset + clearEnd, globalOffset + canvasWidth);

    for (let bar = Math.max(0, firstBar); bar < regionEnd; bar += step) {
      const peak = aggregatePeaks(this._peaks, bits, bar, bar + step);
      if (!peak) continue;
      const rects = calculateBarRects(
        bar - globalOffset,
        this.barWidth,
        halfHeight,
        peak.min,
        peak.max,
        'normal'
      );
      for (const r of rects) {
        ctx.fillRect(r.x, r.y, r.width, r.height);
      }
    }
  }

  this._dirtyPixels.clear();
}
```

Remove the old `_drawVisibleChunks()` method entirely.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-waveform.ts packages/dawcore/src/__tests__/daw-waveform.test.ts
git commit -m "feat(dawcore): implement rAF-batched dirty drawing in daw-waveform

_drawDirty() groups dirty peak indices by chunk, does partial clearRect,
and redraws only bars in the dirty region. Replaces _drawVisibleChunks()."
```

---

### Task 3: Implement `updatePeaks()` for incremental updates

**Files:**
- Modify: `packages/dawcore/src/elements/daw-waveform.ts`
- Modify: `packages/dawcore/src/__tests__/daw-waveform.test.ts`

- [ ] **Step 1: Write tests for updatePeaks**

```typescript
  it('updatePeaks marks only the specified range dirty', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 200;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    // Set initial peaks (10 pairs = 10 pixels)
    el.peaks = new Int16Array(20);
    flushRaf(); // flush the full draw

    const canvas = el.shadowRoot?.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    const clearSpy = vi.spyOn(ctx, 'clearRect');

    // Incremental update: only pixels 8-9 changed
    el.updatePeaks(8, 10);
    flushRaf();

    expect(clearSpy).toHaveBeenCalled();
    // clearRect x should be near pixel 8, NOT 0
    const [x] = clearSpy.mock.calls[0];
    expect(x).toBeGreaterThanOrEqual(8);

    document.body.removeChild(el);
  });

  it('batches multiple updatePeaks into single rAF draw', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 200;
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));

    el.peaks = new Int16Array(20);
    flushRaf();

    const canvas = el.shadowRoot?.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    const clearSpy = vi.spyOn(ctx, 'clearRect');

    // Two incremental updates before rAF fires
    el.updatePeaks(2, 4);
    el.updatePeaks(7, 9);
    flushRaf();

    // Should be one clearRect call covering the merged range (2-9)
    expect(clearSpy).toHaveBeenCalledTimes(1);
    const [x, , width] = clearSpy.mock.calls[0];
    // Should cover from pixel 2 to pixel 9
    expect(x).toBeLessThanOrEqual(2);
    expect(x + width).toBeGreaterThanOrEqual(9);

    document.body.removeChild(el);
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: FAIL — `updatePeaks` is not defined

- [ ] **Step 3: Implement `updatePeaks()`**

Add to `daw-waveform.ts`:

```typescript
/**
 * Mark a range of peak indices as dirty for incremental redraw.
 * The caller must have already updated the underlying peaks array.
 * Does NOT trigger a Lit re-render — bypasses Lit entirely.
 */
updatePeaks(startIndex: number, endIndex: number) {
  for (let i = startIndex; i < endIndex; i++) {
    this._dirtyPixels.add(i);
  }
  this._scheduleDraw();
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-waveform.ts packages/dawcore/src/__tests__/daw-waveform.test.ts
git commit -m "feat(dawcore): add updatePeaks() for incremental rendering

Marks a range of peak indices as dirty without triggering Lit re-render.
Multiple calls batched into single rAF draw."
```

---

### Task 4: Handle layout property changes (waveHeight, barWidth, barGap)

**Files:**
- Modify: `packages/dawcore/src/__tests__/daw-waveform.test.ts`

- [ ] **Step 1: Write test for layout change triggering full dirty**

```typescript
  it('marks all dirty when waveHeight changes', async () => {
    const el = document.createElement('daw-waveform') as any;
    el.length = 100;
    el.peaks = new Int16Array([0, 100, -50, 200, 0, 150, -100, 300]);
    document.body.appendChild(el);
    await new Promise((r) => setTimeout(r, 50));
    flushRaf(); // initial draw

    const canvas = el.shadowRoot?.querySelector('canvas');
    const ctx = canvas?.getContext('2d');
    const clearSpy = vi.spyOn(ctx, 'clearRect');

    el.waveHeight = 256;
    await new Promise((r) => setTimeout(r, 50));
    flushRaf();

    expect(clearSpy).toHaveBeenCalled();
    document.body.removeChild(el);
  });
```

- [ ] **Step 2: Run test — should pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: PASS — `updated()` already calls `_markAllDirty()` on any Lit property change (including `waveHeight`).

- [ ] **Step 3: Commit**

```bash
git add packages/dawcore/src/__tests__/daw-waveform.test.ts
git commit -m "test(dawcore): verify layout property changes trigger full redraw"
```

---

### Task 5: Remove `.bits` from daw-editor template and verify build

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

- [ ] **Step 1: Remove `.bits` binding from daw-editor template**

In `packages/dawcore/src/elements/daw-editor.ts`, find the `daw-waveform` template (around line 749-761) and remove:

```typescript
.bits=${16}
```

So the template becomes:

```html
<daw-waveform
  style="position: absolute; left: ${clipLeft}px; top: ${chIdx * channelHeight}px;"
  .peaks=${channelPeaks}
  .length=${peakData?.length ?? width}
  .waveHeight=${channelHeight}
  .barWidth=${this.barWidth}
  .barGap=${this.barGap}
  .visibleStart=${this._viewport.visibleStart}
  .visibleEnd=${this._viewport.visibleEnd}
  .originX=${clipLeft}
></daw-waveform>
```

- [ ] **Step 2: Run full test suite**

Run: `cd packages/dawcore && npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Run typecheck**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: No errors

- [ ] **Step 4: Run lint**

Run: `pnpm format && pnpm lint`
Expected: No errors (warnings only)

- [ ] **Step 5: Build**

Run: `pnpm --filter @dawcore/components build`
Expected: Clean build

- [ ] **Step 6: Verify daw-editor line count**

Run: `wc -l packages/dawcore/src/elements/daw-editor.ts`
Expected: <= 779 (removed 1 line)

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts
git commit -m "refactor(dawcore): remove .bits binding from daw-editor template

bits is now derived from the peaks typed array (Int8Array→8, Int16Array→16)."
```

---

### Task 6: Update CLAUDE.md and existing tests

**Files:**
- Modify: `packages/dawcore/CLAUDE.md`
- Modify: `packages/dawcore/src/__tests__/daw-waveform.test.ts` (update default property test if `bits` was checked)

- [ ] **Step 1: Update daw-waveform section in CLAUDE.md**

In the "Visual elements" section of `packages/dawcore/CLAUDE.md`, update the `<daw-waveform>` entry:

```markdown
- `<daw-waveform>` — Chunked canvas rendering (1000px chunks). Receives peaks as JS properties. Uses dirty pixel tracking for incremental rendering — `updatePeaks(startIndex, endIndex)` marks a range dirty without full redraw. Bits derived from typed array (Int8Array→8, Int16Array→16). Drawing batched via `requestAnimationFrame`.
```

- [ ] **Step 2: Commit**

```bash
git add packages/dawcore/CLAUDE.md
git commit -m "docs(dawcore): document incremental rendering in CLAUDE.md"
```
