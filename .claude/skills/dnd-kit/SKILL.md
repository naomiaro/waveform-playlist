---
name: dnd-kit
description: Use when writing, changing or debugging code that uses @dnd-kit - useDraggable, useSortable, DragDropProvider, a drag event handler, a modifier, a sensor or the Feedback plugin, in clip move and trim, track reorder or annotation edge drags - when a dragged element disappears, jumps, animates back or lands in the wrong place, when upgrading @dnd-kit, and when working on issue 796.
---

# dnd-kit in this codebase

Installed: `@dnd-kit/react` / `@dnd-kit/dom` / `@dnd-kit/abstract` 0.5.0, as PEERS of `browser`, `ui-components` and `annotations` (never `dependencies`: see "Feedback is configured per entity"). A range bump of a 0.x peer is a major for all three (root `CLAUDE.md`, "Semantic Versioning").

**Read the library, do not guess.** A checkout of clauderic/dnd-kit is at `/Users/naomiaro/Code/dnd-kit` (newer than what is installed). Pin a read to the installed version's tag: `git show '@dnd-kit/react@0.5.0^{commit}:packages/dom/src/core/plugins/feedback/Feedback.ts'`. Key files: `packages/dom/src/sortable/` (`OptimisticSortingPlugin`, `SortableKeyboardPlugin`), `packages/dom/src/core/plugins/feedback/Feedback.ts`, `packages/abstract/src/core/plugins/registry.ts` (`register()` overwrites an existing instance's options), `packages/abstract/src/core/manager/events.ts` (the event object types), `packages/react/src/`.

**Issue #796** lists the three workarounds we carry for 0.5.0 sortables (the popover healer for `feedback: 'move'`, the slot remount after a reorder drag, the late `dragover`) and asks for each to be checked against the latest release in a standalone page, and filed upstream only when it reproduces there. The workarounds themselves are described in `packages/browser/notes/track-controls-and-reorder.md`, "Track Reordering (#612)".

## Events (0.5.0)

