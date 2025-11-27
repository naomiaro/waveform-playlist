# Project Structure

## Overview

Waveform-playlist is a **monorepo** organized with pnpm workspaces. It's a multitrack Web Audio editor and player with canvas-based waveform visualizations.

**Current State:** Undergoing React migration (Tone.js overhaul branch)

- Old architecture: jQuery + EventEmitter pattern
- New architecture: React + Tone.js + styled-components

## Monorepo Structure

```
waveform-playlist/
├── packages/              # Workspace packages (modular architecture)
│   ├── annotations/       # 📦 OPTIONAL: Annotation components & hooks
│   ├── browser/           # React apps & webpack bundles
│   ├── core/              # Core types and interfaces
│   ├── loaders/           # Audio file loaders
│   ├── playout/           # Audio playback (Tone.js wrapper)
│   ├── recording/         # 📦 OPTIONAL: Audio recording with AudioWorklet
│   ├── ui-components/     # Reusable React UI components
│   └── webaudio-peaks/    # Waveform peak generation
│
└── website/               # Docusaurus documentation site
    ├── src/
    │   ├── components/examples/  # React example components
    │   │   ├── MinimalExample.tsx
    │   │   ├── StemTracksExample.tsx
    │   │   ├── EffectsExample.tsx
    │   │   ├── NewTracksExample.tsx
    │   │   ├── MultiClipExample.tsx
    │   │   ├── AnnotationsExample.tsx
    │   │   ├── RecordingExample.tsx
    │   │   ├── FlexibleApiExample.tsx
    │   │   └── WaveformDataExample.tsx  # BBC peaks demo
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

- **Purpose:** Core TypeScript interfaces and types
- **Exports:** AudioClip, ClipTrack, Timeline interfaces, factory functions
- **Dependencies:** None (pure types)
- **Used by:** All other packages

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

### 🎨 UI Layer

#### `@waveform-playlist/ui-components`

- **Purpose:** Reusable React components for waveform UI
- **Tech:** React, styled-components
- **Structure:**
  ```
  src/
  ├── components/        # Public components
  │   ├── TimeInput.tsx
  │   ├── SelectionTimeInputs.tsx
  │   ├── Playlist.tsx
  │   ├── Track.tsx
  │   ├── Clip.tsx
  │   ├── ClipHeader.tsx
  │   ├── Playhead.tsx
  │   ├── Selection.tsx
  │   ├── AnnotationBox.tsx
  │   └── TrackControls/
  ├── contexts/          # React contexts (theme, playlist info, playout)
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
  - `SmartChannel` - Waveform rendering with device pixel ratio
  - `TimeInput` - Time value input with format support
  - `Playhead` - Playback position indicator
  - `Selection` - Selection overlay
  - `AnnotationBox` - Annotation display/editing

#### `@waveform-playlist/browser`

- **Purpose:** Browser-ready React applications and webpack bundles
- **Outputs:**
  - `waveform-playlist.js` - Main bundle (UMD)
  - `annotations-bundle.js` - Annotations example bundle
  - `stem-tracks-bundle.js` - Stem tracks example bundle
  - `flexible-example-bundle.js` - Flexible API example bundle
- **Structure:**
  ```
  src/
  ├── index.tsx                         # Main entry point + API exports
  ├── annotations-app.tsx               # Annotations example app
  ├── stem-tracks-app.tsx               # Stem tracks example app
  ├── flexible-example-app.tsx          # Flexible API example app
  ├── WaveformPlaylistComponent.tsx     # Main React component (backward compatible)
  ├── WaveformPlaylistContext.tsx       # Context provider for flexible API
  ├── peaksUtil.ts                      # Peak generation helper
  ├── hooks/                            # Custom hooks for logic extraction
  │   ├── usePlaybackControls.ts        # Play/pause/stop/seek
  │   ├── useTimeFormat.ts              # Time formatting
  │   ├── useZoomControls.ts            # Zoom in/out
  │   ├── useAudioPosition.ts           # Audio position display
  │   ├── useMasterVolume.ts            # Master volume control
  │   ├── useWaveformPlaylist.ts        # Composite hook
  │   ├── useAnnotationKeyboardControls.ts # Annotation navigation & editing
  │   ├── useKeyboardShortcuts.ts       # Flexible keyboard shortcut system
  │   ├── usePlaybackShortcuts.ts       # Default playback shortcuts (0 = rewind)
  │   ├── useClipDragHandlers.ts        # Clip drag-to-move and trim
  │   ├── useClipSplitting.ts           # Split clips at playhead
  │   ├── index.ts                      # Hook exports
  │   └── README.md                     # Hook API docs
  ├── components/                       # Flexible API primitive components
  │   ├── PlaybackControls.tsx          # Play/Pause/Stop/Rewind/FF buttons
  │   ├── ZoomControls.tsx              # Zoom in/out buttons
  │   ├── ContextualControls.tsx        # Context-aware wrappers
  │   ├── Waveform.tsx                  # Main waveform visualization
  │   └── index.tsx                     # Component exports
  └── examples/                         # Usage examples
      └── CustomControlsExample.tsx     # Custom UI example
  ```
