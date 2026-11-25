# Annotation Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the annotations one owner, an `AnnotationStore` the app creates and hands to either provider, so every edit applies to the current value and two writes in one tick both land (#867).

**Architecture:** A framework-free store in core (`createAnnotationStore`) with `getAnnotations` / `subscribe` / `set` / `update` and an app rule `beforeChange`. Browser adds `useCreateAnnotationStore` and `useStoredAnnotations`; both providers take `annotationStore` and derive what they publish from it. Every writer (drag release, boundary keys, text, id and list-control edits, app code) calls `store.update` and finds its annotation by id in `current`. The old path (`annotationList.annotations`, `onAnnotationsChange`, `setAnnotations`, `AnnotationText`'s `onAnnotationUpdate`) is kept beside the new one during tasks 3–6 so each commit is green, and removed in task 7.

**Tech Stack:** TypeScript, React 19 (`useSyncExternalStore`, `use(Context)`), vitest + jsdom, Playwright e2e, pnpm workspace, tsup.

**Spec:** `docs/specs/2026-11-24-annotation-store-design.md` (read it first; this plan argues from it).

## Global Constraints

- Work in the worktree `/Users/naomiaro/Code/waveform-playlist-annotation-store`, branch `feat/annotation-store`. Check `git branch --show-current` before each commit.
- No cross-package re-exports: browser and annotations import `AnnotationStore`, `createAnnotationStore`, `applyAnnotationBounds` from `@waveform-playlist/core`; browser does not re-export them.
- `export *` makes every export of a file public: core's index re-exports only `store.ts` and `bounds.ts`; the dev-freeze helper lives in a file core's index does not re-export. After the core build, check `packages/core/dist/index.d.ts` names only `AnnotationStore`, `AnnotationStoreOptions`, `createAnnotationStore`, `applyAnnotationBounds`, `AnnotationBoundsChange` as new.
- Contexts are read with `use(Context)`; no `useContext`, no `forwardRef` (lint enforces).
- Downstream typecheck reads `dist/`: run `pnpm --filter @waveform-playlist/core build` before typechecking browser or annotations after a core change.
- Before `pnpm build`, `pnpm test` or a branch switch: `lsof -nP -iTCP:3000 -sTCP:LISTEN` as its own command. If something listens and you did not start it, start your own server on 3077 (`cd website && pnpm exec docusaurus start --port 3077 --no-open`) and run e2e with `PORT=3077`.
- Every check (vitest, typecheck, lint, build, e2e) is its own Bash call; read its result before committing. Never chain a commit after a check with `;`.
- Format only changed files (`npx prettier --write <paths>`); `pnpm lint` must end with 0 errors.
- Package unit tests: `(cd packages/<pkg> && npx vitest run <file>)`.
- Scratch files go in the session scratchpad, never `/tmp`.
- Commit messages via `git commit -F - <<'EOF'` (quoted delimiter), ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- **The app swaps stores** (loads another project): the provider shows the new store's annotations; a later write to the old store draws nothing; a drag started on the old store does nothing on release. Test in task 3.
- **A subscriber that writes** (an app rule written as `subscribe(() => store.update(normalize))`): the nested update applies, no change is lost, and every subscriber that reads `getAnnotations()` after being told sees the final value. Test in task 1.
- **StrictMode**: `useCreateAnnotationStore` under `<StrictMode>` returns one store whose updates render, and `beforeChange` is the latest committed one. Test in task 2.
- **Empty store, first annotation**: a store created empty, then `store.update(c => [...c, a])` from app code, draws a box that can be dragged (the boxes mount their drag provider only when there are annotations). Test in task 4.
- **App code that sorts in place**: `useAnnotations().annotations.sort()` throws in development (frozen), and the upgrade guide says so. Test in task 1 (frozen array throws on `sort`), doc line in task 9.

---

### Task 1: The store in core

**Files:**
- Create: `packages/core/src/annotations/store.ts`, `packages/core/src/annotations/bounds.ts`, `packages/core/src/annotations/devFreeze.ts`
- Modify: `packages/core/src/index.ts` (add `export * from './annotations/store'` and `'./annotations/bounds'`)
- Test: `packages/core/src/__tests__/annotationStore.test.ts`, `packages/core/src/__tests__/annotationBounds.test.ts`

**Interfaces:**
- Produces (core public):
  ```ts
  export interface AnnotationStore {
    getAnnotations(): readonly AnnotationData[];
    subscribe(listener: () => void): () => void;
    set(annotations: readonly AnnotationData[]): void;
    update(fn: (current: readonly AnnotationData[]) => readonly AnnotationData[]): void;
  }
  export interface AnnotationStoreOptions {
    beforeChange?: (next: readonly AnnotationData[], current: readonly AnnotationData[]) => readonly AnnotationData[];
  }
  export function createAnnotationStore(initial?: readonly AnnotationData[], options?: AnnotationStoreOptions): AnnotationStore;
  export interface AnnotationBoundsChange { id: string; start: number; end: number }
  export function applyAnnotationBounds(current: readonly AnnotationData[], changes: readonly AnnotationBoundsChange[]): readonly AnnotationData[];
  ```
- Internal (not exported from the index): `devFreeze.ts` exports `isDevelopmentBuild(): boolean` (same body as `packages/engine/src/arrangement/devFreeze.ts`) and `freezeAnnotations(list): readonly AnnotationData[]` (freezes the array, each annotation and its `lines`; returns the list unchanged in production).

- [ ] **Step 1: Write the failing tests** in `annotationStore.test.ts`, one `it` each:
  - `two updates in one tick both land`: store from `[z0]`; `update(c => [...c, a])`; `update(c => [...c, b])`; `getAnnotations().map(x => x.id)` equals `['z0','a','b']`.
  - `getAnnotations returns the same array until a change`; `an update returning current notifies nobody` (listener not called, array identity kept).
  - `set and update validate`: each throws `TypeError` and keeps the value for a `start` that is a string, an `end` that is `NaN`, and two annotations with id `'x'`; `createAnnotationStore([dupes])` throws too.
  - `beforeChange accepts, refuses and adjusts`: returning `next` stores it; returning `current` stores nothing and calls no listener; returning a third list stores that list; a result that fails validation throws and keeps the value; a throw from `beforeChange` propagates and keeps the value; `beforeChange` is not called for `initial`.
  - `a throwing subscriber does not stop the others` (spy on `console.warn`, second listener still called).
  - `a subscriber that updates`: listener A calls `store.update(c => c.length < 3 ? [...c, extra] : c)` once; after one outside `update`, the final list holds both additions, and listener B's last read of `getAnnotations()` equals the final list.
  - `frozen in development`: `Object.isFrozen(getAnnotations())`, of `getAnnotations()[0]` and of its `lines`; `(getAnnotations() as AnnotationData[]).sort()` throws `TypeError`.
  - `unsubscribe stops the listener`.

  In `annotationBounds.test.ts`: writes `start`/`end` by id and keeps every other field and every untouched annotation object (`toBe`); skips an id not in `current`; returns `current` itself (`toBe`) when no change applies.

- [ ] **Step 2: Run** `(cd packages/core && npx vitest run src/__tests__/annotationStore.test.ts src/__tests__/annotationBounds.test.ts)`. Expected: FAIL, modules not found.

- [ ] **Step 3: Implement** `store.ts` and `bounds.ts`. Validation is one internal `validateAnnotations(list)` (every `start`/`end` is a finite number; ids unique) called on `initial`, on the proposed list, and on `beforeChange`'s result when it is neither `next` nor `current`. Notify with a copy of the listener set, each call in `try`/`catch` with `console.warn('[waveform-playlist] Error in an annotation store subscriber:', error)`. Freeze what is stored with `freezeAnnotations`. Doc comments say what the spec says (same array until a change; never write to it).

- [ ] **Step 4: Run** the two test files again. Expected: PASS. Then `(cd packages/core && npx vitest run)` (all core tests) PASS.

- [ ] **Step 5: Build and check the public names:** `pnpm --filter @waveform-playlist/core build`, then `grep -n "AnnotationStore\|applyAnnotationBounds\|freezeAnnotations\|isDevelopmentBuild" packages/core/dist/index.d.ts`. Expected: the five names of Interfaces, no `freezeAnnotations`, no `isDevelopmentBuild`.

- [ ] **Step 6: Mutation check** (project skill `mutation-testing`): break the synchronous apply (read `current` from a value captured before the first update), the refuse path (notify when `beforeChange` returns `current`) and the duplicate-id check, one at a time; each must turn a test red. Restore.

- [ ] **Step 7: Commit** `feat(core): an annotation store that owns the annotations (#867)`.

### Task 2: React hooks for the store

**Files:**
- Create: `packages/browser/src/hooks/useCreateAnnotationStore.ts`, `packages/browser/src/hooks/useStoredAnnotations.ts`
- Modify: `packages/browser/src/hooks/index.ts`, `packages/browser/src/index.tsx` (export both hooks and `UseCreateAnnotationStoreOptions` if you add one; not the core names)
- Test: `packages/browser/src/__tests__/annotationStoreHooks.test.tsx`

**Interfaces:**
- Consumes: task 1's `AnnotationStore`, `AnnotationStoreOptions`, `createAnnotationStore`.
- Produces:
  ```ts
  export function useCreateAnnotationStore(init?: () => readonly AnnotationData[], options?: AnnotationStoreOptions): AnnotationStore;
  export function useStoredAnnotations(store: AnnotationStore): readonly AnnotationData[];
  ```

- [ ] **Step 1: Write the failing tests:** the same store on every render; `init` called once per store (twice under StrictMode, one result kept: assert updates through the returned store render); `beforeChange` passed on a later render is the one called (render with a rule that refuses, re-render with one that accepts, `update` lands); `useStoredAnnotations` re-renders on `update` and returns the store's array (`toBe`); a throw from `init` reaches an error boundary.
- [ ] **Step 2: Run** `(cd packages/browser && npx vitest run src/__tests__/annotationStoreHooks.test.tsx)`. Expected: FAIL.
- [ ] **Step 3: Implement.** `useCreateAnnotationStore`: `useState(() => createAnnotationStore(init?.(), { beforeChange: (n, c) => ruleRef.current ? ruleRef.current(n, c) : n }))`, with `ruleRef` written in `useLayoutEffect` from `options?.beforeChange`. `useStoredAnnotations`: the `useArrangementTracks` shape (`useSyncExternalStore` with memoized subscribe/getSnapshot).
- [ ] **Step 4: Run** the test file. Expected: PASS.
- [ ] **Step 5: Commit** `feat(browser): useCreateAnnotationStore and useStoredAnnotations (#867)`.

### Task 3: Providers take `annotationStore`

**Files:**
- Modify: `packages/browser/src/providerInternals/useAnnotationState.ts`, `packages/browser/src/WaveformPlaylistContext.tsx` (props ~L155–190, state ~L262–287, the loop's `annotationsRef.current` reads ~L721 and ~L862, controls value ~L1370–1405), `packages/browser/src/MediaElementPlaylistContext.tsx` (same places, ~L114, ~L166–235, ~L598, ~L627, ~L908–930), `packages/browser/src/contexts/playlistContexts.ts` (`PlaybackControlsContextValue`)
- Test: `packages/browser/src/__tests__/annotationStoreProvider.test.tsx`

**Interfaces:**
- Consumes: tasks 1–2.
- Produces: prop `annotationStore?: AnnotationStore` on both providers; `usePlaybackControls().annotationStore: AnnotationStore | undefined`; `useAnnotationState` returns `getAnnotations: () => readonly AnnotationData[]` (stable; reads the current store through a ref, or the interim prop array) for the animation loops, in place of `annotationsRef`.
- Interim (removed in task 7): with no `annotationStore`, `annotationList.annotations` and `onAnnotationsChange` work as on `dev`. With a store, `annotationList.annotations` is ignored, and `setAnnotations(action)` calls `store.update` for a function and `store.set` for an array.

- [ ] **Step 1: Write the failing tests**, under each provider (`renderWithArrangement` / `TestProvider` in `__tests__/helpers/arrangementProvider.tsx` for the multitrack one; the MediaElement test setup used in `mediaElementAnnotationsMemo.test.tsx`):
  - `useAnnotations().annotations` is the store's array (`toBe`) and follows `store.update`.
  - The issue's case: two `setAnnotations(fn)` calls in one `act` append both.
  - `usePlaybackControls().annotationStore` is the prop's store; `undefined` without the prop.
  - An app that reads through `useDeferredValue(useStoredAnnotations(store))`: two edits in a row (a `setAnnotations(fn)`, then another before the deferred render) both land in the store, and the deferred reader settles on the store's final array.
  - Swapping the `annotationStore` prop shows the new store's annotations; a later `update` on the old store changes nothing drawn.
  - The animation loop follows the store: with continuous play, the active annotation id follows the playhead into an annotation added by `store.update` after mount (use the existing loop test setup in `webAudioSharedLoopSteps.test.tsx` / `mediaElementSharedLoop.test.tsx`).
- [ ] **Step 2: Run** the new file. Expected: FAIL.
- [ ] **Step 3: Implement.** `useAnnotationState` gains `annotationStore`; it reads the store with `useStoredAnnotations` semantics (call `useSyncExternalStore` unconditionally with a stand-in empty source when there is no store). The dev-time numeric check stays for the interim prop path only. The providers pass the prop, publish `annotationStore` in the controls value next to `annotationPreview`, and the loops call `getAnnotations()`.
- [ ] **Step 4: Run** the new file, then `(cd packages/browser && npx vitest run)`. Expected: all PASS (old tests unchanged).
- [ ] **Step 5: Commit** `feat(browser): both providers take an annotationStore (#867)`.

### Task 4: The edge drag writes what it moved

**Files:**
- Modify: `packages/browser/src/hooks/useAnnotationDragHandlers.ts`, `packages/browser/src/components/WaveformAnnotationBoxes.tsx`
- Test: `packages/browser/src/__tests__/annotationDragHandlers.test.tsx` (add cases), `packages/browser/src/__tests__/annotationStoreDrag.test.tsx`

**Interfaces:**
- Consumes: `applyAnnotationBounds`, `AnnotationBoundsChange`, `usePlaybackControls().annotationStore`.
- Produces: `useAnnotationDragHandlers` option `store?: AnnotationStore`. With `store`: the snapshot at drag start is `store.getAnnotations()`; `annotations` and `onAnnotationsChange` are not read (interim: still accepted when `store` is absent).

- [ ] **Step 1: Write the failing tests** (drive the handlers directly, as the existing file does):
  - Release after `store.update(c => [...c, x])` mid-drag: the store holds `x` and the dragged bounds.
  - Linked endpoints: the neighbour the drag carried is written by id, with its `lines` as the store has them after a text change made mid-drag.
  - The dragged annotation removed mid-drag: release changes nothing (listener not called).
  - Cancel with a preview: store untouched, preview `null`. Cancel without a preview (per-move writes): the snapshot's bounds are written back by id, an annotation added mid-drag stays.
  - `beforeChange` refusing the release: store unchanged, preview `null`.
  - `annotationStoreDrag.test.tsx`: an empty store under `<WaveformAnnotationBoxes />`, then `store.update(c => [...c, a])` from outside: one box is drawn and a drag of its edge moves it (Review Focus).
- [ ] **Step 2: Run** both files. Expected: the new cases FAIL.
- [ ] **Step 3: Implement.** `moved` = every annotation of the drag's result whose `start` or `end` differs from the drag-start snapshot's annotation of the same id. Release with preview: in the existing `flushSync`, `store.update(c => c.some(a => a.id === draggedId) ? applyAnnotationBounds(c, moved) : c)`, then `preview.publish(null)`. Per-move without preview: `store.update(c => applyAnnotationBounds(c, movedSoFar))`. The preview stays a full list built from the drag's working list (spec: left to the builder; keep `AnnotationPreviewHandle` unchanged). `WaveformAnnotationBoxes` passes `store: annotationStore` when it is defined, else the interim pair.
- [ ] **Step 4: Run** both files, then the browser suite. Expected: PASS.
- [ ] **Step 5: Mutation check:** write the whole result instead of `applyAnnotationBounds` (the mid-drag add must go red); drop the removed-annotation guard. Restore.
- [ ] **Step 6: Commit** `feat(browser): an annotation drag writes only what it moved (#867)`.

### Task 5: Boundary keys update the current list

**Files:**
- Create: `packages/browser/src/utils/annotationBoundaryKeys.ts` (internal, not exported)
- Modify: `packages/browser/src/hooks/useAnnotationKeyboardControls.ts`, `packages/browser/src/components/KeyboardShortcuts.tsx`
- Test: `packages/browser/src/__tests__/annotationBoundaryKeys.test.ts`, `packages/browser/src/__tests__/useAnnotationKeyboardControls.context.test.ts` (add cases)

**Interfaces:**
- Produces:
  ```ts
  // pure, from the bodies of moveStartBoundary / moveEndBoundary as they are on dev
  export function moveAnnotationStart(list: readonly AnnotationData[], index: number, delta: number, opts: { linkEndpoints: boolean }): readonly AnnotationData[];
  export function moveAnnotationEnd(list: readonly AnnotationData[], index: number, delta: number, opts: { linkEndpoints: boolean; duration: number }): readonly AnnotationData[];
  ```
  `useAnnotationKeyboardControls` option `store?: AnnotationStore`; with it, navigation reads `useStoredAnnotations(store)` and boundary keys call `store.update(c => { const i = c.findIndex(a => a.id === activeAnnotationId); return i < 0 ? c : moveAnnotationStart(c, i, delta, …) })`.

- [ ] **Step 1: Write the failing tests:** `annotationBoundaryKeys.test.ts` pins today's numbers: for the fixtures of the existing keyboard test, `moveAnnotationStart`/`End` give the same lists the hook gave on `dev` (linked, unlinked push, cascade, clamp at 0 and at `duration`, minimum length 0.1). Copy expected values from running the `dev` hook body, not from reasoning (root `CLAUDE.md`, "Behavior unchanged" claims: diff old vs new numerically). Hook test: a `]` key press in the same `act` as `store.update(c => [x, ...c])` (an insert before the active annotation) moves the active annotation, not its new neighbour, and keeps `x`.
- [ ] **Step 2: Run** both. Expected: FAIL.
- [ ] **Step 3: Implement** the two pure functions (move the bodies; no behaviour change) and the hook's store path; `KeyboardShortcuts` passes `store: annotationStore` when defined.
- [ ] **Step 4: Run** both, then the browser suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(browser): annotation boundary keys update the store's current list (#867)`.

### Task 6: `AnnotationText` writes through the store

**Files:**
- Create: `packages/annotations/src/utils/runAnnotationAction.ts`
- Modify: `packages/annotations/src/components/AnnotationText.tsx` (handlers ~L320–373, row fields ~L245–282), `packages/browser/src/AnnotationIntegrationContext.tsx` (`AnnotationTextIntegrationProps`), `packages/browser/src/components/AnnotationList.tsx`
- Test: `packages/annotations/src/__tests__/annotationTextStore.test.tsx`, `packages/annotations/src/__tests__/runAnnotationAction.test.ts`

**Interfaces:**
- Consumes: `AnnotationStore`.
- Produces: `AnnotationText` prop `store?: AnnotationStore` (interim: `onAnnotationUpdate` still accepted when `store` is absent). `AnnotationTextIntegrationProps.store?: AnnotationStore`.
  ```ts
  export function runAnnotationAction(current: readonly AnnotationData[], id: string, action: AnnotationAction, opts: AnnotationActionOptions): readonly AnnotationData[];
  ```
  Copies the array and each annotation with its `lines`, calls `action(copy[i], i, copy, opts)` with `i` the position of `id` in `current` (returns `current` when absent), then puts back the original object for every copy whose fields (and `lines` elementwise) equal its original.

- [ ] **Step 1: Write the failing tests:**
  - `runAnnotationAction`: the example page's split (`annotation.end = …` after a `splice`) and delete actions (copy them from `website/src/components/examples/AnnotationsExample.tsx:103-125`) work on a frozen store list; untouched annotations keep their identity (`toBe`); an absent id returns `current`.
  - `AnnotationText` with a store: a text edit (blur) lands by id after an insert before the row in the same `act`; an id edit to a duplicate writes nothing and the field's `textContent` is the stored id again; an empty id the same; a `beforeChange` that refuses a text edit leaves the field showing the stored text; a control click lands by id.
  - Without `store` and without `onAnnotationUpdate`: no field is `contentEditable="true"` and no control button is drawn, whatever `editable` says.
- [ ] **Step 2: Run** `(cd packages/annotations && npx vitest run src/__tests__/annotationTextStore.test.tsx src/__tests__/runAnnotationAction.test.ts)`. Expected: FAIL.
- [ ] **Step 3: Implement.** Each handler takes the row's id from the drawn `annotations[index]` and calls `store.update(c => …)` finding it by id in `c`; after the update each field sets its `textContent` to the stored value when they differ (a contentEditable field is not re-rendered by React when nothing changed). `AnnotationList` passes `store={annotationStore}` when defined, else the interim `onAnnotationUpdate={setAnnotations}`. Build browser (`pnpm --filter @waveform-playlist/browser build`) before running the annotations tests if they read browser's types.
- [ ] **Step 4: Run** both files, then `(cd packages/annotations && npx vitest run)` and the browser suite. Expected: PASS.
- [ ] **Step 5: Commit** `feat(annotations): AnnotationText writes through the annotation store (#867)`.

### Task 7: Remove the old path; readonly types

**Files:**
- Modify: `useAnnotationState.ts` (drop `annotationList.annotations`, `onAnnotationsChange`, `setAnnotations`, `annotationsRef`, the numeric check and its warning), both providers (drop `onAnnotationsChange` prop and `setAnnotations` from the controls value), `playlistContexts.ts` (`AnnotationsContextValue.annotations: readonly AnnotationData[]`; drop `setAnnotations`), `useAnnotationDragHandlers.ts` / `useAnnotationKeyboardControls.ts` (option `store: AnnotationStore | undefined`, required key; drop `annotations` / `onAnnotationsChange`; without a store they do nothing), `AnnotationText.tsx` and `AnnotationIntegrationContext.tsx` (drop `onAnnotationUpdate`; `annotations: readonly AnnotationData[]`), `useAnnotationsWithPreview.ts` (`readonly` in and out), `WaveformAnnotationBoxes.tsx`, `KeyboardShortcuts.tsx`, `AnnotationList.tsx`, and every exported function in core, browser and annotations that only reads a list (e.g. `AnnotationFormat.serialize`): widen to `readonly`. `AnnotationAction.action`'s `annotations` stays mutable.
- Modify tests: the 23 test files that use the old API (`git grep -l -e onAnnotationsChange -e setAnnotations -e onAnnotationUpdate -e annotationList -- packages e2e`, filtered to tests); mount with `annotationStore={createAnnotationStore(list)}` and assert on the store.

- [ ] **Step 1: Make the removals** and run `pnpm --filter @waveform-playlist/core build && pnpm --filter @waveform-playlist/browser build` (two calls), then `pnpm typecheck`. Expected: errors only in test files and stories.
- [ ] **Step 2: Migrate the tests** until `(cd packages/browser && npx vitest run)`, `(cd packages/annotations && npx vitest run)`, `(cd packages/core && npx vitest run)` all PASS, each its own call. A test that asserted the old refusal behaviour ("parent refuses") becomes a `beforeChange` that returns `current`.
- [ ] **Step 3: Check nothing is left:** `git grep -n -e onAnnotationsChange -e "setAnnotations\b" -e onAnnotationUpdate -e annotationsRef -- packages` prints only `setAnnotationsEditable` lines (none of the removed names). `git grep -n "annotations:" -- packages/browser/src/providerInternals` shows no `annotationList.annotations` read.
- [ ] **Step 4: Run** `pnpm typecheck` (expected: exit 0 except stories, fixed in task 8 if they are in scope) and `pnpm lint` (expected: 0 errors).
- [ ] **Step 5: Commit** `feat!: the annotation store is the one owner; onAnnotationsChange, setAnnotations and onAnnotationUpdate removed (#867)`.

### Task 8: Examples, stories and e2e

**Files:**
- Modify: `website/src/components/examples/AnnotationsExample.tsx` (state → `useCreateAnnotationStore`; add button L315–326 → `store.update(c => …)` computing the gap from `c`; load L502 → `store.set(parsed)`; clear L508 → `store.set([])`; custom actions unchanged), `MediaElementAnnotationsExample.tsx`, `MobileAnnotationsExample.tsx`, `packages/ui-components/src/stories/Waveform.stories.tsx`, `Hooks.stories.tsx`, `AnnotationText.stories.tsx`, `e2e/mobile-annotations.spec.ts` if it names the old API; any `examples/*` hit of the old names.

- [ ] **Step 1: Update** each file. `git grep -n -e onAnnotationsChange -e "setAnnotations\b" -e onAnnotationUpdate -e "annotationList={{ *annotations" -- website/src examples packages/ui-components/src e2e` prints nothing.
- [ ] **Step 2: Check port 3000** (Global Constraints), then build: `pnpm build`. Expected: exit 0.
- [ ] **Step 3: Run the annotation e2e specs:** `npx playwright test e2e/annotations.spec.ts e2e/media-element-annotations.spec.ts e2e/mobile-annotations.spec.ts` (with `PORT=3077` if you run your own server). Expected: all pass, including the ✂ split at `annotations.spec.ts:295`.
- [ ] **Step 4: Commit** `docs(examples): annotation examples create an annotation store (#867)`.

### Task 9: Documentation, changesets, notes

**Files:**
- Modify: `website/docs/react/upgrading.md` (one section per change, each with **Find** and before/after: `annotationList.annotations` + `onAnnotationsChange` → `annotationStore`; `setAnnotations` → `usePlaybackControls().annotationStore` / the app's store; the two hooks' `store` option; `AnnotationText`'s `onAnnotationUpdate` → `store`; `useAnnotations().annotations` is `readonly` and frozen in development (in-place `sort()` throws; copy first); a duplicate id is refused; invalid annotations throw instead of logging. Check every "Before" against `git show dev:<file>`), `website/docs/llm-reference.md`, `website/static/llms.txt`, `website/docs/react/api/hooks.md`, `website/docs/examples.md`, `website/docs/react/api/providers/waveform-playlist-provider.md`, `.../media-element-playlist-provider.md`, `website/docs/react/guides/annotations.md`, `.../media-element-playout.md`, `website/docs/react/getting-started/installation.md`, `packages/annotations/README.md`, `packages/annotations/CLAUDE.md`, `packages/browser/notes/annotations.md`, `contexts.md`, `provider-internals.md`, `PROJECT_STRUCTURE.md` (the store in core; by hand, not prettier), `.changeset/annotation-drag-preview.md`, `annotation-parts.md`, `media-element-annotation-items.md` (remove the removed names).
- Create: changesets for `@waveform-playlist/core` (minor: the store), `@waveform-playlist/browser` and `@waveform-playlist/annotations` (major: removals).

- [ ] **Step 1: Write the docs.** `git grep -n -e onAnnotationsChange -e "setAnnotations\b" -e onAnnotationUpdate -- website/docs website/static packages/*/README.md README.md .changeset` prints only the "Before" halves of `upgrading.md`.
- [ ] **Step 2: Build the site:** `pnpm --filter website build`. Expected: exit 0, no broken links (CSS calc warnings are pre-existing).
- [ ] **Step 3: Run** `pnpm lint`. Expected: 0 errors.
- [ ] **Step 4: Commit** `docs: the annotation store in the guides, references and upgrade guide (#867)`.

Before the PR merges (not part of this plan's tasks): `git rm` this plan and the spec; the PR description carries the summary; `revise-claude-md` runs before the merge is asked for.
