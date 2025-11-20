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
│   ├── annotations/       # Annotation data structures
│   ├── browser/           # React apps & webpack bundles
│   ├── core/              # Core types and interfaces
│   ├── loaders/           # Audio file loaders
│   ├── playout/           # Audio playback (Tone.js wrapper)
│   ├── state/             # State management
│   ├── ui-components/     # Reusable React UI components
│   └── webaudio-peaks/    # Waveform peak generation
│
├── ghpages/               # Jekyll static site for examples
│   ├── _examples/         # Example page templates
│   ├── _includes/         # Reusable HTML includes (forms, buttons)
│   ├── js/                # Pre-built JavaScript bundles
│   └── media/             # Audio files for demos
│
├── _site/                 # Jekyll output (local dev)
├── dist/                  # Production build output
└── experiments/           # Experimental features/prototypes
```

## Package Descriptions

### 🎯 Core Packages

#### `@waveform-playlist/core`
- **Purpose:** Core TypeScript interfaces and types
- **Exports:** Track interface, common types
- **Dependencies:** None (pure types)
- **Used by:** All other packages

#### `@waveform-playlist/webaudio-peaks`
- **Purpose:** Generate waveform visualization data from audio buffers
- **Exports:** Peak data structures, peak generation functions
- **Key concept:** Converts AudioBuffer → peak data for canvas rendering
- **Dependencies:** Core

#### `@waveform-playlist/state`
- **Purpose:** State management utilities
- **Exports:** State types and helpers
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
  │   ├── Playhead.tsx
  │   ├── Selection.tsx
  │   ├── AnnotationBox.tsx
  │   └── TrackControls/
  ├── contexts/          # React contexts (theme, playlist info, playout)
  ├── utils/             # Utilities (time formatting, conversions)
  └── index.tsx          # Public API
  ```
- **Key components:**
  - `Playlist` - Main container component
  - `Track` - Individual waveform track
  - `SmartChannel` - Waveform rendering with device pixel ratio
  - `TimeInput` - Time value input with format support
  - `Playhead` - Playback position indicator
  - `Selection` - Selection overlay
  - `AnnotationBox` - Annotation display/editing

#### `@waveform-playlist/browser`
- **Purpose:** Browser-ready React applications and webpack bundles
- **Outputs:**
  - `waveform-playlist.js` - Main bundle
  - `annotations-bundle.js` - Annotations example bundle
- **Structure:**
  ```
  src/
  ├── index.tsx                      # Main entry point
  ├── annotations-app.tsx            # Annotations example app
  ├── WaveformPlaylistComponent.tsx  # Main React component
  ├── SelectionTimeInputsManager.tsx # HTML↔React bridge
  ├── peaksUtil.ts                   # Peak generation helper
  ├── hooks/                         # Custom hooks for logic extraction
  │   ├── usePlaybackControls.ts     # Play/pause/stop/seek
  │   ├── useTimeFormat.ts           # Time formatting
  │   ├── useZoomControls.ts         # Zoom in/out
  │   ├── useAudioPosition.ts        # Audio position display
  │   ├── useWaveformPlaylist.ts     # Composite hook
  │   ├── index.ts                   # Hook exports
  │   └── README.md                  # Hook API docs
  ├── components/                    # React components
  │   └── DefaultPlaylistControls.tsx
  └── examples/                      # Usage examples
      └── CustomControlsExample.tsx
  ```
- **Build:** Webpack production builds → `ghpages/js/`

### 🔊 Audio Layer

#### `@waveform-playlist/playout`
- **Purpose:** Audio playback abstraction using Tone.js
- **Key class:** `TonePlayout`
- **Features:**
  - Play/pause/stop control
  - Seeking
  - Timed segment playback
  - Track mixing
- **Dependencies:** Tone.js, Core

#### `@waveform-playlist/loaders`
- **Purpose:** Load audio files from various sources
- **Exports:** Audio loading utilities
- **Dependencies:** Core

### 📝 Data Layer

#### `@waveform-playlist/annotations`
- **Purpose:** Annotation data structures and types
- **Exports:** Annotation interfaces
- **Used in:** Annotations example, subtitle/transcript features

## Data Flow Architecture

### Old Architecture (jQuery/emitter.js)

