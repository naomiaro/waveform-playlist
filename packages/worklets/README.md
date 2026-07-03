# @waveform-playlist/worklets

AudioWorklet processors for waveform-playlist — metering (VU) and recording capture.

Used by `@waveform-playlist/recording`, `@waveform-playlist/browser` (output metering), and the dawcore recording controller.

## Features

- **Recording processor** — captures microphone/input audio in the audio rendering thread, with transferable-buffer flushes for low-overhead delivery to the main thread
- **Metering processor** — computes peak/RMS levels per channel for VU meters
- **Context-agnostic loading** — a callback-injection loader works with a native `AudioContext` or a Tone.js (standardized-audio-context) context, so you decide how `addModule` is called

## Installation

```bash
npm install @waveform-playlist/worklets
```

## Usage

Register the worklet module on your `AudioContext` before creating the corresponding `AudioWorkletNode`. Pass in your own `addModule` call — this works whether the context is a native `AudioContext` or a Tone.js context:

```typescript
import { addRecordingWorkletModule } from '@waveform-playlist/worklets';

// Native AudioContext
const ctx = new AudioContext();
await addRecordingWorkletModule((url) => ctx.audioWorklet.addModule(url));

// Tone.js context (standardized-audio-context)
const rawCtx = context.rawContext;
await addRecordingWorkletModule((url) => rawCtx.audioWorklet.addModule(url));

const recorderNode = new AudioWorkletNode(ctx, 'recording-processor');
```

Metering follows the same pattern:

```typescript
import { addMeterWorkletModule, type MeterMessage } from '@waveform-playlist/worklets';

await addMeterWorkletModule((url) => ctx.audioWorklet.addModule(url));

const meterNode = new AudioWorkletNode(ctx, 'meter-processor');
meterNode.port.onmessage = (event: MessageEvent<MeterMessage>) => {
  const { peak, rms } = event.data; // per-channel arrays
  updateVuMeter(peak, rms);
};
```

## API

- `addRecordingWorkletModule(addModule: (url: string) => Promise<void>): Promise<void>` — registers the `recording-processor` worklet module via your context's `addModule` callback
- `addMeterWorkletModule(addModule: (url: string) => Promise<void>): Promise<void>` — registers the `meter-processor` worklet module via your context's `addModule` callback
- `recordingProcessorUrl` / `meterProcessorUrl` — the underlying module URLs, for consumers who want to call `audioWorklet.addModule()` directly instead of using the loaders
- `MeterMessage` — `{ peak: number[]; rms: number[] }`, the shape posted by the `meter-processor` on its port

## Examples & Documentation

- [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/)

## License

MIT
