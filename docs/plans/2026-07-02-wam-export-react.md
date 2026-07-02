# WAM-Aware WAV Export in React Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `useExportWav` renders WAM plugin entries (master + per-track chains) into exported WAVs instead of skipping them (#536).

**Architecture:** Replace `Tone.Offline` with a hand-rolled equivalent (`renderToneOffline`) that wraps a **native** `OfflineAudioContext` in `Tone.OfflineContext` when native-context mode is active (spike-verified on Tone 15.1.22). A shared `buildOfflineChain` re-creates native Tone effects and re-instantiates WAM plugins on the offline context via `cloneInstanceInto` (live `getState()` transferred at export time). Offline effects functions become possibly-async; export awaits them and destroys clones in `finally`.

**Tech Stack:** TypeScript, React hooks, Tone.js 15.1.22, `@dawcore/wam` (optional peer, dynamic import), vitest + @testing-library/react, Playwright MCP for the browser gate.

**Spec:** `docs/specs/2026-07-02-wam-export-react-design.md` (approved). Branch: `wam-export-react`.

## Global Constraints

- **Fail loud:** a WAM host/clone failure rejects the whole export — never silently render without an effect the live chain has (user-confirmed decision).
- **Bypass parity:** bypassed WAM entries are excluded from the offline chain (disconnection bypass); bypassed natives stay excluded as today.
- **Core barrel stays engine-free:** new static `tone`/playout imports are allowed ONLY in files reachable exclusively from `src/tone.ts` (`useExportWav`, effects hooks, the two new modules). `src/index.tsx` must not gain a path to them. `coreBarrelEngineFree.test.ts` enforces this.
- **console warnings are string-only** (never pass objects — Chrome lazy evaluation gotcha). Concatenate with `+`.
- **No new dependencies; no version bumps in this PR** (release handled separately per repo convention).
- **`pnpm lint` from repo root before each commit is unnecessary, but Task 7 requires full `pnpm -w lint` with 0 errors** (`react-hooks/exhaustive-deps` and `no-unsafe-function-type` are lint-only errors invisible to typecheck/vitest).
- **tsconfig `noUnusedLocals`:** removing the last use of an import (e.g. `EffectsFunction` in `useExportWav`) must remove the import in the same change.
- **Vitest cleanup:** after running package tests, check `pgrep -f vitest` and `pkill -f vitest` strays.
- All vitest mocks of `@dawcore/wam` must include every export of the real package (strict-mock sweep guard — existing files already do).

---

### Task 1: `renderToneOffline` helper

**Files:**
- Create: `packages/browser/src/utils/renderToneOffline.ts`
- Test: `packages/browser/src/__tests__/renderToneOffline.test.ts`

**Interfaces:**
- Consumes: `isNativeGlobalContext()` from `@waveform-playlist/playout`; `getContext`, `setContext`, `OfflineContext` from `tone`. `new OfflineContext(nativeOfflineAudioContext)` is a real overload in Tone 15.1.22's d.ts (`constructor(context: OfflineAudioContext)` — the DOM type, no cast needed).
- Produces: `renderToneOffline(build: OfflineBuildCallback, duration: number, channels: number, sampleRate: number): Promise<AudioBuffer>` and `type OfflineBuildCallback = (context: OfflineContext) => Promise<void> | void`. Task 3 calls this from `useExportWav`.

- [ ] **Step 1: Write the failing test**

Create `packages/browser/src/__tests__/renderToneOffline.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { state, MockOfflineContext } = vi.hoisted(() => {
  const state = {
    ctorArgs: [] as unknown[][],
    render: vi.fn(),
    getContext: vi.fn(),
    setContext: vi.fn(),
    isNative: vi.fn(() => true),
  };
  class MockOfflineContext {
    render = state.render;
    constructor(...args: unknown[]) {
      state.ctorArgs.push(args);
    }
  }
  return { state, MockOfflineContext };
});

vi.mock('tone', () => ({
  getContext: (...a: unknown[]) => state.getContext(...a),
  setContext: (...a: unknown[]) => state.setContext(...a),
  OfflineContext: MockOfflineContext,
}));

vi.mock('@waveform-playlist/playout', () => ({
  isNativeGlobalContext: () => state.isNative(),
}));

import { renderToneOffline } from '../utils/renderToneOffline';

class FakeNativeOfflineAudioContext {
  options: unknown;
  constructor(options: unknown) {
    this.options = options;
  }
}

const previousContext = { id: 'previous' };
const renderedAudioBuffer = { length: 144000 };

describe('renderToneOffline', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.ctorArgs.length = 0;
    state.isNative.mockReturnValue(true);
    state.getContext.mockReturnValue(previousContext);
    state.render.mockResolvedValue({ get: () => renderedAudioBuffer });
    vi.stubGlobal('OfflineAudioContext', FakeNativeOfflineAudioContext);
  });

  it('native mode: wraps a native OfflineAudioContext with the right options', async () => {
    const result = await renderToneOffline(() => undefined, 3, 2, 48000);
    expect(state.ctorArgs).toHaveLength(1);
    const [wrapped] = state.ctorArgs[0];
    expect(wrapped).toBeInstanceOf(FakeNativeOfflineAudioContext);
    expect((wrapped as FakeNativeOfflineAudioContext).options).toEqual({
      numberOfChannels: 2,
      length: 144000,
      sampleRate: 48000,
    });
    expect(result).toBe(renderedAudioBuffer);
  });

  it('standardized mode: constructs OfflineContext(channels, duration, sampleRate)', async () => {
    state.isNative.mockReturnValue(false);
    await renderToneOffline(() => undefined, 3, 2, 48000);
    expect(state.ctorArgs[0]).toEqual([2, 3, 48000]);
  });

  it('sets the offline context for the build and restores the previous one before rendering', async () => {
    const build = vi.fn();
    await renderToneOffline(build, 1, 2, 48000);
    expect(state.setContext).toHaveBeenCalledTimes(2);
    expect(state.setContext.mock.calls[0][0]).toBeInstanceOf(MockOfflineContext);
    expect(state.setContext.mock.calls[1][0]).toBe(previousContext);
    // build runs between the two setContext calls; render runs after restore
    expect(build.mock.invocationCallOrder[0]).toBeGreaterThan(
      state.setContext.mock.invocationCallOrder[0]
    );
    expect(state.render.mock.invocationCallOrder[0]).toBeGreaterThan(
      state.setContext.mock.invocationCallOrder[1]
    );
  });

  it('restores the previous context when the build throws (upstream Tone.Offline leaks here)', async () => {
    const boom = new Error('graph build failed');
    await expect(
      renderToneOffline(
        () => {
          throw boom;
        },
        1,
        2,
        48000
      )
    ).rejects.toThrow('graph build failed');
    expect(state.setContext).toHaveBeenLastCalledWith(previousContext);
    expect(state.render).not.toHaveBeenCalled();
  });

  it('throws when the rendered ToneAudioBuffer is empty', async () => {
    state.render.mockResolvedValue({ get: () => null });
    await expect(renderToneOffline(() => undefined, 1, 2, 48000)).rejects.toThrow(
      /produced no audio buffer/
    );
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/browser && npx vitest run src/__tests__/renderToneOffline.test.ts`
Expected: FAIL — `Cannot find module '../utils/renderToneOffline'` (or equivalent resolve error).

