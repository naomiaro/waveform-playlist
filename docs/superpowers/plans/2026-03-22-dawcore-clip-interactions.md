# Dawcore Clip Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add move, trim, and split clip interactions to `<daw-editor>` web component, wired to the existing engine operations.

**Architecture:** Extend the pointer handler with clip hit detection (DOM-based via `data-*` attributes). New `ClipPointerHandler` class handles move/trim drag loops. Split via keyboard shortcut and public method. All features gated behind `interactive-clips` boolean attribute.

**Tech Stack:** Lit 3.x, TypeScript, `@waveform-playlist/engine` (existing `moveClip`/`trimClip`/`splitClip`), vitest + happy-dom

**Spec:** `docs/superpowers/specs/2026-03-22-dawcore-clip-interactions-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `packages/dawcore/src/interactions/clip-pointer-handler.ts` | `ClipPointerHandler` class — move/trim drag logic, clip hit detection |
| `packages/dawcore/src/interactions/constants.ts` | Shared constants (`DRAG_THRESHOLD`, `BOUNDARY_WIDTH`) |
| `packages/dawcore/src/__tests__/clip-pointer-handler.test.ts` | Unit tests for move/trim drag and hit detection |
| `packages/dawcore/src/__tests__/daw-editor-clip-interactions.test.ts` | Integration tests for attributes, split, events |
| `packages/dawcore/src/interactions/split-handler.ts` | `splitAtPlayhead()` function — split logic extracted for testability |

### Modified Files

| File | Changes |
|------|---------|
| `packages/dawcore/src/events.ts` | Add `DawClipMoveDetail`, `DawClipTrimDetail`, `DawClipSplitDetail` interfaces + event map entries |
| `packages/dawcore/src/interactions/pointer-handler.ts` | Import `DRAG_THRESHOLD` from constants, delegate clip targets to `ClipPointerHandler` |
| `packages/dawcore/src/styles/theme.ts` | Add `.clip-boundary` styles |
| `packages/dawcore/src/elements/daw-editor.ts` | New attributes, `splitAtPlayhead()`, keyboard listener, boundary rendering, clip handler wiring |

---

## Task 1: Add Clip Event Types to `events.ts`

**Files:**
- Modify: `packages/dawcore/src/events.ts`

- [ ] **Step 1: Add detail interfaces and event map entries**

Add after the `DawRecordingErrorDetail` interface (line 70) and before the event map:

```typescript
export interface DawClipMoveDetail {
  trackId: string;
  clipId: string;
  deltaSamples: number;
}

export interface DawClipTrimDetail {
  trackId: string;
  clipId: string;
  boundary: 'left' | 'right';
  deltaSamples: number;
}

export interface DawClipSplitDetail {
  trackId: string;
  originalClipId: string;
  leftClipId: string;
  rightClipId: string;
}
```

Add to the `DawEventMap` interface (after line 93):

```typescript
'daw-clip-move': CustomEvent<DawClipMoveDetail>;
'daw-clip-trim': CustomEvent<DawClipTrimDetail>;
'daw-clip-split': CustomEvent<DawClipSplitDetail>;
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS — no type errors

- [ ] **Step 3: Commit**

```bash
git add packages/dawcore/src/events.ts
git commit -m "feat(dawcore): add clip move, trim, split event types"
```

---

## Task 2: Extract Shared Constants

**Files:**
- Create: `packages/dawcore/src/interactions/constants.ts`
- Modify: `packages/dawcore/src/interactions/pointer-handler.ts`

- [ ] **Step 1: Create constants file**

```typescript
/** Minimum pixel movement before a drag is activated (click vs drag). */
export const DRAG_THRESHOLD = 3;

/** Width in pixels of the trim boundary hit zone at clip edges. */
export const BOUNDARY_WIDTH = 8;
```

- [ ] **Step 2: Update pointer-handler.ts to use shared constant**

Replace the hardcoded `3` on line 71 of `pointer-handler.ts`:

```typescript
// Before:
if (!this._isDragging && Math.abs(currentPx - this._dragStartPx) > 3) {

// After:
import { DRAG_THRESHOLD } from './constants';
// ...
if (!this._isDragging && Math.abs(currentPx - this._dragStartPx) > DRAG_THRESHOLD) {
```

- [ ] **Step 3: Run existing pointer handler tests to verify no regression**

Run: `cd packages/dawcore && npx vitest run src/__tests__/pointer-handler.test.ts`
Expected: All 53 tests PASS

