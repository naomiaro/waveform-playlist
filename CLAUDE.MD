# Claude AI Development Notes

This file contains important context, decisions, and conventions for AI-assisted development on the waveform-playlist project.

## Project Overview

Waveform-playlist is a multitrack Web Audio editor and player with HTML canvas waveform visualizations. Currently undergoing a React refactor (Tone.js overhaul branch).

## Recent Architectural Decisions

### UI Library Strategy (2025-01-19)

**Decision:** Do NOT add a full UI library (Material-UI, Chakra, etc.) as a peer dependency.

**Reasoning:**
- Keep bundle size small (library is already ~1.5MB)
- Maximize user flexibility for custom styling
- Avoid forcing a design system on users
- Simple UI needs don't justify the overhead

**Approved Approach:**
1. Continue using **styled-components** (already in use)
2. Use **Radix UI** or **React Aria** selectively for complex components (sliders, dropdowns, dialogs)
   - Only where accessibility/behavior is complex
   - Headless (no styling) to maintain flexibility
3. Build simple components (buttons, inputs) ourselves
4. Create internal design system with shared theme tokens

**Implementation Plan:**
- Create `packages/ui-components/src/theme/tokens.ts` for design tokens
- Build reusable primitives in `packages/ui-components/src/primitives/`
- Use headless UI only when complexity justifies it

### Selection Time Inputs (2025-01-19)

**Implemented:** Reusable React components for audio selection time display/editing

**Components Created:**
- `TimeInput` - Reusable time input with format support
- `SelectionTimeInputs` - Combines start/end inputs
- `SelectionTimeInputsManager` - Bridges HTML and React components
- Time format utilities (`formatTime`, `parseTime`)

**Key Behaviors:**
- Inputs update when dragging a selection on the waveform
- Inputs respect the time-format dropdown (seconds, hh:mm:ss, etc.)
- Clicking (without dragging) seeks but preserves selection
- Playing with a selection stops at the selection end

### Shared Styled Components (2025-01-19)

**Pattern:** Extract commonly duplicated styled components into shared definitions in `ui-components/styled/`

**Implemented:**

1. **CheckboxStyles** (`packages/ui-components/src/styled/CheckboxStyles.tsx`)
   - `CheckboxWrapper` - Flex container for checkbox + label
   - `StyledCheckbox` - Base checkbox input styling
   - `CheckboxLabel` - Label styling with proper cursor and user-select
   - Used by: `AutomaticScrollCheckbox`, `EditableCheckbox`, `LinkEndpointsCheckbox`, `ContinuousPlayCheckbox`

2. **ButtonStyles** (`packages/ui-components/src/styled/ButtonStyles.tsx`)
   - `ControlButton` - Large control button with color variants
   - Variants: `primary` (blue), `success` (green), `info` (cyan)
   - Features: Consistent padding, hover states, disabled styling
   - Used by: `PlaybackControls`, `ZoomControls`, `DownloadAnnotationsButton`
   - Note: Separate from `TrackControls/Button` which is for compact track UI

**Benefits:**
- Reduces code duplication (~60% reduction in affected components)
- Ensures consistent styling across all components
- Easier to maintain and update styles in one place
- Clearer separation between presentation and logic

**Usage Pattern:**
```typescript
// In ui-components package (relative import)
import { ControlButton } from '../styled/ButtonStyles';

// In other packages (package import)
import { ControlButton } from '@waveform-playlist/ui-components';

// Use with variant
<ControlButton variant="success" onClick={handleClick}>
  Zoom In
</ControlButton>
```

## Code Conventions

### React/TypeScript
- Use functional components with hooks
- Props interfaces should be exported and named `{ComponentName}Props`
- Use `React.FC<Props>` for component types
- Prefer `const` over `let` where possible

### Styled Components
- Use transient props (prefix with `$`) for props that shouldn't pass to DOM
- Example: `$left`, `$width`, `$color`

### File Organization
```
packages/
├── browser/          # React apps and entry points
├── ui-components/    # Reusable React components
│   ├── components/   # Public components
│   ├── contexts/     # React contexts
│   ├── utils/        # Utilities (conversions, formatting)
│   └── theme/        # Design tokens (future)
├── core/             # Core types and interfaces
├── playout/          # Audio playback (Tone.js)
└── ...
```

