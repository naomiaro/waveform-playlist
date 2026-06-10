# dawcore Shared-Geometry Track Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `<daw-editor>`'s layout as frozen panes — a pinned ruler band, a transform-synced controls column, a both-axes scroll area, identical box geometry for controls and track rows, and container-query compact controls.

**Architecture:** `.scroll-area` becomes the single scroll container (both axes). The ruler lives in a clipped `.ruler-viewport` above and the controls column in a clipped `.controls-viewport` beside it; a new `ScrollSyncController` applies `translate3d` transforms to both on every scroll event. Track rows gain `box-sizing: border-box` so their rendered height exactly equals the controls' (killing the 1px-per-track drift). `daw-track-controls` uses CSS container queries to drop sliders when rows are short.

**Tech Stack:** Lit 3 (Web Components), TypeScript, vitest + happy-dom (unit), Playwright MCP against `examples/dawcore-tone` (visual verification).

**Spec:** `docs/specs/2026-06-09-dawcore-track-layout-design.md`

**Working branch:** `feat/dawcore-track-layout` (already created)

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `packages/dawcore/src/controllers/scroll-sync-controller.ts` | Create | Frozen-panes transform sync + wheel forwarding |
| `packages/dawcore/src/__tests__/scroll-sync-controller.test.ts` | Create | Unit tests for the controller |
| `packages/dawcore/src/elements/daw-editor.ts` | Modify | New shadow DOM structure, styles, ruler band, grid fixes |
| `packages/dawcore/src/__tests__/daw-editor-layout.test.ts` | Create | Template/geometry assertions |
| `packages/dawcore/src/elements/daw-track-controls.ts` | Modify | Container-query compact modes |
| `packages/dawcore/src/__tests__/daw-track-controls.test.ts` | Modify | Compact-mode structural assertions |
| `packages/dawcore/CLAUDE.md` | Modify | Update layout gotchas/patterns |

Background knowledge for the implementer:

- Run dawcore unit tests from the package dir: `cd packages/dawcore && npx vitest run` (happy-dom; canvas `getContext` returns `null` and must be mocked — see test code below).
- Typecheck per-package (root `pnpm typecheck` has a known pre-existing failure): `cd packages/dawcore && pnpm typecheck`.
- Lint from repo root before every commit: `pnpm -w lint` (fix with `pnpm format`). Run git commands from the repo root.
- The dev server for visual checks: `pnpm example:dawcore-tone` (Vite prints the actual port; 5174 is the default but it falls back when taken).
- After running tests across packages, check for orphaned vitest processes: `pgrep -f vitest`, kill with `pkill -f vitest`.

---

### Task 1: `ScrollSyncController`

A Lit reactive controller that keeps the ruler (x) and controls column (y) visually locked to `.scroll-area`'s scroll position, on every scroll event (the existing `ViewportController` thresholds at 100px — too coarse for visual sync; it stays untouched for chunk virtualization). Also forwards mouse-wheel deltaY over the controls viewport to the scroll container.

