# Claude AI Development Notes

This file contains important context, decisions, and conventions for AI-assisted development on the waveform-playlist project.

## Project Overview

Waveform-playlist is a multitrack Web Audio editor and player with HTML canvas waveform visualizations. Currently undergoing a React refactor (Tone.js overhaul branch).

## Project Roadmap

**Source of Truth:** `TODO.md` contains the complete multi-track editing roadmap.

### Current Phase: Phase 3.3 - Splitting Clips 🚧

**Completed Phases:**
- ✅ **Phase 1: Foundation** - All core features implemented
- ✅ **Phase 1.5: Bundle Optimization** - Tree-shaking complete (23KB savings)
- ✅ **Phase 2: Clip-Based Model** - Multi-clip support fully implemented
- ✅ **Phase 3.1a: Drag to Move** - Clip headers with drag-to-reposition
- ✅ **Phase 3.1b: Drag to Trim** - Clip boundaries with bidirectional trimming

**Bundle Size Results:**
- Core library: 507KB / **132KB gzipped** (from 620KB/172KB)
- Stem-tracks: 509KB / **150KB gzipped**
- Effects: 530KB / **154KB gzipped**
- **Savings:** 111KB uncompressed / 23KB gzipped (13% reduction)

**What was optimized:**
- Changed from `import * as Tone` to named imports
- Removed all unused Tone.js synthesizers
- Effects hooks import only what they need (Analyser, Reverb, AutoWah)
- Removed ToneLib parameter from effects functions (breaking change)

**Recent Achievements (Phase 3.1):**
- Clip headers with drag-to-move functionality
- Clip boundaries with bidirectional trimming (left/right edges)
- Real-time collision detection (Audacity-style)
- Reusable `useClipDragHandlers` hook for drag operations
- Smooth visual feedback during all drag interactions

**Next Phase: Phase 3.3 - Splitting Clips**
- Implement split logic (split clip at playhead/cursor)
- Keyboard shortcuts ('S' key)
- Visual feedback (scissors cursor, split indicator)
- Foundation for copy/paste and multi-select operations

### Tracking Progress

**When completing tasks:**
1. Check off task in TODO.md: `- [x] Task description`
2. Move to "Recently Completed" section with date
3. Update "Current Work" section in this file (CLAUDE.md)
4. Update session notes at bottom of this file

**When planning work:**
1. Review TODO.md roadmap phases
2. Check "Next Immediate Steps" section
3. Consider bundle size goals and performance targets
4. Follow architectural decisions (Hybrid Canvas + DOM, no canvas libraries)

**Important:** Always check TODO.md at the start of significant work sessions to understand current phase and next steps.

## Recent Architectural Decisions

### UI Library Strategy (2025-01-19)

**Decision:** Do NOT add a full UI library (Material-UI, Chakra, etc.) as a peer dependency.

**Reasoning:** Keep bundle size small (~1.5MB), maximize user flexibility, avoid forcing design system on users.

**Approved Approach:**

1. Continue using **styled-components**
2. Use **Radix UI** or **React Aria** selectively for complex components (headless only)
3. Build simple components ourselves
4. Create internal design system with shared theme tokens

### Shared Styled Components (2025-01-19)

**Pattern:** Extract commonly duplicated styled components into shared definitions in `ui-components/styled/`

1. **CheckboxStyles** - `CheckboxWrapper`, `StyledCheckbox`, `CheckboxLabel`
2. **ButtonStyles** - `ControlButton` with variants (primary, success, info)

Benefits: ~60% code reduction, consistent styling, easier maintenance.

## Code Conventions

### React/TypeScript

- Use functional components with hooks
- Props interfaces: `{ComponentName}Props`
- Use `React.FC<Props>` for component types
- Prefer `const` over `let`

### Styled Components

- Use transient props (prefix with `$`) for props that shouldn't pass to DOM
- Example: `$left`, `$width`, `$color`

### Building and Testing

- Build: `pnpm build`
- Jekyll: `jekyll build -s ghpages -d _site`
- Dev server: `http://localhost:4000/waveform-playlist/`
- Always hard refresh (Cmd+Shift+R) after builds

### Jekyll Example Pages Convention

**File naming pattern:** `ghpages/_examples/##name.html`

- **Use numbered prefixes** (e.g., `01minimal.html`, `18multi-clip.html`) to control ordering in Jekyll listings
- **Keep `flexible-api.html` last** by not numbering it
- **Always add `permalink:` attribute** in front matter for clean, permanent URLs:
  ```yaml
  ---
  layout: example
  javascript: multi-clip-bundle.js
  title: Multi-Clip Playback
  permalink: /examples/multi-clip.html
  ---
  ```

