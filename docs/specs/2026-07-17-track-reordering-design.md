# Vertical Track Reordering — Design (Issue #612)

**Status:** Approved design, pre-implementation
**Branch:** `feature/track-reordering`
**Scope:** Engine + React (`browser`/`ui-components`) + dawcore, in one PR.

## Summary

Add vertical track reordering to both UI stacks. Track order is already just the
order of the tracks array (React renders `tracks[i]` top-to-bottom; dawcore
derives order from `<daw-track>` light-DOM child order), so the engine gains a
single permutation operation and both UIs build interaction layers on top of it:

- **Engine:** `reorderTrack(trackId, toIndex)` — undoable, no adapter call.
- **React:** `useSortable` from `@dnd-kit/react/sortable` (already shipped in
  the installed `@dnd-kit/react@0.3.2`) + move up/down buttons, opt-in via a
  boolean prop.
- **dawcore:** pointer-handler drag + move up/down buttons on
  `<daw-track-controls>`, opt-in via a `track-reordering` attribute. DOM order
  stays the visual authority, bidirectionally synced with the engine.
- **Accessibility:** move up/down buttons are the primary control (WCAG 2.2
  SC 2.5.7 requires a single-pointer alternative to any drag); drag is the
  enhancement. Reordering is purely organizational — it never affects playback
  or the mix.

## Decisions made during brainstorming

1. **All three surfaces in one branch** (engine, React, dawcore).
2. **Undo/redo included.** Every track mutation already pushes an undo
   snapshot; reorder does the same. Skipping it would make reorder the odd one
   out.
3. **dawcore: file-dropped tracks get real `<daw-track>` elements.** The
   programmatic `editor.addTrack()` API already builds light-DOM elements and
   lets the event pipeline load them; file drop is the one path that bypasses
   this. Routing it through the element pipeline removes a special case and
   gives every normal track a DOM node.
4. **dawcore order sync is bidirectional.** Editor-initiated reorders move the
   DOM node; consumer-initiated DOM moves sync into the engine; engine-initiated
   order changes (undo/redo) move DOM nodes to match.

## Section 1: Engine (`@waveform-playlist/engine`)

New method on `PlaylistEngine`, alongside `addTrack`/`removeTrack`, following
`EffectsChainController.move`'s filter-then-splice idiom:

```typescript
reorderTrack(trackId: string, toIndex: number): void
```

Behavior:

- **No-op guards:** unknown `trackId`, or track already at the (clamped) target
  index → return early. No undo snapshot, no version bump, no event.
- **Clamping:** `toIndex` clamps to `[0, tracks.length - 1]`.
- **Mutation:** `_pushUndoSnapshot()` → immutable rebuild of `_tracks`
  (filter out the track, splice into the new position — new array, no in-place
  mutation) → `_tracksVersion++` → `_emitStateChange()`.
- **No adapter call.** Order is not audible: each track's audio nodes are keyed
  by id. Calling the adapter (worst case `setTracks` = full playout rebuild)
  would interrupt playback for a purely visual change. This is the one place
  reorder deliberately differs from add/remove.
- **Undo/redo:** the existing snapshot machinery restores the previous array
  order — no new undo code.

## Section 2: React (`browser` + `ui-components`)

### Ownership and control surface

`tracks` stays React-owned (the established direction: React mirrors *into*
the engine). The provider gains:

```typescript
reorderTrack(trackId: string, toIndex: number): void
```

exposed via `usePlaylistControls`. It permutes the provider's tracks state
immutably and calls `engine.reorderTrack`. Everything rendered from the array
(peaks, controls, rows) reorders automatically because keys are already
`track.id` (stable-key rule; index keys would break `transferControlToOffscreen`).

### Drag UI

- `useSortable` from `@dnd-kit/react/sortable` per track control-panel row.
  The subpath ships inside the installed `@dnd-kit/react@0.3.2`; add an
  explicit dependency entry, no version change.
- Registered inside the **existing** `ClipInteractionProvider`
  `DragDropProvider` — sortable track rows and draggable clips coexist under
  one provider; the drag-end handler branches on the operation's source type.
  No nested providers, one interaction model.
- Track drags restricted to the vertical axis.
- Touch works via the existing touch-optimized sensors.

### Affordances (new ui-components primitives, following existing icon/button patterns)

- **Grip handle** (`GripIcon` button, ⠿-style) in the track `Header` — the only
  drag-activation surface, so it never fights mute/solo or the sliders.
