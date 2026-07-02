# WAM 2.0 on Tone Backend + React + Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Host WAM 2.0 plugins on the Tone.js backend (dawcore `<daw-editor>` + `TonePlayoutAdapter`), add WAM entries to the React effects hooks (`@waveform-playlist/browser/tone`), and ship a full-showcase WAM example page on the website.

**Architecture:** (1) playout gains an opt-in **native AudioContext** mode (`configureGlobalContext({ nativeAudioContext: true })`) — WAM worklets subclass native `AudioWorkletNode` and cannot join a standardized-audio-context graph. (2) `TonePlayoutAdapter` gains a `transport` getter implementing the five `EffectsTransportLike` hooks dawcore's `EffectsManager` requires — dawcore's entire WAM surface then works unchanged. (3) The React hooks `useDynamicEffects`/`useTrackDynamicEffects` gain async `addWamEffect` methods producing WAM-flavored `EffectInstance`s in the same ordered chain, linked via Tone's `connect()` helper.

**Tech Stack:** Tone.js 15.1.22 (NO version bump — the custom-context path is already correct; the `sampleRate` option fix is only in `next` 15.5.26 and not needed since we construct the native context ourselves), `@dawcore/wam` (reused as-is; optional peer of browser), vitest, Docusaurus/Rspack.

**Spec:** `docs/specs/2026-07-01-wam-tone-react-design.md` (committed on this branch). Read it before starting.

## Global Constraints

- Branch: `wam-tone-react` (already created; spec committed as `de089088`).
- Tone.js stays pinned at **15.1.22**. Do not bump.
- `@dawcore/wam` must NEVER be statically imported by `packages/browser` runtime code — dynamic `import()` only; `import type` is fine (erased). `packages/browser/src/__tests__/staticEngineImports.test.ts` and `coreBarrelEngineFree.test.ts` must stay green.
- No cross-package re-exports (project rule): browser does not re-export `fetchWamLibrary` etc.
- Firefox does NOT implement `AudioListener` position AudioParams (MDN BCD 2026-06). Native mode must feature-detect and fall back to SAC with a warning.
- Console output: string-concatenate, never pass objects to `console.log/warn` (project CRITICAL rule).
- Lint: `pnpm lint` from repo ROOT before every commit. Exit 1 with no `✖ N problems` summary = prettier failure → `pnpm format`. Require 0 ESLint **errors** (≈359 pre-existing `no-explicit-any` warnings are normal).
- Typecheck: `pnpm typecheck` fails on `main` in `packages/dawcore-midi` (pre-existing `ArrayBufferLike` drift). Verify touched packages individually: `pnpm --filter @waveform-playlist/playout typecheck`, etc.
- Downstream resolves upstream via `dist/`: run `pnpm --filter @waveform-playlist/playout build` BEFORE `pnpm --filter @waveform-playlist/browser typecheck` or browser vitest.
- After changing any `package.json`: `pnpm install` from root and commit `pnpm-lock.yaml` (CI uses `--frozen-lockfile`).
- After vitest runs: `pgrep -f vitest` and `pkill -f vitest` if strays remain.
- Commit format: `<type>: <description>` (feat/fix/docs/test/chore). No attribution footer (disabled globally).
- `examples/**/*.html` are outside lint scope — match existing file style by hand, never run prettier on them.

## File Structure (all tasks)

```
packages/playout/src/
  audioContext.ts                      # MODIFY: native mode + isNativeGlobalContext + feature detect
  ToneTrack.ts                         # MODIFY: connectEffects/disconnectEffects, store _destination
  TonePlayout.ts                       # MODIFY: master/track effects hooks + masterBusInputNode
  TonePlayoutAdapter.ts                # MODIFY: ToneEffectsTransport + `transport` getter
  index.ts                             # MODIFY: export new symbols
  __tests__/audioContextNative.test.ts # CREATE
  __tests__/ToneTrack.test.ts          # MODIFY: add connectEffects tests
  __tests__/TonePlayout.test.ts        # MODIFY: add hook tests
  __tests__/TonePlayoutAdapter.test.ts # MODIFY: add transport tests
packages/browser/
  package.json                         # MODIFY: optional peer + devDep @dawcore/wam
  src/effects/loadWam.ts               # CREATE: dynamic import + install hint
  src/effects/wamEffectFactory.ts      # CREATE: createWamEffectInstance
  src/effects/effectFactory.ts         # MODIFY: widen EffectInstance.effect type
  src/effects/effectDefinitions.ts     # MODIFY: category union += 'wam'
  src/hooks/useDynamicEffects.ts       # MODIFY: WAM entries
  src/hooks/useTrackDynamicEffects.ts  # MODIFY: WAM entries
  src/components/WamEffectGui.tsx      # CREATE
  src/tone.ts                          # MODIFY: exports
  src/__tests__/loadWam.test.ts        # CREATE
  src/__tests__/loadWamMissing.test.ts # CREATE (separate file — throwing vi.mock is file-scoped)
  src/__tests__/wamEffectFactory.test.ts   # CREATE
  src/__tests__/useDynamicEffectsWam.test.ts       # CREATE
  src/__tests__/useTrackDynamicEffectsWam.test.ts  # CREATE
examples/dawcore-tone/
  vite.config.ts                       # MODIFY: alias @dawcore/wam to source
  basic.html                           # MODIFY: ?native=1 spike flag
  wam.html                             # CREATE: Tone-backend WAM demo
  index.html                           # MODIFY: link wam.html
website/
  package.json                         # MODIFY: @dawcore/wam workspace dep
  src/pages/examples/wam-effects.tsx   # CREATE
  src/components/examples/WamEffectsExample.tsx  # CREATE
  docs/wam-plugins.md                  # CREATE (guide)
  docs/examples.md, docs/api/hooks.md, docs/api/llm-reference.md, static/llms.txt  # MODIFY
README.md                              # MODIFY: examples list
```

---

### Task 1: Native AudioContext mode in playout

**Files:**
- Modify: `packages/playout/src/audioContext.ts`
- Modify: `packages/playout/src/index.ts` (find the existing `export ... from './audioContext'` line and extend it)
- Test: `packages/playout/src/__tests__/audioContextNative.test.ts` (new file — do NOT touch the existing `audioContext.test.ts`)

**Interfaces:**
- Consumes: nothing new.
- Produces: `configureGlobalContext({ nativeAudioContext?: boolean, sampleRate?, latencyHint? })`, `isNativeGlobalContext(): boolean`, `supportsNativeContextMode(): boolean`, `_resetGlobalContextForTests(): void` (module export, NOT in index barrel). Later tasks call `isNativeGlobalContext()` for guards.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/playout/src/__tests__/audioContextNative.test.ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const contextInstances: unknown[] = [];
const MockContext = vi.fn(function (this: { rawContext: unknown }, raw?: unknown) {
  this.rawContext = raw ?? { sampleRate: 48000, state: 'suspended' };
  contextInstances.push(this);
});
const setContext = vi.fn();

vi.mock('tone', () => ({
  Context: MockContext,
  setContext: (...args: unknown[]) => setContext(...args),
}));

class FakeAudioListener {}
Object.defineProperty(FakeAudioListener.prototype, 'positionX', {
  get() {
    return {};
  },
  configurable: true,
});

class FakeAudioContext {
  sampleRate: number;
  state = 'suspended';
  constructor(opts?: { sampleRate?: number }) {
    this.sampleRate = opts?.sampleRate ?? 48000;
  }
}

describe('native AudioContext mode', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    contextInstances.length = 0;
    vi.stubGlobal('AudioContext', FakeAudioContext);
    vi.stubGlobal('AudioListener', FakeAudioListener);
    const mod = await import('../audioContext');
    mod._resetGlobalContextForTests();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('creates the Tone Context around a native AudioContext when nativeAudioContext is set', async () => {
    const { configureGlobalContext, isNativeGlobalContext, getGlobalAudioContext } = await import(
      '../audioContext'
    );
    configureGlobalContext({ nativeAudioContext: true });
    expect(isNativeGlobalContext()).toBe(true);
    expect(getGlobalAudioContext()).toBeInstanceOf(FakeAudioContext);
    // Context was constructed WITH the native context (not argless)
    expect(MockContext.mock.calls[0][0]).toBeInstanceOf(FakeAudioContext);
  });

  it('passes sampleRate to the native constructor', async () => {
    const { configureGlobalContext, getGlobalAudioContext } = await import('../audioContext');
    const rate = configureGlobalContext({ nativeAudioContext: true, sampleRate: 44100 });
    expect(rate).toBe(44100);
    expect((getGlobalAudioContext() as unknown as FakeAudioContext).sampleRate).toBe(44100);
  });

  it('falls back to the default (SAC) context and warns when AudioListener params are missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    class NoParamsListener {}
    vi.stubGlobal('AudioListener', NoParamsListener);
    const { configureGlobalContext, isNativeGlobalContext } = await import('../audioContext');
    configureGlobalContext({ nativeAudioContext: true });
    expect(isNativeGlobalContext()).toBe(false);
    expect(MockContext.mock.calls[0]).toEqual([]); // argless = SAC path
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('AudioListener'));
    warn.mockRestore();
  });

  it('warns and keeps the existing context when called after context creation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { configureGlobalContext, getGlobalContext, isNativeGlobalContext } = await import(
      '../audioContext'
    );
    getGlobalContext(); // create default context first
    configureGlobalContext({ nativeAudioContext: true });
    expect(isNativeGlobalContext()).toBe(false);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('already created'));
    warn.mockRestore();
  });

  it('isNativeGlobalContext is false by default', async () => {
    const { getGlobalContext, isNativeGlobalContext } = await import('../audioContext');
    getGlobalContext();
    expect(isNativeGlobalContext()).toBe(false);
  });
});
```

Note: `../audioContext` holds module-level singletons — every test re-imports the same module instance, so `_resetGlobalContextForTests()` in `beforeEach` is what isolates tests, not module re-evaluation.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd packages/playout && npx vitest run src/__tests__/audioContextNative.test.ts`
Expected: FAIL — `_resetGlobalContextForTests is not a function` (and the rest).

- [ ] **Step 3: Implement**

In `packages/playout/src/audioContext.ts`:

Add to `AudioContextOptions`:

```typescript
  /**
   * Create the global context around a NATIVE AudioContext instead of
   * standardized-audio-context. Required for WAM 2.0 plugin hosting — WAM
   * worklets subclass the native AudioWorkletNode and cannot join a
   * standardized-audio-context graph. Falls back to the default context
   * (with a console warning) on browsers missing AudioListener AudioParams
   * (Firefox), where Tone.js Listener initialization would throw.
   */
  nativeAudioContext?: boolean;
```

Add module state + helpers (below `let globalToneContext`):

