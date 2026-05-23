# Spectrogram Package (`@waveform-playlist/spectrogram`)

**Purpose (v13+):** React Provider + UI for spectrograms. Computation, worker, and the framework-agnostic orchestrator now live in `@dawcore/spectrogram`. This package supplies `SpectrogramProvider`, menu/settings components, and the `SpectrogramIntegrationContext` value the browser package consumes.

## v13.0.0 Breaking Changes

- Removed package-root re-exports of `computeSpectrogram`, `getColorMap`, `getFrequencyScale`, `createSpectrogramWorker`, `createSpectrogramWorkerPool`, `SpectrogramAbortError`, `SpectrogramWorkerApi`, `FrequencyScaleName`. Import these from `@dawcore/spectrogram` directly.
- Removed `./worker/spectrogram.worker` subpath export. Use `new URL('@dawcore/spectrogram/worker/spectrogram.worker', import.meta.url)`.
- `SpectrogramIntegration` shape changed: `spectrogramWorkerApi` + `registerSpectrogramCanvases`/`unregisterSpectrogramCanvases` (batch per channel) replaced by `registerSpectrogramCanvas`/`unregisterSpectrogramCanvas` (single-canvas with full metadata in one call). See `@waveform-playlist/browser` for the new shape.

## Integration Context Pattern

**Pattern:** Browser package defines an interface + context, this package provides implementation via a Provider component. Same pattern as `@waveform-playlist/annotations`.

**Flow:** Browser defines `SpectrogramIntegrationContext` → this package creates `SpectrogramProvider` that supplies components/functions → browser components use `useSpectrogramIntegration()` and gracefully return `null` if unavailable.

**Throwing Context Hooks (Kent C. Dodds Pattern):**
`useSpectrogramIntegration()` throws if used without the provider. This follows the [Kent C. Dodds context pattern](https://kentcdodds.com/blog/how-to-use-react-context-effectively) — fail fast with a clear error instead of silently rendering nothing.

```typescript
// Components that need spectrograms — throws if <SpectrogramProvider> missing
const integration = useSpectrogramIntegration();

// Internal components that render with or without spectrograms
// use useContext(SpectrogramIntegrationContext) directly to get null when absent
const spectrogram = useContext(SpectrogramIntegrationContext);
```

**Location:** `packages/browser/src/SpectrogramIntegrationContext.tsx`

## Single-Call Canvas Registration

`registerSpectrogramCanvas({ canvasId, canvas, clipId, channelIndex, chunkIndex, widthPx, heightPx })` is invoked by `SpectrogramChannel` immediately after `transferControlToOffscreen()`. The Provider stores the canvas in its internal per-clip-per-channel registry (`spectrogramCanvasRegistryRef`) and forwards the OffscreenCanvas to the worker pool. `unregisterSpectrogramCanvas(canvasId)` is the counterpart on chunk unmount.

Canvas IDs follow `${clipId}-ch${channelIndex}-chunk${n}`. `unregisterSpectrogramCanvas` parses this format to find the right registry slot.

## SpectrogramChannel Index vs ChannelIndex

**`SpectrogramChannel`** has two index concerns: `index` (CSS positioning via Wrapper `top` offset) and `channelIndex` (canvas ID construction, e.g. `clipId-ch{channelIndex}-chunk0`). In "both" mode, `SmartChannel` passes `index={props.index * 2}` for layout interleaving but `channelIndex={props.index}` for correct canvas identity. When `channelIndex` is omitted it defaults to `index`. Never use the visual `index` for canvas IDs — the worker and Provider registry expect sequential audio channel indices (0, 1).

## Provider Owns the Worker Pool

The Provider still creates and owns the `createSpectrogramWorkerPool` instance internally (via `ensureWorkerPool()` — lazy, bootstrapped on first canvas registration). The `SpectrogramOrchestrator` from `@dawcore/spectrogram` exists for the dawcore Lit element path, not the React Provider — the Provider's existing FFT/render pipeline handles per-track config overrides and is unchanged.

## Worker Pool Architecture (now in `@dawcore/spectrogram`)

For details on `createSpectrogramWorkerPool`, generation-based abort, lazy per-batch FFT, and contiguous chunk grouping, see `packages/dawcore-spectrogram/CLAUDE.md`. The Provider consumes these primitives but does not own their implementation.

## Overscan Buffer (1.5x Viewport)

**Critical:** `getVisibleChunkRange` in SpectrogramProvider MUST use the same 1.5× viewport-width buffer as `useVisibleChunkIndices` in ScrollViewport.tsx. Without this, canvases mounted in the buffer zone (by the virtualizer) remain black — they're classified as "remaining" and get aborted during scrolling before background batches render them.

## Three-Tier Rendering Pipeline (React Provider)

**Decision:** Classify chunks into viewport/buffer/remaining instead of binary visible/remaining.

**Why:** The virtualizer only mounts chunks within the 1.5× buffer. A binary split with a 1.5× buffer classifies ALL mounted chunks as "visible", making phase 1 FFT cover 5-6 chunks (~4.5s) instead of 2 viewport chunks (~1.5s).

**Tiers:**
- **Phase 1a (viewport):** Chunks intersecting exact scroll viewport — fast first paint (~1.5s cold, ~80ms cached)
- **Phase 1b (buffer):** Chunks in 1.5× overscan but outside viewport — prevents black chunks on scroll
- **Phase 2 (remaining):** Off-screen chunks via `requestIdleCallback` background batches

**Contiguous grouping (critical):** Buffer indices may map to non-contiguous chunk numbers (e.g., indices `[0,3,4,5]` → chunks `[10,14,15,11]`). Always use `groupContiguousIndices()` before `computeFFTForChunks()` — without it, min-to-max spanning computes a huge FFT range (96K frames / 4.5s instead of 16K / 700ms per group).

## Controls Outside Scroll Container

**Gotcha:** `scrollContainerRef` coordinates do NOT include `controlWidth`. Controls render in a fixed `ControlsColumn` outside the scroll area. Never add `controlWidth` to chunk pixel positions in `getVisibleChunkRange` or viewport calculations.
