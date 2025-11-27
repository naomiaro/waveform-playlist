# Claude AI Development Notes

This file contains important context, decisions, and conventions for AI-assisted development on the waveform-playlist project.

## Project Overview

Waveform-playlist is a multitrack Web Audio editor and player with HTML canvas waveform visualizations. Currently undergoing a React refactor (Tone.js overhaul branch).

**Key Dependencies:**
- **Tone.js 15.1.22** - Audio engine for playback, scheduling, and effects

### Website Aesthetic: Berlin Underground

The documentation website follows a **Berlin underground/industrial** aesthetic inspired by electronic music culture:

- **Dark gradient backgrounds** with high-contrast text
- **Monospace fonts** for timestamps and technical elements (Courier New)
- **Grungy details** like `//` prefixes on timestamps, text shadows
- **Muted color palette** with strategic accent colors
- **Minimal, utilitarian design** - form follows function

**Dark Mode Color Palette - "Ampelmännchen Traffic Light":**
Inspired by the iconic DDR pedestrian signal with its friendly walking figure and hat.
- 🟢 **Green** (`#63C75F`) - Official Ampelmännchen brand green for buttons/links
- 🟡 **Amber** (`#c49a6c`) - Warm golden waveform bars and body text
- 🔴 **Red** (`#d08070`) - Headings and accent elements

When adding new examples or UI elements, maintain this aesthetic. The Flexible API example showcases the full customization potential with custom playheads, grungy timestamps, and monospace clip headers.

## Project Roadmap

**Source of Truth:** `TODO.md` contains the complete multi-track editing roadmap and recently completed work.

**Current Phase:** Pre Launch - Alpha Release Preparation

**Breaking Changes OK:** No backwards compatibility requirements until after launch. Feel free to change defaults, rename props, or restructure APIs to get them right before the initial release.

**Key Milestones Completed:**
- ✅ Phase 1: Foundation (React refactor, provider pattern, all core features)
- ✅ Phase 1.5: Bundle Optimization (tree-shaking, 23KB gzipped savings)
- ✅ Phase 2: Clip-Based Model (multiple clips per track)
- ✅ Phase 3.1a/b: Drag & Trim (real-time collision detection, bidirectional trimming)
- ✅ Phase 3.3: Splitting Clips (sample-based architecture, keyboard shortcuts)
- ✅ Audio Effects: 20 Tone.js effects with UI, runtime parameters, WAV export

## Publishing Convention

**Prerelease Tag:** Use `@next` for prerelease versions (following Tone.js, React, Next.js convention).

```bash
# Publish prerelease
pnpm publish --tag next

# Users install prerelease with:
npm install waveform-playlist@next
```

After stable release, publish without tag to update `@latest`.

---

## Documentation Guidelines

**Where to track progress/updates:**
- ✅ **TODO.md** - Roadmap, recently completed work, session notes, progress updates
- ✅ **CLAUDE.md** - Architectural decisions, conventions, patterns (minimal, timeless)
- ✅ **PROJECT_STRUCTURE.md** - Architecture, file organization, data flow (NO progress/todos)

**When completing work:**
1. Update TODO.md "Recently Completed" section with date and details
2. Update CLAUDE.md only if architectural decision or pattern established
3. Update PROJECT_STRUCTURE.md only if structure/architecture changed
4. Never add progress/changelog to PROJECT_STRUCTURE.md

**TODO.md Writing Style:**
- **Keep concise** - Brief task descriptions, avoid verbose explanations
- Save detailed implementation notes for CLAUDE.md or PROJECT_STRUCTURE.md
- Recently Completed: Summary with key metrics (e.g., "547KB / 161KB gzipped")
- Focus on what was done, not how (the code is the "how")

---

## Code Conventions

### React/TypeScript

- Use functional components with hooks
- Props interfaces: `{ComponentName}Props`
- Use `React.FC<Props>` for component types
- Prefer `const` over `let`

### Boolean Props Convention

**Rule:** Boolean props should default to `false` so they can be enabled with shorthand syntax.

```typescript
// ✅ GOOD - Default to false, enable with shorthand
<Waveform timescale />           // Enables timescale
<Waveform showClipHeaders />     // Enables clip headers

// ❌ AVOID - Default to true requires explicit false
<Waveform timescale={false} />   // Awkward to disable
```

