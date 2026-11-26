# #848 PR 2: The Arrangement From the Start, Loading Through It — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `<daw-editor>` owns an `Arrangement` from construction, builds its `PlaylistEngine` on it as soon as it has an adapter, and lets the arrangement load every track's audio. Loading never clears the undo history, and a track whose audio failed stays in the editor.

**Architecture:** The editor imports `@waveform-playlist/engine` normally. The constructor calls `createArrangement()`. Setting the adapter on a connected editor (or connecting with one) builds the engine synchronously on that arrangement (`attachDecodeContext` left on, so the arrangement decodes with `adapter.audioContext`). A `<daw-track>` registers its descriptor at connect and is queued. One `setTimeout(0)` flush, held back until the editor has an engine, enters the queued tracks into the arrangement in DOM position (`arrangement.addTrack(track, { index })`). Each audio `<daw-clip>` becomes a `LoadingClip`, and MIDI clips enter loaded. The statechange handler stays the one writer of `_engineTracks` (the engine's projection: loaded clips, current mix). It also adopts each newly loaded clip into the peak caches. A small announcer reads the arrangement's tracks and `sources` and dispatches the existing load events once per transition. Rows are drawn in the arrangement's order. A loading clip is a placeholder, and a `.dat` preview is drawn beside it from an editor-only cache keyed by clip id. Clip edits, recording and file drops call the arrangement, always with the function form of `updateTrack`, so loading clips survive the edit.

**Tech Stack:** TypeScript, Lit, `@waveform-playlist/engine` (arrangement, sources, attach keys), vitest with happy-dom, Playwright.

**Spec:** `docs/specs/2026-11-25-dawcore-arrangement-design.md`, sections "Owner table", "Approaches", "PR 2" and, for what PR 2 must not pre-empt, "PR 3". PR 3 gets its own plan, written against the code as built.

## Calls this plan makes (for the maintainer's review before Task 1)

The design left these to the plan, or they came up while reading the code. Each is a call, open to correction:

- **P1. Which tracks are not undo steps at page load.** A `<daw-track>` that the page put in (not one made by `editor.addTrack()`, not a file drop) and that enters while the editor's own arrangement has no history (`!canUndo && !canRedo`, no drag in progress) is followed by `clearHistory()`. Batching: `_onTrackConnected` queues the track and schedules one `setTimeout(0)` flush. The children's deferred connect events were scheduled first, so the page's tracks enter in one flush. `editor.addTrack()` tracks are undo steps (today's programmatic page adds tracks on button presses). An app can still call `editor.engine.clearHistory()`.
- **P2. The `.dat` preview stays beside the clip**, in an editor render cache (`_previewPeaks`, keyed by clip id), not on the `LoadingClip`. Putting it on the clip would write the arrangement after the clip entered. When the clip loads, the editor gives the same `WaveformData` to the peak pipeline (`cacheWaveformData`), so no worker run is needed.
- **P3. The look of a placeholder.** A loading clip is drawn at `var(--daw-placeholder-clip-opacity, 0.5)` (0.5 is React's default for `placeholderClipOpacity`). A failed clip has a dashed outline in `var(--daw-clip-failed-color, #e06c75)`. Either is drawn only when its length is known (a `duration`, or `.dat` peaks), as React does. A failed track whose length is unknown shows its controls and an empty row, and the events say why.
- **P4. The retry method is `editor.retryTrack(trackId)`.** It retries every failed source that a loading clip of that track names. It is a track because `daw-track-error` names a track. The arrangement's own `retry(src)` is reachable later through `editor.arrangement` (PR 3).
- **P5. After a disconnect, `editor.adapter` is `null`.** This replaces the `_adapterConsumedByDispose` guard. The engine disposes the adapter as today, and the editor lets go of it. The arrangement, the descriptors and the drawn tracks stay (a moved `<input>` keeps its value). A fresh adapter builds a new engine on the kept arrangement, and nothing is added again.
- **P6. File drops become element-less tracks.** A `File` cannot be a `src` attribute. Each file enters as a track with one `LoadingClip` whose `src` is the `File`, and the blob URLs go. `loadFiles()` still resolves `{ loaded, failed }` once each file has loaded or failed. A file that fails is removed with `{ undoable: false }`. Today (#612) each drop is a `<daw-track>` in the light DOM. In PR 3 `editor.addTrack()` makes no element either.
- **P7. No fades on the `LoadingClip`.** The design says "fades", but today's load path drops `<daw-clip>` fades (engine-side fades are #489). Carrying them would make fades play for the first time, which is a behaviour change outside this PR.
- **P8. `daw-clip-ready` fires for every clip whose audio loads.** Today it fires only for a late append. `addClip()` resolves on it.
- **P9. `editor.duration` counts placeholders whose length is known.** The peaks-first preview did the same, and so the timeline is as wide as the `.dat` preview. `_recomputeDuration()` becomes the one writer of `_duration`, and the statechange handler stops copying `engineState.duration`.
- **P10. Load events per track.** `daw-track-ready` fires when no clip of the track is pending and at least one loaded, or the track asked for no audio. It fires again after a retry loads. `daw-track-error` fires when every audio clip of the track failed (also when they were refused for their kind), once per failure. `daw-clip-error` fires once for each clip that goes into failed.
- **P11. A `<daw-clip>` attribute change on a clip that is still loading is warned and dropped**, as today (`_applyClipUpdate` finds no loaded clip). PR 3 makes clip properties live.
- **P12. `editor.ready()` still rejects without an adapter.** `play()` still throws the no-adapter error.
- **P13. Engine changeset: `minor`** for `addTrack(track, { index })` and the `/v3` attach keys. The engine's pending major is already there, and `/v2` was never on `latest`.

## Global Constraints

- Worktree `/Users/naomiaro/Code/waveform-playlist-848-pr2`, branch `feat/848-pr2-arrangement-loading`. Run every command from the worktree root, or in a subshell `(cd packages/<pkg> && …)`.
- Each `@state()` Map is replaced, never mutated. Arrangement objects are never written to (they are frozen in development).
- **Every `arrangement.updateTrack` from the editor uses the function form** (`updateTrack(id, (current) => …)`), built from the arrangement's current track, never from `_engineTracks`. `_engineTracks` has no loading clips, so a track object built from it would drop them.
- dawcore changesets are `patch` (zerover). The engine's is `minor` (P13).
- `daw-editor.ts` is far over the 800-line rule already. New logic goes into new modules under `src/interactions/` (`track-entry.ts`, `load-announcer.ts`) with a narrow host interface, as `file-loader.ts` does.
- Every check (vitest, typecheck, lint, build, e2e) is its own Bash call. Read its result before committing.
- Before `pnpm build`, `pnpm test` or `git checkout`, run `lsof -nP -iTCP:3000 -sTCP:LISTEN` as a command of its own. With a server of your own on 3077, every Playwright command gets `PORT=3077`.
- dawcore's vitest reads core's and engine's `dist`: run `pnpm --filter @waveform-playlist/engine build` after Task 1, before any dawcore test uses `{ index }`.
- Format only the files you changed. Scratch files go in the session scratchpad.
- Load the project skills `unit-testing` before writing a vitest test, `mutation-testing` for the regression tests of Tasks 4-7, `e2e-playwright` before Task 10, `browser-probes` before the example smoke, and `state-ownership` for the review brief.

## Review Focus

1. **Undo never loses a loading clip.** A clip edit, a recorded take or a `src` change on a track that still has loading clips keeps them (Tasks 5 and 7).
2. **No `setTracks` anywhere in dawcore's `src`** (`git grep -n "setTracks" -- packages/dawcore/src` lists only tests, the adapter interface and comments). Loading leaves `canUndo` as it was (Task 4).
3. **Events settle every promise.** `addTrack()` resolves on entry or rejects (refused, or removed before entry). `addClip()` resolves on `daw-clip-ready` or rejects on `daw-clip-error`. `loadFiles()` finishes when every file has loaded or failed, also when the editor disconnects meanwhile (Tasks 4 and 6).
4. **Reparenting:** move the editor, set a fresh adapter, and the tracks are there once, with their mix and their history. Nothing is fetched again (Task 8).
5. **Order:** a `<daw-track>` inserted between two others later in the session lands at its DOM position, and the page's tracks enter in DOM order whatever order their sources load in (Task 4).

---

### Task 1: engine — `addTrack(track, { index })` and the `/v3` attach keys

**Files:**
- Modify: `packages/engine/src/arrangement/Arrangement.ts` (`addTrack`, `:405`), `packages/engine/src/arrangement/types.ts` (`Arrangement.addTrack`, a new `AddTrackOptions`), `packages/engine/src/arrangement/index.ts` and `packages/engine/src/index.ts` (export the type)
- Modify: `packages/engine/src/PlaylistEngine.ts` (`addTrack`, `:213`)
- Modify: `packages/engine/src/arrangement/attach.ts` (both keys to `/v3`, a "v3 (#848)" line in the header)
- Test: `packages/engine/src/__tests__/arrangement*.test.ts` (the file that covers `addTrack`; find it with `grep -ln "addTrack" packages/engine/src/__tests__`), `arrangementAttach.test.ts` (`:427-430`)
- Create: `.changeset/arrangement-add-track-index.md`

**Interfaces:**
- Produces: `interface AddTrackOptions { index?: number }`. `Arrangement.addTrack(track, options?: AddTrackOptions)`: with no `index` it appends, as today. Otherwise the track enters at `Math.trunc(index)`, clamped to `0..length`. An index that is not a finite number throws a `TypeError` before anything changes (no step, no event). It is one undo step and announces `{ type: 'add', trackId }`. `PlaylistEngine.addTrack(track: ClipTrack, options?: AddTrackOptions)` passes the options on.
- Keys: `'@waveform-playlist/engine/arrangement/attach-decode/v3'` and `'…/time-base/v3'`.

- [ ] **Step 1: Write the failing tests.** `it('addTrack with an index puts the track there, one undo step')`: three tracks, add `d` at index 1, and the order is a, d, b, c; one `undo()` gives a, b, c. `it('an index past the end appends, a negative one inserts first')`. `it('an index that is not a finite number throws and changes nothing')`: `NaN` and `Infinity` both throw a `TypeError`, and `tracksVersion` and `canUndo` are unchanged. Engine: `it('engine.addTrack passes the index on')`. Change the two key strings in `arrangementAttach.test.ts` to `/v3`, and add `it('refuses an arrangement of the v2 keys')` (an object with a function under the v2 time-base key: `isArrangement` is false).
- [ ] **Step 2: Run, see them fail:** `(cd packages/engine && npx vitest run <the two files>)`.
- [ ] **Step 3: Implement.** The adapter call for `'add'` is unchanged: order is not audible, and adapter nodes are keyed by id.
- [ ] **Step 4: Run the engine suite, then build the engine** (each its own command, after the port-3000 check): `(cd packages/engine && npx vitest run)`, then `pnpm --filter @waveform-playlist/engine build`.
- [ ] **Step 5: Docs:** `website/docs/framework-agnostic/engine.md` (the arrangement's `addTrack` entry; the key paragraph at `:630`), `website/docs/llm-reference.md` (`:1762` signature, `:1836` key), and `packages/engine/CLAUDE.md`, "Attaching goes through shared keys": "/v3 since #848 (`addTrack`'s index); the next change goes to `/v4`".
- [ ] **Step 6: Changeset** `'@waveform-playlist/engine': minor`. The text says the arrangement's and the engine's `addTrack` take `{ index }`, and that the attach keys are `/v3`, so an engine and an arrangement of copies on either side refuse each other.
- [ ] **Step 7: Commit** (`feat: arrangement.addTrack takes an index; attach keys v3 (#848)`).

### Task 2: dawcore — one shared test harness

**Files:**
- Create: `packages/dawcore/src/__tests__/helpers/editor-harness.ts`
- Test: `packages/dawcore/src/__tests__/helpers/editor-harness.test.ts`

**Interfaces:**
- Produces:
  - `makeAudioBuffer(seconds = 2, sampleRate = 48000, channels = 1): AudioBuffer`, the mock shape the existing files copy.
  - `makeFakeAdapter(options?: { sampleRate?: number }): FakeAdapter`, a complete `PlayoutAdapter` (template: `daw-editor-autostop.test.ts:16-45`). It has `ppqn: 960` and vi.fn track and mixer calls. Its `audioContext.decodeAudioData` resolves a buffer that `setDecoded(bytesTag, buffer)` chose. `holdDecode(tag)` returns `{ resolve, reject }` so a test can control the order.
  - `stubFetch(map: Record<string, 'ok' | number | Error>)`: `vi.stubGlobal('fetch', …)`. `'ok'` answers an `ArrayBuffer` tagged with the URL (the fake decoder reads the tag), a number is an HTTP status, and an Error rejects. `restoreFetch()`.
  - `mountEditor(options?: { adapter?: FakeAdapter | null; html?: string }): Promise<DawEditorElement>`: appends a `<daw-editor>` with the children `html`, sets the adapter (default `makeFakeAdapter()`), and awaits two `setTimeout(0)` ticks so the deferred connects and the entry flush have run.
  - `settle(editor)`: awaits until `arrangement.sources.getSnapshot().isLoading` is false and one more tick has passed.
- Not exported from any package entry (it lives under `__tests__`).

- [ ] **Step 1: Write `editor-harness.test.ts`** for the fake itself: a held decode resolves in the order the test chooses, and `stubFetch` answers each kind.
- [ ] **Step 2: Run it** (it fails until the helper exists), **then write the helper**, then run it again: `(cd packages/dawcore && npx vitest run src/__tests__/helpers)`.
- [ ] **Step 3: Commit** (`test: a shared dawcore editor harness with a fake adapter and stubbed fetch (#848)`).

### Task 3: the arrangement from construction; the engine built when the adapter arrives

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`: imports (a value import of `createArrangement`, `PlaylistEngine`), the constructor, `adapter` setter (`:493`), `connectedCallback` / `disconnectedCallback` (`:1177`, `:1244`), `sampleRate` / `effectiveSampleRate` / `resolveAudioContextSampleRate` (`:461`, `:997`), `_ensureEngine` / `_buildEngine` / `_disposeEngine` (`:2675-2821`), `ready()`
- Modify: `packages/dawcore/src/controllers/recording-controller.ts` (`:104`, `:232`: the `resolveAudioContextSampleRate` call and host member go)
- Modify: `packages/dawcore/CLAUDE.md`, "Key Patterns": remove "is imported as types only…", replace "Engine built lazily on first track load" and "Engine API note"
- Test: `packages/dawcore/src/__tests__/daw-editor.test.ts` (`:149-164`, `:189-199`, per the inventory), a new `daw-editor-engine-lifecycle.test.ts`

**Interfaces:**
- Produces:
  - `_arrangement: Arrangement` (non-private, for the interaction helpers), made in the constructor with `createArrangement()`.
  - `_ensureEngine(): Promise<PlaylistEngine>`: the engine when there is one. Otherwise it builds the engine synchronously when the editor is connected with an adapter, and rejects with `noAdapterError()` without one. `_enginePromise` goes.
  - `_buildEngine(): PlaylistEngine` (synchronous): tempo and ppqn as today, then `new PlaylistEngine({ adapter, arrangement: this._arrangement, sampleRate: adapter.audioContext.sampleRate, samplesPerPixel, bpm, zoomLevels })`, the three listeners as today. Then `_onEngineState(engine.getState())` once, so a kept arrangement is adopted, and `_flushTrackEntries()` (Task 4; a no-op stub in this task).
  - The adapter setter builds the engine when connected and there is none yet. `connectedCallback` builds it when there is an adapter.
  - `disconnectedCallback` disposes the engine (and so the adapter) and sets `_externalAdapter = null` (P5). `_adapterConsumedByDispose` goes.
  - `effectiveSampleRate` (and `sampleRate`) is `adapter.audioContext.sampleRate` with an adapter. Without one it is the `sampleRate` of the first loaded clip in `arrangement.getTracks()`, else 48000. `_resolvedSampleRate` goes.
  - The statechange body moves into `_onEngineState(state)` (same content in this task).

- [ ] **Step 1: Write the failing tests** (`daw-editor-engine-lifecycle.test.ts`, with the harness):
  - `it('the editor has an arrangement before it has an adapter')`: `document.createElement('daw-editor')._arrangement.getTracks()` is `[]`.
  - `it('setting the adapter on a connected editor builds the engine at once')`: `editor.engine` is non-null synchronously after the assignment, and `engine.getState().sampleRate` is the adapter context's.
  - `it('an adapter set before connect builds the engine at connect')`.
  - `it('after a disconnect editor.adapter is null and a fresh adapter builds a new engine on the same arrangement')`: add a MIDI track through the arrangement, disconnect, check `adapter === null` and that the first adapter's `dispose` was called once. Reconnect and set a fresh adapter: the new engine's `getState().tracks` has the track, and `canUndo` is as it was.
  - `it('sampleRate is the adapter context rate')` (replaces `daw-editor.test.ts:149-157`, which tested `_resolvedSampleRate`).
  - Update `daw-editor.test.ts:159-164` (`_ensureEngine` rejects without an adapter, now as a promise) and `:189-199` (the warning when the adapter is set after the engine: the engine is now built at the first assignment, so set a second adapter).
- [ ] **Step 2: Run, see them fail:** `(cd packages/dawcore && npx vitest run src/__tests__/daw-editor-engine-lifecycle.test.ts src/__tests__/daw-editor.test.ts)`.
- [ ] **Step 3: Implement** as under Interfaces. `_loadTrack` still calls `_ensureEngine()` and `engine.setTracks` in this task. Tasks 4-6 replace them, and between tasks the suite may be red only in the files the inventory marks MIGRATE.
- [ ] **Step 4: Fix the four test files that set a bare `{ audioContext }` adapter** (drag-guard, split-suppression, `daw-editor.test.ts`, programmatic): they get `makeFakeAdapter()`. A test that still needs a hand-written engine assigns it after `mountEditor` and disposes the real one first (`editor._engine.dispose()`).
- [ ] **Step 5: Run the dawcore suite** to a log, and read the summary: `(cd packages/dawcore && npx vitest run > <scratchpad>/dawcore-t3.log 2>&1)`. Expected: green apart from the MIGRATE files, and each failure there is listed in the task's notes for Tasks 4-7.
- [ ] **Step 6: Commit** (`refactor: daw-editor owns an arrangement from construction; engine built when the adapter arrives (#848)`).

### Task 4: tracks enter the arrangement; the arrangement loads them; load events from `sources`

**Files:**
- Create: `packages/dawcore/src/interactions/track-entry.ts`: `buildArrangementTrack(host, trackId, descriptor): { track: ArrangementTrack; refused: Array<{ clipId: string; error: Error }> }` (`LoadingClip` per audio clip, `_buildMidiClip` per MIDI clip, the kind check moved from `_loadTrack`, a generated clip id written back to a `drop` descriptor that has none), and `entryIndex(host, trackEl): number` (after the arrangement track of the nearest previous `<daw-track>` sibling that has entered, else 0).
- Create: `packages/dawcore/src/interactions/load-announcer.ts`: `LoadAnnouncer` with `update(tracks, sources)`. It keeps, per track, the last state it announced (`'pending' | 'ready' | 'failed'`) and, per clip, the failure `Error` object it announced, and dispatches `daw-clip-error`, `daw-clip-ready`, `daw-track-ready` and `daw-track-error` per P8 and P10. `forget(trackId)` is called on removal.
- Modify: `daw-editor.ts`: `_onTrackConnected` (`:1416`: register, queue, schedule the flush), `_flushTrackEntries()` (new: waits for an engine, enters the queue in DOM order with `entryIndex`, applies the P1 rule, warns once per editor "tracks are waiting for editor.adapter"), `_onEngineState` (adopt newly loaded clips: `_clipBuffers`, `_clipOffsets`, a `.dat` `WaveformData` handed to `cacheWaveformData`, spectrogram registration; then `syncPeaksForChangedClips`; then the announcer), a `sources.subscribe` in the constructor that runs the announcer, `_mixOf` (reads `arrangement.getMixer()`, else `mixOfElement` of a waiting track's element, else the default), `_writeMix` (the arrangement's setters), `_onTrackUpdate` (a `src` change replaces the clips of an entered track through `updateTrack`'s function form, one undo step), `_reconcileDescriptorsWithEngineTracks` (no `_loadingTracks` check: every entered track is in the engine's state), `_onTrackRemoved` (`_previewPeaks` and the announcer forget the track; a track still queued leaves the queue)
- Delete from `daw-editor.ts`: `_seedMix`, `_setSeedMix`, `_deleteSeedMix`, `_tracksForEngine`, `_loadTrack`, `TrackLoadCancelledError`, `_fetchAndDecode`, `_audioCache`, `_finalizeAudioClip`, `_loadingTracks`, the peaks-first preview track
- Modify: `packages/dawcore/src/utils/track-mix.ts` if `withMix` loses its last user
- Test: `daw-editor-loading.test.ts` (new), `daw-editor-mixer-undo.test.ts`, `daw-editor-mixer-persistence.test.ts`, `daw-editor-reorder.test.ts`, `daw-editor-track-kind.test.ts`, `daw-editor-midi.test.ts`; delete `daw-editor-peaks-first-cancel.test.ts` (DELETE-WITH-CODE) and the seed tests of mixer-undo (`:147-186`, `:188-211`, `:398-425`)

**Interfaces:**
- Consumes: Task 1 (`{ index }`), Task 2 (harness), Task 3 (`_arrangement`, `_onEngineState`, `_flushTrackEntries` stub).
- Produces: `_entryQueue: string[]` (track ids, in connect order) and `_flushScheduled: boolean`. `_previewPeaks: Map<string, PeakData>` (`@state`) and `_previewWaveforms: Map<string, WaveformData>`, the editor-only `.dat` caches of P2, filled by `_requestPreview(trackId, clip, peaksSrc)` after entry and read by Task 5's render. `_editorMadeTracks: WeakSet<DawTrackElement>` (declared here, filled by `addTrack` in Task 6): a `<daw-track>` not in it is a page track for the P1 rule.

- [ ] **Step 1: Write the failing tests** in `daw-editor-loading.test.ts`. Use the harness and stub fetch and decode, no `_fetchAndDecode`:
  - `it('a declared track enters the arrangement at once with a loading clip, before its audio')`: hold the decode. `_arrangement.getTracks()[0].clips[0]` is a loading clip with the `<daw-clip>`'s id, src, start and duration. After resolving the decode and `settle`, it is an `AudioClip` with the same id.
  - `it('loading does not clear the undo history')`: mount with one loaded MIDI track, make a mixer step, append a second `<daw-track>` with a held decode, resolve it. `canUndo` is still true, and `undo()` takes back the second track's arrival first, then the mixer step.
  - `it('the page tracks are not undo steps')`: three `<daw-track>` in the markup. After `settle`, `canUndo` is false (P1). The same markup appended after one mixer step gives three undo steps.
  - `it('page tracks keep DOM order whatever order their audio loads in')` (moved from `daw-editor-reorder.test.ts:105-198`, with held decodes).
  - `it('a <daw-track> inserted between two others lands at its DOM position')`.
  - `it('a failed track stays, with daw-clip-error and daw-track-error, and loads after a retry')`: fetch answers 404. One `daw-clip-error` and one `daw-track-error` fire, and the track is in `_arrangement.getTracks()` and `editor.tracks`. Change the stub to `'ok'` and call `editor._arrangement.retry(src)` (the editor method comes in Task 6). Then `daw-track-ready` fires once and the clip is loaded.
  - `it('a track of two clips, one failed, is ready')`: `daw-clip-error` once and `daw-track-ready` once (P10).
  - `it('tracks wait for the adapter, with one warning')`: connect two tracks with no adapter. Both are in `editor.tracks` and the arrangement is empty, and `console.warn` was called once with "waiting for editor.adapter". Set the adapter: both enter, in DOM order.
  - `it('a control moved before a track loads is an undo step on the arrangement')` (replaces the seed tests): with a held decode, `daw-track-control` volume 0.5 → `getMixer()` holds 0.5 and `canUndo` is true.
  - `it('removing a track while it loads removes it; the late audio changes nothing')` (replaces the cancellation tests): remove the element while the decode is held, then resolve it. The track is gone, and no `daw-track-ready` or `daw-track-error` fires for it.
  - `it('a .dat preview is drawn for a loading clip and kept when the audio arrives')`: `_previewPeaks` has the clip id while the decode is held. After it resolves, `cacheWaveformData` was called with the decoded buffer and that `WaveformData`, and `_previewPeaks` no longer has the id once `_peaksData` has it.
  - `it('a wrong-kind clip is refused and reported; a track with none left enters empty and reports daw-track-error')` (from `daw-editor-track-kind.test.ts`).
- [ ] **Step 2: Run, see them fail:** `(cd packages/dawcore && npx vitest run src/__tests__/daw-editor-loading.test.ts)`.
- [ ] **Step 3: Implement** as under Files and Interfaces. Comments name why: the queue batches the page's tracks (P1), the function form keeps loading clips, and the announcer remembers what it announced so that a statechange and a sources change for the same transition do not both dispatch.
- [ ] **Step 4: Migrate** mixer-undo, mixer-persistence, reorder, track-kind and midi per the inventory. Assertions on `adapter.setTracks` lastCall become assertions on `editor.engine.getState().tracks`. `_engineTracks` filled by hand becomes tracks entered through the harness. `daw-track-ready` waits stay (the event still fires). Remove `_fetchAndDecode` counts: count `decodeAudioData` calls instead (the "no re-decode on move" test, `reorder:214-254`).
- [ ] **Step 5: Mutation check** (skill `mutation-testing`): with `clearHistory()` removed from the P1 branch, "page tracks are not undo steps" fails. With `entryIndex` returning the end, the insert test fails. With the announcer's memory removed, the "once" counts fail.
- [ ] **Step 6: Run the dawcore suite** to a log and read the summary. Expected: green apart from programmatic, load-midi and recording-mute (Tasks 6 and 7).
- [ ] **Step 7: Commit** (`feat: daw-editor tracks enter the arrangement and load through it (#848)`).

### Task 5: draw the arrangement — rows in its order, placeholders, failed clips

**Files:**
- Modify: `daw-editor.ts`: `_getOrderedTracks` (`:3835`: the arrangement's order, each `[id, ArrangementTrack]`), `render()` (`:3870-4100`: the loading branch of the clip loop, P3; the channel count of a loading track from its preview peaks), `_recomputeDuration` (`:2664`: loaded clips plus placeholders of known length, P9; the only writer of `_duration`; the statechange handler stops writing `engineState.duration`)
- Modify: `packages/dawcore/src/styles/theme.ts` (`clipStyles`: `.clip-container.placeholder`, `.clip-container.failed`)
- Modify: `packages/dawcore/README.md` / `COMPONENTS.md` CSS custom-property tables: `--daw-placeholder-clip-opacity`, `--daw-clip-failed-color`
- Test: `daw-editor-loading.test.ts` (render cases), `daw-editor-layout.test.ts` if a row-count expectation changes

**Interfaces:**
- Consumes: Task 4's `_previewPeaks` and the arrangement's `sources`.
- Produces: a loading clip is drawn as `<div class="clip-container placeholder" data-clip-id>` (and `failed` when its source failed), left and width from `start`, `duration` or the preview's `WaveformData` duration minus `offset`, at `effectiveSampleRate`. It gets a `<daw-waveform>` when preview peaks exist, and an empty box otherwise. No box when the length is unknown.

- [ ] **Step 1: Write the failing tests:** a loading clip with `duration="2"` renders a `.placeholder` box 2 s wide at the current zoom. A failed one renders `.failed`. One with no duration and no `.dat` renders no box, but its row and its controls are there. `editor.duration` is 2 while the clip loads (P9). Rows follow `arrangement.reorderTrack` without a DOM move.
- [ ] **Step 2: Run, see them fail; implement; run the suite** (each its own command).
- [ ] **Step 3: Render the CSS in a browser before committing** (root `CLAUDE.md`, "Render a CSS or markup example"). In `examples/dawcore-native`, point one clip at a missing file and one at a slow one (devtools throttling or a held route), take a screenshot, and look at both looks on the dark and the light example backgrounds.
- [ ] **Step 4: Commit** (`feat: daw-editor draws loading and failed clips (#848)`).

### Task 6: the editor's methods — `addTrack` resolves with the id, late clips, file drops, MIDI, retry

**Files:**
- Modify: `daw-editor.ts`: `addTrack` (`:2927`: still builds a `<daw-track>`, adds it to `_editorMadeTracks`, resolves with `trackEl.trackId` once the track has entered; rejects when the track is refused or removed before it enters), `addClip` / `_onClipConnected` / `_loadAndAppendClip` (`:1739`, `:1857`: a late `<daw-clip>` on an entered track goes in as a loading clip through `updateTrack`'s function form, one undo step. The "parent still loading" warning goes, because every entered track can take a clip; a clip on a track still waiting joins its descriptor before entry), `_applyClipUpdate` / `_removeClipFromTrack` / `updateClip` (`:2136`, `:2244`, `:3140`: through `updateTrack`'s function form; `_commitTrackChange` and its `setTracks` fallback go), `removeTrack` (`:2966`: an element-less track is removed through the arrangement), `retryTrack(trackId)` (new, P4)
- Modify: `packages/dawcore/src/interactions/file-loader.ts` (P6: `FileLoaderHost` gets `_addDroppedFile(file): Promise<string>`, which builds an element-less track and descriptor and enters it through the queue; `loadFiles` awaits each file's settlement through the announcer, removes a failed one with `removeTrack(id, { undoable: false })`, and the blob URL and `_audioCache` lines go)
- Modify: `packages/dawcore/src/interactions/midi-loader.ts` (`MidiLoaderHost.addTrack` resolves with a `string`; the cleanup finds the elements by id)
- Modify: `packages/dawcore/src/types.ts` if `TrackConfig` docs mention resolution
- Test: `daw-editor-programmatic.test.ts`, `daw-editor-load-midi.test.ts`, `daw-editor-recording-mute.test.ts` (MIGRATE per the inventory; the DELETE-WITH-CODE parts `:1012-1040` and the peaks-first parts `:567-628` are replaced by Task 4's tests), a new `file-loader` case in `daw-editor-loading.test.ts`

**Interfaces:**
- Produces: `addTrack(config?: TrackConfig): Promise<string>`. `retryTrack(trackId: string): void` warns once for an unknown id and does nothing for a track with no failed source. `loadFiles` is unchanged in shape (`{ loaded: string[]; failed: Array<{ file, error }> }`).

- [ ] **Step 1: Write the failing tests:**
  - `it('addTrack resolves with the track id once the track has entered, before its audio')` (held decode).
  - `it('addTrack before the adapter resolves once the adapter is set')`.
  - `it('addClip adds a loading clip as one undo step and resolves on daw-clip-ready')`.
  - `it('an edit of a loaded clip keeps the track's loading clips')`: two clips, one held. `updateClip` on the loaded one leaves the loading one in `getTracks()`.
  - `it('a dropped file enters as an element-less track; a failed one is removed and cannot be brought back by undo')`: `loadFiles([ok, bad])` resolves `loaded` with one id and `failed` with one file. No `<daw-track>` is in the light DOM. `undo()` removes the good track and never brings back the bad one.
  - `it('retryTrack loads a failed track')`.
  - `it('loadMidi removes every track it added when one fails')` (the load-midi cleanup, now by id).
- [ ] **Step 2: Run, see them fail; implement; migrate the three files; run the suite** (each its own command).
- [ ] **Step 3: Mutation check:** build an edit from `_engineTracks` instead of the function form, and the "keeps loading clips" test fails.
- [ ] **Step 4: Commit** (`feat: daw-editor's methods change the arrangement; addTrack resolves with an id (#848)`).

### Task 7: recording through the arrangement

**Files:**
- Modify: `packages/dawcore/src/interactions/recording-clip.ts` (`RecordingClipHost`: `_arrangement` instead of `_engine.setTracks` / `_engineTracks` writes; the take goes in with `arrangement.updateTrack(trackId, (current) => …)`: `carveClipRange` over the current track's LOADED clips, loading clips kept as they are, the take appended; the descriptor update stays)
- Test: `packages/dawcore/src/__tests__/recording-clip.test.ts` (its host stub), `recording-controller.test.ts` where it reads the host

- [ ] **Step 1: Write the failing test:** `it('a take on a track with a loading clip keeps the loading clip')`. Also, the take is one undo step and `setTrackRecording` is unchanged.
- [ ] **Step 2: Run, see it fail; implement; run the dawcore suite** (each its own command).
- [ ] **Step 3: Commit** (`refactor: a recorded take goes into the arrangement (#848)`).

### Task 8: reparenting keeps the arrangement

**Files:**
- Modify: `daw-editor.ts` `disconnectedCallback` (`:1244`). It keeps `_tracks`, `_peaksData`, `_clipBuffers`, `_clipOffsets` and the preview caches (they are caches of the kept arrangement). It still terminates the peak worker (`PeakPipeline` makes a new one on its next use, `peakPipeline.ts:187`), disposes effects and the engine, and drops `_trackElements` (re-filled by the children's reconnect, which `_onTrackConnected`'s `_tracks.has` branch already handles). The tracks queued for entry stay queued.
- Modify: `packages/dawcore/CLAUDE.md`, "Reparenting `<daw-editor>` is a teardown + fresh start" (rewritten: what stays, what goes, P5)
- Test: `daw-editor-programmatic.test.ts:1411` (rebuild on a disposed adapter, now P5), `daw-editor-engine-lifecycle.test.ts`

- [ ] **Step 1: Write the failing test:** `it('moving the editor keeps its tracks, their mix and history; a fresh adapter plays them; nothing is fetched again')`: two loaded tracks and one mixer step. Move the editor to another parent and set a fresh adapter. `getState().tracks` has two tracks, `canUndo` is true, the fetch stub was called twice in total, and the new adapter's `setTracks` was called once (the engine's initial send).
- [ ] **Step 2: Run, see it fail; implement; run the dawcore suite** (each its own command).
- [ ] **Step 3: Commit** (`feat: a reparented daw-editor keeps its arrangement (#848)`).

### Task 9: documentation and changesets

**Files:**
- Modify: `packages/dawcore/CLAUDE.md` (the rules Tasks 3 and 8 named; "Event-driven track loading", "Eager audio decode", "Error events", "Engine promise retry" rewritten or removed)
- Modify: `packages/dawcore/notes/tracks-and-loading.md`. Rewrite "Programmatic Track + Clip API" (`addTrack` resolves with an id; the seed paragraph and "Loading a track clears the undo history" go; "Three load states" become waiting / entered and loading / loaded; the `_loadingTracks` and `_finalizeAudioClip` notes go) and "File Loader Extraction" (the host's fields).
- Modify: `packages/dawcore/COMPONENTS.md`: the events table (`:64-65`: `daw-track-ready` / `daw-track-error` per P10, `daw-clip-ready` per P8), `addTrack()`, `retryTrack()`, the placeholder looks, file drops (P6), `editor.adapter` after a disconnect (P5)
- Modify: `packages/dawcore/README.md`, `website/docs/web-components/getting-started.md`, `website/static/llms.txt`, `website/docs/llm-reference.md` wherever they describe dawcore loading or `addTrack`'s result (grep `addTrack`, `daw-track-ready`, `trackId` near `await editor.addTrack`)
- Modify: `examples/dawcore-native/programmatic.html`, `examples/dawcore-tone/programmatic.html` (`t.trackId` → the returned id; `:206-235`), `examples/dawcore-tone/midi.html` (`:89`, if it reads the result)
- Modify: `docs/specs/web-components-migration.md` where its attribute or event tables describe loading
- Create: `.changeset/dawcore-arrangement-loading.md` (`'@dawcore/components': patch`) with an "Upgrading" part: `addTrack()` resolves with the id, on entry; a failed track stays (was: never entered, `addTrack` rejected); file drops have no `<daw-track>` element; `editor.adapter` is `null` after a disconnect; a track added before the adapter waits instead of failing; loading no longer clears the undo history.

- [ ] **Step 1: Grep `.changeset/` for the removed behaviour's words** (root `CLAUDE.md`, "Publishing Convention"): `_seedMix`, "seed", "clears the undo history", "blob", `TrackLoadCancelledError`, "reason: 'removed'", "rejects" near `addTrack`. Correct each pending changeset that describes it.
- [ ] **Step 2: Write the doc changes.** Each sentence is checked against the source line that makes it true.
- [ ] **Step 3: Website build** (after the port-3000 check): `pnpm --filter website build`. Expected: exit 0.
- [ ] **Step 4: Lint**, its own command: `pnpm lint`. Expected: `0 errors`, and no changed file among the warning paths.
- [ ] **Step 5: Commit** (`docs: dawcore loading through the arrangement (#848)`).

### Task 10: in a browser

**Files:**
- Modify or create: `e2e/dawcore-loading.spec.ts` (the pattern of `e2e/dawcore-mixer-undo.spec.ts`)

- [ ] **Step 1: Write the spec:** on the dawcore-native multiclip page, Cmd+Z right after load changes nothing (P1). After one fader move and an `editor.addTrack({ src })`, Cmd+Z takes back the track, then the fader. A clip pointed at a missing file shows `.failed`, and `editor.retryTrack` after the route is fixed (`page.route`) loads it.
- [ ] **Step 2: Prove it against `dev`** (root `CLAUDE.md`, "Read, not run plus the word now"): stop your 3077 server, `git checkout dev -- packages/dawcore/src packages/engine/src`, run the spec, record what fails, `git restore --source=HEAD --staged --worktree -- packages`.
- [ ] **Step 3: Full build, then the full e2e suite** (each its own command, port check first): `pnpm build`, restart your 3077 server, `PORT=3077 pnpm test > <scratchpad>/e2e.log 2>&1`, and read the summary. Expected: all green. Any red is a signal until rates say otherwise.
- [ ] **Step 4: Smoke the examples by hand in a headless browser** (skill `browser-probes`): dawcore-native index, multiclip, programmatic (every button), file drop (`loadFiles` from the console with a fetched `File`), the MIDI and recording pages of dawcore-tone. Console free of new warnings, and audio plays (`editor.engine.getState().isPlaying`).
- [ ] **Step 5: Commit** (`test: dawcore loading through the arrangement, in a browser (#848)`).

## After the tasks

- The spec and both plans stay until the last PR of #848 merges.
- The PR is "Part 2 of 3 for #848", with no closing keyword next to #848. Check `gh pr view <n> --json closingIssuesReferences` after writing the body.
- Reviews start once the PR is open: two reviewers (code, and doc claims), model opus, delta rounds by SendMessage to the same reviewers. The review brief includes the owner table from the design with the PR 2 rows marked done, and the Review Focus above.
