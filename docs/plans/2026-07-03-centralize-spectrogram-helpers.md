# Implementation plan — centralize spectrogram helpers (#560)

TDD throughout: RED (write test, watch fail) → GREEN (minimal delegate) → REFACTOR.

## Step 1 — `@waveform-playlist/core`: canvas-ID contract

1. RED: `packages/core/src/__tests__/spectrogramCanvasId.test.ts`
   - `buildSpectrogramCanvasId` produces `${clipId}-ch${channelIndex}-chunk${chunkIndex}`
   - `parseSpectrogramCanvasId` parses valid IDs; greedy clipId keeps hyphens and
     anchors to the trailing `-ch{N}-chunk{M}`
   - returns `null` on malformed (`bad`, `clip-ch0`, `clip-chunk0`, `chunk0`)
   - roundtrip: `parse(build(x))` deep-equals `x`, incl. `clipId = 'a-ch9-chunk9'`
2. GREEN: `packages/core/src/spectrogramCanvasId.ts` + export from `index.ts`
3. Verify: `pnpm --filter @waveform-playlist/core test`
4. Build core: `pnpm --filter @waveform-playlist/core build`

## Step 2 — `@dawcore/spectrogram`: padded FFT range

1. RED: `packages/dawcore-spectrogram/__tests__/fftSampleRange.test.ts`
   - single chunk; multi contiguous; partial last chunk; clip clamp at both ends;
     ±fftSize padding; floor/ceil rounding
2. GREEN: `packages/dawcore-spectrogram/src/computation/fftSampleRange.ts` +
   export from `computation/index.ts` and package `index.ts`
3. Refactor `SpectrogramOrchestrator.renderGroupOnce` to delegate
4. Verify: `pnpm --filter @dawcore/spectrogram test`
5. Build: `pnpm --filter @dawcore/spectrogram build`

## Step 3 — `@waveform-playlist/spectrogram` (React): delegate

1. `extractChunkNumber` / `parseCanvasId` → thin adapters over
   `parseSpectrogramCanvasId`
2. `computeChunkSampleRange` → thin adapter over `computePaddedFftRange`
3. Update the one `extractChunkNumber('chunk0')` test line to a valid full ID
4. Verify: `pnpm --filter @waveform-playlist/spectrogram test` (existing suite green)

## Step 4 — `@dawcore/spectrogram` worker pool: delegate

1. `parseChannelFromCanvasId` → wrapper over `parseSpectrogramCanvasId`
2. Verify pool tests: `pnpm --filter @dawcore/spectrogram test`

## Step 5 — builders + inline parser

1. `SpectrogramChannel.tsx` — builder (:139) → `buildSpectrogramCanvasId`;
   inline parser (:116) → `parseSpectrogramCanvasId(id)?.chunkIndex`
2. `daw-spectrogram.ts:153` — builder → `buildSpectrogramCanvasId`
3. Verify: `pnpm --filter @waveform-playlist/ui-components test`,
   `pnpm --filter @dawcore/components test`

## Step 6 — full verification

1. `pnpm --filter <each touched pkg> typecheck`
2. `pnpm -w lint` (0 errors)
3. `pnpm build`
4. `git rm` spec + plan before PR merge (per CLAUDE.md)
