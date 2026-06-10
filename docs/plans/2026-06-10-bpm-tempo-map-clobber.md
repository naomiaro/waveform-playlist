# Fix #407: `editor.bpm` Tempo-Map Clobber — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `editor.bpm` display-only when tick callbacks are present (dawcore), and make `Transport.setTempo` refuse defaulted tick-0 writes on multi-entry tempo maps (transport).

**Architecture:** Two independent layers per the spec (`docs/specs/2026-06-10-bpm-tempo-map-clobber-design.md`). Layer 1: `<daw-editor>` skips `engine.setTempo` forwarding (setter + `_buildEngine`) when both `secondsToTicks`/`ticksToSeconds` callbacks are set. Layer 2: `Transport.setTempo` warns and returns when `atTick` is undefined and the `TempoMap` has >1 entry; needs a new `TempoMap.entryCount` getter.

**Tech Stack:** TypeScript, Lit (dawcore), vitest (happy-dom for dawcore, node for transport), pnpm workspace.

**Branch:** `fix/407-bpm-tempo-map-clobber` (already created; spec committed).

---

### Task 1: `TempoMap.entryCount` getter

**Files:**
- Modify: `packages/transport/src/timeline/tempo-map.ts` (class `TempoMap`, after `getTempo` around line 53)
- Test: `packages/transport/src/__tests__/tempo-map.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/transport/src/__tests__/tempo-map.test.ts` (check the file's existing imports — it already imports `TempoMap`; ensure `Tick` is imported as `import type { Tick } from '../types';`):

```typescript
describe('entryCount', () => {
  it('returns 1 for a new map', () => {
    const map = new TempoMap();
    expect(map.entryCount).toBe(1);
  });

  it('increments when an entry is added at a later tick', () => {
    const map = new TempoMap();
    map.setTempo(140, 960 as Tick);
    expect(map.entryCount).toBe(2);
  });

  it('stays 1 when the tick-0 entry is overwritten', () => {
    const map = new TempoMap();
    map.setTempo(90);
    expect(map.entryCount).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run src/__tests__/tempo-map.test.ts`
Expected: 3 FAIL — `entryCount` is `undefined` (`expected undefined to be 1`).

- [ ] **Step 3: Implement the getter**

In `packages/transport/src/timeline/tempo-map.ts`, after the `getTempo` method (line ~53):

```typescript
  /** Number of tempo entries in the map. Always >= 1 — the tick-0 entry is
   *  permanent. Used by Transport.setTempo to detect multi-entry maps. */
  get entryCount(): number {
    return this._entries.length;
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/transport && npx vitest run src/__tests__/tempo-map.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/transport/src/timeline/tempo-map.ts packages/transport/src/__tests__/tempo-map.test.ts
git commit -m "feat(transport): add TempoMap.entryCount getter"
```

---

### Task 2: `Transport.setTempo` multi-entry guard

**Files:**
- Modify: `packages/transport/src/transport.ts` (`setTempo`, line ~460)
- Test: `packages/transport/src/__tests__/transport.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/transport/src/__tests__/transport.test.ts` inside the top-level describe (uses the file's existing `mockAudioContext()` helper; `Tick` is already imported):

```typescript
describe('setTempo multi-entry guard (#407)', () => {
  it('refuses a defaulted setTempo when the tempo map has multiple entries', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setTempo(100, 0 as Tick);
    transport.setTempo(140, 960 as Tick);

    transport.setTempo(120); // defaulted atTick — "display BPM" style call

    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Pass an explicit atTick'));
    expect(transport.getTempo(0 as Tick)).toBe(100);
  });

  it('does not emit tempochange when the guard refuses', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setTempo(140, 960 as Tick);
    const listener = vi.fn();
    transport.on('tempochange', listener);

    transport.setTempo(120);

    expect(listener).not.toHaveBeenCalled();
  });

  it('applies an explicit atTick 0 write on a multi-entry map', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);
    transport.setTempo(100, 0 as Tick);
    transport.setTempo(140, 960 as Tick);

    transport.setTempo(120, 0 as Tick); // explicit — escape hatch

    expect(warnSpy).not.toHaveBeenCalled();
    expect(transport.getTempo(0 as Tick)).toBe(120);
  });

  it('applies a defaulted setTempo on a single-entry map', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ctx = mockAudioContext();
    const transport = new Transport(ctx);

    transport.setTempo(120);

    expect(warnSpy).not.toHaveBeenCalled();
    expect(transport.getTempo()).toBe(120);
  });
});
```

Note: if `transport.on('tempochange', ...)` doesn't exist with that signature, check how existing tests in this file subscribe to transport events (grep `tempochange` / `_emit` usage) and adapt the second test to the actual listener API. If there is no public listener API, drop the second test — the first test's `getTempo` assertion already proves the early return.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/transport && npx vitest run src/__tests__/transport.test.ts`
Expected: tests 1–2 FAIL (no warn, tick-0 tempo becomes 120); tests 3–4 PASS (existing behavior).

- [ ] **Step 3: Implement the guard**

In `packages/transport/src/transport.ts`, replace the `setTempo` method (line ~460):

```typescript
  setTempo(bpm: number, atTick?: Tick, options?: SetTempoOptions): void {
    if (atTick === undefined && this._tempoMap.entryCount > 1) {
      console.warn(
        '[waveform-playlist] Transport.setTempo: refusing defaulted tick-0 write — the tempo map has ' +
          this._tempoMap.entryCount +
          ' entries. Pass an explicit atTick to modify a multi-entry tempo map.'
      );
      return;
    }
    this._tempoMap.setTempo(bpm, atTick, options);
    // Recompute cached loop start — tempo change invalidates tick→seconds mapping
    if (this._loopEnabled) {
      this._loopStartSeconds = this._tempoMap.ticksToSeconds(this._loopStartTick);
    }
    this._emit('tempochange', { bpm, atTick: atTick ?? (0 as Tick) });
  }
```

- [ ] **Step 4: Run the full transport suite**

Run: `cd packages/transport && npx vitest run`
Expected: all PASS. If any existing test calls `setTempo(bpm)` defaulted *after* installing multi-entry maps and now fails, that test was relying on the clobber — update it to pass an explicit `atTick: 0 as Tick` and note it in the commit message.

- [ ] **Step 5: Commit**

```bash
git add packages/transport/src/transport.ts packages/transport/src/__tests__/transport.test.ts
git commit -m "fix(transport): refuse defaulted tick-0 setTempo on multi-entry tempo maps (#407)"
```

---

### Task 3: dawcore — `bpm` display-only when tick callbacks present

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (`bpm` setter line ~254, callback property docs line ~287, `_buildEngine` line ~1669)
- Test: Create `packages/dawcore/src/__tests__/daw-editor-bpm.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `packages/dawcore/src/__tests__/daw-editor-bpm.test.ts`. Setup (imports, `makeMockAdapter`) is copied from `daw-editor-midi.test.ts` per dawcore CLAUDE.md ("copy `daw-editor-midi.test.ts:makeMockAdapter` rather than hand-rolling a thinner mock"):

```typescript
import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-editor');
});

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeMockAdapter() {
  // Minimal PlayoutAdapter stub — engine accepts but doesn't actually play.
  const ctx = {
    sampleRate: 48000,
    state: 'suspended' as AudioContextState,
    destination: {} as AudioDestinationNode,
    resume: vi.fn().mockResolvedValue(undefined),
    decodeAudioData: vi.fn(),
    close: vi.fn().mockResolvedValue(undefined),
  };
  return {
    audioContext: ctx as unknown as AudioContext,
    ppqn: 960,
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    setTempo: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    init: vi.fn().mockResolvedValue(undefined),
    dispose: vi.fn(),
    isPlaying: vi.fn().mockReturnValue(false),
  };
}

async function makeEditor(opts: { callbacks?: boolean } = {}) {
  const editor = document.createElement('daw-editor') as any;
  const adapter = makeMockAdapter();
  editor.adapter = adapter;
  if (opts.callbacks) {
    // Both callbacks present = external tempo map is authoritative
    editor.secondsToTicks = (s: number) => Math.round((s * 120 * 960) / 60);
    editor.ticksToSeconds = (t: number) => (t * 60) / (120 * 960);
  }
  document.body.appendChild(editor);
  await editor.ready(); // builds the engine without tracks
  return { editor, adapter };
}

describe('<daw-editor> bpm tempo forwarding (#407)', () => {
  it('forwards bpm to the adapter when no tick callbacks are set', async () => {
    const { editor, adapter } = await makeEditor();
    adapter.setTempo.mockClear();

    editor.bpm = 140;

    expect(adapter.setTempo).toHaveBeenCalledWith(140, undefined);
    document.body.removeChild(editor);
  });

  it('is display-only when both tick callbacks are set', async () => {
    const { editor, adapter } = await makeEditor({ callbacks: true });
    adapter.setTempo.mockClear();

    editor.bpm = 140;

    expect(adapter.setTempo).not.toHaveBeenCalled();
    expect(editor.bpm).toBe(140); // readout still updates
    document.body.removeChild(editor);
  });

  it('still forwards when only one callback is set (both required)', async () => {
    const { editor, adapter } = await makeEditor();
    editor.secondsToTicks = (s: number) => Math.round((s * 120 * 960) / 60);
    adapter.setTempo.mockClear();

    editor.bpm = 140;

    expect(adapter.setTempo).toHaveBeenCalledWith(140, undefined);
    document.body.removeChild(editor);
  });

  it('skips the initial engine-build setTempo forward when callbacks are set', async () => {
    const { editor, adapter } = await makeEditor({ callbacks: true });

    expect(adapter.setTempo).not.toHaveBeenCalled();
    document.body.removeChild(editor);
  });

  it('forwards the initial bpm at engine build without callbacks', async () => {
    const { editor, adapter } = await makeEditor();

    expect(adapter.setTempo).toHaveBeenCalledWith(120);
    document.body.removeChild(editor);
  });
});
```

Note: if `editor.ready()` does not exist or rejects without tracks, check `packages/dawcore/src/elements/daw-editor.ts` for the public engine-bootstrap method (grep `ready()`; per dawcore CLAUDE.md "Programmatic Track + Clip API": `editor.ready()` builds the engine without tracks). Fallback: use `editor.addTrack({ name: 'T', midi: { notes: [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }] } })` and await it.

- [ ] **Step 2: Run tests to verify the right ones fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-bpm.test.ts`
Expected: tests "is display-only…" and "skips the initial…" FAIL (`setTempo` IS called). The other three PASS (existing behavior).

- [ ] **Step 3: Implement the dawcore changes**

In `packages/dawcore/src/elements/daw-editor.ts`:

(a) Add a helper getter immediately after the `ticksToSeconds` property declaration (line ~292):

```typescript
  /** True when the consumer provided BOTH tick conversion callbacks — the
   *  external tempo map is authoritative and `bpm` is display/grid-only (#407). */
  get _hasTickCallbacks(): boolean {
    return !!(this.secondsToTicks && this.ticksToSeconds);
  }
```

(b) Update the `bpm` setter (line ~254):

```typescript
  set bpm(value: number) {
    const old = this._bpm;
    if (!Number.isFinite(value) || value <= 0) return;
    this._bpm = value;
    // Forward to engine (which forwards to adapter's Transport) — unless the
    // consumer provided tick callbacks, in which case the external tempo map
    // is authoritative and bpm is display/grid-only (#407).
    if (this._engine && !this._hasTickCallbacks) {
      this._engine.setTempo(value);
    }
    this.requestUpdate('bpm', old);
  }
```

(c) Update `_buildEngine` (line ~1669) — wrap the initial tempo forward:

```typescript
    // Forward initial tempo if adapter supports it — skipped when tick
    // callbacks are present (external tempo map is authoritative, #407)
    if (!this._hasTickCallbacks) {
      if (adapter.setTempo) {
        adapter.setTempo(this._bpm);
      } else if (this._bpm !== 120) {
        console.warn(
          '[dawcore] Adapter does not implement setTempo. ' +
            'Initial BPM ' +
            this._bpm +
            ' will not be applied — clips may use wrong tempo.'
        );
      }
    }
```

(d) Update the JSDoc on the callback properties (line ~287) to document the new semantics:

```typescript
  /** Optional tempo-aware conversion: seconds → PPQN ticks. When provided
   *  together with ticksToSeconds, enables variable tempo AND makes `bpm`
   *  display/grid-only (no engine/adapter tempo forwarding — #407). */
  @property({ attribute: false })
  secondsToTicks?: (seconds: number) => number;
  /** Optional tempo-aware conversion: PPQN ticks → seconds. Required alongside secondsToTicks. */
  @property({ attribute: false })
  ticksToSeconds?: (ticks: number) => number;
```

- [ ] **Step 4: Run the new tests, then the full dawcore suite**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-bpm.test.ts`
Expected: all 5 PASS.

Run: `cd packages/dawcore && npx vitest run`
Expected: all PASS (no existing test sets tick callbacks and asserts setTempo forwarding).

- [ ] **Step 5: Typecheck dawcore (per-package — root typecheck has a known pre-existing failure)**

```bash
cd packages/dawcore && pnpm typecheck
```
Expected: clean. (`_hasTickCallbacks` is used in the same change, so `noUnusedLocals` is satisfied.)

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/daw-editor-bpm.test.ts
git commit -m "fix(dawcore): editor.bpm is display-only when tick callbacks are set (#407)"
```

---

### Task 4: Documentation updates

**Files:**
- Modify: `packages/dawcore/CLAUDE.md` ("Variable Tempo" section)
- Modify: `packages/transport/CLAUDE.md` ("Tempo Automation" section)

- [ ] **Step 1: Update dawcore CLAUDE.md**

In `packages/dawcore/CLAUDE.md`, replace the "Variable Tempo" bullet that begins `**Assign \`editor.bpm\` BEFORE installing a tempo curve**` with:

```markdown
- **`editor.bpm` is display-only when tick callbacks are set** — with both `secondsToTicks`/`ticksToSeconds` provided, the setter and `_buildEngine` skip engine/adapter tempo forwarding entirely (the external tempo map is authoritative — #407). Without callbacks, `editor.bpm` forwards to `engine.setTempo` → `adapter.setTempo(bpm, tick 0)` as before. Diagnostic for off-grid beats: constant per-beat offset = pre-roll tempo wrong (check `transport.getTempo(0)`); growing offset = per-beat entries wrong.
```

Also update the "Adapter Pluggability" bullet `**\`editor.bpm\` setter forwards to engine**` to mention the exception:

```markdown
- **`editor.bpm` setter forwards to engine** — Calls `engine.setTempo(value)` when engine exists, UNLESS both tick callbacks are set (then display-only, #407). `_buildEngine` calls `adapter.setTempo?.(this._bpm)` before creating the engine (same callback guard) so initial `setTracks()` enrichment uses the correct BPM.
```

- [ ] **Step 2: Update transport CLAUDE.md**

In `packages/transport/CLAUDE.md`, append to the "Tempo Automation" section:

```markdown
**Multi-entry guard (#407):** `Transport.setTempo(bpm)` with a defaulted `atTick` warns and refuses when the TempoMap has more than one entry — a defaulted call is the single-BPM convenience path and must not clobber a consumer-installed tempo curve's tick-0 entry. Pass an explicit `atTick: 0 as Tick` to genuinely modify a multi-entry map. `TempoMap.entryCount` (always >= 1) backs the check.
```

- [ ] **Step 3: Commit**

```bash
git add packages/dawcore/CLAUDE.md packages/transport/CLAUDE.md
git commit -m "docs: document bpm display-only semantics and setTempo multi-entry guard (#407)"
```

---

### Task 5: Version bumps

**Files:**
- Modify: `packages/transport/package.json` (version `0.0.11` → `0.0.12`)
- Modify: `packages/dawcore/package.json` (version `0.0.22` → `0.0.23`)

- [ ] **Step 1: Bump versions**

In `packages/transport/package.json`: `"version": "0.0.12"`.
In `packages/dawcore/package.json`: `"version": "0.0.23"`.

Dependency check (already verified during planning): no `@waveform-playlist/*` package depends on `@dawcore/transport`; dawcore's peer range is `>=0.0.7` (covers 0.0.12) — no other republish needed. `website` uses `workspace:*` (not published).

- [ ] **Step 2: Refresh lockfile if needed**

```bash
pnpm install
git status --short pnpm-lock.yaml
```
If the lockfile changed, include it in the commit.

- [ ] **Step 3: Commit**

```bash
git add packages/transport/package.json packages/dawcore/package.json pnpm-lock.yaml
git commit -m "chore: bump @dawcore/transport 0.0.12, @dawcore/components 0.0.23"
```

---

### Task 6: Full verification

- [ ] **Step 1: Build transport, then full build**

```bash
pnpm --filter @dawcore/transport build && pnpm build
```
Expected: success. (Transport built first so dawcore's DTS sees the new `entryCount`.)

- [ ] **Step 2: Lint from repo root**

```bash
pnpm lint
```
Expected: clean. If prettier complains, run `pnpm format` and re-check.

- [ ] **Step 3: Re-run both package test suites**

```bash
cd packages/transport && npx vitest run && cd ../dawcore && npx vitest run
```
Expected: all PASS.

- [ ] **Step 4: Kill stray vitest processes**

```bash
pgrep -f vitest && pkill -f vitest || echo "no strays"
```

- [ ] **Step 5: Commit any stragglers and push**

```bash
git status --short
git push -u origin fix/407-bpm-tempo-map-clobber
```

---

### Task 7: Pull request

- [ ] **Step 1: Remove working docs from the branch** (project convention — spec/plan are working documents; the PR description is the durable record)

```bash
git rm docs/specs/2026-06-10-bpm-tempo-map-clobber-design.md docs/plans/2026-06-10-bpm-tempo-map-clobber.md
git commit -m "docs: remove working spec/plan before merge"
git push
```

- [ ] **Step 2: Create the PR**

```bash
gh pr create --title "fix: editor.bpm no longer clobbers variable-tempo sessions (#407)" --body "$(cat <<'EOF'
Fixes #407.

## What

Two-layer fix for the `editor.bpm` → tick-0 tempo-map clobber:

1. **dawcore:** `editor.bpm` is display/grid-only when both `secondsToTicks`/`ticksToSeconds` callbacks are set (the established "external tempo map is authoritative" signal). Covers both clobber points: the `bpm` setter and `_buildEngine`'s initial `adapter.setTempo` forward. Also skips `_recomputeStartSamples()` on display-BPM writes (the authoritative map didn't change).
2. **transport:** `Transport.setTempo(bpm)` with a defaulted `atTick` warns and refuses when the TempoMap has >1 entry. Explicit `atTick: 0` still applies (escape hatch). Single-entry maps unchanged. New `TempoMap.entryCount` getter backs the check.

## Test plan

- [ ] transport: entryCount getter (3 tests), setTempo guard (4 tests) — `cd packages/transport && npx vitest run`
- [ ] dawcore: bpm forwarding with/without callbacks, _buildEngine skip (5 tests) — `cd packages/dawcore && npx vitest run`
- [ ] `pnpm build`, `pnpm lint`, per-package typecheck

Versions: `@dawcore/transport` 0.0.12, `@dawcore/components` 0.0.23.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 3: Wait for user approval before merging** (never merge without explicit approval; squash-merge when approved)
