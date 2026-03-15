# dawcore Phase 1: Foundation — Design Spec

**Date:** 2026-03-13
**Status:** Approved
**Branch:** `feat/dawcore-phase1` (from `main`)
**Spec:** `docs/specs/web-components-migration.md` (on `feat/web-components-spec` branch)

---

## Goal

Build a working vertical slice of the dawcore Web Components library: one audio file playing with a visible waveform, animated playhead, time ruler, and transport controls. This validates the full architecture — Lit elements wrapping the existing engine/playout packages — before building out the remaining elements.

## Scope

**In scope (Phase 1 MVP):**

- Package scaffolding (`packages/dawcore`, tsup, Lit, TypeScript)
- `<daw-editor>` — engine + playout lifecycle, child discovery, audio loading, peak generation
- `<daw-track>` — declarative track data element
- `<daw-clip>` — declarative clip data element
- `<daw-waveform>` — chunked canvas rendering with virtual scrolling
- `<daw-playhead>` — RAF-animated position line
- `<daw-ruler>` — time ruler with tick marks and labels
- `<daw-transport>` — container linking to editor via `for` attribute
- `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>`
- CSS custom properties theme system
- Standalone dev page (`dev/index.html` served by Vite)

**Out of scope (later phases):**

- Recording, `<daw-player>`, accessibility, keyboard shortcuts, file drop
- Drag/trim/split interactions
- Track controls (volume, pan, mute, solo sliders/buttons)
- Effects, spectrogram, MIDI, annotations, undo/redo

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Package location | `packages/dawcore` in existing monorepo | Shares tooling, workspace references to engine/core/playout |
| Package count | Single `@dawcore/components` | Simpler to manage; split later if needed |
| npm scope | `@dawcore` (new scope, must be claimed on npm) | Rebranding per migration spec; `@waveform-playlist` stays for existing packages |
| Dependency strategy | Direct `workspace:*` to existing packages | Engine, core, playout are already framework-agnostic |
| MVP scope | Playback + transport (option C) | Validates architecture and `for` attribute wiring |
| Implementation approach | Vertical slice (option C) | Working demo early, surfaces integration issues fast |
| Dev environment | Standalone HTML + Vite | Purest Web Components test, no framework overhead |

---

## Architecture

### Package Structure

```
packages/dawcore/
├── package.json
├── tsconfig.json
├── tsup.config.ts
├── vitest.config.ts
├── src/
│   ├── index.ts                # Registers all elements, exports types
│   ├── elements/
│   │   ├── daw-editor.ts
│   │   ├── daw-track.ts
│   │   ├── daw-clip.ts
│   │   ├── daw-waveform.ts
│   │   ├── daw-playhead.ts
│   │   ├── daw-ruler.ts
│   │   ├── daw-transport.ts
│   │   ├── daw-play-button.ts
│   │   ├── daw-pause-button.ts
│   │   └── daw-stop-button.ts
│   ├── controllers/
│   │   ├── engine-controller.ts
│   │   ├── animation-controller.ts
│   │   └── viewport-controller.ts
│   ├── utils/
│   │   ├── peak-rendering.ts   # Ported from ui-components
│   │   ├── time-format.ts      # Ported from ui-components
│   │   └── smart-scale.ts      # Ported from ui-components
│   ├── workers/
│   │   └── peaks-worker.ts     # Reused from browser package
│   └── styles/
│       └── theme.ts            # CSS custom property defaults
└── dev/
    └── index.html              # Dev server page
```

### Dependencies

```json
{
  "name": "@dawcore/components",
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
    "@waveform-playlist/playout": "workspace:*"
  }
}
```

Engine, core, and playout appear in both `peerDependencies` (for consumers) and `devDependencies` (for pnpm build ordering). tsup auto-externalizes both `dependencies` and `peerDependencies`, including cross-scope packages like `@waveform-playlist/*`.

The existing `pnpm-workspace.yaml` already includes `packages/*`, so `packages/dawcore` is automatically part of the workspace.

