# TODO & Roadmap

Project roadmap and task list for waveform-playlist.

**Branch:** `tonejs-overhaul` (React migration)
**Last Updated:** 2025-11-19

---

## 🔥 High Priority

### React Migration - Core Features

- [ ] Migrate remaining examples to React
  - [ ] Fades example
  - [ ] Effects example
  - [ ] Multi-channel example
  - [ ] Stem tracks example
  - [ ] Record example
- [ ] Remove/deprecate jQuery dependencies
- [ ] Complete EventEmitter → React events migration
- [ ] Create migration guide for users

### Critical Bugs/Issues

- [x] ~~Selection inputs reset to 0 on click~~ ✅ Fixed 2025-01-19
- [x] ~~Playback continues past selection end~~ ✅ Fixed 2025-01-19
- [ ] Test cross-browser compatibility (Safari, Firefox, Edge)
- [ ] Verify mobile/touch support

---

## 🎨 UI Components & Design System

### Component Library

- [x] ~~TimeInput component~~ ✅ Implemented 2025-01-19
- [x] ~~SelectionTimeInputs component~~ ✅ Implemented 2025-01-19
- [ ] Create design tokens system
  - [ ] `packages/ui-components/src/theme/tokens.ts`
  - [ ] Color palette
  - [ ] Typography scale
  - [ ] Spacing system
  - [ ] Border radius, shadows
- [ ] Build primitives library
  - [ ] Button component (primary, secondary, icon)
  - [ ] Input component (text, number)
  - [ ] Slider component
  - [ ] Dropdown/Select component
  - [ ] Toggle/Checkbox component
  - [ ] Tooltip component
  - [ ] Dialog/Modal component

### Evaluate Headless UI Libraries

- [ ] Prototype Radix UI for complex components
  - [ ] Slider (for volume, zoom controls)
  - [ ] Select/Dropdown (for time format)
  - [ ] Dialog (for settings/modals)
  - [ ] Tooltip
- [ ] Compare with React Aria
- [ ] Document decision and integration approach

### Accessibility (a11y)

- [ ] Keyboard navigation support
  - [ ] Play/pause (spacebar)
  - [ ] Seek (arrow keys)
  - [ ] Selection (shift + arrows)
- [ ] Screen reader support
  - [ ] ARIA labels for all interactive elements
  - [ ] Announce playback state changes
  - [ ] Waveform description
- [ ] Focus management
- [ ] High contrast mode support

---

## ⚡ Performance & Optimization

### Rendering

- [ ] Optimize waveform canvas rendering
- [ ] Debounce zoom/scroll operations
- [ ] Virtual scrolling for long tracks
- [ ] Canvas worker threads for peak generation
- [ ] Lazy load waveform data for large files

### Bundle Size

- [ ] Code splitting for examples
- [ ] Tree-shaking analysis
- [ ] Evaluate if Tone.js can be externalized
- [ ] Lazy load annotation features
- [ ] Current: ~1.5MB → Goal: <1MB

### Audio Performance

- [ ] Optimize Tone.js configuration
- [ ] Preload/buffer management
- [ ] Sample rate conversion strategy
- [ ] Memory management for large files

---

## 🧪 Testing

### Unit Tests

- [ ] Set up testing framework (Vitest or Jest)
- [ ] Test time formatting utilities
- [ ] Test peak generation
- [ ] Test audio playback logic
- [ ] Component unit tests

### Integration Tests

- [ ] User interaction flows
- [ ] Selection and playback
- [ ] Annotation editing
- [ ] Multi-track operations

### E2E Tests

- [ ] Playwright or Cypress setup
- [ ] Critical user journeys
- [ ] Cross-browser testing

---

## 📚 Documentation

### User Documentation

- [ ] Getting started guide
- [ ] Migration guide (v4 → v5)
- [ ] API reference
- [ ] Component showcase/Storybook
- [ ] Common recipes/patterns
- [ ] Troubleshooting guide

### Developer Documentation

