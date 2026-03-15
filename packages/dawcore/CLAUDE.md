# dawcore Package (`@dawcore/components`)

**Purpose:** Framework-agnostic Web Components for multi-track audio editing. Wraps `PlaylistEngine` + `createToneAdapter()` in Lit elements so any framework (or vanilla HTML) can render waveforms and control playback.

**Architecture:** Data elements (`<daw-track>`, `<daw-clip>`) use light DOM; visual elements (`<daw-waveform>`, `<daw-playhead>`, `<daw-ruler>`) use Shadow DOM with chunked canvas rendering. `<daw-editor>` orchestrates everything. Transport elements find their target via `for` attribute.

**Build:** Uses tsup — `pnpm typecheck && tsup`. Outputs ESM + CJS + DTS. `sideEffects: true` because element imports register custom elements globally.

**Testing:** vitest with happy-dom in `src/__tests__/`. Run with `cd packages/dawcore && npx vitest run`.

**Dev page:** `pnpm dev:page` starts Vite at `http://localhost:5173/dev/index.html`. Uses `website/static/` as publicDir for audio files.

## Element Types

**Data elements (light DOM):**
- `<daw-clip>` — Declarative clip data (src, start, duration, offset, gain, fades). Auto-generated `clipId`.
- `<daw-track>` — Track data (name, volume, pan, muted, soloed). Dispatches `daw-track-connected` on mount, `daw-track-update` on property change.

**Visual elements (Shadow DOM):**
- `<daw-waveform>` — Chunked canvas rendering (1000px chunks). Receives peaks as JS properties.
- `<daw-playhead>` — RAF-animated vertical line via `AnimationController`.
- `<daw-ruler>` — Temporal time scale with tick marks. Ported from `SmartScale` (temporal mode only, beats & bars deferred).

**Control elements:**
- `<daw-editor>` — Core orchestrator. Builds engine eagerly, loads audio per-track on `daw-track-connected`, renders waveforms from decoded peaks.
- `<daw-transport for="editor-id">` — Container that resolves target via `document.getElementById`. Light DOM.
- `<daw-play-button>`, `<daw-pause-button>`, `<daw-stop-button>` — Walk up to closest `<daw-transport>` for target resolution.

## Key Patterns

- **Event-driven track loading** — `<daw-track>` dispatches `daw-track-connected` (bubbling, composed); `<daw-editor>` listens and loads audio for that track individually. No MutationObserver bulk discovery.
- **Eager audio decode** — Audio fetches and decodes on track connect (AudioContext can decode while suspended). Waveforms render immediately without waiting for play.
- **Engine built eagerly, init deferred** — `PlaylistEngine` + adapter created in `connectedCallback`. `engine.setTracks()` called as tracks load (builds playout structure). `engine.init()` deferred to first `play()` (resumes AudioContext, requires user gesture).
- **setTracks before addTrack** — `adapter.addTrack()` throws if no playout exists. Always use `setTracks()` for initial load; `addTrack()` only for incremental additions after playout is built.
- **Immutable state updates** — All `@state()` Maps are replaced with `new Map(old).set(...)`, never mutated in place.
- **Shared decode AudioContext** — Single `_decodeContext` for all fetch+decode operations, separate from Tone.js context.

## CSS Theming

Custom properties on `<daw-editor>` or any ancestor, inherited through Shadow DOM:

- `--daw-wave-color` (default: `#c49a6c`)
- `--daw-playhead-color` (default: `#d08070`)
- `--daw-background` (default: `#1a1a2e`)
- `--daw-track-background` (default: `#16213e`)
- `--daw-ruler-color` / `--daw-ruler-background`
- `--daw-controls-background` / `--daw-controls-text`
- `--daw-selection-color`, `--daw-clip-header-background`, `--daw-clip-header-text`

## Reactive Controllers

- `AnimationController` — Start/stop RAF loops, auto-cleanup on `hostDisconnected`.
- `ViewportController` — Scroll-aware visible range with overscan buffer (1.5x). Scroll threshold debounce (100px).
- `EngineController` — Walks DOM to find closest `<daw-editor>` via `closest()`.

## Ported Utilities

- `peak-rendering.ts` — `aggregatePeaks`, `calculateBarRects`, `calculateFirstBarPosition` (from `ui-components`)
- `smart-scale.ts` — `getScaleInfo`, `computeTemporalTicks` (extracted from `SmartScale.tsx`, temporal mode only)
- `time-format.ts` — `formatTime` for ruler labels

## Lit/TypeScript Requirements

- `experimentalDecorators: true` and `useDefineForClassFields: false` in tsconfig — required for Lit's `@property` and `@customElement` decorators
- Light DOM elements override `createRenderRoot()` to return `this`
- `<daw-track>` defers `daw-track-connected` dispatch via `setTimeout(, 0)` so the editor's listeners are set up first
