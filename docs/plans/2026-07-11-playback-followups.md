# Annotation Playback Follow-ups (#608, #609) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Engine observes Tone-adapter bounded-playback completion (#608) via an optional `onPlaybackEnded` adapter hook; annotation boundary write-back diffs against live element values by id (#609).

**Architecture:** #608 — `TonePlayout.setOnPlaybackComplete` already fires at the bounded end (Transport `scheduleOnce`) and the adapter already flips its internal `_isPlaying`; we add an `onPlaybackEnded` pass-through on the adapter and subscribe the engine, which defers `stop()` by one microtask (the callback runs inside Tone's unguarded tick chain — stopping the Transport from within it is the risk `queueMicrotask` sidesteps). #609 — both write-back helpers drop the index-paired `before` array and diff each result against the id-resolved element's current values.

**Tech Stack:** TypeScript, vitest. Branch: `fix/annotation-playback-followups` (checked out; spec committed).

## Global Constraints

- Commit per task; conventional commits; NO attribution footers; git from repo root.
- `npx prettier --check` on changed files before every commit (fix with `--write`).
- `pnpm typecheck` resolves workspace deps via `dist/` — build engine (`pnpm --filter @waveform-playlist/engine build`) after Task 1 and BEFORE playout/dawcore work; downstream vitest exercises engine via dist (root CLAUDE.md).
- Hook semantics (exact): `onPlaybackEnded?(callback: (() => void) | null): void` — adapter invokes the callback ONLY when playback completes on its own (duration-limited end); never for consumer-initiated stop/pause; `null` unsubscribes.
- Engine handler: no-op unless `_isPlaying`; defers `this.stop()` via `queueMicrotask` (escape Tone's tick chain); re-checks `_isPlaying` inside the microtask (a consumer stop can land in between).
- #609: the changed-edge check exists to suppress spurious `daw-annotation-update` events — it must compare against the id-resolved element's CURRENT values, never an index-paired snapshot.
- Existing suites must stay green unmodified except where signatures change (the helpers' call sites).

---

### Task 1: Engine — `onPlaybackEnded` hook + subscription

**Files:**
- Modify: `packages/engine/src/types.ts` (PlayoutAdapter interface)
- Modify: `packages/engine/src/PlaylistEngine.ts` (constructor ~line 57-60, `dispose()` ~line 796)
- Test: `packages/engine/src/__tests__/` — find the file testing engine playback with a mock adapter (grep `adapter.play` in `src/__tests__/`) and append there; if none fits, create `playbackEnded.test.ts`.

**Interfaces:**
- Produces: `PlayoutAdapter.onPlaybackEnded?(callback: (() => void) | null): void` (optional member, doc comment per Global Constraints semantics). Engine subscribes in the constructor when the adapter defines it; unsubscribes with `null` in `dispose()` BEFORE `adapter.dispose()`.

- [ ] **Step 1: Write the failing tests** (use the file's existing mock-adapter helper if present; otherwise this minimal mock — it must satisfy the constructor's requirements: check `PlaylistEngineOptions` and existing tests' mock shape and reuse it, adding `onPlaybackEnded: vi.fn()`)

```typescript
describe('bounded playback completion (onPlaybackEnded)', () => {
  it('subscribes when the adapter exposes the hook and stops on completion', async () => {
    const adapter = makeMockAdapter(); // existing helper + onPlaybackEnded: vi.fn()
    adapter.onPlaybackEnded = vi.fn();
    const engine = new PlaylistEngine({ adapter, sampleRate: 48000 });
    expect(adapter.onPlaybackEnded).toHaveBeenCalledTimes(1);
    const cb = adapter.onPlaybackEnded.mock.calls[0][0] as () => void;

    const stopEvents: number[] = [];
    engine.on('stop', () => stopEvents.push(1));
    engine.play(1, 2);
    expect(engine.getState().isPlaying).toBe(true);
    cb(); // adapter reports bounded completion
    expect(engine.getState().isPlaying).toBe(true); // deferred — not yet
    await Promise.resolve(); // flush the microtask
    expect(engine.getState().isPlaying).toBe(false);
    expect(stopEvents).toHaveLength(1);
    expect(adapter.stop).toHaveBeenCalled();
  });

  it('completion callback is a no-op when not playing (and after a consumer stop raced in)', async () => {
    const adapter = makeMockAdapter();
    adapter.onPlaybackEnded = vi.fn();
    const engine = new PlaylistEngine({ adapter, sampleRate: 48000 });
    const cb = adapter.onPlaybackEnded.mock.calls[0][0] as () => void;
    const stopEvents: number[] = [];
    engine.on('stop', () => stopEvents.push(1));
    cb(); // never played
    await Promise.resolve();
    expect(stopEvents).toHaveLength(0);
    // raced: playing → callback fires → consumer stops before the microtask runs
    engine.play(0);
    cb();
    engine.stop();
    const stopsAfterConsumerStop = stopEvents.length; // 1 from the consumer stop
    await Promise.resolve();
    expect(stopEvents).toHaveLength(stopsAfterConsumerStop); // microtask no-ops
  });

  it('dispose unsubscribes with null before adapter.dispose', () => {
    const adapter = makeMockAdapter();
    const calls: string[] = [];
    adapter.onPlaybackEnded = vi.fn(() => calls.push('sub'));
    adapter.dispose = vi.fn(() => calls.push('dispose'));
    const engine = new PlaylistEngine({ adapter, sampleRate: 48000 });
    engine.dispose();
    expect(adapter.onPlaybackEnded).toHaveBeenLastCalledWith(null);
    expect(calls[calls.length - 1]).toBe('dispose'); // null-unsubscribe precedes dispose
  });

  it('adapters without the hook work unchanged', () => {
    const adapter = makeMockAdapter();
    delete (adapter as Record<string, unknown>).onPlaybackEnded;
    expect(() => new PlaylistEngine({ adapter, sampleRate: 48000 })).not.toThrow();
  });
});
```

(Adjust `PlaylistEngineOptions` fields to what the constructor actually requires — copy the file's existing engine construction. If `engine.play` requires tracks first, use the file's established minimal-track setup.)

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/engine && npx vitest run src/__tests__/<file>.ts`
Expected: FAIL — `adapter.onPlaybackEnded` never called (engine doesn't subscribe).

- [ ] **Step 3: Implement**

`types.ts` — add to `PlayoutAdapter` after `isPlaying()`:

```typescript
  /** Subscribe to adapter-initiated playback completion (duration-limited
   *  play(start, end) reaching its end). NOT fired for consumer-initiated
   *  stop()/pause(). Pass null to unsubscribe. Optional — adapters without
   *  self-terminating playback (or whose consumers poll) omit it. */
  onPlaybackEnded?(callback: (() => void) | null): void;
```

`PlaylistEngine.ts` constructor — after `this._adapter = options.adapter ?? null;`:

```typescript
    // Bounded playback (#608): adapters that self-terminate at an endTime
    // report completion here. Deferred via queueMicrotask — the Tone adapter
    // fires this from inside the Transport tick chain, which catches nothing;
    // stopping the Transport re-entrantly from a tick callback is the hazard
    // the microtask sidesteps. Re-check _isPlaying inside: a consumer stop()
    // can land between the callback and the microtask.
    this._adapter?.onPlaybackEnded?.(() => {
      queueMicrotask(() => {
        if (this._isPlaying) {
          this.stop();
        }
      });
    });
```

`dispose()` — before `this._adapter?.dispose();`:

```typescript
    this._adapter?.onPlaybackEnded?.(null);
```

- [ ] **Step 4: Run tests + full engine suite + build**

Run: `cd packages/engine && npx vitest run` — all pass.
Run: `pnpm --filter @waveform-playlist/engine build` (downstream packages resolve engine via dist).

- [ ] **Step 5: Commit**

```bash
git add packages/engine/src/types.ts packages/engine/src/PlaylistEngine.ts packages/engine/src/__tests__/
git commit -m "feat(engine): onPlaybackEnded adapter hook for bounded playback completion"
```

---

### Task 2: Playout — TonePlayoutAdapter implements the hook

**Files:**
- Modify: `packages/playout/src/TonePlayoutAdapter.ts` (closure field + two existing `setOnPlaybackComplete` sites at ~lines 68 and 237 + method on the returned adapter object; check whether `ToneAdapter`'s type needs the member or inherits it from `PlayoutAdapter` — it extends the engine interface, so no type change needed)
- Test: `packages/playout/src/__tests__/TonePlayoutAdapter.test.ts` (append; it mocks TonePlayout — extend the mock with `setOnPlaybackComplete: vi.fn()` if absent)

**Interfaces:**
- Consumes: `PlayoutAdapter.onPlaybackEnded?` (Task 1; engine dist rebuilt).
- Produces: `adapter.onPlaybackEnded(cb | null)` storing `_onPlaybackEnded` in the closure; BOTH completion wirings (initial playout at ~line 68 and `buildPlayout` at ~line 237) invoke it after flipping `_isPlaying`, inside their existing generation guards.

- [ ] **Step 1: Write the failing tests**

```typescript
describe('onPlaybackEnded', () => {
  it('fires the subscribed callback when the playout reports completion', () => {
    const adapter = createToneAdapter();
    const ended = vi.fn();
    adapter.onPlaybackEnded!(ended);
    // Grab the completion callback the adapter registered on the (mock) playout
    const playoutMock = getLatestTonePlayoutMock(); // per this file's existing mock access pattern
    const completion = playoutMock.setOnPlaybackComplete.mock.calls.at(-1)![0] as () => void;
    completion();
    expect(ended).toHaveBeenCalledTimes(1);
    expect(adapter.isPlaying()).toBe(false); // internal flag flipped before notifying
  });

  it('null unsubscribes', () => {
    const adapter = createToneAdapter();
    const ended = vi.fn();
    adapter.onPlaybackEnded!(ended);
    adapter.onPlaybackEnded!(null);
    const playoutMock = getLatestTonePlayoutMock();
    const completion = playoutMock.setOnPlaybackComplete.mock.calls.at(-1)![0] as () => void;
    completion();
    expect(ended).not.toHaveBeenCalled();
  });

  it('subscription survives the first setTracks build', () => {
    const adapter = createToneAdapter();
    const ended = vi.fn();
    adapter.onPlaybackEnded!(ended);
    adapter.setTracks([]); // triggers buildPlayout → re-registers setOnPlaybackComplete
    const playoutMock = getLatestTonePlayoutMock();
    const completion = playoutMock.setOnPlaybackComplete.mock.calls.at(-1)![0] as () => void;
    completion();
    expect(ended).toHaveBeenCalledTimes(1);
  });
});
```

(Adapt mock access to the file's actual TonePlayout mock structure — read the file's existing tests first; `getLatestTonePlayoutMock` stands for however this file reaches the mock instance. If the mock lacks `setOnPlaybackComplete`, add `setOnPlaybackComplete: vi.fn()` to it — sweep other tests in the file for mock-shape breakage per the dawcore mock-sweep convention.)

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/playout && npx vitest run src/__tests__/TonePlayoutAdapter.test.ts`
Expected: FAIL — `adapter.onPlaybackEnded` is not a function.

- [ ] **Step 3: Implement**

Closure field (next to `_isPlaying`, ~line 73):

```typescript
  let _onPlaybackEnded: (() => void) | null = null;
```

Initial wiring (~line 68) becomes:

```typescript
  playout.setOnPlaybackComplete(() => {
    if (_playoutGeneration === 1) {
      _isPlaying = false;
      _onPlaybackEnded?.();
    }
  });
```

`buildPlayout` wiring (~line 237) becomes:

```typescript
    playout.setOnPlaybackComplete(() => {
      if (generation === _playoutGeneration) {
        _isPlaying = false;
        _onPlaybackEnded?.();
      }
    });
```

Returned adapter object — add the method (near `isPlaying()`):

```typescript
    onPlaybackEnded(callback: (() => void) | null): void {
      _onPlaybackEnded = callback;
    },
```

- [ ] **Step 4: Run the full playout suite**

Run: `cd packages/playout && npx vitest run` — all pass (mock-shape sweep done if needed).
Run: `pnpm --filter @waveform-playlist/playout build`

- [ ] **Step 5: Commit**

```bash
git add packages/playout/src/TonePlayoutAdapter.ts packages/playout/src/__tests__/TonePlayoutAdapter.test.ts
git commit -m "feat(playout): wire bounded-playback completion to the onPlaybackEnded hook (#608)"
```

---

### Task 3: dawcore — #609 live-value diffing in boundary write-back

**Files:**
- Modify: `packages/dawcore/src/elements/daw-annotation-track.ts` (both helpers at ~lines 42-92 + call sites ~278, ~292)
- Modify: `packages/dawcore/src/interactions/annotation-drag.ts` (call sites ~160, ~180, ~207, ~214)
- Test: `packages/dawcore/src/__tests__/daw-annotation-track.test.ts` (regression test) + existing suites green

**Interfaces:**
- Produces: `applyBoundaryResults(elements: DawAnnotationElement[], after: AnnotationData[]): void` and `applyTickBoundaryResults(elements: DawAnnotationElement[], after: AnnotationData[], ticksToSeconds: (ticks: number) => number): void` — `before` parameter REMOVED from both; diff is against the id-resolved element's current values. READ the current implementations first (they are the post-#610 id-matched versions); preserve their doc comments' intent, rewriting the pairing paragraphs.

- [ ] **Step 1: Write the failing regression test** (append to daw-annotation-track.test.ts; the scenario where old index-pairing compared coincidentally-equal values and skipped a write)

```typescript
  it('boundary write-back diffs against live element values, not snapshot pairing (#609)', async () => {
    // Directly exercise the helper with a mismatched-order after array whose
    // values collide with a DIFFERENT element's current values under index
    // pairing. Elements: a(start 1, end 2), b(start 3, end 4).
    const track2 = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track2.innerHTML =
      '<daw-annotation id="a" start="1" end="2">a</daw-annotation>' +
      '<daw-annotation id="b" start="3" end="4">b</daw-annotation>';
    document.body.appendChild(track2);
    await flush();
    const elements = track2.annotationElements;
    // after: b first (order differs from elements' sorted order), and b's new
    // end (2) equals a's CURRENT end — under the old before/after index
    // pairing (before[0] = a) the b-entry compared 2 === 2 and skipped.
    const after = [
      { id: 'b', start: 3, end: 2.5, lines: ['b'] },
      { id: 'a', start: 1, end: 2, lines: ['a'] },
    ];
    applyBoundaryResults(elements, after);
    const bEl = track2.querySelector('#b') as HTMLElement & { end: number };
    expect(bEl.end).toBe(2.5); // written — id-resolved diff sees 4 !== 2.5
    track2.remove();
  });
```

**Adjust the collision construction after reading the CURRENT helper**: the shipped id-matched version resolves the element by `after[i].id` but compares against `before[i]` — craft `after`/element values so the id-resolved element's live value differs from the result while `before[i]` (as callers built it, live-sorted order) equals it. Import `applyBoundaryResults` into the test file if not already imported. Prove RED against the pre-change helper (it must FAIL before your change — if your construction doesn't fail pre-change, rework it until it genuinely discriminates; record the observed pre-fix failure in your report).

- [ ] **Step 2: Run to verify RED** against the unmodified helpers (the test must fail for the pairing reason, not a setup error).

- [ ] **Step 3: Implement**

`applyBoundaryResults` (replace):

```typescript
/**
 * Write boundary-math results back to the <daw-annotation> elements — only
 * edges that actually differ from the element's CURRENT values, so no
 * spurious daw-annotation-update events fire. Targets are resolved by
 * annotation id and diffed against the live element (#609): the math's input
 * snapshot can be ordered differently than the live sorted children mid-drag,
 * so index-paired comparisons are never trustworthy.
 */
export function applyBoundaryResults(
  elements: DawAnnotationElement[],
  after: AnnotationData[]
): void {
  const byId = new Map(elements.map((el) => [el.annotationId, el]));
  for (const next of after) {
    const el = byId.get(next.id);
    if (!el) continue;
    if (el.start !== next.start) el.start = next.start;
    if (el.end !== next.end) el.end = next.end;
  }
}
```

`applyTickBoundaryResults` (replace — same structure; diff ROUNDED ticks against current tick attrs; single-pass seconds re-derive preserved):

```typescript
/**
 * Tick-space sibling of applyBoundaryResults: `after` carries TICK values in
 * start/end. Id-resolved targets diffed against the element's CURRENT values
 * (#609). A tick-based element gets rounded integer ticks PLUS a re-derived
 * seconds cache in the same write pass; a seconds-based element (converted in
 * for mixed-track link math) gets seconds back in ITS authoritative unit and
 * never gains tick attributes.
 */
export function applyTickBoundaryResults(
  elements: DawAnnotationElement[],
  after: AnnotationData[],
  ticksToSeconds: (ticks: number) => number
): void {
  const byId = new Map(elements.map((el) => [el.annotationId, el]));
  for (const next of after) {
    const el = byId.get(next.id);
    if (!el) continue;
    if (el.isTickBased) {
      const startTick = Math.round(next.start);
      const endTick = Math.round(next.end);
      if (el.startTick !== startTick) {
        el.startTick = startTick;
        el.start = ticksToSeconds(startTick);
      }
      if (el.endTick !== endTick) {
        el.endTick = endTick;
        el.end = ticksToSeconds(endTick);
      }
    } else {
      const start = ticksToSeconds(next.start);
      const end = ticksToSeconds(next.end);
      if (el.start !== start) el.start = start;
      if (el.end !== end) el.end = end;
    }
  }
}
```

Call sites — drop the middle argument at all six: `daw-annotation-track.ts` `_moveBoundary` tick branch (`applyTickBoundaryResults(elements, updated, (t) => editor._ticksToSeconds(t))`) and seconds branch (`applyBoundaryResults(elements, updated)`); `annotation-drag.ts` move-tick (~160), move-seconds (~180), cancel-tick (~207: `applyTickBoundaryResults(elements, drag.snapshot, ...)`), cancel-seconds (~214: `applyBoundaryResults(elements, drag.snapshot)`). Delete the now-unused `elements.map(...)`/`tickSpaceData` before-array constructions at those call sites (typecheck's noUnusedLocals will catch stragglers).

**Behavior note for the seconds-based tick-helper branch:** the old code compared tick-domain `next` vs tick-domain `before[i]`; the new code converts to seconds FIRST and compares seconds vs the element's live seconds — same suppression intent, now exact. If any existing test asserted on conversion-rounding hairlines, prefer the new exact-comparison behavior and adjust the assertion (document it).

- [ ] **Step 4: Run the annotation suites, then the FULL dawcore suite**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation-track.test.ts src/__tests__/daw-annotation-track-keyboard.test.ts src/__tests__/annotation-drag.test.ts src/__tests__/daw-editor-annotations.test.ts` then `npx vitest run` (full; `pkill -f vitest` after).
Expected: all green (I1 and snap regression tests from the prior arcs are the guardrails that the semantics didn't drift).

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-annotation-track.ts packages/dawcore/src/interactions/annotation-drag.ts packages/dawcore/src/__tests__/daw-annotation-track.test.ts
git commit -m "fix(dawcore): boundary write-back diffs against live element values (#609)"
```

---

### Task 4: Docs, changesets, verification, PR

**Files:**
- Modify: `packages/engine/CLAUDE.md` (hook doc + narrow the "isPlaying() is defined but not called by engine" known-gap note), `packages/playout/CLAUDE.md` (completion wiring note), `packages/dawcore/CLAUDE.md` (helper signature note in the dual-timebase gotcha)
- Create: `.changeset/playback-followups-engine.md`, `.changeset/playback-followups-playout.md`, `.changeset/playback-followups-dawcore.md`

- [ ] **Step 1: Docs** — one accurate line/edit each: engine CLAUDE.md pattern list gains the `onPlaybackEnded` hook (microtask-deferred stop, null-unsubscribe on dispose) and the known-gap bullet is amended ("bounded completion now observed via onPlaybackEnded; isPlaying() polling still unused by design"); playout CLAUDE.md notes both `setOnPlaybackComplete` wirings notify `_onPlaybackEnded` inside their generation guards; dawcore CLAUDE.md dual-timebase gotcha updates the `applyTickBoundaryResults` sentence to the two-arg live-diff form.

- [ ] **Step 2: Changesets** (all patch):

```md
---
'@waveform-playlist/engine': patch
---

PlayoutAdapter gains optional onPlaybackEnded(callback|null); PlaylistEngine subscribes and stops (microtask-deferred) when bounded playback completes on its own (#608)
```

```md
---
'@waveform-playlist/playout': patch
---

TonePlayoutAdapter reports duration-limited playback completion through onPlaybackEnded — the engine now observes bounded play(start, end) ending on the Tone path (#608)
```

```md
---
'@dawcore/components': patch
---

Annotation boundary write-back diffs against live element values by id, closing the one-frame skipped-write window under reordered drags (#609)
```

- [ ] **Step 3: Full verification sweep**

```bash
pnpm --filter @waveform-playlist/engine build && pnpm --filter @waveform-playlist/playout build
pnpm build
pnpm typecheck
pnpm -w lint          # exit 0 AND 0 errors
cd packages/engine && npx vitest run && cd ../..
cd packages/playout && npx vitest run && cd ../..
cd packages/dawcore && npx vitest run && cd ../..
pkill -f vitest || true
```

- [ ] **Step 4: Commit docs+changesets; remove working docs; push; PR**

```bash
git add packages/engine/CLAUDE.md packages/playout/CLAUDE.md packages/dawcore/CLAUDE.md .changeset/
git commit -m "docs: onPlaybackEnded hook and live-diff write-back notes + changesets"
git rm docs/specs/2026-07-11-playback-followups-design.md docs/plans/2026-07-11-playback-followups.md
git commit -m "chore: remove working design/plan docs for playback follow-ups"
git push -u origin fix/annotation-playback-followups
```

PR title: `fix: bounded-playback completion on the Tone path and live-diff annotation write-back`. Body: gap→fix summary per issue, test plan, and — each with its own keyword — `fixes #608, fixes #609`. **Do not merge** — user approval required, then squash-merge and verify BOTH issues closed (`gh issue view 608/609 --json state`).
