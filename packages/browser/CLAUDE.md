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

**Solution:** `requestAnimationFrame` + direct DOM manipulation via refs. Calculate time from `getContext().currentTime` (Tone.js) for perfect audio sync. No `setState` in the loop.

**Key points:** Compute elapsed = `audioContext.currentTime - playbackStartTimeRef`, add `audioStartPositionRef`. Update DOM directly. Cancel animation frame on cleanup.

**Reference implementation:** `AnimatedPlayhead` component. Also used by `ChannelWithProgress`, `AudioPosition`, `PlayheadWithMarker`.

## Engine State Subscription Pattern

**Pattern:** Engine owns state → emits `statechange` → hook's `onEngineState()` mirrors into useState/refs.

**All engine-owned state uses the `onEngineState()` hook pattern:**
- `useSelectionState` — selectionStart, selectionEnd
- `useLoopState` — isLoopEnabled, loopStart, loopEnd
- `useSelectedTrack` — selectedTrackId
- `useZoomControls` — samplesPerPixel, canZoomIn, canZoomOut
- `useMasterVolume` — masterVolume

**Still React-only:** currentTime, isPlaying (animation loop timing), tracks (loaded via useAudioTracks)

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

**`skipEngineDisposeRef` must include `isDraggingRef`:** During drag, `onDragMove` triggers `loadAudio` re-runs (because `tracks` is in deps). The previous effect's cleanup checks `skipEngineDisposeRef` — if it only checks `isEngineTracks` (which is `false` during drag), it disposes the engine on the first drag move.

## Important Patterns (Browser-Specific)

- **Context Value Memoization** - All context value objects in providers must be wrapped with `useMemo`. Extract inline callbacks into `useCallback` first to avoid dependency churn.
- **Fetch Cleanup with AbortController** - `useAudioTracks` uses AbortController to cancel in-flight fetches on cleanup. Follow this pattern for any fetch in useEffect. For per-item abort (e.g., removing one loading track), use `Map<id, AbortController>` instead of `Set<AbortController>`.
- **Guard Before State Update in Callbacks** - In callbacks that update both React state and audio engine, validate inputs (e.g., trackId lookup) BEFORE calling `setState`. If the guard is after `setState`, invalid inputs cause UI/audio desync (UI updates but audio doesn't).
- **RefObject Nullability** - `React.RefObject<T>` has `current: T | null` in React 18 types, even when initialized with a value. Call sites accessing hook-returned refs need `?? 0` (numbers) or `?? false` (booleans) fallbacks to satisfy TypeScript, even though the values are never actually null at runtime.
- **Provider-Level Concerns Stay in Provider** - Callbacks with cross-cutting side-effects (e.g., `setSelection` updates currentTime and restarts playback, `setLoopRegionFromSelection` reads from selection hook and writes to loop hook) belong in the provider, not in individual state hooks. Hooks handle engine delegation + state mirroring only.
