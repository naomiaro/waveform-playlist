# Variable Tempo Grid

**Date:** 2026-03-30
**Status:** Draft
**Scope:** Wire variable tempo through dawcore grid rendering — callback interface, per-segment waveform rendering, beat-map demo page

---

## Overview

Upgrade `<daw-editor>` from single-BPM beats mode to variable tempo support. The editor accepts `secondsToTicks`/`ticksToSeconds` conversion callbacks that consumers wire to their tempo source (e.g., Transport's TempoMap). All seconds↔ticks conversions route through these callbacks, enabling tempo curves, accelerando, ritardando, and beat-tracked live recordings.

The grid and ruler remain tick-linear (unchanged). The waveform renderer iterates clips in fine tick steps, mapping each step to audio sample ranges via the tempo callbacks — producing correctly stretched/compressed waveforms at tempo changes.

## Design Decisions

### Callback Interface (Not TempoMap Dependency)

The editor accepts two optional functions, not a TempoMap object. This keeps dawcore decoupled from the transport package — consumers with a different playout engine can provide their own conversion functions.

### Backwards Compatible

When callbacks are not provided, the editor falls back to single-BPM math (`ticks = seconds × bpm × ppqn / 60`). Existing usage with the `bpm` property works unchanged.

### Per-Segment Waveform Rendering

Following the openDAW `AudioRenderer` pattern: iterate clips in fine tick steps (~80 ticks, matching the transport's integration resolution), convert each step to audio time via callbacks, render peaks for that sample range into the corresponding pixel range. Each segment selects its own optimal peak stage via `nearest(samplesPerPixel)`.

### No Change to Peak Generation

The peak pipeline generates at its base scale (default 128 samples per peak). Multi-resolution stages handle any zoom/tempo combination. The per-segment drawer picks the right stage per call. No `_renderSpp` change needed for variable tempo.

---

## 1. Callback Properties on `<daw-editor>`

```typescript
@property({ attribute: false })
secondsToTicks?: (seconds: number) => number;

@property({ attribute: false })
ticksToSeconds?: (ticks: number) => number;
```

Private helper methods encapsulate the fallback:

```typescript
private _secondsToTicks(seconds: number): number {
  if (this.secondsToTicks) return this.secondsToTicks(seconds);
  return (seconds * this.bpm * this.ppqn) / 60;
}

private _ticksToSeconds(ticks: number): number {
  if (this.ticksToSeconds) return this.ticksToSeconds(ticks);
  return (ticks * 60) / (this.bpm * this.ppqn);
}
```

These methods are also exposed on the host interfaces (`PointerHandlerHost`, `ClipPointerHost`) so interaction handlers use them.

---

## 2. Conversion Point Replacements

Every formula `seconds × bpm × ppqn / 60` or `ticks × 60 / (bpm × ppqn)` is replaced with the helper methods.

### In `daw-editor.ts`

| Location | Current | Replacement |
|----------|---------|-------------|
| `_totalWidth` | `(duration * bpm * ppqn) / 60 / ticksPerPixel` | `this._secondsToTicks(duration) / ticksPerPixel` |
| Selection pixels | `(selTime * bpm * ppqn) / 60` | `this._secondsToTicks(selTime)` |
| Clip positioning | `(startSec * bpm * ppqn) / 60` | `this._secondsToTicks(startSec)` |
| Playhead animation | passes `bpm` to playhead | passes `this._secondsToTicks` function |

### In `daw-playhead.ts`

New method replacing `startBeatsAnimation(getTime, bpm, ppqn, ticksPerPixel)`:

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

### In `pointer-handler.ts`

```typescript
private _pxToTime(px: number): number {
  const h = this._host;
  if (h.scaleMode === 'beats') {
    let tick = px * h.ticksPerPixel;
    tick = snapTickToGrid(tick, h.snapTo, h.timeSignature, h.ppqn);
    return h._ticksToSeconds(tick);  // was: (tick * 60) / (h.bpm * h.ppqn)
  }
  return pixelsToSeconds(px, h.samplesPerPixel, h.effectiveSampleRate);
}

private _timeToPx(time: number): number {
  const h = this._host;
  if (h.scaleMode === 'beats') {
    const tick = h._secondsToTicks(time);  // was: (time * bpm * ppqn) / 60
    return tick / h.ticksPerPixel;
  }
  return (time * h.effectiveSampleRate) / h.samplesPerPixel;
}
```

### In `clip-pointer-handler.ts`

```typescript
private _snapDeltaToSamples(totalDeltaPx: number, anchorSample: number): number {
  const h = this._host;
  if (h.scaleMode === 'beats') {
    const anchorSeconds = anchorSample / h.effectiveSampleRate;
    const anchorTick = h._secondsToTicks(anchorSeconds);  // was: (seconds * bpm * ppqn) / 60
    const deltaTicks = totalDeltaPx * h.ticksPerPixel;
    const targetTick = anchorTick + deltaTicks;
    const snappedTick = h.snapTo !== 'off'
      ? snapTickToGrid(targetTick, h.snapTo, h.timeSignature, h.ppqn)
      : targetTick;
    const snappedSeconds = h._ticksToSeconds(snappedTick);  // was: (tick * 60) / (bpm * ppqn)
    const snappedSample = Math.round(snappedSeconds * h.effectiveSampleRate);
    return snappedSample - anchorSample;
  }
  return Math.round(totalDeltaPx * h.renderSamplesPerPixel);
}
```

### What Doesn't Change

- `computeMusicalTicks()` — pure tick arithmetic, no tempo
- `<daw-grid>` — tick-linear rendering
- `<daw-ruler>` — tick-linear rendering
- `snapTickToGrid()` — pure tick arithmetic
- Peak generation pipeline — base scale unchanged

---

## 3. Per-Segment Waveform Rendering

### WaveformSegment Interface

```typescript
interface WaveformSegment {
  sampleStart: number;   // start sample offset into audio
  sampleEnd: number;     // end sample offset into audio
  pixelStart: number;    // start pixel within the waveform element
  pixelEnd: number;      // end pixel within the waveform element
}
```

### New Property on `<daw-waveform>`

```typescript
@property({ attribute: false })
segments?: WaveformSegment[];
```

When `segments` is undefined, current uniform rendering behavior applies. When provided, the drawing loop iterates segments.

### Drawing Logic (Segments Mode)

For each segment, compute per-segment `samplesPerPixel`, select the optimal peak stage, and draw:

```
for each segment in segments:
  spp = (segment.sampleEnd - segment.sampleStart) / (segment.pixelEnd - segment.pixelStart)
  stage = peaks.nearestStage(spp)  // per-segment stage selection

  // draw peaks for [segment.pixelStart, segment.pixelEnd]
  // from peak data at [segment.sampleStart, segment.sampleEnd]
  // using the selected stage's resolution
```

This mirrors openDAW's `renderPixelStrips` — called per segment with its own Layout, `peaks.nearest(unitsEachPixel)` picks the right stage per call.

### Segment Computation (In Editor Render)

When `secondsToTicks` callback is provided and `scaleMode === 'beats'`:

```typescript
const MIN_RENDER_STEP = 80;  // match transport integration grid (~10ms)
const stepTicks = Math.max(MIN_RENDER_STEP, Math.ceil(this.ticksPerPixel));

const clipStartSec = clip.startSample / sr;
const clipOffsetSec = clip.offsetSamples / sr;
const clipEndSec = clipStartSec + clip.durationSamples / sr;

const startTick = this._secondsToTicks(clipStartSec);
const endTick = this._secondsToTicks(clipEndSec);

const segments: WaveformSegment[] = [];
for (let tick = startTick; tick < endTick; tick += stepTicks) {
  const segEndTick = Math.min(tick + stepTicks, endTick);

  const segStartAudioSec = this._ticksToSeconds(tick) - clipStartSec + clipOffsetSec;
  const segEndAudioSec = this._ticksToSeconds(segEndTick) - clipStartSec + clipOffsetSec;

  segments.push({
    sampleStart: Math.round(segStartAudioSec * sr),
    sampleEnd: Math.round(segEndAudioSec * sr),
    pixelStart: (tick - startTick) / this.ticksPerPixel,
    pixelEnd: (segEndTick - startTick) / this.ticksPerPixel,
  });
}
```

When callbacks are NOT provided (single-BPM fallback), no segments are computed — current uniform rendering applies.

### Step Size

`stepTicks = max(80, ceil(ticksPerPixel))`

- At fine zoom (ticksPerPixel=24): step = 80 ticks (~10ms). Many segments per beat, smooth tempo curve following.
- At coarse zoom (ticksPerPixel=128): step = 128 ticks. Fewer segments, each covering 1+ pixels.
- Minimum of 80 matches the transport's `TempoChangeGrid` — the integration resolution for trapezoidal tempo curve math.

---

## 4. `_renderSpp` in Variable Tempo Mode

`_renderSpp` is still used for:
- Peak generation (via `_peakPipeline.generatePeaks()`)
- Peak re-extraction (via `_peakPipeline.reextractPeaks()`)
- `ClipPeakSyncHost.renderSamplesPerPixel`

In variable tempo mode, `_renderSpp` continues to use the `bpm` property as a baseline. This is fine because:
- Peak data is generated at the pipeline's base scale (128)
- Multi-resolution stages handle any zoom level
- Per-segment stage selection at draw time picks the right resolution
- `_renderSpp` just determines the scale for caching/extraction — a reasonable baseline is sufficient

No change to `_renderSpp` for this spec.

---

## 5. Host Interface Changes

### PointerHandlerHost

Add the conversion methods:

```typescript
readonly _secondsToTicks: (seconds: number) => number;
readonly _ticksToSeconds: (ticks: number) => number;
```

Remove direct `bpm` usage from `_pxToTime` and `_timeToPx` — they call these methods instead.

### ClipPointerHost

Same additions:

```typescript
readonly _secondsToTicks: (seconds: number) => number;
readonly _ticksToSeconds: (ticks: number) => number;
```

Remove direct `bpm` usage from `_snapDeltaToSamples`.

### Backward Compatibility

Both `bpm` and `ppqn` remain on the host interfaces for:
- The single-BPM fallback (when callbacks not provided)
- The `_renderSpp` computation
- Any consumer code that reads them

---

## 6. New Dev Page: `beat-map-grid.html`

Combines drag-and-drop audio + beat map with the full dawcore editor.

### UI

- Drop zone for audio file
- Drop zone for `.beats` file
- Full `<daw-editor>` with grid, ruler, playhead, waveform
- Transport controls (play/pause/stop)
- Zoom controls (ticksPerPixel)
- Snap dropdown
- BPM display (shows live BPM at playhead position)
- Metronome toggle with volume slider
- Beat indicator dots

### Flow

1. User drops audio file → decoded, loaded into single `<daw-track>` / `<daw-clip>`
2. User drops `.beats` file → parsed, tempo events derived, Transport created
3. Transport's `tempoMap.secondsToTicks` and `tempoMap.ticksToSeconds` wired as editor callbacks
4. Editor re-renders with variable tempo — grid tick-linear, waveforms segmented, playhead follows curve
5. Metronome plays via Transport alongside audio

### Without Beat Map

Editor works with single `bpm` (default 120). Audio plays, grid renders, all features work. The beat map is an enhancement.

### Beat Map Parsing

Same algorithm as `beat-map.html`:
- Parse `.beats` format: `"time_seconds" "beat_number"\n`
- Find first downbeat (beat 1) → align to bar 2
- Derive per-beat BPM: `60 / (beat[i+1].time - beat[i].time)`
- Set tempo events on Transport via `setTempo(bpm, atTick)`
- Compute `audioStartOffset` for playback sync

---

## 7. Refresh Strategy

When tempo callbacks change (e.g., new beat map loaded):

1. Peaks don't need regeneration — base scale is tempo-independent
2. Clip positions recompute on next render (Lit reactive update)
3. Playhead restarts animation with new callbacks
4. `_totalWidth` recomputes on next render
5. Selection pixels recompute on next render

Trigger: when `secondsToTicks` or `ticksToSeconds` property changes, `requestUpdate()` fires (Lit default for `@property`). The render pass picks up the new callbacks.

---

## Testing

### Unit Tests (core)

- No changes to `computeMusicalTicks` or `snapTickToGrid` — existing tests sufficient

### Unit Tests (dawcore)

- `_secondsToTicks` / `_ticksToSeconds` fallback behavior (no callbacks → single BPM math)
- `_secondsToTicks` / `_ticksToSeconds` with callbacks (delegates correctly)
- Pointer handler uses host conversion methods
- Clip pointer handler uses host conversion methods
- `<daw-waveform>` segments mode: draws per-segment with independent stage selection

### Manual Testing

- `beat-map-grid.html` with Scar Tissue + beat map → waveform transients align with grid at varying tempo
- Zoom in/out → segments adapt, peaks remain sharp
- Play → playhead follows tempo curve, metronome clicks on beats
- Seek → playhead positions correctly at any point on tempo curve
- Snap → clips snap to grid boundaries
- Without beat map → single BPM behavior unchanged
- `beats-grid.html` → existing multi-track demo unchanged (no callbacks)

---

## Deferred Work

- **Time signature changes from beat map** — Beat This! outputs beat numbers (1-4) implying 4/4. Future: detect meter changes (e.g., 3-beat groups) and call `transport.setMeter()`.
- **Waveform caching** — per-segment rendering recomputes segments on every render. Future: cache segments keyed by (ticksPerPixel + tempo version).
- **Trim visual feedback in variable tempo** — currently uses `_renderSpp` for pixel conversion during drag. Could use per-segment approach for accuracy at tempo changes within a clip.
- **Clip PPQN positions** — clips still store `startSample`. Future: add `startTick` for pixel-perfect grid alignment without sample round-trip (Phase 1 of dual timebase roadmap).
