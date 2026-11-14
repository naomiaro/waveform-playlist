# Arrangement (engine half) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One object, the arrangement, owns the tracks and everything that changes them; `PlaylistEngine` delegates to it and plays it one way (#812, the engine half).

**Architecture:** `Arrangement` is extracted from `PlaylistEngine` (code motion first, then its own rules: immutability, a mixer part by track id, structure-only undo, history notifications), then gains the source loader and the switch of a loading clip to a loaded one. The engine keeps its public API by delegating, so dawcore is unchanged in what it calls. The React half (provider, recording, examples, docs) and MIDI get their own plan once this half is reviewed, because that plan is written against the interface this one produces.

**Tech Stack:** TypeScript, vitest, tsup, pnpm workspace, changesets. No React in this plan.

**Spec:** `docs/specs/2026-11-13-arrangement-design.md` (approved 2026-11-13, eight calls included). `docs/specs/2026-11-13-provider-loads-sources-design.md` stays in force for the types, `createSourceLoader`, `audioTrack()` and the conversion of a loading clip. Read both before any task.

## Global Constraints

- **The rule:** every piece of state has one owner; everything else subscribes to it and changes it by asking the owner. A task that would add a second stored copy of the tracks, the mix or the history stops and reports.
- Read root `CLAUDE.md`, `packages/engine/CLAUDE.md`, `packages/core/CLAUDE.md` and, for dawcore checks, `packages/dawcore/CLAUDE.md` before the first edit.
- `PlaylistEngine`'s public methods keep their signatures and return values, including `skipAdapter` on `moveClip` / `trimClip` and `updateTrack(id)` with no track.
- `assertTrackKind` runs before any mutation, before any history change and before any adapter call (#756).
- The engine package has no runtime dependency besides `@waveform-playlist/core`. No new one.
- Immutable updates in everything written from PR 3 on. Files under 800 lines, functions under 50; `PlaylistEngine.ts` (948 lines) must end smaller than it starts.
- No cross-package re-exports; one owner per exported name (grep `packages/*/src/index.ts*` for a new name before exporting it).
- Downstream packages resolve engine through `dist`: after changing engine source, `pnpm --filter @waveform-playlist/engine build` before running browser, dawcore, playout or transport tests. Before ANY build, `pnpm test` or `git checkout`: `lsof -nP -iTCP:3000 -sTCP:LISTEN`; if a server is there that you did not start, do not build under it (use port 3077 for your own Docusaurus server and `PORT=3077 pnpm test`).
- A test run is its own command, read before the commit. Commit messages `<type>: <description>`, no attribution footer, written with `git commit -F - <<'EOF'`.
- Every new regression test is seen to fail with its guarded line broken; a characterisation test (one that pins existing behaviour) is checked the same way by breaking the line it pins.
- Never restore a file with `git checkout --` or `git stash`; copy it to the scratchpad and back.
- Every PR that changes `packages/*/src` adds a changeset by hand in `.changeset/` (engine: `major` from PR 3 on, because observable behaviour changes; `patch` for PR 2).
- Never merge. Each PR is opened only after the maintainer is told, and is left for them. The independent review covers the final diff.

## Review Focus

1. **dawcore's clip drag** (`clip-pointer-handler.ts`: `beginTransaction`, `moveClip(…, skipAdapter=true)` per pointer move, `updateTrack(id)` on drop, `commitTransaction`, `abortTransaction` on cancel): the adapter must receive exactly what it receives today, in the same order. Test in Task 1 (pinned) and Task 2 (still green).
2. **A statechange listener that calls back into the engine** (dawcore's handler overwrites its own track map and can trigger `reorderTrack` through `_syncDomToEngineOrder`): no lost or re-ordered notification, no recursion without end. Test in Task 1 (pinned on today's engine), still green after Task 2 and Task 5.
3. **An undo that changes the number of tracks** (undo of `addTrack` / `removeTrack`): `adapter.setTracks`, not per-track updates, and the selected track cleared when its track is gone. Test in Task 1 and Task 4.
4. **A mixer setter for a track the arrangement does not hold** (dawcore sets values for a track that is still loading): the adapter is still called, the arrangement changes nothing, no throw. Test in Task 4.
5. **A source that settles after its clip was removed and the removal undone, or after `setTracks` replaced everything:** no clip resurrected in a state that should not have it, no fetch started twice, a late result of an aborted load ignored. Test in Task 9.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/engine/src/arrangement/Arrangement.ts` (new) | the class: tracks, history, transactions, mixer part, change notifications |
| `packages/engine/src/arrangement/history.ts` (new, PR 3) | undo / redo stacks and the transaction base as pure helpers |
| `packages/engine/src/arrangement/mixer.ts` (new, PR 3) | the mixer part: seeding, setters, retention |
| `packages/engine/src/arrangement/sources.ts` (new, PR 4) | wanted set, the loader, the switch, snapshot patching |
| `packages/engine/src/arrangement/resolveLoadingClip.ts` (new, PR 4) | seconds to samples for one loading clip (ported from the first build's `resolveTracks.ts`) |
| `packages/engine/src/arrangement/loadSource.ts` (new, PR 4) | `LoadSource`, `defaultLoadSource` (moved from browser's first build) |
| `packages/engine/src/arrangement/attach.ts` (new, PR 4) | the versioned `Symbol.for` keys and the two attach points |
| `packages/engine/src/arrangement/index.ts` (new) | `createArrangement`, the public types |
| `packages/engine/src/PlaylistEngine.ts` | transport, view state, adapter sync; delegates the rest |
| `packages/engine/src/__tests__/adapterCalls.test.ts` (new) | what the adapter is called with, per operation |
| `packages/engine/src/__tests__/arrangement*.test.ts` (new) | the arrangement alone |

Branches, a linear stack: `feat/812-provider-loads-sources` (#839, open) → `feat/812-arr-1-extract` (PR 2) → `feat/812-arr-2-rules` (PR 3) → `feat/812-arr-3-loading` (PR 4). The first build, `feat/812-2-provider-resolution`, is not a parent of any of them: files are ported from it by path where a task says so. The spec and this plan are copied onto the first new branch and removed before the last PR of #812 merges.

---

# PR 2: extract the arrangement, code motion only

### Task 1: pin what the adapter is called with today

No engine test asserts the adapter calls of `undo`, `redo`, `abortTransaction` or `_restoreTracks`, and none covers a host's drag sequence. This task adds them against the UNCHANGED engine.

**Files:**
- Create: `packages/engine/src/__tests__/adapterCalls.test.ts`

**Interfaces:**
- Produces: a recording fake adapter `recordingAdapter()` (exported from a test helper `packages/engine/src/__tests__/helpers/recordingAdapter.ts`) whose `calls` is an ordered list of `{ method, args }` for `setTracks`, `addTrack`, `removeTrack`, `updateTrack` and the four mixer setters, and a variant without the three optional track methods. Later tasks reuse it.

- [ ] **Step 1: Write the tests.** Each asserts the exact ordered list of adapter calls (method and, for track calls, the track ids and clip ids passed) AND the number of `statechange` emissions, for:
  - `setTracks`, `addTrack`, `removeTrack`, `updateTrack(id, track)`, `updateTrack(id)`, `reorderTrack` (no adapter call), `moveClip`, `moveClip(…, skipAdapter=true)`, `trimClip` both edges, `trimClip(…, true)`, `splitClip`;
  - each of the above with an adapter that lacks `addTrack` / `removeTrack` / `updateTrack` (the `setTracks` fallback);
  - `undo` and `redo` of a move, a trim, a split, an `updateTrack`, a `reorderTrack` (same number of tracks: record that `updateTrack` is called for EVERY track, as today), of an `addTrack` and a `removeTrack` (`setTracks`);
  - a transaction: `beginTransaction`, three `moveClip(…, true)`, `updateTrack(id)`, `commitTransaction` (the dawcore move drag); the same ending in `abortTransaction`; a transaction with no change committed and aborted (no adapter call, no emission);
  - the four mixer setters, for a known id and for an unknown id (the adapter is still called);
  - `setTempo` with a refusing and an accepting adapter (`updateTrack` for every track on acceptance);
  - `removeTrack` of the selected track (`selectedTrackId` null in the next state);
  - `updateTrack(id, track)` with an unknown id (record today's behaviour: a snapshot, a version bump, an adapter call and an emission, and no track added);
  - `undo` while a transaction is open (record today's behaviour);
  - a `statechange` listener that calls `engine.reorderTrack` once from inside the handler: both emissions arrive, in order, each with its own `tracksVersion`, and the listener is not called a third time (Review Focus 2).
- [ ] **Step 2: Run** `(cd packages/engine && npx vitest run src/__tests__/adapterCalls.test.ts)`. Expected: PASS on the unchanged engine. A test that fails means the test is wrong about today: read the engine and correct the expectation, never the engine.
- [ ] **Step 3: Check each group is real.** Break one line per group in `PlaylistEngine.ts` (skip the adapter call in `_restoreTracks`; drop the `skipAdapter` guard; drop the mixer forward for an unknown id; make `reorderTrack` call the adapter), see a named test fail, restore.
- [ ] **Step 4: Commit** `test(engine): pin the adapter calls and emissions of every track operation (for #812)`.

### Task 2: `Arrangement`, by code motion

**Files:**
- Create: `packages/engine/src/arrangement/Arrangement.ts`, `packages/engine/src/arrangement/index.ts`
- Modify: `packages/engine/src/PlaylistEngine.ts`
- Test: `packages/engine/src/__tests__/arrangement.test.ts`

**Interfaces:**
- Consumes: Task 1's tests as the contract.
- Produces (internal in this PR; NOT exported from the package's `index.ts` yet):

```ts
export type ArrangementChange =
  | { type: 'set' }
  | { type: 'add'; trackId: string }
  | { type: 'remove'; trackId: string }
  | { type: 'update'; trackId: string }
  | { type: 'reorder' }
  | { type: 'restore'; previous: readonly ClipTrack[] }
  | { type: 'mixer'; trackId: string }
  | { type: 'recompute' }
  | { type: 'history' };

export interface ArrangementTimeBase {
  sampleRate: number;
  secondsToTicks(seconds: number): number;
  ticksToSeconds(tick: number): number;
}

export class Arrangement {
  constructor(options: { undoLimit?: number; timeBase: ArrangementTimeBase });
  getTracks(): ClipTrack[];            // the live array, as `_tracks` is today
  readonly tracksVersion: number;
  readonly mixerVersion: number;
  onChange(listener: (change: ArrangementChange) => void): () => void;
  // the track, clip, mixer, undo and transaction methods of the spec's interface,
  // each with exactly today's behaviour
  recomputeStartSamples(): void;
}
```

- [ ] **Step 1: Write `arrangement.test.ts`**, driving a `Arrangement` with a fake time base and no engine: for each operation, the resulting tracks, the two versions, `canUndo` / `canRedo`, and the `ArrangementChange` emitted. Port the cases of `undo.test.ts` that do not need an adapter. Expected now: FAIL, module not found.
- [ ] **Step 2: Move the code.** Into the arrangement: `_tracks`, `_tracksVersion`, `_mixerVersion`, `_undoStack`, `_redoStack`, `_inTransaction`, `_transactionSnapshot`, `_transactionMutated`, `undoLimit`, `_snapshotTracks`, `_pushUndoSnapshot`, the track and clip methods' state logic, the mixer setters' in-place writes, the startTick enrichment and `_recomputeStartSamples`' loop (through the time base), `assertTrackKind` calls. Behaviour is copied line for line: snapshots are still copies, mixer writes are still in place, `updateTrack` with an unknown id still does what Task 1 recorded. In the engine: each public method calls the arrangement, then makes the adapter call it made before, then emits `statechange`, in the order it had. The engine builds the time base from its `_sampleRate`, `_secondsToTicks`, `_ticksToSeconds`. `getState()` reads the arrangement. `removeTrack` still clears the selected track in the engine method.
  The engine does NOT yet subscribe to `onChange` for adapter sync: in this PR `onChange` exists and is tested, and the engine's methods stay the place where adapter calls are made, so the order cannot drift. (Task 5 moves adapter sync onto the subscription.)
- [ ] **Step 3: Run** the engine suite: `(cd packages/engine && npx vitest run > <scratchpad file> 2>&1)`. Expected: every existing test and Task 1's file PASS with NO edit to any existing test file. A change to an existing test's expectation is not allowed in this PR; if one seems needed, stop and report.
- [ ] **Step 4: Downstream.** Port check, then `pnpm --filter @waveform-playlist/engine build`, then `(cd packages/browser && npx vitest run)`, `(cd packages/dawcore && npx vitest run)`, `(cd packages/playout && npx vitest run)`, `(cd packages/transport && npx vitest run)`, `pnpm typecheck`, `pnpm lint` (0 errors). All green, unchanged.
- [ ] **Step 5: Size.** `PlaylistEngine.ts` is smaller than before; no method body was changed beyond replacing state access with a call to the arrangement. State the line counts in the report.
- [ ] **Step 6: e2e.** `pnpm build`, then the full Playwright suite on the head commit (`pnpm test`, or `PORT=3077 pnpm test` with your own server). All green.
- [ ] **Step 7: Changeset** (engine `patch`: "internal: track state moves into a arrangement object; no behaviour change"). Commit `refactor(engine): track state, undo and transactions move into Arrangement (for #812)`.
- [ ] **Step 8 (controller):** independent review of the PR 2 diff with the question "is any behaviour different", fix, repeat until nothing above low. Tell the maintainer; open the PR as "Part 2 of 6 for #812".

---

# PR 3: the arrangement's rules

### Task 3: immutability and snapshots by reference

**Files:** `arrangement/Arrangement.ts`, `arrangement/history.ts` (new), `__tests__/arrangementImmutable.test.ts` (new).

**Interfaces:**
- Produces: `getTracks(): readonly ClipTrack[]` returning the same array until a change; every write replaces the array and only the changed track and clip objects; `history.ts` exports pure `pushStep`, `undoStep`, `redoStep`, `beginBase`, typed over `readonly ClipTrack[]`.

- [ ] **Step 1: Tests:** after any single-track operation the other tracks and every untouched clip are the SAME objects; `getTracks()` is the same array across a selection or zoom change of the engine and across `getState()` calls; a snapshot taken before a change still equals what it was (deep-equal against a `structuredClone` taken at the time, with `audioBuffer` left out); `undo` then `redo` returns arrays whose unchanged tracks are identical objects to the pre-undo ones; freezing (`Object.freeze` on tracks and clip arrays in the test) breaks nothing.
- [ ] **Step 2–4:** fail, implement (snapshots become references; `_snapshotTracks` goes), pass.
- [ ] **Step 5:** Task 1's file: update ONLY the expectations this rule changes, each with a comment naming the rule: `undo` / `redo` with the same number of tracks now call `updateTrack` for the tracks that differ, not for every track. Everything else stays green untouched.
- [ ] **Step 6:** engine `getState()`: `tracks` is the arrangement's array (no copy). Grep every consumer of `getState().tracks` and `state.tracks` in `packages/browser/src`, `packages/dawcore/src`, `examples/` for a write to the array or to a track object after receiving it (`.push(`, `.sort(`, `.splice(`, an assignment to `track.` or `clip.`); list what was found in the report; a writer is a blocker to report, not to patch.
- [ ] **Step 7:** Commit.

### Task 4: the mixer part and structure-only undo

**Files:** `arrangement/mixer.ts` (new), `arrangement/Arrangement.ts`, `PlaylistEngine.ts`, `__tests__/arrangementMixer.test.ts` (new).

**Interfaces:**
- Produces: `getMixer(): ReadonlyMap<string, TrackMixerValues>` (same Map until a value changes); the four setters replace the Map and one entry, bump `mixerVersion`, emit `{ type: 'mixer', trackId }`, replace no track object; a setter for an unknown id changes nothing and emits nothing in the ARRANGEMENT (the ENGINE method still forwards to the adapter, Review Focus 4).
  In the engine: `private _tracksForAdapter(): ClipTrack[]`, the arrangement's tracks with the current mixer values merged in, cached by `(tracksVersion, mixerVersion)`; it is what every adapter track call and `getState().tracks` use.

- [ ] **Step 1: Tests:**
  - a track entering through `setTracks` / `addTrack` seeds its entry from its own fields; an id that already has an entry keeps it;
  - a setter changes the Map identity and that entry only; `getTracks()` and every track object are unchanged; `tracksVersion` unchanged;
  - `updateTrack(id, { ...track, volume: 0.1 })` does not change the entry;
  - undo of a move after a volume change: the volume stays; undo of `removeTrack`: the track is back with the mix it had when removed; after the history is cleared (`setTracks`, `clearHistory`) entries of tracks that no state holds are dropped;
  - `getState().tracks[i].volume` is the current value (dawcore reads it: `daw-editor.ts:2658-2665`), and `getState().tracks` is the same array until tracks or mix change;
  - what the adapter is given by `addTrack` / `updateTrack` / `setTracks` carries the current mix;
  - Review Focus 3 and 4.
- [ ] **Step 2–4:** fail, implement, pass. Update Task 1's expectations only where this rule changes them (the track objects passed to the adapter are the merged projection; the mixer setter for an unknown id emits no `statechange`... record precisely what changed and why).
- [ ] **Step 5: dawcore.** Build engine; run dawcore's unit suite. Read `daw-editor.ts` around 1451-1456, 1620-1632, 2658-2665, 2976-2979 and `recording-controller.ts:380-385, 799` and write, per path, what dawcore observes before and after (the descriptor stays its source for control values; after this task an undo no longer changes the audio's mix under it). Any dawcore test that needs a changed expectation is listed with the reason.
- [ ] **Step 6:** Commit.

### Task 5: history notifications, the fixes, adapter sync by subscription

**Files:** `arrangement/Arrangement.ts`, `PlaylistEngine.ts`, tests.

- [ ] **Step 1: Tests:**
  - `commitTransaction` (with a change) and `clearHistory` emit `{ type: 'history' }`, and the engine emits `statechange` with fresh `canUndo` / `canRedo`;
  - `updateTrack` with an unknown id: nothing changes, nothing is emitted, no adapter call;
  - `undo` / `redo` with a transaction open abort it first, then act;
  - `setTracks` with a transaction open aborts it and clears the history;
  - duplicate track ids, or duplicate clip ids within a track, in `setTracks` / `addTrack` / `updateTrack`: throws `[waveform-playlist] …` naming the ids, and tracks, history, mixer and subscribers are untouched;
  - a listener that writes during a notification gets its own change after the one it is handling, and every listener sees every change once, in order.
- [ ] **Step 2: Move adapter sync onto the subscription.** The engine subscribes to `onChange` in its constructor and maps each `ArrangementChange` to the adapter call of the spec's "Arrangement to adapter" list; its public methods become: call the arrangement. `skipAdapter` is a flag the engine sets around that one call so its subscriber skips the forward; `updateTrack(id)` with no track forwards the current track. Task 1's file must stay green apart from the expectations Tasks 3–5 changed by rule.
- [ ] **Step 3:** `removeTrack` clearing the selected track becomes the subscriber's reaction to a `remove` or a `restore` in which the selected id is gone (this also fixes: undo of an `addTrack` leaves a selected id that no track has; add that test).
- [ ] **Step 4–5:** run all, break the abort-first line, the validation, the ordered delivery; see named tests fail. Commit.

### Task 6: the arrangement as an engine option

**Files:** `arrangement/index.ts`, `PlaylistEngine.ts`, `types.ts`, `packages/engine/src/index.ts`, tests.

**Interfaces:**
- Produces (public, exported from `@waveform-playlist/engine`): `createArrangement(options?: { tracks?, undoLimit? })`, the `Arrangement` interface of the spec WITHOUT `sources` and `retry` (PR 4 adds them) and with `ClipTrack` where the spec has `ArrangementTrack` (PR 4 widens it), `TrackMixerValues`; `PlaylistEngineOptions.arrangement?: Arrangement`.

- [ ] **Step 1: Tests:**
  - `new PlaylistEngine({ adapter })` behaves as before (creates its own arrangement);
  - a arrangement with tracks given to a new engine: `adapter.setTracks` once in the constructor with the merged projection; `getState().tracks` matches;
  - changes made on the ARRANGEMENT directly (not through the engine) reach the adapter and emit `statechange`;
  - dispose the engine; change the arrangement (no adapter call, no throw); build a second engine on it: same tracks, same mix, same undo history (`canUndo` true, `undo()` works and reaches the new adapter);
  - a second engine attached while the first is alive: one `console.warn`;
  - a arrangement created with no engine: every operation works; clips are not given ticks until an engine attaches; `minDuration` uses the clip's own `sampleRate`;
  - `undoLimit` on the engine options still applies when the engine creates the arrangement; ignored with a warning when a arrangement is passed.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Docs for the engine API:** `packages/engine/README.md`, `packages/engine/CLAUDE.md` (a section "The arrangement owns the tracks"; correct every sentence there that says the engine holds tracks, snapshots or mixer values), `website/docs/llm-reference.md` and `website/static/llms.txt` for the engine entries, `website/docs/framework-agnostic/engine.md`. `pnpm --filter website build`.
- [ ] **Step 6: Whole-repo checks.** Engine build; browser, dawcore, playout, transport, recording unit suites; `pnpm typecheck`; `pnpm lint`; `pnpm build`; full e2e (it includes dawcore's specs). The behaviour-change table for the PR text: one row per rule that changed an expectation in Task 1's file or in a dawcore/browser test, with the dawcore or browser path it reaches.
- [ ] **Step 7:** Changeset (engine `major`). Commit `feat(engine)!: Arrangement owns the tracks, the mix and the history; the engine plays it (#812)`.
- [ ] **Step 8 (controller):** independent review of the final diff, the behaviour table to the maintainer in chat, PR "Part 3 of 6 for #812".

---

# PR 4: loading in the arrangement

Needs #839 merged or as an ancestor (it is: the stack starts on it).

### Task 7: loading clips in the arrangement

**Files:** `arrangement/Arrangement.ts`, `PlaylistEngine.ts`, tests.

**Interfaces:**
- Produces: the arrangement's tracks are `readonly ArrangementTrack[]` (`getTracks`, `setTracks`, `addTrack`, `updateTrack`); the engine's projection (`_tracksForAdapter`, `getState().tracks`) leaves loading clips out and stays `ClipTrack[]`.

- [ ] **Step 1: Tests:** a loading clip survives every track operation on its track (same object) and is in undo snapshots; `moveClip` / `trimClip` / `splitClip` / `getClipBounds` / `constrainTrimDelta` on a loading clip's id behave as for an unknown clip (warn, 0 or null, no change); neighbours' constraints ignore loading clips; a loading clip on a MIDI track passes validation and is never projected; the adapter never receives a loading clip; `calculateDuration` in `getState()` ignores them; clip order within a track is kept.
- [ ] **Step 2–4:** fail, implement, pass. Commit.

### Task 8: `LoadSource` and the conversion, moved into the engine package

**Files:**
- Create: `arrangement/loadSource.ts` (port `packages/browser/src/utils/loadSource.ts` and its test from branch `feat/812-2-provider-resolution`, with the label rules of that file), `arrangement/resolveLoadingClip.ts` (port the loaded-clip conversion, its validation and its warn-once record from that branch's `packages/browser/src/utils/resolveTracks.ts`: `git show feat/812-2-provider-resolution:<path>`), tests beside them.

**Interfaces:**
- Produces: `type LoadSource`, `defaultLoadSource`; `resolveLoadingClip(clip: LoadingClip, buffer: AudioBuffer): { clip: AudioClip } | { unusable: string }` (never throws; the conversion rules of the first design; "unusable" carries the reason for call 6).
- Also in this task, from that branch's parked minors: a URL's userinfo (`user:pass@`) is removed from every label; a `TypeError` thrown by `fetch` is rethrown as `Error('Failed to fetch ' + label)` with the original in `cause`, an `AbortError` left alone; `duration: null` is treated as not given.

- [ ] **Step 1–4:** port the tests first (they fail: module not found), port the code, pass; add tests for the three parked items. Commit.

### Task 9: the loader, the switch, history patching

**Files:** `arrangement/sources.ts` (new), `arrangement/Arrangement.ts`, `arrangement/index.ts`, tests `__tests__/arrangementSources.test.ts`.

**Interfaces:**
- Consumes: `createSourceLoader` from core; Task 8.
- Produces: `arrangement.sources: ValueSource<ArrangementSourcesValue>` (`{ sources: ReadonlyMap<ClipSource, { status, error? }>, pendingCount, failedCount, isLoading }`, the same object until a status changes), `arrangement.retry(src)`, `createArrangement({ loadSource })`, and the type `ArrangementSourcesValue` exported from the engine package.

- [ ] **Step 1: Tests** (a fake `loadSource` that keeps every pending call; a fake decode context attached through Task 10's point, written first as a test helper that calls a not-yet-existing method: write Task 10's attach in this task if that is simpler, and say so):
  - wanted = sources of the current tracks ∪ every undo and redo snapshot ∪ an open transaction's base; removing a track with a pending clip does not abort its load while a snapshot names it; `clearHistory` then drops it (abort);
  - `provide` for a clip carrying `src` + `audioBuffer`; a later loading clip of that source resolves in the same call;
  - the switch: every `LoadingClip` object naming the source is replaced by its `AudioClip` in the current tracks AND in every snapshot; tracks shared between snapshots stay shared (identity) after patching; one notification; no undo step; `tracksVersion` bumps once;
  - the three history cases: an arrival then `abortTransaction`; an arrival then `undo`; a track added with a pending clip, `undo`, `redo`, then the arrival: each ends with the loaded clip present wherever its loading clip was;
  - a snapshot from before the clip existed does not gain it;
  - an unusable clip (offset past the end): it stays a loading clip everywhere; `sources` shows the source `failed` with the reason; nothing is deleted;
  - a failed source changes no track; `retry` restarts it; a loading clip on a MIDI track is not wanted and is reported once in `sources` as failed with `A loading clip cannot be on a MIDI track`;
  - Review Focus 5;
  - the engine: a switch reaches the adapter as `updateTrack` for each track that gained a clip (with `updateTrack?` missing: `setTracks`), also while a transaction is open;
  - the wanted set is re-declared only when it changed (count `setWanted` calls across ten mixer and clip edits: 0).
- [ ] **Step 2–4:** fail, implement, pass. Break: the snapshot patching, the per-object (not per-id) match, the history part of the wanted set; see named tests fail.
- [ ] **Step 5:** Commit.

### Task 10: attaching, safe across two copies of the package

**Files:** `arrangement/attach.ts` (new), `arrangement/Arrangement.ts`, `PlaylistEngine.ts`, tests.

**Interfaces:**
- Produces: `ARRANGEMENT_ATTACH_DECODE = Symbol.for('@waveform-playlist/engine/arrangement/attach-decode/v1')` and `…/time-base/v1`; exported helpers `attachDecodeContext(arrangement, getContext: () => Promise<BaseAudioContext>): () => void` and (internal) `setTimeBase`; `PlaylistEngineOptions.attachDecodeContext?: boolean` (default `true`: a standalone engine attaches its adapter's context in the constructor and detaches in `dispose()`; the React provider will pass `false` and attach itself).

- [ ] **Step 1: Tests:** nothing is fetched before an attach; `sources` shows wanted sources as pending meanwhile; attach starts them; detach suspends in-flight loads and keeps loaded values; re-attach restarts the suspended ones once; two attaches at once: the second warns and replaces; a arrangement created by a SECOND copy of the module (`vi.resetModules()` and a second `import()`) can be attached and given a time base by the first copy's engine; an engine with `attachDecodeContext: false` does not attach.
- [ ] **Step 2–4:** fail, implement, pass.
- [ ] **Step 5: Docs:** the engine README and notes, `llm-reference.md`, `llms.txt`, `framework-agnostic/engine.md` for loading in the arrangement; `packages/core/CLAUDE.md` if the loader's described owner changes. `pnpm --filter website build`.
- [ ] **Step 6: Whole-repo checks** as in Task 6 Step 6, plus the core suite.
- [ ] **Step 7:** Changeset (engine `major` already pending: extend its text). Commit `feat(engine): the arrangement loads the audio its clips name and switches them when it arrives (#812)`.
- [ ] **Step 8 (controller):** independent review of the final diff; tell the maintainer; PR "Part 4 of 6 for #812". Then write the plan for the React half against the interface as built, and file the dawcore follow-up issue with that interface.
