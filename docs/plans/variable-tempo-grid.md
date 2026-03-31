# Variable Tempo Grid — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire variable tempo through dawcore's beats-mode rendering — callback interface, per-segment waveform rendering, and a beat-map-grid demo page.

**Architecture:** Two optional callback properties (`secondsToTicks`/`ticksToSeconds`) on `<daw-editor>` replace all single-BPM conversion formulas. The grid/ruler/snap stay tick-linear (unchanged). Per-segment waveform rendering iterates clips in fine tick steps (~80 ticks), converting each step to audio time via the callbacks. A new demo page combines drag-and-drop audio + `.beats` files with the full dawcore editor.

**Tech Stack:** Lit 3, TypeScript, vitest, Canvas API, `@dawcore/transport` (TempoMap)

**Spec:** `docs/specs/variable-tempo-grid.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `packages/dawcore/dev/beat-map-grid.html` | Demo page: drag-and-drop audio + beat map with full dawcore editor |

### Modified Files

| File | Changes |
|------|---------|
| `packages/dawcore/src/elements/daw-editor.ts` | Add `secondsToTicks`/`ticksToSeconds` callback properties, helper methods, replace all single-BPM formulas, per-segment clip rendering, playhead wiring |
| `packages/dawcore/src/elements/daw-playhead.ts` | Add `startBeatsAnimationWithMap`/`stopBeatsAnimationWithMap` methods using callback |
| `packages/dawcore/src/interactions/pointer-handler.ts` | Add `_secondsToTicks`/`_ticksToSeconds` to host interface, use in `_pxToTime`/`_timeToPx` |
| `packages/dawcore/src/interactions/clip-pointer-handler.ts` | Add `_secondsToTicks`/`_ticksToSeconds` to host interface, use in `_snapDeltaToSamples` |
| `packages/dawcore/src/__tests__/pointer-handler.test.ts` | Add conversion methods to mock host |
| `packages/dawcore/src/__tests__/clip-pointer-handler.test.ts` | Add conversion methods to mock host |
| `packages/dawcore/src/elements/daw-waveform.ts` | Add optional `segments` property, per-segment drawing mode |

---

## Task 1: Callback Properties and Helper Methods on Editor

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

- [ ] **Step 1: Add callback properties after the `snapTo` property**

```typescript
  /** Optional tempo-aware conversion: seconds → PPQN ticks. When provided, enables variable tempo. */
  @property({ attribute: false })
  secondsToTicks?: (seconds: number) => number;

  /** Optional tempo-aware conversion: PPQN ticks → seconds. Required alongside secondsToTicks. */
  @property({ attribute: false })
  ticksToSeconds?: (ticks: number) => number;
```

- [ ] **Step 2: Add private helper methods after `_renderSpp` getter**

```typescript
  /** Convert seconds to ticks — uses callback if provided, otherwise single-BPM fallback. */
  _secondsToTicks(seconds: number): number {
    if (this.secondsToTicks) return this.secondsToTicks(seconds);
    return (seconds * this.bpm * this.ppqn) / 60;
  }

  /** Convert ticks to seconds — uses callback if provided, otherwise single-BPM fallback. */
  _ticksToSeconds(ticks: number): number {
    if (this.ticksToSeconds) return this.ticksToSeconds(ticks);
    return (ticks * 60) / (this.bpm * this.ppqn);
  }
