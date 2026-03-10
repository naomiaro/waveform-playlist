# Recording Package (`@waveform-playlist/recording`)

## Architecture

Recording uses the global shared AudioContext from `@waveform-playlist/playout` (same as Tone.js).

**Critical:** Context must be resumed on user interaction via `resumeGlobalAudioContext()`

## MediaStreamSource Per Hook (Firefox Compatibility)

**Pattern:** Each recording hook creates its own `MediaStreamSource` directly from Tone's `getContext()`.

```typescript
// CORRECT - Create source from same context as other audio nodes
const context = getContext();  // Tone.js shared context
const source = context.createMediaStreamSource(stream);
const meter = new Meter({ smoothing, context });
connect(source, meter);
```

**Why:** Firefox throws "Can't connect nodes from different AudioContexts" when:
- A shared `MediaStreamSource` is created in one module (e.g., playout package)
- Audio nodes (Meter, AudioWorklet) are created in another module (recording package)
- Even though both use `getContext()` from Tone.js, bundler module resolution can cause different context instances

**Solution:** Both `useRecording` and `useMicrophoneLevel` create their own source directly from `getContext()`. This ensures the source and connected nodes share the exact same context instance.

**Note:** Creating multiple `MediaStreamAudioSourceNode` instances from the same `MediaStream` is valid - they independently read from the same underlying stream.

## Debugging AudioWorklets

**Critical Note:** `console.log()` in AudioWorklet **DOES NOT** appear in browser console!

**Solutions:**
1. Send debug data via `postMessage()` to main thread
2. Update React state/UI to display values
3. Use live waveform visualization

## Tone.js addAudioWorkletModule — Single Module Gotcha

**Critical:** `context.addAudioWorkletModule(url)` only loads the **first** URL. Tone.js caches a single `_workletPromise` — all subsequent calls with different URLs silently return the cached promise and skip `addModule`. If `meter-processor` loads first, `recording-processor` is never registered, causing `NotSupportedError` on `createAudioWorkletNode`.

**Fix:** Always use `rawContext.audioWorklet.addModule(url)` directly. The native API supports multiple `addModule` calls. `createAudioWorkletNode` (Tone's wrapper) is still safe to use for node creation.

```typescript
// WRONG — second call silently skipped
await context.addAudioWorkletModule(meterProcessorUrl);     // loads
await context.addAudioWorkletModule(recordingProcessorUrl);  // silently skipped!

// CORRECT — both modules loaded
const rawCtx = (context as any).rawContext as AudioContext;
await rawCtx.audioWorklet.addModule(meterProcessorUrl);
await rawCtx.audioWorklet.addModule(recordingProcessorUrl);
```

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

## Peak Value Clamping

**Rule:** Always clamp scaled peak values to the valid typed array range before assignment. `Math.floor(1.0 * 32768) = 32768` overflows Int16 (max 32767) and wraps to -32768. Use `Math.min(maxValue - 1, ...)` for max and `Math.max(-maxValue, ...)` for min.
