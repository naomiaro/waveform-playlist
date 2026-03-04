# Playout Package (`@waveform-playlist/playout`)

## Tone.js Adapter (`createToneAdapter`)

**Purpose:** Bridges `PlayoutAdapter` interface to `TonePlayout`/`ToneTrack` classes.

**Location:** `src/TonePlayoutAdapter.ts`

**Pattern:** Factory/closure (not class). Rebuild-on-`setTracks()` — disposes old `TonePlayout`, creates fresh one. Generation counter prevents stale completion callbacks. Loop state (`_loopEnabled`, `_loopStart`, `_loopEnd`) and `_audioInitialized` persist across rebuilds.

**Key mappings:** `ClipTrack.volume` → `Track.gain`, `ClipTrack.pan` → `Track.stereoPan`, sample-based clips → seconds via core helpers.

**Clip time helpers:** `clipStartTime`, `clipEndTime`, `clipOffsetTime`, `clipDurationTime` in `packages/core/src/clipTimeHelpers.ts`. Pure functions: `samples / sampleRate`.

**Testing:** `src/__tests__/TonePlayoutAdapter.test.ts` — mocks `TonePlayout` to avoid AudioContext. `packages/core/src/__tests__/clipTimeHelpers.test.ts`.

## Transport.schedule() Architecture

**Approach:** Uses `Transport.schedule()` + native `AudioBufferSourceNode` instead of `Player.sync()`. This eliminates three Tone.js private-internal workarounds that the `Player.sync()` approach required:

1. **No tick-0 guard** — `Player.sync()` needed patching of `Player._scheduled` and `Player._start()` to prevent phantom replays from TickSource drift after stop-start cycles
2. **No orphaned `_activeSources`** — `Player.sync()` needed force-disposing Player's private `Set` because cleanup is async
3. **No `_param` on fade GainNodes** — native `GainNode.gain` is already an `AudioParam` (no Tone.js Signal wrapper)

**Audio graph (per clip):**
```
AudioBufferSourceNode (native, one-shot, created per play/loop)
  → GainNode (native, per-clip fade envelope)
  → Volume.input (Tone.js, shared per-track)
  → Panner (Tone.js, shared per-track)
  → muteGain (Tone.js, shared per-track)
  → effects chain or destination
```

**Key design:**
- `Transport.schedule(callback, absTime)` creates permanent timeline events that re-fire on every loop iteration
- Each callback creates a fresh `AudioBufferSourceNode` (one-shot), connects to the persistent per-clip `GainNode`, and starts it
- `activeSources: Set<AudioBufferSourceNode>` tracks live sources (own Set, not Player internals)
- Native sources don't respond to `Transport.pause()`/`Transport.stop()` — `stopAllSources()` must be called explicitly

**Mid-clip start:** When play starts mid-clip (e.g., offset 5s, clip runs 3s–8s), `Transport.schedule(cb, 3s)` won't fire (already passed). `startMidClipSources(5s, now)` detects spanning clips and creates sources with adjusted offset/duration. Uses strict `<` guard (`absClipStart < transportOffset`) to avoid double-creation with schedule callbacks at exact position.

**Loop handling:** Transport `loop` event fires BEFORE schedule callbacks (event ordering: `loopEnd` → ticks reset → `loopStart` → `loop` → `forEachAtTime`). Loop handler: `stopAllSources()` + `cancelFades()` + `startMidClipSources(loopStart)` + `prepareFades()`.

