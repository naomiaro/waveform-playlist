# dawcore Package (`@dawcore/components`)

**Purpose:** Framework-agnostic Web Components for multi-track audio editing. Wraps `PlaylistEngine` + `NativePlayoutAdapter` in Lit elements so any framework (or vanilla HTML) can render waveforms and control playback. No Tone.js dependency — uses native Web Audio exclusively.

**Architecture:** Data elements (`<daw-track>`, `<daw-clip>`) use light DOM; visual elements (`<daw-waveform>`, `<daw-playhead>`, `<daw-ruler>`) use Shadow DOM with chunked canvas rendering. `<daw-editor>` orchestrates everything. Transport elements find their target via `for` attribute.

**Build:** Uses tsup — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS. `sideEffects: true` because element imports register custom elements globally.

**Testing:** vitest with happy-dom in `src/__tests__/`. Run with `cd packages/dawcore && npx vitest run`.

**Dev page:** `pnpm example:dawcore-native` starts Vite at `http://localhost:5173/` (config in `examples/dawcore-native/vite.config.ts`). Uses `website/static/` as publicDir for audio files.

## Notes by topic

The notes of this package are in `notes/`, one file per topic. Read the file for the part you are about to change, before changing it; a section that another document cites by its title is listed under the file that holds it. A new note goes into the topic file it belongs to (a new file for a new topic, with a row here), and into this file only when it applies to the whole package.

### The elements: `notes/elements.md`

Read before adding or changing an element, its attributes or properties, the track controls, the empty state or the spectrogram.

- Element Types
- Track Controls
- Empty State
- Spectrogram
- `<daw-keyboard-shortcuts>` Must Be Inside `<daw-editor>`
- Elements Inside `<daw-editor>`'s Shadow DOM Use `getRootNode().host`, Not `closest()`

### Recording: `notes/recording.md`

Read before changing recording, the stop handshake, pause / resume or the recording controller.

- Recording
- Recording Stop Handshake Test Patterns
- Stop Button Must Await `stopRecording` Before `editor.stop()`
- Pause/Resume Event Bus for Multi-Source State Sync
- `editor.togglePauseRecording()` Is the Unified Pause Toggle

### The effects chain: `notes/effects.md`

Read before changing the effects chain, WAM or Faust hosting from the editor.

