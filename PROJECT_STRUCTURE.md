# Project Structure

## Overview

Waveform-playlist is a **monorepo** organized with pnpm workspaces. It's a multitrack Web Audio editor and player with canvas-based waveform visualizations.

**Stack:** React + Tone.js + styled-components (v10 released)

## Monorepo Structure

```
waveform-playlist/
├── packages/              # Workspace packages (modular architecture)
│   ├── annotations/       # 📦 OPTIONAL: Annotation components & hooks
│   ├── browser/           # Main React package (provider, hooks, components)
│   ├── core/              # Core types and interfaces
│   ├── dawcore/           # Web Components (Lit) — framework-agnostic DAW UI
│   ├── loaders/           # Audio file loaders
│   ├── media-element-playout/  # Audio playback (HTMLAudioElement, no Tone.js)
│   ├── engine/            # Framework-agnostic timeline engine
│   ├── midi/              # 📦 OPTIONAL: MIDI file parsing, piano roll, SoundFont playback
│   ├── playout/           # Audio playback (Tone.js wrapper)
│   ├── recording/         # 📦 OPTIONAL: Audio recording hooks (no UI components)
│   ├── spectrogram/       # 📦 OPTIONAL: FFT computation, worker rendering, color maps
│   ├── ui-components/     # Reusable React UI components (incl. SegmentedVUMeter)
│   ├── webaudio-peaks/    # Waveform peak generation
│   └── worklets/          # Shared AudioWorklet processors (metering, recording)
│
└── website/               # Docusaurus documentation site
    ├── src/
    │   ├── components/examples/  # React example components (18 examples)
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
    │   │   └── MobileMultiClipExample.tsx    # Mobile-optimized multi-clip
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
  - `beatsAndBars.ts` — `PPQN` (192), `ticksPerBeat`, `ticksPerBar`, `ticksToSamples`, `samplesToTicks`, `snapToGrid`, `ticksToBarBeatLabel`
  - `keyboard.ts` — `KeyboardShortcut` type, `handleKeyboardEvent()` (matches event to shortcut array), `getShortcutLabel()` (human-readable label from shortcut definition)

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
- **Key Types:** `PlayoutAdapter` (pluggable audio backend, optional `addTrack()` for incremental additions), `EngineState` (state snapshot incl. `tracksVersion`), `EngineEvents` (statechange, play/pause/stop)
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
  ├── components/        # Public components (37 files)
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
  │   ├── SegmentedVUMeter.tsx   # LED-style VU meter (multi-channel)
  │   ├── ErrorBoundary.tsx      # PlaylistErrorBoundary (plain CSS)
  │   ├── AudioPosition.tsx      # Current time display
  │   ├── TimeInput.tsx          # Time value input
  │   ├── SelectionTimeInputs.tsx # Selection start/end inputs
  │   ├── TimeScale.tsx          # Timeline ruler
  │   ├── SmartScale.tsx         # Beats/bars or time scale
  │   ├── TimeFormatSelect.tsx   # Time format dropdown
  │   ├── MasterVolumeControl.tsx # Volume slider
  │   ├── AutomaticScrollCheckbox.tsx # Auto-scroll toggle
  │   ├── Controls.tsx           # Track controls container
  │   ├── TrackMenu.tsx          # Per-track dropdown menu
  │   ├── Header.tsx             # Header component
  │   ├── Button.tsx             # Base button
  │   ├── ButtonGroup.tsx        # Button group layout
  │   ├── CloseButton.tsx        # Close/dismiss button
  │   ├── Slider.tsx             # Range slider
  │   ├── SliderWrapper.tsx      # Slider container
  │   ├── DotsIcon.tsx           # Menu dots icon
  │   ├── TrashIcon.tsx          # Delete icon
  │   ├── VolumeDownIcon.tsx     # Volume down icon
  │   ├── VolumeUpIcon.tsx       # Volume up icon
  │   └── TrackControls/         # Mute, solo, volume, pan
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
  - `SegmentedVUMeter` - LED-style VU meter (horizontal/vertical, multi-channel, configurable dB range/color stops/peak hold)
  - `PlaylistErrorBoundary` - Error boundary with plain CSS (no ThemeProvider dependency)
  - `TimeInput` / `SelectionTimeInputs` - Time value inputs
  - `TimeScale` / `SmartScale` - Timeline ruler (`getScaleInfo()` exported for grid calculations)
  - `TimeFormatSelect` - Time format dropdown
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
  ├── hooks/                            # Custom hooks
  │   ├── useAnimationFrameLoop.ts      # Shared rAF loop for providers
  │   ├── useAnnotationDragHandlers.ts  # Annotation drag logic
  │   ├── useAnnotationKeyboardControls.ts # Annotation navigation & editing
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
  │   ├── useOutputMeter.ts             # Master bus output VU metering via worklet
  │   ├── usePlaybackShortcuts.ts       # Default playback shortcuts
  │   ├── useSelectedTrack.ts           # Selected track ID (engine delegation + onEngineState)
  │   ├── useSelectionState.ts          # Selection state (engine delegation + onEngineState)
  │   ├── useTimeFormat.ts              # Time formatting
  │   ├── useTrackDynamicEffects.ts     # Per-track effects
  │   ├── useUndoState.ts              # Undo/redo state (engine delegation + onEngineState)
  │   ├── useWaveformDataCache.ts       # Web worker peak generation cache
  │   └── useZoomControls.ts            # Zoom state (engine delegation + onEngineState)
  ├── components/                       # React components
  │   ├── PlaylistVisualization.tsx      # Main waveform + track rendering
  │   ├── Waveform.tsx                  # Public waveform component
  │   ├── ClipInteractionProvider.tsx   # Declarative clip drag/trim/snap/collision
  │   ├── KeyboardShortcuts.tsx         # Declarative keyboard shortcut component (playback, splitting, undo props)
  │   ├── PlaybackControls.tsx          # Play/Pause/Stop/Rewind/FastForward buttons
  │   ├── ZoomControls.tsx              # Zoom in/out buttons
  │   ├── ExportControls.tsx            # WAV export controls
  │   ├── AnnotationControls.tsx        # Annotation list + editing UI
  │   ├── ChannelWithProgress.tsx       # Waveform channel with playback progress overlay
  │   ├── ChannelWithMediaElementProgress.tsx  # MediaElement progress overlay
  │   ├── AnimatedPlayhead.tsx          # Smooth 60fps playhead (Tone.js)
  │   ├── AnimatedMediaElementPlayhead.tsx # Smooth 60fps playhead (MediaElement)
  │   ├── PlaylistAnnotationList.tsx    # Annotation list for Tone.js provider
  │   ├── MediaElementAnnotationList.tsx # Annotation list for MediaElement provider
  │   ├── MediaElementPlaylist.tsx      # Single-track waveform (MediaElement)
  │   ├── MediaElementWaveform.tsx      # Public MediaElement waveform component
  │   ├── ContextualControls.tsx        # Context-aware wrappers
  │   └── index.tsx                     # Component exports
  ├── modifiers/                        # @dnd-kit drag modifiers
  │   ├── ClipCollisionModifier.ts      # Prevents overlapping clips during drag
  │   └── SnapToGridModifier.ts         # Snap-to-grid (beats or timescale mode)
  ├── plugins/                          # @dnd-kit plugins
  │   └── noDropAnimationPlugins.ts     # Disables Feedback plugin drop animation
  ├── effects/                          # Audio effects system
  │   ├── effectDefinitions.ts          # 20 Tone.js effect definitions
  │   ├── effectFactory.ts              # Effect instance creation
  │   └── index.ts
  ├── workers/                          # Web workers
  │   └── peaksWorker.ts                # Inline Blob worker for peak generation
  └── waveformDataLoader.ts            # BBC waveform-data.js support
  ```