**Why:** JSX shorthand `<Component prop />` is equivalent to `<Component prop={true} />`. Defaulting to `false` enables this clean opt-in pattern.

### Styled Components

- Use transient props (prefix with `$`) for props that shouldn't pass to DOM
- Example: `$left`, `$width`, `$color`

### Building and Testing

- **Build packages**: `pnpm build` - Build all packages
- **TypeScript check**: `pnpm typecheck` (enforced in build scripts)
- **Dev server**: `pnpm --filter website start` - Docusaurus dev server
- **Hard refresh**: Always use Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) after builds

### E2E Testing with Playwright

- **Run tests**: `pnpm test`, `pnpm test:ui` (interactive), `pnpm test:headed` (visible browser)
- **Config**: `playwright.config.ts` - uses `BASE_PATH` and `PORT` env vars
- **Location**: `e2e/` directory

**Key Selectors:** `[data-clip-id]`, `[data-boundary-edge]`, `[data-clip-container]`, `[data-scroll-container]`

---

## Architectural Decisions

### Sample-Based Architecture (Phase 3.3)

**Decision:** Store all timing as integer sample counts, not floating-point seconds.

**Why:** Eliminates floating-point precision errors that cause pixel gaps between clips.

**Types:**
```typescript
interface AudioClip {
  startSample: number;      // Position on timeline (samples)
  durationSamples: number;  // Clip duration (samples)
  offsetSamples: number;    // Start within audio file (samples)
  // ... other properties
}
```

**Helper:** Use `createClipFromSeconds()` for backwards compatibility with time-based APIs.

### Hybrid Canvas + DOM (Phase 3)

**Decision:** Canvas for waveform rendering, DOM/React for interactions.

**Why NOT canvas libraries (Konva, Fabric, PixiJS):**
- Bundle size: 200-500KB vs our 13KB @dnd-kit
- Unnecessary for waveform-specific rendering
- Performance overhead for scene graph

**Technology Stack:**
- Rendering: Canvas API (optimized waveform code)
- Interactions: @dnd-kit (13KB) for drag-and-drop
- State: React Context + useReducer for undo/redo

### TypeScript Build Integration

**Decision:** Enforce TypeScript type checking in all build scripts.

**Implementation:** `"build:single": "pnpm typecheck && vite build"`

**Why:** Vite doesn't fail builds on TS errors by default. Prevents silent runtime failures.

### UI Library Strategy

**Decision:** Do NOT add a full UI library (Material-UI, Chakra, etc.) as peer dependency.

**Reasoning:** Keep bundle small (~132KB gzipped), maximize user flexibility.

**Approved Approach:**
1. Continue using **styled-components**
2. Use **Radix UI** or **React Aria** selectively for complex components (headless only)
3. Build simple components ourselves
4. Create internal design system with shared theme tokens

### Theming System

**When to add to `theme` object:**
- Visual/styling properties (colors, backgrounds, borders)
- Properties users want to customize for aesthetic consistency

**When to use separate props:**
- Functional/behavioral properties (callbacks, data, configuration)
- Properties that control what is rendered or how it behaves

**Example:** All clip header colors in `theme`, but `showClipHeaders` as boolean prop.

**Implementation Pattern:**
1. Define theme interface in `packages/ui-components/src/wfpl-theme.ts`
2. Export `WaveformPlaylistTheme` interface and `defaultTheme`
3. Extend styled-components DefaultTheme via `styled.d.ts`
4. Components access theme via `props.theme.propertyName` in styled components
5. No color/styling props passed through component interfaces

**Type Safety:** Use `Partial<WaveformPlaylistTheme>` for theme props. Single source of truth in `wfpl-theme.ts`.

**Location:** `ui-components/src/wfpl-theme.ts`, `ui-components/src/styled.d.ts`

### Theme Provider Pattern

**Decision:** Use styled-components `ThemeProvider` at the `WaveformPlaylistProvider` level.

**Implementation:**
1. `WaveformPlaylistProvider` accepts `theme?: Partial<WaveformPlaylistTheme>`
2. Provider merges user theme with `defaultTheme`: `{ ...defaultTheme, ...userTheme }`
3. Provider wraps children with styled-components `<ThemeProvider theme={mergedTheme}>`
4. All child components access theme via `useTheme()` hook from `ui-components`
5. `Waveform` component does NOT accept its own theme prop - gets from context

