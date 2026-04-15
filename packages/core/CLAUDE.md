# Core Package (`@waveform-playlist/core`)

Framework-agnostic types, pure functions, and utilities shared across all packages. No runtime dependencies.

## Build & Test

- **Build:** `pnpm build` (tsup, auto-externalizes deps)
- **Test:** `cd packages/core && npx vitest run`
- **Typecheck:** `pnpm typecheck`

## Module Map

| File | Purpose |
|---|---|
| `types/clip.ts` | Clip-based model: `AudioClip`, `ClipTrack`, `WaveformDataObject`, `TrackEffectsFunction` |
| `types/index.ts` | Foundation types: `Track`, `Fade`, `FadeType`, `Peaks`, `Bits`, `PeakData` |
| `types/spectrogram.ts` | Spectrogram types: `SpectrogramConfig`, `RenderMode`, `ColorMapValue` |
| `types/annotations.ts` | Annotation types |
| `clipTimeHelpers.ts` | Sample→seconds converters: `clipStartTime`, `clipEndTime`, `clipOffsetTime`, `clipDurationTime`, `clipPixelWidth` |
| `fades.ts` | Fade curve generators (linear, exponential, logarithmic, sCurve) — pure functions for Web Audio `AudioParam` |
| `keyboard.ts` | `KeyboardShortcut` interface + `handleKeyboardEvent` — framework-agnostic shortcut handler |
| `constants.ts` | `MAX_CANVAS_WIDTH` (1000px virtual scroll chunk size) |
| `utils/conversions.ts` | Unit converters: `samplesToSeconds`, `secondsToSamples`, `samplesToPixels`, `pixelsToSamples`, `pixelsToSeconds`, `secondsToPixels` |
| `utils/dBUtils.ts` | Decibel utilities: `gainToDb`, `dBToNormalized`, `normalizedToDb`, `gainToNormalized` |
| `utils/beatsAndBars.ts` | Musical time: `PPQN`, `ticksPerBeat`, `ticksPerBar`, `ticksToSamples`, `samplesToTicks`, `snapToGrid` |
| `utils/musicalTicks.ts` | Grid ticks + snap: `computeMusicalTicks`, `snapToTicks`, `snapTickToGrid`, `SnapTo`, `MusicalTick`, `MusicalTickData`, `MusicalTickParams`, `TickType`, `ZoomLevel`. Re-exports `MeterEntry`. |
| `utils/meterDetection.ts` | `MeterEntry` type, `detectMeterChanges()` — extracts time signature changes from beat number sequences |
| `utils/peaksGenerator.ts` | Peak generation: `generatePeaks`, `appendPeaks` — real-time waveform viz during recording |
| `utils/audioBufferUtils.ts` | AudioBuffer helpers: `concatenateAudioData`, `createAudioBuffer`, `appendToAudioBuffer`, `calculateDuration` |

## Key Patterns

**Sample-based architecture with tick authority:** Timeline positions use `startTick` (authoritative, optional) and `startSample` (derived cache). Duration and offset remain sample-only (`durationSamples`, `offsetSamples`). Engine enriches clips missing `startTick` on ingestion. Use `clipTimeHelpers` for seconds conversion. `clipPixelWidth` uses floor-based endpoint subtraction to guarantee no pixel gaps. `createClipFromTicks()` creates clips with authoritative tick positions.

**Multi-meter grid:** `computeMusicalTicks` accepts `meterEntries: MeterEntry[]` (not `timeSignature`). `MusicalTickData` has `pixelsPerQuarterNote` (not `pixelsPerBeat`/`pixelsPerBar`). `detectMeterChanges()` extracts meter from beat number sequences. `ticksToBarBeatLabel` removed — labels computed inline.

**`gainToDb` vs `gainToNormalized`:** `gainToDb` is the raw gain→dB conversion used by audio nodes (Tone.js `Volume` takes dB). `gainToNormalized` maps gain to 0–1 for UI meters (gain → dB → normalized with configurable floor). Do not duplicate `gainToDb` — it's shared by playout, browser, and dawcore packages.

**`gainToDb` clamps at 0.0001 (−80 dB):** Prevents `Math.log10(0) = -Infinity`. `gainToNormalized` does NOT use `gainToDb` internally — it computes `20 * Math.log10(gain)` directly because `dBToNormalized` already handles `-Infinity` via its floor check, and the clamp would change normalized output for very small gains.

**`trackChannelCount(track)`:** Returns max `audioBuffer.numberOfChannels` across a track's clips. Used by playout (Panner `channelCount`) and browser (Offline output channels, Panner `channelCount`). Prevents mono→stereo upmix and stereo→mono downmix.

**Fade curves:** `fades.ts` generates `Float32Array` curves for `setValueCurveAtTime`. No Tone.js dependency — works with native `AudioParam`. The browser package's `useExportWav` also uses `applyFadeEnvelope` which delegates to these curve types.

**Keyboard shortcuts:** `handleKeyboardEvent` is a pure function — no React dependency. The `undefined` vs `false` distinction in modifier keys matters: `undefined` = match any state, `false` = must NOT be pressed.

**Musical ticks:** `beatsAndBars.ts` uses Tone.js-compatible PPQN (192). `musicalTicks.ts` uses 960 PPQN for finer resolution in snap-to-grid. Both accept PPQN as a parameter.