- [ ] **Step 3: Write the implementation**

Create `packages/browser/src/utils/renderToneOffline.ts`:

```ts
/**
 * Hand-rolled variant of Tone.Offline() that can render on a NATIVE
 * OfflineAudioContext when the app runs in native-context mode — required to
 * host WAM worklets in the offline graph (WAM nodes subclass the native
 * AudioWorkletNode; Tone.Offline hardcodes a standardized-audio-context
 * offline context). In standardized mode the construction is identical to
 * Tone.Offline's, so non-WAM exports behave exactly as before. Unlike
 * upstream, the previous global context is restored in a finally block, so a
 * failed graph build can't leave the offline context installed as the app's
 * global context.
 */
import { getContext, setContext, OfflineContext } from 'tone';
import { isNativeGlobalContext } from '@waveform-playlist/playout';

/** Builds the offline graph. Runs while `context` is the global Tone context. */
export type OfflineBuildCallback = (context: OfflineContext) => Promise<void> | void;

export async function renderToneOffline(
  build: OfflineBuildCallback,
  duration: number,
  channels: number,
  sampleRate: number
): Promise<AudioBuffer> {
  const offlineContext = isNativeGlobalContext()
    ? new OfflineContext(
        new OfflineAudioContext({
          numberOfChannels: channels,
          length: Math.round(duration * sampleRate),
          sampleRate,
        })
      )
    : new OfflineContext(channels, duration, sampleRate);

  const previousContext = getContext();
  setContext(offlineContext);
  try {
    await build(offlineContext);
  } finally {
    setContext(previousContext);
  }

  const toneBuffer = await offlineContext.render();
  const audioBuffer = toneBuffer.get();
  if (!audioBuffer) {
    throw new Error('Offline rendering produced no audio buffer');
  }
  return audioBuffer;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/browser && npx vitest run src/__tests__/renderToneOffline.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --filter @waveform-playlist/browser typecheck`
Expected: exit 0.

```bash
cd /Users/naomiaro/Code/waveform-playlist
git add packages/browser/src/utils/renderToneOffline.ts packages/browser/src/__tests__/renderToneOffline.test.ts
git commit -m "feat(browser): renderToneOffline — Tone offline render on a native OfflineAudioContext"
```

---

### Task 2: shared offline chain builder (`buildOfflineChain` / `connectOfflineChain`)

**Files:**
- Create: `packages/browser/src/effects/offlineChain.ts`
- Test: `packages/browser/src/__tests__/offlineChain.test.ts`

**Interfaces:**
- Consumes: `createEffectInstance(definition, params): EffectInstance` from `./effectFactory`; `createWamEffectInstance(plugin): WamEffectInstance` from `./wamEffectFactory`; `loadWamModule()` from `./loadWam`; `connect` from `tone`; `WamPluginInstance` (type) from `@dawcore/wam`; `EffectDefinition` (type) from `./effectDefinitions`.
- Produces (used by Tasks 4 & 5):
  - `interface OfflineChainEntry { instanceId: string; kind: 'native' | 'wam'; definition: EffectDefinition; params: Record<string, number | string | boolean> }` — structural subset of both `ActiveEffect` and `TrackActiveEffect`, so the hooks pass their filtered arrays directly.
  - `buildOfflineChain(entries: OfflineChainEntry[], getLivePlugin: (instanceId: string) => WamPluginInstance | undefined, rawContext: BaseAudioContext): Promise<{ instances: EffectInstance[]; dispose: () => void }>`
  - `connectOfflineChain(from: ToneAudioNode | AudioNode, instances: EffectInstance[], to: ToneAudioNode | AudioNode): void`

- [ ] **Step 1: Write the failing test**

Create `packages/browser/src/__tests__/offlineChain.test.ts`:

