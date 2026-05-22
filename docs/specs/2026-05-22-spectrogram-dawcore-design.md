# Spectrogram render-mode for dawcore + framework-split

**Status:** Design — ready for implementation
**Date:** 2026-05-22
**Branch:** `spectrogram-dawcore-and-react-extract`
**Related:** [`web-components-migration.md`](./web-components-migration.md) (parent migration spec, see "Spectrogram & Piano-Roll" section)

## Summary

Add `render-mode="spectrogram"` support to `<daw-track>` in `@dawcore/components`, backed by a new framework-agnostic `@dawcore/spectrogram` package that contains the FFT computation, worker, and viewport-aware rendering orchestrator. The existing React surface (`SpectrogramProvider`, settings modal, menu items) stays in a slimmed-down `@waveform-playlist/spectrogram` package that depends on `@dawcore/spectrogram` and uses the orchestrator under the hood. End result: a single source of truth for spectrogram orchestration logic, shared between the dawcore Lit element and the React Provider, with no React dependencies in any `@dawcore/*` package.

## Goals

- `<daw-track render-mode="spectrogram">` works end-to-end with the same theming/CSS conventions as `<daw-waveform>` and `<daw-piano-roll>`.
- `SpectrogramConfig` API on `<daw-editor>` (global) and `<daw-track>` (per-track override, `null` = inherit) matching the parent migration spec.
- `daw-spectrogram-ready` event per-track when its viewport-tier chunks complete.
- Worker pool, generation-based abort, lazy per-batch FFT, 3-tier (viewport/buffer/remaining) classification, contiguous chunk grouping — all preserved from the React Provider's behavior, now reusable from both Lit and React via a shared orchestrator class.
- Two example pages: `examples/dawcore-native/spectrogram.html` and `examples/dawcore-tone/spectrogram.html`.
- React playlist library's spectrogram integration (`SpectrogramIntegrationContext`, `PlaylistVisualization`) keeps working with zero consumer-facing changes — `SpectrogramProvider` import path stays `@waveform-playlist/spectrogram`.
- No `@waveform-playlist/browser` changes. No transitive React dependency in any `@dawcore/*` package.

## Non-goals (deferred)

- `render-mode="split"` (spectrogram + waveform stacked per channel).
- Dawcore-native spectrogram settings UI (`<daw-spectrogram-settings>` element).
- Dawcore-native track context menu with spectrogram items.
- Renaming `@waveform-playlist/spectrogram` further — it stays under that name as the React-only host.

## Architecture

Four packages, top-down dependency order:

```
@waveform-playlist/browser  (React, unchanged)
        │ peer (existing)
@waveform-playlist/spectrogram  (React-only after slimming)
        │ dep (new)
@dawcore/spectrogram  (NEW package, framework-agnostic)
        │ dep
@dawcore/components  (adds <daw-spectrogram>, SpectrogramController)
```

Invariants:

- Nothing in `@dawcore/spectrogram` imports React or styled-components.
- Nothing in `@dawcore/components` imports React.
- `@waveform-playlist/browser` does not depend on any `@dawcore/*` package.
- The orchestration logic (~900 LOC) lives in exactly one place: `@dawcore/spectrogram`'s `SpectrogramOrchestrator` class. Both the React `SpectrogramProvider` and the Lit `SpectrogramController` are thin wrappers around it.

## `@dawcore/spectrogram` — new package

**Name:** `@dawcore/spectrogram`
**Initial version:** `0.0.1` (matches `@dawcore/*` family alpha versioning)
**Build:** tsup, ESM + CJS + DTS, multi-entry (main, `./worker/spectrogram.worker`, `./orchestrator`).
**Dependencies:** `@waveform-playlist/core` (for `SpectrogramConfig` type), `fft.js`.
**Peer/dev dependencies:** none related to React.

### Files

