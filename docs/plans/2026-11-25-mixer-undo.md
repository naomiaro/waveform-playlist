# Mixer Undo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mixer moves (track volume, pan, mute, solo) become undo steps, one per gesture, in both the React provider and dawcore's `<daw-editor>`, with the recording arm as an override outside the history.

**Architecture:** The arrangement's saved states hold the mix beside the tracks; the four setters push a step by default, join the top step when they carry the same gesture id, or write through every saved state with `undoable: false`. A framework-free `createMixerGesture()` in the engine is what both editors' sliders use. The arm is a set of track ids on the arrangement, applied in the engine's projection (`muted: stored || armed`).

**Tech Stack:** TypeScript, vitest (engine and browser under jsdom, dawcore under happy-dom), React 19, Lit, Playwright.

**Spec:** `docs/specs/2026-11-25-mixer-undo-design.md` (read it first; this plan argues from it).

## Global Constraints

- Immutable updates only: a change replaces the Map, the array and the objects it changes; nothing is written into an object already handed out.
- One owner per piece of state (root `CLAUDE.md`): the arrangement owns the mix, the history and the armed set. No second stored copy, also not in React or dawcore.
- `MixerChangeOptions` and `createMixerGesture` are exported by `@waveform-playlist/engine` only (no re-export from browser or dawcore: "No Cross-Package Re-Exports").
- The attach keys in `packages/engine/src/arrangement/attach.ts` move from `/v1` to `/v2` (the interface the engine uses by name changes).
- `tracksVersion` is not incremented by a change of the mix only (also not by an undo of one); `mixerVersion` is incremented by every change of the current mix or of the armed set.
- Every check is its own command: run vitest, typecheck, lint, build and e2e as separate Bash calls and read each result before committing (root `CLAUDE.md`).
- Before `pnpm build`, `pnpm test` or a checkout: `lsof -nP -iTCP:3000 -sTCP:LISTEN` as its own command; with a server you did not start, use port 3077 and `PORT=3077`.
- Changesets: `@waveform-playlist/engine` major, `@waveform-playlist/browser` major, `@dawcore/components` patch. Bodies name no PR number before the PR exists.
- `git rm` this plan and the spec before the last PR of #843 merges.
- Three PRs, each stacked on the one before: part 1 the engine (Tasks 1-4), part 2 React (Tasks 5-7), part 3 dawcore (Tasks 8-12). "Part N of 3 for #843", no closing keyword except on part 3.

## Review Focus

