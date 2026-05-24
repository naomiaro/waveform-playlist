# Spectrogram Review Follow-ups — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all consequential issues surfaced by the comprehensive reviews of PR #387 (spectrogram framework split) and PR #390 (viewport-ready dedup) — error handling, type drift, test coverage gaps, doc inaccuracies.

**Architecture:** Eleven thematic commits. Each commit leaves the repo green (typecheck + tests + build pass). No public API breaks for `@dawcore/components` consumers; one additive extension to `@dawcore/spectrogram`'s `ViewportReadyDetail` shape (new `readonly generation` field).

**Tech Stack:** TypeScript strict (ES2020 lib), tsup builds, vitest with happy-dom, Lit reactive controllers.

**Branch:** `fix/spectrogram-review-followups` (already created)

**Source reviews:**
- PR #387 reviews: code, tests, comments, types, errors (5 agents, see chat history 2026-05-24)
- PR #390 reviews: code, tests, comments (3 agents, see chat history 2026-05-24)

---

## Conventions

- **Don't commit between tasks without user approval.** Per the user's `feedback_no_commit_before_testing` rule, run verification at the end of each task and **stop for user confirmation** before `git commit`. The commit step is included in each task but gated.
- **Run from repo root.** `/Users/naomiaro/Code/waveform-playlist/`
- **Type-migration gotcha:** workspace packages resolve via `dist/` for typecheck. After modifying a package's source, build it (`pnpm --filter <package> build`) before downstream typecheck.
- **No `--no-verify`.** Pre-commit hooks must pass.
- **vitest cleanup:** After running tests across multiple packages, check `pgrep -f vitest` for strays; `pkill -f vitest` if needed.

---

## File Structure

### Created
- `packages/core/src/utils/spectrogram-defaults.ts` — single source of truth for default `SpectrogramConfig` + default `ColorMapValue`
- `packages/dawcore/src/__tests__/spectrogram-host-traversal.test.ts` — `<daw-spectrogram>` shadow-DOM tests

### Modified (core)
- `packages/core/src/types/spectrogram.ts` — JSDoc on `SpectrogramConfig` calling out `colorMap` split; export defaults
- `packages/core/src/index.ts` — export `SPECTROGRAM_DEFAULTS` / `DEFAULT_SPECTROGRAM_COLOR_MAP`

### Modified (dawcore-spectrogram)
- `packages/dawcore-spectrogram/src/orchestrator/events.ts` — add `generation` to `ViewportReadyDetail`; add `ViewportErrorDetail` + `viewport-error` event
- `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts` — error handling wrapping `runRender` + `renderRemainingViaIdle`; warnings on silent-skip paths; `registerClip` → `scheduleRender` race fix; `setDevicePixelRatio` validation + generation bump; `setViewport` numeric validation; `readonly` on input types; use `SPECTROGRAM_DEFAULTS`; emit `generation` on `viewport-ready`
- `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts` (types section) — `readonly` on `SpectrogramOrchestratorOptions`, `ClipRegistration`, `CanvasRegistration`, `ViewportState`, `ViewportBounds`
- `packages/dawcore-spectrogram/src/worker/createSpectrogramWorker.ts` — better onerror context, distinguish termination from real failure
- `packages/dawcore-spectrogram/src/worker/createSpectrogramWorkerPool.ts` — fix constructor leak on partial worker creation failure; warn on malformed canvas IDs
- `packages/dawcore-spectrogram/__tests__/orchestrator.test.ts` — tests for setConfig/setColorMap dedup-clearing, multi-track per-trackId, dispose-mid-render, buffer/remaining tier, registerClip pool forwarding, viewportsEqual compile-time guard
- `packages/dawcore-spectrogram/CLAUDE.md` — fix test count (drop hard number), fix subpath rationale, fix tsup `.d.ts` → `.d.mts` mention, fix "rootDir is dropped" phrasing, fix orchestrator-ownership wording

### Modified (dawcore)
- `packages/dawcore/src/types.ts` — drop duplicate `TrackRenderMode`, re-export `RenderMode` from `@waveform-playlist/core`
- `packages/dawcore/src/elements/daw-track.ts` — use `RenderMode` (which now includes `'both'`)
- `packages/dawcore/src/elements/daw-spectrogram.ts` — `_findHostEditor()` warn-once on null; tests for shadow-DOM traversal
- `packages/dawcore/src/elements/daw-editor.ts` — fix `_maybeRegisterSpectrogramClipAudio` JSDoc contradiction
- `packages/dawcore/src/events.ts` — add `daw-spectrogram-error` event detail
- `packages/dawcore/src/controllers/spectrogram-controller.ts` — re-dispatch `viewport-error` as `daw-spectrogram-error`; carry `generation` on the re-dispatched ready event; use `SPECTROGRAM_DEFAULTS`
- `packages/dawcore/CLAUDE.md` — dedupe shadow-DOM explanation (link to standalone section); PR #390 JSDoc carry-overs

### Modified (spectrogram React package)
- `packages/spectrogram/CLAUDE.md` — align ownership wording with dawcore-spectrogram CLAUDE.md

---

## Task 1: Add `viewport-error` event + `generation` on `viewport-ready`

Adds a failure-side event so consumers can react to render failures (the orchestrator currently has no observable failure surface). Also adds `generation` to the ready detail (huge debugging payoff per type-design review).

**Files:**
- Modify: `packages/dawcore-spectrogram/src/orchestrator/events.ts`
- Modify: `packages/dawcore/src/events.ts`

- [ ] **Step 1: Update `packages/dawcore-spectrogram/src/orchestrator/events.ts`**

Replace the file contents with:

```typescript
/**
 * `viewport-ready` fires at most once per `(generation, trackId)` pair after
 * the viewport-tier FFT completes. Generation bumps (setViewport with a real
 * change, setConfig, setColorMap, setDevicePixelRatio) reset the dispatched-set
 * so the event re-fires on the next render. The `generation` field lets
 * consumers correlate ready events to their own state.
 */
export interface ViewportReadyDetail {
  readonly trackId: string;
  readonly generation: number;
}

/**
 * `viewport-error` fires when a render (FFT compute, chunk render, or worker
 * crash) fails for non-abort reasons. AbortError / SpectrogramAbortError are
 * NOT surfaced here — they are part of the normal generation-bump flow.
 */
export interface ViewportErrorDetail {
  readonly trackId: string;
  readonly generation: number;
  readonly error: Error;
}

export type SpectrogramOrchestratorEventMap = {
  'viewport-ready': CustomEvent<ViewportReadyDetail>;
  'viewport-error': CustomEvent<ViewportErrorDetail>;
};
```

- [ ] **Step 2: Add re-dispatched event in `packages/dawcore/src/events.ts`**

Read the current file to find where `daw-spectrogram-ready` is declared, then add `daw-spectrogram-error` right after with this shape:

```typescript
export interface DawSpectrogramErrorDetail {
  trackId: string;
  generation: number;
  error: Error;
}
```

Add to the `DawEventMap`:
```typescript
'daw-spectrogram-error': CustomEvent<DawSpectrogramErrorDetail>;
```

Also update `DawSpectrogramReadyDetail` to include `generation: number` if it doesn't already.

- [ ] **Step 3: Typecheck @dawcore/spectrogram (will fail — `runRender` doesn't pass `generation` in detail yet)**

```bash
pnpm --filter @dawcore/spectrogram typecheck
```
Expected: errors mentioning `generation` missing in dispatched `viewport-ready` detail. This is intentional RED — fixed in Task 2.

- [ ] **Step 4: STOP — wait for user approval**

- [ ] **Step 5: Commit (after user approval)** — deferred to Task 2's commit (these two tasks ship together since they're a single coherent change)

