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

**See:** `DEBUGGING.md` in repo root for complete worklet debugging guide.

## Recording-Optimized Audio Constraints

**Defaults in `useMicrophoneAccess`:** `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`, `latency: 0`

Users can override via `audioConstraints` parameter.

## VU Meter Level Normalization

**Implementation:** `useMicrophoneLevel` uses Tone.js `Meter` which returns dB values.

**dB to 0-1 Conversion:**
```typescript
// Meter returns -Infinity to 0 dB
// Map -100dB..0dB to 0..1 (using -100dB floor for Firefox compatibility)
const normalized = Math.max(0, Math.min(1, (dbValue + 100) / 100));
```

**Why -100dB floor:** Firefox reports lower dB values than Chrome (e.g., -70 to -85 dB for quiet input). Using -60dB floor caused all quiet signals to map to 0.

## AudioWorklet Buffer Boundary Handling

**Critical:** The AudioWorklet quantum is always 128 samples. Buffer sizes derived from `sampleRate * duration` (e.g., 705 at 44100Hz) may not be multiples of 128. The `process()` method must loop to handle frames that cross the buffer boundary — writing beyond a typed array's length silently drops samples.

## Multi-Channel Recording Pipeline

**Data flow:** Worklet sends `channels: Float32Array[]` → `useRecording` accumulates per-channel chunks in `recordedChunksRef[ch][]` → per-channel peaks in `(Int8Array | Int16Array)[]` → `useIntegratedRecording` passes through as `recordingPeaks` → `PlaylistVisualization` renders one `ChannelWithProgress` per channel.

**Stream channel auto-detection:** `useRecording.startRecording()` reads `stream.getAudioTracks()[0].getSettings().channelCount` to match the mic's actual capability. The `channelCount` option is a fallback, not the primary source. Logs a warning when falling back.

**State reset ordering:** In `startRecording`, reset `recordedChunksRef` and `totalSamplesRef` BEFORE calling `source.connect(workletNode)` and posting the `start` command. This prevents a race where a worklet message arrives before refs are cleared.

## Peak Value Clamping

**Rule:** Always clamp scaled peak values to the valid typed array range before assignment. `Math.floor(1.0 * 32768) = 32768` overflows Int16 (max 32767) and wraps to -32768. Use `Math.min(maxValue - 1, ...)` for max and `Math.max(-maxValue, ...)` for min.
