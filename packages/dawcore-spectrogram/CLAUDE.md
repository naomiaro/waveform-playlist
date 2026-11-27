# dawcore-spectrogram (`@dawcore/spectrogram`)

**Purpose:** Framework-agnostic spectrogram computation, Web Worker, and viewport-aware rendering orchestrator. Used by the dawcore Lit element layer via `<daw-spectrogram>` + `SpectrogramController`. The React Provider in `@waveform-playlist/spectrogram` currently consumes the worker + computation primitives only and keeps its own per-track tier pipeline; the orchestrator is a candidate for a future consolidation PR.

**Build:** tsup, three entry blocks — main (CJS + ESM + DTS), `worker/spectrogram.worker` (ESM-only, no DTS), `orchestrator/index` (ESM + DTS) under `./orchestrator` subpath. `clean: true` only on the first block.

**Testing:** vitest with happy-dom. Tests live at `packages/dawcore-spectrogram/__tests__/` (sibling of `src/`, NOT inside it — `rootDir` is intentionally omitted from `tsconfig.json` so the sibling `__tests__/` and `src/` directories are both picked up via `include`).

**The worker module is directly testable end-to-end** — stub `self.postMessage` (capture array) BEFORE `await import('../src/worker/spectrogram.worker')`, then drive `self.onmessage({ data })` manually; mock OffscreenCanvas with a `getContext` whose `createImageData`/`putImageData` capture pixels. This exercises the real FFT → cache → render pipeline (pixel assertions caught the #554 coordinate bug). `worker-render-mapping.test.ts` is the reference. Vitest per-file isolation keeps the un-restored `self` stubs from leaking across files.

**Shared test mocks live in `__tests__/helpers/`** (`orchestratorTestUtils.ts`: makeMockWorker/makeMockPool/makeOrchestratorWithMockPool; `poolTestUtils.ts`: trackingWorkerFactory/postedMessages/ackComputeFFTs) — extend these instead of copy-pasting mock preambles into new test files.

**The real pool can drive the real worker module:** in the pool's mock-worker factory, point one worker's `postMessage` at `self.onmessage` and relay `self.postMessage` replies to that worker's `onmessage` (`pool-worker-channel-pixels.test.ts`). Render with the cache key from the module's own reply; the other workers get a hand-written reply (`ackComputeFFTs`).

**To see which channels a worker got,** fill channel k with the value k + 1 and read `arr[0] - 1` from the posted message (the client sends copies, so identity checks fail; `pool-channel-audio.test.ts`).

## Subpath Exports

- `@dawcore/spectrogram` — re-exports computation + worker + orchestrator class
- `@dawcore/spectrogram/worker/spectrogram.worker` — Worker URL target; use as `new URL('@dawcore/spectrogram/worker/spectrogram.worker', import.meta.url)`
- `@dawcore/spectrogram/orchestrator` — orchestrator + helpers via a focused ESM-only subpath. The root entry re-exports the same surface, but importing through `/orchestrator` ships only the orchestrator graph (no computation/worker code at the import-time level, useful for consumers that handle their own FFT pipeline).

## SpectrogramOrchestrator

Class that owns the worker pool, clip+canvas registries, viewport state, and render dispatch. Extends `EventTarget` — dispatches `viewport-ready` (CustomEvent) after the viewport tier completes per track.

**`viewport-ready` semantics:** fires **at most once per `(generation, trackId)` pair**. Generation bumps (setViewport with a real change, setConfig, setColorMap) reset the dispatched-set so the event re-fires on the next render. Late `registerCanvas` calls that trigger a fresh render within the same generation do NOT re-fire. A track whose viewport group was skipped because its clip was registered again mid-computation is not marked: it fires in the render `registerClip` scheduled, after the new audio is drawn (`renderTier` returns false; a skipped group of a clip that was unregistered counts as drawn, since no render follows an unregister) (#928). `setViewport` is also short-circuited when called with identical state — no generation bump, no abort, no render. These dedups prevent N-renders-per-track-load patterns where the dispatched event count grows quadratically during initial loading.

**Constructor:** `new SpectrogramOrchestrator({ workerFactory, workerPoolSize?, config, colorMap?, devicePixelRatio? })`. The consumer owns worker URL resolution — pass a factory rather than baking URLs into the orchestrator.

**Lifecycle:** `registerClip` (audio data), `registerCanvas` (OffscreenCanvas + metadata), `setViewport`, `setConfig`, `setColorMap`. Each setter that affects render output bumps a generation counter and calls `pool.abortGeneration(newGeneration)` so stale FFT work drops cleanly — the worker treats work as stale iff `generation < latestGeneration`, so the abort must carry the NEW generation, never the previous one (#555). `dispose()` is idempotent.

**Protected fields:** `pool`, `config`, `colorMap`, `devicePixelRatio`, `clips`, `canvases`, `viewport`, `generation`, `colorLUT`, `disposed`, `readyDispatched`. Protected (not private) so `noUnusedLocals` doesn't flag dormant fields between task slices.

## Three-Tier Render

`scheduleRender()` coalesces for the WHOLE async render: `renderInFlight` is held until `runRender` settles, and requests arriving mid-render queue exactly one follow-up run (`renderQueued` loop in `runRenderLoop`) — never a concurrent `runRender` for the same generation (#558). `runRender` groups canvases by trackId, classifies each track's canvases via `classifyViewport()`, then:

1. **viewport tier** — synchronous priority render; emits `viewport-ready` when done
2. **buffer tier** — 25% overscan; renders right after viewport
3. **remaining tier** — yields via `requestIdleCallback` (setTimeout fallback) before each contiguous group

Each tier uses `groupRenderableChunks()` — canvases are partitioned by `(clipId, channelIndex)` FIRST (a track's canvases span channels and clips whose chunk indices interleave, #553), then split into contiguous chunk-index runs so non-contiguous indices (e.g. `[10, 14, 15, 11]`) don't trigger one huge FFT — they're FFT'd as two groups (`10-11`, `14-15`) bounded by `fftSize` padding on each side. `groupContiguousChunks()` remains the inner contiguity primitive.

Generation is checked after every `await` — stale generations bail without finishing the tier.

## Color LUT Cache

`ColorLUTCache.get(colorMapName)` returns a 256×RGB `Uint8Array` (768 bytes per entry). Copies the underlying `getColorMap` result so `clear()` yields a fresh reference even for named maps backed by module-level LUT constants. Real benefit: memoizes interpolated `ColorMapEntry[]` custom maps that `getColorMap` rebuilds on every call.

## Worker Pool Architecture

`createSpectrogramWorkerPool(workerFactory, poolSize = 2)` — `poolSize` is only the number of pre-spawned workers (clamped to the channel cap, 32). The **one-channel-per-worker invariant is load-bearing**: the worker FFT cache key is channel-agnostic (each worker stores its channel at index 0 under the same key string), so routing two channels to one worker would silently render the wrong channel's data. When audio has more channels than workers, the pool **grows lazily** to one worker per channel (#556), replaying registered clip audio into late-created workers — but only clips that actually have that worker's channel. **Each worker is given only the audio it can be asked to compute (#925):** in registrations and replays, worker 0 every channel of a clip (it also computes the mono mix), worker k ≥ 1 channel k alone, at index 0 (`channelsForWorker`); audio sent with a multi-channel `compute-fft` is cut to the one channel each worker computes, worker 0 included (`payloadForChannel`). So every worker is asked for `channelFilter: 0`, as `renderChunks` is remapped to `channelIndex: 0`. The worker module is unchanged: a worker with one array computes that array whatever `channelFilter` says, and worker 0, holding a registered clip's every channel, picks index 0. A clip id registered again with FEWER channels is unregistered on the workers past the new count, which would otherwise keep the old audio's channels. The pool does not know the view mode: when a consumer only ever asks for the mono mix (the React provider with `mono` on), worker k ≥ 1 still holds channel k. **New audio under an id that has audio replaces it (#928):** `register-audio-data` evicts the id's FFT cache entries, as `unregister-audio-data` does (the cache key names the request, not the audio), and both mark the id's running `compute-fft` computations superseded: one that finishes after its audio was replaced or removed answers `aborted` (`SpectrogramAbortError`) and caches nothing; the caller asks again for the new audio. The orchestrator's `renderGroup` skips the group of an abort at an unchanged generation and the rest of the pass draws (`unregisterClip` schedules no render, so a pass that stopped there left the other clips and tracks black; `orchestrator-audio-changed-mid-render.test.ts`); `registerClip` schedules a render when the clip has canvases. `worker-audio-reregister.test.ts` covers both. Canvases are routed by channel parsed from the canvas ID (`clipId-ch{N}-chunk{M}`, anchored regex). Channel-index policy is single-sourced in `assertValidChannelIndex` (integer, 0..cap-1, thrown); `registerCanvas` validates BEFORE the OffscreenCanvas transfer. `terminate()` sets a pool-level flag — post-terminate calls reject or no-op instead of resurrecting workers via growth.

## Generation-Based Abort

Stale FFT requests are cancelled via `abortGeneration(generation)` to the pool. Workers check `latestGeneration` between yields and return `null` when stale. A computation whose clip's audio was registered again or unregistered while it ran is aborted too, at an unchanged generation (#928, "Worker Pool Architecture"). `SpectrogramAbortError` is thrown via `instanceof`; consumers catch silently.

## Lazy Per-Batch FFT

Per-render-group sample range only, padded by `fftSize` on both sides. Avoids OOM on long clips — never computes a full-clip FFT.

The padded range math is single-sourced in `computePaddedFftRange` (`computation/fftSampleRange.ts`), shared with the React `computeChunkSampleRange` so the two pipelines can't drift (#560). Canvas-ID parsing (`parseChannelFromCanvasId`) delegates to `parseSpectrogramCanvasId` in `@waveform-playlist/core`.

## Pixel Coordinate Conventions (#554)

Two pixel spaces coexist — mixing them shifts the displayed audio by the clip's timeline position:

- **Timeline-absolute** (`CanvasRegistration.globalPixelOffset`, viewport bounds): used ONLY for viewport classification. `<daw-spectrogram>` registers `originX + chunkIndex * 1000`.
- **Clip-relative** (`chunkIndex * MAX_CANVAS_WIDTH`): used for ALL file-space sample math — the FFT `sampleRange` and the `globalPixelOffsets` sent to `renderChunks`.

The worker maps pixel → audio as `fileSample = clipOffsetSamples + pixel * samplesPerPixel` (`pixelColumnToFrame` in `computation/renderGeometry.ts`); `clipOffsetSamples` is captured on the FFT cache entry (and in the cache key) from the `compute-fft` message, so trimmed clips (`offsetSamples > 0`) display the right region. The React `SpectrogramProvider` already passes clip-relative offsets + `offsetSamples`, so it shares this contract unchanged.

## tsup ESM-Only Entries Emit `.d.mts`, Not `.d.ts`

The third tsup block (orchestrator subpath) is `format: ['esm']`. tsup emits `dist/orchestrator/index.d.mts` for the types, NOT `.d.ts`. The `package.json` `exports./orchestrator.types` field must match that exact path. Easy to ship wrong — `.d.ts` looks more idiomatic but resolves to nothing for ESM-only entries, breaking TypeScript subpath imports.

## Tests

Pure helper tests (chunk-grouping, color-lut-cache, viewport-classify, colorMaps, fft, frequencyScales, windowFunctions) + worker pool tests + orchestrator tests. Run with `cd packages/dawcore-spectrogram && npx vitest run` — vitest reports the current count.
