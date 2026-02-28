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

**Current Phase:** v5.0.0 Stable

**Semantic Versioning:** Now that v5 is released, follow semver for all changes. Breaking changes require a major version bump.

**Key Milestones Completed:**

- ✅ Phase 1: Foundation (React refactor, provider pattern, all core features)
- ✅ Phase 1.5: Bundle Optimization (tree-shaking, 23KB gzipped savings)
- ✅ Phase 2: Clip-Based Model (multiple clips per track)
- ✅ Phase 3.1a/b: Drag & Trim (real-time collision detection, bidirectional trimming)
- ✅ Phase 3.3: Splitting Clips (sample-based architecture, keyboard shortcuts)
- ✅ Audio Effects: 20 Tone.js effects with UI, runtime parameters, WAV export

## Publishing Convention

**Stable Releases:** Publish without tag to update `@latest`.

```bash
# Publish stable release (all packages)
pnpm publish --filter './packages/*' --no-git-checks

# Users install with:
npm install @waveform-playlist/browser
```

**Version Bumping:** All 12 `package.json` files (root + 11 packages) must be bumped in sync:

```bash
sed -i '' 's/"version": "OLD"/"version": "NEW"/g' package.json packages/*/package.json
```

**First-time scoped packages:** New `@waveform-playlist/*` packages need `--access public` on first npm publish:

```bash
pnpm publish --filter @waveform-playlist/NEW-PACKAGE --no-git-checks --access public
```

**Prerelease Tag:** Use `@next` for prerelease versions when preparing future major releases.

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

### Documentation Maintenance

**API Source of Truth:**

- Context types (hooks, state, controls): `packages/browser/src/WaveformPlaylistContext.tsx`
- Context hooks: `usePlaybackAnimation`, `usePlaylistState`, `usePlaylistControls`, `usePlaylistData` (no combined hook — `useWaveformPlaylist` was removed in v6.0.2)
- MediaElement context types: `packages/browser/src/MediaElementPlaylistContext.tsx`
- AudioTrackConfig interface: `packages/browser/src/hooks/useAudioTracks.ts`
- Effects hooks return types: `packages/browser/src/hooks/useDynamicEffects.ts`, `useTrackDynamicEffects.ts`
- Peak types (`Peaks`, `Bits`, `PeakData`): `packages/core/src/types/index.ts` (re-exported by `webaudio-peaks` for backwards compat)

**Common Doc Drift:** Non-existent hooks (e.g., `useWaveformPlaylist` was removed), wrong property names (e.g., `gain` vs `volume`, `seek` vs `seekTo`), properties attributed to wrong context hooks. Always cross-check docs against source interfaces.

**Verify docs render:** `pnpm --filter website build` (CSS calc warnings are pre-existing, harmless)

**Moving/Renaming Doc Pages:** Run `pnpm --filter website build` after moving docs — Docusaurus broken link checker will find all internal links that need updating.

**LLM-Readable Docs:**

- `website/static/llms.txt` — Library discovery page, served at `/llms.txt`. Update when packages, architecture, or key APIs change.
- `website/docs/api/llm-reference.md` — All TypeScript interfaces from source, no prose. Update when any context type, hook signature, or component prop changes.
- **Keep both in sync** — When adding new providers or components, update both `llms.txt` and `llm-reference.md`.
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
- **Use `.attrs()` for frequently changing props** — props that change on every render (positions, sizes, colors) must use `.attrs()` with a `style` object. Putting them in the template literal generates a new CSS class per render, causing "over 200 classes generated" warnings and memory bloat.

  ```typescript
  // ✅ GOOD - inline style via .attrs(), single CSS class reused
  const Box = styled.div.attrs<{ $left: number }>((props) => ({
    style: { left: `${props.$left}px` },
  }))<{ $left: number }>`
    position: absolute;
  `;

  // ❌ BAD - new CSS class generated on every render
  const Box = styled.div<{ $left: number }>`
    position: absolute;
    left: ${(props) => props.$left}px;
  `;
  ```

### Building and Testing

