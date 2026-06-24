# Website Package (Docusaurus)

## Aesthetic: Berlin Underground

Industrial / electronic-music-culture aesthetic. When adding examples or UI:

- **Dark gradient backgrounds** with high-contrast text
- **Monospace fonts** (Courier New) for timestamps and technical elements
- **Grungy details** — `//` prefixes on timestamps, text shadows
- **Muted palette** with strategic accent colors
- **Minimal, utilitarian** — form follows function

**Dark-mode palette ("Ampelmännchen Traffic Light"** — DDR pedestrian-signal homage):
- 🟢 Green `#63C75F` — buttons / links
- 🟡 Amber `#c49a6c` — waveform bars, body text
- 🔴 Red `#d08070` — headings, accents

Reference: the Flexible API example showcases full customization (custom playheads, grungy timestamps, monospace clip headers).

## CSS Pitfalls

### `backdrop-filter` breaks `position: fixed` children

`backdrop-filter` on an ancestor creates a new containing block for `position: fixed` descendants. The mobile navbar sidebar (`position: fixed; top: 0; bottom: 0`) becomes constrained to the ancestor's height instead of the viewport.

**Fix:** Scope `backdrop-filter` with `:not(.navbar-sidebar--show)` so it only applies when the mobile sidebar is closed.

### Absolute-positioned elements inside flex-centered content

When a hero section uses `min-height: 100vh` + `align-items: center` and an element inside the centered content uses `position: absolute; bottom: N`, it positions relative to the content div — not the full-height section. On mobile where text wraps, the content grows and the absolute element overlaps.

**Fix:** Place absolute-positioned indicators (scroll arrows, etc.) as direct children of the viewport-height container, not inside the centered content div.

## Dev Server

- Clear `.docusaurus/` cache after branch switches — stale `@generated` modules cause compilation errors
- CSS calc warnings during build are pre-existing and harmless
- Dev server: `pnpm --filter website start`
- Build: `pnpm --filter website build`
- **Bundler is Rspack** (Docusaurus 3.10.1 + `@docusaurus/faster`; the `future: { v4: true }` flag selects it). The `configureWebpack` hook — `babel-loader` source-transpilation + `resolve.alias` (incl. `'@dawcore/faust': false`) — works verbatim under Rspack; no config changes. Storybook (`ui-components`, `@storybook/react-webpack5`) still uses webpack — two bundlers in the monorepo, so webpack can't be removed.

## Custom Pages

- Examples index: `website/src/pages/examples/index.tsx` + `examples.module.css`
- Custom styles: `website/src/css/custom.css`
- Example components: `website/src/components/examples/`
- Lazy loading wrapper: `website/src/components/BrowserOnlyWrapper.tsx`

## Social Preview Images

Each example page should have OG/Twitter meta tags with a social image. Pattern:
- Screenshot at 1200x630 viewport, save to `website/static/img/social/example-{name}.png`
- Use `Head` from `@docusaurus/Head` for `og:title`, `og:description`, `og:image`, `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image`
- See `website/src/pages/examples/flexible-api.tsx` for reference

## Type Declarations

- Custom Docusaurus module types live in `src/types/docusaurus.d.ts` (Head, Link, Layout, BrowserOnly, etc.)
- Do NOT add `@docusaurus/module-type-aliases` to `tsconfig.json` `compilerOptions.types` — its `Layout` type only has `children` (no `title`/`description`), overriding our more complete local declarations
- When adding new Docusaurus virtual module imports, add the type declaration to `docusaurus.d.ts`
- 3 pre-existing `DefaultTheme` errors from browser package source (styled-components augmentation not picked up via webpack aliases) — these are expected
- `pnpm --filter website typecheck` is NOT in CI (root `typecheck`/`build` cover only `./packages/*`) and has pre-existing module-resolution errors (`@waveform-playlist/midi`/`spectrogram`, Tone `BitCrusher`) — it relies on bundler aliases, not tsconfig paths. Don't chase these.

## Static Media Assets

- A320U.sf2 SoundFont — served from `static/media/soundfont/`. CC-BY 3.0 license. Loaded by MIDI example at `/waveform-playlist/media/soundfont/A320U.sf2`.

## Example Component Guidelines

