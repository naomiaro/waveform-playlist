# Incremental Canvas Rendering — Design Spec

**Date:** 2026-03-20
**Scope:** `@dawcore/components` — `daw-waveform` element only
**Branch:** `feat/incremental-canvas-render`

## Problem

`daw-waveform` does a full `clearRect()` + redraw of every bar in every visible canvas chunk on any peak update. During recording, new peaks arrive at ~60fps but only 1-2 pixels change per frame. Redrawing thousands of bars 60 times per second is wasteful.

## Solution

Add dirty pixel tracking to `daw-waveform`. A `Set<number>` tracks which peak indices need redrawing. On each animation frame, only the dirty region is cleared and redrawn. Full redraws still happen on zoom, load, and layout changes — they just mark all peaks dirty through the same code path.

Inspired by the mediabunny-worker-decoder pattern: dirty Set + running min/max + partial clearRect.

## Coordinate System

**Peak index** is the unit throughout. Peak index N corresponds to interleaved data at `peaks[N*2]` (min) and `peaks[N*2+1]` (max). When `barWidth=1, barGap=0`, peak index equals pixel column. When `barWidth > 1` or `barGap > 0`, the drawing loop maps peak indices to bar positions via `step = barWidth + barGap`. The dirty set stores peak indices, and the draw loop converts them to canvas pixel coordinates.

## API

### Full replacement (load, zoom, resize)

```typescript
// Setting .peaks marks all peak indices dirty and triggers redraw.
// Also calls requestUpdate() to trigger Lit re-render (container sizing, chunk creation).
waveform.peaks = newInt16Array;
```

- `bits` derived from array type: `Int8Array` → 8, `Int16Array` → 16
- No separate `bits` property

### Incremental update (recording append, partial redraw)

```typescript
// Caller has already mutated/replaced the peaks array.
// This marks only the specified peak index range as dirty.
// Does NOT trigger a Lit re-render — bypasses Lit entirely.
waveform.updatePeaks(startIndex, endIndex);
```

`updatePeaks(start, end)` does NOT accept peak data — the caller is expected to have already updated the underlying array. The method just marks peak indices `start..end-1` dirty and schedules a rAF draw.

### Container width: `length` stays

The `length` property is retained as a Lit `@property` for container sizing. Per CLAUDE.md pattern #24, clip pixel width can differ from `peaks.length / 2` (audio may be shorter than configured clip duration). The editor sets `length` for the container `<div>` width and chunk calculations. Peak data length (`_peaks.length / 2`) controls how many bars are drawn; `length` controls how wide the container is.

### Remaining Lit properties

- `length: number` — container/clip pixel width (set by editor)
- `waveHeight: number` — canvas height
- `barWidth: number` — bar width in pixels
- `barGap: number` — gap between bars
- `visibleStart / visibleEnd / originX` — viewport (from ViewportController)

Changes to `waveHeight`, `barWidth`, or `barGap` mark all peaks dirty (layout changed). Viewport changes trigger Lit re-render (add/remove canvas chunks); newly created canvases are blank and need a full draw — `updated()` marks all visible peaks dirty.

## Internal State

```typescript
// Mutable — NOT a Lit @property (avoids triggering Lit re-renders on updatePeaks)
private _peaks: Peaks = new Int16Array(0);

// Dirty peak indices needing redraw
private _dirtyPixels: Set<number> = new Set();

// Whether a rAF draw is already scheduled
private _drawScheduled = false;
```

### `.peaks` setter

```typescript
set peaks(value: Peaks) {
  this._peaks = value;
  this._markAllDirty();
  this.requestUpdate();  // Trigger Lit re-render for container sizing
}
get peaks(): Peaks {
  return this._peaks;
}
```

The setter calls `requestUpdate()` so Lit re-runs `render()` (updates container width, creates/destroys canvas chunks). It also marks all peaks dirty so the scheduled rAF redraws everything.

## Drawing Algorithm

When peaks are marked dirty, schedule a single `requestAnimationFrame` if one isn't already pending. The rAF callback:

1. If dirty set is empty → return
2. Compute bits from `_peaks` type, peak count from `_peaks.length / 2`
3. Query canvases from Shadow DOM: `shadowRoot.querySelectorAll('canvas')`
4. Group dirty peak indices by canvas chunk (`Math.floor(index / MAX_CANVAS_WIDTH)`)
5. Per chunk with dirty peaks:
   - Get canvas context, apply `ctx.scale(dpr, dpr)` transform
   - Find min/max dirty peak index within that chunk → convert to local pixel coordinates
   - `clearRect(minLocalX, 0, dirtyWidth, height)` — partial clear (in scaled coordinates, after `ctx.scale`)
   - Draw only bars that overlap the dirty region using the existing `aggregatePeaks` + `calculateBarRects` + `fillRect` loop
   - `ctx.resetTransform()` before `clearRect` to work in physical pixels, then `ctx.scale(dpr, dpr)` for drawing — OR — do both clear and draw in scaled coordinates. Implementation will follow the cleaner pattern.
6. Clear the dirty set and `_drawScheduled` flag

### Lit `updated()` behavior

`updated()` no longer calls `_drawVisibleChunks()` directly. Instead, it marks all visible peaks dirty and schedules a rAF draw. This prevents double-drawing (once from `updated()` synchronously, once from rAF). All drawing goes through the single rAF path.

Canvas chunks may be created or destroyed during Lit's render. The rAF callback always queries fresh canvases from Shadow DOM, so it naturally sees the current set of canvases — no stale references.

### When Lit render does NOT run

`updatePeaks(startIndex, endIndex)` bypasses Lit entirely — it marks peak indices dirty and schedules a rAF draw without triggering a Lit update. This is the fast path for recording. The caller must ensure `length` is already correct (or set it separately if the clip grew).

## Dirty Marking Rules

| Trigger | Peaks marked dirty |
|---------|-------------------|
| `.peaks` setter | All (`0..peakCount-1`) |
| `updatePeaks(start, end)` | Range `start..end-1` |
| `length` change | All |
| `waveHeight` change | All |
| `barWidth` / `barGap` change | All |
| `updated()` (after Lit re-render) | All visible (ensures new canvas chunks get drawn) |

## Integration with `daw-editor`

**Minimal changes to `daw-editor.ts`.** Remove `.bits` from the template binding (derived from array type). Keep `.length` (needed for container sizing). The editor continues using the full-replacement path (setting `.peaks` via Lit property binding). The incremental `updatePeaks()` API is available for when recording support is added to dawcore.

## Testing

### Unit tests for `daw-waveform`:

1. Full redraw on `.peaks` set — clearRect covers full canvas width
2. Incremental `updatePeaks(start, end)` — clearRect covers only the dirty region
3. Multiple `updatePeaks` calls batched into single rAF — one draw covers both ranges
4. Empty dirty set skips draw — no clearRect called
5. Bits derived from array type (Int8Array → 8, Int16Array → 16)
6. Peak count derived from array (`peaks.length / 2`)
7. `updated()` marks all visible peaks dirty (new canvas chunks drawn)
8. `barWidth`/`barGap`/`waveHeight` change marks all dirty — full redraw

**Mocking:** `requestAnimationFrame` stubbed (same pattern as `AudioResumeController` tests). Spy on canvas context `clearRect` and `fillRect` to verify partial vs full clears.

## Files Changed

- **Modified:** `packages/dawcore/src/elements/daw-waveform.ts` — dirty tracking, `updatePeaks()`, rAF-batched draw, peaks setter
- **Modified:** `packages/dawcore/src/__tests__/daw-waveform.test.ts` — new/updated tests for incremental rendering
- **Modified:** `packages/dawcore/src/elements/daw-editor.ts` — remove `.bits` from `daw-waveform` template binding

## Non-Goals

- OffscreenCanvas / web worker rendering — future optimization
- Changes to the React browser package — separate rendering pipeline
- Recording support in dawcore — this PR builds the incremental rendering capability; recording wiring comes later
- Smart diffing of old vs new peaks — full replacement marks all dirty, incremental path is caller-directed