- [ ] **Step 4: Commit**

```bash
git add packages/dawcore/src/interactions/constants.ts packages/dawcore/src/interactions/pointer-handler.ts
git commit -m "refactor(dawcore): extract drag threshold to shared constant"
```

---

## Task 3: Add Clip Boundary Styles to Theme

**Files:**
- Modify: `packages/dawcore/src/styles/theme.ts`

- [ ] **Step 1: Add boundary styles after existing `clipStyles`**

Add inside the `clipStyles` template literal (after the `.clip-header span` block, before the closing backtick on line 53):

```css
.clip-boundary {
  position: absolute;
  top: 0;
  width: 8px;
  height: 100%;
  z-index: 2;
  cursor: col-resize;
  background: transparent;
  border: none;
  touch-action: none;
  transition: background 0.1s, border-color 0.1s;
}
.clip-boundary[data-boundary-edge='left'] {
  left: 0;
}
.clip-boundary[data-boundary-edge='right'] {
  right: 0;
}
.clip-boundary:hover {
  background: rgba(255, 255, 255, 0.2);
  border-left: 2px solid rgba(255, 255, 255, 0.5);
}
.clip-boundary[data-boundary-edge='left']:hover {
  border-left: none;
  border-right: 2px solid rgba(255, 255, 255, 0.5);
}
.clip-boundary.dragging {
  background: rgba(255, 255, 255, 0.4);
  border-left: 2px solid rgba(255, 255, 255, 0.8);
}
.clip-boundary[data-boundary-edge='left'].dragging {
  border-left: none;
  border-right: 2px solid rgba(255, 255, 255, 0.8);
}
```

Also add grab cursor to `.clip-header` when interactive:

```css
.clip-header[data-interactive] {
  cursor: grab;
}
.clip-header[data-interactive]:active {
  cursor: grabbing;
}
```