**Schedule guard offset (`_scheduleGuardOffset`):** Ghost ticks from stale `Clock._lastUpdate` can fire `Transport.schedule()` callbacks at past positions (second manifestation of #1419). After a loop iteration resets ticks to ~0, ghost ticks include near-0 values, causing `Transport.schedule(cb, 0)` to fire even when starting at offset 1.5s. This creates duplicate `AudioBufferSourceNode`s alongside those from `startMidClipSources()`. Fix: `_scheduleGuardOffset` on ToneTrack suppresses schedule callbacks for clips before the play/loop offset. Set before `transport.start()` and in the loop handler. Complementary with `startMidClipSources`' strict `<` guard — no gaps, no overlap.

**Native→Tone.js connection:** `fadeGainNode.connect((volumeNode.input as unknown as Gain).input)` — accesses the native GainNode backing Tone.js Volume's input Gain (double cast needed, see Type Gotchas below).

**Loop property ordering:** `_processTick` checks `ticks >= _loopEnd` every tick. `_loopEnd` defaults to `0`, so `transport.loop = true` before updating `loopEnd` causes immediate wrap. **Always:** set `loopStart`/`loopEnd` BEFORE `transport.loop = enabled`.

**Ghost tick loop wrap (root cause + fix):** After stop/start cycles, `Clock._lastUpdate` is stale (set by the previous context tick). `Clock._loop()` processes ticks from `[_lastUpdate, now()]`. In the gap `[_lastUpdate, startTime)`, the TickSource is still "started" from the PREVIOUS play cycle with its old tick offset — those accumulated ticks can exceed `_loopEnd`, causing `_processTick` to wrap immediately to loopStart. **Fix:** Advance `(transport as any)._clock._lastUpdate = startTime` after `transport.start()`. The next `Clock._loop()` only processes `[startTime, now()]` — ticks from the current play cycle with the correct offset. This eliminates the need for deferred loop enable via `setTimeout(0)`. See [Tone.js #1419](https://github.com/Tonejs/Tone.js/issues/1419).

**Tone.js source location (pnpm):** `node_modules/.pnpm/tone@15.1.22/node_modules/tone/build/esm/core/clock/` — Clock.js, TickSource.js, Transport.js. Note: `Clock` pre-binds `_processTick` in its constructor (`this._processTick.bind(this)`), so monkey-patching Transport._processTick at runtime has no effect.

**Cached loop state:** `TonePlayout` caches loop state (`_loopEnabled`, `_loopStart`, `_loopEnd`) from `setLoop()`. In `play()`, these cached values set `loopStart`/`loopEnd` on the Transport before `transport.start()`. Engine calls `adapter.setLoop()` before `adapter.play()` so the cached state is up-to-date when `play()` applies it.

**Optimistic cached state in `setLoop()`:** `_loopEnabled`/`_loopStart`/`_loopEnd` are updated BEFORE the try block that sets Transport properties. If Transport throws, the cached state still reflects the caller's intent — `play()` will use the correct values on the next attempt. Moving the cache update after the try block risks divergence on error (early return skips the update).

**Loop handler cleanup in `stop()`:** `stop()` removes the loop handler (`transport.off('loop', ...)`) and nulls `_loopHandler` BEFORE calling `stopAllSources()`. This prevents a race condition where a loop event fires during `transport.stop()` processing, creating new sources via `startMidClipSources()` after cleanup. The handler is removed independently of `setLoop(false)` for defense-in-depth — `stop()` must be self-contained.

## Tone.js Type Gotchas

**Gain generic mismatch:** `Volume.input` is `Gain<"decibels">` but plain `Gain` import defaults to `Gain<"gain">`. Accessing native input requires double cast: `(this.volumeNode.input as unknown as Gain).input`.

## Global AudioContext Pattern

**Implementation:** Recording and playback use a global shared AudioContext (same as Tone.js).

**Location:** `getGlobalAudioContext()` from `src/audioContext.ts`

**Critical:** Context must be resumed on user interaction via `resumeGlobalAudioContext()`

## Tone.js Initialization

**Critical:** Call `await Tone.start()` after user interaction and before `Tone.now()`.

Without `Tone.start()`, `Tone.now()` returns null → RangeError in scheduling.

**Safari Latency:** `TonePlayout.init()` already calls `await start()`. Do NOT call `await toneStart()` separately in play handlers — the redundant await adds ~2 seconds of latency on Safari.

**Master volume:** Uses Web Audio standard 0-1.0 range (not 0-100).

## Tone.js Internal AudioParam Access

**Pattern:** Access raw `AudioParam` via `(signal as any)._param` for `setValueAtTime` when Tone.js Signal wrapper doesn't propagate changes (e.g., suspended AudioContext).

**Used in:** `ToneTrack.setMute()` — ensures mute takes effect immediately even when AudioContext is suspended. Consolidated into `getUnderlyingAudioParam()` utility in `fades.ts` with null guard and one-time warning.

**Not used for fades:** Per-clip fade envelopes use native `GainNode.gain` (already an `AudioParam`), so `_param` workaround is not needed there.

**Risk:** `_param` is a private Tone.js 15.x internal. Pin version carefully. See [Tone.js #1418](https://github.com/Tonejs/Tone.js/issues/1418).

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

**Recording/Monitoring:** Use Tone.js Context methods directly:

```typescript
// packages/recording/src/hooks/useRecording.ts
import { getGlobalContext } from '@waveform-playlist/playout';

const context = getGlobalContext();

// These methods handle cross-browser compatibility automatically:
await context.addAudioWorkletModule(workletUrl);
const workletNode = context.createAudioWorkletNode('recording-processor');
const source = context.createMediaStreamSource(stream);
const analyser = context.createAnalyser();
```

**Key Files:**
- `src/audioContext.ts` - Context management (`getGlobalContext()`)
- `packages/recording/src/hooks/useRecording.ts` - Uses Tone.js Context methods
- `packages/recording/src/hooks/useMicrophoneLevel.ts` - Uses Tone.js Context methods

**References:**
- [Tone.js Issue #681](https://github.com/Tonejs/Tone.js/issues/681) - AudioListener Firefox error