```ts
// @vitest-environment node
import { describe, it, expect, vi, beforeEach } from 'vitest';

const ensureWamHost = vi.fn();
const cloneInstanceInto = vi.fn();

vi.mock('../effects/loadWam', () => ({
  loadWamModule: () =>
    Promise.resolve({
      ensureWamHost: (...a: unknown[]) => ensureWamHost(...a),
      cloneInstanceInto: (...a: unknown[]) => cloneInstanceInto(...a),
    }),
}));

// effectFactory reads all 20 effect constructors from 'tone' at module load —
// every one must exist on the mock (same guard as the other WAM test files).
vi.mock('tone', () => {
  const toneEffectStub = () => ({
    dispose: vi.fn(),
    connect: vi.fn(),
    disconnect: vi.fn(),
    set: vi.fn(),
    wet: { value: 0.5 },
  });
  const effectCtor = () => vi.fn(() => toneEffectStub());
  return {
    connect: vi.fn(),
    disconnect: vi.fn(),
    Reverb: effectCtor(),
    Freeverb: effectCtor(),
    JCReverb: effectCtor(),
    FeedbackDelay: effectCtor(),
    PingPongDelay: effectCtor(),
    Chorus: effectCtor(),
    Phaser: effectCtor(),
    Tremolo: effectCtor(),
    Vibrato: effectCtor(),
    AutoPanner: effectCtor(),
    AutoFilter: effectCtor(),
    AutoWah: effectCtor(),
    EQ3: effectCtor(),
    Distortion: effectCtor(),
    BitCrusher: effectCtor(),
    Chebyshev: effectCtor(),
    Compressor: effectCtor(),
    Limiter: effectCtor(),
    Gate: effectCtor(),
    StereoWidener: effectCtor(),
  };
});

import { buildOfflineChain, connectOfflineChain } from '../effects/offlineChain';
import type { OfflineChainEntry } from '../effects/offlineChain';
import { getEffectDefinition } from '../effects/effectDefinitions';
import { connect } from 'tone';
import type { WamPluginInstance } from '@dawcore/wam';

const rawContext = { raw: 'offline' } as unknown as BaseAudioContext;

function nativeEntry(id: string, effectId: string): OfflineChainEntry {
  const definition = getEffectDefinition(effectId)!;
  const params: Record<string, number | string | boolean> = {};
  definition.parameters.forEach((p) => {
    params[p.name] = p.default;
  });
  return { instanceId: id, kind: 'native', definition, params };
}

function wamEntry(id: string): OfflineChainEntry {
  return {
    instanceId: id,
    kind: 'wam',
    definition: {
      id: 'wam:BigMuff',
      name: 'BigMuff',
      category: 'wam',
      description: 'WAM plugin',
      parameters: [],
    },
    params: {},
  };
}

function makeLivePlugin(): WamPluginInstance {
  return {
    url: 'https://example.com/p/index.js',
    descriptor: { name: 'BigMuff' },
    audioNode: { live: true },
    getState: vi.fn(),
    setState: vi.fn(),
    destroy: vi.fn(),
  } as unknown as WamPluginInstance;
}

describe('buildOfflineChain / connectOfflineChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureWamHost.mockResolvedValue({ hostGroupId: 'group-1' });
  });

  it('builds native entries and wires from → e1 → e2 → to in order', async () => {
    const { instances } = await buildOfflineChain(
      [nativeEntry('n1', 'reverb'), nativeEntry('n2', 'chorus')],
      () => undefined,
      rawContext
    );
    expect(instances).toHaveLength(2);

    const from = { name: 'from' };
    const to = { name: 'to' };
    connectOfflineChain(from as never, instances, to as never);
    const calls = (connect as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls).toHaveLength(3);
    expect(calls[0][0]).toBe(from);
    expect(calls[0][1]).toBe(instances[0].effect);
    expect(calls[1][0]).toBe(instances[0].effect);
    expect(calls[1][1]).toBe(instances[1].effect);
    expect(calls[2][0]).toBe(instances[1].effect);
    expect(calls[2][1]).toBe(to);
  });

  it('re-instantiates wam entries on the offline context with the live plugin state', async () => {
    const livePlugin = makeLivePlugin();
    const cloneNode = { clone: true };
    const cloneDestroy = vi.fn();
    cloneInstanceInto.mockResolvedValue({
      url: livePlugin.url,
      descriptor: { name: 'BigMuff' },
      audioNode: cloneNode,
      getState: vi.fn(),
      setState: vi.fn(),
      destroy: cloneDestroy,
    });

    const { instances, dispose } = await buildOfflineChain(
      [wamEntry('w1')],
      (instanceId) => (instanceId === 'w1' ? livePlugin : undefined),
      rawContext
    );

    expect(ensureWamHost).toHaveBeenCalledWith(rawContext);
    expect(cloneInstanceInto).toHaveBeenCalledWith(livePlugin, rawContext, 'group-1');
    expect(instances).toHaveLength(1);
    expect(instances[0].effect).toBe(cloneNode);

    dispose();
    expect(cloneDestroy).toHaveBeenCalled();
  });

  it('preserves chain order for mixed native/wam entries', async () => {
    const livePlugin = makeLivePlugin();
    const cloneNode = { clone: true };
    cloneInstanceInto.mockResolvedValue({
      url: livePlugin.url,
      descriptor: { name: 'BigMuff' },
      audioNode: cloneNode,
      getState: vi.fn(),
      setState: vi.fn(),
      destroy: vi.fn(),
    });

    const { instances } = await buildOfflineChain(
      [nativeEntry('n1', 'reverb'), wamEntry('w1'), nativeEntry('n2', 'chorus')],
      () => livePlugin,
      rawContext
    );
    expect(instances).toHaveLength(3);
    expect(instances[1].effect).toBe(cloneNode);

    const from = { name: 'from' };
    const to = { name: 'to' };
    connectOfflineChain(from as never, instances, to as never);
    const calls = (connect as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.map((c) => [c[0], c[1]])).toEqual([
      [from, instances[0].effect],
      [instances[0].effect, cloneNode],
      [cloneNode, instances[2].effect],
      [instances[2].effect, to],
    ]);
  });

  it('connects from directly to to when there are no instances', () => {
    const from = { name: 'from' };
    const to = { name: 'to' };
    connectOfflineChain(from as never, [], to as never);
    expect(connect).toHaveBeenCalledTimes(1);
    expect(connect).toHaveBeenCalledWith(from, to);
  });

  it('rejects with a clear error when no live plugin exists for a wam entry', async () => {
    await expect(buildOfflineChain([wamEntry('w1')], () => undefined, rawContext)).rejects.toThrow(
      /no live WAM plugin found for "BigMuff"/
    );
  });

  it('disposes already-created instances when a later clone fails (fail-loud, no leaks)', async () => {
    cloneInstanceInto.mockRejectedValue(new Error('factory exploded'));
    const livePlugin = makeLivePlugin();
    const entries = [nativeEntry('n1', 'reverb'), wamEntry('w1')];

    await expect(buildOfflineChain(entries, () => livePlugin, rawContext)).rejects.toThrow(
      'factory exploded'
    );
    // The native instance created before the failing clone must be disposed.
    // createEffectInstance's dispose() calls effect.disconnect() + effect.dispose();
    // the Reverb constructor mock returns stubs we can inspect.
    const { Reverb } = await import('tone');
    const reverbStub = (Reverb as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(reverbStub.dispose).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/browser && npx vitest run src/__tests__/offlineChain.test.ts`
Expected: FAIL — cannot resolve `../effects/offlineChain`.

- [ ] **Step 3: Write the implementation**

Create `packages/browser/src/effects/offlineChain.ts`:

