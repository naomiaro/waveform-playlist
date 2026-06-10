# Claude AI Development Notes

This file contains important context, decisions, and conventions for AI-assisted development on the waveform-playlist project.

## Project Overview

Waveform-playlist is a multitrack Web Audio editor and player with HTML canvas waveform visualizations. Currently undergoing a React refactor (Tone.js overhaul branch).

**Key Dependencies:**

- **Tone.js 15.1.22** - Audio engine for playback, scheduling, and effects

**Website aesthetic** — see `website/CLAUDE.md` for the Berlin-underground design system, dark-mode palette, and example styling guidelines.

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

**Version Bumping:** Each package follows its own semver independently based on its actual changes. Bump only the packages that changed — don't sync versions across unrelated packages.

**Independent Versioning:** `@dawcore/components` and `@dawcore/transport` have their own version schemes (0.x.x), separate from the main `@waveform-playlist/*` packages.

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

**Design docs and implementation plans:** Design docs go in `docs/specs/YYYY-MM-DD-<topic>-design.md`; matching implementation plans go in `docs/plans/YYYY-MM-DD-<topic>.md`. Commit both — they form the durable record of *why* a feature was built that way.

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
- **TypeScript check**: `pnpm typecheck` (enforced in build scripts). `tsconfig`'s `noUnusedLocals` rejects unused private methods with `TS6133` — when extracting a helper, wire it into all call sites in the same change. Staged "add helper now, use it later" commits will fail typecheck.
  - **Known failure:** `pnpm typecheck` currently fails on `main` in `packages/dawcore-midi/__tests__/parseMidiFile.test.ts` (`ArrayBufferLike` vs `ArrayBuffer`, TS version drift) — pre-existing, not caused by your branch. Verify touched packages individually with `pnpm --filter <pkg> typecheck`.
- **Lint**: `pnpm lint` - Prettier check + ESLint across all packages. **Always run before committing.** This is a root-only script; run from repo root or use `pnpm -w lint`. Fix formatting issues with `pnpm format`.
- **New packages**: After adding a new `packages/*/package.json`, run `pnpm install` and commit `pnpm-lock.yaml`. CI uses `--frozen-lockfile` and will fail if the lockfile is stale.
- **Dev server**: `pnpm --filter website start` - Docusaurus dev server
- **Example: dawcore-native**: `pnpm example:dawcore-native` — Vite dev server at localhost:5173 (Vite falls back to next free port when 5173 is taken; check the server's startup log for the actual URL)
- **Example: dawcore-tone**: `pnpm example:dawcore-tone` — Vite dev server at localhost:5174 (same fallback behavior — log shows the actual port)
- **Unit tests**: Run from each package directory with `npx vitest run` (engine, core, playout, ui-components, browser)
- **Hard refresh**: Always use Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) after builds
- **Vitest cleanup:** `npx vitest run` in pnpm monorepos can leave orphaned Node processes at ~100% CPU. After running tests across multiple packages, verify with `pgrep -f vitest` and kill strays with `pkill -f vitest` if needed.

**CI Validation:** `.github/workflows/ci.yml` runs on PRs to `main`: build and lint (includes prettier check). Fix formatting with `pnpm format` before pushing.

