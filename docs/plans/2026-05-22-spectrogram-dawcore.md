# Spectrogram render-mode for dawcore — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `render-mode="spectrogram"` to `<daw-track>` in `@dawcore/components`, backed by a new framework-agnostic `@dawcore/spectrogram` package that contains the FFT computation, worker, and viewport-aware rendering orchestrator — shared between the dawcore Lit element and the existing React `SpectrogramProvider`.

**Architecture:** Three-package refactor. `@dawcore/spectrogram` (new, 0.0.1) holds computation + worker + a framework-agnostic `SpectrogramOrchestrator` class. `@waveform-playlist/spectrogram` (slimmed) keeps the React Provider + UI components, now wrapping the orchestrator. `@dawcore/components` adds `<daw-spectrogram>` + `SpectrogramController` and wires the editor's render-template branch. `@waveform-playlist/browser` is unchanged. The orchestrator's ~900 LOC of viewport/abort/3-tier/grouping logic lives in exactly one place.

**Tech Stack:** Lit 3, TypeScript, vitest + happy-dom (dawcore + dawcore-spectrogram), React + vitest (slim spectrogram), Playwright (e2e), tsup, pnpm workspaces, `@waveform-playlist/core` (for `SpectrogramConfig` type), `fft.js`.

**Spec:** [`docs/specs/2026-05-22-spectrogram-dawcore-design.md`](../specs/2026-05-22-spectrogram-dawcore-design.md)

**Branch:** `spectrogram-dawcore-and-react-extract`

---

## File Structure

**Created — `@dawcore/spectrogram` package (new, version `0.0.1`):**

- `packages/dawcore-spectrogram/package.json`
- `packages/dawcore-spectrogram/tsconfig.json`
- `packages/dawcore-spectrogram/tsup.config.ts`
- `packages/dawcore-spectrogram/vitest.config.ts`
- `packages/dawcore-spectrogram/README.md` (stub)
- `packages/dawcore-spectrogram/src/index.ts`
- `packages/dawcore-spectrogram/src/orchestrator/index.ts`
- `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts`
- `packages/dawcore-spectrogram/src/orchestrator/viewport-classify.ts`
- `packages/dawcore-spectrogram/src/orchestrator/chunk-grouping.ts`
- `packages/dawcore-spectrogram/src/orchestrator/color-lut-cache.ts`
- `packages/dawcore-spectrogram/src/orchestrator/events.ts`
- `packages/dawcore-spectrogram/__tests__/orchestrator.test.ts`
- `packages/dawcore-spectrogram/__tests__/viewport-classify.test.ts`
- `packages/dawcore-spectrogram/__tests__/chunk-grouping.test.ts`
- `packages/dawcore-spectrogram/__tests__/color-lut-cache.test.ts`

**Moved — from `@waveform-playlist/spectrogram` into `@dawcore/spectrogram`:**

- `src/computation/` → `packages/dawcore-spectrogram/src/computation/` (all 6 files unchanged)
- `src/worker/` → `packages/dawcore-spectrogram/src/worker/` (all 4 files unchanged)
- `src/types/fft.js.d.ts` → `packages/dawcore-spectrogram/src/types/fft.js.d.ts`
- 6 test files from `packages/spectrogram/__tests__/` → `packages/dawcore-spectrogram/__tests__/`

**Modified — `@waveform-playlist/spectrogram` (version bump 12.0.0 → 12.1.0):**

- `packages/spectrogram/package.json` — remove `fft.js` dep, add `@dawcore/spectrogram: workspace:*` dep, bump version
- `packages/spectrogram/src/index.ts` — re-export computation + worker primitives from `@dawcore/spectrogram` for backwards compat; keep React Provider/components exports
- `packages/spectrogram/src/SpectrogramProvider.tsx` — rework from 905 LOC inline orchestration → ~200 LOC React glue wrapping `SpectrogramOrchestrator`

**Created — new test in `@waveform-playlist/spectrogram`:**

- `packages/spectrogram/__tests__/SpectrogramProvider.test.tsx` — Provider→Orchestrator boundary tests

**Created — `@dawcore/components`:**

- `packages/dawcore/src/elements/daw-spectrogram.ts` — new Lit element (Shadow DOM, chunked canvases)
- `packages/dawcore/src/controllers/spectrogram-controller.ts` — new Lit reactive controller
- `packages/dawcore/src/__tests__/daw-spectrogram.test.ts` — new
- `packages/dawcore/src/__tests__/spectrogram-controller.test.ts` — new

**Modified — `@dawcore/components`:**

- `packages/dawcore/package.json` — add `@dawcore/spectrogram: workspace:*` dep
- `packages/dawcore/src/types.ts` — extend `TrackRenderMode`; add `spectrogramConfig` to descriptors
- `packages/dawcore/src/index.ts` — export `DawSpectrogramElement`, `SpectrogramController`
- `packages/dawcore/src/elements/daw-track.ts` — add `spectrogramConfig` JS property
- `packages/dawcore/src/elements/daw-editor.ts` — render-template branch for spectrogram mode, `spectrogramConfig` property, `_ensureSpectrogramController()`, audio data plumbing
- `packages/dawcore/src/events.ts` — add `daw-spectrogram-ready` to `DawEventMap`

**Created — examples:**

- `examples/dawcore-native/spectrogram.html`
- `examples/dawcore-tone/spectrogram.html`
- `e2e/dawcore-spectrogram.spec.ts`

**Not touched:**

- `packages/browser/**` — React playlist library; no changes (Provider still imports from `@waveform-playlist/spectrogram`)
- `website/src/components/examples/MirSpectrogramExample.tsx` — import path unchanged
- `packages/core` — `SpectrogramConfig` type already lives here, unchanged

---

## Conventions for All Tasks

- **Run typecheck per-package**, not at root: `cd packages/<pkg> && pnpm typecheck` (root `pnpm typecheck` fails on the unrelated browser package per `feedback_dawcore_typecheck.md`).
- **Run lint from repo root**: `pnpm lint` (root-only script).
- **Run unit tests per-package**: `cd packages/<pkg> && npx vitest run` (or target one file).
- **Run E2E from repo root**: `pnpm -w run test e2e/dawcore-spectrogram.spec.ts`.
- **Git commands from repo root** (per `feedback_git_from_root.md`): `git add packages/dawcore-spectrogram/...` not from inside the package dir.
- **One commit per task** unless a task says otherwise. Use conventional-commits prefix (`feat:`, `test:`, `refactor:`, `chore:`).
- **No commit before user testing/approval** (per `feedback_no_commit_before_testing.md`). Each task ends with a commit step but the user reviews the diff first; ask before committing if uncertain.
- **`pnpm install` after every new package or dependency change** — commit `pnpm-lock.yaml` along with the change (CI uses `--frozen-lockfile`).
- **Build before downstream typecheck:** when an upstream package's source types change, run `pnpm --filter <upstream> build` before downstream `pnpm typecheck` (workspace packages resolve via `dist/`, not source).
- **In tests, prefer `replaceChildren()` over `innerHTML = ''`** to clear DOM — the project's lint/security hooks flag `innerHTML` writes.
- **Hold off committing if a step fails** — fix root cause before moving on.
- **No console.log in production code** — use `console.warn('[dawcore-spectrogram] ...')` with string concatenation (per `MEMORY.md` "Debugging: String-Only console.log").

---

## Task 1: Scaffold `@dawcore/spectrogram` package

**Files:**

- Create: `packages/dawcore-spectrogram/package.json`
- Create: `packages/dawcore-spectrogram/tsconfig.json`
- Create: `packages/dawcore-spectrogram/tsup.config.ts`
- Create: `packages/dawcore-spectrogram/vitest.config.ts`
- Create: `packages/dawcore-spectrogram/README.md`
- Create: `packages/dawcore-spectrogram/src/index.ts`

- [ ] **Step 1: Create package.json**

Write `packages/dawcore-spectrogram/package.json`:

```json
{
  "name": "@dawcore/spectrogram",
  "version": "0.0.1",
  "description": "Spectrogram computation, worker, and viewport orchestrator — framework-agnostic",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./worker/spectrogram.worker": {
      "import": "./dist/worker/spectrogram.worker.mjs"
    },
    "./orchestrator": {
      "types": "./dist/orchestrator/index.d.ts",
      "import": "./dist/orchestrator/index.mjs"
    }
  },
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "keywords": ["spectrogram", "fft", "dawcore", "web-audio"],
  "author": "Naomi Aro",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/naomiaro/waveform-playlist.git",
    "directory": "packages/dawcore-spectrogram"
  },
  "homepage": "https://naomiaro.github.io/waveform-playlist",
  "bugs": {
    "url": "https://github.com/naomiaro/waveform-playlist/issues"
  },
  "files": ["dist", "README.md"],
  "dependencies": {
    "@waveform-playlist/core": "workspace:*",
    "fft.js": "^4.0.4"
  },
  "devDependencies": {
    "tsup": "^8.0.1",
    "typescript": "^5.3.3",
    "vitest": "^3.0.0",
    "happy-dom": "^17.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

Write `packages/dawcore-spectrogram/tsconfig.json` (mirror `packages/spectrogram/tsconfig.json`):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM", "WebWorker"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "__tests__/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create tsup.config.ts**

Write `packages/dawcore-spectrogram/tsup.config.ts`:

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/worker/spectrogram.worker.ts',
    'src/orchestrator/index.ts',
  ],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  splitting: false,
});
```

- [ ] **Step 4: Create vitest.config.ts**

Write `packages/dawcore-spectrogram/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
  },
});
```

- [ ] **Step 5: Create stub index.ts and README.md**

Write `packages/dawcore-spectrogram/src/index.ts`:

```typescript
export {};
```

Write `packages/dawcore-spectrogram/README.md`:

```markdown
# @dawcore/spectrogram

Framework-agnostic spectrogram computation, worker, and viewport-aware rendering orchestrator for the dawcore family.

Used by `@dawcore/components` (the Lit web component layer) and `@waveform-playlist/spectrogram` (the React Provider).

## Exports

- `computeSpectrogram`, `getColorMap`, `getFrequencyScale` — pure computation
- `createSpectrogramWorker`, `createSpectrogramWorkerPool` — worker factories
- `SpectrogramOrchestrator` (via `./orchestrator` subpath) — viewport/abort/tier/grouping logic

## License

MIT
```

- [ ] **Step 6: Run pnpm install + verify package resolves**

```bash
pnpm install
```

Verify:

```bash
node -e "console.log(require.resolve('@dawcore/spectrogram/package.json'))"
```

Expected: path ends in `packages/dawcore-spectrogram/package.json`.

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore-spectrogram pnpm-lock.yaml
git commit -m "feat(dawcore-spectrogram): scaffold new package at 0.0.1"
```

---

## Task 2: Move computation + worker + types into `@dawcore/spectrogram`

Pure file relocation with import-path updates. No logic changes.

**Files:**

- Move: `packages/spectrogram/src/computation/**` → `packages/dawcore-spectrogram/src/computation/**`
- Move: `packages/spectrogram/src/worker/**` → `packages/dawcore-spectrogram/src/worker/**`
- Move: `packages/spectrogram/src/types/fft.js.d.ts` → `packages/dawcore-spectrogram/src/types/fft.js.d.ts`
- Move: 6 test files from `packages/spectrogram/__tests__/` → `packages/dawcore-spectrogram/__tests__/`
- Modify: `packages/dawcore-spectrogram/src/index.ts` — export computation + worker

- [ ] **Step 1: Move source files**

```bash
mkdir -p packages/dawcore-spectrogram/src/types
git mv packages/spectrogram/src/computation packages/dawcore-spectrogram/src/computation
git mv packages/spectrogram/src/worker packages/dawcore-spectrogram/src/worker
git mv packages/spectrogram/src/types/fft.js.d.ts packages/dawcore-spectrogram/src/types/fft.js.d.ts
rmdir packages/spectrogram/src/types
```

- [ ] **Step 2: Move test files**

```bash
git mv packages/spectrogram/__tests__/colorMaps.test.ts packages/dawcore-spectrogram/__tests__/colorMaps.test.ts
git mv packages/spectrogram/__tests__/fft.test.ts packages/dawcore-spectrogram/__tests__/fft.test.ts
git mv packages/spectrogram/__tests__/frequencyScales.test.ts packages/dawcore-spectrogram/__tests__/frequencyScales.test.ts
git mv packages/spectrogram/__tests__/windowFunctions.test.ts packages/dawcore-spectrogram/__tests__/windowFunctions.test.ts
git mv packages/spectrogram/__tests__/createSpectrogramWorker.test.ts packages/dawcore-spectrogram/__tests__/createSpectrogramWorker.test.ts
git mv packages/spectrogram/__tests__/createSpectrogramWorkerPool.test.ts packages/dawcore-spectrogram/__tests__/createSpectrogramWorkerPool.test.ts
```

- [ ] **Step 3: Update `@dawcore/spectrogram` src/index.ts**

Replace `packages/dawcore-spectrogram/src/index.ts` with:

```typescript
// Computation
export {
  computeSpectrogram,
  computeSpectrogramMono,
  getColorMap,
  getFrequencyScale,
} from './computation';
export type { FrequencyScaleName } from './computation';

// Worker
export { createSpectrogramWorker, SpectrogramAbortError } from './worker';
export { createSpectrogramWorkerPool } from './worker';
export type {
  SpectrogramWorkerApi,
  SpectrogramWorkerFFTParams,
  SpectrogramWorkerRenderChunksParams,
} from './worker';
```

(Orchestrator exports added in later tasks.)

- [ ] **Step 4: Verify moved imports still resolve internally**

The moved files import each other via relative paths (e.g., `'../computation/fft'`). Those paths are preserved by the move. Verify with:

```bash
cd packages/dawcore-spectrogram && pnpm typecheck
```

Expected: PASS, no errors.

- [ ] **Step 5: Run the migrated tests at their new location**

```bash
cd packages/dawcore-spectrogram && npx vitest run
```

Expected: all 6 test files pass (colorMaps, fft, frequencyScales, windowFunctions, createSpectrogramWorker, createSpectrogramWorkerPool).

- [ ] **Step 6: Verify old package no longer has these files**

```bash
ls packages/spectrogram/src/
```

Expected: only `index.ts`, `SpectrogramProvider.tsx`, `components/`, `styled.d.ts` remain. No `computation/`, `worker/`, `types/`.

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore-spectrogram packages/spectrogram
git commit -m "refactor(spectrogram): move computation + worker into @dawcore/spectrogram"
```

---

## Task 3: Slim `@waveform-playlist/spectrogram` with backwards-compat re-exports

**Files:**

- Modify: `packages/spectrogram/package.json` — version bump, dep swap
- Modify: `packages/spectrogram/src/index.ts` — re-export from `@dawcore/spectrogram`
- Modify: `packages/spectrogram/src/SpectrogramProvider.tsx` — update internal import paths (still uses inline orchestration for now; rework happens in Task 10)

- [ ] **Step 1: Update `packages/spectrogram/package.json`**

Bump version, swap `fft.js` for `@dawcore/spectrogram`:

```json
{
  "name": "@waveform-playlist/spectrogram",
  "version": "12.1.0",
  ...
  "dependencies": {
    "@waveform-playlist/core": "workspace:*",
    "@dawcore/spectrogram": "workspace:*"
  }
}
```

Remove `"fft.js": "^4.0.4"` from dependencies (now lives in `@dawcore/spectrogram`).

- [ ] **Step 2: Rewrite `packages/spectrogram/src/index.ts`**

```typescript
// Re-exports from @dawcore/spectrogram for backwards compatibility.
// New code should import from @dawcore/spectrogram directly.
/** @deprecated Import from @dawcore/spectrogram instead. */
export {
  computeSpectrogram,
  computeSpectrogramMono,
  getColorMap,
  getFrequencyScale,
} from '@dawcore/spectrogram';
/** @deprecated Import from @dawcore/spectrogram instead. */
export type { FrequencyScaleName } from '@dawcore/spectrogram';

