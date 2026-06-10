# Seek Playhead Latency Compensation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Clicking to seek positions the cursor exactly at the click point; latency compensation (outputLatency + Tone lookAhead) applies only while playing, centralized in `PlaylistEngine.getAudibleTime()`.

**Architecture:** New `getAudibleTime()` method on `PlaylistEngine` returns raw `_currentTime` when not playing, and compensated time (held at play-start during the pre-roll window) while playing. The React provider and `<daw-editor>` delete their hand-rolled compensation: resting displays use raw time, playing displays call the engine method.

**Tech Stack:** TypeScript, vitest (engine: node env; dawcore: happy-dom), Playwright e2e, pnpm workspace.

**Spec:** `docs/specs/2026-06-09-seek-playhead-latency-design.md`

**Build-order gotcha:** downstream `pnpm typecheck` resolves workspace packages via `dist/`. After Task 1, run `pnpm --filter @waveform-playlist/engine build` before typechecking browser or dawcore. Known pre-existing failure: root `pnpm typecheck` fails on `packages/dawcore-midi/__tests__/parseMidiFile.test.ts` — verify touched packages individually.

---

### Task 1: `PlaylistEngine.getAudibleTime()` (TDD)

**Files:**
- Test: `packages/engine/src/__tests__/getAudibleTime.test.ts` (create)
- Modify: `packages/engine/src/PlaylistEngine.ts` (after the `lookAhead` getter, ~line 634)

- [ ] **Step 1: Write the failing test**

Create `packages/engine/src/__tests__/getAudibleTime.test.ts`:

```typescript
import { describe, it, expect, vi } from 'vitest';
import { PlaylistEngine } from '../PlaylistEngine';
import type { PlayoutAdapter } from '../types';

interface AdapterHarness {
  adapter: PlayoutAdapter;
  setPosition: (t: number) => void;
}

function makeAdapter(
  opts: { lookAhead?: number; outputLatency?: number | undefined } = {}
): AdapterHarness {
  const lookAhead = opts.lookAhead ?? 0.1;
  // 'in' check, not a destructuring default — an explicit `outputLatency: undefined`
  // must produce a context WITHOUT the property (native-adapter case), and a
  // destructuring default would silently replace it with 0.01.
  const outputLatency = 'outputLatency' in opts ? opts.outputLatency : 0.01;
  let position = 0;
  const audioContext = (
    outputLatency === undefined
      ? { sampleRate: 48000, state: 'running' }
      : { sampleRate: 48000, state: 'running', outputLatency }
  ) as unknown as AudioContext;
  const adapter: PlayoutAdapter = {
    audioContext,
    ppqn: 960,
    lookAhead,
    init: vi.fn().mockResolvedValue(undefined),
    setTracks: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn((t: number) => {
      position = t;
    }),
    getCurrentTime: vi.fn(() => position),
    isPlaying: vi.fn(() => false),
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    setTrackPan: vi.fn(),
    setLoop: vi.fn(),
    dispose: vi.fn(),
  };
  return {
    adapter,
    setPosition: (t: number) => {
      position = t;
    },
  };
}

describe('PlaylistEngine.getAudibleTime', () => {
  it('returns 0 initially', () => {
    const { adapter } = makeAdapter();
    const engine = new PlaylistEngine({ adapter });
    expect(engine.getAudibleTime()).toBe(0);
    engine.dispose();
  });

  it('returns the exact seeked position while stopped (no compensation)', () => {
    const { adapter } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.seek(5);
    expect(engine.getAudibleTime()).toBe(5);
    engine.dispose();
  });

  it('returns the raw pause position (no compensation while resting)', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(2);
    setPosition(10);
    engine.pause();
    expect(engine.getAudibleTime()).toBe(10);
    engine.dispose();
  });

  it('returns exactly the play-start position after stop', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(3);
    setPosition(8);
    engine.stop();
    expect(engine.getAudibleTime()).toBe(3);
    engine.dispose();
  });

  it('holds at the play-start position during the pre-roll window', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(5);
    // raw 5.02 → compensated 5.02 − 0.11 = 4.91 < playStart 5 → hold at 5
    setPosition(5.02);
    expect(engine.getAudibleTime()).toBe(5);
    engine.dispose();
  });

  it('subtracts outputLatency + lookAhead once past the pre-roll window', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(5);
    setPosition(5.5);
    expect(engine.getAudibleTime()).toBeCloseTo(5.39, 10);
    engine.dispose();
  });

  it('does not hold when raw drops below play-start (loop wrap)', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(5);
    // Transport loop wrapped to a region starting before the play start.
    setPosition(2);
    expect(engine.getAudibleTime()).toBeCloseTo(1.89, 10);
    engine.dispose();
  });

  it('clamps to 0 while playing near time zero', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: 0.01 });
    const engine = new PlaylistEngine({ adapter });
    engine.play(0);
    setPosition(0);
    // hold condition: raw 0 >= playStart 0 and −0.11 < 0 → hold at 0
    expect(engine.getAudibleTime()).toBe(0);
    engine.dispose();
  });

  it('is a near no-op for native adapters (lookAhead 0, no outputLatency)', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0, outputLatency: undefined });
    const engine = new PlaylistEngine({ adapter });
    engine.play(1);
    setPosition(4);
    expect(engine.getAudibleTime()).toBe(4);
    engine.dispose();
  });

  it('guards non-finite outputLatency', () => {
    const { adapter, setPosition } = makeAdapter({ lookAhead: 0.1, outputLatency: NaN });
    const engine = new PlaylistEngine({ adapter });
    engine.play(1);
    setPosition(4);
    expect(engine.getAudibleTime()).toBe(0);
    engine.dispose();
  });

  it('returns raw _currentTime with no adapter', () => {
    const engine = new PlaylistEngine();
    engine.seek(7);
    expect(engine.getAudibleTime()).toBe(7);
    engine.dispose();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/engine && npx vitest run src/__tests__/getAudibleTime.test.ts`