- [ ] **Step 2: Verify typecheck passes**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add packages/dawcore/src/styles/theme.ts
git commit -m "feat(dawcore): add clip boundary and interactive header styles"
```

---

## Task 4: Implement `ClipPointerHandler` — Tests First

**Files:**
- Create: `packages/dawcore/src/__tests__/clip-pointer-handler.test.ts`
- Create: `packages/dawcore/src/interactions/clip-pointer-handler.ts`

### Step 4a: Write failing tests for hit detection and move drag

- [ ] **Step 1: Write test file with hit detection and move tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClipPointerHandler } from '../interactions/clip-pointer-handler';
import type { ClipPointerHost } from '../interactions/clip-pointer-handler';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface MockEngine {
  moveClip: ReturnType<typeof vi.fn>;
  trimClip: ReturnType<typeof vi.fn>;
}

function createMockEngine(): MockEngine {
  return {
    moveClip: vi.fn(),
    trimClip: vi.fn(),
  };
}

function createMockHost(
  engine: MockEngine | null = null,
  overrides: Partial<ClipPointerHost> = {}
): ClipPointerHost & { events: Event[] } {
  const events: Event[] = [];
  return {
    samplesPerPixel: 1024,
    effectiveSampleRate: 48000,
    interactiveClips: true,
    engine: engine as ClipPointerHost['engine'],
    dispatchEvent: vi.fn((event: Event) => {
      events.push(event);
      return true;
    }),
    requestUpdate: vi.fn(),
    events,
    ...overrides,
  };
}

function pointerEvent(
  type: string,
  opts: { clientX?: number; clientY?: number; pointerId?: number } = {}
): PointerEvent {
  return new PointerEvent(type, {
    clientX: opts.clientX ?? 0,
    clientY: opts.clientY ?? 0,
    pointerId: opts.pointerId ?? 1,
    bubbles: true,
  });
}

function makeClipEl(
  clipId: string,
  trackId: string,
  rect: Partial<DOMRect> = {}
): HTMLElement {
  const el = document.createElement('div');
  el.classList.add('clip-header');
  el.dataset.clipId = clipId;
  el.dataset.trackId = trackId;
  el.setAttribute('data-interactive', '');
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: 100, right: 300, top: 0, bottom: 22, width: 200, height: 22,
    x: 100, y: 0, toJSON: () => ({}),
    ...rect,
  });
  return el;
}

function makeBoundaryEl(
  clipId: string,
  trackId: string,
  edge: 'left' | 'right',
  rect: Partial<DOMRect> = {}
): HTMLElement {
  const el = document.createElement('div');
  el.classList.add('clip-boundary');
  el.dataset.boundaryEdge = edge;
  el.dataset.clipId = clipId;
  el.dataset.trackId = trackId;
  vi.spyOn(el, 'getBoundingClientRect').mockReturnValue({
    left: edge === 'left' ? 100 : 292,
    right: edge === 'left' ? 108 : 300,
    top: 0, bottom: 82, width: 8, height: 82,
    x: edge === 'left' ? 100 : 292, y: 0, toJSON: () => ({}),
    ...rect,
  });
  return el;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ClipPointerHandler', () => {
  describe('tryHandle', () => {
    it('returns false when interactiveClips is disabled', () => {
      const host = createMockHost(null, { interactiveClips: false });
      const handler = new ClipPointerHandler(host);
      const el = makeClipEl('clip-1', 'track-1');
      expect(handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 150 }))).toBe(false);
    });

    it('returns true for clip header target', () => {
      const engine = createMockEngine();
      const host = createMockHost(engine);
      const handler = new ClipPointerHandler(host);
      const el = makeClipEl('clip-1', 'track-1');
      expect(handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 150 }))).toBe(true);
    });

    it('returns true for boundary target', () => {
      const engine = createMockEngine();
      const host = createMockHost(engine);
      const handler = new ClipPointerHandler(host);
      const el = makeBoundaryEl('clip-1', 'track-1', 'left');
      expect(handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 104 }))).toBe(true);
    });

    it('returns false for non-clip elements', () => {
      const engine = createMockEngine();
      const host = createMockHost(engine);
      const handler = new ClipPointerHandler(host);
      const el = document.createElement('div');
      expect(handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 50 }))).toBe(false);
    });
  });

  describe('move drag', () => {
    it('calls engine.moveClip with sample delta on drag completion', () => {
      const engine = createMockEngine();
      const host = createMockHost(engine);
      const handler = new ClipPointerHandler(host);
      const el = makeClipEl('clip-1', 'track-1');

      // Simulate pointerdown on header
      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 150 }));

      // Move 10px right (exceeds threshold)
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 160 }));

      // Complete drag
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 160 }));

      // 10px * 1024 spp = 10240 samples
      expect(engine.moveClip).toHaveBeenCalledWith('track-1', 'clip-1', 10240);
    });

    it('does not call engine.moveClip if movement is within threshold', () => {
      const engine = createMockEngine();
      const host = createMockHost(engine);
      const handler = new ClipPointerHandler(host);
      const el = makeClipEl('clip-1', 'track-1');

      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 150 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 152 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 152 }));

      expect(engine.moveClip).not.toHaveBeenCalled();
    });

    it('dispatches daw-clip-move event after successful move', () => {
      const engine = createMockEngine();
      const host = createMockHost(engine);
      const handler = new ClipPointerHandler(host);
      const el = makeClipEl('clip-1', 'track-1');

      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 150 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 170 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 170 }));

      const moveEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-clip-move'
      ) as CustomEvent;
      expect(moveEvent).toBeDefined();
      expect(moveEvent.detail.clipId).toBe('clip-1');
      expect(moveEvent.detail.trackId).toBe('track-1');
    });
  });

  describe('trim drag', () => {
    it('calls engine.trimClip with left boundary and sample delta', () => {
      const engine = createMockEngine();
      const host = createMockHost(engine);
      const handler = new ClipPointerHandler(host);
      const el = makeBoundaryEl('clip-1', 'track-1', 'left');

      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 104 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 114 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 114 }));

      expect(engine.trimClip).toHaveBeenCalledWith('track-1', 'clip-1', 'left', 10240);
    });

    it('calls engine.trimClip with right boundary and sample delta', () => {
      const engine = createMockEngine();
      const host = createMockHost(engine);
      const handler = new ClipPointerHandler(host);
      const el = makeBoundaryEl('clip-1', 'track-1', 'right');

      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 296 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 306 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 306 }));

      expect(engine.trimClip).toHaveBeenCalledWith('track-1', 'clip-1', 'right', 10240);
    });

    it('dispatches daw-clip-trim event after successful trim', () => {
      const engine = createMockEngine();
      const host = createMockHost(engine);
      const handler = new ClipPointerHandler(host);
      const el = makeBoundaryEl('clip-1', 'track-1', 'right');

      handler.tryHandle(el, pointerEvent('pointerdown', { clientX: 296 }));
      handler.onPointerMove(pointerEvent('pointermove', { clientX: 316 }));
      handler.onPointerUp(pointerEvent('pointerup', { clientX: 316 }));

      const trimEvent = host.events.find(
        (e) => (e as CustomEvent).type === 'daw-clip-trim'
      ) as CustomEvent;
      expect(trimEvent).toBeDefined();
      expect(trimEvent.detail.boundary).toBe('right');
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/clip-pointer-handler.test.ts`
Expected: FAIL — `ClipPointerHandler` does not exist yet

