# Browser Package (`@waveform-playlist/browser`)

## Custom Hooks Architecture

**Pattern:** Extract complex logic into reusable custom hooks.

**Key Hooks:**

- `useClipDragHandlers` - Drag-to-move and boundary trimming
- `useClipSplitting` - Split clips at playhead
- `useKeyboardShortcuts` - Flexible keyboard shortcut system
- `usePlaybackShortcuts` - Default playback shortcuts (0 = rewind to start)
- `useAnnotationKeyboardControls` - Annotation navigation, editing, auto-scroll, and playback
- `useDynamicEffects` - Master effects chain with runtime parameter updates
- `useTrackDynamicEffects` - Per-track effects management
- `useDynamicTracks` - Runtime track additions with placeholder-then-replace pattern
- `useSelectionState` - Selection state (start/end) with engine delegation
- `useLoopState` - Loop state (enabled, start, end) with engine delegation
- `useSelectedTrack` - Selected track ID with engine delegation
- `useZoomControls` - Zoom state (samplesPerPixel, canZoomIn/Out) with engine delegation
- `useMasterVolume` - Master volume with engine delegation
- `useTimeFormat`, etc.

**Location:** `src/hooks/`

## Audio Effects Architecture

**Implementation:** 20 Tone.js effects with full parameter control, organized by category.

**Categories:** Reverb (3), Delay (2), Modulation (5), Filter (3), Distortion (3), Dynamics (3), Spatial (1)

**Key Files:**

- `src/effects/effectDefinitions.ts` - All effect metadata and parameters
- `src/effects/effectFactory.ts` - Creates effect instances
- `src/hooks/useDynamicEffects.ts` - Master chain management
- `src/hooks/useTrackDynamicEffects.ts` - Per-track effects

**Pattern:** Effects are created via factory, chained in series, support real-time parameter updates without rebuilding the chain.

**Bypass Pattern:** When bypassing, store original wet value and set to 0. On re-enable, restore original wet value (not always 1).

**Offline Rendering:** Both hooks provide `createOfflineEffectsFunction()` for WAV export via `Tone.Offline`.

**Documentation:** `website/docs/effects.md`

## Shared Animation Frame Loop Hook

**Decision:** Centralize requestAnimationFrame lifecycle logic in a shared hook used by both playlist providers.

**Implementation:**

- Hook: `src/hooks/useAnimationFrameLoop.ts`
- Exported from: `src/hooks/index.ts`
- Integrated into:
  - `src/WaveformPlaylistContext.tsx`
  - `src/MediaElementPlaylistContext.tsx`

**Why:**

- Removes duplicated `requestAnimationFrame` / `cancelAnimationFrame` logic across providers
- Ensures a single in-flight animation frame per provider
- Standardizes cleanup on unmount and playback transitions

## Web Worker Peak Generation

**Decision:** Generate `WaveformData` in a web worker at load time, then use `resample()` for near-instant zoom changes.

**Key files:**

- `src/workers/peaksWorker.ts` — Inline Blob worker (portable across bundlers)
- `src/hooks/useWaveformDataCache.ts` — Cache hook, watches tracks for clips with `audioBuffer` but no `waveformData`
- `src/waveformDataLoader.ts` — `extractPeaksFromWaveformDataFull()` for resample + channel extraction

**Peak resolution order in WaveformPlaylistContext:** (1) `clip.waveformData` (external pre-computed), (2) worker cache hit, (3) empty peaks while worker runs.

**Automatic:** Any clip with `audioBuffer` (loaded or recorded) gets worker treatment — no opt-in needed.

## Playlist Loading Detection

Three approaches for detecting when tracks finish loading:

1. **Data Attribute** — `[data-playlist-state="ready"]` for CSS and E2E tests (Playwright `waitForSelector`)
2. **Custom Event** — `waveform-playlist:ready` (CustomEvent with `trackCount`, `duration`) for external integrations
3. **React Hook** — `isReady` from `usePlaylistData()` for internal components

**Applied in:** `WaveformPlaylistContext.tsx`, `Playlist.tsx`, all E2E tests

## Refs for Dynamic Audio Callbacks

**Problem:** useCallback with state dependencies creates stale closures when callbacks are stored and called later.

**Solution:** Store current state in a ref, read from ref inside callback:

```typescript
const activeEffectsRef = useRef(activeEffects);
activeEffectsRef.current = activeEffects; // Update on every render

const rebuildChain = useCallback(() => {
  const currentEffects = activeEffectsRef.current; // Fresh state
}, []); // Stable function - no dependencies
```

