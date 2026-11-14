# Claude AI Development Notes

This file contains important context, decisions, and conventions for AI-assisted development on the waveform-playlist project.

## Project Overview

Waveform-playlist is a multitrack Web Audio editor and player with HTML canvas waveform visualizations. Currently undergoing a React refactor (Tone.js overhaul branch).

**Key Dependencies:**

- **Tone.js 15.1.22** (stable; the lockfile, website and examples) - Audio engine for playback, scheduling, and effects. `tone@next` (15.5.x) is also supported and gets its own CI job — see "Two Tone.js lines" in `packages/playout/CLAUDE.md`.

**Website aesthetic** — see `website/CLAUDE.md` for the Berlin-underground design system, dark-mode palette, and example styling guidelines.

## Project Roadmap

**Source of Truth:** `TODO.md` contains the complete multi-track editing roadmap and recently completed work.

**Current Phase:** v5.0.0 Stable

**Semantic Versioning:** Now that v5 is released, follow semver for all changes. Breaking changes require a major version bump. **Bumping a 0.x peer range is a MAJOR** for every package declaring it (e.g. `@dnd-kit/*` ^0.3→^0.5 → browser/ui-components/annotations majors): 0.x minors are breaking upstream, and consumers on the old range can't install. Removing an export in the same PR rides the same major.

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

**`workspace:*` in devDependencies does NOT trigger the republish cascade** — devDeps are build-time only (never published pins), so changesets correctly excludes such packages (e.g. transport/worklets in the 2026-07-12 annotation-suite release). When auditing a computed closure, check WHICH section a workspace ref lives in before suspecting a missed bump.

**Security-key-only 2FA (since 2026-10-28): `changeset publish` cannot publish from this session.** The account has no authenticator app, only a hardware key, so there is no OTP to type and npm has no TTY here — every package fails `EOTP` ("Open this URL in your browser to authenticate") before anything uploads, and `changeset publish` itself pre-prompts for a typed code. Procedure that works: `pnpm release:version` → review the closure → `pnpm build` → hand the user a dependency-ordered chain of `pnpm --filter <pkg> publish --no-git-checks && …` (toposort `dependencies` across `packages/*/package.json`) to paste into a REAL terminal, not the `!` prompt (npm's `auth-type=web` opens the browser for one key tap per package) → verify from here: `~/.npm/_logs` `http fetch PUT 202` + `verbose exit 0` per package is the immediate proof, packuments lag 3–8 minutes (poll with `Cache-Control: no-cache`) → chore(release) commit → GitHub release. `! npm login` fixes an expired token (`npm whoami` E401) but does not bypass 2FA for publishing. The `--otp` flow below applies only if an authenticator app is added as a second 2FA method.

**npm auth failures during `changeset publish` are disguised:** an EXPIRED token surfaces as `E404 Not Found - PUT …` ("could not be found or you do not have permission") on every package, not as a 401 — check `npm whoami` first (it returns the real E401). With 2FA-for-writes enabled on the account, `changeset publish` spawns `npm publish` with no TTY, so npm can't open its OTP prompt and fails with `E403 … Two-factor authentication or granular access token with bypass 2fa enabled is required` — even when the user runs it themselves. Fix: `pnpm exec changeset publish --no-git-tag --otp=<6-digit code>` (one code covers all packages in the run), or a granular token with 2FA bypass in `~/.npmrc`. Publish PUTs return `202` and packuments lag the CDN by 1–3 minutes — poll `curl` with `Cache-Control: no-cache` before concluding a publish failed (the npm debug log's `http fetch PUT 202` + `verbose exit 0` lines are the immediate proof).

**Build before publishing:** No package defines prepublish hooks — always run `pnpm --filter <pkg> build` before `pnpm publish`, or the tarball ships a stale `dist/`.

**Prerelease Tag:** Use `@next` for prerelease versions when preparing future major releases.

---

## Documentation Guidelines

**Where to track progress/updates:**

- ✅ **TODO.md** - Roadmap, recently completed work, session notes, progress updates
- ✅ **CLAUDE.md** - Architectural decisions, conventions, patterns (minimal, timeless)
- ✅ **PROJECT_STRUCTURE.md** - Architecture, file organization, data flow (NO progress/todos)

**PROJECT_STRUCTURE.md is not prettier-formatted** (outside lint scope): `prettier --write` on it rewrites about 60 unrelated lines. Edit it by hand.

**PROJECT_STRUCTURE.md is audited after structural changes:** after adding packages, directories, or architectural subsystems, audit PROJECT_STRUCTURE.md and update it in the same PR. Structure/data-flow only — no progress notes (existing rule).

**When completing work:**

1. Update CLAUDE.md only if architectural decision or pattern established
2. Update PROJECT_STRUCTURE.md only if structure/architecture changed
3. Never add progress/changelog to PROJECT_STRUCTURE.md

**Design docs and implementation plans:** Design docs go in `docs/specs/YYYY-MM-DD-<topic>-design.md`; matching implementation plans go in `docs/plans/YYYY-MM-DD-<topic>.md`. Commit both during development — they drive the spec-review and task-execution workflow. **When implementation is finished, `git rm` both from the branch before the PR merges** — they're working documents, not durable records. The PR description carries the lasting summary of what was built and why.

### Documentation Maintenance

**API Source of Truth:**

