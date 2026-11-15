# Clip drag, trim and snapping

Notes of Browser Package (`@waveform-playlist/browser`), moved out of the package's `CLAUDE.md`. Read before changing `useClipDragHandlers`, `ClipInteractionProvider`, a dnd-kit handler or modifier, or snap-to-grid.

## Trim/Move Asymmetry in useClipDragHandlers

Both end in ONE engine call, made on release: a move is `engine.moveClip()` on drop, a trim `engine.trimClip(trackId, clipId, boundary, delta)`. Neither opens an engine transaction; one call is one undo step. They differ in what the user sees meanwhile.

**Move:** nothing is computed until the drop. The Feedback plugin draws the dragged clip and the collision modifier constrains the visual position per frame with the engine's pure `constrainClipDrag` function. A cancelled move needs nothing: the plugin puts the clip back and the engine was never told.

**Trim (#812): a view-only preview.** `onDragStart` records the clip's bounds (`TrimDrag`: ids, boundary, `startSample`, `durationSamples`, `offsetSamples`). Each `onDragMove` computes the delta from those bounds (never from the previous move): `calculateBoundaryTrim`, then the boundary's absolute position snapped, then `engine.constrainTrimDelta` (the engine has not been changed during the drag, so it constrains from the same bounds the release will use; with no engine the bounds from drag start decide). The result is published as a `TrimPreview` (`trackId`, `clipId`, `startSample`, `durationSamples`, `offsetSamples`) to the provider's `TrimPreviewContext`. `tracks` and the engine are not changed, and `onTracksChange` is not called (`constrainTrimDelta` is a query). `lastBoundaryDeltaRef` holds the delta of the last preview, which is what the release sends, so the preview shows what the release commits.

**Who follows the preview.** Only the dragged clip's `ClipView` (`usePreviewedClipPeaks` in `hooks/useTrimPreviewView.ts`, a `useSyncExternalStore` whose snapshot is `null` unless the preview names that clip) and the root (`useTrimPreviewExtent`, for the width). The previewed clip's drawing record comes from `TrimPreviewPeaksContext.peaksFor`, which runs the same per-clip step as `derivePeaks` (`clipPeaksFor`) over the latest tracks, so the waveform is the slice for the previewed offset. The two contexts are INTERNAL (not exported from the package or `/tone`), blocked under the MediaElement provider; `useTrimPreviewOptional()` and `useTrimPreviewPeaksOptional()` turn blocked or absent into "no preview" because the clip rows are shared by both providers. The preview is not public until a use case needs it (maintainer's decision).

**The spectrogram follows the preview.** `ClipView` passes the drawn record's `offsetSamples` / `durationSamples` to `SmartChannel` (`spectrogramOffsetSamples` / `spectrogramDurationSamples`), `SpectrogramChannel` registers each canvas with them and keys its canvases on them, and `SpectrogramProvider` draws each clip for the range its canvases registered with. So a move mounts and registers new canvases for the dragged clip only (as the length change did when a trim changed `tracks` per move) and the provider renders them; the release registers nothing, because the committed clip has the range the canvases were drawn for; Escape and an undo of a trim register the committed range again. A clip move changes neither field (the picture is drawn in clip coordinates), so its canvases register again only when the drawn width changes, as before. Tests: `trimPreviewSpectrogram.test.tsx`, ui-components' `SpectrogramChannelRange.test.tsx`, spectrogram's `registeredRange.test.tsx`.

**Width past the end.** While the previewed end is past `duration`, the root's `displayDuration` is that end rounded UP to the next 10 seconds (`TRIM_EXTENT_STEP_SECONDS`, the recording layout's `RECORDING_EXTENT_STEP_SECONDS`), so the root renders once per step and not per move; after the release the width is the exact new duration. `useTrimPreviewExtent` returns the stepped number as its snapshot for that reason.

**Release.** `commitTrim` runs `engine.trimClip()` and clears the preview inside `flushSync`. dnd-kit calls `onDragMove` and `onDragEnd` inside `startTransition`; there the app's `setTracks` (reached through `trimClip` and `onTracksChange`) is a transition update, while clearing the preview re-renders the clip at once (`useSyncExternalStore`). Without `flushSync` around both, the clip is drawn cleared over the old tracks for a frame, back at its old start (the release test in `trimPreview.test.tsx` fails without it). `trimClip` reaches the app's state through the provider's `onTracksChange` synchronously, within that call.

**Cancel.** `event.canceled` (Escape, focus loss, unmount) clears the preview and changes nothing: there is no state to revert, because none was changed. A drag that never ends (the component unmounts mid-drag) clears its preview in an effect cleanup, only when a trim is in progress. Same shape in `useAnnotationDragHandlers` (`annotationPreview`).

**No engine attached** (before the first build, or while the provider rebuilds after a `tracks` change that did not come from the engine): a trim or a move released then is dropped with a console warning and the clip stays where it was. Before #812 the app's state kept the per-move trim while the engine did not have it. (Maintainer accepted the drop for this part.)

**Clips are found by id.** The drag data keeps `clipId`, `trackIndex` and `clipIndex`, but the handlers and `ClipCollisionModifier` find the clip with `tracks[trackIndex].clips.find((c) => c.id === clipId)`: `clipIndex` is a position in the drawn row, which can hold placeholders that are not in `track.clips`. A clip id that is not in the track does nothing. `useClipSplitting().splitClipAt(trackId, clipId, splitTime)` is by id too.

**Why not `engine.trimClip()` per frame:** engine methods apply deltas to the current state, and the handler computes each move from the bounds at drag start; per-frame calls would compound them (and each would be a `tracks` change and an undo step).

**`isDraggingRef` is gone.** The provider's loading effect no longer skips anything for a drag, and `skipEngineDisposeRef` is `isEngineTracks || isIncrementalAdd`. A `tracks` change during a trim is an ordinary one. Do not reintroduce a flag that makes the provider ignore `tracks`: that is a second owner of the tracks (see "One Owner per Piece of State").

**Render scope** (a browser probe counted 22 components per move with one trigger root, `ClipView`, on `/examples/multi-clip`: measured in a probe run on 2026-11-14, not a test in the repository). Tests that pin it: `trimPreview.test.tsx` ("a move renders the dragged clip's view and no other clip, row or the root"), `visualizationMemoBoundaries.test.tsx`, `contextSplitByChangeRate.test.tsx`.

## Stable Drag Handlers and Modifiers (#694)

Anything keyed on `tracks` is rebuilt by every clip operation, also one that lands mid-drag (an undo, a recording, audio arriving for a clip), and a rebuilt handler or modifiers array is handed to `DragDropProvider` anew. (Until #812 a trim also changed `tracks` on every pointer move; it no longer does.) Three things are therefore read through refs instead:

- `useClipDragHandlers` reads `tracks` from a ref; `onDragStart` never changes, `onDragMove` changes identity only with `samplesPerPixel`/`sampleRate` and `onDragEnd` only with `samplesPerPixel` (both also with the stable `engineRef` and preview). A trim's `onDragMove` finds the track by the id captured at drag start, not by `data.trackIndex`, so a reorder mid-drag does not lose it.
- `ClipInteractionProvider` passes `ClipCollisionModifier.configure({ tracks: getTracks, … })` with a stable getter (the option accepts `ClipTrack[] | (() => ClipTrack[])`), so the `modifiers` array handed to `DragDropProvider` is not rebuilt mid-drag.
- Clip order: `sortedClipsOf(clips)` (`src/utils/sortedClips.ts`) caches the sorted copy per clips array in a `WeakMap`; during a move the array is not replaced, so `ClipCollisionModifier.apply` sorts once. A trim no longer replaces the array per move, and `onDragStart` records the trimmed clip's `sortedClips`/`sortedIndex` once in `trimOrderRef`; only the neighbours are read from it (`constrainBoundaryTrim`). Each move checks, by identity, that every other clip of the track is still the one the order was computed from, and recomputes if not (an undo during the trim, a recording landing on the track).

`useKeyboardShortcuts` likewise keeps the latest `shortcuts` in a ref and subscribes to `keydown` once per `enabled` value; callers build the array inline. Guarded by `stableDragHandlers.test.tsx`, which mocks `@dnd-kit/react`'s `DragDropProvider` to capture the props it is given.

## Clip Interaction Options Have One Source (#690)

Whether clips can be dragged and trimmed (`enabled`) and whether their trim handles are widened for touch (`touchOptimized`) come from ONE place: `ClipInteractionContext` (`contexts/ClipInteractionContext.tsx`), read by `ClipView` for what a clip does, and by `ClipInteractionProvider` only to inherit `touchOptimized` (below). `ClipInteractionOptions` (exported) is the only component that provides it; `ClipInteractionProvider` renders `<ClipInteractionOptions enabled touchOptimized={…}>` around its `DragDropProvider`. The view's compositions and parts take neither as a prop, and neither is threaded through `TrackRows` / `TrackRow`.

- A prop left out of `ClipInteractionOptions` is inherited from the one above (`??`, not `||`), so it nests: `<ClipInteractionOptions touchOptimized={false}>` inside a touch-optimized provider keeps 8px handles and stays interactive, and `enabled={false}` switches interaction off for part of the tree.
- `ClipInteractionProvider` resolves its own `touchOptimized` the same way (`prop ?? inherited`) and uses that one value for `useDragSensors` and for the `ClipInteractionOptions` it renders, so sensors and handle width cannot disagree and a provider inside `<ClipInteractionOptions touchOptimized>` inherits it.
- The value is memoized on its two booleans. `ClipInteractionProvider` renders on every change of `tracks` (every clip operation); an unmemoized value would re-render every clip each time.
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