---

## Task 2: Orchestrator error handling + `generation` emission + silent-skip warnings

Wraps the render coordinator with try/catch, dispatches `viewport-error` for real failures, distinguishes `SpectrogramAbortError`, warns on silent-skip paths.

**Files:**
- Modify: `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts`

- [ ] **Step 1: Read the current file to know the surrounding context**

```bash
cat packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts | head -50
```

Get familiar with imports and the class header. The file already imports `SpectrogramAbortError` indirectly via the worker pool — confirm by grepping:
```bash
grep -n "SpectrogramAbortError\|abortError\|abort error" packages/dawcore-spectrogram/src/
```

If not imported in `SpectrogramOrchestrator.ts`, add:
```typescript
import { SpectrogramAbortError } from '../worker';
```
(Adjust the path to match the actual export — `createSpectrogramWorker.ts` exports it.)

- [ ] **Step 2: Update event dispatch in `runRender` to carry `generation`**

Find the `this.dispatchEvent(new CustomEvent('viewport-ready', { detail: { trackId } }));` line (around line 202-205). Replace with:

```typescript
if (!this.readyDispatched.has(trackId)) {
  this.readyDispatched.add(trackId);
  this.dispatchEvent(
    new CustomEvent('viewport-ready', { detail: { trackId, generation } })
  );
}
```

- [ ] **Step 3: Wrap `runRender` body with error handling**

Find `protected async runRender(generation: number): Promise<void>` and locate where the per-track loop iterates. Wrap EACH per-track iteration in try/catch so one track's failure doesn't abort siblings:

```typescript
protected async runRender(generation: number): Promise<void> {
  if (this.disposed) return;
  const viewport = this.viewport;
  if (!viewport) return;

  const canvasesByTrack = new Map<string, CanvasEntry[]>();
  for (const c of this.canvases.values()) {
    const list = canvasesByTrack.get(c.trackId) ?? [];
    list.push(c);
    canvasesByTrack.set(c.trackId, list);
  }

  for (const [trackId, canvases] of canvasesByTrack) {
    try {
      // ... existing per-track rendering logic (viewport tier, buffer tier, remaining tier) ...
    } catch (err) {
      if (this.generation !== generation || this.disposed) return;
      if (err instanceof SpectrogramAbortError) {
        // Normal abort — generation bumped mid-render. Not an error.
        return;
      }
      const error = err instanceof Error ? err : new Error(String(err));
      console.warn(
        '[dawcore-spectrogram] render failed for track ' + trackId +
          ' (generation ' + generation + '): ' + error.message
      );
      this.dispatchEvent(
        new CustomEvent('viewport-error', {
          detail: { trackId, generation, error },
        })
      );
      // Continue to next track — one failure doesn't break siblings.
    }
  }
}
```

(Adjust to fit the actual loop structure in the file — preserve all existing tier logic; only add the try/catch around it.)

- [ ] **Step 4: Wrap `scheduleRender` microtask body with `.catch()`**

Find:
```typescript
queueMicrotask(() => {
  this.renderInFlight = false;
  void this.runRender(this.generation);
});
```

Replace with:
```typescript
queueMicrotask(() => {
  this.renderInFlight = false;
  this.runRender(this.generation).catch((err) => {
    if (err instanceof SpectrogramAbortError) return;
    console.warn(
      '[dawcore-spectrogram] runRender unhandled rejection (generation ' +
        this.generation + '): ' + (err instanceof Error ? err.message : String(err))
    );
  });
});
```

- [ ] **Step 5: Apply the same pattern to `renderRemainingViaIdle`**

Find the `renderRemainingViaIdle` method. Its for-loop should wrap each `renderGroup` await in try/catch:

```typescript
protected async renderRemainingViaIdle(
  groups: CanvasEntry[][],
  generation: number,
  viewport: ViewportState
): Promise<void> {
  for (const group of groups) {
    await this.yieldUntilIdle();
    if (this.generation !== generation || this.disposed) return;
    try {
      await this.renderGroup(group, generation, viewport);
    } catch (err) {
      if (this.generation !== generation || this.disposed) return;
      if (err instanceof SpectrogramAbortError) return;
      const error = err instanceof Error ? err : new Error(String(err));
      console.warn(
        '[dawcore-spectrogram] remaining-tier render failed for canvas group: ' +
          error.message
      );
      // Continue to next group
    }
  }
}
```

- [ ] **Step 6: Warn on silent-skip paths in `registerCanvas` / `unregisterCanvas` / `unregisterClip`**

Find `registerCanvas`. Replace:
```typescript
registerCanvas(reg: CanvasRegistration): void {
  if (this.disposed) return;
  // ... rest
}
```

With:
```typescript
registerCanvas(reg: CanvasRegistration): void {
  if (this.disposed) {
    console.warn(
      '[dawcore-spectrogram] registerCanvas after dispose — canvas ' +
        reg.canvasId + ' will not render (OffscreenCanvas is now dead)'
    );
    return;
  }
  // ... rest
}
```

Find `unregisterCanvas`. Replace the `if (!this.canvases.has(canvasId)) return;` with:
```typescript
if (!this.canvases.has(canvasId)) {
  console.warn('[dawcore-spectrogram] unregisterCanvas: unknown canvas ' + canvasId);
  return;
}
```

Find `unregisterClip`. Replace the `if (!this.clips.has(clipId)) return;` with:
```typescript
if (!this.clips.has(clipId)) {
  console.warn('[dawcore-spectrogram] unregisterClip: unknown clip ' + clipId);
  return;
}
```

- [ ] **Step 7: Warn on missing clip in `renderGroup`**

Find `renderGroup` (around line 234). Find:
```typescript
const clip = this.clips.get(first.clipId);
if (!clip) return;
```

Replace with:
```typescript
const clip = this.clips.get(first.clipId);
if (!clip) {
  console.warn(
    '[dawcore-spectrogram] renderGroup: no clip audio for ' + first.clipId +
      ' (canvas ' + first.canvasId + ') — canvas will stay black until registerClip is called'
  );
  return;
}
```

- [ ] **Step 8: Make `registerClip` trigger a render if canvases for this clip are already registered**

Find `registerClip`. After the existing body, add:

```typescript
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

  // If any canvases for this clip were registered BEFORE the clip audio
  // arrived (race during track-by-track loading), they would have been left
  // black by renderGroup's missing-clip early-return. Trigger a render now
  // so they paint.
  if (this.viewport) {
    for (const canvas of this.canvases.values()) {
      if (canvas.clipId === reg.clipId) {
        this.scheduleRender();
        break;
      }
    }
  }
}
```

- [ ] **Step 9: Validate `setViewport` numeric inputs**

Find `setViewport`. At the top of the method, after the disposed check, add validation:

```typescript
setViewport(state: ViewportState): void {
  if (this.disposed) return;
  if (
    !Number.isFinite(state.visibleStartPx) ||
    !Number.isFinite(state.visibleEndPx) ||
    !Number.isFinite(state.bufferStartPx) ||
    !Number.isFinite(state.bufferEndPx) ||
    !Number.isFinite(state.samplesPerPixel) ||
    state.samplesPerPixel <= 0 ||
    state.visibleStartPx > state.visibleEndPx ||
    state.bufferStartPx > state.bufferEndPx
  ) {
    console.warn(
      '[dawcore-spectrogram] setViewport: invalid state — ignored (' +
        JSON.stringify(state) + ')'
    );
    return;
  }
  if (this.viewport && viewportsEqual(this.viewport, state)) return;
  // ... rest unchanged
}
```

- [ ] **Step 10: Make `setDevicePixelRatio` validate, bump generation, schedule render**

