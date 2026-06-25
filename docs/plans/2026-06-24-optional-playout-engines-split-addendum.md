# Addendum: `/tone` subpath split — full bundle-level decoupling (#510)

> Extends `docs/plans/2026-06-24-optional-playout-engines.md`. The final whole-branch review found the single tsup barrel still statically references `tone`/`playout` (Tier-3 hooks survive under esbuild; `soundFontSync`'s `isToneAdapter` value import survives under ALL bundlers, breaking criterion 3). This addendum makes the **core barrel structurally free** of `tone`/`playout` (no reliance on tree-shaking) by decoupling two in-graph modules and moving the Tone-coupled surface to a `@waveform-playlist/browser/tone` subpath.

**Tech stack / commands:** same Global Constraints as the parent plan. Tests: `cd packages/browser && npx vitest run`. Build: `pnpm --filter @waveform-playlist/browser build`. Real bundler binaries for manual checks: `node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild`, `node_modules/.pnpm/rollup@4.61.1/node_modules/rollup/dist/bin/rollup`. NO `Co-Authored-By` footer.

**Decided design (user-approved):**
- New subpath export `@waveform-playlist/browser/tone` holds all Tone/playout-coupled exports.
- Core barrel `@waveform-playlist/browser` = engine-agnostic: providers (adapter-injected), visualization, transport/control components, neutral hooks, modifiers — zero static `tone`/`playout`.
- `useAudioTracks`/`useDynamicTracks` move to `/tone` (their only coupling is the decode AudioContext; they're Tone-path loaders).
- `soundFontSync` + `useAnnotationDragHandlers` are decoupled (they're in the core provider/component graph and can't move).

---

## Task 10: Decouple `soundFontSync.ts`

**Files:** Modify `packages/browser/src/soundFontSync.ts`; Modify `packages/browser/src/__tests__/staticEngineImports.test.ts` (add file to FILES)

- [ ] **Step 1:** Append `'soundFontSync.ts'` to the `FILES` array in `staticEngineImports.test.ts`. Run `cd packages/browser && npx vitest run src/__tests__/staticEngineImports.test.ts` → FAIL (RED: `soundFontSync.ts:2` value-imports `isToneAdapter` from playout).

- [ ] **Step 2:** Replace the entire contents of `packages/browser/src/soundFontSync.ts` with:

```ts
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { SoundFontCache } from '@waveform-playlist/playout';

/** Adapters that accept a SoundFontCache (e.g. the Tone.js adapter). */
interface SoundFontCapableAdapter {
  setSoundFontCache(cache: SoundFontCache | undefined): void;
}

/**
 * Structural check for soundfont support — avoids a runtime import of
 * `@waveform-playlist/playout` (its `isToneAdapter` is exactly this check,
 * `typeof adapter.setSoundFontCache === 'function'`). Keeping it structural
 * lets the core barrel stay engine-free (#510) and works for any custom
 * adapter that exposes `setSoundFontCache`.
 */
function supportsSoundFont(
  adapter: PlayoutAdapter | null
): adapter is PlayoutAdapter & SoundFontCapableAdapter {
  return (
    adapter != null &&
    typeof (adapter as Partial<SoundFontCapableAdapter>).setSoundFontCache === 'function'
  );
}

/**
 * Forward a (possibly late-loaded or swapped) SoundFontCache to the live
 * adapter. Safe no-op when the adapter is absent or doesn't support
 * soundfonts. The adapter itself skips MIDI tracks whose routing is
 * unchanged, so redundant calls (e.g. on mount) cause no rebuild churn.
 */
export function syncSoundFontCacheToAdapter(
  adapter: PlayoutAdapter | null,
  cache: SoundFontCache | undefined
): void {
  if (!supportsSoundFont(adapter)) return;
  adapter.setSoundFontCache(cache);
}
```

- [ ] **Step 3:** Run the guard test → PASS (GREEN). Run `cd packages/browser && pnpm typecheck` (PASS) and the full suite (`npx vitest run`, incl. `soundFontSync.test.ts` — no regressions).

- [ ] **Step 4:** Commit: `git commit -m "fix(browser): decouple soundFontSync from playout via structural check (#510)"`

---

## Task 11: Decouple `useAnnotationDragHandlers.ts`

**Files:** Modify `packages/browser/src/hooks/useAnnotationDragHandlers.ts`; Modify `staticEngineImports.test.ts` (add `'hooks/useAnnotationDragHandlers.ts'`)

- [ ] **Step 1:** Append `'hooks/useAnnotationDragHandlers.ts'` to the guard `FILES`. Run the guard → FAIL (RED: line 8 imports `getGlobalAudioContext` from playout).

- [ ] **Step 2:** In `useAnnotationDragHandlers.ts`: delete the import line `import { getGlobalAudioContext } from '@waveform-playlist/playout';` (line 8). Change the `sampleRate` default param (line 54) from:

```ts
  sampleRate = getGlobalAudioContext().sampleRate,
```
to:
```ts
  sampleRate = 48000,
```

Add a one-line comment above it: `// Default mirrors the engine default; the providers always pass the real rate from context (#510).`

- [ ] **Step 3:** Run guard → PASS. Run `pnpm typecheck` (PASS) and the full suite (no regressions — the providers pass `sampleRate` explicitly, so the default only affects out-of-provider usage).

- [ ] **Step 4:** Commit: `git commit -m "fix(browser): decouple useAnnotationDragHandlers sampleRate default from playout (#510)"`

---

## Task 12: Create the `@waveform-playlist/browser/tone` subpath + move Tone-coupled exports

**Files:**
- Create: `packages/browser/src/tone.ts`
- Modify: `packages/browser/src/index.tsx` (remove moving exports)
- Modify: `packages/browser/src/hooks/index.ts` (remove moving hook exports)
- Modify: `packages/browser/src/components/index.tsx` (remove `export * from './ExportControls'`)
- Modify: `packages/browser/package.json` (add `./tone` to `exports`)
- Modify: `packages/browser/tsup.config.ts` (add `src/tone.ts` entry)

**Interfaces produced:** `@waveform-playlist/browser/tone` re-exports: `useAudioTracks`, `useMasterAnalyser`, `useDynamicEffects`, `useTrackDynamicEffects`, `useExportWav`, `useDynamicTracks`, `useOutputMeter`, the effects factory/definitions, and `ExportWavButton` (+ their types). These are REMOVED from the core barrel.

- [ ] **Step 1: Create `packages/browser/src/tone.ts`** (import from source modules directly, NOT the barrels, so the core barrels don't reference them):

```ts
// Tone.js batteries-included surface for @waveform-playlist/browser.
// Import from '@waveform-playlist/browser/tone'. Everything here depends on the
// optional peers `tone` and `@waveform-playlist/playout` (#510 — keeps the core
// `@waveform-playlist/browser` entry free of any static tone/playout import).

export { useAudioTracks } from './hooks/useAudioTracks';
export type { AudioTrackConfig } from './hooks/useAudioTracks';

export { useMasterAnalyser } from './hooks/useAudioEffects';

export { useDynamicEffects } from './hooks/useDynamicEffects';
export type { UseDynamicEffectsReturn, ActiveEffect } from './hooks/useDynamicEffects';

export { useTrackDynamicEffects } from './hooks/useTrackDynamicEffects';
export type {
  UseTrackDynamicEffectsReturn,
  TrackActiveEffect,
  TrackEffectsState,
} from './hooks/useTrackDynamicEffects';

export { useExportWav } from './hooks/useExportWav';
export type { ExportOptions, ExportResult, UseExportWavReturn } from './hooks/useExportWav';

export { useDynamicTracks } from './hooks/useDynamicTracks';
export type { TrackSource, TrackLoadError, UseDynamicTracksReturn } from './hooks/useDynamicTracks';

export { useOutputMeter } from './hooks/useOutputMeter';
export type { UseOutputMeterOptions, UseOutputMeterReturn } from './hooks/useOutputMeter';

export {
  effectDefinitions,
  effectCategories,
  getEffectDefinition,
  getEffectsByCategory,
  createEffectInstance,
  createEffectChain,
} from './effects';
export type {
  EffectDefinition,
  EffectParameter,
  ParameterType,
  EffectInstance,
} from './effects';

export { ExportWavButton } from './components/ExportControls';
export type { ExportWavButtonProps } from './components/ExportControls';
```

(If `pnpm typecheck` in Step 6 reports a type name mismatch — e.g. a type lives in a different source module than listed — fix the `from './...'` path to match the real source module; the names above mirror `src/hooks/index.ts`'s existing re-export mapping.)

- [ ] **Step 2: Trim `src/index.tsx`** — remove ONLY these moved symbols (leave every other export intact):
  - From the `export { … } from './hooks'` block: `useAudioTracks`, `useDynamicEffects`, `useTrackDynamicEffects`, `useExportWav`, `useDynamicTracks`, `useOutputMeter`, `useMasterAnalyser`.
  - From the `export type { … } from './hooks'` block: `AudioTrackConfig`, `UseDynamicEffectsReturn`, `ActiveEffect`, `UseTrackDynamicEffectsReturn`, `TrackActiveEffect`, `TrackEffectsState`, `ExportOptions`, `ExportResult`, `UseExportWavReturn`, `TrackSource`, `TrackLoadError`, `UseDynamicTracksReturn`, `UseOutputMeterOptions`, `UseOutputMeterReturn`.
  - The entire effects export block (`effectDefinitions`, `effectCategories`, `getEffectDefinition`, `getEffectsByCategory`, `createEffectInstance`, `createEffectChain`) and its type block (`EffectDefinition`, `EffectParameter`, `ParameterType`, `EffectInstance`).
  - From the `export { … } from './components'` block: `ExportWavButton`. And the line `export type { ExportWavButtonProps } from './components/ExportControls';`.
  - KEEP `export type { EffectsFunction, TrackEffectsFunction } from '@waveform-playlist/playout';` (type-only, erased — fine in core).

- [ ] **Step 3: Trim `src/hooks/index.ts`** — remove the export lines for `useMasterAnalyser`, `useAudioTracks` (+ `AudioTrackConfig`/`UseAudioTracksOptions` types), `useDynamicEffects` (+ types), `useTrackDynamicEffects` (+ types), `useExportWav` (+ types), `useDynamicTracks` (+ types), `useOutputMeter` (+ types). Leave the neutral hooks (`useTimeFormat`, `useZoomControls`, `useMasterVolume`, `useSelectionState`, `useLoopState`, `useSelectedTrack`, `useUndoState`, `useAnimationFrameLoop`, `useWaveformDataCache`, clip/keyboard/annotation hooks, etc.) intact.

- [ ] **Step 4: Trim `src/components/index.tsx`** — remove `export * from './ExportControls';` (so the core components barrel no longer pulls `useExportWav`).

- [ ] **Step 5: `package.json` exports + `tsup.config.ts`.** In `packages/browser/package.json`, replace the `exports` block with:

```json
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./tone": {
      "types": "./dist/tone.d.ts",
      "import": "./dist/tone.mjs",
      "require": "./dist/tone.js"
    }
  },
```

In `packages/browser/tsup.config.ts`, change `entry: ['src/index.tsx'],` to `entry: ['src/index.tsx', 'src/tone.ts'],`.

- [ ] **Step 6: Build + typecheck + structural verify.**
  - `cd packages/browser && pnpm typecheck` (fix any moved-type path mismatches in `tone.ts`).
  - `pnpm --filter @waveform-playlist/browser build` (must emit `dist/index.mjs`, `dist/tone.mjs`, both `.js` + `.d.ts`).
  - Structural check (the decisive one — esbuild does NOT tree-shake side-effectful imports, so this proves the core entry has NO path to tone/playout):
    ```bash
    ESB="$(git rev-parse --show-toplevel)/node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild"
    printf "export * from './dist/index.mjs';\n" > /tmp/core-probe.mjs
    "$ESB" /tmp/core-probe.mjs --bundle --format=esm --platform=browser \
      '--external:tone' '--external:@waveform-playlist/*' '--external:react' '--external:react-dom' \
      '--external:styled-components' '--external:@dnd-kit/*' '--external:waveform-data' '--external:uuid' \
      --tree-shaking=true 2>&1 | grep -nE "from ?\"(tone|@waveform-playlist/playout)\"" \
      && echo "FAIL: core barrel still statically imports tone/playout" || echo "PASS: core barrel engine-free"
    ```
    Run from `packages/browser`. Expected: `PASS`.
  - Full suite: `npx vitest run` (no regressions).

- [ ] **Step 7: Commit:** `git commit -m "feat(browser)!: move Tone-coupled hooks/effects to @waveform-playlist/browser/tone subpath (#510)"`

---

## Task 13: Bundle-level guard test (replaces the source-only guard's blind spot)

**Files:** Create `packages/browser/src/__tests__/coreBarrelEngineFree.test.ts`; Modify `staticEngineImports.test.ts` (add a header comment noting it is a non-transitive single-file guard, superseded for the barrel-level guarantee by the new test).

**Why:** `staticEngineImports.test.ts` scans 6 literal files and missed `soundFontSync`'s transitive edge. This test bundles the **whole core entry** (transitive) and asserts zero static `tone`/`playout`.

- [ ] **Step 1: Write the test** `coreBarrelEngineFree.test.ts`:

```ts
// Issue #510: the CORE entry (@waveform-playlist/browser → src/index.tsx) must
// have NO static (non-type) import of tone / @waveform-playlist/playout anywhere
// in its TRANSITIVE graph, so MediaElement-only and custom-adapter consumers
// never resolve/bundle them under ANY bundler. esbuild does NOT tree-shake
// side-effectful external imports, so a clean esbuild bundle proves structural
// absence (not mere tree-shakeability). Dynamic import() is allowed.
import { describe, it, expect } from 'vitest';
import { build } from 'esbuild';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

async function staticEngineImportsInEntry(entry: string): Promise<string[]> {
  const result = await build({
    entryPoints: [join(pkgRoot, entry)],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'browser',
    treeShaking: true,
    logLevel: 'silent',
    external: [
      'tone',
      '@waveform-playlist/*',
      'react',
      'react-dom',
      'react/jsx-runtime',
      'styled-components',
      '@dnd-kit/*',
      'waveform-data',
      'uuid',
    ],
  });
  const code = result.outputFiles[0].text;
  // Static `… from "tone"` / `… from "@waveform-playlist/playout"`. Dynamic
  // import("…") has no `from` and is not matched.
  const re = /from\s*"(tone|@waveform-playlist\/playout)"/g;
  return [...code.matchAll(re)].map((m) => m[1]);
}

describe('core barrel is engine-free (#510)', () => {
  it('src/index.tsx has no transitive static import of tone / playout', async () => {
    const offenders = await staticEngineImportsInEntry('src/index.tsx');
    expect(offenders).toEqual([]);
  });

  it('src/tone.ts (the Tone subpath) DOES pull tone/playout (sanity — proves the test detects them)', async () => {
    const found = await staticEngineImportsInEntry('src/tone.ts');
    expect(found.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run** `cd packages/browser && npx vitest run src/__tests__/coreBarrelEngineFree.test.ts` → PASS (Task 12 made the core entry engine-free; the `/tone` entry still pulls them).

- [ ] **Step 3:** Add `esbuild` to `packages/browser` devDependencies if the import fails to resolve in the test (`pnpm --filter @waveform-playlist/browser add -D esbuild`; commit the lockfile). It's already present transitively via tsup, but a direct devDep makes the test's import explicit.

- [ ] **Step 4: Add the header note to `staticEngineImports.test.ts`** documenting it is a single-file, non-transitive guard for fast feedback, and that `coreBarrelEngineFree.test.ts` is the authoritative transitive/bundle guard.

- [ ] **Step 5: Commit:** `git commit -m "test(browser): bundle-level guard that core barrel is transitively engine-free (#510)"`

---

## Task 14: Docs + examples migration for `/tone`

**Files:** `packages/browser/CLAUDE.md`, root `README.md`, `website/static/llms.txt`, `website/docs/framework-agnostic/llm-reference.md`, `website/docs/react/api/hooks.md`, the two provider docs under `website/docs/react/api/providers/`, plus any `website/docs/**`/`examples/**` that import the moved symbols from `@waveform-playlist/browser`. Also update `docs/specs/2026-06-24-optional-playout-engines-design.md` scope section.

- [ ] **Step 1: Find every doc/example import of a moved symbol.** Run:
```bash
grep -rn -E "useAudioTracks|useDynamicTracks|useDynamicEffects|useTrackDynamicEffects|useOutputMeter|useExportWav|useMasterAnalyser|ExportWavButton|createEffectInstance|createEffectChain|effectDefinitions|effectCategories|getEffectDefinition|getEffectsByCategory" website docs examples README.md \
  | grep "@waveform-playlist/browser"
```
For each, change the import source from `@waveform-playlist/browser` to `@waveform-playlist/browser/tone`. (Leave non-import prose mentions; only fix import statements. `examples/**/*.html` are out of lint scope — match their existing style by hand.)

- [ ] **Step 2: Update `packages/browser/CLAUDE.md`** — under the existing "Optional Playout Engines (#510)" section, add a subsection:
```markdown
### `/tone` subpath (Tone batteries-included surface)

The core `@waveform-playlist/browser` entry is structurally free of `tone`/`playout`
(verified transitively by `coreBarrelEngineFree.test.ts`). All Tone-coupled exports —
`useAudioTracks`, `useDynamicTracks`, the effects hooks + factory/definitions,
`useExportWav` + `ExportWavButton`, `useOutputMeter`, `useMasterAnalyser` — live at
`@waveform-playlist/browser/tone`. A MediaElement-only or custom-adapter consumer never
resolves `tone`/`playout` under any bundler. `useAudioTracks`/`useDynamicTracks` moved
here because they decode on the Tone global context.
```

- [ ] **Step 3: Update the v14 migration note** in `README.md` and `CLAUDE.md`: "v14: effects, WAV export, output metering, and the `useAudioTracks`/`useDynamicTracks` loaders import from `@waveform-playlist/browser/tone`." Update `llms.txt` + `llm-reference.md` + `hooks.md` so the moved hooks are documented under the `/tone` entry. Update the design spec's scope/criteria section to record that full bundle-level decoupling is achieved via the `/tone` split.

- [ ] **Step 4: Verify** `pnpm --filter website build` (broken-link checker clean; pre-existing CSS warnings harmless). If any example app imports a moved symbol, confirm it still builds (`pnpm --filter <example> build` where applicable).

- [ ] **Step 5: Commit:** `git commit -m "docs: migrate effects/export/audio-loader imports to @waveform-playlist/browser/tone (#510)"`

---

## Task 15: Trim lockfile churn + final verification

- [ ] **Step 1: Trim the unrelated `@types/react` lockfile churn** (final-review Minor #1). From repo root:
```bash
git checkout 4ddfded7 -- pnpm-lock.yaml
pnpm install
git diff --stat pnpm-lock.yaml
```
Inspect the diff: it should now reflect ONLY the engines peer-move + the new `esbuild` devDep (Task 13) + the `/tone` entry — no Docusaurus/Algolia `@types/react` 19→18 churn. If the churn reappears (a workspace package genuinely pins it), leave it and note in the PR that it's pre-existing drift. Commit only if the lockfile changed: `git commit -m "chore: trim unrelated @types/react lockfile churn (#510)"`.

- [ ] **Step 2: Full verification (repeat parent plan Task 9 with the new structure):**
  - `cd packages/browser && pnpm typecheck` → PASS
  - `pnpm -w lint` → 0 errors
  - `pnpm --filter @waveform-playlist/browser build` → PASS (emits `index.*` + `tone.*`)
  - `cd packages/browser && npx vitest run` → all PASS (incl. `coreBarrelEngineFree.test.ts`)
  - Empirical acceptance (real binaries, both bundlers), run from `packages/browser`:
    ```bash
    ESB="$(git rev-parse --show-toplevel)/node_modules/.pnpm/esbuild@0.27.7/node_modules/esbuild/bin/esbuild"
    # ME-only, RESOLVE tone/playout (real app bundling) — must NOT bundle Tone:
    printf "import {MediaElementPlaylistProvider} from './dist/index.mjs'; console.log(MediaElementPlaylistProvider);\n" > /tmp/me.mjs
    "$ESB" /tmp/me.mjs --bundle --format=esm --platform=browser '--external:react' '--external:react-dom' '--external:styled-components' '--external:@dnd-kit/*' --outfile=/tmp/me.out.mjs 2>&1 | tail -2
    echo "Tone in ME-only bundle: $(grep -cE 'ToneAudioNode|StateTimeline' /tmp/me.out.mjs) (expect 0)"
    # WA-only (custom-adapter path), RESOLVE — must NOT bundle Tone/isToneAdapter:
    printf "import {WaveformPlaylistProvider} from './dist/index.mjs'; console.log(WaveformPlaylistProvider);\n" > /tmp/wa.mjs
    "$ESB" /tmp/wa.mjs --bundle --format=esm --platform=browser '--external:react' '--external:react-dom' '--external:styled-components' '--external:@dnd-kit/*' --outfile=/tmp/wa.out.mjs 2>&1 | tail -2
    echo "Tone in WA-only bundle: $(grep -cE 'ToneAudioNode|StateTimeline' /tmp/wa.out.mjs) (expect 0) | isToneAdapter: $(grep -c isToneAdapter /tmp/wa.out.mjs) (expect 0)"
    ```
    Expected: ME-only Tone=0, WA-only Tone=0 and isToneAdapter=0. This proves criteria 2 & 3 for esbuild (and therefore Rollup, which is stricter).

- [ ] **Step 3:** No commit (verification only). Report results.

---

## Pre-PR cleanup (unchanged from parent plan)

`git rm` the spec + both plan docs before the PR merges; open the follow-up issue noted in the parent plan; audit peer ranges on packages depending on `@waveform-playlist/browser` before publish (publishing out of scope).
