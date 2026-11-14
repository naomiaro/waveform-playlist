# Clip drag, trim and snapping

Notes of Browser Package (`@waveform-playlist/browser`), moved out of the package's `CLAUDE.md`. Read before changing `useClipDragHandlers`, `ClipInteractionProvider`, a dnd-kit handler or modifier, or snap-to-grid.

## Trim/Move Asymmetry in useClipDragHandlers

**Move:** `onDragEnd` delegates to `engine.moveClip()` in one shot. The collision modifier constrains the visual position per-frame using the engine's pure `constrainClipDrag` function.

**Trim:** `onDragMove` updates React state per-frame via `onTracksChange` for smooth visual feedback (cumulative deltas from original clip snapshot). `isDraggingRef` prevents `loadAudio` from rebuilding the engine during the drag, so the engine keeps the original (pre-drag) clip positions. On drag end, `engine.trimClip()` commits the final delta.

**Why not `engine.trimClip()` per frame:** Engine methods apply incremental deltas to current state. The drag handler computes cumulative deltas from the original snapshot. Calling the engine per frame would compound deltas incorrectly.

**`isDraggingRef` lifecycle:** Set `true` in `onDragStart` (boundary trim only), set `false` in `onDragEnd` before `engine.trimClip()`. Guards two places in the provider: (1) `loadAudio` effect body skips full rebuild, (2) `skipEngineDisposeRef` prevents the previous effect cleanup from disposing the engine mid-drag.

**Cancel-revert for boundary trims:** `onDragEnd` checks `event.canceled` and restores React state from `originalClipStateRef` snapshot. Without this, Escape during trim leaves UI at partially-trimmed state while engine has original positions. Same pattern in `useAnnotationDragHandlers` with `originalAnnotationStateRef`.

**`skipEngineDisposeRef` must include `isDraggingRef`:** During drag, `onDragMove` triggers `loadAudio` re-runs (because `tracks` is in deps). The previous effect's cleanup checks `skipEngineDisposeRef` — if it only checks `isEngineTracks` (which is `false` during drag), it disposes the engine on the first drag move.

## Stable Drag Handlers and Modifiers (#694)

A boundary trim calls `onTracksChange` on every pointer move, so anything keyed on `tracks` is rebuilt per move. Three things are therefore read through refs instead:

- `useClipDragHandlers` reads `tracks` and `onTracksChange` from refs; `onDragStart`/`onDragMove`/`onDragEnd` change identity only with `samplesPerPixel`/`sampleRate`.
- `ClipInteractionProvider` passes `ClipCollisionModifier.configure({ tracks: getTracks, … })` with a stable getter (the option accepts `ClipTrack[] | (() => ClipTrack[])`), so the `modifiers` array handed to `DragDropProvider` is not rebuilt mid-drag.
- Clip order: `sortedClipsOf(clips)` (`src/utils/sortedClips.ts`) caches the sorted copy per clips array in a `WeakMap`; during a move the array is not replaced, so `ClipCollisionModifier.apply` sorts once. A trim replaces the array every move, so `onDragStart` records the trimmed clip's `sortedClips`/`sortedIndex` once in `trimOrderRef`; only the neighbours are read from it (`constrainBoundaryTrim`). Each move checks, by identity, that every other clip of the track is still the one the order was computed from, and recomputes if not (an undo during the trim, a recording landing on the track).

`useKeyboardShortcuts` likewise keeps the latest `shortcuts` in a ref and subscribes to `keydown` once per `enabled` value; callers build the array inline. Guarded by `stableDragHandlers.test.tsx`, which mocks `@dnd-kit/react`'s `DragDropProvider` to capture the props it is given.

## Clip Interaction Options Have One Source (#690)

Whether clips can be dragged and trimmed (`enabled`) and whether their trim handles are widened for touch (`touchOptimized`) come from ONE place: `ClipInteractionContext` (`contexts/ClipInteractionContext.tsx`), read by `ClipView` for what a clip does, and by `ClipInteractionProvider` only to inherit `touchOptimized` (below). `ClipInteractionOptions` (exported) is the only component that provides it; `ClipInteractionProvider` renders `<ClipInteractionOptions enabled touchOptimized={…}>` around its `DragDropProvider`. The view's compositions and parts take neither as a prop, and neither is threaded through `TrackRows` / `TrackRow`.