```
packages/dawcore-spectrogram/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── README.md
├── src/
│   ├── index.ts                — exports computation + worker + orchestrator
│   ├── computation/            — MOVED from @waveform-playlist/spectrogram, unchanged
│   │   ├── colorMaps.ts
│   │   ├── computeSpectrogram.ts
│   │   ├── fft.ts
│   │   ├── frequencyScales.ts
│   │   ├── windowFunctions.ts
│   │   └── index.ts
│   ├── worker/                 — MOVED, unchanged
│   │   ├── createSpectrogramWorker.ts
│   │   ├── createSpectrogramWorkerPool.ts
│   │   ├── spectrogram.worker.ts
│   │   └── index.ts
│   ├── orchestrator/           — NEW (extracted from SpectrogramProvider.tsx)
│   │   ├── index.ts
│   │   ├── SpectrogramOrchestrator.ts
│   │   ├── viewport-classify.ts
│   │   ├── chunk-grouping.ts
│   │   ├── color-lut-cache.ts
│   │   └── events.ts
│   └── types/
│       └── fft.js.d.ts         — MOVED, unchanged
└── __tests__/                  — MOVED test files + new orchestrator tests
```

### Package exports

```json
{
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "import": "./dist/index.mjs",
      "require": "./dist/index.js"
    },
    "./worker/spectrogram.worker": {
      "import": "./dist/worker/spectrogram.worker.mjs"
    },
    "./orchestrator": {
      "types": "./dist/orchestrator/index.d.ts",
      "import": "./dist/orchestrator/index.mjs"
    }
  },
  "sideEffects": false
}
```

### `SpectrogramOrchestrator`

Framework-agnostic class. Extends `EventTarget`. Owns the worker pool and all viewport/abort/tier logic that lives in `SpectrogramProvider.tsx` today.

```typescript
export interface SpectrogramOrchestratorOptions {
  /** Caller-supplied factory so the consumer's bundler sees `new URL(...)`. */
  workerFactory: () => Worker;
  /** Default: 2 (one per stereo channel). Capped at min(poolSize, channelCount). */
  workerPoolSize?: number;
  /** Merged config (host computes merge of library defaults + editor + track). */
  config: SpectrogramConfig;
  /** Default: window.devicePixelRatio || 1 */
  devicePixelRatio?: number;
}

export interface ClipRegistration {
  clipId: string;
  trackId: string;
  channelData: Float32Array[];
  sampleRate: number;
  durationSamples: number;
  offsetSamples: number;
}

export interface CanvasRegistration {
  /** Convention: `${clipId}-ch${channelIndex}-chunk${chunkIndex}`. */
  canvasId: string;
  canvas: OffscreenCanvas;
  clipId: string;
  trackId: string;
  channelIndex: number;
  chunkIndex: number;
  /** x-position in the full-clip pixel space (relative to clip start). */
  globalPixelOffset: number;
  widthPx: number;
  heightPx: number;
}

export interface ViewportState {
  /** Visible scroll viewport, in editor pixel space. */
  visibleStartPx: number;
  visibleEndPx: number;
  /** 1.5× overscan band, in editor pixel space. */
  bufferStartPx: number;
  bufferEndPx: number;
  samplesPerPixel: number;
}

export class SpectrogramOrchestrator extends EventTarget {
  constructor(opts: SpectrogramOrchestratorOptions);

  registerClip(reg: ClipRegistration): void;
  unregisterClip(clipId: string): void;

  registerCanvas(reg: CanvasRegistration): void;
  unregisterCanvas(canvasId: string): void;

  setConfig(config: SpectrogramConfig): void;
  setViewport(state: ViewportState): void;
  setDevicePixelRatio(dpr: number): void;

  dispose(): void;
}
```

**Events emitted** (as `CustomEvent` on the orchestrator):

| Event | Detail | When |
|-------|--------|------|
| `viewport-ready` | `{ trackId: string }` | All viewport-tier chunks for `trackId` have rendered. Fires once per track per viewport-change "generation". |

