# Engine Package (`@waveform-playlist/engine`)

**Purpose:** Framework-agnostic timeline engine extracted from React hooks. Enables Svelte/Vue/vanilla bindings.

**Architecture:** Two layers — pure operations functions + stateful `PlaylistEngine` class with event emitter.

**Build:** Uses tsup (not vite) — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS.

**Testing:** vitest unit tests in `src/__tests__/`. Run with `npx vitest run` from `packages/engine/`.

**Key types:** `PlayoutAdapter` (pluggable audio backend interface — `play()` returns `void`, `init()` returns `Promise<void>`), `EngineState` (state snapshot), `EngineEvents` (statechange, timeupdate, play/pause/stop).

**Operations:** `clipOperations.ts` (drag constraints, trim, split), `viewportOperations.ts` (bounds, chunks, scroll threshold), `timelineOperations.ts` (duration, zoom, seek).

**No React, no Tone.js** — zero framework dependencies. Only peer dependency is `@waveform-playlist/core`.

**Design doc:** `docs/plans/2026-02-24-engine-extraction-design.md`

## Patterns

- All mutating methods (moveClip, trimClip, removeTrack, setZoomLevel) guard against no-op statechange emissions — bail early when constrained delta is 0, track not found, or zoom unchanged
- `setTracks()` copies input array; `getState()` copies output tracks — defensive at both boundaries
- `PlayoutAdapter.isPlaying()` is defined but not called by engine (engine tracks own `_isPlaying`). Known design gap.
- Engine uses `seek()` while browser package uses `seekTo()` — naming divergence, noted in root CLAUDE.md "Common Doc Drift"
- **Guard Against No-Op State Emissions** - In stateful classes with event emitters, check if an operation would actually change state before emitting. Zero-delta moves/trims, removing non-existent items, and setting zoom to the same level should bail early to avoid wasted listener calls and UI re-renders.
- **Engine owns selection, loop, selectedTrackId, zoom, and masterVolume** — React subscribes to `statechange` and mirrors into useState/refs via `onEngineState()` callbacks in each hook. Playback timing (currentTime, isPlaying) remains in React for animation loop.
- `setSelection()` and `setLoopRegion()` normalize `start <= end` via `Math.min/Math.max` — consumers can trust `EngineState` invariants without defensive normalization
- `engine.dispose()` calls `_listeners.clear()`, so explicit `engine.off()` is unnecessary when the engine itself is being disposed
- **Console warn diagnostics** — `moveClip`, `trimClip`, `splitClip` log `console.warn('[waveform-playlist/engine] methodName: ...')` on invalid track/clip IDs. Tests exercising these paths must mock `console.warn`.
- **`tracksVersion` counter** — Monotonic counter in `EngineState` that increments only on track mutations (setTracks, addTrack, removeTrack, moveClip, trimClip, splitClip). Does NOT increment on selection/zoom/volume/loop changes. Used by the provider to detect track-specific statechange events and skip `loadAudio` rebuilds.
- `getCurrentTime()` delegates to `adapter.getCurrentTime()` when playing (returns `Transport.seconds`, auto-wraps at loop boundaries), otherwise returns stored `_currentTime`. Engine's `play(startTime)` clamps startTime to track duration — tests need tracks loaded for meaningful startTime values.
- `play()` is **synchronous** (not async) — enables Transport loop if `_isLoopEnabled`; `play(start, end)` disables it for selection playback. `stop()` disables Transport loop before calling `adapter.stop()`. Separate `init()` method delegates to `adapter.init()` for AudioContext resume.
- **Audacity-style stop** — `play()` saves `_currentTime` into `_playStartPosition`. `stop()` resets `_currentTime` to `_playStartPosition` (not 0), so the cursor returns to where playback began. This matches Audacity/most DAW behavior. Calling `play()` from position 0 and stopping returns to 0; calling from position 3.0 and stopping returns to 3.0.
