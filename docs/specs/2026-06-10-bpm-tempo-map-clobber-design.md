# Fix #407: `editor.bpm` clobbers variable-tempo sessions — Design

**Issue:** [#407](https://github.com/naomiaro/waveform-playlist/issues/407) — `editor.bpm` setter writes the adapter tempo map at tick 0, silently corrupting variable-tempo sessions.

## Problem

Two clobber points exist in `<daw-editor>`:

1. **The `bpm` setter** (`packages/dawcore/src/elements/daw-editor.ts:254`) forwards to
   `engine.setTempo(value)` → `adapter.setTempo(bpm, undefined)` → `transport.setTempo(bpm, tick 0)`,
   overwriting the tick-0 entry of a consumer-installed multi-event tempo map.
2. **`_buildEngine`** (`daw-editor.ts:1670`) unconditionally calls `adapter.setTempo(this._bpm)`
   when the engine is first built — clobbering a curve installed before the first track loads,
   even if the consumer never touches `editor.bpm` after setup.

Secondary effect: `engine.setTempo` also runs `_recomputeStartSamples()`, so a "display BPM"
write mutates clip state.

Observed impact: `beat-map-grid.html` shifted every audio beat off the grid by a constant offset
(97 ms / 51 ms measured). Worked around by ordering in #406; this fix removes the trap.

## Design

### Layer 1 — dawcore: `bpm` is display-only when tick callbacks are present

The presence of **both** `secondsToTicks` and `ticksToSeconds` callbacks is the editor's
established "external tempo map is authoritative" signal (dawcore CLAUDE.md, "Callback
interface, not TempoMap dependency").

- **`bpm` setter:** when both callbacks are set, store `_bpm` and `requestUpdate` as today
  (BPM readout and single-BPM fallback math still use it), but skip `engine.setTempo()`.
  Silent — this is documented behavior, not an error.
- **`_buildEngine`:** same check — skip the initial `adapter.setTempo(this._bpm)` forward
  when both callbacks are present.

Skipping `engine.setTempo` also skips `_recomputeStartSamples()` — correct, because the
authoritative tempo map did not change, so clip `startSample`s are already right. The engine's
internal `_bpm` may diverge from the editor's `_bpm`; harmless, since the engine only consults
its `_bpm` for fallback tick math when the adapter lacks `ticksToSeconds`.

### Layer 2 — transport: defaulted tick-0 writes refuse to clobber a multi-entry map

In `Transport.setTempo(bpm, atTick?)` (`packages/transport/src/Transport.ts:460`):

- When `atTick === undefined` **and** the TempoMap has more than one entry:
  `console.warn` with an actionable message (tempo map has N entries; pass an explicit
  `atTick` to modify it) and return without writing.
- Explicit `atTick: 0` still applies — the escape hatch when the consumer genuinely means it.
- Single-entry maps keep today's behavior exactly — the ordinary "change the session tempo"
  path is untouched.

This protects engine-direct/React consumers and any future defaulted-`setTempo` path,
independent of dawcore.

## Testing

- **dawcore** (happy-dom vitest):
  - `bpm` setter with both callbacks → engine `setTempo` NOT called; `_bpm`/readout still update.
  - `bpm` setter without callbacks → engine `setTempo` called (existing behavior).
  - `_buildEngine` with callbacks → adapter `setTempo` NOT called; without → called.
- **transport** (vitest):
  - Multi-entry map + defaulted `setTempo(bpm)` → warns, map unchanged.
  - Multi-entry map + explicit `atTick: 0` → applies.
  - Single-entry map + defaulted `setTempo(bpm)` → applies (no warn).

## Docs

- Update dawcore CLAUDE.md "Variable Tempo" bullet: the "assign `editor.bpm` BEFORE installing
  a tempo curve" workaround note becomes "with callbacks set, `editor.bpm` is display-only".
- No example changes required — #406's ordering workaround remains harmless.

## Versioning

Patch bumps: `@dawcore/components`, `@dawcore/transport` (both 0.0.x). Check during
implementation which `@waveform-playlist/*` packages pin the bumped transport via
`workspace:*` and flag them for republish per the zerover pinning convention.