Find `setDevicePixelRatio`. Replace:
```typescript
setDevicePixelRatio(dpr: number): void {
  this.devicePixelRatio = dpr;
}
```

With:
```typescript
setDevicePixelRatio(dpr: number): void {
  if (this.disposed) return;
  if (!Number.isFinite(dpr) || dpr <= 0) {
    console.warn('[dawcore-spectrogram] setDevicePixelRatio: invalid value ' + dpr + ' — ignored');
    return;
  }
  if (this.devicePixelRatio === dpr) return;
  this.devicePixelRatio = dpr;
  const prevGeneration = this.generation;
  this.generation += 1;
  this.readyDispatched.clear();
  this.pool.abortGeneration(prevGeneration);
  this.scheduleRender();
}
```

- [ ] **Step 11: Build and typecheck**

```bash
pnpm --filter @dawcore/spectrogram build
pnpm --filter @dawcore/components typecheck
```
Expected: PASS. If dawcore typecheck fails because the editor doesn't carry `generation` on `daw-spectrogram-ready`, that's Task 4 territory — leave for now.

- [ ] **Step 12: Run existing orchestrator tests**

```bash
cd packages/dawcore-spectrogram && npx vitest run
```
Expected: PASS — existing tests still work. (The viewport-ready event detail now has an extra `generation` field; tests that read `detail.trackId` still work.)

- [ ] **Step 13: STOP — wait for user approval**

- [ ] **Step 14: Commit (after user approval)**

```bash
git add packages/dawcore-spectrogram/src/orchestrator/ packages/dawcore/src/events.ts
git commit -m "$(cat <<'EOF'
feat(spectrogram): production error handling + viewport-error event + generation in detail

Addresses critical findings from PR #387 silent-failure-hunter review:
- Wrap runRender body with per-track try/catch — distinguishes
  SpectrogramAbortError from real failures, dispatches viewport-error
  on real failures, continues siblings instead of aborting the whole
  render loop
- Add .catch() on the scheduleRender microtask so worker rejections
  surface as console.warn instead of unhandled promise rejections
- Same try/catch pattern in renderRemainingViaIdle
- Warn (not silently skip) on registerCanvas-after-dispose,
  unregister-unknown, and renderGroup's missing-clip-audio path —
  these were all "permanent black chunk with no diagnostic" cases
- registerClip now triggers a render if canvases for that clip were
  registered first (race during track-by-track loading)
- setDevicePixelRatio now validates + bumps generation + schedules
  render (previously a silent state-only setter)
- setViewport validates Number.isFinite + ordering invariants

New event surface:
- ViewportErrorDetail { trackId, generation, error } on the orchestrator
- daw-spectrogram-error on the editor (re-dispatch wiring in Task 4)
- ViewportReadyDetail gains readonly generation field — consumers can
  now correlate ready events to their own state and dedup if needed

No public API breaks: viewport-ready detail extension is additive
(readonly numeric field); existing consumers reading detail.trackId
continue to work.
EOF
)"
```

---

## Task 3: Worker pool error context + leak fix

Improves error messages from the worker layer + fixes the partial-failure leak in pool construction + warns on malformed canvas IDs.

**Files:**
- Modify: `packages/dawcore-spectrogram/src/worker/createSpectrogramWorker.ts`
- Modify: `packages/dawcore-spectrogram/src/worker/createSpectrogramWorkerPool.ts`

- [ ] **Step 1: Read both files to know the current shape**

```bash
cat packages/dawcore-spectrogram/src/worker/createSpectrogramWorker.ts
cat packages/dawcore-spectrogram/src/worker/createSpectrogramWorkerPool.ts
```

- [ ] **Step 2: Fix `worker.onerror` context loss in `createSpectrogramWorker.ts`**

Find the `worker.onerror = (e: ErrorEvent) => { ... }` handler. Replace its body with:

```typescript
worker.onerror = (e: ErrorEvent) => {
  terminated = true;
  console.error(
    '[dawcore-spectrogram] worker crashed with ' + pending.size +
      ' pending operations: ' + (e.message || 'unknown error')
  );
  for (const [id, entry] of pending) {
    entry.reject(
      new Error('Worker crashed (id=' + id + '): ' + (e.message || 'unknown error'))
    );
  }
  pending.clear();
};
```

Also add an `onmessageerror` handler for postMessage clone failures (currently uncaught):

```typescript
worker.onmessageerror = (e: MessageEvent) => {
  console.warn(
    '[dawcore-spectrogram] worker postMessage clone failure: ' +
      (e.data ? JSON.stringify(e.data) : 'no data')
  );
};
```

Place this near the `onerror` definition.

- [ ] **Step 3: Fix pool constructor leak in `createSpectrogramWorkerPool.ts`**

Find the constructor pattern:
```typescript
try {
  for (let i = 0; i < poolSize; i++) {
    workers.push(createSpectrogramWorker(createWorker()));
  }
} catch (err) {
  for (const w of workers) {
    w.terminate();
  }
  throw err;
}
```

Replace with:
```typescript
let failedAt = -1;
try {
  for (let i = 0; i < poolSize; i++) {
    failedAt = i;
    workers.push(createSpectrogramWorker(createWorker()));
  }
  failedAt = -1;
} catch (err) {
  for (const w of workers) {
    try {
      w.terminate();
    } catch (terminateErr) {
      console.warn(
        '[dawcore-spectrogram] pool constructor cleanup: terminate failed for worker — ' +
          String(terminateErr)
      );
    }
  }
  throw new Error(
    'Failed to create spectrogram worker pool (size=' + poolSize +
      ') at worker ' + failedAt + ': ' +
      (err instanceof Error ? err.message : String(err))
  );
}
```

- [ ] **Step 4: Warn on malformed canvas IDs in `parseChannelFromCanvasId`**

Find:
```typescript
function parseChannelFromCanvasId(canvasId: string): number {
  const match = canvasId.match(/-ch(\d+)-/);
  return match ? parseInt(match[1], 10) : 0;
}
```

Replace with:
```typescript
function parseChannelFromCanvasId(canvasId: string): number {
  const match = canvasId.match(/-ch(\d+)-/);
  if (!match) {
    console.warn(
      '[dawcore-spectrogram] canvas ID missing -ch{N}- segment, routing to worker 0: ' +
        canvasId
    );
    return 0;
  }
  return parseInt(match[1], 10);
}
```

- [ ] **Step 5: Use `Promise.allSettled` for mono fan-out so one-channel failures don't lose surviving channel results**

Find the `if (params.mono) { ... }` block and the multi-channel fan-out below it. Currently:
```typescript
const promises = activeWorkers.map((w, i) =>
  w.computeFFT({ ...params, channelFilter: i }, generation)
);
return Promise.all(promises).then((results) => results[0]);
```

Replace with:
```typescript
const promises = activeWorkers.map((w, i) =>
  w.computeFFT({ ...params, channelFilter: i }, generation)
);
const settled = await Promise.allSettled(promises);
const failures = settled.filter((s): s is PromiseRejectedResult => s.status === 'rejected');
if (failures.length > 0) {
  for (let i = 1; i < failures.length; i++) {
    console.warn(
      '[dawcore-spectrogram] additional channel FFT failure (' + i + '): ' +
        (failures[i].reason instanceof Error ? failures[i].reason.message : String(failures[i].reason))
    );
  }
  throw failures[0].reason;
}
return (settled[0] as PromiseFulfilledResult<{ cacheKey: string }>).value;
```

Note: the surrounding function may need to become `async` if it wasn't already. Check the existing function signature and adjust accordingly.

- [ ] **Step 6: Run worker pool tests**

```bash
cd packages/dawcore-spectrogram && npx vitest run __tests__/createSpectrogramWorker.test.ts __tests__/createSpectrogramWorkerPool.test.ts
```
Expected: PASS. If tests fail because of the new `console.warn` calls being unexpected, the tests need to suppress them — but most tests don't care about console output.

