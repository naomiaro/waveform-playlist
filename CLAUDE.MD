# Claude AI Development Notes

This file contains important context, decisions, and conventions for AI-assisted development on the waveform-playlist project.

## Project Overview

Waveform-playlist is a multitrack Web Audio editor and player with HTML canvas waveform visualizations. Currently undergoing a React refactor (Tone.js overhaul branch).

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

- **Build all bundles**: `pnpm build` - Runs `./build-all.sh` to build all 9 example bundles
- **Build single entry**: `env VITE_ENTRY=multi-clip pnpm build:single` - Build one specific bundle
- **TypeScript check**: `pnpm typecheck` (enforced in build scripts)
- **Jekyll**: `jekyll serve -s ghpages --skip-initial-build`
- **Dev server**: `http://localhost:4000/waveform-playlist/`
- **Hard refresh**: Always use Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) after builds

**When to rebuild all bundles:**
- After changes to `ui-components` package (affects all examples)
- After changes to shared theme, controls, or base components
- Use `pnpm build` to rebuild all 9 bundles at once

### Jekyll Example Pages Convention

**File naming pattern:** `ghpages/_examples/##name.html`

- Use numbered prefixes (e.g., `01minimal.html`, `18multi-clip.html`) to control ordering
- Keep `flexible-api.html` last by not numbering it
- Always add `permalink:` in front matter for clean, permanent URLs

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

**Type Safety Pattern (2025-11-23):**
- Use `Partial<WaveformPlaylistTheme>` for theme props in component interfaces
- Single source of truth - theme shape defined once in `wfpl-theme.ts`
- Automatic propagation - new theme properties available everywhere without manual updates
- Applied in: `WaveformProps` and `WaveformPlaylistProviderProps`

**Location:** Theme types in `ui-components/src/wfpl-theme.ts`, type augmentation in `ui-components/src/styled.d.ts`

### Theme Provider Pattern (2025-11-24)

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

### Docusaurus Native Examples (2025-11-24)

**Decision:** Migrate from Jekyll + separate bundle builds to Docusaurus-native React components.

**Why:**
- Simpler build process (one system instead of Jekyll + Vite)
- Better code-splitting and smaller bundles per page
- Hot module reloading for faster development
- Direct use of `useDocusaurusTheme()` hook without MutationObserver
- Eliminates need to maintain separate bundle entry points

**Webpack Configuration:**
```typescript
// website/docusaurus.config.ts
resolve: {
  symlinks: true,
  extensions: ['.ts', '.tsx', '.js', '.jsx', '.json'],
  alias: {
    // Transpile these packages from source
    '@waveform-playlist/browser': path.resolve(__dirname, '../packages/browser/src'),
    '@waveform-playlist/core': path.resolve(__dirname, '../packages/core/src'),
    '@waveform-playlist/playout': path.resolve(__dirname, '../packages/playout/src'),
    '@waveform-playlist/ui-components': path.resolve(__dirname, '../packages/ui-components/src'),
    // annotations, recording use built dist/ versions (have build artifacts like worklets)
  },
}
```

**Example Component Pattern:**
```typescript
// website/src/components/examples/MinimalExample.tsx
import { WaveformPlaylistProvider, Waveform, PlayButton, useAudioTracks } from '@waveform-playlist/browser';
import { useDocusaurusTheme } from '../../hooks/useDocusaurusTheme';

export function MinimalExample() {
  const theme = useDocusaurusTheme();
  const { tracks, loading, error } = useAudioTracks(audioConfigs);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks} theme={theme}>
      <PlayButton />
      <Waveform />
    </WaveformPlaylistProvider>
  );
}
```

**Page Pattern:**
```typescript
// website/src/pages/examples/minimal.tsx
import { MinimalExample } from '../../components/examples/MinimalExample';

export default function MinimalExamplePage() {
  return (
    <Layout title="Minimal Example">
      <MinimalExample />
    </Layout>
  );
}
```

**Key Points:**
- Export components as functions (no `createRoot()` / DOM mounting)
- Use `useDocusaurusTheme()` for automatic light/dark theme
- Styled components use Docusaurus CSS variables: `var(--ifm-background-surface-color, #fallback)`
- No need for MutationObserver - theme changes automatically
- Built packages (annotations, recording) still use dist/ for build artifacts
- **Rebuild requirement:** When ui-components changes affect recording (e.g., BaseSelect theming), rebuild both packages: `cd packages/ui-components && pnpm build`, then `cd packages/recording && pnpm build`

**Location:** Example components in `website/src/components/examples/`

### Track Selection Styling (2025-11-23)