```typescript
let _nativeMode = false;

/**
 * Whether this browser can run Tone.js on a raw native AudioContext.
 * Firefox lacks the AudioListener AudioParams (positionX/…/upZ) that Tone's
 * Listener wraps eagerly at context initialization (Tone.js #681) —
 * standardized-audio-context polyfills them, native contexts cannot.
 */
export function supportsNativeContextMode(): boolean {
  return (
    typeof AudioContext !== 'undefined' &&
    typeof AudioListener !== 'undefined' &&
    'positionX' in AudioListener.prototype
  );
}

/**
 * True when the global context wraps a native AudioContext (WAM-capable).
 */
export function isNativeGlobalContext(): boolean {
  return _nativeMode && globalToneContext !== null;
}

/** Test-only: clears the module singleton. Not exported from the package index. */
export function _resetGlobalContextForTests(): void {
  globalToneContext = null;
  _nativeMode = false;
}
```

Rewrite `configureGlobalContext` body — replace the context-creation section (keep the existing already-created warning branch, extending its message beyond sample rate):

```typescript
export function configureGlobalContext(options: AudioContextOptions): number {
  if (globalToneContext) {
    const existingRate = (globalToneContext.rawContext as AudioContext).sampleRate;
    if (options.nativeAudioContext && !_nativeMode) {
      console.warn(
        '[playout] configureGlobalContext: context already created — nativeAudioContext ' +
          'ignored. Call configureGlobalContext before any audio operations.'
      );
    }
    if (options.sampleRate !== undefined && options.sampleRate !== existingRate) {
      console.warn(
        '[playout] configureGlobalContext: context already created at ' +
          existingRate +
          ' Hz (requested ' +
          options.sampleRate +
          ' Hz). Call configureGlobalContext before any audio operations for sample rate control.'
      );
    }
    return existingRate;
  }

  if (options.nativeAudioContext) {
    if (supportsNativeContextMode()) {
      const ctorOptions: AudioContextOptions & { sampleRate?: number } = {};
      const nativeCtx = new AudioContext({
        ...(options.sampleRate !== undefined ? { sampleRate: options.sampleRate } : {}),
        ...(options.latencyHint !== undefined ? { latencyHint: options.latencyHint } : {}),
      });
      // Tone's Context constructor accepts an existing context; its typing is
      // standardized-audio-context's, so cast through the constructor params.
      globalToneContext = new Context(
        nativeCtx as unknown as ConstructorParameters<typeof Context>[0]
      );
      setContext(globalToneContext);
      _nativeMode = true;
      return nativeCtx.sampleRate;
    }
    console.warn(
      '[playout] nativeAudioContext requested but this browser does not implement the ' +
        'AudioListener AudioParams Tone.js needs on a native context (Firefox). Falling back ' +
        'to the standardized-audio-context default — WAM plugin hosting is unavailable.'
    );
  }

  // Default (standardized-audio-context) path — unchanged behavior.
  globalToneContext = new Context();
  setContext(globalToneContext);
  const actualRate = (globalToneContext.rawContext as AudioContext).sampleRate;
  if (options.sampleRate !== undefined && options.sampleRate !== actualRate) {
    console.warn(
      '[playout] Requested sampleRate ' +
        options.sampleRate +
        ' but AudioContext is running at ' +
        actualRate +
        ' — pre-computed peaks at ' +
        options.sampleRate +
        ' Hz will fall back to worker'
    );
  }
  return actualRate;
}
```

(Delete the unused `ctorOptions` line if TS flags it — `noUnusedLocals` is an error. Also remove the now-stale `// TODO: Tone.js 15.1.22 doesn't pass sampleRate...` comment block and update the file-top doc comment to mention both modes.)

In `packages/playout/src/index.ts`, add `isNativeGlobalContext` and `supportsNativeContextMode` to the existing `audioContext` export statement (do NOT export `_resetGlobalContextForTests`).

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd packages/playout && npx vitest run src/__tests__/audioContextNative.test.ts && npx vitest run src/__tests__/audioContext.test.ts`
Expected: both PASS (the pre-existing file must not regress).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm --filter @waveform-playlist/playout typecheck
pnpm lint   # from repo root; 0 errors required
git add packages/playout/src/audioContext.ts packages/playout/src/index.ts packages/playout/src/__tests__/audioContextNative.test.ts
git commit -m "feat(playout): opt-in native AudioContext mode for WAM hosting"
```

---

### Task 2: Real-browser spike — native mode on existing demos (GATE)

**Files:**
- Modify: `examples/dawcore-tone/basic.html` (add `?native=1` flag)

This task de-risks the mystery revert from PR #348. **Do not proceed to Task 3 until Chrome passes.**

**Interfaces:**
- Consumes: `configureGlobalContext({ nativeAudioContext: true })` from Task 1.
- Produces: confidence + a permanent spike flag in the basic demo.

- [ ] **Step 1: Add the flag to basic.html**

In `examples/dawcore-tone/basic.html`, the adapter-creation `<script type="module">` currently starts with `import { createToneAdapter } from '@waveform-playlist/playout';`. Change the import line and insert the flag immediately before `createToneAdapter` is called:

```javascript
import { createToneAdapter, configureGlobalContext } from '@waveform-playlist/playout';

// Spike flag: ?native=1 runs this demo on a native AudioContext (WAM mode).
if (new URLSearchParams(location.search).has('native')) {
  configureGlobalContext({ nativeAudioContext: true });
  console.log('[demo] native AudioContext mode enabled');
}
```

- [ ] **Step 2: Verify in Chrome (real browser, foreground tab)**

```bash
pnpm example:dawcore-tone   # note the ACTUAL port from the startup log (5174 default, falls back)
```

Open `http://localhost:<port>/basic.html?native=1` in Chrome (browser MCP acceptable, but keep the tab foregrounded — backgrounded tabs throttle rAF and fake "frozen playhead" bugs). Verify:
1. Console shows `[demo] native AudioContext mode enabled`, no errors on load.
2. Play → audio plays, playhead advances, time display updates.
3. Pause, seek by clicking the timeline, play again — position correct.
4. Stop → playhead returns to play-start.
5. Volume/pan/mute/solo sliders work on a track.

Expected: identical behavior to `basic.html` without the flag. If Tone throws internal errors here, STOP — investigate before any further tasks (this was the reverted-attempt failure mode; capture the exact error).

- [ ] **Step 3: Verify Firefox fallback path**

Open the same URL in Firefox. Expected: console warning `nativeAudioContext requested but this browser does not implement the AudioListener AudioParams…`, and the demo still plays normally (SAC fallback). If Firefox has since shipped the params (check `'positionX' in AudioListener.prototype` in the console), note it — native mode will simply work there and the fallback stays dormant.

- [ ] **Step 4: Verify recording demo still works in native mode (Chrome)**

Open `http://localhost:<port>/record.html?native=1` — wait, record.html does not read the flag; instead temporarily add the same 4-line flag block to `record.html`'s module script, verify record → stop produces a clip (foreground tab; the stop-handshake is slow in background tabs), then keep the flag block in record.html too (it's harmless and useful).

- [ ] **Step 5: Commit**

```bash
git add examples/dawcore-tone/basic.html examples/dawcore-tone/record.html
git commit -m "feat(examples): native-context spike flag on dawcore-tone demos"
```

---

### Task 3: ToneTrack.connectEffects / disconnectEffects