```

- [ ] **Step 3: Replace `_totalWidth` formula**

Replace:
```typescript
  private get _totalWidth(): number {
    if (this.scaleMode === 'beats') {
      const totalTicks = (this._duration * this.bpm * this.ppqn) / 60;
      return Math.ceil(totalTicks / this.ticksPerPixel);
    }
```

With:
```typescript
  private get _totalWidth(): number {
    if (this.scaleMode === 'beats') {
      const totalTicks = this._secondsToTicks(this._duration);
      return Math.ceil(totalTicks / this.ticksPerPixel);
    }
```

- [ ] **Step 4: Replace selection pixel computation in render()**

Replace:
```typescript
      const startTick = (this._selectionStartTime * this.bpm * this.ppqn) / 60;
      const endTick = (this._selectionEndTime * this.bpm * this.ppqn) / 60;
```

With:
```typescript
      const startTick = this._secondsToTicks(this._selectionStartTime);
      const endTick = this._secondsToTicks(this._selectionEndTime);
```

- [ ] **Step 5: Replace clip positioning in render()**

Replace:
```typescript
                    const startTick = (startSec * this.bpm * this.ppqn) / 60;
                    const endTick = ((startSec + durSec) * this.bpm * this.ppqn) / 60;
```

With:
```typescript
                    const startTick = this._secondsToTicks(startSec);
                    const endTick = this._secondsToTicks(startSec + durSec);
```

- [ ] **Step 6: Add callback change to willUpdate zoom detection**

Add `secondsToTicks` and `ticksToSeconds` to the playhead restart and zoom change conditions:

```typescript
    if (
      (changedProperties.has('samplesPerPixel') ||
        changedProperties.has('ticksPerPixel') ||
        changedProperties.has('bpm') ||
        changedProperties.has('secondsToTicks')) &&
      this._isPlaying
    ) {
      this._startPlayhead();
    }

    const zoomChanged =
      changedProperties.has('samplesPerPixel') ||
      changedProperties.has('ticksPerPixel') ||
      changedProperties.has('bpm') ||
      changedProperties.has('scaleMode') ||
      changedProperties.has('secondsToTicks');
```

- [ ] **Step 7: Run typecheck**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts
git commit -m "feat(dawcore): add secondsToTicks/ticksToSeconds callbacks to editor

Optional callback properties for variable tempo support. When provided,
all seconds↔ticks conversions route through them. When absent, falls
back to single-BPM math (backwards compatible)."
```

---

## Task 2: Playhead Variable Tempo Animation

**Files:**
- Modify: `packages/dawcore/src/elements/daw-playhead.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

- [ ] **Step 1: Add new playhead methods using callback**

Add after `stopBeatsAnimation()` in `daw-playhead.ts`:

```typescript
  startBeatsAnimationWithMap(
    getTime: () => number,
    secondsToTicks: (s: number) => number,
    ticksPerPixel: number
  ) {
    this._animation.start(() => {
      const time = getTime();
      const tick = secondsToTicks(time);
      const px = tick / ticksPerPixel;
      if (this._line) {
        this._line.style.transform = `translate3d(${px}px, 0, 0)`;
      }
    });
  }

  stopBeatsAnimationWithMap(
    time: number,
    secondsToTicks: (s: number) => number,
    ticksPerPixel: number
  ) {
    this._animation.stop();
    const px = secondsToTicks(time) / ticksPerPixel;
    if (this._line) {
      this._line.style.transform = `translate3d(${px}px, 0, 0)`;
    }
  }
```

- [ ] **Step 2: Update editor `_startPlayhead()` to use new methods**

Replace the beats mode branch in `_startPlayhead()`:

```typescript
    if (this.scaleMode === 'beats') {
      const secondsToTicksFn = (s: number) => this._secondsToTicks(s);
      playhead.startBeatsAnimationWithMap(
        () => {
          const latency = 'outputLatency' in ctx ? (ctx as AudioContext).outputLatency : 0;
          return Math.max(0, engine.getCurrentTime() - latency);
        },
        secondsToTicksFn,
        this.ticksPerPixel
      );
    }
```

- [ ] **Step 3: Update editor `_stopPlayhead()` to use new methods**

Replace the beats mode branch in `_stopPlayhead()`:

```typescript
    if (this.scaleMode === 'beats') {
      playhead.stopBeatsAnimationWithMap(
        this._currentTime,
        (s: number) => this._secondsToTicks(s),
        this.ticksPerPixel
      );
    }
```

- [ ] **Step 4: Run typecheck**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-playhead.ts packages/dawcore/src/elements/daw-editor.ts
git commit -m "feat(dawcore): add variable tempo playhead animation

New startBeatsAnimationWithMap/stopBeatsAnimationWithMap methods that
accept a secondsToTicks callback instead of fixed BPM. The callback
is called per animation frame, allowing the playhead to follow tempo
curves."
```

---

## Task 3: Pointer Handler Conversion Methods

**Files:**
- Modify: `packages/dawcore/src/interactions/pointer-handler.ts`
- Modify: `packages/dawcore/src/__tests__/pointer-handler.test.ts`

- [ ] **Step 1: Add conversion methods to `PointerHandlerHost` interface**

Replace `readonly bpm: number;` and `readonly ppqn: number;` in the interface with:

```typescript
  readonly bpm: number;
  readonly ppqn: number;
  readonly timeSignature: [number, number];
  readonly snapTo: SnapTo;
  readonly _secondsToTicks: (seconds: number) => number;
  readonly _ticksToSeconds: (ticks: number) => number;
```

- [ ] **Step 2: Update `_pxToTime()` to use host conversion**

Replace:
```typescript
      return (tick * 60) / (h.bpm * h.ppqn);
```
With:
```typescript
      return h._ticksToSeconds(tick);
```

- [ ] **Step 3: Update `_timeToPx()` to use host conversion**

Replace:
```typescript
      const tick = (time * h.bpm * h.ppqn) / 60;
```
With:
```typescript
      const tick = h._secondsToTicks(time);
```

- [ ] **Step 4: Update test mock to include conversion methods**

Add to the mock host in `pointer-handler.test.ts`:

```typescript
    _secondsToTicks: (s: number) => (s * 120 * 960) / 60,
    _ticksToSeconds: (t: number) => (t * 60) / (120 * 960),
```

- [ ] **Step 5: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/pointer-handler.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/interactions/pointer-handler.ts packages/dawcore/src/__tests__/pointer-handler.test.ts
git commit -m "feat(dawcore): use conversion callbacks in pointer handler"
```

---

## Task 4: Clip Pointer Handler Conversion Methods

**Files:**
- Modify: `packages/dawcore/src/interactions/clip-pointer-handler.ts`
- Modify: `packages/dawcore/src/__tests__/clip-pointer-handler.test.ts`

- [ ] **Step 1: Add conversion methods to `ClipPointerHost` interface**

Add after existing `readonly snapTo: SnapTo;`:

```typescript
  readonly _secondsToTicks: (seconds: number) => number;
  readonly _ticksToSeconds: (ticks: number) => number;
```

- [ ] **Step 2: Update `_snapDeltaToSamples()` to use host conversion**

Replace:
```typescript
      const anchorTick = (anchorSeconds * h.bpm * h.ppqn) / 60;
```
With:
```typescript
      const anchorTick = h._secondsToTicks(anchorSeconds);
```

Replace:
```typescript
      const snappedSeconds = (snappedTick * 60) / (h.bpm * h.ppqn);
```
With:
```typescript
      const snappedSeconds = h._ticksToSeconds(snappedTick);
```

- [ ] **Step 3: Update trim deltaPx conversion in `onPointerMove()`**

Replace the beats-mode deltaPx computation:
```typescript
        const deltaSec = deltaSamples / h.effectiveSampleRate;
        const deltaTicks = (deltaSec * h.bpm * h.ppqn) / 60;
        deltaPx = Math.round(deltaTicks / h.ticksPerPixel);
```
With:
```typescript
        const anchorSec = anchor / h.effectiveSampleRate;
        const anchorTick = h._secondsToTicks(anchorSec);
        const newSec = anchorSec + deltaSamples / h.effectiveSampleRate;
        const newTick = h._secondsToTicks(newSec);
        deltaPx = Math.round((newTick - anchorTick) / h.ticksPerPixel);
```

- [ ] **Step 4: Update test mock**

Add to the mock host in `clip-pointer-handler.test.ts`:

```typescript
    _secondsToTicks: (s: number) => (s * 120 * 960) / 60,
    _ticksToSeconds: (t: number) => (t * 60) / (120 * 960),
```

- [ ] **Step 5: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/clip-pointer-handler.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/interactions/clip-pointer-handler.ts packages/dawcore/src/__tests__/clip-pointer-handler.test.ts
git commit -m "feat(dawcore): use conversion callbacks in clip pointer handler"
```

---

## Task 5: Waveform Segments Mode

**Files:**
- Modify: `packages/dawcore/src/elements/daw-waveform.ts`

- [ ] **Step 1: Add WaveformSegment type and property**

Add before the class declaration:

```typescript
/** A segment mapping audio samples to a pixel range within the waveform. */
export interface WaveformSegment {
  sampleStart: number;
  sampleEnd: number;
  pixelStart: number;
  pixelEnd: number;
}
```

Add property to the class:

```typescript
  @property({ attribute: false })
  segments?: WaveformSegment[];
```

- [ ] **Step 2: Add segment-aware drawing method**

Add a new private method `_drawSegments()`:

```typescript
  private _drawSegments(
    canvas: HTMLCanvasElement,
    chunkIdx: number,
    dpr: number,
    halfHeight: number,
    bits: Bits,
    waveColor: string
  ) {
    if (!this.segments) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const globalOffset = chunkIdx * MAX_CANVAS_WIDTH;
    const canvasWidth = Math.min(MAX_CANVAS_WIDTH, this.length - globalOffset);

    ctx.resetTransform();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.scale(dpr, dpr);
    ctx.fillStyle = waveColor;

    for (const seg of this.segments) {
      // Skip segments outside this chunk
      if (seg.pixelEnd <= globalOffset || seg.pixelStart >= globalOffset + canvasWidth) continue;

      const localStart = Math.max(0, seg.pixelStart - globalOffset);
      const localEnd = Math.min(canvasWidth, seg.pixelEnd - globalOffset);
      const segPixelWidth = seg.pixelEnd - seg.pixelStart;
      const segSampleWidth = seg.sampleEnd - seg.sampleStart;
      if (segPixelWidth <= 0 || segSampleWidth <= 0) continue;

      // Per-segment samples-per-pixel ratio
      const segSpp = segSampleWidth / segPixelWidth;
      const step = Math.max(1, Math.round(this.barWidth + this.barGap));

      for (let px = Math.floor(localStart); px < Math.ceil(localEnd); px += step) {
        // Map this pixel back to the segment's sample range
        const pxInSeg = (px + globalOffset) - seg.pixelStart;
        const samplePos = seg.sampleStart + pxInSeg * segSpp;
        const sampleEnd = samplePos + step * segSpp;

        const peak = aggregatePeaks(this._peaks, bits, Math.round(samplePos), Math.round(sampleEnd));
        if (!peak) continue;

        const rects = calculateBarRects(px, this.barWidth, halfHeight, peak.min, peak.max, 'normal');
        for (const r of rects) {
          ctx.fillRect(r.x, r.y, r.width, r.height);
        }
      }
    }
  }
```

- [ ] **Step 3: Use segments mode in the draw scheduler**

In the method that dispatches drawing (likely `_scheduleDraw` or the `updated()` path), add a check: if `this.segments` is defined, call `_drawSegments()` instead of the normal `_drawChunk()` for each canvas. The exact integration point depends on the current draw flow — read the `_scheduleDraw` method and add the branch.

- [ ] **Step 4: Export the WaveformSegment type from the package**

Add to `packages/dawcore/src/index.ts`:
```typescript
export type { WaveformSegment } from './elements/daw-waveform';
```

- [ ] **Step 5: Run typecheck**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-waveform.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add segments mode to daw-waveform

When segments property is provided, the waveform draws per-segment
with independent samples-per-pixel ratios. Each segment maps a sample
range to a pixel range, enabling variable-tempo waveform rendering."
```

---

## Task 6: Editor Per-Segment Clip Rendering

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

- [ ] **Step 1: Import WaveformSegment type**

Add to imports:
```typescript
import type { WaveformSegment } from './daw-waveform';
```

- [ ] **Step 2: Compute segments in clip rendering**

In the beats-mode clip rendering block, after computing `clipLeft` and `width`, add segment computation when callbacks are available:

```typescript
                    // Per-segment waveform rendering for variable tempo
                    let clipSegments: WaveformSegment[] | undefined;
                    if (this.secondsToTicks) {
                      const MIN_RENDER_STEP = 80;
                      const stepTicks = Math.max(MIN_RENDER_STEP, Math.ceil(this.ticksPerPixel));
                      const clipOffsetSec = clip.offsetSamples / sr;
                      clipSegments = [];
                      for (let tick = startTick; tick < endTick; tick += stepTicks) {
                        const segEndTick = Math.min(tick + stepTicks, endTick);
                        const segStartAudioSec = this._ticksToSeconds(tick) - startSec + clipOffsetSec;
                        const segEndAudioSec = this._ticksToSeconds(segEndTick) - startSec + clipOffsetSec;
                        clipSegments.push({
                          sampleStart: Math.round(segStartAudioSec * sr),
                          sampleEnd: Math.round(segEndAudioSec * sr),
                          pixelStart: (tick - startTick) / this.ticksPerPixel,
                          pixelEnd: (segEndTick - startTick) / this.ticksPerPixel,
                        });
                      }
                    }
```

- [ ] **Step 3: Pass segments to waveform elements**

Update the `<daw-waveform>` template to include `.segments`:

```typescript
                        html` <daw-waveform
                          style="position:absolute;left:0;top:${hdrH + chIdx * chH}px;"
                          .peaks=${chPeaks}
                          .length=${peakData?.length ?? width}
                          .waveHeight=${chH}
                          .barWidth=${this.barWidth}
                          .barGap=${this.barGap}
                          .visibleStart=${this._viewport.visibleStart}
                          .visibleEnd=${this._viewport.visibleEnd}
                          .originX=${clipLeft}
                          .segments=${clipSegments}
                        ></daw-waveform>`
```

- [ ] **Step 4: Run typecheck**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts
git commit -m "feat(dawcore): compute waveform segments for variable tempo clips

When secondsToTicks callback is provided, iterates clips in fine tick
steps (~80 ticks), computing audio sample ranges per segment. Each
segment gets its own samples-per-pixel ratio based on the local tempo."
```

---

## Task 7: Demo Page — `beat-map-grid.html`

**Files:**
- Create: `packages/dawcore/dev/beat-map-grid.html`

- [ ] **Step 1: Create the demo page**

Create `packages/dawcore/dev/beat-map-grid.html` combining:
- Drag-and-drop zones from `beat-map.html` (audio + .beats file)
- Full `<daw-editor>` with `<daw-grid>`, `<daw-keyboard-shortcuts>`, `<daw-track>`
- Transport controls, zoom, snap, metronome toggle + volume
- Beat indicator dots and bar/beat position display
- BPM display showing live tempo at playhead position

Key wiring:
- On `.beats` drop: parse beats, create Transport, set tempo events, wire `transport.tempoMap.secondsToTicks.bind(transport.tempoMap)` and `.ticksToSeconds.bind(transport.tempoMap)` as editor callbacks
- On audio drop: decode, create `<daw-clip>` element
- Play: start both Transport (metronome) and editor playback, sync via `audioStartOffset`
- Without beat map: editor uses single `bpm` (default 120)

- [ ] **Step 2: Verify the page loads**

Run: `cd packages/dawcore && pnpm dev:page`
Open: `http://localhost:5173/dev/beat-map-grid.html`
Expected: Drop zones visible, controls hidden until files loaded

- [ ] **Step 3: Commit**

```bash
git add packages/dawcore/dev/beat-map-grid.html
git commit -m "feat(dawcore): add beat-map-grid demo page

Drag-and-drop audio + Beat This! .beats file into a full dawcore
editor with variable tempo grid, ruler, waveform, playhead, metronome.
Tempo curve derived per-beat and wired as editor callbacks."
```

---

## Task 8: Full Build, Lint, and Test

- [ ] **Step 1: Run lint and format**

```bash
pnpm format && pnpm lint
```
Expected: 0 errors

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

- [ ] **Step 5: Manual test with beat map**

Drop an audio file and its `.beats` file into `beat-map-grid.html`. Verify:
- Waveform renders with segments adapting to tempo changes
- Grid lines are tick-linear (uniform beats)
- Playhead follows the tempo curve
- Metronome clicks on beats
- Zoom in/out works
- Snap works
- Without beat map, single-BPM behavior unchanged

- [ ] **Step 6: Verify existing demos unchanged**

Open `beats-grid.html` — multi-track stems work as before (no callbacks, single BPM).
Open `multiclip.html` — temporal mode unaffected.
