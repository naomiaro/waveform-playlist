# TODO & Roadmap

Multi-track audio editor roadmap for waveform-playlist.

**Branch:** `tonejs-overhaul` | **Last Updated:** 2025-11-25

---

## 🎯 Current Focus: Alpha Release Preparation

### Must Have Before Release

- [x] **Comprehensive README** - Quick start, installation, basic examples, screenshots
- [x] **TypeScript types validation** - No `any` in public APIs, verify .d.ts generation
- [ ] **Unit tests** - Hooks, components, audio processing (Vitest + RTL)
- [ ] **E2E tests** - Key workflows (Playwright)
- [ ] **Browser compatibility** - Chrome, Firefox, Safari, Edge
- [x] **NPM publishing setup** - Package.json exports, tree-shaking verification
- [ ] **CI/CD pipeline** - Automated builds, tests, publishing

### Nice to Have

- [ ] Migration guide from v4
- [ ] Contributing guidelines
- [ ] Bundle size monitoring
- [ ] Performance benchmarks
- [ ] Memory leak testing

---

## ✅ Completed Features

### Core (Phase 1) ✅

- WaveformPlaylistProvider with React Context
- Playback with Tone.js (play, pause, stop, seek)
- Waveform rendering with Canvas
- Track controls (mute, solo, volume, pan)
- Selection and time formatting
- Automatic scrolling
- GPU-accelerated playhead animation
- Theming system

### Recording ✅

- AudioWorklet-based recording
- VU meter with AnalyserNode
- Live waveform during recording
- Integrated multi-track recording (Audacity-style)
- Recording-optimized audio constraints

### Clip-Based Model (Phase 2) ✅

- Multiple clips per track
- Sample-based architecture (integer samples, not float seconds)
- File-reference loading pattern
- Gaps between clips render as silence

### Drag & Trim (Phase 3.1) ✅

- Drag clip headers to move
- Drag boundaries to trim (bidirectional)
- Real-time collision detection
- `useClipDragHandlers` hook

### Splitting (Phase 3.3) ✅

- Split clips at playhead with 'S' key
- `useClipSplitting` hook
- `useKeyboardShortcuts` hook
- Track selection system

### Effects ✅

- 20 Tone.js effects with UI
- Runtime parameter modification
- Effect bypass with wet preservation
- WAV export includes effects
- `useDynamicEffects` / `useTrackDynamicEffects` hooks

### Export ✅

- WAV export via Tone.Offline
- Master + per-track effects support
- Export all tracks as ZIP
- `useExportWav` hook

### Documentation ✅

- Docusaurus site with 10 examples
- Storybook with 32 story files
- Guides: effects, fades, waveform-data
- Dark/light theme support

### Other ✅

- Annotations package (optional)
- BBC waveform-data.js support
- Custom playhead component (`renderPlayhead` prop)
- Annotation keyboard navigation
- Simplified Fade API (`{duration, type?}`)

---

## 🔮 Future Phases (Post-Alpha)

### Phase 3.4-3.5: Copy/Paste & Multi-Select

- Clipboard operations (Cmd+C/X/V)
- Multi-select with Cmd+Click, Shift+Click
- Bulk drag/delete
- Selection toolbar

### Phase 4: Performance & Virtual Scrolling

- Horizontal virtual scrolling (2+ hour timelines)
- Vertical virtual scrolling (20+ tracks)
- RAF batching
- Canvas stitching

### Phase 5: Polish & Usability

- Undo/redo (command pattern)
- Snap to grid
- Keyboard shortcuts help overlay
- Accessibility (ARIA, focus management)
- Context menus

### Future Considerations

- Clip grouping
- Automation lanes
- Markers and regions
- MIDI/video sync
- Sticky clip header text (Intersection Observer to keep track name visible when scrolling)
- Revamp GitHub Sponsors tiers (via GitHub UI)

---

## 📦 Bundle Sizes

| Bundle      | Uncompressed | Gzipped |
| ----------- | ------------ | ------- |
| Core        | 507KB        | 132KB   |
| Stem-tracks | 509KB        | 150KB   |
| Effects     | 530KB        | 154KB   |
| Recording   | 524KB        | 154KB   |

Tree-shaking reduced bundles by 13% (23KB gzipped savings).

---

## 🏗️ Architecture Notes

**Hybrid Canvas + DOM:** Canvas for waveform rendering, DOM/React for interactions. Uses @dnd-kit (13KB) instead of heavy canvas libraries (200-500KB).

**Sample-Based Timing:** All clip positions stored as integer samples to avoid floating-point precision errors.

**Key Files:**

- Types: `packages/core/src/types/clip.ts`
- Context: `packages/browser/src/WaveformPlaylistContext.tsx`
- Hooks: `packages/browser/src/hooks/`
- Effects: `packages/browser/src/effects/`
- Components: `packages/ui-components/src/components/`
