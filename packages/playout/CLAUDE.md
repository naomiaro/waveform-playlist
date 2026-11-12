# Playout Package (`@waveform-playlist/playout`)

## Tone.js Adapter (`createToneAdapter`)

**Purpose:** Bridges `PlayoutAdapter` interface to `TonePlayout`/`ToneTrack` classes.

**Location:** `src/TonePlayoutAdapter.ts`

**Pattern:** Factory/closure (not class). `setTracks()` does incremental track updates (no full rebuild after initial creation). `updateTrack()` replaces a single track's clips via `ToneTrack.replaceClips()`. `buildPlayout()` only runs on the first `setTracks()` call — the playout persists for the adapter's lifetime. Loop state (`_loopEnabled`, `_loopStart`, `_loopEnd`) and `_audioInitialized` persist.

**Track effects come from `options.trackEffects(trackId)`, not from the track (#752).** `ClipTrack` has no `effects` field. The adapter calls the lookup each time it builds a track's graph (`addAudioTrackToPlayout`, `addMidiTrackToPlayout`), so it runs again on `setTracks`, `addTrack`, a SoundFont swap, and an `updateTrack` that builds instead of editing in place (a MIDI track, or the fallback when `replaceTrackClips` returns false: an empty audio placeholder getting its first clip, which is how a dropped file gets its chain). An `updateTrack` that only replaces the clips of an existing audio track keeps the graph and does not ask again. Keep it keyed by id: a function on the track object forces consumers to copy tracks, and track identity is what the React provider's incremental paths compare.

**One playout track per track, built from `track.kind` (#756).** `addTrackToPlayout` reads `trackKind(track)`: a MIDI track becomes a `MidiToneTrack` or `SoundFontToneTrack`, an audio track a `ToneTrack`, always under `track.id`. The engine throws on a track whose clips do not match its kind, so the adapter never sees a mixed one; the clip filters in the two builders only drop what cannot play yet (an undecoded clip, an empty note list). Until #756 a track with both kinds became two playout tracks (`id` and `id + ':midi'`), every setter forwarded to both, and the MIDI half was bridged into the audio half's effects chain (`mixedTrackEffects.ts`); all of that is removed. Do not add a second playout id per track again: mute, solo, volume, pan, removal, the SoundFont swap and the effects lookup each address exactly `track.id`. `ToneTrack.trackInput` (the getter the bridge used) is still exported and now has no caller in this repo.

**Key mappings:** `ClipTrack.volume` → `Track.gain`, `ClipTrack.pan` → `Track.stereoPan`, sample-based clips → seconds via core helpers.

**Clip time helpers:** `clipStartTime`, `clipEndTime`, `clipOffsetTime`, `clipDurationTime` in `packages/core/src/clipTimeHelpers.ts`. Pure functions: `samples / sampleRate`.

**Testing:** `src/__tests__/TonePlayoutAdapter.test.ts` — mocks `TonePlayout` to avoid AudioContext. `packages/core/src/__tests__/clipTimeHelpers.test.ts`.

## Tempo/Meter Support (Single-Value Only)

`TonePlayoutAdapter` implements `setTempo`, `setMeter`, `ticksToSeconds`, `secondsToTicks` with single-tempo/meter semantics. Throws `Error('Multiple tempo changes not supported by TonePlayoutAdapter')` if `atTick` is provided. `ppqn` configurable via `ToneAdapterOptions` (default 192, Tone.js native). `audioContext` getter returns `getGlobalAudioContext()`.

## Correctness Invariants (audit 2026-07-09, PRs #598/#599)

- **TonePlayout owns solo-aware muting** — manual mute changes store `manualMuteState` and route through `updateSoloMuting()`; never call `track.setMute()` directly for a manual toggle, or a non-soloed track becomes audible during an active solo.
- **Tone.js catches NOTHING in the tick chain** — `ToneEvent._tick → Transport._processTick → Clock._loop` are all unguarded (verified in 15.1.22 source). Every `Part`/`Transport.schedule` callback must contain its own failures in try/catch, or one throw aborts every other same-tick event across ALL tracks.
- **MediaStream has no `ended`/`inactive` events** — `ended` is track-level and fires only on remote end/device removal; a local `track.stop()` fires NO event (per spec). `getMediaStreamSource` auto-cleanup covers remote ends only; local teardown requires `releaseMediaStreamSource()`.

## Bounded Playback Completion (`onPlaybackEnded`, #608)

`TonePlayoutAdapter` implements the engine's optional `onPlaybackEnded(callback | null)` hook so the engine can observe a duration-limited `play(start, end)` (annotation/selection playback) ending on its own, without polling. Both `setOnPlaybackComplete` wirings — the eagerly-created initial playout (guarded by `_playoutGeneration === 1`) and the one set inside `buildPlayout` for a rebuilt playout (guarded by `generation === _playoutGeneration`) — call `_onPlaybackEnded?.()` right after clearing `_isPlaying`, inside their existing generation guard. A stale playout from a superseded rebuild can't fire completion into the current generation.

`dispose()` clears `_onPlaybackEnded = null` — idempotent with the engine's own `onPlaybackEnded(null)` unsubscribe on its `dispose()` (either side may run first depending on teardown order; both leave the slot empty).

**`dispose()` → `setTracks()` is the only real `buildPlayout` rebuild path.** The initial playout is created eagerly at adapter construction (not via `buildPlayout`), so `playout` only becomes `null` — the condition `setTracks()` checks to call `buildPlayout` — after `dispose()`. Every rebuild re-registers the completion callback there, generation-guarded as above.

## Cross-Context Worklet Bridge

`TonePlayoutAdapter` implements `createAudioWorkletNode` and `createMediaStreamSource` for dawcore recording compatibility. These use `getGlobalContext()` (Tone.js Context wrapper) which works with standardized-audio-context. `addWorkletModule` is NOT needed — `rawContext.audioWorklet.addModule()` works identically for both native and standardized contexts.

## Master Output Tap

`TonePlayout` creates a Tone.js `Gain` tap node in the signal chain: `masterVolume → [effects] → tap → destination`. Exposed as `masterOutputNode` (native GainNode via `_masterTap.input`). Consumers connect analyzers/effects/recorders to the tap — parallel (`.connect()` without disconnecting) or serial (`.disconnect(destination)` then rewire).

**Eager playout creation:** `createToneAdapter()` calls `getGlobalContext()` BEFORE `new TonePlayout()` so the playout's nodes share the same standardized-audio-context as `adapter.audioContext`. Without this, `Volume` is created on Tone's default context (replaced later by `setContext`), causing cross-context connect errors.

**`adapter.lookAhead`** — `TonePlayoutAdapter` exposes the Tone Context's `lookAhead` (~0.1s default). Consumers visualizing playback position must subtract `adapter.lookAhead` from `getCurrentTime()` in addition to `audioContext.outputLatency` — `Transport.seconds` is the scheduling position, which runs `lookAhead` ahead of what the listener hears. Native adapter doesn't implement this getter (returns undefined → 0). The optional property lives on the engine `PlayoutAdapter` interface so consumers don't have to know about Tone Context vs raw AudioContext.

## Transport.schedule() Architecture

**Approach:** Uses `Transport.schedule()` + native `AudioBufferSourceNode` instead of `Player.sync()`. This eliminates three Tone.js private-internal workarounds that the `Player.sync()` approach required:

1. **No tick-0 guard** — `Player.sync()` needed patching of `Player._scheduled` and `Player._start()` to prevent phantom replays from TickSource drift after stop-start cycles
2. **No orphaned `_activeSources`** — `Player.sync()` needed force-disposing Player's private `Set` because cleanup is async
3. **No `_param` on fade GainNodes** — native `GainNode.gain` is already an `AudioParam` (no Tone.js Signal wrapper)

**Audio graph (per clip):**

```
AudioBufferSourceNode (native, one-shot, created per play/loop)
  → GainNode (native, per-clip fade envelope)
  → inputGain (Tone.js, shared per-track, unity)
  → [effects — pre-fader insert, #660]
  → Volume (Tone.js, shared per-track)
  → pan stage (core `createPanStage` gain matrix, native nodes — NOT a Tone Panner)
  → muteGain (Tone.js, shared per-track)
  → destination
```

**Pre-fader effects (#660).** All three track classes (`ToneTrack`, `MidiToneTrack`, `SoundFontToneTrack`) sum their sources into `inputGain` and insert effects between it and `Volume` — the `TrackEffectsFunction` closure is called as `effects(inputGain, volumeNode, false)`, and `ToneTrack.connectEffects(input, output)` (behind `TonePlayout.connectTrackEffects` / `adapter.transport.connectTrackEffects`) wires `inputGain → input … output → Volume`'s native input. Mute is last, so mute/solo cut effect tails. A closure that ignores its second argument and connects to the master or `toDestination()` now BYPASSES volume, pan, mute and solo — it must end at `faderInput`. **Pan stage — no Tone `Panner` (core's `createPanStage`, #669).** Tone's `Panner` pins `channelCountMode: 'explicit'` with a fixed, source-sized `channelCount`, and standardized-audio-context (Tone's default, the React default) throws `NotSupportedError` on any attempt to change it (its bug #105 — the Safari StereoPanner polyfill can't do `clamped-max`, so every browser is pinned). Once a chain feeds the panner, a mono track's stereo effect was summed to mono (measured: a left-only effect came out L = R). Core's `createPanStage(getContext().rawContext, pan, sourceChannelCount)` replaces it in all three track classes and in the browser's offline render: an explicit-stereo input gain → splitter → a 2×2 gain matrix → merger, NATIVE nodes built on Tone's raw context (no context restricts them) — the same implementation the native transport uses, so playout no longer owns or exports a pan stage (`createTrackPanStage`/`panMatrix` existed only between #668 and #669, never published). Edges: `volumeNode.connect(stage.input)` (Tone → native works through `ToneAudioNode.connect`) and `connect(stage.output, muteGain)` with Tone's `connect()` helper (native → Tone). Verified in Chromium in both context modes (standardized and native): stage on `rawContext` vs the real `Tone.Panner` at five pans × mono/stereo, max RMS difference 0.002 = analyser noise; real `ToneTrack` with a left-only effect on a mono track stays left-only. `panMatrix()` holds the two Web Audio `StereoPannerNode` laws, chosen by the SOURCE channel count: mono = equal-power balance (L·cos θ, R·sin θ, θ = (pan+1)·π/4 — exactly the mono law for a dual-mono signal, and it never mixes channels, so a stereo effect stays stereo at the dry signal's centre level); stereo = the fold-over stereo law (centre unity). Verified against the real `Tone.Panner` in Chromium at five pan positions × mono/stereo × both context modes (max RMS difference 0.002 = measurement noise). The unit mocks can't see any of this — they accepted the `channelCountMode` assignment that throws on a real standardized context; only a real-Tone browser probe did. Don't reintroduce `Panner` in a track's signal path. **The law must follow clip edits, not just track creation:** `adapter.updateTrack` passes `trackChannelCount(track)` as the 4th argument of `TonePlayout.replaceTrackClips`, which calls `ToneTrack.setSourceChannelCount()` — without it a stereo clip recorded or dropped onto a mono track left the Tone adapter on the mono law while the native transport and both exports had moved to the stereo law (3 dB apart at centre; caught in review of #669, not by any test, because `replaceClips` keeps the track's graph). Measured on a real adapter in both context modes: centred mono clip 0.2501 → 0.3537 when a stereo clip joins, back to 0.2499 when it leaves — the native `TrackNode` values. **Test mocks:** `inputGain` is built as `new Gain({ gain: 1 })` and `muteGain` as `new Gain(0 | 1)` — `ToneTrack.test.ts`'s `Gain` mock tells them apart by argument shape; all three track test files stub core's `createPanStage` via `vi.mock('@waveform-playlist/core', importOriginal)` (the stage has its own `panStage.test.ts` in core) and give the `tone` mock a `connect(src, dst)` that calls `src.connect(dst)`. Only ONE `vi.mock` per module per file takes effect — `ToneTrack.test.ts` already mocked core for the fade appliers, and a second mock block for `createPanStage` was silently ignored (the real stage ran against the mock context); add to the existing factory.

**Key design:**

- `Transport.schedule(callback, absTime)` creates permanent timeline events that re-fire on every loop iteration
- Each callback creates a fresh `AudioBufferSourceNode` (one-shot), connects to the persistent per-clip `GainNode`, and starts it
- `activeSources: Set<AudioBufferSourceNode>` tracks live sources (own Set, not Player internals)
- Native sources don't respond to `Transport.pause()`/`Transport.stop()` — `stopAllSources()` must be called explicitly

**Mid-clip start:** When play starts mid-clip (e.g., offset 5s, clip runs 3s–8s), `Transport.schedule(cb, 3s)` won't fire (already passed). `startMidClipSources(5s, now)` detects spanning clips and creates sources with adjusted offset/duration. Uses strict `<` guard (`absClipStart < transportOffset`) to avoid double-creation with schedule callbacks at exact position.

**Loop handling:** Transport `loop` event fires BEFORE schedule callbacks (event ordering: `loopEnd` → ticks reset → `loopStart` → `loop` → `forEachAtTime`). Loop handler: `stopAllSources()` + `cancelFades()` + `startMidClipSources(loopStart)` + `prepareFades()`.

**Schedule guard offset (`_scheduleGuardOffset`):** Ghost ticks from stale `Clock._lastUpdate` can fire `Transport.schedule()` callbacks at past positions (second manifestation of #1419). After a loop iteration resets ticks to ~0, ghost ticks include near-0 values, causing `Transport.schedule(cb, 0)` to fire even when starting at offset 1.5s. This creates duplicate `AudioBufferSourceNode`s alongside those from `startMidClipSources()`. Fix: `_scheduleGuardOffset` on ToneTrack suppresses schedule callbacks for clips before the play/loop offset. Set before `transport.start()` and in the loop handler. Complementary with `startMidClipSources`' strict `<` guard — no gaps, no overlap.

**Native→Tone.js connection:** `fadeGainNode.connect(inputGain.input)` — a plain Tone `Gain`'s `.input` IS the native GainNode. An external effects chain returns into `(volumeNode.input as unknown as Gain).input`, the native GainNode backing Tone.js Volume's input Gain (double cast needed, see Type Gotchas below).

**Loop property ordering:** `_processTick` checks `ticks >= _loopEnd` every tick. `_loopEnd` defaults to `0`, so `transport.loop = true` before updating `loopEnd` causes immediate wrap. **Always:** set `loopStart`/`loopEnd` BEFORE `transport.loop = enabled`.

**Ghost tick loop wrap (root cause + fix):** After stop/start cycles, `Clock._lastUpdate` is stale (set by the previous context tick). `Clock._loop()` processes ticks from `[_lastUpdate, now()]`. In the gap `[_lastUpdate, startTime)`, the TickSource is still "started" from the PREVIOUS play cycle with its old tick offset — those accumulated ticks can exceed `_loopEnd`, causing `_processTick` to wrap immediately to loopStart. **Fix:** Advance `(transport as any)._clock._lastUpdate = startTime` after `transport.start()`. The next `Clock._loop()` only processes `[startTime, now()]` — ticks from the current play cycle with the correct offset. This eliminates the need for deferred loop enable via `setTimeout(0)`. See [Tone.js #1419](https://github.com/Tonejs/Tone.js/issues/1419).

**Tone.js source location (pnpm):** `node_modules/.pnpm/tone@15.1.22/node_modules/tone/build/esm/core/clock/` — Clock.js, TickSource.js, Transport.js. Note: `Clock` pre-binds `_processTick` in its constructor (`this._processTick.bind(this)`), so monkey-patching Transport.\_processTick at runtime has no effect.

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

**`Gain.input` is already `GainNode`** — Unlike `Volume.input`, plain `Gain.input` is typed as `GainNode` directly. No cast needed (e.g., `_masterTap.input` returns `GainNode`).

**`ContextOptions.latencyHint` is typed category-only** — Tone 15's runtime forwards numeric seconds to the native AudioContext constructor unchanged; cast `as AudioContextLatencyCategory` when passing a number.

## Global AudioContext Pattern

**Implementation:** Recording and playback use a global shared AudioContext (same as Tone.js).

**Location:** `getGlobalAudioContext()` from `src/audioContext.ts`

**Critical:** Context must be resumed on user interaction via `resumeGlobalAudioContext()`

**Rule:** Always use `getGlobalAudioContext()` — never `new AudioContext()`. Firefox blocks AudioContexts created before user gesture. The global context is shared with Tone.js and properly resumed via `Tone.start()` on first play. This applies to SoundFont loading, recording, monitoring, and any feature needing audio processing.

**SoundFontCache uses OfflineAudioContext by default:** The `context` constructor arg is optional. When omitted, `SoundFontCache` creates an `OfflineAudioContext(1, 1, 44100)` — sufficient for `createBuffer()` and doesn't trigger Firefox's autoplay block. Only pass a real AudioContext if you need the buffers connected to live audio output (which SoundFontCache doesn't). `SoundFontCache.fromUrl(url, { context?, signal? })` is the preferred construction path — it resolves only after fetch+parse, so an unloaded cache can't reach `createToneAdapter`/`setSoundFontCache`.

## Tone.js Initialization

**Critical:** Call `await Tone.start()` after user interaction and before `Tone.now()`.

Without `Tone.start()`, `Tone.now()` returns null → RangeError in scheduling.

**Safari Latency:** `TonePlayout.init()` already calls `await start()`. Do NOT call `await toneStart()` separately in play handlers — the redundant await adds ~2 seconds of latency on Safari.

**Master volume:** Uses Web Audio standard 0-1.0 range (not 0-100).

## Native AudioParam Behind a Tone `Gain` (no `_param`)

**Pattern:** to apply a value with `setValueAtTime` even while the AudioContext is suspended (the Tone.js Signal wrapper doesn't propagate until the context resumes — Tone.js #1418), write the native param through PUBLIC API: `gain.input.gain`. A Tone `Gain`'s `input` is its native `GainNode`, so `gain.input.gain` is the same object as the private `gain.gain._param` (verified in a browser on Tone 15.1.22 and 15.5.66, both context modes).

**Used in:** `setMute()` in `ToneTrack`, `MidiToneTrack` and `SoundFontToneTrack` (mute must take effect immediately, e.g. solo muting before the first play), and the clip fade gain in browser's `useExportWav`. Follow the native write with `gain.gain.value = v` so Tone's own Param state agrees.

**History:** these four sites used `getUnderlyingAudioParam(signal)` (`fades.ts`), which reads the private `_param`. Nothing calls it any more (#671); it stays exported, marked `@deprecated`. Don't add new callers — a `Signal` that is not a `Gain`'s param is the only case with no public route.

## SoundFont Playback (SoundFontToneTrack)

**Location:** `src/SoundFontToneTrack.ts`, `src/SoundFontCache.ts`

**Architecture:** Opt-in replacement for `MidiToneTrack`. When `soundFontCache` is provided to `TonePlayoutAdapter`, MIDI clips route to `SoundFontToneTrack` instead of `MidiToneTrack`. Falls back to PolySynth when no SoundFont loaded.

**Late load / swap (`ToneAdapter.setSoundFontCache`):** `createToneAdapter` returns `ToneAdapter` (extends engine `PlayoutAdapter`) with `setSoundFontCache(cache | undefined)`. The adapter snapshots its tracks (`_currentTracks`, kept fresh by the volume/mute/solo/pan setters via immutable copies) and records what each MIDI track was built with (`_midiTrackBuild: Map<trackId, SoundFontCache | null>`). A swap rebuilds only MIDI tracks whose _effective_ routing (`cache?.isLoaded ? cache : null`) differs from their build record — the guard compares against what each track was built with, not against the previous `setSoundFontCache` argument, because the same cache object flips `isLoaded` after a late `load()`. Per-track try/catch isolates Tone.js graph failures (warn + continue); calling with an unloaded cache warns and leaves routing unchanged. Audio tracks are untouched; `resumeTrackMidPlayback` handles swap-during-playback. `isToneAdapter(adapter)` (exported from playout) is the capability guard for narrowing a generic `PlayoutAdapter` before calling `setSoundFontCache` — structural check, still exported for external callers. Browser's `soundFontSync.ts` now uses its own local `supportsSoundFont` structural check (to keep the core barrel engine-free; avoids importing from playout).

**Audio graph per note:**

```
AudioBufferSourceNode (native, one-shot, pitch-shifted via playbackRate)
  → GainNode (native, per-note ADSR volume envelope)
  → inputGain (Tone.js, shared per-track) → [effects, pre-fader]
  → Volume → pan stage (core `createPanStage`) → muteGain → destination
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

**Web Audio Automation Ordering:** `setValueAtTime` at note-off correctly cancels incomplete `linearRampToValueAtTime` ramps — do NOT use `Math.max(noteOff, envEnd)` to "fix" ordering. That extends every note to the full AHD phase length, breaking instruments with long decay (piano, strings). **Envelopes are TRUNCATED at note-off (fix for the confirmed staccato click, 2026-07-09):** scheduling the full AHD and stepping to sustain at note-off held the gain at PEAK for the whole staccato note (the decay ramp's endpoint sorts after note-off and never governs), then stepped peak→sustain in one sample (0.576 measured — audible click; Chromium gain-curve capture). Since note duration is known at schedule time, `triggerNote` now emits only the envelope that actually plays: each phase clipped to note-off, ending with a partial ramp to `envelopeValueAt(noteOff)` (exported for tests; the partial ramp lies on the same decay line, so notes that outlive the decay schedule identically to before). Cross-browser — no `cancelAndHoldAtTime` needed. Verified: max sample step 0.000026 across staccato/long/mid-attack/hold cases.

**stopAllSources Pattern:** Only call `source.stop()`, never `source.disconnect()` before `stop()`. If `disconnect()` throws in a shared try-catch, `stop()` is skipped — leaving live sources running. The `onended` callback handles gainNode cleanup.

**Dependency:** `soundfont2` (MIT) in `package.json`. SF2 files have separate licenses — not bundled in npm package, users provide via URL.

## Incremental Track Updates

**`addTrackToPlayout()` helper:** Extracted from `buildPlayout`'s per-track loop. Shared by `buildPlayout`, `adapter.addTrack()`, and `adapter.updateTrack()`. Handles audio clips, MIDI clips, and SoundFont routing.

**`adapter.addTrack(track)`:** Adds a single track to the existing playout. Playout is created eagerly, so `addTrack` works before `setTracks()`. Warns and returns if called after `dispose()`.

**`adapter.updateTrack(trackId, track)`:** For audio tracks, uses `ToneTrack.replaceClips()` which diffs clips and only reschedules changed ones. A MIDI track (`kind: 'midi'`) is always removed and re-added.

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

`new Panner(pan)` defaults to `channelCount: 1` + `channelCountMode: "explicit"` — a forced stereo→mono downmix at 1/√2 before panning. Track signal paths no longer use `Panner` at all (see "Pan stage" above); `ToneTrackOptions.channelCount` (callers pass `trackChannelCount(track)` from core) now selects the pan LAW in core's `createPanStage`. MidiToneTrack/SoundFontToneTrack pass 1 (mono voices). The gotcha still applies to any `Panner` you create yourself, e.g. as an effect.

## Native AudioContext for sampleRate Control

**`configureGlobalContext({ nativeAudioContext: true })`** creates the global context around a native `AudioContext` — required for WAM 2.0 plugin hosting (WAM worklets subclass the native `AudioWorkletNode` and cannot join a standardized-audio-context graph). In native mode, `sampleRate` IS honored (passed to the native constructor).

**Fallback on Firefox:** The earlier revert's root cause was Firefox's missing AudioListener AudioParams (`positionX`/`Y`/`Z` etc.) — Tone's `Listener` wraps them eagerly at `context.initialize()` and throws "param must be an AudioParam" when they're undefined (Tone.js #681). `supportsNativeContextMode()` feature-detects exactly this and falls back to the standardized-audio-context default with a `[playout]` warning; `isNativeGlobalContext()` reports the live mode.

**Default path (no option):** standardized-audio-context. `sampleRate` (and `latencyHint`) are passed to `new Context({...})`; Tone 15.1.22 drops `sampleRate` there (context runs at the hardware rate, mismatch warning), Tone 15.5.x honours it (measured: request 44100 on 48000 hardware → 48000 + warning on 15.1.22, 44100 and no warning on 15.5.66). 15.1.22's `ContextOptions` type has no `sampleRate`, so the options object is typed loosely — it must compile against both lines. With pre-computed peaks, sample-rate mismatches warn and fall back to worker-generated peaks.

## Context Singleton Warning

**`getGlobalContext()` replaces Tone's default context.** Any Tone.js node created via `getContext()` BEFORE `getGlobalContext()` first runs will be on a different (orphaned) audio graph. This affects hooks that run on mount (useEffect with `[]` deps) — they may capture the default context before audio init. Always import and use `getGlobalContext()` for nodes that must be in the playback signal path.

## Two Tone.js lines (#671)

npm `latest` is 15.1.22 (April 2025); `next` is the 15.5.x prerelease line (15.5.66 when this was written). Both satisfy the `tone ^15.0.0` peer range. Stable is the default (lockfile, website, examples); `next` is supported and tested — a deliberate exception to the "latest stable only" upgrade rule, because Tone's stable line is effectively frozen.

**CI:** the `tone-next` job in `.github/workflows/ci.yml` overrides `tone` to the `next` dist-tag (`pnpm.overrides`), then builds (type-checks every package against its types) and runs the unit tests. Almost every playout test mocks `tone`, so the job's real runtime signal is `src/__tests__/toneInternals.test.ts`: it reads the INSTALLED build's source and asserts the private fields below still exist. `next` is a moving tag — a red `tone-next` job on an unrelated PR means upstream changed something; read the diff before touching the test.

**To test a Tone line locally:** add `"tone": "next"` to `pnpm.overrides` in the root `package.json`, `pnpm install --no-frozen-lockfile`, `pnpm build`, then tests/e2e/probes; undo with `git checkout package.json pnpm-lock.yaml && pnpm install --frozen-lockfile`. Check `readlink packages/playout/node_modules/tone` to see which build is linked, and restart any Vite example server with `--force` (the dep cache keeps the old build).

**Private internals, checked against the 15.5.66 source and in a browser:**

| Internal                                                     | Used for                                                                              | On 15.5.66                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `transport._clock._lastUpdate`                               | `TonePlayout.play()` advances it past the stop/start gap (ghost ticks, Tone.js #1419) | Still a plain number field and `_loop()` still starts from it — KEEP. Upstream added its own flush in `Clock.start()`, but only for a start time already in the past (`_lastUpdate < time <= now()`); a start scheduled ahead of `now()` does not take that path. In `debug/tonejs/transport-loop-wrap-1419.html` (one run per build, headless) 15.1.22 shows the stale ticks after a restart (26, 27, then back to 19) and 15.5.66 does not (19 upward) — so the workaround may be unnecessary on 15.5.x, but it must stay while 15.1.x is supported, and it is the ONE private field playout still writes. |
| `signal._param`                                              | (was) mute and fade automation on a suspended context (Tone.js #1418)                 | NO LONGER USED on either line: mute and export fades write `gain.input.gain`, the native AudioParam behind a Tone `Gain` via public API (`g.gain._param === g.input.gain` verified in a browser on both lines, both context modes). `getUnderlyingAudioParam` stays exported but deprecated.                                                                                                                                                                                                                                                                                                                 |
| `Gain.input`, `Volume.input.input`                           | native → Tone connections (clip sources, effects return)                              | `Gain.js` and `Volume.js` are byte-identical to 15.1.22.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| `Listener` wrapping `rawContext.listener.positionX…` eagerly | why `supportsNativeContextMode()` falls back on Firefox (Tone.js #681)                | Still eager (class renamed `ListenerInstance`) — KEEP the feature detection.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |

Measured on 15.5.66 in Chromium, both context modes: the pre-fader probes (fader ratio through a compressor 0.250 live and offline, mono pass-through level 1.000, left-only effect stays left-only), and the Playwright suite. Not checked: Firefox and Safari (only Chromium is installed for Playwright on the dev machine).

`standardized-audio-context` is the same dependency range on both lines, so the locked `StereoPannerNode` channel mode (why tracks use a gain-matrix pan stage) is the same on both.
