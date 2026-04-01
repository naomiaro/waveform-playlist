# Playout Package (`@waveform-playlist/playout`)

## Tone.js Adapter (`createToneAdapter`)

**Purpose:** Bridges `PlayoutAdapter` interface to `TonePlayout`/`ToneTrack` classes.

**Location:** `src/TonePlayoutAdapter.ts`

**Pattern:** Factory/closure (not class). `setTracks()` does incremental track updates (no full rebuild after initial creation). `updateTrack()` replaces a single track's clips via `ToneTrack.replaceClips()`. `buildPlayout()` only runs on the first `setTracks()` call — the playout persists for the adapter's lifetime. Loop state (`_loopEnabled`, `_loopStart`, `_loopEnd`) and `_audioInitialized` persist.

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

## MidiToneTrack (MIDI Playback)

**Location:** `src/MidiToneTrack.ts`

**Architecture:** Always creates both melodic (`PolySynth<Synth>`) and percussion synths. Per-note routing uses `MidiNoteData.channel` — channel 9 → percussion, others → melodic. This enables flattened tracks (mixed channels) to play correctly.

**Percussion synths:** `PolySynth<MembraneSynth>` (kick, tom), `PolySynth<MetalSynth>` (cymbals/hi-hats), `NoiseSynth` (snare, monophonic with try-catch). PolySynth wrappers are required because `MembraneSynth` and `MetalSynth` extend `Monophonic` — rapid notes (e.g., 953 hi-hat hits) throw "Start time must be strictly greater" and go silent without polyphony.

**PolySynth type casting:** `new PolySynth(MembraneSynth, { voice, options } as never)` — Tone.js PolySynth constructor types are designed around `Synth`; wrapping other voice classes requires `as never` cast. Runtime behavior is correct.

**PolySynth calling convention:** Wrapping a monophonic synth changes the API — `MetalSynth.triggerAttackRelease(duration, time, velocity)` becomes `PolySynth<MetalSynth>.triggerAttackRelease(note, duration, time, velocity)`. Missing the note arg passes duration as frequency (e.g., 0.06 Hz = inaudible).

**Test mocking:** `src/__tests__/MidiToneTrack.test.ts` uses a `polySynthCallCount` counter in the PolySynth mock to differentiate melodic (first call) from percussion synths (subsequent calls). Reset in `beforeEach`.

## Tone.js Type Gotchas

**Gain generic mismatch:** `Volume.input` is `Gain<"decibels">` but plain `Gain` import defaults to `Gain<"gain">`. Accessing native input requires double cast: `(this.volumeNode.input as unknown as Gain).input`.

## Global AudioContext Pattern

**Implementation:** Recording and playback use a global shared AudioContext (same as Tone.js).

**Location:** `getGlobalAudioContext()` from `src/audioContext.ts`

**Critical:** Context must be resumed on user interaction via `resumeGlobalAudioContext()`

**Rule:** Always use `getGlobalAudioContext()` — never `new AudioContext()`. Firefox blocks AudioContexts created before user gesture. The global context is shared with Tone.js and properly resumed via `Tone.start()` on first play. This applies to SoundFont loading, recording, monitoring, and any feature needing audio processing.

