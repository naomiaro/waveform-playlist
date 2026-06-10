# dawcore Shared-Geometry Track Layout — Design

**Date:** 2026-06-09
**Package:** `@dawcore/components`
**Status:** Approved

## Problem

The `<daw-editor>` layout links track controls to track lanes by stacking two
independent columns (controls left, track rows in the x-scroll area right) and
computing their heights in parallel. Alignment is arithmetic coincidence, not
structure. Measured failures (Playwright, `examples/dawcore-tone/spectrogram.html`
and `multiclip.html`):

1. **Cumulative 1px-per-track drift.** `.track-row` is `content-box`: a row
   styled `height: 120px` with `border-bottom: 1px` renders 121px. The
   `daw-track-controls` host is `border-box`: exactly 120px. After 4 tracks the
   columns are 4px out of sync; after 7 tracks, 7px. The beats-grid height
   calculation hand-compensates with a magic `+ 1` per row.
2. **Controls clip at small wave heights.** Controls content needs ~76px. At
   `wave-height="40"` on a mono track (60px row) the Pan slider is silently cut
   off by `overflow: hidden`. No minimum-height concept exists.
3. **No vertical scrolling.** `.scroll-area` is `overflow-y: hidden`, the host
   `overflow: hidden`. An editor constrained to `height: 400px` with 897px of
   tracks clips everything below 400px with no scrollbar. Enabling overflow
   naively would let the two columns scroll independently.
4. **Duplicated geometry.** The controls column carries a hardcoded
   `<div style="height: 30px">` spacer that must match `daw-ruler`'s height;
   heights are applied as inline styles to two separate stacks.

## Decisions

- **Architecture:** shared-geometry two-column. Controls stay OUTSIDE the
  x-scroll container — consistent with `ui-components`' documented decision
  (sticky-positioned controls inside an `overflow-x: auto` scroller trigger a
  browser `scrollLeft` bug; see `packages/ui-components/CLAUDE.md`,
  "Controls Outside Scroll Container").
- **Vertical scrolling:** yes, with a pinned (sticky-equivalent) ruler.
- **Short rows:** controls adapt via CSS container queries instead of clipping.

## New shadow DOM structure

```
:host (display: flex; flex-direction: column)
├── .header-row (flex-shrink: 0; display: flex)           ← only when ruler shown
│   ├── .ruler-gap (width: --daw-controls-width)
│   └── .ruler-viewport (flex: 1; overflow: hidden)
│       └── daw-ruler (width: totalWidth; transform: translate3d(-scrollLeft, 0, 0))
└── .v-scroll (flex: 1; min-height: 0; display: flex; overflow-y: auto)
    ├── .controls-column (flex-shrink: 0; width: --daw-controls-width)
    │   └── daw-track-controls × N    ← height: trackHeight[i], border-box
    └── .scroll-area (flex: 1; overflow-x: auto; overflow-y: hidden)
        └── .timeline (width: totalWidth; position: relative)
            ├── daw-grid / daw-selection / daw-playhead   ← overlays, top: 0
            └── .track-row × N        ← height: trackHeight[i], border-box
```

### Ruler band

- The ruler leaves the scroll area. It renders inside `.ruler-viewport`
  (overflow: hidden), horizontally synced to `.scroll-area.scrollLeft` via
  `transform: translate3d(-scrollLeft, 0, 0)` set in the existing scroll
  listener. No `position: sticky` anywhere — sidesteps the documented browser
  bug.
- `.ruler-gap` and `daw-ruler` are both sized from the editor's single
  `rulerHeight` value. The hardcoded 30px spacer div is removed.
- Seek-by-clicking-the-ruler still works: `.ruler-viewport` gets a pointerdown
  handler delegating to the existing seek logic. Coordinates derived from the
  ruler element's own `getBoundingClientRect().left` are identical to
  timeline-space pixels because both shift by `scrollLeft`.

### Vertical scroll

- Both columns are children of one `.v-scroll` container (`overflow-y: auto`),
  so they cannot desync. Unconstrained editors grow as today (no scrollbar);
  height-constrained editors scroll vertically with the ruler band pinned
  above.
- The drop-zone `min-height: var(--daw-min-height, 200px)` moves from
  `.scroll-area` to `.v-scroll`.

## Row geometry — one computation, identical box model

- `orderedTracks` (already computed once per render) remains the single source
  of `trackHeight = waveHeight × numChannels + clipHeaderHeight`.
- Both `daw-track-controls` (already `border-box`) and `.track-row` (gains
  `box-sizing: border-box`) carry the identical
  `border-bottom: 1px solid rgba(255, 255, 255, 0.05)` — rendered heights become
  exactly equal, eliminating the per-track drift.
- The beats-grid height drops the magic `+1`:
  `orderedTracks.reduce((sum, t) => sum + t.trackHeight, 0)`.
- Grid/overlay `top` offsets drop the `timescale ? 30 : 0` term (the ruler no
  longer occupies timeline space).

## Compact controls — container queries

`daw-track-controls` becomes height-responsive instead of clipping:

- `:host { container-type: size }` — safe because the host always receives an
  explicit inline height from the editor.
- `@container (max-height: ~76px)`: hide the Pan slider row.
- `@container (max-height: ~58px)`: also hide the Vol slider row.
- Track name, M/S buttons, and the remove button are always visible.
- Exact thresholds tuned by measurement during implementation.
- No JS, no new props. Browsers without container-query support (pre-2023)
  degrade to today's clipping behavior.

## Out of scope / non-goals

- Engine, adapters, events, clip/selection pointer math, ViewportController's
  x-axis tracking, and all public attributes & CSS custom properties are
  unchanged.
- Playhead caret inside the ruler band: today the playhead crosses the ruler
  only because they share a container; after this change the playhead spans
  tracks only. Rendering a caret in the ruler band is a follow-up.
- Vertical virtualization of track rows.

## Edge cases

- **Empty state:** `.header-row` renders under the same conditions the ruler
  renders today (`orderedTracks.length > 0 || scaleMode === 'beats' ||
  indefinitePlayback`, and `timescale`).
- **Beats mode:** grid top offset becomes 0; tick math untouched.
- **Recording preview / stereo-after-decode height jumps:** unchanged
  mechanics; both columns now resize from the same value with the same box
  model, so they jump together.
- **`_emptyGridHeight`** continues to read `.scroll-area` clientHeight.

## Testing

- **Unit (vitest/happy-dom, `packages/dawcore`):** template assertions — ruler
  renders inside `.ruler-viewport`; no spacer div; grid height has no `+1`;
  controls and rows carry the same inline height per track.
- **Playwright verification** on `examples/dawcore-tone/spectrogram.html` and
  `multiclip.html`:
  - `controls[i].top === trackRow[i].top` within 0.5px for every track.
  - Height-constrained editor scrolls vertically; ruler stays pinned; columns
    stay locked together.
  - `wave-height="40"` shows compact controls with nothing clipped.
  - Horizontal scroll keeps the ruler x-synced with the timeline.

## Versioning

`@dawcore/components` stays on its 0.x.x scheme; internal shadow-DOM
restructure with no public API changes — patch/minor bump per its own semver.
