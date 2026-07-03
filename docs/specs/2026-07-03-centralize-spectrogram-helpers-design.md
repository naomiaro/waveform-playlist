# Centralize spectrogram FFT-range math + canvas-ID contract (#560)

**Status:** Design approved
**Ticket:** #560 (follow-up from PR #559 review)

## Problem

Two pieces of spectrogram logic are maintained in multiple packages; a change to
one copy silently diverges the pipelines — the #554/#556 drift bug class, with no
cross-package test to catch it.

1. **Padded FFT sample-range math** — duplicated between
   `SpectrogramOrchestrator.renderGroupOnce` (`@dawcore/spectrogram`) and
   `computeChunkSampleRange` (`@waveform-playlist/spectrogram`). Both compute the
   clip-relative-pixels → `offsetSamples + px·spp` → `fftSize`-padded, clip-clamped
   sample range. A padding/clamping change to one copy makes the two pipelines
   compute different FFT ranges for the same chunks.

2. **Canvas-ID `${clipId}-ch${channelIndex}-chunk${n}` contract** — 4 independent
   parsers + 2 independent builders over the same string format:
   - parse: `parseChannelFromCanvasId` (worker pool), `extractChunkNumber` +
     `parseCanvasId` (React helpers), inline `/chunk(\d+)$/` (SpectrogramChannel).
   - build: `SpectrogramChannel.tsx` (React), `daw-spectrogram.ts` (Lit).

   A format change updated in some-but-not-all sites trips the pool's no-match
   fallback (route to worker 0 → channel 0's data for every channel, #556) with
   only a `console.warn` as signal.

## Design

### Piece 1 — Padded FFT range → `@dawcore/spectrogram`

New pure module `packages/dawcore-spectrogram/src/computation/fftSampleRange.ts`:

```ts
export interface PaddedFftRangeParams {
  /** Chunks in the render group: clip-relative chunk index + rendered pixel width. */
  chunks: Array<{ chunkIndex: number; widthPx: number }>;
  /** FFT window size (samples), padding the range against edge artifacts. */
  fftSize: number;
  offsetSamples: number;
  durationSamples: number;
  samplesPerPixel: number;
}
export function computePaddedFftRange(p: PaddedFftRangeParams): {
  paddedStart: number;
  paddedEnd: number;
};
```

Body is the exact current math:
`startPx = min(chunkIndex·MAX_CANVAS_WIDTH)`,
`endPx = max(chunkIndex·MAX_CANVAS_WIDTH + widthPx)`,
`startSample = offset + floor(startPx·spp)`,
`endSample = min(offset+duration, offset + ceil(endPx·spp))`,
`paddedStart = max(offset, startSample − fftSize)`,
`paddedEnd = min(offset+duration, endSample + fftSize)`.

Exported from the package index and `computation/index.ts`.

- **Orchestrator** `renderGroupOnce` delegates, keeping `clipRelativeOffsets` for
  the subsequent `renderChunks` call.
- **React** `computeChunkSampleRange` becomes a thin adapter mapping
  `indices` → `{ chunkIndex: extractChunkNumber(id), widthPx }`, then calling the
  canonical helper. Behavior-identical for contiguous groups (only the last chunk
  can be narrower, and it is the max-index one, so `max(offset_i + width_i)`
  equals the old `maxChunk·MAX + lastChunkWidth`).

### Piece 2 — Canvas-ID contract → `@waveform-playlist/core`

`core` is zero-dep and already a dependency of all six sites (unlike
`@dawcore/spectrogram`, which `ui-components` does not depend on). The ID format
is a pure string contract with no FFT/compute dependency, so `core` — already home
to `MAX_CANVAS_WIDTH` — is the correct shared home. This deviates from the ticket's
literal "export from `@dawcore/spectrogram`" but is the only location reachable by
both builders (the format *producers*), which is required to actually kill the drift.

New pure module `packages/core/src/spectrogramCanvasId.ts`:

```ts
export interface SpectrogramCanvasIdParts {
  clipId: string;
  channelIndex: number;
  chunkIndex: number;
}
export function buildSpectrogramCanvasId(parts: SpectrogramCanvasIdParts): string;
export function parseSpectrogramCanvasId(canvasId: string): SpectrogramCanvasIdParts | null;
```

One anchored regex `/^(.+)-ch(\d+)-chunk(\d+)$/` — greedy clipId matches the
trailing `-ch{N}-chunk{M}` segment (same anchoring intent as today's
`parseChannelFromCanvasId`/`parseCanvasId`). Exported from core's barrel.

All six sites delegate:

| Site | Change |
|---|---|
| `parseChannelFromCanvasId` (worker pool) | wrapper → `parsed?.channelIndex ?? (warn, 0)` |
| `extractChunkNumber` (React) | wrapper → `parsed?.chunkIndex ?? (warn, 0)` |
| `parseCanvasId` (React) | wrapper → `parsed && { clipId, channelIndex }` |
| `SpectrogramChannel.tsx:116` inline parser | `parseSpectrogramCanvasId(id)?.chunkIndex` |
| `SpectrogramChannel.tsx:139` builder | `buildSpectrogramCanvasId({ clipId, channelIndex, chunkIndex: canvasIdx })` |
| `daw-spectrogram.ts:153` builder | `buildSpectrogramCanvasId({ clipId, channelIndex, chunkIndex: i })` |

**No cross-package re-exports** (repo rule): the local
`extractChunkNumber`/`parseCanvasId`/`parseChannelFromCanvasId` remain *local* thin
adapters (not re-exports), so their call sites and signatures are untouched.

**One intentional behavior tightening:** `extractChunkNumber('chunk0')` — a
malformed ID with no `-ch{N}-` segment — currently returns `0` silently via the
loose `/chunk(\d+)$/`. Through the strict parser it returns `0` *and warns*. Real
canvas IDs are always full-format, so no production path changes; the one test line
asserting the loose case is updated to a valid full ID.

## Testing (TDD)

- `packages/core/src/__tests__/spectrogramCanvasId.test.ts` — build, parse,
  **build∘parse roundtrip** (including clipIds containing `-ch`/`-chunk`
  substrings), `null` on malformed. The roundtrip is the cross-package regression
  guard the ticket says is missing.
- `packages/dawcore-spectrogram/__tests__/fftSampleRange.test.ts` — single /
  multi-contiguous / partial-last-chunk / clip-clamp / padding cases.
- `packages/spectrogram/src/__tests__/spectrogram-helpers.test.ts` — updated
  `extractChunkNumber` line; all other assertions unchanged.

## Build ordering

`core` is upstream of `dawcore-spectrogram`, `spectrogram`, `ui-components`,
`dawcore`. Build `core` then `@dawcore/spectrogram` before running downstream
vitest/typecheck (dist-resolution gotcha in CLAUDE.md).

## Out of scope

No changes to the render pipeline, worker protocol, or public component props.
Pure de-duplication behind identical behavior.