/** @deprecated Import from @dawcore/spectrogram instead. */
export { createSpectrogramWorker, SpectrogramAbortError } from '@dawcore/spectrogram';
/** @deprecated Import from @dawcore/spectrogram instead. */
export { createSpectrogramWorkerPool } from '@dawcore/spectrogram';
/** @deprecated Import from @dawcore/spectrogram instead. */
export type { SpectrogramWorkerApi } from '@dawcore/spectrogram';

// React surface — stays here
export { SpectrogramMenuItems } from './components';
export type { SpectrogramMenuItemsProps } from './components';
export { SpectrogramSettingsModal } from './components';
export type { SpectrogramSettingsModalProps } from './components';
export type { TrackMenuItem } from './components';

export { SpectrogramProvider } from './SpectrogramProvider';
export type { SpectrogramProviderProps } from './SpectrogramProvider';
```

- [ ] **Step 3: Update SpectrogramProvider.tsx import paths**

Find every `from './computation'`, `from './computation/*'`, `from './worker'`, `from './worker/*'` in `packages/spectrogram/src/SpectrogramProvider.tsx` and replace with `from '@dawcore/spectrogram'`:

```bash
grep -n "from './computation\|from './worker" packages/spectrogram/src/SpectrogramProvider.tsx
```

For each match, change the source path:

```typescript
// Before:
import { computeSpectrogram, getColorMap } from './computation';
import { createSpectrogramWorkerPool, SpectrogramAbortError } from './worker';

// After:
import {
  computeSpectrogram,
  getColorMap,
  createSpectrogramWorkerPool,
  SpectrogramAbortError,
} from '@dawcore/spectrogram';
```

- [ ] **Step 4: Update SpectrogramSettingsModal.tsx + SpectrogramMenuItems.tsx if they import computation**

```bash
grep -rn "from '\\.\\./computation\\|from '\\.\\./worker" packages/spectrogram/src/components/
```

If any matches, redirect to `@dawcore/spectrogram` same as Step 3.

- [ ] **Step 5: Run pnpm install (lockfile pickup)**

```bash
pnpm install
```

- [ ] **Step 6: Build @dawcore/spectrogram so downstream sees types**

```bash
pnpm --filter @dawcore/spectrogram build
```

Expected: PASS — produces `dist/index.{js,mjs,d.ts}`, `dist/worker/spectrogram.worker.mjs`, `dist/orchestrator/index.*` (orchestrator entry is empty for now but builds).

- [ ] **Step 7: Typecheck slim spectrogram package**

```bash
cd packages/spectrogram && pnpm typecheck
```

Expected: PASS — Provider imports resolve from the new package.

- [ ] **Step 8: Run @waveform-playlist/spectrogram tests**

```bash
cd packages/spectrogram && npx vitest run
```

Expected: no test files matched (all 6 moved in Task 2). No failures. Vitest exits 0 or with "No test files found" — acceptable. Provider tests added in Task 10.

- [ ] **Step 9: Verify MIR docs example still type-checks**

```bash
pnpm --filter website typecheck 2>&1 | grep -i "MirSpectrogramExample" || echo "no errors"
```

Expected: no errors specific to `MirSpectrogramExample.tsx`.

- [ ] **Step 10: Commit**

```bash
git add packages/spectrogram pnpm-lock.yaml
git commit -m "refactor(spectrogram): re-export computation/worker from @dawcore/spectrogram"
```

---

## Task 4: Pure function — `viewport-classify.ts` (3-tier classification)

**Files:**

- Create: `packages/dawcore-spectrogram/src/orchestrator/viewport-classify.ts`
- Create: `packages/dawcore-spectrogram/__tests__/viewport-classify.test.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/dawcore-spectrogram/__tests__/viewport-classify.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { classifyViewport } from '../src/orchestrator/viewport-classify';
import type { CanvasMeta } from '../src/orchestrator/viewport-classify';

const mk = (id: string, globalPixelOffset: number, widthPx: number): CanvasMeta => ({
  canvasId: id,
  globalPixelOffset,
  widthPx,
});

