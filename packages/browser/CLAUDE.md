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

Read before changing `WaveformPlaylistContext.tsx`, `MediaElementPlaylistContext.tsx` or `providerInternals/`, or moving a hook between the two providers.

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

Read before changing the annotation list, the annotation boxes, their edge drag or the annotation options.

- One Annotation List and One Row of Boxes for Both Players (#744)
- Annotation Edge Drag: Preview Source, One Report per Drag
- Annotation Parts Own Their Options; the Options Are Provider State (#686)

### Playback, the engine's lifetime and loading: `notes/playback-and-engine.md`

Read before changing how the provider builds, rebuilds or disposes the engine, how tracks reach it, play / pause / stop / seek, the animation loop, or the end of the timeline.

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
- Incremental Track Addition (loadAudio optimization)
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
- @dnd-kit/react v0.5.0 Event API Quirks
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

## Optional Playout Engines (#510)

`@waveform-playlist/playout`, `@waveform-playlist/media-element-playout`, and `tone` are
**optional `peerDependencies`**. The providers load the default engine via dynamic
`import()` through `src/playout/resolvePlayoutAdapter.ts` / `resolveMediaElementPlayout.ts`
(factory-or-dynamic, install-hint rethrow — the `@dawcore/midi` `loadMidiImpl` pattern).

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
- **Sample rate at mount** is provisional (`sampleRate` prop or 48000) and reconciled from
  `adapter.audioContext.sampleRate` on first `loadAudio`. A Tone consumer at 44100 Hz that
  passes no `sampleRate` prop sees 48000 for the brief pre-first-load window.
- **Removed in 14.0.0:** the `Tone` convenience re-export. Import `tone` directly.
- **Async effect cancel-race:** making a provider's init effect async (via `await import`) opens a dispose-before-resolve window. Both providers guard with `let cancelled = false`. In **WaveformPlaylistContext** the cleanup sets `cancelled = true`, and an adapter that resolves after that is disposed inside the async `loadAudio` body's `if (cancelled) { adapter.dispose(); return; }` (the live engine is disposed by the cleanup and on unmount: see "The Engine Is Disposed on Unmount"). In **MediaElementPlaylistContext** the cleanup itself disposes the `createdPlayout` capture.
- **Test the dynamic-import seam, not the provider:** factory-or-dynamic-import logic lives in
  tiny pure async modules (`resolvePlayoutAdapter`/`resolveMediaElementPlayout`), unit-tested
  directly — `vi.doMock(pkg, () => { throw })` simulates a missing peer (no-peer install-hint
  test); the bypass test asserts the factory short-circuits before `import()`. Avoids mounting
  the heavy provider in jsdom (separate file per `vi.doMock`, per the dawcore midi precedent).

### `/tone` subpath (Tone batteries-included surface)

The core `@waveform-playlist/browser` entry is structurally free of `tone`/`playout`
(verified transitively by `coreBarrelEngineFree.test.ts`). All Tone-coupled exports —
`useAudioTracks`, `useDynamicTracks`, the effects hooks + factory/definitions,
`useExportWav` + `ExportWavButton`, `useOutputMeter`, `useMasterAnalyser` — live at
`@waveform-playlist/browser/tone`. A MediaElement-only or custom-adapter consumer never
resolves `tone`/`playout` under any bundler. `useAudioTracks`/`useDynamicTracks` moved
here because they decode on the Tone global context.

## Build (tsup)

Uses tsup (same as all other packages). tsup auto-externalizes `dependencies` and `peerDependencies` — no manual `external` list needed. Previously used Vite with a manual external list that drifted (#317).

## Custom Hooks Architecture

**Pattern:** Extract complex logic into reusable custom hooks.

**Key Hooks:**

- `useClipDragHandlers` - Drag-to-move and boundary trimming
- `useClipSplitting` - Split clips at playhead
- `useKeyboardShortcuts` - Flexible keyboard shortcut system
- `usePlaybackShortcuts` - Default playback shortcuts (0 = rewind to start)
- `useAnnotationKeyboardControls` - Annotation navigation, editing, auto-scroll, and playback
- `useDynamicEffects` - Master effects chain with runtime parameter updates
- `useTrackDynamicEffects` - Per-track effects management
- `useDynamicTracks` - Runtime track additions with placeholder-then-replace pattern
- `useSelectionState` - Selection state (start/end) with engine delegation
- `useLoopState` - Loop state (enabled, start, end) with engine delegation
- `useSelectedTrack` - Selected track ID with engine delegation
- `useZoomControls` - Zoom state (samplesPerPixel, canZoomIn/Out) with engine delegation
- `useMasterVolume` - Master volume with engine delegation
- `useTimeFormat`, etc.

**Location:** `src/hooks/`

## Important Patterns (Browser-Specific)

- **Context Value Memoization** - All context value objects in providers must be wrapped with `useMemo`. Extract inline callbacks into `useCallback` first to avoid dependency churn. A `useMemo` holds only while EVERY dependency keeps its identity, and one unstable entry among ~40 fails silently (#691: a non-memoized `formatTime` from a helper hook rebuilt `controlsValue` on every provider render). Three rules: (1) object props that consumers write inline (`controls`, `theme`) go through `useShallowStable` before being used as a dependency, and defaults are module constants, never inline literals in the destructuring; (2) callbacks in a context value must not depend on state they only read or update — use functional `setState((prev) => …)` and the existing refs (`isPlayingRef`), which also avoids dropped updates when two setters run in one batch; (3) any new field in a context value needs a case in `__tests__/contextValueStability.test.tsx`, which asserts the identities directly. Nothing derived from state belongs in the controls value, only actions, refs and sources (#767 removed two things that moved it, `duration` and a `formatTime` rebuilt per time format; the tests pin it per trigger, not as a whole).
- **Fetch Cleanup with AbortController** - `useAudioTracks` uses AbortController to cancel in-flight fetches on cleanup. Follow this pattern for any fetch in useEffect. For per-item abort (e.g., removing one loading track), use `Map<id, AbortController>` instead of `Set<AbortController>`.
- **Guard Before State Update in Callbacks** - In callbacks that update both React state and audio engine, validate inputs (e.g., trackId lookup) BEFORE calling `setState`. If the guard is after `setState`, invalid inputs cause UI/audio desync (UI updates but audio doesn't).
- **RefObject Nullability** - `React.RefObject<T>` has `current: T | null` in React 18 types, even when initialized with a value. Call sites accessing hook-returned refs need `?? 0` (numbers) or `?? false` (booleans) fallbacks to satisfy TypeScript, even though the values are never actually null at runtime.
- **Provider-Level Concerns Stay in Provider** - Callbacks with cross-cutting side-effects (e.g., `setSelection` updates currentTime and restarts playback, `setLoopRegionFromSelection` reads from selection hook and writes to loop hook) belong in the provider, not in individual state hooks. Hooks handle engine delegation + state mirroring only.

## Tone.js Usage Outside the Playout Package

- **Dynamic Import Tone.js** — `import * as Tone from 'tone'` eagerly creates a default context with AudioWorklet nodes, which fails before user gesture. Use `import type` for types and `await import('tone')` inside effects after AudioContext is running. Call `Tone.setContext(new Tone.Context(audioContext))` to share the native AudioContext.
- **`Tone.js Effect.input` Is Not a Native AudioNode** — `Effect` subclasses (BitCrusher, etc.) set `this.input = new Tone.Gain(...)` (a Tone wrapper). Native `AudioNode.connect(effect.input)` fails with "Overload resolution failed". Use `Tone.Gain` as a bridge: `outputNode.connect(bridge.input)` works because `Tone.Gain.input` IS a native `GainNode`. Then `bridge.chain(effect, destination)` for the Tone chain.
