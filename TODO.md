# TODO & Roadmap

Multi-track audio editor roadmap for waveform-playlist.

**Branch:** `tonejs-overhaul` (React migration)
**Last Updated:** 2025-11-25

---

## 🎉 Recently Completed

### 2025-11-25: Annotation Keyboard Navigation & Playback
- ✅ Arrow keys (↑↓←→) to navigate between annotations
- ✅ Home/End keys to jump to first/last annotation
- ✅ Escape key to deselect annotation
- ✅ Enter key to play selected annotation (respects continuous play setting)
- ✅ Auto-scroll waveform to keep selected annotation visible during keyboard navigation
- ✅ Enhanced `useAnnotationKeyboardControls` hook with scroll and playback support
- ✅ Updated annotations example documentation with all keyboard shortcuts

### 2025-11-25: Website Build Fix & Add Annotation at Playhead
- ✅ Fixed Docusaurus SSG build failures caused by browser API access at import time
- ✅ Created `createLazyExample` HOC using `React.lazy()` + `BrowserOnly` for SSR-safe dynamic imports
- ✅ Updated all 10 example pages to use lazy loading pattern
- ✅ Added `pnpm website` and `pnpm website:build` commands to root package.json
- ✅ Removed deprecated Jekyll commands from package.json
- ✅ "Add Annotation" button in annotations example
- ✅ Keyboard shortcut: 'A' key to create annotation at playhead
- ✅ Smart span: new annotation extends to next annotation or end of track
- ✅ Validation: prevents creation inside existing annotations or with insufficient space
- ✅ Marked effects library integration as complete (20 effects already implemented)

### 2025-11-24: Fades API Simplification & Example
- ✅ Simplified Fade API from confusing `{start, end, type}` to simple `{duration, type?}`
- ✅ Created new inline fade utilities replacing 10-year-old `fade-maker` package
- ✅ Removed `fade-maker` dependency from playout package
- ✅ Fixed fade scheduling bug: fades now scheduled at play() time, not constructor
- ✅ New Fades Example page with 4 individual mini players (Linear, Logarithmic, Exponential, S-Curve)
- ✅ Each player demonstrates same 5.85s vocal clip with 1.5s fades for easy comparison
- ✅ Created comprehensive fades documentation guide
- ✅ Updated all fade-related code across packages (core types, ToneTrack, useExportWav, useAudioTracks)

### 2025-11-24: Export with Effects & Dynamic Effects Fixes
- ✅ WAV export with master + per-track effects via Tone.Offline
- ✅ Fixed stale closure issues in `useDynamicEffects` and `useTrackDynamicEffects`
- ✅ Fixed bypass toggle to restore original wet value (not always 1)
- ✅ Bypassed effects excluded from export

### 2025-11-24: Docusaurus Examples & UI Polish
- ✅ Migrated all 8 examples to Docusaurus-native React components
- ✅ BBC Waveform Data example with progressive loading (44KB peaks vs 1.9MB audio)
- ✅ Annotation keyboard controls (`[` `]` for boundaries) and smaller resize handles
- ✅ Fixed @dnd-kit context issue for annotation dragging
- ✅ Master volume API: 0-100 → 0-1.0 (Web Audio standard)
- ✅ Fixed Tone.js init: `await Tone.start()` before `Tone.now()`
- ✅ MicrophoneSelector dark mode fix
- ✅ Radix Themes integration for Recording/FlexibleApi examples

---

## 🎯 Vision

Transform waveform-playlist into a professional multi-track audio editor with:
- **Track shifting in time** - Move entire tracks forward/backward on timeline
- **Clip-based editing** - Multiple audio clips per track (not just one audio file per track)
- **Dragging** - Drag clips horizontally to reposition in time
- **Trimming** - Adjust clip start/end points with drag handles
- **Copy/Paste** - Duplicate clips across tracks and timeline positions
- **Splitting** - Cut clips at playhead or selection boundaries
- **Professional performance** - Smooth 60fps with 8-12+ tracks

**Target Users:**
- Podcast editors working with multiple speakers
- Music producers with stem tracks (drums, bass, vocals, etc.)
- Audio engineers assembling takes from multiple recordings
- Anyone who needs more than simple append-only playback

---

## 🏗️ Architectural Decisions

### Hybrid Canvas + DOM (Industry Standard)

**Decision:** Use Canvas for rendering + DOM for interactions (like Ableton Live, Logic Pro)

**Why NOT use canvas libraries (Konva, Fabric.js, PixiJS):**
- Bundle size: 200-500KB vs our current ~1.5MB library
- Unnecessary abstraction for waveform rendering (we already have optimized canvas code)
- Performance overhead for scene graph management
- Don't need general-purpose graphics features

**Hybrid Approach Benefits:**
- ✅ Canvas excels at rendering waveforms (thousands of pixels, 60fps)
- ✅ DOM/React excels at interactions (buttons, drag handles, context menus)
- ✅ Best performance for our specific use case
- ✅ Familiar React patterns for developers
- ✅ Small bundle size (~13KB for @dnd-kit vs 200-500KB for canvas libs)

**Technology Stack:**
- **Rendering:** Canvas API (existing optimized waveform code)
- **Interactions:** @dnd-kit (13KB gzipped) - Modern React drag-and-drop
- **State Management:** React Context + useReducer for undo/redo
- **Performance:** Virtual scrolling (horizontal + vertical), RAF batching

**References:**
- Ableton Live uses hybrid approach (canvas rendering, native UI interactions)
- Logic Pro uses similar pattern
- Chrome DevTools Performance panel (canvas graphs, DOM controls)

---

## 📊 Phase 1: Foundation (Complete) ✅

**Status:** All core features implemented and working

### Completed Features

- [x] WaveformPlaylistProvider with React Context
- [x] Primitive control components (Play, Pause, Stop, Zoom, etc.)
- [x] Track controls (Mute, Solo, Volume, Pan)
- [x] Waveform rendering with Canvas
- [x] Playback with Tone.js
- [x] Selection and seeking
- [x] Time formatting and display
- [x] Automatic scrolling
- [x] Recording with AudioWorklet
- [x] VU meter with AnalyserNode
- [x] Live waveform during recording
- [x] Annotations package (optional)
- [x] Audio effects hooks (reverb, auto-wah, analyser)
- [x] Theming system
- [x] GPU-accelerated playhead animation
- [x] Smooth zoom performance
- [x] Performance optimizations (60fps playback)