- **Build packages**: `pnpm build` - Build all packages
- **TypeScript check**: `pnpm typecheck` (enforced in build scripts)
- **Lint**: `pnpm lint` - ESLint across all packages. **Always run before committing.** This is a root-only script; run from repo root or use `pnpm -w lint`.
- **Dev server**: `pnpm --filter website start` - Docusaurus dev server
- **Unit tests**: Run from each package directory with `npx vitest run` (engine, core, playout, ui-components)
- **Hard refresh**: Always use Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) after builds

**CI Validation:** `.github/workflows/ci.yml` runs on PRs to `main`: build, lint, and `prettier --check`. Format code with `pnpm format` before pushing.

**pnpm Build Ordering:** `pnpm recursive run` determines build order from `dependencies` and `devDependencies` only — **not** `peerDependencies`. If package A needs package B's types at build time (e.g., for DTS generation), B must be in A's `devDependencies` even if it's already a `peerDependency`. Without this, CI builds fail because packages build in parallel/alphabetical order.

**Type Migration Gotcha:** When moving types between packages, `pnpm typecheck` resolves workspace packages via `dist/` (not source). Build the source package first: `pnpm --filter @waveform-playlist/PACKAGE build` before `pnpm typecheck`. Also grep the entire repo for old import paths — easy to miss straggling imports.

### E2E Testing with Playwright

- **Run tests**: `pnpm test`, `pnpm test:ui` (interactive), `pnpm test:headed` (visible browser)
- **Config**: `playwright.config.ts` - uses `BASE_PATH` and `PORT` env vars
- **Location**: `e2e/` directory

**Key Selectors:** `[data-clip-id]`, `[data-boundary-edge]`, `[data-clip-container]`, `[data-scroll-container]`

**Preventing Flaky Tests:**

- Always `await expect(locator).toBeVisible()` before `boundingBox()` — returns null if element isn't laid out
- Use `await expect(locator).toHaveCount(n)` (auto-retrying) instead of `expect(await locator.count()).toBe(n)` (one-shot)
- Wrap post-interaction state checks with `await expect(async () => { ... }).toPass({ timeout: 5000 })` for timing tolerance
- Always rebuild (`pnpm build`) after switching branches before running tests — stale artifacts cause false failures

**Git Safety:** Always make intermediate commits before running `git stash` or switching branches. A failed `git stash pop` + `git checkout -- .` can destroy all uncommitted work permanently.

---

## Architectural Decisions

### Sample-Based Architecture (Phase 3.3)

**Decision:** Store all timing as integer sample counts, not floating-point seconds.

**Why:** Eliminates floating-point precision errors that cause pixel gaps between clips.

**Types:**

