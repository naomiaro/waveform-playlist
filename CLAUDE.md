# Claude AI Development Notes

This file contains important context, decisions, and conventions for AI-assisted development on the waveform-playlist project.

## Project Overview

Waveform-playlist is a multitrack Web Audio editor and player with HTML canvas waveform visualizations.
**Two branches (since 2026-11-23, after Tone.js's model):**

- **`dev`** is the default branch and the base of every PR: the current work. Its docs are published at `/waveform-playlist/next/`, and prereleases go to npm under `@next`.
- **`main`** is the stable line: the commit of the last release to npm `latest`, published at `/waveform-playlist/`. Nothing is developed there. A release moves it forward to the release commit on `dev` (a fast-forward; the project skill `release`, "From dev to main"); a fix for the stable line alone is a commit on `main` that is merged back into `dev` before the next release, with a real merge commit (`gh pr merge --merge`, the exception to squash merging: a squash does not link the histories and the next fast-forward is refused).
- **A release has one number,** `version` in the root `package.json` (`release` skill, "The release number"); the packages keep their own versions.

**Key Dependencies:**

- **Tone.js 15.1.22** (stable; the lockfile, website and examples) - Audio engine for playback, scheduling, and effects. `tone@next` (15.5.x) is also supported and gets its own CI job — see "Two Tone.js lines" in `packages/playout/CLAUDE.md`.

**Website aesthetic** — see `website/CLAUDE.md` for the Berlin-underground design system, dark-mode palette, and example styling guidelines.

## Project Roadmap

**Source of Truth:** `TODO.md` contains the complete multi-track editing roadmap and recently completed work.

**Current Phase:** v5.0.0 Stable

**Semantic Versioning:** Now that v5 is released, follow semver for all changes. Breaking changes require a major version bump. **Bumping a 0.x peer range is a MAJOR** for every package declaring it (e.g. `@dnd-kit/*` ^0.3→^0.5 → browser/ui-components/annotations majors): 0.x minors are breaking upstream, and consumers on the old range can't install. Removing an export in the same PR rides the same major. **A new REQUIRED field on an exported type a consumer can build is a major too**, also in a PR that only adds things: on #853 the plan said `minor` for browser while its own upgrade entry said TypeScript code building a `ClipPeaks` stops compiling (a doc reviewer saw the two disagree).

**Key Milestones Completed:**

- ✅ Phase 1: Foundation (React refactor, provider pattern, all core features)
- ✅ Phase 1.5: Bundle Optimization (tree-shaking, 23KB gzipped savings)
- ✅ Phase 2: Clip-Based Model (multiple clips per track)
- ✅ Phase 3.1a/b: Drag & Trim (real-time collision detection, bidirectional trimming)
- ✅ Phase 3.3: Splitting Clips (sample-based architecture, keyboard shortcuts)
- ✅ Audio Effects: 20 Tone.js effects with UI, runtime parameters, WAV export

## Publishing Convention

**Every PR that changes `packages/*/src` adds a changeset** (`pnpm changeset`; pick `patch` for `@dawcore/*` — zerover, never minor/major). **Merging it publishes:** a push to `dev` runs `.github/workflows/publish-next.yml`, which versions the packages the new changesets name and their dependents as `x.y.z-next.N`, commits that bump to `dev` as `github-actions[bot]` (pull before branching again) and publishes them to npm under the dist-tag `next`. A merge without a changeset publishes nothing. A stable release (`latest`) is still made by hand. Each package follows its own semver independently, and `changeset version` computes the bumps and the dependent cascade at the release.

**A PR that removes or renames public API also greps `.changeset/` for the old names** (bodies and frontmatter), **and a PR that removes a behaviour greps for the behaviour's words**: on #904 the pending #687 changeset described the removed dragover guard ("ignores a dragover…") without naming the ref. The pending changesets become one changelog: by the last part of #812 fourteen of them named API that later parts had removed, and `react-19-peer-ranges.md` still bumped `midi` for a `react` peer the package no longer had (a reviewer found that one). Removing a peer dependency also touches the requirements line of `website/static/llms.txt` and the package's "Peer Dependencies" line in `PROJECT_STRUCTURE.md`.

**A change cut into parts that are not each a finished state goes as ONE PR (maintainer, #843).** Every merge to `dev` publishes `@next`, so merging part 1, then 2, then 3, even minutes apart, publishes part 1 alone (#843 part 1 made React's and dawcore's arm mute an undo step until part 2 and part 3).

**Do not start a release unless the maintainer asks for one.** Everything about releasing (versioning, publishing with the hardware key, the republish cascade, peer floors, the release commit and the GitHub release) is the project skill `release` (`.claude/skills/release/SKILL.md`): load it before any `release:version`, `publish` or `gh release` command.

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
- Context hooks, one per group of fields that change together (#768, #688; the table is in `packages/browser/CLAUDE.md`, "Contexts Are Grouped by Change Rate"). Under either provider: `useIsPlaying`, `useCurrentTime`, `useSelection`, `useActiveAnnotation`, `useAnnotations`, `useAnnotationOptions`, `usePlaybackControls`, `usePlaybackRefs`, `usePlaylistView`, `usePlaylistSettings`, `usePlaylistZoom`. `WaveformPlaylistProvider` only: `useEditorControls`, `useEngineRefs`, `usePlaylistTimeline`, `usePlaylistMixer`, `useTrackReorderPreview`, `useLoop`, `useSelectedTrackId`, `useUndoRedo`, `useArrangement`. `MediaElementPlaylistProvider` only: `usePlaybackRate`, `useMediaElementTrack`
- `MediaElementPlaylistProvider`, `MediaElementTrackConfig`: `packages/browser/src/MediaElementPlaylistContext.tsx`
- `audioTrack()` and `AudioTrackOptions` (how a track names its audio): `packages/core/src/audioTrack.ts`
- The `Arrangement` (tracks, mix, undo history, loading): `packages/engine/src/arrangement/`; its React hooks `useCreateArrangement`, `useArrangementTracks`, `useArrangementSources`: `packages/browser/src/hooks/`
- The annotation store (`AnnotationStore`, `AnnotationStoreOptions`, `createAnnotationStore`; the one owner of the annotations, both providers' `annotationStore` prop): `packages/core/src/annotations/store.ts`, `applyAnnotationBounds` in `bounds.ts`; its React hooks `useCreateAnnotationStore`, `useStoredAnnotations`: `packages/browser/src/hooks/`
- Effects hooks return types: `packages/browser/src/hooks/useDynamicEffects.ts`, `useTrackDynamicEffects.ts`
- Peak types (`Peaks`, `Bits`, `PeakData`): `packages/core/src/types/index.ts` (re-exported by `webaudio-peaks` for backwards compat)

**Common Doc Drift:** Docs may reference deleted hooks, wrong property names (e.g., `gain` vs `volume`, `seek` vs `seekTo`), or properties attributed to wrong context hooks. Always cross-check docs against source interfaces.

**Verify docs render:** `pnpm --filter website build` (CSS calc warnings are pre-existing, harmless)

**Heading ids:** `## Title {#custom-id}` does not compile here (`MDX compilation failed`, with no line number). Link to the generated id and check it in the build output: the `id` of the `<h2>` in `website/build/docs/.../index.html` (code spans and punctuation are dropped, e.g. "`useIntegratedRecording`: a take stays on its track; pass `recordingTrackId` to the preview" becomes `useintegratedrecording-a-take-stays-on-its-track-pass-recordingtrackid-to-the-preview`).

**The built HTML writes heading ids without quotes** (`<h2 … id=core-context-hooks>`): a link checker over `website/build` matches `id="?([^"\s>]+)`.

**Package READMEs are a doc surface.** `packages/*/README.md` is what npm shows, and it is not under `website/docs`: on #756 `packages/dawcore/README.md` still documented `render-mode="piano-roll"` and `packages/engine/README.md` had a `ClipTrack` literal that no longer compiled, both found by a reviewer. When an attribute, prop or required field changes, grep `packages/*/README.md`, the root `README.md` and `examples/` as well as the website.

**Wrong documentation found on the way is corrected in the same PR (maintainer's rule, 2026-11-12).** Also when it is older than the PR and outside its subject: fix it, check the new sentence against the source line, and list it in the PR text. On #685 part 3 that was two components documented but not exported, an example outside its provider, four README links and an error message's URL. To check every documentation URL in the repository against the doc files that exist: extract `https://naomiaro.github.io/waveform-playlist/docs/<path>` from the tracked `.md`, `.txt`, `.ts` and `.tsx` files and test for `website/docs/<path>.md`.

**Do not write a PR's number into a file before the PR exists.** Issues and PRs share one counter: on #763 two package notes said "#762" for the PR, an issue filed in between took 762, and the notes needed a commit to correct them. Refer to the issue the work closes, or add the PR number after `gh pr create` has printed it.

**Check where an error lands before documenting how to catch it.** For #756 the engine was made to throw on an invalid track, and the first plan was to tell React consumers to use an error boundary. Reading the provider showed both engine calls inside `try`/`catch` in an async function: React never sees the throw, and the provider reports it through `onError` and stays in its loading state. The guide says that instead. Trace the throw to where it stops, in each library, before writing the advice.

**Decide the doc surface in the design, before the first review.** On #762 a new DOM attribute (`data-selected`) was documented only after the review had started; each docs commit needed its own round, and the rounds found a sentence that overclaimed and a CSS example that did not work. When a change adds anything a consumer can see (attribute, prop, theme key), name the guide page in the design message.

**The "Before" half of an upgrade snippet is checked against the old source too.** On #812 part 6 the first `useMidiTracks` snippet had `name: 'Piano'` on a `src` config before and on `loadMidiTracks` after; the hook ignored `name` for a file (`git show dev:<file>`), the function applies it, so the two were not equivalent. For each option copied across, read what the removed code did with it.

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

## Project skills

Task-specific notes live in project skills (`.claude/skills/<name>/SKILL.md`), loaded when the task calls for them. This file keeps what applies to every session. A learning goes into the skill it belongs to, or into the package's notes when it is about one package; into this file only when it applies whatever the task.

| Skill                  | Load it when                                                                                       |
| ---------------------- | -------------------------------------------------------------------------------------------------- |
| `state-ownership`      | designing, planning or reviewing a change that adds, moves or shares state                         |
| `translatable-strings` | a React component draws or announces text                                                          |
| `design-proposals`     | proposing a design, a fix or an option; removing or moving anything public                         |
| `react-patterns`       | writing or reviewing effects, contexts, stores, provider values                                    |
| `dnd-kit`              | any code that uses @dnd-kit; a drag that misbehaves; issue #796                                    |
| `unit-testing`         | writing or debugging a vitest test                                                                 |
| `mutation-testing`     | checking that new tests can fail                                                                   |
| `e2e-playwright`       | writing, running or debugging a Playwright spec                                                    |
| `browser-probes`       | measuring a page from a script or an MCP browser                                                   |
| `web-component-design` | designing or changing a dawcore element: attributes, properties, children, lifecycle, cancellation |
| `review-rounds`        | briefing a review, audit or documentation agent                                                    |
| `dependency-updates`   | Dependabot alerts, `pnpm update`, overrides, adding or removing a peer                             |
| `release`              | versioning, publishing, the GitHub release                                                         |

---

## Code Conventions

### No Cross-Package Re-Exports

**Rule:** Packages must not re-export symbols from other packages. Consumers import from the canonical source directly. This prevents transitive dependency issues (e.g., #373 where dawcore pulled in React via recording's re-exports). When moving functions between packages, update all import sites — don't leave re-exports for backwards compat.

### One Owner per Exported Name (#770)

**Rule:** a name is exported by one package. Bound controls live in the lowest package that can reach their state (the four annotation controls are in `annotations`, which reads browser's hooks). The pairs that remain on purpose are the five controlled/bound controls of ui-components and browser. `packages/browser/src/__tests__/oneOwnerPerExport.test.ts` scans the entries of browser (also `./tone`), annotations, ui-components, spectrogram, recording and core; its header lists what it cannot see. To find overlaps yourself, compare the name sets of each `dist/index.d.ts`, and check second entries (`./tone`) too. **`export *` makes every `export` of a file public:** ui-components' `components/index.ts` re-exports each component file whole, so a fallback constant exported from `Clip.tsx` reached the package entry unnoticed (#853). After adding an `export` to such a file, look for the name in the built `dist/index.d.ts`; export only what a consumer is meant to import.

**No literal element id, and nothing read from the page (maintainer, 2026-11-13).** Ids come from `useId()`; a value another component holds arrives as a prop or a context, never through `document.querySelector`. The same test scans for a literal `id=` / `htmlFor=`.

**Every string a component draws can be supplied by the app (translation frameworks).** `children` for a label, `title` for a tooltip; no English-only helper (`getShortcutLabel` was removed for this). The rest of the library is #808.

### One Owner per Piece of State

**Rule (maintainer, 2026-11-13): every piece of state has one owner. Everything else subscribes to it and changes it by asking the owner.** No second stored copy that has to be kept in step.

- A controlled prop with a change callback is two owners when the library also keeps and changes the value: the app's state is one place, the library's copy the other. A callback that hands back a whole array or object is a write computed earlier than it lands, and storing it overwrites whatever was written in between.
- A guard, a merge or a flag between two owners closes one sequence of events; the next sequence needs another. Name the owner instead.
- Moving a seam is not removing it. After choosing an owner, list every other object that still stores the value and writes back.
- A value computed from the owner during render, a cached projection that is never written back and a one-way cache downstream (what an audio adapter holds) are not second owners.
- Since #812 the tracks have one owner: an `Arrangement` the app makes with `useCreateArrangement` and gives to `WaveformPlaylistProvider`, which derives what it publishes and writes nothing back (`packages/browser/CLAUDE.md`, "The Provider Plays an Arrangement").
- Where it came from: #812. Until then the tracks had two owners (the app's `tracks` state and the engine, joined by `onTracksChange`), and one day of work found a loaded clip that stayed "loading" in the app's state, a lost update (a page showing 2, 4 and 3 rows of 4) and an undo that removed a track the app still held; a first redesign moved the same seam between a store and the engine. The issue body is the record.

The project skill `state-ownership` (`.claude/skills/state-ownership/SKILL.md`) is how to apply it: the owner table that opens a design, a plan or a review, what to send the maintainer when a row has two places, and the shapes in this codebase that hold one owner (`ValueSource`, `EffectsRack`, `annotationPreview`).

### Declarative Over Imperative

**Rule:** Consumer code should read as a declaration of what they want, not how to set it up. When multiple hooks/providers must be wired together, create a higher-level component that reads from context internally and exposes simple boolean props.

**Examples:** `ClipInteractionProvider` (replaces DragDropProvider + sensors + modifiers + handlers), `KeyboardShortcuts` (replaces usePlaybackShortcuts + useClipSplitting + useAnnotationKeyboardControls wiring), `ClearAllButton` (wraps stop + clear). Keep the low-level hooks exported for power users who need custom behavior.

The view follows the same rule since #703: `<Waveform />`, `<WaveformEditor />` and `<MediaElementWaveform />` are compositions of exported parts, and a part wires what it needs itself (`WaveformAnnotationBoxes` owns its drag provider and sensors).

### React/TypeScript

- **React 19 only** (since #702): every React package peers on `react`/`react-dom` `^19.0.0` and `styled-components` `^6.0.0`, and all workspace devDependencies pin the same React, so there is ONE React copy in the workspace. Keep it that way — a package without an explicit `react` devDependency gets whatever pnpm auto-installs for the peer, and a second copy breaks any jsdom test that mounts components across packages ("Cannot read properties of null (reading 'useContext')", or `(reading 'use')` from a library hook since #771: that is what `use()` gives with no dispatcher, run in a test; the two-copies case itself was not re-run / "A React Element from an older version of React was rendered"). `packages/browser/src/__tests__/helpers/arrangementProvider.tsx` (`renderWithArrangement`, `TestProvider`) is the template for mounting the full `<Waveform />` under jsdom.
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

The exceptions that stay, decided on #828 (do not copy them as precedent): `preservesPitch` on `MediaElementPlaylistProvider` defaults to `true` because it mirrors `HTMLMediaElement.preservesPitch`; the `enabled` option of the shortcut hooks defaults to `true` (a hook option, not a JSX prop); ui-components' low-level `Clip` keeps `showFades` and `disableHeaderDrag` (browser maps `<WaveformFades>` onto `showFades`). `ExportWavButton.applyEffects` is #817's.

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
  - **Format the files you changed, not the package.** `npx prettier --write src` in a package rewrote a file the change had nothing to do with (`packages/dawcore/src/styles/theme.ts`, which is not prettier-clean on `dev`); it had to be restored with `git checkout --`. Pass the changed paths, and read `git status --short` before committing.
  - **`prettier --check` a file at its own path before `--write`.** A copy elsewhere (an ignored folder such as `.superpowers/`) prints "All matched files use Prettier code style!" for a file that is not clean; `website/src` example components are not prettier-formatted (on #898 a `--write` rewrote 400 lines of `AnnotationsExample.tsx`). Match their style by hand.
  - **`pnpm lint` is `prettier --check && eslint` (prettier FIRST)** — a formatting issue exits 1 with NO `✖ N problems` ESLint summary (eslint never runs after prettier fails). Exit 1 + missing summary = a prettier failure, not lint errors → `pnpm format` (or `prettier --write <file>`). Don't chase a phantom "0 errors but exit 1".
- **Example HTML pages are outside lint scope** — `pnpm lint` only covers TS/TSX under each package's `src/`; prettier flags every HTML file in `examples/` if run on them directly. Match the existing file style by hand, don't reformat them. (Do not bold-wrap glob patterns containing `**` in this file — prettier's markdown parser corrupts them.)
- **New packages**: After adding a new `packages/*/package.json`, run `pnpm install` and commit `pnpm-lock.yaml`. CI uses `--frozen-lockfile` and will fail if the lockfile is stale.
- **Verify bundler tree-shaking with the real binary** — `npx esbuild`/`npx rollup` can be command-not-found; with stderr suppressed, grep on empty output gives a FALSE clean pass. Use `node_modules/.pnpm/esbuild@*/node_modules/esbuild/bin/esbuild` directly, don't suppress stderr. esbuild emits `from "x"` (with a space); single-file `--outfile` inlines dynamic `import()` targets — use `--splitting --outdir` to distinguish eager (entry chunk) from lazy.
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
- **"Behavior unchanged for X" claims in changesets: diff old vs new numerically** — `git show dev:<file> > <scratch>/old.ts`, run both versions over the common inputs with node, and compare. Reasoning alone missed that bar-anchored snapping also changes 3/4 and 6/8 half-note/triplet grids, not just odd meters (#647).
- **A fact quoted from an issue is checked against the source before it goes into a changeset, comment or PR text.** Issues filed from a review (#722: "I did not re-run that simulation") carry the reviewer's premises: "48000 Hz / 1000 samples per pixel (the default zoom)" was wrong (`DEFAULT_SAMPLES_PER_PIXEL = 1024`; 1000 is only `PlaylistInfoContext`'s no-provider fallback), and it inverted which of the two fixes users would see. Grep the default, then re-run the issue's numbers at it.
- **Removing a field of a hook's value: search the destructurings, and search `website/src`, `examples/` and `debug/` as well as the packages.** For #685 part 3 `usePlaylistView().controls` was removed after a grep for `\.controls\b` over the packages found one reader. Three example components had `const { sampleRate, controls } = usePlaylistView()`; one used it inside an effect, so the recording page loaded, drew the same pixels and crashed on Record (`Cannot read properties of undefined (reading 'show')`). Nothing typechecks `website/src`; only the e2e run found it. Grep the field name next to the hook's name in every directory that imports the package, and ask what each reader used the value FOR before writing "no replacement" in the upgrade guide.
- **Typecheck does not find a removed field passed through a non-literal object.** After `annotationList.annotations` was removed (#898), tests that built the prop in a variable or a mount helper's options typechecked and 31 failed at runtime. Run the package's whole suite after removing a field, not only typecheck.
- **macOS has no `timeout`:** a `timeout N cmd` in a chain fails with "command not found" and leaves an empty log. Use the Bash tool's own timeout, or `run_in_background`.
- **zsh does not split an unquoted variable into words.** `npx eslint $FILES` and `perl -pi … $FILES` hand the whole list over as one argument ("No such file or directory", or an empty result that looks like a pass). Pipe the list through `xargs`.
- **A `cd` in one Bash call stays for the next ones.** After `cd packages/browser && npx vitest …` a later `packages/…` path or `git` command resolves from there. Run a package command in a subshell, `(cd packages/browser && npx vitest run …)`, or start each call with `cd` to the repo root.
- **A script that rewrites an import list drops a comment inside it** (a second time on #685: `// PlayButton, PauseButton, StopButton omitted …` became three names). After a codemod over imports, diff for removed `//` lines.
- **Quote grep globs: the shell here is zsh.** `grep -rn x packages --include=*.ts` stops with `no matches found: --include=*.ts` when no file in the current directory matches the glob, and in a chained command the output of the other parts still prints, so the search looks complete. On #752 this hid `buildTrackFromConfig.ts`, the one WRITER of the field being removed, until typecheck was run. Write `--include='*.ts'`, and when any part of a command prints an error, run the search again before using its result.
- **`echo =====X` fails in zsh** (`=name` is expanded as a command path: "=====X not found", and the rest of the chain does not run). Quote separators: `echo '-----'`.
- **zsh reads `$var[` as an array subscript:** `grep "id=$id[\" >]"` fails with "bad math expression". Write `${id}` before a `[`.
- **`git grep -E` here has no `\b`:** a pattern with it matches nothing and prints nothing, which reads as "none found". Use `-w`, or a character class before the word. An empty result from a search that should have hits means the search is wrong. A "nothing reads X" claim to the maintainer is searched with `-w` (or XERJ) and with a field the search must find as a control: on #931 a `\b` loop over six fields printed nothing, and "no adapter reads any view field" went out wrong for Tone's `track.name`.
- **My own `pnpm build` breaks my own dev server too** (the same "Can't resolve '@dawcore/components'" overlay): restart the 3077 server after any build, before a probe or an e2e run.
- **Keep `examples/*.html` and `debug/` out of a repo-wide attribute grep** (hundreds of page-level ids); scan `packages` and `website/src`.
- **"Measured" in a doc means a test in the repository.** A number from a throwaway test is written as that.
- **One rule for "is this a MIDI clip": `midiNotes != null`, core's `clipKind`.** `!== undefined` in a renderer made a plain-JS audio clip with `midiNotes: null` a piano roll while the engine accepted it as audio.
- **Per-track things that are not plain data go through a provider prop keyed by track id, never onto the track object** (#752). A track is plain data the arrangement holds, copies and puts in undo steps; a function on it is not. Details and history: `packages/browser/notes/playback-and-engine.md`, "Per-Track Things That Are Not Plain Data Go Through a Provider Prop (#752)".
- **Do not chain a commit after a test run with `;`.** `vitest run … ; git add -A && git commit` committed over a failing run (#751: 1 failed of 589, the name lost because the output was filtered through `grep`). Run the tests as their own command, read the result, then commit; and send a suite's output to a file when a failure would need its name.
- **The same holds for a push and for `gh pr create`.** On #760 `pnpm test > log; grep …; git push; gh pr create --body-file …` opened a PR whose description said "228 passed" for a run that had 1 failure, because the body was written before the run and nothing stopped the chain. A test run is its own command; the description is written after its result has been read.
- **And for lint, typecheck and a build: any check.** On #847 `pnpm lint > log; echo; git add && git commit` committed over a prettier failure (282007e1). Every check is its own Bash call; read its result, then commit. A commit message that states a number (lines, tests) gets the number checked first: `git commit --amend` is blocked in auto mode, so a wrong one stays (bd796b99 says 677 lines for 675).
- **A backgrounded `cmd > log; echo "exit $?"` always ends with code 0** (the `echo`'s). Read the printed `exit N` line or the log, never the task notification's exit code: on #932 a failed `pnpm build` (three TS errors) was reported as a pass.
- **Scripted edits assert their match count.** `perl -0pi` or python with the number of replacements checked, and the replaced text printed when the anchor is a guess: on #847 a cut that ended at the wrong marker duplicated three methods (`TS2393`), and one that started too early removed the end of a test.
- **An `import` line can also be text.** Storybook descriptions hold code blocks in template strings (`Waveform.stories.tsx`); a replace with count 1 hit that copy and left the real imports alone. Print the matched line number and check it is code.
- **`packages/ui-components/src/stories` are outside every typecheck** (`tsconfig.json` excludes them). To check a changed story: a temporary `tsconfig.storycheck.json` that extends the package's and includes only that file, `npx tsc --noEmit -p` it, ignore the `TS2307` module errors (Storybook aliases), delete the config.
- **Scratch files go in the session scratchpad, never `/tmp`.** `cp file /tmp/x` wrote into an existing directory `/tmp/x/`.
- **Hard refresh**: Always use Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux) after builds — and after ANY dev-server restart: a tab left open across a restart keeps running the old bundle and reports plausible-looking "engine" bugs (e.g. a trim that plays the untrimmed clip) that no fresh headless repro can reproduce. Before debugging a user-reported regression in a dev-server tab, confirm the tab was hard-refreshed after the last restart.
- **A background Bash command is cut off at 10 minutes, but its children keep running.** Wait with `until ! pgrep -f <name> > /dev/null; do sleep 3; done`; `sleep N; cmd` in the foreground is blocked.
- **Stray NUL byte in a source file = silent `Bin` diff** — a 0x00 that sneaks into a `.ts` file (e.g. from a tool edit) makes `git diff --stat` report the file as binary while tsc, prettier, AND vitest all pass silently. Detect with `perl -ne 'print "line $.\n" if /\x00/' <file>` — bash `$'\x00'` CANNOT pass a NUL to grep (it degrades to `grep ""`, matching every line). Fix with `perl -i -pe 's/\x00/ /'`.
- **Agent worktrees & dev servers:** Background agents run in `.claude/worktrees/agent-*`. When an agent finishes: its dev server dies (browser tabs still open against it fail dynamic imports with misleading "package not installed" hints — reload against a real server), and stale worktrees linger holding their branch names (`git worktree remove --force .claude/worktrees/agent-* && git worktree prune`). Never trust which checkout `pnpm example:*` serves — the startup log prints the cwd.
- **Another session may switch this checkout under me** (#890: a second session checked out its own branch 27 s after mine was created, and my uncommitted edits went with it). Check `git branch --show-current` before committing. For a PR's work, use a worktree of its own: `git worktree add ../waveform-playlist-<topic> <branch>`, then `pnpm install` and `pnpm build` (unit tests resolve sibling packages through `dist`: without the build 18 of 21 engine test files fail with `Failed to resolve entry for package "@waveform-playlist/core"`). MediaElement e2e there needs `website/static/storybook` linked from the main checkout.

**CI Validation:** `.github/workflows/ci.yml` runs on PRs to `dev` (and to `main`, for a fix to the stable line): build and lint (includes prettier check). A PR that changes only Markdown, `docs/`, `plans/`, `website/docs/` or `llms.txt` starts no run (`paths-ignore`): `gh pr checks` then says "no checks reported" and stays that way, which for such a PR is the expected final state and not a queued run (confirm with `gh pr view <n> --json files`). CI never built the website, so for docs changes `pnpm --filter website build` locally is the check. CI runs only on PRs whose base is `dev` or `main` — stacked child PRs show no checks until retargeted after their parent merges. Fix formatting with `pnpm format` before pushing. `gh pr checks --watch` can exit 0 while checks are still pending/queued — always re-run `gh pr checks` and read the actual states before merging or diagnosing.

**The independent review covers the FINAL diff.** Any commit added after a review (including changes the maintainer asks for mid-PR) means a new review before merging; a go-ahead on behaviour is not a waiver, and "not reviewed" in the PR text does not close the gap. #721, #724, #725 and #727 were merged with unreviewed commits; the post-merge reviews found a cursor regression, stale playback state and a dead Escape, fixed in #729 over four review rounds. To end the loop honestly, stop changing code after a round that finds nothing above low, and list the lows in the PR. The maintainer may waive the review for named small fixes after such a round (#741: two one-line lows); then the PR text says which commit was not reviewed. Before fixing an interaction bug, state the behaviour choice and ask: on #741 the narrow fix ("end the drag on release outside") was built and tested before the maintainer was asked, and they chose the other behaviour (follow the pointer). For UI behaviour the maintainer is trying by hand (keys, focus, playback), open the PR and leave it for them; describe behaviour by stating where focus is and what the native control would do with the key.

**A merged PR's lows go into the tracker issue #934 (maintainer, 2026-11-26).** At the merge, add each low the PR text lists: one line with its PR, its file and whether it was run or read. Rewrite #934's body when an item is fixed, split into its own issue or found wrong; a PR description alone is never read again (the 15 PRs swept when it was set up had left 61 lows untracked; the search missed six more PRs that also listed lows, now on #934's not-swept list). Adding a PR's lows is also an edit of the body, not a comment.

**A ruling a consumer can observe goes to the maintainer in the report that follows, as a question, not only into the ledger.** On #849 I recorded "an object-form `updateTrack` is always sent" as a ruling; a side agent raised it and the maintainer chose otherwise. Three more notes that day were right (the React editor has the same undo-during-drag problem as `<daw-editor>`; `error.cause` can quote a URL's password; a redundant adapter call), each about something I had written down as documented or minor.

**A question to the maintainer states only checked facts, and asks every choice it announced.** On #917 a question said `play()` throws without an adapter (it warns and fires `daw-error`), and the maintainer dropped a warning on that premise; a message that named three choices asked one, and a side agent noticed. Read the source line behind each premise before asking, and put every announced choice in the question.

**When an edge case keeps producing choices, ask whether the state should exist at all.** A loading clip on a MIDI track was accepted, never fetched and reported (carried over from an earlier design); it then needed a rule for a source named on both kinds of track. The maintainer's question ("are we letting people name the same source across audio and midi?") led to refusing it at the door, which removed the code, the rule and the question. Before offering a/b/c for an edge, say whether refusing the input is an option.

**"Read, not run" plus the word "now" needs the same run on `dev`.** The ledger said undo during a clip drag "now" leaves an offset clip. Run on both: the offset is on `dev` too, in both editors; what the change added was per-move undo steps and a warning (#848). To compare a browser behaviour across branches without a build: the dawcore Vite examples alias engine, core, transport and dawcore to source, so `git checkout dev -- packages/<pkg>/src` under the running example server, measure, `git restore --source=HEAD --staged --worktree -- packages`. For the Docusaurus site stop the server first (the existing rule).

**Nothing edits source while an e2e run or a review round is in flight.** The Docusaurus dev server hot-reloads on every source change, so an edit by the author, or a review agent's mutation check, can empty the page under a running test: on #749 one full run failed a single test with zero drag handles on the page, and the same test then passed 15 of 15. Run the final e2e after the reviewers have finished, with a clean tree. And hold your own edits until a review round returns: on #749 a commit landed while the second reviewer was reading, and the review covered it only because the reviewer noticed HEAD move. Before merging, check that the review, the e2e run and CI all name the PR's head commit (`gh pr view <n> --json headRefOid`).

**One source per option in the React components (maintainer's rule, 2026-11-11).** No prop beside a context for the same thing, and no option passed down through components that do not use it: a small context whose value rarely changes, read where it is used. Keeping the old prop "so nothing breaks" is the doubling that was rejected; in this major, remove it and write the upgrade entry. `packages/browser/CLAUDE.md`, "Clip Interaction Options Have One Source", is the worked case.

**A bug found on the way goes to the maintainer in the same message, before the fix it was found under is finished.** On #685 a test showed an inline `onTracksChange` re-running the provider's loading effect; I wrote it into a test comment and carried on, and a side agent reported it first. Say what was run, what was only read and what is unverified, then file it (#791).

**A change to the shape of a public value goes to the maintainer before it is built, also when it follows from an approved fix.** Keeping mixer state by id made `trackStates` hold `undefined` in place for a loading track; a side agent reported it first. The same for an oddity seen in a test (the empty timeline running a second, full build).

**`-- 'packages/*/src'` matches no file in `git diff` or `git grep`** (the pathspec is not a shell glob). Use `-- packages` and filter with grep. On #890 a `git grep` for `.current ?? 0` with it printed nothing, and a note said none were left; there were 20.

**`revise-claude-md` runs before the merge is asked for**, so the learnings go in the PR that produced them (#782 was merged without it and needed a docs PR afterwards).

**Two A/B questions open at once get one "B".** Ask one lettered question at a time, or give the options distinct names ("border: orange / amber").

**A question goes in its own message, in plain words first.** On #770 `LABEL-FIX-HERE or LABEL-ISSUE` sat in the middle of a status update and was not seen as a question. Say what was found, what the two outcomes are, then name the options.

**Label the choices the way they will be answered, and keep what I plan to run out of the list.** On #771 part 2 three choices were numbered 1 to 3 and the answer came back as a), b), c); a sentence after the list about a test I meant to run ("the `immediate: true` case") was then looked for as a question that did not exist. Letter the choices, one line each, and put "next I will run…" in a separate paragraph that says it needs no answer.

**`website` aliases `browser`, `core`, `playout`, `engine`, `ui-components`, `annotations`, `spectrogram`, `midi` and `recording` to source** (`website/docusaurus.config.ts`, read 2026-11-14; `worklets`, `webaudio-peaks` and `@dawcore/*` come from `dist`), so a prototype may edit them with only the dev server running. Bulk file changes under a running Docusaurus dev server can abort it (rspack panic, SIGABRT): check the server's log before trusting a probe after a large patch.

**GitHub closing keywords don't distribute over comma lists** — `fixes #589, #590, #593` in a squash-merge commit closes ONLY #589; each reference needs its own keyword (`fixes #589, fixes #590, fixes #593`). A `closes #N` in the PR body works independently. After merging a multi-issue PR, verify each issue actually closed (`gh issue view N --json state`).

**A closing keyword works inside a negation.** "It does not close #688" in the body of #782 closed #688 on merge. For a PR that is one part of an issue write "Part 1 of 3 for #688" and no keyword next to the number; after the merge check `gh issue view <n> --json state`.

**A keyword followed by a colon closes too.** "…stays until clauderic/dnd-kit#2203 is fixed: #905" in #904's body put #905 in the PR's closing list. After writing or editing a PR body, read `gh pr view <n> --json closingIssuesReferences` and check it lists only the issues meant.

**Sub-issues don't close with their parent epic** — `closes #<epic>` closes only the epic; its sub-issues stay open (found on #455: all three sub-issues open after the epic closed). Enumerate them via GraphQL (no `gh` subcommand): `gh api graphql -f query='{ repository(owner:"naomiaro", name:"waveform-playlist") { issue(number:N) { subIssues(first:50) { nodes { number title state } } } } }'`, then close each with a comment pointing at the implementing PR. To attach a new issue to an epic: `gh api graphql -f query='mutation($p:ID!,$c:ID!){ addSubIssue(input:{issueId:$p, subIssueId:$c}) { subIssue { number } } }' -f p="$(gh issue view <epic> --json id -q .id)" -f c="$(gh issue view <new> --json id -q .id)"`. An epic with an open sub-issue stays open when the PR that closes the last original one merges.

**When an open issue's facts change, rewrite its description; do not comment (maintainer, 2026-11-24).** An item fixed by a merged PR, code moved to another file, an item moved to or from another issue: edit the body (`gh issue edit <n> --body-file <file>`) so it reads correctly on its own. Say what changed and in which PR, keep the original findings and their run/read status, mark old line numbers "from before the move", and replace a moved item with one line naming the issue that tracks it. A comment is for closing an issue (why, and what was run). Comments of mine that the body now holds are deleted (`gh api -X DELETE repos/naomiaro/waveform-playlist/issues/comments/<id>`); never someone else's.

**Commit messages with backticks:** never inline them in a double-quoted `git commit -m "…"` — the shell command-substitutes them (one release-arc commit shipped with a word silently deleted). Use `git commit -F - << 'EOF'` (quoted delimiter).

**A command refused by the permission check runs none of its parts.** In auto mode `gh pr merge` ("Merge Without Review") and `gh issue create` ("External System Writes") were refused until the maintainer said in the conversation to merge or to file. Do not work around a refusal: carry on with other work and tell them. A file written by an earlier `cat <<'EOF'` in the same refused command does not exist, so do not report its path.

**Text with backticks in a shell-fed script:** the same trap applies to `python3 - <<EOF` and `cat <<EOF`: with an unquoted delimiter the shell runs every backticked word as a command and silently deletes it (a PR description lost its code spans this way; the only sign was `command not found` lines). Always quote the delimiter (`<<'EOF'`) and pass paths in as arguments (`python3 - "$FILE" <<'EOF'` … `sys.argv[1]`).

**Reading pnpm's own code: the pnpm that runs here is the one `packageManager` pins (8.15.0), in `~/Library/pnpm/.tools/pnpm/8.15.0/node_modules/pnpm/dist/pnpm.cjs`.** `pnpm --version` says 8.15.0, but `$(which pnpm)` resolves into nvm's global pnpm, which is 10.x: on #891 its `replaceWorkspaceProtocolPeerDependency` was cited for what 8.15 does with `makePublishDependency` (a doc reviewer found it). Check the version string in the file you read.

**pnpm Build Ordering:** `pnpm recursive run` determines build order from `dependencies` and `devDependencies` only — **not** `peerDependencies`. If package A needs package B's types at build time (e.g., for DTS generation), B must be in A's `devDependencies` even if it's already a `peerDependency`. Without this, CI builds fail because packages build in parallel/alphabetical order.

**Type Migration Gotcha:** When moving types between packages, `pnpm typecheck` resolves workspace packages via `dist/` (not source). Build the source package first: `pnpm --filter @waveform-playlist/PACKAGE build` before `pnpm typecheck`. Same applies to _adding_ fields to interfaces in upstream packages — downstream `pnpm typecheck` won't see new optional properties (`TS2353` / `TS2339`) until the upstream is rebuilt. Also grep the entire repo for old import paths — easy to miss straggling imports.

### E2E Testing with Playwright

`pnpm test` runs the whole Playwright suite (Chromium only, `e2e/`, not part of CI) and should be all green: a red run is a signal, not a flake, until failure rates on the branch and on `dev` say otherwise. Load the project skill `e2e-playwright` before writing, running or debugging a spec, and `browser-probes` before measuring a page from a script or an MCP browser. Three rules apply before either is loaded:

- **Check port 3000 before `pnpm build`, `pnpm test` and `git checkout`,** as a command of its own: `lsof -nP -iTCP:3000 -sTCP:LISTEN`. The maintainer often has a Docusaurus server running in this checkout; a build or a branch switch breaks it, and the Playwright config reuses whatever listens there. If something is there and you did not start it, do not kill it and do not build: `cd website && pnpm exec docusaurus start --port 3077 --no-open`, then `PORT=3077 pnpm test`.
- **With a server of my own running, every Playwright command gets `PORT=3077`.** Without it the config starts a second server on 3000 and crashes the first (shared rspack cache).
- **Nothing edits source while an e2e run is in flight** (the paragraph of that name above).

**Git Safety:** Always make intermediate commits before running `git stash` or switching branches. A failed `git stash pop` + `git checkout -- .` can destroy all uncommitted work permanently.

**Stacked branches:** after rewriting a parent, re-stack each child with `git rebase --onto <new-parent> <old-parent-tip> <child>` (a plain rebase replays stale copies of the parent's commits); `git commit --amend` is blocked in auto mode — use follow-up commits; verify the stack TOP (tests + typecheck + prettier) before any force-push.

**After the parent of a stacked PR is squash-merged:** `gh pr edit <child> --base dev`, then `git merge origin/dev` into the child (no rebase, no force-push). Files the parent ADDED and the child changed conflict as add/add; take the child's side (`git checkout --ours <file>`), then check that `git diff origin/dev --stat` lists only the child's own files. `gh pr checks <n> --watch` returns at once with "no checks reported" while the run is still queued; look at `gh run list --branch <branch>` before concluding CI did not start.

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

**Install Hints Name a Range Inside the Peer Range (#884).** A runtime message that tells the reader to install one of our packages, as a command or in prose, gets the command from `installCommand()` (browser `src/utils/installCommand.ts`, dawcore `src/utils/install-command.ts`), never a literal `npm install <name>`: that installs `latest`, which can fail the peer range of a `next` build (`@dawcore/transport >=0.0.16-0` against 0.0.15) and can send a stable user on an older major to the newer one. The ranges are written in at build time by `scripts/build/install-specs.mjs`: a `workspace:` peer as pnpm 8.15 publishes it; on a peer under `packages/`, a hand-written range of `>=` floors (dawcore's) as a caret on the peer's version in the same manifests, which stops before the next breaking release where the floor does not (maintainer, #891), and the range as written, with a warning in the build log, when the floor does not admit that version yet or the range has another shape; a peer outside `packages/` (`tone`, `react`) as written, with no warning. They are passed as `define` by the package's `tsup.config.ts` AND `vitest.config.ts`. A name that is not a peer goes in both configs' extra list (dawcore names playout's adapter, browser names spectrogram), and a test in each package checks both configs and that every `installCommand('…')` in its source has a range. Source compiled without the define prints the bare name: browser on the website and in the React examples, dawcore in its Vite examples (the website uses dawcore's `dist`).

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

**`pnpm typecheck` and vitest do NOT catch `react-hooks/exhaustive-deps`** — a missing hook dependency is an ESLint _error_ that passes both and surfaces only on full `pnpm -w lint`. Because lint output carries about 490 pre-existing _warnings_ (493 on 2026-11-14, mostly `@typescript-eslint/no-explicit-any`), the real signal is the `✖ N problems (E errors, W warnings)` summary / exit code (require **0 errors**, exit 0) — don't grep the noisy output for "error" or trust scoped per-file typecheck. To see whether a branch added warnings, check whether any file it changed appears among the path lines of the output (`grep '^/' lint.log | grep -F -f changed.txt`), not the total. Take the list from the merge base, `git diff --name-only --diff-filter=AMR $(git merge-base origin/dev HEAD)` (working tree included; untracked files are not): `dev` moves on, and the same list passed to `eslint` stops it with "No files matching" when it holds a deleted file.

**`Set<Function>` triggers `@typescript-eslint/no-unsafe-function-type` (an ESLint _error_)** — same trap class: `pnpm typecheck` and vitest pass it, only full `pnpm -w lint` flags it. Event-emitter listener stores need either an inline `// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type` (as `PlaylistEngine` does) or a typed-union `Set<Events[keyof Events]>` (with one localized cast at the `_emit`/attach call site).

### Docusaurus Native Examples

Docusaurus-native React components (no Jekyll). See `website/CLAUDE.md` for the `createLazyExample` SSR/SSG pattern, webpack aliases, and theme integration.

---

## Important Patterns (cross-package)

Package-specific patterns live in each package's CLAUDE.md (see "Per-Package Documentation" below). The patterns kept here are cross-cutting — they apply across packages or to build/release infrastructure.

1. **Sample-Based Math** — Use integer samples (and `startTick` for tempo-independent positioning) for all timeline calculations. Duration and offset are sample-only; `startTick` is authoritative when present, `startSample` is a derived cache. Helpers: `createClip()` (samples known), `createClipFromTicks()` (tick-based, variable-tempo), `createClipFromSeconds()` (legacy time-based).
   Time in ms to pixel: `Math.floor((ms * sampleRate) / (1000 * samplesPerPixel))`, one division of integers, exact, and the floor `Clip` uses (#722). An accumulated pixel step drifts, and `(ms / 1000) * pixPerSec` rounds twice (off at the default 1024 in `<daw-ruler>`). A loop that stops on `pix >= widthX` never ends on a `NaN` width; write `!(pix < widthX)`.
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
12. **Optional Peer at Bundle Time ≠ Tree-Shaking** — To make a peer truly optional in the _bundle_, the core entry must have NO static `import` path to it (dynamic `import()` or a subpath-export split) — `sideEffects: false` is not enough. A single tsup barrel concatenates all modules; esbuild keeps an unused `import * as X from 'peer'` (side-effectful external), though Rollup-with-`sideEffects:false` drops it — so tree-shaking is bundler-dependent. Precedent: the `@waveform-playlist/browser/tone` subpath (#510) makes the core barrel engine-free under all bundlers. A dynamic `import()` keeps the peer out of the bundle but not out of the build: esbuild resolves every literal `import()` in a file it includes, also in code the app never reaches, so browser's single `dist/index.mjs`, which names both engines, stops an esbuild build without one with `Could not resolve` (#892); webpack warns, Vite builds. Until #890 the MediaElement case passed only because ui-components installed playout.
13. **"No static import of X" guards must be transitive** — a regex scan over a list of literal files misses transitive edges (e.g. `WaveformPlaylistContext → soundFontSync → playout`). Bundle the entry with esbuild (`build({entryPoints, external:['peer','@scope/*'], treeShaking})`) and grep the output for `from "peer"` — that's the authoritative guard (`coreBarrelEngineFree.test.ts`).
14. **Variable-URL dynamic imports need BOTH bundler directives** — `import(/* webpackIgnore: true */ /* @vite-ignore */ url)`. webpack/Rspack (the website) statically resolves variable specifiers without `webpackIgnore` and fails at runtime with "Cannot find module <url>"; Vite (the examples) needs `@vite-ignore`. tsup/esbuild preserves both inline comments into dist (verified in dawcore-wam's `dist/index.mjs`). Precedent: `packages/dawcore-wam/src/loader.ts` (#540).
15. **New self-initiated state transitions in a lower layer require a consumer-mirror audit** — when the engine (or an adapter) gains a way to change shared state on its own (e.g. #608's bounded-playback self-stop), EVERY consumer that mirrors that state has undocumented assumptions about who initiates transitions (the React provider's rAF loop and dawcore's editor were each the "sole stopper" of bounded playback; both broke differently). Grep for every subscriber/mirror of the affected events and trace each one — package-scoped tests all stay green while the cross-package contract breaks.
    The same holds for a NEW CAUSE of an existing answer: when the spectrogram worker began answering `aborted` for a clip whose audio changed mid-computation (#928), the orchestrator still treated every abort as "generation changed" and returned out of the whole render pass, leaving other tracks black. Grep every `instanceof X` / `case 'x'` handler and the comments that say what X means.

---

## Plans & Future Work

**Plans directory:** `plans/` contains future feature specs (waveform service, listening test tool).

**Effects/WAM roadmap:** Tracked as GitHub epics with native sub-issues — #412 (unified effects chain), #413 (WAM 2.0, `@dawcore/wam`), #414 (Faust), #415 (WCLAP spike). The architecture/design record lives in the epic issue bodies, not in docs/specs. TODO.md's WAM section is superseded by these issues.

**Web Components migration:** `docs/specs/web-components-migration.md` is the long-lived spec for the `@dawcore/*` WC surface (exception to the remove-specs-when-done rule; audited against code 2026-06-11). Remaining work is tracked as epics #452 (transport/control elements), #453 (record arming + VU meter), #454 (`<daw-player>`), #455 (annotations WC), #456 (accessibility), #457 (custom track controls), #458 (JSX types + CEM), plus standalone issues #489–#494.

**Debug tests:** `debug/tonejs/` contains standalone HTML reproductions of upstream Tone.js bugs. Each file loads Tone.js from CDN with a one-click reproduce button — change the `<script src>` version to test new releases. See `debug/tonejs/README.md`.

**Debug apps:** `debug/standalone-midi/` is a standalone Vite+React app using workspace components (not Docusaurus) for isolating rendering bugs. Run with `cd debug/standalone-midi && pnpm exec vite`.

**Deployment:** a push to `dev` or to `main` builds both versions of the site and deploys them together (`website/CLAUDE.md`, "Versions of the Site").

---

## References

- **Roadmap & Progress:** `TODO.md`
- **Architecture Details:** `PROJECT_STRUCTURE.md`
- **Default branch, base of every PR:** `dev`
- **Stable line (npm `latest`):** `main`
- **Dev server:** `http://localhost:3000/` (Docusaurus)
- **dawcore uses `@dawcore/transport`** — No Tone.js dependency. Native `AudioContext` for decode, playback, and recording. The `audioContext` property on `<daw-editor>` accepts a consumer-provided context.

---

## Per-Package Documentation

Package-specific conventions, architecture, and patterns live in each package's own CLAUDE.md. For `browser` and `dawcore` that file is an index: the notes are in `packages/<pkg>/notes/<topic>.md`, one file per topic, and the index says which file to read before changing which part (it lists every section title, so "see `packages/browser/CLAUDE.md`, 'X'" still finds X). Read the topic file, not the whole folder.

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

**Last Updated:** 2026-11-15