- [ ] **Step 7: Build**

```bash
pnpm --filter @dawcore/spectrogram build
```

- [ ] **Step 8: STOP — wait for user approval**

- [ ] **Step 9: Commit (after user approval)**

```bash
git add packages/dawcore-spectrogram/src/worker/
git commit -m "fix(spectrogram): worker pool error context + leak fix + mono fan-out"
```

---

## Task 4: Wire `daw-spectrogram-error` re-dispatch in SpectrogramController + carry `generation` in ready event

The orchestrator now dispatches `viewport-error` and includes `generation` in `viewport-ready`. The controller (in `@dawcore/components`) re-dispatches these as `daw-spectrogram-*` events on the editor.

**Files:**
- Modify: `packages/dawcore/src/controllers/spectrogram-controller.ts`

- [ ] **Step 1: Read the controller's existing `viewport-ready` re-dispatch**

```bash
grep -n "viewport-ready\|dispatchEvent" packages/dawcore/src/controllers/spectrogram-controller.ts
```

- [ ] **Step 2: Update the re-dispatch to include `generation`**

Find the existing handler (it currently dispatches `daw-spectrogram-ready` with `detail: { trackId }`). Replace with:

```typescript
this.orchestrator.addEventListener('viewport-ready', (e) => {
  const detail = (e as CustomEvent<{ trackId: string; generation: number }>).detail;
  this.host.dispatchEvent(
    new CustomEvent('daw-spectrogram-ready', {
      bubbles: true,
      composed: true,
      detail: { trackId: detail.trackId, generation: detail.generation },
    })
  );
});
```

- [ ] **Step 3: Add the `viewport-error` re-dispatch**

Add right after the `viewport-ready` listener wiring:

```typescript
this.orchestrator.addEventListener('viewport-error', (e) => {
  const detail = (e as CustomEvent<{ trackId: string; generation: number; error: Error }>).detail;
  this.host.dispatchEvent(
    new CustomEvent('daw-spectrogram-error', {
      bubbles: true,
      composed: true,
      detail: { trackId: detail.trackId, generation: detail.generation, error: detail.error },
    })
  );
});
```

- [ ] **Step 4: Build + typecheck**

```bash
pnpm --filter @dawcore/spectrogram build
pnpm --filter @dawcore/components typecheck
```
Expected: PASS.

- [ ] **Step 5: Run dawcore tests to catch regressions**

```bash
pnpm --filter @dawcore/components test
```
Expected: PASS.

- [ ] **Step 6: STOP — wait for user approval**

- [ ] **Step 7: Commit (after user approval)**

```bash
git add packages/dawcore/src/controllers/spectrogram-controller.ts
git commit -m "feat(dawcore): re-dispatch viewport-error as daw-spectrogram-error + carry generation"
```

---

## Task 5: Warn-once on `<daw-spectrogram>._findHostEditor()` null

Element silently renders black if it can't find the editor. Add a one-time warn so misuse surfaces.

**Files:**
- Modify: `packages/dawcore/src/elements/daw-spectrogram.ts`

- [ ] **Step 1: Add a private `_warnedNoHost` flag and warn in `_findHostEditor` / `_registerCanvases`**

Find the `_findHostEditor` method. Find any callers that early-return on null (likely `_registerCanvases`). Replace the call sites' silent null-checks with:

```typescript
private _warnedNoHost = false;

_registerCanvases() {
  const editor = this._findHostEditor();
  if (!editor || typeof editor._spectrogramRegisterCanvas !== 'function') {
    if (!this._warnedNoHost) {
      this._warnedNoHost = true;
      console.warn(
        '[dawcore] <daw-spectrogram> (clip ' + this.clipId +
          ') could not find host <daw-editor>. Canvases will not render. ' +
          'Ensure the element is mounted inside a <daw-editor>.'
      );
    }
    return;
  }
  // ... rest unchanged
}
```

(The exact method name and surrounding code may differ — adjust to match. The key is: warn ONCE per element if host is not found, then continue silent-skip behavior.)

- [ ] **Step 2: Build + test**

```bash
pnpm --filter @dawcore/spectrogram build
pnpm --filter @dawcore/components test
```
Expected: PASS.

- [ ] **Step 3: STOP — wait for user approval**

- [ ] **Step 4: Commit (after user approval)**

```bash
git add packages/dawcore/src/elements/daw-spectrogram.ts
git commit -m "fix(dawcore): warn once when <daw-spectrogram> can't find host editor"
```

---

## Task 6: Unify `TrackRenderMode` ↔ `RenderMode`

Drop the dawcore duplicate (which omits `'both'`), use core's `RenderMode` everywhere.

**Files:**
- Modify: `packages/dawcore/src/types.ts`
- Modify: `packages/dawcore/src/elements/daw-track.ts` (if it imports `TrackRenderMode`)
- Modify: `packages/dawcore/src/index.ts` (if it re-exports `TrackRenderMode`)
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (if it uses `TrackRenderMode`)

- [ ] **Step 1: Find every site using `TrackRenderMode`**

```bash
grep -rn "TrackRenderMode" packages/dawcore/src/
```

- [ ] **Step 2: Replace `TrackRenderMode` with re-exported `RenderMode` in `packages/dawcore/src/types.ts`**

Find:
```typescript
export type TrackRenderMode = 'waveform' | 'piano-roll' | 'spectrogram';
```

Replace with:
```typescript
// Re-export RenderMode from core as TrackRenderMode for backward compatibility
// during the migration; consumers should prefer RenderMode directly.
export type { RenderMode as TrackRenderMode } from '@waveform-playlist/core';
export type { RenderMode } from '@waveform-playlist/core';
```

Note: this is a behavior change — dawcore can now express `'both'` mode. Make sure `daw-track`, `daw-editor`, and any branching logic on render mode handles `'both'` (or deliberately rejects it — see step 3).

- [ ] **Step 3: Audit branching logic on render mode**

```bash
grep -rn "renderMode === \|renderMode == \|case 'waveform'\|case 'spectrogram'\|case 'piano-roll'" packages/dawcore/src/
```

Each switch / branch on `renderMode` may need a `'both'` arm. If `'both'` rendering isn't implemented in dawcore yet (it probably isn't — that's a React-side feature), add a guard at the attribute setter that warns and falls back to `'spectrogram'`:

In `daw-track.ts`, find the `renderMode` property setter. Add:
```typescript
if (value === 'both') {
  console.warn(
    "[dawcore] <daw-track render-mode=\"both\"> is not yet supported; falling back to 'spectrogram'"
  );
  value = 'spectrogram';
}
```

(Adjust to fit the actual setter syntax.)

- [ ] **Step 4: Build + typecheck**

```bash
pnpm --filter @waveform-playlist/core build
pnpm --filter @dawcore/components typecheck
```

If typecheck fails because some site narrowed the type and now must handle `'both'`, add the guard (warn + fallback) at that site.

- [ ] **Step 5: Test**

```bash
pnpm --filter @dawcore/components test
```

- [ ] **Step 6: STOP — wait for user approval**

- [ ] **Step 7: Commit (after user approval)**

```bash
git add packages/dawcore/src/types.ts packages/dawcore/src/elements/ packages/dawcore/src/index.ts
git commit -m "refactor(dawcore): unify TrackRenderMode with core's RenderMode (drop dawcore duplicate)"
```

---

## Task 7: Single `SPECTROGRAM_DEFAULTS` constant

Eliminate the 3× duplication (orchestrator constructor, controller `LIBRARY_DEFAULTS`, `renderGroup` inline `??` defaults).

