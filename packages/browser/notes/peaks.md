# Peaks and sample rate

Notes of Browser Package (`@waveform-playlist/browser`), moved out of the package's `CLAUDE.md`. Read before touching peak generation, the peak worker, `waveformDataLoader.ts`, pre-computed peaks or anything that reads the sample rate.

## Web Worker Peak Generation

**Decision:** Generate `WaveformData` in a web worker at load time, then use `resample()` for near-instant zoom changes.

**Key files:**

- `src/workers/peaksWorker.ts` — Inline Blob worker (portable across bundlers)
- `src/hooks/useWaveformDataCache.ts` — Cache hook, watches tracks for clips with `audioBuffer` but no `waveformData`
- `src/waveformDataLoader.ts` — `extractPeaksFromWaveformDataFull()` for resample + channel extraction

**Peak resolution order (`src/utils/derivePeaks.ts`):** (1) `clip.waveformData` (external pre-computed), (2) worker result for `clip.audioBuffer`, (3) empty peaks while worker runs.

**Peaks and duration are derived during render, never set by an effect (#692).** `duration = useMemo(timelineDuration(tracks))`; `peaksDataArray = useMemo(derivePeaks(...))` over `tracks`, `samplesPerPixel`, `mono` and the worker hook's `version`. `derivePeaks` is a pure function that takes the previous pass (`PeaksCache`, held in `peaksCacheRef`) and reuses three identities, each of which something downstream is keyed on: a clip's typed arrays (`Channel` redraws when they change), its `ClipPeaks` object, and its track's array. The typed arrays are reused while the clip's source waveform data, `offsetSamples`, `durationSamples`, `sampleRate`, `samplesPerPixel` and `mono` are unchanged. Entries are found by clip id and compared on the waveform data's identity (split clips share one buffer but differ in offset and duration); a clip that gets a new id always recomputes. So a trim gives new arrays to the trimmed clip only, and a move gives a new `ClipPeaks` with the same arrays. `isPlaceholder` is in `sameClipPeaks` (a placeholder record is never reused as a loaded clip's). Do not add a field to `ClipPeaks` without adding it to `sameClipPeaks`, or a change to it will not reach the screen. Measured on `/examples/multi-clip` (14 canvases) during a trim: 26 canvas redraws and 3 React commits per pointer move before, 1 and 1 after.

**`useWaveformDataCache` has one piece of state, `version`.** Results live in a `WeakMap<AudioBuffer, WaveformData>` read during render through the stable `getWaveformData(buffer)`; `version` is bumped when a job finishes and is the dependency that makes the peaks memo look again. A `tracks` change over already-generated buffers sets no state (the old `Map<clipId, WaveformData>` state was rebuilt on every `tracks` change, one extra render per trim move). A job keeps running across `tracks` changes; only unmount forgets in-flight jobs, because terminating the worker rejects them (a StrictMode remount then starts them again).

**Automatic:** Any clip with `audioBuffer` (loaded or recorded) gets worker treatment — no opt-in needed.

**A failed job is retried on the next `tracks` change, three attempts per buffer.** A crashed worker is replaced, so a retry can succeed; a buffer that can never succeed (a CSP that blocks blob workers) used to be copied and sent again on every `tracks` change, i.e. every pointer move of a trim. Rejections caused by the unmount's `terminate()` are not counted.

## Pre-Computed Peaks Rate Mismatch

When `clip.waveformData.sample_rate` differs from `clip.sampleRate` (e.g., after `audioBuffer` decodes at hardware rate), Path A in `derivePeaks` converts `offsetSamples`, `durationSamples`, and `samplesPerPixel` to the waveformData's sample space using `ratio = wdRate / clipRate`. This prevents blank peaks when the clip is rebuilt at the decoded audio rate. Path A wins whenever it succeeds, and the worker skips clips that have `waveformData`, so these peaks stay until the clip loses its `waveformData`. `createClip` (called by both direct callers and `createClipFromSeconds`) logs a per-clip warning with the clip name.

## AudioContext Is the Single Source of Truth for Sample Rate

**Rule:** Never derive `sampleRate` from clips or AudioBuffers — use the AudioContext hardware rate. All decoded audio and recordings run at this rate.

- `WaveformPlaylistContext`: `sampleRateRef` seeded from `sampleRate` prop ?? `48000` (provisional, no playout call) during the `useState` initializer. After the adapter is created in `loadAudio`, the ref is reconciled from `adapter.audioContext.sampleRate` (the real hardware rate). A Tone consumer that passes no `sampleRate` prop sees 48000 for the brief pre-first-load window.
- `useAudioTracks`: `contextSampleRateRef` set from `audioContext.sampleRate` in `loadTracks`.
- `useExportWav`: calls `getGlobalAudioContext().sampleRate` directly.
- **Never** fall back to 44100 or derive from `tracks[0].clips[0]?.sampleRate` — that fails in recording-only workflows.

## sampleRate From Context (Not Props)

Internal hooks (`useClipDragHandlers`, `useClipSplitting`) read `sampleRate` from `usePlaylistView()` — do NOT add it as a parameter. `useAnnotationKeyboardControls` takes it as an option and otherwise reads `usePlaylistViewOptional()`, which returns the value under either provider and `null` outside one. `useAnnotationDragHandlers` accepts optional `sampleRate` (defaults to `48000` — tone-free engine default; providers pass the real rate from context) because it's used in both WaveformPlaylist and MediaElement contexts. `SnapToGridModifier` and `calculateBoundaryTrim` are not hooks — they still receive `sampleRate` as a parameter from callers that have context access.

## Aligned Peak Resampling (waveformDataLoader.ts)

**Decision:** When slicing WaveformData before resampling to a different scale, source slice indices must align to the resampling ratio.

**Why:** WaveformData.resample() groups N consecutive source bins per output bin (N = targetScale/sourceScale). If the slice starts at a non-aligned index, output bins cover different source samples than a full-file resample would, causing zoom-dependent peak amplitude.

**Pattern (in both `extractPeaksFromWaveformData` and `extractPeaksFromWaveformDataFull`):**

```typescript
const ratio = samplesPerPixel / sourceScale;
const targetStart = Math.floor(offsetSamples / samplesPerPixel);
const targetEnd = Math.ceil((offsetSamples + durationSamples) / samplesPerPixel);
const sourceStart = Math.floor(targetStart * ratio);
const sourceEnd = Math.min(waveformData.length, Math.ceil(targetEnd * ratio));
// slice(sourceStart, sourceEnd) → resample(targetScale)
// (WaveformData.slice endIndex is exclusive, like Array.slice)
```

**Key invariant:** Floor/ceil slicing ensures all source bins contributing to target bins are included. For integer ratios (power-of-two scales like 256→1024), this gives exact bin-boundary alignment. For non-integer ratios (e.g., 256→1000), first/last bins may be slightly more inclusive than a full-file resample, but never underrepresent peaks.

**Why floor/ceil, not round:** `Math.round` can exclude a partial source bin at either boundary, underrepresenting peaks. `Math.floor` (start) and `Math.ceil` (end) are consistently inclusive — they may include one extra source bin, but the resampler's min/max aggregation makes this the safe direction for waveform visualization. Non-integer ratios are common (default `samplesPerPixel=1000` with `baseScale=256` gives ratio 3.90625).

**Mono merge:** Uses weighted averaging (same as `makeMono` in webaudio-peaks). This is consistent across both packages — do not change to min/max without updating both.

## AudioBuffer Deduplication in Peak Generation

**Decision:** `useWaveformDataCache` deduplicates worker jobs by `AudioBuffer` identity, not clip ID.

**Why:** When a recording is split into many clips sharing the same `AudioBuffer`, per-clip generation causes duplicate `Float32Array.slice()` allocations and OOM on large timelines.

**Implementation:** Two `WeakMap<AudioBuffer, ...>` refs:

- `generatedByBufferRef` — results (`WaveformData`), read during render via `getWaveformData(buffer)`
- `inflightByBufferRef` — in-flight worker promises

**Pattern:** Generate once per buffer; every clip sharing it finds the result by buffer when `version` bumps. `WeakMap` allows GC when `AudioBuffer` is released.

## Shared Clip Pixel Width

Use `clipPixelWidth()` from `@waveform-playlist/core` for any pixel width derived from `startSample`/`durationSamples`/`samplesPerPixel`. Both `Clip.tsx` (container) and `ChannelWithProgress.tsx` (progress overlay) must use this shared function — never `peaksData.length`, which may be shorter than the clip when audio is shorter than configured duration.