### Building and Testing
- Build command: `pnpm build`
- Jekyll site: `jekyll build -s ghpages -d _site`
- Local dev server: `http://localhost:4000/waveform-playlist/`
- Always hard refresh (Cmd+Shift+R) after builds

## Chrome Remote Debugging

Remote debugging is enabled on port 9222. Use proper flags:
```bash
/Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome \
  --remote-debugging-port=9222 \
  --user-data-dir=/tmp/chrome-debug-profile \
  --remote-allow-origins='*'
```

Note: Quote the asterisk in zsh to avoid glob expansion.

## MCP Chrome DevTools Usage (2025-01-19)

**IMPORTANT:** When using Chrome DevTools MCP tools for visual inspection:

### Screenshot Tool Issues

**Known Bug:** The `take_screenshot` tool with `format: "png"` has a media type mismatch bug that causes API errors:
```
Image does not match the provided media type image/jpeg
```

**Workarounds:**
1. **Use JPEG format (RECOMMENDED):**
   ```typescript
   format: "jpeg", quality: 90
   ```

2. **Use WebP format:**
   ```typescript
   format: "webp", quality: 90
   ```

3. **Save to file instead of inline:**
   ```typescript
   filePath: "/path/to/screenshot.png"
   ```

### Best Practices

- **Prefer `take_snapshot` over `take_screenshot`** for page analysis - it provides a text-based accessibility tree view without image format issues
- Use `take_snapshot` first to understand page structure
- Only use `take_screenshot` when visual appearance is critical
- When screenshots are needed, always use JPEG or WebP format
- Use `list_pages` to see all open pages before selecting one
- Use `select_page` to switch context before taking snapshots/screenshots

### Example Workflow

```typescript
// 1. List available pages
mcp__chrome-devtools__list_pages

// 2. Select the target page
mcp__chrome-devtools__select_page(pageIdx: 2)

// 3. Take text snapshot for structure analysis
mcp__chrome-devtools__take_snapshot()

// 4. If visual inspection needed, use JPEG
mcp__chrome-devtools__take_screenshot(format: "jpeg", quality: 90)
```

## Custom Hooks Architecture (2025-01-19)

### Hooks-Based Design

**Decision:** Extract playlist logic into reusable custom hooks for maximum flexibility.

**Created Hooks:**
- `usePlaybackControls` - Play/pause/stop/seek functionality
- `useTimeFormat` - Time formatting with dropdown sync
- `useZoomControls` - Zoom in/out with configurable levels
- `useAudioPosition` - Auto-updates `.audio-pos` display element
- `useWaveformPlaylist` - Composite hook combining all controls

**Benefits:**
- **Separation of Concerns:** Business logic separate from UI
- **Reusability:** Users can build completely custom UIs
- **Testability:** Hooks can be tested independently
- **Type Safety:** Full TypeScript support throughout
- **Backward Compatible:** Still works with existing HTML structure

**Location:** `packages/browser/src/hooks/`

**Documentation:** See `packages/browser/src/hooks/README.md` and `packages/browser/HOOKS_ARCHITECTURE.md`

### WaveformPlaylistComponent Integration

The main `WaveformPlaylistComponent.tsx` now uses these hooks internally:
```typescript
const { timeFormat, formatTime } = useTimeFormat();
const zoom = useZoomControls({ initialSamplesPerPixel });
useAudioPosition({ currentTime, formatTime });
```

This demonstrates proper usage and ensures the component and hooks stay in sync.

### Custom UI Pattern

Users can now build custom UIs using the hooks:

```typescript
import { useWaveformPlaylist } from '@waveform-playlist/browser/hooks';

const controls = useWaveformPlaylist({ playoutRef, ... });

// Use controls.playback.play(), controls.zoom.zoomIn(), etc.
// Build any UI you want!
```

### Audio Effects Hooks (2025-01-20)

**Decision:** Create reusable hooks for common Tone.js audio effects.