### Build

Same tsup pattern as all other packages:

```typescript
// tsup.config.ts
export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
});
```

Build script: `"build": "pnpm typecheck && tsup"`

---

## Element Communication

### Downward (editor → children)

Child elements find their parent editor via `this.closest('daw-editor')`. Standard Web Components pattern — no registry, no context API.

### Upward (children → editor)

Custom DOM events bubble up. `<daw-track>` dispatches `daw-track-update` when attributes change; `<daw-editor>` listens.

### Lateral (transport → editor)

`<daw-transport for="editor-id">` resolves via `document.getElementById()`. Transport button elements find their transport parent via `this.closest('daw-transport')`, then access the linked target.

### Lit Reactive Controllers

Shared behavior patterns extracted into composable controllers:

**EngineController** — Provides engine access to child elements. Resolves editor via `closest()`, subscribes to state changes on connect, unsubscribes on disconnect.

**AnimationController** — Manages a `requestAnimationFrame` loop. Provides `start(callback)` and `stop()`. Auto-stops in `hostDisconnected()`.

**ViewportController** — Tracks scroll position for virtual scrolling. Listens to scroll events on the editor's scroll container, exposes `visibleStart`/`visibleEnd` for chunk visibility computation.

---

## Element Details

### `<daw-editor>` — Root Element

**Responsibilities:**

1. Create `PlaylistEngine` + playout adapter via `createToneAdapter()` factory in `connectedCallback()`
2. Discover child `<daw-track>` / `<daw-clip>` elements via `MutationObserver`
3. Fetch + decode audio from clip `src` attributes (URL-keyed cache)
4. Generate peaks via Web Worker (AudioBuffer-keyed cache via `WeakMap`)
5. Re-extract peaks from cached `WaveformData` on zoom change (fast path)
6. Expose playback methods: `play()`, `pause()`, `stop()`, `seekTo()`
7. Dispatch events: `daw-ready`, `daw-play`, `daw-pause`, `daw-stop`, `daw-timeupdate`
8. Subscribe to engine `statechange` for track mutations
9. Guard AudioContext initialization — first `play()` call awaits `engine.init()` (resumes AudioContext after user gesture), subsequent calls skip. Uses `_audioInitialized` flag.

**Method naming:** The editor exposes `seekTo(time)` (matching the Web Components spec), which wraps `engine.seek(time)` internally. This follows the existing browser package convention where the consumer-facing name is `seekTo` and the engine method is `seek`.

**Reactive properties (attributes):** `samples-per-pixel`, `wave-height`, `timescale`, `mono`, `bar-width`, `bar-gap`

**Internal state:** `_tracks`, `_peaksData`, `_isPlaying`, `_currentTime`, `_duration`, `_totalWidth`

**Non-reactive:** `_engine`, `_audioCache`, `_peaksCache`, `_observer`, `_audioInitialized`

**Audio loading pipeline:**

1. `_discoverTracks()` walks child elements, builds `ClipTrack[]`
2. For each clip `src`: check `_audioCache`, if miss → fetch + decode + cache
3. Once decoded: generate `WaveformData` via worker (cached by AudioBuffer)
4. Extract peaks at current `samplesPerPixel` → store in `_peaksData` map
5. Call `engine.setTracks()` with populated tracks
6. Dispatch `daw-ready`

**Shadow DOM layout:**

```
<div part="container">
  <daw-ruler />           (conditional on timescale attribute)
  <div data-scroll-container part="scroll-container">
    <div style="width: totalWidth">
      <daw-playhead />
      <div part="track" data-track-id="...">
        <daw-waveform .peaks .bits .length />  (per channel per clip)
      </div>
    </div>
  </div>
  <slot style="display: none;" />   (hides light DOM data elements)
</div>
```

The `<slot>` hides the light DOM children (`<daw-track>`, `<daw-clip>`) which are data declarations, not visuals.

### `<daw-track>` — Declarative Track Data

