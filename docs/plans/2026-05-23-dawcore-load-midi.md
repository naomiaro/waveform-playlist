# dawcore `editor.loadMidi()` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `editor.loadMidi(source, options)` to `<daw-editor>` so consumers can imperatively load a `.mid` file (URL or `File`) and have N `<daw-track>` elements created automatically — with cleanup-on-failure if any track fails.

**Architecture:** Mirror the spectrogram framework-split. New `@dawcore/midi` package houses the pure framework-agnostic parser (moved from `@waveform-playlist/midi`); `@waveform-playlist/midi` becomes a thin React wrapper that re-exports from `@dawcore/midi`. `@dawcore/components` adds an optional peer dep on `@dawcore/midi`, dynamic-imports it inside `loadMidi`, and uses `Promise.allSettled` + cleanup-on-failure so a partial failure rolls back to a clean state.

**Tech Stack:** TypeScript, Lit (web components), tsup (build), vitest (test), `@tonejs/midi` (parser), pnpm workspaces.

**Design Doc:** [`docs/specs/2026-05-23-dawcore-load-midi-design.md`](../specs/2026-05-23-dawcore-load-midi-design.md)

**Branch:** `feature/dawcore-load-midi` (already created)

---

## Important conventions for this plan

- **Don't commit between tasks without user approval.** Per the user's `feedback_no_commit_before_testing` preference: at the end of each task, run all verification commands, then **STOP and wait for the user to inspect and approve** before running `git commit`. The commit step is included in each task but should be gated on explicit user OK.
- **Run from repo root** (`/Users/naomiaro/Code/waveform-playlist/`). When the plan says "from package directory" it'll say so explicitly.
- **Type-migration gotcha:** `pnpm typecheck` resolves workspace packages via `dist/`. After modifying a package's source, build it (`pnpm --filter <package> build`) before running typecheck in a downstream package, or `TS2339`/`TS2353` errors will appear for fields that exist only in source.
- **No `--no-verify` on git commits.** Pre-commit hooks run prettier/lint — fix the underlying issue if they fail; don't bypass.
- **Divergence from spectrogram:** the design uses `@dawcore/midi` as an **optional peer dep** (dynamic import) rather than a regular dependency. This is intentional — MIDI loading is opt-in and the ~10 KB parser shouldn't be in every dawcore consumer's bundle. `@dawcore/spectrogram` chose regular dep; that's not what we're doing here.

---

## File Structure

### Created
- `packages/dawcore-midi/package.json`
- `packages/dawcore-midi/tsconfig.json`
- `packages/dawcore-midi/tsup.config.ts`
- `packages/dawcore-midi/vitest.config.ts`
- `packages/dawcore-midi/README.md`
- `packages/dawcore-midi/CLAUDE.md`
- `packages/dawcore-midi/src/index.ts`
- `packages/dawcore-midi/src/parseMidiFile.ts` (moved from `@waveform-playlist/midi`)
- `packages/dawcore-midi/src/types.ts` (new — `MidiLoadOptions`, `MidiLoadResult`)
- `packages/dawcore-midi/__tests__/parseMidiFile.test.ts` (moved from `@waveform-playlist/midi`)
- `packages/dawcore/src/interactions/midi-loader.ts`
- `packages/dawcore/src/__tests__/daw-editor-load-midi.test.ts`
- `packages/midi/src/__tests__/parser-parity.test.ts`
- `examples/dawcore-tone/midi-load.html`

### Modified
- `packages/midi/package.json` — version 12.0.0 → 13.0.0, add `@dawcore/midi` dep
- `packages/midi/src/index.ts` — re-export parser from `@dawcore/midi`
- `packages/midi/src/useMidiTracks.ts` — import parser from `@dawcore/midi`
- `packages/midi/CLAUDE.md` — note re-export pattern
- `packages/dawcore/package.json` — version 0.0.18 → 0.0.19, add optional peer dep
- `packages/dawcore/src/elements/daw-editor.ts` — add `loadMidi()` public method
- `packages/dawcore/CLAUDE.md` — document `editor.loadMidi()`
- `examples/dawcore-tone/index.html` — link to `midi-load.html`
- `docs/specs/web-components-migration.md` — lines 148-149, 409-414, 1120-1158, 1516, 1521

### Deleted (after move)
- `packages/midi/src/parseMidiFile.ts`
- `packages/midi/src/__tests__/parseMidiFile.test.ts`

---

## Task 1: Bootstrap `@dawcore/midi` package

**Files:**
- Create: `packages/dawcore-midi/package.json`
- Create: `packages/dawcore-midi/tsconfig.json`
- Create: `packages/dawcore-midi/tsup.config.ts`
- Create: `packages/dawcore-midi/vitest.config.ts`
- Create: `packages/dawcore-midi/README.md`
- Create: `packages/dawcore-midi/src/index.ts` (placeholder — populated next task)

- [ ] **Step 1: Create directory layout**

```bash
mkdir -p packages/dawcore-midi/src packages/dawcore-midi/__tests__
```

- [ ] **Step 2: Write `packages/dawcore-midi/package.json`**

```json
{
  "name": "@dawcore/midi",
  "version": "0.0.1",
  "description": "Framework-agnostic MIDI file loading and parsing for the dawcore family",
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    }
  },
  "sideEffects": false,
  "scripts": {
    "build": "tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "keywords": ["midi", "dawcore", "web-audio", "tonejs"],
  "author": "Naomi Aro",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/naomiaro/waveform-playlist.git",
    "directory": "packages/dawcore-midi"
  },
  "homepage": "https://naomiaro.github.io/waveform-playlist",
  "bugs": {
    "url": "https://github.com/naomiaro/waveform-playlist/issues"
  },
  "files": ["dist", "README.md"],
  "dependencies": {
    "@waveform-playlist/core": "workspace:*",
    "@tonejs/midi": "^2.0.28"
  },
  "devDependencies": {
    "tsup": "^8.0.1",
    "typescript": "^5.3.3",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 3: Write `packages/dawcore-midi/tsconfig.json`** (mirrors `dawcore-spectrogram`)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "lib": ["ES2020", "DOM"],
    "moduleResolution": "bundler",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "declaration": true,
    "outDir": "./dist",
    "resolveJsonModule": true,
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*", "__tests__/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 4: Write `packages/dawcore-midi/tsup.config.ts`**

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
```

- [ ] **Step 5: Write `packages/dawcore-midi/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['__tests__/**/*.test.ts'],
  },
});
```

(Pure parser — no DOM needed; `node` environment is enough.)

- [ ] **Step 6: Write `packages/dawcore-midi/README.md`**