**Created Hooks:**
- `useMasterAnalyser` - FFT analyzer for frequency visualization on master output
- `useTrackReverb` - Reverb effect with configurable decay time
- `useTrackAutoWah` - Auto-wah effect with frequency/sensitivity controls
- `useEffectsChain` - Chains multiple effects together in series

**Benefits:**
- **Composable:** Effects can be chained together using `useEffectsChain`
- **Reusable:** Same effects can be applied to multiple tracks
- **Type-Safe:** Full TypeScript support with Tone.js types
- **Clean API:** Simple hook interface, complex audio graph management hidden

**Location:** `packages/browser/src/hooks/useAudioEffects.ts`

**Example Usage:**
```typescript
import { useMasterAnalyser, useTrackReverb, useTrackAutoWah, useEffectsChain }
  from '@waveform-playlist/browser/hooks';

// Master effects with frequency analyzer
const { analyserRef, masterEffects } = useMasterAnalyser(256);

// Individual track effects
const autoWahEffect = useTrackAutoWah({
  baseFrequency: 50,
  octaves: 6,
  sensitivity: -30
});
const reverbEffect = useTrackReverb(1.2);

// Chain multiple effects together
const chainedEffect = useEffectsChain([autoWahEffect, reverbEffect]);

// Apply to tracks
const tracks = [
  { src: 'audio.mp3', name: 'Track 1', effects: chainedEffect },
];

// Pass master effects to provider
<WaveformPlaylistProvider
  tracks={tracks}
  effects={masterEffects}
>
  {/* Visualize frequency data */}
  <FrequencyVisualizer analyserRef={analyserRef} />
</WaveformPlaylistProvider>
```

**Implementation Notes:**
- Effects use polling pattern to detect when audio nodes are ready
- Cleanup functions properly dispose Tone.js nodes
- Effects work in both realtime and offline (export) modes
- Example app: `packages/browser/src/effects-app.tsx`
- Demo page: `ghpages/_examples/16effects.html`

## Flexible/Headless API Architecture (2025-01-19)

### Decision: Provider Pattern + Primitive Components

**Implemented:** Complete flexible API using React Context and primitive components.