### Step 4b: Implement `ClipPointerHandler`

- [ ] **Step 3: Create the implementation**

```typescript
import { DRAG_THRESHOLD, BOUNDARY_WIDTH } from './constants';

/** Narrow engine contract for clip interactions. */
export interface ClipEngineContract {
  moveClip(trackId: string, clipId: string, deltaSamples: number, skipAdapter?: boolean): void;
  trimClip(
    trackId: string,
    clipId: string,
    boundary: 'left' | 'right',
    deltaSamples: number,
    skipAdapter?: boolean
  ): void;
}

/** Host interface for clip pointer handler. */
export interface ClipPointerHost {
  readonly samplesPerPixel: number;
  readonly effectiveSampleRate: number;
  readonly interactiveClips: boolean;
  readonly engine: ClipEngineContract | null;
  dispatchEvent(event: Event): boolean;
  requestUpdate(): void;
}

type DragMode = 'move' | 'trim-left' | 'trim-right';

export class ClipPointerHandler {
  private _host: ClipPointerHost;
  private _mode: DragMode | null = null;
  private _clipId = '';
  private _trackId = '';
  private _startPx = 0;
  private _isDragging = false;
  private _lastDeltaPx = 0;
  private _cumulativeDeltaSamples = 0;

  constructor(host: ClipPointerHost) {
    this._host = host;
  }

  /**
   * Attempt to handle a pointerdown on the given target element.
   * Returns true if the target is a clip header or boundary (and handler takes over),
   * false if it's not a clip interaction target.
   */
  tryHandle(target: Element, e: PointerEvent): boolean {
    if (!this._host.interactiveClips) return false;

    // Check for boundary edge first (higher priority — overlaps header at corners)
    if (target.classList.contains('clip-boundary')) {
      const edge = (target as HTMLElement).dataset.boundaryEdge as 'left' | 'right' | undefined;
      const clipId = (target as HTMLElement).dataset.clipId;
      const trackId = (target as HTMLElement).dataset.trackId;
      if (edge && clipId && trackId) {
        this._beginDrag(edge === 'left' ? 'trim-left' : 'trim-right', clipId, trackId, e);
        return true;
      }
    }

    // Check for clip header
    if (target.classList.contains('clip-header') && (target as HTMLElement).hasAttribute('data-interactive')) {
      const clipId = (target as HTMLElement).dataset.clipId;
      const trackId = (target as HTMLElement).dataset.trackId;
      if (clipId && trackId) {
        this._beginDrag('move', clipId, trackId, e);
        return true;
      }
    }

    return false;
  }

  private _beginDrag(mode: DragMode, clipId: string, trackId: string, e: PointerEvent): void {
    this._mode = mode;
    this._clipId = clipId;
    this._trackId = trackId;
    this._startPx = e.clientX;
    this._isDragging = false;
    this._lastDeltaPx = 0;
    this._cumulativeDeltaSamples = 0;
  }

  onPointerMove(e: PointerEvent): void {
    if (!this._mode) return;

    const deltaPx = e.clientX - this._startPx;

    if (!this._isDragging && Math.abs(deltaPx) > DRAG_THRESHOLD) {
      this._isDragging = true;
    }

    if (!this._isDragging) return;

    const incrementalPx = deltaPx - this._lastDeltaPx;
    this._lastDeltaPx = deltaPx;
    const incrementalSamples = Math.round(incrementalPx * this._host.samplesPerPixel);

    if (incrementalSamples === 0) return;

    this._cumulativeDeltaSamples += incrementalSamples;
    const engine = this._host.engine;
    if (!engine) return;

    if (this._mode === 'move') {
      engine.moveClip(this._trackId, this._clipId, incrementalSamples, true);
    } else {
      const boundary = this._mode === 'trim-left' ? 'left' : 'right';
      engine.trimClip(this._trackId, this._clipId, boundary, incrementalSamples);
    }
  }

  onPointerUp(e: PointerEvent): void {
    if (!this._mode) return;

    try {
      if (this._isDragging && this._cumulativeDeltaSamples !== 0) {
        this._dispatchResult();
      }
    } finally {
      this._mode = null;
      this._isDragging = false;
      this._clipId = '';
      this._trackId = '';
      this._lastDeltaPx = 0;
      this._cumulativeDeltaSamples = 0;
    }
  }

  /** Whether this handler is currently tracking a drag. */
  get isActive(): boolean {
    return this._mode !== null;
  }

  private _dispatchResult(): void {
    const h = this._host;

    if (this._mode === 'move') {
      h.dispatchEvent(
        new CustomEvent('daw-clip-move', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: this._trackId,
            clipId: this._clipId,
            // Cumulative delta lets consumers compute before/after positions
            deltaSamples: this._cumulativeDeltaSamples,
          },
        })
      );
    } else {
      h.dispatchEvent(
        new CustomEvent('daw-clip-trim', {
          bubbles: true,
          composed: true,
          detail: {
            trackId: this._trackId,
            clipId: this._clipId,
            boundary: this._mode === 'trim-left' ? 'left' : 'right',
            deltaSamples: this._cumulativeDeltaSamples,
          },
        })
      );
    }
    h.requestUpdate();
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/clip-pointer-handler.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/interactions/clip-pointer-handler.ts packages/dawcore/src/__tests__/clip-pointer-handler.test.ts
git commit -m "feat(dawcore): add ClipPointerHandler with move and trim drag"
```

