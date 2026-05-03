# dawcore MIDI Tracks (Tone Adapter Path) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Programmatic MIDI clips in dawcore render as piano-roll and play back via `TonePlayoutAdapter`.

**Architecture:** A clip is MIDI iff `clip.midiNotes != null` (matching `TonePlayoutAdapter`'s existing discriminator). `<daw-track render-mode="piano-roll">` controls renderer choice. Editor's `_loadTrack` adds a per-clip MIDI branch that skips fetch + decode + peaks and registers the clip in the engine via `createClip({ sampleRate, sourceDurationSamples, midiNotes })`. The Tone adapter handles playback unchanged.

**Tech Stack:** Lit 3, TypeScript, vitest + happy-dom, tsup, pnpm workspaces, `@waveform-playlist/core`, `@waveform-playlist/engine`, `@waveform-playlist/playout` (Tone.js consumer side).

**Spec:** [`docs/specs/2026-05-02-dawcore-midi-tone-design.md`](../specs/2026-05-02-dawcore-midi-tone-design.md)

---

## File Structure

**Created:**

- `packages/dawcore/src/elements/daw-piano-roll.ts` — Visual element for note rendering (Shadow DOM, chunked canvas, ~190 LOC budget).
- `packages/dawcore/src/__tests__/daw-piano-roll.test.ts` — Unit tests for the new element.
- `examples/dawcore-tone/midi.html` — Programmatic demo page.

**Modified:**

- `packages/dawcore/src/elements/daw-clip.ts` — Add `midiNotes` JS property + `midi-channel` / `midi-program` reflected attrs.
- `packages/dawcore/src/elements/daw-track.ts` — Add `render-mode` reflected attribute.
- `packages/dawcore/src/elements/daw-editor.ts` — MIDI-aware `_loadTrack` branch + render branch + `_applyClipUpdate` MIDI path + `addTrack` sugar.
- `packages/dawcore/src/types.ts` — Descriptor + config additions.
- `packages/dawcore/src/index.ts` — Re-export `DawPianoRollElement`.
- `packages/dawcore/src/interactions/clip-pointer-handler.ts` — Skip trim handles for MIDI clips.
- `packages/dawcore/src/interactions/split-handler.ts` — `canSplitAtTime` returns false for MIDI clips.
- `packages/dawcore/src/__tests__/daw-clip.test.ts` — New tests for MIDI surface.
- `packages/dawcore/src/__tests__/daw-track.test.ts` — New test for `render-mode`.
- `packages/dawcore/src/__tests__/daw-editor.test.ts` — New tests for MIDI loading + render branch.
- `packages/dawcore/src/__tests__/clip-pointer-handler.test.ts` — Test for trim guard.

**Not Touched (per spec non-goals):**

- `packages/dawcore/src/interactions/file-loader.ts` — file drop stays audio-only.
- `packages/core`, `packages/engine`, `packages/playout`, `packages/transport` — MIDI plumbing already exists or out of scope.
- `packages/midi` — `.mid` parsing not consumed yet.

---

## Conventions for All Tasks

- **Run typecheck per-package**, not at root: `cd packages/dawcore && pnpm typecheck` (root `pnpm typecheck` fails on the unrelated browser package per `feedback_dawcore_typecheck.md`).
- **Run lint from repo root**: `pnpm lint` (root-only script).
- **Run unit tests per-package**: `cd packages/dawcore && npx vitest run` (or `npx vitest run path/to/test.ts` to target one file).
- **Git commands from repo root** (per `feedback_git_from_root.md`): `git add packages/dawcore/...` not `git add ...` from the package dir.
- **One commit per task** unless a task says otherwise. Use conventional-commits prefix (`feat:`, `test:`, `refactor:`).
- **Tests use happy-dom** (already configured in `packages/dawcore/vitest.config.ts`). Mock `canvas.getContext('2d')` per the dawcore CLAUDE.md notes.
- **Hold off committing if a step fails** — fix root cause before moving on.

---

## Task 1: `<daw-clip>` MIDI Surface (Properties + Attrs + Descriptor)

**Files:**

- Modify: `packages/dawcore/src/types.ts:16-27` (add MIDI fields to `BaseClipDescriptor`)
- Modify: `packages/dawcore/src/types.ts:80-91` (add MIDI fields to `ClipConfig`)
- Modify: `packages/dawcore/src/elements/daw-clip.ts` (entire file)
- Modify: `packages/dawcore/src/__tests__/daw-clip.test.ts` (extend)
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (`_readTrackDescriptor` line ~985 + `_onClipConnected` line ~650 + `_buildClipElement` line ~1606 — populate new fields)
- Modify: `packages/dawcore/src/interactions/file-loader.ts` (default new fields to `null` in synthesized descriptors)

- [ ] **Step 1: Write failing tests**

Add to `packages/dawcore/src/__tests__/daw-clip.test.ts` (inside the existing `describe('DawClipElement', ...)` block):

```typescript
it('exposes midiNotes JS property defaulting to null', () => {
  const el = document.createElement('daw-clip') as any;
  expect(el.midiNotes).toBeNull();
});

it('reflects midi-channel attribute as midiChannel number', () => {
  const el = document.createElement('daw-clip') as any;
  el.setAttribute('midi-channel', '9');
  expect(el.midiChannel).toBe(9);
});

it('reflects midi-program attribute as midiProgram number', () => {
  const el = document.createElement('daw-clip') as any;
  el.setAttribute('midi-program', '24');
  expect(el.midiProgram).toBe(24);
});

it('dispatches daw-clip-update when midiNotes is set after first render', async () => {
  const trackEl = document.createElement('daw-track') as any;
  const clipEl = document.createElement('daw-clip') as any;
  trackEl.appendChild(clipEl);
  document.body.appendChild(trackEl);
  // Force first render so the next update fires daw-clip-update
  await clipEl.updateComplete;

  let detail: any = null;
  trackEl.addEventListener('daw-clip-update', (e: any) => {
    detail = e.detail;
  });

  clipEl.midiNotes = [
    { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
  ];
  await clipEl.updateComplete;

  expect(detail).toEqual({ trackId: trackEl.trackId, clipId: clipEl.clipId });
  document.body.removeChild(trackEl);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-clip.test.ts`
Expected: 4 failures (`midiNotes`, `midiChannel`, `midiProgram` undefined; update event not dispatched).

- [ ] **Step 3: Update `types.ts`**

Replace the `BaseClipDescriptor` interface in `packages/dawcore/src/types.ts:16-27`:

```typescript
import type { FadeType, MidiNoteData } from '@waveform-playlist/core';

export interface TrackDescriptor {
  name: string;
  src: string;
  volume: number;
  pan: number;
  muted: boolean;
  soloed: boolean;
  renderMode: 'waveform' | 'piano-roll';
  clips: ClipDescriptor[];
}

interface BaseClipDescriptor {
  src: string;
  peaksSrc: string;
  start: number;
  duration: number;
  offset: number;
  gain: number;
  name: string;
  fadeIn: number;
  fadeOut: number;
  fadeType: FadeType;
  midiNotes: MidiNoteData[] | null;
  midiChannel: number | null;
  midiProgram: number | null;
}
```

(The `renderMode` field on `TrackDescriptor` lands in this task too — it will be wired in Task 2 but the type slot exists now to avoid an interim broken state.)

Update `ClipConfig` (around line 80) — add at the bottom:

```typescript
export interface ClipConfig {
  src?: string;
  peaksSrc?: string;
  start?: number;
  duration?: number;
  offset?: number;
  gain?: number;
  name?: string;
  fadeIn?: number;
  fadeOut?: number;
  fadeType?: FadeType;
  midiNotes?: MidiNoteData[];
  midiChannel?: number;
  midiProgram?: number;
}
```

Note: `src` becomes optional here (was required) — needed for MIDI clips with no audio source. The runtime check in `addClip` (`packages/dawcore/src/elements/daw-editor.ts:1495`) already rejects empty src; we'll relax it in Task 7 when adding `addTrack({ midi })`.

- [ ] **Step 4: Add MIDI properties to `<daw-clip>`**

In `packages/dawcore/src/elements/daw-clip.ts`, add imports and new `@property` declarations between the existing properties and `clipId`:

```typescript
import { LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { MidiNoteData } from '@waveform-playlist/core';

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

  /** MIDI notes — JS property only, not reflected (note arrays are too large for attributes). */
  @property({ attribute: false }) midiNotes: MidiNoteData[] | null = null;

  /** MIDI channel (0-indexed). Channel 9 = GM percussion. */
  @property({ type: Number, attribute: 'midi-channel' }) midiChannel: number | null = null;

  /** MIDI program (GM instrument 0-127). Used by SoundFontToneTrack. */
  @property({ type: Number, attribute: 'midi-program' }) midiProgram: number | null = null;

  readonly clipId = crypto.randomUUID();
  // ... rest unchanged
```

In the `updated()` method's prop list, add `midiNotes`, `midiChannel`, `midiProgram` so updates dispatch `daw-clip-update`:

```typescript
const clipProps = [
  'src',
  'peaksSrc',
  'start',
  'duration',
  'offset',
  'gain',
  'name',
  'fadeIn',
  'fadeOut',
  'fadeType',
  'midiNotes',
  'midiChannel',
  'midiProgram',
];
```

- [ ] **Step 5: Wire descriptors through editor read paths**

In `packages/dawcore/src/elements/daw-editor.ts`:

`_readTrackDescriptor` (line ~985), inside the `clips.push({...})` for both the `<daw-track src>` shorthand and the `<daw-clip>` iteration, add:

```typescript
// shorthand branch (no <daw-clip> children):
clips.push({
  kind: 'drop',
  // ... existing fields
  midiNotes: null,
  midiChannel: null,
  midiProgram: null,
});

// per-clip branch:
clips.push({
  kind: 'dom',
  clipId: clipEl.clipId,
  // ... existing fields
  midiNotes: clipEl.midiNotes,
  midiChannel: clipEl.midiChannel,
  midiProgram: clipEl.midiProgram,
});
```

In the same method, the returned `TrackDescriptor` literal (~line 1025) — add:

```typescript
return {
  name: trackEl.name || 'Untitled',
  src: trackEl.src,
  volume: trackEl.volume,
  pan: trackEl.pan,
  muted: trackEl.muted,
  soloed: trackEl.soloed,
  renderMode: 'waveform', // wired in Task 2
  clips,
};
```

In `_onClipConnected` (line ~650), the `clipDesc` literal — add:

```typescript
const clipDesc: ClipDescriptor = {
  kind: 'dom',
  clipId: clipEl.clipId,
  // ... existing fields
  midiNotes: clipEl.midiNotes,
  midiChannel: clipEl.midiChannel,
  midiProgram: clipEl.midiProgram,
};
```

In `_buildClipElement` (line ~1606), add config-driven setters at the bottom of the body:

```typescript
private _buildClipElement(config: ClipConfig): DawClipElement {
  const clipEl = document.createElement('daw-clip') as DawClipElement;
  if (config.src !== undefined) clipEl.setAttribute('src', config.src);
  if (config.peaksSrc !== undefined) clipEl.setAttribute('peaks-src', config.peaksSrc);
  if (config.start !== undefined) clipEl.start = config.start;
  if (config.duration !== undefined) clipEl.duration = config.duration;
  if (config.offset !== undefined) clipEl.offset = config.offset;
  if (config.gain !== undefined) clipEl.gain = config.gain;
  if (config.name !== undefined) clipEl.setAttribute('name', config.name);
  if (config.fadeIn !== undefined) clipEl.fadeIn = config.fadeIn;
  if (config.fadeOut !== undefined) clipEl.fadeOut = config.fadeOut;
  if (config.fadeType !== undefined) clipEl.setAttribute('fade-type', config.fadeType);
  if (config.midiNotes !== undefined) clipEl.midiNotes = config.midiNotes;
  if (config.midiChannel !== undefined) clipEl.setAttribute('midi-channel', String(config.midiChannel));
  if (config.midiProgram !== undefined) clipEl.setAttribute('midi-program', String(config.midiProgram));
  return clipEl;
}
```

- [ ] **Step 6: Update `file-loader.ts` to populate the new fields**

In `packages/dawcore/src/interactions/file-loader.ts`, find every `clips.push({ kind: 'drop', ... })` (or equivalent descriptor construction). Add the three new fields with `null` values to each. Also add `renderMode: 'waveform'` to any `TrackDescriptor` constructed there.

If unsure where the constructions are, run from repo root:

```bash
grep -n "kind: 'drop'\|kind: 'dom'" packages/dawcore/src/interactions/file-loader.ts
```

Expected: ~1-2 sites. Add the three MIDI fields (`null`) and `renderMode: 'waveform'` to each.

- [ ] **Step 7: Run typecheck**

Run: `cd packages/dawcore && pnpm typecheck`
Expected: PASS. If any consumer of `TrackDescriptor` / `ClipDescriptor` / `ClipConfig` complains, fix at the callsite (most likely `recording-clip.ts` and any tests that build mock descriptors).

- [ ] **Step 8: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-clip.test.ts`
Expected: PASS. All 4 new tests green; existing tests unaffected.

- [ ] **Step 9: Run full test suite**

Run: `cd packages/dawcore && npx vitest run`
Expected: PASS. Check for regressions in `daw-editor*.test.ts` — most likely failure mode is mock descriptors missing the new fields. Add `midiNotes: null, midiChannel: null, midiProgram: null, renderMode: 'waveform'` to any failing mock.

- [ ] **Step 10: Lint**

Run: `pnpm lint` (from repo root).
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add packages/dawcore/src/elements/daw-clip.ts \
        packages/dawcore/src/elements/daw-editor.ts \
        packages/dawcore/src/types.ts \
        packages/dawcore/src/interactions/file-loader.ts \
        packages/dawcore/src/__tests__/
git commit -m "feat(dawcore): add MIDI surface to <daw-clip>

- midiNotes JS property (not reflected — note arrays too large for attributes)
- midi-channel / midi-program reflected number attributes
- TrackDescriptor.renderMode + BaseClipDescriptor MIDI fields
- ClipConfig.midi* passthrough in _buildClipElement"
```

---

## Task 2: `<daw-track render-mode>` Attribute

**Files:**

- Modify: `packages/dawcore/src/elements/daw-track.ts` (entire file)
- Modify: `packages/dawcore/src/__tests__/daw-track.test.ts` (extend)
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (`_readTrackDescriptor` — wire `renderMode`)

- [ ] **Step 1: Write failing tests**

Add to `packages/dawcore/src/__tests__/daw-track.test.ts` (inside the existing describe):

```typescript
it('defaults renderMode to "waveform"', () => {
  const el = document.createElement('daw-track') as any;
  expect(el.renderMode).toBe('waveform');
});

it('reflects render-mode attribute', () => {
  const el = document.createElement('daw-track') as any;
  el.setAttribute('render-mode', 'piano-roll');
  expect(el.renderMode).toBe('piano-roll');
});

it('dispatches daw-track-update when renderMode changes after first render', async () => {
  const el = document.createElement('daw-track') as any;
  document.body.appendChild(el);
  await el.updateComplete;

  let detail: any = null;
  el.addEventListener('daw-track-update', (e: any) => {
    detail = e.detail;
  });

  el.renderMode = 'piano-roll';
  await el.updateComplete;

  expect(detail).toEqual({ trackId: el.trackId });
  document.body.removeChild(el);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-track.test.ts`
Expected: 3 failures.

- [ ] **Step 3: Add `render-mode` to `<daw-track>`**

In `packages/dawcore/src/elements/daw-track.ts`, add the new `@property` declaration after `soloed`:

```typescript
@property({ type: Boolean }) muted = false;
@property({ type: Boolean }) soloed = false;
@property({ attribute: 'render-mode' }) renderMode: 'waveform' | 'piano-roll' = 'waveform';
```

In the `updated()` method's `trackProps` list (line ~52), add `'renderMode'`:

```typescript
const trackProps = ['volume', 'pan', 'muted', 'soloed', 'src', 'name', 'renderMode'];
```

- [ ] **Step 4: Wire `renderMode` into the descriptor**

In `packages/dawcore/src/elements/daw-editor.ts`, `_readTrackDescriptor`'s return literal — replace the placeholder from Task 1:

```typescript
return {
  name: trackEl.name || 'Untitled',
  src: trackEl.src,
  volume: trackEl.volume,
  pan: trackEl.pan,
  muted: trackEl.muted,
  soloed: trackEl.soloed,
  renderMode: trackEl.renderMode,
  clips,
};
```

- [ ] **Step 5: Run typecheck + tests + lint**

```bash
cd packages/dawcore && pnpm typecheck && npx vitest run && cd ../.. && pnpm lint
```

Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-track.ts \
        packages/dawcore/src/elements/daw-editor.ts \
        packages/dawcore/src/__tests__/daw-track.test.ts
git commit -m "feat(dawcore): add render-mode attribute to <daw-track>

Reflected attribute 'render-mode' (string), JS property 'renderMode'
('waveform' | 'piano-roll', default 'waveform'). Dispatches existing
daw-track-update event on change. Wired through _readTrackDescriptor
to the TrackDescriptor.renderMode field."
```

---

## Task 3: `<daw-piano-roll>` Element

**Files:**

- Create: `packages/dawcore/src/elements/daw-piano-roll.ts`
- Create: `packages/dawcore/src/__tests__/daw-piano-roll.test.ts`
- Modify: `packages/dawcore/src/index.ts` (re-export)

- [ ] **Step 1: Write failing tests**

Create `packages/dawcore/src/__tests__/daw-piano-roll.test.ts`:

```typescript
import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

let rafCallbacks: Array<(time: number) => void>;

function flushRaf() {
  const cbs = rafCallbacks.splice(0);
  cbs.forEach((cb) => cb(performance.now()));
}

beforeAll(async () => {
  await import('../elements/daw-piano-roll');
});

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
  vi.stubGlobal('devicePixelRatio', 1);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('DawPianoRollElement', () => {
  it('is registered as a custom element', () => {
    expect(customElements.get('daw-piano-roll')).toBeDefined();
  });

  it('uses Shadow DOM', () => {
    const el = document.createElement('daw-piano-roll') as any;
    document.body.appendChild(el);
    expect(el.shadowRoot).toBeTruthy();
    document.body.removeChild(el);
  });

  it('has default property values', () => {
    const el = document.createElement('daw-piano-roll') as any;
    expect(el.midiNotes).toEqual([]);
    expect(el.length).toBe(0);
    expect(el.waveHeight).toBe(128);
    expect(el.samplesPerPixel).toBe(1024);
    expect(el.sampleRate).toBe(48000);
    expect(el.clipOffsetSeconds).toBe(0);
  });

  it('renders chunked canvases based on length', async () => {
    const el = document.createElement('daw-piano-roll') as any;
    el.length = 2500; // 1000 + 1000 + 500 → 3 chunks
    document.body.appendChild(el);
    await el.updateComplete;
    flushRaf();

    const canvases = el.shadowRoot.querySelectorAll('canvas');
    expect(canvases.length).toBe(3);
    document.body.removeChild(el);
  });

  it('draws notes when midiNotes is set', async () => {
    const fillRect = vi.fn();
    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect,
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
      imageSmoothingEnabled: false,
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    const el = document.createElement('daw-piano-roll') as any;
    el.length = 1000;
    el.sampleRate = 48000;
    el.samplesPerPixel = 1024;
    el.midiNotes = [
      { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
      { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.6 },
    ];
    document.body.appendChild(el);
    await el.updateComplete;
    flushRaf();

    expect(mockCtx.clearRect).toHaveBeenCalled();
    expect(mockCtx.fill).toHaveBeenCalledTimes(2); // one per note
    document.body.removeChild(el);
    vi.restoreAllMocks();
  });

  it('skips notes outside the visible chunk time range', async () => {
    const mockCtx = {
      clearRect: vi.fn(),
      resetTransform: vi.fn(),
      scale: vi.fn(),
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      roundRect: vi.fn(),
      fill: vi.fn(),
      fillStyle: '',
      globalAlpha: 1,
      imageSmoothingEnabled: false,
    };
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(mockCtx as any);

    const el = document.createElement('daw-piano-roll') as any;
    el.length = 1000;
    el.sampleRate = 48000;
    el.samplesPerPixel = 48; // 1px = 1ms
    // Note at time=10s — outside the 0..1000ms chunk
    el.midiNotes = [{ midi: 60, name: 'C4', time: 10, duration: 0.1, velocity: 0.5 }];
    document.body.appendChild(el);
    await el.updateComplete;
    flushRaf();

    expect(mockCtx.fill).not.toHaveBeenCalled();
    document.body.removeChild(el);
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-piano-roll.test.ts`
Expected: All 6 tests FAIL with "Cannot find module" or similar — file doesn't exist yet.

- [ ] **Step 3: Implement `<daw-piano-roll>`**

Create `packages/dawcore/src/elements/daw-piano-roll.ts`:

```typescript
import { LitElement, html, css } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import type { PropertyValues } from 'lit';
import type { MidiNoteData } from '@waveform-playlist/core';
import { getVisibleChunkIndices } from '../utils/viewport';

const MAX_CANVAS_WIDTH = 1000;

@customElement('daw-piano-roll')
export class DawPianoRollElement extends LitElement {
  @property({ attribute: false }) midiNotes: MidiNoteData[] = [];
  @property({ type: Number }) length = 0;
  @property({ type: Number, attribute: 'wave-height' }) waveHeight = 128;
  @property({ type: Number, attribute: 'samples-per-pixel' }) samplesPerPixel = 1024;
  @property({ type: Number, attribute: 'sample-rate' }) sampleRate = 48000;
  @property({ type: Number, attribute: 'clip-offset-seconds' }) clipOffsetSeconds = 0;
  @property({ type: Number, attribute: 'visible-start' }) visibleStart = -Infinity;
  @property({ type: Number, attribute: 'visible-end' }) visibleEnd = Infinity;
  @property({ type: Number, attribute: 'origin-x' }) originX = 0;
  @property({ type: Boolean, reflect: true }) selected = false;

  static styles = css`
    :host {
      display: block;
      position: relative;
      background: var(--daw-piano-roll-background, #1a1a2e);
    }
    canvas {
      position: absolute;
      top: 0;
      image-rendering: pixelated;
      image-rendering: crisp-edges;
    }
  `;

  private _rafHandle: number | null = null;

  willUpdate(_changed: PropertyValues) {
    // Schedule a redraw after the DOM updates so canvases exist when we draw.
    if (this._rafHandle !== null) cancelAnimationFrame(this._rafHandle);
    this._rafHandle = requestAnimationFrame(() => {
      this._rafHandle = null;
      this._draw();
    });
  }

  private _getPitchRange(): { minMidi: number; maxMidi: number } {
    if (this.midiNotes.length === 0) return { minMidi: 0, maxMidi: 127 };
    let min = 127;
    let max = 0;
    for (const note of this.midiNotes) {
      if (note.midi < min) min = note.midi;
      if (note.midi > max) max = note.midi;
    }
    return {
      minMidi: Math.max(0, min - 1),
      maxMidi: Math.min(127, max + 1),
    };
  }

  private _getNoteColor(): string {
    const cs = getComputedStyle(this);
    const note = cs.getPropertyValue('--daw-piano-roll-note-color').trim() || '#2a7070';
    const selected =
      cs.getPropertyValue('--daw-piano-roll-selected-note-color').trim() || '#3d9e9e';
    return this.selected ? selected : note;
  }

  private _draw() {
    if (!this.shadowRoot) return;
    const canvases = this.shadowRoot.querySelectorAll('canvas');
    if (canvases.length === 0) return;

    const { minMidi, maxMidi } = this._getPitchRange();
    const noteRange = maxMidi - minMidi + 1;
    const noteHeight = Math.max(2, this.waveHeight / noteRange);
    const pixelsPerSecond = this.sampleRate / this.samplesPerPixel;
    const dpr = devicePixelRatio || 1;
    const color = this._getNoteColor();

    for (const canvas of canvases) {
      const chunkIdx = Number(canvas.dataset.chunkIdx);
      const chunkPixelStart = chunkIdx * MAX_CANVAS_WIDTH;
      const canvasWidth = canvas.width / dpr;

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.resetTransform();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.imageSmoothingEnabled = false;
      ctx.scale(dpr, dpr);

      const chunkStartTime = (chunkPixelStart * this.samplesPerPixel) / this.sampleRate;
      const chunkEndTime =
        ((chunkPixelStart + canvasWidth) * this.samplesPerPixel) / this.sampleRate;

      for (const note of this.midiNotes) {
        const noteStart = note.time - this.clipOffsetSeconds;
        const noteEnd = noteStart + note.duration;
        if (noteEnd <= chunkStartTime || noteStart >= chunkEndTime) continue;

        const x = noteStart * pixelsPerSecond - chunkPixelStart;
        const w = Math.max(2, note.duration * pixelsPerSecond);
        const y = ((maxMidi - note.midi) / noteRange) * this.waveHeight;

        const alpha = 0.3 + note.velocity * 0.7;
        ctx.fillStyle = color;
        ctx.globalAlpha = alpha;

        ctx.beginPath();
        ctx.roundRect(x, y, w, noteHeight, 1);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    if (this._rafHandle !== null) {
      cancelAnimationFrame(this._rafHandle);
      this._rafHandle = null;
    }
  }

  render() {
    if (this.length <= 0) return html``;
    const dpr = devicePixelRatio || 1;
    const visibleIndices = getVisibleChunkIndices(
      this.length,
      MAX_CANVAS_WIDTH,
      this.visibleStart,
      this.visibleEnd,
      this.originX
    );
    return html`${visibleIndices.map((i) => {
      const chunkLeft = i * MAX_CANVAS_WIDTH;
      const chunkWidth = Math.min(this.length - chunkLeft, MAX_CANVAS_WIDTH);
      return html`<canvas
        data-chunk-idx=${i}
        width=${chunkWidth * dpr}
        height=${this.waveHeight * dpr}
        style="left:${chunkLeft}px;width:${chunkWidth}px;height:${this.waveHeight}px;"
      ></canvas>`;
    })}`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-piano-roll': DawPianoRollElement;
  }
}
```

- [ ] **Step 4: Verify `getVisibleChunkIndices` signature matches**

Run: `grep -n "export function getVisibleChunkIndices" packages/dawcore/src/utils/viewport.ts`

If the signature differs from `(length, chunkWidth, visibleStart, visibleEnd, originX)`, adapt the `render()` call to match. The function exists per dawcore CLAUDE.md "Virtual Scrolling" section — it's used by `<daw-waveform>`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-piano-roll.test.ts`
Expected: All 6 tests PASS.

- [ ] **Step 6: Re-export from package index**

In `packages/dawcore/src/index.ts`, add the side-effect import next to the others (alphabetical-ish order is fine):

```typescript
import './elements/daw-piano-roll';
```

And the type re-export:

```typescript
export { DawPianoRollElement } from './elements/daw-piano-roll';
```

- [ ] **Step 7: Run typecheck + full tests + lint**

```bash
cd packages/dawcore && pnpm typecheck && npx vitest run && cd ../.. && pnpm lint
```

Expected: all PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/dawcore/src/elements/daw-piano-roll.ts \
        packages/dawcore/src/__tests__/daw-piano-roll.test.ts \
        packages/dawcore/src/index.ts
git commit -m "feat(dawcore): add <daw-piano-roll> element

Shadow DOM, chunked canvas rendering (1000px chunks). Mirrors the
<daw-waveform> virtual-scroll pattern. Auto-fits pitch range to
note data, velocity → opacity (0.3-1.0), 2px min note dimensions.
Reads --daw-piano-roll-* CSS custom props for theming."
```

---

## Task 4: Editor — MIDI Clip Path in `_loadTrack`

**Files:**

- Modify: `packages/dawcore/src/elements/daw-editor.ts` (`_loadTrack` ~line 1033, add MIDI branch)
- Modify: `packages/dawcore/src/__tests__/daw-editor-programmatic.test.ts` (extend) or add new file `packages/dawcore/src/__tests__/daw-editor-midi.test.ts`

- [ ] **Step 1: Write failing test**

Create `packages/dawcore/src/__tests__/daw-editor-midi.test.ts`:

```typescript
import { describe, it, expect, beforeAll, vi, beforeEach, afterEach } from 'vitest';

beforeAll(async () => {
  await import('../elements/daw-editor');
  await import('../elements/daw-track');
  await import('../elements/daw-clip');
});

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.stubGlobal('devicePixelRatio', 1);
  fetchSpy = vi.fn().mockRejectedValue(new Error('fetch should not have been called'));
  vi.stubGlobal('fetch', fetchSpy);
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

describe('<daw-editor> MIDI loading', () => {
  it('does not fetch when a clip has midiNotes set', async () => {
    const editor = document.createElement('daw-editor') as any;
    editor.adapter = makeMockAdapter();
    document.body.appendChild(editor);

    const track = document.createElement('daw-track') as any;
    track.setAttribute('render-mode', 'piano-roll');
    track.setAttribute('name', 'Lead');

    const clip = document.createElement('daw-clip') as any;
    clip.midiNotes = [
      { midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 },
      { midi: 64, name: 'E4', time: 0.5, duration: 0.5, velocity: 0.7 },
    ];
    track.appendChild(clip);
    editor.appendChild(track);

    // Wait for daw-track-connected → _loadTrack
    await new Promise<void>((resolve) => {
      track.addEventListener('daw-track-ready', () => resolve(), { once: true });
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    document.body.removeChild(editor);
  });

  it('passes midiNotes through to engine.setTracks', async () => {
    const editor = document.createElement('daw-editor') as any;
    const adapter = makeMockAdapter();
    editor.adapter = adapter;
    document.body.appendChild(editor);

    const track = document.createElement('daw-track') as any;
    track.setAttribute('render-mode', 'piano-roll');
    const clip = document.createElement('daw-clip') as any;
    const notes = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];
    clip.midiNotes = notes;
    track.appendChild(clip);
    editor.appendChild(track);

    await new Promise<void>((resolve) => {
      track.addEventListener('daw-track-ready', () => resolve(), { once: true });
    });

    // Inspect the last setTracks call
    const lastCall = adapter.setTracks.mock.calls.at(-1);
    expect(lastCall).toBeDefined();
    const tracks = lastCall![0];
    expect(tracks).toHaveLength(1);
    expect(tracks[0].clips).toHaveLength(1);
    expect(tracks[0].clips[0].midiNotes).toEqual(notes);
    expect(tracks[0].clips[0].audioBuffer).toBeUndefined();
    document.body.removeChild(editor);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-midi.test.ts`
Expected: FAIL — likely with "fetch should not have been called" (existing path tries to fetch even when src is empty), or the test times out waiting for `daw-track-ready` because the empty-src guard skips the load entirely.

- [ ] **Step 3: Add MIDI branch to `_loadTrack`**

In `packages/dawcore/src/elements/daw-editor.ts`, find `_loadTrack` (around line 1033). The current loop body is:

```typescript
for (const clipDesc of descriptor.clips) {
  if (!clipDesc.src) continue;
  // ... per-clip try/catch with audio path
}
```

Replace the `continue` with the MIDI branch:

```typescript
for (const clipDesc of descriptor.clips) {
  if (!clipDesc.src) {
    // MIDI clip path: no fetch, no peaks, register the clip directly.
    // Always registers (even with no notes / no duration) so late note
    // arrivals via daw-clip-update can find the clip in _engineTracks.
    clips.push(this._buildMidiClip(clipDesc));
    continue;
  }
  // ... existing per-clip try/catch with audio path (unchanged)
}
```

Add the helper method on the editor class (place it near `_finalizeAudioClip`):

```typescript
/**
 * Build an engine clip from a MIDI clip descriptor. Always returns a clip
 * — empty notes / no declared duration get a 1-second placeholder span so
 * the clip is reachable via `engine.updateTrack` once notes arrive.
 */
private _buildMidiClip(clipDesc: ClipDescriptor): AudioClip {
  const sr = this.effectiveSampleRate;
  const notes = clipDesc.midiNotes ?? [];
  const noteSpanSeconds = notes.length
    ? Math.max(...notes.map((n) => n.time + n.duration))
    : 0;
  const sourceDurationSamples = Math.ceil(
    Math.max(noteSpanSeconds, clipDesc.duration, 1) * sr
  );
  const requestedDurationSamples =
    clipDesc.duration > 0
      ? Math.round(clipDesc.duration * sr)
      : sourceDurationSamples;

  const clip = createClip({
    startSample: Math.round(clipDesc.start * sr),
    durationSamples: requestedDurationSamples,
    offsetSamples: Math.round(clipDesc.offset * sr),
    sampleRate: sr,
    sourceDurationSamples,
    gain: clipDesc.gain,
    name: clipDesc.name,
    midiNotes: notes,
    midiChannel: clipDesc.midiChannel ?? undefined,
    midiProgram: clipDesc.midiProgram ?? undefined,
  });
  if (isDomClip(clipDesc)) clip.id = clipDesc.clipId;
  return clip;
}
```

- [ ] **Step 4: Verify post-loop dispatches `daw-track-ready` for MIDI-only tracks**

The post-loop guard (in `_loadTrack` after the clips iteration) is:

```typescript
const requestedClips = descriptor.clips.filter((c) => c.src).length;
if (requestedClips > 0 && clips.length === 0) {
  throw new Error(...);
}
```

For a MIDI-only track: `requestedClips === 0` (no clips have src), the guard short-circuits, the track is built, `engine.setTracks(...)` is called, and `daw-track-ready` is dispatched. **No change needed** — confirm by reading lines 1170-1180 of `packages/dawcore/src/elements/daw-editor.ts`.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-midi.test.ts`
Expected: Both tests PASS.

If `setTracks` is being called but with the wrong shape, log the actual call and adjust the helper. If fetch is still being called, the descriptor's `src` field isn't empty — check `<daw-clip>`'s default `src = ''`.

- [ ] **Step 6: Run full editor tests for regressions**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor`
Expected: PASS. Existing audio-path tests must still work — the new branch only fires when `src` is empty.

- [ ] **Step 7: Lint + typecheck**

```bash
cd packages/dawcore && pnpm typecheck && cd ../.. && pnpm lint
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts \
        packages/dawcore/src/__tests__/daw-editor-midi.test.ts
git commit -m "feat(dawcore): MIDI clip path in <daw-editor>._loadTrack

Per-clip branch: clips with no src skip fetch+decode+peaks and register
directly via createClip({sampleRate, sourceDurationSamples, midiNotes}).
sourceDurationSamples derives from max(note.time + note.duration) when
notes are present, or from the declared clip.duration as a placeholder."
```

---

## Task 5: Editor — Render Branch for Piano-Roll

**Files:**

- Modify: `packages/dawcore/src/elements/daw-editor.ts` (per-clip render block at line ~2080)
- Modify: `packages/dawcore/src/__tests__/daw-editor-midi.test.ts` (extend)

- [ ] **Step 1: Write failing test**

Add to `packages/dawcore/src/__tests__/daw-editor-midi.test.ts`:

```typescript
it('mounts <daw-piano-roll> when track.renderMode === "piano-roll"', async () => {
  await import('../elements/daw-piano-roll');
  const editor = document.createElement('daw-editor') as any;
  editor.adapter = makeMockAdapter();
  document.body.appendChild(editor);

  const track = document.createElement('daw-track') as any;
  track.setAttribute('render-mode', 'piano-roll');
  const clip = document.createElement('daw-clip') as any;
  clip.midiNotes = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];
  track.appendChild(clip);
  editor.appendChild(track);

  await new Promise<void>((resolve) => {
    track.addEventListener('daw-track-ready', () => resolve(), { once: true });
  });
  await editor.updateComplete;

  const pianoRoll = editor.shadowRoot.querySelector('daw-piano-roll');
  const waveform = editor.shadowRoot.querySelector('daw-waveform');
  expect(pianoRoll).toBeTruthy();
  expect(waveform).toBeFalsy();
  document.body.removeChild(editor);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-midi.test.ts -t "mounts <daw-piano-roll>"`
Expected: FAIL — `pianoRoll` is null because the render still mounts `<daw-waveform>`.

- [ ] **Step 3: Add render branch**

In `packages/dawcore/src/elements/daw-editor.ts`, find the per-clip render block (around line 2092, the `${channels.map((chPeaks, chIdx) => html\`<daw-waveform ...>`)} pattern).

Wrap it with the render-mode branch. The track descriptor (`t.descriptor`) carries `renderMode`:

```typescript
${t.descriptor?.renderMode === 'piano-roll'
  ? html`<daw-piano-roll
      style="position:absolute;left:0;top:${hdrH}px;"
      .midiNotes=${clip.midiNotes ?? []}
      .length=${peakData?.length ?? width}
      .waveHeight=${chH * channels.length}
      .samplesPerPixel=${this._renderSpp}
      .sampleRate=${this.effectiveSampleRate}
      .clipOffsetSeconds=${(clip.offsetSamples ?? 0) / this.effectiveSampleRate}
      .visibleStart=${this._viewport.visibleStart}
      .visibleEnd=${this._viewport.visibleEnd}
      .originX=${clipLeft}
      ?selected=${this._selectedTrackId === t.trackId}
    ></daw-piano-roll>`
  : channels.map(
      (chPeaks, chIdx) =>
        html` <daw-waveform
          style="position:absolute;left:0;top:${hdrH + chIdx * chH}px;"
          .peaks=${chPeaks}
          .length=${peakData?.length ?? width}
          .waveHeight=${chH}
          .barWidth=${this.barWidth}
          .barGap=${this.barGap}
          .visibleStart=${this._viewport.visibleStart}
          .visibleEnd=${this._viewport.visibleEnd}
          .originX=${clipLeft}
          .segments=${clipSegments}
        ></daw-waveform>`
    )}
```

If the editor doesn't have `_selectedTrackId` exposed on the iteration scope, omit the `?selected` binding for now — the piano-roll's `selected` attribute is already typed; it just defaults to false.

If `t.descriptor` is not in scope at this line (`t` may be a `ClipTrack` from the engine, not a `TrackDescriptor`), look for how the existing render computes things like `t.descriptor?.name` (used at line ~2089) — `t.descriptor` is already in scope per that pattern.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-midi.test.ts`
Expected: All tests in this file PASS.

- [ ] **Step 5: Full test pass + lint**

```bash
cd packages/dawcore && pnpm typecheck && npx vitest run && cd ../.. && pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts \
        packages/dawcore/src/__tests__/daw-editor-midi.test.ts
git commit -m "feat(dawcore): render <daw-piano-roll> when track.renderMode === 'piano-roll'

Render-mode alone decides the renderer — content type doesn't override.
Empty notes array passed for placeholder/audio clips in piano-roll mode.
Uses _renderSpp + effectiveSampleRate for note→pixel conversion."
```

---

## Task 6: Editor — Reactive MIDI Updates via `_applyClipUpdate`

**Files:**

- Modify: `packages/dawcore/src/elements/daw-editor.ts` (`_applyClipUpdate` around line 898)
- Modify: `packages/dawcore/src/__tests__/daw-editor-midi.test.ts` (extend)

- [ ] **Step 1: Write failing test**

Add to `packages/dawcore/src/__tests__/daw-editor-midi.test.ts`:

```typescript
it('updates engine clip when midiNotes is assigned after track-ready', async () => {
  const editor = document.createElement('daw-editor') as any;
  const adapter = makeMockAdapter();
  editor.adapter = adapter;
  document.body.appendChild(editor);

  const track = document.createElement('daw-track') as any;
  track.setAttribute('render-mode', 'piano-roll');
  const clip = document.createElement('daw-clip') as any;
  clip.duration = 4; // placeholder span — notes not yet set
  track.appendChild(clip);
  editor.appendChild(track);

  await new Promise<void>((resolve) => {
    track.addEventListener('daw-track-ready', () => resolve(), { once: true });
  });
  const setTracksCallsBefore = adapter.setTracks.mock.calls.length;

  // Now assign notes
  const notes = [
    { midi: 60, name: 'C4', time: 0, duration: 1, velocity: 0.8 },
    { midi: 64, name: 'E4', time: 1, duration: 1, velocity: 0.6 },
  ];
  clip.midiNotes = notes;
  await clip.updateComplete;
  // _applyClipUpdate is sync after the event; allow microtasks
  await new Promise((r) => setTimeout(r, 0));

  const setTracksCallsAfter = adapter.setTracks.mock.calls.length;
  expect(setTracksCallsAfter).toBeGreaterThan(setTracksCallsBefore);

  const lastCall = adapter.setTracks.mock.calls.at(-1);
  expect(lastCall![0][0].clips[0].midiNotes).toEqual(notes);
  document.body.removeChild(editor);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-midi.test.ts -t "updates engine clip"`
Expected: FAIL — `_applyClipUpdate` only handles audio fields (start/duration/offset/gain/name).

- [ ] **Step 3: Extend `_applyClipUpdate`**

In `packages/dawcore/src/elements/daw-editor.ts` find `_applyClipUpdate` (around line 898). Read the existing implementation; it currently handles position/gain/name updates by mutating `oldClip` fields and calling `engine.updateTrack`.

Add a MIDI-aware branch at the top of the method (after the lookup guards):

```typescript
private _applyClipUpdate(trackId: string, clipId: string, clipEl: DawClipElement) {
  const t = this._engineTracks.get(trackId);
  if (!t) {
    console.warn('[dawcore] _applyClipUpdate: no engine track for id "' + trackId + '"');
    return;
  }
  const idx = t.clips.findIndex((c) => c.id === clipId);
  if (idx === -1) {
    console.warn(
      '[dawcore] _applyClipUpdate: clip "' + clipId + '" not in track "' + trackId + '"'
    );
    return;
  }

  const oldClip = t.clips[idx];
  const sr = oldClip.sampleRate ?? this.effectiveSampleRate;

  // MIDI clips: rebuild the clip when notes/channel/program change (or when
  // an audio clip toggles into MIDI by acquiring midiNotes — rare, but covered).
  const isMidiNow = clipEl.midiNotes !== null;
  const wasMidi = oldClip.midiNotes !== undefined;
  if (isMidiNow || wasMidi) {
    const notes = clipEl.midiNotes ?? [];
    const sourceDurationSamples = notes.length
      ? Math.ceil(Math.max(...notes.map((n) => n.time + n.duration)) * sr)
      : Math.ceil((clipEl.duration || 0) * sr);
    const requestedDurationSamples =
      clipEl.duration > 0 ? Math.round(clipEl.duration * sr) : sourceDurationSamples;

    const updatedClip: AudioClip = {
      ...oldClip,
      audioBuffer: undefined,
      startSample: Math.round(clipEl.start * sr),
      offsetSamples: Math.round(clipEl.offset * sr),
      durationSamples: requestedDurationSamples,
      sourceDurationSamples,
      gain: clipEl.gain,
      name: clipEl.name,
      midiNotes: notes,
      midiChannel: clipEl.midiChannel ?? undefined,
      midiProgram: clipEl.midiProgram ?? undefined,
    };
    const updatedClips = [...t.clips];
    updatedClips[idx] = updatedClip;
    const updatedTrack: ClipTrack = { ...t, clips: updatedClips };
    this._engineTracks = new Map(this._engineTracks).set(trackId, updatedTrack);
    if (this._engine) this._engine.updateTrack(trackId, updatedTrack);
    return;
  }

  // ... existing audio path (unchanged) below
}
```

Note: keep the existing audio-clip update logic intact below the MIDI branch. The MIDI branch returns early.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-midi.test.ts`
Expected: All tests in this file PASS.

- [ ] **Step 5: Full test + lint + typecheck**

```bash
cd packages/dawcore && pnpm typecheck && npx vitest run && cd ../.. && pnpm lint
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-editor.ts \
        packages/dawcore/src/__tests__/daw-editor-midi.test.ts
git commit -m "feat(dawcore): reactive MIDI clip updates via daw-clip-update

When midiNotes / midiChannel / midiProgram change after track load,
_applyClipUpdate rebuilds the engine clip and calls engine.updateTrack.
sourceDurationSamples re-derived from the new notes' end time."
```

---

## Task 7: Editor — `addTrack({ midi })` Sugar

**Files:**

- Modify: `packages/dawcore/src/types.ts` (extend `TrackConfig`)
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (`addTrack` method ~line 1409)
- Modify: `packages/dawcore/src/__tests__/daw-editor-midi.test.ts` (extend)

- [ ] **Step 1: Write failing test**

Add to `packages/dawcore/src/__tests__/daw-editor-midi.test.ts`:

```typescript
it('addTrack({ midi }) creates a piano-roll track with one MIDI clip', async () => {
  const editor = document.createElement('daw-editor') as any;
  const adapter = makeMockAdapter();
  editor.adapter = adapter;
  document.body.appendChild(editor);

  const notes = [{ midi: 60, name: 'C4', time: 0, duration: 0.5, velocity: 0.8 }];
  const track = await editor.addTrack({
    name: 'Lead',
    midi: { notes, channel: 0, program: 24 },
  });

  expect(track.getAttribute('render-mode')).toBe('piano-roll');
  expect(track.name).toBe('Lead');
  const clipEls = track.querySelectorAll('daw-clip');
  expect(clipEls.length).toBe(1);
  expect(clipEls[0].midiNotes).toEqual(notes);
  expect(clipEls[0].midiChannel).toBe(0);
  expect(clipEls[0].midiProgram).toBe(24);
  document.body.removeChild(editor);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-midi.test.ts -t "addTrack"`
Expected: FAIL — `config.midi` is rejected by TypeScript or silently ignored.

- [ ] **Step 3: Extend `TrackConfig`**

In `packages/dawcore/src/types.ts`, append to the `TrackConfig` interface (around line 65):

```typescript
import type { FadeType, MidiNoteData } from '@waveform-playlist/core';

export interface TrackConfig {
  name?: string;
  volume?: number;
  pan?: number;
  muted?: boolean;
  soloed?: boolean;
  renderMode?: 'waveform' | 'piano-roll';
  clips?: ClipConfig[];
  /**
   * Convenience: creates a single piano-roll <daw-clip> child with these
   * notes and sets render-mode="piano-roll" on the track. Equivalent to
   * passing { renderMode: 'piano-roll', clips: [{ midiNotes, midiChannel, midiProgram }] }.
   */
  midi?: {
    notes: MidiNoteData[];
    channel?: number;
    program?: number;
  };
}
```

- [ ] **Step 4: Extend `addTrack`**

In `packages/dawcore/src/elements/daw-editor.ts`, modify `addTrack` (~line 1409):

```typescript
addTrack(config: TrackConfig = {}): Promise<DawTrackElement> {
  const trackEl = document.createElement('daw-track') as DawTrackElement;
  if (config.name !== undefined) trackEl.setAttribute('name', config.name);
  if (config.volume !== undefined) trackEl.volume = config.volume;
  if (config.pan !== undefined) trackEl.pan = config.pan;
  if (config.muted) trackEl.setAttribute('muted', '');
  if (config.soloed) trackEl.setAttribute('soloed', '');

  const renderMode =
    config.renderMode ?? (config.midi ? 'piano-roll' : undefined);
  if (renderMode !== undefined) trackEl.setAttribute('render-mode', renderMode);

  const clipConfigs: ClipConfig[] = [...(config.clips ?? [])];
  if (config.midi) {
    clipConfigs.push({
      midiNotes: config.midi.notes,
      midiChannel: config.midi.channel,
      midiProgram: config.midi.program,
    });
  }
  for (const clipConfig of clipConfigs) {
    trackEl.appendChild(this._buildClipElement(clipConfig));
  }

  return this._awaitId(
    'daw-track-ready',
    'daw-track-error',
    (d) => d.trackId === trackEl.trackId,
    trackEl,
    () => this.appendChild(trackEl)
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-midi.test.ts`
Expected: All tests in this file PASS.

- [ ] **Step 6: Full test + typecheck + lint**

```bash
cd packages/dawcore && pnpm typecheck && npx vitest run && cd ../.. && pnpm lint
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore/src/types.ts \
        packages/dawcore/src/elements/daw-editor.ts \
        packages/dawcore/src/__tests__/daw-editor-midi.test.ts
git commit -m "feat(dawcore): editor.addTrack({ midi }) sugar

Convenience for creating a piano-roll track with a single MIDI clip.
{ midi: { notes, channel?, program? } } expands to render-mode='piano-roll'
plus a <daw-clip> with midiNotes / midi-channel / midi-program set."
```

---

## Task 8: Interaction Guards — Disable Trim and Split for MIDI Clips

**Files:**

- Modify: `packages/dawcore/src/interactions/clip-pointer-handler.ts` (boundary hit-test)
- Modify: `packages/dawcore/src/interactions/split-handler.ts` (`canSplitAtTime`)
- Modify: `packages/dawcore/src/__tests__/clip-pointer-handler.test.ts` (extend)

- [ ] **Step 1: Inspect current hit-test for boundaries**

Run: `grep -n "data-boundary-edge\|clip-boundary\|trimClip" packages/dawcore/src/interactions/clip-pointer-handler.ts`

Identify where the handler decides "this is a trim drag" — typically a `target.closest('.clip-boundary')` check that pulls the clip-id from `data-clip-id` and looks up the engine clip.

- [ ] **Step 2: Write failing test**

Add to `packages/dawcore/src/__tests__/clip-pointer-handler.test.ts` (look at existing test structure for the host mock shape):

```typescript
it('ignores boundary pointerdown on MIDI clips (no trim)', () => {
  // Build a host mock with a track containing a single MIDI clip
  const trimClip = vi.fn();
  const moveClip = vi.fn();
  const host = makeMockHost({
    engine: {
      moveClip,
      trimClip,
      updateTrack: vi.fn(),
      beginTransaction: vi.fn(),
      commitTransaction: vi.fn(),
      constrainTrimDelta: vi.fn(() => 0),
    },
    tracks: [
      {
        id: 't1',
        clips: [
          {
            id: 'c1',
            startSample: 0,
            durationSamples: 48000,
            offsetSamples: 0,
            sampleRate: 48000,
            midiNotes: [], // MIDI clip
          },
        ],
      },
    ],
  });

  const handler = new ClipPointerHandler(host);
  // Simulate pointerdown on a clip-boundary element with data-clip-id="c1"
  const event = makeBoundaryPointerEvent('c1', 't1', 'left');
  handler.onPointerDown(event);

  expect(trimClip).not.toHaveBeenCalled();
  // Move/up should not start a trim drag — verified by no engine call after a drag sequence
});
```

The `makeMockHost` and `makeBoundaryPointerEvent` helpers must follow the existing patterns in `clip-pointer-handler.test.ts`. If those helpers don't exist there yet, build them inline matching the existing style (don't extract — keep this task small).

- [ ] **Step 3: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/clip-pointer-handler.test.ts -t "MIDI"`
Expected: FAIL — handler currently treats all clips identically, so it'd start a trim drag.

- [ ] **Step 4: Add MIDI guard in clip-pointer-handler**

In `packages/dawcore/src/interactions/clip-pointer-handler.ts`, find the boundary-hit branch in `onPointerDown` (the part that checks `target.closest('.clip-boundary')`). Before storing the trim drag state, look up the clip and bail if it's MIDI:

```typescript
const boundaryEl = target.closest('.clip-boundary') as HTMLElement | null;
if (boundaryEl) {
  const clipId = boundaryEl.dataset.clipId;
  const trackId = boundaryEl.dataset.trackId;
  if (!clipId || !trackId) return;
  // Skip trim for MIDI clips — note slicing is not implemented yet.
  const track = this._host.engineTracks.get(trackId);
  const clip = track?.clips.find((c) => c.id === clipId);
  if (clip?.midiNotes !== undefined) return;
  // ... existing trim-drag setup
}
```

If `engineTracks` isn't on the `ClipPointerHost` interface, add it. Look at the interface declaration (top of file or in a separate types file) and add:

```typescript
export interface ClipPointerHost {
  // ... existing fields
  readonly engineTracks: Map<string, ClipTrack>;
}
```

The editor satisfies this via its existing `_engineTracks` Map (rename via getter if not directly accessible — see the `_engineTracks` references in `daw-editor.ts`).

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/clip-pointer-handler.test.ts`
Expected: PASS.

- [ ] **Step 6: Add MIDI guard in split-handler**

In `packages/dawcore/src/interactions/split-handler.ts`, find `canSplitAtTime` (or the equivalent pre-flight check). Add a clause: a clip is splittable only if it has no `midiNotes`:

```typescript
export function canSplitAtTime(host: SplitHost, time: number): boolean {
  // ... existing checks
  const targetTrack = host.getSelectedTrack();
  if (!targetTrack) return false;
  const sample = Math.round(time * host.effectiveSampleRate);
  const targetClip = targetTrack.clips.find(
    (c) =>
      c.startSample < sample &&
      c.startSample + c.durationSamples > sample
  );
  if (!targetClip) return false;
  if (targetClip.midiNotes !== undefined) return false; // MIDI splits deferred
  return true;
}
```

The exact internals depend on the current implementation — read it first via `cat packages/dawcore/src/interactions/split-handler.ts` and adapt accordingly. The contract is: when the clip under the playhead is MIDI, return false.

- [ ] **Step 7: Add a quick assertion for the split guard**

In an existing split-handler test file (or extend `daw-editor-midi.test.ts`), add:

```typescript
it('canSplitAtTime returns false for MIDI clips', async () => {
  const { canSplitAtTime } = await import('../interactions/split-handler');
  const host: any = {
    effectiveSampleRate: 48000,
    getSelectedTrack: () => ({
      clips: [
        {
          startSample: 0,
          durationSamples: 96000,
          midiNotes: [],
        },
      ],
    }),
  };
  expect(canSplitAtTime(host, 1.0)).toBe(false);
});
```

If `canSplitAtTime` has a different signature, adapt the test. Review with `grep -n "canSplitAtTime" packages/dawcore/src/`.

- [ ] **Step 8: Run all tests + lint + typecheck**

```bash
cd packages/dawcore && pnpm typecheck && npx vitest run && cd ../.. && pnpm lint
```

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/dawcore/src/interactions/ packages/dawcore/src/__tests__/
git commit -m "feat(dawcore): disable trim and split for MIDI clips

Trim handles on .clip-boundary become inert when the underlying clip
has midiNotes. canSplitAtTime returns false for MIDI clips. Both are
defensive no-ops — note slicing in @waveform-playlist/engine is a
follow-up PR. Move drag (start position only) remains enabled."
```

---

## Task 9: Demo Page

**Files:**

- Create: `examples/dawcore-tone/midi.html`

- [ ] **Step 1: Verify Tone adapter examples work**

Run: `pnpm example:dawcore-tone` (from repo root). Wait for "Local: http://localhost:5174" (or fallback port — check the actual log).

Open `http://localhost:5174/basic.html` in a browser. Confirm the existing audio example loads and plays. Stop the server (Ctrl-C) before continuing.

- [ ] **Step 2: Create the demo page**

Create `examples/dawcore-tone/midi.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>dawcore — MIDI (Tone adapter)</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, sans-serif;
        background: #0d0d14;
        color: #c49a6c;
        margin: 0;
        padding: 24px;
      }
      h1 {
        color: #d08070;
        font-weight: 400;
      }
      daw-editor {
        --daw-piano-roll-note-color: #2a7070;
        --daw-piano-roll-selected-note-color: #3d9e9e;
        --daw-piano-roll-background: #1a1a2e;
        display: block;
        margin-top: 16px;
      }
      daw-transport {
        display: inline-flex;
        gap: 8px;
        margin-top: 16px;
      }
    </style>
  </head>
  <body>
    <h1>// dawcore midi — tone adapter</h1>
    <p>
      Programmatic MIDI clip rendered as piano-roll, played back via Tone.js
      PolySynth.
    </p>

    <daw-editor
      id="editor"
      samples-per-pixel="2048"
      wave-height="120"
      timescale
    >
      <daw-keyboard-shortcuts playback></daw-keyboard-shortcuts>
    </daw-editor>

    <daw-transport for="editor">
      <daw-play-button></daw-play-button>
      <daw-pause-button></daw-pause-button>
      <daw-stop-button></daw-stop-button>
      <daw-time-display></daw-time-display>
    </daw-transport>

    <script type="module">
      import '@dawcore/components';
      import { createToneAdapter } from '@waveform-playlist/playout';

      const editor = document.getElementById('editor');
      editor.adapter = createToneAdapter({ ppqn: 960 });

      // C major scale, quarter notes at 120 BPM
      const notes = [
        { midi: 60, name: 'C4', time: 0.0, duration: 0.5, velocity: 0.8 },
        { midi: 62, name: 'D4', time: 0.5, duration: 0.5, velocity: 0.7 },
        { midi: 64, name: 'E4', time: 1.0, duration: 0.5, velocity: 0.7 },
        { midi: 65, name: 'F4', time: 1.5, duration: 0.5, velocity: 0.7 },
        { midi: 67, name: 'G4', time: 2.0, duration: 0.5, velocity: 0.8 },
        { midi: 69, name: 'A4', time: 2.5, duration: 0.5, velocity: 0.7 },
        { midi: 71, name: 'B4', time: 3.0, duration: 0.5, velocity: 0.7 },
        { midi: 72, name: 'C5', time: 3.5, duration: 0.5, velocity: 0.9 },
      ];

      // Use the imperative sugar (or build the DOM manually if you prefer)
      await editor.addTrack({
        name: 'C Major Scale',
        midi: { notes },
      });
    </script>
  </body>
</html>
```

- [ ] **Step 3: Verify the demo loads**

Run: `pnpm example:dawcore-tone`
Open: `http://localhost:5174/midi.html` (or the port shown in the log)

Verify by eye:

- Notes appear in the piano-roll renderer (8 stacked rectangles ascending diagonally)
- Play button starts playback; you hear a Tone.js synth
- Pause / Stop work
- Time display advances during play

If notes don't appear, open DevTools console — likely culprit is property naming (e.g. `midiNotes` vs `midi-notes` attribute confusion) or the editor not having an adapter set before tracks land.

If audio doesn't play, check that `editor.adapter = createToneAdapter(...)` runs before `addTrack(...)` — Lit's microtask scheduling can otherwise race.

Stop the server (Ctrl-C).

- [ ] **Step 4: Commit**

```bash
git add examples/dawcore-tone/midi.html
git commit -m "docs(examples): add dawcore-tone MIDI demo

Programmatic C major scale rendered as piano-roll, played by Tone.js
PolySynth via TonePlayoutAdapter. No SoundFont, no .mid file —
exercises the editor.addTrack({ midi }) sugar end to end."
```

---

## Task 10: Documentation + Final Verification

**Files:**

- Modify: `packages/dawcore/CLAUDE.md` (append a "MIDI" section)

- [ ] **Step 1: Append MIDI notes to dawcore CLAUDE.md**

Add a new section near the bottom (above "Variable Tempo"):

```markdown
## MIDI (Tone Adapter Path)

- **`<daw-piano-roll>`** — Visual element for note rendering, mirrors `<daw-waveform>` (Shadow DOM, chunked canvas, `getVisibleChunkIndices`). Auto-fits pitch range, velocity → opacity (0.3-1.0).
- **MIDI discriminator** — A clip is MIDI iff `clip.midiNotes != null`. Matches `TonePlayoutAdapter`'s existing rule. `<daw-track render-mode="piano-roll">` is a *visual* concern only; content type is per-clip.
- **`_loadTrack` MIDI branch** — Clips with no `src` route to `_tryBuildMidiClip`, which returns `null` for empty placeholders (no notes, no duration) — those upgrade later via `daw-clip-update`. Skips fetch / decode / peaks / `_clipBuffers` / `_peaksData` / `_clipOffsets`.
- **`_applyClipUpdate` MIDI branch** — When `midiNotes` / `midiChannel` / `midiProgram` change after track load, the engine clip is rebuilt and `engine.updateTrack` is called.
- **`addTrack({ midi: { notes, channel?, program? } })`** — Sugar. Creates a single `<daw-clip>` with `midiNotes` set + sets `render-mode="piano-roll"` on the track.
- **MIDI clip mutations are guarded** — Trim handles are inert; `canSplitAtTime` returns false. Note-array slicing is a follow-up PR in `@waveform-playlist/engine`. Move drag is allowed (only changes `startSample`).
- **Theming** — `--daw-piano-roll-note-color`, `--daw-piano-roll-selected-note-color`, `--daw-piano-roll-background` on `<daw-editor>` (or any ancestor).
- **No native MIDI playback yet** — Native `Transport` / `ClipPlayer` schedule audio buffers only. MIDI playback requires `TonePlayoutAdapter`; consumers of `NativePlayoutAdapter` see piano-roll rendering but silent playback for MIDI clips.
```

- [ ] **Step 2: Final verification — full test suite**

```bash
cd packages/dawcore && pnpm typecheck && npx vitest run
cd ../.. && pnpm lint
```

Expected: all PASS. Note any flaky tests and re-run them up to 3 times — if persistently failing, treat as a real regression and fix before continuing.

- [ ] **Step 3: Final verification — manual demo**

Run: `pnpm example:dawcore-tone` and open the MIDI demo. Verify:

- Notes render
- Play makes sound
- Pause holds
- Stop resets playhead to 0

Stop the server.

- [ ] **Step 4: Commit docs**

```bash
git add packages/dawcore/CLAUDE.md
git commit -m "docs(dawcore): add MIDI section to CLAUDE.md"
```

- [ ] **Step 5: Push branch and open PR**

Per the user's preferences (memory): never merge without explicit approval. Push the branch and open a PR; do not merge.

```bash
git push -u origin feat/dawcore-midi-tone
gh pr create --title "feat(dawcore): MIDI tracks via Tone adapter (programmatic)" \
  --body "$(cat <<'EOF'
## Summary
- Programmatic MIDI clips render as piano-roll in dawcore (`<daw-piano-roll>`)
- Playback via `TonePlayoutAdapter` (uses existing `MidiToneTrack` / `SoundFontToneTrack` plumbing)
- No `.mid` parsing, no file drop, no native MIDI synth, no MIDI clip mutations this PR — see spec for follow-ups

Spec: [`docs/specs/2026-05-02-dawcore-midi-tone-design.md`](docs/specs/2026-05-02-dawcore-midi-tone-design.md)
Plan: [`docs/plans/2026-05-02-dawcore-midi-tone.md`](docs/plans/2026-05-02-dawcore-midi-tone.md)

## Test plan
- [ ] `cd packages/dawcore && npx vitest run` — green
- [ ] `pnpm lint` — green
- [ ] `pnpm example:dawcore-tone` → open `midi.html` — notes render, Play makes sound, Pause / Stop work
EOF
)"
```

Report the PR URL when done. **Do not merge** — wait for explicit approval.

---

## Self-Review

**Spec coverage:** Every spec section maps to a task — `<daw-piano-roll>` (Task 3), `<daw-clip>` API (Task 1), `<daw-track>` API (Task 2), editor MIDI loading (Task 4), render branch (Task 5), reactive updates (Task 6), `addTrack` sugar (Task 7), interaction guards (Task 8), demo (Task 9), CLAUDE.md docs (Task 10). The spec's "Risks" section (late note arrival, mixed-content tracks, zoom floor on mixed tracks) maps to Tasks 4 + 6 (placeholder + reactive paths) and Task 5 (render-mode dispatch independent of content type).

**Placeholder scan:** No "TBD" / "TODO" / "implement later". Each step shows actual code or actual commands.

**Type consistency:** `MidiNoteData` from `@waveform-playlist/core` used throughout. `renderMode: 'waveform' | 'piano-roll'` consistent in `TrackDescriptor` (Task 1), `<daw-track>` property (Task 2), `TrackConfig` (Task 7), and render branch (Task 5). `midiNotes`, `midiChannel`, `midiProgram` field names match between `<daw-clip>` element, `BaseClipDescriptor`, `ClipConfig`, `_buildClipElement`, `_tryBuildMidiClip`, and `_applyClipUpdate`. Engine clip helper is `createClip` (sample-based), not `createClipFromSeconds` — chosen per CLAUDE.md pattern #40 since samples are known exactly.

**Sequencing:** Task 1 introduces `TrackDescriptor.renderMode` field but Task 2 wires it; Task 1 sets `renderMode: 'waveform'` literal as a placeholder so type-check stays green. Task 4 adds the MIDI loading branch; Task 5 wires the renderer (so a MIDI clip after Task 4 alone would render as `<daw-waveform>` — empty, not broken). Task 6 enables late-arrival notes (the natural declarative pattern). Task 7 adds the imperative sugar consumed by Task 9's demo. Task 8 guards interactions before users touch them in the demo.