```ts
/**
 * Shared offline effects chain builder for WAV export (master + per-track).
 * Natives are re-created fresh on the current (offline) context; WAM entries
 * are re-instantiated on the offline context from their URL-cached factories
 * with the live instance's state transferred (cloneInstanceInto — worklets
 * are context-bound). Any failure disposes the partially-built chain and
 * rethrows: a WAV export must never silently render without an effect the
 * live chain has (#536).
 */
import { connect } from 'tone';
import type { ToneAudioNode } from 'tone';
import type { WamPluginInstance } from '@dawcore/wam'; // type-only — erased at runtime
import type { EffectDefinition } from './effectDefinitions';
import { createEffectInstance, type EffectInstance } from './effectFactory';
import { createWamEffectInstance } from './wamEffectFactory';
import { loadWamModule } from './loadWam';

/** Structural subset of ActiveEffect / TrackActiveEffect used offline. */
export interface OfflineChainEntry {
  instanceId: string;
  kind: 'native' | 'wam';
  definition: EffectDefinition;
  params: Record<string, number | string | boolean>;
}

export interface OfflineChain {
  /** Offline effect instances, in chain order. */
  instances: EffectInstance[];
  /** Disposes every offline instance (destroys WAM clones). Never throws. */
  dispose: () => void;
}

export async function buildOfflineChain(
  entries: OfflineChainEntry[],
  getLivePlugin: (instanceId: string) => WamPluginInstance | undefined,
  rawContext: BaseAudioContext
): Promise<OfflineChain> {
  const instances: EffectInstance[] = [];
  const dispose = (): void => {
    // EffectInstance.dispose implementations catch internally — safe to run all.
    instances.forEach((inst) => inst.dispose());
  };
  try {
    for (const entry of entries) {
      if (entry.kind === 'native') {
        instances.push(createEffectInstance(entry.definition, entry.params));
        continue;
      }
      const livePlugin = getLivePlugin(entry.instanceId);
      if (!livePlugin) {
        throw new Error(
          '[waveform-playlist] WAV export: no live WAM plugin found for "' +
            entry.definition.name +
            '" (' +
            entry.instanceId +
            ') — cannot re-instantiate it offline.'
        );
      }
      const wam = await loadWamModule();
      // ensureWamHost is idempotent per context — repeated calls share one init.
      const { hostGroupId } = await wam.ensureWamHost(rawContext);
      const clone = await wam.cloneInstanceInto(livePlugin, rawContext, hostGroupId);
      instances.push(createWamEffectInstance(clone));
    }
  } catch (err) {
    dispose();
    throw err;
  }
  return { instances, dispose };
}

/** Wire from → instances (in order) → to via Tone's native↔Tone bridging connect(). */
export function connectOfflineChain(
  from: ToneAudioNode | AudioNode,
  instances: EffectInstance[],
  to: ToneAudioNode | AudioNode
): void {
  let current: ToneAudioNode | AudioNode = from;
  for (const inst of instances) {
    connect(current, inst.effect);
    current = inst.effect;
  }
  connect(current, to);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/browser && npx vitest run src/__tests__/offlineChain.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Typecheck and commit**

Run: `pnpm --filter @waveform-playlist/browser typecheck`
Expected: exit 0. (`buildOfflineChain`/`connectOfflineChain` are consumed in Tasks 4–5, but exports are never flagged by `noUnusedLocals`.)

```bash
cd /Users/naomiaro/Code/waveform-playlist
git add packages/browser/src/effects/offlineChain.ts packages/browser/src/__tests__/offlineChain.test.ts
git commit -m "feat(browser): shared offline effects chain builder with WAM re-instantiation"
```

---

### Task 3: async offline contract + `useExportWav` on the unified render path

**Files:**
- Modify: `packages/browser/src/hooks/useExportWav.ts`
- Modify: `packages/browser/src/components/ExportControls.tsx`
- Modify: `packages/browser/src/tone.ts`

**Interfaces:**
- Consumes: `renderToneOffline`, `OfflineBuildCallback` (Task 1).
- Produces (used by Tasks 4, 5 and consumers):
  - `export type OfflineEffectsCleanup = void | (() => void);`
  - `export type OfflineEffectsFunction = (masterVolume: Volume, destination: ToneAudioNode, isOffline: boolean) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;`
  - `export type OfflineTrackEffectsFunction = (graphEnd: Gain, masterGainNode: ToneAudioNode, isOffline: boolean) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;`
  - `ExportOptions.effectsFunction?: OfflineEffectsFunction` and `ExportOptions.createOfflineTrackEffects?: (trackId: string) => OfflineTrackEffectsFunction | undefined` — every existing `EffectsFunction` / playout `TrackEffectsFunction` is assignable to these (identical params, narrower return), so this widening is non-breaking.

- [ ] **Step 1: Update `useExportWav.ts`**

1. Replace the import block at the top of the file:

```ts
import { useState, useCallback } from 'react';
import {
  gainToDb,
  trackChannelCount,
  applyFadeIn,
  applyFadeOut,
  type ClipTrack,
  type FadeType,
} from '@waveform-playlist/core';
import { getUnderlyingAudioParam, getGlobalAudioContext } from '@waveform-playlist/playout';
import type { Volume, Gain, ToneAudioNode } from 'tone';
import { renderToneOffline } from '../utils/renderToneOffline';
import { encodeWav, downloadBlob, type WavEncoderOptions } from '../utils/wavEncoder';
```

(`EffectsFunction` is no longer referenced — removing it from the import satisfies `noUnusedLocals`. The `tone` import is type-only; the value import chain to `tone` now flows through `renderToneOffline`, which is fine — this file is reachable only from `src/tone.ts`.)

2. Replace the existing `TrackEffectsFunction` type block (keep it for backwards compatibility) and add the offline types directly below it:

```ts
/** Function type for per-track effects (same as in @waveform-playlist/core) */
export type TrackEffectsFunction = (
  graphEnd: unknown,
  destination: unknown,
  isOffline: boolean
) => void | (() => void);

/** Cleanup returned by an offline effects function (disposes offline instances / WAM clones). */
export type OfflineEffectsCleanup = void | (() => void);

/**
 * Master-chain effects function for offline rendering. May return a Promise —
 * WAM entries are re-instantiated asynchronously on the offline context.
 * Every live EffectsFunction is assignable to this type.
 */
export type OfflineEffectsFunction = (
  masterVolume: Volume,
  destination: ToneAudioNode,
  isOffline: boolean
) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;

/** Per-track variant of OfflineEffectsFunction. */
export type OfflineTrackEffectsFunction = (
  graphEnd: Gain,
  masterGainNode: ToneAudioNode,
  isOffline: boolean
) => OfflineEffectsCleanup | Promise<OfflineEffectsCleanup>;
```

3. In `ExportOptions`, replace the two effects members:

```ts
  /**
   * Optional effects function for master effects. When provided, export renders
   * through the effects chain (WAM entries included — re-instantiated on the
   * offline context). The function receives isOffline=true and may be async.
   */
  effectsFunction?: OfflineEffectsFunction;
  /**
   * Optional function to create offline track effects.
   * Takes a trackId and returns an offline effects function for that track.
   * This is used instead of track.effects to avoid AudioContext mismatch issues.
   */
  createOfflineTrackEffects?: (trackId: string) => OfflineTrackEffectsFunction | undefined;
```

4. Update the two `renderOffline` parameter types to match (`effectsFunction: OfflineEffectsFunction | undefined`, `createOfflineTrackEffects: ((trackId: string) => OfflineTrackEffectsFunction | undefined) | undefined`).

5. Replace the whole `renderOffline` function body (keep the signature order) with:

```ts
/**
 * Render the playlist offline. Uses renderToneOffline — a hand-rolled
 * Tone.Offline variant that renders on a NATIVE OfflineAudioContext in
 * native-context mode so mixed Tone + WAM chains can be hosted (#536).
 * Mirrors the live playback graph: Player → fadeGain → trackVolume →
 * trackPan → trackMute → masterVolume → destination. Effects chains (master
 * and per-track) are conditionally inserted when provided; their cleanups
 * (which destroy offline WAM clones) always run after the render.
 */
