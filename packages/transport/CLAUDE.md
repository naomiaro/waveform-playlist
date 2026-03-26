# Transport Package (`@dawcore/transport`)

**Purpose:** Native Web Audio transport — replaces Tone.js Transport/scheduling with zero dependencies. Tone.js remains available only for effects (optional, consumer-side).

**Architecture:** Layered: core (clock/scheduler/timer) → timeline (samples/ticks/tempo) → audio (track nodes/clip player/metronome) → transport (orchestrator) → adapter (PlayoutAdapter bridge).

**Build:** Uses tsup — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS.

**Testing:** vitest unit tests in `src/__tests__/`. Run with `cd packages/transport && npx vitest run`.

**Zero dependencies.** `@waveform-playlist/core` and `@waveform-playlist/engine` are peer deps (types only at runtime).

## Core Layer

### Clock

Tracks elapsed time relative to `AudioContext.currentTime`. Pure calculation — safe to call from any frame at any frequency. `seekTo(time)` works both while running (resets reference point) and stopped (sets position for next start). `stop()` accumulates elapsed time so `start()` resumes from the paused position.

### Scheduler

Sliding window event generation. `advance(currentTime)` expands the window to `currentTime + lookahead` and generates/consumes events only for the new portion (`rightEdge` tracking prevents re-generation).

**Loop handling:** When the window crosses `loopEnd`, generates up to the boundary, calls `onPositionJump(loopStart)` on all listeners, then continues from `loopStart` to fill remaining lookahead. All in one tick — seamless audio.

**Listener contract:** `SchedulerListener<T>` has four methods: `generate()`, `consume()`, `onPositionJump()`, `silence()`. Both `ClipPlayer` and `MetronomePlayer` implement this.

**Tick-based internals (v0.0.3):** Loop boundaries (`_loopStart`, `_loopEnd`) and the scheduling cursor (`_rightEdge`) are integer ticks. `advance()` converts Clock seconds → ticks via TempoMap at entry, then uses integer comparisons for loop wrap logic. This eliminates float precision drift at loop boundaries. All time windows use half-open intervals: `[fromTick, toTick)`.

**Clock seek offset at loop wrap:** The `onLoop` callback seeks the clock to `loopStart - (loopEnd - clockTime)`, not just `loopStart`. Since advance runs ahead by the lookahead (~200ms), post-wrap events need `toAudioTime()` to map them to the boundary's audio time, not to "now". `getCurrentTime()` clamps to `loopStart` during the brief window when the clock is behind.

**Loop APIs:** `setLoop(enabled, startTick, endTick)` is the primary tick-based API. `setLoopSeconds()` and `setLoopSamples()` are convenience methods that convert at the boundary. `NativePlayoutAdapter.setLoop()` calls `setLoopSeconds()` since the engine speaks seconds.

### Timer

Drives the scheduler via `requestAnimationFrame` exclusively — never `setTimeout` or `setInterval`. The scheduler's 200ms lookahead absorbs any frame timing jitter.

## Branded Types

`Tick` and `Sample` are branded `number` types in `types.ts` — zero runtime cost, compile-time only. Conversion functions are the canonical producers: `secondsToTicks()` → `Tick`, `secondsToSamples()` → `Sample`. Internal fields stay `number`; casts (`as Tick`) only at API boundaries and in tests for literals. MeterMap public methods accept/return `Tick`. Internal arithmetic stays `number` with `as Tick` at return points.

## Tempo Automation

`TempoInterpolation` type: `'step'` (instant, default), `'linear'` (exact logarithmic integral, exponential inverse), `{ type: 'curve', slope }` (Möbius-Ease, slope 0-1 exclusive, subdivided trapezoidal + binary search inverse). `setTempo(bpm, atTick, { interpolation })` third param is optional for backwards compat. First entry is always `'step'` (no previous to ramp from). `_recomputeCache` accounts for interpolation type per segment.

## Timeline Layer

### Dual Coordinate System

- **SampleTimeline** — absolute positions in samples. `samplesToSeconds()` / `secondsToSamples()` (with `Math.round` for integer samples). Also `ticksToSamples()` / `samplesToTicks()` via TempoMap (requires `setTempoMap()` before use).
- **TempoMap** — converts between ticks and seconds. `secondsToTicks()` returns `Math.round()` (integer). `ticksToSeconds()` stays float for audio scheduling. Supports multiple tempo entries with cached cumulative seconds for O(log n) lookups.
- **MeterMap** — time signature entries at tick positions. See MeterMap section below.

SampleTimeline converts between samples, seconds, and ticks (via TempoMap). The Scheduler works in integer ticks — seconds from the Clock are converted at the top of `advance()`. MetronomePlayer receives ticks directly; ClipPlayer converts ticks to samples.

### TempoMap Cache Invalidation