**SoundFontCache uses OfflineAudioContext by default:** The `context` constructor arg is optional. When omitted, `SoundFontCache` creates an `OfflineAudioContext(1, 1, 44100)` — sufficient for `createBuffer()` and doesn't trigger Firefox's autoplay block. Only pass a real AudioContext if you need the buffers connected to live audio output (which SoundFontCache doesn't).

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

## SoundFont Playback (SoundFontToneTrack)

**Location:** `src/SoundFontToneTrack.ts`, `src/SoundFontCache.ts`

**Architecture:** Opt-in replacement for `MidiToneTrack`. When `soundFontCache` is provided to `TonePlayoutAdapter`, MIDI clips route to `SoundFontToneTrack` instead of `MidiToneTrack`. Falls back to PolySynth when no SoundFont loaded.

**Audio graph per note:**
```
AudioBufferSourceNode (native, one-shot, pitch-shifted via playbackRate)
  → GainNode (native, per-note ADSR volume envelope)
  → Volume.input (Tone.js, shared per-track)
  → Panner → muteGain → effects/destination
```

**SoundFontCache:** Fetches SF2 URL → parses with `soundfont2` library → caches `AudioBuffer` per sample index. `getAudioBuffer(midiNote, bank, preset)` returns `SoundFontSample` with `buffer`, `playbackRate`, loop points, and volume envelope. AudioBuffer is cached by sample index (shared across zones), but loop/envelope data is per-zone (extracted from generators on each lookup). Lazily converts `Int16Array` → `Float32Array` → `AudioBuffer` on first access.

**SF2 Pitch Resolution (critical gotcha):** Many SF2 files use the `OverridingRootKey` generator, NOT `sample.header.originalPitch`, for the actual root pitch. Using only `originalPitch` causes badly out-of-tune playback. Full generator chain:
1. `OverridingRootKey` generator (most specific, per-zone)
2. `sample.header.originalPitch` (sample header, skip if 255 = "unpitched")
3. Fallback to MIDI note 60 (middle C)
4. Tuning: `CoarseTune` (semitones) + `FineTune` (cents) + `pitchCorrection` (cents)
5. `playbackRate = 2^((midiNote - rootKey + coarseTune + (fineTune + pitchCorrection) / 100) / 12)`

**Per-note channel routing:** Same as MidiToneTrack — channel 9 → bank 128 (drums), others → bank 0 with `programNumber`. Works with flattened mixed-channel clips.

**SF2 Sample Looping:** `SampleModes` generator controls: 0=no loop, 1=continuous, 3=sustain loop. Loop points computed from `header.startLoop`/`endLoop` + coarse/fine generator offsets, converted to AudioBuffer-relative seconds. Web Audio's `source.loop`/`loopStart`/`loopEnd` handles both modes.

**soundfont2 library gotcha:** The `soundfont2` npm library already subtracts `header.start` from `startLoop`/`endLoop` during parsing — loop indices are already relative to `sample.data[0]`. Do NOT subtract `header.start` again when converting to seconds. Double-subtraction shifts the loop window to the wrong position, producing a buzzy saw-wave artifact. Local source available at `/Users/naomiaro/Code/soundfont2`.

**SF2 Volume ADSR Envelope:** Replaces the old flat gain + 50ms release. Per-zone generators define attack/hold/decay (timecents → seconds via `2^(tc/1200)`), sustain (centibels attenuation → linear gain via `10^(-cb/200)`), and release (capped at 5s). Full envelope: silent → attack ramp → hold → decay to sustain → sustain until note-off → release ramp to 0.

**SF2 Non-Looping Sample Duration:** For `loopMode === 0` (percussion, piano, one-shots), use `buffer.duration / playbackRate` as effective note duration instead of MIDI note duration. MIDI percussion hits are often 0.06s but the sample needs to ring out fully. Looping samples (`loopMode === 1 or 3`) use MIDI note duration for note-off timing.

**Web Audio Automation Ordering:** `setValueAtTime` at note-off correctly cancels incomplete `linearRampToValueAtTime` ramps — do NOT use `Math.max(noteOff, envEnd)` to "fix" ordering. That extends every note to the full AHD phase length, breaking instruments with long decay (piano, strings). The original `time + duration` approach is correct.

**stopAllSources Pattern:** Only call `source.stop()`, never `source.disconnect()` before `stop()`. If `disconnect()` throws in a shared try-catch, `stop()` is skipped — leaving live sources running. The `onended` callback handles gainNode cleanup.

**Dependency:** `soundfont2` (MIT) in `package.json`. SF2 files have separate licenses — not bundled in npm package, users provide via URL.

## Incremental Track Updates

**`addTrackToPlayout()` helper:** Extracted from `buildPlayout`'s per-track loop. Shared by `buildPlayout`, `adapter.addTrack()`, and `adapter.updateTrack()`. Handles audio clips, MIDI clips, and SoundFont routing.

**`adapter.addTrack(track)`:** Adds a single track to the existing playout. Throws if called before `setTracks()` (no playout exists yet).

**`adapter.updateTrack(trackId, track)`:** For audio tracks, uses `ToneTrack.replaceClips()` which diffs clips and only reschedules changed ones. Falls back to remove+re-add for MIDI tracks.

**`adapter.setTracks(tracks)`:** First call creates the playout via `buildPlayout`. Subsequent calls do incremental removal+re-add (no full dispose).

**`ToneTrack.replaceClips(newClips, newStartTime?)`:** Diffs old vs new clips by buffer reference + timing + fades (`_clipsEqual`). Unchanged clips keep their active sources and Transport events — no audible interruption. Changed clips: fadeGainNode disconnected (silences source via broken audio path), new clip added. Updates `track.startTime` if the minimum clip position changed.

- **`replaceClips` force-reschedules on startTime change** — The diff uses relative `ClipInfo.startTime` values. When `track.startTime` shifts (e.g., moving the first clip), clips with unchanged relative positions kept stale Transport events at old absolute times. Fix: detect `newStartTime !== old startTime` and skip the diff, rescheduling all clips.
- **`skipAdapter` on `moveClip`/`trimClip`** — Engine's `moveClip(id, clipId, delta, skipAdapter=true)` updates internal state + emits statechange without touching the adapter. Dawcore uses this during drag (60fps) and calls `engine.updateTrack(trackId)` once on `pointerup`. Without this, `replaceClips` runs every frame, creating ghost audio from stale Transport events.
- **`engine.getClipBounds(trackId, clipId)`** — Returns `{ offsetSamples, durationSamples, startSample, sourceDurationSamples }` or null. Used by dawcore's trim handler to snapshot clip bounds at drag start for peak re-extraction.

**`ToneTrack.addClip(clipInfo)` / `removeScheduledClip(index)`:** Granular clip-level methods. `addClip` creates fadeGainNode + Transport.schedule. During playback, new clips that span the current Transport position get a mid-clip source started immediately with lookAhead compensation.

**lookAhead compensation:** New sources in `replaceClips` start at `transportOffset - lookAhead` (the audible position), not `transportOffset` (which is lookAhead ahead of what the listener hears). This overlaps with the old source's remaining buffered audio for a seamless transition.

**Testing:** `src/__tests__/ToneTrack.test.ts` — tests replaceClips diff, mid-clip restart, lookAhead compensation, buffer reference equality.

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

## Tone.js Panner Stereo Downmix Gotcha

**Critical:** `new Panner(pan)` defaults to `channelCount: 1` + `channelCountMode: "explicit"` (for standardized-audio-context compat). This forces stereo→mono downmix at 1/√2 gain before panning. Stereo recordings play back ~3dB quieter with identical L/R channels.

**Fix:** `ToneTrackOptions.channelCount` sets `Panner({ channelCount })`. Callers use `trackChannelCount(track)` from core. MidiToneTrack/SoundFontToneTrack use mono synth sources, so default `channelCount: 1` is correct there.

## Native AudioContext for sampleRate Control

**Critical:** `new Context({ sampleRate })` does NOT pass `sampleRate` through to `standardized-audio-context`. The option is silently ignored. Native `AudioContext({ sampleRate, latencyHint: 0 })` wrapped with `new Context(rawContext)` also causes Tone.js internal issues (reverted). `configureGlobalContext()` currently creates a standard `new Context()` and only compares the requested rate against the actual rate — it warns but cannot force the rate. The rate comparison + worker fallback handles mismatches. Revisit when Tone.js or standardized-audio-context supports sampleRate passthrough.

## Context Singleton Warning

**`getGlobalContext()` replaces Tone's default context.** Any Tone.js node created via `getContext()` BEFORE `getGlobalContext()` first runs will be on a different (orphaned) audio graph. This affects hooks that run on mount (useEffect with `[]` deps) — they may capture the default context before audio init. Always import and use `getGlobalContext()` for nodes that must be in the playback signal path.
