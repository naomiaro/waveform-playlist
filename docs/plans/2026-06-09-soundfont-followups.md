# SoundFont Follow-ups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Spec:** `docs/specs/2026-06-09-soundfont-followups-design.md`

**Goal:** Add `SoundFontCache.fromUrl()` (async factory that only resolves loaded) and `isToneAdapter()` (exported type guard), adopt the guard in the browser package, and switch docs/example to the factory.

**Architecture:** Pure additions to `@waveform-playlist/playout` — `fromUrl` composes the existing constructor + `load()`; `isToneAdapter` is the structural capability check currently inlined in `packages/browser/src/soundFontSync.ts`, which then imports it. No engine changes, no breaking changes.

**Tech Stack:** TypeScript, Vitest (node env — see gotchas below), tsup.

**Working branch:** `feat/soundfont-followups` (created; spec committed).

**Environment gotchas the engineer must know:**

- Playout/browser unit tests run in a **node** environment. `OfflineAudioContext` does not exist there, so `new SoundFontCache()` without a context throws — the new fromUrl test file must `vi.stubGlobal('OfflineAudioContext', ...)`. This is also why the existing `SoundFontCache.test.ts` only tests pure helpers; put fromUrl tests in a **separate new file** so its `vi.mock('soundfont2')` doesn't break the existing tests' real `GeneratorType` import.
- `packages/browser/src/soundFontSync.ts` currently uses only `import type` from `@waveform-playlist/playout` — type imports are erased at compile time. Importing the **value** `isToneAdapter` makes the browser test load the playout barrel at runtime, which imports Tone.js → crashes in the node test env. The test file therefore mocks `@waveform-playlist/playout` (see Task 3). The real guard logic is tested in playout's own suite.
- `pnpm typecheck` resolves workspace deps via `dist/` — **build playout before browser typecheck**: `pnpm --filter @waveform-playlist/playout build`.
- Run tests from each package dir (`cd packages/playout && npx vitest run`); afterwards `pkill -f vitest` (ok if none). `pnpm lint` from repo root before every commit (`pnpm format` to fix).
- Repo-wide `pnpm typecheck` fails on `main` in `packages/dawcore-midi` (pre-existing, documented in root CLAUDE.md) — not yours to fix.

---

### Task 1: `SoundFontCache.fromUrl()` (TDD)

**Files:**
- Test: Create `packages/playout/src/__tests__/SoundFontCache.fromUrl.test.ts`
- Modify: `packages/playout/src/SoundFontCache.ts` (class starts ~line 199; `load()` at ~line 218)

- [ ] **Step 1: Write the failing tests**

Create `packages/playout/src/__tests__/SoundFontCache.fromUrl.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Parsing arbitrary bytes with the real soundfont2 parser throws, so mock it.
// Kept in its own file: SoundFontCache.test.ts imports the REAL GeneratorType.
vi.mock('soundfont2', () => ({
  SoundFont2: vi.fn().mockImplementation(() => ({})),
}));

import { SoundFontCache } from '../SoundFontCache';

function okResponse(): Response {
  return {
    ok: true,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  } as unknown as Response;
}

describe('SoundFontCache.fromUrl', () => {
  beforeEach(() => {
    // Node has no OfflineAudioContext; the no-context constructor path needs it.
    vi.stubGlobal('OfflineAudioContext', vi.fn().mockImplementation(() => ({})));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('resolves to a cache that is already loaded', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);

    const cache = await SoundFontCache.fromUrl('/media/soundfont/A320U.sf2');

    expect(cache).toBeInstanceOf(SoundFontCache);
    expect(cache.isLoaded).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith('/media/soundfont/A320U.sf2', {
      signal: undefined,
    });
  });

  it('rejects when the fetch fails (no half-loaded cache escapes)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: false, statusText: 'Not Found' } as unknown as Response)
    );

    await expect(SoundFontCache.fromUrl('/missing.sf2')).rejects.toThrow(
      'Failed to fetch SoundFont /missing.sf2: Not Found'
    );
  });

  it('forwards the abort signal to fetch', async () => {
    const fetchMock = vi.fn().mockResolvedValue(okResponse());
    vi.stubGlobal('fetch', fetchMock);
    const controller = new AbortController();

    await SoundFontCache.fromUrl('/a.sf2', { signal: controller.signal });

    expect(fetchMock).toHaveBeenCalledWith('/a.sf2', { signal: controller.signal });
  });

  it('passes a provided context through to the constructor', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(okResponse()));
    const ctx = { sampleRate: 48000 } as unknown as BaseAudioContext;

    const cache = await SoundFontCache.fromUrl('/a.sf2', { context: ctx });

    // White-box: context is private; reach in rather than exercising the full
    // getAudioBuffer pipeline, which needs real SF2 sample data.
    expect((cache as unknown as { context: BaseAudioContext }).context).toBe(ctx);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/playout && npx vitest run src/__tests__/SoundFontCache.fromUrl.test.ts`
