---
sidebar_position: 1
description: "Install Waveform Playlist packages via npm or pnpm for React multitrack audio editing"
---

# Installation

## Package Manager

Install the main package, the Tone.js engine it plays through by default, and the packages your own code imports from:

```bash npm2yarn
npm install @waveform-playlist/browser @waveform-playlist/playout @waveform-playlist/core tone @dnd-kit/react
```

If you already have React and styled-components in your project, you're ready to go!

### Types and helpers come from `@waveform-playlist/core`

`@waveform-playlist/browser` exports its own components, hooks and types and re-exports nothing from the other packages. The types of the data you pass in (`ClipTrack`, `AudioClip`, `Fade`, `AnnotationData`) and the helpers that build it (`createTrack`, `createClipFromSeconds`) are exports of `@waveform-playlist/core`, and the pages of this documentation import them from there:

```tsx
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import { createTrack, type ClipTrack } from '@waveform-playlist/core';
```

`@waveform-playlist/core` is a dependency of `@waveform-playlist/browser`, so it is always installed with it. An import of it in your own code resolves under a package manager with a flat `node_modules` (npm) even when your project does not list it; under a strict one (pnpm) it does not. The install line above therefore names it. The same holds for `@waveform-playlist/ui-components`, also a dependency of browser, when you import from it (for example the `TimeFormat` type or `usePlaylistInfo`): add it to your project then. Keep all `@waveform-playlist/*` packages on the versions of one release, so that a single copy of each is installed.

## Peer Dependencies

Waveform Playlist requires the following peer dependencies:

| Package | Version | Purpose |
|---------|---------|---------|
| `react` | ^19.0.0 | UI framework |
| `react-dom` | ^19.0.0 | React DOM rendering |
| `styled-components` | ^6.0.0 | CSS-in-JS styling |
| `tone` | ^15.0.0 | Web Audio framework. An optional peer: needed for `WaveformPlaylistProvider`'s default engine, not for `MediaElementPlaylistProvider` or an adapter of your own |
| `@waveform-playlist/playout` | same release as `browser` | The Tone.js engine `WaveformPlaylistProvider` loads by default. An optional peer, so a package manager does not install it for you |
| `@dnd-kit/react` | ^0.5.0 | React bindings for drag and drop (includes `@dnd-kit/dom` and `@dnd-kit/abstract`) |

### Which Tone.js version?

`npm install tone` gives you the stable release (15.1.x). That is the default, and what the examples on this site run.

Tone.js also publishes a prerelease line, `npm install tone@next` (15.5.x), which is where its fixes land between the infrequent stable releases. Waveform Playlist supports both: every pull request is built and unit-tested against each. With `tone@next`, `configureGlobalContext({ sampleRate })` from `@waveform-playlist/playout` is honoured on the default audio context; on 15.1.x the context keeps the hardware sample rate.

`next` is a moving tag, so pin an exact version if you use it.

## Additional Packages

Depending on your needs, you may want to install additional packages:

### Annotations

For time-synchronized annotations:

```bash npm2yarn
npm install @waveform-playlist/annotations
```

Render `AnnotationProvider` above the view. Without it the annotation boxes and the annotation list draw nothing:

```tsx
import { AnnotationProvider } from '@waveform-playlist/annotations';

<WaveformPlaylistProvider
  tracks={tracks}
  annotationList={{ annotations, editable: true }}
  onAnnotationsChange={setAnnotations}
>
  <AnnotationProvider>
    <Waveform />
  </AnnotationProvider>
</WaveformPlaylistProvider>
```

### Recording

For microphone recording:

```bash npm2yarn
npm install @waveform-playlist/recording
```

This automatically installs `@waveform-playlist/worklets`, which provides the AudioWorklet processors for recording and VU metering. See the [AudioWorklet setup guide](/docs/react/guides/recording#audioworklet-setup) for bundler configuration.

Use `useIntegratedRecording` inside a `WaveformPlaylistProvider` to combine mic access, recording, and track management:

```tsx
import { useIntegratedRecording } from '@waveform-playlist/recording';
import { SegmentedVUMeter } from '@waveform-playlist/ui-components';

function RecordingControls({ tracks, setTracks, selectedTrackId }) {
  const { isRecording, meter, startRecording, stopRecording, requestMicAccess } =
    useIntegratedRecording(tracks, setTracks, selectedTrackId);

  return (
    <>
      <button onClick={requestMicAccess}>Enable Mic</button>
      <button onClick={isRecording ? stopRecording : startRecording}>
        {isRecording ? 'Stop' : 'Record'}
      </button>
      <SegmentedVUMeter meter={meter} />
    </>
  );
}

<WaveformPlaylistProvider tracks={tracks}>
  <RecordingControls tracks={tracks} setTracks={setTracks} selectedTrackId={selectedTrackId} />
  <Waveform />
</WaveformPlaylistProvider>
```

### Spectrogram

For spectrogram visualization (FFT computation, worker-based rendering, color maps):

```bash npm2yarn
npm install @waveform-playlist/spectrogram
```

Wrap your playlist with `SpectrogramProvider` to enable spectrogram features:

```tsx
import { SpectrogramProvider } from '@waveform-playlist/spectrogram';

<WaveformPlaylistProvider tracks={tracks}>
  <SpectrogramProvider config={spectrogramConfig} colorMap="viridis">
    <Waveform />
  </SpectrogramProvider>
</WaveformPlaylistProvider>
```

## TypeScript

All packages include TypeScript definitions. No additional `@types` packages are needed.

## Next Steps

- [Basic Usage](/docs/react/getting-started/basic-usage) - Create your first playlist
