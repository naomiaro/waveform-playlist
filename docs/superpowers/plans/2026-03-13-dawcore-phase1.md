# dawcore Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a working vertical slice — one audio file playing with waveform, playhead, ruler, and transport controls — using Lit Web Components wrapping the existing engine/playout packages.

**Architecture:** Single `@dawcore/components` package in `packages/dawcore`. Lit elements wrap `PlaylistEngine` + `createToneAdapter()`. Data elements (`<daw-track>`, `<daw-clip>`) use light DOM; visual elements (`<daw-waveform>`, `<daw-playhead>`, `<daw-ruler>`) use Shadow DOM with chunked canvas rendering. Transport elements find their target via `for` attribute.

**Tech Stack:** Lit 3, TypeScript, tsup, Vitest, Vite (dev server)

**Design Spec:** `docs/superpowers/specs/2026-03-13-dawcore-phase1-design.md`

---

## Chunk 1: Scaffolding and Data Elements

### Task 1: Package Scaffolding

**Files:**
- Create: `packages/dawcore/package.json`
- Create: `packages/dawcore/tsconfig.json`
- Create: `packages/dawcore/tsup.config.ts`
- Create: `packages/dawcore/vitest.config.ts`
- Create: `packages/dawcore/src/index.ts`

- [ ] **Step 1: Create `packages/dawcore/package.json`**

```json
{
  "name": "@dawcore/components",
  "version": "0.0.1",
  "description": "Web Components for multi-track audio editing — framework-agnostic",
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
  "sideEffects": true,
  "scripts": {
    "build": "pnpm typecheck && tsup",
    "dev": "tsup --watch",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "author": "Naomi Aro",
  "license": "MIT",
  "files": ["dist"],
  "dependencies": {
    "lit": "^3.0.0"
  },
  "peerDependencies": {
    "@waveform-playlist/engine": ">=7.0.0",
    "@waveform-playlist/core": ">=7.0.0",
    "@waveform-playlist/playout": ">=7.0.0"
  },
  "devDependencies": {
    "@waveform-playlist/engine": "workspace:*",
    "@waveform-playlist/core": "workspace:*",
    "@waveform-playlist/playout": "workspace:*",
    "happy-dom": "^17.0.0",
    "tsup": "^8.0.1",
    "typescript": "^5.3.3",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 2: Create `packages/dawcore/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src",
    "composite": false,
    "experimentalDecorators": true,
    "useDefineForClassFields": false
  },
  "include": ["src/**/*"]
}
```

Note: `experimentalDecorators` and `useDefineForClassFields: false` are required for Lit's `@property` and `@customElement` decorators.

- [ ] **Step 3: Create `packages/dawcore/tsup.config.ts`**

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

- [ ] **Step 4: Create `packages/dawcore/vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'happy-dom',
  },
});
```

- [ ] **Step 5: Create `packages/dawcore/src/index.ts`**

```typescript
// Elements will be registered here as they are created.
// Importing this module registers all custom elements.
```

- [ ] **Step 6: Install dependencies**

Run: `cd /Users/naomiaro/Code/waveform-playlist && pnpm install`
Expected: lockfile updates, packages/dawcore linked into workspace

- [ ] **Step 7: Verify build works**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && pnpm build`
Expected: Build succeeds, `dist/` created with index.js, index.mjs, index.d.ts

- [ ] **Step 8: Commit**

```bash
git add packages/dawcore/ pnpm-lock.yaml
git commit -m "feat(dawcore): scaffold package with tsup, Lit, TypeScript"
```

---

### Task 2: `<daw-clip>` Element

Data-only element. No rendering, no Shadow DOM. Must be defined before `<daw-track>` since tracks query their clip children.

**Files:**
- Create: `packages/dawcore/src/elements/daw-clip.ts`
- Create: `packages/dawcore/src/__tests__/daw-clip.test.ts`
- Modify: `packages/dawcore/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dawcore/src/__tests__/daw-clip.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

// Register element
beforeAll(async () => {
  await import('../elements/daw-clip');
});

describe('DawClipElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-clip')).toBeDefined();
  });

  it('has a stable clipId', () => {
    const el = document.createElement('daw-clip') as any;
    expect(typeof el.clipId).toBe('string');
    expect(el.clipId.length).toBeGreaterThan(0);
    // ID is stable across reads
    expect(el.clipId).toBe(el.clipId);
  });

  it('reflects src attribute', () => {
    const el = document.createElement('daw-clip') as any;
    el.setAttribute('src', '/audio/test.mp3');
    expect(el.src).toBe('/audio/test.mp3');
  });

  it('reflects numeric attributes with defaults', () => {
    const el = document.createElement('daw-clip') as any;
    expect(el.start).toBe(0);
    expect(el.duration).toBe(0);
    expect(el.offset).toBe(0);
    expect(el.gain).toBe(1);
  });

  it('reflects fade attributes', () => {
    const el = document.createElement('daw-clip') as any;
    el.setAttribute('fade-in', '0.5');
    el.setAttribute('fade-out', '1.0');
    el.setAttribute('fade-type', 'sCurve');
    expect(el.fadeIn).toBe(0.5);
    expect(el.fadeOut).toBe(1.0);
    expect(el.fadeType).toBe('sCurve');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-clip.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/dawcore/src/elements/daw-clip.ts
import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('daw-clip')
export class DawClipElement extends LitElement {
  @property() src = '';
  @property({ attribute: 'peaks-src' }) peaksSrc = '';
  @property({ type: Number }) start = 0;
  @property({ type: Number }) duration = 0;
  @property({ type: Number }) offset = 0;
  @property({ type: Number }) gain = 1;
  @property() name = '';
  @property() color = '';
  @property({ type: Number, attribute: 'fade-in' }) fadeIn = 0;
  @property({ type: Number, attribute: 'fade-out' }) fadeOut = 0;
  @property({ attribute: 'fade-type' }) fadeType = 'linear';

  readonly clipId = crypto.randomUUID();

  // Light DOM — no visual rendering, just a data container
  createRenderRoot() {
    return this;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-clip': DawClipElement;
  }
}
```