```typescript
interface AudioClip {
  startSample: number; // Position on timeline (samples)
  durationSamples: number; // Clip duration (samples)
  offsetSamples: number; // Start within audio file (samples)
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

### ESLint Baseline (2026-02-13)

**Decision:** Add a root flat ESLint config with TypeScript + React Hooks checks.

**Implementation:**

- Config file: `eslint.config.mjs`
- Root `package.json` devDependencies include:
  - `eslint`, `@eslint/js`
  - `@typescript-eslint/parser`, `@typescript-eslint/eslint-plugin`
  - `eslint-plugin-react-hooks`, `globals`

**Usage:** Run `pnpm lint` before committing. Catches missing hook dependencies, unused variables, and React Hooks rule violations.

### Docusaurus Native Examples

**Decision:** Docusaurus-native React components instead of Jekyll + separate bundles.

**Webpack Aliases:** In `website/docusaurus.config.ts`, packages transpiled from source:

- `@waveform-playlist/browser`, `core`, `playout`, `ui-components` → source
- `annotations`, `recording` → dist/ (have build artifacts like worklets)

**SSR/SSG Pattern:** Example components use browser APIs (AudioContext, Canvas, window) that aren't available during static site generation. Use lazy loading:

```typescript
// In example page files (website/src/pages/examples/*.tsx)
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyExample = createLazyExample(() =>
  import('../../components/examples/ExampleComponent').then((m) => ({
    default: m.ExampleComponent,
  }))
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

---

## Important Patterns

1. **Targeted Disconnect** - Always specify destination on shared audio nodes
2. **Refs in Animation Loops** - Use refs for synchronous checks in `requestAnimationFrame`
3. **AudioWorklet Debugging** - Use postMessage, not console.log
4. **Try-Catch Cleanup** - Wrap audio node disconnects for device switching
5. **Sample-Based Math** - Use integer samples for all timing calculations
6. **TypeScript Enforcement** - Build scripts run `pnpm typecheck &&` before bundling
7. **Refs for Dynamic Audio Callbacks** - When useCallback needs fresh state for audio graph rebuilding, store state in a ref and read from ref inside callback (avoids stale closures)
8. **Playlist Loading Detection** - Use `data-playlist-state` attribute and `waveform-playlist:ready` custom event for reliable loading detection in CSS, E2E tests, and external integrations
9. **Stable React Keys for Tracks/Clips** - Always use `track.id` / `clip.clipId` as React keys, never array indices. Index-based keys cause DOM reuse on removal, breaking `transferControlToOffscreen()` (can only be called once per canvas) and causing stale OffscreenCanvas references.
10. **Per-Track Maps Must Use Track ID** - Any `Map` storing per-track overrides (render modes, configs) must be keyed by `track.id` (string), not array index. Index keys break when tracks are added/removed.
11. **Context Value Memoization** - All context value objects in providers must be wrapped with `useMemo`. Extract inline callbacks into `useCallback` first to avoid dependency churn.
12. **Error Boundary Available** - `PlaylistErrorBoundary` from `@waveform-playlist/ui-components` catches render errors. Uses plain CSS (no styled-components) so it works without ThemeProvider.
13. **Audio Disconnect Diagnostics** - Use `console.warn('[waveform-playlist] ...')` in catch blocks for audio node disconnect errors, never silently swallow.
14. **Fetch Cleanup with AbortController** - `useAudioTracks` uses AbortController to cancel in-flight fetches on cleanup. Follow this pattern for any fetch in useEffect. For per-item abort (e.g., removing one loading track), use `Map<id, AbortController>` instead of `Set<AbortController>`.
15. **Derive Render Guards from Props, Not Effect State** - Don't use effect-set state (e.g., `audioBuffers`) in render guards. Effect state lags props by one+ renders, causing content to flash/disappear. Compute values synchronously from props instead.
16. **Copy Refs in useEffect Body** - When accessing a ref in `useEffect` cleanup, copy `.current` to a local variable inside the effect body. ESLint's `react-hooks/exhaustive-deps` rule flags refs that may change between render and cleanup.
17. **Refs from Custom Hooks in Dep Arrays** - When a `useRef` is returned from a custom hook, ESLint's `exhaustive-deps` can't trace its stability. Include it in the dep array (harmless, never triggers) rather than using `eslint-disable-next-line` which would mask real missing dependencies.
18. **Engine State Ownership** — Engine owns selection, loop, and selectedTrackId; React subscribes to statechange. Engine setters normalize invariants (start <= end). Control callbacks delegate to engine via `engineRef.current?.method()` — React state updated only via statechange subscription. Exception: `masterVolume` is still dual-written by `useMasterVolume` hook (consolidation planned for PR 2).

---

## Plans & Future Work

**Plans directory:** `plans/` contains future feature specs (waveform service, listening test tool).

**Deployment:** Site deploys automatically via GitHub Actions on push to `main`.

---

## References

- **Roadmap & Progress:** `TODO.md`
- **Architecture Details:** `PROJECT_STRUCTURE.md`
- **Debugging Guide:** `DEBUGGING.md`
- **Main branch:** `main`
- **Current work:** `tonejs-overhaul`
- **Dev server:** `http://localhost:3000/` (Docusaurus)

---

## Per-Package Documentation

Package-specific conventions, architecture, and patterns live in each package's own CLAUDE.md:

- `packages/engine/CLAUDE.md` — PlaylistEngine, PlayoutAdapter, operations
- `packages/playout/CLAUDE.md` — Tone.js adapter, AudioContext, ToneTrack internals
- `packages/browser/CLAUDE.md` — Hooks architecture, effects, animation, context providers
- `packages/ui-components/CLAUDE.md` — Theming, virtual scrolling, ClipViewportOrigin
- `packages/recording/CLAUDE.md` — AudioWorklets, Firefox compat, VU meter, mic access
- `packages/annotations/CLAUDE.md` — Integration context, annotation provider pattern
- `packages/spectrogram/CLAUDE.md` — Integration context, SpectrogramChannel index

---

**Last Updated:** 2026-02-28