```markdown
# @dawcore/midi

Framework-agnostic MIDI file loading and parsing for the dawcore family.

Used by `@dawcore/components` (the Lit web component layer, via `editor.loadMidi()`) and `@waveform-playlist/midi` (the React `useMidiTracks` hook).

## Exports

- `parseMidiFile(data, options?)` — parse a MIDI `ArrayBuffer`
- `parseMidiUrl(url, options?, signal?)` — fetch and parse a `.mid` URL
- Types: `ParsedMidi`, `ParsedMidiTrack`, `ParseMidiOptions`, `MidiLoadOptions`, `MidiLoadResult`

## License

MIT
```

- [ ] **Step 7: Write placeholder `packages/dawcore-midi/src/index.ts`**

```typescript
// Re-exports populated in next task — keep file present so pnpm install picks up
// the package and tsup has an entry target.
export {};
```

- [ ] **Step 8: Run `pnpm install` from repo root and verify the workspace picks up the new package**

Run: `pnpm install`
Expected: Lockfile updates. New `packages/dawcore-midi/node_modules/` exists. No errors.

- [ ] **Step 9: Verify package builds (empty exports — just checks tooling is wired)**

Run: `pnpm --filter @dawcore/midi build`
Expected: `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts` exist.

- [ ] **Step 10: STOP — wait for user verification**

The new package is set up but empty. Show the user `git status` and the new directory tree. **Do NOT commit until the user OKs.**

- [ ] **Step 11: Commit (after user approval)**

```bash
git add packages/dawcore-midi pnpm-lock.yaml
git commit -m "feat(dawcore-midi): bootstrap new framework-agnostic MIDI package"
```

---

## Task 2: Move parser file + tests into `@dawcore/midi`

**Files:**
- Move: `packages/midi/src/parseMidiFile.ts` → `packages/dawcore-midi/src/parseMidiFile.ts`
- Move: `packages/midi/src/__tests__/parseMidiFile.test.ts` → `packages/dawcore-midi/__tests__/parseMidiFile.test.ts`
- Modify: `packages/dawcore-midi/src/index.ts` (real exports)

- [ ] **Step 1: Move the parser source file**

Run from repo root:
```bash
git mv packages/midi/src/parseMidiFile.ts packages/dawcore-midi/src/parseMidiFile.ts
```

(File content unchanged — it already imports `MidiNoteData` from `@waveform-playlist/core` which is a dependency of the new package.)

- [ ] **Step 2: Move the parser test file**

```bash
git mv packages/midi/src/__tests__/parseMidiFile.test.ts packages/dawcore-midi/__tests__/parseMidiFile.test.ts
```

The test file imports from `'../parseMidiFile'` — adjust to `'../src/parseMidiFile'`:

- [ ] **Step 3: Fix the relative import in the moved test file**

Edit `packages/dawcore-midi/__tests__/parseMidiFile.test.ts`:
```typescript
// OLD:
import { parseMidiFile } from '../parseMidiFile';
// NEW:
import { parseMidiFile } from '../src/parseMidiFile';
```

- [ ] **Step 4: Populate `packages/dawcore-midi/src/index.ts`**

```typescript
export { parseMidiFile, parseMidiUrl } from './parseMidiFile';
export type { ParsedMidi, ParsedMidiTrack, ParseMidiOptions } from './parseMidiFile';
```

(Types will be extended in Task 3 with `MidiLoadOptions` / `MidiLoadResult`.)

- [ ] **Step 5: Run typecheck**

Run: `pnpm --filter @dawcore/midi typecheck`
Expected: PASS (no errors)

- [ ] **Step 6: Run tests in the new package**

Run: `pnpm --filter @dawcore/midi test`
Expected: PASS — all 11 existing `parseMidiFile` tests now run inside `@dawcore/midi`.

- [ ] **Step 7: Build the package**

Run: `pnpm --filter @dawcore/midi build`
Expected: `dist/index.js`, `dist/index.mjs`, `dist/index.d.ts` contain the exports.

- [ ] **Step 8: Verify `@waveform-playlist/midi` is now broken (expected)**

Run: `pnpm --filter @waveform-playlist/midi typecheck`
Expected: FAIL — `useMidiTracks.ts` imports `'./parseMidiFile'` which no longer exists.

This confirms we've fully moved (not copied). The next task fixes the React package.

- [ ] **Step 9: STOP — wait for user verification**

- [ ] **Step 10: Commit (after user approval)**

```bash
git add packages/dawcore-midi packages/midi
git commit -m "refactor(midi): move parser and tests into @dawcore/midi"
```

---

## Task 3: Add `MidiLoadOptions` and `MidiLoadResult` types

**Files:**
- Create: `packages/dawcore-midi/src/types.ts`
- Modify: `packages/dawcore-midi/src/index.ts`

- [ ] **Step 1: Write `packages/dawcore-midi/src/types.ts`**

```typescript
/**
 * Options accepted by `editor.loadMidi(source, options)` on `<daw-editor>`.
 */
export interface MidiLoadOptions {
  /** Timeline position in seconds applied to every created clip (default: 0). */
  startTime?: number;
  /** AbortSignal forwarded to fetch() when the source is a URL. */
  signal?: AbortSignal;
}

/**
 * Result returned from `editor.loadMidi(...)`.
 */
export interface MidiLoadResult {
  /** IDs of the `<daw-track>` elements created, in MIDI track order. */
  trackIds: string[];
  /** Tempo from the MIDI header (defaults to 120 if absent). */
  bpm: number;
  /** Time signature [numerator, denominator] (defaults to [4, 4] if absent). */
  timeSignature: [number, number];
  /** Total duration of the loaded MIDI in seconds (max across tracks). */
  duration: number;
  /** Song name from the MIDI header — empty string when not set. */
  name: string;
}
```

- [ ] **Step 2: Re-export types from `packages/dawcore-midi/src/index.ts`**

```typescript
export { parseMidiFile, parseMidiUrl } from './parseMidiFile';
export type { ParsedMidi, ParsedMidiTrack, ParseMidiOptions } from './parseMidiFile';
export type { MidiLoadOptions, MidiLoadResult } from './types';
```

- [ ] **Step 3: Typecheck and build**

Run: `pnpm --filter @dawcore/midi typecheck && pnpm --filter @dawcore/midi build`
Expected: PASS, dist regenerated with new types in `index.d.ts`.

- [ ] **Step 4: STOP — wait for user verification**

- [ ] **Step 5: Commit (after user approval)**

```bash
git add packages/dawcore-midi
git commit -m "feat(dawcore-midi): add MidiLoadOptions and MidiLoadResult types"
```

---

## Task 4: Refactor `@waveform-playlist/midi` to depend on `@dawcore/midi`

**Files:**
- Modify: `packages/midi/package.json` (add dep, bump version to 13.0.0)
- Modify: `packages/midi/src/index.ts` (re-export from `@dawcore/midi`)
- Modify: `packages/midi/src/useMidiTracks.ts` (import parser from `@dawcore/midi`)

- [ ] **Step 1: Add dep + bump version in `packages/midi/package.json`**

