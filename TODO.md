# TODO & Roadmap

Multi-track audio editor roadmap for waveform-playlist.

**Branch:** `tonejs-overhaul` (React migration)
**Last Updated:** 2025-11-22

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

## ✂️ Phase 3: Advanced Editing Features

**Goal:** Implement professional Audacity-style clip editing

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

### 3.3 Splitting Clips

**User Story:** As a user, I want to click a clip and press 'S' to split it at the playhead position.

#### Tasks

- [ ] **Implement split logic**
  - Location: `packages/browser/src/hooks/useClipSplitting.ts`
  - Find clip under playhead/cursor
  - Create two new clips:
    - Clip A: `startTime` to split point
    - Clip B: split point to `startTime + duration`
  - Adjust `offset` and `duration` for each
  - Replace original clip with two new clips

- [ ] **Keyboard shortcut**
  - Location: `packages/browser/src/hooks/useKeyboardShortcuts.ts`
  - 'S' key to split at playhead
  - 'Shift+S' to split at selection boundaries
  - Prevent default browser behavior

- [ ] **Visual feedback**
  - Show scissors cursor when hovering over clip
  - Flash split indicator at cursor position
  - Animate new clips fading in

- [ ] **Example: Splitting demo**
  - Location: Update `draggable-clips-app.tsx`
  - Instructions: "Click clip and press S to split"
  - Show playhead position indicator

**Files to Create:**
- `packages/browser/src/hooks/useClipSplitting.ts`
- `packages/browser/src/hooks/useKeyboardShortcuts.ts`

**Files to Modify:**
- `packages/browser/src/draggable-clips-app.tsx`

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

- [ ] Crossfades between overlapping clips
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

## ✅ Recently Completed

### 2025-11-22

- [x] **Phase 3.1b: Clip Boundaries & Drag to Trim - COMPLETE!** 🎉
  - Created ClipBoundary component with 8px hit area and col-resize cursor
  - Integrated into Clip component with separate draggable instances for left/right edges
  - Implemented bidirectional trimming (left boundary: adjust offset, duration, startTime; right: adjust duration only)
  - Full constraint enforcement: min duration 0.1s, buffer bounds, no overlaps, no negative values
  - **Critical bug fix:** Cumulative delta issue resolved by storing original clip state on drag start
  - Real-time visual feedback during drag with onDragMove handler
  - **Created `useClipDragHandlers` hook** - Reusable 300+ line hook for all drag operations
  - Hook handles: clip movement, boundary trimming, collision detection, real-time updates
  - Clean API exported from browser package for user applications
  - Both multi-clip and flexible-example demos updated to use hook
  - Zero code duplication - complex drag logic centralized in one place
  - Location: `packages/browser/src/hooks/useClipDragHandlers.ts`
  - Fully working boundary trimming with smooth cursor following!

### 2025-11-21

- [x] **Phase 2: Clip-Based Model - COMPLETE!** 🎉
  - All clip-based types already implemented in `packages/core/src/types/clip.ts`
  - WaveformPlaylistContext accepts `ClipTrack[]` and generates peaks per clip
  - Waveform component renders multiple clips per track with gaps
  - ToneTrack playback engine schedules clips with proper timing
  - Multi-clip demo working perfectly (4 tracks, multiple clips, gaps)
  - File-reference loading pattern documented
  - Foundation ready for Phase 3 (drag, trim, split, copy/paste)

- [x] **Tree-shake Tone.js imports** - Bundle optimization (Phase 1.5 complete!)
  - Changed to named imports in playout package
  - Effects hooks import Tone.js directly (Analyser, Reverb, AutoWah)
  - Removed ToneLib parameter from effects functions
  - **Result:** 111KB/23KB savings (13% reduction)
  - Bundle sizes: 507KB/132KB (core), 509KB/150KB (stem-tracks)

- [x] **Multi-clip demo file-reference architecture**
  - Separated `audioFiles` (id + src) from `trackConfigs` (clips with fileId references)
  - Two-phase loading: load files once → create tracks with clip references
  - Benefits: Each file loaded once, clips can reference same file, efficient memory
  - All 4 tracks render correctly with gaps: Vocals (2 clips), Guitar (continuous), Piano (2 clips), Bass (3 clips)
  - Location: `packages/browser/src/multi-clip-app.tsx`