```
User Interaction (DOM Events)
    ↓
EventEmitter (emitter.js)
    ↓
jQuery DOM Manipulation
    ↓
Web Audio API (direct)
```

**Files:**
- `ghpages/js/emitter.js` - Central event coordinator
- `ghpages/js/annotations.js` - Annotations data
- HTML templates with inline event listeners

### New Architecture (React + Hooks)

```
User Interaction (React Events)
    ↓
WaveformPlaylistComponent (State)
    ↓
├─→ Custom Hooks (Business Logic)
│   ├─→ usePlaybackControls
│   ├─→ useTimeFormat
│   ├─→ useZoomControls
│   └─→ useAudioPosition
│
├─→ UI Components (React)
│   └─→ Canvas Rendering (SmartChannel)
│
└─→ TonePlayout (Tone.js)
    └─→ Web Audio API
```

**Key Files:**
- `packages/browser/src/WaveformPlaylistComponent.tsx` - Main orchestrator
- `packages/browser/src/hooks/` - Reusable business logic
- `packages/ui-components/src/components/Playlist.tsx` - UI container
- `packages/playout/src/TonePlayout.ts` - Audio playback

## State Management

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

State lives in `WaveformPlaylistComponent`:
```typescript
const [currentTime, setCurrentTime] = useState(0);
const [duration, setDuration] = useState(0);
const [isPlaying, setIsPlaying] = useState(false);
const [selectionStart, setSelectionStart] = useState(0);
const [selectionEnd, setSelectionEnd] = useState(0);
const [annotations, setAnnotations] = useState<AnnotationData[]>([]);
const [activeAnnotationId, setActiveAnnotationId] = useState<string | null>(null);
```

The component uses the custom hooks internally:
```typescript
const { timeFormat, formatTime } = useTimeFormat();
const zoom = useZoomControls({ initialSamplesPerPixel });
useAudioPosition({ currentTime, formatTime });
```

### Refs for Performance
```typescript
const playoutRef = useRef<TonePlayout | null>(null);
const currentTimeRef = useRef<number>(0);  // For animation loop
const isSelectingRef = useRef(false);       // For mouse interactions
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

### 2. Webpack Bundles (browser package)
```bash
# Auto-runs during pnpm build
webpack --mode production
```

Outputs:
- `packages/browser/dist/waveform-playlist.js`
- `packages/browser/dist/annotations-bundle.js`

These are copied to:
- `ghpages/js/` (for Jekyll)

### 3. Jekyll Site
```bash
jekyll build -s ghpages -d _site        # Local dev
jekyll build -s ghpages -d dist/waveform-playlist  # Production
```

## Key Integration Points

### 1. Selection Time Inputs (HTML ↔ React Bridge)

**Problem:** Jekyll templates have HTML inputs, React components need to control them

**Solution:** `SelectionTimeInputsManager`
```
HTML Template (timeformat.html)
    ↓
  <input id="audio_start">  ← Original HTML
    ↓
SelectionTimeInputsManager  ← Replaces with React
    ↓
  <TimeInput />  ← React component
    ↓
WaveformPlaylistComponent  ← State updates
```

### 2. Event Emitter → React Events (Migration)

**Old:**
```javascript
ee.on('select', (start, end) => {
  updateInputs(start, end);
});
```

**New:**
```typescript
const handleMouseUp = (e: MouseEvent) => {
  setSelectionStart(start);
  setSelectionEnd(end);
};
```

### 3. Audio Playback Flow

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

### Annotations Example

1. **HTML Template:** `ghpages/_examples/13annotations.html`
   - Includes layout, forms, buttons
   - Loads `annotations-bundle.js`

2. **JavaScript Entry:** `packages/browser/src/annotations-app.tsx`
   - Initializes React app
   - Loads annotation data (`notes`)
   - Mounts `WaveformPlaylistComponent`

3. **React Render:**
   ```tsx
   <WaveformPlaylistComponent
     tracks={[{ src: 'media/audio/sonnet.mp3' }]}
     annotationList={{ annotations: notes, ... }}
   />
   ```

4. **Component Lifecycle:**
   - Load audio → decode → generate peaks
   - Initialize TonePlayout
   - Mount SelectionTimeInputsManager
   - Attach button event listeners
   - Render waveform canvas

## Migration Status

### ✅ Completed (React)
- **Custom Hooks Architecture** - Reusable hooks for building custom UIs
  - `usePlaybackControls`, `useTimeFormat`, `useZoomControls`, `useAudioPosition`
  - `useWaveformPlaylist` composite hook
  - Full API documentation and examples
- Annotations example
- Selection time inputs
- Playback controls (play/pause/stop/seek)
- Waveform rendering
- Automatic scroll
- Track controls (mute/solo/volume/pan)
- Stem-tracks example

### 🚧 In Progress
- Render props support for custom components
- Theme system
- Design tokens
- More examples

### 🔮 Planned
- Additional hooks (`useTrackControls`, `useSelection`, `useAnnotations`, `useKeyboardShortcuts`)

### ❌ Not Started (Still jQuery)
- Most other examples (fades, effects, etc.)
- Some advanced features

## Development Workflow

### Local Development
```bash
# Terminal 1: Watch mode (if needed)
pnpm dev

