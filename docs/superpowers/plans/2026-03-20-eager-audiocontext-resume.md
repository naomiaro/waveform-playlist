# Eager AudioContext Resume Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resume the global AudioContext on first user interaction (before play), eliminating ~200-500ms first-play latency.

**Architecture:** A Lit reactive controller (`AudioResumeController`) listens for `pointerdown`/`keydown` on a configurable target (host element, document, or CSS selector). On first event, it calls `resumeGlobalAudioContext()` fire-and-forget and removes listeners. `<daw-editor>` exposes an `eager-resume` attribute that wires the controller.

**Tech Stack:** Lit reactive controllers, `resumeGlobalAudioContext()` from `@waveform-playlist/playout`, vitest + happy-dom

**Spec:** `docs/superpowers/specs/2026-03-18-eager-audiocontext-resume-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `packages/dawcore/src/controllers/audio-resume-controller.ts` | Reactive controller: one-shot AudioContext resume on user gesture |
| Create | `packages/dawcore/src/__tests__/audio-resume-controller.test.ts` | Unit tests for the controller |
| Modify | `packages/dawcore/src/elements/daw-editor.ts` | `eagerResume` property + controller wiring (~5 lines) |
| Modify | `packages/dawcore/src/__tests__/daw-editor.test.ts` | Integration tests for eager-resume attribute |
| Modify | `packages/dawcore/src/index.ts` | Export `AudioResumeController` |

---

### Task 1: AudioResumeController — inert mode and pointerdown

**Files:**
- Create: `packages/dawcore/src/controllers/audio-resume-controller.ts`
- Create: `packages/dawcore/src/__tests__/audio-resume-controller.test.ts`

- [ ] **Step 1: Write failing tests for inert mode and pointerdown resume**

```typescript
// packages/dawcore/src/__tests__/audio-resume-controller.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@waveform-playlist/playout', () => ({
  resumeGlobalAudioContext: vi.fn(),
}));

import { AudioResumeController } from '../controllers/audio-resume-controller';
import { resumeGlobalAudioContext } from '@waveform-playlist/playout';

// Capture rAF callbacks so we can flush them synchronously in tests
let rafCallbacks: Array<(time: number) => void>;

function createMockHost() {
  const el = document.createElement('div');
  document.body.appendChild(el);
  return Object.assign(el, {
    addController: vi.fn(),
    requestUpdate: vi.fn(),
    updateComplete: Promise.resolve(true),
    isConnected: true,
  }) as any;
}

/** Flush pending requestAnimationFrame callbacks */
function flushRaf() {
  const cbs = rafCallbacks.splice(0);
  cbs.forEach((cb) => cb(performance.now()));
}