---

## Task 5: Wire `ClipPointerHandler` into `PointerHandler`

**Files:**
- Modify: `packages/dawcore/src/interactions/pointer-handler.ts`

The existing `PointerHandler.onPointerDown` fires on every timeline pointerdown. It needs to check if the target is a clip element and delegate to `ClipPointerHandler` before falling through to seek/select.

- [ ] **Step 1: Update `PointerHandlerHost` to expose clip handler**

Add to `PointerHandlerHost` interface in `pointer-handler.ts`:

```typescript
readonly _clipHandler: { tryHandle(target: Element, e: PointerEvent): boolean; onPointerMove(e: PointerEvent): void; onPointerUp(e: PointerEvent): void; isActive: boolean } | null;
```

- [ ] **Step 2: Add clip target check at the start of `onPointerDown`**

At the beginning of `onPointerDown`, before setting up timeline drag, check if the target is a clip element:

```typescript
onPointerDown = (e: PointerEvent) => {
  // Check if click landed on an interactive clip element
  const clipHandler = this._host._clipHandler;
  if (clipHandler) {
    const target = e.composedPath()[0] as Element;
    if (target && clipHandler.tryHandle(target, e)) {
      // Clip handler took over — wire move/up to it
      this._timeline = this._host.shadowRoot?.querySelector('.timeline') as HTMLElement | null;
      if (this._timeline) {
        this._timeline.setPointerCapture(e.pointerId);
        const onMove = (me: PointerEvent) => clipHandler.onPointerMove(me as PointerEvent);
        const onUp = (ue: PointerEvent) => {
          clipHandler.onPointerUp(ue as PointerEvent);
          this._timeline?.removeEventListener('pointermove', onMove as EventListener);
          this._timeline?.removeEventListener('pointerup', onUp as EventListener);
          try {
            this._timeline?.releasePointerCapture(ue.pointerId);
          } catch { /* may already be released */ }
          this._timeline = null;
        };
        this._timeline.addEventListener('pointermove', onMove as EventListener);
        this._timeline.addEventListener('pointerup', onUp as EventListener);
      }
      return;
    }
  }

  // Original seek/select logic continues unchanged...
  this._timeline = this._host.shadowRoot?.querySelector('.timeline') as HTMLElement | null;
  // ...
```

- [ ] **Step 3: Update existing test mocks to satisfy new interface**

The `PointerHandlerHost` interface now includes `_clipHandler`. Add `_clipHandler: null` to `createMockHost()` in `pointer-handler.test.ts`:

```typescript
// In createMockHost(), add to the host object:
_clipHandler: null,
```

- [ ] **Step 4: Run all pointer handler tests**

