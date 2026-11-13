# Project Structure

## Overview

Waveform-playlist is a **monorepo** organized with pnpm workspaces. It's a multitrack Web Audio editor and player with canvas-based waveform visualizations.

**Stack:** React + Tone.js + styled-components (`@waveform-playlist/*` packages); Lit Web Components + native Web Audio (`@dawcore/*` packages)

## Monorepo Structure

```
waveform-playlist/
├── packages/              # Workspace packages (modular architecture)
│   ├── annotations/       # 📦 OPTIONAL: Annotation components & hooks
│   ├── browser/           # Main React package (provider, hooks, components)
│   ├── core/              # Core types and interfaces
│   ├── dawcore/           # Web Components (Lit) — framework-agnostic DAW UI (@dawcore/components)
│   ├── dawcore-faust/     # @dawcore/faust — in-browser Faust DSP → WAM compilation
│   ├── dawcore-midi/      # @dawcore/midi — framework-agnostic MIDI parsing (optional peer of dawcore)
│   ├── dawcore-spectrogram/  # Framework-agnostic FFT computation, worker, viewport orchestrator
│   ├── dawcore-wam/       # @dawcore/wam — WAM 2.0 plugin hosting (host, loader, GUI, library, transport bridge)
│   ├── engine/            # Framework-agnostic timeline engine
│   ├── media-element-playout/  # Audio playback (HTMLAudioElement, no Tone.js)
│   ├── midi/              # 📦 OPTIONAL: MIDI file parsing + useMidiTracks hook (parser now in @dawcore/midi)
│   ├── playout/           # Audio playback (Tone.js wrapper)
│   ├── recording/         # 📦 OPTIONAL: Audio recording hooks (no UI components)
│   ├── spectrogram/       # 📦 OPTIONAL: React Provider + UI for spectrograms (computation/worker in @dawcore/spectrogram)
│   ├── transport/         # @dawcore/transport — native Web Audio transport (clock, scheduler, clip player)
│   ├── ui-components/     # Reusable React UI components (incl. SegmentedVUMeter)
│   ├── webaudio-peaks/    # Waveform peak generation
│   └── worklets/          # Shared AudioWorklet processors (metering, recording)
│
├── examples/              # Standalone Vite example apps (decoupled from package builds)
│   ├── dawcore-native/    # Web Components + NativePlayoutAdapter (basic, multiclip, effects, record, …)
│   ├── dawcore-tone/      # Web Components + TonePlayoutAdapter (Tone.js backend, MIDI, SoundFont)
│   ├── dawcore-wam/       # WAM 2.0 plugins end-to-end (library picker, GUIs, Faust compilation, export)
│   └── media-element-player/  # React MediaElementPlaylistProvider starter (no Tone.js/playout deps)
│
├── debug/                 # Standalone reproductions and debug apps
│   ├── tonejs/            # HTML reproductions of upstream Tone.js bugs
│   ├── standalone-midi/   # Vite+React app for isolating rendering bugs
│   └── standalone-multi-clip/  # Vite+React multi-clip debug app
│
├── e2e/                   # Playwright end-to-end tests
│
└── website/               # Docusaurus documentation site
    ├── src/
    │   ├── components/examples/  # React example components (20 examples)
    │   │   ├── MinimalExample.tsx
    │   │   ├── StemTracksExample.tsx
    │   │   ├── StereoExample.tsx
    │   │   ├── EffectsExample.tsx
    │   │   ├── FadesExample.tsx
    │   │   ├── NewTracksExample.tsx
    │   │   ├── MultiClipExample.tsx
    │   │   ├── AnnotationsExample.tsx
    │   │   ├── RecordingExample.tsx
    │   │   ├── RecordingControls.tsx         # Recording UI helper (not an example)
    │   │   ├── BeatsAndBarsExample.tsx       # BPM, time signature, snap-to-grid
    │   │   ├── MidiExample.tsx               # MIDI playback with piano roll
    │   │   ├── FlexibleApiExample.tsx
    │   │   ├── StylingExample.tsx
    │   │   ├── WaveformDataExample.tsx       # BBC peaks demo
    │   │   ├── MediaElementExample.tsx       # HTMLAudioElement streaming
    │   │   ├── MirSpectrogramExample.tsx     # Spectrogram visualization
    │   │   ├── MobileAnnotationsExample.tsx  # Mobile-optimized annotations
    │   │   ├── MobileMultiClipExample.tsx    # Mobile-optimized multi-clip
    │   │   ├── WcBasicExample.tsx            # Web Components (<daw-editor>) basic
    │   │   └── WcMulticlipExample.tsx        # Web Components multi-clip
    │   ├── pages/examples/       # Example page wrappers
    │   ├── hooks/                # Docusaurus-specific hooks
    │   │   └── useDocusaurusTheme.ts
    │   └── theme/                # Theme customizations
    │       └── Root.tsx          # Radix Themes provider
    ├── static/media/audio/       # Audio and peaks files
    │   ├── *.mp3                 # Audio files
    │   └── *-8bit.dat            # BBC pre-computed peaks
    └── docusaurus.config.ts      # Webpack aliases for workspace packages
```

## Package Descriptions

### 🎯 Core Packages

#### `@waveform-playlist/core`

- **Purpose:** Core TypeScript interfaces, types, and utilities
- **Exports:** AudioClip, ClipTrack, Timeline interfaces, factory functions, clip time helpers, dB/beats utilities, keyboard shortcuts
- **Dependencies:** None (pure types and math)
- **Used by:** All other packages
- **Utilities:**
  - `clipTimeHelpers.ts` — `clipStartTime`, `clipEndTime`, `clipOffsetTime`, `clipDurationTime`, `clipPixelWidth` (sample-to-seconds/pixel conversions)
  - `dBUtils.ts` — `dBToNormalized`, `normalizedToDb`, `gainToNormalized` (dB ↔ 0-1 conversions for VU meters)
  - `valueSource.ts` — `ValueSource<T>` (`subscribe` + `getSnapshot`), `createValueSource()`, `MeterLevels`/`MeterSource`, `RecordingProgress`/`RecordingProgressSource`, `silentMeterLevels()` (values that change ~60 times a second and are kept out of UI state)
  - `utils/meterLevels.ts` — `readMeterMessage()` (one meter-worklet message → `MeterLevels`; shared by `useOutputMeter` and `useMicrophoneLevel`)
  - `beatsAndBars.ts` — `PPQN` (192), `ticksPerBeat`, `ticksPerBar`, `ticksToSamples`, `samplesToTicks`, `snapToGrid`, `ticksToBarBeatLabel`
  - `keyboard.ts` — `KeyboardShortcut` type, `handleKeyboardEvent()` (matches event to shortcut array), `getShortcutLabel()` (human-readable label from shortcut definition)
  - `spectrogramCanvasId.ts` — `buildSpectrogramCanvasId()`/`parseSpectrogramCanvasId()`: the canonical `${clipId}-ch${channelIndex}-chunk${chunkIndex}` canvas-ID contract, single-sourced here (zero-dependency, already a dependency of every producer/consumer) so `@waveform-playlist/spectrogram`, `@dawcore/spectrogram`, and the `<daw-spectrogram>` element can't drift on the format (#560)

**Important Architectural Decision: Sample-Based Representation**

All clip positions and durations are stored as **integer sample counts** (not floating-point seconds):

```typescript
interface AudioClip {
  id: string;
  audioBuffer: AudioBuffer;
  startSample: number;        // Position on timeline (samples)
  durationSamples: number;    // Clip duration (samples)
  offsetSamples: number;      // Trim start position (samples)
  // ...
}
```

**Why samples instead of seconds?**
- ✅ Eliminates floating-point precision errors
- ✅ Perfect pixel alignment in rendering (no 1-pixel gaps)
- ✅ Mathematically exact calculations (all integers)
- ✅ No precision loss when converting between time/samples/pixels

**User-Facing API:**
Users can still create clips using seconds via `createClipFromSeconds()` helper:
```typescript
const clip = createClipFromSeconds({
  audioBuffer,
  startTime: 5.0,    // Converted to samples internally
  duration: 10.0,
  offset: 2.5,
});
// Internally stored as: startSample, durationSamples, offsetSamples
```

**Location:** `packages/core/src/types/clip.ts`

#### `@waveform-playlist/webaudio-peaks`

- **Purpose:** Generate waveform visualization data from audio buffers
- **Exports:** Peak data structures, peak generation functions
- **Key concept:** Converts AudioBuffer → peak data for canvas rendering
- **Dependencies:** Core

#### `@waveform-playlist/engine`

- **Purpose:** Framework-agnostic timeline engine — stateful `PlaylistEngine` class with event emitter
- **Architecture:** Two layers — pure operations functions + stateful class
  - `operations/clipOperations.ts` — Drag constraints, boundary trim, split
  - `operations/viewportOperations.ts` — Bounds, chunks, scroll threshold
  - `operations/timelineOperations.ts` — Duration, zoom, seek
  - `PlaylistEngine.ts` — Composes operations with state + events
- **Build:** tsup (not vite) — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS.
- **Testing:** vitest unit tests in `src/__tests__/`. Run with `npx vitest run` from `packages/engine/`.
- **Key Types:** `PlayoutAdapter` (pluggable audio backend, optional `addTrack()` for incremental additions), `EngineState` (state snapshot incl. `tracksVersion`/`mixerVersion`), `EngineEvents` (statechange, play/pause/stop)
- **State Ownership:** Engine owns selection, loop, selectedTrackId, zoom, masterVolume, and tracks (for clip mutations). React subscribes to `statechange` events.
- **Clip Mutations:** `moveClip()`, `trimClip()`, `splitClip()` update internal tracks, sync adapter via `adapter.setTracks()`, and emit `statechange`. The browser package's provider mirrors updated tracks back to the parent via `onTracksChange`.
  - `moveClip()` returns constrained delta (number). Accepts optional `skipAdapter` parameter to skip adapter sync during high-frequency drags.
  - `trimClip()` accepts optional `skipAdapter` parameter.
  - `getClipBounds()` — returns clip boundary info for constraint calculations.
  - `constrainTrimDelta()` — wraps pure `constrainBoundaryTrim` for per-frame collision detection during trim drag.
- **Undo/Redo:** Built-in undo stack with configurable `undoLimit` (default 100). `undo()`, `redo()`, `canUndo`, `canRedo` getters. Transactions (`beginTransaction()` / `commitTransaction()` / `abortTransaction()`) group multiple mutations (e.g., a drag gesture) into a single undo step. `_transactionMutated` flag prevents phantom undo entries from no-op drags.
- **Dependencies:** Only peer dependency is `@waveform-playlist/core`
- **No React, no Tone.js** — zero framework dependencies

### 🎨 UI Layer

#### `@waveform-playlist/ui-components`

