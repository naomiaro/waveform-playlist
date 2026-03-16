# dawcore Package (`@dawcore/components`)

**Purpose:** Framework-agnostic Web Components for multi-track audio editing. Wraps `PlaylistEngine` + `createToneAdapter()` in Lit elements so any framework (or vanilla HTML) can render waveforms and control playback.

**Architecture:** Data elements (`<daw-track>`, `<daw-clip>`) use light DOM; visual elements (`<daw-waveform>`, `<daw-playhead>`, `<daw-ruler>`) use Shadow DOM with chunked canvas rendering. `<daw-editor>` orchestrates everything. Transport elements find their target via `for` attribute.

**Build:** Uses tsup — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS. `sideEffects: true` because element imports register custom elements globally.

**Testing:** vitest with happy-dom in `src/__tests__/`. Run with `cd packages/dawcore && npx vitest run`.

**Dev page:** `pnpm dev:page` starts Vite at `http://localhost:5173/dev/index.html`. Uses `website/static/` as publicDir for audio files.

## Element Types

**Data elements (light DOM):**
- `<daw-clip>` — Declarative clip data (src, start, duration, offset, gain, fades). Auto-generated `clipId`.
- `<daw-track>` — Track data (name, volume, pan, muted, soloed). Dispatches `daw-track-connected` on mount, `daw-track-update` on property change. Track removal detected by editor's MutationObserver (not events — detached elements can't bubble).

**Visual elements (Shadow DOM):**
- `<daw-waveform>` — Chunked canvas rendering (1000px chunks). Receives peaks as JS properties.
- `<daw-playhead>` — RAF-animated vertical line via `AnimationController`.
- `<daw-ruler>` — Temporal time scale with tick marks. Ported from `SmartScale` (temporal mode only, beats & bars deferred). Computes ticks once in `willUpdate()`, reused by both `render()` and `updated()`.

**Control elements:**
- `<daw-editor>` — Core orchestrator. Builds engine lazily on first track load, loads audio per-track on `daw-track-connected`, renders waveforms from decoded peaks.
- `<daw-transport for="editor-id">` — Container that resolves target via `document.getElementById`. Light DOM.
- `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>` — Walk up to closest `<daw-transport>` for target resolution. Warn when target is null.

## Key Patterns

