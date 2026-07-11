# Annotation Tick Positions (PPQN) + Label-less Regions — Design

**Date:** 2026-07-11
**Status:** Approved design, pre-implementation
**Builds on:** the annotation web components shipped in PR #607 (#455). Related follow-up: #609 (diff-guard tightening) may land alongside if convenient, but is not required by this design.

## Summary

Add musical (tick/PPQN) positioning to `<daw-annotation>` — mirroring the clip dual-timebase precedent (`startTick` authoritative, time-domain value derived) — so annotations on musical pieces stay on their bars when tempo changes and align pixel-exactly with the beats grid. Officially support label-less annotation bars and list-less annotation tracks for data-only region marking. Add a dawcore Sonnet 18 demo recreating the classic React annotations example.

## Decisions

1. **Data model:** dual-timebase mirroring clips. Optional `start-tick`/`end-tick` attributes, authoritative when BOTH present; `start`/`end` seconds remain as a derived, reflected cache. Mixed tracks (tick + seconds annotations) allowed.
2. **Snapping:** tick-annotation boundary drags honor `editor.snapTo` via core `snapTickToGrid` (beats mode), same feel as clip drags. Keyboard nudges stay fine-grained (no snap).
3. **Blank text / optional list:** already architecturally true; made contractual with tests, a muted list-row placeholder for empty text, and docs. `<daw-annotation-list>` is optional by design.
4. **Approach:** tick-native boundary math via parameterized constants in the shared core function (Approach A). No convert-at-edges rounding, no new element.
5. **Sonnet demo:** in scope — `examples/dawcore-native/sonnet.html` recreating the React example from its inline aeneas data.

## Element API (`<daw-annotation>`)

- New optional attributes `start-tick` / `end-tick`: `@property({ type: Number, noAccessor: true, reflect: true })`, validated (finite integer ≥ 0; warn + reject otherwise), `null` when absent.
- `get isTickBased(): boolean` — true iff both tick attributes are set. Exactly one set → `console.warn` once per element, treated as seconds-based.
- `toAnnotationData()` adds `startTick`/`endTick` when tick-based. Core `AnnotationData` gains optional `startTick?: number; endTick?: number` members (non-breaking).
- `daw-annotation-update` fires on tick-attribute changes too (same changed-property mechanism).

## Authority & Derivation

For tick-based annotations, ticks are authoritative; `start`/`end` seconds are a derived cache kept fresh by the **editor** (sole owner of tick↔seconds conversion, including variable-tempo callbacks):

- `AnnotationController` derives seconds on: annotation connect, annotation update (tick change), and tempo-affecting engine statechange (BPM change). Write-only-on-change keeps the update-event loop idempotent (write → `daw-annotation-update` → sweep → values unchanged → settle).
- Downstream time-domain consumers are untouched: the list panel, `playActive`, click-to-seek, `maxAnnotationEndSeconds` (timeline extent) all read the seconds cache.
- Outside a host editor there is no tempo context: the seconds attributes stay as-authored. Documented limitation.

## Boundary Editing (tick-native)

- Core `updateAnnotationBoundaries` gains an optional third parameter `options?: { linkThreshold?: number; minDuration?: number }` defaulting to the existing constants (`LINK_THRESHOLD` 0.01, `MIN_ANNOTATION_DURATION` 0.1) — fully non-breaking; existing tests prove it.
- Tick-space runs use `{ linkThreshold: 0.5, minDuration: ppqn / 32 }` (ticks are integers, so "closer than 0.5" means equal; ppqn/32 = a 128th note minimum duration). Constants exported from core as `ANNOTATION_LINK_THRESHOLD_TICKS` and `annotationMinDurationTicks(ppqn)`.
- Callers map tick annotations to `{ start: startTick, end: endTick }` for the math and write results back to tick attributes plus re-derived seconds (extend `applyBoundaryResults` to handle tick-based targets).
- **Mixed-track rule:** link/collision math runs in the dragged (or nudged) annotation's unit space; neighbors are converted into that space for the computation and results are written back in each annotation's own authoritative unit.
- **Snap:** beats mode + `editor.snapTo ≠ 'off'` → the dragged edge tick passes through `snapTickToGrid(edgeTick, snapTo, meterEntries, ppqn)` before the boundary math. Temporal mode and seconds-based annotations: unchanged free drag.
- **Keyboard:** `moveStartBoundary(deltaMs)` / `moveEndBoundary(deltaMs)` API unchanged; for tick annotations the ms delta converts to ticks at the edge's local tempo, no snapping (fine adjustment).

## Rendering

- **Temporal mode: no changes.** Tick annotations render from their (always-fresh) seconds cache.
- **Beats mode:** `boxGeometry` branches for tick-based annotations: `left = Math.round(startTick / ticksPerPixel)`, `width = Math.round(endTick / ticksPerPixel) − left` — the identical math clips use, so tick annotations align pixel-exactly with `<daw-grid>`. This removes the documented lane-drift limitation for tick-based annotations; it remains only for seconds-based annotations under variable tempo (docs updated accordingly).