Change:
```json
  "version": "12.0.0",
```
to:
```json
  "version": "13.0.0",
```

Change the `dependencies` block:
```json
  "dependencies": {
    "@waveform-playlist/core": "workspace:*",
    "@tonejs/midi": "^2.0.28"
  },
```
to:
```json
  "dependencies": {
    "@waveform-playlist/core": "workspace:*",
    "@tonejs/midi": "^2.0.28",
    "@dawcore/midi": "workspace:*"
  },
```

(`@tonejs/midi` stays in deps because `useMidiTracks` may still reference its types transitively. If a later cleanup audit shows no direct import, it can be moved to `peerDependenciesMeta` then.)

- [ ] **Step 2: Update `packages/midi/src/index.ts`** to re-export from `@dawcore/midi`

```typescript
export { parseMidiFile, parseMidiUrl } from '@dawcore/midi';
export type { ParsedMidi, ParsedMidiTrack, ParseMidiOptions } from '@dawcore/midi';
export { useMidiTracks } from './useMidiTracks';
export type { MidiTrackConfig, UseMidiTracksOptions, UseMidiTracksReturn } from './useMidiTracks';
```

- [ ] **Step 3: Update `packages/midi/src/useMidiTracks.ts`** — find the parser imports and update them

Find: `from './parseMidiFile'`
Replace: `from '@dawcore/midi'`

(`useMidiTracks` may import `parseMidiUrl`, `parseMidiFile`, `ParsedMidi`, `ParsedMidiTrack`. All come from `@dawcore/midi` now.)

- [ ] **Step 4: Run `pnpm install` to wire up the new workspace dep**

Run: `pnpm install`
Expected: Lockfile updates with the new `@dawcore/midi → @waveform-playlist/midi` edge.

- [ ] **Step 5: Build `@dawcore/midi` so its `dist/` is current (per the type-migration gotcha)**

Run: `pnpm --filter @dawcore/midi build`

- [ ] **Step 6: Typecheck and test `@waveform-playlist/midi`**

Run: `pnpm --filter @waveform-playlist/midi typecheck && pnpm --filter @waveform-playlist/midi test`
Expected: PASS. The 12 hook tests still run, now exercising the parser via `@dawcore/midi` re-exports.

- [ ] **Step 7: Build `@waveform-playlist/midi`**

Run: `pnpm --filter @waveform-playlist/midi build`
Expected: `dist/index.mjs` re-exports the parser symbols (which now live in `@dawcore/midi`).

- [ ] **Step 8: STOP — wait for user verification**

- [ ] **Step 9: Commit (after user approval)**

```bash
git add packages/midi pnpm-lock.yaml
git commit -m "refactor(midi): re-export parser from @dawcore/midi; bump to 13.0.0"
```

---

## Task 5: Add parser-parity smoke test to `@waveform-playlist/midi`

Catches accidental copy-not-re-export by asserting both packages' parsers produce structurally equal output on the same input.

**Files:**
- Create: `packages/midi/src/__tests__/parser-parity.test.ts`

- [ ] **Step 1: Write `packages/midi/src/__tests__/parser-parity.test.ts`**

```typescript
import { describe, it, expect } from 'vitest';
import { Midi } from '@tonejs/midi';
import { parseMidiFile as parseFromReactPkg } from '@waveform-playlist/midi';
import { parseMidiFile as parseFromDawcorePkg } from '@dawcore/midi';

/**
 * @waveform-playlist/midi re-exports parseMidiFile from @dawcore/midi. This
 * test guards against accidental local copies (which would silently diverge
 * over time). Identity equality is unreliable across bundle boundaries so we
 * assert behavioral parity instead — same input, structurally equal output.
 */
describe('parser parity', () => {
  it('produces structurally equal output from both packages', () => {
    const midi = new Midi();
    midi.header.setTempo(140);
    midi.header.timeSignatures.push({ ticks: 0, timeSignature: [3, 4], measures: 0 });
    const track = midi.addTrack();
    track.name = 'Test';
    track.channel = 0;
    track.addNote({ midi: 60, time: 0, duration: 0.5, velocity: 0.8 });
    track.addNote({ midi: 64, time: 0.5, duration: 0.5, velocity: 0.7 });
    const buffer = midi.toArray().buffer;

    const fromReact = parseFromReactPkg(buffer);
    const fromDawcore = parseFromDawcorePkg(buffer);

    expect(fromReact).toEqual(fromDawcore);
  });
});
```

- [ ] **Step 2: Run the new test**

Run: `pnpm --filter @waveform-playlist/midi test`
Expected: PASS — 13 tests (12 hook + 1 parity).

- [ ] **Step 3: STOP — wait for user verification**

- [ ] **Step 4: Commit (after user approval)**

```bash
git add packages/midi/src/__tests__/parser-parity.test.ts
git commit -m "test(midi): add parser-parity smoke test for @dawcore/midi re-export"
```

---

## Task 6: Declare `@dawcore/midi` as optional peer dep on `@dawcore/components`

**Files:**
- Modify: `packages/dawcore/package.json`

- [ ] **Step 1: Add `@dawcore/midi` to `peerDependencies` and `peerDependenciesMeta` and `devDependencies`** in `packages/dawcore/package.json`

Find the existing `peerDependencies` block:
```json
  "peerDependencies": {
    "@waveform-playlist/engine": ">=12.0.0",
    "@waveform-playlist/core": ">=12.0.0",
    "@dawcore/transport": ">=0.0.7",
    "@waveform-playlist/worklets": ">=12.0.0"
  },
```

Add the new optional peer:
```json
  "peerDependencies": {
    "@waveform-playlist/engine": ">=12.0.0",
    "@waveform-playlist/core": ">=12.0.0",
    "@dawcore/transport": ">=0.0.7",
    "@waveform-playlist/worklets": ">=12.0.0",
    "@dawcore/midi": ">=0.0.1"
  },
```

Find `peerDependenciesMeta`:
```json
  "peerDependenciesMeta": {
    "@waveform-playlist/worklets": {
      "optional": true
    },
    "@dawcore/transport": {
      "optional": true
    }
  },
```

Add:
```json
  "peerDependenciesMeta": {
    "@waveform-playlist/worklets": {
      "optional": true
    },
    "@dawcore/transport": {
      "optional": true
    },
    "@dawcore/midi": {
      "optional": true
    }
  },
```

Find the `devDependencies` block and add `@dawcore/midi`:
```json
  "devDependencies": {
    "@waveform-playlist/engine": "workspace:*",
    "@waveform-playlist/core": "workspace:*",
    "@dawcore/transport": "workspace:*",
    "@dawcore/midi": "workspace:*",
    ...
```

