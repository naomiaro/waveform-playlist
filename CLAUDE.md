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

1. Update CLAUDE.md only if architectural decision or pattern established
2. Update PROJECT_STRUCTURE.md only if structure/architecture changed
3. Never add progress/changelog to PROJECT_STRUCTURE.md

### Documentation Maintenance

**API Source of Truth:**

- Context types (hooks, state, controls): `packages/browser/src/WaveformPlaylistContext.tsx`
- Context hooks: `usePlaybackAnimation`, `usePlaylistState`, `usePlaylistControls`, `usePlaylistData`
- MediaElement context types: `packages/browser/src/MediaElementPlaylistContext.tsx`
- AudioTrackConfig interface: `packages/browser/src/hooks/useAudioTracks.ts`
- Effects hooks return types: `packages/browser/src/hooks/useDynamicEffects.ts`, `useTrackDynamicEffects.ts`
- Peak types (`Peaks`, `Bits`, `PeakData`): `packages/core/src/types/index.ts` (re-exported by `webaudio-peaks` for backwards compat)

**Common Doc Drift:** Docs may reference deleted hooks, wrong property names (e.g., `gain` vs `volume`, `seek` vs `seekTo`), or properties attributed to wrong context hooks. Always cross-check docs against source interfaces.

**Verify docs render:** `pnpm --filter website build` (CSS calc warnings are pre-existing, harmless)

**Moving/Renaming Doc Pages:** Run `pnpm --filter website build` after moving docs — Docusaurus broken link checker will find all internal links that need updating.

**Avoid Duplicating Code in Example Pages:** Example pages (`website/src/pages/examples/`) should link to guide docs for code walkthroughs, not inline full code blocks. Duplication creates maintenance burden when APIs change.

**LLM-Readable Docs:**

- `website/static/llms.txt` — Library discovery page, served at `/llms.txt`. Update when packages, architecture, or key APIs change.
- `website/docs/api/llm-reference.md` — All TypeScript interfaces from source, no prose. Update when any context type, hook signature, or component prop changes.
- **Keep all doc surfaces in sync** — When adding new context fields, hook returns, or component props, update: (1) `llm-reference.md` (interfaces), (2) `llms.txt` (descriptions), (3) `docs/api/hooks.md` (context value interfaces), (4) `docs/examples.md` (code snippets), (5) example page files in `src/pages/examples/` (keyboard shortcuts sections, feature lists).

---

## Code Conventions

### No Cross-Package Re-Exports

**Rule:** Packages must not re-export symbols from other packages. Consumers import from the canonical source directly. This prevents transitive dependency issues (e.g., #373 where dawcore pulled in React via recording's re-exports). When moving functions between packages, update all import sites — don't leave re-exports for backwards compat.

### Declarative Over Imperative

**Rule:** Consumer code should read as a declaration of what they want, not how to set it up. When multiple hooks/providers must be wired together, create a higher-level component that reads from context internally and exposes simple boolean props.

**Examples:** `ClipInteractionProvider` (replaces DragDropProvider + sensors + modifiers + handlers), `KeyboardShortcuts` (replaces usePlaybackShortcuts + useClipSplitting + useAnnotationKeyboardControls wiring), `ClearAllButton` (wraps stop + clear). Keep the low-level hooks exported for power users who need custom behavior.

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
- **Lint**: `pnpm lint` - Prettier check + ESLint across all packages. **Always run before committing.** This is a root-only script; run from repo root or use `pnpm -w lint`. Fix formatting issues with `pnpm format`.
- **New packages**: After adding a new `packages/*/package.json`, run `pnpm install` and commit `pnpm-lock.yaml`. CI uses `--frozen-lockfile` and will fail if the lockfile is stale.
- **Dev server**: `pnpm --filter website start` - Docusaurus dev server
- **Unit tests**: Run from each package directory with `npx vitest run` (engine, core, playout, ui-components, browser)
- **Hard refresh**: Always use Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) after builds
- **Vitest cleanup:** `npx vitest run` in pnpm monorepos can leave orphaned Node processes at ~100% CPU. After running tests across multiple packages, verify with `pgrep -f vitest` and kill strays with `pkill -f vitest` if needed.

