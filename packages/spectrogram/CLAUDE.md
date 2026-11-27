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
// read use(SpectrogramIntegrationContext) directly to get null when absent
const spectrogram = use(SpectrogramIntegrationContext);
```

**Location:** `packages/browser/src/SpectrogramIntegrationContext.tsx`

## Single-Call Canvas Registration

`registerSpectrogramCanvas({ canvasId, canvas, clipId, channelIndex, chunkIndex, widthPx, heightPx, offsetSamples?, durationSamples? })` is invoked by `SpectrogramChannel` immediately after `transferControlToOffscreen()`. The Provider stores the canvas in its internal per-clip-per-channel registry (`spectrogramCanvasRegistryRef`) and forwards the OffscreenCanvas to the worker pool. `unregisterSpectrogramCanvas(canvasId)` is the counterpart on chunk unmount.

**A canvas registers with the geometry it is drawn for; the provider renders that (#812).** The height (`canvasHeightsRef`) and the range of the audio (`canvasRangesRef`: `offsetSamples` / `durationSamples`) are kept per canvas id, with the registration only, and dropped on unregister. Each clip is rendered for the range its canvases registered with (`registeredClipRange` / `resolveClipRange` in `spectrogram-helpers.ts`), field by field falling back to the track's clip: the browser view draws a trim being dragged before `tracks` has it. A canvas cannot be registered twice, so a new range comes as new canvases (`SpectrogramChannel` keys them on it) and the re-registration bumps `spectrogramCanvasVersion`, which is what re-renders. A `tracks` change alone redraws nothing (the release of a trim: its canvases were already drawn for that range). The clip's `startSample` still comes from the track: it only places the chunks for the viewport tiers, the picture is in clip coordinates. A caller that registers without a range gets the old behaviour, including no redraw for a range change at the same pixel length. `registeredRange.test.tsx` fakes the worker pool and the four browser hooks.

Canvas IDs follow `${clipId}-ch${channelIndex}-chunk${n}`. `unregisterSpectrogramCanvas` parses this format to find the right registry slot.

The format's build/parse is single-sourced in `@waveform-playlist/core` (`spectrogramCanvasId.ts`); `extractChunkNumber`/`parseCanvasId`/`computeChunkSampleRange` are thin adapters over core's `parseSpectrogramCanvasId` + `@dawcore/spectrogram`'s `computePaddedFftRange` — don't reintroduce local regex/range math (#560).

## SpectrogramChannel Index vs ChannelIndex

**`SpectrogramChannel`** has two index concerns: `index` (CSS positioning via Wrapper `top` offset) and `channelIndex` (canvas ID construction, e.g. `clipId-ch{channelIndex}-chunk0`). In "both" mode, `SmartChannel` passes `index={props.index * 2}` for layout interleaving but `channelIndex={props.index}` for correct canvas identity. When `channelIndex` is omitted it defaults to `index`. Never use the visual `index` for canvas IDs — the worker and Provider registry expect sequential audio channel indices (0, 1).

## Provider Owns the Worker Pool

The Provider still creates and owns the `createSpectrogramWorkerPool` instance internally. `ensureWorkerPool()` is the only constructor: lazy, on the first audio a spectrogram track needs, the first canvas registration or the first spectrogram render (the computation effect). The `SpectrogramOrchestrator` from `@dawcore/spectrogram` exists for the dawcore Lit element path, not the React Provider — the Provider's own FFT/render pipeline handles per-track config overrides.

**The pool is the one owner of the audio it holds (#821).** The provider asks it (`registeredAudioClipIds()`) on every run of the pre-registration effect and keeps no list of its own. The pool is terminated in an effect cleanup, which React also runs when it keeps the component and runs its effects again (a hidden `<Activity>` shown again, StrictMode): a list kept in a ref outlived the pool, the next pool never got the audio, and every FFT request then carried a copy of the clip's whole audio. A throwaway `<Activity>` toggle on `/examples/mir-spectrogram` (not in the repository) saw 12.5 MB per FFT request on `dev` (the stereo track's audio, 6.25 MB into each of two workers) and none with the fix. `realPoolMessages.test.tsx` checks the same on the real pool and worker client with a recording fake `Worker`: no FFT request carries audio after a hide and reveal or under StrictMode. StrictMode is covered only by the unit test: on that page the provider mounts before the audio loads, so the simulated unmount finds nothing registered. A Fast Refresh of `SpectrogramProvider.tsx` on that page remounted the provider (fresh refs) and did not show the bug. `poolResources.test.tsx` covers StrictMode and `<Activity>` with a fake pool whose `terminate()` clears its audio, as the real one does.

**What is registered** (`audioRegistration.ts`): one entry per `AudioBuffer`, under a key from `createAudioKeyOf` (a `WeakMap`). Clips that share a buffer (a split) share it, and every FFT request names that key as the pool's `clipId`; the worker's cache key still carries each clip's range, and canvas ids stay per clip. Only the buffers of clips on tracks drawing `spectrogram` or `both` are registered. A buffer is released when no such clip uses it any more: its track goes back to `waveform` or the clip is removed, also the last track (the worker drops its FFT cache). A waveform track on a buffer that a spectrogram track also uses keeps it.

**An override holds only what the user chose (review of #926).** `TrackSpectrogramOverrides.renderMode` is optional: the menu's `setTrackRenderMode` sets it, the settings' `setTrackSpectrogramConfig` writes only `config` and `colorMap`, and every reader falls back with `override?.renderMode ?? track.renderMode`. The settings used to write `renderMode: 'waveform'` into a new override, which switched a track whose own mode was `spectrogram` to a waveform on Apply.

**`config` and `colorMap` are compared by content** (`useStableByContent`): the guide writes `config={{ … }}` inline, and the integration value and the render effect follow these props.

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

## Settings Modal Form Is a Draft (#698)

`SpectrogramSettingsModal` is a dialog shell plus an inner `SettingsForm` that is mounted only while `open`. The form's `useState` initialisers read the props once per open; there is no props-to-state sync effect. Do not add one: the call site (the view's root, `WaveformRoot` in the browser package) re-renders on playback and zoom, and an effect keyed on `config` identity reset the open form to defaults whenever the fallback `{}` was a new object. The native `close` listener (Escape) is attached once and reads `open`/`onClose` from a ref. `settingsModalKeepsEdits.test.tsx` mounts the real `<Waveform />` call site with a fake integration (no worker pool) to cover the two packages together (it resolves `@waveform-playlist/browser` via `dist/`). The call site passes a module-constant empty config, so that test alone would not catch a sync effect coming back; the unit test that re-renders with a fresh `{}` does.
