# Provider-Owned Source Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A clip names its audio and `WaveformPlaylistProvider` loads it; `useAudioTracks`, `useDynamicTracks`, `useMidiTracks` and `deferEngineRebuild` are removed (#812).

**Architecture:** A framework-free `createSourceLoader` in core holds source states. The provider reads it with `useSyncExternalStore` and derives `ClipTrack`s from the app's `tracks` during render in a pure, cached function (the `derivePeaks` pattern); the engine effect runs on the derived list. Everything handed to the app's `onTracksChange` passes one merge that keeps loading clips the engine does not hold.

**Tech Stack:** TypeScript, React 19 (`use`, `useSyncExternalStore`), vitest (jsdom in browser), Playwright, pnpm workspace, changesets.

**Spec:** `docs/specs/2026-11-13-provider-loads-sources-design.md`. Read it first; this plan does not repeat its reasoning.

## Global Constraints

- Read root `CLAUDE.md` and the notes of each package you touch (`packages/core`, `packages/browser/CLAUDE.md`, `packages/engine/CLAUDE.md`, `packages/recording/CLAUDE.md`, `website/CLAUDE.md`) before the first edit.
- No compatibility shims, no deprecated aliases, no hook kept under an old name, nothing that throws for a removed name. Every break gets an entry in `website/docs/react/upgrading.md` (what changed, **Find**, **Replace with**).
- `AudioClip`'s `sampleRate`, `startSample`, `durationSamples`, `offsetSamples`, `sourceDurationSamples` stay required integers. The engine, adapters, peaks and every context value see `AudioClip` only.
- The provider's static import graph stays free of `tone` and `@waveform-playlist/playout` (`staticEngineImports.test.ts`, `coreBarrelEngineFree.test.ts`). New browser files are added to the list in `staticEngineImports.test.ts`.
- No store cleared in an effect cleanup. Contexts are read with `use()` at the top level and provided with `<XContext value>`; every context is named `…Context`.
- No cross-package re-exports; one owner per exported name (`oneOwnerPerExport.test.ts`).
- Immutable updates only. Files under 800 lines; new logic goes in new files, not into `WaveformPlaylistContext.tsx` (1968 lines) beyond wiring.
- Every PR that changes `packages/*/src` adds a changeset (`pnpm changeset`): core `minor` in PR 1; browser, recording, midi, core `major` where an export or a public type is removed or changed.
- Commit messages: `<type>: <description>`, no attribution footer, written with `git commit -F - <<'EOF'`. A test run is its own command, read before the commit.
- Before `pnpm build`, `pnpm test` or a `git checkout`: `lsof -nP -iTCP:3000 -sTCP:LISTEN`. If a server is there that you did not start, do not build under it; use port 3077 (`cd website && pnpm exec docusaurus start --port 3077 --no-open`, then `PORT=3077 pnpm test`).
- Downstream packages resolve core and engine through `dist`: `pnpm --filter @waveform-playlist/core build` before browser typecheck or tests.
- Every new regression test is seen to fail with its guarded line broken, and the reason for the failure is read.
- Never merge. Each PR is opened and left for the maintainer; the independent review covers the final diff.
- Before the last PR merges: `git rm` the spec and this plan, and run `revise-claude-md`.

## Review Focus