**Files:**
- Create: `packages/dawcore/src/controllers/scroll-sync-controller.ts`
- Test: `packages/dawcore/src/__tests__/scroll-sync-controller.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/dawcore/src/__tests__/scroll-sync-controller.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ScrollSyncController } from '../controllers/scroll-sync-controller';

const nextFrame = () => new Promise<void>((r) => requestAnimationFrame(() => r()));

function makeHost() {
  const el = document.createElement('div') as HTMLElement & {
    addController: ReturnType<typeof vi.fn>;
    requestUpdate: ReturnType<typeof vi.fn>;
  };
  el.attachShadow({ mode: 'open' });
  el.shadowRoot!.innerHTML = `
    <div class="header-row">
      <div class="ruler-viewport"><div class="ruler-content"></div></div>
    </div>
    <div class="body">
      <div class="controls-viewport"><div class="controls-column"></div></div>
      <div class="scroll-area"><div class="timeline"></div></div>
    </div>`;
  (el as any).addController = vi.fn();
  (el as any).requestUpdate = vi.fn();
  document.body.appendChild(el);
  return el;
}

function makeController(host: ReturnType<typeof makeHost>) {
  const c = new ScrollSyncController(host as any);
  c.scrollSelector = '.scroll-area';
  c.xTargetSelector = '.ruler-content';
  c.yTargetSelector = '.controls-column';
  c.wheelForwardSelector = '.controls-viewport';
  return c;
}

function q(host: HTMLElement, sel: string): HTMLElement {
  return host.shadowRoot!.querySelector(sel) as HTMLElement;
}

describe('ScrollSyncController', () => {
  let host: ReturnType<typeof makeHost>;

  beforeEach(() => {
    host = makeHost();
  });

  afterEach(() => {
    host.remove();
    vi.restoreAllMocks();
  });

  it('registers itself with the host', () => {
    const controller = makeController(host);
    expect((host as any).addController).toHaveBeenCalledWith(controller);
  });

  it('applies transforms to x and y targets on scroll', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    sa.scrollLeft = 120;
    sa.scrollTop = 45;
    sa.dispatchEvent(new Event('scroll'));

    expect(q(host, '.ruler-content').style.transform).toBe('translate3d(-120px, 0, 0)');
    expect(q(host, '.controls-column').style.transform).toBe('translate3d(0, -45px, 0)');
  });

  it('sync() applies the current scroll position without a scroll event', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    sa.scrollLeft = 300;
    controller.sync();

    expect(q(host, '.ruler-content').style.transform).toBe('translate3d(-300px, 0, 0)');
  });

  it('forwards wheel deltaY to the scroll container when vertically scrollable', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollHeight', { value: 500, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    sa.scrollTop = 0;

    const wheel = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
    q(host, '.controls-viewport').dispatchEvent(wheel);

    expect(sa.scrollTop).toBe(50);
    expect(wheel.defaultPrevented).toBe(true);
  });

  it('does not forward wheel when not vertically scrollable', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    Object.defineProperty(sa, 'scrollHeight', { value: 200, configurable: true });
    Object.defineProperty(sa, 'clientHeight', { value: 200, configurable: true });
    sa.scrollTop = 0;

    const wheel = new WheelEvent('wheel', { deltaY: 50, cancelable: true });
    q(host, '.controls-viewport').dispatchEvent(wheel);

    expect(sa.scrollTop).toBe(0);
    expect(wheel.defaultPrevented).toBe(false);
  });

  it('stops syncing after hostDisconnected', async () => {
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    controller.hostDisconnected();

    const sa = q(host, '.scroll-area');
    sa.scrollLeft = 999;
    sa.dispatchEvent(new Event('scroll'));

    expect(q(host, '.ruler-content').style.transform).not.toBe('translate3d(-999px, 0, 0)');
  });

  it('tolerates missing targets (header not rendered yet)', async () => {
    host.shadowRoot!.querySelector('.header-row')!.remove();
    const controller = makeController(host);
    controller.hostConnected();
    await nextFrame();

    const sa = q(host, '.scroll-area');
    sa.scrollLeft = 50;
    expect(() => sa.dispatchEvent(new Event('scroll'))).not.toThrow();
    // String(-0) === '0', so a zero scrollTop renders as plain 0px.
    expect(q(host, '.controls-column').style.transform).toBe('translate3d(0, 0px, 0)');
  });
});
```

- [ ] **Step 2: Run the test, verify it fails**

```bash
cd packages/dawcore && npx vitest run src/__tests__/scroll-sync-controller.test.ts
```

Expected: FAIL — `Cannot find module '../controllers/scroll-sync-controller'`.

- [ ] **Step 3: Implement the controller**

Create `packages/dawcore/src/controllers/scroll-sync-controller.ts`:

```ts
import type { ReactiveController, ReactiveControllerHost } from 'lit';

/**
 * Frozen-panes scroll sync. The editor's `.scroll-area` owns both scroll
 * axes; this controller keeps the ruler band (x) and controls column (y)
 * visually locked to it by applying translate3d transforms on EVERY scroll
 * event. (ViewportController's 100px threshold exists for chunk
 * virtualization and is too coarse for visual sync.)
 *
 * Also forwards wheel deltaY over the controls viewport to the scroll
 * container so the mouse wheel scrolls tracks while hovering the controls.
 * preventDefault fires only when the container is actually vertically
 * scrollable, so page scrolling is unaffected for unconstrained editors.
 */
export class ScrollSyncController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _scrollContainer: HTMLElement | null = null;
  private _wheelTarget: HTMLElement | null = null;

  /** Selector (in host shadow DOM) for the scroll container. */
  scrollSelector = '';
  /** Selector for the element receiving translate3d(-scrollLeft, 0, 0). */
  xTargetSelector = '';
  /** Selector for the element receiving translate3d(0, -scrollTop, 0). */
  yTargetSelector = '';
  /** Selector for the element whose wheel events forward to the container. */
  wheelForwardSelector = '';

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  hostConnected() {
    // Defer so the Shadow DOM renders before querying (same pattern as
    // ViewportController).
    requestAnimationFrame(() => {
      if (!this._host.isConnected) return;
      this._attach();
    });
  }

  hostDisconnected() {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._wheelTarget?.removeEventListener('wheel', this._onWheel);
    this._scrollContainer = null;
    this._wheelTarget = null;
  }

  /**
   * Re-attach and re-apply transforms from the current scroll position.
   * Called from the host's updated() so elements created by a re-render
   * (e.g. the ruler appearing when the first track loads) pick up the
   * current offset and listeners.
   */
  sync() {
    this._attach();
  }

  private _query(selector: string): HTMLElement | null {
    return selector
      ? (this._host.shadowRoot?.querySelector(selector) as HTMLElement | null)
      : null;
  }

  private _attach() {
    const container = this._query(this.scrollSelector);
    if (!container) return;
    if (container !== this._scrollContainer) {
      this._scrollContainer?.removeEventListener('scroll', this._onScroll);
      this._scrollContainer = container;
      container.addEventListener('scroll', this._onScroll, { passive: true });
    }
    const wheelTarget = this._query(this.wheelForwardSelector);
    if (wheelTarget !== this._wheelTarget) {
      this._wheelTarget?.removeEventListener('wheel', this._onWheel);
      this._wheelTarget = wheelTarget;
      wheelTarget?.addEventListener('wheel', this._onWheel, { passive: false });
    }
    this._apply();
  }

  private _onScroll = () => {
    this._apply();
  };

  private _onWheel = (e: WheelEvent) => {
    const sc = this._scrollContainer;
    if (!sc) return;
    if (sc.scrollHeight <= sc.clientHeight) return;
    sc.scrollTop += e.deltaY;
    e.preventDefault();
  };

  private _apply() {
    const sc = this._scrollContainer;
    if (!sc) return;
    // Re-query targets each time: Lit conditional templates create/replace
    // these elements between renders (e.g. the header row appears with the
    // first loaded track).
    const xTarget = this._query(this.xTargetSelector);
    if (xTarget) xTarget.style.transform = `translate3d(${-sc.scrollLeft}px, 0, 0)`;
    const yTarget = this._query(this.yTargetSelector);
    if (yTarget) yTarget.style.transform = `translate3d(0, ${-sc.scrollTop}px, 0)`;
  }
}
```

- [ ] **Step 4: Run the test, verify it passes**

```bash
cd packages/dawcore && npx vitest run src/__tests__/scroll-sync-controller.test.ts
```

Expected: PASS (7 tests).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
cd packages/dawcore && pnpm typecheck
cd /Users/naomiaro/Code/waveform-playlist && pnpm -w lint && \
git add packages/dawcore/src/controllers/scroll-sync-controller.ts packages/dawcore/src/__tests__/scroll-sync-controller.test.ts && \
git commit -m "feat: ScrollSyncController for frozen-panes ruler/controls sync"
```

If lint complains about formatting, run `pnpm format` first.

---

### Task 2: Restructure `<daw-editor>` layout

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (styles ~line 397, render ~line 2368, `updated()` ~line 665)
- Test: `packages/dawcore/src/__tests__/daw-editor-layout.test.ts` (create)

- [ ] **Step 1: Write the failing tests**

Create `packages/dawcore/src/__tests__/daw-editor-layout.test.ts`. The mock adapter is copied from `daw-editor-midi.test.ts` (the canonical shape per package CLAUDE.md). MIDI tracks are used because they load without fetch/decode in happy-dom.

```ts
import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  // Register all elements before template cloning (happy-dom 20 upgrades
  // cloned elements only if the class is defined first).
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
  await import('../elements/daw-piano-roll');
  await import('../elements/daw-ruler');
  await import('../elements/daw-grid');
});

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no fetch in layout tests')));
  // happy-dom canvas getContext returns null — ruler/grid drawing needs a mock.
  const mockCtx = {
    clearRect: vi.fn(),
    resetTransform: vi.fn(),
    scale: vi.fn(),
    fillRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    font: '',
    textBaseline: '',
  };
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function makeMockAdapter() {
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

const NOTES = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];

async function makeEditor(trackCount: number, attrs: Record<string, string> = {}) {
  const editor = document.createElement('daw-editor') as any;
  editor.adapter = makeMockAdapter();
  for (const [k, v] of Object.entries(attrs)) editor.setAttribute(k, v);
  document.body.appendChild(editor);
  for (let i = 0; i < trackCount; i++) {
    await editor.addTrack({ name: `T${i}`, midi: { notes: NOTES } });
  }
  await editor.updateComplete;
  return editor;
}

