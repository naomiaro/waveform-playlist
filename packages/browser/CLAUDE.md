# Browser Package (`@waveform-playlist/browser`)

## Notes by topic

The notes of this package are in `notes/`, one file per topic. Read the file for the part you are about to change, before changing it; a section that another document cites by its title is listed under the file that holds it. A new note goes into the topic file it belongs to (a new file for a new topic, with a row here), and into this file only when it applies to the whole package.

### Effects and WAV export: `notes/effects-and-export.md`

Read before touching `effects/`, `useDynamicEffects`, `useTrackDynamicEffects`, the effects rack or `useExportWav`.

- Audio Effects Architecture
- WAV Export (useExportWav)

### Peaks and sample rate: `notes/peaks.md`

Read before touching peak generation, the peak worker, `waveformDataLoader.ts`, pre-computed peaks or anything that reads the sample rate.

- Web Worker Peak Generation
- Pre-Computed Peaks Rate Mismatch
- AudioContext Is the Single Source of Truth for Sample Rate
- sampleRate From Context (Not Props)
- Aligned Peak Resampling (waveformDataLoader.ts)
- AudioBuffer Deduplication in Peak Generation
- Shared Clip Pixel Width

### Contexts and render boundaries: `notes/contexts.md`

Read before adding a field to a context, reading a context in a component, changing a hook in `contexts/playlistContexts.ts`, or changing a memo boundary in the visualization.

