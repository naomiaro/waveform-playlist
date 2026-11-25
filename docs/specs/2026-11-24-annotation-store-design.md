# Annotation store: one owner for the annotations (#867)

## Why

Today the app owns the annotations (its state behind `annotationList.annotations`), and five places inside the library keep a copy as new as the last render, build a whole new array from it and hand it back through `onAnnotationsChange`:

| Copy | Where |
| --- | --- |
| `annotationsRef`, read by `setAnnotations(fn)` | `packages/browser/src/providerInternals/useAnnotationState.ts` |
| `annotationsRef` and `drag.snapshot` | `packages/browser/src/hooks/useAnnotationDragHandlers.ts` |
| `annotationsRef` (text, id and control edits) | `packages/annotations/src/components/AnnotationText.tsx` |
| the render's `annotations` (boundary keys) | `packages/browser/src/hooks/useAnnotationKeyboardControls.ts` |
| the render's `annotations` (add button) | `website/src/components/examples/AnnotationsExample.tsx` |

The app stores whichever whole array arrives last, so two writes in one tick lose one: two `setAnnotations(fn)` calls (issue #867), or an app-side append in the same tick as a drag release (the append is lost when it is queued first). #866 tried a pending-value ref and was not merged (second copy; loses edits when the parent commits late).

The maintainer chose (2026-11-24): one owner object for the annotations, shaped like the `Arrangement` that owns the tracks since #812. The app makes it and gives it to either provider; every edit is a method call on it; nothing keeps a copy that it writes back.

## Goals

- One stored place for the committed annotations: the store. The providers, the parts and the app read it; every write goes through its methods and applies to its current value at the moment of the call.
- Two writes in one tick both land, in either order, whoever makes them.
- The same store works under `WaveformPlaylistProvider` and `MediaElementPlaylistProvider`.

## Non-goals

- Undo of annotation edits (a follow-up; the store is where it would go).
- dawcore: `<daw-annotation>` elements own their annotations in the DOM; unchanged.
- A veto: the app cannot refuse an edit. A read-only view keeps `editable: false`.
- Package versioning is not a factor in the design (maintainer, 2026-11-24); the changesets get the right bump.

## Anti-goals

- A second copy anywhere that is written back to the store (a ref that a writer builds a whole array from).
- A merge or a guard between two owners in place of naming one.

## Approaches considered

- a) Document that a functional update reads the committed array; narrow the type. Rejected: the drag, keyboard and text writers would still hand back whole arrays built from the last render.
- b) A pending value cleared in a microtask. Rejected: a second copy; loses an edit when the parent commits late or reads through `useDeferredValue`.
- c1) Annotations in the `Arrangement`. Rejected: `MediaElementPlaylistProvider` has no arrangement, and the engine would learn about annotations.
- **c2) An annotation store of its own (chosen).** Framework-free in core, created by the app, handed to either provider.

## Decided

### The store (core)

`packages/core/src/annotations/store.ts`, exported from core:

```ts
export interface AnnotationStore {
  /** The current annotations. The same array until a change. Never write to it. */
  getAnnotations(): readonly AnnotationData[];
  /** Be told after every change. Returns the unsubscribe function. */
  subscribe(listener: () => void): () => void;
  /** Replace the annotations. */
  set(annotations: readonly AnnotationData[]): void;
  /** Change the annotations: `fn` gets the current array and returns the next. */
  update(fn: (current: readonly AnnotationData[]) => readonly AnnotationData[]): void;
}

export function createAnnotationStore(initial?: readonly AnnotationData[]): AnnotationStore;
```

