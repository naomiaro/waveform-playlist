# @waveform-playlist/spectrogram

React Provider + UI for rendering waveform-playlist tracks as FFT spectrograms — color-mapped time-frequency plots instead of (or alongside) the time-domain waveform.

Wraps [`@dawcore/spectrogram`](https://www.npmjs.com/package/@dawcore/spectrogram), which owns the FFT computation, Web Worker, and chunked rendering. This package supplies the React layer: mount `<SpectrogramProvider>` inside `<WaveformPlaylistProvider>` from [`@waveform-playlist/browser`](https://www.npmjs.com/package/@waveform-playlist/browser).

## Features

- **Per-track FFT spectrograms** rendered from the real `AudioBuffer` — no separate analysis step
- **Render-mode switching** per track — `'waveform'`, `'spectrogram'`, or `'both'` (waveform on top, spectrogram below)
- **Six built-in color maps** (`viridis`, `magma`, `inferno`, `grayscale`, `igray`, `roseus`) plus custom `[r, g, b]` palettes
- **Five frequency scales** — linear, logarithmic, mel, bark, erb
- **Drop-in settings UI** — `<SpectrogramSettingsModal>` (FFT size, hop size, window function, gain/range, frequency bounds) and `<SpectrogramMenuItems>` for a track context menu
- **Viewport-aware rendering** — a Web Worker pool computes the visible chunks first, then a scroll buffer, then the rest in the background, so long timelines stay responsive

## Installation

```bash
npm install @waveform-playlist/spectrogram
```

Requires `@waveform-playlist/browser`, `react`, and `styled-components` as peer dependencies (already part of any waveform-playlist React setup). `@dawcore/spectrogram` is a regular dependency and installs automatically.

## Usage

Wrap your editor with `<SpectrogramProvider>` and set a track's `renderMode`:

```tsx
import { WaveformPlaylistProvider, Waveform } from '@waveform-playlist/browser';
import { useAudioTracks } from '@waveform-playlist/browser/tone';
import { SpectrogramProvider } from '@waveform-playlist/spectrogram';

function MyEditor() {
  const { tracks, loading } = useAudioTracks([
    { src: '/audio/vocals.opus', name: 'Vocals', renderMode: 'spectrogram' },
  ]);

  if (loading) return <div>Loading...</div>;

  return (
    <WaveformPlaylistProvider tracks={tracks}>
      <SpectrogramProvider config={{ fftSize: 2048, frequencyScale: 'mel' }} colorMap="viridis">
        <Waveform />
      </SpectrogramProvider>
    </WaveformPlaylistProvider>
  );
}
```

`<SpectrogramProvider>` exposes one config + one color map at a time; per-track overrides come from that track's own `spectrogramConfig` / `spectrogramColorMap` fields, or via `<SpectrogramSettingsModal>` at runtime.

## Examples & Documentation

Full guide, `SpectrogramConfig` reference, color map / frequency scale tables, and Web Components equivalent: [naomiaro.github.io/waveform-playlist](https://naomiaro.github.io/waveform-playlist/).

## License

MIT