- Effects Chain (core, #417)

### Pointer interactions: `notes/interactions.md`

Read before changing `PointerHandler`, `ClipPointerHandler`, seek, selection, clip move or trim.

- Interaction Patterns
- Clip Interactions

### Tracks, loading and peaks: `notes/tracks-and-loading.md`

Read before changing `addTrack` / `removeTrack`, the file loader, track loading order, the peak worker or virtual scrolling.

- Programmatic Track + Clip API
- Web Worker Peak Generation
- Virtual Scrolling
- File Loader Extraction
- Read `clip.audioBuffer` Directly in Helpers Called During Concurrent Track Loading

### Beats and bars, tempo, MIDI: `notes/tempo-and-midi.md`

Read before changing the beats-and-bars grid, tempo handling or MIDI tracks.

- Beats & Bars Grid Mode
- Variable Tempo
- MIDI (Tone Adapter Path)

### Unit tests of this package: `notes/testing.md`

Read before writing or changing a test in `src/__tests__` (after the skill `unit-testing`).

- Testing gotchas

## Dev Page Dependencies

- **`pnpm example:dawcore-native` resolves peer packages from source** — `examples/dawcore-native/vite.config.ts` has `resolve.alias` for core, engine, transport, and `@dawcore/components` pointing to `src/index.ts`. Changes are picked up immediately without rebuilding.
- **Incremental track removal** — `engine.removeTrack(trackId)` uses `adapter.removeTrack()` when available (disposes single track, preserves playback). Falls back to `adapter.setTracks()` (full rebuild, stops Transport).
- **Beat-map fixtures (gitignored)** — `website/static/media/audio/beat-demos/` has two RHCP MP3s + matching Beat This! `.beats` files in `beats/`. Served at `/media/audio/beat-demos/...`. Drive `beat-map-grid.html` in Playwright via the `#audio-input` / `#beats-input` file inputs (no drag-drop needed); assert through `editor.adapter.transport` and `editor.engine.getState()`.

## Embedding Gotchas

- **`:host { display: flex; flex-direction: column }`** on `<daw-editor>` is load-bearing — it stacks the ruler band (`.header-row`) over the body row (`.controls-viewport` + `.scroll-area`). Overriding `display` externally breaks the frozen-panes layout.
- **Frozen-panes layout** — `.scroll-area` owns BOTH scroll axes. The ruler (`.ruler-content`) and controls column (`.controls-column`) live in clipped viewports synced via `translate3d` transforms by `ScrollSyncController` on every scroll event. Track rows and `daw-track-controls` are both `box-sizing: border-box` with identical 1px bottom borders so their heights match exactly — never reintroduce a content-box row or a `+1` height compensation (the beats grid height is the plain sum of `trackHeight`s).
- **`daw-track-controls` requires an explicit height** — its `:host` uses `container-type: size` for compact modes (Pan slider hidden at container height ≤76px, Vol also hidden ≤60px; thresholds measure the content box). Without an explicit height (the editor always sets one), size containment collapses the element to zero height.
- **`theme.ts` `:host` rules block ancestor inheritance** for `--daw-*` custom properties. Consumers must set overrides directly on the host element (`<daw-editor>` / `<daw-transport>`), not on a wrapper above. Documented in `theme.ts` comments but the constraint is subtle — flag in any future Lit migration.
- **`daw-track-controls` has unthemed hardcoded values** that break on light page backgrounds: `rgba(255,255,255,0.06-0.12)` for M/S buttons + slider tracks (not exposed as CSS vars) and `opacity: 0.6` × `opacity: 0.5` nested on `.slider-label-name` (effective contrast 1.97:1, fails WCAG AA). See the open project memory for the var list a future PR should expose.

## Cross-Context Worklet Support

- **`RecordingHost` bridge methods** — `addWorkletModule`, `createAudioWorkletNode`, `createMediaStreamSource` on the host interface. `<daw-editor>` implements these by delegating to the adapter when it has matching methods, falling back to native `AudioContext` APIs.
- **Why:** `new AudioWorkletNode(stdCtx, ...)` fails with standardized-audio-context ("parameter 1 is not of type BaseAudioContext"). Tone.js wraps standardized-audio-context, so `TonePlayoutAdapter.audioContext` (which returns `rawContext`) is not a native `BaseAudioContext`. The bridge methods use `context.createAudioWorkletNode()` (Tone.js wrapper) which handles both context types.
- **`NativePlayoutAdapter` needs no bridge methods** — Its `audioContext` is a real native `AudioContext`, so the fallback path in `RecordingController` works directly.

## Key Patterns

- **Reparenting `<daw-editor>` keeps its arrangement (#848)** — `disconnectedCallback` cancels drags, disposes effects and the engine (which disposes the consumer's adapter) and sets `editor.adapter` to `null`, terminates the peak worker and the spectrogram controller. It keeps `_arrangement`, the descriptors, `_engineTracks` and the peak caches, so the detached editor still draws its tracks, as a moved `<input>` keeps its value. The children's reconnect finds their descriptors (`_onTrackConnected`'s `_tracks.has` branch) and enters nothing again. A fresh `editor.adapter` builds a new engine on the kept arrangement (one `adapter.setTracks`, nothing fetched again) and re-registers spectrogram audio. Undo/redo track resurrection is reconciled by `_reconcileDescriptorsWithEngineTracks` (adds synthesized descriptors for undo-restored tracks, prunes them again on redo; never prunes queued or element-backed tracks).
- **Undo-restored tracks get synthesized descriptors (and redo prunes them)** — `engine.undo()` restores removed tracks in ENGINE state only; the statechange handler's `_reconcileDescriptorsWithEngineTracks` synthesizes a `_tracks` descriptor (name and `kind` from the engine track, `renderMode` from the kind; no mix of its own, `_mixOf` reads it from the engine track, #843) so `editor.tracks` and `<daw-track-controls>` work, and prunes descriptors for element-less, non-loading tracks that leave engine state (redo) — one-sided synthesis would strand permanent ghosts `removeTrack()` can't clean. The effects chain does NOT survive (disposed at removal).
- **Event-driven track registration** — `<daw-track>` dispatches `daw-track-connected` (bubbling, composed); `<daw-editor>` registers it and queues it to enter the arrangement (`notes/tracks-and-loading.md`, "The arrangement loads the tracks"). Track removal uses MutationObserver (events from `disconnectedCallback` can't bubble since element is already detached).
- **Eager audio decode** — the arrangement fetches and decodes a track's audio as soon as it has entered (`adapter.audioContext.decodeAudioData`, which works while the context is suspended, before a gesture). Waveforms render without waiting for play.
- **The arrangement is made with the editor; the engine is built when the adapter arrives (#848)** — `_arrangement` (`createArrangement()`) exists from construction and survives a disconnect. `_buildEngine()` is synchronous and runs as soon as the editor is connected with an adapter (the adapter setter, or `connectedCallback`): `new PlaylistEngine({ adapter, arrangement: this._arrangement, sampleRate: adapter.audioContext.sampleRate, … })`, which attaches the adapter's context for decoding. A failure there is reported with `daw-error` (`operation: 'engine'`), not thrown from the setter. `sampleRate` is the adapter context's rate. `engine.init()` is deferred to the first `play()` (resumes the AudioContext, needs a user gesture).
- **A disconnect lets go of the adapter** — `disconnectedCallback` disposes the engine, which disposes the consumer's adapter, and sets `editor.adapter` to `null`: some adapters (NativePlayoutAdapter) leave the AudioContext open, and building on a disposed one wires tracks into a dead transport graph. A fresh `editor.adapter` builds a new engine on the kept arrangement.
- **Immutable state updates** — All `@state()` Maps are replaced with `new Map(old).set(...)`, never mutated in place.
- **Plain JS element properties (non-`@property`) that feed a cache must be accessor pairs** that invalidate it on set, plus the standard upgrade-property dance in `connectedCallback` (a value assigned before element definition creates an own property that permanently shadows the accessors). Precedent: `<daw-keyboard-shortcuts>` remap properties.
- **Derived width, not stored state** — `_totalWidth` is a getter derived from `_duration`, `effectiveSampleRate`, and `samplesPerPixel`. Not a `@state()` property — avoids Lit update loops from setting state in `updated()`.
- **Never set a reactive `@state`/property synchronously inside `updated()`** — it schedules a second render and fires Lit's "scheduled an update after an update completed" warning. This is dev-mode-only and NOT caught by vitest/typecheck/lint — it surfaces only in a real-browser smoke. Fix: derive in `willUpdate()`, skip the reassignment when the value is unchanged, or gate the trigger to only inputs that change the derived value (e.g. `<daw-player>` recomputes peaks on `mono` but not `wave-height`, which only affects display height that render() reads directly).
- **Engine-derived render inputs need `requestUpdate()` on engine events** — values read off a non-reactive engine during `render()` (e.g. `<daw-player>`'s `_engine.duration` → ruler) freeze at their last-rendered value when only an engine event changes them. Peaks usually resolve before `loadedmetadata`, so the ruler rendered `duration 0` forever (#549). Any engine event handler whose data feeds `render()` must call `this.requestUpdate()`.
- **Error events** — `daw-clip-error` per clip and `daw-track-error` (`{ trackId, error }`) when every clip of a track failed, read from the arrangement's `sources` by `LoadAnnouncer`; the track stays, and `retryTrack(trackId)` loads it again. `daw-error` (`{ operation, error }`) for playback failures and an engine that could not be built (`operation: 'engine'`).
- **Playhead latency compensation lives in the engine** — `_startPlayhead()` animates from `engine.getAudibleTime()` (raw − `outputLatency` − `lookAhead` while playing, held at play-start during the pre-roll window; Safari reports ~15ms outputLatency vs Chrome's ~3ms, Tone adapters add 0.1s lookAhead).
- **`_stopPlayhead()` displays raw time, storage stays raw** — Resting playhead shows `_currentTime` exactly (compensation is a playing-time concept; a seeked/stopped/paused cursor displays the commanded position). `_currentTime` is never display-adjusted, so the next `play()` resumes from the correct scheduling position.
- **`@waveform-playlist/engine` is imported normally (#848)** — it is a required peer, and the lazy import only kept about 20 KB gzipped out of the first chunk while leaving the editor with no owner for its tracks until the first decode. A framework-free helper both editors need still goes in core (`createMixerGesture`, #843).
- **A Lit property set to the value it already holds fires no update** — an API that works by writing an element's property (`editor.updateTrack` for a track with a `<daw-track>`) drops a request once the engine's state has moved away from the element (after an Undo). Write the engine too (#843, `_writeMixFields`).
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
- `--daw-placeholder-clip-opacity` (default `0.5`) — a clip whose audio is still loading, drawn where its length is known (a box tinted with `--daw-wave-color`, its `.dat` peaks when they came); `--daw-clip-failed-color` (default `#e06c75`) — the dashed outline and tint of a clip whose audio failed (#848)
- `--daw-controls-width` (default `180px`) — track-controls column width
- `--daw-min-height` (default `200px`) — scroll-area min height for empty editor / drop zone

## Reactive Controllers

- `AnimationController` — Start/stop RAF loops, auto-cleanup on `hostDisconnected`. Used by `PlaybackAnimationController`.
- `ViewportController` — Scroll-aware visible range with overscan buffer (1.5x). Attached to `.scroll-area` via `scrollSelector`. See Virtual Scrolling section.
- `EngineController` — (Scaffolded, not yet wired) DOM traversal to find closest `<daw-editor>`. Will be used by sub-elements that need engine access.
- `AudioResumeController` — One-shot AudioContext resume on first user gesture (`pointerdown`/`keydown`). Configurable target: host element (default), `'document'`, or CSS selector. Used by `<daw-editor eager-resume>`. Exported for standalone use.
- `ScrollSyncController` — frozen-panes transform sync (`.ruler-content` x, `.controls-column` y) plus wheel forwarding from `.controls-viewport` and `.ruler-viewport` (both axes, deltaMode-aware, preventDefault only when the container actually moved). Re-queries targets per scroll event because conditional templates recreate them; `sync()` is called from the editor's `updated()`.

**Lit controller lifecycle gotcha:** `hostConnected()` fires during `connectedCallback()`, BEFORE the first `willUpdate()`. Controllers that read properties set from attributes must defer work with `requestAnimationFrame` (as `ViewportController` and `AudioResumeController` do), otherwise the property will still be `undefined`.

## Adapter Pluggability

- **`editor.adapter` required** — Set a `PlayoutAdapter` before use. No default adapter created. Throws helpful error with install instructions if missing.
- **AudioContext from adapter** — `editor.audioContext` reads `adapter.audioContext`. No setter, no owned context. Adapter owns the AudioContext lifecycle.
- **`transport` getter removed** — Consumers access transport-specific APIs on their own adapter reference (e.g., `adapter.transport.setMetronomeEnabled(true)` for `NativePlayoutAdapter`).
- **`sample-rate` attribute removed** — Sample rate determined by adapter's AudioContext. `sampleRate` is a derived getter.
- **`editor.bpm` setter forwards to engine** — Calls `engine.setTempo(value)` when engine exists, UNLESS both tick callbacks are set (then display-only, #407). `_buildEngine` calls `adapter.setTempo?.(this._bpm)` before creating the engine (same callback guard) so initial `setTracks()` enrichment uses the correct BPM.
- **`adapter.ppqn` drives engine** — `_buildEngine` reads `adapter.ppqn ?? this._ppqn` for the engine's PPQN. No translation layer.

## Ported Utilities

- `peak-rendering.ts` — `aggregatePeaks`, `calculateBarRects`, `calculateFirstBarPosition`, `addBarToPath` (rounded-bar path builder with square-corner fallback when `ctx.roundRect` is missing) (from `ui-components` — keep mirrored)
- `<daw-waveform>` rounded bars batch into one path per region draw (`_drawBarRects` with radius hoisted out of the loop) — don't reintroduce per-bar `beginPath`/`fill` in the 60fps dirty-redraw path
- `smart-scale.ts` — `getScaleInfo`, `computeTemporalTicks` (extracted from `SmartScale.tsx`, temporal mode only)
- `time-format.ts` — `formatTime` for ruler labels

## Typed Events

- **`DawEventMap`** in `src/events.ts` — all custom events with typed details. Use `new CustomEvent<DetailType>(...)` at dispatch sites.
- **`daw-track-removed`** (detail `{ trackId }`) — outbound removal notification, symmetric with `daw-track-ready`. Dispatched from `_onTrackRemoved` ONLY when `existed && this.isConnected`: capture `existed = this._tracks.has(trackId)` at the TOP (cleanup mutates `_tracks` before the dispatch), and gate on `isConnected` per pattern #36 (reachable on a detached editor via `removeTrack`'s element-less branch). The MutationObserver calls `_onTrackRemoved` even for a `<daw-track>` removed before its deferred `daw-track-connected` ran (never registered) — exactly what the `existed` gate filters.
- **`daw-track-update`** (detail `DawTrackUpdateDetail`: `{ trackId, changed }`) — dispatched by `<daw-track>` after a reflected property changes; `changed` names the properties of that Lit update. The editor sends only the mixer properties it names, as one undo step (#843).
- **`daw-track-control`** (detail `DawTrackControlDetail`: `{ trackId, prop, value, gesture? }`) — dispatched by `<daw-track-controls>`; `gesture` is the slider's `createMixerGesture()` id, which the editor passes to the engine setter so one drag is one undo step (#843). Mute and solo send none.
- **`LoadFilesResult`** — named return type for `loadFiles()`, exported from index.
- **`daw-track-reorder`** (detail `DawTrackReorderDetail`: `{ trackId, fromIndex, toIndex }`) — dispatched by `<daw-track-controls>` when a move up/down button is clicked; bubbles to `<daw-editor>`, whose listener calls `reorderTrack(e.detail.trackId, e.detail.toIndex)`.
- **`daw-track-reorder-grab`** (detail `DawTrackReorderGrabDetail`: `{ trackId, pointerEvent, gripElement }`) — dispatched by `<daw-track-controls>` on grip `pointerdown`; bubbles to `<daw-editor>`, whose listener (guarded by `this.trackReordering`) hands the raw `PointerEvent` and grip element to `TrackReorderHandler.onGrab()`.
- **`PointerEngineContract`** in `interactions/pointer-handler.ts` — narrow engine interface (5 methods). `PointerHandlerHost._engine` uses this, not `PlaylistEngine` directly.
- Always dispatch `daw-track-select` event on both engine and no-engine paths.

## Sample Rate

- `sampleRate` is a derived getter reading from `adapter.audioContext.sampleRate` (fallback 48000). `_resolvedSampleRate` is set from decoded audio.
- **Always use `effectiveSampleRate`** in internal calculations — returns `_resolvedSampleRate ?? sampleRate`.
- `PointerHandlerHost` uses `effectiveSampleRate`, not `sampleRate`.

## File Drop

- **Always revoke blob URLs** — `URL.revokeObjectURL(blobUrl)` after decode succeeds or in the catch block.
- `_getOrderedTracks()` sorts DOM-declared tracks by position, file-dropped tracks (not in DOM) sort after, preserving Map insertion order among themselves.

## Lit/TypeScript Requirements

- `experimentalDecorators: true` and `useDefineForClassFields: false` in tsconfig — required for Lit's `@property` and `@customElement` decorators
- Light DOM elements override `createRenderRoot()` to return `this`
- `<daw-track>` defers `daw-track-connected` dispatch via `setTimeout(, 0)` so the editor's `connectedCallback` (which registers listeners) has time to run
