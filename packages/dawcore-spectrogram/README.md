# @dawcore/spectrogram

Framework-agnostic spectrogram computation, worker, and viewport-aware rendering orchestrator for the dawcore family.

Used by `@dawcore/components` (the Lit web component layer) and `@waveform-playlist/spectrogram` (the React Provider).

## Exports

- `computeSpectrogram`, `getColorMap`, `getFrequencyScale` — pure computation
- `createSpectrogramWorker`, `createSpectrogramWorkerPool` — worker factories
- `SpectrogramOrchestrator` (via `./orchestrator` subpath) — viewport/abort/tier/grouping logic

## License

MIT