Expected: FAIL — `SoundFontCache.fromUrl is not a function`.

- [ ] **Step 3: Implement `fromUrl`**

In `packages/playout/src/SoundFontCache.ts`, add inside the class, directly after the constructor (before `load()`):

```typescript
  /**
   * Fetch and parse an SF2 file, resolving only once it's ready to play.
   * Prefer this over `new SoundFontCache()` + `load()` — the returned cache
   * is always loaded, so it can't hit the "unloaded cache → PolySynth
   * fallback" path in createToneAdapter / setSoundFontCache.
   */
  static async fromUrl(
    url: string,
    options?: { context?: BaseAudioContext; signal?: AbortSignal }
  ): Promise<SoundFontCache> {
    const cache = new SoundFontCache(options?.context);
    await cache.load(url, options?.signal);
    return cache;
  }
```

NOTE: `load()` calls `fetch(url, { signal })` — with no options this passes `{ signal: undefined }`, which the first test asserts. If the assertion fails on argument shape, fix the TEST to match the actual call, not the implementation.

- [ ] **Step 4: Run the full playout suite**

Run: `cd packages/playout && npx vitest run`
Expected: all pass (226 existing + 4 new = 230). Then `pkill -f vitest` (ok if none).

- [ ] **Step 5: Typecheck, lint, commit (repo root)**

```bash
pnpm --filter @waveform-playlist/playout typecheck
pnpm lint
git add packages/playout/src/SoundFontCache.ts packages/playout/src/__tests__/SoundFontCache.fromUrl.test.ts
git commit -m "feat(playout): SoundFontCache.fromUrl async factory"
```

---

### Task 2: `isToneAdapter()` type guard (TDD)

**Files:**
- Test: `packages/playout/src/__tests__/TonePlayoutAdapter.test.ts` (append a describe block)
- Modify: `packages/playout/src/TonePlayoutAdapter.ts` (add function after the `ToneAdapter` interface, ~line 35)
- Modify: `packages/playout/src/index.ts` (the `createToneAdapter` export line)

- [ ] **Step 1: Write the failing tests**

Append to the END of the top-level `describe('createToneAdapter', ...)` in `TonePlayoutAdapter.test.ts` — note `isToneAdapter` must be added to the existing import from `'../TonePlayoutAdapter'`:

```typescript
  describe('isToneAdapter', () => {
    it('narrows createToneAdapter output', () => {
      const adapter = createToneAdapter();
      expect(isToneAdapter(adapter)).toBe(true);
    });

    it('rejects null and undefined', () => {
      expect(isToneAdapter(null)).toBe(false);
      expect(isToneAdapter(undefined)).toBe(false);
    });

    it('rejects adapters without the soundfont capability', () => {
      const bare = { play: vi.fn(), pause: vi.fn() } as unknown as Parameters<
        typeof isToneAdapter
      >[0];
      expect(isToneAdapter(bare)).toBe(false);
    });
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/playout && npx vitest run src/__tests__/TonePlayoutAdapter.test.ts`
Expected: FAIL — `isToneAdapter` is not exported (import error).

- [ ] **Step 3: Implement**

In `TonePlayoutAdapter.ts`, directly after the `ToneAdapter` interface declaration:

```typescript
/**
 * Capability check for Tone-specific adapter features. Structural, not
 * instanceof — any adapter implementing setSoundFontCache passes. Narrows a
 * generic PlayoutAdapter so soundfont calls typecheck without casts.
 */
export function isToneAdapter(
  adapter: PlayoutAdapter | null | undefined
): adapter is ToneAdapter {
  return typeof (adapter as Partial<ToneAdapter> | null | undefined)?.setSoundFontCache === 'function';
}
```

In `packages/playout/src/index.ts`, change:

```typescript
export { createToneAdapter } from './TonePlayoutAdapter';
```

to:

```typescript
export { createToneAdapter, isToneAdapter } from './TonePlayoutAdapter';
```

- [ ] **Step 4: Run the full playout suite**

Run: `cd packages/playout && npx vitest run`
Expected: all pass (230 + 3 = 233). `pkill -f vitest` after.

