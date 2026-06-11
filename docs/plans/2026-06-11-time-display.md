# `<daw-time-display>` + `<daw-time-format>` + `daw-timeupdate` Implementation Plan (#459)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `<daw-time-display>` and `<daw-time-format>` transport elements, a RAF-driven `daw-timeupdate` event from a single editor-owned animation loop, public `isPlaying`/`duration` getters, and duck-typed transport capability detection (foundation for #474).

**Architecture:** A new `PlaybackAnimationController` on `<daw-editor>` becomes the only RAF loop during playback — each frame reads `engine.getAudibleTime()` once, dispatches `daw-timeupdate`, and positions the playhead (which collapses to a dumb `setPosition(px)` element). Time format state lives on the editor (`time-format` reflected attribute + `setTimeFormat()`), broadcast via `daw-time-format-change`. Transport elements resolve their target through shared helpers in `utils/transport-capability.ts` and disable themselves when the target lacks required methods.

**Tech Stack:** Lit 3 web components, TypeScript, vitest + happy-dom. Design doc: `docs/specs/2026-06-11-time-display-design.md`.

**Working directory:** all commands run from `packages/dawcore` unless noted. Commits run from repo root (git-from-root convention). NO `Co-Authored-By` footers on commits (user has attribution disabled globally).

**happy-dom gotchas that apply here** (from `packages/dawcore/CLAUDE.md`):
- Append elements to `document.body`; `isConnected` can't be faked.
- Editor tests need the full mock adapter shape — copy `daw-editor-seek-playhead.test.ts:makeMockAdapter`.
- Use `editor.addTrack({ name, midi: { notes } })` for fully-loaded tracks without fetch/decode.
- Cleanup (element `.remove()`, spy `mockRestore`) goes in `afterEach`, never at the end of a test body.

---

### Task 1: Time display format utility

**Files:**
- Create: `packages/dawcore/src/utils/time-display-format.ts`
- Test: `packages/dawcore/src/__tests__/time-display-format.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/dawcore/src/__tests__/time-display-format.test.ts
import { describe, it, expect } from 'vitest';
import {
  TIME_DISPLAY_FORMATS,
  isTimeDisplayFormat,
  formatDisplayTime,
  parseDisplayTime,
} from '../utils/time-display-format';

describe('time-display-format', () => {
  it('exposes the three spec formats in order', () => {
    expect(TIME_DISPLAY_FORMATS).toEqual(['hh:mm:ss.sss', 'hh:mm:ss', 'seconds']);
  });

  it('isTimeDisplayFormat guards correctly', () => {
    expect(isTimeDisplayFormat('hh:mm:ss')).toBe(true);
    expect(isTimeDisplayFormat('hh:mm:ss.uuu')).toBe(false);
    expect(isTimeDisplayFormat(undefined)).toBe(false);
    expect(isTimeDisplayFormat(3)).toBe(false);
  });

  it('formats hh:mm:ss.sss with zero padding and milliseconds', () => {
    expect(formatDisplayTime(0, 'hh:mm:ss.sss')).toBe('00:00:00.000');
    expect(formatDisplayTime(65.5, 'hh:mm:ss.sss')).toBe('00:01:05.500');
    expect(formatDisplayTime(3661.25, 'hh:mm:ss.sss')).toBe('01:01:01.250');
  });

  it('formats hh:mm:ss without decimals', () => {
    expect(formatDisplayTime(65.5, 'hh:mm:ss')).toBe('00:01:05');
    expect(formatDisplayTime(7322, 'hh:mm:ss')).toBe('02:02:02');
  });

  it('formats seconds as a plain fixed-point number', () => {
    expect(formatDisplayTime(65.5, 'seconds')).toBe('65.500');
    expect(formatDisplayTime(0, 'seconds')).toBe('0.000');
  });

  it('does not wrap hours at 24 (long audiobooks)', () => {
    expect(formatDisplayTime(25 * 3600, 'hh:mm:ss')).toBe('25:00:00');
  });

  it('clamps NaN, Infinity, and negative input to 0', () => {
    expect(formatDisplayTime(NaN, 'hh:mm:ss.sss')).toBe('00:00:00.000');
    expect(formatDisplayTime(Infinity, 'hh:mm:ss')).toBe('00:00:00');
    expect(formatDisplayTime(-5, 'seconds')).toBe('0.000');
  });

  it('parses clock formats back to seconds', () => {
    expect(parseDisplayTime('00:01:05.500', 'hh:mm:ss.sss')).toBeCloseTo(65.5);
    expect(parseDisplayTime('01:01:01', 'hh:mm:ss')).toBe(3661);
  });

  it('parses seconds format', () => {
    expect(parseDisplayTime('65.5', 'seconds')).toBeCloseTo(65.5);
  });

  it('round-trips format -> parse for every format', () => {
    for (const format of TIME_DISPLAY_FORMATS) {
      const formatted = formatDisplayTime(125.25, format);
      const expected = format === 'hh:mm:ss' ? 125 : 125.25;
      expect(parseDisplayTime(formatted, format)).toBeCloseTo(expected);
    }
  });

  it('returns 0 for garbage or empty input', () => {
    expect(parseDisplayTime('', 'hh:mm:ss.sss')).toBe(0);
    expect(parseDisplayTime('not-a-time', 'seconds')).toBe(0);
    expect(parseDisplayTime('1:2', 'hh:mm:ss')).toBe(0); // needs 3 segments
  });

  it('clamps negative parse results to 0', () => {
    expect(parseDisplayTime('-10', 'seconds')).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/time-display-format.test.ts`
Expected: FAIL — cannot resolve `../utils/time-display-format`

- [ ] **Step 3: Write the implementation**