**Architecture Pattern:** Hybrid approach (#3)
- Provider for state management (`WaveformPlaylistProvider`)
- Primitive components that work anywhere inside provider
- Render props for customizable parts (track controls)
- Hooks for accessing state (`useWaveformPlaylist`)

**Key Components Created:**

**Provider & Context:**
- `WaveformPlaylistProvider` - Context provider with all playlist state/logic
- `useWaveformPlaylist` - Hook to access context from any component

**Primitive Control Components:**
- `PlayButton`, `PauseButton`, `StopButton` - Playback controls
- `RewindButton`, `FastForwardButton` - Skip controls
- `ZoomInButton`, `ZoomOutButton` - Zoom controls
- `MasterVolumeControl` - Master volume slider
- `TimeFormatSelect` - Time format dropdown
- `AudioPosition` - Current time display (text-only, monospace styling)
- `SelectionTimeInputs` - Selection start/end inputs
- `AutomaticScrollCheckbox` - Auto-scroll toggle

**Core Components:**
- `Waveform` - Visualization component with optional custom track controls via render prop

**Benefits:**
- **Maximum Flexibility:** Controls can be placed anywhere in layout
- **Customizable Track Controls:** Use render prop to customize per-track UI
- **Access to State:** Use hook to build completely custom components
- **Good Defaults:** Waveform component provides default track controls
- **Backward Compatible:** Old class-based API still works

**Example Usage:**
```tsx
<WaveformPlaylistProvider tracks={tracks} samplesPerPixel={1024}>
  <div className="my-layout">
    <div className="top-bar">
      <PlayButton />
      <StopButton />
      <AudioPosition />
    </div>

    <Waveform
      renderTrackControls={(trackIndex) => (
        <CustomTrackControls trackIndex={trackIndex} />
      )}
    />

    <div className="footer">
      <MasterVolumeControl />
      <TimeFormatSelect />
    </div>
  </div>
</WaveformPlaylistProvider>
```

**Location:**
- Context: `packages/browser/src/WaveformPlaylistContext.tsx`
- Components: `packages/browser/src/components/`
- Example: `packages/browser/src/flexible-example-app.tsx`
- Demo page: `ghpages/_examples/flexible-api.html`

## Theming System (2025-01-19)

**Implemented:** Complete theming system for waveform visualization components

**Theme Properties:**
All theme properties are optional and can be passed to the `Waveform` component:

```typescript
interface WaveformProps {
  theme?: {
    waveOutlineColor?: string;        // Background color of waveform tracks
    waveFillColor?: string;            // Waveform visualization color
    waveProgressColor?: string;        // Progress/played portion color
    timeColor?: string;                // Timescale text and tick marks color
    timescaleBackgroundColor?: string; // Timescale background color
    playheadColor?: string;            // Playhead vertical line color
    selectionColor?: string;           // Selection area overlay color (with alpha)
  };
  renderTimestamp?: (timeMs: number, pixelPosition: number) => ReactNode;
  // ... other props
}
```

**Custom Timestamp Rendering:**
- Users can provide custom React components for timescale timestamps
- Receives `timeMs` (milliseconds) and `pixelPosition` (pixels from left)
- Enables fully custom styling and formatting

**Implementation Details:**
- Dynamic padding calculation based on duration for timestamp overflow prevention
- Timestamps offset 4px from tick marks for better readability
- Font size 0.75rem to prevent overflow on longer timestamps
- Full color customization for dark/light themes

**Example (Dark Theme):**
```typescript
const theme = {
  waveOutlineColor: '#1e3a5f',
  waveFillColor: '#5dade2',
  waveProgressColor: '#e74c3c',
  timeColor: '#ecf0f1',
  timescaleBackgroundColor: '#2c3e50',
  playheadColor: '#8b0000',
  selectionColor: 'rgba(231, 76, 60, 0.5)',
};
```

**Location:**
- Waveform component: `packages/browser/src/components/Waveform.tsx`
- TimeScale component: `packages/ui-components/src/components/TimeScale.tsx`
- Playlist component: `packages/ui-components/src/components/Playlist.tsx`
- Example: `packages/browser/src/flexible-example-app.tsx`

## Optional Packages Architecture (2025-01-19)

### Decision: Annotations as Optional Package

**Rationale:**
- Annotations are used by a minority of users (subtitle/transcript editing, audio labeling)
- Including annotation components in core adds ~50KB to bundle size
- Many users don't need annotation functionality

**Implementation:**
- Moved all annotation components, hooks, and logic to `@waveform-playlist/annotations` package
- Users install only if needed: `npm install @waveform-playlist/annotations`
- Core waveform-playlist remains lean for basic use cases

### Annotations Package Architecture

**Location:** `packages/annotations/`

**Structure:**
```
packages/annotations/
├── src/
│   ├── components/          # React components
│   │   ├── Annotation.tsx
│   │   ├── AnnotationBox.tsx
│   │   ├── AnnotationBoxesWrapper.tsx
│   │   ├── AnnotationsTrack.tsx
│   │   ├── AnnotationText.tsx
│   │   ├── ContinuousPlayCheckbox.tsx
│   │   └── LinkEndpointsCheckbox.tsx
│   ├── hooks/               # Custom hooks
│   │   └── useAnnotationControls.ts
│   ├── types/               # TypeScript types
│   │   └── index.ts
│   ├── parsers/             # Import/export
│   │   └── aeneas.ts
│   └── index.ts             # Public exports
├── package.json
└── tsconfig.json
```

**Peer Dependencies:**
- `react` ^18.0.0
- `styled-components` ^6.0.0

**Regular Dependencies:**
- `@waveform-playlist/core` - Core types
- `@waveform-playlist/ui-components` - Playlist context, utilities

### useAnnotationControls Hook

**Purpose:** Manages annotation control state and boundary update logic.

**Features:**
- `continuousPlay` state - Whether playback continues after an annotation
- `linkEndpoints` state - Whether adjacent annotation boundaries move together
- `updateAnnotationBoundaries()` - Complex boundary logic with:
  - Linked endpoints (when boundaries touch, they move together)
  - Collision detection (prevents overlapping annotations)
  - Cascading updates (multiple annotations adjust together)

**API:**
```typescript
interface UseAnnotationControlsOptions {
  initialContinuousPlay?: boolean;
  initialLinkEndpoints?: boolean;
}

interface UseAnnotationControlsReturn {
  continuousPlay: boolean;
  linkEndpoints: boolean;
  setContinuousPlay: (value: boolean) => void;
  setLinkEndpoints: (value: boolean) => void;
  updateAnnotationBoundaries: (params: AnnotationUpdateParams) => Annotation[];
}

const useAnnotationControls = (
  options?: UseAnnotationControlsOptions
): UseAnnotationControlsReturn;
```

**Usage Example:**
```typescript
import { useAnnotationControls, ContinuousPlayCheckbox, LinkEndpointsCheckbox }
  from '@waveform-playlist/annotations';

function AnnotationControls() {
  const {
    continuousPlay,
    linkEndpoints,
    setContinuousPlay,
    setLinkEndpoints,
    updateAnnotationBoundaries,
  } = useAnnotationControls({
    initialContinuousPlay: false,
    initialLinkEndpoints: true,
  });

  // Use in drag handlers
  const handleDrag = (annotationIndex, newTime, isDraggingStart) => {
    const updated = updateAnnotationBoundaries({
      annotationIndex,
      newTime,
      isDraggingStart,
      annotations,
      duration,
    });
    setAnnotations(updated);
  };

  return (
    <>
      <ContinuousPlayCheckbox
        checked={continuousPlay}
        onChange={setContinuousPlay}
      />
      <LinkEndpointsCheckbox
        checked={linkEndpoints}
        onChange={setLinkEndpoints}
      />
    </>
  );
}
```

**Benefits:**
- Extracted ~110 lines of complex logic from WaveformPlaylistComponent
- Reusable across different components
- Testable independently
- Type-safe with full TypeScript support
- No DOM manipulation - pure React pattern

**Integration:**
The `WaveformPlaylistComponent` uses this hook internally and renders the React checkbox components, replacing the old DOM manipulation approach.

**Documentation:**
- See `OPTIONAL_PACKAGES.md` for installation and usage guide
- Example: `ghpages/_examples/13annotations.html`

## Component Design Decisions

### AudioPosition Component Styling (2025-01-20)

**Decision:** AudioPosition should display as plain monospace text, not as a button-like element.

**Reasoning:**
- Component displays read-only information (current playback time)
- Button-like appearance (background, border, padding) suggests interactivity
- Users were confused by visual weight - looked clickable but isn't
- Plain text styling is more semantically correct for read-only display

**Implementation:**
Located in `packages/ui-components/src/components/AudioPosition.tsx`

**Styling:**
```typescript
const PositionDisplay = styled.span`
  font-family: 'Courier New', Monaco, monospace;
  font-size: 1rem;
  font-weight: 600;
  color: #333;
  user-select: none;
`;
```

**Removed Properties:**
- ~~`background: #f8f9fa`~~ (light gray background)
- ~~`border: 1px solid #ced4da`~~ (gray border)
- ~~`padding: 0.375rem 0.75rem`~~ (padding)
- ~~`border-radius: 0.25rem`~~ (rounded corners)
- ~~`min-width: 120px`~~ (fixed width)
- ~~`text-align: center`~~ (centering)

**Impact:**
- Cleaner, more minimal UI
- Consistent with text-only display pattern
- No breaking changes - still accepts `className` prop for custom styling
- Used in all React example apps (effects, annotations, flexible-api, stem-tracks)

## Example Pages Setup

### Annotations Example Data Loading (2025-01-20)

**Important:** The annotations example requires loading annotation data before the React bundle.

**Setup:**
File: `ghpages/_examples/13annotations.html`

```html
---
javascript: annotations-bundle.js
---

<script src="js/annotations.js"></script>  <!-- Load data first -->
<div id="playlist"></div>                   <!-- React mounts here -->
```

**Why:**
- The React app (`annotations-app.tsx`) expects a global `notes` variable
- `annotations.js` defines this variable with the annotation data
- Must be loaded before `annotations-bundle.js` executes
- The footer.html conditionally loads the correct bundle based on `javascript:` value

**Data Format:**
The `notes` array contains Aeneas JSON format annotations:
```javascript
var notes = [
  {
    "begin": "0.000",
    "end": "2.680",
    "id": "f000001",
    "language": "eng",
    "lines": ["1"]
  },
  // ... more annotations
];
```

**Why Not Bundle Data:**
- Keeps data separate for easy editing/testing
- Users may want to load different annotation sets dynamically
- Maintains compatibility with existing annotation workflow

## Current Work (Tone.js Overhaul Branch)

### Status
- React refactor in progress
- Annotations and stem-tracks examples working with React
- Selection inputs implemented and functional
- **Custom hooks architecture implemented**
- **Flexible/headless API architecture implemented**
- **Complete theming system implemented**
- **Custom timestamp rendering implemented**
- **Annotations package as optional dependency implemented**
- **useAnnotationControls hook implemented**
- **Audio effects hooks implemented** (useMasterAnalyser, useTrackReverb, useTrackAutoWah, useEffectsChain)
- **AudioPosition component styling updated** (text-only display)
- Track controls with mute/solo/volume/pan working
- Stop button remembers start position behavior fixed

### Next Steps / Ideas
- Consider creating more optional packages (effects, fades, etc.)
- Build out primitives library as needed
- Add more examples showing different layout patterns
- Document all hooks and components in detail
- Add unit tests for hooks and components

## Important Notes

- **Don't remove old examples** - They're still in use during migration
- **Bundle size matters** - This is a library, not an app
- **Users need flexibility** - Don't lock them into specific UI patterns
- **Accessibility is important** - Use headless UI libs where complex a11y is needed

## References

- Main branch: `main`
- Current work: `tonejs-overhaul`
- Example pages served at: `http://localhost:4000/waveform-playlist/`

## Performance Optimizations (2025-11-20)

### Playhead Animation with GPU Acceleration

**Issue:** Playhead animation was janky when zoomed in, especially with automatic scroll enabled.

**Solution:** Changed from CSS `left` positioning to `transform: translate3d()` for GPU-accelerated rendering.

**Implementation:**
```typescript
// In Playhead.tsx
const PlayheadLine = styled.div.attrs<PlayheadLineProps>((props) => ({
  style: {
    transform: `translate3d(${props.$position}px, 0, 0)`,
  },
}))<PlayheadLineProps>`
  position: absolute;
  top: 0;
  left: 0;
  width: 2px;
  background: ${(props) => props.$color};
  height: 100%;
  z-index: 150;
  pointer-events: none;
  will-change: transform;
`;
```

**Benefits:**
- GPU-accelerated rendering (no layout/paint operations)
- Smooth 60fps animation even when zoomed in
- Added `will-change: transform` for browser optimization hints

**Location:** `packages/ui-components/src/components/Playhead.tsx`

### Zoom Performance Fixes (2025-11-20)

**Issue 1:** Zooming during playback would break/stop audio playback.

**Root Cause:** The audio loading `useEffect` had `samplesPerPixel` in its dependency array, causing complete audio reload and playout disposal on every zoom change.

**Solution:** Separated peak generation from audio loading:

```typescript
// Audio loading - only depends on tracks
useEffect(() => {
  // Load audio buffers and create playout
  // Generate initial peaks
}, [tracks, onReady]);

// Peak regeneration - depends on zoom
useEffect(() => {
  if (audioBuffers.length === 0) return;
  const peaks = audioBuffers.map(buffer => generatePeaks(buffer, samplesPerPixel, mono, bits));
  setPeaksDataArray(peaks);
}, [audioBuffers, samplesPerPixel, mono]);
```

**Issue 2:** Zooming with automatic scroll enabled caused jarring jumps.

**Root Cause:** Pixel position calculations changed dramatically when `samplesPerPixel` changed, causing scroll to jump.

**Solution:** Proportional scroll adjustment that maintains visual center:

```typescript
// Track current samplesPerPixel in a ref
const samplesPerPixelRef = useRef<number>(initialSamplesPerPixel);

// Adjust scroll proportionally when zoom changes
useEffect(() => {
  if (!scrollContainerRef.current || !audioBuffers.length) return;

  const oldSamplesPerPixel = samplesPerPixelRef.current;
  const newSamplesPerPixel = samplesPerPixel;

  // Calculate what time is currently at center of viewport
  const centerPixel = currentScrollLeft + containerWidth / 2 - controlWidth;
  const centerTime = (centerPixel * oldSamplesPerPixel) / sampleRate;

  // Adjust scroll to keep same center time after zoom
  const newCenterPixel = (centerTime * sampleRate) / newSamplesPerPixel;
  const newScrollLeft = newCenterPixel + controlWidth - containerWidth / 2;

  container.scrollLeft = newScrollLeft;
  samplesPerPixelRef.current = newSamplesPerPixel;
}, [samplesPerPixel, audioBuffers, controls]);

// Animation loop uses ref for stable value
const pixelPosition = (time * sr) / samplesPerPixelRef.current;
```

**Benefits:**
- Zoom works smoothly during playback without interrupting audio
- Automatic scroll maintains visual center when zooming
- No jarring jumps or position changes

**Location:** `packages/browser/src/WaveformPlaylistContext.tsx`

### Automatic Scroll Configuration (2025-11-20)

**Added:** `automaticScroll` prop to `WaveformPlaylistProvider` for enabling automatic scroll by default.

**Implementation:**
```typescript
// In WaveformPlaylistProviderProps
automaticScroll?: boolean;

// Usage in provider
const [isAutomaticScroll, setIsAutomaticScroll] = useState(automaticScroll);

// Usage in example
<WaveformPlaylistProvider
  tracks={tracks}
  automaticScroll={true}  // Enabled by default
  // ... other props
>
```

**Location:** `packages/browser/src/WaveformPlaylistContext.tsx`

## Example Migrations (2025-11-20)

### New Tracks Example with Provider Pattern

**Converted:** `newtracks-app.tsx` to use modern provider pattern instead of old component.

**Features Added:**
- Drag & drop file upload
- Dynamic track loading
- TrackControlsWithDelete component (compact layout with trash icon)
- Playback controls (Play, Pause, Stop)
- Zoom controls with smooth performance
- Audio position display
- Automatic scroll (enabled by default)
- Master volume control
- Track controls (Mute, Solo, Volume, Pan, Delete)

**New Component Created:** `TrackControlsWithDelete`
- Location: `packages/ui-components/src/components/TrackControlsWithDelete.tsx`
- Compact header layout: trash icon, track name, M/S buttons
- Volume and pan sliders below header
- Uses standard Button and ButtonGroup components
- Integrates with WaveformPlaylistProvider context

**Layout:**
```typescript
<Container>
  <DropZone /> {/* Drag & drop UI */}

  <WaveformPlaylistProvider
    tracks={tracks}
    samplesPerPixel={2048}
    mono={true}
    waveHeight={120}
    automaticScroll={true}
    controls={{ show: true, width: 200 }}
  >
    <Controls>
      <ControlGroup>
        <PlayButton />
        <PauseButton />
        <StopButton />
      </ControlGroup>
      <ControlGroup>
        <ZoomInButton />
        <ZoomOutButton />
      </ControlGroup>
      <ControlGroup>
        <AudioPosition />
      </ControlGroup>
      <ControlGroup>
        <AutomaticScrollCheckbox />
      </ControlGroup>
    </Controls>

    <Waveform renderTrackControls={(trackIndex) => (
      <TrackControlsWithDelete ... />
    )} />
  </WaveformPlaylistProvider>
</Container>
```

### Stem Tracks Example Migration

**Converted:** `stem-tracks-app.tsx` from `WaveformPlaylistComponent` to provider pattern.

**Features:**
- All modern components (PlayButton, PauseButton, StopButton, etc.)
- Zoom controls with performance fixes
- Master volume control
- Automatic scroll checkbox
- Audio position display
- Standard track controls (Mute, Solo, Volume, Pan)

**Template Cleanup:**
- Removed old bootstrap buttons from `ghpages/_examples/04stemtracks.html`
- Now just `<div id="playlist"></div>` - React handles all UI

## Codebase Cleanup (2025-11-20)

### Removed Obsolete Files

**WaveformPlaylistComponent.tsx**
- Old React component wrapper (intermediate migration step)
- No longer used anywhere
- All examples now use WaveformPlaylistProvider pattern
- File deleted: `packages/browser/src/WaveformPlaylistComponent.tsx`

**Jekyll Include Fragments**
- All old control includes removed (no longer needed with React components)
- Deleted directories:
  - `ghpages/_includes/buttons/` (playback.html, zoom.html, fades.html, random.html, states.html)
  - `ghpages/_includes/forms/` (seek.html)
  - `ghpages/_includes/checkboxes/` (automaticscroll.html, continuousplay.html, linkendpoints.html)
  - `ghpages/_includes/sliders/` (mastergain.html)
  - `ghpages/_includes/timeformat.html`
- Kept essential includes: head.html, header.html, footer.html, cta.html, sponsors.html

**Simplified Footer Template**
- Already cleaned up in previous session
- Now just loads React bundle: `<script src="js/{{ page.javascript }}"></script>`

### Current Architecture

**Two API Patterns:**
1. **Old Class-Based API** (`WaveformPlaylistClass` in `index.tsx`)
   - Kept for backward compatibility
   - Used by existing users who haven't migrated

2. **New Provider Pattern** (Recommended)
   - `WaveformPlaylistProvider` + `Waveform` component
   - Primitive control components (PlayButton, PauseButton, etc.)
   - Maximum flexibility for custom layouts
   - All new examples use this pattern

## Current Work (Tone.js Overhaul Branch)

### Status
- React refactor in progress
- **All React examples migrated to provider pattern** (newtracks, stem-tracks, effects, annotations, flexible-api)
- **Performance optimizations completed** (GPU-accelerated playhead, smooth zoom, automatic scroll)
- **TrackControlsWithDelete component created** (compact, reusable)
- Selection inputs implemented and functional
- Custom hooks architecture implemented
- Flexible/headless API architecture implemented
- Complete theming system implemented
- Custom timestamp rendering implemented
- Annotations package as optional dependency implemented
- useAnnotationControls hook implemented
- Audio effects hooks implemented (useMasterAnalyser, useTrackReverb, useTrackAutoWah, useEffectsChain)
- AudioPosition component styling updated (text-only display)
- Track controls with mute/solo/volume/pan working
- Stop button remembers start position behavior fixed
- **Obsolete code removed** (WaveformPlaylistComponent, old Jekyll includes)

### Next Steps / Ideas
- Consider creating more optional packages (effects, fades, etc.)
- Build out primitives library as needed
- Add more examples showing different layout patterns
- Document all hooks and components in detail
- Add unit tests for hooks and components
- Consider migrating remaining old examples to provider pattern

## Important Notes

- **Don't remove old examples** - They're still in use during migration
- **Bundle size matters** - This is a library, not an app
- **Users need flexibility** - Don't lock them into specific UI patterns
- **Accessibility is important** - Use headless UI libs where complex a11y is needed
- **Performance is critical** - Use GPU acceleration (transform) instead of layout-triggering properties (left/top)
- **Separation of concerns** - Audio operations (loading/playback) separate from visualization operations (peak generation)

## References

- Main branch: `main`
- Current work: `tonejs-overhaul`
- Example pages served at: `http://localhost:4000/waveform-playlist/`

---

**Last Updated:** 2025-11-20
**Session Notes:** Major performance optimizations and example migrations. Fixed zoom breaking playback by separating audio loading from peak generation. Implemented GPU-accelerated playhead animation using `transform: translate3d()` instead of `left` for 60fps smoothness. Fixed zoom + automatic scroll interaction with proportional scroll adjustment that maintains visual center. Converted newtracks and stem-tracks examples to provider pattern. Created TrackControlsWithDelete component with compact layout and trash icon. Added `automaticScroll` prop to WaveformPlaylistProvider. Removed obsolete WaveformPlaylistComponent and all old Jekyll include fragments (buttons, forms, checkboxes, sliders). Cleaned up stem-tracks Jekyll template. All React examples now use modern provider pattern with full performance optimizations.