`setTempo(bpm, atTick)` recomputes `secondsAtTick` from the insertion point forward. For single-tempo use (typical), this is a no-op — one entry at tick 0.

### MeterMap

Parallel to TempoMap, stores time signature entries at tick positions. Each entry: `{ tick, numerator, denominator, barAtTick }`.

- **Beat unit from denominator:** `ticksPerBeat = ppqn * (4 / denominator)`. A denominator of 4 gives one quarter-note beat; 8 gives one eighth-note beat.
- **Bar boundary constraint:** `setMeter(numerator, denominator, atTick?)` snaps `atTick` forward to the next bar boundary if not already on one. This keeps bar numbers consistent for all subsequent entries.
- **Conversions:** `barToTick(bar)` walks the entry list accumulating bar counts; `tickToBar(tick)` is the inverse. Both return 1-indexed bar numbers.
- **`clearMeters()`** removes all entries and resets to the initial meter.
- **Tick-0 meter change re-snaps downstream entries** — `setMeter(n, d)` at tick 0 calls `_resnapDownstreamEntries` to move all subsequent entries to bar boundaries of the new meter. Without this, `barAtTick` becomes fractional, breaking `barToTick`/`tickToBar` round-trips.

`MetronomePlayer.generate()` queries the MeterMap per beat to determine accent placement (beat 1 of each bar) and beat unit duration.

## Audio Layer

### TrackNode Signal Chain

```
clip source → GainNode (volume) → StereoPannerNode → GainNode (mute) → [effects hook] → output
```

Mute uses a separate GainNode (0/1) so volume and mute are independent. `connectEffects(node)` inserts any AudioNode chain between mute and output.

### ClipPlayer

Implements `SchedulerListener<ClipEvent>`. `generate(fromTick, toTick)` converts ticks to samples via `SampleTimeline.ticksToSamples()`, finds clips whose `startSample` falls in the window, and does loop clamping in integer samples (`_loopEndSamples`). Has two loop setters: `setLoop(startTick, endTick)` converts via SampleTimeline, `setLoopSamples(startSample, endSample)` stores directly. `consume()` converts `event.tick` → seconds → audio time, then samples → seconds for `source.start(when, offset, duration)`. `onPositionJump(newTick)` converts to samples, stops all active sources, and creates mid-clip sources for clips spanning the new position.

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

## NativePlayoutAdapter

Thin bridge to `PlaylistEngine`. Implements all `PlayoutAdapter` methods (required + optional: `addTrack`, `removeTrack`, `updateTrack`). `init()` resumes suspended AudioContext. `transport` getter exposes the Transport for direct access to tempo, metronome, and effects hooks.

## Patterns

- **AudioContext received from consumer** — sidesteps all Tone.js/Firefox context creation issues. `new AudioContext({ sampleRate, latencyHint })` works natively.
- **Convenience API variants must mirror primary** — `setLoopSeconds` delegates to `setLoop` (inherits all validation). `setLoopSamples` bypasses `setLoop` and calls `_clipPlayer.setLoopSamples` + `_scheduler.setLoop` directly, so it must duplicate all state updates and validation from the primary (`_loopEnabled`, `_loopStartSeconds`, `isFinite` guard, start >= end guard).
- **`silence()` on stop/seek** — listeners are responsible for stopping their active sources. `AudioBufferSourceNode.stop()` is instantaneous.
- **No Tone.js in the signal path** — all audio nodes are native Web Audio.
- **`_activeSources` cleanup** — ClipPlayer uses `ended` event listener for automatic cleanup. MetronomePlayer clicks are short one-shots.
- **rAF exclusively** — no setTimeout/setInterval anywhere. The lookahead window (200ms) provides sufficient scheduling headroom.
- **Scheduler lookahead ≠ perceptible latency** — The 200ms lookahead is scheduling headroom only. `source.start(when)` uses precise `AudioContext.currentTime` values, so audio plays at the exact right time. Recording latency compensation only needs `outputLatency`, not `outputLatency + lookahead`.

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

### rAF Test Snapshot Pattern

Tests that drive the Timer via `requestAnimationFrame` stubs must snapshot the callback array before iterating: `const snapshot = [...rafCallbacks]; for (const cb of snapshot) { cb(...); }`. Iterating `rafCallbacks` directly causes infinite growth — each callback schedules another via `_scheduleFrame()`. Always call `transport.stop()` after driving the loop to prevent zombie timers.

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

### dawcore dev pages

All dev pages use the native transport. `multiclip.html` passes a custom AudioContext; `index.html` and `record.html` use the editor's default.

**Gotcha:** Dev pages call `Transport` methods directly (not via the adapter). When Transport APIs change (e.g., `setLoop` switching from seconds to ticks), dev pages break silently. Always grep `packages/dawcore/dev/` for changed method names.

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