**Why:** Numbered filenames control display order, but permalinks provide clean, permanent URLs that won't break if file ordering changes.

## Chrome Remote Debugging

```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-profile \
  --remote-allow-origins='*'
```

## MCP Chrome DevTools Usage

**Known Bug:** PNG screenshots cause media type mismatch. Use JPEG or WebP format.

**Best Practices:**

- Prefer `take_snapshot` (text-based) over `take_screenshot`
- Use JPEG/WebP when screenshots needed
- Use `list_pages` → `select_page` → `take_snapshot`

## Custom Hooks Architecture (2025-01-19)

**Decision:** Extract playlist logic into reusable custom hooks for maximum flexibility.

**Created Hooks:**

- `usePlaybackControls`, `useTimeFormat`, `useZoomControls`, `useAudioPosition`, `useWaveformPlaylist`
- `useMasterAnalyser`, `useTrackReverb`, `useTrackAutoWah`, `useEffectsChain`

**Location:** `packages/browser/src/hooks/`

## Flexible/Headless API Architecture (2025-01-19)

**Pattern:** Provider + Primitive Components

**Key Components:**

- `WaveformPlaylistProvider` - Context provider
- Primitives: `PlayButton`, `PauseButton`, `StopButton`, `ZoomInButton`, `ZoomOutButton`, etc.
- `Waveform` - Visualization with render prop for custom track controls

**Benefits:** Maximum flexibility, controls anywhere in layout, access to state via hooks.

## Theming System (2025-01-19)

All theme properties optional on `Waveform` component:

- `waveOutlineColor`, `waveFillColor`, `waveProgressColor`
- `timeColor`, `timescaleBackgroundColor`, `playheadColor`, `selectionColor`
- `clipHeaderBackgroundColor`, `clipHeaderBorderColor`, `clipHeaderTextColor`
- `renderTimestamp` - Custom React components for timescale timestamps

### Theme vs Props: Design Guidelines (2025-01-22)

**When to add to the `theme` object:**
- Visual/styling properties (colors, backgrounds, borders)
- Properties that users typically want to customize for aesthetic consistency
- Properties that don't affect functionality/behavior
- Examples: `waveOutlineColor`, `playheadColor`, `clipHeaderBackgroundColor`

**When to use separate props:**
- Functional/behavioral properties (callbacks, data, configuration)
- Properties that control what is rendered or how it behaves
- Properties that are frequently changed at runtime
- Examples: `timescale` (boolean), `renderTrackControls` (function), `showClipHeaders` (boolean)

**Benefits of theme-based approach:**
- Single prop for all visual customization
- Consistent styling across all visual elements
- Easier to apply design systems
- Reduces prop sprawl on components
- TypeScript autocomplete for all theme properties in one place

**Pattern established:** All color/styling properties go in `theme` object, not as separate props.

## Optional Packages Architecture (2025-01-19)

**Decision:** Annotations as optional package (`@waveform-playlist/annotations`)

**Rationale:** ~50KB bundle size, used by minority of users.

### useAnnotationControls Hook

Manages `continuousPlay`, `linkEndpoints`, and `updateAnnotationBoundaries()` logic. Extracted ~110 lines of complex logic from main component.

### Continuous Play Toggle Fix (2025-01-21)

**Problem:** Toggling during playback didn't work correctly.

**Root Causes:**

1. Stale closures in animation loop
2. Scheduled audio callbacks
3. Monolithic context causing constant re-renders

**Solution:**

1. **Context Splitting** - 4 separate contexts by update frequency
2. **Animation Loop Restart** - Restart when `continuousPlay` changes
3. **Playout Rescheduling** - Clear callbacks, reschedule without duration limits

**Key Pattern:** `playoutRef.current.setOnPlaybackComplete(() => {})` to clear old callbacks.

## Component Design Decisions

### AudioPosition Component (2025-01-20)

**Decision:** Plain monospace text, not button-like.

**Reasoning:** Read-only display shouldn't look interactive.

## Performance Optimizations (2025-11-20)

### Playhead Animation

**Solution:** Use `transform: translate3d()` instead of `left` positioning for GPU acceleration.

### Zoom Performance

**Issue 1:** Zooming broke playback.
**Solution:** Separate peak generation from audio loading in separate useEffects.

**Issue 2:** Zooming caused jarring scroll jumps.
**Solution:** Proportional scroll adjustment maintaining visual center using refs.

## Example Migrations (2025-11-20)

**Converted:** newtracks, stem-tracks, recording examples to provider pattern.