Other internal state (config-applied, generation aborted) is not surfaced as public events — hosts react via promise-resolution implicitly through `setViewport` / `setConfig` calls.

**Internal responsibilities** (carried over from `SpectrogramProvider.tsx`):

1. **Worker pool lifecycle.** Constructor creates `workerPoolSize` workers via `workerFactory()`. `dispose()` calls `pool.terminate()`.
2. **Color LUT cache.** `Map<colorMapName, Uint8Array>` so the LUT isn't recomputed on every render call.
3. **Generation counter.** Incremented on `setViewport` / `setConfig`. Passed to `worker.computeFFT` / `renderChunks`. `abortGeneration(prev)` called for the old one.
4. **3-tier viewport classification** (`viewport-classify.ts`). Given canvases + viewport, partition into:
   - viewport (intersects exact scroll viewport — fast first paint)
   - buffer (intersects 1.5× overscan but outside viewport — prevents black chunks on scroll)
   - remaining (outside overscan — rendered via `requestIdleCallback`)
5. **Lazy per-batch FFT.** `computeFFTForChunks(canvases, group)` computes sample range `[min(chunk.startSample), max(chunk.endSample) + windowSize]`. Never computes full-clip FFT.
6. **Contiguous chunk grouping** (`chunk-grouping.ts`). `groupContiguousIndices()` for non-adjacent canvases so they compute as separate batches, preventing the indices=`[0,3,4,5]`→chunks=`[10,14,15,11]` spanning-FFT regression noted in the existing spectrogram CLAUDE.md.
7. **Phase sequencing.** Phase 1a (viewport) → 1b (buffer) → 2 (remaining). Phase 2 uses `requestIdleCallback` with `setTimeout(0)` fallback.
8. **`viewport-ready` per-track.** Fires once per track when all its viewport-tier chunks complete. Tracks completion by counting per-track viewport chunk responses.

**What does NOT belong in the orchestrator:**

