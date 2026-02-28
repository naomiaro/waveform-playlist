# Browser Package (`@waveform-playlist/browser`)

## Custom Hooks Architecture

**Pattern:** Extract complex logic into reusable custom hooks.

**Key Hooks:**
- `useClipDragHandlers` - Drag-to-move and boundary trimming (300+ lines)
- `useClipSplitting` - Split clips at playhead (150+ lines)
- `useKeyboardShortcuts` - Flexible keyboard shortcut system (120+ lines)
- `usePlaybackShortcuts` - Default playback shortcuts (0 = rewind to start)
- `useAnnotationKeyboardControls` - Annotation navigation, editing, auto-scroll, and playback
- `useDynamicEffects` - Master effects chain with runtime parameter updates
- `useTrackDynamicEffects` - Per-track effects management
- `useDynamicTracks` - Runtime track additions with placeholder-then-replace pattern
- `usePlaybackControls`, `useTimeFormat`, `useZoomControls`, etc.

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

**Problem:** Detecting when a playlist has finished loading all tracks for CSS styling, E2E testing, or external integrations.

**Solution:** Three approaches available:

1. **Data Attribute** (`data-playlist-state`) - For CSS and E2E tests:
```css
[data-playlist-state="loading"] { opacity: 0.5; }
[data-playlist-state="ready"] { opacity: 1; }
```
```typescript
// Playwright
await page.waitForSelector('[data-playlist-state="ready"]', { timeout: 30000 });
```

2. **Custom Event** (`waveform-playlist:ready`) - For external integrations:
```typescript
window.addEventListener('waveform-playlist:ready', (event: CustomEvent) => {
  console.log('Tracks loaded:', event.detail.trackCount);
  console.log('Duration:', event.detail.duration);
});
```

3. **React Hook** (`isReady` from `usePlaylistData()`) - For internal components:
```typescript
const { isReady, tracks } = usePlaylistData();
if (!isReady) return <LoadingSpinner />;
```

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

**Problem:** React state updates during playback cause flickering and are throttled (every 500ms). Components like playhead position, progress overlay, and time display need 60fps updates.

**Solution:** Use `requestAnimationFrame` with direct DOM manipulation via refs. Calculate time directly from audio context for perfect sync.

**Pattern:**
```typescript
const elementRef = useRef<HTMLElement>(null);
const animationFrameRef = useRef<number | null>(null);
const { isPlaying, currentTimeRef, playbackStartTimeRef, audioStartPositionRef } = usePlaybackAnimation();

useEffect(() => {
  const update = () => {
    if (elementRef.current) {
      // Calculate time from audio context during playback
      let time: number;
      if (isPlaying) {
        const elapsed = getContext().currentTime - (playbackStartTimeRef.current ?? 0);
        time = (audioStartPositionRef.current ?? 0) + elapsed;
      } else {
        time = currentTimeRef.current ?? 0;
      }
      // Update DOM directly (no React state)
      elementRef.current.style.transform = `translateX(${time * pixelsPerSecond}px)`;
    }
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(update);
    }
  };

  if (isPlaying) {
    animationFrameRef.current = requestAnimationFrame(update);
  } else {
    update(); // Update once when stopped
  }

  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
}, [isPlaying, ...dependencies]);
```

**Key Points:**
- Use `getContext().currentTime` from Tone.js for accurate audio time
- Calculate elapsed time: `audioContext.currentTime - playbackStartTimeRef`
- Add to start position: `audioStartPositionRef + elapsed`
- Update DOM directly via refs (no setState)
- Cancel animation frame on cleanup and when stopping

**Applied in:**
- `AnimatedPlayhead` - Playhead line position
- `ChannelWithProgress` - Per-channel progress overlay
- `AudioPosition` - Time display (ContextualControls)
- `PlayheadWithMarker` - Custom playhead with triangle marker (ui-components)

**Location:** `src/components/`

## Engine State Subscription Pattern

**Pattern:** Engine owns state → emits `statechange` → React mirrors into useState/refs.

**Currently engine-owned:** selectionStart/End, loopStart/End, isLoopEnabled, selectedTrackId

**Currently dual-write:** masterVolume (useMasterVolume hook manages own React state)

**Still React-only:** currentTime, isPlaying (animation loop timing), tracks (loaded via useAudioTracks)

**Subscription location:** Inside `loadAudio()` after `engineRef.current = engine`, the statechange handler updates both React state (for UI re-renders) and refs (for 60fps animation loop reads).

**Seed on rebuild:** When `loadAudio()` creates a fresh engine, seed it from current refs (`selectionStartRef`, `loopStartRef`, etc.) before `setTracks()` — otherwise the first statechange resets user state to zeros.

**Guard handler with ref comparisons:** The handler fires on every engine event (clip drags, zoom, play/pause). Compare `state.field !== fieldRef.current` before calling `setState` to skip unnecessary React updates. Ref assignments are synchronous; `setState` calls are batched by React.

## Important Patterns (Browser-Specific)

- **Context Value Memoization** - All context value objects in providers must be wrapped with `useMemo`. Extract inline callbacks into `useCallback` first to avoid dependency churn.
- **Fetch Cleanup with AbortController** - `useAudioTracks` uses AbortController to cancel in-flight fetches on cleanup. Follow this pattern for any fetch in useEffect. For per-item abort (e.g., removing one loading track), use `Map<id, AbortController>` instead of `Set<AbortController>`.
- **Guard Before State Update in Callbacks** - In callbacks that update both React state and audio engine, validate inputs (e.g., trackId lookup) BEFORE calling `setState`. If the guard is after `setState`, invalid inputs cause UI/audio desync (UI updates but audio doesn't).