- **Build:** Vite production builds

### 🔊 Audio Layer

#### `@waveform-playlist/playout`

- **Purpose:** Audio playback abstraction using Tone.js + Global AudioContext management
- **Key class:** `TonePlayout`
- **Global AudioContext:**
  - Single AudioContext shared across the entire application
  - Created on first use, never closed during app lifetime
  - Used by Tone.js (configured via `Tone.setContext()`)
  - Used by recording (`useRecording` hook)
  - Used by monitoring (`useMicrophoneLevel` hook)
  - Exports: `getGlobalAudioContext()`, `resumeGlobalAudioContext()`, `getGlobalAudioContextState()`, `closeGlobalAudioContext()`
- **Features:**
  - Play/pause/stop control
  - Seeking
  - Timed segment playback
  - Track mixing
- **Dependencies:** Tone.js, Core
- **Location:** `packages/playout/src/audioContext.ts`

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
- **Documentation:** See `OPTIONAL_PACKAGES.md`

#### `@waveform-playlist/recording`

- **Type:** Optional package (install separately)
- **Purpose:** Audio recording support using AudioWorklet
- **Tech:** React, styled-components, AudioWorklet
- **Install:** `npm install @waveform-playlist/recording`
- **Structure:**
  ```
  src/
  ├── components/        # React components
  │   ├── RecordButton.tsx
  │   ├── MicrophoneSelector.tsx
  │   ├── RecordingIndicator.tsx
  │   └── VUMeter.tsx
  ├── hooks/             # Custom hooks
  │   ├── useRecording.ts
  │   ├── useMicrophoneAccess.ts
  │   └── useMicrophoneLevel.ts
  ├── types/             # TypeScript types
  │   └── index.ts
  ├── utils/             # Utilities
  │   ├── peaksGenerator.ts
  │   └── audioBufferUtils.ts
  ├── worklet/           # AudioWorklet processor
  │   └── recording-processor.worklet.ts
  └── index.ts           # Public exports
  ```

- **Key Architecture:**
  - **MediaStreamSource Per Hook** - Each hook creates its own source from Tone's `getContext()`
    - Avoids Firefox cross-context errors when sources/nodes are created in different modules
    - Both `useRecording` and `useMicrophoneLevel` create independent sources from same stream
    - See CLAUDE.md "MediaStreamSource Per Hook" for details
  - **Two-System Monitoring:**
    - `useMicrophoneLevel` - Pre-recording monitoring using Tone.js Meter (60fps)
    - `useRecording` - During-recording peak calculation in AudioWorklet (~16ms chunks)
  - **Test Microphone Button** - Resumes AudioContext to enable pre-recording level checks
  - **AudioWorklet Processing** - Captures audio samples in worklet thread, sends to main thread
  - **Duration Timer with Refs** - Uses `isRecordingRef`/`isPausedRef` for synchronous checks in animation loop
    - React state updates are asynchronous, can't be used in `requestAnimationFrame` loops
    - Refs update immediately and can be checked reliably in the animation loop

- **Key Features:**
  - **Global AudioContext** - Uses shared global context (same as Tone.js playback)
  - **Live waveform visualization** - Real-time Int16Array peaks (min/max pairs) during recording
  - **AudioBuffer support** - WaveformTrack accepts both URLs and AudioBuffer objects
  - **Microphone selection** - Enumerate and switch between input devices with auto-select first device
  - **Recording-optimized constraints** - Default audio constraints prioritize raw quality and low latency (no echo cancellation, noise suppression, or auto gain; latency: 0)
  - **VU meter** - Real-time RMS level display with peak hold
  - **Test Microphone** - Pre-recording level monitoring before committing to record

- **Hooks:**
  - `useRecording` - Complete recording lifecycle with AudioWorklet
    - Returns: `isRecording`, `isPaused`, `duration`, `peaks`, `audioBuffer`, `level`, `peakLevel`
    - Methods: `startRecording()`, `stopRecording()`, `pauseRecording()`, `resumeRecording()`
  - `useMicrophoneAccess` - Device enumeration and permission handling
    - Returns: `stream`, `devices`, `hasPermission`, `requestAccess()`, `error`
  - `useMicrophoneLevel` - Real-time audio level monitoring with AnalyserNode
    - Returns: `level`, `peakLevel`, `resetPeak()`