**Usage Pattern:**
```typescript
// Application level
<WaveformPlaylistProvider tracks={tracks} theme={darkTheme}>
  <Waveform />  {/* Gets theme from context */}
</WaveformPlaylistProvider>
```

**Why NOT pass theme to Waveform:**
- Single source of truth - theme set once at provider level
- Automatic propagation to all styled components
- Prevents theme conflicts from multiple ThemeProviders
- Follows React context pattern

**Docusaurus Integration:**
- Use MutationObserver to detect `data-theme` attribute changes
- Switch between `defaultTheme` and `darkTheme` based on Docusaurus mode
- Example: `minimal-app.tsx` detects and responds to theme toggle

### Docusaurus Native Examples

**Decision:** Docusaurus-native React components instead of Jekyll + separate bundles.

**Webpack Aliases:** In `website/docusaurus.config.ts`, packages transpiled from source:
- `@waveform-playlist/browser`, `core`, `playout`, `ui-components` → source
- `annotations`, `recording` → dist/ (have build artifacts like worklets)

**SSR/SSG Pattern:** Example components use browser APIs (AudioContext, Canvas, window) that aren't available during static site generation. Use lazy loading:

```typescript
// In example page files (website/src/pages/examples/*.tsx)
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyExample = createLazyExample(
  () => import('../../components/examples/ExampleComponent').then(m => ({ default: m.ExampleComponent }))
);

// Use <LazyExample /> in the page
```

**Why `createLazyExample` instead of just `BrowserOnly`:**
- Some libraries (Radix UI, Tone.js, AudioWorklets) access `window` at import time
- `BrowserOnly` only prevents rendering, not importing
- `React.lazy()` defers the import until render time in the browser

**Pattern:**
- Use `useDocusaurusTheme()` hook for automatic light/dark theme
- Export components as functions (no `createRoot()`)
- Styled components use CSS variables: `var(--ifm-background-surface-color, #fallback)`

**Rebuild requirement:** When ui-components changes affect recording, rebuild both packages.

**Location:** `website/src/components/examples/`, `website/src/components/BrowserOnlyWrapper.tsx`

### Track Selection Styling

**Theme Properties:** `selectedWaveOutlineColor`, `selectedTrackControlsBackground`, `selectedClipHeaderBackgroundColor`

**Pattern:** `isSelected` prop flows: Waveform → Track → Clip → ClipHeader and SmartChannel. Selection shown via background colors, no borders.

### Custom Hooks Architecture

**Pattern:** Extract complex logic into reusable custom hooks.

**Key Hooks:**
- `useClipDragHandlers` - Drag-to-move and boundary trimming (300+ lines)
- `useClipSplitting` - Split clips at playhead (150+ lines)
- `useKeyboardShortcuts` - Flexible keyboard shortcut system (120+ lines)
- `usePlaybackShortcuts` - Default playback shortcuts (0 = rewind to start)
- `useAnnotationKeyboardControls` - Annotation navigation, editing, auto-scroll, and playback
- `useDynamicEffects` - Master effects chain with runtime parameter updates
- `useTrackDynamicEffects` - Per-track effects management
- `usePlaybackControls`, `useTimeFormat`, `useZoomControls`, etc.

**Location:** `packages/browser/src/hooks/`

### Audio Effects Architecture

**Implementation:** 20 Tone.js effects with full parameter control, organized by category.

**Categories:** Reverb (3), Delay (2), Modulation (5), Filter (3), Distortion (3), Dynamics (3), Spatial (1)

**Key Files:**
- `packages/browser/src/effects/effectDefinitions.ts` - All effect metadata and parameters
- `packages/browser/src/effects/effectFactory.ts` - Creates effect instances
- `packages/browser/src/hooks/useDynamicEffects.ts` - Master chain management
- `packages/browser/src/hooks/useTrackDynamicEffects.ts` - Per-track effects

**Pattern:** Effects are created via factory, chained in series, support real-time parameter updates without rebuilding the chain.

**Bypass Pattern:** When bypassing, store original wet value and set to 0. On re-enable, restore original wet value (not always 1).

**Offline Rendering:** Both hooks provide `createOfflineEffectsFunction()` for WAV export via `Tone.Offline`.

**Documentation:** `website/docs/effects.md`

---

## Recording Architecture

### Global AudioContext Pattern

**Implementation:** Recording uses global shared AudioContext (same as Tone.js).

