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
- `AudioPosition` - Current time display
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

---

**Last Updated:** 2025-01-19
**Session Notes:** Refactored annotations functionality into optional package `@waveform-playlist/annotations`. Created `useAnnotationControls` hook to manage annotation state and complex boundary logic (linked endpoints, collision detection, cascading updates). Moved all annotation components (Annotation, AnnotationBox, AnnotationBoxesWrapper, AnnotationsTrack, AnnotationText, ContinuousPlayCheckbox, LinkEndpointsCheckbox) to annotations package. Replaced DOM manipulation with pure React pattern. Created OPTIONAL_PACKAGES.md documentation. Bundle size reduction: users who don't need annotations save ~50KB. Hook architecture follows same pattern as other playlist hooks.
