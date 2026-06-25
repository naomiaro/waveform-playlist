# Optional Playout Engines + Injectable `PlayoutAdapter` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@waveform-playlist/playout`, `@waveform-playlist/media-element-playout`, and `tone` optional for `@waveform-playlist/browser`, and let consumers inject a custom `PlayoutAdapter` / MediaElement playout — so a consumer can use one path or bring their own engine without installing or bundling the other.

**Architecture:** Extract the engine-loading decision into two small async resolver modules (`resolvePlayoutAdapter`, `resolveMediaElementPlayout`) that either call a consumer-supplied factory or **dynamically `import()`** the default engine with an install-hint rethrow (mirrors `@dawcore/midi`'s `loadMidiImpl`). The providers call the resolvers from their (already-async) effects. Removing the static engine imports from the provider's import graph + moving the engines to optional `peerDependencies` makes them optional at both install and bundle time. A source-scanning guard test locks the decoupling.

**Tech Stack:** TypeScript, React 18/19, vitest (node env, per-file `// @vitest-environment jsdom` where needed), tsup, pnpm workspaces.

## Global Constraints

- Target package: `@waveform-playlist/browser`, version **13.1.3 → 14.0.0** (breaking).
- Cross-package `peerDependencies` MUST use `workspace:^`, never `workspace:*` (enforced by `peerDependencies.test.ts`).
- Immutable updates only; functional components + hooks; `const` over `let` except where reassignment is required (e.g. the `cancelled` race flag).
- No `console.log` in shipped code. Diagnostics use `console.warn('[waveform-playlist] …')` with **string concatenation**, never object args.
- The provider's static import graph (the files listed in `staticEngineImports.test.ts`) must never statically import `tone` / `@waveform-playlist/playout` / `@waveform-playlist/media-element-playout`. `import type` and `await import()` are allowed.
- Tier-3 hooks (`useDynamicEffects`, `useTrackDynamicEffects`, `useAudioEffects`, `effectFactory`, `useExportWav`, `useOutputMeter`, `useAudioTracks`, `useAnnotationDragHandlers`, `useDynamicTracks`) stay Tone-coupled and out of scope — they are opt-in and tree-shakeable.
- Run package tests with: `cd packages/browser && npx vitest run`.
- Verify types per-package (root `pnpm typecheck` has a pre-existing unrelated failure in `dawcore-midi`): `cd packages/browser && pnpm typecheck`.
- Build before any publish/manual check: `pnpm --filter @waveform-playlist/browser build`.
- Lint from repo root before committing: `pnpm -w lint` (fix with `pnpm format`).
- Commit messages: `<type>: <description>`; NO `Co-Authored-By` footer (attribution disabled globally).

---

## File Structure

**Create**
- `packages/browser/src/playout/resolvePlayoutAdapter.ts` — async resolver for the WebAudio (`PlayoutAdapter`) engine.
- `packages/browser/src/playout/resolveMediaElementPlayout.ts` — async resolver for the MediaElement engine.
- `packages/browser/src/__tests__/resolvePlayoutAdapter.test.ts` — success + custom-factory bypass.
- `packages/browser/src/__tests__/resolvePlayoutAdapter.no-peer.test.ts` — missing-peer install hint.
- `packages/browser/src/__tests__/resolveMediaElementPlayout.test.ts` — success + custom-factory bypass.
- `packages/browser/src/__tests__/resolveMediaElementPlayout.no-peer.test.ts` — missing-peer install hint.
- `packages/browser/src/__tests__/optionalEngines.test.ts` — package.json optional-peer guard.
- `packages/browser/src/__tests__/staticEngineImports.test.ts` — source-graph decoupling guard.

**Modify**
- `packages/browser/package.json` — move engines to optional peers; `tone` optional; version bump.
- `packages/browser/src/WaveformPlaylistContext.tsx` — `createAdapter` prop; resolver; sample-rate provisional+reconcile; `getContext()` → `getAudioContextTime()`; expose `getAudioContextTime` on the animation context.
- `packages/browser/src/MediaElementPlaylistContext.tsx` — `createPlayout` prop; resolver; async init effect.
- `packages/browser/src/index.tsx` — remove the `Tone` re-export.
- `packages/browser/src/components/PlaylistVisualization.tsx` — consume `getAudioContextTime` from context (Tier 2).
- `packages/browser/CLAUDE.md` + docs (Task 8).

---

## Task 1: Make playout engines optional peer dependencies

**Files:**
- Test: `packages/browser/src/__tests__/optionalEngines.test.ts` (create)
- Modify: `packages/browser/package.json`

**Interfaces:**
- Produces: `@waveform-playlist/browser` declares `playout`, `media-element-playout`, and `tone` as **optional** `peerDependencies`.

- [ ] **Step 1: Write the failing test**

Create `packages/browser/src/__tests__/optionalEngines.test.ts`:

```ts
// Issue #510: both playout engines + tone must be OPTIONAL peer deps of
// @waveform-playlist/browser so consumers can use one path or bring their own
// PlayoutAdapter without installing the other engine.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const pkg = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'package.json'), 'utf8')
);

const OPTIONAL_ENGINES = [
  '@waveform-playlist/playout',
  '@waveform-playlist/media-element-playout',
  'tone',
];

describe('optional playout engines (#510)', () => {
  it('does not list the engines as hard dependencies', () => {
    const deps = pkg.dependencies ?? {};
    for (const name of OPTIONAL_ENGINES) {
      expect(deps).not.toHaveProperty(name);
    }
  });

  it('declares the engines as optional peerDependencies', () => {
    const peers = pkg.peerDependencies ?? {};
    const meta = pkg.peerDependenciesMeta ?? {};
    for (const name of OPTIONAL_ENGINES) {
      expect(peers).toHaveProperty(name);
      expect(meta[name]).toEqual({ optional: true });
    }
  });

  it('uses workspace:^ ranges for the sibling engine peers', () => {
    const peers = pkg.peerDependencies ?? {};
    expect(peers['@waveform-playlist/playout']).toBe('workspace:^');
    expect(peers['@waveform-playlist/media-element-playout']).toBe('workspace:^');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/browser && npx vitest run src/__tests__/optionalEngines.test.ts`
Expected: FAIL — engines are still in `dependencies`; `tone` peer has no `optional` meta.

- [ ] **Step 3: Edit `packages/browser/package.json`**

Remove these two lines from `dependencies`:

```json
    "@waveform-playlist/media-element-playout": "workspace:*",
    "@waveform-playlist/playout": "workspace:*",
```

In `peerDependencies`, add the two engine peers (keep the existing `tone` entry):

```json
    "@waveform-playlist/media-element-playout": "workspace:^",
    "@waveform-playlist/playout": "workspace:^",
```

Replace the `peerDependenciesMeta` block with:

```json
  "peerDependenciesMeta": {
    "@waveform-playlist/annotations": {
      "optional": true
    },
    "@waveform-playlist/media-element-playout": {
      "optional": true
    },
    "@waveform-playlist/playout": {
      "optional": true
    },
    "@waveform-playlist/recording": {
      "optional": true
    },
    "tone": {
      "optional": true
    }
  }
```

Bump the version field:

```json
  "version": "14.0.0",
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/browser && npx vitest run src/__tests__/optionalEngines.test.ts src/__tests__/peerDependencies.test.ts`
Expected: PASS (both files).

- [ ] **Step 5: Refresh the lockfile**

Run: `pnpm install`
Expected: updates `pnpm-lock.yaml` to reflect the dependency→peer move. CI uses `--frozen-lockfile`.

- [ ] **Step 6: Commit**

```bash
git add packages/browser/package.json packages/browser/src/__tests__/optionalEngines.test.ts pnpm-lock.yaml
git commit -m "feat(browser): make playout engines + tone optional peer deps (#510)"
```

---

## Task 2: `resolvePlayoutAdapter` module

**Files:**
- Create: `packages/browser/src/playout/resolvePlayoutAdapter.ts`
- Test: `packages/browser/src/__tests__/resolvePlayoutAdapter.test.ts`
- Test: `packages/browser/src/__tests__/resolvePlayoutAdapter.no-peer.test.ts`

**Interfaces:**
- Consumes: `PlayoutAdapter` (from `@waveform-playlist/engine`), `EffectsFunction` / `SoundFontCache` (types from `@waveform-playlist/playout`), and the dynamic module `@waveform-playlist/playout` (exports `createToneAdapter`, `configureGlobalContext`).
- Produces: `resolvePlayoutAdapter(opts: ResolvePlayoutAdapterOptions): Promise<PlayoutAdapter>` where
  ```ts
  interface ResolvePlayoutAdapterOptions {
    createAdapter?: () => PlayoutAdapter;
    effects?: EffectsFunction;
    soundFontCache?: SoundFontCache;
    sampleRate?: number;
  }
  ```

- [ ] **Step 1: Write the failing tests (success + bypass)**

Create `packages/browser/src/__tests__/resolvePlayoutAdapter.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

// A working stub for @waveform-playlist/playout. vi.hoisted so the mock factory
// (which is hoisted above imports) can reference these.
const h = vi.hoisted(() => {
  const adapter = { audioContext: { sampleRate: 48000 }, dispose: vi.fn() };
  return {
    adapter,
    createToneAdapter: vi.fn(() => adapter),
    configureGlobalContext: vi.fn(() => 48000),
  };
});

vi.mock('@waveform-playlist/playout', () => ({
  createToneAdapter: h.createToneAdapter,
  configureGlobalContext: h.configureGlobalContext,
}));

import { resolvePlayoutAdapter } from '../playout/resolvePlayoutAdapter';

beforeEach(() => {
  h.createToneAdapter.mockClear();
  h.configureGlobalContext.mockClear();
});

describe('resolvePlayoutAdapter', () => {
  it('returns the custom adapter without importing the default engine', async () => {
    const custom = { audioContext: { sampleRate: 44100 }, dispose: vi.fn() } as never;
    const result = await resolvePlayoutAdapter({ createAdapter: () => custom });
    expect(result).toBe(custom);
    expect(h.createToneAdapter).not.toHaveBeenCalled();
  });

  it('dynamically imports createToneAdapter when no factory is supplied', async () => {
    const fn = (() => {}) as never;
    const cache = {} as never;
    const result = await resolvePlayoutAdapter({ effects: fn, soundFontCache: cache });
    expect(result).toBe(h.adapter);
    expect(h.createToneAdapter).toHaveBeenCalledWith({ effects: fn, soundFontCache: cache });
  });

  it('configures the global context only when a sampleRate is provided', async () => {
    await resolvePlayoutAdapter({ sampleRate: 44100 });
    expect(h.configureGlobalContext).toHaveBeenCalledWith({ sampleRate: 44100 });

    h.configureGlobalContext.mockClear();
    await resolvePlayoutAdapter({});
    expect(h.configureGlobalContext).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/browser && npx vitest run src/__tests__/resolvePlayoutAdapter.test.ts`
Expected: FAIL — `Cannot find module '../playout/resolvePlayoutAdapter'`.

- [ ] **Step 3: Implement `resolvePlayoutAdapter`**

Create `packages/browser/src/playout/resolvePlayoutAdapter.ts`:

```ts
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { EffectsFunction, SoundFontCache } from '@waveform-playlist/playout';

/** Options for {@link resolvePlayoutAdapter}. */
export interface ResolvePlayoutAdapterOptions {
  /** Consumer-supplied factory. When present, the default engine is never imported. */
  createAdapter?: () => PlayoutAdapter;
  /** Master effects function — forwarded to the default Tone.js adapter only. */
  effects?: EffectsFunction;
  /** SoundFont cache — forwarded to the default Tone.js adapter only. */
  soundFontCache?: SoundFontCache;
  /** Desired AudioContext sample rate — configures the global Tone context (default path only). */
  sampleRate?: number;
}

const INSTALL_HINT =
  '@waveform-playlist/playout (and its peer `tone`) is required for the default WebAudio engine. ' +
  'Install with: npm install @waveform-playlist/playout tone — or pass a custom `createAdapter`.';

/**
 * Resolve a {@link PlayoutAdapter}. With `createAdapter`, returns its result and
 * never touches the default engine — so consumers with a custom adapter install
 * neither `@waveform-playlist/playout` nor `tone`. Otherwise dynamically imports
 * the Tone.js engine, rethrowing a friendly install hint (and console.warn-ing the
 * original error) when the optional peer is absent.
 */
export async function resolvePlayoutAdapter(
  opts: ResolvePlayoutAdapterOptions
): Promise<PlayoutAdapter> {
  if (opts.createAdapter) {
    return opts.createAdapter();
  }

  let mod: typeof import('@waveform-playlist/playout');
  try {
    mod = await import('@waveform-playlist/playout');
  } catch (originalErr) {
    console.warn(
      '[waveform-playlist] @waveform-playlist/playout dynamic import failed: ' + String(originalErr)
    );
    throw new Error(INSTALL_HINT);
  }

  if (opts.sampleRate !== undefined) {
    mod.configureGlobalContext({ sampleRate: opts.sampleRate });
  }
  return mod.createToneAdapter({ effects: opts.effects, soundFontCache: opts.soundFontCache });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/browser && npx vitest run src/__tests__/resolvePlayoutAdapter.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write the no-peer install-hint test**

Create `packages/browser/src/__tests__/resolvePlayoutAdapter.no-peer.test.ts`:

```ts
// Separate file: vi.doMock makes the dynamic import REJECT, simulating the
// optional peer not being installed. (Pattern mirrors dawcore's
// daw-editor-load-midi-no-peer.test.ts.)
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.doMock('@waveform-playlist/playout', () => {
  throw new Error("Cannot find module '@waveform-playlist/playout'");
});

import { resolvePlayoutAdapter } from '../playout/resolvePlayoutAdapter';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

describe('resolvePlayoutAdapter — @waveform-playlist/playout unavailable', () => {
  it('rejects with the friendly install hint', async () => {
    await expect(resolvePlayoutAdapter({})).rejects.toThrow(/npm install @waveform-playlist\/playout tone/);
  });

  it('console.warns the original module-resolution error', async () => {
    await expect(resolvePlayoutAdapter({})).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('[waveform-playlist] @waveform-playlist/playout dynamic import failed:')
    );
  });

  it('still bypasses the import when a custom adapter is supplied', async () => {
    const custom = { audioContext: { sampleRate: 44100 }, dispose: vi.fn() } as never;
    await expect(resolvePlayoutAdapter({ createAdapter: () => custom })).resolves.toBe(custom);
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/browser && npx vitest run src/__tests__/resolvePlayoutAdapter.no-peer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/browser/src/playout/resolvePlayoutAdapter.ts packages/browser/src/__tests__/resolvePlayoutAdapter.test.ts packages/browser/src/__tests__/resolvePlayoutAdapter.no-peer.test.ts
git commit -m "feat(browser): add resolvePlayoutAdapter (factory or dynamic Tone engine) (#510)"
```

---

## Task 3: `resolveMediaElementPlayout` module

**Files:**
- Create: `packages/browser/src/playout/resolveMediaElementPlayout.ts`
- Test: `packages/browser/src/__tests__/resolveMediaElementPlayout.test.ts`
- Test: `packages/browser/src/__tests__/resolveMediaElementPlayout.no-peer.test.ts`

**Interfaces:**
- Consumes: `MediaElementPlayout` (type from `@waveform-playlist/media-element-playout`); the dynamic module (exports class `MediaElementPlayout`).
- Produces: `resolveMediaElementPlayout(opts: ResolveMediaElementPlayoutOptions): Promise<MediaElementPlayout>` where
  ```ts
  interface ResolveMediaElementPlayoutOptions {
    createPlayout?: () => MediaElementPlayout;
    playbackRate?: number;
    preservesPitch?: boolean;
  }
  ```

- [ ] **Step 1: Write the failing tests (success + bypass)**

Create `packages/browser/src/__tests__/resolveMediaElementPlayout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const h = vi.hoisted(() => {
  const instance = { addTrack: vi.fn(), dispose: vi.fn() };
  const MediaElementPlayout = vi.fn(() => instance);
  return { instance, MediaElementPlayout };
});

vi.mock('@waveform-playlist/media-element-playout', () => ({
  MediaElementPlayout: h.MediaElementPlayout,
}));

import { resolveMediaElementPlayout } from '../playout/resolveMediaElementPlayout';

beforeEach(() => {
  h.MediaElementPlayout.mockClear();
});

describe('resolveMediaElementPlayout', () => {
  it('returns the custom playout without importing the default engine', async () => {
    const custom = { addTrack: vi.fn(), dispose: vi.fn() } as never;
    const result = await resolveMediaElementPlayout({ createPlayout: () => custom });
    expect(result).toBe(custom);
    expect(h.MediaElementPlayout).not.toHaveBeenCalled();
  });

  it('dynamically constructs MediaElementPlayout with options when no factory is supplied', async () => {
    const result = await resolveMediaElementPlayout({ playbackRate: 1.5, preservesPitch: false });
    expect(result).toBe(h.instance);
    expect(h.MediaElementPlayout).toHaveBeenCalledWith({ playbackRate: 1.5, preservesPitch: false });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/browser && npx vitest run src/__tests__/resolveMediaElementPlayout.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `resolveMediaElementPlayout`**

Create `packages/browser/src/playout/resolveMediaElementPlayout.ts`:

```ts
import type { MediaElementPlayout } from '@waveform-playlist/media-element-playout';

/** Options for {@link resolveMediaElementPlayout}. */
export interface ResolveMediaElementPlayoutOptions {
  /** Consumer-supplied factory. When present, the default engine is never imported. */
  createPlayout?: () => MediaElementPlayout;
  /** Initial playback rate forwarded to the default engine. */
  playbackRate?: number;
  /** Whether to preserve pitch on rate change (default engine only). */
  preservesPitch?: boolean;
}

const INSTALL_HINT =
  '@waveform-playlist/media-element-playout is required for the default MediaElement engine. ' +
  'Install with: npm install @waveform-playlist/media-element-playout — or pass a custom `createPlayout`.';

/**
 * Resolve a MediaElement playout. With `createPlayout`, returns its result and
 * never imports the default engine. Otherwise dynamically imports
 * `@waveform-playlist/media-element-playout`, rethrowing a friendly install hint
 * (and console.warn-ing the original error) when the optional peer is absent.
 */
export async function resolveMediaElementPlayout(
  opts: ResolveMediaElementPlayoutOptions
): Promise<MediaElementPlayout> {
  if (opts.createPlayout) {
    return opts.createPlayout();
  }

  let mod: typeof import('@waveform-playlist/media-element-playout');
  try {
    mod = await import('@waveform-playlist/media-element-playout');
  } catch (originalErr) {
    console.warn(
      '[waveform-playlist] @waveform-playlist/media-element-playout dynamic import failed: ' +
        String(originalErr)
    );
    throw new Error(INSTALL_HINT);
  }

  return new mod.MediaElementPlayout({
    playbackRate: opts.playbackRate,
    preservesPitch: opts.preservesPitch,
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/browser && npx vitest run src/__tests__/resolveMediaElementPlayout.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the no-peer install-hint test**

Create `packages/browser/src/__tests__/resolveMediaElementPlayout.no-peer.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.doMock('@waveform-playlist/media-element-playout', () => {
  throw new Error("Cannot find module '@waveform-playlist/media-element-playout'");
});

import { resolveMediaElementPlayout } from '../playout/resolveMediaElementPlayout';

let warnSpy: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warnSpy.mockRestore());

describe('resolveMediaElementPlayout — package unavailable', () => {
  it('rejects with the friendly install hint', async () => {
    await expect(resolveMediaElementPlayout({})).rejects.toThrow(
      /npm install @waveform-playlist\/media-element-playout/
    );
  });

  it('console.warns the original module-resolution error', async () => {
    await expect(resolveMediaElementPlayout({})).rejects.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        '[waveform-playlist] @waveform-playlist/media-element-playout dynamic import failed:'
      )
    );
  });

  it('still bypasses the import when a custom playout is supplied', async () => {
    const custom = { addTrack: vi.fn(), dispose: vi.fn() } as never;
    await expect(resolveMediaElementPlayout({ createPlayout: () => custom })).resolves.toBe(custom);
  });
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd packages/browser && npx vitest run src/__tests__/resolveMediaElementPlayout.no-peer.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 7: Commit**

```bash
git add packages/browser/src/playout/resolveMediaElementPlayout.ts packages/browser/src/__tests__/resolveMediaElementPlayout.test.ts packages/browser/src/__tests__/resolveMediaElementPlayout.no-peer.test.ts
git commit -m "feat(browser): add resolveMediaElementPlayout (factory or dynamic engine) (#510)"
```

---

## Task 4: Wire `WaveformPlaylistContext` + create the static-graph guard

**Files:**
- Test: `packages/browser/src/__tests__/staticEngineImports.test.ts` (create)
- Modify: `packages/browser/src/WaveformPlaylistContext.tsx`

**Interfaces:**
- Consumes: `resolvePlayoutAdapter` (Task 2); `PlayoutAdapter` (already imported from `@waveform-playlist/engine` at line 20).
- Produces: `WaveformPlaylistProviderProps.createAdapter?: () => PlayoutAdapter`; `PlaybackAnimationContextValue.getAudioContextTime: () => number`.

- [ ] **Step 1: Write the guard test (will fail RED)**

Create `packages/browser/src/__tests__/staticEngineImports.test.ts`:

```ts
// Issue #510: the provider/render static import graph must never STATICALLY
// (non-type) import the optional engines or tone. `import type` and dynamic
// `import()` are allowed. This guards criteria 2 (MediaElement-only) and 3
// (custom adapter) at the source level.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'WaveformPlaylistContext.tsx',
  'playout/resolvePlayoutAdapter.ts',
  'playout/resolveMediaElementPlayout.ts',
];

const FORBIDDEN = ['tone', '@waveform-playlist/playout', '@waveform-playlist/media-element-playout'];

// `import (type)? ... from '<spec>'` (multi-line bodies via [\s\S]*?) plus
// side-effect `import '<spec>'`. Dynamic import() / typeof import() have no
// `from` and no `import<space><quote>`, so they are not matched.
const IMPORT_RE = /import\s+(type\s+)?[\s\S]*?from\s+['"]([^'"]+)['"]/g;
const SIDE_EFFECT_RE = /import\s+(['"])([^'"]+)\1/g;

function staticRuntimeSpecifiers(source: string): string[] {
  const specs: string[] = [];
  let m: RegExpExecArray | null;
  IMPORT_RE.lastIndex = 0;
  while ((m = IMPORT_RE.exec(source))) {
    if (!m[1]) specs.push(m[2]); // m[1] === 'type ' → type-only import, skip
  }
  SIDE_EFFECT_RE.lastIndex = 0;
  while ((m = SIDE_EFFECT_RE.exec(source))) {
    specs.push(m[2]);
  }
  return specs;
}

describe('provider static import graph stays engine-free (#510)', () => {
  for (const rel of FILES) {
    it(`${rel}: no static (non-type) import of tone/playout/media-element-playout`, () => {
      const source = readFileSync(join(srcDir, rel), 'utf8');
      const offenders = staticRuntimeSpecifiers(source).filter((s) => FORBIDDEN.includes(s));
      expect(offenders).toEqual([]);
    });
  }
});
```

- [ ] **Step 2: Run guard test to verify WaveformPlaylistContext fails**

Run: `cd packages/browser && npx vitest run src/__tests__/staticEngineImports.test.ts`
Expected: FAIL on `WaveformPlaylistContext.tsx` (static imports of `@waveform-playlist/playout` and `tone`). The two resolver files PASS.

- [ ] **Step 3: Convert the playout import to type-only and drop the tone import**

In `packages/browser/src/WaveformPlaylistContext.tsx`, replace lines 12–19:

```ts
import {
  configureGlobalContext,
  createToneAdapter,
  getGlobalAudioContext,
  type EffectsFunction,
  type TrackEffectsFunction,
  type SoundFontCache,
} from '@waveform-playlist/playout';
```

with:

```ts
import type {
  EffectsFunction,
  TrackEffectsFunction,
  SoundFontCache,
} from '@waveform-playlist/playout';
import { resolvePlayoutAdapter } from './playout/resolvePlayoutAdapter';
```

Delete line 32 entirely:

```ts
import { getContext } from 'tone';
```

- [ ] **Step 4: Add the `createAdapter` prop**

In `WaveformPlaylistProviderProps` (after the `sampleRate?: number;` field, before `children`), add:

```ts
  /** Factory for a custom PlayoutAdapter. When omitted, the Tone.js engine
   *  (@waveform-playlist/playout) is dynamically imported — so a custom adapter
   *  lets a consumer use neither @waveform-playlist/playout nor tone. Called once
   *  per engine rebuild; the provider owns and disposes the returned instance.
   *  Pass a stable reference (module-level or useCallback) — it is read directly
   *  inside the curated `loadAudio` effect, not via its dependency array. */
  createAdapter?: () => PlayoutAdapter;
```

Add `createAdapter,` to the destructured props in the component signature (alongside `effects,` near the top of the `({ … })` list).

- [ ] **Step 5: Make the mount-time sample rate provisional**

Replace the `initialSampleRate` initializer (lines 427–444) with:

```ts
  // Provisional sample rate until the adapter (which owns the AudioContext) is
  // created in loadAudio. Reconciled from adapter.audioContext.sampleRate there.
  // (#510: avoids a static @waveform-playlist/playout import at mount.)
  const [initialSampleRate] = useState<number>(() => sampleRateProp ?? 48000);
```

- [ ] **Step 6: Resolve the adapter via the resolver, with a cancel guard**

In the `loadAudio` effect, add a cancel flag immediately before `const loadAudio = async () => {` (line 729):

```ts
    let cancelled = false;
```

Replace the adapter creation line (789):

```ts
        const adapter = createToneAdapter({ effects, soundFontCache: soundFontCacheRef.current });
```

with:

```ts
        const adapter = await resolvePlayoutAdapter({
          createAdapter,
          effects,
          soundFontCache: soundFontCacheRef.current,
          sampleRate: sampleRateProp,
        });
        if (cancelled) {
          adapter.dispose();
          return;
        }
        // Reconcile sample rate from the adapter's own AudioContext. The setState
        // calls later in loadAudio trigger a re-render that propagates this via
        // `const sampleRate = sampleRateRef.current` at render.
        sampleRateRef.current = adapter.audioContext.sampleRate;
```

In the effect cleanup (the `return () => { … }` at line 878), add `cancelled = true;` as the first statement inside the cleanup function:

```ts
    return () => {
      cancelled = true;
```

- [ ] **Step 7: Add the `getAudioContextTime` helper and replace the four `getContext()` reads**

Immediately before the `getPlaybackTime` definition (line 1043, `const getPlaybackTime = useCallback(...)`), add:

```ts
  // Audio clock from the adapter's own AudioContext (#510 — replaces tone's
  // getContext()). Stable; reads a ref so identity never changes.
  const getAudioContextTime = useCallback(
    () => adapterRef.current?.audioContext.currentTime ?? 0,
    []
  );
```

Inside `getPlaybackTime`, change the elapsed line (1055):

```ts
    const elapsed = getContext().currentTime - (playbackStartTimeRef.current ?? 0);
```

to:

```ts
    const elapsed = getAudioContextTime() - (playbackStartTimeRef.current ?? 0);
```

and add `getAudioContextTime` to `getPlaybackTime`'s dependency array (change `}, []);` at the end of that `useCallback` to `}, [getAudioContextTime]);`).

At the three `const context = getContext();` sites (≈ lines 1236, 1266, 1312), replace each pair of lines, e.g.:

```ts
          const context = getContext();
          const timeNow = context.currentTime;
```

with:

```ts
          const timeNow = getAudioContextTime();
```

(For the line-1312 site the local is named `startTimeNow` — keep that name: `const startTimeNow = getAudioContextTime();`.)

- [ ] **Step 8: Expose `getAudioContextTime` on the animation context**

In `PlaybackAnimationContextValue` (interface around line 96), add after `getPlaybackTime: () => number;` (line 111):

```ts
  /** Current time of the adapter's AudioContext, in seconds. */
  getAudioContextTime: () => number;
```

In the `animationValue` memo (lines 1514–1534), add `getAudioContextTime,` to BOTH the returned object and the dependency array (next to the existing `getPlaybackTime,` entries).

- [ ] **Step 9: Verify — guard, typecheck, full suite**

At this point the guard `FILES` array contains only `WaveformPlaylistContext.tsx` + the two resolvers.

Run: `cd packages/browser && npx vitest run src/__tests__/staticEngineImports.test.ts && pnpm typecheck`
Expected: guard test PASS for `WaveformPlaylistContext.tsx` + both resolvers; `pnpm typecheck` PASS.

Then run the full suite to catch regressions:
Run: `cd packages/browser && npx vitest run`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add packages/browser/src/WaveformPlaylistContext.tsx packages/browser/src/__tests__/staticEngineImports.test.ts
git commit -m "feat(browser): inject createAdapter + dynamic Tone engine in WaveformPlaylistProvider (#510)"
```

---

## Task 5: Wire `MediaElementPlaylistContext`

**Files:**
- Modify: `packages/browser/src/MediaElementPlaylistContext.tsx`
- Modify: `packages/browser/src/__tests__/staticEngineImports.test.ts` (append filename)

**Interfaces:**
- Consumes: `resolveMediaElementPlayout` (Task 3); `MediaElementPlayout` (type).
- Produces: `MediaElementPlaylistProviderProps.createPlayout?: () => MediaElementPlayout`.

- [ ] **Step 1: Extend the guard test (RED)**

In `staticEngineImports.test.ts`, add `'MediaElementPlaylistContext.tsx',` to the `FILES` array (after `'WaveformPlaylistContext.tsx',`).

- [ ] **Step 2: Run guard to verify it fails**

Run: `cd packages/browser && npx vitest run src/__tests__/staticEngineImports.test.ts`
Expected: FAIL on `MediaElementPlaylistContext.tsx` (static `MediaElementPlayout` value import).

- [ ] **Step 3: Convert the engine import to type-only + add the resolver import**

In `packages/browser/src/MediaElementPlaylistContext.tsx`, replace line 12:

```ts
import { MediaElementPlayout, type FadeConfig } from '@waveform-playlist/media-element-playout';
```

with:

```ts
import type { MediaElementPlayout, FadeConfig } from '@waveform-playlist/media-element-playout';
import { resolveMediaElementPlayout } from './playout/resolveMediaElementPlayout';
```

- [ ] **Step 4: Add the `createPlayout` prop**

In `MediaElementPlaylistProviderProps` (after `onReady?: () => void;`, before `children`), add:

```ts
  /** Factory for a custom MediaElement playout. When omitted, the bundled engine
   *  (@waveform-playlist/media-element-playout) is dynamically imported. */
  createPlayout?: () => MediaElementPlayout;
```

Add `createPlayout,` to the destructured props in the component signature (alongside `onReady,`).

- [ ] **Step 5: Make the init effect async with a cancel guard**

Replace the init effect body (lines 250–289 — from `const playout = new MediaElementPlayout({` through `playout.dispose();` in the cleanup). Replace this:

```ts
    const playout = new MediaElementPlayout({
      playbackRate: initialPlaybackRate,
      preservesPitch,
    });

    playout.addTrack({
      source: track.source,
      peaks: track.waveformData,
      name: track.name,
      audioContext,
      fadeIn: track.fadeIn,
      fadeOut: track.fadeOut,
    });

    // Set up time update callback
    const mediaTrack = playout.getTrack(playout['track']?.id ?? '');
    if (mediaTrack) {
      mediaTrack.setOnTimeUpdateCallback((time) => {
        currentTimeRef.current = time;
      });
    }

    // Set up playback complete callback
    playout.setOnPlaybackComplete(() => {
      stopAnimationFrameLoop();
      setIsPlaying(false);
      setActiveAnnotationId(null);
      currentTimeRef.current = 0;
      setCurrentTime(0);
    });

    playoutRef.current = playout;
    setDuration(track.waveformData.duration);
    onReady?.();

    return () => {
      stopAnimationFrameLoop();
      playout.dispose();
    };
```

with:

```ts
    let cancelled = false;
    let createdPlayout: MediaElementPlayout | null = null;

    (async () => {
      let playout: MediaElementPlayout;
      try {
        playout = await resolveMediaElementPlayout({
          createPlayout,
          playbackRate: initialPlaybackRate,
          preservesPitch,
        });
      } catch (err) {
        console.warn('[waveform-playlist] MediaElement playout failed to load: ' + String(err));
        return;
      }
      if (cancelled) {
        playout.dispose();
        return;
      }
      createdPlayout = playout;

      playout.addTrack({
        source: track.source,
        peaks: track.waveformData,
        name: track.name,
        audioContext,
        fadeIn: track.fadeIn,
        fadeOut: track.fadeOut,
      });

      // Set up time update callback
      const mediaTrack = playout.getTrack(playout['track']?.id ?? '');
      if (mediaTrack) {
        mediaTrack.setOnTimeUpdateCallback((time) => {
          currentTimeRef.current = time;
        });
      }

      // Set up playback complete callback
      playout.setOnPlaybackComplete(() => {
        stopAnimationFrameLoop();
        setIsPlaying(false);
        setActiveAnnotationId(null);
        currentTimeRef.current = 0;
        setCurrentTime(0);
      });

      playoutRef.current = playout;
      setDuration(track.waveformData.duration);
      onReady?.();
    })();

    return () => {
      cancelled = true;
      stopAnimationFrameLoop();
      if (createdPlayout) {
        createdPlayout.dispose();
      }
      playoutRef.current = null;
    };
```

Add `createPlayout` to the effect's dependency array (the array ending at line 302, after `setActiveAnnotationId,`):

```ts
    createPlayout,
```

- [ ] **Step 6: Run guard + typecheck + tests**

Run: `cd packages/browser && npx vitest run src/__tests__/staticEngineImports.test.ts && pnpm typecheck && npx vitest run`
Expected: guard PASS (now includes MediaElementPlaylistContext); typecheck PASS; full suite PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/browser/src/MediaElementPlaylistContext.tsx packages/browser/src/__tests__/staticEngineImports.test.ts
git commit -m "feat(browser): inject createPlayout + dynamic engine in MediaElementPlaylistProvider (#510)"
```

---

## Task 6: Remove the `Tone` re-export from the entry

**Files:**
- Modify: `packages/browser/src/index.tsx`
- Modify: `packages/browser/src/__tests__/staticEngineImports.test.ts` (append filename)

**Interfaces:**
- Produces: `@waveform-playlist/browser` no longer re-exports `Tone` (breaking — 14.0.0).

- [ ] **Step 1: Extend the guard test (RED)**

In `staticEngineImports.test.ts`, add `'index.tsx',` to the `FILES` array.

- [ ] **Step 2: Run guard to verify it fails**

Run: `cd packages/browser && npx vitest run src/__tests__/staticEngineImports.test.ts`
Expected: FAIL on `index.tsx` (`import * as Tone from 'tone'`).

- [ ] **Step 3: Remove the re-export**

In `packages/browser/src/index.tsx`, delete lines 1–3:

```ts
// Re-export Tone.js for convenience
import * as Tone from 'tone';
export { Tone };
```

(Leave the type-only `export type { EffectsFunction, TrackEffectsFunction } from '@waveform-playlist/playout';` on line 6 — it is erased.)

- [ ] **Step 4: Run guard + typecheck + tests**

Run: `cd packages/browser && npx vitest run src/__tests__/staticEngineImports.test.ts && pnpm typecheck && npx vitest run`
Expected: guard PASS (includes index.tsx); typecheck PASS; full suite PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/browser/src/index.tsx packages/browser/src/__tests__/staticEngineImports.test.ts
git commit -m "feat(browser)!: remove Tone re-export from entry — import from 'tone' directly (#510)"
```

---

## Task 7: Tier 2 — `PlaylistVisualization` reads the clock from context

**Files:**
- Modify: `packages/browser/src/components/PlaylistVisualization.tsx`
- Modify: `packages/browser/src/__tests__/staticEngineImports.test.ts` (append filename)

**Interfaces:**
- Consumes: `getAudioContextTime` from `usePlaybackAnimation()` (added in Task 4).

- [ ] **Step 1: Extend the guard test (RED)**

In `staticEngineImports.test.ts`, add `'components/PlaylistVisualization.tsx',` to the `FILES` array.

- [ ] **Step 2: Run guard to verify it fails**

Run: `cd packages/browser && npx vitest run src/__tests__/staticEngineImports.test.ts`
Expected: FAIL on `components/PlaylistVisualization.tsx` (`getGlobalAudioContext` from `@waveform-playlist/playout`).

- [ ] **Step 3: Remove the playout import**

In `packages/browser/src/components/PlaylistVisualization.tsx`, delete line 4:

```ts
import { getGlobalAudioContext } from '@waveform-playlist/playout';
```

- [ ] **Step 4: Consume `getAudioContextTime` from context**

In the `CustomPlayhead` component, add `getAudioContextTime` to the `usePlaybackAnimation()` destructure (the block ending at line 121 with `getPlaybackTime,`):

```ts
    getPlaybackTime,
    getAudioContextTime,
  } = usePlaybackAnimation();
```

Replace the inline clock (line 138):

```ts
    getAudioContextTime: () => getGlobalAudioContext().currentTime,
```

with:

```ts
    getAudioContextTime,
```

- [ ] **Step 5: Run guard + typecheck + tests**

Run: `cd packages/browser && npx vitest run src/__tests__/staticEngineImports.test.ts && pnpm typecheck && npx vitest run`
Expected: guard PASS (all 6 files); typecheck PASS; full suite PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/browser/src/components/PlaylistVisualization.tsx packages/browser/src/__tests__/staticEngineImports.test.ts
git commit -m "feat(browser): PlaylistVisualization reads audio clock from context, not playout (#510)"
```

---

## Task 8: Documentation

**Files:**
- Modify: `packages/browser/CLAUDE.md`
- Modify: `README.md` (root)
- Modify: `website/static/llms.txt`
- Modify: `website/docs/api/llm-reference.md`
- Modify: `website/docs/api/hooks.md`

- [ ] **Step 1: Add a section to `packages/browser/CLAUDE.md`**

Append this section (place it near the top-level architecture notes):

```markdown
## Optional Playout Engines (#510)

`@waveform-playlist/playout`, `@waveform-playlist/media-element-playout`, and `tone` are
**optional `peerDependencies`**. The providers load the default engine via dynamic
`import()` through `src/playout/resolvePlayoutAdapter.ts` / `resolveMediaElementPlayout.ts`
(factory-or-dynamic, install-hint rethrow — the `@dawcore/midi` `loadMidiImpl` pattern).

- `WaveformPlaylistProvider` accepts `createAdapter?: () => PlayoutAdapter`. When supplied,
  neither `@waveform-playlist/playout` nor `tone` is imported.
- `MediaElementPlaylistProvider` accepts `createPlayout?: () => MediaElementPlayout`.
- **The provider static import graph must stay engine-free** — enforced by
  `src/__tests__/staticEngineImports.test.ts`. Use `import type` for engine types and
  `await import()` for engine values. Adding a static engine import to those files fails CI.
- **Tier-3 boundary:** effects/export/meter/`useAudioTracks`/dynamic-tracks hooks remain
  Tone-coupled. They are opt-in and tree-shaken when unused, so they do not pull `tone` into
  the provider graph. (`useAudioTracks` decoupling is a follow-up.)
- **Sample rate at mount** is provisional (`sampleRate` prop or 48000) and reconciled from
  `adapter.audioContext.sampleRate` on first `loadAudio`. A Tone consumer at 44100 Hz that
  passes no `sampleRate` prop sees 48000 for the brief pre-first-load window.
- **Removed in 14.0.0:** the `Tone` convenience re-export. Import `tone` directly.
```

- [ ] **Step 2: Update root `README.md`**

Find the install/usage section for `@waveform-playlist/browser` and add an install note (place near the existing install instructions):

```markdown
> **v14:** the playout engines are optional peers. Install the one(s) you use:
> - WebAudio/Tone path: `npm install @waveform-playlist/browser @waveform-playlist/playout tone`
> - MediaElement path: `npm install @waveform-playlist/browser @waveform-playlist/media-element-playout`
> - Custom adapter: `npm install @waveform-playlist/browser` and pass `createAdapter` (no `tone`).
>
> The `Tone` convenience re-export was removed in v14 — `import * as Tone from 'tone'` directly.
```

- [ ] **Step 3: Update `website/static/llms.txt`**

In the `@waveform-playlist/browser` description, add a sentence: "Playout engines (`@waveform-playlist/playout` + `tone`, or `@waveform-playlist/media-element-playout`) are optional peer dependencies; provide `createAdapter`/`createPlayout` to inject a custom engine."

- [ ] **Step 4: Update `website/docs/api/llm-reference.md` and `website/docs/api/hooks.md`**

Add the two new props to the documented `WaveformPlaylistProviderProps` / `MediaElementPlaylistProviderProps` interfaces:

```ts
createAdapter?: () => PlayoutAdapter;   // WaveformPlaylistProvider
createPlayout?: () => MediaElementPlayout; // MediaElementPlaylistProvider
```

Remove any reference to `import { Tone } from '@waveform-playlist/browser'` and replace with `import * as Tone from 'tone'`.

- [ ] **Step 5: Verify docs build**

Run: `pnpm --filter website build`
Expected: builds (pre-existing CSS calc warnings are harmless). Fix any broken-link errors the checker reports.

- [ ] **Step 6: Commit**

```bash
git add packages/browser/CLAUDE.md README.md website/static/llms.txt website/docs/api/llm-reference.md website/docs/api/hooks.md
git commit -m "docs: optional playout engines + createAdapter/createPlayout, drop Tone re-export (#510)"
```

---

## Task 9: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the touched packages**

Run: `cd packages/browser && pnpm typecheck`
Expected: PASS (root `pnpm typecheck` has a pre-existing unrelated `dawcore-midi` failure — verify per-package instead).

- [ ] **Step 2: Lint from repo root**

Run: `pnpm -w lint`
Expected: PASS. If formatting fails, run `pnpm format` and re-commit.

- [ ] **Step 3: Build the browser package**

Run: `pnpm --filter @waveform-playlist/browser build`
Expected: builds; emits ESM + CJS + DTS. Confirm `dist/index.mjs` contains `import(` (dynamic) for the engines and NO top-level `from "tone"` / `from "@waveform-playlist/playout"`:

Run: `grep -n "@waveform-playlist/playout\|from \"tone\"\|from 'tone'" packages/browser/dist/index.mjs | head`
Expected: any matches are inside `import(...)` (dynamic) or comments — no top-level static `import … from`.

- [ ] **Step 4: Full browser test suite**

Run: `cd packages/browser && npx vitest run`
Expected: all PASS. Then check for stray vitest processes: `pgrep -f vitest` (kill with `pkill -f vitest` if any linger).

- [ ] **Step 5: Acceptance criteria self-check (manual confirmation)**

Confirm against the spec:
- WebAudio-only: `optionalEngines.test.ts` + `staticEngineImports.test.ts` prove `media-element-playout` is not forced/static. ✓
- MediaElement-only: same tests prove `playout`/`tone` are optional + absent from the MediaElement static graph. ✓
- Custom-playout: `resolvePlayoutAdapter` bypass test + `staticEngineImports` prove no engine/tone import on the custom-adapter path. ✓
- Guard tests present per path. ✓

- [ ] **Step 6: Push the branch (no PR yet — see handoff)**

```bash
git push -u origin feat/510-optional-playout-engines
```

---

## Pre-PR cleanup (do at finish, not during tasks)

Per project convention, `git rm` the spec and this plan from the branch before the PR merges — the PR description carries the durable summary:

```bash
git rm docs/specs/2026-06-24-optional-playout-engines-design.md docs/plans/2026-06-24-optional-playout-engines.md
git commit -m "chore: remove working design+plan docs (#510)"
```

Also: open the follow-up issue for `useAudioTracks` Tone decoupling (Tier 3), and audit peer ranges on packages that depend on `@waveform-playlist/browser` before any publish (publishing itself is out of scope).
