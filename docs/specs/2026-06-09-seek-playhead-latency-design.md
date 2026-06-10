# Seek Playhead Latency Compensation — Design

**Date:** 2026-06-09
**Status:** Approved
**Branch:** `fix/seek-playhead-latency`

## Problem

Clicking the timeline to seek lands the cursor *behind* the click point. Reproduces on
the React website (Tone adapter via `@waveform-playlist/browser`) and in dawcore when
`<daw-editor>` uses `TonePlayoutAdapter`. The native adapter is barely affected.

## Root Cause

Both consumers render the playhead at "audible time":

```
visual = rawEngineTime − audioContext.outputLatency − engine.lookAhead
```

- React provider: `toVisualTime()` / `setCurrentTimeRefs()` in
  `packages/browser/src/WaveformPlaylistContext.tsx` apply the subtraction
  unconditionally — including in `seekTo()`, which only writes refs.
- dawcore: the pointer handler's click-to-seek calls `engine.seek(time)` then
  `_stopPlayhead()` (`packages/dawcore/src/elements/daw-editor.ts`), which subtracts
  the same compensation from the resting position.

With the Tone adapter `lookAhead` is **0.1s** (Transport's scheduling position runs
that far ahead of audible output) plus `outputLatency` (~3ms Chrome, ~15ms Safari).
Every click therefore lands the cursor ~100ms of timeline behind the click: ~5px at
1000 samples/pixel, ~19px at 256 spp.

The subtraction models a **playback-time** phenomenon. After a seek while stopped,
the engine's time is a stored coordinate — no audio is flowing, there is no "audible
position" to align with, and the click position is the truth.

## Decision

**One rule: latency compensation is a property of *playing*, not of position.**

| Situation | Visual cursor | Change from today |
|---|---|---|
| Seek while stopped | exactly the clicked time | **fixed** (was −~0.11s) |
| Stop (rewind to play start) | exactly the play-start position | fixed (was −~0.11s) |
| Selection-end auto-stop | exactly the selection end | fixed (was −~0.11s) |
| Pause | raw Transport position (freezes with a ~0.1s forward hop) | changed — see below |
| Playing (steady state) | raw − outputLatency − lookAhead | unchanged |
| Play start / resume | held at play-start during the pre-roll window, then tracks audible | fixed (was a ~0.1s backward jump) |

**Pause trade-off (user-approved 2026-06-09):** the resting cursor on pause shows the
raw Transport position instead of the last-audible position. This introduces a small
(~5–19px) forward hop at the pause moment, but resume then continues seamlessly from
exactly where the cursor rests — and the cursor points at precisely what will be
heard next (resume plays from raw; the content between `raw − lookAhead` and `raw`
is never replayed). The rejected alternative (keep pause audible-aligned via a
position-source flag in the engine) moves the same hop to the resume moment and
requires extra engine state that the React provider's internal `stop()+seek()`
sequence inside `play()` partially defeats.

## Design

### 1. Engine owns the computation: `PlaylistEngine.getAudibleTime()`

New public method on `PlaylistEngine` (`packages/engine/src/PlaylistEngine.ts`):

- **Not playing:** returns `_currentTime` raw. A resting cursor has no audible
  counterpart; seek/stop/pause positions display exactly.
- **Playing:** returns `getCurrentTime() − outputLatency − lookAhead`, **held at
  `_playStartPosition`** while `raw >= _playStartPosition` and the compensated value
  is still below it (the pre-roll window: audio at the start position isn't audible
  until ~`outputLatency + lookAhead` after `play()`). Clamped to `>= 0`, non-finite
  guarded.

`outputLatency` is read from `adapter.audioContext` behind an `'outputLatency' in ctx`
guard (absent on OfflineAudioContext and some browsers). `lookAhead` comes from the
existing `engine.lookAhead` getter (Tone ~0.1s, native 0).

Loop-wrap note: after a Transport loop wrap, `raw` drops below `_playStartPosition`
when the loop start precedes it, so the hold condition (`raw >= _playStartPosition`)
disengages and behavior matches today. When the wrap target equals the play start,
the hold briefly pins the cursor at the loop start — strictly better than today's
behavior of showing a position before the loop region.

**Storage stays raw.** `getCurrentTime()` is unchanged; `getAudibleTime()` must never
be fed back into `play()`/`seek()` (compounding — already documented in browser and
dawcore CLAUDE.md).

### 2. React provider (`packages/browser`)

- `toVisualTime(rawTime)` becomes the identity (with `>= 0` / finite guards). All
  nine `setCurrentTimeRefs()` call sites are resting/static assignments (pause, stop,
  seek, selection end, playback end) and now display raw. No call-site reordering
  needed — the resting display no longer depends on engine state. This also preserves
  the deliberate divergence at selection-end stop, where the UI cursor rests at the
  selection end while the engine rewinds to play start.
- The animation loop computes `visualTime = engine.getAudibleTime()` per frame
  (fallback: raw time when no engine). The loop's manual
  `outputLatency`/`lookAhead` math is deleted.
- `getLookAhead()` (recording live-preview latency trim) is untouched — that is a
  separate, correct use of the same quantities.

### 3. dawcore (`packages/dawcore`)

- `_startPlayhead()`'s `audibleTime()` closure → `engine.getAudibleTime()`.
- `_stopPlayhead()` displays `Math.max(0, this._currentTime)` raw (storage was
  already raw; only the subtraction is removed).
- Pointer-handler and `seekTo()` call paths are unchanged — they already update
  `_currentTime`/engine before `_stopPlayhead()`.

## Out of Scope

- **MediaElement provider** — no engine, no Tone, unaffected.
- **Recording latency trim** (`audibleLatencySamples`, live-preview peak slicing) —
  a distinct, correct application of `outputLatency + lookAhead`.
- **Compensated time wrapping at loop boundaries** (visual briefly shows
  pre-loop-start positions right after a wrap when loop start < play start) —
  pre-existing, unchanged.
- **Tone pause content gap** — pausing the Tone Transport discards the pre-scheduled
  `lookAhead` window, so the content in `(raw − lookAhead, raw)` is heard never or
  partially, and resume plays from `raw`. Adapter-level concern, noted for a possible
  future fix.

## Affected Packages / Versions

- `@waveform-playlist/engine` — new public API → minor bump.
- `@waveform-playlist/browser` — behavior fix → patch bump (pin on engine updated).
- `@dawcore/components` — behavior fix → 0.0.x patch bump.

Publishing happens separately per the root CLAUDE.md convention; bumps are noted here
for the release that includes this fix.