- **Components:**
  - Visual: RecordButton, RecordingIndicator (with duration timer), VUMeter
  - Controls: MicrophoneSelector

- **Important Patterns:**
  1. **Refs in Animation Loops** - Use refs for values checked in `requestAnimationFrame`:
     ```typescript
     const isRecordingRef = useRef(false);
     const updateDuration = () => {
       if (isRecordingRef.current) { // Synchronous check
         // ... update duration
         requestAnimationFrame(updateDuration);
       }
     };
     ```
  2. **AudioWorklet Debugging** - console.log in worklets doesn't appear in browser console
     - Use `postMessage()` to send debug data to main thread
     - Update UI/document.title to display values
  3. **Worklet Deployment** - Worklet files bundled automatically via tsup
     - Build: `pnpm build` (creates `dist/worklet/recording-processor.worklet.js`)
     - Docusaurus webpack aliases handle module resolution
  4. **Try-Catch for Cleanup** - Wrap disconnect calls in try-catch for microphone switching:
     ```typescript
     try {
       source.disconnect(destination);
     } catch (e) {
       // Source may already be disconnected when stream changed
     }
     ```

- **Peer Dependencies:** React ^18.0.0, styled-components ^6.0.0
- **Use Cases:** Voice recording, podcast editing, audio capture, live input, microphone testing
- **Example:** `website/src/components/examples/RecordingExample.tsx`
- **Debugging:** See `DEBUGGING.md` for comprehensive troubleshooting guide

## Data Flow Architecture

### Current Architecture (React + Hooks + Context)

**Flexible API Pattern (Provider + Primitives):**