- [x] **Recording example UI polish**
  - Moved Features list and Note from React to Jekyll template
  - Bootstrap alert styling (alert-info, alert-warning)
  - Reduced bundle size by removing static content from JS
  - Location: `ghpages/_examples/17recording.html`, `recording-app.tsx`

- [x] **Documentation updates**
  - Added multi-clip architecture to PROJECT_STRUCTURE.md
  - Added Bootstrap styling convention to PROJECT_STRUCTURE.md
  - Added session notes to CLAUDE.md
  - Updated TODO.md to reflect Phase 2 completion
- [x] Bundle analyzer added (rollup-plugin-visualizer)
- [x] VU meter fix (AnalyserNode single source of truth)
- [x] Worklet RMS calculation removed
- [x] Worklet copy automated in build script
- [x] Debug logs cleanup
- [x] TypeScript errors fixed (WaveformTrack type)
- [x] No gain boost needed for VU meter
- [x] DEBUGGING.md updated with VU meter solution
- [x] CLAUDE.md updated with architectural notes
- [x] TODO.md replaced with multi-track editing roadmap

### 2025-11-20

- [x] Recording example migrated to provider pattern
- [x] Independent AudioContext for recording
- [x] WaveformTrack.src supports AudioBuffer and string URLs
- [x] Live waveform visualization during recording
- [x] Recording peaks match final format (Int16Array)
- [x] GPU-accelerated playhead animation
- [x] Smooth zoom performance fixes
- [x] Automatic scroll proportional adjustment
- [x] TrackControlsWithDelete component
- [x] All examples migrated to provider pattern
- [x] Obsolete code cleanup (WaveformPlaylistComponent, Jekyll includes)

### 2025-11-19

- [x] Selection time inputs (React components)
- [x] Time formatting utilities
- [x] Fixed click clearing selection bug
- [x] Fixed playback beyond selection bug
- [x] Flexible/headless API architecture
- [x] Complete theming system
- [x] Custom timestamp rendering
- [x] Annotations as optional package
- [x] useAnnotationControls hook
- [x] Audio effects hooks (reverb, auto-wah, analyser)
- [x] Continuous Play toggle fix with context splitting
- [x] AudioPosition component styling (text-only)
- [x] CLAUDE.md created
- [x] PROJECT_STRUCTURE.md created
- [x] UI library decision documented (no full UI lib)

---

## 🗺️ Roadmap Timeline

**Estimated Milestones:**

1. ~~**Phase 1.5: Bundle Optimization**~~ ✅ COMPLETE (2025-11-21)
   - Tree-shook Tone.js imports → 23KB gzipped savings

2. ~~**Phase 2: Clip-Based Model**~~ ✅ COMPLETE (2025-11-21)
   - Types, context, rendering, playback all implemented
   - Multi-clip demo working with file-reference pattern

3. **Phase 3.1-3.2: Drag & Trim** - Core editing operations (NEXT)
4. **Phase 3.3-3.4: Split & Copy/Paste** - Power user features
5. **Phase 4: Performance** - Scale to professional use cases
6. **Phase 5: Polish** - Production-ready UX

**Next Immediate Steps (Phase 3.3 - Splitting Clips):**

Phase 3.1a (Drag to Move) and 3.1b (Drag to Trim) are both COMPLETE! ✅

The library now has professional clip editing with:
- ✅ Drag clip headers to reposition clips on timeline
- ✅ Drag clip boundaries to trim (adjust cue in/out)
- ✅ Real-time collision detection (no overlaps, no negative positions)
- ✅ Reusable `useClipDragHandlers` hook for user applications
- ✅ Smooth real-time visual feedback during all drag operations

**Ready for Phase 3.3:**

1. Implement split logic (split clip at playhead/cursor position)
2. Create useClipSplitting hook
3. Add keyboard shortcut ('S' key)
4. Visual feedback (scissors cursor, split indicator)
5. Update multi-clip demo with split functionality

---

**Notes:**

- Break down each phase into smaller PRs for easier review
- Write tests for core functionality (clip positioning, playback scheduling)
- Update documentation as features are implemented
- Get user feedback early and often
- Consider performance from the start (don't optimize prematurely, but design for scale)

