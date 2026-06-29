# dawcore Package (`@dawcore/components`)

**Purpose:** Framework-agnostic Web Components for multi-track audio editing. Wraps `PlaylistEngine` + `NativePlayoutAdapter` in Lit elements so any framework (or vanilla HTML) can render waveforms and control playback. No Tone.js dependency — uses native Web Audio exclusively.

**Architecture:** Data elements (`<daw-track>`, `<daw-clip>`) use light DOM; visual elements (`<daw-waveform>`, `<daw-playhead>`, `<daw-ruler>`) use Shadow DOM with chunked canvas rendering. `<daw-editor>` orchestrates everything. Transport elements find their target via `for` attribute.

**Build:** Uses tsup — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS. `sideEffects: true` because element imports register custom elements globally.

**Testing:** vitest with happy-dom in `src/__tests__/`. Run with `cd packages/dawcore && npx vitest run`.

**Testing gotchas:**

- `isConnected` is a readonly getter in happy-dom — cannot be set via `Object.assign` on elements. Append the element to `document.body` instead.
- Mocks for async functions (e.g., `resumeGlobalAudioContext`) must return `Promise.resolve()`, not `undefined`. Calling `.catch()` on `undefined` crashes.
- `canvas.getContext('2d')` returns `null` in happy-dom. Tests must mock it: `vi.spyOn(canvas, 'getContext').mockReturnValue(mockCtx as any)` where `mockCtx` has `clearRect`, `resetTransform`, `scale`, `fillStyle`, `fillRect` as `vi.fn()`.
- `PointerHandlerHost` and `ClipPointerHost` test mocks must include beats-mode fields (`scaleMode`, `ticksPerPixel`, `bpm`, `ppqn`, `_meterEntries`, `snapTo`, `renderSamplesPerPixel`). Default to `scaleMode: 'temporal'`, `snapTo: 'off'` for non-beats tests.
- `<daw-editor>` test mocks of `_peakPipeline` must include `terminate: vi.fn()` — `disconnectedCallback` calls it on `editor.remove()` and silently fails every test in the file with `TypeError`.
- Mock `PlayoutAdapter` for incremental-update tests must include `updateTrack: vi.fn()`. Without it, the engine's `_commitTrackChange` falls back to `setTracks` (full rebuild) instead of exercising the incremental path. `daw-editor-midi.test.ts`'s `makeMockAdapter` is the reference shape.
- Mock `PlayoutAdapter` for `<daw-editor>` tests must also include `init: vi.fn().mockResolvedValue(undefined)` and `isPlaying: vi.fn().mockReturnValue(false)` (in addition to `updateTrack` above). Minimal mock shapes crash on lifecycle paths the editor exercises during element setup. When writing a new editor test, copy `daw-editor-midi.test.ts:makeMockAdapter` rather than hand-rolling a thinner mock.
- `<daw-clip>.start` is `@property({ type: Number })` WITHOUT `reflect: true` — setting the JS property does NOT update the attribute. Tests asserting on `c.getAttribute('start')` will read `null` regardless of impl correctness. Use `(c as DawClipElement).start` (property access) instead.
- TDD failure-mode tests that intercept `editor.addTrack` to fail the Nth call should discriminate by `callCount` — NOT by introspecting `config.clips[0].midiChannel` or similar. The impl might use `addTrack({ midi: { ... } })` shorthand instead of `addTrack({ clips: [...] })`; a config-shape discriminator breaks silently. See `daw-editor-load-midi.test.ts` tests 8 and 9 for the pattern.
- happy-dom has no layout engine: `scrollLeft`/`scrollTop` assignments are NOT clamped, and `scrollWidth`/`scrollHeight`/`clientWidth`/`clientHeight` default to 0. Tests emulating scrollable or scroll-at-limit containers must stub these via `Object.defineProperty` (no-op setters emulate a clamped container).
- Container queries are not evaluated in happy-dom — assert structure (classes) and `static styles` cssText instead; verify actual compact/responsive behavior in a real browser.
- `editor.addTrack({ name, midi: { notes } })` is the lightweight way to get fully loaded tracks in editor template tests — no fetch/decode. See `daw-editor-layout.test.ts` `makeEditor()`.
- Test cleanup (spy `mockRestore`, removing appended `daw-editor`s) belongs in `afterEach`, never as the last line of a test body — a failed assertion skips trailing cleanup and silently poisons subsequent tests in the file.
- After refactoring test cleanup, run `pnpm typecheck` too — vitest passing doesn't catch newly-unused destructured bindings (`TS6133` under `noUnusedLocals`).
- happy-dom doesn't model `<option>` selectedness dirtiness or pointer-event delivery to hosts of disabled shadow controls — `?selected` toggles that break after a real user pick, and host-level `pointerdown` warns on disabled controls, must be verified in a real browser. The fix pattern for selects: sync the IDL `select.value` in `updated()` (see `daw-time-format.ts`).
- **Adding an export to `@dawcore/wam` (or `@dawcore/faust`) breaks every existing `vi.mock` of it** — vitest strict mocks throw "No X export is defined on the mock" on property access. Sweep all `vi.mock('@dawcore/wam', ...)` factories in `src/__tests__/` and add the new export (a `vi.fn()` stub suffices) whenever the real package's index grows.

**Dev page:** `pnpm example:dawcore-native` starts Vite at `http://localhost:5173/` (config in `examples/dawcore-native/vite.config.ts`). Uses `website/static/` as publicDir for audio files.

## Dev Page Dependencies

- **`pnpm example:dawcore-native` resolves peer packages from source** — `examples/dawcore-native/vite.config.ts` has `resolve.alias` for core, engine, transport, and `@dawcore/components` pointing to `src/index.ts`. Changes are picked up immediately without rebuilding.
- **Incremental track removal** — `engine.removeTrack(trackId)` uses `adapter.removeTrack()` when available (disposes single track, preserves playback). Falls back to `adapter.setTracks()` (full rebuild, stops Transport).
- **Beat-map fixtures (gitignored)** — `website/static/media/audio/beat-demos/` has two RHCP MP3s + matching Beat This! `.beats` files in `beats/`. Served at `/media/audio/beat-demos/...`. Drive `beat-map-grid.html` in Playwright via the `#audio-input` / `#beats-input` file inputs (no drag-drop needed); assert through `editor.adapter.transport` and `editor.engine.getState()`.

## Element Types

**Data elements (light DOM):**

- `<daw-clip>` — Declarative clip data (src, start, duration, offset, gain, fades). Auto-generated `clipId`.
- `<daw-track>` — Track data (name, volume, pan, muted, soloed). Dispatches `daw-track-connected` on mount, `daw-track-update` on property change. Track removal detected by editor's MutationObserver (not events — detached elements can't bubble).

**Visual elements (Shadow DOM):**

- `<daw-waveform>` — Chunked canvas rendering (1000px chunks). Receives peaks as JS properties. Uses dirty pixel tracking for incremental rendering — `updatePeaks(startIndex, endIndex)` marks a range dirty without full redraw. Bits derived from typed array (Int8Array→8, Int16Array→16). Drawing batched via `requestAnimationFrame`.
- `<daw-playhead>` — Pure visual element; exposes `setPosition(px)`. The editor's `PlaybackAnimationController` drives it each frame (single RAF loop that also dispatches `daw-timeupdate`).
- `<daw-ruler>` — Temporal time scale with tick marks. Ported from `SmartScale` (temporal mode only, beats & bars deferred). Computes ticks once in `willUpdate()`, reused by both `render()` and `updated()`.

**Control elements:**

