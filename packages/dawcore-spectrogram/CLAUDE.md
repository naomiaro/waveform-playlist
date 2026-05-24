# dawcore-spectrogram (`@dawcore/spectrogram`)

**Purpose:** Framework-agnostic spectrogram computation, Web Worker, and viewport-aware rendering orchestrator. Used by the dawcore Lit element layer via `<daw-spectrogram>` + `SpectrogramController`. The React Provider in `@waveform-playlist/spectrogram` currently consumes the worker + computation primitives only and keeps its own per-track tier pipeline; the orchestrator is a candidate for a future consolidation PR.

**Build:** tsup, three entry blocks — main (CJS + ESM + DTS), `worker/spectrogram.worker` (ESM-only, no DTS), `orchestrator/index` (ESM + DTS) under `./orchestrator` subpath. `clean: true` only on the first block.

**Testing:** vitest with happy-dom. Tests live at `packages/dawcore-spectrogram/__tests__/` (sibling of `src/`, NOT inside it — `rootDir` is intentionally omitted from `tsconfig.json` so the sibling `__tests__/` and `src/` directories are both picked up via `include`).

## Subpath Exports

- `@dawcore/spectrogram` — re-exports computation + worker + orchestrator class
- `@dawcore/spectrogram/worker/spectrogram.worker` — Worker URL target; use as `new URL('@dawcore/spectrogram/worker/spectrogram.worker', import.meta.url)`
- `@dawcore/spectrogram/orchestrator` — orchestrator + helpers via a focused ESM-only subpath. The root entry re-exports the same surface, but importing through `/orchestrator` ships only the orchestrator graph (no computation/worker code at the import-time level, useful for consumers that handle their own FFT pipeline).

## SpectrogramOrchestrator

Class that owns the worker pool, clip+canvas registries, viewport state, and render dispatch. Extends `EventTarget` — dispatches `viewport-ready` (CustomEvent) after the viewport tier completes per track.

**`viewport-ready` semantics:** fires **at most once per `(generation, trackId)` pair**. Generation bumps (setViewport with a real change, setConfig, setColorMap) reset the dispatched-set so the event re-fires on the next render. Late `registerCanvas` calls that trigger a fresh render within the same generation do NOT re-fire. `setViewport` is also short-circuited when called with identical state — no generation bump, no abort, no render. These dedups prevent N-renders-per-track-load patterns where the dispatched event count grows quadratically during initial loading.

**Constructor:** `new SpectrogramOrchestrator({ workerFactory, workerPoolSize?, config, colorMap?, devicePixelRatio? })`. The consumer owns worker URL resolution — pass a factory rather than baking URLs into the orchestrator.

**Lifecycle:** `registerClip` (audio data), `registerCanvas` (OffscreenCanvas + metadata), `setViewport`, `setConfig`, `setColorMap`. Each setter that affects render output bumps a generation counter and calls `pool.abortGeneration(prev)` so stale FFT work drops cleanly. `dispose()` is idempotent.

**Protected fields:** `pool`, `config`, `colorMap`, `devicePixelRatio`, `clips`, `canvases`, `viewport`, `generation`, `colorLUT`, `disposed`, `readyDispatched`. Protected (not private) so `noUnusedLocals` doesn't flag dormant fields between task slices.

## Three-Tier Render

`scheduleRender()` coalesces via `queueMicrotask` (one render per tick). `runRender` groups canvases by trackId, classifies each track's canvases via `classifyViewport()`, then:

1. **viewport tier** — synchronous priority render; emits `viewport-ready` when done
2. **buffer tier** — 25% overscan; renders right after viewport
3. **remaining tier** — yields via `requestIdleCallback` (setTimeout fallback) before each contiguous group

Each tier uses `groupContiguousChunks()` so non-contiguous chunk indices (e.g. `[10, 14, 15, 11]`) don't trigger one huge FFT — they're FFT'd as two groups (`10-11`, `14-15`) bounded by `fftSize` padding on each side.

Generation is checked after every `await` — stale generations bail without finishing the tier.

## Color LUT Cache

`ColorLUTCache.get(colorMapName)` returns a 256×RGB `Uint8Array` (768 bytes per entry). Copies the underlying `getColorMap` result so `clear()` yields a fresh reference even for named maps backed by module-level LUT constants. Real benefit: memoizes interpolated `ColorMapEntry[]` custom maps that `getColorMap` rebuilds on every call.

## Worker Pool Architecture

`createSpectrogramWorkerPool(workerFactory, poolSize = 2)` — kept its existing factory signature; the orchestrator delegates rather than refactoring 15 callsites in the pool test. Pool fans out per-channel FFT across workers; canvases are routed by channel parsed from the canvas ID (`clipId-ch{N}-chunk{M}`).

## Generation-Based Abort

Stale FFT requests are cancelled via `abortGeneration(generation)` to the pool. Workers check `latestGeneration` between yields and return `null` when stale. `SpectrogramAbortError` is thrown via `instanceof`; consumers catch silently.

## Lazy Per-Batch FFT

Per-render-group sample range only, padded by `fftSize` on both sides. Avoids OOM on long clips — never computes a full-clip FFT.

## tsup ESM-Only Entries Emit `.d.mts`, Not `.d.ts`

The third tsup block (orchestrator subpath) is `format: ['esm']`. tsup emits `dist/orchestrator/index.d.mts` for the types, NOT `.d.ts`. The `package.json` `exports./orchestrator.types` field must match that exact path. Easy to ship wrong — `.d.ts` looks more idiomatic but resolves to nothing for ESM-only entries, breaking TypeScript subpath imports.

## Tests

Pure helper tests (chunk-grouping, color-lut-cache, viewport-classify, colorMaps, fft, frequencyScales, windowFunctions) + worker pool tests + orchestrator tests. Run with `cd packages/dawcore-spectrogram && npx vitest run` — vitest reports the current count.