**CI Validation:** `.github/workflows/ci.yml` runs on PRs to `main`: build and lint (includes prettier check). Fix formatting with `pnpm format` before pushing.

**pnpm Build Ordering:** `pnpm recursive run` determines build order from `dependencies` and `devDependencies` only — **not** `peerDependencies`. If package A needs package B's types at build time (e.g., for DTS generation), B must be in A's `devDependencies` even if it's already a `peerDependency`. Without this, CI builds fail because packages build in parallel/alphabetical order.

**Type Migration Gotcha:** When moving types between packages, `pnpm typecheck` resolves workspace packages via `dist/` (not source). Build the source package first: `pnpm --filter @waveform-playlist/PACKAGE build` before `pnpm typecheck`. Also grep the entire repo for old import paths — easy to miss straggling imports.

### E2E Testing with Playwright

- **Run tests**: `pnpm test`, `pnpm test:ui` (interactive), `pnpm test:headed` (visible browser). The `test` script is root-only — use `pnpm -w run test` from package directories.
- **Config**: `playwright.config.ts` - uses `BASE_PATH` and `PORT` env vars
- **Location**: `e2e/` directory

**Key Selectors:** `[data-clip-id]`, `[data-boundary-edge]`, `[data-clip-container]`, `[data-scroll-container]`

**Preventing Flaky Tests:**

- Always `await expect(locator).toBeVisible()` before `boundingBox()` — returns null if element isn't laid out
- Use `await expect(locator).toHaveCount(n)` (auto-retrying) instead of `expect(await locator.count()).toBe(n)` (one-shot)
- Wrap post-interaction state checks with `await expect(async () => { ... }).toPass({ timeout: 5000 })` for timing tolerance
- Always rebuild (`pnpm build`) after switching branches before running tests — stale artifacts cause false failures
- Wrap `boundingBox()` in `await expect(async () => { box = await el.boundingBox(); expect(box).toBeTruthy(); }).toPass()` — returns null before layout completes
- Wrap one-shot `evaluate()` for computed styles in `.toPass()` — styles may not be applied on first query
- Use Play/Pause/Stop buttons (not `keyboard.press('Space')`) for initial playback — AudioContext init is async and `Space` requires playlist focus
- After clicking Play, wait for time to advance with retrying assertion: `await expect(async () => { expect(await timeDisplay.textContent()).not.toBe('00:00:00.000'); }).toPass({ timeout: 10000 })`

**Git Safety:** Always make intermediate commits before running `git stash` or switching branches. A failed `git stash pop` + `git checkout -- .` can destroy all uncommitted work permanently.

---

## Architectural Decisions

### Sample-Based Architecture (Phase 3.3)

**Decision:** Store timeline positions as integer ticks (authoritative) and integer samples (derived cache). Duration and offset remain sample-only.

**Why:** Integer samples eliminate floating-point precision errors. Ticks provide tempo-independent timeline positioning for variable-tempo sessions.

**Types:**

```typescript
interface AudioClip {
  startTick?: number; // Position on timeline (ticks, authoritative when present)
  startSample: number; // Position on timeline (samples) — derived cache
  durationSamples: number; // Clip duration (samples)
  offsetSamples: number; // Start within audio file (samples)
  // ... other properties
}
```

