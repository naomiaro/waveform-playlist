# Worklet-Based Metering Design

## Problem

The current metering hooks (`useMicrophoneLevel`, `useOutputMeter`) use Tone.js `Analyser` with `getFloatTimeDomainData()` polled via `requestAnimationFrame`. This captures a snapshot of ~2048 samples per frame — any peak that occurs between frames is lost. For a recording-focused library, users need guaranteed sample-accurate peak detection to know if they clipped.

## Decision: AudioWorklet Metering

Move peak and RMS computation into an AudioWorklet processor that sees every sample. The worklet accumulates the maximum peak and RMS across all 128-sample quantums, then posts results to the main thread at ~60Hz via `postMessage`.

## Architecture

### New Package: `@waveform-playlist/worklets`

A new package at `packages/worklets/` consolidating all AudioWorklet processors:

- `meter-processor.worklet.ts` — peak/RMS metering (new)
- `recording-processor.worklet.ts` — audio recording (moved from `packages/recording/src/worklet/`)

Exports worklet URLs:

```typescript
export const meterProcessorUrl: string;
export const recordingProcessorUrl: string;
```

URLs resolve via `new URL('./worklet/meter-processor.worklet.js', import.meta.url)`. tsup builds each worklet as a separate entry.

**Why a separate package:**
- Both `recording` and `browser` need the meter worklet — avoids circular deps
- `core` is pure utilities/types with no Web Audio — worklets don't belong there
- Consolidates worklet build complexity (separate tsup entries, `import.meta.url` resolution) in one place
- Moving the recording worklet out lets `recording` be aliased to source in Docusaurus (no more `dist/` requirement)

### Meter Processor Worklet

Pass-through AudioWorklet processor. Audio flows through unchanged while levels are computed.

**Options received via `processorOptions`:**

```typescript
interface MeterProcessorOptions {
  numberOfChannels: number;
  updateRate: number; // target Hz, default 60
}
```

**Process loop (every 128-sample quantum):**

1. For each channel, iterate all 128 samples:
   - `maxPeak[ch] = Math.max(maxPeak[ch], Math.abs(sample))`
   - `sumSquares[ch] += sample * sample`, `sampleCount[ch]++`
2. Copy input to output (pass-through)
3. Increment block counter
4. When `blocksProcessed >= blocksPerUpdate`:
   - Post `{ peak: number[], rms: number[] }` per channel
   - RMS = `Math.sqrt(sumSquares[ch] / sampleCount[ch])`
   - Reset accumulators and block counter

`blocksPerUpdate` calculated as `Math.floor(sampleRate / (128 * updateRate))`.

**Message posted to main thread:**

```typescript
{ peak: number[], rms: number[] }
```

### RMS Strategy: Simple Interval Average

RMS is computed as the simple average over the update interval (~16ms at 60Hz). This differs from openDAW's sliding window approach (100ms circular buffer per channel).

**Tradeoff:** A sliding window RMS provides smoother, more perceptually accurate loudness display because it averages over a longer period. Our interval-based approach may appear jumpier since each update only reflects ~16ms of audio. However, for visual metering at 60fps the difference is subtle — the eye integrates rapid changes naturally. If smoother RMS is needed later, a circular buffer can be added to the worklet without changing the message format or hook API.

### Communication: postMessage

Uses `postMessage` (not SharedArrayBuffer) for worklet-to-main-thread communication.

**Why not SharedArrayBuffer:**
- Requires `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` HTTP headers
- Many hosting setups don't configure these headers
- Breaks third-party iframes/embeds that aren't cross-origin isolated
- For a library others embed, this would be a surprising constraint

**Why postMessage is fine:**
- Metering data is tiny (a few floats per channel per message)
- Copy cost is negligible at ~60 messages/sec
- Universally supported, no server configuration needed

### Hook Changes

**`useMicrophoneLevel` (recording package):**
- Remove Tone.js `Analyser` creation
- Create raw `AudioWorkletNode` using `meterProcessorUrl` from `@waveform-playlist/worklets`
- Call `audioContext.audioWorklet.addModule(meterProcessorUrl)` on setup
- Listen for `port.onmessage` to receive `{ peak, rms }` per channel
- Apply smoothed peak decay and mono-to-stereo mirroring in the message handler
- Remove `requestAnimationFrame` loop — updates driven by worklet messages
- Return shape unchanged: `levels`, `peakLevels`, `rmsLevels`, `level`, `peakLevel`, `resetPeak`

**`useOutputMeter` (browser package):**
- Same pattern: raw `AudioWorkletNode` instead of Tone.js `Analyser`
- Insert as pass-through: `destination.chain(meterWorkletNode)`
- Listen on `port.onmessage`

### Recording Worklet Migration

- Move `recording-processor.worklet.ts` to `packages/worklets/src/worklet/`
- `packages/recording` imports `recordingProcessorUrl` from `@waveform-playlist/worklets`
- Remove worklet tsup build entry from recording package
- Docusaurus can alias `@waveform-playlist/recording` to source

### Testing

**Meter processor tests** (`packages/worklets/src/__tests__/`):
- Peak accuracy with known samples
- RMS calculation against manual computation
- Multi-channel independent accumulation
- Throttling: message posted only after N blocks
- Pass-through: output equals input

**Hook tests** stay in their respective packages:
- Mock `AudioWorkletNode` and `audioContext.audioWorklet.addModule`
- Verify peak decay, mono mirroring, resetPeak behavior
- Update existing tests for worklet-based approach

No E2E changes — hook return shapes are unchanged.