describe('classifyViewport', () => {
  it('returns empty tiers when no canvases', () => {
    const out = classifyViewport([], { visibleStartPx: 0, visibleEndPx: 100, bufferStartPx: 0, bufferEndPx: 100 });
    expect(out.viewport).toEqual([]);
    expect(out.buffer).toEqual([]);
    expect(out.remaining).toEqual([]);
  });

  it('classifies a canvas fully inside viewport as viewport-tier', () => {
    const c = mk('c1', 100, 200);  // spans [100..300]
    const out = classifyViewport([c], { visibleStartPx: 50, visibleEndPx: 400, bufferStartPx: 0, bufferEndPx: 500 });
    expect(out.viewport).toEqual([c]);
    expect(out.buffer).toEqual([]);
    expect(out.remaining).toEqual([]);
  });

  it('classifies a canvas intersecting only the buffer as buffer-tier', () => {
    const c = mk('c1', 500, 100);  // spans [500..600]
    const out = classifyViewport([c], { visibleStartPx: 0, visibleEndPx: 400, bufferStartPx: 0, bufferEndPx: 700 });
    expect(out.viewport).toEqual([]);
    expect(out.buffer).toEqual([c]);
    expect(out.remaining).toEqual([]);
  });

  it('classifies a canvas outside the buffer band as remaining', () => {
    const c = mk('c1', 1000, 100);  // spans [1000..1100]
    const out = classifyViewport([c], { visibleStartPx: 0, visibleEndPx: 400, bufferStartPx: 0, bufferEndPx: 700 });
    expect(out.viewport).toEqual([]);
    expect(out.buffer).toEqual([]);
    expect(out.remaining).toEqual([c]);
  });

  it('viewport intersection wins over buffer when canvas straddles both', () => {
    const c = mk('c1', 350, 100);  // spans [350..450], visible is [0..400], buffer is [0..700]
    const out = classifyViewport([c], { visibleStartPx: 0, visibleEndPx: 400, bufferStartPx: 0, bufferEndPx: 700 });
    expect(out.viewport).toEqual([c]);
    expect(out.buffer).toEqual([]);
    expect(out.remaining).toEqual([]);
  });

  it('partitions a mixed canvas list across all three tiers', () => {
    const a = mk('a', 100, 100);   // viewport
    const b = mk('b', 500, 100);   // buffer
    const c = mk('c', 1500, 100);  // remaining
    const out = classifyViewport([a, b, c], { visibleStartPx: 0, visibleEndPx: 400, bufferStartPx: 0, bufferEndPx: 700 });
    expect(out.viewport).toEqual([a]);
    expect(out.buffer).toEqual([b]);
    expect(out.remaining).toEqual([c]);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/viewport-classify.test.ts
```

Expected: FAIL with "Cannot find module" or "classifyViewport is not defined".

- [ ] **Step 3: Implement minimal `viewport-classify.ts`**

Write `packages/dawcore-spectrogram/src/orchestrator/viewport-classify.ts`:

```typescript
export interface CanvasMeta {
  canvasId: string;
  globalPixelOffset: number;
  widthPx: number;
}

export interface ViewportBounds {
  visibleStartPx: number;
  visibleEndPx: number;
  bufferStartPx: number;
  bufferEndPx: number;
}

export interface ClassifiedTiers<T extends CanvasMeta> {
  viewport: T[];
  buffer: T[];
  remaining: T[];
}

function intersects(a0: number, a1: number, b0: number, b1: number): boolean {
  return a1 > b0 && a0 < b1;
}

export function classifyViewport<T extends CanvasMeta>(
  canvases: T[],
  bounds: ViewportBounds
): ClassifiedTiers<T> {
  const viewport: T[] = [];
  const buffer: T[] = [];
  const remaining: T[] = [];

  for (const c of canvases) {
    const start = c.globalPixelOffset;
    const end = c.globalPixelOffset + c.widthPx;

    if (intersects(start, end, bounds.visibleStartPx, bounds.visibleEndPx)) {
      viewport.push(c);
    } else if (intersects(start, end, bounds.bufferStartPx, bounds.bufferEndPx)) {
      buffer.push(c);
    } else {
      remaining.push(c);
    }
  }

  return { viewport, buffer, remaining };
}
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/viewport-classify.test.ts
```

Expected: 6 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore-spectrogram/src/orchestrator/viewport-classify.ts packages/dawcore-spectrogram/__tests__/viewport-classify.test.ts
git commit -m "feat(dawcore-spectrogram): add viewport-classify pure function"
```

---

## Task 5: Pure function — `chunk-grouping.ts` (contiguous chunk grouping)

**Files:**

- Create: `packages/dawcore-spectrogram/src/orchestrator/chunk-grouping.ts`
- Create: `packages/dawcore-spectrogram/__tests__/chunk-grouping.test.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/dawcore-spectrogram/__tests__/chunk-grouping.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { groupContiguousChunks } from '../src/orchestrator/chunk-grouping';

describe('groupContiguousChunks', () => {
  it('returns empty for empty input', () => {
    expect(groupContiguousChunks([])).toEqual([]);
  });

  it('returns a single group for a single chunk', () => {
    expect(groupContiguousChunks([{ chunkIndex: 5 }])).toEqual([[{ chunkIndex: 5 }]]);
  });

  it('groups contiguous chunks together', () => {
    const input = [
      { chunkIndex: 10 },
      { chunkIndex: 11 },
      { chunkIndex: 12 },
    ];
    expect(groupContiguousChunks(input)).toEqual([input]);
  });

  it('splits non-contiguous chunks into separate groups', () => {
    const a = { chunkIndex: 10 };
    const b = { chunkIndex: 14 };
    const c = { chunkIndex: 15 };
    const d = { chunkIndex: 20 };
    expect(groupContiguousChunks([a, b, c, d])).toEqual([[a], [b, c], [d]]);
  });

  it('handles unsorted input by sorting before grouping (regression: indices=[0,3,4,5] yields chunks=[10,14,15,11])', () => {
    const chunks = [
      { chunkIndex: 10 },
      { chunkIndex: 14 },
      { chunkIndex: 15 },
      { chunkIndex: 11 },
    ];
    const groups = groupContiguousChunks(chunks);
    expect(groups).toHaveLength(2);
    expect(groups[0].map((c) => c.chunkIndex)).toEqual([10, 11]);
    expect(groups[1].map((c) => c.chunkIndex)).toEqual([14, 15]);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/chunk-grouping.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `chunk-grouping.ts`**

Write `packages/dawcore-spectrogram/src/orchestrator/chunk-grouping.ts`:

```typescript
export interface ChunkLike {
  chunkIndex: number;
}

/**
 * Group a list of chunks into runs of contiguous chunk indices.
 *
 * Sorts input first (input may be non-monotonic from viewport classification).
 * Returns groups in ascending chunk-index order.
 *
 * Without this, computing FFT for chunks [10, 14, 15, 11] would compute a
 * single FFT spanning chunks 10–15 (~96K frames / 4.5s of audio) instead of
 * two smaller FFTs (10–11, 14–15) totaling ~32K frames.
 */
export function groupContiguousChunks<T extends ChunkLike>(chunks: T[]): T[][] {
  if (chunks.length === 0) return [];

  const sorted = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const groups: T[][] = [];
  let current: T[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1].chunkIndex;
    const curr = sorted[i].chunkIndex;
    if (curr === prev + 1) {
      current.push(sorted[i]);
    } else {
      groups.push(current);
      current = [sorted[i]];
    }
  }
  groups.push(current);
  return groups;
}
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/chunk-grouping.test.ts
```

Expected: 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore-spectrogram/src/orchestrator/chunk-grouping.ts packages/dawcore-spectrogram/__tests__/chunk-grouping.test.ts
git commit -m "feat(dawcore-spectrogram): add chunk-grouping pure function"
```

---

## Task 6: Color LUT cache

**Files:**

- Create: `packages/dawcore-spectrogram/src/orchestrator/color-lut-cache.ts`
- Create: `packages/dawcore-spectrogram/__tests__/color-lut-cache.test.ts`

- [ ] **Step 1: Write failing tests**

Write `packages/dawcore-spectrogram/__tests__/color-lut-cache.test.ts`:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { ColorLUTCache } from '../src/orchestrator/color-lut-cache';

describe('ColorLUTCache', () => {
  let cache: ColorLUTCache;
  beforeEach(() => { cache = new ColorLUTCache(); });

  it('returns a Uint8Array LUT for a known color map name', () => {
    const lut = cache.get('viridis');
    expect(lut).toBeInstanceOf(Uint8Array);
    expect(lut.length).toBe(256 * 4);   // 256 RGBA entries
  });

  it('returns the same reference on repeated calls (caching)', () => {
    const a = cache.get('magma');
    const b = cache.get('magma');
    expect(a).toBe(b);
  });

  it('returns different references for different maps', () => {
    expect(cache.get('viridis')).not.toBe(cache.get('magma'));
  });

  it('clear() drops cached entries', () => {
    const a = cache.get('viridis');
    cache.clear();
    const b = cache.get('viridis');
    expect(a).not.toBe(b);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/color-lut-cache.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Implement `color-lut-cache.ts`**

Write `packages/dawcore-spectrogram/src/orchestrator/color-lut-cache.ts`:

```typescript
import { getColorMap } from '../computation';

/**
 * Cache for precomputed color LUTs (Uint8Array of length 1024 = 256 RGBA).
 *
 * Color maps are stable per name. Worst case ~8 entries × 1KB = 8KB total —
 * no eviction needed.
 */
export class ColorLUTCache {
  private cache = new Map<string, Uint8Array>();

  get(colorMapName: string): Uint8Array {
    let lut = this.cache.get(colorMapName);
    if (!lut) {
      lut = getColorMap(colorMapName);
      this.cache.set(colorMapName, lut);
    }
    return lut;
  }

  clear(): void {
    this.cache.clear();
  }
}
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/color-lut-cache.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore-spectrogram/src/orchestrator/color-lut-cache.ts packages/dawcore-spectrogram/__tests__/color-lut-cache.test.ts
git commit -m "feat(dawcore-spectrogram): add color LUT cache"
```

---

## Task 7: `SpectrogramOrchestrator` — class skeleton + clip registration

Lays the class out with constructor + clip lifecycle. Viewport / canvas / rendering come in Tasks 8–9.

**Files:**

- Create: `packages/dawcore-spectrogram/src/orchestrator/events.ts`
- Create: `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts`
- Create: `packages/dawcore-spectrogram/src/orchestrator/index.ts`
- Create: `packages/dawcore-spectrogram/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Inspect existing `createSpectrogramWorkerPool` signature**

```bash
grep -n "export function createSpectrogramWorkerPool\|export const createSpectrogramWorkerPool" packages/dawcore-spectrogram/src/worker/createSpectrogramWorkerPool.ts
```

The orchestrator constructor needs to pass `Worker[]` instances. If the existing pool factory creates workers internally, refactor it before Step 4. The signature this plan assumes:

```typescript
export function createSpectrogramWorkerPool(workers: Worker[]): SpectrogramWorkerApi
```

If different, either (a) refactor `createSpectrogramWorkerPool` to accept `Worker[]`, updating its existing test in `__tests__/createSpectrogramWorkerPool.test.ts` to pass mock workers, or (b) adjust the orchestrator constructor to match the existing signature. Prefer (a) for the workerFactory-from-consumer pattern.

- [ ] **Step 2: Write failing tests for constructor + clip registration**

Write `packages/dawcore-spectrogram/__tests__/orchestrator.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpectrogramOrchestrator } from '../src/orchestrator/SpectrogramOrchestrator';
import type { SpectrogramConfig } from '@waveform-playlist/core';

const defaultConfig: SpectrogramConfig = {
  fftSize: 2048,
  colorMap: 'viridis',
  frequencyScale: 'mel',
};

function makeMockWorker() {
  const worker = {
    postMessage: vi.fn(),
    terminate: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    onmessage: null as ((e: MessageEvent) => void) | null,
    onerror: null as ((e: ErrorEvent) => void) | null,
  };
  return worker as unknown as Worker;
}

describe('SpectrogramOrchestrator — construction', () => {
  it('creates a worker pool via the supplied factory', () => {
    const factory = vi.fn(() => makeMockWorker());
    new SpectrogramOrchestrator({
      workerFactory: factory,
      workerPoolSize: 2,
      config: defaultConfig,
    });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('defaults workerPoolSize to 2 when omitted', () => {
    const factory = vi.fn(() => makeMockWorker());
    new SpectrogramOrchestrator({ workerFactory: factory, config: defaultConfig });
    expect(factory).toHaveBeenCalledTimes(2);
  });

  it('dispose() terminates each worker exactly once', () => {
    const workers: ReturnType<typeof makeMockWorker>[] = [];
    const factory = vi.fn(() => {
      const w = makeMockWorker();
      workers.push(w);
      return w;
    });
    const orch = new SpectrogramOrchestrator({
      workerFactory: factory,
      workerPoolSize: 3,
      config: defaultConfig,
    });
    orch.dispose();
    for (const w of workers) {
      expect(w.terminate).toHaveBeenCalledTimes(1);
    }
  });
});

describe('SpectrogramOrchestrator — clip registration', () => {
  let orch: SpectrogramOrchestrator;
  beforeEach(() => {
    orch = new SpectrogramOrchestrator({
      workerFactory: () => makeMockWorker(),
      workerPoolSize: 2,
      config: defaultConfig,
    });
  });

  it('registerClip stores clip metadata accessible by clipId', () => {
    orch.registerClip({
      clipId: 'c1', trackId: 't1',
      channelData: [new Float32Array(1024), new Float32Array(1024)],
      sampleRate: 44100, durationSamples: 1024, offsetSamples: 0,
    });
    expect(() => orch.unregisterClip('c1')).not.toThrow();
  });

  it('unregisterClip on unknown clipId is a no-op (does not throw)', () => {
    expect(() => orch.unregisterClip('nonexistent')).not.toThrow();
  });
});
```

- [ ] **Step 3: Run test (expect FAIL)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/orchestrator.test.ts
```

Expected: FAIL with "Cannot find module" or constructor errors.

- [ ] **Step 4: Create `events.ts`**

Write `packages/dawcore-spectrogram/src/orchestrator/events.ts`:

```typescript
export interface ViewportReadyDetail {
  trackId: string;
}

export type SpectrogramOrchestratorEventMap = {
  'viewport-ready': CustomEvent<ViewportReadyDetail>;
};
```

- [ ] **Step 5: Create class skeleton `SpectrogramOrchestrator.ts`**

Write `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts`:

```typescript
import type { SpectrogramConfig } from '@waveform-playlist/core';
import { createSpectrogramWorkerPool } from '../worker';
import type { SpectrogramWorkerApi } from '../worker';
import { ColorLUTCache } from './color-lut-cache';

export interface SpectrogramOrchestratorOptions {
  workerFactory: () => Worker;
  workerPoolSize?: number;
  config: SpectrogramConfig;
  devicePixelRatio?: number;
}

export interface ClipRegistration {
  clipId: string;
  trackId: string;
  channelData: Float32Array[];
  sampleRate: number;
  durationSamples: number;
  offsetSamples: number;
}

interface ClipEntry {
  trackId: string;
  channelData: Float32Array[];
  sampleRate: number;
  durationSamples: number;
  offsetSamples: number;
}

export class SpectrogramOrchestrator extends EventTarget {
  private pool: SpectrogramWorkerApi;
  private config: SpectrogramConfig;
  private devicePixelRatio: number;
  private clips = new Map<string, ClipEntry>();
  private colorLUT = new ColorLUTCache();
  private disposed = false;

  constructor(opts: SpectrogramOrchestratorOptions) {
    super();
    const poolSize = opts.workerPoolSize ?? 2;
    const workers: Worker[] = [];
    for (let i = 0; i < poolSize; i++) {
      workers.push(opts.workerFactory());
    }
    this.pool = createSpectrogramWorkerPool(workers);
    this.config = opts.config;
    this.devicePixelRatio = opts.devicePixelRatio ?? (typeof window !== 'undefined' ? window.devicePixelRatio : 1);
  }

  registerClip(reg: ClipRegistration): void {
    if (this.disposed) return;
    this.clips.set(reg.clipId, {
      trackId: reg.trackId,
      channelData: reg.channelData,
      sampleRate: reg.sampleRate,
      durationSamples: reg.durationSamples,
      offsetSamples: reg.offsetSamples,
    });
    this.pool.registerAudioData(reg.clipId, reg.channelData, reg.sampleRate);
  }

  unregisterClip(clipId: string): void {
    if (this.disposed) return;
    if (!this.clips.has(clipId)) return;
    this.clips.delete(clipId);
    this.pool.unregisterAudioData(clipId);
  }

  setConfig(config: SpectrogramConfig): void {
    if (this.disposed) return;
    this.config = config;
  }

  setDevicePixelRatio(dpr: number): void {
    this.devicePixelRatio = dpr;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.clips.clear();
    this.colorLUT.clear();
    this.pool.terminate();
  }
}
```

- [ ] **Step 6: Create `orchestrator/index.ts`**

Write `packages/dawcore-spectrogram/src/orchestrator/index.ts`:

```typescript
export { SpectrogramOrchestrator } from './SpectrogramOrchestrator';
export type {
  SpectrogramOrchestratorOptions,
  ClipRegistration,
} from './SpectrogramOrchestrator';
export type { ViewportReadyDetail } from './events';
export { classifyViewport } from './viewport-classify';
export type { CanvasMeta, ViewportBounds, ClassifiedTiers } from './viewport-classify';
export { groupContiguousChunks } from './chunk-grouping';
export type { ChunkLike } from './chunk-grouping';
export { ColorLUTCache } from './color-lut-cache';
```

- [ ] **Step 7: Update `src/index.ts` to re-export orchestrator**

Append to `packages/dawcore-spectrogram/src/index.ts`:

```typescript
// Orchestrator
export {
  SpectrogramOrchestrator,
  ColorLUTCache,
  classifyViewport,
  groupContiguousChunks,
} from './orchestrator';
export type {
  SpectrogramOrchestratorOptions,
  ClipRegistration,
  ViewportReadyDetail,
  CanvasMeta,
  ViewportBounds,
  ClassifiedTiers,
  ChunkLike,
} from './orchestrator';
```

- [ ] **Step 8: Run tests (expect PASS)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/orchestrator.test.ts
```

Expected: 5 tests pass (3 construction + 2 clip registration).

- [ ] **Step 9: Typecheck**

```bash
cd packages/dawcore-spectrogram && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/dawcore-spectrogram
git commit -m "feat(dawcore-spectrogram): SpectrogramOrchestrator skeleton + clip registration"
```

---

## Task 8: `SpectrogramOrchestrator` — canvas registration + viewport state

**Files:**

- Modify: `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts`
- Modify: `packages/dawcore-spectrogram/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Add failing tests for canvas registration + setViewport**

Append to `packages/dawcore-spectrogram/__tests__/orchestrator.test.ts`:

```typescript
describe('SpectrogramOrchestrator — canvas registration', () => {
  let orch: SpectrogramOrchestrator;
  let mockPool: any;

  function makeMockPool() {
    return {
      registerCanvas: vi.fn(),
      unregisterCanvas: vi.fn(),
      registerAudioData: vi.fn(),
      unregisterAudioData: vi.fn(),
      computeFFT: vi.fn(() => Promise.resolve({ cacheKey: 'key' })),
      renderChunks: vi.fn(() => Promise.resolve()),
      abortGeneration: vi.fn(),
      terminate: vi.fn(),
    };
  }

  beforeEach(() => {
    mockPool = makeMockPool();
    orch = new SpectrogramOrchestrator({
      workerFactory: () => makeMockWorker(),
      workerPoolSize: 2,
      config: defaultConfig,
    });
    (orch as any).pool = mockPool;  // test-only seam
  });

  it('registerCanvas forwards OffscreenCanvas to worker pool', () => {
    const canvas = { width: 100, height: 100 } as unknown as OffscreenCanvas;
    orch.registerCanvas({
      canvasId: 'c1-ch0-chunk0',
      canvas,
      clipId: 'c1', trackId: 't1', channelIndex: 0, chunkIndex: 0,
      globalPixelOffset: 0, widthPx: 1000, heightPx: 100,
    });
    expect(mockPool.registerCanvas).toHaveBeenCalledWith('c1-ch0-chunk0', canvas);
  });

  it('unregisterCanvas forwards to worker pool', () => {
    orch.registerCanvas({
      canvasId: 'c1-ch0-chunk0',
      canvas: {} as OffscreenCanvas,
      clipId: 'c1', trackId: 't1', channelIndex: 0, chunkIndex: 0,
      globalPixelOffset: 0, widthPx: 1000, heightPx: 100,
    });
    orch.unregisterCanvas('c1-ch0-chunk0');
    expect(mockPool.unregisterCanvas).toHaveBeenCalledWith('c1-ch0-chunk0');
  });

  it('setViewport increments generation and aborts previous', () => {
    orch.setViewport({
      visibleStartPx: 0, visibleEndPx: 100, bufferStartPx: 0, bufferEndPx: 100, samplesPerPixel: 1024,
    });
    orch.setViewport({
      visibleStartPx: 100, visibleEndPx: 200, bufferStartPx: 50, bufferEndPx: 250, samplesPerPixel: 1024,
    });
    expect(mockPool.abortGeneration).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/orchestrator.test.ts
```

Expected: 3 new tests fail.

- [ ] **Step 3: Implement canvas registration + viewport state**

Modify `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts`. Add new types near the top:

```typescript
import type { CanvasMeta, ViewportBounds } from './viewport-classify';

export interface CanvasRegistration {
  canvasId: string;
  canvas: OffscreenCanvas;
  clipId: string;
  trackId: string;
  channelIndex: number;
  chunkIndex: number;
  globalPixelOffset: number;
  widthPx: number;
  heightPx: number;
}

export interface ViewportState extends ViewportBounds {
  samplesPerPixel: number;
}

interface CanvasEntry extends CanvasMeta {
  clipId: string;
  trackId: string;
  channelIndex: number;
  chunkIndex: number;
  heightPx: number;
}
```

Inside the class, add private fields:

```typescript
  private canvases = new Map<string, CanvasEntry>();
  private viewport: ViewportState | null = null;
  private generation = 0;
```

Add methods:

```typescript
  registerCanvas(reg: CanvasRegistration): void {
    if (this.disposed) return;
    this.canvases.set(reg.canvasId, {
      canvasId: reg.canvasId,
      globalPixelOffset: reg.globalPixelOffset,
      widthPx: reg.widthPx,
      heightPx: reg.heightPx,
      clipId: reg.clipId,
      trackId: reg.trackId,
      channelIndex: reg.channelIndex,
      chunkIndex: reg.chunkIndex,
    });
    this.pool.registerCanvas(reg.canvasId, reg.canvas);
    if (this.viewport) this.scheduleRender();
  }

  unregisterCanvas(canvasId: string): void {
    if (this.disposed) return;
    if (!this.canvases.has(canvasId)) return;
    this.canvases.delete(canvasId);
    this.pool.unregisterCanvas(canvasId);
  }

  setViewport(state: ViewportState): void {
    if (this.disposed) return;
    const prevGeneration = this.generation;
    this.generation += 1;
    this.pool.abortGeneration(prevGeneration);
    this.viewport = state;
    this.scheduleRender();
  }

  // Stub — real implementation in Task 9
  private scheduleRender(): void {
    // no-op until Task 9
  }
```

Update `orchestrator/index.ts` to export `CanvasRegistration` and `ViewportState`:

```typescript
export type {
  SpectrogramOrchestratorOptions,
  ClipRegistration,
  CanvasRegistration,
  ViewportState,
} from './SpectrogramOrchestrator';
```

- [ ] **Step 4: Run test (expect PASS)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/orchestrator.test.ts
```

Expected: 8 tests pass.

- [ ] **Step 5: Typecheck**

```bash
cd packages/dawcore-spectrogram && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore-spectrogram
git commit -m "feat(dawcore-spectrogram): canvas registration + viewport state on orchestrator"
```

---

## Task 9: `SpectrogramOrchestrator` — 3-tier render + viewport-ready event

Ports orchestration logic from `SpectrogramProvider.tsx` lines ~199–600 into the class. Reference functions in the existing Provider: `getVisibleChunkRange`, `computeFFTForChunks`, `groupContiguousIndices`, `renderChunkSubset`, `renderBackgroundBatches`.

**Files:**

- Modify: `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts`
- Modify: `packages/dawcore-spectrogram/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Add failing tests**

Append to the orchestrator test file:

```typescript
describe('SpectrogramOrchestrator — tier-aware render', () => {
  let orch: SpectrogramOrchestrator;
  let mockPool: any;

  beforeEach(() => {
    mockPool = {
      registerCanvas: vi.fn(),
      unregisterCanvas: vi.fn(),
      registerAudioData: vi.fn(),
      unregisterAudioData: vi.fn(),
      computeFFT: vi.fn(() => Promise.resolve({ cacheKey: 'k' })),
      renderChunks: vi.fn(() => Promise.resolve()),
      abortGeneration: vi.fn(),
      terminate: vi.fn(),
    };
    orch = new SpectrogramOrchestrator({
      workerFactory: () => makeMockWorker(),
      workerPoolSize: 1,
      config: defaultConfig,
    });
    (orch as any).pool = mockPool;

    orch.registerClip({
      clipId: 'c1', trackId: 't1',
      channelData: [new Float32Array(48000)],
      sampleRate: 48000, durationSamples: 48000, offsetSamples: 0,
    });

    for (let i = 0; i < 3; i++) {
      orch.registerCanvas({
        canvasId: 'c1-ch0-chunk' + i,
        canvas: { width: 1000, height: 100 } as unknown as OffscreenCanvas,
        clipId: 'c1', trackId: 't1', channelIndex: 0, chunkIndex: i,
        globalPixelOffset: i * 1000, widthPx: 1000, heightPx: 100,
      });
    }
  });

  it('setViewport renders viewport-tier canvases first', async () => {
    orch.setViewport({
      visibleStartPx: 0, visibleEndPx: 500,
      bufferStartPx: 0, bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 10));
    expect(mockPool.renderChunks).toHaveBeenCalled();
    const firstCall = mockPool.renderChunks.mock.calls[0][0];
    expect(firstCall.canvasIds).toEqual(['c1-ch0-chunk0']);
  });

  it('emits viewport-ready event with trackId after viewport-tier completes', async () => {
    const readyEvents: string[] = [];
    orch.addEventListener('viewport-ready', (e: Event) => {
      readyEvents.push((e as CustomEvent).detail.trackId);
    });
    orch.setViewport({
      visibleStartPx: 0, visibleEndPx: 500,
      bufferStartPx: 0, bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(readyEvents).toContain('t1');
  });

  it('does not emit viewport-ready twice for the same generation', async () => {
    let count = 0;
    orch.addEventListener('viewport-ready', () => { count += 1; });
    orch.setViewport({
      visibleStartPx: 0, visibleEndPx: 500,
      bufferStartPx: 0, bufferEndPx: 1500,
      samplesPerPixel: 1024,
    });
    await new Promise((r) => setTimeout(r, 20));
    expect(count).toBe(1);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/orchestrator.test.ts
```

Expected: 3 new tests fail.

- [ ] **Step 3: Port `scheduleRender` and helpers**

Replace the stub `scheduleRender()` with the real implementation. Add helper methods near the bottom of the class:

```typescript
import { classifyViewport } from './viewport-classify';
import { groupContiguousChunks } from './chunk-grouping';

  private renderInFlight = false;

  private scheduleRender(): void {
    if (this.renderInFlight) return;
    if (!this.viewport) return;
    this.renderInFlight = true;
    queueMicrotask(() => {
      this.renderInFlight = false;
      void this.runRender(this.generation);
    });
  }

  private async runRender(generation: number): Promise<void> {
    if (this.disposed) return;
    const viewport = this.viewport;
    if (!viewport) return;

    const canvasesByTrack = new Map<string, CanvasEntry[]>();
    for (const c of this.canvases.values()) {
      const list = canvasesByTrack.get(c.trackId) ?? [];
      list.push(c);
      canvasesByTrack.set(c.trackId, list);
    }

    for (const [trackId, trackCanvases] of canvasesByTrack) {
      const tiers = classifyViewport(trackCanvases, viewport);
      // Phase 1a: viewport tier — render synchronously (priority)
      await this.renderTier(tiers.viewport, generation, viewport);
      if (this.generation !== generation || this.disposed) return;
      this.dispatchEvent(new CustomEvent('viewport-ready', { detail: { trackId } }));
      // Phase 1b: buffer tier
      await this.renderTier(tiers.buffer, generation, viewport);
      if (this.generation !== generation || this.disposed) return;
      // Phase 2: remaining — yield via requestIdleCallback
      await this.renderRemainingViaIdle(tiers.remaining, generation, viewport);
    }
  }

  private async renderTier(
    canvases: CanvasEntry[],
    generation: number,
    viewport: ViewportState
  ): Promise<void> {
    if (canvases.length === 0) return;
    const groups = groupContiguousChunks(canvases);
    for (const group of groups) {
      if (this.generation !== generation || this.disposed) return;
      await this.renderGroup(group, generation, viewport);
    }
  }

  private async renderGroup(
    group: CanvasEntry[],
    generation: number,
    viewport: ViewportState
  ): Promise<void> {
    if (group.length === 0) return;
    const first = group[0];
    const clip = this.clips.get(first.clipId);
    if (!clip) return;

    const fftSize = this.config.fftSize ?? 2048;
    const startPx = Math.min(...group.map((c) => c.globalPixelOffset));
    const endPx = Math.max(...group.map((c) => c.globalPixelOffset + c.widthPx));
    const startSample = clip.offsetSamples + Math.floor(startPx * viewport.samplesPerPixel);
    const endSample = Math.min(
      clip.offsetSamples + clip.durationSamples,
      clip.offsetSamples + Math.ceil(endPx * viewport.samplesPerPixel)
    );
    const paddedStart = Math.max(clip.offsetSamples, startSample - fftSize);
    const paddedEnd = Math.min(clip.offsetSamples + clip.durationSamples, endSample + fftSize);

    const { cacheKey } = await this.pool.computeFFT(
      {
        clipId: first.clipId,
        channelDataArrays: clip.channelData,
        config: this.config,
        sampleRate: clip.sampleRate,
        offsetSamples: clip.offsetSamples,
        durationSamples: clip.durationSamples,
        mono: false,
        sampleRange: { start: paddedStart, end: paddedEnd },
      },
      generation
    );
    if (this.generation !== generation || this.disposed) return;

    const colorLUT = this.colorLUT.get(this.config.colorMap ?? 'viridis');
    await this.pool.renderChunks(
      {
        cacheKey,
        canvasIds: group.map((c) => c.canvasId),
        canvasWidths: group.map((c) => c.widthPx),
        globalPixelOffsets: group.map((c) => c.globalPixelOffset),
        canvasHeight: first.heightPx,
        devicePixelRatio: this.devicePixelRatio,
        samplesPerPixel: viewport.samplesPerPixel,
        colorLUT,
        frequencyScale: String(this.config.frequencyScale ?? 'mel'),
        minFrequency: this.config.minFrequency ?? 0,
        maxFrequency: this.config.maxFrequency ?? clip.sampleRate / 2,
        gainDb: this.config.gainDb ?? 20,
        rangeDb: this.config.rangeDb ?? 80,
        channelIndex: first.channelIndex,
      },
      generation
    );
  }

  private async renderRemainingViaIdle(
    canvases: CanvasEntry[],
    generation: number,
    viewport: ViewportState
  ): Promise<void> {
    if (canvases.length === 0) return;
    const groups = groupContiguousChunks(canvases);
    for (const group of groups) {
      if (this.generation !== generation || this.disposed) return;
      await this.yieldUntilIdle();
      if (this.generation !== generation || this.disposed) return;
      await this.renderGroup(group, generation, viewport);
    }
  }

  private yieldUntilIdle(): Promise<void> {
    return new Promise((resolve) => {
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(() => resolve());
      } else {
        setTimeout(resolve, 0);
      }
    });
  }
```

Update `setConfig` to trigger a re-render (it changes what to render):

```typescript
  setConfig(config: SpectrogramConfig): void {
    if (this.disposed) return;
    this.config = config;
    const prevGeneration = this.generation;
    this.generation += 1;
    this.pool.abortGeneration(prevGeneration);
    this.colorLUT.clear();
    this.scheduleRender();
  }
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/orchestrator.test.ts
```

Expected: 11 tests pass.

- [ ] **Step 5: Typecheck**

```bash
cd packages/dawcore-spectrogram && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 6: Build the package**

```bash
pnpm --filter @dawcore/spectrogram build
```

Expected: PASS — `dist/orchestrator/index.{mjs,d.ts}` produced.

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore-spectrogram
git commit -m "feat(dawcore-spectrogram): 3-tier render + viewport-ready event"
```

---

## Task 10: Rework `SpectrogramProvider.tsx` to wrap `SpectrogramOrchestrator`

The existing 905-line Provider becomes ~200 lines of React glue around the orchestrator.

**Files:**

- Modify: `packages/spectrogram/src/SpectrogramProvider.tsx` (full rewrite)
- Create: `packages/spectrogram/__tests__/SpectrogramProvider.test.tsx`

- [ ] **Step 1: Inspect `SpectrogramIntegrationContext`'s callback shape**

Before rewriting, read what the React playlist already expects:

```bash
cat packages/browser/src/SpectrogramIntegrationContext.tsx
```

The new Provider's contextValue must match the existing context's value type exactly. If the existing `registerCanvas` signature differs from what the new Provider would naturally pass, adapt the new Provider — the browser package contract is the source of truth. Do **not** change the browser package without surfacing to the user first.

- [ ] **Step 2: Add failing Provider→Orchestrator boundary tests**

Write `packages/spectrogram/__tests__/SpectrogramProvider.test.tsx`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import React from 'react';
import { SpectrogramProvider } from '../src/SpectrogramProvider';

const mockOrchestrator = {
  registerClip: vi.fn(),
  unregisterClip: vi.fn(),
  registerCanvas: vi.fn(),
  unregisterCanvas: vi.fn(),
  setConfig: vi.fn(),
  setViewport: vi.fn(),
  setDevicePixelRatio: vi.fn(),
  dispose: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.mock('@dawcore/spectrogram', () => ({
  SpectrogramOrchestrator: vi.fn().mockImplementation(() => mockOrchestrator),
  getColorMap: vi.fn(() => new Uint8Array(1024)),
}));

vi.mock('@waveform-playlist/browser', async () => {
  const actual = await vi.importActual<any>('@waveform-playlist/browser');
  return {
    ...actual,
    usePlaylistData: () => ({
      tracks: { tracks: [], clipsByTrack: new Map() },
      waveHeight: 100,
      samplesPerPixel: 1024,
      isReady: true,
      mono: false,
    }),
    usePlaylistControls: () => ({ scrollContainerRef: { current: null } }),
    useAudioBuffers: () => new Map(),
  };
});

describe('SpectrogramProvider', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  afterEach(() => cleanup());

  it('creates orchestrator on mount', () => {
    render(<SpectrogramProvider colorMap="magma">{null}</SpectrogramProvider>);
    const mod = require('@dawcore/spectrogram');
    expect(mod.SpectrogramOrchestrator).toHaveBeenCalledTimes(1);
  });

  it('calls orchestrator.dispose on unmount', () => {
    const { unmount } = render(<SpectrogramProvider colorMap="magma">{null}</SpectrogramProvider>);
    unmount();
    expect(mockOrchestrator.dispose).toHaveBeenCalledTimes(1);
  });

  it('forwards config changes via setConfig', () => {
    const { rerender } = render(<SpectrogramProvider colorMap="magma">{null}</SpectrogramProvider>);
    rerender(<SpectrogramProvider colorMap="viridis">{null}</SpectrogramProvider>);
    expect(mockOrchestrator.setConfig).toHaveBeenCalled();
    const last = mockOrchestrator.setConfig.mock.calls.at(-1)?.[0];
    expect(last.colorMap).toBe('viridis');
  });
});
```

- [ ] **Step 3: Run test (expect FAIL)**

```bash
cd packages/spectrogram && npx vitest run __tests__/SpectrogramProvider.test.tsx
```

Expected: FAIL — the existing Provider's behavior differs from the test expectations.

- [ ] **Step 4: Replace `SpectrogramProvider.tsx` body**

Replace `packages/spectrogram/src/SpectrogramProvider.tsx` entirely:

```typescript
import React, { useEffect, useMemo, useState } from 'react';
import { SpectrogramOrchestrator } from '@dawcore/spectrogram';
import type { SpectrogramConfig } from '@waveform-playlist/core';
import {
  SpectrogramIntegrationContext,
  usePlaylistData,
  usePlaylistControls,
  useAudioBuffers,
} from '@waveform-playlist/browser';

export interface SpectrogramProviderProps {
  children: React.ReactNode;
  fftSize?: 256 | 512 | 1024 | 2048 | 4096 | 8192;
  hopSize?: number;
  windowFunction?: 'hann' | 'hamming' | 'blackman' | 'rectangular' | 'bartlett' | 'blackman-harris';
  frequencyScale?: 'linear' | 'logarithmic' | 'mel' | 'bark' | 'erb';
  colorMap?: 'viridis' | 'magma' | 'inferno' | 'grayscale' | 'igray' | 'roseus';
  minFrequency?: number;
  maxFrequency?: number;
  gainDb?: number;
  rangeDb?: number;
  workerPoolSize?: number;
}

function buildConfig(props: Omit<SpectrogramProviderProps, 'children' | 'workerPoolSize'>): SpectrogramConfig {
  return {
    fftSize: props.fftSize ?? 2048,
    hopSize: props.hopSize,
    windowFunction: props.windowFunction ?? 'hann',
    frequencyScale: props.frequencyScale ?? 'mel',
    colorMap: props.colorMap ?? 'viridis',
    minFrequency: props.minFrequency ?? 0,
    maxFrequency: props.maxFrequency,
    gainDb: props.gainDb ?? 20,
    rangeDb: props.rangeDb ?? 80,
  };
}

export const SpectrogramProvider: React.FC<SpectrogramProviderProps> = (props) => {
  const { children, workerPoolSize, ...configProps } = props;
  const config = useMemo(() => buildConfig(configProps), [
    configProps.fftSize, configProps.hopSize, configProps.windowFunction,
    configProps.frequencyScale, configProps.colorMap, configProps.minFrequency,
    configProps.maxFrequency, configProps.gainDb, configProps.rangeDb,
  ]);

  const orchestrator = useMemo(() => new SpectrogramOrchestrator({
    workerFactory: () => new Worker(
      new URL('@waveform-playlist/spectrogram/worker/spectrogram.worker', import.meta.url),
      { type: 'module' }
    ),
    workerPoolSize: workerPoolSize ?? 2,
    config,
  }), []);

  useEffect(() => { orchestrator.setConfig(config); }, [orchestrator, config]);
  useEffect(() => () => orchestrator.dispose(), [orchestrator]);

  const audioBuffers = useAudioBuffers();
  useEffect(() => {
    const knownClipIds = new Set<string>();
    for (const [clipId, info] of audioBuffers as Map<string, any>) {
      orchestrator.registerClip({
        clipId,
        trackId: info.trackId,
        channelData: info.channels,
        sampleRate: info.sampleRate,
        durationSamples: info.durationSamples,
        offsetSamples: info.offsetSamples,
      });
      knownClipIds.add(clipId);
    }
    return () => {
      for (const clipId of knownClipIds) orchestrator.unregisterClip(clipId);
    };
  }, [audioBuffers, orchestrator]);

  const { scrollContainerRef } = usePlaylistControls();
  const { samplesPerPixel } = usePlaylistData();
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const update = () => {
      const visibleStart = el.scrollLeft;
      const visibleEnd = el.scrollLeft + el.clientWidth;
      const bufferPad = el.clientWidth * 0.25;
      orchestrator.setViewport({
        visibleStartPx: visibleStart,
        visibleEndPx: visibleEnd,
        bufferStartPx: Math.max(0, visibleStart - bufferPad),
        bufferEndPx: visibleEnd + bufferPad,
        samplesPerPixel,
      });
    };
    update();
    el.addEventListener('scroll', update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', update);
      ro.disconnect();
    };
  }, [scrollContainerRef, samplesPerPixel, orchestrator]);

  const [_settingsOpen, setSettingsOpen] = useState(false);

  // The exact contextValue shape must match SpectrogramIntegrationContext's expected
  // value type (verified in Step 1). Adjust the registerCanvas/unregisterCanvas
  // signatures to match the browser package's contract.
  const contextValue = useMemo(() => ({
    registerCanvas: (canvasId: string, canvas: OffscreenCanvas, meta: any) => {
      orchestrator.registerCanvas({
        canvasId,
        canvas,
        clipId: meta.clipId,
        trackId: meta.trackId,
        channelIndex: meta.channelIndex,
        chunkIndex: meta.chunkIndex,
        globalPixelOffset: meta.globalPixelOffset,
        widthPx: meta.widthPx,
        heightPx: meta.heightPx,
      });
    },
    unregisterCanvas: (canvasId: string) => orchestrator.unregisterCanvas(canvasId),
    openSettings: () => setSettingsOpen(true),
  }), [orchestrator]);

  return (
    <SpectrogramIntegrationContext.Provider value={contextValue as any}>
      {children}
    </SpectrogramIntegrationContext.Provider>
  );
};
```

If the existing `SpectrogramIntegrationContext` value shape doesn't include `clipId/trackId/channelIndex/chunkIndex/globalPixelOffset/widthPx/heightPx` in its `registerCanvas` signature, you need to either:
- Extract that metadata from the canvas ID string + lookups (the old Provider did this internally), OR
- Add the metadata fields to the browser context interface (requires user approval — this would touch `@waveform-playlist/browser`).

Default to the first option if possible. Surface the second to the user before changing browser.

- [ ] **Step 5: Run Provider tests (expect PASS)**

```bash
cd packages/spectrogram && npx vitest run __tests__/SpectrogramProvider.test.tsx
```

Expected: 3 tests pass.

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @dawcore/spectrogram build
cd packages/spectrogram && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Verify website MIR demo still builds**

```bash
pnpm --filter website build
```

Expected: PASS. CSS calc warnings are pre-existing and harmless (per CLAUDE.md).

- [ ] **Step 8: Manually verify MIR demo**

```bash
pnpm --filter website start
```

Navigate to the MIR spectrogram example page. Confirm:
- Spectrogram renders for visible viewport
- Scrolling loads off-screen chunks
- Color map dropdown (if present) changes the visualization
- No console errors

Stop the dev server.

- [ ] **Step 9: Commit**

```bash
git add packages/spectrogram
git commit -m "refactor(spectrogram): React Provider wraps SpectrogramOrchestrator"
```

---

## Task 11: Extend `TrackRenderMode` + add `spectrogramConfig` JS properties

**Files:**

- Modify: `packages/dawcore/package.json` (add `@dawcore/spectrogram` dep)
- Modify: `packages/dawcore/src/types.ts`
- Modify: `packages/dawcore/src/elements/daw-track.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts`
- Modify: `packages/dawcore/src/__tests__/daw-track.test.ts`

- [ ] **Step 1: Add `@dawcore/spectrogram` dependency**

Modify `packages/dawcore/package.json`:

```json
"dependencies": {
  "lit": "^3.0.0",
  "waveform-data": "^4.5.2",
  "@dawcore/spectrogram": "workspace:*"
}
```

Run `pnpm install` to update lockfile.

- [ ] **Step 2: Extend `TrackRenderMode`**

Modify `packages/dawcore/src/types.ts`. Find:

```typescript
export type TrackRenderMode = 'waveform' | 'piano-roll';
```

Change to:

```typescript
export type TrackRenderMode = 'waveform' | 'piano-roll' | 'spectrogram';
```

Add at top:

```typescript
import type { SpectrogramConfig } from '@waveform-playlist/core';
```

Add to `TrackDescriptor`:

```typescript
spectrogramConfig?: SpectrogramConfig | null;
```

Add to `TrackConfig`:

```typescript
spectrogramConfig?: SpectrogramConfig | null;
```

- [ ] **Step 3: Add `spectrogramConfig` JS property to `<daw-track>`**

Modify `packages/dawcore/src/elements/daw-track.ts`. Add import at top:

```typescript
import type { SpectrogramConfig } from '@waveform-playlist/core';
```

Add property after `renderMode`:

```typescript
@property({ attribute: false })
spectrogramConfig: SpectrogramConfig | null = null;
```

Add `'spectrogramConfig'` to the `trackProps` array in `updated()`:

```typescript
const trackProps = ['volume', 'pan', 'muted', 'soloed', 'src', 'name', 'renderMode', 'spectrogramConfig'];
```

- [ ] **Step 4: Add `spectrogramConfig` property to `<daw-editor>`**

Modify `packages/dawcore/src/elements/daw-editor.ts`. Add import:

```typescript
import type { SpectrogramConfig } from '@waveform-playlist/core';
```

Add a `_spectrogramConfig` backing field and `@property` with a setter (the setter forwards to the controller — added in Task 14):

```typescript
private _spectrogramConfig: SpectrogramConfig | null = null;

@property({ attribute: false })
get spectrogramConfig(): SpectrogramConfig | null { return this._spectrogramConfig; }
set spectrogramConfig(value: SpectrogramConfig | null) {
  const old = this._spectrogramConfig;
  this._spectrogramConfig = value;
  // Controller wiring added in Task 14:
  // this._spectrogramController?.setEditorConfig(value);
  this.requestUpdate('spectrogramConfig', old);
}
```

- [ ] **Step 5: Add failing tests for `render-mode="spectrogram"` + `spectrogramConfig`**

Append to `packages/dawcore/src/__tests__/daw-track.test.ts`:

```typescript
it('accepts render-mode="spectrogram" attribute', () => {
  const el = document.createElement('daw-track') as any;
  el.setAttribute('render-mode', 'spectrogram');
  document.body.appendChild(el);
  expect(el.renderMode).toBe('spectrogram');
  el.remove();
});

it('exposes spectrogramConfig JS property defaulting to null', () => {
  const el = document.createElement('daw-track') as any;
  expect(el.spectrogramConfig).toBeNull();
});

it('accepts and stores a spectrogramConfig object', () => {
  const el = document.createElement('daw-track') as any;
  el.spectrogramConfig = { colorMap: 'magma', fftSize: 1024 };
  expect(el.spectrogramConfig.colorMap).toBe('magma');
});
```

- [ ] **Step 6: Run tests (expect PASS)**

```bash
cd packages/dawcore && npx vitest run src/__tests__/daw-track.test.ts
```

Expected: existing tests + 3 new tests pass.

- [ ] **Step 7: Typecheck dawcore**

```bash
pnpm --filter @dawcore/spectrogram build
cd packages/dawcore && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/dawcore pnpm-lock.yaml
git commit -m "feat(dawcore): extend TrackRenderMode with 'spectrogram'; add spectrogramConfig"
```

---

## Task 12: `<daw-spectrogram>` Lit element

**Files:**

- Create: `packages/dawcore/src/elements/daw-spectrogram.ts`
- Create: `packages/dawcore/src/__tests__/daw-spectrogram.test.ts`
- Modify: `packages/dawcore/src/index.ts` (export the element)

- [ ] **Step 1: Write failing tests**

Write `packages/dawcore/src/__tests__/daw-spectrogram.test.ts`:

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../elements/daw-spectrogram';

describe('<daw-spectrogram>', () => {
  beforeEach(() => {
    document.body.replaceChildren();
  });

  it('is a custom element', () => {
    const el = document.createElement('daw-spectrogram');
    expect(el).toBeInstanceOf(HTMLElement);
  });

  it('exposes default JS properties', () => {
    const el = document.createElement('daw-spectrogram') as any;
    expect(el.clipId).toBe('');
    expect(el.trackId).toBe('');
    expect(el.channelIndex).toBe(0);
    expect(el.length).toBe(0);
    expect(el.waveHeight).toBe(128);
    expect(el.samplesPerPixel).toBe(1024);
    expect(el.sampleRate).toBe(44100);
  });

  it('rejects invalid samplesPerPixel values', () => {
    const el = document.createElement('daw-spectrogram') as any;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.samplesPerPixel = 0;
    expect(el.samplesPerPixel).toBe(1024);
    el.samplesPerPixel = -5;
    expect(el.samplesPerPixel).toBe(1024);
    el.samplesPerPixel = NaN;
    expect(el.samplesPerPixel).toBe(1024);
    el.samplesPerPixel = 2048;
    expect(el.samplesPerPixel).toBe(2048);
    warn.mockRestore();
  });

  it('rejects invalid sampleRate values', () => {
    const el = document.createElement('daw-spectrogram') as any;
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.sampleRate = 0;
    expect(el.sampleRate).toBe(44100);
    el.sampleRate = 48000;
    expect(el.sampleRate).toBe(48000);
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd packages/dawcore && npx vitest run src/__tests__/daw-spectrogram.test.ts
```

Expected: FAIL — element doesn't exist.

- [ ] **Step 3: Implement `<daw-spectrogram>`**

Write `packages/dawcore/src/elements/daw-spectrogram.ts`:

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

const MAX_CANVAS_WIDTH = 1000;

@customElement('daw-spectrogram')
export class DawSpectrogramElement extends LitElement {
  @property({ attribute: false }) clipId = '';
  @property({ attribute: false }) trackId = '';
  @property({ type: Number, attribute: false }) channelIndex = 0;
  @property({ type: Number, attribute: false }) length = 0;
  @property({ type: Number, attribute: false }) waveHeight = 128;

  @property({ type: Number, attribute: false, noAccessor: true })
  get samplesPerPixel(): number { return this._samplesPerPixel; }
  set samplesPerPixel(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      console.warn('[dawcore] daw-spectrogram samplesPerPixel ' + value + ' is invalid — ignored');
      return;
    }
    const old = this._samplesPerPixel;
    this._samplesPerPixel = value;
    this.requestUpdate('samplesPerPixel', old);
  }
  private _samplesPerPixel = 1024;

  @property({ type: Number, attribute: false, noAccessor: true })
  get sampleRate(): number { return this._sampleRate; }
  set sampleRate(value: number) {
    if (!Number.isFinite(value) || value <= 0) {
      console.warn('[dawcore] daw-spectrogram sampleRate ' + value + ' is invalid — ignored');
      return;
    }
    const old = this._sampleRate;
    this._sampleRate = value;
    this.requestUpdate('sampleRate', old);
  }
  private _sampleRate = 44100;

  @property({ type: Number, attribute: false }) clipOffsetSeconds = 0;
  @property({ type: Number, attribute: false }) visibleStart = -Infinity;
  @property({ type: Number, attribute: false }) visibleEnd = Infinity;
  @property({ type: Number, attribute: false }) originX = 0;

  static styles = css`
    :host {
      display: block;
      position: relative;
      background: var(--daw-spectrogram-background, #000);
    }
    canvas {
      position: absolute;
      top: 0;
      left: 0;
      height: 100%;
      pointer-events: none;
    }
  `;

  private _canvases: HTMLCanvasElement[] = [];
  private _registeredCanvasIds: string[] = [];

  willUpdate(changed: PropertyValues): void {
    const layoutChanged =
      changed.has('length') || changed.has('waveHeight') ||
      changed.has('samplesPerPixel') || changed.has('clipId') ||
      changed.has('channelIndex');
    if (layoutChanged) {
      this._rebuildChunks();
    }
  }

  private _rebuildChunks(): void {
    this._unregisterAllCanvases();
    this._canvases = [];

    if (this.length <= 0) return;

    const chunkCount = Math.ceil(this.length / MAX_CANVAS_WIDTH);
    for (let i = 0; i < chunkCount; i++) {
      const widthPx = Math.min(MAX_CANVAS_WIDTH, this.length - i * MAX_CANVAS_WIDTH);
      const canvas = document.createElement('canvas');
      canvas.style.left = (i * MAX_CANVAS_WIDTH) + 'px';
      canvas.style.width = widthPx + 'px';
      const dpr = window.devicePixelRatio || 1;
      canvas.width = widthPx * dpr;
      canvas.height = this.waveHeight * dpr;
      this._canvases.push(canvas);
    }
  }

  protected updated(_changed: PropertyValues): void {
    if (this._registeredCanvasIds.length === 0 && this._canvases.length > 0) {
      requestAnimationFrame(() => this._registerCanvases());
    }
  }

  private _registerCanvases(): void {
    const editor = this.closest('daw-editor') as any;
    if (!editor || typeof editor._spectrogramRegisterCanvas !== 'function') return;

    for (let i = 0; i < this._canvases.length; i++) {
      const canvas = this._canvases[i];
      const canvasId = this.clipId + '-ch' + this.channelIndex + '-chunk' + i;
      const offscreen = canvas.transferControlToOffscreen();
      editor._spectrogramRegisterCanvas({
        canvasId,
        canvas: offscreen,
        clipId: this.clipId,
        trackId: this.trackId,
        channelIndex: this.channelIndex,
        chunkIndex: i,
        globalPixelOffset: this.originX + i * MAX_CANVAS_WIDTH,
        widthPx: parseFloat(canvas.style.width),
        heightPx: this.waveHeight,
      });
      this._registeredCanvasIds.push(canvasId);
    }
  }

  private _unregisterAllCanvases(): void {
    const editor = this.closest('daw-editor') as any;
    if (editor && typeof editor._spectrogramUnregisterCanvas === 'function') {
      for (const id of this._registeredCanvasIds) {
        editor._spectrogramUnregisterCanvas(id);
      }
    }
    this._registeredCanvasIds = [];
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._unregisterAllCanvases();
  }

  render() {
    return html`${this._canvases.map((c) => c)}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-spectrogram': DawSpectrogramElement;
  }
}
```

- [ ] **Step 4: Export from index**

Modify `packages/dawcore/src/index.ts`. Add:

```typescript
import './elements/daw-spectrogram';
export { DawSpectrogramElement } from './elements/daw-spectrogram';
```

- [ ] **Step 5: Run tests (expect PASS)**

```bash
cd packages/dawcore && npx vitest run src/__tests__/daw-spectrogram.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 6: Typecheck**

```bash
cd packages/dawcore && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore
git commit -m "feat(dawcore): add <daw-spectrogram> Lit element"
```

---

## Task 13: `SpectrogramController` on `<daw-editor>`

**Files:**

- Create: `packages/dawcore/src/controllers/spectrogram-controller.ts`
- Create: `packages/dawcore/src/__tests__/spectrogram-controller.test.ts`
- Modify: `packages/dawcore/src/index.ts` (export controller)

- [ ] **Step 1: Write failing controller tests**

Write `packages/dawcore/src/__tests__/spectrogram-controller.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SpectrogramController } from '../controllers/spectrogram-controller';

const mockOrchestrator = {
  registerClip: vi.fn(),
  unregisterClip: vi.fn(),
  registerCanvas: vi.fn(),
  unregisterCanvas: vi.fn(),
  setConfig: vi.fn(),
  setViewport: vi.fn(),
  setDevicePixelRatio: vi.fn(),
  dispose: vi.fn(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
};

vi.mock('@dawcore/spectrogram', () => ({
  SpectrogramOrchestrator: vi.fn().mockImplementation(() => mockOrchestrator),
}));

function makeHost() {
  return {
    addController: vi.fn(),
    removeController: vi.fn(),
    dispatchEvent: vi.fn(),
  } as any;
}

describe('SpectrogramController', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('lazily creates orchestrator on first registerCanvas', () => {
    const host = makeHost();
    const controller = new SpectrogramController(host, () => new Worker(''));
    const mod = require('@dawcore/spectrogram');
    expect(mod.SpectrogramOrchestrator).not.toHaveBeenCalled();
    controller.registerCanvas({
      canvasId: 'c', canvas: {} as any,
      clipId: 'c1', trackId: 't1', channelIndex: 0, chunkIndex: 0,
      globalPixelOffset: 0, widthPx: 100, heightPx: 100,
    });
    expect(mod.SpectrogramOrchestrator).toHaveBeenCalledTimes(1);
  });

  it('dispose terminates the orchestrator if created', () => {
    const host = makeHost();
    const controller = new SpectrogramController(host, () => new Worker(''));
    controller.registerCanvas({
      canvasId: 'c', canvas: {} as any,
      clipId: 'c1', trackId: 't1', channelIndex: 0, chunkIndex: 0,
      globalPixelOffset: 0, widthPx: 100, heightPx: 100,
    });
    controller.dispose();
    expect(mockOrchestrator.dispose).toHaveBeenCalledTimes(1);
  });

  it('dispose is a no-op when orchestrator was never created', () => {
    const host = makeHost();
    const controller = new SpectrogramController(host, () => new Worker(''));
    controller.dispose();
    expect(mockOrchestrator.dispose).not.toHaveBeenCalled();
  });

  it('config merge: editor global is applied after orchestrator creation', () => {
    const host = makeHost();
    const controller = new SpectrogramController(host, () => new Worker(''));
    controller.setEditorConfig({ colorMap: 'viridis', fftSize: 2048 });
    controller.registerCanvas({
      canvasId: 'c', canvas: {} as any,
      clipId: 'c1', trackId: 't1', channelIndex: 0, chunkIndex: 0,
      globalPixelOffset: 0, widthPx: 100, heightPx: 100,
    });
    expect(mockOrchestrator.setConfig).toHaveBeenCalled();
    const finalCall = mockOrchestrator.setConfig.mock.calls.at(-1)?.[0];
    expect(finalCall.colorMap).toBe('viridis');
    expect(finalCall.fftSize).toBe(2048);
  });
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd packages/dawcore && npx vitest run src/__tests__/spectrogram-controller.test.ts
```

Expected: FAIL — controller does not exist.

- [ ] **Step 3: Implement `SpectrogramController`**

Write `packages/dawcore/src/controllers/spectrogram-controller.ts`:

```typescript
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import {
  SpectrogramOrchestrator,
  type ClipRegistration,
  type CanvasRegistration,
  type ViewportState,
} from '@dawcore/spectrogram';
import type { SpectrogramConfig } from '@waveform-playlist/core';

const LIBRARY_DEFAULTS: SpectrogramConfig = {
  fftSize: 2048,
  windowFunction: 'hann',
  frequencyScale: 'mel',
  colorMap: 'viridis',
  minFrequency: 0,
  gainDb: 20,
  rangeDb: 80,
};

export interface SpectrogramControllerHost extends ReactiveControllerHost {
  dispatchEvent(event: Event): boolean;
}

function mergeConfig(
  defaults: SpectrogramConfig,
  editor: SpectrogramConfig | null,
  track: SpectrogramConfig | null
): SpectrogramConfig {
  return {
    ...defaults,
    ...(editor ?? {}),
    ...(track ?? {}),
  };
}

export class SpectrogramController implements ReactiveController {
  private host: SpectrogramControllerHost;
  private workerFactory: () => Worker;
  private orchestrator: SpectrogramOrchestrator | null = null;
  private editorConfig: SpectrogramConfig | null = null;
  private trackConfigs = new Map<string, SpectrogramConfig | null>();
  private canvasTrackIds = new Map<string, string>();

  constructor(host: SpectrogramControllerHost, workerFactory: () => Worker) {
    this.host = host;
    this.workerFactory = workerFactory;
    this.host.addController(this);
  }

  hostConnected(): void { /* lazy */ }
  hostDisconnected(): void { this.dispose(); }

  setEditorConfig(config: SpectrogramConfig | null): void {
    this.editorConfig = config;
    this.reapplyConfig();
  }

  setTrackConfig(trackId: string, config: SpectrogramConfig | null): void {
    if (config === null) {
      this.trackConfigs.delete(trackId);
    } else {
      this.trackConfigs.set(trackId, config);
    }
    this.reapplyConfig();
  }

  registerClipAudio(reg: ClipRegistration): void {
    this.ensureOrchestrator().registerClip(reg);
  }

  unregisterClipAudio(clipId: string): void {
    this.orchestrator?.unregisterClip(clipId);
  }

  registerCanvas(reg: CanvasRegistration): void {
    this.canvasTrackIds.set(reg.canvasId, reg.trackId);
    const orch = this.ensureOrchestrator();
    orch.registerCanvas(reg);
  }

  unregisterCanvas(canvasId: string): void {
    this.canvasTrackIds.delete(canvasId);
    this.orchestrator?.unregisterCanvas(canvasId);
  }

  setViewport(state: ViewportState): void {
    this.orchestrator?.setViewport(state);
  }

  dispose(): void {
    if (this.orchestrator) {
      this.orchestrator.dispose();
      this.orchestrator = null;
    }
    this.canvasTrackIds.clear();
  }

  private ensureOrchestrator(): SpectrogramOrchestrator {
    if (!this.orchestrator) {
      const initialConfig = mergeConfig(LIBRARY_DEFAULTS, this.editorConfig, null);
      this.orchestrator = new SpectrogramOrchestrator({
        workerFactory: this.workerFactory,
        workerPoolSize: 2,
        config: initialConfig,
      });
      this.orchestrator.addEventListener('viewport-ready', (e: Event) => {
        const detail = (e as CustomEvent).detail as { trackId: string };
        this.host.dispatchEvent(new CustomEvent('daw-spectrogram-ready', {
          detail, bubbles: true, composed: true,
        }));
      });
      this.reapplyConfig();
    }
    return this.orchestrator;
  }

  private reapplyConfig(): void {
    if (!this.orchestrator) return;
    // v1 limitation: orchestrator accepts one config at a time.
    // Per-track override applies only when one track is in spectrogram mode;
    // multi-track with different configs is deferred to a follow-up.
    let track: SpectrogramConfig | null = null;
    for (const c of this.trackConfigs.values()) {
      track = c;
      break;
    }
    const merged = mergeConfig(LIBRARY_DEFAULTS, this.editorConfig, track);
    this.orchestrator.setConfig(merged);
  }
}
```

- [ ] **Step 4: Run tests (expect PASS)**

```bash
cd packages/dawcore && npx vitest run src/__tests__/spectrogram-controller.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 5: Export controller from index**

Modify `packages/dawcore/src/index.ts`. Add:

```typescript
export { SpectrogramController } from './controllers/spectrogram-controller';
```

- [ ] **Step 6: Typecheck**

```bash
cd packages/dawcore && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore
git commit -m "feat(dawcore): SpectrogramController lazy controller on editor"
```

---

## Task 14: Wire controller into `<daw-editor>` + render-template branch

**Files:**

- Modify: `packages/dawcore/src/elements/daw-editor.ts` (multiple sites)
- Modify: `packages/dawcore/src/__tests__/daw-editor.test.ts`

- [ ] **Step 1: Add failing test for spectrogram render-mode branch**

Modify `packages/dawcore/src/__tests__/daw-editor.test.ts`. Add (adapt to existing test fixture patterns; the editor's tests use specific mock helpers):

```typescript
it('renders <daw-spectrogram> for tracks with render-mode="spectrogram"', async () => {
  // Set up the editor with a single spectrogram-mode track following the
  // existing test fixture patterns (mock _peakPipeline, mock adapter, etc).
  // After update:
  //   editor.shadowRoot.querySelectorAll('daw-spectrogram').length >= 1
  //   editor.shadowRoot.querySelectorAll('daw-waveform').length === 0  (for that track)
});
```

- [ ] **Step 2: Run test (expect FAIL)**

```bash
cd packages/dawcore && npx vitest run src/__tests__/daw-editor.test.ts
```

Expected: FAIL — no `<daw-spectrogram>` in render output.

- [ ] **Step 3: Add controller import + ref to editor**

Modify `packages/dawcore/src/elements/daw-editor.ts`. Add at top:

```typescript
import { SpectrogramController } from '../controllers/spectrogram-controller';
```

Add private field near other controller refs:

```typescript
private _spectrogramController: SpectrogramController | null = null;
```

Add ensure method:

```typescript
private _ensureSpectrogramController(): SpectrogramController {
  if (!this._spectrogramController) {
    this._spectrogramController = new SpectrogramController(
      this,
      () => new Worker(
        new URL('@dawcore/spectrogram/worker/spectrogram.worker', import.meta.url),
        { type: 'module' }
      )
    );
    if (this._spectrogramConfig) {
      this._spectrogramController.setEditorConfig(this._spectrogramConfig);
    }
  }
  return this._spectrogramController;
}
```

Add bridge methods for `<daw-spectrogram>` to call:

```typescript
_spectrogramRegisterCanvas(reg: any): void {
  this._ensureSpectrogramController().registerCanvas(reg);
}

_spectrogramUnregisterCanvas(canvasId: string): void {
  this._spectrogramController?.unregisterCanvas(canvasId);
}
```

- [ ] **Step 4: Update `spectrogramConfig` setter to forward to controller**

In the `spectrogramConfig` setter added in Task 11, replace the commented line with:

```typescript
set spectrogramConfig(value: SpectrogramConfig | null) {
  const old = this._spectrogramConfig;
  this._spectrogramConfig = value;
  this._spectrogramController?.setEditorConfig(value);
  this.requestUpdate('spectrogramConfig', old);
}
```

- [ ] **Step 5: Add render-template branch**

In the render template around line 2302 of `daw-editor.ts`, find:

```typescript
${t.descriptor?.renderMode === 'piano-roll'
  ? html`<daw-piano-roll ...></daw-piano-roll>`
  : channels.map(
      (chPeaks, chIdx) =>
        html` <daw-waveform ...></daw-waveform>`
    )}
```

Replace with:

```typescript
${t.descriptor?.renderMode === 'piano-roll'
  ? html`<daw-piano-roll
      style="position:absolute;left:0;top:${hdrH}px;"
      .midiNotes=${clip.midiNotes ?? []}
      .length=${peakData?.length ?? width}
      .waveHeight=${chH * channels.length}
      .samplesPerPixel=${this._renderSpp}
      .sampleRate=${this.effectiveSampleRate}
      .clipOffsetSeconds=${(clip.offsetSamples ?? 0) / this.effectiveSampleRate}
      .visibleStart=${this._viewport.visibleStart}
      .visibleEnd=${this._viewport.visibleEnd}
      .originX=${clipLeft}
      ?selected=${t.trackId === this._selectedTrackId}
    ></daw-piano-roll>`
  : t.descriptor?.renderMode === 'spectrogram'
  ? channels.map(
      (_, chIdx) => html`<daw-spectrogram
        style="position:absolute;left:0;top:${hdrH + chIdx * chH}px;height:${chH}px;width:${peakData?.length ?? width}px;"
        .clipId=${clip.id}
        .trackId=${t.trackId}
        .channelIndex=${chIdx}
        .length=${peakData?.length ?? width}
        .waveHeight=${chH}
        .samplesPerPixel=${this._renderSpp}
        .sampleRate=${this.effectiveSampleRate}
        .clipOffsetSeconds=${(clip.offsetSamples ?? 0) / this.effectiveSampleRate}
        .visibleStart=${this._viewport.visibleStart}
        .visibleEnd=${this._viewport.visibleEnd}
        .originX=${clipLeft}
      ></daw-spectrogram>`
    )
  : channels.map(
      (chPeaks, chIdx) =>
        html` <daw-waveform
          style="position:absolute;left:0;top:${hdrH + chIdx * chH}px;"
          .peaks=${chPeaks}
          .length=${peakData?.length ?? width}
          .waveHeight=${chH}
          .barWidth=${this.barWidth}
          .barGap=${this.barGap}
          .visibleStart=${this._viewport.visibleStart}
          .visibleEnd=${this._viewport.visibleEnd}
          .originX=${clipLeft}
          .segments=${clipSegments}
        ></daw-waveform>`
    )}
```

- [ ] **Step 6: Audio-data plumbing — register clips when track is spectrogram-mode**

Find the function where audio decoding finishes and `_clipBuffers.set(clipId, audioBuffer)` is called (search for `_clipBuffers.set` in `daw-editor.ts`). After that line, add:

```typescript
const descriptor = this._tracks.get(trackId);
if (descriptor?.renderMode === 'spectrogram' && this._spectrogramController) {
  const ch: Float32Array[] = [];
  for (let i = 0; i < audioBuffer.numberOfChannels; i++) {
    ch.push(audioBuffer.getChannelData(i));
  }
  this._spectrogramController.registerClipAudio({
    clipId: clip.id,
    trackId,
    channelData: ch,
    sampleRate: audioBuffer.sampleRate,
    durationSamples: clip.durationSamples,
    offsetSamples: clip.offsetSamples,
  });
}
```

In `_purgeClipCaches(clipId)` (search for the function), add:

```typescript
this._spectrogramController?.unregisterClipAudio(clipId);
```

- [ ] **Step 7: Handle render-mode change at runtime**

In the `daw-track-update` handler (or wherever `renderMode` change is detected), add:

```typescript
// If the track switched INTO spectrogram mode, register existing clips' audio
if (newRenderMode === 'spectrogram' && oldRenderMode !== 'spectrogram') {
  const descriptor = this._tracks.get(trackId);
  if (descriptor) {
    for (const clip of descriptor.clips) {
      const buf = this._clipBuffers.get(clip.id);
      if (buf) {
        const ch: Float32Array[] = [];
        for (let i = 0; i < buf.numberOfChannels; i++) ch.push(buf.getChannelData(i));
        this._ensureSpectrogramController().registerClipAudio({
          clipId: clip.id, trackId, channelData: ch,
          sampleRate: buf.sampleRate,
          durationSamples: clip.durationSamples,
          offsetSamples: clip.offsetSamples,
        });
      }
    }
  }
}
// If the track switched OUT of spectrogram mode, unregister
if (newRenderMode !== 'spectrogram' && oldRenderMode === 'spectrogram') {
  const descriptor = this._tracks.get(trackId);
  if (descriptor) {
    for (const clip of descriptor.clips) {
      this._spectrogramController?.unregisterClipAudio(clip.id);
    }
  }
}
```

- [ ] **Step 8: Dispose controller when no spectrogram tracks remain**

In `_onTrackRemoved` (and after applying `daw-track-update`), after applying changes:

```typescript
const hasSpectrogramTracks = Array.from(this._tracks.values()).some(
  (d) => d.renderMode === 'spectrogram'
);
if (!hasSpectrogramTracks && this._spectrogramController) {
  this._spectrogramController.dispose();
  this._spectrogramController = null;
}
```

- [ ] **Step 9: Viewport forwarding**

In `ViewportController`'s subscription handler on the editor (search for where `_viewport` is updated), add:

```typescript
const bufferPad = (this._viewport.visibleEnd - this._viewport.visibleStart) * 0.25;
this._spectrogramController?.setViewport({
  visibleStartPx: this._viewport.visibleStart,
  visibleEndPx: this._viewport.visibleEnd,
  bufferStartPx: Math.max(0, this._viewport.visibleStart - bufferPad),
  bufferEndPx: this._viewport.visibleEnd + bufferPad,
  samplesPerPixel: this._renderSpp,
});
```

- [ ] **Step 10: Run tests**

```bash
cd packages/dawcore && npx vitest run
```

Expected: existing tests + new render-mode test pass.

- [ ] **Step 11: Typecheck**

```bash
cd packages/dawcore && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add packages/dawcore
git commit -m "feat(dawcore): wire SpectrogramController into editor + render-template branch"
```

---

## Task 15: Add `daw-spectrogram-ready` event to event map

**Files:**

- Modify: `packages/dawcore/src/events.ts`

- [ ] **Step 1: Add to DawEventMap**

Modify `packages/dawcore/src/events.ts`. Add:

```typescript
export interface DawSpectrogramReadyDetail {
  trackId: string;
}
```

In the `DawEventMap` interface, add:

```typescript
'daw-spectrogram-ready': CustomEvent<DawSpectrogramReadyDetail>;
```

- [ ] **Step 2: Verify controller dispatches with bubbles/composed**

In `SpectrogramController.ensureOrchestrator()` (Task 13), confirm:

```typescript
this.host.dispatchEvent(new CustomEvent('daw-spectrogram-ready', {
  detail, bubbles: true, composed: true,
}));
```

If `bubbles: true, composed: true` is missing, add them.

- [ ] **Step 3: Run tests + typecheck**

```bash
cd packages/dawcore && npx vitest run
cd packages/dawcore && pnpm typecheck
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add packages/dawcore
git commit -m "feat(dawcore): add daw-spectrogram-ready event"
```

---

## Task 16: `examples/dawcore-native/spectrogram.html`

**Files:**

- Create: `examples/dawcore-native/spectrogram.html`

- [ ] **Step 1: Create the demo page**

Write `examples/dawcore-native/spectrogram.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>dawcore + Native — spectrogram</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f0f1a; color: #e0d4c8; padding: 24px; }
    h1 { font-size: 1.2rem; margin-bottom: 16px; }
    daw-editor {
      --daw-background: #1a1a2e;
      --daw-spectrogram-background: #000;
      --daw-ruler-color: #c49a6c;
      --daw-ruler-background: #0f0f1a;
      margin-bottom: 12px;
    }
    daw-transport { display: flex; gap: 8px; margin-bottom: 12px; }
    .controls { display: flex; flex-wrap: wrap; gap: 12px 24px; align-items: center;
                font-size: 0.85rem; margin-bottom: 12px; }
    select, label { font-family: inherit; }
    select { background: #1a1a2e; color: #e0d4c8;
             border: 1px solid #c49a6c; padding: 4px 8px; }
    #status { font-family: monospace; font-size: 0.75rem;
              color: #888; max-height: 80px; overflow-y: auto; }
  </style>
</head>
<body>
  <h1>dawcore + Native — spectrogram render-mode</h1>
  <script type="module">import '@dawcore/components';</script>

  <div class="controls">
    <label>Color map:
      <select id="colormap">
        <option>viridis</option><option selected>magma</option>
        <option>inferno</option><option>grayscale</option><option>roseus</option>
      </select>
    </label>
    <label>Frequency scale:
      <select id="freqscale">
        <option>linear</option><option>logarithmic</option>
        <option selected>mel</option><option>bark</option><option>erb</option>
      </select>
    </label>
    <label>FFT size:
      <select id="fftsize">
        <option>512</option><option>1024</option>
        <option selected>2048</option><option>4096</option>
      </select>
    </label>
  </div>

  <daw-editor id="editor" samples-per-pixel="1024" wave-height="120" timescale file-drop>
    <daw-track src="/media/audio/AlbertKader_Whiptails/03_Kick.opus"  name="Kick"  render-mode="spectrogram"></daw-track>
    <daw-track src="/media/audio/AlbertKader_Whiptails/05_Claps.opus" name="Claps" render-mode="spectrogram"></daw-track>
    <daw-track src="/media/audio/AlbertKader_Whiptails/07_Bass1.opus" name="Bass"  render-mode="waveform"></daw-track>
    <daw-track src="/media/audio/AlbertKader_Whiptails/09_Synth1.opus" name="Synth" render-mode="spectrogram"></daw-track>
  </daw-editor>

  <daw-transport for="editor">
    <daw-play-button></daw-play-button>
    <daw-pause-button></daw-pause-button>
    <daw-stop-button></daw-stop-button>
  </daw-transport>

  <div id="status"></div>

  <script type="module">
    import { createNativeAdapter } from '@waveform-playlist/playout';
    const editor = document.getElementById('editor');
    editor.adapter = createNativeAdapter();
    editor.spectrogramConfig = {
      fftSize: 2048, colorMap: 'magma', frequencyScale: 'mel',
    };

    const status = document.getElementById('status');
    editor.addEventListener('daw-spectrogram-ready', (e) => {
      const line = document.createElement('div');
      line.textContent = 'ready: track ' + e.detail.trackId;
      status.prepend(line);
      while (status.children.length > 10) status.lastChild.remove();
    });

    document.getElementById('colormap').addEventListener('change', (e) => {
      editor.spectrogramConfig = { ...editor.spectrogramConfig, colorMap: e.target.value };
    });
    document.getElementById('freqscale').addEventListener('change', (e) => {
      editor.spectrogramConfig = { ...editor.spectrogramConfig, frequencyScale: e.target.value };
    });
    document.getElementById('fftsize').addEventListener('change', (e) => {
      editor.spectrogramConfig = { ...editor.spectrogramConfig, fftSize: Number(e.target.value) };
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify Vite picks up the new HTML entry**

```bash
pnpm example:dawcore-native
```

Open `http://localhost:5173/spectrogram.html` (port from vite log if different). Confirm:
- 4 tracks render (3 spectrogram, 1 waveform)
- Spectrogram tracks show colored frequency content within ~1-2 seconds of page load
- Color map dropdown changes the visualization
- FFT size dropdown changes the time/frequency resolution
- Status log shows `ready` events firing per track
- Playback works through native adapter

Stop the dev server.

- [ ] **Step 3: Commit**

```bash
git add examples/dawcore-native/spectrogram.html
git commit -m "feat(examples): add dawcore-native spectrogram demo"
```

---

## Task 17: `examples/dawcore-tone/spectrogram.html`

**Files:**

- Create: `examples/dawcore-tone/spectrogram.html`

- [ ] **Step 1: Create the demo page**

Copy the native demo HTML from Task 16. Change one line at the bottom:

```html
<script type="module">
  import { createToneAdapter } from '@waveform-playlist/playout';
  const editor = document.getElementById('editor');
  editor.adapter = createToneAdapter();
  // ... rest identical to Task 16
</script>
```

Everything else (HTML structure, controls, event handlers) is the same.

- [ ] **Step 2: Verify it runs**

```bash
pnpm example:dawcore-tone
```

Open `http://localhost:5174/spectrogram.html` (port from vite log). Confirm same behavior as Task 16, with playback through the Tone.js adapter.

- [ ] **Step 3: Commit**

```bash
git add examples/dawcore-tone/spectrogram.html
git commit -m "feat(examples): add dawcore-tone spectrogram demo"
```

---

## Task 18: E2E test

**Files:**

- Create: `e2e/dawcore-spectrogram.spec.ts`

- [ ] **Step 1: Write failing test**

Write `e2e/dawcore-spectrogram.spec.ts`:

```typescript
import { test, expect } from '@playwright/test';

test.describe('dawcore spectrogram render-mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dawcore-native/spectrogram.html');
  });

  test('renders <daw-spectrogram> for spectrogram tracks; <daw-waveform> for waveform tracks', async ({ page }) => {
    await page.waitForSelector('daw-editor');
    // Wait for at least one daw-spectrogram-ready event
    await page.evaluate(() => new Promise<void>((resolve) => {
      const editor = document.getElementById('editor');
      editor?.addEventListener('daw-spectrogram-ready', () => resolve(), { once: true });
    }));

    const spectrogramCount = await page.locator('daw-spectrogram').count();
    expect(spectrogramCount).toBeGreaterThanOrEqual(3);   // 3 spectrogram tracks

    const waveformCount = await page.locator('daw-waveform').count();
    expect(waveformCount).toBeGreaterThanOrEqual(1);      // 1 waveform track (Bass)
  });

  test('color map change fires a fresh daw-spectrogram-ready event', async ({ page }) => {
    await page.waitForSelector('daw-spectrogram');
    // Wait for initial readiness
    await page.evaluate(() => new Promise<void>((resolve) => {
      const editor = document.getElementById('editor');
      editor?.addEventListener('daw-spectrogram-ready', () => resolve(), { once: true });
    }));

    // Set up listener for the next event before changing config
    const nextReady = page.evaluate(() => new Promise<string>((resolve) => {
      const editor = document.getElementById('editor');
      editor?.addEventListener('daw-spectrogram-ready', (e) => {
        resolve((e as CustomEvent).detail.trackId);
      }, { once: true });
    }));

    await page.selectOption('#colormap', 'viridis');

    const trackId = await Promise.race([
      nextReady,
      new Promise<string>((_, reject) =>
        setTimeout(() => reject(new Error('timeout')), 10000)
      ),
    ]);
    expect(trackId).toBeTruthy();
  });
});
```

Note: `OffscreenCanvas.transferControlToOffscreen()` makes the main-thread canvas inert. Pixel-content comparison from the main thread is unreliable; the second test asserts on the event signal instead.

- [ ] **Step 2: Run test**

```bash
pnpm -w run test e2e/dawcore-spectrogram.spec.ts --headed
```

Expected: both tests pass.

- [ ] **Step 3: Iterate if needed**

If a test is flaky, follow the patterns in CLAUDE.md "Preventing Flaky Tests":
- Use `await expect(locator).toBeVisible()` before `boundingBox()`
- Use `await expect(locator).toHaveCount(n)` for retrying assertions

- [ ] **Step 4: Commit**

```bash
git add e2e/dawcore-spectrogram.spec.ts
git commit -m "test(e2e): spectrogram render-mode integration"
```

---

## Task 19: Docs maintenance

**Files:**

- Modify: `TODO.md`
- Modify: `website/static/llms.txt`
- Modify: `website/docs/api/llm-reference.md`
- Modify: `PROJECT_STRUCTURE.md`
- Create: `packages/dawcore-spectrogram/CLAUDE.md`
- Modify: `packages/dawcore/CLAUDE.md` — add "Spectrogram" section
- Modify: `packages/spectrogram/CLAUDE.md` — update to reflect slim package

- [ ] **Step 1: Update TODO.md**

Add a "Recently completed" entry referencing this branch + spec.

- [ ] **Step 2: Update llms.txt**

Add `@dawcore/spectrogram` package description. Note `@waveform-playlist/spectrogram` is now slim (React surface only).

- [ ] **Step 3: Update llm-reference.md**

Add interfaces:
- `SpectrogramOrchestrator` (constructor + public methods)
- `SpectrogramController` (constructor + public methods)
- `DawSpectrogramElement` properties
- `editor.spectrogramConfig` / `track.spectrogramConfig` setter signature
- `DawSpectrogramReadyDetail` event detail
- `TrackRenderMode` updated union

- [ ] **Step 4: Update PROJECT_STRUCTURE.md**

Add `packages/dawcore-spectrogram/` to the package list with its responsibilities (framework-agnostic computation, worker, orchestrator).

- [ ] **Step 5: Create `packages/dawcore-spectrogram/CLAUDE.md`**

Write per-package CLAUDE.md covering:
- Purpose (framework-agnostic computation + worker + orchestrator)
- Worker pool architecture (carried over from old spectrogram CLAUDE.md)
- Generation-based abort
- Lazy per-batch FFT
- Three-tier rendering (viewport / buffer / remaining)
- Contiguous chunk grouping
- API summary (orchestrator class, computation, worker subpath)
- Tests location: `packages/dawcore-spectrogram/__tests__/`

- [ ] **Step 6: Update `packages/dawcore/CLAUDE.md`**

Add a "Spectrogram" section covering:
- `TrackRenderMode = 'waveform' | 'piano-roll' | 'spectrogram'`
- `<daw-spectrogram>` element pattern (Shadow DOM, OffscreenCanvas transfer)
- `SpectrogramController` lazy lifecycle (created on first registerCanvas, disposed when no spectrogram tracks remain)
- `editor.spectrogramConfig` global + `track.spectrogramConfig` per-track override (v1 limitation: single config at a time)
- `daw-spectrogram-ready` event
- Worker factory pattern (`new URL` at call site for bundler support)

- [ ] **Step 7: Update `packages/spectrogram/CLAUDE.md`**

Update to reflect: orchestration now lives in `@dawcore/spectrogram`; Provider is a thin wrapper. Note backwards-compat re-exports.

- [ ] **Step 8: Build website to confirm docs render**

```bash
pnpm --filter website build
```

Expected: PASS (CSS calc warnings pre-existing, harmless).

- [ ] **Step 9: Commit**

```bash
git add TODO.md website packages/dawcore packages/dawcore-spectrogram packages/spectrogram PROJECT_STRUCTURE.md
git commit -m "docs: spectrogram render-mode + dawcore-spectrogram package"
```

---

## Final verification

After all tasks complete:

- [ ] **Run full root build**

```bash
pnpm build
```

Expected: all packages build clean (browser, core, engine, playout, dawcore, dawcore-spectrogram, spectrogram, recording, annotations, worklets, ui-components, transport).

- [ ] **Run full lint**

```bash
pnpm lint
```

Expected: clean.

- [ ] **Run all unit tests**

```bash
pnpm -r test
```

Expected: all per-package vitest suites pass.

- [ ] **Run E2E tests**

```bash
pnpm -w run test
```

Expected: existing E2E suite + new dawcore-spectrogram tests pass.

- [ ] **Manual smoke test of all 3 demo pages**

1. `pnpm example:dawcore-native` → `localhost:5173/spectrogram.html`
2. `pnpm example:dawcore-tone` → `localhost:5174/spectrogram.html`
3. `pnpm --filter website start` → MIR demo page

Confirm spectrograms render correctly in all three.

- [ ] **Get user approval before opening PR**

Per `feedback_never_merge_without_asking.md`: do not open the PR or squash-merge without explicit user approval.

- [ ] **Open PR (after approval)**

```bash
gh pr create --title "Spectrogram render-mode for dawcore + framework split" --body "$(cat <<'EOF'
## Summary
- Adds @dawcore/spectrogram (0.0.1) with framework-agnostic computation, worker, and SpectrogramOrchestrator
- Slims @waveform-playlist/spectrogram (12.0.0 → 12.1.0) to React-only surface; Provider wraps the orchestrator
- Adds render-mode="spectrogram" to <daw-track>, <daw-spectrogram> Lit element, SpectrogramController, editor.spectrogramConfig + track.spectrogramConfig, daw-spectrogram-ready event
- Two new demos: examples/dawcore-{native,tone}/spectrogram.html
- React MIR demo unchanged (same import path)

## Test plan
- [ ] Unit: dawcore-spectrogram orchestrator + viewport-classify + chunk-grouping + color-lut-cache tests pass
- [ ] Unit: dawcore daw-spectrogram + spectrogram-controller tests pass
- [ ] Unit: spectrogram Provider→Orchestrator boundary tests pass
- [ ] Smoke: native spectrogram demo renders colored frequency content
- [ ] Smoke: tone spectrogram demo renders colored frequency content
- [ ] Smoke: MIR demo (React) renders identically to main branch
- [ ] E2E: daw-spectrogram elements present per channel; daw-spectrogram-ready fires per track
EOF
)"
```

- [ ] **Squash-merge after PR approval**

```bash
gh pr merge --squash
```

---

## Notes for the executing agent

- **Task 7 Step 1** is the highest-risk unknown: the existing `createSpectrogramWorkerPool` may not accept `Worker[]`. Inspect first; refactor or adapt accordingly.
- **Task 10 Step 1** — read the existing `SpectrogramIntegrationContext` shape in `@waveform-playlist/browser` before rewriting the Provider. The spec says no browser changes; if the existing context needs new fields, surface to the user first.
- **Tasks 4, 5, 6** (pure-function tasks) are independent and can run in parallel.
- **Build before downstream typecheck** — every time you modify `@dawcore/spectrogram` source, downstream `pnpm typecheck` won't see changes until `pnpm --filter @dawcore/spectrogram build` runs (workspace types resolve via `dist/`). This is a major foot-gun.
- **Don't commit before user testing/approval** (per project preference). Each task ends with a commit step but the user reviews the diff first; ask before committing if uncertain.
- **No console.log** — use `console.warn('[dawcore-spectrogram] ...')` with string concatenation per project conventions.
- **In tests, prefer `replaceChildren()` over `innerHTML = ''`** to clear DOM (security hook blocks innerHTML).