- [ ] **Step 4: Add to index.ts**

```typescript
// packages/dawcore/src/index.ts
import './elements/daw-clip';

export { DawClipElement } from './elements/daw-clip';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-clip.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-clip.ts packages/dawcore/src/__tests__/daw-clip.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add daw-clip element — declarative clip data"
```

---

### Task 3: `<daw-track>` Element

Data element that holds track attributes and dispatches change events. Light DOM so clip children are queryable.

**Files:**
- Create: `packages/dawcore/src/elements/daw-track.ts`
- Create: `packages/dawcore/src/__tests__/daw-track.test.ts`
- Modify: `packages/dawcore/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dawcore/src/__tests__/daw-track.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
});

describe('DawTrackElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-track')).toBeDefined();
  });

  it('has a stable trackId', () => {
    const el = document.createElement('daw-track') as any;
    expect(typeof el.trackId).toBe('string');
    expect(el.trackId).toBe(el.trackId);
  });

  it('reflects track attributes', () => {
    const el = document.createElement('daw-track') as any;
    el.setAttribute('name', 'Vocals');
    el.setAttribute('volume', '0.8');
    el.setAttribute('pan', '-0.5');
    expect(el.name).toBe('Vocals');
    expect(el.volume).toBe(0.8);
    expect(el.pan).toBe(-0.5);
  });

  it('reflects boolean attributes', () => {
    const el = document.createElement('daw-track') as any;
    expect(el.muted).toBe(false);
    expect(el.soloed).toBe(false);
    el.setAttribute('muted', '');
    expect(el.muted).toBe(true);
  });

  it('can query child daw-clip elements', () => {
    const track = document.createElement('daw-track') as any;
    const clip1 = document.createElement('daw-clip');
    clip1.setAttribute('src', '/audio/a.mp3');
    const clip2 = document.createElement('daw-clip');
    clip2.setAttribute('src', '/audio/b.mp3');
    track.appendChild(clip1);
    track.appendChild(clip2);
    expect(track.querySelectorAll('daw-clip').length).toBe(2);
  });

  it('dispatches daw-track-update on attribute change', async () => {
    const track = document.createElement('daw-track') as any;
    document.body.appendChild(track);

    const events: CustomEvent[] = [];
    track.addEventListener('daw-track-update', (e: CustomEvent) => events.push(e));

    track.volume = 0.5;
    // Lit batches updates — wait for next microtask
    await new Promise((r) => setTimeout(r, 0));

    expect(events.length).toBeGreaterThanOrEqual(1);
    expect(events[0].detail.trackId).toBe(track.trackId);

    document.body.removeChild(track);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-track.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/dawcore/src/elements/daw-track.ts
import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';

@customElement('daw-track')
export class DawTrackElement extends LitElement {
  @property() src = '';
  @property() name = '';
  @property({ type: Number }) volume = 1;
  @property({ type: Number }) pan = 0;
  @property({ type: Boolean }) muted = false;
  @property({ type: Boolean }) soloed = false;

  readonly trackId = crypto.randomUUID();

  // Light DOM so <daw-clip> children are queryable.
  // No render() needed — this is a data-only element.
  createRenderRoot() {
    return this;
  }

  updated(changed: PropertyValues) {
    // Notify parent editor when track-relevant attributes change
    const trackProps = ['volume', 'pan', 'muted', 'soloed', 'src', 'name'];
    const hasTrackChange = trackProps.some((p) => changed.has(p as keyof this));

    if (hasTrackChange) {
      this.dispatchEvent(
        new CustomEvent('daw-track-update', {
          bubbles: true,
          composed: true,
          detail: { trackId: this.trackId },
        })
      );
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-track': DawTrackElement;
  }
}
```

- [ ] **Step 4: Add to index.ts**

```typescript
// packages/dawcore/src/index.ts
import './elements/daw-clip';
import './elements/daw-track';

export { DawClipElement } from './elements/daw-clip';
export { DawTrackElement } from './elements/daw-track';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-track.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-track.ts packages/dawcore/src/__tests__/daw-track.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add daw-track element — declarative track data with change events"
```

---

### Task 4: Port Peak Rendering Utilities

Pure functions copied from `packages/ui-components/src/utils/peakRendering.ts`. These have no dependencies beyond `@waveform-playlist/core` types.

**Files:**
- Create: `packages/dawcore/src/utils/peak-rendering.ts`
- Create: `packages/dawcore/src/__tests__/peak-rendering.test.ts`

**Reference:** `packages/ui-components/src/utils/peakRendering.ts` (source) and `packages/ui-components/src/__tests__/peakRendering.test.ts` (existing tests)

- [ ] **Step 1: Copy peak rendering source**

