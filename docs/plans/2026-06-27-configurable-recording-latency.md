# Configurable Recording Latency Offset — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let host apps override the auto-computed recording latency offset (e.g. with an externally-measured round-trip latency) via a public `latencyOffset` option on both the React and dawcore recording APIs.

**Architecture:** Add one pure resolver in `@waveform-playlist/core` (`resolveRecordingOffsetSamples`) that both surfaces call. dawcore wires it into `RecordingController.startRecording` (its single `session.latencySamples` field already drives both preview and final clip). React wires it into `useIntegratedRecording` finalization and the `PlaylistVisualization` live-preview, threaded via the `recordingState` prop.

**Tech Stack:** TypeScript, pnpm workspaces, tsup builds, vitest (core/recording/dawcore), React, Lit (dawcore).

**Spec:** `docs/specs/2026-06-27-configurable-recording-latency-design.md`
**Issue:** [#502](https://github.com/naomiaro/waveform-playlist/issues/502)

## Global Constraints

- **Public option name:** `latencyOffset` (seconds), identical on both surfaces.
- **Semantics:** `undefined` → current auto-compute (no regression); finite `> 0` → absolute replacement; `0` → compensation disabled (0 samples); negative/non-finite → `0` (via existing guards).
- **Immutability:** never mutate existing objects; spread for updates.
- **No `console.log`** in production code.
- **Build core before downstream tests/typecheck:** dawcore/recording/browser resolve `@waveform-playlist/core` via its built `dist/`. Run `pnpm --filter @waveform-playlist/core build` after Task 1 and before Tasks 2–4.
- **Lint before each commit:** `pnpm -w lint` (root-only script). Fix with `pnpm format`.
- **Git from repo root.** Commit message format `<type>(scope): <desc>`; attribution disabled globally.
- **dawcore typecheck per-package:** `cd packages/dawcore && pnpm typecheck` (root typecheck has a pre-existing failure in `dawcore-midi`).

---

### Task 1: Core resolver `resolveRecordingOffsetSamples`

**Files:**
- Modify: `packages/core/src/utils/latency.ts` (append after `audibleLatencySamples`)
- Test: `packages/core/src/__tests__/latency.test.ts` (append a new `describe` block)

No `index.ts` edit needed — core re-exports via `export * from './utils'` → `export * from './latency'`, so a new exported function flows through automatically.

**Interfaces:**
- Consumes: existing `audibleLatencySamples(outputLatency, lookAhead, sampleRate): number` (same file).
- Produces: `resolveRecordingOffsetSamples(params: { overrideSeconds?: number; outputLatency: number; lookAhead: number; sampleRate: number }): number` — used by Tasks 2, 3, 4.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/src/__tests__/latency.test.ts`:

```ts
import { resolveRecordingOffsetSamples } from '../utils/latency';

describe('resolveRecordingOffsetSamples', () => {
  it('uses the auto-computed audible latency when no override is given', () => {
    // floor((0.01 + 0.1) * 48000) = floor(0.11 * 48000) = 5280
    expect(
      resolveRecordingOffsetSamples({ outputLatency: 0.01, lookAhead: 0.1, sampleRate: 48000 })
    ).toBe(5280);
  });

  it('absolute-replaces the auto value when overrideSeconds is defined', () => {
    // override 0.05s wins over auto (0.11s); floor(0.05 * 48000) = 2400
    expect(
      resolveRecordingOffsetSamples({
        overrideSeconds: 0.05,
        outputLatency: 0.01,
        lookAhead: 0.1,
        sampleRate: 48000,
      })
    ).toBe(2400);
  });

  it('treats overrideSeconds=0 as "disable compensation" (0 samples)', () => {
    expect(
      resolveRecordingOffsetSamples({
        overrideSeconds: 0,
        outputLatency: 0.01,
        lookAhead: 0.1,
        sampleRate: 48000,
      })
    ).toBe(0);
  });

  it('clamps negative / non-finite overrides to 0', () => {
    const base = { outputLatency: 0.01, lookAhead: 0.1, sampleRate: 48000 };
    expect(resolveRecordingOffsetSamples({ ...base, overrideSeconds: -0.02 })).toBe(0);
    expect(resolveRecordingOffsetSamples({ ...base, overrideSeconds: NaN })).toBe(0);
    expect(resolveRecordingOffsetSamples({ ...base, overrideSeconds: Infinity })).toBe(0);
  });

  it('converts override seconds at the given sample rate', () => {
    // floor(0.043 * 44100) = floor(1896.3) = 1896
    expect(
      resolveRecordingOffsetSamples({
        overrideSeconds: 0.043,
        outputLatency: 0,
        lookAhead: 0,
        sampleRate: 44100,
      })
    ).toBe(1896);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd packages/core && npx vitest run src/__tests__/latency.test.ts`
Expected: FAIL — `resolveRecordingOffsetSamples is not a function` / no matching export.

- [ ] **Step 3: Implement the resolver**

Append to `packages/core/src/utils/latency.ts`:

```ts
/**
 * Resolve the recording latency offset in samples.
 *
 * When `overrideSeconds` is provided it is an **absolute replacement** for the
 * auto-computed value — a latency in seconds, converted at `sampleRate`
 * (`0` disables compensation; negative/non-finite resolve to `0`). Otherwise the
 * offset is the auto-computed audible-latency window (`outputLatency + lookAhead`).
 *
 * Single source of truth for the override-vs-auto decision across dawcore
 * (`RecordingController`) and React (`useIntegratedRecording` finalization +
 * `PlaylistVisualization` live preview). The override branch is the same math as
 * the auto branch with `lookAhead = 0`, so both inherit the finite/positive
 * guards in `audibleLatencySamples`.
 */
export function resolveRecordingOffsetSamples(params: {
  /** Public override (seconds). Absolute replacement when defined. */
  overrideSeconds?: number;
  /** Browser-reported output latency (seconds). */
  outputLatency: number;
  /** Scheduler look-ahead (seconds). Pass 0 for engines without one (native transport). */
  lookAhead: number;
  /** Sample rate the recording was captured at. */
  sampleRate: number;
}): number {
  const { overrideSeconds, outputLatency, lookAhead, sampleRate } = params;
  return overrideSeconds !== undefined
    ? audibleLatencySamples(overrideSeconds, 0, sampleRate)
    : audibleLatencySamples(outputLatency, lookAhead, sampleRate);
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd packages/core && npx vitest run src/__tests__/latency.test.ts`
Expected: PASS (all `resolveRecordingOffsetSamples` cases green, existing `audibleLatencySamples` cases still green).

- [ ] **Step 5: Build core so downstream packages see the new export**

Run: `pnpm --filter @waveform-playlist/core build`
Expected: build succeeds (typecheck + tsup).

- [ ] **Step 6: Lint and commit**

```bash
pnpm -w lint
git add packages/core/src/utils/latency.ts packages/core/src/__tests__/latency.test.ts
git commit -m "feat(core): add resolveRecordingOffsetSamples for configurable recording latency"
```

---

### Task 2: dawcore `RecordingOptions.latencyOffset`

**Files:**
- Modify: `packages/dawcore/src/controllers/recording-controller.ts` (import line ~4; `RecordingOptions` 13-21; `startRecording` 183-185)
- Test: `packages/dawcore/src/__tests__/recording-controller.test.ts` (append one `it`)

**Interfaces:**
- Consumes: `resolveRecordingOffsetSamples` from `@waveform-playlist/core` (Task 1).
- Produces: `RecordingOptions.latencyOffset?: number` (seconds) — the dawcore public knob.

- [ ] **Step 1: Write the failing test**

Append inside the `describe('RecordingController', ...)` block in `packages/dawcore/src/__tests__/recording-controller.test.ts` (model: the existing `passes latency offsetSamples to _addRecordedClip` test at line 484):

```ts
it('latencyOffset option overrides the auto-computed offset', async () => {
  // outputLatency=0 → the auto-computed offset would be 0; the override must win.
  host.audioContext.outputLatency = 0;
  host._addRecordedClip = vi.fn();

  const controller = new RecordingController(host);
  await controller.startRecording(createMockStream(), {
    trackId: 'track-1',
    latencyOffset: 0.01, // 10ms
  });
  simulateWorkletData('track-1', 48000); // 1 second of audio

  await controller.stopRecording();

  // offsetSamples = floor(0.01 * 48000) = 480; durationSamples = 48000 - 480 = 47520
  expect(host._addRecordedClip).toHaveBeenCalledWith(
    'track-1',
    expect.anything(),
    expect.any(Number),
    47520, // effectiveDuration
    480 // latencyOffsetSamples (from the override, not outputLatency)
  );
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/recording-controller.test.ts -t "latencyOffset option overrides"`
Expected: FAIL — `_addRecordedClip` called with `48000, 0` (option ignored) instead of `47520, 480`.

- [ ] **Step 3: Add `latencyOffset` to the import and `RecordingOptions`**

In `packages/dawcore/src/controllers/recording-controller.ts`, extend the core import:

```ts
import {
  appendPeaks,
  concatenateAudioData,
  createAudioBuffer,
  resolveRecordingOffsetSamples,
} from '@waveform-playlist/core';
```

Add the field to `RecordingOptions` (after `overdub`):

```ts
export interface RecordingOptions {
  trackId?: string;
  bits?: 8 | 16;
  /** Fallback channel count when stream doesn't report one via getSettings(). Must be 1 or 2. */
  channelCount?: 1 | 2;
  startSample?: number;
  /** Start playback during recording so user hears existing tracks. */
  overdub?: boolean;
  /**
   * Latency offset to skip at the start of the recording, in **seconds**.
   * Absolute replacement for the auto-computed `outputLatency`-based value —
   * use this to apply an externally-measured round-trip latency. `0` disables
   * compensation; when omitted, the auto-computed value is used.
   */
  latencyOffset?: number;
}
```

- [ ] **Step 4: Use the resolver in `startRecording`**

Replace lines 183-185 (`// Compute latency offset once at start ...`):

```ts
      // Compute latency offset once at start (doesn't change during session).
      // An explicit latencyOffset option (seconds) replaces the outputLatency
      // estimate; native transport has no scheduler look-ahead (lookAhead: 0).
      const latencySamples = resolveRecordingOffsetSamples({
        overrideSeconds: options.latencyOffset,
        outputLatency: rawCtx.outputLatency ?? 0,
        lookAhead: 0,
        sampleRate: rawCtx.sampleRate,
      });
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/recording-controller.test.ts`
Expected: PASS (new test + all existing recording-controller tests).

- [ ] **Step 6: Typecheck dawcore**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS.

- [ ] **Step 7: Lint and commit**

```bash
pnpm -w lint
git add packages/dawcore/src/controllers/recording-controller.ts packages/dawcore/src/__tests__/recording-controller.test.ts
git commit -m "feat(dawcore): add latencyOffset option to RecordingOptions (#502)"
```

---

### Task 3: React finalization `useIntegratedRecording`

**Files:**
- Modify: `packages/recording/src/hooks/useIntegratedRecording.ts` (import 11; `IntegratedRecordingOptions` 18-42; destructure 83; `stopRecording` 199-215)
- Test: `packages/recording/src/__tests__/latencyCompensation.test.ts` (delegate the mirror to the real resolver + add override cases)

**Interfaces:**
- Consumes: `resolveRecordingOffsetSamples` from `@waveform-playlist/core` (Task 1).
- Produces: `IntegratedRecordingOptions.latencyOffset?: number` (seconds) — the React finalization knob.

- [ ] **Step 1: Write the failing test**

In `packages/recording/src/__tests__/latencyCompensation.test.ts`, add `overrideSeconds` to the input interface and two override cases (the local `computeLatencyCompensation` mirror currently ignores any override). Add at the top of the file:

```ts
import { resolveRecordingOffsetSamples } from '@waveform-playlist/core';
```

Add `overrideSeconds?: number;` to `interface LatencyCompensationInput`, then append these cases inside `describe('latency compensation', ...)`:

```ts
  it('override seconds replaces the auto-computed latency', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      overrideSeconds: 0.05, // 50ms wins over auto (0.11s)
    });

    // floor(0.05 * 44100) = 2205
    expect(result.offsetSamples).toBe(2205);
    expect(result.durationSamples).toBe(44100 - 2205);
  });

  it('override of 0 disables compensation', () => {
    const result = computeLatencyCompensation({
      ...defaultInput,
      overrideSeconds: 0,
    });

    expect(result.offsetSamples).toBe(0);
    expect(result.durationSamples).toBe(44100);
  });
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd packages/recording && npx vitest run src/__tests__/latencyCompensation.test.ts -t "override"`
Expected: FAIL — mirror still returns the auto offset (4851), so `offsetSamples` is `4851`, not `2205`/`0`.

- [ ] **Step 3: Delegate the mirror's offset math to the real resolver**

In `packages/recording/src/__tests__/latencyCompensation.test.ts`, replace the body of `computeLatencyCompensation` so it uses the shared resolver (keeping the start-sample logic):

```ts
function computeLatencyCompensation(input: LatencyCompensationInput): LatencyCompensationResult {
  const {
    bufferLength,
    sampleRate,
    outputLatency,
    lookAhead,
    overrideSeconds,
    recordingStartTime,
    lastClipEndSample,
  } = input;

  const recordStartTimeSamples = Math.floor(recordingStartTime * sampleRate);
  const startSample = Math.max(recordStartTimeSamples, lastClipEndSample);

  const latencyOffsetSamples = resolveRecordingOffsetSamples({
    overrideSeconds,
    outputLatency,
    lookAhead,
    sampleRate,
  });
  const effectiveDuration = Math.max(0, bufferLength - latencyOffsetSamples);

  return {
    startSample,
    offsetSamples: latencyOffsetSamples,
    durationSamples: effectiveDuration,
    discarded: effectiveDuration === 0,
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd packages/recording && npx vitest run src/__tests__/latencyCompensation.test.ts`
Expected: PASS (override cases + all existing auto cases — they now route through the real resolver and the numbers are unchanged).

- [ ] **Step 5: Wire `latencyOffset` into the hook**

In `packages/recording/src/hooks/useIntegratedRecording.ts`, change the core import (line 11) — `audibleLatencySamples` is only used in `stopRecording`, so replace it:

```ts
import { type ClipTrack, type AudioClip, resolveRecordingOffsetSamples } from '@waveform-playlist/core';
```

Add the option to `IntegratedRecordingOptions` (after `samplesPerPixel`):

```ts
  /**
   * Latency offset to skip at the start of the recording, in **seconds**.
   * Absolute replacement for the auto-computed `outputLatency + lookAhead` value
   * — use this to apply an externally-measured round-trip latency. `0` disables
   * compensation; when omitted, the auto-computed value is used. Pass the same
   * value into the provider's `recordingState.latencyOffset` so the live preview
   * matches the finalized clip.
   */
  latencyOffset?: number;
```

Destructure it (line 83):

```ts
  const { currentTime = 0, audioConstraints, latencyOffset, ...recordingOptions } = options;
```

Replace the offset computation in `stopRecording` (lines 199-215) — keep the `outputLatency` / `lookAhead` reads, swap the final call:

```ts
      // Latency compensation: an explicit latencyOffset (seconds) replaces the
      // auto-computed outputLatency + lookAhead window. Shared resolver with the
      // live preview in PlaylistVisualization — keep both using the same value so
      // trim widths match.
      const audioContext = getGlobalAudioContext();
      const outputLatency = audioContext.outputLatency ?? 0;
      const toneContext = getGlobalContext();
      const lookAhead = toneContext.lookAhead ?? 0;
      const latencyOffsetSamples = resolveRecordingOffsetSamples({
        overrideSeconds: latencyOffset,
        outputLatency,
        lookAhead,
        sampleRate: buffer.sampleRate,
      });
```

- [ ] **Step 6: Typecheck and run the recording suite**

Run: `cd packages/recording && pnpm typecheck && npx vitest run`
Expected: PASS. (`pnpm typecheck` confirms `audibleLatencySamples` is no longer referenced and `latencyOffset` is consumed.)

- [ ] **Step 7: Lint and commit**

```bash
pnpm -w lint
git add packages/recording/src/hooks/useIntegratedRecording.ts packages/recording/src/__tests__/latencyCompensation.test.ts
git commit -m "feat(recording): add latencyOffset option to useIntegratedRecording (#502)"
```

---

### Task 4: React live preview `recordingState.latencyOffset`

**Files:**
- Modify: `packages/browser/src/components/PlaylistVisualization.tsx` (import 37; `recordingState` prop type 92-99; preview block 742-754)
- Modify: `packages/browser/src/components/Waveform.tsx` (mirror the `recordingState` prop type at line 54)

**Interfaces:**
- Consumes: `resolveRecordingOffsetSamples` from `@waveform-playlist/core` (Task 1); `recordingState.latencyOffset?: number` (new prop field).
- Produces: nothing for later tasks.

**Test note:** No new unit test here. The override decision is fully covered by Task 1's resolver tests; this task is pure wiring (a prop-type field plus a one-line resolver swap) inside an 800-line canvas component with no existing preview-math test harness — a render test would need canvas + `getOutputLatency`/`getLookAhead` mocking disproportionate to a literal pass-through. Verification is typecheck + build + the manual browser check below.

- [ ] **Step 1: Add `latencyOffset` to the `recordingState` prop type (both files)**

In `packages/browser/src/components/PlaylistVisualization.tsx` (lines 92-99) and `packages/browser/src/components/Waveform.tsx` (the matching `recordingState?: { ... }` at line 54), add the field to the object type:

```ts
  recordingState?: {
    isRecording: boolean;
    trackId: string;
    startSample: number;
    durationSamples: number;
    peaks: (Int8Array | Int16Array)[];
    bits: 8 | 16;
    /**
     * Latency offset (seconds) to skip in the live preview. Absolute replacement
     * for the auto-computed outputLatency + lookAhead value. Pass the same value
     * given to useIntegratedRecording so preview and finalized clip match.
     */
    latencyOffset?: number;
  };
```

- [ ] **Step 2: Swap the import in `PlaylistVisualization.tsx`**

`audibleLatencySamples` is used only in the preview block (line 744). Change the import (line 37):

```ts
import { resolveRecordingOffsetSamples, type Peaks } from '@waveform-playlist/core';
```

- [ ] **Step 3: Use the resolver in the preview block**

In `PlaylistVisualization.tsx`, replace the `audibleLatencySamples(...)` call (lines 742-748) with:

```ts
                      const latencyOffsetSamples = resolveRecordingOffsetSamples({
                        overrideSeconds: recordingState.latencyOffset,
                        outputLatency: getOutputLatency(),
                        lookAhead: getLookAhead(),
                        sampleRate,
                      });
```

(Leave the surrounding `latencyPixels` / `skipPeakElements` / `previewDuration` lines unchanged.)

- [ ] **Step 4: Typecheck and build the browser package**

Run: `pnpm --filter @waveform-playlist/browser typecheck && pnpm --filter @waveform-playlist/browser build`
Expected: PASS (the build runs typecheck first; confirms `audibleLatencySamples` is no longer referenced and the new prop field type-checks).

- [ ] **Step 5: Manual browser verification**

Start a recording example, begin recording with overdub against a backing track, and confirm: with no `latencyOffset` the preview behaves as before; with a `latencyOffset` passed into `recordingState`, the live preview's left edge shifts to match, and the finalized clip lands in the same place (no jump at finalize).

Suggested page: `pnpm --filter website start` → the recording example. (Per project E2E notes, use the Record/Stop buttons, not Space, for initial playback.)

- [ ] **Step 6: Lint and commit**

```bash
pnpm -w lint
git add packages/browser/src/components/PlaylistVisualization.tsx packages/browser/src/components/Waveform.tsx
git commit -m "feat(browser): honor recordingState.latencyOffset in live preview (#502)"
```

---

### Task 5: Documentation

**Files:**
- Modify: the recording guide doc (find with the grep in Step 1)
- Modify: `website/docs/api/llm-reference.md`
- Modify: `website/static/llms.txt`

**Interfaces:**
- Consumes: the final `latencyOffset` API from Tasks 2–4.
- Produces: nothing.

- [ ] **Step 1: Locate the recording guide**

Run: `grep -rln "useIntegratedRecording\|RecordingOptions\|overdub" website/docs`
Use the recording/overdub guide page that documents the recording options. Add a `latencyOffset` subsection covering: unit (seconds), absolute-replacement semantics, `0` disables, default = auto-computed, and the **externally-measured latency** use case (#502). For React, note that the same value must be passed to both `useIntegratedRecording` and the provider's `recordingState.latencyOffset` so the preview and finalized clip match; for dawcore, note it is a single `RecordingOptions.latencyOffset`.

- [ ] **Step 2: Update `llm-reference.md`**

In `website/docs/api/llm-reference.md`, add `latencyOffset?: number` to the documented `RecordingOptions` (dawcore) and `IntegratedRecordingOptions` (React) interfaces, and to the `recordingState` shape if it is listed. Match the surrounding interface-only style (no prose).

- [ ] **Step 3: Update `llms.txt`**

In `website/static/llms.txt`, add a one-line mention that recording latency compensation is configurable via `latencyOffset` (seconds) on both the React and dawcore recording APIs.

- [ ] **Step 4: Verify docs build**

Run: `pnpm --filter website build`
Expected: build succeeds (pre-existing CSS calc warnings are harmless; the Docusaurus broken-link checker passes).

- [ ] **Step 5: Lint and commit**

```bash
pnpm -w lint
git add website/docs website/static/llms.txt
git commit -m "docs: document configurable recording latencyOffset (#502)"
```

---

## Release note (post-merge, user-gated)

Publishing is user-driven — do not publish as part of this plan. When releasing:
`@waveform-playlist/core` (minor: new export), `@dawcore/components` (patch: new optional option — stays `0.0.x`), `@waveform-playlist/recording` and `@waveform-playlist/browser` (minor: new optional option/prop). Per the workspace pinning rule, republish every `@waveform-playlist/*` package whose pinned dep on `core` bumped so consumers get the new export.

## Self-Review

**Spec coverage:**
- Shared core primitive → Task 1. ✅
- `latencyOffset` (seconds) naming + absolute-replacement/`0`-disables/unset semantics → Global Constraints + Tasks 1-4. ✅
- dawcore `RecordingOptions` + resolver call → Task 2. ✅
- React finalization (`useIntegratedRecording`) → Task 3. ✅
- React live preview (`PlaylistVisualization` + `Waveform` prop) → Task 4. ✅
- Event shape unchanged (`offsetSamples` already reports applied value) → no task needed; verified by Task 2's test asserting the applied `480`. ✅
- Edge cases (0/negative/non-finite/too-large discard) → Task 1 tests (0/negative/non-finite); too-large discard is existing behavior, unchanged. ✅
- Testing plan (core/recording/dawcore) → Tasks 1-3. ✅
- Docs surfaces → Task 5. ✅
- Out of scope (`TrackDescriptor.trackId`, latency measurement) → not implemented, as specified. ✅

**Placeholder scan:** No TBD/TODO; every code step shows complete code; the one discovery step (Task 5 Step 1) is a grep, not a placeholder.

**Type consistency:** `resolveRecordingOffsetSamples({ overrideSeconds?, outputLatency, lookAhead, sampleRate })` is used with identical parameter names in Tasks 1, 2, 3, 4. Public option `latencyOffset` (seconds) consistent across dawcore `RecordingOptions`, React `IntegratedRecordingOptions`, and `recordingState`. ✅