- [x] ~~CLAUDE.md~~ ✅ Created 2025-01-19
- [x] ~~PROJECT_STRUCTURE.md~~ ✅ Created 2025-01-19
- [ ] Contributing guide
- [ ] Architecture decision records (ADRs)
- [ ] Code comments and TSDoc

### Examples

- [ ] Create CodeSandbox examples
- [ ] Video tutorials
- [ ] Blog posts/tutorials

---

## 🔧 Developer Experience

### Tooling

- [ ] Hot module replacement (HMR) for dev
- [ ] Better error messages
- [ ] Dev mode warnings for common mistakes
- [ ] TypeScript strict mode
- [ ] ESLint rules optimization

### Build System

- [ ] Optimize build times
- [ ] Parallel package building
- [ ] Watch mode improvements
- [ ] Source maps configuration

---

## 🎵 Features & Enhancements

### Audio Features

- [ ] Audio effects rack (EQ, compressor, reverb)
- [ ] Real-time waveform during recording
- [ ] Pitch shifting
- [ ] Time stretching
- [ ] Export to different formats (WAV, MP3, OGG)

### Annotation Features

- [ ] Annotation templates
- [ ] Import/export subtitle formats (SRT, VTT, ASS)
- [ ] Annotation search/filter
- [ ] Bulk annotation operations
- [ ] Speaker labels

### UI Features

- [ ] Minimap/overview panel
- [ ] Zoom to selection
- [ ] Undo/redo system
- [ ] Customizable keyboard shortcuts
- [ ] Themes (light/dark mode)
- [ ] Waveform color customization
- [ ] Markers/regions

### Collaboration

- [ ] Real-time collaborative editing
- [ ] Comments on annotations
- [ ] Version history

---

## 🌐 Platform Support

### Browsers

- [ ] Test and document browser support matrix
- [ ] Polyfills for older browsers
- [ ] Progressive enhancement strategy

### Mobile

- [ ] Touch gesture support
- [ ] Mobile-optimized UI
- [ ] Responsive layouts
- [ ] iOS audio quirks handling

### Frameworks

- [ ] Vue.js wrapper
- [ ] Angular wrapper
- [ ] Svelte wrapper
- [ ] Web Components version

---

## 📦 Distribution & Publishing

### NPM Packages

- [ ] Publish individual packages
- [ ] Semantic versioning strategy
- [ ] Changelog generation
- [ ] Release automation

### CDN

- [ ] Unpkg/jsDelivr setup
- [ ] Standalone bundle versions
- [ ] Legacy browser bundle

---

## 🔮 Future / Nice to Have

### Advanced Features

- [ ] MIDI support
- [ ] Video sync support
- [ ] Spectral display
- [ ] AI-powered transcription integration
- [ ] Plugin system for extensions

### Integrations

- [ ] DAW integration (Ableton Link)
- [ ] Cloud storage (Dropbox, Google Drive)
- [ ] Audio analysis (beat detection, key detection)

---

## ✅ Recently Completed

### 2025-01-19

- [x] Selection time inputs (React components)
- [x] Time formatting utilities
- [x] Fixed click clearing selection bug
- [x] Fixed playback beyond selection bug
- [x] Created CLAUDE.md
- [x] Created PROJECT_STRUCTURE.md
- [x] Created TODO.md
- [x] Documented UI library decision (no full UI lib)

---

## 🗂️ Backlog Organization

### Labels/Tags

- `migration` - React migration tasks
- `ui` - UI components and design
- `audio` - Audio playback and processing
- `docs` - Documentation
- `performance` - Optimization
- `a11y` - Accessibility
- `bug` - Bug fixes
- `enhancement` - New features

### Milestone Ideas

- **v5.0-alpha.1** - Core React migration complete
- **v5.0-alpha.2** - Design system implemented
- **v5.0-beta.1** - All examples migrated
- **v5.0-rc.1** - Testing and polish
- **v5.0.0** - Official React release

---

**Notes:**

- Keep this file updated as work progresses
- Move completed items to "Recently Completed"
- Add dates to completed items
- Break down large tasks into smaller subtasks
- Link to GitHub issues when created