**Files:**
- Create: `packages/core/src/utils/spectrogram-defaults.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts`
- Modify: `packages/dawcore/src/controllers/spectrogram-controller.ts`

- [ ] **Step 1: Create `packages/core/src/utils/spectrogram-defaults.ts`**

```typescript
import type { SpectrogramConfig, ColorMapValue } from '../types/spectrogram';

/**
 * Default values for every `SpectrogramConfig` field. Used by both
 * `@dawcore/spectrogram`'s orchestrator and `@dawcore/components`'s
 * controller so defaults can't drift between layers.
 *
 * `maxFrequency` is intentionally omitted — it defaults to `sampleRate / 2`
 * at compute time (depends on the clip's audio).
 */
export const SPECTROGRAM_DEFAULTS: Required<Omit<SpectrogramConfig, 'maxFrequency' | 'labelsColor' | 'labelsBackground'>> & {
  labelsColor: string | undefined;
  labelsBackground: string | undefined;
} = {
  fftSize: 2048,
  hopSize: 512,
  windowFunction: 'hann',
  alpha: 0.5,
  frequencyScale: 'mel',
  minFrequency: 0,
  gainDb: 20,
  rangeDb: 80,
  zeroPaddingFactor: 2,
  labels: false,
  labelsColor: undefined,
  labelsBackground: undefined,
};

/** Default color map when none is specified. */
export const DEFAULT_SPECTROGRAM_COLOR_MAP: ColorMapValue = 'viridis';
```

- [ ] **Step 2: Export from `packages/core/src/index.ts`**

Add:
```typescript
export { SPECTROGRAM_DEFAULTS, DEFAULT_SPECTROGRAM_COLOR_MAP } from './utils/spectrogram-defaults';
```

- [ ] **Step 3: Build core**

```bash
pnpm --filter @waveform-playlist/core build
```

- [ ] **Step 4: Update orchestrator constructor to use defaults**

In `SpectrogramOrchestrator.ts` constructor and `renderGroup`'s inline defaults, replace `colorMap ?? 'viridis'` and similar inline patterns with:

```typescript
import { SPECTROGRAM_DEFAULTS, DEFAULT_SPECTROGRAM_COLOR_MAP } from '@waveform-playlist/core';
```

Then at consumption sites:
```typescript
this.colorMap = opts.colorMap ?? DEFAULT_SPECTROGRAM_COLOR_MAP;
// And for config defaults in renderGroup:
const fftSize = this.config.fftSize ?? SPECTROGRAM_DEFAULTS.fftSize;
const frequencyScale = this.config.frequencyScale ?? SPECTROGRAM_DEFAULTS.frequencyScale;
// ... etc
```

(Apply the pattern consistently; the existing inline defaults already match `SPECTROGRAM_DEFAULTS`, so no behavior change.)

- [ ] **Step 5: Update `SpectrogramController` to use the shared defaults**

In `spectrogram-controller.ts`, find `LIBRARY_DEFAULTS` and `LIBRARY_DEFAULT_COLOR_MAP`. Replace with imports from core:

```typescript
import { SPECTROGRAM_DEFAULTS as LIBRARY_DEFAULTS, DEFAULT_SPECTROGRAM_COLOR_MAP as LIBRARY_DEFAULT_COLOR_MAP } from '@waveform-playlist/core';
```

Delete the now-unused local declarations.

- [ ] **Step 6: Build + typecheck**

```bash
pnpm --filter @dawcore/spectrogram build
pnpm --filter @dawcore/components typecheck
```

- [ ] **Step 7: Run tests**

```bash
pnpm --filter @dawcore/spectrogram test
pnpm --filter @dawcore/components test
```

- [ ] **Step 8: STOP — wait for user approval**

- [ ] **Step 9: Commit (after user approval)**

```bash
git add packages/core/src/utils/spectrogram-defaults.ts packages/core/src/index.ts packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts packages/dawcore/src/controllers/spectrogram-controller.ts
git commit -m "refactor(spectrogram): single SPECTROGRAM_DEFAULTS constant in @waveform-playlist/core"
```

---

## Task 8: `readonly` on input types

Defensive immutability on registration / options shapes. Zero behavior change.

**Files:**
- Modify: `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts` (types section near the top of file)
- Modify: `packages/dawcore-spectrogram/src/orchestrator/viewport-classify.ts` (ViewportBounds)

- [ ] **Step 1: Add `readonly` to `SpectrogramOrchestratorOptions`**

Find the interface (around line 8-14). Replace fields:

```typescript
export interface SpectrogramOrchestratorOptions {
  readonly workerFactory: () => Worker;
  readonly workerPoolSize?: number;
  readonly config: SpectrogramConfig;
  readonly colorMap?: ColorMapValue;
  readonly devicePixelRatio?: number;
}
```

- [ ] **Step 2: Add `readonly` to `ClipRegistration`**

Find the interface. Make every field `readonly`:

```typescript
export interface ClipRegistration {
  readonly clipId: string;
  readonly trackId: string;
  readonly channelData: ReadonlyArray<Float32Array>;
  readonly sampleRate: number;
  readonly durationSamples: number;
  readonly offsetSamples: number;
}
```