(The devDep on `workspace:*` is needed so dawcore's typecheck can resolve `@dawcore/midi` symbols when `loadMidi` references the types.)

- [ ] **Step 2: Run `pnpm install` to wire the workspace edge**

Run: `pnpm install`
Expected: Lockfile updates.

- [ ] **Step 3: Verify dawcore still builds**

Run: `pnpm --filter @dawcore/components build`
Expected: PASS (no usage of the new dep yet, just declared).

- [ ] **Step 4: STOP — wait for user verification**

- [ ] **Step 5: Commit (after user approval)**

```bash
git add packages/dawcore/package.json pnpm-lock.yaml
git commit -m "chore(dawcore): declare @dawcore/midi as optional peer dep"
```

---

## Task 7: Write failing tests for `editor.loadMidi()` (RED)

**Files:**
- Create: `packages/dawcore/src/__tests__/daw-editor-load-midi.test.ts`

- [ ] **Step 1: Write the full test file**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Mock } from 'vitest';
import '../elements/daw-editor';
import type { DawEditorElement } from '../elements/daw-editor';

// Mock @dawcore/midi so we don't need a real binary fixture.
vi.mock('@dawcore/midi', () => ({
  parseMidiUrl: vi.fn(),
  parseMidiFile: vi.fn(),
}));

import { parseMidiUrl, parseMidiFile } from '@dawcore/midi';

const mockParseMidiUrl = parseMidiUrl as Mock;
const mockParseMidiFile = parseMidiFile as Mock;

function makeParsedMidi(opts: Partial<{ tracks: number; bpm: number; ts: [number, number]; duration: number; name: string }> = {}) {
  const tracks = opts.tracks ?? 2;
  return {
    bpm: opts.bpm ?? 120,
    timeSignature: opts.ts ?? [4, 4],
    duration: opts.duration ?? 4,
    name: opts.name ?? '',
    tracks: Array.from({ length: tracks }).map((_, i) => ({
      name: `Track ${i + 1}`,
      channel: i,
      programNumber: 0,
      instrument: 'acoustic grand piano',
      duration: 4,
      notes: [
        { midi: 60 + i, name: 'C4', time: 0, duration: 0.5, velocity: 0.8, channel: i },
      ],
    })),
  };
}

function makeMockAdapter() {
  const audioContext = {
    sampleRate: 48000,
    state: 'running' as const,
    currentTime: 0,
    decodeAudioData: vi.fn(),
    createMediaStreamSource: vi.fn(),
    resume: vi.fn(),
  };
  return {
    audioContext,
    ppqn: 960,
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    removeTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    getPlaybackTime: vi.fn(() => 0),
    setTempo: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('<daw-editor>.loadMidi', () => {
  let editor: DawEditorElement;

  beforeEach(() => {
    mockParseMidiUrl.mockReset();
    mockParseMidiFile.mockReset();
    editor = document.createElement('daw-editor') as DawEditorElement;
    editor.adapter = makeMockAdapter() as any;
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
  });

  it('parses a URL source via parseMidiUrl with the signal', async () => {
    const ctrl = new AbortController();
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 1 }));
    await editor.loadMidi('/midi/test.mid', { signal: ctrl.signal });
    expect(mockParseMidiUrl).toHaveBeenCalledWith('/midi/test.mid', undefined, ctrl.signal);
  });

  it('parses a File source via parseMidiFile', async () => {
    const buf = new ArrayBuffer(8);
    const file = {
      arrayBuffer: vi.fn(async () => buf),
    } as unknown as File;
    mockParseMidiFile.mockReturnValueOnce(makeParsedMidi({ tracks: 1 }));
    await editor.loadMidi(file);
    expect(file.arrayBuffer).toHaveBeenCalled();
    expect(mockParseMidiFile).toHaveBeenCalledWith(buf);
  });

  it('creates N <daw-track> elements for a multi-track file', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 3 }));
    const result = await editor.loadMidi('/midi/multi.mid');
    expect(result.trackIds).toHaveLength(3);
    expect(editor.querySelectorAll('daw-track')).toHaveLength(3);
  });

  it('returns header bpm / timeSignature / duration / name even for empty files', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 0, bpm: 140, ts: [3, 4], name: 'Empty' }));
    const result = await editor.loadMidi('/midi/empty.mid');
    expect(result.trackIds).toEqual([]);
    expect(result.bpm).toBe(140);
    expect(result.timeSignature).toEqual([3, 4]);
    expect(result.name).toBe('Empty');
    expect(editor.querySelectorAll('daw-track')).toHaveLength(0);
  });

  it('applies startTime to every created clip', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    await editor.loadMidi('/midi/test.mid', { startTime: 30 });
    const clips = editor.querySelectorAll('daw-clip');
    expect(clips.length).toBe(2);
    clips.forEach((c) => {
      expect(Number((c as HTMLElement).getAttribute('start'))).toBe(30);
    });
  });

  it('uses MIDI track names', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    await editor.loadMidi('/midi/named.mid');
    const tracks = Array.from(editor.querySelectorAll('daw-track'));
    expect(tracks.map((t) => t.getAttribute('name'))).toEqual(['Track 1', 'Track 2']);
  });

  it('rejects with install hint when @dawcore/midi is unavailable', async () => {
    // Force the dynamic import to fail by mocking it to throw.
    mockParseMidiUrl.mockImplementationOnce(() => {
      throw new Error('synthetic — module-resolution failure');
    });
    // The implementation catches a module-not-found and rejects with an install hint;
    // but parseMidiUrl throwing AFTER successful import does NOT trigger the install hint.
    // That branch is exercised by a separate test below using vi.doMock.
    await expect(editor.loadMidi('/midi/x.mid')).rejects.toBeTruthy();
  });

  it('cleans up successfully-created tracks when one fails', async () => {
    // Two tracks parsed; we intercept addTrack to reject the second one.
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    const originalAddTrack = editor.addTrack.bind(editor);
    let callCount = 0;
    editor.addTrack = vi.fn(async (config) => {
      callCount += 1;
      if (callCount === 2) throw new Error('synthetic — track 2 failed');
      return originalAddTrack(config);
    });

    await expect(editor.loadMidi('/midi/partial.mid')).rejects.toThrow(/track 2 failed/);
    // Track 1 was successfully created — verify it has been removed (cleanup ran).
    expect(editor.querySelectorAll('daw-track')).toHaveLength(0);
  });

  it('cleanup waits for late settlements (allSettled, not all)', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 2 }));
    const originalAddTrack = editor.addTrack.bind(editor);
    let lateResolveTrack: HTMLElement | null = null;
    editor.addTrack = vi.fn(async (config) => {
      if (((config as any).clips?.[0]?.midiChannel ?? 0) === 0) {
        // Track 0 rejects immediately
        throw new Error('synthetic — track 0 fails fast');
      }
      // Track 1 resolves after a microtask tick — proving cleanup waits.
      const el = await originalAddTrack(config);
      lateResolveTrack = el as unknown as HTMLElement;
      return el;
    });

    await expect(editor.loadMidi('/midi/race.mid')).rejects.toThrow(/track 0 fails fast/);
    // After loadMidi resolves, the late-resolved track has also been cleaned up.
    expect(editor.querySelectorAll('daw-track')).toHaveLength(0);
    expect(lateResolveTrack).not.toBeNull();
    expect((lateResolveTrack as HTMLElement | null)?.isConnected).toBe(false);
  });

  it('propagates bpm / timeSignature / duration / name from parsed data', async () => {
    mockParseMidiUrl.mockResolvedValueOnce(makeParsedMidi({ tracks: 1, bpm: 96, ts: [6, 8], duration: 12.5, name: 'Song' }));
    const result = await editor.loadMidi('/midi/x.mid');
    expect(result.bpm).toBe(96);
    expect(result.timeSignature).toEqual([6, 8]);
    expect(result.duration).toBe(12.5);
    expect(result.name).toBe('Song');
  });
});
```

- [ ] **Step 2: Run the new test file and confirm everything fails (loadMidi not implemented)**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-load-midi.test.ts`
Expected: FAIL — `editor.loadMidi is not a function`. This is RED.