**Light DOM** — no Shadow DOM rendering. Uses `createRenderRoot() { return this; }` so `<daw-clip>` children remain queryable.

**Attributes:** `src`, `name`, `volume`, `pan`, `muted`, `soloed`

**Stable ID:** `readonly trackId = crypto.randomUUID()` generated on construction.

**Shorthand mode:** `<daw-track src="...">` implicitly creates one clip. The editor handles this by synthesizing a clip from the track's `src`.

**Change notification:** Dispatches `daw-track-update` (bubbling) when attributes change, so the editor can re-read track state.

### `<daw-clip>` — Declarative Clip Data

**Light DOM** — pure data container, no visual rendering.

**Attributes:** `src`, `peaks-src`, `start`, `duration`, `offset`, `gain`, `name`, `color`, `fade-in`, `fade-out`, `fade-type`

**Stable ID:** `readonly clipId = crypto.randomUUID()` generated on construction.

Attributes use seconds for readability. The editor converts to the internal sample-based model (`startSample`, `offsetSamples`, `durationSamples`).

### `<daw-waveform>` — Canvas Rendering

**Shadow DOM** — renders chunked `<canvas>` elements with virtual scrolling.

**JS properties (not attributes):** `peaks`, `bits`, `length` (total width in pixels — determines canvas chunk count and container width), `waveHeight`, `barWidth`, `barGap`

**Virtual scrolling:** Uses `ViewportController` to determine which canvas chunks (1000px each) are visible + overscan buffer. Only visible chunks are rendered to the DOM.

**Drawing:** In `updated()`, iterates visible canvases and draws using ported `peakRendering.ts` functions:
- `aggregatePeaks()` — finds min/max over bar range
- `calculateBarRects()` — converts peaks to canvas fillRect params
- `calculateFirstBarPosition()` — aligns bars to chunk boundaries

**CSS custom properties:** Reads `--daw-wave-color` via `getComputedStyle()` once per draw, passes to `ctx.fillStyle`.

**Ported from:** `packages/ui-components/src/utils/peakRendering.ts` (pure functions, copy directly)

### `<daw-playhead>` — Animated Position

**Shadow DOM** — a single `<div>` styled as a vertical line.

**Animation:** Uses `AnimationController`. Editor calls `startAnimation(getTime, sampleRate, samplesPerPixel)` on play and `stopAnimation(time, sampleRate, samplesPerPixel)` on pause/stop.

**Positioning:** Direct DOM manipulation via `style.transform = translate3d(px, 0, 0)` for 60fps performance. No reactive re-renders during animation.

**Styling:** `--daw-playhead-color` CSS custom property, `will-change: transform` for GPU compositing.

### `<daw-ruler>` — Time Scale

**Shadow DOM** — chunked canvases (same virtual scrolling as waveform).

**Tick computation:** Ported from `SmartScale.tsx`. Pure math: takes `samplesPerPixel` + `sampleRate`, returns tick positions + labels. Two modes:
- Temporal (minutes:seconds grid)
- Beats & bars (integer PPQN math) — exposed later when `<daw-tempo>` is added

**Rendering:** Draws ticks + labels to visible canvas chunks in `updated()`.

**Ported from:** `packages/ui-components/src/components/SmartScale.tsx` (tick generation logic)

### `<daw-transport>` — Container

**Light DOM** — `createRenderRoot() { return this; }` with a `<slot>` for button children.

**`for` attribute:** Resolves to a `DawEditorElement` or `DawPlayerElement` via `document.getElementById()`.

**`target` getter:** Returns the resolved element. Button children access it via `this.closest('daw-transport')?.target`.

### Transport Buttons

**Base class:** `DawTransportButton extends LitElement` — shared styles and `target` getter.

**Elements:** `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>`

**Pattern:** Each renders a `<button>` with a click handler that calls the target method. Default text via `<slot>` (overridable). `::part(button)` exposed for styling.

**Stateless:** Buttons don't track play state. They fire-and-forget to the target.