Note: `ReadonlyArray<Float32Array>` — the array of channel buffers is readonly, but the buffers themselves remain mutable (that's how Web Audio uses them).

- [ ] **Step 3: Add `readonly` to `CanvasRegistration`**

```typescript
export interface CanvasRegistration {
  readonly canvasId: string;
  readonly canvas: OffscreenCanvas;
  readonly clipId: string;
  readonly trackId: string;
  readonly channelIndex: number;
  readonly chunkIndex: number;
  readonly globalPixelOffset: number;
  readonly widthPx: number;
  readonly heightPx: number;
}
```

- [ ] **Step 4: Add `readonly` to `ViewportState` / `ViewportBounds`**

Find both in `viewport-classify.ts`. Make all fields `readonly`. Adjust `SpectrogramOrchestrator.ts`'s `ViewportState` extension to keep `readonly samplesPerPixel`.

- [ ] **Step 5: Build + typecheck**

```bash
pnpm --filter @dawcore/spectrogram build
pnpm --filter @dawcore/components typecheck
```

If typecheck fails because some downstream code mutates a registration field, that's a real bug — fix it. Most uses spread / shallow-copy already so this should be a clean change.

- [ ] **Step 6: Run tests**

```bash
pnpm --filter @dawcore/spectrogram test
```

- [ ] **Step 7: STOP — wait for user approval**

- [ ] **Step 8: Commit (after user approval)**

```bash
git add packages/dawcore-spectrogram/src/orchestrator/
git commit -m "refactor(spectrogram): readonly on input types (Options, ClipRegistration, CanvasRegistration, ViewportState)"
```

---

## Task 9: Test gaps — orchestrator setConfig/setColorMap dedup-clearing + multi-track + viewportsEqual compile-time guard

Closes the test gaps from both the PR #390 carry-over review and the PR #387 review.

**Files:**
- Modify: `packages/dawcore-spectrogram/__tests__/orchestrator.test.ts`
- Modify: `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts` (add `satisfies` proof)

- [ ] **Step 1: Add `setConfig` dedup-clearing test**

Read the existing test file to find the `describe` block for tier-aware render. Add this test (inside the same describe):

```typescript
it('setConfig clears readyDispatched so the next render re-emits viewport-ready', async () => {
  const orch = makeOrchestratorWithMockPool();
  orch.registerClip(makeClip('c1', 't1'));
  orch.registerCanvas(makeCanvas('c1-ch0-chunk0', 'c1', 't1'));

  const readyEvents: string[] = [];
  orch.addEventListener('viewport-ready', (e) => {
    readyEvents.push((e as CustomEvent).detail.trackId);
  });

  orch.setViewport(makeViewport());
  await new Promise((r) => setTimeout(r, 20));
  expect(readyEvents).toEqual(['t1']);

  // Same viewport — short-circuits, no new ready event
  orch.setViewport(makeViewport());
  await new Promise((r) => setTimeout(r, 20));
  expect(readyEvents).toEqual(['t1']);

  // setConfig with a different config should bump generation and clear readyDispatched
  orch.setConfig({ fftSize: 4096 });
  await new Promise((r) => setTimeout(r, 20));
  expect(readyEvents).toEqual(['t1', 't1']);
});
```

(Adjust helper names — `makeOrchestratorWithMockPool`, `makeClip`, `makeCanvas`, `makeViewport` — to match the actual test file's fixtures. Look at the existing tier-render tests for the exact helper names.)

- [ ] **Step 2: Add `setColorMap` dedup-clearing test (mirror of step 1)**

```typescript
it('setColorMap clears readyDispatched so the next render re-emits viewport-ready', async () => {
  const orch = makeOrchestratorWithMockPool();
  orch.registerClip(makeClip('c1', 't1'));
  orch.registerCanvas(makeCanvas('c1-ch0-chunk0', 'c1', 't1'));

  const readyEvents: string[] = [];
  orch.addEventListener('viewport-ready', (e) => {
    readyEvents.push((e as CustomEvent).detail.trackId);
  });

  orch.setViewport(makeViewport());
  await new Promise((r) => setTimeout(r, 20));
  expect(readyEvents).toEqual(['t1']);

  orch.setColorMap('magma');
  await new Promise((r) => setTimeout(r, 20));
  expect(readyEvents).toEqual(['t1', 't1']);
});
```

- [ ] **Step 3: Add multi-track per-trackId dedup test**

```typescript
it('viewport-ready fires exactly once per trackId per generation (multi-track)', async () => {
  const orch = makeOrchestratorWithMockPool();
  orch.registerClip(makeClip('c1', 't1'));
  orch.registerClip(makeClip('c2', 't2'));
  orch.registerCanvas(makeCanvas('c1-ch0-chunk0', 'c1', 't1'));
  orch.registerCanvas(makeCanvas('c2-ch0-chunk0', 'c2', 't2'));

  const readyEvents: Array<{ trackId: string; generation: number }> = [];
  orch.addEventListener('viewport-ready', (e) => {
    const d = (e as CustomEvent).detail;
    readyEvents.push({ trackId: d.trackId, generation: d.generation });
  });

  orch.setViewport(makeViewport());
  await new Promise((r) => setTimeout(r, 20));

  expect(readyEvents).toHaveLength(2);
  expect(new Set(readyEvents.map((e) => e.trackId))).toEqual(new Set(['t1', 't2']));
  const generations = new Set(readyEvents.map((e) => e.generation));
  expect(generations.size).toBe(1);

  // Late registerCanvas for t1 — should NOT re-fire t1's ready in same generation
  orch.registerCanvas(makeCanvas('c1-ch0-chunk1', 'c1', 't1'));
  await new Promise((r) => setTimeout(r, 20));
  expect(readyEvents).toHaveLength(2);
});
```

- [ ] **Step 4: Add a compile-time guard so `viewportsEqual` covers every `ViewportState` field**

In `SpectrogramOrchestrator.ts`, near the `viewportsEqual` helper at the bottom, add:

```typescript
// Compile-time guard: any future field added to ViewportState must be added
// to viewportsEqual or this `satisfies` check will fail.
const _VIEWPORT_STATE_FIELDS_COVERED_BY_EQUAL = {
  visibleStartPx: true,
  visibleEndPx: true,
  bufferStartPx: true,
  bufferEndPx: true,
  samplesPerPixel: true,
} satisfies Record<keyof ViewportState, true>;
// Mark as used so noUnusedLocals doesn't complain
void _VIEWPORT_STATE_FIELDS_COVERED_BY_EQUAL;
```

This errors at compile time if anyone adds a field to `ViewportState` without updating `viewportsEqual`.

- [ ] **Step 5: Run tests**

```bash
cd packages/dawcore-spectrogram && npx vitest run
```
Expected: PASS — the 3 new tests + the existing ones.

- [ ] **Step 6: Typecheck**

```bash
pnpm --filter @dawcore/spectrogram typecheck
```
Expected: PASS — the `satisfies` guard compiles.

- [ ] **Step 7: STOP — wait for user approval**

- [ ] **Step 8: Commit (after user approval)**

```bash
git add packages/dawcore-spectrogram/__tests__/orchestrator.test.ts packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts
git commit -m "test(spectrogram): cover setConfig/setColorMap dedup-clearing + multi-track + viewportsEqual compile-time guard"
```

---

## Task 10: Test gaps — dispose-mid-render + buffer/remaining tier + registerClip pool forwarding

**Files:**
- Modify: `packages/dawcore-spectrogram/__tests__/orchestrator.test.ts`

- [ ] **Step 1: Add `dispose()`-mid-render test**

```typescript
it('dispose() during in-flight render bails before pool.computeFFT runs on terminated pool', async () => {
  const orch = makeOrchestratorWithMockPool();
  const mockPool = (orch as any).pool as MockPool;
  orch.registerClip(makeClip('c1', 't1'));
  orch.registerCanvas(makeCanvas('c1-ch0-chunk0', 'c1', 't1'));

  // Make computeFFT take a tick to resolve so we can dispose mid-flight
  let resolveComputeFFT: (v: { cacheKey: string }) => void;
  mockPool.computeFFT.mockImplementationOnce(
    () => new Promise<{ cacheKey: string }>((res) => { resolveComputeFFT = res; })
  );

  orch.setViewport(makeViewport());
  // Microtask flushes, runRender starts, awaits computeFFT
  await Promise.resolve();
  orch.dispose();
  resolveComputeFFT!({ cacheKey: 'late' });
  await new Promise((r) => setTimeout(r, 10));

  // After dispose + late resolve, renderChunks should NOT be called on the
  // now-terminated pool
  expect(mockPool.renderChunks).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Add buffer-tier coverage test**

```typescript
it('runs viewport tier then buffer tier (both call renderChunks)', async () => {
  const orch = makeOrchestratorWithMockPool();
  const mockPool = (orch as any).pool as MockPool;
  orch.registerClip(makeClip('c1', 't1'));
  // Two canvases: one inside viewport, one in the buffer overscan zone
  orch.registerCanvas(makeCanvas('c1-ch0-chunk0', 'c1', 't1', { globalPixelOffset: 0 }));
  orch.registerCanvas(makeCanvas('c1-ch0-chunk1', 'c1', 't1', { globalPixelOffset: 1500 }));

  orch.setViewport({
    visibleStartPx: 0,
    visibleEndPx: 1000,
    bufferStartPx: 0,
    bufferEndPx: 2000,
    samplesPerPixel: 256,
  });
  await new Promise((r) => setTimeout(r, 30));

  // Both viewport-tier AND buffer-tier should have triggered renderChunks
  expect(mockPool.renderChunks).toHaveBeenCalledTimes(2);
});
```

- [ ] **Step 3: Enrich existing `registerClip` test to assert pool.registerAudioData was called**

Find the existing `registerClip` test. Add this assertion to its body:

```typescript
expect(mockPool.registerAudioData).toHaveBeenCalledWith(
  'c1',
  expect.any(Object),
  48000
);
```

- [ ] **Step 4: Run tests**

```bash
cd packages/dawcore-spectrogram && npx vitest run
```
Expected: PASS.

- [ ] **Step 5: STOP — wait for user approval**

- [ ] **Step 6: Commit (after user approval)**

```bash
git add packages/dawcore-spectrogram/__tests__/orchestrator.test.ts
git commit -m "test(spectrogram): cover dispose-mid-render + buffer-tier + registerClip pool forwarding"
```

---

## Task 11: `<daw-spectrogram>` shadow-DOM traversal tests

Per the test review, the `_findHostEditor` behavior is critical and untested.

**Files:**
- Create: `packages/dawcore/src/__tests__/spectrogram-host-traversal.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll } from 'vitest';
import type { DawSpectrogramElement } from '../elements/daw-spectrogram';

beforeAll(async () => {
  await import('../elements/daw-spectrogram');
});

describe('<daw-spectrogram> host traversal', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
    document.body.replaceChildren();
  });

  it('warns when mounted in light DOM with no <daw-editor> ancestor', () => {
    const el = document.createElement('daw-spectrogram') as DawSpectrogramElement;
    el.setAttribute('clip-id', 'c1');
    document.body.appendChild(el);
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringMatching(/could not find host <daw-editor>/)
        );
        resolve();
      });
    });
  });

  it('warns only once per element even if _registerCanvases runs multiple times', () => {
    const el = document.createElement('daw-spectrogram') as DawSpectrogramElement;
    document.body.appendChild(el);
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        const callsAfterFirstRaf = warnSpy.mock.calls.length;
        if (typeof (el as any)._registerCanvases === 'function') {
          (el as any)._registerCanvases();
        }
        requestAnimationFrame(() => {
          expect(warnSpy.mock.calls.length).toBe(callsAfterFirstRaf);
          resolve();
        });
      });
    });
  });

  it('finds host editor through getRootNode().host when inside shadow DOM', () => {
    const editorStub = document.createElement('div');
    editorStub.setAttribute('id', 'fake-editor');
    (editorStub as any)._spectrogramRegisterCanvas = vi.fn();
    document.body.appendChild(editorStub);
    const shadow = editorStub.attachShadow({ mode: 'open' });
    const el = document.createElement('daw-spectrogram') as DawSpectrogramElement;
    shadow.appendChild(el);

    const found = (el as any)._findHostEditor();
    expect(found).toBe(editorStub);
  });
});
```

(Adjust to fit the actual `<daw-spectrogram>` API — read `packages/dawcore/src/elements/daw-spectrogram.ts` first to confirm method names and registration timing.)

- [ ] **Step 2: Run the test**

```bash
cd packages/dawcore && npx vitest run src/__tests__/spectrogram-host-traversal.test.ts
```
Expected: PASS — 3 tests.

- [ ] **Step 3: Run full dawcore suite to catch regressions**

```bash
pnpm --filter @dawcore/components test
```

- [ ] **Step 4: STOP — wait for user approval**

- [ ] **Step 5: Commit (after user approval)**

```bash
git add packages/dawcore/src/__tests__/spectrogram-host-traversal.test.ts
git commit -m "test(dawcore): cover <daw-spectrogram>._findHostEditor shadow-DOM traversal"
```

---

## Task 12: CLAUDE.md accuracy fixes + JSDoc polish

**Files:**
- Modify: `packages/dawcore-spectrogram/CLAUDE.md`
- Modify: `packages/dawcore/CLAUDE.md`
- Modify: `packages/spectrogram/CLAUDE.md`
- Modify: `packages/dawcore-spectrogram/tsup.config.ts` (comment fix)
- Modify: `packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts` (`readyDispatched` JSDoc improvement)
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (JSDoc fixes)

- [ ] **Step 1: Fix `packages/dawcore-spectrogram/CLAUDE.md` — test count + subpath rationale + tsup comment + rootDir wording + orchestrator ownership**

Read the file. Apply these edits:

a) The "Tests" section claims "145 tests" / "= ~165 total" — both wrong. Replace the test-count list with:

```markdown
## Tests