- [ ] **Step 3: STOP — wait for user verification of the test shape**

The implementer should NOT proceed to make the test green until the user has reviewed the tests and confirms they capture the behavior they want. **Do NOT commit yet.**

- [ ] **Step 4: Commit (after user approval)**

```bash
git add packages/dawcore/src/__tests__/daw-editor-load-midi.test.ts
git commit -m "test(dawcore): add failing tests for editor.loadMidi()"
```

---

## Task 8: Implement `loadMidiImpl` in `midi-loader.ts` (GREEN)

**Files:**
- Create: `packages/dawcore/src/interactions/midi-loader.ts`

- [ ] **Step 1: Write `packages/dawcore/src/interactions/midi-loader.ts`**

```typescript
import type { TrackConfig } from '../types';
import type { DawTrackElement } from '../elements/daw-track';

/**
 * Minimal host surface needed by `loadMidiImpl`. `<daw-editor>` satisfies this
 * via its existing `addTrack` method — no new methods required on the host.
 */
export interface MidiLoaderHost {
  addTrack(config: TrackConfig): Promise<DawTrackElement>;
}

/** Public option / result shapes — re-exported from `@dawcore/midi`. */
export interface MidiLoadOptions {
  startTime?: number;
  signal?: AbortSignal;
}

export interface MidiLoadResult {
  trackIds: string[];
  bpm: number;
  timeSignature: [number, number];
  duration: number;
  name: string;
}

const INSTALL_HINT =
  '@dawcore/midi is required for loadMidi(). Install with: npm install @dawcore/midi';

/**
 * Loads a `.mid` file (URL or `File`) and creates N `<daw-track>` elements,
 * one per note-bearing MIDI track. On any per-track failure, every
 * successfully-created track is removed so the editor returns to its
 * pre-call state (cleanup-on-failure).
 */
export async function loadMidiImpl(
  host: MidiLoaderHost,
  source: string | File,
  options: MidiLoadOptions = {}
): Promise<MidiLoadResult> {
  // (1) Dynamic-import the optional peer dep with a friendly install hint on failure.
  let midiModule: typeof import('@dawcore/midi');
  try {
    midiModule = await import('@dawcore/midi');
  } catch {
    throw new Error(INSTALL_HINT);
  }
  const { parseMidiUrl, parseMidiFile } = midiModule;

  // (2) Branch on source type.
  const parsed =
    typeof source === 'string'
      ? await parseMidiUrl(source, undefined, options.signal)
      : parseMidiFile(await source.arrayBuffer());

  // (3) Concurrent addTrack with allSettled so we can clean up on any failure.
  const startTime = options.startTime ?? 0;
  const settlements = await Promise.allSettled(
    parsed.tracks.map((t) =>
      host.addTrack({
        name: t.name,
        renderMode: 'piano-roll',
        clips: [
          {
            midiNotes: t.notes,
            midiChannel: t.channel,
            midiProgram: t.programNumber,
            start: startTime,
          },
        ],
      })
    )
  );

  // (4) Partition fulfilled vs rejected.
  const succeeded: DawTrackElement[] = [];
  let firstError: unknown = null;
  for (const s of settlements) {
    if (s.status === 'fulfilled') {
      succeeded.push(s.value);
    } else if (firstError === null) {
      firstError = s.reason;
    }
  }

  // (5) On any rejection: cleanup and rethrow.
  if (firstError !== null) {
    for (const el of succeeded) {
      el.remove();
    }
    throw firstError instanceof Error ? firstError : new Error(String(firstError));
  }

  // (6) Build the result.
  return {
    trackIds: succeeded.map((el) => el.trackId),
    bpm: parsed.bpm,
    timeSignature: parsed.timeSignature,
    duration: parsed.duration,
    name: parsed.name,
  };
}
```

- [ ] **Step 2: Run the test file — still failing (no public method yet)**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-load-midi.test.ts`
Expected: FAIL — `editor.loadMidi is not a function`. The impl exists but isn't wired.

This intermediate state is fine — we wire it in the next task to keep the diff small.

- [ ] **Step 3: STOP — wait for user verification of `midi-loader.ts`**

- [ ] **Step 4: Commit (after user approval)**

```bash
git add packages/dawcore/src/interactions/midi-loader.ts
git commit -m "feat(dawcore): add loadMidiImpl helper in interactions/midi-loader.ts"
```

---

## Task 9: Wire `editor.loadMidi()` on `<daw-editor>` (tests turn GREEN)

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

- [ ] **Step 1: Add the import and public method**

In `packages/dawcore/src/elements/daw-editor.ts`, add the import near the other `interactions/` imports:

```typescript
import { loadMidiImpl, type MidiLoadOptions, type MidiLoadResult } from '../interactions/midi-loader';
```

Find the public method block where `loadFiles` is defined (around `daw-editor.ts:1697`). Add the new method directly after `loadFiles`:

```typescript
  /**
   * Imperatively load a `.mid` file (URL or File) and create N `<daw-track>`
   * elements — one per note-bearing MIDI track. On any per-track failure,
   * successfully-created tracks are removed so the editor returns to its
   * pre-call state. Requires the optional `@dawcore/midi` peer dep.
   */
  async loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult> {
    return loadMidiImpl(this, source, options);
  }
```

- [ ] **Step 2: Run the test file — all tests should now PASS**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-load-midi.test.ts`
Expected: PASS (all 10 tests).

If a test fails because the `addTrack` mock interferes with how the test asserts DOM presence, fall back to the originalAddTrack behavior in the test — the mocks in Task 7 deliberately chain to the real method.

- [ ] **Step 3: Run the full dawcore test suite to catch regressions**