- `WaveformPlaylistProvider`, `TrackState`, `ClipPeaks`, `TrackClipPeaks`: `packages/browser/src/WaveformPlaylistContext.tsx`
- Context value types and hooks of both providers: `packages/browser/src/contexts/playlistContexts.ts`
- Context hooks, one per group of fields that change together (#768, #688; the table is in `packages/browser/CLAUDE.md`, "Contexts Are Grouped by Change Rate"). Under either provider: `useIsPlaying`, `useCurrentTime`, `useSelection`, `useActiveAnnotation`, `useAnnotations`, `useAnnotationOptions`, `usePlaybackControls`, `usePlaybackRefs`, `usePlaylistView`, `usePlaylistSettings`, `usePlaylistZoom`. `WaveformPlaylistProvider` only: `useEditorControls`, `useEngineRefs`, `usePlaylistTimeline`, `usePlaylistMixer`, `useTrackReorderPreview`, `useLoop`, `useSelectedTrackId`, `useUndoRedo`. `MediaElementPlaylistProvider` only: `usePlaybackRate`, `useMediaElementTrack`
- `MediaElementPlaylistProvider`, `MediaElementTrackConfig`: `packages/browser/src/MediaElementPlaylistContext.tsx`
- AudioTrackConfig interface: `packages/browser/src/hooks/useAudioTracks.ts`
- Effects hooks return types: `packages/browser/src/hooks/useDynamicEffects.ts`, `useTrackDynamicEffects.ts`
- Peak types (`Peaks`, `Bits`, `PeakData`): `packages/core/src/types/index.ts` (re-exported by `webaudio-peaks` for backwards compat)

**Common Doc Drift:** Docs may reference deleted hooks, wrong property names (e.g., `gain` vs `volume`, `seek` vs `seekTo`), or properties attributed to wrong context hooks. Always cross-check docs against source interfaces.

**Verify docs render:** `pnpm --filter website build` (CSS calc warnings are pre-existing, harmless)

**Heading ids:** `## Title {#custom-id}` does not compile here (`MDX compilation failed`, with no line number). Link to the generated id and check it in the build output: the `id` of the `<h2>` in `website/build/docs/.../index.html` (code spans and punctuation are dropped, e.g. "`useIntegratedRecording`: a take stays on its track; pass `recordingTrackId` to the preview" becomes `useintegratedrecording-a-take-stays-on-its-track-pass-recordingtrackid-to-the-preview`).

**Package READMEs are a doc surface.** `packages/*/README.md` is what npm shows, and it is not under `website/docs`: on #756 `packages/dawcore/README.md` still documented `render-mode="piano-roll"` and `packages/engine/README.md` had a `ClipTrack` literal that no longer compiled, both found by a reviewer. When an attribute, prop or required field changes, grep `packages/*/README.md`, the root `README.md` and `examples/` as well as the website.

**Wrong documentation found on the way is corrected in the same PR (maintainer's rule, 2026-11-12).** Also when it is older than the PR and outside its subject: fix it, check the new sentence against the source line, and list it in the PR text. On #685 part 3 that was two components documented but not exported, an example outside its provider, four README links and an error message's URL. To check every documentation URL in the repository against the doc files that exist: extract `https://naomiaro.github.io/waveform-playlist/docs/<path>` from the tracked `.md`, `.txt`, `.ts` and `.tsx` files and test for `website/docs/<path>.md`.

**Do not write a PR's number into a file before the PR exists.** Issues and PRs share one counter: on #763 two package notes said "#762" for the PR, an issue filed in between took 762, and the notes needed a commit to correct them. Refer to the issue the work closes, or add the PR number after `gh pr create` has printed it.

**Check where an error lands before documenting how to catch it.** For #756 the engine was made to throw on an invalid track, and the first plan was to tell React consumers to use an error boundary. Reading the provider showed both engine calls inside `try`/`catch` in an async function: React never sees the throw, and the provider reports it through `onError` and stays in its loading state. The guide says that instead. Trace the throw to where it stops, in each library, before writing the advice.

**A reviewer for documentation claims:** a read-only agent told to find the source line that makes each sentence of the new text true (and to list the public exports the diff removed or renamed) found, on #756, two stale package READMEs, a sentence that was false in one path (`recordingTrackId` "null when no take is running", not true after a microphone unplug; fixed in the code) and a snippet missing a required field. Give it the doc files and the source files to check against, not a summary of the change.

**`feature-dev:code-reviewer` has no Bash:** it cannot `git diff`, so it reviews the checked-out tree and infers the "before" side. Name the changed lines in its brief, or use `general-purpose` when the review needs the diff or a test run.

**Decide the doc surface in the design, before the first review.** On #762 a new DOM attribute (`data-selected`) was documented only after the review had started; each docs commit needed its own round, and the rounds found a sentence that overclaimed and a CSS example that did not work. When a change adds anything a consumer can see (attribute, prop, theme key), name the guide page in the design message.

**Render a CSS or markup example before committing it.** The first `data-selected` example (an `outline` on the row) was invisible in the browser. Inject it with `page.addStyleTag` on an example page and look at a screenshot.

**Moving/Renaming Doc Pages:** Run `pnpm --filter website build` after moving docs — Docusaurus broken link checker will find all internal links that need updating.

**Root README.md lists every demo:** Whenever an example page or a new `examples/*` app is added, update the root README.md's examples section (run commands + per-page lists) in the same PR. The README is the front door — a demo that isn't listed there doesn't exist for most visitors.

**A new website example page touches seven places:** the component (`website/src/components/examples/`), the page (`website/src/pages/examples/`, `createLazyExample`), the card in `pages/examples/index.tsx`, the root README table, `ROUTES` in `e2e/global-setup.ts`, a spec in `e2e/`, and the 1200x630 social image. A MediaElement demo also needs peaks: `audiowaveform -i x.mp3 -o x.dat -z 256 -b 8` (the sample rate in the file is the source's, e.g. 44100 for an mp3).

**Avoid Duplicating Code in Example Pages:** Example pages (`website/src/pages/examples/`) should link to guide docs for code walkthroughs, not inline full code blocks. Duplication creates maintenance burden when APIs change.

**LLM-Readable Docs:**

- `website/static/llms.txt` — Library discovery page, served at `/llms.txt`. Update when packages, architecture, or key APIs change.
- `website/docs/llm-reference.md` — All TypeScript interfaces from source, no prose. Update when any context type, hook signature, or component prop changes.
- **Keep all doc surfaces in sync** — When adding new context fields, hook returns, or component props, update: (1) `llm-reference.md` (interfaces), (2) `llms.txt` (descriptions), (3) `docs/api/hooks.md` (context value interfaces), (4) `docs/examples.md` (code snippets), (5) example page files in `src/pages/examples/` (keyboard shortcuts sections, feature lists), (6) provider API docs (`docs/react/api/providers/*.md`) AND guide hook tables (e.g. `media-element-playout.md`), (7) the root README demo table. **Breaking changes** additionally get an entry in `website/docs/react/upgrading.md` (one section per change: what changed, a **Find** pattern, a **Replace with** before/after) — that page is linked from `llms.txt` and `llm-reference.md` so a coding agent can migrate a consumer from it alone. For dawcore element attributes also: `packages/dawcore/COMPONENTS.md`, the element's entry in `packages/dawcore/CLAUDE.md`, and the attribute tables in `docs/specs/web-components-migration.md`.

---

## Code Conventions

### No Cross-Package Re-Exports

**Rule:** Packages must not re-export symbols from other packages. Consumers import from the canonical source directly. This prevents transitive dependency issues (e.g., #373 where dawcore pulled in React via recording's re-exports). When moving functions between packages, update all import sites — don't leave re-exports for backwards compat.

### One Owner per Exported Name (#770)

**Rule:** a name is exported by one package. Bound controls live in the lowest package that can reach their state (the four annotation controls are in `annotations`, which reads browser's hooks). The pairs that remain on purpose are the five controlled/bound controls of ui-components and browser. `packages/browser/src/__tests__/oneOwnerPerExport.test.ts` scans the entries of browser (also `./tone`), annotations, ui-components, spectrogram, recording and core; its header lists what it cannot see. To find overlaps yourself, compare the name sets of each `dist/index.d.ts`, and check second entries (`./tone`) too.

**No literal element id, and nothing read from the page (maintainer, 2026-11-13).** Ids come from `useId()`; a value another component holds arrives as a prop or a context, never through `document.querySelector`. The same test scans for a literal `id=` / `htmlFor=`.

**Every string a component draws can be supplied by the app (translation frameworks).** `children` for a label, `title` for a tooltip; no English-only helper (`getShortcutLabel` was removed for this). The rest of the library is #808.

### One Owner per Piece of State

**Rule (maintainer, 2026-11-13): every piece of state has one owner. Everything else subscribes to it and changes it by asking the owner.** No second stored copy that has to be kept in step.

- A controlled prop with a change callback is two owners when the library also keeps and changes the value: the app's state is one place, the library's copy the other. A callback that hands back a whole array or object is a write computed earlier than it lands, and storing it overwrites whatever was written in between.
- A guard, a merge or a flag between two owners closes one sequence of events; the next sequence needs another. Name the owner instead.
- Moving a seam is not removing it. After choosing an owner, list every other object that still stores the value and writes back.
- A value computed from the owner during render, a cached projection that is never written back and a one-way cache downstream (what an audio adapter holds) are not second owners.
- Where it came from: #812. The tracks had two owners (the app's `tracks` state and the engine, joined by `onTracksChange`), and one day of work found a loaded clip that stayed "loading" in the app's state, a lost update (a page showing 2, 4 and 3 rows of 4) and an undo that removed a track the app still held; a first redesign moved the same seam between a store and the engine. The issue body is the record.

The project skill `state-ownership` (`.claude/skills/state-ownership/SKILL.md`) is how to apply it: the owner table that opens a design, a plan or a review, what to send the maintainer when a row has two places, and the shapes in this codebase that hold one owner (`ValueSource`, `EffectsRack`, `annotationPreview`).

### Declarative Over Imperative

**Rule:** Consumer code should read as a declaration of what they want, not how to set it up. When multiple hooks/providers must be wired together, create a higher-level component that reads from context internally and exposes simple boolean props.

**Examples:** `ClipInteractionProvider` (replaces DragDropProvider + sensors + modifiers + handlers), `KeyboardShortcuts` (replaces usePlaybackShortcuts + useClipSplitting + useAnnotationKeyboardControls wiring), `ClearAllButton` (wraps stop + clear). Keep the low-level hooks exported for power users who need custom behavior.

The view follows the same rule since #703: `<Waveform />`, `<WaveformEditor />` and `<MediaElementWaveform />` are compositions of exported parts, and a part wires what it needs itself (`WaveformAnnotationBoxes` owns its drag provider and sensors).

### React/TypeScript

- **React 19 only** (since #702): every React package peers on `react`/`react-dom` `^19.0.0` and `styled-components` `^6.0.0`, and all workspace devDependencies pin the same React, so there is ONE React copy in the workspace. Keep it that way — a package without an explicit `react` devDependency gets whatever pnpm auto-installs for the peer, and a second copy breaks any jsdom test that mounts components across packages ("Cannot read properties of null (reading 'useContext')", or `(reading 'use')` from a library hook since #771: that is what `use()` gives with no dispatcher, run in a test; the two-copies case itself was not re-run / "A React Element from an older version of React was rendered"). `trackControlsDisabledWhileLoading.test.tsx` in browser is the template for mounting the full `<Waveform />` under jsdom.
- Use functional components with hooks
- **Contexts are read with `use(Context)` and provided with `<Context value>` (#771).** In React 19 `X.Provider === X`, so the provider tag changes nothing React sees. Lint fails on a new `useContext()`, `<XContext.Provider>` or `forwardRef` (`@eslint-react/eslint-plugin`: `no-use-context`, `no-context-provider`, `no-forward-ref`, for `packages/*/src`). The two call rules match a direct call by name (an aliased import, `useContext as read`, is not reported). The plugin does not report a provider held in an alias, passed to `createElement`, an `<X.Consumer>`, or a context whose name does not end in `Context` (run on #771): name every context `…Context`. `react-hooks/rules-of-hooks` does not report a conditional `use()`; the `no-restricted-syntax` rule in `eslint.config.mjs` reports the common forms (`reactContextLint.test.ts` in browser runs the real config over snippets of each) and not a `use()` inside a callback, which neither rule sees (the comment above the rule lists what it misses). Keep every read at the top level of its component or hook, before any early return.
- Props interfaces: `{ComponentName}Props`
- Use `React.FC<Props>` for component types
- Prefer `const` over `let`

### Boolean Props Convention

**Rule:** a boolean prop is for an independent option of ONE component, and it defaults to `false` so it can be enabled with shorthand syntax.

```typescript
// ✅ GOOD - an option of the component that takes it, off by default
<WaveformTracks gainScaled />
<ClipInteractionOptions touchOptimized>

// ❌ AVOID - a (made-up) prop that defaults to true needs an explicit false
<SomePart shown={false} />
```

**Why:** JSX shorthand `<Component prop />` is equivalent to `<Component prop={true} />`. Defaulting to `false` enables this clean opt-in pattern.

**Not for "does this part exist" (#685).** Whether something is drawn is decided by rendering its component, not by a boolean on a parent: `<WaveformClipHeaders />` inside `<WaveformTracks>`, not `<Waveform showClipHeaders />`; `<WaveformTimescale />` in the root, not `timescale` on the provider. A boolean that switches a part on puts every part's options on one root and needs a second source as soon as the part has options of its own. When a combination is common, give it a name as a ready-made composition (`<WaveformEditor />`), which takes no options for its parts.

Props that still break this convention on `main` (four that default to `true`, and two on ui-components' `Clip` that decide whether a part exists, `showFades` and `disableHeaderDrag`) are listed in #828, each waiting for a yes or no; do not copy them as precedent.

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
  - **Format the files you changed, not the package.** `npx prettier --write src` in a package rewrote a file the change had nothing to do with (`packages/dawcore/src/styles/theme.ts`, which is not prettier-clean on `main`); it had to be restored with `git checkout --`. Pass the changed paths, and read `git status --short` before committing.
  - **`pnpm lint` is `prettier --check && eslint` (prettier FIRST)** — a formatting issue exits 1 with NO `✖ N problems` ESLint summary (eslint never runs after prettier fails). Exit 1 + missing summary = a prettier failure, not lint errors → `pnpm format` (or `prettier --write <file>`). Don't chase a phantom "0 errors but exit 1".
- **Example HTML pages are outside lint scope** — `pnpm lint` only covers TS/TSX under each package's `src/`; prettier flags every HTML file in `examples/` if run on them directly. Match the existing file style by hand, don't reformat them. (Do not bold-wrap glob patterns containing `**` in this file — prettier's markdown parser corrupts them.)
- **New packages**: After adding a new `packages/*/package.json`, run `pnpm install` and commit `pnpm-lock.yaml`. CI uses `--frozen-lockfile` and will fail if the lockfile is stale.
- **Transitive Dependabot alerts**: try `pnpm update -r <pkg>...` first (refreshes the lockfile within parents' existing ranges) before adding a `pnpm.overrides` entry — most alerts are just stale lockfile patches the parent range already allows. Reserve overrides for a version an intermediary pins _below_ the fix (forced; may break upstream's tested range, e.g. js-yaml 3.x via gray-matter).
- **`pnpm update -r <names>` silently degrades to direct-deps-only** (pnpm 8) if you pass `--depth Infinity` OR if any named package is a direct dep somewhere in the workspace (e.g. `uuid`, `esbuild` in browser) — the transitive names in the same call are then skipped with no error. Keep direct deps out of the list and confirm by grepping `pnpm-lock.yaml` for the new versions.
- **Before removing a `pnpm.overrides` entry, check the FIXED alert history, not just open alerts** — `gh api --paginate 'repos/naomiaro/waveform-playlist/dependabot/alerts?state=fixed&per_page=100'` and test each `vulnerable_version_range` against the new lockfile; a dropped override silently reopens old alerts (serialize-javascript and uuid did, 2026-10-06). Scope a new selector to the parents' declared spec (`esbuild@^0.27.0`, not `esbuild@<0.28.1`) so unaffected consumers (vite 6's `esbuild ^0.25`) aren't dragged along. `pnpm audit` reads the npm advisory DB, which runs ahead of this repo's Dependabot list — use it to find in-range fixes worth taking early.
- **Verify bundler tree-shaking with the real binary** — `npx esbuild`/`npx rollup` can be command-not-found; with stderr suppressed, grep on empty output gives a FALSE clean pass. Use `node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild` directly, don't suppress stderr. esbuild emits `from "x"` (with a space); single-file `--outfile` inlines dynamic `import()` targets — use `--splitting --outdir` to distinguish eager (entry chunk) from lazy.
- **`dependencies`→`peerDependencies` move churns the lockfile** — it changes pnpm hoisting and can re-resolve unrelated transitive deps (e.g. `@types/react` 19→18 from a workspace `^18` vs react-19 mismatch). A pristine-base `pnpm install` no-op confirms the move (not pre-existing drift) is the cause; `--frozen-lockfile` still passes if internally consistent.
- **Dev server**: `pnpm --filter website start` - Docusaurus dev server
- **Never run `docusaurus clear` while another docusaurus dev server for the same repo is running** — they share the persistent rspack cache (`node_modules/.cache`/`.docusaurus`), and clearing it out from under a live server corrupts that cache: symptoms include stale DOM state persisting across reloads and rspack panics in the running server's terminal. Stop the running server first, or clear from a checkout that has no server attached.
- **Example: dawcore-native**: `pnpm example:dawcore-native` — Vite dev server at localhost:5173 (Vite falls back to next free port when 5173 is taken; check the server's startup log for the actual URL)
- **`pnpm exec vite` from an `examples/<x>/` dir with no package.json serves the REPO ROOT** — run `pnpm exec vite --config examples/<x>/vite.config.ts --port N --strictPort` from the root (`--strictPort` fails fast instead of silently falling back).
- **Example: dawcore-tone**: `pnpm example:dawcore-tone` — Vite dev server at localhost:5174 (same fallback behavior — log shows the actual port)
- **Example: dawcore-wam**: `pnpm example:dawcore-wam` — Vite dev server at localhost:5175. WAM plugins load from webaudiomodules.com (network required)
- **`pnpm <script> -- --flag` passes a LITERAL `"--"`** — `pnpm example:dawcore-native -- --port 5199` and `pnpm --filter website start -- --port N` hand vite/docusaurus the strings `"--" "--port" …`, which they ignore (server starts on its default port; docusaurus exits 1). Use `pnpm exec vite --port N` / `cd website && pnpm exec docusaurus start --port N`, or read the startup log for the real port.
- **Vite dev servers SPA-fallback unknown paths to index.html with HTTP 200** — `fetch(url).ok` is not proof an asset exists; a ~3KB "audio file" that fails `decodeAudioData` is usually the HTML fallback. Verify content-type or byte size when fetching fixtures in browser-driven tests.
- **Docusaurus dev pages live under the site baseUrl `/waveform-playlist/`** — ad-hoc browser scripts must use `http://localhost:<port>/waveform-playlist/examples/...`; the bare path returns SPA-fallback 200 with no page (the e2e config's BASE_PATH already handles this).
- **Unit tests**: Run from each package directory with `npx vitest run` (engine, core, playout, ui-components, browser)
- **vitest does NOT typecheck** — it transpiles TS without type errors, so a test with a wrong/missing prop passes RED→GREEN and only fails `pnpm typecheck` (which covers `src/__tests__`). Run typecheck after adding tests, not just vitest.
- **Packages do not share a compile target.** A regular expression with the `s` flag (`/a.*b/s`) type-checks in `core` and `engine` tests and fails in `browser` with `TS1501` (flag needs ES2018). In a test that may be copied between packages write `[\s\S]*`.
- **"Behavior unchanged for X" claims in changesets: diff old vs new numerically** — `git show main:<file> > <scratch>/old.ts`, run both versions over the common inputs with node, and compare. Reasoning alone missed that bar-anchored snapping also changes 3/4 and 6/8 half-note/triplet grids, not just odd meters (#647).
- **vitest 4+: a mock called with `new` must be implemented with `function`/`class`, never an arrow** — `vi.fn(() => x)` / `.mockImplementation(() => x)` / `.mockImplementationOnce(() => { throw … })` throw `… is not a constructor` when production code does `new Mocked()`. A loose `.toThrow()` then passes on that TypeError instead of the intended error — grep test output for `did not use 'function' or 'class'`. Type mocks as `Mock<Sig>` / `MockInstance<typeof fn>` (bare `ReturnType<typeof vi.fn>` is `Mock<Procedure | Constructable>`, not assignable to a callback type), and use `mock.lastCall`, not `mock.calls.at(-1)` (repo `lib` is ES2020; `.at` only type-checked via an `@types/node` 20 shim that v24 dropped).
- **Mounting dnd-kit-backed components under jsdom needs a ResizeObserver stub imported FIRST** — `@dnd-kit/dom` references it at module-load time. Each package has `src/__tests__/jsdom-polyfills.ts` (browser, ui-components, annotations); import it before anything else. `annotations` has no vitest config (node env default) — add `// @vitest-environment jsdom` per file.
- **Do not press a dnd-kit draggable element in a jsdom test.** dnd-kit puts `role="button"` and `aria-roledescription="draggable"` on it at an unpredictable moment after mount, and `ClipView`'s mouse-down handler ignores presses on a draggable. A test that pressed `[data-clip-container]` (the draggable itself when clip dragging is off) passed 5 runs in 6. Run a new jsdom interaction test several times before trusting it, alone with `-t` as well as in its file: this one failed every time alone.
- **Counting React renders in a unit test:** `vi.mock('@waveform-playlist/ui-components', async (importOriginal) => …)` returning `{ ...actual, Clip: (props) => { count++; return createElement(actual.Clip, props); } }`, with the counters in `vi.hoisted`. A wrapper counts its parent's renders, not renders its inner component gets from a context, so count a child the component renders unconditionally (`SmartChannel` for `ChannelWithProgress`). Template: browser's `visualizationMemoBoundaries.test.tsx`.
- **vitest `-t` is a REGEX, not a substring** — `-t 'play() after'` matches nothing (the `()` is an empty group). Filter on a paren-free fragment of the test name.
- **Closing an audit epic:** when an audit says which files it did NOT read, the epic is not done until they are read. On #704 the skipped files held six findings, among them one user-visible bug (`useDynamicTracks` under StrictMode) and one audio-graph cost (the effects chain rewired on every parameter change). Two read-only agents with disjoint file lists, each told to list every file with "read fully, nothing found" where that was the result, then every finding checked against the source before it is acted on.
- **An audit agent checks a rule from its text, not from its name.** In the first closing pass of #703 at least three of the five auditors went through the rule ids without opening the rule documents, so that pass's "checked, none found" lines were worth little. The second pass found an engine that is not disposed on unmount (#811) and about twenty more findings above low in the same files. The brief that worked: read both rule documents and every package note for the files FIRST and state the line count read of each at the top of the report, or stop; then every rule in document order with its incorrect pattern quoted, what was searched and where; report additions to the first list only (give them the list). Give the auditor the `git ls-files … | grep -v __tests__` command for its file list, not a count: two of the five counts in my brief were wrong.
- **Throwaway probe tests:** to observe real provider behaviour (adapter calls, cursor position) before deciding on a fix, write a scratch `zz*.test.tsx` in the package's `__tests__`, have it `appendFileSync` its observations to a scratch file (vitest's reporter hides `console.info` from a grepped run), run it, then delete it and confirm `git status --short` is clean. To prove a new test is RED without the fix: `git stash push <the one source file>`, run the test, `git stash pop`. Read WHY it failed: when the stashed file depends on something else the branch changed (a field removed from a context), the old file fails for that reason and proves nothing; `git checkout main -- <file>` after committing, then `git checkout HEAD -- <file>`, has the same trap. And when two changes each make a test pass (a guard plus a recovery path), reverting one leaves it green; say so rather than claim the test covers it.
- **Direct DOM writes and React's diff:** a component that writes styles or attributes itself (a subscription, as `SegmentedVUMeter` does for a live meter) must not assume React will correct them on the next render. React writes only what differs from ITS previous render, not from the DOM, so a prop change that renders the same values as last time leaves whatever was written in between. Remount (a `key`) when the writer goes away, and redraw after each commit while it is attached; test by rendering once at the current value, changing the DOM by hand, and rendering again.
- **Selectors over a store keep a parent quiet:** `useSyncExternalStore(subscribe, () => store.getSnapshot().someNumber)` re-renders only when the number changes, however often the store publishes. That is how the visualization shell follows a recording (channel count, a timeline end that moves in 10-second steps) without rendering per frame (#695). The selector must return a primitive or a cached object.
- **A context read for one field subscribes to every field.** Two parts of the view called `usePlaylistTimeline()` for `tracks`; the value also carries `isReady` and `onTracksChange`, so they rendered for those too (#685 review). Before a component reads a provider value, list everything that changes it. To find which context changed in a test: temporary children that each call one hook and count their renders (`const M = () => { usePlaylistMixer(); n.mixer++; return null; }`). It showed the "extra" render a reviewer attributed to the timeline was the mixer, and present on `main`.
- **A value needed only inside an event handler is not a reason to subscribe the view.** `useSelectionDrag` needs the automatic-scroll setting at the release; calling `usePlaylistSettings()` in the view rendered it on every toggle, and the #768 render-count test failed. A memoized child that renders nothing follows the setting and writes a ref in a layout effect (`AutomaticScrollFlag`); the handler reads the ref. Cost: that one component per toggle.
- **StrictMode in a hook test: `renderHook(fn, { wrapper: StrictMode })`, never a function that returns `<StrictMode>`.** With the function form the hook's effects are NOT double-invoked (measured: 1 setup against 2), so the test passes without the fix it is meant to guard. Two effects-hook tests had been vacuous this way; `useDynamicTracks` dropped every decode under StrictMode (a cancelled flag set in the cleanup and never cleared on setup) with no test noticing.
- **Fake timers + a promise that rejects:** attach `expect(p).rejects…` BEFORE `vi.advanceTimersByTimeAsync`, or vitest reports an unhandled rejection for the gap.
- **Removing a field of a hook's value: search the destructurings, and search `website/src`, `examples/` and `debug/` as well as the packages.** For #685 part 3 `usePlaylistView().controls` was removed after a grep for `\.controls\b` over the packages found one reader. Three example components had `const { sampleRate, controls } = usePlaylistView()`; one used it inside an effect, so the recording page loaded, drew the same pixels and crashed on Record (`Cannot read properties of undefined (reading 'show')`). Nothing typechecks `website/src`; only the e2e run found it. Grep the field name next to the hook's name in every directory that imports the package, and ask what each reader used the value FOR before writing "no replacement" in the upgrade guide.
- **A page that loads is not a page that works: press its controls.** `probes/exercise685.cjs [port] [route…]` loads each of the 21 React example pages, clicks the waveform and every button and checkbox, and reports page errors, the error boundary's text and misplaced-part warnings. The e2e routes cover 16 of those pages and `probes/shotsAll685.cjs <tag> <outdir> [port] [route…]` records geometry only (give it `NEWTRACKS_FILE=<audio file>` for `/examples/newtracks`, which has no playlist until a file is added). Run both after converting examples.
- **`probes/shotsAll685.cjs` records 17 pages by default, not 21.** For the other four pass them as routes: `… <tag> <outdir> 3077 beats-and-bars minimal newtracks stereo` (with `NEWTRACKS_FILE`). `exercise687.cjs` does cover all 21.
- **Comparing probe logs between two runs:** strip the timings and sort the lines before `diff`; the root lines of one commit come out in a different order from run to run, and `draggables` in the geometry file is the dnd-kit count that differs between loads.
- **zsh does not split an unquoted variable into words.** `npx eslint $FILES` and `perl -pi … $FILES` hand the whole list over as one argument ("No such file or directory", or an empty result that looks like a pass). Pipe the list through `xargs`.
- **A `cd` in one Bash call stays for the next ones.** After `cd packages/browser && npx vitest …` a later `packages/…` path or `git` command resolves from there. Run a package command in a subshell, `(cd packages/browser && npx vitest run …)`, or start each call with `cd` to the repo root.
- **A script that rewrites an import list drops a comment inside it** (a second time on #685: `// PlayButton, PauseButton, StopButton omitted …` became three names). After a codemod over imports, diff for removed `//` lines.
- **A warning that is written once per page needs a reset between tests.** `warnMisplacedPart` remembers its messages in module state, so the second test in a file that expects the same message sees none; `resetPartWarnings()` in `afterEach`.
- **The count of dnd-kit `aria-roledescription="draggable"` attributes on a page differs between loads** on pages without a `ClipInteractionProvider` (effects: 3 or 4; stem-tracks: 21 to 24; ten loads each on `main` and on the branch). Do not compare it in a before/after probe.
- **To see "peak data that cannot be read" in a browser**, serve the `.dat` with its `samples_per_pixel` field multiplied (`probes/emptyrow685.cjs`: a `page.route` handler that fetches the file and rewrites bytes 12 to 15); the resample to the provider's finer zoom then throws.
- **A documentation agent reads source: do not run a mutation script while it works.** Start the mutation run when the agent has returned, and read source yourself with `git show HEAD:<file>` while mutants are being applied.
- **Quote grep globs: the shell here is zsh.** `grep -rn x packages --include=*.ts` stops with `no matches found: --include=*.ts` when no file in the current directory matches the glob, and in a chained command the output of the other parts still prints, so the search looks complete. On #752 this hid `buildTrackFromConfig.ts`, the one WRITER of the field being removed, until typecheck was run. Write `--include='*.ts'`, and when any part of a command prints an error, run the search again before using its result.
- **`git grep -E` here has no `\b`:** a pattern with it matches nothing and prints nothing, which reads as "none found". Use `-w`, or a character class before the word. An empty result from a search that should have hits means the search is wrong.
- **My own `pnpm build` breaks my own dev server too** (the same "Can't resolve '@dawcore/components'" overlay): restart the 3077 server after any build, before a probe or an e2e run.
- **Keep `examples/*.html` and `debug/` out of a repo-wide attribute grep** (hundreds of page-level ids); scan `packages` and `website/src`.
- **A mutant must break the property through the path the test reads.** Two survivors on #770 added a duplicate name to a file the entry point does not export; the guard is about entry points. And a survivor on a line no caller can reach (a guard behind a disabled button) means the line goes, not that a test is missing.
- **jsdom: `fireEvent.click` on a disabled input still toggles it.** Use the element's own `click()`, which honours `disabled` as a real click does.
- **A test in `annotations` can mount the real providers** from browser's `dist`: `createAdapter` / `createPlayout` fakes, and `waveformData: { sample_rate, duration }` is enough for `MediaElementPlaylistProvider` when nothing draws.
- **"Measured" in a doc means a test in the repository.** A number from a throwaway test is written as that.
- **A late code change while a docs agent is writing:** send it the new facts with `SendMessage`; do not wait and patch its output.
- **Removing a public field: trace its writers as well as its readers, and report every public surface it reaches before removing it.** `ClipTrack.effects` (#752) had two readers in the Tone adapter, but also a writer (`AudioTrackConfig.effects`, copied onto the track by `buildTrackFromConfig`) and a type that existed only for it (core's `TrackEffectsFunction`). Removing the field removed a working option of `useAudioTracks`, which the maintainer had not been asked about and which needed a replacement (`AudioTrackConfig.id`). When a removal turns out to reach a second public surface, stop and say so, with what replaces it.
- **"Remove it if it is unused": unused as an input is not unused.** After #756 nothing needed `'piano-roll'` to be SET (`ClipTrack.renderMode`, `<daw-track render-mode>`), but it was still the value the renderers switched on in four packages (`SmartChannel`, `ChannelWithProgress`, `TrackRows`, the `<daw-editor>` template). Grep the value's readers before answering, say which it is, and ask when removing it changes a public type or prop (#763: the maintainer chose "remove it entirely", and the discriminator became the track's `kind` and the clip's `midiNotes`).
- **A sentence that says a component "ignores X" needs a test that passes X in the form that reaches the other branch.** `SmartChannel` was documented as ignoring `renderMode` for a clip with notes, and its test passed `renderMode="spectrogram"` without the spectrogram props, so it never entered the spectrogram branch that came first (#763, first review). Order the branches so the claim is true, and give the test every prop the competing branch requires.
- **One rule for "is this a MIDI clip": `midiNotes != null`, core's `clipKind`.** `!== undefined` in a renderer made a plain-JS audio clip with `midiNotes: null` a piano roll while the engine accepted it as audio.
- **Per-track things that are not plain data go through a provider prop keyed by track id, never onto the track object** (#752). The provider's incremental paths compare track objects by identity; anything that makes a consumer copy tracks turns every clip edit into a full engine rebuild. Details and counts: `packages/browser/CLAUDE.md`, "Incremental Track Addition".
- **Do not chain a commit after a test run with `;`.** `vitest run … ; git add -A && git commit` committed over a failing run (#751: 1 failed of 589, the name lost because the output was filtered through `grep`). Run the tests as their own command, read the result, then commit; and send a suite's output to a file when a failure would need its name.
- **The same holds for a push and for `gh pr create`.** On #760 `pnpm test > log; grep …; git push; gh pr create --body-file …` opened a PR whose description said "228 passed" for a run that had 1 failure, because the body was written before the run and nothing stopped the chain. A test run is its own command; the description is written after its result has been read.
- **A guard read from React state does not cover the async start of the thing it guards.** `useIntegratedRecording.startRecording()` first refused a second call with `isRecordingRef.current`, a mirror of state that turns true one render AFTER the startup awaits finish, so a second call during the startup still overwrote what the first had captured (#756, found in the third review round). An async operation that must not overlap itself needs a ref set synchronously on entry and cleared in a `finally`, as well as the state mirror.
- **Mutation checks in bulk:** a small script that copies the file, applies one `perl -0pi -e 's/…/…/'`, refuses to continue when the file did not change (a mutation that silently did not apply looks like a test that caught nothing), runs the one test file, prints the failing test names and restores the file. 33 mutations were run this way on #756; two showed an assertion gap (a flag that was never cleared, and a state value not tied to `isRecording`). Check `git status --short` for leftovers afterwards.
- **A surviving mutant is not "equivalent" until the path is named.** On #782 the one survivor of 67 (`restAt` clearing the range end) was reported as equivalent; the review found a path where the line mattered. For each survivor write down every caller that reaches the line and what it would see without it, or report it as an untested line.
- **A mutant must break the property, not resemble the old code.** On #685 "the root renders again" did not make the parts render, because React skips a child whose element is the same object. The real break was two lines together (re-create the elements and drop the memo). When a mutant survives, ask what the test's subject actually depends on.
- **Two ways a new test passes against the old code (#782).** A fake that settles only the LATEST pending promise cannot show that an earlier call was cancelled: keep every pending call and settle them one by one. And in Node a `DOMException` is an `Error`, so `instanceof Error` (or a `.toThrow()` with no argument) does not tell an `AbortError` from a real failure: assert on `name`. Break the guarded line for every new test before the first review, tests in other packages (the engine) included.
- **Module state that two copies of a package must share goes on `globalThis` under a versioned `Symbol.for` key** (core's effect registry, #679). `browser` pins core exactly, so an app whose own core version differs installs two copies; a module-level `Map` in each is two registries. Test it with `vi.resetModules()` and a second `import()`.
- **A store owned by a hook must not be cleared in an effect cleanup.** React runs the same cleanup for an unmount, a StrictMode remount, Fast Refresh and a hidden `<Activity>`. Release real resources when the store is garbage-collected (`FinalizationRegistry`; the held value must not reference the store) and through an explicit clear method. To check the collection path for real: Chromium with `--js-flags=--expose-gc`, navigate in-app so the component unmounts, call `gc()` and watch for the dispose (probe `probes/gc679.cjs`).
- **An effect with several return paths has a cleanup only on the paths that return one.** When a run leaves through an early `return;`, the previous run's cleanup has already run and nothing replaces it, so a resource released only in the cleanup of one path is not released on unmount (#811: the provider's loading effect disposed the engine only on its full-build path). The fix is a second effect, `useEffect(() => release, [stableRelease])`, whose cleanup runs only on an unmount, a StrictMode remount, Fast Refresh or an `<Activity>` hide; after the last three every early-return path of the first effect must notice the resource is gone and rebuild it. To see it: a fake adapter through `createAdapter` whose `dispose()` counts, a full build, one track appended, unmount (0 calls; 1 without the append). When an effect gains an early return, ask what the path that returns a cleanup releases.
- **Hard refresh**: Always use Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) after builds — and after ANY dev-server restart: a tab left open across a restart keeps running the old bundle and reports plausible-looking "engine" bugs (e.g. a trim that plays the untrimmed clip) that no fresh headless repro can reproduce. Before debugging a user-reported regression in a dev-server tab, confirm the tab was hard-refreshed after the last restart.
- **Vitest cleanup:** `npx vitest run` in pnpm monorepos can leave orphaned Node processes at ~100% CPU. After running tests across multiple packages, verify with `pgrep -f vitest` and kill strays with `pkill -f vitest` if needed.
- **A test on an element's inline style does not show the element is visible.** A new theme key was applied to a background that an opaque wrapper covered; the unit test passed and a reviewer found it (#689). For a colour or size option, check what is on top (`document.elementFromPoint`, the computed style of the topmost element) in a browser with a non-default value.
- **React's `<Profiler onRender>` did not fire in jsdom for a context-triggered re-render that changed no DOM.** To count such renders, put a component that reads the same hook in the tree and count its calls.
- **A mutant that removes a loop guard never ends**, and vitest cannot time out a synchronous loop. Give the mutation runner a per-mutant timeout that kills vitest and counts the mutant as killed (`probes/mutate689.py`), and check `pgrep -f vitest` afterwards: a hung worker stays at 100% CPU.
- **A background Bash command is cut off at 10 minutes, but its children keep running.** Wait with `until ! pgrep -f <name> > /dev/null; do sleep 3; done`; `sleep N; cmd` in the foreground is blocked.
- **jsdom has no `canvas.transferControlToOffscreen`.** Stub it on `HTMLCanvasElement.prototype` to test `SpectrogramChannel`'s registration (`SpectrogramChannelHeight.test.tsx`).
- **Stray NUL byte in a source file = silent `Bin` diff** — a 0x00 that sneaks into a `.ts` file (e.g. from a tool edit) makes `git diff --stat` report the file as binary while tsc, prettier, AND vitest all pass silently. Detect with `perl -ne 'print "line $.\n" if /\x00/' <file>` — bash `$'\x00'` CANNOT pass a NUL to grep (it degrades to `grep ""`, matching every line). Fix with `perl -i -pe 's/\x00/ /'`.
- **Agent worktrees & dev servers:** Background agents run in `.claude/worktrees/agent-*`. When an agent finishes: its dev server dies (browser tabs still open against it fail dynamic imports with misleading "package not installed" hints — reload against a real server), and stale worktrees linger holding their branch names (`git worktree remove --force .claude/worktrees/agent-* && git worktree prune`). Never trust which checkout `pnpm example:*` serves — the startup log prints the cwd.

**CI Validation:** `.github/workflows/ci.yml` runs on PRs to `main`: build and lint (includes prettier check). A PR that changes only Markdown, `docs/`, `plans/`, `website/docs/` or `llms.txt` starts no run (`paths-ignore`): `gh pr checks` then says "no checks reported" and stays that way, which for such a PR is the expected final state and not a queued run (confirm with `gh pr view <n> --json files`). CI never built the website, so for docs changes `pnpm --filter website build` locally is the check. CI runs ONLY on PRs targeting `main` — stacked child PRs show no checks until retargeted after their parent merges. Fix formatting with `pnpm format` before pushing. `gh pr checks --watch` can exit 0 while checks are still pending/queued — always re-run `gh pr checks` and read the actual states before merging or diagnosing.

**The independent review covers the FINAL diff.** Any commit added after a review (including changes the maintainer asks for mid-PR) means a new review before merging; a go-ahead on behaviour is not a waiver, and "not reviewed" in the PR text does not close the gap. #721, #724, #725 and #727 were merged with unreviewed commits; the post-merge reviews found a cursor regression, stale playback state and a dead Escape, fixed in #729 over four review rounds. To end the loop honestly, stop changing code after a round that finds nothing above low, and list the lows in the PR. The maintainer may waive the review for named small fixes after such a round (#741: two one-line lows); then the PR text says which commit was not reviewed. Before fixing an interaction bug, state the behaviour choice and ask: on #741 the narrow fix ("end the drag on release outside") was built and tested before the maintainer was asked, and they chose the other behaviour (follow the pointer). For UI behaviour the maintainer is trying by hand (keys, focus, playback), open the PR and leave it for them; describe behaviour by stating where focus is and what the native control would do with the key.

**Nothing edits source while an e2e run or a review round is in flight.** The Docusaurus dev server hot-reloads on every source change, so an edit by the author, or a review agent's mutation check, can empty the page under a running test: on #749 one full run failed a single test with zero drag handles on the page, and the same test then passed 15 of 15. Run the final e2e after the reviewers have finished, with a clean tree. And hold your own edits until a review round returns: on #749 a commit landed while the second reviewer was reading, and the review covered it only because the reviewer noticed HEAD move. Before merging, check that the review, the e2e run and CI all name the PR's head commit (`gh pr view <n> --json headRefOid`).

**Before moving an option down the tree, list who reads it ABOVE its new home.** `waveHeight` moved to the view (#689); `SpectrogramProvider` sits above the view and read it from the provider. It now takes the height each canvas registers with.

**"It hangs" and "it is replaced" are claims to run before sending.** On #689 I reported that zero-width bars freeze the page (they drew a blank waveform: the first bar position was `NaN`) and that our theme replaces an outer `ThemeProvider` (styled-components merges an object theme over the outer one). Both went to the maintainer as read from the code and both were wrong.

**"Use another provider" is true for `MediaElementPlaylistProvider` only.** Multitrack providers with the default Tone engine share one transport (one instance per page, per our docs; #805). Say which provider before recommending a second one.

**"Nothing breaks" is a claim about behaviour, not about the API, and it needs the trees walked before it is said.** #773 kept two `<Waveform>` props beside a new context and was recommended as non-breaking. Review then found that an app with the flag on the provider only got 24px trim handles, and that `<PlaylistVisualization>` under the provider became interactive; the chat update called the round "a stale doc sentence and some test gaps", the PR merged on green CI, and the maintainer had it reverted (#774) and redone with one source (#775). Before recommending an option: write down each tree a consumer can build (with and without each provider, the lower-level export used directly, one provider nested in another, a leftover prop in plain JS) and what it does before and after. Brief the reviewer to return that table for the final diff, with a column for "stated in the upgrade guide". Every row goes to the maintainer in chat before the merge, whatever the standing merge authorisation says; each later round that adds a row means another message.

**One source per option in the React components (maintainer's rule, 2026-11-11).** No prop beside a context for the same thing, and no option passed down through components that do not use it: a small context whose value rarely changes, read where it is used. Keeping the old prop "so nothing breaks" is the doubling that was rejected; in this major, remove it and write the upgrade entry. `packages/browser/CLAUDE.md`, "Clip Interaction Options Have One Source", is the worked case.

**A probe can only show a gain the page lets it show.** #767 made the controls value stable; on `/examples/multi-clip` the count was 259 components per trim move before and after, because the example component holds `tracks` and re-renders its toolbar anyway. Say in the design what the example pages can show, and when the answer is "nothing", measure the claim where it holds (a unit render count with `children` passed through as one constant element). Also on that page: five clips end at 20 s, so trimming "the last clip" does not change `duration` until the other four are shortened (`probes/trim767.cjs` does that first).

**A composition that hands its root module-level elements costs nothing on a parent render.** `const TRACKS = <WaveformTracks />` outside the component: a render of `<Waveform />` gives the root the same element objects, and React skips even the unmemoized tracks part (#685 part 3: trim per move 93 to 89 on multi-clip). Elements written inline in the composition are new each time.

**Count the component layers a design adds before promising render counts.** For #685 "equal or better on every action" was wrong on the first build: each part was a wrapper around the component that draws, so a zoom rendered up to 6 components more. Folding the wrappers into those components left 1 to 3. Say "+N on whole-view renders" in the design.

**Prototype two candidates on one build with a URL switch.** A `?proto=a|b` read at module scope in the example component, a throwaway local branch, the probes run with the query in the route argument (`trim767.cjs 3077 'multi-clip?proto=slot'`), then `git diff` saved to the scratchpad and the branch deleted. #685: per-clip children written inline rendered 384 components per trim move against 94 for markers.

**A fix asked for during review is a new design: trace what reads the state it touches before proposing it.** On #769 the maintainer asked for `isPlaying` to become false when the MediaElement provider replaces its player. That one line led to four more commits, each found by the next review round or a side agent: what happens to the cursor (asked only after building), a child's own restore being overwritten (the reset ran after child effects), the restore being cut off (`seekTo` clamped to a `duration` state that still held the old file's length), and the new player not being moved to the stored position. Before offering "a small fix", list who reads and who writes each value it changes, in the order React runs them (render, layout effects, passive cleanups, passive effects, async init, `onReady`), and put the behaviour choice to the maintainer with that list. Two orderings worth remembering: React runs every passive-effect cleanup of a commit before any passive effect, so a provider reset that a child's effect must be able to override belongs in the provider's cleanup; and a ref that a cleanup compares against must hold a COMMITTED value, so write it in a layout effect, not during render.

**When a handler stops calling a function, list everything that function wrote.** On #793 the release stopped calling `play()` because `setSelection` already restarts playback. `play()` also wrote `playbackStartTimeRef` and `audioStartPositionRef`, which `useEngineRefs()` hands to consumers; the restart inside `setSelection` did not, so a readout computed from them kept counting from the replaced play (found in review). "It already restarts" is about one effect of the call, not all of them.

**A bug found on the way goes to the maintainer in the same message, before the fix it was found under is finished.** On #685 a test showed an inline `onTracksChange` re-running the provider's loading effect; I wrote it into a test comment and carried on, and a side agent reported it first. Say what was run, what was only read and what is unverified, then file it (#791).

**A design row about an interaction is written from the handlers, not from the API.** For #782 the row "a drag during playback becomes selection playback" came from reading `setSelection`; the multitrack view's mouse handlers at the time ignored moves while playing and treated the press as a seek, so the row was wrong and had to be corrected in chat after the design was approved. Read the view's pointer handlers for each row that starts with a press, a drag or a key.

**A design for a pointer interaction says what moves under a still pointer, and how a click is told from a drag, as choices.** On #793 (a drag during playback draws a range) I had not asked what happens with automatic scroll on, where the view scrolls and the audio under a held pointer changes, and I was about to tell a click from a drag by pointer travel, a rule nobody had seen. A side agent raised both before I did; the maintainer's answer (no live selection with automatic scroll on) made the second rule unnecessary. List these two for any press-hold-release design before building.

**A render of a view root alone is about 15 components, not 1** (the root, `Playlist` and its styled elements). On #685 part 2 "the root renders once more on a selection" was approved as +1 and withdrawn before building. Count the frame under the root before quoting a cost.

**Before putting an attribute our guides style on a new element, grep the guides for CSS that targets it.** `data-playlist-state="loading"` on the MediaElement view met the Loading Audio guide's `pointer-events: none` rule: clicks were dead until the metadata arrived (#685 part 2, first review).

**Reusing one view's markup under another provider makes existing selectors match it.** List the selector collisions (`[data-track-row]`, `[data-selected]`, counts of `[data-playlist-state]`) as rows of the behaviour-change table.

**jsdom has no layout: a click test passes on an area of zero height.** Assert the inline height that gives the area its size, and call the click test a control.

**An e2e test that finds its elements through a new attribute fails on the old code for the attribute, not for the behaviour in its title.** Say which of the two the old-code run proved.

**The mutation runner over the full browser suite takes about 35 s per mutant** (54 mutants, 30 minutes, in the background). Nothing else may edit source or run e2e against a dev server meanwhile: the server hot-reloads the mutated file. A mutant reported as REFUSED means prettier re-wrapped the line; fix the string and rerun it.

**A probe or test that finds a control by a loose accessible name can press another control.** `probes/split768.cjs` matched `name: 'Volume'` and pressed "Master Volume": the "track volume" baselines of two sessions (16 and 33) were the master slider (real: 32 and 63; `probes/track687.cjs`). On #687 a new "Remove track" title made `getByRole('button', { name: 'Remove' }).last()` in `effects.spec.ts` remove a track. Use `exact: true`.

**A child's layout effect runs before React attaches its parent's ref.** `useTrackReorderHandle` hands the slot's element (owned by the controls part) to dnd-kit; in a layout effect the element was still null and no drag started. Register a parent-owned element from a child in a passive effect.

**dnd-kit can send a `dragover` after the `dragend` of a canceled drag.** It set the reorder preview again for good (Escape mid-drag, 6 of 6 e2e runs on #687). A handler that publishes drag state checks that a drag is in progress (#796 tracks the dnd-kit workarounds).

**A panel that fills its box hides a sibling in the flow.** The #687 design said "the default panel plus your own control beside it"; only a control that positions itself is visible there. Render a composition claim in a browser before it goes into a design.

**A change to the shape of a public value goes to the maintainer before it is built, also when it follows from an approved fix.** Keeping mixer state by id made `trackStates` hold `undefined` in place for a loading track; a side agent reported it first. The same for an oddity seen in a test (the empty timeline running a second, full build).

**Mutation runs: give each mutant only the test files that can see its source file** (40 s per mutant with 16 files, 3 s with the right 2 to 8; `probes/mutate687.py`, `BY_FILE`). Stop a run with `pkill -INT -f mutate…` so the `finally` restores the file; a background command is killed after 10 minutes without that.

**`git diff --name-only main -- 'packages/*/src'` lists nothing** (the pathspec is not a shell glob). Use `-- packages` and filter with grep.

**`revise-claude-md` runs before the merge is asked for**, so the learnings go in the PR that produced them (#782 was merged without it and needed a docs PR afterwards).

**When hooks move onto shared contexts, list what stops throwing.** After #688 part 2 made both providers render the same context objects, `usePlaybackShortcuts()` (it reads only shared hooks) silently started working under the MediaElement provider, against a decision that there are no shortcuts there; a docs agent noticed, not the tests. After such a move, grep every exported hook and component for the contexts it reads and write down each one that no longer throws under the other provider, before the first review.

**An effect written for "when the prop changes" also runs when nothing changed.** `useLayoutEffect(() => { ref.current = prop }, [prop])` runs again with the same prop on a StrictMode remount and when a hidden `<Activity>` is revealed, and it runs after a child's layout effect of the same commit; on #688 part 2 each of those put the prop's value back over one the user had chosen (third review round). Keep the last value applied in a second ref and return when it is unchanged. Compare a prop during render with `Object.is`: with `!==` a `NaN` prop set state on every render ("Too many re-renders").

**An `<Activity>` reveal runs each effect's LATEST `create`, also when its dependencies did not change** (React keeps the newest closure without marking it to run). The early-return path a reveal takes is the one of the last render before the hide. In a test, make the triggering update and the hide in one `act()`, or that path is never reached (#811: the clip-operation guard's mutant survived until they were).

**Removed names do not throw (maintainer's decision, 2026-11-12, #688 part 3).** Part 2 gave the `usePlaybackRefs()` value throwing getters for its eight moved fields, and part 3 first did the same for the five props removed from `PlayheadProps`. A side agent pointed out that a playhead copied from the old `PlayheadWithMarker` destructures every removed prop (four as a fallback, `controlsOffset` with a default of 0), so the guard would crash code that otherwise kept working; the maintainer then had both guards removed: "people need to check the upgrade guide". A value handed to consumers is a plain object, a leftover read is `undefined`, and the upgrade guide carries the removed-to-replacement table and says what a leftover read does. Do not add such a guard again. Before proposing any "fail loudly" device, list the consumer code that reads the name without depending on it.

**Merging twin components: compare how each PARENT uses its copy, not only the two bodies.** For #688 part 3 the playhead twins differed in a frame-callback id; the visible difference was one level up, where the multitrack view wraps its playhead in `PlayheadOverlay` (hidden at rest while a range is highlighted) and the MediaElement view did not. That became a behaviour choice for the maintainer. A shared wrapper also costs one component per render of the parent that did not have it (40 to 41 per play on the MediaElement pages): say "within one or two" in the design, not "identical".

**"It may paint unpositioned for a frame" can be measured.** A reviewer read that a playhead mounted as playback starts has no transform until its first frame callback. `probes/flash688.cjs` installs a `MutationObserver` for the element and records its `style.transform` when added and in the next three animation frames: by the first frame it was at the range start, 8 loads of 8 on both kinds of page (Chromium). Run that before proposing a fix for a first-frame concern.

**"One part for both providers" does not mean one playback call.** On #686 the shared box part called `play(start, length)` under both providers; under MediaElement, which ends an annotation through its animation loop, that changed four behaviours a reviewer had to trace. When two providers reach one result by different mechanisms, the part asks the provider (`usePlaybackControls().playAnnotation`), and the first design lists each provider's mechanism before choosing a shared call.

**A limit copied from an example is a behaviour choice.** The first #686 build clamped the annotation edge drag to the audio's length because the examples' own wiring did; on an empty timeline that is 0 and a dragged edge collapsed (seen in a Storybook story with no audio). For any clamp, write down its value on an empty timeline, during a recording and in a view that fills its container, and put the choice to the maintainer. When the maintainer changes one limit, grep for its siblings (the boundary shortcuts kept the old clamp) and say so in the same message.

**A prop that seeds state is a trap when an option moves into a provider.** `annotationList.editable` was read once at mount; moving the MediaElement `editable` prop there would have silently stopped an app that drove it from its own state. Before moving an option to provider state, check whether the prop is followed or only seeds, and state it in the design's behaviour table. The pattern that follows a prop without an effect is `useFollowedOption` in `packages/browser/src/providerInternals/useAnnotationState.ts` (value state plus "last prop seen" state, compared during render).

**A theme key that was never read can have a default nobody has seen.** Wiring `annotationBoxBorder` would have turned dark-mode box borders from orange to the dark theme's unread `#c49a6c`. Before reading an existing key, compare its value in BOTH default themes with what is on screen. A new theme key is optional in `WaveformPlaylistTheme` (a required one breaks consumers' complete theme objects), with the fallback in the component.

**An early return that removes a component a test counts makes "it did not render" vacuous.** `WaveformAnnotationBoxes` returns null without the annotation integration; `waveformPartsQuietShell.test.tsx` mounted without it and asserted `counts.boxes === 0`. After adding an early return, grep the tests that count that component and give them what it needs to render.

**A prediction is not a measurement: say which one a number is.** On #686 the maintainer was told the built-in drag would cost one component per move (measured in a prototype) and that a toggle would fall to about 22 (a guess). Both were wrong on the real build (47 unchanged; 221). Write "predicted" or "measured in the prototype" next to a number, and replace it the moment the build is measured; a doc reviewer found the stale "+1" row in the upgrade guide.

**Two A/B questions open at once get one "B".** Ask one lettered question at a time, or give the options distinct names ("border: orange / amber").

**A question goes in its own message, in plain words first.** On #770 `LABEL-FIX-HERE or LABEL-ISSUE` sat in the middle of a status update and was not seen as a question. Say what was found, what the two outcomes are, then name the options.

**Label the choices the way they will be answered, and keep what I plan to run out of the list.** On #771 part 2 three choices were numbered 1 to 3 and the answer came back as a), b), c); a sentence after the list about a test I meant to run ("the `immediate: true` case") was then looked for as a question that did not exist. Letter the choices, one line each, and put "next I will run…" in a separate paragraph that says it needs no answer.

**`website` aliases `annotations`, `recording`, `engine`, `spectrogram` and `midi` to source** (`website/docusaurus.config.ts`), so a prototype may edit them with only the dev server running. Bulk file changes under a running Docusaurus dev server can abort it (rspack panic, SIGABRT): check the server's log before trusting a probe after a large patch.

**Probes for annotations:** `probes/cont686.cjs` (box and row click against continuous play), `probes/kbd686.cjs` (keyboard drag of an edge handle), `probes/mutate686.py` (mutants across two packages, per-file test lists; takes a name filter), `probes/proto686/` (the prototype diff with its URL switches).

**The Playwright suite is not part of CI**, and there is one way to run it (`pnpm test`, everything, about a minute plus the builds; 258 tests as of 2026-11-12, after #685 part 2). #779 tracks tags and scripts for running it by area. Until then the full run on the PR's head commit is the rule.

**Before changing how an interaction computes its result, find the e2e test and the PR that set the current behaviour.** On #749 the annotation edge drag was changed to compute each move from the drag-start state (dawcore does it that way). That removed what #747 had established and the maintainer had tried by hand: with Link endpoints on, an edge dragged into a separated neighbour carries it along. Only `e2e/media-element-annotations.spec.ts` caught it; every unit test passed. The React hook and dawcore's handler differ here on purpose.

**GitHub closing keywords don't distribute over comma lists** — `fixes #589, #590, #593` in a squash-merge commit closes ONLY #589; each reference needs its own keyword (`fixes #589, fixes #590, fixes #593`). A `closes #N` in the PR body works independently. After merging a multi-issue PR, verify each issue actually closed (`gh issue view N --json state`).

**A closing keyword works inside a negation.** "It does not close #688" in the body of #782 closed #688 on merge. For a PR that is one part of an issue write "Part 1 of 3 for #688" and no keyword next to the number; after the merge check `gh issue view <n> --json state`.

**Sub-issues don't close with their parent epic** — `closes #<epic>` closes only the epic; its sub-issues stay open (found on #455: all three sub-issues open after the epic closed). Enumerate them via GraphQL (no `gh` subcommand): `gh api graphql -f query='{ repository(owner:"naomiaro", name:"waveform-playlist") { issue(number:N) { subIssues(first:50) { nodes { number title state } } } } }'`, then close each with a comment pointing at the implementing PR. To attach a new issue to an epic: `gh api graphql -f query='mutation($p:ID!,$c:ID!){ addSubIssue(input:{issueId:$p, subIssueId:$c}) { subIssue { number } } }' -f p="$(gh issue view <epic> --json id -q .id)" -f c="$(gh issue view <new> --json id -q .id)"`. An epic with an open sub-issue stays open when the PR that closes the last original one merges.

**Commit messages with backticks:** never inline them in a double-quoted `git commit -m "…"` — the shell command-substitutes them (one release-arc commit shipped with a word silently deleted). Use `git commit -F - << 'EOF'` (quoted delimiter).

**A command refused by the permission check runs none of its parts.** In auto mode `gh pr merge` ("Merge Without Review") and `gh issue create` ("External System Writes") were refused until the maintainer said in the conversation to merge or to file. Do not work around a refusal: carry on with other work and tell them. A file written by an earlier `cat <<'EOF'` in the same refused command does not exist, so do not report its path.

**Text with backticks in a shell-fed script:** the same trap applies to `python3 - <<EOF` and `cat <<EOF`: with an unquoted delimiter the shell runs every backticked word as a command and silently deletes it (a PR description lost its code spans this way; the only sign was `command not found` lines). Always quote the delimiter (`<<'EOF'`) and pass paths in as arguments (`python3 - "$FILE" <<'EOF'` … `sys.argv[1]`).

**GitHub Release Notes:** use `gh release create --notes-file <path>` (or `gh release edit --notes-file <path>`), NOT `--notes "$(cat <<'EOF')"`. Shell escapes in HEREDOCs mangle inline backticks and quotes inside code spans, leaving visible `\"` and `` \` `` in the rendered release body.

**Release tags are descriptive, not `pkg@version`** — feature-named (e.g. `optional-playout-engines`, `recording-latency-config`). `gh release create <descriptive-tag> --target main --notes-file <path>` creates the tag + release; the release commit is `chore(release): pkg@x.y.z, …` on `main`. Bumping workspace package versions does NOT change `pnpm-lock.yaml`.

**`npm version <v> --no-git-tag-version` may normalize unicode escapes** in package.json (e.g. `\u2014` becomes a literal `—`) — an extra diff line beyond `version`; harmless, commit it.

**A full release is THREE artifacts** — easy to do partially: (1) npm publish (`pnpm --filter <pkg> publish --no-git-checks`), (2) the `chore(release): pkg@x.y.z` commit on `main`, (3) the descriptive-tag GitHub release (`gh release create`). "Bump and publish" naturally stops after (1)+(2) — the GitHub release is a separate step, easy to forget. Preview the tarball first with `pnpm --filter <pkg> publish --no-git-checks --dry-run` (shows files/version/tag/access before the irreversible publish); verify the publish landed with `curl -s https://registry.npmjs.org/@scope%2fname` (npm view caches 404s).

**`@dawcore/components` has no published dependents** — only `website` (`workspace:*`, unpublished) depends on it, so bumping it is a SINGLE-package release, not a workspace-pin republish cascade. Verify republish scope with `grep -rl '"@dawcore/components"' packages/*/package.json` before assuming the cascade.

**pnpm Build Ordering:** `pnpm recursive run` determines build order from `dependencies` and `devDependencies` only — **not** `peerDependencies`. If package A needs package B's types at build time (e.g., for DTS generation), B must be in A's `devDependencies` even if it's already a `peerDependency`. Without this, CI builds fail because packages build in parallel/alphabetical order.

**Type Migration Gotcha:** When moving types between packages, `pnpm typecheck` resolves workspace packages via `dist/` (not source). Build the source package first: `pnpm --filter @waveform-playlist/PACKAGE build` before `pnpm typecheck`. Same applies to _adding_ fields to interfaces in upstream packages — downstream `pnpm typecheck` won't see new optional properties (`TS2353` / `TS2339`) until the upstream is rebuilt. Also grep the entire repo for old import paths — easy to miss straggling imports.

**Downstream tests resolve engine via `dist/`, not source** (likewise `dawcore-wam`'s transport integration test → `pnpm --filter @dawcore/transport build` first)**:** after changing engine _behavior_ (not just types), run `pnpm --filter @waveform-playlist/engine build` before running `browser`/`dawcore` vitest, or they exercise the OLD behavior (a RED-check against unbuilt source gives a false pass). The `dawcore`/`browser` packages' own source is transformed from TS on the fly by vitest, so changes _within_ those packages need no rebuild.

### E2E Testing with Playwright

- **Run tests**: `pnpm test`, `pnpm test:ui` (interactive), `pnpm test:headed` (visible browser). The suite's only project is Chromium. **Playwright's Firefox needs `@playwright/test` >= 1.65 on this machine** (macOS 27): the Firefox builds shipped with 1.60 fail to launch with `sandbox_extension_issue_file_to_process … Operation not permitted` and a timeout — that is Firefox's own content sandbox, NOT Claude Code's Bash sandbox (do not add `sandbox` settings for it; enabling the Bash sandbox blocks local ports, browser launches and `gh`). One-off cross-browser run: a temporary config that spreads `playwright.config.ts` and replaces `projects` with `devices['Desktop Firefox']`, `npx playwright test --config <tmp>`. On Firefox 159 the suite was 183/184 (2026-11-10): `multi-clip.spec.ts` "pressing 0 rewinds to start" fails ~10/10 under the runner — Play is clicked and `isPlaying` stays false — equally with the provider from before #676, and 24/24 fresh sequential loads outside the runner play fine; cause not found. Playwright's WebKit (26.4 and 27.2) cannot create dawcore's blob-URL peak worker (`WebKitBlobResource error 1`), so `<daw-editor>` pages load no tracks there; whether real Safari is affected is unknown. The `test` script is root-only — use `pnpm -w run test` from package directories.
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
- **Mouse drags in Playwright:** `page.mouse` reports `buttons: 1` while a button is down, and a `new MouseEvent('mousemove')` in a unit test reports `buttons: 0` unless told otherwise; code that checks `event.buttons` needs `{ buttons: 1 }` in jsdom tests. A `page.mouse.move(x, y, { steps })` that leaves an element diagonally keeps changing whatever the drag controls on the way out; move straight out along the other axis when the assertion is about the dragged range. Holding the button over page text selects it unless the page prevents that; `window.getSelection().toString()` after the drag shows it. The mobile specs drive the mouse, so nothing in the suite sends real touch events.
- **Fractional pointer positions reach dnd-kit:** `page.mouse.move(x + 0.3, y)` arrives as a fractional pointer coordinate, so a drag can end between pixels. Use that when a bug depends on a sub-pixel remainder (#747: a gap under 10 ms between two annotation edges needs a 0.3 px offset at 23 ms per pixel; whole-pixel drags always landed exactly and could not reproduce what a real mouse did about half the time). Read the times the UI shows (the annotation list rows), not box positions, to see millisecond differences.
- Synthetic `dispatchEvent(new PointerEvent(...))` cannot drive `PointerHandler` interactions — `setPointerCapture` throws `NotFoundError` for fabricated pointerIds. Use real input (`page.mouse.click/move/wheel`) when verifying seek/drag/wheel behavior in a live browser.
- **MCP-automated browser tabs are usually backgrounded** (`document.visibilityState === 'hidden'`) → `requestAnimationFrame` is throttled to ~0, freezing the rAF-driven playhead/time _regardless of code_. When debugging playback/recording via chrome-devtools or claude-in-chrome MCP, check `visibilityState`/rAF liveness FIRST; assert on rAF-independent state (`currentTime` from setState, clip DOM `left`, console logs) or have the user foreground the tab. A "frozen playhead" in a hidden tab is almost always this, not a bug. Hidden tabs ALSO throttle `setTimeout` to ~1s, so setTimeout-based waits crawl — the recording stop-handshake/drain loop can take tens of seconds to finalize a clip in automation; verify record→stop on a foreground tab.
- **No browser automation here can HIDE a tab** — claude-in-chrome activates a tab only for the duration of an action and restores the previous one, and headless Playwright's `bringToFront()` leaves every page `visible`; `document.visibilityState === 'hidden'` behaviour (timer throttling, Worker-vs-rAF) needs a human switching tabs.
- **Recording flows are fully testable headless with a synthetic mic** — Playwright MCP `browser_run_code_unsafe`: `context.grantPermissions(['microphone'], { origin })` (per-origin — re-grant for each port) + `context.addInitScript` replacing `navigator.mediaDevices.getUserMedia` with an oscillator → `createMediaStreamDestination()` stream (wrap the track's `getSettings` to report `channelCount`/`sampleRate`; also stub `enumerateDevices`). **Launch with `--autoplay-policy=no-user-gesture-required`** (`test.use({ launchOptions: { args: [...] } })` in a spec, `chromium.launch({ args })` in a script): the oscillator's own AudioContext is created when the page asks for the microphone on load, before any click, and without the flag it stays `suspended` in about 1 run in 30, so the "microphone" is silent (dead input meter, blank recorded clip). `e2e/recording.spec.ts` failed 7 runs in 200 without it and 0 in 300 with it; when a synthetic-mic test sees no signal, check the fake context's `state` before suspecting the library. Headless Chromium reports `visibilityState: 'visible'` with full-rate rAF — sidesteps the hidden-tab trap entirely, and the whole record→overdub→finalize flow runs deterministically. When a claude-in-chrome tab won't foreground (display asleep/locked — AppleScript `activate` + window reorder don't wake rAF), switch to headless Playwright instead of fighting window management. The dawcore record demo needs its `#mic-btn` clicked first (`editor.recordingStream` is set there, not by the record button). Its record button also AUTO-CREATES a new track when nothing is selected — to test punch-in-on-top, select the content track first (`editor._setSelectedTrackId(id)`), or you'll record onto a fresh empty track and measure the wrong one.
- **Synthetic `.click()` on a dawcore web-component HOST (`daw-stop-button`, etc.) silently no-ops** — the `@click` is on the inner `<button>` in shadow DOM, and a host-targeted click doesn't propagate in. Click `el.shadowRoot.querySelector('button')` (or use real pointer input). It looks like a broken control but isn't — a host `.click()` only works when the page also adds a host-level listener (as the record demo does for its record button).
- **Synthetic `.click()` on a Play button can wedge `isPlaying` with no audio** — the React handler runs but the untrusted-gesture `media.play()` is rejected by autoplay policy, so the UI shows playing (Play disabled) while nothing plays. Use real input (`page.locator(...).click()`) for playback in MCP-driven browsers.
- **Playwright MCP element screenshots (`target:`) can capture a stale frame** disagreeing with live DOM state during rAF-driven animation (playhead/progress) — use viewport screenshots (no target) for animated-UI evidence, and assert positions by sampling the DOM (`el.style.transform`) rather than trusting the image.
- **Playwright MCP screenshots with relative filenames land in the repo root** (plus logs in `.playwright-mcp/`) — untracked clutter that can slip into `git add -A`. Delete them before committing, or pass absolute scratchpad paths.
- **`pnpm test` starts everything it needs and should be all green** (231 tests as of 2026-11-11; count with `npx playwright test --list`; all green since the 2026-11-10 flake sweep). `playwright.config.ts` starts BOTH dev servers (Docusaurus, and the dawcore-native Vite example on port 5273 for `dawcore-spectrogram.spec.ts` — no manual server any more) and `e2e/global-setup.ts` visits every example route once so no test pays a route's first lazy compile inside its own 30 s readiness timeout. A red e2e run is now a signal: don't wave it off as flake without measuring. To measure a suspected flake, compare failure RATES, not single runs — start the site yourself (`cd website && pnpm exec docusaurus start --port 3077 --no-open`), then `PORT=3077 npx playwright test <spec> -g "<name>" --repeat-each=10` on the branch and on `main` (the config reuses a running server; one `main` run is not a baseline). **A "flaky playback-start test" was a real bug too (#675):** `waveform-data.spec.ts`'s play tests failed ~1 in 10 because Play landed during an engine rebuild — see "Engine Rebuilds vs Playback" in `packages/browser/CLAUDE.md`. Standalone stress scripts did NOT reproduce it; a temporary spec run under the real runner (`--repeat-each` on the whole spec file, console + `data-playlist-state` transitions logged on failure) did. When a script can't reproduce a runner failure, instrument inside the runner. For a failure that shows once in a few hundred runs: send the runner's output to a file (a `tail` of it loses the one message you need), then read `test-results/<test>-repeatN/error-context.md` (the failing assertion) and `test-failed-1.png` (the page at that moment; a dead meter and a blank clip in that screenshot pointed at the microphone, not at the code under test). Temporary `console.log` lines in the spec appear in the runner's output; check that the condition that triggers them can actually be true before spending a 200-run batch on it (#695: a probe that counted the peak marker as a lit segment never fired). **A "flaky readiness timeout" can be a real bug:** the effects page's intermittent `[data-playlist-state="ready"]` timeouts were Tone effects built on the wrong AudioContext ("cannot connect to an AudioNode belonging to a different AudioContext" in the console, playlist stuck in `loading`) — found by loading the page 40× concurrently from a script and reading the console, which took minutes after months of the tests being labelled flaky. Selector lessons from the same sweep: never address a control by position (`input[type=range]…first()` matched a different slider depending on what had mounted — give it an accessible name and use `getByRole`), and never read computed style one-shot (`toHaveCSS` retries).
- **A fresh worktree fails 18 MediaElement e2e tests** (the page shows "WaveformData.create(): This waveform data version not supported"): `/examples/media-element` loads its audio and `.dat` from `/waveform-playlist/storybook/media/…`, which exists only after `pnpm --filter website build:storybook` writes the git-ignored `website/static/storybook/`. Build it, or `ln -s <main checkout>/website/static/storybook website/static/storybook` for the run and `rm` it afterwards.
- **A dev server already on port 3000 makes `pnpm test` lie, and `pnpm build` breaks that server.** The Playwright config reuses whatever is listening on 3000, and the maintainer often has their own Docusaurus server running while trying a branch. `pnpm build` rewrites `packages/*/dist` underneath it, leaving a "Can't resolve '@dawcore/components'" compile overlay (`<iframe id="webpack-dev-server-client-overlay">` "intercepts pointer events" in the Playwright log) and dozens of false failures. Before either command: `lsof -nP -iTCP:3000 -sTCP:LISTEN`. If something is there and you did not start it, do not kill it and do not build: `cd website && pnpm exec docusaurus start --port 3077 --no-open`, then `PORT=3077 pnpm test`, and tell them their server needs a restart if a build already ran. A website dev server also reads `dawcore`'s `dist`, so after changing dawcore's imports of core, rebuild before trusting it ("`X` is not exported from '@waveform-playlist/core'").
- **A branch switch breaks the maintainer's dev server as surely as a build.** Once a PR has been announced as ready to try, assume their server is running in this checkout: check the port before `git checkout` as well as before a build, as a command of its own (not chained in front of the thing it guards). For a follow-up fix to what they are trying, stack the new branch on the branch they are on, so the page under test stays in the working tree (#747 was branched from `main` first, which removed the demo page they had open).
- **Two Docusaurus dev servers share one rspack cache, so do not swap source files under the second one.** With the maintainer's server on 3000 and mine on 3077, `git checkout main -- <files>` for an A/B baseline crashed mine on the recompile (`should have bucket pack metas`, SIGABRT), and their server was answering 404 for example routes afterwards (cause not established; a `ui-components` build had also run). For a baseline: check the baseline files out FIRST, start the 3077 server, measure, restore the files (a recompile after restoring survived). Tell the maintainer their server may need a restart.
- **Keyboard and focus behaviour: what automation can and cannot show.** (1) In Chromium `:focus-visible` matches the focused element as soon as any key is pressed, including during the keydown being handled, so it cannot tell pointer focus from keyboard focus in a key handler; use it for styling only. (2) Headless browsers open no real `<select>` popup, and claude-in-chrome's key presses are injected through the debugger: they reach the page but bypass a native macOS dropdown menu (the value does not change, `select:open` stays false). What a key does with a native popup open needs a human. (3) happy-dom does not retarget `event.target` across a shadow boundary and neither happy-dom nor jsdom implements `checkVisibility()`; shadow-DOM key handling is proven by `e2e/dawcore-keyboard-focus.spec.ts`, not by unit tests. (4) A button that becomes `disabled` while focused drops focus to `<body>` in Chromium (the React Play button relies on this; Firefox and Safari unverified).
- **Ad-hoc headless Playwright smoke scripts from the scratchpad** — `NODE_PATH=$PWD/node_modules node <scratch>/smoke.cjs` (the script lives outside the repo, so `require('@playwright/test')` fails without it). Start the site with `cd website && pnpm exec docusaurus start --port 3000 --no-open` first; stop it (`lsof -tiTCP:3000 -sTCP:LISTEN | xargs kill` — plain `-ti:` also lists CLIENT sockets and killed a Chrome helper once) before `pnpm --filter website build` — they share the compile cache.
- **Measuring React work in the browser without the Profiler (dev build only):** `page.addInitScript` a stub `window.__REACT_DEVTOOLS_GLOBAL_HOOK__` (`supportsFiber`, `inject`, `onCommitFiberRoot`, `onCommitFiberUnmount`, `onPostCommitFiberRoot`, `checkDCE`); `onCommitFiberRoot(_, root)` fires per commit. To count which components rendered, walk `root.current` and count function/memo fibers with `alternate === null || flags & 1`, but do NOT descend into a fiber whose `child === alternate.child`: that subtree bailed out and its fibers carry stale flags (without this the whole page counts as rendered). Wrap `CanvasRenderingContext2D.prototype.clearRect` to count canvas redraws. Used for #692 (trim) and #693 (selection drag). **A render count is not a cost.** To answer "would a user notice", add time to the same probe (#733): `fiber.selfBaseDuration` summed per component name (which components the time goes to), `root.current.actualDuration` per commit, and over CDP (`page.context().newCDPSession(page)`) `Performance.getMetrics` `ScriptDuration`/`TaskDuration` before and after the moves, run again under `Emulation.setCPUThrottlingRate` 4. Run it on the page with the heaviest consumers, not only the one the issue names: #733 looked not worth doing on multi-clip (1.1 ms per move) and clearly was on annotations (19.8 ms at 4x throttle). Measure both directions of a drag: a leftward selection drag also moves the cursor and takes a different path through the contexts. For work that happens with no input at all (meters, a recording in progress), count per SECOND over a fixed window in each steady state instead of per pointer move: reset the counters, wait 3 s, read (#695: idle, recording, playing on `/examples/recording`). A state that should be quiet reads exactly 0 commits, which is also a cheap e2e assertion (`e2e/recording.spec.ts` installs the same stub hook and bounds commits over 2 s).
- **Counting full engine rebuilds in a browser: listen for `waveform-playlist:ready` on `window`, do not watch `data-playlist-state`.** The event is dispatched only at the end of a full build in `loadAudio`; the incremental paths do not dispatch it. The attribute goes `ready → loading → ready` only when React commits in between, and a rebuild whose adapter resolves within one batch (the dynamic import is already loaded) never shows `loading`: an e2e test that watched the attribute passed against the code it was written to catch (#752). Install the listener with `page.evaluate` after the page is ready, do the action, wait, expect the count to be 0 (`e2e/effects.spec.ts`, "adding a file does not rebuild the engine").
- **See a new e2e test fail against the old code before trusting it.** With no dev server running: `git checkout <base> -- <the example or source file>`, run the one test (`npx playwright test <spec> -g "<name>"`; the config starts and stops its own server, so no file changes under a live one), read WHY it failed, then `git checkout HEAD -- <file>` and run it again. A unit test gets the same check by breaking the line it guards and watching it fail.
- **For a change that spans packages, the old code is `git checkout main -- packages`** (the new specs under `e2e/` stay), then delete the files the branch ADDED under `packages/` (`git diff --name-only --diff-filter=A main HEAD -- packages`; left in place they fail `pnpm build`'s typecheck against the old types), `pnpm build`, run the new tests. Restore with `git restore --source=HEAD --staged --worktree -- packages` (it also removes the files the branch deleted, which the checkout brought back), confirm `git status --short` is empty, and build again. Commit first: all of this needs a clean tree to come back to.
- **A count used as the expected value is a one-shot read too.** `const total = await rows.count(); await expect(audioRows).toHaveCount(total)` on the multi-clip page read 6 while the seventh row was being added and failed 1 full run in 6 (#758, fixed in #760). Put the count and the comparison inside one `expect(async () => { … }).toPass()`.
- **A retrying e2e assertion can pass before the thing under test has happened.** The spectrogram canvas was the right size from React's render; the worker resized it a moment later, and `toPass()` on the size passed with the fix removed (#689). When the code under test acts asynchronously after the render, assert again after it has had time, and break the guarded line for e2e tests too.
- **`npx playwright test <spec>` without `PORT` starts its own server on 3000** and crashes a Docusaurus server already running on another port (shared rspack cache). With my own server up, always `PORT=3077 npx playwright test …` / `PORT=3077 pnpm test`.
- **A `page.route` glob that matches nothing fails silently.** On #782 a test aborted `**/*.mp3` while the page plays `.opus`; the request went through and the test said nothing about the error path. Take the URL from the page's network requests, and count the handler's calls (`expect(hits).toBeGreaterThan(0)`).
- **The MediaElement player's `<audio>` element is not in the document** (`new Audio()`), so `document.querySelectorAll('audio')` finds nothing. To assert the playback rate in e2e, read the `AudioPosition` text and `performance.now()` together inside one `page.evaluate`, wait a second in the page, read again and compare the ratio (`playbackSpeed` in `e2e/media-element.spec.ts`).
- **Check that a test's fixture cannot satisfy the assertion by another route.** A unit test for "Play plays the selection and stops at its end" used the selection 2 to 4 s over annotations 0 to 2 and 2 to 4; with the selection logic broken, playback still stopped at 4 s because the annotation ended there (found by the mutation run on #688 part 2). Choose ranges that coincide with nothing else in the fixture.
- **`page.mouse.click(x, y)` does not scroll.** The test viewport is 1280x720; a row below the fold is never hit and nothing errors. `await locator.scrollIntoViewIfNeeded()` before `boundingBox()`. When a raw click "does nothing", print `document.elementsFromPoint(x, y)` first: on `/examples/mir-spectrogram` the tracks are only about 95 px wide, and a click at x + 300 landed beside them.
- **Measure geometry after clicking Play.** The click can scroll the page (Playwright scrolls the button into view), so a `boundingBox()` taken before it is stale: on #793 a probe pressed beside the track and reported "a press during playback does nothing", the opposite of what happens.
- **An assertion that playback "moves on" inside a range needs a range that outlasts a retry.** With a 1.5 s range the passing window closes when the range ends and the cursor returns to its start; `toPass` cannot recover after that. Use about 3 s. Without such an assertion, "the release plays the range" also passes when the release merely stops playback at the range's start.
- **A test for a rule about scrolling needs a state where the view scrolls.** `/examples/multi-clip` barely scrolls at its default zoom (the timeline is about as wide as the container); two clicks on Zoom In give 187.5 px per second and the view follows the playhead within a few seconds. Wait for `scrollLeft` to grow before pressing, and compare the playhead's content x with `scrollLeft + (pressX - frame.x)` taken at the press.
- **`.check()` on a radio or checkbox whose change handler unmounts it times out** (the track menu closes when a render mode is chosen, so Playwright cannot confirm the checked state). Use `.click()`, then prove the result another way (reopen the menu and `toBeChecked()`).
- **Escape in a test also reaches the Stop shortcut** when focus is on a plain button. Close a menu with its own button unless Escape is what the test is about.
- **Old-code check for a new e2e test (#762):** after `git checkout main -- <source file>`, run `pnpm --filter <pkg> build` before the spec. Without it the first run did not show an attribute added in another file of the same package, and both tests failed for the wrong reason. Keep a control test that passes on the old code, so a failure of the real test means the bug and not the setup.
- **MediaElement pages have `[data-playlist-state]` since #685 part 2**, always `"ready"`: it says the view is mounted, not that the media element has loaded (for that read `useMediaElementTrack().isReady` or use the provider's `onReady`; the Play button is enabled before the media has loaded); older specs wait for `[data-scroll-container] canvas`, which still works. The clip there is itself an `[aria-roledescription="draggable"]`, so annotation handle counts are off by one: wait for `toHaveCount(1)` (the clip; dnd-kit adds the attribute late, so never a one-shot `count()`) before enabling Editable, then expect 1 + 2 per annotation. `probes/select744.cjs` is `select740.cjs` with a `READY` env var for the wait selector.
- **In the fiber-walk probe, a context consumer rendered directly under the provider (no component in between, e.g. `<MediaElementWaveform>` as a child of the provider) is charged to the provider** (the provider renders on its own state change and passes the flag down through its stable `children`). "Everything is under the provider root" therefore does not mean the provider's parent re-rendered; once the consumers stop following the value they appear as their own roots.
- **Clip drag/trim live on `/examples/multi-clip`** (`<WaveformEditor />`); `/examples/stem-tracks` renders NO clip headers (`[data-clip-id]` never appears) — it's the track-reorder page. Don't wait on a header selector there.
- **Verifying a drop animation is disabled:** sample `document.getAnimations()` immediately after `page.mouse.up()` — dnd-kit's Feedback drop animation is a Web Animation on the dragged element, so an empty list is rAF-independent proof of `dropAnimation: null`; a settled final position is NOT (the element animates back and then jumps).
- **Firefox `innerText` excludes non-selected `<option>` text** (Chromium includes it) — assert `select.options` structurally, never via body-text probes, in cross-browser checks.
- **Pages importing `tone` have ≥2 AudioContexts** — Tone's orphaned default (created at import, before `getGlobalContext()`/`configureGlobalContext` replaces it) coexists with the app's global one; in native mode both are native `AudioContext`s and the orphan can even report `running`. When instrumenting the graph (analyser taps, context probes), select by MEASURED SIGNAL (RMS > 0), never by constructor name or `state`.
- **Tapping master output in apps that don't expose their graph** (React provider pages): `page.addInitScript` a shim wrapping `AudioNode.prototype.connect` that reroutes destination-bound connects through a created `AnalyserNode` (analysers are pass-throughs) — captures the true final mix for RMS/spectral assertions. Must be injected BEFORE page load.
- **An `AudioWorkletProcessor` that returns `false` while nothing is connected does not run again in Chrome when it is reconnected** (#751: a tremolo bypassed by disconnection stayed silent after un-bypass, 5 runs of 5; a reviewer had recommended `return false` so removed effects stop). Return `true` until a `'dispose'` message arrives on the port. Review advice about audio behaviour gets a real-browser test before it is taken.
- **An `AnalyserNode` reading contains the last 2048 samples (about 43 ms).** An assertion made right after a click can pass on audio from before it. Wait for `context.currentTime` to advance past the buffer first (`waitForFreshAudio` in `e2e/custom-effects.spec.ts`), or assert a value only fresh audio can produce (exactly 0 on a tap whose input was just cut).
- **Tapping one node's output:** an init script that wraps `AudioNode.prototype.connect` and, when `this` is the node of interest, also connects it to an analyser kept on `window`. Re-tap on every call: a chain that rewires disconnects all of the node's outputs, the tap included. Exclude offline contexts (`this.context instanceof AudioContext`).
- **Verifying WAV-export output in a live browser:** wrap `URL.createObjectURL` and filter captured blobs by `type === 'audio/wav'` — WAM hosting also creates `text/javascript` worklet blobs (a fresh set appearing per export is direct evidence of offline plugin re-instantiation). For per-track effect A/B, SOLO the affected track before comparing: a single-stem diff diluted across N stems can fall below a whole-mix RMS threshold (8.1% full-mix vs 51.9% soloed, identical absolute diff) — strengthen the measurement, never weaken the threshold. Sanity baseline: two fully-bypassed exports must be byte-identical (diff-RMS exactly 0).

**Git Safety:** Always make intermediate commits before running `git stash` or switching branches. A failed `git stash pop` + `git checkout -- .` can destroy all uncommitted work permanently.

**Stacked branches:** after rewriting a parent, re-stack each child with `git rebase --onto <new-parent> <old-parent-tip> <child>` (a plain rebase replays stale copies of the parent's commits); `git commit --amend` is blocked in auto mode — use follow-up commits; verify the stack TOP (tests + typecheck + prettier) before any force-push.

**After the parent of a stacked PR is squash-merged:** `gh pr edit <child> --base main`, then `git merge origin/main` into the child (no rebase, no force-push). Files the parent ADDED and the child changed conflict as add/add; take the child's side (`git checkout --ours <file>`), then check that `git diff origin/main --stat` lists only the child's own files. `gh pr checks <n> --watch` returns at once with "no checks reported" while the run is still queued; look at `gh run list --branch <branch>` before concluding CI did not start.

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
- `examples/faust-precompiled/` — not a server of its own: the shared sources for the precompiled-Faust demo PAGES (`examples/dawcore-wam/faust-precompiled.html` on the native transport, `examples/dawcore-tone/faust-precompiled.html` on the Tone adapter). `tremolo.dsp`, `compile.mjs` (`pnpm example:faust:compile`; `--fixtures` regenerates `website/static/faust-wams/`), the route-A effect registration, the shared page script, and `vite-plugin.mjs`, which both example configs load to serve the git-ignored `compiled/` folder at `/faust-compiled/` as static files (compiling on first start). Licensing rules for anything Faust-generated: `packages/dawcore-faust/CLAUDE.md`.
- `examples/media-element-player/` — React `MediaElementPlaylistProvider` starter; depends on only `@waveform-playlist/browser` + `@waveform-playlist/media-element-playout` (no `playout`/`tone`). First React example here — see the React-example note below.

**Do NOT exclude `tone` from `optimizeDeps` in examples that import it** (dawcore-tone) — excluding it serves its CJS dep `automation-events` raw and imports fail with "does not provide an export named". dawcore-wam's `exclude: ['tone', ...]` is inert there (native adapter, no tone import). One-time dep-optimization page reloads on first load after a config change are normal.

**Console access to workspace modules in Vite examples:** `await import('/@fs/<abs-repo-path>/packages/<pkg>/src/index.ts')` — Vite transforms TS on the fly, so devtools/evaluate can reach package APIs (e.g. `createWamInstance` for a param-range probe) without any page changes.

**Console access to node_modules deps in Vite examples:** `await import('/@id/tone')` — resolves through Vite's dep optimizer so pre-bundled CJS deps stay intact. **But it is a DIFFERENT module instance from the one the page's workspace source imports** — nodes built from it fail to connect to the app's graph ("A value with the given key could not be found"). To share the page's Tone, import the URL it already loaded: `performance.getEntriesByType('resource').map((e) => e.name).find((n) => /\/deps\/tone\.js/.test(n))`. The `/@fs/` trick FAILS for tone (`automation-events` served raw CJS → "does not provide an export named"); use `/@id/<bare-specifier>` for deps, `/@fs/<path>` for workspace TS.

**Adding a React example (not a web-component HTML page):** it must be a pnpm workspace member — add `examples/*` to `pnpm-workspace.yaml` and give the example a `package.json`, or `react`/`react-dom`/`styled-components` won't resolve (the dawcore examples sidestep this by not using React). In `vite.config.ts`: source-alias `@waveform-playlist/browser` (its `index.tsx` entry is engine-free, so the dev server never resolves `tone`/`playout`) AND set `resolve.dedupe: ['react', 'react-dom', 'styled-components']` — without dedupe the aliased packages load a second React copy → "Invalid hook call". `@dnd-kit/*` are _required_ `browser` peers (they tree-shake out of a MediaElement-only bundle but must be installed). examples/ are outside `build`/`lint`/`typecheck` (all `packages/*`-only), so example `.tsx` isn't CI-checked.

**Two example dev servers at once share one dep cache** (`node_modules/.vite/deps` at the repo root) — starting dawcore-native and dawcore-tone together left the Tone server pointing at an optimized `tone.js?v=…` the other had replaced ("Failed to fetch dynamically imported module" on every load). Run them one at a time, or restart the one you need with `--force`.

**Verify an example actually renders with a headless browser** (Playwright/chrome-devtools MCP), not curl — Vite serving modules `200` proves they _transform_, not that the React app _mounts_ (duplicate-React "Invalid hook call" only appears at render). `curl` was also flaky in the shell tool; prefer the MCP browser or `node`'s http.

### ESLint Baseline

Root flat ESLint config (`eslint.config.mjs`) with TypeScript + React Hooks checks. Run `pnpm lint` before committing — catches missing hook deps, unused variables, hook-rule violations.

**`pnpm typecheck` and vitest do NOT catch `react-hooks/exhaustive-deps`** — a missing hook dependency is an ESLint _error_ that passes both and surfaces only on full `pnpm -w lint`. Because lint output carries ~359 pre-existing `@typescript-eslint/no-explicit-any` _warnings_, the real signal is the `✖ N problems (E errors, W warnings)` summary / exit code (require **0 errors**, exit 0) — don't grep the noisy output for "error" or trust scoped per-file typecheck.

**`Set<Function>` triggers `@typescript-eslint/no-unsafe-function-type` (an ESLint _error_)** — same trap class: `pnpm typecheck` and vitest pass it, only full `pnpm -w lint` flags it. Event-emitter listener stores need either an inline `// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type` (as `PlaylistEngine` does) or a typed-union `Set<Events[keyof Events]>` (with one localized cast at the `_emit`/attach call site).

### Docusaurus Native Examples

Docusaurus-native React components (no Jekyll). See `website/CLAUDE.md` for the `createLazyExample` SSR/SSG pattern, webpack aliases, and theme integration.

---

## Important Patterns (cross-package)

Package-specific patterns live in each package's CLAUDE.md (see "Per-Package Documentation" below). The patterns kept here are cross-cutting — they apply across packages or to build/release infrastructure.

1. **Sample-Based Math** — Use integer samples (and `startTick` for tempo-independent positioning) for all timeline calculations. Duration and offset are sample-only; `startTick` is authoritative when present, `startSample` is a derived cache. Helpers: `createClip()` (samples known), `createClipFromTicks()` (tick-based, variable-tempo), `createClipFromSeconds()` (legacy time-based).
2. **Adding a New Rendering Mode** — Cross-package change: `RenderMode` type in core → theme colors + `*Channel` component in ui-components → `SmartChannel` branch → `ChannelWithProgress` background → `ClipPeaks` data fields in browser → `WaveformRoot` auto-detection (`renderModeById`). Follow `Channel.tsx` virtual-scrolling pattern.
3. **Grep Comments When Renaming APIs** — When renaming a prop or option, grep for the old name in comments too. Mechanical find-replace on code misses adjacent comments that describe the old behavior.
   The same applies when logic MOVES out of a file that keeps its name: on #685 twenty sentences in the package notes, two JSDoc blocks (copied into `llm-reference.md`) and the file list of `staticEngineImports.test.ts` still pointed at `PlaylistVisualization.tsx`, by then a 90-line composition.
4. **Prefer Props Over Mount/Unmount for Optional Providers** — When a provider controls both data and rendering, add a mode prop instead of conditional mount/unmount. Unmounting tears down the subtree and loses state; a prop switch is cheaper and keeps context consumers stable.
5. **No Manual `external` in tsup Configs** — tsup auto-externalizes `dependencies` and `peerDependencies` (including deep imports like `react/jsx-runtime`). Manual `external` lists drift when deps change, causing duplicate instances at runtime. All packages use tsup with no `external` field.
6. **Opus Always Encodes at 48000 Hz** — Per spec, Opus resamples all input to 48000 Hz. Ideal for pre-computed peaks workflows since most browser AudioContexts run at 48000 Hz. WAV/FLAC at 44100 Hz will mismatch on 48000 Hz hardware.
7. **Pre-Computed Peaks Require Sample Rate Match** — `.dat` file `sample_rate` must match `AudioContext.sampleRate`. On mismatch, `createClip` warns per-clip (with clip name) and consumers fall back to worker-generated peaks. Browser converts offsets for preview (`ratio = wdRate / clipRate`); those converted peaks stay, because the worker skips clips that have `waveformData` (checked while doing #692; an earlier version of this note said the worker replaces them). `configureGlobalContext({ sampleRate })` from playout compares against the actual hardware rate — warns, cannot force (Tone.js limitation).
8. **`sampleRate` Prop for Pre-Computed Peaks Matching** — `WaveformPlaylistProvider` accepts a `sampleRate` prop; `<daw-editor>` reads from the adapter's AudioContext. Peaks fall back to worker on mismatch.
9. **`@dawcore/*` packages can't be source-aliased in website webpack** — they use Lit `@customElement` decorators which the website's babel-loader doesn't parse without `@babel/plugin-proposal-decorators`. Use built `dist/` via node_modules (matches the `recording` / `annotations` pattern). Add as `workspace:*` dep in `website/package.json`, run `pnpm install` to symlink, no webpack alias needed.
10. **Webpack statically resolves literal dynamic imports** — even runtime-lazy `import('pkg')` chains are followed at build time. A package whose deps reference Node builtins (e.g. `@shren/faust2wam`'s `fs`/`url`) breaks the Docusaurus build; the website aliases `@dawcore/faust` to `false` since it ships no Faust UI. Vite tolerates the same chain.
11. **Structural interfaces against another package: verify method NAMES and EVENT NAMES from the real class** — grep for `methodName(` can match internal call sites in method bodies (e.g. Transport's `timeToTick() { return this._tempoMap.secondsToTicks(...) }`). A wrong name copied into a structural type AND its test mocks passes every unit test and fails only against the real object — pair structural typing with at least one real-integration check (precedent: `dawcore-wam/__tests__/transport-bridge.integration.test.ts`, transport as a devDependency). Same for events: a hand-rolled mock emitter will happily `emit('loop')` for a wrap the real `Transport` never announces (#646) — grep the `_emit(` sites before subscribing by name.
12. **Optional Peer at Bundle Time ≠ Tree-Shaking** — To make a peer truly optional in the _bundle_, the core entry must have NO static `import` path to it (dynamic `import()` or a subpath-export split) — `sideEffects: false` is not enough. A single tsup barrel concatenates all modules; esbuild keeps an unused `import * as X from 'peer'` (side-effectful external), though Rollup-with-`sideEffects:false` drops it — so tree-shaking is bundler-dependent. Precedent: the `@waveform-playlist/browser/tone` subpath (#510) makes the core barrel engine-free under all bundlers.
13. **"No static import of X" guards must be transitive** — a regex scan over a list of literal files misses transitive edges (e.g. `WaveformPlaylistContext → soundFontSync → playout`). Bundle the entry with esbuild (`build({entryPoints, external:['peer','@scope/*'], treeShaking})`) and grep the output for `from "peer"` — that's the authoritative guard (`coreBarrelEngineFree.test.ts`).
14. **Variable-URL dynamic imports need BOTH bundler directives** — `import(/* webpackIgnore: true */ /* @vite-ignore */ url)`. webpack/Rspack (the website) statically resolves variable specifiers without `webpackIgnore` and fails at runtime with "Cannot find module <url>"; Vite (the examples) needs `@vite-ignore`. tsup/esbuild preserves both inline comments into dist (verified in dawcore-wam's `dist/index.mjs`). Precedent: `packages/dawcore-wam/src/loader.ts` (#540).
15. **New self-initiated state transitions in a lower layer require a consumer-mirror audit** — when the engine (or an adapter) gains a way to change shared state on its own (e.g. #608's bounded-playback self-stop), EVERY consumer that mirrors that state has undocumented assumptions about who initiates transitions (the React provider's rAF loop and dawcore's editor were each the "sole stopper" of bounded playback; both broke differently). Grep for every subscriber/mirror of the affected events and trace each one — package-scoped tests all stay green while the cross-package contract breaks.

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

**Last Updated:** 2026-11-13