Pure helper tests (chunk-grouping, color-lut-cache, viewport-classify, colorMaps, fft, frequencyScales, windowFunctions) + worker pool tests + orchestrator tests. Run with `cd packages/dawcore-spectrogram && npx vitest run` — vitest reports the current count.
```

b) The Subpath Exports section says "(already re-exported from root, this subpath exists for tree-shaking)" — wrong. Replace with:

```markdown
- `@dawcore/spectrogram/orchestrator` — orchestrator + helpers via a focused ESM-only subpath. The root entry re-exports the same surface, but importing through `/orchestrator` ships only the orchestrator graph (no computation/worker code at the import-time level, useful for consumers that handle their own FFT pipeline).
```

c) The "Testing" section says "`rootDir` is dropped from tsconfig" — wrong. Replace with:

```markdown
**Testing:** vitest with happy-dom. Tests live at `packages/dawcore-spectrogram/__tests__/` (sibling of `src/`, NOT inside it — `rootDir` is intentionally omitted from `tsconfig.json` so the sibling `__tests__/` and `src/` directories are both picked up via `include`).
```

d) The opening line says "Shared between the dawcore Lit element layer and the React Provider in `@waveform-playlist/spectrogram`." — this contradicts `packages/spectrogram/CLAUDE.md` which says the React Provider keeps its own pipeline. Replace with:

```markdown
**Purpose:** Framework-agnostic spectrogram computation, Web Worker, and viewport-aware rendering orchestrator. Used by the dawcore Lit element layer via `<daw-spectrogram>` + `SpectrogramController`. The React Provider in `@waveform-playlist/spectrogram` currently consumes the worker + computation primitives only and keeps its own per-track tier pipeline; the orchestrator is a candidate for a future consolidation PR.
```

- [ ] **Step 2: Fix `packages/dawcore-spectrogram/tsup.config.ts` comment**

Find the orchestrator block comment that says `.d.ts`. Replace with `.d.mts` to match reality:

```typescript
// Orchestrator subpath — emits dist/orchestrator/index.mjs + .d.mts so
// consumers can `import { SpectrogramOrchestrator } from '@dawcore/spectrogram/orchestrator'`.
```

- [ ] **Step 3: Improve `readyDispatched` JSDoc in `SpectrogramOrchestrator.ts`**

Find the multi-line comment above `protected readyDispatched = new Set<string>();` (around line 67-73). Replace with:

```typescript
// Tracks which trackIds have already emitted `viewport-ready` for the
// current generation. Cleared on every generation bump (setViewport with a
// real change, setConfig, setColorMap, setDevicePixelRatio) AND in dispose().
// Without this, every render — including those triggered by late
// `registerCanvas` calls during track-by-track loading — would re-fire the
// event for every track in the canvas map (N×N-ish ascending fan-in:
// 3 tracks → 4+3+2+1 = 10 events; the dedup reduces this to 3).
protected readyDispatched = new Set<string>();
```

- [ ] **Step 4: Improve `_lastSpectrogramViewport` JSDoc in `daw-editor.ts`**

Find the JSDoc above `_lastSpectrogramViewport` (PR #390). Replace the last sentence:
> "The orchestrator dedupes too, but this avoids the call entirely."

With:
> "The orchestrator dedupes identical viewports too, so removing this cache wouldn't change observable behavior — but it would push a fresh `setViewport` call (with object allocation) into every Lit reactive update for properties unrelated to the viewport."

- [ ] **Step 5: Fix `_maybeRegisterSpectrogramClipAudio` JSDoc contradiction in `daw-editor.ts`**

Find the doc-comment on `_maybeRegisterSpectrogramClipAudio` (around line 195-199). The text says "no-op unless the track is in spectrogram render-mode and the controller already exists (it bootstraps from canvas registration)" but the body calls `_ensureSpectrogramController()`. Replace with:

```typescript
/**
 * Forward a clip's AudioBuffer to the spectrogram controller if the parent
 * track is in spectrogram render-mode. Eagerly creates the controller via
 * `_ensureSpectrogramController` so the audio data is queued for the first
 * render — even if no canvases have been registered yet.
 */