**Applied in:** `useDynamicEffects`, `useTrackDynamicEffects`, `WaveformPlaylistContext` track controls (`tracksRef`)

## Smooth Playback Animation Pattern

**Problem:** React state updates during playback cause flickering. Components need 60fps updates.

**Solution:** `requestAnimationFrame` + direct DOM manipulation via refs. Read time via `getPlaybackTime()` which delegates to `Transport.seconds` for perfect audio sync. No `setState` in the loop.

**Key points:** Use `getPlaybackTime()` (from `usePlaybackAnimation()`) — delegates to `engine.getCurrentTime()` which reads `Transport.seconds` (auto-wraps at loop boundaries). Fallback: manual elapsed calculation from `audioContext.currentTime`. Update DOM directly. Cancel animation frame on cleanup.

**Reference implementation:** `AnimatedPlayhead` component. Also used by `ChannelWithProgress`, `AudioPosition`, `PlayheadWithMarker`.

**Loop handling:** Looping is handled natively by Tone.js Transport (`Transport.loop`/`loopStart`/`loopEnd`). The animation loop does NOT detect loop boundaries — `Transport.seconds` auto-wraps, so `getPlaybackTime()` returns the correct position. Selection/annotation playback disables Transport loop; `stop()` disables it before stopping.

**AudioContext Init Pattern:** `audioInitializedRef` guards `engine.init()` (AudioContext resume via `Tone.start()`). Only the first play call awaits init; subsequent plays skip it entirely — no microtask yield. Reset to `false` when engine is rebuilt in `loadAudio`. This keeps the stop→play path fully synchronous after first play, preventing audio layering race conditions.

## Engine State Subscription Pattern

**Pattern:** Engine owns state → emits `statechange` → hook's `onEngineState()` mirrors into useState/refs.

**All engine-owned state uses the `onEngineState()` hook pattern:**

- `useSelectionState` — selectionStart, selectionEnd
- `useLoopState` — isLoopEnabled, loopStart, loopEnd
- `useSelectedTrack` — selectedTrackId
- `useZoomControls` — samplesPerPixel, canZoomIn, canZoomOut
- `useMasterVolume` — masterVolume

**Still React-only:** isPlaying (animation loop timing), tracks (loaded via useAudioTracks). `currentTime` is read from engine during playback via `getPlaybackTime()` (→ `engine.getCurrentTime()` → `Transport.seconds`).

**Subscription location:** Inside `loadAudio()` after `engineRef.current = engine`, the statechange handler calls each hook's `onEngineState(state)`.

**Seed on rebuild:** When `loadAudio()` creates a fresh engine, seed it from hook-exposed refs before `setTracks()` — otherwise the first statechange resets user state to defaults. **Checklist** (update when adding engine-owned state):

- `engine.setSelection(selectionStartRef.current ?? 0, selectionEndRef.current ?? 0)`
- `engine.setLoopRegion(loopStartRef.current ?? 0, loopEndRef.current ?? 0)`
- `if (isLoopEnabledRef.current) engine.setLoopEnabled(true)`
- `engine.setMasterVolume(masterVolumeRef.current ?? 1.0)`
- `if (selectedTrackIdRef.current) engine.selectTrack(selectedTrackIdRef.current)`

**Guard handler with ref comparisons:** Each hook's `onEngineState()` compares `state.field !== ref.current` before calling `setState` to skip unnecessary React updates. Ref assignments are synchronous; `setState` calls are batched by React.

## Trim/Move Asymmetry in useClipDragHandlers

**Move:** `onDragEnd` delegates to `engine.moveClip()` in one shot. The collision modifier constrains the visual position per-frame using the engine's pure `constrainClipDrag` function.

**Trim:** `onDragMove` updates React state per-frame via `onTracksChange` for smooth visual feedback (cumulative deltas from original clip snapshot). `isDraggingRef` prevents `loadAudio` from rebuilding the engine during the drag, so the engine keeps the original (pre-drag) clip positions. On drag end, `engine.trimClip()` commits the final delta.

**Why not `engine.trimClip()` per frame:** Engine methods apply incremental deltas to current state. The drag handler computes cumulative deltas from the original snapshot. Calling the engine per frame would compound deltas incorrectly.

**`isDraggingRef` lifecycle:** Set `true` in `onDragStart` (boundary trim only), set `false` in `onDragEnd` before `engine.trimClip()`. Guards two places in the provider: (1) `loadAudio` effect body skips full rebuild, (2) `skipEngineDisposeRef` prevents the previous effect cleanup from disposing the engine mid-drag.