- Canvas mounting/unmounting (DOM concerns — host's job).
- Scroll listening (host-supplied via `setViewport`).
- Audio-buffer discovery (host registers clips).
- Settings UI.

### Worker module URL strategy

The orchestrator does not create workers internally. The consumer passes a `workerFactory` so the `new URL(..., import.meta.url)` syntax lives at the consumer's call site, where the consumer's bundler can hoist and emit the worker bundle correctly. This matches the existing convention in the codebase.

Example call site in `@dawcore/components`:

```typescript
const orchestrator = new SpectrogramOrchestrator({
  workerFactory: () => new Worker(
    new URL('@dawcore/spectrogram/worker/spectrogram.worker', import.meta.url),
    { type: 'module' }
  ),
  workerPoolSize: 2,
  config,
});
```

The `./worker/spectrogram.worker` subpath export already exists in the current `@waveform-playlist/spectrogram` package.json and moves with the worker file.

## `@waveform-playlist/spectrogram` — slimmed package

**Name:** unchanged (`@waveform-playlist/spectrogram`).
**Version bump:** `12.0.0` → `12.1.0` (minor — internals shrink, public API unchanged).
**Dependencies (added):** `@dawcore/spectrogram: workspace:*`.
**Dependencies (removed):** `fft.js` (moved to `@dawcore/spectrogram`).

### Files after slim

```
packages/spectrogram/
├── package.json
├── tsconfig.json
├── src/
│   ├── index.ts                 — re-exports for backwards compat
│   ├── SpectrogramProvider.tsx  — reworked to wrap SpectrogramOrchestrator
│   ├── components/
│   │   ├── SpectrogramMenuItems.tsx     — unchanged
│   │   ├── SpectrogramSettingsModal.tsx — unchanged
│   │   ├── types.ts                     — unchanged
│   │   └── index.ts                     — unchanged
│   └── styled.d.ts              — unchanged
└── __tests__/
    └── SpectrogramProvider.test.tsx     — new (Provider→Orchestrator boundary)
```

### Files removed (moved to `@dawcore/spectrogram`)

- `src/computation/**` (entire directory)
- `src/worker/**` (entire directory)
- `src/types/fft.js.d.ts`
- `__tests__/colorMaps.test.ts`
- `__tests__/fft.test.ts`
- `__tests__/frequencyScales.test.ts`
- `__tests__/windowFunctions.test.ts`
- `__tests__/createSpectrogramWorker.test.ts`
- `__tests__/createSpectrogramWorkerPool.test.ts`

### Backwards-compatible re-exports

Existing public API is preserved by re-exporting from `@dawcore/spectrogram`:

```typescript
// packages/spectrogram/src/index.ts
export {
  computeSpectrogram,
  computeSpectrogramMono,
  getColorMap,
  getFrequencyScale,
} from '@dawcore/spectrogram';
export type { FrequencyScaleName } from '@dawcore/spectrogram';
export {
  createSpectrogramWorker,
  SpectrogramAbortError,
  createSpectrogramWorkerPool,
} from '@dawcore/spectrogram';
export type { SpectrogramWorkerApi } from '@dawcore/spectrogram';

export { SpectrogramMenuItems } from './components';
export type { SpectrogramMenuItemsProps } from './components';
export { SpectrogramSettingsModal } from './components';
export type { SpectrogramSettingsModalProps } from './components';
export type { TrackMenuItem } from './components';

export { SpectrogramProvider } from './SpectrogramProvider';
export type { SpectrogramProviderProps } from './SpectrogramProvider';
```

Note: this is the *only* approved cross-package re-export pattern in the codebase (CLAUDE.md "No Cross-Package Re-Exports" rule). It is justified here as a backwards-compat shim during a structural extraction — consumers can migrate to `@dawcore/spectrogram` for the computation/worker primitives over time. Mark the re-exports as `@deprecated` in JSDoc with a pointer to the new package.

### `SpectrogramProvider.tsx` rework

Before: 905 lines containing both orchestration logic and React Context plumbing.
After: ~150–200 lines of React glue around `SpectrogramOrchestrator`.

Sketch:

```typescript
export interface SpectrogramProviderProps { /* unchanged */ }

export const SpectrogramProvider: FC<SpectrogramProviderProps> = ({ children, ...config }) => {
  const orchestrator = useMemo(() => new SpectrogramOrchestrator({
    workerFactory: () => new Worker(
      new URL('@waveform-playlist/spectrogram/worker/spectrogram.worker', import.meta.url),
      { type: 'module' }
    ),
    workerPoolSize: config.workerPoolSize ?? 2,
    config: mergeWithDefaults(config),
  }), []);

  useEffect(() => orchestrator.setConfig(mergeWithDefaults(config)), [/* config deps */]);

  // Audio-buffer subscription (was inline in old Provider; same logic, calls orchestrator now)
  const audioBuffers = useAudioBuffers();
  useEffect(() => {
    for (const [clipId, info] of audioBuffers) {
      orchestrator.registerClip({ clipId, trackId: info.trackId, channelData: info.channels,
                                  sampleRate: info.sampleRate, durationSamples: info.duration,
                                  offsetSamples: info.offset });
    }
    return () => { for (const [clipId] of audioBuffers) orchestrator.unregisterClip(clipId); };
  }, [audioBuffers]);

  // Scroll viewport (was inline; same logic, calls orchestrator now)
  // useEffect listens on scroll container, calls orchestrator.setViewport()

  useEffect(() => () => orchestrator.dispose(), []);

  // Context shape unchanged — useSpectrogramIntegration() consumers see the same API
  const contextValue = useMemo(() => ({
    registerCanvas: (...args) => orchestrator.registerCanvas(...args),
    unregisterCanvas: (...args) => orchestrator.unregisterCanvas(...args),
    openSettings: () => setSettingsOpen(true),
    onTrackMenuOpen: ...,
  }), [orchestrator]);

  return <SpectrogramIntegrationContext.Provider value={contextValue}>
    {children}
    {settingsOpen && <SpectrogramSettingsModal .../>}
  </SpectrogramIntegrationContext.Provider>;
};
```

The context value shape (`registerCanvas`, `unregisterCanvas`, `openSettings`, `onTrackMenuOpen`) is unchanged. `PlaylistVisualization.tsx` and `SpectrogramIntegrationContext.tsx` in `@waveform-playlist/browser` need no changes.

## `@dawcore/components` — Lit element + controller

### `TrackRenderMode` extension

```typescript
// packages/dawcore/src/types.ts
export type TrackRenderMode = 'waveform' | 'piano-roll' | 'spectrogram';
```

`'split'` is deferred.

### `<daw-spectrogram>` Lit element

New file: `packages/dawcore/src/elements/daw-spectrogram.ts`.

Mirrors `<daw-waveform>` and `<daw-piano-roll>` patterns: Shadow DOM, chunked 1000px canvases, virtual scrolling via `getVisibleChunkIndices` from `utils/viewport.ts`, validated numeric properties (`@property({ noAccessor: true })` + custom setter rejecting NaN/Infinity/zero/negative — project standard).

```typescript
@customElement('daw-spectrogram')
export class DawSpectrogramElement extends LitElement {
  @property({ attribute: false }) clipId = '';
  @property({ attribute: false }) trackId = '';
  @property({ attribute: false }) channelIndex = 0;
  @property({ type: Number, attribute: false }) length = 0;
  @property({ type: Number, attribute: false }) waveHeight = 128;

  @property({ type: Number, noAccessor: true })
  get samplesPerPixel(): number { return this._samplesPerPixel; }
  set samplesPerPixel(value: number) { /* validate, warn, then update */ }
  private _samplesPerPixel = 1024;

  @property({ type: Number, noAccessor: true })
  get sampleRate(): number { return this._sampleRate; }
  set sampleRate(value: number) { /* validate, warn, then update */ }
  private _sampleRate = 44100;

  @property({ type: Number, attribute: false }) clipOffsetSeconds = 0;
  @property({ type: Number, attribute: false }) visibleStart = -Infinity;
  @property({ type: Number, attribute: false }) visibleEnd = Infinity;
  @property({ type: Number, attribute: false }) originX = 0;

  // Lifecycle: build chunk canvases when length/samplesPerPixel changes;
  // transfer each to OffscreenCanvas; walk up to closest <daw-editor>;
  // call editor._spectrogramController.registerCanvas() per chunk.
  // Unregister on disconnect / chunk rebuild.
}
```

No `peaks` property — spectrogram does its own FFT off the AudioBuffer that the editor already caches in `_clipBuffers`.

### Editor render template change

Around `packages/dawcore/src/elements/daw-editor.ts:2302`:

```typescript
${t.descriptor?.renderMode === 'piano-roll'
  ? html`<daw-piano-roll ...></daw-piano-roll>`
  : t.descriptor?.renderMode === 'spectrogram'
  ? channels.map(
      (_, chIdx) => html`<daw-spectrogram
        style="position:absolute;left:0;top:${hdrH + chIdx * chH}px;"
        .clipId=${clip.id}
        .trackId=${t.trackId}
        .channelIndex=${chIdx}
        .length=${peakData?.length ?? width}
        .waveHeight=${chH}
        .samplesPerPixel=${this._renderSpp}
        .sampleRate=${this.effectiveSampleRate}
        .clipOffsetSeconds=${(clip.offsetSamples ?? 0) / this.effectiveSampleRate}
        .visibleStart=${this._viewport.visibleStart}
        .visibleEnd=${this._viewport.visibleEnd}
        .originX=${clipLeft}
      ></daw-spectrogram>`
    )
  : channels.map(/* existing <daw-waveform> ... */)}
```

The `channels.length` derivation already used by `<daw-waveform>` flows through unchanged.

### `SpectrogramController` — Lit reactive controller on `<daw-editor>`

New file: `packages/dawcore/src/controllers/spectrogram-controller.ts`.

Bridges editor state to the orchestrator. Same role as `RecordingController` / `ViewportController` on the editor.

```typescript
export class SpectrogramController implements ReactiveController {
  private host: SpectrogramControllerHost;
  private orchestrator: SpectrogramOrchestrator | null = null;
  private mergedConfig: SpectrogramConfig = {};

  constructor(host: SpectrogramControllerHost) {
    this.host = host;
    this.host.addController(this);
  }

  hostConnected() { /* defer orchestrator creation to first use */ }
  hostDisconnected() { this.dispose(); }

  setEditorConfig(config: SpectrogramConfig | null): void;       // global
  setTrackConfig(trackId: string, config: SpectrogramConfig | null): void;
  registerClipAudio(reg: ClipRegistration): void;
  unregisterClipAudio(clipId: string): void;
  registerCanvas(reg: CanvasRegistration): void;
  unregisterCanvas(canvasId: string): void;
  setViewport(state: ViewportState): void;
  dispose(): void;

  private _ensureOrchestrator(): SpectrogramOrchestrator { /* lazy create */ }
  private _mergeConfig(trackId: string): SpectrogramConfig { /* defaults → editor → track */ }
}
```

**Lazy lifecycle.** Orchestrator created on first `registerCanvas` (or first `registerClipAudio` after the controller knows about a spectrogram-mode track). Disposed when the last spectrogram-mode track is removed or changes mode.

**Config merging.** Three-level: library defaults → `editor.spectrogramConfig` → `track.spectrogramConfig`. Each level is shallow-merged with the level above; `null` at any level means "inherit from parent" (skip merge).

**Audio data plumbing.** Editor's `_clipBuffers: Map<string, AudioBuffer>` already exists and is populated during track load. When a spectrogram-mode track's clip's AudioBuffer arrives (or already exists at the moment the track switches into spectrogram mode), call `controller.registerClipAudio()` with the channel arrays.

**Viewport forwarding.** Subscribe to the editor's existing `ViewportController`. Forward each scroll/zoom change to `orchestrator.setViewport()`. The orchestrator handles the rest (3-tier classify, abort old generation, render).

**Ready event.** Listen for `'viewport-ready'` on the orchestrator's EventTarget; dispatch `daw-spectrogram-ready` (CustomEvent, `detail: { trackId }`, bubbles, composed) from the editor element.

### `editor.spectrogramConfig` property

```typescript
// On <daw-editor>
@property({ attribute: false })
spectrogramConfig: SpectrogramConfig | null = null;   // null = library defaults
```

Setter forwards to `_spectrogramController?.setEditorConfig(value)`.

### `track.spectrogramConfig` property

```typescript
// On <daw-track>
@property({ attribute: false })
spectrogramConfig: SpectrogramConfig | null = null;   // null = inherit from editor
```

Editor reads this off the `<daw-track>` element on `daw-track-update` and forwards via `controller.setTrackConfig(trackId, value)`.

### Triggers for `_ensureSpectrogramController()`

Any of the following creates the controller if it doesn't exist:

1. `<daw-track>` parses with `render-mode="spectrogram"` → `daw-track-connected` handler.
2. Existing `<daw-track>` mutates `render-mode` → spectrogram → `daw-track-update` handler.
3. `editor.addTrack({ renderMode: 'spectrogram' })`.
4. `editor.updateTrack(id, { renderMode: 'spectrogram' })`.

Disposal trigger: `_onTrackRemoved` / `_onTrackUpdated` counts remaining tracks with `renderMode === 'spectrogram'`; if zero, `this._spectrogramController.dispose()` + null it out.

### CSS theming

New custom properties on `<daw-editor>` (inherited through Shadow DOM):

| Property | Default | Purpose |
|----------|---------|---------|
| `--daw-spectrogram-background` | `#000` | Canvas background behind the rendered spectrogram |

Color map selection is data, not theme — handled via `spectrogramConfig.colorMap`, not CSS.

## Events

| Event | Detail | Source | When |
|-------|--------|--------|------|
| `daw-spectrogram-ready` | `{ trackId: string }` | `<daw-editor>` | Visible-viewport FFT for `trackId` complete |

`bubbles: true, composed: true` — same convention as other `daw-*` events.

Added to `DawEventMap` in `packages/dawcore/src/events.ts`.

## Example pages

### `examples/dawcore-native/spectrogram.html`

Uses `NativePlayoutAdapter`. Demonstrates:

- Declarative `render-mode="spectrogram"` mixed with waveform-mode tracks (visual control).
- Runtime mutation of `editor.spectrogramConfig` (color map, frequency scale, FFT size selects).
- `daw-spectrogram-ready` event logged to a status div.

See section 7 of the brainstorming notes for the full HTML (omitted here for brevity, included in the implementation PR).

### `examples/dawcore-tone/spectrogram.html`

Same shape, swap `createNativeAdapter` for `createToneAdapter`. Demonstrates spectrogram is adapter-agnostic.

### React docs demo

`website/src/components/examples/MirSpectrogramExample.tsx` — no file change. `SpectrogramProvider` is still imported from `@waveform-playlist/spectrogram`. The Provider's internals change (now wraps the orchestrator), but the prop surface is identical.

## Migration plan / phasing

The branch is large enough to warrant phased commits, but small enough for a single PR. Suggested commit order:

1. **Create `@dawcore/spectrogram` package skeleton.** New directory, package.json, tsconfig, tsup config. Empty `src/index.ts`.
2. **Move computation + worker.** Cut files from `packages/spectrogram/src/computation/`, `src/worker/`, `src/types/`, and matching tests. Paste into `packages/dawcore-spectrogram/src/`. Update internal import paths. Verify the 6 existing tests pass at the new location.
3. **Add `@waveform-playlist/spectrogram` re-exports.** Slim `packages/spectrogram/src/index.ts` to re-export from `@dawcore/spectrogram`. Add dependency to `@waveform-playlist/spectrogram`'s package.json. Verify `MirSpectrogramExample` builds.
4. **Extract `SpectrogramOrchestrator`.** Lift orchestration logic from `SpectrogramProvider.tsx` into `packages/dawcore-spectrogram/src/orchestrator/`. Add unit tests for `viewport-classify`, `chunk-grouping`, lifecycle.
5. **Rework `SpectrogramProvider`.** Replace inline logic with calls to `SpectrogramOrchestrator`. Verify React playlist + MIR demo still work.
6. **Extend `TrackRenderMode` and `<daw-track>` properties.** Add `'spectrogram'` to the union. Add `spectrogramConfig` property to `<daw-track>` and `<daw-editor>`. No element yet — just type and property surface.
7. **Implement `<daw-spectrogram>` element + `SpectrogramController`.** New element following `<daw-waveform>` patterns. Controller wires editor state to orchestrator. Editor render-template branch.
8. **Add `daw-spectrogram-ready` event** to `DawEventMap`. Wire controller emit.
9. **Add `examples/dawcore-native/spectrogram.html`.** Verify visually with `pnpm example:dawcore-native`.
10. **Add `examples/dawcore-tone/spectrogram.html`.** Verify with `pnpm example:dawcore-tone`.
11. **E2E tests.** `e2e/dawcore-spectrogram.spec.ts`.

Each step typechecks + tests in isolation. CI runs `pnpm build` + `pnpm lint` per the existing pipeline.

## Testing

### Unit tests (vitest)

`@dawcore/spectrogram` `__tests__/`:

- Existing 6 tests (computation, worker, worker pool) — migrate as-is.
- NEW `orchestrator.test.ts` — tier classification, contiguous grouping, generation aborts, dispose-terminates-pool, viewport-ready fires once per track per generation. Mock worker factory to return an `EventTarget` that fakes `onmessage`.
- NEW `viewport-classify.test.ts` — pure function tests for 3-tier classifier.
- NEW `chunk-grouping.test.ts` — pure function tests for contiguous grouping. Include the `indices=[0,3,4,5]→chunks=[10,14,15,11]` fixture from the existing spectrogram CLAUDE.md.

`@dawcore/components` `__tests__/`:

- NEW `daw-spectrogram.test.ts` — happy-dom unit tests. Mock OffscreenCanvas. Verify render-mode branch in editor renders `<daw-spectrogram>` for each channel; verify controller create/dispose lifecycle on render-mode change; verify config merge precedence (library defaults → editor → track).

`@waveform-playlist/spectrogram` `__tests__/`:

- NEW `SpectrogramProvider.test.tsx` — Provider→Orchestrator boundary tests. Mock `SpectrogramOrchestrator`. Verify `useEffect` deps call `setConfig`, audio buffers route to `registerClip`, scroll subscription calls `setViewport`.

### E2E tests (Playwright)

`e2e/dawcore-spectrogram.spec.ts`:

- Page: `examples/dawcore-native/spectrogram.html`
- Assert `<daw-spectrogram>` elements present per channel for spectrogram-mode tracks; absent for waveform-mode tracks (sibling control).
- Wait for `daw-spectrogram-ready` event via `page.evaluate` listener; assert it fires per track.
- Change color map via `<select>`, assert canvas pixel content changes (compare hash of a small region pre/post).
- Verify `editor.spectrogramConfig = null` resets to defaults.

Existing MIR Playwright tests should keep passing (Provider's prop surface unchanged).

### Visual smoke

`pnpm --filter website build` — confirm MIR docs page still renders.

## Open questions

1. **MIDI clip late-append parity.** Per dawcore CLAUDE.md, late-appended `<daw-clip>` elements with `midiNotes` silently no-op. Audio late-append works. Spectrogram should follow the audio path, but worth an explicit test.
2. **`MirSpectrogramExample` parity check.** The existing MIR demo may exercise quirks of the old `SpectrogramProvider` (scroll-during-MIR-overlay edge cases). Verify the docs page renders identically before/after the Provider rework.
3. **Variable-tempo spectrogram alignment.** The orchestrator works in pixel space, which should be fine for beats mode (the editor's `_renderSpp` handles conversion). Verify during implementation, not now.
4. **`@dawcore/spectrogram` README content.** Pure-tooling concern; separate publishing-prep PR.
5. **Pre-existing transitive React deprecation messaging.** The `@waveform-playlist/spectrogram` re-exports of `computeSpectrogram` / `createSpectrogramWorker` etc. should be marked `@deprecated` with a pointer to `@dawcore/spectrogram`. Decide whether to remove them in a future major.

## Out of scope (deferred to follow-ups)

- `render-mode="split"` — spectrogram + waveform stacked per channel. Separate PR; needs coordinated chunked rendering across two canvases per channel.
- `<daw-spectrogram-settings>` Lit element — dawcore equivalent of `SpectrogramSettingsModal`.
- Dawcore right-click track context menu (spectrogram items). Blocked on the broader `project_clip_context_menu` work.
- `@waveform-playlist/spectrogram` rename — stays under that name. The migration spec's eventual rename to `@dawcore/spectrogram` is now satisfied (differently): there is a `@dawcore/spectrogram` package; the React surface is a separate React-named package.
- MIDI/empty-audio clip guard on spectrogram render-mode (no-op if no audio). Trivial but should be a test.
