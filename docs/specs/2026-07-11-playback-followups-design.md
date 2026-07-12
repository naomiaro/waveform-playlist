# Annotation Playback Follow-ups (#608, #609) — Design

**Date:** 2026-07-11 · **Status:** Approved · **Branch:** fix/annotation-playback-followups (one PR, `fixes #608, fixes #609` — separate closing keywords)

## #608 — Bounded-playback completion on the Tone adapter path

**Gap:** `TonePlayout.play(when, offset, duration)` schedules a Transport `scheduleOnce` at the bounded end and fires `onPlaybackCompleteCallback` (set via `setOnPlaybackComplete`, TonePlayout.ts:583) — but nothing subscribes: the adapter's `_isPlaying` stays true and `PlaylistEngine` never observes completion (engine CLAUDE.md's known `isPlaying()` design gap).

**Fix (optional adapter hook):**
- `PlayoutAdapter` (engine types) gains `onPlaybackEnded?(callback: (() => void) | null): void` — invoked by the adapter when playback completes ON ITS OWN (duration-limited end). Not fired for consumer-initiated stop/pause. `null` unsubscribes.
- `TonePlayoutAdapter` implements it: forwards to `playout.setOnPlaybackComplete(...)`, wrapping to set its internal `_isPlaying = false` before invoking the engine's callback. Wiring survives playout rebuilds (`setTracks` first-build path — re-apply the stored callback wherever the playout instance is created/replaced).
- `PlaylistEngine` subscribes at adapter binding when the hook exists: handler is a no-op unless `_isPlaying`; otherwise calls `this.stop()` — exact parity with the native path's frame-loop auto-stop (adapter.stop() runs again: idempotent; rewind-to-play-start semantics; `stop` event + statechange reach all consumers through existing channels). Unsubscribes (`onPlaybackEnded(null)`) in `dispose()`.
- `NativePlayoutAdapter` is NOT wired in this PR (dawcore's rAF check covers it); the hook is documented as available for adapters. dawcore's rAF endTime check stays as a backstop on both paths.

## #609 — Boundary write-back diff against live element values

**Gap:** `applyBoundaryResults(elements, before, after)` and `applyTickBoundaryResults(..., before, after, ...)` (daw-annotation-track.ts) resolve the write TARGET by id but diff `after[i]` against `before[i]` — and callers pass a live-sorted `before` that can be ordered differently than `after` once a drag reorders annotations. A coincidental value collision across the mismatched pairing skips a needed write for one frame.

**Fix:** drop the `before` parameter from both helpers. Diff each `after[i]` against the id-resolved element's CURRENT values: seconds helper compares `el.start`/`el.end`; tick helper compares the ROUNDED tick against `el.startTick`/`el.endTick` (and re-derives seconds on write, unchanged single-pass coherence). Callers (drag move + cancel paths, `_moveBoundary` both branches) drop their `before` arguments. The changed-edge purpose (suppress spurious `daw-annotation-update` events) is preserved and becomes exactly correct by construction.

**Regression test:** the final-review scenario — mismatched-order pairing with coincidentally-colliding values must still write (construct a linked drag where old-pairing would compare equal values and skip; assert the write lands).

## Testing

- Engine: mock adapter exposing the hook → bounded `play(s, e)` then fire the callback → `isPlaying` false, `stop` event emitted once, currentTime at play-start (stop semantics); callback while already stopped → no event; dispose unsubscribes (`onPlaybackEnded(null)` observed).
- Playout: adapter unit test — `onPlaybackEnded(cb)` reaches `setOnPlaybackComplete`; firing flips adapter `_isPlaying`; callback survives the first `setTracks` build; `onPlaybackEnded(null)` clears.
- dawcore: both helpers' existing suites green with the new signatures; the #609 regression test; full suite.
- Changesets: `@waveform-playlist/engine` patch, `@waveform-playlist/playout` patch, `@dawcore/components` patch.
- Docs: engine CLAUDE.md (hook + the narrowed `isPlaying()` gap note), playout CLAUDE.md (wiring), dawcore CLAUDE.md (helper signature note). Close both issues via PR body keywords.