**Location:** `getGlobalAudioContext()` from `@waveform-playlist/playout`

**Critical:** Context must be resumed on user interaction via `resumeGlobalAudioContext()`

### MediaStreamSource Per Hook (Firefox Compatibility)

**Pattern:** Each recording hook creates its own `MediaStreamSource` directly from Tone's `getContext()`.

```typescript
// ✅ CORRECT - Create source from same context as other audio nodes
const context = getContext();  // Tone.js shared context
const source = context.createMediaStreamSource(stream);
const meter = new Meter({ smoothing, context });
connect(source, meter);
```

**Why:** Firefox throws "Can't connect nodes from different AudioContexts" when:
- A shared `MediaStreamSource` is created in one module (e.g., playout package)
- Audio nodes (Meter, AudioWorklet) are created in another module (recording package)
- Even though both use `getContext()` from Tone.js, bundler module resolution can cause different context instances

**Solution:** Both `useRecording` and `useMicrophoneLevel` create their own source directly from `getContext()`. This ensures the source and connected nodes share the exact same context instance.

**Note:** Creating multiple `MediaStreamAudioSourceNode` instances from the same `MediaStream` is valid - they independently read from the same underlying stream.

### Debugging AudioWorklets

**Critical Note:** `console.log()` in AudioWorklet **DOES NOT** appear in browser console!

**Solutions:**
1. Send debug data via `postMessage()` to main thread
2. Update React state/UI to display values
3. Use live waveform visualization

**See:** `DEBUGGING.md` for complete worklet debugging guide.

### Recording-Optimized Audio Constraints

**Defaults in `useMicrophoneAccess`:** `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`, `latency: 0`

Users can override via `audioConstraints` parameter.

### VU Meter Level Normalization

**Implementation:** `useMicrophoneLevel` uses Tone.js `Meter` which returns dB values.

**dB to 0-1 Conversion:**
```typescript
// Meter returns -Infinity to 0 dB
// Map -100dB..0dB to 0..1 (using -100dB floor for Firefox compatibility)
const normalized = Math.max(0, Math.min(1, (dbValue + 100) / 100));
```

**Why -100dB floor:** Firefox reports lower dB values than Chrome (e.g., -70 to -85 dB for quiet input). Using -60dB floor caused all quiet signals to map to 0.

### Tone.js Initialization

**Critical:** Call `await Tone.start()` after user interaction and before `Tone.now()`.

Without `Tone.start()`, `Tone.now()` returns null → RangeError in scheduling.

**Master volume:** Uses Web Audio standard 0-1.0 range (not 0-100).

### Firefox Compatibility (standardized-audio-context)

**Problem 1: AudioListener Error**
Firefox throws `"param must be an AudioParam"` when Tone.js initializes because Firefox's `AudioListener` implementation differs from Chrome/Safari.

**Problem 2: AudioWorkletNode Error**
Firefox throws `"parameter 1 is not of type 'BaseAudioContext'"` when creating `AudioWorkletNode` with a native `AudioContext`.

**Root Cause:** Both issues stem from using native `AudioContext` instead of `standardized-audio-context` which normalizes browser differences.

**Solution:** Use Tone.js's `Context` class directly. It wraps `standardized-audio-context` and provides cross-browser compatible methods:

```typescript
// packages/playout/src/audioContext.ts
import { Context, setContext } from 'tone';

export function getGlobalContext(): Context {
  if (!globalToneContext) {
    globalToneContext = new Context();
    setContext(globalToneContext);
  }
  return globalToneContext;
}
```

**Recording/Monitoring:** Use Tone.js Context methods directly:

```typescript
// packages/recording/src/hooks/useRecording.ts
import { getGlobalContext } from '@waveform-playlist/playout';

const context = getGlobalContext();

// These methods handle cross-browser compatibility automatically:
await context.addAudioWorkletModule(workletUrl);
const workletNode = context.createAudioWorkletNode('recording-processor');
const source = context.createMediaStreamSource(stream);
const analyser = context.createAnalyser();
```

**Key Files:**
- `packages/playout/src/audioContext.ts` - Context management (`getGlobalContext()`)
- `packages/recording/src/hooks/useRecording.ts` - Uses Tone.js Context methods
- `packages/recording/src/hooks/useMicrophoneLevel.ts` - Uses Tone.js Context methods