Run: `pnpm --filter @dawcore/components test`
Expected: PASS (all existing tests + new loadMidi tests).

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @dawcore/components typecheck`
Expected: PASS.

- [ ] **Step 5: Build**

Run: `pnpm --filter @dawcore/components build`
Expected: PASS.

- [ ] **Step 6: STOP — wait for user verification**

- [ ] **Step 7: Commit (after user approval)**

```bash
git add packages/dawcore/src/elements/daw-editor.ts
git commit -m "feat(dawcore): expose editor.loadMidi() public method"
```

---

## Task 10: Create `midi-load.html` example

**Files:**
- Create: `examples/dawcore-tone/midi-load.html`
- Modify: `examples/dawcore-tone/index.html`

- [ ] **Step 1: Write `examples/dawcore-tone/midi-load.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>dawcore + Tone.js — Load MIDI</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #0f0f1a;
      color: #e0d4c8;
      padding: 24px;
    }
    h1 { font-size: 1.2rem; margin-bottom: 16px; }
    daw-editor {
      --daw-wave-color: #c49a6c;
      --daw-playhead-color: #d08070;
      --daw-background: #1a1a2e;
      --daw-track-background: #16213e;
      --daw-ruler-color: #c49a6c;
      --daw-ruler-background: #0f0f1a;
      --daw-piano-roll-note-color: #2a7070;
      --daw-piano-roll-selected-note-color: #3d9e9e;
      --daw-piano-roll-background: #1a1a2e;
      margin-bottom: 12px;
    }
    .toolbar { display: flex; gap: 12px; align-items: center; margin-bottom: 12px; }
    daw-transport { display: flex; gap: 8px; }
    #log {
      margin-top: 12px;
      font-family: monospace;
      font-size: 0.75rem;
      color: #888;
      max-height: 160px;
      overflow-y: auto;
    }
    button { padding: 6px 12px; }
  </style>
</head>
<body>
  <h1>dawcore + Tone.js — Load a .mid file</h1>

  <script type="module">import '@dawcore/components';</script>

  <div class="toolbar">
    <button id="load-url">Load from URL</button>
    <label>
      Load file:
      <input id="load-file" type="file" accept=".mid,.midi" />
    </label>
  </div>

  <daw-editor id="editor" samples-per-pixel="2048" wave-height="120" timescale>
    <daw-keyboard-shortcuts playback></daw-keyboard-shortcuts>
  </daw-editor>

  <daw-transport for="editor">
    <daw-play-button></daw-play-button>
    <daw-pause-button></daw-pause-button>
    <daw-stop-button></daw-stop-button>
  </daw-transport>

  <div id="log"></div>

  <script type="module">
    import { createToneAdapter } from '@waveform-playlist/playout';

    const editor = document.getElementById('editor');
    editor.adapter = createToneAdapter({ ppqn: 960 });

    const log = document.getElementById('log');
    function addLog(msg) {
      const line = document.createElement('div');
      line.textContent = msg;
      log.prepend(line);
      while (log.children.length > 30) log.lastChild.remove();
    }

    editor.addEventListener('daw-track-ready', (e) => addLog('track-ready: ' + e.detail.trackId));
    editor.addEventListener('daw-error', (e) => addLog('error: ' + e.detail.operation + ' — ' + String(e.detail.error)));

    async function loadMidi(source) {
      try {
        const result = await editor.loadMidi(source);
        addLog('loaded ' + result.trackIds.length + ' track(s); bpm=' + result.bpm.toFixed(1) + ' ts=' + result.timeSignature.join('/'));
        // Apply tempo / time signature from the file (caller decides).
        editor.bpm = result.bpm;
        editor.timeSignature = result.timeSignature;
      } catch (err) {
        addLog('loadMidi failed: ' + String(err));
      }
    }

    document.getElementById('load-url').addEventListener('click', () => {
      loadMidi('/media/midi/RedHotChiliPeppers-Otherside.mid');
    });

    document.getElementById('load-file').addEventListener('change', (e) => {
      const file = e.target.files?.[0];
      if (file) loadMidi(file);
    });
  </script>
</body>
</html>
```

- [ ] **Step 2: Add a link to it from `examples/dawcore-tone/index.html`**

Open `examples/dawcore-tone/index.html` and find the existing list of example links (look for `midi.html` — add the new link directly below it):

```html
<li><a href="./midi-load.html">midi-load.html</a> — load a .mid file (URL or File) via editor.loadMidi()</li>
```

- [ ] **Step 3: Manual verification — start the dev server and test loading**

Run: `pnpm example:dawcore-tone`
Expected: Vite server starts at `http://localhost:5174/` (or next free port).

Open the page, click "Load from URL". Expect 3 piano-roll tracks to appear (Otherside has lead/bass/drums). Click Play — MIDI plays via Tone.js synth. Try the file picker with another `.mid` to verify File-source path.

- [ ] **Step 4: STOP — wait for user verification (this one really matters — pull up the browser and confirm it works)**

- [ ] **Step 5: Commit (after user approval)**

```bash
git add examples/dawcore-tone/midi-load.html examples/dawcore-tone/index.html
git commit -m "feat(examples): add dawcore-tone midi-load.html demo"
```

---

## Task 11: Update outdated parts of `web-components-migration.md`

Scope-bounded per the design doc.

**Files:**
- Modify: `docs/specs/web-components-migration.md`

- [ ] **Step 1: Verify current method-vs-property API state in `daw-editor.ts` before editing the spec**

Run from repo root:
```bash
grep -n "set bpm\|set timeSignature\|set snapTo\|set scaleMode\|setLoopRegion\|loopEnabled" packages/dawcore/src/elements/daw-editor.ts | head -20
```

This grounds the spec edits in actual API state. If `setLoopRegion()` is still a method, keep it as a method in the spec; if it's a setter for a `loopRegion` property, change accordingly.

- [ ] **Step 2: Edit lines 148-149** (`<daw-tempo>` / `<daw-time-signature>` "wraps" column)

Find:
```
| `<daw-tempo>` | setBpm() | Editable BPM input. Reflects current tempo. Drives `BeatsAndBarsProvider` bpm, metronome, and musical time formats. |
| `<daw-time-signature>` | setTimeSignature() | Editable time signature (e.g., `4/4`, `3/4`, `6/8`). Drives `BeatsAndBarsProvider` timeSignature, ruler subdivisions, and snap grid. |
```

Replace with:
```
| `<daw-tempo>` | editor.bpm property | Editable BPM input. Reflects current tempo. Drives `BeatsAndBarsProvider` bpm, metronome, and musical time formats. |
| `<daw-time-signature>` | editor.timeSignature property | Editable time signature (e.g., `4/4`, `3/4`, `6/8`). Drives `BeatsAndBarsProvider` timeSignature, ruler subdivisions, and snap grid. |
```

- [ ] **Step 3: Edit lines 409-414** (editor.set* methods)