- **`event.operation.position.delta`** is `undefined` in snapshots — `@derived` getters are non-enumerable and stripped by `snapshot()`. Compute manually: `position.current.x - position.initial.x`.
- **`event.operation.position.current`** is stale in `onDragMove` — `move()` dispatches before updating `position.current` (happens in `queueMicrotask`). Use `event.to?.x` for the correct pointer position (`to?: Coordinates` is typed on the dragmove event).
- **`event.operation.transform.x`** in `onDragEnd` reflects the final post-modifier transform. Use for clip moves; for boundary trims, cache the last delta from `onDragMove` in a ref.
- **Event types are event OBJECTS, not handler types** (0.4+ redesign): `DragStartEvent`/`DragMoveEvent`/`DragEndEvent` from `@dnd-kit/abstract` are used directly as the handler parameter type. The 0.3-era `Parameters<DragStartEvent>[0]` collapses to `never` (build error, not a runtime bug).
- **Feedback config is per-entity, never provider-level** (0.4+ moved `feedback` out of the hook options into `plugins: [Feedback.configure({...})]`). `Clip.tsx` declares `dropAnimation: null` on the clip-move draggable and `feedback: 'none'` on trim handles itself; `useTrackReorderHandle` (`SortableTrackControls` until #687) uses the FUNCTION form `plugins: (defaults) => [...defaults, Feedback.configure({ feedback: 'move' })]` so the sortable's default `OptimisticSortingPlugin`/`SortableKeyboardPlugin` survive (a bare array replaces them and drag-commit silently stops working — guarded by `trackReorderHandleFeedbackPlugins.test.tsx`). The former `noDropAnimationPlugins` provider helper was REMOVED: in 0.5 every entity that carries its own Feedback config re-registers the plugin with `undefined` options (`Draggable` effect → `registry.plugins.register(plugin)` → `existingInstance.options = undefined`), which wipes provider-level Feedback options the moment a clip mounts — provider-level `dropAnimation: null` is unreliable by construction. Per-entity `dropAnimation` takes precedence over the plugin instance (`Feedback.ts` resolution order), so the entity-level declaration is the only robust one. `sortable.ts` likewise reads only `draggable.pluginConfig(Feedback)?.feedback` for its `'move'` handling — a provider-level `feedback` callback never reaches it.
- **Per-entity config matches `Feedback` by constructor identity** (`pluginConfig` does `desc.plugin === plugin`). Two copies of `@dnd-kit/dom` in a bundle make `'none'`/`'move'` silently no-op — keep `@dnd-kit/*` as peers (never `dependencies`) in every published package.

- **dnd-kit can send a `dragover` after the `dragend` of a canceled drag.** It set the reorder preview again for good (Escape mid-drag, 6 of 6 e2e runs on #687). A handler that publishes drag state checks that a drag is in progress (#796 tracks the dnd-kit workarounds).
- **dnd-kit 0.5.0 calls `onDragMove` and `onDragEnd` inside `startTransition`** (`trackRendering` in its `DragDropProvider`). A state update made from a handler is a transition update; a `useSyncExternalStore` publish from the same handler renders synchronously. So "clear the preview and commit" on release shows one frame of the old geometry unless both run inside `flushSync` (#812, the trim release: without it the clip was drawn at `[96000, 121000]`). A unit test that calls a captured handler directly cannot see that frame: call it as dnd-kit does, `act(() => startTransition(() => handler(event)))` (`dispatch` in `packages/browser/src/__tests__/trimPreview.test.tsx`), and the missing `flushSync` fails the test.
- **A draggable's `data` follows renders during a drag** (`useOnValueChange(data, …)` in @dnd-kit/react 0.5.0): when what is drawn changes under a drag (an insert before the dragged row), the next `dragmove` carries the NEW index. Read the item from `data` at drag start, keep its id in the drag state, and find it by id on each move (`useAnnotationDragHandlers`, #898).

## Feedback is configured per entity

From `packages/ui-components` (`Clip.tsx`, `AnnotationBox.tsx`):

**Pattern (@dnd-kit 0.5+):** Feedback behavior is configured per-entity through the `plugins` hook option — `useDraggable({ plugins: [Feedback.configure({ feedback: 'none' })] })` disables the Feedback plugin for that draggable (no fixed positioning, no CSS translate, no placeholder, no drop animation); `plugins: [Feedback.configure({ dropAnimation: null })]` keeps default feedback but skips the snap-back animation on drop. `Feedback` comes from `@dnd-kit/dom` (declared optional peer alongside `@dnd-kit/react`). Hoist the arrays to module constants — `useDraggable` re-assigns `draggable.plugins` on reference change.

**0.3 → 0.5 trap:** the old top-level `feedback: 'none'` hook option was REMOVED upstream and is silently ignored at runtime (type error only). The Feedback plugin reads `source.pluginConfig(Feedback)`, which matches the `Feedback` constructor by identity — a duplicated `@dnd-kit/dom` copy in a consumer bundle makes `'none'` silently no-op too, which is why it's a peer, never a dependency. `clipFeedbackPlugins.test.tsx` reads the config back from the real registered entities rather than asserting on props.

**Applied in:** `Clip.tsx` (trim handles `'none'`, clip-move `dropAnimation: null`), `AnnotationBox.tsx` (start/end handles `'none'`).

## Annotation resize handles

From `packages/annotations`:

Annotation boundary resize handles disable the Feedback plugin per-entity: `useDraggable({ plugins: [Feedback.configure({ feedback: 'none' })] })` (`Feedback` from `@dnd-kit/dom`, a declared peer; hoist the array to a module constant for a stable reference). `@dnd-kit` 0.5 removed the old top-level `feedback` hook option — it is silently ignored at runtime, so `annotationBoxFeedbackPlugins.test.tsx` reads the config back from the real registered entity. Resize visual feedback comes from React state updates repositioning the annotation, not CSS translate.

## Where the rest is

| What                                                                                                                          | Where                                                                                         |
| ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Clip move and trim handlers, stable handlers and modifiers, snap-to-grid, where clip interaction options live                 | `packages/browser/notes/clip-drag-and-snap.md`                                                |
| Track reorder: the sortable, the popover healer, the remount after a drag, the reorder preview                                | `packages/browser/notes/track-controls-and-reorder.md`                                        |
| Annotation edge drag: preview source, one report per drag                                                                     | `packages/browser/notes/annotations.md`                                                       |
| The data each clip draggable carries                                                                                          | `packages/ui-components/CLAUDE.md`, "Clip Draggable Data Shape"                               |
| Registering a parent-owned element with dnd-kit from a child (a passive effect, not a layout effect)                          | skill `react-patterns`, "A child's layout effect runs before React attaches its parent's ref" |
| jsdom: the ResizeObserver stub that must be imported first; do not press a draggable element                                  | skill `unit-testing`, "jsdom and React"                                                       |
| Playwright: fractional pointer positions reach dnd-kit; checking that a drop animation is off with `document.getAnimations()` | skill `e2e-playwright`, "Pointer and input"                                                   |
| The count of `aria-roledescription="draggable"` attributes differs between loads                                              | skill `browser-probes`, "The probe scripts"                                                   |
| Undo pressed during a drag lands the clip away from the pointer (both editors)                                                | issue #848                                                                                    |