- **Purpose:** Reusable React components for waveform UI
- **Tech:** React, styled-components
- **Structure:**
  ```
  src/
  ├── components/        # Public components
  │   ├── Playlist.tsx           # Main container
  │   ├── Track.tsx              # Individual track
  │   ├── Clip.tsx               # Audio clip (draggable)
  │   ├── ClipHeader.tsx         # Draggable title bar
  │   ├── ClipBoundary.tsx       # Trim handles (left/right edges)
  │   ├── Channel.tsx            # Waveform canvas rendering
  │   ├── SmartChannel.tsx       # Auto-selects Channel/PianoRoll/Spectrogram
  │   ├── PianoRollChannel.tsx   # MIDI piano roll canvas
  │   ├── SpectrogramChannel.tsx # Spectrogram canvas (chunked)
  │   ├── SpectrogramLabels.tsx  # Frequency axis labels
  │   ├── Playhead.tsx           # Playback position indicator
  │   ├── Selection.tsx          # Selection overlay
  │   ├── LoopRegion.tsx         # Loop region overlay
  │   ├── FadeOverlay.tsx        # Fade in/out visualization
  │   ├── SegmentedVUMeter.tsx   # LED-style VU meter (multi-channel; `meter` source or `levels` props)
  │   ├── ErrorBoundary.tsx      # PlaylistErrorBoundary (plain CSS)
  │   ├── AudioPosition.tsx      # Current time display
  │   ├── TimeInput.tsx          # Time value input
  │   ├── SelectionTimeInputs.tsx # Selection start/end inputs
  │   ├── TimeScale.tsx          # Timeline ruler
  │   ├── SmartScale.tsx         # Beats/bars or time scale
  │   ├── TimeFormatSelect.tsx   # Time format dropdown
  │   ├── MasterVolumeControl.tsx # Volume slider
  │   ├── AutomaticScrollCheckbox.tsx # Auto-scroll toggle
  │   ├── PlaybackRateSelect.tsx # Playback speed dropdown
  │   ├── TrackMenu.tsx          # Per-track dropdown menu
  │   └── TrackControls/         # The primitives a track control panel is built from
  │       ├── Controls.tsx       # Panel container (fills its slot)
  │       ├── Header.tsx         # Header row (the track name)
  │       ├── Button.tsx         # Compact button (mute, solo)
  │       ├── ButtonGroup.tsx    # Button group layout
  │       ├── CloseButton.tsx    # Close/remove button
  │       ├── Slider.tsx         # Range slider
  │       ├── SliderWrapper.tsx  # Slider row with icons
  │       ├── ReorderRail.tsx    # Drag grip with move up / move down buttons
  │       ├── GripIcon.tsx       # Drag grip icon
  │       ├── MoveUpIcon.tsx     # Move up icon
  │       ├── MoveDownIcon.tsx   # Move down icon
  │       ├── DotsIcon.tsx       # Menu dots icon
  │       ├── TrashIcon.tsx      # Delete icon
  │       ├── VolumeDownIcon.tsx # Volume down icon
  │       ├── VolumeUpIcon.tsx   # Volume up icon
  │       └── index.tsx
  ├── contexts/          # React contexts
  │   ├── ScrollViewport.tsx    # Virtual scrolling: viewport state, chunk visibility
  │   ├── ClipViewportOrigin.tsx # Clip pixel offset for correct chunk culling
  │   ├── BeatsAndBars.tsx      # BPM, time signature, snap config, scale mode
  │   └── ...                   # Theme, playlist info, playout contexts
  ├── utils/             # Utilities (time formatting, conversions)
  ├── styled/            # Shared styled components
  │   ├── CheckboxStyles.tsx  # Checkbox, label, wrapper
  │   └── ButtonStyles.tsx    # ControlButton with variants
  ├── wfpl-theme.ts      # Theme interface and default theme
  ├── styled.d.ts        # styled-components type augmentation
  └── index.tsx          # Public API
  ```
- **Shared Styled Components:**
  - **Pattern:** Extract commonly duplicated styled components into `styled/` directory
  - **CheckboxStyles:** Shared checkbox components used across all checkbox controls
    - `CheckboxWrapper`, `StyledCheckbox`, `CheckboxLabel`
    - ~60% code reduction in checkbox components
  - **ButtonStyles:** Shared button component with color variants
    - `ControlButton` - Large control button (primary/success/info variants)
    - Separate from `TrackControls/Button` (compact UI button)
  - **Benefits:** DRY principle, consistent styling, easier maintenance
- **Theming System:**
  - **Architecture:** Centralized theme defined in `wfpl-theme.ts`, provided via `WaveformPlaylistProvider` → styled-components `ThemeProvider` → `useTheme()` hook
  - **Theme Interface:** `WaveformPlaylistTheme` defines all visual properties
    - Waveform colors: `waveOutlineColor`, `waveFillColor`, `waveProgressColor`
    - Timescale: `timeColor`, `timescaleBackgroundColor`
    - Playback UI: `playheadColor`, `selectionColor`
    - Clip headers: `clipHeaderBackgroundColor`, `clipHeaderBorderColor`, `clipHeaderTextColor`
  - **Default Theme:** Exported `defaultTheme` object with sensible defaults
  - **Type Safety:** `styled.d.ts` extends styled-components' `DefaultTheme` for autocomplete
  - **Pattern:** Components access theme via `props.theme.propertyName` in styled components
    ```typescript
    const Header = styled.div`
      background: ${props => props.theme.clipHeaderBackgroundColor};
      color: ${props => props.theme.clipHeaderTextColor};
    `;
    ```
  - **Benefits:**
    - ✅ Single source of truth for all visual properties
    - ✅ TypeScript autocomplete for theme properties
    - ✅ No prop drilling (colors from context, not props)
    - ✅ Consistent theming across all components
  - **Location:** `packages/ui-components/src/wfpl-theme.ts`, `packages/ui-components/src/styled.d.ts`
