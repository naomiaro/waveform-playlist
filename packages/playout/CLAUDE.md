# Playout Package (`@waveform-playlist/playout`)

## Tone.js Adapter (`createToneAdapter`)

**Purpose:** Bridges `PlayoutAdapter` interface to `TonePlayout`/`ToneTrack` classes.

**Location:** `src/TonePlayoutAdapter.ts`

**Pattern:** Factory/closure (not class). Rebuild-on-`setTracks()` — disposes old `TonePlayout`, creates fresh one.

**Key mappings:** `ClipTrack.volume` → `Track.gain`, `ClipTrack.pan` → `Track.stereoPan`, sample-based clips → seconds via core helpers.

**Clip time helpers:** `clipStartTime`, `clipEndTime`, `clipOffsetTime`, `clipDurationTime` in `packages/core/src/clipTimeHelpers.ts`. Pure functions: `samples / sampleRate`.

**Testing:** `src/__tests__/TonePlayoutAdapter.test.ts` — mocks `TonePlayout` to avoid AudioContext. `packages/core/src/__tests__/clipTimeHelpers.test.ts`.

## Transport-Synced Players

Players are synced to Tone.js Transport at creation time via `player.sync().start(transportTime, bufferOffset, duration)`. This bypasses the [StateTimeline bug](https://github.com/Tonejs/Tone.js/issues/1076) — synced playback uses `_syncedStart()` which only reads the StateTimeline (never writes), so the monotonically-increasing constraint is never violated.

**ToneTrack** is a passive audio graph — no `play()`/`pause()`/`stop()` methods. Transport drives all playback.

**Fades** are re-scheduled on each play via `prepareFades(when, transportOffset)` and cleared on pause/stop via `cancelFades()`.

**Completion detection:** `TonePlayout` schedules a single `Transport.scheduleOnce()` event at `offset + duration` for duration-limited playback, instead of tracking per-track stop callbacks.

**WAV export** is not affected — `useExportWav.ts` creates its own Players inside `Tone.Offline`, never touching `ToneTrack` or `TonePlayout`.

## Global AudioContext Pattern

**Implementation:** Recording and playback use a global shared AudioContext (same as Tone.js).

**Location:** `getGlobalContext()` from `src/audioContext.ts`

**Critical:** Context must be resumed on user interaction via `resumeGlobalAudioContext()`

## Tone.js Initialization

**Critical:** Call `await Tone.start()` after user interaction and before `Tone.now()`.

Without `Tone.start()`, `Tone.now()` returns null → RangeError in scheduling.

**Safari Latency:** `TonePlayout.init()` already calls `await start()`. Do NOT call `await toneStart()` separately in play handlers — the redundant await adds ~2 seconds of latency on Safari.

**Master volume:** Uses Web Audio standard 0-1.0 range (not 0-100).

## Tone.js Internal AudioParam Access

**Pattern:** `getUnderlyingAudioParam(signal)` in `src/fades.ts` — accesses raw `AudioParam` via `_param` for `setValueAtTime`/`cancelScheduledValues` when Tone.js Signal wrapper doesn't propagate changes (e.g., suspended AudioContext). Includes a one-time warning if `_param` is missing.

**Used in:** `ToneTrack.setMute()`, `ToneTrack.scheduleFades()`, `ToneTrack.cancelFades()`

**Risk:** `_param` is a private Tone.js 15.x internal. Pin version carefully.

## Firefox Compatibility (standardized-audio-context)

**Problem 1: AudioListener Error**
Firefox throws `"param must be an AudioParam"` when Tone.js initializes because Firefox's `AudioListener` implementation differs from Chrome/Safari.

**Problem 2: AudioWorkletNode Error**
Firefox throws `"parameter 1 is not of type 'BaseAudioContext'"` when creating `AudioWorkletNode` with a native `AudioContext`.

**Root Cause:** Both issues stem from using native `AudioContext` instead of `standardized-audio-context` which normalizes browser differences.

**Solution:** Use Tone.js's `Context` class directly. It wraps `standardized-audio-context` and provides cross-browser compatible methods:

```typescript
// src/audioContext.ts
import { Context, setContext } from 'tone';

export function getGlobalContext(): Context {
  if (!globalToneContext) {
    globalToneContext = new Context();
    setContext(globalToneContext);
  }
  return globalToneContext;
}
```

**References:**
- [Tone.js Issue #681](https://github.com/Tonejs/Tone.js/issues/681) - AudioListener Firefox error