**Cancel-revert for boundary trims:** `onDragEnd` checks `event.canceled` and restores React state from `originalClipStateRef` snapshot. Without this, Escape during trim leaves UI at partially-trimmed state while engine has original positions. Same pattern in `useAnnotationDragHandlers` with `originalAnnotationStateRef`.

**`skipEngineDisposeRef` must include `isDraggingRef`:** During drag, `onDragMove` triggers `loadAudio` re-runs (because `tracks` is in deps). The previous effect's cleanup checks `skipEngineDisposeRef` — if it only checks `isEngineTracks` (which is `false` during drag), it disposes the engine on the first drag move.

## @dnd-kit/react v0.3.2 Event API Quirks

- **`event.operation.position.delta`** is `undefined` in snapshots — `@derived` getters are non-enumerable and stripped by `snapshot()`. Compute manually: `position.current.x - position.initial.x`.
- **`event.operation.position.current`** is stale in `onDragMove` — `move()` dispatches before updating `position.current` (happens in `queueMicrotask`). Use `event.to?.x` for the correct pointer position (`to?: Coordinates` is typed on the dragmove event).
- **`event.operation.transform.x`** in `onDragEnd` reflects the final post-modifier transform. Use for clip moves; for boundary trims, cache the last delta from `onDragMove` in a ref.
- **`noDropAnimationPlugins`** — exported helper that configures DragDropProvider's Feedback plugin with `dropAnimation: null`. Prevents snap-back on clip drop. Warns if `Feedback` identity check fails (module duplication). Only needed for clip moves (boundary trims use `feedback: 'none'`).

## Error Handling in Playback Callbacks

- **`engine.play()` try-catch in play callback** — `engine.play()` is synchronous but can throw (adapter failures). Wrap in try-catch; on error, `stopAnimationLoop()` and return early to avoid `setIsPlaying(true)` with no audio.
- **Fire-and-forget async `.catch()` handlers** — `reschedulePlayback()` and `resumePlayback()` are async functions called without `await` in useEffect callbacks. Without `.catch()`, throws become unhandled promise rejections. Each `.catch()` resets UI state (`setIsPlaying(false)`, `stopAnimationLoop()`).

## Aligned Peak Resampling (waveformDataLoader.ts)

**Decision:** When slicing WaveformData before resampling to a different scale, source slice indices must align to the resampling ratio.

**Why:** WaveformData.resample() groups N consecutive source bins per output bin (N = targetScale/sourceScale). If the slice starts at a non-aligned index, output bins cover different source samples than a full-file resample would, causing zoom-dependent peak amplitude.

**Pattern (in both `extractPeaksFromWaveformData` and `extractPeaksFromWaveformDataFull`):**

```typescript
const ratio = samplesPerPixel / sourceScale;
const targetStart = Math.floor(offsetSamples / samplesPerPixel);
const targetEnd = Math.ceil((offsetSamples + durationSamples) / samplesPerPixel);
const sourceStart = Math.floor(targetStart * ratio);
const sourceEnd = Math.min(waveformData.length, Math.ceil(targetEnd * ratio));
// slice(sourceStart, sourceEnd) → resample(targetScale)
// (WaveformData.slice endIndex is exclusive, like Array.slice)
```

**Key invariant:** Floor/ceil slicing ensures all source bins contributing to target bins are included. For integer ratios (power-of-two scales like 256→1024), this gives exact bin-boundary alignment. For non-integer ratios (e.g., 256→1000), first/last bins may be slightly more inclusive than a full-file resample, but never underrepresent peaks.

**Why floor/ceil, not round:** `Math.round` can exclude a partial source bin at either boundary, underrepresenting peaks. `Math.floor` (start) and `Math.ceil` (end) are consistently inclusive — they may include one extra source bin, but the resampler's min/max aggregation makes this the safe direction for waveform visualization. Non-integer ratios are common (default `samplesPerPixel=1000` with `baseScale=256` gives ratio 3.90625).

**Mono merge:** Uses weighted averaging (same as `makeMono` in webaudio-peaks). This is consistent across both packages — do not change to min/max without updating both.

## AudioBuffer Deduplication in Peak Generation

**Decision:** `useWaveformDataCache` deduplicates worker jobs by `AudioBuffer` identity, not clip ID.

**Why:** When a recording is split into many clips sharing the same `AudioBuffer`, per-clip generation causes duplicate `Float32Array.slice()` allocations and OOM on large timelines.

