# @dawcore/spectrogram

Framework-agnostic spectrogram computation, Web Worker, and viewport-aware rendering orchestrator for the dawcore family.

Used by `@dawcore/components` (the Lit web component layer, behind `<daw-track render-mode="spectrogram">`) and `@waveform-playlist/spectrogram` (the React Provider).

## Installation

```bash
npm install @dawcore/spectrogram
```

No peer dependencies. If you use `@dawcore/components`, you don't install this directly — it's a regular dependency of that package.

## Quick Start

```typescript
import { computeSpectrogram, getColorMap } from '@dawcore/spectrogram';

// Pure, synchronous FFT — magnitudes per time/frequency bin
const data = computeSpectrogram(audioBuffer, { fftSize: 2048 });
const lut = getColorMap('magma');
```

For rendering inside an app, use the worker and orchestrator instead of blocking the main thread:

```typescript
import { SpectrogramOrchestrator } from '@dawcore/spectrogram/orchestrator';

const orchestrator = new SpectrogramOrchestrator({
  workerFactory: () =>
    new Worker(new URL('@dawcore/spectrogram/worker/spectrogram.worker', import.meta.url), {
      type: 'module',
    }),
  config: { fftSize: 2048 },
});

orchestrator.registerClip(/* audio data */);
orchestrator.registerCanvas(/* OffscreenCanvas + metadata */);
orchestrator.setViewport(/* visible range */);
orchestrator.addEventListener('viewport-ready', (e) => console.log(e));
```

The orchestrator renders in three tiers (visible viewport first, then a 25% overscan buffer, then the rest during idle time), aborts stale work when the viewport, config, or color map changes, and groups contiguous chunks so non-adjacent regions never trigger one oversized FFT.

## Entry Points

- `@dawcore/spectrogram` — `computeSpectrogram`, `computeSpectrogramMono`, `getColorMap`, `getFrequencyScale`, worker factories (`createSpectrogramWorker`, `createSpectrogramWorkerPool`, `SpectrogramAbortError`), and the orchestrator re-exports
- `@dawcore/spectrogram/worker/spectrogram.worker` — the Worker module URL target (resolve with `new URL(..., import.meta.url)`)
- `@dawcore/spectrogram/orchestrator` — `SpectrogramOrchestrator` and helpers (`classifyViewport`, `groupContiguousChunks`, `ColorLUTCache`) without the computation/worker graph, for consumers with their own FFT pipeline

## Examples & Documentation

- [`examples/dawcore-native/spectrogram.html`](https://github.com/naomiaro/waveform-playlist/tree/main/examples/dawcore-native) — spectrogram tracks in `<daw-editor>` (`pnpm example:dawcore-native`)
- Guides: [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/)

## License

MIT