**GitHub Release Notes:** use `gh release create --notes-file <path>` (or `gh release edit --notes-file <path>`), NOT `--notes "$(cat <<'EOF')"`. Shell escapes in HEREDOCs mangle inline backticks and quotes inside code spans, leaving visible `\"` and `` \` `` in the rendered release body.

**pnpm Build Ordering:** `pnpm recursive run` determines build order from `dependencies` and `devDependencies` only — **not** `peerDependencies`. If package A needs package B's types at build time (e.g., for DTS generation), B must be in A's `devDependencies` even if it's already a `peerDependency`. Without this, CI builds fail because packages build in parallel/alphabetical order.

**Type Migration Gotcha:** When moving types between packages, `pnpm typecheck` resolves workspace packages via `dist/` (not source). Build the source package first: `pnpm --filter @waveform-playlist/PACKAGE build` before `pnpm typecheck`. Same applies to *adding* fields to interfaces in upstream packages — downstream `pnpm typecheck` won't see new optional properties (`TS2353` / `TS2339`) until the upstream is rebuilt. Also grep the entire repo for old import paths — easy to miss straggling imports.

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
- Refresh between scenarios when using `browser_evaluate` — the page persists across eval calls in one MCP session; state from prior interactions can silently invalidate assertions (e.g. "first M-click reports muted=false" because a prior eval already toggled it). Call `browser_navigate` to the same URL to reset before each independent reproduction.

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

### UI Library Strategy

**Decision:** Do NOT add a full UI library (Material-UI, Chakra, etc.) as peer dependency.

**Reasoning:** Keep bundle small (~132KB gzipped), maximize user flexibility.

**Approved Approach:**

1. Continue using **styled-components**
2. Use **Radix UI** or **React Aria** selectively for complex components (headless only)
3. Build simple components ourselves
4. Create internal design system with shared theme tokens

### Adapter-Pluggable `<daw-editor>` (Issue #378)

**Decision:** `<daw-editor>` requires an externally-provided `PlayoutAdapter`. No default adapter or AudioContext created.

**Why:** Consumers choose their audio backend — `NativePlayoutAdapter` (native Web Audio, multi-tempo) or `TonePlayoutAdapter` (Tone.js, effects/MIDI). AudioContext owned by the adapter, not the editor.

**Interface:** `PlayoutAdapter` has required `readonly audioContext: AudioContext` and required `readonly ppqn: number`. Engine reads `adapter.ppqn` on construction to align tick resolution. `setPpqn?(ppqn)` is optional — allows the editor to request a PPQN before reading.

**Breaking changes (dawcore 0.0.x):** `adapter` property required, `transport` getter removed, `audioContext` setter removed, `sample-rate` attribute removed, `@dawcore/transport` is optional peer dep.

### `@dawcore/*` Framework Split (Two Flavors)

When a `@waveform-playlist/*` package has framework-agnostic logic (parsing, computation) plus a React layer, split into `@dawcore/X` (framework-agnostic core) + `@waveform-playlist/X` (React wrapper that depends on `@dawcore/X`). Precedents: `@dawcore/spectrogram` (PR #387), `@dawcore/midi` (PR #392).

**Two bundling choices on `@dawcore/components`:**

- **Regular dependency** (`@dawcore/spectrogram` pattern) — always loaded; appropriate when most consumers use the feature.
- **Optional peer dep + dynamic import** (`@dawcore/midi` pattern) — opt-in; appropriate when bundle cost matters and most consumers don't use the feature. `loadMidi` does `await import('@dawcore/midi')` with an install-hint rethrow on failure.

### Examples Directory Structure

**Decision:** Standalone Vite examples live in `examples/` at repo root, not inside packages.

**Why:** Decouples examples from package builds. Each example has its own `vite.config.ts` with source aliases. Shares `website/static/` as publicDir for audio assets.

**Structure:**
- `examples/dawcore-native/` — Web components + NativePlayoutAdapter (moved from `packages/dawcore/dev/`)
- `examples/dawcore-tone/` — Web components + TonePlayoutAdapter (Tone.js backend)

### ESLint Baseline

Root flat ESLint config (`eslint.config.mjs`) with TypeScript + React Hooks checks. Run `pnpm lint` before committing — catches missing hook deps, unused variables, hook-rule violations.

### Docusaurus Native Examples

Docusaurus-native React components (no Jekyll). See `website/CLAUDE.md` for the `createLazyExample` SSR/SSG pattern, webpack aliases, and theme integration.

---

## Important Patterns (cross-package)

Package-specific patterns live in each package's CLAUDE.md (see "Per-Package Documentation" below). The patterns kept here are cross-cutting — they apply across packages or to build/release infrastructure.

1. **Sample-Based Math** — Use integer samples (and `startTick` for tempo-independent positioning) for all timeline calculations. Duration and offset are sample-only; `startTick` is authoritative when present, `startSample` is a derived cache. Helpers: `createClip()` (samples known), `createClipFromTicks()` (tick-based, variable-tempo), `createClipFromSeconds()` (legacy time-based).
2. **Adding a New Rendering Mode** — Cross-package change: `RenderMode` type in core → theme colors + `*Channel` component in ui-components → `SmartChannel` branch → `ChannelWithProgress` background → `ClipPeaks` data fields in browser → `PlaylistVisualization` auto-detection. Follow `Channel.tsx` virtual-scrolling pattern.
3. **Grep Comments When Renaming APIs** — When renaming a prop or option, grep for the old name in comments too. Mechanical find-replace on code misses adjacent comments that describe the old behavior.
4. **Prefer Props Over Mount/Unmount for Optional Providers** — When a provider controls both data and rendering, add a mode prop instead of conditional mount/unmount. Unmounting tears down the subtree and loses state; a prop switch is cheaper and keeps context consumers stable.
5. **No Manual `external` in tsup Configs** — tsup auto-externalizes `dependencies` and `peerDependencies` (including deep imports like `react/jsx-runtime`). Manual `external` lists drift when deps change, causing duplicate instances at runtime. All packages use tsup with no `external` field.
6. **Opus Always Encodes at 48000 Hz** — Per spec, Opus resamples all input to 48000 Hz. Ideal for pre-computed peaks workflows since most browser AudioContexts run at 48000 Hz. WAV/FLAC at 44100 Hz will mismatch on 48000 Hz hardware.
7. **Pre-Computed Peaks Require Sample Rate Match** — `.dat` file `sample_rate` must match `AudioContext.sampleRate`. On mismatch, `createClip` warns per-clip (with clip name) and consumers fall back to worker-generated peaks. Browser converts offsets for preview (`ratio = wdRate / clipRate`); worker replaces on next cycle. `configureGlobalContext({ sampleRate })` from playout compares against the actual hardware rate — warns, cannot force (Tone.js limitation).
8. **`sampleRate` Prop for Pre-Computed Peaks Matching** — `WaveformPlaylistProvider` accepts a `sampleRate` prop; `<daw-editor>` reads from the adapter's AudioContext. Peaks fall back to worker on mismatch.
9. **`@dawcore/*` packages can't be source-aliased in website webpack** — they use Lit `@customElement` decorators which the website's babel-loader doesn't parse without `@babel/plugin-proposal-decorators`. Use built `dist/` via node_modules (matches the `recording` / `annotations` pattern). Add as `workspace:*` dep in `website/package.json`, run `pnpm install` to symlink, no webpack alias needed.

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
