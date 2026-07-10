# Annotation Web Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement `<daw-annotation-track>`, `<daw-annotation>`, and `<daw-annotation-list>` web components (#455) with single-source-of-truth dual-view sync and keyboard controls, hosted by `<daw-editor>`.

**Architecture:** Data-element pattern — `<daw-annotation>`/`<daw-annotation-track>` are light-DOM data elements (the annotation elements' attributes + text ARE the data); `<daw-editor>` renders the annotation lane inside its shadow-DOM timeline via a new `AnnotationController`; `<daw-annotation-list>` is a standalone shadow-DOM element linked via `for`. Boundary math is extracted from the React hook into `@waveform-playlist/core` and shared.

**Tech Stack:** Lit (dawcore conventions), vitest + happy-dom, pure TS in core.

**Design doc:** `docs/specs/2026-07-10-annotation-web-components-design.md` (approved). API shapes: `docs/specs/web-components-migration.md` sections "`<daw-annotation-track>` API" and "Annotation Keyboard Controls".

## Global Constraints

- Branch: `feature/annotation-web-components` (already created). Commit after every task.
- Immutability: never mutate input arrays/objects — return new copies.
- Lit decorators need `experimentalDecorators` — already configured in dawcore.
- Light DOM elements override `createRenderRoot() { return this; }`.
- `console.log`/`console.warn` arguments must be STRING-ONLY (concatenate; never pass objects).
- Validated numeric properties use `@property({ noAccessor: true })` + custom accessors that `console.warn` + reject invalid values (dawcore project standard).
- File size: `daw-editor.ts` hard max 800-line growth budget mindset — new logic goes in `controllers/annotation-controller.ts` and `interactions/annotation-drag.ts`.
- Run tests from the package dir: `cd packages/<pkg> && npx vitest run <file>`. After multi-package vitest runs: `pgrep -f vitest` and `pkill -f vitest` if strays remain.
- `pnpm typecheck` resolves workspace deps via `dist/` — build core (`pnpm --filter @waveform-playlist/core build`) after changing core and BEFORE running dawcore/annotations typecheck or tests.
- Before final commit of the arc: `pnpm -w lint` must exit 0 with 0 errors (warnings pre-exist), `pnpm typecheck`, `pnpm build` all pass.
- Commit messages: conventional commits, no backticks inside `git commit -m "…"` double quotes (use `git commit -F - << 'EOF'` when needed). No attribution footer.
- Beats-mode limitation (accepted, documented in Task 13): annotation lane positions use `seconds × sampleRate / _renderSpp` — under variable-tempo tick callbacks the lane may drift from the grid. v1 limitation.

---

### Task 1: Core — `matchesKeyBinding` helper (keyboard.ts refactor)

The annotation track element needs to know *which* binding matched (to map to an action name), which `handleKeyboardEvent` can't tell it. Extract the matching predicate.

**Files:**
- Modify: `packages/core/src/keyboard.ts`
- Test: `packages/core/src/__tests__/keyboard.test.ts` (append)

**Interfaces:**
- Produces: `KeyBinding` type and `matchesKeyBinding(event: KeyboardEvent, binding: KeyBinding): boolean`, exported from `@waveform-playlist/core`. `handleKeyboardEvent` behavior unchanged.

- [ ] **Step 1: Write the failing tests** (append to `keyboard.test.ts`)

```typescript
import { matchesKeyBinding } from '../keyboard';

describe('matchesKeyBinding', () => {
  const ev = (init: KeyboardEventInit) => new KeyboardEvent('keydown', init);

  it('matches key case-insensitively', () => {
    expect(matchesKeyBinding(ev({ key: 'S' }), { key: 's' })).toBe(true);
  });

  it('undefined modifier matches any state', () => {
    expect(matchesKeyBinding(ev({ key: 'a', ctrlKey: true }), { key: 'a' })).toBe(true);
  });

  it('explicit false modifier must NOT be pressed', () => {
    expect(matchesKeyBinding(ev({ key: 'a', ctrlKey: true }), { key: 'a', ctrlKey: false })).toBe(
      false
    );
  });

  it('explicit true modifier must be pressed', () => {
    expect(matchesKeyBinding(ev({ key: 'z', shiftKey: true }), { key: 'z', shiftKey: true })).toBe(
      true
    );
    expect(matchesKeyBinding(ev({ key: 'z' }), { key: 'z', shiftKey: true })).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/core && npx vitest run src/__tests__/keyboard.test.ts`
Expected: FAIL — `matchesKeyBinding` is not exported.

- [ ] **Step 3: Implement in `keyboard.ts`**

Add after the `KeyboardShortcut` interface:

```typescript
/** A key + modifier combination, without an action. Used for remapping maps. */
export type KeyBinding = Pick<
  KeyboardShortcut,
  'key' | 'ctrlKey' | 'shiftKey' | 'metaKey' | 'altKey'
>;

/**
 * Does a keyboard event match a key binding?
 * `undefined` modifier = match any state; `false` = must NOT be pressed.
 */
export function matchesKeyBinding(event: KeyboardEvent, binding: KeyBinding): boolean {
  const keyMatch =
    event.key.toLowerCase() === binding.key.toLowerCase() || event.key === binding.key;
  const ctrlMatch = binding.ctrlKey === undefined || event.ctrlKey === binding.ctrlKey;
  const shiftMatch = binding.shiftKey === undefined || event.shiftKey === binding.shiftKey;
  const metaMatch = binding.metaKey === undefined || event.metaKey === binding.metaKey;
  const altMatch = binding.altKey === undefined || event.altKey === binding.altKey;
  return keyMatch && ctrlMatch && shiftMatch && metaMatch && altMatch;
}
```

Then refactor `handleKeyboardEvent`'s `shortcuts.find((shortcut) => { ... })` body to `shortcuts.find((shortcut) => matchesKeyBinding(event, shortcut))` (delete the inlined predicate).

- [ ] **Step 4: Run the full keyboard test file**

Run: `cd packages/core && npx vitest run src/__tests__/keyboard.test.ts`
Expected: PASS (new tests + all pre-existing `handleKeyboardEvent` tests — proves the refactor is behavior-preserving).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/keyboard.ts packages/core/src/__tests__/keyboard.test.ts
git commit -m "refactor(core): extract matchesKeyBinding from handleKeyboardEvent"
```

---

### Task 2: Core — annotation boundary math (`annotations/boundaries.ts`)

Extract the pure boundary-update logic from `packages/annotations/src/hooks/useAnnotationControls.ts` (lines 45–176). The hook has NO existing unit tests, so these are the authoritative characterization tests.

**Files:**
- Create: `packages/core/src/annotations/boundaries.ts`
- Modify: `packages/core/src/index.ts` (add `export * from './annotations/boundaries';`)
- Test: `packages/core/src/__tests__/annotationBoundaries.test.ts`

**Interfaces:**
- Consumes: `AnnotationData` from `packages/core/src/types/annotations.ts`.
- Produces (exported from `@waveform-playlist/core`):
  - `LINK_THRESHOLD = 0.01`, `MIN_ANNOTATION_DURATION = 0.1` (constants)
  - `interface AnnotationBoundaryUpdate { annotationIndex: number; newTime: number; isDraggingStart: boolean; annotations: AnnotationData[]; duration: number; linkEndpoints: boolean; }`
  - `updateAnnotationBoundaries(params: AnnotationBoundaryUpdate): AnnotationData[]`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import {
  updateAnnotationBoundaries,
  LINK_THRESHOLD,
  MIN_ANNOTATION_DURATION,
} from '../annotations/boundaries';
import type { AnnotationData } from '../types/annotations';

const ann = (id: string, start: number, end: number): AnnotationData => ({
  id,
  start,
  end,
  lines: [id],
});

describe('updateAnnotationBoundaries', () => {
  it('exports the shared constants', () => {
    expect(LINK_THRESHOLD).toBe(0.01);
    expect(MIN_ANNOTATION_DURATION).toBe(0.1);
  });

  it('does not mutate the input array or its objects', () => {
    const input = [ann('a', 0, 2), ann('b', 2, 4)];
    const snapshot = JSON.parse(JSON.stringify(input));
    updateAnnotationBoundaries({
      annotationIndex: 1,
      newTime: 1.5,
      isDraggingStart: true,
      annotations: input,
      duration: 10,
      linkEndpoints: true,
    });
    expect(input).toEqual(snapshot);
  });

  it('clamps start to [0, end - 0.1]', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: -5,
      isDraggingStart: true,
      annotations: [ann('a', 1, 2)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result[0].start).toBe(0);

    const result2 = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: 5,
      isDraggingStart: true,
      annotations: [ann('a', 1, 2)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result2[0].start).toBeCloseTo(1.9); // end - MIN_ANNOTATION_DURATION
  });

  it('clamps end to [start + 0.1, duration]', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: 99,
      isDraggingStart: false,
      annotations: [ann('a', 1, 2)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result[0].end).toBe(10);
  });

  it('linked mode: moving a start moves the linked previous end with it', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 1,
      newTime: 1.5,
      isDraggingStart: true,
      annotations: [ann('a', 0, 2), ann('b', 2, 4)], // linked at 2 (within 10ms)
      duration: 10,
      linkEndpoints: true,
    });
    expect(result[1].start).toBeCloseTo(1.5);
    expect(result[0].end).toBeCloseTo(1.5);
  });

  it('linked mode: dragging start past an unlinked previous end snaps to it', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 1,
      newTime: 1.0,
      isDraggingStart: true,
      annotations: [ann('a', 0, 1.5), ann('b', 2, 4)], // gap 1.5→2, not linked
      duration: 10,
      linkEndpoints: true,
    });
    expect(result[1].start).toBeCloseTo(1.5); // snapped to prev.end
  });

  it('unlinked mode: colliding start pushes previous end back', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 1,
      newTime: 1.0,
      isDraggingStart: true,
      annotations: [ann('a', 0, 1.5), ann('b', 2, 4)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result[1].start).toBeCloseTo(1.0);
    expect(result[0].end).toBeCloseTo(1.0);
  });

  it('linked mode: moving an end cascades through consecutively linked neighbors', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: 2.5,
      isDraggingStart: false,
      annotations: [ann('a', 0, 2), ann('b', 2, 4), ann('c', 4, 6)], // all linked
      duration: 10,
      linkEndpoints: true,
    });
    expect(result[0].end).toBeCloseTo(2.5);
    expect(result[1].start).toBeCloseTo(2.5);
    // cascade: b's end did not move, so c is untouched (delta applies to starts only
    // when segments remain linked after b.start shifted — matches hook behavior)
    expect(result[2].start).toBeCloseTo(4);
  });

  it('unlinked mode: colliding end pushes and cascades next starts forward', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: 4.5,
      isDraggingStart: false,
      annotations: [ann('a', 0, 2), ann('b', 4, 4.2), ann('c', 4.2, 6)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result[0].end).toBeCloseTo(4.5);
    expect(result[1].start).toBeCloseTo(4.5); // pushed
    expect(result[2].start).toBeCloseTo(4.5); // cascade: b.end (4.2) > c.start (4.2)? equal → no push. See note.
  });
});
```

**Note for the cascade test:** verify the expected values against the ACTUAL hook behavior by reading `useAnnotationControls.ts:141-170` before finalizing assertions — the collision cascade pushes `next.start = current.end` only when `current.end > next.start` (strict). With `b` pushed to start 4.5 but `b.end` still 4.2 (start > end now — the hook does NOT fix that in unlinked push), `c` IS pushed only if `4.2 > 4.2` = false. Encode what the code actually does — these are characterization tests; do not "fix" behavior in this task.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/core && npx vitest run src/__tests__/annotationBoundaries.test.ts`
Expected: FAIL — module `../annotations/boundaries` not found.

- [ ] **Step 3: Implement `packages/core/src/annotations/boundaries.ts`**

Port the body of `updateAnnotationBoundaries` from `packages/annotations/src/hooks/useAnnotationControls.ts` lines 45–176 **verbatim in behavior** (this is an extraction, not a rewrite):

```typescript
import type { AnnotationData } from '../types/annotations';

/** Edges within this distance (seconds) are considered "linked". */
export const LINK_THRESHOLD = 0.01;

/** Minimum annotation duration (seconds) enforced by boundary edits. */
export const MIN_ANNOTATION_DURATION = 0.1;

export interface AnnotationBoundaryUpdate {
  annotationIndex: number;
  newTime: number;
  isDraggingStart: boolean;
  annotations: AnnotationData[];
  duration: number;
  linkEndpoints: boolean;
}

/**
 * Pure boundary-update logic shared by the React annotations package and the
 * dawcore annotation web components. Handles linked endpoints (moving one edge
 * drags the linked neighbor edge, with cascade) and collision push-back.
 * Returns a NEW array; never mutates inputs.
 */
export function updateAnnotationBoundaries(params: AnnotationBoundaryUpdate): AnnotationData[] {
  const { annotationIndex, newTime, isDraggingStart, annotations, duration, linkEndpoints } =
    params;
  const updatedAnnotations = [...annotations];
  const annotation = annotations[annotationIndex];

  if (isDraggingStart) {
    const constrainedStart = Math.min(
      annotation.end - MIN_ANNOTATION_DURATION,
      Math.max(0, newTime)
    );
    const delta = constrainedStart - annotation.start;

    updatedAnnotations[annotationIndex] = { ...annotation, start: constrainedStart };

    if (linkEndpoints && annotationIndex > 0) {
      const prevAnnotation = updatedAnnotations[annotationIndex - 1];
      if (Math.abs(prevAnnotation.end - annotation.start) < LINK_THRESHOLD) {
        updatedAnnotations[annotationIndex - 1] = {
          ...prevAnnotation,
          end: Math.max(prevAnnotation.start + MIN_ANNOTATION_DURATION, prevAnnotation.end + delta),
        };
      } else if (constrainedStart <= prevAnnotation.end) {
        updatedAnnotations[annotationIndex] = {
          ...updatedAnnotations[annotationIndex],
          start: prevAnnotation.end,
        };
      }
    } else if (
      !linkEndpoints &&
      annotationIndex > 0 &&
      constrainedStart < updatedAnnotations[annotationIndex - 1].end
    ) {
      updatedAnnotations[annotationIndex - 1] = {
        ...updatedAnnotations[annotationIndex - 1],
        end: constrainedStart,
      };
    }
  } else {
    const constrainedEnd = Math.max(
      annotation.start + MIN_ANNOTATION_DURATION,
      Math.min(newTime, duration)
    );
    const delta = constrainedEnd - annotation.end;

    updatedAnnotations[annotationIndex] = { ...annotation, end: constrainedEnd };

    if (linkEndpoints && annotationIndex < updatedAnnotations.length - 1) {
      const nextAnnotation = updatedAnnotations[annotationIndex + 1];
      if (Math.abs(nextAnnotation.start - annotation.end) < LINK_THRESHOLD) {
        const newStart = nextAnnotation.start + delta;
        updatedAnnotations[annotationIndex + 1] = {
          ...nextAnnotation,
          start: Math.min(nextAnnotation.end - MIN_ANNOTATION_DURATION, newStart),
        };

        let currentIndex = annotationIndex + 1;
        while (currentIndex < updatedAnnotations.length - 1) {
          const current = updatedAnnotations[currentIndex];
          const next = updatedAnnotations[currentIndex + 1];
          if (Math.abs(next.start - current.end) < LINK_THRESHOLD) {
            const nextDelta = current.end - annotations[currentIndex].end;
            updatedAnnotations[currentIndex + 1] = {
              ...next,
              start: Math.min(next.end - MIN_ANNOTATION_DURATION, next.start + nextDelta),
            };
            currentIndex++;
          } else {
            break;
          }
        }
      } else if (constrainedEnd >= nextAnnotation.start) {
        updatedAnnotations[annotationIndex] = {
          ...updatedAnnotations[annotationIndex],
          end: nextAnnotation.start,
        };
      }
    } else if (
      !linkEndpoints &&
      annotationIndex < updatedAnnotations.length - 1 &&
      constrainedEnd > updatedAnnotations[annotationIndex + 1].start
    ) {
      const nextAnnotation = updatedAnnotations[annotationIndex + 1];
      updatedAnnotations[annotationIndex + 1] = { ...nextAnnotation, start: constrainedEnd };

      let currentIndex = annotationIndex + 1;
      while (currentIndex < updatedAnnotations.length - 1) {
        const current = updatedAnnotations[currentIndex];
        const next = updatedAnnotations[currentIndex + 1];
        if (current.end > next.start) {
          updatedAnnotations[currentIndex + 1] = { ...next, start: current.end };
          currentIndex++;
        } else {
          break;
        }
      }
    }
  }

  return updatedAnnotations;
}
```

Add to `packages/core/src/index.ts`:

```typescript
export * from './annotations/boundaries';
```

- [ ] **Step 4: Run tests**

Run: `cd packages/core && npx vitest run src/__tests__/annotationBoundaries.test.ts`
Expected: PASS. If a cascade assertion fails, re-read the hook source and fix the TEST expectation (characterization — the port must match the hook exactly).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/annotations/boundaries.ts packages/core/src/index.ts packages/core/src/__tests__/annotationBoundaries.test.ts
git commit -m "feat(core): extract annotation boundary math to framework-agnostic module"
```

---

### Task 3: Core — annotation shortcut map (`annotations/shortcuts.ts`)

**Files:**
- Create: `packages/core/src/annotations/shortcuts.ts`
- Modify: `packages/core/src/index.ts` (add export)
- Test: `packages/core/src/__tests__/annotationShortcuts.test.ts`

**Interfaces:**
- Consumes: `KeyBinding` from Task 1.
- Produces (exported from `@waveform-playlist/core`):
  - `type AnnotationShortcutAction` (union of the 10 action names)
  - `interface AnnotationShortcutMap` — optional `KeyBinding` per action (spec shape)
  - `DEFAULT_ANNOTATION_SHORTCUTS: Record<AnnotationShortcutAction, KeyBinding[]>` (arrays: `selectPrevious`/`selectNext` have two default bindings)
  - `resolveAnnotationShortcuts(remap: AnnotationShortcutMap | null): Array<{ action: AnnotationShortcutAction; binding: KeyBinding }>`

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect } from 'vitest';
import {
  DEFAULT_ANNOTATION_SHORTCUTS,
  resolveAnnotationShortcuts,
} from '../annotations/shortcuts';

