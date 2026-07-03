# @waveform-playlist/core

Core types, interfaces and utilities for waveform-playlist — pure functions and TypeScript types with zero runtime dependencies.

Used by nearly every `@waveform-playlist/*` and `@dawcore/*` package (`engine`, `playout`, `media-element-playout`, `browser`, `ui-components`, `recording`, `annotations`, `spectrogram`, `midi`, `transport`, `dawcore`, `dawcore-spectrogram`, `dawcore-midi`, `webaudio-peaks`, `loaders`, and more). Most consumers get it transitively — install it directly only if you're building on the clip model, timeline math, or fade curves yourself.

## Features

- **Clip & track types** — `AudioClip`, `ClipTrack`, `Timeline`, `Fade`/`FadeType`, `Peaks`/`Bits`/`PeakData`, `WaveformDataObject`
- **Sample-based timeline math** — `createClip`/`createClipFromSeconds`/`createClipFromTicks`, clip queries (`getClipsInRange`, `clipsOverlap`, `findGaps`), and second-conversion helpers (`clipStartTime`, `clipEndTime`, `clipPixelWidth`)
- **Fade curves** — linear, exponential, logarithmic, and S-curve generators for native Web Audio `AudioParam` (no Tone.js dependency)
- **Decibel utilities** — gain ↔ dB ↔ normalized-0-1 conversions for meters and volume controls
- **Peaks generation** — real-time min/max peak extraction during recording
- **Musical time** — PPQN tick math, bar/beat conversion, time-signature meter detection, grid snapping
- **Keyboard shortcuts** — a framework-agnostic shortcut matcher shared by the React and Web Components layers
- **Spectrogram canvas-ID contract** — canonical build/parse helpers for the `${clipId}-ch${n}-chunk${m}` canvas ID format shared by the worker pool and rendering layers
- **HTTP range support probing** — detect whether an audio host supports byte-range seeking

## Installation

```bash
npm install @waveform-playlist/core
```

Zero dependencies — safe to install anywhere without pulling in Web Audio, React, or Tone.js.

## Usage

```typescript
import { createClipFromSeconds, clipStartTime, clipEndTime, gainToDb } from '@waveform-playlist/core';

// Build a clip from a decoded AudioBuffer, positioned at 2.5s on the timeline
const clip = createClipFromSeconds({
  audioBuffer,
  startTime: 2.5,
  offset: 0,
  fadeIn: { duration: 0.5, type: 'linear' },
});

clipStartTime(clip); // 2.5
clipEndTime(clip); // 2.5 + audioBuffer.duration

// Convert a linear gain value to dB for a Tone.js Volume node
gainToDb(0.5); // ≈ -6.02
```

```typescript
import { buildSpectrogramCanvasId, parseSpectrogramCanvasId } from '@waveform-playlist/core';

const id = buildSpectrogramCanvasId({ clipId: 'clip-1', channelIndex: 0, chunkIndex: 3 });
// "clip-1-ch0-chunk3"

parseSpectrogramCanvasId(id);
// { clipId: 'clip-1', channelIndex: 0, chunkIndex: 3 }
```

## API

| Module | Key exports |
|---|---|
| `types/` | `AudioClip`, `ClipTrack`, `Timeline`, `Track`, `Fade`, `FadeType`, `Peaks`, `Bits`, `PeakData`, `WaveformDataObject`, `SpectrogramConfig`, `RenderMode`, `ColorMapValue` |
| `clipTimeHelpers` | `clipStartTime`, `clipEndTime`, `clipOffsetTime`, `clipDurationTime`, `clipPixelWidth`, `trackChannelCount` |
| clip constructors (`types/clip`) | `createClip`, `createClipFromSeconds`, `createClipFromTicks`, `createTrack`, `createTimeline`, `getClipsInRange`, `getClipsAtSample`, `clipsOverlap`, `sortClipsByTime`, `findGaps` |
| `fades` | `applyFadeIn`, `applyFadeOut`, `generateCurve`, `linearCurve`, `exponentialCurve`, `logarithmicCurve`, `sCurveCurve` |
| `utils/dBUtils` | `gainToDb`, `dBToNormalized`, `normalizedToDb`, `gainToNormalized` |
| `utils/conversions` | `samplesToSeconds`, `secondsToSamples`, `samplesToPixels`, `pixelsToSamples`, `pixelsToSeconds`, `secondsToPixels` |
| `utils/beatsAndBars` | `PPQN`, `ticksPerBeat`, `ticksPerBar`, `ticksToSamples`, `samplesToTicks`, `snapToGrid` |
| `utils/musicalTicks` | `computeMusicalTicks`, `snapToTicks`, `snapTickToGrid`, `SnapTo`, `MusicalTick` |
| `utils/meterDetection` | `MeterEntry`, `detectMeterChanges` |
| `utils/peaksGenerator` | `generatePeaks`, `appendPeaks` |
| `utils/audioBufferUtils` | `concatenateAudioData`, `createAudioBuffer`, `appendToAudioBuffer`, `calculateDuration` |
| `keyboard` | `KeyboardShortcut`, `handleKeyboardEvent`, `getShortcutLabel` |
| `spectrogramCanvasId` | `buildSpectrogramCanvasId`, `parseSpectrogramCanvasId`, `SpectrogramCanvasIdParts` |
| `probeRangeSupport` | `probeRangeSupport`, `RangeSupport` |
| `constants` | `MAX_CANVAS_WIDTH` |

## Examples & Documentation

- Guides: [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/)

## License

MIT