- Memo Boundaries in the Visualization (#693)
- Selection Has Its Own Context (#733)
- Resting Cursor Position and Active Annotation Have Their Own Contexts (#740)
- Contexts Are Grouped by Change Rate (#768)

### Provider internals and the shared context objects: `notes/provider-internals.md`

Read before changing `WaveformPlaylistContext.tsx`, `MediaElementPlaylistContext.tsx` or `providerInternals/` (the list of its files, with the hooks `WaveformPlaylistProvider` is made of since #812, is in the first section), or moving a hook between the two providers.

- Provider Internals Exist Once (#769)
- One Set of Context Objects for Both Providers (#688, part 2)

### The MediaElement provider: `notes/media-element.md`

Read before changing playback, progress or time under `MediaElementPlaylistProvider`.

- MediaElement Playback Follows the WebAudio Rules (#688, part 1)
- MediaElement Progress Overlay
- MediaElement currentTime vs currentTimeRef

### The view: roots, parts and view options: `notes/view-parts.md`

Read before changing `<Waveform />`, `<WaveformEditor />`, `<MediaElementWaveform />`, any `Waveform*` part, the playhead, progress overlay or selection highlight, or a view option.

- One Playhead, One Progress Overlay, One Selection Highlight (#688, part 3)
- The View Is a Root With Parts (#685, step 1)
- Two Roots Over One Frame and the Same Parts (#685, step 2)
- The Parts Are Public (#685, step 3)
- View Options Have One Home (#689)
- Progress Overlay Width Invariant
- Controls Offset Removed

### Track controls and track reordering: `notes/track-controls-and-reorder.md`

Read before changing the track control pieces, the controls column or the track-reorder drag.

- Track Controls Are Pieces Bound to a Track (#687)
- Track Reordering (#612)

### Annotations in the view: `notes/annotations.md`

Read before changing the annotation list, the annotation boxes, their edge drag, the annotation options or anything that writes the annotations.

- One Annotation List and One Row of Boxes for Both Players (#744)
- The Annotation Store Is the One Owner (#867)
- Annotation Edge Drag: Preview Source, One Write per Drag
- Annotation Parts Own Their Options; the Options Are Provider State (#686)

### Playback, the engine's lifetime and loading: `notes/playback-and-engine.md`

Read before changing how the provider builds, rebuilds or disposes the engine, how the arrangement's tracks reach it, ready, play / pause / stop / seek, the animation loop, or the end of the timeline.

- Shared Animation Frame Loop Hook
- Playlist Loading Detection
- Refs for Dynamic Audio Callbacks
- Smooth Playback Animation Pattern
- The Engine Is Disposed on Unmount (#811)
- Engine Rebuilds vs Playback (#675)
- Playhead outputLatency Compensation
- Engine State Subscription Pattern
- SoundFont Late-Load Wiring
- Error Handling in Playback Callbacks
- End-of-Timeline Semantics (indefinitePlayback, fillViewport, setRecordingActive)
- Per-Track Things That Are Not Plain Data Go Through a Provider Prop (#752) (until #812 this section was "Incremental Track Addition (loadAudio optimization)"; the incremental paths are deleted, the #752 rule is here)
- Rewind / Seek Without Playback
- Stop Before Clear
- `handleStop` During Recording: Use `pause()` Not `stop()`

### Recording preview and meters: `notes/recording-and-meters.md`

Read before changing the recording preview, a meter or any value that changes every frame.

- Recording Preview Rendering Path
- 60 Hz Values Are Sources, Not State (#695)
- Output Metering (useOutputMeter)
- Output Meter Clearing (isPlaying Prop)

### Clip drag, trim and snapping: `notes/clip-drag-and-snap.md`

Read before changing `useClipDragHandlers`, `ClipInteractionProvider`, a dnd-kit handler or modifier, or snap-to-grid.

- Trim/Move Asymmetry in useClipDragHandlers
- Stable Drag Handlers and Modifiers (#694)
- Clip Interaction Options Have One Source (#690)
- @dnd-kit/react v0.5.0 Event API Quirks: moved to the project skill `dnd-kit`
- SnapToGridModifier (Beats & Bars)
- Snap-to-Grid: Absolute Position, Not Delta

### Selection drag and keyboard shortcuts: `notes/selection-and-shortcuts.md`

Read before changing the selection drag, `useSelectionDrag`, or a keyboard shortcut.

- Shortcuts Yield to the Focused Control (#710)
- Selection Drag Is Followed on the Window
- The Selection Drag Commits on Release During Playback

### MIDI clip rendering: `notes/midi.md`

Read before changing how a MIDI clip is drawn.

- MIDI Clip Rendering Pipeline

### Unit tests of this package: `notes/testing.md`

Read before writing or changing a test in `src/__tests__` (after the skill `unit-testing`).

- Unit Tests
- jsdom Keyboard Event Testing Quirks

Moved to the project skill `react-patterns` (they are not specific to this package): "Derived State Sync: setState During Render, Not useEffect"; "Hook Isolation for Render Props"; "Debugging State Changes with console.trace"; "React Hook Patterns (cross-cutting)".

## The Provider Plays an Arrangement

`WaveformPlaylistProvider` takes a required `arrangement` prop (an `Arrangement` from `@waveform-playlist/engine`, made with `useCreateArrangement`) and has no `tracks`, `onTracksChange` or `deferEngineRebuild` prop (#812). It is a wrapper that keys its body on the arrangement object, so one mount has one arrangement. Each piece of state has one owner, as built:

| State | Owner | Where it is kept | How it is changed and read |
| --- | --- | --- | --- |
| Tracks and clips, clips still loading included | the arrangement | the arrangement | Its methods, reached below the provider with `useArrangement()`; `useClipDragHandlers` and `useClipSplitting` call `moveClip`, `trimClip`, `splitClip`. Read with `useArrangementTracks(arrangement)`, or as the provider's derived `usePlaylistTimeline()` |
| Mix by track id, and the mix of every undo and redo state | the arrangement | its mixer map; each saved state holds its own | `setTrackMute` / `Solo` / `Volume` / `Pan` of `useEditorControls()` (and `useTrack()`'s bound actions) call the arrangement's setters with the caller's `MixerChangeOptions` (`useArrangementEditing`): each call an undo step, a `gesture` id makes one drag one step (`<TrackVolumeSlider />` and `<TrackPanSlider />` hold one `createMixerGesture()` (core) each, `useSliderGesture` in `TrackControlPieces.tsx`). Undo and redo bring the mix back (#843). `trackStates` is derived |
| Undo and redo history | the arrangement | the arrangement | `undo`, `redo` of `useEditorControls()` call it; `canUndo` / `canRedo` are read from it. An engine rebuild does not touch it |
| Loading state: which sources are pending, loaded or failed | the arrangement (`arrangement.sources`) | the arrangement | `arrangement.retry(src)`. Read with `useArrangementSources(arrangement)`; the provider reads only `pendingCount`, for ready |
| The audio context sources are decoded with | the provider attaches it; the arrangement holds the getter while it is attached | `useDecodeContext` in `useEngineLifetime.ts` | Nobody else. The getter gives the current adapter's context and waits while there is none |
| The trim preview (a trim drag in progress) | the provider | one value source made by `useTrimPreview` | The drag handlers publish and clear it. The dragged clip's view and the root subscribe |
| Drags in progress (undo and redo do nothing meanwhile, #848) | the provider | one `createDragGuard()` counter (`providerInternals/dragGuard.ts`), not React state | `useClipDragHandlers` (clip move, trim) and `ClipInteractionProvider` (track reorder) begin it at dragstart and end it at dragend and on unmount; `useArrangementEditing`'s `undo` / `redo` read it. Nothing re-renders on it |
| The engine's lifetime (`engineRef`, `adapterRef`) | the provider | the build effect of `useEngineLifetime` | Nobody else builds or disposes. Built on mount, for a new `effects` function and for other zoom levels; never for a track change |
| `isReady` and "ready has fired" | the provider | `useReadyOnce` (state `hasBeenReady`, refs `firedRef` and `firstReadyRef`) over `isEngineAttached` of `useEngineLifetime` | Nobody. Read as `usePlaylistTimeline().isReady` |
| The take's mute: which track a take is recording onto | the arrangement (`recordingTrackIds`, outside the history) | the arrangement; the provider keeps only `recordingActiveRef` (whether a session is active) | `setRecordingActive` calls `arrangement.setTrackRecording` (one track at a time; `false` clears every recording id). `RecordingTrackContext` reads the set with `useSyncExternalStore`; `trackStates` derives `muted: stored \|\| recording`. The stored mute is never written by a take, so nothing is remembered or written back (#843) |
| Selection, loop, zoom, master volume, selected track | the engine | the engine; the hooks (`useSelectionState`, `useLoopState`, `useZoomControls`, `useMasterVolume`, `useSelectedTrack`) mirror it from `statechange` and seed each new engine from their refs. Zoom is seeded differently: a new engine is constructed with the provider's `engineSamplesPerPixelRef`, which the provider's `onEngineState` writes on every `statechange` (#901) | The hooks' setters |
| `isPlaying`, the cursor position | the provider | React state and refs in `WaveformPlaylistContext.tsx` | `play`, `pause`, `stop`, `seekTo`, `setSelection`, the animation loop, the engine-stop mirror |

Derived during render and never written back (`providerInternals/useArrangementView.ts`): `usePlaylistTimeline().tracks` (the arrangement's tracks without their loading clips), `peaksDataArray` (with a placeholder record, `isPlaceholder: true`, for a clip still loading), `duration` (loaded audio only), `trackStates`, `canUndo` / `canRedo`. The refs in that hook and the adapter's audio graph are one-way caches.

- The provider's own writes to the arrangement are the ones a caller asked for through `useEditorControls()` (mixer setters, `reorderTrack`, `undo`, `redo`, the take's mute of `setRecordingActive`) and clearing a recording track's take mute in its cleanup. Nothing in the library edits tracks from inside `arrangement.subscribe` or a `statechange` listener.
- The arrangement outlives every engine and the provider itself: an engine rebuild, a StrictMode remount and an `<Activity>` hide keep tracks, mix and history.
- A track the arrangement refuses throws at the call that offered it (`addTrack`, the `useCreateArrangement` initializer); `onError` is for an engine or adapter that cannot be built, and for an `onReady` that throws. A failed source is in `useArrangementSources`, not in `onError`.
- An arrangement's methods are class methods: wrap them before handing one to React (`(listener) => arrangement.subscribe(listener)`), as the three hooks do.
- Where each piece is described: `notes/provider-internals.md` (the hooks), `notes/playback-and-engine.md` ("Playlist Loading Detection", "The Engine Is Disposed on Unmount", "Engine State Subscription Pattern", "End-of-Timeline Semantics"), `notes/clip-drag-and-snap.md` (the trim preview), `notes/track-controls-and-reorder.md` (the mix), `notes/peaks.md` (placeholder records), and `packages/engine/CLAUDE.md`, "The arrangement owns the tracks".

## Optional Playout Engines (#510)

`@waveform-playlist/playout`, `@waveform-playlist/media-element-playout`, and `tone` are
**optional `peerDependencies`**. The providers load the default engine via dynamic
`import()` through `src/playout/resolvePlayoutAdapter.ts` / `resolveMediaElementPlayout.ts`
(factory-or-dynamic, install-hint rethrow — the `@dawcore/midi` `loadMidiImpl` pattern).
The hint's command comes from `installCommand()` (`src/utils/installCommand.ts`), which names
each package with the range this build peers on, or a caret on the version built with for a
package it does not peer on (spectrogram) (#884; root `CLAUDE.md`,
"Install Hints Name a Range Inside the Peer Range").

- `WaveformPlaylistProvider` accepts `createAdapter?: () => PlayoutAdapter`. When supplied,
  neither `@waveform-playlist/playout` nor `tone` is imported.
- `MediaElementPlaylistProvider` accepts `createPlayout?: () => MediaElementPlayout`.
- **The provider static import graph must stay engine-free** — enforced by
  `src/__tests__/staticEngineImports.test.ts`. Use `import type` for engine types and
  `await import()` for engine values. Adding a static engine import to those files fails CI.
- **Tier-3 (Tone-coupled) surface moved to `/tone`**, NOT left in the core graph (see the
  `/tone` subpath section below). In-graph modules that couldn't move were decoupled instead:
  `soundFontSync` (structural `setSoundFontCache` check, not `isToneAdapter` from playout) and
  `useAnnotationDragHandlers` (tone-free `sampleRate` default).
- **Sample rate at mount** is provisional (`sampleRate` prop or 48000) and set from
  `adapter.audioContext.sampleRate` when the first adapter exists (`useEngineLifetime`). A Tone
  consumer at 44100 Hz that passes no `sampleRate` prop sees 48000 until then; placeholder
  records are not built before the rate is known (`isSampleRateKnown`).
- **Removed in 14.0.0:** the `Tone` convenience re-export. Import `tone` directly.
- **Async effect cancel-race:** making a provider's init effect async (via `await import`) opens a dispose-before-resolve window. Both providers guard with a cancelled flag. For **WaveformPlaylistProvider** it is in `providerInternals/useEngineLifetime.ts`: the build effect's cleanup sets `run.cancelled = true`, and an adapter that resolves after that is disposed inside `buildEngine`'s `if (run.cancelled) { adapter.dispose(); return; }` (the live engine is disposed by the same cleanup: see "The Engine Is Disposed on Unmount"). In **MediaElementPlaylistContext** the cleanup itself disposes the `createdPlayout` capture.
- **Test the dynamic-import seam, not the provider:** factory-or-dynamic-import logic lives in
  tiny pure async modules (`resolvePlayoutAdapter`/`resolveMediaElementPlayout`), unit-tested
  directly — `vi.doMock(pkg, () => { throw })` simulates a missing peer (no-peer install-hint
  test); the bypass test asserts the factory short-circuits before `import()`. Avoids mounting
  the heavy provider in jsdom (separate file per `vi.doMock`, per the dawcore midi precedent).

### `/tone` subpath (Tone batteries-included surface)

The core `@waveform-playlist/browser` entry is structurally free of `tone`/`playout`
(verified transitively by `coreBarrelEngineFree.test.ts`). All Tone-coupled exports —
the effects hooks (`useDynamicEffects`, `useTrackDynamicEffects`, `useActiveEffects`) +
factory/definitions, the WAM pieces (`WamEffectGui`, `loadWamModule`,
`createWamEffectInstance`), `useExportWav` + `ExportWavButton`, `useOutputMeter`,
`useMasterAnalyser` — live at `@waveform-playlist/browser/tone` (`src/tone.ts`). A
MediaElement-only or custom-adapter consumer never resolves `tone`/`playout` under any
bundler. `useAudioTracks` and `useDynamicTracks` were here until #812 removed them (with
`AudioTrackConfig`, `TrackSource`, `TrackLoadError`): a track now names its audio in a clip
and the arrangement loads it, decoding with the current adapter's `AudioContext`. The
arrangement hooks (`useCreateArrangement`, `useArrangementTracks`, `useArrangementSources`,
`useArrangement`) are in the core entry: `@waveform-playlist/engine` has no Tone dependency.

## Build (tsup)

Uses tsup (same as all other packages). tsup auto-externalizes `dependencies` and `peerDependencies` — no manual `external` list needed. Previously used Vite with a manual external list that drifted (#317).

## Custom Hooks Architecture

**Pattern:** Extract complex logic into reusable custom hooks.

**Key Hooks:**

- `useClipDragHandlers` - Drag-to-move and boundary trimming on the provider's arrangement (`{ samplesPerPixel, snapSamplePosition? }`; no `tracks` or `engineRef` option): a move is one `arrangement.moveClip()` on drop, a trim a view-only preview and then one `arrangement.trimClip()` on release; clips found by id
- `useClipSplitting` - Split clips at playhead (`{ samplesPerPixel }`); `splitClipAt(trackId, clipId, splitTime)` takes ids and makes one `arrangement.splitClip()`
- `useKeyboardShortcuts` - Flexible keyboard shortcut system
- `usePlaybackShortcuts` - Default playback shortcuts (0 = rewind to start)
- `useAnnotationKeyboardControls` - Annotation navigation, editing, auto-scroll, and playback (`{ store, activeAnnotationId, … }`: the boundary keys update the store's current list, the active annotation found by id)
- `useCreateAnnotationStore` / `useStoredAnnotations` - The annotation store that owns the annotations (either provider's `annotationStore` prop), and a read of it that re-renders on a change (#867)
- `useDynamicEffects` - Master effects chain with runtime parameter updates
- `useTrackDynamicEffects` - Per-track effects management
- `useSelectionState` - Selection state (start/end) with engine delegation
- `useLoopState` - Loop state (enabled, start, end) with engine delegation
- `useSelectedTrack` - Selected track ID with engine delegation
- `useZoomControls` - Zoom state (samplesPerPixel, canZoomIn/Out) with engine delegation
- `useMasterVolume` - Master volume with engine delegation
- `useCreateArrangement`, `useArrangementTracks`, `useArrangementSources` - Over an engine `Arrangement` (`src/hooks/useCreate*.ts`, `useArrangement*.ts`; core entry). `useCreateArrangement` reads `init` and `options` once and an initializer that throws goes to the render's error boundary; the other two are `useSyncExternalStore` over `arrangement.subscribe` and `arrangement.sources` (`arrangementHooks.test.tsx`). `WaveformPlaylistProvider` takes the arrangement as its `arrangement` prop, and `useArrangement()` returns it below the provider: see "The Provider Plays an Arrangement".
- `useRecordingSession` - Tells the provider that a take is recorded into a track while `isRecording` (`setRecordingActive` in an effect with cleanup)
- `ClipPeaks.isPlaceholder` (required) marks the record of a clip that is still loading, built by the internal `placeholderPeaks` (`src/utils/placeholderPeaks.ts`, not exported from the entry); `ui-components`' `Clip` draws it without drag and trim handles. `WaveformPlaylistProvider` puts such a record in a track's row of `peaksDataArray` for each clip still loading that has usable `waveformData` or a `duration` (`deriveRows` in `providerInternals/useArrangementView.ts`); records of loaded clips (`derivePeaks.ts`) and every record of `MediaElementPlaylistProvider` have it `false`, and `sameClipPeaks` compares it.
- `useTimeFormat`, etc.

**Location:** `src/hooks/`

## Important Patterns (Browser-Specific)

- **Context Value Memoization** - All context value objects in providers must be wrapped with `useMemo`. Extract inline callbacks into `useCallback` first to avoid dependency churn. A `useMemo` holds only while EVERY dependency keeps its identity, and one unstable entry among ~40 fails silently (#691: a non-memoized `formatTime` from a helper hook rebuilt `controlsValue` on every provider render). Three rules: (1) object props that consumers write inline (`controls`, `theme`) go through `useShallowStable` before being used as a dependency, and defaults are module constants, never inline literals in the destructuring; (2) callbacks in a context value must not depend on state they only read or update — use functional `setState((prev) => …)` and the existing refs (`isPlayingRef`), which also avoids dropped updates when two setters run in one batch; (3) any new field in a context value needs a case in `__tests__/contextValueStability.test.tsx`, which asserts the identities directly. Nothing derived from state belongs in the controls value, only actions, refs and sources (#767 removed two things that moved it, `duration` and a `formatTime` rebuilt per time format; the tests pin it per trigger, not as a whole).
- **Fetch Cleanup with AbortController** - No hook of this package fetches audio since #812 (`useAudioTracks` did): the arrangement loads the sources its clips name through core's `createSourceLoader`, which makes one `AbortController` per load and hands the load its signal, and the provider's part is the cleanup of its decode-context effect, which detaches the context and so aborts the loads in flight. For any other fetch in a `useEffect`, abort in the cleanup; for per-item abort use `Map<id, AbortController>` instead of `Set<AbortController>`.
- **Guard Before State Update in Callbacks** - In callbacks that update both React state and audio engine, validate inputs (e.g., trackId lookup) BEFORE calling `setState`. If the guard is after `setState`, invalid inputs cause UI/audio desync (UI updates but audio doesn't).
- **RefObject Nullability** - In `@types/react` 19, `React.RefObject<T>` has `current: T`, and `useRef<T>(initial)` returns `RefObject<T>`. A ref that can be empty says so in its type (`RefObject<HTMLDivElement | null>`, from `useRef<HTMLDivElement>(null)`); a ref typed `RefObject<number>` or `RefObject<boolean>` needs no `?? 0` / `?? false` at the call site. The React 18 types had `readonly current: T | null`; the `.current ?? 0` / `?? false` reads still in browser's source and in ui-components' `Playhead.tsx` (20 on 2026-11-23) date from then, and TypeScript no longer needs them. Do not add new ones.
- **Provider-Level Concerns Stay in Provider** - Callbacks with cross-cutting side-effects (e.g., `setSelection` updates currentTime and restarts playback, `setLoopRegionFromSelection` reads from selection hook and writes to loop hook) belong in the provider, not in individual state hooks. Hooks handle engine delegation + state mirroring only.

## Tone.js Usage Outside the Playout Package

- **Dynamic Import Tone.js** — `import * as Tone from 'tone'` eagerly creates a default context with AudioWorklet nodes, which fails before user gesture. Use `import type` for types and `await import('tone')` inside effects after AudioContext is running. Call `Tone.setContext(new Tone.Context(audioContext))` to share the native AudioContext.
- **`Tone.js Effect.input` Is Not a Native AudioNode** — `Effect` subclasses (BitCrusher, etc.) set `this.input = new Tone.Gain(...)` (a Tone wrapper). Native `AudioNode.connect(effect.input)` fails with "Overload resolution failed". Use `Tone.Gain` as a bridge: `outputNode.connect(bridge.input)` works because `Tone.Gain.input` IS a native `GainNode`. Then `bridge.chain(effect, destination)` for the Tone chain.
