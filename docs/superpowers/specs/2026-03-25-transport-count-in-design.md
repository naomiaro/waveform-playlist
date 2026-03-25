# Transport Count-In Feature Design

**Date:** 2026-03-25
**Package:** `@dawcore/transport`
**Status:** Draft

## Overview

Add a count-in feature to the transport package. When enabled, pressing play triggers audible metronome clicks for a configurable number of bars before audio playback begins. The timeline holds at the play position during count-in — clips don't start until count-in completes.

## Requirements

1. **Boolean toggle** — `setCountIn(enabled)` to turn count-in on/off
2. **Configurable bar count** — `setCountInBars(bars)`, default 1, range 1–8
3. **Mode** — `setCountInMode(mode)`: `'recording-only'` (default) or `'always'`
4. **Always audible** — Count-in plays clicks regardless of `setMetronomeEnabled()` state
5. **Beat-by-beat events** — `countIn` event emits `{ beat, totalBeats }` for UI countdown
6. **Completion event** — `countInEnd` event fires when count-in finishes and playback begins
7. **Fresh play only** — Count-in triggers on fresh `play()`, not on resume after pause
8. **Uses active meter** — Count-in reads tempo and time signature at the play position
9. **Same click sounds** — Shares accent/normal buffers with MetronomePlayer
10. **Default click sounds** — Synthesized programmatically, no audio files. Configurable frequencies.

## Architecture

### Tick Coordinate Space

The count-in scheduler operates in its **own tick space starting at tick 0**. It does not use timeline ticks. The count-in duration in ticks is calculated from the meter at the play position:

```
countInTicks = _countInBars * ticksPerBar(playPositionTick)
```

The count-in scheduler advances from tick 0 to `countInTicks`. CountInPlayer generates beats in this range. The `beat` field is derived from position within this range, not from timeline position.

The count-in scheduler **shares the main TempoMap** for tick↔seconds conversion (tempo at the play position determines click spacing). It also **shares the main Clock** — the clock runs during count-in to drive the scheduler's `advance()`. The Transport stores `_countInStartPosition` to return from `getCurrentTime()` during count-in, since the clock is advancing but the timeline should appear frozen.

The count-in Timer uses the same `requestAnimationFrame` mechanism as the main Timer. Its callback calls `_countInScheduler.advance(_clock.getTime())`.

### Count-In Completion Detection

CountInPlayer tracks consumed beats via an internal `_beatsConsumed` counter, reset at the start of each count-in via `configure()`. When `_beatsConsumed === totalBeats`, it calls an `onComplete` callback provided by the Transport. This callback triggers the transition from count-in to normal playback.

### New Files

#### `src/audio/count-in-player.ts`

Implements `SchedulerListener<CountInEvent>`. Temporary listener — added to a count-in scheduler only during the count-in phase.

```typescript
interface CountInEvent extends SchedulerEvent {
  isAccent: boolean;
  buffer: AudioBuffer;
  beat: number;        // 1-indexed current beat
  totalBeats: number;  // total beats in count-in
}
```

**Configuration method:**

```typescript
configure(options: {
  totalBeats: number;
  accentBuffer: AudioBuffer;
  normalBuffer: AudioBuffer;
  meterMap: MeterMap;
  onBeat: (beat: number, totalBeats: number) => void;
  onComplete: () => void;
}): void
```

Resets `_beatsConsumed` to 0 and stores callbacks. Called by Transport before each count-in.

**Behavior:**

- `generate(fromTick, toTick)` — walks the beat grid starting from tick 0 using MeterMap, attaches `beat`/`totalBeats` to each event. Only generates up to `totalBeats` events total.
- `consume(event)` — schedules `AudioBufferSourceNode` for the click, calls `onBeat(event.beat, event.totalBeats)`, increments `_beatsConsumed`. When `_beatsConsumed === totalBeats`, calls `onComplete()`.
- `onPositionJump()` — no-op (same as MetronomePlayer — clicks are short one-shots)
- `silence()` — stops all active sources

**Lifecycle:** Constructed once by Transport. Configured via `configure()` before each count-in. Not a permanent scheduler listener.