Run: `cd packages/dawcore && npx vitest run src/__tests__/pointer-handler.test.ts`
Expected: All existing tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/interactions/pointer-handler.ts packages/dawcore/src/__tests__/pointer-handler.test.ts
git commit -m "feat(dawcore): wire clip pointer handler delegation into pointer handler"
```

---

## Task 6: Add Attributes and Rendering to `<daw-editor>`

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

### Step 6a: Add new properties

- [ ] **Step 1: Add `interactive-clips` and `clip-header-height` properties**

After the existing `clipHeaders` property (line 37):

```typescript
@property({ type: Number, attribute: 'clip-header-height' }) clipHeaderHeight = 20;
@property({ type: Boolean, attribute: 'interactive-clips' }) interactiveClips = false;
```

- [ ] **Step 2: Create `ClipPointerHandler` instance**

After `_pointer` (line 65), add:

```typescript
private _clipPointer = new ClipPointerHandler(this);
```

Import `ClipPointerHandler` at the top of the file.

- [ ] **Step 3: Expose `_clipHandler` for `PointerHandlerHost`**

The `PointerHandlerHost` interface now expects `_clipHandler`. Add a getter:

```typescript
get _clipHandler() {
  return this.interactiveClips ? this._clipPointer : null;
}
```

Wire the `ClipPointerHost` interface by exposing the engine contract. Add a getter:

```typescript
get engine(): ClipPointerHost['engine'] {
  return this._engine;
}
```

### Step 6b: Update clip rendering template

- [ ] **Step 4: Use `clipHeaderHeight` instead of hardcoded `20`**

In the `render()` method, replace `this.clipHeaders ? 20 : 0` (lines 706, 767) with `this.clipHeaders ? this.clipHeaderHeight : 0`.

- [ ] **Step 5: Add `data-interactive` to headers and render boundary edges**

Update the clip template (around line 769-793). Add `data-interactive`, `data-clip-id`, `data-track-id` to header. Add boundary divs:

```typescript
${hdrH > 0
  ? html`<div class="clip-header"
      ${this.interactiveClips ? 'data-interactive' : ''}
      data-clip-id=${clip.id}
      data-track-id=${t.trackId}>
      <span>${clip.name || t.descriptor?.name || ''}</span>
    </div>`
  : ''}
${this.interactiveClips
  ? html`
    <div class="clip-boundary"
      data-boundary-edge="left"
      data-clip-id=${clip.id}
      data-track-id=${t.trackId}></div>
    <div class="clip-boundary"
      data-boundary-edge="right"
      data-clip-id=${clip.id}
      data-track-id=${t.trackId}></div>`
  : ''}
```

- [ ] **Step 6: Verify typecheck passes**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts
git commit -m "feat(dawcore): add interactive-clips attribute, boundary rendering, and clip handler wiring"
```

---

## Task 7: Implement `splitAtPlayhead()` — Tests First