**Files:**
- Modify: `packages/playout/src/ToneTrack.ts`
- Test: `packages/playout/src/__tests__/ToneTrack.test.ts` (append a describe block; reuse the file's existing tone mocks)

**Interfaces:**
- Consumes: nothing new.
- Produces: `ToneTrack.connectEffects(node: AudioNode): void`, `ToneTrack.disconnectEffects(): void`. Throws `Error` when the track was built with a `TrackEffectsFunction` closure.

- [ ] **Step 1: Write the failing tests**

Append to `packages/playout/src/__tests__/ToneTrack.test.ts` (the file already mocks `tone` — `mockMuteGain` has `connect`/`dispose`; add `disconnect: vi.fn()` to the `mockMuteGain` object literal at the top of the file):

```typescript
describe('connectEffects / disconnectEffects', () => {
  it('reroutes muteGain from destination to the chain input', () => {
    const track = new ToneTrack({ clips: [], track: makeTrack() });
    const chainInput = { name: 'chain-in' } as unknown as AudioNode;
    mockMuteGain.connect.mockClear();
    track.connectEffects(chainInput);
    expect(mockMuteGain.disconnect).toHaveBeenCalledTimes(1);
    expect(mockMuteGain.connect).toHaveBeenCalledWith(chainInput);
  });

  it('disconnectEffects restores the destination connection', () => {
    const track = new ToneTrack({ clips: [], track: makeTrack() });
    const chainInput = { name: 'chain-in' } as unknown as AudioNode;
    track.connectEffects(chainInput);
    mockMuteGain.connect.mockClear();
    mockMuteGain.disconnect.mockClear();
    track.disconnectEffects();
    expect(mockMuteGain.disconnect).toHaveBeenCalledWith(chainInput);
    expect(mockMuteGain.connect).toHaveBeenCalledTimes(1); // back to destination
  });

  it('disconnectEffects is a no-op when nothing is connected', () => {
    const track = new ToneTrack({ clips: [], track: makeTrack() });
    mockMuteGain.disconnect.mockClear();
    track.disconnectEffects();
    expect(mockMuteGain.disconnect).not.toHaveBeenCalled();
  });

  it('throws when the track was built with an effects closure', () => {
    const track = new ToneTrack({ clips: [], track: makeTrack(), effects: () => undefined });
    expect(() => track.connectEffects({} as AudioNode)).toThrow(/TrackEffectsFunction/);
  });

  it('swaps chain nodes when connectEffects is called twice', () => {
    const track = new ToneTrack({ clips: [], track: makeTrack() });
    const a = { name: 'a' } as unknown as AudioNode;
    const b = { name: 'b' } as unknown as AudioNode;
    track.connectEffects(a);
    mockMuteGain.disconnect.mockClear();
    track.connectEffects(b);
    expect(mockMuteGain.disconnect).toHaveBeenCalledWith(a);
    expect(mockMuteGain.connect).toHaveBeenCalledWith(b);
  });
});
```

Use the file's existing track-fixture helper if one exists (search for how existing tests construct the `track:` option — there will be an object literal or helper; name it `makeTrack()` accordingly or inline the same shape: `{ id: 't1', name: 'T', gain: 1, muted: false, soloed: false, stereoPan: 0, startTime: 0, endTime: 1 }`).

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/playout && npx vitest run src/__tests__/ToneTrack.test.ts`
Expected: FAIL — `track.connectEffects is not a function`.

- [ ] **Step 3: Implement in ToneTrack.ts**

Add private fields (near `private effectsCleanup`):

```typescript
  private _destination: ToneAudioNode;
  private _hasClosureEffects: boolean;
  private _effectsChainNode: AudioNode | null = null;
```

In the constructor, replace the local `const destination = options.destination || getDestination();` block so the destination is stored:

```typescript
    this._destination = options.destination || getDestination();
    this._hasClosureEffects = Boolean(options.effects);
    if (options.effects) {
      const cleanup = options.effects(this.muteGain, this._destination, false);
      if (cleanup) {
        this.effectsCleanup = cleanup;
      }
    } else {
      this.muteGain.connect(this._destination);
    }
```

Add methods (after `setSolo`):

```typescript
  /**
   * Insert an external effects chain: reroute muteGain → node instead of
   * muteGain → destination. The caller wires the chain's output onward
   * (dawcore's EffectsManager connects it to the master bus input).
   * Mutually exclusive with the TrackEffectsFunction closure model.
   */
  connectEffects(node: AudioNode): void {
    if (this._hasClosureEffects) {
      throw new Error(
        '[waveform-playlist] Track "' +
          this.track.id +
          '" was built with a TrackEffectsFunction closure — transport effects hooks and ' +
          'closure effects are mutually exclusive.'
      );
    }
    if (this._effectsChainNode) {
      this.muteGain.disconnect(this._effectsChainNode);
    } else {
      this.muteGain.disconnect(this._destination);
    }
    this.muteGain.connect(node);
    this._effectsChainNode = node;
  }

  /** Restore the direct muteGain → destination connection. Safe when nothing is connected. */
  disconnectEffects(): void {
    if (!this._effectsChainNode) return;
    try {
      this.muteGain.disconnect(this._effectsChainNode);
    } catch (err) {
      console.warn(
        '[waveform-playlist] disconnectEffects: ' +
          (err instanceof Error ? err.message : String(err))
      );
    }
    this.muteGain.connect(this._destination);
    this._effectsChainNode = null;
  }
```

`Gain.connect`/`disconnect` accept native `AudioNode`s (Tone `InputNode` includes them) — no casts needed.

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/playout && npx vitest run src/__tests__/ToneTrack.test.ts`
Expected: PASS (all pre-existing tests too).

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm --filter @waveform-playlist/playout typecheck && pnpm lint
git add packages/playout/src/ToneTrack.ts packages/playout/src/__tests__/ToneTrack.test.ts
git commit -m "feat(playout): ToneTrack.connectEffects seam for external effect chains"
```

---

### Task 4: TonePlayout master/track effects hooks

**Files:**
- Modify: `packages/playout/src/TonePlayout.ts`
- Test: `packages/playout/src/__tests__/TonePlayout.test.ts` (append; reuse existing mocks — add `disconnect: vi.fn()` to the master-tap Gain mock if missing)

**Interfaces:**
- Consumes: `ToneTrack.connectEffects/disconnectEffects` (Task 3).
- Produces (on `TonePlayout`): `connectTrackOutput(trackId: string, node: AudioNode): void`, `disconnectTrackOutput(trackId: string): void`, `connectMasterOutput(node: AudioNode): void`, `disconnectMasterOutput(): void`, `get masterBusInputNode(): GainNode`.

- [ ] **Step 1: Write the failing tests**

Append to `TonePlayout.test.ts`. Follow the file's existing construction pattern for a playout + added track (search the file for `addTrack` usage and copy its fixture). The new assertions:

```typescript
describe('effects transport hooks', () => {
  it('connectTrackOutput delegates to the ToneTrack', () => {
    const playout = new TonePlayout();
    const track = playout.addTrack({ clips: [], track: makeTrack('t1') });
    const spy = vi.spyOn(track, 'connectEffects');
    const node = {} as AudioNode;
    playout.connectTrackOutput('t1', node);
    expect(spy).toHaveBeenCalledWith(node);
  });

  it('connectTrackOutput throws for unknown track ids', () => {
    const playout = new TonePlayout();
    expect(() => playout.connectTrackOutput('nope', {} as AudioNode)).toThrow(/unknown track/);
  });

  it('connectTrackOutput throws for MIDI tracks', () => {
    const playout = new TonePlayout();
    playout.addMidiTrack({ clips: [], track: makeTrack('m1') });
    expect(() => playout.connectTrackOutput('m1', {} as AudioNode)).toThrow(/MIDI/);
  });

  it('disconnectTrackOutput is a no-op for unknown ids', () => {
    const playout = new TonePlayout();
    expect(() => playout.disconnectTrackOutput('nope')).not.toThrow();
  });

  it('connectMasterOutput reroutes the master tap; disconnectMasterOutput restores it', () => {
    const playout = new TonePlayout();
    const node = { name: 'chain-in' } as unknown as AudioNode;
    playout.connectMasterOutput(node);
    expect(mockMasterTap.disconnect).toHaveBeenCalledTimes(1);
    expect(mockMasterTap.connect).toHaveBeenCalledWith(node);
    mockMasterTap.connect.mockClear();
    playout.disconnectMasterOutput();
    expect(mockMasterTap.disconnect).toHaveBeenCalledWith(node);
    expect(mockMasterTap.connect).toHaveBeenCalledTimes(1); // back to destination
  });

  it('masterBusInputNode returns the native gain behind masterVolume.input', () => {
    const playout = new TonePlayout();
    // mockVolume.input.input is the native GainNode stand-in in this file's mocks
    expect(playout.masterBusInputNode).toBe(mockVolume.input.input);
  });
});
```

Adapt mock variable names (`mockMasterTap`, `mockVolume`, `makeTrack`) to what the file actually defines — read its mock header first; the Gain mock used for `_masterTap` may be shared with muteGain (`Gain: vi.fn(() => mockMuteGain)`). If shared, either give the file a call-order-aware Gain factory or assert on the shared mock — prefer adding a dedicated factory: `Gain: vi.fn(() => ({ gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn(), dispose: vi.fn(), input: { nodeType: 1 } }))` and capture instances from `vi.mocked(Gain).mock.results`.

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/playout && npx vitest run src/__tests__/TonePlayout.test.ts`
Expected: FAIL — `connectTrackOutput is not a function`.

- [ ] **Step 3: Implement in TonePlayout.ts**

Add import of `ToneTrack` (already imported) and a field near `_masterTap`:

```typescript
  private _masterChainNode: AudioNode | null = null;
```

Add methods (after the existing `get masterOutputNode()` — keep that getter untouched, it is the *post*-volume analyzer tap):

```typescript
  /**
   * Native GainNode behind masterVolume.input — the master-bus junction that
   * per-track effect chains reconnect into (pre master volume). Distinct from
   * masterOutputNode (the post-volume tap for analyzers).
   */
  get masterBusInputNode(): GainNode {
    return (this.masterVolume.input as unknown as Gain).input;
  }

  /** Insert an external chain on a track: muteGain → node (caller wires node onward). */
  connectTrackOutput(trackId: string, node: AudioNode): void {
    const track = this.tracks.get(trackId);
    if (!track) {
      throw new Error('[waveform-playlist] connectTrackOutput: unknown track "' + trackId + '"');
    }
    if (!(track instanceof ToneTrack)) {
      throw new Error(
        '[waveform-playlist] connectTrackOutput: per-track effects chains are not supported ' +
          'for MIDI tracks on the Tone adapter (track "' +
          trackId +
          '")'
      );
    }
    track.connectEffects(node);
  }

  /** Restore a track's direct connection. No-op for unknown or MIDI tracks. */
  disconnectTrackOutput(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track instanceof ToneTrack) {
      track.disconnectEffects();
    }
  }

  /**
   * Insert an external master chain after the tap: masterVolume → [closure
   * effects] → tap → node (caller wires node.output → ctx.destination).
   */
  connectMasterOutput(node: AudioNode): void {
    if (this._masterChainNode) {
      this._masterTap.disconnect(this._masterChainNode);
    } else {
      this._masterTap.disconnect(getDestination());
    }
    this._masterTap.connect(node);
    this._masterChainNode = node;
  }

  /** Restore tap → destination. Safe when no master chain is connected. */
  disconnectMasterOutput(): void {
    if (!this._masterChainNode) return;
    try {
      this._masterTap.disconnect(this._masterChainNode);
    } catch (err) {
      console.warn(
        '[waveform-playlist] disconnectMasterOutput: ' +
          (err instanceof Error ? err.message : String(err))
      );
    }
    this._masterTap.connect(getDestination());
    this._masterChainNode = null;
  }
```

`Gain.disconnect(target)` is edge-targeted — parallel analyzer connections on the tap survive.

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/playout && npx vitest run src/__tests__/TonePlayout.test.ts`
Expected: PASS.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm --filter @waveform-playlist/playout typecheck && pnpm lint
git add packages/playout/src/TonePlayout.ts packages/playout/src/__tests__/TonePlayout.test.ts
git commit -m "feat(playout): master/track effects hooks on TonePlayout"
```

---

### Task 5: `transport` surface on TonePlayoutAdapter

**Files:**
- Modify: `packages/playout/src/TonePlayoutAdapter.ts`
- Modify: `packages/playout/src/index.ts` (export `ToneEffectsTransport` type)
- Test: `packages/playout/src/__tests__/TonePlayoutAdapter.test.ts` (append)

**Interfaces:**
- Consumes: Task 4 playout methods, Task 1 `isNativeGlobalContext`.
- Produces: `ToneAdapter.transport: ToneEffectsTransport` where

```typescript
export interface ToneEffectsTransport {
  connectTrackOutput(trackId: string, node: AudioNode): void;
  disconnectTrackOutput(trackId: string): void;
  connectMasterOutput(node: AudioNode): void;
  disconnectMasterOutput(): void;
  readonly masterOutputNode: AudioNode;
}
```

This shape must stay structurally identical to dawcore's `EffectsTransportLike` (`packages/dawcore/src/effects/effects-manager.ts:9-15`) — the test pins it.

- [ ] **Step 1: Write the failing tests**

Append to `TonePlayoutAdapter.test.ts` (reuse its existing mocks of `TonePlayout` — extend the playout mock with `connectTrackOutput: vi.fn()`, `disconnectTrackOutput: vi.fn()`, `connectMasterOutput: vi.fn()`, `disconnectMasterOutput: vi.fn()`, `masterBusInputNode: { nodeType: 1 }`). Also mock `isNativeGlobalContext` — the file already mocks `./audioContext` or `tone`; if it mocks `./audioContext`, add `isNativeGlobalContext: vi.fn(() => true)` to that factory and capture it for per-test control:

```typescript
describe('adapter.transport (effects hooks)', () => {
  it('is structurally compatible with dawcore EffectsTransportLike', () => {
    // Copied verbatim from packages/dawcore/src/effects/effects-manager.ts —
    // guards against the wrong-method-name trap (root CLAUDE.md pattern #11).
    interface EffectsTransportLike {
      connectTrackOutput(trackId: string, node: AudioNode): void;
      disconnectTrackOutput(trackId: string): void;
      connectMasterOutput(node: AudioNode): void;
      disconnectMasterOutput(): void;
      readonly masterOutputNode: AudioNode;
    }
    const adapter = createToneAdapter();
    const t: EffectsTransportLike = adapter.transport; // compile-time check
    expect(typeof t.connectTrackOutput).toBe('function');
  });

  it('delegates hooks to the playout when native mode is on', () => {
    vi.mocked(isNativeGlobalContext).mockReturnValue(true);
    const adapter = createToneAdapter();
    const node = {} as AudioNode;
    adapter.transport.connectTrackOutput('t1', node);
    expect(mockPlayout.connectTrackOutput).toHaveBeenCalledWith('t1', node);
    adapter.transport.connectMasterOutput(node);
    expect(mockPlayout.connectMasterOutput).toHaveBeenCalledWith(node);
    expect(adapter.transport.masterOutputNode).toBe(mockPlayout.masterBusInputNode);
    adapter.transport.disconnectTrackOutput('t1');
    adapter.transport.disconnectMasterOutput();
    expect(mockPlayout.disconnectTrackOutput).toHaveBeenCalledWith('t1');
    expect(mockPlayout.disconnectMasterOutput).toHaveBeenCalled();
  });

  it('throws a configure-native-context error when the global context is standardized', () => {
    vi.mocked(isNativeGlobalContext).mockReturnValue(false);
    const adapter = createToneAdapter();
    expect(() => adapter.transport.connectMasterOutput({} as AudioNode)).toThrow(
      /configureGlobalContext\(\{ nativeAudioContext: true \}\)/
    );
  });

  it('throws after dispose', () => {
    vi.mocked(isNativeGlobalContext).mockReturnValue(true);
    const adapter = createToneAdapter();
    adapter.dispose();
    expect(() => adapter.transport.connectMasterOutput({} as AudioNode)).toThrow(/dispose/);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/playout && npx vitest run src/__tests__/TonePlayoutAdapter.test.ts`
Expected: FAIL — `transport` undefined.

- [ ] **Step 3: Implement**

In `TonePlayoutAdapter.ts`: import `isNativeGlobalContext` from `./audioContext`. Add the interface + extend `ToneAdapter`:

```typescript
/**
 * Effects wiring hooks consumed by dawcore's EffectsManager (structural match
 * for its EffectsTransportLike). All hooks require native-context mode —
 * effect chains carry native AudioNodes (incl. WAM worklets) that cannot join
 * a standardized-audio-context graph.
 */
export interface ToneEffectsTransport {
  connectTrackOutput(trackId: string, node: AudioNode): void;
  disconnectTrackOutput(trackId: string): void;
  connectMasterOutput(node: AudioNode): void;
  disconnectMasterOutput(): void;
  readonly masterOutputNode: AudioNode;
}

export interface ToneAdapter extends PlayoutAdapter {
  setSoundFontCache(cache: SoundFontCache | undefined): void;
  /** Effects wiring hooks (dawcore EffectsManager). Requires native-context mode. */
  readonly transport: ToneEffectsTransport;
}
```

Inside `createToneAdapter` (before the returned adapter object):

```typescript
  function requireEffectsPlayout(): TonePlayout {
    if (!isNativeGlobalContext()) {
      throw new Error(
        '[waveform-playlist] Effects chains on the Tone adapter require a native ' +
          'AudioContext. Call configureGlobalContext({ nativeAudioContext: true }) from ' +
          '@waveform-playlist/playout before any audio initialization.'
      );
    }
    if (!playout) {
      throw new Error('[waveform-playlist] adapter.transport accessed after dispose.');
    }
    return playout;
  }

  const effectsTransport: ToneEffectsTransport = {
    connectTrackOutput: (trackId, node) => requireEffectsPlayout().connectTrackOutput(trackId, node),
    disconnectTrackOutput: (trackId) => requireEffectsPlayout().disconnectTrackOutput(trackId),
    connectMasterOutput: (node) => requireEffectsPlayout().connectMasterOutput(node),
    disconnectMasterOutput: () => requireEffectsPlayout().disconnectMasterOutput(),
    get masterOutputNode(): AudioNode {
      return requireEffectsPlayout().masterBusInputNode;
    },
  };
```

On the returned adapter object add:

```typescript
    get transport(): ToneEffectsTransport {
      return effectsTransport;
    },
```

In `index.ts`, export the type: add `ToneEffectsTransport` to the existing type exports from `./TonePlayoutAdapter`.

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/playout && npx vitest run`
Expected: whole playout suite PASSES.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm --filter @waveform-playlist/playout typecheck && pnpm lint
git add packages/playout/src/TonePlayoutAdapter.ts packages/playout/src/index.ts packages/playout/src/__tests__/TonePlayoutAdapter.test.ts
git commit -m "feat(playout): EffectsTransportLike transport surface on Tone adapter"
```

---

### Task 6: dawcore-tone WAM demo (`wam.html`) + real-browser verification (GATE)

**Files:**
- Modify: `examples/dawcore-tone/vite.config.ts` (add `@dawcore/wam` + `@dawcore/faust` source aliases — copy the two alias entries verbatim from `examples/dawcore-wam/vite.config.ts`)
- Create: `examples/dawcore-tone/wam.html`
- Modify: `examples/dawcore-tone/index.html` (add a link to wam.html in the demo list)

**Interfaces:**
- Consumes: Tasks 1–5. dawcore's existing `editor.addWamPlugin(url)`, `editor.addTrackWamPlugin(trackId, url)`, `editor.openEffectGui(id, host)`, `editor.exportAudio()`, `editor.tracks`.
- Produces: the proof that dawcore's EffectsManager works on the Tone backend end-to-end.

- [ ] **Step 1: Create wam.html**

Model directly on `examples/dawcore-wam/index.html` (read it first — it is one inline `<script type="module">`), with these differences:

1. Adapter block becomes:

```javascript
import { createToneAdapter, configureGlobalContext } from '@waveform-playlist/playout';

configureGlobalContext({ nativeAudioContext: true, sampleRate: 48000 });
const adapter = createToneAdapter();
const editor = document.getElementById('editor');
editor.adapter = adapter;
editor.ready();
```

2. Keep: two `<daw-track>`s (reuse the Kick/Synth opus sources from `basic.html`), transport buttons, master + per-track effect sections with "Add WAM by URL" input, the community-library browser (`fetchWamLibrary`/`fetchWamDescriptor` from `@dawcore/wam`), GUI mount hosts, Export WAV button (`editor.exportAudio()`), and one pre-compiled Faust button (`/faust-wams/lowpass/index.js`) to prove Faust-on-Tone inheritance.
3. Drop: localStorage persistence and the Faust textarea/compiler section (keep the demo lean; the dawcore-wam example already covers those).
4. Style: copy the `<style>` block conventions from `basic.html` (same `--daw-*` palette). Match existing HTML style by hand — these files are outside prettier scope.
5. Add a status `<div id="log">` and log `daw-effect-add` / `daw-effect-error` events (string-concatenated messages only).

- [ ] **Step 2: Verify in Chrome (foreground tab)**

```bash
pnpm example:dawcore-tone   # read actual port from startup log
```

Open `http://localhost:<port>/wam.html` and verify, in order:
1. Tracks load and play (Tone backend alive in native mode).
2. Add `https://www.webaudiomodules.com/community/plugins/wimmics/BigMuff/index.js` to a TRACK chain → play → audibly distorted; other track clean.
3. Open its GUI → knobs render and affect the sound.
4. Add a second WAM to the MASTER chain → affects everything; remove it → clean.
5. Bypass toggles silence the effect without removing it.
6. Faust lowpass button → adds and audibly filters.
7. Export WAV → downloads; spot-check the file plays with the track effect rendered (dawcore's exportAudio re-instantiates WAM offline).
8. Move a clip while playing → no stuck audio; play/stop cycles stay clean (rewireTrackChains on tracksVersion works with the Tone adapter).

If step 2 fails at `ensureWamHost`, check `editor.audioContext instanceof AudioContext` in the console — `false` means native mode didn't engage (configure call ordering).

- [ ] **Step 3: Verify the SAC error path**

Temporarily comment out the `configureGlobalContext` line, reload, add a WAM → expect the thrown error message to name `configureGlobalContext({ nativeAudioContext: true })` (surfaced via `daw-effect-error` in the log). Restore the line.

- [ ] **Step 4: Update index.html demo list and commit**

```bash
git add examples/dawcore-tone/wam.html examples/dawcore-tone/index.html examples/dawcore-tone/vite.config.ts
git commit -m "feat(examples): WAM plugins demo on the dawcore Tone backend"
```

---

### Task 7: browser package — `@dawcore/wam` optional peer + `loadWam` module

**Files:**
- Modify: `packages/browser/package.json`
- Create: `packages/browser/src/effects/loadWam.ts`
- Test: `packages/browser/src/__tests__/loadWam.test.ts`, `packages/browser/src/__tests__/loadWamMissing.test.ts`

**Interfaces:**
- Produces: `loadWamModule(): Promise<typeof import('@dawcore/wam')>` with install-hint rethrow.

- [ ] **Step 1: package.json + lockfile**

In `packages/browser/package.json` add:
- to `peerDependencies`: `"@dawcore/wam": "workspace:^"`
- to `peerDependenciesMeta`: `"@dawcore/wam": { "optional": true }`
- to `devDependencies`: `"@dawcore/wam": "workspace:*"` (types for `typeof import(...)` + tests)

Run `pnpm install` from root. Expect lockfile churn only around browser/dawcore-wam (the dependencies→peerDependencies gotcha in CLAUDE.md is about *moving* deps; adding is tame — but verify `git diff pnpm-lock.yaml` is scoped before committing).

- [ ] **Step 2: Write the failing tests**

```typescript
// packages/browser/src/__tests__/loadWam.test.ts
import { describe, it, expect, vi } from 'vitest';

vi.mock('@dawcore/wam', () => ({
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
  createWamInstanceFromFactory: vi.fn(),
  loadWamFactory: vi.fn(),
  cloneInstanceInto: vi.fn(),
  createParameterPanel: vi.fn(),
  createWamParameterPanel: vi.fn(),
  fetchWamLibrary: vi.fn(),
  fetchWamDescriptor: vi.fn(),
  createWamTransportBridge: vi.fn(),
}));

describe('loadWamModule', () => {
  it('resolves the module when @dawcore/wam is installed', async () => {
    const { loadWamModule } = await import('../effects/loadWam');
    const mod = await loadWamModule();
    expect(typeof mod.ensureWamHost).toBe('function');
  });
});
```

```typescript
// packages/browser/src/__tests__/loadWamMissing.test.ts
// Separate FILE: a throwing vi.mock factory is file-scoped (midi-loader precedent).
import { describe, it, expect, vi } from 'vitest';

vi.mock('@dawcore/wam', () => {
  throw new Error("Cannot find module '@dawcore/wam'");
});

describe('loadWamModule without the optional peer', () => {
  it('rethrows with an install hint', async () => {
    const { loadWamModule } = await import('../effects/loadWam');
    await expect(loadWamModule()).rejects.toThrow(/npm install @dawcore\/wam/);
  });
});
```

- [ ] **Step 3: Run to verify failure**

Run: `cd packages/browser && npx vitest run src/__tests__/loadWam.test.ts src/__tests__/loadWamMissing.test.ts`
Expected: FAIL — module `../effects/loadWam` not found.

- [ ] **Step 4: Implement loadWam.ts**

```typescript
/**
 * Dynamic loader for the optional '@dawcore/wam' peer (the @dawcore/midi
 * loadMidiImpl pattern). Keeps WAM hosting out of the bundle for consumers
 * that never use it; `import type` from '@dawcore/wam' elsewhere is fine
 * (erased at runtime).
 */
export type WamModule = typeof import('@dawcore/wam');

export async function loadWamModule(): Promise<WamModule> {
  try {
    return await import('@dawcore/wam');
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    throw new Error(
      "[waveform-playlist] WAM plugin support requires the optional '@dawcore/wam' package.\n" +
        'Install it with: npm install @dawcore/wam\n' +
        'Original error: ' +
        detail
    );
  }
}
```

- [ ] **Step 5: Run to verify pass, then commit**

```bash
cd packages/browser && npx vitest run src/__tests__/loadWam.test.ts src/__tests__/loadWamMissing.test.ts
cd ../.. && pnpm lint
git add packages/browser/package.json pnpm-lock.yaml packages/browser/src/effects/loadWam.ts packages/browser/src/__tests__/loadWam.test.ts packages/browser/src/__tests__/loadWamMissing.test.ts
git commit -m "feat(browser): optional @dawcore/wam peer with dynamic loader"
```

---

### Task 8: `wamEffectFactory` — WAM-flavored EffectInstance

**Files:**
- Create: `packages/browser/src/effects/wamEffectFactory.ts`
- Modify: `packages/browser/src/effects/effectFactory.ts` (widen `EffectInstance.effect` to `ToneAudioNode | AudioNode`)
- Modify: `packages/browser/src/effects/effectDefinitions.ts` (category union += `'wam'`)
- Test: `packages/browser/src/__tests__/wamEffectFactory.test.ts`

**Interfaces:**
- Consumes: `WamPluginInstance` type (type-only import from `@dawcore/wam`).
- Produces:

```typescript
export interface WamEffectInstance extends EffectInstance {
  kind: 'wam';
  plugin: WamPluginInstance;
  url?: string;
}
export function createWamEffectInstance(plugin: WamPluginInstance): WamEffectInstance;
```

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/browser/src/__tests__/wamEffectFactory.test.ts
import { describe, it, expect, vi } from 'vitest';

const connect = vi.fn();
const disconnect = vi.fn();
vi.mock('tone', () => ({ connect, disconnect }));

import { createWamEffectInstance } from '../effects/wamEffectFactory';
import type { WamPluginInstance } from '@dawcore/wam';

function makePlugin(): WamPluginInstance {
  return {
    url: 'https://example.com/plugin/index.js',
    descriptor: { name: 'BigMuff' } as WamPluginInstance['descriptor'],
    audioNode: {
      setParameterValues: vi.fn().mockResolvedValue(undefined),
    } as unknown as WamPluginInstance['audioNode'],
    getState: vi.fn(),
    setState: vi.fn(),
    getParameterInfo: vi.fn(),
    destroy: vi.fn(),
  } as unknown as WamPluginInstance;
}

describe('createWamEffectInstance', () => {
  it('wraps the plugin audioNode as the chain effect node', () => {
    const plugin = makePlugin();
    const inst = createWamEffectInstance(plugin);
    expect(inst.kind).toBe('wam');
    expect(inst.effect).toBe(plugin.audioNode);
    expect(inst.url).toBe(plugin.url);
    expect(inst.instanceId).toMatch(/^wam_/);
  });

  it('dispose destroys the plugin', () => {
    const plugin = makePlugin();
    createWamEffectInstance(plugin).dispose();
    expect(plugin.destroy).toHaveBeenCalled();
  });

  it('connect/disconnect route through the tone helpers (native↔Tone bridging)', () => {
    const plugin = makePlugin();
    const inst = createWamEffectInstance(plugin);
    const dest = {} as never;
    inst.connect(dest);
    expect(connect).toHaveBeenCalledWith(plugin.audioNode, dest);
    inst.disconnect();
    expect(disconnect).toHaveBeenCalledWith(plugin.audioNode);
  });

  it('setParameter forwards numeric values to setParameterValues', () => {
    const plugin = makePlugin();
    const inst = createWamEffectInstance(plugin);
    inst.setParameter('drive', 0.7);
    expect(
      (plugin.audioNode as unknown as { setParameterValues: ReturnType<typeof vi.fn> })
        .setParameterValues
    ).toHaveBeenCalledWith({ drive: { id: 'drive', value: 0.7, normalized: false } });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/browser && npx vitest run src/__tests__/wamEffectFactory.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

In `effectFactory.ts` change one line of `EffectInstance`:

```typescript
  effect: ToneAudioNode | AudioNode; // Tone.js effect, or a native node (WAM plugins)
```

In `effectDefinitions.ts` extend the category union:

```typescript
  category: 'delay' | 'reverb' | 'modulation' | 'distortion' | 'filter' | 'dynamics' | 'spatial' | 'wam';
```

Create `wamEffectFactory.ts`:

```typescript
/**
 * WAM-flavored EffectInstance. The plugin's audioNode (a native
 * AudioWorkletNode) joins the same ordered chain as Tone effects; linking
 * goes through Tone's connect()/disconnect() helpers, which bridge
 * native↔Tone in both directions. Requires native-context mode (the caller
 * guards; see useDynamicEffects.addWamEffect).
 */
import { connect, disconnect } from 'tone';
import type { InputNode } from 'tone';
import type { WamPluginInstance } from '@dawcore/wam'; // type-only — erased at runtime
import type { EffectInstance } from './effectFactory';

export interface WamEffectInstance extends EffectInstance {
  kind: 'wam';
  plugin: WamPluginInstance;
  url?: string;
}

interface WamParamTarget {
  setParameterValues?: (
    values: Record<string, { id: string; value: number; normalized: boolean }>
  ) => Promise<void>;
}

let wamInstanceCounter = 0;

export function createWamEffectInstance(plugin: WamPluginInstance): WamEffectInstance {
  const node = plugin.audioNode as unknown as AudioNode;
  const instanceId = 'wam_' + ++wamInstanceCounter;
  return {
    kind: 'wam',
    plugin,
    url: plugin.url,
    effect: node,
    id: 'wam:' + (plugin.descriptor?.name ?? plugin.url ?? 'plugin'),
    instanceId,
    dispose: () => plugin.destroy(),
    setParameter: (name, value) => {
      if (typeof value !== 'number') return;
      const target = plugin.audioNode as unknown as WamParamTarget;
      void target.setParameterValues?.({ [name]: { id: name, value, normalized: false } });
    },
    getParameter: () => undefined, // WAM params are async; read via the plugin GUI
    connect: (destination: InputNode) => connect(node, destination),
    disconnect: () => disconnect(node),
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/browser && npx vitest run src/__tests__/wamEffectFactory.test.ts`
Expected: PASS. Also run the full browser suite once — the `EffectInstance.effect` widening must not break existing tests: `npx vitest run`.

- [ ] **Step 5: Typecheck (build playout first!), lint, commit**

```bash
pnpm --filter @waveform-playlist/playout build
pnpm --filter @waveform-playlist/browser typecheck && pnpm lint
git add packages/browser/src/effects/wamEffectFactory.ts packages/browser/src/effects/effectFactory.ts packages/browser/src/effects/effectDefinitions.ts packages/browser/src/__tests__/wamEffectFactory.test.ts
git commit -m "feat(browser): WAM-flavored EffectInstance factory"
```

---

### Task 9: WAM entries in `useDynamicEffects` (master chain)

**Files:**
- Modify: `packages/browser/src/hooks/useDynamicEffects.ts`
- Test: `packages/browser/src/__tests__/useDynamicEffectsWam.test.ts` (new file; jsdom + @testing-library renderHook per existing hook-test conventions in the package — check `vitest.config.ts` environment; if the package default is node, add `// @vitest-environment jsdom` docblock)

**Interfaces:**
- Consumes: `loadWamModule` (Task 7), `createWamEffectInstance`/`WamEffectInstance` (Task 8), `isNativeGlobalContext`/`getGlobalAudioContext` from `@waveform-playlist/playout`, `connect`/`disconnect` from `tone`.
- Produces (additions to `UseDynamicEffectsReturn`):

```typescript
  addWamEffect: (url: string, initialState?: unknown) => Promise<string>; // resolves instanceId
  getWamPlugin: (instanceId: string) => WamPluginInstance | undefined;
```

and `ActiveEffect` gains `kind: 'native' | 'wam'; url?: string;`.

- [ ] **Step 1: Write the failing tests**

```typescript
// packages/browser/src/__tests__/useDynamicEffectsWam.test.ts
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const ensureWamHost = vi.fn().mockResolvedValue({ hostGroupId: 'group-1' });
const fakeAudioNode = { ctx: 'native' };
const destroy = vi.fn();
const createWamInstance = vi.fn().mockResolvedValue({
  url: 'https://example.com/p/index.js',
  descriptor: { name: 'BigMuff' },
  audioNode: fakeAudioNode,
  getState: vi.fn(),
  setState: vi.fn(),
  getParameterInfo: vi.fn(),
  destroy,
});

vi.mock('@dawcore/wam', () => ({
  ensureWamHost: (...a: unknown[]) => ensureWamHost(...a),
  createWamInstance: (...a: unknown[]) => createWamInstance(...a),
  // strict-mock sweep guard: include every export the hook may touch
  createWamInstanceFromFactory: vi.fn(),
  loadWamFactory: vi.fn(),
  cloneInstanceInto: vi.fn(),
  createParameterPanel: vi.fn(),
  createWamParameterPanel: vi.fn(),
  fetchWamLibrary: vi.fn(),
  fetchWamDescriptor: vi.fn(),
  createWamTransportBridge: vi.fn(),
}));

const isNativeGlobalContext = vi.fn(() => true);
vi.mock('@waveform-playlist/playout', () => ({
  isNativeGlobalContext: () => isNativeGlobalContext(),
  getGlobalAudioContext: () => ({ sampleRate: 48000 }),
}));

vi.mock('tone', () => ({
  connect: vi.fn(),
  disconnect: vi.fn(),
  Analyser: vi.fn(() => ({ connect: vi.fn(), dispose: vi.fn() })),
}));

import { useDynamicEffects } from '../hooks/useDynamicEffects';

describe('useDynamicEffects — WAM entries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isNativeGlobalContext.mockReturnValue(true);
  });

  it('addWamEffect hosts the plugin and appends a wam entry', async () => {
    const { result } = renderHook(() => useDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffect('https://example.com/p/index.js');
    });
    expect(ensureWamHost).toHaveBeenCalled();
    expect(createWamInstance).toHaveBeenCalledWith(
      'https://example.com/p/index.js',
      expect.anything(),
      'group-1',
      undefined
    );
    const entry = result.current.activeEffects.find((e) => e.instanceId === id);
    expect(entry?.kind).toBe('wam');
    expect(entry?.definition.name).toBe('BigMuff');
    expect(result.current.getWamPlugin(id)?.audioNode).toBe(fakeAudioNode);
  });

  it('rejects with the configure-native-context error on a standardized context', async () => {
    isNativeGlobalContext.mockReturnValue(false);
    const { result } = renderHook(() => useDynamicEffects());
    await expect(result.current.addWamEffect('https://x/y.js')).rejects.toThrow(
      /nativeAudioContext: true/
    );
  });

  it('native addEffect entries carry kind "native"', () => {
    const { result } = renderHook(() => useDynamicEffects());
    act(() => result.current.addEffect('reverb'));
    expect(result.current.activeEffects[0].kind).toBe('native');
  });

  it('removeEffect on a wam entry destroys the plugin', async () => {
    const { result } = renderHook(() => useDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffect('https://example.com/p/index.js');
    });
    act(() => result.current.removeEffect(id));
    expect(destroy).toHaveBeenCalled();
    expect(result.current.activeEffects).toHaveLength(0);
  });

  it('createOfflineEffectsFunction skips wam entries with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useDynamicEffects());
    await act(async () => {
      await result.current.addWamEffect('https://example.com/p/index.js');
    });
    expect(result.current.createOfflineEffectsFunction()).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('WAV export'));
    warn.mockRestore();
  });
});
```

Note: mocking `'tone'` here means `createEffectInstance`'s constructors are undefined — the `addEffect('reverb')` test only checks state, but `createEffectInstance` runs `new Constructor(...)`. Extend the tone mock with the one constructor used: `Reverb: vi.fn(() => ({ dispose: vi.fn(), connect: vi.fn(), disconnect: vi.fn(), set: vi.fn(), wet: { value: 0.5 } }))` — check `effectFactory.ts` for what `createEffectInstance` touches (`options` spread into constructor, `.set`, wet signal access) and stub accordingly, OR drop the kind-'native' assertion into an existing useDynamicEffects test file if one already has working tone mocks (search `src/__tests__/` first — reuse beats re-stubbing).

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/browser && npx vitest run src/__tests__/useDynamicEffectsWam.test.ts`
Expected: FAIL — `addWamEffect is not a function`.

- [ ] **Step 3: Implement in useDynamicEffects.ts**

1. Imports:

```typescript
import { Analyser, Volume, ToneAudioNode, connect, disconnect } from 'tone';
import { isNativeGlobalContext, getGlobalAudioContext } from '@waveform-playlist/playout';
import { loadWamModule } from '../effects/loadWam';
import { createWamEffectInstance, type WamEffectInstance } from '../effects/wamEffectFactory';
import type { WamPluginInstance } from '@dawcore/wam';
```

2. `ActiveEffect` gains:

```typescript
  /** 'native' = built-in Tone effect; 'wam' = hosted WAM plugin. */
  kind: 'native' | 'wam';
  /** Module URL for wam entries. */
  url?: string;
```

Set `kind: 'native'` in the existing `addEffect`'s `newActiveEffect` literal.

3. Chain-linking swap — in `rebuildChain` and in the `masterEffects` callback, replace every `currentNode.connect(inst.effect)` / `currentNode.connect(analyserNode)` pair with the helper, and filter bypassed WAM entries (disconnection bypass — WAM has no wet param):

```typescript
    const audible = effects.filter((ae) => !(ae.kind === 'wam' && ae.bypassed));
    const instances = audible
      .map((ae) => effectInstancesRef.current.get(ae.instanceId))
      .filter((inst): inst is EffectInstance => inst !== undefined);

    if (instances.length === 0) {
      masterGainNode.connect(analyserNode);
      analyserNode.connect(destination);
    } else {
      let currentNode: ToneAudioNode | AudioNode = masterGainNode;
      instances.forEach((inst) => {
        try {
          inst.disconnect();
        } catch (e) {
          console.warn('[waveform-playlist] Error disconnecting effect "' + inst.id + '"');
        }
        connect(currentNode, inst.effect);
        currentNode = inst.effect;
      });
      connect(currentNode, analyserNode);
      analyserNode.connect(destination);
    }
```

(Apply the same `audible` filter + `connect()` swap in `masterEffects`; it has no `inst.disconnect()` loop.)

4. New callbacks (place after `addEffect`):

```typescript
  // Host a WAM plugin and append it to the chain. Requires native-context mode.
  const addWamEffect = useCallback(
    async (url: string, initialState?: unknown): Promise<string> => {
      if (!isNativeGlobalContext()) {
        throw new Error(
          '[waveform-playlist] WAM plugins require a native AudioContext. Call ' +
            'configureGlobalContext({ nativeAudioContext: true }) from ' +
            '@waveform-playlist/playout before any audio initialization.'
        );
      }
      const wam = await loadWamModule();
      const ctx = getGlobalAudioContext();
      const { hostGroupId } = await wam.ensureWamHost(ctx);
      const plugin = await wam.createWamInstance(
        url,
        ctx,
        hostGroupId,
        initialState !== undefined ? { initialState } : undefined
      );
      const instance = createWamEffectInstance(plugin);
      effectInstancesRef.current.set(instance.instanceId, instance);

      const definition: EffectDefinition = {
        id: instance.id,
        name: plugin.descriptor?.name ?? url,
        category: 'wam',
        description: 'WAM plugin',
        parameters: [],
      };
      setActiveEffects((prev) => [
        ...prev,
        {
          instanceId: instance.instanceId,
          effectId: instance.id,
          kind: 'wam',
          url,
          definition,
          params: {},
          bypassed: false,
        },
      ]);
      return instance.instanceId;
    },
    []
  );

  // Live plugin handle for GUI mounting (WamEffectGui).
  const getWamPlugin = useCallback((instanceId: string): WamPluginInstance | undefined => {
    const inst = effectInstancesRef.current.get(instanceId) as WamEffectInstance | undefined;
    return inst?.kind === 'wam' ? inst.plugin : undefined;
  }, []);
```

5. `toggleBypass` — WAM branch before the wet logic:

```typescript
    if (effect.kind === 'wam') {
      // Disconnection bypass: the rebuild effect drops bypassed wam entries.
      setActiveEffects((prev) =>
        prev.map((e) => (e.instanceId === instanceId ? { ...e, bypassed: newBypassed } : e))
      );
      return;
    }
```

6. `createOfflineEffectsFunction` — top of the callback:

```typescript
    const wamCount = activeEffects.filter((e) => e.kind === 'wam' && !e.bypassed).length;
    if (wamCount > 0) {
      console.warn(
        '[waveform-playlist] ' +
          wamCount +
          ' WAM effect(s) are skipped in WAV export — WAM offline rendering is not supported yet.'
      );
    }
    const nonBypassedEffects = activeEffects.filter((e) => !e.bypassed && e.kind !== 'wam');
```

7. Add `addWamEffect` and `getWamPlugin` to `UseDynamicEffectsReturn` (with doc comments noting the native-context requirement and the export limitation) and to the returned object.

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/browser && npx vitest run src/__tests__/useDynamicEffectsWam.test.ts && npx vitest run`
Expected: new file PASSES; full suite green (the connect-helper swap must not regress existing effects tests — they mock `tone`, so add `connect`/`disconnect` stubs to any existing tone mock factories that now fail with "No connect export").

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm --filter @waveform-playlist/browser typecheck && pnpm lint
git add packages/browser/src/hooks/useDynamicEffects.ts packages/browser/src/__tests__/useDynamicEffectsWam.test.ts
git commit -m "feat(browser): WAM entries in useDynamicEffects master chain"
```

---

### Task 10: WAM entries in `useTrackDynamicEffects` (per-track)

**Files:**
- Modify: `packages/browser/src/hooks/useTrackDynamicEffects.ts`
- Test: `packages/browser/src/__tests__/useTrackDynamicEffectsWam.test.ts`

**Interfaces:**
- Consumes: same as Task 9.
- Produces (additions to `UseTrackDynamicEffectsReturn`):

```typescript
  addWamEffectToTrack: (trackId: string, url: string, initialState?: unknown) => Promise<string>;
  getTrackWamPlugin: (trackId: string, instanceId: string) => WamPluginInstance | undefined;
```

`TrackActiveEffect` gains the same `kind`/`url` fields as `ActiveEffect`.

- [ ] **Step 1: Write the failing tests**

Mirror Task 9's test file with the track dimension (same mock header; import `useTrackDynamicEffects`):

```typescript
  it('addWamEffectToTrack appends a wam entry under the track id', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffectToTrack('track-1', 'https://example.com/p/index.js');
    });
    const entries = result.current.trackEffectsState.get('track-1') ?? [];
    expect(entries[0]?.kind).toBe('wam');
    expect(entries[0]?.instanceId).toBe(id);
    expect(result.current.getTrackWamPlugin('track-1', id)?.audioNode).toBe(fakeAudioNode);
  });

  it('rejects on a standardized context', async () => {
    isNativeGlobalContext.mockReturnValue(false);
    const { result } = renderHook(() => useTrackDynamicEffects());
    await expect(result.current.addWamEffectToTrack('t', 'https://x/y.js')).rejects.toThrow(
      /nativeAudioContext: true/
    );
  });

  it('removeEffectFromTrack destroys the wam plugin', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    act(() => result.current.removeEffectFromTrack('t1', id));
    expect(destroy).toHaveBeenCalled();
  });

  it('createOfflineTrackEffectsFunction skips wam entries with a warning', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { result } = renderHook(() => useTrackDynamicEffects());
    await act(async () => {
      await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    expect(result.current.createOfflineTrackEffectsFunction('t1')).toBeUndefined();
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('WAV export'));
    warn.mockRestore();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/browser && npx vitest run src/__tests__/useTrackDynamicEffectsWam.test.ts`
Expected: FAIL.

- [ ] **Step 3: Implement**

Mirror Task 9 exactly, adapted to the per-track Maps:
- `TrackActiveEffect` gains `kind: 'native' | 'wam'; url?: string;` — set `kind: 'native'` in `addEffectToTrack`.
- `rebuildTrackChain` + `getTrackEffectsFunction`: same `audible` filter (`!(ae.kind === 'wam' && ae.bypassed)`) and `connect()` helper swap (`let currentNode: ToneAudioNode | AudioNode = graphEnd; ... connect(currentNode, inst.effect); ... connect(currentNode, masterGainNode);`).
- `addWamEffectToTrack(trackId, url, initialState?)`: identical hosting sequence to Task 9's `addWamEffect`; stores into `trackEffectInstancesRef.current.get(trackId)` (init the inner Map like `addEffectToTrack` does) and appends to `setTrackEffectsState` under `trackId`.
- `getTrackWamPlugin(trackId, instanceId)`: reads the inner Map, narrows on `kind === 'wam'`.
- `toggleBypass`: same WAM early-return branch.
- `createOfflineTrackEffectsFunction`: same skip + warn (`filter((e) => !e.bypassed && e.kind !== 'wam')`).
- Extend `UseTrackDynamicEffectsReturn` + returned object.

- [ ] **Step 4: Run to verify pass**

Run: `cd packages/browser && npx vitest run`
Expected: full browser suite PASSES.

- [ ] **Step 5: Typecheck, lint, commit**

```bash
pnpm --filter @waveform-playlist/browser typecheck && pnpm lint
git add packages/browser/src/hooks/useTrackDynamicEffects.ts packages/browser/src/__tests__/useTrackDynamicEffectsWam.test.ts
git commit -m "feat(browser): WAM entries in useTrackDynamicEffects"
```

---

### Task 11: `WamEffectGui` component + `/tone` exports

**Files:**
- Create: `packages/browser/src/components/WamEffectGui.tsx`
- Modify: `packages/browser/src/tone.ts`
- Test: extend `packages/browser/src/__tests__/wamEffectFactory.test.ts`? No — Create: `packages/browser/src/__tests__/WamEffectGui.test.tsx` (jsdom)

**Interfaces:**
- Consumes: `WamPluginInstance` (type-only), `loadWamModule` (generic-panel fallback).
- Produces: `<WamEffectGui plugin={getWamPlugin(id)} />` — mounts `plugin.createGui()`, falls back to `createWamParameterPanel`, destroys on unmount.

- [ ] **Step 1: Write the failing tests**

```tsx
// packages/browser/src/__tests__/WamEffectGui.test.tsx
// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import React from 'react';

const panelEl = () => {
  const el = document.createElement('div');
  el.className = 'generic-panel';
  return el;
};
const createWamParameterPanel = vi.fn(async () => panelEl());
vi.mock('@dawcore/wam', () => ({
  createWamParameterPanel: (...a: unknown[]) => createWamParameterPanel(...a),
  ensureWamHost: vi.fn(),
  createWamInstance: vi.fn(),
  createWamInstanceFromFactory: vi.fn(),
  loadWamFactory: vi.fn(),
  cloneInstanceInto: vi.fn(),
  createParameterPanel: vi.fn(),
  fetchWamLibrary: vi.fn(),
  fetchWamDescriptor: vi.fn(),
  createWamTransportBridge: vi.fn(),
}));

import { WamEffectGui } from '../components/WamEffectGui';
import type { WamPluginInstance } from '@dawcore/wam';

describe('WamEffectGui', () => {
  it('mounts the plugin GUI and destroys it on unmount', async () => {
    const gui = document.createElement('div');
    gui.className = 'plugin-gui';
    const destroyGui = vi.fn();
    const plugin = {
      audioNode: {},
      createGui: vi.fn(async () => gui),
      destroyGui,
      destroy: vi.fn(),
    } as unknown as WamPluginInstance;

    const { container, unmount } = render(<WamEffectGui plugin={plugin} />);
    await waitFor(() => expect(container.querySelector('.plugin-gui')).not.toBeNull());
    unmount();
    expect(destroyGui).toHaveBeenCalledWith(gui);
  });

  it('falls back to the generic parameter panel for headless plugins', async () => {
    const plugin = { audioNode: {}, destroy: vi.fn() } as unknown as WamPluginInstance;
    const { container } = render(<WamEffectGui plugin={plugin} />);
    await waitFor(() => expect(container.querySelector('.generic-panel')).not.toBeNull());
    expect(createWamParameterPanel).toHaveBeenCalled();
  });

  it('renders nothing without a plugin', () => {
    const { container } = render(<WamEffectGui plugin={undefined} />);
    expect(container.querySelector('.wam-effect-gui')?.children.length ?? 0).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd packages/browser && npx vitest run src/__tests__/WamEffectGui.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement WamEffectGui.tsx**

```tsx
import React, { useEffect, useRef } from 'react';
import type { WamPluginInstance, WamParameterPanelNode } from '@dawcore/wam';
import { loadWamModule } from '../effects/loadWam';

export interface WamEffectGuiProps {
  /** Live plugin handle from getWamPlugin/getTrackWamPlugin. */
  plugin: WamPluginInstance | undefined;
  className?: string;
}

/**
 * Mounts a WAM plugin's own GUI (plugin.createGui), falling back to the
 * generic parameter panel from @dawcore/wam for headless plugins. The GUI is
 * destroyed on unmount — GUI and audio lifecycles are independent, so this
 * never interrupts sound.
 */
export const WamEffectGui: React.FC<WamEffectGuiProps> = ({ plugin, className }) => {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!plugin || !host) return;
    let cancelled = false;
    let gui: HTMLElement | null = null;

    (async () => {
      try {
        if (plugin.createGui) {
          gui = await plugin.createGui();
        } else {
          const wam = await loadWamModule();
          gui = await wam.createWamParameterPanel(
            plugin.audioNode as unknown as WamParameterPanelNode
          );
        }
        if (cancelled) {
          if (gui) plugin.destroyGui?.(gui);
          gui = null;
          return;
        }
        host.innerHTML = '';
        host.appendChild(gui);
      } catch (err) {
        console.warn(
          '[waveform-playlist] Failed to create WAM GUI: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    })();

    return () => {
      cancelled = true;
      if (gui) {
        gui.remove();
        plugin.destroyGui?.(gui);
      }
    };
  }, [plugin]);

  return <div ref={hostRef} className={className ?? 'wam-effect-gui'} />;
};
```

(Verify `WamParameterPanelNode` is the exported panel-node type — it is in `@dawcore/wam`'s index. Copy-ref the ref in the effect body per the ESLint cleanup rule — here `host` is already copied at the top; the cleanup closes over `gui`/`plugin`, not the ref.)

- [ ] **Step 4: Add /tone exports**

In `packages/browser/src/tone.ts`:

```typescript
export { WamEffectGui } from './components/WamEffectGui';
export type { WamEffectGuiProps } from './components/WamEffectGui';
export { loadWamModule } from './effects/loadWam';
export { createWamEffectInstance } from './effects/wamEffectFactory';
export type { WamEffectInstance } from './effects/wamEffectFactory';
```

(Existing `ActiveEffect`/hook types already flow through their export lines. Do NOT re-export anything from `@dawcore/wam` — no-cross-package-re-exports rule; `WamEffectGuiProps` referencing `WamPluginInstance` in its type signature is fine.)

- [ ] **Step 5: Run everything, verify guard tests, commit**

```bash
cd packages/browser && npx vitest run   # includes staticEngineImports + coreBarrelEngineFree
cd ../.. && pnpm --filter @waveform-playlist/browser typecheck && pnpm --filter @waveform-playlist/browser build && pnpm lint
pkill -f vitest || true
git add packages/browser/src/components/WamEffectGui.tsx packages/browser/src/tone.ts packages/browser/src/__tests__/WamEffectGui.test.tsx
git commit -m "feat(browser): WamEffectGui component and /tone WAM exports"
```

The `coreBarrelEngineFree` test is the authoritative check that the core barrel stayed engine-free; if it fails, a static import leaked into the core graph — WAM code must only be reachable from `tone.ts`.

---

### Task 12: Website — WAM showcase example page

**Files:**
- Modify: `website/package.json` (add `"@dawcore/wam": "workspace:*"` to dependencies) + `pnpm install` + lockfile
- Create: `website/src/components/examples/WamEffectsExample.tsx`
- Create: `website/src/pages/examples/wam-effects.tsx`
- Modify: `README.md` (examples section)

**Interfaces:**
- Consumes: `configureGlobalContext`/`supportsNativeContextMode` (playout), `useDynamicEffects`/`useTrackDynamicEffects`/`WamEffectGui` (browser/tone), `fetchWamLibrary`/`fetchWamDescriptor` (imported directly from `@dawcore/wam` — allowed here, the website is a consumer app).
- Produces: `/examples/wam-effects` page.

- [ ] **Step 1: Read the two reference components first**

Read `website/src/components/examples/EffectsExample.tsx` (effects-rack UI, provider wiring, effect-picker patterns) and `website/src/components/examples/StemTracksExample.tsx` (multitrack stems session + audio asset paths). The new component reuses their provider scaffolding (WaveformPlaylistProvider + track configs + transport buttons) — copy the provider/track/transport JSX and the stem audio URLs from StemTracksExample, and the rack-panel styling approach from EffectsExample.

- [ ] **Step 2: Create WamEffectsExample.tsx**

Structure (complete the scaffolding from the copied provider code; the WAM-specific logic is below and is the deliverable of this step):

```tsx
import React, { useEffect, useMemo, useState } from 'react';
import { configureGlobalContext, supportsNativeContextMode } from '@waveform-playlist/playout';
import {
  useDynamicEffects,
  useTrackDynamicEffects,
  WamEffectGui,
} from '@waveform-playlist/browser/tone';
import { fetchWamLibrary, fetchWamDescriptor, type WamLibraryEntry } from '@dawcore/wam';

// MUST run before any provider/hook creates the global context.
const wamSupported = typeof window !== 'undefined' && supportsNativeContextMode();
if (typeof window !== 'undefined' && wamSupported) {
  configureGlobalContext({ nativeAudioContext: true });
}

const COMMUNITY_MANIFEST = 'https://www.webaudiomodules.com/community/plugins.json';
const COMMUNITY_BASE = 'https://www.webaudiomodules.com/community/plugins/';

interface LibraryPlugin extends WamLibraryEntry {
  insertable: boolean;
}

function useWamLibrary() {
  const [plugins, setPlugins] = useState<LibraryPlugin[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');

  const load = async () => {
    setStatus('loading');
    try {
      const { entries } = await fetchWamLibrary(COMMUNITY_MANIFEST, { baseUrl: COMMUNITY_BASE });
      const withDescriptors = await Promise.all(
        entries.map(async (entry) => {
          const descriptor = await fetchWamDescriptor(entry.url);
          // Absent flags ≠ false: the SDK runtime-defaults audio I/O to true.
          const audioIO =
            descriptor !== null
              ? descriptor.hasAudioInput !== false && descriptor.hasAudioOutput !== false
              : (entry.category ?? []).some((c) => c.toLowerCase() === 'effect');
          return { ...entry, insertable: audioIO };
        })
      );
      setPlugins(withDescriptors);
      setStatus('ready');
    } catch (err) {
      console.warn(
        '[wam-example] library fetch failed: ' +
          (err instanceof Error ? err.message : String(err))
      );
      setStatus('error');
    }
  };

  return { plugins, status, load };
}
```

Component behavior requirements (implement with the copied scaffolding):
1. **Firefox banner:** when `!wamSupported`, render an info banner — "WAM plugins need a browser with native-context support (Chrome, Edge, Safari). Built-in Tone.js effects below still work." — and hide WAM add buttons; built-in effects remain usable (they work on the SAC fallback since the closure model doesn't need native mode).
2. **Racks:** a master rack (from `useDynamicEffects`) and a per-track rack selector (from `useTrackDynamicEffects` keyed by the stem track ids). Each rack lists entries with name, kind badge (`WAM` / built-in category), bypass toggle, remove button; WAM entries expand to a `<WamEffectGui plugin={getWamPlugin(instanceId)} />` panel (track rack uses `getTrackWamPlugin(trackId, instanceId)`).
3. **Library browser:** "Browse community plugins" button → `load()`; grid of cards (name, vendor, description, thumbnail when present, category chips); insertable ones get "+ Master" and "+ Track" buttons calling `addWamEffect(entry.url)` / `addWamEffectToTrack(selectedTrackId, entry.url)` inside try/catch that surfaces errors in a status line; non-insertable render disabled with an "instrument/no audio I/O" note. `status === 'error'` renders a retry button + note that webaudiomodules.com must be reachable.
4. **Built-in picker:** keep the existing add-native-effect select from EffectsExample so the page demonstrates MIXED chains (Tone reverb + WAM fuzz in one rack).
5. All `addWamEffect*` calls are async — disable the pressed button while pending.
6. Follow the site's dark palette (see `website/CLAUDE.md`) — reuse EffectsExample's styled-components/classes rather than inventing new styles.

- [ ] **Step 3: Create the page wrapper**

`website/src/pages/examples/wam-effects.tsx` — copy `website/src/pages/examples/effects.tsx` verbatim and adjust: title "WAM Plugins Example", description "Host Web Audio Modules (WAM 2.0) plugins — community plugin browser, native plugin GUIs, per-track and master chains", lazy-import `WamEffectsExample`, OG image `example-effects.png` placeholder (a dedicated social image is optional), "About This Example" bullets (WAM 2.0 hosting, community library, mixed Tone+WAM chains, native AudioContext mode) and a link to `/docs/wam-plugins` (Task 13's guide).

- [ ] **Step 4: Build + real-browser verify**

```bash
pnpm --filter @waveform-playlist/browser build   # website consumes some packages via dist
pnpm --filter website build                       # SSG must pass (createLazyExample defers evaluation)
pnpm --filter website start
```

In Chrome (foreground): open `/waveform-playlist/examples/wam-effects` (check the dev-server URL/base path from the startup log) →
1. Stems load & play.
2. Browse community plugins → cards render with categories; network failure case: block webaudiomodules.com in devtools → error state + retry appears.
3. Add BigMuff to a track → audible; GUI knob works; bypass silences; remove restores.
4. Add a built-in reverb + a WAM to the master rack → both audible in series; reorder if the rack exposes it.
5. Export flow (if the page includes ExportWavButton from the copied scaffolding): warns about skipped WAM effects in the console.
In Firefox: banner shows; built-in effects still work; no WAM buttons.

- [ ] **Step 5: README + commit**

Add the demo to root `README.md`'s examples list (same section format as the existing entries — run command `pnpm --filter website start`, page path `/examples/wam-effects`).

```bash
pnpm lint
git add website/package.json pnpm-lock.yaml website/src/components/examples/WamEffectsExample.tsx website/src/pages/examples/wam-effects.tsx README.md
git commit -m "feat(website): WAM plugins showcase example page"
```

---

### Task 13: Docs — guide + sync surfaces

**Files:**
- Create: `website/docs/wam-plugins.md`
- Modify: `website/docs/examples.md`, `website/docs/api/hooks.md`, `website/docs/api/llm-reference.md`, `website/static/llms.txt`

- [ ] **Step 1: Write the guide** (`website/docs/wam-plugins.md`)

Sections (write real prose + code, using the APIs exactly as shipped in Tasks 1–11):
1. **What WAMs are** — one paragraph + link to webaudiomodules.com.
2. **Enable native AudioContext mode** — why (worklet subclassing vs standardized-audio-context), the exact call placed before any audio init:
   ```ts
   import { configureGlobalContext } from '@waveform-playlist/playout';
   configureGlobalContext({ nativeAudioContext: true });
   ```
   Browser support matrix: Chrome/Edge/Safari ✅; Firefox ❌ (AudioListener AudioParams unimplemented — automatic fallback to the default context with a console warning; WAM APIs then throw with this same instruction). Side benefit: `sampleRate` is honored in native mode.
3. **React hooks** — `addWamEffect(url)`, `addWamEffectToTrack(trackId, url)`, `getWamPlugin`, bypass semantics (disconnection), `WamEffectGui` usage snippet, discovering plugins with `fetchWamLibrary`/`fetchWamDescriptor` from `@dawcore/wam` (install note: optional peer).
4. **Web Components (`<daw-editor>`) on the Tone backend** — `createToneAdapter()` + the same `configureGlobalContext` call, then the existing `editor.addWamPlugin`/`addTrackWamPlugin`/GUI/persistence/`exportAudio` surface (link to the existing dawcore effects docs rather than duplicating).
5. **Limitations** — WAV export in React skips WAM entries (console warning; follow-up issue link); no tempo/transport broadcast to plugins on the Tone adapter yet (follow-up); MIDI-track per-track chains unsupported on the Tone adapter.

- [ ] **Step 2: Sync the other surfaces**

- `docs/api/hooks.md`: add the new fields to the `UseDynamicEffectsReturn`/`UseTrackDynamicEffectsReturn` interface listings (copy the exact TypeScript from the source files).
- `docs/api/llm-reference.md`: same interfaces, plus `ToneEffectsTransport`, `AudioContextOptions.nativeAudioContext`, `isNativeGlobalContext`, `supportsNativeContextMode`, `WamEffectInstance`, `WamEffectGuiProps` — interfaces only, no prose (file convention).
- `docs/examples.md`: add the wam-effects example entry with a short snippet linking to the guide.
- `static/llms.txt`: add a WAM bullet under the browser package description and the new guide/example URLs.

- [ ] **Step 3: Verify docs build and links**

Run: `pnpm --filter website build`
Expected: PASS — the broken-link checker validates the new `/docs/wam-plugins` links (CSS calc warnings are pre-existing noise).

- [ ] **Step 4: Commit**

```bash
pnpm lint
git add website/docs/wam-plugins.md website/docs/examples.md website/docs/api/hooks.md website/docs/api/llm-reference.md website/static/llms.txt
git commit -m "docs: WAM plugins guide and API surface sync"
```

---

### Task 14: Follow-up issues, upstream drafts, final verification, PR

- [ ] **Step 1: File follow-up issues on the repo**

```bash
gh issue create --title "WAM-aware WAV export in React (useExportWav)" --body "$(printf 'v1 (wam-tone-react branch) skips WAM entries in WAV export with a console warning — Tone.Offline creates its own standardized-audio-context offline context, which cannot host WAM worklets.\n\nApproach: render on a native OfflineAudioContext and re-instantiate plugins from their URL-cached factories with state transfer, as dawcore export-audio.ts / @dawcore/wam cloneInstanceInto already do.\n\nSee docs/specs (PR description) for context.')"
gh issue create --title "TransportQueryLike tempo bridge on TonePlayoutAdapter" --body "$(printf 'The Tone adapter transport surface implements EffectsTransportLike only. Implementing TransportQueryLike (on/getTempo/tickToBar/timeToTick) would let dawcore EffectsManager create its wam-transport bridge so WAM plugins receive play/stop/tempo events. EffectsManager already skips the bridge silently when absent.')"
gh issue create --title "Evaluate native AudioContext as the default global context" --body "$(printf 'configureGlobalContext({ nativeAudioContext: true }) is opt-in. After the WAM feature soaks, evaluate making native the default: it fixes sampleRate control on Tone 15.1.22 and removes the SAC bifurcation, but needs the Firefox AudioListener feature-detect fallback to stay (MDN BCD 2026-06: all nine AudioListener AudioParams still version_added:false in Firefox).')"
gh issue create --title "WAM library picker: expose apiVersion from fetchWamDescriptor (extends #528)" --body "$(printf 'The website wam-effects library browser gates on descriptor audio-I/O flags and category fallback. Exposing apiVersion from fetchWamDescriptor would let pickers filter WAM 1.0 entries out reliably (#528).')"
```

- [ ] **Step 2: Draft the two upstream reports and post them IN CHAT for user review — do NOT file externally**

Draft 1 (Tone.js): title "Listener eagerly wraps AudioListener position params — custom native contexts throw on Firefox at initialize()". Body: minimal repro from the Task 2 spike (`Tone.setContext(new AudioContext()); Tone.getDestination()` on Firefox), the `param must be an AudioParam` error, note that `Tone.setContext(new AudioContext())` is Tone's documented AudioWorklet recipe and the only way to host WAM 2.0 plugins, suggested fix: lazy Listener construction or feature-detect + stub (as standardized-audio-context does), reference #681 and the MDN BCD data.

Draft 2 (WAM SDK, webaudiomodules): title "DX: clear error when initializeWamHost/createInstance receive a non-native BaseAudioContext". Body: Tone.js/standardized-audio-context users get an opaque `TypeError: parameter 1 is not of type 'BaseAudioContext'`; suggest an explicit guard + message ("WAM requires a native BaseAudioContext; Tone.js users: Tone.setContext(new AudioContext())") and a docs/FAQ note; reference that SAC never exposes native nodes so the incompatibility is by construction.

- [ ] **Step 3: Full verification sweep**

```bash
pnpm build                                    # all packages
pnpm --filter @waveform-playlist/playout typecheck
pnpm --filter @waveform-playlist/browser typecheck
pnpm lint                                     # 0 errors
cd packages/playout && npx vitest run && cd ../..
cd packages/browser && npx vitest run && cd ../..
cd packages/dawcore && npx vitest run && cd ../..   # must stay green (no dawcore changes expected)
pnpm --filter website build
pkill -f vitest || true
pnpm test                                     # Playwright e2e from root
```

Expected: all green (except the documented pre-existing dawcore-midi typecheck failure if running root `pnpm typecheck`).

- [ ] **Step 4: Remove spec/plan docs, per project convention, when the PR is ready to merge**

`git rm docs/specs/2026-07-01-wam-tone-react-design.md docs/plans/2026-07-01-wam-tone-react.md` in the final commit before merge — the PR description carries the durable record (project rule). Do this LAST, after review.

- [ ] **Step 5: Push and open the PR (do not merge — user approves merges)**

```bash
git push -u origin wam-tone-react
gh pr create --title "feat: WAM 2.0 plugins on the Tone backend, React hooks, and website showcase" --body-file <(printf '<comprehensive summary per git-workflow.md: analyze full branch history with git diff main...HEAD, cover native-context mode, transport hooks, React WAM entries, WamEffectGui, website page, docs; test plan listing the vitest suites + the two real-browser verification gates; note the follow-up issues>')
```

Then run the `claude-md-management:revise-claude-md` skill (per-issue workflow memory: review → fix → revise-claude-md before merge approval) to capture durable learnings (native-context mode, transport-hook seam, WAM-on-Tone constraints) into the relevant CLAUDE.md files.

---

## Self-Review (completed)

- **Spec coverage:** §1 → Task 1+2; §2a → Tasks 3–6; §2b → Tasks 7–11; §3a → Task 12; §3b → Task 13; §3c → embedded TDD steps + browser gates (Tasks 2, 6, 12); §3d → Task 14 + versioning note below. Export-skip decision → Tasks 9/10 step 6. Faust-inherits-only → Task 6 (one pre-compiled button, no new Faust surface).
- **Versioning (from spec §3d):** playout minor + browser minor bumps happen at release time, NOT in this branch (project publishes separately; a release is three artifacts).
- **Type consistency:** `ToneEffectsTransport` name used in Tasks 5/13; `connectEffects`/`disconnectEffects` (Task 3) consumed by Task 4; `masterBusInputNode` (Task 4) consumed by Task 5; `addWamEffect`/`getWamPlugin` (Task 9) and `addWamEffectToTrack`/`getTrackWamPlugin` (Task 10) consumed by Tasks 12/13; `WamEffectInstance.kind: 'wam'` consistent across Tasks 8–11.
- **Known judgment calls for the executor:** exact mock-variable names in playout test files (read each file's header first — noted inline); the website component reuses EffectsExample/StemTracksExample scaffolding (explicit read step); if `Context` constructor cast form differs under the repo's TS version, any equivalent two-step cast is fine.