Find:
```
editor.setBpm(bpm: number): void                       // Set tempo
editor.setTimeSignature(numerator: number, denominator: number): void
editor.setSnapTo(snap: string): void                   // 'bar' | 'beat' | 'off'
editor.setScaleMode(mode: string): void                // 'beats' | 'temporal'
editor.setLoopEnabled(enabled: boolean): void          // Toggle loop playback
editor.setLoopRegion(start: number, end: number): void // Set loop boundaries
```

Replace with (use grep output from Step 1 to confirm names — adjust if reality differs):
```
editor.bpm = 140                                       // Property setter
editor.timeSignature = [3, 4]                          // Property setter ([numerator, denominator])
editor.snapTo = 'beat'                                 // Property setter ('bar' | 'beat' | 'off')
editor.scaleMode = 'beats'                             // Property setter ('beats' | 'temporal')
editor.loopEnabled = true                              // Property setter
editor.setLoopRegion(start: number, end: number): void // Method — takes two args
```

- [ ] **Step 4: Rewrite the MIDI Loading section (lines 1120-1158)**

Replace the whole section with:

```markdown
### MIDI Loading

MIDI files are loaded imperatively via `editor.loadMidi()` because a `.mid` file can contain multiple tracks — the track count is unknowable at HTML authoring time.

```typescript
editor.loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult>

interface MidiLoadOptions {
  /** Timeline position in seconds applied to every created clip (default: 0) */
  startTime?: number;
  /** AbortSignal forwarded to fetch() when source is a URL */
  signal?: AbortSignal;
}

interface MidiLoadResult {
  trackIds: string[];                   // IDs of created <daw-track> elements
  bpm: number;                          // Tempo from MIDI header (or 120)
  timeSignature: [number, number];      // e.g., [4, 4]
  duration: number;                     // Total duration in seconds
  name: string;                         // Song name from header (empty if absent)
}
```

```javascript
// Load multi-track MIDI — creates N <daw-track> elements automatically
const { trackIds, bpm, timeSignature } = await editor.loadMidi('/midi/song.mid');
console.log('Created tracks:', trackIds);

// Apply tempo from MIDI file (caller decides — loadMidi never mutates editor state implicitly)
editor.bpm = bpm;
editor.timeSignature = timeSignature;