- **Event-driven track loading** — `<daw-track>` dispatches `daw-track-connected` (bubbling, composed); `<daw-editor>` listens and loads audio for that track individually. Track removal uses MutationObserver (events from `disconnectedCallback` can't bubble since element is already detached).
- **Eager audio decode** — Audio fetches and decodes on track connect using `getGlobalAudioContext()` from playout (works while suspended, pre-gesture). Waveforms render immediately without waiting for play.
- **Engine built lazily on first track load** — `PlaylistEngine` + adapter created when the first `_loadTrack` resolves (uses correct `sampleRate` from decoded audio). `engine.setTracks()` called as tracks load (builds playout structure). `engine.init()` deferred to first `play()` (resumes AudioContext, requires user gesture).
- **Engine API note** — `adapter.addTrack()` throws if no playout exists, so the editor always uses `setTracks()` with all tracks. `addTrack()` is not used in Phase 1.
- **Immutable state updates** — All `@state()` Maps are replaced with `new Map(old).set(...)`, never mutated in place.
- **Derived width, not stored state** — `_totalWidth` is a getter derived from `_duration`, `effectiveSampleRate`, and `samplesPerPixel`. Not a `@state()` property — avoids Lit update loops from setting state in `updated()`.
- **Error events** — `daw-track-error` dispatched on load failure (with `{ trackId, error }`). `daw-error` dispatched on playback failure (with `{ operation, error }`). Failed fetch promises are removed from cache to allow retry.
- **Engine promise retry** — `_enginePromise` is cleared on rejection so `_ensureEngine()` can retry instead of caching a permanent failure.
- **Web worker peak generation** — `PeakPipeline` (in `workers/peakPipeline.ts`) generates `WaveformData` via inline Blob worker at the current `samplesPerPixel`, caches per `AudioBuffer` (WeakMap), extracts `PeakData` via `resample()`. Resampling only works to coarser (larger) scales — the cached base scale determines the finest renderable zoom. Per-channel peaks when `mono=false`; weighted-average mono merge when `mono=true`.

## CSS Theming

Custom properties on `<daw-editor>` or any ancestor, inherited through Shadow DOM:

- `--daw-wave-color` (default: `#c49a6c`)
- `--daw-playhead-color` (default: `#d08070`)
- `--daw-background` (default: `#1a1a2e`)
- `--daw-track-background` (default: `#16213e`)
- `--daw-ruler-color` / `--daw-ruler-background`
- `--daw-controls-background` / `--daw-controls-text`
- `--daw-selection-color`, `--daw-clip-header-background`, `--daw-clip-header-text`

## Reactive Controllers

- `AnimationController` — Start/stop RAF loops, auto-cleanup on `hostDisconnected`. Used by `<daw-playhead>`.
- `ViewportController` — (Scaffolded, not yet wired) Scroll-aware visible range with overscan buffer (1.5x). Will be integrated when `<daw-editor>` supports virtual scrolling.
- `EngineController` — (Scaffolded, not yet wired) DOM traversal to find closest `<daw-editor>`. Will be used by sub-elements that need engine access.

## Ported Utilities

- `peak-rendering.ts` — `aggregatePeaks`, `calculateBarRects`, `calculateFirstBarPosition` (from `ui-components`)
- `smart-scale.ts` — `getScaleInfo`, `computeTemporalTicks` (extracted from `SmartScale.tsx`, temporal mode only)
- `time-format.ts` — `formatTime` for ruler labels

## Interaction Patterns

- **Seek during playback requires stop+play** — Tone.js `transport.seconds = time` doesn't reschedule audio sources. Must call `engine.stop()` then `engine.play(newTime)` and restart playhead animation.
- **Stop returns to play start position** — Standard DAW behavior. Engine tracks `_playStartPosition`; read `engine.getCurrentTime()` in the `stop` event handler, not `_currentTime`.
- **Pointer events, not click** — Use `pointerdown`/`pointermove`/`pointerup` with 3px activation threshold to distinguish click (seek) from drag (selection). Wrap `releasePointerCapture` in try-catch; use `finally` to reset `_isDragging`.
- **No scrollLeft in pointer math** — `:host` has `overflow-x: auto`; `.timeline` is wider. `getBoundingClientRect().left` on `.timeline` already reflects scroll (goes negative when scrolled right), so `clientX - rect.left` gives the correct pixel. Do NOT add `scrollLeft`.
- **Track hit detection via Y position** — `composedPath()[0].closest('.track-row')` can't cross Shadow DOM boundaries. Use `getBoundingClientRect()` on track rows and compare `e.clientY` instead.
- **File type detection** — `file.type` can be empty string for valid audio (`.opus` on some browsers). Only reject files with explicitly non-audio MIME types: `if (file.type && !file.type.startsWith('audio/'))`.
- **`loadFiles()` returns result** — Returns `{ loaded: string[], failed: Array<{ file, error }> }` so callers can detect partial failures. Individual file errors are caught and reported via `daw-files-load-error` events.
- **sampleRate comes from decoded audio** — Always use `audioBuffer.sampleRate` for clip creation. The global AudioContext decodes at the hardware rate (may be 44100 or 48000). Set `this.sampleRate` from the first decoded buffer so the ruler, peaks, and engine all agree.
- **Use `getGlobalAudioContext()` for decode** — Import from `@waveform-playlist/playout`. Same context Tone.js uses. `decodeAudioData` works while suspended (pre-gesture). Never create a separate AudioContext for decoding.
- **Pointer interactions extracted** — `interactions/pointer-handler.ts` handles pointerdown/move/up, caches timeline ref and rect, distinguishes click vs drag. The host implements `PointerHandlerHost` interface.
- **Peak pipeline extracted** — `workers/peakPipeline.ts` manages worker lifecycle, WaveformData cache, inflight dedup. `daw-editor.ts` is ~790 lines (under 800 max); consider extracting `loadFiles` if it grows further.

## Typed Events

- **`DawEventMap`** in `src/events.ts` — all 12 custom events with typed details. Use `new CustomEvent<DetailType>(...)` at dispatch sites.
- **`LoadFilesResult`** — named return type for `loadFiles()`, exported from index.
- **`PointerEngineContract`** in `interactions/pointer-handler.ts` — narrow engine interface (5 methods). `PointerHandlerHost._engine` uses this, not `PlaylistEngine` directly.
- Always dispatch `daw-track-select` event on both engine and no-engine paths.

## Sample Rate

- `sampleRate` `@property` is an initial hint (default 48000). `_resolvedSampleRate` is set from decoded audio.
- **Always use `effectiveSampleRate`** in internal calculations — returns `_resolvedSampleRate ?? sampleRate`.
- `PointerHandlerHost` uses `effectiveSampleRate`, not `sampleRate`.

## File Drop

- **Always revoke blob URLs** — `URL.revokeObjectURL(blobUrl)` after decode succeeds or in the catch block.
- `_getOrderedTracks()` sorts DOM-declared tracks by position, file-dropped tracks (not in DOM) sort after, preserving Map insertion order among themselves.

## Web Worker Peak Generation

- **`peaksWorker.ts`** — Inline Blob worker (portable across bundlers). Generates WaveformData binary format from AudioBuffer channel data at a given scale. Uses `generateWaveformData` algorithm from BBC's waveform-data.js (MIT). Includes fix for upstream trailing-bin offset bug in 16-bit multi-channel.
- **`waveformDataUtils.ts`** — `extractPeaks()` converts WaveformData → PeakData. Handles all channels, mono merging (weighted average), slicing, and aligned resampling.
- **`peakPipeline.ts`** — Orchestrates worker lifecycle, WaveformData cache (WeakMap per AudioBuffer), inflight dedup, and peak extraction at any zoom level.
- **Peak resolution order:** (1) WaveformData cache hit → `extractPeaks()` (synchronous resample), (2) worker generation → cache → extract.
- **Zoom re-extraction:** `willUpdate()` detects `samplesPerPixel` changes and re-extracts peaks from cached WaveformData. Only works for scales coarser than the cached base — finer zoom requires regeneration via worker.
- **Aligned resampling** — When slicing WaveformData before resampling to a different scale, source slice indices must align to the resampling ratio. Uses `floor(targetStart * ratio)` / `ceil(targetEnd * ratio)` to include all contributing source bins. See browser CLAUDE.md "Aligned Peak Resampling" for full explanation.
- **CSP fallback** — Worker creation can fail in CSP-restricted environments blocking blob: URLs. The fallback rejects with actionable error message suggesting `worker-src blob:` directive.
- **Disconnect guard** — `_loadTrack` catch checks `this.isConnected` before dispatching error events (detached elements can't bubble, CLAUDE.md pattern #36).

## Virtual Scrolling

- **`ViewportController`** — Lit reactive controller. Attaches to `:host` (scroll container) via `hostConnected` — auto-reattaches on disconnect/reconnect. Tracks scroll position with 1.5x overscan buffer and 100px threshold. Calls `requestUpdate()` on attach and scroll.
- **`getVisibleChunkIndices()`** — Shared pure function in `utils/viewport.ts`, re-exported from `viewport-controller.ts`. Used by `daw-waveform._getVisibleChunkIndices()`.
- **Permissive defaults** — Controller initializes `visibleStart=-Infinity, visibleEnd=Infinity` so all chunks render before scroll container is attached.
- **`daw-waveform` props** — `visibleStart`, `visibleEnd`, `originX` control which 1000px canvas chunks are rendered. Defaults to all-visible when not set.
- **File size budget** — `daw-editor.ts` is at 800 lines (the hard max). Extract `loadFiles` (~100 lines) before adding more code.

## Lit/TypeScript Requirements

- `experimentalDecorators: true` and `useDefineForClassFields: false` in tsconfig — required for Lit's `@property` and `@customElement` decorators
- Light DOM elements override `createRenderRoot()` to return `this`
- `<daw-track>` defers `daw-track-connected` dispatch via `setTimeout(, 0)` so the editor's `connectedCallback` (which registers listeners) has time to run