**References:**
- [Tone.js Issue #681](https://github.com/Tonejs/Tone.js/issues/681) - AudioListener Firefox error

---

## Important Patterns

1. **Targeted Disconnect** - Always specify destination on shared audio nodes
2. **Refs in Animation Loops** - Use refs for synchronous checks in `requestAnimationFrame`
3. **AudioWorklet Debugging** - Use postMessage, not console.log
4. **Try-Catch Cleanup** - Wrap audio node disconnects for device switching
5. **Sample-Based Math** - Use integer samples for all timing calculations
6. **TypeScript Enforcement** - Build scripts run `pnpm typecheck &&` before bundling
7. **Refs for Dynamic Audio Callbacks** - When useCallback needs fresh state for audio graph rebuilding, store state in a ref and read from ref inside callback (avoids stale closures)
8. **Smooth Playback Animation** - Use `requestAnimationFrame` + direct DOM manipulation for 60fps updates (playhead, progress, time display)
9. **Animation Loop Restart** - When restarting playback, cancel existing animation frames AND reset `currentTimeRef` to the new start position before calling `startAnimationLoop()`
10. **Constraint-First Drag Handling** - When implementing boundary trimming, calculate constrained delta first, then apply uniformly to all affected properties (startSample, offsetSamples, durationSamples)

### Refs for Dynamic Audio Callbacks

**Problem:** useCallback with state dependencies creates stale closures when callbacks are stored and called later.

**Solution:** Store current state in a ref, read from ref inside callback:

```typescript
const activeEffectsRef = useRef(activeEffects);
activeEffectsRef.current = activeEffects; // Update on every render

const rebuildChain = useCallback(() => {
  const currentEffects = activeEffectsRef.current; // Fresh state
}, []); // Stable function - no dependencies
```

**Applied in:** `useDynamicEffects`, `useTrackDynamicEffects`

### Smooth Playback Animation Pattern

**Problem:** React state updates during playback cause flickering and are throttled (every 500ms). Components like playhead position, progress overlay, and time display need 60fps updates.

**Solution:** Use `requestAnimationFrame` with direct DOM manipulation via refs. Calculate time directly from audio context for perfect sync.

**Pattern:**
```typescript
const elementRef = useRef<HTMLElement>(null);
const animationFrameRef = useRef<number | null>(null);
const { isPlaying, currentTimeRef, playbackStartTimeRef, audioStartPositionRef } = usePlaybackAnimation();

useEffect(() => {
  const update = () => {
    if (elementRef.current) {
      // Calculate time from audio context during playback
      let time: number;
      if (isPlaying) {
        const elapsed = getContext().currentTime - (playbackStartTimeRef.current ?? 0);
        time = (audioStartPositionRef.current ?? 0) + elapsed;
      } else {
        time = currentTimeRef.current ?? 0;
      }
      // Update DOM directly (no React state)
      elementRef.current.style.transform = `translateX(${time * pixelsPerSecond}px)`;
    }
    if (isPlaying) {
      animationFrameRef.current = requestAnimationFrame(update);
    }
  };

  if (isPlaying) {
    animationFrameRef.current = requestAnimationFrame(update);
  } else {
    update(); // Update once when stopped
  }

  return () => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
  };
}, [isPlaying, ...dependencies]);

// Also update when stopped (for seeks)
useEffect(() => {
  if (!isPlaying && elementRef.current) {
    // Update position from currentTimeRef
  }
});
```

**Key Points:**
- Use `getContext().currentTime` from Tone.js for accurate audio time
- Calculate elapsed time: `audioContext.currentTime - playbackStartTimeRef`
- Add to start position: `audioStartPositionRef + elapsed`
- Update DOM directly via refs (no setState)
- Cancel animation frame on cleanup and when stopping

**Applied in:**
- `AnimatedPlayhead` - Playhead line position
- `ChannelWithProgress` - Per-channel progress overlay
- `AudioPosition` - Time display (ContextualControls)
- `PlayheadWithMarker` - Custom playhead with triangle marker (ui-components)

**Location:** `packages/browser/src/components/`

---

## References

- **Roadmap & Progress:** `TODO.md`
- **Architecture Details:** `PROJECT_STRUCTURE.md`
- **Debugging Guide:** `DEBUGGING.md`
- **Main branch:** `main`
- **Current work:** `tonejs-overhaul`
- **Dev server:** `http://localhost:3000/` (Docusaurus)

---

**Last Updated:** 2025-11-26