**Note:** `onComplete` fires synchronously inside `consume()`, which is called from the scheduler's `_generateAndConsume` loop. This is safe because the callback stops the count-in timer (not the scheduler mid-iteration) and the scheduler loop completes normally with no further events to process (the last beat has been consumed).

#### `src/audio/click-sounds.ts`

Utility to synthesize default click sounds:

```typescript
interface ClickSoundOptions {
  accentFrequency?: number;   // default: 1000 Hz
  normalFrequency?: number;   // default: 800 Hz
}

function createDefaultClickSounds(
  audioContext: AudioContext,
  options?: ClickSoundOptions
): { accent: AudioBuffer; normal: AudioBuffer }
```

Generates short sine wave AudioBuffers with exponential decay envelope (~40ms accent, ~30ms normal). Pure math — no files, no fetch.

### Modified Files

#### `src/transport.ts`

**New state:**

```typescript
_countInEnabled = false
_countInBars = 1
_countInMode: CountInMode = 'recording-only'
_recording = false
_countingIn = false
_countInStartPosition = 0              // play position stored for getCurrentTime()
_countInPlayer: CountInPlayer
_countInScheduler: Scheduler           // dedicated, shares main TempoMap + Clock
_countInTimer: Timer                   // dedicated, drives count-in scheduler
_accentBuffer: AudioBuffer | null      // default click sounds, shared
_normalBuffer: AudioBuffer | null
```

The count-in scheduler is constructed once in `_initAudioGraph()`, sharing the main `_tempoMap`. The count-in timer drives `_countInScheduler.advance(_clock.getTime())`. Both are reused across count-ins (reset, not recreated).

**New public methods:**

```typescript
setCountIn(enabled: boolean): void
setCountInBars(bars: number): void          // clamped 1–8, non-integer rounded
setCountInMode(mode: CountInMode): void
setRecording(recording: boolean): void
isCountingIn(): boolean
```

**New events added to `TransportEvents`:**

The existing `_emit` method signature changes to support parameterized events:

```typescript
// TransportEvents updated — payloads added to tempochange, meterchange, and new count-in events
interface TransportEvents {
  play: () => void;
  pause: () => void;
  stop: () => void;
  loop: () => void;
  tempochange: (event: { bpm: number; atTick: Tick }) => void;
  meterchange: (event: { numerator: number; denominator: number; atTick: Tick }) => void;
  countIn: (event: CountInEventData) => void;
  countInEnd: () => void;
}

// _emit becomes:
private _emit<K extends TransportEventType>(event: K, ...args: Parameters<TransportEvents[K]>): void
```

This uses `Parameters<>` to extract the argument tuple for each event type. Existing `_emit('play')` calls continue to work with zero args. `_emit('countIn', { beat: 1, totalBeats: 4 })` passes the payload.

**Existing event payload additions:**

- `tempochange` now receives `{ bpm, atTick }` — the new BPM and the tick position where it was set. Consumers no longer need to call `getTempo()` after receiving the event.
- `meterchange` now receives `{ numerator, denominator, atTick }` — the new time signature and position. Consumers no longer need to call `getMeter()` after the event.
- Backwards compatible: existing listeners with `() => void` signatures ignore the payload via rest args.

**Call sites updated:**

- `setTempo()` → `this._emit('tempochange', { bpm, atTick: atTick ?? 0 as Tick })`
- `setMeter()` → `this._emit('meterchange', { numerator, denominator, atTick: atTick ?? 0 as Tick })`
- `clearTempos()` → `this._emit('tempochange', { bpm: this._tempoMap.getTempo(), atTick: 0 as Tick })`
- `clearMeters()` → `this._emit('meterchange', { ...this._meterMap.getMeter(), atTick: 0 as Tick })`
- `removeMeter()` → `this._emit('meterchange', { ...this._meterMap.getMeter(atTick), atTick })`

**Modified `play()` flow:**

1. Check if count-in should activate:
   - `_countInEnabled === true`
   - Click sounds are loaded (accent + normal buffers exist)
   - Mode check: if `'recording-only'`, require `_recording === true`
