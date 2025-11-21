# Claude AI Development Notes

This file contains important context, decisions, and conventions for AI-assisted development on the waveform-playlist project.

## Project Overview

Waveform-playlist is a multitrack Web Audio editor and player with HTML canvas waveform visualizations. Currently undergoing a React refactor (Tone.js overhaul branch).

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
- `renderTimestamp` - Custom React components for timescale timestamps

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

- React refactor in progress
- All React examples migrated to provider pattern
- Performance optimizations completed (GPU playhead, smooth zoom)
- Recording architecture implemented (global AudioContext, shared MediaStreamSource)
- **VU meter during recording fixed** (AnalyserNode-only, no worklet RMS)
- Selection inputs, custom hooks, flexible API, theming all implemented
- Annotations as optional package
- Audio effects hooks (analyser, reverb, auto-wah, effects chain)
- TrackControlsWithDelete component created
- Obsolete code removed
- Worklet copy automated in build script

### Next Steps / Ideas

- Consider more optional packages (effects, fades, etc.)
- Add more example layouts
- Document all hooks and components
- Add unit tests

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

**Session Notes:** Fixed VU meter jittery/flat issue during recording. Root cause: Worklet was sending RMS values at 60fps (180 state updates/sec) conflicting with AnalyserNode also updating at 60fps (120 state updates/sec) = 300 total state updates causing rendering bottleneck. Solution: Removed all RMS calculation from worklet - it now only captures samples and generates peaks for live waveform. AnalyserNode is single source of truth for VU meter levels (smoothingTimeConstant=0.8). No gain boost needed. Also automated worklet copy in build-all.sh script, fixed TypeScript errors (AudioParamDescriptor type, Track.src union type), and removed debug logging. Updated DEBUGGING.md with architecture decision and troubleshooting steps.
