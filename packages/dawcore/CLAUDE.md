# dawcore Package (`@dawcore/components`)

**Purpose:** Framework-agnostic Web Components for multi-track audio editing. Wraps `PlaylistEngine` + `createToneAdapter()` in Lit elements so any framework (or vanilla HTML) can render waveforms and control playback.

**Architecture:** Data elements (`<daw-track>`, `<daw-clip>`) use light DOM; visual elements (`<daw-waveform>`, `<daw-playhead>`, `<daw-ruler>`) use Shadow DOM with chunked canvas rendering. `<daw-editor>` orchestrates everything. Transport elements find their target via `for` attribute.

**Build:** Uses tsup — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS. `sideEffects: true` because element imports register custom elements globally.

**Testing:** vitest with happy-dom in `src/__tests__/`. Run with `cd packages/dawcore && npx vitest run`.

**Testing gotchas:**
- `isConnected` is a readonly getter in happy-dom — cannot be set via `Object.assign` on elements. Append the element to `document.body` instead.
- Mocks for async functions (e.g., `resumeGlobalAudioContext`) must return `Promise.resolve()`, not `undefined`. Calling `.catch()` on `undefined` crashes.
- `canvas.getContext('2d')` returns `null` in happy-dom. Tests must mock it: `vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as any)` where `mockCtx` has `clearRect`, `resetTransform`, `scale`, `fillStyle`, `fillRect` as `vi.fn()`.

**Dev page:** `pnpm dev:page` starts Vite at `http://localhost:5173/dev/index.html`. Uses `website/static/` as publicDir for audio files.

## Dev Page Dependencies

- **`pnpm dev:page` resolves peer packages from `dist/`** — No Vite source aliases. After changing `@waveform-playlist/engine` or `@waveform-playlist/playout` source, run `pnpm build` in those packages before testing on the dev page.
- **Incremental track removal** — `engine.removeTrack(trackId)` uses `adapter.removeTrack()` when available (disposes single track, preserves playback). Falls back to `adapter.setTracks()` (full rebuild, stops Transport).

## Element Types

**Data elements (light DOM):**
- `<daw-clip>` — Declarative clip data (src, start, duration, offset, gain, fades). Auto-generated `clipId`.
- `<daw-track>` — Track data (name, volume, pan, muted, soloed). Dispatches `daw-track-connected` on mount, `daw-track-update` on property change. Track removal detected by editor's MutationObserver (not events — detached elements can't bubble).

**Visual elements (Shadow DOM):**
- `<daw-waveform>` — Chunked canvas rendering (1000px chunks). Receives peaks as JS properties. Uses dirty pixel tracking for incremental rendering — `updatePeaks(startIndex, endIndex)` marks a range dirty without full redraw. Bits derived from typed array (Int8Array→8, Int16Array→16). Drawing batched via `requestAnimationFrame`.
- `<daw-playhead>` — RAF-animated vertical line via `AnimationController`.
- `<daw-ruler>` — Temporal time scale with tick marks. Ported from `SmartScale` (temporal mode only, beats & bars deferred). Computes ticks once in `willUpdate()`, reused by both `render()` and `updated()`.

**Control elements:**
- `<daw-editor>` — Core orchestrator. Builds engine lazily on first track load, loads audio per-track on `daw-track-connected`, renders waveforms from decoded peaks.
- `<daw-transport for="editor-id">` — Container that resolves target via `document.getElementById`. Light DOM.
- `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>` — Walk up to closest `<daw-transport>` for target resolution. Warn when target is null.
- `<daw-record-button>` — Transport button. Toggles `startRecording()`/`stopRecording()` on target editor. Listens for `daw-recording-start`/`daw-recording-complete` events to update visual state.

## Recording

- **`RecordingController`** — Lit reactive controller on `<daw-editor>`. Manages AudioWorklet lifecycle, per-channel sample accumulation, incremental peak generation via `appendPeaks()` from `@waveform-playlist/recording`, and live preview via `setPeaksQuiet()` + `updatePeaks()` on `<daw-waveform>`.
- **Session map** — `Map<string, RecordingSession>` keyed by track ID. Single session for now; map structure supports future multi-mic.
- **Consumer provides stream** — `editor.recordingStream = stream` or pass to `startRecording(stream)`. Mic access/permission is consumer responsibility.
- **Cancelable clip creation** — `daw-recording-complete` event is cancelable. `preventDefault()` skips automatic clip creation; consumer handles the `AudioBuffer` themselves.
- **Channel detection** — `stream.getAudioTracks()[0].getSettings().channelCount`, not `source.channelCount` (defaults to 2 per spec).
- **Worklet loading** — `rawContext.audioWorklet.addModule(recordingProcessorUrl)` (native API, not Tone.js which caches single module).
- **Use `getGlobalContext()` not `getGlobalAudioContext()`** — Recording audio graph (source, worklet node) must use Tone.js Context methods (`context.createMediaStreamSource()`, `context.createAudioWorkletNode()`). `getGlobalAudioContext()` returns a `standardized-audio-context` wrapper that fails `instanceof BaseAudioContext` in native constructors. Use `rawContext` only for `audioWorklet.addModule()` and `sampleRate`.
- **Worklet requires `start` command** — `recording-processor` defaults `isRecording=false`. Must `port.postMessage({ command: 'start', channelCount })` after connecting source→worklet. Without it, no data flows. Do NOT send `sampleRate` — the worklet uses its global `sampleRate`.
- **Handler ordering critical** — Set `workletNode.port.onmessage` BEFORE `source.connect(workletNode)` and `postMessage({ command: 'start' })`. The worklet can flush data immediately; messages before handler is wired are silently dropped.
- **Use `createClip()` not `createClipFromSeconds()` for recorded clips** — Recording session provides exact integer samples. The seconds round-trip (`samples/rateA → seconds → Math.round(seconds*rateB)`) drifts when `effectiveSampleRate` differs from `audioBuffer.sampleRate`.
- **`RecordingHost` must declare all host dependencies** — Any property or method the controller accesses on the host must be on the `RecordingHost` interface. No `as any` casts — the editor satisfies the interface directly. `_addRecordedClip?` is optional (runtime check), `shadowRoot` comes from `HTMLElement` intersection.
- **Always clean up partial sessions on error** — `startRecording` adds the session to `_sessions` before connect/start. The catch block must call `_cleanupSession(trackId)` to prevent stuck `isRecording` state and mic leak.

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
- `ViewportController` — Scroll-aware visible range with overscan buffer (1.5x). Attached to `.scroll-area` via `scrollSelector`. See Virtual Scrolling section.
- `EngineController` — (Scaffolded, not yet wired) DOM traversal to find closest `<daw-editor>`. Will be used by sub-elements that need engine access.
- `AudioResumeController` — One-shot AudioContext resume on first user gesture (`pointerdown`/`keydown`). Configurable target: host element (default), `'document'`, or CSS selector. Used by `<daw-editor eager-resume>`. Exported for standalone use.

