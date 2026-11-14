# Playback, the engine's lifetime and loading

Notes of Browser Package (`@waveform-playlist/browser`), moved out of the package's `CLAUDE.md`. Read before changing how the provider builds, rebuilds or disposes the engine, how tracks reach it, play / pause / stop / seek, the animation loop, or the end of the timeline.

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

Three approaches for detecting when tracks finish loading (`WaveformPlaylistProvider`; under `MediaElementPlaylistProvider` there is no event; the attribute is always `"ready"`, see "Two Roots Over One Frame and the Same Parts", and the hook is `useMediaElementTrack().isReady`):

1. **Data Attribute** — `[data-playlist-state="ready"]` for CSS and E2E tests (Playwright `waitForSelector`); set on `Playlist`'s wrapper by `useWaveformFrame` for both roots
2. **Custom Event** — `waveform-playlist:ready` (CustomEvent with `trackCount`, `duration`) for external integrations
3. **React Hook** — `isReady` from `usePlaylistTimeline()` for internal components

**Applied in:** `WaveformPlaylistContext.tsx`, `waveformFrame.tsx`, `Playlist.tsx`, all E2E tests

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

**Applied in:** `WaveformPlaylistContext` track controls (`tracksRef`), `WaveformRoot`. The effects hooks used this until #679; their state now lives in an `EffectsRack` store read at call time (see "Audio Effects Architecture").

## Smooth Playback Animation Pattern

**Problem:** React state updates during playback cause flickering. Components need 60fps updates.

**Solution:** Single `requestAnimationFrame` loop in `WaveformPlaylistContext` drives all visual updates via the **Animation Frame Registry**. Components register per-frame callbacks via `registerFrameCallback(id, cb)` / `unregisterFrameCallback(id)` from `usePlaybackRefs()`. Direct DOM manipulation via refs — no `setState` in the loop.

**FrameData:** The animation loop computes `FrameData { time, visualTime, sampleRate, samplesPerPixel }` once per frame and passes it to all registered callbacks. Callbacks must read `sampleRate`/`samplesPerPixel` from `FrameData`, not from closed-over render values — avoids stale closures during zoom changes.

**Consumers:** `AnimatedPlayhead`, `AudioPosition` and `ChannelWithProgress`'s `ClipProgress` (id: `useId()` — unique per instance; the registry is a `Map`, so two components under one id replace each other). Auto-scroll uses `visualTime` directly in the loop body. The MediaElement provider has the same registry since #769, reached through `usePlaybackRefs()` since #688, part 2, with `visualTime` equal to `time`.

**Per-frame annotation lookups** in both providers' loops go through `createAnnotationLookup()` (`src/utils/annotationLookup.ts`): `atTime` / `byId` return exactly what the `find` calls they replaced returned, cached against the annotations array's identity (so annotations must be replaced, not mutated). `atTime` only uses the cached hit and binary search when the list is sorted and non-overlapping; otherwise it falls back to the linear scan, because with overlaps "first match" depends on index order.

**Do NOT add new rAF loops for visual playback updates.** Register a frame callback instead. Use `visualTime` for DOM positioning, `time` for state/logic.

**Loop handling:** Looping is handled natively by Tone.js Transport (`Transport.loop`/`loopStart`/`loopEnd`). The animation loop does NOT detect loop boundaries — `Transport.seconds` auto-wraps, so `getPlaybackTime()` returns the correct position. Selection/annotation playback disables Transport loop; `stop()` disables it before stopping.

**AudioContext Init Pattern:** `audioInitializedRef` guards `engine.init()` (AudioContext resume via `Tone.start()`). Only the first play call awaits init; subsequent plays skip it entirely — no microtask yield. Reset to `false` when engine is rebuilt in `loadAudio`. This keeps the stop→play path fully synchronous after first play, preventing audio layering race conditions.

