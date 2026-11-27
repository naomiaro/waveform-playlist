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
- Explicit heading ids (`## Heading {#custom-id}`) break the MDX build ("Could not parse expression with acorn" at the heading) — unsupported by this config. Renamed headings change their auto-slugs: update in-file anchor links; the build's broken-anchor check catches misses.
- Stopping a harness background task kills the pnpm wrapper but can orphan the docusaurus node child holding port 3000 — check `lsof -nP -iTCP:3000 -sTCP:LISTEN`, verify the PID's command path is this repo, kill it, then restart.

## Versions of the Site

One GitHub Pages deployment holds two builds (`.github/workflows/deploy-website.yml`), and the navbar dropdown (`versionDropdown` in `docusaurus.config.ts`) switches between them: **stable**, the branch `main` (what npm `latest` ships), at `/waveform-playlist/`, and **next**, the branch `dev` (the current work), at `/waveform-playlist/next/`.

- **The stable version's number is the release number,** `version` in the root `package.json` of `main` (the project skill `release`, "The release number").
- **Three environment variables, read in `docusaurus.config.ts`:** `DOCS_CHANNEL` (`stable` or `next`: the dropdown's label, the announcement bar, `noIndex` for next), `DOCS_BASE_URL` (default `/waveform-playlist/`) and `DOCS_STABLE_VERSION` (default: this checkout's release number, which must be three numbers like `16.0.1`). `pnpm start` and the e2e run set none, so a local site says "Next" at the stable base URL.
- **Never write `/waveform-playlist/` into a path.** A file the page fetches or an `<a href>` is `sitePath('/media/audio/x.opus')` (`src/utils/sitePath.ts`, usable at module scope); a navbar or footer link is built from `baseUrl`; a Markdown link is the plain route. A path with the base in it still works in the next build, by loading the STABLE site's file, so it fails only when the two differ. Check: `git grep -n "/waveform-playlist/" -- website/src website/docs | grep -v "github"` lists only the three comment lines of `src/utils/sitePath.ts` (what it filters out are absolute `https://naomiaro.github.io` URLs: social images, canonical links).
- **Install commands get `@next` in the next build only** (`src/remark/nextInstallTag.ts`, registered in `docusaurus.config.ts` when `DOCS_CHANNEL` is `next`): on an `npm install`/`npm i`/`npm add`/`pnpm add`/`pnpm install`/`pnpm i`/`yarn add`/`bun add` line in a code block or inline code, every `@waveform-playlist/*` and `@dawcore/*` name without a version gets `@next`; prose, imports and shell comments are left alone. Write install commands in the docs plain, without a tag. Test: `node --test website/src/remark/nextInstallTag.test.ts`.
- **To try the next build locally:** `cd website && DOCS_CHANNEL=next DOCS_BASE_URL=/waveform-playlist/next/ pnpm exec docusaurus build --out-dir <dir>/waveform-playlist/next`, then serve `<dir>` with any static server. Count the requests that leave `/waveform-playlist/next/`: there should be none.
- **A link from one build to the other is a full page load to a path outside the base URL:** `href: 'pathname://…'` with `autoAddBaseUrl: false` and `target: '_self'`. Without `autoAddBaseUrl: false` Docusaurus puts the base in front of it.
- **`deploy-website.yml` is the same on `main` and `dev`,** since a push runs the copy on the pushed branch and every run builds both.
- **Docs of earlier releases are not kept** (maintainer, 2026-11-23: stable and next for now, to be revisited). A first design archived each major under `/waveform-playlist/v<major>/`; what it ran into: a built site is about 210 MB (Storybook 83 MB, media 66 MB) against GitHub Pages' roughly 1 GB, and committing built sites to a branch adds that much history per run unless the branch is rewritten with a forced push.

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

- A320U.sf2 SoundFont — served from `static/media/soundfont/`. CC-BY 3.0 license. Loaded by the MIDI example with `sitePath('/media/soundfont/A320U.sf2')`.