- **Build:** Vite + tsup

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
- **Location:** `packages/playout/src/audioContext.ts`

#### `@waveform-playlist/media-element-playout`

- **Purpose:** Lightweight audio playback using HTMLAudioElement (no Tone.js dependency)
- **Key class:** `MediaElementPlayout`
- **Use Cases:**
  - Large audio files - streams without downloading entire file
  - Pre-computed peaks - use [audiowaveform](https://github.com/bbc/audiowaveform) server-side
  - Playback rate control - 0.5x to 2.0x with pitch preservation
  - Single-track playback - simpler API, smaller bundle
- **Features:**
  - Play/pause/stop control
  - Seeking
  - Playback rate adjustment with pitch preservation
  - currentTime tracking via animation frame
- **When to Use:**
  - Choose `MediaElementPlaylistProvider` for streaming large files with pre-computed peaks
  - Choose `WaveformPlaylistProvider` (Tone.js) for multi-track mixing, effects, recording
- **Dependencies:** None (pure HTMLAudioElement)
- **Location:** `packages/media-element-playout/src/`
- **Browser Integration:**
  - `MediaElementPlaylistProvider` - Context provider for media element playback
  - `MediaElementWaveform` - Single-track waveform component
  - Hooks: `useMediaElementAnimation`, `useMediaElementControls`, `useMediaElementState`, `useMediaElementData`
- **Example:** `website/src/pages/examples/media-element.tsx`

#### `@waveform-playlist/loaders`

- **Purpose:** Load audio files from various sources
- **Exports:** Audio loading utilities
- **Dependencies:** Core

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
  │   └── LinkEndpointsCheckbox.tsx
  ├── hooks/             # Custom hooks
  │   └── useAnnotationControls.ts
  ├── types/             # TypeScript types
  │   └── index.ts
  ├── parsers/           # Import/export (Aeneas JSON)
  │   └── aeneas.ts
  └── index.ts           # Public exports
  ```
- **Key Hook:** `useAnnotationControls`
  - Manages `continuousPlay` and `linkEndpoints` state
  - Provides `updateAnnotationBoundaries()` with complex logic:
    - Linked endpoints (boundaries move together when touching)
    - Collision detection (prevents overlap)
    - Cascading updates (multiple annotations adjust together)
- **Components:**
  - Visual: AnnotationBox, AnnotationBoxesWrapper, AnnotationsTrack
  - Text: Annotation, AnnotationText
  - Controls: ContinuousPlayCheckbox, LinkEndpointsCheckbox
- **Peer Dependencies:** React ^18.0.0, styled-components ^6.0.0
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
  │   └── useIntegratedRecording.ts
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
    - Returns: `isRecording`, `isPaused`, `duration`, `levels`, `peakLevels`, `rmsLevels`, `error`
    - Methods: `startRecording()`, `stopRecording()`, `pauseRecording()`, `resumeRecording()`, `requestMicAccess()`, `changeDevice()`
  - `useRecording` - Low-level recording lifecycle with AudioWorklet
    - Returns: `isRecording`, `isPaused`, `duration`, `peaks`, `audioBuffer`
    - Methods: `startRecording()`, `stopRecording()`, `pauseRecording()`, `resumeRecording()`
  - `useMicrophoneAccess` - Device enumeration, permission handling, hot-plug detection
    - Returns: `stream`, `devices`, `hasPermission`, `requestAccess()`, `stopStream()`, `error`
  - `useMicrophoneLevel` - Real-time per-channel level monitoring via meter-processor worklet
    - Returns: `level`, `peakLevel`, `levels`, `peakLevels`, `rmsLevels`, `resetPeak()`, `error`

- **Important Patterns:**
  1. **AudioWorklet Debugging** - console.log in worklets doesn't appear in browser console
     - Use `postMessage()` to send debug data to main thread
  2. **Worklet Deployment** - Worklet files live in `@waveform-playlist/worklets`, bundled via tsup
     - Docusaurus webpack aliases handle module resolution
  3. **Try-Catch for Cleanup** - Wrap disconnect calls in try-catch for microphone switching

- **Peer Dependencies:** React ^18.0.0
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
- **Purpose:** FFT-based spectrogram visualization with worker-based rendering
- **Install:** `npm install @waveform-playlist/spectrogram`
- **Structure:**
  ```
  src/
  ├── SpectrogramProvider.tsx  # Provider (fills SpectrogramIntegrationContext)
  ├── components/              # UI components (menu items, settings modal)
  ├── computation/             # FFT computation logic
  ├── worker/
  │   ├── createSpectrogramWorker.ts      # Single worker wrapper + SpectrogramAbortError
  │   ├── createSpectrogramWorkerPool.ts  # Pool of N workers for parallel per-channel FFT
  │   └── spectrogram.worker.ts           # Worker: FFT, LRU cache, canvas rendering
  ├── styled.d.ts
  └── index.ts
  ```
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

### 🧱 Web Components

#### `@dawcore/components`

- **Purpose:** Framework-agnostic Web Components (Lit) for multi-track audio editing. Wraps `PlaylistEngine` + `createToneAdapter()` in custom elements.
- **Architecture:** Data elements (`<daw-track>`, `<daw-clip>`) use light DOM; visual elements (`<daw-waveform>`, `<daw-playhead>`, `<daw-ruler>`) use Shadow DOM with chunked canvas rendering. `<daw-editor>` orchestrates everything.
- **Build:** tsup — `pnpm typecheck && tsup`. `sideEffects: true` (element imports register custom elements globally).
- **Testing:** vitest with happy-dom. Run with `cd packages/dawcore && npx vitest run`.
- **Dev page:** `pnpm dev:page` starts Vite at `http://localhost:5173/dev/index.html`. Resolves workspace packages from source via Vite aliases.
- **Key Elements:**
  - `<daw-editor>` — Core orchestrator. Builds engine lazily on first track load. Attributes: `interactive-clips`, `clip-headers`, `clip-header-height`. Methods: `undo()`, `redo()`, `togglePlayPause()`, `seekTo()`. Getters: `canUndo`, `canRedo`.
  - `<daw-track>`, `<daw-clip>` — Declarative data elements (light DOM)
  - `<daw-waveform>` — Chunked canvas rendering with dirty pixel tracking
  - `<daw-playhead>`, `<daw-ruler>`, `<daw-selection>` — Visual overlays
  - `<daw-transport>`, `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>`, `<daw-record-button>` — Transport controls (find target via `for` attribute)
  - `<daw-track-controls>` — Mute/solo/volume/pan per track
  - `<daw-keyboard-shortcuts>` — Render-less element. Boolean attribute presets: `playback`, `splitting`, `undo`. JS properties for remapping (`playbackShortcuts`, `splittingShortcuts`, `undoShortcuts`) and custom shortcuts (`customShortcuts`). Listener on `document`. Uses `handleKeyboardEvent` from `@waveform-playlist/core`.
- **Clip Interactions:**
  - `ClipPointerHandler` (`interactions/clip-pointer-handler.ts`) — Move (header drag) and trim (boundary drag) with engine delegation
  - `splitAtPlayhead` (`interactions/split-handler.ts`) — Split clip at current playhead position (S key)
  - `clip-peak-sync.ts` — Regenerates peaks after split/trim via `_syncPeaksForChangedClips`
  - Move uses incremental deltas with `skipAdapter` (60fps); trim accumulates delta and calls engine once on drop
- **Dependencies:** Lit, `@waveform-playlist/core`, `@waveform-playlist/engine`, `@waveform-playlist/playout`
- **Location:** `packages/dawcore/`

## Data Flow Architecture

### Current Architecture (React + Hooks + Context)

**Flexible API Pattern (Provider + Engine + Primitives):**

```
User Interaction (React Events)
    ↓
WaveformPlaylistProvider (Split Contexts for Performance)
    ├─→ PlaybackAnimationContext (60fps updates)
    │   └─→ isPlaying, currentTime, currentTimeRef
    ├─→ PlaylistStateContext (user interactions)
    │   └─→ selection, loop, selectedTrackId, annotations, etc.
    ├─→ PlaylistControlsContext (stable functions)
    │   └─→ play(), pause(), zoomIn(), setSelection(), etc.
    └─→ PlaylistDataContext (static/infrequent updates)
        └─→ duration, audioBuffers, peaksDataArray, isDraggingRef, etc.
    ↓
├─→ Primitive Components (subscribe to relevant contexts only)
│   ├─→ PlayButton, PauseButton, StopButton
│   ├─→ ZoomInButton, ZoomOutButton
│   ├─→ MasterVolumeControl, TimeFormatSelect
│   └─→ Waveform (with custom track controls)
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

The provider uses **4 separate contexts** to optimize performance by isolating different update frequencies:

1. **PlaybackAnimationContext** - High-frequency (60fps)
   - Only animation subscribers (Playhead, automatic scroll)
   - Prevents re-renders in UI controls

2. **PlaylistStateContext** - User interactions
   - State that changes on user actions
   - UI components subscribe here

3. **PlaylistControlsContext** - Stable functions
   - Doesn't cause re-renders when accessed
   - All control functions

4. **PlaylistDataContext** - Static/infrequent
   - Audio buffers, duration, sample rate
   - Changes rarely after initialization

**Key Files:**

- `packages/browser/src/WaveformPlaylistContext.tsx` - Context provider (flexible API)
- `packages/browser/src/SpectrogramIntegrationContext.tsx` - Optional spectrogram integration
- `packages/browser/src/hooks/` - Reusable business logic
- `packages/browser/src/components/` - React components
- `packages/engine/src/PlaylistEngine.ts` - Stateful timeline engine
- `packages/engine/src/operations/` - Pure clip/timeline/viewport operations
- `packages/ui-components/src/components/Playlist.tsx` - UI container
- `packages/playout/src/TonePlayout.ts` - Audio playback

## State Management

### Context Splitting for Performance (2025-01-21)

The `WaveformPlaylistProvider` uses **4 separate contexts** to optimize performance by isolating different update frequencies. This prevents unnecessary re-renders when high-frequency values (like `currentTime` at 60fps) update.

**Architecture:**

```typescript
// 1. High-frequency updates (60fps) - Only animation subscribers
export interface PlaybackAnimationContextValue {
  isPlaying: boolean;
  currentTime: number;
  currentTimeRef: React.RefObject<number>;
  playbackStartTimeRef: React.RefObject<number>;   // context.currentTime when playback started
  audioStartPositionRef: React.RefObject<number>;   // Audio position when playback started
  getPlaybackTime: () => number;                     // Current time from engine (auto-wraps at loops)
}

// 2. User interaction state - UI components (includes engine-mirrored state)
export interface PlaylistStateContextValue {
  continuousPlay: boolean;
  linkEndpoints: boolean;
  annotationsEditable: boolean;
  isAutomaticScroll: boolean;
  isLoopEnabled: boolean;
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  selectionStart: number;
  selectionEnd: number;
  selectedTrackId: string | null;
  loopStart: number;
  loopEnd: number;
  indefinitePlayback: boolean;       // Whether playback continues past end of audio
  canUndo: boolean;
  canRedo: boolean;
}

// 3. Control functions - Stable, don't cause re-renders
export interface PlaylistControlsContextValue {
  // Playback
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekTo: (time: number) => void;
  setCurrentTime: (time: number) => void;
  // Track controls
  setTrackMute: (trackIndex: number, muted: boolean) => void;
  setTrackSolo: (trackIndex: number, soloed: boolean) => void;
  setTrackVolume: (trackIndex: number, volume: number) => void;
  setTrackPan: (trackIndex: number, pan: number) => void;
  // Selection
  setSelection: (start: number, end: number) => void;
  setSelectedTrackId: (trackId: string | null) => void;
  // Time format
  setTimeFormat: (format: TimeFormat) => void;
  formatTime: (seconds: number) => string;
  // Zoom
  zoomIn: () => void;
  zoomOut: () => void;
  // Master volume
  setMasterVolume: (volume: number) => void;
  // Scroll
  setAutomaticScroll: (enabled: boolean) => void;
  setScrollContainer: (element: HTMLDivElement | null) => void;
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  // Annotations
  setContinuousPlay: (enabled: boolean) => void;
  setLinkEndpoints: (enabled: boolean) => void;
  setAnnotationsEditable: (enabled: boolean) => void;
  setAnnotations: React.Dispatch<React.SetStateAction<AnnotationData[]>>;
  setActiveAnnotationId: (id: string | null) => void;
  // Loop
  setLoopEnabled: (enabled: boolean) => void;
  setLoopRegion: (start: number, end: number) => void;
  setLoopRegionFromSelection: () => void;
  clearLoopRegion: () => void;
  // Undo/Redo
  undo: () => void;
  redo: () => void;
}

// 4. Static/infrequent data
export interface PlaylistDataContextValue {
  duration: number;
  audioBuffers: AudioBuffer[];
  peaksDataArray: TrackClipPeaks[];
  trackStates: TrackState[];
  tracks: ClipTrack[];
  sampleRate: number;
  waveHeight: number;
  timeScaleHeight: number;
  minimumPlaylistHeight: number;
  controls: { show: boolean; width: number };
  playoutRef: React.RefObject<PlaylistEngine | null>;
  samplesPerPixel: number;
  timeFormat: TimeFormat;
  masterVolume: number;
  canZoomIn: boolean;
  canZoomOut: boolean;
  barWidth: number;
  barGap: number;
  progressBarWidth: number;
  isReady: boolean;
  mono: boolean;
  isDraggingRef: React.MutableRefObject<boolean>;
  onTracksChange: ((tracks: ClipTrack[]) => void) | undefined;
}
```

**Usage Pattern:**

Components subscribe only to the contexts they need:

```typescript
// Animation component subscribes to high-frequency updates
export const Playhead = () => {
  const { currentTime } = usePlaybackAnimation(); // 60fps updates
  const { sampleRate, samplesPerPixel } = usePlaylistData(); // Static
  // ... render playhead
};

// Control component subscribes to state and controls only
export const ContinuousPlayCheckbox = () => {
  const { continuousPlay } = usePlaylistState(); // User interactions
  const { setContinuousPlay } = usePlaylistControls(); // Stable functions
  // NO re-renders during 60fps animation!
};
```

**Benefits:**

- ✅ **No unnecessary re-renders:** Checkboxes don't re-render during animation
- ✅ **Stable 60fps:** Animation loop runs smoothly without UI thrashing
- ✅ **Better performance:** Each component updates only when relevant data changes
- ✅ **Type-safe:** Full TypeScript support with separate interfaces

**Location:** `packages/browser/src/WaveformPlaylistContext.tsx`

### Custom Hooks Architecture

Business logic is extracted into reusable custom hooks that can be used by any component:

**Hooks (in `packages/browser/src/hooks/`):**

- `useAnimationFrameLoop` - Shared rAF lifecycle for both playlist providers
- `useAudioTracks` - Declarative track loading (configs-driven)
- `useClipDragHandlers` - Clip drag-to-move and boundary trimming (delegates to engine, wraps drags in transactions for undo)
- `useClipSplitting` - Split clips at playhead (delegates to engine)
- `useAnnotationDragHandlers` - Annotation drag logic
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
- `useOutputMeter` - Master bus output VU metering via AudioWorklet
- `useWaveformDataCache` - Web worker peak generation and cache
- `useDragSensors` - @dnd-kit sensor configuration

Users can:

1. Use hooks to build custom UIs with their own components
2. Compose hooks for specific functionality
3. Maintain full type safety with TypeScript
4. Test hooks independently from UI

See `packages/browser/src/hooks/` for hook implementations.

### Component State (React useState)

State lives in `WaveformPlaylistContext` and is distributed across the 4 split contexts:

```typescript
// PlaybackAnimationContext
const [isPlaying, setIsPlaying] = useState(false);
const [currentTime, setCurrentTime] = useState(0);

// PlaylistStateContext
const [continuousPlay, setContinuousPlay] = useState(false);
const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
const [selectionStart, setSelectionStart] = useState(0);
const [selectionEnd, setSelectionEnd] = useState(0);

// PlaylistDataContext
const [duration, setDuration] = useState(0);
const [audioBuffers, setAudioBuffers] = useState<AudioBuffer[]>([]);
```

Access contexts using specialized hooks:

```typescript
const { isPlaying, currentTime } = usePlaybackAnimation();
const { continuousPlay, annotations } = usePlaylistState();
const { play, pause, setContinuousPlay } = usePlaylistControls();
const { duration, audioBuffers } = usePlaylistData();
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

### 2. Vite Bundles (browser package)

```bash
# Auto-runs during pnpm build
vite build
```

Outputs:

- `packages/browser/dist/index.js` (CJS)
- `packages/browser/dist/index.mjs` (ESM)

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

**Hybrid Approach:** Provider + Primitives + Render Props

- `WaveformPlaylistProvider` wraps your app and provides state via context
- Primitive components (PlayButton, ZoomInButton, etc.) work anywhere inside the provider
- `Waveform` component accepts a render prop for custom track controls
- Split context hooks (`usePlaylistData`, `usePlaylistControls`, etc.) provide direct access to state/methods

### Benefits

1. **Maximum Flexibility** - Place controls anywhere in your layout
2. **Customizable Track Controls** - Use render prop to completely customize track UI
3. **Access to State** - Build entirely custom components using the hook
4. **Type Safety** - Full TypeScript support with auto-completion
5. **Good Defaults** - Waveform provides sensible default track controls
6. **Backward Compatible** - Old class-based API and WaveformPlaylistComponent still work

### Usage Patterns

**Option 1: Flexible API with Provider (Recommended)**

```typescript
import {
  WaveformPlaylistProvider,
  PlayButton,
  StopButton,
  Waveform,
  MasterVolumeControl,
  usePlaylistData,
  usePlaylistControls,
} from '@waveform-playlist/browser';

// Custom track controls
const CustomTrackControls = ({ trackIndex }) => {
  const { trackStates } = usePlaylistData();
  const { setTrackMute } = usePlaylistControls();
  return (
    <button onClick={() => setTrackMute(trackIndex, !trackStates[trackIndex].muted)}>
      {trackStates[trackIndex].muted ? 'Unmute' : 'Mute'}
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

        <Waveform
          renderTrackControls={(trackIndex) => (
            <CustomTrackControls trackIndex={trackIndex} />
          )}
        />
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

See `website/src/components/examples/` for 16 complete examples covering minimal setup, stem tracks, effects, fades, recording, annotations, spectrogram, and more.

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