Copy the contents of `packages/ui-components/src/utils/peakRendering.ts` to `packages/dawcore/src/utils/peak-rendering.ts`. Change the `WaveformDrawMode` import to a local type definition:

```typescript
// At the top of peak-rendering.ts, replace:
// import type { WaveformDrawMode } from '../wfpl-theme';
// With:
export type WaveformDrawMode = 'normal' | 'inverted';
```

Keep the `Peaks` and `Bits` type imports from `@waveform-playlist/core`.

- [ ] **Step 2: Copy and adapt peak rendering tests**

Read `packages/ui-components/src/__tests__/peakRendering.test.ts` for the existing test suite. Copy the tests to `packages/dawcore/src/__tests__/peak-rendering.test.ts`, updating the import path from `../utils/peakRendering` to `../utils/peak-rendering`.

- [ ] **Step 3: Run tests**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/peak-rendering.test.ts`
Expected: PASS — all 22 tests pass (same as ui-components)

- [ ] **Step 4: Commit**

```bash
git add packages/dawcore/src/utils/peak-rendering.ts packages/dawcore/src/__tests__/peak-rendering.test.ts
git commit -m "feat(dawcore): port peak rendering utilities from ui-components"
```

---

## Chunk 2: Controllers and Visual Elements

### Task 5: Reactive Controllers

Three controllers providing shared behavior: animation frames, viewport tracking, and engine access.

**Files:**
- Create: `packages/dawcore/src/controllers/animation-controller.ts`
- Create: `packages/dawcore/src/controllers/viewport-controller.ts`
- Create: `packages/dawcore/src/controllers/engine-controller.ts`
- Create: `packages/dawcore/src/__tests__/animation-controller.test.ts`

- [ ] **Step 1: Write animation controller test**

```typescript
// packages/dawcore/src/__tests__/animation-controller.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnimationController } from '../controllers/animation-controller';