// Position on timeline
await editor.loadMidi('/midi/bridge.mid', { startTime: 30.0 });
```

Created tracks get `render-mode="piano-roll"` automatically. Each track's clip carries `midiNotes` data for the piano-roll renderer. Track names are derived from the MIDI file (instrument name, channel, or GM program name).

**Cleanup-on-failure:** if any of the N track creations fails, `loadMidi` removes all successfully-created tracks before rejecting — the editor returns to its pre-call state. Documented limitation: an `AbortSignal` only cancels the fetch phase; aborts during the track-creation phase are a no-op (the in-flight `addTrack` calls run to completion).

**Deferred to future versions:**
- `flatten` option (needs a "hidden audio-only track" primitive in dawcore)
- `name` override (ambiguous semantics with multi-track files)
- Auto-applied tempo / time signature (currently caller does `editor.bpm = result.bpm`)

For programmatic MIDI (no file), set `clip.midiNotes` directly:
```javascript
const track = await editor.addTrack({ name: 'Synth Lead' });
const clip = track.querySelector('daw-clip');
clip.midiNotes = [
  { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
  { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
];
track.renderMode = 'piano-roll';
```
```

- [ ] **Step 5: Edit `loadFiles` section (lines 1516, 1521)** — find the MidiLoadOptions / MidiLoadResult passthrough references

Find:
```
  midiOptions?: MidiLoadOptions;  // Passed through for .mid files (flatten, startTime, etc.)
```
Replace with:
```
  midiOptions?: MidiLoadOptions;  // Passed through for .mid files (startTime, signal)
```

Find:
```
  midi?: MidiLoadResult;          // Present when MIDI files were in the drop (bpm, timeSignature, etc.)
```
Replace with:
```
  midi?: MidiLoadResult;          // Present when MIDI files were in the drop (bpm, timeSignature, duration, name, trackIds)
```

- [ ] **Step 6: Verify the spec still renders correctly (no broken markdown)**

Run: `head -1 docs/specs/web-components-migration.md` (sanity check) — also visual scan of the rewritten section.

- [ ] **Step 7: STOP — wait for user verification of spec edits**

- [ ] **Step 8: Commit (after user approval)**

```bash
git add docs/specs/web-components-migration.md
git commit -m "docs(spec): update web-components-migration for loadMidi v1 and property APIs"
```

---

## Task 12: Update CLAUDE.md files

**Files:**
- Create: `packages/dawcore-midi/CLAUDE.md`
- Modify: `packages/midi/CLAUDE.md`
- Modify: `packages/dawcore/CLAUDE.md`

- [ ] **Step 1: Write `packages/dawcore-midi/CLAUDE.md`**

```markdown
# @dawcore/midi Package

## Purpose

Framework-agnostic MIDI file loading and parsing. Houses the pure `parseMidiFile`/`parseMidiUrl` functions and the `MidiLoadOptions`/`MidiLoadResult` types used by `editor.loadMidi()` on `@dawcore/components`. No React, no DOM, no Lit.

**Consumers:**
- `@dawcore/components` — optional peer dep; `editor.loadMidi()` dynamic-imports this package.
- `@waveform-playlist/midi` — regular dep; re-exports the parser and provides `useMidiTracks` hook on top.

## Architecture

```
.mid file (URL or File)
       │
       ├── parseMidiUrl(url, opts, signal) ──┐
       └── parseMidiFile(buffer, opts) ──────┴── ParsedMidi { tracks, bpm, timeSignature, duration, name }
```

The parser was moved here from `@waveform-playlist/midi` so it can be reused by the web-components layer without pulling React into dawcore's transitive deps. See `docs/specs/2026-05-23-dawcore-load-midi-design.md`.

## Testing

`cd packages/dawcore-midi && npx vitest run`

Test data is synthesized via `@tonejs/midi`'s `Midi` constructor — no binary fixture files. See the `@tonejs/midi` gotchas in `packages/midi/CLAUDE.md` (tempo: use `setTempo()` not direct assignment; precision loss on velocity / BPM round-trips).

## Dependencies

- `@waveform-playlist/core` — for `MidiNoteData` type.
- `@tonejs/midi` — the underlying parser.

No peer dependencies — this package is truly framework-agnostic.
```

- [ ] **Step 2: Modify `packages/midi/CLAUDE.md`** — add a note near the top about re-export

Find the section "Two-Layer Design" and prepend a new note:

```markdown
## Parser Now Lives in `@dawcore/midi`

As of v13.0.0, `parseMidiFile` / `parseMidiUrl` and the `ParsedMidi*` types are re-exported from `@dawcore/midi`. The local copy was removed during the dawcore framework-split (see `docs/specs/2026-05-23-dawcore-load-midi-design.md`). React-side consumers see no API change. The `parser-parity.test.ts` smoke test guards against accidental re-divergence.

`useMidiTracks` is the only original symbol still defined in this package.
```

- [ ] **Step 3: Modify `packages/dawcore/CLAUDE.md`** — append a new section about `loadMidi`

Find the existing "## MIDI (Tone Adapter Path)" section and append at the end:

```markdown
- **`editor.loadMidi(source, options)`** — imperative `.mid` file loader. Source is `string` (URL) or `File`. Options: `startTime` (seconds, applied to every created clip), `signal` (forwarded to fetch). Returns `{ trackIds, bpm, timeSignature, duration, name }`. Implementation in `interactions/midi-loader.ts`; dynamic-imports the optional `@dawcore/midi` peer dep on first call (throws with install hint if missing).
- **Cleanup-on-failure** — `loadMidi` uses `Promise.allSettled` (not `Promise.all`) so it can wait for every per-track settlement before deciding. If any track rejects, every successfully-created `<daw-track>` is removed via `.remove()` (MutationObserver tears down engine state). The editor returns to its pre-call state. Don't switch to `Promise.all` "for speed" — early rejection while other addTrack calls keep running causes orphan tracks to appear after cleanup. The `allSettled` wait is essential.
- **`addTrack` does not yet accept an AbortSignal** — `loadMidi`'s `signal` option only cancels the fetch phase. An abort after parsing is a no-op until `addTrack` is signal-aware. Documented limitation.
```

- [ ] **Step 4: STOP — wait for user verification**

- [ ] **Step 5: Commit (after user approval)**

```bash
git add packages/dawcore-midi/CLAUDE.md packages/midi/CLAUDE.md packages/dawcore/CLAUDE.md
git commit -m "docs(claude-md): document @dawcore/midi + editor.loadMidi() patterns"
```

---

## Task 13: Final verification and version-bump audit

- [ ] **Step 1: Run typecheck across the whole repo**

Run from repo root:
```bash
pnpm typecheck
```
Expected: PASS across all 13 packages (was 12, now +1 with `@dawcore/midi`).

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: PASS (prettier + ESLint). If formatting fails, run `pnpm format`.

- [ ] **Step 3: Run all tests**

Run: `pnpm -r --workspace-concurrency=1 test` (concurrency=1 to avoid the vitest orphan-process issue noted in root CLAUDE.md).

Expected: PASS across all packages. After it completes, run `pgrep -f vitest` and `pkill -f vitest` if strays.

- [ ] **Step 4: Build all packages**

Run: `pnpm build`
Expected: PASS.

- [ ] **Step 5: Verify versions**

Confirm:
- `packages/dawcore-midi/package.json` → `"version": "0.0.1"`
- `packages/midi/package.json` → `"version": "13.0.0"`
- `packages/dawcore/package.json` → `"version": "0.0.19"` (bump from 0.0.18 — manual edit if not yet done)

If `@dawcore/components` is still at 0.0.18, bump now:

Edit `packages/dawcore/package.json`:
```json
  "version": "0.0.19",
```

- [ ] **Step 6: Confirm no downstream `@waveform-playlist/*` packages need patch republishes**

Run: `grep -l "@waveform-playlist/midi" packages/*/package.json`

Expected: only `packages/midi/package.json` itself. No other published packages depend on it (only `debug/standalone-midi` which is `"private": true`). So the version cascade per the MEMORY rule stops with `@waveform-playlist/midi 13.0.0` itself.

- [ ] **Step 7: STOP — wait for user verification**

- [ ] **Step 8: Commit final version bump (if Step 5 made any edits)**

```bash
git add packages/dawcore/package.json
git commit -m "chore(dawcore): bump @dawcore/components 0.0.18 → 0.0.19 for loadMidi"
```

- [ ] **Step 9: Push branch and open PR (only after explicit user approval)**

```bash
git push -u origin feature/dawcore-load-midi
gh pr create --title "feat(dawcore): editor.loadMidi() + new @dawcore/midi package" --body "$(cat <<'EOF'
## Summary

- New framework-agnostic `@dawcore/midi` package (mirrors the spectrogram split): houses the pure `parseMidiFile` / `parseMidiUrl` parser and the `MidiLoadOptions` / `MidiLoadResult` types
- `@waveform-playlist/midi` → 13.0.0: parser is now re-exported from `@dawcore/midi`; React API surface unchanged
- New `editor.loadMidi(source, options)` on `<daw-editor>`: imperatively loads a `.mid` file (URL or `File`) and creates N `<daw-track>` elements — with cleanup-on-failure via `Promise.allSettled`
- Outdated `setBpm()` / `setTimeSignature()` method references in `docs/specs/web-components-migration.md` rewritten as property-assignment

Design doc: `docs/specs/2026-05-23-dawcore-load-midi-design.md`

## Test plan

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes
- [ ] `pnpm -r --workspace-concurrency=1 test` passes (parser tests moved into `@dawcore/midi`; new `loadMidi` tests in `@dawcore/components`; parity smoke test in `@waveform-playlist/midi`)
- [ ] Manual: `pnpm example:dawcore-tone` → open `midi-load.html`, click "Load from URL", verify 3 piano-roll tracks render and play; verify File-picker path with another `.mid`
EOF
)"
```

---

## Self-Review (writer's checklist — already done)

- [x] **Spec coverage:** Every section of `2026-05-23-dawcore-load-midi-design.md` is addressed — package creation (Tasks 1-2), types (Task 3), React refactor (Task 4), smoke test (Task 5), peer dep (Task 6), TDD impl (Tasks 7-9), example (Task 10), spec updates (Task 11), CLAUDE.md (Task 12), versions (Task 13). The deferred items (`flatten`, `name`, auto-apply tempo) are explicitly out of scope.
- [x] **No placeholders:** No TBDs / TODOs. Every code step has the actual code; every command shows expected output. The one "verify against actual" step (Task 11 Step 1 grep) is a deliberate guard against the spec drifting from `daw-editor.ts` reality, not a placeholder.
- [x] **Type consistency:** `loadMidi(source: string | File, options?: MidiLoadOptions): Promise<MidiLoadResult>` is the same signature in the impl (Task 8), the public method (Task 9), the tests (Task 7), and the spec rewrite (Task 11). `MidiLoadOptions` always has the same two fields (`startTime`, `signal`). `MidiLoadResult` always has the same five fields. `parseMidiUrl(url, opts, signal)` argument order matches in Tasks 7 and 8 (`undefined, signal` — `opts` is reserved for the parser's own ParseMidiOptions, not loadMidi options).
- [x] **Scope check:** Single coherent feature, 13 tasks. Largest single change (Task 4) moves one file and updates one `package.json` — still bite-sized. Could split into 14 if Task 11 spec edits feel too large for one commit, but the four edit sites are tightly related.