**Visual Feedback for Selected Track:**
- `selectedWaveOutlineColor` - Brighter waveform outline (#0099ff vs #005BBB)
- `selectedTrackControlsBackground` - Light blue controls background (#d9e9ff)
- `selectedClipHeaderBackgroundColor` - Brighter clip headers (#b3d9ff)

**Implementation:**
- Track: `isSelected` prop passed to all track components
- SmartChannel: Conditionally uses `selectedWaveOutlineColor` when `isSelected`
- Track ControlsWrapper: Applies `selectedTrackControlsBackground` with transition
- ClipHeader: Applies `selectedClipHeaderBackgroundColor` when track selected
- No borders - selection shown via background colors only

**Pattern:** `isSelected` prop flows: Waveform → Track → Clip → ClipHeader and SmartChannel

### Custom Hooks Architecture

**Pattern:** Extract complex logic into reusable custom hooks.

**Key Hooks:**
- `useClipDragHandlers` - Drag-to-move and boundary trimming (300+ lines)
- `useClipSplitting` - Split clips at playhead (150+ lines)
- `useKeyboardShortcuts` - Flexible keyboard shortcut system (120+ lines)
- `usePlaybackControls`, `useTimeFormat`, `useZoomControls`, etc.

**Location:** `packages/browser/src/hooks/`

---

## Recording Architecture

### Global AudioContext Pattern

**Implementation:** Recording uses global shared AudioContext (same as Tone.js).

**Location:** `getGlobalAudioContext()` from `@waveform-playlist/playout`

**Critical:** Context must be resumed on user interaction via `resumeGlobalAudioContext()`

### Shared MediaStreamSource Pattern

**Rule:** Always use **targeted disconnect** when reconnecting:

```typescript
// ✅ CORRECT - Only disconnects specific connection
source.disconnect(analyser);
source.connect(analyser);

// ❌ WRONG - Breaks ALL connections including other consumers
source.disconnect();
source.connect(analyser);
```

**Why:** Both `useRecording` and `useMicrophoneLevel` share the same MediaStreamSource.

### Debugging AudioWorklets

**Critical Note:** `console.log()` in AudioWorklet **DOES NOT** appear in browser console!

**Solutions:**
1. Send debug data via `postMessage()` to main thread
2. Update React state/UI to display values
3. Use live waveform visualization

**See:** `DEBUGGING.md` for complete worklet debugging guide.

### Recording-Optimized Audio Constraints

**Default Constraints:** Prioritize raw audio quality and low latency for recording.

```typescript
{
  echoCancellation: false,      // Preserve raw audio
  noiseSuppression: false,      // No processing
  autoGainControl: false,       // Manual control
  latency: 0                    // Low latency mode
}
```

**Pattern:** These are defaults in `useMicrophoneAccess`. Users can override via `audioConstraints` parameter.

**Note:** `latency: 0` is supported in modern browsers but not yet in TypeScript types. Use type extension: `MediaTrackConstraints & { latency?: number }`

### Tone.js Initialization Pattern (2025-11-24)

**Critical:** Tone.js AudioContext must be explicitly started before using timing functions.

**Problem:** `Tone.now()` returns `null` if context hasn't been started, causing RangeError in audio scheduling.

**Solution:** Always call `await Tone.start()` after user interaction and before using Tone timing.

```typescript
// ✅ CORRECT - Start context before timing functions
await playoutRef.current.init();
await Tone.start();  // Required!
const now = Tone.now();  // Now returns valid time
playbackStartTimeRef.current = now;

// ❌ WRONG - Timing functions without start
await playoutRef.current.init();
const now = Tone.now();  // Returns null!
// → RangeError: Value must be within [0, Infinity], got: NaN
```

**Why:** Browser security requires AudioContext to be started by user gesture. Tone.js `start()` resumes the context.

**Location:** WaveformPlaylistContext.tsx play() function (line 635)

**Related:** Master volume now uses Web Audio standard 0-1.0 range instead of 0-100 percentage.

---

## Important Patterns

1. **Targeted Disconnect** - Always specify destination on shared audio nodes
2. **Refs in Animation Loops** - Use refs for synchronous checks in `requestAnimationFrame`
3. **AudioWorklet Debugging** - Use postMessage, not console.log
4. **Try-Catch Cleanup** - Wrap audio node disconnects for device switching
5. **Sample-Based Math** - Use integer samples for all timing calculations
6. **TypeScript Enforcement** - Build scripts run `pnpm typecheck &&` before bundling

---

## References

- **Roadmap & Progress:** `TODO.md`
- **Architecture Details:** `PROJECT_STRUCTURE.md`
- **Debugging Guide:** `DEBUGGING.md`
- **Main branch:** `main`
- **Current work:** `tonejs-overhaul`
- **Dev server:** `http://localhost:4000/waveform-playlist/`

---

**Last Updated:** 2025-11-24