**Lit controller lifecycle gotcha:** `hostConnected()` fires during `connectedCallback()`, BEFORE the first `willUpdate()`. Controllers that read properties set from attributes must defer work with `requestAnimationFrame` (as `ViewportController` and `AudioResumeController` do), otherwise the property will still be `undefined`.

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
- **Peak pipeline extracted** — `workers/peakPipeline.ts` manages worker lifecycle, WaveformData cache, inflight dedup.

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

- **`ViewportController`** — Lit reactive controller. Attaches to `.scroll-area` (via `scrollSelector`) in `hostConnected` — auto-reattaches on disconnect/reconnect. Tracks scroll position with 1.5x overscan buffer and 100px threshold. Calls `requestUpdate()` on attach and scroll.
- **`getVisibleChunkIndices()`** — Shared pure function in `utils/viewport.ts`, re-exported from `viewport-controller.ts`. Used by `daw-waveform._getVisibleChunkIndices()`.
- **Permissive defaults** — Controller initializes `visibleStart=-Infinity, visibleEnd=Infinity` so all chunks render before scroll container is attached.
- **`daw-waveform` props** — `visibleStart`, `visibleEnd`, `originX` control which 1000px canvas chunks are rendered. Defaults to all-visible when not set.
- **File size budget** — `daw-editor.ts` hard max 800 lines. `loadFiles` extracted to `interactions/file-loader.ts`; `addRecordedClip` extracted to `interactions/recording-clip.ts`; `TrackDescriptor`/`ClipDescriptor` extracted to `src/types.ts`.

## Track Controls

- **`<daw-track-controls>`** — Shadow DOM element. Receives track state as props from editor, dispatches `daw-track-control` and `daw-track-remove` events.
- **Controls outside scroll container** — Flex layout: fixed `.controls-column` (180px, `--daw-controls-width`) + `.scroll-area` (overflow-x: auto). Controls stay fixed while waveforms scroll.
- **Direct engine forwarding** — `daw-track-control` handler updates `_tracks` descriptor AND forwards to engine directly. Does not go through `<daw-track>` DOM element roundtrip (file-dropped tracks have no DOM element).
- **Track ID alignment** — `createTrack()` generates its own `id`. Must set `track.id = trackId` after creation so `engine.setTrackSolo/Mute/Volume/Pan(trackId, ...)` can find the track. Applied in both `_loadTrack` and `file-loader.ts`.

## File Loader Extraction

- **`interactions/file-loader.ts`** — `loadFiles()` extracted via `FileLoaderHost` interface to keep editor under 800 lines.
- **`src/types.ts`** — `TrackDescriptor` and `ClipDescriptor` interfaces, shared by `daw-editor.ts` and `file-loader.ts`. Re-exported from `index.ts`.
- **Non-private fields** — Fields accessed by the loader (`_tracks`, `_engineTracks`, `_peaksData`, `_clipBuffers`, `_audioCache`, `_peakPipeline`, `_resolvedSampleRate`, `_fetchAndDecode`, `_recomputeDuration`, `_ensureEngine`) are non-private (no `private` keyword, `_` prefix convention only).

## Empty State

- Hide playhead, selection, and ruler when `orderedTracks.length === 0`
- Timeline width: `100%` when empty (not hardcoded pixels) for full-width dropzone
- `.scroll-area` has `min-height: var(--daw-min-height, 200px)` for visible empty dropzone

## Lit/TypeScript Requirements

- `experimentalDecorators: true` and `useDefineForClassFields: false` in tsconfig — required for Lit's `@property` and `@customElement` decorators
- Light DOM elements override `createRenderRoot()` to return `this`
- `<daw-track>` defers `daw-track-connected` dispatch via `setTimeout(, 0)` so the editor's `connectedCallback` (which registers listeners) has time to run
