# Website Package (Docusaurus)

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

## Static Media Assets

- A320U.sf2 SoundFont — served from `static/media/soundfont/`. CC-BY 3.0 license. Loaded by MIDI example at `/waveform-playlist/media/soundfont/A320U.sf2`.

## Example Component Guidelines

- **Multi-track examples must use `deferEngineRebuild={loading}`** — Without it, the engine rebuilds on every track decode (up to N times for N tracks), creating race conditions that cause duplicate audio on play/pause/play cycles.
- **Tone.js in example components must use dynamic import** — `import * as Tone from 'tone'` triggers AudioWorklet errors on page load. Use `import type * as ToneNs from 'tone'` for types, then `const Tone = await import('tone')` inside effects after `AudioContext.state === 'running'`.
- **Examples must pass `onTracksChange` to `WaveformPlaylistProvider`** — Without it, engine track mutations (from statechange) trigger "UI will revert on next render" warning. On the next React render, old tracks are passed back, causing engine rebuild mid-playback (audio interruption, playhead jitter). The only exception is truly read-only examples with no interactive clips or track mutations.

## Guide Documentation Drift

Context hooks tables in guide docs (e.g., `media-element-playout.md`) easily drift from source interfaces. Always cross-check guide "Returns" columns against the actual `*ContextValue` interfaces in the provider source file. Use "Key returns" column header (not "Returns") if listing a subset.
