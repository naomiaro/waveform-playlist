# Engine Package (`@waveform-playlist/engine`)

**Purpose:** Framework-agnostic timeline engine extracted from React hooks. Enables Svelte/Vue/vanilla bindings.

**Architecture:** Two layers — pure operations functions + stateful `PlaylistEngine` class with event emitter.

**Build:** Uses tsup (not vite) — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS.

**Testing:** vitest unit tests in `src/__tests__/`. Run with `npx vitest run` from `packages/engine/`.

**Key types:** `PlayoutAdapter` (pluggable audio backend interface), `EngineState` (state snapshot), `EngineEvents` (statechange, timeupdate, play/pause/stop).

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