1. A `File` dropped twice (two `File` objects for the same file): two keys, two decodes, two tracks; neither blocks the other. Test in Task 9.
2. A source that fails while the engine is empty and others succeed: one step for the others, the failure in `usePlaylistSources()`, `onError` once. Test in Task 9.
3. A loading clip whose `offset` is past the end of the decoded buffer, or `duration` 0 or negative: no clip in the engine, a warning naming the clip, no `NaN` samples. Test in Task 5.
4. The app removes a track while its source is pending: the load is aborted, nothing arrives later, no state update after removal. Test in Task 9.
5. Provider unmounted before the decode context exists: nothing is fetched afterwards, no adapter leaks. Test in Task 9.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `packages/core/src/sourceLoader.ts` (new) | `createSourceLoader`, `SourceState`, `SourceLoader` |
| `packages/core/src/types/clip.ts` | `ClipSource`, `LoadingClip`, `PlaylistTrack`, `AudioClip.src`, `isLoadingClip` |
| `packages/core/src/audioTrack.ts` (new) | `audioTrack()`, `AudioTrackOptions` |
| `packages/browser/src/utils/resolveTracks.ts` (new) | loading clips to `viewTracks` / `engineTracks`, with cache |
| `packages/browser/src/utils/mergeLoadingClips.ts` (new) | the `onTracksChange` merge |
| `packages/browser/src/utils/loadSource.ts` (new) | default fetch and decode |
| `packages/browser/src/utils/incrementalTrackChange.ts` | extended `filled` case |
| `packages/browser/src/providerInternals/useSourceLoading.ts` (new) | loader instance, decode-context promise, wanted-set effect, snapshot, status value |
| `packages/browser/src/contexts/playlistContexts.ts` | `PlaylistSourcesContext`, `usePlaylistSources` |
| `packages/browser/src/WaveformPlaylistContext.tsx` | wiring only |
| `packages/midi/src/loadMidiTracks.ts` (new) | `loadMidiTracks` |

Branches: PR 1 is the current branch `feat/812-provider-loads-sources`. PR 2 is `feat/812-2-provider-resolution`, stacked on it. PR 3 is `feat/812-3-midi`, stacked on PR 2.

---

# PR 1: core

### Task 1: `createSourceLoader`

**Files:**
- Create: `packages/core/src/sourceLoader.ts`
- Modify: `packages/core/src/index.ts` (add `export * from './sourceLoader';`)
- Test: `packages/core/src/__tests__/sourceLoader.test.ts`

**Interfaces:**
- Produces: exactly the `SourceState<V>`, `SourceLoader<K, V>` and `createSourceLoader<K, V>({ load })` of the spec's "The loader" section.

- [ ] **Step 1: Write the failing tests.** Use a fake `load` that records every call as `{ key, signal, resolve, reject }` and keeps ALL pending calls (settling only the latest cannot show an earlier one was cancelled). One test per rule:

```ts
it('starts one load per new wanted key', …)           // setWanted(['a','a','b']) → 2 calls
it('leaves a loaded key alone on the next setWanted', …)
it('drops a key that is no longer wanted: pending is aborted', …)   // calls[0].signal.aborted === true; snapshot has no 'a'
it('drops a key that is no longer wanted: loaded is forgotten', …)
it('suspend aborts pending loads, keeps them pending in the snapshot, keeps loaded values', …)
it('setWanted after suspend starts the suspended keys again', …)     // a second call for 'a'
it('provide marks a key loaded and aborts its load in flight', …)
it('provide is a no-op for a loaded key', …)           // same snapshot object
it('never records an AbortError as failed', …)         // reject(new DOMException('x','AbortError')); assert status by name
it('ignores the late result of an aborted load', …)    // drop 'a', want 'a' again, resolve call 0 → still pending
it('a failed key stays failed until retry', …)         // setWanted again → no new call; retry('a') → new call, pending
it('retry is a no-op for pending and loaded keys', …)
it('getSnapshot returns the same Map until something changes', …)
it('publishes a new Map to subscribers on each change', …)
it('compares object keys by identity', …)              // two Blobs with equal bytes → 2 calls
it('a load that throws synchronously becomes failed', …)
it('a non-Error rejection is wrapped in an Error', …)  // reject('boom') → error instanceof Error, message 'boom'
```

- [ ] **Step 2: Run** `(cd packages/core && npx vitest run src/__tests__/sourceLoader.test.ts)`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement.** Build on `createValueSource` from `./valueSource` for subscribe / snapshot. Per key keep `{ state, controller, token }`; a result is applied only when its token is still the entry's. A suspended key is `status: 'pending'` with no controller.
- [ ] **Step 4: Run the test file.** Expected: PASS.
- [ ] **Step 5: Break three guarded lines one at a time** (the token comparison, the AbortError check, the abort in `suspend`), run, read the failing test name, restore. `git status --short` clean of leftovers.
- [ ] **Step 6: Commit** `feat(core): createSourceLoader (for #812)`.