Expected: FAIL — `engine.getAudibleTime is not a function`

- [ ] **Step 3: Implement `getAudibleTime()`**

In `packages/engine/src/PlaylistEngine.ts`, insert directly after the `lookAhead` getter (ends ~line 634):

```typescript
  /**
   * Playback position aligned with what the listener actually hears, for
   * visual consumers (playhead, progress overlays, auto-scroll).
   *
   * While playing: `getCurrentTime() − outputLatency − lookAhead`, held at
   * the play-start position during the pre-roll window (audio at the start
   * position isn't audible until ~outputLatency + lookAhead after `play()`,
   * so the cursor waits there instead of jumping backward).
   *
   * While not playing: the raw resting position. A stationary cursor has no
   * audible counterpart — seek/stop/pause positions display exactly.
   *
   * Storage stays raw: never feed this value back into `play()`/`seek()`,
   * which compounds the subtraction on every cycle. Use `getCurrentTime()`
   * for storage and resume positions.
   */
  getAudibleTime(): number {
    if (!this._isPlaying) {
      return this._currentTime;
    }
    const ctx = this._adapter?.audioContext;
    const outputLatency =
      ctx && 'outputLatency' in ctx ? ((ctx as AudioContext).outputLatency ?? 0) : 0;
    const raw = this.getCurrentTime();
    let t = raw - outputLatency - this.lookAhead;
    if (raw >= this._playStartPosition && t < this._playStartPosition) {
      t = this._playStartPosition;
    }
    return Number.isFinite(t) ? Math.max(0, t) : 0;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/engine && npx vitest run src/__tests__/getAudibleTime.test.ts`
Expected: PASS (11 tests)

- [ ] **Step 5: Run the full engine suite + typecheck, then build**

Run: `cd packages/engine && npx vitest run && pnpm typecheck`
Expected: all existing tests still pass.
Run (from repo root): `pnpm --filter @waveform-playlist/engine build`
Expected: build succeeds — required so downstream packages see the new method via `dist/`.

- [ ] **Step 6: Update the `lookAhead` doc comments to point at `getAudibleTime()`**

In `packages/engine/src/types.ts`, replace the `lookAhead` JSDoc (lines 52–57) with:

```typescript
  /** Audio scheduling lookahead in seconds — `getCurrentTime()` is this far ahead of
   *  what the listener actually hears. Tone.js Transport reports a position lookAhead
   *  ahead of audible (default 0.1s); native AudioContext-based adapters have no
   *  lookahead. Consumers visualizing playback position should use
   *  `PlaylistEngine.getAudibleTime()`, which applies this (plus
   *  `audioContext.outputLatency`) only while playing. Returns 0 or undefined when
   *  there's no lookahead. */
```

In `packages/engine/src/PlaylistEngine.ts`, replace the `lookAhead` getter JSDoc (lines 624–631) with:

```typescript
  /**
   * Audio scheduling lookahead in seconds — `getCurrentTime()` is this far ahead of
   * what the listener actually hears. Tone.js Transport reports a position that's
   * `lookAhead` ahead of audible (default 0.1s); native AudioContext-based adapters
   * have no lookahead and return 0. Visual consumers should use `getAudibleTime()`,
   * which applies this compensation only while playing.
   */
```

- [ ] **Step 7: Commit**

```bash
git add packages/engine/src/__tests__/getAudibleTime.test.ts packages/engine/src/PlaylistEngine.ts packages/engine/src/types.ts
git commit -m "feat(engine): add getAudibleTime() — latency-compensated position only while playing"
```

---

### Task 2: React provider — resting cursor shows raw time

**Files:**
- Modify: `packages/browser/src/WaveformPlaylistContext.tsx` (three regions: `toVisualTime` ~1058–1067, animation loop ~1097–1116, doc comments ~89, 100–101, 383)

No new unit test: the compensation logic now lives (and is tested) in the engine; the provider becomes a thin delegation verified by Task 4's e2e test and the existing browser suite.

- [ ] **Step 1: Simplify `toVisualTime` to the resting-display rule**

Replace lines 1058–1067:

```typescript
  // Convert a raw engine time to its visually-aligned counterpart (subtracts
  // outputLatency and engine.lookAhead). Used by pause/seek/stop paths to
  // keep visualTimeRef in sync when the animation loop isn't running.
  const toVisualTime = useCallback((rawTime: number): number => {
    const audioCtx = getGlobalAudioContext();
    const latency = 'outputLatency' in audioCtx ? (audioCtx as AudioContext).outputLatency : 0;
    const lookAhead = engineRef.current?.lookAhead ?? 0;
    const visual = rawTime - latency - lookAhead;
    return Number.isFinite(visual) ? Math.max(0, visual) : 0;
  }, []);
```

with:

```typescript
  // Resting (non-playing) cursor positions display the raw time unchanged.
  // Latency compensation (outputLatency + lookAhead) models the gap between
  // the Transport's scheduling position and audible output — a property of
  // *playing*, not of position. A seeked/paused/stopped cursor has no audible
  // counterpart; the commanded position is the truth. During playback the
  // animation loop uses engine.getAudibleTime() instead.
  const toVisualTime = useCallback((rawTime: number): number => {
    return Number.isFinite(rawTime) ? Math.max(0, rawTime) : 0;
  }, []);
```

- [ ] **Step 2: Use `engine.getAudibleTime()` in the animation loop**

In `startAnimationLoop` (~lines 1097–1116), delete the cached AudioContext at the top of the callback:

```typescript
    // Cache AudioContext at loop start — stable for the lifetime of this playback session.
    // outputLatency is read per-frame since it's a dynamic property.
    const audioCtx = getGlobalAudioContext();
```

(keep `const updateTime = () => {` and the `getPlaybackTime()` lines), and replace the visual-time block:

```typescript
      // Compute visual time once — all visual consumers use this same value.
      // Subtracts outputLatency (hardware DAC delay) AND adapter.lookAhead
      // (Tone.js Transport runs lookAhead ahead of audible — ~100ms by default)
      // so DOM positions match what the listener actually hears. Native adapter
      // reports lookAhead as 0, so this is a no-op there.
      const latency = 'outputLatency' in audioCtx ? (audioCtx as AudioContext).outputLatency : 0;
      const lookAhead = engineRef.current?.lookAhead ?? 0;
      const visualRaw = time - latency - lookAhead;
      const visualTime = Number.isFinite(visualRaw) ? Math.max(0, visualRaw) : 0;
      visualTimeRef.current = visualTime;
```

with:

```typescript
      // Compute visual time once — all visual consumers use this same value.
      // engine.getAudibleTime() subtracts outputLatency (hardware DAC delay)
      // and adapter.lookAhead (Tone.js Transport runs ~100ms ahead of audible),
      // holding at the play-start position during the pre-roll window. Native
      // adapters report lookAhead 0, so this is a near no-op there.
      const visualRaw = engineRef.current ? engineRef.current.getAudibleTime() : time;
      const visualTime = Number.isFinite(visualRaw) ? Math.max(0, visualRaw) : 0;
      visualTimeRef.current = visualTime;
```

If deleting the `audioCtx` lines leaves `getGlobalAudioContext` unused in this file, remove it from the imports — `noUnusedLocals`/ESLint will flag it. (It is likely still used by the `sampleRate` lazy initializer; check before removing.)

- [ ] **Step 3: Update the stale doc comments**

Line ~89 (`PlaybackAnimationContextValue` field doc):

```typescript
  /** time - outputLatency (for DOM positioning — matches speaker output). */
```

becomes:

```typescript
  /** Visually-aligned time for DOM positioning: engine.getAudibleTime() while
   *  playing (matches speaker output), raw time when resting. */
```

Lines ~100–101 (`visualTimeRef` doc), replace:

```typescript
   * Visually-aligned playback time (raw engine time minus `outputLatency` and
   * `engine.lookAhead`). Kept current by the animation loop during playback
```

with:

```typescript
   * Visually-aligned playback time (engine.getAudibleTime() while playing;
   * raw resting time otherwise). Kept current by the animation loop during playback
```

Line ~383, replace:

```typescript
  // Visually-aligned playback time (raw - outputLatency - lookAhead). The
```

with:

```typescript
  // Visually-aligned playback time (see toVisualTime / getAudibleTime). The
```

Also re-word the comment above `setCurrentTimeRefs` (~lines 1069–1072) — it stays accurate (dual-ref pattern, pair-writes), no change needed beyond verifying it doesn't mention subtraction. If it does, align it with the new rule.

- [ ] **Step 4: Verify no leftover references and run checks**

Run: `grep -n "outputLatency" packages/browser/src/WaveformPlaylistContext.tsx`
Expected: matches only inside comments (the animation-loop comment explaining what `getAudibleTime()` subtracts) — no code reads `outputLatency` in this file anymore. The recording-preview usage lives in `PlaylistVisualization.tsx`, untouched.