```ts
// packages/dawcore/src/utils/time-display-format.ts
/**
 * Time display formats for <daw-time-display> / <daw-time-format> and the
 * editor's `time-format` attribute. The three formats come from the
 * web-components-migration spec ("Element Registry": hh:mm:ss.sss | hh:mm:ss
 * | seconds). parseDisplayTime exists for the selection inputs (#463).
 */
export type TimeDisplayFormat = 'hh:mm:ss.sss' | 'hh:mm:ss' | 'seconds';

export const TIME_DISPLAY_FORMATS: readonly TimeDisplayFormat[] = [
  'hh:mm:ss.sss',
  'hh:mm:ss',
  'seconds',
];

export function isTimeDisplayFormat(value: unknown): value is TimeDisplayFormat {
  return TIME_DISPLAY_FORMATS.includes(value as TimeDisplayFormat);
}

function clockFormat(totalSeconds: number, decimals: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const secs = (totalSeconds % 60).toFixed(decimals);
  return (
    String(hours).padStart(2, '0') +
    ':' +
    String(minutes).padStart(2, '0') +
    ':' +
    secs.padStart(decimals > 0 ? decimals + 3 : 2, '0')
  );
}

/** Format seconds for display. Non-finite or negative input renders as 0. */
export function formatDisplayTime(seconds: number, format: TimeDisplayFormat): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  switch (format) {
    case 'seconds':
      return safe.toFixed(3);
    case 'hh:mm:ss':
      return clockFormat(safe, 0);
    case 'hh:mm:ss.sss':
    default:
      return clockFormat(safe, 3);
  }
}

/** Parse a formatted time string back to seconds. Returns 0 on malformed input. */
export function parseDisplayTime(value: string, format: TimeDisplayFormat): number {
  if (!value) return 0;
  let seconds = 0;
  if (format === 'seconds') {
    seconds = parseFloat(value) || 0;
  } else {
    const parts = value.split(':');
    if (parts.length !== 3) return 0;
    const h = parseInt(parts[0], 10) || 0;
    const m = parseInt(parts[1], 10) || 0;
    const s = parseFloat(parts[2]) || 0;
    seconds = h * 3600 + m * 60 + s;
  }
  return Math.max(0, seconds);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/time-display-format.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit** (from repo root)

```bash
git add packages/dawcore/src/utils/time-display-format.ts packages/dawcore/src/__tests__/time-display-format.test.ts
git commit -m "feat: time display format utility for dawcore transport elements (#459)"
```

---

### Task 2: Transport capability helpers

**Files:**
- Create: `packages/dawcore/src/utils/transport-capability.ts`
- Test: `packages/dawcore/src/__tests__/transport-capability.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/dawcore/src/__tests__/transport-capability.test.ts
import { describe, it, expect, vi, afterEach } from 'vitest';
import '../index';
import {
  resolveTransportTarget,
  targetSupports,
  warnUnsupportedOnce,
} from '../utils/transport-capability';

describe('targetSupports', () => {
  it('returns false for null/undefined targets', () => {
    expect(targetSupports(null, ['play'])).toBe(false);
    expect(targetSupports(undefined, ['play'])).toBe(false);
  });

  it('returns true when every required name is a function', () => {
    const target = { play: () => {}, stop: () => {} };
    expect(targetSupports(target, ['play', 'stop'])).toBe(true);
  });

  it('returns false when any required name is missing or not a function', () => {
    const target = { play: () => {}, undo: 'not-a-function' };
    expect(targetSupports(target, ['play', 'undo'])).toBe(false);
    expect(targetSupports(target, ['redo'])).toBe(false);
  });

  it('returns true for an empty requirement list on a non-null target', () => {
    expect(targetSupports({}, [])).toBe(true);
  });
});

describe('warnUnsupportedOnce', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('warns once per element, naming the missing methods', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = document.createElement('daw-record-button');
    warnUnsupportedOnce(el, ['startRecording', 'stopRecording']);
    warnUnsupportedOnce(el, ['startRecording', 'stopRecording']);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('daw-record-button');
    expect(warn.mock.calls[0][0]).toContain('startRecording');
  });

  it('warns separately for distinct elements', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    warnUnsupportedOnce(document.createElement('div'), ['a']);
    warnUnsupportedOnce(document.createElement('div'), ['a']);
    expect(warn).toHaveBeenCalledTimes(2);
  });
});

