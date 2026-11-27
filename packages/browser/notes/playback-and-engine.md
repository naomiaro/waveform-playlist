# Playback, the engine's lifetime and loading

Notes of Browser Package (`@waveform-playlist/browser`), moved out of the package's `CLAUDE.md`. Read before changing how the provider builds, rebuilds or disposes the engine, how the arrangement's tracks reach it, play / pause / stop / seek, the animation loop, or the end of the timeline.

## Shared Animation Frame Loop Hook

**Decision:** Centralize requestAnimationFrame lifecycle logic in a shared hook used by both playlist providers.

**Implementation:**

- Hook: `src/hooks/useAnimationFrameLoop.ts`
- Exported from: `src/hooks/index.ts`
- Integrated into:
  - `src/WaveformPlaylistContext.tsx`
  - `src/MediaElementPlaylistContext.tsx`

**Why:**

- Removes duplicated `requestAnimationFrame` / `cancelAnimationFrame` logic across providers
- Ensures a single in-flight animation frame per provider
- Standardizes cleanup on unmount and playback transitions

## Playlist Loading Detection

Three ways to see that the playlist is ready (`WaveformPlaylistProvider`; under `MediaElementPlaylistProvider` there is no event; the attribute is always `"ready"`, see "Two Roots Over One Frame and the Same Parts", and the hook is `useMediaElementTrack().isReady`):

1. **Data Attribute** — `[data-playlist-state="ready"]` for CSS and E2E tests (Playwright `waitForSelector`); set on `Playlist`'s wrapper by `useWaveformFrame` for both roots (`WaveformRoot` passes `isReady ? 'ready' : 'loading'`)
2. **Custom Event** — `waveform-playlist:ready` (CustomEvent with `detail: { trackCount, duration }`: every track of the arrangement, and the end of the loaded audio) for external integrations
3. **React Hook** — `isReady` from `usePlaylistTimeline()` for internal components

