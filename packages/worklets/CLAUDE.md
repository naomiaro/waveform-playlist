# Worklets Package (`@waveform-playlist/worklets`)

## TypeScript Configuration

**Decision:** Worklet source files (`src/worklet/*.worklet.ts`) and tests (`src/__tests__/*`) are excluded from the main `tsconfig.json`. Worklet files are type-checked separately via `tsconfig.worklet.json` using `@types/audioworklet`.

**Why:** Worklet files run in the AudioWorklet scope which has different globals (`sampleRate`, `AudioWorkletProcessor`, `registerProcessor`) that conflict with `lib: ["DOM"]`. The separate tsconfig uses `"lib": ["ES2020"]` and `"types": ["audioworklet"]` to provide the correct types without DOM conflicts.

**Type-check worklets:** `npx tsc --project tsconfig.worklet.json --noEmit`

**Tests:** Use `vi.stubGlobal()` to mock AudioWorklet globals. Typed via `MockProcessor` interface — avoid raw `any`.

## Exports

- `recordingProcessorUrl` — inline Blob URL for recording-processor worklet
- `meterProcessorUrl` — inline Blob URL for meter-processor worklet
- `addRecordingWorkletModule(addModuleFn)` — register recording-processor via callback injection (preferred)
- `addMeterWorkletModule(addModuleFn)` — register meter-processor via callback injection (preferred)
- `MeterMessage` — `{ peak: number[]; rms: number[] }` interface for worklet→main thread messages

## Cross-Context Worklet Loading (limiter-audio-worklet Pattern)

`addRecordingWorkletModule(addModuleFn)` and `addMeterWorkletModule(addModuleFn)` accept a callback `(url: string) => Promise<void>` so the caller provides the appropriate `addModule` for their context type. This works with both native `AudioContext` and standardized-audio-context (Tone.js). Follows the SAC (standardized-audio-context) callback injection pattern. Prefer these over importing `recordingProcessorUrl`/`meterProcessorUrl` directly.

## Recording Processor Start Message

- **Do NOT send `sampleRate` in the `start` message** — The processor uses the AudioWorklet global `sampleRate` (always correct for the context). Passing it in the message was a source of bugs when callers passed a different rate than the AudioContext's actual rate.
- **Required fields:** `{ command: 'start', channelCount }` — channelCount configures per-channel buffers.

## Recording Processor Transferable Buffers

- `flushBuffers()` posts `Float32Array.subarray(0, samplesCollected)` views with their underlying `ArrayBuffer`s in the transfer list. After transfer, `this.buffers[i]` is detached → non-final flushes reallocate replacements. Saves slice() + structuredClone memcpy on both threads.
- `flushBuffers(final = true)` skips reallocation — recording is over.

## Recording Processor Stop Handshake

- `stop` command **always** sends a terminal `done: true` message (even with empty buffer). Main thread must `await` it before reading accumulated chunks — `port.postMessage` is async, so a synchronous read after sending `stop` misses the final partial buffer (~16ms loss per recording).
- Pattern: `await Promise.race([stopAck, setTimeout(250)])` so a closed/crashed context can't hang the caller.
- After the final flush, drop `this.buffers = []` and zero `this.bufferSize = 0`. Without this, a stray `resume` after `stop` would set `isRecording = true` and `process()` would silently no-op writes into detached typed-array memory.

## IDE-Friendly Worklet Types via Nested tsconfig

- `src/worklet/tsconfig.json` (extends `../../tsconfig.worklet.json`) gives VS Code the right compiler options for files in this directory. The IDE's TypeScript service uses a closest-tsconfig.json algorithm and doesn't auto-discover `tsconfig.worklet.json` (non-default name) — without the nested file, the IDE falls back to the package's main config (lib: DOM, no `audioworklet` types) and shows spurious "port does not exist" / "Cannot find name registerProcessor" errors. After tsconfig changes, `Cmd+Shift+P → "TypeScript: Restart TS Server"` to clear the IDE's cached project graph.

## Float32Array.buffer Cast for Transfer List

- TS 5.7+ types `Float32Array.buffer` as `ArrayBufferLike` (= `ArrayBuffer | SharedArrayBuffer`), so pushing it into `ArrayBuffer[]` for the postMessage transfer list fails strict checking. AudioWorklet inputs are always ArrayBuffer-backed (SharedArrayBuffer needs cross-origin-isolation that the standard `source.connect()` flow doesn't trigger), so cast at the source: `transfer.push(buf.buffer as ArrayBuffer)`. The cast asserts a real runtime invariant — don't "fix" it with an `instanceof SharedArrayBuffer` branch.