**New Component:** `TrackControlsWithDelete` - Compact layout with trash icon, mute/solo, volume/pan.

## Codebase Cleanup (2025-11-20)

**Removed:**

- `WaveformPlaylistComponent.tsx` - obsolete
- All old Jekyll includes (`buttons/`, `forms/`, `checkboxes/`, `sliders/`, `timeformat.html`)

**Current API Patterns:**

1. Old class-based API (backward compatibility)
2. New provider pattern (recommended)

## Recording Architecture (2025-11-21)

### Global AudioContext Pattern

**Implementation:**

- Recording uses **global shared AudioContext** (same as Tone.js and playback)
- Uses `getGlobalAudioContext()` from `@waveform-playlist/playout`
- Context must be resumed on user interaction via `resumeGlobalAudioContext()`

**Location:** `packages/recording/src/hooks/useRecording.ts`, `useMicrophoneLevel.ts`

### Shared MediaStreamSource Pattern

**Critical Pattern:** Both `useRecording` and `useMicrophoneLevel` connect to the same shared `MediaStreamAudioSourceNode`.

**Key Rule:** Always use **targeted disconnect** when reconnecting:

```typescript
// ✅ CORRECT - Only disconnects specific connection
source.disconnect(analyser);
source.connect(analyser);

// ❌ WRONG - Breaks ALL connections including other consumers
source.disconnect();
source.connect(analyser);
```

**Why This Matters:**

- `disconnect()` without arguments disconnects **all connections** from the node
- Breaks connections from other consumers (worklet, analyser, etc.)
- Causes VU meter to go flat, recording to fail silently

**Fixed in:** `packages/recording/src/hooks/useMicrophoneLevel.ts` line 134

### Two-System Monitoring

1. **Pre-recording** (`useMicrophoneLevel`) - AnalyserNode, shows level before recording
2. **During recording** (`useRecording`) - AudioWorklet, calculates RMS in worklet thread

### VU Meter During Recording

- Recording hook sends RMS level via worklet `postMessage()`
- VU meter switches between monitoring level (pre-recording) and recording level (during recording)
- Both hooks run simultaneously, sharing the MediaStreamSource

### Test Microphone Button

**Purpose:** Resume AudioContext before recording to enable monitoring.

**Implementation:** `handleTestMicrophone()` calls `resumeGlobalAudioContext()`, sets `isMonitoring` state.

**Location:** `packages/browser/src/recording-app.tsx`

### Duration Timer with Refs

**Problem:** Duration timer stuck at 00:00 during recording.

**Root Cause:** Animation loop checked `isRecording` state (asynchronous), which was still false when loop started.

**Solution:** Use refs for synchronous checks in `requestAnimationFrame` loops:

```typescript
const isRecordingRef = useRef(false);
const isPausedRef = useRef(false);

// Set ref BEFORE starting loop (synchronous)
isRecordingRef.current = true;
setIsRecording(true); // State update (asynchronous)

// Animation loop checks ref
const updateDuration = () => {
  if (isRecordingRef.current && !isPausedRef.current) {
    // ... update
  }
};
```

**Location:** `packages/recording/src/hooks/useRecording.ts` lines 43-44, 137-151

### Try-Catch for Cleanup

**Pattern:** Wrap disconnect calls in try-catch for device switching:

```typescript
try {
  source.disconnect(destination);
} catch (e) {
  // Source may already be disconnected - ignore
}
```

**Location:** Both `useRecording.ts` and `useMicrophoneLevel.ts` cleanup functions.

### WaveformTrack Source Flexibility

`WaveformTrack.src` supports both URL strings and AudioBuffer objects:

- **newtracks** uses blob URLs from dropped files
- **recording** passes AudioBuffer directly (more efficient)

### Live Recording Peaks Format

**Format:** `Int16Array` min/max pairs, 16-bit depth (-32768 to 32767)

**Why:** Matches final waveform rendering exactly - identical appearance during and after recording.

### Debugging AudioWorklets

**Critical Note:** `console.log()` in AudioWorklet **DOES NOT** appear in browser console!

**Solutions:**

1. Send debug data via `postMessage()` to main thread
2. Update React state/UI to display values
3. Use live waveform visualization

**See:** `DEBUGGING.md` for complete worklet debugging guide.

### Important Patterns

1. **Targeted Disconnect** - Always specify destination on shared nodes
2. **Refs in Animation Loops** - Use refs for synchronous checks in `requestAnimationFrame`
3. **AudioWorklet Debugging** - Use postMessage, not console.log
4. **Worklet Deployment** - Manual copy + Jekyll restart required
5. **Try-Catch Cleanup** - Wrap disconnects for device switching