describe('AudioResumeController', () => {
  let host: any;

  beforeEach(() => {
    vi.clearAllMocks();
    rafCallbacks = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: (time: number) => void) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      })
    );
    host = createMockHost();
  });

  afterEach(() => {
    host.remove();
    vi.unstubAllGlobals();
  });

  it('skips listener attachment when target is undefined (inert mode)', () => {
    const addSpy = vi.spyOn(host, 'addEventListener');
    const controller = new AudioResumeController(host);
    controller.hostConnected();
    flushRaf();

    expect(addSpy).not.toHaveBeenCalled();
  });

  it('calls resumeGlobalAudioContext on first pointerdown', () => {
    const controller = new AudioResumeController(host);
    controller.target = '';
    controller.hostConnected();
    flushRaf();

    host.dispatchEvent(new Event('pointerdown', { bubbles: true }));

    expect(resumeGlobalAudioContext).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/audio-resume-controller.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write minimal AudioResumeController implementation**

```typescript
// packages/dawcore/src/controllers/audio-resume-controller.ts
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import { resumeGlobalAudioContext } from '@waveform-playlist/playout';

export class AudioResumeController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _target: EventTarget | null = null;
  private _attached = false;

  /** CSS selector, or 'document'. When undefined, controller is inert. */
  target?: string;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  hostConnected() {
    // Defer to next frame so Lit's willUpdate() can set `target` from
    // the host's attribute before we read it. Same pattern as ViewportController.
    requestAnimationFrame(() => {
      if (!this._host.isConnected || this._attached || this.target === undefined) return;

      const resolvedTarget = this._resolveTarget();
      if (!resolvedTarget) return;

      this._target = resolvedTarget;
      this._attached = true;
      resolvedTarget.addEventListener('pointerdown', this._onGesture, {
        once: true,
        capture: true,
      });
      resolvedTarget.addEventListener('keydown', this._onGesture, {
        once: true,
        capture: true,
      });
    });
  }

  hostDisconnected() {
    this._removeListeners();
    this._attached = false;
  }

  private _onGesture = (e: Event) => {
    resumeGlobalAudioContext();
    // Remove the other listener (the fired one was auto-removed by { once: true })
    const otherType = e.type === 'pointerdown' ? 'keydown' : 'pointerdown';
    this._target?.removeEventListener(otherType, this._onGesture, {
      capture: true,
    });
    this._target = null;
  };

  private _resolveTarget(): EventTarget | null {
    const t = this.target;
    if (t === undefined) return null;
    if (t === '') return this._host;
    if (t === 'document') return document;

    const el = document.querySelector(t);
    if (!el) {
      console.warn(
        '[dawcore] AudioResumeController: target not found for "' + t + '", using host'
      );
      return this._host;
    }
    return el;
  }

  private _removeListeners() {
    if (!this._target) return;
    this._target.removeEventListener('pointerdown', this._onGesture, {
      capture: true,
    });
    this._target.removeEventListener('keydown', this._onGesture, {
      capture: true,
    });
    this._target = null;
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/audio-resume-controller.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/controllers/audio-resume-controller.ts packages/dawcore/src/__tests__/audio-resume-controller.test.ts
git commit -m "feat(dawcore): AudioResumeController — inert mode and pointerdown resume"
```

---

### Task 2: AudioResumeController — keydown, one-shot, and disconnect

**Files:**
- Modify: `packages/dawcore/src/__tests__/audio-resume-controller.test.ts`

- [ ] **Step 1: Write failing tests for keydown, one-shot behavior, and disconnect cleanup**

Add to the existing describe block:

```typescript
  it('calls resumeGlobalAudioContext on first keydown', () => {
    const controller = new AudioResumeController(host);
    controller.target = '';
    controller.hostConnected();
    flushRaf();

    host.dispatchEvent(new Event('keydown', { bubbles: true }));

    expect(resumeGlobalAudioContext).toHaveBeenCalledOnce();
  });

  it('only calls resume once (second event is no-op)', () => {
    const controller = new AudioResumeController(host);
    controller.target = '';
    controller.hostConnected();
    flushRaf();

    host.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    host.dispatchEvent(new Event('keydown', { bubbles: true }));

    expect(resumeGlobalAudioContext).toHaveBeenCalledOnce();
  });

  it('removes listeners on hostDisconnected before any event fires', () => {
    const removeSpy = vi.spyOn(host, 'removeEventListener');
    const controller = new AudioResumeController(host);
    controller.target = '';
    controller.hostConnected();
    flushRaf();

    controller.hostDisconnected();

    // Should remove both pointerdown and keydown
    const captureRemovals = removeSpy.mock.calls.filter(
      ([, , opts]) => (opts as any)?.capture === true
    );
    expect(captureRemovals.length).toBe(2);
    expect(resumeGlobalAudioContext).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/audio-resume-controller.test.ts`
Expected: PASS (5 tests) — implementation from Task 1 should already handle these

- [ ] **Step 3: Commit**

```bash
git add packages/dawcore/src/__tests__/audio-resume-controller.test.ts
git commit -m "test(dawcore): AudioResumeController keydown, one-shot, and disconnect tests"
```

---

### Task 3: AudioResumeController — target resolution (selector, document, fallback)

**Files:**
- Modify: `packages/dawcore/src/__tests__/audio-resume-controller.test.ts`

- [ ] **Step 1: Write failing tests for target resolution**

Add to the existing describe block:

```typescript
  it('attaches to document when target is "document"', () => {
    const docSpy = vi.spyOn(document, 'addEventListener');
    const controller = new AudioResumeController(host);
    controller.target = 'document';
    controller.hostConnected();
    flushRaf();

    document.dispatchEvent(new Event('pointerdown'));

    expect(resumeGlobalAudioContext).toHaveBeenCalledOnce();
    docSpy.mockRestore();
  });

  it('resolves CSS selector target', () => {
    const target = document.createElement('div');
    target.id = 'audio-scope';
    document.body.appendChild(target);

    const targetSpy = vi.spyOn(target, 'addEventListener');
    const controller = new AudioResumeController(host);
    controller.target = '#audio-scope';
    controller.hostConnected();
    flushRaf();

    expect(targetSpy.mock.calls.some(([type]) => type === 'pointerdown')).toBe(true);

    target.remove();
    targetSpy.mockRestore();
  });

  it('falls back to host when selector does not match', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const hostSpy = vi.spyOn(host, 'addEventListener');

    const controller = new AudioResumeController(host);
    controller.target = '#nonexistent';
    controller.hostConnected();
    flushRaf();

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining('#nonexistent')
    );
    expect(hostSpy.mock.calls.some(([type]) => type === 'pointerdown')).toBe(true);

    warnSpy.mockRestore();
    hostSpy.mockRestore();
  });
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/audio-resume-controller.test.ts`
Expected: PASS (8 tests) — implementation from Task 1 should handle these

- [ ] **Step 3: Commit**

```bash
git add packages/dawcore/src/__tests__/audio-resume-controller.test.ts
git commit -m "test(dawcore): AudioResumeController target resolution tests"
```

---

### Task 4: `<daw-editor>` integration — eager-resume attribute

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts`
- Modify: `packages/dawcore/src/__tests__/daw-editor.test.ts`
- Modify: `packages/dawcore/src/index.ts`

- [ ] **Step 1: Write failing integration tests**

Add to `packages/dawcore/src/__tests__/daw-editor.test.ts`:

```typescript
  it('attaches AudioResumeController listeners when eager-resume is set', async () => {
    const el = document.createElement('daw-editor') as any;
    el.setAttribute('eager-resume', '');
    const spy = vi.spyOn(el, 'addEventListener');
    document.body.appendChild(el);

    // Wait for Lit update cycle
    await new Promise((r) => setTimeout(r, 50));

    const captureListeners = spy.mock.calls.filter(
      ([, , opts]) => (opts as any)?.capture === true
    );
    expect(captureListeners.length).toBeGreaterThanOrEqual(2);

    document.body.removeChild(el);
    spy.mockRestore();
  });

  it('does not attach listeners when eager-resume is not set', async () => {
    const el = document.createElement('daw-editor') as any;
    const spy = vi.spyOn(el, 'addEventListener');
    document.body.appendChild(el);

    await new Promise((r) => setTimeout(r, 50));

    const captureListeners = spy.mock.calls.filter(
      ([type]) => type === 'pointerdown' || type === 'keydown'
    ).filter(
      ([, , opts]) => (opts as any)?.capture === true
    );
    expect(captureListeners.length).toBe(0);

    document.body.removeChild(el);
    spy.mockRestore();
  });

  it('passes eager-resume="document" to controller target', async () => {
    const docSpy = vi.spyOn(document, 'addEventListener');
    const el = document.createElement('daw-editor') as any;
    el.setAttribute('eager-resume', 'document');
    document.body.appendChild(el);

    await new Promise((r) => setTimeout(r, 50));

    const docCapture = docSpy.mock.calls.filter(
      ([type, , opts]) =>
        (type === 'pointerdown' || type === 'keydown') &&
        (opts as any)?.capture === true
    );
    expect(docCapture.length).toBeGreaterThanOrEqual(2);

    document.body.removeChild(el);
    docSpy.mockRestore();
  });
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor.test.ts`
Expected: FAIL — `eager-resume` attribute not recognized / no listeners attached

- [ ] **Step 3: Add eagerResume property and controller to daw-editor.ts**

At the top of the file, add import:

```typescript
import { AudioResumeController } from '../controllers/audio-resume-controller';
```

In the class body (near other controller declarations around line 85-90), add:

```typescript
  private _audioResume = new AudioResumeController(this);

  @property({ attribute: 'eager-resume' })
  eagerResume?: string;
```

In `willUpdate()` (around line 224), add before the existing `samplesPerPixel` check:

```typescript
    if (changedProperties.has('eagerResume')) {
      this._audioResume.target = this.eagerResume;
    }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor.test.ts`
Expected: PASS

- [ ] **Step 5: Export AudioResumeController from index.ts**

Add to `packages/dawcore/src/index.ts`:

```typescript
export { AudioResumeController } from './controllers/audio-resume-controller';
```

- [ ] **Step 6: Verify full test suite passes**

Run: `cd packages/dawcore && npx vitest run`
Expected: All tests pass

- [ ] **Step 7: Verify typecheck passes**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/daw-editor.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): eager-resume attribute on daw-editor

Wires AudioResumeController to <daw-editor eager-resume> attribute.
Accepts 'document', CSS selector, or empty (host element).
Exports AudioResumeController for standalone use."
```

---

### Task 5: Verify build and lint

**Files:** None (verification only)

- [ ] **Step 1: Build dawcore package**

Run: `pnpm --filter @dawcore/components build`
Expected: Clean build, no errors

- [ ] **Step 2: Run lint**

Run: `pnpm lint`
Expected: No errors. If formatting issues, run `pnpm format` first.

- [ ] **Step 3: Verify daw-editor.ts stays within file size budget**

Run: `wc -l packages/dawcore/src/elements/daw-editor.ts`
Expected: <= 800 lines

---

### Task 6: Update CLAUDE.md

**Files:**
- Modify: `packages/dawcore/CLAUDE.md`

- [ ] **Step 1: Add AudioResumeController to Reactive Controllers section**

In the "Reactive Controllers" section of `packages/dawcore/CLAUDE.md`, add:

```markdown
- `AudioResumeController` — One-shot AudioContext resume on first user gesture (`pointerdown`/`keydown`). Configurable target: host element (default), `'document'`, or CSS selector. Used by `<daw-editor eager-resume>`. Exported for standalone use.
```

- [ ] **Step 2: Commit**

```bash
git add packages/dawcore/CLAUDE.md
git commit -m "docs(dawcore): add AudioResumeController to CLAUDE.md"
```