**Engine is always persistent (never torn down on empty).** `loadAudio` creates the `PlaylistEngine`+adapter eagerly on mount and reuses it via `setTracks([])` when the timeline empties — it is NOT disposed at `tracks.length === 0`. This keeps a ready Transport so the first play/record never races an async engine rebuild or pays build latency (the cause of the intermittent "frozen recording playhead" — recording into an empty timeline auto-creates a track, and the overdub `play()` used to win the race against the rebuild and no-op). Lazy _module_ loading (dynamic import, #510) is unchanged — only the lifecycle is eager; an empty-on-mount provider holds a suspended AudioContext (resume still deferred to first play). The 0→1 track add takes the synchronous incremental path (`isIncrementalAdd` no longer requires `prevTracks.length > 0`; still gated on an existing engine).

## The Engine Is Disposed on Unmount (#811)

Only the full-build path of the loading effect returns a cleanup that disposes. The other paths (an engine clip operation, a trim drag, an incremental add or fill, the emptied timeline with the engine kept, a deferred rebuild) return none, and React replaces the previous run's cleanup with nothing, so until #811 an unmount after any of them disposed nothing: the adapter was never disposed (with the Tone engine the transport kept running and the track and master nodes stayed in the graph; `TonePlayout.dispose()` does not close the shared global AudioContext, before or after). A second effect, `useEffect(() => disposeEngineKeepingPlayback, [disposeEngineKeepingPlayback])`, now disposes on unmount whatever path ran last. It must not use `skipEngineDisposeRef`: that ref describes the NEXT run, an unmount has none, and a render made during a drag leaves it `true`.

- **The callback is stable** (`useCallback(…, [])`), so the cleanup runs only on an unmount, a StrictMode remount, Fast Refresh and an `<Activity>` hide. In the last three the loading effect runs again afterwards, with the LATEST render's closure (also when its dependencies did not change), and finds no engine. The incremental, emptied-timeline and engine-clip-operation guards check `engineRef.current` and fall through to a full build (the last since #811: it is reached when the clip operation and the hide were one commit). Two paths build nothing: the deferred path (`deferEngineRebuild`) sets `isReady` false when there is no engine and the build runs when the flag clears, as on a mount with the flag set (found in review: without that line the reveal said ready with no engine and Play did nothing). The same line runs when the flag turns true right after a full build with no `<Activity>` involved (`deferEngineRebuild={loading}` while `useAudioTracks` loads a set of tracks that replaces the previous one): that run's cleanup disposes the engine (after an incremental run there is no cleanup, and the engine stays alive and ready; tracks appended while the flag is on take the incremental path, which runs before the deferred check), and the view now reports `"loading"` until the build, where on `main` it stayed `"ready"` with nothing to play (maintainer's choice a, 2026-11-13: no engine means not ready; the provider guide and the Loading Audio guide say so); and the `isDraggingRef` path (a hide during a trim drag, left).
- **Behaviour after the change (maintainer's choice A, 2026-11-13):** an `<Activity>` hide during playback stops the audio, after every path, as it already did after a full build; the reveal rebuilds and resumes from where it was hidden (`disposeEngineKeepingPlayback()` queues the resume; the resume effect starts it on the new engine's epoch). The other option, keeping the engine alive while hidden, cannot coexist with disposing on unmount: a cleanup cannot tell the two apart. An unmount during playback disposes the playing adapter; that this silences the Tone path is read from `TonePlayout.dispose()` (it stops the transport), not run in a browser.
- **`getAudioContextTime()` / `getOutputLatency()` read 0 while no engine exists**, from the dispose until the new adapter is assigned. A full build's cleanup already cleared `adapterRef`; since #811 a rebuild after a path with no cleanup does too.
- Tests: `engineDisposedOnUnmount.test.tsx` (each path, StrictMode, the two `<Activity>` reveals, the flag turned on after a load, playback across an unmount and a hide, the double dispose). Each changed line was broken once and a test failed. Two tests first passed for the wrong reason: the clip-operation `<Activity>` case passed with its guard removed until the clip operation and the hide were put in one `act()`, and the deferred `<Activity>` case set the flag before the incremental add, so the full build's cleanup had already disposed the engine and the test passed without the unmount effect (found in review; the add now comes first and the test asserts a live engine before the hide).

## Engine Rebuilds vs Playback (#675)

A `tracks` change that needs a full rebuild disposes the engine, then creates the new adapter ASYNCHRONOUSLY (`await resolvePlayoutAdapter` — a dynamic import on the Tone path). Three rules keep playback correct across that window; breaking any of them brings back "Play is disabled, nothing plays, time frozen at 0":

1. **A disposed engine is never reachable.** Every dispose goes through `disposeEngineKeepingPlayback()`, which nulls `engineRef` and `adapterRef` (the second since #811: a rebuild after a run with no cleanup left `adapterRef` on the disposed adapter, and a failure to create the replacement disposed it a second time). Before this, `play()` in the window ran against the dead engine (the Tone adapter only warns `adapter.play() called but no playout is available`), set `isPlaying=true`, and nothing started the new engine.
2. **"Was it playing?" comes from the engine, not `isPlayingRef`.** `isPlayingRef` is as fresh as the last render. React commits the new `tracks` and runs the rebuild effect in a later task; a `play()` whose `await engine.init()` resolves in between starts the OLD engine and calls `setIsPlaying(true)`, and the effect then reads a stale `false`. `disposeEngineKeepingPlayback()` checks `engine.getState().isPlaying` at dispose time and queues the resume itself.
3. **Queued plays start from the build completing, not from the `tracks` change.** `pendingResumeRef` (`{ position, endTime? }`) is consumed by the resume effect, which depends on `engineEpoch` — a counter bumped when a freshly built engine is assigned. The `tracks`-triggered run happens before the build finishes and finds `engineRef` null. `play()` queues into the same slot when `engineBuildInFlightRef` is set, and re-checks `engineRef.current === engine` after its own `init()` await; `stop()`/`pause()` clear the slot; a failed build clears it.

4. **A request stays in the slot until it actually starts.** The resume effect does NOT clear `pendingResumeRef` before awaiting `engine.init()`; after the await it proceeds only if the engine and the slot are both unchanged. So `stop()`/`pause()`/a newer `play()` during init cancel it by replacing or clearing the slot, and if the engine is replaced meanwhile, the new engine's own epoch run finds the request still waiting (clearing it first left a window where it was re-queued after the new engine's run and fired minutes later on an unrelated `tracks` change — found in review).
5. **`play()` checks `playRequestIdRef` after its `init()` await.** `play()`, `stop()` and `pause()` each bump it. A play that was parked in `init()` returns if the id moved (it would otherwise start after the user's Stop, or over a newer play), and when its engine was replaced it queues only if a replacement exists or a build is in flight — never after a failed build.
6. **`stop()` and `pause()` always reset the UI state, engine or not.** With `engineRef` null during a rebuild they still call `setIsPlaying(false)` and stop the animation loop. Playback that was running when the rebuild began keeps `isPlaying` true until its resume; returning early on a null engine after cancelling that resume left it stuck true (a regression in the first version of this fix, caught in review).

`isPlaying` stays false while a play is queued by `play()` — it only turns true when an engine has actually been started.

**Testing this (`playDuringEngineRebuild.test.tsx`):** the fake `createAdapter` returns a PROMISE of the adapter (awaited by `resolvePlayoutAdapter`, like the real dynamic import) so the test holds the rebuild window open; with a synchronous adapter the new engine is ready one microtask later and the race never opens. The commit-to-effect ordering (rule 2) cannot be produced inside `act()` — it flushes effects before microtasks — so that one test changes `tracks` outside `act()` (`IS_REACT_ACT_ENVIRONMENT = false`) and releases `init()` from a layout effect.

**How it was found:** the "flaky" playback-start e2e tests on `/examples/waveform-data` (tracks stream in, so the playlist rebuilds right after first `ready`). Two standalone stress scripts never reproduced it (0/240); only the Playwright runner's timing did (~1 in 10 play tests with `--repeat-each` on the whole spec). A temporary spec that logged the console and the `data-playlist-state` transitions around the click showed both paths. After the fix: 1,776/1,776.

## Playhead outputLatency Compensation

`getPlaybackTime()` returns **raw engine time** — no latency subtraction. **Storage refs (`currentTimeRef`, pause/seek targets) must stay raw** so `play(time)` resumes correctly — subtracting latency from storage compounds on every pause/resume cycle.

**Display uses `visualTimeRef`.** While playing, the animation loop sets it from `engine.getAudibleTime()` (raw − `outputLatency` − `engine.lookAhead`, held at play-start during the pre-roll window). When resting (seek/pause/stop/selection-end), `toVisualTime` is the identity — the cursor displays the raw commanded position exactly; compensation is a property of playing, not of position. Every site that assigns `currentTimeRef.current = X` also assigns `visualTimeRef.current = toVisualTime(X)` via `setCurrentTimeRefs`. Static-display consumers read `visualTimeRef`; frame callbacks receive `visualTime` via `FrameData`; auto-scroll uses `visualTime`. The dual-ref pattern is mandatory: one ref → either storage broken (compounding) or display broken (lag).

## Engine State Subscription Pattern

**Pattern:** Engine owns state → emits `statechange` → hook's `onEngineState()` mirrors into useState/refs.

**All engine-owned state uses the `onEngineState()` hook pattern:**

- `useSelectionState` — selectionStart, selectionEnd (published through `SelectionContext`, #733)
- `useLoopState` — isLoopEnabled, loopStart, loopEnd
- `useSelectedTrack` — selectedTrackId
- `useZoomControls` — samplesPerPixel, canZoomIn, canZoomOut
- `useMasterVolume` — masterVolume
- `useUndoState` — canUndo, canRedo

**Still React-only:** isPlaying (animation loop timing), tracks (loaded via useAudioTracks). `currentTime` is read from engine during playback via `getPlaybackTime()` (→ `engine.getCurrentTime()` → `Transport.seconds`).

**Engine-initiated stop mirror (#608 follow-up, final-review CRITICAL 1):** `isPlaying` is React-owned for provider-initiated play/pause/stop, but the provider also subscribes to the engine's `'stop'` event (alongside `statechange`) to catch engine-_initiated_ stops — e.g. `PlaylistEngine` self-stopping when a bounded `play(start, end)` completes on an adapter with `onPlaybackEnded` (the Tone path). Without this, that self-stop rewinds the engine's own current time to `playStartPosition` before the rAF loop's own `time >= playbackEndTimeRef`/`time >= duration` checks can ever observe it, wedging React `isPlaying=true` with a frozen playhead. The `'stop'` handler sets `isPlaying=false`, stops the animation loop, and mirrors `engine.getCurrentTime()` into the time refs — it never calls `seek()` itself (the engine already rewound). It's suppressed via `suppressEngineStopMirrorRef` around every provider call site that calls `engine.stop()` as an implementation detail of an immediate restart (`play()`, `setSelection`, `reschedulePlayback`, the engine-rebuild-with-resume path) — those already establish the correct target state themselves, and an unguarded mirror would clobber it mid-transition (refs aren't batched like `setState`). Stop paths that terminate playback (`stop()`, the rAF loop's own end-of-playback branches) don't need suppression: they write the identical value the mirror would, or run their own ref-write synchronously right after it.

**Subscription location:** Inside `loadAudio()` after `engineRef.current = engine`, the statechange handler calls each hook's `onEngineState(state)`.

**Seed on rebuild:** When `loadAudio()` creates a fresh engine, seed it from hook-exposed refs before `setTracks()` — otherwise the first statechange resets user state to defaults. **Checklist** (update when adding engine-owned state):

- `engine.setSelection(selectionStartRef.current ?? 0, selectionEndRef.current ?? 0)`
- `engine.setLoopRegion(loopStartRef.current ?? 0, loopEndRef.current ?? 0)`
- `if (isLoopEnabledRef.current) engine.setLoopEnabled(true)`
- `engine.setMasterVolume(masterVolumeRef.current ?? 1.0)`
- `if (selectedTrackIdRef.current) engine.selectTrack(selectedTrackIdRef.current)`
- `canUndo`/`canRedo` — no seed needed. `setTracks()` calls `clearHistory()`, so undo state always resets on rebuild.

**Guard handler with ref comparisons:** Each hook's `onEngineState()` compares `state.field !== ref.current` before calling `setState` to skip unnecessary React updates. Ref assignments are synchronous; `setState` calls are batched by React.

## SoundFont Late-Load Wiring

The `soundFontCache` prop is deliberately EXCLUDED from the `loadAudio` effect deps — late cache changes are forwarded to the live adapter by a dedicated effect (`syncSoundFontCacheToAdapter(adapterRef.current, soundFontCache)`), which rebuilds only MIDI tracks. Re-adding the dep restores full engine rebuilds on every cache arrival. `adapterRef` is nulled with `engineRef` in `disposeEngineKeepingPlayback()`, so the sync never reaches a disposed adapter.

## Error Handling in Playback Callbacks

- **`engine.play()` try-catch in play callback** — `engine.play()` is synchronous but can throw (adapter failures). Wrap in try-catch; on error, `stopAnimationLoop()` and return early to avoid `setIsPlaying(true)` with no audio.
- **Fire-and-forget async `.catch()` handlers** — `reschedulePlayback()` and `resumePlayback()` are async functions called without `await` in useEffect callbacks. Without `.catch()`, throws become unhandled promise rejections. Each `.catch()` resets UI state (`setIsPlaying(false)`, `stopAnimationLoop()`).

## End-of-Timeline Semantics (indefinitePlayback, fillViewport, setRecordingActive)

**Matched with dawcore's `<daw-editor>` (#589/#590/#593, PR #592):**

- **Default:** the animation loop auto-stops playback when raw engine time reaches `duration` and returns the cursor to the play-start position (player style).
- **`indefinitePlayback` prop:** opt out — the transport rolls until an explicit stop/pause (DAW style; implies the fillViewport layout). Stored in a ref for the loop; exposed via `usePlaylistView()`.
- **`fillViewport` (layout only; a prop of `<WaveformViewOptions>` since #689, no longer of the provider):** `WaveformRoot` floors `displayDuration` to fill the scroll container. `indefinitePlayback || fillViewport` gates the floor. Recording UIs want `fillViewport`, not `indefinitePlayback`. The container width is state: measured in a layout effect (first paint already fills) and kept current by a `ResizeObserver` on the scroll container, only while the floor is active. Never read `clientWidth` in the render body (`fillViewportContainerWidth.test.tsx`).
- **Recording session suppression:** while `setRecordingActive(true, …)` is active, the auto-stop is skipped so punch-in takes run past existing material. Overdub flows MUST call it eagerly (before `play()`) — the recordingState render round-trip loses the race against the first animation frame (empty timeline: `time 0 >= duration 0` stops instantly).

**`setRecordingActive(active, armedTrackId?)` (`useEditorControls()`):** besides the suppression, an `armedTrackId` transiently mutes that track for the session — punch-in replaces whatever the take overlaps, so the doomed material must not play under the overdub. Previous mute captured/restored via engine-level `setTrackMute` (survives adapter rebuilds); UI `trackStates` mute untouched. Auto-wired from the view's `recordingState` prop (the effect is in `WaveformRoot`, driven by the recording marker) by an effect with cleanup (releases on recording end AND unmount; re-arms on remount-while-recording). Explicit ends (selection playback via `playbackEndTimeRef`, annotation boundaries) stop regardless of all of the above.

## Incremental Track Addition (loadAudio optimization)

**Detection:** `incrementalChange` (and `isIncrementalAdd`, true when it is not null) is computed during render by comparing `prevTracksRef` with current tracks. Uses reference equality on individual track objects — if every previous track is unchanged or was empty and got its clips, and any new ones were appended, the incremental path is used.

**When incremental:** `incrementalTrackChange(prevTracks, tracks)` (`src/utils/incrementalTrackChange.ts`) returns `{ added, filled }`: tracks appended (file drops, new empty tracks), and tracks that had NO clips and now have some (a `useDynamicTracks` placeholder whose audio arrived; a first take recorded into an empty track). Tracks that were already there must keep their index, with new tracks after them (the engine appends an added track), otherwise it is a rebuild. Filled tracks are applied BEFORE added ones: an add is mirrored to the parent, and a parent that stores what it is given would otherwise get the placeholder back. Added tracks go through `engine.addTrack()`, filled ones through `engine.updateTrack(id, track)` with mirroring to `onTracksChange` suppressed (`suppressTracksMirrorRef`: the parent already has them) and `engine.clearHistory()` afterwards, as a rebuild did (undo must not go back to an empty placeholder), followed by `onUndoEngineState(engine.getState())` because `clearHistory` emits no statechange. The filled track's name replaces the placeholder's in `trackStates`. No engine dispose/rebuild. Before this, each decoded file was a full rebuild.

**When full rebuild:** a track that already has clips is replaced (recording into a track with content, a consumer edit), a track removed, an empty track renamed.

**Never give consumers a reason to copy track objects (#752).** Both fast paths are identity checks: `tracks === engineTracksRef.current` (the array the engine just reported) and `current === previous` per track. Until #752 a track's effects function was a field (`ClipTrack.effects`), and the documented way to set it was `tracks.map((t) => ({ ...t, effects }))`. Measured with a counting adapter and a parent that stores `onTracksChange`: with that map, every clip move, trim and split did its incremental `updateTrack` AND THEN a dispose + new adapter + `setTracks`, and every added or filled track was a full rebuild; with the tracks passed through, none. What `onTracksChange` hands back is always new track objects (`getState()` copies each one), with every field carried along. So anything per-track that is not plain data goes through a provider prop keyed by track id (`trackEffects`), never onto the track. `trackEffectsProp.test.tsx` holds the counts, including the control case with copied tracks.

**`skipEngineDisposeRef` integration:** `isIncrementalAdd` joins `isEngineTracks` and `isDraggingRef` in preventing the effect cleanup from disposing the engine.

**`prevTracksRef`:** Updated in all `loadAudio` exit paths (engine tracks guard, incremental add, clear state, full rebuild) to keep detection accurate.

## Rewind / Seek Without Playback

**Rule:** Use `seekTo(time)` to move the cursor without starting audio. Never use `play(time, 0)` — `playDuration=0` is truthy (`!== undefined`), so the Transport starts but the animation loop immediately stops at `endTime=0`. This causes ghost audio playback with no visual indication. The built-in `RewindButton` calls `seekTo(0)` (#688, part 2; until then `setCurrentTime(0)` plus `play(0)` if already playing).

## Stop Before Clear

Always call `stop()` before clearing tracks. Clearing React state without stopping Tone.js Transport leaves orphaned audio playing. Use `ClearAllButton` (exported from `@waveform-playlist/browser`) which handles this via `usePlaybackControls().stop()`.

## `handleStop` During Recording: Use `pause()` Not `stop()`

`engine.stop()` rewinds Transport to the last play-start position. During a paused/resumed recording, every resume calls `play(currentTime)` — making the most recent resume the new play-start. So calling `stop()` after `stopRecording()` jumps the playhead back to the last resume position. Use `pause()` instead during recording so the playhead stays where the user clicked stop. Plain `stop()` (when not recording) retains the standard rewind behavior.
