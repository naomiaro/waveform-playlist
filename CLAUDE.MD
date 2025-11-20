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

## Current Work (Tone.js Overhaul Branch)

### Status
- React refactor in progress
- Annotations and stem-tracks examples working with React
- Selection inputs implemented and functional
- **Custom hooks architecture implemented**
- Track controls with mute/solo/volume/pan working

### Next Steps / Ideas
- Add render props support for custom control components
- Create more custom hooks (useTrackControls, useSelection, useAnnotations)
- Consider creating theme/design tokens system
- Evaluate Radix UI for complex components (sliders, dropdowns)
- Build out primitives library as needed
- Add more examples to React version
- Document hooks usage patterns

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
**Session Notes:** Implemented custom hooks architecture, refactored WaveformPlaylistComponent to use hooks internally, stem-tracks example with React track controls
