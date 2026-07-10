# Annotation Web Components — Design

**Issue:** #455 (epic)
**Date:** 2026-07-10
**Status:** Approved design, pre-implementation
**Out of scope:** `<daw-player>` annotation hosting (#477 — follow-up that depends on this work).

## Summary

Add annotation web components to `@dawcore/components`: `<daw-annotation-track>`, `<daw-annotation>`, and `<daw-annotation-list>`, with a single-source-of-truth dual-view model and keyboard controls, hosted by `<daw-editor>`. The framework-agnostic boundary-editing math currently embedded in the React hook `useAnnotationControls` (`@waveform-playlist/annotations`) is extracted to `@waveform-playlist/core` and shared by both surfaces.

Authoritative API reference: `docs/specs/web-components-migration.md` sections "Optional Elements", "`<daw-annotation-track>` API", and "Annotation Keyboard Controls". This document records the architecture and implementation decisions; the migration spec defines the public API shapes.

## Decisions

1. **Scope:** all three elements + keyboard controls, integrated into `<daw-editor>`. #477 (`<daw-player>`) is a follow-up.
2. **Packaging:** extract the pure boundary-update logic to `@waveform-playlist/core` (which already holds annotation types and the framework-agnostic keyboard handler). No new `@dawcore/annotations` package — the reusable logic is ~150 lines of pure functions, below the threshold that justifies the `@dawcore/X` split convention. Aeneas parsers stay in `@waveform-playlist/annotations` (the WC elements read DOM attributes, not Aeneas files).
3. **List editing scope:** inline text editing (contenteditable, only when the linked track is `editable`) + click-to-seek. Per-item action buttons (delete, custom actions) are future work.
4. **Architecture:** data-element pattern (Approach A). `<daw-annotation-track>` / `<daw-annotation>` are light-DOM data elements like `<daw-track>` / `<daw-clip>`; `<daw-editor>` renders the annotation lane inside its shadow-DOM timeline; `<daw-annotation-list>` is a standalone shadow-DOM element linked via `for`.

## Core Extraction (`@waveform-playlist/core`)

New module `src/annotations/boundaries.ts`:

- `updateAnnotationBoundaries(params): AnnotationData[]` — pure function lifted verbatim in behavior from `useAnnotationControls` in `@waveform-playlist/annotations`: link-endpoints cascade (both directions), collision push-back with cascade, 0.1s minimum duration, 10ms `LINK_THRESHOLD`, clamped to `[0, duration]`.
- `LINK_THRESHOLD` and `MIN_ANNOTATION_DURATION` exported constants.

New module `src/annotations/shortcuts.ts`:

- `AnnotationShortcutMap` interface (per the migration spec) and the default annotation key-binding table, so the dawcore element and any future consumer share one definition. Reuses the existing `KeyBinding`-compatible shapes from `keyboard.ts`.

`@waveform-playlist/annotations`' `useAnnotationControls` refactors to delegate to the core function. No behavior change; the existing React test suite must keep passing unmodified — that is the parity proof. Per the no-cross-package-re-export rule, the annotations package does not re-export the core function; the hook consumes it internally.

Build-order note: core must be rebuilt before dependent typechecks/tests (`pnpm --filter @waveform-playlist/core build`).

## Elements

### `<daw-annotation>` — light-DOM data element

- Attributes: `start`, `end` (Numbers, seconds), optional `id`. Auto-generated `annotationId` when no id given (same pattern as `<daw-clip>.clipId`).
- Text content is the annotation text.
- Validated numeric properties (project standard, `noAccessor` + warn-and-reject): `start ≥ 0`, `end > start` invariants enforced at write time where expressible; cross-field validation happens in the shared boundary function.
- Dispatches `daw-annotation-connected` (deferred via `setTimeout(0)`) and `daw-annotation-update` on reflected property change — mirroring `<daw-clip>` lifecycle events.
- **Its attributes + text are the single source of truth.** No parallel state store exists anywhere.

### `<daw-annotation-track>` — light-DOM data element + API host

- Attributes (reflected booleans, default false): `editable`, `link-endpoints`, `continuous-play`, `keyboard-controls`.
- Properties (JS only): `activeAnnotationId: string | null`, `annotationShortcuts: AnnotationShortcutMap | null` — accessor pairs with cache invalidation + the upgrade-property dance in `connectedCallback` (precedent: `<daw-keyboard-shortcuts>` remap properties).
- Methods (per migration spec): `selectNext()`, `selectPrevious()`, `selectFirst()`, `selectLast()`, `clearSelection()`, `playActive()`, `moveStartBoundary(deltaMs)`, `moveEndBoundary(deltaMs)`.
- Host resolution: `closest('daw-editor')` (light-DOM child — same rule as `<daw-keyboard-shortcuts>`).
- Dispatches `daw-annotation-track-connected` on mount (deferred). Removal detected by the editor's MutationObserver (detached elements can't bubble).
- Methods mutate `<daw-annotation>` child attributes (through the core boundary function for boundary moves); rendering reacts to the mutations. Selection is broadcast via `daw-annotation-select` (detail `{ annotation: AnnotationData | null }`, bubbling + composed).
- Navigation wraps (next after last → first). Boundary methods no-op with a warn unless `editable`.