**Helpers:** `createClip()` when samples known, `createClipFromSeconds()` for time-based APIs, `createClipFromTicks()` for tick-based creation (variable-tempo).

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
16. **Copy Refs in useEffect Body** - When accessing a ref in `useEffect` cleanup, copy `.current` to a local variable inside the effect body. ESLint's `react-hooks/exhaustive-deps` rule flags refs that may change between render and cleanup. **Exception:** For `[]` deps effects (mount/unmount only), refs are null at mount — copying them in the effect body captures null forever. Read refs directly inside the cleanup function instead.
17. **Refs from Custom Hooks in Dep Arrays** - When a `useRef` is returned from a custom hook, ESLint's `exhaustive-deps` can't trace its stability. Include it in the dep array (harmless, never triggers) rather than using `eslint-disable-next-line` which would mask real missing dependencies.
18. **Engine State Ownership** — Engine owns selection, loop, selectedTrackId, zoom (samplesPerPixel, canZoomIn, canZoomOut), and masterVolume; React subscribes to statechange. Engine setters normalize invariants (start <= end). All engine-owned state uses the `onEngineState()` hook pattern: `useSelectionState`, `useLoopState`, `useSelectedTrack`, `useZoomControls`, `useMasterVolume`. Each hook delegates mutations to engine methods and exposes `onEngineState()` for the provider's statechange handler.
19. **Render-Phase Guards ≠ Effect Dependencies** — Derived booleans computed during render (e.g., `isEngineTracks = tracks === engineTracksRef.current`) that are read inside effect bodies as guards should NOT be in the effect's dep array. They flip between renders (e.g., true→false after clearing the ref), causing spurious re-runs. Read them inside the effect body; depend only on the source data (`tracks`). When the same guard also needs to be visible to the _previous_ effect's cleanup, store it in a ref during render (as with `skipEngineDisposeRef`).
20. **Adding a New Rendering Mode** — Requires changes across packages: `RenderMode` type in core, theme colors + `*Channel` component in ui-components, `SmartChannel` branch, `ChannelWithProgress` background, `ClipPeaks` data fields in browser, `PlaylistVisualization` auto-detection. Follow `Channel.tsx` pattern for virtual scrolling.
21. **will-change Budget** — Only use `will-change` on actively animating elements (playheads, progress overlays). Firefox enforces a 3× document surface area budget; static canvas chunks with `translateZ(0)` don't need it.
22. **Always Use getGlobalAudioContext() / getGlobalContext()** — Never `new AudioContext()` or `getContext()`/`getDestination()` from Tone.js. Firefox blocks contexts created before user gesture. `getGlobalContext()` from playout calls `setContext()`, replacing Tone's default context — nodes created on the old default are on a dead audio graph. Use `getGlobalContext()` and `context.destination` for any Tone.js node in the playback signal path.
23. **Gate Provider Behind Async Readiness** — When multiple async resources must load before rendering (e.g., MIDI tracks + SoundFont), gate the `WaveformPlaylistProvider` mount behind all resources being ready. This prevents double engine rebuilds. Check both the loading flag AND `tracks.length > 0` since hooks can briefly report `loading: false` with empty data.
24. **Shared Clip Pixel Width** — Use `clipPixelWidth()` from `@waveform-playlist/core` for any pixel width derived from `startSample`/`durationSamples`/`samplesPerPixel`. Both `Clip.tsx` (container) and `ChannelWithProgress.tsx` (progress overlay) must use this shared function — never `peaksData.length`, which may be shorter than the clip when audio is shorter than configured duration.
25. **Grep Comments When Renaming APIs** — When renaming an option or prop across files (e.g., `progressive` → `immediate`), also grep for the old name in comments. Mechanical find-replace on code misses adjacent comments that describe the old behavior.
26. **Prefer Props Over Mount/Unmount for Optional Providers** — If a provider controls both data (e.g., snap config) and rendering (e.g., timescale mode), add a mode prop instead of conditionally mounting/unmounting. Unmounting tears down the subtree and loses state; a prop switch is cheaper and keeps context consumers stable.
27. **Stop Before Clear** — Always call `stop()` before clearing tracks. Clearing React state without stopping Tone.js Transport leaves orphaned audio playing. Use `ClearAllButton` (from `@waveform-playlist/browser`) which handles this automatically via `usePlaylistControls().stop()`.
28. **StereoPanner Stereo Preservation** — Tone.js `Panner` defaults to `channelCount: 1`, downmixing stereo to mono at 1/√2 gain. Use `trackChannelCount(track)` from `@waveform-playlist/core` to derive the correct `channelCount` from source material. Hardcoding `2` upmixes mono; hardcoding `1` downmixes stereo.
29. **Never Use Tone.js `addAudioWorkletModule`** — Tone.js caches a single `_workletPromise` per context. Only the first URL is loaded; subsequent calls with different URLs are silently skipped. Always use `rawContext.audioWorklet.addModule(url)` directly. `context.createAudioWorkletNode()` is still fine for node creation.
30. **No Manual `external` in tsup Configs** — tsup auto-externalizes `dependencies` and `peerDependencies` (including deep imports like `react/jsx-runtime`). Never add a manual `external` list — it drifts when dependencies change, causing duplicate instances at runtime (#317). All 13 packages use tsup with no `external` field.
31. **Dynamic Import Tone.js Outside Playout Package** — `import * as Tone from 'tone'` eagerly creates a default context with AudioWorklet nodes, which fails before user gesture. Outside the playout package (which handles init via `getGlobalContext()`), use `import type` for types and `await import('tone')` inside effects after AudioContext is running. Call `Tone.setContext(new Tone.Context(audioContext))` to share the native AudioContext.
32. **Tone.js Effect.input Is Not a Native AudioNode** — `Effect` subclasses (BitCrusher, etc.) set `this.input = new Tone.Gain(...)` (a Tone.js wrapper). Native `AudioNode.connect(effect.input)` fails with "Overload resolution failed". Use `Tone.Gain` as a bridge: `outputNode.connect(bridge.input)` works because `Tone.Gain.input` IS a native `GainNode`. Then `bridge.chain(effect, destination)` for the Tone chain.
33. **Provider Child Effects and playoutRef Timing** — React runs child effects before parent effects. A child component's `useEffect` accessing `playoutRef.current` will find `null` on first run because the provider's effect hasn't created the playout yet. Add `duration` (from `useMediaElementData()`) as a dependency — it changes from 0 to the actual value when the playout is ready, retriggering the effect.
34. **Global AudioContext for Decode** — Use `getGlobalAudioContext()` from `@waveform-playlist/playout` for `decodeAudioData()`. Works while suspended (pre-gesture). Never create a separate AudioContext — the global one is shared with Tone.js and has the correct sample rate.
35. **Web Component Packages Need `sideEffects: true`** — Packages that call `customElements.define()` at import time are side-effectful. Setting `"sideEffects": false` in package.json causes bundlers to tree-shake bare imports, silently dropping element registrations.
36. **Detached Elements Cannot Dispatch Bubbling Events** — In `disconnectedCallback`, the element is already removed from the DOM. Events dispatched with `bubbles: true` will not reach ancestor elements. Use MutationObserver on the parent to detect child removal instead.
37. **effectiveSampleRate Pattern in dawcore** — `<daw-editor>` `sampleRate` `@property` is an initial hint. Internal calculations use `effectiveSampleRate` getter which returns `_resolvedSampleRate ?? sampleRate`. The resolved rate is set from decoded audio buffers. `PointerHandlerHost` and all pixel/time conversions use `effectiveSampleRate`.
38. **WaveformData.resample() Only Upsamples** — `WaveformData.resample({ scale })` can only resample to a coarser (larger) scale than the source. Attempting to resample to a finer scale throws. When caching WaveformData, validate `cached.scale <= requestedScale` before returning cache hits.
39. **Track ID Alignment in dawcore** — `createTrack()` from core generates its own `id` via `generateId()`. The dawcore editor uses a different ID (`<daw-track>.trackId` or `crypto.randomUUID()` for drops) as its map key. Must set `track.id = trackId` after `createTrack()` so engine methods (`setTrackSolo`, `setTrackMute`, etc.) can find the track by ID.
40. **Prefer `createClip()` Over `createClipFromSeconds()` When Samples Known** — `createClipFromSeconds` round-trips through float seconds: `samples/rate → seconds → Math.round(seconds*rate)`. Safe when the same rate is used for division and multiplication, but drifts silently when rates differ (e.g., `effectiveSampleRate` vs `audioBuffer.sampleRate`). Use `createClip()` with integer samples when available. For tick-based creation (variable-tempo), use `createClipFromTicks()` which sets `startTick` as authoritative and derives `startSample`.
41. **Clip Interaction Adapter Sync** — During clip move drag, pass `skipAdapter=true` to `engine.moveClip()` to avoid 60fps adapter rebuilds. Call `engine.updateTrack(trackId)` once on `pointerup`. Trim uses cumulative delta (engine called once on drop). Split calls engine normally (single operation).
42. **`composedPath()[0]` vs `closest()` in Shadow DOM** — `composedPath()[0]` returns the deepest clicked element (may be a child like `<span>`). For hit detection on interaction zones (`.clip-header`, `.clip-boundary`), always use `target.closest('.class-name')` to walk up the DOM tree.
43. **Peak Regeneration After Clip Mutations** — After `splitClip` (new clip IDs) or `trimClip` (changed offset/duration), peaks must be regenerated via `_syncPeaksForChangedClips`. The statechange handler detects changes by comparing `_clipOffsets` cache with current clip state.
44. **`undefined` vs `false` in Optional Boolean Modifiers** — In `KeyboardShortcut` and `KeyBinding`, `undefined` means "match any state" while `false` means "must NOT be pressed." Never use falsy checks (`!value`) to test these — use `=== undefined`. The distinction matters for auto-expansion logic (e.g., undo shortcuts generating both Ctrl and Meta variants).
45. **Lit `noAccessor` for Synchronous Property Validation** — Lit's `@property` setter stores values immediately; `willUpdate` runs asynchronously. If external code reads the property right after setting it, it sees the unvalidated value. Use `@property({ noAccessor: true })` with a custom getter/setter that validates synchronously and calls `this.requestUpdate(name, oldValue)`.
46. **`createClipFromSeconds` Supports Peaks-First Rendering** — `audioBuffer` is optional. Provide `waveformData` (from `waveform-data.js`) + `sampleRate` + `sourceDuration` instead. This enables rendering waveforms before audio decode completes. The `WaveformDataObject` interface in `@waveform-playlist/core` defines the required shape.
47. **Opus Always Encodes at 48000 Hz** — Per spec, Opus resamples all input to 48000 Hz. This makes Opus ideal for pre-computed peaks workflows since most browser AudioContexts run at 48000 Hz. WAV/FLAC at 44100 Hz will cause rate mismatches on 48000 Hz hardware.
48. **Pre-Computed Peaks Require Sample Rate Match** — `.dat` file `sample_rate` must match `AudioContext.sampleRate`. On mismatch, `createClip` warns per-clip (includes clip name) and callers fall back to worker-generated peaks. Dawcore rejects `.dat` and falls to worker. Browser converts offsets for preview (`ratio = wdRate / clipRate` on offsetSamples/durationSamples/samplesPerPixel), worker replaces on next cycle. `configureGlobalContext({ sampleRate })` from playout creates a standard `new Context()` and compares the requested rate against the actual hardware rate — it warns but cannot force the rate (native AudioContext wrapping caused Tone.js issues, reverted).
49. **`sampleRate` Prop for Pre-Computed Peaks Matching** — `WaveformPlaylistProvider` accepts a `sampleRate` prop; `<daw-editor>` accepts a `sample-rate` attribute. `configureGlobalContext({ sampleRate })` compares against the AudioContext's actual rate and warns on mismatch. Cannot force the rate — Tone.js 15.1.22 doesn't pass `sampleRate` through to `standardized-audio-context`, and passing a `StdAudioContext` directly causes `AudioParam` errors. Peaks fall back to worker on mismatch. Revisit when Tone.js releases the upstream fix.
50. **Loop Wrap Clock Seek Offset** — When the Scheduler wraps at `loopEnd` inside the lookahead window, seek the clock to `loopStart - (loopEnd - clockTime)`, not `loopStart`. The lookahead means the wrap fires before real time reaches the boundary; `seekTo(loopStart)` makes post-wrap events schedule at "now" instead of at the boundary's audio time. `getCurrentTime()` clamps to `loopStart` during the brief window when the clock is behind.
51. **`_renderSpp` Pattern in dawcore Beats Mode** — In beats mode, `samplesPerPixel` must be derived from `ticksPerPixel` via `(60 × sampleRate × ticksPerPixel) / (ppqn × bpm)`. Every rendering path (clip positions, peak generation, peak re-extraction after trim/split, trim visual feedback) must use this derived value. Using raw `samplesPerPixel` causes coordinate mismatches. Exposed as `renderSamplesPerPixel` getter for `ClipPointerHost` and `ClipPeakSyncHost` interfaces.
52. **Snap Absolute Position, Not Delta** — When snapping clip drag/trim to a musical grid, snap the clip's absolute timeline position — not the delta. Delta-snapping preserves off-grid offsets permanently. Applies to both dawcore `ClipPointerHandler._snapDeltaToSamples()` and React `SnapToGridModifier`. Pass the anchor sample (left edge for move/left-trim, right edge for right-trim) to compute the correct absolute target.
53. **Tick-Space Pixel Positioning in Beats Mode** — In beats mode, clip pixel positions must be derived from tick space, not from `startSample / _renderSpp`. When `clip.startTick` is available, use `clip.startTick / ticksPerPixel` directly. Fall back to `startSample → seconds → ticks → ticks/ticksPerPixel` for clips without `startTick`. Never use `startSample / _renderSpp` — the sample round-trip introduces 1-2px quantization error.
54. **Engine Tempo Forwarding** — `<daw-editor>` BPM setter must call `engine.setTempo()` to keep the adapter's Transport in sync. `_buildEngine` initializes the adapter with `adapter.setTempo(this._bpm)` BEFORE creating the engine, so `setTracks()` enriches clips with `startTick` at the correct tempo. Without this, clips at non-zero positions get wrong tick values (computed at default 120 BPM).
55. **`startTick` is Authoritative, `startSample` is Cache** — `AudioClip.startTick` is the authoritative timeline position. `startSample` is a derived cache recomputed via `TempoMap.ticksToSeconds(startTick) * sampleRate` when tempo changes. Engine's `setTracks()` enriches clips missing `startTick` by computing it from `startSample`. In beats mode, rendering must use `clip.startTick / ticksPerPixel` for pixel position — NOT the sample round-trip which drifts when BPM changes.
56. **Two Transport Instances in Dev Demos** — Dawcore dev demos that create their own `Transport` (for metronome preview) have a DIFFERENT Transport from the editor's internal `NativePlayoutAdapter.transport`. Tempo set on the demo's Transport doesn't affect the engine's clip scheduling. Use `editor.transport` (exposed getter) for tempo that affects clip `startTick` enrichment. Apply tempo to BOTH transports when metronome preview is needed.

---

## Plans & Future Work

**Plans directory:** `plans/` contains future feature specs (waveform service, listening test tool).

**Debug tests:** `debug/tonejs/` contains standalone HTML reproductions of upstream Tone.js bugs. Each file loads Tone.js from CDN with a one-click reproduce button — change the `<script src>` version to test new releases. See `debug/tonejs/README.md`.

**Debug apps:** `debug/standalone-midi/` is a standalone Vite+React app using workspace components (not Docusaurus) for isolating rendering bugs. Run with `cd debug/standalone-midi && pnpm exec vite`.

**Deployment:** Site deploys automatically via GitHub Actions on push to `main`.

---

## References

- **Roadmap & Progress:** `TODO.md`
- **Architecture Details:** `PROJECT_STRUCTURE.md`
- **Main branch:** `main`
- **Current work:** `main`
- **Dev server:** `http://localhost:3000/` (Docusaurus)
- **dawcore uses `@dawcore/transport`** — No Tone.js dependency. Native `AudioContext` for decode, playback, and recording. The `audioContext` property on `<daw-editor>` accepts a consumer-provided context.

---

## Per-Package Documentation

Package-specific conventions, architecture, and patterns live in each package's own CLAUDE.md:

- `packages/engine/CLAUDE.md` — PlaylistEngine, PlayoutAdapter, operations
- `packages/playout/CLAUDE.md` — Tone.js adapter, AudioContext, ToneTrack internals
- `packages/browser/CLAUDE.md` — Hooks architecture, effects, animation, context providers
- `packages/ui-components/CLAUDE.md` — Theming, virtual scrolling, ClipViewportOrigin
- `packages/recording/CLAUDE.md` — AudioWorklets, Firefox compat, VU meter, mic access
- `packages/annotations/CLAUDE.md` — Integration context, annotation provider pattern
- `packages/worklets/CLAUDE.md` — AudioWorklet processors (metering, recording)
- `packages/spectrogram/CLAUDE.md` — Integration context, SpectrogramChannel index
- `packages/dawcore/CLAUDE.md` — Lit Web Components, native AudioContext (no Tone.js), element types, CSS theming
- `packages/transport/CLAUDE.md` — Native Web Audio transport, scheduler, clock, MeterMap, PlayoutAdapter bridge
- `website/CLAUDE.md` — Docusaurus site, CSS pitfalls, custom pages

---

**Last Updated:** 2026-03-31
