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
pnpm release:version   # changeset version — computes all bumps incl. the dependent cascade
pnpm release:publish   # pnpm build && changeset publish --no-git-tag
```

**Version Bumping — Changesets owns the math (since 2026-07-05):** every PR that changes `packages/*/src` adds a changeset (`pnpm changeset`; pick `patch` for `@dawcore/*` — zerover, never minor/major). Each package follows its own semver independently. At release time `pnpm changeset version` computes all bumps INCLUDING the exact-pin dependent cascade (validated against the 2026-07-05 manual closure: identical 13-package result; `onlyUpdatePeerDependentsWhenOutOfRange` keeps floating peer floors like dawcore's `>=0.0.13` untouched; private packages excluded via `privatePackages`). Review the version diff, then `pnpm release:publish` (= `pnpm build && changeset publish --no-git-tag`: builds everything first — no prepublish hooks exist — then publishes topologically, skipping versions already on the registry; safe to re-run after a partial failure). Don't name a script `version` — `pnpm version` resolves to pnpm's built-in, not the script. The old `pnpm version:bump` (`scripts/bump-version.js`) is REMOVED — it synced ALL packages to one version, incompatible with independent versioning. `changelog: false` — the hand-written descriptive-tag GitHub release remains the record. Then the chore(release) commit + GitHub release as below. **`changeset version` CONSUMES the `.changeset/*.md` files** — reverting `packages/*/package.json` after a dry-run does NOT restore them; re-create the changeset (or revert `.changeset/` too) before re-running. Validation pattern for config changes: write a throwaway changeset bumping one package, run `pnpm release:version`, diff the computed closure against expectation, then revert everything including `.changeset/`.

**Independent Versioning:** `@dawcore/components` and `@dawcore/transport` have their own version schemes (0.x.x), separate from the main `@waveform-playlist/*` packages.

**First-time scoped packages:** New scoped packages (`@waveform-playlist/*`, `@dawcore/*`) need `--access public` on first npm publish:

```bash
pnpm publish --filter @waveform-playlist/NEW-PACKAGE --no-git-checks --access public
```

**Verifying fresh publishes:** `npm view` caches 404s — a just-published new package can look missing for minutes. Verify with `curl -s https://registry.npmjs.org/@scope%2fname` instead.

**Pre-publish workspace-dep sweep:** for every `workspace:*`/`workspace:^` dep of the packages being published, verify local version == registry latest (`curl -s https://registry.npmjs.org/...`) — a feature PR that bumps a package version without publishing it (e.g. media-element-playout 12.3.0 in #473) makes dependents' exact pins unresolvable at install time.

**Republish cascade is MANDATORY — never publish a package without its dependents (the outbound direction of the sweep above; AUTOMATED by `changeset version` since 2026-07-05 — this note is the why, and the fallback procedure if changesets is bypassed):** regular `workspace:*` deps publish as **EXACT pins** in the tarball; `workspace:^` peers publish as carets (verified from packuments). Publishing pkg X without republishing every published package that lists X in `dependencies` leaves those dependents pinning the OLD X — consumers silently install duplicate/stale copies. This happened: the core@12.5.0/ui-components@13.1.1 release skipped the cascade, so browser@15.2.0 shipped `core 12.4.0` + `ui-components 13.1.0` pins until the next sweep (2026-07-05) cured it. Procedure: compute the transitive exact-pin dependent closure of every bumped package (grep `"<pkg-name>"` across `packages/*/package.json` `dependencies`), patch-bump + republish ALL of it in topological order, then curl the new packuments and check the `dependencies` pins are the fresh versions. Caret peers force a republish only when the bump escapes the range (any major; ANY bump for zerover `^0.0.x` peers like `@dawcore/*`).

**Build before publishing:** No package defines prepublish hooks — always run `pnpm --filter <pkg> build` before `pnpm publish`, or the tarball ships a stale `dist/`.

**Prerelease Tag:** Use `@next` for prerelease versions when preparing future major releases.

---

## Documentation Guidelines

**Where to track progress/updates:**

- ✅ **TODO.md** - Roadmap, recently completed work, session notes, progress updates
- ✅ **CLAUDE.md** - Architectural decisions, conventions, patterns (minimal, timeless)
- ✅ **PROJECT_STRUCTURE.md** - Architecture, file organization, data flow (NO progress/todos)

**PROJECT_STRUCTURE.md is audited after structural changes:** after adding packages, directories, or architectural subsystems, audit PROJECT_STRUCTURE.md and update it in the same PR. Structure/data-flow only — no progress notes (existing rule).

**When completing work:**

1. Update CLAUDE.md only if architectural decision or pattern established
2. Update PROJECT_STRUCTURE.md only if structure/architecture changed
3. Never add progress/changelog to PROJECT_STRUCTURE.md

**Design docs and implementation plans:** Design docs go in `docs/specs/YYYY-MM-DD-<topic>-design.md`; matching implementation plans go in `docs/plans/YYYY-MM-DD-<topic>.md`. Commit both during development — they drive the spec-review and task-execution workflow. **When implementation is finished, `git rm` both from the branch before the PR merges** — they're working documents, not durable records. The PR description carries the lasting summary of what was built and why.

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

**Root README.md lists every demo:** Whenever an example page or a new `examples/*` app is added, update the root README.md's examples section (run commands + per-page lists) in the same PR. The README is the front door — a demo that isn't listed there doesn't exist for most visitors.

**Avoid Duplicating Code in Example Pages:** Example pages (`website/src/pages/examples/`) should link to guide docs for code walkthroughs, not inline full code blocks. Duplication creates maintenance burden when APIs change.

**LLM-Readable Docs:**

- `website/static/llms.txt` — Library discovery page, served at `/llms.txt`. Update when packages, architecture, or key APIs change.
- `website/docs/llm-reference.md` — All TypeScript interfaces from source, no prose. Update when any context type, hook signature, or component prop changes.
- **Keep all doc surfaces in sync** — When adding new context fields, hook returns, or component props, update: (1) `llm-reference.md` (interfaces), (2) `llms.txt` (descriptions), (3) `docs/api/hooks.md` (context value interfaces), (4) `docs/examples.md` (code snippets), (5) example page files in `src/pages/examples/` (keyboard shortcuts sections, feature lists), (6) provider API docs (`docs/react/api/providers/*.md`) AND guide hook tables (e.g. `media-element-playout.md`), (7) the root README demo table. For dawcore element attributes also: `packages/dawcore/COMPONENTS.md`, the element's entry in `packages/dawcore/CLAUDE.md`, and the attribute tables in `docs/specs/web-components-migration.md`.

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
  - **`Uint8Array.buffer` is `ArrayBufferLike`, not `ArrayBuffer`** — under current TS lib types it could be a `SharedArrayBuffer`, so `midi.toArray().buffer`-style expressions fail `TS2322/TS2345` where `ArrayBuffer` is required. Copy into a fresh buffer instead: `const buf = new ArrayBuffer(bytes.length); new Uint8Array(buf).set(bytes)`. (This was the long-standing `pnpm typecheck` failure in dawcore-midi/midi tests, fixed 2026-07-09 — root typecheck passes again.)
  - **`pnpm typecheck` is first-fail** (`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`) — one failing package masks all later ones in the recursive run. After fixing a blocking package, re-run the FULL sweep; the same bug pattern often exists in sibling packages (the 2026-07-09 ArrayBufferLike fix found a second, masked instance in packages/midi).
- **Lint**: `pnpm lint` - Prettier check + ESLint across all packages. **Always run before committing.** This is a root-only script; run from repo root or use `pnpm -w lint`. Fix formatting issues with `pnpm format`.
  - **`pnpm lint` is `prettier --check && eslint` (prettier FIRST)** — a formatting issue exits 1 with NO `✖ N problems` ESLint summary (eslint never runs after prettier fails). Exit 1 + missing summary = a prettier failure, not lint errors → `pnpm format` (or `prettier --write <file>`). Don't chase a phantom "0 errors but exit 1".
- **`examples/**/*.html` are outside lint scope** — `pnpm lint` only covers `packages/**/src/**/*.{ts,tsx}`; prettier flags every example HTML file if run on them directly. Match the existing file style by hand, don't reformat them.
- **New packages**: After adding a new `packages/*/package.json`, run `pnpm install` and commit `pnpm-lock.yaml`. CI uses `--frozen-lockfile` and will fail if the lockfile is stale.
- **Transitive Dependabot alerts**: try `pnpm update -r <pkg>...` first (refreshes the lockfile within parents' existing ranges) before adding a `pnpm.overrides` entry — most alerts are just stale lockfile patches the parent range already allows. Reserve overrides for a version an intermediary pins *below* the fix (forced; may break upstream's tested range, e.g. js-yaml 3.x via gray-matter).
- **Verify bundler tree-shaking with the real binary** — `npx esbuild`/`npx rollup` can be command-not-found; with stderr suppressed, grep on empty output gives a FALSE clean pass. Use `node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild` directly, don't suppress stderr. esbuild emits `from "x"` (with a space); single-file `--outfile` inlines dynamic `import()` targets — use `--splitting --outdir` to distinguish eager (entry chunk) from lazy.
- **`dependencies`→`peerDependencies` move churns the lockfile** — it changes pnpm hoisting and can re-resolve unrelated transitive deps (e.g. `@types/react` 19→18 from a workspace `^18` vs react-19 mismatch). A pristine-base `pnpm install` no-op confirms the move (not pre-existing drift) is the cause; `--frozen-lockfile` still passes if internally consistent.
- **Dev server**: `pnpm --filter website start` - Docusaurus dev server
- **Example: dawcore-native**: `pnpm example:dawcore-native` — Vite dev server at localhost:5173 (Vite falls back to next free port when 5173 is taken; check the server's startup log for the actual URL)
- **Example: dawcore-tone**: `pnpm example:dawcore-tone` — Vite dev server at localhost:5174 (same fallback behavior — log shows the actual port)
- **Example: dawcore-wam**: `pnpm example:dawcore-wam` — Vite dev server at localhost:5175. WAM plugins load from webaudiomodules.com (network required)
- **Unit tests**: Run from each package directory with `npx vitest run` (engine, core, playout, ui-components, browser)
- **vitest `-t` is a REGEX, not a substring** — `-t 'play() after'` matches nothing (the `()` is an empty group). Filter on a paren-free fragment of the test name.
- **Hard refresh**: Always use Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) after builds
- **Vitest cleanup:** `npx vitest run` in pnpm monorepos can leave orphaned Node processes at ~100% CPU. After running tests across multiple packages, verify with `pgrep -f vitest` and kill strays with `pkill -f vitest` if needed.
- **Stray NUL byte in a source file = silent `Bin` diff** — a 0x00 that sneaks into a `.ts` file (e.g. from a tool edit) makes `git diff --stat` report the file as binary while tsc, prettier, AND vitest all pass silently. Detect with `perl -ne 'print "line $.\n" if /\x00/' <file>` — bash `$'\x00'` CANNOT pass a NUL to grep (it degrades to `grep ""`, matching every line). Fix with `perl -i -pe 's/\x00/ /'`.
- **Agent worktrees & dev servers:** Background agents run in `.claude/worktrees/agent-*`. When an agent finishes: its dev server dies (browser tabs still open against it fail dynamic imports with misleading "package not installed" hints — reload against a real server), and stale worktrees linger holding their branch names (`git worktree remove --force .claude/worktrees/agent-* && git worktree prune`). Never trust which checkout `pnpm example:*` serves — the startup log prints the cwd.

**CI Validation:** `.github/workflows/ci.yml` runs on PRs to `main`: build and lint (includes prettier check). Fix formatting with `pnpm format` before pushing.

**GitHub closing keywords don't distribute over comma lists** — `fixes #589, #590, #593` in a squash-merge commit closes ONLY #589; each reference needs its own keyword (`fixes #589, fixes #590, fixes #593`). A `closes #N` in the PR body works independently. After merging a multi-issue PR, verify each issue actually closed (`gh issue view N --json state`).

**Commit messages with backticks:** never inline them in a double-quoted `git commit -m "…"` — the shell command-substitutes them (one release-arc commit shipped with a word silently deleted). Use `git commit -F - << 'EOF'` (quoted delimiter).

**GitHub Release Notes:** use `gh release create --notes-file <path>` (or `gh release edit --notes-file <path>`), NOT `--notes "$(cat <<'EOF')"`. Shell escapes in HEREDOCs mangle inline backticks and quotes inside code spans, leaving visible `\"` and `` \` `` in the rendered release body.

**Release tags are descriptive, not `pkg@version`** — feature-named (e.g. `optional-playout-engines`, `recording-latency-config`). `gh release create <descriptive-tag> --target main --notes-file <path>` creates the tag + release; the release commit is `chore(release): pkg@x.y.z, …` on `main`. Bumping workspace package versions does NOT change `pnpm-lock.yaml`.

**`npm version <v> --no-git-tag-version` may normalize unicode escapes** in package.json (e.g. `\u2014` becomes a literal `—`) — an extra diff line beyond `version`; harmless, commit it.

**A full release is THREE artifacts** — easy to do partially: (1) npm publish (`pnpm --filter <pkg> publish --no-git-checks`), (2) the `chore(release): pkg@x.y.z` commit on `main`, (3) the descriptive-tag GitHub release (`gh release create`). "Bump and publish" naturally stops after (1)+(2) — the GitHub release is a separate step, easy to forget. Preview the tarball first with `pnpm --filter <pkg> publish --no-git-checks --dry-run` (shows files/version/tag/access before the irreversible publish); verify the publish landed with `curl -s https://registry.npmjs.org/@scope%2fname` (npm view caches 404s).

**`@dawcore/components` has no published dependents** — only `website` (`workspace:*`, unpublished) depends on it, so bumping it is a SINGLE-package release, not a workspace-pin republish cascade. Verify republish scope with `grep -rl '"@dawcore/components"' packages/*/package.json` before assuming the cascade.

**pnpm Build Ordering:** `pnpm recursive run` determines build order from `dependencies` and `devDependencies` only — **not** `peerDependencies`. If package A needs package B's types at build time (e.g., for DTS generation), B must be in A's `devDependencies` even if it's already a `peerDependency`. Without this, CI builds fail because packages build in parallel/alphabetical order.

**Type Migration Gotcha:** When moving types between packages, `pnpm typecheck` resolves workspace packages via `dist/` (not source). Build the source package first: `pnpm --filter @waveform-playlist/PACKAGE build` before `pnpm typecheck`. Same applies to *adding* fields to interfaces in upstream packages — downstream `pnpm typecheck` won't see new optional properties (`TS2353` / `TS2339`) until the upstream is rebuilt. Also grep the entire repo for old import paths — easy to miss straggling imports.

**Downstream tests resolve engine via `dist/`, not source:** after changing engine *behavior* (not just types), run `pnpm --filter @waveform-playlist/engine build` before running `browser`/`dawcore` vitest, or they exercise the OLD behavior (a RED-check against unbuilt source gives a false pass). The `dawcore`/`browser` packages' own source is transformed from TS on the fly by vitest, so changes *within* those packages need no rebuild.

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
- Example pages that restore persisted state (e.g. dawcore-wam's localStorage chains) shift layout after load — pointer clicks can land on moved elements and silently miss. Drive verification with `element.click()` inside `browser_evaluate`, or clear storage / wait for restore before clicking.
- Synthetic `dispatchEvent(new PointerEvent(...))` cannot drive `PointerHandler` interactions — `setPointerCapture` throws `NotFoundError` for fabricated pointerIds. Use real input (`page.mouse.click/move/wheel`) when verifying seek/drag/wheel behavior in a live browser.
- **MCP-automated browser tabs are usually backgrounded** (`document.visibilityState === 'hidden'`) → `requestAnimationFrame` is throttled to ~0, freezing the rAF-driven playhead/time *regardless of code*. When debugging playback/recording via chrome-devtools or claude-in-chrome MCP, check `visibilityState`/rAF liveness FIRST; assert on rAF-independent state (`currentTime` from setState, clip DOM `left`, console logs) or have the user foreground the tab. A "frozen playhead" in a hidden tab is almost always this, not a bug. Hidden tabs ALSO throttle `setTimeout` to ~1s, so setTimeout-based waits crawl — the recording stop-handshake/drain loop can take tens of seconds to finalize a clip in automation; verify record→stop on a foreground tab.
- **Recording flows are fully testable headless with a synthetic mic** — Playwright MCP `browser_run_code_unsafe`: `context.grantPermissions(['microphone'], { origin })` (per-origin — re-grant for each port) + `context.addInitScript` replacing `navigator.mediaDevices.getUserMedia` with an oscillator → `createMediaStreamDestination()` stream (wrap the track's `getSettings` to report `channelCount`/`sampleRate`; also stub `enumerateDevices`). Headless Chromium reports `visibilityState: 'visible'` with full-rate rAF — sidesteps the hidden-tab trap entirely, and the whole record→overdub→finalize flow runs deterministically. When a claude-in-chrome tab won't foreground (display asleep/locked — AppleScript `activate` + window reorder don't wake rAF), switch to headless Playwright instead of fighting window management. The dawcore record demo needs its `#mic-btn` clicked first (`editor.recordingStream` is set there, not by the record button). Its record button also AUTO-CREATES a new track when nothing is selected — to test punch-in-on-top, select the content track first (`editor._setSelectedTrackId(id)`), or you'll record onto a fresh empty track and measure the wrong one.
- **Synthetic `.click()` on a dawcore web-component HOST (`daw-stop-button`, etc.) silently no-ops** — the `@click` is on the inner `<button>` in shadow DOM, and a host-targeted click doesn't propagate in. Click `el.shadowRoot.querySelector('button')` (or use real pointer input). It looks like a broken control but isn't — a host `.click()` only works when the page also adds a host-level listener (as the record demo does for its record button).
- **Synthetic `.click()` on a Play button can wedge `isPlaying` with no audio** — the React handler runs but the untrusted-gesture `media.play()` is rejected by autoplay policy, so the UI shows playing (Play disabled) while nothing plays. Use real input (`page.locator(...).click()`) for playback in MCP-driven browsers.
- **Playwright MCP element screenshots (`target:`) can capture a stale frame** disagreeing with live DOM state during rAF-driven animation (playhead/progress) — use viewport screenshots (no target) for animated-UI evidence, and assert positions by sampling the DOM (`el.style.transform`) rather than trusting the image.
- **Playwright MCP screenshots with relative filenames land in the repo root** (plus logs in `.playwright-mcp/`) — untracked clutter that can slip into `git add -A`. Delete them before committing, or pass absolute scratchpad paths.
- **Only full `pnpm test` results are valid** — standalone `npx playwright test <spec>` races the cold `webServer` dev server (docusaurus clear + lazy compile) and produces 20+ false readiness failures. `effects.spec.ts` has known intra-run `beforeEach` readiness-timeout flakes (failing subsets VARY between runs — a real regression fails the same tests every time).
- **Firefox `innerText` excludes non-selected `<option>` text** (Chromium includes it) — assert `select.options` structurally, never via body-text probes, in cross-browser checks.
- **Pages importing `tone` have ≥2 AudioContexts** — Tone's orphaned default (created at import, before `getGlobalContext()`/`configureGlobalContext` replaces it) coexists with the app's global one; in native mode both are native `AudioContext`s and the orphan can even report `running`. When instrumenting the graph (analyser taps, context probes), select by MEASURED SIGNAL (RMS > 0), never by constructor name or `state`.
- **Tapping master output in apps that don't expose their graph** (React provider pages): `page.addInitScript` a shim wrapping `AudioNode.prototype.connect` that reroutes destination-bound connects through a created `AnalyserNode` (analysers are pass-throughs) — captures the true final mix for RMS/spectral assertions. Must be injected BEFORE page load.
- **Verifying WAV-export output in a live browser:** wrap `URL.createObjectURL` and filter captured blobs by `type === 'audio/wav'` — WAM hosting also creates `text/javascript` worklet blobs (a fresh set appearing per export is direct evidence of offline plugin re-instantiation). For per-track effect A/B, SOLO the affected track before comparing: a single-stem diff diluted across N stems can fall below a whole-mix RMS threshold (8.1% full-mix vs 51.9% soloed, identical absolute diff) — strengthen the measurement, never weaken the threshold. Sanity baseline: two fully-bypassed exports must be byte-identical (diff-RMS exactly 0).

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
- `examples/dawcore-wam/` — WAM 2.0 plugins end-to-end: community-library picker, GUIs, localStorage persistence, WAV export, plus in-browser Faust compilation (textarea → `addFaustEffect`). `@dawcore/wam` and `@dawcore/faust` are source-aliased (pure TS, no Lit decorators), which also resolves dawcore's dynamic imports of both
- `examples/media-element-player/` — React `MediaElementPlaylistProvider` starter; depends on only `@waveform-playlist/browser` + `@waveform-playlist/media-element-playout` (no `playout`/`tone`). First React example here — see the React-example note below.