async function renderOffline(
  tracksToRender: { track: ClipTrack; state: TrackState; index: number }[],
  hasSolo: boolean,
  duration: number,
  sampleRate: number,
  applyEffects: boolean,
  effectsFunction: OfflineEffectsFunction | undefined,
  createOfflineTrackEffects: ((trackId: string) => OfflineTrackEffectsFunction | undefined) | undefined,
  onProgress: (progress: number) => void
): Promise<AudioBuffer> {
  const { Volume, Gain, Panner, Player, ToneAudioBuffer } = await import('tone');

  onProgress(0.1);

  // Derive output channel count from audible tracks only
  const audibleTracks = tracksToRender.filter(({ state }) => {
    if (state.muted && !state.soloed) return false;
    if (hasSolo && !state.soloed) return false;
    return true;
  });
  const outputChannels = audibleTracks.reduce(
    (max, { track }) => Math.max(max, trackChannelCount(track)),
    1
  );

  const cleanups: Array<() => void> = [];
  try {
    const audioBuffer = await renderToneOffline(
      async (context) => {
        // Master volume at unity gain
        const masterVolume = new Volume(0);

        // Conditionally insert master effects chain (may be async — WAM cloning)
        if (effectsFunction && applyEffects) {
          const cleanup = await effectsFunction(masterVolume, context.destination, true);
          if (cleanup) cleanups.push(cleanup);
        } else {
          masterVolume.connect(context.destination);
        }

        for (const { track, state } of audibleTracks) {
          // Track-level nodes mirror ToneTrack: volume → pan → mute
          const trackVolume = new Volume(gainToDb(state.volume));
          // Match channelCount to source material — Tone.js Panner defaults to 1
          // which forces stereo→mono downmix. Use 2 only for stereo sources.
          const trackPan = new Panner({ pan: state.pan, channelCount: trackChannelCount(track) });
          const trackMute = new Gain(state.muted ? 0 : 1);

          // Conditionally insert per-track effects chain (may be async — WAM cloning)
          const trackEffects = createOfflineTrackEffects?.(track.id);
          if (trackEffects && applyEffects) {
            const cleanup = await trackEffects(trackMute, masterVolume, true);
            if (cleanup) cleanups.push(cleanup);
          } else {
            trackMute.connect(masterVolume);
          }

          // Connect track chain: trackVolume → trackPan → trackMute
          trackPan.connect(trackMute);
          trackVolume.connect(trackPan);

          // Schedule each clip
          for (const clip of track.clips) {
            const {
              audioBuffer: clipBuffer,
              startSample,
              durationSamples,
              offsetSamples,
              gain: clipGain,
              fadeIn,
              fadeOut,
            } = clip;

            // Skip clips without audioBuffer (peaks-only clips can't be exported)
            if (!clipBuffer) {
              console.warn(
                '[waveform-playlist] Skipping clip "' +
                  (clip.name || clip.id) +
                  '" - no audioBuffer for export'
              );
              continue;
            }

            // Convert samples to seconds
            const startTime = startSample / sampleRate;
            const clipDuration = durationSamples / sampleRate;
            const offset = offsetSamples / sampleRate;

            // Create player and clip-level fade gain
            const toneBuffer = new ToneAudioBuffer(clipBuffer);
            const player = new Player(toneBuffer);
            const fadeGain = new Gain(clipGain);

            // Connect: player → fadeGain → trackVolume
            player.connect(fadeGain);
            fadeGain.connect(trackVolume);

            // Apply fade automation via native AudioParam
            if (applyEffects) {
              const audioParam = getUnderlyingAudioParam(fadeGain.gain);
              if (audioParam) {
                applyClipFades(audioParam, clipGain, startTime, clipDuration, fadeIn, fadeOut);
              } else if (fadeIn || fadeOut) {
                console.warn(
                  '[waveform-playlist] Cannot apply fades for clip "' +
                    (clip.name || clip.id) +
                    '" - AudioParam not accessible'
                );
              }
            }

            player.start(startTime, offset, clipDuration);
          }
        }

        context.transport.start(0);
      },
      duration,
      outputChannels,
      sampleRate
    );

    onProgress(0.9);
    return audioBuffer;
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Offline rendering failed: ' + String(err));
  } finally {
    // Always dispose offline effect instances / destroy WAM clones —
    // success or failure. Warn-and-continue per cleanup.
    for (const cleanup of cleanups) {
      try {
        cleanup();
      } catch (err) {
        console.warn(
          '[waveform-playlist] Export cleanup error: ' +
            (err instanceof Error ? err.message : String(err))
        );
      }
    }
  }
}
```

Notes for the implementer:
- The clip destructuring renames `audioBuffer` → `clipBuffer` because the enclosing scope now has an `audioBuffer` result variable. Keep the rename.
- Delete the old `let buffer; try { buffer = await Offline(...) } ...` block and the `buffer.get()` null-check tail — `renderToneOffline` returns a plain `AudioBuffer` and does the null-check itself.
- The hook's doc comment ("Uses Tone.Offline for non-real-time rendering") — update to "Uses a Tone offline render (native OfflineAudioContext in native-context mode) …".

- [ ] **Step 2: Update `ExportControls.tsx`**

Replace the two type imports and the two prop members:

```ts
import { useExportWav, type OfflineEffectsFunction, type OfflineTrackEffectsFunction } from '../hooks/useExportWav';
```

(delete the now-unused `import type { EffectsFunction } from '@waveform-playlist/playout';` and the `TrackEffectsFunction` import)

```ts
  /**
   * Optional effects function for master effects. When provided, export renders
   * through the effects chain (WAM entries included). May be async.
   */
  effectsFunction?: OfflineEffectsFunction;
  /**
   * Optional function to create offline track effects.
   * Takes a trackId and returns an offline effects function for that track.
   */
  createOfflineTrackEffects?: (trackId: string) => OfflineTrackEffectsFunction | undefined;
```

- [ ] **Step 3: Export the new types from the tone surface**

In `packages/browser/src/tone.ts`, extend the useExportWav type export line:

```ts
export type {
  ExportOptions,
  ExportResult,
  UseExportWavReturn,
  OfflineEffectsCleanup,
  OfflineEffectsFunction,
  OfflineTrackEffectsFunction,
} from './hooks/useExportWav';
```

- [ ] **Step 4: Typecheck and run the full browser suite**

Run: `pnpm --filter @waveform-playlist/browser typecheck && cd packages/browser && npx vitest run`
Expected: typecheck exit 0; all tests pass (existing suites unaffected — sync effects functions are simply awaited, a no-op). Then `pkill -f vitest` if `pgrep -f vitest` shows strays.

- [ ] **Step 5: Commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist
git add packages/browser/src/hooks/useExportWav.ts packages/browser/src/components/ExportControls.tsx packages/browser/src/tone.ts
git commit -m "feat(browser): export renders on native OfflineAudioContext; async offline effects contract"
```

---

### Task 4: WAM entries in the master offline factory (`useDynamicEffects`)

**Files:**
- Modify: `packages/browser/src/hooks/useDynamicEffects.ts`
- Test: `packages/browser/src/__tests__/useDynamicEffectsWam.test.ts`

**Interfaces:**
- Consumes: `buildOfflineChain`, `connectOfflineChain`, `OfflineChainEntry` (Task 2); `OfflineEffectsFunction` (Task 3). `ActiveEffect` satisfies `OfflineChainEntry` structurally.
- Produces: `UseDynamicEffectsReturn.createOfflineEffectsFunction: () => OfflineEffectsFunction | undefined` — same call sites (website `useMemo`), widened return type.

- [ ] **Step 1: Update the test file — make the mock's `cloneInstanceInto` controllable**

In `packages/browser/src/__tests__/useDynamicEffectsWam.test.ts`, add a top-level fn next to `ensureWamHost` and use the deferred-wrapper pattern in the mock factory:

```ts
const cloneInstanceInto = vi.fn();
```

and in the `vi.mock('@dawcore/wam', ...)` factory replace `cloneInstanceInto: vi.fn(),` with:

```ts
  cloneInstanceInto: (...a: unknown[]) => cloneInstanceInto(...a),
```

- [ ] **Step 2: Replace the obsolete skip test with the new failing tests**

Delete the test `'createOfflineEffectsFunction skips wam entries with a warning'` and add:

```ts
  it('createOfflineEffectsFunction clones wam entries onto the offline context, wires and cleans up', async () => {
    const cloneDestroy = vi.fn();
    const cloneNode = { ctx: 'offline' };
    cloneInstanceInto.mockResolvedValueOnce({
      url: 'https://example.com/p/index.js',
      descriptor: { name: 'BigMuff' },
      audioNode: cloneNode,
      getState: vi.fn(),
      setState: vi.fn(),
      getParameterInfo: vi.fn(),
      destroy: cloneDestroy,
    });

    const { result } = renderHook(() => useDynamicEffects());
    await act(async () => {
      await result.current.addWamEffect('https://example.com/p/index.js');
    });

    const offline = result.current.createOfflineEffectsFunction();
    expect(offline).toBeDefined();

    const rawContext = { raw: 'offline' };
    const masterVolume = { context: { rawContext }, connect: vi.fn() } as unknown as Volume;
    const destination = { name: 'destination' } as unknown as ToneAudioNode;

    const cleanup = await offline!(masterVolume, destination, true);

    expect(ensureWamHost).toHaveBeenLastCalledWith(rawContext);
    expect(cloneInstanceInto).toHaveBeenCalledWith(
      expect.objectContaining({ audioNode: fakeAudioNode }),
      rawContext,
      'group-1'
    );
    expect(connect).toHaveBeenCalledWith(masterVolume, cloneNode);
    expect(connect).toHaveBeenCalledWith(cloneNode, destination);

    (cleanup as () => void)();
    expect(cloneDestroy).toHaveBeenCalled();
  });

  it('createOfflineEffectsFunction excludes bypassed wam entries (undefined when nothing remains)', async () => {
    const { result } = renderHook(() => useDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffect('https://example.com/p/index.js');
    });
    act(() => result.current.toggleBypass(id));
    expect(result.current.createOfflineEffectsFunction()).toBeUndefined();
  });

  it('the offline function rejects when the wam clone fails (fail-loud export)', async () => {
    cloneInstanceInto.mockRejectedValueOnce(new Error('factory exploded'));
    const { result } = renderHook(() => useDynamicEffects());
    await act(async () => {
      await result.current.addWamEffect('https://example.com/p/index.js');
    });
    const offline = result.current.createOfflineEffectsFunction();
    const masterVolume = { context: { rawContext: {} }, connect: vi.fn() } as unknown as Volume;
    const destination = {} as unknown as ToneAudioNode;
    await expect(offline!(masterVolume, destination, true)).rejects.toThrow('factory exploded');
  });

  it('the offline function rejects when wam entries exist on a standardized context (defensive guard)', async () => {
    const { result } = renderHook(() => useDynamicEffects());
    await act(async () => {
      await result.current.addWamEffect('https://example.com/p/index.js');
    });
    isNativeGlobalContext.mockReturnValue(false);
    const offline = result.current.createOfflineEffectsFunction();
    const masterVolume = { context: { rawContext: {} }, connect: vi.fn() } as unknown as Volume;
    const destination = {} as unknown as ToneAudioNode;
    await expect(offline!(masterVolume, destination, true)).rejects.toThrow(
      /nativeAudioContext: true/
    );
  });
```

- [ ] **Step 3: Run tests to verify the new ones fail**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/browser && npx vitest run src/__tests__/useDynamicEffectsWam.test.ts`
Expected: the four new tests FAIL (`createOfflineEffectsFunction()` currently returns `undefined` for WAM-only chains); the rest pass.

- [ ] **Step 4: Implement in `useDynamicEffects.ts`**

1. Add imports:

```ts
import { buildOfflineChain, connectOfflineChain } from '../effects/offlineChain';
import type { OfflineEffectsFunction } from './useExportWav';
```

2. In `UseDynamicEffectsReturn`, update the member and its doc:

```ts
  /**
   * Creates a fresh effects function for offline rendering. Native effects are
   * re-created on the offline context; WAM entries are re-instantiated from
   * their URL-cached factories with the live instance's state transferred.
   * The returned function may be async and may reject — a WAV export never
   * silently renders without an effect the live chain has.
   */
  createOfflineEffectsFunction: () => OfflineEffectsFunction | undefined;
```

3. Remove the stale line from `addWamEffect`'s doc comment: `* Note: WAM entries are skipped during offline WAV export (not supported yet).`

4. Replace the whole `createOfflineEffectsFunction` callback with:

```ts
  const createOfflineEffectsFunction = useCallback((): OfflineEffectsFunction | undefined => {
    // Bypassed entries are excluded offline: natives keep the existing
    // exclusion; WAM entries use disconnection bypass (parity with live).
    const nonBypassed = activeEffects.filter((e) => !e.bypassed);
    if (nonBypassed.length === 0) {
      return undefined;
    }
    const hasWam = nonBypassed.some((e) => e.kind === 'wam');

    return async (masterGainNode: Volume, destination: ToneAudioNode, _isOffline: boolean) => {
      if (hasWam && !isNativeGlobalContext()) {
        throw new Error(
          '[waveform-playlist] WAV export with WAM effects requires a native AudioContext. ' +
            'Call configureGlobalContext({ nativeAudioContext: true }) from ' +
            '@waveform-playlist/playout before any audio initialization.'
        );
      }
      // Tone nodes inside the offline build are created on the current
      // (offline) global context — its rawContext must host the WAM clones.
      const rawContext = masterGainNode.context.rawContext as unknown as BaseAudioContext;
      const { instances, dispose } = await buildOfflineChain(
        nonBypassed,
        (instanceId) => {
          const inst = effectInstancesRef.current.get(instanceId) as WamEffectInstance | undefined;
          return inst?.kind === 'wam' ? inst.plugin : undefined;
        },
        rawContext
      );
      connectOfflineChain(masterGainNode, instances, destination);
      return dispose;
    };
  }, [activeEffects]);
```

(`isNativeGlobalContext`, `WamEffectInstance`, `Volume`, `ToneAudioNode` are already imported in this file. The old body's `createEffectInstance` loop and manual wiring are fully replaced — if `createEffectInstance` then has no remaining use in this file, remove it from the import to satisfy `noUnusedLocals`; `addEffect` still uses it, so it should stay.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/browser && npx vitest run src/__tests__/useDynamicEffectsWam.test.ts`
Expected: PASS (all tests, including the three new ones).

- [ ] **Step 6: Typecheck and commit**

Run: `pnpm --filter @waveform-playlist/browser typecheck`
Expected: exit 0.

```bash
cd /Users/naomiaro/Code/waveform-playlist
git add packages/browser/src/hooks/useDynamicEffects.ts packages/browser/src/__tests__/useDynamicEffectsWam.test.ts
git commit -m "feat(browser): master offline effects render WAM entries via cloneInstanceInto"
```

---

### Task 5: WAM entries in the per-track offline factory (`useTrackDynamicEffects`)

**Files:**
- Modify: `packages/browser/src/hooks/useTrackDynamicEffects.ts`
- Test: `packages/browser/src/__tests__/useTrackDynamicEffectsWam.test.ts`

**Interfaces:**
- Consumes: `buildOfflineChain`, `connectOfflineChain` (Task 2); `OfflineTrackEffectsFunction` (Task 3). `TrackActiveEffect` satisfies `OfflineChainEntry` structurally.
- Produces: `UseTrackDynamicEffectsReturn.createOfflineTrackEffectsFunction: (trackId: string) => OfflineTrackEffectsFunction | undefined`.

- [ ] **Step 1: Update the test file mock + replace the skip test**