- **Move up / move down chevron buttons** — the primary, accessible control,
  wired to the same `reorderTrack`. Disabled at the ends (first track can't
  move up, last can't move down).

### Opt-in

Boolean prop, default `false` per convention: `<Waveform trackReordering />`
gates both the handle and the buttons. Consumers using a custom
`renderTrackControls` can call `reorderTrack` from `usePlaylistControls`
directly.

## Section 3: dawcore (`@dawcore/components`)

### Order model: DOM is the visual authority, engine kept in sync

- **File drop routes through the element pipeline.** `loadFiles()`
  (`interactions/file-loader.ts`) is rewritten to build
  `<daw-track name="…"><daw-clip src="blobURL">` per file and append it to the
  editor's light DOM. The existing `daw-track-connected` → `_loadTrack`
  pipeline does the fetch/decode, same as `editor.addTrack()`. Blob URLs are
  revoked after decode (existing pattern). `loadFiles` keeps its
  `{ loaded, failed }` return by awaiting per-track ready/error events the way
  `addTrack()` already does. After this change, every normal track has an
  element; `_getOrderedTracks()`'s element-less fallback branch survives only
  for undo-resurrected tracks. The synthesized DOM is structurally identical to
  authored markup but not reloadable across a page refresh (dropped file bytes
  exist only in memory).
- **Single write path for reorder: move the DOM node.** Editor-initiated
  reorders (drag or buttons) physically move the `<daw-track>` element; the
  MutationObserver detects the move and syncs `engine.reorderTrack`.
  Consumer-initiated `insertBefore` flows through the identical path for free.
- **MutationObserver move detection:** a node appearing in both `removedNodes`
  and `addedNodes` within one mutation batch is a *move*, not a removal —
  handled as a reorder instead of today's teardown + reload.
- **Engine → DOM direction (undo/redo):** the engine `statechange` handler
  compares engine track order against DOM order and moves elements to match
  when they diverge.
- **Loop safety:** write-only-on-change (the established annotation-sweep
  pattern). Before syncing in either direction, check whether the orders
  already match — a sync-triggered mutation converges in one pass instead of
  ping-ponging.

### UI affordances (mirroring React)

- `<daw-track-controls>` gains a grip handle + move up/down buttons, gated by a
  new `track-reordering` boolean attribute on `<daw-editor>`, threaded down as
  a property.
- Buttons dispatch a new `daw-track-reorder` event, detail
  `{ trackId, toIndex }`, typed in `DawEventMap` (naming mirrors
  `daw-effect-reorder`). The editor handles it by moving the DOM node.
- **Drag:** new `interactions/track-reorder-handler.ts` following the
  `pointer-handler.ts` host-interface pattern:
  - Grip `pointerdown` surfaced from the controls' shadow DOM via a composed
    event, then `setPointerCapture`.
  - Y-position hit-testing against control rows via `getBoundingClientRect()`
    (the shadow-DOM-safe technique — `closest()` can't cross shadow
    boundaries).
  - Translate-based visual preview during the drag.
  - Commit on `pointerup` → DOM move; `pointercancel` reverts (per the
    existing every-drag-needs-a-cancel-terminal rule).
  - Pointer events cover mouse, touch, and pen uniformly.

## Section 4: Testing

- **Engine** (`PlaylistEngine.test.ts`, `undo.test.ts`): resulting order;
  clamping; no-op guards; `tracksVersion` bump; `statechange` emission; **no
  adapter calls**; undo/redo restores order.
- **dawcore** (vitest/happy-dom): `loadFiles` element synthesis with
  `{ loaded, failed }` semantics preserved; observer move-vs-removal
  discrimination (a track survives `insertBefore` with buffers intact);
  `daw-track-reorder` event handling; engine → DOM sync on undo; no infinite
  sync loop.
- **browser**: provider `reorderTrack` permutes state and calls the engine;
  buttons render and disable correctly at the ends.
- **e2e** (Playwright): reorder via the accessible buttons (robust in CI)
  asserting visual row order; a drag smoke test only if it proves stable.

## Section 5: Documentation sweep

Per the CLAUDE.md keep-all-doc-surfaces-in-sync rule: `llm-reference.md`,
`llms.txt`, `docs/api/hooks.md`, provider API docs, dawcore `COMPONENTS.md` +
the element entries in `packages/dawcore/CLAUDE.md`, and the root README if a
demo page is added.

## Out of scope (follow-ups)

- Keyboard reordering shortcut (beyond the buttons' inherent keyboard
  operability).
- Reordering `<daw-annotation-track>` lanes.
- HTML5 drag-and-drop is deliberately not used (no touch support for
  `dragstart`, unstylable ghost, no accessible pattern; see issue #612's
  standards note).