**Do NOT exclude `tone` from `optimizeDeps` in examples that import it** (dawcore-tone) — excluding it serves its CJS dep `automation-events` raw and imports fail with "does not provide an export named". dawcore-wam's `exclude: ['tone', ...]` is inert there (native adapter, no tone import). One-time dep-optimization page reloads on first load after a config change are normal.

**Console access to workspace modules in Vite examples:** `await import('/@fs/<abs-repo-path>/packages/<pkg>/src/index.ts')` — Vite transforms TS on the fly, so devtools/evaluate can reach package APIs (e.g. `createWamInstance` for a param-range probe) without any page changes.

**Console access to node_modules deps in Vite examples:** `await import('/@id/tone')` — resolves through Vite's dep optimizer so pre-bundled CJS deps stay intact. The `/@fs/` trick FAILS for tone (`automation-events` served raw CJS → "does not provide an export named"); use `/@id/<bare-specifier>` for deps, `/@fs/<path>` for workspace TS.

**Adding a React example (not a web-component HTML page):** it must be a pnpm workspace member — add `examples/*` to `pnpm-workspace.yaml` and give the example a `package.json`, or `react`/`react-dom`/`styled-components` won't resolve (the dawcore examples sidestep this by not using React). In `vite.config.ts`: source-alias `@waveform-playlist/browser` (its `index.tsx` entry is engine-free, so the dev server never resolves `tone`/`playout`) AND set `resolve.dedupe: ['react', 'react-dom', 'styled-components']` — without dedupe the aliased packages load a second React copy → "Invalid hook call". `@dnd-kit/*` are *required* `browser` peers (they tree-shake out of a MediaElement-only bundle but must be installed). examples/ are outside `build`/`lint`/`typecheck` (all `packages/*`-only), so example `.tsx` isn't CI-checked.