**Documentation:** See `DEBUGGING.md` and `PROJECT_STRUCTURE.md` for complete details.

## Current Work (Tone.js Overhaul Branch)

### Status

**Completed Phases:**
- ✅ **Phase 1: Foundation** - All core features implemented
- ✅ **Phase 1.5: Bundle Optimization** - Tree-shaking complete (23KB gzipped savings)
- ✅ **Phase 2: Clip-Based Model** - Multi-clip support fully implemented
- ✅ **Phase 3.1a: Drag to Move** - Clip headers with drag-to-reposition
- ✅ **Phase 3.1b: Drag to Trim** - Clip boundaries with bidirectional trimming

**Key Achievements:**
- React refactor complete with provider pattern
- Performance optimizations completed (GPU playhead, smooth zoom, 60fps)
- Recording architecture implemented (global AudioContext, shared MediaStreamSource)
- VU meter during recording fixed (AnalyserNode-only, no worklet RMS)
- Selection inputs, custom hooks, flexible API, theming all implemented
- Annotations as optional package with useAnnotationControls hook
- Audio effects hooks (analyser, reverb, auto-wah, effects chain)
- **Clip-based editing working:** Multiple clips per track with proper playback and gaps
- **Professional drag operations:** Real-time collision detection, smooth visual feedback
- **Reusable `useClipDragHandlers` hook** - 300+ lines of centralized drag logic

**Bundle Sizes (Optimized):**
- Core library: 507KB / **132KB gzipped** (from 620KB/172KB)
- Stem-tracks: 509KB / **150KB gzipped**
- Effects: 530KB / **154KB gzipped**

### Next Steps

**See `TODO.md` for complete roadmap. Next immediate steps (Phase 3.3 - Splitting Clips):**

1. Implement split logic (split clip at playhead/cursor position)
2. Create `useClipSplitting` hook
3. Add keyboard shortcut ('S' key)
4. Visual feedback (scissors cursor, split indicator)
5. Update multi-clip demo with split functionality

**Future Phases:**
- Phase 3.4: Copy/paste clips with keyboard shortcuts
- Phase 3.5: Multi-select and bulk operations
- Phase 4: Performance & virtual scrolling (unlimited timeline, 12+ tracks)
- Phase 5: Polish (undo/redo, snap to grid, keyboard shortcuts, accessibility)

## Important Notes

- **Bundle size matters** - This is a library, not an app
- **Users need flexibility** - Don't lock into specific UI patterns
- **Performance is critical** - Use GPU acceleration (transform not left/top)
- **Separation of concerns** - Audio ops separate from visualization
- **Global AudioContext** - Shared across recording, monitoring, and playback
- **Targeted Disconnect** - Always specify destination on shared nodes
- **Refs for Animation** - Synchronous checks in requestAnimationFrame loops
- **Single Source of Truth** - AnalyserNode for VU meter, worklet only for samples/peaks
- **Avoid State Conflicts** - Don't update same state from multiple 60fps sources

## References

- Main branch: `main`
- Current work: `tonejs-overhaul`
- Dev server: `http://localhost:4000/waveform-playlist/`
- Debugging: See `DEBUGGING.md`
- Architecture: See `PROJECT_STRUCTURE.md`

---

**Last Updated:** 2025-11-21

**Session Notes:**
1. Fixed VU meter jittery/flat issue during recording. Root cause: Worklet was sending RMS values at 60fps (180 state updates/sec) conflicting with AnalyserNode also updating at 60fps (120 state updates/sec) = 300 total state updates causing rendering bottleneck. Solution: Removed all RMS calculation from worklet - it now only captures samples and generates peaks for live waveform. AnalyserNode is single source of truth for VU meter levels (smoothingTimeConstant=0.8). No gain boost needed. Also automated worklet copy in build-all.sh script, fixed TypeScript errors (AudioParamDescriptor type, Track.src union type), and removed debug logging. Updated DEBUGGING.md with architecture decision and troubleshooting steps.

2. Created comprehensive multi-track editing roadmap in TODO.md. Documented complete plan for clip-based model (Phase 2), advanced editing features (Phase 3: drag, trim, split, copy/paste), performance optimizations (Phase 4: virtual scrolling), and polish (Phase 5: undo/redo, keyboard shortcuts, accessibility). Architectural decision: Hybrid Canvas + DOM approach (like Ableton Live) - NOT canvas libraries (Konva, Fabric, PixiJS) due to bundle size. Will use @dnd-kit (13KB) for interactions. Bundle size goal: <1MB total. Performance target: 60fps with 12+ tracks, 2+ hour timelines. Added "Project Roadmap" section to CLAUDE.md with guidance on tracking progress in TODO.md.