describe('AnimationController', () => {
  let rafCallbacks: Array<(time: number) => void>;

  beforeEach(() => {
    rafCallbacks = [];
    vi.stubGlobal(
      'requestAnimationFrame',
      vi.fn((cb: (time: number) => void) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      })
    );
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('calls callback on each animation frame', () => {
    const callback = vi.fn();
    const host = { addController: vi.fn() } as any;
    const controller = new AnimationController(host);

    controller.start(callback);
    expect(rafCallbacks.length).toBe(1);

    rafCallbacks[0](16);
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('stops the animation loop', () => {
    const callback = vi.fn();
    const host = { addController: vi.fn() } as any;
    const controller = new AnimationController(host);

    controller.start(callback);
    controller.stop();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it('cleans up on hostDisconnected', () => {
    const callback = vi.fn();
    const host = { addController: vi.fn() } as any;
    const controller = new AnimationController(host);

    controller.start(callback);
    controller.hostDisconnected();
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/animation-controller.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write AnimationController**

```typescript
// packages/dawcore/src/controllers/animation-controller.ts
import type { ReactiveController, ReactiveControllerHost } from 'lit';

export class AnimationController implements ReactiveController {
  private _host: ReactiveControllerHost;
  private _rafId: number | null = null;
  private _callback: (() => void) | null = null;

  constructor(host: ReactiveControllerHost) {
    this._host = host;
    host.addController(this);
  }

  start(callback: () => void) {
    this.stop();
    this._callback = callback;
    const loop = () => {
      this._callback?.();
      this._rafId = requestAnimationFrame(loop);
    };
    this._rafId = requestAnimationFrame(loop);
  }

  stop() {
    if (this._rafId !== null) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
    this._callback = null;
  }

  hostConnected() {}

  hostDisconnected() {
    this.stop();
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/animation-controller.test.ts`
Expected: PASS

- [ ] **Step 5: Write ViewportController**

```typescript
// packages/dawcore/src/controllers/viewport-controller.ts
import type { ReactiveController, ReactiveControllerHost } from 'lit';

const OVERSCAN_MULTIPLIER = 1.5;
const SCROLL_THRESHOLD = 100;

export class ViewportController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;
  private _scrollContainer: HTMLElement | null = null;
  private _lastScrollLeft = 0;

  visibleStart = 0;
  visibleEnd = 0;
  containerWidth = 0;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  attachScrollContainer(container: HTMLElement) {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._scrollContainer = container;
    container.addEventListener('scroll', this._onScroll, { passive: true });
    this._update(container.scrollLeft, container.clientWidth);
  }

  getVisibleChunkIndices(totalWidth: number, chunkWidth: number, originX = 0): number[] {
    const totalChunks = Math.ceil(totalWidth / chunkWidth);
    const indices: number[] = [];
    for (let i = 0; i < totalChunks; i++) {
      const chunkStart = originX + i * chunkWidth;
      const chunkEnd = chunkStart + chunkWidth;
      if (chunkEnd > this.visibleStart && chunkStart < this.visibleEnd) {
        indices.push(i);
      }
    }
    return indices;
  }

  private _onScroll = () => {
    if (!this._scrollContainer) return;
    const { scrollLeft, clientWidth } = this._scrollContainer;
    if (Math.abs(scrollLeft - this._lastScrollLeft) >= SCROLL_THRESHOLD) {
      this._update(scrollLeft, clientWidth);
      this._host.requestUpdate();
    }
  };

  private _update(scrollLeft: number, containerWidth: number) {
    this._lastScrollLeft = scrollLeft;
    this.containerWidth = containerWidth;
    const buffer = containerWidth * OVERSCAN_MULTIPLIER;
    this.visibleStart = scrollLeft - buffer;
    this.visibleEnd = scrollLeft + containerWidth + buffer;
  }

  hostConnected() {}

  hostDisconnected() {
    this._scrollContainer?.removeEventListener('scroll', this._onScroll);
    this._scrollContainer = null;
  }
}
```

- [ ] **Step 6: Write EngineController**

```typescript
// packages/dawcore/src/controllers/engine-controller.ts
import type { ReactiveController, ReactiveControllerHost } from 'lit';
import type { DawEditorElement } from '../elements/daw-editor';

export class EngineController implements ReactiveController {
  private _host: ReactiveControllerHost & HTMLElement;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    host.addController(this);
  }

  get editor(): DawEditorElement | null {
    return this._host.closest('daw-editor') as DawEditorElement | null;
  }

  hostConnected() {}
  hostDisconnected() {}
}
```

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore/src/controllers/ packages/dawcore/src/__tests__/animation-controller.test.ts
git commit -m "feat(dawcore): add reactive controllers — animation, viewport, engine"
```

---

### Task 6: CSS Theme Defaults

Defines the CSS custom property defaults as a Lit `css` template that elements can share.

**Files:**
- Create: `packages/dawcore/src/styles/theme.ts`

- [ ] **Step 1: Create theme file**

```typescript
// packages/dawcore/src/styles/theme.ts
import { css } from 'lit';

/**
 * Default CSS custom properties for dawcore elements.
 * Consumers override these on <daw-editor> or any ancestor.
 * Values inherit through Shadow DOM boundaries automatically.
 */
export const hostStyles = css`
  :host {
    --daw-wave-color: #c49a6c;
    --daw-progress-color: #63c75f;
    --daw-playhead-color: #d08070;
    --daw-background: #1a1a2e;
    --daw-track-background: #16213e;
    --daw-ruler-color: #c49a6c;
    --daw-ruler-background: #0f0f1a;
    --daw-controls-background: #1a1a2e;
    --daw-controls-text: #e0d4c8;
    --daw-selection-color: rgba(99, 199, 95, 0.3);
    --daw-clip-header-background: rgba(0, 0, 0, 0.4);
    --daw-clip-header-text: #e0d4c8;
  }
`;
```

- [ ] **Step 2: Commit**

```bash
git add packages/dawcore/src/styles/theme.ts
git commit -m "feat(dawcore): add CSS custom property theme defaults"
```

---

### Task 7: `<daw-waveform>` Element

Chunked canvas rendering with virtual scrolling. Receives peaks data as JS properties.

**Files:**
- Create: `packages/dawcore/src/elements/daw-waveform.ts`
- Create: `packages/dawcore/src/__tests__/daw-waveform.test.ts`
- Modify: `packages/dawcore/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dawcore/src/__tests__/daw-waveform.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-waveform');
});

describe('DawWaveformElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-waveform')).toBeDefined();
  });

  it('has default property values', () => {
    const el = document.createElement('daw-waveform') as any;
    expect(el.waveHeight).toBe(128);
    expect(el.barWidth).toBe(1);
    expect(el.barGap).toBe(0);
    expect(el.bits).toBe(16);
    expect(el.length).toBe(0);
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-waveform') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/dawcore/src/elements/daw-waveform.ts
import { LitElement, html, css } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import type { Peaks, Bits } from '@waveform-playlist/core';
import {
  aggregatePeaks,
  calculateBarRects,
  calculateFirstBarPosition,
} from '../utils/peak-rendering';

const MAX_CANVAS_WIDTH = 1000;

@customElement('daw-waveform')
export class DawWaveformElement extends LitElement {
  @property({ type: Object, attribute: false }) peaks: Peaks = new Int16Array(0);
  @property({ type: Number, attribute: false }) bits: Bits = 16;
  @property({ type: Number, attribute: false }) length = 0;
  @property({ type: Number, attribute: false }) waveHeight = 128;
  @property({ type: Number, attribute: false }) barWidth = 1;
  @property({ type: Number, attribute: false }) barGap = 0;

  @state() private _visibleChunks: number[] = [];

  private _canvases = new Map<number, HTMLCanvasElement>();

  static styles = css`
    :host {
      display: block;
      position: relative;
    }
    .container {
      position: relative;
    }
    canvas {
      position: absolute;
      top: 0;
    }
  `;

  render() {
    const totalChunks = Math.ceil(this.length / MAX_CANVAS_WIDTH);
    // For now, render all chunks. ViewportController integration comes with editor.
    const indices = Array.from({ length: totalChunks }, (_, i) => i);

    return html`
      <div
        class="container"
        style="width: ${this.length}px; height: ${this.waveHeight}px;"
      >
        ${indices.map((i) => {
          const width = Math.min(MAX_CANVAS_WIDTH, this.length - i * MAX_CANVAS_WIDTH);
          const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
          return html`
            <canvas
              data-index=${i}
              width=${width * dpr}
              height=${this.waveHeight * dpr}
              style="left: ${i * MAX_CANVAS_WIDTH}px; width: ${width}px; height: ${this.waveHeight}px;"
            ></canvas>
          `;
        })}
      </div>
    `;
  }

  updated() {
    this._drawAllChunks();
  }

  private _drawAllChunks() {
    if (this.length === 0 || this.peaks.length === 0) return;

    const canvases = this.shadowRoot?.querySelectorAll('canvas');
    if (!canvases) return;

    const step = this.barWidth + this.barGap;
    const dpr = typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1;
    const halfHeight = this.waveHeight / 2;

    // Read CSS custom property for wave color
    const waveColor =
      getComputedStyle(this).getPropertyValue('--daw-wave-color').trim() || '#c49a6c';

    for (const canvas of canvases) {
      const idx = Number(canvas.dataset.index);
      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      const canvasWidth = Math.min(MAX_CANVAS_WIDTH, this.length - idx * MAX_CANVAS_WIDTH);

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.scale(dpr, dpr);
      ctx.fillStyle = waveColor;

      const globalOffset = idx * MAX_CANVAS_WIDTH;
      const canvasEnd = globalOffset + canvasWidth;
      const firstBar = calculateFirstBarPosition(globalOffset, this.barWidth, step);

      for (let bar = Math.max(0, firstBar); bar < canvasEnd; bar += step) {
        const peak = aggregatePeaks(this.peaks, this.bits, bar, bar + step);
        if (!peak) continue;
        const rects = calculateBarRects(
          bar - globalOffset,
          this.barWidth,
          halfHeight,
          peak.min,
          peak.max,
          'normal'
        );
        for (const r of rects) {
          ctx.fillRect(r.x, r.y, r.width, r.height);
        }
      }
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-waveform': DawWaveformElement;
  }
}
```

- [ ] **Step 4: Add to index.ts**

Add `import './elements/daw-waveform';` and `export { DawWaveformElement } from './elements/daw-waveform';` to `packages/dawcore/src/index.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-waveform.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-waveform.ts packages/dawcore/src/__tests__/daw-waveform.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add daw-waveform element — chunked canvas rendering"
```

---

### Task 8: `<daw-playhead>` Element

Animated vertical line. Position controlled by the editor via `startAnimation()` / `stopAnimation()` methods.

**Files:**
- Create: `packages/dawcore/src/elements/daw-playhead.ts`
- Create: `packages/dawcore/src/__tests__/daw-playhead.test.ts`
- Modify: `packages/dawcore/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dawcore/src/__tests__/daw-playhead.test.ts
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-playhead');
});

describe('DawPlayheadElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-playhead')).toBeDefined();
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-playhead') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('positions via stopAnimation', () => {
    const el = document.createElement('daw-playhead') as any;
    document.body.appendChild(el);
    // Place playhead at 2 seconds, sampleRate=48000, samplesPerPixel=1024
    // Expected px = (2 * 48000) / 1024 = 93.75
    el.stopAnimation(2, 48000, 1024);
    const line = el.shadowRoot.querySelector('div');
    expect(line.style.transform).toContain('93.75');
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-playhead.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

```typescript
// packages/dawcore/src/elements/daw-playhead.ts
import { LitElement, html, css } from 'lit';
import { customElement } from 'lit/decorators.js';
import { AnimationController } from '../controllers/animation-controller';

@customElement('daw-playhead')
export class DawPlayheadElement extends LitElement {
  private _animation = new AnimationController(this);
  private _line: HTMLElement | null = null;

  static styles = css`
    :host {
      position: absolute;
      top: 0;
      bottom: 0;
      left: 0;
      pointer-events: none;
      z-index: 10;
    }
    div {
      position: absolute;
      top: 0;
      bottom: 0;
      width: 1px;
      background: var(--daw-playhead-color, #d08070);
      will-change: transform;
    }
  `;

  render() {
    return html`<div></div>`;
  }

  firstUpdated() {
    this._line = this.shadowRoot!.querySelector('div');
  }

  startAnimation(
    getTime: () => number,
    sampleRate: number,
    samplesPerPixel: number
  ) {
    this._animation.start(() => {
      const time = getTime();
      const px = (time * sampleRate) / samplesPerPixel;
      if (this._line) {
        this._line.style.transform = `translate3d(${px}px, 0, 0)`;
      }
    });
  }

  stopAnimation(time: number, sampleRate: number, samplesPerPixel: number) {
    this._animation.stop();
    const px = (time * sampleRate) / samplesPerPixel;
    if (this._line) {
      this._line.style.transform = `translate3d(${px}px, 0, 0)`;
    }
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-playhead': DawPlayheadElement;
  }
}
```

- [ ] **Step 4: Add to index.ts, run test, commit**

Add to index. Run: `npx vitest run src/__tests__/daw-playhead.test.ts`. Expected: PASS.

```bash
git add packages/dawcore/src/elements/daw-playhead.ts packages/dawcore/src/__tests__/daw-playhead.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add daw-playhead element — RAF-animated position line"
```

---

## Chunk 3: Transport, Editor, and Dev Page

### Task 9: `<daw-transport>` and Button Elements

Transport container with `for` attribute and three button elements.

**Files:**
- Create: `packages/dawcore/src/elements/daw-transport.ts`
- Create: `packages/dawcore/src/elements/daw-transport-button.ts`
- Create: `packages/dawcore/src/elements/daw-play-button.ts`
- Create: `packages/dawcore/src/elements/daw-pause-button.ts`
- Create: `packages/dawcore/src/elements/daw-stop-button.ts`
- Create: `packages/dawcore/src/__tests__/daw-transport.test.ts`
- Modify: `packages/dawcore/src/index.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dawcore/src/__tests__/daw-transport.test.ts
import { describe, it, expect, vi, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-transport');
  await import('../elements/daw-play-button');
  await import('../elements/daw-pause-button');
  await import('../elements/daw-stop-button');
});

describe('DawTransportElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-transport')).toBeDefined();
  });

  it('resolves target from for attribute', () => {
    const target = document.createElement('div');
    target.id = 'test-editor';
    document.body.appendChild(target);

    const transport = document.createElement('daw-transport') as any;
    transport.setAttribute('for', 'test-editor');
    document.body.appendChild(transport);

    expect(transport.target).toBe(target);

    document.body.removeChild(target);
    document.body.removeChild(transport);
  });

  it('returns null when target not found', () => {
    const transport = document.createElement('daw-transport') as any;
    transport.setAttribute('for', 'nonexistent');
    document.body.appendChild(transport);
    expect(transport.target).toBeNull();
    document.body.removeChild(transport);
  });
});

describe('Transport buttons', () => {
  it('all buttons are registered', () => {
    expect(customElements.get('daw-play-button')).toBeDefined();
    expect(customElements.get('daw-pause-button')).toBeDefined();
    expect(customElements.get('daw-stop-button')).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-transport.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write DawTransportElement**

```typescript
// packages/dawcore/src/elements/daw-transport.ts
import { LitElement, html } from 'lit';
import { customElement, property } from 'lit/decorators.js';

@customElement('daw-transport')
export class DawTransportElement extends LitElement {
  @property() for = '';

  get target(): HTMLElement | null {
    return this.for ? document.getElementById(this.for) : null;
  }

  // Light DOM — button children stay in consumer's DOM
  createRenderRoot() {
    return this;
  }

  render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-transport': DawTransportElement;
  }
}
```

- [ ] **Step 4: Write DawTransportButton base class**

```typescript
// packages/dawcore/src/elements/daw-transport-button.ts
import { LitElement, css } from 'lit';
import type { DawTransportElement } from './daw-transport';

/**
 * Base class for transport button elements.
 * Finds target (editor or player) via closest <daw-transport>.
 */
export class DawTransportButton extends LitElement {
  protected get target(): any {
    const transport = this.closest('daw-transport') as DawTransportElement | null;
    return transport?.target ?? null;
  }

  static styles = css`
    button {
      cursor: pointer;
      background: var(--daw-controls-background, #1a1a2e);
      color: var(--daw-controls-text, #e0d4c8);
      border: 1px solid currentColor;
      padding: 4px 8px;
      font: inherit;
    }
    button:hover {
      opacity: 0.8;
    }
    button:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `;
}
```

- [ ] **Step 5: Write play, pause, stop buttons**

```typescript
// packages/dawcore/src/elements/daw-play-button.ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-play-button')
export class DawPlayButtonElement extends DawTransportButton {
  render() {
    return html`
      <button part="button" @click=${this._onClick}>
        <slot>Play</slot>
      </button>
    `;
  }

  private _onClick() {
    this.target?.play();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-play-button': DawPlayButtonElement;
  }
}
```

```typescript
// packages/dawcore/src/elements/daw-pause-button.ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-pause-button')
export class DawPauseButtonElement extends DawTransportButton {
  render() {
    return html`
      <button part="button" @click=${this._onClick}>
        <slot>Pause</slot>
      </button>
    `;
  }

  private _onClick() {
    this.target?.pause();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-pause-button': DawPauseButtonElement;
  }
}
```

```typescript
// packages/dawcore/src/elements/daw-stop-button.ts
import { html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { DawTransportButton } from './daw-transport-button';

@customElement('daw-stop-button')
export class DawStopButtonElement extends DawTransportButton {
  render() {
    return html`
      <button part="button" @click=${this._onClick}>
        <slot>Stop</slot>
      </button>
    `;
  }

  private _onClick() {
    this.target?.stop();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-stop-button': DawStopButtonElement;
  }
}
```

- [ ] **Step 6: Add all to index.ts, run tests, commit**

Add imports and exports for all transport elements. Run: `npx vitest run src/__tests__/daw-transport.test.ts`. Expected: PASS.

```bash
git add packages/dawcore/src/elements/daw-transport*.ts packages/dawcore/src/elements/daw-play-button.ts packages/dawcore/src/elements/daw-pause-button.ts packages/dawcore/src/elements/daw-stop-button.ts packages/dawcore/src/__tests__/daw-transport.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add transport container and play/pause/stop buttons"
```

---

### Task 10: `<daw-editor>` Element (Shell)

The core element. This task builds the shell — engine creation, child discovery, audio loading, playback methods, and Shadow DOM layout. Waveform rendering uses the `<daw-waveform>` element from Task 7.

This is the largest task. It integrates everything built so far.

**Files:**
- Create: `packages/dawcore/src/elements/daw-editor.ts`
- Create: `packages/dawcore/src/__tests__/daw-editor.test.ts`
- Modify: `packages/dawcore/src/index.ts`

**Key references:**
- `packages/engine/src/PlaylistEngine.ts` — engine API
- `packages/playout/src/TonePlayoutAdapter.ts` — `createToneAdapter()` factory
- `packages/browser/src/WaveformPlaylistContext.tsx` — audio loading pipeline pattern

- [ ] **Step 1: Write the failing test**

```typescript
// packages/dawcore/src/__tests__/daw-editor.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-clip');
  await import('../elements/daw-track');
  await import('../elements/daw-editor');
});

describe('DawEditorElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-editor')).toBeDefined();
  });

  it('reflects attribute defaults', () => {
    const el = document.createElement('daw-editor') as any;
    expect(el.samplesPerPixel).toBe(1024);
    expect(el.waveHeight).toBe(128);
    expect(el.timescale).toBe(false);
    expect(el.mono).toBe(false);
  });

  it('exposes playback methods', () => {
    const el = document.createElement('daw-editor') as any;
    expect(typeof el.play).toBe('function');
    expect(typeof el.pause).toBe('function');
    expect(typeof el.stop).toBe('function');
    expect(typeof el.seekTo).toBe('function');
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-editor') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('discovers child daw-track elements', async () => {
    const el = document.createElement('daw-editor') as any;
    const track = document.createElement('daw-track');
    track.setAttribute('name', 'Test Track');
    el.appendChild(track);
    document.body.appendChild(el);

    // Wait for Lit to update and MutationObserver to fire
    await new Promise((r) => setTimeout(r, 50));

    // Editor should have discovered the track
    expect(el.tracks.length).toBe(1);
    expect(el.tracks[0].name).toBe('Test Track');

    document.body.removeChild(el);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run src/__tests__/daw-editor.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the implementation**

Create `packages/dawcore/src/elements/daw-editor.ts`. This is the largest file — target ~300 lines. Key sections:

1. **Reactive properties** — `samplesPerPixel`, `waveHeight`, `timescale`, `mono`, `barWidth`, `barGap`
2. **Internal state** — `_tracks` (ClipTrack[]), `_peaksData` (Map), `_isPlaying`, `_currentTime`, `_duration`
3. **Engine lifecycle** — Create `PlaylistEngine` + `createToneAdapter()` in `connectedCallback()`, dispose in `disconnectedCallback()`
4. **Child discovery** — `MutationObserver` watching for `<daw-track>` additions/removals, listening for `daw-track-update` events
5. **`_discoverTracks()`** — Walks child `<daw-track>` and `<daw-clip>` elements, builds `ClipTrack[]` with sample-based timing
6. **Audio loading** — For each clip `src`, fetch + decode via `_audioCache` (Map<string, Promise<AudioBuffer>>). On decode, call `engine.setTracks()`.
7. **Playback methods** — `play()` (with AudioContext init guard), `pause()`, `stop()`, `seekTo()`
8. **Events** — Dispatch `daw-ready`, `daw-play`, `daw-pause`, `daw-stop`
9. **Playhead animation** — Start/stop RAF on the `<daw-playhead>` child element
10. **Shadow DOM render** — Layout from design spec section 8

Implementation notes:
- `_audioInitialized` flag guards `engine.init()` — first `play()` awaits it, subsequent calls skip
- `seekTo(time)` wraps `engine.seek(time)` (naming convention from design spec)
- `_discoverTracks()` handles both shorthand (`<daw-track src="...">`) and explicit (`<daw-track><daw-clip src="...">`) modes
- Audio loading is deferred to `connectedCallback` — elements without `src` attributes are valid (empty tracks)
- `sampleRate` defaults to 48000 until an AudioBuffer is decoded (then uses the buffer's rate)

The full implementation will be written during execution. The key pattern to follow is the audio loading pipeline from `WaveformPlaylistContext.tsx` lines 837-922, adapted for imperative Lit lifecycle.

**Peak generation:** For Phase 1, peak generation can be done inline (extract peaks from decoded `AudioBuffer` channel data directly, without a Web Worker). This simplifies the initial implementation. The worker-based pipeline (`src/workers/peaks-worker.ts` from the design spec) can be added later as a performance optimization when handling large files. The inline approach uses the same `WaveformData` library pattern: generate at a base scale, resample on zoom change.

- [ ] **Step 4: Add to index.ts, run tests, commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/daw-editor.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add daw-editor element — engine lifecycle, child discovery, playback"
```

---

### Task 11: Dev Page

Standalone HTML page served by Vite for manual testing with real audio.

**Files:**
- Create: `packages/dawcore/dev/index.html`
- Create: `packages/dawcore/dev/vite.config.ts`

- [ ] **Step 1: Add a sample audio file**

Either create a short sine wave test file or download one. Place at `packages/dawcore/dev/audio/`. Alternatively, reference an external URL for initial testing.

- [ ] **Step 2: Create the dev page**

```html
<!-- packages/dawcore/dev/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>dawcore dev</title>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #0f0f1a;
      color: #e0d4c8;
      padding: 24px;
    }
    h1 {
      font-size: 1.2rem;
      margin-bottom: 16px;
    }
    daw-editor {
      --daw-wave-color: #c49a6c;
      --daw-playhead-color: #d08070;
      --daw-background: #1a1a2e;
      --daw-track-background: #16213e;
      --daw-ruler-color: #c49a6c;
      --daw-ruler-background: #0f0f1a;
      margin-bottom: 12px;
    }
    daw-transport {
      display: flex;
      gap: 8px;
    }
  </style>
</head>
<body>
  <h1>dawcore — dev</h1>

  <script type="module" src="../src/index.ts"></script>

  <daw-editor id="editor" samples-per-pixel="1024" wave-height="128" timescale>
    <daw-track src="https://ia800905.us.archive.org/19/items/FREE_background_music_dano_songs/file-20.mp3" name="Track 1"></daw-track>
  </daw-editor>

  <daw-transport for="editor">
    <daw-play-button></daw-play-button>
    <daw-pause-button></daw-pause-button>
    <daw-stop-button></daw-stop-button>
  </daw-transport>
</body>
</html>
```

- [ ] **Step 3: Create Vite config for dev**

```typescript
// packages/dawcore/dev/vite.config.ts
import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  server: {
    port: 5173,
    open: true,
  },
});
```

Add `vite` to devDependencies in `packages/dawcore/package.json`:
```json
"vite": "^6.0.0"
```

Add a dev server script:
```json
"dev:page": "vite --config dev/vite.config.ts"
```

- [ ] **Step 4: Install, test dev server**

Run: `pnpm install && cd packages/dawcore && pnpm dev:page`
Expected: Vite dev server starts, opens browser at localhost:5173, page renders with transport buttons. Audio loads and waveform appears (may require clicking Play to initialize AudioContext). Playhead animates during playback.

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/dev/ packages/dawcore/package.json pnpm-lock.yaml
git commit -m "feat(dawcore): add dev page with Vite server for manual testing"
```