### `<daw-annotation-list for="track-id">` — standalone shadow-DOM element

- Resolves its `<daw-annotation-track>` via `document.getElementById` (same pattern as `<daw-transport for>`), re-resolving lazily to tolerate late upgrades; warns on interaction when unresolvable.
- Renders a scrollable panel: one row per annotation (formatted start–end times + text).
- Click on a row: selects (delegates to the track's selection) and seeks the host editor to the annotation start.
- When the linked track has `editable`: text is contenteditable; commit on blur/Enter writes back to the `<daw-annotation>` textContent.
- Auto-scrolls to center the active row on selection change.
- Observes the track subtree (MutationObserver: `childList`, `attributes` for start/end, `characterData`) and listens for `daw-annotation-select` to re-render/highlight.

## Editor Integration

New `AnnotationController` — a Lit reactive controller on `<daw-editor>` (pattern: `RecordingController`), plus a rendering helper module, keeping `daw-editor.ts` growth minimal (file-size budget rule).

- The editor listens for `daw-annotation-track-connected` and registers the track; its MutationObserver handles removal (same as `<daw-track>`).
- Renders one **annotation lane** per registered annotation track: a fixed-height row (32px, exported TS constant `ANNOTATION_LANE_HEIGHT` — a numeric constant, not a CSS var, because the frozen-panes controls-column spacer and the beats-grid `top` offset need it in layout math) rendered above the audio track rows, inside `.timeline` — so horizontal scroll, zoom (`samplesPerPixel` / beats-mode tick math), and the playhead crossing come for free from the frozen-panes layout.
- Boxes positioned `left = start * sampleRate / spp`, `width` from `end − start` (beats mode uses the editor's existing seconds→ticks path for pixel derivation).
- The controls column renders a matching-height spacer row so row alignment between the frozen panes holds (both `box-sizing: border-box`, identical borders — per the frozen-panes rule).
- When `editable`: boundary drag handles on each box. Pointer flow: pointerdown/move/up/**pointercancel** with the 3px `DRAG_THRESHOLD`, capture-release in try/catch — per the established pointer conventions. Drag delta → seconds → core `updateAnnotationBoundaries` → controller writes changed `start`/`end` attributes back to the `<daw-annotation>` elements.
- Box click (no drag): select + seek.
- Theming: `--daw-annotation-box-background`, `--daw-annotation-box-border`, `--daw-annotation-active-background`, `--daw-annotation-text-color` CSS custom properties with dark-theme defaults matching the existing palette.

### Data flow (single source of truth)

```
            writes                       reads (reactive)
 drag box ────────┐                 ┌──→ editor annotation lane (Lit re-render
 list text edit ──┼─→ <daw-annotation> ─┤    on daw-annotation-update)
 keyboard nudge ──┤   attributes +      └──→ <daw-annotation-list>
 methods API ─────┘   textContent            (MutationObserver)
```

Selection (`activeAnnotationId`) is deliberately **not** DOM data — it is ephemeral UI state on `<daw-annotation-track>`, broadcast via `daw-annotation-select`; both views use it for highlight + auto-scroll.

### Playback

- `editor.play(startTime?)` gains an optional second parameter: `play(startTime?, endTime?)`, forwarded to `engine.play(start, end)` (the engine already supports an end time). This is an additive, backward-compatible change.
- `playActive()`: with `continuous-play` off → `editor.play(start, end)` (stops at the annotation end); with it on → `editor.play(start)` (rolls through subsequent annotations).
- Click-to-seek (lane box or list row): select + `editor.seekTo(start)` semantics (existing seek path, including seek-while-playing settle suppression).

## Keyboard Controls

- Enabled by the `keyboard-controls` attribute; listener registered on `document` in the **capture phase**. `<daw-keyboard-shortcuts>` remains bubble-phase — capture-before-bubble gives the deterministic "annotation shortcuts run first" priority ordering the migration spec requires.
- If an annotation is selected and the key matches an annotation action: handle + `stopPropagation()` (editor-level shortcuts never fire).
- Navigation keys act with no selection too (`ArrowDown`/`ArrowRight` with nothing selected selects the first annotation). `Escape` with **no** selection is NOT consumed — it falls through to editor shortcuts, producing the spec's two-press behavior (first Escape clears selection, second stops playback).
- Boundary-editing keys (`[`, `]`, `{`, `}`) require `editable`; ±10ms via `moveStartBoundary`/`moveEndBoundary` (deltaMs = ±10).
- Standard shortcut hygiene (same as `<daw-keyboard-shortcuts>`): ignore key repeat; ignore events originating from `<input>`, `<textarea>`, contentEditable (so list text editing can never trigger shortcuts); case-insensitive matching; first match wins. Implemented on top of `handleKeyboardEvent` from core.
- Remapping via the `annotationShortcuts` property (null restores defaults); partial maps override only the named actions. Multiple annotation tracks may each enable `keyboard-controls` independently — shortcuts are scoped per track instance.

## Error Handling

- Invalid numerics (`NaN`, negative, non-finite) on `start`/`end`: warn + reject (validated-property standard). Cross-field constraints (min 0.1s duration, `end ≤ timeline duration`, ordering) are enforced inside the shared core boundary function so every writer agrees.
- `<daw-annotation-track>` outside `<daw-editor>`: warn once; the list still renders (it only needs the track element); playback-dependent methods (`playActive`, seek) warn and no-op.
- `<daw-annotation-list for>` unresolvable: renders empty, warns on interaction (transport-button pattern), re-resolves per interaction.
- Runtime annotation add/remove: MutationObserver keeps lane + list in sync; selection is cleared if the active annotation is removed.

## Testing

TDD throughout (red → green → refactor):

1. **Core unit tests** (`packages/core`): `updateAnnotationBoundaries` — link cascade in both directions, collision push cascade, min-duration clamps, duration/zero clamps, threshold behavior.
2. **React parity**: `@waveform-playlist/annotations` existing suite passes unmodified after the hook delegates to core.
3. **dawcore vitest (happy-dom)**: element registration + upgrade; attribute→lane render data; dual-view sync (attribute mutation updates both views); list text-edit commit path; selection navigation incl. wrapping and cleared-on-removal; keyboard capture-vs-bubble priority and the Escape two-press rule; remapping (incl. the accessor upgrade dance); `playActive` with/without `continuous-play` using the `makeMockAdapter` reference mock; boundary methods gated on `editable`.
4. **Real-browser verification**: new annotations demo page in `examples/dawcore-native` — drag editing, scroll/zoom alignment, keyboard flows (happy-dom cannot verify pointer capture or layout).

## Documentation Updates (same PR)

- `docs/specs/web-components-migration.md`: mark annotation elements implemented; correct any drift discovered during implementation.
- `packages/dawcore/COMPONENTS.md` + `packages/dawcore/CLAUDE.md`: element entries.
- Root `README.md` demo list + example page listing (new demo page).
- `website/static/llms.txt` / `website/docs/llm-reference.md` if dawcore surfaces are listed there.

## Release Notes (post-merge)

- `@waveform-playlist/core` gains exports → patch bump; changesets computes the exact-pin dependent cascade.
- `@waveform-playlist/annotations` internal refactor → patch bump.
- `@dawcore/components` new elements → 0.0.x patch (zerover convention).