3. Analyzed bundle size with rollup-plugin-visualizer. Discovered actual size is **620KB uncompressed / 172KB gzipped** (NOT 1.5MB as previously stated). Tone.js is the largest contributor (~120KB gzipped). Currently using `import * as Tone from 'tone'` which imports entire library including synthesizers and unused effects. Created Phase 1.5 (Bundle Optimization) with tree-shaking task: change to named imports (Player, Volume, Gain, Panner, getContext, etc.) to save ~70KB gzipped. Target: 100KB gzipped core bundle. Added bundle analyzer to vite.config.ts and detailed optimization tasks to TODO.md. Updated bundle size figures throughout documentation.

4. **Completed Phase 1.5: Tree-shake Tone.js imports.** Changed all imports in playout package from `import * as Tone` to named imports. Updated three files: `index.ts`, `TonePlayout.ts`, `ToneTrack.ts`. Removed ToneLib parameter from `EffectsFunction` and `TrackEffectsFunction` types (breaking change). Updated effects hooks in browser package to import Tone.js classes directly (`Analyser`, `Reverb`, `AutoWah`). Rebuilt all bundles. **Results: 111KB uncompressed / 23KB gzipped savings (13% reduction).** New sizes: core 507KB/132KB, stem-tracks 509KB/150KB, effects 530KB/154KB gzipped. All unused Tone.js synthesizers and effects removed from bundles. Tree-shaking working correctly. Marked Phase 1.5 complete in TODO.md and CLAUDE.md. Ready to start Phase 2 (Clip-Based Model).

5. **Recording Example UI Polish** - Moved static content (Features list, Note section) from React component (`recording-app.tsx`) to Jekyll template (`17recording.html`) using Bootstrap alert styling. Used `alert-info` for feature list and `alert-warning` for note section. Benefits: Reduces bundle size, consistent styling across examples, easier to update without rebuilding. Removed InfoBox component duplication from React code.

6. **Multi-Clip Data Model Refactor** - Restructured multi-clip demo to use **file-reference architecture**. Created separate `audioFiles` array (id + src) and `trackConfigs` array (clips with `fileId` references). Implemented two-phase loading: (1) load all audio files once into Map by ID, (2) create tracks by looking up buffers via `fileId`. Benefits: Each audio file loaded only once, multiple clips can reference same file without reloading, easy to copy/paste clip configurations, efficient memory usage. All 4 tracks render correctly with clips and gaps: Vocals (2 clips with 10s gap), Guitar (continuous 30s), Piano (2 clips at different positions), Bass (3 clips with gaps). File-reference architecture verified working - all audio files loaded successfully (200 status), waveforms render correctly with proper timing and gaps. Location: `packages/browser/src/multi-clip-app.tsx`. Updated PROJECT_STRUCTURE.md with multi-clip architecture details and Bootstrap styling convention.

7. **Clip Header Theming & Design Guidelines** - Added full theming support for clip headers by integrating `clipHeaderBackgroundColor`, `clipHeaderBorderColor`, and `clipHeaderTextColor` into the main theme object. Updated `Waveform.tsx` to include these properties in defaultTheme and WaveformProps interface, and modified Clip rendering to pass theme values. Updated `flexible-example-app.tsx` to use custom clip header colors matching the dark blue/teal aesthetic. **Established design guidelines** for theme vs props: All visual/styling properties (colors, backgrounds, borders) go in the `theme` object; functional/behavioral properties (callbacks, data, configuration) remain as separate props. Benefits: Consistent API, single prop for all visual customization, easier design system integration, reduced prop sprawl. Documented guidelines in CLAUDE.md "Theming System" section with clear examples and rationale.

8. **Real-Time Collision Detection (Audacity-style)** - Implemented Audacity-style real-time collision detection where drag preview is constrained during dragging, not just on drop. Created custom @dnd-kit modifier function that runs during drag and constrains clip position in real-time based on: (1) Cannot go before time 0, (2) Cannot overlap previous clip (startTime >= prevClip.endTime), (3) Cannot overlap next clip (endTime <= nextClip.startTime). Applied modifier to both `multi-clip-app.tsx` and `flexible-example-app.tsx`. User experience: Drag preview "hits a wall" when reaching boundaries, clips can be adjacent but not overlapping. Also kept collision detection in handleDragEnd for final validation. Moved occasional flicker investigation to "Future Considerations > Polish & Nice to Have" section in TODO.md as it's likely a @dnd-kit library limitation and not blocking core functionality. Updated TODO.md Phase 3.1a to mark collision detection complete.