## Example Component Guidelines

- **Loading text on an example page is `LoadingBadge` (`components/examples/LoadingBadge.tsx`): an overlay that takes no layout space** (maintainer, 2026-11-15). Nothing in the flow above the editor may appear, disappear or change size while audio loads: the editor moving under a clip drag detaches the dragged clip (#858), and a taller page moved an e2e drop point into dnd-kit's auto-scroll band. Render the badge unconditionally, outside any `tracks.length > 0 &&` or `peaksSettled &&`: its `role="status"` region must exist before its text does. Guards: "the editor does not move on the page when loading ends" in `e2e/multi-clip.spec.ts` and `e2e/stem-tracks.spec.ts`.
- **An example page owns an arrangement and gives it to the provider** (#812) — `useCreateArrangement(() => configs.map((config) => audioTrack(config)))` at the page root, `<WaveformPlaylistProvider arrangement={arrangement}>`; the page's tracks are changed through the arrangement's methods; loading state is read with `useArrangementSources(arrangement)`, the tracks with `usePlaylistTimeline()` below the provider or `useArrangementTracks(arrangement)`. The provider has no `tracks`, `onTracksChange` or `deferEngineRebuild` prop: adding or loading a track never builds a new engine. `EffectsExample.tsx` has the arrangement, the sources, the drop, the load error and the badge.
- **Tone.js in example components must use dynamic import** — `import * as Tone from 'tone'` triggers AudioWorklet errors on page load. Use `import type * as ToneNs from 'tone'` for types, then `const Tone = await import('tone')` inside effects after `AudioContext.state === 'running'`.
- **A file the page declares that fails to load gets `<SourceLoadError arrangement={arrangement} />`** (`components/examples/SourceLoadError.tsx`): the message and a Retry (`arrangement.retry(src)`), for URL sources only.
- **A dropped file is `arrangement.addTrack(audioTrack({ src: file }))`** — the arrangement decodes it; the page decodes nothing (`decodeAudioFiles()` is gone). A dropped file that fails is removed again and listed by `useFailedDrops(arrangement)` / `<FailedDropsAlert>` (`components/examples/FailedDrops.tsx`), not offered a Retry.
- **The effects hooks return stable objects and do not re-render the page** (#679) — `useDynamicEffects()`/`useTrackDynamicEffects()` return the same object and functions for the life of the component, and the effect lists are sources: call `useActiveEffects(fx.effects)` / `useActiveEffects(trackFx.getTrackEffects(trackId))` in the rack component that draws them (`EffectRack`, `TrackEffectControls`, `MasterRack`/`TrackRack` in the WAM example), never at the page root. Track effects reach the provider through its `trackEffects` prop (`getTrackEffectsFunction`), never as a field on a track.
- **A custom effect for an example** is registered once at module scope (`registerDemoTremolo()` in `demoTremoloEffect.ts`, worklet module in `static/media/worklets/`) and needs the page in native-context mode, like WAM. Register before the component that shows the picker renders: `availableEffects` is read at render, not subscribed.
- **Stopping an AudioWorklet effect: a port message, never `return false` on its own.** `demo-tremolo-processor.js` returns `this.alive` from `process()`; a `'dispose'` message on the port sets it to false, and the definition's `dispose` posts that message and then disconnects the node. Without a stop every removed tremolo keeps processing until the page closes. Returning `false` whenever idle is not an option: in Chrome a processor that returned false while nothing was connected (the effect bypassed by disconnection) did not run again when reconnected, measured by the live-signal test in `e2e/custom-effects.spec.ts`. The guide (`docs/react/guides/effects.md`) carries copies of the processor and the definition; keep them identical to the shipped files apart from the module URL.
- **Effect chains survive a remount** (StrictMode, Fast Refresh, `<Activity>`): the hooks have no cleanup. Add an example's default effects behind a ref guard (`defaultsAddedRef` in `EffectsExample.tsx`), and do not expect a Fast Refresh to reset a rack.
- **`website/src` is OUTSIDE root `pnpm lint`** — always run `cd website && npx eslint <touched files>` directly; `react-hooks/exhaustive-deps` errors are otherwise invisible.
- **WAM example pattern:** `configureGlobalContext({ nativeAudioContext: true })` at module scope of the lazy-loaded component, but gate WAM UI on `isNativeGlobalContext()` — not `supportsNativeContextMode()` alone. SPA navigation from any other audio example creates the SAC context first, silently disabling native mode (show a "reload to enable" banner).

## Docusaurus Native Examples

**Webpack aliases** in `website/docusaurus.config.ts` — packages transpiled from source (aliased to `packages/<name>/src`): `@waveform-playlist/browser`, `core`, `playout`, `engine`, `ui-components`, `annotations`, `spectrogram`, `midi`, `recording`. A source change in one of these needs no rebuild for the website. `worklets`, `webaudio-peaks` and the `@dawcore/*` family are NOT aliased: the website uses their built `dist` through node_modules. **Rebuild those after pulling/merging source changes** (`pnpm --filter @waveform-playlist/worklets build`, `pnpm --filter @dawcore/components build`) — a stale `dist` runs old behaviour despite correct source.

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

**Rebuild requirement:** `ui-components` and `recording` are source-aliased for the website, so a change in either needs no rebuild here. Package builds, typecheck and unit tests still resolve workspace packages through `dist` (root `CLAUDE.md`, "Type Migration Gotcha").

## Embedding dawcore Web Components

- **Don't set `display` on `<daw-editor>`** — its `:host { display: flex }` is the proper layout (controls-column left, scroll-area right). External `display: block` collapses to a vertical stack.
- **Theme `--daw-*` vars on the host element, not a wrapper** — dawcore's `theme.ts` sets defaults via `:host` on every element, which blocks ancestor inheritance. Set on `<daw-editor>` + `<daw-transport>` directly.
- **Editor uses a locked dark palette in both site themes** — DAW convention + dawcore's `daw-track-controls` Shadow DOM hardcodes `rgba(255,255,255,0.06-0.12)` for M/S buttons + slider tracks (not exposed as vars). See `website/src/components/examples/wc-example.module.css` for the long-form rationale.
- **WC examples must use `createLazyExample`** — `import '@dawcore/components'` registers custom elements at module-evaluation, which can't run during SSG.
- **Pre-computed `.dat` peaks have base scale 256 spp** — zoom levels below that get rejected; read `editor.samplesPerPixel` back after assignment, don't mirror the intended value into React state.

## Sidebar & search plugin gotchas

- **Autogenerated sidebar is filesystem-driven** (`sidebars.ts: [{type: 'autogenerated', dirName: '.'}]`). Add a section by creating a directory + `_category_.json` with `label`, `position`, and `link: { type: 'doc', id: '...' }` for direct-link behavior. No `sidebars.ts` edit needed.
- **`@easyops-cn/docusaurus-search-local` only works in `build && serve`**, not in `start` (dev server). The plugin generates `search-index.json` at build time; the dev server has no index. Click the search bar in dev and you get a "build the site to enable search" notice.
- **A link from a `.md` file to a React page is the plain route: `[Basic](/examples/wc-basic)`.** Docusaurus puts the base URL in front. The earlier form, `pathname:///waveform-playlist/examples/...`, has the base written into it and came out as `/waveform-playlist/next/waveform-playlist/examples/...` in the build under `/next/` (read in the built HTML, 2026-11-23).

## Guide Documentation Drift

Context hooks tables in guide docs (e.g., `media-element-playout.md`) easily drift from source interfaces. Always cross-check guide "Returns" columns against the actual `*ContextValue` interfaces in the provider source file. Use "Key returns" column header (not "Returns") if listing a subset.
