# Worklets Package (`@waveform-playlist/worklets`)

## TypeScript Configuration

**Decision:** Worklet source files (`src/worklet/*.worklet.ts`) and tests (`src/__tests__/*`) are excluded from the main `tsconfig.json`. Worklet files are type-checked separately via `tsconfig.worklet.json` using `@types/audioworklet`.

**Why:** Worklet files run in the AudioWorklet scope which has different globals (`sampleRate`, `AudioWorkletProcessor`, `registerProcessor`) that conflict with `lib: ["DOM"]`. The separate tsconfig uses `"lib": ["ES2020"]` and `"types": ["audioworklet"]` to provide the correct types without DOM conflicts.

**Type-check worklets:** `npx tsc --project tsconfig.worklet.json --noEmit`

**Tests:** Use `vi.stubGlobal()` to mock AudioWorklet globals. Typed via `MockProcessor` interface — avoid raw `any`.

## Exports

- `recordingProcessorUrl` — inline Blob URL for recording-processor worklet
- `meterProcessorUrl` — inline Blob URL for meter-processor worklet
- `MeterMessage` — `{ peak: number[]; rms: number[] }` interface for worklet→main thread messages

## Recording Processor Start Message

- **Do NOT send `sampleRate` in the `start` message** — The processor uses the AudioWorklet global `sampleRate` (always correct for the context). Passing it in the message was a source of bugs when callers passed a different rate than the AudioContext's actual rate.
- **Required fields:** `{ command: 'start', channelCount }` — channelCount configures per-channel buffers.