### Architecture Established

- [x] Monorepo with pnpm workspaces
- [x] Package structure (@waveform-playlist/*)
- [x] Build system with Vite
- [x] TypeScript throughout
- [x] styled-components for styling
- [x] Jekyll site for examples
- [x] Chrome DevTools MCP for testing

**Current Bundle Sizes (After Tree-Shaking):**
- Core library: 507KB uncompressed / **132KB gzipped** ✅
- Stem-tracks bundle: 509KB / **150KB gzipped**
- Effects bundle: 530KB / **154KB gzipped** (includes Analyser, Reverb, AutoWah)
- Recording bundle: 524KB / **154KB gzipped**

**Optimization Results:**
- Reduced from 620KB/172KB to 509KB/150KB gzipped (13% reduction)
- Removed unused Tone.js synthesizers and effects
- Tree-shaking working correctly with named imports

---

## 📦 Phase 2: Clip-Based Model (COMPLETE) ✅

**Goal:** Transition from track-based to clip-based data model

**Status:** All tasks completed! The library now fully supports multiple clips per track with proper rendering, playback, and demo.

### Current Model (Track-Based)

```typescript
interface WaveformTrack {
  src: string | AudioBuffer;
  name?: string;
  effects?: TrackEffectsFunction;
}
```

**Limitation:** Each track has exactly one audio source from start to finish.

### New Model (Clip-Based)

**Core Data Types** (already implemented in `packages/core/src/types/clip.ts`):

```typescript
interface AudioClip {
  id: string;
  audioBuffer: AudioBuffer;  // Decoded audio data
  startTime: number;         // Position on timeline (seconds)
  duration: number;          // Clip duration (seconds)
  offset: number;            // Start position within audio file (trim start)
  fadeIn?: Fade;
  fadeOut?: Fade;
  gain: number;
  name?: string;
  color?: string;
}

interface ClipTrack {
  id: string;
  name: string;
  clips: AudioClip[];        // Multiple clips per track
  muted: boolean;
  soloed: boolean;
  volume: number;
  pan: number;
  color?: string;
  height?: number;
  effects?: TrackEffectsFunction;
}

interface Timeline {
  tracks: ClipTrack[];
  duration: number;          // Total timeline duration
  sampleRate: number;
  name?: string;
  tempo?: number;
  timeSignature?: { numerator: number; denominator: number };
}
```

**File-Reference Loading Pattern** (application-level optimization):

When loading audio files, use a file-reference pattern to avoid duplicate fetches:

```typescript
// 1. Define source files with unique IDs
const audioFiles = [
  { id: 'vocals', src: 'media/audio/Vocals30.mp3' },
  { id: 'guitar', src: 'media/audio/Guitar30.mp3' },
];

// 2. Load each file once, store in Map
const fileBuffers = new Map<string, AudioBuffer>();
for (const file of audioFiles) {
  const response = await fetch(file.src);
  const buffer = await audioContext.decodeAudioData(await response.arrayBuffer());
  fileBuffers.set(file.id, buffer);
}

// 3. Create clips by referencing loaded buffers
const clip1 = createClip({
  audioBuffer: fileBuffers.get('vocals')!,
  startTime: 0,
  duration: 10,
  offset: 0,
});

const clip2 = createClip({
  audioBuffer: fileBuffers.get('vocals')!, // Same buffer, different clip
  startTime: 20,
  duration: 10,
  offset: 20,
});
```

See `multi-clip-app.tsx` for complete implementation example.

**Benefits:**
- ✅ Multiple audio clips per track
- ✅ Clips can be positioned anywhere on timeline
- ✅ Clips can overlap (crossfade support)
- ✅ Each clip has independent trim points
- ✅ Gaps between clips are silent (expected behavior)
- ✅ File-reference pattern prevents duplicate loading
- ✅ Multiple clips can share the same source file

### Tasks

- [x] **Define clip-based TypeScript interfaces** ✅
  - Location: `packages/core/src/types/clip.ts`
  - AudioClip, ClipTrack, Timeline interfaces
  - Factory functions: `createClip()`, `createTrack()`, `createTimeline()`
  - Utility functions: `getClipsInRange()`, `getClipsAtTime()`, `sortClipsByTime()`, `findGaps()`
  - Used in multi-clip demo (`multi-clip-app.tsx`)

- [x] **Update WaveformPlaylistContext for clips** ✅
  - Location: `packages/browser/src/WaveformPlaylistContext.tsx`
  - Accepts `tracks: ClipTrack[]` (line 195)
  - Generates `ClipPeaks[]` per track with clip timing info
  - Handles clip positioning in ToneTrack scheduling (lines 361-383)

- [x] **Clip rendering on Canvas** ✅
  - Location: `packages/browser/src/components/Waveform.tsx`
  - Maps over `trackClipPeaks` to render multiple clips per track (line 373)
  - Gaps between clips show as empty space (silence)
  - Each clip rendered with Clip component and unique key

- [x] **Playback engine for clips** ✅
  - Location: `packages/browser/src/WaveformPlaylistContext.tsx`
  - Creates ToneTrack with all clips converted to ClipInfo format (line 379)
  - Schedules clips with proper `startTime` and `offset` (line 383)
  - ToneTrack handles gaps automatically (silent regions between clips)

- [x] **Example: Multi-clip demo** ✅
  - Location: `packages/browser/src/multi-clip-app.tsx`
  - 4 tracks with multiple clips each (Vocals: 2 clips, Guitar: 1 clip, Piano: 2 clips, Bass: 3 clips)
  - Demonstrates file-reference loading pattern
  - Shows gaps between clips correctly
  - Working demo at `ghpages/_examples/18multi-clip.html`

**Files to Create:**
- ~~`packages/core/src/types/clip.ts`~~ ✅ Already exists!
- `packages/browser/src/clips-app.tsx` (or use existing `multi-clip-app.tsx` as foundation)
- ~~`ghpages/_examples/17clips.html`~~ ✅ Already exists as `18multi-clip.html`

**Files to Modify:**
- `packages/browser/src/WaveformPlaylistContext.tsx`
- `packages/ui-components/src/components/Channel.tsx`
- `packages/playout/src/Playout.ts`

---

## 🚀 Pre Launch - Alpha Release Preparation

**Goal:** Essential features and improvements needed before alpha release

**Priority Order:** Tasks organized by implementation sequence

### Phase 1: Core Features (Must Have)

These features expand core functionality and should be implemented first.

- [x] **Track/project export (WAV)** ✅
  - Render multi-track timeline to single audio file (master mix)
  - Toggle to include/exclude audio effects in export
  - WAV format (lossless)
  - Offline rendering using Tone.Offline (OfflineAudioContext)
  - Progress callback during export
  - Download as WAV file
  - Bypassed effects excluded from export
  - **Location:** `packages/browser/src/hooks/useExportWav.ts`

- [x] **Add fades to one of the examples** ✅
  - Created dedicated Fades Example page with 4 mini players
  - Each player demonstrates a different fade curve type (Linear, Logarithmic, Exponential, S-Curve)
  - Same audio clip with 1.5s fades for easy comparison
  - Simplified Fade API: `{duration, type?}` instead of `{start, end, type}`
  - Created comprehensive documentation guide
  - **Location:** `website/src/components/examples/FadesExample.tsx`, `website/docs/guides/fades.md`

- [x] **Add new annotation support in annotations example** ✅
  - ✅ "Add Annotation" button creates annotation at current playhead position
  - ✅ Keyboard shortcut: 'A' key to add annotation
  - ✅ New annotation spans from playhead to next annotation (or end of track)
  - ✅ Default placeholder text ("New annotation")
  - ✅ Prevents creation inside existing annotations or if not enough space
  - **Location:** `website/src/components/examples/AnnotationsExample.tsx`

- [ ] **Custom playhead component support**
  - Allow users to provide their own playhead component via prop
  - Showcase in flexible-api example with polished design
  - Default playhead: simple vertical line
  - Custom playhead example: line with triangle/arrow on top
  - Pass current position and styling props to custom component

- [x] **Add waveform-data.js support** ✅
  - Integrate https://codeberg.org/chrisn/waveform-data.js
  - BBC's standard format for storing/retrieving waveform data
  - Benefits: Interoperability with other audio tools, efficient storage, industry standard
  - Support both input (load existing waveform-data) and output (export peaks in this format)
  - **Completed:** Created waveformDataLoader utilities, demo app, and documentation

- [x] **Integrated multi-track recording (Audacity-style)** ✅
  - ✅ Add hook to create new tracks - Implemented in `recording-app.tsx` with `handleAddTrack`
  - ✅ Record directly into selected track - `useIntegratedRecording` hook handles this
  - ✅ Recording position options: Start at max(cursor position, last clip end) - Implemented in `stopRecording`
  - ✅ Progressive waveform rendering - Live `recordingPeaks` update during recording
  - ✅ New clip automatically added to selected track on recording stop - Automatic clip creation in `stopRecording`
  - ✅ Recording-optimized audio constraints (echo cancellation off, low latency)
  - ✅ Auto-select first microphone device after permission granted
  - **Location:** `recording-app.tsx`, `useIntegratedRecording.ts`, `useMicrophoneAccess.ts`, `MicrophoneSelector.tsx`
  - **Demo:** `ghpages/_examples/17recording.html`

- [x] **Complete Tone.js effects library integration** ✅
  - ✅ 20 effects implemented: Reverb, Freeverb, JC Reverb, Feedback Delay, Ping Pong Delay, Chorus, Phaser, Tremolo, Vibrato, Auto Panner, Auto Filter, Auto Wah, 3-Band EQ, Distortion, Bit Crusher, Chebyshev, Compressor, Limiter, Gate, Stereo Widener
  - ✅ UI components: EffectRack, EffectPanel, EffectSelector, TrackEffectControls
  - ✅ Runtime parameter modification via `useDynamicEffects` and `useTrackDynamicEffects` hooks
  - ✅ Effect bypass with wet parameter preservation
  - ✅ WAV export includes effects via Tone.Offline
  - ✅ Comprehensive documentation at `website/docs/effects.md`
  - **Location:** `packages/browser/src/effects/`, `packages/browser/src/hooks/useDynamicEffects.ts`
  - **Nice to have (not blocking):** Effect presets/save-load, custom knob UI components

### Phase 2: Developer Experience (Should Have)

Foundation for users to get started and understand the library.

- [ ] **Comprehensive README**
  - Quick start guide (5 minute setup)
  - Installation instructions
  - Basic usage examples
  - Link to full documentation
  - Screenshots/GIFs of key features

- [ ] **TypeScript types validation**
  - Ensure all public APIs are properly typed
  - No `any` types in public interfaces
  - Generate .d.ts files correctly
  - Test type inference works for consumers

- [ ] **Add Storybook for component demos**
  - Setup Storybook for ui-components package
  - Interactive component playground
  - Document all props and usage patterns
  - Examples for each component (Waveform, Track, Clip, Controls, etc.)

### Phase 3: Documentation Site (Should Have)

Professional documentation infrastructure.

- [ ] **Migrate to Docusaurus**
  - Replace Jekyll site with https://docusaurus.io/
  - Modern React-based documentation framework
  - Better navigation, search, and versioning
  - Migrate existing examples to Docusaurus pages
  - Add comprehensive documentation (getting started, API reference, guides)

### Phase 4: Publishing Infrastructure (Must Have Before Release)

Infrastructure needed to actually publish the alpha.

#### Testing & Quality Assurance

- [ ] **Unit tests for core functionality**
  - Test hooks (useRecording, usePlaybackControls, useClipDragHandlers, etc.)
  - Test components (Waveform, Track, Clip, Controls)
  - Test audio processing (effects, playback, recording)
  - Setup testing framework (Vitest, React Testing Library)

- [ ] **E2E tests for key workflows**
  - Drag clips to move
  - Trim clip boundaries
  - Split clips at playhead
  - Record new clips
  - Playback with multiple clips
  - Setup E2E framework (Playwright or Cypress)

- [ ] **Browser compatibility testing**
  - Chrome (latest + 2 previous versions)
  - Firefox (latest + 2 previous versions)
  - Safari (latest + 2 previous versions)
  - Edge (latest version)
  - Document any browser-specific issues/workarounds

#### Publishing & Distribution

- [ ] **NPM publishing setup**
  - Configure publish scripts for all packages
  - Setup package.json files correctly (exports, types, etc.)
  - Verify tree-shaking works for consumers
  - Test installation in clean project

- [ ] **Versioning strategy**
  - Adopt semantic versioning (semver)
  - Setup changelog automation (conventional commits)
  - Create release process documentation

- [ ] **CI/CD pipeline**
  - Automated builds on push
  - Run tests on all PRs
  - Automated publishing on version tags
  - Setup GitHub Actions or similar

#### Developer Experience

- [ ] **Migration guide**
  - Document breaking changes from old version
  - Provide code examples for common migration scenarios
  - List deprecated features and alternatives

- [ ] **Contributing guidelines**
  - Setup instructions for contributors
  - Code style guide
  - PR process
  - How to run tests locally

#### Performance Validation

- [ ] **Bundle size verification**
  - Verify tree-shaking still working (named imports only pull what's needed)
  - Core library stays under 150KB gzipped
  - Document bundle sizes for each package
  - Setup bundle size monitoring (bundlephobia, size-limit)

- [ ] **Performance benchmarks**
  - 60fps playback with 8-12 tracks
  - Load time for 2+ hour timelines
  - Memory usage during long editing sessions
  - Document performance targets and measurements

- [ ] **Memory leak testing**
  - Test for leaks during recording
  - Test for leaks during long playback sessions
  - Test proper cleanup on component unmount
  - Use Chrome DevTools memory profiler

---

## ✂️ Phase 3: Advanced Editing Features (Deferred)

**Goal:** Implement professional Audacity-style clip editing

**Status:** Core features complete (drag, trim, split), remaining features deferred until after alpha launch

### Architecture: Audacity-Style Direct Manipulation

**UX Pattern:** Visual clips on the waveform have interactive regions for different operations:
- **Clip header** (title bar) - Drag to move entire clip along timeline
- **Clip boundaries** (left/right edges) - Drag to trim (adjust cue in/out)
- **Clip body** - Click to select, double-click to edit properties

**NOT** a separate drag list - all interactions happen directly on the waveform visualization.

### 3.1a Clip Headers & Drag to Move (Audacity-style)

**User Story:** As a user, I want to drag a clip's header to reposition it in time on the timeline.

#### Tasks

- [x] **Install @dnd-kit** ✅
  - `@dnd-kit/core` and `@dnd-kit/utilities` installed
  - Size: 13KB gzipped
  - Modern, accessible, performant

- [x] **Create ClipHeader component** ✅
  - Location: `packages/ui-components/src/components/ClipHeader.tsx`
  - Renders at top of each Clip component
  - Shows track name
  - Height: 22px (CLIP_HEADER_HEIGHT constant)
  - Background: Semi-transparent overlay with customizable colors
  - Uses drag handle pattern (receives listeners as props)
  - Cursor: `grab` on hover, `grabbing` when dragging

- [x] **Integrate ClipHeader into Clip component** ✅
  - Location: `packages/ui-components/src/components/Clip.tsx`
  - Clip uses `useDraggable` hook
  - ClipHeader receives drag handle props (activator pattern)
  - Pass clip metadata (name, id, index)
  - Proper pointer-events handling

- [x] **Implement drag-to-move logic** ✅
  - Location: `packages/browser/src/multi-clip-app.tsx`
  - Handle DragEndEvent from @dnd-kit
  - Convert pixel delta to time shift
  - Update clip's startTime
  - Prevent negative startTime
  - Uses restrictToHorizontalAxis modifier

- [x] **Update multi-clip demo** ✅
  - Location: `packages/browser/src/multi-clip-app.tsx`
  - DndContext wraps Waveform component
  - Instructions: "Drag clip headers to move clips along timeline"
  - Show clip headers on all clips

- [x] **Implement real-time collision detection (Audacity-style)** ✅
  - Constraints:
    - Clip startTime cannot be negative (>= 0)
    - Clip startTime cannot be before previous clip's endTime (startTime >= prevClip.endTime)
    - Clip endTime cannot be after next clip's startTime (endTime <= nextClip.startTime)
    - Clips can be adjacent (touching) but not overlapping
  - Implementation:
    - Custom modifier function applied during drag (real-time feedback)
    - Also applied in handleDragEnd for final position validation
  - Location: `packages/browser/src/multi-clip-app.tsx` and `flexible-example-app.tsx`
  - Behavior: Drag preview is constrained in real-time, cannot overlap clips or go before time 0
  - User experience matches Audacity - immediate boundary feedback while dragging

**Files to Create:**
- `packages/ui-components/src/components/ClipHeader.tsx`

**Files to Modify:**
- `packages/browser/src/multi-clip-app.tsx` (remove ClipsPanel)
- `packages/ui-components/src/components/Clip.tsx` (integrate ClipHeader)
- `packages/browser/src/WaveformPlaylistContext.tsx` (drag logic)
- `packages/ui-components/src/components/Playlist.tsx` (handle ClickOverlay conflict)

### 3.1b Clip Boundaries & Drag to Trim (Audacity-style) ✅

**User Story:** As a user, I want to drag the left/right edge of a clip to adjust its cue in/out (trim).

**Status:** COMPLETE - All trim functionality implemented with real-time visual feedback!

#### Tasks

- [x] **Create ClipBoundary component** ✅
  - Location: `packages/ui-components/src/components/ClipBoundary.tsx`
  - Renders at left and right edges of clip
  - Width: 8px hit area (CLIP_BOUNDARY_WIDTH constant)
  - Visual feedback: Semi-transparent background and border on hover/drag
  - Cursor: `col-resize`
  - Uses `useDraggable` from @dnd-kit with drag handle pattern

- [x] **Integrate ClipBoundary into Clip component** ✅
  - Location: `packages/ui-components/src/components/Clip.tsx`
  - Renders left and right boundaries for each clip
  - Positioned absolutely at clip edges
  - Each boundary has its own draggable instance
  - Uses activator pattern for drag handles

- [x] **Implement drag-to-trim logic** ✅
  - Location: `packages/browser/src/hooks/useClipDragHandlers.ts`
  - Dragging left boundary:
    - Increases `offset` (trim start of audio)
    - Decreases `duration` by same amount
    - Increases `startTime` (clip moves right on timeline)
  - Dragging right boundary:
    - Increases/decreases `duration` (trim end of audio)
    - `offset` and `startTime` stay the same
  - Constraints enforced:
    - Offset cannot be negative (>= 0)
    - Duration must be at least 0.1 seconds (MIN_DURATION)
    - offset + duration cannot exceed buffer duration
    - Cannot overlap with adjacent clips
    - startTime cannot be negative (>= 0)
  - **Critical fix:** Uses original clip state on drag start, applies cumulative delta to prevent oversensitive behavior

- [x] **Visual feedback during trim** ✅
  - Waveform updates in real-time during drag (onDragMove)
  - Boundary highlights on hover with semi-transparent background
  - Boundary shows solid visual feedback during drag
  - Smooth cursor following (no oversensitive jumping)
  - Collision detection provides immediate boundary feedback

- [x] **Update multi-clip and flexible-example demos** ✅
  - Both demos use `useClipDragHandlers` hook
  - Trim handles work on all clips
  - Both movement and trimming working smoothly

**Files Created:**
- `packages/ui-components/src/components/ClipBoundary.tsx` ✅
- `packages/browser/src/hooks/useClipDragHandlers.ts` ✅ (reusable hook!)

**Files Modified:**
- `packages/ui-components/src/components/Clip.tsx` (integrated ClipBoundary)
- `packages/browser/src/multi-clip-app.tsx` (uses useClipDragHandlers hook)
- `packages/browser/src/flexible-example-app.tsx` (uses useClipDragHandlers hook)
- `packages/browser/src/index.tsx` (exports useClipDragHandlers)
- `packages/browser/src/hooks/index.ts` (exports useClipDragHandlers)

### 3.3 Splitting Clips ✅ COMPLETE

**User Story:** As a user, I want to click a clip and press 'S' to split it at the playhead position.

**Status:** COMPLETE - Pixel-perfect splitting with sample-based architecture!

#### Tasks

- [x] **Implement split logic** ✅
  - Location: `packages/browser/src/hooks/useClipSplitting.ts`
  - **Sample-based architecture:** All calculations use integer samples (not floating-point seconds)
  - Find clip under playhead on selected track
  - Create two new clips:
    - Clip A: Original start → split pixel boundary
    - Clip B: Split pixel boundary → original end
  - Snaps to pixel boundaries to ensure perfect adjacency (no gaps)
  - Adjusts `offsetSamples` and `durationSamples` for each clip
  - Replace original clip with two new clips
  - Returns boolean indicating success/failure

- [x] **Track selection system** ✅
  - Location: `packages/browser/src/WaveformPlaylistContext.tsx`
  - Tracks `selectedTrackId` in playlist state
  - Split only affects the currently selected track
  - Click any clip to select its track
  - Visual feedback shows which track is selected

- [x] **Keyboard shortcut** ✅
  - Location: `packages/browser/src/hooks/useKeyboardShortcuts.ts`
  - 'S' key to split at playhead
  - Flexible shortcut system supporting modifiers (Ctrl, Shift, Meta, Alt)
  - Input field detection (doesn't trigger in text inputs)
  - Prevent default browser behavior

- [x] **Visual feedback for selected track** ✅
  - Location: `packages/ui-components/src/components/Track.tsx`
  - Selected track shows blue border: `box-shadow: inset 0 0 0 2px rgba(0, 123, 255, 0.5)`
  - Clear indication of which track will be split
  - Selection persists across drag operations

- [x] **Sample-based architecture refactor** ✅
  - **Core types** (`packages/core/src/types/clip.ts`):
    - Changed `AudioClip` from time-based to sample-based properties
    - `startSample`, `durationSamples`, `offsetSamples` (all integers)
    - Added `createClipFromSeconds()` for backwards compatibility
  - **Rendering** (`packages/ui-components/src/components/Clip.tsx`):
    - Fixed width calculation: `width = endPixel - startPixel`
    - Ensures clips share exact pixel boundaries (no gaps)
  - **Benefits:**
    - Eliminates floating-point precision errors
    - Perfect pixel alignment for all clip operations
    - No 1-pixel gaps between split clips

- [x] **Example: Multi-clip demo** ✅
  - Location: `packages/browser/src/multi-clip-app.tsx`
  - Instructions added to HTML template
  - Click clip to select track, press 'S' to split
  - Verified: No pixel gaps after splitting

**Files Created:**
- `packages/browser/src/hooks/useClipSplitting.ts` ✅
- `packages/browser/src/hooks/useKeyboardShortcuts.ts` ✅

**Files Modified:**
- `packages/core/src/types/clip.ts` (sample-based architecture) ✅
- `packages/ui-components/src/components/Clip.tsx` (pixel-perfect width calculation) ✅
- `packages/ui-components/src/components/Track.tsx` (selection visual feedback) ✅
- `packages/browser/src/components/Waveform.tsx` (pass isSelected prop) ✅
- `packages/browser/src/WaveformPlaylistContext.tsx` (track selection, sample-based ClipPeaks) ✅
- `packages/browser/src/multi-clip-app.tsx` ✅
- `packages/browser/src/hooks/index.ts` (exports new hooks) ✅
- `packages/browser/src/index.tsx` (exports new hooks) ✅
- `ghpages/_examples/18multi-clip.html` (instructions) ✅

### 3.4 Copy/Paste Clips

**User Story:** As a user, I want to select a clip, press Cmd+C to copy, then Cmd+V to paste at playhead position.

#### Tasks

- [ ] **Implement clipboard logic**
  - Location: `packages/browser/src/hooks/useClipboardOperations.ts`
  - Copy: Store clip data in context state (not system clipboard)
  - Cut: Copy + delete original clip
  - Paste: Create new clip at playhead position
  - Support multiple clips (array)

- [ ] **Selection model**
  - Location: `packages/browser/src/hooks/useClipSelection.ts`
  - Click to select clip (highlight border)
  - Cmd+Click to multi-select
  - Shift+Click to select range
  - Track selected clip IDs in context

- [ ] **Keyboard shortcuts**
  - Cmd+C / Ctrl+C: Copy selected clips
  - Cmd+X / Ctrl+X: Cut selected clips
  - Cmd+V / Ctrl+V: Paste at playhead
  - Delete/Backspace: Delete selected clips

- [ ] **Visual feedback**
  - Selected clips: Blue border, slight glow
  - Copied clips: Dashed border briefly
  - Paste location: Ghost outline before paste

- [ ] **Example: Copy/paste demo**
  - Location: Update `draggable-clips-app.tsx`
  - Instructions overlay with keyboard shortcuts
  - Show selected clips with border

**Files to Create:**
- `packages/browser/src/hooks/useClipboardOperations.ts`
- `packages/browser/src/hooks/useClipSelection.ts`

**Files to Modify:**
- `packages/browser/src/hooks/useKeyboardShortcuts.ts`
- `packages/browser/src/draggable-clips-app.tsx`

### 3.5 Multi-Select and Bulk Operations

**User Story:** As a user, I want to select multiple clips and move/delete them together.

#### Tasks

- [ ] **Multi-select gestures**
  - Cmd+Click: Add/remove from selection
  - Shift+Click: Select range between last selected and clicked
  - Drag rectangle: Select all clips within bounds

- [ ] **Bulk drag**
  - Drag any selected clip moves all selected clips together
  - Maintain relative positions
  - Collision detection with other clips

- [ ] **Bulk delete**
  - Delete key removes all selected clips
  - Confirmation dialog for >3 clips (optional)

- [ ] **Selection toolbar**
  - Location: `packages/ui-components/src/components/SelectionToolbar.tsx`
  - Appears above timeline when clips selected
  - Buttons: Delete, Copy, Align Left, Distribute
  - Shows count: "3 clips selected"

**Files to Create:**
- `packages/ui-components/src/components/SelectionToolbar.tsx`

**Files to Modify:**
- `packages/browser/src/hooks/useClipSelection.ts`
- `packages/browser/src/hooks/useClipDragging.ts`

---

## ⚡ Phase 4: Performance & Virtual Scrolling

**Goal:** Support unlimited timeline length and 12+ tracks at 60fps

### 4.1 Horizontal Virtual Scrolling

**Problem:** Canvas width limited to ~32,000px in most browsers. For a 1-hour timeline at 1024 samples/pixel (44100 Hz), we need ~155,000px.

**Solution:** Render only the visible portion of timeline.

#### Tasks

- [ ] **Viewport calculation**
  - Location: `packages/browser/src/hooks/useVirtualTimeline.ts`
  - Calculate visible time range from scroll position
  - Add padding (render 1 screen width on each side)
  - Only render clips within visible + padding range

- [ ] **Canvas stitching**
  - Multiple canvas elements (like old version)
  - Each canvas max 10,000px wide
  - Stitch together as user scrolls
  - Recycle canvases for memory efficiency

- [ ] **Scroll sync**
  - Sync all track canvases together
  - Use transform for sub-pixel smooth scrolling
  - RAF-based scroll handler (60fps)

**Files to Create:**
- `packages/browser/src/hooks/useVirtualTimeline.ts`
- `packages/ui-components/src/components/VirtualCanvas.tsx`

**Files to Modify:**
- `packages/ui-components/src/components/Playlist.tsx`

### 4.2 Vertical Virtual Scrolling

**Problem:** 20+ tracks means rendering 20+ canvas elements even if only 5 visible.

**Solution:** Render only visible tracks.

#### Tasks

- [ ] **Track virtualization**
  - Location: `packages/browser/src/hooks/useVirtualTracks.ts`
  - Calculate which tracks are in viewport
  - Render only visible tracks + 2 above/below
  - Use react-window or custom implementation

- [ ] **Scroll container**
  - Fixed height container with overflow scroll
  - Placeholder divs for total height
  - Absolutely positioned track rows

**Files to Create:**
- `packages/browser/src/hooks/useVirtualTracks.ts`

**Files to Modify:**
- `packages/ui-components/src/components/Playlist.tsx`

### 4.3 RAF Batching

**Goal:** Batch DOM updates to prevent layout thrashing.

#### Tasks

- [ ] **RAF scheduler**
  - Location: `packages/browser/src/utils/rafScheduler.ts`
  - Queue updates during scroll/zoom
  - Flush all updates in single RAF
  - Priority queue (playhead > waveform > controls)

- [ ] **Apply to all animations**
  - Playhead movement
  - Scroll position
  - Zoom level changes
  - Selection updates

**Files to Create:**
- `packages/browser/src/utils/rafScheduler.ts`

**Files to Modify:**
- `packages/browser/src/WaveformPlaylistContext.tsx`

### Performance Targets

- ✅ 60fps playback with 12 tracks
- ✅ Smooth zoom (no audio interruption)
- ✅ Smooth scroll (no jank)
- ✅ Drag operations at 60fps
- ✅ Sub-100ms interaction latency
- ✅ Support 2+ hour timelines
- ✅ Support 20+ tracks

---

## 🎨 Phase 5: Polish & Usability

**Goal:** Professional UX features

### 5.1 Undo/Redo

**User Story:** As a user, I want to undo/redo my edits with Cmd+Z / Cmd+Shift+Z.

#### Tasks

- [ ] **Command pattern implementation**
  - Location: `packages/core/src/commands/`
  - Abstract Command interface
  - Concrete commands: MoveClip, TrimClip, SplitClip, DeleteClip, etc.
  - Each command has execute() and undo()

- [ ] **History manager**
  - Location: `packages/browser/src/hooks/useHistory.ts`
  - Maintain undo/redo stacks
  - Keyboard shortcuts (Cmd+Z, Cmd+Shift+Z)
  - Clear redo stack on new action
  - History limit (e.g., 50 actions)

- [ ] **Integrate with all editing operations**
  - Wrap all clip modifications in commands
  - Batch multiple updates (e.g., multi-select drag = 1 undo)

**Files to Create:**
- `packages/core/src/commands/Command.ts`
- `packages/core/src/commands/MoveClipCommand.ts`
- `packages/core/src/commands/TrimClipCommand.ts`
- `packages/core/src/commands/SplitClipCommand.ts`
- `packages/core/src/commands/DeleteClipCommand.ts`
- `packages/browser/src/hooks/useHistory.ts`

### 5.2 Snap to Grid

**User Story:** As a user, I want clips to snap to beat/bar boundaries when dragging.

#### Tasks

- [ ] **Grid calculation**
  - Location: `packages/browser/src/utils/grid.ts`
  - Support different grid resolutions:
    - Bars (4 beats)
    - Beats (based on BPM)
    - Seconds (1s, 0.5s, 0.1s)
    - Frames (based on sample rate)
  - Snap threshold (e.g., 10px)

- [ ] **Snap toggle**
  - Location: `packages/ui-components/src/components/SnapToggle.tsx`
  - Checkbox: "Snap to Grid"
  - Dropdown: Grid resolution selector
  - Keyboard shortcut: Cmd+G to toggle

- [ ] **Visual grid lines**
  - Draw grid on timeline canvas
  - Different opacity for major/minor divisions
  - Update on zoom

**Files to Create:**
- `packages/browser/src/utils/grid.ts`
- `packages/ui-components/src/components/SnapToggle.tsx`
- `packages/ui-components/src/components/GridOverlay.tsx`

### 5.3 Keyboard Shortcuts

**Goal:** Comprehensive keyboard navigation and shortcuts.

#### Shortcuts

**Playback:**
- Space: Play/Pause
- Enter: Play from start
- Escape: Stop
- Left/Right Arrow: Seek ±1s (or grid unit)
- Shift+Left/Right: Seek ±5s
- Home/End: Jump to start/end

**Editing:**
- S: Split clip at playhead
- D: Duplicate selected clips
- Delete/Backspace: Delete selected clips
- Cmd+C: Copy
- Cmd+X: Cut
- Cmd+V: Paste
- Cmd+Z: Undo
- Cmd+Shift+Z: Redo
- Cmd+A: Select all clips in view

**Zoom:**
- Cmd+Plus: Zoom in
- Cmd+Minus: Zoom out
- Cmd+0: Zoom to fit
- Cmd+Shift+F: Zoom to selection

**Selection:**
- Click: Select clip
- Cmd+Click: Add to selection
- Shift+Click: Select range
- Escape: Clear selection

#### Tasks

- [ ] **Keyboard shortcuts manager**
  - Location: `packages/browser/src/hooks/useKeyboardShortcuts.ts`
  - Map keys to actions
  - Handle modifiers (Cmd, Shift, Alt)
  - Prevent conflicts with browser shortcuts

- [ ] **Shortcuts help overlay**
  - Location: `packages/ui-components/src/components/ShortcutsHelp.tsx`
  - Press '?' to show overlay
  - Categorized list of shortcuts
  - Searchable/filterable

**Files to Create:**
- `packages/ui-components/src/components/ShortcutsHelp.tsx`

**Files to Modify:**
- `packages/browser/src/hooks/useKeyboardShortcuts.ts`

### 5.4 Accessibility

**Goal:** Keyboard-only and screen reader support.

#### Tasks

- [ ] **Keyboard focus management**
  - Tab through clips in timeline order
  - Focus indicators (visible outline)
  - Focus trap in modals/dialogs

- [ ] **Screen reader support**
  - ARIA labels for all clips
  - Announce selection changes
  - Announce playback state
  - Describe timeline structure

- [ ] **High contrast mode**
  - Respect prefers-contrast media query
  - Ensure 4.5:1 contrast ratios
  - Larger click targets (44×44px minimum)

**Files to Modify:**
- All component files (add ARIA attributes)
- `packages/ui-components/src/theme/tokens.ts` (contrast ratios)

### 5.5 Context Menus

**User Story:** As a user, I want to right-click a clip to see editing options.

#### Tasks

- [ ] **Clip context menu**
  - Location: `packages/ui-components/src/components/ClipContextMenu.tsx`
  - Options: Cut, Copy, Delete, Duplicate, Split, Trim to Selection
  - Positioned near cursor
  - Closes on click outside

- [ ] **Track context menu**
  - Options: Add Track, Delete Track, Rename, Duplicate Track
  - Mute/Solo All, Clear All Clips

**Files to Create:**
- `packages/ui-components/src/components/ClipContextMenu.tsx`
- `packages/ui-components/src/components/TrackContextMenu.tsx`

---

## 📦 Bundle Size Goals

**Current:** 720KB uncompressed / **200KB gzipped**

**Target:** 400KB uncompressed / **<100KB gzipped**

### Current Breakdown (Gzipped)

- Core library: **172KB** (includes Tone.js, React, styled-components)
  - Tone.js: ~120KB (can reduce to ~50KB with tree-shaking) ⚡
  - React + ReactDOM: ~30KB
  - Your code: ~22KB
- Recording (optional): ~15KB
- Annotations (optional): ~15KB

**Total Current:** ~200KB gzipped

### After Optimization (Projected)

- Core library: **100KB** (tree-shaked Tone.js + React)
- @dnd-kit: 13KB (for drag/drop in Phase 3)
- Recording (optional): 15KB
- Annotations (optional): 15KB
- Effects (future optional): 10KB
- Undo/Redo: 5KB
- Virtual scrolling: 10KB

**Total Optimized:** ~168KB gzipped

### Optimization Tasks

**High Priority (Phase 1.5 - Before Phase 2):**

- [x] ~~Analyze bundle with rollup-plugin-visualizer~~ ✅ Added to vite.config.ts
- [x] ~~**Tree-shake Tone.js imports**~~ ✅ Completed!
  - Changed from `import * as Tone from 'tone'` to named imports
  - Playout: `Player, Volume, Gain, Panner, getContext, getTransport, getDestination, now, start`
  - Effects: `Analyser, Reverb, AutoWah` (imported directly in effects hooks)
  - Removed ToneLib parameter from effects functions (breaking change)
  - **Actual savings:** 111KB uncompressed / 23KB gzipped (13% reduction)
  - All synthesizers and unused effects removed

**Medium Priority:**

- [ ] Externalize React/ReactDOM for library builds (when used as npm package)
- [ ] Code split effects into optional package
- [ ] Lazy load advanced features (annotations, effects)
- [ ] Minimize styled-components runtime

**Low Priority:**

- [ ] Remove unused standardized-audio-context polyfills
- [ ] Optimize waveform rendering code
- [ ] Use native Intl for date formatting (if moment.js detected)

---

## 🎯 Success Metrics

### Performance

- ✅ 60fps playback with 12 tracks
- ✅ 60fps dragging/scrolling
- ✅ <100ms interaction latency
- ✅ <3s load time on 3G
- ✅ Support 2+ hour timelines
- ✅ Support 20+ tracks with virtual scrolling

### Usability

- ✅ All operations keyboard accessible
- ✅ Screen reader compatible
- ✅ Undo/redo for all destructive actions
- ✅ Context menus for discoverability
- ✅ Keyboard shortcuts help (press '?')

### Developer Experience

- ✅ TypeScript types for all APIs
- ✅ Comprehensive examples
- ✅ Migration guide from v4
- ✅ Storybook component showcase
- ✅ <5 min to get started

---

## 🔮 Future Considerations

### Polish & Nice to Have

- [ ] **Investigate occasional flicker on drop** (Low Priority)
  - Minor visual flicker occurs occasionally when dropping clips
  - Likely a @dnd-kit library limitation
  - Current implementation uses simpler drag handle pattern (no DragOverlay)
  - May need to investigate @dnd-kit configuration or CSS will-change properties
  - Not blocking core functionality

- [ ] **Improve peak rendering during trim** (Low Priority)
  - Waveform peaks adjust/flicker when trimming (especially left boundary drag)
  - Root cause: Peaks are normalized based on visible audio range
  - When trimming changes the visible range, max amplitude changes, causing peaks to rescale
  - Potential solutions:
    1. **File-level normalization** - Normalize all clips from same source file together (most stable)
    2. **Cache original peak heights** - Store peaks at full file level, clip to visible range
    3. **Debounce recalculation** - Only recalculate peaks on drag end (less real-time feedback)
    4. **Absolute peaks** - Don't normalize, show actual amplitude (might be too quiet/loud)
  - Trade-off: Stability vs. optimal peak visibility for each clip
  - Not blocking core functionality, cosmetic issue only

### Advanced Features (Post-Launch)

- [ ] Clip grouping (edit multiple clips as one)
- [ ] Time signatures and tempo changes
- [ ] Automation lanes (volume, pan)
- [ ] Markers and regions
- [ ] Clip colors and labels
- [ ] Waveform color per clip
- [ ] Minimap overview panel
- [ ] Vertical zoom (waveform height)
- [ ] Offline export (render to WAV)

### Integrations

- [ ] MIDI support (sync playback to MIDI clock)
- [ ] Video sync (align audio to video timeline)
- [ ] Cloud storage (save/load projects)
- [ ] Collaboration (real-time editing)
- [ ] Plugin system (user-defined effects/tools)

---

## ✅ Older Completed Work

### 2025-11-23
- Recording UX: auto-select first mic, optimized audio constraints
- waveform-data.js support with BBC pre-computed peaks
- `interactiveClips` prop to separate visual headers from interaction
- Theming system refactor: centralized `WaveformPlaylistTheme` interface
- TypeScript build enforcement (`pnpm typecheck &&` in build scripts)
- Phase 3.3: `useClipSplitting` and `useKeyboardShortcuts` hooks

### 2025-11-22
- Phase 3.1b: Drag-to-trim with `useClipDragHandlers` hook
- Bidirectional boundary trimming with collision detection

### 2025-11-21
- Phase 2: Clip-based model complete
- Tone.js tree-shaking: 23KB gzipped savings
- Multi-clip demo with file-reference loading pattern

### 2025-11-20
- Recording example with live waveform
- GPU-accelerated playhead animation
- All examples migrated to provider pattern

### 2025-11-19
- Flexible/headless API architecture
- Complete theming system
- Annotations as optional package
- Audio effects hooks

---

## 🗺️ Roadmap Timeline

**Estimated Milestones:**

1. ~~**Phase 1.5: Bundle Optimization**~~ ✅ COMPLETE (2025-11-21)
   - Tree-shook Tone.js imports → 23KB gzipped savings

2. ~~**Phase 2: Clip-Based Model**~~ ✅ COMPLETE (2025-11-21)
   - Types, context, rendering, playback all implemented
   - Multi-clip demo working with file-reference pattern

3. ~~**Phase 3.1-3.2: Drag & Trim**~~ ✅ COMPLETE (2025-11-22)
   - Drag clip headers to move clips along timeline
   - Drag clip boundaries to trim (bidirectional)
   - Real-time collision detection and visual feedback
   - Reusable `useClipDragHandlers` hook

4. ~~**Phase 3.3: Splitting Clips**~~ ✅ COMPLETE (2025-11-23)
   - Split clips at playhead with 'S' key
   - `useClipSplitting` and `useKeyboardShortcuts` hooks
   - Visual feedback in progress

5. **Phase 3.4-3.5: Copy/Paste & Multi-Select** - Power user features (NEXT)
6. **Phase 4: Performance** - Scale to professional use cases
7. **Phase 5: Polish** - Production-ready UX

**Next Immediate Steps (Phase 3.4 - Copy/Paste Clips):**

Phase 3.1a (Drag to Move), 3.1b (Drag to Trim), and 3.3 (Splitting) are all COMPLETE! ✅

The library now has professional clip editing with:
- ✅ Drag clip headers to reposition clips on timeline
- ✅ Drag clip boundaries to trim (adjust cue in/out)
- ✅ Split clips at playhead with 'S' key
- ✅ Real-time collision detection (no overlaps, no negative positions)
- ✅ Reusable `useClipDragHandlers` and `useClipSplitting` hooks
- ✅ Flexible `useKeyboardShortcuts` hook for any key combinations
- ✅ Smooth real-time visual feedback during all operations

**Ready for Phase 3.4:**

1. Implement clipboard logic (copy/cut/paste clips)
2. Create `useClipboardOperations` hook
3. Create `useClipSelection` hook for selecting clips
4. Add keyboard shortcuts (Cmd+C, Cmd+X, Cmd+V, Delete)
5. Visual feedback (selected clips, paste preview)
6. Update multi-clip demo with copy/paste functionality

---

**Notes:**

- Break down each phase into smaller PRs for easier review
- Write tests for core functionality (clip positioning, playback scheduling)
- Update documentation as features are implemented
- Get user feedback early and often
- Consider performance from the start (don't optimize prematurely, but design for scale)

