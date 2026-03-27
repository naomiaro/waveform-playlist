# Engine Package (`@waveform-playlist/engine`)

**Purpose:** Framework-agnostic timeline engine extracted from React hooks. Enables Svelte/Vue/vanilla bindings.

**Architecture:** Two layers — pure operations functions + stateful `PlaylistEngine` class with event emitter.

**Build:** Uses tsup (not vite) — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS.

**Testing:** vitest unit tests in `src/__tests__/`. Run with `npx vitest run` from `packages/engine/`.

**Key types:** `PlayoutAdapter` (pluggable audio backend interface), `EngineState` (state snapshot), `EngineEvents` (statechange, play/pause/stop).

**Operations:** `clipOperations.ts` (drag constraints, trim, split), `viewportOperations.ts` (bounds, chunks, scroll threshold), `timelineOperations.ts` (duration, zoom, seek).

**No React, no Tone.js** — zero framework dependencies. Only peer dependency is `@waveform-playlist/core`.

## Zoom Level Validation

`samplesPerPixel` must exist in the `zoomLevels` array — engine constructor throws if not (`indexOf` check, not `findClosestZoomIndex`). Default zoom levels: `[256, 512, 1024, 2048, 4096, 8192]`. Default `samplesPerPixel`: 1024. When adding examples, always use a value from the zoom levels array.

## Patterns

- **`play()` and `seek()` do not clamp to duration** — The Transport runs at any non-negative position, playing silence where there's no audio. This enables recording from cursor positions beyond existing clips. Only negative values are clamped to 0.
- **Default sampleRate is 48000** — Changed from 44100 to match modern hardware. Consumers should still pass `AudioContext.sampleRate` explicitly when creating the engine.
- All mutating methods (moveClip, trimClip, removeTrack, setZoomLevel) guard against no-op statechange emissions — bail early when constrained delta is 0, track not found, or zoom unchanged
- `setTracks()` copies input array; `getState()` copies output tracks — defensive at both boundaries
- `PlayoutAdapter.isPlaying()` is defined but not called by engine (engine tracks own `_isPlaying`). Known design gap.
- Engine uses `seek()` while browser package uses `seekTo()` — naming divergence, noted in root CLAUDE.md "Common Doc Drift"
- **Guard Against No-Op State Emissions** - In stateful classes with event emitters, check if an operation would actually change state before emitting. Zero-delta moves/trims, removing non-existent items, and setting zoom to the same level should bail early to avoid wasted listener calls and UI re-renders.
- **Engine owns selection, loop, selectedTrackId, zoom, and masterVolume** — React subscribes to `statechange` and mirrors into useState/refs via `onEngineState()` callbacks in each hook. Consumers poll `engine.getCurrentTime()` per-frame in their own animation loops.
- `setSelection()` and `setLoopRegion()` normalize `start <= end` via `Math.min/Math.max` — consumers can trust `EngineState` invariants without defensive normalization
- **Loop activation uses `< loopEnd` check** — `play()` activates Transport loop when starting before `loopEnd` (not `>= loopStart && < loopEnd` like before). Starting before the loop region still activates looping — Transport plays through to `loopEnd`, then wraps to `loopStart`. Starting at or past `loopEnd` plays to the end without looping (click-past-loop behavior). `setLoopEnabled()`/`setLoopRegion()` during playback use `_isBeforeLoopEnd()` — same `< loopEnd` check against live adapter position. Selection/annotation playback (with `endTime`) always disables loop.
- **`play()` state rollback on adapter throw** — `play()` saves `prevCurrentTime` and `prevPlayStartPosition` before mutations. If `adapter.play()` throws, state is restored so the engine isn't left with a moved playhead but no audio.
- `engine.dispose()` wraps `adapter.dispose()` in try-catch to guarantee `_listeners.clear()` always runs. Explicit `engine.off()` is unnecessary when the engine itself is being disposed.

## Undo/Redo

- **Snapshot-based stack** — `_undoStack` stores frozen `ClipTrack[]` copies before each undoable mutation. No per-operation inverse logic. `undoLimit` defaults to 100.
- **Undoable operations:** `moveClip`, `trimClip`, `splitClip`, `addTrack`, `removeTrack`, `updateTrack` (when track arg provided). **Not undoable:** `setSelection`, `setZoomLevel`, `setMasterVolume`, `setLoopEnabled`, `setLoopRegion`, `selectTrack`.
- **`setTracks()` clears history** — old snapshots reference a different track set.
- **Transactions** — `beginTransaction()` captures one snapshot; mutations during the transaction don't push individual undo steps. `commitTransaction()` pushes the pre-transaction snapshot. `abortTransaction()` restores it without pushing.
- **`canUndo`/`canRedo`** — exposed as getters and in `EngineState` for UI binding.
- **`moveClip` returns constrained delta** — Returns the actually-applied delta (number), not void. Callers (e.g., dawcore clip handler) track this instead of raw pixel delta to avoid no-op undo entries when dragging against boundaries.
- **`_restoreTracks` uses incremental adapter updates** — Diffs old vs new tracks by reference. When track count is unchanged, calls `_updateTrackOnAdapter` per changed track (avoids full playout rebuild that interrupts playback). Falls back to `adapter.setTracks()` when tracks were added/removed.
- **`_transactionMutated` flag** — Set in `_pushUndoSnapshot` when inside a transaction. `abortTransaction` skips `_restoreTracks` when no mutations occurred, preventing a full adapter rebuild on click (no-op abort).
- **`undoLimit`** — Constructor option via `PlaylistEngineOptions`, `readonly` field. Default 100.
- **Console warn diagnostics** — `moveClip`, `trimClip`, `splitClip` log `console.warn('[waveform-playlist/engine] methodName: ...')` on invalid track/clip IDs. Tests exercising these paths must mock `console.warn`.
- **`tracksVersion` counter** — Monotonic counter in `EngineState` that increments only on track mutations (setTracks, addTrack, removeTrack, moveClip, trimClip, splitClip). Does NOT increment on selection/zoom/volume/loop changes. Used by the provider to detect track-specific statechange events and skip `loadAudio` rebuilds.
- **Engine is headless — no rAF loop** — `PlaylistEngine` has no `requestAnimationFrame` dependency. Consumers drive their own animation loops and call `engine.getCurrentTime()` per-frame. The `timeupdate` event was removed — poll `getCurrentTime()` instead.
- **Track audio state persistence** — `setTrackVolume/setTrackMute/setTrackSolo/setTrackPan` must update `this._tracks[]` in addition to forwarding to the adapter.
- **Clip operations use `updateTrack`, not `setTracks`** — `moveClip`, `trimClip`, `splitClip` call `_updateTrackOnAdapter(trackId)` which uses `adapter.updateTrack()` when available, falling back to `adapter.setTracks()`. This rebuilds only the affected track's clips on the adapter — other tracks keep playing uninterrupted.
- **`addTrack()` uses incremental adapter path** — When `adapter.addTrack` is defined, `PlaylistEngine.addTrack()` calls it instead of `adapter.setTracks()`. The `PlayoutAdapter.addTrack` method is optional (`addTrack?`) for backwards compatibility.
- **`updateTrack(trackId, track?)`** — Public method. Updates a single track on the adapter. When called with a `track` argument, also replaces it in `this._tracks` and emits statechange. Used by external callers (e.g., dawcore `addRecordedClip`).