**Verify an example actually renders with a headless browser** (Playwright/chrome-devtools MCP), not curl — Vite serving modules `200` proves they *transform*, not that the React app *mounts* (duplicate-React "Invalid hook call" only appears at render). `curl` was also flaky in the shell tool; prefer the MCP browser or `node`'s http.

### ESLint Baseline

Root flat ESLint config (`eslint.config.mjs`) with TypeScript + React Hooks checks. Run `pnpm lint` before committing — catches missing hook deps, unused variables, hook-rule violations.

**`pnpm typecheck` and vitest do NOT catch `react-hooks/exhaustive-deps`** — a missing hook dependency is an ESLint *error* that passes both and surfaces only on full `pnpm -w lint`. Because lint output carries ~359 pre-existing `@typescript-eslint/no-explicit-any` *warnings*, the real signal is the `✖ N problems (E errors, W warnings)` summary / exit code (require **0 errors**, exit 0) — don't grep the noisy output for "error" or trust scoped per-file typecheck.

**`Set<Function>` triggers `@typescript-eslint/no-unsafe-function-type` (an ESLint *error*)** — same trap class: `pnpm typecheck` and vitest pass it, only full `pnpm -w lint` flags it. Event-emitter listener stores need either an inline `// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type` (as `PlaylistEngine` does) or a typed-union `Set<Events[keyof Events]>` (with one localized cast at the `_emit`/attach call site).

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
10. **Webpack statically resolves literal dynamic imports** — even runtime-lazy `import('pkg')` chains are followed at build time. A package whose deps reference Node builtins (e.g. `@shren/faust2wam`'s `fs`/`url`) breaks the Docusaurus build; the website aliases `@dawcore/faust` to `false` since it ships no Faust UI. Vite tolerates the same chain.
11. **Structural interfaces against another package: verify method NAMES from the class declaration** — grep for `methodName(` can match internal call sites in method bodies (e.g. Transport's `timeToTick() { return this._tempoMap.secondsToTicks(...) }`). A wrong name copied into a structural type AND its test mocks passes every unit test and fails only against the real object — pair structural typing with at least one real-integration check.
12. **Optional Peer at Bundle Time ≠ Tree-Shaking** — To make a peer truly optional in the *bundle*, the core entry must have NO static `import` path to it (dynamic `import()` or a subpath-export split) — `sideEffects: false` is not enough. A single tsup barrel concatenates all modules; esbuild keeps an unused `import * as X from 'peer'` (side-effectful external), though Rollup-with-`sideEffects:false` drops it — so tree-shaking is bundler-dependent. Precedent: the `@waveform-playlist/browser/tone` subpath (#510) makes the core barrel engine-free under all bundlers.
13. **"No static import of X" guards must be transitive** — a regex scan over a list of literal files misses transitive edges (e.g. `WaveformPlaylistContext → soundFontSync → playout`). Bundle the entry with esbuild (`build({entryPoints, external:['peer','@scope/*'], treeShaking})`) and grep the output for `from "peer"` — that's the authoritative guard (`coreBarrelEngineFree.test.ts`).
14. **Variable-URL dynamic imports need BOTH bundler directives** — `import(/* webpackIgnore: true */ /* @vite-ignore */ url)`. webpack/Rspack (the website) statically resolves variable specifiers without `webpackIgnore` and fails at runtime with "Cannot find module <url>"; Vite (the examples) needs `@vite-ignore`. tsup/esbuild preserves both inline comments into dist (verified in dawcore-wam's `dist/index.mjs`). Precedent: `packages/dawcore-wam/src/loader.ts` (#540).

---

## Plans & Future Work

**Plans directory:** `plans/` contains future feature specs (waveform service, listening test tool).

**Effects/WAM roadmap:** Tracked as GitHub epics with native sub-issues — #412 (unified effects chain), #413 (WAM 2.0, `@dawcore/wam`), #414 (Faust), #415 (WCLAP spike). The architecture/design record lives in the epic issue bodies, not in docs/specs. TODO.md's WAM section is superseded by these issues.

**Web Components migration:** `docs/specs/web-components-migration.md` is the long-lived spec for the `@dawcore/*` WC surface (exception to the remove-specs-when-done rule; audited against code 2026-06-11). Remaining work is tracked as epics #452 (transport/control elements), #453 (record arming + VU meter), #454 (`<daw-player>`), #455 (annotations WC), #456 (accessibility), #457 (custom track controls), #458 (JSX types + CEM), plus standalone issues #489–#494.

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
- `packages/media-element-playout/CLAUDE.md` — HTMLAudioElement single-track engine, player-mode (resume/setSource/events), playbackRate-reset gotcha
- `packages/browser/CLAUDE.md` — Hooks architecture, effects, animation, context providers
- `packages/ui-components/CLAUDE.md` — Theming, virtual scrolling, ClipViewportOrigin
- `packages/recording/CLAUDE.md` — AudioWorklets, Firefox compat, VU meter, mic access
- `packages/annotations/CLAUDE.md` — Integration context, annotation provider pattern
- `packages/worklets/CLAUDE.md` — AudioWorklet processors (metering, recording)
- `packages/spectrogram/CLAUDE.md` — Integration context, SpectrogramChannel index
- `packages/dawcore/CLAUDE.md` — Lit Web Components, native AudioContext (no Tone.js), element types, CSS theming
- `packages/transport/CLAUDE.md` — Native Web Audio transport, scheduler, clock, MeterMap, PlayoutAdapter bridge
- `packages/dawcore-wam/CLAUDE.md` — WAM 2.0 plugin hosting, host init, SDK pinning, wam-studio reference
- `packages/dawcore-faust/CLAUDE.md` — In-browser Faust DSP → WAM compilation, faust2wam API facts, lazy compiler loading
- `website/CLAUDE.md` — Docusaurus site, CSS pitfalls, custom pages

---

**Last Updated:** 2026-06-10