# Terminal 2: Jekyll server
jekyll serve -s ghpages --livereload

# Terminal 3: Build after changes
pnpm build && jekyll build -s ghpages -d _site
```

### Testing Changes
1. Edit code in `packages/`
2. Run `pnpm build`
3. Rebuild Jekyll site
4. Hard refresh browser (Cmd+Shift+R)
5. Check `http://localhost:4000/waveform-playlist/annotations.html`

## Important Files

### Configuration
- `pnpm-workspace.yaml` - Workspace configuration
- `package.json` - Root package, scripts
- `tsconfig.json` - TypeScript base config
- `packages/*/tsup.config.ts` - Build configs
- `packages/browser/webpack.config.js` - Bundle config

### Jekyll
- `ghpages/_config.yml` - Jekyll configuration
- `ghpages/_layouts/page.html` - Page template
- `ghpages/_includes/` - Reusable HTML snippets

### Entry Points
- `packages/browser/src/index.tsx` - Main bundle entry
- `packages/browser/src/annotations-app.tsx` - Annotations entry
- `packages/ui-components/src/index.tsx` - Component library exports

### Documentation
- `packages/browser/HOOKS_ARCHITECTURE.md` - Hooks architecture overview
- `packages/browser/src/hooks/README.md` - Hooks API documentation
- `CLAUDE.md` - AI development notes and architectural decisions
- `PROJECT_STRUCTURE.md` - This file

## Custom Hooks Architecture

The playlist has been refactored to use a **custom hooks architecture** that separates business logic from UI presentation.

### Benefits

1. **Separation of Concerns** - Logic extracted into reusable hooks, UI can be completely customized
2. **Type Safety** - Full TypeScript support with auto-completion
3. **Flexibility** - Users can build any UI using their own component library
4. **Testability** - Hooks can be tested independently from presentation
5. **Backward Compatibility** - Still works with existing HTML structure

### Usage Patterns

**Option 1: Use individual hooks**
```typescript
import { usePlaybackControls, useTimeFormat } from '@waveform-playlist/browser/hooks';

const { play, pause, stop } = usePlaybackControls({ playoutRef });
const { formatTime } = useTimeFormat();
```

**Option 2: Use composite hook**
```typescript
import { useWaveformPlaylist } from '@waveform-playlist/browser/hooks';

const controls = useWaveformPlaylist({ playoutRef, currentTime, duration, ... });
// Access: controls.playback, controls.zoom, controls.timeFormat, controls.state
```

**Option 3: Future render props pattern**
```typescript
<WaveformPlaylist
  tracks={tracks}
  renderControls={(controls) => <MyCustomControls {...controls} />}
/>
```

### Example Components

- `DefaultPlaylistControls.tsx` - Reference implementation showing hook usage
- `CustomControlsExample.tsx` - Fully styled custom player with progress bar

See `packages/browser/HOOKS_ARCHITECTURE.md` for complete documentation.

## Future Improvements

See `CLAUDE.md` for architectural decisions and next steps:
- Theme/design tokens system
- Radix UI for complex components
- More React examples
- Component library documentation

---

**Last Updated:** 2025-01-19 (Added custom hooks architecture documentation)