### Task 2: the clip types and `isLoadingClip`

**Files:**
- Modify: `packages/core/src/types/clip.ts`
- Test: `packages/core/src/__tests__/clip.test.ts`

**Interfaces:**
- Produces: `ClipSource`, `LoadingClip`, `PlaylistTrack`, `isLoadingClip`, and `src?: ClipSource` on `AudioClip`, exactly as in the spec's "The types" section.

- [ ] **Step 1: Tests.**

```ts
it('isLoadingClip is true for a clip without sampleRate', () => {
  expect(isLoadingClip({ id: 'c', src: 'a.mp3' })).toBe(true);
});
it('isLoadingClip is false for an AudioClip, also one that carries src', () => {
  expect(isLoadingClip({ ...createClip({ … }), src: 'a.mp3' })).toBe(false);
});
it('a ClipTrack is assignable to PlaylistTrack', () => {
  const t: PlaylistTrack = createTrack({ name: 'x', clips: [] }); // typecheck is the assertion
  expect(t.clips).toEqual([]);
});
```

- [ ] **Step 2: Run, see FAIL. Step 3: Implement** (`isLoadingClip` is `!('sampleRate' in clip) || clip.sampleRate == null`). **Step 4: Run, PASS**, then `pnpm --filter @waveform-playlist/core build && pnpm typecheck`.
- [ ] **Step 5: Read every engine operation that copies a clip** (`packages/engine/src/operations/*`, `PlaylistEngine.ts`: split, trim, move, carve, undo snapshots) and add one engine test per operation asserting `src` is still on the result. Fix any that builds a clip field by field. Report what was found in the PR text.
- [ ] **Step 6: Commit** `feat(core): LoadingClip, PlaylistTrack, AudioClip.src (for #812)`.

### Task 3: `audioTrack()`

**Files:**
- Create: `packages/core/src/audioTrack.ts`; export from `index.ts`
- Test: `packages/core/src/__tests__/audioTrack.test.ts`

**Interfaces:**
- Produces:

```ts
export interface AudioTrackOptions {
  id?: string; clipId?: string; name?: string;
  src?: ClipSource; audioBuffer?: AudioBuffer; waveformData?: WaveformDataObject;
  start?: number; duration?: number; offset?: number;
  fadeIn?: Fade; fadeOut?: Fade; gain?: number; color?: string;
  muted?: boolean; soloed?: boolean; volume?: number; pan?: number;
  renderMode?: RenderMode; spectrogramConfig?: SpectrogramConfig; spectrogramColorMap?: ColorMapValue;
}
export function audioTrack(options: AudioTrackOptions): PlaylistTrack;
```

- [ ] **Step 1: Tests:** with `src` → one loading clip carrying `src`, `start`, `duration`, `offset`, fades, `waveformData`, and a generated id; `id` / `clipId` given are used; an empty-string `id` counts as none; with `audioBuffer` → one `AudioClip` (not loading) with that buffer; with `waveformData` and no `src` → an `AudioClip` whose `sampleRate` is `waveformData.sample_rate`; with none of the three → throws `audioTrack: give src, audioBuffer or waveformData`; with `src` AND `audioBuffer` → an `AudioClip` with both (nothing to load); track fields default to `muted: false, soloed: false, volume: 1, pan: 0`; name defaults to the file name of a string `src` without its extension, a `File`'s name without extension, else `'Untitled'`.
- [ ] **Step 2–4:** fail, implement over `createTrack` / `createClipFromSeconds`, pass.
- [ ] **Step 5: Docs for PR 1:** add the new types and functions to `website/docs/llm-reference.md` and one line each to `website/static/llms.txt`; `pnpm --filter website build` (port check first).
- [ ] **Step 6:** `pnpm changeset` (core: minor), `pnpm lint`, `pnpm typecheck`, core vitest. Commit `feat(core): audioTrack (for #812)`.
- [ ] **Step 7: Independent review of the PR 1 diff** (give the reviewer the spec and the diff, not a summary), fix, repeat until a round finds nothing above low. Open the PR: "Part 1 of 3 for #812" (no closing keyword). Leave it.

---

# PR 2: browser

