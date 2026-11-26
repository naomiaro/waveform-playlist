# #848 PR 1: Undo During a Drag, Escape Cancels a Drag — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** In both editors, undo and redo do nothing while a clip or track drag is in progress, and Escape pressed during any drag cancels the drag and does nothing else.

**Architecture:** One rule in core makes "Escape only cancels" work in both editors: `handleKeyboardEvent` ignores an Escape whose default was already prevented. dnd-kit's pointer sensor already calls `preventDefault()` on Escape during a React drag (`PointerSensor.handleKeyDown`, `@dnd-kit/dom` 0.5.3, bound on the event target and `document.body`, before React's `window` listener). `<daw-editor>` gets a `window` capture-phase keydown listener that cancels its active drag and calls `preventDefault()`, before `<daw-keyboard-shortcuts>`' `document` listener runs. Undo is guarded where it is called: dawcore's `editor.undo()` / `redo()` ask the editor's drag handlers. React's `useEditorControls().undo` / `redo` ask a small drag guard that the provider owns and that the drag handlers write.

**Tech Stack:** TypeScript, Lit (dawcore), React 19 and @dnd-kit 0.5.3 (browser), vitest (happy-dom for dawcore, jsdom for browser), Playwright.

**Spec:** `docs/specs/2026-11-25-dawcore-arrangement-design.md`, sections "PR 1" and "Undo during a drag". PRs 2 and 3 get their own plans, written against the code as built.

## Global Constraints

- Worktree `/Users/naomiaro/Code/waveform-playlist-848`, branch `feat/848-dawcore-arrangement`. Run every command from the worktree root, or in a subshell `(cd packages/<pkg> && …)`.
- dawcore still imports `@waveform-playlist/engine` as types only plus the `await import(...)` in `_ensureEngine` (PR 2 changes that, not this PR).
- Contexts are read with `use(Context)` and provided with `<Context value>`; every context's name ends in `Context`; no `useContext`, no `.Provider`, no `forwardRef` (root `CLAUDE.md`, "React/TypeScript").
- A new internal context or module is not exported from any package entry (root `CLAUDE.md`, "One Owner per Exported Name"; `export *` makes every export of a file public).
- Changesets: `@dawcore/components` `patch` (zerover); `@waveform-playlist/core` and `@waveform-playlist/browser` `patch`.
- Every check (vitest, typecheck, lint, build, e2e) is its own Bash call; read its result before committing.
- Before `pnpm build`, `pnpm test` or `git checkout`: `lsof -nP -iTCP:3000 -sTCP:LISTEN` as a command of its own. With a server of your own on 3077, every Playwright command gets `PORT=3077`.
- Format only the files you changed (`npx prettier --write <paths>`), never a whole package.
- Scratch files go in the session scratchpad, never `/tmp`.
- Load the project skills `unit-testing` before writing a vitest test, `dnd-kit` before touching a drag handler in browser, `e2e-playwright` before Task 5.

## Review Focus

1. **Escape pressed twice during playback:** the first cancels the drag, the second stops playback. Test in Task 3 (dawcore) and Task 5 (React e2e).
2. **A drag that ends without a pointerup or a dragend** (the editor disconnected or the provider unmounted mid-drag): the guard is released and undo works again afterwards. Test in Task 3 (disconnect) and Task 4 (unmount).
3. **A press without a move** (button held on a clip header, pointer still): undo is NOT blocked in either editor. dawcore counts a clip drag from `_isDragging` (past `DRAG_THRESHOLD`, 3 px), and React from dnd-kit's dragstart, which fires after the sensor's activation constraint. Test in Task 3 and Task 4.
4. **Undo by API, not only by key** (`editor.undo()`, `useEditorControls().undo()`): inert during a drag like the shortcut. Test in Task 3 and Task 4. Direct `arrangement.undo()` is NOT guarded in this PR (design, PR 3: a change from elsewhere cancels the drag).
5. **A non-Escape key whose default was prevented** still runs its shortcut (the core rule is for Escape only). Test in Task 1.

---

### Task 1: core — an Escape whose default was prevented is not a shortcut

**Files:**
- Modify: `packages/core/src/keyboard.ts` (`handleKeyboardEvent`, `:195`)
- Test: `packages/core/src/__tests__/keyboard.test.ts`
- Create: `.changeset/escape-cancels-drag-core.md`

