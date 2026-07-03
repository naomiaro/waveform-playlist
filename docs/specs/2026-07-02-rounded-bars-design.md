# Rounded Bars Visual Config — Design

**Date:** 2026-07-02
**Status:** Approved (API shape confirmed with maintainer; scope per recommendation)

## Goal

Add an opt-in "rounded bars" rendering style (SoundCloud-style pill-shaped waveform
bars) as a visual config, demoed on the website styling page and specified for the
dawcore web components.

## API

Boolean, default `false` (Boolean Props Convention — enable via shorthand):

| Surface | Name | Notes |
| --- | --- | --- |
| `WaveformPlaylistProvider` | `roundedBars` | prop → `PlaylistInfo` context |
| `MediaElementPlaylistProvider` | `roundedBars` | prop → `PlaylistInfo` context |
| `Channel` (ui-components) | `roundedBars` | prop, default `false` |
| `SmartChannel` | — | reads `usePlaylistInfo().roundedBars`, forwards to `Channel` |
| `<daw-editor>` | `rounded-bars` | attribute → forwarded to `<daw-waveform>` |
| `<daw-player>` | `rounded-bars` | attribute → forwarded to `<daw-waveform>` |
| `<daw-waveform>` | `roundedBars` | property (`attribute: false`, like `barWidth`) |

Radius is derived: `barWidth / 2`, clamped by the canvas `roundRect` spec on bars
shorter than the diameter. No numeric `barRadius` (YAGNI).

## Rendering

Two parallel implementations share this logic (`packages/ui-components/src/components/Channel.tsx`
and `packages/dawcore/src/elements/daw-waveform.ts`):

- **`drawMode: 'normal'`** — draw each bar with `ctx.beginPath(); ctx.roundRect(...); ctx.fill()`
  instead of `fillRect`, using the single rect from `calculateBarRects(..., 'normal')`.
- **`drawMode: 'inverted'`** (default) — pre-fill the chunk (or dirty region) with the
  outline color, switch to `globalCompositeOperation = 'destination-out'`, and punch a
  rounded hole per bar using the *normal-mode* rect. Bars remain transparent holes, so
  the background/progress-overlay layering keeps working unchanged.
  - Behavior note: gap columns become painted in this mode (today they are unpainted,
    showing the fill color full-height). Clean gaps are inherent to the rounded look.
- `drawVersion` fingerprint gains `roundedBars` (React); dawcore layout-prop set gains
  `roundedBars` so property changes trigger full redraws.
- No new pure functions: rounded bars reuse `calculateBarRects` with `'normal'`.

## Demo (website styling page)

- `StylingExample.tsx`: new "Rounded Bars" section(s) using `roundedBars` +
  `barWidth`/`barGap` combos; the variant component gains a `roundedBars` prop.
- `styling.tsx`: page copy + style-guide table row.

## Spec + docs sync

- `docs/specs/web-components-migration.md`: `rounded-bars` rows in the `<daw-editor>`
  and `<daw-player>` attribute tables.
- `website/docs/framework-agnostic/llm-reference.md`: provider prop interfaces.
- `website/docs/react/api/providers/waveform-playlist-provider.md` and
  `media-element-playlist-provider.md`: prop tables.

## Testing

- dawcore: `daw-waveform` unit tests with mocked 2d context asserting `roundRect` +
  composite-mode calls in both draw modes (happy-dom mock gains `beginPath`/`roundRect`/
  `fill` + `globalCompositeOperation`).
- browser/ui-components: existing pure-function tests unchanged; provider threading
  covered by typecheck; end-to-end visual verification on the styling page via dev
  server + real browser.

## Out of scope

- Numeric `barRadius`, minimum bar height for silent regions, rounded progress
  overlay geometry (progress is a div overlay, unaffected).
