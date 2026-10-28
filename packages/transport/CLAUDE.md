# Transport Package (`@dawcore/transport`)

**Purpose:** Native Web Audio transport — replaces Tone.js Transport/scheduling with zero dependencies. Tone.js remains available only for effects (optional, consumer-side).

**Architecture:** Layered: core (clock/scheduler/timer) → timeline (samples/ticks/tempo) → audio (track nodes/clip player/metronome) → transport (orchestrator) → adapter (PlayoutAdapter bridge).

**Build:** Uses tsup — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS.

**Testing:** vitest unit tests in `src/__tests__/`. Run with `cd packages/transport && npx vitest run`.

**Zero dependencies.** No peer deps. `@waveform-playlist/core` and `@waveform-playlist/engine` are devDependencies only (all imports are `import type`, erased at build time).

## Core Layer

### Clock

**Elapsed time is counted in integer context frames** (#636): `position = seekPosition + elapsedFrames`, where `elapsedFrames` is ONE integer accumulator (frames of earlier runs since the last seek + `contextFrame − contextFrameAtAnchor` while running) and `contextFrame` is `currentTime × sampleRate` snapped onto the 128-frame render-quantum lattice (`RENDER_QUANTUM_FRAMES` is the spec default — a context with a non-default `renderSizeHint`, or a mocked one, lands off the lattice and keeps its own integer frame via the snap tolerance instead of being moved up to 64 frames; every Transport unit test with `currentTime = 0.5` runs that branch). The seek position is held in both units — `_seekFrames` and `_seekSeconds` (the EXACT `seekTo(seconds)` target) — so a seek round-trips bit-exactly through `getTime()` (`(t × 44100) / 44100 !== t` for roughly one millisecond position in seven at 44.1 kHz, none at 48 kHz; callers compare seconds with `>=`/`===`) and the seconds and frame views add the same integer, so they cannot drift apart across pause/resume cycles (tested over 1000 cycles). `getFrame()` and `Clock.secondsToFrame()` are the two places that round at the frame boundary; everything below them stays fractional (`getFrameExact()`, `seekToFrame()` rounds its INPUT at the API boundary). **`ContextFrame` is a distinct brand from `Sample`** (SampleTimeline's option rate): with `{ sampleRate: 44100 }` on a 48 kHz context the two differ by ~8.8%, and the brand makes mixing them a type error; `Transport.getCurrentSample()` is the sanctioned exit to the timeline rate (round once via SampleTimeline), `getCurrentFrame()` mirrors `getCurrentTime()` (same loop-wrap clamp and count-in hold) in CONTEXT-rate frames. The Transport validates `audioContext.sampleRate` FIRST and separately from `options.sampleRate` (a `{ currentTime }`-only mock used to work; it would now make every position NaN — and the option cannot stand in for the context's rate, which an earlier hint wrongly suggested); seeks reject non-finite input, and `Transport.play()/seek()` do so before any mutation (a NaN seek used to leave a "playing" transport with no timer). Reads are NOT pure: a read that sees a backward context reading absorbs it (below) — but idempotently, so the outcome does not depend on which reader (timer tick, UI rAF) saw it first; safe to call from any frame at any frequency.

**What anchors / re-bases the position (document any new one here):**

| Event | Effect |
| --- | --- |
| `start()` | anchors the current position to the current context frame |
| `seekTo()` / `seekToFrame()` while running | set the position, re-anchor to the current context frame |
| `stop()` | folds elapsed frames into the position, detaches |
| `reset()` | position 0, detached (the last context reading is kept — the context clock did not change) |
| context reading goes BACKWARDS while running (defensive: the spec makes `currentTime` monotonic and #636 describes Chromium STALLING it, but a re-base would otherwise jump the position back) | the anchor moves with it so the position HOLDS; `rebaseCount++`, `lastRebaseFrames`. The Transport keeps its own cursor (`_rebasesHandled`, re-synced in `play()`/`seek()`/count-in start, where sources are re-created anyway — a stale flag used to replay a pre-stop re-base as a false event on the next play) and on the next tick whose count differs: outside a count-in it silences + re-creates every scheduled source from the held position CLAMPED to loopStart (right after a wrap the clock sits behind loopStart; the old anchor's `toAudioTime()` gave sources ABSOLUTE context times that now fire late); during a count-in it drops the armed clicks (a regenerate would double-fire — CountInPlayer counts beats) and lets the clock-driven transition land. Then `discontinuity { seconds, shiftSeconds }` (`seconds` = what `getCurrentTime()` reports), or, with no subscriber, ONE `console.warn` per transport — the only path that produces an audible artifact must stay visible. `Transport.rebaseCount` exposes the counter |
| context reading STALLS (suspend, device change) | position freezes — no audio renders, no transport time elapses; nothing to re-anchor |
| context reading jumps FORWARD | taken at face value: the context rendered that audio |

`toAudioTime()` is **anchor-based in both states** (`(anchorFrame + (positionFrames − positionAtAnchorFrames)) / rate`): running, the anchor is the captured frame — it never re-reads `currentTime`, so sub-quantum noise in a reading cannot shift scheduled `source.start(when)` times; stopped, the anchor is the same SNAPPED "now" `start()` is about to capture, so a `when` computed just before and just after `start()` are bit-identical (tested at a non-zero seek). This replaces the seconds-offset clock the issue called out (`clockTimeAtStart + (currentTime − audioTimeAtStart)`), whose every read re-derived from a raw float reading.

### Scheduler

Sliding window event generation. `advance(currentTime)` expands the window to `currentTime + lookahead` and generates/consumes events only for the new portion (`rightEdge` tracking prevents re-generation).

**Loop handling:** When the window crosses `loopEnd`, generates up to the boundary, calls `onPositionJump(loopStart)` on all listeners, then continues from `loopStart` to fill remaining lookahead. All in one tick — seamless audio.

**Listener contract:** `SchedulerListener<T>` has four methods: `generate()`, `consume()`, `onPositionJump()`, `silence()`. Both `ClipPlayer` and `MetronomePlayer` implement this.

**Tick-based internals (v0.0.3):** Loop boundaries (`_loopStart`, `_loopEnd`) and the scheduling cursor (`_rightEdge`) are integer ticks. `advance()` converts Clock seconds → ticks via TempoMap at entry, then uses integer comparisons for loop wrap logic. This eliminates float precision drift at loop boundaries. All time windows use half-open intervals: `[fromTick, toTick)`.

**Clock seek offset at loop wrap:** The `onLoop` callback seeks the clock to `loopStart - (loopEnd - clockTime)`, not just `loopStart`. Since advance runs ahead by the lookahead (~200ms), post-wrap events need `toAudioTime()` to map them to the boundary's audio time, not to "now". `getCurrentTime()` clamps to `loopStart` during the brief window when the clock is behind.

**Loop APIs:** `setLoop(enabled, startTick, endTick)` is the primary tick-based API. `setLoopSeconds()` and `setLoopSamples()` are convenience methods that convert at the boundary. `NativePlayoutAdapter.setLoop()` calls `setLoopSeconds()` since the engine speaks seconds.

**Invalid loop points THROW (#636):** `assertValidLoopRange()` (`core/loop-range.ts`) is shared by `Scheduler.setLoop/setLoopSeconds` and `Transport.setLoop/setLoopSeconds/setLoopSamples` — when `enabled`, a non-finite, empty or inverted range throws (same policy as `TempoMap._validateBpm`) and the previous loop stays in force; `enabled: false` is never validated. Transport validates BEFORE mutating `_loopEnabled`/`_loopStartTick` (the scheduler's own check would fire too late). **`NativePlayoutAdapter.setLoop` normalizes the engine path:** `PlaylistEngine` starts with `loopStart = loopEnd = 0` and forwards `setLoopEnabled(true)` before a region exists, and its `play()` already treats an un-loopable region as disabled — so the adapter sends `enabled && !degenerate` (finite `start >= end` → disabled) rather than throwing into a UI toggle. Non-finite values still propagate.

**Listener errors surface, never swallowed (#636):** `Scheduler` takes `onError?(SchedulerListenerError)` — a discriminated union on `phase` carrying the context of each: `generate` (`fromTick`/`toTick` of the window), `consume` (`event`), `positionJump` (`tick`). A `generate()` throw skips that listener for the window, a `consume()` throw skips that one event, an `onPositionJump()` throw skips that listener's jump (the loop wrap still completes — cursor reset and clock seek must not be aborted), the rest proceed. `CountInPlayer.consume` no longer catches internally (its `_onBeat` runs in `finally`), so count-in click failures reach the same path. Transport wires both schedulers to `_emitError`, which **delivers on a microtask and decides THEN**: `error` subscribers present → `_emit('error')` (so a handler calling `stop()`/`setTracks()`/`off()` cannot re-enter the listener iteration still running); none (unsubscribed or disposed meanwhile) → `console.warn` via `ListenerErrorLog`, **once per listener and failure kind** (phase + error name/message, capped at 16 kinds per listener — a listener failing every window would log ~40 lines/s, but a NEW failure from the same listener is still reported). Standalone `Scheduler` without `onError` warns the same way. Nothing is retried — the host decides. **Sub-tick ranges and integer ticks:** `setLoopSeconds`/`setLoopSamples` (Transport AND Scheduler) also throw (`assertLoopRangeSpansATick`, in the caller's unit) when a non-empty seconds/sample range rounds to a single tick — before any state is touched; the tick path requires INTEGER ticks (a fractional pair like 960.6/961.4 would round into an empty loop one layer down). `NativePlayoutAdapter.setLoop` decides degeneracy in ticks for the same reason and warns for every degenerate ENABLED region (inverted, empty, sub-tick) except the engine's initial `(0, 0)` — the UI would otherwise show a loop that never loops with no trace.

### Timer

Drives the scheduler from a **Web Worker `setTimeout` loop** (default 25 ms, `DEFAULT_TIMER_INTERVAL_MS`), never `requestAnimationFrame` (#636). Browsers stop rAF and throttle main-thread timers in a hidden tab, but Worker timers and message delivery keep their cadence, so the 200 ms lookahead never runs dry in the background. One Blob-URL Worker lives for the Timer's lifetime (created lazily on first `start()`, `start`/`stop` are messages, `dispose()` terminates it — `Transport.dispose()` calls it). Fallback: a main-thread `setTimeout` loop when there is no `Worker`/`Blob`/`URL.createObjectURL` (Node, SSR — silent), when the Worker constructor throws or the Worker fires `error`/`messageerror` later (CSP without `worker-src blob:` surfaces either way; a dead Worker must not leave the transport silent), warned ONCE PER PAGE (module-level `workerRefusedOnThisPage`; `_resetTimerWorkerVerdictForTests()` for tests); correct while the tab is visible or audible, but a hidden silent tab may throttle it to ~1 Hz. The fallback reschedules only when the tick left nothing scheduled (`_timeoutId === null`) — a tick that calls `stop()`+`start()` (loop-on-end) would otherwise double the chain every restart. `start()` after `dispose()` is a warned no-op (no leaked Worker from a late `play()` on a disposed transport). **Watchdog:** a Worker that never delivers its first tick within 4 intervals of `start` (killed without an `error` event) is abandoned for the fallback; the first tick clears it. **Tick faults:** anything the transport tick itself throws (not listener failures — the scheduler catches those) is warned once with its stack and the transport STOPS (`_onTickFailure`), so the engine sees `stop` instead of a "playing" transport rendering silence 40×/s. `Transport.play()`/`seek()` after `dispose()` are warned no-ops (`_disposed`). `TransportOptions.timerIntervalMs` (default `DEFAULT_TIMER_INTERVAL_MS`, exported) must be shorter than the lookahead. `NativePlayoutAdapter.init()`'s Safari warmup poll is `setTimeout`-based for the same reason, and REJECTS if the context closes mid-poll (same outcome as closed-at-entry). rAF belongs to UI position updates only (consumers). Anything else that must keep polling the playhead while the tab is hidden subscribes to the **`tick` event** instead — emitted once per scheduler tick (after `scheduler.advance`, with `{ seconds }`; not during a count-in, not on the tick that ends a bounded play) — e.g. dawcore-wam's transport bridge, which used rAF until #645.

**`loop` means the loop RANGE changed (`setLoop`/`setLoopSamples`), never a wrap** — the scheduler's `onLoop` callback seeks the clock silently and emits nothing. Detect a wrap as the `tick` event's `seconds` reading lower than on the previous tick (it is the clamped `getCurrentTime()`, so right after the wrap it reads `loopStart`). Before subscribing to any event by name, check the real `_emit('<name>'` sites — the first #646 test drove a hand-rolled mock's `emit('loop')` and asserted a rebroadcast the real Transport never produced.

## Branded Types

`Tick` and `Sample` are branded `number` types in `types.ts` — zero runtime cost, compile-time only. Conversion functions are the canonical producers: `secondsToTicks()` → `Tick`, `secondsToSamples()` → `Sample`. Internal fields stay `number`; casts (`as Tick`) only at API boundaries and in tests for literals. MeterMap public methods accept/return `Tick`. Internal arithmetic stays `number` with `as Tick` at return points.

## Tempo Automation

`TempoInterpolation` type: `'step'` (instant, default), `'linear'` (exact logarithmic integral, exponential inverse), `{ type: 'curve', slope }` (Möbius-Ease, slope 0-1 exclusive, exact closed-form integral AND inverse — see below). `Transport.setTempo(bpm, atTick, { interpolation })` / `TempoMap.withTempo(...)` third param is optional. First entry is always `'step'` (no previous to ramp from). `_derive`/`_segmentSeconds` account for interpolation type per segment when building the successor map.

**Curve math is closed-form in both directions (#636):** the Möbius-Ease curve is `A + B·e^(c·x)`, so `1/bpm` has an analytic antiderivative; `_ticksToSecondsCurve`/`_secondsToTicksCurve` are O(1) and accurate to ~1e-15 relative regardless of segment length. Coefficients are carried as `c·A`/`c·B` (finite as slope → 0.5) and each direction picks between two algebraically equal forms per call to dodge cancellation (log1p form unless `1 + y ≤ 0.5`; inverse uses a product form for `e^(−c·x)` when it is small and `|B| < |A|/2`). The linear fast path is only `|slope − 0.5| < 1e-12` (exactly 0.5 is 0/0). **Don't "simplify" to a single form or widen the linear window** — the adversarial grid in `tempo-map.test.ts` ("curve integration accuracy") encodes the regimes that broke: slopes within 1e-6 of 0.5 on long ramps (0.38 ms with a 1e-6 window), `|A/B| ≈ 1e-8` (plain form cancels), slope 1e-6 near the end of a 1024-bar ramp (naive 1 + z inverse off by tens of ticks). Validate any change with an independent Simpson reference, not round-trips alone.

**Multi-entry guard (#407):** `Transport.setTempo(bpm)` with a defaulted `atTick` warns and refuses when the TempoMap has more than one entry — a defaulted call is the single-BPM convenience path and must not clobber a consumer-installed tempo curve's tick-0 entry. Pass an explicit `atTick: 0 as Tick` to genuinely modify a multi-entry map. `TempoMap.entryCount` (always >= 1) backs the check. `setTempo` returns `boolean` (applied/refused); `NativePlayoutAdapter.setTempo` propagates it so `PlaylistEngine` only commits `_bpm` on acceptance — never widen these back to `void`.

## Timeline Layer

### Dual Coordinate System

- **SampleTimeline** — absolute positions in samples. `samplesToSeconds()` / `secondsToSamples()` (with `Math.round` for integer samples). Also `ticksToSamples()` / `samplesToTicks()` via TempoMap (requires `setTempoMap()` before use); `samplesToTicksExact()` is the fractional variant.
- **TempoMap** — converts between ticks and seconds. `secondsToTicksExact()` returns the fractional position; `secondsToTicks()` is `Math.round()` of it (integer `Tick`). `ticksToSeconds()` stays float for audio scheduling. Supports multiple tempo entries with cached cumulative seconds for O(log n) lookups.

**Rounding happens once, at the unit boundary (#636):** the math (`secondsToTicksExact`, `samplesToTicksExact`, `Transport.timeToTickExact`, `secondsToBeats`) is fractional; the integer-`Tick` producers round exactly once — `TempoMap.secondsToTicks` rounds the exact value, `SampleTimeline.samplesToTicks` mirrors that on the sample path, and `Transport.timeToTick` / the scheduler cursor just consume `secondsToTicks`. Rounding EXTERNAL tick input at an API boundary (`Scheduler.setLoop`'s `Math.round`) is fine — the rule is: never round inside the conversion math and again on its result. `ticksToSeconds`/`tickToTime` accept fractional positions, so an exact value converts back without a cast. `secondsToTicksExact` is NOT clamped (negative seconds convert at the constant initial tempo; past the last entry the last tempo is extrapolated). `NativePlayoutAdapter.secondsToTicksExact` and `TonePlayoutAdapter.secondsToTicksExact` (optional on the engine `PlayoutAdapter`) make the fractional path AVAILABLE to engine/dawcore consumers — none use it yet; both adapters' `secondsToTicks` round (Tone's used to return the fraction). Pattern after SoundCraft's `samples_to_ticks_f` / `samples_to_ticks` pair. New conversions follow the same shape: an `*Exact` fractional method plus a rounding wrapper — never round inside the math and again at the caller.
- **MeterMap** — time signature entries at tick positions. See MeterMap section below.

SampleTimeline converts between samples, seconds, and ticks (via TempoMap). The Scheduler works in integer ticks — seconds from the Clock are converted at the top of `advance()`. MetronomePlayer receives ticks directly; ClipPlayer converts ticks to samples.

### TempoMap Is an Immutable Value (#636)

`TempoMap` never mutates: `withTempo(bpm, atTick, options)`, `withoutTempo(atTick)` and `withoutTempos()` return a NEW map (the old `setTempo`/`removeTempo`/`clearTempos` mutators are gone — the rename makes every stale call site a compile error instead of a silent no-op). `entries` is a frozen, tick-ordered snapshot with cumulative `secondsAtTick`; `_derive` recomputes the cache from the edit point into a fresh sealed array, reusing the untouched prefix entries by reference. Curve `interpolation` objects are COPIED and frozen (a caller mutating its own options object cannot change the map). `atTick` is validated (non-negative integer) like BPM. The entries constructor form needs a module-private token (`INTERNAL`) — `new TempoMap(ppqn, [])` from outside throws. `withoutTempo` of tick 0 or of an absent tick returns the same map. Pattern after SoundCraft's `TempoMap` (a plain `Clone` value the engine owns).

**Transport owns and swaps the map:** `Transport.setTempo/removeTempo/clearTempos` call `_replaceTempoMap(next)`, which installs it in every holder — `Scheduler.setTempoMap`, `SampleTimeline.setTempoMap`, `ClipPlayer.setTempoMap`, `MetronomePlayer.setTempoMap`. `Transport.tempoMap` exposes the current map (a reference you captured earlier keeps its old tempo). The count-in player is NOT on the swap list: `configure({ tempoMap })` gives it a dedicated single-BPM map at each count-in start. **When adding a new holder of a TempoMap reference, add it to `_replaceTempoMap`** — otherwise it silently keeps converting with a stale tempo after the next edit.

**One map per scheduler window:** `Scheduler.advance()` captures `this._tempoMap` into a local at the top and uses it for the whole call, so a swap from inside a listener's `generate()`/`consume()` (only a direct Scheduler user can do this — Transport's own `error` event is delivered on a microtask and `countIn` fires from the count-in scheduler, whose map is never swapped) cannot change the TEMPO conversions of the window already being generated — loop bounds (ticks) and the `MeterMap` are NOT snapshotted; the listeners' own `consume()` conversions read the swapped map immediately, which is intended. **`Scheduler.setTempoMap` re-anchors `_rightEdge` through seconds** (old map ticks→seconds→new map ticks): the window already handed to listeners stays covered, so a tempo change during playback neither regenerates it (burst) nor stalls until the clock reaches the old edge's new tick value. Two traps found in review: (1) a FASTER tempo can put the re-anchored edge past `loopEnd` — it is clamped to `loopEnd` and the loop branch now wraps for a cursor at/after `loopEnd` instead of running past the loop forever; (2) a swap DURING `advance()` is recorded (`_advancingWith`) and the re-anchor runs when the window completes, because `advance()` writes the final edge in old-map ticks. `Transport._replaceTempoMap` recomputes the seconds-defined `setPlayEnd` bound the same way. Audio already scheduled in the lookahead (200 ms default) keeps its old-tempo timing. `MeterMap` still mutates in place (splice) — same class of issue, left for a follow-up.

### MeterMap

Parallel to TempoMap, stores time signature entries at tick positions. Each entry: `{ tick, numerator, denominator, barAtTick }`.

- **Beat unit from denominator:** `ticksPerBeat = ppqn * (4 / denominator)`. A denominator of 4 gives one quarter-note beat; 8 gives one eighth-note beat.
- **Bar boundary constraint:** `setMeter(numerator, denominator, atTick?)` snaps `atTick` forward to the next bar boundary if not already on one. This keeps bar numbers consistent for all subsequent entries.
- **Conversions:** `barToTick(bar)` walks the entry list accumulating bar counts; `tickToBar(tick)` is the inverse. Both return 1-indexed bar numbers.
- **`clearMeters()`** removes all entries and resets to the initial meter.
- **Tick-0 meter change re-snaps downstream entries** — `setMeter(n, d)` at tick 0 calls `_resnapDownstreamEntries` to move all subsequent entries to bar boundaries of the new meter. Without this, `barAtTick` becomes fractional, breaking `barToTick`/`tickToBar` round-trips. **`removeMeter` re-snaps too** (#636 review): the entries after a removed one were snapped to ITS bar lines; the preceding meter now governs them. `quantizeTick`'s single-lookup anchoring relies on every entry sitting on a bar line of the preceding meter.

`MetronomePlayer.generate()` queries the MeterMap per beat to determine accent placement (beat 1 of each bar) and beat unit duration.

### Grid snap (`quantizeTick`, #636)

`quantizeTick(meterMap, tick, subdivision, { mode, strength })` in `timeline/quantize.ts` is a pure function over the MeterMap; `Transport.quantizeTick(tick, subdivision, options)` delegates. `subdivision` is `{ ticks: n }` (a positive integer tick COUNT — the object form keeps a duration visibly distinct from a `Tick` position), `{ note: 8, dotted?, triplet? }` (PPQN-independent, resolved against `meterMap.ppqn`; note ∈ 1|2|4|8|16|32|64), `'bar'` or `'beat'` (resolved from the meter at the tick's bar); `mode` is `'nearest'` (default, exact ties go UP) | `'next'` (ceil) | `'previous'` (floor) — all three IDEMPOTENT (a tick on a line stays; Tone's `nextSubdivision` is strict — callers wanting the following line pass `tick + 1`); `strength` 0–1 scales the move. A fractional tick within `ON_LINE_EPSILON` (1e-6) of a line counts as on it — `timeToTickExact()` yields e.g. `1920.0000000000002` for a note on the beat, and without the tolerance `'next'` jumps a whole step. The implementation does ONE `getEntryAt` lookup and derives the bar start arithmetically (MeterMap keeps entries on bar boundaries), never `tickToBar`/`barToTick`. **Known divergence:** core's `snapTickToGrid` (used by dawcore clip/annotation/timeline drag snapping) anchors at the meter ENTRY with a plain round, so in odd meters its lines cross bar lines where `quantizeTick` restarts them — follow-up #643; the fix belongs in core, not here. **Grid lines restart at each bar line** (same rule as SoundCraft's `GridValue::line_at_or_before` and the metronome's re-anchoring at meter entries), so in 7/8 a quarter-note grid is 0, 960, 1920, 2880, then the bar line at 3360 — never 3840; a subdivision longer than the bar leaves only bar lines. `tick` may be FRACTIONAL (pair with `timeToTickExact()` for recorded notes); the result is always an integer `Tick`. Invalid input (negative/non-finite tick, non-positive or fractional tick-count subdivision, strength outside 0–1) throws.

## Audio Layer

### TrackNode Signal Chain

```
clip source → GainNode (volume) → StereoPannerNode → GainNode (mute) → [effects hook] → output
```

Mute uses a separate GainNode (0/1) so volume and mute are independent. `connectEffects(node)` inserts any AudioNode chain between mute and output.

### ClipPlayer

Implements `SchedulerListener<ClipEvent>`. `generate(fromTick, toTick)` uses `clip.startTick` when available for tick-space matching; falls back to `SampleTimeline.samplesToTicks(clip.startSample)`. Only schedules when the clip START tick falls within the window. Loop clamping in integer samples (`_loopEndSamples`). Has two loop setters: `setLoop(startTick, endTick)` converts via SampleTimeline, `setLoopSamples(startSample, endSample)` stores directly. `consume()` converts `event.tick` → seconds → audio time, then samples → seconds for `source.start(when, offset, duration)`. `onPositionJump(newTick)` uses `clip.startTick` for start comparison (ticks) and `clip.startSample + clip.durationSamples` for end comparison (samples), stops all active sources, and creates mid-clip sources for clips spanning the new position.

**Skips:** Clips with `durationSamples === 0` or missing `audioBuffer` (peaks-first rendering).

**Per-track updates:** `updateTrack(trackId, track)` silences only that track's active sources, letting the next scheduler tick re-generate.

### MetronomePlayer

Implements `SchedulerListener<MetronomeEvent>`. Receives integer ticks directly from the Scheduler, walks beat grid, generates accent clicks on beat 1 of each bar. `consume()` converts `event.tick` → seconds → audio time. `onPositionJump()` is a no-op — clicks are short one-shots (40-50ms) that finish naturally; silencing them on loop wrap kills the last beat before the boundary.

### CountInPlayer

`CountInPlayer` implements `SchedulerListener<CountInEvent>`. Temporary listener — added to a dedicated count-in scheduler only during the pre-play phase.

**Dedicated Tick Space and TempoMap:** The count-in scheduler operates in its **own tick space starting at tick 0** with a **dedicated TempoMap** locked to the BPM at the play position. This avoids using the main TempoMap, which may have a different tempo at tick 0 vs the play position (multi-tempo sessions).

**TempoMap Coupling:** `CountInPlayer.consume()` must use the **same TempoMap** as the count-in scheduler for `ticksToSeconds()` conversion. The dedicated TempoMap is passed via `configure({ tempoMap })`, replacing the main TempoMap from construction. If `consume()` uses a different TempoMap than the one generating ticks, clicks are timed wrong in multi-tempo sessions.

**MeterMap Isolation:** The count-in also uses a **dedicated single-entry MeterMap** locked to the meter at the play position (passed via `configure({ meterMap })`). The main MeterMap's entries would be misinterpreted in the count-in's tick space — `getEntryAt()` and `isBarBoundary()` would snap to main-timeline meter entries, producing wrong beat positions and accents. General rule: when creating a dedicated scheduler with its own tick space, isolate **all** coordinate-dependent maps (TempoMap and MeterMap), not just one.

**Timer-Driven Bar Boundary Transition:** Count-in completion is driven by the timer tick checking `_countInDuration` (full bar in seconds), NOT by `onComplete` from `CountInPlayer.consume()`. The `consume()` callback fires when the last beat is *scheduled* (in the lookahead window), which is ~200ms before it actually *plays*. Transitioning on consume would start the metronome before the last count-in click is heard. The timer tick checks `time >= _countInDuration` and calls `_finishCountIn()`, placing the transition exactly at the bar boundary.

**One-Shot Completion (No Silence):** `_finishCountIn()` does NOT call `_countInPlayer.silence()`. Same pattern as MetronomePlayer's `onPositionJump()` no-op — clicks are short one-shots (~40ms) that finish naturally. Calling `silence()` kills clicks scheduled in the lookahead window that haven't played yet.

**Default Click Sounds:** `createDefaultClickSounds(audioContext, { accentFrequency?, normalFrequency? })` synthesizes sine wave AudioBuffers with exponential decay. Called in constructor — MetronomePlayer gets default sounds out of the box (behavior change from requiring explicit `setMetronomeClickSounds()`). `setMetronomeClickSounds()` overrides both metronome and count-in sounds.

**Edge Cases:**

| Case | Behavior |
|------|----------|
| No click sounds loaded | Count-in skipped, play proceeds normally. Console warn. |
| Stop/pause during count-in | Cancel entirely, silence clicks, no `countInEnd` emitted. |
| Seek during count-in | Cancel count-in, seek to new position, stop playback. |
| Loop wrap | Count-in only on initial `play()`, never on loop wrap. |
| `play()` during count-in | No-op — `_playing` is `true` at count-in start. |
| `setCountInBars` out of range | Clamped to `MIN_COUNT_IN_BARS`–`MAX_COUNT_IN_BARS` with warn. Non-integer rounded. |

## Transport (Top-Level API)

Orchestrates all layers. Key flows:
- **play()** — `clock.seekTo(startTime)` if provided, `clock.start()`, `timer.start()`
- **pause()** — `timer.stop()`, `clock.stop()`, silence all listeners. Position preserved.
- **stop()** — `timer.stop()`, `clock.reset()`, silence all. Position returns to 0.
- **seek()** — stop timer, silence, `clock.seekTo()`, `scheduler.reset()`, restart timer if was playing.

### Solo Logic

When any track is soloed, all non-soloed tracks are muted via `TrackNode.setMute()`. Explicit mute takes precedence — a track that is both soloed AND muted stays muted.

### Effects Hook

`connectTrackOutput(trackId, node)` accepts any AudioNode chain (Tone.js effects, WAM plugins, native nodes). The transport has zero knowledge of Tone.js.

`seek(time)` emits a `seek` event (`{ seconds }`) — added for the wam-transport bridge (#425); generic, no plugin types.

`connectMasterOutput(node)` / `disconnectMasterOutput()` are the master-bus equivalents — the chain is inserted between the master gain and `audioContext.destination` via `MasterNode.connectEffects`. Master insertion uses a **targeted** `disconnect(destination)` (not blanket `disconnect()`) so parallel taps on `masterOutputNode` (analyzers, recorders) survive chain connect/disconnect. The caller routes the chain's output to `audioContext.destination`.

## NativePlayoutAdapter

Thin bridge to `PlaylistEngine`. Implements all `PlayoutAdapter` methods (required + optional: `addTrack`, `removeTrack`, `updateTrack`). `init()` resumes suspended AudioContext and waits for Safari warmup (see Patterns). `transport` getter exposes the Transport for direct access to tempo, metronome, and effects hooks.

**`onPlaybackEnded(callback)` (#608 parity, added with the Worker timer in #636):** the adapter subscribes to the transport's **`ended` event** — emitted only by the timer tick's endTime self-stop, right AFTER `stop` (so an `ended` handler sees a stopped transport and may restart it) — and forwards it to the engine's hook. A `stop()` the consumer issues, through the adapter OR directly on `adapter.transport` (examples do this), emits only `stop` and is never reported as completion. Before this, the native path had no hook at all: dawcore's rAF loop was the sole stopper of bounded playback and only won the race against the transport's self-stop because both ran on rAF in registration order. With a Worker tick that ordering is gone, so the hook is load-bearing — a consumer that mirrors `isPlaying` must not rely solely on polling time before the transport's tick — the engine's `stop` event is the signal; dawcore's own time check is the documented fallback for adapters without the hook.

`setTempo(bpm, atTick?)`, `setMeter(numerator, denominator, atTick?)`, `ticksToSeconds(tick)`, `secondsToTicks(seconds)` (integer), `secondsToTicksExact(seconds)` (fractional) — delegate to the underlying Transport. These enable the engine to forward tempo changes and use the adapter's TempoMap for `startSample` cache recomputation.

## Patterns

- **AudioContext received from consumer** — sidesteps all Tone.js/Firefox context creation issues. `new AudioContext({ sampleRate, latencyHint })` works natively.
- **Convenience API variants must mirror primary** — `setLoopSeconds` delegates to `setLoop` (inherits all validation). `setLoopSamples` bypasses `setLoop` and calls `_clipPlayer.setLoopSamples` + `_scheduler.setLoop` directly, so it must duplicate all state updates and validation from the primary (`_loopEnabled`, `_loopStartSeconds`, `isFinite` guard, start >= end guard).
- **`silence()` on stop/seek** — listeners are responsible for stopping their active sources. `AudioBufferSourceNode.stop()` is instantaneous.
- **No Tone.js in the signal path** — all audio nodes are native Web Audio.
- **`_activeSources` cleanup** — ClipPlayer uses `ended` event listener for automatic cleanup. MetronomePlayer clicks are short one-shots.
- **No rAF in the engine** — the Timer is a Worker `setTimeout` loop (see Timer); rAF stops in hidden tabs. The lookahead window (200ms) provides the scheduling headroom over the 25 ms tick.
- **Scheduler lookahead ≠ perceptible latency** — The 200ms lookahead is scheduling headroom only. `source.start(when)` uses precise `AudioContext.currentTime` values, so audio plays at the exact right time. Recording latency compensation only needs `outputLatency`, not `outputLatency + lookahead`.
- **Safari AudioContext Warmup** — `audioContext.resume()` resolves but Safari's audio thread may not be ready to output samples. `NativePlayoutAdapter.init()` waits for `currentTime` to advance past `outputLatency` (fallback 20ms) before returning, with a 2s timeout and `state === 'closed'` guard to prevent infinite hang. Without this, clips scheduled at time 0 have audible start delay on Safari.
- **onPositionJump Strict Less-Than** — `ClipPlayer.onPositionJump` uses strict `<` (not `<=`) for clip start boundary: `clipStartSample < newSample`. Clips starting exactly AT the position are handled by `generate()`, not `onPositionJump`. Using `<=` causes double-scheduling (both produce the same clip).
- **Offline math repros via tsx** — `npx tsx` can import timeline classes straight from source (`import { TempoMap } from '.../packages/transport/src/timeline/tempo-map.ts'`) for fast tempo/alignment math verification in Node, no browser or AudioContext needed (TempoMap/MeterMap are pure).

## Critical Gotchas

### Transport Time vs AudioContext Time

`AudioBufferSourceNode.start(when)` and `AudioParam` scheduling methods expect `when` in `AudioContext.currentTime` space (absolute hardware time, e.g., 100.5). The scheduler generates events in **transport time** (elapsed seconds from timeline start, e.g., 0.5). Without conversion, all clips in the lookahead window fire immediately (past timestamps).

**Fix:** `Clock.toAudioTime(transportTime)` converts: `audioContext.currentTime + (transportTime - clock.getTime())`. Both `ClipPlayer` and `MetronomePlayer` receive this as a constructor parameter.

### Generate-Once Scheduling

`ClipPlayer.generate()` must only create events when a clip's `startSample` falls within the scheduling window (converted from ticks to samples). Clips that started in a previous window are already playing — their `AudioBufferSourceNode` runs for its full duration. Re-generating for overlapping clips creates duplicate stacking sources that ramp volume.

Mid-clip playback (seek, loop wrap, resume from pause) is handled by `onPositionJump()`, not `generate()`.

### Pause/Resume Requires Position Jump

After `pause()`, `silence()` kills all active sources. On `play()` (resume), the scheduler's `rightEdge` still thinks those clips are scheduled. `generate()` won't recreate them because their `startTime` is in the past.

**Fix:** `play()` always resets the scheduler to the current position and calls `clipPlayer.onPositionJump()` to create mid-clip sources. Effectively treats resume as "seek to current position."

The reference library (webaudio-transport) avoids this entirely by not implementing pause — only stop + start.

### Timer Test Pattern (fake timers)

Under vitest there is no `Worker`, so the Timer takes its `setTimeout` fallback: tests call `vi.useFakeTimers()` in `beforeEach` (`vi.useRealTimers()` in `afterEach`) and drive one scheduler tick with `vi.advanceTimersByTime(DEFAULT_TIMER_INTERVAL_MS)` (imported from `core/timer`). The Worker path is unit-tested in `timer.test.ts` with a `FakeWorker` global that records the Blob script and the posted `{ type: 'start' | 'stop' }` messages and delivers ticks via `onmessage`. Never stub `requestAnimationFrame` to drive the transport — nothing reads it any more. Always call `transport.stop()`/`dispose()` after driving the loop so no fallback timeout stays pending.

## What This Solves

| Problem | Solution |
|---------|----------|
| Sample rate control | Native `AudioContext({ sampleRate })` — no wrapper |
| Firefox AudioListener | No `standardized-audio-context` needed |
| Ghost tick bugs | Our own scheduler, no Tone.js Clock |
| Metronome | Built-in as MetronomePlayer |
| Latency hint | Native `AudioContext({ latencyHint })` |
| Effects lock-in | Plugin hook accepts any AudioNode chain |

## Integration

### dawcore (`<daw-editor>`)

Set `editor.audioContext = new AudioContext({ sampleRate: 48000 })` before tracks load. The editor uses `NativePlayoutAdapter` internally — no Tone.js dependency.

### dawcore example pages (`examples/dawcore-native/`)

All example pages use the native transport. `multiclip.html` passes a custom AudioContext; `index.html` and `record.html` use the editor's default.

**Gotcha:** Example pages call `Transport` methods directly (not via the adapter). When Transport APIs change behavior OR signature (e.g., `setLoop` switching to ticks, the #407 defaulted-`setTempo` guard), they break silently. Always grep `examples/dawcore-native/` for the changed method names — `metronome.html`'s tempo slider needed an explicit tick-0 arg when the guard landed.

### React (WaveformPlaylistContext)

Not yet integrated. Future work: pass `NativePlayoutAdapter` via the engine's `adapter` option.

## Edge Cases

### Clips Spanning Loop Boundary

When a clip starts before `loopEnd` and extends past it, `generate()` clamps `durationSamples` to `loopEndSamples - clipStartSample` (integer subtraction). The `AudioBufferSourceNode` stops exactly at the boundary. After `onPositionJump(loopStartTick)`, if the clip also spans `loopStart`, a new mid-clip source is created. No duplicate sources — the first was clamped. Zero-duration clips at the boundary (`durationSamples <= 0`) are skipped.

### Empty Tracks and Missing AudioBuffers

- **Empty tracks** (`clips: []`): `generate()` returns `[]`. TrackNode still exists for volume/pan/solo state.
- **Zero-length clips** (`durationSamples: 0`): skipped in `generate()`.
- **Missing `audioBuffer`** (peaks-first): skipped in `generate()`. Once backfilled via `updateTrack()`, subsequent windows include it.

### Effects Compatibility

`ClipTrack.effects` (`TrackEffectsFunction`) is a Tone.js-oriented API and is **not supported** by `NativePlayoutAdapter`. Use `transport.connectTrackOutput(trackId, effectsInputNode)` instead. Consumers using `ClipTrack.effects` must switch to the `connectTrackOutput` API or continue using `TonePlayoutAdapter`.

### Offline Rendering (WAV Export)

Consumers create an `OfflineAudioContext`, a separate `Transport` instance, and connect tracks to the offline destination. No Tone.js `isOffline` parameter needed.

## Not Yet Supported

- **Recording** — The transport handles playback only. Recording (mic capture, AudioWorklet, clip creation) is handled by `@waveform-playlist/recording` and dawcore's `RecordingController`, which use the AudioContext directly and don't depend on Tone.js Transport. Recording should work alongside the native transport if the AudioContext is shared, but this path is untested. `record.html` stays on the Tone adapter for now.

## Migration Path

1. ~~Build transport package on experimental branch~~ ✓
2. ~~Wire into one example (multiclip) for testing~~ ✓
3. Compare audio output with `TonePlayoutAdapter` side-by-side
4. Gradually migrate other dawcore dev pages and website examples
5. Wire into React (`WaveformPlaylistContext`)
6. Make Tone.js adapter the legacy path, native the default

