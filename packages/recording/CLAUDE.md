# Recording Package (`@waveform-playlist/recording`)

## Architecture

Recording uses the global shared AudioContext from `@waveform-playlist/playout` (same as Tone.js).

**Critical:** Context must be resumed on user interaction via `resumeGlobalAudioContext()`

## MediaStreamSource Per Hook (Firefox Compatibility)

**Pattern:** Each recording hook creates its own `MediaStreamSource` from the global shared context and connects it to an AudioWorklet node (not Tone.js `Meter`).

```typescript
const context = getGlobalContext();  // shared Tone.js context from playout
const source = context.createMediaStreamSource(stream);
source.connect(workletNode);  // AudioWorklet-based metering/recording
```

**Why:** Firefox throws "Can't connect nodes from different AudioContexts" when source and destination nodes are created from different context instances. Both `useRecording` and `useMicrophoneLevel` create their own source from `getGlobalContext()` to ensure the source and connected worklet share the exact same context.

**Note:** Creating multiple `MediaStreamAudioSourceNode` instances from the same `MediaStream` is valid — they independently read from the same underlying stream.

## Debugging AudioWorklets

**Critical Note:** `console.log()` in AudioWorklet **DOES NOT** appear in browser console!

**Solutions:**
1. Send debug data via `postMessage()` to main thread
2. Update React state/UI to display values
3. Use live waveform visualization

## AudioWorklet Module Loading

**Rule:** Always use `rawContext.audioWorklet.addModule(url)` — never Tone.js's `context.addAudioWorkletModule(url)`.

**Why:** Tone.js caches a single `_workletPromise` per context. Only the first URL is loaded; subsequent calls with different URLs silently return the cached promise. If `meter-processor` loads first, `recording-processor` is never registered.

```typescript
// CORRECT — both modules loaded via native API
const rawCtx = context.rawContext as AudioContext;
await rawCtx.audioWorklet.addModule(meterProcessorUrl);
await rawCtx.audioWorklet.addModule(recordingProcessorUrl);
```

`context.createAudioWorkletNode()` (Tone.js wrapper) is still used for node creation — avoids `rawContext` identity issues in webpack-aliased environments (Docusaurus).

## Recording-Optimized Audio Constraints

**Defaults in `useMicrophoneAccess`:** `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`, `latency: 0`

Users can override via `audioConstraints` parameter.

## VU Meter Level Monitoring

**Implementation:** `useMicrophoneLevel` uses the `meter-processor` AudioWorklet from `@waveform-playlist/worklets` for sample-accurate peak and RMS measurement. Every audio sample is measured — no transient is missed between animation frames.

**dB to 0-1 Conversion:**
```typescript
// Worklet posts raw gain values (0-1+)
// Hook converts via: gain → dB (20*log10) → normalized (dBToNormalized)
const normalized = gainToNormalized(rawPeak);
```

**Worklet location:** All AudioWorklet processors now live in `@waveform-playlist/worklets`. The recording package imports `recordingProcessorUrl` and `meterProcessorUrl` from there.

## AudioWorklet Buffer Boundary Handling

**Critical:** The AudioWorklet quantum is always 128 samples. Buffer sizes derived from `sampleRate * duration` (e.g., 705 at 44100Hz) may not be multiples of 128. The `process()` method must loop to handle frames that cross the buffer boundary — writing beyond a typed array's length silently drops samples.

## Multi-Channel Recording Pipeline

**Data flow:** Worklet sends `channels: Float32Array[]` → `useRecording` accumulates per-channel chunks in `recordedChunksRef[ch][]` → per-channel peaks in `(Int8Array | Int16Array)[]` → `useIntegratedRecording` passes through as `recordingPeaks` → `PlaylistVisualization` renders one `ChannelWithProgress` per channel.

**Stream channel auto-detection:** `useRecording.startRecording()` reads `stream.getAudioTracks()[0].getSettings().channelCount` to match the mic's actual capability. The `channelCount` option is a fallback, not the primary source. Logs a warning when falling back.

**State reset ordering:** In `startRecording`, reset `recordedChunksRef` and `totalSamplesRef` BEFORE calling `source.connect(workletNode)` and posting the `start` command. This prevents a race where a worklet message arrives before refs are cleared.

## Mic Channel Auto-Detection

**Rule:** `useMicrophoneLevel` auto-detects actual mic channel count from `stream.getAudioTracks()[0].getSettings().channelCount`. Do not hardcode `channelCount` when a stream is available — a mono mic with `channelCount: 2` creates a 2-channel Meter where only one channel receives signal.

## MediaStreamAudioSourceNode.channelCount Is Misleading

**Rule:** Never use `source.channelCount` to detect mic channels — it defaults to 2 per Web Audio spec, regardless of the mic's actual capability. Use `stream.getAudioTracks()[0].getSettings().channelCount` instead.

## Shared Duration Loop (useRecording)

**Pattern:** `startDurationLoop` is a stable `useCallback([], [])` that runs a rAF loop reading from refs (`isRecordingRef`, `isPausedRef`, `startTimeRef`). Called by both `startRecording` (fresh start) and `resumeRecording` (adjusts `startTimeRef` before calling). Callers set `startTimeRef.current` before invoking.

## No UI Component Exports

**Decision:** Recording package exports only hooks and types — no presentational components. `RecordButton`, `RecordingIndicator`, `MicrophoneSelector` are example-specific UI in `website/src/components/examples/RecordingControls.tsx`. `VUMeter` is replaced by `SegmentedVUMeter` from `@waveform-playlist/ui-components`.

## Peak Value Clamping

**Rule:** Always clamp scaled peak values to the valid typed array range before assignment. `Math.floor(1.0 * 32768) = 32768` overflows Int16 (max 32767) and wraps to -32768. Use `Math.min(maxValue - 1, ...)` for max and `Math.max(-maxValue, ...)` for min.

## Overdub Recording & Latency Compensation

**Pattern:** `useIntegratedRecording` captures timeline position at record start (not stop) via `recordingStartTimeRef`. During overdub, `currentTime` advances with playback — using it at stop time would place the clip at the wrong position.

**Latency compensation:** Two sources of delay between worklet capture and audible playback:
1. `getGlobalContext().lookAhead` (~100ms) — Tone.js Transport schedules audio ahead of real time
2. `getGlobalAudioContext().outputLatency` — hardware DAC delay before audio reaches speakers

The clip's `offsetSamples` skips this combined latency period. `durationSamples` is reduced by the same amount. This aligns the user's performance (timed to what they hear) with the timeline.

**Overdub flow (in RecordingExample):** `startRecordingWithPlayback()` starts recording first, then calls `play(currentTime)`. Stop button stops playback, which auto-triggers recording stop via `wasPlayingRef` effect. Record button is start-only (not a toggle).

## Multi-Instance Worklet Registration Gap

**Known issue:** `workletLoadedRef` in `useRecording` and `useMicrophoneLevel` is per-component-instance (`useRef`). Multiple instances would each try `addModule()` → `registerProcessor()` throws on the already-registered name. Fix when multi-mic is needed: promote to module-level variable or `Map<AudioContext, boolean>`.

## Peak Reset on Device Switch

**Pattern:** `useIntegratedRecording.changeDevice()` calls `resetPeak()` from `useMicrophoneLevel` before requesting the new device. This clears held peak indicators so the VU meter doesn't show stale peaks from the previous microphone.

## Device Hot-Plug Detection

**Pattern:** `useMicrophoneAccess` listens for `navigator.mediaDevices.devicechange` to re-enumerate devices on plug/unplug. `useIntegratedRecording` auto-falls back to the first available device if the selected device disappears from the list.