```

- [ ] **Step 6: Dedupe shadow-DOM explanation in `packages/dawcore/CLAUDE.md`**

Find the Spectrogram bullet about `<daw-spectrogram>` that explains `getRootNode().host`. Replace the inline explanation with a pointer:

```markdown
- **`<daw-spectrogram>`** — Visual element for the spectrogram tier. Lives inside the editor's shadow root; uses `getRootNode().host` to find the editor (see "Elements Inside `<daw-editor>`'s Shadow DOM Use `getRootNode().host`, Not `closest()`" later in this file for the rationale).
```

- [ ] **Step 7: Dedupe `clip.audioBuffer` race explanation in `packages/dawcore/CLAUDE.md`**

Find the Spectrogram bullet about `_maybeRegisterSpectrogramClipAudio` that explains the race. Replace with a one-liner pointer:

```markdown
- **`_maybeRegisterSpectrogramClipAudio(trackId, clip)` reads `clip.audioBuffer` directly** — see "Read `clip.audioBuffer` Directly in Helpers Called During Concurrent Track Loading" later in this file for the full rationale.
```

- [ ] **Step 8: Fix orchestrator ownership wording in `packages/spectrogram/CLAUDE.md`**

The file already says "not the React Provider" — confirm against the updated `dawcore-spectrogram/CLAUDE.md` wording from Step 1d. If they're now consistent, no change needed. If they still drift, align both to say "React Provider consumes worker + computation primitives only; orchestrator is a candidate for future consolidation."

- [ ] **Step 9: Verify website still builds**

```bash
pnpm --filter website build
```
Expected: PASS (CSS calc warnings pre-existing — harmless).

- [ ] **Step 10: STOP — wait for user approval**

- [ ] **Step 11: Commit (after user approval)**

```bash
git add packages/dawcore-spectrogram/CLAUDE.md packages/dawcore-spectrogram/tsup.config.ts packages/dawcore-spectrogram/src/orchestrator/SpectrogramOrchestrator.ts packages/dawcore/CLAUDE.md packages/dawcore/src/elements/daw-editor.ts packages/spectrogram/CLAUDE.md
git commit -m "docs(spectrogram): CLAUDE.md accuracy fixes + JSDoc polish"
```

---

## Task 13: Final verification + PR creation

- [ ] **Step 1: Run full repo typecheck**

```bash
pnpm typecheck
```
Expected: PASS.

- [ ] **Step 2: Run full repo lint**

```bash
pnpm lint
```
Expected: PASS. If formatting fails, run `pnpm format` and re-lint.

- [ ] **Step 3: Run all tests (single-worker concurrency)**

```bash
pnpm -r --workspace-concurrency=1 test
```
Expected: PASS across all packages. Run `pkill -f vitest` afterwards if `pgrep -f vitest` shows strays.

- [ ] **Step 4: Run full build**

```bash
pnpm build
```
Expected: PASS.

- [ ] **Step 5: Verify version state**

These packages may need bumps:
- `@waveform-playlist/core` — new `SPECTROGRAM_DEFAULTS` export (additive, minor bump)
- `@dawcore/spectrogram` — new event, error handling (additive, patch bump within 0.0.x)
- `@dawcore/components` — re-dispatch + warn (patch bump)

Check current versions:
```bash
grep '"version"' packages/core/package.json packages/dawcore-spectrogram/package.json packages/dawcore/package.json
```

Bump as appropriate by editing package.json directly. (Defer the actual publish to a separate user-driven step.)

- [ ] **Step 6: STOP — wait for user verification**

The user may want to inspect all commits with `git log --oneline main..HEAD` before pushing.

- [ ] **Step 7: Push branch + create PR (after user approval)**

```bash
git push -u origin fix/spectrogram-review-followups
gh pr create --title "fix(spectrogram): address PR #387 + #390 review findings" --body "$(cat <<'EOF'
## Summary

Addresses all consequential findings from the comprehensive reviews of PR #387 (spectrogram framework split) and PR #390 (viewport-ready dedup).

**Commits:**
1. `feat(spectrogram): production error handling + viewport-error event + generation in detail`
2. `fix(spectrogram): worker pool error context + leak fix + mono fan-out`
3. `feat(dawcore): re-dispatch viewport-error as daw-spectrogram-error + carry generation`
4. `fix(dawcore): warn once when <daw-spectrogram> can't find host editor`
5. `refactor(dawcore): unify TrackRenderMode with core's RenderMode (drop dawcore duplicate)`
6. `refactor(spectrogram): single SPECTROGRAM_DEFAULTS constant in @waveform-playlist/core`
7. `refactor(spectrogram): readonly on input types (Options, ClipRegistration, CanvasRegistration, ViewportState)`
8. `test(spectrogram): cover setConfig/setColorMap dedup-clearing + multi-track + viewportsEqual compile-time guard`
9. `test(spectrogram): cover dispose-mid-render + buffer-tier + registerClip pool forwarding`
10. `test(dawcore): cover <daw-spectrogram>._findHostEditor shadow-DOM traversal`
11. `docs(spectrogram): CLAUDE.md accuracy fixes + JSDoc polish`

## New public API surface

- `viewport-error` event on `SpectrogramOrchestrator` (and `daw-spectrogram-error` on `<daw-editor>`)
- `generation` field added to `ViewportReadyDetail` / `DawSpectrogramReadyDetail` (additive, `readonly`)
- `SPECTROGRAM_DEFAULTS` and `DEFAULT_SPECTROGRAM_COLOR_MAP` exported from `@waveform-playlist/core`
- `RenderMode` re-exported from `@dawcore/components` (replaces the local `TrackRenderMode` duplicate)

## Migration notes

- Consumers reading `viewport-ready.detail.trackId` are unaffected (additive change).
- Consumers branching on `TrackRenderMode` in dawcore can now receive `'both'` — dawcore warns and falls back to `'spectrogram'` until the both-mode renderer ships.

## Test plan

- [ ] `pnpm typecheck` passes
- [ ] `pnpm lint` passes
- [ ] `pnpm build` passes
- [ ] `pnpm -r --workspace-concurrency=1 test` passes — new tests cover error paths, dedup-clearing, shadow-DOM traversal, dispose-mid-render
- [ ] Manual: `pnpm example:dawcore-tone` -> spectrogram.html still renders correctly, no console errors during normal play/scroll/color-map-change

## Design docs

- Implementation plan: docs/plans/2026-05-24-spectrogram-review-fixes.md
EOF
)"
```

---

## Self-Review (writer's checklist)

- [x] **Spec coverage:** Every critical (4 from error-hunter + 2 from code-reviewer-but-already-fixed-by-#390 + 3 from comment-analyzer) and every Important finding has a task or is explicitly out-of-scope. Suggestions are mostly absorbed into the related tasks (readonly, validation, JSDoc polish).
- [x] **Placeholder scan:** No TBDs. Every code step has the code; every command has the expected output. The few "(adjust to fit actual ...)" notes are deliberate fingertip-feel guidance, not placeholders — the surrounding spec lists exact line numbers.
- [x] **Type consistency:** `ViewportReadyDetail` shape (`trackId`, `generation`), `ViewportErrorDetail` shape (`trackId`, `generation`, `error`), `SPECTROGRAM_DEFAULTS` location (`@waveform-playlist/core`), `RenderMode` source (core, re-exported by dawcore) — used consistently across all tasks.
- [x] **Scope check:** Single coherent goal (review follow-ups), 13 tasks across 11 commits + final verification. Each commit independently green. Some commits are tiny (Task 5: 1 file modify) which is fine — keeps blast radius low.