- **Key components:**
  - `Playlist` - Main container component
  - `Track` - Individual waveform track
  - `Clip` - Audio clip with optional draggable header
  - `ClipHeader` - Draggable title bar for clips (uses theme)
  - `ClipBoundary` - Trim handles (left/right edges)
  - `Channel` / `SmartChannel` - Waveform rendering with device pixel ratio
  - `PianoRollChannel` - MIDI piano roll canvas rendering (chunked)
  - `SpectrogramChannel` - Spectrogram canvas rendering (chunked)
  - `SpectrogramLabels` - Frequency axis labels
  - `FadeOverlay` - Fade in/out visualization
  - `LoopRegion` - Loop region overlay
  - `SegmentedVUMeter` - LED-style VU meter (horizontal/vertical, multi-channel, configurable dB range/color stops/peak hold). Takes a `MeterSource` (`meter` prop, drawn directly to the DOM) or `levels`/`peakLevels` props
  - `useThrottledValue` / `useMeterLevels` (`src/hooks/useThrottledValue.ts`) - a `ValueSource` as React state, at most `updateRate` times a second
  - `PlaylistErrorBoundary` - Error boundary with plain CSS (no ThemeProvider dependency)
  - `TimeInput` / `SelectionTimeInputs` - Time value inputs
  - `TimeScale` / `SmartScale` - Timeline ruler (`getScaleInfo()` exported for grid calculations)
  - `TimeFormatSelect` - Time format dropdown
  - `PlaybackRateSelect` - Playback speed dropdown (base component; the browser package's wrapper reads `usePlaybackRate()`)
  - `Playhead` - Playback position indicator
  - `Selection` - Selection overlay
  - `AudioPosition` - Current time display
  - `MasterVolumeControl` - Volume slider
  - `AutomaticScrollCheckbox` - Auto-scroll toggle
  - `TrackMenu` - Per-track dropdown menu
  - `TrackControls/` - Mute, solo, volume, pan controls
  - `BeatsAndBarsProvider` - Context for BPM, time signature, snap-to-grid config. Drives `SmartScale` beats/bars mode and `SnapToGridModifier`. `useBeatsAndBars()` hook for consumers.
- **Virtual Scrolling:**
  - `ScrollViewportProvider` wraps the scrollable container, tracks scroll position via `useSyncExternalStore` with RAF-throttled listener + ResizeObserver
  - `useScrollViewport()` returns full viewport state; `useScrollViewportSelector()` for fine-grained subscriptions
  - `useVisibleChunkIndices(totalWidth, chunkWidth, originX?)` returns memoized array of visible chunk indices. `originX` converts local chunk coordinates to global viewport space
  - `ClipViewportOriginProvider` wraps each clip's channels, supplying the clip's pixel `left` offset. Without it, clips not at position 0 get incorrect chunk culling
  - 1.5x viewport overscan buffer on each side; 100px scroll threshold skips updates that won't affect chunk visibility
  - Components affected: `TimeScale`, `Channel`, `SpectrogramChannel` — all use absolute positioning (`left: chunkIndex * 1000px`)

#### `@waveform-playlist/browser`

- **Purpose:** Main React package — provider, hooks, components, effects
- **Structure:**
  ```
  src/
  ├── index.tsx                         # Main entry point + API exports
  ├── WaveformPlaylistContext.tsx        # Context provider (flexible API)
  ├── MediaElementPlaylistContext.tsx    # Context provider (HTMLAudioElement)
  ├── AnnotationIntegrationContext.tsx   # Optional annotation integration
  ├── SpectrogramIntegrationContext.tsx  # Optional spectrogram integration
  ├── contexts/
  │   ├── playlistContexts.ts           # The context objects, value types and hooks of both providers (imports no provider and no engine)
  │   └── ClipInteractionContext.tsx    # Clip interaction options (ClipInteractionOptions)
  ├── providerInternals/                # What both providers are built from (internal; only the FrameData type is exported)
  │   ├── useAnnotationState.ts         # annotations, setAnnotations, preview, active id, the three options (state that follows the annotationList prop); AnnotationListProp
  │   ├── useScrollFollow.ts            # scroll container, automatic scroll, centrePlayhead()
  │   ├── useFrameCallbacks.ts          # frame-callback registry + FrameData
  │   ├── followAnnotations.ts          # annotation step of the animation loop (pure)
  │   ├── useViewDefaults.ts            # merged theme, progressBarWidth
  │   └── useRequiredContext.ts         # a throwing context read (the providers' hooks use useSlot in contexts/playlistContexts.ts)
  ├── hooks/                            # Custom hooks
  │   ├── useAnimationFrameLoop.ts      # Shared rAF loop for providers
  │   ├── useAnnotationDragHandlers.ts  # Annotation drag logic
  │   ├── useAnnotationKeyboardControls.ts # Annotation navigation & editing
  │   ├── useAnnotationsWithPreview.ts  # The annotations to draw while an edge drag is in progress
  │   ├── usePlayAnnotation.ts          # What a click on a box or a list row does: make the annotation active and play it
  │   ├── useAudioEffects.ts            # Audio effects management
  │   ├── useAudioTracks.ts             # Track loading and management
  │   ├── useClipDragHandlers.ts        # Clip drag/move/trim (delegates to engine)
  │   ├── useClipSplitting.ts           # Split clips at playhead (delegates to engine)
  │   ├── useDragSensors.ts             # @dnd-kit sensor config
  │   ├── useDynamicEffects.ts          # Master effects chain
  │   ├── useDynamicTracks.ts           # Runtime track additions (placeholder-then-replace)
  │   ├── useExportWav.ts               # WAV export via Tone.Offline
  │   ├── useKeyboardShortcuts.ts       # Flexible keyboard shortcut system
  │   ├── useLoopState.ts               # Loop state (engine delegation + onEngineState)
  │   ├── useMasterVolume.ts            # Master volume (engine delegation + onEngineState)
  │   ├── useOutputMeter.ts             # Master bus output VU metering via worklet (returns a MeterSource)
  │   ├── usePlaybackShortcuts.ts       # Default playback shortcuts
  │   ├── useRecordingLayout.ts         # Channel count and stepped timeline end of a take in progress
  │   ├── useRecordingSession.ts        # Tells the provider a take is running (setRecordingActive in an effect)
  │   ├── useSelectedTrack.ts           # Selected track ID (engine delegation + onEngineState)
  │   ├── useSelectionDrag.ts           # The selection drag of both views; commits on release during playback
  │   ├── useSelectionState.ts          # Selection state (engine delegation + onEngineState)
  │   ├── useTimeFormat.ts              # Time formatting
  │   ├── useTrackDynamicEffects.ts     # Per-track effects
  │   ├── useTrackReorderHandle.ts      # Reorder drag handle for the track whose panel the caller is in (dnd-kit sortable)
  │   ├── useUndoState.ts              # Undo/redo state (engine delegation + onEngineState)
  │   ├── useWaveformDataCache.ts       # Web worker peak generation per AudioBuffer (lookup + version counter)
  │   └── useZoomControls.ts            # Zoom state (engine delegation + onEngineState)
  ├── components/                       # React components
  │   ├── WaveformRoot.tsx              # Root of the multitrack view: timeline length, row layout, row selection on press, spectrogram modal
  │   ├── waveformParts.tsx             # The parts by name (exported), the timescale part, sortWaveformParts
  │   ├── partWarnings.ts               # Development-only warnings, once per message: a part rendered where it cannot work, a call with an argument of an older signature
  │   ├── waveformLayoutContext.ts      # A root's two layout values (extent, rows) read by the parts
  │   ├── TrackRows.tsx                 # Tracks part: memoized rows, clips, recording preview; per-clip markers
  │   ├── TrackControlsColumn.tsx       # Track-controls part: memoized column; renders its children once per track, in a memoized slot with that track's context
  │   ├── trackContext.ts               # The per-track context of the controls part: useTrack(), TrackContextValue; internal shared and slot-wiring contexts
  │   ├── TrackControlPieces.tsx        # The pieces of a panel: TrackName, TrackMuteButton, TrackSoloButton, TrackVolumeSlider, TrackPanSlider, TrackMenuButton, TrackRemoveButton, TrackReorderGrip
  │   ├── DefaultTrackControls.tsx      # Default track control panel, composed from the pieces (memoized; children drawn below the pan slider)
  │   ├── VisualizationOverlays.tsx     # Selection, playhead, loop region
  │   ├── visualizationLayout.tsx       # Shared row/slot styled components and channel-count helper
  │   ├── Waveform.tsx                  # Ready-made compositions: Waveform, WaveformEditor (clip headers + fades)
  │   ├── ClipInteractionProvider.tsx   # Declarative clip drag/trim/snap/collision
  │   ├── KeyboardShortcuts.tsx         # Declarative keyboard shortcut component (playback, splitting, undo props)
  │   ├── PlaybackControls.tsx          # Play/Pause/Stop/Rewind/FastForward buttons
  │   ├── ZoomControls.tsx              # Zoom in/out buttons
  │   ├── ExportControls.tsx            # WAV export controls
  │   ├── AnnotationControls.tsx        # The three option checkboxes and the download button, bound to the provider (both providers)
  │   ├── ChannelWithProgress.tsx       # Waveform channel with playback progress overlay (both providers)
  │   ├── AnimatedPlayhead.tsx          # Smooth 60fps playhead (both providers)
  │   ├── WaveformAnnotationBoxes.tsx   # Annotation boxes part (both providers): provider state, its own DragDropProvider + edge drag wiring
  │   ├── AnnotationBoxes.tsx           # The row of boxes it draws (internal; values as props)
  │   ├── AnnotationList.tsx            # The annotation text list (both providers); not a part of a root
  │   ├── MediaElementWaveformRoot.tsx  # Root of the MediaElement view: one row, as long as the audio
  │   ├── waveformFrame.tsx             # What both roots share (internal): parts by place, scrolling frame, layout values, selection drag
  │   ├── MediaElementWaveform.tsx      # Ready-made composition for the MediaElement provider
  │   ├── ContextualControls.tsx        # Context-aware wrappers
  │   └── index.tsx                     # Component exports
  ├── modifiers/                        # @dnd-kit drag modifiers
  │   ├── ClipCollisionModifier.ts      # Prevents overlapping clips during drag
  │   └── SnapToGridModifier.ts         # Snap-to-grid (beats or timescale mode)
  ├── utils/                            # Pure helpers (among them:)
  │   ├── trackMixerState.ts            # Mixer state by track id; the positional trackStates array derived from it
  │   ├── stableTemplate.ts             # Keeps the controls part's children while a new render hands it equal ones
  │   ├── derivePeaks.ts                # Peaks per clip, derived during render
  │   └── incrementalTrackChange.ts     # Which tracks changes can be applied to a running engine
  ├── playout/                           # Optional-engine resolution (#510)
  │   ├── resolvePlayoutAdapter.ts       # Dynamic-imports @waveform-playlist/playout + tone
  │   └── resolveMediaElementPlayout.ts  # Dynamic-imports @waveform-playlist/media-element-playout
  ├── effects/                          # Audio effects system
  │   ├── effectDefinitions.ts          # 20 Tone.js effect definitions
  │   ├── effectFactory.ts              # Effect instance creation
  │   └── index.ts
  ├── workers/                          # Web workers
  │   └── peaksWorker.ts                # Inline Blob worker for peak generation
  ├── waveformDataLoader.ts            # BBC waveform-data.js support
  └── tone.ts                          # `/tone` subpath entry (Tone-coupled exports)
  ```
- **Build:** tsup, two entry points (`src/index.tsx`, `src/tone.ts`) → core bundle + `/tone` subpath bundle. (Migrated off Vite; tsup auto-externalizes `dependencies`/`peerDependencies`, see root CLAUDE.md pattern 5.)
- **Optional playout engines (#510):** `@waveform-playlist/playout`, `@waveform-playlist/media-element-playout`, and `tone` are optional `peerDependencies`, not static imports. `WaveformPlaylistProvider`/`MediaElementPlaylistProvider` resolve the default engine via dynamic `import()` (`src/playout/resolvePlayoutAdapter.ts` / `resolveMediaElementPlayout.ts`, factory-or-dynamic with install-hint rethrow) or accept a consumer-supplied `createAdapter?`/`createPlayout?` factory that skips the import entirely.
- **`/tone` subpath is the Tone-coupled surface:** the core `@waveform-playlist/browser` entry is structurally free of any static `tone`/`playout` import (enforced by `coreBarrelEngineFree.test.ts`). Tone-dependent exports — `useAudioTracks`, `useDynamicTracks`, the effects hooks/factory/definitions, `useExportWav` + `ExportWavButton`, `useOutputMeter`, `useMasterAnalyser`, WAM effect GUI helpers — live at `@waveform-playlist/browser/tone` only. A MediaElement-only or custom-adapter consumer never resolves `tone`/`playout` under any bundler.

### 🔊 Audio Layer

#### `@waveform-playlist/playout`

- **Purpose:** Audio playback abstraction using Tone.js + Global AudioContext management
- **Key class:** `TonePlayout`
- **Global AudioContext:**
  - Single AudioContext shared across the entire application
  - Created on first use, never closed during app lifetime
  - Used by Tone.js (configured via `Tone.setContext()`)
  - Used by recording and metering hooks
  - Exports: `getGlobalContext()` (Tone.js Context), `getGlobalAudioContext()` (native AudioContext), `resumeGlobalAudioContext()`, `getGlobalAudioContextState()`, `closeGlobalAudioContext()`
  - **Rule:** Always use `getGlobalContext()` — never `new AudioContext()` or Tone.js `getContext()`
- **Features:**
  - Play/pause/stop control
  - Seeking
  - Timed segment playback
  - Track mixing
- **Dependencies:** Tone.js, Core
- **Optional peer of `@waveform-playlist/browser`:** resolved via dynamic `import()` (not a static dependency of the core browser bundle) — see the browser package's "Optional playout engines" note above.
- **Location:** `packages/playout/src/audioContext.ts`

#### `@waveform-playlist/media-element-playout`

- **Purpose:** Lightweight single-track audio playback using HTMLAudioElement (no Tone.js dependency)
- **Key classes:** `MediaElementPlayout` (engine, single track — warns + disposes on a second `addTrack`) wraps `MediaElementTrack` (one `<audio>` element)
- **Use Cases:**
  - Large audio files - streams without downloading entire file
  - Pre-computed peaks - use [audiowaveform](https://github.com/bbc/audiowaveform) server-side
  - Playback rate control - 0.25x to 4.0x with pitch preservation
  - Single-track playback - simpler API, smaller bundle
  - Lightweight single-track players — backs `<daw-player>` in `@dawcore/components`
- **Features:**
  - Play/pause/stop control, plus player-mode `resume()` (continue from current position, vs. `play()`'s timeline-reset-to-0 semantics)
  - Seeking
  - Playback rate adjustment with pitch preservation
  - currentTime tracking via animation frame
  - `setSource()`/`load()` for in-place source swap (reuses the element, so the once-per-element `MediaElementAudioSourceNode` and any effects routing survive)
  - Typed event emitter (`on`/`off` over `loadedmetadata`/`play`/`pause`/`error`/`ended`/`timeupdate`), with legacy callback setters retained for back-compat
- **When to Use:**
  - Choose `MediaElementPlaylistProvider` for streaming large files with pre-computed peaks
  - Choose `WaveformPlaylistProvider` (Tone.js) for multi-track mixing, effects, recording
- **Dependencies:** `@waveform-playlist/core` only (pure HTMLAudioElement, no Tone.js)
- **Optional peer of `@waveform-playlist/browser`:** resolved via dynamic `import()`, same pattern as `playout`.
- **Location:** `packages/media-element-playout/src/`
- **Browser Integration:**
  - `MediaElementPlaylistProvider` - Context provider for media element playback
  - `MediaElementWaveform` - Single-track waveform component
  - Hooks: the shared context hooks (`useIsPlaying`, `usePlaybackControls`, `usePlaybackRefs` and the others both providers serve), plus `usePlaybackRate` and `useMediaElementTrack`
- **Web Components Integration:** `<daw-player>` in `@dawcore/components` wraps `MediaElementPlayout` directly — no `PlaylistEngine`, no adapter, no AudioContext
- **Example:** `website/src/pages/examples/media-element.tsx`, `examples/media-element-player/`

### 📊 BBC Waveform Data Support

The browser package includes utilities for loading pre-computed waveform data in BBC's `waveform-data.js` format:

**Location:** `packages/browser/src/waveformDataLoader.ts`

**Functions:**
- `loadWaveformData(src)` - Load .dat or .json waveform file, returns WaveformData instance
- `waveformDataToPeaks(waveformData, channelIndex)` - Convert to our Peaks format (Int8Array/Int16Array)
- `loadPeaksFromWaveformData(src, channelIndex)` - Combined load + convert
- `getWaveformDataMetadata(src)` - Get metadata without full conversion

**Generating BBC Peaks:**
```bash
# Install audiowaveform (macOS)
brew install audiowaveform

# Generate 8-bit peaks (smaller files, ~11KB for 30s audio)
audiowaveform -i audio.mp3 -o peaks-8bit.dat -z 256 -b 8

# Generate 16-bit peaks (higher precision, ~22KB)
audiowaveform -i audio.mp3 -o peaks-16bit.dat -z 256 -b 16

# Generate stereo/multi-channel (Version 2 format)
audiowaveform -i audio.mp3 -o peaks-stereo.dat -z 256 --split-channels
```

**Use Case:** Progressive loading - show waveforms instantly (~44KB for 4 tracks) while audio loads in background (~1.9MB)

**Example:** `website/src/components/examples/WaveformDataExample.tsx`

### 📦 Optional Packages

#### `@waveform-playlist/annotations`

- **Type:** Optional package (install separately)
- **Purpose:** Complete annotation support for time-synchronized text segments
- **Tech:** React, styled-components, custom hooks
- **Install:** `npm install @waveform-playlist/annotations`
- **Structure:**
  ```
  src/
  ├── components/        # React components
  │   ├── Annotation.tsx
  │   ├── AnnotationBox.tsx
  │   ├── AnnotationBoxesWrapper.tsx
  │   ├── AnnotationsTrack.tsx
  │   ├── AnnotationText.tsx
  │   ├── ContinuousPlayCheckbox.tsx
  │   ├── DownloadAnnotationsButton.tsx
  │   ├── EditableCheckbox.tsx
  │   └── LinkEndpointsCheckbox.tsx
  ├── hooks/             # Custom hooks
  │   └── useAnnotationControls.ts
  ├── types/             # TypeScript types
  │   └── index.ts
  ├── parsers/           # Import/export (Aeneas JSON)
  │   └── aeneas.ts
  └── index.ts           # Public exports
  ```
- **Entry point:** `AnnotationProvider` (`AnnotationProvider.tsx`) puts the package's components into the browser package's `AnnotationIntegrationContext`; `WaveformAnnotationBoxes`, `AnnotationList` and the browser's checkbox wrappers read them from there
- **Hook:** `useAnnotationControls` holds `continuousPlay` and `linkEndpoints` as local state and wraps `updateAnnotationBoundaries()` of `@waveform-playlist/core` (linked endpoints, collision push-back, cascading updates). Nothing in the repo calls it: under a provider the options are the provider's (`useAnnotationOptions()`)
- **Components:**
  - Visual: AnnotationBox, AnnotationBoxesWrapper, AnnotationsTrack
  - Text: Annotation, AnnotationText
  - Controls: ContinuousPlayCheckbox, LinkEndpointsCheckbox, EditableCheckbox, DownloadAnnotationsButton
- **Peer Dependencies:** React ^19.0.0, styled-components ^6.0.0
- **Bundle Size Impact:** ~50KB (only included if installed)
- **Use Cases:** Subtitle/caption editing, transcripts, audio labeling
- **Documentation:** See `website/docs/getting-started/installation.md`

#### `@waveform-playlist/recording`

- **Type:** Optional package (install separately)
- **Purpose:** Recording hooks — no UI components (v10 removed RecordButton, VUMeter, etc.)
- **Tech:** React, AudioWorklet (via `@waveform-playlist/worklets`)
- **Install:** `npm install @waveform-playlist/recording` (auto-installs `@waveform-playlist/worklets`)
- **Structure:**
  ```
  src/
  ├── hooks/             # Custom hooks
  │   ├── useRecording.ts
  │   ├── useMicrophoneAccess.ts
  │   ├── useMicrophoneLevel.ts
  │   ├── useIntegratedRecording.ts
  │   └── useRecordingProgress.ts
  ├── types/             # TypeScript types
  │   └── index.ts
  ├── utils/             # Utilities
  │   ├── peaksGenerator.ts
  │   └── audioBufferUtils.ts
  └── index.ts           # Public exports (hooks + types only)
  ```

- **Key Architecture:**
  - **MediaStreamSource Per Hook** - Each hook creates its own source from `getGlobalContext()` (playout)
    - Avoids Firefox cross-context errors when sources/nodes are created in different modules
    - Both `useRecording` and `useMicrophoneLevel` create independent sources from same stream
  - **Worklet-Based Metering** - Both hooks use AudioWorklet processors from `@waveform-playlist/worklets`:
    - `useMicrophoneLevel` - `meter-processor` worklet for sample-accurate peak/RMS (no transients missed)
    - `useRecording` - `recording-processor` worklet for multi-channel audio capture with live peaks
  - **AudioWorklet Processing** - Captures audio samples in worklet thread, sends to main thread
  - **Device Hot-Plug Detection** - `useMicrophoneAccess` listens for `devicechange` events. `useIntegratedRecording` auto-falls back to first available device if selected device unplugged.

- **Key Features:**
  - **Global AudioContext** - Uses shared global context via `getGlobalContext()` (same as Tone.js playback)
  - **Live waveform visualization** - Real-time peaks during recording
  - **Multi-channel support** - Auto-detects mono/stereo from mic, mirrors mono to fill requested channel count
  - **Microphone selection** - Enumerate and switch between input devices with auto-select and hot-plug detection
  - **Recording-optimized constraints** - Default audio constraints prioritize raw quality and low latency
  - **Overdub recording** - Record over existing audio with latency compensation (`outputLatency + lookAhead`)
  - **Latency compensation** - Clip `offsetSamples` skips combined output + lookAhead latency

- **Hooks:**
  - `useIntegratedRecording` - Combined recording + track management (mic access, VU meter, clip creation)
    - Returns: `isRecording`, `isPaused`, `meter` (`MeterSource`), `progress` (`RecordingProgressSource`), `error`
    - Methods: `startRecording()`, `stopRecording()`, `pauseRecording()`, `resumeRecording()`, `requestMicAccess()`, `changeDevice()`
  - `useRecording` - Low-level recording lifecycle with AudioWorklet
    - Returns: `isRecording`, `isPaused`, `progress` (`RecordingProgressSource`: `{ duration, peaks }`), `audioBuffer`
    - Methods: `startRecording()`, `stopRecording()`, `pauseRecording()`, `resumeRecording()`
  - `useMicrophoneAccess` - Device enumeration, permission handling, hot-plug detection
    - Returns: `stream`, `devices`, `hasPermission`, `requestAccess()`, `stopStream()`, `error`
  - `useMicrophoneLevel` - Real-time per-channel level monitoring via meter-processor worklet
    - Returns: `meter` (`MeterSource`: `{ levels, peakLevels, rmsLevels }`), `resetPeak()`, `error`
  - `useRecordingProgress` - A `RecordingProgressSource` as throttled React state (default 10 updates a second)

- **Important Patterns:**
  1. **AudioWorklet Debugging** - console.log in worklets doesn't appear in browser console
     - Use `postMessage()` to send debug data to main thread
  2. **Worklet Deployment** - Worklet files live in `@waveform-playlist/worklets`, bundled via tsup
     - Docusaurus webpack aliases handle module resolution
  3. **Try-Catch for Cleanup** - Wrap disconnect calls in try-catch for microphone switching

- **Peer Dependencies:** React ^19.0.0
- **Use Cases:** Voice recording, podcast editing, audio capture, overdub recording
- **Example:** `website/src/components/examples/RecordingExample.tsx` + `RecordingControls.tsx`
- **Debugging:** See `packages/recording/CLAUDE.md`

#### `@waveform-playlist/worklets`

- **Type:** Internal dependency (auto-installed with recording)
- **Purpose:** Shared AudioWorklet processors for metering and recording
- **Structure:**
  ```
  src/
  ├── worklet/
  │   ├── meter-processor.worklet.ts      # Sample-accurate peak/RMS metering
  │   └── recording-processor.worklet.ts  # Multi-channel audio capture
  └── index.ts           # Exports processor URLs and message types
  ```
- **Key Architecture:**
  - Processors loaded via `rawContext.audioWorklet.addModule(url)` — never Tone.js `addAudioWorkletModule` (caches single URL)
  - `meter-processor` measures every sample — no transients missed between animation frames
  - `recording-processor` handles buffer boundary crossing at non-48kHz sample rates
- **Build:** `tsup` (ESM + CJS + worklet IIFE)

#### `@waveform-playlist/spectrogram`

- **Type:** Optional package (install separately)
- **Purpose (v13+):** React Provider + UI for spectrograms. Computation, worker, and the framework-agnostic orchestrator now live in `@dawcore/spectrogram`. This package is React glue.
- **Install:** `npm install @waveform-playlist/spectrogram @dawcore/spectrogram`
- **Structure:**
  ```
  src/
  ├── SpectrogramProvider.tsx  # Provider (fills SpectrogramIntegrationContext)
  ├── components/              # UI components (menu items, settings modal)
  ├── styled.d.ts
  └── index.ts
  ```
- **Companion package:** `@dawcore/spectrogram` (framework-agnostic, full description under "🧱 Web Components" below) ships the FFT computation, Web Worker, `SpectrogramOrchestrator` class, and pure helpers (`classifyViewport`, `groupContiguousChunks`, `ColorLUTCache`, `computePaddedFftRange`). Used by this package's Provider AND by the dawcore Lit element layer.
- **Canvas-ID contract:** the `${clipId}-ch${channelIndex}-chunk${chunkIndex}` format is single-sourced in `@waveform-playlist/core` (`buildSpectrogramCanvasId`/`parseSpectrogramCanvasId`, #560/#556) — this package's `extractChunkNumber`/`parseCanvasId`/`computeChunkSampleRange` are thin adapters over core's parser + `@dawcore/spectrogram`'s `computePaddedFftRange`, not independent implementations.
- **Integration Pattern:**
  - Browser package defines `SpectrogramIntegrationContext` (nullable)
  - Spectrogram package provides `SpectrogramProvider` that fills this context
  - When no provider present, all spectrogram features are skipped (zero runtime cost)
  ```typescript
  // With spectrogram:
  <WaveformPlaylistProvider tracks={tracks}>
    <SpectrogramProvider config={config} colorMap="viridis">
      <Waveform />
    </SpectrogramProvider>
  </WaveformPlaylistProvider>

  // Without spectrogram (no change needed):
  <WaveformPlaylistProvider tracks={tracks}>
    <Waveform />
  </WaveformPlaylistProvider>
  ```
- **Peer Dependencies:** React, @waveform-playlist/browser
- **Example:** `website/src/components/examples/MirSpectrogramExample.tsx`

#### `@waveform-playlist/midi`

- **Type:** Optional package (install separately)
- **Purpose:** MIDI file loading, parsing, and React hook integration. Separates `@tonejs/midi` into an opt-in package so audio-only users don't pay the bundle cost.
- **Install:** `npm install @waveform-playlist/midi`
- **Architecture (two-layer):**
  - `parseMidiFile()`/`parseMidiUrl()` — pure functions, re-exported from `@dawcore/midi` as of v13.0.0 (moved during the dawcore framework-split; no React-side API change). Convert a `.mid` ArrayBuffer/URL to `ParsedMidi`.
  - `useMidiTracks()` — the one original symbol still defined in this package. React hook mirroring `useAudioTracks`, producing `ClipTrack[]` with `clip.midiNotes` for `<WaveformPlaylistProvider tracks={...}>`.
- **Data pipeline only:** MIDI synthesis (PolySynth, Transport scheduling) lives in `@waveform-playlist/playout` via `MidiToneTrack`.
- **Multi-track expansion:** One MIDI config can produce multiple `ClipTrack`s (one per MIDI track in the file); `flatten: true` merges them into one, preserving per-note channel identity via `MidiNoteData.channel` (so percussion notes stay routable after flattening).
- **No native sample rate:** MIDI is event-based — `sampleRate` is required on `useMidiTracks()`'s options (pass `getGlobalAudioContext().sampleRate` from playout) for sample-based timeline positioning.
- **Dependencies:** `@dawcore/midi`, `@tonejs/midi`, `@waveform-playlist/core`
- **Peer Dependencies:** React ^19.0.0
- **Location:** `packages/midi/`

### 🧱 Web Components

#### `@dawcore/components`

- **Purpose:** Framework-agnostic Web Components (Lit) for multi-track audio editing. Wraps `PlaylistEngine` + a consumer-provided `PlayoutAdapter` (`NativePlayoutAdapter` from `@dawcore/transport` or `createToneAdapter()` from `@waveform-playlist/playout`).
- **Architecture:** Data elements (`<daw-track>`, `<daw-clip>`) use light DOM; visual elements (`<daw-waveform>`, `<daw-playhead>`, `<daw-ruler>`) use Shadow DOM with chunked canvas rendering. `<daw-editor>` orchestrates everything.
- **Layout (frozen panes):** `.scroll-area` owns both scroll axes; the ruler band and controls column live in clipped viewports kept in sync via `translate3d` transforms by `ScrollSyncController` (also forwards wheel events — vertical over controls, horizontal scrub over the ruler). Track rows and `daw-track-controls` share identical border-box geometry from one per-track `trackHeight`, so the two columns align exactly.
- **Build:** tsup — `pnpm typecheck && tsup`. `sideEffects: true` (element imports register custom elements globally).
- **Testing:** vitest with happy-dom. Run with `cd packages/dawcore && npx vitest run`.
- **Dev pages:** `pnpm example:dawcore-native` (Vite, `examples/dawcore-native/`), `pnpm example:dawcore-tone` (`examples/dawcore-tone/`), and `pnpm example:dawcore-wam` (`examples/dawcore-wam/`). Resolve workspace packages from source via Vite aliases.
- **Key Elements:**
  - `<daw-editor>` — Core orchestrator. Builds engine lazily on first track load. Attributes: `interactive-clips`, `clip-headers`, `clip-header-height`. Methods: `undo()`, `redo()`, `togglePlayPause()`, `seekTo()`. Getters: `canUndo`, `canRedo`.
  - `<daw-track>`, `<daw-clip>` — Declarative data elements (light DOM)
  - `<daw-waveform>` — Chunked canvas rendering with dirty pixel tracking
  - `<daw-playhead>`, `<daw-ruler>`, `<daw-selection>` — Visual overlays
  - `<daw-transport>`, `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>`, `<daw-record-button>` — Transport controls (find target via `for` attribute)
  - `<daw-track-controls>` — Mute/solo/volume/pan per track. Height-responsive via CSS container queries: on short rows the Pan slider drops first, then Vol (name + M/S always visible). Requires an explicit height (the editor sets one per track row).
  - `<daw-keyboard-shortcuts>` — Render-less element. Boolean attribute presets: `playback`, `splitting`, `undo`. JS properties for remapping (`playbackShortcuts`, `splittingShortcuts`, `undoShortcuts`) and custom shortcuts (`customShortcuts`). Listener on `document`. Uses `handleKeyboardEvent` from `@waveform-playlist/core`.
  - `<daw-piano-roll>`, `<daw-spectrogram>`, `<daw-grid>` — Render-mode-specific visual elements (MIDI notes, spectrogram FFT via `@dawcore/spectrogram`, beats/bars grid), same chunked-canvas (1000px) pattern as `<daw-waveform>`. Selected via `<daw-track render-mode="piano-roll" | "spectrogram">`.
  - `<daw-time-display>`, `<daw-time-format>` — Transport-adjacent readouts/controls (target resolution like the transport buttons); target owns the state, controls sync via bubbled events.
  - `<daw-player>` — Lightweight single-track player, independent of `<daw-editor>`. Wraps `MediaElementPlayout` from `@waveform-playlist/media-element-playout` directly — no `PlaylistEngine`, no `PlayoutAdapter`, no AudioContext. Attributes: `src`, `peaks-src` (pre-computed BBC `.dat`/`.json` peaks), `wave-height`, `timescale`, `mono`, `bar-width`, `bar-gap`, `rounded-bars`, `playback-rate`. Composes `<daw-ruler>`/`<daw-waveform>`/`<daw-playhead>` internally; scrubber fallback when `peaks-src` is omitted.
- **Clip Interactions:**
  - `ClipPointerHandler` (`interactions/clip-pointer-handler.ts`) — Move (header drag) and trim (boundary drag) with engine delegation
  - `splitAtPlayhead` (`interactions/split-handler.ts`) — Split clip at current playhead position (S key)
  - `clip-peak-sync.ts` — Regenerates peaks after split/trim via `_syncPeaksForChangedClips`
  - Move uses incremental deltas with `skipAdapter` (60fps); trim accumulates delta and calls engine once on drop
- **Effects Chain (`src/effects/`):**
  - `effects-chain-controller.ts` — `EffectsChainController`, an ordered effect chain wired between owned input/output gain nodes; chain operations (add/remove/move/bypass) are kind-agnostic (`'native' | 'wam'`)
  - `effect-registry.ts` — the `native-*` built-in effects (BaseAudioContext nodes), registered on import through the shared registry in `@waveform-playlist/core` (`packages/core/src/effects/registry.ts`: `registerEffect` / `getEffectDefinitions` / `prepareEffect` / `createEffectInstance`, also used by the React effects hooks)
  - `effects-manager.ts` — `EffectsManager`, per-editor ownership of the master chain + per-track chains, wiring into the transport's `connectTrackEffects` (pre-fader track insert) / `connectMasterOutput` hooks, GUI lifecycle cache, persistence (`getEffectsState()` / `setEffectsState()`), and the WAM transport bridge
  - `optional-modules.ts` — dynamic imports of the optional `@dawcore/wam` / `@dawcore/faust` peers with install-hint rethrow (the `@dawcore/midi` pattern)
  - Element API: `addEffect` / `addWamPlugin(url)` / `addFaustEffect(dspCode)` / `removeEffect` / `setEffectParams` / `setEffectBypassed` / `moveEffect` / `openEffectGui` / `closeEffectGui` on `<daw-editor>` (master chain) and `<daw-track>` (delegates to the editor); `daw-effect-*` events
- **Offline Export (`interactions/export-audio.ts`):** `editor.exportAudio({sampleRate?, startTime?, duration?, channels?})` renders through all effect chains on an `OfflineAudioContext` — clips scheduled statically (no Transport), chains rebuilt from persisted state
- **Dependencies:** Lit, `@dawcore/spectrogram`, `waveform-data`; peers: `@waveform-playlist/core`, `@waveform-playlist/engine` (required), `@dawcore/transport`, `@dawcore/midi`, `@dawcore/wam`, `@dawcore/faust`, `@waveform-playlist/worklets` (optional — adapter, MIDI loading, WAM plugins, Faust compilation, recording)
- **Location:** `packages/dawcore/`

#### `@dawcore/transport`

- **Purpose:** Native Web Audio transport — replaces Tone.js Transport/scheduling without Tone.js. Tone.js remains available only for effects (consumer-side, optional).
- **Architecture:** Layered — core (clock/scheduler/timer) → timeline (samples/ticks/tempo: `TempoMap`, `MeterMap`, branded `Tick`/`Sample` types) → audio (track nodes, `ClipPlayer`, metronome) → transport (orchestrator) → adapter (`NativePlayoutAdapter`, the `PlayoutAdapter` bridge for `PlaylistEngine`)
- **Scheduler:** Sliding-window event generation driven by a Web Worker `setTimeout` tick (25 ms; keeps its cadence in a hidden tab) with ~200ms lookahead; integer-tick loop boundaries (no float drift at loop wrap)
- **Effects insertion hooks:** `connectTrackEffects(trackId, input, output)` inserts any AudioNode chain (native, WAM, Tone.js) on a track as a pre-fader insert (clips → chain → volume → pan → mute); `connectMasterOutput(node)` / `disconnectMasterOutput()` do the same between the master gain and `audioContext.destination`. The transport has zero knowledge of plugin types.
- **Events:** `seek(time)` emits a `seek` event (`{ seconds }`) — consumed by the WAM transport bridge among others
- **Dependencies:** `@waveform-playlist/core` (runtime — the shared pan stage `createPanStage` and `trackChannelCount`); `@waveform-playlist/engine` is a type-only devDep
- **Location:** `packages/transport/`

#### `@dawcore/spectrogram`

- **Purpose:** Framework-agnostic spectrogram computation, Web Worker, and viewport-aware rendering orchestrator. A **regular dependency** of `@dawcore/components` (always loaded, unlike the optional `@dawcore/wam`/`@dawcore/faust` peers) and also consumed by `@waveform-playlist/spectrogram`'s React Provider for the FFT/worker primitives.
- **Subpath exports:** root (computation + worker + orchestrator class), `./worker/spectrogram.worker` (Worker URL target), `./orchestrator` (ESM-only — orchestrator + pure helpers without the computation/worker graph)
- **`SpectrogramOrchestrator`:** Owns the worker pool, per-clip/per-canvas registries, viewport state, and a three-tier render dispatch (viewport → buffer/overscan → remaining via `requestIdleCallback`). Extends `EventTarget`, dispatches `viewport-ready` once per `(generation, trackId)`. Used by `<daw-spectrogram>` + `SpectrogramController` in `@dawcore/components`; the React `SpectrogramProvider` uses the lower-level worker pool directly and keeps its own tier pipeline (candidate for future consolidation).
- **Worker pool (`createSpectrogramWorkerPool`):** one-channel-per-worker invariant (the FFT cache key is channel-agnostic per worker); grows lazily when audio has more channels than pre-spawned workers. Canvases are routed by channel parsed from the canvas ID (`clipId-ch{N}-chunk{M}`) via `@waveform-playlist/core`'s `parseSpectrogramCanvasId`.
- **Shared FFT-range math (#560):** `computePaddedFftRange` (`computation/fftSampleRange.ts`) is the padded-by-`fftSize` sample range for a chunk group, single-sourced and shared with the React Provider's `computeChunkSampleRange` so the two spectrogram pipelines can't drift on FFT window sizing.
- **Dependencies:** `@waveform-playlist/core`, `fft.js`
- **Location:** `packages/dawcore-spectrogram/`

#### `@dawcore/midi`

- **Purpose:** Framework-agnostic MIDI file loading and parsing — no React, no DOM, no Lit. Houses `parseMidiFile()`/`parseMidiUrl()` and the `MidiLoadOptions`/`MidiLoadResult` types.
- **Consumers:** `@dawcore/components` (optional peer — `editor.loadMidi()` dynamic-imports this package on first call) and `@waveform-playlist/midi` (regular dependency — re-exports the parser and adds the `useMidiTracks` React hook on top).
- **Dependencies:** `@waveform-playlist/core` (for the `MidiNoteData` type), `@tonejs/midi`. No peer dependencies — truly framework-agnostic.
- **Location:** `packages/dawcore-midi/`

#### `@dawcore/wam`

- **Purpose:** Framework-agnostic WAM 2.0 (Web Audio Modules) plugin hosting. Optional peer of `@dawcore/components`, loaded via dynamic import — non-WAM users pay zero bundle cost.
- **Modules:**
  - `host.ts` — `ensureWamHost(audioContext)`: idempotent per-context host initialization (accepts suspended `OfflineAudioContext` for offline export)
  - `loader.ts` — `loadWamFactory(url)` (URL-cached dynamic import), `createWamInstance(url, ctx, hostGroupId)` and `createWamInstanceFromFactory(factory, …)` with effect-only descriptor validation (audio input + output required); wrapper `WamPluginInstance` splits GUI and audio lifecycles
  - `gui.ts` — plain-DOM GUI helpers: `createParameterPanel` / `createWamParameterPanel` (generic slider panel fallback for headless plugins, themable via `--daw-*` CSS vars)
  - `library.ts` — `fetchWamLibrary(manifestUrl)`: schema-validated `library.json` plugin discovery (webaudiomodules.com community format and variants)
  - `transport-bridge.ts` — `createWamTransportBridge(transport, getPluginNodes)`: broadcasts `wam-transport` events (tempo, time signature, bar position) to live plugin nodes on play/pause/stop/seek/tempo/meter changes
  - `cloneInstanceInto(instance, targetContext, hostGroupId)` — re-instantiates a plugin on another context (e.g. `OfflineAudioContext`) and transfers state, for offline export
- **No DOM frameworks:** No Lit/React — UI-flavored pieces are plain-DOM factories so a future React layer can reuse them
- **Dependencies:** `@webaudiomodules/api`, `@webaudiomodules/sdk` (exact-pinned alpha SDKs)
- **Location:** `packages/dawcore-wam/`

#### `@dawcore/faust`

- **Purpose:** In-browser Faust DSP → WAM 2.0 compilation. `compileFaustToWam(dspCode, { name? })` lazily loads the `@shren/faust2wam` compiler (single self-contained ~8 MB ESM bundle, no CDN fetches) and returns a WAM factory class. Optional peer of `@dawcore/components` via dynamic import.
- **Integration:** Instantiation of the compiled class goes through `@dawcore/wam`'s `createWamInstanceFromFactory` — this package never duplicates validate/wrap logic. In dawcore, `addFaustEffect(dspCode)` compiles before touching the chain (compile errors propagate unchanged with line/column diagnostics), then inserts a `kind: 'wam'` chain entry with `source: { faust: dspCode }` and no URL; persistence and offline export recompile from the saved DSP source.
- **Dependencies:** `@shren/faust2wam` (exact-pinned)
- **Location:** `packages/dawcore-faust/`

## Data Flow Architecture

### Current Architecture (React + Hooks + Context)

**Flexible API Pattern (Provider + Engine + Primitives):**

```
User Interaction (React Events)
    ↓
WaveformPlaylistProvider (Split Contexts for Performance)
    ├─→ IsPlayingContext (play, pause, stop)
    │   └─→ isPlaying
    ├─→ PlaybackRefsContext (never changes; refs and frame callbacks for 60fps)
    │   └─→ currentTimeRef, registerFrameCallback(), playoutRef, isDraggingRef, etc.
    ├─→ AnnotationsContext (annotation edits)
    │   └─→ annotations
    ├─→ AnnotationOptionsContext (the three annotation options)
    │   └─→ editable, linkEndpoints, continuousPlay
    ├─→ LoopContext (loop changes)
    │   └─→ isLoopEnabled, loopStart, loopEnd
    ├─→ SelectedTrackIdContext (track selection)
    │   └─→ selectedTrackId
    ├─→ UndoRedoContext (after an edit)
    │   └─→ canUndo, canRedo
    ├─→ SelectionContext (every pointer move of a selection drag)
    │   └─→ selectionStart, selectionEnd
    ├─→ CurrentTimeContext (seek, pause, stop, leftward selection drag)
    │   └─→ currentTime (the resting cursor position)
    ├─→ ActiveAnnotationContext (every annotation boundary during playback)
    │   └─→ activeAnnotationId
    ├─→ PlaylistControlsContext (stable functions)
    │   └─→ play(), pause(), zoomIn(), setSelection(), etc.
    ├─→ PlaylistViewContext (prop changes)
    │   └─→ sampleRate, waveHeight, bar style, mono, indefinitePlayback, fillViewport
    ├─→ PlaylistSettingsContext (the user changing a setting)
    │   └─→ timeFormat, isAutomaticScroll
    ├─→ PlaylistZoomContext (a zoom)
    │   └─→ samplesPerPixel, canZoomIn, canZoomOut
    ├─→ PlaylistTimelineContext (every clip operation, every pointer move of a trim, a zoom)
    │   └─→ tracks, peaksDataArray, duration, isReady, onTracksChange
    ├─→ PlaylistMixerContext (every mute, solo, volume or pan change; tracks added, removed or reordered)
    │   └─→ trackStates, masterVolume
    └─→ TrackReorderPreviewContext (every drag-over of a track reorder)
        └─→ trackDragPreview, trackReorderEpoch
    ↓
├─→ Primitive Components (subscribe to relevant contexts only)
│   ├─→ PlayButton, PauseButton, StopButton
│   ├─→ ZoomInButton, ZoomOutButton
│   ├─→ MasterVolumeControl, TimeFormatSelect
│   └─→ Waveform / WaveformEditor, or WaveformRoot with the view's parts
│
├─→ UI Components (React)
│   └─→ Canvas Rendering (SmartChannel)
│
└─→ PlaylistEngine (state + events)
    ├─→ Owns: selection, loop, zoom, volume, selectedTrackId, tracks (clip mutations)
    ├─→ Emits: statechange → provider mirrors into React state
    └─→ ToneAdapter (PlayoutAdapter interface)
        └─→ TonePlayout (Tone.js)
            └─→ Web Audio API
```

**Engine State Flow:**
```
Hook calls engine method (e.g., engine.moveClip())
    ↓
Engine updates internal state + syncs adapter
    ↓
Engine emits 'statechange' with EngineState snapshot
    ↓
Provider's statechange handler:
    ├─→ Calls each hook's onEngineState() to mirror into React state
    └─→ Calls onTracksChange() for track mutations → parent updates tracks prop
```

**Context Splitting Architecture:**

`packages/browser/src/contexts/playlistContexts.ts` defines **22 contexts** (21 public and the internal `SelectedRowContext`), one per group of fields that change together, to optimize performance by isolating different update frequencies. Both providers render the same context objects for what they share; each provider puts a `BLOCKED` marker in the contexts it does not serve, so a hook reads the nearest provider or throws.

Rendered by both `WaveformPlaylistProvider` and `MediaElementPlaylistProvider` (11 public, plus the internal `SelectedRowContext`):

1. **IsPlayingContext** (`useIsPlaying()`) - Changes on play, pause and stop

2. **PlaybackRefsContext** (`usePlaybackRefs()`) - `currentTimeRef`, `visualTimeRef` and the frame-callback registry
   - The value never changes, so reading it never causes a re-render

3. **SelectionContext** (`useSelection()`) - The selected time range
   - Changes on every pointer move of a selection drag
   - Only components that show or use the selection subscribe

4. **CurrentTimeContext** (`useCurrentTime()`) - The resting cursor position
   - Changes on a seek, a pause, a stop and a selection whose start moves; does not advance during playback
   - Only components that show the resting position subscribe (playhead, clip progress, position readout)

5. **ActiveAnnotationContext** (`useActiveAnnotation()`) - The active annotation
   - Changes at every annotation boundary during playback

6. **AnnotationsContext** (`useAnnotations()`) - The annotations

7. **AnnotationOptionsContext** (`useAnnotationOptions()`) - `editable`, `linkEndpoints`, `continuousPlay`
   - State that follows the provider's `annotationList` prop; set through `usePlaybackControls()`

8. **PlaybackControlsContext** (`usePlaybackControls()`) - The actions both providers have
   - The value never changes

9. **PlaylistViewContext** (`usePlaylistView()`) - What the provider was configured with
   - Sample rate, sizes, bar style, `mono`, `indefinitePlayback`, `fillViewport` (the last three always false under the MediaElement provider)
   - Changes on a prop change, not on a settings click

10. **PlaylistSettingsContext** (`usePlaylistSettings()`) - The two settings a user toggles
   - `timeFormat`, `isAutomaticScroll`
   - Apart from the view value because every clip's progress overlay and the visualization read that one

11. **PlaylistZoomContext** (`usePlaylistZoom()`) - Changes on a zoom (fixed under the MediaElement provider)

Rendered by `WaveformPlaylistProvider` only, blocked by `MediaElementPlaylistProvider` (8):

12. **EditorControlsContext** (`useEditorControls()`) - The actions only the multitrack editor has; the value never changes

13. **EngineRefsContext** (`useEngineRefs()`) - `playoutRef`, `isDraggingRef`, the engine's clock refs and functions; the value never changes

14. **LoopContext** (`useLoop()`) - Loop enabled flag and loop region

15. **SelectedTrackIdContext** (`useSelectedTrackId()`) - The selected track

16. **UndoRedoContext** (`useUndoRedo()`) - Whether undo and redo are available

17. **PlaylistTimelineContext** (`usePlaylistTimeline()`) - Tracks, peaks, duration, `isReady`
    - Changes on every clip operation, on every pointer move of a trim and on a zoom (peaks are computed per zoom level)
    - Also when loading finishes and when peaks arrive

18. **PlaylistMixerContext** (`usePlaylistMixer()`) - Track states and master volume
    - Changes on every mute, solo, volume or pan change (each step of a slider drag)
    - Also when tracks are added, removed or reordered

19. **TrackReorderPreviewContext** (`useTrackReorderPreview()`) - The live track-reorder drag
    - Changes on every drag-over of a track reorder

Rendered by `MediaElementPlaylistProvider` only, blocked by `WaveformPlaylistProvider` (2):

20. **PlaybackRateContext** (`usePlaybackRate()`) - The playback speed and its setter

21. **MediaElementTrackContext** (`useMediaElementTrack()`) - Duration, `isReady`, peaks, fades and the player ref of the one track

**Key Files:**

- `packages/browser/src/WaveformPlaylistContext.tsx` - Context provider (flexible API)
- `packages/browser/src/contexts/playlistContexts.ts` - Context objects, value types and hooks of both providers
- `packages/browser/src/SpectrogramIntegrationContext.tsx` - Optional spectrogram integration
- `packages/browser/src/hooks/` - Reusable business logic
- `packages/browser/src/components/` - React components
- `packages/engine/src/PlaylistEngine.ts` - Stateful timeline engine
- `packages/engine/src/operations/` - Pure clip/timeline/viewport operations
- `packages/ui-components/src/components/Playlist.tsx` - UI container
- `packages/playout/src/TonePlayout.ts` - Audio playback

## State Management

### Context Splitting for Performance (2025-01-21)

The providers use **22 separate contexts** (20 served by `WaveformPlaylistProvider`, 13 by `MediaElementPlaylistProvider`, 11 of them by both; one of the 11 is internal), one per group of fields that change together, to optimize performance by isolating different update frequencies. This prevents unnecessary re-renders when frequently changing values (the selection during a drag, the cursor position on a seek, the active annotation during playback) update. Per-frame values never go through React state: they are read from refs and frame callbacks.

**Architecture:**

```typescript
// 1. Whether playback is running - changes on play, pause and stop
export interface IsPlayingContextValue {
  isPlaying: boolean;
}

// 1b. Refs and functions with a stable identity - the value never changes (both providers)
export interface PlaybackRefsContextValue {
  currentTimeRef: React.RefObject<number>;
  visualTimeRef: React.RefObject<number>;
  registerFrameCallback: (id: string, cb: (data: FrameData) => void) => void;
  unregisterFrameCallback: (id: string) => void;
}

// 1c. Refs and functions of the multitrack engine - the value never changes (WaveformPlaylistProvider only)
export interface EngineRefsContextValue {
  playbackStartTimeRef: React.RefObject<number>;   // context.currentTime when playback started
  audioStartPositionRef: React.RefObject<number>;   // Audio position when playback started
  getPlaybackTime: () => number;                     // Current time from engine (auto-wraps at loops)
  getAudioContextTime: () => number;
  getLookAhead: () => number;
  getOutputLatency: () => number;
  playoutRef: React.RefObject<PlaylistEngine | null>;
  isDraggingRef: React.MutableRefObject<boolean>;
}

// 2. User interaction state, one context per group that changes together
export interface AnnotationsContextValue {            // both providers
  annotations: AnnotationData[];
}

export interface AnnotationOptionsContextValue {      // both providers
  editable: boolean;
  linkEndpoints: boolean;
  continuousPlay: boolean;
}

export interface LoopContextValue {
  isLoopEnabled: boolean;
  loopStart: number;
  loopEnd: number;
}

export interface SelectedTrackIdContextValue {
  selectedTrackId: string | null;
}

export interface UndoRedoContextValue {
  canUndo: boolean;
  canRedo: boolean;
}

// 2b. The selection - changes on every pointer move of a selection drag
export interface SelectionContextValue {
  selectionStart: number;
  selectionEnd: number;
}

// 2c. The resting cursor position - changes on seek, pause, stop and a
// leftward selection drag; does not advance during playback
export interface CurrentTimeContextValue {
  currentTime: number;
}

// 2d. The active annotation - changes at every annotation boundary during playback
export interface ActiveAnnotationContextValue {
  activeAnnotationId: string | null;
}

// 3. Control functions - Stable, don't cause re-renders
// 3a. The actions both providers have
export interface PlaybackControlsContextValue {
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setSelection: (start: number, end: number) => void;
  setTimeFormat: (format: TimeFormat) => void;
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  setContinuousPlay: (enabled: boolean) => void;
  setAnnotationsEditable: (enabled: boolean) => void;
  setLinkEndpoints: (enabled: boolean) => void;
  setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>>;
  annotationPreview: AnnotationPreviewHandle;
  setActiveAnnotationId: (id: string | null) => void;
}

// 3b. The actions only the multitrack editor has (WaveformPlaylistProvider only)
export interface EditorControlsContextValue {
  setCurrentTime: (time: number) => void;
  // Track mixer, by track id
  setTrackMute: (trackId: string, muted: boolean) => void;
  setTrackSolo: (trackId: string, soloed: boolean) => void;
  setTrackVolume: (trackId: string, volume: number) => void;
  setTrackPan: (trackId: string, pan: number) => void;
  reorderTrack: (trackId: string, toIndex: number) => void;
  bumpTrackReorderEpoch: () => void;
  setTrackDragPreview: React.Dispatch<React.SetStateAction<TrackDragPreview | null>>;
  setSelectedTrackId: (trackId: string | null) => void;
  // Zoom
  zoomIn: () => void;
  zoomOut: () => void;
  // Master volume
  setMasterVolume: (volume: number) => void;
  // Loop
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setLoopRegionFromSelection: () => void;
  clearLoopRegion: () => void;
  // Undo/Redo
  undo: () => void;
  redo: () => void;
  // Recording
  setRecordingActive: (active: boolean, armedTrackId?: string | null) => void;
}

// 4. View - what the provider was configured with; changes on a prop change
export interface PlaylistViewContextValue {
  sampleRate: number;
  waveHeight: number;
  barWidth: number;
  barGap: number;
  roundedBars: boolean;
  progressBarWidth: number;
  mono: boolean;
  indefinitePlayback: boolean;       // Whether playback continues past end of audio
  fillViewport: boolean;
}

// 4a. The two settings a user toggles
export interface PlaylistSettingsContextValue {
  timeFormat: TimeFormat;
  isAutomaticScroll: boolean;
}

// 4b. Zoom - changes on a zoom
export interface PlaylistZoomContextValue {
  samplesPerPixel: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
}

// 4c. Timeline - changes on every clip operation, every pointer move of a trim and a zoom
export interface PlaylistTimelineContextValue {
  tracks: ClipTrack[];
  peaksDataArray: TrackClipPeaks[];
  duration: number;
  isReady: boolean;
  onTracksChange: ((tracks: ClipTrack[]) => void) | undefined;
}

// 4d. Mixer - changes on every mute, solo, volume or pan change, and when tracks are added, removed or reordered
export interface PlaylistMixerContextValue {
  // One entry per track, in the order of `tracks`; undefined at the position
  // of a track that is still loading. Derived from the provider's mixer state,
  // which is a map by track id (utils/trackMixerState.ts).
  trackStates: TrackState[];
  masterVolume: number;
}

// 4e. Live track-reorder drag - changes on every drag-over
export interface TrackReorderPreviewContextValue {
  trackDragPreview: TrackDragPreview | null;
  trackReorderEpoch: number;
}

// 5. MediaElementPlaylistProvider only
export interface PlaybackRateContextValue {
  playbackRate: number;
  setPlaybackRate: (rate: number) => void;
}

export interface MediaElementTrackContextValue {
  duration: number;
  isReady: boolean;
  peaksDataArray: TrackClipPeaks[];
  fadeIn?: FadeConfig;
  fadeOut?: FadeConfig;
  playoutRef: React.RefObject<MediaElementPlayout | null>;
}
```

**Usage Pattern:**

Components subscribe only to the contexts they need:

```typescript
// Animation component: frame callbacks while playing, the resting position otherwise
export const Playhead = () => {
  const { isPlaying } = useIsPlaying();
  const { registerFrameCallback, unregisterFrameCallback } = usePlaybackRefs(); // never re-renders
  useCurrentTime(); // re-render on seek/pause/stop so the resting position is redrawn
  const { sampleRate } = usePlaylistView(); // Static
  const { samplesPerPixel } = usePlaylistZoom(); // Changes on a zoom
  // ... move the playhead element from the frame callback / an effect
};

// Control component subscribes to state and controls only
export const ContinuousPlayCheckbox = () => {
  const { continuousPlay } = useAnnotationOptions(); // User interactions
  const { setContinuousPlay } = usePlaybackControls(); // Stable functions
  // NO re-renders during 60fps animation!
};
```

**Benefits:**

- ✅ **No unnecessary re-renders:** Checkboxes don't re-render during animation
- ✅ **Stable 60fps:** Animation loop runs smoothly without UI thrashing
- ✅ **Better performance:** Each component updates only when relevant data changes
- ✅ **Type-safe:** Full TypeScript support with separate interfaces

**Location:** `packages/browser/src/contexts/playlistContexts.ts` (contexts, value types, hooks); `packages/browser/src/WaveformPlaylistContext.tsx` and `packages/browser/src/MediaElementPlaylistContext.tsx` (the providers that render them)

### Custom Hooks Architecture

Business logic is extracted into reusable custom hooks that can be used by any component:

**Hooks (in `packages/browser/src/hooks/`):**

- `useAnimationFrameLoop` - Shared rAF lifecycle for both playlist providers
- `useAudioTracks` - Declarative track loading (configs-driven)
- `useClipDragHandlers` - Clip drag-to-move and boundary trimming (delegates to engine, wraps drags in transactions for undo)
- `useClipSplitting` - Split clips at playhead (delegates to engine)
- `useAnnotationDragHandlers` - Annotation edge drag logic (called by `WaveformAnnotationBoxes`; exported for a custom row of boxes)
- `useAnnotationKeyboardControls` - Annotation navigation & editing
- `useDynamicTracks` - Runtime track additions with placeholder-then-replace pattern
- `useKeyboardShortcuts` - Flexible keyboard shortcut system
- `usePlaybackShortcuts` - Default playback shortcuts (0 = rewind)
- `useDynamicEffects` - Master effects chain with runtime parameter updates
- `useTrackDynamicEffects` - Per-track effects management
- `useAudioEffects` - Audio effects management
- `useExportWav` - WAV export via Tone.Offline
- `useSelectionState` - Selection start/end (engine delegation + onEngineState)
- `useLoopState` - Loop enabled/start/end (engine delegation + onEngineState)
- `useSelectedTrack` - Selected track ID (engine delegation + onEngineState)
- `useMasterVolume` - Master volume (engine delegation + onEngineState)
- `useUndoState` - Undo/redo canUndo/canRedo (engine delegation + onEngineState)
- `useZoomControls` - Zoom samplesPerPixel/canZoomIn/Out (engine delegation + onEngineState)
- `useTimeFormat` - Time formatting and format selection
- `useOutputMeter` - Master bus output VU metering via AudioWorklet (returns a `MeterSource`, not state)
- `useWaveformDataCache` - Web worker peak generation and cache
- `useDragSensors` - @dnd-kit sensor configuration

Users can:

1. Use hooks to build custom UIs with their own components
2. Compose hooks for specific functionality
3. Maintain full type safety with TypeScript
4. Test hooks independently from UI

See `packages/browser/src/hooks/` for hook implementations.

### Component State (React useState)

State lives in `WaveformPlaylistContext` and is distributed across the split contexts:

```typescript
// IsPlayingContext
const [isPlaying, setIsPlaying] = useState(false);

// CurrentTimeContext
const [currentTime, setCurrentTime] = useState(0);

// ActiveAnnotationContext
const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);

// AnnotationsContext: the annotations come from the `annotationList` prop, not from state
// AnnotationOptionsContext (providerInternals/useAnnotationState.ts): state that follows the prop
const [editable, setAnnotationsEditable] = useFollowedOption(annotationList?.editable);
const [linkEndpoints, setLinkEndpoints] = useFollowedOption(annotationList?.linkEndpoints);
const [continuousPlay, setContinuousPlay] = useFollowedOption(annotationList?.isContinuousPlay);

// SelectionContext (mirrored from the engine by useSelectionState)
const [selectionStart, setSelectionStart] = useState(0);
const [selectionEnd, setSelectionEnd] = useState(0);

// PlaylistTimelineContext — derived from `tracks` during render, not state
const duration = useMemo(() => timelineDuration(tracks), [tracks]);
const peaksDataArray = useMemo(/* derivePeaks(...) with a per-clip cache */);
```

Access contexts using specialized hooks:

```typescript
const { isPlaying } = useIsPlaying();
const { currentTimeRef } = usePlaybackRefs();
const { annotations } = useAnnotations();
const { continuousPlay } = useAnnotationOptions();
const { selectionStart, selectionEnd } = useSelection();
const { currentTime } = useCurrentTime();
const { activeAnnotationId } = useActiveAnnotation();
const { play, pause, setContinuousPlay } = usePlaybackControls();
const { duration, tracks } = usePlaylistTimeline();
```

### Refs for Performance

```typescript
const playoutRef = useRef<PlaylistEngine | null>(null); // Engine ref (renamed from TonePlayout)
const currentTimeRef = useRef<number>(0); // For animation loop
const isSelectingRef = useRef(false); // For mouse interactions
const isDraggingRef = useRef(false); // Guards loadAudio during boundary trim drags
```

## Build Process

### 1. TypeScript Compilation (tsup)

Each package builds independently:

```bash
pnpm build  # Runs tsup for all packages
```

Output per package:

- `dist/index.js` (CJS)
- `dist/index.mjs` (ESM)
- `dist/index.d.ts` (Types)

### 2. Multi-Entry Packages

All packages build with tsup — no Vite in the package build pipeline (the `browser` package migrated off Vite per #317; tsup auto-externalizes `dependencies`/`peerDependencies` so no manual `external` list drifts). Two packages emit more than a single `index` bundle:

- **`@waveform-playlist/browser`** — `tsup.config.ts` lists two entries, `src/index.tsx` and `src/tone.ts`, producing the engine-free core bundle plus the `@waveform-playlist/browser/tone` subpath (Tone-coupled hooks/effects/export).
- **`@dawcore/spectrogram`** — three tsup entry blocks: main (CJS+ESM+DTS), `worker/spectrogram.worker` (ESM-only, no DTS), and `orchestrator/index` (ESM+DTS) under the `./orchestrator` subpath.

### 3. Docusaurus Website

```bash
pnpm website        # Start dev server (localhost:3000)
pnpm website:build  # Production build
```

Docusaurus webpack aliases resolve workspace packages from source for live development.

## Key Integration Points

### Audio Playback Flow

```
User clicks Play button
    ↓
handlePlayClick()
    ↓
Check for selection?
    ├─ Yes → engine.play(start, end)
    └─ No  → engine.play(currentTime)
    ↓
PlaylistEngine → ToneAdapter → TonePlayout (Tone.js)
    ↓
Web Audio API
    ↓
Animation loop (requestAnimationFrame)
    ↓
Update currentTime state
    ↓
Re-render Playhead position
```

### Optional Engine Resolution (`@waveform-playlist/browser`)

`WaveformPlaylistProvider`/`MediaElementPlaylistProvider` never statically import an audio engine — `playout`, `media-element-playout`, and `tone` are optional peer dependencies resolved at runtime:

```
Provider mounts
    ↓
createAdapter / createPlayout prop supplied?
    ├─ Yes → call factory directly (no import of playout/tone/media-element-playout)
    └─ No  → dynamic import() of the default engine
              (src/playout/resolvePlayoutAdapter.ts | resolveMediaElementPlayout.ts)
              ├─ Success → engine constructed, provider proceeds
              └─ Failure → install-hint error rethrown (peer not installed)
    ↓
Tone-coupled hooks/effects/export (useAudioTracks, useDynamicEffects, useExportWav, …)
    are only reachable via the `@waveform-playlist/browser/tone` subpath —
    the core entry's static import graph stays engine-free under every bundler
```

### Clip Mutation Flow (Move/Trim/Split)

```
User drags clip
    ↓
useClipDragHandlers → engine.moveClip(trackId, clipId, deltaSamples)
    ↓
PlaylistEngine:
    ├─ Constrains delta (collision detection)
    ├─ Updates internal _tracks
    ├─ adapter.setTracks() (syncs TonePlayout)
    ├─ _tracksVersion++
    └─ Emits 'statechange' with new EngineState
    ↓
Provider statechange handler:
    └─ onTracksChange(state.tracks) → parent updates tracks prop
```

### Effects & Plugin Audio Path (dawcore)

Per-track and master effect chains insert into the native transport's signal path:

```
Clip source (AudioBufferSourceNode)
    ↓
TrackNode input (unity)
    ↓
Per-track EffectsChainController        ← transport.connectTrackEffects(trackId, chain.input, chain.output)
    (ordered entries: native-* | wam)       pre-fader insert
    ↓
TrackNode (volume → pan → mute)
    ↓
Master gain
    ↓
Master EffectsChainController           ← transport.connectMasterOutput(chain)
    ↓
audioContext.destination
```

**WAM plugin lifecycle:**

```
editor.addWamPlugin(url)  /  editor.addFaustEffect(dspCode)
    ↓
dynamic import @dawcore/wam (and @dawcore/faust for compilation)
    ↓
ensureWamHost(audioContext)             # idempotent per context
    ↓
createWamInstance(url, …)               # or compileFaustToWam → createWamInstanceFromFactory
    ↓
EffectsChainController entry { kind: 'wam' }   # input = output = plugin audioNode
    ↓
WAM transport bridge broadcasts wam-transport events (play/seek/tempo/meter)
```

**Offline export path** (`editor.exportAudio()`):

```
OfflineAudioContext
    ├─ Clips scheduled statically: source.start(when, offset, duration) — no Transport
    ├─ Chains rebuilt from persisted state (getEffectsState):
    │   ├─ native entries via the effect registry
    │   └─ WAM entries via ensureWamHost(offlineCtx) + re-instantiation with saved state
    │       (worklets are context-bound; Faust entries recompile from saved DSP)
    └─ startRendering() → AudioBuffer → WAV
```

## Example Page Flow

### Example Components (Docusaurus)

Examples are React components in `website/src/components/examples/`:

1. **Component:** e.g., `AnnotationsExample.tsx`
   - Self-contained React component
   - Uses `WaveformPlaylistProvider` pattern
   - Loads audio and annotations

2. **Page Wrapper:** `website/src/pages/examples/annotations.tsx`
   - Uses `createLazyExample()` for SSR compatibility
   - Lazy loads the example component

3. **Component Lifecycle:**
   - Load audio → decode → generate peaks
   - Initialize TonePlayout via context
   - Render waveform canvas

### Multi-Clip Example

**Purpose:** Demonstrates multiple audio clips per track with gaps and different timing.

**Architecture - File-Reference Data Model:**

The multi-clip example uses a **file-reference architecture** to efficiently handle multiple clips that share the same audio file:

```typescript
// Audio files - each loaded and decoded once
// Albert Kader minimal techno stems
const audioFiles = [
  { id: 'kick', src: 'media/audio/AlbertKader_Ubiquitous/01_Kick.opus' },
  { id: 'bass', src: 'media/audio/AlbertKader_Ubiquitous/08_Bass.opus' },
  { id: 'synth', src: 'media/audio/AlbertKader_Whiptails/09_Synth1.opus' },
  { id: 'loop', src: 'media/audio/AlbertKader_Whiptails/01_Loop1.opus' },
];

// Track configuration - clips reference files by ID
const trackConfigs = [
  {
    name: 'Kick',
    clips: [
      { fileId: 'kick', startTime: 0, duration: 8, offset: 0 },
      { fileId: 'kick', startTime: 12, duration: 5, offset: 8 },
    ],
  },
  // ... more tracks
];
```

**Two-Phase Loading:**

1. **Step 1:** Load all audio files once, store in Map by ID
   ```typescript
   const fileBuffers = new Map(loadedFiles.map(f => [f.id, f.buffer]));
   ```

2. **Step 2:** Create tracks by referencing loaded buffers via `fileId`
   ```typescript
   const audioBuffer = fileBuffers.get(clipConfig.fileId);
   ```

**Benefits:**
- ✅ Each audio file loaded only once
- ✅ Multiple clips can reference the same file without reloading
- ✅ Easy to copy/paste clip configurations
- ✅ Efficient memory usage

**Location:** `website/src/components/examples/MultiClipExample.tsx`

## Development Workflow

### Local Development

```bash
# Terminal 1: Docusaurus dev server (hot reload)
pnpm website

# Terminal 2: Build packages after changes (if needed)
pnpm build
```

### Testing Changes

1. Edit code in `packages/`
2. Docusaurus hot reloads automatically (webpack aliases resolve from source)
3. For dist changes, run `pnpm build` then hard refresh browser (Cmd+Shift+R)
4. Check `http://localhost:3000/waveform-playlist/examples/`

## Important Files

### Configuration

- `pnpm-workspace.yaml` - Workspace configuration
- `package.json` - Root package, scripts
- `tsconfig.json` - TypeScript base config
- `packages/*/tsup.config.ts` - Build configs
- `packages/browser/vite.config.ts` - Browser bundle config
- `website/docusaurus.config.ts` - Docusaurus config with webpack aliases

### Entry Points

- `packages/browser/src/index.tsx` - Main bundle entry
- `packages/ui-components/src/index.tsx` - Component library exports
- `website/src/components/examples/` - Example components

### Documentation

- `CLAUDE.md` - AI development notes and architectural decisions
- `PROJECT_STRUCTURE.md` - This file

## Flexible/Headless API Architecture

The playlist now provides a **flexible/headless API** using React Context and primitive components, allowing complete customization of layout and controls.

### Architecture Pattern

**Hybrid Approach:** Provider + Primitives + Composed Parts

- `WaveformPlaylistProvider` wraps your app and provides state via context
- Primitive components (PlayButton, ZoomInButton, etc.) work anywhere inside the provider
- The view is composed from parts inside `WaveformRoot`. The children of `WaveformTrackControls` are the control panel of one track, rendered once per track inside that track's context (`useTrack()`); the default panel and its pieces are exported. `Waveform` is the ready-made composition
- Split context hooks (`usePlaylistTimeline`, `usePlaybackControls`, `useEditorControls`, etc.) provide direct access to state/methods

### Benefits

1. **Maximum Flexibility** - Place controls anywhere in your layout
2. **Customizable Track Controls** - Compose a track's panel from the exported pieces, or write your own with `useTrack()`
3. **Access to State** - Build entirely custom components using the hook
4. **Type Safety** - Full TypeScript support with auto-completion
5. **Good Defaults** - Waveform provides sensible default track controls

### Usage Patterns

**Option 1: Flexible API with Provider (Recommended)**

```typescript
import {
  WaveformPlaylistProvider,
  PlayButton,
  StopButton,
  WaveformRoot,
  WaveformTimescale,
  WaveformTrackControls,
  WaveformTracks,
  WaveformSelection,
  WaveformPlayhead,
  MasterVolumeControl,
  useTrack,
} from '@waveform-playlist/browser';

// Custom track controls: rendered once per track by WaveformTrackControls,
// and useTrack() is the track this copy is drawn for
const CustomTrackControls = () => {
  const { muted, isLoading, setMuted } = useTrack();
  return (
    <button disabled={isLoading} onClick={() => setMuted(!muted)}>
      {muted ? 'Unmute' : 'Mute'}
    </button>
  );
};

// Your custom layout
function MyPlaylist() {
  return (
    <WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1024}>
      <div className="my-layout">
        <div className="controls">
          <PlayButton />
          <StopButton />
          <MasterVolumeControl />
        </div>

        <WaveformRoot>
          <WaveformTimescale />
          <WaveformTrackControls>
            <CustomTrackControls />
          </WaveformTrackControls>
          <WaveformTracks />
          <WaveformSelection />
          <WaveformPlayhead />
        </WaveformRoot>
      </div>
    </WaveformPlaylistProvider>
  );
}
```

**Option 2: Individual Hooks (Advanced)**

```typescript
import {
  useTimeFormat,
} from "@waveform-playlist/browser/hooks";

const { formatTime } = useTimeFormat();
```

### Example Components

See `website/src/components/examples/` for 20 complete examples covering minimal setup, stem tracks, effects, fades, recording, annotations, spectrogram, Web Components, and more. Standalone Vite apps in `examples/` (`dawcore-native`, `dawcore-tone`, `dawcore-wam`) cover the `@dawcore/*` Web Components stack.

### Documentation

- `website/src/components/examples/FlexibleApiExample.tsx` - Flexible API example

## E2E Testing

**Location:** `e2e/`, **Config:** `playwright.config.ts`

**Commands:** `pnpm test`, `pnpm test:ui`, `pnpm test:headed`

**Environment:** `BASE_PATH` (default: `/waveform-playlist`), `PORT` (default: `3000`)

### Data Attributes

| Attribute | Purpose |
|-----------|---------|
| `data-clip-id` | Draggable clip headers |
| `data-boundary-edge` | Trim handles (left/right) |
| `data-clip-container` | Clip wrapper |
| `data-scroll-container` | Playhead click target |

### pointer-events Architecture

Enables click-through for playhead positioning while keeping clips interactive:

- `ClickOverlay`: `pointer-events: auto` (catches timeline clicks)
- `ClipContainer`: `pointer-events: none` (passes clicks through)
- `ClipHeader`, `ClipBoundary`: `pointer-events: auto` (re-enabled for drag/trim)

## Future Improvements

See `TODO.md` for roadmap and progress tracking.

Architectural patterns and conventions documented in `CLAUDE.md`.