### Task 4: two facts to establish before building

- [ ] **Step 1: Is `engine.updateTrack` on a playing track audible?** A scratch probe (`probes/updatetrack812.cjs`, port 3077, `/examples/multi-clip`): tap the master output with an `AnalyserNode` shim on `AudioNode.prototype.connect` (injected before load), start playback with real input, then from the page call the engine's `updateTrack` for a track that is sounding with one more clip placed later on the timeline; record the RMS in 20 ms windows across the call. Compare with a run that makes no call. Run both five times.
- [ ] **Step 2: Report the result to the maintainer in chat**, saying what was run. If the call is audible (a gap or a restart), STOP: the extended `filled` case of Task 7 needs their decision before it is built.
- [ ] **Step 3: Read `BeatsAndBarsExample.tsx`** for how it positions clips (seconds or ticks). If ticks: `LoadingClip` has no tick field; tell the maintainer and propose that the page keeps decoding itself and sets its state once when all buffers are in, with `AudioClip`s. Do not add a field without asking.

### Task 5: `resolveTracks`

**Files:**
- Create: `packages/browser/src/utils/resolveTracks.ts`
- Test: `packages/browser/src/utils/__tests__/resolveTracks.test.ts`

**Interfaces:**
- Consumes: `PlaylistTrack`, `LoadingClip`, `isLoadingClip`, `SourceState`, `createClip` from core.
- Produces:

```ts
export interface ResolvedTracks {
  viewTracks: ClipTrack[];
  engineTracks: ClipTrack[];
  cache: ResolveCache; // opaque; pass back in
}
export const EMPTY_RESOLVE_CACHE: ResolveCache;
export function resolveTracks(
  tracks: PlaylistTrack[],
  sources: ReadonlyMap<ClipSource, SourceState<AudioBuffer>>,
  sampleRate: number,
  previous: ResolveCache
): ResolvedTracks;
/** Tell the cache that `input` resolves to `engineTrack` (used by the merge). */
export function seedResolved(cache: ResolveCache, input: PlaylistTrack, engineTrack: ClipTrack): ResolveCache;
```

- [ ] **Step 1: Tests** (fake `AudioBuffer`: `{ sampleRate, length, duration, numberOfChannels }`):
  - loaded, 44100 Hz buffer, `{ start: 1.5, offset: 0.5, duration: 2 }` → `startSample 66150`, `offsetSamples 22050`, `durationSamples 88200`, `sampleRate 44100`, `sourceDurationSamples === buffer.length`, same `id`, `audioBuffer`, `src`, name, gain, fades, color, `waveformData` carried.
  - no `duration` → `durationSamples === buffer.length - offsetSamples`.
  - `duration` past the end → cut to the end, one `console.warn` naming the clip id.
  - `offset` past the end, or `duration <= 0` → no clip in either list, one warning, no `NaN` anywhere (Review Focus 3).
  - pending with `duration: 3`, rate 48000 → placeholder in `viewTracks` (`durationSamples 144000`, no `audioBuffer`), absent from `engineTracks`.
  - pending with `waveformData` and no `duration` → placeholder at `waveformData.sample_rate` with its duration.
  - pending with neither → in neither list; the track is in both, with the other clips.
  - failed → as pending.
  - a track with no loading clip → the same object in both lists.
  - identity: the same inputs twice → the same track objects and the same two arrays; one source settling → only the tracks naming it are new objects; a new input object for an unchanged track → new resolved track but the SAME resolved clip objects (cached per loading clip and buffer).
  - `seedResolved`: after seeding, `engineTracks` holds the seeded object for that input.
  - a loading clip on a `kind: 'midi'` track → left out, listed in `ResolvedTracks.rejected: { trackId, clipId }[]` (add this field).