Same two mock edits as Task 4 Step 1 (`const cloneInstanceInto = vi.fn();` + deferred wrapper in the `vi.mock('@dawcore/wam', ...)` factory), applied to `useTrackDynamicEffectsWam.test.ts`.

Delete the test `'createOfflineTrackEffectsFunction skips wam entries with a warning'` and add (track-flavored; `Gain`-shaped `graphEnd` carries the context):

```ts
  it('createOfflineTrackEffectsFunction clones wam entries onto the offline context, wires and cleans up', async () => {
    const cloneDestroy = vi.fn();
    const cloneNode = { ctx: 'offline' };
    cloneInstanceInto.mockResolvedValueOnce({
      url: 'https://example.com/p/index.js',
      descriptor: { name: 'BigMuff' },
      audioNode: cloneNode,
      getState: vi.fn(),
      setState: vi.fn(),
      getParameterInfo: vi.fn(),
      destroy: cloneDestroy,
    });

    const { result } = renderHook(() => useTrackDynamicEffects());
    await act(async () => {
      await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });

    const offline = result.current.createOfflineTrackEffectsFunction('t1');
    expect(offline).toBeDefined();

    const rawContext = { raw: 'offline' };
    const graphEnd = { context: { rawContext }, connect: vi.fn() } as unknown as Gain;
    const masterGainNode = { name: 'master' } as unknown as ToneAudioNode;

    const cleanup = await offline!(graphEnd, masterGainNode, true);

    expect(ensureWamHost).toHaveBeenLastCalledWith(rawContext);
    expect(cloneInstanceInto).toHaveBeenCalledWith(
      expect.objectContaining({ audioNode: fakeAudioNode }),
      rawContext,
      'group-1'
    );
    expect(connect).toHaveBeenCalledWith(graphEnd, cloneNode);
    expect(connect).toHaveBeenCalledWith(cloneNode, masterGainNode);

    (cleanup as () => void)();
    expect(cloneDestroy).toHaveBeenCalled();
  });

  it('createOfflineTrackEffectsFunction excludes bypassed wam entries (undefined when nothing remains)', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    let id = '';
    await act(async () => {
      id = await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    act(() => result.current.toggleBypass('t1', id));
    expect(result.current.createOfflineTrackEffectsFunction('t1')).toBeUndefined();
  });

  it('the offline track function rejects when the wam clone fails (fail-loud export)', async () => {
    cloneInstanceInto.mockRejectedValueOnce(new Error('factory exploded'));
    const { result } = renderHook(() => useTrackDynamicEffects());
    await act(async () => {
      await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    const offline = result.current.createOfflineTrackEffectsFunction('t1');
    const graphEnd = { context: { rawContext: {} }, connect: vi.fn() } as unknown as Gain;
    const masterGainNode = {} as unknown as ToneAudioNode;
    await expect(offline!(graphEnd, masterGainNode, true)).rejects.toThrow('factory exploded');
  });

  it('the offline track function rejects when wam entries exist on a standardized context (defensive guard)', async () => {
    const { result } = renderHook(() => useTrackDynamicEffects());
    await act(async () => {
      await result.current.addWamEffectToTrack('t1', 'https://example.com/p/index.js');
    });
    isNativeGlobalContext.mockReturnValue(false);
    const offline = result.current.createOfflineTrackEffectsFunction('t1');
    const graphEnd = { context: { rawContext: {} }, connect: vi.fn() } as unknown as Gain;
    const masterGainNode = {} as unknown as ToneAudioNode;
    await expect(offline!(graphEnd, masterGainNode, true)).rejects.toThrow(
      /nativeAudioContext: true/
    );
  });
```

If the file doesn't already import `Gain`/`ToneAudioNode`/`connect` from `'tone'` for tests, extend its import to match (the file already imports from `'tone'` — check its header and reuse).

- [ ] **Step 2: Run tests to verify the new ones fail**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/browser && npx vitest run src/__tests__/useTrackDynamicEffectsWam.test.ts`
Expected: the four new tests FAIL; the rest pass.

- [ ] **Step 3: Implement in `useTrackDynamicEffects.ts`**

1. Add imports:

```ts
import { buildOfflineChain, connectOfflineChain } from '../effects/offlineChain';
import type { OfflineTrackEffectsFunction } from './useExportWav';
```

2. In `UseTrackDynamicEffectsReturn`, update the member and its doc:

```ts
  /**
   * Creates a fresh effects function for a track for offline rendering.
   * Native effects are re-created on the offline context; WAM entries are
   * re-instantiated with the live instance's state transferred. May reject —
   * a WAV export never silently renders without an effect the live chain has.
   */
  createOfflineTrackEffectsFunction: (trackId: string) => OfflineTrackEffectsFunction | undefined;
```

3. Remove the stale line from `addWamEffectToTrack`'s doc comment: `* Note: WAM entries are skipped during offline WAV export (not supported yet).`

4. Replace the whole `createOfflineTrackEffectsFunction` callback with:

```ts
  const createOfflineTrackEffectsFunction = useCallback(
    (trackId: string): OfflineTrackEffectsFunction | undefined => {
      const trackEffects = trackEffectsState.get(trackId) || [];
      // Bypassed entries are excluded offline: natives keep the existing
      // exclusion; WAM entries use disconnection bypass (parity with live).
      const nonBypassed = trackEffects.filter((e) => !e.bypassed);
      if (nonBypassed.length === 0) {
        return undefined;
      }
      const hasWam = nonBypassed.some((e) => e.kind === 'wam');

      return async (graphEnd: Gain, masterGainNode: ToneAudioNode, _isOffline: boolean) => {
        if (hasWam && !isNativeGlobalContext()) {
          throw new Error(
            '[waveform-playlist] WAV export with WAM effects requires a native AudioContext. ' +
              'Call configureGlobalContext({ nativeAudioContext: true }) from ' +
              '@waveform-playlist/playout before any audio initialization.'
          );
        }
        // Tone nodes inside the offline build are created on the current
        // (offline) global context — its rawContext must host the WAM clones.
        const rawContext = graphEnd.context.rawContext as unknown as BaseAudioContext;
        const { instances, dispose } = await buildOfflineChain(
          nonBypassed,
          (instanceId) => {
            const inst = trackEffectInstancesRef.current.get(trackId)?.get(instanceId) as
              | WamEffectInstance
              | undefined;
            return inst?.kind === 'wam' ? inst.plugin : undefined;
          },
          rawContext
        );
        connectOfflineChain(graphEnd, instances, masterGainNode);
        return dispose;
      };
    },
    [trackEffectsState]
  );
```

(`isNativeGlobalContext`, `WamEffectInstance`, `Gain`, `ToneAudioNode` are already imported. If `createEffectInstance` loses its offline use, it's still used by `addEffectToTrack` — keep it.)

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd /Users/naomiaro/Code/waveform-playlist/packages/browser && npx vitest run src/__tests__/useTrackDynamicEffectsWam.test.ts`
Expected: PASS.

- [ ] **Step 5: Run the FULL browser suite, typecheck, and commit**

Run: `pnpm --filter @waveform-playlist/browser typecheck && cd packages/browser && npx vitest run`
Expected: exit 0, all green. `pkill -f vitest` strays if any.

