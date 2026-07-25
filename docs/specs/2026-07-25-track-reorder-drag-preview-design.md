# Track Reorder Drag Preview — Design

**Status:** Approved direction (2026-07-25). Working document — `git rm` before the PR merges; the PR description carries the durable record.

## Problem

During a track-reorder drag (#612), only the dragged track's *controls row* moves with the
pointer. Its waveform stays put, and the other tracks give no indication of where the drop
would land until `mouse.up`. Desired UX (user-confirmed):

- The dragged track's waveform moves with the drag — **slot-snap**: it jumps into the
  hovered slot as each boundary is crossed (not pixel-following the cursor).
- Underlying tracks (waveform rows *and* their control panels) **slide out of the way**
  (~150 ms) to preview the drop position, in both columns, staying in sync.
- The dragged controls row is **fully opaque** (currently 0.85), reading as "lifted" via a
  subtle shadow instead of transparency.
- Escape/cancel animates everything back; drop commits with no extra motion.

## Constraint that shapes the design

Controls live in `ControlsColumn` *outside* the horizontal scroll container; waveforms live
inside it. They can never be one drag element, so the waveform side must mirror the drag.
Additionally, dnd-kit's `OptimisticSortingPlugin` re-splices the controls rows' DOM order
mid-drag (React-blind; see browser/CLAUDE.md "Track Reordering") — any design that lets
visual position depend on DOM flow order either fights those splices or needs FLIP
measurement. The enabling move is to make row position independent of DOM order.

## Design

### 1. Preview plumbing (view-level only)

`ClipInteractionProvider.onDragOver` already receives sortable events; for
`kind: 'track-reorder'` it publishes `trackDragPreview: { trackId, toIndex } | null`
whenever `source.sortable.index` changes, and clears it on drag end *and* cancel. Exposed
on `usePlaylistData()` (low-frequency state — one update per boundary crossing); the
internal setter lives on the controls context beside `bumpTrackReorderEpoch`. The engine,
`tracks`, `trackStates`, and undo history are untouched until the existing `onDragEnd`
commit path calls `reorderTrack` — preview is pure view state.

`applyTrackOrderPreview(tracks, preview)` (pure, `src/utils/`): returns the display order
with the dragged track moved to `toIndex`; identity when preview is null.

### 2. Shared vertical layout map + absolutely-positioned rows

`computeTrackLayout(orderedIds, heightsById)` (pure, `src/utils/`): returns
`{ topById, totalHeight }`. Heights are already known per track
(`waveHeight × channels + clipHeaderHeight` — the existing `slotHeight` formula; varying
heights per track are handled naturally).

Both columns render from the **same** layout map, so they cannot drift mid-preview:

- **Waveform column** (`PlaylistVisualization` track rows): rows become
  `position: absolute` with `.attrs()`-style `transform: translateY(top)` (frequently
  changing value → inline style, per the styled-components rule); the container gets
  explicit `totalHeight`. Rows keep stable `track.id` keys and their DOM order — only the
  transform changes with the preview.
- **Controls column** (`ControlSlot`s): same treatment. This makes
  `OptimisticSortingPlugin`'s DOM splices **visually inert** — position comes from our
  transform, not flow. The popover healer (visibility) and the epoch remount (fiber
  bookkeeping) remain unchanged and required.

**Animation** is now just `transition: transform 150ms ease` on the rows — no FLIP, no
measurement. Gated by a `trackDragActive` flag set on track-reorder drag start and cleared
~200 ms *after* drag end (trailing clear so the cancel-revert still animates); outside a
drag, layout changes (zoom, track add/remove) apply instantly as today. Disabled entirely
under `prefers-reduced-motion`.

Slot-snap and cancel fall out for free: boundary crossing → new preview order → new tops →
rows (including the dragged track's waveform) slide; cancel → preview null → tops revert →
rows slide back; drop → committed order equals previewed order → tops unchanged → no
motion.

### 3. Opaque lifted row

Drag-source opacity 0.85 → 1 in `PlaylistVisualization`'s sortable wrapper; add a
box-shadow while `isDragSource` so the floating row still reads as lifted.

### 4. dawcore parity (`@dawcore/components`)

dawcore's hand-rolled `TrackReorderHandler` already pixel-follows the dragged controls row
and shifts displaced controls rows out of the way (instant, transform-only, revert on
cancel). Two gaps close for parity:

- **Waveform-lane preview:** extend `TrackReorderHost` so `<daw-editor>` supplies the
  track lane elements (`<daw-track>` per trackId) alongside the controls rows. At grab,
  the handler snapshots lane rects too; on every `_targetIndex` change it applies the same
  shift map to lanes — displaced lanes shift by ±dragged-lane-height, and the dragged
  track's lane slot-snaps to the target slot (target top − origin top, computed from lane
  rects, which may differ from controls-row heights). Transform-only, so the editor's
  MutationObserver DOM↔engine order sync never fires mid-drag (transforms are not
  childList mutations); `_cleanup()` clears lane styles exactly as it clears row styles
  (including the editor-disconnect cancel path).
- **Animation:** inline `transition: transform 150ms ease` set on rows and lanes at grab,
  cleared in `_cleanup()`; skipped when `matchMedia('(prefers-reduced-motion: reduce)')`
  matches. The dragged controls row keeps *no* transition (it pixel-follows the pointer);
  the dragged lane keeps the transition (it slot-snaps).

## Edge cases and accepted trade-offs

- **Transformed `ControlSlot` + `position: fixed`:** a transform makes the slot a
  containing block for fixed descendants. Irrelevant in popover-capable browsers (the
  dragged row is in the top layer, which escapes containing blocks); in pre-Popover
  browsers (~2023) dnd-kit's fixed fallback would mis-anchor. Accepted degradation.
- **Auto-scroll during drag:** tops are container-relative; scrolling doesn't invalidate
  them. Collision sampling is dnd-kit's concern, unchanged.
- **Custom `renderTrackControls` consumers:** the default panel path gets everything
  automatically ( `ControlSlot` is library-rendered). Custom consumers can read
  `trackDragPreview` from `usePlaylistData()`; documenting that is in scope, restructuring
  their layouts is not.

## Non-goals

- Virtualizing the track list (the layout map is a prerequisite, not the feature).
- Pixel-following waveform, insertion-line indicator (rejected in brainstorming).
- Live-committing `reorderTrack` per crossing (undo churn, statechange floods, and
  re-rendering dnd-kit-managed rows mid-drag reopens the #612 corruption class).
- Animating via FLIP-on-splice observers (superseded by the layout map).

## Testing

- **Unit (vitest):** `applyTrackOrderPreview` (move up/down/first/last/identity/null),
  `computeTrackLayout` (varying heights, totalHeight), preview lifecycle in
  `ClipInteractionProvider` (set on index change, cleared on end *and* cancel).
- **Unit (dawcore, `track-reorder-handler.test.ts`):** lane shift map mirrors the row
  shift map on target changes; dragged lane slot-snap offset; cleanup (pointerup,
  pointercancel, editor disconnect) clears lane transforms and transitions.
- **e2e (`track-reorder.spec.ts`):** mid-drag, waveform-column `data-track-id` rect order
  already shows the previewed order before `mouse.up`; Escape reverts both columns to the
  original order; existing drop-commit and mixer-identity assertions unchanged. The
  dawcore-native reorder e2e gains the same mid-drag lane-order assertion.