- [ ] **Step 2–4:** fail, implement (WeakMaps keyed by loading-clip object and by input track object), pass.
- [ ] **Step 5:** break the buffer-rate conversion (use `sampleRate` argument in place of the buffer's) and the array-identity reuse; see each fail. Commit `feat(browser): resolveTracks (for #812)`.

### Task 6: `mergeLoadingClips`

**Files:**
- Create: `packages/browser/src/utils/mergeLoadingClips.ts`
- Test: `packages/browser/src/utils/__tests__/mergeLoadingClips.test.ts`

**Interfaces:**
- Produces:

```ts
/**
 * `outgoing`: tracks about to be handed to the app (the engine's, or a drag
 * handler's copy of the view's). `latest`: the current `tracks` prop.
 * `placeholderIds`: clip ids that are placeholders in the current view.
 */
export function mergeLoadingClips(
  outgoing: ClipTrack[],
  latest: PlaylistTrack[],
  placeholderIds: ReadonlySet<string>
): PlaylistTrack[];
```

- [ ] **Step 1: Tests:** a track with nothing to remove or put back is the same object; a placeholder clip in `outgoing` is removed and its loading clip put back; a loading clip whose id is absent from the outgoing track is appended after the others, in its order in `latest`; a loading clip whose id IS present (resolved in the engine) is not put back; a track in `latest` that `outgoing` lacks is NOT re-added (the engine removed it); a track in `outgoing` unknown to `latest` passes through; when no track changed, the `outgoing` array itself is returned.
- [ ] **Step 2–4:** fail, implement, pass. Commit `feat(browser): mergeLoadingClips (for #812)`.

### Task 7: extended `filled` in `incrementalTrackChange`

Only after Task 4 Step 2 allows it.

**Files:** `packages/browser/src/utils/incrementalTrackChange.ts`, its test file.

- [ ] **Step 1: Tests:** previous clips `[a]`, current `[a, b]` (same `a` object) → `filled`; current `[a2, b]` (another object with a's id) → `null`; current `[b]` → `null`; current `[a]` in a new track object → `null` (nothing gained; as today); the existing empty-to-clips case still `filled`.
- [ ] **Step 2–4:** fail, implement, pass. Update the function's doc comment. Commit.

### Task 8: default `loadSource`

**Files:**
- Create: `packages/browser/src/utils/loadSource.ts`; test beside it.

**Interfaces:**
- Produces:

```ts
export type LoadSource = (
  src: ClipSource,
  context: { signal: AbortSignal; audioContext: BaseAudioContext }
) => Promise<AudioBuffer>;
export const defaultLoadSource: LoadSource;
```

- [ ] **Step 1: Tests** (fake `fetch`, fake `decodeAudioData`): string → `fetch(src, { signal })`; a `404` → rejects with `Failed to fetch <src>: 404 <statusText>`; a Blob → `arrayBuffer()` and no fetch; aborted between the fetch and the decode → rejects with `name === 'AbortError'` and `decodeAudioData` is not called; a decode rejection propagates as an `Error`.
- [ ] **Step 2–4:** fail, implement, pass. Add the file to `staticEngineImports.test.ts`. Commit.

### Task 9: provider wiring

**Files:**
- Create: `packages/browser/src/providerInternals/useSourceLoading.ts`
- Modify: `packages/browser/src/WaveformPlaylistContext.tsx`
- Test: `packages/browser/src/__tests__/providerLoadsSources.test.tsx` (template: `trackControlsDisabledWhileLoading.test.tsx` for mounting; `createAdapter` fake with a counting `dispose`; `loadSource` prop as the fake loader, keeping every pending call)

**Interfaces:**
- Consumes: Tasks 1, 5, 6, 7, 8.
- Produces: provider props `tracks: PlaylistTrack[]`, `onTracksChange?: (tracks: PlaylistTrack[]) => void`, `loadSource?: LoadSource`; `deferEngineRebuild` gone. `useSourceLoading({ tracks, loadSource, getDecodeContext })` returns `{ sources, status }` where `status` is the `usePlaylistSources()` value of Task 10.

- [ ] **Step 1: Write the tests** (each asserts through the fake adapter's calls, the `waveform-playlist:ready` event count on `window`, the fake `loadSource` calls and what `onTracksChange` received):
  1. mount with two loading tracks: nothing reaches the adapter until both settle; then ONE full build, one ready event, `onReady` once.
  2. inline `tracks` array rebuilt on every parent render (objects kept in a ref, array new): one `loadSource` call per source, bounded renders (assert a render counter stays under 20).
  3. two clips naming one URL: one call; both resolved clips share the `AudioBuffer`.
  4. `<StrictMode>`: sources load; each source is requested at most twice and decoded results are used once (no duplicate tracks).
  5. one source fails while the engine is empty: one build with the others, `onError` once, status shows `failed`; `retry` then loads it and it enters with NO second ready event (Review Focus 2).
  6. after the first build, a track with a pending loading clip is appended: `adapter.addTrack` with no clips at once, no rebuild; on settle `updateTrack`, no ready event; `clearHistory` observed through `useUndoRedo().canUndo === false`.
  7. a trim (drive `engine.trimClip` through the editor controls or the fake's statechange) on a loaded track while another track's source is pending: `onTracksChange` receives the loading clip still in place; feeding that array back as the prop causes no rebuild and no adapter call.
  8. a source settles while `isDraggingRef.current` is true: after the drag ends it is applied (`updateTrack`), no rebuild.
  9. the app removes a track whose source is pending: that call's `signal.aborted` is true; resolving it later changes nothing (Review Focus 4).
  10. unmount before the decode context resolves: `loadSource` is never called; the adapter, if created, is disposed once (Review Focus 5).
  11. two different `File` objects with equal contents: two calls, two tracks (Review Focus 1).
  12. a clip in the prop with `src` and `audioBuffer`: no `loadSource` call; status shows it loaded; a loading clip for the same `src` added later resolves with that buffer, no call.
  13. `play()` while loading into an empty engine does nothing: after the build `isPlaying` is false and the adapter's `play` was not called.
  14. `loadSource` given as a new inline function on every render: no extra calls.
  15. hidden then revealed (`<Activity mode>` toggled): loaded sources are not requested again; a load that was in flight is requested again once.
- [ ] **Step 2: Run, see them fail** for the reason each names.
- [ ] **Step 3: Implement `useSourceLoading`.** The loader in a ref created once. Its `load` awaits `getDecodeContext()` then calls `loadSourceRef.current ?? defaultLoadSource`. An effect keyed on the wanted set (derive the set during render; compare with the previous set's members so an equal set is the same object): body `provide` for each clip with `src` + `audioBuffer`, then `setWanted`; cleanup `suspend`. Snapshot through `useSyncExternalStore(loader.subscribe, loader.getSnapshot)`.
- [ ] **Step 4: The decode context.** Restructure so the context is available before a build with tracks, within the spec's limits ("The decode context"). Recommended shape: the adapter is created once per engine lifetime ahead of the wait, held in a ref with a promise, and the full build uses that adapter in place of creating one; default engine goes through `resolvePlayoutAdapter` unchanged. `createAdapter` call count must equal engine builds (assert in test 1 and in a rebuild test).
- [ ] **Step 5: Wire the provider.** `resolveTracks` in a `useMemo` over `[tracksProp, sources, sampleRate]` with the cache in a ref (as `peaksCacheRef`). Replace every internal read of `tracks` with `viewTracks` (peaks, duration, mixer, timeline value, `tracksRef`) except the engine effect and the incremental comparison, which use `engineTracks`. Add the empty-engine wait where `deferEngineRebuild` returned. In the drag branch do not record the new `engineTracks` as applied. Wrap the app's `onTracksChange` once (`mergeLoadingClips`, then `seedResolved`, then store the merged array in `engineTracksRef`) and use the wrapped function in the statechange handler AND in the `usePlaylistTimeline()` value. Report `rejected` clips and failed sources through `onError`, once each. The "no audio data" warning skips placeholders.
- [ ] **Step 6: Run the new file and the whole browser suite** (`(cd packages/browser && npx vitest run > <a file in your scratchpad>)`; read the summary and every failure). Rewrite the three unit tests that set `deferEngineRebuild` over loading clips with a held-back `loadSource`.
- [ ] **Step 7: Break each guarded line** (the wait, the merge in the timeline value, the merge in the statechange handler, the seed, the drag branch, `suspend` replaced by dropping, `provide`) and see a named test fail for each. A survivor is reported with every caller that reaches the line.
- [ ] **Step 8:** `pnpm lint`, `pnpm typecheck`, `pgrep -f vitest`. Commit `feat(browser)!: the provider loads the sources its clips name (#812)`.

### Task 10: `usePlaylistSources()`

**Files:** `packages/browser/src/contexts/playlistContexts.ts`, `WaveformPlaylistContext.tsx`, `MediaElementPlaylistContext.tsx` (blocked list), `packages/browser/src/index.tsx`; tests `contextSplitByChangeRate.test.tsx`, `sharedPlaybackInterface.test.tsx`.

**Interfaces:**
- Produces: `PlaylistSourcesContext` and `usePlaylistSources()` returning the spec's "Loading status" value. `sources` maps each wanted source to `{ status, error? }` (no buffers in it).

- [ ] **Step 1: Tests:** exact fields; the value keeps its identity while no source changes state (a trim, a zoom, play); a reader renders once per settle and not on a mixer or selection change; `retry` keeps its identity for the provider's life; the hook throws the blocked-hook message under `MediaElementPlaylistProvider`, nested both ways.
- [ ] **Step 2–4:** fail, implement, pass. Commit.

### Task 11: placeholders are not editable

- [ ] **Step 1: Read every clip handler** for what it does with a clip id the engine does not know: `useClipDragHandlers` (move, both trims), `useClipSplitting`, `KeyboardShortcuts`, fades, `ClipInteractionProvider`'s collision code, `useExportWav`. Write the list (handler, file:line, what happens today) into the PR text.
- [ ] **Step 2: Tests first, then the change:** `ClipPeaks` gains `isPlaceholder` (add it to `sameClipPeaks`); `ClipView` renders a placeholder with dragging and trim handles off and `data-clip-placeholder="true"`; split and the shortcuts skip a placeholder; export leaves it out. A track whose clips are all placeholders has disabled controls (extend `trackControlsDisabledWhileLoading.test.tsx`).
- [ ] **Step 3:** Commit.

### Task 12: removals and conversions

- [ ] **Step 1: Delete** `hooks/useAudioTracks.ts`, `hooks/useDynamicTracks.ts`, `hooks/buildTrackFromConfig.ts`, their tests and their exports in `tone.ts`. Retype `useIntegratedRecording(tracks, setTracks)` in `packages/recording` to `PlaylistTrack[]` (read how it builds clips; it must pass loading clips through untouched; test that).
- [ ] **Step 2: Convert, one commit per group, pressing the controls after each** (`probes/exercise687.cjs 3077 <route…>`; restart the 3077 server after any build): the six pages that copy tracks in an effect (`StemTracksExample`, `EffectsExample`, `FlexibleApiExample`, `WamEffectsExample`, `MirSpectrogramExample`, `examples/react-starter`), then `BeatsAndBarsExample` (per Task 4 Step 3), `MinimalExample`, `NewTracksExample` (file drop: `setTracks((prev) => [...prev, audioTrack({ src: file })])`), `StereoExample`, `WaveformDataExample`, the recording example, `website/src/utils/decodeAudioFiles.ts` (delete if unused), the three Storybook stories. `tracks` state is initialised once (`useState(() => [...])` or module level), never built in render.
- [ ] **Step 3: Search** `git grep -n -e useAudioTracks -e useDynamicTracks -e deferEngineRebuild -e AudioTrackConfig -- packages website/src examples debug e2e` (quote globs; no `\b` with `git grep -E`). Every hit outside docs is fixed. Search the destructurings of the removed hooks' return fields too (`loading`, `loadedCount`, `errors`) in the converted pages.
- [ ] **Step 4: e2e.** New tests: "a file dropped while playing keeps playing and does not rebuild" (`e2e/newtracks` spec: count `waveform-playlist:ready` after the page is ready; the new track's signal is asserted with the master-output analyser after the decode); "first load is one build" on `/examples/stem-tracks`. See each fail against the old behaviour where one exists, and say which of attribute or behaviour the failing run proved. Then the full suite on the head commit, with a clean tree and nothing editing source: `PORT=3077 pnpm test`.
- [ ] **Step 5: Render counts.** `probes/track687.cjs` and `trim767.cjs` on multi-clip, stem-tracks, effects before and after; report the table, each number marked measured.
- [ ] **Step 6:** Commit(s).

### Task 13: docs for PR 2

- [ ] **Step 1:** Rewrite every page in the issue's "Doc surfaces" list that names the two audio hooks or `deferEngineRebuild`; the upgrade guide gets one section per break (the two hooks with a removed-to-replacement table for their return fields, `deferEngineRebuild`, `PlaylistTrack` in `onTracksChange` and in `useIntegratedRecording`, placeholders, mixer fields as starting values). `llm-reference.md`, `llms.txt`, `api/hooks.md`, the provider API page (`loadSource`, `usePlaylistSources`), package READMEs, root README, `examples/react-starter/README.md`.
- [ ] **Step 2:** Package notes: `packages/browser/CLAUDE.md` (a section for source loading; the context table and counts; remove the hooks from the `/tone` list and the hooks list; "Incremental Track Addition"), `website/CLAUDE.md` (the two guidelines that name `deferEngineRebuild` and `decodeAudioFiles`), root `CLAUDE.md` API source-of-truth list, `PROJECT_STRUCTURE.md` by hand.
- [ ] **Step 3:** `pnpm --filter website build`. A read-only agent checks each new doc sentence against a source line and lists public exports the diff removed; give it the doc files and source files.
- [ ] **Step 4:** Changesets (browser major, recording major, core as needed). Independent review rounds on the final diff until nothing above low; behaviour-change table (each consumer tree, before and after, "stated in the upgrade guide") sent to the maintainer in chat. Open the PR as "Part 2 of 3 for #812". Leave it.

---

# PR 3: midi

### Task 14: `loadMidiTracks`

**Files:**
- Create: `packages/midi/src/loadMidiTracks.ts`; test beside the existing ones
- Delete: `useMidiTracks.ts`, `midiConfigsEqual.ts`, their tests; update `index.ts`

**Interfaces:**
- Produces:

```ts
export interface LoadMidiTracksOptions {
  sampleRate: number;
  flatten?: boolean; start?: number; duration?: number; name?: string;
  signal?: AbortSignal;
}
export function loadMidiTracks(
  src: string | Blob,
  options: LoadMidiTracksOptions
): Promise<ClipTrack[]>;
```

- [ ] **Step 1: Read `useMidiTracks.ts` fully** and list every behaviour it has (naming of tracks, `flatten`, channel and program on clips, duration from the last note, the `kind: 'midi'` track). Each becomes a test of `loadMidiTracks` with the same expected values.
- [ ] **Step 2: More tests:** a URL goes through `parseMidiUrl`, a `File` / `Blob` through `parseMidiFile` (verify both names and signatures in `@dawcore/midi`'s source, not from a grep of call sites); an aborted `signal` rejects with `name === 'AbortError'` and returns no tracks; a non-finite or non-positive `sampleRate` throws before any fetch; two calls give different ids; a file with no notes resolves to `[]`.
- [ ] **Step 3–4:** fail, implement, pass.
- [ ] **Step 5: Convert** `MidiExample`, `pages/examples/midi.tsx`, `debug/standalone-midi`, stories; press the controls; e2e for the MIDI page.
- [ ] **Step 6: Docs:** `midi.md`, the `midi` and `dawcore-midi` READMEs, upgrade guide section, `llm-reference.md`, `llms.txt`. Changeset (midi major).
- [ ] **Step 7: The sweep.** `git grep -n -e useAudioTracks -e useDynamicTracks -e useMidiTracks -e deferEngineRebuild -e AudioTrackConfig -e MidiTrackConfig -e midiConfigsEqual -- . ':!website/docs/react/upgrading.md' ':!.changeset'` prints nothing. Check every documentation URL against the doc files that exist (root `CLAUDE.md` has the recipe).
- [ ] **Step 8:** `git rm` the spec and this plan. Run `revise-claude-md`. Full `PORT=3077 pnpm test` on the head commit. Independent review rounds. Open the PR as "Part 3 of 3 for #812" with `closes #812` on its own line. After the merge the maintainer does, check `gh issue view 812 --json state`.