**Files:**
- Create: `packages/dawcore/src/__tests__/daw-editor-clip-interactions.test.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

### Step 7a: Write failing tests

- [ ] **Step 1: Write split tests**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// We test splitAtPlayhead via a minimal mock since full Lit rendering
// in happy-dom is brittle. Instead, extract the split logic to a
// testable function.
import { splitAtPlayhead } from '../interactions/split-handler';
import type { SplitHost } from '../interactions/split-handler';

function createMockSplitHost(overrides: Partial<SplitHost> = {}): SplitHost {
  return {
    effectiveSampleRate: 48000,
    currentTime: 5.0,
    engine: null,
    dispatchEvent: vi.fn(() => true),
    ...overrides,
  };
}

describe('splitAtPlayhead', () => {
  it('returns false when no engine exists', () => {
    const host = createMockSplitHost();
    expect(splitAtPlayhead(host)).toBe(false);
  });

  it('returns false when no selectedTrackId', () => {
    const host = createMockSplitHost({
      engine: {
        getState: () => ({
          selectedTrackId: null,
          tracks: [],
        }),
        splitClip: vi.fn(),
      } as any,
    });
    expect(splitAtPlayhead(host)).toBe(false);
  });

  it('returns false when playhead is not within any clip', () => {
    const host = createMockSplitHost({
      currentTime: 100.0, // way past all clips
      engine: {
        getState: () => ({
          selectedTrackId: 'track-1',
          tracks: [
            {
              id: 'track-1',
              clips: [
                { id: 'clip-1', startSample: 0, durationSamples: 48000, offsetSamples: 0 },
              ],
            },
          ],
        }),
        splitClip: vi.fn(),
      } as any,
    });
    expect(splitAtPlayhead(host)).toBe(false);
  });

  it('returns true and dispatches daw-clip-split when split succeeds', () => {
    const splitClip = vi.fn();
    const host = createMockSplitHost({
      currentTime: 0.5, // 0.5s = 24000 samples at 48kHz — within clip
      engine: {
        getState: vi.fn()
          .mockReturnValueOnce({
            selectedTrackId: 'track-1',
            tracks: [
              {
                id: 'track-1',
                clips: [
                  { id: 'clip-1', startSample: 0, durationSamples: 96000, offsetSamples: 0 },
                ],
              },
            ],
          })
          // After split — two new clips replace the original
          .mockReturnValueOnce({
            selectedTrackId: 'track-1',
            tracks: [
              {
                id: 'track-1',
                clips: [
                  { id: 'clip-left', startSample: 0, durationSamples: 24000, offsetSamples: 0 },
                  { id: 'clip-right', startSample: 24000, durationSamples: 72000, offsetSamples: 24000 },
                ],
              },
            ],
          }),
        splitClip,
      } as any,
    });

    const result = splitAtPlayhead(host);

    expect(result).toBe(true);
    expect(splitClip).toHaveBeenCalledWith('track-1', 'clip-1', 24000);
    expect(host.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'daw-clip-split',
        detail: expect.objectContaining({
          trackId: 'track-1',
          originalClipId: 'clip-1',
          leftClipId: 'clip-left',
          rightClipId: 'clip-right',
        }),
      })
    );
  });

  it('returns false when engine.splitClip no-ops (state unchanged)', () => {
    const host = createMockSplitHost({
      currentTime: 0.001, // Too close to edge — split would be below min duration
      engine: {
        getState: vi.fn().mockReturnValue({
          selectedTrackId: 'track-1',
          tracks: [
            {
              id: 'track-1',
              clips: [
                { id: 'clip-1', startSample: 0, durationSamples: 48000, offsetSamples: 0 },
              ],
            },
          ],
        }),
        splitClip: vi.fn(), // No-op — state doesn't change
      } as any,
    });

    expect(splitAtPlayhead(host)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-clip-interactions.test.ts`
Expected: FAIL — module does not exist

### Step 7b: Implement split logic

- [ ] **Step 3: Create `interactions/split-handler.ts`**

```typescript
import type { AudioClip, ClipTrack } from '@waveform-playlist/core';

export interface SplitHost {
  readonly effectiveSampleRate: number;
  readonly currentTime: number;
  readonly engine: {
    getState(): { selectedTrackId: string | null; tracks: ClipTrack[] };
    splitClip(trackId: string, clipId: string, atSample: number): void;
  } | null;
  dispatchEvent(event: Event): boolean;
}

/**
 * Split the clip under the playhead on the selected track.
 * Returns true if a split was performed, false otherwise.
 */
export function splitAtPlayhead(host: SplitHost): boolean {
  const { engine } = host;
  if (!engine) return false;

  const state = engine.getState();
  const { selectedTrackId } = state;
  if (!selectedTrackId) return false;

  const track = state.tracks.find((t: ClipTrack) => t.id === selectedTrackId);
  if (!track) return false;

  const atSample = Math.round(host.currentTime * host.effectiveSampleRate);

  // Find clip containing the playhead position
  const clip = track.clips.find(
    (c: AudioClip) =>
      atSample > c.startSample && atSample < c.startSample + c.durationSamples
  );
  if (!clip) return false;

  // Snapshot clip IDs before split
  const beforeIds = new Set(track.clips.map((c: AudioClip) => c.id));

  // Attempt split — engine validates internally and no-ops if invalid
  engine.splitClip(selectedTrackId, clip.id, atSample);

  // Read updated state and find new clip IDs
  const afterState = engine.getState();
  const afterTrack = afterState.tracks.find((t: ClipTrack) => t.id === selectedTrackId);
  if (!afterTrack) return false;

  const newClips = afterTrack.clips.filter((c: AudioClip) => !beforeIds.has(c.id));
  if (newClips.length !== 2) return false; // Engine no-opped

  // Sort by startSample: left has lower position
  newClips.sort((a: AudioClip, b: AudioClip) => a.startSample - b.startSample);

  host.dispatchEvent(
    new CustomEvent('daw-clip-split', {
      bubbles: true,
      composed: true,
      detail: {
        trackId: selectedTrackId,
        originalClipId: clip.id,
        leftClipId: newClips[0].id,
        rightClipId: newClips[1].id,
      },
    })
  );

  return true;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-clip-interactions.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/interactions/split-handler.ts packages/dawcore/src/__tests__/daw-editor-clip-interactions.test.ts
git commit -m "feat(dawcore): add splitAtPlayhead function with state-diff clip ID discovery"
```

