# Annotation Tick Positions (PPQN) + box-label Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Musical (tick) positioning for `<daw-annotation>` mirroring the clip dual-timebase pattern, snap-aware tick-native boundary editing, per-track `box-label` lane labels (sonnet-style id-in-bar), contractual blank-text/list-less support, plus beats-grid region demo and Sonnet 18 parity demo.

**Architecture:** `start-tick`/`end-tick` authoritative when both present; `start`/`end` seconds stay as a derived cache the editor's `AnnotationController` keeps fresh (connect/update/BPM-change sweep). Boundary math stays the single core function, parameterized for tick units. Beats-mode lanes render tick annotations with clip-identical tick math.

**Tech Stack:** Lit (dawcore), vitest + happy-dom, pure TS in core.

**Spec:** `docs/specs/2026-07-11-annotation-ticks-design.md` (approved). Branch: `feature/annotation-ticks` (checked out).

## Global Constraints

- Commit after every task; conventional commits; NO Co-Authored-By/attribution footers; run git from repo root.
- Immutability; string-only console output; validated numeric properties via `noAccessor` warn-and-reject.
- Run `npx prettier --check` on every changed TS file before committing (fix with `--write`).
- `pnpm typecheck` resolves workspace deps via `dist/` — build core after changing it and BEFORE dawcore typecheck/tests: `pnpm --filter @waveform-playlist/core build`.
- Tick constants (exact): `ANNOTATION_LINK_THRESHOLD_TICKS = 0.5`; `annotationMinDurationTicks(ppqn) = Math.max(1, Math.round(ppqn / 32))`.
- Authority rule: an annotation is tick-based iff BOTH `start-tick` and `end-tick` are set; exactly one → warn once, seconds-based.
- Tick-based boundary EDITS require a host editor (tick↔seconds conversion); without one: warn + no-op.
- Beats-mode-only rendering branch; temporal mode renders every annotation from the seconds cache (kept fresh).
- vitest `-t` is a REGEX — filter on paren-free name fragments. `pkill -f vitest` after multi-run sessions.
- Existing test suites must stay green UNMODIFIED (they prove the additive changes are non-breaking).

---

### Task 1: Core — parameterized boundary math + tick constants + AnnotationData tick fields

**Files:**
- Modify: `packages/core/src/annotations/boundaries.ts`
- Modify: `packages/core/src/types/annotations.ts` (AnnotationData)
- Test: `packages/core/src/__tests__/annotationBoundaries.test.ts` (append)

**Interfaces:**
- Consumes: existing `updateAnnotationBoundaries(params: AnnotationBoundaryUpdate)`.
- Produces (all exported from the `@waveform-playlist/core` barrel via the existing `export *`):
  - `interface AnnotationBoundaryOptions { linkThreshold?: number; minDuration?: number }`
  - `updateAnnotationBoundaries(params: AnnotationBoundaryUpdate, options?: AnnotationBoundaryOptions): AnnotationData[]`
  - `ANNOTATION_LINK_THRESHOLD_TICKS = 0.5`
  - `annotationMinDurationTicks(ppqn: number): number`
  - `AnnotationData` gains `startTick?: number; endTick?: number;`

- [ ] **Step 1: Write the failing tests** (append to the existing describe or a new one in the same file)

```typescript
import {
  ANNOTATION_LINK_THRESHOLD_TICKS,
  annotationMinDurationTicks,
} from '../annotations/boundaries';

describe('updateAnnotationBoundaries — parameterized units', () => {
  it('exports tick constants', () => {
    expect(ANNOTATION_LINK_THRESHOLD_TICKS).toBe(0.5);
    expect(annotationMinDurationTicks(960)).toBe(30);
    expect(annotationMinDurationTicks(16)).toBe(1); // floor at 1 tick
  });

  it('defaults preserve existing behavior (min duration 0.1)', () => {
    const result = updateAnnotationBoundaries({
      annotationIndex: 0,
      newTime: 5,
      isDraggingStart: true,
      annotations: [ann('a', 1, 2)],
      duration: 10,
      linkEndpoints: false,
    });
    expect(result[0].start).toBeCloseTo(1.9);
  });

  it('tick units: min duration and link threshold from options', () => {
    // Integer tick positions; minDuration 30 ticks (ppqn 960).
    const result = updateAnnotationBoundaries(
      {
        annotationIndex: 0,
        newTime: 99999,
        isDraggingStart: false,
        annotations: [{ id: 'a', start: 0, end: 960, lines: [''] }],
        duration: 3840,
        linkEndpoints: false,
      },
      { linkThreshold: ANNOTATION_LINK_THRESHOLD_TICKS, minDuration: annotationMinDurationTicks(960) }
    );
    expect(result[0].end).toBe(3840); // clamped to duration, not 0.1-seconds math

    // Linked neighbors at integer ticks: |960 - 960| < 0.5 → linked.
    const linked = updateAnnotationBoundaries(
      {
        annotationIndex: 1,
        newTime: 480,
        isDraggingStart: true,
        annotations: [
          { id: 'a', start: 0, end: 960, lines: [''] },
          { id: 'b', start: 960, end: 1920, lines: [''] },
        ],
        duration: 3840,
        linkEndpoints: true,
      },
      { linkThreshold: 0.5, minDuration: 30 }
    );
    expect(linked[1].start).toBe(480);
    expect(linked[0].end).toBe(480);
  });

  it('tick min duration clamps start drags', () => {
    const result = updateAnnotationBoundaries(
      {
        annotationIndex: 0,
        newTime: 950,
        isDraggingStart: true,
        annotations: [{ id: 'a', start: 0, end: 960, lines: [''] }],
        duration: 3840,
        linkEndpoints: false,
      },
      { linkThreshold: 0.5, minDuration: 30 }
    );
    expect(result[0].start).toBe(930); // end - 30 ticks
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/core && npx vitest run src/__tests__/annotationBoundaries.test.ts`
Expected: FAIL — `ANNOTATION_LINK_THRESHOLD_TICKS` not exported.

- [ ] **Step 3: Implement**

In `boundaries.ts`: add after the existing constants:

```typescript
/** Link threshold for INTEGER TICK positions — closer than half a tick means equal. */
export const ANNOTATION_LINK_THRESHOLD_TICKS = 0.5;

/** Minimum tick-annotation duration: a 128th note, floored at 1 tick. */
export function annotationMinDurationTicks(ppqn: number): number {
  return Math.max(1, Math.round(ppqn / 32));
}

/** Unit constants for a boundary-math run. Defaults are the seconds-domain values. */
export interface AnnotationBoundaryOptions {
  linkThreshold?: number;
  minDuration?: number;
}
```

Change the function signature and REPLACE every occurrence of the constants inside the body:

```typescript
export function updateAnnotationBoundaries(
  params: AnnotationBoundaryUpdate,
  options: AnnotationBoundaryOptions = {}
): AnnotationData[] {
  const { annotationIndex, newTime, isDraggingStart, annotations, duration, linkEndpoints } =
    params;
  const linkThreshold = options.linkThreshold ?? LINK_THRESHOLD;
  const minDuration = options.minDuration ?? MIN_ANNOTATION_DURATION;
```

Then, in the body, replace ALL uses: `LINK_THRESHOLD` → `linkThreshold` (3 occurrences) and `MIN_ANNOTATION_DURATION` → `minDuration` (5 occurrences). No other logic changes — the existing suite passing unmodified is the non-breaking proof.

In `packages/core/src/types/annotations.ts`, extend `AnnotationData`:

```typescript
export interface AnnotationData {
  id: string;
  start: number;
  end: number;
  lines: string[];
  language?: string;
  /** Musical position (ticks). Authoritative when BOTH tick fields are set —
   * start/end seconds are then a derived cache (clip startTick pattern). */
  startTick?: number;
  endTick?: number;
}
```

- [ ] **Step 4: Run core suite + build**