---

### Task 12: `<daw-ruler>` Element

Time ruler with tick marks. Port temporal mode from SmartScale. Beats & bars mode deferred.

**Files:**
- Create: `packages/dawcore/src/utils/smart-scale.ts`
- Create: `packages/dawcore/src/utils/time-format.ts`
- Create: `packages/dawcore/src/elements/daw-ruler.ts`
- Create: `packages/dawcore/src/__tests__/daw-ruler.test.ts`
- Modify: `packages/dawcore/src/index.ts`

**Reference:** `packages/ui-components/src/components/SmartScale.tsx` (tick computation logic), `packages/ui-components/src/utils/timeFormat.ts`

- [ ] **Step 1: Port time-format.ts**

Copy `packages/ui-components/src/utils/timeFormat.ts` to `packages/dawcore/src/utils/time-format.ts`. Remove any React-specific imports if present. This file contains `formatTime()` and related helpers.

- [ ] **Step 2: Port smart-scale.ts**

Extract the tick computation logic from `SmartScale.tsx` into a pure function in `packages/dawcore/src/utils/smart-scale.ts`. The function should take `samplesPerPixel`, `sampleRate`, and `totalWidth`, and return tick data (Map of pixel positions to tick heights + array of label positions).

Strip out:
- React hooks (`useLayoutEffect`, `useMemo`, `useRef`)
- Styled components
- Canvas rendering (that goes in the element)
- Beats & bars mode (deferred — only port temporal mode for now)