```bash
cd /Users/naomiaro/Code/waveform-playlist
git add packages/browser/src/hooks/useTrackDynamicEffects.ts packages/browser/src/__tests__/useTrackDynamicEffectsWam.test.ts
git commit -m "feat(browser): per-track offline effects render WAM entries via cloneInstanceInto"
```

---

### Task 6: documentation sweep

**Files:**
- Modify: `website/docs/wam-plugins.md` (line ~150, the "WAV export skips WAM entries" limitation bullet)
- Modify: `website/docs/react/api/hooks.md` (lines ~905 and ~951 — JSDoc mirrors of the two hooks)
- Audit: `website/docs/framework-agnostic/llm-reference.md`, `website/static/llms.txt`

**Interfaces:** none (docs only). Doc claims must match Task 3–5 behavior exactly.

- [ ] **Step 1: Rewrite the wam-plugins.md limitation bullet**

Replace the whole bullet starting `- **WAV export skips WAM entries** (follow-up planned). ...` with:

```markdown
- **WAV export renders WAM entries** (#536). `useExportWav()` renders on a native `OfflineAudioContext` wrapped in a Tone `OfflineContext` when native-context mode is active; `createOfflineEffectsFunction()` / `createOfflineTrackEffectsFunction()` re-instantiate each WAM plugin on the offline context from its URL-cached factory with the live instance's state (`getState()`) transferred at export time — the dawcore `exportAudio()` pattern. Bypassed WAM entries stay excluded (disconnection bypass, parity with live). A WAM plugin that fails to re-instantiate fails the export rather than silently rendering without it.
```

- [ ] **Step 2: Update the two JSDoc mirrors in hooks.md**

At both locations (~905 for `addWamEffect`, ~951 for `addWamEffectToTrack`), replace the line:

```
   * WAM entries are skipped during offline WAV export (not supported yet).
```

with:

```
   * WAM entries render in offline WAV export (re-instantiated on the offline context).
```

Then diff the surrounding interface blocks against the real source (`useDynamicEffects.ts` / `useTrackDynamicEffects.ts` after Tasks 4–5) and sync the `createOfflineEffectsFunction` / `createOfflineTrackEffectsFunction` signatures and docs if the page shows them.

- [ ] **Step 3: Audit the LLM doc surfaces**

Run: `grep -n "skip\|Tone.Offline\|createOffline\|ExportOptions\|effectsFunction" website/docs/framework-agnostic/llm-reference.md website/static/llms.txt`

- If `llm-reference.md` contains the `ExportOptions` interface or the hooks' return interfaces, update the two members to `OfflineEffectsFunction` / `OfflineTrackEffectsFunction` and add the three new type aliases verbatim from `useExportWav.ts`.
- If `llms.txt` mentions the WAM-export skip limitation, replace with one line: `WAV export renders WAM plugins offline (native OfflineAudioContext + state transfer).`
- If neither surface mentions export/WAM types, no change — note that in the commit message body.

- [ ] **Step 4: Verify docs build**

Run: `pnpm --filter website build`
Expected: build succeeds (pre-existing CSS calc warnings are harmless). Broken-link checker passes.

- [ ] **Step 5: Commit**

```bash
cd /Users/naomiaro/Code/waveform-playlist
git add website/docs/wam-plugins.md website/docs/react/api/hooks.md website/docs/framework-agnostic/llm-reference.md website/static/llms.txt
git commit -m "docs: WAM entries render in React WAV export (#536)"
```

(Drop unchanged files from `git add` as applicable.)

---

### Task 7: full verification + measured browser gate

**Files:** none created (verification only). Uses `website/src/pages/examples/wam-effects.tsx` (route `/examples/wam-effects`, component `website/src/components/examples/WamEffectsExample.tsx` — already wires `offlineMaster` + `trackFx.createOfflineTrackEffectsFunction` into `ExportControls`).

- [ ] **Step 1: Repo-wide checks**

```bash
cd /Users/naomiaro/Code/waveform-playlist
pnpm --filter @waveform-playlist/browser build
pnpm -w lint
```

Expected: build exit 0; lint exit 0 with `✖ … (0 errors, …)` — warnings are pre-existing (~359 `no-explicit-any`), errors must be 0. Remember: a prettier failure exits 1 with NO eslint summary → run `pnpm format` and re-lint. Do NOT run root `pnpm typecheck` (known pre-existing failure in `dawcore-midi`); the browser-filtered build already typechecked the touched package.

- [ ] **Step 2: Start the website dev server (background)**

```bash
pnpm --filter website start
```

Read the startup log for the actual port (default 3000). The WAM page needs network access to `webaudiomodules.com` (community plugin library).

- [ ] **Step 3: Browser gate — measured A/B export**

Via Playwright MCP on `http://localhost:3000/examples/wam-effects` (foreground semantics: assert on captured data, not rAF-driven UI):

1. Before navigation, install a blob-capture shim (`browser_run_code_unsafe` / `addInitScript`):
   ```js
   const orig = URL.createObjectURL.bind(URL);
   window.__exportedBlobs = [];
   URL.createObjectURL = (b) => { window.__exportedBlobs.push(b); return orig(b); };
   ```
2. Load the page; add a community WAM (burns-audio "Simple Delay" — audibly non-transparent by default; simpleDistortion's defaults are near-transparent) to the **master** chain via the page's picker.
3. Click **Export WAV**. Wait for `window.__exportedBlobs.length === 1`.
4. Toggle **bypass** on the WAM entry; export again; wait for length 2.
5. Decode both blobs in-page and compare:
   ```js
   async function rms(blob) {
     const ab = await blob.arrayBuffer();
     const ctx = new AudioContext();
     const buf = await ctx.decodeAudioData(ab);
     const ch = buf.getChannelData(0);
     let s = 0, d = 0;
     for (let i = 0; i < ch.length; i++) s += ch[i] * ch[i];
     await ctx.close();
     return { rms: Math.sqrt(s / ch.length), length: ch.length, buf };
   }
   ```
   Also compute per-sample diff RMS between export A (active) and B (bypassed).
   **Gate criteria:** both exports non-silent (rms > 0.001); diff RMS > 10% of B's rms (the delay audibly changed the render); no console errors containing `[waveform-playlist]` export failures.
6. Repeat steps 2–5 with the WAM on a **track** chain (per-track path).
7. Stop the dev server (TaskStop the background task).

If any gate criterion fails: STOP, use superpowers:systematic-debugging — do not weaken the criteria.

- [ ] **Step 4: Spec coverage self-check**

Re-read `docs/specs/2026-07-02-wam-export-react-design.md` § Decisions 1–8 and § Components table; confirm each maps to a landed commit. Confirm no `console.warn` skip messages remain: `grep -rn "skipped in WAV export\|not supported yet" packages/browser/src website/docs` → no hits.

- [ ] **Step 5: Final commit (if verification produced fixes)**

Commit any gate-driven fixes with `fix(browser): …` messages. The branch is then ready for the finishing flow (PR includes `git rm` of `docs/specs/2026-07-02-wam-export-react-design.md` and `docs/plans/2026-07-02-wam-export-react.md` per repo convention — PR description is the durable record).
