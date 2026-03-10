# Worklets Package (`@waveform-playlist/worklets`)

## TypeScript Configuration

**Decision:** Worklet source files (`src/worklet/*.worklet.ts`) and tests (`src/__tests__/*`) are excluded from `tsconfig.json`.

**Why:** Worklet files declare AudioWorklet-scope globals (`sampleRate`, `AudioWorkletProcessor`, `registerProcessor`) that conflict with `lib: ["DOM"]`. They run in a separate JS scope — tsup bundles them as inline strings via `?url` imports.

**Tests:** Use `vi.stubGlobal()` to mock AudioWorklet globals. Typed via `MockProcessor` interface — avoid raw `any`.

## Exports

- `recordingProcessorUrl` — inline Blob URL for recording-processor worklet
- `meterProcessorUrl` — inline Blob URL for meter-processor worklet
- `MeterMessage` — `{ peak: number[]; rms: number[] }` interface for worklet→main thread messages