**Interfaces:**
- Produces: `handleKeyboardEvent(event, shortcuts, enabled)` returns without running a shortcut when `event.key === 'Escape' && event.defaultPrevented`. The signature is unchanged.

- [ ] **Step 1: Write the failing tests** in `keyboard.test.ts`, in a new `describe('an Escape that was already handled')`:
  - `it('does not run an Escape shortcut when the default was prevented')`: build `new KeyboardEvent('keydown', { key: 'Escape', cancelable: true })`, call `event.preventDefault()`, and call `handleKeyboardEvent(event, [{ key: 'Escape', action }], true)`. Expect `action` not called.
  - `it('still runs an Escape shortcut when the default was not prevented')`: the same without `preventDefault()`. Expect `action` called once.
  - `it('still runs a non-Escape shortcut whose default was prevented')`: key `' '` (Space), `preventDefault()` first. Expect `action` called once.
- [ ] **Step 2: Run them, see the first fail:** `(cd packages/core && npx vitest run src/__tests__/keyboard.test.ts)`. Expected: 1 failed ("does not run an Escape shortcut…"), the other two pass.
- [ ] **Step 3: Implement** the early return in `handleKeyboardEvent`, after the `event.repeat` check, with a comment naming why: a drag that took the key (dnd-kit's pointer sensor, `<daw-editor>`'s drag cancel) has already prevented its default, and an Escape that cancelled a drag does nothing else (#848). Extend the JSDoc of `handleKeyboardEvent` with one sentence saying so.
- [ ] **Step 4: Run the core suite:** `(cd packages/core && npx vitest run)`. Expected: all pass.
- [ ] **Step 5: Changeset** `.changeset/escape-cancels-drag-core.md`, `'@waveform-playlist/core': patch`: "`handleKeyboardEvent` ignores an Escape whose default was already prevented, so an Escape that cancelled a drag does not also stop playback or deselect."
- [ ] **Step 6: Commit** (`git add` the three files; message `fix: an Escape that was already handled is not a shortcut (#848)`).

### Task 2: dawcore — each drag handler says whether a drag is in progress and can be cancelled

**Files:**
- Modify: `packages/dawcore/src/interactions/clip-pointer-handler.ts` (add `isDragging`)
- Modify: `packages/dawcore/src/interactions/pointer-handler.ts` (`onPointerDown`, the clip branch, `:100-150`)
- Modify: `packages/dawcore/src/interactions/track-reorder-handler.ts`
- Modify: `packages/dawcore/src/interactions/annotation-drag.ts`
- Test: `packages/dawcore/src/__tests__/clip-pointer-handler.test.ts`, `pointer-handler.test.ts`, `daw-editor-reorder.test.ts` (or the track-reorder handler's own test file if there is one), `daw-annotation-track` / annotation-drag tests (find the file with `grep -ln AnnotationDragHandler packages/dawcore/src/__tests__`)

**Interfaces:**
- Produces:
  - `ClipPointerHandler.isDragging: boolean` (getter): `true` once the pointer has moved past `DRAG_THRESHOLD` in the current press, until reset. `isActive` stays as it is (true from pointerdown).
  - `PointerHandler.cancelClipDrag(): boolean`: when a clip press is armed, calls `clipHandler.onPointerCancel(...)`, removes the three timeline listeners, releases pointer capture for the press's pointer id, and returns `true`; otherwise returns `false`. The detach closure that `onPointerDown` builds today is kept on the instance for this (and cleared by `detach`).
  - `TrackReorderHandler.isActive: boolean` (getter): `this._trackId !== null`. The existing `cancel()` is the cancel (it resets every row and lane and commits no reorder).
  - `AnnotationDragHandler.isActive: boolean` (getter): `this._drag !== null`. `AnnotationDragHandler.cancel(): void`: restores the drag-start snapshot and tears down, the same as `_onPointerCancel` without the pointer-id check. Both share one private `_restoreAndTeardown()`.

- [ ] **Step 1: Write the failing tests:**
  - `clip-pointer-handler.test.ts`: `it('isDragging is false after pointerdown and true once the pointer moves past the threshold')`, for a move: after `tryHandle` it is `false`; after `onPointerMove` with `clientX` 2 px away it is still `false`; at 4 px it is `true`; after `onPointerUp` it is `false`.
  - `pointer-handler.test.ts`: `it('cancelClipDrag reverts an armed clip drag and detaches its listeners')`: after a clip pointerdown routed to a mock `_clipHandler`, `cancelClipDrag()` returns `true` and calls `onPointerCancel` once; a later `pointermove` on the timeline does not reach `onPointerMove`; a second `cancelClipDrag()` returns `false`.
  - Track reorder: `it('isActive is true from grab until cancel')`; after `cancel()`, `reorderTrack` on the host was never called and every row's `style.transform` is `''`.
  - Annotation drag: `it('cancel restores the boundaries from the start of the drag')`: drag an edge (`_onPointerMove` past the threshold), then `cancel()`. The annotation's bounds equal the snapshot, `isActive` is `false`, and the box's `pointermove` listener is gone.
- [ ] **Step 2: Run them, see them fail:** `(cd packages/dawcore && npx vitest run src/__tests__/clip-pointer-handler.test.ts src/__tests__/pointer-handler.test.ts <reorder test> <annotation test>)`. Expected: the new tests fail with "not a function" / `undefined`.
- [ ] **Step 3: Implement** the four members as listed under Interfaces.
- [ ] **Step 4: Run the dawcore suite:** `(cd packages/dawcore && npx vitest run)`. Expected: all pass.
- [ ] **Step 5: Commit** (`refactor: dawcore drag handlers report and cancel their drag (#848)`).

### Task 3: dawcore — undo is inert during a drag; Escape cancels it

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (`undo()` / `redo()` at `:3366-3382`; `connectedCallback` / `disconnectedCallback` near `:1192` and `:1259`)
- Create: `packages/dawcore/src/__tests__/daw-editor-drag-guard.test.ts`
- Create: `.changeset/escape-cancels-drag-dawcore.md`

**Interfaces:**
- Consumes: Task 2's `isDragging`, `cancelClipDrag()`, `TrackReorderHandler.isActive` / `cancel()`, `AnnotationDragHandler.isActive` / `cancel()`; Task 1's core rule.
- Produces (internal to the editor):
  - `get _dragInProgress(): boolean`: `this._clipPointer.isDragging || this._trackReorderDrag.isActive`. Annotation drags are not part of it (annotations are not in the undo history).
  - `_cancelDrags(): boolean`: calls `this._pointer.cancelClipDrag()`, `this._trackReorderDrag.cancel()` when active, `this._annotationDrag.cancel()` when active; returns whether any was active.
  - `private _onDragEscape = (e: KeyboardEvent) => void`: on `window`, `{ capture: true }`, added in `connectedCallback`, removed in `disconnectedCallback`. For `e.key === 'Escape'` when `_cancelDrags()` returned `true`: `e.preventDefault()`. Nothing else (no `stopPropagation`: an app's own listener may read `defaultPrevented`).

- [ ] **Step 1: Write the failing tests** in `daw-editor-drag-guard.test.ts`. Mount a `<daw-editor>` with a stub engine whose `undo` / `redo` / `beginTransaction` / `abortTransaction` / `getClipBounds` are `vi.fn()`s (copy the mount pattern of the nearest existing editor test, e.g. `daw-editor-clip-interactions.test.ts` or `daw-editor-programmatic.test.ts`; read `packages/dawcore/notes/testing.md` first). Drive the handlers through their public methods (no real pointer capture in happy-dom).
  - `it('undo and redo do nothing while a clip drag is in progress')`: start a clip move, move 10 px; `editor.undo()` and `editor.redo()` leave `engine.undo` / `engine.redo` uncalled. After `onPointerUp`, `editor.undo()` calls `engine.undo` once.
  - `it('undo works while a clip is pressed but not yet dragged')`: press without moving; `editor.undo()` calls `engine.undo` once.
  - `it('undo and redo do nothing while a track-reorder drag is in progress')`: after `onGrab`, the same assertions as the clip case.
  - `it('Escape cancels a clip drag and prevents its default')`: during a clip move, `window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', cancelable: true }))`. The event's `defaultPrevented` is `true`, `engine.abortTransaction` was called, and `_clipPointer.isActive` is `false`.
  - `it('Escape cancels a track-reorder drag and an annotation edge drag')`: one assertion block for each handler: `isActive` is `false` afterwards; the reorder host's `reorderTrack` was not called.
  - `it('Escape during a drag does not stop playback; a second Escape does')`: a `<daw-keyboard-shortcuts playback>` inside the editor, `editor.stop` spied on. During a clip drag the first Escape leaves `stop` uncalled; the second (no drag left) calls it once.
  - `it('Escape with no drag in progress is left alone')`: `defaultPrevented` is `false`.
  - `it('a drag cut short by disconnect leaves undo working after reconnect')`: start a clip drag, remove the editor from the document, append it again. `_dragInProgress` is `false`, and `engine.abortTransaction` was called once by the disconnect.
- [ ] **Step 2: Run, see them fail:** `(cd packages/dawcore && npx vitest run src/__tests__/daw-editor-drag-guard.test.ts)`. Expected: the undo and Escape tests fail; "with no drag in progress" passes.
- [ ] **Step 3: Implement:** `undo()` and `redo()` return before the engine check when `_dragInProgress` (no warning: a key pressed during a drag is not a mistake). `_onDragEscape` and `_cancelDrags()` as under Interfaces. `disconnectedCallback` calls `_cancelDrags()` in place of the lone `this._trackReorderDrag.cancel()` at `:1259`, and before the engine is disposed (the clip cancel calls `engine.abortTransaction()`).
- [ ] **Step 4: Run the dawcore suite and typecheck:** `(cd packages/dawcore && npx vitest run)`, then, as its own command, `(cd packages/dawcore && npx tsc --noEmit)`. Expected: all pass, no errors.
- [ ] **Step 5: Changeset** `.changeset/escape-cancels-drag-dawcore.md`, `'@dawcore/components': patch`: undo and redo do nothing while a clip or track drag is in progress; Escape cancels a clip move, a clip trim, a track-reorder drag and an annotation edge drag, and does nothing else; disconnecting the editor mid-drag cancels the drag.
- [ ] **Step 6: Commit** (`fix: dawcore undo is inert during a drag, Escape cancels the drag (#848)`).

### Task 4: browser — a drag guard the provider owns; undo and redo read it

**Files:**
- Create: `packages/browser/src/providerInternals/dragGuard.ts`
- Create: `packages/browser/src/contexts/dragGuardContext.ts` (internal: not exported from `src/index.tsx` or `./tone`)
- Modify: `packages/browser/src/WaveformPlaylistContext.tsx` (create the guard once, provide it)
- Modify: `packages/browser/src/providerInternals/useArrangementEditing.ts` (`undo` / `redo`, `:152-153`; it takes the guard as a parameter)
- Modify: `packages/browser/src/hooks/useClipDragHandlers.ts` (begin on a clip drag start, end on its drag end, and on unmount)
- Modify: `packages/browser/src/components/ClipInteractionProvider.tsx` (the same for `data.kind === 'track-reorder'`, in `onDragStart` and `handleDragEnd`)
- Test: `packages/browser/src/__tests__/dragGuard.test.ts`, `packages/browser/src/__tests__/undoDuringDrag.test.tsx`
- Create: `.changeset/undo-during-drag-browser.md`

**Interfaces:**
- Produces:
  - `export interface DragGuard { begin(): () => void; readonly active: boolean }` and `export function createDragGuard(): DragGuard` in `dragGuard.ts`. `begin()` returns an `end` function that is idempotent (a second call does nothing). `active` is true while any `begin` has not been ended (a count, so two overlapping begins need two ends). Not React state: nothing re-renders on a drag start (design call: `canUndo` / `canRedo` unchanged during a drag).
  - `export const DragGuardContext = createContext<DragGuard | null>(null)` in `dragGuardContext.ts`.
  - Owner: `WaveformPlaylistProvider`, `const [dragGuard] = useState(createDragGuard)`, provided around its children. Writers: `useClipDragHandlers` (clip move and trim, so a custom `DragDropProvider` setup is covered too) and `ClipInteractionProvider` (track reorder). Reader: `useArrangementEditing`'s `undo` / `redo`.
- Consumes: nothing from Tasks 1-3.

- [ ] **Step 1: Write the failing tests:**
  - `dragGuard.test.ts`: `it('is active from begin until its end')`; `it('an end called twice ends one begin only')` (two begins, one end called twice: still active; the second end: inactive).
  - `undoDuringDrag.test.tsx` (mount with `renderWithArrangement` from `__tests__/helpers/arrangementProvider.tsx`; capture the `DragDropProvider` props as `trackReorderDropCommits.test.tsx` does; call handlers the way dnd-kit does, `act(() => startTransition(() => handler(event)))`, as `trimPreview.test.tsx`'s `dispatch`):
    - `it('undo and redo do nothing during a clip drag')`: make one undo step (`arrangement.moveClip`), dispatch a clip `onDragStart`, call `useEditorControls().undo()`. `arrangement.canUndo` is still `true` and the clip has not moved back. After `onDragEnd` (canceled), `undo()` moves it back.
    - `it('undo and redo do nothing during a track-reorder drag')`: the same with a `track-reorder` source (data `{ kind: 'track-reorder', trackId }`).
    - `it('undo works again when the drag provider unmounts mid-drag')`: start a clip drag, unmount the tree under the provider that holds `ClipInteractionProvider` (or rerender without it), call `undo()`: the step is undone.
- [ ] **Step 2: Run, see them fail:** `(cd packages/browser && npx vitest run src/__tests__/dragGuard.test.ts src/__tests__/undoDuringDrag.test.tsx)`. Expected: "Cannot find module '../providerInternals/dragGuard'" and the undo assertions fail.
- [ ] **Step 3: Implement** as under Interfaces. In `useClipDragHandlers` keep the `end` function in a ref: set it in `onDragStart` for a clip source (not for `track-reorder`, which `ClipInteractionProvider` owns), call and clear it in `onDragEnd`, and in an effect cleanup that runs on unmount. `useClipDragHandlers` reads the context with `use(DragGuardContext)` and does nothing when it is `null` (outside the provider it already throws for another reason; keep that).
- [ ] **Step 4: Run the browser suite:** `(cd packages/browser && npx vitest run > <scratchpad>/browser-vitest.log 2>&1)`, then read the summary line of the log. Expected: all pass, including `oneOwnerPerExport.test.ts` (`DragGuardContext` and `createDragGuard` are not in any entry).
- [ ] **Step 5: Build browser, then typecheck** (each its own command, after the port-3000 check): `pnpm --filter @waveform-playlist/browser build`, then `pnpm typecheck`. Expected: exit 0.
- [ ] **Step 6: Changeset** `.changeset/undo-during-drag-browser.md`, `'@waveform-playlist/browser': patch`: undo and redo (`useEditorControls`, `<KeyboardShortcuts undo />`) do nothing while a clip move, a clip trim or a track-reorder drag is in progress. Fixes #906.
- [ ] **Step 7: Commit** (`fix: React undo is inert during a clip or track drag (#848, #906)`).

### Task 5: the behaviour in a browser, both editors

**Files:**
- Create: `e2e/drag-undo-escape.spec.ts` (React: `/examples/multi-clip` and `/examples/stem-tracks`)
- Create: `e2e/dawcore-drag-undo-escape.spec.ts` (dawcore: `${DAWCORE_NATIVE_URL}/multiclip.html`, the pattern of `e2e/dawcore-mixer-undo.spec.ts`)

**Interfaces:**
- Consumes: Tasks 1-4 as built. Pointer input with `page.mouse`; Cmd+Z as `Meta+z` on macOS and `Control+z` elsewhere (as the existing keyboard specs choose it).

- [ ] **Step 1: Write the dawcore spec**, each a `test(…)`. Positions are a clip's left edge in px, read from the shadow DOM as `dawcore-mixer-undo.spec.ts` reads its state:
  - `'undo during a clip move does nothing; the clip lands where the pointer put it'`: drop one clip 40 px to the right (one step), press its header again, move 60 px, press Cmd+Z with the button held, move on to 120 px, release. The clip is at start + 160 px. One Cmd+Z brings it to start + 40; a second to start. The console has no `commitTransaction: no active transaction` warning.
  - `'Escape during a clip move puts the clip back and keeps playing'`: play, press a header, move 60 px, Escape, release. The clip is at its start, `editor.engine.getState().isPlaying` is `true`, and `canUndo` is unchanged. A second Escape stops playback.
  - `'Escape during a trim and during a track-reorder drag cancels each'`: the width after a cancelled trim equals the width before; the track order (`editor.tracks` names) after a cancelled reorder drag equals the order before.
- [ ] **Step 2: Write the React spec:**
  - `'undo during a clip move does nothing (multi-clip)'`: the same sequence as the dawcore move test; the clip's left edge is read from the clip element's bounding box.
  - `'Escape during a clip move cancels it and keeps playing (multi-clip)'`: as the dawcore test. This pins dnd-kit's own Escape cancel together with Task 1's rule.
  - `'undo during a track-reorder drag does nothing, and the panels stay in DOM order (stem-tracks)'`: the #906 sequence: drag track 0 to 1 and drop, start a drag of row 2, Cmd+Z, release in place. The panels' DOM order equals their on-screen order (compare `document.querySelectorAll('[data-track-controls]')` order with their sorted `getBoundingClientRect().top`).
- [ ] **Step 3: Prove each test against the old code:** `git stash` is NOT used (root `CLAUDE.md`, "Git Safety"). Stop your Docusaurus server on 3077 first (a bulk source change under a running Docusaurus server can abort it; root `CLAUDE.md`), then `git checkout dev -- packages/core/src packages/dawcore/src packages/browser/src`, start the server again, run both specs (`PORT=3077 npx playwright test e2e/drag-undo-escape.spec.ts e2e/dawcore-drag-undo-escape.spec.ts`), record which fail, then `git restore --source=HEAD --staged --worktree -- packages`. Expected on the old code: every undo test and the dawcore Escape tests fail; the React Escape test may pass (dnd-kit cancels) except for "keeps playing". Write what was seen into the commit message.
- [ ] **Step 4: Run both specs on the branch,** 5 times each (`--repeat-each 5`). Expected: 0 failures.
- [ ] **Step 5: Add both routes** the React spec uses to `ROUTES` in `e2e/global-setup.ts` if they are not there already.
- [ ] **Step 6: Commit** (`test: undo and Escape during a drag, in a browser, both editors (#848)`).

### Task 6: documentation

**Files:**
- Modify: `packages/dawcore/COMPONENTS.md` (`<daw-keyboard-shortcuts>`; the editor's `undo()` / `redo()`)
- Modify: `packages/dawcore/notes/interactions.md` (a section "Undo and Escape during a drag (#848)": `_dragInProgress`, `_cancelDrags`, the window capture listener, why `preventDefault` and not `stopPropagation`)
- Modify: `docs/specs/web-components-migration.md` (the keyboard section)
- Modify: `website/docs/react/guides/playback-controls.md` (the shortcuts list, near `:457`: Escape during a drag only cancels it; undo and redo do nothing during a clip or track drag)
- Modify: `website/docs/react/guides/custom-drag-setup.md` (near `:91`: `useClipDragHandlers` marks its drags for the undo guard; a custom track-reorder `onDragEnd` of the app's own is not covered)
- Modify: `packages/browser/notes/clip-drag-and-snap.md` and `packages/browser/notes/track-controls-and-reorder.md` (where the guard is begun and ended)
- Modify: the dnd-kit skill's last table row (`.claude/skills/dnd-kit/SKILL.md`, "Undo pressed during a drag…"), now answered by this PR

- [ ] **Step 1: Write the doc changes.** Each sentence is checked against the source line that makes it true (the skill `review-rounds`, "A reviewer for documentation claims").
- [ ] **Step 2: Grep `website/docs`, `packages/*/README.md`, `README.md` and `website/static/llms.txt` for "Escape"** and correct any sentence the new rule makes wrong.
- [ ] **Step 3: Website build:** `pnpm --filter website build` (after the port-3000 check). Expected: exit 0, no broken links.
- [ ] **Step 4: Lint, as its own command:** `pnpm lint`. Expected: exit 0 with the `✖ N problems (0 errors, …)` summary; no file this branch changed is in the warning paths.
- [ ] **Step 5: Commit** (`docs: undo and Escape during a drag (#848)`).

## After the tasks

- Remove nothing yet: the spec and this plan stay until the last PR of #848 merges (root `CLAUDE.md`, "Design docs and implementation plans"). This plan file goes with PR 1's branch; PR 2's plan is written after PR 1 merges.
- The PR is "Part 1 of 3 for #848", with no closing keyword next to #848, and `closes #906`. Check `gh pr view <n> --json closingIssuesReferences` after writing the body.