- `set` and `update` apply synchronously: the next `getAnnotations()` (and the next `update`'s `current`) is the new array. This is what makes two updates in one tick both land.
- An `update` whose `fn` returns the same array changes nothing and notifies nobody.
- Subscribers are told synchronously after the change; one that throws is caught and warned about (as `Arrangement` does), the others are still told.
- Validated at the door, in `createAnnotationStore`, `set` and the result of `update`: every annotation has numeric `start` and `end`, and ids are unique. Invalid input throws a `TypeError` and the store keeps its value. (Today the provider checks only the first annotation, logs an error and shows nothing.)
- Outside production builds the array and each annotation it hands out are frozen, as the arrangement does (`packages/engine/src/arrangement/devFreeze.ts`); core gets its own copy of the helper (no cross-package import for it).

A core helper applies the result of a gesture to the current list:

```ts
/** Write `start`/`end` of each change onto the annotation with that id; ids not in `current` are skipped. */
export function applyAnnotationBounds(
  current: readonly AnnotationData[],
  changes: readonly { id: string; start: number; end: number }[]
): readonly AnnotationData[];
```

### React (browser)

- `useCreateAnnotationStore(init?: () => readonly AnnotationData[]): AnnotationStore` creates one store per component instance, like `useCreateArrangement` (initializer read once; a throw goes to the nearest error boundary).
- `useStoredAnnotations(store): readonly AnnotationData[]`: `useSyncExternalStore` over the store, like `useArrangementTracks`. For the app, outside or inside the provider.
- Both providers take a new prop `annotationStore?: AnnotationStore`. Without it there are no annotations (`useAnnotations().annotations` is `[]`).
- `annotationList` keeps only `editable`, `linkEndpoints`, `isContinuousPlay`; its `annotations` field is removed.
- `onAnnotationsChange` is removed from both providers. An app that persists the annotations subscribes to the store.
- `usePlaybackControls().setAnnotations` is removed; `usePlaybackControls().annotationStore` is added next to `annotationPreview` (its identity changes only when the prop does). Parts and app components deep in the tree write through it.
- The providers publish `useAnnotations().annotations` from the store during render and write nothing back. The animation loop and the keyboard handlers read `store.getAnnotations()` directly; `annotationsRef` is removed.

### The writers

| Writer | Today | With the store |
| --- | --- | --- |
| Edge drag, release | hands the preview's whole array to `onAnnotationsChange` | `store.update(current => applyAnnotationBounds(current, moved))`, where `moved` is every annotation whose bounds the drag changed (the dragged one and, with linked endpoints, its neighbours). If the dragged annotation is no longer in the store, the release does nothing. (Maintainer's choice a, 2026-11-24.) |
| Edge drag, cancel | restores `drag.snapshot` (no-preview mode) | clears the preview; without a preview, writes the snapshot's bounds back by id through `applyAnnotationBounds` |
| Boundary keys | whole array from the render's `annotations` | `store.update(current => …)` |
| Text / id edits, list controls | whole array from `AnnotationText`'s ref | `store.update(current => …)`; a control's in-place `action` gets a fresh copy of `current` |
| App code | `setAnnotations(...)` / its own `useState` | `store.set(...)` / `store.update(...)` |

### Exported hooks and `AnnotationText`

- `useAnnotationDragHandlers` and `useAnnotationKeyboardControls` take `store: AnnotationStore` in place of `annotations` + `onAnnotationsChange`.
- `AnnotationText` (annotations package, also used without a provider) keeps `annotations` for what it draws. Its `onAnnotationUpdate(list)` is replaced by `onAnnotationsUpdate(fn: (current) => AnnotationData[])`, so the edit is applied to the owner's current value: under the provider `AnnotationList` passes `store.update`; a standalone app passes its `useState` setter (which accepts a function) or its own store's `update`. `AnnotationTextIntegrationProps` in `AnnotationIntegrationContext.tsx` follows. Renamed rather than retyped, so a leftover handler that expects an array is not called with a function.

### Docs and examples

Upgrade entries in `website/docs/react/upgrading.md`: `annotationList.annotations` + `onAnnotationsChange` → `annotationStore`; `setAnnotations` → `annotationStore`; the two hooks' options; `AnnotationText`'s `onAnnotationUpdate` → `onAnnotationsUpdate`. Each with **Find** and a before/after; the "Before" halves checked against `dev`'s source.

Surfaces to update (root `CLAUDE.md`, "Keep all doc surfaces in sync"): `llm-reference.md`, `llms.txt`, `docs/api/hooks.md`, `docs/examples.md`, both provider API pages, `guides/annotations.md`, `guides/media-element-playout.md`, `getting-started/installation.md`, `packages/annotations/README.md` and `CLAUDE.md`, `packages/browser/notes/annotations.md`, `contexts.md`, `provider-internals.md`, `PROJECT_STRUCTURE.md` (the store in core). Examples: the three annotation example components in `website/src/components/examples/`, `packages/ui-components/src/stories/` (Waveform, Hooks, AnnotationText stories), and `examples/` if any use them. Pending changesets that name the removed API (`.changeset/annotation-drag-preview.md`, `annotation-parts.md`, `media-element-annotation-items.md`) are corrected.

### Tests

- core: two `update`s in one tick both land; `set`/`update` validation throws and keeps the value; a same-array `update` does not notify; a throwing subscriber does not stop the others; frozen in development.
- browser, both providers, each sequence in both orders: an app `store.update` in the same tick as a drag release, a boundary key, a text edit and a list control; the app reading through `useDeferredValue(useStoredAnnotations(store))` loses nothing; a drag whose annotation was removed mid-drag does nothing on release; linked-endpoint neighbours are written by id.
- New regression tests are mutation-checked (project skill `mutation-testing`). The annotation e2e specs (`annotations`, `media-element-annotations`, `mobile-annotations`) run green at the end.

## Left to the builder

- Whether the drag preview, published on each move, overlays the moved bounds onto the store's current value (so an annotation added mid-drag shows during the drag) or keeps the drag's working list; the public `AnnotationPreviewHandle` type stays.
- File layout inside browser, test file names, and the order of the work.