```
User Interaction (React Events)
    ↓
WaveformPlaylistProvider (Split Contexts for Performance)
    ├─→ PlaybackAnimationContext (60fps updates)
    │   └─→ isPlaying, currentTime, currentTimeRef
    ├─→ PlaylistStateContext (user interactions)
    │   └─→ continuousPlay, annotations, selection, etc.
    ├─→ PlaylistControlsContext (stable functions)
    │   └─→ play(), pause(), setContinuousPlay(), etc.
    └─→ PlaylistDataContext (static/infrequent updates)
        └─→ duration, audioBuffers, peaksDataArray, etc.
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
└─→ TonePlayout (Tone.js)
    └─→ Web Audio API
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
- `packages/browser/src/WaveformPlaylistComponent.tsx` - Main orchestrator (backward compatible)
- `packages/browser/src/hooks/` - Reusable business logic
- `packages/browser/src/components/` - Primitive components
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
}

// 2. User interaction state - UI components
export interface PlaylistStateContextValue {
  continuousPlay: boolean;
  linkEndpoints: boolean;
  annotationsEditable: boolean;
  isAutomaticScroll: boolean;
  annotations: AnnotationData[];
  activeAnnotationId: string | null;
  selectionStart: number;
  selectionEnd: number;
}

// 3. Control functions - Stable, don't cause re-renders
export interface PlaylistControlsContextValue {
  play: (startTime?: number, playDuration?: number) => Promise<void>;
  pause: () => void;
  stop: () => void;
  setContinuousPlay: (value: boolean) => void;
  setAnnotations: (annotations: AnnotationData[]) => void;
  // ... other controls
}

// 4. Static/infrequent data
export interface PlaylistDataContextValue {
  duration: number;
  audioBuffers: AudioBuffer[];
  peaksDataArray: PeakData[];
  sampleRate: number;
  playoutRef: React.RefObject<Playout | null>;
  // ... other data
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

**Documentation:** See `CLAUDE.md` → "Continuous Play Toggle Fix" for detailed implementation

### Custom Hooks Architecture

Business logic is extracted into reusable custom hooks that can be used by any component:

**Individual Hooks:**

- `usePlaybackControls` - Play/pause/stop/seek operations
- `useTimeFormat` - Time formatting and format selection sync
- `useZoomControls` - Zoom level management with configurable levels
- `useAudioPosition` - Updates `.audio-pos` display element (backward compatibility)

**Composite Hook:**

- `useWaveformPlaylist` - Combines all hooks for convenience

Users can:

1. Use hooks to build custom UIs with their own components
2. Compose hooks for specific functionality
3. Maintain full type safety with TypeScript
4. Test hooks independently from UI

See `packages/browser/src/hooks/README.md` for full API documentation.

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
const playoutRef = useRef<TonePlayout | null>(null);
const currentTimeRef = useRef<number>(0); // For animation loop
const isSelectingRef = useRef(false); // For mouse interactions
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
    ├─ Yes → playoutRef.play(start, duration)
    └─ No  → playoutRef.play(currentTime)
    ↓
TonePlayout (Tone.js)
    ↓
Web Audio API
    ↓
Animation loop (requestAnimationFrame)
    ↓
Update currentTime state
    ↓
Re-render Playhead position
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

## Migration Status

### ✅ Completed (React)

- **Custom Hooks Architecture** - Reusable hooks for building custom UIs
  - `usePlaybackControls`, `useTimeFormat`, `useZoomControls`, `useAudioPosition`, `useMasterVolume`
  - `useWaveformPlaylist` composite hook
  - Full API documentation and examples
- **Flexible/Headless API** - Provider pattern with primitive components
  - `WaveformPlaylistProvider` - Context provider for state management
  - Primitive components: PlayButton, PauseButton, StopButton, ZoomInButton, etc.
  - `Waveform` component with render prop for custom track controls
  - `useWaveformPlaylist` hook for accessing context
  - Full example showing custom layout (`flexible-api.html`)
- **Optional Packages Architecture** - Annotations as separate package
  - `@waveform-playlist/annotations` package with components, hooks, types, and parsers
  - `useAnnotationControls` hook for annotation state and boundary logic
  - React checkbox components (ContinuousPlayCheckbox, LinkEndpointsCheckbox)
  - ~50KB bundle size reduction for users who don't need annotations
  - Documentation in `OPTIONAL_PACKAGES.md`
- Annotations example (using annotations package)
- Stem-tracks example (cleaned up with React controls)
- Selection time inputs
- Playback controls (play/pause/stop/seek)
- Waveform rendering
- Automatic scroll
- Track controls (mute/solo/volume/pan)
- Master volume control
- Stop button remembers start position
- Complete theming system (waveform colors, timescale, playhead, selection)
- Custom timestamp rendering

### 🚧 In Progress

- Design tokens system
- More examples showing different layouts

### 🔮 Planned

- Additional optional packages (effects, fades, etc.)
- Additional hooks (`useSelection`, `useKeyboardShortcuts`)
- Component library documentation
- Unit tests for hooks and components

### ❌ Not Started (Still jQuery)

- Most other examples (fades, effects, etc.)
- Some advanced features

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

- `packages/browser/HOOKS_ARCHITECTURE.md` - Hooks architecture overview
- `packages/browser/src/hooks/README.md` - Hooks API documentation
- `OPTIONAL_PACKAGES.md` - Optional packages guide (annotations, etc.)
- `CLAUDE.md` - AI development notes and architectural decisions
- `PROJECT_STRUCTURE.md` - This file

## Flexible/Headless API Architecture

The playlist now provides a **flexible/headless API** using React Context and primitive components, allowing complete customization of layout and controls.

### Architecture Pattern

**Hybrid Approach:** Provider + Primitives + Render Props

- `WaveformPlaylistProvider` wraps your app and provides state via context
- Primitive components (PlayButton, ZoomInButton, etc.) work anywhere inside the provider
- `Waveform` component accepts a render prop for custom track controls
- `useWaveformPlaylist` hook provides direct access to state/methods

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
  useWaveformPlaylist,
} from '@waveform-playlist/browser';

// Custom track controls
const CustomTrackControls = ({ trackIndex }) => {
  const { trackStates, setTrackMute } = useWaveformPlaylist();
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
  usePlaybackControls,
  useTimeFormat,
} from "@waveform-playlist/browser/hooks";

const { play, pause, stop } = usePlaybackControls({ playoutRef });
const { formatTime } = useTimeFormat();
```

**Option 3: Traditional Component (Backward Compatible)**

```typescript
import { WaveformPlaylistComponent } from '@waveform-playlist/browser';

<WaveformPlaylistComponent
  tracks={tracks}
  samplesPerPixel={1024}
/>
```

### Example Components

- `flexible-example-app.tsx` - Complete custom layout with styled components
- `stem-tracks-app.tsx` - Simplified example using WaveformPlaylistComponent
- `DefaultPlaylistControls.tsx` - Reference implementation showing hook usage
- `CustomControlsExample.tsx` - Fully styled custom player with progress bar

### Documentation

- `packages/browser/HOOKS_ARCHITECTURE.md` - Hooks architecture overview
- `packages/browser/src/hooks/README.md` - Hooks API documentation
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
