# WAM Community Library: Category-Aware Picker

**Date:** 2026-06-11
**Status:** Approved

## Problem

The dawcore-wam example's community library picker lists all 58 registry
entries identically. Clicking an instrument-only plugin (no audio input)
fails at load time with `createWamInstance: plugin ... has no audio input
(hasAudioInput=false)`. 17 of 58 entries (Instrument: 5, MIDI: 8, Video: 4)
fail this way — a third of the picker is a trap.

## Key Finding

Every entry in the webaudiomodules.com community `plugins.json` carries a
`category` array (`Effect: 38`, `MIDI: 8`, `Instrument: 5`, `Video: 4`,
`Modulation: 3`). This is the only cheap pre-load signal: fetching each
plugin's descriptor for ground-truth `hasAudioInput` would mean 58 network
requests, and many plugins only expose their descriptor after instantiation.
`fetchWamLibrary` currently drops `category` during parsing.

## Design

### 1. `@dawcore/wam` — pass `category` through (`src/library.ts`)

- Add `category?: string[]` to `WamLibraryEntry`.
- In `parseObjectEntry`, accept `raw.category` as:
  - a string array — filter non-string items (same pattern as `keywords`), or
  - a bare string — wrap in a single-element array.
- Malformed values are omitted, never a skip/warning — matching the other
  optional fields (description, vendor, thumbnail, keywords).
- Unit tests in `__tests__/library.test.ts`: array passthrough, bare-string
  normalization, malformed values dropped, absent field stays absent.

No filtering option on `fetchWamLibrary` itself: it is a generic manifest
parser; insertability is consumer policy (an instrument host would want the
opposite filter).

### 2. `examples/dawcore-wam/index.html` — grouped picker

- Partition entries: **insertable** = categories include `Effect` or
  `Modulation`, *or* the entry has no category data (other registries this
  loader supports lack the field — don't penalize them).
- Render insertable entries first (rows unchanged), then a dimmed section
  with a header: "Instruments / MIDI / Video — can't be inserted into an
  effects chain".
- Dimmed rows: no click handler, reduced opacity.

### Escape hatch / safety net

Category is a heuristic. A miscategorized plugin can still be loaded via the
URL input above the picker, and `createWamInstance`'s descriptor validation
remains the real gate for anything that slips through.

## Out of Scope

- Per-plugin descriptor fetching.
- Library-level category filtering API.
- Version bumps / publishing (code change only unless requested).

## Verification

- `cd packages/dawcore-wam && npx vitest run` (new + existing library tests)
- `pnpm --filter @dawcore/wam typecheck`
- Manual: `pnpm example:dawcore-wam`, browse community library, confirm
  grouping and that instrument rows are inert.