describe('annotation shortcuts', () => {
  it('defaults match the spec table', () => {
    expect(DEFAULT_ANNOTATION_SHORTCUTS.selectPrevious.map((b) => b.key)).toEqual([
      'ArrowUp',
      'ArrowLeft',
    ]);
    expect(DEFAULT_ANNOTATION_SHORTCUTS.selectNext.map((b) => b.key)).toEqual([
      'ArrowDown',
      'ArrowRight',
    ]);
    expect(DEFAULT_ANNOTATION_SHORTCUTS.playActive[0].key).toBe('Enter');
    expect(DEFAULT_ANNOTATION_SHORTCUTS.moveStartEarlier[0].key).toBe('[');
    expect(DEFAULT_ANNOTATION_SHORTCUTS.moveEndLater[0].key).toBe('}');
  });

  it('resolve with null returns all defaults flattened', () => {
    const entries = resolveAnnotationShortcuts(null);
    const nextEntries = entries.filter((e) => e.action === 'selectNext');
    expect(nextEntries).toHaveLength(2);
  });

  it('partial remap overrides only the named action', () => {
    const entries = resolveAnnotationShortcuts({ selectNext: { key: 'j' } });
    const nextEntries = entries.filter((e) => e.action === 'selectNext');
    expect(nextEntries).toHaveLength(1);
    expect(nextEntries[0].binding.key).toBe('j');
    const prevEntries = entries.filter((e) => e.action === 'selectPrevious');
    expect(prevEntries).toHaveLength(2); // untouched defaults
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/core && npx vitest run src/__tests__/annotationShortcuts.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `packages/core/src/annotations/shortcuts.ts`**

```typescript
import type { KeyBinding } from '../keyboard';

export type AnnotationShortcutAction =
  | 'selectPrevious'
  | 'selectNext'
  | 'selectFirst'
  | 'selectLast'
  | 'clearSelection'
  | 'moveStartEarlier'
  | 'moveStartLater'
  | 'moveEndEarlier'
  | 'moveEndLater'
  | 'playActive';

/** Key remapping map — null on the consumer means "use defaults". */
export interface AnnotationShortcutMap {
  selectPrevious?: KeyBinding;
  selectNext?: KeyBinding;
  selectFirst?: KeyBinding;
  selectLast?: KeyBinding;
  clearSelection?: KeyBinding;
  moveStartEarlier?: KeyBinding;
  moveStartLater?: KeyBinding;
  moveEndEarlier?: KeyBinding;
  moveEndLater?: KeyBinding;
  playActive?: KeyBinding;
}

// Explicit ctrlKey/metaKey: false so browser combos (Cmd+ArrowLeft = history
// back, Cmd+[ = back, etc.) never trigger annotation actions — same convention
// as <daw-keyboard-shortcuts> presets.
const noMods = { ctrlKey: false as const, metaKey: false as const };

export const DEFAULT_ANNOTATION_SHORTCUTS: Record<AnnotationShortcutAction, KeyBinding[]> = {
  selectPrevious: [
    { key: 'ArrowUp', ...noMods },
    { key: 'ArrowLeft', ...noMods },
  ],
  selectNext: [
    { key: 'ArrowDown', ...noMods },
    { key: 'ArrowRight', ...noMods },
  ],
  selectFirst: [{ key: 'Home', ...noMods }],
  selectLast: [{ key: 'End', ...noMods }],
  clearSelection: [{ key: 'Escape', ...noMods }],
  moveStartEarlier: [{ key: '[', ...noMods }],
  moveStartLater: [{ key: ']', ...noMods }],
  // '{' / '}' are what event.key reports for Shift+[ / Shift+] — no explicit
  // shiftKey needed; the key value itself encodes it.
  moveEndEarlier: [{ key: '{', ...noMods }],
  moveEndLater: [{ key: '}', ...noMods }],
  playActive: [{ key: 'Enter', ...noMods }],
};

const ALL_ACTIONS = Object.keys(DEFAULT_ANNOTATION_SHORTCUTS) as AnnotationShortcutAction[];

/**
 * Flatten defaults + remap into a matchable list. A remapped action replaces
 * ALL of its default bindings with the single provided binding.
 */
export function resolveAnnotationShortcuts(
  remap: AnnotationShortcutMap | null
): Array<{ action: AnnotationShortcutAction; binding: KeyBinding }> {
  return ALL_ACTIONS.flatMap((action) => {
    const override = remap?.[action];
    const bindings = override ? [override] : DEFAULT_ANNOTATION_SHORTCUTS[action];
    return bindings.map((binding) => ({ action, binding }));
  });
}
```

Add to `packages/core/src/index.ts`:

```typescript
export * from './annotations/shortcuts';
```

- [ ] **Step 4: Run tests, typecheck, build core**

Run: `cd packages/core && npx vitest run` (whole package)
Expected: PASS.
Run: `pnpm --filter @waveform-playlist/core build`
Expected: build succeeds (typecheck is part of the build script).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/annotations/shortcuts.ts packages/core/src/index.ts packages/core/src/__tests__/annotationShortcuts.test.ts
git commit -m "feat(core): annotation shortcut map with spec defaults and remapping"
```

---

### Task 4: React hook delegates to core

**Files:**
- Modify: `packages/annotations/src/hooks/useAnnotationControls.ts`

**Interfaces:**
- Consumes: `updateAnnotationBoundaries`, `AnnotationBoundaryUpdate` from `@waveform-playlist/core` (Task 2; core must be BUILT — done in Task 3 Step 4).
- Produces: unchanged public API — `useAnnotationControls`, `AnnotationUpdateParams`, `UseAnnotationControlsReturn` keep their exact exported shapes. **No re-exports of core symbols** (no-cross-package-re-export rule); the hook consumes core internally.

- [ ] **Step 1: Refactor the hook**

Replace the entire body of the `updateAnnotationBoundaries` `useCallback` (lines 45–176) with a delegation, and delete the local `LINK_THRESHOLD` constant:

```typescript
import { useState, useCallback } from 'react';
import { updateAnnotationBoundaries as computeAnnotationBoundaries } from '@waveform-playlist/core';
import type { AnnotationData } from '../types';

export interface UseAnnotationControlsOptions {
  initialContinuousPlay?: boolean;
  initialLinkEndpoints?: boolean;
}

export interface AnnotationUpdateParams {
  annotationIndex: number;
  newTime: number;
  isDraggingStart: boolean;
  annotations: AnnotationData[];
  duration: number;
  linkEndpoints: boolean;
}

export interface UseAnnotationControlsReturn {
  continuousPlay: boolean;
  linkEndpoints: boolean;
  setContinuousPlay: (value: boolean) => void;
  setLinkEndpoints: (value: boolean) => void;
  updateAnnotationBoundaries: (params: AnnotationUpdateParams) => AnnotationData[];
}

/**
 * Hook for managing annotation control state and boundary logic.
 * Boundary math lives in @waveform-playlist/core (shared with dawcore).
 */
export const useAnnotationControls = (
  options: UseAnnotationControlsOptions = {}
): UseAnnotationControlsReturn => {
  const { initialContinuousPlay = false, initialLinkEndpoints = true } = options;

  const [continuousPlay, setContinuousPlay] = useState(initialContinuousPlay);
  const [linkEndpoints, setLinkEndpoints] = useState(initialLinkEndpoints);

  const updateAnnotationBoundaries = useCallback(
    (params: AnnotationUpdateParams): AnnotationData[] => computeAnnotationBoundaries(params),
    []
  );

  return {
    continuousPlay,
    linkEndpoints,
    setContinuousPlay,
    setLinkEndpoints,
    updateAnnotationBoundaries,
  };
};
```

- [ ] **Step 2: Verify**

Run: `cd packages/annotations && npx vitest run`
Expected: PASS (aeneas suite — the package's only tests).
Run: `pnpm --filter @waveform-playlist/annotations build`
Expected: build + typecheck pass (requires core `dist/` from Task 3).

- [ ] **Step 3: Commit**

```bash
git add packages/annotations/src/hooks/useAnnotationControls.ts
git commit -m "refactor(annotations): delegate boundary math to @waveform-playlist/core"
```

---

### Task 5: dawcore — `<daw-annotation>` element + event types

**Files:**
- Create: `packages/dawcore/src/elements/daw-annotation.ts`
- Modify: `packages/dawcore/src/events.ts` (add detail types to `DawEventMap`)
- Modify: `packages/dawcore/src/index.ts` (export element; mirror how `daw-clip` is exported)
- Test: `packages/dawcore/src/__tests__/daw-annotation.test.ts`

**Interfaces:**
- Produces:
  - `DawAnnotationElement` with: `start: number` / `end: number` (validated, **`reflect: true`** — reflection is what makes attributes the source of truth for the list's MutationObserver), `annotationId: string` (getter: `this.id || generated UUID`), `toAnnotationData(): AnnotationData` (lines = trimmed `textContent` split on `\n`).
  - Events `daw-annotation-connected` (deferred, detail `{ annotationId, element }`) and `daw-annotation-update` (after first render, detail `{ annotationId }`) — both bubbling + composed.
  - Event detail types in `events.ts`: `DawAnnotationConnectedDetail`, `DawAnnotationUpdateDetail`, `DawAnnotationSelectDetail { annotation: AnnotationData | null }`, `DawAnnotationTrackConnectedDetail { element: HTMLElement }` (select/track-connected consumed by Tasks 6/8).

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import type { DawAnnotationElement } from '../elements/daw-annotation';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('<daw-annotation>', () => {
  let el: DawAnnotationElement;

  beforeEach(() => {
    el = document.createElement('daw-annotation') as DawAnnotationElement;
  });

  afterEach(() => {
    el.remove();
  });

  it('parses start/end attributes and text content into AnnotationData', async () => {
    el.setAttribute('start', '1.5');
    el.setAttribute('end', '3');
    el.textContent = 'First line';
    document.body.appendChild(el);
    await flush();
    expect(el.toAnnotationData()).toEqual({
      id: el.annotationId,
      start: 1.5,
      end: 3,
      lines: ['First line'],
    });
  });

  it('uses the id attribute as annotationId when present', () => {
    el.id = 'a1';
    expect(el.annotationId).toBe('a1');
  });

  it('generates a stable annotationId when no id attribute', () => {
    const generated = el.annotationId;
    expect(generated).toBeTruthy();
    expect(el.annotationId).toBe(generated);
  });

  it('rejects invalid start values with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.appendChild(el);
    await flush();
    el.start = 5;
    el.start = -1; // rejected
    el.start = NaN; // rejected
    expect(el.start).toBe(5);
    expect(warn).toHaveBeenCalledTimes(2);
    warn.mockRestore();
  });

  it('reflects the start property to the attribute', async () => {
    document.body.appendChild(el);
    await flush();
    el.start = 2.5;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.getAttribute('start')).toBe('2.5');
  });

  it('dispatches deferred daw-annotation-connected on mount', async () => {
    const events: string[] = [];
    document.body.addEventListener('daw-annotation-connected', () => events.push('connected'), {
      once: true,
    });
    document.body.appendChild(el);
    expect(events).toHaveLength(0); // deferred
    await flush();
    expect(events).toEqual(['connected']);
  });

  it('dispatches daw-annotation-update on property change after first render', async () => {
    document.body.appendChild(el);
    await flush();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const spy = vi.fn();
    document.body.addEventListener('daw-annotation-update', spy);
    el.end = 9;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(spy).toHaveBeenCalled();
    document.body.removeEventListener('daw-annotation-update', spy);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `daw-annotation.ts`**

```typescript
import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { AnnotationData } from '@waveform-playlist/core';

/**
 * Declarative annotation data element (light DOM). Its `start`/`end`
 * attributes and text content ARE the single source of truth — the editor's
 * annotation lane and <daw-annotation-list> both derive from them.
 */
@customElement('daw-annotation')
export class DawAnnotationElement extends LitElement {
  /** Start time in seconds. Reflected — attribute writes drive both views. */
  @property({ type: Number, noAccessor: true, reflect: true })
  get start(): number {
    return this._start;
  }
  set start(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      console.warn('[dawcore] daw-annotation start ' + String(value) + ' is invalid — ignored');
      return;
    }
    const old = this._start;
    this._start = value;
    this.requestUpdate('start', old);
  }
  private _start = 0;

  /** End time in seconds. Reflected. */
  @property({ type: Number, noAccessor: true, reflect: true })
  get end(): number {
    return this._end;
  }
  set end(value: number) {
    if (!Number.isFinite(value) || value < 0) {
      console.warn('[dawcore] daw-annotation end ' + String(value) + ' is invalid — ignored');
      return;
    }
    const old = this._end;
    this._end = value;
    this.requestUpdate('end', old);
  }
  private _end = 0;

  private readonly _generatedId =
    'annotation-' + crypto.randomUUID();

  /** Stable identity: the id attribute when present, else a generated UUID. */
  get annotationId(): string {
    return this.id || this._generatedId;
  }

  toAnnotationData(): AnnotationData {
    const text = this.textContent?.trim() ?? '';
    return {
      id: this.annotationId,
      start: this.start,
      end: this.end,
      lines: text.length > 0 ? text.split('\n') : [''],
    };
  }

  // Light DOM — data container only.
  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    // Deferred so ancestor listeners (editor / annotation track) register first
    // when parsed all-at-once — same pattern as <daw-clip>.
    setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('daw-annotation-connected', {
          bubbles: true,
          composed: true,
          detail: { annotationId: this.annotationId, element: this },
        })
      );
    }, 0);
  }

  private _hasRendered = false;

  updated(changed: PropertyValues) {
    if (!this._hasRendered) {
      this._hasRendered = true;
      return;
    }
    if (changed.has('start') || changed.has('end')) {
      this.dispatchEvent(
        new CustomEvent('daw-annotation-update', {
          bubbles: true,
          composed: true,
          detail: { annotationId: this.annotationId },
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-annotation': DawAnnotationElement;
  }
}
```

Add to `packages/dawcore/src/events.ts` (imports at top: `import type { AnnotationData } from '@waveform-playlist/core';` — merge with existing core imports if present):

```typescript
export interface DawAnnotationConnectedDetail {
  annotationId: string;
  element: HTMLElement;
}

export interface DawAnnotationUpdateDetail {
  annotationId: string;
}

export interface DawAnnotationSelectDetail {
  annotation: AnnotationData | null;
}

export interface DawAnnotationTrackConnectedDetail {
  element: HTMLElement;
}
```

and add to the `DawEventMap` interface:

```typescript
  'daw-annotation-connected': CustomEvent<DawAnnotationConnectedDetail>;
  'daw-annotation-update': CustomEvent<DawAnnotationUpdateDetail>;
  'daw-annotation-select': CustomEvent<DawAnnotationSelectDetail>;
  'daw-annotation-track-connected': CustomEvent<DawAnnotationTrackConnectedDetail>;
```

Export from `packages/dawcore/src/index.ts` next to the `daw-clip` export lines (match the existing style — element import for registration + type export):

```typescript
export { DawAnnotationElement } from './elements/daw-annotation';
```

(Check how `daw-clip` is exported in `index.ts` and mirror it exactly — if the file uses side-effect imports plus named exports, do both.)

- [ ] **Step 4: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-annotation.ts packages/dawcore/src/events.ts packages/dawcore/src/index.ts packages/dawcore/src/__tests__/daw-annotation.test.ts
git commit -m "feat(dawcore): daw-annotation data element with reflected start/end"
```

---

### Task 6: dawcore — `<daw-annotation-track>` element (selection, navigation, boundary methods, playActive)

Keyboard handling comes in Task 10; this task builds the data element + full programmatic API.

**Files:**
- Create: `packages/dawcore/src/elements/daw-annotation-track.ts`
- Modify: `packages/dawcore/src/index.ts` (export)
- Test: `packages/dawcore/src/__tests__/daw-annotation-track.test.ts`

**Interfaces:**
- Consumes: `DawAnnotationElement.toAnnotationData()` / `.annotationId` (Task 5); `updateAnnotationBoundaries`, `MIN_ANNOTATION_DURATION` from core (Task 2); editor duck-type `{ play(start?, end?), seekTo(t), _duration }` (Task 7 adds `endTime` — this task can consume it because Task 7 runs before integration testing; the property access is structural).
- Produces:
  - `DawAnnotationTrackElement` with reflected booleans `editable`, `linkEndpoints` (`link-endpoints`), `continuousPlay` (`continuous-play`), `keyboardControls` (`keyboard-controls`).
  - `activeAnnotationId: string | null` accessor — validates the id exists among children; dispatches `daw-annotation-select` on every change.
  - `annotationElements: DawAnnotationElement[]` getter (children sorted by `start`), `annotations: AnnotationData[]` getter.
  - Methods: `selectNext()`, `selectPrevious()`, `selectFirst()`, `selectLast()`, `clearSelection()`, `playActive()`, `moveStartBoundary(deltaMs: number)`, `moveEndBoundary(deltaMs: number)`.
  - Event `daw-annotation-track-connected` (deferred, detail `{ element: this }`).
  - Selection cleared automatically when the active `<daw-annotation>` is removed (own MutationObserver on childList).

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import '../elements/daw-annotation-track';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeTrack(): DawAnnotationTrackElement {
  const track = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
  track.innerHTML = `
    <daw-annotation id="a" start="0" end="2">First</daw-annotation>
    <daw-annotation id="b" start="2" end="4">Second</daw-annotation>
    <daw-annotation id="c" start="4" end="6">Third</daw-annotation>
  `;
  document.body.appendChild(track);
  return track;
}

describe('<daw-annotation-track>', () => {
  let track: DawAnnotationTrackElement;

  beforeEach(async () => {
    track = makeTrack();
    await flush();
  });

  afterEach(() => {
    track.remove();
  });

  it('exposes children as sorted AnnotationData', () => {
    expect(track.annotations.map((a) => a.id)).toEqual(['a', 'b', 'c']);
  });

  it('boolean attributes map to properties', () => {
    track.setAttribute('editable', '');
    track.setAttribute('link-endpoints', '');
    expect(track.editable).toBe(true);
    expect(track.linkEndpoints).toBe(true);
    expect(track.continuousPlay).toBe(false);
  });

  it('selectNext wraps and starts from first with no selection', () => {
    track.selectNext();
    expect(track.activeAnnotationId).toBe('a');
    track.selectNext();
    expect(track.activeAnnotationId).toBe('b');
    track.activeAnnotationId = 'c';
    track.selectNext(); // wraps
    expect(track.activeAnnotationId).toBe('a');
  });

  it('selectPrevious with no selection selects last; wraps backward', () => {
    track.selectPrevious();
    expect(track.activeAnnotationId).toBe('c');
    track.selectPrevious();
    expect(track.activeAnnotationId).toBe('b');
  });

  it('selectFirst/selectLast/clearSelection', () => {
    track.selectLast();
    expect(track.activeAnnotationId).toBe('c');
    track.selectFirst();
    expect(track.activeAnnotationId).toBe('a');
    track.clearSelection();
    expect(track.activeAnnotationId).toBeNull();
  });

  it('setting an unknown activeAnnotationId warns and is ignored', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    track.activeAnnotationId = 'nope';
    expect(track.activeAnnotationId).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('dispatches daw-annotation-select on selection change (and null on clear)', () => {
    const events: Array<string | null> = [];
    track.addEventListener('daw-annotation-select', ((e: CustomEvent) =>
      events.push(e.detail.annotation?.id ?? null)) as EventListener);
    track.selectFirst();
    track.clearSelection();
    expect(events).toEqual(['a', null]);
  });

  it('clears selection when the active annotation element is removed', async () => {
    track.activeAnnotationId = 'b';
    track.querySelector('#b')!.remove();
    await flush();
    expect(track.activeAnnotationId).toBeNull();
  });

  it('moveStartBoundary requires editable', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    track.activeAnnotationId = 'b';
    track.moveStartBoundary(100);
    expect(track.annotations[1].start).toBe(2); // unchanged
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('moveStartBoundary applies core boundary math with link-endpoints', () => {
    track.editable = true;
    track.linkEndpoints = true;
    track.activeAnnotationId = 'b';
    track.moveStartBoundary(-500); // b.start 2 → 1.5, linked a.end follows
    expect(track.annotations[1].start).toBeCloseTo(1.5);
    expect(track.annotations[0].end).toBeCloseTo(1.5);
  });

  it('moveEndBoundary moves the active end', () => {
    track.editable = true;
    track.activeAnnotationId = 'c';
    track.moveEndBoundary(250);
    expect(track.annotations[2].end).toBeCloseTo(6.25);
  });

  it('playActive with continuous-play off plays the annotation range on the host editor', () => {
    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    editor.appendChild(track);
    const play = vi.fn();
    (editor as unknown as { play: unknown }).play = play;
    track.activeAnnotationId = 'b';
    track.playActive();
    expect(play).toHaveBeenCalledWith(2, 4);
    track.continuousPlay = true;
    track.playActive();
    expect(play).toHaveBeenCalledWith(2, undefined);
    editor.remove();
  });

  it('playActive without a host editor warns and no-ops', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    track.activeAnnotationId = 'a';
    track.playActive();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('dispatches deferred daw-annotation-track-connected', async () => {
    const spy = vi.fn();
    document.body.addEventListener('daw-annotation-track-connected', spy, { once: true });
    const t2 = document.createElement('daw-annotation-track');
    document.body.appendChild(t2);
    await flush();
    expect(spy).toHaveBeenCalled();
    t2.remove();
  });
});
```

**Test note:** the `daw-editor` element used in the playActive test upgrades to the real editor class (registered by other test files' imports is NOT guaranteed here — this file does not import `daw-editor`, so `createElement('daw-editor')` yields a generic `HTMLElement`, which is fine: `closest('daw-editor')` matches by tag name and the stubbed instance `play` property is all the track touches).

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation-track.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `daw-annotation-track.ts`**

```typescript
import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { updateAnnotationBoundaries } from '@waveform-playlist/core';
import type { AnnotationData } from '@waveform-playlist/core';
import type { DawAnnotationElement } from './daw-annotation';

/** Structural view of the host editor — only what this element touches. */
interface AnnotationHostEditor extends HTMLElement {
  play(startTime?: number, endTime?: number): Promise<void>;
  seekTo(time: number): void;
  _duration: number;
}

/**
 * Declarative annotation track (light DOM). Children are <daw-annotation>
 * elements — their attributes are the single source of truth. This element
 * owns the ephemeral selection state and the programmatic API; the host
 * <daw-editor> renders the timeline lane, <daw-annotation-list> renders the
 * text panel.
 */
@customElement('daw-annotation-track')
export class DawAnnotationTrackElement extends LitElement {
  @property({ type: Boolean, reflect: true }) editable = false;
  @property({ type: Boolean, reflect: true, attribute: 'link-endpoints' }) linkEndpoints = false;
  @property({ type: Boolean, reflect: true, attribute: 'continuous-play' }) continuousPlay = false;
  @property({ type: Boolean, reflect: true, attribute: 'keyboard-controls' })
  keyboardControls = false;

  // --- Selection (ephemeral UI state — deliberately NOT DOM data) ---

  private _activeAnnotationId: string | null = null;

  get activeAnnotationId(): string | null {
    return this._activeAnnotationId;
  }

  set activeAnnotationId(value: string | null) {
    if (value !== null && !this.annotationElements.some((el) => el.annotationId === value)) {
      console.warn(
        '[dawcore] daw-annotation-track: unknown annotation id "' + value + '" — selection ignored'
      );
      return;
    }
    if (value === this._activeAnnotationId) return;
    this._activeAnnotationId = value;
    const active = this._activeElement();
    this.dispatchEvent(
      new CustomEvent('daw-annotation-select', {
        bubbles: true,
        composed: true,
        detail: { annotation: active ? active.toAnnotationData() : null },
      })
    );
  }

  // --- Child access ---

  /** Child annotation elements, sorted by start time. */
  get annotationElements(): DawAnnotationElement[] {
    return Array.from(this.querySelectorAll<DawAnnotationElement>(':scope > daw-annotation')).sort(
      (a, b) => a.start - b.start
    );
  }

  get annotations(): AnnotationData[] {
    return this.annotationElements.map((el) => el.toAnnotationData());
  }

  // --- Navigation methods (spec API) ---

  selectNext(): void {
    this._selectByOffset(1, 0);
  }

  selectPrevious(): void {
    this._selectByOffset(-1, -1);
  }

  selectFirst(): void {
    const list = this.annotationElements;
    if (list.length > 0) this.activeAnnotationId = list[0].annotationId;
  }

  selectLast(): void {
    const list = this.annotationElements;
    if (list.length > 0) this.activeAnnotationId = list[list.length - 1].annotationId;
  }

  clearSelection(): void {
    this.activeAnnotationId = null;
  }

  /** offset: +1 next / -1 previous; noSelectionIndex: 0 → first, -1 → last. */
  private _selectByOffset(offset: number, noSelectionIndex: number): void {
    const list = this.annotationElements;
    if (list.length === 0) return;
    const currentIndex = list.findIndex((el) => el.annotationId === this._activeAnnotationId);
    const nextIndex =
      currentIndex === -1
        ? (noSelectionIndex + list.length) % list.length
        : (currentIndex + offset + list.length) % list.length;
    this.activeAnnotationId = list[nextIndex].annotationId;
  }

  // --- Playback (spec API) ---

  playActive(): void {
    const active = this._activeElement();
    if (!active) return;
    const editor = this._hostEditor();
    if (!editor) {
      console.warn(
        '[dawcore] <daw-annotation-track> playActive: no parent <daw-editor> — call ignored'
      );
      return;
    }
    const data = active.toAnnotationData();
    void editor.play(data.start, this.continuousPlay ? undefined : data.end);
  }

  // --- Boundary editing (spec API) ---

  moveStartBoundary(deltaMs: number): void {
    this._moveBoundary(deltaMs, true);
  }

  moveEndBoundary(deltaMs: number): void {
    this._moveBoundary(deltaMs, false);
  }

  private _moveBoundary(deltaMs: number, isStart: boolean): void {
    if (!this.editable) {
      console.warn(
        '[dawcore] daw-annotation-track: boundary editing requires the editable attribute'
      );
      return;
    }
    const elements = this.annotationElements;
    const index = elements.findIndex((el) => el.annotationId === this._activeAnnotationId);
    if (index === -1) return;
    const data = elements.map((el) => el.toAnnotationData());
    const edge = isStart ? data[index].start : data[index].end;
    const updated = updateAnnotationBoundaries({
      annotationIndex: index,
      newTime: edge + deltaMs / 1000,
      isDraggingStart: isStart,
      annotations: data,
      duration: this._timelineDuration(),
      linkEndpoints: this.linkEndpoints,
    });
    applyBoundaryResults(elements, data, updated);
  }

  private _timelineDuration(): number {
    return this._hostEditor()?._duration ?? Infinity;
  }

  private _activeElement(): DawAnnotationElement | null {
    if (this._activeAnnotationId === null) return null;
    return (
      this.annotationElements.find((el) => el.annotationId === this._activeAnnotationId) ?? null
    );
  }

  private _hostEditor(): AnnotationHostEditor | null {
    return this.closest('daw-editor') as AnnotationHostEditor | null;
  }

  // --- Lifecycle ---

  private _childObserver: MutationObserver | null = null;

  createRenderRoot() {
    return this;
  }

  connectedCallback() {
    super.connectedCallback();
    setTimeout(() => {
      this.dispatchEvent(
        new CustomEvent('daw-annotation-track-connected', {
          bubbles: true,
          composed: true,
          detail: { element: this },
        })
      );
    }, 0);
    // Clear selection when the active annotation element is removed.
    this._childObserver = new MutationObserver(() => {
      if (
        this._activeAnnotationId !== null &&
        !this.annotationElements.some((el) => el.annotationId === this._activeAnnotationId)
      ) {
        this.activeAnnotationId = null;
      }
    });
    this._childObserver.observe(this, { childList: true });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this._childObserver?.disconnect();
    this._childObserver = null;
  }
}

/**
 * Write boundary-math results back to the <daw-annotation> elements —
 * only edges that actually changed, so no spurious daw-annotation-update
 * events fire. Module-level helper (must sit ABOVE @customElement per the
 * dawcore decorator gotcha) — exported for reuse by the drag interaction.
 */
export function applyBoundaryResults(
  elements: DawAnnotationElement[],
  before: AnnotationData[],
  after: AnnotationData[]
): void {
  after.forEach((next, i) => {
    if (next.start !== before[i].start) elements[i].start = next.start;
    if (next.end !== before[i].end) elements[i].end = next.end;
  });
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-annotation-track': DawAnnotationTrackElement;
  }
}
```

**IMPORTANT:** the `applyBoundaryResults` helper must be moved ABOVE the `@customElement` decorator (module-level helpers between the decorator and the class break the decorator target — dawcore CLAUDE.md gotcha). Place it right after the `AnnotationHostEditor` interface.

Export from `packages/dawcore/src/index.ts`:

```typescript
export { DawAnnotationTrackElement } from './elements/daw-annotation-track';
```

- [ ] **Step 4: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation-track.test.ts src/__tests__/daw-annotation.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-annotation-track.ts packages/dawcore/src/index.ts packages/dawcore/src/__tests__/daw-annotation-track.test.ts
git commit -m "feat(dawcore): daw-annotation-track element with selection and boundary API"
```

---

### Task 7: dawcore — `editor.play(startTime?, endTime?)`

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts:2678` (the `play` method)
- Test: `packages/dawcore/src/__tests__/daw-editor-play-endtime.test.ts`

**Interfaces:**
- Consumes: `PlaylistEngine.play(startTime?, endTime?)` (already exists — `packages/engine/src/PlaylistEngine.ts:532`).
- Produces: `editor.play(startTime?: number, endTime?: number)` — additive, backward compatible.

- [ ] **Step 1: Write the failing test**

Copy `makeMockAdapter` from `packages/dawcore/src/__tests__/daw-editor-midi.test.ts` (do not hand-roll a thinner mock — dawcore CLAUDE.md rule). Test skeleton:

```typescript
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../elements/daw-editor';
import type { DawEditorElement } from '../elements/daw-editor';
// … copy makeMockAdapter from daw-editor-midi.test.ts verbatim …

describe('editor.play endTime forwarding', () => {
  let editor: DawEditorElement;

  afterEach(() => {
    editor?.remove();
  });

  it('forwards endTime to the adapter play call', async () => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    document.body.appendChild(editor);
    const adapter = makeMockAdapter();
    editor.adapter = adapter;
    editor.addTrack({ name: 'T', midi: { notes: [] } });
    await editor.ready();
    await editor.play(1, 2);
    expect(adapter.play).toHaveBeenCalledWith(1, 2);
  });
});
```

(Adjust the final assertion to how the mock adapter records play — the engine calls `adapter.play(currentTime, endTime)` after seeking to `startTime`, so the first argument is `1`.)

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-play-endtime.test.ts`
Expected: FAIL — adapter.play called without the `2`.

- [ ] **Step 3: Implement**

In `daw-editor.ts`, change the `play` signature and engine call:

```typescript
  async play(startTime?: number, endTime?: number) {
    try {
      const engine = await this._ensureEngine();
      // Always init — resumes AudioContext if suspended (requires user gesture).
      await engine.init();
      engine.play(startTime, endTime);
```

(everything else in the method unchanged).

- [ ] **Step 4: Run the new test + the existing editor playback tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-play-endtime.test.ts src/__tests__/daw-editor.test.ts src/__tests__/daw-editor-timeupdate.test.ts`
Expected: PASS (no regression from the extra `undefined` arg — if an exact-args `toHaveBeenCalledWith` assertion on `engine.play`/`adapter.play` breaks in existing tests, append `undefined` to those assertions per the dawcore CLAUDE.md optional-trailing-parameter rule).

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/daw-editor-play-endtime.test.ts
git commit -m "feat(dawcore): editor.play accepts optional endTime (engine already supports it)"
```

---

### Task 8: dawcore — `AnnotationController` + editor lane rendering

**Files:**
- Create: `packages/dawcore/src/controllers/annotation-controller.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (controller field, connect listener, render integration, CSS)
- Modify: `packages/dawcore/src/index.ts` (export `ANNOTATION_LANE_HEIGHT`)
- Test: `packages/dawcore/src/__tests__/annotation-controller.test.ts`

**Interfaces:**
- Consumes: `DawAnnotationTrackElement` (Task 6), events from Task 5.
- Produces:
  - `ANNOTATION_LANE_HEIGHT = 32` (exported constant).
  - `class AnnotationController` with: `tracks: DawAnnotationTrackElement[]` (readonly getter), `totalLaneHeight: number`, `boxGeometry(a, spp, sampleRate)`, `renderLanes(spp, sampleRate, onPointerDown?): TemplateResult[]`, `handleTrackConnected(el)` — plus its own MutationObserver for removals. (`spp`/`sampleRate` are passed as arguments — the host interface stays minimal.)
  - `AnnotationControllerHost` interface: `ReactiveControllerHost & HTMLElement & { effectiveSampleRate: number; seekTo(time: number): void }`.
  - Editor renders lanes above track rows; controls column gets spacers; beats grid `top` offset by `totalLaneHeight`.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import '../elements/daw-annotation-track';
import { AnnotationController, ANNOTATION_LANE_HEIGHT } from '../controllers/annotation-controller';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeHost() {
  const host = document.createElement('div') as HTMLElement & {
    effectiveSampleRate: number;
    _renderSpp: number;
    seekTo: ReturnType<typeof vi.fn>;
    addController: ReturnType<typeof vi.fn>;
    removeController: ReturnType<typeof vi.fn>;
    requestUpdate: ReturnType<typeof vi.fn>;
    updateComplete: Promise<boolean>;
  };
  Object.assign(host, {
    effectiveSampleRate: 48000,
    _renderSpp: 1024,
    seekTo: vi.fn(),
    addController: vi.fn(),
    removeController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
  });
  document.body.appendChild(host);
  return host;
}

describe('AnnotationController', () => {
  let host: ReturnType<typeof makeHost>;
  let controller: AnnotationController;
  let track: DawAnnotationTrackElement;

  beforeEach(async () => {
    host = makeHost();
    controller = new AnnotationController(host as never);
    controller.hostConnected();
    track = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track.innerHTML = '<daw-annotation id="a" start="1" end="3">Hi</daw-annotation>';
    host.appendChild(track);
    await flush();
    controller.handleTrackConnected(track);
  });

  afterEach(() => {
    controller.hostDisconnected();
    host.remove();
  });

  it('registers connected tracks and reports lane height', () => {
    expect(controller.tracks).toEqual([track]);
    expect(controller.totalLaneHeight).toBe(ANNOTATION_LANE_HEIGHT);
  });

  it('deduplicates repeat registration of the same track', () => {
    controller.handleTrackConnected(track);
    expect(controller.tracks).toHaveLength(1);
  });

  it('unregisters a track removed from the DOM and requests an update', async () => {
    track.remove();
    await flush();
    expect(controller.tracks).toEqual([]);
    expect(host.requestUpdate).toHaveBeenCalled();
  });

  it('computes box pixel geometry from spp and sample rate', () => {
    // start 1s → 1 * 48000 / 1024 = 46.875 → floor 46
    // end 3s → 140.625 → floor 140; width = 94
    const geo = controller.boxGeometry({ id: 'a', start: 1, end: 3, lines: ['Hi'] }, 1024, 48000);
    expect(geo).toEqual({ left: 46, width: 94 });
  });

  it('requests a host update on daw-annotation-update bubbling through the host', async () => {
    host.requestUpdate.mockClear();
    const el = track.querySelector('daw-annotation')! as HTMLElement & { end: number };
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    el.end = 5;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(host.requestUpdate).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/annotation-controller.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `controllers/annotation-controller.ts`**

```typescript
import { html } from 'lit';
import type { ReactiveController, ReactiveControllerHost, TemplateResult } from 'lit';
import type { AnnotationData } from '@waveform-playlist/core';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';

/**
 * Fixed lane height. A TS constant (not a CSS var) because the frozen-panes
 * controls-column spacer and the beats-grid top offset need it in layout math.
 */
export const ANNOTATION_LANE_HEIGHT = 32;

export interface AnnotationControllerHost extends ReactiveControllerHost, HTMLElement {
  effectiveSampleRate: number;
  seekTo(time: number): void;
}

/**
 * Registers <daw-annotation-track> light-DOM children and renders their
 * timeline lanes inside the editor's shadow DOM. Rendering only — drag
 * interactions live in interactions/annotation-drag.ts.
 */
export class AnnotationController implements ReactiveController {
  private _host: AnnotationControllerHost;
  private _tracks: DawAnnotationTrackElement[] = [];
  private _removalObserver: MutationObserver | null = null;

  constructor(host: AnnotationControllerHost) {
    this._host = host;
    host.addController(this);
  }

  get tracks(): readonly DawAnnotationTrackElement[] {
    return this._tracks;
  }

  get totalLaneHeight(): number {
    return this._tracks.length * ANNOTATION_LANE_HEIGHT;
  }

  hostConnected(): void {
    this._host.addEventListener('daw-annotation-update', this._onDataChange);
    this._host.addEventListener('daw-annotation-select', this._onDataChange);
    this._host.addEventListener('daw-annotation-connected', this._onDataChange);
    // Removals can't bubble — observe childList like the editor's track observer.
    this._removalObserver = new MutationObserver((mutations) => {
      let changed = false;
      for (const m of mutations) {
        for (const node of Array.from(m.removedNodes)) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.tagName === 'DAW-ANNOTATION-TRACK') {
            this._tracks = this._tracks.filter((t) => t !== node);
            changed = true;
          } else if (node.tagName === 'DAW-ANNOTATION') {
            changed = true;
          }
        }
      }
      if (changed) this._host.requestUpdate();
    });
    this._removalObserver.observe(this._host, { childList: true, subtree: true });
  }

  hostDisconnected(): void {
    this._host.removeEventListener('daw-annotation-update', this._onDataChange);
    this._host.removeEventListener('daw-annotation-select', this._onDataChange);
    this._host.removeEventListener('daw-annotation-connected', this._onDataChange);
    this._removalObserver?.disconnect();
    this._removalObserver = null;
    this._tracks = [];
  }

  private _onDataChange = (): void => {
    this._host.requestUpdate();
  };

  handleTrackConnected(el: DawAnnotationTrackElement): void {
    if (this._tracks.includes(el)) return;
    this._tracks = [...this._tracks, el];
    this._host.requestUpdate();
  }

  /** Pixel geometry for one annotation box. Floor-based like clip positioning. */
  boxGeometry(
    a: AnnotationData,
    spp: number,
    sampleRate: number
  ): { left: number; width: number } {
    const left = Math.floor((a.start * sampleRate) / spp);
    const width = Math.floor((a.end * sampleRate) / spp) - left;
    return { left, width };
  }

  /**
   * Lane templates for the editor's .timeline. onPointerDown is supplied by
   * the editor and dispatches into the drag interaction (Task 9).
   */
  renderLanes(
    spp: number,
    sampleRate: number,
    onPointerDown: (e: PointerEvent, track: DawAnnotationTrackElement) => void = () => {}
  ): TemplateResult[] {
    return this._tracks.map((track) => {
      const activeId = track.activeAnnotationId;
      return html`
        <div
          class="annotation-lane"
          style="height: ${ANNOTATION_LANE_HEIGHT}px;"
          @pointerdown=${(e: PointerEvent) => onPointerDown(e, track)}
        >
          ${track.annotations.map((a) => {
            const geo = this.boxGeometry(a, spp, sampleRate);
            return html`
              <div
                class="annotation-box ${a.id === activeId ? 'active' : ''}"
                data-annotation-id=${a.id}
                style="left: ${geo.left}px; width: ${geo.width}px;"
              >
                ${track.editable
                  ? html`<div class="annotation-boundary" data-edge="start"></div>`
                  : ''}
                <span class="annotation-box-text">${a.lines.join(' ')}</span>
                ${track.editable
                  ? html`<div class="annotation-boundary" data-edge="end"></div>`
                  : ''}
              </div>
            `;
          })}
        </div>
      `;
    });
  }
}
```

- [ ] **Step 4: Wire into `daw-editor.ts`**

1. Imports:

```typescript
import { AnnotationController, ANNOTATION_LANE_HEIGHT } from '../controllers/annotation-controller';
import type { DawAnnotationTrackElement } from './daw-annotation-track';
```

2. Field (next to `_recordingController`, ~line 699):

```typescript
  private _annotations = new AnnotationController(this);
```

3. In `connectedCallback` (next to the `daw-track-connected` listener registration, ~line 955):

```typescript
    this.addEventListener(
      'daw-annotation-track-connected',
      this._onAnnotationTrackConnected as EventListener
    );
```

and the symmetric `removeEventListener` in `disconnectedCallback` (~line 993). Handler (place near `_onTrackConnected`):

```typescript
  private _onAnnotationTrackConnected = (e: CustomEvent<{ element: HTMLElement }>) => {
    this._annotations.handleTrackConnected(e.detail.element as DawAnnotationTrackElement);
  };
```

4. Render integration in `render()` (~line 3204): annotation lanes render inside `.timeline`, BEFORE the beats-grid/selection/playhead block; the beats grid `top` offset changes from `0px` to the lane total:

```typescript
            ${this._annotations.renderLanes(spp, this.effectiveSampleRate)}
            ${this.scaleMode === 'beats'
              ? html`<daw-grid
                  style="top: ${this._annotations.totalLaneHeight}px;"
```

(Task 9 threads the pointer callback as the third `renderLanes` argument.) The lanes must be in normal flow (position: relative, not absolute) so track rows stack below them.

5. Controls-column spacers — in the `showControls` branch, before `orderedTracks.map`:

```typescript
                ${this._annotations.tracks.map(
                  () =>
                    html`<div
                      class="annotation-lane-spacer"
                      style="height: ${ANNOTATION_LANE_HEIGHT}px;"
                    ></div>`
                )}
```

6. CSS — append to the editor's `static styles`:

```css
    .annotation-lane {
      position: relative;
      box-sizing: border-box;
      border-bottom: 1px solid var(--daw-annotation-lane-border, rgba(255, 255, 255, 0.08));
      background: var(--daw-annotation-lane-background, rgba(0, 0, 0, 0.15));
      user-select: none;
      -webkit-user-drag: none;
    }
    .annotation-lane-spacer {
      box-sizing: border-box;
      border-bottom: 1px solid var(--daw-annotation-lane-border, rgba(255, 255, 255, 0.08));
    }
    .annotation-box {
      position: absolute;
      top: 3px;
      bottom: 3px;
      overflow: hidden;
      display: flex;
      align-items: center;
      border: 1px solid var(--daw-annotation-box-border, #c49a6c);
      border-radius: 3px;
      background: var(--daw-annotation-box-background, rgba(196, 154, 108, 0.2));
      color: var(--daw-annotation-text-color, #e0d4c8);
      font-size: 11px;
      cursor: pointer;
    }
    .annotation-box.active {
      background: var(--daw-annotation-active-background, rgba(196, 154, 108, 0.45));
    }
    .annotation-box-text {
      padding: 0 6px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      pointer-events: none;
    }
    .annotation-boundary {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 6px;
      cursor: ew-resize;
      flex-shrink: 0;
    }
    .annotation-boundary[data-edge='start'] {
      left: 0;
    }
    .annotation-boundary[data-edge='end'] {
      right: 0;
    }
```

**Note:** if `daw-editor.ts` defines its CSS via `styles/theme.ts` shared blocks, put the lane CSS in the editor's own `static styles` (it is editor-shadow-DOM-only, like the beats-mode clip backgrounds rule).

7. Export the constant from `packages/dawcore/src/index.ts`:

```typescript
export { ANNOTATION_LANE_HEIGHT } from './controllers/annotation-controller';
```

8. Lane auto-scroll — the spec requires "auto-scrolls to center the active annotation on keyboard selection change" for the LANE as well as the list. In `daw-editor.ts`, register alongside the annotation-track-connected listener:

```typescript
    this.addEventListener('daw-annotation-select', this._onAnnotationSelect as EventListener);
```

(+ symmetric remove in `disconnectedCallback`), with the handler:

```typescript
  private _onAnnotationSelect = (e: CustomEvent<{ annotation: { start: number } | null }>) => {
    const annotation = e.detail.annotation;
    if (!annotation) return;
    const scrollArea = this.shadowRoot?.querySelector('.scroll-area') as HTMLElement | null;
    if (!scrollArea) return;
    const px = Math.floor((annotation.start * this.effectiveSampleRate) / this._renderSpp);
    scrollArea.scrollLeft = Math.max(0, px - scrollArea.clientWidth / 2);
  };
```

happy-dom has no layout (`clientWidth` 0, unclamped `scrollLeft`) — do not unit-test the centering math beyond "scrollLeft was assigned"; verify visually in Task 12.

- [ ] **Step 5: Integration test — lanes render inside the editor** (append to `annotation-controller.test.ts` or a new `daw-editor-annotations.test.ts` — prefer the latter, copying `makeEditor()` from `daw-editor-layout.test.ts` which uses `editor.addTrack({ name, midi: { notes } })` for fetch-free loaded tracks):

```typescript
import { describe, it, expect, afterEach } from 'vitest';
import '../index'; // registers all elements
// … copy makeEditor()/makeMockAdapter from daw-editor-layout.test.ts …

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('<daw-editor> annotation lanes', () => {
  it('renders a lane with positioned boxes for a declarative annotation track', async () => {
    const editor = await makeEditor(); // loaded editor with ≥1 track
    editor.innerHTML +=
      '<daw-annotation-track id="lyrics">' +
      '<daw-annotation id="a" start="1" end="3">Hello</daw-annotation>' +
      '</daw-annotation-track>';
    await flush();
    await editor.updateComplete;
    const lane = editor.shadowRoot!.querySelector('.annotation-lane');
    expect(lane).toBeTruthy();
    const box = editor.shadowRoot!.querySelector('.annotation-box') as HTMLElement;
    expect(box).toBeTruthy();
    expect(box.getAttribute('data-annotation-id')).toBe('a');
    expect(box.style.left).toBe(Math.floor((1 * editor.effectiveSampleRate) / 1024) + 'px');
    editor.remove();
  });

  it('removing the annotation track removes the lane', async () => {
    const editor = await makeEditor();
    editor.innerHTML +=
      '<daw-annotation-track><daw-annotation start="0" end="1">x</daw-annotation></daw-annotation-track>';
    await flush();
    await editor.updateComplete;
    editor.querySelector('daw-annotation-track')!.remove();
    await flush();
    await editor.updateComplete;
    expect(editor.shadowRoot!.querySelector('.annotation-lane')).toBeNull();
    editor.remove();
  });
});
```

Run: `cd packages/dawcore && npx vitest run src/__tests__/annotation-controller.test.ts src/__tests__/daw-editor-annotations.test.ts`
Expected: PASS. Also run `src/__tests__/daw-editor-layout.test.ts` to confirm no layout regression.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/controllers/annotation-controller.ts packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/index.ts packages/dawcore/src/__tests__/annotation-controller.test.ts packages/dawcore/src/__tests__/daw-editor-annotations.test.ts
git commit -m "feat(dawcore): annotation lane rendering in daw-editor via AnnotationController"
```

---

### Task 9: dawcore — lane drag interaction + click-to-seek

**Files:**
- Create: `packages/dawcore/src/interactions/annotation-drag.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (instantiate handler, thread callback into `renderLanes`)
- Test: `packages/dawcore/src/__tests__/annotation-drag.test.ts`

**Interfaces:**
- Consumes: `updateAnnotationBoundaries` (core), `applyBoundaryResults` + `DawAnnotationTrackElement` (Task 6), `AnnotationController.boxGeometry` semantics (px = seconds × sampleRate / spp).
- Produces:
  - `interface AnnotationDragHost { effectiveSampleRate: number; _renderSpp: number; _duration: number; seekTo(time: number): void; }`
  - `class AnnotationDragHandler { constructor(host: AnnotationDragHost); onPointerDown(e: PointerEvent, track: DawAnnotationTrackElement): void; }`
  - Behavior: pointerdown on `.annotation-boundary` → drag edits boundaries live (per-move write-through via core math); pointerdown on `.annotation-box` + release under 3px → select + seek; `pointercancel` restores the drag-start snapshot; all consumed events `stopPropagation()` so the timeline seek handler doesn't fire.

- [ ] **Step 1: Write the failing tests** (unit-level with fabricated event objects — happy-dom can't drive real pointer capture; same approach as `clip-pointer-handler.test.ts`. Read that file first and mirror its fabricated-event style.)

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import '../elements/daw-annotation-track';
import { AnnotationDragHandler } from '../interactions/annotation-drag';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';

const flush = () => new Promise((r) => setTimeout(r, 0));

function makeHost() {
  return {
    effectiveSampleRate: 48000,
    _renderSpp: 480, // 100px per second — round numbers for assertions
    _duration: 100,
    seekTo: vi.fn(),
  };
}

/** Build a fake PointerEvent targeting an element. */
function fakePointer(
  target: HTMLElement,
  clientX: number,
  overrides: Partial<PointerEvent> = {}
): PointerEvent {
  return {
    target,
    clientX,
    pointerId: 1,
    button: 0,
    stopPropagation: vi.fn(),
    preventDefault: vi.fn(),
    ...overrides,
  } as unknown as PointerEvent;
}

describe('AnnotationDragHandler', () => {
  let host: ReturnType<typeof makeHost>;
  let handler: AnnotationDragHandler;
  let track: DawAnnotationTrackElement;
  let lane: HTMLElement;

  beforeEach(async () => {
    host = makeHost();
    handler = new AnnotationDragHandler(host);
    track = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track.editable = true;
    track.innerHTML =
      '<daw-annotation id="a" start="1" end="3">A</daw-annotation>' +
      '<daw-annotation id="b" start="3" end="5">B</daw-annotation>';
    document.body.appendChild(track);
    await flush();
    // Fake lane DOM as the editor would render it (only structure the handler reads).
    lane = document.createElement('div');
    lane.className = 'annotation-lane';
    lane.innerHTML =
      '<div class="annotation-box" data-annotation-id="a">' +
      '<div class="annotation-boundary" data-edge="end"></div>' +
      '</div>';
    document.body.appendChild(lane);
    // happy-dom has no layout — stub capture APIs the handler calls.
    const boundary = lane.querySelector('.annotation-boundary') as HTMLElement;
    boundary.setPointerCapture = vi.fn();
    boundary.releasePointerCapture = vi.fn();
    const box = lane.querySelector('.annotation-box') as HTMLElement;
    box.setPointerCapture = vi.fn();
    box.releasePointerCapture = vi.fn();
  });

  afterEach(() => {
    track.remove();
    lane.remove();
  });

  it('boundary drag updates the annotation end through core math (write-through)', () => {
    const boundary = lane.querySelector('.annotation-boundary') as HTMLElement;
    const down = fakePointer(boundary, 300); // at end=3s (100px/s)
    handler.onPointerDown(down, track);
    expect(down.stopPropagation).toHaveBeenCalled();
    handler._onPointerMove(fakePointer(boundary, 350)); // +0.5s
    expect(track.annotations[0].end).toBeCloseTo(3.5);
    handler._onPointerUp(fakePointer(boundary, 350));
    expect(track.annotations[0].end).toBeCloseTo(3.5);
  });

  it('pointercancel restores the drag-start snapshot', () => {
    const boundary = lane.querySelector('.annotation-boundary') as HTMLElement;
    handler.onPointerDown(fakePointer(boundary, 300), track);
    handler._onPointerMove(fakePointer(boundary, 380));
    expect(track.annotations[0].end).toBeCloseTo(3.8);
    handler._onPointerCancel(fakePointer(boundary, 380));
    expect(track.annotations[0].end).toBeCloseTo(3); // restored
  });

  it('box click (under drag threshold) selects and seeks', () => {
    const box = lane.querySelector('.annotation-box') as HTMLElement;
    handler.onPointerDown(fakePointer(box, 150), track);
    handler._onPointerUp(fakePointer(box, 151)); // 1px — a click
    expect(track.activeAnnotationId).toBe('a');
    expect(host.seekTo).toHaveBeenCalledWith(1); // annotation start
  });

  it('boundary drag on a non-editable track is ignored', () => {
    track.editable = false;
    const boundary = lane.querySelector('.annotation-boundary') as HTMLElement;
    const down = fakePointer(boundary, 300);
    handler.onPointerDown(down, track);
    handler._onPointerMove(fakePointer(boundary, 380));
    expect(track.annotations[0].end).toBe(3);
  });

  it('pointerdown on empty lane space is NOT consumed (falls through to timeline seek)', () => {
    const down = fakePointer(lane, 500);
    handler.onPointerDown(down, track);
    expect(down.stopPropagation).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/annotation-drag.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `interactions/annotation-drag.ts`**

```typescript
import { updateAnnotationBoundaries } from '@waveform-playlist/core';
import type { AnnotationData } from '@waveform-playlist/core';
import {
  applyBoundaryResults,
  type DawAnnotationTrackElement,
} from '../elements/daw-annotation-track';
import { DRAG_THRESHOLD } from './constants';

export interface AnnotationDragHost {
  effectiveSampleRate: number;
  _renderSpp: number;
  _duration: number;
  seekTo(time: number): void;
}

interface DragState {
  track: DawAnnotationTrackElement;
  captureEl: HTMLElement;
  pointerId: number;
  startClientX: number;
  moved: boolean;
  /** Boundary drag only (null = box click candidate). */
  edge: 'start' | 'end' | null;
  annotationId: string;
  /** Snapshot at drag start — pointercancel restores it. */
  snapshot: AnnotationData[];
  /** Edge time at drag start (boundary drags). */
  edgeTime: number;
}

/**
 * Pointer interaction for annotation lanes: boundary drag (write-through via
 * core boundary math), box click-to-select+seek, cancel-restores-snapshot.
 * Wired by <daw-editor> as the renderLanes pointerdown callback.
 */
export class AnnotationDragHandler {
  private _host: AnnotationDragHost;
  private _drag: DragState | null = null;

  constructor(host: AnnotationDragHost) {
    this._host = host;
  }

  onPointerDown = (e: PointerEvent, track: DawAnnotationTrackElement): void => {
    const target = e.target as HTMLElement;
    const boundary = target.closest('.annotation-boundary') as HTMLElement | null;
    const box = target.closest('.annotation-box') as HTMLElement | null;
    if (!box) return; // empty lane space — fall through to timeline seek

    const annotationId = box.getAttribute('data-annotation-id') ?? '';
    const isBoundary = boundary !== null && track.editable;
    if (boundary !== null && !track.editable) {
      // Boundary handles are only rendered when editable, but guard anyway.
      return;
    }

    e.stopPropagation();
    e.preventDefault();

    const snapshot = track.annotations;
    const index = snapshot.findIndex((a) => a.id === annotationId);
    if (index === -1) return;

    const edge = isBoundary ? (boundary.getAttribute('data-edge') as 'start' | 'end') : null;
    const captureEl = isBoundary ? boundary : box;

    this._drag = {
      track,
      captureEl,
      pointerId: e.pointerId,
      startClientX: e.clientX,
      moved: false,
      edge,
      annotationId,
      snapshot,
      edgeTime: edge === 'start' ? snapshot[index].start : snapshot[index].end,
    };

    try {
      captureEl.setPointerCapture(e.pointerId);
    } catch {
      // Fabricated pointerIds (tests) or detached elements — capture is best-effort.
    }
    captureEl.addEventListener('pointermove', this._onPointerMove as EventListener);
    captureEl.addEventListener('pointerup', this._onPointerUp as EventListener);
    captureEl.addEventListener('pointercancel', this._onPointerCancel as EventListener);
  };

  /** Non-private (underscore convention) so tests can drive moves directly. */
  _onPointerMove = (e: PointerEvent): void => {
    const drag = this._drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    const deltaPx = e.clientX - drag.startClientX;
    if (Math.abs(deltaPx) >= DRAG_THRESHOLD) drag.moved = true;
    if (drag.edge === null || !drag.moved) return;

    const deltaSeconds = (deltaPx * this._host._renderSpp) / this._host.effectiveSampleRate;
    const elements = drag.track.annotationElements;
    const index = drag.snapshot.findIndex((a) => a.id === drag.annotationId);
    if (index === -1) return;
    // Compute from the drag-start snapshot each move — cumulative deltas
    // against live state would compound the link/collision adjustments.
    const updated = updateAnnotationBoundaries({
      annotationIndex: index,
      newTime: drag.edgeTime + deltaSeconds,
      isDraggingStart: drag.edge === 'start',
      annotations: drag.snapshot,
      duration: this._host._duration,
      linkEndpoints: drag.track.linkEndpoints,
    });
    applyBoundaryResults(elements, elements.map((el) => el.toAnnotationData()), updated);
  };

  _onPointerUp = (e: PointerEvent): void => {
    const drag = this._drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    if (!drag.moved && drag.edge === null) {
      // Click: select + seek to the annotation start.
      const data = drag.track.annotations.find((a) => a.id === drag.annotationId);
      if (data) {
        drag.track.activeAnnotationId = drag.annotationId;
        this._host.seekTo(data.start);
      }
    }
    this._teardown();
  };

  _onPointerCancel = (e: PointerEvent): void => {
    const drag = this._drag;
    if (!drag || e.pointerId !== drag.pointerId) return;
    // Restore the drag-start snapshot — a cancelled drag must not commit.
    const elements = drag.track.annotationElements;
    applyBoundaryResults(elements, elements.map((el) => el.toAnnotationData()), drag.snapshot);
    this._teardown();
  };

  private _teardown(): void {
    const drag = this._drag;
    if (!drag) return;
    try {
      drag.captureEl.releasePointerCapture(drag.pointerId);
    } catch {
      // Already released or never captured.
    }
    drag.captureEl.removeEventListener('pointermove', this._onPointerMove as EventListener);
    drag.captureEl.removeEventListener('pointerup', this._onPointerUp as EventListener);
    drag.captureEl.removeEventListener('pointercancel', this._onPointerCancel as EventListener);
    this._drag = null;
  }
}
```

**Snapshot-index note:** `applyBoundaryResults(elements, currentData, updated)` writes any edge that differs from the CURRENT element state; sorting is stable while a drag is in progress only if starts don't cross. `annotationElements` re-sorts by start on every access — during a linked drag, ordering is preserved by the boundary math's constraints (a start can't cross its own end; collisions snap). Keep `drag.snapshot` as the geometry baseline and the live `elements` as the write target.

- [ ] **Step 4: Wire into `daw-editor.ts`**

Field (next to `_clipPointer`):

```typescript
  private _annotationDrag = new AnnotationDragHandler(this);
```

(the editor already satisfies `AnnotationDragHost` structurally: `effectiveSampleRate`, `_renderSpp`, `_duration`, `seekTo`). Thread the callback in `render()`:

```typescript
            ${this._annotations.renderLanes(
              spp,
              this.effectiveSampleRate,
              this._annotationDrag.onPointerDown
            )}
```

- [ ] **Step 5: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/annotation-drag.test.ts src/__tests__/daw-editor-annotations.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/interactions/annotation-drag.ts packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/annotation-drag.test.ts
git commit -m "feat(dawcore): annotation boundary drag and click-to-seek in the editor lane"
```

---

### Task 10: dawcore — keyboard controls on `<daw-annotation-track>`

**Files:**
- Modify: `packages/dawcore/src/elements/daw-annotation-track.ts`
- Test: `packages/dawcore/src/__tests__/daw-annotation-track-keyboard.test.ts`

**Interfaces:**
- Consumes: `resolveAnnotationShortcuts`, `matchesKeyBinding`, `AnnotationShortcutMap`, `AnnotationShortcutAction` from core (Tasks 1/3).
- Produces: `annotationShortcuts: AnnotationShortcutMap | null` accessor (cache-invalidating, upgrade-dance); capture-phase document keydown handling with the spec's priority + Escape two-press semantics.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import '../elements/daw-annotation-track';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';

const flush = () => new Promise((r) => setTimeout(r, 0));

const key = (k: string, init: KeyboardEventInit = {}) =>
  new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init });

describe('<daw-annotation-track> keyboard controls', () => {
  let track: DawAnnotationTrackElement;

  beforeEach(async () => {
    track = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track.keyboardControls = true;
    track.innerHTML =
      '<daw-annotation id="a" start="0" end="2">A</daw-annotation>' +
      '<daw-annotation id="b" start="2" end="4">B</daw-annotation>';
    document.body.appendChild(track);
    await flush();
  });

  afterEach(() => {
    track.remove();
  });

  it('ArrowDown with no selection selects the first annotation', () => {
    document.body.dispatchEvent(key('ArrowDown'));
    expect(track.activeAnnotationId).toBe('a');
  });

  it('navigation and consumption: matched keys stopPropagation before bubble listeners', () => {
    track.activeAnnotationId = 'a';
    const bubbleSpy = vi.fn();
    document.addEventListener('keydown', bubbleSpy); // bubble phase, like <daw-keyboard-shortcuts>
    document.body.dispatchEvent(key('ArrowDown'));
    expect(track.activeAnnotationId).toBe('b');
    expect(bubbleSpy).not.toHaveBeenCalled(); // consumed in capture phase
    document.removeEventListener('keydown', bubbleSpy);
  });

  it('Escape with a selection clears it and is consumed', () => {
    track.activeAnnotationId = 'a';
    const bubbleSpy = vi.fn();
    document.addEventListener('keydown', bubbleSpy);
    document.body.dispatchEvent(key('Escape'));
    expect(track.activeAnnotationId).toBeNull();
    expect(bubbleSpy).not.toHaveBeenCalled();
    document.removeEventListener('keydown', bubbleSpy);
  });

  it('Escape with NO selection falls through (two-press rule)', () => {
    const bubbleSpy = vi.fn();
    document.addEventListener('keydown', bubbleSpy);
    document.body.dispatchEvent(key('Escape'));
    expect(bubbleSpy).toHaveBeenCalled(); // NOT consumed
    document.removeEventListener('keydown', bubbleSpy);
  });

  it('boundary keys require editable (not consumed without it)', () => {
    track.activeAnnotationId = 'b';
    const bubbleSpy = vi.fn();
    document.addEventListener('keydown', bubbleSpy);
    document.body.dispatchEvent(key(']'));
    expect(track.annotations[1].start).toBe(2);
    expect(bubbleSpy).toHaveBeenCalled();
    document.removeEventListener('keydown', bubbleSpy);
  });

  it('boundary keys nudge ±10ms when editable', () => {
    track.editable = true;
    track.activeAnnotationId = 'b';
    document.body.dispatchEvent(key(']'));
    expect(track.annotations[1].start).toBeCloseTo(2.01);
    document.body.dispatchEvent(key('['));
    expect(track.annotations[1].start).toBeCloseTo(2.0);
  });

  it('Enter plays the active annotation', () => {
    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    editor.appendChild(track);
    const play = vi.fn();
    (editor as unknown as { play: unknown }).play = play;
    track.activeAnnotationId = 'a';
    document.body.dispatchEvent(key('Enter'));
    expect(play).toHaveBeenCalledWith(0, 2);
    editor.remove();
  });

  it('ignores key repeat and contentEditable targets', () => {
    document.body.dispatchEvent(key('ArrowDown', { repeat: true }));
    expect(track.activeAnnotationId).toBeNull();
    const editable = document.createElement('div');
    Object.defineProperty(editable, 'isContentEditable', { get: () => true });
    document.body.appendChild(editable);
    editable.dispatchEvent(key('ArrowDown'));
    expect(track.activeAnnotationId).toBeNull();
    editable.remove();
  });

  it('does nothing when keyboard-controls is off', () => {
    track.keyboardControls = false;
    document.body.dispatchEvent(key('ArrowDown'));
    expect(track.activeAnnotationId).toBeNull();
  });

  it('remapping via annotationShortcuts replaces defaults for that action only', () => {
    track.annotationShortcuts = { selectNext: { key: 'j' } };
    document.body.dispatchEvent(key('ArrowDown')); // no longer bound
    expect(track.activeAnnotationId).toBeNull();
    document.body.dispatchEvent(key('j'));
    expect(track.activeAnnotationId).toBe('a');
    document.body.dispatchEvent(key('ArrowUp')); // selectPrevious untouched
    expect(track.activeAnnotationId).toBe('b'); // wrapped backward from 'a'
    track.annotationShortcuts = null; // reset to defaults
    document.body.dispatchEvent(key('ArrowDown'));
    expect(track.activeAnnotationId).toBe('a');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation-track-keyboard.test.ts`
Expected: FAIL — `annotationShortcuts` undefined / keys not handled.

- [ ] **Step 3: Implement in `daw-annotation-track.ts`**

Add imports:

```typescript
import { resolveAnnotationShortcuts, matchesKeyBinding } from '@waveform-playlist/core';
import type { AnnotationShortcutMap, AnnotationShortcutAction, KeyBinding } from '@waveform-playlist/core';
```

Add to the class:

```typescript
  // --- Keyboard remapping (accessor pair: cache invalidation on set) ---

  private _annotationShortcuts: AnnotationShortcutMap | null = null;
  private _resolvedShortcuts: Array<{ action: AnnotationShortcutAction; binding: KeyBinding }> | null =
    null;

  get annotationShortcuts(): AnnotationShortcutMap | null {
    return this._annotationShortcuts;
  }
  set annotationShortcuts(value: AnnotationShortcutMap | null) {
    this._annotationShortcuts = value;
    this._resolvedShortcuts = null;
  }

  private _shortcutEntries(): Array<{ action: AnnotationShortcutAction; binding: KeyBinding }> {
    if (!this._resolvedShortcuts) {
      this._resolvedShortcuts = resolveAnnotationShortcuts(this._annotationShortcuts);
    }
    return this._resolvedShortcuts;
  }

  private static readonly _boundaryActions: ReadonlySet<AnnotationShortcutAction> = new Set([
    'moveStartEarlier',
    'moveStartLater',
    'moveEndEarlier',
    'moveEndLater',
  ]);

  // Capture phase: runs before <daw-keyboard-shortcuts>' bubble-phase listener,
  // giving annotation shortcuts deterministic priority (spec rule).
  private _onKeyDownCapture = (e: KeyboardEvent): void => {
    if (!this.keyboardControls) return;
    if (e.repeat) return;
    const target = e.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
      return;
    }
    const match = this._shortcutEntries().find((entry) => matchesKeyBinding(e, entry.binding));
    if (!match) return;

    const hasSelection = this._activeAnnotationId !== null;
    // Escape with no selection falls through so a second press reaches the
    // editor's stop shortcut (spec two-press rule).
    if (match.action === 'clearSelection' && !hasSelection) return;
    // Boundary editing requires editable + a selection; don't eat keys otherwise.
    if (DawAnnotationTrackElement._boundaryActions.has(match.action)) {
      if (!this.editable || !hasSelection) return;
    }
    if (match.action === 'playActive' && !hasSelection) return;

    e.preventDefault();
    e.stopPropagation();
    this._runShortcutAction(match.action);
  };

  private _runShortcutAction(action: AnnotationShortcutAction): void {
    switch (action) {
      case 'selectPrevious':
        this.selectPrevious();
        break;
      case 'selectNext':
        this.selectNext();
        break;
      case 'selectFirst':
        this.selectFirst();
        break;
      case 'selectLast':
        this.selectLast();
        break;
      case 'clearSelection':
        this.clearSelection();
        break;
      case 'moveStartEarlier':
        this.moveStartBoundary(-10);
        break;
      case 'moveStartLater':
        this.moveStartBoundary(10);
        break;
      case 'moveEndEarlier':
        this.moveEndBoundary(-10);
        break;
      case 'moveEndLater':
        this.moveEndBoundary(10);
        break;
      case 'playActive':
        this.playActive();
        break;
    }
  }
```

In `connectedCallback`, add the upgrade-property dance (before anything else) and the capture listener:

```typescript
    // Upgrade-property dance: a remap assigned before element definition
    // created an own property shadowing the accessor — re-route it.
    if (Object.prototype.hasOwnProperty.call(this, 'annotationShortcuts')) {
      const value = (this as Record<string, unknown>)['annotationShortcuts'];
      delete (this as Record<string, unknown>)['annotationShortcuts'];
      this.annotationShortcuts = value as AnnotationShortcutMap | null;
    }
    document.addEventListener('keydown', this._onKeyDownCapture, true); // capture phase
```

In `disconnectedCallback`:

```typescript
    document.removeEventListener('keydown', this._onKeyDownCapture, true);
```

(The third argument must match `true` for removal to work.)

- [ ] **Step 4: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation-track-keyboard.test.ts src/__tests__/daw-annotation-track.test.ts src/__tests__/daw-keyboard-shortcuts.test.ts`
Expected: PASS (including no regression in the editor-level shortcuts suite).

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-annotation-track.ts packages/dawcore/src/__tests__/daw-annotation-track-keyboard.test.ts
git commit -m "feat(dawcore): capture-phase annotation keyboard controls with remapping"
```

---

### Task 11: dawcore — `<daw-annotation-list>`

**Files:**
- Create: `packages/dawcore/src/elements/daw-annotation-list.ts`
- Modify: `packages/dawcore/src/index.ts` (export)
- Test: `packages/dawcore/src/__tests__/daw-annotation-list.test.ts`

**Interfaces:**
- Consumes: `DawAnnotationTrackElement` (Task 6), `DawAnnotationElement` (Task 5), `daw-annotation-select` event.
- Produces: `DawAnnotationListElement` — `for` attribute; shadow-DOM scrollable list; click row = select + seek; contenteditable text (when track `editable`) committing to `<daw-annotation>` textContent on blur/Enter, Escape cancels; auto-scroll to active row; re-render suppressed while a row is being edited.

- [ ] **Step 1: Write the failing tests**

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../elements/daw-annotation';
import '../elements/daw-annotation-track';
import '../elements/daw-annotation-list';
import type { DawAnnotationTrackElement } from '../elements/daw-annotation-track';
import type { DawAnnotationListElement } from '../elements/daw-annotation-list';

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('<daw-annotation-list>', () => {
  let track: DawAnnotationTrackElement;
  let list: DawAnnotationListElement;

  beforeEach(async () => {
    track = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track.id = 'lyrics';
    track.innerHTML =
      '<daw-annotation id="a" start="0" end="2.5">First line</daw-annotation>' +
      '<daw-annotation id="b" start="2.5" end="5">Second line</daw-annotation>';
    document.body.appendChild(track);
    list = document.createElement('daw-annotation-list') as DawAnnotationListElement;
    list.setAttribute('for', 'lyrics');
    document.body.appendChild(list);
    await flush();
    await list.updateComplete;
  });

  afterEach(() => {
    track.remove();
    list.remove();
  });

  it('renders one row per annotation with text and times', () => {
    const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain('First line');
    expect(rows[0].textContent).toContain('0:00');
  });

  it('re-renders when an annotation attribute changes (dual-view sync)', async () => {
    const el = track.querySelector('#b') as HTMLElement & { end: number };
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    el.end = 9;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    await flush();
    await list.updateComplete;
    const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
    expect(rows[1].textContent).toContain('0:09');
  });

  it('re-renders when an annotation is added or removed', async () => {
    track.insertAdjacentHTML(
      'beforeend',
      '<daw-annotation id="c" start="5" end="7">Third</daw-annotation>'
    );
    await flush();
    await list.updateComplete;
    expect(list.shadowRoot!.querySelectorAll('.annotation-row')).toHaveLength(3);
    track.querySelector('#c')!.remove();
    await flush();
    await list.updateComplete;
    expect(list.shadowRoot!.querySelectorAll('.annotation-row')).toHaveLength(2);
  });

  it('clicking a row selects it and seeks the host editor', async () => {
    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    editor.appendChild(track);
    const seekTo = vi.fn();
    (editor as unknown as { seekTo: unknown }).seekTo = seekTo;
    await flush();
    await list.updateComplete;
    const row = list.shadowRoot!.querySelectorAll('.annotation-row')[1] as HTMLElement;
    row.click();
    expect(track.activeAnnotationId).toBe('b');
    expect(seekTo).toHaveBeenCalledWith(2.5);
    editor.remove();
  });

  it('highlights the active row on daw-annotation-select', async () => {
    track.activeAnnotationId = 'a';
    await list.updateComplete;
    const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
    expect(rows[0].classList.contains('active')).toBe(true);
    expect(rows[1].classList.contains('active')).toBe(false);
  });

  it('text is contenteditable only when the track is editable', async () => {
    let span = list.shadowRoot!.querySelector('.annotation-row-text') as HTMLElement;
    expect(span.getAttribute('contenteditable')).toBeNull();
    track.editable = true;
    await track.updateComplete;
    await flush();
    await list.updateComplete;
    span = list.shadowRoot!.querySelector('.annotation-row-text') as HTMLElement;
    expect(span.getAttribute('contenteditable')).toBe('true');
  });

  it('committing a text edit writes back to the daw-annotation textContent', async () => {
    track.editable = true;
    await track.updateComplete;
    await flush();
    await list.updateComplete;
    const span = list.shadowRoot!.querySelector('.annotation-row-text') as HTMLElement;
    span.textContent = 'Edited line';
    span.dispatchEvent(new FocusEvent('blur'));
    expect(track.querySelector('#a')!.textContent).toBe('Edited line');
  });

  it('renders empty and warns on unresolvable for target', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const orphan = document.createElement('daw-annotation-list') as DawAnnotationListElement;
    orphan.setAttribute('for', 'missing');
    document.body.appendChild(orphan);
    await flush();
    await orphan.updateComplete;
    expect(orphan.shadowRoot!.querySelectorAll('.annotation-row')).toHaveLength(0);
    orphan.remove();
    warn.mockRestore();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation-list.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `daw-annotation-list.ts`**

```typescript
import { LitElement, html, css, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { AnnotationData } from '@waveform-playlist/core';
import type { DawAnnotationTrackElement } from './daw-annotation-track';
import type { DawAnnotationElement } from './daw-annotation';
import type { DawAnnotationSelectDetail } from '../events';

/** m:ss.mmm for annotation timestamps (finer than the ruler's m:ss). */
function formatAnnotationTime(seconds: number): string {
  const whole = Math.floor(seconds);
  const ms = Math.round((seconds - whole) * 1000);
  const s = whole % 60;
  const m = (whole - s) / 60;
  return m + ':' + String(s).padStart(2, '0') + '.' + String(ms).padStart(3, '0');
}

/**
 * Scrollable text panel over a <daw-annotation-track>'s children — the same
 * <daw-annotation> elements the editor lane renders (single source of truth).
 * Linked via the `for` attribute (id of the track element).
 */
@customElement('daw-annotation-list')
export class DawAnnotationListElement extends LitElement {
  @property() for = '';

  /** Suppress re-render while a row's text is being edited. */
  @state() private _editingId: string | null = null;

  private _activeId: string | null = null;
  private _observer: MutationObserver | null = null;
  private _observedTrack: DawAnnotationTrackElement | null = null;
  private _warnedMissing = false;

  static styles = css`
    :host {
      display: block;
      max-height: var(--daw-annotation-list-max-height, 240px);
      overflow-y: auto;
      background: var(--daw-annotation-list-background, #16213e);
      color: var(--daw-annotation-text-color, #e0d4c8);
      font-family: system-ui, sans-serif;
      font-size: 13px;
    }
    .annotation-row {
      display: flex;
      gap: 10px;
      align-items: baseline;
      padding: 6px 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.06);
      cursor: pointer;
    }
    .annotation-row.active {
      background: var(--daw-annotation-active-background, rgba(196, 154, 108, 0.25));
    }
    .annotation-row-times {
      font-variant-numeric: tabular-nums;
      font-size: 11px;
      opacity: 0.7;
      white-space: nowrap;
    }
    .annotation-row-text {
      flex: 1;
      min-width: 0;
    }
    .annotation-row-text[contenteditable='true'] {
      cursor: text;
      outline-offset: 2px;
    }
  `;

  get track(): DawAnnotationTrackElement | null {
    if (!this.for) return null;
    const el = document.getElementById(this.for);
    if (!el || el.tagName !== 'DAW-ANNOTATION-TRACK') {
      if (el && !this._warnedMissing) {
        console.warn(
          '[dawcore] <daw-annotation-list for="' +
            this.for +
            '"> target is not a <daw-annotation-track>'
        );
        this._warnedMissing = true;
      }
      return null;
    }
    return el as DawAnnotationTrackElement;
  }

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('daw-annotation-select', this._onSelect as EventListener);
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('daw-annotation-select', this._onSelect as EventListener);
    this._observer?.disconnect();
    this._observer = null;
    this._observedTrack = null;
  }

  protected shouldUpdate(): boolean {
    // Never clobber an in-progress text edit with a re-render.
    return this._editingId === null;
  }

  protected updated(): void {
    this._ensureObserver();
  }

  /** (Re)attach the MutationObserver when the resolved track changes. */
  private _ensureObserver(): void {
    const track = this.track;
    if (track === this._observedTrack) return;
    this._observer?.disconnect();
    this._observedTrack = track;
    if (!track) return;
    this._observer = new MutationObserver(() => this.requestUpdate());
    this._observer.observe(track, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['start', 'end', 'id', 'editable'],
    });
  }

  private _onSelect = (e: CustomEvent<DawAnnotationSelectDetail>): void => {
    if (e.target !== this.track) return;
    this._activeId = e.detail.annotation?.id ?? null;
    this.requestUpdate();
    void this.updateComplete.then(() => {
      const row = this.shadowRoot?.querySelector('.annotation-row.active');
      // happy-dom lacks scrollIntoView — guard.
      (row as HTMLElement | null)?.scrollIntoView?.({ block: 'center' });
    });
  };

  private _onRowClick(a: AnnotationData): void {
    const track = this.track;
    if (!track) return;
    track.activeAnnotationId = a.id;
    const editor = track.closest('daw-editor') as { seekTo?: (t: number) => void } | null;
    editor?.seekTo?.(a.start);
  }

  private _annotationElement(id: string): DawAnnotationElement | null {
    return this.track?.annotationElements.find((el) => el.annotationId === id) ?? null;
  }

  private _commitEdit(a: AnnotationData, span: HTMLElement): void {
    this._editingId = null;
    const el = this._annotationElement(a.id);
    if (el) el.textContent = span.textContent?.trim() ?? '';
    this.requestUpdate();
  }

  private _cancelEdit(a: AnnotationData, span: HTMLElement): void {
    this._editingId = null;
    span.textContent = a.lines.join('\n');
    span.blur();
    this.requestUpdate();
  }

  render() {
    const track = this.track;
    const annotations = track?.annotations ?? [];
    const editable = track?.editable ?? false;
    return html`
      ${annotations.map(
        (a) => html`
          <div
            class="annotation-row ${a.id === this._activeId ? 'active' : ''}"
            @click=${(e: Event) => {
              // Ignore clicks that land on the text span while editing.
              if (this._editingId === a.id) return;
              e.stopPropagation();
              this._onRowClick(a);
            }}
          >
            <span class="annotation-row-times">
              ${formatAnnotationTime(a.start)} – ${formatAnnotationTime(a.end)}
            </span>
            <span
              class="annotation-row-text"
              contenteditable=${editable ? 'true' : nothing}
              @focus=${() => {
                if (editable) this._editingId = a.id;
              }}
              @blur=${(e: Event) => this._commitEdit(a, e.target as HTMLElement)}
              @keydown=${(e: KeyboardEvent) => {
                if (!editable) return;
                e.stopPropagation(); // never leak into shortcut handlers
                if (e.key === 'Enter') {
                  e.preventDefault();
                  (e.target as HTMLElement).blur(); // blur commits
                } else if (e.key === 'Escape') {
                  this._cancelEdit(a, e.target as HTMLElement);
                }
              }}
              >${a.lines.join(' ')}</span
            >
          </div>
        `
      )}
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-annotation-list': DawAnnotationListElement;
  }
}
```

**Edit-suppression note:** `_editingId` is set on focus; `shouldUpdate` returns false while editing so a background `daw-annotation-update` (e.g. concurrent lane drag) can't clobber typed text. `_commitEdit`/`_cancelEdit` clear it and re-render.

Export from `packages/dawcore/src/index.ts`:

```typescript
export { DawAnnotationListElement } from './elements/daw-annotation-list';
```

- [ ] **Step 4: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation-list.test.ts`
Expected: PASS. (If happy-dom doesn't deliver `focus`/`blur` FocusEvents to the contenteditable span, dispatch them manually in the test as shown — `span.dispatchEvent(new FocusEvent('blur'))`.)

- [ ] **Step 5: Full dawcore suite + typecheck**

Run: `cd packages/dawcore && npx vitest run && pnpm --filter @dawcore/components typecheck`
Expected: all PASS. Then `pkill -f vitest` if strays remain.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-annotation-list.ts packages/dawcore/src/index.ts packages/dawcore/src/__tests__/daw-annotation-list.test.ts
git commit -m "feat(dawcore): daw-annotation-list dual-view text panel"
```

---

### Task 12: Demo page + real-browser verification

**Files:**
- Create: `examples/dawcore-native/annotations.html`
- Modify: `README.md` (add the page to the dawcore-native demo list)

- [ ] **Step 1: Create `examples/dawcore-native/annotations.html`** (modeled on `basic.html`)

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>dawcore annotations</title>
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
      margin-bottom: 12px;
    }
    daw-transport { display: flex; gap: 8px; margin-bottom: 12px; }
    daw-annotation-list { border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 4px; }
    .hint { font-size: 0.75rem; color: #888; margin-top: 12px; }
  </style>
</head>
<body>
  <h1>dawcore — annotations (dual view, keyboard controls)</h1>

  <script type="module">import '@dawcore/components';</script>

  <daw-editor id="editor" samples-per-pixel="1024" wave-height="100" timescale>
    <daw-annotation-track id="sections" editable link-endpoints keyboard-controls>
      <daw-annotation start="0" end="4">Intro</daw-annotation>
      <daw-annotation start="4" end="12">Verse 1</daw-annotation>
      <daw-annotation start="12" end="20">Chorus</daw-annotation>
      <daw-annotation start="20" end="28">Verse 2</daw-annotation>
    </daw-annotation-track>
    <daw-track src="/media/audio/AlbertKader_Whiptails/07_Bass1.opus" name="Bass"></daw-track>
    <daw-track src="/media/audio/AlbertKader_Whiptails/09_Synth1.opus" name="Synth"></daw-track>
  </daw-editor>

  <daw-transport for="editor">
    <daw-play-button></daw-play-button>
    <daw-pause-button></daw-pause-button>
    <daw-stop-button></daw-stop-button>
    <daw-time-display></daw-time-display>
  </daw-transport>

  <daw-annotation-list for="sections"></daw-annotation-list>

  <p class="hint">
    Click a box or list row to select + seek. Arrows navigate, Enter plays the
    selection, [ ] / { } nudge boundaries ±10ms, Escape deselects (Escape again
    stops playback). Drag box edges to resize; text in the list is editable.
  </p>

  <script type="module">
    import { NativePlayoutAdapter } from '@dawcore/transport';
    const editor = document.getElementById('editor');
    const audioCtx = new AudioContext({ sampleRate: 48000, latencyHint: 0 });
    editor.adapter = new NativePlayoutAdapter(audioCtx);
  </script>
</body>
</html>
```

- [ ] **Step 2: Real-browser verification with headless Playwright MCP**

Start the dev server on an explicit non-default port (session memory: avoid 5173-5175): `pnpm example:dawcore-native -- --port 5199` (read the startup log for the ACTUAL port and cwd). Then with the Playwright MCP verify at `http://localhost:<port>/annotations.html`:

1. Lane renders above the two waveform tracks; four boxes positioned left-to-right; list shows four rows with times.
2. `page.mouse` drag on a box's end edge → box resizes AND the list row's end time updates (dual-view). Use real input, NOT synthetic dispatchEvent (setPointerCapture NotFoundError gotcha).
3. Click a list row → box highlights in the lane, playhead jumps.
4. Keyboard: click empty page area first (blur), press ArrowDown → first box highlights (and the lane auto-scrolls to center it when zoomed in); `]` → start nudges (verify via `document.querySelector('daw-annotation-track').annotations[0]` in evaluate); Enter → playback starts and STOPS at the annotation end (assert `daw-stop` fires or isPlaying flips; rAF-independent assertions per the hidden-tab gotcha); Escape → deselect; Escape again → editor stops.
5. Edit a list row's text, blur → `<daw-annotation>` textContent updated (evaluate).

Fix anything that fails (happy-dom can't catch Lit update-loop warnings, layout, or pointer capture issues). Check the browser console for the Lit "scheduled an update after an update completed" dev warning — its presence means a reactive property is being set inside `updated()` and must be fixed.

- [ ] **Step 3: Update root README.md**

Add `annotations.html` to the dawcore-native pages list (match the existing entry format — one line describing the demo).

- [ ] **Step 4: Delete stray Playwright artifacts, commit**

Remove any screenshots/logs from the repo root and `.playwright-mcp/` before staging.

```bash
git add examples/dawcore-native/annotations.html README.md
git commit -m "feat(examples): dawcore annotations demo page (dual view + keyboard)"
```

---

### Task 13: Docs, changesets, full verification

**Files:**
- Modify: `docs/specs/web-components-migration.md` (mark annotation elements implemented; fix drift)
- Modify: `packages/dawcore/COMPONENTS.md` (element entries)
- Modify: `packages/dawcore/CLAUDE.md` (element types + patterns learned)
- Modify: `website/static/llms.txt` + `website/docs/llm-reference.md` (only if they list dawcore element surfaces — check first)
- Create: `.changeset/annotation-web-components-core.md`, `.changeset/annotation-web-components-annotations.md`, `.changeset/annotation-web-components-dawcore.md`

- [ ] **Step 1: Update `docs/specs/web-components-migration.md`**

- Line ~270: replace the "not yet implemented" blockquote with an implemented note (epic #455; #477 `<daw-player>` hosting still open).
- Line ~40: remove `annotations (epic #455)` from the "React packages without a Web Components equivalent yet" list.
- In the "`<daw-annotation-track>` API" and "Annotation Keyboard Controls" sections: verify every documented attribute/method/behavior against the implementation; document the two implementation specifics: capture-phase priority mechanism, and navigation-with-no-selection semantics (next→first, previous→last). Add the beats-mode variable-tempo lane-drift limitation.

- [ ] **Step 2: Update `packages/dawcore/COMPONENTS.md` and `packages/dawcore/CLAUDE.md`**

COMPONENTS.md: add `<daw-annotation>`, `<daw-annotation-track>`, `<daw-annotation-list>` entries with attribute tables matching the migration spec. CLAUDE.md: add to "Element Types" (data elements: annotation + annotation-track; standalone: annotation-list) and note: reflected `start`/`end` as source of truth, capture-phase keyboard priority, `ANNOTATION_LANE_HEIGHT` constant, selection-is-ephemeral pattern.

- [ ] **Step 3: Changesets** (all patch — `@dawcore/*` is zerover, never minor/major)

`.changeset/annotation-web-components-core.md`:

```md
---
'@waveform-playlist/core': patch
---

Add framework-agnostic annotation modules: updateAnnotationBoundaries boundary math, AnnotationShortcutMap with spec-default key bindings, and KeyBinding/matchesKeyBinding keyboard helpers
```

`.changeset/annotation-web-components-annotations.md`:

```md
---
'@waveform-playlist/annotations': patch
---

useAnnotationControls delegates boundary math to @waveform-playlist/core (no behavior change)
```

`.changeset/annotation-web-components-dawcore.md`:

```md
---
'@dawcore/components': patch
---

Annotation web components (#455): daw-annotation-track, daw-annotation, daw-annotation-list with single-source-of-truth dual-view sync, boundary drag editing, and keyboard controls; editor.play() gains optional endTime
```

- [ ] **Step 4: Full verification sweep**

```bash
pnpm --filter @waveform-playlist/core build
pnpm build          # all packages
pnpm typecheck      # first-fail: on failure fix and RE-RUN the full sweep
pnpm -w lint        # require exit 0 AND "0 errors" in the ✖ summary
cd packages/core && npx vitest run && cd ../..
cd packages/annotations && npx vitest run && cd ../..
cd packages/dawcore && npx vitest run && cd ../..
pkill -f vitest || true
```

Expected: everything green. Remember: exit 1 from `pnpm lint` with NO `✖ N problems` summary = prettier failure → `pnpm format`.

- [ ] **Step 5: Commit**

```bash
git add docs/specs/web-components-migration.md packages/dawcore/COMPONENTS.md packages/dawcore/CLAUDE.md .changeset/
git commit -m "docs: annotation web components spec/status updates + changesets (#455)"
```

(Include `website/static/llms.txt` / `website/docs/llm-reference.md` in the add if Step 2's check found dawcore surfaces there.)

---

### Task 14: Finish — PR

- [ ] **Step 1: Remove the working documents** (project rule: specs/plans are removed before the PR merges; the PR description is the durable record)

```bash
git rm docs/specs/2026-07-10-annotation-web-components-design.md docs/plans/2026-07-10-annotation-web-components.md
git commit -m "chore: remove working design/plan docs for #455"
```

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feature/annotation-web-components
```

PR body: summarize architecture (data-element pattern, core extraction, capture-phase keyboard priority), full test plan, and `closes #455`. Note that #477 (`<daw-player>` hosting) is the follow-up. **Do not merge** — user reviews and approves first (standing rule), then squash-merge.