**Implementation:** Three `WeakMap<AudioBuffer, ...>` refs:
- `generatedByBufferRef` — cached results (`WaveformData`)
- `inflightByBufferRef` — in-flight worker promises
- `subscribersByBufferRef` — clip IDs waiting for a buffer's result

**Pattern:** Generate once per buffer, fan out the result to all subscriber clip IDs via `setCache()`. `WeakMap` allows GC when `AudioBuffer` is released.

## MIDI Clip Rendering Pipeline

**Problem:** MIDI clips have no `audioBuffer` or `waveformData`, so Path C in peak generation gave them `length: 0`, rendering as invisible zero-width clips.

**Fix:** In Path C, detect `clip.midiNotes` and compute `pixelLength = Math.ceil(clip.durationSamples / samplesPerPixel)`.

**Data threading:** `ClipPeaks` includes `midiNotes`, `sampleRate`, `offsetSamples` which flow through `PlaylistVisualization` → `ChannelWithProgress` → `SmartChannel` → `PianoRollChannel`.

**Auto-detection:** `PlaylistVisualization` checks `track.clips.some(c => c.midiNotes?.length > 0)` and sets `effectiveRenderMode` to `'piano-roll'` automatically. Per-clip override: `clip.midiNotes ? 'piano-roll' : effectiveRenderMode`.

## Unit Tests

**Setup:** `vitest` in devDependencies, `vitest.config.ts` (node environment).

**Run:** `cd packages/browser && npx vitest run`

**Test helper:** `WaveformData.create()` requires JSON with `{ version: 2, channels: 1, sample_rate, samples_per_pixel, bits, length, data }` — omitting `version`/`channels` causes a TypeScript error.

## Click-to-Seek During Auto-Scroll

`handleMouseUp` must NOT recompute click time from `getBoundingClientRect()` during playback — auto-scroll shifts the overlay between mouseDown and mouseUp, producing wrong positions. Instead, `mouseDownTimeRef` captures the time at mouseDown, and mouseUp reuses it when `isPlaying`. Applied in both `PlaylistVisualization` and `MediaElementPlaylist`.

## Progress Overlay Width Invariant

**Decision:** In `ChannelWithProgress`, `ProgressOverlay.$width` uses `clipPixelWidth()` from core, but `Background.$width` uses `smartChannelProps.length` (peak data length).

**Why:** Background must match the canvas area — extending it to `clipPixelWidth` bleeds the waveform fill color into the gap between audio end and clip end (where the playlist background should show). ProgressOverlay must match the clip container — using `peaksData.length` causes `scaleX(ratio)` to scale a narrower element, making progress visually lag behind the playhead.

## Controls Offset Removed

**Decision:** All `controlsOffset` / `controlWidth` arithmetic removed from mouse handlers, playhead positioning, selection, auto-scroll, and zoom calculations.

**Why:** Controls are now outside the scroll container (in `ControlsColumn`), so pixel positions in the scroll area map directly to timeline positions without offset adjustment.

**Affected:** `PlaylistVisualization`, `MediaElementPlaylist`, `AnimatedPlayhead`, `AnimatedMediaElementPlayhead`, `WaveformPlaylistContext` (auto-scroll + zoom), `MediaElementPlaylistContext` (auto-scroll), `useAnnotationKeyboardControls`.

## Important Patterns (Browser-Specific)

- **Context Value Memoization** - All context value objects in providers must be wrapped with `useMemo`. Extract inline callbacks into `useCallback` first to avoid dependency churn.
- **Fetch Cleanup with AbortController** - `useAudioTracks` uses AbortController to cancel in-flight fetches on cleanup. Follow this pattern for any fetch in useEffect. For per-item abort (e.g., removing one loading track), use `Map<id, AbortController>` instead of `Set<AbortController>`.
- **Guard Before State Update in Callbacks** - In callbacks that update both React state and audio engine, validate inputs (e.g., trackId lookup) BEFORE calling `setState`. If the guard is after `setState`, invalid inputs cause UI/audio desync (UI updates but audio doesn't).
- **RefObject Nullability** - `React.RefObject<T>` has `current: T | null` in React 18 types, even when initialized with a value. Call sites accessing hook-returned refs need `?? 0` (numbers) or `?? false` (booleans) fallbacks to satisfy TypeScript, even though the values are never actually null at runtime.
- **Provider-Level Concerns Stay in Provider** - Callbacks with cross-cutting side-effects (e.g., `setSelection` updates currentTime and restarts playback, `setLoopRegionFromSelection` reads from selection hook and writes to loop hook) belong in the provider, not in individual state hooks. Hooks handle engine delegation + state mirroring only.