describe('resolveTransportTarget', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('resolves through the closest daw-transport for attribute', () => {
    const fakeEditor = document.createElement('div');
    fakeEditor.id = 'ed-1';
    document.body.appendChild(fakeEditor);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="ed-1"><daw-play-button></daw-play-button></daw-transport>'
    );
    const button = document.querySelector('daw-play-button')!;
    expect(resolveTransportTarget(button)).toBe(fakeEditor);
  });

  it('returns null outside a transport or with a dangling id', () => {
    const orphan = document.createElement('daw-play-button');
    document.body.appendChild(orphan);
    expect(resolveTransportTarget(orphan)).toBeNull();

    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="missing"><daw-stop-button></daw-stop-button></daw-transport>'
    );
    expect(resolveTransportTarget(document.querySelector('daw-stop-button')!)).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/transport-capability.test.ts`
Expected: FAIL — cannot resolve `../utils/transport-capability`

- [ ] **Step 3: Write the implementation**

```ts
// packages/dawcore/src/utils/transport-capability.ts
import type { DawTransportElement } from '../elements/daw-transport';

/**
 * Transport target resolution + duck-typed capability detection.
 *
 * Transport controls never instanceof-check their target — they probe for the
 * methods they need (`typeof target[m] === 'function'`). This is what lets the
 * same controls drive <daw-editor>, the future <daw-player> (#454), or any
 * conforming element, and lets editor-only controls render disabled against a
 * player (#474, spec "Transport Compatibility").
 */

/** Resolve the target of the closest <daw-transport for="..."> ancestor. */
export function resolveTransportTarget(el: Element): HTMLElement | null {
  const transport = el.closest('daw-transport') as DawTransportElement | null;
  return transport?.target ?? null;
}

/** True when target exists and every named method is a function on it. */
export function targetSupports(target: unknown, methods: readonly string[]): boolean {
  if (!target) return false;
  return methods.every(
    (m) => typeof (target as Record<string, unknown>)[m] === 'function'
  );
}

const warned = new WeakSet<Element>();

/** One-time console warning explaining why a control is disabled. */
export function warnUnsupportedOnce(element: Element, methods: readonly string[]): void {
  if (warned.has(element)) return;
  warned.add(element);
  console.warn(
    `[dawcore] <${element.tagName.toLowerCase()}> is disabled: its transport target ` +
      `does not implement ${methods.join(', ')}. See the transport compatibility ` +
      'table in the docs for which controls work with which targets.'
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/transport-capability.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/utils/transport-capability.ts packages/dawcore/src/__tests__/transport-capability.test.ts
git commit -m "feat: duck-typed transport capability helpers (#459, foundation for #474)"
```

---

### Task 3: Editor `isPlaying`/`duration` getters + `timeFormat` property + events

**Files:**
- Modify: `packages/dawcore/src/events.ts` (detail types + `DawEventMap`)
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (getters near `get currentTime()` at ~line 2384; property near the other validated properties)
- Test: `packages/dawcore/src/__tests__/daw-editor-time-format.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/dawcore/src/__tests__/daw-editor-time-format.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawEditorElement } from '../elements/daw-editor';

// Mock adapter modeled on daw-editor-seek-playhead.test.ts:makeMockAdapter.
function makeMockAdapter() {
  let position = 0;
  return {
    audioContext: {
      sampleRate: 48000,
      state: 'running',
      outputLatency: 0.01,
    } as unknown as AudioContext,
    ppqn: 960,
    init: vi.fn().mockResolvedValue(undefined),
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn((t: number) => {
      position = t;
    }),
    getCurrentTime: vi.fn(() => position),
    isPlaying: vi.fn().mockReturnValue(false),
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('daw-editor timeFormat + public playback getters', () => {
  let editor: DawEditorElement;

  beforeEach(() => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    editor.adapter = makeMockAdapter() as never;
    document.body.appendChild(editor);
  });

  afterEach(() => {
    editor.remove();
    vi.restoreAllMocks();
  });

  it('defaults timeFormat to hh:mm:ss.sss', () => {
    expect(editor.timeFormat).toBe('hh:mm:ss.sss');
  });

  it('setTimeFormat updates the property and reflects the attribute', async () => {
    editor.setTimeFormat('seconds');
    await editor.updateComplete;
    expect(editor.timeFormat).toBe('seconds');
    expect(editor.getAttribute('time-format')).toBe('seconds');
  });

  it('accepts the time-format attribute', async () => {
    editor.setAttribute('time-format', 'hh:mm:ss');
    await editor.updateComplete;
    expect(editor.timeFormat).toBe('hh:mm:ss');
  });

  it('dispatches daw-time-format-change with the new format', () => {
    const handler = vi.fn();
    editor.addEventListener('daw-time-format-change', handler);
    editor.setTimeFormat('seconds');
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail).toEqual({ format: 'seconds' });
  });

  it('does not dispatch when set to the current value', () => {
    const handler = vi.fn();
    editor.addEventListener('daw-time-format-change', handler);
    editor.setTimeFormat('hh:mm:ss.sss');
    expect(handler).not.toHaveBeenCalled();
  });

  it('warns and ignores invalid formats', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    editor.setTimeFormat('mm:ss' as never);
    expect(editor.timeFormat).toBe('hh:mm:ss.sss');
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it('exposes read-only isPlaying, false initially', () => {
    expect(editor.isPlaying).toBe(false);
  });

  it('exposes duration derived from loaded tracks', async () => {
    await editor.addTrack({
      name: 'midi',
      midi: { notes: [{ midi: 60, name: 'C4', time: 0, duration: 2, velocity: 0.8 }] },
    });
    await editor.updateComplete;
    expect(editor.duration).toBeCloseTo(2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-time-format.test.ts`
Expected: FAIL — `timeFormat` undefined, `setTimeFormat` is not a function, `isPlaying`/`duration` undefined

- [ ] **Step 3: Add detail types and map entries to events.ts**

In `packages/dawcore/src/events.ts`, add an import at the top (alongside the existing type imports):

```ts
import type { TimeDisplayFormat } from './utils/time-display-format';
```

Add detail interfaces (after `DawSeekDetail`, which it parallels):

```ts
export interface DawTimeUpdateDetail {
  /** Current playback time in seconds (latency-compensated while playing). */
  time: number;
}

export interface DawTimeFormatChangeDetail {
  format: TimeDisplayFormat;
}
```

Add to `DawEventMap` (after `'daw-seek'`):

```ts
  'daw-timeupdate': CustomEvent<DawTimeUpdateDetail>;
  'daw-time-format-change': CustomEvent<DawTimeFormatChangeDetail>;
```

- [ ] **Step 4: Add editor getters + property**

In `packages/dawcore/src/elements/daw-editor.ts`:

Add to the imports from `'../events'`: `DawTimeFormatChangeDetail`.
Add a new import:

```ts
import {
  isTimeDisplayFormat,
  TIME_DISPLAY_FORMATS,
  type TimeDisplayFormat,
} from '../utils/time-display-format';
```

Next to `get currentTime()` (~line 2384), add:

```ts
  /** Read-only: whether playback is running (HTMLMediaElement-adjacent). */
  get isPlaying(): boolean {
    return this._isPlaying;
  }
  /** Read-only: total content duration in seconds. */
  get duration(): number {
    return this._duration;
  }
```

Near the other validated `noAccessor` properties (follow the `samplesPerPixel` pattern at the top of the class), add:

```ts
  private _timeFormat: TimeDisplayFormat = 'hh:mm:ss.sss';

  /**
   * Time display format used by <daw-time-display> and (future, #463) the
   * selection inputs. Lives on the editor — the target element owns the
   * state, the transport controls reflect it (native-form style).
   */
  @property({ attribute: 'time-format', reflect: true, noAccessor: true })
  get timeFormat(): TimeDisplayFormat {
    return this._timeFormat;
  }
  set timeFormat(value: TimeDisplayFormat) {
    if (!isTimeDisplayFormat(value)) {
      console.warn(
        '[dawcore] timeFormat: invalid format "' +
          String(value) +
          '" ignored. Valid formats: ' +
          TIME_DISPLAY_FORMATS.join(', ')
      );
      return;
    }
    if (value === this._timeFormat) return;
    const old = this._timeFormat;
    this._timeFormat = value;
    this.requestUpdate('timeFormat', old);
    this.dispatchEvent(
      new CustomEvent<DawTimeFormatChangeDetail>('daw-time-format-change', {
        bubbles: true,
        composed: true,
        detail: { format: value },
      })
    );
  }

  /** Set the time display format. Sugar over the `timeFormat` property. */
  setTimeFormat(format: TimeDisplayFormat): void {
    this.timeFormat = format;
  }
```

Note: dispatching from the setter means attribute-driven changes (`time-format="seconds"` in HTML) broadcast too — required so displays follow declarative markup.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-time-format.test.ts`
Expected: PASS (8 tests)

- [ ] **Step 6: Run the full dawcore suite + typecheck (guard against regressions)**

Run: `cd packages/dawcore && pnpm typecheck && npx vitest run`
Expected: all pass. (`pnpm typecheck` here is the package-level script; root typecheck has a known pre-existing failure in dawcore-midi.)

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore/src/events.ts packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/daw-editor-time-format.test.ts
git commit -m "feat: editor timeFormat property, isPlaying/duration getters, daw-time-format-change event (#459)"
```

---

### Task 4: `daw-playhead.setPosition(px)` (additive)

**Files:**
- Modify: `packages/dawcore/src/elements/daw-playhead.ts`
- Test: `packages/dawcore/src/__tests__/daw-playhead.test.ts` (extend)

- [ ] **Step 1: Write the failing test** — append inside the existing `describe('DawPlayheadElement')` block in `daw-playhead.test.ts` (the file uses `as any` element casts and a `beforeAll` dynamic import — match that style):

```ts
  it('setPosition translates the line to the given pixel offset', async () => {
    const el = document.createElement('daw-playhead') as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.setPosition(42.5);
    const line = el.shadowRoot.querySelector('div');
    expect(line.style.transform).toContain('42.5');
    document.body.removeChild(el);
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-playhead.test.ts`
Expected: FAIL — `setPosition is not a function`

- [ ] **Step 3: Add the method** to `daw-playhead.ts` (after `firstUpdated`):

```ts
  /** Position the playhead line at an absolute pixel offset on the timeline.
   *  The editor's PlaybackAnimationController drives this each frame — the
   *  playhead owns no animation loop or time math of its own. */
  setPosition(px: number) {
    if (this._line) {
      this._line.style.transform = `translate3d(${px}px, 0, 0)`;
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-playhead.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-playhead.ts packages/dawcore/src/__tests__/daw-playhead.test.ts
git commit -m "feat: daw-playhead setPosition for externally driven animation (#459)"
```

---

### Task 5: `PlaybackAnimationController` + editor rewire + `daw-timeupdate`

**Files:**
- Create: `packages/dawcore/src/controllers/playback-animation-controller.ts`
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (`_startPlayhead` ~line 2515, `_stopPlayhead` ~line 2532, new controller field near the other controllers)
- Modify: `packages/dawcore/src/__tests__/daw-editor-seek-playhead.test.ts` (stubs `stopAnimation`, which stops being called)
- Test: `packages/dawcore/src/__tests__/daw-editor-timeupdate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/dawcore/src/__tests__/daw-editor-timeupdate.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawEditorElement } from '../elements/daw-editor';

function makeMockAdapter() {
  let position = 0;
  return {
    audioContext: {
      sampleRate: 48000,
      state: 'running',
      outputLatency: 0,
    } as unknown as AudioContext,
    ppqn: 960,
    init: vi.fn().mockResolvedValue(undefined),
    setTracks: vi.fn(),
    updateTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn((t: number) => {
      position = t;
    }),
    getCurrentTime: vi.fn(() => position),
    isPlaying: vi.fn().mockReturnValue(false),
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  };
}

describe('daw-editor daw-timeupdate', () => {
  let editor: DawEditorElement;
  let rafCallbacks: FrameRequestCallback[];
  let rafSpy: ReturnType<typeof vi.spyOn>;

  /** Run all currently queued animation frames (one "frame"). */
  const stepFrame = () => {
    const cbs = rafCallbacks;
    rafCallbacks = [];
    cbs.forEach((cb) => cb(performance.now()));
  };

  beforeEach(async () => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    editor.adapter = makeMockAdapter() as never;
    document.body.appendChild(editor);
    await editor.addTrack({
      name: 'midi',
      midi: { notes: [{ midi: 60, name: 'C4', time: 0, duration: 2, velocity: 0.8 }] },
    });
    await editor.updateComplete;
    // Mock RAF only AFTER setup — connectedCallback paths defer via real RAF.
    rafCallbacks = [];
    rafSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    editor.remove();
  });

  it('dispatches daw-timeupdate on every animation frame while playing', async () => {
    const handler = vi.fn();
    editor.addEventListener('daw-timeupdate', handler);
    await editor.play();
    stepFrame();
    stepFrame();
    expect(handler).toHaveBeenCalledTimes(2);
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(typeof detail.time).toBe('number');
  });

  it('the event bubbles and is composed', async () => {
    const handler = vi.fn();
    document.addEventListener('daw-timeupdate', handler);
    await editor.play();
    stepFrame();
    document.removeEventListener('daw-timeupdate', handler);
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).composed).toBe(true);
  });

  it('positions the playhead each frame from the same clock', async () => {
    const playhead = editor.shadowRoot!.querySelector('daw-playhead') as HTMLElement & {
      setPosition: (px: number) => void;
    };
    const posSpy = vi.fn();
    playhead.setPosition = posSpy;
    await editor.play();
    stepFrame();
    expect(posSpy).toHaveBeenCalledTimes(1);
    // time 0 -> pixel 0 regardless of spp
    expect(posSpy.mock.calls[0][0]).toBe(0);
  });

  it('dispatches one final daw-timeupdate on pause', async () => {
    await editor.play();
    stepFrame();
    const handler = vi.fn();
    editor.addEventListener('daw-timeupdate', handler);
    editor.pause();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('dispatches one daw-timeupdate on seek while stopped (HTMLMediaElement-adjacent)', () => {
    const handler = vi.fn();
    editor.addEventListener('daw-timeupdate', handler);
    editor.seekTo(1.5);
    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0][0] as CustomEvent).detail.time).toBe(1.5);
  });

  it('dispatches exactly one daw-timeupdate on stop (engine stop handler + editor.stop both call _stopPlayhead)', async () => {
    await editor.play();
    stepFrame();
    const handler = vi.fn();
    editor.addEventListener('daw-timeupdate', handler);
    editor.stop();
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('stops dispatching after stop (no further frames fire events)', async () => {
    await editor.play();
    stepFrame();
    editor.stop();
    const handler = vi.fn();
    editor.addEventListener('daw-timeupdate', handler);
    stepFrame(); // any stale queued frames must not dispatch
    expect(handler).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-timeupdate.test.ts`
Expected: FAIL — no `daw-timeupdate` events dispatched (handlers never called)

- [ ] **Step 3: Create the controller**

```ts
// packages/dawcore/src/controllers/playback-animation-controller.ts
import type { ReactiveControllerHost } from 'lit';
import { AnimationController } from './animation-controller';
import type { DawTimeUpdateDetail } from '../events';

export interface PlayheadLike {
  setPosition(px: number): void;
}

/**
 * The single editor-owned playback animation loop (mirror of the React
 * `usePlaybackAnimation` pattern). Each frame reads the latency-compensated
 * playback time ONCE, positions the playhead, and dispatches `daw-timeupdate`
 * from the host element. External consumers hook into the same loop by
 * listening for `daw-timeupdate` — never add a second RAF loop for
 * playback-time concerns.
 *
 * HTMLMediaElement-adjacent: `stop()` dispatches one final event so idle
 * displays settle on the exact commanded position (media elements fire
 * `timeupdate` on pause and seek too).
 */
export class PlaybackAnimationController {
  private _animation: AnimationController;
  private _host: ReactiveControllerHost & HTMLElement;
  private _running = false;
  private _lastDispatchedTime: number | null = null;

  constructor(host: ReactiveControllerHost & HTMLElement) {
    this._host = host;
    this._animation = new AnimationController(host);
  }

  start(
    getTime: () => number,
    timeToPixels: (time: number) => number,
    getPlayhead: () => PlayheadLike | null
  ): void {
    this._running = true;
    this._animation.start(() => {
      const time = getTime();
      getPlayhead()?.setPosition(timeToPixels(time));
      this._dispatchTimeUpdate(time);
    });
  }

  stop(
    finalTime: number,
    timeToPixels: (time: number) => number,
    getPlayhead: () => PlayheadLike | null
  ): void {
    // The editor's stop path reaches here twice (engine 'stop' handler at
    // daw-editor.ts:1919 AND editor.stop() both call _stopPlayhead). Dedupe:
    // dispatch only when the loop was actually running or the settled time
    // changed (seek-while-stopped must still fire its event).
    const wasRunning = this._running;
    this._running = false;
    this._animation.stop();
    getPlayhead()?.setPosition(timeToPixels(finalTime));
    if (wasRunning || finalTime !== this._lastDispatchedTime) {
      this._dispatchTimeUpdate(finalTime);
    }
  }

  private _dispatchTimeUpdate(time: number): void {
    this._lastDispatchedTime = time;
    this._host.dispatchEvent(
      new CustomEvent<DawTimeUpdateDetail>('daw-timeupdate', {
        bubbles: true,
        composed: true,
        detail: { time },
      })
    );
  }
}
```

- [ ] **Step 4: Rewire the editor**

In `packages/dawcore/src/elements/daw-editor.ts`:

Add import:

```ts
import { PlaybackAnimationController } from '../controllers/playback-animation-controller';
```

Add a field next to the other controller fields (search `new AudioResumeController` / `_recordingController` for the cluster):

```ts
  private _playbackAnimation = new PlaybackAnimationController(this);
```

Replace `_startPlayhead` and `_stopPlayhead` (lines ~2514-2550) entirely with:

```ts
  // --- Playback animation (single RAF loop: playhead + daw-timeupdate) ---
  /** Convert playback seconds to a timeline pixel offset for the active mode. */
  private _timeToPixels = (time: number): number => {
    if (this.scaleMode === 'beats') {
      return this._secondsToTicks(time) / this.ticksPerPixel;
    }
    return (time * this.effectiveSampleRate) / this.samplesPerPixel;
  };

  _startPlayhead() {
    if (!this._engine) return;
    const engine = this._engine;
    // engine.getAudibleTime(): while playing, engine time minus hardware DAC
    // latency (outputLatency) and scheduler lookahead (0.1s on Tone-backed
    // adapters, 0 native), held at the play-start position during the
    // pre-roll window. Without the subtraction the playhead leads audio by
    // ~100ms with the Tone adapter.
    // Runs even when the playhead element isn't rendered (empty/indefinite
    // editors) so daw-timeupdate consumers still get frames.
    this._playbackAnimation.start(
      () => engine.getAudibleTime(),
      this._timeToPixels,
      () => this._getPlayhead()
    );
  }
  _stopPlayhead() {
    // Resting playhead displays the raw position — latency compensation is a
    // playback-time concept (Transport scheduling vs audible output). A
    // seeked/stopped/paused cursor shows exactly the commanded position.
    // Storage (`_currentTime`) is already raw, so play() resumes correctly.
    const t = this._currentTime;
    const visualTime = Number.isFinite(t) ? Math.max(0, t) : 0;
    this._playbackAnimation.stop(visualTime, this._timeToPixels, () => this._getPlayhead());
  }
```

All 7 existing call sites (`play`, `pause`, `stop`, `seekTo`, `splitAtPlayhead`, engine stop handler, statechange handler, zoom-change restart in `willUpdate`) keep working unchanged — the method names and contracts are preserved. The beats-mode branch previously used `startBeatsAnimationWithMap`; `_timeToPixels` now encodes the same conversion (`_secondsToTicks(time) / ticksPerPixel`), and the old `playhead.startAnimation(...)` temporal math (`time * sampleRate / spp`) is identical.

- [ ] **Step 5: Update `daw-editor-seek-playhead.test.ts`**

The existing test stubs `playhead.stopAnimation`, which is no longer called. Replace the test body:

```ts
  it('seekTo while stopped positions the resting playhead at the exact time', () => {
    const playhead = editor.shadowRoot!.querySelector('daw-playhead') as HTMLElement & {
      setPosition: (px: number) => void;
    };
    expect(playhead).toBeTruthy();
    const posSpy = vi.fn();
    playhead.setPosition = posSpy;

    editor.seekTo(5);

    expect(posSpy).toHaveBeenCalled();
    const px = posSpy.mock.calls[posSpy.mock.calls.length - 1][0];
    // Exact click time converted to pixels — NOT 5 − outputLatency − lookAhead.
    const expectedPx = (5 * 48000) / editor.samplesPerPixel;
    expect(px).toBe(expectedPx);
  });
```

- [ ] **Step 6: Run the affected tests, then the full suite**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-timeupdate.test.ts src/__tests__/daw-editor-seek-playhead.test.ts`
Expected: PASS

Run: `cd packages/dawcore && pnpm typecheck && npx vitest run`
Expected: all pass — if any other test stubs the old playhead methods, update it the same way as Step 5 (grep: `grep -rn "stopAnimation\|startAnimation\|BeatsAnimation" src/__tests__/`)

- [ ] **Step 7: Commit**

```bash
git add packages/dawcore/src/controllers/playback-animation-controller.ts packages/dawcore/src/elements/daw-editor.ts packages/dawcore/src/__tests__/daw-editor-timeupdate.test.ts packages/dawcore/src/__tests__/daw-editor-seek-playhead.test.ts
git commit -m "feat: single editor-owned playback animation loop dispatching daw-timeupdate (#459)"
```

---

### Task 6: Remove the playhead's own animation API

**Files:**
- Modify: `packages/dawcore/src/elements/daw-playhead.ts`
- Modify: `packages/dawcore/src/__tests__/daw-playhead.test.ts`

- [ ] **Step 1: Verify nothing references the old methods**

Run: `cd packages/dawcore && grep -rn "startAnimation\|stopAnimation\|startBeatsAnimation\|stopBeatsAnimation\|startBeatsAnimationWithMap\|stopBeatsAnimationWithMap" src/ --include="*.ts" | grep -v __tests__ | grep -v animation-controller`
Expected: only matches inside `daw-playhead.ts` itself. If the editor still references any, Task 5 was incomplete — fix there first.

- [ ] **Step 2: Delete the six `start*/stop*` methods, the `_animation` field, and the `AnimationController` import** from `daw-playhead.ts`. The element keeps: styles, `render`, `firstUpdated`, `setPosition`. Final element body:

```ts
@customElement('daw-playhead')
export class DawPlayheadElement extends LitElement {
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

  /** Position the playhead line at an absolute pixel offset on the timeline.
   *  The editor's PlaybackAnimationController drives this each frame — the
   *  playhead owns no animation loop or time math of its own. */
  setPosition(px: number) {
    if (this._line) {
      this._line.style.transform = `translate3d(${px}px, 0, 0)`;
    }
  }
}
```

(Breaking change to `DawPlayheadElement`'s quasi-public methods — acceptable at 0.0.x, recorded in the design doc; the PR description must mention it.)

- [ ] **Step 3: Update `daw-playhead.test.ts`** — the old `'positions via stopAnimation'` test exercises a removed method (its time→pixel math now lives in the editor, covered by `daw-editor-seek-playhead.test.ts`). Full replacement file content:

```ts
import { describe, it, expect, beforeAll } from 'vitest';

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

  it('setPosition translates the line to the given pixel offset', async () => {
    const el = document.createElement('daw-playhead') as any;
    document.body.appendChild(el);
    await el.updateComplete;
    el.setPosition(42.5);
    const line = el.shadowRoot.querySelector('div');
    expect(line.style.transform).toContain('42.5');
    document.body.removeChild(el);
  });
});
```

- [ ] **Step 4: Run the suite + typecheck**

Run: `cd packages/dawcore && pnpm typecheck && npx vitest run`
Expected: all pass

- [ ] **Step 5: Commit**

```bash
git add packages/dawcore/src/elements/daw-playhead.ts packages/dawcore/src/__tests__/daw-playhead.test.ts
git commit -m "refactor!: daw-playhead is a dumb setPosition element; editor owns the animation loop (#459)"
```

---

### Task 7: Capability detection in `DawTransportButton` + record-button retrofit

**Files:**
- Modify: `packages/dawcore/src/elements/daw-transport-button.ts`
- Modify: `packages/dawcore/src/elements/daw-record-button.ts`
- Test: `packages/dawcore/src/__tests__/daw-record-button.test.ts` (extend — read its existing setup first and match style)

- [ ] **Step 1: Write the failing tests** — append to `daw-record-button.test.ts`:

```ts
describe('daw-record-button capability detection (#474 foundation)', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  /** Wait one real animation frame (button defers target work via rAF). */
  const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

  function mount(targetSetup: (el: HTMLElement) => void) {
    const fake = document.createElement('div');
    fake.id = 'fake-target';
    targetSetup(fake);
    document.body.appendChild(fake);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="fake-target"><daw-record-button></daw-record-button></daw-transport>'
    );
    return document.querySelector('daw-record-button')! as HTMLElement & {
      updateComplete: Promise<boolean>;
    };
  }

  it('renders enabled against a target implementing startRecording/stopRecording', async () => {
    const button = mount((el) => {
      Object.assign(el, { startRecording: () => {}, stopRecording: () => {} });
    });
    await nextFrame();
    await button.updateComplete;
    const inner = button.shadowRoot!.querySelector('button')!;
    expect(inner.disabled).toBe(false);
  });

  it('renders disabled against a target lacking the methods', async () => {
    const button = mount(() => {});
    await nextFrame();
    await button.updateComplete;
    const inner = button.shadowRoot!.querySelector('button')!;
    expect(inner.disabled).toBe(true);
  });

  it('warns once on first pointer interaction with an unsupported control', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const button = mount(() => {});
    await nextFrame();
    await button.updateComplete;
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('startRecording');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-record-button.test.ts`
Expected: new tests FAIL (`disabled` is false against unsupported target; no warn)

- [ ] **Step 3: Extend the base class** — replace `daw-transport-button.ts` content:

```ts
import { LitElement, css } from 'lit';
import {
  resolveTransportTarget,
  targetSupports,
  warnUnsupportedOnce,
} from '../utils/transport-capability';

/**
 * Base class for transport button elements.
 * Finds target via closest <daw-transport>. Capability detection is
 * duck-typed (#474): subclasses declare requiredTargetMethods and render
 * `?disabled=${!this.targetSupported}`; targets lacking the methods get a
 * disabled control and a one-time console warning on interaction.
 */
export class DawTransportButton extends LitElement {
  /** Methods the transport target must implement for this control to be
   *  enabled. Empty = works with any target. */
  protected static requiredTargetMethods: readonly string[] = [];

  protected get target(): any {
    return resolveTransportTarget(this);
  }

  private get _requiredMethods(): readonly string[] {
    return (this.constructor as typeof DawTransportButton).requiredTargetMethods;
  }

  /** False when this control declares requirements its target doesn't meet. */
  protected get targetSupported(): boolean {
    const required = this._requiredMethods;
    if (required.length === 0) return true;
    return targetSupports(this.target, required);
  }

  connectedCallback() {
    super.connectedCallback();
    // Disabled inner buttons swallow clicks — listen on the host so an
    // unsupported control still explains itself on first interaction.
    this.addEventListener('pointerdown', this._onCapabilityPointerDown);
    // The transport `for` id resolves after connect (target may upgrade
    // later) — re-render once it's resolvable so disabled state is accurate.
    requestAnimationFrame(() => this.requestUpdate());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    this.removeEventListener('pointerdown', this._onCapabilityPointerDown);
  }

  private _onCapabilityPointerDown = () => {
    if (this.target && !this.targetSupported) {
      warnUnsupportedOnce(this, this._requiredMethods);
    }
  };

  static styles: import('lit').CSSResultGroup = css`
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

- [ ] **Step 4: Retrofit the record button** — in `daw-record-button.ts`:

Add after the class opening line:

```ts
  protected static override requiredTargetMethods: readonly string[] = [
    'startRecording',
    'stopRecording',
  ];
```

Change the `render()` button tag to include disabled state:

```ts
      <button
        part="button"
        ?disabled=${!this.targetSupported}
        ?data-recording=${this._isRecording}
        @click=${this._onClick}
      >
```

Note: with a missing target the record button now renders disabled for one frame until the rAF re-render resolves it — acceptable; play/pause/stop declare no requirements and are unaffected.

- [ ] **Step 5: Run the affected tests, then the full suite**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-record-button.test.ts && pnpm typecheck && npx vitest run`
Expected: all pass (if existing record-button tests use a real `<daw-editor>` target, it implements both methods — they stay green; if any asserts the button is never disabled, update it per the new contract)

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-transport-button.ts packages/dawcore/src/elements/daw-record-button.ts packages/dawcore/src/__tests__/daw-record-button.test.ts
git commit -m "feat: transport capability detection in DawTransportButton, record button declares requirements (#459)"
```

---

### Task 8: `<daw-time-display>` element

**Files:**
- Create: `packages/dawcore/src/elements/daw-time-display.ts`
- Test: `packages/dawcore/src/__tests__/daw-time-display.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/dawcore/src/__tests__/daw-time-display.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawTimeDisplayElement } from '../elements/daw-time-display';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

function dispatchFrom(target: HTMLElement, type: string, detail: unknown) {
  target.dispatchEvent(new CustomEvent(type, { bubbles: true, composed: true, detail }));
}

describe('daw-time-display', () => {
  let fakeEditor: HTMLElement;
  let display: DawTimeDisplayElement;

  beforeEach(async () => {
    fakeEditor = document.createElement('div');
    fakeEditor.id = 'fake-ed';
    Object.assign(fakeEditor, { currentTime: 12.5, timeFormat: 'hh:mm:ss.sss' });
    document.body.appendChild(fakeEditor);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="fake-ed"><daw-time-display></daw-time-display></daw-transport>'
    );
    display = document.querySelector('daw-time-display') as DawTimeDisplayElement;
    await nextFrame();
    await display.updateComplete;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('has status role and aria attributes per the accessibility spec', () => {
    const span = display.shadowRoot!.querySelector('span')!;
    expect(span.getAttribute('role')).toBe('status');
    expect(span.getAttribute('aria-label')).toBe('Playback time');
    expect(span.getAttribute('aria-live')).toBe('off');
  });

  it('renders the target currentTime in the target timeFormat initially', () => {
    expect(display.shadowRoot!.textContent).toContain('00:00:12.500');
  });

  it('updates on daw-timeupdate events from the target', async () => {
    dispatchFrom(fakeEditor, 'daw-timeupdate', { time: 65.25 });
    await display.updateComplete;
    expect(display.shadowRoot!.textContent).toContain('00:01:05.250');
  });

  it('ignores daw-timeupdate events from other elements', async () => {
    const other = document.createElement('div');
    document.body.appendChild(other);
    dispatchFrom(other, 'daw-timeupdate', { time: 99 });
    await display.updateComplete;
    expect(display.shadowRoot!.textContent).toContain('00:00:12.500');
  });

  it('re-formats on daw-time-format-change from the target', async () => {
    dispatchFrom(fakeEditor, 'daw-time-format-change', { format: 'seconds' });
    await display.updateComplete;
    expect(display.shadowRoot!.textContent).toContain('12.500');
  });
});

describe('daw-time-display without a target', () => {
  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders a placeholder and warns once', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const display = document.createElement('daw-time-display') as DawTimeDisplayElement;
    document.body.appendChild(display);
    await nextFrame();
    await display.updateComplete;
    expect(display.shadowRoot!.textContent).toContain('--:--:--');
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-time-display.test.ts`
Expected: FAIL — `daw-time-display` is not a registered element / shadowRoot empty (registration happens in Step 3 + the index import added in Task 10; for now import the element file directly at the top of the test if `../index` doesn't register it yet: `import '../elements/daw-time-display';`)

- [ ] **Step 3: Write the element**

```ts
// packages/dawcore/src/elements/daw-time-display.ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { resolveTransportTarget } from '../utils/transport-capability';
import {
  formatDisplayTime,
  isTimeDisplayFormat,
  type TimeDisplayFormat,
} from '../utils/time-display-format';
import type { DawEvent } from '../events';

/**
 * Formatted playback time readout for <daw-transport>.
 *
 * Subscribes to bubbled `daw-timeupdate` / `daw-time-format-change` events at
 * the document level and filters by its transport target — works with any
 * target that dispatches them (<daw-editor> today, <daw-player> later) and
 * tolerates targets that upgrade after this element connects.
 *
 * Accessibility (spec): role="status", aria-live="off" — not announced every
 * frame; screen reader users query on demand.
 */
@customElement('daw-time-display')
export class DawTimeDisplayElement extends LitElement {
  @state() private _time = 0;
  @state() private _format: TimeDisplayFormat = 'hh:mm:ss.sss';
  @state() private _hasTarget = false;

  static styles = css`
    span {
      display: inline-block;
      font-family: ui-monospace, 'SF Mono', Menlo, Consolas, monospace;
      font-variant-numeric: tabular-nums;
      color: var(--daw-controls-text, #e0d4c8);
      background: var(--daw-controls-background, #1a1a2e);
      border: 1px solid currentColor;
      padding: 4px 8px;
    }
  `;

  private get target(): any {
    return resolveTransportTarget(this);
  }

  private _onTimeUpdate = (e: Event) => {
    if (e.target !== this.target) return;
    this._hasTarget = true;
    this._time = (e as DawEvent<'daw-timeupdate'>).detail.time;
  };

  private _onFormatChange = (e: Event) => {
    if (e.target !== this.target) return;
    this._format = (e as DawEvent<'daw-time-format-change'>).detail.format;
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('daw-timeupdate', this._onTimeUpdate);
    document.addEventListener('daw-time-format-change', this._onFormatChange);
    // Defer the initial read until <daw-transport for> and the target have
    // upgraded (same pattern as the transport buttons).
    requestAnimationFrame(() => this._syncFromTarget());
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('daw-timeupdate', this._onTimeUpdate);
    document.removeEventListener('daw-time-format-change', this._onFormatChange);
  }

  private _syncFromTarget() {
    const target = this.target;
    if (!target || typeof target.currentTime !== 'number') {
      console.warn(
        '[dawcore] <daw-time-display> has no target. Check <daw-transport for="..."> ' +
          'references a valid element. The display recovers automatically once the ' +
          'target dispatches daw-timeupdate.'
      );
      return;
    }
    this._hasTarget = true;
    this._time = target.currentTime;
    if (isTimeDisplayFormat(target.timeFormat)) {
      this._format = target.timeFormat;
    }
  }

  render() {
    const text = this._hasTarget ? formatDisplayTime(this._time, this._format) : '--:--:--';
    return html`<span role="status" aria-label="Playback time" aria-live="off">${text}</span>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-time-display': DawTimeDisplayElement;
  }
}
```

- [ ] **Step 4: Register in the package index** — in `packages/dawcore/src/index.ts`, add alongside the other element imports (near `import './elements/daw-transport'`):

```ts
import './elements/daw-time-display';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-time-display.test.ts`
Expected: PASS (7 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-time-display.ts packages/dawcore/src/index.ts packages/dawcore/src/__tests__/daw-time-display.test.ts
git commit -m "feat: daw-time-display transport element (#459)"
```

---

### Task 9: `<daw-time-format>` element

**Files:**
- Create: `packages/dawcore/src/elements/daw-time-format.ts`
- Test: `packages/dawcore/src/__tests__/daw-time-format.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// packages/dawcore/src/__tests__/daw-time-format.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawTimeFormatElement } from '../elements/daw-time-format';

const nextFrame = () => new Promise((r) => requestAnimationFrame(() => r(undefined)));

describe('daw-time-format', () => {
  let fakeEditor: HTMLElement & { setTimeFormat?: (f: string) => void };
  let element: DawTimeFormatElement;

  beforeEach(async () => {
    fakeEditor = document.createElement('div');
    fakeEditor.id = 'fake-ed';
    Object.assign(fakeEditor, {
      timeFormat: 'hh:mm:ss',
      setTimeFormat: vi.fn(),
    });
    document.body.appendChild(fakeEditor);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="fake-ed"><daw-time-format></daw-time-format></daw-transport>'
    );
    element = document.querySelector('daw-time-format') as DawTimeFormatElement;
    await nextFrame();
    await element.updateComplete;
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  it('renders a select with the three formats and an aria-label', () => {
    const select = element.shadowRoot!.querySelector('select')!;
    expect(select.getAttribute('aria-label')).toBe('Time format');
    const values = Array.from(select.querySelectorAll('option')).map((o) => o.value);
    expect(values).toEqual(['hh:mm:ss.sss', 'hh:mm:ss', 'seconds']);
  });

  it('initializes its value from the target timeFormat', () => {
    const select = element.shadowRoot!.querySelector('select')!;
    expect(select.value).toBe('hh:mm:ss');
  });

  it('calls target.setTimeFormat on change', () => {
    const select = element.shadowRoot!.querySelector('select')!;
    select.value = 'seconds';
    select.dispatchEvent(new Event('change'));
    expect(fakeEditor.setTimeFormat).toHaveBeenCalledWith('seconds');
  });

  it('follows daw-time-format-change events from the target (programmatic sync)', async () => {
    fakeEditor.dispatchEvent(
      new CustomEvent('daw-time-format-change', {
        bubbles: true,
        composed: true,
        detail: { format: 'seconds' },
      })
    );
    await element.updateComplete;
    expect(element.shadowRoot!.querySelector('select')!.value).toBe('seconds');
  });

  it('renders disabled against a target lacking setTimeFormat, warns once on interaction', async () => {
    document.body.innerHTML = '';
    const bare = document.createElement('div');
    bare.id = 'bare';
    document.body.appendChild(bare);
    document.body.insertAdjacentHTML(
      'beforeend',
      '<daw-transport for="bare"><daw-time-format></daw-time-format></daw-transport>'
    );
    const el = document.querySelector('daw-time-format') as DawTimeFormatElement;
    await nextFrame();
    await el.updateComplete;
    expect(el.shadowRoot!.querySelector('select')!.disabled).toBe(true);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    el.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('setTimeFormat');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-time-format.test.ts`
Expected: FAIL — element not registered

- [ ] **Step 3: Write the element**

```ts
// packages/dawcore/src/elements/daw-time-format.ts
import { LitElement, html, css } from 'lit';
import { customElement, state } from 'lit/decorators.js';
import {
  resolveTransportTarget,
  targetSupports,
  warnUnsupportedOnce,
} from '../utils/transport-capability';
import {
  TIME_DISPLAY_FORMATS,
  isTimeDisplayFormat,
  type TimeDisplayFormat,
} from '../utils/time-display-format';
import type { DawEvent } from '../events';

/**
 * Time format select for <daw-transport>. Sets the format ON the target
 * (`target.setTimeFormat(...)`) — the target owns the state (native-form
 * style), and every display/input syncs via the bubbled
 * `daw-time-format-change` event. Renders disabled when the target doesn't
 * implement setTimeFormat (duck-typed capability detection, #474).
 */
@customElement('daw-time-format')
export class DawTimeFormatElement extends LitElement {
  @state() private _format: TimeDisplayFormat = 'hh:mm:ss.sss';

  static styles = css`
    select {
      cursor: pointer;
      background: var(--daw-controls-background, #1a1a2e);
      color: var(--daw-controls-text, #e0d4c8);
      border: 1px solid currentColor;
      padding: 4px 8px;
      font: inherit;
    }
    select:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `;

  private get target(): any {
    return resolveTransportTarget(this);
  }

  private get _targetSupported(): boolean {
    return targetSupports(this.target, ['setTimeFormat']);
  }

  private _onFormatChange = (e: Event) => {
    if (e.target !== this.target) return;
    this._format = (e as DawEvent<'daw-time-format-change'>).detail.format;
  };

  private _onPointerDown = () => {
    if (this.target && !this._targetSupported) {
      warnUnsupportedOnce(this, ['setTimeFormat']);
    }
  };

  connectedCallback() {
    super.connectedCallback();
    document.addEventListener('daw-time-format-change', this._onFormatChange);
    this.addEventListener('pointerdown', this._onPointerDown);
    // Defer until the transport target has upgraded, then sync + re-render.
    requestAnimationFrame(() => {
      const target = this.target;
      if (target && isTimeDisplayFormat(target.timeFormat)) {
        this._format = target.timeFormat;
      }
      this.requestUpdate();
    });
  }

  disconnectedCallback() {
    super.disconnectedCallback();
    document.removeEventListener('daw-time-format-change', this._onFormatChange);
    this.removeEventListener('pointerdown', this._onPointerDown);
  }

  private _onSelectChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value as TimeDisplayFormat;
    const target = this.target;
    if (!target) {
      console.warn(
        '[dawcore] <daw-time-format> has no target. Check <daw-transport for="..."> ' +
          'references a valid element.'
      );
      return;
    }
    target.setTimeFormat(value);
  }

  render() {
    return html`
      <select
        aria-label="Time format"
        ?disabled=${!this._targetSupported}
        @change=${this._onSelectChange}
      >
        ${TIME_DISPLAY_FORMATS.map(
          (f) => html`<option value=${f} ?selected=${f === this._format}>${f}</option>`
        )}
      </select>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'daw-time-format': DawTimeFormatElement;
  }
}
```

- [ ] **Step 4: Register in the package index** — in `packages/dawcore/src/index.ts`:

```ts
import './elements/daw-time-format';
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-time-format.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/elements/daw-time-format.ts packages/dawcore/src/index.ts packages/dawcore/src/__tests__/daw-time-format.test.ts
git commit -m "feat: daw-time-format transport element (#459)"
```

---

### Task 10: Public exports, demo page, spec checklist, full verification

**Files:**
- Modify: `packages/dawcore/src/index.ts`
- Modify: `examples/dawcore-native/basic.html`
- Modify: `docs/specs/web-components-migration.md` (line ~2052)

- [ ] **Step 1: Add public exports** to `packages/dawcore/src/index.ts`:

Class exports (next to `export { DawTransportButton }`):

```ts
export { DawTimeDisplayElement } from './elements/daw-time-display';
export { DawTimeFormatElement } from './elements/daw-time-format';
```

Utility exports (new lines near the other util/controller exports):

```ts
export {
  TIME_DISPLAY_FORMATS,
  isTimeDisplayFormat,
  formatDisplayTime,
  parseDisplayTime,
} from './utils/time-display-format';
export type { TimeDisplayFormat } from './utils/time-display-format';
export {
  resolveTransportTarget,
  targetSupports,
  warnUnsupportedOnce,
} from './utils/transport-capability';
export { PlaybackAnimationController } from './controllers/playback-animation-controller';
```

Event detail types: find the `export type { ... } from './events'` block and add `DawTimeUpdateDetail, DawTimeFormatChangeDetail`.

- [ ] **Step 2: Update the demo page** — in `examples/dawcore-native/basic.html`, inside the `<daw-transport for="editor">` block after `<daw-stop-button>` (match existing indentation; examples are outside lint scope — hand-format):

```html
    <daw-time-display></daw-time-display>
    <daw-time-format></daw-time-format>
```

And add an event log line with the others at the bottom script (throttle-free is too chatty — log format changes only):

```js
    editor.addEventListener('daw-time-format-change', (e) => addLog('time-format: ' + e.detail.format));
```

- [ ] **Step 3: Tick the spec checklist** — in `docs/specs/web-components-migration.md` line ~2052, change:

```
- [ ] `<daw-time-display>` / `<daw-time-format>` → #459
```

to:

```
- [x] `<daw-time-display>` / `<daw-time-format>` → #459
```

- [ ] **Step 4: Full verification**

```bash
cd packages/dawcore && pnpm typecheck && npx vitest run
cd ../.. && pnpm lint
pnpm --filter @dawcore/components build
pgrep -f vitest && pkill -f vitest || true
```

Expected: typecheck clean, all dawcore tests pass, lint clean (run `pnpm format` if prettier complains), build succeeds, no orphaned vitest processes.

- [ ] **Step 5: Manual smoke test** (optional but recommended): `pnpm example:dawcore-native` from repo root, open the printed URL → `basic.html`, press Play — the time display ticks at RAF rate; switching the format select changes the display live; time settles on exact position after pause/seek.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/index.ts examples/dawcore-native/basic.html docs/specs/web-components-migration.md
git commit -m "feat: export time display elements + utils, demo page, spec checklist (#459)"
```

---

### Post-implementation (separate from this plan)

Per the established per-issue workflow: PR → code review → fix findings → `claude-md-management:revise-claude-md` → await merge approval. Before the PR merges, `git rm docs/specs/2026-06-11-time-display-design.md docs/plans/2026-06-11-time-display.md`. The PR description must mention the `DawPlayheadElement` breaking change (animation methods removed in favor of `setPosition`).