Keep:
- `timeinfo` map (zoom level → marker/bigStep/smallStep)
- `getScaleInfo(samplesPerPixel)` function
- Tick iteration logic with modulo-based height assignment

- [ ] **Step 3: Write daw-ruler element**

The ruler element follows the same chunked canvas pattern as `<daw-waveform>`. It receives `samplesPerPixel`, `sampleRate`, `duration`, and `totalWidth` as JS properties from the editor. In `updated()`, it computes ticks via the ported smart-scale logic and draws to visible canvases.

- [ ] **Step 4: Write test, add to index, verify, commit**

```bash
git add packages/dawcore/src/utils/smart-scale.ts packages/dawcore/src/utils/time-format.ts packages/dawcore/src/elements/daw-ruler.ts packages/dawcore/src/__tests__/daw-ruler.test.ts packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add daw-ruler element — temporal time scale"
```

---

### Task 13: Final Integration and Verify

Wire ruler into editor's Shadow DOM, run full build, verify dev page.

**Files:**
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (add ruler to render)
- Modify: `packages/dawcore/src/index.ts` (ensure all exports)

- [ ] **Step 1: Add ruler to editor render**

In `daw-editor.ts`, add conditional ruler rendering when `timescale` attribute is set:

```typescript
${this.timescale ? html`
  <daw-ruler
    .samplesPerPixel=${this.samplesPerPixel}
    .sampleRate=${this._sampleRate}
    .duration=${this._duration}
    .totalWidth=${this._totalWidth}
  ></daw-ruler>
` : nothing}
```

- [ ] **Step 2: Run full build**

Run: `cd /Users/naomiaro/Code/waveform-playlist && pnpm build`
Expected: All packages build successfully including dawcore

- [ ] **Step 3: Run all dawcore tests**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && npx vitest run`
Expected: All tests pass

- [ ] **Step 4: Run lint**

Run: `cd /Users/naomiaro/Code/waveform-playlist && pnpm lint`
Expected: No lint errors. Fix any formatting issues with `pnpm format`.

- [ ] **Step 5: Manual test on dev page**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/dawcore && pnpm dev:page`

Verify:
- [ ] Waveform renders after audio loads
- [ ] Ruler shows time ticks (when `timescale` attribute is set)
- [ ] Clicking Play starts playback and playhead animates
- [ ] Clicking Pause stops playhead, resumes from current position
- [ ] Clicking Stop stops playhead, resets to start
- [ ] CSS custom properties apply (wave color, playhead color, background)

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/
git commit -m "feat(dawcore): wire ruler into editor, verify full integration"
```

- [ ] **Step 7: Kill any orphaned processes**

Run: `pgrep -f vitest` and `pkill -f vitest` if any stale processes found.
