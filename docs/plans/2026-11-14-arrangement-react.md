# Arrangement (React half) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `WaveformPlaylistProvider` takes an `arrangement` instead of `tracks` / `onTracksChange`, and everything in the React packages reads the tracks, the mix, the undo history and the loading state from that one owner (#812, parts 5 and 6 of 6).

**Architecture:** The engine half is on `main`: an `Arrangement` owns tracks, mix, history and source loading, and a `PlaylistEngine` plays it. The provider keeps one arrangement for its whole life, builds and disposes engines around it, and derives what it publishes (loaded tracks, placeholder records, peaks, `duration`, `trackStates`, `canUndo`) with `useSyncExternalStore`. A trim is previewed in the view and written once on release. The loading hooks (`useAudioTracks`, `useDynamicTracks`, `useMidiTracks`) are removed.

**Tech Stack:** TypeScript, React 19 (`use`, `<Context value>`, `useSyncExternalStore`), styled-components 6, @dnd-kit/react, vitest (jsdom), Playwright, tsup, pnpm workspace, changesets, Docusaurus.

**Spec:** `docs/specs/2026-11-13-arrangement-design.md`, sections "The provider", "Drags, split, shortcuts", "Recording", "What an app writes", "Behaviour a consumer will notice", "Tests that must exist". `docs/specs/2026-11-13-provider-loads-sources-design.md` stays in force for "MIDI (PR 3)" only. **Where the design and the code disagree, the code and `packages/engine/CLAUDE.md` ("The arrangement owns the tracks") win.** The design's stale sentences are listed under "Corrections to the design" below. Read both specs, that engine section and `website/docs/framework-agnostic/engine.md` ("Loading Audio") before any task.

## Owner table

| State | Stored where (every place) | Who writes each place | Owner | How others change it |
| --- | --- | --- | --- | --- |
| Tracks and clips, loading clips included | the arrangement | its methods | arrangement | its methods |
| Mix by track id | the arrangement's mixer Map | its four setters | arrangement | the setters |
| The armed track's mute from before a take | the provider (`armedTrackMuteRef`), for the length of a take | `setRecordingActive` | provider | nobody; it always wins when the take ends (maintainer, QJ) |
| Which track is armed and recording | provider state | `setRecordingActive` | provider | `setRecordingActive` |
| Undo and redo history | the arrangement | its methods | arrangement | `undo`, `redo` |
| Sources, their status and buffers | the arrangement's loader | the loader | arrangement | `retry` |
| The decode context | the provider attaches; the arrangement holds the getter | the provider's mount effect | provider | nobody |
| A trim drag in progress | the provider's preview source | the drag handlers | provider | publish, clear |
| `isReady`; "ready has fired" | provider state; a ref | the provider | provider | nobody |
| Selection, loop, zoom, master volume, selected track | the engine; React hook state and refs | the engine; the hooks mirror it and seed each new engine from the refs | engine | unchanged by this plan (a non-goal of the design) |
| `isPlaying`, cursor position | React state and refs; the engine | as on `main` | unchanged | unchanged |

Derived, cached, never written back: the loaded tracks published as `usePlaylistTimeline().tracks`, the placeholder records, `peaksDataArray`, `duration`, `trackStates`, `canUndo` / `canRedo`, what the adapter holds.

The first question to every reviewer of every PR: **which state here is still stored in two places, and which place writes back?**

## Decisions (maintainer, 2026-11-14; do not re-ask)

Everything under "Decided by the user" in the current-state memory and every "Maintainer 2026-11-14" line of `.superpowers/sdd/2026-11-13-arrangement-engine/progress.md` holds. The ones made for this plan:

- **QA.** `usePlaylistTimeline().tracks` is `ClipTrack[]` with loaded clips only. A placeholder is a `ClipPeaks` with `isPlaceholder: true` in `peaksDataArray` and exists nowhere else. Nothing pairs `tracks[i].clips` with `peaksDataArray[i]` by index; ids only.
- **QB.** A refused track (wrong kind, which includes a loading clip on a MIDI track; a duplicate track id; two clips with one id) throws to whoever called the arrangement. `useCreateArrangement` lets its initializer throw during render. The provider's `onError` means "the engine or adapter could not be built" and nothing else.
- **QC.** `useArrangementTracks(arrangement)` and `useArrangementSources(arrangement)`: the argument is required. No fallback to the context. No `useArrangementMixer`. `useIntegratedRecording(arrangement, …)` takes the arrangement as its first argument.
- **QD.** `duration` counts loaded audio only and equals the engine's. The view gets the width for placeholders separately. (Whether the multitrack provider should have an end at all is #851, not this plan.)
- **QE.** `onReady` and `waveform-playlist:ready` fire once per provider mount, the first time an engine is attached and no source is pending. `isReady` and `data-playlist-state` still go false and true around each later engine. A file dropped during the first load extends the wait. A failed source does not call `onError`.
- **QF.** The engine is not changed. Library code makes no track edit from inside `arrangement.subscribe` or a `statechange` listener; the guides state the rule for apps. The provider attaches the decode context in a mount-only effect and detaches in its cleanup; while no adapter exists the getter waits.
- **QG.** `onReady` and `onError` are read through a ref of the latest committed function and never rebuild the engine. An engine is built on mount, when `effects` changes identity and when `zoomLevels` changes content. `createAdapter` and `sampleRate` are read at build time, as on `main`.
- **QH.** First load of MIDI: `await loadMidiTracks(…)`, `addTrack` each, then `arrangement.clearHistory()` once. A `.mid` dropped later stays an undo step. `loadMidiTracks` keeps `sampleRate` required. The `parseMidiFile` / `parseMidiUrl` re-export in `packages/midi/src/index.ts` is left alone.
- **QI.** Five PRs, below. Export while something loads exports loaded clips only.
- **QK.** The trim preview is internal: a `TrimPreviewContext` in `contexts/playlistContexts.ts` that is not exported from the package entry. `useClipDragHandlers` and the clip view read it themselves. Nothing is added to `useEditorControls()`.
- **QL.** While a trim is dragged past the end of the timeline the view is as wide as the previewed end rounded UP to the next 10 seconds (0 to 10 seconds spare; not the recording layout's 10 to 20). A stopgap: the maintainer wants a view without a fixed end later (#851, with two references).
- **QM.** `useTrack().isRecordingArmed: boolean` is a public field of `TrackContextValue`, fed by an internal `RecordingArmContext` (not exported). The built-in `TrackMuteButton` and an app's own mute control disable themselves on it.
- **QJ.** While a take records, the armed track is muted through the arrangement. When the take ends, or the armed track changes mid-session, the value from before the take is written back whatever happened in between. The mute button of the armed track is disabled during a take. This replaces the design's "a user's own mute change during the take is what is kept".

## Corrections to the design

Engine side (ledger, session 3): only `removeTrack` takes `{ undoable: false }`; the decode attach point is the exported `attachDecodeContext(arrangement, getContext)`; change types also include `load`, `recompute`, `history`; the engine still calls the adapter's mixer setter for an id the arrangement does not hold; a track given a new id carries its mix; `LoadSource` / `defaultLoadSource` already live in the engine package; a loading clip on a MIDI track throws.

Provider side: `loadSource` was never a provider prop on `main` (it is `createArrangement({ loadSource })`); `deferEngineRebuild` is also removed; "the seed, the merge, the echo suppression, the first-load wait, the early adapter", `useDisposeEngineOnUnmount`, `useReportRejectedClips`, the sources context and the converted pages exist only on the backup branch, so "kept" means "ported" and the first five have nothing to delete on `main`; line references `WaveformPlaylistContext.tsx:904` and `:912-929` are `:778` and `:786-803`; "the rule in `CLAUDE.md`" is done (#844); `useArrangementTracks` / `useArrangementSources` take a required argument (QC); the placeholder is a drawing record, not a clip in `tracks` (QA); the arm-mute rule is QJ.

## Global Constraints

- **The rule:** every piece of state has one owner. A task that would add a second stored copy of the tracks, the mix, the history or the loading state in a React package stops and reports. Load the project skill `state-ownership` before each PR's first task and `react-patterns`, `unit-testing`, `e2e-playwright`, `dnd-kit` (PR 3 and Task 9), `translatable-strings` (Task 10) when the task touches what they cover.
- Read root `CLAUDE.md`, `packages/browser/CLAUDE.md` and the topic file it names for the part being changed, before the first edit of a task.
- No compat shims, no deprecated aliases, no throwing getters for removed names. Every breaking change gets one section in `website/docs/react/upgrading.md` (what changed, **Find**, **Replace with**).
- No arrangement write during a React render. No track edit from inside `arrangement.subscribe` or a `statechange` listener (QF).
- An arrangement's methods are class methods: never hand one to React unbound. Wrap: `(listener) => arrangement.subscribe(listener)`.
- Nothing new carries "Playlist" in its name (#781). Every new context is named `…Context`, read with `use()` at the top level, and added to the OTHER provider's `BLOCKED` list in the same change.
- The provider's static import graph stays free of `tone` and `@waveform-playlist/playout` (`staticEngineImports.test.ts`, `coreBarrelEngineFree.test.ts`). `@waveform-playlist/engine` is allowed.
- `contexts/playlistContexts.ts` keeps `import type` only, apart from `createContext` / `use`.
- Every new field of a context value gets a case in `contextValueStability.test.tsx` and a row in `contextSplitByChangeRate.test.tsx`.
- Files under 800 lines, functions under 50. `WaveformPlaylistContext.tsx` is 2018 lines: Task 7 and Task 8 move code out into `providerInternals/`; it must end PR 4 smaller than it starts, and nothing new is added to it that can live in a hook file.
- Downstream packages resolve workspace packages through `dist`: after changing a package's source, build it before running another package's tests. Before ANY build, `pnpm test` or `git checkout`: `lsof -nP -iTCP:3000 -sTCP:LISTEN` as its own command; if a server is there that you did not start, use `cd website && pnpm exec docusaurus start --port 3077 --no-open` and `PORT=3077 pnpm test`.
- Every check (vitest, `pnpm typecheck`, `pnpm lint`, `pnpm --filter website build`, e2e) is its own command, read before a commit. `website/src` is outside lint and typecheck: `cd website && npx eslint <touched files>`, and the e2e run is its check.
- Every new regression test is seen to fail with its guarded line broken (skill `mutation-testing`).
- A sequence that crosses React and the engine is run in a browser before it is called correct (skill `browser-probes`).
- A changeset by hand in `.changeset/` for every PR that changes `packages/*/src`: `major` for browser, recording, midi and ui-components where a public name or behaviour changes.
- Never merge. Each PR is opened after the maintainer has been told its behaviour table, and is left for them. The independent review covers the final diff; no source edit while a review or an e2e run is in flight.
- Files ported from `feat/812-2-provider-resolution` are read with `git show feat/812-2-provider-resolution:<path>`, never by checking the branch out. Rename `PlaylistTrack` to `ArrangementTrack` at port time.

## Review Focus

Sequences the unit tests will not exercise on their own. Each is pinned by the test named in the owning task.

1. **A source settles during a trim drag** (the clip under the pointer, or another clip of the same track, switches from loading to loaded while the preview is up), then release; then the same with Escape. Expected: the release trims the clip as previewed, Escape leaves it where it was, no clip is lost. Task 5 (unit, on today's provider) and Task 13 (e2e).
2. **An `<Activity>` hide during the first load, then reveal.** Loads in flight are aborted and start again; `onReady` fires once in total, not once per reveal; the undo history is intact. Task 8.
3. **Play pressed after a later engine rebuild while a dropped file is still pending.** The rebuilt engine is ready when it is attached; it does not wait for the pending drop. Task 8.
4. **A take ends after the user or the app changed the armed track's mute** (through the disabled button's absence, that means `arrangement.setTrackMute` from app code), and **the armed track is removed during a take**. Expected: the pre-take value is written back in the first case; nothing throws and no entry is resurrected in the second. Task 10.
5. **A left trim preview on a clip with pre-computed peaks and on one with worker peaks.** The waveform shown under the preview is the slice for the previewed offset, not the old slice stretched or shifted. Task 5, checked in a browser screenshot as well.
6. **Two files that fail to decode are removed by an example page in one go.** The removal is made from a `sources` listener or an effect, never from `arrangement.subscribe`: the adapter gets two `removeTrack` calls, not a `setTracks`. Task 12 (browser probe counting adapter calls).
7. **A placeholder that ends later than all loaded audio.** The view is wide enough to show it; Play stops at the end of the loaded audio; a click beyond that end puts the cursor at the end of the loaded audio. Task 9.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/browser/src/hooks/useCreateArrangement.ts` (new, PR 2) | one arrangement for a component's life |
| `packages/browser/src/hooks/useArrangementTracks.ts`, `useArrangementSources.ts` (new, PR 2) | read an arrangement object with `useSyncExternalStore` |
| `packages/browser/src/utils/placeholderPeaks.ts` (new, PR 2) | a loading clip to a placeholder `ClipPeaks`, or `null` |
| `packages/midi/src/loadMidiTracks.ts` (new, PR 2) | fetch or read, parse, build `ClipTrack[]` |
| `packages/browser/src/providerInternals/useTrimPreview.ts` (new, PR 3) | the preview source and its type |
| `packages/browser/src/providerInternals/useEngineLifetime.ts` (new, PR 4) | build, assign and dispose an engine around the arrangement; decode context; the #675 rules |
| `packages/browser/src/providerInternals/useReadyOnce.ts` (new, PR 4) | `isReady`, the once-per-mount callback and event |
| `packages/browser/src/providerInternals/useArrangementView.ts` (new, PR 4) | loaded tracks, placeholder records, `trackStates`, `canUndo` / `canRedo` from the arrangement |
| `packages/browser/src/utils/loadedTracks.ts` (new, PR 4) | an arrangement's tracks without their loading clips, identity kept per track object |
| `packages/browser/src/WaveformPlaylistContext.tsx` | composes the above; playback; context values |
| `packages/browser/src/contexts/playlistContexts.ts` | `ArrangementContext` + `useArrangement()`, `TrimPreviewContext` and `RecordingArmContext` (both internal), the timeline value without `onTracksChange` |
| `packages/recording/src/hooks/useIntegratedRecording.ts` | takes the arrangement |

Branches: `feat/812-react-1-plan` (PR 1, this file) → `feat/812-react-2-additions` → `feat/812-react-3-trim-preview` → `feat/812-react-4-provider` → `feat/812-react-5-midi-sweep`. Each code branch starts from `main` once its parent has merged; if the parent is still open, stack on it and follow root `CLAUDE.md`, "After the parent of a stacked PR is squash-merged". PR titles say "Part 5a … 5c of 6 for #812" and "Part 6 of 6"; no closing keyword next to the number before PR 5.

| PR | What it leaves working on `main` |
| --- | --- |
| 1 plan | docs only |
| 2 additions | everything as before; four new exports that nothing in the library uses yet, documented |
| 3 trim preview | every page as before; a trim calls `onTracksChange` once on release instead of once per move; `isDraggingRef` is gone; split and drags address clips by id |
| 4 the switch | the provider on an arrangement; every example page, story, starter and spec converted; `useAudioTracks` / `useDynamicTracks` gone; `useMidiTracks` still exported and unused by the site |
| 5 MIDI and sweep | `useMidiTracks` gone; notes and working documents cleaned up; #812, #791, #798 closed |

---

# PR 2: additions, nothing removed

### Task 1: `useCreateArrangement`, `useArrangementTracks`, `useArrangementSources`

**Files:**
- Create: `packages/browser/src/hooks/useCreateArrangement.ts`, `useArrangementTracks.ts`, `useArrangementSources.ts`
- Modify: `packages/browser/src/hooks/index.ts`, `packages/browser/src/index.tsx` (export the three from the core entry, not `/tone`)
- Test: `packages/browser/src/__tests__/arrangementHooks.test.tsx`

**Interfaces:**
- Consumes: `createArrangement`, `Arrangement`, `LoadSource`, `ArrangementSourcesValue` from `@waveform-playlist/engine`; `ArrangementTrack` from `@waveform-playlist/core`.
- Produces:
  - `useCreateArrangement(init?: () => readonly ArrangementTrack[], options?: { loadSource?: LoadSource; undoLimit?: number }): Arrangement`. One arrangement per component instance (`useState(() => createArrangement({ tracks: init?.(), ...options }))`). `init` and `options` are read once.
  - `useArrangementTracks(arrangement: Arrangement): readonly ArrangementTrack[]`
  - `useArrangementSources(arrangement: Arrangement): ArrangementSourcesValue`

- [ ] **Step 1: failing tests** (jsdom, no provider, a fake `loadSource` that stays pending until the test settles it; the pattern is `fakeLoads()` in `packages/engine/src/__tests__/arrangementSources.test.ts`):
  - "returns the same arrangement on every render and after a parent re-render with a new init function"
  - "an initializer that throws (two tracks with one id) throws out of the render" (assert with an error boundary; QB)
  - "under StrictMode no source is fetched by either of the two arrangements the initializer makes" (`loadSource` not called: no decode context is attached)
  - "`useArrangementTracks` re-renders on `addTrack` and not on `setTrackVolume`" (count renders)
  - "`useArrangementSources` re-renders when a source settles and returns the same object in between"
  - "both hooks follow a different arrangement passed on a later render"
- [ ] **Step 2:** run `(cd packages/browser && npx vitest run src/__tests__/arrangementHooks.test.tsx)`; expected: fails on the missing modules.
- [ ] **Step 3:** implement. `useSyncExternalStore(subscribe, getSnapshot, getSnapshot)` with `subscribe` and `getSnapshot` built in a `useMemo` over `arrangement` (closures, never the unbound methods). For sources: `arrangement.sources.subscribe` / `getSnapshot`, wrapped the same way.
- [ ] **Step 4:** run the file again (passes); then `oneOwnerPerExport.test.ts` and `coreBarrelEngineFree.test.ts`.
- [ ] **Step 5:** commit `feat(browser): useCreateArrangement, useArrangementTracks, useArrangementSources (#812)`.

### Task 2: the placeholder record

**Files:**
- Create: `packages/browser/src/utils/placeholderPeaks.ts`; test `packages/browser/src/utils/__tests__/placeholderPeaks.test.ts`
- Modify: `packages/browser/src/WaveformPlaylistContext.tsx` (`ClipPeaks` gains `isPlaceholder: boolean`), `packages/browser/src/utils/derivePeaks.ts` (sets `false`), `packages/browser/src/MediaElementPlaylistContext.tsx` (sets `false`), `packages/browser/src/components/TrackRows.tsx`, `packages/ui-components/src/components/Clip.tsx`
- Port from the backup branch by path: the `isPlaceholder` prop of `Clip.tsx` and how it is drawn, `TrackRows.tsx:143-144`, `__tests__/placeholderClips.test.tsx` (the drawing cases only)

**Interfaces:**
- Consumes: `LoadingClip` from core.
- Produces: `placeholderPeaks(clip: LoadingClip, trackName: string, opts: { contextSampleRate: number; samplesPerPixel: number; mono: boolean }): ClipPeaks | null`. Rules, from `placeholderClip()` in the backup's `utils/resolveTracks.ts`: `null` when the clip has neither a `duration` nor usable `waveformData`, or when `start` / `offset` / `duration` are not usable numbers; the rate is the peaks file's `sample_rate` when there is `waveformData`, else `contextSampleRate`; with `waveformData` the peaks are drawn from it (the same slice rule as `extractFromOwnWaveformData` in `derivePeaks.ts`), without it the peaks are empty; `isPlaceholder: true`; `clipId` is the loading clip's id. Memoize per loading-clip object and options in a `WeakMap`.
- Produces: `ClipPeaks.isPlaceholder: boolean` (required field); `Clip`'s `isPlaceholder?: boolean` prop (no header drag, no trim handles, the placeholder look of the backup branch).

- [ ] **Step 1: failing tests:** "a clip with a duration and no peaks gives an empty box of that length at the context rate"; "a clip with waveformData is drawn from it at the file's rate"; "no duration and no waveformData gives null"; "a negative start gives null"; "the same loading clip and options return the same object"; in `placeholderClips.test.tsx`: "a placeholder row has no trim handles and its header does not start a drag".
- [ ] **Step 2:** run both files; expected: fail.
- [ ] **Step 3:** implement and port. Nothing calls `placeholderPeaks` from the provider yet (Task 8 does).
- [ ] **Step 4:** run `(cd packages/ui-components && npx vitest run)`, build ui-components, then `(cd packages/browser && npx vitest run)`.
- [ ] **Step 5:** render a `Clip` with `isPlaceholder` in a Storybook story (with and without peaks) and look at a screenshot in both themes (root `CLAUDE.md`, "Render a CSS or markup example before committing it").
- [ ] **Step 6:** commit `feat(browser,ui-components): a placeholder record for a clip that is still loading (#812)`.

### Task 3: `loadMidiTracks`

**Files:**
- Create: `packages/midi/src/loadMidiTracks.ts`; test `packages/midi/src/__tests__/loadMidiTracks.test.ts`
- Modify: `packages/midi/src/index.ts`

**Interfaces:**
- Produces: `loadMidiTracks(src: string | File | Blob, options: { sampleRate: number; flatten?: boolean; start?: number; duration?: number; name?: string; signal?: AbortSignal }): Promise<ClipTrack[]>`. Over `parseMidiUrl` / `parseMidiFile` of `@dawcore/midi`; the track building is what `useMidiTracks.ts` does today (move `lastNoteEnd` and the clip construction into this file and have the hook call it, so there is one copy until PR 5 deletes the hook). Tracks are `kind: 'midi'`. An aborted signal rejects with the `AbortError`; nothing is returned after an abort.

- [ ] **Step 1: failing tests:** "a multi-track file gives one track per MIDI track with ids from this call"; "`flatten` gives one track"; "`start` and `duration` in seconds become samples at `sampleRate`"; "a Blob is read, a string is fetched"; "an abort before the parse rejects with an AbortError"; "the result passes `createArrangement({ tracks })` without throwing".
- [ ] **Step 2:** run; fails on the missing module.
- [ ] **Step 3:** implement; `useMidiTracks` keeps its behaviour (`useMidiTracks.test.ts` and `useMidiTracksInlineConfigs.test.ts` pass unchanged).
- [ ] **Step 4:** run `(cd packages/midi && npx vitest run)`.
- [ ] **Step 5:** commit `feat(midi): loadMidiTracks (#812)`.

### Task 4: docs, changeset, PR 2

- [ ] `website/docs/llm-reference.md`, `website/static/llms.txt`, `website/docs/react/api/hooks.md` (the three hooks), `website/docs/react/guides/midi.md` and `packages/midi/README.md` (`loadMidiTracks`, beside the hook for now), `packages/browser/README.md`, `packages/browser/CLAUDE.md` (hook list). Each new sentence is checked against the source line.
- [ ] Changesets: browser `minor`, ui-components `minor`, midi `minor`.
- [ ] Own commands, each read: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm --filter website build`, the e2e suite.
- [ ] Independent review of the final diff; behaviour table to the maintainer; open "Part 5a of 6 for #812".

---

# PR 3: the trim preview and clips by id, on today's provider

### Task 5: a trim previews in the view

**Files:**
- Create: `packages/browser/src/providerInternals/useTrimPreview.ts`
- Modify: `packages/browser/src/hooks/useClipDragHandlers.ts`, `components/ClipInteractionProvider.tsx`, `components/TrackRows.tsx` (`ClipView`), `utils/derivePeaks.ts` (export the per-clip step), `components/WaveformRoot.tsx`, `WaveformPlaylistContext.tsx`, `contexts/playlistContexts.ts`
- Test: `packages/browser/src/__tests__/trimPreview.test.tsx`; update `visualizationMemoBoundaries.test.tsx`, `contextSplitByChangeRate.test.tsx`, `contextValueStability.test.tsx`, and the drag tests that assert per-move `onTracksChange`

**Interfaces:**
- Produces:
  - `interface TrimPreview { trackId: string; clipId: string; startSample: number; durationSamples: number; offsetSamples: number }`
  - `TrimPreviewContext` (internal, QK): its value is a `ValueSource<TrimPreview | null>` (core's `createValueSource`; a stable object made once by `useTrimPreview`). Declared in `contexts/playlistContexts.ts`, provided by `WaveformPlaylistProvider`, blocked under `MediaElementPlaylistProvider`, not exported from `index.tsx` or `tone.ts`. `useEditorControls()` is unchanged
  - `useEngineRefs()` without `isDraggingRef`
  - `useClipDragHandlers` options without `isDraggingRef` (and no `beginTransaction` / `commitTransaction` / `abortTransaction` call left in the file)
  - `derivePeaks.ts` exports the per-clip function it has today as `deriveClip` under the name `clipPeaksFor(clip, trackName, inputs, previous?)`, so a previewed clip's peaks are computed by the same code

- [ ] **Step 1: failing tests** in `trimPreview.test.tsx` (real provider, fake adapter, the harness of `trackControlsDisabledWhileLoading.test.tsx`):
  - "each move of a trim publishes a preview and calls neither `onTracksChange` nor the engine"
  - "a move renders the dragged clip's view and no other clip, row or the root" (render counters)
  - "release calls `engine.trimClip` once with the final delta and clears the preview in the same flush; `onTracksChange` is called once"
  - "Escape clears the preview and changes no track"
  - "the previewed left trim draws the peaks of the previewed offset" (assert the `ClipPeaks` handed to `Clip`: `offsetSamples`, `durationSamples`, and peak data equal to `clipPeaksFor` of the trimmed clip)
  - "a new `tracks` prop during the drag (audio arrived for another clip of the track) keeps the preview and the release still trims the dragged clip" (Review Focus 1)
  - "the preview is constrained and snapped as before" (reuse the cases of the existing trim tests, asserting on the preview)
  - "a move drag makes one `engine.moveClip` on drop and opens no transaction"
- [ ] **Step 2:** run; fails.
- [ ] **Step 3:** implement. The handlers compute each move from the bounds captured at the start (`calculateBoundaryTrim`, `engine.constrainTrimDelta`, the snap function) and call `set(...)` on the source they read from `TrimPreviewContext`. `ClipView` reads the source with `useSyncExternalStore` and a snapshot that is `null` unless `clipId` is its own, then draws `clipPeaksFor` of its clip with the previewed geometry. The view's width: `WaveformRoot` adds a third input to `displayDuration`, the previewed end rounded up to the next 10 seconds (QL; the step constant of `useRecordingLayout.ts`, but rounding up only), read with a selector that returns that stepped number, so the root renders once per step and not per move. Remove `isDraggingRef` from the provider, the context value type and the loading effect (the `isDraggingRef.current` terms at `:518` and `:598`).
- [ ] **Step 4:** run the browser suite.
- [ ] **Step 5:** browser check on `/examples/multi-clip` (dev server on 3077): trim left and right, Escape, a trim at the timeline's end; screenshot of a left trim in progress on a clip with `.dat` peaks (`/examples/waveform-data`) and on one with worker peaks (Review Focus 5). `probes/trim767.cjs 3077 /examples/multi-clip` before and after: components rendered per move.
- [ ] **Step 6:** commit `feat(browser)!: a trim previews in the view and changes the tracks once, on release (#812)`.

### Task 6: clips by id

**Files:**
- Modify: `hooks/useClipSplitting.ts`, `hooks/useClipDragHandlers.ts`, `modifiers/ClipCollisionModifier.ts`, `components/KeyboardShortcuts.tsx`, `hooks/usePlaybackShortcuts.ts` if it calls `splitClipAt`
- Test: `clipsById.test.tsx`; update the split and collision tests

**Interfaces:**
- Produces: `splitClipAt(trackId: string, clipId: string, splitTime: number): boolean`. The drag data keeps its shape (`{ clipId, trackIndex, clipIndex, … }`, `ui-components/src/components/Clip.tsx:133`); the handlers and the collision modifier find the clip with `tracks[trackIndex].clips.find((c) => c.id === clipId)` and never with `clips[clipIndex]`, because `clipIndex` is a row position and from PR 4 on a row can hold placeholders.

- [ ] **Step 1: failing tests:** "`splitClipAt` by ids splits the named clip when it is not the first of its track"; "an unknown clip id returns false and changes nothing"; "a drag whose `clipIndex` does not match the clip's position in `track.clips` still moves the clip named by `clipId`" (build the mismatch by handing the handler data with a shifted index); the same for a trim and for the collision modifier.
- [ ] **Step 2 to 4:** run (fails), implement, run the browser suite.
- [ ] **Step 5:** commit `feat(browser)!: splitClipAt and the clip drags address clips by id (#812)`.

### Task 7: docs, e2e, PR 3

- [ ] Upgrade guide sections: `useEngineRefs().isDraggingRef` removed; `useClipDragHandlers` no longer takes `isDraggingRef`; `splitClipAt(trackId, clipId, time)`; "a trim calls `onTracksChange` once" (a behaviour note; that prop goes in the next part).
- [ ] `llm-reference.md`, `llms.txt`, `api/hooks.md`, `guides/custom-drag-setup.md`, `guides/track-management.md` if it shows a split, `CustomDragSetupExample.tsx`, `examples/react-starter` if it passes `isDraggingRef`; `packages/browser/notes/clip-drag-and-snap.md` ("Trim/Move Asymmetry" is rewritten: both are one call on release), `notes/contexts.md` (the `useEngineRefs()` row; "each move of a trim" leaves the timeline and mixer rows).
- [ ] New e2e in `e2e/multi-clip.spec.ts`: "Escape during a trim leaves the clip where it was"; "a trim is one undo step".
- [ ] Changeset: browser `major`. Own commands: typecheck, lint, build, website build, e2e. Review, behaviour table, open "Part 5b of 6 for #812".

---

# PR 4: the switch

Inside this branch Task 8 is additive and green on its own. Task 9 changes the provider's props: from that commit until Task 12 the package suites are green and the website pages are not. The e2e run belongs to Task 13.

### Task 8: the engine's lifetime, ready, and the view of an arrangement, as hooks

**Files:**
- Create: `providerInternals/useEngineLifetime.ts`, `useReadyOnce.ts`, `useArrangementView.ts`, `utils/loadedTracks.ts`
- Test: `__tests__/engineLifetime.test.tsx`, `readyOnce.test.tsx`, `arrangementView.test.tsx`, `utils/__tests__/loadedTracks.test.ts`

**Interfaces:**
- Consumes: Task 1 and Task 2; `attachDecodeContext`, `PlaylistEngine` (`{ adapter, arrangement, attachDecodeContext: false, samplesPerPixel, zoomLevels }`) from the engine; `resolvePlayoutAdapter`.
- Produces:
  - `loadedTracks(tracks: readonly ArrangementTrack[], cache: LoadedTracksCache): { tracks: ClipTrack[]; cache: LoadedTracksCache }`: each track without its loading clips; a track that holds none is the arrangement's own object; the same result array while no element changed (the `derivePeaks` pattern).
  - `useArrangementView(arrangement, { samplesPerPixel, mono, sampleRate, getGeneratedWaveformData, generatedWaveformVersion }): { tracks: ClipTrack[]; peaksDataArray: TrackClipPeaks[]; placeholdersEnd: number; duration: number; trackStates: TrackState[]; canUndo: boolean; canRedo: boolean }`. `peaksDataArray[i]` follows the arrangement's clip order for track `i`: `derivePeaks` entries for loaded clips, `placeholderPeaks` for loading ones that give a record. `duration` is `timelineDuration(tracks)` (loaded only, QD); `placeholdersEnd` is the end in seconds of the last placeholder, 0 when none. `trackStates` is one entry per track in order, from `arrangement.getMixer()` and the track's name, the same array while no entry changed; every track has an entry (no `undefined`).
  - `useEngineLifetime({ arrangement, createAdapter, effects, resolveTrackEffects, soundFontCacheRef, sampleRateProp, zoomLevels, samplesPerPixelRef, seedEngine, onEngine, onErrorRef }): { engineRef, adapterRef, engineEpoch, engineBuildInFlightRef, disposeEngineKeepingPlayback }`. Builds on mount and when `effects` identity or `zoomLevels` content changes (QG); disposes on every cleanup. `seedEngine(engine)` is the checklist of `notes/playback-and-engine.md` ("Seed on rebuild"); `onEngine(engine)` is where the provider subscribes to `statechange` and `stop`. It also owns the decode context: a mount-only effect calls `attachDecodeContext(arrangement, getContext)` and returns the detach; `getContext` resolves to `adapterRef.current.audioContext` and, while there is no adapter, waits for the next one to be assigned (it never rejects because a build failed).
  - `useReadyOnce({ engineEpoch, engineRef, arrangement, onReadyRef, onErrorRef, trackCount, duration }): boolean`. `isReady` is false until an engine is attached and `arrangement.sources.getSnapshot().pendingCount === 0` for the first time; then it is "an engine is attached". The callback and the `waveform-playlist:ready` event (`detail: { trackCount, duration }`) fire once per mount; an `onReady` that throws is reported as today (`:920-927`).

- [ ] **Step 1: failing tests.**
  - `loadedTracks.test.ts`: "a track with no loading clip is the same object"; "a track with one keeps its loaded clips in order"; "the result array is the same when called again with the same input"; "only the changed track is a new object after one arrival".
  - `arrangementView.test.tsx`: "a fader move changes `trackStates` and not `tracks` or `peaksDataArray`"; "an arrival replaces the placeholder record with the loaded clip's record at the same position"; "`duration` ignores a placeholder that ends later, `placeholdersEnd` reports it"; "a track with only a loading clip without duration has a row with no entries and a `trackStates` entry"; "`canUndo` follows `moveClip`, `undo` and `clearHistory`".
  - `engineLifetime.test.tsx` (fake `createAdapter` returning a promise, as in `playDuringEngineRebuild.test.tsx`): "one engine on mount, built with `attachDecodeContext: false` on the given arrangement"; "a new `onError` function builds nothing"; "a new `effects` function disposes and builds once, and the arrangement's tracks, mix and history are the same objects afterwards"; "`addTrack`, `removeTrack` and `setTracks([])` on the arrangement build nothing" (#798); "nothing is fetched until the first adapter exists; a load started between two engines waits and then decodes with the new adapter's context"; "a failed adapter build leaves sources pending, calls `onError` once and a later successful build loads them"; "unmount disposes the engine and detaches the context on every path"; "StrictMode: one live engine, one attached context, no 'one audio context at a time' warning"; "an `<Activity>` hide aborts loads in flight and the reveal starts them again; the history survives" (Review Focus 2).
  - `readyOnce.test.tsx`: "not ready while a first source is pending, ready when it settles"; "ready with a failed source, and `onError` is not called for it"; "a file added during the first load extends the wait"; "after the first ready, a rebuild with a pending source is ready when its engine is attached" (Review Focus 3); "`onReady` and the event fire once across a rebuild and across an `<Activity>` hide and reveal"; "an empty arrangement is ready when the engine is attached".
- [ ] **Step 2:** run the four files; fail.
- [ ] **Step 3:** implement. `useEngineLifetime` is the full-build path of today's loading effect (`:737-983`) without anything about tracks, plus the unmount effect (`:1028`); keep the six #675 rules of `notes/playback-and-engine.md` word for word in behaviour (`playDuringEngineRebuild.test.tsx` is the contract and moves onto the new harness in Task 9).
- [ ] **Step 4:** run the four files and the whole browser suite (nothing else uses the hooks yet).
- [ ] **Step 5:** commit `feat(browser): engine lifetime, ready and the view of an arrangement as provider internals (#812)`.

### Task 9: the provider on an arrangement

**Files:**
- Modify: `WaveformPlaylistContext.tsx`, `contexts/playlistContexts.ts`, `MediaElementPlaylistContext.tsx` (block the new contexts), `components/WaveformRoot.tsx`, `components/ClipInteractionProvider.tsx`, `components/KeyboardShortcuts.tsx`, `components/ExportControls.tsx`, `hooks/useClipDragHandlers.ts`, `hooks/useClipSplitting.ts`, `hooks/useUndoState.ts` (delete: the view hook replaces it), `hooks/useExportWav.ts`, `packages/spectrogram/src/SpectrogramProvider.tsx`
- Delete: `utils/incrementalTrackChange.ts`, the helpers of `utils/trackMixerState.ts` that only the provider's own map used, and their tests
- Test: `__tests__/providerOnArrangement.test.tsx`; a shared harness `__tests__/helpers/arrangementProvider.tsx` (`renderWithArrangement(tracks, props?)` returning the arrangement, the fake adapter's calls and the usual queries); every existing provider test moves onto it

**Interfaces:**
- Consumes: Task 8, Task 5's `trimPreview`.
- Produces:
  - `WaveformPlaylistProviderProps`: `arrangement: Arrangement` (required); `tracks`, `onTracksChange`, `deferEngineRebuild` removed. The exported provider renders an inner component with `key` tied to the arrangement object, so a new `arrangement` is a new mount of everything below; a development `console.warn` says so the first time the prop changes identity.
  - `useArrangement(): Arrangement` (`ArrangementContext`, WebAudio only, blocked under `MediaElementPlaylistProvider`).
  - `usePlaylistTimeline()`: `{ tracks, peaksDataArray, duration, isReady }` (no `onTracksChange`).
  - `useEditorControls()`: the four mixer setters, `reorderTrack`, `undo`, `redo` call the arrangement and work with no engine attached.
  - `useClipDragHandlers` options: `{ samplesPerPixel, snapSamplePosition? }` plus what it reads from context; `tracks`, `onTracksChange`, `engineRef` removed. Move, trim release and `constrainTrimDelta` call the arrangement.

- [ ] **Step 1: failing tests** in `providerOnArrangement.test.tsx`:
  - "a clip move needs no app wiring: the view shows the moved clip and the adapter got one `updateTrack`"
  - "removing a track during playback makes one `adapter.removeTrack`, builds no engine and keeps `isPlaying`" (#798)
  - "a file added while playing: the row appears with its placeholder, playback continues, the clip is applied on arrival" 
  - "edits and undo work while no engine is attached (during a rebuild) and the new engine plays the result"
  - "a fader step renders what it renders today" (keep the counts of `contextSplitByChangeRate.test.tsx`)
  - "no library subscriber makes a track edit: across load, arrival, drag, split, undo and a recorded take, the fake adapter never receives `setTracks` after its initial one" (QF)
  - "the `arrangement` prop given a new object remounts the tree and warns once"
  - "`usePlaylistTimeline().tracks` never holds a loading clip; the row count of `peaksDataArray[i]` exceeds `tracks[i].clips.length` while one loads"
  - "a click beyond the loaded audio onto a placeholder puts the cursor at `duration`; the view's width covers the placeholder" (Review Focus 7)
  - "export while a clip loads renders the loaded clips only"
  - "the 'clip has no audio data' warning is not written for a loading clip"
- [ ] **Step 2:** run; fails (the prop does not exist).
- [ ] **Step 3:** implement. From the provider remove: `engineTracksRef`, `lastTracksVersionRef`, `suppressTracksMirrorRef`, `skipEngineDisposeRef`, `prevTracksRef`, the `isEngineTracks` and incremental paths, the `deferEngineRebuild` path, the `setTracks([])` path, the `trackMixer` state and `trackMixerRef`, the tracks mirror inside the `statechange` listener, `tracksRef` where the arrangement can be asked instead. `WaveformRoot` adds `placeholdersEnd` to the inputs of `displayDuration`. `SpectrogramProvider` and `useExportWav` keep reading `usePlaylistTimeline().tracks` (loaded clips; check each loop over `track.clips` reads nothing a loaded clip lacks).
- [ ] **Step 4:** move the existing provider tests onto the harness. A test whose subject no longer exists is deleted, not rewritten: the guard, the incremental-add and fill cases, `deferEngineRebuild`, the `onTracksChange` warning, `trackEffectsProp.test.tsx`'s "copied tracks" control. List each deleted test with its reason in the PR text. `engineDisposedOnUnmount.test.tsx` keeps one case per remaining path.
- [ ] **Step 5:** build browser; run the browser, spectrogram, annotations and recording suites as separate commands.
- [ ] **Step 6:** commit `feat(browser)!: WaveformPlaylistProvider takes an arrangement (#812)`.

### Task 10: recording

**Files:**
- Modify: `packages/recording/src/hooks/useIntegratedRecording.ts`, `packages/recording/package.json` (engine as a dependency and a devDependency), `packages/browser/src/WaveformPlaylistContext.tsx` (`setRecordingActive`), `contexts/playlistContexts.ts`, `components/TrackControlsColumn.tsx`, `components/trackContext.ts`, `components/TrackControlPieces.tsx` (`MuteButton`), `hooks/useRecordingSession.ts`
- Test: `packages/recording/src/__tests__/integratedRecordingArrangement.test.tsx`, `packages/browser/src/__tests__/recordingArmMute.test.tsx`

**Interfaces:**
- Produces:
  - `useIntegratedRecording(arrangement: Arrangement, selectedTrackId: string | null, options?: IntegratedRecordingOptions): UseIntegratedRecordingReturn`. A take is added with `arrangement.updateTrack(id, (track) => …)` (one undo step; punch-in carves loaded clips as today). `startRecording` refuses through the hook's `error` when the armed track holds a loading clip, with one message for a source that is pending, one for a load that failed and one for a clip that cannot be made from its audio (read the status and the error from `arrangement.sources`).
  - `setRecordingActive(active, armedTrackId?)`: mutes through `arrangement.setTrackMute`; writes the pre-take value back when the take ends or the armed track changes (QJ), and does nothing for a track that is gone.
  - `RecordingArmContext` with `{ armedTrackId: string | null }` (WebAudio only, blocked under MediaElement; provider state set by `setRecordingActive`). Not exported. The controls part reads it and puts `isRecordingArmed: boolean` into that track's context value, which is public through `useTrack()` (QM); `TrackMuteButton` is disabled while it is true.

- [ ] **Step 1: failing tests.** Recording: "a take is one undo step and undo removes it"; "punch-in over a clip that loaded and was never edited carves it"; "`startRecording` refuses over a pending clip, a failed load and an unusable clip, each with its own message, and records nothing"; "the first take on an empty arrangement adds a track". Browser: "the armed track's mute button shows muted and is disabled during a take, and only that track's slot renders when the take starts"; "the pre-take value is back when the take ends, also after `arrangement.setTrackMute(id, false)` during the take" (Review Focus 4); "changing the armed track mid-session restores the first and mutes the second"; "the armed track removed during a take: the end of the take throws nothing and adds no mixer entry"; "unmount during a take restores the value".
- [ ] **Step 2 to 4:** run (fails), implement, build engine and browser, run both suites. Load the skills `translatable-strings` and `web-design-guidelines` for the disabled button (what it announces, and that the app's `title` still applies).
- [ ] **Step 5:** commit `feat(recording,browser)!: recording works on the arrangement; the armed track shows its mute (#812)`.

### Task 11: removals

**Files:**
- Delete: `packages/browser/src/hooks/useAudioTracks.ts`, `useDynamicTracks.ts`, `buildTrackFromConfig.ts`, their tests, their exports in `hooks/index.ts` and `tone.ts`, `website/src/utils/decodeAudioFiles.ts` once Task 12 has removed its callers
- Modify: `packages/browser/src/__tests__/oneOwnerPerExport.test.ts` if it lists them

- [ ] **Step 1:** `grep -rn "useAudioTracks\|useDynamicTracks\|AudioTrackConfig\|UseAudioTracksOptions\|TrackSource\|TrackLoadError\|UseDynamicTracksReturn\|buildTrackFromConfig" packages --include='*.ts' --include='*.tsx'` (quote the globs): every hit outside the files being deleted is fixed or the removal waits.
- [ ] **Step 2:** delete; build browser; `pnpm typecheck` (full sweep, it is first-fail); the browser suite.
- [ ] **Step 3:** commit `feat(browser)!: useAudioTracks and useDynamicTracks are removed; a track names its audio with audioTrack() (#812)`.

### Task 12: every page, story and starter

**Files (from a grep on `main` at `7378b805`; run it again, `grep -rlE "WaveformPlaylistProvider|useIntegratedRecording|useMidiTracks" website/src examples packages/*/src/stories`):**
`website/src/components/examples/`: `AnnotationsExample`, `BeatsAndBarsExample`, `CustomDragSetupExample`, `EffectsExample`, `FlexibleApiExample`, `MidiExample`, `MinimalExample`, `MirSpectrogramExample`, `MobileAnnotationsExample`, `MobileMultiClipExample`, `MultiClipExample`, `NewTracksExample`, `RecordingExample`, `StemTracksExample`, `StereoExample`, `WamEffectsExample`, `WaveformDataExample`, and any other the grep finds; `website/src/pages/examples/custom-drag-setup.tsx`, `midi.tsx`, `recording.tsx`, `stereo.tsx`, `website/src/pages/index.tsx` (their text and feature lists); `examples/react-starter/src/App.tsx` and `README.md`; `packages/ui-components/src/stories/Hooks.stories.tsx`, `PlaybackControls.stories.tsx`, `Waveform.stories.tsx`.

**The pattern each page follows:**
- `const arrangement = useCreateArrangement(() => configs.map((c) => audioTrack(c)))`; `<WaveformPlaylistProvider arrangement={arrangement}>`; no `useState` of tracks, no copy effect, no `deferEngineRebuild`.
- A dropped file: `arrangement.addTrack(audioTrack({ src: file, name: file.name }))`.
- Failures: the page reads `useArrangementSources(arrangement)`; a dropped file whose source failed is removed with `arrangement.removeTrack(id, { undoable: false })` from an effect over that value and listed; a declared file gets a Retry that calls `arrangement.retry(src)`.
- Loading text: `sources.isLoading` / `pendingCount`.
- Per-track effects stay a provider prop keyed by track id; nothing copies track objects.
- `MidiExample`: `loadMidiTracks` in an effect with an `AbortController`, `addTrack` each, `arrangement.clearHistory()` once (QH); user-dropped `.mid` files are added without clearing.
- `RecordingExample`: `useIntegratedRecording(arrangement, selectedTrackId, options)`.
- A page that needs the loading clips (a list with "loading…" rows) reads `useArrangementTracks(arrangement)`; one that needs loaded clips under the provider reads `usePlaylistTimeline().tracks`.
- Port the converted pages of the backup branch by path where one exists, then replace its `useState` and two props with the arrangement.

- [ ] **Step 1:** convert; after each page `cd website && npx eslint <file>`.
- [ ] **Step 2:** dev server on 3077; open every example route once in a headless browser and assert `[data-playlist-state="ready"]` and an empty console error list (a script in the scratchpad; the routes are `ROUTES` in `e2e/global-setup.ts`).
- [ ] **Step 3:** browser probe on the page with a file drop (`/examples/new-tracks` or the one the grep shows): drop two files that cannot be decoded and count the fake-free adapter calls through the page's engine (`useEngineRefs().playoutRef`): two `removeTrack`, no `setTracks` (Review Focus 6).
- [ ] **Step 4:** commit per group of pages, `docs(website): example pages on an arrangement (#812)`.

### Task 13: e2e

**Files:** the specs that drive a converted page (`e2e/annotations`, `composed-view`, `custom-drag-setup`, `custom-effects`, `effects`, `flexible-api`, `keyboard-focus`, `midi`, `mobile-annotations`, `mobile-multi-clip`, `multi-clip`, `stem-tracks`, `track-controls`, `track-reorder`, `track-selection`, `view-options`, `waveform-data`, and the recording spec if one exists), `e2e/global-setup.ts` only if a route changed.

- [ ] **Step 1:** new tests, each first shown to fail against `main`'s build of the page where that is possible (skill `e2e-playwright`, "proving a new e2e test against the old code"):
  - `waveform-data.spec.ts`: "with every peaks file delayed the page ends with 4 rows of 4"
  - `multi-clip.spec.ts` or the drop page's spec: "a file dropped while playing does not stop playback and plays when it arrives"; "undo after an arrival keeps the arrived clip"; "a source that settles during a trim drag: release trims, Escape leaves the clip" (route the audio request and fulfil it mid-drag)
  - the recording spec: "recording is refused over a clip that is still loading"; "punch-in over a clip that loaded and was never edited carves it"; "the armed track's mute button is disabled and shows muted during a take"
  - `effects.spec.ts`: what it expects of `waveform-playlist:ready` after an effects change is rewritten for "once per mount" (QE); it waits on `[data-playlist-state="ready"]` instead
- [ ] **Step 2:** `lsof` check, then the whole suite as its own command with output to a file; read it. A red test is a signal until rates on this branch and on `main` say otherwise.

### Task 14: docs, changesets, PR 4

**Doc surfaces (root `CLAUDE.md`, "Keep all doc surfaces in sync"), each sentence checked against a source line:**
- `website/docs/llm-reference.md`, `website/static/llms.txt`
- `website/docs/react/api/hooks.md`, `api/components.md`, `api/providers/waveform-playlist-provider.md`
- `website/docs/react/examples.md`, `intro.md`, `getting-started/basic-usage.md`, `getting-started/installation.md`
- guides: `loading-audio.md` (rewritten: `audioTrack()`, sources, retry, ready, placeholders, where a refused track's error lands (QB), the rule of QF), `track-management.md`, `recording.md` (also its inline `useAudioTracks([])` at `:56`), `midi.md`, `effects.md`, `annotations.md`, `beats-and-bars.md`, `composing-the-view.md`, `custom-drag-setup.md`, `fades.md`, `playback-controls.md`, `spectrogram.md`, `theming.md`, `vu-meters.md`; `faust-effects.md`, `wam-plugins.md`
- `website/docs/framework-agnostic/engine.md`: one sentence for QF under "Reading", and a link to the React guide
- `README.md` (root: examples table and snippets), `packages/browser/README.md`, `packages/recording/README.md`, `packages/annotations/README.md`, `packages/spectrogram/README.md`, `packages/midi/README.md`
- `website/docs/react/upgrading.md`, one section each: the `arrangement` prop for `tracks` / `onTracksChange`; `useAudioTracks` / `useDynamicTracks` / `deferEngineRebuild` to `audioTrack()`; `usePlaylistTimeline().onTracksChange` removed; `tracks` holds loaded clips and `peaksDataArray` can hold placeholder rows (`isPlaceholder`); `duration` counts loaded audio; `trackStates` has an entry for every track; `onReady` and the event once per mount, after the first sources; a refused track throws at the call; `useClipDragHandlers` options; `useIntegratedRecording(arrangement, …)`, a take is an undo step, refusal over a loading clip; the armed track shows muted, its button is disabled, the earlier value returns, and `useTrack().isRecordingArmed` for an app's own mute control; undo never changes the mix and survives an engine rebuild; edits work while the engine is rebuilt; export while loading exports loaded clips; inline `onReady` / `onError` no longer rebuild (a fix, listed as a note)
- Before writing how to catch an error, trace where it lands (root `CLAUDE.md`, "Check where an error lands…"): the initializer's throw is a render error; `addTrack`'s throw is the caller's.

- [ ] Write the docs (a docs agent briefed per the skill `review-rounds`, with the list above and the decisions block).
- [ ] The documentation-URL check of root `CLAUDE.md` ("Wrong documentation found on the way…").
- [ ] Changesets: browser `major`, recording `major`, spectrogram and annotations `patch` if their source changed, ui-components per its diff.
- [ ] `PROJECT_STRUCTURE.md` by hand (the new `providerInternals` files, the data flow from the arrangement).
- [ ] Own commands: `pnpm typecheck`, `pnpm lint`, `pnpm build`, `pnpm --filter website build`, the e2e suite on the head commit.
- [ ] Behaviour table for the maintainer: each tree a consumer can build (the provider with an arrangement; `useArrangement()` under each provider and outside; a leftover `tracks` prop in plain JS; a leftover `onTracksChange` read from the timeline value; `useIntegratedRecording` with the old argument order; a `MuteButton` outside a recording page), before and after, with a column "stated in the upgrade guide".
- [ ] Independent review of the final diff (first question: the two-places question); rounds until nothing above low; open "Part 5c of 6 for #812".

---

# PR 5: MIDI removal and the sweep

### Task 15: `useMidiTracks` is removed

**Files:** delete `packages/midi/src/useMidiTracks.ts`, `midiConfigsEqual.ts`, their three test files; modify `packages/midi/src/index.ts`, `packages/midi/package.json` (drop the `react` peer and devDependency if nothing in `src` imports React any more; run `pnpm install` and commit the lockfile).

- [ ] `grep -rn "useMidiTracks\|MidiTrackConfig\|UseMidiTracksOptions\|UseMidiTracksReturn\|midiConfigsEqual" packages website/src website/docs examples README.md --include='*'`: no hit outside the upgrade guide.
- [ ] Docs: `guides/midi.md`, `packages/midi/README.md`, `packages/midi/CLAUDE.md`, `packages/dawcore-midi/README.md` and `CLAUDE.md` where they point at the hook, `llm-reference.md`, `llms.txt`, `api/hooks.md`; upgrade section "`useMidiTracks` to `loadMidiTracks`" with the first-load pattern of QH.
- [ ] `(cd packages/midi && npx vitest run)`, `e2e/midi.spec.ts`. Changeset: midi `major`.
- [ ] Commit `feat(midi)!: useMidiTracks is removed; loadMidiTracks (#812)`.

### Task 16: the notes this work made stale

Each file: remove what describes code that no longer exists, write what replaced it, check each new sentence against a source line.

- `packages/browser/notes/playback-and-engine.md`: "Playlist Loading Detection" (ready once), "Refs for Dynamic Audio Callbacks" (`tracksRef`), "Engine is always persistent", "The Engine Is Disposed on Unmount" (the paths are gone; one effect owns the engine), "Engine Rebuilds vs Playback" (what triggers a rebuild now), "Engine State Subscription Pattern" ("Still React-only: tracks", the seed checklist, `useUndoState`), "End-of-Timeline Semantics" (`setRecordingActive` and the visible mute, QJ), "Incremental Track Addition" (deleted; its #752 rule about per-track props stays, re-stated without the identity fast paths), "Stop Before Clear"
- `packages/browser/notes/contexts.md`: the table rows of `usePlaylistTimeline()`, `usePlaylistMixer()`, `useEngineRefs()`, `useEditorControls()`, `useUndoRedo()`; the context counts; the new `ArrangementContext` and `RecordingArmContext`
- `packages/browser/notes/provider-internals.md`: the list of `providerInternals/` files; the `BLOCKED` lists
- `packages/browser/notes/clip-drag-and-snap.md`, `recording-and-meters.md`, `peaks.md`, `effects-and-export.md`, `track-controls-and-reorder.md`, `view-parts.md`, `midi.md`: every mention the grep of this plan's inventory found
- `packages/browser/CLAUDE.md`: the `/tone` section (the two hooks are gone), "Custom Hooks Architecture", "Fetch Cleanup with AbortController", and a new section "The Provider Plays an Arrangement" with the owner table of this plan as the worked case the memory says is owed
- `website/CLAUDE.md`, "Example Component Guidelines": the `deferEngineRebuild`, `onTracksChange` and `decodeAudioFiles()` rules are replaced by the page pattern of Task 12
- `packages/recording/CLAUDE.md`, `packages/ui-components/CLAUDE.md`, `packages/engine/CLAUDE.md` (the sentence that the React provider "persists mixer state via `trackStates`", and "the React provider calls `setTracks([])`")
- root `CLAUDE.md`: "API Source of Truth" (the `AudioTrackConfig` line, the hook list gains `useArrangement`), "One Owner per Piece of State" (the provider is now a shape that holds one owner), the `(#752)` bullet
- `.claude/skills/design-proposals`, `react-patterns`, `review-rounds`, `unit-testing`, `state-ownership`: examples that name the removed props or hooks are kept as history only where the sentence says "until #812"
- `PROJECT_STRUCTURE.md`, `TODO.md`

- [ ] Write; `pnpm --filter website build` for anything under `website/docs`.
- [ ] Run `revise-claude-md` for this work's learnings, before the merge is asked for.
- [ ] Commit `docs: notes after the provider moved onto an arrangement (#812)`.

### Task 17: working documents, final checks, PR 5

- [ ] `git rm docs/specs/2026-11-13-arrangement-design.md docs/specs/2026-11-13-provider-loads-sources-design.md docs/plans/2026-11-13-arrangement-engine.md docs/plans/2026-11-14-arrangement-react.md`
- [ ] `grep -rn "arrangement-design\|provider-loads-sources-design\|arrangement-engine.md\|arrangement-react.md" . --include='*.md' --include='*.ts' --include='*.tsx'` outside `node_modules`: no hit left.
- [ ] Own commands on the head commit: typecheck, lint, build, website build, e2e.
- [ ] Independent review of the final diff; behaviour table; the PR text is the lasting record of parts 5 and 6: the decisions block of this plan, the tests deleted with reasons, the lows left.
- [ ] PR body: `closes #812`, `closes #791`, `closes #798`, each with its own keyword. After the merge (the maintainer's): `gh issue view <n> --json state` for each; update #848 and #842 with a comment on what changed for them; delete the branches except `feat/812-2-provider-resolution`, which the maintainer is asked about.
- [ ] At the release, not here: the engine's peer floor on core (`>=13.0.0`).
