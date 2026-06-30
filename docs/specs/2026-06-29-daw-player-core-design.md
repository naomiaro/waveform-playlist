# `<daw-player>` core element — design

**Issue:** [#473](https://github.com/naomiaro/waveform-playlist/issues/473) (core element), under epic [#454](https://github.com/naomiaro/waveform-playlist/issues/454).
**Status:** Approved, ready for implementation plan.
**Date:** 2026-06-29.

## Summary

`<daw-player>` is a lightweight single-track audio player Web Component for podcast,
preview, and audiobook use cases. It plays a single audio source through an
`HTMLMediaElement`, renders a waveform from pre-computed peaks, and exposes
transport controls — with **no PlaylistEngine, no PlayoutAdapter, and no Tone.js**.

This document covers the **core element only**. The remaining epic sub-issues are
explicitly deferred (see [Out of scope](#out-of-scope)).

## Scope decisions

Three decisions bound this cut:

1. **Core element only (#473).** Effects (#475), `<daw-playback-rate>` (#476),
   transport-compatibility tests (#474), and annotation children (#477) are later
   cycles.
2. **Peaks from `peaks-src` only, with a scrubber fallback.** A pre-computed BBC
   audiowaveform `.dat`/`.json` is the sole peaks source. With no `peaks-src` the
   player renders no waveform but remains a fully working scrubber/transport player
   (mirrors media-element-playout #529, "peaks optional"). Decode-to-peaks is
   deferred so the player keeps the spec's "zero Web Audio overhead until the first
   effect" promise — `decodeAudioData` would force an AudioContext at load.
3. **Fit-to-width layout, no scroll.** The whole waveform scales to the host width;
   click/drag anywhere seeks. No scroll container, no zoom controls (`automatic-scroll`
   is dropped for now, not accepted as a no-op).

## Architecture

A new Lit element, `DawPlayerElement` (`<daw-player>`), in
`packages/dawcore/src/elements/daw-player.ts`, exported from the dawcore index barrel.

It **owns a `MediaElementPlayout` instance** (from
`@waveform-playlist/media-element-playout`) and composes three existing child elements
in its shadow DOM:

```
<daw-player> (shadow root)
 ├─ <daw-ruler>          (only when `timescale` is set)
 └─ .waveform-area       (position: relative, width = host width)
     ├─ <daw-waveform>   (canvas peaks, fit-to-width; one per channel, stacked)
     └─ <daw-playhead>   (absolute overlay)
```

Responsibilities:

- **Playback** is delegated to `MediaElementPlayout`. The element never touches the
  `<audio>` element directly except through the engine and its track.
- **Waveform data** comes from `loadWaveformDataFromUrl(peaksSrc)` → `WaveformData` →
  `extractPeaks(...)` → `<daw-waveform>`. Both utilities already exist in dawcore.
- **Playhead + `daw-timeupdate`** are driven by a small `requestAnimationFrame` loop
  (a focused controller in `src/controllers/`, mirroring the editor's animation
  pattern) that reads `engine.getCurrentTime()` while playing. The engine's coarse
  `timeupdate` (HTMLMediaElement, ~250 ms) is not used for the playhead.
- **Seek** is a pointerdown/drag handler on the waveform area that maps
  `offsetX / width → time` and calls `seekTo`.
- **Fit-to-width** is maintained by a `ResizeObserver`: on resize it recomputes
  `samplesPerPixel = duration · sampleRate / width` and re-runs `extractPeaks` so the
  waveform always fills the host width.

### Why reuse `MediaElementPlayout`

The class was extended in #531 ("player-mode ergonomics") **for this issue** — it
already provides pitch-preserving playback rate, the playbackRate-reset-on-`.src`-swap
fix, in-place `setSource()`, a typed event emitter that survives source swaps, and the
optional-AudioContext routing that the effects follow-up (#475) will build on. Wrapping
it is the least net-new code and leaves a clean seam for #475.

`MediaElementTrack` already exposes the getters the player needs — `element`,
`currentTime`, `duration`, `isPlaying`, `volume`, `playbackRate`, `peaks`, `outputNode`
— so `player.audioElement` is simply `engine.getTrack(id)?.element`.

**One small `media-element-playout` change is required:** `setPlaybackRate` hard-clamps
to `0.5–2.0` in both `MediaElementTrack` and `MediaElementPlayout`, but this element's
`playback-rate` range is `0.25–4.0` (which `HTMLMediaElement` supports). Widen both
clamps (and their doc comments) to `0.25–4.0` and ship a minor `media-element-playout`
version bump. The change is additive — existing `0.5–2.0` callers are unaffected;
previously-rejected wider values now pass through.

### New vs. reused files

- **New:** `src/elements/daw-player.ts`, one small animation controller in
  `src/controllers/`, `src/__tests__/daw-player.test.ts`.
- **Reused as-is:** `interactions/peaks-loader.ts`, `workers/waveformDataUtils.ts`
  (`extractPeaks`), `<daw-waveform>`, `<daw-ruler>`, `<daw-playhead>`, `styles/theme.ts`.
- **Dependency:** add `@waveform-playlist/media-element-playout` as a regular dawcore
  dependency (lightweight, no Tone.js). Run `pnpm install`, commit `pnpm-lock.yaml`.

## Public API

Maps to spec §"`<daw-player>` API" in `docs/specs/web-components-migration.md`.

### Attributes (reflected)

| Attribute | Type | Default | Notes |
|-----------|------|---------|-------|
| `src` | String | — | Audio source URL |
| `peaks-src` | String | — | Pre-computed BBC peaks URL (`.dat`/`.json`) |
| `wave-height` | Number | 128 | Waveform height (px) |
| `timescale` | Boolean | false | Show time ruler |
| `mono` | Boolean | false | Merge channels to a single waveform |
| `bar-width` | Number | 1 | Waveform bar width |
| `bar-gap` | Number | 0 | Waveform bar gap |
| `playback-rate` | Number | 1 | Playback speed, clamped 0.25–4.0 |

`automatic-scroll` is **deferred** (no scroll in the fit-to-width core).

### Properties (JS)

- `isPlaying: boolean` (read-only)
- `currentTime: number` (read/write; setter seeks)
- `duration: number` (read-only)
- `volume: number` (read/write, clamped 0–1)
- `audioElement: HTMLAudioElement` (read-only → `track.element`)

`effects` (#475) and `theme` (CSS custom properties are used instead — the editor has no
`theme` JS property either) are **deferred**.

### Methods

`play()`, `pause()`, `stop()`, `seekTo(time)`, `setPlaybackRate(rate)` (clamps 0.25–4.0),
`setVolume(volume)` (clamps 0–1). All forward to the engine.

`addEffect`/`removeEffect`/`setEffectParams`/`setEffectBypassed`/`moveEffect` are
**deferred** to #475.

### Events

All `CustomEvent`s with the `daw-` prefix, typed in the central `src/events.ts` event
map. Most already exist (reused as-is); the player adds two new entries.

| Event | Fires when | Detail (type in `events.ts`) | Status |
|-------|-----------|------------------------------|--------|
| `daw-ready` | metadata loaded and waveform rendered | `void` | **new** |
| `daw-play` | playback starts | `void` (`CustomEvent<void>`) | reused |
| `daw-pause` | playback pauses | `void` | reused |
| `daw-stop` | playback stops (reset to 0) | `void` | reused |
| `daw-timeupdate` | rAF tick while playing | `{ time }` (`DawTimeUpdateDetail`) | reused |
| `daw-ended` | playback reaches end | `void` | **new** |
| `daw-error` | `src` fails to load | `{ operation, error }` (`DawErrorDetail`) | reused |

`daw-error` already exists in the event map as `DawErrorDetail` (`{ operation: string;
error: unknown }`), so the player **reuses** it (e.g. `{ operation: 'load', error }`)
rather than inventing a new shape — load failures are surfaced, not swallowed.
`daw-ready` and `daw-ended` are the only **new** map entries (both `CustomEvent<void>`).

## Data flow

- **Load.** Setting `src` calls `engine.addTrack({ source: src })`; changing `src`
  later calls `engine.setSource({ source: src })`, which swaps in place via
  `track.load()`. Setting `peaks-src` triggers an independent fetch +
  `extractPeaks` that sets `<daw-waveform>` peaks. Audio duration comes from the
  `loadedmetadata` event, so the engine does not need the peaks.
- **No `peaks-src`.** Scrubber-only: ruler, playhead, and transport all work;
  `<daw-waveform>` renders nothing. No crash.
- **Transport target.** Because the player implements
  `play`/`pause`/`stop`/`seekTo`/`setVolume`/`setPlaybackRate`/`getCurrentTime`, it is
  already a valid `<daw-transport for>` target through the existing duck-typed
  `targetSupports` capability check (#474). Editor-only controls auto-disable against
  it because the player lacks `undo`/`zoomIn`/etc. Formal transport-compat tests are
  deferred to #474.

## Error handling and edge cases

- **`src` load error** → engine emits `error(MediaError)`; the player `console.warn`s
  and dispatches the existing `daw-error` event with `{ operation: 'load', error }`.
- **`peaks-src` fetch/parse failure** → `console.warn`, fall back to scrubber-only;
  playback is unaffected.
- **`playback-rate` / `volume` out of range** → clamp and `console.warn` once.
- **`seekTo` before `loadedmetadata`** → `duration` is 0; guarded (clamp to 0), per the
  documented media-element-playout gotcha.
- **Disconnect** → `disconnectedCallback` cancels the rAF loop, disposes the engine, and
  disconnects the `ResizeObserver`.
- **Immutability** → peak arrays and event-detail objects are created fresh, never
  mutated in place.

## Testing

`packages/dawcore/src/__tests__/daw-player.test.ts`, vitest + happy-dom, registering the
element in `beforeAll` (per the happy-dom custom-element convention), following the
existing `daw-editor-*.test.ts` patterns with a mock `Audio`:

- attribute reflection and clamping (rate, volume);
- `play`/`pause`/`stop`/`seekTo` forward to the engine; each `daw-*` event fires once
  with the correct detail;
- `isPlaying`/`currentTime`/`duration`/`volume`/`audioElement` read correctly;
- `peaks-src` success sets `<daw-waveform>` peaks; failure and absence both fall back to
  scrubber-only without throwing;
- click-to-seek maps pixel → time;
- disconnect tears down the rAF loop and the engine.

## Out of scope

Deferred to later cycles within epic #454:

- Effects chain + lazy AudioContext (#475).
- `<daw-playback-rate>` transport element (#476).
- Formal `<daw-transport>` compatibility tests (#474).
- Annotation children (#477, blocked on annotations epic #455).
- `automatic-scroll`, scroll + zoom, fixed `samples-per-pixel`.
- `theme` JS property and decode-to-peaks fallback.