2. If count-in activates:
   - Set `_countingIn = true`, `_countInStartPosition = currentTime`
   - Also set `_playing = true` so that `play()` re-entry is guarded (see edge case: double `play()`)
   - Query MeterMap at play position for `ticksPerBar` → calculate `totalBeats = numerator * _countInBars`
   - Configure CountInPlayer via `configure()` with total beats, click sounds, meter info, `onBeat` callback (emits `countIn`), `onComplete` callback (triggers transition)
   - Reset count-in scheduler to tick 0
   - Add CountInPlayer to count-in scheduler
   - Start clock and count-in timer
   - CountInPlayer generates and consumes beats → `onBeat` fires → Transport emits `countIn` events
3. When count-in completes (`onComplete` callback from CountInPlayer):
   - Stop count-in timer
   - Remove CountInPlayer from count-in scheduler
   - Set `_countingIn = false`
   - Emit `countInEnd`
   - Seek clock to `_countInStartPosition`
   - Reset main scheduler to `_countInStartPosition`
   - Start main timer, create mid-clip sources via `onPositionJump()`
   - Emit `play`
4. If count-in should NOT activate: existing `play()` logic unchanged

**Modified `stop()` / `pause()` / `seek()`:**

If `_countingIn === true`:
- Stop count-in timer
- Silence CountInPlayer
- Remove CountInPlayer from count-in scheduler
- Set `_countingIn = false`
- No `countInEnd` emitted (cancelled, not completed)
- Then proceed with normal stop/pause/seek behavior

**Constructor changes:**

- Accept `accentFrequency` and `normalFrequency` in `TransportOptions`
- Call `createDefaultClickSounds()` to generate default buffers
- Store as `_accentBuffer` / `_normalBuffer` on Transport
- Call `_metronomePlayer.setClickSounds(accent, normal)` — MetronomePlayer gets default sounds out of the box (behavior change: previously required explicit `setMetronomeClickSounds()` call)
- `setMetronomeClickSounds()` overrides both the MetronomePlayer sounds and the Transport-stored buffers (so count-in also uses the custom sounds)
- CountInPlayer reads from Transport's stored buffers at configure time

**`getCurrentTime()` during count-in:**

Returns `_countInStartPosition` (the play position where playback will start), not the clock's running time. The clock is advancing to drive the count-in scheduler, but the timeline should appear frozen to consumers. The `countIn` event provides beat progress for UI countdown.

#### `src/types.ts`

New exported types:

```typescript
type CountInMode = 'always' | 'recording-only';

interface CountInEventData {
  beat: number;        // 1-indexed
  totalBeats: number;
}
```

#### `src/adapter.ts`

New pass-through methods on `NativePlayoutAdapter`:

```typescript
setCountIn(enabled: boolean): void
setCountInBars(bars: number): void
setCountInMode(mode: CountInMode): void
setRecording(recording: boolean): void
isCountingIn(): boolean
```

**Note:** These methods are NOT added to the `PlayoutAdapter` interface in `@waveform-playlist/engine`. They are transport-specific and accessed via `adapter.transport` or the concrete `NativePlayoutAdapter` type. The `PlayoutAdapter` interface stays generic — it has no knowledge of count-in or metronome. Consumers subscribe to `countIn`/`countInEnd` events via `adapter.transport.on(...)` (the `transport` getter is already public).

#### `src/index.ts`

Export new types: `CountInMode`, `CountInEventData`, `CountInEvent` (from count-in-player), `ClickSoundOptions` (from click-sounds).

`createDefaultClickSounds` is **not exported** — it is internal to the transport. Consumers override sounds via `setMetronomeClickSounds()`. If a consumer needs programmatic click synthesis, they can build their own buffers.

### Why a Separate Scheduler for Count-In?

The main scheduler drives ClipPlayer + MetronomePlayer. During count-in, only click sounds should play — no clips. Options considered:

1. **Gate ClipPlayer with a flag** — ClipPlayer checks `_countingIn` in `generate()` and returns `[]`. Works but couples ClipPlayer to count-in knowledge.
2. **Separate scheduler** — Clean isolation. Count-in has its own scheduler + timer with only CountInPlayer. Main scheduler is untouched.
3. **Remove/re-add ClipPlayer from main scheduler** — Fragile, order-dependent.

Option 2 chosen: cleanest separation, no changes to existing listeners, easy to reason about.

## Edge Cases

| Case | Behavior |
|------|----------|
| No click sounds loaded | Count-in skipped, play proceeds normally. Console warn. |
| Stop during count-in | Cancel count-in, silence clicks, reset position. No `countInEnd`. |
| Pause during count-in | Same as stop — cancel entirely. Half-finished count-in isn't resumable. |
| Seek during count-in | Cancel count-in, seek to new position. |
| Loop wrap | Count-in only on initial `play()`, never on loop wrap. |
| Meter at play position is 3/4 | Count-in plays 3 beats per bar (respects active meter). |
| `setCountInBars(0)` or negative | Clamped to 1 with console warn. |
| `setCountInBars(n)` where n > 8 | Clamped to 8 with console warn. |
| `setCountInBars(1.5)` (non-integer) | Rounded to nearest integer with `Math.round()`. |
| Play while already playing | No-op (existing guard: `if (this._playing) return`). |
| `play()` during count-in | No-op — `_playing` is set to `true` at count-in start. |
| `dispose()` during count-in | Cancels count-in (via `stop()`), disposes count-in scheduler/timer/player. |
| Multi-bar count-in crossing meter change | Uses meter at play position for all bars. Meter changes mid-count-in are a non-goal. |

## Test Plan

### `count-in-player.test.ts` (~10 tests)

- Generates correct beat count for 1 bar of 4/4 (4 beats)
- Generates correct beat count for 1 bar of 3/4 (3 beats)
- Generates correct beat count for 1 bar of 6/8 (6 beats)
- Beat 1 gets accent buffer, others get normal buffer
- `beat` field increments 1 through `totalBeats`
- Multi-bar count-in: 2 bars of 4/4 = 8 beats
- `onBeat` callback fires for each consumed event
- `silence()` stops all active sources
- No events generated when no buffers loaded

### `click-sounds.test.ts` (~5 tests)

- Creates accent and normal AudioBuffers
- Buffers have correct sample rate matching AudioContext
- Custom frequencies produce different buffer content
- Default frequencies used when options omitted
- Buffer duration is reasonable (~30-50ms)

### `transport-count-in.test.ts` (~15 tests)

- Count-in triggers on `play()` when enabled + mode satisfied
- Count-in skipped when disabled
- Count-in skipped when mode is `'recording-only'` and not recording
- Count-in triggers when mode is `'recording-only'` and recording is true
- Count-in triggers when mode is `'always'` regardless of recording
- `isCountingIn()` returns true during count-in, false otherwise
- `countIn` event fires per beat with correct `{ beat, totalBeats }`
- `countInEnd` event fires when count-in completes
- `stop()` during count-in cancels cleanly, no `countInEnd`
- `pause()` during count-in cancels cleanly
- `seek()` during count-in cancels cleanly
- Normal playback starts after count-in completes
- `getCurrentTime()` returns play position during count-in
- `setCountInBars()` clamps to 1–8 range
- Default click sounds created in constructor
- `play()` during count-in is no-op
- `dispose()` cleans up count-in scheduler, timer, player
- `setCountInBars(1.5)` rounds to 2
- `tempochange` event includes `{ bpm, atTick }` payload
- `meterchange` event includes `{ numerator, denominator, atTick }` payload
- `clearTempos()` emits `tempochange` with current default BPM
- `clearMeters()` emits `meterchange` with current default meter
- Existing `() => void` listeners still work (backwards compat)

## Non-Goals

- Visual countdown UI (consumer responsibility — use `countIn` event)
- Count-in during loop wrap
- Resumable count-in after pause
- Per-count-in tempo/meter override (always uses active map at play position)
- Recording integration beyond `setRecording()` — the recording system calls this