- `<daw-editor>` — Core orchestrator. Builds engine lazily on first track load, loads audio per-track on `daw-track-connected`, renders waveforms from decoded peaks.
- `<daw-transport for="editor-id">` — Container that resolves target via `document.getElementById`. Light DOM.
- `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>` — Walk up to closest `<daw-transport>` for target resolution. Warn when target is null.
- `<daw-record-button>` — Transport button. Toggles `startRecording()`/`stopRecording()` on target editor. Listens for `daw-recording-start`/`daw-recording-complete` events to update visual state.
- `<daw-time-display>` — Formatted playback time readout. Document-level `daw-timeupdate`/`daw-time-format-change` listeners filtered by `e.target === transport target` (tolerates late-upgrading targets; re-resolves per event). `role="status"`, `aria-live="off"`.
- `<daw-time-format>` — Select that sets format ON the target (`target.setTimeFormat()`); target owns the state, all controls sync via the bubbled `daw-time-format-change` event (native-form style). Use this target-owned-state pattern for future transport inputs (#463 selection inputs, tempo, etc.).
- **Transport capability detection (`utils/transport-capability.ts`)** — Button subclasses declare `static requiredTargetMethods`; non-button controls call `targetSupports()` directly. Benefit of the doubt: a missing or not-yet-upgraded custom-element target counts as supported (control stays ENABLED; click-time resolution warns via `warnNoTargetOnce`) — only a *defined* target lacking the methods renders disabled. `pointerenter` triggers `requestUpdate()` so late targets re-evaluate before the click. Warn dedup is per element per message (`warnOnce`).
- **One playback RAF loop** — `PlaybackAnimationController` on the editor is the only per-frame playback loop (positions playhead + dispatches `daw-timeupdate`). Never add a second RAF loop for playback-time concerns; consume `daw-timeupdate` instead.
- **Seek-while-playing settle suppression** — `seekTo`/pointer-handler set `_inSeekTransition` around the internal `stop()` so the transient engine-stop settle (which rewinds to play-start) doesn't leak a backward-jumping `daw-timeupdate`. Any new stop-adjacent code path must do the same.

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

## Recording

- **`RecordingController`** — Lit reactive controller on `<daw-editor>`. Manages AudioWorklet lifecycle, per-channel sample accumulation, incremental peak generation via `appendPeaks()` from `@waveform-playlist/core`, and live preview via `setPeaksQuiet()` + `updatePeaks()` on `<daw-waveform>`. `addRecordingWorkletModule` is loaded via dynamic `import('@waveform-playlist/worklets')` inside `startRecording()` so the worklets package is only required when recording is used.
- **Pre-build the engine for recording with `editor.ready()`** — the engine builds lazily on first `play()`/track load, so recording into an empty editor pays a one-time build latency. Call `editor.ready()` right after wiring the adapter to build it eagerly; dawcore keeps the engine alive for the editor's lifetime (it's never torn down on empty — `_onTrackRemoved` only clears tracks and resets `_currentTime` to 0). The record demos do this. Note dawcore is NOT subject to the React provider's frozen-playhead race: `editor.play()` **awaits** `_ensureEngine()` before `engine.play()`, so the overdub playhead always advances even on the first record.
- **Session map** — `Map<string, RecordingSession>` keyed by track ID. Single session for now; map structure supports future multi-mic.
- **Consumer provides stream** — `editor.recordingStream = stream` or pass to `startRecording(stream)`. Mic access/permission is consumer responsibility.
- **Cancelable clip creation** — `daw-recording-complete` event is cancelable. `preventDefault()` skips automatic clip creation; consumer handles the `AudioBuffer` themselves.
- **Channel detection** — `stream.getAudioTracks()[0].getSettings().channelCount`, not `source.channelCount` (defaults to 2 per spec).
- **Worklet loading** — `rawContext.audioWorklet.addModule(recordingProcessorUrl)` (native API, not Tone.js which caches single module).
- **Recording uses native AudioContext** — `RecordingController` accesses `host.audioContext` directly for `createMediaStreamSource()` and `new AudioWorkletNode()`. No Tone.js wrapper needed.
- **Worklet requires `start` command** — `recording-processor` defaults `isRecording=false`. Must `port.postMessage({ command: 'start', channelCount })` after connecting source→worklet. Without it, no data flows. Do NOT send `sampleRate` — the worklet uses its global `sampleRate`.
- **Worklet registration tied to AudioContext identity** — `_workletLoadedCtx` stores the context that had `addModule()` called. If `editor.audioContext` is swapped, the new context needs re-registration. A simple boolean flag goes stale.
- **Request stereo in getUserMedia constraints** — `getUserMedia` defaults to mono even for stereo mics. Pass `channelCount: { ideal: 2 }` in audio constraints to get stereo when available. Without it, `getSettings().channelCount` correctly reports `1` because the stream _is_ mono. `ideal` doesn't force stereo on mono mics.
- **RecordingOptions.channelCount fallback** — `getSettings().channelCount` can still return `undefined` on some browsers. `RecordingOptions.channelCount` (typed `1 | 2`) provides a fallback. Default is `1` if neither detection nor option provides a value.
- **Handler ordering critical** — Set `workletNode.port.onmessage` BEFORE `source.connect(workletNode)` and `postMessage({ command: 'start' })`. The worklet can flush data immediately; messages before handler is wired are silently dropped.
- **Use `createClip()` not `createClipFromSeconds()` for recorded clips** — Recording session provides exact integer samples. The seconds round-trip (`samples/rateA → seconds → Math.round(seconds*rateB)`) drifts when `effectiveSampleRate` differs from `audioBuffer.sampleRate`.
- **`RecordingHost` must declare all host dependencies** — Any property or method the controller accesses on the host must be on the `RecordingHost` interface. No `as any` casts — the editor satisfies the interface directly. `_addRecordedClip?` is optional (runtime check), `shadowRoot` comes from `HTMLElement` intersection.
- **Always clean up partial sessions on error** — `startRecording` adds the session to `_sessions` before connect/start. The catch block must call `_cleanupSession(trackId)` to prevent stuck `isRecording` state and mic leak.
- **Slice latency from AudioBuffer, don't use offsetSamples** — `addRecordedClip` slices the buffer at `offsetSamples` before storing and generating peaks. The clip gets `offsetSamples: 0` since the offset is already applied. This ensures peaks match `durationSamples` exactly — using `offsetSamples` on the clip causes the peak pipeline to generate peaks for the full buffer, making the waveform wider than the clip container.
- **Track height must include recording session channels** — `numChannels` for track height is derived from finalized clip peaks. During live recording with no clips yet, it falls back to 1. Check `_recordingController.getSession(trackId)?.channelCount` for the correct channel count during recording.
- **Live preview position must match finalized clip** — Preview skips latency peaks (slice `latencyPixels * 2` from front) but keeps `left = startSample / spp` (no latency pixel offset on position). Both preview and finalized clip sit at `startSample` — the audio data is what shifts, not the container position.
- **Worklet pause/resume** — `recording-processor` accepts `pause` (flushes partial buffer, stops accumulating) and `resume` (restarts). Controller exposes `pauseRecording()`/`resumeRecording()`, editor delegates. Pause button sends both worklet pause and Transport pause.
- **`RecordingController.stopRecording` returns `Promise<void>`** — awaits the worklet's `done: true` ack before reading chunks (same handshake as `useRecording`). Fire-and-forget callers (`daw-stop-button`) work unchanged.

## Recording Stop Handshake Test Patterns

- Auto-acknowledge `{ command: 'stop' }` synchronously in the `port.postMessage` mock for tests that don't need to verify the await — keeps the test body sync-feeling.
- To verify the `await Promise.race(...)` is real (not coincidental from a sync ack), defer the done message via `queueMicrotask`. Drop the await and the test fails — `session.chunks` stays empty, controller bails with "No audio data captured", `_addRecordedClip` is never called.
- `concatenateAudioData` is mocked to return `Float32Array(0)`. Assert on chunk content via `vi.mocked(concatenateAudioData).mock.calls[0][0]` (its INPUT — the per-channel chunk array), not on `createAudioBuffer`'s output.
- **Peak generation must pass clip offset/duration** — `generatePeaks(buf, spp, mono, offsetSamples, durationSamples)` extracts peaks for only the clip's visible portion. Without offset/duration, clips sharing an AudioBuffer get full-buffer peaks and overlap visually.
- **`clip-headers` boolean attribute** — Defaults to false (no headers). Enable with `<daw-editor clip-headers>`. CSS in `clipStyles` from `theme.ts`. Header height (20px) subtracted from waveform area, divided equally among channels.
- **PeakPipeline baseScale** — Worker generates WaveformData at `baseScale` (default 128, matching AudioWorklet quantum). `extractPeaks` resamples to any coarser zoom level from cache. All zoom levels >= baseScale work without regeneration. Configurable: `new PeakPipeline(baseScale, bits)`.