**Ready happens once per mount (#812, `providerInternals/useReadyOnce.ts`).** The provider owns `isReady` and "ready has fired".

- `isReady` is `isEngineAttached && (hasBeenReady || pendingCount === 0)`, with `pendingCount` from `useArrangementSources(arrangement)`. Until the first ready it is false while no engine is attached or a source of the arrangement is pending; a file added during the first load extends the wait. After the first ready it is "an engine is attached": false while a later engine is being built, true when that engine is assigned, whatever is still loading then.
- `onReady` and the event fire once, at that first time (`firedRef`): not after a rebuild, a StrictMode remount or an `<Activity>` hide and reveal. `onReady` is read from a ref when it is called, so a new function identity builds nothing.
- A failed source counts as settled and is not reported through `onError`. An `onReady` that throws is written to the console and given to `onError`.
- `play()` and `playAnnotation` do nothing before the first ready and queue nothing (`refusePlayBeforeFirstReady()`, one console warning per mount in a development build). The "first ready has happened" ref is written in an insertion effect, so a descendant that calls `play()` from a layout effect of the commit that brings the first `isReady` is not refused (a layout effect in the provider ran after the descendants' and refused theirs). Edits, the mixer, `seekTo` and the selection work before the first ready.

Tests: `readyOnce.test.tsx`, `playBeforeFirstReady.test.tsx`.

**Applied in:** `providerInternals/useReadyOnce.ts`, `WaveformPlaylistContext.tsx`, `waveformFrame.tsx`, `WaveformRoot.tsx`, ui-components' `Playlist.tsx`, all E2E tests

## Refs for Dynamic Audio Callbacks

**Problem:** useCallback with state dependencies creates stale closures when callbacks are stored and called later.

**Solution:** Store current state in a ref, read from ref inside callback:

```typescript
const tracksRef = useRef(tracks);
tracksRef.current = tracks; // Update on every render

const selectTrack = useCallback((index: number) => {
  const current = tracksRef.current; // Fresh state
}, []); // Stable function - no dependencies
```

**Applied in:** `WaveformRoot` (`selectTrack` reads `tracksRef`), `ClipInteractionProvider` (`getTracks` for the modifiers and the track selection on drag start), and in the provider for `isPlayingRef`, `durationRef`, `trackEffectsRef` and `soundFontCacheRef`. The provider has no `tracksRef` since #812: code that changes tracks (`useClipDragHandlers`, `useClipSplitting`, `useArrangementEditing`) calls the arrangement, and reads `arrangement.getTracks()` when it runs. The effects hooks used a ref until #679; their state now lives in an `EffectsRack` store read at call time (see "Audio Effects Architecture").

## Smooth Playback Animation Pattern

**Problem:** React state updates during playback cause flickering. Components need 60fps updates.

**Solution:** Single `requestAnimationFrame` loop in `WaveformPlaylistContext` drives all visual updates via the **Animation Frame Registry**. Components register per-frame callbacks via `registerFrameCallback(id, cb)` / `unregisterFrameCallback(id)` from `usePlaybackRefs()`. Direct DOM manipulation via refs — no `setState` in the loop.

**FrameData:** The animation loop computes `FrameData { time, visualTime, sampleRate, samplesPerPixel }` once per frame and passes it to all registered callbacks. Callbacks must read `sampleRate`/`samplesPerPixel` from `FrameData`, not from closed-over render values — avoids stale closures during zoom changes.

**Consumers:** `AnimatedPlayhead`, `AudioPosition` and `ChannelWithProgress`'s `ClipProgress` (id: `useId()` — unique per instance; the registry is a `Map`, so two components under one id replace each other). Auto-scroll uses `visualTime` directly in the loop body. The MediaElement provider has the same registry since #769, reached through `usePlaybackRefs()` since #688, part 2, with `visualTime` equal to `time`.

**Per-frame annotation lookups** in both providers' loops go through `createAnnotationLookup()` (`src/utils/annotationLookup.ts`): `atTime` / `byId` return exactly what the `find` calls they replaced returned, cached against the annotations array's identity (so annotations must be replaced, not mutated). `atTime` only uses the cached hit and binary search when the list is sorted and non-overlapping; otherwise it falls back to the linear scan, because with overlaps "first match" depends on index order.

**Do NOT add new rAF loops for visual playback updates.** Register a frame callback instead. Use `visualTime` for DOM positioning, `time` for state/logic.

**Loop handling:** Looping is handled natively by Tone.js Transport (`Transport.loop`/`loopStart`/`loopEnd`). The animation loop does NOT detect loop boundaries — `Transport.seconds` auto-wraps, so `getPlaybackTime()` returns the correct position. Selection/annotation playback disables Transport loop; `stop()` disables it before stopping.

**AudioContext Init Pattern:** `audioInitializedRef` guards `engine.init()` (AudioContext resume via `Tone.start()`). Only the first play call awaits init; subsequent plays skip it entirely — no microtask yield. Set to `false` at the start of every engine build (`buildEngine` in `providerInternals/useEngineLifetime.ts`). This keeps the stop→play path fully synchronous after first play, preventing audio layering race conditions.

**The engine is built on mount, not for a track change (#812).** `useEngineLifetime` builds a `PlaylistEngine` and its adapter on the provider's arrangement when the provider mounts, also for an arrangement with no tracks, and builds another only when `effects` changes identity or `zoomLevels` changes content. Adding, removing or replacing tracks builds nothing: the engine follows the arrangement (`engineLifetime.test.tsx`, "`addTrack`, `removeTrack` and `setTracks([])` on the arrangement build nothing (#798)"). So a first take recorded into an empty timeline never waits for an engine build; until the engine was kept on an empty timeline, the overdub `play()` could win the race against the rebuild and do nothing (the "frozen recording playhead"). Lazy _module_ loading (dynamic import, #510) is unchanged: `resolvePlayoutAdapter` is awaited inside the build.

## The Engine Is Disposed on Unmount (#811)

One effect builds the engine and its cleanup disposes it: the build effect of `providerInternals/useEngineLifetime.ts` (#812). Its cleanup marks the run cancelled, stops the animation loop and calls `disposeEngineKeepingPlayback()`, which disposes the engine and nulls `engineRef` and `adapterRef`. Nothing else in the provider builds or disposes an engine.

History, as the lesson: until #812 the provider's loading effect had several paths (an engine clip operation, an incremental add, an emptied timeline, a deferred rebuild, a full build) and only the full build returned a cleanup. React replaces the previous run's cleanup with nothing, so an unmount after any other path disposed nothing (#811, then fixed with a second, unmount-only effect). An effect that owns a resource returns its cleanup on every path.

- **What runs the build effect:** the mount, a new `effects` function, and other zoom levels (`zoomLevels?.join(',')`: an inline array with the same content builds nothing). The arrangement is in the dependencies but does not change within a mount: a new `arrangement` object gives the provider's body a new key (`providerInternals/arrangementIdentity.ts`), so everything below mounts again, with one console warning in development. `createAdapter`, the `sampleRate` prop, `soundFontCache`, `trackEffects` and the current `samplesPerPixel` are read when a build runs; `onReady` and `onError` when they are called. None of them is a reason to build.
- **The cleanup also runs on a StrictMode remount, Fast Refresh and an `<Activity>` hide.** The effect then runs again and builds a new engine on the same arrangement. Tracks, mix and undo history are the arrangement's and are untouched by a rebuild (`engineLifetime.test.tsx`: after a new `effects` function they "are the same objects afterwards"; an edit made while hidden is played after the reveal, `engineDisposedOnUnmount.test.tsx`).
- **`isEngineAttached`** (what `useReadyOnce` reads) is the state `isEngineAttached` AND `engineRef.current !== null`. The state goes false only when a build starts, so after a cleanup that disposed without a new build yet (an `<Activity>` hide) it is still true; the ref is null from every dispose on, so a render never sees an engine that is gone. Clearing the state in the cleanup instead left published tracks stale after a reveal (the comment at the return of `useEngineLifetime`).
- **An `<Activity>` hide during playback stops the audio; the reveal rebuilds and resumes from where it was hidden** (maintainer's choice A, 2026-11-13; `disposeEngineKeepingPlayback()` queues the resume and the resume effect starts it on the new engine's epoch). Keeping the engine alive while hidden cannot coexist with disposing on unmount: a cleanup cannot tell the two apart. An unmount during playback disposes the playing adapter; that this silences the Tone path is read from `TonePlayout.dispose()` (it stops the transport), not run in a browser.
- **`getAudioContextTime()` / `getOutputLatency()` read 0 while no engine exists** (they read `adapterRef`), from the dispose until the new adapter is assigned.
- **A build that was superseded or unmounted is silent.** An adapter that resolves after its run was cancelled is disposed and nothing else happens; a failure of a cancelled run is reported neither to the console nor to `onError`. A failure of the current build disposes what it made, clears a queued play, calls `onBuildFailure` (playback that showed as running shows stopped), writes one `console.error` and calls `onError`.
- **The decode context is attached by the provider, once per mount** (`useDecodeContext` in the same file: `attachDecodeContext(arrangement, getDecodeContext)` in an effect, detached in its cleanup, which aborts the loads in flight). The getter returns the current adapter's `audioContext`; while there is no adapter it waits for the next engine's. Each engine is constructed with `attachDecodeContext: false`. Nothing is fetched before the first adapter exists.
- Tests: `engineLifetime.test.tsx` (the hook: what builds and what does not, failed and superseded builds, the decode context, StrictMode, `<Activity>`, the sample rate) and `engineDisposedOnUnmount.test.tsx` (the provider: unmount after the initial build, after track edits, with a build in flight, after a failed build, StrictMode, an `<Activity>` reveal, playback across an unmount and a hide, no double dispose).

## Engine Rebuilds vs Playback (#675)

A rebuild (a new `effects` function, other zoom levels, a remount or an `<Activity>` reveal; until #812 also most `tracks` changes) disposes the engine, then creates the new adapter ASYNCHRONOUSLY (`await resolvePlayoutAdapter` — a dynamic import on the Tone path). Six rules keep playback correct across that window; breaking any of them brings back "Play is disabled, nothing plays, time frozen at 0". `pendingResumeRef`, `engineBuildInFlightRef`, `engineEpoch` and `disposeEngineKeepingPlayback()` live in `providerInternals/useEngineLifetime.ts`; the provider's `play`, `pause`, `stop`, `setSelection` and resume effect read and write them. A `play()` before the first ready of a mount is refused before any of this and queues nothing (see "Playlist Loading Detection").

1. **A disposed engine is never reachable.** Every dispose goes through `disposeEngineKeepingPlayback()`, which nulls `engineRef` and `adapterRef` (the second since #811: the soundfont sync, the clock and the decode context read it, and a failure to create the replacement must not dispose the old adapter a second time). Before this, `play()` in the window ran against the dead engine (the Tone adapter only warns `adapter.play() called but no playout is available`), set `isPlaying=true`, and nothing started the new engine.
2. **"Was it playing?" comes from the engine, not `isPlayingRef`.** `isPlayingRef` is as fresh as the last render. React commits the new props and runs the build effect in a later task; a `play()` whose `await engine.init()` resolves in between starts the OLD engine and calls `setIsPlaying(true)`, and the effect then reads a stale `false`. `disposeEngineKeepingPlayback()` checks `engine.getState().isPlaying` at dispose time and queues the resume itself.
3. **Queued plays start from the build completing, not from the change that caused it.** `pendingResumeRef` (`{ position, endTime? }`) is consumed by the resume effect, which depends on `engineEpoch` — a counter bumped when a freshly built engine is assigned (`bumpEngineEpoch`, which `play()` also calls to hand a play to an engine that is already assigned). A run of the resume effect before the build finishes finds `engineRef` null. `play()` queues into the same slot when `engineBuildInFlightRef` is set, and re-checks `engineRef.current === engine` after its own `init()` await; `stop()`/`pause()` clear the slot; a failed build clears it.

4. **A request stays in the slot until it actually starts.** The resume effect does NOT clear `pendingResumeRef` before awaiting `engine.init()`; after the await it proceeds only if the engine and the slot are both unchanged. So `stop()`/`pause()`/a newer `play()` during init cancel it by replacing or clearing the slot, and if the engine is replaced meanwhile, the new engine's own epoch run finds the request still waiting (clearing it first left a window where it was re-queued after the new engine's run and fired minutes later on an unrelated rebuild — found in review).
5. **`play()` checks `playRequestIdRef` after its `init()` await.** `play()`, `stop()` and `pause()` each bump it. A play that was parked in `init()` returns if the id moved (it would otherwise start after the user's Stop, or over a newer play), and when its engine was replaced it queues only if a replacement exists or a build is in flight — never after a failed build.
6. **`stop()` and `pause()` always reset the UI state, engine or not.** With `engineRef` null during a rebuild they still call `setIsPlaying(false)` and stop the animation loop. Playback that was running when the rebuild began keeps `isPlaying` true until its resume; returning early on a null engine after cancelling that resume left it stuck true (a regression in the first version of this fix, caught in review).

`isPlaying` stays false while a play is queued by `play()` — it only turns true when an engine has actually been started.

**Testing this (`playDuringEngineRebuild.test.tsx`):** the fake `createAdapter` returns a PROMISE of the adapter (awaited by `resolvePlayoutAdapter`, like the real dynamic import) so the test holds the rebuild window open; with a synchronous adapter the new engine is ready one microtask later and the race never opens. The commit-to-effect ordering (rule 2) cannot be produced inside `act()` — it flushes effects before microtasks — so that one test changes `effects` outside `act()` (`IS_REACT_ACT_ENVIRONMENT = false`) and releases `init()` from a layout effect.

**How it was found:** the "flaky" playback-start e2e tests on `/examples/waveform-data` (tracks streamed in, and at that time each arrival rebuilt the engine right after the first `ready`). Two standalone stress scripts never reproduced it (0/240); only the Playwright runner's timing did (~1 in 10 play tests with `--repeat-each` on the whole spec). A temporary spec that logged the console and the `data-playlist-state` transitions around the click showed both paths. After the fix: 1,776/1,776.

## Playhead outputLatency Compensation

`getPlaybackTime()` returns **raw engine time** — no latency subtraction. **Storage refs (`currentTimeRef`, pause/seek targets) must stay raw** so `play(time)` resumes correctly — subtracting latency from storage compounds on every pause/resume cycle.

**Display uses `visualTimeRef`.** While playing, the animation loop sets it from `engine.getAudibleTime()` (raw − `outputLatency` − `engine.lookAhead`, held at play-start during the pre-roll window). When resting (seek/pause/stop/selection-end), `toVisualTime` is the identity — the cursor displays the raw commanded position exactly; compensation is a property of playing, not of position. Every site that assigns `currentTimeRef.current = X` also assigns `visualTimeRef.current = toVisualTime(X)` via `setCurrentTimeRefs`. Static-display consumers read `visualTimeRef`; frame callbacks receive `visualTime` via `FrameData`; auto-scroll uses `visualTime`. The dual-ref pattern is mandatory: one ref → either storage broken (compounding) or display broken (lag).

## Engine State Subscription Pattern

**Pattern (#826):** the provider owns the state. A hook's setter writes its ref and its React state, engine or not, and then calls the engine there is; nothing is read back from an engine, and the provider does not subscribe to `statechange`. (Until #826 the engine owned these five and each hook mirrored it through an `onEngineState()`; a call to four of them made while no engine existed, from a dispose until the next adapter resolved and before the first engine of a mount, was dropped: `engineRef.current?.…`; the master volume was kept in its hook.)

**The five hooks:**

- `useSelectionState` — selectionStart, selectionEnd (published through `SelectionContext`, #733). Puts the two ends in order, as the engine does
- `useLoopState` — isLoopEnabled, loopStart, loopEnd
- `useSelectedTrack` — selectedTrackId. It subscribes to the arrangement and clears the id when its track is gone after a `remove`, a `restore` (undo, redo, abort) or an `update` (a track given a new id), and not after a `set`: the engine's rule for its own copy (`_clearSelectionIfGone()`), read from the change type `arrangement.subscribe` hands its listener. An arrangement made by an older copy of the engine package hands over nothing; the hook then looks at every change, `setTracks` included
- `useZoomControls` — samplesPerPixel. `zoomIn` / `zoomOut` step through the provider's zoom levels (`zoomLevels` or `DEFAULT_ZOOM_LEVELS`, the same array the engine is built with) and call `engine.setZoomLevel(next)`; a level given twice is one step (a step in starts from its first place, a step out from its last; the engine, stepping by index, made a step that changed nothing); `canZoomIn` / `canZoomOut` are computed during render from the level and the levels, so they are right before the first engine exists
- `useMasterVolume` — masterVolume

**A call on the engine itself is not followed.** `useEngineRefs().playoutRef.current.setSelection(…)`, `.zoomIn()`, `.selectTrack(…)`, `.setLoopRegion(…)` or `.setMasterVolume(…)` changes that engine's copy only: the provider's value and the view stay, and the next engine is built with the provider's value (upgrade guide, "Selection, loop, zoom, selected track and master volume are the provider's").

**Not mirrored from the engine (#812):** the tracks, the mix and `canUndo` / `canRedo` are the arrangement's. `providerInternals/useArrangementView.ts` reads them with `useSyncExternalStore` over `arrangement.subscribe` and derives `tracks`, `peaksDataArray`, `duration` and `trackStates` during render; there is no `statechange` handler for them and no `useUndoState`.

**React-only:** isPlaying (animation loop timing). `currentTime` is read from engine during playback via `getPlaybackTime()` (→ `engine.getCurrentTime()` → `Transport.seconds`).

**Engine-initiated stop mirror (#608 follow-up, final-review CRITICAL 1):** `isPlaying` is React-owned for provider-initiated play/pause/stop, but the provider also subscribes to the engine's `'stop'` event to catch engine-_initiated_ stops — e.g. `PlaylistEngine` self-stopping when a bounded `play(start, end)` completes on an adapter with `onPlaybackEnded` (the Tone path). Without this, that self-stop rewinds the engine's own current time to `playStartPosition` before the rAF loop's own `time >= playbackEndTimeRef`/`time >= duration` checks can ever observe it, wedging React `isPlaying=true` with a frozen playhead. The `'stop'` handler sets `isPlaying=false`, stops the animation loop, and mirrors `engine.getCurrentTime()` into the time refs (the engine already rewound). For a selection play it seeks the engine to the selection start instead and mirrors that (`mirrorEngineStop`). It's suppressed via `suppressEngineStopMirrorRef` around every provider call site that calls `engine.stop()` as an implementation detail of an immediate restart (`play()`, `setSelection`, `reschedulePlayback`) — those already establish the correct target state themselves, and an unguarded mirror would clobber it mid-transition (refs aren't batched like `setState`). Stop paths that terminate playback (`stop()`, the rAF loop's own end-of-playback branches) don't need suppression: they write the identical value the mirror would, or run their own ref-write synchronously right after it.

**Subscription location:** `buildEngine` (`useEngineLifetime`) calls `seedEngine(engine)` and then `onEngine(engine)`, then assigns `engineRef.current`. The two reach the provider through `followersRef`, which a layout effect in `WaveformPlaylistContext.tsx` fills after the hooks that own the state: `seed` (below) and `follow`, which subscribes `stop` (the mirror above) and nothing else.

**Seed on build:** each new engine is given the provider's values from the hooks' refs (`followersRef.current.seed`). **Checklist** (update when adding a value the engine must hold):

- `engine.setSelection(selectionStartRef.current ?? 0, selectionEndRef.current ?? 0)`
- `engine.setLoopRegion(loopStartRef.current ?? 0, loopEndRef.current ?? 0)`
- `if (isLoopEnabledRef.current) engine.setLoopEnabled(true)`
- `engine.setMasterVolume(masterVolumeRef.current ?? 1.0)`
- `if (selectedTrackIdRef.current) engine.selectTrack(selectedTrackIdRef.current)`
- Zoom has no call in `seed`: `buildEngine` passes the provider's `zoomSamplesPerPixelRef` to the `PlaylistEngine` constructor (`samplesPerPixel`). `useZoomControls` is its only writer; the ref is made in the provider because `useEngineLifetime` is set up before the hook. It is not the committed view zoom (`samplesPerPixelRef` from `useZoomAnchor`, written in a layout effect on each commit with a new level). Before #828 that ref was written only when a view was mounted and the timeline was not empty, and seeding from it undid a zoom made on an empty timeline at the next rebuild (#901, `providerOnArrangement.test.tsx`, "preserves zoom on an empty timeline across rebuilds").
- Tracks, mix and undo history need no seed: the new engine is constructed on the same arrangement, which holds them. The history survives a rebuild (until #812 a rebuild cleared it).

**Tests:** `callsWhileEngineIsBuilt.test.tsx` holds a build open (`factory.holdNext()`) and calls each setter in the window, and the selection, selected-track, loop-region and zoom setters before the first engine.

## SoundFont Late-Load Wiring

The `soundFontCache` prop is deliberately NOT a dependency of the engine build effect (`useEngineLifetime` gets `soundFontCacheRef` and reads it when a build runs) — late cache changes are forwarded to the live adapter by a dedicated effect (`syncSoundFontCacheToAdapter(adapterRef.current, soundFontCache)`), which rebuilds only MIDI tracks. Making it a dependency would rebuild the engine on every cache arrival. `adapterRef` is nulled with `engineRef` in `disposeEngineKeepingPlayback()`, so the sync never reaches a disposed adapter.

## Error Handling in Playback Callbacks

- **`engine.play()` try-catch in play callback** — `engine.play()` is synchronous but can throw (adapter failures). Wrap in try-catch; on error, `stopAnimationLoop()` and return early to avoid `setIsPlaying(true)` with no audio.
- **Fire-and-forget async `.catch()` handlers** — `reschedulePlayback()` and `resumePlayback()` are async functions called without `await` in useEffect callbacks. Without `.catch()`, throws become unhandled promise rejections. Each `.catch()` resets UI state (`setIsPlaying(false)`, `stopAnimationLoop()`).

## End-of-Timeline Semantics (indefinitePlayback, fillViewport, setRecordingActive)

**Matched with dawcore's `<daw-editor>` (#589/#590/#593, PR #592):**

- **Default:** the animation loop auto-stops playback when raw engine time reaches `duration` and returns the cursor to the play-start position (player style).
- **`indefinitePlayback` prop:** opt out — the transport rolls until an explicit stop/pause (DAW style; implies the fillViewport layout). Stored in a ref for the loop; exposed via `usePlaylistView()`.
- **`fillViewport` (layout only; a prop of `<WaveformViewOptions>` since #689, no longer of the provider):** `WaveformRoot` floors `displayDuration` to fill the scroll container. `indefinitePlayback || fillViewport` gates the floor. Recording UIs want `fillViewport`, not `indefinitePlayback`. The container width is state: measured in a layout effect (first paint already fills) and kept current by a `ResizeObserver` on the scroll container, only while the floor is active. Never read `clientWidth` in the render body (`fillViewportContainerWidth.test.tsx`).
- **Recording session suppression:** while `setRecordingActive(true, …)` is active, the auto-stop is skipped so punch-in takes run past existing material. Overdub flows MUST call it eagerly (before `play()`) — the recordingState render round-trip loses the race against the first animation frame (empty timeline: `time 0 >= duration 0` stops instantly). `duration` counts loaded audio only (#812), so a timeline whose clips are all still loading is an empty one here.

**`setRecordingActive(active, recordingTrackId?)` (`useEditorControls()`, `useRecordingActive` in `providerInternals/useArrangementEditing.ts`):** besides the suppression, a `recordingTrackId` mutes that track for the session — punch-in replaces whatever the take overlaps, so the doomed material must not play under the overdub. Since #843 the take's mute is the arrangement's (`arrangement.setTrackRecording(recordingTrackId, true)`, the set `arrangement.recordingTrackIds`): outside the history, it plays the track muted (the engine's projection has `muted: stored || recording`) and never touches the stored mute in `getMixer()`. It is not a record-arm (a later feature the user sets and clears). `trackStates` shows the track muted (`useArrangementView` derives `muted` from the mix and the recording set), `RecordingTrackContext` (internal) carries `recordingTrackId` (the first id of the set), `useTrack().isRecording` is true for that track and the built-in `<TrackMuteButton />` is disabled on it. (Until #812 the mute was engine-level only and `trackStates` did not show it; from #812 to #843 the provider muted the track in the mix and wrote a `prevMuted` back at the end, whatever was set in between.)

- **Nothing is remembered or written back.** The stored mute is not written by a take, so a mute set during the take stays after it, and an undo during the take moves the stored mute and not the take's mute. The take's mute is no undo step; undo, redo, an abort, `setTracks` and `clearHistory` do not change the set.
- **Owner:** the arrangement holds the set; the provider reads it with `useSyncExternalStore` over `arrangement.subscribe` and holds no copy. `recordingActiveRef` (whether a session is active) is what the animation loop and `seekTo` read.
- **One track at a time:** naming one clears every other recording id first; `setRecordingActive(false)` clears every id in the set, also one set by other code and one whose track has been removed (a removed track's id stays in the set until cleared, so every teardown path clears it).
- **Release:** `useRecordingSession` (`hooks/useRecordingSession.ts`) calls `setRecordingActive(true, trackId)` in an effect while `isRecording` and `setRecordingActive(false)` in its cleanup (recording end, a change of track, unmount, an `<Activity>` hide; it sets it again on the reveal). The provider also clears it in its own cleanup when a track is still recording, because the arrangement outlives the provider.
- A call that names the track already recording changes nothing (the arrangement's `setTrackRecording` ignores the same value).

Explicit ends (selection playback via `playbackEndTimeRef`, annotation boundaries) stop regardless of all of the above. Tests: `animationLoopEndOfAudio.test.tsx`, `recordingTakeMute.test.tsx`.

## Per-Track Things That Are Not Plain Data Go Through a Provider Prop (#752)

The section this replaces, "Incremental Track Addition (loadAudio optimization)", described code that #812 deleted: the provider no longer compares `tracks` arrays, has no incremental or full-rebuild path and no `prevTracksRef`. A track added to the arrangement reaches the adapter through the engine's subscription to the arrangement, and no engine is built for it (see "The Engine Is Disposed on Unmount").

**The rule that stays (#752): anything per-track that is not plain data goes through a provider prop keyed by track id (`trackEffects`), never onto the track object.**

- How it is built: the adapter keeps ONE lookup for its whole life (`resolveTrackEffects`, a stable callback) and calls it when it builds a track; the lookup reads the latest `trackEffects` prop from a ref. A new function identity for the prop, an inline arrow included, builds nothing. `ClipTrack` has no `effects` field.
- Why, today: the tracks are the arrangement's data. It copies a track on the way in and hands out its own objects, frozen outside production builds (engine notes, "The arrangement owns the tracks"), so a function could only get onto a track by replacing the track in the arrangement (`updateTrack`), which is a track edit that the engine and the view then follow.
- Where it came from: until #752 a track's effects function was a field (`ClipTrack.effects`), set with `tracks.map((t) => ({ ...t, effects }))`. The provider of that time decided between an incremental update and a full engine rebuild by comparing track objects by identity, so the copies turned every clip move, trim and split into a dispose, a new adapter and a `setTracks` (measured then with a counting adapter). The identity comparison is gone with #812; the rule is kept for the reason above.
- `trackEffectsProp.test.tsx`: the lookup the adapter gets, no function on the tracks the engine is given, a new `trackEffects` function without a rebuild, one engine through clip edits and added tracks, no `effects` field on `ClipTrack`.

## Rewind / Seek Without Playback

**Rule:** Use `seekTo(time)` to move the cursor without starting audio. Never use `play(time, 0)` — `playDuration=0` is truthy (`!== undefined`), so the Transport starts but the animation loop immediately stops at `endTime=0`. This causes ghost audio playback with no visual indication. The built-in `RewindButton` calls `seekTo(0)` (#688, part 2; until then `setCurrentTime(0)` plus `play(0)` if already playing).

## Stop Before Clear

Call `stop()` before removing every track. Removing tracks does not stop playback: the engine is kept and `isPlaying` stays as it was (`providerOnArrangement.test.tsx`, "removing a track during playback makes one `adapter.removeTrack`, builds no engine and keeps `isPlaying` (#798)"). Use `ClearAllButton` (exported from `@waveform-playlist/browser`), which calls `usePlaybackControls().stop()` and then its `onClearAll` prop; the app's `onClearAll` empties the arrangement (for example `arrangement.setTracks([])`).

## `handleStop` During Recording: Use `pause()` Not `stop()`

`engine.stop()` rewinds Transport to the last play-start position. During a paused/resumed recording, every resume calls `play(currentTime)` — making the most recent resume the new play-start. So calling `stop()` after `stopRecording()` jumps the playhead back to the last resume position. Use `pause()` instead during recording so the playhead stays where the user clicked stop. Plain `stop()` (when not recording) retains the standard rewind behavior.