---

## Task 8: Wire `splitAtPlayhead()` and Keyboard Shortcut into `<daw-editor>`

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`

- [ ] **Step 1: Add `splitAtPlayhead()` public method**

Import `splitAtPlayhead` from `../interactions/split-handler` and add to the class:

```typescript
/** Split the clip under the playhead on the selected track. */
splitAtPlayhead(): boolean {
  return splitAtPlayhead({
    effectiveSampleRate: this.effectiveSampleRate,
    currentTime: this._currentTime,
    engine: this._engine,
    dispatchEvent: (e: Event) => this.dispatchEvent(e),
  });
}
```

- [ ] **Step 2: Add keyboard listener for `S` key**

Add a `keydown` handler. In `connectedCallback` (or `firstUpdated`), conditionally wire it:

```typescript
private _onKeyDown = (e: KeyboardEvent) => {
  if (!this.interactiveClips) return;
  if (e.key === 's' || e.key === 'S') {
    // Don't split when user is typing in an input
    if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
    e.preventDefault();
    this.splitAtPlayhead();
  }
};
```

Add `@keydown=${this._onKeyDown}` to the `:host` or top-level container in `render()`. Add `tabindex="0"` to the host so it can receive focus:

```typescript
// In connectedCallback or constructor:
if (!this.hasAttribute('tabindex')) {
  this.setAttribute('tabindex', '0');
}
this.addEventListener('keydown', this._onKeyDown);
```

Clean up in `disconnectedCallback`:

```typescript
this.removeEventListener('keydown', this._onKeyDown);
```

- [ ] **Step 3: Verify typecheck passes**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS

- [ ] **Step 4: Run all dawcore tests**

Run: `cd packages/dawcore && npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts
git commit -m "feat(dawcore): wire splitAtPlayhead method and S keyboard shortcut"
```

---

## Task 9: Export New Types and Run Full Build

**Files:**
- Modify: `packages/dawcore/src/index.ts` (if not already re-exporting new types)

- [ ] **Step 1: Export new types from index**

Ensure these are exported from the package entry:

```typescript
export type {
  DawClipMoveDetail,
  DawClipTrimDetail,
  DawClipSplitDetail,
} from './events';
export { ClipPointerHandler } from './interactions/clip-pointer-handler';
export type { ClipPointerHost, ClipEngineContract } from './interactions/clip-pointer-handler';
export { splitAtPlayhead } from './interactions/split-handler';
export type { SplitHost } from './interactions/split-handler';
```

- [ ] **Step 2: Run full build**

Run: `pnpm build`
Expected: All packages build successfully

- [ ] **Step 3: Run lint**

Run: `pnpm lint`
Expected: PASS (fix any formatting issues with `pnpm format` first)

- [ ] **Step 4: Run all dawcore tests**

Run: `cd packages/dawcore && npx vitest run`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/index.ts
git commit -m "feat(dawcore): export clip interaction types and handlers"
```

---

## Task 10: Manual Verification on Dev Page

- [ ] **Step 1: Rebuild all packages**

Run: `pnpm build`

- [ ] **Step 2: Update dev page to enable interactions**

In the dev page HTML (`dev/index.html` or wherever the `<daw-editor>` is used), add the new attributes:

```html
<daw-editor clip-headers interactive-clips samples-per-pixel="1024" file-drop>
```

- [ ] **Step 3: Start dev server and test**

Run: `pnpm dev:page`

Test checklist:
- [ ] Clip headers render with correct height
- [ ] Dragging a clip header moves the clip (cursor shows grab/grabbing)
- [ ] Dragging left/right clip edges trims (cursor shows col-resize)
- [ ] Boundary edges highlight on hover
- [ ] Clicking empty timeline space still seeks
- [ ] Dragging empty timeline space still creates selection
- [ ] Press `S` to split clip at playhead
- [ ] Console shows no errors

- [ ] **Step 4: Kill vitest strays**

Run: `pkill -f vitest` (per CLAUDE.md guideline about orphaned processes)

- [ ] **Step 5: Final commit if dev page changes needed**

```bash
git add dev/
git commit -m "chore(dawcore): enable interactive-clips on dev page"
```