- A prop left out of `ClipInteractionOptions` is inherited from the one above (`??`, not `||`), so it nests: `<ClipInteractionOptions touchOptimized={false}>` inside a touch-optimized provider keeps 8px handles and stays interactive, and `enabled={false}` switches interaction off for part of the tree.
- `ClipInteractionProvider` resolves its own `touchOptimized` the same way (`prop ?? inherited`) and uses that one value for `useDragSensors` and for the `ClipInteractionOptions` it renders, so sensors and handle width cannot disagree and a provider inside `<ClipInteractionOptions touchOptimized>` inherits it.
- The value is memoized on its two booleans. `ClipInteractionProvider` renders on every pointer move of a trim (it follows `tracks`); an unmemoized value would re-render every clip per move.
- History, so it is not repeated: a first version (#773, reverted by #774) kept the two `<Waveform>` props and combined them with the context using `||`. Two sources meant no prop could switch off what the provider turned on, and `<PlaylistVisualization>` changed behaviour under the provider without anyone having decided it. The maintainer's rule for these components (2026-11-11): no doubled sources; a small context with a value that rarely changes, read where it is used, instead of props passed down through components that do not use them.
- A view option that every clip needs and that never changes per frame belongs in a context like this one. `samplesPerPixel` and `sampleRate` are still props of `ClipView`: they were kept as props while the data context that held them changed on every trim move. Since #768 they are in the view and zoom values, which do not, so `ClipView` could read them itself (not done; #685 reshapes these components).

Tests: `clipInteractionOptions.test.tsx` (it mocks `useDragSensors` to record the options the provider passes). `e2e/mobile-multi-clip.spec.ts` checks the 24px handles on a page that sets only the provider flag. `/examples/custom-drag-setup` (`CustomDragSetupExample.tsx`) is the custom path for real: its own `DragDropProvider` plus `ClipInteractionOptions`, with a checkbox per option; `e2e/custom-drag-setup.spec.ts` drags and trims there by exact pixel distances, switches interaction off and on, and checks the handle widths. In that spec a clip is dragged by pressing 8px below the top of its `[data-clip-container]` (the header strip), which works whether or not the header is a draggable; clip positions are whole pixels, so compare within 1px of the computed value.

## SnapToGridModifier (Beats & Bars)

**Location:** `src/modifiers/SnapToGridModifier.ts`

**Two modes via discriminated union:**

- `mode: 'beats'` — Quantizes in PPQN tick space (bar or beat grid). Uses `samplesToTicks` → `snapToGrid` → `ticksToSamples` round-trip.
- `mode: 'timescale'` — Quantizes by `gridSamples` (consumer typically derives this from `getScaleInfo(samplesPerPixel).smallStep * sampleRate / 1000`).

**Boundary trims:** Modifier skips trims (returns `transform` unchanged). Trim snapping is handled in `useClipDragHandlers` via optional `snapSamplePosition` callback.

**Consumer pattern:** Example conditionally includes modifier in array (exclude entirely when snap is off) rather than relying solely on the modifier's internal `snapTo === 'off'` guard.

## Snap-to-Grid: Absolute Position, Not Delta

**Decision:** Snap the clip's absolute timeline position to the grid, not the drag delta.

**Why:** Delta-snapping preserves off-grid offsets permanently — if a clip starts off-grid (from collision, initial placement, or trimming), snapping the delta to grid-sized increments keeps it at the same offset from every grid line.

**Move snapping (SnapToGridModifier):** Reads `startSample` from `source.data`, computes `proposedPosition = startSample + delta`, snaps that to grid, derives delta as `(snappedPosition - startSample) / samplesPerPixel`.

**Trim snapping (useClipDragHandlers):** Optional `snapSamplePosition` callback. After `calculateBoundaryTrim`, snaps the boundary's absolute position (left → snap `startSample`, right → snap end position). Stored in ref to avoid dependency churn. `lastBoundaryDeltaRef` uses the effective (snapped) delta so `engine.trimClip()` gets the correct value.

**Draggable data:** `Clip.tsx` includes `startSample` and `durationSamples` in all draggable `data` objects (clip move + both boundary handles) so modifiers can compute absolute positions.