- **Multi-track examples must use `deferEngineRebuild={loading}`** — Without it, the engine rebuilds on every track decode (up to N times for N tracks), creating race conditions that cause duplicate audio on play/pause/play cycles.
- **Tone.js in example components must use dynamic import** — `import * as Tone from 'tone'` triggers AudioWorklet errors on page load. Use `import type * as ToneNs from 'tone'` for types, then `const Tone = await import('tone')` inside effects after `AudioContext.state === 'running'`.
- **Examples must pass `onTracksChange` to `WaveformPlaylistProvider`** — Without it, engine track mutations (from statechange) trigger "UI will revert on next render" warning. On the next React render, old tracks are passed back, causing engine rebuild mid-playback (audio interruption, playhead jitter). The only exception is truly read-only examples with no interactive clips or track mutations.
- **Use `decodeAudioFiles()` for file drop** — `website/src/utils/decodeAudioFiles.ts` decodes files in parallel and returns `ClipTrack[]`. Accepts `trackDefaults` for per-example options. Do not write sequential `for-await` decode loops — they cause N engine rebuilds for N dropped files.

## Docusaurus Native Examples

**Webpack aliases** in `website/docusaurus.config.ts` — packages transpiled from source: `@waveform-playlist/browser`, `core`, `playout`, `ui-components` → source. `annotations`, `recording` → dist/ (have build artifacts like worklets).

**SSR/SSG pattern:** Example components use browser APIs (AudioContext, Canvas, window) that aren't available during static site generation. Use `createLazyExample` from `BrowserOnlyWrapper`:

```typescript
import { createLazyExample } from '../../components/BrowserOnlyWrapper';

const LazyExample = createLazyExample(() =>
  import('../../components/examples/ExampleComponent').then((m) => ({
    default: m.ExampleComponent,
  }))
);
```

`BrowserOnly` alone is insufficient — it prevents rendering, not importing. Some libraries (Radix UI, Tone.js, AudioWorklets) access `window` at import time. `React.lazy()` defers the import until render time in the browser.

**Theme/styling pattern:**
- Use `useDocusaurusTheme()` hook for automatic light/dark theme.
- Export components as functions (no `createRoot()`).
- Styled components use CSS variables: `var(--ifm-background-surface-color, #fallback)`.

**Rebuild requirement:** When ui-components changes affect recording, rebuild both packages.

## Embedding dawcore Web Components

- **Don't set `display` on `<daw-editor>`** — its `:host { display: flex }` is the proper layout (controls-column left, scroll-area right). External `display: block` collapses to a vertical stack.
- **Theme `--daw-*` vars on the host element, not a wrapper** — dawcore's `theme.ts` sets defaults via `:host` on every element, which blocks ancestor inheritance. Set on `<daw-editor>` + `<daw-transport>` directly.
- **Editor uses a locked dark palette in both site themes** — DAW convention + dawcore's `daw-track-controls` Shadow DOM hardcodes `rgba(255,255,255,0.06-0.12)` for M/S buttons + slider tracks (not exposed as vars). See `website/src/components/examples/wc-example.module.css` for the long-form rationale.
- **WC examples must use `createLazyExample`** — `import '@dawcore/components'` registers custom elements at module-evaluation, which can't run during SSG.
- **Pre-computed `.dat` peaks have base scale 256 spp** — zoom levels below that get rejected; read `editor.samplesPerPixel` back after assignment, don't mirror the intended value into React state.

## Sidebar & search plugin gotchas

- **Autogenerated sidebar is filesystem-driven** (`sidebars.ts: [{type: 'autogenerated', dirName: '.'}]`). Add a section by creating a directory + `_category_.json` with `label`, `position`, and `link: { type: 'doc', id: '...' }` for direct-link behavior. No `sidebars.ts` edit needed.
- **`@easyops-cn/docusaurus-search-local` only works in `build && serve`**, not in `start` (dev server). The plugin generates `search-index.json` at build time; the dev server has no index. Click the search bar in dev and you get a "build the site to enable search" notice.
- **`pathname:///waveform-playlist/...` prefix** for links from `.md` files to non-doc routes (e.g., `/examples/wc-basic`) — bypasses Docusaurus's slug resolution so deep-links to React-page routes work.

## Guide Documentation Drift

Context hooks tables in guide docs (e.g., `media-element-playout.md`) easily drift from source interfaces. Always cross-check guide "Returns" columns against the actual `*ContextValue` interfaces in the provider source file. Use "Key returns" column header (not "Returns") if listing a subset.