---

## CSS Theming

Default theme uses CSS custom properties on `<daw-editor>`:

```css
daw-editor {
  --daw-wave-color: #c49a6c;
  --daw-progress-color: #63C75F;
  --daw-playhead-color: #d08070;
  --daw-background: #1a1a2e;
  --daw-track-background: #16213e;
  --daw-ruler-color: #c49a6c;
  --daw-ruler-background: #0f0f1a;
  --daw-controls-background: #1a1a2e;
  --daw-controls-text: #e0d4c8;
}
```

CSS custom properties inherit through Shadow DOM boundaries, so child elements (`<daw-waveform>`, `<daw-playhead>`, etc.) receive them automatically.

Canvas elements read resolved values via `getComputedStyle()` since canvas is bitmap-based.

---

## Dev Environment

**File:** `packages/dawcore/dev/index.html`

Served by Vite's dev server. Tests the vanilla JS experience directly:

```html
<!DOCTYPE html>
<html>
<head>
  <title>dawcore dev</title>
  <style>
    daw-editor {
      --daw-wave-color: #c49a6c;
      --daw-playhead-color: #d08070;
    }
  </style>
</head>
<body>
  <script type="module" src="../src/index.ts"></script>

  <daw-editor id="editor" samples-per-pixel="1024" wave-height="128" timescale>
    <daw-track src="/dev/audio/sample.mp3" name="Track 1"></daw-track>
  </daw-editor>

  <daw-transport for="editor">
    <daw-play-button></daw-play-button>
    <daw-pause-button></daw-pause-button>
    <daw-stop-button></daw-stop-button>
  </daw-transport>
</body>
</html>
```

Run with: `cd packages/dawcore && npx vite --root dev`

---

## Code Reuse

| Source | Target | Method |
|--------|--------|--------|
| `ui-components/utils/peakRendering.ts` | `dawcore/utils/peak-rendering.ts` | Copy (pure functions) |
| `ui-components/utils/timeFormat.ts` | `dawcore/utils/time-format.ts` | Copy (pure functions) |
| `ui-components/components/SmartScale.tsx` | `dawcore/utils/smart-scale.ts` | Port (extract tick math, drop React) |
| `browser/workers/peaksWorker.ts` | `dawcore/workers/peaks-worker.ts` | Copy (framework-agnostic) |
| `browser/waveformDataLoader.ts` | `dawcore/utils/waveform-data-loader.ts` | Port (drop React hooks, keep extraction logic) |
| `engine` package | Direct dependency | No copy — `workspace:*` reference |
| `core` package | Direct dependency | No copy — `workspace:*` reference |
| `playout` package | Direct dependency | No copy — `workspace:*` reference |

---

## Testing Strategy

**Unit tests (Vitest):**
- Ported util functions (peak rendering, time formatting, smart scale)
- Controller behavior (animation start/stop, viewport tracking)
- Editor track discovery logic (MutationObserver → ClipTrack[] building)

**Integration tests (Vitest + happy-dom or jsdom):**
- Element registration and lifecycle
- Transport `for` attribute resolution
- Event dispatching and bubbling

**Manual testing:**
- Dev page with real audio files
- Visual verification of waveform rendering, playhead animation, transport controls

**E2E tests (Playwright):**
- Deferred to after the dev page is working — verify play/pause/stop, waveform visible, playhead moves

---

## Build Order (Vertical Slice)

1. Package scaffolding (tsup, Lit, TypeScript, pnpm workspace)
2. `<daw-editor>` shell (engine creation, child discovery, MutationObserver)
3. `<daw-track>` + `<daw-clip>` (light DOM data elements)
4. Audio loading pipeline (fetch → decode → worker → peaks)
5. `<daw-waveform>` (chunked canvas rendering)
6. `<daw-playhead>` (RAF animation)
7. `<daw-ruler>` (time ticks)
8. `<daw-transport>` + play/pause/stop buttons
9. CSS custom properties theming
10. Dev page with real audio