## Lane Box Labels (`box-label` attribute)

The React annotations example renders the annotation **id** in the timeline box and the full text only in the list (`AnnotationText.tsx:299` vs `:335`). To recreate that faithfully while preserving the shipped text-in-bar behavior, `<daw-annotation-track>` gains a `box-label` enum attribute (reflected string):

- `"text"` (default — current behavior): box shows the annotation's text.
- `"id"`: box shows the annotation's `id` attribute when set, else its 1-based position in the track. Sonnet-style: short ids in the bars, full lines in the list.
- `"none"`: box renders no label — pure region bar even when text exists for the list.

The controller's lane template reads `track.boxLabel` per track. The list is unaffected (always full text).

## Label-less Regions & Optional List (contractual)

- Empty-text `<daw-annotation start-tick end-tick></daw-annotation>` renders as a clean bar (already works; gains tests).
- A `<daw-annotation-track>` with no linked `<daw-annotation-list>` is fully functional (already true; gains a test + explicit docs).
- When a list IS present, empty-text rows render a muted "—" placeholder (CSS `:empty::before` or equivalent) so they stay visible, clickable, and editable; committing empty text clears a label.

## Demos

1. **`examples/dawcore-native/beats-grid.html`** (existing beats-mode demo): add a tick-based, label-less annotation region track — bar-aligned sections (`start-tick`/`end-tick`, blank text, NO `<daw-annotation-list>`) — demonstrating tick positioning against `<daw-grid>`, snap-on boundary dragging, and data-only region marking, all in the mode where they matter. The existing temporal `annotations.html` demo is untouched.
2. **`examples/dawcore-native/sonnet.html`** (new): recreates the classic React Sonnet 18 annotations example (seconds-based — aeneas timings are time-domain). Inlines the aeneas-format `defaultNotes` array from `website/src/components/examples/AnnotationsExample.tsx` (line ~41) and builds `<daw-annotation>` elements in a module script (no package import needed — the begin/end/lines mapping is three fields); audio `/media/audio/sonnet.mp3` (already in `website/static`, the examples' publicDir). Editable, link-endpoints, keyboard-controls, `box-label="id"` (aeneas ids in the bars, full lines only in the list — matching the React example), with a `<daw-annotation-list>`. Listed in the demo index + README.

## Error Handling

- Invalid tick values (non-integer, negative, non-finite): warn + reject (validated-property standard).
- Exactly one tick attribute: warn once, annotation treated as seconds-based until both are present.
- Tick annotations outside a host editor: seconds cache stays as-authored; no derivation, no errors.
- Derivation sweep is loop-safe via write-only-on-change.

## Testing

- **Core:** `updateAnnotationBoundaries` options parameter — defaults preserve existing behavior (existing suite unmodified); tick-unit runs (integer positions, linkThreshold 0.5, minDuration 30 @ ppqn 960) cover link cascade, collision, min-duration in tick space.
- **dawcore (happy-dom):** tick attribute validation + `isTickBased` rules (both/one/none); `toAnnotationData` tick fields; derive sweep on connect and BPM change (seconds rewritten, loop settles); beats-mode `boxGeometry` tick branch (exact clip-math parity values); drag in tick space honoring `snapTo` (mock host with beats fields per dawcore test conventions); mixed-track link math across unit spaces; `moveStartBoundary` ms→tick conversion; blank-text bar rendering; list-less track functionality; empty-row placeholder; `box-label` modes (text default / id-with-fallback-to-position / none) rendering the right lane label while the list stays full-text.
- **Real browser (beats mode):** drag a tick annotation with snap on → edges land on grid lines; change BPM → annotations stay on their bars while the list's times update; sonnet page: lines display/edit/seek correctly, Enter plays a line and stops.

## Documentation (same PR)

- `docs/specs/web-components-migration.md`: `<daw-annotation>` attribute table (+`start-tick`/`end-tick`, authority rule), boundary-constraint notes (tick min duration, snap), narrowed lane-drift limitation.
- `packages/dawcore/COMPONENTS.md` + `packages/dawcore/CLAUDE.md`: attribute entries, dual-timebase gotcha (mirror of the clip `startTick` pattern), derive-sweep note.
- Root `README.md` + `examples/dawcore-native/index.html`: sonnet demo entries.
- Changesets: `@waveform-playlist/core` (patch — additive options param + optional fields + constants, consistent with the pending annotation changeset), `@dawcore/components` (patch, zerover).

## Out of Scope

- Musical (bar.beat) time display in `<daw-annotation-list>` — future nicety.
- Aeneas import/export helpers on the WC surface (consumers use `parseAeneas` from `@waveform-playlist/annotations` or inline mapping).
- `<daw-player>` annotation hosting (#477).
- Branded Tick type (existing future-work memory).
