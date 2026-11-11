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
| `panStage` | `createPanStage`, `panMatrix`, `PanStage`, `PanMatrix`, `PanStageContext` |
| `utils/dBUtils` | `gainToDb`, `dBToNormalized`, `normalizedToDb`, `gainToNormalized` |
| `utils/conversions` | `samplesToSeconds`, `secondsToSamples`, `samplesToPixels`, `pixelsToSamples`, `pixelsToSeconds`, `secondsToPixels` |
| `utils/beatsAndBars` | `PPQN`, `ticksPerBeat`, `ticksPerBar`, `ticksToSamples`, `samplesToTicks`, `snapToGrid` |
| `utils/musicalTicks` | `computeMusicalTicks`, `snapToTicks`, `snapTickToGrid`, `SnapTo`, `MusicalTick` |
| `utils/meterDetection` | `MeterEntry`, `detectMeterChanges` |
| `utils/peaksGenerator` | `generatePeaks`, `appendPeaks` |
| `utils/audioBufferUtils` | `concatenateAudioData`, `createAudioBuffer`, `appendToAudioBuffer`, `calculateDuration` |
| `utils/latency` | `resolveRecordingOffsetSamples` — override-vs-auto recording latency compensation (shared by React + dawcore) |
| `utils/carveClipRange` | `carveClipRange` — punch-in replace: carve a sample range out of a clip list (trim/remove/split) |
| `keyboard` | `KeyboardShortcut`, `handleKeyboardEvent`, `getShortcutLabel` |
| `spectrogramCanvasId` | `buildSpectrogramCanvasId`, `parseSpectrogramCanvasId`, `SpectrogramCanvasIdParts` |
| `probeRangeSupport` | `probeRangeSupport`, `RangeSupport` |
| `enumerateMicrophones` | `enumerateMicrophones`, `watchMicrophoneDevices`, `MicrophoneEnumeration` — permission-free device listing with `supported`/`hasLabels` flags (labels are browser-redacted pre-permission) |
| `constants` | `MAX_CANVAS_WIDTH` |

## Examples & Documentation

- Guides: [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/)

## License

MIT

## Pan stage

`createPanStage(audioContext, pan, sourceChannelCount)` builds a track's pan stage from plain gain, splitter and merger nodes. Every renderer in this project pans with it — the native transport, the Tone.js adapter and both offline exports — instead of a Web Audio `StereoPannerNode` or a Tone.js `Panner`.

```typescript
import { createPanStage, trackChannelCount } from '@waveform-playlist/core';

const stage = createPanStage(audioContext, track.pan, trackChannelCount(track));
faderNode.connect(stage.input);
stage.output.connect(muteNode);

stage.setPan(-0.5);
stage.setSourceChannelCount(2); // the track gained a stereo clip
stage.dispose();
```

Why not the built-in nodes:

- **`StereoPannerNode`** chooses its pan law from the signal it receives: equal-power for mono input (−3 dB per side at centre), the stereo law for stereo input (unity at centre). Track effects are pre-fader inserts, so the panner would be fed by the effects chain and the law would follow the chain's output: a mono track would jump about 3 dB at centre as soon as a stereo effect was added.
- **Tone.js `Panner`** wraps a `StereoPannerNode` with a fixed channel count. On Tone's default context (standardized-audio-context) that setting cannot be changed, so a mono track's panner is locked to one channel and a stereo effect on the track is summed to mono before it is panned.

The stage implements the same two laws as `StereoPannerNode` (`panMatrix(pan, sourceChannelCount)` is the pure math) but takes the law from the caller — the channel count of the track's source material — and always passes stereo through. It works on any `AudioContext` or `OfflineAudioContext`, and on the raw context behind Tone.js.

## Effect registry

`registerEffect(type, definition)` makes a custom effect (an `AudioWorkletNode`, or any chain of native nodes) available by id to both hosts in this project: `<daw-editor>` (`editor.addEffect(type)`) and the React effects hooks (`addEffect(type)` from `useDynamicEffects()`). Both render it in their offline exports.

```typescript
import { registerEffect } from '@waveform-playlist/core';

registerEffect('my-tremolo', {
  label: 'Tremolo',
  category: 'modulation',
  defaults: { rate: 6, depth: 0.8 },
  params: {
    rate: { min: 0.1, max: 20, step: 0.1, unit: 'Hz' },
    depth: { min: 0, max: 1, step: 0.01 },
  },
  // Optional. Runs once per audio context, the offline one of an export included.
  prepare: (audioContext) => audioContext.audioWorklet.addModule('/worklets/tremolo.js'),
  create: (audioContext) => {
    const node = new AudioWorkletNode(audioContext, 'my-tremolo');
    return {
      input: node,
      output: node,
      applyParams: (params) => {
        for (const name of ['rate', 'depth']) {
          const param = node.parameters.get(name); // AudioParam | undefined
          const value = params[name];
          if (param && value !== undefined) param.value = value;
        }
      },
      // Tell the processor to stop (it returns false from process() once it
      // has received this message), then disconnect.
      dispose: () => {
        node.port.postMessage('dispose');
        node.disconnect();
      },
    };
  },
});
```

The two hosts await `prepare` differently. The React `addEffect(type)` is async and awaits it itself. `<daw-editor>`'s `addEffect(type)` is synchronous, so for a definition with `prepare` call `await editor.prepareEffect(type)` first. Both await it for their offline exports.

The host owns every connection out of the instance's `output` and disconnects all of them when it rewires the chain, so do not connect `output` to anything inside the effect (take a feedback tap from a node before it).

For an AudioWorklet effect, let `dispose` stop the processor with a port message, as above; a processor that always returns `true` from `process()` runs until the page closes. Do not have the processor return `false` whenever it is idle: in Chrome, a processor that returned `false` while nothing was connected to it (the effect bypassed by disconnection) did not run again when reconnected.

A definition with a `wetParam` is bypassed by setting that parameter to 0; one without is disconnected while bypassed. Also exported: `unregisterEffect`, `getEffectDefinitions`, `prepareEffect`, `ensureEffectPrepared`, `needsPrepare`, `createEffectInstance`, and the types `NativeEffectDefinition`, `NativeEffectInstance` and `EffectParamDef`.

The registry is stored on `globalThis`, so an effect registered through one installed copy of this package is visible to a host that uses another copy.