describe('<daw-editor> frozen-panes layout', () => {
  it('renders the ruler in the header band, not inside the timeline', async () => {
    const editor = await makeEditor(1, { timescale: '' });
    const sr = editor.shadowRoot!;
    expect(sr.querySelector('.header-row .ruler-viewport .ruler-content daw-ruler')).not.toBeNull();
    expect(sr.querySelector('.timeline daw-ruler')).toBeNull();
    editor.remove();
  });

  it('renders no header band when timescale is off', async () => {
    const editor = await makeEditor(1);
    expect(editor.shadowRoot!.querySelector('.header-row')).toBeNull();
    editor.remove();
  });

  it('renders the ruler gap only when controls are shown', async () => {
    const editor = await makeEditor(1, { timescale: '' });
    expect(editor.shadowRoot!.querySelector('.header-row .ruler-gap')).not.toBeNull();
    editor.remove();

    // beats mode + no tracks → ruler without gap (timeline is full-width too)
    const empty = document.createElement('daw-editor') as any;
    empty.adapter = makeMockAdapter();
    empty.setAttribute('timescale', '');
    empty.setAttribute('scale-mode', 'beats');
    document.body.appendChild(empty);
    await empty.updateComplete;
    expect(empty.shadowRoot!.querySelector('.header-row')).not.toBeNull();
    expect(empty.shadowRoot!.querySelector('.header-row .ruler-gap')).toBeNull();
    empty.remove();
  });

  it('has no legacy spacer div — controls column starts with track controls', async () => {
    const editor = await makeEditor(2, { timescale: '' });
    const col = editor.shadowRoot!.querySelector('.controls-column')!;
    expect(col.firstElementChild?.tagName.toLowerCase()).toBe('daw-track-controls');
    editor.remove();
  });

  it('nests the controls column inside a clipped viewport', async () => {
    const editor = await makeEditor(1);
    expect(editor.shadowRoot!.querySelector('.controls-viewport > .controls-column')).not.toBeNull();
    editor.remove();
  });

  it('gives controls and track rows identical inline heights', async () => {
    const editor = await makeEditor(3, { timescale: '' });
    const sr = editor.shadowRoot!;
    const controls = [...sr.querySelectorAll('daw-track-controls')] as HTMLElement[];
    const rows = [...sr.querySelectorAll('.track-row')] as HTMLElement[];
    expect(controls).toHaveLength(3);
    expect(rows).toHaveLength(3);
    controls.forEach((c, i) => {
      expect(c.style.height).not.toBe('');
      expect(c.style.height).toBe(rows[i].style.height);
    });
    editor.remove();
  });

  it('sizes the beats grid as the exact sum of track heights (no +1), at top 0', async () => {
    const editor = await makeEditor(2, { timescale: '', 'scale-mode': 'beats' });
    const sr = editor.shadowRoot!;
    const grid = sr.querySelector('daw-grid') as any;
    expect(grid).not.toBeNull();
    const rows = [...sr.querySelectorAll('.track-row')] as HTMLElement[];
    const expected = rows.reduce((s, r) => s + parseFloat(r.style.height), 0);
    expect(grid.height).toBe(expected);
    expect(grid.style.top).toBe('0px');
    editor.remove();
  });

  it('declares border-box track rows and a both-axes scroll area in static styles', async () => {
    const editor = await makeEditor(0);
    const cssText = (editor.constructor as any).styles
      .map((s: any) => s.cssText ?? String(s))
      .join('\n');
    expect(cssText).toMatch(/\.track-row\s*\{[^}]*box-sizing:\s*border-box/);
    expect(cssText).toMatch(/\.scroll-area\s*\{[^}]*overflow:\s*auto/);
    expect(cssText).toMatch(/\.scroll-area\s*\{[^}]*overflow-anchor:\s*none/);
    editor.remove();
  });
});
```

- [ ] **Step 2: Run the tests, verify they fail**

```bash
cd packages/dawcore && npx vitest run src/__tests__/daw-editor-layout.test.ts
```

Expected: FAIL — `.header-row`, `.ruler-content`, `.controls-viewport` don't exist; grid height is `sum + 1`s; cssText lacks `box-sizing: border-box`.

- [ ] **Step 3: Update the editor's static styles**

In `packages/dawcore/src/elements/daw-editor.ts` (~line 397), replace this block of the `static styles` css:

```css
      :host {
        display: flex;
        position: relative;
        background: var(--daw-background, #1a1a2e);
        overflow: hidden;
      }
      .controls-column {
        flex-shrink: 0;
        width: var(--daw-controls-width, 180px);
      }
      .scroll-area {
        flex: 1;
        overflow-x: auto;
        overflow-y: hidden;
        min-height: var(--daw-min-height, 200px);
      }
      .timeline {
        position: relative;
        min-height: 100%;
        cursor: text;
      }
      .track-row {
        position: relative;
        background: var(--daw-track-background, #16213e);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
```

with:

```css
      :host {
        display: flex;
        flex-direction: column;
        position: relative;
        background: var(--daw-background, #1a1a2e);
        overflow: hidden;
      }
      .header-row {
        display: flex;
        flex-shrink: 0;
      }
      .ruler-gap {
        flex-shrink: 0;
        width: var(--daw-controls-width, 180px);
      }
      .ruler-viewport {
        flex: 1;
        position: relative;
        overflow: hidden;
        cursor: text;
      }
      .ruler-content {
        will-change: transform;
      }
      .body {
        flex: 1;
        min-height: 0;
        display: flex;
      }
      .controls-viewport {
        flex-shrink: 0;
        width: var(--daw-controls-width, 180px);
        overflow: hidden;
      }
      .controls-column {
        will-change: transform;
      }
      .scroll-area {
        flex: 1;
        overflow: auto;
        overflow-anchor: none;
        min-height: var(--daw-min-height, 200px);
      }
      .timeline {
        position: relative;
        min-height: 100%;
        cursor: text;
      }
      .track-row {
        position: relative;
        box-sizing: border-box;
        background: var(--daw-track-background, #16213e);
        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      }
```

(`will-change` only on the two transform-animated wrappers — consistent with the Firefox will-change budget rule in `ui-components/CLAUDE.md`.)

- [ ] **Step 4: Add the module constant, import, controller instance, and updated() hook**

Near the top of `daw-editor.ts`, after the existing imports:

```ts
import { ScrollSyncController } from '../controllers/scroll-sync-controller';

/** Height of the ruler band — single source for the ruler element and the header row. */
const RULER_HEIGHT = 30;
```

After the `_viewport` field (~line 395):

```ts
  private _scrollSync = (() => {
    const s = new ScrollSyncController(this);
    s.scrollSelector = '.scroll-area';
    s.xTargetSelector = '.ruler-content';
    s.yTargetSelector = '.controls-column';
    s.wheelForwardSelector = '.controls-viewport';
    return s;
  })();
```

In `protected updated(_changed: Map<string, unknown>): void` (~line 665), add as the FIRST line of the method body (the spectrogram branch below contains an early `return` — the sync call must precede it):

```ts
    this._scrollSync.sync();
```

- [ ] **Step 5: Restructure the render() template**

In `render()` (~line 2368), replace the top of the returned template — from `return html\`` through the opening `<div class="scroll-area">` — with:

```ts
    const showControls = orderedTracks.length > 0 || this.indefinitePlayback;
    const showRuler =
      (orderedTracks.length > 0 || this.scaleMode === 'beats' || this.indefinitePlayback) &&
      this.timescale;

    return html`
      ${showRuler
        ? html`<div class="header-row" style="height: ${RULER_HEIGHT}px;">
            ${showControls ? html`<div class="ruler-gap"></div>` : ''}
            <div class="ruler-viewport" @pointerdown=${this._pointer.onPointerDown}>
              <div
                class="ruler-content"
                style="width: ${this._totalWidth > 0 ? this._totalWidth + 'px' : '100%'};"
              >
                <daw-ruler
                  .samplesPerPixel=${spp}
                  .sampleRate=${this.effectiveSampleRate}
                  .duration=${this._duration}
                  .scaleMode=${this.scaleMode}
                  .ticksPerPixel=${this.ticksPerPixel}
                  .meterEntries=${this._meterEntries}
                  .ppqn=${this.ppqn}
                  .totalWidth=${this._totalWidth}
                  .rulerHeight=${RULER_HEIGHT}
                ></daw-ruler>
              </div>
            </div>
          </div>`
        : ''}
      <div class="body">
        ${showControls
          ? html`<div class="controls-viewport">
              <div class="controls-column">
                ${orderedTracks.map(
                  (t) => html`
                    <daw-track-controls
                      style="height: ${t.trackHeight}px;"
                      .trackId=${t.trackId}
                      .trackName=${t.descriptor?.name ?? 'Untitled'}
                      .volume=${t.descriptor?.volume ?? 1}
                      .pan=${t.descriptor?.pan ?? 0}
                      .muted=${t.descriptor?.muted ?? false}
                      .soloed=${t.descriptor?.soloed ?? false}
                    ></daw-track-controls>
                  `
                )}
              </div>
            </div>`
          : ''}
        <div class="scroll-area">
```

This replaces (delete entirely): the old `${orderedTracks.length > 0 || this.indefinitePlayback ? html\`<div class="controls-column">...` block including the `${this.timescale ? html\`<div style="height: 30px;"></div>\` : ''}` spacer.

- [ ] **Step 6: Remove the ruler from the timeline and fix the grid**

Inside the `.timeline` template, DELETE this block (the ruler now renders in the header band):

```ts
          ${(orderedTracks.length > 0 || this.scaleMode === 'beats' || this.indefinitePlayback) &&
          this.timescale
            ? html`<daw-ruler
                .samplesPerPixel=${spp}
                .sampleRate=${this.effectiveSampleRate}
                .duration=${this._duration}
                .scaleMode=${this.scaleMode}
                .ticksPerPixel=${this.ticksPerPixel}
                .meterEntries=${this._meterEntries}
                .ppqn=${this.ppqn}
                .totalWidth=${this._totalWidth}
              ></daw-ruler>`
            : ''}
```

In the `daw-grid` template, change:

```ts
                style="top: ${this.timescale ? 30 : 0}px;"
```
to:
```ts
                style="top: 0px;"
```

and change the height reduce from:

```ts
                  ? orderedTracks.reduce((sum, t) => sum + t.trackHeight + 1, 0)
```
to:
```ts
                  ? orderedTracks.reduce((sum, t) => sum + t.trackHeight, 0)
```

(The `+1` compensated for the content-box border; rows are now border-box.)

- [ ] **Step 7: Close the new `.body` wrapper**

At the end of `render()`, the current closing is:

```ts
          })}
        </div>
      </div>
      <slot></slot>
    `;
```

Add one more `</div>` (closing `.body`) before the slot:

```ts
          })}
        </div>
      </div>
      </div>
      <slot></slot>
    `;
```

(Indentation will be normalized by `pnpm format`.)

- [ ] **Step 8: Run the layout tests, verify they pass**

```bash
cd packages/dawcore && npx vitest run src/__tests__/daw-editor-layout.test.ts
```

Expected: PASS (8 tests).

- [ ] **Step 9: Run the full dawcore suite — catch stale structural assertions**

```bash
cd packages/dawcore && npx vitest run
```

Known coupling: `daw-editor-indefinite.test.ts` asserts `.controls-column` presence/absence — the class name is preserved inside `.controls-viewport`, so it should pass. If any test queries `daw-ruler` inside `.timeline` or the old spacer div, update that test's selector to the new structure (`.header-row .ruler-content daw-ruler`) — the behavior under test is unchanged; only the structure moved. Fix implementation bugs as implementation bugs; only adjust selectors where the test encoded the old DOM shape.

Expected: all green.

- [ ] **Step 10: Typecheck, lint, commit**

```bash
cd packages/dawcore && pnpm typecheck
cd /Users/naomiaro/Code/waveform-playlist && pnpm format && pnpm -w lint && \
git add -A packages/dawcore/src && \
git commit -m "feat: frozen-panes layout for daw-editor (pinned ruler, synced controls, border-box rows)"
```

---

### Task 3: Container-query compact controls

**Files:**
- Modify: `packages/dawcore/src/elements/daw-track-controls.ts`
- Modify: `packages/dawcore/src/__tests__/daw-track-controls.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `packages/dawcore/src/__tests__/daw-track-controls.test.ts` (inside the existing describe block or a new one, following the file's existing setup conventions):

```ts
describe('compact modes', () => {
  it('marks the slider rows with vol-row / pan-row classes', async () => {
    const el = document.createElement('daw-track-controls') as any;
    document.body.appendChild(el);
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('.slider-row.vol-row')).not.toBeNull();
    expect(el.shadowRoot!.querySelector('.slider-row.pan-row')).not.toBeNull();
    el.remove();
  });

  it('declares size containment and container-query compact rules', () => {
    const ctor = customElements.get('daw-track-controls') as any;
    const cssText = Array.isArray(ctor.styles)
      ? ctor.styles.map((s: any) => s.cssText ?? String(s)).join('\n')
      : (ctor.styles.cssText ?? String(ctor.styles));
    expect(cssText).toMatch(/:host\s*\{[^}]*container-type:\s*size/);
    expect(cssText).toContain('@container (max-height: 76px)');
    expect(cssText).toContain('@container (max-height: 60px)');
  });
});
```

(happy-dom does not evaluate container queries — these are structural assertions; real behavior is verified in Task 4 with Playwright.)

- [ ] **Step 2: Run, verify failure**

```bash
cd packages/dawcore && npx vitest run src/__tests__/daw-track-controls.test.ts
```

Expected: FAIL — no `.vol-row`/`.pan-row` classes, no container rules.

- [ ] **Step 3: Implement**

In `packages/dawcore/src/elements/daw-track-controls.ts`:

(a) Add `container-type: size;` to the `:host` rule (after `overflow: hidden;`):

```css
    :host {
      display: flex;
      flex-direction: column;
      justify-content: flex-start;
      box-sizing: border-box;
      padding: 6px 8px;
      background: var(--daw-controls-background, #0f0f1a);
      color: var(--daw-controls-text, #c49a6c);
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-family: system-ui, sans-serif;
      font-size: 11px;
      overflow: hidden;
      container-type: size;
    }
```

(b) Append to the end of `static styles` (after the `-moz-range-thumb` rule):

```css
    /* Compact modes: drop sliders when the editor gives this row less height
       than the full stack needs (~76px with both sliders, ~60px with one).
       NOTE: container-type: size requires an explicit height on the host —
       the editor always provides one; standalone consumers must too. */
    @container (max-height: 76px) {
      .pan-row {
        display: none;
      }
    }
    @container (max-height: 60px) {
      .vol-row {
        display: none;
      }
    }
```

(c) In `render()`, add the classes to the two slider rows:

```ts
      <div class="slider-row vol-row">
```
(the row containing the Vol label/input), and
```ts
      <div class="slider-row pan-row">
```
(the row containing the Pan label/input).

- [ ] **Step 4: Run, verify pass; run the full suite**

```bash
cd packages/dawcore && npx vitest run
```

Expected: PASS, no regressions.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
cd packages/dawcore && pnpm typecheck
cd /Users/naomiaro/Code/waveform-playlist && pnpm format && pnpm -w lint && \
git add packages/dawcore/src/elements/daw-track-controls.ts packages/dawcore/src/__tests__/daw-track-controls.test.ts && \
git commit -m "feat: container-query compact modes for daw-track-controls"
```

---

### Task 4: Playwright verification & threshold tuning

No new code — live verification against the examples, using the Playwright MCP tools. Start the dev server if not running: `pnpm example:dawcore-tone` (check the log for the actual port; call it `$PORT` below).

- [ ] **Step 1: Alignment — zero drift on both examples**

Navigate to `http://localhost:$PORT/multiclip.html`, wait ~3s for decode, then evaluate:

```js
() => {
  const sr = document.getElementById('editor').shadowRoot;
  const controls = [...sr.querySelectorAll('daw-track-controls')];
  const rows = [...sr.querySelectorAll('.track-row')];
  return controls.map((c, i) => {
    const cr = c.getBoundingClientRect();
    const rr = rows[i].getBoundingClientRect();
    return { i, dTop: +(cr.top - rr.top).toFixed(2), dBottom: +(cr.bottom - rr.bottom).toFixed(2) };
  });
}
```

Expected: every `dTop` and `dBottom` is `0` (±0.5). Repeat on `spectrogram.html` (4 tracks incl. a stereo one). Before the fix these reached -7px.

- [ ] **Step 2: Vertical scroll — frozen panes hold**

On `multiclip.html`, evaluate: set `editor.style.height = '400px'`, then `scrollArea.scrollTop = 150`, and assert:
- `.controls-column` has `transform: translate3d(0, -150px, 0)` (or matrix equivalent),
- `.header-row`'s bounding top is unchanged (ruler pinned),
- controls[i].top still equals rows[i].top for all i,
- both scrollbars belong to `.scroll-area` (its `clientHeight < scrollHeight` and `clientWidth < scrollWidth`).

- [ ] **Step 3: Horizontal scroll — ruler sync**

Set `scrollArea.scrollLeft = 300`; assert `.ruler-content` transform is `translate3d(-300px, 0, 0)` and a ruler-time label at the viewport's left edge matches the timeline content (screenshot check).

- [ ] **Step 4: Seek from the ruler still works**

Click in the ruler band (e.g. at x ≈ 500 inside `.ruler-viewport`); assert a `daw-seek` event fires and the playhead moves to the corresponding position.

- [ ] **Step 5: Compact controls**

Set `editor.waveHeight = 40` (60px rows with clip headers). Assert:
- `.pan-row` is hidden (`getComputedStyle(...).display === 'none'`),
- no inner element's bottom exceeds the host's bottom (nothing clipped).

Then `editor.waveHeight = 30` (50px rows): `.vol-row` also hidden. Restore `editor.waveHeight = 80`: both visible. **Tune the 76px/60px thresholds** if the measured content bottoms disagree — adjust both the CSS and the Task 3 test expectations together, and re-run the dawcore suite.

- [ ] **Step 6: Wheel over controls scrolls vertically**

With the 400px constrained editor, dispatch a `WheelEvent` (`deltaY: 100, cancelable: true`) on `.controls-viewport`; assert `scrollArea.scrollTop` increased. Remove the height constraint; dispatch again; assert page scroll is not blocked (`defaultPrevented === false`).

- [ ] **Step 7: Screenshots**

Capture `multiclip.html` and `spectrogram.html` after the fix for the PR description (full editor visible, plus one of the constrained-height scrolled state).

- [ ] **Step 8: Commit any threshold tuning**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm -w lint && git add -A packages/dawcore && git commit -m "fix: tune compact-controls container query thresholds"
```

(Skip if no changes.)

---

### Task 5: Documentation

**Files:**
- Modify: `packages/dawcore/CLAUDE.md`

- [ ] **Step 1: Update the layout-related sections**

In `packages/dawcore/CLAUDE.md`:

(a) In **Embedding Gotchas**, replace the bullet:

> **`:host { display: flex }`** on `<daw-editor>` is load-bearing — it puts the controls-column on the left and scroll-area (waveforms) on the right. Setting `display: block` externally collapses to a vertical stack.

with:

> **`:host { display: flex; flex-direction: column }`** on `<daw-editor>` is load-bearing — it stacks the ruler band over the body row (controls viewport + scroll area). Overriding `display` externally breaks the frozen-panes layout.
> **Frozen-panes layout** — `.scroll-area` owns BOTH scroll axes. The ruler (`.ruler-content`) and controls column (`.controls-column`) are clipped viewports synced via `translate3d` transforms by `ScrollSyncController` on every scroll event. Track rows and `daw-track-controls` are both `box-sizing: border-box` with identical 1px bottom borders — heights match exactly; never reintroduce a content-box row or a `+1` height compensation.
> **`daw-track-controls` requires an explicit height** — its `:host` uses `container-type: size` for compact modes (Pan hidden below 76px, Vol below 60px). Without an explicit height (the editor always sets one), size containment collapses the element.

(b) In **Track Controls**, update the "Controls outside scroll container" bullet to describe the controls-viewport + transform sync (controls remain outside the x-scroll axis; vertical position mirrors `scrollTop`).

(c) In **Reactive Controllers**, add:

> - `ScrollSyncController` — frozen-panes transform sync (ruler x, controls y) + wheel forwarding from the controls viewport. Re-queries targets per scroll event because conditional templates recreate them.

- [ ] **Step 2: Commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist && pnpm -w lint && git add packages/dawcore/CLAUDE.md && git commit -m "docs: dawcore frozen-panes layout conventions"
```

---

### Task 6: Final verification

- [ ] **Step 1: Full dawcore suite + typecheck + build**

```bash
cd packages/dawcore && npx vitest run && pnpm typecheck
cd /Users/naomiaro/Code/waveform-playlist && pnpm build
```

Expected: tests green, typecheck clean, build succeeds (build is required because the examples and website consume `dist/`).

- [ ] **Step 2: Kill stray vitest processes**

```bash
pgrep -f vitest && pkill -f vitest || echo "no strays"
```

- [ ] **Step 3: Re-run the Task 4 alignment check once more against the built state**

Hard-refresh (Cmd+Shift+R) the example pages and re-run the Step 1 alignment evaluate. Expected: all deltas 0.

- [ ] **Step 4: Remove working docs before PR merge** (deferred to PR time — per repo convention, `git rm docs/specs/2026-06-09-dawcore-track-layout-design.md docs/plans/2026-06-09-dawcore-track-layout.md` happens on this branch before the PR merges; the PR description carries the durable summary.)