## Key Patterns

- **Event-driven track loading** — `<daw-track>` dispatches `daw-track-connected` (bubbling, composed); `<daw-editor>` listens and loads audio for that track individually. Track removal uses MutationObserver (events from `disconnectedCallback` can't bubble since element is already detached).
- **Eager audio decode** — Audio fetches and decodes on track connect using `this.audioContext.decodeAudioData()` (works while suspended, pre-gesture). Waveforms render immediately without waiting for play.
- **Engine built lazily on first track load** — `PlaylistEngine` + `NativePlayoutAdapter` created when the first `_loadTrack` resolves (uses correct `sampleRate` from decoded audio). `engine.setTracks()` called as tracks load. `engine.init()` deferred to first `play()` (resumes AudioContext, requires user gesture).
- **Engine API note** — Initial track loading uses `engine.setTracks()`. Recording clip finalization uses `engine.updateTrack()` for incremental updates.
- **Immutable state updates** — All `@state()` Maps are replaced with `new Map(old).set(...)`, never mutated in place.
- **Derived width, not stored state** — `_totalWidth` is a getter derived from `_duration`, `effectiveSampleRate`, and `samplesPerPixel`. Not a `@state()` property — avoids Lit update loops from setting state in `updated()`.
- **Error events** — `daw-track-error` dispatched on load failure (with `{ trackId, error }`). `daw-error` dispatched on playback failure (with `{ operation, error }`). Failed fetch promises are removed from cache to allow retry.
- **Engine promise retry** — `_enginePromise` is cleared on rejection so `_ensureEngine()` can retry instead of caching a permanent failure.
- **Playhead latency compensation lives in the engine** — `_startPlayhead()` animates from `engine.getAudibleTime()` (raw − `outputLatency` − `lookAhead` while playing, held at play-start during the pre-roll window; Safari reports ~15ms outputLatency vs Chrome's ~3ms, Tone adapters add 0.1s lookAhead).
- **`_stopPlayhead()` displays raw time, storage stays raw** — Resting playhead shows `_currentTime` exactly (compensation is a playing-time concept; a seeked/stopped/paused cursor displays the commanded position). `_currentTime` is never display-adjusted, so the next `play()` resumes from the correct scheduling position.
- **Web worker peak generation** — `PeakPipeline` (in `workers/peakPipeline.ts`) generates `WaveformData` via inline Blob worker at the current `samplesPerPixel`, caches per `AudioBuffer` (WeakMap), extracts `PeakData` via `resample()`. Resampling only works to coarser (larger) scales — the cached base scale determines the finest renderable zoom. Per-channel peaks when `mono=false`; weighted-average mono merge when `mono=true`.

## Programmatic Track + Clip API

- **Imperative methods on `<daw-editor>`** — `editor.ready()` (build engine without tracks), `addTrack(config)`, `removeTrack(id)`, `updateTrack(id, partial)`, `addClip(trackId, config)`, `removeClip(trackId, clipId)`, `updateClip(trackId, clipId, partial)`. All thin wrappers around DOM mutation — they build `<daw-track>` / `<daw-clip>` elements and let the existing event pipeline handle loading. Both declarative DOM mutation and these methods feed the same `_loadTrack` / `_loadAndAppendClip` path.
- **`editor.tracks` returns `TrackWithId[]`** (`{ trackId, ...descriptor }`) — the public enumeration of trackId + name for EVERY track incl. element-less (drag-dropped / programmatic) ones. The only public way to map a name to the `trackId` the per-track-by-id APIs (`addTrackEffect`, `removeTrack`, `updateTrack`, …) are keyed by — the id is otherwise just the internal `_tracks` Map key.
- **Treat `editor.engine` as read-only from consumer code** — `engine.setTracks` directly works for rendering (peaks-sync reads `clip.audioBuffer`) but skips `_tracks` descriptor population, so `<daw-track-controls>` shows "Untitled" / default volume. Use the editor methods for mutation; reach into `engine` only for taps (`masterOutputNode`, analyzers).
- **DOM ↔ engine clip-id alignment** — `clip.id = clipDesc.clipId` in `_loadTrack` aligns engine clip ids with `<daw-clip>.clipId`. Required for `editor.removeClip(trackId, clipId)` lookups. `ClipDescriptor.clipId` is optional (file drops, recording-clip don't set it; engine auto-generates).
- **`<daw-clip>` lifecycle events** — `daw-clip-connected` (deferred via `setTimeout(0)`) and `daw-clip-update` (fires only after first render, on any reflected property change). Editor's `_onClipConnected` skips during initial track load (`_engineTracks` doesn't have the parent yet); late-append goes through `_loadAndAppendClip`.
- **Three load states for tracks** — (a) not connected (neither `_tracks` nor `_engineTracks` has the id), (b) connected but loading (`_tracks.has(id)` true, `_engineTracks.has(id)` false — `_loadTrack` is in flight), (c) fully loaded (both). Code that gates on `_engineTracks.has` alone treats (b) like (a); that's correct for many paths but wrong for true-late-append detection — check `_tracks.get(id)?.clips.some((c) => c.clipId === childId)` to filter out deferred events for pre-captured children.
- **`<daw-track>`/`<daw-clip>` deferred events are redundant for children captured by `_readTrackDescriptor`** — both elements `setTimeout(0)` their connected dispatch so the editor's listener registers first, but `_onTrackConnected` calls `_readTrackDescriptor` _synchronously_ which reads all `<daw-clip>` children at that moment. The deferred `daw-clip-connected` events that fire afterward for those same children are redundant — silent skip, don't warn.
- **Async helpers that populate per-clip caches must self-purge on their own failure** — `_finalizeAudioClip` inserts `_clipBuffers`/`_clipOffsets` BEFORE `await generatePeaks`. If generatePeaks rejects and the helper just rethrows, the caller's catch can't roll back because the auto-generated `clip.id` never escaped. Helper must wrap the await in try/catch and call `_purgeClipCaches(clip.id)` before rethrowing. The caller's catch can still purge whatever id it captured — `_purgeClipCaches` is idempotent.
- **Async per-iteration loops that mutate shared state need per-iteration try/catch** — `_loadTrack`'s loop over `descriptor.clips` pushes per-clip cache writes into `_clipBuffers`/`_clipOffsets`/`_peaksData`. With only an outer try/catch, clip N's failure aborts the loop and leaks clips 0..N-1's writes (since `engine.setTracks` is never reached). Wrap each iteration body to dispatch a per-item error event (e.g. `daw-clip-error`) and continue; if ALL items fail, escalate to a track-level error so the outer Promise rejects.
- **Discriminator name should not collide with sibling field names** — `ClipDescriptor` originally used `source: 'dom' | 'drop'` next to `src: string`; reading `clipDesc.source === 'dom'` and `clipDesc.src` on adjacent lines was a real readability hazard. Use `kind` for discriminators in this codebase.
- **3+ narrowing sites = type predicate** — when a discriminated-union check (`c.kind === 'dom' && c.clipId === ...`) appears at multiple call sites, extract `isDomClip(c): c is DomClipDescriptor` co-located with the type definition. Five sites was the threshold that paid for the helper in PR #383.

## Effects Chain (core, #417)

- **`src/effects/`** — `EffectsChainController` (ordered chain between owned input/output gains) + effect registry (`registerEffect`/`getEffectDefinitions`/`createEffectInstance`, five `native-*` built-ins) + `EffectsManager` (per-editor chain ownership/wiring/events).
- **WAM entries (#422)** — `addWamPlugin(url, initialState?)` on both elements (async). Dynamic-imports the optional `@dawcore/wam` peer (install-hint rethrow, midi-loader pattern), `ensureWamHost` → `createWamInstance` → chain entry `{kind:'wam', type:'wam', url, label: descriptor.name}` whose instance wraps the plugin's audioNode (input=output=node, `applyParams` → `setParameterValues` map, `dispose` → `plugin.destroy()`). All chain ops are kind-agnostic — remove destroys the worklet, bypass = disconnection (no wet param). Mock `@dawcore/wam` in tests with `vi.hoisted` + `vi.mock`; the missing-package path needs its own test FILE (a throwing `vi.mock` factory is file-scoped).
- **Faust entries (#430)** — `addFaustEffect(dspCode, {name?})` on both elements (async). Dynamic-imports the optional `@dawcore/faust` peer (same install-hint pattern), compiles BEFORE any chain work (a Faust error — diagnostics intact — leaves the chain untouched), then `ensureWamHost` → `createWamInstanceFromFactory(compiled.factory, …, {label: compiled.name})` → the shared `_insertWamPlugin` helper (also used by `_addWamToChain`). Entries are `kind:'wam'` with `source:{faust: dspCode}` and NO url; `daw-effect-add`/`daw-effect-error` details carry `source` instead of `url`. Persistence serializes `{kind:'wam', faustDsp, faustName: label, bypassed, state?}`; restore and offline export RECOMPILE (slow path, accepted); failed recompiles become placeholders that round-trip `faustDsp`. `validateSerializedEntries` accepts wam entries with `url` OR `faustDsp`. Tests mock `@dawcore/faust` like `@dawcore/wam` (`daw-editor-faust.test.ts`; missing-package file: `daw-editor-faust-missing.test.ts`).
- **Element API (#418; per-track-by-id #522)** — master-chain methods on `<daw-editor>` (`addEffect`/`removeEffect`/`setEffectParams`/`setEffectBypassed`/`moveEffect`/`effects`, plus `addWamPlugin`/`addFaustEffect`/`open`/`closeEffectGui`/`get`/`setEffectsState`). The SAME surface keyed by trackId also lives on `<daw-editor>` — `addTrackEffect`/`removeTrackEffect`/`setTrackEffectParams`/`setTrackEffectBypassed`/`moveTrackEffect`/`trackEffects`/`addTrackWamPlugin`/`addTrackFaustEffect`/`open`/`closeTrackEffectGui`/`get`/`setTrackEffectsState` — so element-less tracks (file-dropped, programmatic) get their own chain. `<daw-track>` element methods are thin sugar over these (`track.addEffect(t)` === `editor.addTrackEffect(track.trackId, t)`); the structural `TrackEffectsDelegate` in daw-track.ts mirrors that PUBLIC surface (NO more `_track*` internals — removed #522; avoids a value-import cycle). Per-track `daw-effect-*` events dispatch from the `<daw-track>` element when one exists (resolved via `_trackEventTarget(trackId)`), else from the editor; master events from the editor. Typed in `DawEventMap`.
- **Effect GUIs (#423)** — `openEffectGui(effectId, container)`/`closeEffectGui(effectId)` on both elements (track delegates to the editor's public `openTrackEffectGui`/`closeTrackEffectGui`). Host-agnostic: the consumer provides the container. GUI lifecycle lives in `EffectsManager` (`_guis` cache + `_guiPending` in-flight dedup, keyed by globally-unique effectId): **lazy create on first open, close = detach-but-cache (reopen remounts the same element), destroyGui only on removal** (`_runOp` remove / `disposeTrackChain` / `disposeAll` — destroy GUIs from `chain.entries` BEFORE `chain.dispose()`). WAM entries carry optional `createGui`/`destroyGui`/`getParameterInfo` on the `EffectInstance` closure; `EffectsChainController.getEntry(effectId)` exposes the live entry (incl. instance) to the manager. Fallback when no `createGui` (or it throws, or `kind:'native'`): the generic panel from `@dawcore/wam` (dynamic import, install-hint rethrow via shared `_loadWamModule(feature)`) — native entries map the registry definition's `params` + current values, WAM entries proxy `getParameterInfo`; **panel edits route through `_runOp setParams`** so they hit applyParams→setParameterValues AND dispatch `daw-effect-change` like API edits. An effect removed while its GUI is mid-create: the open rejects and the late GUI is destroyed (post-await re-check of `chain.getEntry`). Error placeholders refuse to open. Close on a never-opened id warns, never throws.
- **Persistence (#424)** — `getEffectsState()`/`setEffectsState()` on both elements. `SerializedEffectEntry` union (native: type+params+bypassed; wam: url+bypassed+state). Restore is sequential (order survives async WAM loads); a failed WAM url becomes a **bypassed passthrough placeholder** at its position carrying `error` + `placeholder: {state, bypassed}` so re-serialization round-trips the saved state — `daw-effect-error` fires, restore continues. `setEffectsState` validates the whole array BEFORE clearing the chain.
- **Offline export (#426)** — `editor.exportAudio({sampleRate?, startTime?, duration?, channels?})` renders through all chains on an `OfflineAudioContext`. No Transport involved: clips are scheduled statically (`source.start(when, offset, duration)` with window clamping at both edges). Chains rebuild from their PERSISTED form (getEffectsState): natives via the registry (BaseAudioContext definitions), WAM via `ensureWamHost(offlineCtx)` + re-instantiation with saved state — worklets are context-bound (wam-studio cloneInto pattern; `cloneInstanceInto` in @dawcore/wam). All offline plugin instances destroyed in `finally`. Bypass parity: wet-zeroed natives created with wet 0; disconnect-bypassed entries (incl. bypassed WAM + placeholders) skipped. Clip fades are NOT rendered — parity with native ClipPlayer, which doesn't apply them either. Logic in `interactions/export-audio.ts` (ExportAudioHost interface); the editor method is a thin wrapper.
- **Wiring** — chains are created lazily on first addEffect and wired via the adapter transport's hooks: track chains `connectTrackOutput(trackId, chain.input)` + `chain.output → masterOutputNode`; master chain `connectMasterOutput(chain.input)` + `chain.output → ctx.destination`. Adapters without `transport.connectTrackOutput` get a clear throw. **Transport `setTracks` rebuilds TrackNodes and severs hookups** — the editor's statechange handler calls `rewireTrackChains()` on every `tracksVersion` bump. Track removal → `disposeTrackChain`; editor disconnect → `disposeAll`.
- **Entries are kind-agnostic** — chain operations never branch on `kind` (`'native' | 'wam' | ...`). New plugin standards wrap their node into `EffectChainItem` and get move/remove/bypass/events for free.
- **Topology rebuilds, params never** — `setParams` calls the instance's `applyParams` in place. Rebuilds sever ONLY the chain's own outgoing edges (`input.disconnect()` + each entry's `output.disconnect()`) — never the consumer's edges into `input` / out of `output`.
- **Bypass is two-mode** — definitions with `wetParam` bypass by zeroing wet (stored/restored, no rebuild); others are removed from the series with the instance kept alive at its position. `setParams` on a bypassed wet effect stores the new wet without making it audible.
- **Registry definitions take `BaseAudioContext`** — same definitions must serve offline rendering (#426). Don't add `AudioContext`-only API usage to built-ins.
- **Registry tests** — call `_resetEffectRegistryForTests()` in `beforeEach` (module-level Map; built-ins re-registered). Test-only helpers are exported from their module but NOT from `src/index.ts`.

## CSS Theming

Custom properties on `<daw-editor>` or any ancestor, inherited through Shadow DOM:

- `--daw-wave-color` (default: `#c49a6c`)
- `--daw-playhead-color` (default: `#d08070`)
- `--daw-background` (default: `#1a1a2e`)
- `--daw-track-background` (default: `#16213e`)
- `--daw-ruler-color` / `--daw-ruler-background`
- `--daw-controls-background` / `--daw-controls-text`
- `--daw-selection-color`, `--daw-clip-header-background`, `--daw-clip-header-text`
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

- `peak-rendering.ts` — `aggregatePeaks`, `calculateBarRects`, `calculateFirstBarPosition` (from `ui-components`)
- `smart-scale.ts` — `getScaleInfo`, `computeTemporalTicks` (extracted from `SmartScale.tsx`, temporal mode only)
- `time-format.ts` — `formatTime` for ruler labels

## Interaction Patterns

- **Seek during playback requires stop+play** — Must call `engine.stop()` then `engine.play(newTime)` and restart playhead animation.
- **Stop returns to play start position** — Standard DAW behavior. Engine tracks `_playStartPosition`; read `engine.getCurrentTime()` in the `stop` event handler, not `_currentTime`.
- **Pointer events, not click** — Use `pointerdown`/`pointermove`/`pointerup` with 3px activation threshold to distinguish click (seek) from drag (selection). Wrap `releasePointerCapture` in try-catch; use `finally` to reset `_isDragging`.
- **No scrollLeft in pointer math** — `.scroll-area` owns horizontal scroll; `.timeline` is wider. `getBoundingClientRect().left` on `.timeline` already reflects scroll (goes negative when scrolled right), so `clientX - rect.left` gives the correct pixel. Do NOT add `scrollLeft`.
- **Track hit detection via Y position** — `composedPath()[0].closest('.track-row')` can't cross Shadow DOM boundaries. Use `getBoundingClientRect()` on track rows and compare `e.clientY` instead.
- **File type detection** — `file.type` can be empty string for valid audio (`.opus` on some browsers). Only reject files with explicitly non-audio MIME types: `if (file.type && !file.type.startsWith('audio/'))`.
- **`loadFiles()` returns result** — Returns `{ loaded: string[], failed: Array<{ file, error }> }` so callers can detect partial failures. Individual file errors are caught and reported via `daw-files-load-error` events.
- **sampleRate comes from decoded audio** — Always use `audioBuffer.sampleRate` for clip creation. The global AudioContext decodes at the hardware rate (may be 44100 or 48000). Set `this.sampleRate` from the first decoded buffer so the ruler, peaks, and engine all agree.
- **Use `this.audioContext` for decode** — The editor's native AudioContext. `decodeAudioData` works while suspended (pre-gesture).
- **Pointer interactions extracted** — `interactions/pointer-handler.ts` handles pointerdown/move/up, caches timeline ref and rect, distinguishes click vs drag. The host implements `PointerHandlerHost` interface.
- **Peak pipeline extracted** — `workers/peakPipeline.ts` manages worker lifecycle, WaveformData cache, inflight dedup.
- **Prevent native drag on interactive elements** — `<daw-editor>` has `@dragover`/`@drop` for file drops, which activates the browser's drag-and-drop system. Clip headers and boundaries need `e.preventDefault()` on `pointerdown` (in pointer-handler delegation), `-webkit-user-drag: none` and `user-select: none` in CSS to prevent the browser from stealing pointer events during custom drag operations.

## Clip Interactions

- **`ClipPointerHandler`** in `interactions/clip-pointer-handler.ts` — handles move/trim drag. `ClipEngineContract` is a narrow interface (`moveClip`, `trimClip`, `updateTrack`). `ClipPointerHost` interface satisfied by `<daw-editor>` via getters.
- **Hit detection uses `closest()`** — `composedPath()[0]` returns the deepest element (e.g., `<span>` inside `.clip-header`). Always use `target.closest('.clip-header')` / `target.closest('.clip-boundary')` to walk up.
- **Move: incremental deltas with `skipAdapter`** — `engine.moveClip(id, clipId, delta, true)` skips adapter during drag (60fps). Call `engine.updateTrack(trackId)` once on `pointerup` to sync the transport.
- **Trim: cumulative delta on drop only** — Engine's `constrainBoundaryTrim` checks constraints against current clip state, so incremental deltas compound incorrectly. Accumulate total delta during drag, call `engine.trimClip()` once on `pointerup`.
- **Trim visual feedback** — Imperatively update `.clip-container` CSS (`left`/`width`) during drag. Restore original CSS before engine applies.
- **`splitAtPlayhead()`** in `interactions/split-handler.ts` — discovers new clip IDs by diffing `engine.getState().tracks` before/after `engine.splitClip()` (returns void). Requires exactly 2 new IDs.
- **`_syncPeaksForChangedClips`** — Called in statechange handler when `tracksVersion` changes. Regenerates peaks for clips with new IDs (split) or changed `offsetSamples`/`durationSamples` (trim). Without this, split clips have no waveform and trimmed clips show wrong audio portion.
- **`cleanupOrphanedClipData`** — Called by `syncPeaksForChangedClips` to remove entries from `_clipBuffers`, `_clipOffsets`, `_peaksData` for clip IDs no longer in any track. Prevents memory leaks after split (original clip ID becomes orphaned).
- **Trim peak re-extraction** — During trim drag, call `host.reextractClipPeaks()` to synchronously re-slice peaks from cached WaveformData at the new offset/duration. When peaks are available, set waveforms to `left:0` (peaks cover full new bounds). Fall back to `-deltaPx` shift only when cache unavailable.
- **Statechange syncs `_engineTracks`** — Rebuild the `_engineTracks` Map from engine state when EITHER `tracksVersion` (structural) OR `mixerVersion` (per-track volume/mute/solo/pan, #501) changes, so live mixer state survives a later `setTracks` rebuild. The expensive structural work (`rewireTrackChains`, `syncPeaksForChangedClips`) runs ONLY on `tracksVersion` changes — never on mixer-only changes, which fire per-frame during slider drags. This is also how `moveClip`/`trimClip`/`splitClip` trigger Lit re-renders.
- **`DRAG_THRESHOLD`** — Shared constant in `interactions/constants.ts` (3px, click vs drag). Boundary width (8px) is CSS-only in `styles/theme.ts` (CSS can't import JS constants).
- **`<daw-keyboard-shortcuts>` element** — Render-less child of `<daw-editor>`. Uses `closest('daw-editor')` for parent resolution (light DOM, not shadow). Boolean attributes for presets (`playback`, `splitting`, `undo`). JS properties for remapping (`playbackShortcuts`, `splittingShortcuts`, `undoShortcuts`) and custom shortcuts (`customShortcuts`). Listener on `document`. Uses `handleKeyboardEvent` from `@waveform-playlist/core`.
- **Split pre-flight check** — `splitAtPlayhead` calls `canSplitAtTime` before stopping playback. Without this, pressing S with no track selected interrupts audio for a no-op.
- **`engine.constrainTrimDelta()`** — Wraps the engine's `constrainBoundaryTrim` pure function. Call during trim drag for per-frame collision detection (timeline bounds, audio bounds, neighbor overlap, min duration). Don't manually clamp — use the engine's constraints so visual preview matches what's applied on drop.
- **Drag transactions for undo** — `beginTransaction()` at drag start (`_beginDrag`), `commitTransaction()` in `finally` of `onPointerUp`. Groups all per-frame `moveClip`/`trimClip` calls into one undo step. Without this, a 1-second drag creates 60 individual undo steps.
- **`ClipPointerHandler.tryHandle` return convention** — `true` = event consumed (no further handlers run, no native default); `false` = pass-through to the next handler in the chain. Guard branches that _intentionally_ do nothing (e.g. trim guard on MIDI clips) must return `true` to consume the event — returning `false` falls through to the timeline seek handler and moves the playhead unexpectedly.
- **Undo/redo keyboard shortcuts** — Cmd/Ctrl+Z (undo), Cmd/Ctrl+Shift+Z (redo) when `<daw-keyboard-shortcuts undo>` is present. Auto-expands to both Ctrl and Meta variants when no specific modifier is provided. Uses `=== undefined` checks (not falsy) to distinguish "not specified" from "explicitly false".
- **Peaks-First Rendering** — When `peaks-src` is set, `_loadTrack` awaits the `.dat` file first (small, fast), creates a clip via `createClipFromSeconds({ waveformData, ... })` (no `audioBuffer`), extracts peaks, and renders a preview track immediately. Audio decode runs in the background; on completion, `clip.audioBuffer` is backfilled and the clip is added to `_clipBuffers`. WaveformData is cached in `PeakPipeline` via `cacheWaveformData(audioBuffer, waveformData)` so all downstream paths (zoom, split/trim) skip the worker. If `.dat` loading fails, falls through to the standard audio-first path. If audio decode fails after peaks render, preview state is cleaned up (peaks, engineTracks, clipOffsets, zoom floor) before dispatching `daw-track-error`. `_peaksCache` (`Map<string, Promise<WaveformData>>`) deduplicates in-flight and repeated fetches for the same `.dat`/`.json` URL, mirroring `_audioCache`. Cleared in `disconnectedCallback`; deleted on rejection to allow retry.
- **`samplesPerPixel` Zoom Floor via `noAccessor`** — `samplesPerPixel` uses `@property({ noAccessor: true })` with a custom getter/setter that clamps to `_minSamplesPerPixel` synchronously and rejects NaN/Infinity/zero/negative. `_minSamplesPerPixel` lifecycle: set only after successful `extractPeaks` in `_loadTrack` (not before — avoids restricting zoom on failure), recomputed via `_peakPipeline.getMaxCachedScale()` on track removal, reset to 0 on `disconnectedCallback`.
- **`sample-rate` Attribute** — `<daw-editor sample-rate="48000">` creates the native AudioContext at that rate. Warns if the browser doesn't honor the requested rate. Pre-computed `.dat` peaks must match the AudioContext's actual rate.

## Typed Events

- **`DawEventMap`** in `src/events.ts` — all custom events with typed details. Use `new CustomEvent<DetailType>(...)` at dispatch sites.
- **`daw-track-removed`** (detail `{ trackId }`) — outbound removal notification, symmetric with `daw-track-ready`. Dispatched from `_onTrackRemoved` ONLY when `existed && this.isConnected`: capture `existed = this._tracks.has(trackId)` at the TOP (cleanup mutates `_tracks` before the dispatch), and gate on `isConnected` per pattern #36 (reachable on a detached editor via `removeTrack`'s element-less branch). The MutationObserver calls `_onTrackRemoved` even for a `<daw-track>` removed before its deferred `daw-track-connected` ran (never registered) — exactly what the `existed` gate filters.
- **`LoadFilesResult`** — named return type for `loadFiles()`, exported from index.
- **`PointerEngineContract`** in `interactions/pointer-handler.ts` — narrow engine interface (5 methods). `PointerHandlerHost._engine` uses this, not `PlaylistEngine` directly.
- Always dispatch `daw-track-select` event on both engine and no-engine paths.

## Sample Rate

- `sampleRate` is a derived getter reading from `adapter.audioContext.sampleRate` (fallback 48000). `_resolvedSampleRate` is set from decoded audio.
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
- **Controls outside the scroll container** — fixed-width `.controls-viewport` (180px, `--daw-controls-width`, `overflow: hidden`) wraps `.controls-column`, which mirrors `.scroll-area`'s `scrollTop` via transform. Controls stay pinned horizontally while waveforms scroll x, and stay row-locked while the editor scrolls y.
- **Direct engine forwarding** — `daw-track-control` handler updates `_tracks` descriptor AND forwards to engine directly. Does not go through `<daw-track>` DOM element roundtrip (file-dropped tracks have no DOM element).
- **Track ID alignment** — `createTrack()` generates its own `id`. Must set `track.id = trackId` after creation so `engine.setTrackSolo/Mute/Volume/Pan(trackId, ...)` can find the track. Applied in both `_loadTrack` and `file-loader.ts`.

## File Loader Extraction

- **`interactions/file-loader.ts`** — `loadFiles()` extracted via `FileLoaderHost` interface to keep editor under 800 lines.
- **`src/types.ts`** — `TrackDescriptor` and `ClipDescriptor` interfaces, shared by `daw-editor.ts` and `file-loader.ts`. Re-exported from `index.ts`.
- **Non-private fields** — Fields accessed by the loader (`_tracks`, `_engineTracks`, `_peaksData`, `_clipBuffers`, `_clipOffsets`, `_audioCache`, `_peakPipeline`, `_resolvedSampleRate`, `_fetchAndDecode`, `_recomputeDuration`, `_ensureEngine`) are non-private (no `private` keyword, `_` prefix convention only).
- **Per-clip Map cleanup** — Any `Map` keyed by clip ID (`_clipBuffers`, `_clipOffsets`, `_peaksData`) must be cleaned in `_onTrackRemoved`. When adding a new per-clip Map, add the corresponding `.delete(clip.id)` in the removal loop.

## Empty State

- Hide playhead, selection, and ruler when `orderedTracks.length === 0`
- Timeline width: `100%` when empty (not hardcoded pixels) for full-width dropzone
- `.scroll-area` has `min-height: var(--daw-min-height, 200px)` for visible empty dropzone
- **`indefinite-playback` attribute** — when set, `_totalWidth` floors at `_viewport.containerWidth` so the ruler renders the visible viewport even with no clips. `daw-ruler` covers `max(naturalDuration, totalWidthDerivedDuration)` so it doesn't shrink when a short clip is added. Editor renders an empty controls-column placeholder so the timeline doesn't shift right when the first track loads. `ViewportController` has a `ResizeObserver` for window-resize support.

## Lit/TypeScript Requirements

- `experimentalDecorators: true` and `useDefineForClassFields: false` in tsconfig — required for Lit's `@property` and `@customElement` decorators
- Light DOM elements override `createRenderRoot()` to return `this`
- `<daw-track>` defers `daw-track-connected` dispatch via `setTimeout(, 0)` so the editor's `connectedCallback` (which registers listeners) has time to run

## Beats & Bars Grid Mode

- **`scale-mode="beats"` on `<daw-editor>`** — Tick-linear x-axis where a quarter note is always the same width regardless of tempo. Zoom = `ticksPerPixel` (not `samplesPerPixel`).
- **`_renderSpp` getter** — In beats mode, derives `samplesPerPixel` from `ticksPerPixel`: `(60 * sampleRate * ticksPerPixel) / (ppqn * bpm)`. ALL rendering paths (clip positions, peak generation, trim visual feedback, peak sync) must use `_renderSpp`, never raw `samplesPerPixel`. Missing this causes coordinate mismatches (playhead racing ahead, coarse waveforms after trim, etc.).
- **Three-tier tick hierarchy** — `major` (bars: always labeled, grid lines at 10%), `minor` (beats: labeled when ≥60px, grid lines at 6%), `minorMinor` (subdivisions: ruler ticks only, no grid lines). Types in `@waveform-playlist/core` as `TickType`.
- **Snap absolute position, not delta** — `snapTickToGrid` must snap the clip's absolute target position to the grid, not the drag delta. Delta-snapping preserves off-grid offsets permanently. `_snapDeltaToSamples(deltaPx, anchorSample)` takes the anchor (startSample for move/left-trim, startSample+durationSamples for right-trim).
- **`<daw-grid>` element** — Shadow DOM, chunked 1000px canvases (same pattern as `<daw-waveform>`). Positioned behind tracks via `z-index: 0` inside `.timeline` at `top: 0` (the ruler lives in the header band, so it no longer offsets the grid). Track rows go transparent via `:host([scale-mode="beats"]) .track-row { background: transparent }`. Grid height is the plain sum of `trackHeight`s — no border compensation.
- **Vite pre-bundles Tone.js** — Even though dawcore has no Tone.js dependency, Vite's dep scanner finds it in the workspace `node_modules`. `optimizeDeps.exclude: ['tone']` in `examples/dawcore-native/vite.config.ts` prevents loading.
- **Clip pixel positions from tick space, not samples** — In beats mode, use `clip.startTick / ticksPerPixel` directly when `startTick` is available. Fall back to `startSample → seconds → ticks → ticks/ticksPerPixel` for clips without `startTick`. Never use `startSample / _renderSpp` — the sample round-trip introduces 1-2px quantization error and drifts when BPM changes. Same applies to trim visual feedback `deltaPx`. Temporal mode still uses `startSample / samplesPerPixel`.
- **Validated numeric properties — project standard** — Any numeric `@property` used as a divisor or with a constrained range uses `@property({ noAccessor: true })` + custom getter/setter that rejects out-of-range values with a `console.warn`. Editor: `samplesPerPixel`, `bpm`, `ppqn`, `ticksPerPixel`. Data elements: `<daw-clip>.midiChannel` (0-15), `<daw-clip>.midiProgram` (0-127). Visual elements: `<daw-piano-roll>.samplesPerPixel` and `sampleRate` (>0). Without these, division-by-zero cascades silently through render math (e.g., `_renderSpp`, `_totalWidth`, the snap pipeline, the piano-roll draw loop) and out-of-range MIDI values produce invisible-but-not-rejected notes. `computeMusicalTicks` and `snapTickToGrid` also have internal guards returning empty/passthrough for zero inputs.
- **`_renderSpp` uses `Math.ceil`** — The derived value can be non-integer at non-standard BPM. `WaveformData.resample()` uses integer scale math, so rounding up prevents fractional scale issues.
- **Clip backgrounds are beats-mode only** — Opaque `.clip-container` backgrounds (so grid stripes show through gaps) are scoped via `:host([scale-mode='beats']) .clip-container` in `daw-editor.ts` CSS, NOT in `theme.ts` (which applies globally). Putting them in `theme.ts` breaks temporal mode dev pages. Selected track clips get a green tint via `box-shadow: inset 0 0 0 1000px rgba(99, 199, 95, 0.06)`.

## Variable Tempo

- **Callback interface, not TempoMap dependency** — `secondsToTicks`/`ticksToSeconds` optional function properties on `<daw-editor>`. Keeps dawcore decoupled from the transport package. Consumers with a different playout engine provide their own conversion functions. When callbacks are absent, falls back to single-BPM math.
- **Per-segment waveform rendering** — In beats mode with callbacks, clips are iterated in fine tick steps (~80 ticks). Each step is converted to audio time via callbacks, then peaks are extracted for that sample range into the corresponding pixel range. Uses base-scale (128) peaks directly — no BPM-dependent intermediate resampling.
- **Beat-map clip positioning** — Use `beatBpm` uniformly from tick 0 (no "gap BPM"). Shift the clip's `startTick` forward so beat 1 in the audio aligns with the next bar boundary. Formula: `clipStartTick = firstDownbeatTick - naturalFirstBeatTick` where `naturalFirstBeatTick = round(beats[0].time * ppqn * beatBpm / 60)`. Gives the metronome a natural tempo throughout. **The lead-in bar length must come from the first DECLARED bar** (distance between the first two `beat === 1` entries, falling back to 4/4) — the warp-markers `gridPlanFromBeats` convention. Hardcoding 4/4 while `detectMeterChanges` declares the real meter from tick 0 pushes a 2/4 song's first downbeat to bar 3 (two 2/4 bars fit inside one 4/4 lead-in bar).
- **`editor.bpm` is display-only when tick callbacks are set** — with both `secondsToTicks`/`ticksToSeconds` provided, the setter and `_buildEngine` skip engine/adapter tempo forwarding entirely (the external tempo map is authoritative — #407). Without callbacks, `editor.bpm` forwards to `engine.setTempo` → `adapter.setTempo(bpm, undefined)` — a defaulted call, subject to the transport's multi-entry guard (refused with a warn when a curve is installed; the engine keeps its prior bpm on refusal). Caveat: in callbacks mode the engine's fallback bpm and `engine.getState().bpm` freeze at their build-time value — the fallback only matters for a custom adapter lacking `ticksToSeconds`/`secondsToTicks` (NativePlayoutAdapter implements both). Removing the callbacks does NOT clear the transport's tempo map — call `transport.clearTempos()` before reverting to fixed-bpm mode. Diagnostic for off-grid beats: constant per-beat offset = pre-roll tempo wrong (check `transport.getTempo(0)`); growing offset = per-beat entries wrong.
- **Single transport — no standalone Transport in demos** — Demo pages that use `<daw-editor>` must use `adapter.transport` (for `NativePlayoutAdapter`), not create their own `new Transport()`. Two transports cause metronome/seek desync. The transport is available immediately after the adapter is created — no need to wait for tracks.
- **`editor.meterEntries` for multi-meter grids** — Set `editor.meterEntries` (from `detectMeterChanges`) so the grid renders correct bar widths. Without this, the grid uses the editor's `timeSignature` (single meter) while the Transport's MeterMap has the real meters — grid and metronome disagree.

## MIDI (Tone Adapter Path)

- **`<daw-piano-roll>`** — Visual element for note rendering. Shadow DOM, chunked canvas (1000px chunks), mirrors `<daw-waveform>` (`getVisibleChunkIndices`, virtual scroll). Auto-fits pitch range to actual notes ± 1, velocity → opacity (0.3-1.0), 2px min note width/height, 1px rounded rect. Reads `--daw-piano-roll-note-color` / `--daw-piano-roll-selected-note-color` / `--daw-piano-roll-background` CSS custom props at draw time.
- **MIDI discriminator system-wide:** a clip is MIDI iff `clip.midiNotes != null`. Matches `TonePlayoutAdapter`'s rule (`packages/playout/src/TonePlayoutAdapter.ts:50-51`). `<daw-track render-mode="piano-roll">` is a _visual_ concern only; content type is per-clip.
- **`_loadTrack` MIDI branch** — Clips with no `src` route to `_buildMidiClip`, which always returns a clip (1-second placeholder span when no notes / no duration) so late note arrivals via `daw-clip-update` can find the clip in `_engineTracks`. Skips fetch / decode / peaks / `_clipBuffers` / `_peaksData` / `_clipOffsets`.
- **`_applyClipUpdate` MIDI branch** — When `midiNotes` / `midiChannel` / `midiProgram` change after track load, the engine clip is rebuilt and `_commitTrackChange` is called. Discriminator: `clipEl.midiNotes != null || oldClip.midiNotes !== undefined` (handles both placeholder upgrade and audio→MIDI transition). Purges per-clip caches before commit so audio→MIDI transitions don't leave stale peaks.
- **`syncPeaksForChangedClips` filter** — Editor filters out tracks with `renderMode === 'piano-roll'` before calling the peaks-sync helper. Without this, MIDI tracks log a "no AudioBuffer" warning on every statechange.
- **`addTrack({ midi: { notes, channel?, program? } })`** — Sugar. Creates a single `<daw-clip>` with `midiNotes` set + sets `render-mode="piano-roll"` on the track. Explicit `renderMode` overrides the midi-inferred default.
- **MIDI clip mutations are guarded** — Trim handles inert (`ClipPointerHost.isMidiClip(trackId, clipId)` returns true → boundary handler bails before `_beginDrag`). `canSplitAtTime` returns false when `clip.midiNotes != null`. Note-array slicing is a follow-up PR in `@waveform-playlist/engine`. Move drag (only changes `startSample`) is allowed.
- **Theming** — `--daw-piano-roll-note-color` (default `#2a7070`), `--daw-piano-roll-selected-note-color` (default `#3d9e9e`), `--daw-piano-roll-background` (default `#1a1a2e`) on `<daw-editor>` (or any ancestor — CSS custom props inherit through Shadow DOM).
- **No native MIDI playback yet** — Native `Transport` / `ClipPlayer` schedule audio buffers only. MIDI playback requires `TonePlayoutAdapter` (which uses `MidiToneTrack` PolySynth or `SoundFontToneTrack` based on whether `soundFontCache` is provided). Consumers of `NativePlayoutAdapter` see piano-roll rendering but silent playback for MIDI clips.
- **`TrackRenderMode` shared type** — Now a re-export alias for `RenderMode` from `@waveform-playlist/core` (`'waveform' | 'spectrogram' | 'both' | 'piano-roll'`). Lives in `packages/dawcore/src/types.ts`, re-exported from `packages/dawcore/src/index.ts` for backward compatibility; new code should prefer `RenderMode` directly. Used by `TrackDescriptor.renderMode`, `TrackConfig.renderMode?`, and `DawTrackElement.renderMode` to prevent drift. dawcore warns + falls back to `'spectrogram'` for the `'both'` variant until the both-mode renderer ships.
- **Demo:** `examples/dawcore-tone/midi.html` — programmatic C major scale, no SoundFont, exercises `editor.addTrack({ midi })` end to end.
- **Read-only classification queries belong on `ClipPointerHost`, not `ClipEngineContract`** — `ClipEngineContract` is a narrow stateless mutation contract (`moveClip`, `trimClip`, etc.). Whether a clip is MIDI is a read-only classification that requires traversing track state. Add such methods (e.g. `isMidiClip(trackId, clipId)`) to the host interface and implement them on `<daw-editor>`. The host is dawcore-internal; only `<daw-editor>` implements it, so requiring the new method (not optional) is safe and prevents silent-pass-through bugs.
- **MIDI clip late-append is unsupported** — `_loadAndAppendClip` (the late-append path triggered by `daw-clip-connected` after the parent track is loaded) only handles audio clips (early-return on `!src`). Late-appended `<daw-clip>` elements with `midiNotes` set silently do nothing. Workarounds: include the MIDI clip in the initial `<daw-track>` markup, or use `editor.addTrack({ midi })` (which goes through `_loadTrack`'s MIDI branch on initial load).
- **`editor.loadMidi(source, options)`** — imperative `.mid` file loader. Source is `string` (URL) or `File`. Options: `startTime` (seconds, applied to every created clip), `signal` (forwarded to fetch). Returns `{ trackIds, bpm, timeSignature, duration, name }`. Implementation in `interactions/midi-loader.ts`; dynamic-imports the optional `@dawcore/midi` peer dep on first call (throws with install hint if missing).
- **Cleanup-on-failure** — `loadMidi` uses `Promise.allSettled` (not `Promise.all`) so it can wait for every per-track settlement before deciding. If any track rejects, every `<daw-track>` appended during the call (both successful AND elements `addTrack` left in the DOM before rejecting) is removed via `.remove()`, which triggers the editor's MutationObserver. Loader awaits a microtask after the cleanup loop so the observer's `_onTrackRemoved` cascade flushes before rethrow. Don't switch to `Promise.all` "for speed" — early rejection while other addTrack calls keep running causes orphan tracks to appear after cleanup. The `allSettled` wait is essential.
- **`MidiLoaderHost` requires `querySelectorAll`** — needed for the cleanup-on-failure snapshot/diff pattern: `addTrack` appends `<daw-track>` synchronously THEN rejects (when `_loadTrack` fires `daw-track-error`), so the rejected element isn't in the `addTrack` promise's resolution value. The loader snapshots existing `<daw-track>` children before `Promise.allSettled`, then removes every track that wasn't in the snapshot — covers both succeeded and `addTrack`-rejected elements.
- **`addTrack` does not yet accept an AbortSignal** — `loadMidi`'s `signal` option only cancels the fetch phase. An abort after parsing is a no-op until `addTrack` is signal-aware. Documented limitation.

## Stop Button Must Await `stopRecording` Before `editor.stop()`

`daw-stop-button` chains: `target.stopRecording().then(() => target.stop())`. Calling them in parallel breaks the worklet's terminal `done` round-trip — `engine.stop()` can pause the audio thread mid-handshake, so the worklet's done message never gets delivered through. Symptom: stop-timeout warning that's hard to attribute.

## `<daw-keyboard-shortcuts>` Must Be Inside `<daw-editor>`

Resolves its parent via `closest('daw-editor')`. Placing it as a sibling (e.g. inside `<daw-transport>`) silently fails — runtime warns "Preset shortcuts will be inactive; only customShortcuts will fire." Easy to miss because transport buttons in `<daw-transport>` work via id-based lookup, suggesting both should.

## Pause/Resume Event Bus for Multi-Source State Sync

`RecordingController` dispatches `daw-recording-pause` / `daw-recording-resume` so any UI element can sync its visual state when _anything_ triggers a pause toggle (button click, spacebar shortcut, programmatic call). `daw-pause-button` listens to these for its `data-paused` attribute. Add to this pattern when introducing new pause-aware UI.

## `editor.togglePauseRecording()` Is the Unified Pause Toggle

Audacity-style: pauses both worklet capture and (only when running) the playback Transport. Tracks `_wasPlayingDuringRecording` so resume restarts Transport only for overdub sessions. Both `togglePlayPause()` (spacebar) and `daw-pause-button` delegate to this — never duplicate the toggle logic in new UI; route everything through it.

## Spectrogram

- **`render-mode="spectrogram"`** — one of the `RenderMode` variants (`'waveform' | 'spectrogram' | 'both' | 'piano-roll'`) shared with core via the `TrackRenderMode` alias (see the `TrackRenderMode` bullet earlier in this file). `<daw-track render-mode="spectrogram">` switches that track's rendering branch in `<daw-editor>`'s template to emit one `<daw-spectrogram>` per channel instead of `<daw-waveform>`. `'both'` currently warns + falls back to `'spectrogram'`.
- **`<daw-spectrogram>`** — Shadow DOM, 1000px chunked canvases. Each canvas is transferred via `transferControlToOffscreen()` and handed up to the editor via `editor._spectrogramRegisterCanvas(...)`. Lives inside the editor's shadow root; uses `getRootNode().host` to find the editor (see "Elements Inside `<daw-editor>`'s Shadow DOM Use `getRootNode().host`, Not `closest()`" later in this file for the rationale).
- **`SpectrogramController`** — Lit reactive controller on `<daw-editor>`. Built lazily on first `registerCanvas`; disposed when no spectrogram tracks remain (`_disposeSpectrogramControllerIfEmpty`). Holds editor-level defaults + per-track overrides separately and merges them down to one `(config, colorMap)` pair for the orchestrator (v1 limitation: orchestrator accepts a single config/colorMap at a time; first track override wins).
- **`editor.spectrogramConfig` + `editor.spectrogramColorMap`** — editor-level defaults. Separate properties because `ColorMapValue` is not a field on `SpectrogramConfig`. Both setters forward to the controller and `requestUpdate()`.
- **`track.spectrogramConfig`** (on `<daw-track>`) — per-track override. Reflected through `daw-track-update` like the other track props.
- **`daw-spectrogram-ready` event** — fired (bubbles + composed) when the viewport tier completes for a track. Re-dispatched from the orchestrator's `viewport-ready` by the controller. Typed in `DawEventMap`.
- **`_maybeRegisterSpectrogramClipAudio(trackId, clip)` reads `clip.audioBuffer` directly** — see "Read `clip.audioBuffer` Directly in Helpers Called During Concurrent Track Loading" later in this file for the full rationale.
- **Worker URL** — `new URL('@dawcore/spectrogram/worker/spectrogram.worker', import.meta.url)` inside `_ensureSpectrogramController`. Bundler must support package-relative URL resolution (Vite does).

## Elements Inside `<daw-editor>`'s Shadow DOM Use `getRootNode().host`, Not `closest()`

`closest(selector)` does NOT cross shadow boundaries. Elements rendered inside `<daw-editor>`'s shadow root (e.g. `<daw-spectrogram>`, `<daw-waveform>`, `<daw-piano-roll>`) cannot find the editor via `this.closest('daw-editor')` — it returns `null`. Use `(this.getRootNode() as ShadowRoot).host`, optionally falling back to `host.closest('daw-editor')` for deeper shadow nesting. `<daw-spectrogram>._findHostEditor()` is the reference implementation. Light-DOM children of `<daw-editor>` (like `<daw-keyboard-shortcuts>`) CAN use `closest('daw-editor')` since they're not inside a shadow root.

## Read `clip.audioBuffer` Directly in Helpers Called During Concurrent Track Loading

`cleanupOrphanedClipData` (in `syncPeaksForChangedClips`, called from the engine `statechange` handler) MUTATES `_clipBuffers` in-place on every `tracksVersion` bump. During concurrent `_loadTrack` invocations, it can briefly clear `_clipBuffers` entries for tracks the engine hasn't seen yet — so a sibling track's helper reads `undefined` for its own clip even though `_clipBuffers.set` ran moments earlier. The clip object itself holds a stable AudioBuffer reference; prefer `clip.audioBuffer ?? this._clipBuffers.get(clip.id)`. `_maybeRegisterSpectrogramClipAudio` is the reference. The bug surfaces as "only the first track's helper sees its buffer; tracks 2..N read `undefined`."
