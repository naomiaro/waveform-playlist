# #848 PR 3: A Handed-In Arrangement, Live Element Properties — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** An app or agent drives `<daw-editor>` through one object, `editor.arrangement` (its own, or one handed in). `<daw-track>` / `<daw-clip>` behave like native form controls: attributes are the starting declaration, properties read the arrangement live. The editor's remaining copies of track state go.

**Architecture:** The editor reads `this.arrangement` (handed-in ?? own) everywhere. It keeps no projection of the tracks: rows, `editor.tracks`, the mix and the element properties are computed from `getTracks()`, `getMixer()` and `recordingTrackIds`. What the arrangement does not hold (render mode, spectrogram config, effects, the `<daw-track src>` shorthand, a clip's `peaks-src`) is in a per-track "extras" map, keyed by id. A track that has not entered yet is a pending entry, the one place its declaration lives until it enters. An element is linked to its track or clip by id: live while the played arrangement holds the id, detached otherwise. The editor never writes attributes and never moves its children. A swap disposes the old engine without its adapter (`engine.dispose({ keepAdapter: true })`) and builds a new one on the new arrangement. Every drag previews in the view and makes one arrangement call on release, so any change to what it drags during the drag came from outside and cancels it.

**Tech Stack:** TypeScript, Lit, `@waveform-playlist/engine`, React 19 + @dnd-kit (browser), vitest with happy-dom, Playwright (Chromium).

**Spec:** `docs/specs/2026-11-25-dawcore-arrangement-design.md`, sections "Owner table", "PR 3", "Documentation surface", "Left to the builder". The handoff note's list of where `dev` differs from the spec (line numbers, `_adapterConsumedByDispose` gone) holds: find code by name.

## Calls this plan makes (for the maintainer's review before Task 1)

The design left these to the plan, or they came up while reading the code at `7fd4f6f4`. Each is a call, open to correction. The ones that change what a consumer sees are marked **(visible)**.

- **P1. The clip drag previews and commits once (the design's "transaction or preview").** Today a clip move calls `engine.moveClip(…, skipAdapter)` on every pointer move inside a transaction (`clip-pointer-handler.ts:220,275`); a trim already commits once. After: a move draws its offset in the view (constrained by the engine's exported `constrainClipDrag` over the arrangement's clips, as React's `ClipCollisionModifier` does) and calls `moveClip` once on release. No drag opens a transaction. That makes "a change during a drag came from outside" true by construction (P2), and lets the entry queue stop waiting for drags (`_flushAfterDrag` goes: an add no longer lands inside a drag's transaction). Nothing audible is lost: the per-move calls skipped the adapter already.
- **P2. Which outside changes cancel a drag (visible).** The design says an outside `undo()`, `reorderTrack`, `removeTrack` cancels it. The rule this plan implements: **a drag is cancelled when what it drags changed.** For a clip drag, the dragged clip is gone or is another object in the arrangement. For a track drag, the track is gone or the order of track ids changed. A mix change, another clip loading, an undo of an edit elsewhere: the drag goes on, and its release applies to the arrangement as it is then. Detected through the public `arrangement.subscribe` by comparing objects: no new engine API. The same rule in React (Task 9), which cancels through dnd-kit's public `manager.actions.stop({ canceled: true })`. It also covers a drag across a split: with the left id kept, a move or trim would otherwise apply pre-split geometry to the left half. The broader reading, "any change cancels", would cancel a drag when an unrelated clip finishes loading (a load replaces that track's objects).
- **P3. The engine option is `engine.dispose({ keepAdapter: true })`.** It stops playback when playing (as `stop()` does, so the adapter is stopped and `stop` is emitted), stops following the arrangement, detaches the time base and the decode context, clears `onPlaybackEnded`, and leaves the adapter undisposed. Engine changeset `minor`.
- **P4. A split keeps the left id: no new attach key.** The keys cover the shape of the arrangement interface; a split's ids are behaviour of whichever copy owns the arrangement, so two copies cannot misread each other over it. Engine changeset `minor` (with P3). `daw-clip-split` keeps its detail; `leftClipId` now equals `originalClipId`.
- **P5. `editor.arrangement` (visible).** A property, no attribute. Get: the handed-in arrangement, else the editor's own. Set: a value `isArrangement()` refuses throws a `TypeError` (as `video.srcObject = 5` does); `null` or the editor's own arrangement means "play my own". The same value changes nothing. Set during a take: refused with a `console.warn` ("set it after `stopRecording()` resolves"): the take's track would be in neither. Set with an engine: drags are cancelled, `stop()` runs (a `daw-stop` when it was playing), the old engine goes with `keepAdapter`, a new one is built on the new arrangement with the same adapter (tempo and ppqn sent again in `_buildEngine`), the effects chains of track ids the new arrangement does not hold are disposed, and the spectrogram clip audio follows. Set before an adapter: stored; the engine is built on it when the adapter arrives. The editor never disposes an arrangement it was handed, and does not clear its history.
- **P6. Load events after a swap (visible).** A swap is a new load cycle: the announcer starts again, so `daw-track-ready` (or `daw-track-error`) fires for each track of the arrangement now played, also those already loaded. Precedent: `<daw-player>` fires `daw-ready` again after a reparent. No `daw-track-removed` for the tracks of the old one: nothing was removed.
- **P7. The children while a handed-in arrangement is set.** They are detached (`:state(detached)`), and attribute changes on them warn and do nothing. A `<daw-track>` the page adds meanwhile is registered and waits to enter the own arrangement (the queue enters only into the own arrangement, and only while it is played). A `<daw-track>` the page removes meanwhile has its track removed from the own arrangement, an undo step there: the element was that track's declaration.
- **P8. Which element properties are live (visible).** Live (getter reads the arrangement, setter asks it, one undo step): `<daw-track>` `volume`, `pan`, `muted`, `soloed`, `name`; `<daw-clip>` `start`, `duration`, `offset`, `gain`, `name`, `midiNotes`, `midiChannel`, `midiProgram`. The mix read is the STORED value (`getMixer()`), not the take's mute: `trackEl.muted` stays `false` during a take, as the mute button's own `aria-pressed` would. Not live, because the arrangement holds none of them: `kind` (fixed at entry, warned as today), `renderMode`, `spectrogramConfig`, the track's `src` shorthand (a change still replaces the clips, one undo step, as today), a clip's `src`, `peaksSrc`, `color` and fades (engine-side fades are #489; the design listed fades, but dawcore drops them at entry since PR 2's P7). A clip's `midiNotes` getter returns the arrangement's array, frozen in development builds.
- **P9. A property's value before its track enters (visible).** A property set on an element that is not live yet (not in an editor, or waiting to enter) is kept by the element and is the value the track enters with; the getter returns it, else the attribute's parsed value. Frameworks set properties before they append. Once the track enters, the element keeps nothing.
- **P10. A property set on a clip still loading changes the loading clip** (one undo step: the function form of `updateTrack` over the `LoadingClip`'s seconds fields). PR 2's P11 dropped it with a warning. Task 4 checks that the replaced `LoadingClip` still receives its audio; if the arrangement does not resolve it, the plan falls back to PR 2's warning and the maintainer is told.
- **P11. `trackEl.index` (visible)** is the track's position in the played arrangement, `-1` when the element is not live. (`option.index` is 0 outside a select; -1 cannot be mistaken for the first row.) No `clipEl.index`.
- **P12. Three element states.** Pending: registered, not entered (no state). Live: the played arrangement holds its id. Detached: neither (left the arrangement, refused, or a handed-in arrangement is set): `:state(detached)` through `ElementInternals.states`, refreshed on each structural change and each swap. The warning on an attribute change of a detached element names the element (`<daw-track name="…">` / `<daw-clip>` with its track) and the reason (`its track is not in the arrangement the editor plays` / `a handed-in arrangement is set`). happy-dom 21 has no `attachInternals` (run 2026-11-26), so the element calls it guarded and unit tests stub it; the real `:state()` is checked in Chromium (Task 11).
- **P13. Moving a `<daw-track>` in the DOM is a reorder request.** Each moved element is placed after the arrangement track of its nearest `<daw-track>` before it (`entryIndex`, already used for inserts). The moves of one MutationObserver batch are one undo step (one transaction: no drag holds one any more, P1). An Undo of a reorder moves no element. `editor.reorderTrack` and the reorder handler call `arrangement.reorderTrack` and move no element. The move buttons' `trackIndex` / `trackCount` come from the arrangement.
- **P14. Editor-only fields of an element-less track are kept until it is removed by the editor or the page.** An Undo of its arrival and a Redo bring it back with its render mode. A track restored by Undo with no extras (removed by `removeTrack`, then Undo) takes the defaults: render mode from its kind, no effects.
- **P15. `editor.tracks` keeps its type** (`TrackWithId[]`): the played arrangement's tracks in order, then (while the own arrangement is played) the pending ones. Name, mix and clips come from the arrangement (a clip's times in seconds, `kind: 'dom'` when a `<daw-clip>` is linked to it, else `'drop'` with its `clipId`); `peaksSrc`, render mode, spectrogram config and `src` from the extras. The `file` field of a drop clip is not listed (it was never meant to be read back).
- **P16. `daw-track-update` and `daw-clip-update` stay as outbound events, and the editor stops listening to them.** The elements' setters call the editor synchronously (`trackEl.volume = 0.5; trackEl.volume === 0.5` on the next line, like `input.value`). The events are in `DawEventMap` and `COMPONENTS.md`, so they keep firing after a property change.
- **P17. What PR 2 left, folded in.** A `<daw-clip>` the page removes while the editor is detached has its clip removed at reconnect, as for a `<daw-track>`. An `addClip()` keeps waiting across a disconnect and settles once the clip loads after a fresh adapter, or rejects when it is removed (no hang: the clip is in the arrangement at once, P18). A failed engine build rejects every `addTrack()` waiting to enter, with the build's error (today they wait for an engine that does not come). `_mixOf` on a detached editor reads the arrangement, so it is current. The `_onClipConnected` comment names both cases its guard covers.
- **P18. `editor.addClip(trackId, config)` works on every track (visible)** and creates no element: the clip enters the played arrangement at once (a loading clip, or a loaded MIDI clip), one undo step, and the promise settles on `daw-clip-ready` / `daw-clip-error` as today. Was: it required a `<daw-track>` and appended a `<daw-clip>`.
- **P19. Changesets:** engine `minor` (P3, P4); `@dawcore/components` `patch` with an "Upgrading" part; `@waveform-playlist/browser` `patch` (a split keeps the left id; an outside change cancels a drag). Browser's pending release is a major already.

## Global Constraints

- Worktree `/Users/naomiaro/Code/waveform-playlist-848-pr3`, branch `feat/848-pr3-handed-in-arrangement`. Run every command from the worktree root, or in a subshell `(cd packages/<pkg> && …)`.
- The editor writes no attribute and moves no child. The one exception: `editor.removeTrack` / `removeClip` remove the element.
- No second stored copy of track, clip or mix state in dawcore (`git grep -n "_engineTracks" -- packages` lists nothing at the end). A cache keyed by clip id (peaks, buffers) is a one-way render cache, never written back.
- Every `arrangement.updateTrack` from the editor uses the function form.
- Each `@state()` Map is replaced, never mutated. Arrangement objects are never written to.
- New logic goes into modules under `src/interactions/` or `src/elements/` with a narrow host interface (`daw-editor.ts` is 4169 lines). Expected new files: `interactions/arrangement-view.ts` (Task 3), `interactions/element-links.ts` (Task 4), `interactions/arrangement-swap.ts` (Task 7), `interactions/drag-watch.ts` (Task 8).
- dawcore changesets `patch`; engine `minor`; browser `patch`.
- Every check (vitest, typecheck, lint, build, e2e) is its own Bash call; read its result before committing. Format only the files you changed (`prettier --check` at the file's own path first). Scratch files go in the session scratchpad.
- Before `pnpm build`, `pnpm test` or `git checkout`, run `lsof -nP -iTCP:3000 -sTCP:LISTEN` as its own command. With a server of your own on 3077, every Playwright command gets `PORT=3077`.
- dawcore's and browser's vitest read engine's `dist`: `pnpm --filter @waveform-playlist/engine build` after Task 1.
- Load the project skills `unit-testing` before a vitest test, `mutation-testing` for the regression tests of Tasks 2, 4, 5, 7, 8 and 9, `dnd-kit` before Task 9, `react-patterns` for Task 9, `e2e-playwright` and `browser-probes` before Task 11, `state-ownership` for the review brief.

## Review Focus

1. **A framework that renders the children.** A page whose `<daw-track>` list is re-rendered (elements replaced, reordered, attributes rewritten) after a user drag and an Undo: no element moves on its own, no track comes back twice, and an attribute rewrite to the value the arrangement holds changes nothing (Task 5, test "a re-render that writes the same attributes is no undo step").
2. **Undo/Redo across element links.** Undo of a `<daw-track>`'s arrival detaches it; Redo makes it live again with its render mode and its clips' elements live (Task 4).
3. **A swap mid-session.** Playing, a selection, a drag in progress and a slider gesture open, then `editor.arrangement = other`: playback stops once, the drag is cancelled, the adapter is not disposed, the new tracks play, and `editor.arrangement = null` returns to the own tracks with their history (Task 7).
4. **Properties read right after a write.** `clipEl.start = 2; clipEl.start` is 2 on the next line; after a pointer drag `clipEl.start` is the dragged position and `getAttribute('start')` is unchanged (Tasks 4 and 11).
5. **An outside change during each drag** (clip move, clip trim, track reorder, in both editors), and an unrelated one (another clip loads) that must not cancel (Tasks 8 and 9).

---

### Task 1: engine — a split keeps the left id; `dispose({ keepAdapter })`

**Files:**
- Modify: `packages/engine/src/operations/clipOperations.ts` (`splitClip`, `:142`: `left` keeps `clip.id`), `packages/engine/src/PlaylistEngine.ts` (`dispose`, `:607`), `packages/engine/src/types.ts` (a new `EngineDisposeOptions`), `packages/engine/src/index.ts` (export it)
- Modify: `packages/dawcore/src/interactions/split-handler.ts:107-134` (it requires two new ids and would stop dispatching `daw-clip-split`: the left half is now the clip with `originalClipId`, the right one the one new id), the comments at `clip-peak-sync.ts:19,86` and `daw-editor.ts:1682`, `packages/dawcore/notes/interactions.md:32-33`, `packages/dawcore/README.md:393` ("replaces it with two new clips")
- Test: the engine test files that cover `splitClip` and `dispose` (`grep -ln "splitClip\|dispose(" packages/engine/src/__tests__`); `packages/dawcore/src/__tests__/daw-editor-clip-interactions.test.ts:163-237` (its mocked state drops `clip-original`; MIGRATE to the left half keeping it). No other test asserts two new ids (searched engine, dawcore, browser, e2e).
- Create: `.changeset/engine-split-left-id-keep-adapter.md`

**Interfaces:**
- Produces: `splitClip(clip, at)` returns `{ left, right }` with `left.id === clip.id`, `right.id` new. `interface EngineDisposeOptions { keepAdapter?: boolean }`; `PlaylistEngine.dispose(options?: EngineDisposeOptions): void`.

- [ ] **Step 1: Write the failing tests.** `it('split keeps the original id on the left half')`: after `arrangement.splitClip`, the track's clips are `[{ id: original, startSample: s }, { id: ≠ original, startSample: at }]`; one `undo()` gives the original clip back under its id with its full duration. `it('dispose({ keepAdapter: true }) leaves the adapter undisposed and stops it')`: a mock adapter, the engine playing; after the call `adapter.dispose` was not called, `adapter.stop` was, `onPlaybackEnded` was called with `null`, and a later `arrangement.addTrack` makes no adapter call. `it('a second engine on the same adapter after keepAdapter plays its own arrangement')`: engine B on arrangement 2 with the same adapter sends arrangement 2's tracks (`setTracks` called with them), and its `onPlaybackEnded` callback stops B. Update the assertions of existing split tests that expect two new ids (list them in the commit body).
- [ ] **Step 2: Run, see them fail:** `(cd packages/engine && npx vitest run <files>)`.
- [ ] **Step 3: Implement.** In `dispose`, with `keepAdapter`: `if (this._isPlaying) this.stop()` first, then the existing steps without `this._adapter?.dispose()`.
- [ ] **Step 4: Run the engine suite, then build the engine** (each its own command, port check before the build). Then fix the split handler and run `(cd packages/dawcore && npx vitest run src/__tests__/daw-editor-clip-interactions.test.ts src/__tests__/clip-peak-sync.test.ts)`: `daw-clip-split` fires with `leftClipId === originalClipId`, and the left half's peaks are regenerated (its duration changed).
- [ ] **Step 5: Docs:** `website/docs/framework-agnostic/engine.md` (split result; `dispose` options), `website/docs/llm-reference.md` (the `dispose` signature, the split sentence), `packages/engine/CLAUDE.md` (a line under the arrangement section: a split keeps the left id, #848; `keepAdapter` for a host that plays a second arrangement on the same adapter). Grep `website/docs` and `packages/*/README.md` for "both halves" / "two new" and fix each.
- [ ] **Step 6: Changeset** `'@waveform-playlist/engine': minor`: the split's ids, and `dispose({ keepAdapter: true })`.
- [ ] **Step 7: Commit** (`feat: a split keeps the left clip's id; engine.dispose keepAdapter (#848)`).

### Task 2: dawcore — every drag previews and calls the arrangement once

**Files:**
- Modify: `packages/dawcore/src/interactions/clip-pointer-handler.ts` (`_startDrag` `:208`, `onPointerMove` `:244`, `onPointerUp`, `onPointerCancel`, the `ClipEngineContract` interface `:15-34`), `packages/dawcore/src/elements/daw-editor.ts` (`_flushTrackEntries` `:2205`, `_flushAfterDrag` `:2242` removed, the clip container's left offset during a move drawn from the handler's preview delta)
- Modify: `packages/dawcore/notes/interactions.md` ("Move: incremental deltas with `skipAdapter`", "Drag transactions for undo", "Undo and Escape during a drag")
- Test: `packages/dawcore/src/__tests__/clip-pointer-handler.test.ts`, `daw-editor-drag-guard.test.ts` (MIGRATE: the transaction assertions become "no arrangement change until release")

**Interfaces:**
- Consumes: `constrainClipDrag(clip, deltaSamples, sortedClips, sortedIndex)` from `@waveform-playlist/engine` (as `packages/browser/src/modifiers/ClipCollisionModifier.ts:66` calls it), and the clip's track from `host.arrangement.getTracks()`.
- Produces: `ClipPointerHandler.previewDeltaSamples: number` (0 when no move drag), read by the editor's render for the dragged clip's `left`; `ClipPointerHandler.draggedClip: { trackId: string; clipId: string } | null` (non-null from the threshold to the end), read by Task 8. The contract loses `beginTransaction` / `commitTransaction` / `abortTransaction` and `moveClip`'s `skipAdapter` argument.

- [ ] **Step 1: Write the failing tests.** `it('a move drag changes nothing in the arrangement until release, then is one moveClip and one undo step')`: three pointer moves, `tracksVersion` unchanged and the clip's `left` style follows the pointer; on release `startSample` is the constrained position and one `undo()` restores it. `it('a move drag stops at a neighbour, as the release does')`: dragging into a neighbouring clip stops the preview where `constrainClipDrag` stops, and the release lands there. `it('Escape and pointercancel during a move leave the arrangement as it was')` (`tracksVersion` unchanged). `it('a page <daw-track> added during a clip drag enters at once and is not part of the drag\'s undo step')`.
- [ ] **Step 2: Run, see them fail** (`(cd packages/dawcore && npx vitest run src/__tests__/clip-pointer-handler.test.ts src/__tests__/daw-editor-drag-guard.test.ts)`).
- [ ] **Step 3: Implement.** Snap stays as today (`_snapDeltaToSamples` from the original start); the constraint uses the arrangement's loaded clips of the track, sorted by `startSample`. The trim path keeps its single `trimClip` on release and loses its transaction.
- [ ] **Step 4: Run the dawcore suite** to a log in the scratchpad and read the summary. Expected: green apart from the files the inventory marks MIGRATE for later tasks (none for this task).
- [ ] **Step 5: Mutation check** the first two tests (skill `mutation-testing`): restore the per-move `moveClip` and see the first fail; drop the constraint and see the second fail.
- [ ] **Step 6: Commit** (`refactor: dawcore clip drags preview and commit once (#848)`).

### Task 3: dawcore — the editor reads the arrangement; `_engineTracks` and the reconciler go

**Files:**
- Create: `packages/dawcore/src/interactions/arrangement-view.ts` — pure functions over an arrangement: `loadedTrack(track, mix, recording): ClipTrack | null` (the loaded clips with the current mix; memoised per track object and mix values in a `WeakMap`), `mixOf(arrangement, trackId): TrackMixerValues` (stored mix, with `muted: true` while `recordingTrackIds` has the id), `clipSeconds(clip, sampleRate)` (start/duration/offset in seconds for a loaded or a loading clip).
- Modify: `packages/dawcore/src/elements/daw-editor.ts`: rename `_arrangement` to `_ownArrangement` and read `this.arrangement` (a getter returning it until Task 7) everywhere; remove `_engineTracks` (`:518` and its 17 readers), `_reconcileDescriptorsWithEngineTracks` (`:1654`), `_reconcileIdentifiedDropClips` (`:1701`); `_mixOf` (`:1130`) → `mixOf`; `_getOrderedTracks` (`:3768`) builds rows from `getTracks()` + `loadedTrack`; `_recomputeDuration`, `_applyClipUpdate`, `updateClip`, `_onTrackRemoved`, `_onTrackUpdate`'s spectrogram branches and `_buildEngine` read the arrangement. The statechange handler calls `requestUpdate()` instead of rebuilding a Map.
- Modify: `packages/dawcore/src/types.ts`: `TrackExtras` (`{ kind; renderMode; spectrogramConfig?; src; peaksSrc: ReadonlyMap<string, string> }`) for the stored editor-only fields; `PendingEntry` (today's `StoredTrackDescriptor`, held only until the track enters). `TrackWithId`, `TrackDescriptor`, `ClipDescriptor` unchanged as public types.
- Modify: `packages/dawcore/src/interactions/recording-clip.ts`, `interactions/peak-sync.ts` (or wherever `syncPeaksForChangedClips` lives) where they read `_engineTracks` or the descriptors' clips
- Test: `daw-editor-programmatic.test.ts`, `daw-editor-midi.test.ts`, `daw-editor-track-kind.test.ts`, `daw-editor-recording-mute.test.ts`, `daw-editor-mixer-persistence.test.ts` (MIGRATE: read `editor.arrangement.getTracks()` / `editor.tracks`), new `arrangement-view.test.ts`

**Interfaces:**
- Produces: `editor._extras: Map<string, TrackExtras>` (`@state`, replaced on change), `editor._pending: Map<string, PendingEntry>` (registered, not entered), `get arrangement(): Arrangement`. `editor.tracks` per P15.

- [ ] **Step 1: Write the failing tests.** In `arrangement-view.test.ts`: `loadedTrack` returns the same object for the same track and mix (memo), leaves out loading clips, and shows `muted: true` for a recording track; `clipSeconds` gives the same seconds for a loading clip and the clip it loads into. In the editor: `it('an undo-restored track is drawn and listed with its name and kind, with no descriptor written')`; `it('editor.tracks lists the arrangement order, then the pending tracks, with clips from the arrangement')`; `it('the mix shown on a detached editor follows an undo made on its arrangement')` (PR 2's stale `_mixOf`).
- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement.** `_onTrackConnected` puts the element's declaration in `_pending` (read at entry, not at connect, so later `<daw-clip>` connects and attribute changes before entry need no descriptor patching); `_enterTrack` moves it to `_extras`. Drop and recording descriptors keep their clip fields only in `_pending`.
- [ ] **Step 4: Run the dawcore suite and typecheck** (each its own command). Expected: green; `git grep -n "_engineTracks\|_reconcileDescriptors" -- packages` prints nothing.
- [ ] **Step 5: Commit** (`refactor: daw-editor reads its arrangement, no projection of the tracks (#848)`).

### Task 4: dawcore — live element properties, pending values, `:state(detached)`, `trackEl.index`

**Files:**
- Create: `packages/dawcore/src/interactions/element-links.ts`: `ElementLinkHost` (the editor methods the elements call: `trackValue(trackId, prop)`, `requestTrackChange(trackId, partial)`, `clipValue(trackId, clipId, prop)`, `requestClipChange(trackId, clipId, partial)`, `linkState(id): 'pending' | 'live' | 'detached'`, `detachedReason(id): string`, `trackIndex(trackId): number`) and `refreshLinkStates(host, trackEls)`, which sets or clears the state on every registered element.
- Modify: `packages/dawcore/src/elements/daw-track.ts`, `daw-clip.ts`: the P8 properties become `noAccessor` accessor pairs: getter = live value / pending value / parsed attribute (P9); setter = request when live, kept when pending, warn-and-ignore when detached (P12). `attachInternals?.()` in the constructor; `index` getter (P11). The upgrade-property dance in `connectedCallback` (`packages/dawcore/CLAUDE.md`, "Plain JS element properties … must be accessor pairs").
- Modify: `daw-editor.ts`: implement `ElementLinkHost`; call `refreshLinkStates` from the statechange handler on a structural change; stop listening to `daw-track-update` / `daw-clip-update` (P16); `_applyClipUpdate` becomes `requestClipChange` (loaded and loading clips, P10).
- Test: `daw-track.test.ts`, `daw-clip.test.ts` (or the file that covers `<daw-clip>`), new `daw-editor-element-links.test.ts`; MIGRATE `daw-editor-mixer-undo.test.ts` where it changes the mix through attributes.

**Interfaces:**
- Consumes: Task 3's `mixOf`, `clipSeconds`, `_extras`, `_pending`.
- Produces: `ElementLinkHost` as above; `DawTrackElement.index: number`; the custom state name `'detached'`.

- [ ] **Step 1: Write the failing tests** (stub `HTMLElement.prototype.attachInternals` to return `{ states: new Set() }` in `beforeAll`, restore in `afterAll`). `it('trackEl.volume reads the arrangement and a set is one undo step; the attribute is untouched')`. `it('clipEl.start after an arrangement.moveClip is the new position')`. `it('a property set before the track enters is the value it enters with')`. `it('undo of a track\'s arrival detaches its element; redo makes it live again')`: states, `editor.tracks`, the element's getters (attribute values while detached). `it('an attribute change on a live element is one undo step; the value the arrangement holds already is none')`. `it('an attribute change on a detached element warns once and changes nothing')`. `it('trackEl.index follows an arrangement.reorderTrack; -1 when detached')`. `it('a start set on a clip still loading moves the placeholder, and the clip loads at the new start')` (P10). `it('trackEl.muted is the stored mute during a take')`.
- [ ] **Step 2: Run, see them fail.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run the dawcore suite.**
- [ ] **Step 5: Mutation check** the detach/redo test and the pending-value test.
- [ ] **Step 6: Commit** (`feat: daw-track and daw-clip properties read the arrangement (#848)`).

### Task 5: dawcore — DOM order is a request; the order sync goes

**Files:**
- Modify: `daw-editor.ts`: the MutationObserver (`:1210`: a moved `<daw-track>` → `_placeAfterPrevious(trackId)`, one transaction per batch, P13); remove `_syncEngineOrderToDom` (`:3691`), `_syncDomToEngineOrder` (`:3734`), `_inOrderSync` (`:3680`); `reorderTrack` (`:2857`) calls the arrangement only; `connectedCallback`'s detached-removal loop (`:1258`) also removes the clips of `<daw-clip>` elements that left while detached (P17); `_onTrackReorderGrab`/`TrackReorderHandler` commit through `reorderTrack`; the controls' `trackIndex`/`trackCount` from the arrangement.
- Modify: `packages/dawcore/notes/interactions.md` (the four order-sync bullets `:337-340` become one bullet on P13), `packages/dawcore/CLAUDE.md` "Key Patterns" (the two reparenting bullets that name `_engineTracks` and the reconciler)
- Test: `daw-editor-reorder.test.ts` (DELETE-WITH-CODE: the sync spy-count and convergence tests; MIGRATE: the move-button and handler tests assert the arrangement's order and an unmoved DOM), `daw-editor-loading.test.ts` (`reorderTrack` cases)

**Interfaces:**
- Consumes: `entryIndex` (`interactions/track-entry.ts`).

- [ ] **Step 1: Write the failing tests.** `it('reorderTrack changes the arrangement order and moves no element')`. `it('moving a <daw-track> before another reorders the arrangement, one undo step')`. `it('two elements moved in one task are one undo step')`. `it('undo of a reorder moves no element')`. `it('a re-render that writes the same attributes and order is no undo step')` (Review Focus 1). `it('a <daw-clip> removed while the editor was detached is removed from its track at reconnect')`.
- [ ] **Step 2: Run, see them fail. Step 3: Implement. Step 4: Run the dawcore suite.**
- [ ] **Step 5: Commit** (`feat: daw-editor never moves its children; a DOM move is a reorder request (#848)`).

### Task 6: dawcore — the editor's methods are arrangement calls

**Files:**
- Modify: `daw-editor.ts`: `addTrack` (`:2801`) builds a `PendingEntry` and queues it, no element; `addClip` (`:2951`) per P18; `updateTrack` (`:2896`) and `updateClip` (`:3067`) write the arrangement and `_extras` only; `removeTrack` (`:2838`) and `removeClip` (`:3035`) remove the element when there is one, else the track/clip; `_buildClipElement` goes; `_editorMadeTracks` goes (every element is the page's); a failed engine build rejects the waiting `addTrack()`s (P17); `addClip` across a disconnect (P17)
- Modify: `packages/dawcore/src/interactions/midi-loader.ts` (host is `addTrack` + `removeTrack`; cleanup removes the succeeded ids, no DOM)
- Test: `daw-editor-programmatic.test.ts`, `daw-editor-load-midi.test.ts` (MIGRATE: no `querySelectorAll('daw-track')`; assert `editor.tracks` / the arrangement), `daw-editor-loading.test.ts`

- [ ] **Step 1: Write the failing tests.** `it('addTrack creates no element and resolves with an id the arrangement holds')`. `it('addClip on an element-less track loads the clip, creating no <daw-clip>')`. `it('updateTrack on an element-backed track changes trackEl.volume and not its attribute')`. `it('removeTrack removes the element; undo brings the track back with no element')`. `it('loadMidi removes the tracks it added when one fails')`. `it('a failed engine build rejects the addTrack calls waiting to enter')`. `it('an addClip made before a disconnect settles after a fresh adapter loads it')`.
- [ ] **Step 2: Run, see them fail. Step 3: Implement. Step 4: Run the dawcore suite and typecheck.**
- [ ] **Step 5: Commit** (`feat: daw-editor's methods call the arrangement and make no elements (#848)`).

### Task 7: dawcore — `editor.arrangement` handed in; a swap keeps the adapter

**Files:**
- Create: `packages/dawcore/src/interactions/arrangement-swap.ts`: `swapArrangement(host, next)` with the P5 sequence, and the per-arrangement subscriptions (sources → announcer; structural change → link states).
- Modify: `daw-editor.ts`: `@property({ attribute: false }) set arrangement(value: Arrangement | null)` / `get arrangement()`; `_handedIn: Arrangement | null`; the constructor's `sources.subscribe` (`:483`) moves into the swap module (one subscription for the played arrangement); a new announcer per swap (P6); `_flushTrackEntries` enters only while the own arrangement is played (P7); `_onTrackRemoved` removes from the own arrangement when the element was the own's (P7); `_disposeEngine(keepAdapter)`.
- Test: new `daw-editor-handed-in.test.ts`

**Interfaces:**
- Consumes: Task 1's `dispose({ keepAdapter: true })`; Task 4's `refreshLinkStates`.

- [ ] **Step 1: Write the failing tests.** `it('editor.arrangement is the own one until one is handed in')`. `it('a handed-in arrangement is played alone; the children are detached and not added to it')`. `it('a swap with an engine keeps the adapter, stops playback once and sends the new tracks')` (`adapter.dispose` not called; `daw-stop` once; `setTracks` with the new tracks). `it('null returns to the own arrangement with its tracks and history')`. `it('daw-track-ready fires for each track of the arrangement swapped in')`. `it('a non-arrangement throws a TypeError and changes nothing')`. `it('a swap during a take is refused with a warning')`. `it('a <daw-track> added while handed in enters the own arrangement when it is played again')`. `it('effects chains of tracks the new arrangement does not hold are disposed')`. `it('the editor never disposes or clears the history of a handed-in arrangement')`.
- [ ] **Step 2: Run, see them fail. Step 3: Implement. Step 4: Run the dawcore suite.**
- [ ] **Step 5: Mutation check** the keep-adapter test and the null-returns test.
- [ ] **Step 6: Commit** (`feat: editor.arrangement can be handed in (#848)`).

### Task 8: dawcore — an outside change cancels a drag

**Files:**
- Create: `packages/dawcore/src/interactions/drag-watch.ts`: `watchDrags(arrangement, drags): () => void`, subscribed by the swap module for the played arrangement; on each change it applies P2 to `_clipPointer.draggedClip` (Task 2) and to `_trackReorderDrag` (the track id and the id order at grab) and calls `_cancelDrags()` when one changed.
- Modify: `packages/dawcore/src/interactions/track-reorder-handler.ts` (expose `draggedTrackId` and the order at grab), `daw-editor.ts` (wire it)
- Test: `daw-editor-drag-guard.test.ts`

- [ ] **Step 1: Write the failing tests.** `it('arrangement.undo() during a clip move that takes the clip back cancels the drag; the undo goes through')`. `it('arrangement.removeTrack of the dragged clip\'s track cancels the drag')`. `it('arrangement.reorderTrack during a track drag cancels it')`. `it('another clip loading during a clip drag does not cancel it')`. `it('a mixer change during a track drag does not cancel it')`. After a cancel, the release makes no arrangement call.
- [ ] **Step 2: Run, see them fail. Step 3: Implement. Step 4: Run the dawcore suite. Step 5: Mutation check the first and fourth tests.**
- [ ] **Step 6: Commit** (`feat: an outside change to what is dragged cancels the drag in daw-editor (#848)`).

### Task 9: browser — an outside change cancels the React drags

Read on 2026-11-26: nothing in browser needs a change for the split's ids. Selection is by track; `derivePeaks.ts:136-180` and `useTrimPreview.ts:56` compare offset and duration, so the left half's peaks are recomputed; `TrackRows.tsx:379` keys clips by id, so the left `ClipView` stays mounted with new props, as after a trim. No website doc describes a split's ids. What changes is a drag across a split: today a move or trim of a clip split mid-drag goes inert (its id is gone). With the left id kept it would apply to the left half from pre-split geometry. This task's rule cancels it instead. The React drags already write nothing until release (move: one `moveClip` at `useClipDragHandlers.ts:369`; trim: a view-only preview, one `trimClip` at `:313`; reorder: React preview state, one `reorderTrack` at `ClipInteractionProvider.tsx` release), so any change during a drag came from outside.

**Files:**
- Create: `packages/browser/src/providerInternals/DragWatch.tsx`: a render-less component placed inside `ClipInteractionProvider`'s `DragDropProvider` (`ClipInteractionProvider.tsx:222-231`; `useDragDropManager()` must be called below it). It subscribes to the provider's arrangement (`arrangement.subscribe`) and, on each change, applies P2 to the drag in progress. If that drag changed, it calls `manager.actions.stop({ canceled: true })`.
- Modify: `packages/browser/src/hooks/useClipDragHandlers.ts` (`moveDragRef` and `trimDragRef` also hold the dragged clip object at start; expose `getDraggedClip(): { trackId; clipId; clip } | null`), `components/ClipInteractionProvider.tsx` (the reorder drag's track id and the id order at start; render `<DragWatch>`)
- Modify: `packages/browser/notes/` wherever the drag guard is described (`grep -rn "not guarded" packages/browser/notes`: the "PR 3" sentence becomes the rule)
- Test: new `packages/browser/src/__tests__/dragWatch.test.tsx` (mount through `renderWithArrangement`, `packages/browser/src/__tests__/helpers/arrangementProvider.tsx`)

**Interfaces:**
- Consumes: `useDragDropManager` from `@dnd-kit/react` (0.5.3; `actions.stop({ canceled })` aborts the operation and dispatches `dragend` with `canceled: true`, which each handler already checks at `useClipDragHandlers.ts:336-338` and `ClipInteractionProvider.tsx:172`).

- [ ] **Step 1: Write the failing tests** (skills `dnd-kit`, `unit-testing`). Driving a real dnd-kit drag in jsdom is not possible: test `DragWatch`'s decision with a fake manager (`{ actions: { stop: vi.fn() } }` passed through a prop seam, or the hook mocked) and a real arrangement. `it('arrangement.undo() that takes the dragged clip back stops the drag as cancelled')`. `it('removing the dragged clip\'s track stops it')`. `it('a reorder during a track drag stops it')`. `it('another clip loading does not stop a clip drag')`. `it('a mixer change does not stop a track drag')`.
- [ ] **Step 2: Run, see them fail:** `(cd packages/browser && npx vitest run src/__tests__/dragWatch.test.tsx)`.
- [ ] **Step 3: Implement.** The subscription lives in an effect with its cleanup; the drag refs are read inside the listener (skill `react-patterns`: no state for this, no re-render per change).
- [ ] **Step 4: Run the browser suite** to a log and read the summary.
- [ ] **Step 5: In Chromium, before trusting the fake manager:** on the React multi-clip example, start a clip move with Playwright's mouse, call the provider's `arrangement.undo()` from the page (expose it from the example only through the existing test hook, or use the e2e helper that reaches the arrangement), release, and check that the clip is where the undo put it and that the pointer's further moves start no drag. If `actions.stop` leaves the sensor attached, stop and tell the maintainer before working around it. This check goes into Task 11's spec.
- [ ] **Step 6: Mutation check** the first and fourth tests.
- [ ] **Step 7: Commit** (`feat: an outside change to what is dragged cancels the React drag (#848)`).

### Task 10: documentation and changesets

**Files:**
- Modify: `packages/dawcore/CLAUDE.md`: a new section "As close to the native DOM as possible" (the rule; the precedents `<input>` value / `defaultValue`, `<option>` `selected` / `index`, `<details open>`, `<video>` with `<source>` and `srcObject`, custom states; the checklist for a new attribute or property: what the attribute holds, what the property returns pending / live / detached, whether the editor writes it back (never), which event fires, what happens before connect); the Key Patterns bullets that name removed code; "File Drop" (`_getOrderedTracks` sorting bullet)
- Modify: `packages/dawcore/notes/elements.md` (Element Types entries for `<daw-track>` / `<daw-clip>`; "Track ID alignment"), `notes/tracks-and-loading.md` ("Who writes what", `editor.tracks`, `addTrack`, `<daw-clip>` lifecycle), `notes/testing.md` (the `start` not-reflected gotcha now holds for every live property; the `attachInternals` stub)
- Modify: `packages/dawcore/COMPONENTS.md` (`editor.arrangement`, live properties, `trackEl.index`, attributes as declaration, `:state(detached)` and the warning, `removeTrack` / `removeClip`, `addTrack` / `addClip` without elements, `daw-clip-split`'s ids), `packages/dawcore/README.md`, `docs/specs/web-components-migration.md` (attribute tables), `website/static/llms.txt` (handing an arrangement to `<daw-editor>`, the agent path), `website/docs/llm-reference.md`, `website/docs/web-components/getting-started.md`, `examples/dawcore-native/programmatic.html` and `examples/dawcore-tone/programmatic.html` (read `clipEl.start` after a drag; no element from `addTrack`). No React doc describes a split's ids (searched `website/docs`, `llms.txt`, `llm-reference.md` on 2026-11-26).
- Create: `.changeset/dawcore-handed-in-arrangement.md` (`'@dawcore/components': patch`, "Upgrading": `addTrack()` / `addClip()` make no element; `updateTrack` / `updateClip` no longer write attributes; the editor no longer moves `<daw-track>` elements on reorder or undo; element properties are live, attributes are the declaration; a detached element; a split keeps the left id), `.changeset/browser-split-left-id.md` (`'@waveform-playlist/browser': patch`)

- [ ] **Step 1: Grep `.changeset/` and the docs for the removed behaviour's words** (`_engineTracks`, "moves the `<daw-track>`", "DOM order", "order sync", "requires a DOM-backed track", "appends a `<daw-clip>`", "both halves", "new ids", `daw-track-update` described as the editor's input) and correct each.
- [ ] **Step 2: Write the doc changes,** each sentence checked against the source line that makes it true.
- [ ] **Step 3: Website build** (port check first): `pnpm --filter website build`. Expected: exit 0.
- [ ] **Step 4: Lint**, its own command: `pnpm lint`. Expected: 0 errors, no changed file among the warning paths.
- [ ] **Step 5: Commit** (`docs: dawcore elements as native as possible; a handed-in arrangement (#848)`).

### Task 11: in a browser

**Files:**
- Create: `e2e/dawcore-arrangement.spec.ts` (the pattern of `e2e/dawcore-drag-undo-escape.spec.ts`)

- [ ] **Step 1: Write the spec** on the dawcore-native pages: after a clip drag, `clipEl.start` is the new position and `getAttribute('start')` is unchanged; Cmd+Z after adding a `<daw-track>` makes `el.matches(':state(detached)')` true, Cmd+Shift+Z false; `editor.arrangement = createArrangement({ tracks })` plays the other tracks (`editor.engine.getState().isPlaying` after Play) and `= null` brings the page's tracks back; an `arrangement.undo()` from the console during a clip drag cancels it (the clip ends where the undo put it).
- [ ] **Step 2: Prove it against `dev`** (stop your 3077 server, `git checkout dev -- packages/dawcore/src packages/engine/src`, run, record what fails, `git restore --source=HEAD --staged --worktree -- packages`).
- [ ] **Step 3: Full build, then the full e2e suite** (each its own command, port check first, `PORT=3077`), to a log; read the summary.
- [ ] **Step 4: Smoke by hand** (skill `browser-probes`): dawcore-native index, multiclip, programmatic (every button), file drop; dawcore-tone MIDI and recording pages; the React editor's split and drag pages. Console free of new warnings; audio plays.
- [ ] **Step 5: Commit** (`test: dawcore arrangement and element links, in a browser (#848)`).

## Test inventory (dawcore, at `7fd4f6f4`)

- **DELETE-WITH-CODE:** in `daw-editor-reorder.test.ts`, the order-sync tests (`_syncDomToEngineOrder` ×6, `_syncEngineOrderToDom` ×4, `_inOrderSync` ×3 references, and the DOM-order assertions after an undo); in `daw-editor-programmatic.test.ts` and `daw-editor-track-kind.test.ts`, the direct tests of `_reconcileDescriptorsWithEngineTracks` (10 references; their behaviour is covered by Task 3's undo-restored test).
- **MIGRATE:** `daw-editor-programmatic.test.ts` (26 `_engineTracks`, 6+6 `querySelector(All)('daw-track')`, `removeClip` ×5, `updateClip` ×7), `daw-editor-loading.test.ts` (DOM queries ×9, `reorderTrack` ×4), `daw-editor-load-midi.test.ts` (×8 DOM queries), `daw-editor-midi.test.ts`, `daw-editor-mixer-persistence.test.ts`, `daw-editor-recording-mute.test.ts`, `daw-editor-mixer-undo.test.ts`, `clip-pointer-handler.test.ts` (transactions ×21, `moveClip` ×10), `daw-editor-drag-guard.test.ts`, `daw-track.test.ts` (`daw-track-update` ×6: still fired, P16).
- **KEEP:** everything else; a file that fails after a task and is not listed here is a finding, not a migration.

## After the tasks

- `git rm docs/specs/2026-11-25-dawcore-arrangement-design.md docs/plans/2026-11-25-dawcore-arrangement-pr1.md docs/plans/2026-11-25-dawcore-arrangement-pr2.md docs/plans/2026-11-26-dawcore-arrangement-pr3.md` before the PR merges.
- The PR closes #848 (`Closes #848`); check `gh pr view <n> --json closingIssuesReferences` lists only #848.
- Reviews start once the PR is open: two reviewers (code, and doc claims), model opus, delta rounds by SendMessage to the same two. The brief carries the owner table with every row marked done, and the Review Focus above.
- `revise-claude-md` before the merge is asked for.