Run: `cd packages/core && npx vitest run` — ALL pass (pre-existing boundary tests unmodified).
Run: `pnpm --filter @waveform-playlist/core build` — succeeds (later tasks need fresh dist/).

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/annotations/boundaries.ts packages/core/src/types/annotations.ts packages/core/src/__tests__/annotationBoundaries.test.ts
git commit -m "feat(core): parameterize annotation boundary math for tick units"
```

---

### Task 2: dawcore — `<daw-annotation>` tick attributes

**Files:**
- Modify: `packages/dawcore/src/elements/daw-annotation.ts`
- Test: `packages/dawcore/src/__tests__/daw-annotation.test.ts` (append)

**Interfaces:**
- Produces on `DawAnnotationElement`:
  - `startTick: number | null` / `endTick: number | null` — attributes `start-tick`/`end-tick`, reflected, validated (finite integer ≥ 0; warn + reject; `null` clears).
  - `get isTickBased(): boolean` — both non-null.
  - `toAnnotationData()` includes `startTick`/`endTick` when tick-based.
  - `daw-annotation-update` fires when tick properties change (post-first-render, same as start/end).
  - Warn once per element when exactly one tick attribute is set (checked in `updated()`).

- [ ] **Step 1: Write the failing tests** (append inside the existing describe; reuse its `flush` helper and beforeEach/afterEach)

```typescript
  it('parses start-tick/end-tick and reports isTickBased', async () => {
    el.setAttribute('start-tick', '960');
    el.setAttribute('end-tick', '1920');
    document.body.appendChild(el);
    await flush();
    expect(el.startTick).toBe(960);
    expect(el.endTick).toBe(1920);
    expect(el.isTickBased).toBe(true);
    expect(el.toAnnotationData().startTick).toBe(960);
    expect(el.toAnnotationData().endTick).toBe(1920);
  });

  it('is not tick-based without tick attributes, and omits tick fields', async () => {
    document.body.appendChild(el);
    await flush();
    expect(el.isTickBased).toBe(false);
    expect('startTick' in el.toAnnotationData()).toBe(false);
  });

  it('rejects invalid tick values with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.appendChild(el);
    await flush();
    el.startTick = 960;
    el.startTick = -5; // rejected
    el.startTick = 1.5; // rejected (non-integer)
    el.startTick = NaN; // rejected
    expect(el.startTick).toBe(960);
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  it('warns once when exactly one tick attribute is set', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.setAttribute('start-tick', '960');
    document.body.appendChild(el);
    await flush();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.isTickBased).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    // Setting the second tick clears the half-configured state; no repeat warn.
    el.endTick = 1920;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(el.isTickBased).toBe(true);
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('dispatches daw-annotation-update on tick change after first render', async () => {
    el.setAttribute('start-tick', '0');
    el.setAttribute('end-tick', '960');
    document.body.appendChild(el);
    await flush();
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    const spy = vi.fn();
    document.body.addEventListener('daw-annotation-update', spy);
    el.endTick = 1920;
    await (el as unknown as { updateComplete: Promise<unknown> }).updateComplete;
    expect(spy).toHaveBeenCalled();
    document.body.removeEventListener('daw-annotation-update', spy);
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation.test.ts`
Expected: FAIL — `startTick` undefined.

- [ ] **Step 3: Implement**

Add to `DawAnnotationElement` after the `_end` field (validator shared by both tick setters — place the helper as a module-level function ABOVE the `@customElement` decorator per the dawcore decorator gotcha):

```typescript
/** Valid tick value: finite non-negative integer. */
function isValidTick(value: number): boolean {
  return Number.isFinite(value) && Number.isInteger(value) && value >= 0;
}
```

and inside the class:

```typescript
  /** Musical start position (ticks). Authoritative when end-tick is also set —
   * start/end seconds become a derived cache the host editor keeps fresh
   * (clip startTick pattern). */
  @property({ type: Number, noAccessor: true, reflect: true, attribute: 'start-tick' })
  get startTick(): number | null {
    return this._startTick;
  }
  set startTick(value: number | null) {
    const old = this._startTick;
    if (value === null) {
      this._startTick = null;
      this.requestUpdate('startTick', old);
      return;
    }
    if (!isValidTick(value)) {
      console.warn(
        '[dawcore] daw-annotation start-tick ' + String(value) + ' is invalid — ignored'
      );
      return;
    }
    this._startTick = value;
    this.requestUpdate('startTick', old);
  }
  private _startTick: number | null = null;

  /** Musical end position (ticks). See startTick. */
  @property({ type: Number, noAccessor: true, reflect: true, attribute: 'end-tick' })
  get endTick(): number | null {
    return this._endTick;
  }
  set endTick(value: number | null) {
    const old = this._endTick;
    if (value === null) {
      this._endTick = null;
      this.requestUpdate('endTick', old);
      return;
    }
    if (!isValidTick(value)) {
      console.warn('[dawcore] daw-annotation end-tick ' + String(value) + ' is invalid — ignored');
      return;
    }
    this._endTick = value;
    this.requestUpdate('endTick', old);
  }
  private _endTick: number | null = null;

  /** Tick-based iff BOTH tick attributes are set (authority rule). */
  get isTickBased(): boolean {
    return this._startTick !== null && this._endTick !== null;
  }

  private _warnedHalfTick = false;
```

Extend `toAnnotationData()` (replace the return):

```typescript
    const data: AnnotationData = {
      id: this.annotationId,
      start: this.start,
      end: this.end,
      lines: text.length > 0 ? text.split('\n') : [''],
    };
    if (this.isTickBased) {
      data.startTick = this._startTick as number;
      data.endTick = this._endTick as number;
    }
    return data;
```

Extend `updated()` — the changed-props check gains the tick props, and the half-tick warn runs after first render too (replace the method):

```typescript
  updated(changed: PropertyValues) {
    // Exactly one tick attribute set is a half-configured state — warn once.
    const halfTick =
      (this._startTick !== null) !== (this._endTick !== null);
    if (halfTick && !this._warnedHalfTick) {
      this._warnedHalfTick = true;
      console.warn(
        '[dawcore] daw-annotation "' +
          this.annotationId +
          '": only one of start-tick/end-tick is set — treated as seconds-based until both are present'
      );
    }
    if (!this._hasRendered) {
      this._hasRendered = true;
      return;
    }
    if (
      changed.has('start') ||
      changed.has('end') ||
      changed.has('startTick') ||
      changed.has('endTick')
    ) {
      this.dispatchEvent(
        new CustomEvent('daw-annotation-update', {
          bubbles: true,
          composed: true,
          detail: { annotationId: this.annotationId },
        })
      );
    }
  }
```

- [ ] **Step 4: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation.test.ts`
Expected: PASS (new + all pre-existing).

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-annotation.ts packages/dawcore/src/__tests__/daw-annotation.test.ts
git commit -m "feat(dawcore): start-tick/end-tick attributes on daw-annotation"
```

---

### Task 3: dawcore — seconds-cache derivation sweep (controller + editor wiring)

**Files:**
- Modify: `packages/dawcore/src/controllers/annotation-controller.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (host method already exists; statechange hook + derive triggers)
- Test: `packages/dawcore/src/__tests__/annotation-controller.test.ts` (append) and `packages/dawcore/src/__tests__/daw-editor-annotations.test.ts` (append)

**Interfaces:**
- Consumes: `DawAnnotationElement.isTickBased/startTick/endTick/start/end` (Task 2); editor `_ticksToSeconds(ticks: number): number` (exists, daw-editor.ts:947).
- Produces:
  - `AnnotationControllerHost` gains `_ticksToSeconds(ticks: number): number`.
  - `AnnotationController.deriveSecondsCaches(): void` — for every registered track's tick-based annotation element, computes `host._ticksToSeconds(startTick/endTick)` and writes `el.start`/`el.end` ONLY when changed (loop-safe idempotence).
  - Controller calls `deriveSecondsCaches()` from `handleTrackConnected` and from its `daw-annotation-connected`/`daw-annotation-update` listener path.
  - Editor: statechange handler tracks the last-seen engine bpm (`_lastAnnotationBpm: number | null` field) and calls `this._annotations.deriveSecondsCaches()` when it changes.

- [ ] **Step 1: Write the failing tests**

Append to `annotation-controller.test.ts` (extend `makeHost()` with `_ticksToSeconds: vi.fn((t: number) => t / 960)` — i.e. 60 BPM at ppqn 960 → 1 beat = 1 second):

```typescript
  it('derives seconds caches for tick-based annotations (write-only-on-change)', async () => {
    const tickEl = document.createElement('daw-annotation') as HTMLElement & {
      startTick: number | null;
      endTick: number | null;
      start: number;
      end: number;
    };
    tickEl.setAttribute('start-tick', '960');
    tickEl.setAttribute('end-tick', '2880');
    track.appendChild(tickEl);
    await flush();
    controller.deriveSecondsCaches();
    expect(tickEl.start).toBe(1); // 960 / 960
    expect(tickEl.end).toBe(3);
    // Second sweep with unchanged tempo: no writes → no update events.
    const spy = vi.fn();
    host.addEventListener('daw-annotation-update', spy);
    controller.deriveSecondsCaches();
    await flush();
    expect(spy).not.toHaveBeenCalled();
    host.removeEventListener('daw-annotation-update', spy);
  });

  it('re-derives when the conversion changes (BPM change)', async () => {
    const tickEl = document.createElement('daw-annotation') as HTMLElement & {
      start: number;
      end: number;
    };
    tickEl.setAttribute('start-tick', '960');
    tickEl.setAttribute('end-tick', '1920');
    track.appendChild(tickEl);
    await flush();
    controller.deriveSecondsCaches();
    expect(tickEl.start).toBe(1);
    host._ticksToSeconds = vi.fn((t: number) => t / 1920); // 120 BPM
    controller.deriveSecondsCaches();
    expect(tickEl.start).toBe(0.5);
    expect(tickEl.end).toBe(1);
  });
```

Append to `daw-editor-annotations.test.ts` (use the file's existing `makeEditor` pattern):

```typescript
  it('re-derives tick annotation seconds when the engine BPM changes', async () => {
    const editor = await makeEditor();
    editor.innerHTML +=
      '<daw-annotation-track id="ticks">' +
      '<daw-annotation id="t1" start-tick="960" end-tick="1920"></daw-annotation>' +
      '</daw-annotation-track>';
    await flush();
    await editor.updateComplete;
    const el = editor.querySelector('#t1') as HTMLElement & { start: number; end: number };
    // Default 120 BPM, ppqn 960: 960 ticks = 0.5s.
    expect(el.start).toBeCloseTo(0.5);
    editor.bpm = 60;
    await editor.updateComplete;
    await flush();
    expect(el.start).toBeCloseTo(1);
    expect(el.end).toBeCloseTo(2);
    editor.remove();
  });
```

**Note:** verify the editor's default bpm and how `editor.bpm = 60` reaches `engine.setTempo` → statechange (see `daw-editor-bpm.test.ts` for the working pattern and the actual default; adjust expected values to `_ticksToSeconds`' real math — `(ticks * 60) / (bpm * ppqn)` in fixed-BPM mode, daw-editor.ts:957). Encode what the code actually produces.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/annotation-controller.test.ts src/__tests__/daw-editor-annotations.test.ts`
Expected: FAIL — `deriveSecondsCaches` not a function.

- [ ] **Step 3: Implement**

`annotation-controller.ts` — extend the host interface:

```typescript
export interface AnnotationControllerHost extends ReactiveControllerHost, HTMLElement {
  effectiveSampleRate: number;
  seekTo(time: number): void;
  /** Tick→seconds conversion (fixed BPM or variable-tempo callbacks) —
   * the editor owns tempo; the controller derives annotation seconds caches. */
  _ticksToSeconds(ticks: number): number;
}
```

Add the sweep method + call sites:

```typescript
  /**
   * Keep the seconds attributes (derived cache) of tick-based annotations in
   * sync with the host's tempo. Write-only-on-change: a write fires
   * daw-annotation-update → _onDataChange → this sweep again → values equal →
   * no write → the loop settles (idempotent).
   */
  deriveSecondsCaches(): void {
    for (const track of this._tracks) {
      for (const el of track.annotationElements) {
        if (!el.isTickBased) continue;
        const startSeconds = this._host._ticksToSeconds(el.startTick as number);
        const endSeconds = this._host._ticksToSeconds(el.endTick as number);
        if (el.start !== startSeconds) el.start = startSeconds;
        if (el.end !== endSeconds) el.end = endSeconds;
      }
    }
  }
```

Change `_onDataChange` to also derive (connect/update events may introduce or move tick annotations):

```typescript
  private _onDataChange = (): void => {
    this.deriveSecondsCaches();
    this._host.requestUpdate();
  };
```

and append `this.deriveSecondsCaches();` as the last line of `handleTrackConnected`.

`daw-editor.ts` — add a field near `_annotations`:

```typescript
  private _lastAnnotationBpm: number | null = null;
```

In the engine statechange handler (inside `_buildEngine`, `engine.on('statechange', (engineState) => {` at ~line 2372), add at the END of the handler body:

```typescript
      // Tick-based annotations: BPM changes move their time-domain positions —
      // re-derive the seconds caches (write-only-on-change; loop-safe).
      if (engineState.bpm !== this._lastAnnotationBpm) {
        this._lastAnnotationBpm = engineState.bpm;
        this._annotations.deriveSecondsCaches();
      }
```

(The editor already satisfies `_ticksToSeconds` structurally — it is a non-private method at line 947.)

- [ ] **Step 4: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/annotation-controller.test.ts src/__tests__/daw-editor-annotations.test.ts src/__tests__/daw-editor-bpm.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/controllers/annotation-controller.ts packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/annotation-controller.test.ts packages/dawcore/src/__tests__/daw-editor-annotations.test.ts
git commit -m "feat(dawcore): editor-owned seconds-cache derivation for tick annotations"
```

---

### Task 4: dawcore — `box-label` attribute + list empty-row placeholder + contractual blank/no-list tests

**Files:**
- Modify: `packages/dawcore/src/elements/daw-annotation-track.ts` (one property)
- Modify: `packages/dawcore/src/controllers/annotation-controller.ts` (lane label)
- Modify: `packages/dawcore/src/elements/daw-annotation-list.ts` (placeholder CSS)
- Test: `packages/dawcore/src/__tests__/daw-editor-annotations.test.ts` + `packages/dawcore/src/__tests__/daw-annotation-list.test.ts` (append)

**Interfaces:**
- Produces:
  - `DawAnnotationTrackElement.boxLabel: 'text' | 'id' | 'none'` — attribute `box-label`, reflected, default `'text'`; unknown attribute values fall back to `'text'` at the render site (no accessor validation needed — the controller treats anything ≠ 'id'/'none' as 'text').
  - Lane label rule: `'text'` → `a.lines.join(' ')` (today's behavior); `'id'` → the ELEMENT's explicit `id` attribute when set, else its 1-based position in the sorted track; `'none'` → no label span content.
  - List: `.annotation-row-text:empty::before { content: '—'; opacity: 0.4; }` placeholder.

- [ ] **Step 1: Write the failing tests**

Append to `daw-editor-annotations.test.ts`:

```typescript
  it('box-label="id" renders element ids (or 1-based position) in the bars', async () => {
    const editor = await makeEditor();
    editor.innerHTML +=
      '<daw-annotation-track id="s" box-label="id">' +
      '<daw-annotation id="7" start="0" end="1">First line of text</daw-annotation>' +
      '<daw-annotation start="1" end="2">Second line of text</daw-annotation>' +
      '</daw-annotation-track>';
    await flush();
    await editor.updateComplete;
    const labels = [...editor.shadowRoot!.querySelectorAll('.annotation-box-text')].map(
      (s) => s.textContent?.trim()
    );
    expect(labels).toEqual(['7', '2']); // explicit id, then position fallback
    editor.remove();
  });

  it('box-label="none" renders empty bars even when text exists', async () => {
    const editor = await makeEditor();
    editor.innerHTML +=
      '<daw-annotation-track box-label="none">' +
      '<daw-annotation start="0" end="1">Hidden in lane</daw-annotation>' +
      '</daw-annotation-track>';
    await flush();
    await editor.updateComplete;
    const label = editor.shadowRoot!.querySelector('.annotation-box-text');
    expect(label?.textContent?.trim()).toBe('');
    editor.remove();
  });

  it('blank-text annotations render as bars and the track works without any list', async () => {
    const editor = await makeEditor();
    editor.innerHTML +=
      '<daw-annotation-track id="regions">' +
      '<daw-annotation start="0" end="1"></daw-annotation>' +
      '<daw-annotation start="1" end="2"></daw-annotation>' +
      '</daw-annotation-track>';
    await flush();
    await editor.updateComplete;
    expect(editor.shadowRoot!.querySelectorAll('.annotation-box')).toHaveLength(2);
    const track = editor.querySelector('#regions') as DawAnnotationTrackElement;
    track.selectNext();
    expect(track.activeAnnotationId).toBeTruthy(); // fully functional, no list anywhere
    editor.remove();
  });
```

Append to `daw-annotation-list.test.ts`:

```typescript
  it('empty-text rows keep a selectable presence (placeholder styling hook)', async () => {
    track.insertAdjacentHTML(
      'beforeend',
      '<daw-annotation id="blank" start="5" end="6"></daw-annotation>'
    );
    await flush();
    await list.updateComplete;
    const rows = list.shadowRoot!.querySelectorAll('.annotation-row');
    expect(rows).toHaveLength(3);
    const span = rows[2].querySelector('.annotation-row-text') as HTMLElement;
    expect(span.textContent).toBe(''); // :empty — the CSS ::before placeholder applies
    // Structural assertion for the placeholder rule (happy-dom doesn't compute
    // pseudo-elements — assert the stylesheet carries it).
    const cssText = (list.constructor as typeof DawAnnotationListElement).styles.toString();
    expect(cssText).toContain(':empty::before');
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-annotations.test.ts src/__tests__/daw-annotation-list.test.ts`
Expected: FAIL — labels show full text; no `:empty::before` rule.

- [ ] **Step 3: Implement**

`daw-annotation-track.ts` — add with the other reflected properties:

```typescript
  /** Lane box label mode: 'text' (default) | 'id' (sonnet-style: explicit id
   * attribute, else 1-based position) | 'none' (pure region bars). The list
   * always shows full text — this only affects the timeline lane. */
  @property({ reflect: true, attribute: 'box-label' }) boxLabel: 'text' | 'id' | 'none' = 'text';
```

`annotation-controller.ts` — in `renderLanes`, replace the per-track mapping so labels come from the mode (elements and data are index-aligned — both sorted by start):

```typescript
    return this._tracks.map((track) => {
      const activeId = track.activeAnnotationId;
      const elements = track.annotationElements;
      return html`
        <div
          class="annotation-lane"
          style="height: ${ANNOTATION_LANE_HEIGHT}px;"
          @pointerdown=${(e: PointerEvent) => onPointerDown(e, track)}
        >
          ${elements.map((el, i) => {
            const a = el.toAnnotationData();
            const geo = this.boxGeometry(a, spp, sampleRate);
            const label =
              track.boxLabel === 'none'
                ? ''
                : track.boxLabel === 'id'
                  ? el.id || String(i + 1)
                  : a.lines.join(' ');
            return html`
              <div
                class="annotation-box ${a.id === activeId ? 'active' : ''}"
                data-annotation-id=${a.id}
                style="left: ${geo.left}px; width: ${geo.width}px;"
              >
                ${track.editable
                  ? html`<div class="annotation-boundary" data-edge="start"></div>`
                  : ''}
                <span class="annotation-box-text">${label}</span>
                ${track.editable
                  ? html`<div class="annotation-boundary" data-edge="end"></div>`
                  : ''}
              </div>
            `;
          })}
        </div>
      `;
    });
```

(`el.id` is the raw DOM id attribute — empty string when unset, which is exactly the fallback condition. Generated `annotationId`s never leak into labels.)

`daw-annotation-list.ts` — append to `static styles` after the `.annotation-row-text[contenteditable='true']` rule:

```css
    .annotation-row-text:empty::before {
      content: '—';
      opacity: 0.4;
    }
```

- [ ] **Step 4: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-annotations.test.ts src/__tests__/daw-annotation-list.test.ts src/__tests__/annotation-controller.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-annotation-track.ts packages/dawcore/src/controllers/annotation-controller.ts packages/dawcore/src/elements/daw-annotation-list.ts packages/dawcore/src/__tests__/daw-editor-annotations.test.ts packages/dawcore/src/__tests__/daw-annotation-list.test.ts
git commit -m "feat(dawcore): box-label lane modes and contractual blank/no-list support"
```

---

### Task 5: dawcore — beats-mode tick rendering (boxGeometry branch)

**Files:**
- Modify: `packages/dawcore/src/controllers/annotation-controller.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (render call site)
- Test: `packages/dawcore/src/__tests__/annotation-controller.test.ts` (append)

**Interfaces:**
- Produces:
  - `boxGeometry(a: AnnotationData, spp: number, sampleRate: number, ticksPerPixel?: number | null)` — when `ticksPerPixel` is a positive number AND `a.startTick != null && a.endTick != null`: `left = Math.round(a.startTick / ticksPerPixel)`, `width = Math.round(a.endTick / ticksPerPixel) − left` (clip-identical beats math). Otherwise the existing floor-based seconds math.
  - `renderLanes(spp, sampleRate, onPointerDown?, ticksPerPixel?: number | null)` — threads it through.
  - Editor `render()` passes `this.scaleMode === 'beats' ? this.ticksPerPixel : null` as the 4th argument.

- [ ] **Step 1: Write the failing tests** (append to `annotation-controller.test.ts`)

```typescript
  it('boxGeometry uses tick math when ticksPerPixel is provided and data is tick-based', () => {
    const a = { id: 'x', start: 1, end: 3, lines: [''], startTick: 960, endTick: 3840 };
    // ticksPerPixel 10 → left round(96), width round(384) - 96 = 288.
    expect(controller.boxGeometry(a, 1024, 48000, 10)).toEqual({ left: 96, width: 288 });
    // Seconds-based data ignores ticksPerPixel (falls back to seconds math).
    const s = { id: 'y', start: 1, end: 3, lines: [''] };
    expect(controller.boxGeometry(s, 1024, 48000, 10)).toEqual(
      controller.boxGeometry(s, 1024, 48000)
    );
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/annotation-controller.test.ts`
Expected: FAIL — geometry computed from seconds.

- [ ] **Step 3: Implement**

Replace `boxGeometry` and thread the parameter:

```typescript
  /** Pixel geometry for one annotation box. Tick-based annotations in beats
   * mode use CLIP-IDENTICAL tick math (round(tick / ticksPerPixel)) so they
   * align pixel-exactly with <daw-grid>; everything else uses the floor-based
   * seconds math (temporal mode reads the always-fresh seconds cache). */
  boxGeometry(
    a: AnnotationData,
    spp: number,
    sampleRate: number,
    ticksPerPixel: number | null = null
  ): { left: number; width: number } {
    if (
      ticksPerPixel !== null &&
      ticksPerPixel > 0 &&
      a.startTick !== undefined &&
      a.endTick !== undefined
    ) {
      const left = Math.round(a.startTick / ticksPerPixel);
      const width = Math.round(a.endTick / ticksPerPixel) - left;
      return { left, width };
    }
    const left = Math.floor((a.start * sampleRate) / spp);
    const width = Math.floor((a.end * sampleRate) / spp) - left;
    return { left, width };
  }
```

`renderLanes` signature gains the 4th param and passes it to `boxGeometry`:

```typescript
  renderLanes(
    spp: number,
    sampleRate: number,
    onPointerDown: (e: PointerEvent, track: DawAnnotationTrackElement) => void = () => {},
    ticksPerPixel: number | null = null
  ): TemplateResult[] {
```

(inside: `const geo = this.boxGeometry(a, spp, sampleRate, ticksPerPixel);`)

`daw-editor.ts` render() — the single `renderLanes` call site becomes:

```typescript
            ${this._annotations.renderLanes(
              spp,
              this.effectiveSampleRate,
              this._annotationDrag.onPointerDown,
              this.scaleMode === 'beats' ? this.ticksPerPixel : null
            )}
```

- [ ] **Step 4: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/annotation-controller.test.ts src/__tests__/daw-editor-annotations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/controllers/annotation-controller.ts packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/annotation-controller.test.ts
git commit -m "feat(dawcore): beats-mode tick rendering for annotation lanes"
```

---

### Task 6: dawcore — tick-space keyboard boundary editing (`_moveBoundary` + `applyTickBoundaryResults`)

**Files:**
- Modify: `packages/dawcore/src/elements/daw-annotation-track.ts`
- Test: `packages/dawcore/src/__tests__/daw-annotation-track.test.ts` (append)

**Interfaces:**
- Consumes: core options param + tick constants (Task 1); element tick attrs (Task 2).
- Produces:
  - `AnnotationHostEditor` gains `_secondsToTicks(seconds: number): number`, `_ticksToSeconds(ticks: number): number`, `ppqn: number` (all exist on the editor).
  - Exported module-level `applyTickBoundaryResults(elements, before, after, ticksToSeconds)` — id-matched like `applyBoundaryResults`; for a tick-based target writes `startTick`/`endTick` = `Math.round(result)` when changed AND re-derives `start`/`end` via `ticksToSeconds`; for a seconds-based target writes `start`/`end` = `ticksToSeconds(result)` when the tick result changed. `before`/`after` carry TICK values in `start`/`end`.
  - `_moveBoundary`: when the ACTIVE annotation `isTickBased` → tick path: requires host editor (warn + no-op without); builds tick-space data for ALL siblings (tick-based → their ticks; seconds-based → `_secondsToTicks(seconds)`); delta = `_secondsToTicks(edgeSeconds + deltaMs/1000) − _secondsToTicks(edgeSeconds)` (edge's local tempo); runs core math with `{ linkThreshold: ANNOTATION_LINK_THRESHOLD_TICKS, minDuration: annotationMinDurationTicks(editor.ppqn) }` and duration = clamp === Infinity ? Infinity : `_secondsToTicks(clamp)`; writes via `applyTickBoundaryResults`. Seconds path unchanged.

- [ ] **Step 1: Write the failing tests** (append; build a fake editor parent with `Object.defineProperty`-stubbed `_annotationClampDuration` as the existing Infinity test does, plus plain function properties `_secondsToTicks = (s) => Math.round(s * 960)`, `_ticksToSeconds = (t) => t / 960`, `ppqn = 960` — 60 BPM math for round numbers)

```typescript
  it('moveEndBoundary on a tick annotation edits in tick space and re-derives seconds', async () => {
    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    Object.assign(editor, {
      _secondsToTicks: (s: number) => Math.round(s * 960),
      _ticksToSeconds: (t: number) => t / 960,
      ppqn: 960,
    });
    Object.defineProperty(editor, '_annotationClampDuration', { get: () => Infinity });
    const track2 = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track2.editable = true;
    track2.innerHTML =
      '<daw-annotation id="ta" start-tick="0" end-tick="960" start="0" end="1"></daw-annotation>';
    editor.appendChild(track2);
    await flush();
    track2.activeAnnotationId = 'ta';
    track2.moveEndBoundary(500); // +0.5s at 60 BPM = +480 ticks
    const el = track2.querySelector('#ta') as HTMLElement & {
      endTick: number | null;
      end: number;
    };
    expect(el.endTick).toBe(1440);
    expect(el.end).toBeCloseTo(1.5); // derived cache updated in the same write
    editor.remove();
  });

  it('tick min duration (ppqn/32) clamps tick-space nudges', async () => {
    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    Object.assign(editor, {
      _secondsToTicks: (s: number) => Math.round(s * 960),
      _ticksToSeconds: (t: number) => t / 960,
      ppqn: 960,
    });
    Object.defineProperty(editor, '_annotationClampDuration', { get: () => Infinity });
    const track2 = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track2.editable = true;
    track2.innerHTML =
      '<daw-annotation id="tb" start-tick="0" end-tick="960" start="0" end="1"></daw-annotation>';
    editor.appendChild(track2);
    await flush();
    track2.activeAnnotationId = 'tb';
    track2.moveStartBoundary(100000); // way past the end → clamps to end - 30 ticks
    const el = track2.querySelector('#tb') as HTMLElement & { startTick: number | null };
    expect(el.startTick).toBe(930);
    editor.remove();
  });

  it('mixed track: tick-space edit converts a seconds neighbor for link math and writes it back in seconds', async () => {
    const editor = document.createElement('daw-editor');
    document.body.appendChild(editor);
    Object.assign(editor, {
      _secondsToTicks: (s: number) => Math.round(s * 960),
      _ticksToSeconds: (t: number) => t / 960,
      ppqn: 960,
    });
    Object.defineProperty(editor, '_annotationClampDuration', { get: () => Infinity });
    const track2 = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track2.editable = true;
    track2.linkEndpoints = true;
    track2.innerHTML =
      '<daw-annotation id="sec" start="0" end="1">s</daw-annotation>' +
      '<daw-annotation id="tick" start-tick="960" end-tick="1920" start="1" end="2">t</daw-annotation>';
    editor.appendChild(track2);
    await flush();
    track2.activeAnnotationId = 'tick';
    track2.moveStartBoundary(-500); // tick.start 960→480; linked neighbor sec.end follows
    const tickEl = track2.querySelector('#tick') as HTMLElement & { startTick: number | null };
    const secEl = track2.querySelector('#sec') as HTMLElement & {
      end: number;
      startTick: number | null;
    };
    expect(tickEl.startTick).toBe(480);
    expect(secEl.end).toBeCloseTo(0.5); // written back in ITS unit (seconds)
    expect(secEl.startTick).toBeNull(); // never gained tick attrs
    editor.remove();
  });

  it('tick-based boundary edits without a host editor warn and no-op', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const track2 = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    track2.editable = true;
    track2.innerHTML =
      '<daw-annotation id="tc" start-tick="0" end-tick="960"></daw-annotation>';
    document.body.appendChild(track2);
    await flush();
    track2.activeAnnotationId = 'tc';
    track2.moveEndBoundary(100);
    const el = track2.querySelector('#tc') as HTMLElement & { endTick: number | null };
    expect(el.endTick).toBe(960);
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
    track2.remove();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation-track.test.ts`
Expected: FAIL — end edited in seconds space / tick attrs untouched.

- [ ] **Step 3: Implement**

Update imports in `daw-annotation-track.ts`:

```typescript
import {
  updateAnnotationBoundaries,
  resolveAnnotationShortcuts,
  matchesKeyBinding,
  ANNOTATION_LINK_THRESHOLD_TICKS,
  annotationMinDurationTicks,
} from '@waveform-playlist/core';
```

Extend the host interface:

```typescript
interface AnnotationHostEditor extends HTMLElement {
  play(startTime?: number, endTime?: number): Promise<void>;
  seekTo(time: number): void;
  _annotationClampDuration: number;
  _secondsToTicks(seconds: number): number;
  _ticksToSeconds(ticks: number): number;
  ppqn: number;
}
```

Add the tick write-back helper ABOVE the `@customElement` decorator, next to `applyBoundaryResults`:

```typescript
/**
 * Tick-space sibling of applyBoundaryResults: `before`/`after` carry TICK
 * values in start/end. Id-matched targets; a tick-based element gets rounded
 * integer ticks PLUS a re-derived seconds cache (single write pass keeps both
 * units coherent); a seconds-based element (converted in for mixed-track link
 * math) gets seconds back in ITS authoritative unit and never gains tick attrs.
 */
export function applyTickBoundaryResults(
  elements: DawAnnotationElement[],
  before: AnnotationData[],
  after: AnnotationData[],
  ticksToSeconds: (ticks: number) => number
): void {
  const byId = new Map(elements.map((el) => [el.annotationId, el]));
  after.forEach((next, i) => {
    const el = byId.get(next.id);
    if (!el) return;
    const startChanged = next.start !== before[i].start;
    const endChanged = next.end !== before[i].end;
    if (!startChanged && !endChanged) return;
    if (el.isTickBased) {
      if (startChanged) {
        const tick = Math.round(next.start);
        el.startTick = tick;
        el.start = ticksToSeconds(tick);
      }
      if (endChanged) {
        const tick = Math.round(next.end);
        el.endTick = tick;
        el.end = ticksToSeconds(tick);
      }
    } else {
      if (startChanged) el.start = ticksToSeconds(next.start);
      if (endChanged) el.end = ticksToSeconds(next.end);
    }
  });
}
```

Replace `_moveBoundary` with the branching version:

```typescript
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
    const active = elements[index];

    if (active.isTickBased) {
      const editor = this._hostEditor();
      if (!editor) {
        console.warn(
          '[dawcore] daw-annotation-track: tick-based boundary edits need a parent <daw-editor> for tempo conversion — call ignored'
        );
        return;
      }
      // Tick space: siblings converted in; ms delta converted at the edge's
      // local tempo (correct under variable-tempo callbacks).
      const tickData = elements.map((el) => tickSpaceData(el, editor));
      const edgeTick = isStart ? tickData[index].start : tickData[index].end;
      const edgeSeconds = editor._ticksToSeconds(edgeTick);
      const deltaTicks =
        editor._secondsToTicks(edgeSeconds + deltaMs / 1000) - editor._secondsToTicks(edgeSeconds);
      const clamp = this._timelineDuration();
      const updated = updateAnnotationBoundaries(
        {
          annotationIndex: index,
          newTime: edgeTick + deltaTicks,
          isDraggingStart: isStart,
          annotations: tickData,
          duration: clamp === Infinity ? Infinity : editor._secondsToTicks(clamp),
          linkEndpoints: this.linkEndpoints,
        },
        {
          linkThreshold: ANNOTATION_LINK_THRESHOLD_TICKS,
          minDuration: annotationMinDurationTicks(editor.ppqn),
        }
      );
      applyTickBoundaryResults(elements, tickData, updated, (t) => editor._ticksToSeconds(t));
      return;
    }

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
```

Add the shared mapping helper ABOVE the decorator (used by Task 7 too — export it):

```typescript
/** Map an annotation element into tick-space AnnotationData: tick-based
 * elements use their authoritative ticks; seconds-based neighbors are
 * converted so mixed-track link/collision math runs in one unit space. */
export function tickSpaceData(
  el: DawAnnotationElement,
  editor: { _secondsToTicks(seconds: number): number }
): AnnotationData {
  const base = el.toAnnotationData();
  if (el.isTickBased) {
    return { ...base, start: base.startTick as number, end: base.endTick as number };
  }
  return {
    ...base,
    start: editor._secondsToTicks(base.start),
    end: editor._secondsToTicks(base.end),
  };
}
```

(`AnnotationHostEditor` must also be exported now? No — `tickSpaceData` takes a minimal structural param; keep `AnnotationHostEditor` internal.)

- [ ] **Step 4: Run tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-annotation-track.test.ts src/__tests__/daw-annotation-track-keyboard.test.ts`
Expected: PASS (keyboard suite unchanged — `_runShortcutAction` still calls `moveStartBoundary(±10)`).

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-annotation-track.ts packages/dawcore/src/__tests__/daw-annotation-track.test.ts
git commit -m "feat(dawcore): tick-space keyboard boundary editing with mixed-track conversion"
```

---

### Task 7: dawcore — tick-space drag with snapTo

**Files:**
- Modify: `packages/dawcore/src/interactions/annotation-drag.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (only if the structural host needs no change — check; the editor already exposes every added host member)
- Test: `packages/dawcore/src/__tests__/annotation-drag.test.ts` (append)

**Interfaces:**
- Consumes: `tickSpaceData`, `applyTickBoundaryResults` (Task 6); `snapTickToGrid`, `SnapTo`, `MeterEntry`, tick constants (core).
- Produces: `AnnotationDragHost` gains `scaleMode: string; ticksPerPixel: number; snapTo: SnapTo; _meterEntries: MeterEntry[]; ppqn: number; _secondsToTicks(seconds: number): number; _ticksToSeconds(ticks: number): number;` (all already on the editor). DragState gains `mode: 'seconds' | 'ticks'`; tick drags: px→tick delta (`deltaPx * ticksPerPixel` in beats mode; temporal via seconds conversion at the edge), optional `snapTickToGrid` on the dragged edge (beats mode + snapTo ≠ 'off'), core math with tick options, `applyTickBoundaryResults` write-back; pointercancel restores through the same tick path.

- [ ] **Step 1: Write the failing tests** (append; extend the file's `makeHost()` with the new members — `scaleMode: 'beats'`, `ticksPerPixel: 10`, `snapTo: 'off'`, `_meterEntries: [{ startTick: 0, numerator: 4, denominator: 4 }]` — CHECK the real `MeterEntry` shape in `packages/core/src/utils/meterDetection.ts` and use its actual field names — `ppqn: 960`, `_secondsToTicks: (s) => Math.round(s * 960)`, `_ticksToSeconds: (t) => t / 960`; default `scaleMode: 'temporal'` for the existing tests per the dawcore mock convention — set `'beats'` per-test)

```typescript
  it('tick annotation drag edits ticks via beats-mode pixel math', async () => {
    host.scaleMode = 'beats';
    const tickTrack = document.createElement('daw-annotation-track') as DawAnnotationTrackElement;
    tickTrack.editable = true;
    tickTrack.innerHTML =
      '<daw-annotation id="ta" start-tick="0" end-tick="960" start="0" end="1">A</daw-annotation>';
    document.body.appendChild(tickTrack);
    await flush();
    const lane2 = document.createElement('div');
    lane2.innerHTML =
      '<div class="annotation-box" data-annotation-id="ta">' +
      '<div class="annotation-boundary" data-edge="end"></div></div>';
    document.body.appendChild(lane2);
    const boundary = lane2.querySelector('.annotation-boundary') as HTMLElement;
    boundary.setPointerCapture = vi.fn();
    boundary.releasePointerCapture = vi.fn();

    handler.onPointerDown(fakePointer(boundary, 96), tickTrack); // end at 960/10=96px
    handler._onPointerMove(fakePointer(boundary, 144)); // +48px × 10 = +480 ticks
    const el = tickTrack.querySelector('#ta') as HTMLElement & {
      endTick: number | null;
      end: number;
    };
    expect(el.endTick).toBe(1440);
    expect(el.end).toBeCloseTo(1.5); // seconds cache re-derived
    handler._onPointerUp(fakePointer(boundary, 144));
    tickTrack.remove();
    lane2.remove();
  });

  it('snapTo snaps the dragged tick edge to the grid', async () => {
    host.scaleMode = 'beats';
    host.snapTo = 'beat';
    // …same setup as above…
    handler.onPointerDown(fakePointer(boundary, 96), tickTrack);
    handler._onPointerMove(fakePointer(boundary, 141)); // raw 1410 ticks → snaps to 1440 (beat = 960? verify: beat at ppqn 960 = 960 ticks → nearest beat to 1410 is 960 or 1920…)
    const el = tickTrack.querySelector('#ta') as HTMLElement & { endTick: number | null };
    // ENCODE THE ACTUAL snapTickToGrid RESULT: read packages/core/src/utils/musicalTicks.ts
    // snapTickToGrid semantics for snapTo='beat' at ppqn 960 and assert exactly that.
    expect(el.endTick).toBe(960); // 1410 is nearer 960 than 1920 — VERIFY against the real function before finalizing
    handler._onPointerUp(fakePointer(boundary, 141));
  });

  it('pointercancel restores tick snapshot in both units', async () => {
    host.scaleMode = 'beats';
    // …same setup…
    handler.onPointerDown(fakePointer(boundary, 96), tickTrack);
    handler._onPointerMove(fakePointer(boundary, 200));
    handler._onPointerCancel(fakePointer(boundary, 200));
    const el = tickTrack.querySelector('#ta') as HTMLElement & {
      endTick: number | null;
      end: number;
    };
    expect(el.endTick).toBe(960);
    expect(el.end).toBeCloseTo(1);
  });
```

Write the second and third tests in FULL (repeat the setup — no "same as above" in the actual test file). For the snap assertion: hand-verify `snapTickToGrid(1410, 'beat', meterEntries, 960)` by reading the core function and encode its true output.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/dawcore && npx vitest run src/__tests__/annotation-drag.test.ts`
Expected: FAIL — tick attrs untouched by drag.

- [ ] **Step 3: Implement**

New imports:

```typescript
import { updateAnnotationBoundaries, snapTickToGrid } from '@waveform-playlist/core';
import {
  ANNOTATION_LINK_THRESHOLD_TICKS,
  annotationMinDurationTicks,
} from '@waveform-playlist/core';
import type { AnnotationData, SnapTo, MeterEntry } from '@waveform-playlist/core';
import {
  applyBoundaryResults,
  applyTickBoundaryResults,
  tickSpaceData,
  type DawAnnotationTrackElement,
} from '../elements/daw-annotation-track';
```

Host interface:

```typescript
export interface AnnotationDragHost {
  effectiveSampleRate: number;
  _renderSpp: number;
  _annotationClampDuration: number;
  seekTo(time: number): void;
  scaleMode: string;
  ticksPerPixel: number;
  snapTo: SnapTo;
  _meterEntries: MeterEntry[];
  ppqn: number;
  _secondsToTicks(seconds: number): number;
  _ticksToSeconds(ticks: number): number;
}
```

Add `mode: 'seconds' | 'ticks';` to the `DragState` interface. In `onPointerDown`, replace the snapshot/drag construction block (from `const snapshot = track.annotations;` through the `this._drag = { … };` assignment) with:

```typescript
    const elements = track.annotationElements;
    const el = elements.find((x) => x.annotationId === annotationId);
    if (!el) return;
    const mode: 'seconds' | 'ticks' = el.isTickBased ? 'ticks' : 'seconds';
    const snapshot =
      mode === 'ticks'
        ? elements.map((x) => tickSpaceData(x, this._host))
        : track.annotations;
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
      mode,
      snapshot,
      edgeTime: edge === 'start' ? snapshot[index].start : snapshot[index].end,
    };
```

(`edgeTime` now holds ticks in tick mode — rename NOT needed; comment it.) Replace `_onPointerMove`'s math section:

```typescript
    const elements = drag.track.annotationElements;
    const index = drag.snapshot.findIndex((a) => a.id === drag.annotationId);
    if (index === -1) return;

    if (drag.mode === 'ticks') {
      // px → tick delta: beats mode is tick-linear; temporal mode converts
      // through seconds at the edge's local tempo.
      const deltaTicks =
        this._host.scaleMode === 'beats'
          ? deltaPx * this._host.ticksPerPixel
          : this._host._secondsToTicks(
              this._host._ticksToSeconds(drag.edgeTime) +
                (deltaPx * this._host._renderSpp) / this._host.effectiveSampleRate
            ) - drag.edgeTime;
      let newTick = drag.edgeTime + deltaTicks;
      if (this._host.scaleMode === 'beats' && this._host.snapTo !== 'off') {
        newTick = snapTickToGrid(
          newTick,
          this._host.snapTo,
          this._host._meterEntries,
          this._host.ppqn
        );
      }
      const clamp = this._host._annotationClampDuration;
      const updated = updateAnnotationBoundaries(
        {
          annotationIndex: index,
          newTime: newTick,
          isDraggingStart: drag.edge === 'start',
          annotations: drag.snapshot,
          duration: clamp === Infinity ? Infinity : this._host._secondsToTicks(clamp),
          linkEndpoints: drag.track.linkEndpoints,
        },
        {
          linkThreshold: ANNOTATION_LINK_THRESHOLD_TICKS,
          minDuration: annotationMinDurationTicks(this._host.ppqn),
        }
      );
      applyTickBoundaryResults(
        elements,
        elements.map((x) => tickSpaceData(x, this._host)),
        updated,
        (t) => this._host._ticksToSeconds(t)
      );
      return;
    }

    const deltaSeconds = (deltaPx * this._host._renderSpp) / this._host.effectiveSampleRate;
    // …existing seconds path unchanged…
```

And `_onPointerCancel` restores through the mode's path:

```typescript
    const elements = drag.track.annotationElements;
    if (drag.mode === 'ticks') {
      applyTickBoundaryResults(
        elements,
        elements.map((x) => tickSpaceData(x, this._host)),
        drag.snapshot,
        (t) => this._host._ticksToSeconds(t)
      );
    } else {
      applyBoundaryResults(
        elements,
        elements.map((el) => el.toAnnotationData()),
        drag.snapshot
      );
    }
    this._teardown();
```

Editor: no changes expected — verify it structurally satisfies the widened host (all members exist: `scaleMode`, `ticksPerPixel`, `snapTo`, `_meterEntries` getter, `ppqn`, `_secondsToTicks`, `_ticksToSeconds`). If any is `private`, remove `private` (keep the underscore prefix), matching the established non-private host-field convention.

- [ ] **Step 4: Run tests + full dawcore suite**

Run: `cd packages/dawcore && npx vitest run src/__tests__/annotation-drag.test.ts` then `npx vitest run` (full suite; then `pkill -f vitest`).
Expected: PASS everywhere.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/interactions/annotation-drag.ts packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/annotation-drag.test.ts
git commit -m "feat(dawcore): tick-space annotation drags with snapTo grid snapping"
```

---

### Task 8: Demos — beats-grid tick regions + sonnet.html + listings

**Files:**
- Modify: `examples/dawcore-native/beats-grid.html` (region track)
- Create: `examples/dawcore-native/sonnet.html`
- Modify: `examples/dawcore-native/index.html` + `README.md` (sonnet entry)

- [ ] **Step 1: beats-grid.html** — inside its `<daw-editor …scale-mode="beats"…>` add as the FIRST child (read the file first; match its indentation and existing attributes — do not touch anything else):

```html
    <daw-annotation-track id="sections" editable link-endpoints box-label="none">
      <daw-annotation start-tick="0" end-tick="7680"></daw-annotation>
      <daw-annotation start-tick="7680" end-tick="15360"></daw-annotation>
      <daw-annotation start-tick="15360" end-tick="23040"></daw-annotation>
    </daw-annotation-track>
```

(At ppqn 960 and 4/4, one bar = 3840 ticks → three 2-bar label-less regions, bar-aligned. NO `<daw-annotation-list>` — data-only marking.) If the page has a hint/description area, add one line: "Bar-aligned annotation regions (tick-based, label-less) — drag edges with snap".

- [ ] **Step 2: sonnet.html** — new page modeled on `annotations.html`'s skeleton (same `<style>` palette, `<script type="module">import '@dawcore/components';</script>`, adapter wiring with `new NativePlayoutAdapter(new AudioContext({ sampleRate: 48000, latencyHint: 0 }))`). Body structure:

```html
  <h1>dawcore — Sonnet 18 (annotations parity demo)</h1>

  <daw-editor id="editor" samples-per-pixel="1024" wave-height="100" timescale>
    <daw-annotation-track id="sonnet" editable link-endpoints keyboard-controls box-label="id">
    </daw-annotation-track>
    <daw-track src="/media/audio/sonnet.mp3" name="Sonnet 18"></daw-track>
  </daw-editor>

  <daw-transport for="editor">
    <daw-play-button></daw-play-button>
    <daw-pause-button></daw-pause-button>
    <daw-stop-button></daw-stop-button>
    <daw-time-display></daw-time-display>
  </daw-transport>

  <daw-annotation-list for="sonnet"></daw-annotation-list>

  <p class="hint">
    Recreates the classic React annotations example: aeneas ids in the bars,
    full lines in the list. Arrows navigate, Enter plays a line, [ ] / { }
    nudge boundaries, Escape deselects. Text is editable in the list.
  </p>

  <script type="module">
    // Aeneas alignment data — copied verbatim from the React example
    // (website/src/components/examples/AnnotationsExample.tsx, defaultNotes).
    const notes = [ /* COPY the full defaultNotes array from AnnotationsExample.tsx:41 */ ];
    const track = document.getElementById('sonnet');
    for (const note of notes) {
      const a = document.createElement('daw-annotation');
      a.id = note.id;
      a.setAttribute('start', note.begin);
      a.setAttribute('end', note.end);
      a.textContent = note.lines.join('\n');
      track.appendChild(a);
    }
  </script>
```

Copy the ACTUAL `defaultNotes` array contents (all entries, verbatim — objects with `begin`, `end`, `id`, `language`, `lines` string fields) into the `notes` literal. Verify the field names against the source before copying (they are aeneas-format: begin/end as STRINGS — `setAttribute` handles them; Lit's Number converter parses).

- [ ] **Step 3: Listings** — `examples/dawcore-native/index.html`: add after the annotations entry:

```html
    <li>
      <a href="sonnet.html">sonnet</a>
      <div class="desc">Sonnet 18 — aeneas ids in the bars, full lines in the list (React example parity)</div>
    </li>
```

`README.md`: one line in the dawcore-native list matching the existing format: `- [\`sonnet.html\`](examples/dawcore-native/sonnet.html) — Sonnet 18 parity demo: box-label="id" bars with the full text in <daw-annotation-list>`. Also extend the existing `beats-grid.html` README line mentioning the new tick-based annotation regions.

- [ ] **Step 4: Commit** (examples are outside lint scope — hand-format to match; no prettier on the HTML)

```bash
git add examples/dawcore-native/beats-grid.html examples/dawcore-native/sonnet.html examples/dawcore-native/index.html README.md
git commit -m "feat(examples): sonnet parity demo and beats-grid tick annotation regions"
```

---

### Task 9: Real-browser verification (beats-mode ticks + sonnet)

No new source files — fix-what-you-find task (any fix follows the touched file's conventions, with its covering vitest file re-run, included in this task's commit and documented).

- [ ] **Step 1:** Start the dev server in the background: `pnpm example:dawcore-native --port 5221` (no `--` separator; READ the startup log for the actual port + cwd). Use headless Playwright MCP (ToolSearch if deferred); real mouse input for drags; rAF-independent assertions; absolute /private/tmp paths for screenshots; delete stray artifacts before committing.

- [ ] **Step 2: beats-grid page** — verify:
1. Three label-less region bars render, edges pixel-aligned with `<daw-grid>` bar lines (sample `el.style.left` of a box vs the grid's bar pixel positions — both derive from ticksPerPixel).
2. With the page's snap setting active (check what snapTo the page sets; set `editor.snapTo = 'beat'` via evaluate if it defaults off), drag a region's end edge a few pixels → it lands exactly on a beat multiple (`endTick % 960 === 0` via evaluate on the element).
3. Change BPM (`editor.bpm = <different value>` via evaluate) → region elements' `startTick` values UNCHANGED and seconds attributes changed (evaluate) — musical authority proof.
4. Console: no errors, no Lit update-after-update warning (the derive sweep runs on statechange — this is the highest-risk check).

- [ ] **Step 3: sonnet page** — verify:
1. Bars show the aeneas ids ("1", "2", …), list shows full lines with times.
2. Click list row 3 → box 3 highlights + playhead seeks; Enter plays the line and STOPS at its end.
3. Edit a line's text in the list, blur → `<daw-annotation>` textContent updated.
4. Drag a boundary with link-endpoints → both bars and both list rows update.
5. Console clean (as above).

- [ ] **Step 4:** Kill the dev server (confirm the port is yours). Commit any fixes made:

```bash
git add -u
git commit -m "fix(dawcore): browser-verification fixes for tick annotations"
```

(Skip the commit if verification found nothing to fix.)

---

### Task 10: Docs, changesets, full verification

**Files:**
- Modify: `docs/specs/web-components-migration.md`, `packages/dawcore/COMPONENTS.md`, `packages/dawcore/CLAUDE.md`
- Create: `.changeset/annotation-ticks-core.md`, `.changeset/annotation-ticks-dawcore.md`

- [ ] **Step 1: Docs.** Migration spec: `<daw-annotation>` attribute table gains `start-tick`/`end-tick` (+ authority rule sentence); `<daw-annotation-track>` table gains `box-label` (`text`|`id`|`none`, default `text`); boundary-constraints note gains the tick min duration (ppqn/32) + snapTo behavior; NARROW the lane-drift limitation to seconds-based annotations only; note tick edits require a host editor and BPM re-derivation happens on engine statechange (variable-tempo tempo-map edits outside statechange re-derive on the next annotation update — documented nuance). COMPONENTS.md: same table additions. dawcore CLAUDE.md: dual-timebase gotcha entry (mirror of clip startTick; seconds = derived cache swept by AnnotationController; write-only-on-change loop safety; `applyTickBoundaryResults` single-write-pass coherence).

- [ ] **Step 2: Changesets** (both patch):

`.changeset/annotation-ticks-core.md`:

```md
---
'@waveform-playlist/core': patch
---

updateAnnotationBoundaries accepts unit options (linkThreshold/minDuration); tick constants (ANNOTATION_LINK_THRESHOLD_TICKS, annotationMinDurationTicks); AnnotationData optional startTick/endTick
```

`.changeset/annotation-ticks-dawcore.md`:

```md
---
'@dawcore/components': patch
---

Annotation tick positions (start-tick/end-tick, authoritative like clip startTick, seconds derived by the editor incl. BPM changes), snapTo-aware tick drags, beats-mode grid-exact lane rendering, box-label lane modes (text/id/none), contractual blank-text and list-less support
```

- [ ] **Step 3: Full verification sweep**

```bash
pnpm --filter @waveform-playlist/core build
pnpm build
pnpm typecheck        # first-fail: after any fix, re-run the FULL sweep
pnpm -w lint          # exit 0 AND "0 errors" in the ✖ summary
cd packages/core && npx vitest run && cd ../..
cd packages/annotations && npx vitest run && cd ../..
cd packages/dawcore && npx vitest run && cd ../..
pkill -f vitest || true
```

Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add docs/specs/web-components-migration.md packages/dawcore/COMPONENTS.md packages/dawcore/CLAUDE.md .changeset/
git commit -m "docs: annotation tick positions + box-label spec/status updates + changesets"
```

---

### Task 11: Finish — PR

- [ ] **Step 1: Remove working documents**

```bash
git rm docs/specs/2026-07-11-annotation-ticks-design.md docs/plans/2026-07-11-annotation-ticks.md
git commit -m "chore: remove working design/plan docs for annotation ticks"
```

- [ ] **Step 2: Push and open the PR**

```bash
git push -u origin feature/annotation-ticks
```

PR body: architecture summary (dual-timebase mirror of clips, editor-owned seconds derivation, tick-native shared boundary math, box-label modes, sonnet parity), test plan (unit + browser evidence), demo pointers. No `closes` keyword (no dedicated issue — reference the #455 epic as follow-on work). **Do not merge** — user approval required, then squash-merge.
