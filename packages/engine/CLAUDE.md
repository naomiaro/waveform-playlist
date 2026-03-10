# Engine Package (`@waveform-playlist/engine`)

**Purpose:** Framework-agnostic timeline engine extracted from React hooks. Enables Svelte/Vue/vanilla bindings.

**Architecture:** Two layers — pure operations functions + stateful `PlaylistEngine` class with event emitter.

**Build:** Uses tsup (not vite) — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS.

**Testing:** vitest unit tests in `src/__tests__/`. Run with `npx vitest run` from `packages/engine/`.

**Key types:** `PlayoutAdapter` (pluggable audio backend interface), `EngineState` (state snapshot), `EngineEvents` (statechange, timeupdate, play/pause/stop).

**Operations:** `clipOperations.ts` (drag constraints, trim, split), `viewportOperations.ts` (bounds, chunks, scroll threshold), `timelineOperations.ts` (duration, zoom, seek).

**No React, no Tone.js** — zero framework dependencies. Only peer dependency is `@waveform-playlist/core`.

## Zoom Level Validation

`samplesPerPixel` must exist in the `zoomLevels` array — engine constructor throws if not (`indexOf` check, not `findClosestZoomIndex`). Default zoom levels: `[256, 512, 1024, 2048, 4096, 8192]`. Default `samplesPerPixel`: 1024. When adding examples, always use a value from the zoom levels array.

## Patterns

- All mutating methods (moveClip, trimClip, removeTrack, setZoomLevel) guard against no-op statechange emissions — bail early when constrained delta is 0, track not found, or zoom unchanged
- `setTracks()` copies input array; `getState()` copies output tracks — defensive at both boundaries
- `PlayoutAdapter.isPlaying()` is defined but not called by engine (engine tracks own `_isPlaying`). Known design gap.
- Engine uses `seek()` while browser package uses `seekTo()` — naming divergence, noted in root CLAUDE.md "Common Doc Drift"
- **Guard Against No-Op State Emissions** - In stateful classes with event emitters, check if an operation would actually change state before emitting. Zero-delta moves/trims, removing non-existent items, and setting zoom to the same level should bail early to avoid wasted listener calls and UI re-renders.
- **Engine owns selection, loop, selectedTrackId, zoom, and masterVolume** — React subscribes to `statechange` and mirrors into useState/refs via `onEngineState()` callbacks in each hook. Playback timing (currentTime, isPlaying) remains in React for animation loop.
- `setSelection()` and `setLoopRegion()` normalize `start <= end` via `Math.min/Math.max` — consumers can trust `EngineState` invariants without defensive normalization
- **Loop activation uses `< loopEnd` check** — `play()` activates Transport loop when starting before `loopEnd` (not `>= loopStart && < loopEnd` like before). Starting before the loop region still activates looping — Transport plays through to `loopEnd`, then wraps to `loopStart`. Starting at or past `loopEnd` plays to the end without looping (click-past-loop behavior). `setLoopEnabled()`/`setLoopRegion()` during playback use `_isBeforeLoopEnd()` — same `< loopEnd` check against live adapter position. Selection/annotation playback (with `endTime`) always disables loop.
- **`play()` state rollback on adapter throw** — `play()` saves `prevCurrentTime` and `prevPlayStartPosition` before mutations. If `adapter.play()` throws, state is restored so the engine isn't left with a moved playhead but no audio.
- `engine.dispose()` wraps `adapter.dispose()` in try-catch to guarantee `_listeners.clear()` always runs. Explicit `engine.off()` is unnecessary when the engine itself is being disposed.
- **Console warn diagnostics** — `moveClip`, `trimClip`, `splitClip` log `console.warn('[waveform-playlist/engine] methodName: ...')` on invalid track/clip IDs. Tests exercising these paths must mock `console.warn`.
- **`tracksVersion` counter** — Monotonic counter in `EngineState` that increments only on track mutations (setTracks, addTrack, removeTrack, moveClip, trimClip, splitClip). Does NOT increment on selection/zoom/volume/loop changes. Used by the provider to detect track-specific statechange events and skip `loadAudio` rebuilds.
- **Testing animation-frame code** — `_startTimeUpdateLoop` uses `requestAnimationFrame`, unavailable in Node.js. Use `vi.stubGlobal('requestAnimationFrame', vi.fn((cb) => { rafCallbacks.push(cb); return rafCallbacks.length; }))` and `vi.unstubAllGlobals()` in cleanup. Fire ticks manually via `rafCallbacks[rafCallbacks.length - 1](performance.now())`.
- **Track audio state persistence** — `setTrackVolume/setTrackMute/setTrackSolo/setTrackPan` must update `this._tracks[]` in addition to forwarding to the adapter. Clip operations (`moveClip`, `trimClip`, `splitClip`) call `adapter.setTracks(this._tracks)`, which triggers `buildPlayout()` — if `_tracks` doesn't reflect current audio state, the rebuild loses solo/mute/volume/pan settings.
- **`addTrack()` uses incremental adapter path** — When `adapter.addTrack` is defined, `PlaylistEngine.addTrack()` calls it instead of `adapter.setTracks()`. This avoids a full playout rebuild. The `PlayoutAdapter.addTrack` method is optional (`addTrack?`) for backwards compatibility.