1. **A mute click on an armed track** — the stored mute changes, and the adapter must still receive `muted: true` while the track is armed. Pinned in Task 3 ("a mute set while armed still plays muted").
2. **Undo of a fader move during playback** — the adapter gets its volume setter, never a `setTracks` (which interrupts playback). Pinned in Task 1 ("an undo of the mix calls the mixer setters only").
3. **A drag continued after an Undo with the slider still focused** — the gesture id has not ended; the next change must push a new step, not join the step under the undone one. Pinned in Task 2 ("a gesture does not join a step after an undo").
4. **`setTracks` in the middle of a gesture** (dawcore's load path does this) — the history is gone; the next change with the old id pushes a new step and does not throw. Pinned in Task 2 ("a gesture after setTracks pushes a new step").
5. **Volume then pan on one track, back to back** — two sliders, two ids, two steps. Pinned in Task 6 (React) and Task 10 (dawcore).

---

## Part 1: the engine

### Task 1: Saved states hold the mix

**Files:**
- Modify: `packages/engine/src/arrangement/history.ts` (a state is `{ tracks, mixer }`)
- Modify: `packages/engine/src/arrangement/Arrangement.ts` (`undo`, `redo`, transactions, `_restoreTracks` → `_restoreState`, removal of `retainMixer` calls, new change kinds)
- Modify: `packages/engine/src/arrangement/mixer.ts` (remove `retainMixer` if unused; add `sameMixerValues`)
- Modify: `packages/engine/src/adapterSync.ts`, `packages/engine/src/PlaylistEngine.ts` (`_onArrangementChange`)
- Test: `packages/engine/src/__tests__/arrangementMixerHistory.test.ts` (new); update `arrangementMixer.test.ts`, `adapterCalls.test.ts` where they pin "undo never changes the mix" (each changed expectation gets a `// Rule (#843): ` comment saying what it was before)

**Interfaces:**
- Produces (internal):
  - `interface SavedState { readonly tracks: Tracks; readonly mixer: Mixer }`
  - `History { undo: readonly SavedState[]; redo: readonly SavedState[] }`; `TransactionBase { state: SavedState; changed: boolean }`
  - `pushStep(history, state: SavedState, limit)`, `undoStep(history, current: SavedState)`, `redoStep(history, current: SavedState)` returning `{ history, state }`
  - `sameState(a: SavedState, b: SavedState): boolean` — `sameTracks` and `sameMixerValues` (equal entries by value, not by Map identity)
  - `ArrangementChange` gains `previousMixer: Mixer` on `'restore'`, and `{ type: 'restoreMix'; previousMixer: Mixer }`
  - `AdapterSync.sendMixerDiff(previousMixer: Mixer): void` — the mixer setters for each current track whose values differ

- [ ] **Step 1: Write the failing tests** in `arrangementMixerHistory.test.ts`:
  (The setters become undo steps only in Task 2; until then a mixer change is made a step by wrapping it in `beginTransaction()` / `commitTransaction()`.)
  - "an undo of a removal brings the track back with the mix it had": `setTrackVolume(A, 0.6)`, `removeTrack(A)`, `undo()` → A is back, `getMixer().get(A).volume` 0.6.
  - "re-adding the id of a removed track seeds its mix from the new track's fields" (Rule #843; today it finds the kept entry).
  - "an undo that changes only the mix does not increment tracksVersion": arrange via a saved state whose tracks are the same array (two `abortTransaction`-free steps: `beginTransaction()`, mixer change, `commitTransaction()` → one step); `undo()` → `tracksVersion` unchanged, `mixerVersion` +1, `canRedo` true.
  - "commitTransaction pushes a step when only the mix changed": `beginTransaction()`, `setTrackVolume(id, 0.3)`, `commitTransaction()` → `canUndo` true; `undo()` → volume back.
  - "abort takes back a mixer change made inside the transaction" (Rule #843; today it survives).
  - "undo of a rename brings back the old id with the mix it had" (replaces the two exceptions in the engine notes).
  - In `adapterCalls.test.ts`: "an undo of the mix calls the mixer setters only" — after a committed mixer-only transaction, `undo()` → the fake adapter recorded `setTrackVolume(id, 1)` and no `setTracks` / `updateTrack`.
- [ ] **Step 2: Run** `cd packages/engine && npx vitest run src/__tests__/arrangementMixerHistory.test.ts src/__tests__/adapterCalls.test.ts` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement.** `undo` / `redo` / abort call `_restoreState(state: SavedState)`: when the tracks array differs, `tracksVersion++` and announce `'restore'` with `previous` and `previousMixer`; when only the mix differs, `mixerVersion++` and announce `'restoreMix'`; when the mix differs too, `mixerVersion++` in the same call. `commitTransaction` pushes when `changed && !sameState(base, current)`. `_pushStep` takes the current `{ tracks: this._tracks, mixer: this._mixer }`. Remove `retainMixer` and `_heldStates()`'s mixer use (sources still use `_heldStates()`: keep it returning the tracks of every state). `PlaylistEngine._onArrangementChange`: `'restore'` → `follow(change, at)` then `sendMixerDiff(change.previousMixer)`; `'restoreMix'` → `sendMixerDiff(change.previousMixer)` only. `TracksChange` excludes `'restoreMix'`. `_emit` skips `_syncSources()` for `'restoreMix'` as it does for `'mixer'`.
- [ ] **Step 4: Run** the engine suite: `cd packages/engine && npx vitest run` — Expected: all PASS (fix the old "never changes the mix" expectations with `// Rule (#843): ` comments).
- [ ] **Step 5: Commit** `feat(engine): saved undo states hold the mix (#843)`.

### Task 2: The setters' options and gesture grouping

**Files:**
- Modify: `packages/engine/src/arrangement/Arrangement.ts` (`setTrack*`, `_setMixerValues`, gesture bookkeeping), `history.ts` (`writeThrough`, `dropRepeats`), `types.ts` (signatures, `MixerChangeOptions`), `index.ts`, `packages/engine/src/index.ts` (export the type)
- Test: `packages/engine/src/__tests__/arrangementMixerUndo.test.ts` (new)

**Interfaces:**
- Consumes: `SavedState`, `pushStep`, `sameState` (Task 1)
- Produces (public):
  ```ts
  export interface MixerChangeOptions {
    /** Changes with the same id, one after another, are one undo step. */
    gesture?: string;
    /** Not an undo step: the value is written into every saved state as well. */
    undoable?: false;
  }
  setTrackVolume(trackId: string, volume: number, options?: MixerChangeOptions): void; // and Pan, Mute, Solo
  ```
- Produces (internal): `writeThrough(history: History, base: TransactionBase | null, trackId: string, patch: Partial<TrackMixerValues>)` and `dropRepeats(history: History, current: SavedState): History` in `history.ts`

- [ ] **Step 1: Write the failing tests:**
  - "a setter call is an undo step": `setTrackVolume(id, 0.5)` → `canUndo`; `undo()` → 1; `redo()` → 0.5.
  - "changes with one gesture id are one step": three calls with `{ gesture: 'g' }` (0.9, 0.7, 0.5) → one `undo()` gives 1, `canUndo` false.
  - "two ids are two steps", "a change without an id between two of one gesture splits it" (three steps).
  - "a gesture that comes back to where it began leaves no step": 1 → 0.7 → 1 with one id → `canUndo` false.
  - "a gesture does not join a step after an undo": `{ gesture: 'g' }` 0.5, `undo()`, `{ gesture: 'g' }` 0.4 → `canUndo` true and one `undo()` gives 1, `canRedo` false (the redo was cleared by a new step).
  - "a gesture after setTracks pushes a new step" (same tracks re-set mid-gesture; no throw; one step).
  - "undoable: false writes through every saved state": volume step 0.5 (step), automation `setTrackVolume(id, 0.2, { undoable: false })` → `canUndo` false (the step became a repeat and was dropped) and volume 0.2; with a clip edit before it, `undo()` keeps 0.2.
  - "undoable: false wins over gesture".
  - "inside an open transaction a gesture change joins the transaction": one step on commit.
  - "a value that does not change makes no step"; "an id not in the current tracks does nothing".
- [ ] **Step 2: Run** `cd packages/engine && npx vitest run src/__tests__/arrangementMixerUndo.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `_gestureTop: string | null` is the gesture of the top undo step; it is set when a gesture change pushes and cleared by every other push, `undo`, `redo`, `clearHistory`, `setTracks`, `beginTransaction` / `commitTransaction` / abort and a purge. A gesture change with `_gestureTop === gesture` pushes nothing; after it, when `sameState(top, current)`, pop the top step and clear `_gestureTop`. `undoable: false`: set the current mix, then `writeThrough` (each saved state's Map whose entry for the track exists, memoized per Map so shared Maps stay shared), then `dropRepeats` (a step that is `sameState` with the state after it goes, as `purgeTrack` does), clear `_gestureTop` if the top step went. Announce `'mixer'` as today; announce `'history'` too when `canUndo` / `canRedo` changed.
- [ ] **Step 4: Run** `cd packages/engine && npx vitest run` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(engine): mixer setters are undo steps, grouped by gesture id (#843)`.

### Task 3: The recording arm

**Files:**
- Modify: `Arrangement.ts` (armed set), `types.ts`, `adapterSync.ts` (`_withMix` applies the arm; `sendMixerValues` sends the effective mute), `PlaylistEngine.ts` (forward `'arm'`)
- Test: `packages/engine/src/__tests__/arrangementArm.test.ts` (new)

**Interfaces:**
- Produces (public, on `Arrangement`): `setTrackArmed(trackId: string, armed: boolean): void`; `readonly armedTrackIds: ReadonlySet<string>` (the same Set until it changes)
- Produces (internal): `ArrangementChange` `{ type: 'arm'; trackId: string }`

- [ ] **Step 1: Write the failing tests:**
  - "an armed track plays muted and its stored mute is untouched": `setTrackArmed(id, true)` → `engine.getState().tracks[0].muted` true, `getMixer().get(id).muted` false, adapter `setTrackMute(id, true)`; disarm → adapter `setTrackMute(id, false)`.
  - "arming is not an undo step and undo does not change it": `canUndo` false after arming; a clip edit, `undo()` → still armed.
  - "a mute set while armed still plays muted": armed, `setTrackMute(id, false)` then `setTrackMute(id, true)` then `false` → adapter never receives `setTrackMute(id, false)` while armed; after disarm the adapter gets the stored value.
  - "an arm change increments mixerVersion, not tracksVersion".
  - "an armed id not in the tracks mutes nothing until it enters" (then `addTrack` → projection muted).
  - "arming the same value twice does nothing" (no announcement).
  - "the engine's setter for a track it does not hold still calls the adapter with the value given" (today's fallback, `PlaylistEngine.ts:509-527`; the arm applies once the track enters).
- [ ] **Step 2: Run** `cd packages/engine && npx vitest run src/__tests__/arrangementArm.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** The set lives outside `SavedState`. `_withMix` (and its memo key) uses `muted: values.muted || armed.has(id)`. `sendMixerValues(trackId, values)` replaces `values.muted` with the effective mute when the track is armed. The engine forwards `'arm'` as `sendMixerValues(trackId, { muted: stored })`, which then applies the arm.
- [ ] **Step 4: Run** `cd packages/engine && npx vitest run` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(engine): the recording arm is an override outside the history (#843)`.

### Task 4: Engine surface, `createMixerGesture`, attach keys, docs

**Files:**
- Create: `packages/engine/src/mixerGesture.ts`
- Modify: `PlaylistEngine.ts` (setters take options; `setTrackArmed`), `arrangement/attach.ts` (`/v2`), `src/index.ts`
- Modify docs: `packages/engine/CLAUDE.md` ("The arrangement owns the tracks", "Undo/Redo", "Mixer setters"), `website/docs/` engine guide undo section, `website/docs/llm-reference.md`, `website/static/llms.txt`, `packages/engine/README.md` if it shows the setters
- Create: `.changeset/mixer-undo-engine.md` (engine major)
- Test: `packages/engine/src/__tests__/mixerGesture.test.ts` (new), `PlaylistEngine.test.ts`, `arrangementAttach.test.ts`

**Interfaces:**
- Produces (public):
  ```ts
  export interface MixerGesture {
    /** The id to pass while a gesture is going on. */
    readonly id: string;
    /** The gesture is over: the next change starts a new one. */
    end(): void;
    /** Ends the gesture on the input's own events; returns the detach function. */
    attach(input: HTMLInputElement): () => void;
  }
  export function createMixerGesture(): MixerGesture;
  ```
  `PlaylistEngine.setTrackVolume(trackId, volume, options?: MixerChangeOptions)` (and Pan, Mute, Solo); `PlaylistEngine.setTrackArmed(trackId: string, armed: boolean): void`
- `attach` behaviour (the spec's section 3): a native `change` ends the gesture unless a key is held down; `keyup` of the key that was down ends it; `blur` ends it. Ids are unique per helper across module copies (a counter with a random prefix).

- [ ] **Step 1: Write the failing tests:**
  - `mixerGesture.test.ts`: "end gives a new id"; "change ends the gesture"; "a change during a held key does not end it, keyup does"; "blur ends it"; "detach removes the listeners"; "two helpers never share an id".
  - `PlaylistEngine.test.ts`: "the engine's setters pass their options on" (a gesture of three calls is one `undo`); "setTrackArmed reaches the arrangement".
  - `arrangementAttach.test.ts`: the key strings end in `/v2`.
- [ ] **Step 2: Run** `cd packages/engine && npx vitest run` — Expected: the new tests FAIL.
- [ ] **Step 3: Implement**, then update the docs listed above (setter signatures, the default "an undo step", `undoable: false`, gestures, the arm; the "Not undoable" list loses the four setters; the two exceptions go).
- [ ] **Step 4: Run** each as its own command: `cd packages/engine && npx vitest run`; `pnpm --filter @waveform-playlist/engine build`; `pnpm typecheck`; `pnpm lint` (0 errors). Expected: all pass.
- [ ] **Step 5: Commit** `feat(engine): createMixerGesture and the arm on the engine (#843)`, then open part 1 as a PR and stop for its review.

## Part 2: React

### Task 5: Setters with options, the arm from the arrangement

**Files:**
- Modify: `packages/browser/src/providerInternals/useArrangementEditing.ts` (setters take options; `useRecordingActive` arms through `arrangement.setTrackArmed`, the `armed` value source and `prevMuted` go), `providerInternals/useArrangementView.ts` (`trackStates.muted = stored || armed`), `contexts/playlistContexts.ts` (setter types, `RecordingArmContextValue` from the arrangement), `components/trackContext.ts` (`setVolume(volume, options?)` …, the `isRecordingArmed` comment), `components/TrackControlsColumn.tsx`
- Test: `packages/browser/src/__tests__/recordingArmMute.test.tsx` (rewrite to the override), `mixerStateByTrackId.test.tsx`, new `mixerUndo.test.tsx`

**Interfaces:**
- Consumes: `MixerChangeOptions`, `Arrangement.setTrackArmed`, `armedTrackIds` (part 1)
- Produces: `useEditorControls().setTrackVolume(trackId: string, volume: number, options?: MixerChangeOptions)` (and Pan, Mute, Solo); `useTrack().setVolume(volume: number, options?: MixerChangeOptions)` (and setPan, setMuted, setSoloed)

- [ ] **Step 1: Write the failing tests:**
  - `mixerUndo.test.tsx`: "Undo after a volume change moves trackStates back"; "a gesture through useTrack().setVolume is one step".
  - `recordingArmMute.test.tsx`: "the armed track reports muted and getMixer keeps its own mute"; "a mute changed during the take stays after it" (replaces "the mute from before always comes back"); "the provider's cleanup disarms"; "changing the armed track mid-session disarms the first".
- [ ] **Step 2: Run** `cd packages/browser && npx vitest run src/__tests__/mixerUndo.test.tsx src/__tests__/recordingArmMute.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** `setRecordingActive(true, id)` disarms every other id in `armedTrackIds` and arms `id`; `setRecordingActive(false)` disarms all. `RecordingArmContext`'s `armedTrackId` is read from the arrangement's set with `useSyncExternalStore` (one owner; no value source of the provider's own).
- [ ] **Step 4: Run** `cd packages/browser && npx vitest run` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(browser): mixer setters take undo options; the arm is the arrangement's (#843)`.

### Task 6: The sliders use `createMixerGesture`

**Files:**
- Modify: `packages/browser/src/components/TrackControlPieces.tsx` (`TrackVolumeSlider`, `TrackPanSlider`)
- Test: `packages/browser/src/__tests__/trackControlParts.test.tsx`

**Interfaces:**
- Consumes: `createMixerGesture` (Task 4), `useTrack().setVolume(volume, options)` (Task 5)

- [ ] **Step 1: Write the failing tests:** "a slider drag is one undo step" (three `input` events then `change` → one `undo` restores the start); "two key presses are two steps" (`keydown`/`input`/`change`/`keyup` twice); "volume then pan are two steps"; "the gesture survives a re-render" (rerender between inputs, still one step).
- [ ] **Step 2: Run** `cd packages/browser && npx vitest run src/__tests__/trackControlParts.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement.** One helper per slider, made once per mount (`useState(() => createMixerGesture())`), attached to the input through a ref in an effect whose cleanup detaches; `onChange` passes `{ gesture: gesture.id }`.
- [ ] **Step 4: Run** `cd packages/browser && npx vitest run` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(browser): a slider drag is one undo step (#843)`.

### Task 7: React docs, upgrade guide, e2e

**Files:**
- Modify: `website/docs/react/upgrading.md` (entries: Undo now moves a fader back; an app's own slider gets one step per move until it uses `createMixerGesture` — **Find** `setTrackVolume(` / `setVolume(` in an `onChange`, **Replace with** the helper; `{ undoable: false }` for automation; `getMixer()` no longer shows the arm mute; a mixer change inside a transaction is taken back by an abort; keyboard Undo does not fire while a slider has focus, #730), `website/docs/api/hooks.md`, `website/docs/llm-reference.md`, `website/static/llms.txt`, `packages/browser/CLAUDE.md` (owner table rows "Mix by track id" and "The recording arm"), `packages/browser/notes/playback-and-engine.md` (the arm), `packages/browser/notes/contexts.md`
- Create: `.changeset/mixer-undo-browser.md` (browser major)
- Test: `e2e/track-controls.spec.ts` (new test "a volume drag is undone by the undo button")

- [ ] **Step 1: Write the e2e test:** drag a volume slider on an example page that has an undo button, click Undo, the slider's value is back. Grep `.changeset/` for "prevMuted", "written back", "mute from before" and rewrite any pending changeset that says it.
- [ ] **Step 2: Run** (port check first, as its own command) `PORT=3077 npx playwright test e2e/track-controls.spec.ts` — Expected: PASS after Tasks 5-6.
- [ ] **Step 3: Run** each as its own command: `pnpm --filter website build`; `pnpm lint`; `pnpm typecheck`. Expected: all pass.
- [ ] **Step 4: Commit** `docs(browser): mixer undo and the arm override (#843)`, then open part 2 as a PR and stop for its review.

## Part 3: dawcore

### Task 8: The arrangement's mix drives the controls; the seed

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (controls render at `:3805-3816`; `_loadTrack` at `:2380-2390` and `:2486-2506`; `get tracks()` at `:1058`; `_reconcileDescriptorsWithEngineTracks`), `packages/dawcore/src/types.ts` (the stored descriptor type)
- Test: `packages/dawcore/src/__tests__/daw-editor-mixer-persistence.test.ts`, new `daw-editor-mixer-undo.test.ts`

**Interfaces:**
- Public shapes stay: `TrackDescriptor` and `TrackWithId` keep `volume` / `pan` / `muted` / `soloed`. The editor stores `Omit<TrackDescriptor, 'volume' | 'pan' | 'muted' | 'soloed'>` in `_tracks`, and a `_seedMix: Map<string, TrackMixerValues>` for a track that is not yet in `engine.getState().tracks` (spec section 7, "seed until it enters"). The entry is deleted once the engine holds the track.

- [ ] **Step 1: Write the failing tests:** "the controls follow an engine undo of a volume change"; "editor.tracks reports the arrangement's mix after an undo"; "a control moved while the track is loading is the volume it enters with, and is not a step"; "a synthesized descriptor after an undo has no mixer fields of its own".
- [ ] **Step 2: Run** `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-mixer-undo.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** Controls and `editor.tracks` read the mix from `_engineTracks` for a track the engine holds, else from `_seedMix`. The two track builds in `_loadTrack` take their mixer fields from `_seedMix`.
- [ ] **Step 4: Run** `cd packages/dawcore && npx vitest run` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(dawcore): the controls draw the arrangement's mix (#843)`.

### Task 9: Attribute changes name what changed; `updateTrack` is one step

**Files:**
- Modify: `packages/dawcore/src/elements/daw-track.ts` (`:200-227`, the event detail), `packages/dawcore/src/events.ts` (`'daw-track-update'`), `daw-editor.ts` (`_onTrackUpdate` at `:1423-1463`, `updateTrack` at `:2938-2986`)
- Test: `packages/dawcore/src/__tests__/daw-track.test.ts`, `daw-editor-mixer-undo.test.ts`

**Interfaces:**
- Produces (public): `export interface DawTrackUpdateDetail { trackId: string; changed: readonly string[] }`; `DawEventMap['daw-track-update']: CustomEvent<DawTrackUpdateDetail>`

- [ ] **Step 1: Write the failing tests:** "daw-track-update names the changed properties"; "a name change after an undo does not write the element's volume back" (the review's sequence: volume 0.5, undo to 0.8, set `name` → engine volume still 0.8, `canRedo` still true); "setting volume and pan in one update is one step"; "editor.updateTrack(id, { volume, pan }) is one step, with and without an element".
- [ ] **Step 2: Run** `cd packages/dawcore && npx vitest run src/__tests__/daw-track.test.ts src/__tests__/daw-editor-mixer-undo.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** `_onTrackUpdate` calls a mixer setter only for a name in `changed`, all with one fresh `createMixerGesture().id`; while the track is not yet in the engine it updates `_seedMix` instead. `updateTrack` keeps writing the element for a track that has one; without one it calls the setters with one fresh id (or updates `_seedMix`).
- [ ] **Step 4: Run** `cd packages/dawcore && npx vitest run` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(dawcore): track updates name what changed; one update is one undo step (#843)`.

### Task 10: `<daw-track-controls>` gestures

**Files:**
- Modify: `packages/dawcore/src/elements/daw-track-controls.ts` (`:204-243`, `:330-356`), `events.ts` (`DawTrackControlDetail` gains `gesture?: string`), `daw-editor.ts` (`_onTrackControl` at `:1606-1640`)
- Test: `packages/dawcore/src/__tests__/daw-track-controls.test.ts`, `daw-editor-mixer-undo.test.ts`

- [ ] **Step 1: Write the failing tests:** "a volume drag is one step"; "volume then pan are two steps"; "a mute click is one step"; "the event detail carries the slider's gesture id".
- [ ] **Step 2: Run** `cd packages/dawcore && npx vitest run src/__tests__/daw-track-controls.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement.** One `createMixerGesture()` per slider, attached in `firstUpdated` to each range input and detached in `disconnectedCallback`; `_dispatchControl` adds `gesture` for the two sliders. `_onTrackControl` passes `{ gesture }` to the engine setter, or updates `_seedMix` for a track still loading.
- [ ] **Step 4: Run** `cd packages/dawcore && npx vitest run` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(dawcore): a control drag is one undo step (#843)`.

### Task 11: Recording arms through the engine

**Files:**
- Modify: `packages/dawcore/src/controllers/recording-controller.ts` (`:66`, `:116-123` host `_engine` type gains `setTrackArmed`, `:375-390`, `_restoreArmedTrackMute` at `:799-803` becomes a disarm on the same teardown paths `:605`, `:791`, `:812`)
- Test: `packages/dawcore/src/__tests__/recording-controller.test.ts`

- [ ] **Step 1: Write the failing tests:** "a take arms its track and every teardown path disarms it" (finalize, error, cleanup); "two sessions arm two tracks"; "a mute changed during a take stays after it"; "the controls show the armed track muted"; "an export during a take leaves the armed track out" (`exportAudio` mutes by `_engineTracks`).
- [ ] **Step 2: Run** `cd packages/dawcore && npx vitest run src/__tests__/recording-controller.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement**: `armedPrevMuted` goes; the session records only that it armed (to disarm once).
- [ ] **Step 4: Run** `cd packages/dawcore && npx vitest run` — Expected: all PASS.
- [ ] **Step 5: Commit** `feat(dawcore): the recording arm is the engine's override (#843)`.

### Task 12: dawcore docs, browser run, #848

**Files:**
- Modify: `packages/dawcore/COMPONENTS.md` (`<daw-track-controls>`, `daw-track-update` detail, an attribute change is an undo step, `editor.tracks` reports the mix, `updateTrack` is one step), `packages/dawcore/notes/elements.md` ("Track Controls"), `packages/dawcore/notes/recording.md` (the arm), `packages/dawcore/notes/tracks-and-loading.md` (the limit: a track that finishes loading clears the history, #848), `docs/specs/web-components-migration.md` (attribute tables if they say the mix is not undoable), `packages/dawcore/CLAUDE.md` ("Undo-restored tracks get synthesized descriptors" loses the mixer fields)
- Create: `.changeset/mixer-undo-dawcore.md` (`@dawcore/components` patch)
- Test: `e2e/` a dawcore spec "a volume drag is undone", on `examples/dawcore-native` if it has an undo control (otherwise through `editor.engine.undo()` in the page)

- [ ] **Step 1: Write and run the e2e test** (port check first; Vite on an explicit `--port --strictPort`). Expected: PASS.
- [ ] **Step 2: Rewrite #848's description** (not a comment): one line that dawcore's load path ends in `setTracks`, which clears every undo step including mixer steps since #843, and that moving it to the arrangement's loading also removes the seed of `_seedMix`.
- [ ] **Step 3: Run** each as its own command: `pnpm lint`; `pnpm typecheck`; `pnpm --filter website build`; the full e2e suite once with a clean tree. Expected: all pass.
- [ ] **Step 4: `git rm` the spec and this plan; run `revise-claude-md`; commit** `docs(dawcore): mixer undo (#843)`, then open part 3 as a PR (`closes #843`) and stop for its review.