- [ ] **Step 5: Typecheck, lint, commit (repo root)**

```bash
pnpm --filter @waveform-playlist/playout typecheck
pnpm lint
git add packages/playout/src/TonePlayoutAdapter.ts packages/playout/src/index.ts packages/playout/src/__tests__/TonePlayoutAdapter.test.ts
git commit -m "feat(playout): isToneAdapter type guard"
```

---

### Task 3: Browser adopts the guard

**Files:**
- Modify: `packages/browser/src/soundFontSync.ts`
- Modify: `packages/browser/src/__tests__/soundFontSync.test.ts`

- [ ] **Step 1: Rebuild playout so the new export is visible**

```bash
pnpm --filter @waveform-playlist/playout build
```

- [ ] **Step 2: Update the test file FIRST (mock the playout barrel)**

Replace the imports at the top of `packages/browser/src/__tests__/soundFontSync.test.ts` (keep the four existing test bodies unchanged) with:

```typescript
import { describe, it, expect, vi } from 'vitest';
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import type { SoundFontCache } from '@waveform-playlist/playout';

// soundFontSync now VALUE-imports isToneAdapter from the playout barrel,
// which imports Tone.js at module scope — that crashes in the node test
// env. Mock the barrel with the guard's actual logic; the real guard is
// unit-tested in packages/playout (TonePlayoutAdapter.test.ts).
vi.mock('@waveform-playlist/playout', () => ({
  isToneAdapter: (adapter: unknown): boolean =>
    typeof (adapter as { setSoundFontCache?: unknown } | null | undefined)?.setSoundFontCache ===
    'function',
}));

import { syncSoundFontCacheToAdapter } from '../soundFontSync';
```

- [ ] **Step 3: Run tests — should still pass against the CURRENT implementation**

Run: `cd packages/browser && npx vitest run src/__tests__/soundFontSync.test.ts`
Expected: PASS (4 tests) — the mock is inert until the source imports it; this proves the test change alone breaks nothing. (If vitest hoisting complains about the mock placement, move the `vi.mock` call above the type imports — `vi.mock` is hoisted automatically, so this should not occur.)

- [ ] **Step 4: Refactor `packages/browser/src/soundFontSync.ts`**

Replace the full file contents with:

```typescript
import type { PlayoutAdapter } from '@waveform-playlist/engine';
import { isToneAdapter } from '@waveform-playlist/playout';
import type { SoundFontCache } from '@waveform-playlist/playout';

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
  if (!isToneAdapter(adapter)) return;
  adapter.setSoundFontCache(cache);
}
```

- [ ] **Step 5: Run browser suite + typecheck**

```bash
cd packages/browser && npx vitest run; cd ../..
pkill -f vitest || true
pnpm --filter @waveform-playlist/browser typecheck
```
Expected: 198 tests pass (4 soundFontSync unchanged in count), typecheck clean.

- [ ] **Step 6: Lint, commit (repo root)**

```bash
pnpm lint
git add packages/browser/src/soundFontSync.ts packages/browser/src/__tests__/soundFontSync.test.ts
git commit -m "refactor(browser): use isToneAdapter guard in soundFontSync"
```

---

### Task 4: Docs + example switch to `fromUrl`

**Files:**
- Modify: `website/docs/react/guides/midi.md` (two snippets in the "SoundFont Playback" section)
- Modify: `examples/dawcore-tone/soundfont.html` (the `start()` load block)
- Modify: `packages/playout/CLAUDE.md` (two one-sentence additions)
- Modify: `website/static/llms.txt` (extend the existing soundfont clause)

- [ ] **Step 1: `website/docs/react/guides/midi.md`**

Read the "SoundFont Playback" section first. Two changes:

1a. The initial-load snippet (~lines 111-117) currently constructs and loads in two steps:

```tsx
import { SoundFontCache } from '@waveform-playlist/playout';

// Load the SoundFont (do this once, e.g., in a hook or effect)
const cache = new SoundFontCache();
await cache.load('/path/to/florestan-grand.sf2');
```

Replace the construct+load lines with:

```tsx
import { SoundFontCache } from '@waveform-playlist/playout';

// Load the SoundFont (do this once, e.g., in a hook or effect).
// fromUrl resolves only after the file is fetched and parsed.
const cache = await SoundFontCache.fromUrl('/path/to/florestan-grand.sf2');
```

(Adapt surrounding prose only if it references the two-step form.)

1b. The "Loading the SoundFont late" snippet — replace the `useEffect` body:

```tsx
useEffect(() => {
  const sf = new SoundFontCache();
  sf.load('/media/soundfont/A320U.sf2')
    .then(() => setCache(sf))
    .catch((err) => {
      console.error('SoundFont failed to load — MIDI stays on PolySynth:', err);
    });
}, []);
```

with:

```tsx
useEffect(() => {
  SoundFontCache.fromUrl('/media/soundfont/A320U.sf2')
    .then(setCache)
    .catch((err) => {
      console.error('SoundFont failed to load — MIDI stays on PolySynth:', err);
    });
}, []);
```

Keep the existing caveat paragraph ("Set the state *after* `load()` resolves...") but reword its first sentence to match the factory: replace `Set the state *after* ``load()`` resolves, as above.` with `With ``fromUrl`` an unloaded cache never reaches your state.` — the rest of the paragraph (same-reference warning) stays.

- [ ] **Step 2: `examples/dawcore-tone/soundfont.html`**

In the `start()` function, replace:

```javascript
      let soundFontCache;
      try {
        soundFontCache = new SoundFontCache();
        await soundFontCache.load('/media/soundfont/A320U.sf2');
        addLog('soundfont loaded: A320U.sf2');
      } catch (err) {
```

with:

```javascript
      let soundFontCache;
      try {
        soundFontCache = await SoundFontCache.fromUrl('/media/soundfont/A320U.sf2');
        addLog('soundfont loaded: A320U.sf2');
      } catch (err) {
```

(The `catch` already sets `soundFontCache = undefined` and logs the PolySynth fallback — unchanged.)

- [ ] **Step 3: `packages/playout/CLAUDE.md`**

3a. In the "Global AudioContext Pattern" section, the paragraph "**SoundFontCache uses OfflineAudioContext by default:**" — append one sentence:

```markdown
`SoundFontCache.fromUrl(url, { context?, signal? })` is the preferred construction path — it resolves only after fetch+parse, so an unloaded cache can't reach `createToneAdapter`/`setSoundFontCache`.
```

3b. In "SoundFont Playback (SoundFontToneTrack)", at the end of the "**Late load / swap...**" paragraph — append:

```markdown
`isToneAdapter(adapter)` (exported from playout) is the capability guard for narrowing a generic `PlayoutAdapter` before calling `setSoundFontCache` — structural check, used by browser's `soundFontSync.ts`.
```

- [ ] **Step 4: `website/static/llms.txt`**

Find the `@waveform-playlist/midi` line (mentions `adapter.setSoundFontCache()`). After `createToneAdapter()`, extend the parenthetical so the clause reads: `...on the adapter returned by ``createToneAdapter()`` (the React provider forwards late ``soundFontCache`` prop changes automatically; construct caches with ``SoundFontCache.fromUrl(url)``).` Keep it a single line.

- [ ] **Step 5: Build website, lint, commit**

```bash
pnpm --filter website build
pnpm lint
git add website/docs/react/guides/midi.md examples/dawcore-tone/soundfont.html packages/playout/CLAUDE.md website/static/llms.txt
git commit -m "docs: prefer SoundFontCache.fromUrl across soundfont docs and example"
```

Expected: website build succeeds (CSS calc warnings pre-existing/harmless).

- [ ] **Step 6: Smoke-test the example in a browser**

```bash
pnpm example:dawcore-tone   # background; read the log for the actual port
```
Open `<baseURL>/soundfont.html` via Playwright MCP tools: confirm the page log shows `soundfont loaded: A320U.sf2` then `loaded 13 track(s)`, no console errors. Stop the server afterwards.

---

### Task 5: Final verification

- [ ] **Step 1:** `pnpm build && pnpm lint` from repo root — both clean.
- [ ] **Step 2:** `pnpm --filter @waveform-playlist/playout typecheck && pnpm --filter @waveform-playlist/browser typecheck` — clean (repo-wide typecheck fails in dawcore-midi, pre-existing).
- [ ] **Step 3:** `cd packages/playout && npx vitest run` (233) and `cd packages/browser && npx vitest run` (198); `pkill -f vitest` after.
- [ ] **Step 4:** `git status` clean; `git diff main...HEAD --stat` shows only: spec, this plan, SoundFontCache.ts (+new test file), TonePlayoutAdapter.ts (+test), playout index.ts, playout CLAUDE.md, soundFontSync.ts (+test), midi.md, soundfont.html, llms.txt.

**Done criteria (from spec):** `fromUrl` resolves loaded / rejects cleanly / forwards signal+context; `isToneAdapter` exported and adopted by browser with unchanged sync behavior; docs and example use the factory; all suites green.