Run: `pnpm --filter @waveform-playlist/browser typecheck && cd packages/browser && npx vitest run`
Expected: PASS. (If typecheck can't find `getAudibleTime`, re-run `pnpm --filter @waveform-playlist/engine build`.)

- [ ] **Step 5: Commit**

```bash
git add packages/browser/src/WaveformPlaylistContext.tsx
git commit -m "fix(browser): seek cursor lands exactly at click — resting playhead shows raw time"
```

---

### Task 3: dawcore — `<daw-editor>` playhead (TDD)

**Files:**
- Test: `packages/dawcore/src/__tests__/daw-editor-seek-playhead.test.ts` (create)
- Modify: `packages/dawcore/src/elements/daw-editor.ts` (`_startPlayhead` ~2319–2341, `_stopPlayhead` ~2342–2362)

- [ ] **Step 1: Write the failing test**

Copy `makeMockAdapter` from `packages/dawcore/src/__tests__/daw-editor-midi.test.ts` (the reference mock shape per dawcore CLAUDE.md — includes `init`, `isPlaying`, `updateTrack`) and extend it with Tone-like latency fields. Create `packages/dawcore/src/__tests__/daw-editor-seek-playhead.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import '../index';
import type { DawEditorElement } from '../elements/daw-editor';

// Mock adapter modeled on daw-editor-midi.test.ts:makeMockAdapter, with
// Tone-adapter-like latency characteristics (lookAhead 0.1, outputLatency 0.01).
function makeMockAdapter() {
  let position = 0;
  return {
    audioContext: {
      sampleRate: 48000,
      state: 'running',
      outputLatency: 0.01,
    } as unknown as AudioContext,
    ppqn: 960,
    lookAhead: 0.1,
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

describe('daw-editor seek playhead position', () => {
  let editor: DawEditorElement;

  beforeEach(async () => {
    editor = document.createElement('daw-editor') as DawEditorElement;
    editor.adapter = makeMockAdapter() as never;
    document.body.appendChild(editor);
    // Lightweight fully-loaded track without fetch/decode (dawcore CLAUDE.md).
    await editor.addTrack({
      name: 'midi',
      midi: { notes: [{ midi: 60, time: 0, duration: 1, velocity: 0.8 }] },
    });
    await editor.updateComplete;
  });

  afterEach(() => {
    editor.remove();
  });

  it('seekTo while stopped positions the resting playhead at the exact time', () => {
    const playhead = editor.shadowRoot!.querySelector('daw-playhead') as HTMLElement & {
      stopAnimation: (time: number, sampleRate: number, spp: number) => void;
    };
    expect(playhead).toBeTruthy();
    const stopSpy = vi.fn();
    playhead.stopAnimation = stopSpy;

    editor.seekTo(5);

    expect(stopSpy).toHaveBeenCalled();
    const visualTime = stopSpy.mock.calls[stopSpy.mock.calls.length - 1][0];
    // Exact click time — NOT 5 − outputLatency − lookAhead = 4.89.
    expect(visualTime).toBe(5);
  });
});
```

Note for the implementer: if `addTrack` or the playhead query needs adjustment under happy-dom, mirror the setup in `daw-editor-layout.test.ts` (`makeEditor()` helper) — the assertion that matters is `visualTime === 5`.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-seek-playhead.test.ts`
Expected: FAIL — `visualTime` is `4.89` (5 − 0.01 − 0.1), not `5`.

- [ ] **Step 3: Update `_startPlayhead` and `_stopPlayhead`**

In `packages/dawcore/src/elements/daw-editor.ts`, replace `_startPlayhead` (lines ~2319–2341):

```typescript
  _startPlayhead() {
    const playhead = this._getPlayhead();
    if (!playhead || !this._engine) return;
    const engine = this._engine;
    // engine.getAudibleTime(): while playing, engine time minus hardware DAC
    // latency (outputLatency) and scheduler lookahead (0.1s on Tone-backed
    // adapters, 0 native), held at the play-start position during the
    // pre-roll window. Without the subtraction the playhead leads audio by
    // ~100ms with the Tone adapter.
    const audibleTime = (): number => engine.getAudibleTime();
    if (this.scaleMode === 'beats') {
      const secondsToTicksFn = (s: number) => this._secondsToTicks(s);
      playhead.startBeatsAnimationWithMap(audibleTime, secondsToTicksFn, this.ticksPerPixel);
    } else {
      playhead.startAnimation(audibleTime, this.effectiveSampleRate, this.samplesPerPixel);
    }
  }
```

and replace `_stopPlayhead` (lines ~2342–2362):

```typescript
  _stopPlayhead() {
    const playhead = this._getPlayhead();
    if (!playhead) return;
    // Resting playhead displays the raw position — latency compensation is a
    // playback-time concept (Transport scheduling vs audible output). A
    // seeked/stopped/paused cursor shows exactly the commanded position.
    // Storage (`_currentTime`) is already raw, so play() resumes correctly.
    const t = this._currentTime;
    const visualTime = Number.isFinite(t) ? Math.max(0, t) : 0;
    if (this.scaleMode === 'beats') {
      playhead.stopBeatsAnimationWithMap(
        visualTime,
        (s: number) => this._secondsToTicks(s),
        this.ticksPerPixel
      );
    } else {
      playhead.stopAnimation(visualTime, this.effectiveSampleRate, this.samplesPerPixel);
    }
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd packages/dawcore && npx vitest run src/__tests__/daw-editor-seek-playhead.test.ts`
Expected: PASS

- [ ] **Step 5: Run the full dawcore suite + typecheck**

Run: `cd packages/dawcore && npx vitest run && pnpm typecheck`
Expected: PASS (dawcore typecheck is per-package per project memory). Check for orphaned vitest processes afterward: `pgrep -f vitest` → `pkill -f vitest` if needed.

- [ ] **Step 6: Commit**

```bash
git add packages/dawcore/src/__tests__/daw-editor-seek-playhead.test.ts packages/dawcore/src/elements/daw-editor.ts
git commit -m "fix(dawcore): resting playhead shows raw position; playing path uses engine.getAudibleTime()"
```

---

### Task 4: e2e — click-to-seek playhead alignment

**Files:**
- Modify: `e2e/multi-clip.spec.ts` (inside the existing `Playhead Positioning` describe block, after the `clicking on waveform area moves playhead` test)

- [ ] **Step 1: Add the alignment test**

```typescript
    test('playhead lands exactly where clicked (no latency offset)', async ({ page }) => {
      const clipContainer = page.locator('[data-clip-container]').first();
      await expect(clipContainer).toBeVisible();

      let box: { x: number; y: number; width: number; height: number } | null = null;
      await expect(async () => {
        box = await clipContainer.boundingBox();
        expect(box).toBeTruthy();
      }).toPass({ timeout: 5000 });

      const clickX = box!.x + box!.width / 2;
      const clickY = box!.y + box!.height / 2;
      await page.mouse.click(clickX, clickY);

      // The playhead must land at the click x. Before the fix the Tone
      // adapter's lookAhead (0.1s) + outputLatency pulled it ~5px (at
      // 1000 spp) behind the click.
      const playhead = page.locator('[data-playhead]');
      await expect(async () => {
        const phBox = await playhead.boundingBox();
        expect(phBox).toBeTruthy();
        expect(Math.abs(phBox!.x - clickX)).toBeLessThanOrEqual(2);
      }).toPass({ timeout: 5000 });
    });
```

- [ ] **Step 2: Build and run the e2e test**

Run (from repo root): `pnpm build && pnpm -w run test -- multi-clip.spec.ts`
Expected: the new test passes alongside the existing multi-clip tests. (Always rebuild before e2e — stale artifacts cause false failures.)

If the 2px tolerance flakes due to the playhead line's own width, compare against the playhead's center (`phBox.x + phBox.width / 2`) instead — keep the tolerance at 2px.

- [ ] **Step 3: Commit**

```bash
git add e2e/multi-clip.spec.ts
git commit -m "test(e2e): assert click-to-seek playhead pixel alignment"
```

---

### Task 5: Documentation sync

**Files:**
- Modify: `packages/engine/CLAUDE.md` (Patterns section)
- Modify: `packages/browser/CLAUDE.md` ("Playhead outputLatency Compensation" section)
- Modify: `packages/dawcore/CLAUDE.md` (two playhead-compensation bullets in Key Patterns)

- [ ] **Step 1: engine/CLAUDE.md — add the pattern**

Add to the Patterns list:

```markdown
- **`getAudibleTime()` for visual consumers** — Latency-compensated position (raw − `outputLatency` − `lookAhead`, held at `_playStartPosition` during the pre-roll window) while playing; raw `_currentTime` when resting. Compensation is a property of *playing*, not of position — a seeked/paused/stopped cursor displays exactly. Storage stays raw (`getCurrentTime()`); never feed `getAudibleTime()` back into `play()`/`seek()`.
```

- [ ] **Step 2: browser/CLAUDE.md — rewrite the compensation section**

Replace the body of "## Playhead outputLatency Compensation" with:

```markdown
`getPlaybackTime()` returns **raw engine time** — no latency subtraction. **Storage refs (`currentTimeRef`, pause/seek targets) must stay raw** so `play(time)` resumes correctly — subtracting latency from storage compounds on every pause/resume cycle.

**Display uses `visualTimeRef`.** While playing, the animation loop sets it from `engine.getAudibleTime()` (raw − `outputLatency` − `engine.lookAhead`, held at play-start during the pre-roll window). When resting (seek/pause/stop/selection-end), `toVisualTime` is the identity — the cursor displays the raw commanded position exactly; compensation is a property of playing, not of position. Every site that assigns `currentTimeRef.current = X` also assigns `visualTimeRef.current = toVisualTime(X)` via `setCurrentTimeRefs`. Static-display consumers read `visualTimeRef`; frame callbacks receive `visualTime` via `FrameData`; auto-scroll uses `visualTime`. The dual-ref pattern is mandatory: one ref → either storage broken (compounding) or display broken (lag).
```

- [ ] **Step 3: dawcore/CLAUDE.md — update the two bullets**

Replace:

```markdown
- **Playhead outputLatency compensation** — `_startPlayhead()` subtracts `audioContext.outputLatency` from `engine.getCurrentTime()` so the playhead matches when audio reaches speakers, not when it's processed. Safari reports ~15ms outputLatency vs Chrome's ~3ms. Falls back to 0 if `outputLatency` is not supported.
- **`_stopPlayhead()` displays audible time, storage stays raw** — Resting playhead reads `_currentTime - outputLatency - engine.lookAhead` into a local `visualTime` and passes that to the playhead element. `_currentTime` itself is never overwritten, so the next `play()` resumes from the correct scheduling position. Subtracting latency directly into `_currentTime` would compound on every pause/resume.
```

with:

```markdown
- **Playhead latency compensation lives in the engine** — `_startPlayhead()` animates from `engine.getAudibleTime()` (raw − `outputLatency` − `lookAhead` while playing, held at play-start during the pre-roll window; Safari reports ~15ms outputLatency vs Chrome's ~3ms, Tone adapters add 0.1s lookAhead).
- **`_stopPlayhead()` displays raw time, storage stays raw** — Resting playhead shows `_currentTime` exactly (compensation is a playing-time concept; a seeked/stopped/paused cursor displays the commanded position). `_currentTime` is never display-adjusted, so the next `play()` resumes from the correct scheduling position.
```

- [ ] **Step 4: Check the website doc surfaces**

Run: `grep -rn "outputLatency\|lookAhead" website/docs website/static/llms.txt`
Expected: if no hits, nothing to update. If hits describe the old "consumers subtract" behavior, update them to reference `engine.getAudibleTime()`.

- [ ] **Step 5: Commit**

```bash
git add packages/engine/CLAUDE.md packages/browser/CLAUDE.md packages/dawcore/CLAUDE.md
git commit -m "docs: getAudibleTime pattern — compensation only while playing"
```

---

### Task 6: Final verification + version bumps

- [ ] **Step 1: Full build, lint, per-package typecheck, all unit suites**

From repo root:

```bash
pnpm build
pnpm lint
pnpm --filter @waveform-playlist/engine typecheck
pnpm --filter @waveform-playlist/browser typecheck
cd packages/dawcore && pnpm typecheck && cd ../..
cd packages/engine && npx vitest run && cd ../..
cd packages/browser && npx vitest run && cd ../..
cd packages/dawcore && npx vitest run && cd ../..
pkill -f vitest || true
```

Expected: all green (root `pnpm typecheck` has the known pre-existing dawcore-midi failure — use the per-package commands above). Fix formatting with `pnpm format` if lint complains.

- [ ] **Step 2: Manual smoke test (Tone adapter)**

Run: `pnpm --filter website start`, open a multi-track example, hard refresh (Cmd+Shift+R):
1. Click the timeline while stopped → cursor lands exactly under the pointer.
2. Press play → cursor holds briefly (~100ms) at the start, then tracks audio smoothly — no backward jump.
3. Pause → cursor freezes (small forward hop is expected per spec); resume → continues seamlessly from the resting cursor.
4. Stop → cursor returns exactly to the play-start position.

Also: `pnpm example:dawcore-tone`, repeat 1–4 in `<daw-editor>`.

- [ ] **Step 3: Bump versions**

- `packages/engine/package.json` — minor bump (new public API `getAudibleTime`).
- `packages/browser/package.json` — patch bump.
- `packages/dawcore/package.json` (`@dawcore/components`) — patch bump (0.0.x line).

```bash
git add packages/engine/package.json packages/browser/package.json packages/dawcore/package.json
git commit -m "chore: version bumps for seek playhead latency fix"
```

- [ ] **Step 4: Remove working docs and open the PR**

Per project convention, spec/plan are working documents — remove before merge:

```bash
git rm docs/specs/2026-06-09-seek-playhead-latency-design.md docs/plans/2026-06-09-seek-playhead-latency.md
git commit -m "chore: remove working spec/plan docs"
git push -u origin fix/seek-playhead-latency
```

Open the PR with a description carrying the durable summary (problem, root cause, the "compensation only while playing" rule, the pause trade-off decision, behavior table from the spec). Do **not** merge without explicit approval.
